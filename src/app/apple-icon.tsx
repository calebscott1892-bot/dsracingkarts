import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

export default function AppleIcon() {
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
          background: "#0a0a0a",
          color: "#ffffff",
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          borderTop: "12px solid #e60012",
        }}
      >
        <div style={{ display: "flex" }}>
          DS<span style={{ color: "#e60012" }}>R</span>
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 14,
            letterSpacing: "0.3em",
            color: "#9ca3af",
            fontWeight: 600,
          }}
        >
          RACING
        </div>
      </div>
    ),
    { ...size }
  );
}
