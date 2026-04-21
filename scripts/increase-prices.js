#!/usr/bin/env node
/**
 * DS Racing Karts — Price Increase Script
 *
 * Increases all product variation prices (and sale prices) in Supabase
 * by a given percentage, then recalculates each product's base_price.
 *
 * Usage:
 *   node scripts/increase-prices.js <percentage>
 *
 * Examples:
 *   node scripts/increase-prices.js 5       → increase all prices by 5%
 *   node scripts/increase-prices.js 10      → increase all prices by 10%
 *   node scripts/increase-prices.js 2.5     → increase all prices by 2.5%
 *
 * Options:
 *   --dry-run    Preview changes without writing to the database
 *   --category   Only update products in a specific category slug
 *                e.g.  --category=engines
 *
 * Examples with options:
 *   node scripts/increase-prices.js 5 --dry-run
 *   node scripts/increase-prices.js 10 --category=tyres
 *
 * Rounding:
 *   Prices are rounded to the nearest $0.05 (standard retail rounding).
 *   To change to plain 2dp rounding, set ROUND_TO_FIVE_CENTS=false below.
 *
 * ⚠️  IMPORTANT — Square Catalog Sync Warning:
 *   This script updates prices in your WEBSITE DATABASE only (Supabase).
 *   It does NOT touch Square.
 *
 *   If you have the Square webhook sync active, the next time ANY product
 *   is changed in Square (even just renaming it), Square will push its
 *   prices back to the website and overwrite the prices set here.
 *
 *   Safe workflow:
 *     1. Update prices in SQUARE first (use Square's bulk pricing tools).
 *     2. Trigger a sync (or just wait for the next catalog webhook event).
 *     3. Use this script only if you are NOT using Square catalog sync,
 *        or as a one-time migration before Square sync is enabled.
 *
 * Other notes:
 *   - Only updates product_variations and products.base_price in Supabase.
 *   - Archived products are skipped.
 *   - A full before/after report is printed on completion.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// ── Config ──────────────────────────────────────────────────
const ROUND_TO_FIVE_CENTS = true; // set false to use standard 2dp rounding

// ── Parse arguments ─────────────────────────────────────────
const args = process.argv.slice(2);
const percentageArg = args.find((a) => /^[\d.]+$/.test(a));
const dryRun = args.includes("--dry-run");
const categoryArg = args.find((a) => a.startsWith("--category="))?.split("=")[1];

if (!percentageArg) {
  console.error("Usage: node scripts/increase-prices.js <percentage> [--dry-run] [--category=slug]");
  console.error("Example: node scripts/increase-prices.js 5");
  process.exit(1);
}

const pct = parseFloat(percentageArg);
if (isNaN(pct) || pct <= 0 || pct > 100) {
  console.error(`Invalid percentage: "${percentageArg}". Must be a positive number between 0 and 100.`);
  process.exit(1);
}

const multiplier = 1 + pct / 100;

// ── Supabase ─────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Helpers ──────────────────────────────────────────────────
/**
 * Round to nearest $0.05 (e.g. $12.37 → $12.35, $12.38 → $12.40)
 * This is standard Australian retail rounding.
 */
function roundToFiveCents(value) {
  return Math.round(value * 20) / 20;
}

function roundPrice(value) {
  return ROUND_TO_FIVE_CENTS
    ? roundToFiveCents(value)
    : Math.round(value * 100) / 100;
}

function formatAUD(value) {
  return `$${Number(value).toFixed(2)}`;
}

function formatChange(oldVal, newVal) {
  const diff = newVal - oldVal;
  return `${formatAUD(oldVal)} → ${formatAUD(newVal)} (+${formatAUD(diff)})`;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  DS Racing Karts — Price Increase");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Increase:    +${pct}%`);
  console.log(`  Mode:        ${dryRun ? "DRY RUN (no changes saved)" : "LIVE"}`);
  if (categoryArg) console.log(`  Category:    ${categoryArg}`);
  console.log(`  Rounding:    ${ROUND_TO_FIVE_CENTS ? "nearest $0.05" : "2 decimal places"}`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");

  // ── Fetch variations (with product + optional category filter) ──
  let query = supabase
    .from("product_variations")
    .select(`
      id, name, price, sale_price,
      products!inner (
        id, name, status,
        product_categories (
          categories ( slug )
        )
      )
    `)
    .neq("products.status", "archived");

  const { data: variations, error } = await query;

  if (error) {
    console.error("Failed to fetch variations:", error.message);
    process.exit(1);
  }

  if (!variations || variations.length === 0) {
    console.log("No active variations found.");
    process.exit(0);
  }

  // ── Category filter ──
  let filtered = variations;
  if (categoryArg) {
    filtered = variations.filter((v) => {
      const cats = v.products?.product_categories ?? [];
      return cats.some((pc) => pc.categories?.slug === categoryArg);
    });
    if (filtered.length === 0) {
      console.error(`No products found in category "${categoryArg}".`);
      process.exit(1);
    }
  }

  console.log(`Found ${filtered.length} variation(s) to update.\n`);

  // ── Calculate new prices ──
  const updates = filtered.map((v) => {
    const newPrice = roundPrice(v.price * multiplier);
    const newSalePrice = v.sale_price ? roundPrice(v.sale_price * multiplier) : null;
    return { id: v.id, productId: v.products.id, productName: v.products.name, variationName: v.name, oldPrice: v.price, newPrice, oldSalePrice: v.sale_price, newSalePrice };
  });

  // ── Print preview table ──
  const colW = [40, 20, 30, 30];
  const header = [
    "Product / Variation".padEnd(colW[0]),
    "Old Price".padEnd(colW[1]),
    "New Price".padEnd(colW[2]),
  ].join(" │ ");
  const divider = "─".repeat(header.length);

  console.log(divider);
  console.log(header);
  console.log(divider);

  for (const u of updates) {
    const label = `${u.productName} — ${u.variationName}`.slice(0, colW[0] - 1).padEnd(colW[0]);
    const oldP = formatAUD(u.oldPrice).padEnd(colW[1]);
    const newP = formatAUD(u.newPrice).padEnd(colW[2]);
    console.log(`${label} │ ${oldP} │ ${newP}`);
    if (u.oldSalePrice !== null) {
      const saleLabel = "  (sale price)".padEnd(colW[0]);
      const oldS = formatAUD(u.oldSalePrice).padEnd(colW[1]);
      const newS = formatAUD(u.newSalePrice).padEnd(colW[2]);
      console.log(`${saleLabel} │ ${oldS} │ ${newS}`);
    }
  }
  console.log(divider);

  const totalOld = updates.reduce((s, u) => s + u.oldPrice, 0) / updates.length;
  const totalNew = updates.reduce((s, u) => s + u.newPrice, 0) / updates.length;
  console.log(`\n  Average price: ${formatChange(totalOld, totalNew)}`);

  if (dryRun) {
    console.log("\n  ⚠  DRY RUN — no changes written. Remove --dry-run to apply.\n");
    process.exit(0);
  }

  // ── Confirm ──
  console.log(`\n  About to update ${updates.length} variation(s) in Supabase.`);
  console.log("  Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // ── Apply updates ──
  let successCount = 0;
  let errorCount = 0;
  const updatedProductIds = new Set();

  for (const u of updates) {
    const payload = { price: u.newPrice };
    if (u.newSalePrice !== null) payload.sale_price = u.newSalePrice;

    const { error: updateError } = await supabase
      .from("product_variations")
      .update(payload)
      .eq("id", u.id);

    if (updateError) {
      console.error(`  ✗ Failed: ${u.productName} — ${u.variationName}: ${updateError.message}`);
      errorCount++;
    } else {
      successCount++;
      updatedProductIds.add(u.productId);
    }
  }

  // ── Recalculate base_price for each affected product ──
  console.log(`\n  Recalculating base_price for ${updatedProductIds.size} product(s)...`);

  for (const productId of updatedProductIds) {
    const { data: vars } = await supabase
      .from("product_variations")
      .select("price, sale_price")
      .eq("product_id", productId);

    if (!vars || vars.length === 0) continue;

    const lowestPrice = Math.min(
      ...vars.map((v) => (v.sale_price !== null ? v.sale_price : v.price))
    );

    await supabase
      .from("products")
      .update({ base_price: lowestPrice })
      .eq("id", productId);
  }

  // ── Summary ──
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  ✓ Updated:  ${successCount} variation(s)`);
  if (errorCount > 0) console.log(`  ✗ Errors:   ${errorCount} variation(s) — check output above`);
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
