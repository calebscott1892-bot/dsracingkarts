import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";
import { randomUUID } from "crypto";

// ── Admin role verification (matches pattern used in all other admin routes) ──
async function verifyAdmin(): Promise<boolean> {
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
  return !!(admin && ["admin", "super_admin"].includes(admin.role));
}

// ── Round to nearest $0.05 (standard retail rounding) ────────
function roundToFiveCents(cents: number): number {
  return Math.round(cents / 5) * 5;
}

// ── Fetch all active, priced ITEM_VARIATION objects from Square (paginated) ──
// Square is the source of truth for prices — we always read from here, not Supabase.
async function fetchSquareVariations() {
  const square = getSquareClient();
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const { result } = await square.catalogApi.listCatalog(
        cursor,
        "ITEM_VARIATION"
      );
    for (const obj of result.objects ?? []) {
      // Skip deleted objects and any variation without a set price
      if (!obj.isDeleted && obj.itemVariationData?.priceMoney?.amount != null) {
        all.push(obj);
      }
    }
    cursor = result.cursor ?? undefined;
  } while (cursor);
  return all;
}

// ── GET: preview price changes ────────────────────────────────
// Reads prices directly from Square so the preview exactly matches what Apply will do.
// Uses Supabase only for human-readable product names.
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const percentage = parseFloat(searchParams.get("percentage") ?? "0");

  if (!percentage || percentage <= 0 || percentage > 500) {
    return NextResponse.json(
      { error: "Percentage must be between 0.1 and 500" },
      { status: 400 }
    );
  }

  const multiplier = 1 + percentage / 100;

  try {
    const variations = await fetchSquareVariations();

    // Look up product names from Supabase by square_token for readable labels
    const supabase = createServiceClient();
    const squareTokens = variations.map((v) => v.id);
    const { data: dbVariations } = await supabase
      .from("product_variations")
      .select("square_token, name, products ( name )")
      .in("square_token", squareTokens);

    const tokenToNames = new Map<string, { varName: string; productName: string }>();
    for (const dbv of dbVariations ?? []) {
      tokenToNames.set(dbv.square_token, {
        varName: dbv.name ?? "Regular",
        productName: (dbv.products as any)?.name ?? "Unknown Product",
      });
    }

    // Group variations by parent Square item ID for display
    const byItem = new Map<
      string,
      {
        squareItemId: string;
        productName: string;
        variations: Array<{
          squareId: string;
          name: string;
          currentPrice: number;
          newPrice: number;
          diff: number;
        }>;
      }
    >();

    for (const v of variations) {
      const itemId = v.itemVariationData?.itemId ?? v.id;
      const names = tokenToNames.get(v.id);
      const productName = names?.productName ?? v.itemVariationData?.name ?? "Unknown Product";
      const varName = names?.varName ?? v.itemVariationData?.name ?? "Regular";

      const currentCents = Number(v.itemVariationData.priceMoney.amount);
      const newCents = roundToFiveCents(Math.round(currentCents * multiplier));

      if (!byItem.has(itemId)) {
        byItem.set(itemId, { squareItemId: itemId, productName, variations: [] });
      }
      byItem.get(itemId)!.variations.push({
        squareId: v.id,
        name: varName,
        currentPrice: currentCents / 100,
        newPrice: newCents / 100,
        diff: +((newCents - currentCents) / 100).toFixed(2),
      });
    }

    const preview = Array.from(byItem.values())
      .filter((g) => g.variations.length > 0)
      .sort((a, b) => a.productName.localeCompare(b.productName));

    return NextResponse.json({ preview, percentage, totalVariations: variations.length });
  } catch (err: any) {
    console.error("[pricing] GET error:", err);
    const detail = err.errors?.[0]?.detail ?? err.message ?? "Preview failed";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

// ── POST: apply price changes to Square ──────────────────────
// Always re-fetches from Square — never trusts client-supplied prices for writes.
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const percentage = parseFloat(body.percentage ?? "0");

  if (!percentage || percentage <= 0 || percentage > 500) {
    return NextResponse.json(
      { error: "Percentage must be between 0.1 and 500" },
      { status: 400 }
    );
  }

  const multiplier = 1 + percentage / 100;

  try {
    const square = getSquareClient();
    const variations = await fetchSquareVariations();

    if (variations.length === 0) {
      return NextResponse.json({
        message: "No priced variations found in Square — nothing to update.",
        updatedCount: 0,
      });
    }

    // Spread the full Square object so the `version` field is included.
    // Square uses optimistic concurrency: if the catalog changed between our
    // listCatalog and this upsert, Square will reject with a version conflict
    // rather than silently overwriting newer data.
    const toUpdate = variations.map((v) => {
      const currentCents = Number(v.itemVariationData.priceMoney.amount);
      const newCents = roundToFiveCents(Math.round(currentCents * multiplier));
      // Guard: rounding can never produce zero or negative — minimum $0.01
      const safeCents = Math.max(newCents, 1);
      return {
        ...v,
        itemVariationData: {
          ...v.itemVariationData,
          priceMoney: {
            amount: BigInt(safeCents),
            currency: (v.itemVariationData.priceMoney.currency as string) ?? "AUD",
          },
        },
      };
    });

    // Square allows up to 10,000 objects per CatalogObjectBatch.
    // Using 1,000 per batch is conservative and well within limits.
    const BATCH_SIZE = 1000;
    const batches: { objects: typeof toUpdate }[] = [];
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      batches.push({ objects: toUpdate.slice(i, i + BATCH_SIZE) });
    }

    // Use a fresh UUID per request. The frontend disables the Apply button while
    // the request is in-flight, preventing accidental double-submit from the UI.
    await square.catalogApi.batchUpsertCatalogObjects({
      idempotencyKey: randomUUID(),
      batches,
    });

    return NextResponse.json({
      message: `${toUpdate.length} price${toUpdate.length !== 1 ? "s" : ""} updated in Square by ${percentage}%. The website will sync automatically within a few seconds.`,
      updatedCount: toUpdate.length,
    });
  } catch (err: any) {
    console.error("[pricing] POST error:", err);
    // Square SDK wraps API errors — extract the most actionable message
    const squareDetail = err.errors?.[0]?.detail ?? err.errors?.[0]?.code ?? null;
    const message = squareDetail ?? err.message ?? "Square API error — check server logs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
