import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
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
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/checkout", "/account", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
