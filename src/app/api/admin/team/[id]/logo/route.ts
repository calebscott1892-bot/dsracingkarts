import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Team-logo upload endpoint.
 *
 * Notes for future readers:
 *  - Storage operations (createBucket, upload) need the SERVICE ROLE key, not
 *    the anon key. We instantiate a dedicated supabase-js admin client here
 *    rather than reusing the SSR-cookie-bound `createServiceClient`, because
 *    that one's been flaky for storage on Vercel — likely a cookie-handling
 *    side-effect on serverless functions.
 *  - Bucket name is fixed: "team-logos". If a legacy "Team Logos" bucket is
 *    found, we use it but tell admins to migrate.
 *  - Every failure path is logged AND surfaced in the JSON response so the
 *    admin form shows the real error rather than a generic "Upload failed".
 */

const TEAM_LOGO_BUCKET = "team-logos";
const LEGACY_BUCKET = "Team Logos"; // tolerated; not created
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

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

/**
 * Returns a supabase-js admin client (service role) for storage + DB writes.
 * Throws a clear error if the service role key is not configured.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("Server is missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key) {
    throw new Error(
      "Server is missing SUPABASE_SERVICE_ROLE_KEY — uploads can't be authorised."
    );
  }
  return createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Locate (or create) the team-logos bucket. Returns the canonical bucket name.
 * On failure, throws an Error whose message is safe to surface to the admin.
 */
async function ensureBucket(admin: ReturnType<typeof getAdminClient>): Promise<string> {
  // Try to GET the bucket directly first — fastest happy path and avoids any
  // RLS quirks around listBuckets.
  const { data: directBucket } = await admin.storage.getBucket(TEAM_LOGO_BUCKET);
  if (directBucket) return TEAM_LOGO_BUCKET;

  // Try the legacy name with a space, in case an older deploy created it that way.
  const { data: legacyBucket } = await admin.storage.getBucket(LEGACY_BUCKET);
  if (legacyBucket) return LEGACY_BUCKET;

  // Neither exists yet — create the canonical one.
  const { error: createErr } = await admin.storage.createBucket(TEAM_LOGO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: [...ALLOWED_MIME],
  });

  if (createErr) {
    // The bucket may have been created concurrently; verify and continue.
    if (/already exists/i.test(createErr.message)) {
      return TEAM_LOGO_BUCKET;
    }
    throw new Error(
      `Couldn't create the "${TEAM_LOGO_BUCKET}" Storage bucket: ${createErr.message}. ` +
        `An admin may need to create it manually in Supabase Storage and mark it public.`
    );
  }

  return TEAM_LOGO_BUCKET;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await verifyAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let teamId: string;
  try {
    teamId = (await params).id;
  } catch {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  let admin: ReturnType<typeof getAdminClient>;
  try {
    admin = getAdminClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server misconfigured";
    console.error("[team-logo] admin client init failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ── Parse the upload ──
  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
  } catch (err) {
    return NextResponse.json(
      { error: "Couldn't read uploaded file (bad form encoding)." },
      { status: 400 }
    );
  }
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is over 2MB. Please compress before uploading." },
      { status: 413 }
    );
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const mimeFromExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const contentType = (file.type || mimeFromExt[ext] || "image/jpeg").toLowerCase();
  if (!ALLOWED_MIME.includes(contentType as (typeof ALLOWED_MIME)[number])) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPG, PNG, or WebP." },
      { status: 400 }
    );
  }

  // ── Ensure bucket ──
  let bucketName: string;
  try {
    bucketName = await ensureBucket(admin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage bucket unavailable";
    console.error("[team-logo] ensureBucket failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ── Upload ──
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${teamId}/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await admin.storage
    .from(bucketName)
    .upload(fileName, buffer, { contentType, upsert: true });

  if (uploadError) {
    console.error("[team-logo] upload failed:", uploadError.message);
    return NextResponse.json(
      {
        error:
          uploadError.message ||
          "Upload failed. Check the Supabase Storage policies for the team-logos bucket.",
      },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(bucketName).getPublicUrl(uploadData.path);

  if (!publicUrl) {
    console.error("[team-logo] uploaded but no public URL produced");
    return NextResponse.json(
      { error: "Logo uploaded but the public URL could not be resolved." },
      { status: 500 }
    );
  }

  // ── Persist on the team record ──
  const { error: updateError } = await admin
    .from("team_profiles")
    .update({ logo_url: publicUrl })
    .eq("id", teamId);

  if (updateError) {
    console.error("[team-logo] team_profiles update failed:", updateError.message);
    return NextResponse.json(
      {
        error: `Logo uploaded but the team record couldn't be updated: ${updateError.message}`,
      },
      { status: 500 }
    );
  }

  revalidatePath("/about", "page");
  revalidatePath("/admin/team", "page");
  revalidatePath(`/admin/team/${teamId}`, "page");

  return NextResponse.json({ url: publicUrl, bucket: bucketName });
}
