/**
 * Regression tests for DuelOrchestrator cleanup paths.
 *
 * Specifically covers the timeout-draw bug where `endFightByTimeout()` called
 * `onResolution()` directly on a tie, skipping `stopCombatLoop`,
 * `clearCombatRetryTimeout`, and `stopCombatAIs` — leaving agents locked in
 * arena mode (bounds clamped, autonomy disabled) until the next duel started.
 *
 * See DuelOrchestrator.endFightByTimeout + startResolution.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DuelOrchestrator } from "../DuelOrchestrator";
import type { AgentContestant, StreamingDuelCycle } from "../../types";

type ArenaService = {
  clearArenaBounds: ReturnType<typeof vi.fn>;
  setAutonomousBehaviorEnabled: ReturnType<typeof vi.fn>;
};

function makeContestant(
  id: string,
  hp: number,
  damageDealt: number,
): AgentContestant {
  return {
    characterId: id,
    name: `agent-${id}`,
    provider: "test",
    model: "test",
    combatLevel: 10,
    wins: 0,
    losses: 0,
    currentHp: hp,
    maxHp: 10,
    originalPosition: [0, 0, 0],
    damageDealtThisFight: damageDealt,
    highestHit: 0,
    attacksLanded: 0,
    healsUsed: 0,
    equipment: {},
    inventory: [],
    itemIconPaths: {},
    rank: 0,
    headToHeadWins: 0,
    headToHeadLosses: 0,
  };
}

function makeCycle(
  a1Hp: number,
  a2Hp: number,
  a1Dmg: number,
  a2Dmg: number,
): StreamingDuelCycle {
  const now = Date.now();
  return {
    cycleId: "test-cycle",
    phase: "FIGHTING",
    cycleStartTime: now,
    phaseStartTime: now,
    phaseVersion: 0,
    agent1: makeContestant("a1", a1Hp, a1Dmg),
    agent2: makeContestant("a2", a2Hp, a2Dmg),
    duelId: null,
    duelKeyHex: null,
    arenaId: 1,
    betOpenTime: null,
    betCloseTime: null,
    countdownValue: null,
    fightStartTime: now,
    duelEndTime: null,
    arenaPositions: null,
    winnerId: null,
    loserId: null,
    winReason: null,
    seed: null,
    replayHash: null,
  };
}

function makeOrchestrator(
  cycle: StreamingDuelCycle,
  services: ArenaService[],
  onResolution: (w: string, l: string, r: string) => void,
) {
  const world: unknown = {
    emit: vi.fn(),
    entities: { get: () => null },
    getSystem: () => null,
    network: { send: vi.fn() },
  };

  const orch = new DuelOrchestrator(
    world as never,
    () => cycle,
    (fields) => Object.assign(cycle, fields),
    () => new Map(),
    onResolution as never,
    () => [],
    () => [],
  );

  // Simulate `startCombatAIs` having run: both services locked into arena mode.
  // In production this is populated by the loop at DuelOrchestrator.ts:2436.
  (
    orch as unknown as { _arenaModeServices: ArenaService[] }
  )._arenaModeServices = services;

  return orch;
}

describe("DuelOrchestrator.endFightByTimeout", () => {
  beforeEach(() => {
    // setTimeout at the end of startResolution (victory emote + trash talk)
    // should not fire during test — keep timers fake.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears arena mode on timeout-DRAW (regression for direct onResolution() bypass)", () => {
    // Equal HP, equal damage → draw path
    const cycle = makeCycle(5, 5, 7, 7);
    const svc1: ArenaService = {
      clearArenaBounds: vi.fn(),
      setAutonomousBehaviorEnabled: vi.fn(),
    };
    const svc2: ArenaService = {
      clearArenaBounds: vi.fn(),
      setAutonomousBehaviorEnabled: vi.fn(),
    };
    const onResolution = vi.fn();
    const orch = makeOrchestrator(cycle, [svc1, svc2], onResolution);

    orch.endFightByTimeout();

    // Must report a draw
    expect(onResolution).toHaveBeenCalledTimes(1);
    expect(onResolution).toHaveBeenCalledWith("a1", "a2", "draw");

    // Must have torn down arena mode — this is exactly the cleanup that the
    // pre-fix code skipped by calling onResolution() directly.
    expect(svc1.clearArenaBounds).toHaveBeenCalledTimes(1);
    expect(svc2.clearArenaBounds).toHaveBeenCalledTimes(1);
    expect(svc1.setAutonomousBehaviorEnabled).toHaveBeenCalledTimes(1);
    expect(svc1.setAutonomousBehaviorEnabled).toHaveBeenCalledWith(true);
    expect(svc2.setAutonomousBehaviorEnabled).toHaveBeenCalledWith(true);
  });

  it("clears arena mode on timeout-HP-ADVANTAGE (smoke check)", () => {
    // Different HP → hp_advantage path (already went through startResolution pre-fix,
    // but worth a smoke test to guard against future regressions there too).
    const cycle = makeCycle(8, 3, 7, 4);
    const svc1: ArenaService = {
      clearArenaBounds: vi.fn(),
      setAutonomousBehaviorEnabled: vi.fn(),
    };
    const svc2: ArenaService = {
      clearArenaBounds: vi.fn(),
      setAutonomousBehaviorEnabled: vi.fn(),
    };
    const onResolution = vi.fn();
    const orch = makeOrchestrator(cycle, [svc1, svc2], onResolution);

    orch.endFightByTimeout();

    expect(onResolution).toHaveBeenCalledWith("a1", "a2", "hp_advantage");
    expect(svc1.clearArenaBounds).toHaveBeenCalledTimes(1);
    expect(svc2.clearArenaBounds).toHaveBeenCalledTimes(1);
    expect(svc1.setAutonomousBehaviorEnabled).toHaveBeenCalledWith(true);
    expect(svc2.setAutonomousBehaviorEnabled).toHaveBeenCalledWith(true);
  });

  it("does nothing when phase is not FIGHTING (Fix G)", () => {
    const cycle = makeCycle(5, 5, 7, 7);
    cycle.phase = "RESOLUTION";
    const svc1: ArenaService = {
      clearArenaBounds: vi.fn(),
      setAutonomousBehaviorEnabled: vi.fn(),
    };
    const svc2: ArenaService = {
      clearArenaBounds: vi.fn(),
      setAutonomousBehaviorEnabled: vi.fn(),
    };
    const onResolution = vi.fn();
    const orch = makeOrchestrator(cycle, [svc1, svc2], onResolution);

    orch.endFightByTimeout();

    expect(onResolution).not.toHaveBeenCalled();
    expect(svc1.clearArenaBounds).not.toHaveBeenCalled();
    expect(svc2.clearArenaBounds).not.toHaveBeenCalled();
  });
});
