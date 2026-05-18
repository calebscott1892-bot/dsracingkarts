export type CategoryAssignmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "skipped"
  | "reverted";

export type ConfidenceBand = "high" | "medium" | "low" | "no_match";

export type CategoryAssignmentQueueRow = {
  id: string;
  product_id: string;
  status: CategoryAssignmentStatus;
  confidence: number | string | null;
  created_at: string;
};

export type CategoryAssignmentSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  applied: number;
  skipped: number;
  reverted: number;
  high: number;
  medium: number;
  low: number;
  no_match: number;
};

export const emptyCategoryAssignmentSummary = (): CategoryAssignmentSummary => ({
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
});

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.55) return "high";
  if (confidence >= 0.35) return "medium";
  if (confidence > 0) return "low";
  return "no_match";
}

export function isOpenCategoryAssignmentStatus(status: string): status is "pending" | "approved" | "rejected" {
  return status === "pending" || status === "approved" || status === "rejected";
}

export function blocksCategorySuggestionRegeneration(status: string) {
  return status === "approved" || status === "applied" || status === "skipped";
}

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByNewestSuggestion<T extends CategoryAssignmentQueueRow>(a: T, b: T) {
  const byTime = timestamp(a.created_at) - timestamp(b.created_at);
  if (byTime !== 0) return byTime;
  return a.id.localeCompare(b.id);
}

function compareForReviewList<T extends CategoryAssignmentQueueRow>(a: T, b: T) {
  const byConfidence = Number(b.confidence || 0) - Number(a.confidence || 0);
  if (byConfidence !== 0) return byConfidence;
  return timestamp(b.created_at) - timestamp(a.created_at);
}

export function buildCurrentCategoryAssignmentQueue<T extends CategoryAssignmentQueueRow>(
  rows: T[],
  currentUncategorizedProductIds: Iterable<string>
): T[] {
  const currentUncategorized = new Set(currentUncategorizedProductIds);
  const newestByProduct = new Map<string, T>();

  for (const row of rows) {
    if (!currentUncategorized.has(row.product_id)) continue;
    if (!isOpenCategoryAssignmentStatus(row.status)) continue;

    const existing = newestByProduct.get(row.product_id);
    if (!existing || compareByNewestSuggestion(row, existing) > 0) {
      newestByProduct.set(row.product_id, row);
    }
  }

  return Array.from(newestByProduct.values()).sort(compareForReviewList);
}

export function summarizeCategoryAssignmentQueue(
  rows: CategoryAssignmentQueueRow[]
): CategoryAssignmentSummary {
  const summary = emptyCategoryAssignmentSummary();

  for (const row of rows) {
    summary.total += 1;
    if (row.status in summary) {
      summary[row.status as CategoryAssignmentStatus] += 1;
    }

    const band = confidenceBand(Number(row.confidence || 0));
    summary[band] += 1;
  }

  return summary;
}
