import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ search?: string; page?: string; status?: string }>;
}

const PAGE_SIZE = 25;

export default async function AdminProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;
  const statusFilter = params.status || "active";

  let query = supabase
    .from("products")
    .select(
      `
      id, name, slug, sku, base_price, status, visibility, primary_image_url,
      product_variations ( id, name, sku, price )
    `,
      { count: "exact" }
    )
    .order("name");

  if (params.search) {
    query = query.ilike("name", `%${params.search}%`);
  }
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: products, count } = await query;
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

      {/* Filters bar */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4">
        <form className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
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
              href={`/admin/products${s !== "all" ? `?status=${s}` : ""}`}
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
              href={`/admin/products?page=${p}${params.search ? `&search=${params.search}` : ""}${params.status ? `&status=${params.status}` : ""}`}
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
