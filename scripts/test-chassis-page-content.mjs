#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/chassis-page-content.ts", import.meta.url),
  "utf8"
);

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const {
  DEFAULT_CHASSIS_PAGE_CONTENT,
  mergeChassisPageContent,
  sanitizeChassisPageContentInput,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const merged = mergeChassisPageContent({
  hero_title: "  Custom  ",
  hero_accent: "",
  featured_image_url: "",
});

assert.equal(merged.hero_title, "Custom");
assert.equal(
  merged.hero_accent,
  DEFAULT_CHASSIS_PAGE_CONTENT.hero_accent,
  "blank admin strings should fall back to default content"
);
assert.equal(
  merged.featured_image_url,
  DEFAULT_CHASSIS_PAGE_CONTENT.featured_image_url,
  "blank image URLs should fall back to the current chassis image"
);

const sanitized = sanitizeChassisPageContentInput({
  hero_body: ` ${"x".repeat(500)} `,
});

assert.equal(sanitized.hero_body.length, 400);

console.log("chassis page content tests passed");
