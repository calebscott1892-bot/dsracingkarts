import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DS Racing Karts — Go Kart Parts & Service | Sydney";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          position: "relative",
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

        {/* Main title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          DS RACING KARTS
        </div>

        {/* Red separator line */}
        <div
          style={{
            width: 120,
            height: 4,
            backgroundColor: "#e60012",
            marginTop: 32,
            marginBottom: 32,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "#e60012",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Go Kart Parts & Service | Sydney
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
    { ...size }
  );
}
