import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET — list all entries
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("racewear_gallery")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — create entry
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { group_label, image_url, alt_text, sort_order } = body;

  if (!group_label || typeof group_label !== "string" || !group_label.trim()) {
    return NextResponse.json({ error: "group_label is required" }, { status: 400 });
  }
  if (!image_url || typeof image_url !== "string") {
    return NextResponse.json({ error: "image_url is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("racewear_gallery")
    .insert({
      group_label: String(group_label).trim().slice(0, 200),
      image_url: String(image_url).trim().slice(0, 500),
      alt_text: String(alt_text || "").trim().slice(0, 300),
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data }, { status: 201 });
}

// PATCH — update sort_order or is_active
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, sort_order, is_active } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (sort_order !== undefined) updates.sort_order = Number(sort_order);
  if (is_active !== undefined) updates.is_active = Boolean(is_active);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("racewear_gallery").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove entry
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("racewear_gallery").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
