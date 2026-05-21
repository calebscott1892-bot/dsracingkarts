"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Save,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import {
  RACEWEAR_ENTRY_DRAG_MIME,
  buildRacewearGroups,
  canDropRacewearEntry,
  compareRacewearEntries,
  extractRacewearDroppedFiles,
  reorderRacewearEntries,
  resolveRacewearDragOverEntryId,
  resolveRacewearDraggedEntryId,
  validateRacewearUploadFile,
  validateRacewearUploadFiles,
  type RacewearDropPlacement,
  type RacewearGalleryEntry,
  type RacewearReorderResult,
} from "@/lib/racewear-gallery";

interface Entry extends RacewearGalleryEntry {
  image_url: string;
  alt_text: string;
  is_active: boolean;
  is_featured: boolean;
}

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const emptyForm = (sortOrder = 0) => ({
  group_label: "",
  alt_text: "",
  sort_order: sortOrder,
  is_featured: true,
});

interface Props {
  initialEntries: Entry[];
}

function getNextSortOrder(entries: Entry[]) {
  if (entries.length === 0) return 0;
  return Math.max(...entries.map((entry) => Number(entry.sort_order) || 0)) + 1;
}

function sortEntries(entries: Entry[]) {
  return [...entries].sort(compareRacewearEntries);
}

function getDropPlacement(event: DragEvent<HTMLElement>): RacewearDropPlacement {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
}

export function RacewearManager({ initialEntries }: Props) {
  const [entries, setEntries] = useState<Entry[]>(sortEntries(initialEntries));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm(getNextSortOrder(initialEntries)));
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverEntry, setDragOverEntry] = useState<{
    id: string;
    placement: RacewearDropPlacement;
  } | null>(null);
  const draggingEntryIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingSort, setEditingSort] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [errorMsg, setErrorMsg] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  function setField<K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function clearPendingPhotos() {
    for (const photo of pendingPhotos) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setPendingPhotos([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addPhotoFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const validation = validateRacewearUploadFiles(files);
    if (!validation.ok) {
      setErrorMsg(validation.error);
      return;
    }

    for (const file of files) {
      const fileValidation = validateRacewearUploadFile(file);
      if (!fileValidation.ok) {
        setErrorMsg(fileValidation.error);
        return;
      }
    }

    setErrorMsg("");
    setPendingPhotos((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addPhotoFiles(event.target.files);
    event.target.value = "";
  }

  function handleUploadDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingUpload(false);
    addPhotoFiles(extractRacewearDroppedFiles<File>(event.dataTransfer));
  }

  function removePendingPhoto(id: string) {
    const photo = pendingPhotos.find((item) => item.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPendingPhotos((current) => current.filter((item) => item.id !== id));
  }

  function openAddPanel() {
    cancelEdit();
    clearPendingPhotos();
    setForm(emptyForm(getNextSortOrder(entries)));
    setErrorMsg("");
    setShowAdd(true);
  }

  function closePanel() {
    setShowAdd(false);
    cancelEdit();
    clearPendingPhotos();
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!form.group_label.trim()) {
      setErrorMsg("Group label is required.");
      return;
    }
    if (pendingPhotos.length === 0) {
      setErrorMsg("Please select at least one photo.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      const body = new FormData();
      body.append("group_label", form.group_label.trim());
      body.append("alt_text", form.alt_text.trim());
      body.append("sort_order", String(form.sort_order));
      body.append("is_featured", String(form.is_featured));
      for (const photo of pendingPhotos) {
        body.append("photos", photo.file);
      }

      const res = await fetch("/api/admin/racewear", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");

      const savedEntries = Array.isArray(data.entries)
        ? data.entries
        : data.entry
          ? [data.entry]
          : [];

      setEntries((current) => sortEntries([...current, ...savedEntries]));
      setShowAdd(false);
      setForm(emptyForm(getNextSortOrder([...entries, ...savedEntries])));
      clearPendingPhotos();
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setEntries((current) => current.filter((entry) => entry.id !== id));
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
      setEntries((current) =>
        current.map((item) => (item.id === entry.id ? { ...item, is_active: !item.is_active } : item))
      );
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
      setEntries((current) =>
        current.map((item) => (item.id === entry.id ? { ...item, is_featured: !item.is_featured } : item))
      );
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
      setEntries((current) =>
        sortEntries(current.map((entry) => (entry.id === id ? { ...entry, sort_order: sortValue } : entry)))
      );
      setEditingSort(null);
    } catch {
      alert("Failed to update order");
    }
  }

  async function persistReorder(
    result: RacewearReorderResult<Entry>,
    activeId: string
  ) {
    if (result.updates.length === 0) return;
    const previousEntries = entries;
    setMovingId(activeId);
    setEntries(result.entries);

    try {
      const res = await fetch("/api/admin/racewear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", entries: result.updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Reorder failed");
      }
    } catch {
      setEntries(previousEntries);
      alert("Failed to reorder photos. Refresh and try again.");
    } finally {
      setMovingId(null);
    }
  }

  async function moveWithinGroup(entry: Entry, direction: "up" | "down") {
    const group = buildRacewearGroups(entries).find((item) =>
      item.entries.some((peer) => peer.id === entry.id)
    );
    if (!group) return;

    const index = group.entries.findIndex((peer) => peer.id === entry.id);
    const neighbour = group.entries[direction === "up" ? index - 1 : index + 1];
    if (!neighbour) return;

    const result =
      direction === "up"
        ? reorderRacewearEntries(entries, entry.id, neighbour.id, "before")
        : reorderRacewearEntries(entries, entry.id, neighbour.id, "after");
    await persistReorder(result, entry.id);
  }

  function clearEntryDragState() {
    draggingEntryIdRef.current = null;
    setDraggingEntryId(null);
    setDragOverEntry(null);
  }

  function handleEntryDragStart(event: DragEvent<HTMLElement>, id: string) {
    draggingEntryIdRef.current = id;
    setDraggingEntryId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(RACEWEAR_ENTRY_DRAG_MIME, id);
    event.dataTransfer.setData("text/plain", id);
  }

  function handleEntryDragOver(event: DragEvent<HTMLDivElement>, targetId: string) {
    const draggedId = resolveRacewearDragOverEntryId(
      draggingEntryIdRef.current || draggingEntryId
    );
    if (!canDropRacewearEntry(draggedId, targetId)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverEntry({ id: targetId, placement: getDropPlacement(event) });
  }

  async function handleEntryDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = resolveRacewearDraggedEntryId(
      draggingEntryIdRef.current || draggingEntryId,
      event.dataTransfer
    );
    const placement =
      dragOverEntry?.id === targetId ? dragOverEntry.placement : getDropPlacement(event);
    clearEntryDragState();
    if (!canDropRacewearEntry(draggedId, targetId)) return;
    const result = reorderRacewearEntries(entries, draggedId, targetId, placement);
    await persistReorder(result, draggedId);
  }

  function openEdit(entry: Entry) {
    setShowAdd(false);
    clearPendingPhotos();
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
      setEntries((current) =>
        sortEntries(
          current.map((entry) =>
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
        )
      );
      cancelEdit();
    } catch {
      setErrorMsg("Failed to update photo details");
    }
  }

  const groups = buildRacewearGroups(entries);
  const existingGroupLabels = Array.from(new Set(entries.map((entry) => entry.group_label.trim())))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Racewear Gallery</h1>
        <button onClick={openAddPanel} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Photos
        </button>
      </div>

      <p className="text-text-muted text-sm mb-8">
        Choose featured images for the main Services page. Drag photos inside a client group to set their
        order, or use the arrow controls and order number for exact positioning.
      </p>

      {(showAdd || editingEntryId) && (
        <div className="card p-6 mb-8 border-brand-red/30">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-lg uppercase tracking-wider">
              {editingEntryId ? "Edit Photo" : "Add Photos"}
            </h2>
            <button onClick={closePanel} className="text-text-muted hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          {errorMsg && (
            <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 px-3 py-2 mb-4">
              {errorMsg}
            </p>
          )}
          <form
            onSubmit={editingEntryId ? (event) => { event.preventDefault(); handleSaveEntry(editingEntryId); } : handleAdd}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                  Group / Client Name *
                </label>
                <input
                  required
                  list="racewear-group-suggestions"
                  className="input-dark w-full"
                  value={editingEntryId ? editForm.group_label : form.group_label}
                  onChange={(event) =>
                    editingEntryId
                      ? setEditForm((current) => ({ ...current, group_label: event.target.value }))
                      : setField("group_label", event.target.value)
                  }
                  placeholder="e.g. Kart Blanche Racing"
                />
                <datalist id="racewear-group-suggestions">
                  {existingGroupLabels.map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
                <p className="text-xs text-text-muted mt-1">
                  Matching group names stay together under one heading.
                </p>
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                  Alt Text (description)
                </label>
                <input
                  className="input-dark w-full"
                  value={editingEntryId ? editForm.alt_text : form.alt_text}
                  onChange={(event) =>
                    editingEntryId
                      ? setEditForm((current) => ({ ...current, alt_text: event.target.value }))
                      : setField("alt_text", event.target.value)
                  }
                  placeholder="e.g. Kart Blanche race suit front view"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="w-32">
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  className="input-dark w-full"
                  value={editingEntryId ? editForm.sort_order : form.sort_order}
                  onChange={(event) =>
                    editingEntryId
                      ? setEditForm((current) => ({ ...current, sort_order: parseInt(event.target.value, 10) || 0 }))
                      : setField("sort_order", parseInt(event.target.value, 10) || 0)
                  }
                />
              </div>
              <div className="flex items-center gap-3 pb-1">
                <label className="text-sm text-text-secondary">Featured on Services page</label>
                <button
                  type="button"
                  onClick={() =>
                    editingEntryId
                      ? setEditForm((current) => ({ ...current, is_featured: !current.is_featured }))
                      : setField("is_featured", !form.is_featured)
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    (editingEntryId ? editForm.is_featured : form.is_featured)
                      ? "bg-brand-red"
                      : "bg-surface-500"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      (editingEntryId ? editForm.is_featured : form.is_featured)
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {!editingEntryId && (
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  Photos *
                </label>
                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDraggingUpload(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "copy";
                    setIsDraggingUpload(true);
                  }}
                  onDragLeave={(event) => {
                    event.stopPropagation();
                    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setIsDraggingUpload(false);
                  }}
                  onDrop={handleUploadDrop}
                  className={`border border-dashed px-4 py-4 transition-colors ${
                    isDraggingUpload
                      ? "border-brand-red bg-brand-red/10 text-white"
                      : "border-surface-500 bg-surface-800/50 text-text-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 text-sm hover:text-white transition-colors"
                  >
                    <Camera size={16} /> Select or drop photos
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </div>

                {pendingPhotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {pendingPhotos.map((photo) => (
                      <div key={photo.id} className="relative aspect-[3/4] overflow-hidden border border-surface-600 bg-surface-900">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Browser file previews use local blob URLs. */}
                        <img
                          src={photo.previewUrl}
                          alt={photo.file.name}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(photo.id)}
                          className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-brand-red transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? (editingEntryId ? "Saving..." : "Uploading...") : (editingEntryId ? "Save Changes" : "Save Photos")}
              </button>
              <button type="button" onClick={closePanel} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card p-8 text-center text-text-muted">
          <Camera size={32} className="mx-auto mb-3 opacity-30" />
          <p>No photos yet. Click Add Photos to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ label, entries: groupEntries }) => (
            <div key={label}>
              <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-brand-red mb-3">
                {label}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {groupEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    onDragEnter={(event) => handleEntryDragOver(event, entry.id)}
                    onDragOver={(event) => handleEntryDragOver(event, entry.id)}
                    onDragLeave={(event) => {
                      const nextTarget = event.relatedTarget as Node | null;
                      if (nextTarget && event.currentTarget.contains(nextTarget)) return;
                      setDragOverEntry((current) => (current?.id === entry.id ? null : current));
                    }}
                    onDrop={(event) => handleEntryDrop(event, entry.id)}
                    className={`card relative overflow-hidden transition-colors ${
                      !entry.is_active ? "opacity-40" : ""
                    } ${draggingEntryId === entry.id ? "ring-1 ring-brand-red" : ""}`}
                  >
                    {dragOverEntry?.id === entry.id && (
                      <div
                        className={`pointer-events-none absolute left-0 right-0 z-20 h-1 bg-brand-red ${
                          dragOverEntry.placement === "before" ? "top-0" : "bottom-0"
                        }`}
                      />
                    )}
                    <div
                      draggable
                      onDragStart={(event) => handleEntryDragStart(event, entry.id)}
                      onDragEnd={clearEntryDragState}
                      aria-grabbed={draggingEntryId === entry.id}
                      className="relative aspect-[3/4] cursor-grab bg-surface-900 active:cursor-grabbing"
                    >
                      <Image
                        src={entry.image_url}
                        alt={entry.alt_text || entry.group_label}
                        fill
                        sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                        draggable={false}
                        className="select-none object-cover"
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
                        <button
                          onClick={() => moveWithinGroup(entry, "up")}
                          disabled={index === 0 || movingId === entry.id}
                          title="Move earlier"
                          className="px-1.5 py-0.5 bg-surface-700 text-text-muted hover:bg-surface-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {movingId === entry.id ? <Loader2 size={11} className="animate-spin" /> : <ArrowUp size={11} />}
                        </button>
                        <button
                          onClick={() => moveWithinGroup(entry, "down")}
                          disabled={index === groupEntries.length - 1 || movingId === entry.id}
                          title="Move later"
                          className="px-1.5 py-0.5 bg-surface-700 text-text-muted hover:bg-surface-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {movingId === entry.id ? <Loader2 size={11} className="animate-spin" /> : <ArrowDown size={11} />}
                        </button>
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => handleEntryDragStart(event, entry.id)}
                          onDragEnd={clearEntryDragState}
                          title="Drag to reorder"
                          className="ml-1 text-text-muted hover:text-white cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical size={14} />
                        </button>
                        {editingSort === entry.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="number"
                              className="input-dark text-xs px-1 py-0.5 w-14"
                              value={sortValue}
                              onChange={(event) => setSortValue(parseInt(event.target.value, 10) || 0)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") handleSaveSort(entry.id);
                                if (event.key === "Escape") setEditingSort(null);
                              }}
                              autoFocus
                            />
                            <button onClick={() => handleSaveSort(entry.id)} className="text-green-400 hover:text-green-300">
                              <Save size={11} />
                            </button>
                            <button onClick={() => setEditingSort(null)} className="text-text-muted hover:text-white">
                              <X size={11} />
                            </button>
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
