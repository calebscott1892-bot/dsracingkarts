#!/usr/bin/env node
/**
 * Backfill supplier/vendor custom attributes onto Square ITEM objects.
 *
 * The stocklist push script originally attached Supplier Vendor to variations
 * only. Square's dashboard item view is item-centric, so supplier imports need
 * the same vendor attribute on the parent ITEM as well.
 *
 * Usage:
 *   node scripts/backfill-supplier-vendors-to-square.js --vendor "Revolution Racegear"
 *   node scripts/backfill-supplier-vendors-to-square.js --vendor "Revolution Racegear" --apply
 */

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Client, Environment } from "square";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SUPPLIER_ITEM_VENDOR_ATTR_KEY = "dsr_supplier_vendor_item";
const SUPPLIER_ITEM_VENDOR_ATTR_NAME = "Item Supplier Vendor";
const PAGE_SIZE = 1000;
const SQUARE_READ_BATCH_SIZE = 100;
const SQUARE_WRITE_BATCH_SIZE = 100;

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

const vendorName = argValue("--vendor", "Revolution Racegear");
const isApply = process.argv.includes("--apply") || process.argv.includes("--live");
const forceOverwrite = process.argv.includes("--force");

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SQUARE_ACCESS_TOKEN",
].filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
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

function supplierVendorAttribute(value) {
  return {
    key: SUPPLIER_ITEM_VENDOR_ATTR_KEY,
    type: "STRING",
    name: SUPPLIER_ITEM_VENDOR_ATTR_NAME,
    stringValue: value,
  };
}

function idempotencyKey(label, values) {
  const digest = createHash("sha256").update(values.join("|")).digest("hex").slice(0, 32);
  return `dsr-${label}-${digest}`;
}

async function fetchSupplier() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("name", vendorName)
    .maybeSingle();

  if (error) throw new Error(`Supplier lookup failed: ${error.message}`);
  if (!data) throw new Error(`Supplier "${vendorName}" was not found.`);
  return data;
}

async function fetchSupplierProducts(supplierId) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("product_supplier_costs")
      .select("product_id, products(square_token, name)")
      .eq("supplier_id", supplierId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Supplier cost fetch failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const productsBySquareId = new Map();
  for (const row of rows) {
    const squareId = row.products?.square_token;
    if (!squareId) continue;
    if (!productsBySquareId.has(squareId)) {
      productsBySquareId.set(squareId, {
        squareId,
        name: row.products?.name || squareId,
      });
    }
  }

  return {
    supplierCostRows: rows.length,
    products: Array.from(productsBySquareId.values()),
  };
}

async function findSupplierVendorDefinition() {
  let cursor;
  do {
    const { result } = await square.catalogApi.searchCatalogObjects({
      cursor,
      objectTypes: ["CUSTOM_ATTRIBUTE_DEFINITION"],
      limit: 100,
    });
    const match = (result.objects || []).find(
      (object) =>
        object.customAttributeDefinitionData?.key === SUPPLIER_ITEM_VENDOR_ATTR_KEY
    );
    if (match) return match;
    cursor = result.cursor;
  } while (cursor);

  return null;
}

async function ensureSupplierVendorDefinition() {
  const existing = await findSupplierVendorDefinition();
  const existingAllowed = existing?.customAttributeDefinitionData?.allowedObjectTypes || [];
  const existingAllowsItems = existingAllowed.includes("ITEM");
  const nextDefinition = existing
    ? {
        ...existing,
        customAttributeDefinitionData: {
          ...existing.customAttributeDefinitionData,
          type: "STRING",
          name: SUPPLIER_ITEM_VENDOR_ATTR_NAME,
          key: SUPPLIER_ITEM_VENDOR_ATTR_KEY,
          allowedObjectTypes: Array.from(
            new Set([
              ...(existing.customAttributeDefinitionData?.allowedObjectTypes || []),
              "ITEM",
            ])
          ),
          sellerVisibility: "SELLER_VISIBILITY_READ_WRITE_VALUES",
          appVisibility: "APP_VISIBILITY_READ_WRITE_VALUES",
        },
      }
    : {
        type: "CUSTOM_ATTRIBUTE_DEFINITION",
        id: `#${SUPPLIER_ITEM_VENDOR_ATTR_KEY}`,
        customAttributeDefinitionData: {
          type: "STRING",
          name: SUPPLIER_ITEM_VENDOR_ATTR_NAME,
          description: "Primary supplier/vendor imported from DS Racing Karts migration data.",
          key: SUPPLIER_ITEM_VENDOR_ATTR_KEY,
          allowedObjectTypes: ["ITEM"],
          sellerVisibility: "SELLER_VISIBILITY_READ_WRITE_VALUES",
          appVisibility: "APP_VISIBILITY_READ_WRITE_VALUES",
        },
      };

  if (existing && existingAllowsItems) {
    return { changed: false, existing: true };
  }

  if (!isApply) {
    return { changed: true, existing: Boolean(existing), dryRun: true };
  }

  await square.catalogApi.upsertCatalogObject({
    idempotencyKey: idempotencyKey("supplier-vendor-definition", [
      SUPPLIER_ITEM_VENDOR_ATTR_KEY,
      SUPPLIER_ITEM_VENDOR_ATTR_NAME,
      (nextDefinition.customAttributeDefinitionData.allowedObjectTypes || []).join(","),
    ]),
    object: nextDefinition,
  });

  return { changed: true, existing: Boolean(existing) };
}

async function loadSquareItems(products) {
  const items = [];
  for (let i = 0; i < products.length; i += SQUARE_READ_BATCH_SIZE) {
    const batch = products.slice(i, i + SQUARE_READ_BATCH_SIZE);
    const { result, errors } = await square.catalogApi.batchRetrieveCatalogObjects({
      objectIds: batch.map((product) => product.squareId),
      includeRelatedObjects: false,
    });

    if (errors?.length) {
      throw new Error(
        `Square item fetch failed: ${errors.map((error) => error.detail || error.code).join("; ")}`
      );
    }

    items.push(...(result.objects || []));
    process.stdout.write(
      `\r  Read Square items ${Math.min(i + SQUARE_READ_BATCH_SIZE, products.length)} / ${products.length}   `
    );
  }
  process.stdout.write("\n");
  return items;
}

function prepareItemUpdate(item, expectedVendor) {
  if (!item || item.type !== "ITEM" || item.isDeleted) {
    return { action: "skip", reason: "not an active ITEM" };
  }

  const current = item.customAttributeValues?.[SUPPLIER_ITEM_VENDOR_ATTR_KEY]?.stringValue || "";
  if (current === expectedVendor) {
    return { action: "ok" };
  }

  if (current && !forceOverwrite) {
    return { action: "conflict", current };
  }

  return {
    action: "update",
    object: {
      ...item,
      customAttributeValues: {
        ...(item.customAttributeValues || {}),
        [SUPPLIER_ITEM_VENDOR_ATTR_KEY]: supplierVendorAttribute(expectedVendor),
      },
    },
  };
}

async function writeSquareItems(items) {
  let written = 0;
  for (let i = 0; i < items.length; i += SQUARE_WRITE_BATCH_SIZE) {
    const batch = items.slice(i, i + SQUARE_WRITE_BATCH_SIZE);
    const { errors } = await square.catalogApi.batchUpsertCatalogObjects({
      idempotencyKey: idempotencyKey(
        "supplier-vendor-items",
        batch.map((item) => `${item.id}:${item.version}`)
      ),
      batches: [{ objects: batch }],
    });

    if (errors?.length) {
      throw new Error(
        `Square item update failed: ${errors.map((error) => error.detail || error.code).join("; ")}`
      );
    }

    written += batch.length;
    process.stdout.write(
      `\r  Updated Square items ${Math.min(i + SQUARE_WRITE_BATCH_SIZE, items.length)} / ${items.length}   `
    );
  }
  process.stdout.write("\n");
  return written;
}

async function main() {
  console.log("DS Racing Karts - Supplier Vendor Square Backfill");
  console.log("================================================");
  console.log(`Square env: ${process.env.SQUARE_ENVIRONMENT ?? "sandbox"}`);
  console.log(`Vendor:     ${vendorName}`);
  console.log(`Mode:       ${isApply ? "LIVE" : "DRY RUN"}`);
  if (forceOverwrite) console.log("Overwrite:  enabled");
  console.log();

  const supplier = await fetchSupplier();
  const { supplierCostRows, products } = await fetchSupplierProducts(supplier.id);

  console.log(`Supplier cost rows: ${supplierCostRows}`);
  console.log(`Square items found: ${products.length}`);
  if (products.length === 0) return;

  const definitionResult = await ensureSupplierVendorDefinition();
  if (definitionResult.dryRun) {
    console.log(
      definitionResult.existing
        ? "Definition: would add ITEM support to Item Supplier Vendor custom attribute"
        : "Definition: would create Item Supplier Vendor custom attribute"
    );
  } else if (definitionResult.changed) {
    console.log("Definition: Item Supplier Vendor custom attribute is ready");
  } else {
    console.log("Definition: Item Supplier Vendor custom attribute already exists");
  }

  const items = await loadSquareItems(products);
  const updates = [];
  const conflicts = [];
  let alreadyCorrect = 0;
  let skipped = 0;

  for (const item of items) {
    const prepared = prepareItemUpdate(item, supplier.name);
    if (prepared.action === "ok") alreadyCorrect += 1;
    else if (prepared.action === "update") updates.push(prepared.object);
    else if (prepared.action === "conflict") conflicts.push({ id: item.id, current: prepared.current });
    else skipped += 1;
  }

  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Need update:      ${updates.length}`);
  console.log(`Conflicts:        ${conflicts.length}`);
  console.log(`Skipped:          ${skipped}`);

  if (conflicts.length > 0) {
    console.log("Conflict sample:");
    for (const conflict of conflicts.slice(0, 10)) {
      console.log(`  ${conflict.id}: ${conflict.current}`);
    }
  }

  if (!isApply) {
    console.log("\nNo Square changes were made. Re-run with --apply to update item-level vendors.");
    return;
  }

  if (updates.length === 0) return;
  const written = await writeSquareItems(updates);
  console.log(`\nBackfill complete. Updated ${written} Square item(s).`);
}

main().catch((error) => {
  console.error("\nFatal error:", error.message);
  process.exit(1);
});
