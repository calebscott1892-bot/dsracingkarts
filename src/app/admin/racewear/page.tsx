import { createServiceClient } from "@/lib/supabase/server";
import { RacewearManager } from "./RacewearManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Racewear Gallery | DSR Admin" };

export default async function AdminRacewearPage() {
  const supabase = createServiceClient();
  const { data: entries } = await supabase
    .from("racewear_gallery")
    .select("*")
    .order("sort_order")
    .order("created_at");

  return <RacewearManager initialEntries={entries ?? []} />;
}
