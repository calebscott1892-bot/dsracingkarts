#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shopLinksSource = await readFile(
  new URL("../src/lib/shop-links.ts", import.meta.url),
  "utf8"
);
const shopPageSource = await readFile(
  new URL("../src/app/shop/page.tsx", import.meta.url),
  "utf8"
);

assert.match(
  shopLinksSource,
  /CHASSIS_CATEGORY_SLUG\s*=\s*"chassis-2"/,
  "chassis links should use the live Square category slug"
);

assert.match(
  shopPageSource,
  /function\s+findCategoryByParam/,
  "shop page should keep a category param fallback for legacy links"
);

assert.match(
  shopPageSource,
  /slugifyCategoryName\(category\.name\)\s*===\s*categoryParam/,
  "legacy /shop?category=chassis should resolve by category name"
);

console.log("shop chassis link tests passed");
