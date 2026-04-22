"use client";

import { useState } from "react";
import { Send, CheckCircle, Loader2, ChevronDown } from "lucide-react";

const CONDITIONS = [
  { value: "new", label: "New / Unused" },
  { value: "excellent", label: "Excellent — race-ready, no damage" },
  { value: "good", label: "Good — minor cosmetic wear only" },
  { value: "fair", label: "Fair — runs well, some wear or repairs" },
  { value: "parts-only", label: "Parts only" },
];

const CURRENT_YEAR = new Date().getFullYear();

interface Listing {
  id: string;
  listing_type: "buy" | "sell";
  description: string;
  asking_price: number | null;
  chassis_year: number | null;
  condition: string | null;
  created_at: string;
}

interface Props { approvedListings: Listing[] }

export function PredatorChassisClient({ approvedListings }: Props) {
  const [tab, setTab] = useState<"buy" | "sell">("sell");
  const [form, setForm] = useState({
    listing_type: "sell" as "buy" | "sell",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    description: "",
    asking_price: "",
    chassis_year: "",
    condition: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const payload: Record<string, unknown> = {
        listing_type: tab,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || undefined,
        description: form.description,
        chassis_year: form.chassis_year ? parseInt(form.chassis_year) : undefined,
        condition: form.condition || undefined,
      };
      if (tab === "sell" && form.asking_price) {
        payload.asking_price = parseFloat(form.asking_price);
      }

      const res = await fetch("/api/chassis/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      setStatus("success");
      setForm({
        listing_type: tab,
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        description: "",
        asking_price: "",
        chassis_year: "",
        condition: "",
      });
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Submission failed. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div>
      {/* ── Active Listings ── */}
      {approvedListings.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-[1px] w-8 bg-brand-red" />
            <h2 className="font-heading text-2xl uppercase tracking-[0.1em]">Active Listings</h2>
            <span className="h-[1px] w-8 bg-brand-red" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvedListings.map((listing) => (
              <div key={listing.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded font-heading uppercase tracking-wider ${
                    listing.listing_type === "sell" ? "bg-brand-red/20 text-brand-red" : "bg-blue-900/30 text-blue-400"
                  }`}>
                    {listing.listing_type === "sell" ? "For Sale" : "Wanted"}
                  </span>
                  <div className="text-right">
                    {listing.asking_price ? (
                      <span className="font-heading text-lg text-white">${listing.asking_price.toLocaleString()}</span>
                    ) : (
                      <span className="text-xs text-text-muted">Make offer</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-text-muted mb-3">
                  {listing.chassis_year && <span>{listing.chassis_year}</span>}
                  {listing.condition && <span className="capitalize">{listing.condition.replace("-", " ")}</span>}
                </div>
                <p className="text-sm text-text-secondary line-clamp-3">{listing.description}</p>
                <p className="text-xs text-text-muted mt-3">
                  {new Date(listing.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted text-center mt-6">
            Interested in a listing? Submit your enquiry below and we&apos;ll connect you.
          </p>
        </section>
      )}

      {/* ── Submit Form ── */}
      <section className="max-w-2xl mx-auto px-4 py-12" id="submit-listing">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <span className="h-[1px] w-8 bg-brand-red" />
          <h2 className="font-heading text-2xl uppercase tracking-[0.1em]">List Your Chassis</h2>
          <span className="h-[1px] w-8 bg-brand-red" />
        </div>
        <p className="text-text-secondary text-sm text-center mb-8">
          Looking to buy or sell a used DSR Predator? Fill in the form below. DS Racing Karts will review your submission and publish it to this board.
        </p>

        {/* Buy / Sell toggle */}
        <div className="flex rounded overflow-hidden border border-surface-600 mb-8">
          {(["sell", "buy"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-heading uppercase tracking-wider transition-colors ${
                tab === t ? "bg-brand-red text-white" : "bg-surface-700 text-text-secondary hover:bg-surface-600"
              }`}
            >
              {t === "sell" ? "I want to Sell" : "I want to Buy"}
            </button>
          ))}
        </div>

        {status === "success" ? (
          <div className="card p-8 text-center">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-4" />
            <h3 className="font-heading text-xl uppercase tracking-wider mb-2">Submitted!</h3>
            <p className="text-text-secondary text-sm">
              Your listing has been received. DS Racing Karts will review it and publish it to this board shortly.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="btn-secondary text-sm mt-6"
            >
              Submit another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-5">
            {errorMsg && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
                {errorMsg}
              </p>
            )}

            {/* Contact info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Your Name *</label>
                <input
                  required
                  className="input-dark w-full"
                  value={form.contact_name}
                  onChange={(e) => setField("contact_name", e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Email *</label>
                <input
                  required
                  type="email"
                  className="input-dark w-full"
                  value={form.contact_email}
                  onChange={(e) => setField("contact_email", e.target.value)}
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Phone (optional)</label>
                <input
                  className="input-dark w-full"
                  value={form.contact_phone}
                  onChange={(e) => setField("contact_phone", e.target.value)}
                  placeholder="04xx xxx xxx"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Chassis Year (optional)</label>
                <input
                  type="number"
                  min="2010"
                  max={CURRENT_YEAR}
                  className="input-dark w-full"
                  value={form.chassis_year}
                  onChange={(e) => setField("chassis_year", e.target.value)}
                  placeholder={String(CURRENT_YEAR)}
                />
              </div>
            </div>

            {/* Condition & price — only relevant for sellers */}
            {tab === "sell" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Condition</label>
                  <div className="relative">
                    <select
                      className="input-dark w-full appearance-none pr-8"
                      value={form.condition}
                      onChange={(e) => setField("condition", e.target.value)}
                    >
                      <option value="">Select condition…</option>
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Asking Price (AUD, optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      className="input-dark w-full pl-7"
                      value={form.asking_price}
                      onChange={(e) => setField("asking_price", e.target.value)}
                      placeholder="Leave blank for 'make offer'"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                {tab === "sell" ? "Describe your chassis *" : "What are you looking for? *"}
              </label>
              <textarea
                required
                rows={5}
                className="input-dark w-full"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder={tab === "sell"
                  ? "Year, condition details, what's included, any modifications or repairs…"
                  : "Budget, preferred year, condition requirements, location…"}
              />
            </div>

            <p className="text-xs text-text-muted">
              Your contact details will only be shared with DS Racing Karts, not displayed publicly.
            </p>

            <button
              type="submit"
              disabled={status === "loading"}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {status === "loading" ? "Submitting…" : `Submit ${tab === "sell" ? "Sell" : "Buy"} Listing`}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
