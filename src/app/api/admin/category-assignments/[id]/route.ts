import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushItemCategoryToSquare } from "@/lib/square-sync";

// Square pushes can take several seconds per item; allow up to 60s.
export const runtime = "nodejs";
export const maxDuration = 60;

async function lookupSquareIds(
  service: ReturnType<typeof createServiceClient>,
  productId: string,
  categoryId: string | null
) {
  const [{ data: product }, categoryResp] = await Promise.all([
    service.from("products").select("square_token, slug").eq("id", productId).maybeSingle(),
    categoryId
      ? service.from("categories").select("square_id").eq("id", categoryId).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  return {
    productSquareToken: product?.square_token ?? null,
    productSlug: product?.slug ?? null,
    categorySquareId: (categoryResp as any)?.data?.square_id ?? null,
  };
}

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

function revalidateCategorySurfaces(productSlug: string | null) {
  revalidatePath("/admin/category-assignments");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  if (productSlug) revalidatePath(`/product/${productSlug}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const action = body?.action as
    | "approve"
    | "reject"
    | "repend"
    | "apply"
    | "revert"
    | "reassign"
    | undefined;

  if (
    !action ||
    !["approve", "reject", "repend", "apply", "revert", "reassign"].includes(action)
  ) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const service = createServiceClient();

  if (action === "reassign") {
    const newCategoryId = body?.category_id;
    if (!newCategoryId || typeof newCategoryId !== "string") {
      return NextResponse.json({ error: "category_id is required" }, { status: 400 });
    }

    const { data: target } = await service
      .from("categories")
      .select("id")
      .eq("id", newCategoryId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const { data: existing } = await service
      .from("category_assignment_suggestions")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }
    if (existing.status === "applied") {
      return NextResponse.json(
        { error: "Revert this suggestion before reassigning a different category." },
        { status: 400 }
      );
    }

    const { error } = await service
      .from("category_assignment_suggestions")
      .update({
        suggested_category_id: newCategoryId,
        status: "approved",
        approved_by: admin.userId,
        approved_at: new Date().toISOString(),
        rationale: "Manually reassigned via admin category picker.",
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidatePath("/admin/category-assignments");
    return NextResponse.json({ ok: true });
  }

  if (action === "approve" || action === "reject" || action === "repend") {
    const nextStatus =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";

    const { data: existing, error: existingError } = await service
      .from("category_assignment_suggestions")
      .select("status")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    if (existing.status === "applied" || existing.status === "reverted") {
      return NextResponse.json(
        { error: `Cannot ${action} a suggestion that is already ${existing.status}.` },
        { status: 400 }
      );
    }

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
    .select("status, suggested_category_id, product_id, product_name")
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

    const { productSquareToken, productSlug, categorySquareId } = await lookupSquareIds(
      service,
      suggestion.product_id,
      suggestion.suggested_category_id
    );

    let squarePushed = false;
    let squareWarning: string | null = null;
    if (productSquareToken && categorySquareId) {
      const result = await pushItemCategoryToSquare(
        productSquareToken,
        categorySquareId,
        "remove",
        `revert-${id}-${Date.now()}`
      );
      squarePushed = result.ok;
      if (!result.ok) {
        return NextResponse.json(
          {
            error: `Square was not updated for "${suggestion.product_name}": ${result.reason}. Nothing was reverted locally.`,
            productName: suggestion.product_name,
            squareWarning: result.reason,
          },
          { status: 409 }
        );
      }
    } else if (!productSquareToken) {
      squareWarning = "Product has no square_token - Square not updated.";
    } else if (!categorySquareId) {
      squareWarning = "Category has no square_id - Square not updated.";
    }

    const { data, error } = await service.rpc("revert_category_assignment_suggestion", {
      p_suggestion_id: id,
      p_changed_by: admin.userId,
      p_note: "Reverted from admin category assignment review.",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidateCategorySurfaces(productSlug);
    return NextResponse.json({ result: data, squarePushed, squareWarning });
  }

  if (!suggestion.suggested_category_id) {
    return NextResponse.json(
      { error: "This item has no suggested category yet and cannot be applied automatically" },
      { status: 400 }
    );
  }

  if (suggestion.status !== "approved") {
    return NextResponse.json(
      { error: "Suggestion must be approved before it can be applied" },
      { status: 400 }
    );
  }

  const { productSquareToken, productSlug, categorySquareId } = await lookupSquareIds(
    service,
    suggestion.product_id,
    suggestion.suggested_category_id
  );

  const { count: existingCategoryCount, error: countError } = await service
    .from("product_categories")
    .select("category_id", { count: "exact", head: true })
    .eq("product_id", suggestion.product_id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 400 });
  }

  if ((existingCategoryCount || 0) > 0) {
    const { data, error } = await service.rpc("apply_category_assignment_suggestion", {
      p_suggestion_id: id,
      p_changed_by: admin.userId,
      p_note: "Skipped from admin category assignment review because product is already categorised.",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidatePath("/admin/category-assignments");
    return NextResponse.json({ result: data, squarePushed: false, squareWarning: null });
  }

  let squarePushed = false;
  let squareWarning: string | null = null;
  if (productSquareToken && categorySquareId) {
    const result = await pushItemCategoryToSquare(
      productSquareToken,
      categorySquareId,
      "add",
      `apply-${id}-${Date.now()}`
    );
    squarePushed = result.ok;
    if (!result.ok) {
      return NextResponse.json(
        {
          error: `Square was not updated for "${suggestion.product_name}": ${result.reason}. Nothing was applied locally.`,
          productName: suggestion.product_name,
          squareWarning: result.reason,
        },
        { status: 409 }
      );
    }
  } else if (!productSquareToken) {
    squareWarning = "Product has no square_token - Square not updated.";
  } else if (!categorySquareId) {
    squareWarning = "Category has no square_id - Square not updated.";
  }

  const { data, error } = await service.rpc("apply_category_assignment_suggestion", {
    p_suggestion_id: id,
    p_changed_by: admin.userId,
    p_note: "Applied from admin category assignment review.",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateCategorySurfaces(productSlug);
  return NextResponse.json({ result: data, squarePushed, squareWarning });
}
