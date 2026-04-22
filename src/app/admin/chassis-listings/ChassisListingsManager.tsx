"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Clock, Tag, Loader2, Trash2, ChevronDown, ChevronUp, Phone, Mail } from "lucide-react";
import { formatPrice } from "@/lib/utils";

type ListingStatus = "pending" | "approved" | "sold" | "expired";

interface Listing {
  id: string;
  listing_type: "buy" | "sell";
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  description: string;
  asking_price: number | null;
  chassis_year: number | null;
  condition: string | null;
  status: ListingStatus;
  admin_notes: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<ListingStatus, string> = {
  pending: "bg-yellow-900/30 text-yellow-400 border-yellow-700/40",
  approved: "bg-green-900/30 text-green-400 border-green-700/40",
  sold: "bg-blue-900/30 text-blue-400 border-blue-700/40",
  expired: "bg-surface-600 text-text-muted border-surface-500",
};

const STATUS_ICON: Record<ListingStatus, React.ReactNode> = {
  pending: <Clock size={12} />,
  approved: <CheckCircle size={12} />,
  sold: <Tag size={12} />,
  expired: <XCircle size={12} />,
};

interface Props { initialListings: Listing[] }

export function ChassisListingsManager({ initialListings }: Props) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [filter, setFilter] = useState<"all" | ListingStatus>("all");

  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);

  async function setStatus(id: string, status: ListingStatus) {
    setUpdating(id);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/chassis-listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      const updated: Listing = await res.json();
      setListings((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  }

  async function deleteListing(id: string) {
    if (!confirm("Delete this listing permanently?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/chassis-listings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setListings((prev) => prev.filter((l) => l.id !== id));
      if (expanded === id) setExpanded(null);
    } catch {
      setErrorMsg("Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  const counts = {
    all: listings.length,
    pending: listings.filter((l) => l.status === "pending").length,
    approved: listings.filter((l) => l.status === "approved").length,
    sold: listings.filter((l) => l.status === "sold").length,
    expired: listings.filter((l) => l.status === "expired").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl uppercase tracking-wider">Chassis Listings</h1>
          <p className="text-text-muted text-sm mt-1">DSR Predator buy &amp; sell board</p>
        </div>
        {counts.pending > 0 && (
          <span className="bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 text-xs px-3 py-1 rounded-full font-heading tracking-wider">
            {counts.pending} pending review
          </span>
        )}
      </div>

      {errorMsg && (
        <p className="text-red-400 text-sm mb-4 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {errorMsg}
        </p>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "pending", "approved", "sold", "expired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${
              filter === s ? "bg-brand-red text-white" : "bg-surface-700 text-text-secondary hover:bg-surface-600"
            }`}
          >
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-8 text-center text-text-muted">No listings {filter !== "all" ? `with status "${filter}"` : "yet"}.</div>
      )}

      <div className="space-y-3">
        {filtered.map((listing) => (
          <div key={listing.id} className="card overflow-hidden">
            {/* Header row */}
            <div className="p-4 flex items-start gap-3">
              {/* Type badge */}
              <span className={`shrink-0 text-xs px-2.5 py-1 rounded font-heading uppercase tracking-wider ${
                listing.listing_type === "sell" ? "bg-brand-red/20 text-brand-red" : "bg-blue-900/30 text-blue-400"
              }`}>
                {listing.listing_type === "sell" ? "Selling" : "Wanted"}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="font-heading text-sm text-white">{listing.contact_name}</span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[listing.status]}`}>
                    {STATUS_ICON[listing.status]} {listing.status}
                  </span>
                  {listing.chassis_year && <span className="text-xs text-text-muted">{listing.chassis_year}</span>}
                  {listing.condition && <span className="text-xs text-text-muted capitalize">{listing.condition}</span>}
                  {listing.asking_price && (
                    <span className="text-xs text-green-400 font-mono">{formatPrice(listing.asking_price)}</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary line-clamp-1">{listing.description}</p>
                <p className="text-xs text-text-muted mt-1">
                  {new Date(listing.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpanded(expanded === listing.id ? null : listing.id)}
                  className="p-2 rounded text-text-muted hover:text-white hover:bg-surface-600 transition-colors"
                >
                  {expanded === listing.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                <button
                  onClick={() => deleteListing(listing.id)}
                  disabled={deleting === listing.id}
                  className="p-2 rounded text-text-muted hover:text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  {deleting === listing.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === listing.id && (
              <div className="border-t border-surface-600 p-4 bg-surface-900/50 space-y-4">
                {/* Contact info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <a href={`mailto:${listing.contact_email}`} className="flex items-center gap-1.5 text-brand-red hover:underline">
                    <Mail size={13} /> {listing.contact_email}
                  </a>
                  {listing.contact_phone && (
                    <a href={`tel:${listing.contact_phone}`} className="flex items-center gap-1.5 text-text-secondary hover:text-white transition-colors">
                      <Phone size={13} /> {listing.contact_phone}
                    </a>
                  )}
                </div>

                {/* Full description */}
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{listing.description}</p>
                </div>

                {/* Admin notes */}
                {listing.admin_notes && (
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Admin Notes</p>
                    <p className="text-sm text-text-secondary">{listing.admin_notes}</p>
                  </div>
                )}

                {/* Status actions */}
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Change Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(["pending", "approved", "sold", "expired"] as ListingStatus[])
                      .filter((s) => s !== listing.status)
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(listing.id, s)}
                          disabled={updating === listing.id}
                          className="px-3 py-1.5 rounded text-xs border border-surface-500 text-text-secondary hover:text-white hover:border-surface-400 transition-colors flex items-center gap-1.5 capitalize"
                        >
                          {updating === listing.id ? <Loader2 size={12} className="animate-spin" /> : STATUS_ICON[s]}
                          Mark as {s}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
