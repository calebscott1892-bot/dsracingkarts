import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatPrice, formatDate } from "@/lib/utils";
import { OrderStatusSelect } from "./OrderStatusSelect";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 25;

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  const { data: orders, count } = await supabase
    .from("orders")
    .select(
      `id, order_number, total, status, created_at,
       customers ( first_name, last_name, email )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div>
      <h1 className="font-heading text-3xl uppercase tracking-wider mb-6">Orders</h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-left bg-surface-700/50">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((order: any) => {
              const cust = order.customers;
              const name = cust
                ? [cust.first_name, cust.last_name].filter(Boolean).join(" ")
                : "—";
              return (
                <tr
                  key={order.id}
                  className="border-t border-surface-600/50 hover:bg-surface-700/30"
                >
                  <td className="px-4 py-3 font-mono text-brand-red font-medium">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{name}</div>
                    {cust?.email && (
                      <div className="text-text-muted text-xs">{cust.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {formatPrice(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect
                      orderId={order.id}
                      initialStatus={order.status}
                    />
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {formatDate(order.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(!orders || orders.length === 0) && (
          <p className="text-text-muted text-center py-8">No orders yet.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?page=${p}`}
              className={`px-3 py-1.5 rounded text-sm ${
                p === page
                  ? "bg-brand-red text-white"
                  : "bg-surface-700 text-text-secondary hover:bg-surface-600"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      <p className="text-text-muted text-xs mt-4 text-center">
        {count} orders total
      </p>
    </div>
  );
}
