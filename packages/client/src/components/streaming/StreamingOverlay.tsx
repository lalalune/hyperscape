/**
 * StreamingOverlay - Main overlay container for streaming mode
 *
 * Displays:
 * - Duel info panel (top center)
 * - Agent HP bars (bottom)
 * - Leaderboard (left)
 * - Lower third (brand + live status for viewers)
 * - Countdown timer
 * - Victory announcement
 */

import React, { useEffect, useState, useRef } from "react";
import type { StreamingState } from "../../screens/StreamingMode";
import { AgentStatsDisplay } from "./AgentStatsDisplay";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { CountdownOverlay } from "./CountdownOverlay";
import { VictoryOverlay } from "./VictoryOverlay";
import { PostFightStatsCard } from "./PostFightStatsCard";
import {
  StreamingBettingRail,
  type StreamingBettingConfig,
} from "./StreamingBettingRail";
import { CombatLog } from "./CombatLog";
import "./StreamingOverlay.css";

// Delay before showing victory overlay during RESOLUTION phase (ms).
// Short delay for dramatic effect - text appears as winner starts celebrating.
// Victory overlay is now transparent (no card) so characters are visible behind it.
const VICTORY_OVERLAY_DELAY_MS = 500;

/** How long the "FIGHT!" text lingers after the countdown ends (ms). */
const FIGHT_TEXT_LINGER_MS = 2500;

interface StreamingOverlayProps {
  state: StreamingState | null;
  /** From GET /api/streaming/betting — public bet link for viewers */
  bettingConfig?: StreamingBettingConfig | null;
}

export function StreamingOverlay({
  state,
  bettingConfig = null,
}: StreamingOverlayProps) {
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
      <div className="streaming-overlay-root">
        <div className="streaming-waiting">
          <div className="streaming-waiting-eyebrow">Live stream</div>
          <div className="streaming-waiting-title">Connecting to arena</div>
          <div className="streaming-waiting-sub">
            Duel overlay will appear when the broadcast is ready.
          </div>
          <div className="streaming-waiting-shimmer" aria-hidden />
        </div>
      </div>
    );
  }

  const { cycle, leaderboard } = state;
  const {
    agent1,
    agent2,
    winnerId,
    winnerName,
    winReason,
    timeRemaining,
    duelId,
  } = cycle;

  // Get winner agent info
  const winnerAgent =
    winnerId === agent1?.id ? agent1 : winnerId === agent2?.id ? agent2 : null;

  const hasMatchup = Boolean(agent1 && agent2);
  const showActiveFightHud =
    (phase === "FIGHTING" || phase === "COUNTDOWN") && hasMatchup;

  const showBetweenMatchupStrip =
    hasMatchup &&
    (phase === "IDLE" || phase === "ANNOUNCEMENT" || phase === "RESOLUTION") &&
    !showActiveFightHud;

  const interstitialCopy = (() => {
    switch (phase) {
      case "IDLE":
        return {
          eyebrow: "Arena",
          title: "Stand by",
          sub: "Pairing the next warriors and staging the ring.",
        };
      case "ANNOUNCEMENT":
        return {
          eyebrow: "Coming up",
          title: "Next duel loading",
          sub: "Contestants are entering the arena.",
        };
      case "RESOLUTION":
        return {
          eyebrow: "Round complete",
          title: winnerName ? `${winnerName}` : "Victory",
          sub: winReason
            ? formatWinReason(winReason)
            : "Winner decided — next bout lines up shortly.",
        };
      default:
        return {
          eyebrow: "Intermission",
          title: "Hyperia duels",
          sub: "",
        };
    }
  })();

  const matchupLine =
    agent1 && agent2 ? `${agent1.name} vs ${agent2.name}` : null;

  const showCombatLog =
    phase === "FIGHTING" || phase === "COUNTDOWN" || phase === "RESOLUTION";

  return (
    <div className="streaming-overlay-root" style={styles.overlay}>
      {/* Left panel: combat log during a fight, leaderboard during intermission */}
      {showCombatLog ? (
        <CombatLog state={state} />
      ) : (
        <aside className="streaming-leaderboard-mount">
          <LeaderboardPanel leaderboard={leaderboard} />
        </aside>
      )}

      <StreamingBettingRail
        config={bettingConfig}
        phase={phase}
        duelId={duelId ?? null}
        agent1Name={agent1?.name}
        agent2Name={agent2?.name}
        timeRemainingMs={timeRemaining}
      />

      {/* Duel Info - Top Center (live fight + countdown to first swing) */}
      {showActiveFightHud && agent1 && agent2 && (
        <div style={styles.duelInfoContainer}>
          <AgentStatsDisplay agent={agent1} side="left" />
          <div style={styles.timerContainer}>
            <span className="streaming-fight-timer-eyebrow">Round timer</span>
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

      {/* Between phases: keep fighter cards when we know the matchup */}
      {showBetweenMatchupStrip && agent1 && agent2 && (
        <div className="streaming-between-strip">
          <div
            className={
              phase === "RESOLUTION" && winnerId && winnerId !== agent1.id
                ? "streaming-between-agents-muted"
                : phase === "RESOLUTION" && winnerId === agent1.id
                  ? "streaming-between-agents-winner"
                  : ""
            }
          >
            <AgentStatsDisplay agent={agent1} side="left" />
          </div>
          <div className="streaming-between-center">
            <span className="streaming-between-eyebrow">
              {phase === "RESOLUTION"
                ? "Winner"
                : phase === "ANNOUNCEMENT"
                  ? "Matchup set"
                  : "Up next"}
            </span>
            <span className="streaming-between-title">
              {phase === "RESOLUTION" && winnerName
                ? winnerName
                : `${agent1.name} vs ${agent2.name}`}
            </span>
            <div className="streaming-between-timer-wrap">
              <div className="streaming-between-timer-inner">
                {timeRemaining > 0 ? formatTime(timeRemaining) : "—"}
              </div>
            </div>
            <span
              style={{
                marginTop: 6,
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(148, 163, 184, 0.9)",
              }}
            >
              {phase === "RESOLUTION" ? "Next duel" : "Starts in"}
            </span>
          </div>
          <div
            className={
              phase === "RESOLUTION" && winnerId && winnerId !== agent2.id
                ? "streaming-between-agents-muted"
                : phase === "RESOLUTION" && winnerId === agent2.id
                  ? "streaming-between-agents-winner"
                  : ""
            }
          >
            <AgentStatsDisplay agent={agent2} side="right" />
          </div>
        </div>
      )}

      {/* No lineup yet, or resolution without both cards — full interstitial */}
      {(phase === "IDLE" ||
        phase === "ANNOUNCEMENT" ||
        phase === "RESOLUTION") &&
        !showBetweenMatchupStrip && (
          <div className="streaming-interstitial">
            <span className="streaming-interstitial-eyebrow">
              {interstitialCopy.eyebrow}
            </span>
            <span className="streaming-interstitial-title">
              {interstitialCopy.title}
            </span>
            {interstitialCopy.sub ? (
              <span className="streaming-interstitial-sub">
                {interstitialCopy.sub}
              </span>
            ) : null}
            <div className="streaming-interstitial-rule" />
            <div className="streaming-interstitial-timer">
              {timeRemaining > 0 ? formatTime(timeRemaining) : "—"}
            </div>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(148, 163, 184, 0.85)",
              }}
            >
              {phase === "RESOLUTION" ? "Next round" : "Time to ring"}
            </span>
          </div>
        )}

      {/* Countdown Overlay — stays mounted during early FIGHTING for "FIGHT!" linger */}
      {((phase === "COUNTDOWN" && cycle.fightStartTime != null) ||
        (phase === "FIGHTING" &&
          showFightText &&
          cycle.fightStartTime != null)) && (
        <CountdownOverlay
          fightStartTime={cycle.fightStartTime}
          matchupLine={matchupLine}
        />
      )}

      {/* Victory Overlay — delayed so death animation plays first */}
      {phase === "RESOLUTION" && showVictory && winnerAgent && (
        <VictoryOverlay
          winner={winnerAgent}
          winReason={winReason || "victory"}
          winReasonLine={formatWinReason(winReason || "victory")}
        />
      )}

      {/* Post-fight stat card — appears alongside victory text during RESOLUTION */}
      {phase === "RESOLUTION" &&
        showVictory &&
        winnerId &&
        agent1 &&
        agent2 && (
          <div style={statCardPositionStyle}>
            <PostFightStatsCard
              agent1={agent1}
              agent2={agent2}
              winnerId={winnerId}
              winReason={winReason || "kill"}
            />
          </div>
        )}

      <footer className="streaming-lower-third">
        <div className="streaming-lower-third-brand">
          <span className="streaming-lower-third-mark">Hyperia</span>
          <span className="streaming-lower-third-divider" aria-hidden>
            ·
          </span>
          <span className="streaming-lower-third-sub">AI duel arena</span>
        </div>
        <p className="streaming-lower-third-status">
          {publicStreamStatusLine(phase, hasMatchup, bettingConfig)}
        </p>
      </footer>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** One line for the lower-third bar (OBS-friendly, readable at a glance). */
function publicStreamStatusLine(
  phase: StreamingState["cycle"]["phase"] | undefined,
  hasMatchup: boolean,
  betting: StreamingBettingConfig | null,
): string {
  switch (phase) {
    case "IDLE":
      return hasMatchup
        ? "Matchup locked — ring opens soon"
        : "Pairing the next warriors";
    case "ANNOUNCEMENT":
      if (betting?.betUrl && hasMatchup) {
        return "Betting open on this matchup — pick a side before the bell.";
      }
      return "Fighters heading to the arena";
    case "COUNTDOWN":
      return "Get ready — combat starts after countdown";
    case "FIGHTING":
      return "Live — round in progress";
    case "RESOLUTION":
      if (betting?.bettingBridgeEnabled && betting?.betUrl) {
        return "Winner decided — on-chain payouts follow oracle settlement.";
      }
      return "Winner decided — next bout loading";
    default:
      return "Hyperia AI duels";
  }
}

/** Readable subtitle for victory overlay / interstitials */
function formatWinReason(reason: string): string {
  const r = reason.toLowerCase().replace(/_/g, " ");
  if (r.includes("forfeit")) return "Win by forfeit.";
  if (r.includes("ko") || r.includes("knock"))
    return "Knockout — HP reached zero.";
  if (r.includes("timeout") || r.includes("time"))
    return "Time expired — judges called it.";
  if (r.includes("draw")) return "Draw — no victor this round.";
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

/** Position the stat card below center, below the victory text */
const statCardPositionStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "18%",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 61,
  pointerEvents: "none",
};

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
};
