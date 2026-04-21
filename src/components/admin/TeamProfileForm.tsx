"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Save, Trash2, Upload, X, CheckCircle, AlertCircle } from "lucide-react";

interface TeamProfile {
  id?: string;
  kart_number: string;
  team_name: string;
  tagline: string;
  accent_color: string;
  accent_rgb: string;
  logo_url: string;
  website_url: string;
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
    logo_url: team?.logo_url || "",
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !team?.id) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/team/${team.id}/logo`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const { url } = await res.json();
      setField("logo_url", url);
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
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const data = await res.json();
      if (isNew) {
        router.push(`/admin/team/${data.team.id}`);
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
    if (!confirm(`Delete "${form.team_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/admin/team/${team!.id}`, { method: "DELETE" });
    router.push("/admin/team");
  }

  const inputClass =
    "w-full bg-surface-700 border border-surface-600 rounded px-4 py-2.5 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50 text-sm";
  const labelClass = "block text-xs text-text-muted uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {/* Core info */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-sm uppercase tracking-wider text-text-muted">Team Info</h2>

        <div className="grid grid-cols-2 gap-4">
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
          <input
            className={inputClass}
            value={form.tagline}
            onChange={(e) => setField("tagline", e.target.value)}
            placeholder="e.g. Building speed from the ground up"
          />
        </div>

        <div>
          <label className={labelClass}>Website URL</label>
          <input
            type="url"
            className={inputClass}
            value={form.website_url}
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
              onChange={(e) => setField("accent_color", e.target.value)}
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

        {form.logo_url ? (
          <div className="flex items-start gap-4">
            <Image
              src={form.logo_url}
              alt="Logo"
              width={80}
              height={80}
              className="rounded object-contain bg-surface-700 p-1"
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
          <div>
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
            <p className="text-xs text-text-muted mt-2">PNG or JPEG, max 2MB. Square logos work best.</p>
          </div>
        )}

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
    </form>
  );
}
