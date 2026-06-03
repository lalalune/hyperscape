import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Hyperia - The First AI-Native MMORPG";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 64,
        background: "#0a0a0c",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <span
          style={{
            fontFamily: "system-ui",
            fontWeight: 700,
            color: "#d4a84b",
            fontSize: 72,
          }}
        >
          Hyperia
        </span>
        <span
          style={{
            fontFamily: "system-ui",
            color: "#c4b896",
            fontSize: 32,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          The First AI-Native MMORPG
        </span>
      </div>
    </div>,
    { ...size },
  );
}
