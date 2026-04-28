import type { StreamingState } from "../../screens/StreamingMode";

export type StreamCountdownHoldState = "preparing_arena" | "starting" | null;

export interface StreamCountdownDisplay {
  text: string;
  kind: "timer" | "hold" | "none";
  holdState: StreamCountdownHoldState;
  label: string;
  remainingMs: number | null;
}

export interface ResolveStreamCountdownDisplayInputs {
  phase: StreamingState["cycle"]["phase"] | undefined;
  betCloseTime?: number | null;
  fightStartTime?: number | null;
  fallbackTimeRemainingMs?: number | null;
  nowMs?: number;
}

function formatTimeCeil(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function resolveStreamCountdownDisplay(
  inputs: ResolveStreamCountdownDisplayInputs,
): StreamCountdownDisplay {
  const {
    phase,
    betCloseTime = null,
    fightStartTime = null,
    fallbackTimeRemainingMs = null,
    nowMs = Date.now(),
  } = inputs;

  const targetTimeMs =
    phase === "ANNOUNCEMENT"
      ? betCloseTime
      : phase === "COUNTDOWN"
        ? fightStartTime
        : null;

  if (targetTimeMs != null && Number.isFinite(targetTimeMs)) {
    const remainingMs = Math.max(0, targetTimeMs - nowMs);
    if (remainingMs > 0) {
      return {
        text: formatTimeCeil(remainingMs),
        kind: "timer",
        holdState: null,
        label:
          phase === "ANNOUNCEMENT"
            ? "Betting closes"
            : phase === "COUNTDOWN"
              ? "Fight starts"
              : "Timer",
        remainingMs,
      };
    }

    if (phase === "ANNOUNCEMENT") {
      return {
        text: "__:__",
        kind: "hold",
        holdState: "preparing_arena",
        label: "",
        remainingMs: 0,
      };
    }

    if (phase === "COUNTDOWN") {
      return {
        text: "Starting...",
        kind: "hold",
        holdState: "starting",
        label: "Starting...",
        remainingMs: 0,
      };
    }
  }

  if (
    fallbackTimeRemainingMs != null &&
    Number.isFinite(fallbackTimeRemainingMs) &&
    fallbackTimeRemainingMs > 0
  ) {
    return {
      text: formatTimeCeil(fallbackTimeRemainingMs),
      kind: "timer",
      holdState: null,
      label:
        phase === "FIGHTING"
          ? "Round timer"
          : phase === "RESOLUTION"
            ? "Next round"
            : "Timer",
      remainingMs: fallbackTimeRemainingMs,
    };
  }

  return {
    text: "",
    kind: "none",
    holdState: null,
    label: "",
    remainingMs: fallbackTimeRemainingMs,
  };
}
