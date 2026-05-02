#!/usr/bin/env node
/** Print the local category tree, indented, for visual sanity-checking. */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: cats } = await supabase
  .from("categories")
  .select("id, name, slug, parent_id, square_id")
  .order("name");

const { data: links } = await supabase.from("product_categories").select("category_id");
const counts = new Map();
for (const l of links || []) counts.set(l.category_id, (counts.get(l.category_id) || 0) + 1);

const byParent = new Map();
for (const cat of cats) {
  const key = cat.parent_id || "_root";
  if (!byParent.has(key)) byParent.set(key, []);
  byParent.get(key).push(cat);
}

function print(parentId, depth) {
  const list = byParent.get(parentId || "_root") || [];
  list.sort((a, b) => a.name.localeCompare(b.name));
  for (const cat of list) {
    const indent = "  ".repeat(depth);
    const flag = !cat.square_id ? " [no_square_id]" : "";
    console.log(
      `${indent}${cat.name}  (products=${counts.get(cat.id) || 0})${flag}`
    );
    print(cat.id, depth + 1);
  }
}
print(null, 0);
