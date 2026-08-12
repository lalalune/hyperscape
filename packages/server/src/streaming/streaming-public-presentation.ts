import type {
  RecentDuelEntry,
  StreamingDuelOperationalMetrics,
  StreamingTerminalNotice,
} from "../systems/StreamingDuelScheduler/types.js";

export type PublicCancellationReason =
  | "insufficient_verified_combat"
  | "contestant_unavailable"
  | "broadcast_interrupted"
  | "no_contest";

export type PublicBettingAvailability = {
  ready: boolean;
  unavailableReason:
    "link_unconfigured" | "betting_disabled" | "stream_services_unready" | null;
};

export function derivePublicBettingAvailability(input: {
  betUrl: string | null;
  bettingBridgeEnabled: boolean;
  runtimeReady: boolean;
}): PublicBettingAvailability {
  if (!input.betUrl) {
    return { ready: false, unavailableReason: "link_unconfigured" };
  }
  if (!input.bettingBridgeEnabled) {
    return { ready: false, unavailableReason: "betting_disabled" };
  }
  if (!input.runtimeReady) {
    return { ready: false, unavailableReason: "stream_services_unready" };
  }
  return { ready: true, unavailableReason: null };
}

/** Collapse internal cancellation tokens into a small viewer-safe vocabulary. */
export function toPublicCancellationReason(
  reason: string,
): PublicCancellationReason {
  const normalized = reason.toLowerCase();
  if (normalized.includes("no_combat_activity")) {
    return "insufficient_verified_combat";
  }
  if (
    normalized.includes("missing") ||
    normalized.includes("lost") ||
    normalized.includes("disconnect")
  ) {
    return "contestant_unavailable";
  }
  if (normalized.includes("shutdown")) {
    return "broadcast_interrupted";
  }
  return "no_contest";
}

export function sanitizePublicTerminalNotice(
  notice: StreamingTerminalNotice | null,
): StreamingTerminalNotice | null {
  if (!notice) return null;
  return {
    ...notice,
    reason: toPublicCancellationReason(notice.reason),
  };
}

export function sanitizePublicRecentDuel(
  duel: RecentDuelEntry,
): RecentDuelEntry {
  if (duel.outcome !== "cancelled" || !duel.cancellationReason) return duel;
  return {
    ...duel,
    cancellationReason: toPublicCancellationReason(duel.cancellationReason),
  };
}

export function sanitizePublicOperationalMetrics(
  metrics: StreamingDuelOperationalMetrics,
): StreamingDuelOperationalMetrics {
  const cancellationReasons: Record<string, number> = {};
  for (const [reason, count] of Object.entries(
    metrics.historyWindow.cancellationReasons,
  )) {
    const publicReason = toPublicCancellationReason(reason);
    cancellationReasons[publicReason] =
      (cancellationReasons[publicReason] ?? 0) + count;
  }
  return {
    ...metrics,
    historyWindow: {
      ...metrics.historyWindow,
      cancellationReasons,
    },
  };
}
