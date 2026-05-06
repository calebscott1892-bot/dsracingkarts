import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripHtml, slugify } from "@/lib/utils";
import { pushItemCategoryToSquare } from "@/lib/square-sync";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const };
}

/**
 * PUT /api/admin/products/[id]
 * Updates a product, its variations, and category links.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const service = createServiceClient();
  const requestedCategoryIds: string[] | null = Array.isArray(body.categories)
    ? body.categories.filter((id: unknown): id is string => typeof id === "string")
    : null;

  const [{ data: existingProduct }, { data: existingCategories }] = await Promise.all([
    service
      .from("products")
      .select("slug, square_token")
      .eq("id", id)
      .maybeSingle(),
    service
      .from("product_categories")
      .select("category_id, categories(square_id)")
      .eq("product_id", id),
  ]);

  const existingCategoryIds = new Set<string>(
    (existingCategories || [])
      .map((row: any) => row.category_id)
      .filter((categoryId: unknown): categoryId is string => typeof categoryId === "string")
  );

  // Update product
  const { error: productError } = await service
    .from("products")
    .update({
      name: body.name,
      slug: slugify(body.name),
      description: body.description,
      description_plain: stripHtml(body.description || ""),
      sku: body.sku || null,
      status: body.status,
      visibility: body.visibility,
      shipping_enabled: body.shipping_enabled,
      seo_title: body.seo_title || null,
      seo_description: body.seo_description || null,
      base_price: body.variations?.length
        ? Math.min(
            ...body.variations.map(
              (v: any) => v.sale_price || v.price
            )
          )
        : null,
    })
    .eq("id", id);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  // Update variations
  if (body.variations) {
    for (const v of body.variations) {
      if (v.id) {
        const { error: variationError } = await service
          .from("product_variations")
          .update({
            name: v.name,
            sku: v.sku || null,
            price: v.price,
            sale_price: v.sale_price || null,
          })
          .eq("id", v.id);
        if (variationError) {
          return NextResponse.json({ error: variationError.message }, { status: 500 });
        }
      }
    }
  }

  // Update categories
  if (requestedCategoryIds) {
    // Remove existing
    const { error: deleteCategoriesError } = await service
      .from("product_categories")
      .delete()
      .eq("product_id", id);
    if (deleteCategoriesError) {
      return NextResponse.json({ error: deleteCategoriesError.message }, { status: 500 });
    }
    // Re-insert
    if (requestedCategoryIds.length > 0) {
      const { error: insertCategoriesError } = await service.from("product_categories").insert(
        requestedCategoryIds.map((catId: string) => ({
          product_id: id,
          category_id: catId,
        }))
      );
      if (insertCategoriesError) {
        return NextResponse.json({ error: insertCategoriesError.message }, { status: 500 });
      }
    }
  }

  let squareWarning: string | null = null;
  if (requestedCategoryIds && existingProduct?.square_token) {
    const requestedSet = new Set<string>(requestedCategoryIds);
    const categoryIdsToSync = Array.from(
      new Set([
        ...Array.from(existingCategoryIds),
        ...requestedCategoryIds,
      ])
    );
    const { data: categoryRows, error: categoryFetchError } = await service
      .from("categories")
      .select("id, square_id")
      .in("id", categoryIdsToSync);

    if (categoryFetchError) {
      squareWarning = `Website saved, but Square category lookup failed: ${categoryFetchError.message}`;
    } else {
      const squareIdByCategoryId = new Map<string, string | null>(
        (categoryRows || []).map((category: any) => [category.id, category.square_id])
      );
      const toAdd = requestedCategoryIds.filter((catId) => !existingCategoryIds.has(catId));
      const toRemove = Array.from(existingCategoryIds).filter((catId) => !requestedSet.has(catId));

      for (const categoryId of toAdd) {
        const squareCategoryId = squareIdByCategoryId.get(categoryId);
        if (!squareCategoryId) {
          squareWarning = "Website saved, but at least one category has no Square ID.";
          continue;
        }
        const result = await pushItemCategoryToSquare(
          existingProduct.square_token,
          squareCategoryId,
          "add",
          `product-edit-add-${id}-${categoryId}-${Date.now()}`
        );
        if (!result.ok) squareWarning = result.reason;
      }

      for (const categoryId of toRemove) {
        const squareCategoryId = squareIdByCategoryId.get(categoryId);
        if (!squareCategoryId) {
          squareWarning = "Website saved, but at least one removed category has no Square ID.";
          continue;
        }
        const result = await pushItemCategoryToSquare(
          existingProduct.square_token,
          squareCategoryId,
          "remove",
          `product-edit-remove-${id}-${categoryId}-${Date.now()}`
        );
        if (!result.ok) squareWarning = result.reason;
      }
    }
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/shop");
  if (existingProduct?.slug) revalidatePath(`/product/${existingProduct.slug}`);

  return NextResponse.json({ success: true, squareWarning });
}
