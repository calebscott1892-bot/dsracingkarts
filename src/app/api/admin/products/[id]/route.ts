import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripHtml, slugify } from "@/lib/utils";

/**
 * PUT /api/admin/products/[id]
 * Updates a product, its variations, inventory, and category links.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  // Update variations & inventory
  if (body.variations) {
    for (const v of body.variations) {
      if (v.id) {
        await service
          .from("product_variations")
          .update({
            name: v.name,
            sku: v.sku || null,
            price: v.price,
            sale_price: v.sale_price || null,
          })
          .eq("id", v.id);

        // Update inventory
        await service
          .from("inventory")
          .update({
            quantity: v.quantity,
            low_stock_alert: v.low_stock_alert,
            low_stock_threshold: v.low_stock_threshold,
          })
          .eq("variation_id", v.id);
      }
    }
  }

  // Update categories
  if (body.categories) {
    // Remove existing
    await service.from("product_categories").delete().eq("product_id", id);
    // Re-insert
    if (body.categories.length > 0) {
      await service.from("product_categories").insert(
        body.categories.map((catId: string) => ({
          product_id: id,
          category_id: catId,
        }))
      );
    }
  }

  return NextResponse.json({ success: true });
}
