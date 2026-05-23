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
  updates: Array<{ id: string; sort_order: number; group_label?: string }>;
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

export interface RacewearDropItem<T extends RacewearUploadFileLike> {
  kind?: string;
  getAsFile?: () => T | null;
}

export interface RacewearDropDataTransfer<T extends RacewearUploadFileLike> {
  files?: ArrayLike<T>;
  items?: ArrayLike<RacewearDropItem<T>>;
}

export interface RacewearAutoScrollInput {
  pointerY: number;
  viewportTop: number;
  viewportBottom: number;
  edgeSize?: number;
  maxSpeed?: number;
}

export const RACEWEAR_PHOTOS_BUCKET = "racewear-photos";
export const RACEWEAR_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const RACEWEAR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RACEWEAR_ENTRY_DRAG_MIME = "application/x-dsr-racewear-entry";
export const RACEWEAR_DEFAULT_IS_FEATURED = true;
export const RACEWEAR_GENERIC_GROUP_LABEL = "racewear gallery";

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

function isRacewearUploadFileLike<T extends RacewearUploadFileLike>(value: unknown): value is T {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    typeof (value as RacewearUploadFileLike).name === "string" &&
    typeof (value as RacewearUploadFileLike).size === "number"
  );
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

function normalSortValues<T extends RacewearGalleryEntry>(entries: T[], count = entries.length) {
  const values = entries
    .map((entry) => finiteSortOrder(entry.sort_order))
    .sort((a, b) => a - b);
  const start = values[0] ?? 0;
  return Array.from({ length: count }, (_, index) => start + index);
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
  if (!dragged || !target) {
    return { entries, groupEntries: [], updates: [] };
  }

  const sourceLabel = normalizeGroupLabel(dragged.group_label);
  const targetLabel = normalizeGroupLabel(target.group_label);
  const isCrossGroupMove = sourceLabel !== targetLabel;
  const targetPeers = entries
    .filter((entry) => normalizeGroupLabel(entry.group_label) === targetLabel && entry.id !== draggedId)
    .sort(compareRacewearEntries);
  const targetIndex = targetPeers.findIndex((entry) => entry.id === targetId);
  if (targetIndex === -1) {
    return { entries, groupEntries: [], updates: [] };
  }

  const movedEntry = isCrossGroupMove ? { ...dragged, group_label: target.group_label } : dragged;
  const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
  const reorderedTargetPeers = [
    ...targetPeers.slice(0, insertIndex),
    movedEntry,
    ...targetPeers.slice(insertIndex),
  ];
  const targetSortBase = isCrossGroupMove
    ? targetPeers
    : entries.filter((entry) => normalizeGroupLabel(entry.group_label) === targetLabel);
  const targetSortValues = normalSortValues(targetSortBase, reorderedTargetPeers.length);
  const targetUpdates: RacewearReorderResult<T>["updates"] = reorderedTargetPeers.map((entry, index) => ({
    id: entry.id,
    sort_order: targetSortValues[index],
    ...(entry.id === draggedId && isCrossGroupMove ? { group_label: target.group_label } : {}),
  }));
  const sourcePeers = isCrossGroupMove
    ? entries
        .filter((entry) => normalizeGroupLabel(entry.group_label) === sourceLabel && entry.id !== draggedId)
        .sort(compareRacewearEntries)
    : [];
  const sourceSortValues = normalSortValues(sourcePeers);
  const sourceUpdates: RacewearReorderResult<T>["updates"] = sourcePeers.map((entry, index) => ({
    id: entry.id,
    sort_order: sourceSortValues[index],
  }));
  const updates = [...targetUpdates, ...sourceUpdates];
  const updatesById = new Map(updates.map((update) => [update.id, update]));
  const nextEntries = entries
    .map((entry) => {
      const update = updatesById.get(entry.id);
      return update === undefined
        ? entry
        : {
            ...entry,
            sort_order: update.sort_order,
            ...(update.group_label !== undefined ? { group_label: update.group_label } : {}),
          };
    })
    .sort(compareRacewearEntries);

  return {
    entries: nextEntries,
    groupEntries: reorderedTargetPeers.map((entry, index) => ({
      ...entry,
      sort_order: targetSortValues[index],
    })),
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

export function resolveRacewearFeaturedFlag(
  value: unknown,
  fallback = RACEWEAR_DEFAULT_IS_FEATURED
) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  if (["false", "0", "off", "no"].includes(normalized)) return false;

  return Boolean(value);
}

export function shouldFeatureRacewearGroupByDefault(groupLabel: string) {
  const normalized = groupLabel.trim().toLowerCase();
  return Boolean(normalized && normalized !== RACEWEAR_GENERIC_GROUP_LABEL);
}

export function extractRacewearDroppedFiles<T extends RacewearUploadFileLike>(
  dataTransfer: RacewearDropDataTransfer<T>
) {
  const files = Array.from(dataTransfer.files ?? []).filter(isRacewearUploadFileLike<T>);
  if (files.length > 0) return files;

  return Array.from(dataTransfer.items ?? [])
    .filter((item) => !item.kind || item.kind === "file")
    .map((item) => item.getAsFile?.() ?? null)
    .filter(isRacewearUploadFileLike<T>);
}

export function getRacewearAutoScrollDelta({
  pointerY,
  viewportTop,
  viewportBottom,
  edgeSize = 96,
  maxSpeed = 28,
}: RacewearAutoScrollInput) {
  if (
    !Number.isFinite(pointerY) ||
    !Number.isFinite(viewportTop) ||
    !Number.isFinite(viewportBottom) ||
    viewportBottom <= viewportTop
  ) {
    return 0;
  }

  const safeEdgeSize = Math.max(1, edgeSize);
  const safeMaxSpeed = Math.max(0, maxSpeed);
  const topEdge = viewportTop + safeEdgeSize;
  const bottomEdge = viewportBottom - safeEdgeSize;

  if (pointerY < topEdge) {
    const distanceIntoEdge = Math.min(safeEdgeSize, topEdge - pointerY);
    return -Math.round((distanceIntoEdge / safeEdgeSize) * safeMaxSpeed);
  }

  if (pointerY > bottomEdge) {
    const distanceIntoEdge = Math.min(safeEdgeSize, pointerY - bottomEdge);
    return Math.round((distanceIntoEdge / safeEdgeSize) * safeMaxSpeed);
  }

  return 0;
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
