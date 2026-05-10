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

// GET /api/admin/team — list all
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();

  const { data: teams, error } = await service
    .from("team_profiles")
    .select("*")
    .order("sort_order")
    .order("team_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams });
}

// POST /api/admin/team — create
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    .insert({
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
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/about", "page");
  revalidatePath("/admin/team", "page");
  return NextResponse.json({ team }, { status: 201 });
}
