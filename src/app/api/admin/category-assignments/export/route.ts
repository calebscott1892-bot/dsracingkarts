import { NextResponse } from "next/server";
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
  return true;
}

function confidenceBand(confidence: number) {
  if (confidence >= 0.55) return "high";
  if (confidence >= 0.35) return "medium";
  return "low";
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: latestRun } = await service
    .from("category_assignment_runs")
    .select("id, created_at")
    .eq("mode", "suggestion")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun) {
    return NextResponse.json({ error: "No category assignment run found" }, { status: 404 });
  }

  const [{ data: suggestions }, { data: categories }] = await Promise.all([
    service
      .from("category_assignment_suggestions")
      .select(
        "id, product_id, product_square_token, product_name, suggested_category_id, confidence, rationale, status, created_at"
      )
      .eq("run_id", latestRun.id)
      .order("confidence", { ascending: false }),
    service.from("categories").select("id, name, parent_id"),
  ]);

  const categoryMap = new Map((categories || []).map((category) => [category.id, category]));

  const header = [
    "suggestion_id",
    "product_id",
    "square_token",
    "product_name",
    "suggested_parent_category",
    "suggested_category",
    "confidence",
    "confidence_band",
    "status",
    "rationale",
    "created_at",
  ];

  const lines = [header.join(",")];

  for (const suggestion of suggestions || []) {
    const category = categoryMap.get(suggestion.suggested_category_id);
    const parent = category?.parent_id ? categoryMap.get(category.parent_id) : null;

    lines.push(
      [
        suggestion.id,
        suggestion.product_id,
        suggestion.product_square_token,
        suggestion.product_name,
        parent?.name || "",
        category?.name || "",
        Number(suggestion.confidence || 0).toFixed(4),
        confidenceBand(Number(suggestion.confidence || 0)),
        suggestion.status,
        suggestion.rationale,
        suggestion.created_at,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"category-suggestions-${timestamp}.csv\"`,
    },
  });
}
