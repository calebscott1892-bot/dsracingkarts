import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(request: NextRequest) {
  const supabase = await verifyAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, body: bodyText, type, cta_label, cta_url, is_active, starts_at, ends_at, sort_order } = body;

  if (!title || !bodyText) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const { data: announcement, error } = await supabase
    .from("announcements")
    .insert({ title, body: bodyText, type, cta_label, cta_url, is_active, starts_at, ends_at, sort_order })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ announcement }, { status: 201 });
}
