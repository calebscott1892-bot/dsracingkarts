import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementBanner } from "./AnnouncementBanner";

/**
 * Server component — renders the currently-active announcement banner if
 * any. CRITICAL: this MUST never throw out of its boundary. It runs on every
 * page render including the home page; if it bubbles, the user lands on the
 * global error boundary at /app/error.tsx.
 *
 * All paths return null on failure. Errors are reported to Sentry with a
 * breadcrumb so we can diagnose silent failures from production logs.
 */
export async function ActiveAnnouncement() {
  try {
    const supabase = await createClient();

    // Fetch all active announcements and filter the date window in JS —
    // avoids PostgREST .or() timestamp parsing issues.
    const { data: rows, error } = await supabase
      .from("announcements")
      .select("id, title, body, type, cta_label, cta_url, starts_at, ends_at")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at", { ascending: false });

    if (error) {
      Sentry.addBreadcrumb({
        category: "supabase",
        level: "warning",
        message: "ActiveAnnouncement: announcements query failed",
        data: { code: error.code, message: error.message, hint: error.hint },
      });
      Sentry.captureMessage("ActiveAnnouncement supabase error", {
        level: "warning",
        extra: { code: error.code, message: error.message },
      });
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
    // Capture but never propagate. The site rendering must continue.
    Sentry.captureException(err, {
      tags: { component: "ActiveAnnouncement" },
    });
    return null;
  }
}
