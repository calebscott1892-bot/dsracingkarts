"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, CheckCircle, AlertCircle } from "lucide-react";

// ── Sydney timezone helpers ────────────────────────────────────────────────
// Convert a UTC ISO string into a datetime-local value expressed in Sydney time.
function toSydneyLocal(utcIso: string): string {
  if (!utcIso) return "";
  const date = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const h = g("hour") === "24" ? "00" : g("hour");
  return `${g("year")}-${g("month")}-${g("day")}T${h}:${g("minute")}`;
}

// Convert a datetime-local string (entered as Sydney time) to a UTC ISO string.
function sydneyLocalToUTC(local: string): string {
  if (!local) return "";
  // Treat the entered value as UTC momentarily to get a reference Date,
  // then read Sydney's UTC offset for that moment and subtract it.
  const ref = new Date(local + ":00.000Z");
  const tzLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "shortOffset",
  })
    .formatToParts(ref)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+10";
  const match = tzLabel.match(/GMT([+-])(\d+)/);
  const offsetMin = match
    ? parseInt(match[2]) * 60 * (match[1] === "+" ? 1 : -1)
    : 600;
  return new Date(ref.getTime() - offsetMin * 60 * 1000).toISOString();
}
// ──────────────────────────────────────────────────────────────────────────

interface Announcement {
  id?: string;
  title: string;
  body: string;
  type: "info" | "warning" | "event" | "promo";
  cta_label: string;
  cta_url: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  sort_order: number;
}

interface Props {
  announcement?: Announcement;
  isNew?: boolean;
}

const TYPE_OPTIONS = [
  { value: "info", label: "Info", description: "General information or news" },
  { value: "event", label: "Event", description: "Race day, track events" },
  { value: "promo", label: "Promo", description: "Sale or special offer" },
  { value: "warning", label: "Warning", description: "Important notice" },
];

export function AnnouncementForm({ announcement, isNew = false }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState<Announcement>({
    title: announcement?.title || "",
    body: announcement?.body || "",
    type: announcement?.type || "info",
    cta_label: announcement?.cta_label || "",
    cta_url: announcement?.cta_url || "",
    is_active: announcement?.is_active ?? true,
    starts_at: announcement?.starts_at ? toSydneyLocal(announcement.starts_at) : "",
    ends_at: announcement?.ends_at ? toSydneyLocal(announcement.ends_at) : "",
    sort_order: announcement?.sort_order ?? 0,
  });

  function setField<K extends keyof Announcement>(key: K, value: Announcement[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    setErrorMsg("");

    const payload = {
      ...form,
      starts_at: form.starts_at ? sydneyLocalToUTC(form.starts_at) : null,
      ends_at: form.ends_at ? sydneyLocalToUTC(form.ends_at) : null,
    };

    const url = isNew ? "/api/admin/announcements" : `/api/admin/announcements/${announcement!.id}`;
    const method = isNew ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (isNew) {
        router.push(`/admin/announcements/${data.announcement.id}`);
      } else {
        setSavedMsg("Saved successfully");
        setTimeout(() => setSavedMsg(""), 4000);
        router.refresh();
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Save failed — please try again");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/admin/announcements/${announcement!.id}`, { method: "DELETE" });
    router.push("/admin/announcements");
  }

  const inputClass =
    "w-full bg-surface-700 border border-surface-600 rounded px-4 py-2.5 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50 text-sm";
  const labelClass = "block text-xs text-text-muted uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {/* Content */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">Content</h2>

        <div>
          <label className={labelClass}>Title *</label>
          <input
            required
            className={inputClass}
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="e.g. Race Day — 3 May at Oran Park"
          />
        </div>

        <div>
          <label className={labelClass}>Message *</label>
          <textarea
            required
            rows={3}
            className={inputClass}
            value={form.body}
            onChange={(e) => setField("body", e.target.value)}
            placeholder="What do you want visitors to know?"
          />
        </div>

        <div>
          <label className={labelClass}>Type</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField("type", opt.value as Announcement["type"])}
                className={`p-3 rounded border text-left transition-colors ${
                  form.type === opt.value
                    ? "border-brand-red bg-brand-red/10 text-white"
                    : "border-surface-600 bg-surface-700 text-text-secondary hover:border-surface-500"
                }`}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-text-muted">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">
          Call to Action <span className="text-text-muted font-normal normal-case tracking-normal">(optional)</span>
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Button Label</label>
            <input
              className={inputClass}
              value={form.cta_label}
              onChange={(e) => setField("cta_label", e.target.value)}
              placeholder="e.g. Learn More"
            />
          </div>
          <div>
            <label className={labelClass}>Button URL</label>
            <input
              type="url"
              className={inputClass}
              value={form.cta_url}
              onChange={(e) => setField("cta_url", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">
          Scheduling
          <span className="ml-2 text-[10px] normal-case tracking-normal font-normal text-text-muted/60">
            (all times in Sydney / AEST)
          </span>
        </h2>

        <div className="flex items-center gap-3 mb-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setField("is_active", e.target.checked)}
            className="w-4 h-4 rounded accent-brand-red"
          />
          <label htmlFor="is_active" className="text-sm text-text-secondary">
            Active (will show on site)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Show From</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.starts_at}
              onChange={(e) => setField("starts_at", e.target.value)}
            />
            <p className="text-xs text-text-muted mt-1">Leave blank to show immediately</p>
          </div>
          <div>
            <label className={labelClass}>Hide After</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.ends_at}
              onChange={(e) => setField("ends_at", e.target.value)}
            />
            <p className="text-xs text-text-muted mt-1">Leave blank to show indefinitely</p>
          </div>
        </div>

        <div>
          <label className={labelClass}>Sort Order</label>
          <input
            type="number"
            className={inputClass}
            value={form.sort_order}
            onChange={(e) => setField("sort_order", parseInt(e.target.value) || 0)}
          />
          <p className="text-xs text-text-muted mt-1">Lower numbers show first if multiple are active</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {savedMsg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
            <CheckCircle size={16} /> {savedMsg}
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Save size={16} /> {saving ? "Saving…" : "Save Announcement"}
          </button>

          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-sm transition-colors"
            >
              <Trash2 size={16} /> {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
