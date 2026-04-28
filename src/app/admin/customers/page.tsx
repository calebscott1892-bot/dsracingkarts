import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { ImportSquareCustomersButton } from "./ImportSquareCustomersButton";

interface Props {
  searchParams: Promise<{ search?: string; page?: string; sort?: string }>;
}

const PAGE_SIZE = 25;

export default async function AdminCustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;
  const sort =
    params.sort === "name_asc" || params.sort === "name_desc" || params.sort === "oldest"
      ? params.sort
      : "newest";
  const searchSuffix = params.search ? `&search=${encodeURIComponent(params.search)}` : "";
  const sortSuffix = sort !== "newest" ? `&sort=${sort}` : "";

  let query = supabase
    .from("customers")
    .select(
      `id, first_name, last_name, email, phone, created_at,
       orders ( id )`,
      { count: "exact" }
    );

  if (sort === "name_asc") {
    query = query
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
      .order("email", { ascending: true });
  } else if (sort === "name_desc") {
    query = query
      .order("last_name", { ascending: false, nullsFirst: false })
      .order("first_name", { ascending: false, nullsFirst: false })
      .order("email", { ascending: false });
  } else if (sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (params.search) {
    query = query.or(
      `first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%`
    );
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: customers, count } = await query;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div>
      <h1 className="font-heading text-3xl uppercase tracking-wider mb-6">Customers</h1>

      <div className="flex items-center justify-between mb-6">
        <p className="text-text-muted text-sm">{count || 0} customers total</p>
        <ImportSquareCustomersButton />
      </div>

      {/* Search */}
      <div className="card p-4 mb-6">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            name="search"
            defaultValue={params.search}
            placeholder="Search by name or email…"
            className="w-full sm:max-w-sm bg-surface-700 border border-surface-600 rounded pl-4 pr-4 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="bg-surface-700 border border-surface-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
          <button type="submit" className="btn-primary text-sm">
            Apply
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-left bg-surface-700/50">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((cust: any) => {
              const name = [cust.first_name, cust.last_name]
                .filter(Boolean)
                .join(" ") || "—";
              const orderCount = cust.orders?.length || 0;
              return (
                <tr
                  key={cust.id}
                  className="border-t border-surface-600/50 hover:bg-surface-700/30 cursor-pointer"
                >
                  <td className="px-4 py-3 text-white font-medium">
                    <a href={`/admin/customers/${cust.id}`} className="hover:text-brand-red transition-colors">{name}</a>
                  </td>
                  <td className="px-4 py-3 text-text-secondary"><a href={`/admin/customers/${cust.id}`} className="hover:text-white transition-colors">{cust.email}</a></td>
                  <td className="px-4 py-3 text-text-muted">{cust.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-mono ${
                        orderCount > 0 ? "text-green-400" : "text-text-muted"
                      }`}
                    >
                      {orderCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {formatDate(cust.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(!customers || customers.length === 0) && (
          <p className="text-text-muted text-center py-8">No customers found.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/customers?page=${p}${searchSuffix}${sortSuffix}`}
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
        {count} customers total
      </p>
    </div>
  );
}
