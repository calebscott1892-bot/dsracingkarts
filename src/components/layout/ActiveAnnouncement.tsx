import { createServiceClient } from "@/lib/supabase/server";
import { AnnouncementBanner } from "./AnnouncementBanner";

export async function ActiveAnnouncement() {
  try {
    const supabase = createServiceClient();

    // Fetch all active announcements and filter date window in JS
    // — avoids PostgREST .or() timestamp parsing issues
    const { data: rows, error } = await supabase
      .from("announcements")
      .select("id, title, body, type, cta_label, cta_url, starts_at, ends_at")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ActiveAnnouncement] Supabase error:", error.message);
      return null;
    }

    const now = Date.now();
    const announcement =
      (rows ?? []).find((a) => {
        const afterStart = !a.starts_at || new Date(a.starts_at).getTime() <= now;
        const beforeEnd = !a.ends_at || new Date(a.ends_at).getTime() >= now;
        return afterStart && beforeEnd;
      }) ?? null;

    if (!announcement) return null;
    return <AnnouncementBanner announcement={announcement} />;
  } catch (err) {
    console.error("[ActiveAnnouncement] Unexpected error:", err);
    return null;
  }
}
