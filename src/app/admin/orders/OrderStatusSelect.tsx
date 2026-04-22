"use client";

import { useState } from "react";

const ORDER_STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:    "bg-yellow-900/30 text-yellow-400",
  paid:       "bg-blue-900/30 text-blue-400",
  processing: "bg-blue-900/30 text-blue-400",
  shipped:    "bg-green-900/30 text-green-400",
  delivered:  "bg-green-900/30 text-green-400",
  cancelled:  "bg-red-900/30 text-red-400",
  refunded:   "bg-red-900/30 text-red-400",
};

interface Props {
  orderId: string;
  initialStatus: OrderStatus;
}

export function OrderStatusSelect({ orderId, initialStatus }: Props) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleChange(newStatus: OrderStatus) {
    if (newStatus === status) return;
    setSaving(true);
    setError(false);
    const previous = status;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      } else {
        setStatus(previous);
        setError(true);
        setTimeout(() => setError(false), 3000);
      }
    } catch {
      setStatus(previous);
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative inline-flex flex-col gap-1">
      <div className="relative inline-block">
        <select
          value={status}
          disabled={saving}
          onChange={(e) => handleChange(e.target.value as OrderStatus)}
          className={`text-xs px-2 py-1 rounded border-0 cursor-pointer appearance-none pr-5
                      focus:outline-none focus:ring-1 focus:ring-white/20
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${error ? "ring-1 ring-red-500" : ""}
                      ${STATUS_COLORS[status]}`}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-surface-800 text-white">
              {s}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[10px] opacity-60">
          {saving ? "…" : "▾"}
        </span>
      </div>
      {error && (
        <span className="text-[10px] text-red-400 leading-none">Save failed</span>
      )}
    </div>
  );
}
