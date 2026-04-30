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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const action = body?.action as "approve" | "reject" | "apply" | "revert" | undefined;

  if (!action || !["approve", "reject", "apply", "revert"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const service = createServiceClient();

  if (action === "approve" || action === "reject") {
    const nextStatus = action === "approve" ? "approved" : "rejected";

    const { error } = await service
      .from("category_assignment_suggestions")
      .update({
        status: nextStatus,
        approved_by: action === "approve" ? admin.userId : null,
        approved_at: action === "approve" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidatePath("/admin/category-assignments");
    return NextResponse.json({ ok: true });
  }

  const { data: suggestion, error: suggestionError } = await service
    .from("category_assignment_suggestions")
    .select("status")
    .eq("id", id)
    .single();

  if (suggestionError || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (action === "revert") {
    if (suggestion.status !== "applied") {
      return NextResponse.json(
        { error: "Only applied suggestions can be reverted" },
        { status: 400 }
      );
    }

    const { data, error } = await service.rpc("revert_category_assignment_suggestion", {
      p_suggestion_id: id,
      p_changed_by: admin.userId,
      p_note: "Reverted from admin category assignment review.",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidatePath("/admin/category-assignments");
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    revalidatePath("/shop");

    return NextResponse.json({ result: data });
  }

  if (suggestion.status !== "approved") {
    return NextResponse.json(
      { error: "Suggestion must be approved before it can be applied" },
      { status: 400 }
    );
  }

  const { data, error } = await service.rpc("apply_category_assignment_suggestion", {
    p_suggestion_id: id,
    p_changed_by: admin.userId,
    p_note: "Applied from admin category assignment review.",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/admin/category-assignments");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/shop");

  return NextResponse.json({ result: data });
}
