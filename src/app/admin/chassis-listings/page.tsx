import { createServiceClient } from "@/lib/supabase/server";
import { ChassisListingsManager } from "./ChassisListingsManager";

export default async function AdminChassisListingsPage() {
  const supabase = createServiceClient();
  const { data: listings } = await supabase
    .from("chassis_listings")
    .select("*")
    .order("created_at", { ascending: false });

  return <ChassisListingsManager initialListings={listings ?? []} />;
}
