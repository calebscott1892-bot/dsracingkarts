"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

type ImportResponse = {
  imported?: number;
  skipped?: number;
  errorCount?: number;
  sampleErrors?: { email?: string; message: string }[];
  error?: string;
};

export function ImportSquareCustomersButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function handleImport() {
    if (
      !confirm(
        "This will import all customers from Square into the admin panel. Existing customers will be updated. Continue?"
      )
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/customers/import-square", { method: "POST" });
      const contentType = res.headers.get("content-type") || "";
      const data: ImportResponse = contentType.includes("application/json")
        ? await res.json()
        : { error: (await res.text()).slice(0, 180) || `Server returned ${res.status}` };
      setResult(res.ok ? data : { ...data, error: data.error || "Import failed" });
    } catch (err: any) {
      setResult({ error: err?.message || "Network error - please try again" });
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
        <div className="text-right space-y-0.5">
          <p className="flex items-center gap-1.5 text-xs text-green-400 justify-end">
            <CheckCircle size={12} />
            {result.imported} imported
            {result.skipped ? `, ${result.skipped} skipped (no email)` : ""}
            {result.errorCount ? `, ${result.errorCount} errors` : ""}
          </p>
          {result.sampleErrors && result.sampleErrors.length > 0 && (
            <ul className="text-[10px] text-text-muted text-right max-w-sm">
              {result.sampleErrors.map((e, i) => (
                <li key={i} className="truncate">
                  · {e.email ? `${e.email} — ` : ""}{e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result?.error && (
        <div className="text-right space-y-0.5">
          <p className="flex items-center gap-1.5 text-xs text-red-400 justify-end">
            <AlertCircle size={12} />
            <span className="max-w-md truncate" title={result.error}>{result.error}</span>
          </p>
          {(typeof result.imported === "number" || typeof result.skipped === "number") && (
            <p className="text-[10px] text-text-muted">
              Partial: {result.imported ?? 0} imported, {result.skipped ?? 0} skipped before failure
            </p>
          )}
        </div>
      )}
    </div>
  );
}
