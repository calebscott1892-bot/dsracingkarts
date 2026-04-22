import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatPrice, formatDate } from "@/lib/utils";
import { OrderStatusSelect } from "../OrderStatusSelect";
import { AdminNotesForm } from "./AdminNotesForm";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin-login");
  const { data: profile } = await supabase.from("admin_profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) redirect("/admin-login?error=unauthorized");

  const service = createServiceClient();

  // Fetch order with customer and items
  const { data: order } = await service
    .from("orders")
    .select(`
      id, order_number, status, subtotal, shipping_cost, tax, total,
      shipping_name, shipping_line1, shipping_line2, shipping_city,
      shipping_state, shipping_postcode, shipping_country,
      square_payment_id, square_order_id,
      customer_notes, admin_notes,
      paid_at, shipped_at, created_at, updated_at,
      customers ( id, first_name, last_name, email, phone ),
      order_items ( id, product_name, variation_name, sku, quantity, unit_price, total_price )
    `)
    .eq("id", id)
    .single();

  if (!order) notFound();

  const cust = order.customers as { id: string; first_name: string | null; last_name: string | null; email: string; phone: string | null } | null;
  const items = (order.order_items as { id: string; product_name: string; variation_name: string | null; sku: string | null; quantity: number; unit_price: number; total_price: number }[]) ?? [];

  const STATUS_COLORS: Record<string, string> = {
    pending:    "text-yellow-400",
    paid:       "text-blue-400",
    processing: "text-blue-400",
    shipped:    "text-green-400",
    delivered:  "text-green-400",
    cancelled:  "text-red-400",
    refunded:   "text-red-400",
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={14} /> Orders
        </Link>
        <span className="text-surface-500">/</span>
        <h1 className="font-heading text-2xl uppercase tracking-wider text-brand-red">
          {order.order_number}
        </h1>
        <span className={`text-xs font-heading uppercase tracking-wider ${STATUS_COLORS[order.status] ?? "text-text-muted"}`}>
          {order.status}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: items + payment */}
        <div className="lg:col-span-2 space-y-6">

          {/* Line items */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
              <h2 className="font-heading text-sm uppercase tracking-wider">Items</h2>
              <span className="text-text-muted text-xs">{items.length} line item{items.length !== 1 ? "s" : ""}</span>
            </div>
            {items.length === 0 ? (
              <p className="px-5 py-4 text-text-muted text-sm">No items recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-700/40 text-text-muted text-left">
                    <th className="px-5 py-2.5 font-medium">Product</th>
                    <th className="px-3 py-2.5 font-medium text-center">Qty</th>
                    <th className="px-3 py-2.5 font-medium text-right">Unit</th>
                    <th className="px-5 py-2.5 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-surface-700/50">
                      <td className="px-5 py-3">
                        <p className="text-white">{item.product_name}</p>
                        {item.variation_name && item.variation_name !== "Regular" && (
                          <p className="text-xs text-text-muted mt-0.5">{item.variation_name}</p>
                        )}
                        {item.sku && <p className="text-xs text-text-muted font-mono mt-0.5">SKU: {item.sku}</p>}
                      </td>
                      <td className="px-3 py-3 text-center text-text-secondary">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-text-secondary tabular-nums">{formatPrice(item.unit_price)}</td>
                      <td className="px-5 py-3 text-right text-white tabular-nums">{formatPrice(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div className="border-t border-surface-600 px-5 py-4 space-y-1.5">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Subtotal</span><span className="tabular-nums">{formatPrice(order.subtotal)}</span>
              </div>
              {Number(order.shipping_cost) > 0 && (
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Shipping</span><span className="tabular-nums">{formatPrice(order.shipping_cost)}</span>
                </div>
              )}
              {Number(order.tax) > 0 && (
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Tax</span><span className="tabular-nums">{formatPrice(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-white pt-1 border-t border-surface-600">
                <span>Total</span><span className="tabular-nums">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Shipping address */}
          {order.shipping_name && (
            <div className="card p-5">
              <h2 className="font-heading text-sm uppercase tracking-wider mb-3">Shipping Address</h2>
              <address className="not-italic text-sm text-text-secondary space-y-0.5">
                <p className="text-white font-medium">{order.shipping_name}</p>
                {order.shipping_line1 && <p>{order.shipping_line1}</p>}
                {order.shipping_line2 && <p>{order.shipping_line2}</p>}
                <p>
                  {[order.shipping_city, order.shipping_state, order.shipping_postcode].filter(Boolean).join(", ")}
                </p>
                {order.shipping_country && order.shipping_country !== "AU" && <p>{order.shipping_country}</p>}
              </address>
            </div>
          )}

          {/* Customer notes */}
          {order.customer_notes && (
            <div className="card p-5">
              <h2 className="font-heading text-sm uppercase tracking-wider mb-2">Customer Notes</h2>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{order.customer_notes}</p>
            </div>
          )}

          {/* Admin notes (editable) */}
          <AdminNotesForm orderId={id} initialNotes={order.admin_notes ?? ""} />
        </div>

        {/* Right: status + meta */}
        <div className="space-y-6">

          {/* Status */}
          <div className="card p-5">
            <h2 className="font-heading text-sm uppercase tracking-wider mb-3">Status</h2>
            <OrderStatusSelect orderId={id} initialStatus={order.status as any} />
          </div>

          {/* Customer */}
          {cust && (
            <div className="card p-5">
              <h2 className="font-heading text-sm uppercase tracking-wider mb-3">Customer</h2>
              <div className="space-y-1 text-sm">
                <p className="text-white font-medium">
                  {[cust.first_name, cust.last_name].filter(Boolean).join(" ") || "—"}
                </p>
                <a href={`mailto:${cust.email}`} className="text-brand-red hover:underline block break-all">
                  {cust.email}
                </a>
                {cust.phone && <p className="text-text-secondary">{cust.phone}</p>}
                <Link
                  href={`/admin/customers/${cust.id}`}
                  className="text-xs text-text-muted hover:text-white transition-colors mt-2 inline-block"
                >
                  View customer →
                </Link>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="card p-5">
            <h2 className="font-heading text-sm uppercase tracking-wider mb-3">Payment</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Ordered</span>
                <span className="text-text-secondary">{formatDate(order.created_at)}</span>
              </div>
              {order.paid_at && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Paid</span>
                  <span className="text-green-400">{formatDate(order.paid_at)}</span>
                </div>
              )}
              {order.shipped_at && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Shipped</span>
                  <span className="text-blue-400">{formatDate(order.shipped_at)}</span>
                </div>
              )}
              {order.square_payment_id && (
                <div className="pt-2 border-t border-surface-600">
                  <p className="text-text-muted text-xs mb-0.5">Square Payment ID</p>
                  <p className="font-mono text-xs text-text-secondary break-all">{order.square_payment_id}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
