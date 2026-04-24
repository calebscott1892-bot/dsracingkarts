import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

// POST — create a result for a team
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { team_profile_id, event_date, event_name, track, class: raceClass, position, best_lap_time, top_speed_kmh, notes } = body;

  if (!team_profile_id) return NextResponse.json({ error: "team_profile_id required" }, { status: 400 });
  if (!event_date) return NextResponse.json({ error: "event_date required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("team_results")
    .insert({
      team_profile_id: String(team_profile_id),
      event_date: String(event_date),
      event_name: String(event_name || "").trim().slice(0, 200),
      track: String(track || "").trim().slice(0, 200),
      class: String(raceClass || "").trim().slice(0, 100),
      position: position != null ? Number(position) : null,
      best_lap_time: String(best_lap_time || "").trim().slice(0, 20),
      top_speed_kmh: top_speed_kmh != null ? Number(top_speed_kmh) : null,
      notes: String(notes || "").trim().slice(0, 500),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/about");
  revalidatePath(`/admin/team/${team_profile_id}`);
  return NextResponse.json({ result: data }, { status: 201 });
}

// PATCH — update a result
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = ["event_date", "event_name", "track", "class", "position", "best_lap_time", "top_speed_kmh", "notes"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in fields) updates[key] = fields[key];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("team_results")
    .update(updates)
    .eq("id", id)
    .select("id, team_profile_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidatePath("/about");
  revalidatePath(`/admin/team/${data.team_profile_id}`);
  return NextResponse.json({ success: true });
}

// DELETE
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("team_results")
    .delete()
    .eq("id", id)
    .select("team_profile_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data?.team_profile_id) {
    revalidatePath("/about");
    revalidatePath(`/admin/team/${data.team_profile_id}`);
  }
  return NextResponse.json({ success: true });
}
