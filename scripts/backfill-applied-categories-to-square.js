#!/usr/bin/env node

/**
 * Backfill: push every category suggestion that's already in `applied` state
 * back to Square.
 *
 * Why this exists: the website previously wrote applied suggestions only to
 * Supabase, not Square. The client spent significant time approving and
 * applying suggestions through the admin — those changes are real on the
 * site but absent from Square. The next full Square→site resync would
 * happily wipe them. This script catches Square up so the work sticks.
 *
 * Safe to re-run. The Square upsert is idempotent — if the item already has
 * the category, the script no-ops that row.
 *
 * Usage:
 *   node scripts/backfill-applied-categories-to-square.js --dry-run
 *   node scripts/backfill-applied-categories-to-square.js
 *
 * The script logs each row, total successes, and total failures. Failures
 * are written to backups/backfill-applied-categories-failures-<timestamp>.json
 * so the client can review and retry individual items.
 */

import { createClient } from "@supabase/supabase-js";
import { Client, Environment } from "square";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const isDryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN;

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!SQUARE_TOKEN) missing.push("SQUARE_ACCESS_TOKEN");
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  console.error("Check .env.local in the project root.");
  process.exit(1);
}

if (!process.env.SQUARE_ENVIRONMENT) {
  console.warn('Warning: SQUARE_ENVIRONMENT not set. Defaulting to "sandbox".');
}

const square = new Client({
  accessToken: SQUARE_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BACKUPS_DIR = resolve(__dirname, "../backups");
if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });

// Polite delay between Square calls. Square's catalog endpoints have a
// rate limit but it's generous; 100ms is comfortably under it.
const SQUARE_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSquareCategoryAssignments(existingCategories, categorySquareId, itemSquareToken) {
  const categories = [];
  for (const category of Array.isArray(existingCategories) ? existingCategories : []) {
    const id = typeof category?.id === "string" ? category.id : null;
    if (!id || categories.some((current) => current.id === id)) continue;
    categories.push({ id, ordinal: category.ordinal });
  }

  if (!categories.some((category) => category.id === categorySquareId)) {
    const hash = createHash("sha1")
      .update(`${itemSquareToken}:${categorySquareId}`)
      .digest("hex")
      .slice(0, 12);
    categories.push({
      id: categorySquareId,
      ordinal: BigInt("1000000000000000") + BigInt(`0x${hash}`),
    });
  }

  return categories;
}

async function fetchAppliedRows() {
  const all = [];
  const page = 500;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("category_assignment_suggestions")
      .select(
        `
        id,
        product_id,
        product_name,
        suggested_category_id,
        applied_at,
        products!inner ( id, name, square_token ),
        categories!suggested_category_id ( id, name, square_id )
      `
      )
      .eq("status", "applied")
      .range(from, from + page - 1);
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return all;
}

async function pushOneItemCategoryToSquare(itemSquareToken, categorySquareId) {
  // 1) Retrieve current item
  let item;
  try {
    const { result } = await square.catalogApi.retrieveCatalogObject(
      itemSquareToken,
      false
    );
    item = result.object;
  } catch (err) {
    return { ok: false, reason: `retrieve failed: ${err?.message || err}` };
  }

  if (!item || item.type !== "ITEM" || !item.itemData) {
    return { ok: false, reason: "Square object is not an ITEM" };
  }

  const itemData = { ...item.itemData };
  const alreadyHasCategory = Array.isArray(itemData.categories)
    ? itemData.categories.some((c) => c?.id === categorySquareId)
    : false;

  if (alreadyHasCategory) {
    return { ok: true, skipped: true };
  }

  const normalizedCategories = normalizeSquareCategoryAssignments(
    itemData.categories,
    categorySquareId,
    itemSquareToken
  );
  itemData.categories = normalizedCategories;
  if (!itemData.categoryId || itemData.categoryId === categorySquareId) {
    itemData.categoryId = normalizedCategories[0]?.id || undefined;
  }
  if (!itemData.reportingCategory?.id || itemData.reportingCategory.id === categorySquareId) {
    itemData.reportingCategory = normalizedCategories[0]
      ? { id: normalizedCategories[0].id, ordinal: normalizedCategories[0].ordinal }
      : undefined;
  }

  const updatedObject = { ...item, itemData };

  try {
    await square.catalogApi.upsertCatalogObject({
      idempotencyKey: `backfill-v2-${item.id}-${categorySquareId}`,
      object: updatedObject,
    });
  } catch (err) {
    const detail =
      err?.errors?.map?.((e) => `${e.code}: ${e.detail}`).join("; ") ||
      err?.message ||
      String(err);
    return { ok: false, reason: `upsert failed: ${detail}` };
  }

  return { ok: true, skipped: false };
}

async function main() {
  console.log(`\nBackfilling applied category suggestions to Square${isDryRun ? " (DRY RUN)" : ""}\n`);

  const rows = await fetchAppliedRows();
  console.log(`Found ${rows.length} suggestions in 'applied' state.\n`);

  if (rows.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const skippableMissing = rows.filter(
    (row) => !row.products?.square_token || !row.categories?.square_id
  );

  if (skippableMissing.length > 0) {
    console.log(
      `Skipping ${skippableMissing.length} rows that are missing Square IDs (would not be syncable):`
    );
    for (const row of skippableMissing.slice(0, 5)) {
      const reason = !row.products?.square_token
        ? "no product square_token"
        : "no category square_id";
      console.log(`  - ${row.products?.name || row.product_name} (${reason})`);
    }
    if (skippableMissing.length > 5) {
      console.log(`  …plus ${skippableMissing.length - 5} more`);
    }
    console.log();
  }

  const actionable = rows.filter(
    (row) => row.products?.square_token && row.categories?.square_id
  );
  console.log(`Will push ${actionable.length} items to Square.\n`);

  if (isDryRun) {
    console.log("DRY RUN — no Square calls will be made. Sample of what would happen:");
    for (const row of actionable.slice(0, 10)) {
      console.log(
        `  ${row.products.name}  →  ${row.categories.name}  (square: ${row.products.square_token} += ${row.categories.square_id})`
      );
    }
    if (actionable.length > 10) {
      console.log(`  …plus ${actionable.length - 10} more`);
    }
    console.log("\nRe-run without --dry-run to actually push.\n");
    return;
  }

  let pushed = 0;
  let alreadyHad = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < actionable.length; i++) {
    const row = actionable[i];
    const result = await pushOneItemCategoryToSquare(
      row.products.square_token,
      row.categories.square_id
    );

    if (result.ok) {
      if (result.skipped) {
        alreadyHad += 1;
        if (verbose) {
          console.log(`[${i + 1}/${actionable.length}] ${row.products.name}: already in ${row.categories.name}`);
        }
      } else {
        pushed += 1;
        console.log(`[${i + 1}/${actionable.length}] pushed: ${row.products.name} → ${row.categories.name}`);
      }
    } else {
      failed += 1;
      failures.push({
        suggestion_id: row.id,
        product_name: row.products.name,
        product_square_token: row.products.square_token,
        category_name: row.categories.name,
        category_square_id: row.categories.square_id,
        reason: result.reason,
      });
      console.error(
        `[${i + 1}/${actionable.length}] FAILED: ${row.products.name} → ${row.categories.name}: ${result.reason}`
      );
    }

    if (i < actionable.length - 1) await sleep(SQUARE_DELAY_MS);
  }

  console.log(`\nDone.`);
  console.log(`  Pushed to Square : ${pushed}`);
  console.log(`  Already had it   : ${alreadyHad}`);
  console.log(`  Failed           : ${failed}`);

  if (failures.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const failurePath = resolve(
      BACKUPS_DIR,
      `backfill-applied-categories-failures-${stamp}.json`
    );
    writeFileSync(failurePath, JSON.stringify(failures, null, 2));
    console.log(`\nFailures written to ${failurePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
