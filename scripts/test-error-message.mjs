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

const { toErrorMessage } = await importTs("../src/lib/error-message.ts");

assert.equal(toErrorMessage("  plain failure  ", "fallback"), "plain failure");
assert.equal(toErrorMessage(null, "fallback"), "fallback");
assert.equal(toErrorMessage({ code: "BAD_REQUEST", message: "Invalid catalog item" }, "fallback"), "Invalid catalog item");
assert.equal(
  toErrorMessage(
    {
      body: {
        errors: [
          { code: "INVALID_VALUE", detail: "SKU must be unique" },
          { code: "BAD_REQUEST", detail: "Catalog object is invalid" },
        ],
      },
    },
    "fallback"
  ),
  "SKU must be unique | Catalog object is invalid"
);
assert.equal(
  toErrorMessage(
    {
      body: JSON.stringify({
        errors: [{ code: "NOT_FOUND", detail: "Catalog item was not found" }],
      }),
    },
    "fallback"
  ),
  "Catalog item was not found"
);

const structuredReactCrashPayload = {
  width: 20,
  keys: ["code", "message"],
  code: "SYNC_FAILED",
  message: { detail: "Structured error object should become text" },
};
assert.equal(
  toErrorMessage(structuredReactCrashPayload, "fallback"),
  "Structured error object should become text"
);

const circular = [];
circular.push(circular);
assert.equal(toErrorMessage(circular, "fallback"), "fallback");

console.log("error message tests passed");
