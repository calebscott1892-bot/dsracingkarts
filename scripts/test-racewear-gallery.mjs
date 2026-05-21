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
  buildRacewearGroups,
  canDropRacewearEntry,
  reorderRacewearEntries,
  resolveRacewearDragOverEntryId,
  resolveRacewearDraggedEntryId,
  validateRacewearUploadFile,
  validateRacewearUploadFiles,
} = await importTs("../src/lib/racewear-gallery.ts");

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

const crossGroup = reorderRacewearEntries(entries, "b", "other");
assert.deepEqual(crossGroup.updates, [], "dropping across groups should be ignored");

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

console.log("racewear gallery tests passed");
