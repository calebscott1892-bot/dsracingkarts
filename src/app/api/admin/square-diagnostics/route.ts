import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { diagnoseCatalogSyncFailures } from "@/lib/square-sync";

export const maxDuration = 300;

async function isAuthorisedAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return Boolean(admin && ["admin", "super_admin"].includes(admin.role));
}

export async function POST() {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await diagnoseCatalogSyncFailures({ scanLimit: 250 });
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Diagnostics failed",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
