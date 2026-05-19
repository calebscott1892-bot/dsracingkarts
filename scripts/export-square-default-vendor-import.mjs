#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Client, Environment } from "square";

import {
  buildDefaultVendorImportRows,
  collectProductIdsForVendorImportScope,
  normalizeVendorImportScope,
  rowsToCsv,
  summarizeDefaultVendorImportRows,
} from "./square-default-vendor-import-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const PAGE_SIZE = 500;
const IN_FILTER_CHUNK_SIZE = 100;

function argValue(name, fallback = "") {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1).trim() || fallback;
  const index = process.argv.indexOf(name);
  if (
    index !== -1 &&
    process.argv[index + 1] &&
    !process.argv[index + 1].startsWith("-")
  ) {
    return process.argv[index + 1].trim() || fallback;
  }
  return fallback;
}

const shouldEnsureVendors = process.argv.includes("--ensure-vendors");
const vendorFilter = argValue("--vendor", "");
const vendorImportScope = normalizeVendorImportScope(
  argValue("--scope", process.argv.includes("--all") ? "all" : "uncategorised")
);
const outputPath = argValue(
  "--out",
  resolve(
    __dirname,
    "../tmp",
    `square-default-vendors-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`
  )
);

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  shouldEnsureVendors ? "SQUARE_ACCESS_TOKEN" : "",
].filter((key) => key && !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function createSquareClient() {
  return new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment:
      process.env.SQUARE_ENVIRONMENT === "production"
        ? Environment.Production
        : Environment.Sandbox,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSupabaseQuery(label, runQuery, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runQuery();
      if (result.error) throw new Error(result.error.message);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(400 * attempt);
    }
  }
  throw new Error(`${label}: ${lastError?.message || lastError}`);
}

async function fetchPaginated(label, queryFactory, pageSize = PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data } = await runSupabaseQuery(label, () =>
      queryFactory().range(from, from + pageSize - 1)
    );
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchByProductIds(label, table, select, productIds, queryTweaks = (query) => query) {
  const rows = [];
  for (let index = 0; index < productIds.length; index += IN_FILTER_CHUNK_SIZE) {
    const chunk = productIds.slice(index, index + IN_FILTER_CHUNK_SIZE);
    const { data } = await runSupabaseQuery(`${label} ${index}`, () =>
      queryTweaks(supabase.from(table).select(select).in("product_id", chunk))
    );
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchProductsByIds(productIds) {
  const rows = [];
  for (let index = 0; index < productIds.length; index += IN_FILTER_CHUNK_SIZE) {
    const chunk = productIds.slice(index, index + IN_FILTER_CHUNK_SIZE);
    const { data } = await runSupabaseQuery(`products ${index}`, () =>
      supabase
        .from("products")
        .select("id, name, sku, square_token, description, description_plain, base_price")
        .in("id", chunk)
    );
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchProductIdsForVendorScope(scope) {
  if (scope !== "all") {
    const uncategorised = await fetchPaginated("uncategorized products", () =>
      supabase.from("uncategorized_products").select("id").order("name")
    );
    return {
      productIds: collectProductIdsForVendorImportScope(scope, uncategorised),
      sourceRows: uncategorised.length,
    };
  }

  const supplierCostRefs = await fetchPaginated("supplier cost product references", () =>
    supabase
      .from("product_supplier_costs")
      .select("product_id, variation_id")
      .order("product_id")
  );
  const productIds = collectProductIdsForVendorImportScope(
    scope,
    [],
    supplierCostRefs
  );

  const variationOnlyIds = [
    ...new Set(
      supplierCostRefs
        .filter((row) => !row.product_id && row.variation_id)
        .map((row) => row.variation_id)
    ),
  ];
  for (let index = 0; index < variationOnlyIds.length; index += IN_FILTER_CHUNK_SIZE) {
    const chunk = variationOnlyIds.slice(index, index + IN_FILTER_CHUNK_SIZE);
    const { data } = await runSupabaseQuery(`supplier cost variation refs ${index}`, () =>
      supabase.from("product_variations").select("product_id").in("id", chunk)
    );
    for (const row of data || []) {
      if (row.product_id && !productIds.includes(row.product_id)) {
        productIds.push(row.product_id);
      }
    }
  }

  return {
    productIds,
    sourceRows: supplierCostRefs.length,
  };
}

function filterRowsByVendor(rows, vendorName) {
  if (!vendorName) return rows;
  const wanted = vendorName.trim().toLowerCase();
  return rows.filter((row) => row["Default Vendor Name"].toLowerCase() === wanted);
}

function skippedOutputPath(csvPath) {
  return csvPath.replace(/\.csv$/i, "-skipped.csv");
}

function stableIdempotencyKey(name) {
  const digest = createHash("sha256").update(name).digest("hex").slice(0, 32);
  return `dsr-default-vendor-${digest}`;
}

async function searchVendor(square, name) {
  const { result, errors } = await square.vendorsApi.searchVendors({
    filter: { name: [name] },
  });
  if (errors?.length) {
    throw new Error(errors.map((error) => error.detail || error.code).join("; "));
  }

  return (result.vendors || []).find(
    (vendor) => vendor.name?.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

async function ensureSquareVendors(vendorNames) {
  if (vendorNames.length === 0) return [];
  const square = createSquareClient();
  const ensured = [];

  for (const name of vendorNames) {
    let vendor = await searchVendor(square, name);
    let action = "existing";

    if (!vendor) {
      const { result, errors } = await square.vendorsApi.createVendor({
        idempotencyKey: stableIdempotencyKey(name),
        vendor: {
          name,
          note: "Created from DS Racing Karts supplier data for Square default vendor import.",
        },
      });

      if (errors?.length) {
        throw new Error(
          `Could not create Square vendor ${name}: ${errors
            .map((error) => error.detail || error.code)
            .join("; ")}`
        );
      }

      vendor = result.vendor;
      action = "created";
    }

    if (vendor?.id) {
      await runSupabaseQuery(`supplier ${name}`, () =>
        supabase
          .from("suppliers")
          .update({ square_vendor_id: vendor.id, updated_at: new Date().toISOString() })
          .eq("name", name)
      );
    }

    ensured.push({
      name,
      id: vendor?.id || null,
      status: vendor?.status || null,
      action,
    });
  }

  return ensured;
}

async function main() {
  console.log("DS Racing Karts - Square Default Vendor Import Export");
  console.log("=====================================================");
  console.log(
    `Scope:           ${
      vendorImportScope === "all" ? "all supplier-cost products" : "uncategorised products"
    }`
  );
  if (vendorFilter) console.log(`Vendor filter:   ${vendorFilter}`);
  console.log(`Ensure vendors:  ${shouldEnsureVendors ? "yes" : "no"}`);
  console.log("Output type:      CSV import only - Square Dashboard import is still required");
  console.log();

  const { productIds, sourceRows } = await fetchProductIdsForVendorScope(vendorImportScope);

  const [products, variations, supplierCosts] = await Promise.all([
    fetchProductsByIds(productIds),
    fetchByProductIds(
      "variations",
      "product_variations",
      "id, product_id, name, sku, square_token, price, sort_order",
      productIds
    ),
    fetchByProductIds(
      "supplier costs",
      "product_supplier_costs",
      "id, product_id, variation_id, supplier_sku, supplier_item_name, wholesale_price, retail_price, suppliers(id, name, square_vendor_id)",
      productIds
    ),
  ]);

  const built = buildDefaultVendorImportRows({
    products,
    variations,
    supplierCosts,
  });
  const rows = filterRowsByVendor(built.rows, vendorFilter);
  const skipped = built.skipped;
  const summary = summarizeDefaultVendorImportRows(rows, skipped);
  const vendorNames = summary.vendors.map(([name]) => name);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${rowsToCsv(rows)}\n`, "utf8");

  let skippedPath = null;
  if (skipped.length > 0) {
    skippedPath = skippedOutputPath(outputPath);
    await writeFile(
      skippedPath,
      `${rowsToCsv(skipped, [
        "product_id",
        "product_name",
        "variation_id",
        "variation_name",
        "sku",
        "reason",
      ])}\n`,
      "utf8"
    );
  }

  const ensuredVendors = shouldEnsureVendors
    ? await ensureSquareVendors(vendorNames)
    : [];

  console.log(
    vendorImportScope === "all"
      ? `Supplier-cost rows:    ${sourceRows}`
      : `Uncategorised products: ${sourceRows}`
  );
  console.log(`Products selected:      ${productIds.length}`);
  console.log(`Variation rows checked: ${variations.length}`);
  console.log(`Import rows written:    ${summary.importRows}`);
  console.log(`Skipped rows:           ${summary.skippedRows}`);
  console.log(`Import CSV:             ${outputPath}`);
  if (skippedPath) console.log(`Skipped CSV:            ${skippedPath}`);
  console.log("Rows by vendor:");
  for (const [name, count] of summary.vendors) {
    console.log(`  ${name}: ${count}`);
  }
  if (ensuredVendors.length > 0) {
    console.log("Square vendors:");
    for (const vendor of ensuredVendors) {
      console.log(`  ${vendor.name}: ${vendor.action} (${vendor.id || "no id"})`);
    }
  }
}

main().catch((error) => {
  console.error("\nFatal error:", error.message);
  process.exit(1);
});
