/**
 * StreamingOverlay - Main overlay container for streaming mode
 *
 * Displays:
 * - Duel info panel (top center)
 * - Agent HP bars (bottom)
 * - Leaderboard (left side)
 * - Countdown timer
 * - Victory announcement
 */

import React, { useEffect, useState, useRef } from "react";
import type { StreamingState } from "../../screens/StreamingMode";
import { AgentStatsDisplay } from "./AgentStatsDisplay";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { CountdownOverlay } from "./CountdownOverlay";
import { VictoryOverlay } from "./VictoryOverlay";

// Delay before showing victory overlay during RESOLUTION phase (ms).
// Short delay for dramatic effect - text appears as winner starts celebrating.
// Victory overlay is now transparent (no card) so characters are visible behind it.
const VICTORY_OVERLAY_DELAY_MS = 500;

/** How long the "FIGHT!" text lingers after the countdown ends (ms). */
const FIGHT_TEXT_LINGER_MS = 2500;

interface StreamingOverlayProps {
  state: StreamingState | null;
}

export function StreamingOverlay({ state }: StreamingOverlayProps) {
  const [showVictory, setShowVictory] = useState(false);
  const victoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track when the FIGHTING phase starts so the "FIGHT!" text can linger
  const [showFightText, setShowFightText] = useState(false);
  const fightTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phase = state?.cycle?.phase;

  useEffect(() => {
    if (phase === "RESOLUTION") {
      victoryTimerRef.current = setTimeout(() => {
        setShowVictory(true);
      }, VICTORY_OVERLAY_DELAY_MS);
    } else {
      setShowVictory(false);
      if (victoryTimerRef.current) {
        clearTimeout(victoryTimerRef.current);
        victoryTimerRef.current = null;
      }
    }
    return () => {
      if (victoryTimerRef.current) {
        clearTimeout(victoryTimerRef.current);
        victoryTimerRef.current = null;
      }
    };
  }, [phase]);

  // When transitioning to FIGHTING, keep the fight text visible for a linger period
  useEffect(() => {
    if (phase === "FIGHTING") {
      setShowFightText(true);
      fightTextTimerRef.current = setTimeout(() => {
        setShowFightText(false);
      }, FIGHT_TEXT_LINGER_MS);
    } else if (phase !== "COUNTDOWN") {
      setShowFightText(false);
      if (fightTextTimerRef.current) {
        clearTimeout(fightTextTimerRef.current);
        fightTextTimerRef.current = null;
      }
    }
    return () => {
      if (fightTextTimerRef.current) {
        clearTimeout(fightTextTimerRef.current);
        fightTextTimerRef.current = null;
      }
    };
  }, [phase]);

  if (!state) {
    return (
      <div style={styles.waitingContainer}>
        <div style={styles.waitingText}>Waiting for duel data...</div>
      </div>
    );
  }

  const { cycle, leaderboard } = state;
  const {
    agent1,
    agent2,
    countdown,
    winnerId,
    winnerName,
    winReason,
    timeRemaining,
  } = cycle;

  // Get winner agent info
  const winnerAgent =
    winnerId === agent1?.id ? agent1 : winnerId === agent2?.id ? agent2 : null;

  return (
    <div style={styles.overlay}>
      {/* Duel Info - Top Center */}
      {(phase === "FIGHTING" || phase === "COUNTDOWN") && agent1 && agent2 && (
        <div style={styles.duelInfoContainer}>
          <AgentStatsDisplay agent={agent1} side="left" />
          <div style={styles.timerContainer}>
            <div style={styles.timerHexOuter}>
              <div style={styles.timerHexInner}>
                <div style={styles.timerHighlight} />
                {formatTime(timeRemaining)}
              </div>
              <div style={styles.timerInsetShadow} />
            </div>
          </div>
          <AgentStatsDisplay agent={agent2} side="right" />
        </div>
      )}

      {/* Next duel countdown - shown when no active fight */}
      {(phase === "IDLE" ||
        phase === "ANNOUNCEMENT" ||
        phase === "RESOLUTION") && (
        <div style={styles.nextDuelTimerContainer}>
          <div style={styles.nextDuelLabel}>NEXT DUEL</div>
          <div style={styles.nextDuelTimer}>
            {timeRemaining > 0 ? formatTime(timeRemaining) : "--:--"}
          </div>
        </div>
      )}

      {/* Countdown Overlay — stays mounted during early FIGHTING for "FIGHT!" linger */}
      {((phase === "COUNTDOWN" && cycle.fightStartTime != null) ||
        (phase === "FIGHTING" &&
          showFightText &&
          cycle.fightStartTime != null)) && (
        <CountdownOverlay fightStartTime={cycle.fightStartTime} />
      )}

      {/* Victory Overlay — delayed so death animation plays first */}
      {phase === "RESOLUTION" && showVictory && winnerAgent && (
        <VictoryOverlay
          winner={winnerAgent}
          winReason={winReason || "victory"}
        />
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    zIndex: 50,
  },
  waitingContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 50,
  },
  waitingText: {
    color: "#f2d08a",
    fontSize: "1.5rem",
    textShadow: "0 2px 4px rgba(0,0,0,0.8)",
  },
  leaderboardContainer: {
    position: "absolute",
    top: "80px",
    left: "20px",
    pointerEvents: "auto",
  },
  duelInfoContainer: {
    position: "absolute",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    width: "min(1200px, calc(100vw - 40px))",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: 42,
  },
  timerHexOuter: {
    minWidth: 164,
    height: 52,
    position: "relative",
    padding: 1,
    clipPath: "polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.1) 100%)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.45), 0 0 14px rgba(96,165,250,0.14)",
  },
  timerHexInner: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(232,243,255,0.95)",
    fontSize: "clamp(1.28rem, 2.7vw, 2rem)",
    fontWeight: 900,
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: 1.2,
    textShadow: "0 0 12px rgba(96,165,250,0.25)",
    background:
      "linear-gradient(180deg, rgba(10,12,18,0.9) 0%, rgba(10,12,18,0.76) 100%)",
    clipPath: "polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)",
    backdropFilter: "blur(14px) saturate(1.2)",
    WebkitBackdropFilter: "blur(14px) saturate(1.2)",
    position: "relative",
    overflow: "hidden",
  },
  timerHighlight: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    background:
      "linear-gradient(90deg, transparent, rgba(191,219,254,0.45), transparent)",
  },
  timerInsetShadow: {
    position: "absolute",
    inset: 0,
    clipPath: "polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
    pointerEvents: "none",
  },
  nextDuelTimerContainer: {
    position: "absolute",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "rgba(0, 0, 0, 0.6)",
    padding: "12px 28px",
    borderRadius: "8px",
    border: "2px solid rgba(242, 208, 138, 0.5)",
  },
  nextDuelLabel: {
    color: "#f2d08a",
    fontSize: "0.75rem",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "2px",
    marginBottom: "4px",
  },
  nextDuelTimer: {
    color: "#fff",
    fontSize: "2rem",
    fontWeight: "bold",
    fontFamily: "monospace",
    textShadow: "0 2px 4px rgba(0,0,0,0.8)",
  },
};
