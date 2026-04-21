import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";
import { randomUUID } from "crypto";

function roundToFiveCents(cents: number): number {
  return Math.round(cents / 5) * 5;
}

// ── Shared: fetch all products+variations from Supabase ──────
async function fetchVariationsFromSupabase() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, status,
       product_variations ( id, name, price, square_token )`
    )
    .eq("status", "active")
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── GET: preview price changes ───────────────────────────────
export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const percentage = parseFloat(searchParams.get("percentage") ?? "0");

  if (!percentage || percentage <= 0 || percentage > 100) {
    return NextResponse.json({ error: "Invalid percentage" }, { status: 400 });
  }

  const multiplier = 1 + percentage / 100;

  try {
    const products = await fetchVariationsFromSupabase();

    const preview = products
      .filter((p: any) => (p.product_variations?.length ?? 0) > 0)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        variations: (p.product_variations ?? []).map((v: any) => {
          const currentPrice = Number(v.price ?? 0);
          const newPriceCents = roundToFiveCents(Math.round(currentPrice * multiplier * 100));
          const newPrice = newPriceCents / 100;
          return {
            id: v.id,
            name: v.name,
            squareToken: v.square_token,
            currentPrice,
            newPrice,
            diff: +(newPrice - currentPrice).toFixed(2),
          };
        }),
      }));

    return NextResponse.json({ preview, percentage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: apply price changes to Square ──────────────────────
export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const percentage = parseFloat(body.percentage ?? "0");

  if (!percentage || percentage <= 0 || percentage > 100) {
    return NextResponse.json({ error: "Invalid percentage" }, { status: 400 });
  }

  const multiplier = 1 + percentage / 100;

  try {
    const square = getSquareClient();

    // Fetch all ITEM_VARIATION objects from Square (paginated)
    const allVariations: any[] = [];
    let cursor: string | undefined;
    do {
      const { result } = await square.catalogApi.listCatalog({ cursor, types: "ITEM_VARIATION" });
      if (result.objects) allVariations.push(...result.objects);
      cursor = result.cursor ?? undefined;
    } while (cursor);

    // Filter to only variations with a price, then calculate new price
    const toUpdate = allVariations
      .filter((v) => v.itemVariationData?.priceMoney?.amount != null)
      .map((v) => {
        const currentCents = Number(v.itemVariationData.priceMoney.amount);
        const newCents = roundToFiveCents(Math.round(currentCents * multiplier));
        return {
          ...v,
          itemVariationData: {
            ...v.itemVariationData,
            priceMoney: {
              amount: BigInt(newCents),
              currency: v.itemVariationData.priceMoney.currency ?? "AUD",
            },
          },
        };
      });

    if (toUpdate.length === 0) {
      return NextResponse.json({ message: "No priced variations found in Square" });
    }

    // Square batchUpsert allows up to 10,000 objects per batch
    const BATCH_SIZE = 1000;
    const batches = [];
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      batches.push({ objects: toUpdate.slice(i, i + BATCH_SIZE) });
    }

    await square.catalogApi.batchUpsertCatalogObjects({
      idempotencyKey: randomUUID(),
      batches,
    });

    return NextResponse.json({
      message: `Updated ${toUpdate.length} variation(s) in Square by ${percentage}%. Square will sync to the website automatically.`,
      updatedCount: toUpdate.length,
    });
  } catch (err: any) {
    console.error("[pricing] Square update error:", err);
    return NextResponse.json({ error: err.message ?? "Square API error" }, { status: 500 });
  }
}
