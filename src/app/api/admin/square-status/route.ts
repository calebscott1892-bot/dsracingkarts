import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";

/**
 * Diagnostic endpoint backing the Sync Health card on the admin dashboard.
 *
 * Returns a snapshot of:
 *   • Whether key env vars are present
 *   • Whether Square accepts the access token (via locations.retrieve)
 *   • Last heartbeat from the webhook + last full resync (sync_status table)
 *   • Local product / variation counts
 *
 * Designed to be safe to expose to admins only — surfaces names/IDs but no secrets.
 */

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!admin || !["admin", "super_admin"].includes(admin.role)) return null;
  return supabase;
}

export async function GET() {
  const supabase = await verifyAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = {
    accessTokenPresent: Boolean(process.env.SQUARE_ACCESS_TOKEN),
    locationIdPresent: Boolean(process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID),
    webhookSecretPresent: Boolean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY),
    serviceRolePresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
    environment: process.env.SQUARE_ENVIRONMENT || "sandbox",
  };

  // ── Square API connectivity ──
  let square: { ok: boolean; locationName?: string | null; error?: string } = { ok: false };
  if (env.accessTokenPresent && env.locationIdPresent) {
    try {
      const client = getSquareClient();
      const { result } = await client.locationsApi.retrieveLocation(
        process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
      );
      square = {
        ok: true,
        locationName: result.location?.name ?? null,
      };
    } catch (err: any) {
      // The Square SDK puts the actual error under .body / .errors.
      let body = err?.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = undefined; }
      }
      const detail = body?.errors
        ?.map((e: { detail?: string; code?: string }) => e.detail || e.code)
        .filter(Boolean)
        .join(" | ");
      square = {
        ok: false,
        error: detail || err?.message || "Square API error",
      };
    }
  } else {
    square = { ok: false, error: "Missing SQUARE_ACCESS_TOKEN or NEXT_PUBLIC_SQUARE_LOCATION_ID" };
  }

  // ── Local DB stats + heartbeats (best-effort) ──
  let products = 0;
  let activeProducts = 0;
  let variations = 0;
  let lastWebhookAt: string | null = null;
  let lastWebhookType: string | null = null;
  let lastResyncAt: string | null = null;
  let lastResyncSummary: string | null = null;

  const writeClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient()
    : supabase;

  try {
    const [
      { count: productsCount },
      { count: activeCount },
      { count: variationsCount },
      { data: heartbeats },
    ] = await Promise.all([
      writeClient.from("products").select("id", { count: "exact", head: true }),
      writeClient.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      writeClient.from("product_variations").select("id", { count: "exact", head: true }),
      writeClient.from("sync_status").select("key, last_event_at, last_event_type"),
    ]);

    products = productsCount ?? 0;
    activeProducts = activeCount ?? 0;
    variations = variationsCount ?? 0;

    const webhookRow = (heartbeats || []).find((r: any) => r.key === "square_webhook");
    if (webhookRow) {
      lastWebhookAt = webhookRow.last_event_at ?? null;
      lastWebhookType = webhookRow.last_event_type ?? null;
    }
    const resyncRow = (heartbeats || []).find((r: any) => r.key === "square_full_resync");
    if (resyncRow) {
      lastResyncAt = resyncRow.last_event_at ?? null;
      lastResyncSummary = resyncRow.last_event_type ?? null;
    }
  } catch {
    // sync_status table may not exist yet; counts may also fail. Surface
    // partials and let the UI render what it can.
  }

  return NextResponse.json({
    env,
    square,
    db: {
      products,
      activeProducts,
      variations,
      lastWebhookAt,
      lastWebhookType,
      lastResyncAt,
      lastResyncSummary,
    },
  });
}
