import { createServiceClient } from "@/lib/supabase/server";
import { CategoryAssignmentsManager } from "./CategoryAssignmentsManager";

export const dynamic = "force-dynamic";

async function fetchPaginated<T>(
  runQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
) {
  const pageSize = 1000;
  const rows: T[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await runQuery(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page += 1;
  }

  return rows;
}

function confidenceBand(confidence: number) {
  if (confidence >= 0.55) return "high";
  if (confidence >= 0.35) return "medium";
  if (confidence > 0) return "low";
  return "no_match";
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.55) return "high";
  if (confidence >= 0.35) return "medium";
  if (confidence > 0) return "low";
  return "no_match";
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
    reverted: 0,
    high: 0,
    medium: 0,
    low: 0,
    no_match: 0,
  };

  if (latestRun) {
    const [allRows, visibleRows, categories] = await Promise.all([
      fetchPaginated<{ id: string; status: string; confidence: number }>(async (from, to) =>
        await service
          .from("category_assignment_suggestions")
          .select("id, status, confidence")
          .eq("run_id", latestRun.id)
          .range(from, to)
      ),
      fetchPaginated<any>(async (from, to) =>
        await service
          .from("category_assignment_suggestions")
          .select(
            "id, product_id, product_square_token, product_name, suggested_category_id, confidence, rationale, status, created_at"
          )
          .eq("run_id", latestRun.id)
          .order("confidence", { ascending: false })
          .range(from, to)
      ),
      fetchPaginated<{ id: string; name: string; parent_id: string | null }>(async (from, to) =>
        await service.from("categories").select("id, name, parent_id").range(from, to)
      ),
    ]);

    const categoryMap = new Map((categories || []).map((category) => [category.id, category]));

    for (const row of allRows || []) {
      summary.total += 1;
      if (row.status in summary) {
        summary[row.status as keyof typeof summary] += 1;
      }
      const band = confidenceBand(Number(row.confidence || 0));
      summary[band as "high" | "medium" | "low" | "no_match"] += 1;
    }

    suggestions = (visibleRows || []).map((row) => {
      const category = categoryMap.get(row.suggested_category_id);
      const parent = category?.parent_id ? categoryMap.get(category.parent_id) : null;
      return {
        ...row,
        suggested_category_name: category?.name || "No strong match yet",
        suggested_parent_name: parent?.name || null,
        confidence_band: confidenceLabel(Number(row.confidence || 0)),
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
