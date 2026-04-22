#!/usr/bin/env node
"use strict";
/**
 * DS Racing Karts — Import Stocklist RRP.xlsx → Supabase
 * -------------------------------------------------------
 * Reads three columns from the spreadsheet:
 *   "Stock code"  → SKU (dedup key)
 *   "Description" → Product name
 *   "RRP"         → Price (AUD)
 *
 * Behaviour:
 *   - Fetches ALL existing SKUs from product_variations at startup.
 *     Any row whose SKU already exists is silently skipped.
 *   - New products are inserted with a single "Regular" variation.
 *   - Inventory is seeded with quantity = 0 (unknown stock).
 *   - primary_image_url set to placeholder (/images/image-coming-soon.svg).
 *   - No categories are assigned — client will add them via Square or admin.
 *   - Idempotent: safe to run multiple times.
 *
 * Usage:
 *   node scripts/import-stocklist.cjs "C:\Users\belac\Downloads\Stocklist RRP.xlsx"
 *   node scripts/import-stocklist.cjs "C:\Users\belac\Downloads\Stocklist RRP.xlsx" --dry-run
 *
 * Options:
 *   --dry-run    Analyse and print a summary without writing to the database.
 */

const XLSX = require("xlsx");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── Constants ────────────────────────────────────────────────────────────────
const PLACEHOLDER_IMAGE = "/images/image-coming-soon.svg";
const BATCH_SIZE = 100; // rows per DB insert call

const isDryRun = process.argv.includes("--dry-run");
const filePath = process.argv.find((a) => !a.startsWith("-") && a.endsWith(".xlsx"));

if (!filePath) {
  console.error(
    "Usage: node scripts/import-stocklist.cjs <path-to-xlsx> [--dry-run]"
  );
  process.exit(1);
}

// ─── Supabase (service role bypasses RLS) ─────────────────────────────────────
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")   // drop non-word chars
    .replace(/\s+/g, "-")        // spaces → hyphens
    .replace(/-+/g, "-")         // collapse multiple hyphens
    .replace(/^-|-$/g, "")       // trim edges
    .substring(0, 120);
}

/** Appends -2, -3, etc. until the slug is not in the provided Set. Mutates the Set. */
function uniqueSlug(base, usedSlugs) {
  let candidate = base;
  let n = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  usedSlugs.add(candidate);
  return candidate;
}

/** Fetch every existing SKU from product_variations in one pass. */
async function fetchExistingSkus() {
  const skus = new Set();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("product_variations")
      .select("sku")
      .not("sku", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to fetch existing SKUs: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.sku) skus.add(row.sku.trim().toLowerCase());
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return skus;
}

/** Fetch every existing product slug in one pass. */
async function fetchExistingSlugs() {
  const slugs = new Set();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("slug")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to fetch existing slugs: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) slugs.add(row.slug);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return slugs;
}

/** Insert an array of records in chunks, returning all inserted rows. */
async function batchInsert(table, records, selectFields = "id") {
  const results = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from(table)
      .insert(chunk)
      .select(selectFields);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
    results.push(...data);
    process.stdout.write(`\r  Inserted ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length} into ${table}    `);
  }
  process.stdout.write("\n");
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("DS Racing Karts — Stocklist Import");
  console.log("====================================");
  console.log(`File:    ${path.resolve(filePath)}`);
  console.log(`Mode:    ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log();

  // 1. Parse the Excel file ─────────────────────────────────────────────────
  console.log("Step 1/5 — Parsing Excel file...");
  const workbook = XLSX.readFile(path.resolve(filePath));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`  Parsed ${rawRows.length} rows from "${workbook.SheetNames[0]}"`);

  // 2. Validate and normalise rows ──────────────────────────────────────────
  console.log("\nStep 2/5 — Validating rows...");
  const validRows = [];
  const skipped = { noSku: 0, noName: 0, badPrice: 0, dupInFile: 0 };
  const seenInFile = new Set();

  for (const row of rawRows) {
    const sku = String(row["Stock code"] ?? "").trim();
    const name = String(row["Description"] ?? "").trim();
    const rawPrice = row["RRP"];
    const price = parseFloat(rawPrice);

    if (!sku) { skipped.noSku++; continue; }
    if (!name) { skipped.noName++; continue; }
    if (isNaN(price) || price < 0) { skipped.badPrice++; continue; }

    // Duplicate within the spreadsheet itself
    const skuKey = sku.toLowerCase();
    if (seenInFile.has(skuKey)) { skipped.dupInFile++; continue; }
    seenInFile.add(skuKey);

    validRows.push({ sku, name, price });
  }

  console.log(`  Valid rows:     ${validRows.length}`);
  if (skipped.noSku)    console.log(`  Skipped (no SKU):          ${skipped.noSku}`);
  if (skipped.noName)   console.log(`  Skipped (no name):         ${skipped.noName}`);
  if (skipped.badPrice) console.log(`  Skipped (bad price):       ${skipped.badPrice}`);
  if (skipped.dupInFile) console.log(`  Skipped (dup in file):     ${skipped.dupInFile}`);

  // 3. Check against existing DB records ────────────────────────────────────
  console.log("\nStep 3/5 — Checking against database...");
  const [existingSkus, existingSlugs] = await Promise.all([
    fetchExistingSkus(),
    fetchExistingSlugs(),
  ]);
  console.log(`  Existing SKUs in DB:     ${existingSkus.size}`);
  console.log(`  Existing slugs in DB:    ${existingSlugs.size}`);

  const newRows = validRows.filter(
    (r) => !existingSkus.has(r.sku.toLowerCase())
  );
  const dupCount = validRows.length - newRows.length;

  console.log(`  Already in DB (skipped): ${dupCount}`);
  console.log(`  NEW products to import:  ${newRows.length}`);

  if (newRows.length === 0) {
    console.log("\nNothing new to import. Database is already up to date.");
    return;
  }

  if (isDryRun) {
    console.log("\n--- DRY RUN SAMPLE (first 10 new products) ---");
    newRows.slice(0, 10).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.sku}] ${r.name} — $${r.price.toFixed(2)}`)
    );
    if (newRows.length > 10) {
      console.log(`  ... and ${newRows.length - 10} more`);
    }
    console.log(`\nDry run complete. Run without --dry-run to import.`);
    return;
  }

  // 4. Build product records and insert ─────────────────────────────────────
  console.log("\nStep 4/5 — Inserting products...");
  const usedSlugs = new Set(existingSlugs);

  const productRecords = newRows.map((r) => ({
    name: r.name,
    slug: uniqueSlug(slugify(r.name), usedSlugs),
    sku: r.sku,
    status: "active",
    visibility: "visible",
    item_type: "Physical good",
    base_price: r.price,
    shipping_enabled: true,
    is_sellable: true,
    is_stockable: true,
    is_archived: false,
    primary_image_url: PLACEHOLDER_IMAGE,
  }));

  // We need sku back so we can match product IDs to our rows
  const insertedProducts = await batchInsert("products", productRecords, "id, sku");

  // Build sku → product id map
  const skuToProductId = new Map();
  for (const p of insertedProducts) {
    if (p.sku) skuToProductId.set(p.sku.toLowerCase(), p.id);
  }

  // 5. Insert variations & inventory ────────────────────────────────────────
  console.log("\nStep 5/5 — Inserting variations and inventory...");
  const variationRecords = [];
  for (const r of newRows) {
    const productId = skuToProductId.get(r.sku.toLowerCase());
    if (!productId) continue; // shouldn't happen
    variationRecords.push({
      product_id: productId,
      name: "Regular",
      sku: r.sku,
      price: r.price,
      sort_order: 0,
    });
  }

  const insertedVariations = await batchInsert(
    "product_variations",
    variationRecords,
    "id, sku"
  );

  // Map variation id → inventory
  const inventoryRecords = insertedVariations.map((v) => ({
    variation_id: v.id,
    quantity: 0, // unknown — client to update
  }));

  await batchInsert("inventory", inventoryRecords, "id");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n====================================");
  console.log("Import complete!");
  console.log(`  New products imported: ${insertedProducts.length}`);
  console.log(`  Variations created:    ${insertedVariations.length}`);
  console.log(`  Inventory rows seeded: ${inventoryRecords.length}`);
  console.log(`  Skipped (already in DB): ${dupCount}`);
  console.log(`  Skipped (invalid rows):  ${Object.values(skipped).reduce((a, b) => a + b, 0)}`);
  console.log("\nAll new products use the placeholder image.");
  console.log("Categories can be assigned via the admin panel or Square.");
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
