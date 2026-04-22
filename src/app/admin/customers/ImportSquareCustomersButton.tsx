"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export function ImportSquareCustomersButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported?: number; skipped?: number; error?: string } | null>(null);

  async function handleImport() {
    if (!confirm("This will import all customers from Square into the admin panel. Existing customers will be updated. Continue?")) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/customers/import-square", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({ imported: data.imported, skipped: data.skipped });
      } else {
        setResult({ error: data.error || "Import failed" });
      }
    } catch {
      setResult({ error: "Network error — please try again" });
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleImport}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded text-sm text-text-secondary hover:text-white transition-colors disabled:opacity-50"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Importing…" : "Import from Square"}
      </button>
      {result && !result.error && (
        <p className="flex items-center gap-1.5 text-xs text-green-400">
          <CheckCircle size={12} />
          {result.imported} imported, {result.skipped} skipped (no email)
        </p>
      )}
      {result?.error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} />
          {result.error}
        </p>
      )}
    </div>
  );
}
