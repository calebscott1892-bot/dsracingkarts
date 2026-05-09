import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { normalizeTeamLogoUrl } from "@/lib/teamLogos";

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

// PATCH /api/admin/team/[id] — update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await verifyAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const service = createServiceClient();

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { kart_number, team_name, tagline, accent_color, accent_rgb, logo_url, website_url, sort_order, is_active } = body;
  const trimmedKartNumber = String(kart_number ?? "").trim();
  const trimmedTeamName = String(team_name ?? "").trim();
  const normalizedLogoUrl = normalizeTeamLogoUrl(logo_url, team_name);

  if (!trimmedKartNumber || !trimmedTeamName) {
    return NextResponse.json({ error: "kart_number and team_name are required" }, { status: 400 });
  }

  const { data: team, error } = await service
    .from("team_profiles")
    .update({
      kart_number: trimmedKartNumber,
      team_name: trimmedTeamName,
      tagline: String(tagline ?? "").trim() || null,
      accent_color: String(accent_color ?? "#ef4444").trim(),
      accent_rgb: String(accent_rgb ?? "239,68,68").trim(),
      logo_url: normalizedLogoUrl ?? null,
      website_url: String(website_url ?? "").trim() || null,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      is_active: Boolean(is_active),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/about", "page");
  revalidatePath("/admin/team", "page");
  revalidatePath(`/admin/team/${id}`, "page");
  return NextResponse.json({ team });
}

// DELETE /api/admin/team/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await verifyAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const service = createServiceClient();

  const { error } = await service.from("team_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/about", "page");
  revalidatePath("/admin/team", "page");
  return NextResponse.json({ ok: true });
}
