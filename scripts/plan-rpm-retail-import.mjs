#!/usr/bin/env node
/**
 * DS Racing Karts - RPM retail list import planner
 *
 * This is intentionally a no-write script. It parses the RPM retail workbook,
 * checks current Supabase SKUs, and exports a review plan showing which rows
 * can safely become new grouped products/variations.
 *
 * Usage:
 *   node scripts/plan-rpm-retail-import.mjs "C:\Users\belac\Downloads\Copy of 260430 FULL RETAIL LIST.xlsx"
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const PAGE_SIZE = 1000;
const VENDOR = "RPM";

const filePath = process.argv.find((arg) => {
  const lower = arg.toLowerCase();
  return !arg.startsWith("-") && (lower.endsWith(".xlsx") || lower.endsWith(".xls"));
});

if (!filePath) {
  console.error(
    'Usage: node scripts/plan-rpm-retail-import.mjs "C:\\Users\\belac\\Downloads\\Copy of 260430 FULL RETAIL LIST.xlsx"'
  );
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

const COLOUR_TOKENS = new Set([
  "ASH",
  "BEIGE",
  "BLACK",
  "BLK",
  "BLUE",
  "BLU",
  "BROWN",
  "CARBON",
  "CHARCOAL",
  "CHROME",
  "CLEAR",
  "FLUO",
  "GOLD",
  "GREEN",
  "GREY",
  "GRN",
  "GRY",
  "GUNMETAL",
  "LIME",
  "NAVY",
  "ORANGE",
  "PINK",
  "PURPLE",
  "RED",
  "SIL",
  "SILVER",
  "SMOKE",
  "TAN",
  "WHT",
  "WHITE",
  "YELLOW",
]);

const COLOUR_MODIFIERS = new Set([
  "CANDY",
  "DARK",
  "GLOSS",
  "LIGHT",
  "MATT",
  "MATTE",
  "METALLIC",
  "NEON",
]);

const SIZE_TOKENS = new Set([
  "XXS",
  "XS",
  "S",
  "SM",
  "M",
  "MED",
  "L",
  "LG",
  "XL",
  "XXL",
  "XXXL",
  "XXXXL",
  "JNR",
  "JR",
  "SNR",
  "SR",
]);

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function normalizeSku(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, "");
  }
  return String(value).trim();
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function toTitleCase(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bRpm\b/g, "RPM")
    .replace(/\bFia\b/g, "FIA")
    .replace(/\bCmr\b/g, "CMR")
    .replace(/\bV([0-9])\b/g, "V$1");
}

function parseMoney(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseRows(workbookPath) {
  const workbook = XLSX.readFile(resolve(workbookPath));
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const parsed = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const sku = normalizeSku(row[0]);
    const name = String(row[1] ?? "").trim();
    const price = parseMoney(row[2]);

    if (!sku || !name || price == null) continue;
    if (/^description$/i.test(sku) || /^retail$/i.test(name)) continue;

    parsed.push({
      source_row: index + 1,
      sku,
      sku_key: sku.toLowerCase(),
      source_name: name.replace(/\s+/g, " ").trim(),
      price,
    });
  }

  return { sheetName, rows: parsed };
}

function splitName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function splitParts(value) {
  return String(value ?? "")
    .toUpperCase()
    .split(/[/-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isNumericSize(token) {
  return /^(?:[0-9]{1,3}(?:\.[0-9])?|[0-9]{1,3}[A-Z]?)$/.test(token);
}

function isDimensionSize(token) {
  return /^(?:[0-9]+(?:\.[0-9]+)?)(?:MM|CM|IN|")$/.test(token);
}

function isAlphaSize(token) {
  return SIZE_TOKENS.has(token);
}

function isSizeToken(token) {
  const clean = String(token ?? "").toUpperCase().replace(/[^A-Z0-9."]/g, "");
  return isAlphaSize(clean) || isNumericSize(clean) || isDimensionSize(clean);
}

function isColourToken(token) {
  const clean = String(token ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return COLOUR_TOKENS.has(clean) || COLOUR_MODIFIERS.has(clean);
}

function isColourCombo(token) {
  const parts = splitParts(token);
  return parts.length > 0 && parts.every((part) => isColourToken(part));
}

function parseCompoundVariationToken(token) {
  const parts = splitParts(token);
  if (parts.length < 2) return null;

  const finalPart = parts[parts.length - 1];
  const colourParts = parts.slice(0, -1);
  if (!isSizeToken(finalPart)) return null;
  if (!colourParts.every((part) => isColourToken(part))) return null;

  return {
    label: `${colourParts.join("/")} / ${finalPart}`,
    options: [
      { name: "Colour", value: colourParts.join("/") },
      { name: "Size", value: finalPart },
    ],
  };
}

function cleanBaseTokens(tokens) {
  return tokens
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+(SIZE|SIZES)$/i, "")
    .trim();
}

function inferBaseAndVariation(sourceName) {
  const tokens = splitName(sourceName);
  const baseTokens = [...tokens];
  const variationPieces = [];
  const options = [];
  let sawExplicitSizeMarker = false;
  let confidence = "low";

  while (baseTokens.length > 2) {
    const token = baseTokens[baseTokens.length - 1];
    const upper = token.toUpperCase();
    const compound = parseCompoundVariationToken(upper);

    if (compound) {
      baseTokens.pop();
      variationPieces.unshift(compound.label);
      options.unshift(...compound.options);
      confidence = "high";
      continue;
    }

    if (isSizeToken(upper)) {
      baseTokens.pop();
      let sizeValue = upper;
      if (/^0[0-9]$/.test(sizeValue)) sizeValue = sizeValue.slice(1);
      variationPieces.unshift(sawExplicitSizeMarker ? `Size ${sizeValue}` : sizeValue);
      options.unshift({ name: "Size", value: sizeValue });
      confidence = sawExplicitSizeMarker || confidence === "high" ? "high" : "medium";

      const previous = baseTokens[baseTokens.length - 1]?.toUpperCase();
      if (previous === "SIZE" || previous === "SIZES") {
        baseTokens.pop();
        sawExplicitSizeMarker = true;
        if (!variationPieces[0].startsWith("Size ")) {
          variationPieces[0] = `Size ${variationPieces[0]}`;
        }
        confidence = "high";
      }
      continue;
    }

    if (isColourCombo(upper)) {
      baseTokens.pop();
      variationPieces.unshift(splitParts(upper).join("/"));
      options.unshift({ name: "Colour", value: splitParts(upper).join("/") });
      confidence = confidence === "high" ? "high" : "medium";
      continue;
    }

    break;
  }

  const baseName = cleanBaseTokens(baseTokens);
  const variationName = variationPieces.length > 0 ? variationPieces.join(" / ") : "Regular";
  const baseKey = normalizeKey(baseName || sourceName);

  return {
    proposed_base_name: baseName || sourceName,
    proposed_variation_name: variationName,
    proposed_group_key: baseKey,
    proposed_options: dedupeOptions(options),
    proposed_confidence: variationPieces.length > 0 ? confidence : "low",
    stripped_suffix: variationPieces.length > 0,
  };
}

function dedupeOptions(options) {
  const seen = new Set();
  const deduped = [];
  for (const option of options) {
    const key = `${option.name}:${option.value}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(option);
  }
  return deduped;
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

function buildOutputPaths() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = resolve(process.cwd(), "tmp");
  mkdirSync(outputDir, { recursive: true });
  return {
    detailPath: resolve(outputDir, `rpm-retail-import-plan-${stamp}.csv`),
    productPath: resolve(outputDir, `rpm-retail-product-groups-${stamp}.csv`),
    summaryPath: resolve(outputDir, `rpm-retail-import-summary-${stamp}.json`),
  };
}

function writeCsv(file, headers, rows) {
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
  writeFileSync(file, csv, "utf8");
}

function priceRange(rows) {
  const prices = rows.map((row) => row.price).filter((price) => Number.isFinite(price));
  if (prices.length === 0) return "";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? min.toFixed(2) : `${min.toFixed(2)}-${max.toFixed(2)}`;
}

function groupConfidence(rows) {
  if (rows.length <= 1) return "single";
  if (rows.every((row) => row.proposed_confidence === "high")) return "high";
  if (rows.some((row) => row.proposed_confidence === "high" || row.proposed_confidence === "medium")) {
    return "medium";
  }
  return "low";
}

async function main() {
  const resolvedFile = resolve(filePath);
  console.log("DS Racing Karts - RPM Retail Import Planner");
  console.log("===========================================");
  console.log(`File: ${resolvedFile}`);
  console.log("Mode: DRY RUN / REVIEW ONLY (no database or Square writes)");
  console.log();

  const { sheetName, rows } = parseRows(resolvedFile);
  console.log(`Parsed ${rows.length} valid retail row(s) from "${sheetName}".`);

  console.log("Loading existing Supabase products and SKUs...");
  const [products, variations] = await Promise.all([
    fetchAll("products", "id, name, slug, sku, status, square_token"),
    fetchAll("product_variations", "id, product_id, name, sku, price, square_token"),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));
  const existingSkuMap = new Map();
  for (const variation of variations) {
    const key = String(variation.sku ?? "").trim().toLowerCase();
    if (!key) continue;
    if (!existingSkuMap.has(key)) existingSkuMap.set(key, []);
    existingSkuMap.get(key).push({
      product: productById.get(variation.product_id),
      variation,
    });
  }

  const enrichedRows = rows.map((row) => ({
    ...row,
    ...inferBaseAndVariation(row.source_name),
    existing_matches: existingSkuMap.get(row.sku_key) || [],
  }));

  const allRowsByGroup = new Map();
  for (const row of enrichedRows) {
    if (!allRowsByGroup.has(row.proposed_group_key)) {
      allRowsByGroup.set(row.proposed_group_key, []);
    }
    allRowsByGroup.get(row.proposed_group_key).push(row);
  }

  const detailRows = [];
  const productRows = [];
  const stats = {
    source_rows: rows.length,
    existing_sku_rows: 0,
    manual_review_related_existing_sku: 0,
    planned_create_variations: 0,
    planned_create_products: 0,
    duplicate_skus_in_file: 0,
    high_confidence_groups: 0,
    medium_confidence_groups: 0,
    low_confidence_groups: 0,
    single_row_products: 0,
  };

  const fileSkuCounts = new Map();
  for (const row of rows) {
    fileSkuCounts.set(row.sku_key, (fileSkuCounts.get(row.sku_key) || 0) + 1);
  }

  const plannedGroups = new Map();

  for (const [groupKey, groupRows] of allRowsByGroup) {
    const hasExistingInGroup = groupRows.some((row) => row.existing_matches.length > 0);
    const newRows = groupRows.filter((row) => row.existing_matches.length === 0);
    const groupHasDuplicateFileSku = groupRows.some((row) => (fileSkuCounts.get(row.sku_key) || 0) > 1);

    for (const row of groupRows) {
      const existingMatch = row.existing_matches[0];
      let action = "create_product_variation";
      let plannedProductName = row.proposed_base_name;
      let plannedVariationName = row.proposed_variation_name;
      let note = "";

      if ((fileSkuCounts.get(row.sku_key) || 0) > 1) {
        action = "manual_review_duplicate_sku_in_file";
        note = "SKU appears more than once in the source workbook.";
        stats.duplicate_skus_in_file += 1;
      } else if (row.existing_matches.length > 0) {
        action = "skip_existing_sku";
        plannedProductName = existingMatch?.product?.name || "";
        plannedVariationName = existingMatch?.variation?.name || "";
        note = "SKU already exists in the website database.";
        stats.existing_sku_rows += 1;
      } else if (hasExistingInGroup) {
        action = "manual_review_related_existing_sku";
        note =
          "This looks like a variation of a product where at least one SKU already exists. Add to the existing Square item manually or handle with a later variation-append tool.";
        stats.manual_review_related_existing_sku += 1;
      } else if (groupHasDuplicateFileSku) {
        action = "manual_review_group_has_duplicate_sku";
        note = "Another row in this inferred product group has a duplicate source SKU.";
      } else if (newRows.length === 1) {
        plannedProductName = row.source_name;
        plannedVariationName = "Regular";
        note = "Single new row; kept as standalone product to avoid unsafe over-grouping.";
      } else {
        note = "New grouped product candidate.";
      }

      if (action === "create_product_variation") {
        if (!plannedGroups.has(groupKey)) plannedGroups.set(groupKey, []);
        plannedGroups.get(groupKey).push({
          ...row,
          planned_product_name: plannedProductName,
          planned_variation_name: plannedVariationName,
        });
        stats.planned_create_variations += 1;
      }

      detailRows.push({
        action,
        vendor: VENDOR,
        source_row: row.source_row,
        source_sku: row.sku,
        source_name: row.source_name,
        retail_price: row.price.toFixed(2),
        planned_product_name: plannedProductName,
        planned_variation_name: plannedVariationName,
        planned_options: row.proposed_options
          .map((option) => `${option.name}=${option.value}`)
          .join("; "),
        inferred_group_key: groupKey,
        inferred_group_size: groupRows.length,
        inferred_group_new_rows: newRows.length,
        confidence: row.proposed_confidence,
        existing_product_name: existingMatch?.product?.name || "",
        existing_variation_sku: existingMatch?.variation?.sku || "",
        note,
      });
    }
  }

  for (const [groupKey, groupRows] of plannedGroups) {
    const confidence = groupConfidence(groupRows);
    const first = groupRows[0];
    stats.planned_create_products += 1;
    if (groupRows.length === 1) stats.single_row_products += 1;
    if (confidence === "high") stats.high_confidence_groups += 1;
    else if (confidence === "medium") stats.medium_confidence_groups += 1;
    else stats.low_confidence_groups += 1;

    productRows.push({
      vendor: VENDOR,
      action: "planned_create_product",
      inferred_group_key: groupKey,
      planned_product_name: first.planned_product_name,
      variation_count: groupRows.length,
      confidence,
      price_range: priceRange(groupRows),
      sample_skus: groupRows
        .slice(0, 8)
        .map((row) => row.sku)
        .join("; "),
      sample_variations: groupRows
        .slice(0, 8)
        .map((row) => row.planned_variation_name)
        .join("; "),
      sample_source_names: groupRows
        .slice(0, 4)
        .map((row) => row.source_name)
        .join("; "),
      note:
        groupRows.length === 1
          ? "Standalone product."
          : "Grouped product candidate; review manufacturer/size/colour split before live import.",
    });
  }

  const { detailPath, productPath, summaryPath } = buildOutputPaths();
  writeCsv(
    detailPath,
    [
      "action",
      "vendor",
      "source_row",
      "source_sku",
      "source_name",
      "retail_price",
      "planned_product_name",
      "planned_variation_name",
      "planned_options",
      "inferred_group_key",
      "inferred_group_size",
      "inferred_group_new_rows",
      "confidence",
      "existing_product_name",
      "existing_variation_sku",
      "note",
    ],
    detailRows
  );
  writeCsv(
    productPath,
    [
      "vendor",
      "action",
      "inferred_group_key",
      "planned_product_name",
      "variation_count",
      "confidence",
      "price_range",
      "sample_skus",
      "sample_variations",
      "sample_source_names",
      "note",
    ],
    productRows
  );
  writeFileSync(summaryPath, JSON.stringify(stats, null, 2), "utf8");

  console.log();
  console.log("Plan summary:");
  console.log(`  Source rows parsed:             ${stats.source_rows}`);
  console.log(`  Existing SKU rows skipped:      ${stats.existing_sku_rows}`);
  console.log(
    `  Held for related-product review:${stats.manual_review_related_existing_sku}`
  );
  console.log(`  Planned new products:           ${stats.planned_create_products}`);
  console.log(`  Planned new variations:         ${stats.planned_create_variations}`);
  console.log(`  Single-row standalone products: ${stats.single_row_products}`);
  console.log(`  High-confidence groups:         ${stats.high_confidence_groups}`);
  console.log(`  Medium-confidence groups:       ${stats.medium_confidence_groups}`);
  console.log(`  Low-confidence groups:          ${stats.low_confidence_groups}`);
  console.log();
  console.log(`Detail review CSV:  ${detailPath}`);
  console.log(`Product groups CSV: ${productPath}`);
  console.log(`Summary JSON:       ${summaryPath}`);
  console.log();
  console.log("No database or Square changes were made.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
