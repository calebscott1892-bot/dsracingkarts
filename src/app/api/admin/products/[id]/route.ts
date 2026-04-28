import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripHtml, slugify } from "@/lib/utils";

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
  if (body.categories) {
    // Remove existing
    const { error: deleteCategoriesError } = await service
      .from("product_categories")
      .delete()
      .eq("product_id", id);
    if (deleteCategoriesError) {
      return NextResponse.json({ error: deleteCategoriesError.message }, { status: 500 });
    }
    // Re-insert
    if (body.categories.length > 0) {
      const { error: insertCategoriesError } = await service.from("product_categories").insert(
        body.categories.map((catId: string) => ({
          product_id: id,
          category_id: catId,
        }))
      );
      if (insertCategoriesError) {
        return NextResponse.json({ error: insertCategoriesError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
