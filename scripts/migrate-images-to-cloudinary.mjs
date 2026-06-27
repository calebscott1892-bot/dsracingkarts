#!/usr/bin/env node
/**
 * DS Racing Karts — Image migration to Cloudinary
 *
 * WHY: With `unoptimized: true` (a workaround for Vercel's image-optimizer
 * hitting its quota), every image is served full-size straight from its
 * origin. The Supabase Storage buckets (racewear-photos ~557MB, product-images
 * ~240MB) being served that way blew Supabase's free egress cap, which 402'd
 * the whole project and emptied the shop. Moving images onto Cloudinary takes
 * that bandwidth off Supabase AND off Vercel's optimizer (Cloudinary does
 * f_auto/q_auto), fixing both quota problems at once.
 *
 * WHAT IT DOES: For each image-bearing column, upload the current image to
 * Cloudinary (server-side fetch — Cloudinary pulls the source URL itself) under
 * a deterministic public_id, then repoint the DB column at the Cloudinary URL
 * (with f_auto,q_auto baked in). Idempotent and resumable: rows already on
 * Cloudinary are skipped, and re-running overwrites the same public_id rather
 * than duplicating.
 *
 * PREREQUISITES:
 *   - The Supabase project must be OFF the restricted/402 state, i.e. upgraded
 *     to Pro (or past the quota reset). This unblocks both the data API (so we
 *     can read/write rows) and Storage (so Cloudinary can fetch the source
 *     images). The script refuses to run while restricted.
 *   - .env.local with: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *     and Cloudinary creds — either CLOUDINARY_URL=cloudinary://key:secret@cloud
 *     or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
 *   - next.config.mjs must already allow res.cloudinary.com (done) and be
 *     DEPLOYED before repointed URLs go live, or images 404 on the live site.
 *
 * USAGE:
 *   node scripts/migrate-images-to-cloudinary.mjs --dry-run            # preview
 *   node scripts/migrate-images-to-cloudinary.mjs --source=supabase    # the egress culprit first
 *   node scripts/migrate-images-to-cloudinary.mjs                      # everything not yet on Cloudinary
 *   node scripts/migrate-images-to-cloudinary.mjs --tables=products --limit=20   # small pilot
 *
 * FLAGS:
 *   --dry-run            log intended actions, change nothing
 *   --source=all|supabase|square   only migrate rows whose current URL is on that host (default all)
 *   --tables=<csv>       restrict to named targets (default all)
 *   --limit=N            cap rows processed per target (handy for a pilot)
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// ── Config ───────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const DRY_RUN = Boolean(args["dry-run"]);
const SOURCE = (args.source || "all").toLowerCase(); // all | supabase | square
const ONLY_TABLES = args.tables ? String(args.tables).split(",") : null;
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const CONCURRENCY = 6;
const PAGE = 500;
// Delivery transform baked into stored URLs: auto format + auto quality. This
// alone takes a 583KB JPEG to ~17KB WebP at grid size and keeps us well inside
// Cloudinary's free tier. (Width-based responsive sizing can be layered later
// via a Next image loader; not required to end the outage.)
const DELIVERY_TX = "f_auto,q_auto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    const m = process.env.CLOUDINARY_URL.match(
      /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/
    );
    if (m) return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
  }
  return {
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}
const CLD = parseCloudinary();

for (const [k, v] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_KEY,
  "Cloudinary cloud name": CLD.cloudName,
  "Cloudinary api key": CLD.apiKey,
  "Cloudinary api secret": CLD.apiSecret,
})) {
  if (!v) {
    console.error(`✖ Missing required config: ${k}`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── What to migrate ──────────────────────────────────────────
// Each target: a table + the text column holding an image URL, plus how to
// build a stable Cloudinary public_id for a row.
const TARGETS = [
  {
    name: "products",
    table: "products",
    column: "primary_image_url",
    select: "id, product_id:id, primary_image_url",
    publicId: (r) => `dsr/products/${r.id}/primary`,
  },
  {
    name: "product_images",
    table: "product_images",
    column: "url",
    select: "id, product_id, url",
    publicId: (r) => `dsr/products/${r.product_id}/${r.id}`,
  },
  {
    name: "racewear_gallery",
    table: "racewear_gallery",
    column: "image_url",
    select: "id, image_url",
    publicId: (r) => `dsr/racewear/${r.id}`,
  },
  {
    name: "categories",
    table: "categories",
    column: "image_url",
    select: "id, image_url",
    publicId: (r) => `dsr/categories/${r.id}`,
  },
  {
    name: "chassis_listings",
    table: "chassis_listings",
    column: "image_url",
    select: "id, image_url",
    publicId: (r) => `dsr/chassis/${r.id}`,
  },
];

// ── Helpers ──────────────────────────────────────────────────
const isCloudinary = (u) => typeof u === "string" && u.includes("res.cloudinary.com");
const isLocal = (u) => typeof u === "string" && u.startsWith("/");
const isSupabase = (u) => typeof u === "string" && u.includes(".supabase.co/storage");
const isSquare = (u) =>
  typeof u === "string" && u.includes("items-images-production.s3");

function matchesSource(url) {
  if (SOURCE === "supabase") return isSupabase(url);
  if (SOURCE === "square") return isSquare(url);
  return true;
}

/** A row needs migrating if it has a real, remote, non-Cloudinary URL. */
function needsMigration(url) {
  return (
    typeof url === "string" &&
    url.length > 0 &&
    !isCloudinary(url) &&
    !isLocal(url) &&
    matchesSource(url)
  );
}

/** Signed server-side fetch upload. Cloudinary pulls `sourceUrl` itself. */
async function rawUpload(sourceUrl, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  // Only these params are signed (file/api_key/resource_type/cloud_name are excluded).
  const signed = { overwrite: "true", public_id: publicId, timestamp: String(timestamp) };
  const toSign = Object.keys(signed)
    .sort()
    .map((k) => `${k}=${signed[k]}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + CLD.apiSecret).digest("hex");

  const form = new URLSearchParams({
    file: sourceUrl,
    api_key: CLD.apiKey,
    ...signed,
    signature,
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLD.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Cloudinary ${res.status}`);
  }
  // Build a clean delivery URL with the optimization transform baked in.
  return `https://res.cloudinary.com/${CLD.cloudName}/image/upload/${DELIVERY_TX}/v${json.version}/${json.public_id}.${json.format}`;
}

/**
 * Supabase Storage object URL -> on-the-fly downscaled render URL. Lets us feed
 * Cloudinary a smaller file when an original exceeds its 10MB ingestion limit.
 * Returns null for non-Supabase-Storage URLs.
 */
function supabaseRenderUrl(url) {
  if (typeof url !== "string" || !url.includes("/storage/v1/object/public/")) return null;
  const rendered = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );
  return `${rendered}${rendered.includes("?") ? "&" : "?"}width=2400&quality=80`;
}

/**
 * Upload wrapper: on Cloudinary's "file size too large" (free-tier 10MB cap),
 * retry once via Supabase's downscaling render endpoint so big originals still
 * make it across.
 */
async function uploadToCloudinary(sourceUrl, publicId) {
  try {
    return await rawUpload(sourceUrl, publicId);
  } catch (err) {
    if (/file size too large/i.test(err.message || "")) {
      const ren = supabaseRenderUrl(sourceUrl);
      if (ren) return await rawUpload(ren, publicId);
    }
    throw err;
  }
}

async function pMap(items, fn, concurrency) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── Preflight: refuse to run while the project is restricted ──
async function preflight() {
  const { error } = await supabase.from("products").select("id").limit(1);
  if (error) {
    const msg = String(error.message || error);
    if (msg.includes("402") || /restrict|egress|quota/i.test(msg)) {
      console.error(
        "✖ Supabase is still restricted (egress/402). Upgrade the project to Pro\n" +
          "  (or wait for the quota reset) before migrating — the source images and\n" +
          "  the data API are both locked until then."
      );
    } else {
      console.error("✖ Supabase preflight failed:", msg);
    }
    process.exit(1);
  }
}

// ── Migrate one target ───────────────────────────────────────
const urlCache = new Map(); // sourceUrl -> deliveryUrl (dedupe identical sources)
let totalDone = 0;
let totalFail = 0;
let totalSkip = 0;

async function migrateTarget(t) {
  console.log(`\n━━ ${t.name} (${t.table}.${t.column}) ━━`);
  let lastId = null;
  let processed = 0;

  while (processed < LIMIT) {
    // Keyset pagination by id: stable even as we mutate rows mid-run (range
    // offsets drift when the underlying rows change). Excluding already-migrated
    // rows at the DB level keeps re-runs cheap; failures are simply revisited on
    // the next run since we advance past their id this run.
    let q = supabase
      .from(t.table)
      .select(t.select)
      .not(t.column, "is", null)
      .not(t.column, "ilike", "%res.cloudinary.com%")
      .order("id", { ascending: true })
      .limit(PAGE);
    if (lastId) q = q.gt("id", lastId);
    const { data: rows, error } = await q;
    if (error) {
      console.error(`  ✖ read failed: ${error.message}`);
      return;
    }
    if (!rows?.length) break;
    lastId = rows[rows.length - 1].id;

    const todo = rows
      .filter((r) => needsMigration(r[t.column]))
      .slice(0, LIMIT - processed);
    totalSkip += rows.length - todo.length;
    if (!todo.length) continue;

    await pMap(
      todo,
      async (row) => {
        const src = row[t.column];
        const publicId = t.publicId(row);
        try {
          if (DRY_RUN) {
            console.log(`  • would migrate ${t.name}#${row.id} → ${publicId}`);
            totalDone++;
            return;
          }
          let delivery = urlCache.get(src);
          if (!delivery) {
            delivery = await uploadToCloudinary(src, publicId);
            urlCache.set(src, delivery);
          }
          const { error: upErr } = await supabase
            .from(t.table)
            .update({ [t.column]: delivery })
            .eq("id", row.id);
          if (upErr) throw new Error(`db update: ${upErr.message}`);
          totalDone++;
          if (totalDone % 50 === 0) console.log(`  …${totalDone} migrated`);
        } catch (err) {
          totalFail++;
          console.error(`  ✖ ${t.name}#${row.id}: ${err.message}`);
        }
      },
      CONCURRENCY
    );

    processed += todo.length;
  }
  console.log(`  ${t.name}: done (${processed} processed this run)`);
}

// ── Run ──────────────────────────────────────────────────────
(async () => {
  console.log(
    `Cloudinary migration — cloud=${CLD.cloudName} source=${SOURCE}` +
      (DRY_RUN ? " [DRY RUN]" : "") +
      (LIMIT !== Infinity ? ` limit=${LIMIT}/target` : "")
  );
  if (!DRY_RUN) await preflight();

  const targets = ONLY_TABLES
    ? TARGETS.filter((t) => ONLY_TABLES.includes(t.name))
    : TARGETS;

  for (const t of targets) await migrateTarget(t);

  console.log(
    `\n✅ Finished: ${totalDone} migrated, ${totalFail} failed, ${totalSkip} skipped (already done / local).`
  );
  if (totalFail) process.exitCode = 1;
})();
