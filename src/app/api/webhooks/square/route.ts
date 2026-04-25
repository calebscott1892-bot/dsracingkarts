import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import {
  syncCatalogItem,
  syncInventoryForVariation,
  archiveCatalogItem,
} from "@/lib/square-sync";

const WEBHOOK_SECRET = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";
// Must match the Notification URL registered in the Square Developer portal exactly.
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://dsracingkarts.com.au"}/api/webhooks/square`;

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(WEBHOOK_URL + body);
  const expected = hmac.digest("base64");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Records the latest received webhook event so the admin Sync Health card
 * can show "Last sync: 3 minutes ago" instead of "no clue if it's working".
 * Best-effort — never throws.
 */
async function recordHeartbeat(eventType: string) {
  try {
    const supabase = createServiceClient();
    await supabase
      .from("sync_status")
      .upsert(
        {
          key: "square_webhook",
          last_event_at: new Date().toISOString(),
          last_event_type: eventType,
        },
        { onConflict: "key" }
      );
  } catch {
    // sync_status table may not exist yet — non-fatal.
  }
}

// ── Webhook handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";

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

    void recordHeartbeat(eventType);

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
      const objectIds: string[] =
        event.data?.object?.catalog_version?.changes?.map((c: any) => c.id) ?? [];

      for (const id of objectIds) {
        await syncCatalogItem(id).catch((err) =>
          console.error(`[catalog-sync] error syncing ${id}:`, err)
        );
      }
    }

    // ── Catalog item deleted ──
    if (eventType === "catalog.version.deleted") {
      const deletedIds: string[] = event.data?.object?.deleted_object_ids ?? [];
      for (const id of deletedIds) {
        await archiveCatalogItem(id).catch((err) =>
          console.error(`[catalog-sync] error archiving ${id}:`, err)
        );
      }
    }

    // ── Inventory changed ──
    if (eventType === "inventory.count.updated") {
      const counts: any[] = event.data?.object?.inventory_counts ?? [];
      for (const c of counts) {
        const variationToken: string | undefined = c?.catalog_object_id;
        const qty = parseInt(c?.quantity ?? "0", 10);
        if (!variationToken || Number.isNaN(qty)) continue;
        await syncInventoryForVariation(variationToken, qty).catch((err) =>
          console.error(`[inventory-sync] error syncing ${variationToken}:`, err)
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Square webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// ── Health probe ─────────────────────────────────────────────
// GET /api/webhooks/square — returns whether the webhook is correctly wired.
// Safe to expose because it doesn't reveal secrets, just yes/no flags.
export async function GET() {
  return NextResponse.json({
    configured: Boolean(WEBHOOK_SECRET),
    url: WEBHOOK_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
    accessTokenPresent: Boolean(process.env.SQUARE_ACCESS_TOKEN),
    locationIdPresent: Boolean(process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID),
    environment: process.env.SQUARE_ENVIRONMENT || "sandbox",
  });
}
