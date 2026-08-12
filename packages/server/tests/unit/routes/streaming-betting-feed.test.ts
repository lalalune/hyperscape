import { describe, it, expect } from "vitest";
import {
  buildBettingFeedDedupKey,
  buildBettingFeedPayload,
  selectReplayDelivery,
} from "../../../src/routes/streaming-betting-feed.js";
import type { BettingFeedFrame } from "../../../src/routes/streaming-betting-feed.js";
import type { StreamingDuelCycle } from "../../../src/systems/StreamingDuelScheduler/types.js";

function createCycle(
  overrides: Partial<StreamingDuelCycle> = {},
): StreamingDuelCycle {
  return {
    cycleId: "cycle-1",
    phase: "ANNOUNCEMENT",
    cycleStartTime: 1_000,
    phaseStartTime: 1_000,
    phaseVersion: 2,
    agent1: {
      characterId: "agent-a",
      name: "Agent A",
      provider: "provider-a",
      model: "model-a",
      combatLevel: 10,
      wins: 7,
      losses: 2,
      currentHp: 25,
      maxHp: 30,
      originalPosition: [1, 2, 3],
      damageDealtThisFight: 4,
      equipment: {},
      inventory: [],
      rank: 1,
      headToHeadWins: 3,
      headToHeadLosses: 1,
    },
    agent2: {
      characterId: "agent-b",
      name: "Agent B",
      provider: "provider-b",
      model: "model-b",
      combatLevel: 11,
      wins: 5,
      losses: 4,
      currentHp: 20,
      maxHp: 30,
      originalPosition: [4, 5, 6],
      damageDealtThisFight: 2,
      equipment: {},
      inventory: [],
      rank: 2,
      headToHeadWins: 1,
      headToHeadLosses: 3,
    },
    duelId: "duel-1",
    duelKeyHex: "0xabcdef",
    arenaId: null,
    betOpenTime: 1_000,
    betCloseTime: 2_000,
    countdownValue: null,
    fightStartTime: null,
    duelEndTime: null,
    arenaPositions: {
      agent1: [10, 11, 12],
      agent2: [20, 21, 22],
    },
    winnerId: null,
    loserId: null,
    outcome: null,
    winReason: null,
    seed: null,
    replayHash: null,
    ...overrides,
  };
}

function createFrame(seq: number): BettingFeedFrame {
  const payload = buildBettingFeedPayload({
    sourceEpoch: 9_999,
    seq,
    emittedAt: 10_000 + seq,
    rendererHealth: {
      ready: seq % 2 === 0,
      degradedReason: seq % 2 === 0 ? null : "loading_overlay_active",
      updatedAt: 10_500 + seq,
    },
    cycle: createCycle({
      phaseVersion: seq,
      winnerId: seq % 2 === 0 ? "agent-a" : "agent-b",
      duelEndTime: seq % 2 === 0 ? 20_000 : 21_000,
      winReason: seq % 2 === 0 ? "kill" : "hp_advantage",
    }),
  });
  return {
    seq,
    emittedAt: 10_000 + seq,
    payload,
    payloadJson: JSON.stringify(payload),
    payloadBytes: 0,
  };
}

describe("streaming-betting-feed", () => {
  it("builds betting payloads with stable schema and phase version data", () => {
    const payload = buildBettingFeedPayload({
      sourceEpoch: 42,
      seq: 7,
      emittedAt: 123_456,
      rendererHealth: {
        ready: false,
        degradedReason: "loading_overlay_active",
        updatedAt: 123_500,
      },
      cycle: createCycle({
        phase: "FIGHTING",
        phaseVersion: 9,
        winnerId: "agent-b",
        winReason: "damage_advantage",
      }),
    });

    expect(payload).toMatchObject({
      schemaVersion: 2,
      sourceEpoch: 42,
      seq: 7,
      emittedAt: 123_456,
      duelId: "duel-1",
      duelKey: "0xabcdef",
      phase: "FIGHTING",
      phaseVersion: 9,
      betOpenTime: 1_000,
      betCloseTime: 2_000,
      fightStartTime: null,
      duelEndTime: null,
      winnerId: "agent-b",
      winnerName: "Agent B",
      outcome: null,
      cancellationReason: null,
      winReason: "damage_advantage",
      seed: null,
      replayHash: null,
      arenaPositions: {
        agent1: [10, 11, 12],
        agent2: [20, 21, 22],
      },
      rendererHealth: {
        ready: false,
        degradedReason: "loading_overlay_active",
        updatedAt: 123_500,
      },
    });

    expect(payload.agent1?.id).toBe("agent-a");
    expect(payload.agent2?.hp).toBe(20);
  });

  it("builds a durable cancelled terminal payload from the captured cycle", () => {
    const payload = buildBettingFeedPayload({
      sourceEpoch: 42,
      seq: 8,
      emittedAt: 123_456,
      cycle: createCycle({ phase: "FIGHTING" }),
      terminal: {
        outcome: "cancelled",
        cancellationReason: "combat_engagement_failed",
        duelEndTime: 123_456,
      },
    });

    expect(payload).toMatchObject({
      schemaVersion: 2,
      duelId: "duel-1",
      duelKey: "0xabcdef",
      phase: "FIGHTING",
      duelEndTime: 123_456,
      winnerId: null,
      winnerName: null,
      outcome: "cancelled",
      cancellationReason: "combat_engagement_failed",
    });
  });

  it("selects replay, bootstrap, and reset delivery modes deterministically", () => {
    const frames = [createFrame(1), createFrame(2), createFrame(3)];

    expect(selectReplayDelivery(frames, 0)).toMatchObject({
      mode: "bootstrap",
      latestFrame: frames[2],
      oldestSeq: 1,
    });

    expect(selectReplayDelivery(frames, 2)).toMatchObject({
      mode: "replay",
      frames: [frames[2]],
      latestFrame: frames[2],
      oldestSeq: 1,
    });

    expect(selectReplayDelivery(frames, 3)).toMatchObject({
      mode: "live",
      latestFrame: frames[2],
      oldestSeq: 1,
    });

    expect(selectReplayDelivery(frames, 99)).toMatchObject({
      mode: "reset",
      latestFrame: frames[2],
      oldestSeq: 1,
    });
  });

  it("requests a reset when the replay gap is larger than the buffer", () => {
    const frames = [createFrame(10), createFrame(11), createFrame(12)];

    expect(selectReplayDelivery(frames, 2)).toMatchObject({
      mode: "reset",
      latestFrame: frames[2],
      oldestSeq: 10,
    });
  });

  it("deduplicates independently of emittedAt and renderer health timestamps", () => {
    const basePayload = buildBettingFeedPayload({
      sourceEpoch: 42,
      seq: 7,
      emittedAt: 123_456,
      cycle: createCycle(),
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 123_400,
      },
    });
    const laterPayload = {
      ...basePayload,
      emittedAt: 999_999,
      rendererHealth: basePayload.rendererHealth
        ? {
            ...basePayload.rendererHealth,
            updatedAt: 555_555,
          }
        : null,
    };

    expect(buildBettingFeedDedupKey(basePayload)).toBe(
      buildBettingFeedDedupKey(laterPayload),
    );
  });

  it("handles empty replay buffers cleanly", () => {
    expect(selectReplayDelivery([], 0)).toMatchObject({
      mode: "bootstrap",
      latestFrame: null,
      oldestSeq: null,
    });
  });

  it("replays all buffered frames when the caller is exactly at the oldest boundary", () => {
    const frames = [createFrame(10), createFrame(11), createFrame(12)];

    expect(selectReplayDelivery(frames, 10)).toMatchObject({
      mode: "replay",
      frames: [frames[1], frames[2]],
      latestFrame: frames[2],
      oldestSeq: 10,
    });
  });
});
