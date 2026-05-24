#!/usr/bin/env node
/**
 * DS Racing Karts - DPE CSV migration helper
 *
 * Mapping:
 *   SKU            -> product / variation SKU
 *   Option1 Value  -> item name (fallback: Description, Handle)
 *   WS             -> wholesale/cost reference in product_supplier_costs
 *   RRP            -> sell price imported into Supabase
 *   Vendor         -> DPE in suppliers / product_supplier_costs
 *
 * Usage:
 *   node scripts/import-dpe-csv.js "C:\Users\belac\Downloads\DPE Product Export.csv" --dry-run
 *   node scripts/import-dpe-csv.js "C:\Users\belac\Downloads\DPE Product Export.csv"
 *
 * New products are inserted into Supabase only. Existing matches are not
 * duplicated; their DPE supplier cost is stored against the matched variation.
 * Run push-stocklist-to-square.js afterwards to create missing Square catalog
 * items. Square's native vendor/unit-cost fields still need Square Dashboard
 * import/tooling; this script preserves the source data locally and exports a
 * review file for that step.
 */

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const PLACEHOLDER_IMAGE = "/images/image-coming-soon.svg";
const VENDOR = "DPE";
const BATCH_SIZE = 100;
const PAGE_SIZE = 1000;

const isDryRun = process.argv.includes("--dry-run");
const filePath = process.argv.find(
  (arg) => !arg.startsWith("-") && arg.toLowerCase().endsWith(".csv")
);

if (!filePath) {
  console.error("Usage: node scripts/import-dpe-csv.js <path-to-csv> [--dry-run]");
  process.exit(1);
}

const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
  (key) => !process.env[key]
);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeSku(value) {
  const sku = String(value ?? "").trim();
  return sku ? sku.toLowerCase() : "";
}

function parseMoney(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function itemNameFromRow(row) {
  const description = String(row.Description || "").trim();
  if (description) return description;

  const optionValue = String(row["Option1 Value"] || "").trim();
  if (optionValue && normalizeText(optionValue) !== "default title") {
    return optionValue;
  }

  return titleFromHandle(row.Handle);
}

function titleFromHandle(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 120);
}

function uniqueSlug(base, usedSlugs) {
  const cleanBase = base || "dpe-product";
  let candidate = cleanBase;
  let n = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${cleanBase}-${n}`;
    n += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function fetchAll(table, columns) {
  const all = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
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

    if (error) {
      throw new Error(`Supplier cost upsert failed: ${error.message}`);
    }

    written += chunk.length;
    process.stdout.write(
      `\r  Supplier costs ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}   `
    );
  }

  process.stdout.write("\n");
  return written;
}

async function batchInsert(table, records, selectFields = "id") {
  const inserted = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from(table)
      .insert(chunk)
      .select(selectFields);

    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
    inserted.push(...(data || []));
    process.stdout.write(
      `\r  Inserted ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length} into ${table}   `
    );
  }

  process.stdout.write("\n");
  return inserted;
}

function buildReportPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  return {
    reviewPath: resolve(dir, `dpe-import-review-${stamp}.csv`),
    supplierCostPath: resolve(dir, `dpe-supplier-costs-${stamp}.csv`),
  };
}

function addReportRows(reportRows, reason, sourceRow, matches = []) {
  const rowBase = {
    reason,
    vendor: VENDOR,
    dpe_sku: sourceRow.sku,
    dpe_item_name: sourceRow.name,
    dpe_ws: sourceRow.ws ?? "",
    dpe_rrp: sourceRow.rrp ?? "",
  };

  if (matches.length === 0) {
    reportRows.push({
      ...rowBase,
      existing_product_name: "",
      existing_product_sku: "",
      existing_variation_sku: "",
      existing_price: "",
      existing_status: "",
      existing_square_token: "",
      existing_square_url: "",
    });
    return;
  }

  for (const match of matches) {
    reportRows.push({
      ...rowBase,
      existing_product_name: match.product?.name || "",
      existing_product_sku: match.product?.sku || "",
      existing_variation_sku: match.variation?.sku || "",
      existing_price: match.variation?.price ?? match.product?.base_price ?? "",
      existing_status: match.product?.status || "",
    existing_square_token: match.product?.square_token || "",
    existing_square_url: match.product?.square_token
        ? `https://squareup.com/dashboard/items/library/${match.product.square_token}`
        : "",
    });
  }
}

async function main() {
  const resolvedCsv = resolve(filePath);
  console.log("DS Racing Karts - DPE CSV Import");
  console.log("================================");
  console.log(`File: ${resolvedCsv}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN (no database writes)" : "LIVE"}`);
  console.log();

  const records = parse(readFileSync(resolvedCsv, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Parsed ${records.length} CSV row(s).`);
  const supplierId = isDryRun
    ? "00000000-0000-0000-0000-000000000000"
    : await ensureSupplier(VENDOR);

  const rows = records.map((row, index) => ({
    sourceIndex: index + 2,
    sku: String(row.SKU ?? "").trim(),
    skuKey: normalizeSku(row.SKU),
    name: itemNameFromRow(row),
    nameKey: normalizeText(itemNameFromRow(row)),
    ws: parseMoney(row.WS),
    rrp: parseMoney(row.RRP),
    raw: row,
  }));

  console.log("Loading existing Supabase products and variations...");
  const [products, variations] = await Promise.all([
    fetchAll("products", "id, name, slug, sku, status, square_token, base_price"),
    fetchAll("product_variations", "id, product_id, name, sku, price"),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));
  const variationsByProductId = new Map();
  for (const variation of variations) {
    if (!variationsByProductId.has(variation.product_id)) {
      variationsByProductId.set(variation.product_id, []);
    }
    variationsByProductId.get(variation.product_id).push(variation);
  }
  const usedSlugs = new Set(products.map((product) => product.slug).filter(Boolean));
  const existingSkuMap = new Map();
  const existingNameMap = new Map();

  for (const variation of variations) {
    const key = normalizeSku(variation.sku);
    if (!key) continue;
    const product = productById.get(variation.product_id);
    if (!product) continue;
    if (!existingSkuMap.has(key)) existingSkuMap.set(key, []);
    existingSkuMap.get(key).push({ product, variation });
  }

  for (const product of products) {
    const key = normalizeText(product.name);
    if (!key) continue;
    if (!existingNameMap.has(key)) existingNameMap.set(key, []);
    existingNameMap.get(key).push({
      product,
      variation: variationsByProductId.get(product.id)?.[0] || null,
    });
  }

  const fileSkuCounts = new Map();
  const fileNameCounts = new Map();
  for (const row of rows) {
    if (row.skuKey) fileSkuCounts.set(row.skuKey, (fileSkuCounts.get(row.skuKey) || 0) + 1);
    if (row.nameKey) fileNameCounts.set(row.nameKey, (fileNameCounts.get(row.nameKey) || 0) + 1);
  }

  const reportRows = [];
  const importRows = [];
  const matchedSupplierCostRows = [];
  const seenImportSkus = new Set();
  const stats = {
    missingSku: 0,
    missingName: 0,
    badRrp: 0,
    duplicateSkuInFile: 0,
    duplicateNameInFile: 0,
    duplicateExistingSku: 0,
    existingSku: 0,
    existingName: 0,
    importable: 0,
  };

  for (const row of rows) {
    if (!row.skuKey) {
      stats.missingSku += 1;
      addReportRows(reportRows, "missing_sku", row);
      continue;
    }
    if (!row.nameKey) {
      stats.missingName += 1;
      addReportRows(reportRows, "missing_item_name", row);
      continue;
    }
    if (row.rrp == null) {
      stats.badRrp += 1;
      addReportRows(reportRows, "missing_or_invalid_rrp", row);
      continue;
    }
    if ((fileSkuCounts.get(row.skuKey) || 0) > 1) {
      stats.duplicateSkuInFile += 1;
      addReportRows(reportRows, "duplicate_sku_in_dpe_file", row);
      continue;
    }
    if ((fileNameCounts.get(row.nameKey) || 0) > 1) {
      stats.duplicateNameInFile += 1;
      addReportRows(reportRows, "duplicate_name_in_dpe_file", row);
      continue;
    }

    const skuMatches = existingSkuMap.get(row.skuKey) || [];
    if (skuMatches.length > 1) {
      stats.duplicateExistingSku += 1;
      addReportRows(reportRows, "duplicate_existing_sku_match", row, skuMatches);
      continue;
    }
    if (skuMatches.length === 1) {
      stats.existingSku += 1;
      addReportRows(reportRows, "existing_sku_match", row, skuMatches);
      const preferred = skuMatches[0];
      if (preferred?.product && preferred?.variation) {
        matchedSupplierCostRows.push({
          product_id: preferred.product.id,
          variation_id: preferred.variation.id,
          supplier_id: supplierId,
          supplier_sku: row.sku,
          supplier_item_name: row.name,
          wholesale_price: row.ws,
          retail_price: row.rrp,
          currency: "AUD",
          source: "DPE Product Export.csv",
          source_row_number: row.sourceIndex,
          updated_at: new Date().toISOString(),
        });
      }
      continue;
    }

    const nameMatches = existingNameMap.get(row.nameKey) || [];
    if (nameMatches.length > 0) {
      stats.existingName += 1;
      addReportRows(reportRows, "existing_name_match", row, nameMatches);
      const preferred = nameMatches.find((match) => match.product?.status === "active") || nameMatches[0];
      if (preferred?.product) {
        matchedSupplierCostRows.push({
          product_id: preferred.product.id,
          variation_id: preferred.variation?.id || null,
          supplier_id: supplierId,
          supplier_sku: row.sku,
          supplier_item_name: row.name,
          wholesale_price: row.ws,
          retail_price: row.rrp,
          currency: "AUD",
          source: "DPE Product Export.csv",
          source_row_number: row.sourceIndex,
          updated_at: new Date().toISOString(),
        });
      }
      continue;
    }

    if (seenImportSkus.has(row.skuKey)) {
      stats.duplicateSkuInFile += 1;
      addReportRows(reportRows, "duplicate_sku_in_import_set", row);
      continue;
    }

    seenImportSkus.add(row.skuKey);
    importRows.push(row);
  }

  stats.importable = importRows.length;

  const { reviewPath, supplierCostPath } = buildReportPath();
  const reportHeaders = [
    "reason",
    "vendor",
    "dpe_sku",
    "dpe_item_name",
    "dpe_ws",
    "dpe_rrp",
    "existing_product_name",
    "existing_product_sku",
    "existing_variation_sku",
    "existing_price",
    "existing_status",
    "existing_square_token",
    "existing_square_url",
  ];
  const reportCsv = [
    reportHeaders.join(","),
    ...reportRows.map((row) => reportHeaders.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
  writeFileSync(reviewPath, reportCsv, "utf8");

  const supplierCostHeaders = [
    "import_action",
    "vendor",
    "sku",
    "item_name",
    "wholesale_price",
    "retail_price",
    "matched_product_name",
    "matched_variation_sku",
    "matched_square_token",
    "matched_square_url",
  ];
  const supplierCostExportRows = [];
  const addSupplierCostExportRow = (action, row, match = null) => {
    supplierCostExportRows.push({
      import_action: action,
      vendor: VENDOR,
      sku: row.sku,
      item_name: row.name,
      wholesale_price: row.ws ?? "",
      retail_price: row.rrp ?? "",
      matched_product_name: match?.product?.name || "",
      matched_variation_sku: match?.variation?.sku || "",
      matched_square_token: match?.product?.square_token || "",
      matched_square_url: match?.product?.square_token
        ? `https://squareup.com/dashboard/items/library/${match.product.square_token}`
        : "",
    });
  };

  for (const row of importRows) addSupplierCostExportRow("new_product", row);
  for (const row of rows) {
    if (!row.skuKey || !row.nameKey || row.rrp == null) continue;
    if ((fileSkuCounts.get(row.skuKey) || 0) > 1 || (fileNameCounts.get(row.nameKey) || 0) > 1) continue;
    const skuMatches = existingSkuMap.get(row.skuKey) || [];
    if (skuMatches.length > 1) continue;
    const nameMatches = existingNameMap.get(row.nameKey) || [];
    const matches = skuMatches.length > 0 ? skuMatches : nameMatches;
    if (matches.length === 0) continue;
    const preferred = matches.find((match) => match.product?.status === "active") || matches[0];
    addSupplierCostExportRow(skuMatches.length > 0 ? "existing_sku_match" : "existing_name_match", row, preferred);
  }

  const supplierCostCsv = [
    supplierCostHeaders.join(","),
    ...supplierCostExportRows.map((row) =>
      supplierCostHeaders.map((header) => csvEscape(row[header])).join(",")
    ),
  ].join("\n");
  writeFileSync(supplierCostPath, supplierCostCsv, "utf8");

  console.log();
  console.log("Review summary:");
  console.log(`  Missing SKU:                 ${stats.missingSku}`);
  console.log(`  Missing item name:           ${stats.missingName}`);
  console.log(`  Missing/invalid RRP:         ${stats.badRrp}`);
  console.log(`  Duplicate SKU in DPE file:   ${stats.duplicateSkuInFile}`);
  console.log(`  Duplicate name in DPE file:  ${stats.duplicateNameInFile}`);
  console.log(`  Duplicate existing SKU held: ${stats.duplicateExistingSku}`);
  console.log(`  Existing SKU matches:        ${stats.existingSku}`);
  console.log(`  Existing name matches:       ${stats.existingName}`);
  console.log(`  Supplier-cost rows on matches:${matchedSupplierCostRows.length}`);
  console.log(`  Importable new rows:         ${stats.importable}`);
  console.log(`  Review report:               ${reviewPath}`);
  console.log(`  Supplier-cost export:        ${supplierCostPath}`);

  if (importRows.length === 0) {
    if (!isDryRun && matchedSupplierCostRows.length > 0) {
      console.log("\nWriting supplier costs for existing matches...");
      await upsertSupplierCosts(matchedSupplierCostRows);
    }
    console.log("\nNo new products to import.");
    return;
  }

  if (isDryRun) {
    console.log("\nDry-run sample of safe new rows:");
    for (const row of importRows.slice(0, 12)) {
      console.log(`  [${row.sku}] ${row.name} - RRP $${row.rrp.toFixed(2)} / WS ${row.ws ?? ""}`);
    }
    if (importRows.length > 12) console.log(`  ... and ${importRows.length - 12} more`);
    console.log("\nRun without --dry-run to insert these into Supabase and store supplier costs.");
    return;
  }

  if (matchedSupplierCostRows.length > 0) {
    console.log("\nWriting supplier costs for existing matches...");
    await upsertSupplierCosts(matchedSupplierCostRows);
  }

  console.log("\nInserting products...");
  const productRecords = importRows.map((row) => ({
    name: row.name,
    slug: uniqueSlug(slugify(row.name), usedSlugs),
    sku: row.sku,
    status: "active",
    visibility: "visible",
    item_type: "Physical good",
    base_price: row.rrp,
    shipping_enabled: true,
    is_sellable: true,
    is_stockable: true,
    is_archived: false,
    primary_image_url: PLACEHOLDER_IMAGE,
  }));

  const insertedProducts = await batchInsert("products", productRecords, "id, sku");
  const productIdBySku = new Map(
    insertedProducts.map((product) => [normalizeSku(product.sku), product.id])
  );

  console.log("\nInserting variations...");
  const variationRecords = importRows.map((row) => ({
    product_id: productIdBySku.get(row.skuKey),
    name: "Regular",
    sku: row.sku,
    price: row.rrp,
    sort_order: 0,
  }));

  const insertedVariations = await batchInsert(
    "product_variations",
    variationRecords,
    "id, sku"
  );

  console.log("\nWriting supplier costs for new products...");
  const newSupplierCostRows = importRows.map((row) => {
    const variation = insertedVariations.find(
      (insertedVariation) => normalizeSku(insertedVariation.sku) === row.skuKey
    );
    return {
      product_id: productIdBySku.get(row.skuKey),
      variation_id: variation?.id || null,
      supplier_id: supplierId,
      supplier_sku: row.sku,
      supplier_item_name: row.name,
      wholesale_price: row.ws,
      retail_price: row.rrp,
      currency: "AUD",
      source: "DPE Product Export.csv",
      source_row_number: row.sourceIndex,
      updated_at: new Date().toISOString(),
    };
  });
  await upsertSupplierCosts(newSupplierCostRows);

  console.log("\nSeeding zero inventory...");
  await batchInsert(
    "inventory",
    insertedVariations.map((variation) => ({
      variation_id: variation.id,
      quantity: 0,
    })),
    "id"
  );

  console.log();
  console.log("Import complete.");
  console.log(`  Products inserted:   ${insertedProducts.length}`);
  console.log(`  Variations inserted: ${insertedVariations.length}`);
  console.log(`  Inventory rows:      ${insertedVariations.length}`);
  console.log(`  Supplier costs:      ${matchedSupplierCostRows.length + newSupplierCostRows.length}`);
  console.log("Next step: run scripts/push-stocklist-to-square.js to create missing Square items.");
}

main().catch((error) => {
  console.error("\nFatal error:", error.message || error);
  process.exit(1);
});
