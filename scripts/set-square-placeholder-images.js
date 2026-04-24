#!/usr/bin/env node
/**
 * DS Racing Karts — Bulk attach placeholder image in Square
 *
 * For every Square ITEM with no imageIds, attach a single placeholder image.
 *
 * Usage:
 *   node scripts/set-square-placeholder-images.js --file ./path/to/placeholder.png
 *
 * Options:
 *   --file <path>   Required. PNG/JPG/JPEG/GIF image to upload to Square.
 *   --name <text>   Optional. Placeholder image name in Square.
 *   --dry-run       Show counts only, do not write changes.
 *
 * Notes:
 *   - Requires SQUARE_ACCESS_TOKEN in .env.local
 *   - Uses SQUARE_ENVIRONMENT (production|sandbox), defaults to sandbox
 */

import dotenv from "dotenv";
import { resolve, extname } from "path";
import { createReadStream } from "fs";
import { randomUUID } from "crypto";
import { Client, Environment, FileWrapper } from "square";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

function argValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const imagePath = argValue("--file");
const placeholderName = argValue("--name") || "DSR Image Coming Soon";

if (!imagePath) {
  console.error("Missing required --file argument.");
  console.error("Example: node scripts/set-square-placeholder-images.js --file ./assets/image-coming-soon.png");
  process.exit(1);
}

const allowed = new Set([".png", ".jpg", ".jpeg", ".gif"]);
const extension = extname(imagePath).toLowerCase();
if (!allowed.has(extension)) {
  console.error(`Unsupported file type '${extension}'. Use PNG/JPG/JPEG/GIF.`);
  process.exit(1);
}

if (!process.env.SQUARE_ACCESS_TOKEN) {
  console.error("SQUARE_ACCESS_TOKEN is missing in .env.local");
  process.exit(1);
}

const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

async function listAllCatalogObjects(types) {
  const out = [];
  let cursor;

  do {
    const { result } = await square.catalogApi.listCatalog(cursor, types);
    out.push(...(result.objects || []));
    cursor = result.cursor;
  } while (cursor);

  return out;
}

async function ensurePlaceholderImageId() {
  const images = await listAllCatalogObjects("IMAGE");
  const existing = images.find((img) => img.imageData?.name === placeholderName);
  if (existing?.id) {
    return { imageId: existing.id, created: false };
  }

  const request = {
    idempotencyKey: randomUUID(),
    image: {
      id: "#image-coming-soon",
      type: "IMAGE",
      imageData: {
        name: placeholderName,
        caption: "Auto placeholder for items without photos",
      },
    },
  };

  const imageFile = new FileWrapper(createReadStream(imagePath));
  const { result } = await square.catalogApi.createCatalogImage(request, imageFile);
  const newId = result.image?.id;

  if (!newId) {
    throw new Error("Square did not return an image ID after upload.");
  }

  return { imageId: newId, created: true };
}

function chunk(array, size) {
  const parts = [];
  for (let i = 0; i < array.length; i += size) parts.push(array.slice(i, i + size));
  return parts;
}

async function main() {
  console.log("DS Racing Karts — Square Placeholder Image Attach");
  console.log(`Image file: ${imagePath}`);
  console.log(`Placeholder name: ${placeholderName}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);

  const items = await listAllCatalogObjects("ITEM");
  const itemsWithoutImages = items.filter((item) => {
    if (item.type !== "ITEM" || !item.itemData) return false;
    return !item.itemData.imageIds || item.itemData.imageIds.length === 0;
  });

  console.log(`Square items found: ${items.length}`);
  console.log(`Items without images: ${itemsWithoutImages.length}`);

  if (itemsWithoutImages.length === 0) {
    console.log("Nothing to update.");
    return;
  }

  if (isDryRun) {
    console.log("Dry run complete. No changes were written.");
    return;
  }

  const { imageId, created } = await ensurePlaceholderImageId();
  console.log(`${created ? "Created" : "Using existing"} placeholder image ID: ${imageId}`);

  // Square batch limit: max 1,000 objects per batch.
  const updates = itemsWithoutImages.map((item) => ({
    ...item,
    itemData: {
      ...item.itemData,
      imageIds: [imageId],
    },
  }));

  let updated = 0;
  for (const batch of chunk(updates, 1000)) {
    await square.catalogApi.batchUpsertCatalogObjects({
      idempotencyKey: randomUUID(),
      batches: [{ objects: batch }],
    });
    updated += batch.length;
    process.stdout.write(`\rUpdated in Square: ${updated} / ${updates.length}`);
  }

  console.log("\nDone.");
  console.log("Note: Website image reflection depends on webhook delivery/configuration.");
}

main().catch((err) => {
  const detail = err?.errors?.[0]?.detail || err?.message || String(err);
  console.error("Failed:", detail);
  process.exit(1);
});
