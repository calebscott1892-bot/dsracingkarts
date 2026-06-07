import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, AlertTriangle, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { SearchAutocomplete } from "@/components/shop/SearchAutocomplete";
import { CategoryGrid } from "@/components/shop/CategoryGrid";
import { CHASSIS_CATEGORY_HREF } from "@/lib/shop-links";
import { isRealProductImageUrl } from "@/lib/product-images";
import {
  applyProductSearchFilter,
  getProductSearchTermGroups,
  PRODUCT_SEARCH_RELATED_MATCH_ID_LIMIT,
  scoreProductSearchResult,
  type ProductSearchRelatedMatchIds,
  type ProductSearchMode,
} from "@/lib/productSearch";

const GIFT_CARD_SLUG = "ds-racing-karts-e-gift-card";
const SHOP_DESCRIPTION =
  "Browse our full range of go kart parts, engines, chassis, brakes, racewear and accessories.";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
    // ?view=all opts out of the mobile category-first landing and shows
    // the flat product list on every device.
    view?: string;
  }>;
}

type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  square_id?: string | null;
  image_url?: string | null;
  sort_order?: number | null;
};

function normalizeCategoryKey(name: string) {
  return name.trim().toLowerCase();
}

function slugifyCategoryName(name: string) {
  return normalizeCategoryKey(name)
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findCategoryByParam(categories: ShopCategory[], categoryParam: string) {
  return (
    categories.find((category) => category.slug === categoryParam) ??
    categories.find((category) => slugifyCategoryName(category.name) === categoryParam)
  );
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

  const dedupedCategories = Array.from(canonicalByKey.values()).map((category) => {
    if (!category.parent_id) return category;
    const parent = byId.get(category.parent_id);
    if (!parent) return category;
    const canonicalParent = canonicalByKey.get(dedupeKey(parent));
    return canonicalParent ? { ...category, parent_id: canonicalParent.id } : category;
  }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return { dedupedCategories, idsByCanonicalSlug };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const canonicalParams = new URLSearchParams();
  if (params.page && params.page !== "1") canonicalParams.set("page", params.page);

  const hasSearchQuery = Boolean(params.search?.trim());
  let categoryLabel: string | null = null;

  if (params.category) {
    const supabase = await createClient();
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, parent_id, slug, square_id")
      .order("name");

    const categoryLookup = buildCategoryLookup((categories || []) as ShopCategory[]);
    const selectedCategory = findCategoryByParam(categoryLookup.dedupedCategories, params.category);
    categoryLabel = selectedCategory?.name ?? params.category
      .split("-")
      .filter((part) => !/^\d+$/.test(part))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    canonicalParams.set("category", selectedCategory?.slug ?? params.category);
  }

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
const SEARCH_RANK_WINDOW = 600;

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const parsedPage = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, parent_id, slug, square_id, image_url, sort_order")
    .order("name");

  const categoryLookup = buildCategoryLookup((allCategories || []) as ShopCategory[]);
  const dedupedCategories = categoryLookup.dedupedCategories;
  const selectedCategory = params.category
    ? findCategoryByParam(dedupedCategories, params.category)
    : null;

  const selectedCanonicalIds = selectedCategory
    ? categoryLookup.idsByCanonicalSlug.get(selectedCategory.slug) || [selectedCategory.id]
    : [];

  const selectedChildCategories = selectedCategory
    ? dedupedCategories
        .filter((category) => category.parent_id && selectedCanonicalIds.includes(category.parent_id))
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          image_url: category.image_url ?? null,
          sort_order: category.sort_order ?? 0,
        }))
        .sort(
          (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
        )
    : [];

  const showSubcategoryLanding = selectedChildCategories.length > 0;
  let subcategoryTiles = selectedChildCategories;

  if (showSubcategoryLanding && selectedChildCategories.some((category) => !category.image_url)) {
    const childIdsMissingImages = selectedChildCategories
      .filter((category) => !category.image_url)
      .map((category) => category.id);

    const { data: fallbackImageRows } = await supabase
      .from("product_categories")
      .select(
        `
        category_id,
        products!inner (
          primary_image_url,
          status,
          visibility,
          slug
        )
      `
      )
      .in("category_id", childIdsMissingImages)
      .eq("products.status", "active")
      .eq("products.visibility", "visible")
      .neq("products.slug", GIFT_CARD_SLUG)
      .not("products.primary_image_url", "is", null)
      .limit(500);

    const fallbackImageByCategory = new Map<string, string>();
    for (const row of fallbackImageRows || []) {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      const imageUrl = product?.primary_image_url;
      if (!isRealProductImageUrl(imageUrl)) continue;
      if (!fallbackImageByCategory.has(row.category_id)) {
        fallbackImageByCategory.set(row.category_id, imageUrl);
      }
    }

    subcategoryTiles = selectedChildCategories.map((category) => ({
      ...category,
      image_url: category.image_url || fallbackImageByCategory.get(category.id) || null,
    }));
  }

  let categoryProductIds: string[] | null = null;
  if (params.category) {
    if (selectedCategory) {
      const childIds = (allCategories || [])
        .filter((c) => selectedCanonicalIds.includes(c.parent_id || ""))
        .map((c) => c.id);
      const catIds = Array.from(new Set([...selectedCanonicalIds, ...childIds]));
      const { data: pcRows } = await supabase
        .from("product_categories")
        .select("product_id")
        .in("category_id", catIds);
      categoryProductIds = pcRows?.map((r) => r.product_id) ?? [];
    } else {
      categoryProductIds = [];
    }
  }

  const searchTermGroups = getProductSearchTermGroups(params.search);
  const shouldRankSearchResults = searchTermGroups.length > 1 && !params.sort;
  const relatedMatchIds: ProductSearchRelatedMatchIds = searchTermGroups.length > 0
    ? await Promise.all(
        searchTermGroups.map(async (group) => {
          const filters = group.flatMap((term) => [
            `name.ilike.%${term}%`,
            `sku.ilike.%${term}%`,
          ]);
          const { data } = await supabase
            .from("product_variations")
            .select("product_id")
            .or(filters.join(","))
            .limit(PRODUCT_SEARCH_RELATED_MATCH_ID_LIMIT);

          return Array.from(new Set((data || []).map((row) => row.product_id).filter(Boolean)));
        })
      )
    : [];

  function buildProductsQuery(
    searchMode: ProductSearchMode = "all",
    range: { from: number; to: number } = { from: offset, to: offset + PAGE_SIZE - 1 },
  ) {
    let query = supabase
      .from("products")
      .select(
        `
        id, name, slug, sku, description_plain, base_price, primary_image_url, is_stockable,
        product_variations ( price, sale_price, sku, name, inventory ( quantity, stock_status ) ),
        product_categories ( category_id, categories ( name, slug ) )
      `,
        { count: "exact" }
      )
      .eq("status", "active")
      .eq("visibility", "visible")
      .eq("is_sellable", true)
      .neq("slug", GIFT_CARD_SLUG);

    if (categoryProductIds !== null) {
      if (categoryProductIds.length === 0) {
        query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
      } else {
        query = query.in("id", categoryProductIds);
      }
    }

    if (searchTermGroups.length > 0) {
      query = applyProductSearchFilter(query, searchTermGroups, searchMode, relatedMatchIds);
    }

    if (shouldRankSearchResults) {
      query = query.order("name", { ascending: true });
    } else {
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
    }

    return query.range(range.from, range.to);
  }

  async function loadProducts(searchMode: ProductSearchMode) {
    const range = shouldRankSearchResults
      ? { from: 0, to: SEARCH_RANK_WINDOW - 1 }
      : { from: offset, to: offset + PAGE_SIZE - 1 };
    const { data, count } = await buildProductsQuery(searchMode, range);

    if (!shouldRankSearchResults || !data) {
      return { products: data, count: count || 0 };
    }

    const ranked = data
      .map((product: any) => ({
        ...product,
        _searchScore: scoreProductSearchResult(product, searchTermGroups),
      }))
      .sort((a: any, b: any) =>
        b._searchScore - a._searchScore || String(a.name).localeCompare(String(b.name))
      );

    return {
      products: ranked.slice(offset, offset + PAGE_SIZE),
      count: Math.min(count || 0, SEARCH_RANK_WINDOW),
    };
  }

  let { products, count } = await loadProducts("all");
  if ((!products || products.length === 0) && searchTermGroups.length > 1) {
    ({ products, count } = await loadProducts("any"));
  }
  const productCount = count || 0;
  const totalPages = Math.ceil(productCount / PAGE_SIZE);

  // Top-level categories (no parent) for the mobile category-first landing.
  // Re-uses the same CategoryGrid the homepage uses, so any new category
  // the client adds in Square (or accepts via the suggestion flow) shows
  // up here automatically as soon as the next sync lands.
  const topLevelCategories = dedupedCategories
    .filter((c) => !c.parent_id)
    .map((c) => {
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        image_url: c.image_url ?? null,
        sort_order: c.sort_order ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
    );

  // The mobile-only category landing: show categories instead of a wall of
  // products when the user lands on /shop with no filter applied. ?view=all
  // bypasses it. Search opts out too — if you typed a search you want to
  // see results, not categories.
  const showMobileCategoryLanding =
    !params.category && !params.search && params.view !== "all";

  const categoryTitle = selectedCategory?.name ?? (params.category
    ? params.category.replace(/-/g, " ")
    : "Shop");

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
              Need a Chassis?
            </p>
            <p className="text-white/65 text-sm leading-relaxed">
              Go straight to our chassis category for new chassis and related kart setup options.
            </p>
          </div>
          <Link href={CHASSIS_CATEGORY_HREF} className="btn-secondary shrink-0 text-sm px-5 self-start md:self-auto">
            Shop Chassis
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
        <div
          className={`flex items-center gap-3 mb-3 ${
            showMobileCategoryLanding ? "hidden md:flex" : "flex"
          }`}
        >
          <span className="h-[1px] w-8 bg-brand-red" />
          <span className="font-heading text-xs tracking-[0.4em] text-brand-red uppercase">
            {showSubcategoryLanding
              ? `${selectedChildCategories.length} Subcategories`
              : `${productCount} Products`}
          </span>
        </div>
        <h1 className="section-heading capitalize">{categoryTitle}</h1>
      </div>

      <div className="mb-8">
        <SearchAutocomplete initialQuery={params.search} />
      </div>

      {/* ── Mobile-only category landing ─────────────────────────────
          When no filter is applied, mobile visitors see the category
          directory instead of a 24-product wall. Tapping a tile loads
          /shop?category=<slug> which re-renders this page with the
          existing product grid. Desktop is unaffected. */}
      {showMobileCategoryLanding && (
        <div className="md:hidden mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-brand-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-brand-red uppercase">
              Browse by Category
            </span>
          </div>
          <CategoryGrid
            categories={topLevelCategories}
            extraTile={{
              href: "/shop?view=all",
              title: "See All Products",
              subtitle: "Skip the categories",
            }}
          />
          <p className="text-text-muted text-xs mt-4 text-center leading-relaxed">
            Tap a category to start browsing — or use the search above to jump
            straight to a part.
          </p>
        </div>
      )}

      {showSubcategoryLanding && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-brand-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-brand-red uppercase">
              Browse {selectedCategory?.name} Subcategories
            </span>
          </div>
          <CategoryGrid categories={subcategoryTiles} />
          <p className="text-text-muted text-xs mt-4 text-center leading-relaxed">
            Choose a subcategory to see the matching products.
          </p>
        </div>
      )}

      <div
        className={`flex flex-col lg:flex-row gap-8 ${
          showSubcategoryLanding
            ? "hidden"
            : showMobileCategoryLanding
              ? "hidden md:flex"
              : ""
        }`}
      >
        <aside className="lg:w-60 shrink-0">
          <ShopFilters
            categories={dedupedCategories}
            currentCategory={selectedCategory?.slug ?? params.category}
            currentSort={params.sort}
            currentSearch={params.search}
          />
        </aside>

        <div className="flex-1">
          {products && products.length > 0 ? (
            <>
              <p className="text-text-muted text-xs mb-5 font-heading uppercase tracking-wider">
                Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, productCount)} of {productCount}
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
