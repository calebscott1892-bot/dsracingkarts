#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

async function importTs(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = new URL("../.tmp/test-modules/", import.meta.url);
  await mkdir(outputDir, { recursive: true });
  const outputFile = new URL(`${relativePath.replace(/[^a-z0-9]/gi, "_")}.mjs`, outputDir);
  await writeFile(outputFile, outputText);
  return import(outputFile.href);
}

const {
  RACEWEAR_ENTRY_DRAG_MIME,
  buildRacewearReorderBatchRows,
  buildRacewearGroups,
  canDropRacewearEntry,
  extractRacewearDroppedFiles,
  getRacewearAutoScrollDelta,
  getRacewearDropPlacement,
  moveRacewearEntriesToGroup,
  parseRacewearReorderUpdates,
  resolveRacewearFeaturedFlag,
  reorderRacewearEntries,
  renameRacewearGroup,
  resolveRacewearDragOverEntryId,
  resolveRacewearDraggedEntryId,
  shouldFeatureRacewearGroupByDefault,
  validateRacewearUploadFile,
  validateRacewearUploadFiles,
} = await importTs("../src/lib/racewear-gallery.ts");

const parsedReorder = parseRacewearReorderUpdates([
  { id: " photo-1 ", sort_order: "12", group_label: " PM (Polaris Marine) " },
  { id: "photo-2", sort_order: 13 },
]);
assert.deepEqual(
  parsedReorder,
  {
    ok: true,
    updates: [
      { id: "photo-1", sort_order: 12, group_label: "PM (Polaris Marine)" },
      { id: "photo-2", sort_order: 13 },
    ],
  },
  "racewear reorder payloads should be normalised before database writes"
);
assert.deepEqual(
  parseRacewearReorderUpdates([{ id: "photo-1", sort_order: 1 }, { id: "photo-1", sort_order: 2 }]),
  { ok: false, error: "entry ids must be unique" },
  "racewear reorder payloads should reject duplicate photo ids"
);

const batchRows = buildRacewearReorderBatchRows(
  [
    { id: "photo-1", sort_order: 12, group_label: "PM (Polaris Marine)" },
    { id: "photo-2", sort_order: 13 },
  ],
  [
    { id: "photo-1", group_label: "Old PM", image_url: "/racewear/photo-1.jpg" },
    { id: "photo-2", group_label: "NCR", image_url: "/racewear/photo-2.jpg" },
  ]
);
assert.deepEqual(
  batchRows,
  {
    ok: true,
    rows: [
      {
        id: "photo-1",
        sort_order: 12,
        group_label: "PM (Polaris Marine)",
        image_url: "/racewear/photo-1.jpg",
      },
      { id: "photo-2", sort_order: 13, group_label: "NCR", image_url: "/racewear/photo-2.jpg" },
    ],
  },
  "batch reorder rows should include required database fields so one upsert can save the whole move"
);
assert.deepEqual(
  buildRacewearReorderBatchRows([{ id: "missing", sort_order: 1 }], []),
  { ok: false, error: "Racewear photo missing was not found." },
  "batch reorder rows should reject unknown ids instead of attempting partial saves"
);

const entries = [
  { id: "b", group_label: "CM Racing", sort_order: 2, created_at: "2026-05-18T02:00:00.000Z" },
  { id: "other", group_label: "Another Team", sort_order: 1, created_at: "2026-05-18T01:00:00.000Z" },
  { id: "a", group_label: "CM Racing", sort_order: 0, created_at: "2026-05-18T00:00:00.000Z" },
  { id: "c", group_label: "CM Racing", sort_order: 2, created_at: "2026-05-18T01:00:00.000Z" },
];

const groups = buildRacewearGroups(entries);
assert.deepEqual(
  groups.map((group) => [group.label, group.entries.map((entry) => entry.id)]),
  [
    ["CM Racing", ["a", "c", "b"]],
    ["Another Team", ["other"]],
  ],
  "groups should keep each client together and sort photos inside the group"
);

const reorder = reorderRacewearEntries(entries, "b", "a");
assert.deepEqual(
  reorder.groupEntries.map((entry) => [entry.id, entry.sort_order]),
  [
    ["b", 0],
    ["a", 1],
    ["c", 2],
  ],
  "dragging an item onto another item should move it before the drop target and normalise group order"
);
assert.deepEqual(
  reorder.updates,
  [
    { id: "b", sort_order: 0 },
    { id: "a", sort_order: 1 },
    { id: "c", sort_order: 2 },
  ],
  "only entries in the affected group should be persisted"
);
assert.deepEqual(
  reorder.entries.filter((entry) => entry.group_label === "Another Team").map((entry) => entry.id),
  ["other"],
  "drag ordering should not move photos between groups"
);

const reorderAfter = reorderRacewearEntries(entries, "a", "c", "after");
assert.deepEqual(
  reorderAfter.groupEntries.map((entry) => [entry.id, entry.sort_order]),
  [
    ["c", 0],
    ["a", 1],
    ["b", 2],
  ],
  "dropping on the lower half of a photo should move the dragged photo after the drop target"
);

const crossGroup = reorderRacewearEntries(entries, "b", "other", "after");
assert.deepEqual(
  buildRacewearGroups(crossGroup.entries).map((group) => [group.label, group.entries.map((entry) => entry.id)]),
  [
    ["CM Racing", ["a", "c"]],
    ["Another Team", ["other", "b"]],
  ],
  "dropping onto another client group should move the photo into that group and shuffle both groups into display order"
);
assert.deepEqual(
  crossGroup.entries.find((entry) => entry.id === "b")?.group_label,
  "Another Team",
  "moving a photo across groups should update its category label"
);
assert.deepEqual(
  crossGroup.updates,
  [
    { id: "other", sort_order: 1 },
    { id: "b", sort_order: 2, group_label: "Another Team" },
    { id: "a", sort_order: 0 },
    { id: "c", sort_order: 1 },
  ],
  "cross-group drops should persist the target category plus normalized source and target order"
);

const categoryMoveEntries = [
  { id: "source", group_label: "Source Team", sort_order: 20, created_at: "2026-05-18T00:00:00.000Z" },
  { id: "source-peer", group_label: "Source Team", sort_order: 21, created_at: "2026-05-18T01:00:00.000Z" },
  { id: "x", group_label: "Target Team", sort_order: 10, created_at: "2026-05-18T00:00:00.000Z" },
  { id: "y", group_label: "Target Team", sort_order: 11, created_at: "2026-05-18T01:00:00.000Z" },
  { id: "z", group_label: "Target Team", sort_order: 12, created_at: "2026-05-18T02:00:00.000Z" },
];
const crossGroupBetween = reorderRacewearEntries(categoryMoveEntries, "source", "y", "before");
assert.deepEqual(
  buildRacewearGroups(crossGroupBetween.entries).map((group) => [group.label, group.entries.map((entry) => entry.id)]),
  [
    ["Target Team", ["x", "source", "y", "z"]],
    ["Source Team", ["source-peer"]],
  ],
  "dropping before a target image should insert the moved photo between the target group's neighboring photos"
);
assert.deepEqual(
  crossGroupBetween.updates,
  [
    { id: "x", sort_order: 10 },
    { id: "source", sort_order: 11, group_label: "Target Team" },
    { id: "y", sort_order: 12 },
    { id: "z", sort_order: 13 },
    { id: "source-peer", sort_order: 21 },
  ],
  "cross-group insertion should shift later target photos over and keep remaining source photos ordered"
);

const bulkGroupMove = moveRacewearEntriesToGroup(
  [
    { id: "pm-design", group_label: "Unsorted", sort_order: 0, created_at: "2026-05-18T00:00:00.000Z" },
    { id: "ncr-design", group_label: "NCR", sort_order: 1, created_at: "2026-05-18T01:00:00.000Z" },
    { id: "pm-finished", group_label: "Mixed", sort_order: 2, created_at: "2026-05-18T02:00:00.000Z" },
    { id: "pm-boots", group_label: "Polaris Marine", sort_order: 10, created_at: "2026-05-18T03:00:00.000Z" },
  ],
  ["pm-finished", "pm-design"],
  "Polaris Marine"
);
assert.deepEqual(
  buildRacewearGroups(bulkGroupMove.entries).map((group) => [group.label, group.entries.map((entry) => entry.id)]),
  [
    ["NCR", ["ncr-design"]],
    ["Polaris Marine", ["pm-boots", "pm-design", "pm-finished"]],
  ],
  "bulk group moves should move selected photos into the requested category while preserving their display order"
);
assert.deepEqual(
  bulkGroupMove.updates,
  [
    { id: "pm-boots", sort_order: 10 },
    { id: "pm-design", sort_order: 11, group_label: "Polaris Marine" },
    { id: "pm-finished", sort_order: 12, group_label: "Polaris Marine" },
  ],
  "bulk group moves should persist the target category and shifted order for the moved set"
);

const renamedGroup = renameRacewearGroup(
  [
    { id: "pm-design", group_label: "PM", sort_order: 0, created_at: "2026-05-18T00:00:00.000Z" },
    { id: "pm-finished", group_label: "PM", sort_order: 1, created_at: "2026-05-18T01:00:00.000Z" },
    { id: "ncr-design", group_label: "NCR", sort_order: 2, created_at: "2026-05-18T02:00:00.000Z" },
  ],
  "PM",
  "PM (Polaris Marine)"
);
assert.deepEqual(
  buildRacewearGroups(renamedGroup.entries).map((group) => [group.label, group.entries.map((entry) => entry.id)]),
  [
    ["PM (Polaris Marine)", ["pm-design", "pm-finished"]],
    ["NCR", ["ncr-design"]],
  ],
  "renaming a group should update every photo in that category without splitting the set"
);
assert.deepEqual(
  renamedGroup.updates,
  [
    { id: "pm-design", sort_order: 0, group_label: "PM (Polaris Marine)" },
    { id: "pm-finished", sort_order: 1, group_label: "PM (Polaris Marine)" },
  ],
  "renaming a group should persist the new category label for each affected photo"
);

assert.equal(canDropRacewearEntry("b", "a"), true, "a dragged racewear entry can drop on another entry");
assert.equal(canDropRacewearEntry("b", "b"), false, "a dragged racewear entry cannot drop on itself");
assert.equal(canDropRacewearEntry("", "a"), false, "a missing dragged entry id cannot create a drop target");
assert.equal(
  typeof resolveRacewearDragOverEntryId,
  "function",
  "dragover handling should use rendered drag state instead of reading protected drop payload data"
);
assert.equal(
  resolveRacewearDragOverEntryId("b"),
  "b",
  "dragover handling should accept the active in-memory drag id"
);
assert.equal(
  resolveRacewearDragOverEntryId("  "),
  "",
  "dragover handling should not invent a drop target when there is no active drag id"
);

const dragData = new Map([
  [RACEWEAR_ENTRY_DRAG_MIME, "b"],
  ["text/plain", "plain-fallback"],
]);
assert.equal(
  resolveRacewearDraggedEntryId(null, { getData: (type) => dragData.get(type) ?? "" }),
  "b",
  "drop handling should recover the dragged entry id from the custom drag payload"
);
assert.equal(
  resolveRacewearDraggedEntryId(null, { getData: (type) => (type === "text/plain" ? "plain-fallback" : "") }),
  "plain-fallback",
  "drop handling should fall back to text/plain for older drags"
);
assert.equal(
  resolveRacewearDraggedEntryId("state-id", { getData: () => "payload-id" }),
  "state-id",
  "rendered drag state should take precedence when it is available"
);

assert.deepEqual(validateRacewearUploadFile({ name: "front.JPG", size: 2000, type: "" }), {
  ok: true,
  contentType: "image/jpeg",
  extension: "jpg",
});
assert.deepEqual(validateRacewearUploadFile({ name: "kit.gif", size: 2000, type: "image/gif" }), {
  ok: false,
  error: "Only JPG, PNG or WebP accepted.",
});
assert.deepEqual(validateRacewearUploadFile({ name: "huge.webp", size: 11 * 1024 * 1024, type: "image/webp" }), {
  ok: false,
  error: "Photo must be under 10 MB.",
});
assert.deepEqual(validateRacewearUploadFiles([]), {
  ok: false,
  error: "Please select at least one photo.",
});

assert.equal(
  resolveRacewearFeaturedFlag(undefined),
  true,
  "new admin racewear uploads should be featured on the Services page unless explicitly switched off"
);
assert.equal(
  resolveRacewearFeaturedFlag(null),
  true,
  "missing multipart featured values should default to visible on the Services page"
);
assert.equal(resolveRacewearFeaturedFlag("false"), false, "an explicit off toggle should stay off");
assert.equal(resolveRacewearFeaturedFlag(false), false, "an explicit JSON false should stay off");
assert.equal(resolveRacewearFeaturedFlag("on"), true, "browser form on values should be treated as featured");

assert.equal(
  shouldFeatureRacewearGroupByDefault("Cathleen Thompson"),
  true,
  "named client groups should default to featured"
);
assert.equal(
  shouldFeatureRacewearGroupByDefault("Racewear Gallery"),
  false,
  "the generic bulk gallery group should remain See More only by default"
);

const droppedViaFiles = extractRacewearDroppedFiles({
  files: [
    { name: "front.jpg", size: 2000, type: "image/jpeg" },
    { name: "notes.txt", size: 100, type: "text/plain" },
  ],
});
assert.deepEqual(
  droppedViaFiles.map((file) => file.name),
  ["front.jpg", "notes.txt"],
  "native file drops should use DataTransfer.files when the browser populates it"
);

const droppedViaItems = extractRacewearDroppedFiles({
  files: [],
  items: [
    { kind: "string", getAsFile: () => null },
    { kind: "file", getAsFile: () => ({ name: "side.png", size: 2000, type: "image/png" }) },
    { kind: "file", getAsFile: () => null },
  ],
});
assert.deepEqual(
  droppedViaItems.map((file) => file.name),
  ["side.png"],
  "drag/drop uploads should fall back to DataTransfer.items when files is empty"
);

assert.equal(
  typeof getRacewearAutoScrollDelta,
  "function",
  "racewear drag/drop should expose edge auto-scroll calculation"
);
assert.equal(
  getRacewearAutoScrollDelta({
    pointerY: 14,
    viewportTop: 0,
    viewportBottom: 600,
    edgeSize: 100,
    maxSpeed: 30,
  }),
  -26,
  "dragging near the top edge should scroll upward"
);
assert.equal(
  getRacewearAutoScrollDelta({
    pointerY: 586,
    viewportTop: 0,
    viewportBottom: 600,
    edgeSize: 100,
    maxSpeed: 30,
  }),
  26,
  "dragging near the bottom edge should scroll downward"
);
assert.equal(
  getRacewearAutoScrollDelta({
    pointerY: 300,
    viewportTop: 0,
    viewportBottom: 600,
    edgeSize: 100,
    maxSpeed: 30,
  }),
  0,
  "dragging in the middle of the viewport should not auto-scroll"
);

assert.equal(
  getRacewearDropPlacement({
    clientX: 175,
    clientY: 150,
    rect: { left: 100, top: 100, width: 100, height: 150 },
  }),
  "after",
  "desktop grid drops on the right half of a photo should insert after that photo"
);
assert.equal(
  getRacewearDropPlacement({
    clientX: 125,
    clientY: 150,
    rect: { left: 100, top: 100, width: 100, height: 150 },
  }),
  "before",
  "desktop grid drops on the left half of a photo should insert before that photo"
);
assert.equal(
  getRacewearDropPlacement({
    clientX: 150,
    clientY: 235,
    rect: { left: 100, top: 100, width: 100, height: 150 },
  }),
  "after",
  "drops near the bottom edge should still insert after when the vertical intent is clearer"
);
assert.equal(
  getRacewearDropPlacement({
    clientX: 175,
    clientY: 105,
    rect: { left: 100, top: 100, width: 100, height: 150 },
  }),
  "after",
  "desktop grid drops on the right side should insert after even near the top edge"
);

console.log("racewear gallery tests passed");
