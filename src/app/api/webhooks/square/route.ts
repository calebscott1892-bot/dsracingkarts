import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";
import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_SECRET = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";
// This must exactly match the Notification URL registered in the Square Developer portal.
// In Vercel, set NEXT_PUBLIC_SITE_URL=https://dsracingkarts.com.au (no trailing slash).
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://dsracingkarts.com.au"}/api/webhooks/square`;

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  // Square requires: HMAC-SHA256(sigKey, notificationUrl + body)
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(WEBHOOK_URL + body);
  const expected = hmac.digest("base64");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

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

// ── Catalog sync ─────────────────────────────────────────────

/**
 * Syncs a single Square catalog item (product) into Supabase.
 * Creates the product if it doesn't exist, updates it if it does.
 * Upserts all variations and their inventory.
 */
async function syncCatalogItem(itemId: string) {
  const square = getSquareClient();
  const supabase = createServiceClient();

  // Fetch the full item from Square
  const { result } = await square.catalogApi.retrieveCatalogObject(itemId, true);
  const item = result.object;
  if (!item || item.type !== "ITEM" || !item.itemData) return;

  const itemData = item.itemData;
  const name = itemData.name || "Unnamed Product";
  const description = itemData.descriptionHtml || itemData.description || "";
  const squareToken = item.id;

  // Check existing product
  const { data: existing } = await supabase
    .from("products")
    .select("id, slug")
    .eq("square_token", squareToken)
    .maybeSingle();

  const baseSlug = slugify(name);
  let slug = baseSlug;

  if (!existing) {
    // Make slug unique
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

  // Upsert product
  const productPayload = {
    name,
    slug,
    description,
    description_plain: stripHtml(description),
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
    console.error(`[catalog-sync] Failed to upsert product "${name}":`, productError?.message);
    return;
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
      console.error(`[catalog-sync] Failed to upsert variation:`, varError?.message);
      continue;
    }

    if (lowestPrice === null || price < lowestPrice) {
      lowestPrice = price;
    }

    // Sync inventory count from Square if available
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
      // Inventory count fetch is non-critical — skip silently
    }
  }

  // Update denormalised base_price
  if (lowestPrice !== null) {
    await supabase
      .from("products")
      .update({ base_price: lowestPrice })
      .eq("id", productId);
  }

  console.log(`[catalog-sync] Synced: "${name}" (${variations.length} variation(s))`);
}

/**
 * Marks a product as archived in Supabase when deleted in Square.
 */
async function archiveCatalogItem(squareToken: string) {
  const supabase = createServiceClient();
  await supabase
    .from("products")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("square_token", squareToken);
  console.log(`[catalog-sync] Archived product with Square token: ${squareToken}`);
}

// ── Webhook handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";

  // Fail closed: if the webhook secret is not configured, reject all requests
  if (!WEBHOOK_SECRET) {
    console.error("Square webhook: SQUARE_WEBHOOK_SIGNATURE_KEY is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!verifySignature(rawBody, signature)) {
    console.error("Square webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType: string = event.type;

    // ── Payment status sync ──
    if (eventType === "payment.updated") {
      const payment = event.data?.object?.payment;
      if (!payment?.id) return NextResponse.json({ received: true });

      const supabase = createServiceClient();
      const squareStatus: string = payment.status;

      let orderStatus: string | undefined;
      if (squareStatus === "COMPLETED") orderStatus = "paid";
      else if (squareStatus === "FAILED") orderStatus = "pending";
      else if (squareStatus === "CANCELLED") orderStatus = "cancelled";

      if (orderStatus) {
        await supabase
          .from("orders")
          .update({ status: orderStatus })
          .eq("square_payment_id", payment.id);
      }
    }

    // ── Catalog item created or updated ──
    if (
      eventType === "catalog.version.updated" ||
      eventType === "catalog.version.created"
    ) {
      // Square sends affected object IDs in the event
      const objectIds: string[] = event.data?.object?.catalog_version?.changes?.map(
        (c: any) => c.id
      ) ?? [];

      for (const id of objectIds) {
        await syncCatalogItem(id).catch((err) =>
          console.error(`[catalog-sync] Error syncing ${id}:`, err)
        );
      }
    }

    // ── Catalog item deleted ──
    if (eventType === "catalog.version.deleted") {
      const deletedIds: string[] = event.data?.object?.deleted_object_ids ?? [];
      const supabase = createServiceClient();
      for (const id of deletedIds) {
        await archiveCatalogItem(id).catch((err) =>
          console.error(`[catalog-sync] Error archiving ${id}:`, err)
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Square webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
