"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Clock, Tag, Loader2, Trash2, ChevronDown, ChevronUp, Phone, Mail, Plus, X, Pencil, Save } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { ChassisPageContent } from "@/lib/chassis-page-content";

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
  image_url: string | null;
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

type PageContentKey = Exclude<keyof ChassisPageContent, "id" | "updated_at">;

interface Props {
  initialListings: Listing[];
  initialPageContent: ChassisPageContent;
}

const PAGE_CONTENT_GROUPS: Array<{
  title: string;
  fields: Array<{ key: PageContentKey; label: string; rows?: number; help?: string }>;
}> = [
  {
    title: "Hero",
    fields: [
      { key: "hero_eyebrow", label: "Small Label" },
      { key: "hero_title", label: "Title" },
      { key: "hero_accent", label: "Red Title Word" },
      { key: "hero_body", label: "Intro Copy", rows: 3 },
      { key: "hero_cta_label", label: "Button Label" },
    ],
  },
  {
    title: "Featured Used Chassis",
    fields: [
      { key: "featured_eyebrow", label: "Small Label" },
      { key: "featured_title", label: "Heading" },
      { key: "featured_body", label: "Description", rows: 4 },
      { key: "featured_primary_cta_label", label: "Contact Button Label" },
      { key: "featured_secondary_cta_label", label: "Form Button Label" },
      {
        key: "featured_image_url",
        label: "Image URL",
        help: "Use a site path, Supabase Storage URL, or Square image URL.",
      },
      { key: "featured_image_alt", label: "Image Alt Text" },
      { key: "featured_image_caption", label: "Image Caption", rows: 2 },
    ],
  },
  {
    title: "Listings Form",
    fields: [
      { key: "active_listings_heading", label: "Active Listings Heading" },
      { key: "listing_form_heading", label: "Form Heading" },
      { key: "listing_form_intro", label: "Form Intro", rows: 3 },
    ],
  },
];

const BLANK_FORM = {
  listing_type: "sell" as "buy" | "sell",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  description: "",
  asking_price: "",
  chassis_year: "",
  condition: "",
  image_url: "",
};

export function ChassisListingsManager({ initialListings, initialPageContent }: Props) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [filter, setFilter] = useState<"all" | ListingStatus>("all");

  // New listing form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(BLANK_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Inline edit state: keyed by listing id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    contact_name: string;
    contact_phone: string;
    description: string;
    asking_price: string;
    chassis_year: string;
    condition: string;
    image_url: string;
    admin_notes: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pageContentForm, setPageContentForm] = useState<ChassisPageContent>(initialPageContent);
  const [savingPageContent, setSavingPageContent] = useState(false);
  const [pageContentError, setPageContentError] = useState("");
  const [pageContentSaved, setPageContentSaved] = useState(false);

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

  async function createListing(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const body = {
        ...newForm,
        asking_price: newForm.asking_price === "" ? null : Number(newForm.asking_price),
        chassis_year: newForm.chassis_year === "" ? null : Number(newForm.chassis_year),
        condition: newForm.condition || null,
        contact_phone: newForm.contact_phone || null,
        image_url: newForm.image_url || null,
      };
      const res = await fetch("/api/admin/chassis-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Create failed");
      const created: Listing = await res.json();
      setListings((prev) => [created, ...prev]);
      setNewForm(BLANK_FORM);
      setShowNewForm(false);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(listing: Listing) {
    setEditingId(listing.id);
    setSaveError("");
    setEditForm({
      contact_name: listing.contact_name,
      contact_phone: listing.contact_phone ?? "",
      description: listing.description,
      asking_price: listing.asking_price != null ? String(listing.asking_price) : "",
      chassis_year: listing.chassis_year != null ? String(listing.chassis_year) : "",
      condition: listing.condition ?? "",
      image_url: listing.image_url ?? "",
      admin_notes: listing.admin_notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setSaveError("");
  }

  async function saveEdits(id: string) {
    if (!editForm) return;
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, unknown> = {
        contact_name: editForm.contact_name,
        contact_phone: editForm.contact_phone || null,
        description: editForm.description,
        asking_price: editForm.asking_price === "" ? null : Number(editForm.asking_price),
        chassis_year: editForm.chassis_year === "" ? null : Number(editForm.chassis_year),
        condition: editForm.condition || null,
        image_url: editForm.image_url || null,
        admin_notes: editForm.admin_notes || null,
      };
      const res = await fetch(`/api/admin/chassis-listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      const updated: Listing = await res.json();
      setListings((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setEditingId(null);
      setEditForm(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setPageContentField(key: PageContentKey, value: string) {
    setPageContentSaved(false);
    setPageContentForm((current) => ({ ...current, [key]: value }));
  }

  async function savePageContent(e: React.FormEvent) {
    e.preventDefault();
    setSavingPageContent(true);
    setPageContentError("");
    setPageContentSaved(false);

    try {
      const res = await fetch("/api/admin/chassis-page-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pageContentForm),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Save failed");

      const updated: ChassisPageContent = await res.json();
      setPageContentForm(updated);
      setPageContentSaved(true);
    } catch (e: unknown) {
      setPageContentError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingPageContent(false);
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
          <p className="text-text-muted text-sm mt-1">Website submissions from &ldquo;I want to Buy&rdquo; and &ldquo;I want to Sell&rdquo; appear here.</p>
        </div>
        <div className="flex items-center gap-3">
          {counts.pending > 0 && (
            <span className="bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 text-xs px-3 py-1 rounded-full font-heading tracking-wider">
              {counts.pending} pending review
            </span>
          )}
          <button
            onClick={() => { setShowNewForm((v) => !v); setCreateError(""); }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-heading uppercase tracking-wider transition-colors rounded ${
              showNewForm
                ? "bg-surface-600 text-text-secondary hover:bg-surface-500"
                : "bg-brand-red text-white hover:bg-brand-red/80"
            }`}
          >
            {showNewForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Listing</>}
          </button>
        </div>
      </div>

      <form onSubmit={savePageContent} className="card p-6 mb-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-sm uppercase tracking-wider text-white">
              Preloved Chassis Page Content
            </h2>
            <p className="text-text-muted text-xs mt-1">
              These fields update the public Predator / preloved chassis page.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pageContentSaved && (
              <span className="text-xs text-green-400">Saved</span>
            )}
            <button
              type="submit"
              disabled={savingPageContent}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-heading uppercase tracking-wider bg-brand-red text-white hover:bg-brand-red/80 transition-colors rounded disabled:opacity-60"
            >
              {savingPageContent ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Page Content
            </button>
          </div>
        </div>

        {pageContentError && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
            {pageContentError}
          </p>
        )}

        {PAGE_CONTENT_GROUPS.map((group) => (
          <div key={group.title} className="border-t border-surface-700 pt-5">
            <h3 className="font-heading text-xs uppercase tracking-[0.25em] text-brand-red mb-4">
              {group.title}
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {group.fields.map((field) => (
                <div key={field.key} className={field.rows ? "sm:col-span-2" : ""}>
                  <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                    {field.label}
                  </label>
                  {field.rows ? (
                    <textarea
                      rows={field.rows}
                      className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red resize-none"
                      value={pageContentForm[field.key]}
                      onChange={(e) => setPageContentField(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                      value={pageContentForm[field.key]}
                      onChange={(e) => setPageContentField(field.key, e.target.value)}
                    />
                  )}
                  {field.help && (
                    <p className="text-[11px] text-text-muted mt-1">{field.help}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </form>

      {/* New listing form */}
      {showNewForm && (
        <form onSubmit={createListing} className="card p-6 mb-6 space-y-4">
          <h2 className="font-heading text-sm uppercase tracking-wider text-white mb-2">Create Admin Listing</h2>
          {createError && (
            <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{createError}</p>
          )}

          {/* Type */}
          <div className="flex gap-3">
            {(["sell", "buy"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNewForm((f) => ({ ...f, listing_type: t }))}
                className={`px-4 py-2 rounded text-xs font-heading uppercase tracking-wider transition-colors ${
                  newForm.listing_type === t
                    ? t === "sell" ? "bg-brand-red text-white" : "bg-blue-700 text-white"
                    : "bg-surface-700 text-text-secondary hover:bg-surface-600"
                }`}
              >
                {t === "sell" ? "Selling" : "Wanted / Buying"}
              </button>
            ))}
          </div>

          {/* Contact */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Contact Name *</label>
              <input
                className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                value={newForm.contact_name}
                onChange={(e) => setNewForm((f) => ({ ...f, contact_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Contact Email</label>
              <input
                type="email"
                className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                value={newForm.contact_email}
                onChange={(e) => setNewForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Contact Phone</label>
              <input
                className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                value={newForm.contact_phone}
                onChange={(e) => setNewForm((f) => ({ ...f, contact_phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Chassis Year</label>
              <input
                type="number"
                min={2000}
                max={new Date().getFullYear()}
                className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                value={newForm.chassis_year}
                onChange={(e) => setNewForm((f) => ({ ...f, chassis_year: e.target.value }))}
              />
            </div>
          </div>

          {/* Price + condition (sell only) */}
          {newForm.listing_type === "sell" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Asking Price ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                  value={newForm.asking_price}
                  onChange={(e) => setNewForm((f) => ({ ...f, asking_price: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Condition</label>
                <select
                  className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                  value={newForm.condition}
                  onChange={(e) => setNewForm((f) => ({ ...f, condition: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  <option value="new">New / Unused</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="parts-only">Parts only</option>
                </select>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Description *</label>
            <textarea
              rows={4}
              className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red resize-none"
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Listing Image URL</label>
            <input
              className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
              value={newForm.image_url}
              onChange={(e) => setNewForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="/Chasis/image.png or Supabase Storage URL"
            />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={() => { setShowNewForm(false); setNewForm(BLANK_FORM); setCreateError(""); }}
              className="px-4 py-2 text-xs font-heading uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-heading uppercase tracking-wider bg-brand-red text-white hover:bg-brand-red/80 transition-colors rounded disabled:opacity-60"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create &amp; Publish
            </button>
          </div>
        </form>
      )}

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

                {editingId === listing.id && editForm ? (
                  /* ── Edit mode ── */
                  <div className="space-y-4">
                    <p className="text-xs text-brand-red uppercase tracking-wider font-heading">Editing listing</p>
                    {saveError && (
                      <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{saveError}</p>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Contact Name</label>
                        <input
                          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                          value={editForm.contact_name}
                          onChange={(e) => setEditForm((f) => f && ({ ...f, contact_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Contact Phone</label>
                        <input
                          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                          value={editForm.contact_phone}
                          onChange={(e) => setEditForm((f) => f && ({ ...f, contact_phone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Chassis Year</label>
                        <input
                          type="number"
                          min={2000}
                          max={new Date().getFullYear()}
                          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                          value={editForm.chassis_year}
                          onChange={(e) => setEditForm((f) => f && ({ ...f, chassis_year: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Asking Price ($)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                          value={editForm.asking_price}
                          onChange={(e) => setEditForm((f) => f && ({ ...f, asking_price: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Condition</label>
                        <select
                          className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                          value={editForm.condition}
                          onChange={(e) => setEditForm((f) => f && ({ ...f, condition: e.target.value }))}
                        >
                          <option value="">— Not specified —</option>
                          <option value="new">New / Unused</option>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="parts-only">Parts only</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Description</label>
                      <textarea
                        rows={4}
                        className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red resize-none"
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => f && ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Listing Image URL</label>
                      <input
                        className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                        value={editForm.image_url}
                        onChange={(e) => setEditForm((f) => f && ({ ...f, image_url: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Admin Notes (internal only)</label>
                      <input
                        className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red"
                        value={editForm.admin_notes}
                        onChange={(e) => setEditForm((f) => f && ({ ...f, admin_notes: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-1.5 rounded text-xs font-heading uppercase tracking-wider bg-surface-700 text-text-secondary hover:bg-surface-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdits(listing.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-heading uppercase tracking-wider bg-brand-red text-white hover:bg-brand-red/80 transition-colors disabled:opacity-60"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <>
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

                    {listing.image_url && (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Image URL</p>
                        <p className="text-sm text-text-secondary break-all">{listing.image_url}</p>
                      </div>
                    )}

                    {/* Admin notes */}
                    {listing.admin_notes && (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Admin Notes</p>
                        <p className="text-sm text-text-secondary">{listing.admin_notes}</p>
                      </div>
                    )}

                    {/* Edit button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => startEdit(listing)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-heading uppercase tracking-wider border border-surface-500 text-text-secondary hover:text-white hover:border-surface-400 transition-colors"
                      >
                        <Pencil size={12} /> Edit Listing
                      </button>
                    </div>

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
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
