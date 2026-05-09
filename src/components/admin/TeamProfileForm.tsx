"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Upload, X, CheckCircle, AlertCircle, Eye, ExternalLink } from "lucide-react";
import { normalizeTeamLogoUrl } from "@/lib/teamLogos";

interface TeamProfile {
  id?: string;
  kart_number: string;
  team_name: string;
  tagline: string | null;
  accent_color: string;
  accent_rgb: string;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Props {
  team?: TeamProfile;
  isNew?: boolean;
}

const DEFAULT_COLORS = [
  { label: "Red", hex: "#ef4444", rgb: "239,68,68" },
  { label: "Orange", hex: "#f97316", rgb: "249,115,22" },
  { label: "Yellow", hex: "#eab308", rgb: "234,179,8" },
  { label: "Green", hex: "#22c55e", rgb: "34,197,94" },
  { label: "Blue", hex: "#3b82f6", rgb: "59,130,246" },
  { label: "Purple", hex: "#a855f7", rgb: "168,85,247" },
  { label: "White", hex: "#e2e8f0", rgb: "226,232,240" },
];

function cleanText(value: string) {
  return value.trim();
}

function cleanOptionalText(value: string) {
  return cleanText(value) || null;
}

function buildPayload(form: TeamProfile) {
  return {
    kart_number: cleanText(form.kart_number),
    team_name: cleanText(form.team_name),
    tagline: cleanOptionalText(form.tagline ?? ""),
    accent_color: cleanText(form.accent_color) || "#ef4444",
    accent_rgb: cleanText(form.accent_rgb) || "239,68,68",
    logo_url: normalizeTeamLogoUrl(form.logo_url, form.team_name) ?? null,
    website_url: cleanOptionalText(form.website_url ?? ""),
    sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : 0,
    is_active: Boolean(form.is_active),
  };
}

export function TeamProfileForm({ team, isNew = false }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<TeamProfile>({
    kart_number: team?.kart_number || "",
    team_name: team?.team_name || "",
    tagline: team?.tagline || "",
    accent_color: team?.accent_color || "#ef4444",
    accent_rgb: team?.accent_rgb || "239,68,68",
    logo_url: normalizeTeamLogoUrl(team?.logo_url, team?.team_name) || "",
    website_url: team?.website_url || "",
    sort_order: team?.sort_order ?? 0,
    is_active: team?.is_active ?? true,
  });

  function setField<K extends keyof TeamProfile>(key: K, value: TeamProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function pickColor(hex: string, rgb: string) {
    setForm((prev) => ({ ...prev, accent_color: hex, accent_rgb: rgb }));
  }

  function hexToRgb(hex: string): string {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return form.accent_rgb;
    return `${r},${g},${b}`;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !team?.id) return;
    setUploading(true);
    setErrorMsg("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/admin/team/${team.id}/logo`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const { url } = await res.json();
        setField("logo_url", url);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Upload failed — please try again");
      }
    } catch {
      setErrorMsg("Upload failed — network error");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    setErrorMsg("");

    const url = isNew ? "/api/admin/team" : `/api/admin/team/${team!.id}`;
    const method = isNew ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(form)),
    });

    if (res.ok) {
      const data = await res.json();
      if (isNew) {
        router.push(`/admin/team/${data.team.id}`);
      } else {
        setForm((prev) => ({ ...prev, ...data.team, logo_url: normalizeTeamLogoUrl(data.team.logo_url, data.team.team_name) || "" }));
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
    if (!confirm(`Delete "${form.team_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/team/${team!.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed — please try again");
      }
      router.push("/admin/team");
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Delete failed — please try again");
      setDeleting(false);
    }
  }

  const inputClass =
    "w-full bg-surface-700 border border-surface-600 rounded px-4 py-2.5 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50 text-sm";
  const textAreaClass =
    "w-full bg-surface-700 border border-surface-600 rounded px-4 py-2.5 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50 text-sm min-h-[82px] resize-y";
  const labelClass = "block text-xs text-text-muted uppercase tracking-wider mb-1.5";
  const normalizedLogoUrl = normalizeTeamLogoUrl(form.logo_url, form.team_name) || "";
  const hasPublishableProfile = form.kart_number.trim() && form.team_name.trim();

  return (
    <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[minmax(0,672px)_360px]">
      <div className="space-y-6">
      {/* Core info */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">Team Info</h2>
          <p className="mt-1 text-xs text-text-muted">
            These fields publish directly to the About page team carousel.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Kart Number *</label>
            <input
              required
              className={inputClass}
              value={form.kart_number}
              onChange={(e) => setField("kart_number", e.target.value)}
              placeholder="e.g. 338"
            />
          </div>
          <div>
            <label className={labelClass}>Sort Order</label>
            <input
              type="number"
              className={inputClass}
              value={form.sort_order}
              onChange={(e) => setField("sort_order", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Team Name *</label>
          <input
            required
            className={inputClass}
            value={form.team_name}
            onChange={(e) => setField("team_name", e.target.value)}
            placeholder="e.g. Scaff It Up"
          />
        </div>

        <div>
          <label className={labelClass}>Tagline</label>
          <textarea
            className={textAreaClass}
            value={form.tagline ?? ""}
            onChange={(e) => setField("tagline", e.target.value)}
            placeholder="e.g. Building speed from the ground up"
          />
          <p className="mt-1 text-xs text-text-muted">Leave blank when there is no real tagline yet.</p>
        </div>

        <div>
          <label className={labelClass}>Website URL</label>
          <input
            type="url"
            className={inputClass}
            value={form.website_url ?? ""}
            onChange={(e) => setField("website_url", e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setField("is_active", e.target.checked)}
            className="w-4 h-4 rounded accent-brand-red"
          />
          <label htmlFor="is_active" className="text-sm text-text-secondary">
            Visible on site
          </label>
        </div>
      </div>

      {/* Accent colour */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">Accent Colour</h2>
        <div className="flex flex-wrap gap-3">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => pickColor(c.hex, c.rgb)}
              title={c.label}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                form.accent_color === c.hex ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ background: c.hex }}
            />
          ))}
          <div className="flex items-center gap-2">
            <label className={labelClass + " mb-0"}>Custom:</label>
            <input
              type="color"
              value={form.accent_color}
              onChange={(e) => {
                const hex = e.target.value;
                setForm((prev) => ({ ...prev, accent_color: hex, accent_rgb: hexToRgb(hex) }));
              }}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Current: <span style={{ color: form.accent_color }}>{form.accent_color}</span>
        </p>
      </div>

      {/* Logo */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">Team Logo</h2>

        {normalizedLogoUrl ? (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={normalizedLogoUrl}
              alt={`${form.team_name || "Team"} logo preview`}
              className="h-24 w-24 rounded bg-surface-700 object-contain p-1"
            />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-surface-700 hover:bg-surface-600 rounded text-sm text-text-secondary hover:text-white transition-colors"
              >
                <Upload size={14} /> Replace
              </button>
              <button
                type="button"
                onClick={() => setField("logo_url", "")}
                className="flex items-center gap-2 px-3 py-2 bg-surface-700 hover:bg-red-900/50 rounded text-sm text-text-muted hover:text-red-400 transition-colors"
              >
                <X size={14} /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isNew ? (
              <p className="text-sm text-text-muted">Save the team first, then upload a logo.</p>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-surface-500 rounded text-sm text-text-muted hover:text-white hover:border-surface-400 transition-colors"
              >
                <Upload size={16} /> {uploading ? "Uploading…" : "Upload Logo"}
              </button>
            )}
            <p className="text-xs text-text-muted">PNG or JPEG, max 2MB. Square logos work best.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className={labelClass}>Or paste a URL / public path</label>
          <input
            className={inputClass}
            value={form.logo_url ?? ""}
            onChange={(e) => setField("logo_url", e.target.value)}
            placeholder="/images/history/team 3.jpeg or https://..."
          />
          {form.logo_url && normalizedLogoUrl !== form.logo_url.trim() ? (
            <p className="text-xs text-text-muted">
              Saves as <code className="text-text-secondary">{normalizedLogoUrl}</code>.
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              Use a public path from <code className="text-text-secondary">/public</code> or a full image URL.
            </p>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleLogoUpload}
        />
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
          <Save size={16} /> {saving ? "Saving…" : "Save Team"}
        </button>

        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-sm transition-colors"
          >
            <Trash2 size={16} /> {deleting ? "Deleting…" : "Delete Team"}
          </button>
        )}
        </div>
      </div>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
            <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">Public Preview</h2>
            <Eye size={16} className="text-text-muted" />
          </div>
          <div className="p-5">
            <div
              className="overflow-hidden border bg-[#141414]"
              style={{ borderColor: `rgba(${form.accent_rgb || "239,68,68"}, 0.3)` }}
            >
              <div className="h-1.5" style={{ background: form.accent_color || "#ef4444" }} />
              <div className="p-5">
                <div
                  className="mb-4 inline-flex h-14 min-w-14 items-center justify-center border-2 px-3 font-heading text-xl font-bold"
                  style={{ borderColor: form.accent_color, color: form.accent_color }}
                >
                  {form.kart_number.trim() ? `#${form.kart_number.trim()}` : "TBA"}
                </div>

                <div className="mb-4 flex h-36 items-center justify-center border border-white/10 bg-black/30">
                  {normalizedLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={normalizedLogoUrl} alt="" className="max-h-full max-w-full object-contain p-3" />
                  ) : (
                    <span className="font-heading text-xs uppercase tracking-[0.2em] text-white/30">
                      Logo Coming Soon
                    </span>
                  )}
                </div>

                <h3 className="font-heading text-2xl uppercase tracking-wider text-white">
                  {form.team_name.trim() || "Team Name"}
                </h3>
                {form.tagline?.trim() && (
                  <p className="mt-2 text-sm italic text-white/50">&ldquo;{form.tagline.trim()}&rdquo;</p>
                )}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded bg-surface-700 p-3">
                <dt className="text-text-muted">Status</dt>
                <dd className={form.is_active ? "mt-1 text-green-400" : "mt-1 text-text-secondary"}>
                  {form.is_active ? "Visible" : "Hidden"}
                </dd>
              </div>
              <div className="rounded bg-surface-700 p-3">
                <dt className="text-text-muted">Required</dt>
                <dd className={hasPublishableProfile ? "mt-1 text-green-400" : "mt-1 text-red-400"}>
                  {hasPublishableProfile ? "Complete" : "Missing"}
                </dd>
              </div>
            </dl>

            {form.website_url?.trim() && (
              <a
                href={form.website_url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-xs text-text-secondary hover:text-white"
              >
                <ExternalLink size={13} /> Test website link
              </a>
            )}
          </div>
        </div>
      </aside>
    </form>
  );
}
