import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime = "edge";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#e60012",
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: "-0.05em",
          borderTop: "3px solid #e60012",
        }}
      >
        DSR
      </div>
    ),
    { ...size }
  );
}
