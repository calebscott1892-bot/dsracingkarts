#!/usr/bin/env node
/**
 * DS Racing Karts — Square CSV → Supabase Import Script
 *
 * Usage:
 *   1. npm install @supabase/supabase-js csv-parse dotenv
 *   2. Copy .env.example → .env and fill in your Supabase credentials
 *   3. Run the schema migration first (001_schema.sql)
 *   4. node scripts/import-square-csv.js path/to/catalog.csv
 *
 * What this does:
 *   - Parses the Square catalogue CSV export
 *   - Extracts and deduplicates categories (including nested parent > child)
 *   - Groups rows by Item Name to identify products vs variations
 *   - Creates products, variations, options, and inventory records
 *   - Generates URL-safe slugs for products and categories
 *   - Strips HTML from descriptions for search indexing
 */

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// ============================================================
// Config
// ============================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role for import

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// Helpers
// ============================================================

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove non-word chars
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, "") // trim leading/trailing
    .substring(0, 120); // reasonable length
}

/** Make slug unique by appending -2, -3, etc. */
function uniqueSlug(slug, existingSlugs) {
  let candidate = slug;
  let counter = 2;
  while (existingSlugs.has(candidate)) {
    candidate = `${slug}-${counter}`;
    counter++;
  }
  existingSlugs.add(candidate);
  return candidate;
}

/** Strip HTML tags for plaintext search field */
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse the Square categories string.
 *
 * Format examples:
 *   "Chains (3W6HEJG6ILUK2WY3JDTSMFMW), Torini"
 *   "Engines & Accessories > Honda GX200 (OFSMYPVR5D25ABCUEIZX4EOR), Honda GX200"
 *   "Nuts\\, Bolts & Washers (SXNZBI6CGLBD6525L7E63RAW)"
 *
 * Returns array of { name, squareId, parentName }
 */
function parseCategories(catString) {
  if (!catString) return [];

  // Square escapes commas in category names with backslash
  // Split on ", " but NOT on "\, " (escaped commas within names)
  // First, replace escaped commas with a placeholder
  const placeholder = "<<COMMA>>";
  const cleaned = catString.replace(/\\,/g, placeholder);

  const parts = cleaned.split(",").map((p) => p.trim());
  const results = [];

  for (const part of parts) {
    if (!part) continue;

    // Restore escaped commas
    const restored = part.replace(/<<COMMA>>/g, ",");

    // Extract Square ID if present: "Name (SQUARE_ID)"
    const idMatch = restored.match(/^(.+?)\s*\(([A-Z0-9]+)\)$/);

    let name, squareId;
    if (idMatch) {
      name = idMatch[1].trim();
      squareId = idMatch[2];
    } else {
      name = restored.trim();
      squareId = null;
    }

    // Check for nested category: "Parent > Child"
    let parentName = null;
    if (name.includes(" > ")) {
      const nestParts = name.split(" > ");
      parentName = nestParts[0].trim();
      name = nestParts[nestParts.length - 1].trim();
    }

    results.push({ name, squareId, parentName });
  }

  return results;
}

// ============================================================
// Main Import
// ============================================================

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: node scripts/import-square-csv.js <path-to-csv>");
    process.exit(1);
  }

  console.log(`Reading CSV: ${csvPath}`);
  const csvContent = readFileSync(resolve(csvPath), "utf-8");

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  console.log(`Parsed ${records.length} rows`);

  // ----------------------------------------------------------
  // PASS 1: Extract all unique categories
  // ----------------------------------------------------------
  console.log("\n--- Pass 1: Categories ---");

  /** Map of "name" → { name, squareId, parentName } */
  const categoryMap = new Map();

  for (const row of records) {
    const cats = parseCategories(row["Categories"]);
    for (const cat of cats) {
      // Use squareId as key if available, otherwise name
      const key = cat.squareId || cat.name;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, cat);
      }
    }
  }

  // Also extract parent categories that might only appear as prefixes
  const parentNames = new Set();
  for (const cat of categoryMap.values()) {
    if (cat.parentName && !categoryMap.has(cat.parentName)) {
      parentNames.add(cat.parentName);
    }
  }
  for (const pn of parentNames) {
    categoryMap.set(pn, { name: pn, squareId: null, parentName: null });
  }

  console.log(`Found ${categoryMap.size} unique categories`);

  // Insert parent categories first, then children
  const categorySlugs = new Set();
  const categoryIdLookup = new Map(); // key → uuid

  // First: categories without parents
  const parents = [...categoryMap.entries()].filter(
    ([, c]) => !c.parentName
  );
  const children = [...categoryMap.entries()].filter(
    ([, c]) => c.parentName
  );

  for (const [key, cat] of parents) {
    const slug = uniqueSlug(slugify(cat.name), categorySlugs);
    const { data, error } = await supabase
      .from("categories")
      .upsert(
        {
          name: cat.name,
          slug,
          square_id: cat.squareId,
          parent_id: null,
        },
        { onConflict: "square_id", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (error) {
      // Try insert without square_id conflict (for categories without one)
      const { data: d2, error: e2 } = await supabase
        .from("categories")
        .insert({ name: cat.name, slug, square_id: cat.squareId })
        .select("id")
        .single();
      if (e2) {
        console.error(`  Error inserting category "${cat.name}":`, e2.message);
        continue;
      }
      categoryIdLookup.set(key, d2.id);
      categoryIdLookup.set(cat.name, d2.id); // also by name
    } else {
      categoryIdLookup.set(key, data.id);
      categoryIdLookup.set(cat.name, data.id);
    }
  }

  console.log(`  Inserted ${parents.length} parent categories`);

  // Then: children (with parent reference)
  for (const [key, cat] of children) {
    const parentId = categoryIdLookup.get(cat.parentName);
    const slug = uniqueSlug(slugify(cat.name), categorySlugs);

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: cat.name,
        slug,
        square_id: cat.squareId,
        parent_id: parentId || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  Error inserting child category "${cat.name}":`, error.message);
      continue;
    }
    categoryIdLookup.set(key, data.id);
    categoryIdLookup.set(cat.name, data.id);
  }

  console.log(`  Inserted ${children.length} child categories`);

  // ----------------------------------------------------------
  // PASS 2: Group rows by Item Name to identify products & variations
  // ----------------------------------------------------------
  console.log("\n--- Pass 2: Products & Variations ---");

  /** Map of "Item Name" → array of CSV rows */
  const productGroups = new Map();

  for (const row of records) {
    const itemName = row["Item Name"];
    if (!itemName) continue;
    if (!productGroups.has(itemName)) {
      productGroups.set(itemName, []);
    }
    productGroups.get(itemName).push(row);
  }

  console.log(`Found ${productGroups.size} unique products`);

  const productSlugs = new Set();
  let productCount = 0;
  let variationCount = 0;

  for (const [itemName, rows] of productGroups) {
    // Use the first row for product-level data
    const primary = rows[0];

    // Find the row with the most data (description, etc.)
    const bestRow =
      rows.find((r) => r["Description"] && r["Description"].length > 10) ||
      primary;

    const slug = uniqueSlug(slugify(itemName), productSlugs);

    const vis = (primary["Square Online Item Visibility"] || "visible").toLowerCase();
    const visibility = ["visible", "hidden", "unavailable"].includes(vis)
      ? vis
      : "visible";

    // Find lowest price across variations
    const prices = rows
      .map((r) => parseFloat(r["Price"]))
      .filter((p) => !isNaN(p));
    const basePrice = prices.length > 0 ? Math.min(...prices) : null;

    // Insert product
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        name: itemName,
        slug,
        description: bestRow["Description"] || null,
        description_plain: stripHtml(bestRow["Description"]),
        sku: primary["SKU"] || null,
        square_token: primary["Token"] || null,
        status: primary["Archived"] === "Y" ? "archived" : "active",
        visibility,
        item_type: primary["Item Type"] || "Physical good",
        weight_kg: parseFloat(primary["Weight (kg)"]) || null,
        seo_title: primary["SEO Title"] || null,
        seo_description: primary["SEO Description"] || null,
        permalink: primary["Permalink"] || null,
        gtin: primary["GTIN"] || null,
        shipping_enabled: primary["Shipping Enabled"] === "Y",
        is_sellable: primary["Sellable"] !== "N",
        is_stockable: primary["Stockable"] !== "N",
        is_archived: primary["Archived"] === "Y",
        base_price: basePrice,
      })
      .select("id")
      .single();

    if (productError) {
      console.error(`  Error inserting product "${itemName}":`, productError.message);
      continue;
    }

    productCount++;

    // Link product to categories
    const cats = parseCategories(bestRow["Categories"]);
    for (const cat of cats) {
      const catKey = cat.squareId || cat.name;
      const catId = categoryIdLookup.get(catKey);
      if (catId) {
        await supabase.from("product_categories").insert({
          product_id: product.id,
          category_id: catId,
        });
      }
    }

    // Insert variations
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const variationName = row["Variation Name"] || "Regular";
      const price = parseFloat(row["Price"]);
      if (isNaN(price)) continue;

      const salePrice = parseFloat(row["Online Sale Price"]);

      const { data: variation, error: varError } = await supabase
        .from("product_variations")
        .insert({
          product_id: product.id,
          name: variationName,
          sku: row["SKU"] || null,
          square_token: row["Token"] || null,
          price,
          sale_price: isNaN(salePrice) ? null : salePrice,
          sort_order: i,
        })
        .select("id")
        .single();

      if (varError) {
        console.error(`    Error inserting variation "${variationName}":`, varError.message);
        continue;
      }

      variationCount++;

      // Insert variation options (Option Name 1 / Option Value 1, etc.)
      for (let n = 1; n <= 2; n++) {
        const optName = row[`Option Name ${n}`];
        const optValue = row[`Option Value ${n}`];
        if (optName && optValue) {
          await supabase.from("variation_options").insert({
            variation_id: variation.id,
            option_name: optName,
            option_value: optValue,
          });
        }
      }

      // Insert inventory record
      const stockCol = "Current Quantity DS Racing Karts";
      const qty = parseInt(row[stockCol], 10);
      const alertEnabled = row["Stock Alert Enabled DS Racing Karts"] === "Y";
      const alertCount =
        parseInt(row["Stock Alert Count DS Racing Karts"], 10) || 0;

      await supabase.from("inventory").insert({
        variation_id: variation.id,
        quantity: isNaN(qty) ? 0 : qty,
        low_stock_alert: alertEnabled,
        low_stock_threshold: alertCount,
      });
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Products:   ${productCount}`);
  console.log(`   Variations: ${variationCount}`);
  console.log(`   Categories: ${categoryMap.size}`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
