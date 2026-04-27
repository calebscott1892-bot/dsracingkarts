import * as Sentry from "@sentry/nextjs";
import { createPublicReadClient } from "@/lib/supabase/server";
import { AnnouncementBanner } from "./AnnouncementBanner";

/**
 * Next.js throws control-flow exceptions during static generation for things
 * like `cookies()` / `notFound()` / `redirect()`. Catching them suppresses the
 * framework's own behaviour (and pollutes the build log). Detect by digest /
 * special property so we can rethrow them through our error guard.
 */
function isFrameworkControlException(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { digest?: unknown; message?: string };
  if (typeof e.digest === "string") {
    if (e.digest === "DYNAMIC_SERVER_USAGE") return true;
    if (e.digest === "NEXT_NOT_FOUND") return true;
    if (e.digest.startsWith("NEXT_REDIRECT")) return true;
  }
  if (typeof e.message === "string" && e.message.includes("Dynamic server usage")) return true;
  return false;
}

/**
 * Server component — renders the currently-active announcement banner if
 * any. CRITICAL: this MUST never throw out of its boundary on real failures.
 * It runs on every page render including the home page; if a real error
 * bubbles, the user lands on the global error boundary at /app/error.tsx.
 *
 * Real failures return null and report to Sentry. Framework control-flow
 * exceptions (DYNAMIC_SERVER_USAGE, NEXT_REDIRECT, NEXT_NOT_FOUND) are
 * rethrown so Next.js can do its job.
 *
 * Uses createPublicReadClient (no cookies()) so static generation of public
 * pages still works — announcements is a public-read table.
 */
export async function ActiveAnnouncement() {
  try {
    const supabase = createPublicReadClient();

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
    // Let framework control-flow exceptions propagate so Next.js handles
    // them properly (mark page dynamic, redirect, render not-found).
    if (isFrameworkControlException(err)) throw err;
    Sentry.captureException(err, {
      tags: { component: "ActiveAnnouncement" },
    });
    return null;
  }
}
