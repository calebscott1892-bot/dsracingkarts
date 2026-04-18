/**
 * Merge duplicate categories in Supabase.
 *
 * Strategy:
 * 1. Group categories by name.
 * 2. For each group with >1 entry, pick a "keeper":
 *    - Prefer the one that already has child categories (is a parent).
 *    - Otherwise prefer the one with a meaningful parent_id (subcategory).
 *    - Otherwise prefer the slug without a `-2`/`-3` suffix.
 * 3. Reassign all product_categories from duplicates → keeper.
 * 4. Re-parent any child categories pointing to duplicates → keeper.
 * 5. Delete the duplicate rows.
 * 6. Clean up keeper slugs (remove `-2`/`-3` suffixes).
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://bqkefjpoejjgxdxueiod.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxa2VmanBvZWpqZ3hkeHVlaW9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY1NDE4OCwiZXhwIjoyMDkxMjMwMTg4fQ.rZgp-5fhb6x_RIBIa9AXus3nsbaXb6Iz_4vpWsmryoQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. Fetch all categories
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, sort_order")
    .order("name");
  if (catErr) throw catErr;

  // 2. Fetch product counts per category
  const { data: pcRows, error: pcErr } = await supabase
    .from("product_categories")
    .select("category_id");
  if (pcErr) throw pcErr;

  const productCount = {};
  for (const row of pcRows) {
    productCount[row.category_id] = (productCount[row.category_id] || 0) + 1;
  }

  // 3. Build child-count map (how many categories use this as parent)
  const childCount = {};
  for (const c of cats) {
    if (c.parent_id) {
      childCount[c.parent_id] = (childCount[c.parent_id] || 0) + 1;
    }
  }

  // 4. Group by name
  const groups = {};
  for (const c of cats) {
    if (!groups[c.name]) groups[c.name] = [];
    groups[c.name].push(c);
  }

  let totalMerged = 0;
  let totalDeleted = 0;

  for (const [name, entries] of Object.entries(groups)) {
    if (entries.length <= 1) continue;

    // Pick keeper: prefer one with children > products > has parent > clean slug
    entries.sort((a, b) => {
      const aChildren = childCount[a.id] || 0;
      const bChildren = childCount[b.id] || 0;
      if (aChildren !== bChildren) return bChildren - aChildren; // more children first

      const aProducts = productCount[a.id] || 0;
      const bProducts = productCount[b.id] || 0;
      if (aProducts !== bProducts) return bProducts - aProducts; // more products first

      // Prefer subcategory (has parent_id) over top-level duplicate
      const aHasParent = a.parent_id ? 1 : 0;
      const bHasParent = b.parent_id ? 1 : 0;
      if (aHasParent !== bHasParent) return bHasParent - aHasParent;

      // Prefer clean slug (no -2/-3 suffix)
      const aSuffix = /-\d+$/.test(a.slug) ? 1 : 0;
      const bSuffix = /-\d+$/.test(b.slug) ? 1 : 0;
      return aSuffix - bSuffix;
    });

    const keeper = entries[0];
    const dupes = entries.slice(1);

    console.log(`\n── ${name} ──`);
    console.log(`  KEEP: ${keeper.slug} (id: ${keeper.id.slice(0,8)}, products: ${productCount[keeper.id]||0}, children: ${childCount[keeper.id]||0}, parent: ${keeper.parent_id ? keeper.parent_id.slice(0,8) : 'null'})`);
    for (const d of dupes) {
      console.log(`  DELETE: ${d.slug} (id: ${d.id.slice(0,8)}, products: ${productCount[d.id]||0}, children: ${childCount[d.id]||0}, parent: ${d.parent_id ? d.parent_id.slice(0,8) : 'null'})`);
    }

    for (const dupe of dupes) {
      const dupeProducts = productCount[dupe.id] || 0;

      // 4a. Reassign products from dupe → keeper (avoid duplicates via upsert logic)
      if (dupeProducts > 0) {
        // Get product IDs assigned to dupe
        const { data: dupePC } = await supabase
          .from("product_categories")
          .select("product_id")
          .eq("category_id", dupe.id);

        // Get product IDs already on keeper
        const { data: keeperPC } = await supabase
          .from("product_categories")
          .select("product_id")
          .eq("category_id", keeper.id);

        const keeperProductIds = new Set((keeperPC || []).map(r => r.product_id));

        // Insert only the ones not already assigned to keeper
        const toInsert = (dupePC || [])
          .filter(r => !keeperProductIds.has(r.product_id))
          .map(r => ({ product_id: r.product_id, category_id: keeper.id }));

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from("product_categories")
            .insert(toInsert);
          if (insertErr) {
            console.error(`  ERROR inserting products: ${insertErr.message}`);
            continue;
          }
          console.log(`  Moved ${toInsert.length} product(s) to keeper`);
          totalMerged += toInsert.length;
        }

        // Delete old product_categories for dupe
        const { error: delPcErr } = await supabase
          .from("product_categories")
          .delete()
          .eq("category_id", dupe.id);
        if (delPcErr) {
          console.error(`  ERROR deleting product_categories: ${delPcErr.message}`);
          continue;
        }
      }

      // 4b. Re-parent children of dupe → keeper
      const dupeChildren = childCount[dupe.id] || 0;
      if (dupeChildren > 0) {
        const { error: rpErr } = await supabase
          .from("categories")
          .update({ parent_id: keeper.id })
          .eq("parent_id", dupe.id);
        if (rpErr) {
          console.error(`  ERROR re-parenting: ${rpErr.message}`);
          continue;
        }
        console.log(`  Re-parented ${dupeChildren} child category(ies)`);
      }

      // 4c. Delete the duplicate category
      const { error: delErr } = await supabase
        .from("categories")
        .delete()
        .eq("id", dupe.id);
      if (delErr) {
        console.error(`  ERROR deleting: ${delErr.message}`);
        continue;
      }
      console.log(`  Deleted ${dupe.slug}`);
      totalDeleted++;
    }

    // 5. Clean up keeper slug (remove -2/-3 suffix)
    const cleanSlug = keeper.slug.replace(/-\d+$/, "");
    if (cleanSlug !== keeper.slug) {
      // Check if clean slug is now free (the dupe with that slug was deleted)
      const { data: conflict } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", keeper.id)
        .limit(1);

      if (!conflict || conflict.length === 0) {
        const { error: slugErr } = await supabase
          .from("categories")
          .update({ slug: cleanSlug })
          .eq("id", keeper.id);
        if (slugErr) {
          console.error(`  ERROR updating slug: ${slugErr.message}`);
        } else {
          console.log(`  Renamed slug: ${keeper.slug} → ${cleanSlug}`);
        }
      }
    }
  }

  console.log(`\n✅ Done. Merged ${totalMerged} product assignments, deleted ${totalDeleted} duplicate categories.`);

  // Final count
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });
  console.log(`Categories remaining: ${count}`);
}

main().catch(console.error);
