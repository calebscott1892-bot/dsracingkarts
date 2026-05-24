#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const TARGET_SUPPLIERS = ["DPE", "IKD", "Revolution Racegear"];
const SQUARE_API_BASE =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com/v2"
    : "https://connect.squareupsandbox.com/v2";
const SQUARE_VERSION = process.env.SQUARE_VERSION || "2025-04-16";
const PAGE_SIZE = 1000;
const DB_IN_CHUNK_SIZE = 100;
const SQUARE_BATCH_SIZE = 100;
const BATCH_DELAY_MS = 150;

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

const outputPath = argValue(
  "--out",
  resolve(
    __dirname,
    "../tmp",
    `square-supplier-controls-audit-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`
  )
);
const shouldApplyCatalogTracking = process.argv.includes("--apply-catalog-tracking");
const shouldApplyZeroMissingCounts = process.argv.includes("--apply-zero-missing-counts");
const shouldSyncSupabaseInventory = process.argv.includes("--sync-supabase-inventory");
const shouldApplyNativeVendor = process.argv.includes("--apply-native-vendor");
const maxApply = Number.parseInt(argValue("--max-apply", "0"), 10) || 0;

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SQUARE_ACCESS_TOKEN",
  "NEXT_PUBLIC_SQUARE_LOCATION_ID",
].filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function cleanString(value) {
  return value == null ? "" : String(value).trim();
}

function centsFromMoney(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function makeSummaryCounter(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function increment(summary, key, by = 1) {
  summary[key] = (summary[key] || 0) + by;
}

async function runSupabaseQuery(label, runQuery, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await runQuery();
    if (!result.error) return result;
    lastError = result.error;
    if (attempt < attempts) await sleep(300 * attempt);
  }
  throw new Error(`${label}: ${lastError?.message || lastError}`);
}

async function fetchPaginated(label, queryFactory) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await runSupabaseQuery(label, () =>
      queryFactory().range(from, from + PAGE_SIZE - 1)
    );
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchSuppliers() {
  const { data } = await runSupabaseQuery("suppliers", () =>
    supabase
      .from("suppliers")
      .select("id, name, square_vendor_id")
      .in("name", TARGET_SUPPLIERS)
  );
  return data || [];
}

async function fetchSupplierCosts(supplierIds) {
  return fetchPaginated("supplier costs", () =>
    supabase
      .from("product_supplier_costs")
      .select(
        "id, product_id, variation_id, supplier_id, supplier_sku, supplier_item_name, wholesale_price, retail_price, source, suppliers(id, name, square_vendor_id)"
      )
      .in("supplier_id", supplierIds)
      .order("supplier_id")
      .order("supplier_sku")
  );
}

async function fetchVariationsByIds(variationIds) {
  const rows = [];
  for (const idChunk of chunk(variationIds, DB_IN_CHUNK_SIZE)) {
    const { data } = await runSupabaseQuery("variations by id", () =>
      supabase
        .from("product_variations")
        .select(
          "id, product_id, name, sku, square_token, price, products(id, name, sku, square_token, is_stockable)"
        )
        .in("id", idChunk)
    );
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchVariationsByProductIds(productIds) {
  const rows = [];
  for (const idChunk of chunk(productIds, DB_IN_CHUNK_SIZE)) {
    const { data } = await runSupabaseQuery("variations by product", () =>
      supabase
        .from("product_variations")
        .select(
          "id, product_id, name, sku, square_token, price, products(id, name, sku, square_token, is_stockable)"
        )
        .in("product_id", idChunk)
    );
    rows.push(...(data || []));
  }
  return rows;
}

async function squarePost(path, body, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(`${SQUARE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.ok) return data;

    const errors = data.errors || [];
    const retryable =
      response.status === 429 ||
      errors.some((error) => {
        const text = `${error.code || ""} ${error.detail || ""}`.toLowerCase();
        return text.includes("rate") || text.includes("catalog locked");
      });
    lastError = new Error(
      `Square ${path} HTTP ${response.status}: ${JSON.stringify(errors || data)}`
    );

    if (!retryable || attempt === attempts) break;

    const retryAfter = Number.parseFloat(response.headers.get("retry-after") || "");
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(20_000, 1000 * attempt * attempt);
    await sleep(delay);
  }

  throw lastError;
}

async function writeJsonBackup(label, data) {
  const backupPath = resolve(
    __dirname,
    "../tmp",
    `${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFile(backupPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return backupPath;
}

async function fetchSquareVariations(tokens) {
  const objectsById = new Map();
  const missingTokens = new Set(tokens);

  const tokenChunks = chunk(tokens, SQUARE_BATCH_SIZE);
  for (let index = 0; index < tokenChunks.length; index += 1) {
    const tokenChunk = tokenChunks[index];
    const data = await squarePost("/catalog/batch-retrieve", {
      object_ids: tokenChunk,
      include_related_objects: false,
    });
    for (const object of data.objects || []) {
      objectsById.set(object.id, object);
      missingTokens.delete(object.id);
    }
    process.stdout.write(
      `\r  Square catalog batches ${index + 1} / ${tokenChunks.length}   `
    );
    if (index < tokenChunks.length - 1) await sleep(BATCH_DELAY_MS);
  }
  process.stdout.write("\n");

  return { objectsById, missingTokens };
}

async function fetchInventoryCounts(tokens) {
  const countsByToken = new Map();
  const tokenChunks = chunk(tokens, SQUARE_BATCH_SIZE);

  for (let index = 0; index < tokenChunks.length; index += 1) {
    const tokenChunk = tokenChunks[index];
    let cursor = null;
    do {
      const data = await squarePost("/inventory/counts/batch-retrieve", {
        catalog_object_ids: tokenChunk,
        location_ids: [LOCATION_ID],
        states: ["IN_STOCK"],
        cursor,
        limit: 1000,
      });
      for (const count of data.counts || []) {
        const token = count.catalog_object_id;
        if (!countsByToken.has(token)) countsByToken.set(token, []);
        countsByToken.get(token).push(count);
      }
      cursor = data.cursor || null;
    } while (cursor);

    process.stdout.write(
      `\r  Square inventory batches ${index + 1} / ${tokenChunks.length}   `
    );
    if (index < tokenChunks.length - 1) await sleep(BATCH_DELAY_MS);
  }
  process.stdout.write("\n");

  return countsByToken;
}

function resolveVariationTargets(costRows, variationRowsById, variationsByProductId) {
  const unresolved = [];
  const targetRows = [];

  for (const cost of costRows) {
    if (cost.variation_id) {
      const variation = variationRowsById.get(cost.variation_id);
      if (!variation) {
        unresolved.push({
          supplier_cost_id: cost.id,
          supplier: cost.suppliers?.name,
          supplier_sku: cost.supplier_sku,
          reason: "variation_id not found",
        });
        continue;
      }
      targetRows.push({ cost, variation, mapping: "variation" });
      continue;
    }

    if (!cost.product_id) {
      unresolved.push({
        supplier_cost_id: cost.id,
        supplier: cost.suppliers?.name,
        supplier_sku: cost.supplier_sku,
        reason: "missing product_id and variation_id",
      });
      continue;
    }

    const variations = variationsByProductId.get(cost.product_id) || [];
    if (variations.length === 0) {
      unresolved.push({
        supplier_cost_id: cost.id,
        supplier: cost.suppliers?.name,
        supplier_sku: cost.supplier_sku,
        reason: "product has no variations",
      });
      continue;
    }

    for (const variation of variations) {
      targetRows.push({ cost, variation, mapping: "product" });
    }
  }

  return { targetRows, unresolved };
}

function buildVariationTargets(targetRows) {
  const byVariationId = new Map();

  for (const row of targetRows) {
    const key = row.variation.id;
    if (!byVariationId.has(key)) {
      byVariationId.set(key, {
        variation: row.variation,
        costs: [],
      });
    }
    byVariationId.get(key).costs.push(row.cost);
  }

  const targets = [];
  for (const target of byVariationId.values()) {
    const squareToken = cleanString(target.variation.square_token);
    const suppliers = new Map();
    for (const cost of target.costs) {
      const supplierName = cost.suppliers?.name || "";
      suppliers.set(supplierName, (suppliers.get(supplierName) || 0) + 1);
    }

    const uniqueSupplierNames = [...suppliers.keys()].filter(Boolean);
    const hasOneSupplierCost = target.costs.length === 1;
    const expectedCost = hasOneSupplierCost ? target.costs[0] : null;

    targets.push({
      variation: target.variation,
      squareToken,
      costs: target.costs,
      suppliers: uniqueSupplierNames,
      expectedCost,
      ambiguousSupplierCost: !hasOneSupplierCost,
    });
  }

  return targets;
}

function vendorStateForTarget(target, squareObject) {
  if (!target.expectedCost) return "ambiguous";
  const supplier = target.expectedCost.suppliers;
  const expectedVendorId = cleanString(supplier?.square_vendor_id);
  if (!expectedVendorId) return "missing_square_vendor_id";

  const vendorInfos =
    squareObject?.item_variation_data?.item_variation_vendor_infos || [];
  if (vendorInfos.length === 0) return "missing";

  const expectedCostCents = centsFromMoney(target.expectedCost.wholesale_price);
  const matching = vendorInfos.find(
    (info) =>
      info.item_variation_vendor_info_data?.vendor_id === expectedVendorId
  );

  if (!matching) return "wrong_vendor";
  if (expectedCostCents == null) return "correct_vendor_no_cost";

  const actualAmount =
    matching.item_variation_vendor_info_data?.price_money?.amount ?? null;
  return Number(actualAmount) === expectedCostCents
    ? "correct"
    : "cost_mismatch";
}

function inventoryStateForToken(token, countsByToken) {
  const counts = countsByToken.get(token) || [];
  const inStock = counts.find((count) => count.state === "IN_STOCK") || counts[0];
  if (!inStock) return { state: "missing", quantity: null };
  const quantity = Number.parseFloat(inStock.quantity || "0");
  if (!Number.isFinite(quantity)) return { state: "invalid", quantity: null };
  if (quantity > 0) return { state: "positive", quantity };
  if (quantity < 0) return { state: "negative", quantity };
  return { state: "zero", quantity };
}

function catalogStateForObject(squareObject) {
  const variationData = squareObject?.item_variation_data || {};
  const locationOverrides = variationData.location_overrides || [];
  const locationOverride = locationOverrides.find(
    (override) => override.location_id === LOCATION_ID
  );

  return {
    trackInventory:
      variationData.track_inventory === true
        ? "true"
        : variationData.track_inventory === false
          ? "false"
          : "blank",
    stockable:
      variationData.stockable === true
        ? "true"
        : variationData.stockable === false
          ? "false"
          : "blank",
    sellable:
      variationData.sellable === true
        ? "true"
        : variationData.sellable === false
          ? "false"
          : "blank",
    locationTrackInventory: !locationOverride
      ? "none"
      : locationOverride.track_inventory === true
        ? "true"
        : locationOverride.track_inventory === false
          ? "false"
          : "blank",
  };
}

function prepareCatalogTrackingUpdate(squareObject) {
  const variationData = squareObject?.item_variation_data;
  if (!variationData) return null;

  let changed = false;
  const nextObject = structuredClone(squareObject);
  const nextVariationData = nextObject.item_variation_data;

  // Square returns native vendor info nested under the variation, but those
  // records are separate catalog objects. Keep them out of variation upserts.
  delete nextVariationData.item_variation_vendor_infos;
  delete nextVariationData.ordinal;

  if (nextVariationData.track_inventory !== true) {
    nextVariationData.track_inventory = true;
    changed = true;
  }

  const locationOverrides = Array.isArray(nextVariationData.location_overrides)
    ? nextVariationData.location_overrides
    : [];
  const locationOverride = locationOverrides.find(
    (override) => override.location_id === LOCATION_ID
  );

  for (const override of locationOverrides) {
    delete override.sold_out;
    delete override.sold_out_valid_until;
  }

  if (locationOverride && locationOverride.track_inventory !== true) {
    locationOverride.track_inventory = true;
    nextVariationData.location_overrides = locationOverrides;
    changed = true;
  }

  return changed ? nextObject : null;
}

async function applyCatalogTrackingUpdates(updates) {
  if (updates.length === 0) {
    return { attempted: 0, updated: 0, errors: [] };
  }

  const backupPath = await writeJsonBackup("square-catalog-tracking-backup", {
    created_at: new Date().toISOString(),
    location_id: LOCATION_ID,
    objects: updates.map((entry) => entry.before),
  });

  console.log(`  Catalog tracking backup: ${backupPath}`);

  let updated = 0;
  const errors = [];
  const updateChunks = chunk(updates, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (let index = 0; index < updateChunks.length; index += 1) {
    const updateChunk = updateChunks[index];
    const data = await squarePost("/catalog/batch-upsert", {
      idempotency_key: `dsr-supplier-track-${timestamp}-${index}`,
      batches: [{ objects: updateChunk.map((entry) => entry.after) }],
    });

    if (data.errors?.length) {
      errors.push({ batch: index, errors: data.errors });
    } else {
      updated += data.objects?.length || updateChunk.length;
    }

    process.stdout.write(
      `\r  Catalog tracking update batches ${index + 1} / ${updateChunks.length}   `
    );
    if (index < updateChunks.length - 1) await sleep(1000);
  }
  process.stdout.write("\n");

  return { attempted: updates.length, updated, errors, backup_path: backupPath };
}

async function applyZeroMissingInventoryCounts(targets, countsByToken, objectsById) {
  const uniqueByToken = new Map();
  for (const target of targets) {
    if (!target.squareToken || !objectsById.has(target.squareToken)) continue;
    if (inventoryStateForToken(target.squareToken, countsByToken).state !== "missing") {
      continue;
    }
    uniqueByToken.set(target.squareToken, target);
  }

  let targetsToZero = [...uniqueByToken.values()];
  if (maxApply > 0) targetsToZero = targetsToZero.slice(0, maxApply);
  if (targetsToZero.length === 0) {
    return { attempted: 0, updated: 0, errors: [], zeroed_tokens: [] };
  }

  const backupPath = await writeJsonBackup("square-zero-missing-counts-plan", {
    created_at: new Date().toISOString(),
    location_id: LOCATION_ID,
    tokens: targetsToZero.map((target) => ({
      square_variation_token: target.squareToken,
      variation_id: target.variation.id,
      sku: target.variation.sku || target.variation.products?.sku || "",
      product_name: target.variation.products?.name || "",
      suppliers: target.suppliers,
    })),
  });

  console.log(`  Zero-count plan backup: ${backupPath}`);

  let updated = 0;
  const errors = [];
  const zeroedTokens = [];
  const targetChunks = chunk(targetsToZero, 100);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (let index = 0; index < targetChunks.length; index += 1) {
    const targetChunk = targetChunks[index];
    const occurredAt = new Date().toISOString();
    const data = await squarePost("/inventory/changes/batch-create", {
      idempotency_key: `dsr-zero-missing-${timestamp}-${index}`,
      ignore_unchanged_counts: true,
      changes: targetChunk.map((target) => ({
        type: "PHYSICAL_COUNT",
        physical_count: {
          catalog_object_id: target.squareToken,
          state: "IN_STOCK",
          location_id: LOCATION_ID,
          quantity: "0",
          occurred_at: occurredAt,
        },
      })),
    });

    if (data.errors?.length) {
      errors.push({ batch: index, errors: data.errors });
    } else {
      updated += targetChunk.length;
      zeroedTokens.push(...targetChunk.map((target) => target.squareToken));
    }

    process.stdout.write(
      `\r  Zero inventory batches ${index + 1} / ${targetChunks.length}   `
    );
    if (index < targetChunks.length - 1) await sleep(BATCH_DELAY_MS);
  }
  process.stdout.write("\n");

  return {
    attempted: targetsToZero.length,
    updated,
    errors,
    backup_path: backupPath,
    zeroed_tokens: zeroedTokens,
  };
}

async function syncSupabaseInventory(targets, countsByToken, zeroedTokens = []) {
  const zeroed = new Set(zeroedTokens);
  const rowsByVariationId = new Map();

  for (const target of targets) {
    if (!target.squareToken) continue;
    const inventoryState = inventoryStateForToken(target.squareToken, countsByToken);
    let quantity = inventoryState.quantity;

    if (inventoryState.state === "missing") {
      if (!zeroed.has(target.squareToken)) continue;
      quantity = 0;
    }

    if (quantity == null || !Number.isFinite(quantity)) continue;
    rowsByVariationId.set(target.variation.id, {
      variation_id: target.variation.id,
      quantity: Math.trunc(quantity),
      updated_at: new Date().toISOString(),
    });
  }

  const rows = [...rowsByVariationId.values()];
  if (rows.length === 0) return { attempted: 0, upserted: 0, errors: [] };

  const errors = [];
  let upserted = 0;
  const rowChunks = chunk(rows, 500);
  for (let index = 0; index < rowChunks.length; index += 1) {
    const rowChunk = rowChunks[index];
    const { error } = await supabase
      .from("inventory")
      .upsert(rowChunk, { onConflict: "variation_id" });
    if (error) {
      errors.push({ batch: index, error: error.message });
    } else {
      upserted += rowChunk.length;
    }
  }

  return { attempted: rows.length, upserted, errors };
}

function vendorInfoMoneyFromCost(cost, fallbackMoney) {
  const costCents = centsFromMoney(cost?.wholesale_price);
  if (costCents != null) {
    return {
      amount: costCents,
      currency: "AUD",
    };
  }
  return fallbackMoney || undefined;
}

function supplierVendorInfoData(target, fallbackData = {}) {
  const cost = target.expectedCost;
  const supplier = cost?.suppliers;
  const vendorId = cleanString(supplier?.square_vendor_id);
  if (!cost || !vendorId) return null;

  const data = {
    ordinal: fallbackData.ordinal ?? 1,
    sku: cleanString(cost.supplier_sku) || cleanString(target.variation.sku),
    item_variation_id: target.squareToken,
    vendor_id: vendorId,
  };

  const priceMoney = vendorInfoMoneyFromCost(cost, fallbackData.price_money);
  if (priceMoney) data.price_money = priceMoney;

  return data;
}

function prepareNativeVendorUpdate(target, squareObject) {
  if (!target.expectedCost || !squareObject) return null;

  const vendorState = vendorStateForTarget(target, squareObject);
  if (
    !["missing", "wrong_vendor", "cost_mismatch"].includes(vendorState)
  ) {
    return null;
  }

  const vendorInfos =
    squareObject.item_variation_data?.item_variation_vendor_infos || [];
  const expectedVendorId = cleanString(
    target.expectedCost.suppliers?.square_vendor_id
  );
  if (!expectedVendorId) return null;

  if (vendorState === "missing") {
    const vendorData = supplierVendorInfoData(target);
    if (!vendorData) return null;
    return {
      action: "create",
      state: vendorState,
      before: null,
      after: {
        type: "ITEM_VARIATION_VENDOR_INFO",
        id: `#vendor-info-${target.variation.id}`,
        present_at_all_locations: true,
        item_variation_vendor_info_data: vendorData,
      },
    };
  }

  const matching =
    vendorInfos.find(
      (info) =>
        info.item_variation_vendor_info_data?.vendor_id === expectedVendorId
    ) ||
    [...vendorInfos].sort(
      (a, b) =>
        (a.item_variation_vendor_info_data?.ordinal ?? 9999) -
        (b.item_variation_vendor_info_data?.ordinal ?? 9999)
    )[0];

  if (!matching) return null;

  const fallbackData = matching.item_variation_vendor_info_data || {};
  const vendorData = supplierVendorInfoData(target, fallbackData);
  if (!vendorData) return null;

  return {
    action: "update",
    state: vendorState,
    before: matching,
    after: {
      type: "ITEM_VARIATION_VENDOR_INFO",
      id: matching.id,
      version: matching.version,
      present_at_all_locations: matching.present_at_all_locations ?? true,
      item_variation_vendor_info_data: vendorData,
    },
  };
}

async function applyNativeVendorUpdates(updates) {
  if (updates.length === 0) {
    return { attempted: 0, updated: 0, errors: [] };
  }

  const backupPath = await writeJsonBackup("square-native-vendor-backup", {
    created_at: new Date().toISOString(),
    location_id: LOCATION_ID,
    updates: updates.map((entry) => ({
      action: entry.action,
      state: entry.state,
      before: entry.before,
      after: entry.after,
    })),
  });

  console.log(`  Native vendor backup: ${backupPath}`);

  let updated = 0;
  const errors = [];
  const updateChunks = chunk(updates, 25);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (let index = 0; index < updateChunks.length; index += 1) {
    const updateChunk = updateChunks[index];
    const data = await squarePost("/catalog/batch-upsert", {
      idempotency_key: `dsr-native-vendor-${timestamp}-${index}`,
      batches: [{ objects: updateChunk.map((entry) => entry.after) }],
    });

    if (data.errors?.length) {
      errors.push({ batch: index, errors: data.errors });
    } else {
      updated += data.objects?.length || updateChunk.length;
    }

    process.stdout.write(
      `\r  Native vendor update batches ${index + 1} / ${updateChunks.length}   `
    );
    if (index < updateChunks.length - 1) await sleep(1000);
  }
  process.stdout.write("\n");

  return { attempted: updates.length, updated, errors, backup_path: backupPath };
}

async function main() {
  console.log("DS Racing Karts - Square Supplier Controls Audit");
  console.log("================================================");
  console.log(`Square env:     ${process.env.SQUARE_ENVIRONMENT || "sandbox"}`);
  console.log(`Square version: ${SQUARE_VERSION}`);
  console.log(`Location:       ${LOCATION_ID}`);
  console.log(`Suppliers:      ${TARGET_SUPPLIERS.join(", ")}`);
  console.log(
    `Mode:           ${
      shouldApplyCatalogTracking ||
      shouldApplyZeroMissingCounts ||
      shouldSyncSupabaseInventory ||
      shouldApplyNativeVendor
        ? "APPLY SELECTED CHANGES"
        : "READ ONLY"
    }`
  );
  if (maxApply > 0) console.log(`Max apply:      ${maxApply}`);
  console.log();

  const suppliers = await fetchSuppliers();
  const missingSuppliers = TARGET_SUPPLIERS.filter(
    (name) => !suppliers.some((supplier) => supplier.name === name)
  );
  if (missingSuppliers.length > 0) {
    throw new Error(`Missing suppliers in Supabase: ${missingSuppliers.join(", ")}`);
  }

  console.log("Step 1/4 - Loading supplier-linked variations from Supabase...");
  const supplierCosts = await fetchSupplierCosts(suppliers.map((supplier) => supplier.id));
  const directVariationIds = [
    ...new Set(supplierCosts.map((cost) => cost.variation_id).filter(Boolean)),
  ];
  const productIds = [
    ...new Set(supplierCosts.map((cost) => cost.product_id).filter(Boolean)),
  ];
  const [directVariations, productVariations] = await Promise.all([
    fetchVariationsByIds(directVariationIds),
    fetchVariationsByProductIds(productIds),
  ]);

  const variationRowsById = new Map(
    [...directVariations, ...productVariations].map((variation) => [
      variation.id,
      variation,
    ])
  );
  const variationsByProductId = new Map();
  for (const variation of productVariations) {
    if (!variationsByProductId.has(variation.product_id)) {
      variationsByProductId.set(variation.product_id, []);
    }
    variationsByProductId.get(variation.product_id).push(variation);
  }

  const { targetRows, unresolved } = resolveVariationTargets(
    supplierCosts,
    variationRowsById,
    variationsByProductId
  );
  const targets = buildVariationTargets(targetRows);
  const targetsWithTokens = targets.filter((target) => target.squareToken);
  const squareTokens = [...new Set(targetsWithTokens.map((target) => target.squareToken))];

  console.log(`  Supplier cost rows:       ${supplierCosts.length}`);
  console.log(`  Resolved variation links: ${targetRows.length}`);
  console.log(`  Unique variations:        ${targets.length}`);
  console.log(`  Square variation tokens:  ${squareTokens.length}`);
  console.log(`  Unresolved cost rows:     ${unresolved.length}`);

  console.log("\nStep 2/4 - Fetching live Square catalog variations...");
  const { objectsById, missingTokens } = await fetchSquareVariations(squareTokens);

  console.log("Step 3/4 - Fetching live Square inventory counts...");
  const countsByToken = await fetchInventoryCounts(squareTokens);

  console.log("Step 4/4 - Building audit summary...");
  const summary = {
    generated_at: new Date().toISOString(),
    square_environment: process.env.SQUARE_ENVIRONMENT || "sandbox",
    square_version: SQUARE_VERSION,
    location_id: LOCATION_ID,
    suppliers: suppliers.map((supplier) => ({
      name: supplier.name,
      id: supplier.id,
      square_vendor_id: supplier.square_vendor_id,
    })),
    counts: {
      supplier_cost_rows: supplierCosts.length,
      resolved_variation_links: targetRows.length,
      unresolved_cost_rows: unresolved.length,
      unique_variations: targets.length,
      unique_square_variation_tokens: squareTokens.length,
      local_products_not_stockable: 0,
      variations_missing_square_token: targets.length - targetsWithTokens.length,
      square_objects_missing: missingTokens.size,
      ambiguous_supplier_variations: 0,
    },
    catalog: {
      track_inventory: makeSummaryCounter(["true", "false", "blank", "missing"]),
      stockable: makeSummaryCounter(["true", "false", "blank", "missing"]),
      sellable: makeSummaryCounter(["true", "false", "blank", "missing"]),
      location_track_inventory: makeSummaryCounter([
        "true",
        "false",
        "blank",
        "none",
        "missing",
      ]),
    },
    inventory: makeSummaryCounter(["positive", "zero", "missing", "negative", "invalid"]),
    native_vendor_info: makeSummaryCounter([
      "correct",
      "correct_vendor_no_cost",
      "cost_mismatch",
      "wrong_vendor",
      "missing",
      "missing_square_vendor_id",
      "ambiguous",
      "missing_square_object",
      "missing_square_token",
    ]),
    by_supplier_cost_rows: Object.fromEntries(
      TARGET_SUPPLIERS.map((supplierName) => [supplierName, 0])
    ),
  };

  for (const cost of supplierCosts) {
    increment(summary.by_supplier_cost_rows, cost.suppliers?.name || "Unknown");
  }

  const issues = [];
  for (const target of targets) {
    const product = target.variation.products;
    if (product?.is_stockable === false) {
      summary.counts.local_products_not_stockable += 1;
      issues.push({
        type: "local_product_not_stockable",
        sku: target.variation.sku || product?.sku || "",
        product_name: product?.name || "",
        variation_id: target.variation.id,
        square_token: target.squareToken,
      });
    }

    if (target.ambiguousSupplierCost) {
      summary.counts.ambiguous_supplier_variations += 1;
    }

    if (!target.squareToken) {
      increment(summary.native_vendor_info, "missing_square_token");
      issues.push({
        type: "missing_square_token",
        sku: target.variation.sku || product?.sku || "",
        product_name: product?.name || "",
        variation_id: target.variation.id,
        suppliers: target.suppliers.join("; "),
      });
      continue;
    }

    const squareObject = objectsById.get(target.squareToken);
    if (!squareObject) {
      increment(summary.catalog.track_inventory, "missing");
      increment(summary.catalog.stockable, "missing");
      increment(summary.catalog.sellable, "missing");
      increment(summary.catalog.location_track_inventory, "missing");
      increment(summary.native_vendor_info, "missing_square_object");
      issues.push({
        type: "missing_square_object",
        sku: target.variation.sku || product?.sku || "",
        product_name: product?.name || "",
        variation_id: target.variation.id,
        square_token: target.squareToken,
      });
      continue;
    }

    const catalogState = catalogStateForObject(squareObject);
    increment(summary.catalog.track_inventory, catalogState.trackInventory);
    increment(summary.catalog.stockable, catalogState.stockable);
    increment(summary.catalog.sellable, catalogState.sellable);
    increment(
      summary.catalog.location_track_inventory,
      catalogState.locationTrackInventory
    );

    if (
      catalogState.trackInventory !== "true" ||
      catalogState.stockable === "false" ||
      catalogState.locationTrackInventory === "false"
    ) {
      issues.push({
        type: "catalog_tracking_needs_attention",
        sku: target.variation.sku || product?.sku || "",
        product_name: product?.name || "",
        variation_id: target.variation.id,
        square_token: target.squareToken,
        track_inventory: catalogState.trackInventory,
        stockable: catalogState.stockable,
        location_track_inventory: catalogState.locationTrackInventory,
      });
    }

    const inventoryState = inventoryStateForToken(target.squareToken, countsByToken);
    increment(summary.inventory, inventoryState.state);

    const vendorState = vendorStateForTarget(target, squareObject);
    increment(summary.native_vendor_info, vendorState);
    if (
      ["missing", "wrong_vendor", "cost_mismatch", "missing_square_vendor_id"].includes(
        vendorState
      )
    ) {
      issues.push({
        type: "native_vendor_info_needs_attention",
        sku: target.variation.sku || product?.sku || "",
        product_name: product?.name || "",
        variation_id: target.variation.id,
        square_token: target.squareToken,
        supplier: target.expectedCost?.suppliers?.name || "",
        supplier_sku: target.expectedCost?.supplier_sku || "",
        wholesale_price: target.expectedCost?.wholesale_price ?? "",
        vendor_state: vendorState,
      });
    }
  }

  const applied = {
    catalog_tracking: null,
    zero_missing_counts: null,
    supabase_inventory_sync: null,
    native_vendor: null,
  };

  if (shouldApplyCatalogTracking) {
    console.log("\nApply - enabling Square catalog inventory tracking...");
    const updatesByToken = new Map();
    for (const target of targets) {
      if (!target.squareToken) continue;
      const squareObject = objectsById.get(target.squareToken);
      if (!squareObject || updatesByToken.has(target.squareToken)) continue;
      const nextObject = prepareCatalogTrackingUpdate(squareObject);
      if (!nextObject) continue;
      updatesByToken.set(target.squareToken, {
        before: squareObject,
        after: nextObject,
      });
    }
    let catalogUpdates = [...updatesByToken.values()];
    if (maxApply > 0) catalogUpdates = catalogUpdates.slice(0, maxApply);
    applied.catalog_tracking = await applyCatalogTrackingUpdates(catalogUpdates);
    if (applied.catalog_tracking.errors.length > 0) {
      console.warn(
        `  Catalog tracking completed with ${applied.catalog_tracking.errors.length} batch error(s).`
      );
    }
  }

  if (shouldApplyZeroMissingCounts) {
    console.log("\nApply - creating zero Square inventory counts where no count exists...");
    applied.zero_missing_counts = await applyZeroMissingInventoryCounts(
      targets,
      countsByToken,
      objectsById
    );
    if (applied.zero_missing_counts.errors.length > 0) {
      console.warn(
        `  Zero counts completed with ${applied.zero_missing_counts.errors.length} batch error(s).`
      );
    }
  }

  if (shouldSyncSupabaseInventory) {
    console.log("\nApply - syncing Supabase inventory cache from Square counts...");
    applied.supabase_inventory_sync = await syncSupabaseInventory(
      targets,
      countsByToken,
      applied.zero_missing_counts?.zeroed_tokens || []
    );
    if (applied.supabase_inventory_sync.errors.length > 0) {
      console.warn(
        `  Supabase inventory sync completed with ${applied.supabase_inventory_sync.errors.length} batch error(s).`
      );
    }
  }

  if (shouldApplyNativeVendor) {
    console.log("\nApply - updating native Square default vendor/unit-cost records...");
    const updates = [];
    const seenObjects = new Set();
    for (const target of targets) {
      if (!target.squareToken || target.ambiguousSupplierCost) continue;
      const squareObject = objectsById.get(target.squareToken);
      const prepared = prepareNativeVendorUpdate(target, squareObject);
      if (!prepared) continue;

      const key =
        prepared.action === "create"
          ? `create:${target.squareToken}:${target.expectedCost?.suppliers?.square_vendor_id}`
          : `update:${prepared.after.id}`;
      if (seenObjects.has(key)) continue;
      seenObjects.add(key);
      updates.push(prepared);
    }

    let nativeUpdates = updates;
    if (maxApply > 0) nativeUpdates = nativeUpdates.slice(0, maxApply);
    applied.native_vendor = await applyNativeVendorUpdates(nativeUpdates);
    if (applied.native_vendor.errors.length > 0) {
      console.warn(
        `  Native vendor update completed with ${applied.native_vendor.errors.length} batch error(s).`
      );
    }
  }

  const report = {
    ...summary,
    applied,
    unresolved_cost_rows_sample: unresolved.slice(0, 50),
    issues_sample: issues.slice(0, 200),
    issue_counts: issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {}),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log();
  console.log("Audit complete.");
  console.log(`  Report: ${outputPath}`);
  console.log(`  Track inventory true: ${summary.catalog.track_inventory.true}`);
  console.log(`  Track inventory false/blank: ${
    summary.catalog.track_inventory.false + summary.catalog.track_inventory.blank
  }`);
  console.log(`  Inventory positive: ${summary.inventory.positive}`);
  console.log(`  Inventory zero: ${summary.inventory.zero}`);
  console.log(`  Inventory missing: ${summary.inventory.missing}`);
  console.log(`  Native vendor correct: ${summary.native_vendor_info.correct}`);
  console.log(
    `  Native vendor missing/wrong/cost mismatch: ${
      summary.native_vendor_info.missing +
      summary.native_vendor_info.wrong_vendor +
      summary.native_vendor_info.cost_mismatch
    }`
  );
}

main().catch((error) => {
  console.error("\nFatal error:", error.message);
  process.exit(1);
});
