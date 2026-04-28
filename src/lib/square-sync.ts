// Square → Supabase catalog sync.
// Shared by:
//   • POST /api/webhooks/square        — event-driven (real-time)
//   • POST /api/admin/square-resync    — full reconciliation (manual + cron)
//   • POST /api/admin/products/[id]/resync — one-product manual resync
//
// Source-of-truth direction: Square is authoritative for products, variations,
// inventory, categories, and images. The admin UI is read-mostly for these.

import { createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";

// ── Helpers ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 120);
}

function stripHtml(html: string): string {
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

function bigintToDollars(amount: bigint | number | null | undefined): number {
  if (amount == null) return 0;
  return Number(amount) / 100;
}

type SyncCatalogItemOptions = {
  itemObject?: any;
  relatedObjects?: any[];
  syncInventory?: boolean;
  categoryIdMap?: Map<string, string>;
  retrieveMissingImages?: boolean;
};

// ── Categories ───────────────────────────────────────────────

async function upsertCategoryObjectFromSquare(
  obj: any,
  categoryObjects?: Map<string, any>,
  categoryIdMap?: Map<string, string>
): Promise<string | null> {
  if (!obj || obj.type !== "CATEGORY" || !obj.categoryData) return null;
  if (categoryIdMap?.has(obj.id)) return categoryIdMap.get(obj.id) || null;

  const supabase = createServiceClient();
  const name = obj.categoryData.name || "Uncategorised";
  const slug = slugify(name) || obj.id.toLowerCase();
  const parentSquareId =
    obj.categoryData.parentCategory?.id ||
    obj.categoryData.pathToRoot?.[0]?.categoryId ||
    null;
  const parentObject = parentSquareId ? categoryObjects?.get(parentSquareId) : null;
  const parentId =
    parentSquareId && parentSquareId !== obj.id
      ? parentObject
        ? await upsertCategoryObjectFromSquare(parentObject, categoryObjects, categoryIdMap)
        : await upsertCategoryFromSquare(parentSquareId, categoryIdMap)
      : null;
  const sortOrder = Number(obj.categoryData.parentCategory?.ordinal ?? 0);

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("square_id", obj.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("categories")
      .update({
        name,
        parent_id: parentId,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    categoryIdMap?.set(obj.id, existing.id);
    return existing.id;
  }

  let finalSlug = slug;
  const { data: slugCheck } = await supabase
    .from("categories")
    .select("slug")
    .ilike("slug", `${slug}%`);
  const taken = new Set((slugCheck || []).map((r: any) => r.slug));
  let counter = 2;
  while (taken.has(finalSlug)) {
    finalSlug = `${slug}-${counter++}`;
  }

  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      name,
      slug: finalSlug,
      square_id: obj.id,
      parent_id: parentId,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error(`[square-sync] Category upsert failed for ${obj.id}:`, error?.message);
    return null;
  }
  categoryIdMap?.set(obj.id, created.id);
  return created.id;
}

export async function upsertCategoryFromSquare(
  squareCategoryId: string,
  categoryIdMap?: Map<string, string>
): Promise<string | null> {
  if (categoryIdMap?.has(squareCategoryId)) {
    return categoryIdMap.get(squareCategoryId) || null;
  }
  const square = getSquareClient();
  const supabase = createServiceClient();

  try {
    const { result } = await square.catalogApi.retrieveCatalogObject(
      squareCategoryId,
      false,
      undefined,
      true
    );
    const obj = result.object;
    if (!obj || obj.type !== "CATEGORY" || !obj.categoryData) return null;

    const name = obj.categoryData.name || "Uncategorised";
    const slug = slugify(name) || squareCategoryId.toLowerCase();
    const parentSquareId =
      obj.categoryData.parentCategory?.id ||
      obj.categoryData.pathToRoot?.[0]?.categoryId ||
      null;
    const parentId =
      parentSquareId && parentSquareId !== squareCategoryId
        ? await upsertCategoryFromSquare(parentSquareId, categoryIdMap)
        : null;
    const sortOrder = Number(obj.categoryData.parentCategory?.ordinal ?? 0);

    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("square_id", squareCategoryId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("categories")
        .update({
          name,
          parent_id: parentId,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      categoryIdMap?.set(squareCategoryId, existing.id);
      return existing.id;
    }

    let finalSlug = slug;
    const { data: slugCheck } = await supabase
      .from("categories")
      .select("slug")
      .ilike("slug", `${slug}%`);
    const taken = new Set((slugCheck || []).map((r: any) => r.slug));
    let counter = 2;
    while (taken.has(finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }

    const { data: created, error } = await supabase
      .from("categories")
      .insert({
        name,
        slug: finalSlug,
        square_id: squareCategoryId,
        parent_id: parentId,
        sort_order: sortOrder,
      })
      .select("id")
      .single();

    if (error || !created) {
      console.error(`[square-sync] Category upsert failed for ${squareCategoryId}:`, error?.message);
      return null;
    }
    categoryIdMap?.set(squareCategoryId, created.id);
    return created.id;
  } catch (err) {
    console.error(`[square-sync] Category retrieve failed for ${squareCategoryId}:`, err);
    return null;
  }
}

async function syncProductCategories(
  productId: string,
  squareCategoryIds: string[],
  categoryIdMap?: Map<string, string>
) {
  const supabase = createServiceClient();
  const dbCategoryIds: string[] = [];
  for (const sqCatId of squareCategoryIds) {
    const dbId = categoryIdMap?.get(sqCatId) || await upsertCategoryFromSquare(sqCatId, categoryIdMap);
    if (dbId) dbCategoryIds.push(dbId);
  }

  await supabase.from("product_categories").delete().eq("product_id", productId);
  if (dbCategoryIds.length > 0) {
    const rows = dbCategoryIds.map((category_id) => ({ product_id: productId, category_id }));
    await supabase.from("product_categories").insert(rows);
  }
}

// ── Images ───────────────────────────────────────────────────

/**
 * Replace product_images for a product with the current Square image set.
 * Square is authoritative — any local rows not in the new set get dropped.
 */
async function syncProductImages(
  productId: string,
  itemData: any,
  relatedObjects: any[],
  productName: string,
  retrieveMissingImages = true
): Promise<string | null> {
  const supabase = createServiceClient();
  const square = retrieveMissingImages ? getSquareClient() : null;
  const imageIds: string[] = Array.from(
    new Set(
      [
        ...(itemData.imageIds || []),
        ...((itemData.variations || []).flatMap(
          (variation: any) => variation.itemVariationData?.imageIds || []
        ) as string[]),
      ].filter(Boolean)
    )
  );
  if (imageIds.length === 0) {
    // No images on this Square item; leave local images alone unless none
    // exist yet. (We don't want to nuke manual uploads if Square has nothing.)
    return null;
  }

  type ResolvedImage = { url: string; squareId: string; sortOrder: number };
  const resolved: ResolvedImage[] = [];

  for (let i = 0; i < imageIds.length; i++) {
    const id = imageIds[i];
    const imageObj = relatedObjects.find(
      (obj: any) => obj.id === id && obj.type === "IMAGE"
    );
    let url = imageObj?.imageData?.url;
    if (!url && square) {
      try {
        const { result } = await square.catalogApi.retrieveCatalogObject(id, false);
        url = result.object?.type === "IMAGE" ? result.object.imageData?.url : null;
      } catch (err: any) {
        console.error(`[square-sync] image retrieve failed for ${id}:`, err?.message || err);
      }
    }
    if (url) resolved.push({ url, squareId: id, sortOrder: i });
  }

  if (resolved.length === 0) return null;

  // Replace strategy: delete-then-insert. Acceptable since Square is authoritative.
  await supabase.from("product_images").delete().eq("product_id", productId);

  const rows = resolved.map((r) => ({
    product_id: productId,
    url: r.url,
    alt_text: productName,
    sort_order: r.sortOrder,
    is_primary: r.sortOrder === 0,
  }));

  const { error } = await supabase.from("product_images").insert(rows);
  if (error) {
    console.error(`[square-sync] product_images insert failed for ${productId}:`, error.message);
    // Non-fatal — primary_image_url on the product is still set separately.
  }

  return resolved[0]?.url ?? null;
}

// ── Items ────────────────────────────────────────────────────

/**
 * Given a Square catalog object id (ITEM, ITEM_VARIATION, or CATEGORY),
 * sync the relevant data into Supabase. Webhook-driven and reconciliation
 * both call this.
 */
export async function syncCatalogItem(
  itemId: string,
  options: SyncCatalogItemOptions = {}
): Promise<{ ok: boolean; reason?: string }> {
  const square = getSquareClient();
  const supabase = createServiceClient();

  let item: any = options.itemObject;
  let relatedObjects: any[] = options.relatedObjects || [];
  if (!item) {
    try {
      const { result } = await square.catalogApi.retrieveCatalogObject(itemId, true);
      item = result.object;
      relatedObjects = result.relatedObjects || [];
    } catch (err: any) {
      console.error(`[square-sync] retrieveCatalogObject failed for ${itemId}:`, err?.message || err);
      return { ok: false, reason: err?.message || "retrieve failed" };
    }
  }

  if (!item) return { ok: false, reason: "no object" };

  if (item.type === "CATEGORY") {
    await upsertCategoryObjectFromSquare(item, undefined, options.categoryIdMap);
    return { ok: true };
  }

  if (item.type === "ITEM_VARIATION") {
    const parentItemId = item.itemVariationData?.itemId;
    if (!parentItemId) return { ok: false, reason: "variation missing parent" };
    const parent = await square.catalogApi.retrieveCatalogObject(parentItemId, true);
    item = parent.result.object;
    relatedObjects = parent.result.relatedObjects || [];
  }

  if (!item || item.type !== "ITEM" || !item.itemData) {
    return { ok: false, reason: "not a syncable ITEM" };
  }

  if (item.isDeleted) {
    await archiveCatalogItem(item.id);
    return { ok: true, reason: "archived" };
  }

  const itemData = item.itemData;
  const name = itemData.name || "Unnamed Product";
  const description = itemData.descriptionHtml || itemData.description || "";
  const squareToken = item.id;

  // Existing product?
  const { data: existing } = await supabase
    .from("products")
    .select("id, slug, primary_image_url")
    .eq("square_token", squareToken)
    .maybeSingle();

  const baseSlug = slugify(name);
  let slug = baseSlug;

  if (!existing) {
    const { data: slugCheck } = await supabase
      .from("products")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);
    const taken = new Set((slugCheck || []).map((r: any) => r.slug));
    let counter = 2;
    while (taken.has(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
  } else {
    slug = existing.slug;
  }

  // Compute primary image URL up-front for the products row. We'll also
  // populate product_images below.
  const primaryImageId =
    itemData.imageIds?.[0] ||
    itemData.variations?.find((variation: any) => variation.itemVariationData?.imageIds?.[0])
      ?.itemVariationData?.imageIds?.[0];
  const primaryImageFromRelated = primaryImageId
    ? relatedObjects.find((obj: any) => obj.id === primaryImageId && obj.type === "IMAGE")?.imageData?.url ||
      null
    : null;

  const productPayload = {
    name,
    slug,
    description,
    description_plain: stripHtml(description),
    primary_image_url: primaryImageFromRelated || existing?.primary_image_url || null,
    square_token: squareToken,
    status: "active" as const,
    updated_at: new Date().toISOString(),
  };

  const { data: product, error: productError } = await supabase
    .from("products")
    .upsert(productPayload, { onConflict: "square_token" })
    .select("id")
    .single();

  if (productError || !product) {
    console.error(`[square-sync] product upsert failed for "${name}":`, productError?.message);
    return { ok: false, reason: productError?.message || "upsert failed" };
  }

  const productId = product.id;
  const variations = itemData.variations || [];
  let lowestPrice: number | null = null;

  for (const variation of variations) {
    if (!variation.itemVariationData) continue;
    const vd = variation.itemVariationData;
    const price = bigintToDollars(vd.priceMoney?.amount);
    const variationPayload = {
      product_id: productId,
      name: vd.name || "Regular",
      sku: vd.sku || null,
      price,
      square_token: variation.id,
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedVar, error: varError } = await supabase
      .from("product_variations")
      .upsert(variationPayload, { onConflict: "square_token" })
      .select("id")
      .single();

    if (varError || !upsertedVar) {
      console.error(`[square-sync] variation upsert failed:`, varError?.message);
      continue;
    }

    if (lowestPrice === null || price < lowestPrice) {
      lowestPrice = price;
    }
    if (options.syncInventory !== false) {
      // Inventory - best-effort.
      try {
        const { result: invResult } = await square.inventoryApi.retrieveInventoryCount(variation.id);
      const count = invResult.counts?.[0];
      if (count) {
        const qty = parseInt(count.quantity || "0", 10);
        await supabase
          .from("inventory")
          .upsert({ variation_id: upsertedVar.id, quantity: qty }, { onConflict: "variation_id" });
      }
      } catch {
        // Non-critical
      }
    }
  }

  if (lowestPrice !== null) {
    await supabase
      .from("products")
      .update({ base_price: lowestPrice })
      .eq("id", productId);
  }

  // Images
  const syncedPrimaryImageUrl = await syncProductImages(
    productId,
    itemData,
    relatedObjects,
    name,
    options.retrieveMissingImages !== false
  );
  if (syncedPrimaryImageUrl && syncedPrimaryImageUrl !== productPayload.primary_image_url) {
    await supabase
      .from("products")
      .update({ primary_image_url: syncedPrimaryImageUrl })
      .eq("id", productId);
  }

  // Categories
  const squareCategoryIds = Array.from(
    new Set(
      [
        ...(itemData.categoryId ? [itemData.categoryId] : []),
        ...((itemData.categories || []).map((c: any) => c?.id).filter(Boolean) as string[]),
      ]
    )
  );
  if (squareCategoryIds.length > 0) {
    await syncProductCategories(productId, squareCategoryIds, options.categoryIdMap).catch((err) =>
      console.error(`[square-sync] category sync failed for "${name}":`, err)
    );
  }

  return { ok: true };
}

export async function syncInventoryForVariation(squareVariationToken: string, quantity: number) {
  const supabase = createServiceClient();
  const { data: variation } = await supabase
    .from("product_variations")
    .select("id")
    .eq("square_token", squareVariationToken)
    .maybeSingle();
  if (!variation) return;
  await supabase
    .from("inventory")
    .upsert({ variation_id: variation.id, quantity }, { onConflict: "variation_id" });
}

export async function archiveCatalogItem(squareToken: string) {
  const supabase = createServiceClient();
  await supabase
    .from("products")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("square_token", squareToken);
}

// ── Full catalog reconciliation ──────────────────────────────

/**
 * Walks the Square catalog and reconciles BOTH categories AND items into
 * Supabase. Used by:
 *   • The manual "Resync from Square" button on the admin dashboard
 *   • Vercel Cron, scheduled in vercel.json
 *   • POST /api/admin/square-resync (admin-triggered)
 *
 * Order matters: categories first, items second. That way when an item
 * references a category by ID, the category row already exists locally.
 *
 * Returns counts so the caller can surface them.
 */
export async function reconcileFullCatalog(): Promise<{
  scanned: number;
  synced: number;
  failed: number;
  categoriesSynced: number;
  failures: { id: string; reason: string }[];
}> {
  const square = getSquareClient();
  let scanned = 0;
  let synced = 0;
  let failed = 0;
  let categoriesSynced = 0;
  const failures: { id: string; reason: string }[] = [];

  // ── Walk CATEGORY first so item links land on existing category rows ──
  {
    let cursor: string | undefined;
    do {
      const { result } = await square.catalogApi.listCatalog(cursor, "CATEGORY");
      const objects = result.objects || [];
      cursor = result.cursor;

      for (const obj of objects) {
        scanned++;
        if (obj.type !== "CATEGORY") continue;
        const dbId = await upsertCategoryFromSquare(obj.id).catch((err) => {
          failures.push({ id: obj.id, reason: err?.message || "category sync exception" });
          return null;
        });
        if (dbId) {
          categoriesSynced++;
          synced++;
        } else {
          failed++;
        }
      }
    } while (cursor);
  }

  // ── Walk ITEM ──
  {
    let cursor: string | undefined;
    do {
      const { result } = await square.catalogApi.listCatalog(cursor, "ITEM");
      const items = result.objects || [];
      cursor = result.cursor;

      for (const item of items) {
        scanned++;
        const res = await syncCatalogItem(item.id).catch((err) => ({
          ok: false as const,
          reason: err?.message || "exception",
        }));
        if (res.ok) {
          synced++;
        } else {
          failed++;
          if (failures.length < 20) {
            failures.push({ id: item.id, reason: res.reason || "unknown" });
          }
        }
      }
    } while (cursor);
  }

  return { scanned, synced, failed, categoriesSynced, failures };
}

export async function reconcileCatalogForAdminResync(): Promise<{
  scanned: number;
  synced: number;
  failed: number;
  categoriesSynced: number;
  failures: { id: string; reason: string }[];
}> {
  const square = getSquareClient();
  let scanned = 0;
  let synced = 0;
  let failed = 0;
  let categoriesSynced = 0;
  const failures: { id: string; reason: string }[] = [];
  const categoryIdMap = new Map<string, string>();

  {
    let cursor: string | undefined;
    const categoryObjects = new Map<string, any>();
    do {
      const { result } = await square.catalogApi.searchCatalogObjects({
        cursor,
        objectTypes: ["CATEGORY"],
        includeCategoryPathToRoot: true,
        limit: 1000,
      });
      cursor = result.cursor;
      for (const obj of result.objects || []) {
        if (obj.type === "CATEGORY") categoryObjects.set(obj.id, obj);
      }
    } while (cursor);

    for (const obj of Array.from(categoryObjects.values())) {
      scanned++;
      const dbId = await upsertCategoryObjectFromSquare(obj, categoryObjects, categoryIdMap).catch((err) => {
        failures.push({ id: obj.id, reason: err?.message || "category sync exception" });
        return null;
      });
      if (dbId) {
        categoriesSynced++;
        synced++;
      } else {
        failed++;
      }
    }
  }

  {
    let cursor: string | undefined;
    do {
      const { result } = await square.catalogApi.searchCatalogObjects({
        cursor,
        objectTypes: ["ITEM"],
        includeRelatedObjects: true,
        limit: 1000,
      });
      cursor = result.cursor;
      const relatedObjects = result.relatedObjects || [];

      for (const item of result.objects || []) {
        scanned++;
        const res = await syncCatalogItem(item.id, {
          itemObject: item,
          relatedObjects,
          syncInventory: false,
          categoryIdMap,
          retrieveMissingImages: false,
        }).catch((err) => ({
          ok: false as const,
          reason: err?.message || "exception",
        }));
        if (res.ok) {
          synced++;
        } else {
          failed++;
          if (failures.length < 20) {
            failures.push({ id: item.id, reason: res.reason || "unknown" });
          }
        }
      }
    } while (cursor);
  }

  return { scanned, synced, failed, categoriesSynced, failures };
}

