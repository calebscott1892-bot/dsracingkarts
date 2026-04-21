import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: subscribers } = await supabase
    .from("newsletter_subscribers")
    .select("email, subscribed, source, created_at")
    .eq("subscribed", true)
    .order("created_at", { ascending: false });

  if (!subscribers) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });

  const csv = [
    ["Email", "Source", "Subscribed At"].join(","),
    ...subscribers.map((s) =>
      [
        `"${s.email}"`,
        `"${s.source || "website"}"`,
        `"${new Date(s.created_at).toISOString()}"`,
      ].join(",")
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="dsracing-newsletter-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
