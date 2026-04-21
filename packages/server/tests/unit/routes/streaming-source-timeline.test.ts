import { describe, expect, it } from "vitest";
import {
  attachRawSourceTime,
  buildSourceTimeline,
  isRawSourceTimeEmissionEnabled,
} from "../../../src/routes/streaming.js";
import type { StreamingStateUpdate } from "../../../src/systems/StreamingDuelScheduler/types.js";

/**
 * Commit 1 contract tests for the canonical stream-state rail
 * (`/api/streaming/state` + `/api/streaming/state/events`). These prove
 * the additive `STREAMING_EMIT_RAW_SOURCE_TIME` flag does not change the
 * wire shape when disabled, and produces a strictly additive raw
 * source-time overlay when enabled. Commits 2–5 depend on this contract.
 */

function makeCycle(
  overrides: Partial<StreamingStateUpdate["cycle"]> = {},
): StreamingStateUpdate["cycle"] {
  return {
    cycleId: "cycle-1",
    phase: "ANNOUNCEMENT",
    cycleStartTime: 1_000,
    phaseStartTime: 1_000,
    phaseEndTime: 61_000,
    phaseVersion: 1,
    timeRemaining: 60,
    agent1: null,
    agent2: null,
    duelId: "duel-1",
    duelKeyHex: null,
    betOpenTime: 2_000,
    betCloseTime: 12_000,
    countdown: null,
    fightStartTime: null,
    duelEndTime: null,
    arenaPositions: null,
    winnerId: null,
    winnerName: null,
    winReason: null,
    seed: null,
    replayHash: null,
    ...overrides,
  };
}

function makeState(
  cycle: StreamingStateUpdate["cycle"] = makeCycle(),
): StreamingStateUpdate {
  return {
    type: "STREAMING_STATE_UPDATE",
    cycle,
    leaderboard: [],
    cameraTarget: null,
  };
}

describe("isRawSourceTimeEmissionEnabled", () => {
  it("returns false when the env var is unset", () => {
    expect(isRawSourceTimeEmissionEnabled({})).toBe(false);
  });

  it("returns false when the env var is explicitly 'false'", () => {
    expect(
      isRawSourceTimeEmissionEnabled({
        STREAMING_EMIT_RAW_SOURCE_TIME: "false",
      }),
    ).toBe(false);
  });

  it("returns true when the env var is 'true'", () => {
    expect(
      isRawSourceTimeEmissionEnabled({
        STREAMING_EMIT_RAW_SOURCE_TIME: "true",
      }),
    ).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(
      isRawSourceTimeEmissionEnabled({
        STREAMING_EMIT_RAW_SOURCE_TIME: "  TRUE  ",
      }),
    ).toBe(true);
  });

  it("rejects ambiguous values (1, yes, on) to avoid accidental emission", () => {
    // Only the explicit string "true" enables the contract. This keeps
    // rollout opt-in clear and prevents an unrelated env-convention change
    // from flipping the wire shape.
    expect(
      isRawSourceTimeEmissionEnabled({ STREAMING_EMIT_RAW_SOURCE_TIME: "1" }),
    ).toBe(false);
    expect(
      isRawSourceTimeEmissionEnabled({ STREAMING_EMIT_RAW_SOURCE_TIME: "yes" }),
    ).toBe(false);
    expect(
      isRawSourceTimeEmissionEnabled({ STREAMING_EMIT_RAW_SOURCE_TIME: "on" }),
    ).toBe(false);
  });
});

describe("buildSourceTimeline", () => {
  it("mirrors raw cycle timing fields verbatim (no projection)", () => {
    const cycle = makeCycle({
      phase: "COUNTDOWN",
      betOpenTime: 100,
      betCloseTime: 200,
      fightStartTime: 300,
      duelEndTime: 400,
    });

    const timeline = buildSourceTimeline(cycle, 5_000);

    expect(timeline).toEqual({
      phase: "COUNTDOWN",
      betOpenTime: 100,
      betCloseTime: 200,
      fightStartTime: 300,
      duelEndTime: 400,
      updatedAt: 5_000,
    });
  });

  it("preserves nulls for optional timing fields", () => {
    const cycle = makeCycle({
      phase: "IDLE",
      betOpenTime: null,
      betCloseTime: null,
      fightStartTime: null,
      duelEndTime: null,
    });

    const timeline = buildSourceTimeline(cycle, 42);

    expect(timeline).toEqual({
      phase: "IDLE",
      betOpenTime: null,
      betCloseTime: null,
      fightStartTime: null,
      duelEndTime: null,
      updatedAt: 42,
    });
  });

  it("does not apply any presentation-delay shift", () => {
    // This is the load-bearing property: the selector in commit 3
    // operates in source time and must not receive projected values from
    // this rail. If anyone later "helpfully" adds a delay term here,
    // this test should fail and so should commit 3's double-delay guard.
    const cycle = makeCycle({ betCloseTime: 10_000 });

    const timeline = buildSourceTimeline(cycle, 5_000);

    expect(timeline.betCloseTime).toBe(10_000);
  });
});

describe("attachRawSourceTime", () => {
  it("is a no-op when disabled — wire shape unchanged", () => {
    const state = makeState();
    const result = attachRawSourceTime(state, 1_234, {
      stampEmittedAt: true,
      enabled: false,
    });

    // Identity check: literally the same object returned so downstream
    // JSON.stringify produces byte-identical output vs. the pre-flag
    // release. This is what lets commit 1 ship dark safely.
    expect(result).toBe(state);
    expect((result as Record<string, unknown>).emittedAt).toBeUndefined();
    expect(result.cycle).not.toHaveProperty("sourceTimeline");
  });

  it("attaches cycle.sourceTimeline when enabled", () => {
    const state = makeState();
    const result = attachRawSourceTime(state, 7_777, {
      stampEmittedAt: false,
      enabled: true,
    });

    expect(result.cycle).toHaveProperty("sourceTimeline");
    expect(result.cycle.sourceTimeline).toEqual({
      phase: state.cycle.phase,
      betOpenTime: state.cycle.betOpenTime,
      betCloseTime: state.cycle.betCloseTime,
      fightStartTime: state.cycle.fightStartTime,
      duelEndTime: state.cycle.duelEndTime,
      updatedAt: 7_777,
    });
    // stampEmittedAt=false means SSE envelope path — emittedAt is added
    // elsewhere by the SSE framer, not by this helper.
    expect((result as Record<string, unknown>).emittedAt).toBeUndefined();
  });

  it("stamps top-level emittedAt when stampEmittedAt=true (REST path)", () => {
    const state = makeState();
    const result = attachRawSourceTime(state, 9_000, {
      stampEmittedAt: true,
      enabled: true,
    });

    expect((result as { emittedAt?: number }).emittedAt).toBe(9_000);
    expect(result.cycle.sourceTimeline?.updatedAt).toBe(9_000);
  });

  it("builds sourceTimeline from the explicit raw source cycle when provided", () => {
    const redactedCycle = makeCycle({
      duelEndTime: null,
    });
    const rawCycle = makeCycle({
      duelEndTime: 44_000,
    });
    const state = makeState(redactedCycle);

    const result = attachRawSourceTime(state, 9_000, {
      stampEmittedAt: true,
      enabled: true,
      sourceCycle: rawCycle,
    });

    expect(result.cycle.duelEndTime).toBeNull();
    expect(result.cycle.sourceTimeline).toEqual({
      phase: rawCycle.phase,
      betOpenTime: rawCycle.betOpenTime,
      betCloseTime: rawCycle.betCloseTime,
      fightStartTime: rawCycle.fightStartTime,
      duelEndTime: 44_000,
      updatedAt: 9_000,
    });
  });

  it("preserves a pre-existing sourceTimeline instead of rebuilding it from the public cycle", () => {
    const existingSourceTimeline = {
      phase: "RESOLUTION" as const,
      betOpenTime: 1_000,
      betCloseTime: 2_000,
      fightStartTime: 3_000,
      duelEndTime: 4_000,
      updatedAt: 5_000,
    };
    const state = makeState({
      ...makeCycle({
        phase: "RESOLUTION",
      }),
      sourceTimeline: existingSourceTimeline,
    });

    const result = attachRawSourceTime(state, 9_999, {
      stampEmittedAt: true,
      enabled: true,
    });

    expect(result.cycle.sourceTimeline).toEqual(existingSourceTimeline);
  });

  it("leaves all existing fields untouched (additive only)", () => {
    const state = makeState(
      makeCycle({
        phase: "FIGHTING",
        cycleId: "keep-me",
        timeRemaining: 42,
      }),
    );
    const result = attachRawSourceTime(state, 100, {
      stampEmittedAt: true,
      enabled: true,
    });

    expect(result.type).toBe("STREAMING_STATE_UPDATE");
    expect(result.cycle.cycleId).toBe("keep-me");
    expect(result.cycle.phase).toBe("FIGHTING");
    expect(result.cycle.timeRemaining).toBe(42);
    expect(result.cycle.betOpenTime).toBe(state.cycle.betOpenTime);
    expect(result.cycle.betCloseTime).toBe(state.cycle.betCloseTime);
    expect(result.leaderboard).toEqual([]);
    expect(result.cameraTarget).toBeNull();
  });

  it("does not mutate the input state", () => {
    const cycle = makeCycle();
    const state = makeState(cycle);
    const result = attachRawSourceTime(state, 1, {
      stampEmittedAt: true,
      enabled: true,
    });

    expect(state).not.toBe(result);
    expect(state.cycle).not.toBe(result.cycle);
    expect(state.cycle).not.toHaveProperty("sourceTimeline");
    expect(cycle).not.toHaveProperty("sourceTimeline");
  });

  it("does not re-introduce oracle-proof fields on a redacted cycle", () => {
    // The canonical rail calls `redactOracleProofFromCycle` upstream,
    // which strips `duelKeyHex / duelEndTime / seed / replayHash` from
    // public payloads. attachRawSourceTime must not resurrect any of
    // those fields via its spread.
    const cycle = makeCycle({ duelKeyHex: null, seed: null, replayHash: null });
    const state = makeState(cycle);
    const result = attachRawSourceTime(state, 1, {
      stampEmittedAt: true,
      enabled: true,
    });

    expect(result.cycle.duelKeyHex).toBeNull();
    expect(result.cycle.seed).toBeNull();
    expect(result.cycle.replayHash).toBeNull();
    // `duelEndTime` is intentionally kept as-is on the cycle (the
    // redactor nullifies it via `delete` on the bet-sync rail; on the
    // canonical rail it's already null when the duel hasn't ended).
    // What sourceTimeline exposes of it is the CYCLE's value, not
    // anything new.
    expect(result.cycle.sourceTimeline?.duelEndTime).toBe(cycle.duelEndTime);
  });

  it("projected-vs-source separation: same cycle yields same sourceTimeline regardless of emit time", () => {
    // Key invariant for commit 3's selector: the source timestamps in
    // sourceTimeline are the RAW underlying scheduler values. Two calls
    // with different `sourceEmittedAt` should produce identical
    // sourceTimeline timing fields (only `updatedAt` changes).
    const cycle = makeCycle();
    const state = makeState(cycle);
    const a = attachRawSourceTime(state, 1_000, {
      stampEmittedAt: true,
      enabled: true,
    });
    const b = attachRawSourceTime(state, 5_000, {
      stampEmittedAt: true,
      enabled: true,
    });

    expect(a.cycle.sourceTimeline?.betOpenTime).toBe(
      b.cycle.sourceTimeline?.betOpenTime,
    );
    expect(a.cycle.sourceTimeline?.betCloseTime).toBe(
      b.cycle.sourceTimeline?.betCloseTime,
    );
    expect(a.cycle.sourceTimeline?.updatedAt).toBe(1_000);
    expect(b.cycle.sourceTimeline?.updatedAt).toBe(5_000);
  });
});
