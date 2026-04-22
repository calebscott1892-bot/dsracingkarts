import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

interface Params { params: Promise<{ id: string }> }

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const { data: profile } = await supabase
    .from("admin_profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const };
}

// PATCH /api/admin/newsletter/[id] — toggle subscribed status
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  if (typeof body.subscribed !== "boolean") {
    return NextResponse.json({ error: "subscribed must be a boolean" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("newsletter_subscribers")
    .update({ subscribed: body.subscribed })
    .eq("id", id)
    .select("id, email, subscribed")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/admin/newsletter/[id] — permanently remove subscriber
export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await verifyAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();
  const { error } = await service
    .from("newsletter_subscribers")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
