import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  RACEWEAR_ALLOWED_MIME_TYPES,
  RACEWEAR_MAX_FILE_SIZE,
  RACEWEAR_PHOTOS_BUCKET,
  resolveRacewearFeaturedFlag,
  shouldFeatureRacewearGroupByDefault,
  validateRacewearUploadFile,
} from "@/lib/racewear-gallery";

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

function getAdminStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Server is missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Server is missing SUPABASE_SERVICE_ROLE_KEY");
  return createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureRacewearBucket(admin: ReturnType<typeof getAdminStorageClient>) {
  const { data: existingBucket } = await admin.storage.getBucket(RACEWEAR_PHOTOS_BUCKET);
  if (existingBucket) return;

  const { error } = await admin.storage.createBucket(RACEWEAR_PHOTOS_BUCKET, {
    public: true,
    fileSizeLimit: RACEWEAR_MAX_FILE_SIZE,
    allowedMimeTypes: [...RACEWEAR_ALLOWED_MIME_TYPES],
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Storage bucket unavailable: ${error.message}`);
  }
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    "name" in value
  );
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function revalidateRacewearViews() {
  revalidatePath("/services");
  revalidatePath("/services/racewear-gallery");
  revalidatePath("/admin/racewear");
}

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("racewear_gallery")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Couldn't read uploaded photos." }, { status: 400 });
    }

    const groupLabel = String(formData.get("group_label") ?? "").trim();
    if (!groupLabel) {
      return NextResponse.json({ error: "group_label is required" }, { status: 400 });
    }

    const files = formData.getAll("photos").filter(isUploadedFile);
    if (files.length === 0) {
      return NextResponse.json({ error: "Please select at least one photo." }, { status: 400 });
    }

    let admin: ReturnType<typeof getAdminStorageClient>;
    try {
      admin = getAdminStorageClient();
      await ensureRacewearBucket(admin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Storage bucket unavailable";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const baseSortOrder = parseSortOrder(formData.get("sort_order"));
    const altText = String(formData.get("alt_text") ?? "").trim().slice(0, 300);
    const isFeatured = resolveRacewearFeaturedFlag(
      formData.get("is_featured"),
      shouldFeatureRacewearGroupByDefault(groupLabel)
    );
    const uploadedPaths: string[] = [];
    const rows: Array<{
      group_label: string;
      image_url: string;
      alt_text: string;
      sort_order: number;
      is_featured: boolean;
      is_active: boolean;
    }> = [];

    for (const [index, file] of files.entries()) {
      const validation = validateRacewearUploadFile(file);
      if (!validation.ok) {
        if (uploadedPaths.length > 0) {
          await admin.storage.from(RACEWEAR_PHOTOS_BUCKET).remove(uploadedPaths).catch(() => {});
        }
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const path = `gallery/${Date.now()}-${index}-${crypto.randomUUID()}.${validation.extension}`;
      const { data: uploadData, error: uploadError } = await admin.storage
        .from(RACEWEAR_PHOTOS_BUCKET)
        .upload(path, buffer, { contentType: validation.contentType, upsert: false });

      if (uploadError) {
        if (uploadedPaths.length > 0) {
          await admin.storage.from(RACEWEAR_PHOTOS_BUCKET).remove(uploadedPaths).catch(() => {});
        }
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
      }

      uploadedPaths.push(uploadData.path);
      const {
        data: { publicUrl },
      } = admin.storage.from(RACEWEAR_PHOTOS_BUCKET).getPublicUrl(uploadData.path);

      rows.push({
        group_label: groupLabel.slice(0, 200),
        image_url: publicUrl,
        alt_text: altText,
        sort_order: baseSortOrder + index,
        is_featured: isFeatured,
        is_active: true,
      });
    }

    const { data, error } = await admin
      .from("racewear_gallery")
      .insert(rows)
      .select("*")
      .order("sort_order")
      .order("created_at");

    if (error) {
      if (uploadedPaths.length > 0) {
        await admin.storage.from(RACEWEAR_PHOTOS_BUCKET).remove(uploadedPaths).catch(() => {});
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateRacewearViews();
    return NextResponse.json({ entry: data?.[0] ?? null, entries: data ?? [] }, { status: 201 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { group_label, image_url, alt_text, sort_order, is_featured } = body;

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
      is_featured: resolveRacewearFeaturedFlag(
        is_featured,
        shouldFeatureRacewearGroupByDefault(group_label)
      ),
      is_active: true,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateRacewearViews();
  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "reorder") {
    const updates = Array.isArray(body.entries) ? body.entries : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: "entries are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    for (const update of updates as Array<{ id?: unknown; sort_order?: unknown; group_label?: unknown }>) {
      if (!update?.id) return NextResponse.json({ error: "entry id is required" }, { status: 400 });
      const sortOrder = Number(update.sort_order);
      if (!Number.isFinite(sortOrder)) {
        return NextResponse.json({ error: "sort_order must be a number" }, { status: 400 });
      }

      const values: Record<string, unknown> = { sort_order: sortOrder };
      if (update.group_label !== undefined) {
        const groupLabel = String(update.group_label).trim();
        if (!groupLabel) return NextResponse.json({ error: "group_label must not be empty" }, { status: 400 });
        values.group_label = groupLabel.slice(0, 200);
      }

      const { error } = await supabase
        .from("racewear_gallery")
        .update(values)
        .eq("id", String(update.id));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateRacewearViews();
    return NextResponse.json({ success: true });
  }

  const { id, sort_order, is_active, is_featured, group_label, alt_text } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (sort_order !== undefined) updates.sort_order = Number(sort_order);
  if (is_active !== undefined) updates.is_active = Boolean(is_active);
  if (is_featured !== undefined) updates.is_featured = Boolean(is_featured);
  if (group_label !== undefined) updates.group_label = String(group_label).trim().slice(0, 200);
  if (alt_text !== undefined) updates.alt_text = String(alt_text).trim().slice(0, 300);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("racewear_gallery").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateRacewearViews();
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("racewear_gallery").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateRacewearViews();
  return NextResponse.json({ success: true });
}
