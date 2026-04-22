import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

interface Params { params: Promise<{ id: string }> }

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

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

// PATCH /api/admin/chassis-listings/[id] — update status, admin notes, or content fields
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await request.json();

  const validStatuses = ["pending", "approved", "sold", "expired"];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const validConditions = new Set(["new", "excellent", "good", "fair", "parts-only"]);
  if (body.condition !== undefined && body.condition !== null && !validConditions.has(body.condition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  }

  const CURRENT_YEAR = new Date().getFullYear();
  if (body.chassis_year !== undefined && body.chassis_year !== null) {
    const yr = Number(body.chassis_year);
    if (!Number.isInteger(yr) || yr < 2000 || yr > CURRENT_YEAR) {
      return NextResponse.json({ error: `Chassis year must be between 2000 and ${CURRENT_YEAR}` }, { status: 400 });
    }
  }

  if (body.asking_price !== undefined && body.asking_price !== null) {
    const price = Number(body.asking_price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Invalid asking price" }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) update.status = body.status;
  if (body.admin_notes !== undefined) update.admin_notes = body.admin_notes;
  if (body.description !== undefined) update.description = String(body.description).trim().slice(0, 2000);
  if (body.asking_price !== undefined) update.asking_price = body.asking_price === null ? null : Number(body.asking_price);
  if (body.chassis_year !== undefined) update.chassis_year = body.chassis_year === null ? null : Number(body.chassis_year);
  if (body.condition !== undefined) update.condition = body.condition;
  if (body.contact_name !== undefined) update.contact_name = String(body.contact_name).trim().slice(0, 120);
  if (body.contact_phone !== undefined) update.contact_phone = body.contact_phone ? String(body.contact_phone).trim().slice(0, 40) : null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("chassis_listings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/admin/chassis-listings/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const service = createServiceClient();
  const { error } = await service.from("chassis_listings").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
