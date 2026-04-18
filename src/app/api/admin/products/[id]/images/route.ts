import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  // Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceClient = createServiceClient();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${productId}/${Date.now()}.${ext}`;

  // Upload to Supabase Storage (bucket: product-images)
  const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from("product-images")
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = serviceClient.storage
    .from("product-images")
    .getPublicUrl(uploadData.path);

  // Check if this product has any existing images
  const { count } = await serviceClient
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);

  const isPrimary = count === 0;

  // Insert into product_images table
  const { data: image, error: insertError } = await serviceClient
    .from("product_images")
    .insert({
      product_id: productId,
      url: publicUrl,
      alt_text: "",
      sort_order: count || 0,
      is_primary: isPrimary,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Set primary_image_url on product if this is the first image
  if (isPrimary) {
    await serviceClient
      .from("products")
      .update({ primary_image_url: publicUrl })
      .eq("id", productId);
  }

  return NextResponse.json({ image });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  // Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceClient = createServiceClient();
  const { imageId } = await request.json();

  // Get image details
  const { data: image } = await serviceClient
    .from("product_images")
    .select("id, url, is_primary")
    .eq("id", imageId)
    .eq("product_id", productId)
    .single();

  if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  // Extract storage path from URL
  const urlParts = image.url.split("/product-images/");
  if (urlParts[1]) {
    await serviceClient.storage.from("product-images").remove([urlParts[1]]);
  }

  // Delete from DB
  await serviceClient.from("product_images").delete().eq("id", imageId);

  // If this was the primary image, promote the next one
  if (image.is_primary) {
    const { data: nextImage } = await serviceClient
      .from("product_images")
      .select("id, url")
      .eq("product_id", productId)
      .order("sort_order")
      .limit(1)
      .single();

    if (nextImage) {
      await serviceClient
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", nextImage.id);
      await serviceClient
        .from("products")
        .update({ primary_image_url: nextImage.url })
        .eq("id", productId);
    } else {
      await serviceClient
        .from("products")
        .update({ primary_image_url: null })
        .eq("id", productId);
    }
  }

  return NextResponse.json({ success: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  // Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceClient = createServiceClient();
  const { imageId } = await request.json();

  // Clear current primary
  await serviceClient
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId);

  // Set new primary
  const { data: image } = await serviceClient
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId)
    .eq("product_id", productId)
    .select("url")
    .single();

  if (image) {
    await serviceClient
      .from("products")
      .update({ primary_image_url: image.url })
      .eq("id", productId);
  }

  return NextResponse.json({ success: true });
}
