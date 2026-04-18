import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Escape characters that have special meaning in PostgREST / SQL LIKE patterns */
function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\,().*]/g, "");
}

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") || "").trim();
  if (raw.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const q = sanitizeSearch(raw);
  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const supabase = await createClient();

  // Full-text-ish search — Supabase `ilike` with wildcards. Matches name and SKU.
  // ProductCategories joined so we can show the first category next to the product.
  const { data, count } = await supabase
    .from("products")
    .select(
      `
      id, name, slug, base_price, primary_image_url, sku,
      product_categories ( categories ( name, slug ) )
    `,
      { count: "exact" }
    )
    .eq("status", "active")
    .eq("visibility", "visible")
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .limit(6);

  const results = (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.base_price,
    image_url: p.primary_image_url,
    sku: p.sku,
    category: p.product_categories?.[0]?.categories?.name || null,
    category_slug: p.product_categories?.[0]?.categories?.slug || null,
  }));

  return NextResponse.json({ results, total: count || 0 });
}
