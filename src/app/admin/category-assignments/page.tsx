import { createServiceClient } from "@/lib/supabase/server";
import {
  buildCurrentCategoryAssignmentQueue,
  emptyCategoryAssignmentSummary,
  summarizeCategoryAssignmentQueue,
} from "@/lib/category-assignment-queue";
import { CategoryAssignmentsManager } from "./CategoryAssignmentsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function confidenceLabel(confidence: number) {
  if (confidence >= 0.55) return "high";
  if (confidence >= 0.35) return "medium";
  if (confidence > 0) return "low";
  return "no_match";
}

export default async function AdminCategoryAssignmentsPage() {
  const service = createServiceClient();

  const [{ data: latestRun }, uncategorizedProducts, openRows, categories] = await Promise.all([
    service
      .from("category_assignment_runs")
      .select("id, mode, source, notes, created_at")
      .eq("mode", "suggestion")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchPaginated<{ id: string }>(async (from, to) =>
      await service.from("uncategorized_products").select("id").range(from, to)
    ),
    fetchPaginated<any>(async (from, to) =>
      await service
        .from("category_assignment_suggestions")
        .select(
          "id, product_id, product_square_token, product_name, suggested_category_id, confidence, rationale, status, created_at"
        )
        .in("status", ["pending", "approved", "rejected"])
        .range(from, to)
    ),
    fetchPaginated<{ id: string; name: string; parent_id: string | null }>(async (from, to) =>
      await service.from("categories").select("id, name, parent_id").range(from, to)
    ),
  ]);

  const currentUncategorizedIds = uncategorizedProducts.map((product) => product.id);
  const reviewRows = buildCurrentCategoryAssignmentQueue(openRows || [], currentUncategorizedIds);
  const summary = reviewRows.length
    ? summarizeCategoryAssignmentQueue(reviewRows)
    : emptyCategoryAssignmentSummary();
  const categoryMap = new Map((categories || []).map((category) => [category.id, category]));

  const suggestions = reviewRows.map((row) => {
    const category = row.suggested_category_id
      ? categoryMap.get(row.suggested_category_id)
      : null;
    const parent = category?.parent_id ? categoryMap.get(category.parent_id) : null;
    return {
      ...row,
      suggested_category_name: category?.name || "No strong match yet",
      suggested_parent_name: parent?.name || null,
      confidence_band: confidenceLabel(Number(row.confidence || 0)),
    };
  });

  const allCategoriesForPicker = (categories || []).map((category) => {
    const parent = category.parent_id ? categoryMap.get(category.parent_id) : null;
    return {
      id: category.id,
      name: category.name,
      parent_name: parent?.name || null,
      full_label: parent ? `${parent.name} / ${category.name}` : category.name,
    };
  });
  allCategoriesForPicker.sort((a, b) => a.full_label.localeCompare(b.full_label));

  return (
    <CategoryAssignmentsManager
      latestRun={latestRun}
      uncategorizedCount={uncategorizedProducts.length}
      summary={summary}
      suggestions={suggestions}
      allCategories={allCategoriesForPicker}
    />
  );
}
