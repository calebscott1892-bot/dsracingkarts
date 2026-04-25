"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  productId: string;
  hasSquareToken: boolean;
}

/**
 * Pull THIS product's data fresh from Square: name, description, variations,
 * inventory, images, categories. Useful when the admin edits something in
 * Square and doesn't want to wait for the catalog webhook to land.
 */
export function ResyncProductButton({ productId, hasSquareToken }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handleResync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/resync`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ kind: "ok", text: "Resynced from Square" });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: data.error || "Resync failed" });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error" });
    }
    setLoading(false);
    setTimeout(() => setMsg(null), 4000);
  }

  if (!hasSquareToken) {
    return (
      <span className="text-xs text-text-muted">Not linked to Square</span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleResync}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded text-sm text-text-secondary hover:text-white transition-colors disabled:opacity-50"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Resyncing…" : "Resync from Square"}
      </button>
      {msg?.kind === "ok" && (
        <span className="flex items-center gap-1 text-xs text-green-400">
          <CheckCircle size={12} /> {msg.text}
        </span>
      )}
      {msg?.kind === "err" && (
        <span className="flex items-center gap-1 text-xs text-red-400 max-w-xs truncate" title={msg.text}>
          <AlertCircle size={12} /> {msg.text}
        </span>
      )}
    </div>
  );
}
