#!/usr/bin/env node

/**
 * Merge duplicate categories in Supabase.
 *
 * Why this exists: when Square deletes/recreates/renames a category, the
 * site's daily resync creates a NEW local row with the new Square id but
 * leaves the OLD local row orphaned. Over time the website ends up with
 * the same category showing twice (e.g., two "Hubs"), each with its own
 * subset of products. This script picks the canonical row for each
 * duplicate-by-name pair and merges everything into it.
 *
 * Strategy per duplicate-name group:
 *   - If exactly one row has a square_id that still exists in Square,
 *     that row is canonical. Other rows are orphans.
 *   - product_categories links from orphans are upserted onto the
 *     canonical row (no-op if the link already exists there).
 *   - Orphan category rows are deleted.
 *   - If MORE than one row has a valid square_id, skip — needs manual
 *     decision (Square itself has duplicates).
 *   - If NO row has a valid square_id, skip — there's no good canonical
 *     to keep. Surface for manual fix.
 *
 * Usage:
 *   node scripts/merge-duplicate-categories.js              # dry run
 *   node scripts/merge-duplicate-categories.js --apply      # actually merge
 *
 * Always dry-run first. The script prints exactly which rows it would
 * merge and which it skips before doing anything.
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
  console.error(
    "Missing env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SQUARE_ACCESS_TOKEN)"
  );
  process.exit(1);
}

const apply = process.argv.includes("--apply");

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

async function fetchSquareCategoryIds() {
  const ids = new Set();
  let cursor;
  do {
    const { result } = await square.catalogApi.searchCatalogObjects({
      cursor,
      objectTypes: ["CATEGORY"],
      limit: 1000,
    });
    if (result.objects) for (const c of result.objects) ids.add(c.id);
    cursor = result.cursor;
  } while (cursor);
  return ids;
}

async function moveProductLinks(orphanCategoryId, canonicalCategoryId) {
  // Pull every link pointing at the orphan.
  const { data: orphanLinks, error: linksError } = await supabase
    .from("product_categories")
    .select("product_id")
    .eq("category_id", orphanCategoryId);
  if (linksError) throw linksError;
  if (!orphanLinks || orphanLinks.length === 0) return { moved: 0, alreadyOnCanonical: 0 };

  // Find which of those products already have the canonical category. Those
  // links just get deleted from the orphan; no insert needed.
  const productIds = orphanLinks.map((l) => l.product_id);
  const { data: existingOnCanonical, error: existErr } = await supabase
    .from("product_categories")
    .select("product_id")
    .eq("category_id", canonicalCategoryId)
    .in("product_id", productIds);
  if (existErr) throw existErr;

  const alreadySet = new Set((existingOnCanonical || []).map((l) => l.product_id));
  const toInsert = productIds
    .filter((pid) => !alreadySet.has(pid))
    .map((pid) => ({ product_id: pid, category_id: canonicalCategoryId }));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("product_categories")
      .insert(toInsert);
    if (insertError) throw insertError;
  }

  // Now delete every orphan link.
  const { error: deleteError } = await supabase
    .from("product_categories")
    .delete()
    .eq("category_id", orphanCategoryId);
  if (deleteError) throw deleteError;

  return { moved: toInsert.length, alreadyOnCanonical: alreadySet.size };
}

async function deleteCategory(categoryId) {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) throw error;
}

async function main() {
  console.log(`\n${apply ? "Merging" : "Dry-running merge of"} duplicate categories…\n`);

  const [categories, productCategories, squareIds] = await Promise.all([
    fetchAll("categories", "id, name, slug, parent_id, square_id"),
    fetchAll("product_categories", "category_id"),
    fetchSquareCategoryIds(),
  ]);

  const productCount = new Map();
  for (const link of productCategories) {
    productCount.set(link.category_id, (productCount.get(link.category_id) || 0) + 1);
  }

  const byName = new Map();
  for (const cat of categories) {
    const key = cat.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(cat);
  }
  const duplicateGroups = Array.from(byName.entries()).filter(
    ([, rows]) => rows.length > 1
  );

  if (duplicateGroups.length === 0) {
    console.log("No duplicate categories found. Nothing to do.");
    return;
  }

  let mergedGroups = 0;
  let skippedNoCanonical = 0;
  let skippedMultipleCanonical = 0;
  let totalLinksMoved = 0;
  let totalLinksAlreadyOnCanonical = 0;
  const skippedNeedsHumanDecision = [];

  for (const [name, rows] of duplicateGroups) {
    const validRows = rows.filter((r) => r.square_id && squareIds.has(r.square_id));
    const orphans = rows.filter((r) => !validRows.includes(r));

    console.log(`\n● "${rows[0].name}"`);
    for (const row of rows) {
      const sqState = !row.square_id
        ? "no square_id"
        : !squareIds.has(row.square_id)
          ? `stale square_id ${row.square_id}`
          : `live square_id ${row.square_id}`;
      const tag = validRows.includes(row) ? "[KEEP]  " : "[orphan]";
      console.log(
        `    ${tag} id=${row.id}  slug=${row.slug}  products=${productCount.get(row.id) || 0}  ${sqState}`
      );
    }

    if (validRows.length === 0) {
      console.log("    SKIP: no row points at a live Square category.");
      console.log(
        "    Action needed: pick the right Square category for this name (or recreate it),"
      );
      console.log("    update one local row's square_id manually, then re-run this script.");
      skippedNoCanonical += 1;
      skippedNeedsHumanDecision.push({ name: rows[0].name, reason: "no live canonical" });
      continue;
    }
    if (validRows.length > 1) {
      console.log("    SKIP: more than one row points at a live Square category.");
      console.log("    Action needed: deduplicate in Square first.");
      skippedMultipleCanonical += 1;
      skippedNeedsHumanDecision.push({
        name: rows[0].name,
        reason: "multiple live canonicals",
      });
      continue;
    }

    const canonical = validRows[0];
    let groupMoved = 0;
    let groupAlreadyOn = 0;
    for (const orphan of orphans) {
      if (apply) {
        const result = await moveProductLinks(orphan.id, canonical.id);
        groupMoved += result.moved;
        groupAlreadyOn += result.alreadyOnCanonical;
        await deleteCategory(orphan.id);
        console.log(
          `    moved ${result.moved} new links onto canonical (${result.alreadyOnCanonical} were already there); deleted orphan ${orphan.id}`
        );
      } else {
        console.log(
          `    [dry] would move up to ${productCount.get(orphan.id) || 0} product link(s) onto canonical and delete orphan ${orphan.id}`
        );
      }
    }
    totalLinksMoved += groupMoved;
    totalLinksAlreadyOnCanonical += groupAlreadyOn;
    mergedGroups += 1;
  }

  console.log("\n──────────────────────────────────────────");
  console.log(`Groups merged                : ${mergedGroups}`);
  console.log(`Skipped (no live canonical)  : ${skippedNoCanonical}`);
  console.log(`Skipped (multiple canonicals): ${skippedMultipleCanonical}`);
  if (apply) {
    console.log(`Product links moved          : ${totalLinksMoved}`);
    console.log(`Already on canonical         : ${totalLinksAlreadyOnCanonical}`);
  }
  if (skippedNeedsHumanDecision.length > 0) {
    console.log("\nNeeds human decision:");
    for (const s of skippedNeedsHumanDecision) {
      console.log(`  - "${s.name}" — ${s.reason}`);
    }
  }
  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to actually merge.\n");
  } else {
    console.log("\nDone. Run scripts/find-duplicate-categories.js to verify.\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
