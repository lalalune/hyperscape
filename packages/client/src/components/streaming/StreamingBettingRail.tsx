/**
 * StreamingBettingRail — Public stream CTA for parimutuel / prediction betting.
 *
 * Shown when STREAMING_PUBLIC_BET_URL (or client override) is configured.
 * pointer-events: auto only on the link; rest of overlay stays non-interactive.
 */

import React, { useMemo } from "react";
import type { StreamCountdownHoldState } from "./streamCountdown";

export interface StreamingBettingConfig {
  betUrl: string | null;
  bettingBridgeEnabled: boolean;
  hint?: string | null;
}

function buildBetHref(base: string, duelId: string | null): string {
  if (!duelId) return base;
  try {
    const u = new URL(base, window.location.href);
    u.searchParams.set("duel", duelId);
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}duel=${encodeURIComponent(duelId)}`;
  }
}

interface StreamingBettingRailProps {
  config: StreamingBettingConfig | null;
  phase: string | undefined;
  duelId: string | null | undefined;
  agent1Name: string | null | undefined;
  agent2Name: string | null | undefined;
  countdownText: string;
  countdownHoldState: StreamCountdownHoldState;
}

export function StreamingBettingRail({
  config,
  phase,
  duelId,
  agent1Name,
  agent2Name,
  countdownText,
  countdownHoldState,
}: StreamingBettingRailProps) {
  const betUrl = config?.betUrl?.trim() || null;
  const hasMatchup = Boolean(agent1Name && agent2Name);

  const href = useMemo(
    () => (betUrl ? buildBetHref(betUrl, duelId ?? null) : ""),
    [betUrl, duelId],
  );

  if (!betUrl || !hasMatchup) return null;

  if (phase === "IDLE") return null;

  const title = `${agent1Name} vs ${agent2Name}`;

  let headline = "Spectate";
  let sub = "Betting link is live for this matchup.";
  let urgency: "open" | "locked" | "done" = "open";

  if (phase === "ANNOUNCEMENT") {
    if (countdownHoldState === "preparing_arena") {
      headline = "Preparing arena";
      sub =
        "Wagers are closing while the arena readies for the live countdown.";
    } else {
      headline = "Betting open";
      sub = countdownText
        ? `Wagers lock when the fight countdown starts. Closes in ${countdownText}.`
        : "Wagers lock when the fight countdown starts.";
    }
    urgency = "open";
  } else if (phase === "COUNTDOWN" || phase === "FIGHTING") {
    headline = "Betting locked";
    sub = "Lines are closed — enjoy the fight.";
    urgency = "locked";
  } else if (phase === "RESOLUTION") {
    headline = "Fight over";
    sub = config?.bettingBridgeEnabled
      ? "On-chain markets resolve after the oracle reports — check your wallet for payouts."
      : "Thanks for watching — see you on the next card.";
    urgency = "done";
  }

  return (
    <aside
      className={`streaming-betting-rail streaming-betting-rail--${urgency}`}
    >
      <div className="streaming-betting-rail-eyebrow">Pick a side</div>
      <div className="streaming-betting-rail-title">{title}</div>
      <div className="streaming-betting-rail-headline">{headline}</div>
      <p className="streaming-betting-rail-sub">{sub}</p>
      <a
        className="streaming-betting-rail-cta"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {urgency === "open" ? "Place a bet" : "Open betting app"}
      </a>
      {config?.hint && urgency === "open" ? (
        <p className="streaming-betting-rail-hint">{config.hint}</p>
      ) : null}
    </aside>
  );
}
