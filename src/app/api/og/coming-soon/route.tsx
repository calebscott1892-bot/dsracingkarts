import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// Dynamic 1200x630 PNG used as the OpenGraph / Twitter card fallback for
// products that have no real photo on Square yet. Optional `name` query
// param renders the product name centered so each shared link still looks
// distinct in Facebook / Instagram / Meta Catalog previews.
//
// We have to return a real raster image (PNG) here — Facebook's link
// scrapers ignore SVGs, which is why the existing /images/image-coming-soon.svg
// can't be used directly as an OG image.

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawName = (searchParams.get("name") || "").trim();
  const name = rawName.length > 90 ? `${rawName.slice(0, 90)}…` : rawName;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 50% 25%, rgba(230,0,18,0.18), transparent 55%)",
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top red line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundColor: "#e60012",
          }}
        />

        {/* Brand line */}
        <div
          style={{
            fontSize: 22,
            color: "#e60012",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 36,
          }}
        >
          DS Racing Karts
        </div>

        {/* Product name (or generic placeholder) */}
        {name ? (
          <div
            style={{
              fontSize: name.length > 50 ? 56 : 72,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              lineHeight: 1.1,
              padding: "0 80px",
              textAlign: "center",
              maxWidth: 1080,
              display: "flex",
            }}
          >
            {name}
          </div>
        ) : (
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            Image Coming Soon
          </div>
        )}

        {/* Red separator */}
        <div
          style={{
            width: 160,
            height: 4,
            backgroundColor: "#e60012",
            marginTop: 40,
            marginBottom: 24,
          }}
        />

        {/* Bottom tagline */}
        <div
          style={{
            fontSize: 22,
            color: "#9a9a9a",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          {name ? "Image Coming Soon" : "Go Kart Parts & Service"}
        </div>

        {/* Bottom red line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundColor: "#e60012",
          }}
        />
      </div>
    ),
    {
      ...SIZE,
      headers: {
        // Cache at the edge for a day. Updates land on next sync anyway.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    }
  );
}
