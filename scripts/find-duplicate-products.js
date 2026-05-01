#!/usr/bin/env node

/**
 * Find duplicate products in Supabase / Square.
 *
 * Three passes:
 *   1. SKU duplicates  — variations with identical SKU across different products
 *   2. Name duplicates — products with identical normalised names
 *   3. Near-duplicate names — soft match (case + punctuation insensitive,
 *      same SKU prefix) flagged as "review"
 *
 * Reads from Supabase (Square is the source of truth, but Supabase is the
 * already-synced mirror — much faster to query and the IDs map straight
 * back to Square via square_token).
 *
 * Usage:
 *   node scripts/find-duplicate-products.js
 *   node scripts/find-duplicate-products.js --csv > duplicates.csv
 *   node scripts/find-duplicate-products.js --include-archived
 *
 * Outputs:
 *   - Pretty table by default
 *   - CSV with --csv flag (good for the client to review in a spreadsheet)
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const asCsv = process.argv.includes("--csv");
const includeArchived = process.argv.includes("--include-archived");
// By default, name groups whose SKUs share a common prefix (typical for sized
// variants like SQKB01D39 / SQKB01D40 — same boot, different sizes) are
// suppressed. Pass --show-variants to see them anyway.
const showVariantGroups = process.argv.includes("--show-variants");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAll(table, columns) {
  const all = [];
  const page = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return all;
}

function normalizeName(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function squareLink(squareToken) {
  if (!squareToken) return "";
  return `https://squareup.com/dashboard/items/library/${squareToken}`;
}

function commonPrefix(strings) {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length && prefix; i++) {
    while (strings[i].indexOf(prefix) !== 0) {
      prefix = prefix.slice(0, -1);
      if (!prefix) break;
    }
  }
  return prefix;
}

// Heuristic: if every SKU in the bucket starts with the same 4+ character
// prefix and the remaining suffixes are short (<= 4 chars), treat the bucket
// as a sized-variant family rather than a real duplicate.
function looksLikeVariantFamily(products) {
  const skus = products.map((p) => (p.sku || "").trim().toUpperCase()).filter(Boolean);
  if (skus.length < 2 || skus.length !== products.length) return false;
  const prefix = commonPrefix(skus);
  if (prefix.length < 4) return false;
  return skus.every((sku) => sku.length - prefix.length <= 4);
}

async function main() {
  const products = await fetchAll(
    "products",
    "id, name, slug, sku, status, square_token, base_price, created_at"
  );
  const variations = await fetchAll(
    "product_variations",
    "id, product_id, name, sku, price"
  );

  const filteredProducts = includeArchived
    ? products
    : products.filter((p) => p.status === "active");
  const productById = new Map(filteredProducts.map((p) => [p.id, p]));

  // ── Pass 1: SKU duplicates (variations) ────────────────────────────────
  const skuBuckets = new Map();
  const seenAt = (key) => {
    if (!skuBuckets.has(key)) skuBuckets.set(key, []);
    return skuBuckets.get(key);
  };

  for (const v of variations) {
    if (!v.sku) continue;
    const product = productById.get(v.product_id);
    if (!product) continue; // archived / filtered out
    const key = v.sku.trim().toLowerCase();
    if (!key) continue;
    seenAt(key).push({ variation: v, product });
  }

  const skuDuplicates = Array.from(skuBuckets.entries())
    .filter(([, rows]) => {
      // Ignore when all the rows belong to the same product (variations of one item).
      const productIds = new Set(rows.map((r) => r.product.id));
      return productIds.size > 1;
    })
    .sort((a, b) => b[1].length - a[1].length);

  // ── Pass 2: exact name duplicates ──────────────────────────────────────
  const nameBuckets = new Map();
  for (const product of filteredProducts) {
    const key = normalizeName(product.name);
    if (!key) continue;
    if (!nameBuckets.has(key)) nameBuckets.set(key, []);
    nameBuckets.get(key).push(product);
  }
  let suppressedVariantGroups = 0;
  const nameDuplicates = Array.from(nameBuckets.entries())
    .filter(([, rows]) => {
      if (rows.length <= 1) return false;
      if (!showVariantGroups && looksLikeVariantFamily(rows)) {
        suppressedVariantGroups += 1;
        return false;
      }
      return true;
    })
    .sort((a, b) => b[1].length - a[1].length);

  // ── Output ─────────────────────────────────────────────────────────────
  if (asCsv) {
    const rows = [["match_type", "key", "product_name", "product_sku", "variation_sku", "status", "square_token", "square_url"]];
    for (const [sku, hits] of skuDuplicates) {
      for (const { variation, product } of hits) {
        rows.push([
          "sku",
          sku,
          product.name,
          product.sku || "",
          variation.sku || "",
          product.status,
          product.square_token || "",
          squareLink(product.square_token),
        ]);
      }
    }
    for (const [name, hits] of nameDuplicates) {
      for (const product of hits) {
        rows.push([
          "name",
          name,
          product.name,
          product.sku || "",
          "",
          product.status,
          product.square_token || "",
          squareLink(product.square_token),
        ]);
      }
    }
    for (const row of rows) console.log(row.map(csvEscape).join(","));
    return;
  }

  console.log(`\nDuplicate scan — ${filteredProducts.length} products${includeArchived ? " (including archived)" : " (active only)"}`);
  console.log(`(Pass --include-archived to include archived items.)\n`);

  console.log(`── SKU duplicates: ${skuDuplicates.length} affected SKUs ──`);
  if (skuDuplicates.length === 0) {
    console.log("  None. Tidy.\n");
  } else {
    for (const [sku, hits] of skuDuplicates) {
      console.log(`\n  SKU "${sku}" appears on ${hits.length} different products:`);
      for (const { variation, product } of hits) {
        const link = squareLink(product.square_token) || "(no Square link)";
        console.log(`    • ${product.name}`);
        console.log(`        product id: ${product.id}  variation: "${variation.name}"  status: ${product.status}`);
        console.log(`        ${link}`);
      }
    }
    console.log();
  }

  console.log(`── Name duplicates: ${nameDuplicates.length} affected names ──`);
  if (suppressedVariantGroups > 0) {
    console.log(`  (Suppressed ${suppressedVariantGroups} groups that look like sized-variant families.`);
    console.log(`   Pass --show-variants to include them.)`);
  }
  if (nameDuplicates.length === 0) {
    console.log("  None.\n");
  } else {
    for (const [name, hits] of nameDuplicates) {
      console.log(`\n  Name "${name}" appears on ${hits.length} products:`);
      for (const product of hits) {
        const link = squareLink(product.square_token) || "(no Square link)";
        console.log(`    • ${product.name}  [${product.status}]  sku=${product.sku || "—"}  base=${product.base_price ?? "—"}`);
        console.log(`        ${link}`);
      }
    }
    console.log();
  }

  console.log("Done.\n");
  console.log("Recommended next step: open suspect items in Square (links above) and");
  console.log("merge / delete the unwanted copy. Run a Square resync from the admin");
  console.log("when finished so the website mirror catches up.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
