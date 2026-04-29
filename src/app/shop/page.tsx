import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, AlertTriangle, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { SearchAutocomplete } from "@/components/shop/SearchAutocomplete";

const GIFT_CARD_SLUG = "ds-racing-karts-e-gift-card";
const SHOP_DESCRIPTION =
  "Browse our full range of go kart parts, engines, chassis, brakes, racewear and accessories.";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  square_id?: string | null;
};

function normalizeCategoryKey(name: string) {
  return name.trim().toLowerCase();
}

function buildCategoryLookup(categories: ShopCategory[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));

  function parentName(category: ShopCategory) {
    if (!category.parent_id) return "";
    return byId.get(category.parent_id)?.name.trim().toLowerCase() || "";
  }

  function dedupeKey(category: ShopCategory) {
    return `${parentName(category)}::${normalizeCategoryKey(category.name)}`;
  }

  function choosePreferred(current: ShopCategory | undefined, candidate: ShopCategory) {
    if (!current) return candidate;
    if (!current.square_id && candidate.square_id) return candidate;
    if (current.square_id && !candidate.square_id) return current;
    return current.slug.localeCompare(candidate.slug) <= 0 ? current : candidate;
  }

  const canonicalByKey = new Map<string, ShopCategory>();
  for (const category of categories) {
    const key = dedupeKey(category);
    canonicalByKey.set(key, choosePreferred(canonicalByKey.get(key), category));
  }

  const idsByCanonicalSlug = new Map<string, string[]>();
  for (const category of categories) {
    const key = dedupeKey(category);
    const canonical = canonicalByKey.get(key);
    if (!canonical) continue;
    idsByCanonicalSlug.set(canonical.slug, [
      ...(idsByCanonicalSlug.get(canonical.slug) || []),
      category.id,
    ]);
  }

  const dedupedCategories = Array.from(canonicalByKey.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return { dedupedCategories, idsByCanonicalSlug };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const canonicalParams = new URLSearchParams();
  if (params.category) canonicalParams.set("category", params.category);
  if (params.page && params.page !== "1") canonicalParams.set("page", params.page);

  const hasSearchQuery = Boolean(params.search?.trim());
  const categoryLabel = params.category
    ? params.category
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : null;

  return {
    title: categoryLabel ? `${categoryLabel} Parts` : "Shop All Products",
    description: categoryLabel
      ? `Shop ${categoryLabel.toLowerCase()} and related go kart parts at DS Racing Karts.`
      : SHOP_DESCRIPTION,
    alternates: {
      canonical: canonicalParams.toString() ? `/shop?${canonicalParams.toString()}` : "/shop",
    },
    robots: hasSearchQuery
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  };
}

const PAGE_SIZE = 24;

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  let categoryProductIds: string[] | null = null;
  if (params.category) {
    const { data: allCats } = await supabase
      .from("categories")
      .select("id, name, parent_id, slug, square_id");

    const categoryLookup = buildCategoryLookup((allCats || []) as ShopCategory[]);
    const matchedCat = categoryLookup.dedupedCategories.find((c) => c.slug === params.category);
    if (matchedCat) {
      const canonicalIds = categoryLookup.idsByCanonicalSlug.get(matchedCat.slug) || [matchedCat.id];
      const childIds = (allCats || [])
        .filter((c) => canonicalIds.includes(c.parent_id || ""))
        .map((c) => c.id);
      const catIds = Array.from(new Set([...canonicalIds, ...childIds]));
      const { data: pcRows } = await supabase
        .from("product_categories")
        .select("product_id")
        .in("category_id", catIds);
      categoryProductIds = pcRows?.map((r) => r.product_id) ?? [];
    } else {
      categoryProductIds = [];
    }
  }

  let query = supabase
    .from("products")
    .select(
      `
      id, name, slug, sku, base_price, primary_image_url,
      product_variations ( price, sale_price, sku ),
      product_categories ( category_id, categories ( slug ) )
    `,
      { count: "exact" }
    )
    .eq("status", "active")
    .eq("visibility", "visible")
    .neq("slug", GIFT_CARD_SLUG);

  if (categoryProductIds !== null) {
    if (categoryProductIds.length === 0) {
      query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      query = query.in("id", categoryProductIds);
    }
  }

  if (params.search) {
    const sanitized = params.search.replace(/[%_\\,().*]/g, "");
    if (sanitized) query = query.ilike("name", `%${sanitized}%`);
  }

  switch (params.sort) {
    case "price_asc":
      query = query.order("base_price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("base_price", { ascending: false });
      break;
    case "name_asc":
    default:
      query = query.order("name", { ascending: true });
      break;
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: products, count } = await query;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, square_id")
    .order("name");

  const dedupedCategories = buildCategoryLookup((categories || []) as ShopCategory[]).dedupedCategories;

  const categoryTitle = params.category
    ? params.category.replace(/-/g, " ")
    : "Shop";

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

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/gift-card"
          className="group relative border border-racing-red/40 bg-gradient-to-br from-racing-red/15 via-racing-red/5 to-transparent px-4 py-4 md:px-5 md:py-4 flex items-center gap-4 hover:border-racing-red transition-colors"
        >
          <div className="shrink-0 p-3 border border-racing-red/40 bg-racing-red/10 rounded">
            <Gift size={28} className="text-racing-red" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading text-xs uppercase tracking-[0.25em] text-racing-red mb-1">
              E-Gift Card
            </p>
            <p className="text-white/85 text-sm leading-relaxed">
              Give the gift of speed - $50, $100, $200, $500 or custom.
            </p>
          </div>
          <span className="hidden sm:inline-flex shrink-0 font-heading text-[11px] uppercase tracking-[0.15em] text-racing-red group-hover:text-white transition-colors">
            Buy Now {"->"}
          </span>
        </Link>

        <div className="border border-white/10 bg-white/[0.03] px-4 py-4 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-heading text-xs uppercase tracking-[0.25em] text-racing-red mb-1">
              Looking For Second-Hand Chassis?
            </p>
            <p className="text-white/65 text-sm leading-relaxed">
              Browse our preloved Predator chassis board if you&apos;re chasing a used enduro setup, or want to list one for sale.
            </p>
          </div>
          <Link href="/predator-chassis" className="btn-secondary shrink-0 text-sm px-5 self-start md:self-auto">
            Browse Preloved Chassis
          </Link>
        </div>
      </div>

      <div className="mb-6 border border-racing-red/20 bg-racing-red/5 px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-racing-red shrink-0 mt-0.5" />
        <p className="text-white/60 text-xs leading-relaxed">
          <span className="font-heading uppercase tracking-wider text-racing-red text-xs">Appointment only workshop</span>
          {" - "}Our workshop is on a private property. If you need servicing, fitting, or pickup, please{" "}
          <Link href="/contact" className="text-racing-red hover:text-racing-red/80 underline underline-offset-2 transition-colors">
            contact us
          </Link>{" "}
          to arrange an appointment before visiting.
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-[1px] w-8 bg-brand-red" />
          <span className="font-heading text-xs tracking-[0.4em] text-brand-red uppercase">
            {count || 0} Products
          </span>
        </div>
        <h1 className="section-heading capitalize">{categoryTitle}</h1>
      </div>

      <div className="mb-8">
        <SearchAutocomplete initialQuery={params.search} />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-60 shrink-0">
          <ShopFilters
            categories={dedupedCategories}
            currentCategory={params.category}
            currentSort={params.sort}
            currentSearch={params.search}
          />
        </aside>

        <div className="flex-1">
          {products && products.length > 0 ? (
            <>
              <p className="text-text-muted text-xs mb-5 font-heading uppercase tracking-wider">
                Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, count || 0)} of {count}
              </p>

              <div className="product-grid">
                {products.map((product, idx) => (
                  <ProductCard key={product.id} product={product as any} priority={idx < 4} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-10">
                  {page > 1 && (
                    <a
                      href={buildUrl(page - 1)}
                      className="w-11 h-11 flex items-center justify-center bg-surface-700 text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
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
                      className="w-11 h-11 flex items-center justify-center bg-surface-700 text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
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
