#!/usr/bin/env node
/**
 * DS Racing Karts - Push Supabase stocklist products -> Square Catalog
 * --------------------------------------------------------------------
 * Takes every active product in Supabase whose square_token is NULL and:
 *   1. Reconciles it against existing Square items by SKU (safe retry path)
 *   2. Creates anything still missing in Square
 *   3. Writes Square item/variation IDs back to Supabase
 *
 * Usage:
 *   node scripts/push-stocklist-to-square.js --dry-run
 *   node scripts/push-stocklist-to-square.js
 */

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Client, Environment } from "square";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const isDryRun = process.argv.includes("--dry-run");
const BATCH_SIZE = 200;
const PAGE_SIZE = 1000;
const WRITE_CONCURRENCY = 25;

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SQUARE_ACCESS_TOKEN",
].filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Check your .env.local file.");
  process.exit(1);
}

if (!process.env.SQUARE_ENVIRONMENT) {
  console.warn(
    'Warning: SQUARE_ENVIRONMENT is not set. Defaulting to "sandbox".'
  );
}

const squareEnv =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? Environment.Production
    : Environment.Sandbox;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: squareEnv,
});

function normalizeSku(value) {
  const sku = String(value ?? "").trim();
  return sku ? sku.toLowerCase() : null;
}

function getPrimaryVariation(product) {
  const variations = Array.isArray(product.product_variations)
    ? product.product_variations
    : [];
  return variations[0] ?? null;
}

function priceToCents(value) {
  if (value == null || value === "") return null;

  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function buildStableBatchKey(batchEntries) {
  const signature = batchEntries
    .map(
      (entry) =>
        `${entry.product.id}:${entry.variation.id}:${entry.skuKey}:${entry.priceCents}`
    )
    .sort()
    .join("|");

  const digest = createHash("sha256").update(signature).digest("hex");
  return `dsr-stocklist-${digest.slice(0, 32)}`;
}

function describeProduct(product, variation) {
  const sku = variation?.sku ?? product.sku ?? "(no SKU)";
  return `[${sku}] ${product.name}`;
}

async function fetchUnsynced() {
  let from = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, sku, base_price, square_token, " +
          "product_variations(id, sku, price, square_token)"
      )
      .is("square_token", null)
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  all.sort((a, b) => {
    const skuA = normalizeSku(getPrimaryVariation(a)?.sku ?? a.sku) ?? "";
    const skuB = normalizeSku(getPrimaryVariation(b)?.sku ?? b.sku) ?? "";
    return skuA.localeCompare(skuB) || a.id.localeCompare(b.id);
  });

  return all;
}

async function loadSquareSkuIndex() {
  const skuToSquare = new Map();
  const duplicateSkus = new Map();
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

    for (const object of result.objects ?? []) {
      if (object.type !== "ITEM") continue;

      for (const variation of object.itemData?.variations ?? []) {
        const skuKey = normalizeSku(variation.itemVariationData?.sku);
        if (!skuKey) continue;

        // If this SKU was already flagged as a duplicate, skip all further
        // occurrences — otherwise the deleted-then-re-added cycle would
        // incorrectly promote a 3rd (or 4th…) match back to non-duplicate.
        if (duplicateSkus.has(skuKey)) continue;

        const existing = skuToSquare.get(skuKey);
        const current = { itemId: object.id, variationId: variation.id };

        if (!existing) {
          skuToSquare.set(skuKey, current);
          continue;
        }

        if (
          existing.itemId === current.itemId &&
          existing.variationId === current.variationId
        ) {
          continue;
        }

        duplicateSkus.set(skuKey, [existing, current]);
        skuToSquare.delete(skuKey);
      }
    }

    if (!result.cursor) break;
    cursor = result.cursor;
  }

  process.stdout.write("\n");
  return { skuToSquare, duplicateSkus };
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

async function writeBackMappings(productUpdates, variationUpdates) {
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
  console.log("DS Racing Karts - Push Stocklist Products -> Square Catalog");
  console.log("==========================================================");
  console.log(`Square env:  ${process.env.SQUARE_ENVIRONMENT ?? "sandbox"}`);
  console.log(`Mode:        ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log();

  console.log("Step 1/4 - Fetching products not yet in Square...");
  const products = await fetchUnsynced();
  console.log(`  Found ${products.length} product(s) to process`);

  if (products.length === 0) {
    console.log("\nAll products already have Square IDs. Nothing to do.");
    return;
  }

  if (isDryRun) {
    console.log("\n--- DRY RUN SAMPLE (first 15) ---");
    products.slice(0, 15).forEach((product, index) => {
      const variation = getPrimaryVariation(product);
      const sku = variation?.sku ?? product.sku ?? "(no SKU)";
      const price = variation?.price ?? product.base_price ?? 0;
      const printablePrice = Number.parseFloat(String(price));
      const formattedPrice = Number.isFinite(printablePrice)
        ? printablePrice.toFixed(2)
        : "0.00";
      console.log(
        `  ${String(index + 1).padStart(2)}. [${sku}] ${product.name} - $${formattedPrice}`
      );
    });

    if (products.length > 15) {
      console.log(`  ... and ${products.length - 15} more`);
    }

    console.log(
      `\nWould process ${products.length} products across about ${Math.ceil(products.length / BATCH_SIZE)} create batch(es).`
    );
    console.log("Run without --dry-run to execute.");
    return;
  }

  console.log("\nStep 2/4 - Loading existing Square catalog SKUs...");
  const { skuToSquare, duplicateSkus: duplicateSquareSkus } =
    await loadSquareSkuIndex();
  console.log(`  Indexed ${skuToSquare.size} unique Square SKU(s)`);

  if (duplicateSquareSkus.size > 0) {
    console.warn(
      `  Warning: ${duplicateSquareSkus.size} SKU(s) already appear multiple times in Square and will be skipped for manual review.`
    );
  }

  const productFailureIds = new Set();
  const variationFailureIds = new Set();

  const writeBackOnlyProducts = [];
  const writeBackOnlyVariations = [];
  const createEntries = [];

  for (const product of products) {
    const variation = getPrimaryVariation(product);

    if (!variation) {
      console.warn(`  Skipping ${product.id}: missing product variation row.`);
      productFailureIds.add(product.id);
      continue;
    }

    const skuKey = normalizeSku(variation.sku ?? product.sku);
    if (!skuKey) {
      console.warn(
        `  Skipping ${product.id}: missing SKU, cannot safely reconcile or create.`
      );
      productFailureIds.add(product.id);
      variationFailureIds.add(variation.id);
      continue;
    }

    if (duplicateSquareSkus.has(skuKey)) {
      console.warn(
        `  Skipping ${product.id}: SKU ${skuKey} matches multiple Square catalog entries.`
      );
      productFailureIds.add(product.id);
      variationFailureIds.add(variation.id);
      continue;
    }

    const existingSquare = skuToSquare.get(skuKey);
    if (existingSquare) {
      writeBackOnlyProducts.push({
        id: product.id,
        square_token: existingSquare.itemId,
      });
      writeBackOnlyVariations.push({
        id: variation.id,
        square_token: existingSquare.variationId,
      });
      continue;
    }

    const rawPrice = variation.price ?? product.base_price;
    const priceCents = priceToCents(rawPrice);

    if (priceCents == null) {
      console.warn(
        `  Skipping ${describeProduct(product, variation)}: invalid price "${rawPrice}".`
      );
      productFailureIds.add(product.id);
      variationFailureIds.add(variation.id);
      continue;
    }

    createEntries.push({ product, variation, skuKey, priceCents });
  }

  console.log(`  Existing Square matches to write back: ${writeBackOnlyProducts.length}`);
  console.log(`  New Square items to create:            ${createEntries.length}`);

  let reconciledProducts = 0;
  let reconciledVariations = 0;

  if (writeBackOnlyProducts.length > 0) {
    console.log("\nStep 3/4 - Writing back IDs for items already in Square...");
    const writeBackResult = await writeBackMappings(
      writeBackOnlyProducts,
      writeBackOnlyVariations
    );

    reconciledProducts += writeBackResult.productResult.successCount;
    reconciledVariations += writeBackResult.variationResult.successCount;

    writeBackResult.failedProductIds.forEach((id) => productFailureIds.add(id));
    writeBackResult.failedVariationIds.forEach((id) =>
      variationFailureIds.add(id)
    );
  }

  let createdProducts = 0;
  let createdVariations = 0;

  if (createEntries.length > 0) {
    console.log("\nStep 4/4 - Creating missing Square catalog items...");
  }

  const totalBatches = Math.ceil(createEntries.length / BATCH_SIZE);

  for (let i = 0; i < createEntries.length; i += BATCH_SIZE) {
    const batch = createEntries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(
      `\r  Batch ${batchNum}/${totalBatches} (items ${i + 1}-${Math.min(i + BATCH_SIZE, createEntries.length)} of ${createEntries.length})...   `
    );

    const objects = batch.map((entry) => {
      const tempItemId = `#item-${entry.product.id}`;
      const tempVariationId = `#var-${entry.variation.id}`;

      return {
        type: "ITEM",
        id: tempItemId,
        itemData: {
          name: entry.product.name,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: tempVariationId,
              itemVariationData: {
                itemId: tempItemId,
                name: "Regular",
                sku: entry.variation.sku ?? entry.product.sku ?? undefined,
                pricingType: "FIXED_PRICING",
                priceMoney: {
                  amount: BigInt(entry.priceCents),
                  currency: "AUD",
                },
              },
            },
          ],
        },
      };
    });

    try {
      const { result, errors } = await square.catalogApi.batchUpsertCatalogObjects({
        idempotencyKey: buildStableBatchKey(batch),
        batches: [{ objects }],
      });

      if (errors && errors.length > 0) {
        process.stdout.write("\n");
        console.error(`  Batch ${batchNum} returned errors from Square:`);
        for (const error of errors) {
          console.error(
            `    [${error.code}] ${error.detail} (field: ${error.field ?? "n/a"})`
          );
        }

        batch.forEach((entry) => {
          productFailureIds.add(entry.product.id);
          variationFailureIds.add(entry.variation.id);
        });
        continue;
      }

      const itemIds = new Map();
      const variationIds = new Map();

      for (const mapping of result.idMappings ?? []) {
        if (mapping.clientObjectId.startsWith("#item-")) {
          itemIds.set(mapping.clientObjectId, mapping.objectId);
        } else if (mapping.clientObjectId.startsWith("#var-")) {
          variationIds.set(mapping.clientObjectId, mapping.objectId);
        }
      }

      const productUpdates = [];
      const variationUpdates = [];

      for (const entry of batch) {
        const itemKey = `#item-${entry.product.id}`;
        const variationKey = `#var-${entry.variation.id}`;
        const squareItemId = itemIds.get(itemKey);
        const squareVariationId = variationIds.get(variationKey);

        if (squareItemId) {
          productUpdates.push({
            id: entry.product.id,
            square_token: squareItemId,
          });
        } else {
          console.error(
            `\n  Missing Square item mapping for product ${entry.product.id}.`
          );
          productFailureIds.add(entry.product.id);
        }

        if (squareVariationId) {
          variationUpdates.push({
            id: entry.variation.id,
            square_token: squareVariationId,
          });
        } else {
          console.error(
            `\n  Missing Square variation mapping for variation ${entry.variation.id}.`
          );
          variationFailureIds.add(entry.variation.id);
        }
      }

      const writeBackResult = await writeBackMappings(
        productUpdates,
        variationUpdates
      );

      createdProducts += writeBackResult.productResult.successCount;
      createdVariations += writeBackResult.variationResult.successCount;

      writeBackResult.failedProductIds.forEach((id) => productFailureIds.add(id));
      writeBackResult.failedVariationIds.forEach((id) =>
        variationFailureIds.add(id)
      );
    } catch (error) {
      process.stdout.write("\n");
      console.error(`  Batch ${batchNum} threw an exception: ${error.message}`);

      batch.forEach((entry) => {
        productFailureIds.add(entry.product.id);
        variationFailureIds.add(entry.variation.id);
      });
    }
  }

  process.stdout.write("\n");

  console.log("\n==========================================================");
  console.log("Done!");
  console.log(`  Product IDs written from existing Square items: ${reconciledProducts}`);
  console.log(`  Product IDs written from newly created items:   ${createdProducts}`);
  console.log(`  Variation IDs written from existing items:      ${reconciledVariations}`);
  console.log(`  Variation IDs written from newly created items: ${createdVariations}`);

  if (productFailureIds.size > 0 || variationFailureIds.size > 0) {
    console.log(`  Failed product writes / skips:                  ${productFailureIds.size}`);
    console.log(
      `  Failed variation writes / skips:                ${variationFailureIds.size}`
    );

    if (productFailureIds.size > 0) {
      console.log(
        `  Failed product IDs: ${Array.from(productFailureIds).join(", ")}`
      );
    }

    if (variationFailureIds.size > 0) {
      console.log(
        `  Failed variation IDs: ${Array.from(variationFailureIds).join(", ")}`
      );
    }

    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nFatal error:", error.message);
  process.exit(1);
});
