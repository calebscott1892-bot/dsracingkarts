#!/usr/bin/env node
/**
 * DS Racing Karts - Reconcile Square IDs -> Supabase
 * --------------------------------------------------
 * Reads Square catalog ITEM objects, matches them to unsynced Supabase rows by
 * SKU, and writes Square item/variation IDs back to Supabase.
 *
 * Usage:
 *   node scripts/reconcile-square-ids.js --dry-run
 *   node scripts/reconcile-square-ids.js
 */

import { createClient } from "@supabase/supabase-js";
import { Client, Environment } from "square";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const isDryRun = process.argv.includes("--dry-run");
const PAGE_SIZE = 1000;
const WRITE_CONCURRENCY = 25;

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SQUARE_ACCESS_TOKEN",
].filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.SQUARE_ENVIRONMENT) {
  console.warn(
    'Warning: SQUARE_ENVIRONMENT is not set. Defaulting to "sandbox".'
  );
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

function normalizeSku(value) {
  const sku = String(value ?? "").trim();
  return sku ? sku.toLowerCase() : null;
}

async function loadUnsyncedFromSupabase() {
  let from = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, product_variations(id, sku)")
      .is("square_token", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

async function loadSquareCatalog() {
  const items = [];
  let cursor;
  let page = 0;

  while (true) {
    page += 1;
    process.stdout.write(`\r  Fetching Square catalog page ${page}...   `);

    const { result, errors } = await square.catalogApi.listCatalog(
      cursor,
      "ITEM"
    );

    if (errors && errors.length > 0) {
      throw new Error(`Square listCatalog error: ${errors[0].detail}`);
    }

    items.push(...(result.objects ?? []));

    if (!result.cursor) break;
    cursor = result.cursor;
  }

  process.stdout.write("\n");
  return items;
}

async function writeSquareTokens(table, updates, label) {
  if (updates.length === 0) {
    return { attempted: 0, successCount: 0, failedIds: [] };
  }

  let successCount = 0;
  const failedIds = [];

  for (let i = 0; i < updates.length; i += WRITE_CONCURRENCY) {
    const chunk = updates.slice(i, i + WRITE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(({ id, square_token }) =>
        supabase.from(table).update({ square_token }).eq("id", id)
      )
    );

    for (let index = 0; index < results.length; index += 1) {
      const { error } = results[index];
      const targetId = chunk[index].id;

      if (error) {
        failedIds.push(targetId);
        console.error(`\n  ${label} update failed for ${targetId}: ${error.message}`);
      } else {
        successCount += 1;
      }
    }

    process.stdout.write(
      `\r  Writing ${label}: ${Math.min(i + WRITE_CONCURRENCY, updates.length)} / ${updates.length}   `
    );
  }

  process.stdout.write("\n");
  return { attempted: updates.length, successCount, failedIds };
}

async function writeBack(productUpdates, variationUpdates) {
  const productResult = await writeSquareTokens(
    "products",
    productUpdates,
    "product IDs"
  );
  const variationResult = await writeSquareTokens(
    "product_variations",
    variationUpdates,
    "variation IDs"
  );

  return {
    productResult,
    variationResult,
    failedProductIds: [...productResult.failedIds],
    failedVariationIds: [...variationResult.failedIds],
  };
}

async function main() {
  console.log("DS Racing Karts - Reconcile Square IDs -> Supabase");
  console.log("==================================================");
  console.log(`Square env:  ${process.env.SQUARE_ENVIRONMENT ?? "sandbox"}`);
  console.log(`Mode:        ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log();

  console.log("Step 1/3 - Loading unsynced products from Supabase...");
  const products = await loadUnsyncedFromSupabase();
  console.log(`  Found ${products.length} product(s) with no Square ID`);

  if (products.length === 0) {
    console.log("\nAll products already have Square IDs. Nothing to reconcile.");
    return;
  }

  const skuToSupabase = new Map();
  const duplicateSupabaseSkus = new Map();

  for (const product of products) {
    const variations = Array.isArray(product.product_variations)
      ? product.product_variations
      : [];

    for (const variation of variations) {
      const skuKey = normalizeSku(variation.sku);
      if (!skuKey) continue;

      const existing = skuToSupabase.get(skuKey);
      if (existing && existing.productId !== product.id) {
        if (!duplicateSupabaseSkus.has(skuKey)) {
          duplicateSupabaseSkus.set(skuKey, [existing.productId, product.id]);
          console.warn(
            `  Warning: duplicate Supabase SKU "${skuKey}" on products ${existing.productId} and ${product.id}. Skipping automatic reconcile for this SKU.`
          );
        } else if (!duplicateSupabaseSkus.get(skuKey).includes(product.id)) {
          duplicateSupabaseSkus.get(skuKey).push(product.id);
        }

        skuToSupabase.delete(skuKey);
        continue;
      }

      if (!duplicateSupabaseSkus.has(skuKey)) {
        skuToSupabase.set(skuKey, {
          productId: product.id,
          variationId: variation.id,
        });
      }
    }

    const productSkuKey = normalizeSku(product.sku);
    if (!productSkuKey) continue;
    if (skuToSupabase.has(productSkuKey) || duplicateSupabaseSkus.has(productSkuKey)) {
      continue;
    }

    skuToSupabase.set(productSkuKey, {
      productId: product.id,
      variationId: null,
    });
  }

  console.log(`  Built SKU index: ${skuToSupabase.size} unique entries`);

  if (duplicateSupabaseSkus.size > 0) {
    console.log(
      `  Duplicate Supabase SKUs skipped: ${duplicateSupabaseSkus.size}`
    );
  }

  console.log("\nStep 2/3 - Scanning Square catalog...");
  const squareItems = await loadSquareCatalog();
  console.log(`  Retrieved ${squareItems.length} catalog object(s) from Square`);

  console.log("\nStep 3/3 - Matching SKUs...");

  const productUpdates = [];
  const variationUpdates = [];
  const matchedProductIds = new Set();
  const matchedVariationIds = new Set();
  const duplicateSquareMatches = new Set();

  for (const item of squareItems) {
    if (item.type !== "ITEM") continue;

    for (const variation of item.itemData?.variations ?? []) {
      const squareSku = normalizeSku(variation.itemVariationData?.sku);
      if (!squareSku) continue;

      if (duplicateSquareMatches.has(squareSku)) {
        continue;
      }

      const supabaseEntry = skuToSupabase.get(squareSku);
      if (!supabaseEntry) continue;

      if (matchedVariationIds.has(supabaseEntry.variationId ?? "")) {
        console.warn(
          `  Warning: Square SKU "${squareSku}" matched more than once. Keeping the first match and skipping ${variation.id}.`
        );
        duplicateSquareMatches.add(squareSku);
        continue;
      }

      if (!matchedProductIds.has(supabaseEntry.productId)) {
        productUpdates.push({
          id: supabaseEntry.productId,
          square_token: item.id,
        });
        matchedProductIds.add(supabaseEntry.productId);
      }

      if (supabaseEntry.variationId && !matchedVariationIds.has(supabaseEntry.variationId)) {
        variationUpdates.push({
          id: supabaseEntry.variationId,
          square_token: variation.id,
        });
        matchedVariationIds.add(supabaseEntry.variationId);
      }
    }
  }

  const unmatched = products.length - matchedProductIds.size;

  console.log(`  Matched products:   ${matchedProductIds.size}`);
  console.log(`  Matched variations: ${variationUpdates.length}`);
  if (unmatched > 0) {
    console.log(`  Unmatched products: ${unmatched}`);
  }

  if (isDryRun) {
    console.log("\n--- DRY RUN SAMPLE (first 10 matches) ---");
    productUpdates.slice(0, 10).forEach((update, index) => {
      console.log(
        `  ${index + 1}. Supabase ${update.id.slice(0, 8)}... -> Square ${update.square_token}`
      );
    });
    console.log("\nRun without --dry-run to write these IDs to Supabase.");
    return;
  }

  if (productUpdates.length === 0) {
    console.log("\nNo matches found. The stocklist items may not be in Square yet.");
    console.log("Run push-stocklist-to-square.js first.");
    return;
  }

  console.log("\nWriting Square IDs back to Supabase...");
  const writeBackResult = await writeBack(productUpdates, variationUpdates);

  console.log("\n==================================================");
  console.log("Reconciliation complete!");
  console.log(`  Products attempted:   ${productUpdates.length}`);
  console.log(
    `  Products updated:     ${writeBackResult.productResult.successCount}`
  );
  console.log(`  Variations attempted: ${variationUpdates.length}`);
  console.log(
    `  Variations updated:   ${writeBackResult.variationResult.successCount}`
  );

  if (unmatched > 0) {
    console.log(`  Still unmatched:      ${unmatched}`);
  }

  if (
    writeBackResult.failedProductIds.length > 0 ||
    writeBackResult.failedVariationIds.length > 0
  ) {
    if (writeBackResult.failedProductIds.length > 0) {
      console.log(
        `  Failed product IDs:   ${writeBackResult.failedProductIds.join(", ")}`
      );
    }

    if (writeBackResult.failedVariationIds.length > 0) {
      console.log(
        `  Failed variation IDs: ${writeBackResult.failedVariationIds.join(", ")}`
      );
    }

    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nFatal error:", error.message);
  process.exit(1);
});
