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
 *     Clear existing SKU matches preserve IKD RRP/vendor references in
 *     product_supplier_costs without overwriting stock or product price.
 *     Existing duplicate SKU matches are held for manual review.
 *   - New products are inserted with a single "Regular" variation.
 *   - Inventory is seeded with quantity = 0.
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

const readXlsxFile = require("read-excel-file/node");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── Constants ────────────────────────────────────────────────────────────────
const PLACEHOLDER_IMAGE = "/images/image-coming-soon.svg";
const VENDOR = "IKD";
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
async function fetchExistingSkuMap() {
  const skuMap = new Map();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("product_variations")
      .select("id, product_id, sku")
      .not("sku", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to fetch existing SKUs: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (!row.sku) continue;
      const key = row.sku.trim().toLowerCase();
      if (!skuMap.has(key)) skuMap.set(key, []);
      skuMap.get(key).push(row);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return skuMap;
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

async function ensureSupplier(name) {
  const { data, error } = await supabase
    .from("suppliers")
    .upsert({ name, updated_at: new Date().toISOString() }, { onConflict: "name" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not access supplier tables. Run migration 020_supplier_costs.sql first. ${error?.message || ""}`.trim()
    );
  }

  return data.id;
}

async function upsertSupplierCosts(rows) {
  if (rows.length === 0) return 0;
  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("product_supplier_costs")
      .upsert(chunk, { onConflict: "supplier_id,supplier_sku" });

    if (error) throw new Error(`Supplier cost upsert failed: ${error.message}`);

    written += chunk.length;
    process.stdout.write(
      `\r  Supplier costs ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}   `
    );
  }

  process.stdout.write("\n");
  return written;
}

function supplierCostRecord({ row, match, supplierId, sourceName, variationId = null, productId = null }) {
  return {
    product_id: productId || match?.product_id || null,
    variation_id: variationId || match?.id || null,
    supplier_id: supplierId,
    supplier_sku: row.sku,
    supplier_item_name: row.name,
    wholesale_price: null,
    retail_price: row.price,
    currency: "AUD",
    source: sourceName,
    source_row_number: row.sourceRow,
    updated_at: new Date().toISOString(),
  };
}

function cellValue(value) {
  if (value == null) return "";
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if ("result" in value) return cellValue(value.result);
  if ("text" in value) return value.text;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text || "").join("");
  }
  if ("hyperlink" in value && "text" in value) return value.text;
  return String(value);
}

async function readWorksheetRows(workbookPath) {
  const workbookRows = await readXlsxFile(path.resolve(workbookPath));
  const firstSheet = Array.isArray(workbookRows[0])
    ? { sheet: "first sheet", data: workbookRows }
    : workbookRows[0];
  const worksheetRows = firstSheet?.data || [];
  const headers = (worksheetRows[0] || []).map((header) =>
    String(cellValue(header)).trim()
  );

  const rows = worksheetRows.slice(1).map((row) => {
    const record = {};
    for (let col = 0; col < headers.length; col += 1) {
      const header = headers[col];
      if (!header) continue;
      record[header] = cellValue(row[col]);
    }
    return record;
  });

  return { sheetName: firstSheet?.sheet || "first sheet", rows };
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
  const { sheetName, rows: rawRows } = await readWorksheetRows(filePath);
  console.log(`  Parsed ${rawRows.length} rows from "${sheetName}"`);

  // 2. Validate and normalise rows ──────────────────────────────────────────
  console.log("\nStep 2/5 — Validating rows...");
  const validRows = [];
  const skipped = { noSku: 0, noName: 0, badPrice: 0, dupInFile: 0 };
  const seenInFile = new Set();

  for (const [index, row] of rawRows.entries()) {
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

    validRows.push({ sku, name, price, sourceRow: index + 2 });
  }

  console.log(`  Valid rows:     ${validRows.length}`);
  if (skipped.noSku)    console.log(`  Skipped (no SKU):          ${skipped.noSku}`);
  if (skipped.noName)   console.log(`  Skipped (no name):         ${skipped.noName}`);
  if (skipped.badPrice) console.log(`  Skipped (bad price):       ${skipped.badPrice}`);
  if (skipped.dupInFile) console.log(`  Skipped (dup in file):     ${skipped.dupInFile}`);

  // 3. Check against existing DB records ────────────────────────────────────
  console.log("\nStep 3/5 — Checking against database...");
  const [existingSkuMap, existingSlugs] = await Promise.all([
    fetchExistingSkuMap(),
    fetchExistingSlugs(),
  ]);
  console.log(`  Existing SKUs in DB:     ${existingSkuMap.size}`);
  console.log(`  Existing slugs in DB:    ${existingSlugs.size}`);

  const newRows = [];
  const existingSupplierCostMetas = [];
  const duplicateExistingSkuRows = [];

  for (const row of validRows) {
    const matches = existingSkuMap.get(row.sku.toLowerCase()) || [];
    if (matches.length === 0) {
      newRows.push(row);
    } else if (matches.length === 1) {
      existingSupplierCostMetas.push({ row, match: matches[0] });
    } else {
      duplicateExistingSkuRows.push(row);
    }
  }
  const dupCount = validRows.length - newRows.length;

  console.log(`  Already in DB (skipped): ${dupCount}`);
  console.log(`  Existing SKU supplier refs: ${existingSupplierCostMetas.length}`);
  if (duplicateExistingSkuRows.length) {
    console.log(`  Existing duplicate SKUs held for review: ${duplicateExistingSkuRows.length}`);
  }
  console.log(`  NEW products to import:  ${newRows.length}`);

  if (isDryRun) {
    if (existingSupplierCostMetas.length > 0) {
      console.log("\n--- DRY RUN EXISTING SKU SUPPLIER REFS (first 10) ---");
      existingSupplierCostMetas.slice(0, 10).forEach(({ row }, i) =>
        console.log(`  ${i + 1}. [${row.sku}] ${row.name} - ${VENDOR} RRP $${row.price.toFixed(2)}`)
      );
      if (existingSupplierCostMetas.length > 10) {
        console.log(`  ... and ${existingSupplierCostMetas.length - 10} more`);
      }
    }

    if (duplicateExistingSkuRows.length > 0) {
      console.log("\n--- DRY RUN DUPLICATE EXISTING SKUS HELD (first 10) ---");
      duplicateExistingSkuRows.slice(0, 10).forEach((row, i) =>
        console.log(`  ${i + 1}. [${row.sku}] ${row.name}`)
      );
      if (duplicateExistingSkuRows.length > 10) {
        console.log(`  ... and ${duplicateExistingSkuRows.length - 10} more`);
      }
    }

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

  // 4. Store supplier refs and insert products ──────────────────────────────
  console.log("\nStep 4/5 — Writing supplier refs and inserting products...");
  const supplierId = await ensureSupplier(VENDOR);
  const sourceName = path.basename(path.resolve(filePath));

  if (existingSupplierCostMetas.length > 0) {
    console.log("\nWriting supplier references for existing SKU matches...");
    await upsertSupplierCosts(
      existingSupplierCostMetas.map(({ row, match }) =>
        supplierCostRecord({ row, match, supplierId, sourceName })
      )
    );
  }

  if (newRows.length === 0) {
    console.log("\nNo new products to import.");
    return;
  }

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

  console.log("\nWriting supplier references for new products...");
  const variationIdBySku = new Map(
    insertedVariations.map((variation) => [variation.sku.toLowerCase(), variation.id])
  );
  await upsertSupplierCosts(
    newRows.map((row) =>
      supplierCostRecord({
        row,
        supplierId,
        sourceName,
        productId: skuToProductId.get(row.sku.toLowerCase()),
        variationId: variationIdBySku.get(row.sku.toLowerCase()) || null,
      })
    )
  );

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n====================================");
  console.log("Import complete!");
  console.log(`  New products imported: ${insertedProducts.length}`);
  console.log(`  Variations created:    ${insertedVariations.length}`);
  console.log(`  Inventory rows seeded: ${inventoryRecords.length}`);
  console.log(`  Supplier refs written: ${existingSupplierCostMetas.length + newRows.length}`);
  console.log(`  Skipped (already in DB): ${dupCount}`);
  console.log(`  Skipped (invalid rows):  ${Object.values(skipped).reduce((a, b) => a + b, 0)}`);
  console.log("\nAll new products use the placeholder image.");
  console.log("Categories can be assigned via the admin panel or Square.");
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
