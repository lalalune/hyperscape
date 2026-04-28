import { describe, expect, it } from "vitest";
import type { StreamingState } from "../../../src/screens/StreamingMode";
import { shouldReuseStreamingState } from "../../../src/screens/StreamingMode";

function createStreamingState(
  overrides: Partial<StreamingState["cycle"]> = {},
): StreamingState {
  return {
    type: "STREAMING_STATE_UPDATE",
    cycle: {
      cycleId: "cycle-1",
      duelId: "duel-1",
      phase: "ANNOUNCEMENT",
      cycleStartTime: 1_000,
      phaseStartTime: 1_000,
      phaseEndTime: 61_000,
      timeRemaining: 51_000,
      agent1: {
        id: "a",
        name: "Agent A",
        provider: "provider",
        model: "model",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 1,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      agent2: {
        id: "b",
        name: "Agent B",
        provider: "provider",
        model: "model",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 2,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      betOpenTime: 1_000,
      betCloseTime: 61_000,
      countdown: null,
      fightStartTime: null,
      arenaPositions: {
        agent1: [1, 0, 1],
        agent2: [3, 0, 3],
      },
      winnerId: null,
      winnerName: null,
      winReason: null,
      ...overrides,
    },
    leaderboard: [],
    cameraTarget: null,
  };
}

describe("shouldReuseStreamingState", () => {
  it("re-renders when announcement timing anchors change even if timeRemaining stays pinned", () => {
    const prev = createStreamingState({
      phase: "ANNOUNCEMENT",
      phaseEndTime: 61_000,
      betCloseTime: 61_000,
      timeRemaining: 0,
    });
    const next = createStreamingState({
      phase: "ANNOUNCEMENT",
      phaseEndTime: 121_000,
      betCloseTime: 121_000,
      timeRemaining: 0,
    });

    expect(shouldReuseStreamingState(prev, next)).toBe(false);
  });

  it("still reuses frames when both combat state and timing anchors are unchanged", () => {
    const prev = createStreamingState();
    const next = createStreamingState();

    expect(shouldReuseStreamingState(prev, next)).toBe(true);
  });
});
