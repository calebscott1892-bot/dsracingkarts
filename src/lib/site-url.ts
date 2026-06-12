// Public site URL for SEO surfaces: canonicals, Open Graph, JSON-LD, the
// sitemap and robots. The site serves on www (the apex 307s to it), so these
// must always emit the www host even while NEXT_PUBLIC_SITE_URL is set to the
// apex. API code (Square webhooks, checkout redirect URLs) keeps reading the
// env var directly — the webhook subscription is registered against it.
const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://www.dsracingkarts.com.au";

export const SITE_URL = raw
  .replace(/\/+$/, "")
  .replace("https://dsracingkarts.com.au", "https://www.dsracingkarts.com.au");
