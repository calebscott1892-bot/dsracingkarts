import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const files = [
  { id: "1Uy6mLifotKWu8x_Ygb3ZzfZvS6lPdTLW", title: "Cathleen Thompson Racewear.png" },
  { id: "1XYZPo__vip3N2cc9QugRcgL6DgOldbZJ", title: "2026-02-10 14.17.10.jpg" },
  { id: "1Q6YJWGYRboLXdo5KWfV6kOOdSEzXLuNY", title: "2026-02-10 14.16.57.jpg" },
  { id: "1yKf82lUVDnuKY4jEcQG2ZpDeh1k_INXw", title: "2026-02-10 14.15.41.jpg" },
  { id: "1x6S1yVr8hGZaRfL4bcFiQMpVo-SNcssd", title: "2026-02-10 14.15.31.jpg" },
  { id: "1nwTfhr8yYCWbNvesCL9ebm0e_VQ_JJqV", title: "2026-02-10 14.13.05.jpg" },
  { id: "1q4JQcp-ObI4TwO96Bx8fMrX_U1WFiMfZ", title: "2026-02-10 14.12.13.jpg" },
  { id: "1cgSRintve647bEhPBK4xH6bcGa6JR1wk", title: "2026-02-10 14.10.23.jpg" },
  { id: "1NSkhsonwSjtLDBOnRchTCY8BXteo0Opz", title: "2026-02-10 14.10.08.jpg" },
  { id: "1IE-eOxyBwfKd3h4GA8abFPVnt_2aPpGU", title: "2025-12-27 10.23.06.jpg" },
  { id: "1DQxqoetK8DcQCGia3OUhs2ZdwmFXYwDP", title: "2025-12-27 10.23.05.jpg" },
  { id: "1nutVh5g6zibMf1bVwO-9B_qmgj4MyHhl", title: "2025-12-22 14.52.58.jpg" },
  { id: "113hnOLhTfbb-gKF3kYX_UcDtaPkXrXq5", title: "2025-12-22 14.51.47.jpg" },
  { id: "1gsragqFm-4OxX33kAejTs004n1VVc3Ue", title: "2025-12-22 14.50.06.jpg" },
  { id: "1gD5SVI5VHqK2hjGad2SuPQIuCas5cbxC", title: "2025-12-22 14.49.55.jpg" },
  { id: "1oGdDXRY1xdL2Yz8mUIBwvVFprVJhXRrl", title: "2025-12-22 13.42.26.jpg" },
  { id: "1Z8MdsRxdD3ZlHGS4jcviaKhE796m6lwg", title: "2025-12-22 13.41.44.jpg" },
  { id: "1IphFaT0QDep9MPaFVCdWKkqhFn-lEOGE", title: "2025-12-22 13.41.25.jpg" },
  { id: "1q4ESMu1VCfEiZSNvVjNpIS8BxlJ1JhvD", title: "2025-12-22 13.33.54.jpg" },
  { id: "1g_GX1hWoChsgNkEBG00I5Cy-mdHwelQ_", title: "2025-12-22 13.32.55.jpg" },
  { id: "1Jm-Kb7Ql0IYQxvKXHFWbBj37xxPitYIT", title: "2025-12-22 13.32.49.jpg" },
  { id: "1fSMSxRVbYkLiX6tpNhEp89z-DTO7tBgX", title: "2025-12-22 13.30.56.jpg" },
  { id: "1rfbO6wMBlNAwMatMUe-JDmasAYu5Iwyn", title: "2025-12-22 13.18.23.jpg" },
  { id: "1Wpshc4_a7WHRK7KtmRDq7Zdj-V0ExvfG", title: "2025-12-22 13.18.17.jpg" },
  { id: "1sBJhatbPrxt9Jcawo_GixPxuiKPti8Hj", title: "2025-12-22 13.16.11.jpg" },
  { id: "1ZjPcrlVbqttsbwg11PCQikRt79spKfaw", title: "2025-12-22 13.14.27.jpg" },
  { id: "1qgVCeOwByFLMHd4sqRwWFvpzEKGYyTkm", title: "2025-12-22 13.12.38.jpg" },
  { id: "1RXWOp184xocq1dsaFW02F_A3r3A6tEk5", title: "2025-12-22 13.07.39.jpg" },
  { id: "1oEGjEl6MeFubIjKGvxjAkuBJsT8igrJy", title: "2025-12-22 13.05.50.jpg" },
  { id: "19AXpVfP-qyRfjIF71YCP6d_knryb2kK6", title: "2025-12-22 13.04.32.jpg" },
  { id: "1Q9pWa56-n4nmJHcXtDXM3rSHOWCxqjxQ", title: "2025-12-22 13.04.02.jpg" },
  { id: "1STM_wyIk0-mJ-JSUyzzqSCMmMyBPCCsC", title: "2025-12-07 11.47.04.jpg" },
  { id: "1VFz_xz-tU4ZDLANqU0MeTLB0ahK3xaK-", title: "2025-06-12 14.04.46.jpg" },
  { id: "1Vzoo2DlbCvwEHt3lTNBw85xYKc3YPRIx", title: "2025-03-22 16.22.19.jpg" },
  { id: "1pWvbwwsDTWH4nxvLRnnv9no3so21GF-C", title: "2025-03-03 16.30.57.jpg" },
  { id: "1sH2A9Tiq10VL6fPFBaHG5vm07PokgLh7", title: "2025-03-03 16.30.52.jpg" },
  { id: "10enFQpE8ucRCbW_txbAybonJ4ZweADsc", title: "2025-03-01 13.52.01.png" },
  { id: "14XsKKXp0rb_7BuJ5CLYqbw4XfB7KNl8z", title: "2025-03-01 12.56.23.jpg" },
  { id: "1KyAPpDJTwrpmygd6tb4jvyhn-Nk-yB53", title: "2025-03-01 12.55.45.jpg" },
  { id: "15XRxJaR4VJywcXQWqQoWWcESqjTkhub_", title: "2025-03-01 12.55.27.jpg" },
  { id: "1xPjtDjKpiPDnbXmy1W6HwcoOHzJnt3m4", title: "2025-03-01 12.55.06.jpg" },
  { id: "1nY3d_lpIdIJsBiD5I0AjdD3AhtvMiJZn", title: "2025-03-01 12.54.51.jpg" },
  { id: "1isIecboLI5yYAznPky0y0hkvgGQ8jl3Y", title: "2025-03-01 12.54.50.jpg" },
  { id: "19_Za9a3A05aNoZH4Y_gXIXafVX2_AHat", title: "2025-03-01 12.54.36.jpg" },
  { id: "1Sy3m4Sl2vs6vvgBnMf29PUQCWjZpGKdv", title: "2025-03-01 12.54.31.jpg" },
  { id: "13vIyarDc9H87gugp7T2upFYyc_Kg7qzo", title: "2025-03-01 12.54.18.jpg" },
  { id: "10ow2PJc6gk23bOkAstfBQUD7dQ-zIAzT", title: "2025-03-01 12.53.12.jpg" },
  { id: "1AuGGHRVrVI-vWJl36WZWHgGX_JHjsOnB", title: "2025-03-01 12.53.00.jpg" },
  { id: "1i6DRKRE6bMCL1pt2C9xHAfRRv4oaXXPi", title: "2025-03-01 12.52.02.jpg" },
  { id: "19aFWhD1qc_Wgicttydr6HJ9c0gp1mPzN", title: "2025-02-07 16.34.04.jpg" },
  { id: "1W1_x7Kl5T7aEH94cTT1HjfGhpLaVmXtl", title: "2025-02-07 16.30.11.jpg" },
  { id: "1ST5mhV17kbCHH9dpw7_upC7mndnUY8Vo", title: "2025-02-07 16.29.59.jpg" },
  { id: "13e9YfMkJ-1AtT9NAwiZNa4WYoCpE6aCP", title: "2025-02-07 16.28.42.jpg" },
  { id: "1GUUgMwz79WeLwHAKrl22JCHA6PQWVP01", title: "2025-02-07 16.28.25.jpg" },
  { id: "1AIrhQ1kOJGAu-j082SpQ9UvVpx7W9vS5", title: "2025-02-05 16.20.18.jpg" },
  { id: "1Pj0MdqX3zsGXGPCTaejRTNtLYjZxYELd", title: "2025-02-05 16.19.51.jpg" },
  { id: "1TJlL0Om8UPYitYVNt-gKtikBzOTAnjJe", title: "2024-12-03 16.38.17.jpg" },
  { id: "1smro7b0YGyRpXwyuK9hmj_ZD3nC3C85e", title: "2024-12-03 16.38.13.jpg" },
  { id: "1QuRcVgkExOB-P8pWSXJYWBqeln3TCa__", title: "2024-12-03 16.37.53.jpg" },
  { id: "1Wi9OxQaqI_eo6_B1idSJfgzenwkOicH8", title: "2024-12-03 16.37.50.jpg" },
  { id: "1ITwwEu4199f-858ROwp21YUZjF-VUcNg", title: "2024-12-03 16.37.46.jpg" },
  { id: "1FXJHR--DL0LRnR4BCy1rn_0tIPZN8LUH", title: "2024-12-03 16.37.42.jpg" },
];

function extFromTitle(title) {
  const match = title.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "jpg";
}

function baseTitle(title) {
  return title.replace(/\.[^.]+$/, "").trim();
}

function isTimestampTitle(title) {
  return /^\d{4}-\d{2}-\d{2} /.test(title);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function groupLabelFromTitle(title) {
  const base = baseTitle(title);
  if (base.toLowerCase().includes("racewear")) {
    return base.replace(/\s*racewear\s*/i, "").trim() || "Racewear Gallery";
  }
  if (isTimestampTitle(base) || /^image\d+$/i.test(base)) {
    return "Racewear Gallery";
  }
  return base;
}

function altTextFromTitle(title) {
  const base = baseTitle(title);
  if (base.toLowerCase().includes("racewear")) {
    return `${base.replace(/\s+/g, " ").trim()} design or gallery image`;
  }
  return `Custom racewear gallery image - ${base}`;
}

function looksLikeImage(bytes) {
  if (!bytes || bytes.length < 12) return false;
  const header = Array.from(bytes.slice(0, 12));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng =
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a;
  const isWebp =
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50;
  return isJpeg || isPng || isWebp;
}

async function alreadyImported(id) {
  const { data, error } = await supabase
    .from("racewear_gallery")
    .select("id")
    .ilike("image_url", `%${id}%`)
    .limit(1);
  if (error) throw error;
  return Boolean(data && data.length > 0);
}

async function nextSortOrder() {
  const { data, error } = await supabase
    .from("racewear_gallery")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.sort_order || 0) + 10;
}

async function downloadDriveFile(id) {
  const response = await fetch(`https://drive.google.com/uc?export=download&id=${id}`);
  if (!response.ok) throw new Error(`Drive download failed for ${id}: ${response.status}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const htmlPreview = bytes.slice(0, 120).toString("utf8").toLowerCase();
  const looksLikeHtml =
    contentType.includes("text/html") ||
    htmlPreview.includes("<!doctype html") ||
    htmlPreview.includes("<html");

  if (looksLikeHtml || !looksLikeImage(bytes)) {
    throw new Error(
      `Drive file ${id} is not directly downloadable as an image. ` +
      `Set the Google Drive folder/files to 'Anyone with the link' viewer access, then rerun this importer.`
    );
  }

  return bytes;
}

async function uploadToStorage(file, bytes) {
  const ext = extFromTitle(file.title);
  const path = `drive-imports/${file.id}-${slugify(baseTitle(file.title))}.${ext}`;
  const { error } = await supabase.storage
    .from("racewear-photos")
    .upload(path, bytes, { contentType: ext === "png" ? "image/png" : "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("racewear-photos").getPublicUrl(path);
  return data.publicUrl;
}

async function insertGalleryRow(file, imageUrl, sortOrder) {
  const { error } = await supabase.from("racewear_gallery").insert({
    group_label: groupLabelFromTitle(file.title),
    image_url: imageUrl,
    alt_text: altTextFromTitle(file.title),
    sort_order: sortOrder,
    is_active: true,
  });
  if (error) throw error;
}

async function main() {
  let sortOrder = await nextSortOrder();
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    if (await alreadyImported(file.id)) {
      skipped++;
      continue;
    }

    const bytes = await downloadDriveFile(file.id);
    const publicUrl = await uploadToStorage(file, bytes);
    await insertGalleryRow(file, publicUrl, sortOrder);
    sortOrder += 1;
    imported++;
    console.log(`Imported ${file.title}`);
  }

  console.log(JSON.stringify({ imported, skipped, total: files.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
