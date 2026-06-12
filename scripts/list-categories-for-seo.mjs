// One-off: list top-level categories with product counts so the SEO copy map
// in /shop/[category] can be keyed to real slugs.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: categories, error } = await supabase
  .from("categories")
  .select("id, name, slug, parent_id");
if (error) throw error;

const { data: pcs, error: e2 } = await supabase
  .from("product_categories")
  .select("category_id");
if (e2) throw e2;

const counts = new Map();
for (const row of pcs) counts.set(row.category_id, (counts.get(row.category_id) || 0) + 1);

const byId = new Map(categories.map((c) => [c.id, c]));
const top = categories
  .filter((c) => !c.parent_id)
  .map((c) => {
    const childIds = categories.filter((x) => x.parent_id === c.id).map((x) => x.id);
    const total = [c.id, ...childIds].reduce((s, id) => s + (counts.get(id) || 0), 0);
    return { name: c.name, slug: c.slug, products: total, children: childIds.length };
  })
  .sort((a, b) => b.products - a.products);

for (const c of top) {
  console.log(`${String(c.products).padStart(5)}  ${c.slug.padEnd(30)} ${c.name}${c.children ? ` (${c.children} subcats)` : ""}`);
}
console.log(`-- total top-level: ${top.length}, total categories: ${categories.length}`);
