"use client";

import type { ChangeEvent, DragEvent, FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckSquare,
  Eye,
  EyeOff,
  FolderInput,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Save,
  Square,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import {
  buildRacewearGroups,
  canDropRacewearEntry,
  compareRacewearEntries,
  extractRacewearDroppedFiles,
  getRacewearAutoScrollDelta,
  getRacewearDropPlacement,
  moveRacewearEntriesToGroup,
  reorderRacewearEntries,
  renameRacewearGroup,
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

function getDropPlacementFromPointer(element: HTMLElement, clientX: number, clientY: number): RacewearDropPlacement {
  const rect = element.getBoundingClientRect();
  return getRacewearDropPlacement({
    clientX,
    clientY,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  });
}

function findScrollContainer(element: HTMLElement | null) {
  let current = element?.parentElement ?? null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = `${style.overflowY} ${style.overflow}`;
    const canScroll = /(auto|scroll|overlay)/.test(overflowY);
    if (canScroll && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return null;
}

function RacewearDropSlot({ placement }: { placement: RacewearDropPlacement }) {
  return (
    <div
      data-racewear-drop-slot="true"
      data-racewear-drop-placement={placement}
      className="card relative aspect-[3/4] border-2 border-dashed border-brand-red bg-brand-red/10 shadow-[0_0_24px_rgba(230,0,18,0.22)]"
    >
      <div className="absolute inset-2 border border-brand-red/50 bg-brand-red/5" />
      <div className="absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 bg-brand-red shadow-[0_0_16px_rgba(230,0,18,0.8)]" />
      <span className="sr-only">Drop photo here</span>
    </div>
  );
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
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [bulkGroupLabel, setBulkGroupLabel] = useState("");
  const [renamingGroupLabel, setRenamingGroupLabel] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState("");
  const [groupAction, setGroupAction] = useState<string | null>(null);
  const managerRef = useRef<HTMLDivElement>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);
  const addGroupInputRef = useRef<HTMLInputElement>(null);
  const entriesRef = useRef(entries);
  const dragOverEntryRef = useRef<typeof dragOverEntry>(null);
  const pointerDragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const lastDragClientYRef = useRef(0);

  const setEntryDragOver = useCallback((next: typeof dragOverEntry) => {
    dragOverEntryRef.current = next;
    setDragOverEntry(next);
  }, []);

  const clearEntryDragState = useCallback(() => {
    pointerDragRef.current = null;
    draggingEntryIdRef.current = null;
    setDraggingEntryId(null);
    setEntryDragOver(null);
  }, [setEntryDragOver]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    const entryIds = new Set(entries.map((entry) => entry.id));
    setSelectedEntryIds((current) => {
      const next = current.filter((id) => entryIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [entries]);

  useEffect(() => {
    if (!draggingEntryId) return;

    let animationFrame = 0;
    const scrollContainer = findScrollContainer(managerRef.current);

    const requestAutoScroll = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(scrollWhileNearEdge);
      }
    };

    const scrollWhileNearEdge = () => {
      animationFrame = 0;
      const viewport = scrollContainer?.getBoundingClientRect() ?? {
        top: 0,
        bottom: window.innerHeight,
      };
      const delta = getRacewearAutoScrollDelta({
        pointerY: lastDragClientYRef.current,
        viewportTop: viewport.top,
        viewportBottom: viewport.bottom,
      });

      if (delta !== 0) {
        const beforeScroll = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
        if (scrollContainer) {
          scrollContainer.scrollTop += delta;
        } else {
          window.scrollBy({ top: delta });
        }
        const afterScroll = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
        if (afterScroll !== beforeScroll) {
          requestAutoScroll();
        }
      }
    };

    const updatePointerDropTarget = (clientX: number, clientY: number) => {
      const activeId = pointerDragRef.current?.id || draggingEntryIdRef.current || draggingEntryId;
      const element = document.elementFromPoint(clientX, clientY);
      const target = element?.closest<HTMLElement>("[data-racewear-entry-id]");
      const targetId = target?.dataset.racewearEntryId;

      if (target && targetId && canDropEntryOnTarget(activeId, targetId)) {
        setEntryDragOver({
          id: targetId,
          placement: getDropPlacementFromPointer(target, clientX, clientY),
        });
        return;
      }

      const groupTarget = element?.closest<HTMLElement>("[data-racewear-group-drop-label]");
      const groupLabel = groupTarget?.dataset.racewearGroupDropLabel;
      if (groupLabel && activeId) {
        const group = buildRacewearGroups(entriesRef.current).find((item) => item.label === groupLabel);
        const fallbackTarget = group?.entries.filter((entry) => entry.id !== activeId).at(-1);
        if (fallbackTarget && canDropEntryOnTarget(activeId, fallbackTarget.id)) {
          setEntryDragOver({ id: fallbackTarget.id, placement: "after" });
          return;
        }
      }

      setEntryDragOver(null);
    };

    const handleWindowDragOver = (event: globalThis.DragEvent) => {
      lastDragClientYRef.current = event.clientY;
      requestAutoScroll();
    };

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (!pointerDragRef.current) return;
      event.preventDefault();
      lastDragClientYRef.current = event.clientY;
      updatePointerDropTarget(event.clientX, event.clientY);
      requestAutoScroll();
    };

    const finishPointerDrag = () => {
      const activeId = pointerDragRef.current?.id;
      const target = dragOverEntryRef.current;
      pointerDragRef.current = null;
      clearEntryDragState();

      if (!activeId || !target || !canDropEntryOnTarget(activeId, target.id)) return;
      const result = reorderRacewearEntries(entriesRef.current, activeId, target.id, target.placement);
      void persistReorder(result, activeId);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("pointermove", handleWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", finishPointerDrag);
    window.addEventListener("pointercancel", clearEntryDragState);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", finishPointerDrag);
      window.removeEventListener("pointercancel", clearEntryDragState);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [clearEntryDragState, draggingEntryId, setEntryDragOver]);

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
    window.requestAnimationFrame(() => {
      addPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      addGroupInputRef.current?.focus({ preventScroll: true });
    });
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
    const previousEntries = entriesRef.current;
    setMovingId(activeId);
    entriesRef.current = result.entries;
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
      entriesRef.current = previousEntries;
      setEntries(previousEntries);
      alert("Failed to reorder photos. Refresh and try again.");
    } finally {
      setMovingId(null);
    }
  }

  async function persistGroupUpdates(
    result: RacewearReorderResult<Entry>,
    actionKey: string,
    failureMessage: string
  ) {
    if (result.updates.length === 0) return true;

    const previousEntries = entriesRef.current;
    setGroupAction(actionKey);
    entriesRef.current = result.entries;
    setEntries(result.entries);

    try {
      const res = await fetch("/api/admin/racewear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", entries: result.updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || failureMessage);
      }
      return true;
    } catch {
      entriesRef.current = previousEntries;
      setEntries(previousEntries);
      alert(failureMessage);
      return false;
    } finally {
      setGroupAction(null);
    }
  }

  function toggleEntrySelection(id: string) {
    setSelectedEntryIds((current) =>
      current.includes(id) ? current.filter((entryId) => entryId !== id) : [...current, id]
    );
  }

  function toggleGroupSelection(groupEntries: Entry[]) {
    const groupIds = groupEntries.map((entry) => entry.id);
    const groupIdSet = new Set(groupIds);
    const allSelected = groupIds.every((id) => selectedEntryIds.includes(id));
    setSelectedEntryIds((current) =>
      allSelected
        ? current.filter((id) => !groupIdSet.has(id))
        : Array.from(new Set([...current, ...groupIds]))
    );
  }

  async function handleMoveSelectedToGroup() {
    const targetLabel = bulkGroupLabel.trim();
    if (!targetLabel) {
      setErrorMsg("Enter a group name before moving selected photos.");
      return;
    }
    if (selectedEntryIds.length === 0) return;

    setErrorMsg("");
    const result = moveRacewearEntriesToGroup(entriesRef.current, selectedEntryIds, targetLabel);
    const saved = await persistGroupUpdates(
      result,
      "bulk-move",
      "Failed to move selected photos. Refresh and try again."
    );
    if (saved) {
      setSelectedEntryIds([]);
      setBulkGroupLabel("");
    }
  }

  function startRenameGroup(label: string) {
    setRenamingGroupLabel(label);
    setRenameGroupValue(label);
    setErrorMsg("");
  }

  async function handleRenameGroup(label: string) {
    const nextLabel = renameGroupValue.trim();
    if (!nextLabel) {
      setErrorMsg("Group name is required.");
      return;
    }

    setErrorMsg("");
    const result = renameRacewearGroup(entriesRef.current, label, nextLabel);
    const saved = await persistGroupUpdates(
      result,
      `rename:${label}`,
      "Failed to rename group. Refresh and try again."
    );
    if (saved) {
      setRenamingGroupLabel(null);
      setRenameGroupValue("");
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

  function handleEntryPointerDown(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerDragRef.current = { id, pointerId: event.pointerId };
    draggingEntryIdRef.current = id;
    setDraggingEntryId(id);
    lastDragClientYRef.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function canDropEntryOnTarget(draggedId: string | null | undefined, targetId: string) {
    const currentEntries = entriesRef.current;
    return Boolean(
      canDropRacewearEntry(draggedId, targetId) &&
        currentEntries.some((entry) => entry.id === draggedId) &&
        currentEntries.some((entry) => entry.id === targetId)
    );
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
  const selectedEntryIdSet = new Set(selectedEntryIds);

  return (
    <div ref={managerRef}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Racewear Gallery</h1>
        <button
          type="button"
          onClick={openAddPanel}
          aria-controls="racewear-add-panel"
          aria-expanded={showAdd}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Add Photos
        </button>
      </div>

      <p className="text-text-muted text-sm mb-8">
        Choose featured images for the main Services page. Drag photos onto another image to reorder them,
        use the checkboxes to move sets into a named group, or rename a whole group from its heading.
      </p>

      {errorMsg && !showAdd && !editingEntryId && (
        <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 px-3 py-2 mb-4">
          {errorMsg}
        </p>
      )}

      {entries.length > 0 && (
        <div className="mb-6 border border-surface-600 bg-surface-800/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-heading text-sm uppercase tracking-[0.14em] text-white">
                {selectedEntryIds.length} selected
              </p>
              <p className="text-xs text-text-muted">
                Move selected photos into an existing group or type a new group name.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 sm:w-72">
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                  Target Group
                </label>
                <input
                  list="racewear-group-suggestions"
                  className="input-dark w-full text-sm"
                  value={bulkGroupLabel}
                  onChange={(event) => setBulkGroupLabel(event.target.value)}
                  placeholder="e.g. PM (Polaris Marine)"
                />
              </div>
              <button
                type="button"
                onClick={handleMoveSelectedToGroup}
                disabled={selectedEntryIds.length === 0 || !bulkGroupLabel.trim() || groupAction === "bulk-move"}
                className="btn-primary flex items-center justify-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {groupAction === "bulk-move" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FolderInput size={14} />
                )}
                Move
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedEntryIds([]);
                  setBulkGroupLabel("");
                }}
                disabled={selectedEntryIds.length === 0 && !bulkGroupLabel}
                className="btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {(showAdd || editingEntryId) && (
        <div id="racewear-add-panel" ref={addPanelRef} className="card p-6 mb-8 border-brand-red/30">
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
                  ref={!editingEntryId ? addGroupInputRef : undefined}
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
          {groups.map(({ label, entries: groupEntries }) => {
            const allGroupSelected = groupEntries.every((entry) => selectedEntryIdSet.has(entry.id));
            const renameActionKey = `rename:${label}`;
            return (
              <div key={label} data-racewear-group-drop-label={label}>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {renamingGroupLabel === label ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="input-dark min-w-0 flex-1 text-sm"
                        value={renameGroupValue}
                        onChange={(event) => setRenameGroupValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void handleRenameGroup(label);
                          if (event.key === "Escape") {
                            setRenamingGroupLabel(null);
                            setRenameGroupValue("");
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRenameGroup(label)}
                          disabled={!renameGroupValue.trim() || groupAction === renameActionKey}
                          className="btn-primary flex items-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {groupAction === renameActionKey ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Save size={13} />
                          )}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingGroupLabel(null);
                            setRenameGroupValue("");
                          }}
                          className="btn-secondary text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h3 className="font-heading text-sm uppercase tracking-[0.15em] text-brand-red">
                      {label}
                    </h3>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleGroupSelection(groupEntries)}
                      className="inline-flex items-center gap-1.5 border border-surface-600 bg-surface-800 px-3 py-2 text-xs text-text-secondary transition-colors hover:border-surface-500 hover:text-white"
                    >
                      {allGroupSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                      {allGroupSelected ? "Clear group" : "Select group"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRenameGroup(label)}
                      disabled={Boolean(groupAction)}
                      className="inline-flex items-center gap-1.5 border border-surface-600 bg-surface-800 px-3 py-2 text-xs text-text-secondary transition-colors hover:border-surface-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Pencil size={13} />
                      Rename
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {groupEntries.map((entry, index) => {
                    const showDropBefore =
                      draggingEntryId !== entry.id &&
                      dragOverEntry?.id === entry.id &&
                      dragOverEntry.placement === "before";
                    const showDropAfter =
                      draggingEntryId !== entry.id &&
                      dragOverEntry?.id === entry.id &&
                      dragOverEntry.placement === "after";

                    return (
                      <Fragment key={entry.id}>
                        {showDropBefore && <RacewearDropSlot placement="before" />}
                        <div
                          data-racewear-entry-id={entry.id}
                          data-racewear-group-label={entry.group_label}
                          className={`card relative overflow-hidden transition-colors ${
                            !entry.is_active ? "opacity-40" : ""
                          } ${draggingEntryId === entry.id ? "scale-[0.98] opacity-50 ring-1 ring-brand-red" : ""}`}
                        >
                          <button
                            type="button"
                            aria-pressed={selectedEntryIdSet.has(entry.id)}
                            title={selectedEntryIdSet.has(entry.id) ? "Deselect photo" : "Select photo"}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleEntrySelection(entry.id);
                            }}
                            className={`absolute left-2 top-2 z-30 flex h-8 w-8 items-center justify-center border transition-colors ${
                              selectedEntryIdSet.has(entry.id)
                                ? "border-brand-red bg-brand-red text-white"
                                : "border-white/30 bg-black/70 text-white hover:border-brand-red hover:text-brand-red"
                            }`}
                      >
                        {selectedEntryIdSet.has(entry.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    {dragOverEntry?.id === entry.id && (
                      <div
                        className={`pointer-events-none absolute left-0 right-0 z-20 h-1 bg-brand-red ${
                          dragOverEntry.placement === "before" ? "top-0" : "bottom-0"
                        }`}
                      />
                    )}
                    <div
                      data-racewear-drag-handle={entry.id}
                      onPointerDown={(event) => handleEntryPointerDown(event, entry.id)}
                      aria-grabbed={draggingEntryId === entry.id}
                      className="relative aspect-[3/4] cursor-grab touch-none bg-surface-900 active:cursor-grabbing"
                    >
                      <Image
                        src={entry.image_url}
                        alt={entry.alt_text || entry.group_label}
                        fill
                        sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                        draggable={false}
                        className="pointer-events-none select-none object-cover"
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
                          onPointerDown={(event) => handleEntryPointerDown(event, entry.id)}
                          title="Drag to reorder"
                          className="ml-1 cursor-grab touch-none text-text-muted hover:text-white active:cursor-grabbing"
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
                        {showDropAfter && <RacewearDropSlot placement="after" />}
                      </Fragment>
                    );
                  })}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
