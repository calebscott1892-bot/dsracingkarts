import { createServiceClient, createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatPrice, formatDate } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin-login");
  const { data: profile } = await supabase.from("admin_profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) redirect("/admin-login?error=unauthorized");

  const service = createServiceClient();

  const { data: customer } = await service
    .from("customers")
    .select(`
      id, first_name, last_name, email, phone, notes,
      address_line1, address_line2, city, state, postcode, country,
      square_customer_id, created_at, updated_at,
      orders ( id, order_number, total, status, created_at )
    `)
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const orders = (customer.orders as {
    id: string; order_number: string; total: number; status: string; created_at: string;
  }[]) ?? [];

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Unknown";
  const hasAddress = customer.address_line1 || customer.city;

  const STATUS_COLORS: Record<string, string> = {
    pending:    "bg-yellow-900/30 text-yellow-400",
    paid:       "bg-blue-900/30 text-blue-400",
    processing: "bg-blue-900/30 text-blue-400",
    shipped:    "bg-green-900/30 text-green-400",
    delivered:  "bg-green-900/30 text-green-400",
    cancelled:  "bg-red-900/30 text-red-400",
    refunded:   "bg-red-900/30 text-red-400",
  };

  const totalSpent = orders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={14} /> Customers
        </Link>
        <span className="text-surface-500">/</span>
        <h1 className="font-heading text-2xl uppercase tracking-wider">{fullName}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: orders */}
        <div className="lg:col-span-2 space-y-6">

          {/* Order history */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
              <h2 className="font-heading text-sm uppercase tracking-wider">Order History</h2>
              <span className="text-text-muted text-xs">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
            </div>
            {orders.length === 0 ? (
              <p className="px-5 py-6 text-text-muted text-sm">No orders yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-700/40 text-text-muted text-left">
                    <th className="px-5 py-2.5 font-medium">Order</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium text-right">Total</th>
                    <th className="px-5 py-2.5 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((order) => (
                      <tr key={order.id} className="border-t border-surface-700/50">
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-mono text-brand-red hover:underline"
                          >
                            {order.order_number}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[order.status] ?? "bg-surface-600 text-text-muted"}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-white tabular-nums">{formatPrice(order.total)}</td>
                        <td className="px-5 py-3 text-right text-text-muted text-xs">{formatDate(order.created_at)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="card p-5">
              <h2 className="font-heading text-sm uppercase tracking-wider mb-2">Notes</h2>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Right: details */}
        <div className="space-y-6">

          {/* Contact */}
          <div className="card p-5">
            <h2 className="font-heading text-sm uppercase tracking-wider mb-3">Contact</h2>
            <div className="space-y-2 text-sm">
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-brand-red hover:underline break-all">
                <Mail size={13} className="shrink-0" /> {customer.email}
              </a>
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
                  <Phone size={13} className="shrink-0" /> {customer.phone}
                </a>
              )}
            </div>
          </div>

          {/* Address */}
          {hasAddress && (
            <div className="card p-5">
              <h2 className="font-heading text-sm uppercase tracking-wider mb-3">
                <span className="flex items-center gap-2"><MapPin size={13} /> Address</span>
              </h2>
              <address className="not-italic text-sm text-text-secondary space-y-0.5">
                {customer.address_line1 && <p>{customer.address_line1}</p>}
                {customer.address_line2 && <p>{customer.address_line2}</p>}
                <p>{[customer.city, customer.state, customer.postcode].filter(Boolean).join(", ")}</p>
                {customer.country && customer.country !== "AU" && <p>{customer.country}</p>}
              </address>
            </div>
          )}

          {/* Stats */}
          <div className="card p-5">
            <h2 className="font-heading text-sm uppercase tracking-wider mb-3">Stats</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Orders</span>
                <span className="text-white font-mono">{orders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total spent</span>
                <span className="text-green-400 font-mono">{formatPrice(totalSpent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Customer since</span>
                <span className="text-text-secondary">{formatDate(customer.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
