import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // /api/og/ stays crawlable — product placeholder images are served
        // from there and Google disapproves products whose image URL is
        // blocked by robots.txt.
        allow: ["/", "/api/og/"],
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/checkout",
          "/account",
          "/auth/",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/api/og/"],
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/api/og/"],
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/api/og/"],
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/", "/api/og/"],
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
