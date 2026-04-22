"use client";

import { Fragment, useState } from "react";
import { TrendingUp, Eye, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface PreviewVariation {
  squareId: string;
  name: string;
  currentPrice: number;
  newPrice: number;
  diff: number;
}

interface PreviewProduct {
  squareItemId: string;
  productName: string;
  variations: PreviewVariation[];
}

function formatPrice(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export default function AdminPricingPage() {
  const [percentage, setPercentage] = useState("");
  const [preview, setPreview] = useState<PreviewProduct[] | null>(null);
  const [totalVariations, setTotalVariations] = useState(0);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  function resetMessages() {
    setSuccessMsg("");
    setErrorMsg("");
  }

  async function handlePreview() {
    const pct = parseFloat(percentage);
    if (!pct || pct <= 0) {
      setErrorMsg("Enter a valid percentage greater than 0.");
      return;
    }
    setLoading(true);
    resetMessages();
    setPreview(null);
    try {
      const res = await fetch(`/api/admin/pricing?percentage=${pct}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview);
      setTotalVariations(data.totalVariations ?? 0);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    const pct = parseFloat(percentage);
    if (!pct || pct <= 0) return;
    if (
      !confirm(
        `Apply a ${pct}% price increase to ALL products in Square?\n\nThis will update prices immediately. This action cannot be undone.`
      )
    )
      return;

    setApplying(true);
    resetMessages();
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percentage: pct }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setSuccessMsg(data.message);
      setPreview(null);
      setPercentage("");
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="text-brand-red" size={28} />
        <h1 className="font-heading text-3xl uppercase tracking-wider">Bulk Pricing</h1>
      </div>
      <p className="text-text-muted text-sm mb-8">
        Increase all product prices in Square by a set percentage. Preview the exact changes before
        applying. Prices update in Square first, then sync to this website automatically. Rounded to
        the nearest $0.05.
      </p>

      {/* Controls */}
      <div className="card p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[160px] max-w-[240px]">
            <label className="block text-text-muted text-xs uppercase tracking-wider mb-2">
              Increase by %
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                max="500"
                step="0.1"
                value={percentage}
                onChange={(e) => {
                  setPercentage(e.target.value);
                  setPreview(null);
                  resetMessages();
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePreview()}
                placeholder="e.g. 5"
                className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2.5 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                %
              </span>
            </div>
          </div>

          <button
            onClick={handlePreview}
            disabled={loading || applying || !percentage}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-600 rounded text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            {loading ? "Loading from Square..." : "Preview Changes"}
          </button>

          {preview && (
            <button
              onClick={handleApply}
              disabled={applying || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-red hover:bg-red-700 rounded text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <TrendingUp size={16} />
              )}
              {applying ? "Applying to Square..." : "Apply to Square"}
            </button>
          )}
        </div>

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 text-green-400 text-sm bg-green-900/20 border border-green-900/40 rounded p-3">
            <CheckCircle size={16} className="mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-900/40 rounded p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Preview table */}
      {preview && (
        <div>
          <p className="text-text-muted text-sm mb-3">
            Preview:{" "}
            <strong className="text-white">
              {totalVariations} variation{totalVariations !== 1 ? "s" : ""}
            </strong>{" "}
            across{" "}
            <strong className="text-white">
              {preview.length} product{preview.length !== 1 ? "s" : ""}
            </strong>{" "}
            — a <strong className="text-brand-red">{percentage}% increase</strong>. These are the
            live Square prices. Click{" "}
            <span className="text-white font-medium">Apply to Square</span> above to confirm.
          </p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-700/60 text-text-muted">
                  <th className="px-4 py-3 text-left font-medium">Product / Variation</th>
                  <th className="px-4 py-3 text-right font-medium">Current</th>
                  <th className="px-4 py-3 text-right font-medium">New Price</th>
                  <th className="px-4 py-3 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((product) => (
                  // Fragment with explicit key to avoid React rendering issues
                  <Fragment key={product.squareItemId}>
                    {product.variations.length > 1 && (
                      <tr className="bg-surface-700/30 border-t border-surface-700">
                        <td
                          colSpan={4}
                          className="px-4 py-2 font-medium text-white text-xs uppercase tracking-wider"
                        >
                          {product.productName}
                        </td>
                      </tr>
                    )}
                    {product.variations.map((v) => (
                      <tr
                        key={v.squareId}
                        className="border-t border-surface-700/50 hover:bg-surface-700/20"
                      >
                        <td className="px-4 py-3 text-white">
                          {product.variations.length === 1 ? (
                            product.productName
                          ) : (
                            <span className="pl-4 text-text-muted">{v.name || "Default"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-text-muted font-mono">
                          {formatPrice(v.currentPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-white font-mono font-medium">
                          {formatPrice(v.newPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-400 font-mono">
                          +{formatPrice(v.diff)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
