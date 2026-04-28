import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reconcileCatalogChunk, reconcileCatalogForAdminResync } from "@/lib/square-sync";

export const maxDuration = 300; // up to 5 minutes for a full catalog walk

/**
 * Full Square → Supabase catalog reconciliation.
 *
 * Two ways this can be called:
 *  1. Authenticated admin clicks "Resync from Square" on the dashboard
 *  2. Vercel Cron hits this with a Bearer token matching CRON_SECRET (see vercel.json)
 *
 * Returns counts so the caller can surface them.
 */

async function isAuthorisedAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return Boolean(admin && ["admin", "super_admin"].includes(admin.role));
}

function isAuthorisedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

async function recordHeartbeat(result: { scanned: number; synced: number; failed: number }) {
  try {
    const supabase = createServiceClient();
    await supabase.from("sync_status").upsert(
      {
        key: "square_full_resync",
        last_event_at: new Date().toISOString(),
        last_event_type: `scanned=${result.scanned} synced=${result.synced} failed=${result.failed}`,
      },
      { onConflict: "key" }
    );
  } catch {
    // sync_status table may not exist; non-fatal.
  }
}

export async function POST(request: NextRequest) {
  const authorised = (await isAuthorisedAdmin()) || isAuthorisedCron(request);
  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SQUARE_ACCESS_TOKEN is not configured on the server." },
      { status: 500 }
    );
  }

  const startedAt = Date.now();
  try {
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    if (body?.chunked) {
      const chunk = await reconcileCatalogChunk({
        phase: body.phase === "items" ? "items" : "categories",
        cursor: body.cursor || null,
        limit: 40,
      });
      const totals = {
        scanned: (Number(body.totals?.scanned) || 0) + chunk.scanned,
        synced: (Number(body.totals?.synced) || 0) + chunk.synced,
        failed: (Number(body.totals?.failed) || 0) + chunk.failed,
        categoriesSynced: (Number(body.totals?.categoriesSynced) || 0) + chunk.categoriesSynced,
      };
      if (chunk.done) {
        void recordHeartbeat(totals);
      }
      return NextResponse.json({
        ok: true,
        durationMs: Date.now() - startedAt,
        ...chunk,
        totals,
      });
    }

    const result = await reconcileCatalogForAdminResync();
    void recordHeartbeat(result);
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...result,
    });
  } catch (err: any) {
    console.error("[square-resync] failed:", err);
    return NextResponse.json(
      {
        error: err?.message || "Reconciliation failed",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
