#!/usr/bin/env node
/**
 * DS Racing Karts — Set placeholder image on products without a primary image
 *
 * Sets primary_image_url to '/images/image-coming-soon.svg' on every product
 * where primary_image_url is NULL or empty.
 *
 * Usage:
 *   node scripts/set-placeholder-images.js
 *
 * Options:
 *   --dry-run    Print how many products would be updated without writing
 *
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const PLACEHOLDER = "/images/image-coming-soon.svg";
const isDryRun = process.argv.includes("--dry-run");

// ─── Supabase client (service role bypasses RLS) ───────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log(`DS Racing Karts — Set Placeholder Images`);
  console.log(`Placeholder: ${PLACEHOLDER}`);
  if (isDryRun) console.log(`Mode: DRY RUN (no changes will be written)\n`);
  else console.log(`Mode: LIVE\n`);

  // 1. Count how many products need the placeholder
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .or("primary_image_url.is.null,primary_image_url.eq.");

  if (countError) {
    console.error("Failed to count products:", countError.message);
    process.exit(1);
  }

  console.log(`Products without an image: ${count}`);

  if (count === 0) {
    console.log("Nothing to do — all products already have an image.");
    return;
  }

  if (isDryRun) {
    console.log(`Would update ${count} product(s). Run without --dry-run to apply.`);
    return;
  }

  // 2. Update in batches of 500 to stay within Supabase limits
  const BATCH = 500;
  let updated = 0;

  while (updated < count) {
    // Fetch a batch of IDs that still need updating
    const { data: rows, error: fetchError } = await supabase
      .from("products")
      .select("id")
      .or("primary_image_url.is.null,primary_image_url.eq.")
      .limit(BATCH);

    if (fetchError) {
      console.error("Fetch error:", fetchError.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) break;

    const ids = rows.map((r) => r.id);

    const { error: updateError } = await supabase
      .from("products")
      .update({ primary_image_url: PLACEHOLDER, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) {
      console.error("Update error:", updateError.message);
      process.exit(1);
    }

    updated += ids.length;
    process.stdout.write(`\rUpdated: ${updated} / ${count}`);
  }

  console.log(`\n\nDone. ${updated} product(s) now show the placeholder image.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
