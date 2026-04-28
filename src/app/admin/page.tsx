import { createClient } from "@/lib/supabase/server";
import { SquareSyncHealth } from "@/components/admin/SquareSyncHealth";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const safeCount = async (table: string) => {
    try {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const safeRecentOrders = async () => {
    try {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    } catch {
      return [] as Array<{ id: string; order_number: string; total: number; status: string; created_at: string }>;
    }
  };

  const safeActiveProductCount = async () => {
    try {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [productCount, orderCount, customerCount, recentOrders] = await Promise.all([
    safeActiveProductCount(),
    safeCount("orders"),
    safeCount("customers"),
    safeRecentOrders(),
  ]);

  const stats = [
    { label: "Products", value: productCount || 0, color: "text-blue-400" },
    { label: "Orders", value: orderCount || 0, color: "text-green-400" },
    { label: "Customers", value: customerCount || 0, color: "text-purple-400" },
  ];

  return (
    <div>
      <h1 className="font-heading text-3xl uppercase tracking-wider mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-6">
            <p className="text-text-muted text-sm">{stat.label}</p>
            <p className={`font-heading text-4xl ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <SquareSyncHealth />
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="card p-6">
          <h2 className="font-heading text-xl uppercase tracking-wider mb-4">Recent Orders</h2>
          {recentOrders && recentOrders.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left border-b border-surface-600">
                  <th className="pb-2">Order</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-surface-600/50">
                    <td className="py-2">
                      <a href={`/admin/orders/${order.id}`} className="text-brand-red hover:underline">
                        {order.order_number}
                      </a>
                    </td>
                    <td className="py-2">${order.total}</td>
                    <td className="py-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          order.status === "paid"
                            ? "bg-green-900/30 text-green-400"
                            : order.status === "shipped"
                            ? "bg-blue-900/30 text-blue-400"
                            : "bg-surface-600 text-text-muted"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-text-muted">No orders yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
