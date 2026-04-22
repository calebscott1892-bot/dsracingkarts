import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// POST /api/admin/categories — create
export async function POST(request: NextRequest) {
  const supabase = await verifyAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, parent_id, sort_order } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = slugify(name);
  const serviceClient = createServiceClient();

  const { data: category, error } = await serviceClient
    .from("categories")
    .insert({ name: name.trim(), slug, parent_id: parent_id || null, sort_order: sort_order ?? 0 })
    .select()
    .single();

  if (error) {
    const msg = error.code === "23505" ? "A category with that name already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return NextResponse.json({ category });
}
