import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Search, ExternalLink, Archive } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import {
  applyProductSearchFilter,
  getProductSearchTermGroups,
  PRODUCT_SEARCH_RELATED_MATCH_ID_LIMIT,
  scoreProductSearchResult,
  type ProductSearchRelatedMatchIds,
  type ProductSearchMode,
} from "@/lib/productSearch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ search?: string; page?: string; status?: string; supplier?: string }>;
}

const PAGE_SIZE = 25;
const SEARCH_RANK_WINDOW = 800;

export default async function AdminProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = createServiceClient();
  const parsedPage = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const statusFilter = ["all", "active", "draft", "archived"].includes(params.status || "")
    ? params.status!
    : "active";
  const { data: supplierOptions } = await supabase
    .from("suppliers")
    .select("name")
    .order("name");
  const supplierNames = (supplierOptions || [])
    .map((supplier) => supplier.name)
    .filter(Boolean);
  const supplierFilter = supplierNames.includes(params.supplier || "")
    ? params.supplier!
    : "all";
  const searchTermGroups = getProductSearchTermGroups(params.search);
  const shouldRankSearchResults = searchTermGroups.length > 0;
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

  function buildProductsUrl(
    pageNum: number,
    overrides: { status?: string; supplier?: string } = {},
  ) {
    const nextStatus = overrides.status ?? statusFilter;
    const nextSupplier = overrides.supplier ?? supplierFilter;
    const urlParams = new URLSearchParams();
    if (params.search?.trim()) urlParams.set("search", params.search.trim());
    if (nextStatus && nextStatus !== "active") urlParams.set("status", nextStatus);
    if (nextSupplier && nextSupplier !== "all") urlParams.set("supplier", nextSupplier);
    if (pageNum > 1) urlParams.set("page", String(pageNum));
    const qs = urlParams.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  }

  function buildProductsQuery(
    searchMode: ProductSearchMode = "all",
    range: { from: number; to: number } = { from: offset, to: offset + PAGE_SIZE - 1 },
  ) {
    const supplierSelect = supplierFilter !== "all"
      ? "product_supplier_costs!inner ( id, suppliers!inner ( name ) )"
      : "product_supplier_costs ( id, suppliers ( name ) )";
    let query = supabase
      .from("products")
      .select(
        `
        id, name, slug, sku, description_plain, base_price, status, visibility, primary_image_url,
        product_variations ( id, name, sku, price ),
        product_categories ( categories ( name, slug ) ),
        ${supplierSelect}
      `,
        { count: "exact" }
      )
      .order("name");

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (searchTermGroups.length > 0) {
      query = applyProductSearchFilter(query, searchTermGroups, searchMode, relatedMatchIds);
    }
    if (supplierFilter !== "all") {
      query = query.eq("product_supplier_costs.suppliers.name", supplierFilter);
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
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Products</h1>
        <a
          href="https://squareup.com/dashboard/items/library"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ExternalLink size={16} /> Manage in Square
        </a>
      </div>

      {statusFilter === "archived" && (
        <div className="border border-amber-500/30 bg-amber-500/10 px-4 py-4 mb-6 flex gap-3">
          <Archive size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-white/80 leading-relaxed">
            <p className="font-medium text-white mb-1">What &ldquo;archived&rdquo; means.</p>
            <p>
              A product becomes archived automatically when Square either deletes it
              or hides it from the catalog the next time the website syncs. The
              website will not show archived items to customers.
            </p>
            <p className="mt-2">
              <span className="text-white">To bring one back:</span> open the item in
              Square (use <span className="text-white">Manage in Square</span> above
              or click into a row and use the per-product resync), make sure it is
              <em className="text-white not-italic"> visible / not deleted</em> there,
              then resync. The website will flip it back to active automatically.
            </p>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4">
        <form className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          {statusFilter !== "active" && <input type="hidden" name="status" value={statusFilter} />}
          {supplierFilter !== "all" && <input type="hidden" name="supplier" value={supplierFilter} />}
          <input
            type="text"
            name="search"
            defaultValue={params.search}
            placeholder="Search products…"
            className="w-full bg-surface-700 border border-surface-600 rounded pl-9 pr-4 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          />
        </form>

        <div className="flex gap-2">
          {["all", "active", "draft", "archived"].map((s) => (
            <a
              key={s}
              href={buildProductsUrl(1, { status: s })}
              className={`px-3 py-2 rounded text-xs uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-brand-red text-white"
                  : "bg-surface-700 text-text-secondary hover:bg-surface-600"
              }`}
            >
              {s}
            </a>
          ))}
        </div>

        {supplierNames.length > 0 && (
          <div className="flex gap-2">
            {["all", ...supplierNames].map((supplier) => (
              <a
                key={supplier}
                href={buildProductsUrl(1, { supplier })}
                className={`px-3 py-2 rounded text-xs uppercase tracking-wider transition-colors ${
                  supplierFilter === supplier
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                    : "bg-surface-700 text-text-secondary hover:bg-surface-600"
                }`}
              >
                {supplier === "all" ? "All suppliers" : supplier}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Products table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-left bg-surface-700/50">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products?.map((product: any) => {
              const displaySku = product.sku || product.product_variations?.find((v: any) => v.sku)?.sku;
              const suppliers = Array.from(
                new Set(
                  (product.product_supplier_costs || [])
                    .map((cost: any) => cost.suppliers?.name)
                    .filter(Boolean)
                )
              );

              return (
                <tr
                  key={product.id}
                  className="border-t border-surface-600/50 hover:bg-surface-700/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="hover:text-brand-red transition-colors font-medium"
                    >
                      {product.name}
                    </Link>
                    {product.product_variations?.length > 1 && (
                      <span className="text-text-muted text-xs ml-2">
                        ({product.product_variations.length} variants)
                      </span>
                    )}
                    {suppliers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {suppliers.map((supplier: any) => (
                          <span
                            key={supplier}
                            className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200"
                          >
                            {supplier}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">
                    {displaySku || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {product.base_price ? formatPrice(product.base_price) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        product.status === "active"
                          ? "bg-green-900/30 text-green-400"
                          : product.status === "draft"
                          ? "bg-yellow-900/30 text-yellow-400"
                          : "bg-surface-600 text-text-muted"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-text-muted hover:text-white text-xs"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(!products || products.length === 0) && (
          <p className="text-text-muted text-center py-8">No products found.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={buildProductsUrl(p)}
              className={`px-3 py-1.5 rounded text-sm ${
                p === page
                  ? "bg-brand-red text-white"
                  : "bg-surface-700 text-text-secondary hover:bg-surface-600"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}

      <p className="text-text-muted text-xs mt-4 text-center">
        {count} products total
      </p>
    </div>
  );
}
