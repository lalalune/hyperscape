import { describe, expect, it, vi } from "vitest";
import type { World } from "@hyperforge/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  MatchmakingManager,
  normalizePersistedRecentDuel,
} from "../MatchmakingManager.js";
import type { RecentDuelEntry } from "../../types.js";

const makePersistedWin = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  cycleId: "legacy-win",
  duelId: "duel-legacy",
  finishedAt: 100,
  agent1Id: "agent-a",
  agent1Name: "Astra",
  agent1OpeningStyle: null,
  agent2Id: "agent-b",
  agent2Name: "Riven",
  agent2OpeningStyle: null,
  winnerId: "agent-a",
  winnerName: "Astra",
  loserId: "agent-b",
  loserName: "Riven",
  winReason: "kill",
  damageAgent1: 25,
  damageAgent2: 10,
  damageWinner: 25,
  damageLoser: 10,
  ...overrides,
});

const makeManager = (
  rows: unknown[] | Promise<unknown[]>,
  maxRecentDuels = 3,
) => {
  const query = {
    from: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => rows),
  };
  const db = {
    select: vi.fn(() => query),
  } as unknown as NodePgDatabase;

  return new MatchmakingManager({} as World, () => db, {
    minAgents: 2,
    maxRecentDuels,
    persistStatsToDatabase: false,
    maxAgentStats: 64,
    insufficientAgentsRetryInterval: 30_000,
    maxInsufficientAgentWarnings: 5,
  });
};

const makeSelectionManager = (agentIds: string[]) => {
  const entities = new Map(
    agentIds.map((agentId) => [agentId, { data: { name: agentId } }]),
  );
  const manager = new MatchmakingManager(
    { entities } as unknown as World,
    () => null,
    {
      minAgents: 2,
      maxRecentDuels: 3,
      persistStatsToDatabase: false,
      maxAgentStats: 64,
      insufficientAgentsRetryInterval: 30_000,
      maxInsufficientAgentWarnings: 5,
    },
  );
  const pairChanges: Array<{
    agent1Id: string;
    agent2Id: string;
    selectedAt: number;
  } | null> = [];
  manager.setCallbacks({
    getCycleContestantIds: () => new Set(),
    getCurrentCycleAgentDamage: () => null,
    onNextDuelPairChanged: (pair) => pairChanges.push(pair),
  });
  for (const agentId of agentIds) {
    manager.availableAgents.add(agentId);
  }
  return { entities, manager, pairChanges };
};

const makeLiveDuel = (overrides: Partial<RecentDuelEntry> = {}) => ({
  cycleId: "live-cycle",
  duelId: "live-duel",
  finishedAt: 250,
  outcome: "draw" as const,
  agent1Id: "agent-live-a",
  agent1Name: "Live A",
  agent1OpeningStyle: null,
  agent2Id: "agent-live-b",
  agent2Name: "Live B",
  agent2OpeningStyle: null,
  winnerId: null,
  winnerName: null,
  loserId: null,
  loserName: null,
  winReason: "draw" as const,
  cancellationReason: null,
  damageAgent1: 14,
  damageAgent2: 14,
  damageWinner: null,
  damageLoser: null,
  ...overrides,
});

describe("MatchmakingManager preparation retry deferral", () => {
  it("keeps a failed agent out while healthy agents continue pairing", () => {
    const { manager } = makeSelectionManager([
      "agent-failed",
      "agent-healthy-a",
      "agent-healthy-b",
    ]);

    manager.deferAgentAfterPreparationFailure("agent-failed", 2_000);
    manager.refreshNextDuelPair(1_000);

    expect(
      new Set([manager.nextDuelPair?.agent1Id, manager.nextDuelPair?.agent2Id]),
    ).toEqual(new Set(["agent-healthy-a", "agent-healthy-b"]));
  });

  it("re-admits the failed agent exactly at the retry deadline", () => {
    const { manager } = makeSelectionManager(["agent-failed", "agent-peer"]);

    manager.deferAgentAfterPreparationFailure("agent-failed", 2_000);
    manager.refreshNextDuelPair(1_999);
    expect(manager.nextDuelPair).toBeNull();

    manager.refreshNextDuelPair(2_000);
    expect(
      new Set([manager.nextDuelPair?.agent1Id, manager.nextDuelPair?.agent2Id]),
    ).toEqual(new Set(["agent-failed", "agent-peer"]));
  });

  it("never shortens an existing deferral", () => {
    const { manager } = makeSelectionManager(["agent-failed", "agent-peer"]);

    manager.deferAgentAfterPreparationFailure("agent-failed", 3_000);
    manager.deferAgentAfterPreparationFailure("agent-failed", 2_000);
    manager.refreshNextDuelPair(2_500);
    expect(manager.nextDuelPair).toBeNull();

    manager.refreshNextDuelPair(3_000);
    expect(manager.nextDuelPair).not.toBeNull();
  });

  it("clears stale process-local deferral when an agent reconnects", () => {
    const { manager } = makeSelectionManager(["agent-restarted", "agent-peer"]);
    const retryAfter = Date.now() + 60_000;

    manager.deferAgentAfterPreparationFailure("agent-restarted", retryAfter);
    manager.unregisterAgent("agent-restarted");
    manager.registerAgent("agent-restarted");
    manager.refreshNextDuelPair(Date.now());

    expect(
      new Set([manager.nextDuelPair?.agent1Id, manager.nextDuelPair?.agent2Id]),
    ).toEqual(new Set(["agent-restarted", "agent-peer"]));
  });

  it("clears an already-selected failed pair before notifying replacement logic", () => {
    const { manager, pairChanges } = makeSelectionManager([
      "agent-failed",
      "agent-peer",
    ]);
    manager.refreshNextDuelPair(1_000);
    expect(manager.nextDuelPair).not.toBeNull();

    manager.deferAgentAfterPreparationFailure("agent-failed", 2_000);

    expect(manager.nextDuelPair).toBeNull();
    expect(pairChanges.at(-1)).toBeNull();
  });

  it("rejects malformed retry boundaries", () => {
    const { manager } = makeSelectionManager(["agent-failed", "agent-peer"]);

    expect(() => manager.deferAgentAfterPreparationFailure("", 2_000)).toThrow(
      "invalid preparation retry deferral",
    );
    expect(() =>
      manager.deferAgentAfterPreparationFailure("agent-failed", Number.NaN),
    ).toThrow("invalid preparation retry deferral");
    expect(() =>
      manager.deferAgentAfterPreparationFailure("agent-failed", -1),
    ).toThrow("invalid preparation retry deferral");
  });
});

describe("normalizePersistedRecentDuel", () => {
  it("accepts the legacy win-only row shape", () => {
    const normalized = normalizePersistedRecentDuel(makePersistedWin());

    expect(normalized).toMatchObject({
      cycleId: "legacy-win",
      outcome: "win",
      winnerId: "agent-a",
      loserId: "agent-b",
      winReason: "kill",
    });
  });

  it("accepts winner-only writes from a rolled-back binary after migration", () => {
    const normalized = normalizePersistedRecentDuel(
      makePersistedWin({
        outcome: "win",
        agent1Id: null,
        agent1Name: null,
        agent2Id: null,
        agent2Name: null,
        damageAgent1: 0,
        damageAgent2: 0,
      }),
    );

    expect(normalized).toMatchObject({
      outcome: "win",
      agent1Id: "agent-a",
      agent1Name: "Astra",
      agent2Id: "agent-b",
      agent2Name: "Riven",
      damageAgent1: 25,
      damageAgent2: 10,
    });
  });

  it("normalizes draws without manufacturing a winner", () => {
    const normalized = normalizePersistedRecentDuel(
      makePersistedWin({
        cycleId: "draw-cycle",
        outcome: "draw",
        winnerId: "should-not-survive",
        loserId: "should-not-survive",
        winReason: null,
      }),
    );

    expect(normalized).toMatchObject({
      outcome: "draw",
      winnerId: null,
      loserId: null,
      winReason: "draw",
      cancellationReason: null,
    });
  });

  it("preserves cancellation diagnostics but strips competitive fields", () => {
    const normalized = normalizePersistedRecentDuel(
      makePersistedWin({
        cycleId: "cancel-cycle",
        outcome: "cancelled",
        agent1Id: null,
        agent1Name: null,
        agent2Id: null,
        agent2Name: null,
        cancellationReason: "agents_missing",
      }),
    );

    expect(normalized).toMatchObject({
      outcome: "cancelled",
      agent1Id: null,
      agent2Id: null,
      winnerId: null,
      loserId: null,
      winReason: null,
      cancellationReason: "agents_missing",
    });
  });

  it("rejects unknown outcomes and incomplete wins", () => {
    expect(
      normalizePersistedRecentDuel(makePersistedWin({ outcome: "void" })),
    ).toBeNull();
    expect(
      normalizePersistedRecentDuel(makePersistedWin({ winnerId: null })),
    ).toBeNull();
  });

  it("preserves valid frozen styles and fails unknown styles closed to null", () => {
    expect(
      normalizePersistedRecentDuel(
        makePersistedWin({
          agent1OpeningStyle: "ranged",
          agent2OpeningStyle: "melee",
        }),
      ),
    ).toMatchObject({
      agent1OpeningStyle: "ranged",
      agent2OpeningStyle: "melee",
    });
    expect(
      normalizePersistedRecentDuel(
        makePersistedWin({
          agent1OpeningStyle: "invalid",
          agent2OpeningStyle: 42,
        }),
      ),
    ).toMatchObject({
      agent1OpeningStyle: null,
      agent2OpeningStyle: null,
    });
  });
});

describe("MatchmakingManager opponent history", () => {
  it("returns only completed head-to-head records from the requested perspective", () => {
    const manager = makeManager([]);
    manager.recordRecentDuel(
      makeLiveDuel({
        cycleId: "older-win",
        finishedAt: 100,
        outcome: "win",
        agent1Id: "agent-a",
        agent1OpeningStyle: "mage",
        agent2Id: "agent-b",
        agent2OpeningStyle: "ranged",
        winnerId: "agent-a",
        winnerName: "Astra",
        loserId: "agent-b",
        loserName: "Riven",
        winReason: "kill",
        damageAgent1: 25,
        damageAgent2: 10,
        damageWinner: 25,
        damageLoser: 10,
      }),
    );
    manager.recordRecentDuel(
      makeLiveDuel({
        cycleId: "newer-draw",
        finishedAt: 200,
        agent1Id: "agent-b",
        agent1OpeningStyle: "melee",
        agent2Id: "agent-a",
        agent2OpeningStyle: "mage",
        damageAgent1: 14,
        damageAgent2: 14,
      }),
    );
    manager.recordRecentDuel(
      makeLiveDuel({
        cycleId: "cancelled",
        finishedAt: 300,
        outcome: "cancelled",
        agent1Id: "agent-a",
        agent2Id: "agent-b",
        winReason: null,
        cancellationReason: "operator_cancelled",
      }),
    );

    expect(manager.getOpponentHistory("agent-a", "agent-b")).toEqual([
      {
        cycleId: "newer-draw",
        finishedAt: 200,
        result: "draw",
        ownOpeningStyle: "mage",
        opponentOpeningStyle: "melee",
        ownDamage: 14,
        opponentDamage: 14,
        winReason: "draw",
      },
      {
        cycleId: "older-win",
        finishedAt: 100,
        result: "win",
        ownOpeningStyle: "mage",
        opponentOpeningStyle: "ranged",
        ownDamage: 25,
        opponentDamage: 10,
        winReason: "kill",
      },
    ]);
    expect(manager.getOpponentHistory("agent-b", "agent-a", 1)).toEqual([
      expect.objectContaining({
        cycleId: "newer-draw",
        ownOpeningStyle: "melee",
        opponentOpeningStyle: "mage",
      }),
    ]);
    expect(manager.getOpponentHistory("agent-a", "unrelated")).toEqual([]);
  });
});

describe("MatchmakingManager recent-duel hydration", () => {
  it("merges persisted rows newest-first without replacing live cycles", async () => {
    const manager = makeManager([
      makePersistedWin({
        id: 4,
        cycleId: "bad-cycle",
        outcome: "unknown",
        finishedAt: 400,
      }),
      makePersistedWin({
        id: 3,
        cycleId: "cancel-cycle",
        outcome: "cancelled",
        finishedAt: 300,
        cancellationReason: "agents_missing",
      }),
      makePersistedWin({
        id: 2,
        cycleId: "live-cycle",
        outcome: "win",
        finishedAt: 200,
      }),
      makePersistedWin(),
    ]);
    manager.recordRecentDuel(makeLiveDuel());

    await expect(manager.hydrateRecentDuelsFromDatabase()).resolves.toBe(3);

    expect(manager.getRecentDuels()).toEqual([
      expect.objectContaining({
        cycleId: "cancel-cycle",
        outcome: "cancelled",
      }),
      expect.objectContaining({
        cycleId: "live-cycle",
        outcome: "draw",
        finishedAt: 250,
      }),
      expect.objectContaining({ cycleId: "legacy-win", outcome: "win" }),
    ]);
  });

  it("does not repopulate history when reset wins an in-flight race", async () => {
    let resolveRows!: (rows: unknown[]) => void;
    const rows = new Promise<unknown[]>((resolve) => {
      resolveRows = resolve;
    });
    const manager = makeManager(rows);

    const hydration = manager.hydrateRecentDuelsFromDatabase();
    await vi.waitFor(() => {
      expect(resolveRows).toBeTypeOf("function");
    });
    manager.reset();
    resolveRows([makePersistedWin()]);

    await expect(hydration).resolves.toBe(0);
    expect(manager.getRecentDuels()).toEqual([]);
  });
});
