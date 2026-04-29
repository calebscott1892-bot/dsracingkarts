import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Square CDN (for images before migration)
      {
        protocol: "https",
        hostname: "items-images-production.s3.us-west-2.amazonaws.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Cache optimized images for 30 days at the CDN edge
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
  },
  async redirects() {
    return [
      {
        source: "/product/:slug/:rest*",
        destination: "/product/:slug",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://web.squarecdn.com https://sandbox.web.squarecdn.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://items-images-production.s3.us-west-2.amazonaws.com https://www.google-analytics.com",
              "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://pax.squareup.com https://connect.squareup.com https://sandbox.web.squarecdn.com https://web.squarecdn.com https://*.ingest.de.sentry.io https://*.sentry.io",
              "frame-src 'self' https://pax.squareup.com https://connect.squareup.com",
              "media-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Upload source maps for better stack traces
  silent: true,
  // Hides source maps from users
  hideSourceMaps: true,
});
