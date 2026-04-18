import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>;
}

const PAGE_SIZE = 25;

export default async function AdminCustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("customers")
    .select(
      `id, first_name, last_name, email, phone, created_at,
       orders ( id )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

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

      {/* Search */}
      <div className="card p-4 mb-6">
        <form className="relative max-w-sm">
          <input
            type="text"
            name="search"
            defaultValue={params.search}
            placeholder="Search by name or email…"
            className="w-full bg-surface-700 border border-surface-600 rounded pl-4 pr-4 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          />
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
                  className="border-t border-surface-600/50 hover:bg-surface-700/30"
                >
                  <td className="px-4 py-3 text-white font-medium">{name}</td>
                  <td className="px-4 py-3 text-text-secondary">{cust.email}</td>
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
              href={`/admin/customers?page=${p}${params.search ? `&search=${params.search}` : ""}`}
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
