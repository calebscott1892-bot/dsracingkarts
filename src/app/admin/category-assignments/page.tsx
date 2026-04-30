import { createServiceClient } from "@/lib/supabase/server";
import { CategoryAssignmentsManager } from "./CategoryAssignmentsManager";

export const dynamic = "force-dynamic";

function confidenceBand(confidence: number) {
  if (confidence >= 0.55) return "high";
  if (confidence >= 0.35) return "medium";
  return "low";
}

export default async function AdminCategoryAssignmentsPage() {
  const service = createServiceClient();

  const [{ data: latestRun }, { count: uncategorizedCount }] = await Promise.all([
    service
      .from("category_assignment_runs")
      .select("id, mode, source, notes, created_at")
      .eq("mode", "suggestion")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from("uncategorized_products").select("id", { count: "exact", head: true }),
  ]);

  let suggestions: any[] = [];
  let summary = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
    skipped: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  if (latestRun) {
    const [{ data: allRows }, { data: visibleRows }, { data: categories }] = await Promise.all([
      service
        .from("category_assignment_suggestions")
        .select("id, status, confidence")
        .eq("run_id", latestRun.id),
      service
        .from("category_assignment_suggestions")
        .select(
          "id, product_id, product_square_token, product_name, suggested_category_id, confidence, rationale, status, created_at"
        )
        .eq("run_id", latestRun.id)
        .gte("confidence", 0.35)
        .order("confidence", { ascending: false }),
      service.from("categories").select("id, name, parent_id"),
    ]);

    const categoryMap = new Map((categories || []).map((category) => [category.id, category]));

    for (const row of allRows || []) {
      summary.total += 1;
      if (row.status in summary) {
        summary[row.status as keyof typeof summary] += 1;
      }
      const band = confidenceBand(Number(row.confidence || 0));
      summary[band as "high" | "medium" | "low"] += 1;
    }

    suggestions = (visibleRows || []).map((row) => {
      const category = categoryMap.get(row.suggested_category_id);
      const parent = category?.parent_id ? categoryMap.get(category.parent_id) : null;
      return {
        ...row,
        suggested_category_name: category?.name || "Unknown category",
        suggested_parent_name: parent?.name || null,
      };
    });
  }

  return (
    <CategoryAssignmentsManager
      latestRun={latestRun}
      uncategorizedCount={uncategorizedCount || 0}
      summary={summary}
      suggestions={suggestions}
    />
  );
}
