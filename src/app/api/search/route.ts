import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRealProductImageUrl } from "@/lib/product-images";
import {
  applyProductSearchFilter,
  getProductSearchTermGroups,
  scoreProductSearchResult,
  type ProductSearchMode,
} from "@/lib/productSearch";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") || "").trim();
  if (raw.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const termGroups = getProductSearchTermGroups(raw);
  if (termGroups.length === 0) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const supabase = await createClient();

  async function runSearch(mode: ProductSearchMode) {
    const query = supabase
      .from("products")
      .select(
        `
        id, name, slug, base_price, primary_image_url, sku, description_plain,
        product_categories ( categories ( name, slug ) )
      `,
        { count: "exact" }
      )
      .eq("status", "active")
      .eq("visibility", "visible");

    return applyProductSearchFilter(query, termGroups, mode).limit(100);
  }

  let { data, count } = await runSearch("all");
  if ((!data || data.length === 0) && termGroups.length > 1) {
    ({ data, count } = await runSearch("any"));
  }

  const ranked = (data || [])
    .map((p: any) => ({
      ...p,
      _searchScore: scoreProductSearchResult(p, termGroups),
    }))
    .sort((a: any, b: any) =>
      b._searchScore - a._searchScore || String(a.name).localeCompare(String(b.name))
    )
    .slice(0, 6);

  const results = ranked.map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.base_price,
    image_url: isRealProductImageUrl(p.primary_image_url)
      ? p.primary_image_url
      : null,
    sku: p.sku,
    category: p.product_categories?.[0]?.categories?.name || null,
    category_slug: p.product_categories?.[0]?.categories?.slug || null,
  }));

  return NextResponse.json({ results, total: count || 0 });
}
