#!/usr/bin/env node
/**
 * DS Racing Karts — Product Image Migration
 *
 * Pulls product images from Square's Catalog API and uploads them
 * to Supabase Storage, then links them in the product_images table.
 *
 * Prerequisites:
 *   - SQUARE_ACCESS_TOKEN in .env.local
 *   - Supabase "product-images" storage bucket created (public)
 *   - Products already imported via import-square-csv.js
 *
 * Usage:
 *   node scripts/migrate-images.js
 *
 * Strategy:
 *   1. Fetch all catalog items from Square API (includes image_ids)
 *   2. For each item with images, fetch image URLs via CatalogApi
 *   3. Download each image
 *   4. Upload to Supabase Storage (product-images bucket)
 *   5. Insert into product_images table and set primary_image_url
 *
 * Alternative: If Square API access isn't available, the script
 * includes a fallback scraper that pulls images from the current
 * Weebly/Square Online site.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SQUARE_API_BASE = process.env.SQUARE_ENVIRONMENT === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

// ============================================================
// Strategy 1: Square Catalog API (RECOMMENDED)
// ============================================================

async function fetchSquareCatalog(cursor = null) {
  const url = new URL(`${SQUARE_API_BASE}/v2/catalog/list`);
  url.searchParams.set("types", "IMAGE");
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${SQUARE_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Square API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function fetchItemImages() {
  // Get all items with their image references
  let cursor = null;
  const allImages = [];

  do {
    const url = new URL(`${SQUARE_API_BASE}/v2/catalog/list`);
    url.searchParams.set("types", "ITEM");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${SQUARE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    const items = data.objects || [];

    for (const item of items) {
      if (item.item_data?.image_ids?.length) {
        allImages.push({
          squareItemId: item.id,
          imageIds: item.item_data.image_ids,
          itemName: item.item_data.name,
        });
      }
    }

    cursor = data.cursor;
  } while (cursor);

  return allImages;
}

async function fetchImageUrl(imageId) {
  const res = await fetch(
    `${SQUARE_API_BASE}/v2/catalog/object/${imageId}`,
    {
      headers: {
        Authorization: `Bearer ${SQUARE_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await res.json();
  return data.object?.image_data?.url || null;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${url}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/jpeg",
  };
}

async function uploadToSupabase(fileName, buffer, contentType) {
  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(data.path);

  return publicUrl;
}

// ============================================================
// Main migration
// ============================================================

async function migrateViaApi() {
  console.log("🔍 Fetching items with images from Square API…");
  const itemsWithImages = await fetchItemImages();
  console.log(`   Found ${itemsWithImages.length} items with images`);

  let migrated = 0;
  let failed = 0;

  for (const item of itemsWithImages) {
    // CSV tokens are variation IDs, not item IDs — match by name instead
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .ilike("name", item.itemName);

    const product = products?.[0];

    if (!product) {
      console.log(`   ⚠ No DB match for Square item: ${item.itemName}`);
      continue;
    }

    for (let i = 0; i < item.imageIds.length; i++) {
      try {
        const imageUrl = await fetchImageUrl(item.imageIds[i]);
        if (!imageUrl) continue;

        const { buffer, contentType } = await downloadImage(imageUrl);
        const ext = contentType.includes("png") ? "png" : "jpg";
        const fileName = `${product.id}/${i + 1}.${ext}`;

        const publicUrl = await uploadToSupabase(fileName, buffer, contentType);

        // Insert into product_images
        await supabase.from("product_images").insert({
          product_id: product.id,
          url: publicUrl,
          alt_text: product.name,
          sort_order: i,
          is_primary: i === 0,
        });

        // Set primary image on product
        if (i === 0) {
          await supabase
            .from("products")
            .update({ primary_image_url: publicUrl })
            .eq("id", product.id);
        }

        migrated++;
        console.log(`   ✅ ${product.name} — image ${i + 1}`);
      } catch (err) {
        failed++;
        console.error(`   ❌ ${product.name} — image ${i + 1}:`, err.message);
      }
    }

    // Rate limit: Square API allows 100 req/sec
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n✅ Migration complete: ${migrated} images migrated, ${failed} failed`);
}

// ============================================================
// Strategy 2: Scrape from current site (FALLBACK)
// ============================================================

async function migrateViaScrape() {
  console.log("🌐 Scraping images from dsracingkarts.com.au…");
  console.log("   (This is the fallback strategy — Square API is preferred)\n");

  // Get all products with their permalinks/slugs
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, permalink")
    .eq("status", "active")
    .is("primary_image_url", null); // only products without images

  if (!products?.length) {
    console.log("   All products already have images.");
    return;
  }

  console.log(`   Found ${products.length} products without images`);

  let migrated = 0;

  for (const product of products) {
    try {
      // Construct likely URL on current site
      const permalink = product.permalink || product.slug;
      const pageUrl = `https://dsracingkarts.com.au/store/p/${permalink}`;

      const res = await fetch(pageUrl);
      if (!res.ok) continue;

      const html = await res.text();

      // Extract image URLs from the page (Square Online/Weebly pattern)
      const imgRegex =
        /https:\/\/images\.squarespace-cdn\.com[^"'\s)]+|https:\/\/square-catalog-sandbox[^"'\s)]+|https:\/\/items-images-production\.s3\.us-west-2\.amazonaws\.com[^"'\s)]+/g;
      const imageUrls = [...new Set(html.match(imgRegex) || [])];

      for (let i = 0; i < Math.min(imageUrls.length, 5); i++) {
        const { buffer, contentType } = await downloadImage(imageUrls[i]);
        const ext = contentType.includes("png") ? "png" : "jpg";
        const fileName = `${product.id}/${i + 1}.${ext}`;

        const publicUrl = await uploadToSupabase(fileName, buffer, contentType);

        await supabase.from("product_images").insert({
          product_id: product.id,
          url: publicUrl,
          alt_text: product.name,
          sort_order: i,
          is_primary: i === 0,
        });

        if (i === 0) {
          await supabase
            .from("products")
            .update({ primary_image_url: publicUrl })
            .eq("id", product.id);
        }

        migrated++;
      }

      console.log(
        `   ✅ ${product.name}: ${Math.min(imageUrls.length, 5)} images`
      );

      // Polite scraping delay
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`   ❌ ${product.name}:`, err.message);
    }
  }

  console.log(`\n✅ Scrape complete: ${migrated} images migrated`);
}

// ============================================================
// Run
// ============================================================

const strategy = process.argv[2] || "api";

if (strategy === "scrape") {
  migrateViaScrape().catch(console.error);
} else {
  migrateViaApi().catch(console.error);
}
