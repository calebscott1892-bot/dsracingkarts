import { createServiceClient } from "@/lib/supabase/server";
import { ChassisListingsManager } from "./ChassisListingsManager";
import { mergeChassisPageContent } from "@/lib/chassis-page-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminChassisListingsPage() {
  const supabase = createServiceClient();
  const [{ data: listings }, { data: pageContentRow }] = await Promise.all([
    supabase
      .from("chassis_listings")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("chassis_page_content")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  return (
    <ChassisListingsManager
      initialListings={listings ?? []}
      initialPageContent={mergeChassisPageContent(pageContentRow)}
    />
  );
}
