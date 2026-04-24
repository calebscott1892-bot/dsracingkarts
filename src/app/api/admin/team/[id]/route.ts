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

  const body = await request.json();
  const { kart_number, team_name, tagline, accent_color, accent_rgb, logo_url, website_url, sort_order, is_active } = body;
  const normalizedLogoUrl = normalizeTeamLogoUrl(logo_url, team_name);

  const { data: team, error } = await supabase
    .from("team_profiles")
    .update({
      kart_number,
      team_name,
      tagline,
      accent_color,
      accent_rgb,
      logo_url: normalizedLogoUrl,
      website_url,
      sort_order,
      is_active,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/about", "page");
  revalidatePath("/admin/team", "page");
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

  const { error } = await supabase.from("team_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/about", "page");
  revalidatePath("/admin/team", "page");
  return NextResponse.json({ ok: true });
}
