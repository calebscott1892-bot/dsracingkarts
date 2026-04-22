import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_CONDITIONS = new Set(["new", "excellent", "good", "fair", "parts-only"]);
const CURRENT_YEAR = new Date().getFullYear();
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 2000;

// GET /api/chassis/listings — public, returns approved listings only
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chassis_listings")
    .select("id, listing_type, description, asking_price, chassis_year, condition, created_at")
    .in("status", ["approved"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/chassis/listings — public, submit a buy or sell inquiry
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    listing_type, contact_name, contact_email, contact_phone,
    description, asking_price, chassis_year, condition,
  } = body;

  const trimmedName = String(contact_name || "").trim().slice(0, MAX_NAME_LENGTH);
  const trimmedEmail = String(contact_email || "").trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
  const trimmedPhone = String(contact_phone || "").trim().slice(0, MAX_PHONE_LENGTH);
  const trimmedDescription = String(description || "").trim().slice(0, MAX_DESCRIPTION_LENGTH);
  const normalizedCondition = condition ? String(condition).trim() : "";
  const parsedYear =
    chassis_year === undefined || chassis_year === null || chassis_year === ""
      ? null
      : Number.parseInt(String(chassis_year), 10);
  const parsedPrice =
    asking_price === undefined || asking_price === null || asking_price === ""
      ? null
      : Number.parseFloat(String(asking_price));

  // Validate required fields
  if (!["buy", "sell"].includes(listing_type)) {
    return NextResponse.json({ error: "listing_type must be 'buy' or 'sell'" }, { status: 400 });
  }
  if (!trimmedName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!trimmedDescription || trimmedDescription.length < 10) {
    return NextResponse.json({ error: "Please provide more detail (min 10 characters)" }, { status: 400 });
  }
  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: "Description is too long" }, { status: 400 });
  }
  if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 2010 || parsedYear > CURRENT_YEAR)) {
    return NextResponse.json({ error: `Chassis year must be between 2010 and ${CURRENT_YEAR}` }, { status: 400 });
  }
  if (normalizedCondition && !VALID_CONDITIONS.has(normalizedCondition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  }
  if (listing_type === "buy" && normalizedCondition) {
    return NextResponse.json({ error: "Condition can only be set for sell listings" }, { status: 400 });
  }
  if (listing_type === "sell" && parsedPrice !== null) {
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: "Invalid asking price" }, { status: 400 });
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chassis_listings")
    .insert({
      listing_type,
      contact_name: trimmedName,
      contact_email: trimmedEmail,
      contact_phone: trimmedPhone || null,
      description: trimmedDescription,
      asking_price: listing_type === "sell" ? parsedPrice : null,
      chassis_year: parsedYear,
      condition: listing_type === "sell" ? normalizedCondition || null : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}
