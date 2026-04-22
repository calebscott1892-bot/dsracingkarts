import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;
type OrderStatus = typeof VALID_STATUSES[number];

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
  return true;
}

// PATCH /api/admin/orders/[id] — update order status and/or admin notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { status, admin_notes } = body;

  if (status !== undefined && !VALID_STATUSES.includes(status as OrderStatus)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (status !== undefined) update.status = status;
  if (admin_notes !== undefined) update.admin_notes = String(admin_notes).trim().slice(0, 2000) || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("id, status, admin_notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return NextResponse.json(data);
}
