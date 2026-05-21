#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/layout/HeroVideo.tsx", import.meta.url), "utf8");

assert.equal(
  source.includes('"/images/history/Header.jpg"'),
  false,
  "homepage hero rotation should not include the fourth post-video header image"
);

assert.equal(
  source.includes('"/images/history/Header 2.jpg"'),
  true,
  "homepage hero rotation should restore the previously removed header image"
);

console.log("homepage hero media tests passed");
