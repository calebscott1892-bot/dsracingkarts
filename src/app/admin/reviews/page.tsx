import { createServiceClient } from "@/lib/supabase/server";
import { ReviewsManager } from "./ReviewsManager";

export default async function AdminReviewsPage() {
  const supabase = createServiceClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .order("sort_order")
    .order("created_at");

  return <ReviewsManager initialReviews={reviews ?? []} />;
}
