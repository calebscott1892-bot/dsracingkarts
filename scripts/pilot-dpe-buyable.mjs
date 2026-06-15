#!/usr/bin/env node
/**
 * DPE buyable-backorder pilot (Bel approved 2026-06-12).
 *
 * Products sourced from DPE arrive from the supplier within 24-48h, so they
 * should be purchasable online even with zero shelf stock. The storefront
 * treats `products.is_stockable = false` as "not stock-managed" — Add to
 * Cart stays enabled and checkout skips the inventory guard.
 *
 * This script:
 *   1. Pages Square ITEM_VARIATION_VENDOR_INFO and collects every variation
 *      whose default vendor is DPE (vendor_id BF27OEIZZJD6ZN4U — same id the
 *      May vendor correction used, see fix-dpe-native-vendor.mjs).
 *   2. Maps those variation tokens to Supabase products. Only products where
 *      ALL variations are DPE-supplied are flipped — mixed-vendor products
 *      are reported and left alone.
 *   3. Backs up affected rows to backups/ before writing anything.
 *
 * Usage:
 *   node scripts/pilot-dpe-buyable.mjs            # dry run (no writes)
 *   node scripts/pilot-dpe-buyable.mjs --apply    # flip is_stockable=false
 *   node scripts/pilot-dpe-buyable.mjs --revert backups/<file>.json
 */

import { writeFile, readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DPE_VENDOR_ID = "BF27OEIZZJD6ZN4U";
const SQUARE_API_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2025-04-16";

const isApply = process.argv.includes("--apply");
const enforceCap = process.argv.includes("--enforce-cap");
const revertIdx = process.argv.indexOf("--revert");
const revertPath = revertIdx !== -1 ? process.argv[revertIdx + 1] : null;

// Safety cap (Bel's "parts only" scope, 2026-06-13): complete karts, engines
// and chassis must NOT become auto-buyable on backorder — too expensive, and
// they need freight/fitment handled by a human. Any product with a variation
// at or above this price stays enquiry-only. The cheapest complete engine is
// ~$1,250, so $1,000 cleanly separates parts from karts/engines. Override with
// --max-price=N.
const priceArg = process.argv.find((a) => a.startsWith("--max-price="));
const PRICE_CAP = priceArg ? Number(priceArg.split("=")[1]) : 1000;
if (!Number.isFinite(PRICE_CAP) || PRICE_CAP <= 0) {
  console.error(`Invalid --max-price value: ${priceArg}`);
  process.exit(1);
}

// Over-cap products that are still fine to sell online — they ship easily and
// have no fitment/freight disaster (apparel sizing is covered by the returns
// policy). These stay buyable even above the cap during --enforce-cap.
const CAP_WHITELIST = [/race suit/i, /mychron/i, /smartycam/i];
const isWhitelisted = (p) => CAP_WHITELIST.some((re) => re.test(p.name || ""));

const missing = ["SQUARE_ACCESS_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
  .filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function squarePost(path, body) {
  const res = await fetch(`${SQUARE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Square ${path} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchDpeVariationTokens() {
  const tokens = new Set();
  let cursor;
  let pages = 0;
  do {
    const body = {
      object_types: ["ITEM_VARIATION_VENDOR_INFO"],
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    };
    const data = await squarePost("/catalog/search", body);
    for (const obj of data.objects || []) {
      const info = obj.item_variation_vendor_info_data;
      if (info?.vendor_id === DPE_VENDOR_ID && info.item_variation_id) {
        tokens.add(info.item_variation_id);
      }
    }
    cursor = data.cursor;
    pages++;
  } while (cursor);
  console.log(`Square: ${tokens.size} DPE-supplied variations across ${pages} pages`);
  return tokens;
}

async function fetchAllVariations() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("product_variations")
      .select("id, product_id, square_token, price, sale_price, products(id, name, sku, is_stockable, status, visibility, is_sellable)")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function revert(backupFile) {
  const raw = JSON.parse(await readFile(resolve(backupFile), "utf8"));
  console.log(`Reverting ${raw.products.length} products from ${backupFile}`);
  let done = 0;
  for (const p of raw.products) {
    const { error } = await supabase
      .from("products")
      .update({ is_stockable: p.is_stockable })
      .eq("id", p.id);
    if (error) {
      console.error(`  ❌ ${p.name}: ${error.message}`);
      continue;
    }
    done++;
  }
  console.log(`Reverted ${done}/${raw.products.length}`);
}

function aggregateDpe(dpeTokens, variations) {
  // product_id -> { product, total, dpe, maxPrice }
  const byProduct = new Map();
  for (const v of variations) {
    const product = Array.isArray(v.products) ? v.products[0] : v.products;
    if (!product) continue;
    const entry = byProduct.get(v.product_id) || { product, total: 0, dpe: 0, maxPrice: 0 };
    entry.total++;
    if (v.square_token && dpeTokens.has(v.square_token)) entry.dpe++;
    const eff = Number(v.sale_price ?? v.price) || 0;
    if (eff > entry.maxPrice) entry.maxPrice = eff;
    byProduct.set(v.product_id, entry);
  }
  const allDpe = [];
  const mixed = [];
  for (const entry of byProduct.values()) {
    if (entry.dpe === 0) continue;
    if (entry.dpe === entry.total) {
      entry.product._maxPrice = entry.maxPrice;
      allDpe.push(entry.product);
    } else mixed.push(entry);
  }
  return { allDpe, mixed };
}

// Corrective pass: the 12 Jun apply ran before the price cap existed, so some
// complete karts / engines / chassis are currently buyable. This finds
// already-buyable DPE products over the cap (minus the whitelist) and flips
// them back to is_stockable=true (enquiry-only).
async function enforceCapMain() {
  const dpeTokens = await fetchDpeVariationTokens();
  const variations = await fetchAllVariations();
  console.log(`Supabase: ${variations.length} variations loaded`);
  const { allDpe } = aggregateDpe(dpeTokens, variations);

  const buyableLive = allDpe.filter(
    (p) =>
      p.is_stockable === false &&
      p.status === "active" &&
      p.visibility === "visible" &&
      p.is_sellable
  );
  const over = buyableLive.filter((p) => (p._maxPrice ?? 0) > PRICE_CAP);
  const toRevert = over.filter((p) => !isWhitelisted(p));
  const kept = over.filter((p) => isWhitelisted(p));
  const byPrice = (a, b) => (b._maxPrice || 0) - (a._maxPrice || 0);

  console.log(`\nEnforce cap $${PRICE_CAP} on already-buyable DPE products:`);
  console.log(`  Buyable & live DPE products: ${buyableLive.length}`);
  console.log(`  Over cap: ${over.length}  (revert: ${toRevert.length}, kept via whitelist: ${kept.length})`);
  console.log(`\nWILL REVERT to enquiry-only (is_stockable=true):`);
  for (const p of [...toRevert].sort(byPrice)) console.log(`  $${String(p._maxPrice).padStart(6)}  ${p.name}`);
  console.log(`\nKEPT buyable (whitelisted — ship easily, no fitment):`);
  for (const p of [...kept].sort(byPrice)) console.log(`  $${String(p._maxPrice).padStart(6)}  ${p.name}`);

  if (!isApply) {
    console.log(`\nDRY RUN — no writes. Re-run with --enforce-cap --apply to revert.`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = resolve(__dirname, `../backups/dpe-cap-enforce-backup-${stamp}.json`);
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        created: new Date().toISOString(),
        note: "is_stockable before cap enforcement. Revert: set these ids back to is_stockable=false.",
        products: toRevert.map((p) => ({ id: p.id, name: p.name, is_stockable: p.is_stockable })),
      },
      null,
      2
    )
  );
  console.log(`\nBackup written: ${backupPath}`);

  let ok = 0;
  let fail = 0;
  const BATCH = 100;
  for (let i = 0; i < toRevert.length; i += BATCH) {
    const ids = toRevert.slice(i, i + BATCH).map((p) => p.id);
    const { error } = await supabase.from("products").update({ is_stockable: true }).in("id", ids);
    if (error) {
      console.error(`  ❌ batch ${i / BATCH + 1}: ${error.message}`);
      fail += ids.length;
      continue;
    }
    ok += ids.length;
    console.log(`  reverted ${ok}/${toRevert.length}`);
  }
  console.log(`\nDone. Reverted: ${ok}, Failed: ${fail}`);
}

async function main() {
  if (revertPath) {
    await revert(revertPath);
    return;
  }
  if (enforceCap) {
    await enforceCapMain();
    return;
  }

  const dpeTokens = await fetchDpeVariationTokens();
  const variations = await fetchAllVariations();
  console.log(`Supabase: ${variations.length} variations loaded`);
  const { allDpe, mixed } = aggregateDpe(dpeTokens, variations);

  const eligible = allDpe.filter(
    (p) =>
      p.is_stockable !== false &&
      p.status === "active" &&
      p.visibility === "visible" &&
      p.is_sellable
  );
  const overCap = eligible.filter((p) => (p._maxPrice ?? 0) > PRICE_CAP);
  const targets = eligible.filter((p) => (p._maxPrice ?? 0) <= PRICE_CAP);
  const alreadyDone = allDpe.length - eligible.length;

  console.log(`\nDPE-only products: ${allDpe.length}`);
  console.log(`Mixed-vendor products (left alone): ${mixed.length}`);
  console.log(`Already non-stockable / inactive (skipped): ${alreadyDone}`);
  console.log(`Over price cap $${PRICE_CAP} (kept enquiry-only): ${overCap.length}`);
  console.log(`Targets to flip is_stockable=false: ${targets.length}`);
  console.log(`\nSample targets:`);
  for (const p of targets.slice(0, 10)) {
    console.log(`  - ${p.name} (${p.sku || "no sku"})`);
  }
  if (mixed.length > 0) {
    console.log(`\nMixed-vendor samples (NOT flipped):`);
    for (const m of mixed.slice(0, 5)) {
      console.log(`  - ${m.product.name}: ${m.dpe}/${m.total} variations DPE`);
    }
  }
  if (overCap.length > 0) {
    console.log(`\nHeld back over $${PRICE_CAP} — confirm these SHOULD stay enquiry-only:`);
    for (const p of [...overCap].sort((a, b) => (b._maxPrice || 0) - (a._maxPrice || 0)).slice(0, 12)) {
      console.log(`  - ${p.name} ($${p._maxPrice})`);
    }
  }

  if (!isApply) {
    console.log(`\nDRY RUN — no writes. Re-run with --apply to flip.`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = resolve(__dirname, `../backups/dpe-buyable-pilot-backup-${stamp}.json`);
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        created: new Date().toISOString(),
        note: "is_stockable values before the DPE buyable pilot. Revert with --revert.",
        products: targets.map((p) => ({ id: p.id, name: p.name, is_stockable: p.is_stockable })),
      },
      null,
      2
    )
  );
  console.log(`\nBackup written: ${backupPath}`);

  let success = 0;
  let fail = 0;
  const BATCH = 100;
  for (let i = 0; i < targets.length; i += BATCH) {
    const ids = targets.slice(i, i + BATCH).map((p) => p.id);
    const { error } = await supabase
      .from("products")
      .update({ is_stockable: false })
      .in("id", ids);
    if (error) {
      console.error(`  ❌ batch ${i / BATCH + 1}: ${error.message}`);
      fail += ids.length;
      continue;
    }
    success += ids.length;
    console.log(`  flipped ${success}/${targets.length}`);
  }
  console.log(`\nDone. Flipped: ${success}, Failed: ${fail}`);
  console.log(`Revert anytime: node scripts/pilot-dpe-buyable.mjs --revert ${backupPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
