#!/usr/bin/env node

/**
 * Reconcile category assignments between Supabase and Square.
 *
 * For every product that exists on both sides, compare:
 *   - the categories Supabase has assigned (`product_categories`)
 *   - the categories Square has on the item (`itemData.categories[]`)
 *
 * Reports four buckets:
 *   1. fully_in_sync           — both sides agree
 *   2. site_has_extra          — local categories that Square is missing
 *                                (need to be pushed back, otherwise the
 *                                 next full Square→site resync will wipe
 *                                 them)
 *   3. square_has_extra        — Square categories not yet in Supabase
 *                                (a normal resync will catch these up,
 *                                 but the report flags how many are
 *                                 currently behind)
 *   4. both_have_unique        — each side has categories the other
 *                                doesn't; manual review needed
 *
 * Also detects:
 *   - products in Supabase with `square_token` that no longer exist in
 *     Square (already handled by archiveProductsMissingFromSquare, but
 *     this surfaces them in the report)
 *   - products in Supabase with no `square_token` (created locally but
 *     never pushed)
 *   - categories in Supabase with no `square_id` (locally-created
 *     categories — assignments to these CANNOT be pushed to Square at
 *     all and need attention)
 *
 * Usage:
 *   node scripts/reconcile-categories-square.js
 *   node scripts/reconcile-categories-square.js --csv > drift.csv
 *   node scripts/reconcile-categories-square.js --push-site-extras
 *
 * --push-site-extras: actually pushes the "site_has_extra" categories to
 * Square (idempotent). Run with --csv first to see what it would change.
 */

import { createClient } from "@supabase/supabase-js";
import { Client, Environment } from "square";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN;

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!SQUARE_TOKEN) missing.push("SQUARE_ACCESS_TOKEN");
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const asCsv = process.argv.includes("--csv");
const pushSiteExtras = process.argv.includes("--push-site-extras");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const square = new Client({
  accessToken: SQUARE_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

async function fetchAll(table, select, filter) {
  const all = [];
  const page = 1000;
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + page - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return all;
}

async function fetchAllSquareItems() {
  const items = [];
  let cursor;
  do {
    const { result } = await square.catalogApi.searchCatalogObjects({
      cursor,
      objectTypes: ["ITEM"],
      limit: 1000,
      includeRelatedObjects: false,
    });
    if (result.objects) items.push(...result.objects);
    cursor = result.cursor;
  } while (cursor);
  return items;
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  if (!asCsv) {
    console.log("\nReconciling categories between Supabase and Square…\n");
  }

  // 1. Pull everything we need from Supabase.
  const [products, categories, productCategories] = await Promise.all([
    fetchAll(
      "products",
      "id, name, square_token, status",
      (q) => q.eq("status", "active")
    ),
    fetchAll("categories", "id, name, square_id"),
    fetchAll("product_categories", "product_id, category_id"),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Square category id (string) -> local category record. Used to convert
  // Square's view of each item into a comparable list of local UUIDs.
  const categoryBySquareId = new Map();
  for (const c of categories) {
    if (c.square_id) categoryBySquareId.set(c.square_id, c);
  }

  // Local product UUID -> set of local category UUIDs.
  const localCategoriesByProduct = new Map();
  for (const link of productCategories) {
    if (!localCategoriesByProduct.has(link.product_id)) {
      localCategoriesByProduct.set(link.product_id, new Set());
    }
    localCategoriesByProduct.get(link.product_id).add(link.category_id);
  }

  // 2. Pull everything from Square.
  if (!asCsv) console.log("Fetching Square catalog…");
  const squareItems = await fetchAllSquareItems();
  if (!asCsv) console.log(`Found ${squareItems.length} Square items.\n`);
  const squareByToken = new Map(squareItems.map((item) => [item.id, item]));

  // 3. Walk each Supabase product with a square_token and compare.
  const fully_in_sync = [];
  const site_has_extra = []; // local has categories Square is missing
  const square_has_extra = []; // Square has categories Supabase is missing
  const both_have_unique = [];
  const missing_in_square = []; // active locally, gone from Square
  const local_only_categories = new Set(); // category UUIDs lacking square_id
  const products_without_token = [];

  for (const product of products) {
    if (!product.square_token) {
      products_without_token.push(product);
      continue;
    }
    const squareItem = squareByToken.get(product.square_token);
    if (!squareItem) {
      missing_in_square.push(product);
      continue;
    }

    const localCatIds = localCategoriesByProduct.get(product.id) || new Set();
    const squareCatIds = new Set();
    const squareSquareIds = new Set();
    const squareCatList = squareItem.itemData?.categories || [];
    if (squareItem.itemData?.categoryId) {
      squareSquareIds.add(squareItem.itemData.categoryId);
    }
    for (const c of squareCatList) {
      if (c?.id) squareSquareIds.add(c.id);
    }
    for (const sqid of squareSquareIds) {
      const local = categoryBySquareId.get(sqid);
      if (local) squareCatIds.add(local.id);
    }

    const onlyLocal = [...localCatIds].filter((id) => !squareCatIds.has(id));
    const onlySquare = [...squareCatIds].filter((id) => !localCatIds.has(id));

    // Anything we want to push that has no square_id is unpushable. Track
    // those category UUIDs so the user can fix them in Supabase.
    for (const localCatId of onlyLocal) {
      const cat = categoryById.get(localCatId);
      if (cat && !cat.square_id) local_only_categories.add(localCatId);
    }

    if (onlyLocal.length === 0 && onlySquare.length === 0) {
      fully_in_sync.push({ product, squareItem });
    } else if (onlyLocal.length > 0 && onlySquare.length === 0) {
      site_has_extra.push({ product, squareItem, onlyLocal });
    } else if (onlyLocal.length === 0 && onlySquare.length > 0) {
      square_has_extra.push({ product, squareItem, onlySquare });
    } else {
      both_have_unique.push({ product, squareItem, onlyLocal, onlySquare });
    }
  }

  // 4. CSV output (machine-readable for the client/spreadsheet).
  if (asCsv) {
    const rows = [
      [
        "bucket",
        "product_name",
        "product_square_token",
        "product_id",
        "category_diff",
      ],
    ];
    const stringifyCats = (ids) =>
      ids
        .map((id) => categoryById.get(id)?.name || id)
        .filter(Boolean)
        .join(" | ");

    for (const row of site_has_extra) {
      rows.push([
        "site_has_extra",
        row.product.name,
        row.product.square_token,
        row.product.id,
        `+ ${stringifyCats(row.onlyLocal)}`,
      ]);
    }
    for (const row of square_has_extra) {
      rows.push([
        "square_has_extra",
        row.product.name,
        row.product.square_token,
        row.product.id,
        `+ ${stringifyCats(row.onlySquare)}`,
      ]);
    }
    for (const row of both_have_unique) {
      rows.push([
        "both_have_unique",
        row.product.name,
        row.product.square_token,
        row.product.id,
        `local: ${stringifyCats(row.onlyLocal)} | square: ${stringifyCats(row.onlySquare)}`,
      ]);
    }
    for (const row of missing_in_square) {
      rows.push([
        "missing_in_square",
        row.name,
        row.square_token,
        row.id,
        "active locally but absent from Square",
      ]);
    }
    for (const row of products_without_token) {
      rows.push([
        "no_square_token",
        row.name,
        "",
        row.id,
        "active locally but never linked to Square",
      ]);
    }
    for (const row of rows) console.log(row.map(csvEscape).join(","));
    return;
  }

  // 5. Console summary.
  console.log("Summary");
  console.log(`  Fully in sync         : ${fully_in_sync.length}`);
  console.log(`  Site has extra cats   : ${site_has_extra.length}`);
  console.log(`  Square has extra cats : ${square_has_extra.length}`);
  console.log(`  Both have unique      : ${both_have_unique.length}`);
  console.log(`  Missing in Square     : ${missing_in_square.length}`);
  console.log(`  No Square token       : ${products_without_token.length}`);
  if (local_only_categories.size > 0) {
    console.log(
      `  Local-only categories : ${local_only_categories.size}  (these have no square_id and cannot be pushed)`
    );
    for (const id of local_only_categories) {
      const cat = categoryById.get(id);
      if (cat) console.log(`    - ${cat.name} (${cat.id})`);
    }
  }
  console.log();

  if (site_has_extra.length > 0) {
    console.log("Site has extra categories — these would be wiped by the next");
    console.log("full Square→site resync unless pushed back to Square:");
    for (const row of site_has_extra.slice(0, 10)) {
      const names = row.onlyLocal
        .map((id) => categoryById.get(id)?.name || id)
        .join(", ");
      console.log(`  • ${row.product.name}  +  ${names}`);
    }
    if (site_has_extra.length > 10) {
      console.log(`  …plus ${site_has_extra.length - 10} more`);
    }
    console.log();
  }

  // 6. Optional: push the site_has_extra rows back to Square.
  if (pushSiteExtras && site_has_extra.length > 0) {
    console.log(`Pushing ${site_has_extra.length} items to Square…\n`);
    let pushed = 0;
    let failed = 0;
    for (const row of site_has_extra) {
      const item = row.squareItem;
      const itemData = { ...item.itemData };
      const existing = Array.isArray(itemData.categories)
        ? [...itemData.categories]
        : [];
      let changed = false;
      for (const localCatId of row.onlyLocal) {
        const cat = categoryById.get(localCatId);
        if (!cat?.square_id) continue;
        if (existing.some((c) => c?.id === cat.square_id)) continue;
        existing.push({ id: cat.square_id, ordinal: existing.length });
        changed = true;
      }
      if (!changed) continue;
      itemData.categories = existing;
      try {
        await square.catalogApi.upsertCatalogObject({
          idempotencyKey: `reconcile-${item.id}-${Date.now()}`,
          object: { ...item, itemData },
        });
        pushed += 1;
        console.log(`  pushed: ${row.product.name}`);
      } catch (err) {
        failed += 1;
        const detail =
          err?.errors?.map?.((e) => `${e.code}: ${e.detail}`).join("; ") ||
          err?.message ||
          String(err);
        console.error(`  FAILED: ${row.product.name}: ${detail}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log(`\nPushed ${pushed} successfully. Failed: ${failed}.`);
  } else if (pushSiteExtras) {
    console.log("Nothing to push.");
  } else if (site_has_extra.length > 0) {
    console.log(
      "Re-run with --push-site-extras to push these to Square automatically.\n"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
