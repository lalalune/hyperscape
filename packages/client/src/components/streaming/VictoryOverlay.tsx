/**
 * VictoryOverlay - Big "SO_AND_SO WINS!" text display
 *
 * Styled like the FIGHT! countdown text - large, bold text with glow effect,
 * no black card background so characters are visible celebrating behind it.
 */

import React, { useEffect, useRef } from "react";
import type { AgentInfo } from "../../screens/StreamingMode";

function formatWinReason(raw: string): string {
  switch (raw) {
    case "hp_advantage":
      return "by HP advantage";
    case "damage_advantage":
      return "by damage dealt";
    case "timeout":
    case "time_limit":
      return "by timeout";
    case "knockout":
    case "death":
    case "killed":
      return "by knockout";
    case "draw":
      return "Draw!";
    default:
      return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

interface VictoryOverlayProps {
  winner: AgentInfo;
  winReason: string;
  loser?: AgentInfo | null;
  /** Pre-formatted line for viewers (e.g. "Knockout — HP reached zero.") */
  winReasonLine?: string | null;
}

export function VictoryOverlay({
  winner,
  winReason,
  loser = null,
  winReasonLine,
}: VictoryOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger pulse animation on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.classList.remove("victory-pulse");
      void el.offsetWidth; // Force reflow
      el.classList.add("victory-pulse");
    }
  }, [winner.id]);

  return (
    <div style={styles.container}>
      <div ref={containerRef} className="victory-pulse" style={styles.content}>
        <div style={styles.winnerName}>{winner.name}</div>
        <div style={styles.winsText}>
          {winReason === "draw" ? "DRAW!" : "WINS!"}
        </div>
        {loser && winReason !== "draw" ? (
          <div style={styles.defeatedLine}>
            defeated <span style={styles.loserName}>{loser.name}</span>
          </div>
        ) : null}
        {winReasonLine || winReason ? (
          <div style={styles.reasonLine}>
            {winReasonLine ?? formatWinReason(winReason)}
          </div>
        ) : null}
      </div>

      <style>
        {`
          .victory-pulse {
            animation: victoryPulse 0.6s ease-out;
          }

          @keyframes victoryPulse {
            0% { transform: scale(0.5); opacity: 0; }
            60% { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 60,
    pointerEvents: "none",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0px",
  },
  winnerName: {
    color: "#f2d08a",
    fontSize: "clamp(2.5rem, 10vw, 6rem)",
    fontWeight: "bold",
    fontFamily: "Impact, sans-serif",
    letterSpacing: "2px",
    textTransform: "uppercase",
    textShadow:
      "0 0 40px rgba(242,208,138,0.8), 0 0 80px rgba(242,208,138,0.4), 0 4px 8px rgba(0,0,0,0.8)",
    lineHeight: 1.1,
    textAlign: "center",
    maxWidth: "min(95vw, 1200px)",
    padding: "0 12px",
  },
  winsText: {
    color: "#ff6b6b",
    fontSize: "clamp(3.2rem, 12vw, 8rem)",
    fontWeight: "bold",
    fontFamily: "Impact, sans-serif",
    letterSpacing: "-2px",
    textShadow:
      "0 0 40px rgba(255,107,107,0.8), 0 0 80px rgba(255,107,107,0.4), 0 4px 8px rgba(0,0,0,0.8)",
    lineHeight: 1,
  },
  reasonLine: {
    marginTop: "0.35em",
    maxWidth: "min(90vw, 560px)",
    padding: "0 20px",
    textAlign: "center",
    fontSize: "clamp(0.85rem, 2.2vw, 1.1rem)",
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "rgba(226, 232, 240, 0.95)",
    textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 20px rgba(96,165,250,0.12)",
    lineHeight: 1.35,
  },
  defeatedLine: {
    color: "rgba(200, 200, 210, 0.72)",
    fontSize: "clamp(1rem, 3vw, 2rem)",
    fontWeight: 700,
    fontFamily: "Impact, sans-serif",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textShadow: "0 2px 6px rgba(0,0,0,0.8)",
    lineHeight: 1.2,
    marginTop: "0.2em",
  },
  loserName: {
    color: "rgba(255, 255, 255, 0.92)",
  },
};
