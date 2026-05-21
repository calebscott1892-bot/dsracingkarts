#!/usr/bin/env node
/**
 * Fix DPE native Default Vendor in Square.
 *
 * Every ITEM_VARIATION_VENDOR_INFO currently pointing to IKD for DPE-sourced items
 * needs its vendor_id flipped to DPE. This script:
 *   1. Reads the pre-built correction CSV (2,680 rows, all DPE).
 *   2. Batch-fetches each variation from Square to get the current vendor info ID/version.
 *   3. Saves a full backup of every affected ITEM_VARIATION_VENDOR_INFO to a JSON file.
 *   4. Updates vendor_id to DPE on all affected objects in batches of 10.
 *
 * Usage:
 *   node scripts/fix-dpe-native-vendor.mjs            # dry run (no writes)
 *   node scripts/fix-dpe-native-vendor.mjs --apply    # apply live changes
 */

import { createReadStream } from "fs";
import { writeFile } from "fs/promises";
import { createInterface } from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

// ---------- Constants ----------
const DPE_VENDOR_ID = "BF27OEIZZJD6ZN4U";
const IKD_VENDOR_ID = "HAVRH4DDVN6NIODC";
const SQUARE_API_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2025-04-16";

const CSV_PATH = resolve(
  __dirname,
  "../tmp/vendor-source-crosscheck/square-default-vendor-dpe-correction-20260521-133300.csv"
);

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .slice(0, 19);
const BACKUP_PATH = resolve(
  __dirname,
  `../tmp/vendor-source-crosscheck/dpe-vendor-backup-before-fix-${timestamp}.json`
);

const READ_BATCH_SIZE = 100;
const WRITE_BATCH_SIZE = 10;
const BATCH_DELAY_MS = 250;

const isApply = process.argv.includes("--apply") || process.argv.includes("--live");

// ---------- Square HTTP helpers ----------
const missing = ["SQUARE_ACCESS_TOKEN"].filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;

async function squarePost(path, body) {
  const resp = await fetch(`${SQUARE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok && !data.objects && !data.errors) {
    throw new Error(`Square HTTP ${resp.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ---------- Helpers ----------
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;
    const rl = createInterface({ input: createReadStream(filePath) });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      const fields = parseCsvLine(line);
      if (!headers) { headers = fields; return; }
      const row = {};
      headers.forEach((h, i) => { row[h] = (fields[i] || "").trim(); });
      rows.push(row);
    });
    rl.on("close", () => resolve(rows));
    rl.on("error", reject);
  });
}

function costToCents(str) {
  if (!str) return null;
  const n = parseFloat(str);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// ---------- Main ----------
async function main() {
  console.log(`\n=== DPE Native Vendor Fix ===`);
  console.log(`Mode: ${isApply ? "APPLY (LIVE WRITES)" : "DRY RUN (no writes)"}`);
  console.log(`DPE vendor ID : ${DPE_VENDOR_ID}`);
  console.log(`IKD vendor ID : ${IKD_VENDOR_ID}`);
  console.log();

  // Step 1: Load correction CSV
  console.log("Step 1/4 — Loading correction CSV...");
  const csvRows = await readCsv(CSV_PATH);
  const csvByToken = new Map();
  for (const row of csvRows) {
    const token = row["Token"];
    if (token) csvByToken.set(token, row);
  }
  const allTokens = [...csvByToken.keys()];
  console.log(`  CSV rows: ${csvRows.length} | Unique tokens: ${allTokens.length}`);

  // Step 2: Batch-fetch all variations from Square
  console.log("\nStep 2/4 — Fetching current Square vendor info (for backup)...");
  const allVariations = [];
  const readBatches = chunk(allTokens, READ_BATCH_SIZE);

  for (let i = 0; i < readBatches.length; i++) {
    const batch = readBatches[i];
    process.stdout.write(
      `  Batch ${i + 1}/${readBatches.length} (${batch.length} tokens)...`
    );

    const data = await squarePost("/catalog/batch-retrieve", {
      object_ids: batch,
      include_related_objects: false,
    });

    if (data.errors?.length) {
      process.stdout.write(` ERRORS: ${data.errors.map((e) => e.detail).join("; ")}\n`);
    } else {
      const objects = data.objects || [];
      allVariations.push(...objects);
      process.stdout.write(` got ${objects.length}\n`);
    }

    if (i < readBatches.length - 1) await sleep(BATCH_DELAY_MS);
  }
  console.log(`  Total variations fetched: ${allVariations.length}`);

  // Step 3: Build backup data and update object list
  console.log("\nStep 3/4 — Building backup and update list...");

  const backupEntries = [];
  const updateObjects = [];
  const alreadyDpe = [];
  const noVendorInfo = [];

  for (const variation of allVariations) {
    const variationId = variation.id;
    const csvRow = csvByToken.get(variationId);
    if (!csvRow) continue;

    const sku = csvRow["SKU"];
    const vendorCode = csvRow["Default Vendor Code"] || sku;
    const costCents = costToCents(csvRow["Default Unit Cost"]);

    const vendorInfos = variation.item_variation_data?.item_variation_vendor_infos || [];

    if (vendorInfos.length === 0) {
      noVendorInfo.push({ variationId, sku });
      continue;
    }

    for (const vi of vendorInfos) {
      const currentVendorId = vi.item_variation_vendor_info_data?.vendor_id;
      const viId = vi.id;
      const viVersion = vi.version;

      // Always backup regardless of current vendor
      backupEntries.push({
        item_variation_vendor_info_id: viId,
        version: viVersion,
        variation_id: variationId,
        sku,
        current_vendor_id: currentVendorId,
        price_money_amount: vi.item_variation_vendor_info_data?.price_money?.amount,
        ordinal: vi.item_variation_vendor_info_data?.ordinal ?? 1,
      });

      if (currentVendorId === DPE_VENDOR_ID) {
        alreadyDpe.push({ variationId, sku });
        continue;
      }

      const existingAmount = vi.item_variation_vendor_info_data?.price_money?.amount;
      const finalCostCents = costCents ?? existingAmount ?? 0;

      updateObjects.push({
        type: "ITEM_VARIATION_VENDOR_INFO",
        id: viId,
        version: viVersion,
        present_at_all_locations: true,
        item_variation_vendor_info_data: {
          ordinal: vi.item_variation_vendor_info_data?.ordinal ?? 1,
          sku: vendorCode,
          price_money: {
            amount: finalCostCents,
            currency: "AUD",
          },
          item_variation_id: variationId,
          vendor_id: DPE_VENDOR_ID,
        },
      });
    }
  }

  console.log(`  Backed up      : ${backupEntries.length} vendor info objects`);
  console.log(`  To update      : ${updateObjects.length} objects (IKD → DPE)`);
  console.log(`  Already DPE    : ${alreadyDpe.length} (skipped)`);
  console.log(`  No vendor info : ${noVendorInfo.length} (skipped — no vendor info in Square)`);

  // Save backup
  const backupData = {
    createdAt: new Date().toISOString(),
    mode: isApply ? "apply" : "dry-run",
    dpeVendorId: DPE_VENDOR_ID,
    ikdVendorId: IKD_VENDOR_ID,
    summary: {
      backedUp: backupEntries.length,
      toUpdate: updateObjects.length,
      alreadyDpe: alreadyDpe.length,
      noVendorInfo: noVendorInfo.length,
    },
    noVendorInfo,
    alreadyDpe,
    vendorInfos: backupEntries,
  };

  await writeFile(BACKUP_PATH, JSON.stringify(backupData, null, 2));
  console.log(`\n  Backup saved → ${BACKUP_PATH}`);

  if (!isApply) {
    console.log(
      `\nDRY RUN complete. Re-run with --apply to update ${updateObjects.length} objects in Square.`
    );
    return;
  }

  // Step 4: Apply updates
  console.log(
    `\nStep 4/4 — Applying ${updateObjects.length} updates (batches of ${WRITE_BATCH_SIZE})...`
  );

  const writeBatches = chunk(updateObjects, WRITE_BATCH_SIZE);
  let totalUpdated = 0;
  let totalErrors = 0;
  const errorDetails = [];

  for (let i = 0; i < writeBatches.length; i++) {
    const batch = writeBatches[i];
    const ikey = `dpe-vendor-fix-${timestamp}-b${String(i).padStart(4, "0")}`;

    process.stdout.write(`  Batch ${i + 1}/${writeBatches.length}...`);

    let data;
    try {
      data = await squarePost("/catalog/batch-upsert", {
        idempotency_key: ikey,
        batches: [{ objects: batch }],
      });
    } catch (err) {
      process.stdout.write(` EXCEPTION: ${err.message}\n`);
      totalErrors += batch.length;
      errorDetails.push({ batchIndex: i, error: err.message });
      await sleep(BATCH_DELAY_MS);
      continue;
    }

    if (data.errors?.length) {
      process.stdout.write(
        ` ERRORS: ${data.errors.map((e) => e.detail).join("; ")}\n`
      );
      totalErrors += data.errors.length;
      errorDetails.push({ batchIndex: i, errors: data.errors });
    } else {
      const n = data.objects?.length ?? 0;
      totalUpdated += n;
      process.stdout.write(` OK (${n} updated)\n`);
    }

    if (i < writeBatches.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n=== Result ===`);
  console.log(`Updated  : ${totalUpdated}`);
  console.log(`Errors   : ${totalErrors}`);
  if (errorDetails.length > 0) {
    console.log(`Error details:`);
    for (const e of errorDetails) {
      console.log(`  Batch ${e.batchIndex}:`, e.error ?? JSON.stringify(e.errors));
    }
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
