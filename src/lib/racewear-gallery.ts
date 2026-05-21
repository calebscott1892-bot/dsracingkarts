export interface RacewearGalleryEntry {
  id: string;
  group_label: string;
  sort_order: number;
  created_at: string;
}

export interface RacewearGalleryGroup<T extends RacewearGalleryEntry> {
  label: string;
  entries: T[];
}

export interface RacewearReorderResult<T extends RacewearGalleryEntry> {
  entries: T[];
  groupEntries: T[];
  updates: Array<{ id: string; sort_order: number }>;
}

export type RacewearDropPlacement = "before" | "after";

export interface RacewearUploadFileLike {
  name: string;
  size: number;
  type?: string;
}

export interface RacewearDragDataSource {
  getData(type: string): string;
}

export const RACEWEAR_PHOTOS_BUCKET = "racewear-photos";
export const RACEWEAR_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const RACEWEAR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RACEWEAR_ENTRY_DRAG_MIME = "application/x-dsr-racewear-entry";

const MIME_BY_EXTENSION: Record<string, (typeof RACEWEAR_ALLOWED_MIME_TYPES)[number]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function finiteSortOrder(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeGroupLabel(label: string) {
  return label.trim() || "Ungrouped";
}

export function compareRacewearEntries<T extends RacewearGalleryEntry>(a: T, b: T) {
  return (
    finiteSortOrder(a.sort_order) - finiteSortOrder(b.sort_order) ||
    String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
    a.id.localeCompare(b.id)
  );
}

export function buildRacewearGroups<T extends RacewearGalleryEntry>(
  entries: T[]
): RacewearGalleryGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const entry of [...entries].sort(compareRacewearEntries)) {
    const label = normalizeGroupLabel(entry.group_label);
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  }

  return Array.from(groups, ([label, groupEntries]) => ({
    label,
    entries: groupEntries,
  }));
}

function normalSortValues<T extends RacewearGalleryEntry>(entries: T[]) {
  const values = entries
    .map((entry) => finiteSortOrder(entry.sort_order))
    .sort((a, b) => a - b);
  const start = values[0] ?? 0;
  return entries.map((_, index) => start + index);
}

export function reorderRacewearEntries<T extends RacewearGalleryEntry>(
  entries: T[],
  draggedId: string,
  targetId: string,
  placement: RacewearDropPlacement = "before"
): RacewearReorderResult<T> {
  if (draggedId === targetId) {
    return { entries, groupEntries: [], updates: [] };
  }

  const dragged = entries.find((entry) => entry.id === draggedId);
  const target = entries.find((entry) => entry.id === targetId);
  if (!dragged || !target || normalizeGroupLabel(dragged.group_label) !== normalizeGroupLabel(target.group_label)) {
    return { entries, groupEntries: [], updates: [] };
  }

  const peers = entries
    .filter((entry) => normalizeGroupLabel(entry.group_label) === normalizeGroupLabel(dragged.group_label))
    .sort(compareRacewearEntries);
  const withoutDragged = peers.filter((entry) => entry.id !== draggedId);
  const targetIndex = withoutDragged.findIndex((entry) => entry.id === targetId);
  if (targetIndex === -1) {
    return { entries, groupEntries: [], updates: [] };
  }

  const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
  const reorderedPeers = [
    ...withoutDragged.slice(0, insertIndex),
    dragged,
    ...withoutDragged.slice(insertIndex),
  ];
  const sortValues = normalSortValues(peers);
  const updates = reorderedPeers.map((entry, index) => ({
    id: entry.id,
    sort_order: sortValues[index],
  }));
  const sortById = new Map(updates.map((update) => [update.id, update.sort_order]));
  const nextEntries = entries
    .map((entry) => {
      const nextSortOrder = sortById.get(entry.id);
      return nextSortOrder === undefined ? entry : { ...entry, sort_order: nextSortOrder };
    })
    .sort(compareRacewearEntries);

  return {
    entries: nextEntries,
    groupEntries: reorderedPeers.map((entry, index) => ({ ...entry, sort_order: sortValues[index] })),
    updates,
  };
}

export function canDropRacewearEntry(draggedId: string | null | undefined, targetId: string) {
  return Boolean(draggedId && draggedId !== targetId);
}

export function resolveRacewearDragOverEntryId(activeId: string | null | undefined) {
  return activeId?.trim() ?? "";
}

export function resolveRacewearDraggedEntryId(
  activeId: string | null | undefined,
  dataTransfer?: RacewearDragDataSource
) {
  const stateId = activeId?.trim();
  if (stateId) return stateId;

  const customId = dataTransfer?.getData(RACEWEAR_ENTRY_DRAG_MIME).trim();
  if (customId) return customId;

  return dataTransfer?.getData("text/plain").trim() ?? "";
}

export function getRacewearUploadExtension(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpeg") return "jpg";
  return MIME_BY_EXTENSION[ext] ? ext : "";
}

export function getRacewearUploadContentType(file: RacewearUploadFileLike) {
  const explicitType = (file.type ?? "").toLowerCase();
  if (RACEWEAR_ALLOWED_MIME_TYPES.includes(explicitType as (typeof RACEWEAR_ALLOWED_MIME_TYPES)[number])) {
    return explicitType as (typeof RACEWEAR_ALLOWED_MIME_TYPES)[number];
  }

  const ext = getRacewearUploadExtension(file.name);
  return ext ? MIME_BY_EXTENSION[ext] : undefined;
}

export function validateRacewearUploadFile(file: RacewearUploadFileLike) {
  if (file.size > RACEWEAR_MAX_FILE_SIZE) {
    return { ok: false as const, error: "Photo must be under 10 MB." };
  }

  const contentType = getRacewearUploadContentType(file);
  if (!contentType) {
    return { ok: false as const, error: "Only JPG, PNG or WebP accepted." };
  }

  const extension = getRacewearUploadExtension(file.name) || (contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg");
  return { ok: true as const, contentType, extension };
}

export function validateRacewearUploadFiles(files: RacewearUploadFileLike[]) {
  if (files.length === 0) {
    return { ok: false as const, error: "Please select at least one photo." };
  }

  for (const file of files) {
    const result = validateRacewearUploadFile(file);
    if (!result.ok) return result;
  }

  return { ok: true as const };
}
