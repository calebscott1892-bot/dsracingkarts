import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncCatalogItem } from "@/lib/square-sync";

/**
 * Manual single-product resync from Square. Backs the "Resync from Square"
 * button on the admin product edit page — the admin can use it when something
 * looks stale or missing without waiting for the next webhook event.
 */

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await verifyAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: product } = await supabase
    .from("products")
    .select("id, slug, square_token")
    .eq("id", id)
    .single();

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.square_token) {
    return NextResponse.json(
      { error: "This product isn't linked to a Square catalog item — nothing to resync." },
      { status: 400 }
    );
  }

  const result = await syncCatalogItem(product.square_token);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason || "Resync failed" },
      { status: 500 }
    );
  }

  // Bust caches so the admin sees fresh data immediately.
  revalidatePath("/shop", "page");
  revalidatePath(`/product/${product.slug}`, "page");
  revalidatePath(`/admin/products/${id}`, "page");

  return NextResponse.json({ ok: true });
}
