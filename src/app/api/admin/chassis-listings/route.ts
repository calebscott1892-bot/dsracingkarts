import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

const VALID_CONDITIONS = new Set(["new", "excellent", "good", "fair", "parts-only"]);
const CURRENT_YEAR = new Date().getFullYear();

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const };
}

// POST /api/admin/chassis-listings — admin creates a listing directly (auto-approved)
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const {
    listing_type,
    contact_name,
    contact_email,
    contact_phone,
    description,
    asking_price,
    chassis_year,
    condition,
  } = body;

  const trimmedName = String(contact_name || "").trim().slice(0, 120);
  const trimmedEmail = String(contact_email || "").trim().toLowerCase().slice(0, 320);
  const trimmedPhone = String(contact_phone || "").trim().slice(0, 40);
  const trimmedDescription = String(description || "").trim().slice(0, 2000);
  const normalizedCondition = condition ? String(condition).trim() : null;
  const parsedYear =
    chassis_year === undefined || chassis_year === null || chassis_year === ""
      ? null
      : Number.parseInt(String(chassis_year), 10);
  const parsedPrice =
    asking_price === undefined || asking_price === null || asking_price === ""
      ? null
      : Number.parseFloat(String(asking_price));

  if (!["buy", "sell"].includes(listing_type)) {
    return NextResponse.json({ error: "listing_type must be 'buy' or 'sell'" }, { status: 400 });
  }
  if (!trimmedName) {
    return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  }
  if (!trimmedDescription || trimmedDescription.length < 5) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > CURRENT_YEAR)) {
    return NextResponse.json({ error: `Chassis year must be between 2000 and ${CURRENT_YEAR}` }, { status: 400 });
  }
  if (normalizedCondition && !VALID_CONDITIONS.has(normalizedCondition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  }
  if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
    return NextResponse.json({ error: "Invalid asking price" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("chassis_listings")
    .insert({
      listing_type,
      contact_name: trimmedName,
      contact_email: trimmedEmail || "admin@dsracingkarts.com.au",
      contact_phone: trimmedPhone || null,
      description: trimmedDescription,
      asking_price: parsedPrice,
      chassis_year: parsedYear,
      condition: normalizedCondition,
      status: "approved", // admin listings are auto-approved
      admin_notes: "Created by admin",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
