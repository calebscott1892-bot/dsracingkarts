#!/usr/bin/env node
/**
 * One-off helper: print the parent path for a Square category id, so we
 * can tell whether two same-named categories are actually distinct (e.g.
 * Sticker Kits → IPK vs Engines & Accessories → IPK) or true duplicates.
 *
 * Usage: node scripts/inspect-square-category.js <square_id> [<square_id> …]
 */
import { Client, Environment } from "square";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("Usage: node scripts/inspect-square-category.js <square_id> [<square_id> …]");
  process.exit(1);
}

async function describe(id) {
  try {
    const { result } = await square.catalogApi.retrieveCatalogObject(id, false);
    const obj = result.object;
    if (!obj || obj.type !== "CATEGORY") {
      console.log(`${id}: not a CATEGORY (got ${obj?.type || "nothing"})`);
      return;
    }
    const data = obj.categoryData || {};
    console.log(`\nSquare category ${id}`);
    console.log(`  name              : ${data.name}`);
    console.log(`  parent_category   : ${data.parentCategory?.id || "(top level)"}`);
    if (data.pathToRoot) {
      console.log(
        `  path_to_root      : ${data.pathToRoot
          .map((p) => p.categoryName || p.categoryId)
          .join(" → ")}`
      );
    }
    console.log(`  category_type     : ${data.categoryType || "(default)"}`);
    console.log(`  is_top_level      : ${data.isTopLevel ?? "(unset)"}`);
  } catch (err) {
    console.error(`${id}: ${err?.message || err}`);
  }
}

for (const id of ids) {
  // eslint-disable-next-line no-await-in-loop
  await describe(id);
}
