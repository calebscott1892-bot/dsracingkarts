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
const shopViewSource = await readFile(
  new URL("../src/components/shop/ShopPageView.tsx", import.meta.url),
  "utf8"
);
const categoryPageSource = await readFile(
  new URL("../src/app/shop/[category]/page.tsx", import.meta.url),
  "utf8"
);

assert.match(
  shopLinksSource,
  /CHASSIS_CATEGORY_SLUG\s*=\s*"chassis-2"/,
  "chassis links should use the live Square category slug"
);

assert.match(
  shopLinksSource,
  /return\s+`\/shop\/\$\{encodeURIComponent\(slug\)\}`/,
  "category links should point at the /shop/<slug> path routes"
);

assert.match(
  shopPageSource,
  /permanentRedirect\(`\/shop\/\$\{encodeURIComponent\(params\.category\)\}/,
  "legacy /shop?category= links should permanently redirect to /shop/<slug>"
);

assert.match(
  shopViewSource,
  /export\s+function\s+findCategoryByParam/,
  "shop view should keep a category param fallback for legacy links"
);

assert.match(
  shopViewSource,
  /slugifyCategoryName\(category\.name\)\s*===\s*categoryParam/,
  "legacy /shop/chassis should resolve by category name"
);

assert.match(
  categoryPageSource,
  /findCategoryByParam/,
  "category route should resolve params through the shared lookup"
);

console.log("shop chassis link tests passed");
