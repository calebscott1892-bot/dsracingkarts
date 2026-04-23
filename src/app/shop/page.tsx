import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { SearchAutocomplete } from "@/components/shop/SearchAutocomplete";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop All Products",
  description: "Browse our full range of go kart parts, engines, chassis, brakes, racewear and accessories.",
};

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
    stock?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  // Resolve category slug → product IDs before building the main query.
  // Filtering on nested relations (product_categories.categories.slug) in
  // Supabase PostgREST doesn't filter parent rows — we do it explicitly here.
  let categoryProductIds: string[] | null = null;
  if (params.category) {
    // Find the category (and any child categories) matching the slug
    const { data: allCats } = await supabase
      .from("categories")
      .select("id, parent_id, slug");

    const matchedCat = allCats?.find((c) => c.slug === params.category);
    if (matchedCat) {
      const catIds = [
        matchedCat.id,
        ...(allCats?.filter((c) => c.parent_id === matchedCat.id).map((c) => c.id) ?? []),
      ];
      const { data: pcRows } = await supabase
        .from("product_categories")
        .select("product_id")
        .in("category_id", catIds);
      categoryProductIds = pcRows?.map((r) => r.product_id) ?? [];
    } else {
      categoryProductIds = []; // unknown slug → no results
    }
  }

  let query = supabase
    .from("products")
    .select(`
      id, name, slug, base_price, primary_image_url,
      product_variations ( price, sale_price ),
      product_categories ( category_id, categories ( slug ) )
    `, { count: "exact" })
    .eq("status", "active")
    .eq("visibility", "visible");

  if (categoryProductIds !== null) {
    if (categoryProductIds.length === 0) {
      // No products in this category — force empty result
      query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      query = query.in("id", categoryProductIds);
    }
  }

  if (params.search) {
    const sanitized = params.search.replace(/[%_\\,().*]/g, "");
    if (sanitized) {
      query = query.ilike("name", `%${sanitized}%`);
    }
  }

  switch (params.sort) {
    case "price_asc":
      query = query.order("base_price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("base_price", { ascending: false });
      break;
    case "name_asc":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: products, count } = await query;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("name");

  const categoryTitle = params.category
    ? params.category.replace(/-/g, " ")
    : "All Products";

  function buildUrl(pageNum: number) {
    const p = new URLSearchParams();
    if (params.category) p.set("category", params.category);
    if (params.search) p.set("search", params.search);
    if (params.sort) p.set("sort", params.sort);
    if (pageNum > 1) p.set("page", String(pageNum));
    const qs = p.toString();
    return `/shop${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <ChevronRight size={12} />
        <span className="text-text-secondary">Shop</span>
        {params.category && (
          <>
            <ChevronRight size={12} />
            <span className="text-white capitalize">{categoryTitle}</span>
          </>
        )}
      </div>

      {/* Appointment Only Notice */}
      <div className="mb-6 border border-racing-red/20 bg-racing-red/5 px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-racing-red shrink-0 mt-0.5" />
        <p className="text-white/60 text-xs leading-relaxed">
          <span className="font-heading uppercase tracking-wider text-racing-red text-xs">Appointment only workshop</span>
          {" — "}Our workshop is on a private property. If you need servicing, fitting, or pickup, please
          {" "}<Link href="/contact" className="text-racing-red hover:text-racing-red/80 underline underline-offset-2 transition-colors">contact us</Link>
          {" "}to arrange an appointment before visiting.
        </p>
      </div>

      {/* Page heading */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-[1px] w-8 bg-brand-red" />
          <span className="font-heading text-xs tracking-[0.4em] text-brand-red uppercase">
            {count || 0} Products
          </span>
        </div>
        <h1 className="section-heading capitalize">{categoryTitle}</h1>
      </div>

      {/* Premium search */}
      <div className="mb-8">
        <SearchAutocomplete initialQuery={params.search} />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="lg:w-60 shrink-0">
          <ShopFilters
            categories={categories || []}
            currentCategory={params.category}
            currentSort={params.sort}
            currentSearch={params.search}
          />
        </aside>

        {/* Products */}
        <div className="flex-1">
          {products && products.length > 0 ? (
            <>
              <p className="text-text-muted text-xs mb-5 font-heading uppercase tracking-wider">
                Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, count || 0)} of {count}
              </p>

              <div className="product-grid">
                {products.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    product={product as any}
                    priority={idx < 4}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-10">
                  {page > 1 && (
                    <a
                      href={buildUrl(page - 1)}
                      className="w-11 h-11 flex items-center justify-center bg-surface-700
                                 text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </a>
                  )}

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && p - prev > 1;
                      return (
                        <span key={p} className="contents">
                          {showEllipsis && (
                            <span className="w-11 h-11 flex items-center justify-center text-text-muted text-xs">
                              ...
                            </span>
                          )}
                          <a
                            href={buildUrl(p)}
                            className={`w-11 h-11 flex items-center justify-center text-sm font-heading transition-colors ${
                              p === page
                                ? "bg-brand-red text-white"
                                : "bg-surface-700 text-text-muted hover:text-white hover:bg-surface-600"
                            }`}
                          >
                            {p}
                          </a>
                        </span>
                      );
                    })}

                  {page < totalPages && (
                    <a
                      href={buildUrl(page + 1)}
                      className="w-11 h-11 flex items-center justify-center bg-surface-700
                                 text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
                    >
                      <ChevronRight size={18} />
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-text-muted font-heading uppercase tracking-wider text-sm mb-2">
                No products found
              </p>
              <p className="text-text-muted text-xs">Try adjusting your filters or search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
