import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const TEAM_LOGO_BUCKET_CANDIDATES = ["team-logos", "Team Logos"] as const;

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

async function resolveTeamLogoBucket(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: buckets, error: listError } = await serviceClient.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const existingBucket = buckets?.find((bucket) =>
    TEAM_LOGO_BUCKET_CANDIDATES.includes(bucket.name as (typeof TEAM_LOGO_BUCKET_CANDIDATES)[number])
  );

  if (existingBucket) {
    return existingBucket.name;
  }

  const bucketName = TEAM_LOGO_BUCKET_CANDIDATES[0];
  const { error: createError } = await serviceClient.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(createError.message);
  }

  return bucketName;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await verifyAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: teamId } = await params;
    const storageClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServiceClient()
      : supabase;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const mimeFromExt: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    const contentType = file.type || mimeFromExt[ext] || "image/jpeg";

    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a JPG, PNG, or WebP logo." },
        { status: 400 }
      );
    }

    const bucketName = await resolveTeamLogoBucket(storageClient);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${teamId}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from(bucketName)
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = storageClient.storage.from(bucketName).getPublicUrl(uploadData.path);

    // Update the team record with new logo URL
    const { error: updateError } = await storageClient
      .from("team_profiles")
      .update({ logo_url: publicUrl })
      .eq("id", teamId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    revalidatePath("/about", "page");
    revalidatePath("/admin/team", "page");
    revalidatePath(`/admin/team/${teamId}`, "page");

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to upload team logo" },
      { status: 500 }
    );
  }
}
