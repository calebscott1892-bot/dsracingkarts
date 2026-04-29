"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Eye, EyeOff, Loader2, X, Camera, GripVertical, Save, Star, StarOff, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Entry {
  id: string;
  group_label: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
}

const emptyForm = () => ({
  group_label: "",
  alt_text: "",
  sort_order: 0,
  is_featured: false,
});

interface Props { initialEntries: Entry[] }

export function RacewearManager({ initialEntries }: Props) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingSort, setEditingSort] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [errorMsg, setErrorMsg] = useState("");

  function setField<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErrorMsg("Photo must be under 10 MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("Only JPG, PNG or WebP accepted."); return;
    }
    setErrorMsg("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.group_label.trim()) { setErrorMsg("Group label is required."); return; }
    if (!photoFile) { setErrorMsg("Please select a photo."); return; }
    setSaving(true);
    setErrorMsg("");
    try {
      const supabase = createClient();
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("racewear-photos")
        .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from("racewear-photos").getPublicUrl(path);

      const res = await fetch("/api/admin/racewear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_label: form.group_label.trim(),
          image_url: urlData.publicUrl,
          alt_text: form.alt_text.trim(),
          sort_order: form.sort_order,
          is_featured: form.is_featured,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Save failed"); }
      const { entry } = await res.json();
      setEntries((prev) => [...prev, entry].sort((a, b) => a.sort_order - b.sort_order));
      setShowAdd(false);
      setForm(emptyForm());
      removePhoto();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this photo from the gallery?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/racewear?id=${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Delete failed"); }
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggle(entry: Entry) {
    setToggling(entry.id);
    try {
      const res = await fetch("/api/admin/racewear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, is_active: !entry.is_active }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, is_active: !e.is_active } : e));
    } catch {
      alert("Failed to update visibility");
    } finally {
      setToggling(null);
    }
  }

  async function handleToggleFeatured(entry: Entry) {
    try {
      const res = await fetch("/api/admin/racewear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, is_featured: !entry.is_featured }),
      });
      if (!res.ok) throw new Error("Feature toggle failed");
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, is_featured: !e.is_featured } : e));
    } catch {
      alert("Failed to update featured setting");
    }
  }

  async function handleSaveSort(id: string) {
    try {
      const res = await fetch("/api/admin/racewear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sort_order: sortValue }),
      });
      if (!res.ok) throw new Error("Update failed");
      setEntries((prev) =>
        prev.map((e) => e.id === id ? { ...e, sort_order: sortValue } : e)
          .sort((a, b) => a.sort_order - b.sort_order)
      );
      setEditingSort(null);
    } catch {
      alert("Failed to update order");
    }
  }

  function openEdit(entry: Entry) {
    setEditingEntryId(entry.id);
    setEditForm({
      group_label: entry.group_label,
      alt_text: entry.alt_text || "",
      sort_order: entry.sort_order,
      is_featured: entry.is_featured,
    });
    setErrorMsg("");
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setEditForm(emptyForm());
  }

  async function handleSaveEntry(id: string) {
    if (!editForm.group_label.trim()) {
      setErrorMsg("Group label is required.");
      return;
    }
    try {
      const res = await fetch("/api/admin/racewear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          group_label: editForm.group_label,
          alt_text: editForm.alt_text,
          sort_order: editForm.sort_order,
          is_featured: editForm.is_featured,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      setEntries((prev) =>
        prev
          .map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  group_label: editForm.group_label.trim(),
                  alt_text: editForm.alt_text.trim(),
                  sort_order: editForm.sort_order,
                  is_featured: editForm.is_featured,
                }
              : entry
          )
          .sort((a, b) => a.sort_order - b.sort_order)
      );
      cancelEdit();
    } catch {
      setErrorMsg("Failed to update photo details");
    }
  }

  const groups = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.group_label] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Racewear Gallery</h1>
        <button
          onClick={() => { setShowAdd(true); setForm(emptyForm()); removePhoto(); setErrorMsg(""); }}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Add Photo
        </button>
      </div>

      <p className="text-text-muted text-sm mb-8">
        Choose which images are featured on the main Services page and which stay tucked behind the
        <span className="text-white"> See More </span>
        gallery. Sort order controls the display order in both places.
      </p>

      {(showAdd || editingEntryId) && (
        <div className="card p-6 mb-8 border-brand-red/30">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-lg uppercase tracking-wider">{editingEntryId ? "Edit Photo" : "Add Photo"}</h2>
            <button onClick={() => { setShowAdd(false); cancelEdit(); }} className="text-text-muted hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          {errorMsg && (
            <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 px-3 py-2 mb-4">{errorMsg}</p>
          )}
          <form onSubmit={editingEntryId ? (e) => { e.preventDefault(); handleSaveEntry(editingEntryId); } : handleAdd} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Group / Client Name *</label>
                <input
                  required
                  className="input-dark w-full"
                  value={editingEntryId ? editForm.group_label : form.group_label}
                  onChange={(e) => editingEntryId ? setEditForm((f) => ({ ...f, group_label: e.target.value })) : setField("group_label", e.target.value)}
                  placeholder="e.g. Kart Blanche Racing"
                />
                <p className="text-xs text-text-muted mt-1">Photos with the same group name appear together.</p>
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Alt Text (description)</label>
                <input
                  className="input-dark w-full"
                  value={editingEntryId ? editForm.alt_text : form.alt_text}
                  onChange={(e) => editingEntryId ? setEditForm((f) => ({ ...f, alt_text: e.target.value })) : setField("alt_text", e.target.value)}
                  placeholder="e.g. Kart Blanche - race suit front view"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="w-32">
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">Sort Order</label>
                <input
                  type="number"
                  className="input-dark w-full"
                  value={editingEntryId ? editForm.sort_order : form.sort_order}
                  onChange={(e) => editingEntryId ? setEditForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 })) : setField("sort_order", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center gap-3 pb-1">
                <label className="text-sm text-text-secondary">Featured on Services page</label>
                <button
                  type="button"
                  onClick={() => editingEntryId ? setEditForm((f) => ({ ...f, is_featured: !f.is_featured })) : setField("is_featured", !form.is_featured)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(editingEntryId ? editForm.is_featured : form.is_featured) ? "bg-brand-red" : "bg-surface-500"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${(editingEntryId ? editForm.is_featured : form.is_featured) ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            {!editingEntryId && (
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Photo *</label>
              {photoPreview ? (
                <div className="relative inline-block">
                  <img src={photoPreview} alt="Preview" className="max-h-48 rounded border border-surface-600 object-cover" />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-brand-red transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 border border-dashed border-surface-500 hover:border-brand-red/60 bg-surface-800/50 text-text-muted hover:text-white transition-colors px-4 py-3 text-sm w-full justify-center"
                >
                  <Camera size={16} /> Upload photo (JPG, PNG, WebP - max 10 MB)
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handlePhotoChange} />
            </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? (editingEntryId ? "Saving..." : "Uploading...") : (editingEntryId ? "Save Changes" : "Save Photo")}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); cancelEdit(); }} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {Object.keys(groups).length === 0 ? (
        <div className="card p-8 text-center text-text-muted">
          <Camera size={32} className="mx-auto mb-3 opacity-30" />
          <p>No photos yet. Click &ldquo;Add Photo&rdquo; to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([label, groupEntries]) => (
            <div key={label}>
              <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-brand-red mb-3">{label}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {groupEntries.map((entry) => (
                  <div key={entry.id} className={`card overflow-hidden ${!entry.is_active ? "opacity-40" : ""}`}>
                    <div className="relative aspect-[3/4] bg-surface-900">
                      <img
                        src={entry.image_url}
                        alt={entry.alt_text || entry.group_label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-[10px] text-text-muted truncate">{entry.alt_text || "-"}</p>
                      <div className="flex flex-wrap gap-1">
                        {entry.is_featured ? (
                          <span className="inline-flex items-center gap-1 rounded bg-brand-red/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-red">
                            <Star size={10} /> Featured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                            <StarOff size={10} /> See More Only
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <GripVertical size={12} className="text-text-muted shrink-0" />
                        {editingSort === entry.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="number"
                              className="input-dark text-xs px-1 py-0.5 w-14"
                              value={sortValue}
                              onChange={(e) => setSortValue(parseInt(e.target.value) || 0)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveSort(entry.id); if (e.key === "Escape") setEditingSort(null); }}
                              autoFocus
                            />
                            <button onClick={() => handleSaveSort(entry.id)} className="text-green-400 hover:text-green-300"><Save size={11} /></button>
                            <button onClick={() => setEditingSort(null)} className="text-text-muted hover:text-white"><X size={11} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingSort(entry.id); setSortValue(entry.sort_order); }}
                            className="text-xs text-text-muted hover:text-white transition-colors"
                          >
                            Order: {entry.sort_order}
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(entry)}
                          title="Edit details"
                          className="flex-1 flex items-center justify-center py-1 bg-surface-700 text-text-muted hover:bg-surface-600 hover:text-white transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(entry)}
                          title={entry.is_featured ? "Remove from Services page" : "Show on Services page"}
                          className={`flex-1 flex items-center justify-center py-1 transition-colors ${
                            entry.is_featured
                              ? "bg-brand-red/15 text-brand-red hover:bg-brand-red/25"
                              : "bg-surface-700 text-text-muted hover:bg-surface-600 hover:text-white"
                          }`}
                        >
                          {entry.is_featured ? <Star size={12} /> : <StarOff size={12} />}
                        </button>
                        <button
                          onClick={() => handleToggle(entry)}
                          disabled={toggling === entry.id}
                          title={entry.is_active ? "Hide" : "Show"}
                          className="flex-1 flex items-center justify-center py-1 bg-surface-700 hover:bg-surface-600 transition-colors text-text-muted hover:text-white"
                        >
                          {toggling === entry.id ? <Loader2 size={12} className="animate-spin" /> : entry.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleting === entry.id}
                          title="Delete"
                          className="flex-1 flex items-center justify-center py-1 bg-surface-700 hover:bg-red-900/50 transition-colors text-text-muted hover:text-red-400"
                        >
                          {deleting === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
