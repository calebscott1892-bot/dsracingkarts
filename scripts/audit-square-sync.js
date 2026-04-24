#!/usr/bin/env node

/**
 * Reconciliation script: Compare Square catalog state with Supabase products
 * Usage: node scripts/audit-square-sync.js [--verbose]
 */

import { createClient } from "@supabase/supabase-js";
import { Client } from "square";

const verbose = process.argv.includes("--verbose");

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQUARE_ACCESS_TOKEN = process.env.NEXT_SQUARE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !SQUARE_ACCESS_TOKEN) {
  console.error("❌ Missing required environment variables:");
  if (!SUPABASE_URL) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_KEY) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  if (!SQUARE_ACCESS_TOKEN) console.error("  - NEXT_SQUARE_ACCESS_TOKEN");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const squareClient = new Client({
  accessToken: SQUARE_ACCESS_TOKEN,
  environment: "production",
});

async function getSquareItems() {
  const items = [];
  let cursor = null;

  try {
    while (true) {
      const response = await squareClient.catalogApi.listCatalog(cursor, "ITEM");
      if (response.result.objects) {
        items.push(...response.result.objects);
      }
      cursor = response.result.cursor;
      if (!cursor) break;
    }
  } catch (error) {
    console.error("❌ Error fetching Square catalog:", error.message);
    process.exit(1);
  }

  return items;
}

async function getSupabaseProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .not("square_token", "is", null);

  if (error) {
    console.error("❌ Error fetching Supabase products:", error.message);
    process.exit(1);
  }

  return data || [];
}

function formatPrice(priceInCents) {
  if (!priceInCents) return "N/A";
  return `$${(priceInCents / 100).toFixed(2)} AUD`;
}

function compareProduct(squareItem, supabaseProduct) {
  const issues = [];

  const squareName = squareItem.itemData.name || "";
  const squarePrice = squareItem.itemData.variations?.[0]?.itemVariationData
    ?.priceMoney?.amount;
  const squareVariationCount = squareItem.itemData.variations?.length || 0;

  const supabaseName = supabaseProduct.name;
  const supabasePrice = supabaseProduct.price;
  const supabaseVariationCount = supabaseProduct.variations_count || 0;

  if (squareName !== supabaseName) {
    issues.push(
      `Name mismatch: Square="${squareName}" vs Supabase="${supabaseName}"`
    );
  }

  if (squarePrice && supabasePrice && squarePrice !== supabasePrice * 100) {
    issues.push(
      `Price mismatch: Square=${formatPrice(squarePrice)} vs Supabase=$${supabasePrice}`
    );
  }

  if (squareVariationCount !== supabaseVariationCount) {
    issues.push(
      `Variation count mismatch: Square=${squareVariationCount} vs Supabase=${supabaseVariationCount}`
    );
  }

  return issues;
}

async function main() {
  console.log("\n📊 Square ↔ Supabase Sync Reconciliation Report");
  console.log("=".repeat(60));
  console.log(`Generated: ${new Date().toISOString()}`);
  if (verbose) console.log("Mode: VERBOSE\n");
  else console.log("Mode: SUMMARY (use --verbose for details)\n");

  // Fetch data
  console.log("🔄 Fetching Square catalog...");
  const squareItems = await getSquareItems();
  console.log(`   ✓ Found ${squareItems.length} items in Square\n`);

  console.log("🔄 Fetching Supabase products...");
  const supabaseProducts = await getSupabaseProducts();
  console.log(`   ✓ Found ${supabaseProducts.length} products in Supabase\n`);

  // Build lookup maps
  const squareByToken = {};
  squareItems.forEach((item) => {
    squareByToken[item.id] = item;
  });

  const supabaseByToken = {};
  supabaseProducts.forEach((product) => {
    if (product.square_token) {
      supabaseByToken[product.square_token] = product;
    }
  });

  // Analysis
  const synced = [];
  const drifted = [];
  const onlyInSupabase = [];
  const onlyInSquare = [];

  // Check Supabase products against Square
  supabaseProducts.forEach((product) => {
    if (!product.square_token) return; // Skip if no square_token

    const squareItem = squareByToken[product.square_token];
    if (!squareItem) {
      onlyInSupabase.push(product);
      return;
    }

    const issues = compareProduct(squareItem, product);
    if (issues.length === 0) {
      synced.push({ product, squareItem });
    } else {
      drifted.push({ product, squareItem, issues });
    }
  });

  // Check for items only in Square
  squareItems.forEach((item) => {
    if (!supabaseByToken[item.id]) {
      onlyInSquare.push(item);
    }
  });

  // Display summary
  console.log("📈 SYNC STATUS SUMMARY");
  console.log("-".repeat(60));
  console.log(`✅ In Sync:         ${synced.length} items`);
  console.log(`⚠️  Drifted:        ${drifted.length} items`);
  console.log(`🔴 Only in Supabase: ${onlyInSupabase.length} items`);
  console.log(`🔵 Only in Square:  ${onlyInSquare.length} items`);
  console.log(`\nTotal Synced Items: ${synced.length} / ${supabaseProducts.length}\n`);

  // Detailed findings
  if (drifted.length > 0) {
    console.log("⚠️  DRIFTED ITEMS (need attention)");
    console.log("-".repeat(60));
    drifted.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.product.name}`);
      console.log(`   Square ID: ${item.product.square_token}`);
      item.issues.forEach((issue) => {
        console.log(`   • ${issue}`);
      });
      if (verbose) {
        console.log(`   Square price: ${formatPrice(item.squareItem.itemData.variations?.[0]?.itemVariationData?.priceMoney?.amount)}`);
        console.log(`   Supabase price: $${item.product.price}`);
      }
      console.log();
    });
  }

  if (onlyInSupabase.length > 0) {
    console.log("🔴 ONLY IN SUPABASE (not imported from Square)");
    console.log("-".repeat(60));
    onlyInSupabase.forEach((product, idx) => {
      console.log(`${idx + 1}. ${product.name}`);
      console.log(`   Square ID: ${product.square_token}`);
      if (verbose) {
        console.log(`   Price: $${product.price}`);
        console.log(`   Created: ${product.created_at}`);
      }
    });
    console.log();
  }

  if (onlyInSquare.length > 0) {
    console.log("🔵 ONLY IN SQUARE (not yet synced to Supabase)");
    console.log("-".repeat(60));
    onlyInSquare.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.itemData.name}`);
      console.log(`   Square ID: ${item.id}`);
      console.log(`   Variations: ${item.itemData.variations?.length || 0}`);
      if (verbose) {
        const price = item.itemData.variations?.[0]?.itemVariationData?.priceMoney
          ?.amount;
        console.log(`   Price: ${formatPrice(price)}`);
      }
    });
    console.log();
  }

  // Recommendations
  if (drifted.length > 0 || onlyInSquare.length > 0) {
    console.log("💡 RECOMMENDATIONS");
    console.log("-".repeat(60));
    if (drifted.length > 0) {
      console.log(`• Re-sync ${drifted.length} drifted item(s) from Square webhook`);
    }
    if (onlyInSquare.length > 0) {
      console.log(`• Import ${onlyInSquare.length} missing item(s) from Square`);
      console.log("  Command: node scripts/import-square-csv.js");
    }
    console.log();
  } else {
    console.log("✅ No issues detected — catalog is fully in sync!\n");
  }

  // Summary stats
  console.log("📊 FINAL METRICS");
  console.log("-".repeat(60));
  const syncPercentage =
    supabaseProducts.length > 0
      ? ((synced.length / supabaseProducts.length) * 100).toFixed(1)
      : "0.0";
  console.log(`Sync Rate: ${syncPercentage}% (${synced.length}/${supabaseProducts.length})`);
  console.log(`Integrity: ${drifted.length === 0 ? "✅ PASS" : "⚠️  ISSUES FOUND"}`);
  console.log(`Coverage: ${onlyInSquare.length === 0 ? "✅ COMPLETE" : "⚠️  GAPS EXIST"}`);
  console.log("\n");
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
