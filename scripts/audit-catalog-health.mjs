#!/usr/bin/env node
/**
 * DS Racing Karts - Catalog health audit
 *
 * Read-only audit of Supabase <-> Square catalog integrity:
 * - duplicate local/Square SKUs and product names
 * - missing/stale Square product/category/variation mappings
 * - product image coverage and placeholder usage
 * - price/name drift on token-matched records
 *
 * Usage:
 *   node scripts/audit-catalog-health.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { Client, Environment } from "square";
import dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const PAGE_SIZE = 1000;
const PLACEHOLDER_IMAGE = "/images/image-coming-soon.svg";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SQUARE_ACCESS_TOKEN",
].filter((key) => !process.env[key]);

if (required.length > 0) {
  console.error(`Missing environment variables: ${required.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeSku(value) {
  return String(value ?? "").trim().toLowerCase();
}

function centsToDollars(value) {
  if (value == null) return null;
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(numeric) ? numeric / 100 : null;
}

function moneyToCents(value) {
  if (value == null || value === "") return null;
  const numeric = Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function isMissingImageUrl(value) {
  return !String(value ?? "").trim();
}

function isPlaceholderUrl(value) {
  return String(value ?? "").trim() === PLACEHOLDER_IMAGE;
}

function isRealImageUrl(value) {
  const url = String(value ?? "").trim();
  return Boolean(url) && url !== PLACEHOLDER_IMAGE && !url.includes("image-coming-soon");
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sample(values, limit = 8) {
  return values.slice(0, limit).join(" | ");
}

function addFinding(findings, bucket, severity, key, count, detail, samples = []) {
  findings.push({
    bucket,
    severity,
    key,
    count,
    detail,
    samples: sample(samples),
  });
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

async function listSquareObjects(types) {
  const objects = [];
  let cursor;

  do {
    const { result, errors } = await square.catalogApi.listCatalog(cursor, types);
    if (errors && errors.length > 0) {
      throw new Error(
        `Square listCatalog ${types} failed: ${errors
          .map((error) => error.detail || error.code)
          .join("; ")}`
      );
    }
    objects.push(...(result.objects || []));
    cursor = result.cursor;
  } while (cursor);

  return objects;
}

async function searchSquareCategories() {
  const objects = [];
  let cursor;

  do {
    const { result, errors } = await square.catalogApi.searchCatalogObjects({
      cursor,
      objectTypes: ["CATEGORY"],
      limit: 1000,
    });
    if (errors && errors.length > 0) {
      throw new Error(
        `Square category search failed: ${errors
          .map((error) => error.detail || error.code)
          .join("; ")}`
      );
    }
    objects.push(...(result.objects || []));
    cursor = result.cursor;
  } while (cursor);

  return objects;
}

function bucketBy(rows, keyFn) {
  const buckets = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return buckets;
}

function duplicateBuckets(buckets, isDuplicate = (rows) => rows.length > 1) {
  return [...buckets.entries()].filter(([, rows]) => isDuplicate(rows));
}

function squareItemName(item) {
  return item.itemData?.name || "(unnamed Square item)";
}

function squareVariationData(variation) {
  return variation.itemVariationData || {};
}

function buildOutputPaths() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  return {
    summaryPath: resolve(dir, `catalog-health-summary-${stamp}.json`),
    findingsPath: resolve(dir, `catalog-health-findings-${stamp}.csv`),
  };
}

function writeFindingsCsv(filePath, findings) {
  const headers = ["bucket", "severity", "key", "count", "detail", "samples"];
  const csv = [
    headers.join(","),
    ...findings.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
  writeFileSync(filePath, csv, "utf8");
}

async function main() {
  console.log("DS Racing Karts - Catalog Health Audit");
  console.log("=======================================");
  console.log("Mode: READ ONLY");
  console.log();

  const [
    products,
    variations,
    productImages,
    categories,
    productCategories,
    squareItems,
    squareCategories,
  ] = await Promise.all([
    fetchAll(
      "products",
      "id, name, slug, sku, status, visibility, square_token, base_price, primary_image_url"
    ),
    fetchAll("product_variations", "id, product_id, name, sku, square_token, price"),
    fetchAll("product_images", "id, product_id, url, is_primary, sort_order"),
    fetchAll("categories", "id, name, slug, parent_id, square_id"),
    fetchAll("product_categories", "product_id, category_id"),
    listSquareObjects("ITEM"),
    searchSquareCategories(),
  ]);

  const activeProducts = products.filter((product) => product.status === "active");
  const visibleActiveProducts = activeProducts.filter(
    (product) => product.visibility === "visible"
  );
  const activeProductIds = new Set(activeProducts.map((product) => product.id));
  const productById = new Map(products.map((product) => [product.id, product]));
  const activeVariations = variations.filter((variation) =>
    activeProductIds.has(variation.product_id)
  );

  const imagesByProductId = bucketBy(productImages, (image) => image.product_id);

  const squareItemById = new Map(squareItems.map((item) => [item.id, item]));
  const squareVariationById = new Map();
  const squareVariationRows = [];
  for (const item of squareItems) {
    for (const variation of item.itemData?.variations || []) {
      squareVariationById.set(variation.id, { item, variation });
      squareVariationRows.push({ item, variation });
    }
  }

  const squareCategoryIds = new Set(squareCategories.map((category) => category.id));
  const localCategorySquareIds = new Set(
    categories.map((category) => category.square_id).filter(Boolean)
  );

  const findings = [];

  const localSkuDupes = duplicateBuckets(bucketBy(activeVariations, (variation) =>
    normalizeSku(variation.sku)
  )).filter(([, rows]) => new Set(rows.map((row) => row.product_id)).size > 1);
  addFinding(
    findings,
    "local_duplicate_skus",
    localSkuDupes.length > 0 ? "high" : "pass",
    "active_variation_sku",
    localSkuDupes.length,
    "Active website variations with the same SKU across multiple products.",
    localSkuDupes.map(([sku, rows]) => `${sku} (${rows.length})`)
  );

  const localNameDupes = duplicateBuckets(bucketBy(activeProducts, (product) =>
    normalizeText(product.name)
  ));
  addFinding(
    findings,
    "local_duplicate_product_names",
    localNameDupes.length > 0 ? "medium" : "pass",
    "active_product_name",
    localNameDupes.length,
    "Active website products with identical normalised names.",
    localNameDupes.map(([name, rows]) => `${name} (${rows.length})`)
  );

  const squareSkuDupes = duplicateBuckets(
    bucketBy(squareVariationRows, ({ variation }) =>
      normalizeSku(squareVariationData(variation).sku)
    )
  );
  addFinding(
    findings,
    "square_duplicate_skus",
    squareSkuDupes.length > 0 ? "high" : "pass",
    "square_variation_sku",
    squareSkuDupes.length,
    "Square variations with duplicated SKUs. These can cause wrong product reconciliation.",
    squareSkuDupes.map(([sku, rows]) => `${sku} (${rows.length})`)
  );

  const squareNameDupes = duplicateBuckets(bucketBy(squareItems, (item) =>
    normalizeText(squareItemName(item))
  ));
  addFinding(
    findings,
    "square_duplicate_item_names",
    squareNameDupes.length > 0 ? "medium" : "pass",
    "square_item_name",
    squareNameDupes.length,
    "Square catalog items with identical normalised names.",
    squareNameDupes.map(([name, rows]) => `${name} (${rows.length})`)
  );

  const localProductsMissingSquare = activeProducts.filter(
    (product) => product.square_token && !squareItemById.has(product.square_token)
  );
  addFinding(
    findings,
    "stale_product_square_tokens",
    localProductsMissingSquare.length > 0 ? "high" : "pass",
    "products.square_token",
    localProductsMissingSquare.length,
    "Active website products whose Square item token is not present in the live Square catalog.",
    localProductsMissingSquare.map((product) => `${product.name} (${product.square_token})`)
  );

  const squareItemsMissingLocal = squareItems.filter((item) => {
    return !products.some((product) => product.square_token === item.id);
  });
  addFinding(
    findings,
    "square_items_missing_local_product",
    squareItemsMissingLocal.length > 0 ? "medium" : "pass",
    "square_item_id",
    squareItemsMissingLocal.length,
    "Square items that do not currently have a local website product by Square token.",
    squareItemsMissingLocal.map((item) => `${squareItemName(item)} (${item.id})`)
  );

  const localVariationsMissingSquare = activeVariations.filter(
    (variation) => variation.square_token && !squareVariationById.has(variation.square_token)
  );
  addFinding(
    findings,
    "stale_variation_square_tokens",
    localVariationsMissingSquare.length > 0 ? "high" : "pass",
    "product_variations.square_token",
    localVariationsMissingSquare.length,
    "Active website variations whose Square variation token is not present in the live Square catalog.",
    localVariationsMissingSquare.map((variation) => {
      const product = productById.get(variation.product_id);
      return `${product?.name || variation.product_id} / ${variation.sku || variation.name}`;
    })
  );

  const localVariationTokens = new Set(
    variations.map((variation) => variation.square_token).filter(Boolean)
  );
  const squareVariationsMissingLocal = squareVariationRows.filter(
    ({ variation }) => !localVariationTokens.has(variation.id)
  );
  addFinding(
    findings,
    "square_variations_missing_local",
    squareVariationsMissingLocal.length > 0 ? "medium" : "pass",
    "square_variation_id",
    squareVariationsMissingLocal.length,
    "Square variations that do not currently have a local website variation by Square token.",
    squareVariationsMissingLocal.map(({ item, variation }) => {
      const data = squareVariationData(variation);
      return `${squareItemName(item)} / ${data.sku || data.name || variation.id}`;
    })
  );

  const productNameDrift = [];
  const productPriceDrift = [];
  for (const product of activeProducts) {
    if (!product.square_token) continue;
    const squareItem = squareItemById.get(product.square_token);
    if (!squareItem) continue;
    const localName = String(product.name || "").trim();
    const remoteName = String(squareItemName(squareItem) || "").trim();
    if (localName && remoteName && localName !== remoteName) {
      productNameDrift.push(`${localName} -> ${remoteName}`);
    }
  }

  for (const variation of activeVariations) {
    if (!variation.square_token) continue;
    const squareMatch = squareVariationById.get(variation.square_token);
    if (!squareMatch) continue;
    const squarePrice = centsToDollars(
      squareVariationData(squareMatch.variation).priceMoney?.amount
    );
    const localCents = moneyToCents(variation.price);
    const squareCents = squarePrice == null ? null : Math.round(squarePrice * 100);
    if (localCents != null && squareCents != null && localCents !== squareCents) {
      const product = productById.get(variation.product_id);
      productPriceDrift.push(
        `${product?.name || variation.product_id} / ${variation.sku || variation.name}: local ${variation.price}, Square ${squarePrice.toFixed(2)}`
      );
    }
  }

  addFinding(
    findings,
    "product_name_drift",
    productNameDrift.length > 0 ? "medium" : "pass",
    "token_matched_products",
    productNameDrift.length,
    "Local active product names that differ from Square for the same Square item token.",
    productNameDrift
  );

  addFinding(
    findings,
    "variation_price_drift",
    productPriceDrift.length > 0 ? "medium" : "pass",
    "token_matched_variations",
    productPriceDrift.length,
    "Local active variation prices that differ from Square for the same Square variation token.",
    productPriceDrift
  );

  const missingPrimaryImages = visibleActiveProducts.filter((product) =>
    isMissingImageUrl(product.primary_image_url)
  );
  const placeholderPrimaryImages = visibleActiveProducts.filter((product) =>
    isPlaceholderUrl(product.primary_image_url)
  );
  const realPrimaryImages = visibleActiveProducts.filter((product) =>
    isRealImageUrl(product.primary_image_url)
  );
  const visibleProductsNoRealImageRows = visibleActiveProducts.filter((product) => {
    const rows = imagesByProductId.get(product.id) || [];
    return rows.every((image) => !isRealImageUrl(image.url));
  });
  const visibleProductsWithImageRowsButNoPrimary = visibleActiveProducts.filter((product) => {
    const rows = imagesByProductId.get(product.id) || [];
    return isMissingImageUrl(product.primary_image_url) && rows.some((image) => isRealImageUrl(image.url));
  });

  addFinding(
    findings,
    "missing_primary_images",
    missingPrimaryImages.length > 0 ? "medium" : "pass",
    "products.primary_image_url",
    missingPrimaryImages.length,
    `Visible active products with NULL/empty primary image. These should be ${PLACEHOLDER_IMAGE} when no real image exists.`,
    missingPrimaryImages.map((product) => product.name)
  );

  addFinding(
    findings,
    "products_with_image_rows_but_no_primary",
    visibleProductsWithImageRowsButNoPrimary.length > 0 ? "medium" : "pass",
    "product_images",
    visibleProductsWithImageRowsButNoPrimary.length,
    "Visible active products that have real product_images rows but no primary image URL.",
    visibleProductsWithImageRowsButNoPrimary.map((product) => product.name)
  );

  const squareItemsWithoutImages = squareItems.filter(
    (item) => !item.itemData?.imageIds || item.itemData.imageIds.length === 0
  );
  addFinding(
    findings,
    "square_items_without_images",
    squareItemsWithoutImages.length > 0 ? "medium" : "pass",
    "square.itemData.imageIds",
    squareItemsWithoutImages.length,
    "Square items without attached image IDs. Website can still use the local branded fallback, but Square itself has no image.",
    squareItemsWithoutImages.map(squareItemName)
  );

  const localCategoryDupes = duplicateBuckets(bucketBy(categories, (category) => {
    const parent = category.parent_id || "root";
    return `${parent}:${normalizeText(category.name)}`;
  }));
  addFinding(
    findings,
    "local_duplicate_categories_same_parent",
    localCategoryDupes.length > 0 ? "medium" : "pass",
    "category_parent_and_name",
    localCategoryDupes.length,
    "Local categories with the same normalised name under the same parent.",
    localCategoryDupes.map(([key, rows]) => `${key} (${rows.length})`)
  );

  const localCategorySquareDupes = duplicateBuckets(
    bucketBy(categories, (category) => category.square_id || "")
  );
  addFinding(
    findings,
    "local_duplicate_category_square_ids",
    localCategorySquareDupes.length > 0 ? "high" : "pass",
    "categories.square_id",
    localCategorySquareDupes.length,
    "Multiple local categories pointing at the same Square category ID.",
    localCategorySquareDupes.map(([id, rows]) => `${id} (${rows.length})`)
  );

  const staleCategories = categories.filter(
    (category) => category.square_id && !squareCategoryIds.has(category.square_id)
  );
  addFinding(
    findings,
    "stale_category_square_ids",
    staleCategories.length > 0 ? "medium" : "pass",
    "categories.square_id",
    staleCategories.length,
    "Local categories whose Square category ID is not present in Square.",
    staleCategories.map((category) => `${category.name} (${category.square_id})`)
  );

  const squareCategoriesMissingLocal = squareCategories.filter(
    (category) => !localCategorySquareIds.has(category.id)
  );
  addFinding(
    findings,
    "square_categories_missing_local",
    squareCategoriesMissingLocal.length > 0 ? "medium" : "pass",
    "square_category_id",
    squareCategoriesMissingLocal.length,
    "Square categories that do not have a local category row by Square ID.",
    squareCategoriesMissingLocal.map((category) => category.categoryData?.name || category.id)
  );

  const summary = {
    generated_at: new Date().toISOString(),
    environment: process.env.SQUARE_ENVIRONMENT || "sandbox",
    supabase: {
      products_total: products.length,
      products_active: activeProducts.length,
      products_visible_active: visibleActiveProducts.length,
      variations_total: variations.length,
      variations_active: activeVariations.length,
      categories_total: categories.length,
      product_category_links: productCategories.length,
      real_primary_images_visible_active: realPrimaryImages.length,
      placeholder_primary_images_visible_active: placeholderPrimaryImages.length,
      missing_primary_images_visible_active: missingPrimaryImages.length,
      visible_active_products_without_real_product_images: visibleProductsNoRealImageRows.length,
    },
    square: {
      items_total: squareItems.length,
      variations_total: squareVariationRows.length,
      categories_total: squareCategories.length,
      items_without_images: squareItemsWithoutImages.length,
    },
    findings: findings.map((finding) => ({
      bucket: finding.bucket,
      severity: finding.severity,
      count: finding.count,
    })),
  };

  const { summaryPath, findingsPath } = buildOutputPaths();
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  writeFindingsCsv(findingsPath, findings);

  console.log("Summary:");
  console.log(`  Supabase active products:             ${activeProducts.length}`);
  console.log(`  Supabase active variations:           ${activeVariations.length}`);
  console.log(`  Supabase categories:                  ${categories.length}`);
  console.log(`  Square items:                         ${squareItems.length}`);
  console.log(`  Square variations:                    ${squareVariationRows.length}`);
  console.log(`  Square categories:                    ${squareCategories.length}`);
  console.log(`  Visible products with real primary:   ${realPrimaryImages.length}`);
  console.log(`  Visible products using placeholder:   ${placeholderPrimaryImages.length}`);
  console.log(`  Visible products missing primary:     ${missingPrimaryImages.length}`);
  console.log(`  Square items without images:          ${squareItemsWithoutImages.length}`);
  console.log();
  console.log("Findings:");
  for (const finding of findings) {
    console.log(
      `  ${finding.severity.toUpperCase().padEnd(6)} ${String(finding.count).padStart(5)}  ${finding.bucket}`
    );
  }
  console.log();
  console.log(`Summary JSON:  ${summaryPath}`);
  console.log(`Findings CSV:  ${findingsPath}`);
  console.log();
  console.log("No database or Square changes were made.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
