import { describe, expect, it } from "vitest";
import type {
  RecentDuelEntry,
  StreamingTerminalNotice,
} from "../../systems/StreamingDuelScheduler/types.js";
import {
  derivePublicBettingAvailability,
  sanitizePublicRecentDuel,
  sanitizePublicOperationalMetrics,
  sanitizePublicTerminalNotice,
  toPublicCancellationReason,
} from "../streaming-public-presentation.js";

const makeNotice = (reason: string): StreamingTerminalNotice => ({
  cycleId: "cycle-1",
  duelId: null,
  outcome: "cancelled",
  reason,
  occurredAt: 100,
  expiresAt: 200,
  agent1Id: null,
  agent1Name: null,
  agent2Id: null,
  agent2Name: null,
});

const makeCancellation = (reason: string): RecentDuelEntry => ({
  cycleId: "cycle-1",
  duelId: null,
  finishedAt: 100,
  outcome: "cancelled",
  agent1Id: null,
  agent1Name: null,
  agent1OpeningStyle: null,
  agent2Id: null,
  agent2Name: null,
  agent2OpeningStyle: null,
  winnerId: null,
  winnerName: null,
  loserId: null,
  loserName: null,
  winReason: null,
  cancellationReason: reason,
  damageAgent1: 0,
  damageAgent2: 0,
  damageWinner: null,
  damageLoser: null,
});

describe("public cancellation presentation", () => {
  it("fails betting availability closed across every prerequisite", () => {
    expect(
      derivePublicBettingAvailability({
        betUrl: null,
        bettingBridgeEnabled: true,
        runtimeReady: true,
      }),
    ).toEqual({ ready: false, unavailableReason: "link_unconfigured" });
    expect(
      derivePublicBettingAvailability({
        betUrl: "https://bet.example",
        bettingBridgeEnabled: false,
        runtimeReady: true,
      }),
    ).toEqual({ ready: false, unavailableReason: "betting_disabled" });
    expect(
      derivePublicBettingAvailability({
        betUrl: "https://bet.example",
        bettingBridgeEnabled: true,
        runtimeReady: false,
      }),
    ).toEqual({ ready: false, unavailableReason: "stream_services_unready" });
    expect(
      derivePublicBettingAvailability({
        betUrl: "https://bet.example",
        bettingBridgeEnabled: true,
        runtimeReady: true,
      }),
    ).toEqual({ ready: true, unavailableReason: null });
  });

  it("maps internal reasons to a bounded viewer-safe vocabulary", () => {
    expect(toPublicCancellationReason("no_combat_activity_timeout")).toBe(
      "insufficient_verified_combat",
    );
    expect(toPublicCancellationReason("agents_missing_before_countdown")).toBe(
      "contestant_unavailable",
    );
    expect(toPublicCancellationReason("scheduler_shutdown")).toBe(
      "broadcast_interrupted",
    );
    expect(toPublicCancellationReason("internal_database_fault_code_52")).toBe(
      "no_contest",
    );
  });

  it("redacts terminal notices without mutating the scheduler object", () => {
    const internal = makeNotice("agents_missing_before_countdown");
    const publicNotice = sanitizePublicTerminalNotice(internal);

    expect(publicNotice?.reason).toBe("contestant_unavailable");
    expect(internal.reason).toBe("agents_missing_before_countdown");
  });

  it("redacts cancellation history and leaves decisive history unchanged", () => {
    const internal = makeCancellation("scheduler_shutdown");
    const publicDuel = sanitizePublicRecentDuel(internal);
    const win = { ...internal, outcome: "win" as const };

    expect(publicDuel.cancellationReason).toBe("broadcast_interrupted");
    expect(internal.cancellationReason).toBe("scheduler_shutdown");
    expect(sanitizePublicRecentDuel(win)).toBe(win);
  });

  it("aggregates operational reasons into the public vocabulary", () => {
    const sanitized = sanitizePublicOperationalMetrics({
      emittedAt: 100,
      historyWindow: {
        size: 3,
        maxSize: 200,
        wins: 0,
        draws: 0,
        completed: 0,
        cancelled: 3,
        terminal: 3,
        completionRate: 0,
        cancellationReasons: {
          agents_missing: 1,
          agent_disconnect: 1,
          internal_database_fault_code_52: 1,
        },
      },
      engagement: {
        checks: 0,
        retries: 0,
        recoveries: 0,
        failures: 0,
        proximityCorrections: 0,
        currentRetryCount: 0,
      },
      current: {
        cycleId: null,
        phase: "IDLE",
        firstHitLatencyMs: null,
        recoveryInProgress: false,
        schedulerState: "ACTIVE",
        availableAgents: 2,
        requiredAgents: 2,
        preparation: {
          enabled: true,
          gateInFlight: false,
          selectionInFlight: false,
          status: "ready",
          expiresAt: 1_000,
        },
      },
    });

    expect(sanitized.historyWindow.cancellationReasons).toEqual({
      contestant_unavailable: 2,
      no_contest: 1,
    });
  });
});
