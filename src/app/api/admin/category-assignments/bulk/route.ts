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
  return { userId: user.id };
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action = body?.action as "approve" | "reject" | undefined;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "No suggestions selected" }, { status: 400 });
  }

  const service = createServiceClient();
  const nextStatus = action === "approve" ? "approved" : "rejected";

  const updates =
    action === "approve"
      ? {
          status: nextStatus,
          approved_by: admin.userId,
          approved_at: new Date().toISOString(),
        }
      : {
          status: nextStatus,
          approved_by: null,
          approved_at: null,
        };

  const { error } = await service
    .from("category_assignment_suggestions")
    .update(updates)
    .in("id", ids)
    .in("status", ["pending", "approved", "rejected"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/admin/category-assignments");
  return NextResponse.json({ ok: true, count: ids.length });
}
