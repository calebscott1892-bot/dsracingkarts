#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/category-assignment-queue.ts", import.meta.url),
  "utf8"
);

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const {
  buildCurrentCategoryAssignmentQueue,
  summarizeCategoryAssignmentQueue,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const rows = [
  {
    id: "old-pending",
    product_id: "product-1",
    status: "pending",
    confidence: 0.9,
    created_at: "2026-05-06T00:00:00.000Z",
  },
  {
    id: "newer-rejected",
    product_id: "product-1",
    status: "rejected",
    confidence: 0.1,
    created_at: "2026-05-14T00:00:00.000Z",
  },
  {
    id: "current-approved",
    product_id: "product-2",
    status: "approved",
    confidence: 0.45,
    created_at: "2026-05-08T00:00:00.000Z",
  },
  {
    id: "old-applied",
    product_id: "product-2",
    status: "applied",
    confidence: 0.95,
    created_at: "2026-05-07T00:00:00.000Z",
  },
  {
    id: "not-current",
    product_id: "product-3",
    status: "pending",
    confidence: 0.8,
    created_at: "2026-05-15T00:00:00.000Z",
  },
];

const queue = buildCurrentCategoryAssignmentQueue(rows, ["product-1", "product-2"]);

assert.deepEqual(
  queue.map((row) => row.id),
  ["current-approved", "newer-rejected"],
  "queue should show the newest open suggestion for each currently uncategorised product"
);

assert.deepEqual(summarizeCategoryAssignmentQueue(queue), {
  total: 2,
  pending: 0,
  approved: 1,
  rejected: 1,
  applied: 0,
  skipped: 0,
  reverted: 0,
  high: 0,
  medium: 1,
  low: 1,
  no_match: 0,
});

console.log("category assignment queue tests passed");
