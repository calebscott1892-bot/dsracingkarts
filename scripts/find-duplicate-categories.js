#!/usr/bin/env node

/**
 * Find duplicate, orphan, and broken-link categories in Supabase, and
 * cross-check against the live Square catalog.
 *
 * Reports four buckets:
 *   1. duplicates_by_name  — multiple local categories with the same name
 *   2. duplicates_by_square_id  — multiple local categories with the same Square id
 *   3. stale_square_id     — local category with square_id pointing to a
 *                            Square category that no longer exists
 *   4. missing_square_id   — local category with no square_id at all
 *                            (created locally, never pushed to Square)
 *
 * Also lists Square categories that have no local row at all (the next
 * resync would create them).
 *
 * Usage:
 *   node scripts/find-duplicate-categories.js
 *   node scripts/find-duplicate-categories.js --csv > categories.csv
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

if (!SUPABASE_URL || !SUPABASE_KEY || !SQUARE_TOKEN) {
  console.error("Missing env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SQUARE_ACCESS_TOKEN)");
  process.exit(1);
}

const asCsv = process.argv.includes("--csv");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const square = new Client({
  accessToken: SQUARE_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

async function fetchAll(table, select) {
  const all = [];
  const page = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return all;
}

async function fetchSquareCategories() {
  const cats = [];
  let cursor;
  do {
    const { result } = await square.catalogApi.searchCatalogObjects({
      cursor,
      objectTypes: ["CATEGORY"],
      limit: 1000,
    });
    if (result.objects) cats.push(...result.objects);
    cursor = result.cursor;
  } while (cursor);
  return cats;
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  if (!asCsv) console.log("\nScanning categories…\n");

  const [localCategories, productCategories, squareCategories] = await Promise.all([
    fetchAll("categories", "id, name, slug, parent_id, square_id"),
    fetchAll("product_categories", "category_id"),
    fetchSquareCategories(),
  ]);

  const productCountByCategory = new Map();
  for (const link of productCategories) {
    productCountByCategory.set(
      link.category_id,
      (productCountByCategory.get(link.category_id) || 0) + 1
    );
  }

  const squareIds = new Set(squareCategories.map((c) => c.id));
  const squareById = new Map(squareCategories.map((c) => [c.id, c]));

  // 1. duplicates by name
  const byName = new Map();
  for (const cat of localCategories) {
    const key = cat.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(cat);
  }
  const dupesByName = Array.from(byName.entries()).filter(([, rows]) => rows.length > 1);

  // 2. duplicates by square_id
  const bySquareId = new Map();
  for (const cat of localCategories) {
    if (!cat.square_id) continue;
    if (!bySquareId.has(cat.square_id)) bySquareId.set(cat.square_id, []);
    bySquareId.get(cat.square_id).push(cat);
  }
  const dupesBySquareId = Array.from(bySquareId.entries()).filter(
    ([, rows]) => rows.length > 1
  );

  // 3. stale square_id
  const stale = localCategories.filter(
    (cat) => cat.square_id && !squareIds.has(cat.square_id)
  );

  // 4. missing square_id
  const missing = localCategories.filter((cat) => !cat.square_id);

  // 5. Square categories not yet local
  const localSquareIds = new Set(
    localCategories.map((c) => c.square_id).filter(Boolean)
  );
  const orphanSquareCats = squareCategories.filter((sc) => !localSquareIds.has(sc.id));

  if (asCsv) {
    const rows = [["bucket", "name", "slug", "category_id", "square_id", "products_assigned", "note"]];
    for (const [name, hits] of dupesByName) {
      for (const cat of hits) {
        rows.push([
          "duplicate_name",
          cat.name,
          cat.slug,
          cat.id,
          cat.square_id || "",
          productCountByCategory.get(cat.id) || 0,
          name,
        ]);
      }
    }
    for (const [sqid, hits] of dupesBySquareId) {
      for (const cat of hits) {
        rows.push([
          "duplicate_square_id",
          cat.name,
          cat.slug,
          cat.id,
          cat.square_id,
          productCountByCategory.get(cat.id) || 0,
          `shares square_id with ${hits.length - 1} other(s)`,
        ]);
      }
    }
    for (const cat of stale) {
      rows.push([
        "stale_square_id",
        cat.name,
        cat.slug,
        cat.id,
        cat.square_id,
        productCountByCategory.get(cat.id) || 0,
        "Square category no longer exists",
      ]);
    }
    for (const cat of missing) {
      rows.push([
        "missing_square_id",
        cat.name,
        cat.slug,
        cat.id,
        "",
        productCountByCategory.get(cat.id) || 0,
        "never pushed to Square",
      ]);
    }
    for (const sc of orphanSquareCats) {
      rows.push([
        "square_only",
        sc.categoryData?.name || "(unnamed)",
        "",
        "",
        sc.id,
        0,
        "exists in Square but no local row",
      ]);
    }
    for (const row of rows) console.log(row.map(csvEscape).join(","));
    return;
  }

  console.log(`Local categories         : ${localCategories.length}`);
  console.log(`Square categories        : ${squareCategories.length}`);
  console.log();
  console.log(`Duplicate names          : ${dupesByName.length} affected names`);
  console.log(`Duplicate square_ids     : ${dupesBySquareId.length} affected ids`);
  console.log(`Stale square_id          : ${stale.length} (Square category gone)`);
  console.log(`Missing square_id        : ${missing.length} (never pushed to Square)`);
  console.log(`Square-only (not local)  : ${orphanSquareCats.length}`);
  console.log();

  if (dupesByName.length > 0) {
    console.log("── Duplicate categories by name ──");
    for (const [name, hits] of dupesByName) {
      console.log(`\n  "${name}" appears ${hits.length} times:`);
      for (const cat of hits) {
        const products = productCountByCategory.get(cat.id) || 0;
        const sqState = !cat.square_id
          ? "no square_id"
          : !squareIds.has(cat.square_id)
            ? `stale square_id ${cat.square_id}`
            : `square_id ${cat.square_id}`;
        console.log(`    - id=${cat.id}  slug=${cat.slug}  products=${products}  ${sqState}`);
      }
    }
    console.log();
  }

  if (dupesBySquareId.length > 0) {
    console.log("── Duplicate square_ids (multiple local rows for one Square category) ──");
    for (const [sqid, hits] of dupesBySquareId) {
      console.log(`\n  square_id=${sqid} pointed to by ${hits.length} local rows:`);
      for (const cat of hits) {
        console.log(`    - "${cat.name}"  slug=${cat.slug}  id=${cat.id}  products=${productCountByCategory.get(cat.id) || 0}`);
      }
    }
    console.log();
  }

  if (stale.length > 0) {
    console.log("── Stale square_id (points to a deleted Square category) ──");
    for (const cat of stale) {
      console.log(`  - "${cat.name}"  slug=${cat.slug}  square_id=${cat.square_id}  products=${productCountByCategory.get(cat.id) || 0}`);
    }
    console.log();
  }

  if (missing.length > 0) {
    console.log("── Missing square_id (locally created, never reached Square) ──");
    for (const cat of missing) {
      console.log(`  - "${cat.name}"  slug=${cat.slug}  products=${productCountByCategory.get(cat.id) || 0}`);
    }
    console.log();
  }

  if (orphanSquareCats.length > 0) {
    console.log("── Square has these categories but local does not ──");
    for (const sc of orphanSquareCats.slice(0, 20)) {
      console.log(`  - "${sc.categoryData?.name || "(unnamed)"}"  square_id=${sc.id}`);
    }
    if (orphanSquareCats.length > 20) {
      console.log(`  …plus ${orphanSquareCats.length - 20} more`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
