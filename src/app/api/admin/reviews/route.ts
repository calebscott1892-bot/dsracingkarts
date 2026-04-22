import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

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

// GET /api/admin/reviews — list all reviews (admin only)
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("reviews")
    .select("*")
    .order("sort_order")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/reviews — create a new review
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { author_name, text, platform, rating, review_date, is_visible, sort_order } = body;

  if (!author_name?.trim()) return NextResponse.json({ error: "Author name required" }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ error: "Review text required" }, { status: 400 });
  if (!platform?.trim()) return NextResponse.json({ error: "Platform required" }, { status: 400 });
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("reviews")
    .insert({
      author_name: author_name.trim(),
      text: text.trim(),
      platform: platform.trim(),
      rating,
      review_date: review_date || null,
      is_visible: is_visible !== false,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
