import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "$GOLD Token - Hyperia";
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
            fontSize: 80,
          }}
        >
          $GOLD Token
        </span>
        <span
          style={{
            fontFamily: "system-ui",
            color: "#c4b896",
            fontSize: 28,
            textAlign: "center",
            maxWidth: 600,
          }}
        >
          1 $GOLD = 1 gold in-game
        </span>
      </div>
    </div>,
    { ...size },
  );
}
