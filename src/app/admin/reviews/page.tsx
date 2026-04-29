import { createServiceClient } from "@/lib/supabase/server";
import { ReviewsManager } from "./ReviewsManager";

export default async function AdminReviewsPage() {
  const supabase = createServiceClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <div className="card p-5 mb-6 border border-surface-600/40">
        <p className="text-sm text-text-secondary">
          Use the pencil icon on any review to edit every field: name, text, platform, rating, date, visibility, and sort order.
        </p>
      </div>
      <ReviewsManager initialReviews={reviews ?? []} />
    </div>
  );
}
