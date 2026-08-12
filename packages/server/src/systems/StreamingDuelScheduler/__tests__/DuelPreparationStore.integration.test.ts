import pg from "pg";
import { randomUUID } from "node:crypto";
import { ITEMS } from "@hyperforge/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DUEL_PREPARATION_BANK_ACTIONS,
  PostgresDuelPreparationStore,
} from "../preparation.js";
import {
  executeAuthoritativeAgentBankTransfer,
  getDuelPreparationBankId,
} from "../../../eliza/AuthoritativeAgentBanking.js";
import { buildDeterministicCompetitiveTacticalStrategy } from "../competitive-tactical-strategy.js";

const connectionString = process.env.DUEL_PREPARATION_TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

const planEvidence = (agentId: string) => ({
  primaryStyle: "melee" as const,
  availableStyles: ["melee" as const],
  planningSource: "deterministic" as const,
  planningPolicyVersion: "test-policy-v1",
  agentPolicyFingerprint: "ab".repeat(32),
  modelProvider: "test",
  model: agentId,
  tacticalStrategy: buildDeterministicCompetitiveTacticalStrategy("melee"),
});

const snapshotContestant = (side: "agent1" | "agent2", agentId: string) => ({
  side,
  agentId,
  name: agentId,
  provider: "test",
  model: agentId,
  combatLevel: 10,
  startingHp: 20,
  maxHp: 20,
  wins: 0,
  losses: 0,
  rank: side === "agent1" ? 1 : 2,
  headToHeadWins: 0,
  headToHeadLosses: 0,
  loadoutFingerprint: (side === "agent1" ? "11" : "22").repeat(32),
  equipment: [{ slot: "weapon", itemId: "bronze_sword", quantity: 1 }],
  inventory: [{ slot: 0, itemId: "shark", quantity: 2 }],
  selectedSpell: null,
  skillLevels: [
    { skill: "attack", level: 10 },
    { skill: "constitution", level: 20 },
  ],
  prayer: {
    pointUnits: 100,
    points: 10,
    maxPoints: 10,
    activePrayers: [],
  },
  initialCombatStyle: "melee" as const,
  availableCombatStyles: ["melee" as const],
  combatLoadouts: {
    melee: {
      role: "melee" as const,
      weaponId: "bronze_sword",
      arrowsId: null,
      shieldId: null,
      spellId: null,
      armorIds: {
        helmet: null,
        body: null,
        legs: null,
        boots: null,
        gloves: null,
        cape: null,
        amulet: null,
        ring: null,
      },
    },
  },
  preparation: planEvidence(agentId),
});

describeWithDatabase("PostgresDuelPreparationStore integration", () => {
  const pool = new pg.Pool({ connectionString, max: 4 });
  const store = new PostgresDuelPreparationStore(pool);
  const runId = randomUUID();
  const agent1Id = `preparation-agent-1-${runId}`;
  const agent2Id = `preparation-agent-2-${runId}`;
  const agent3Id = `preparation-agent-3-${runId}`;
  const account1Id = `preparation-account-1-${runId}`;
  const account2Id = `preparation-account-2-${runId}`;
  const account3Id = `preparation-account-3-${runId}`;
  const bankItemId = "preparation_integration_item";
  let previousBankItem: unknown;

  beforeAll(async () => {
    previousBankItem = ITEMS.get(bankItemId);
    ITEMS.set(bankItemId, {
      id: bankItemId,
      name: "Preparation Integration Item",
      type: "resource",
      stackable: true,
    } as never);
    await pool.query(
      `INSERT INTO users (id, name, roles, "createdAt")
       VALUES
         ($1, 'Preparation Account 1', '[]', '2026-01-01T00:00:00.000Z'),
         ($2, 'Preparation Account 2', '[]', '2026-01-01T00:00:00.000Z'),
         ($3, 'Preparation Account 3', '[]', '2026-01-01T00:00:00.000Z')
       ON CONFLICT (id) DO NOTHING`,
      [account1Id, account2Id, account3Id],
    );
    await pool.query(
      `INSERT INTO characters (id, "accountId", name)
       VALUES
         ($1, $4, 'Preparation Agent 1'),
         ($2, $5, 'Preparation Agent 2'),
         ($3, $6, 'Preparation Agent 3')
       ON CONFLICT (id) DO NOTHING`,
      [agent1Id, agent2Id, agent3Id, account1Id, account2Id, account3Id],
    );
  });

  afterAll(async () => {
    // Preparation, transition, and bank-operation evidence is deliberately
    // append-only. Unique per-run identities avoid collisions without asking
    // teardown to violate the same immutability contract this suite verifies.
    if (previousBankItem) ITEMS.set(bankItemId, previousBankItem as never);
    else ITEMS.delete(bankItemId);
    await pool.end();
  });

  it("persists selection and supersedes the prior private session", async () => {
    const first = await store.create({
      preparationId: randomUUID(),
      fencingToken: "4",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    const retry = await store.create({
      preparationId: first.preparationId,
      fencingToken: "4",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    expect(retry).toEqual(first);

    const second = await store.create({
      preparationId: randomUUID(),
      fencingToken: "4",
      agent1Id,
      agent2Id: agent3Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });

    expect(second).toMatchObject({
      status: "preparing",
      agent1Id,
      agent2Id: agent3Id,
      version: 1,
    });
    expect(await store.get(first.preparationId)).toMatchObject({
      status: "cancelled",
      cancellationReason: "superseded",
      version: 2,
    });
    expect(await store.getActive()).toMatchObject({
      preparationId: second.preparationId,
    });
    expect(
      (await store.getTransitionHistory(first.preparationId)).map(
        (event) => event.eventType,
      ),
    ).toEqual(["preparation_selected", "preparation_cancelled"]);
    expect(await store.getTransitionHistory(first.preparationId)).toEqual([
      expect.objectContaining({
        eventSource: "runtime",
        preparationId: first.preparationId,
        eventType: "preparation_selected",
        preparationVersion: 1,
        reason: null,
      }),
      expect.objectContaining({
        eventSource: "runtime",
        preparationId: first.preparationId,
        eventType: "preparation_cancelled",
        preparationVersion: 2,
        reason: "superseded",
      }),
    ]);
  });

  it("revokes each contestant's bank access at readiness and freezes only both-ready state", async () => {
    const preparation = await store.create({
      preparationId: randomUUID(),
      fencingToken: "5",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });

    expect(
      await store.authorizeBankAccess({
        preparationId: preparation.preparationId,
        playerId: agent1Id,
        action: "open",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await store.authorizeBankAccess({
        preparationId: preparation.preparationId,
        playerId: agent3Id,
        action: "open",
      }),
    ).toEqual({ ok: false, reason: "preparation_agent_mismatch" });
    expect(
      await store.freeze({
        preparationId: preparation.preparationId,
        fencingToken: "5",
      }),
    ).toBeNull();

    const firstReady = await store.markReady({
      preparationId: preparation.preparationId,
      fencingToken: "5",
      agentId: agent1Id,
      planEvidence: planEvidence(agent1Id),
    });
    expect(firstReady).toMatchObject({
      status: "preparing",
      version: 2,
    });
    expect(firstReady?.agent1ReadyAt).not.toBeNull();
    expect(
      await store.authorizeBankAccess({
        preparationId: preparation.preparationId,
        playerId: agent1Id,
        action: "open",
      }),
    ).toEqual({ ok: false, reason: "preparation_agent_ready" });
    expect(
      await store.authorizeBankAccess({
        preparationId: preparation.preparationId,
        playerId: agent2Id,
        action: "open",
      }),
    ).toMatchObject({ ok: true });

    const ready = await store.markReady({
      preparationId: preparation.preparationId,
      fencingToken: "5",
      agentId: agent2Id,
      planEvidence: planEvidence(agent2Id),
    });
    expect(ready).toMatchObject({ status: "ready", version: 3 });
    expect(
      await store.markReady({
        preparationId: preparation.preparationId,
        fencingToken: "5",
        agentId: agent2Id,
        planEvidence: planEvidence(agent2Id),
      }),
    ).toEqual(ready);
    expect(
      await store.authorizeBankAccess({
        preparationId: preparation.preparationId,
        playerId: agent2Id,
        action: "open",
      }),
    ).toEqual({ ok: false, reason: "preparation_not_active" });

    const frozen = await store.freeze({
      preparationId: preparation.preparationId,
      fencingToken: "5",
    });
    expect(frozen).toMatchObject({ status: "frozen", version: 4 });
    expect(frozen?.frozenAt).not.toBeNull();
    expect(
      await store.freeze({
        preparationId: preparation.preparationId,
        fencingToken: "5",
      }),
    ).toEqual(frozen);
    expect(
      (await store.getTransitionHistory(preparation.preparationId)).map(
        (event) => [event.eventType, event.actorAgentId],
      ),
    ).toEqual([
      ["preparation_selected", null],
      ["contestant_ready", agent1Id],
      ["contestant_ready", agent2Id],
      ["preparation_frozen", null],
    ]);
  });

  it("serializes simultaneous contestant readiness without losing either audit edge", async () => {
    const preparation = await store.create({
      preparationId: randomUUID(),
      fencingToken: "6",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    const [agent1Ready, agent2Ready] = await Promise.all([
      store.markReady({
        preparationId: preparation.preparationId,
        fencingToken: "6",
        agentId: agent1Id,
        planEvidence: planEvidence(agent1Id),
      }),
      store.markReady({
        preparationId: preparation.preparationId,
        fencingToken: "6",
        agentId: agent2Id,
        planEvidence: planEvidence(agent2Id),
      }),
    ]);
    expect(agent1Ready).not.toBeNull();
    expect(agent2Ready).not.toBeNull();
    expect(await store.get(preparation.preparationId)).toMatchObject({
      status: "ready",
      version: 3,
      agent1ReadyAt: expect.any(Number),
      agent2ReadyAt: expect.any(Number),
    });
    const history = await store.getTransitionHistory(preparation.preparationId);
    expect(history.map((event) => event.eventType)).toEqual([
      "preparation_selected",
      "contestant_ready",
      "contestant_ready",
    ]);
    expect(
      new Set(history.slice(1).map((event) => event.actorAgentId)),
    ).toEqual(new Set([agent1Id, agent2Id]));
    expect(history.slice(1).map((event) => event.preparationVersion)).toEqual([
      2, 3,
    ]);
  });

  it("fences stale authorities and expires access on database time", async () => {
    const preparation = await store.create({
      preparationId: randomUUID(),
      fencingToken: "8",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    expect(
      await store.markReady({
        preparationId: preparation.preparationId,
        fencingToken: "7",
        agentId: agent1Id,
        planEvidence: planEvidence(agent1Id),
      }),
    ).toBeNull();

    await pool.query(
      `UPDATE streaming_duel_preparations
       SET "selectedAt" = 0, "expiresAt" = 1
       WHERE "preparationId" = $1`,
      [preparation.preparationId],
    );
    expect(
      await store.authorizeBankAccess({
        preparationId: preparation.preparationId,
        playerId: agent1Id,
        action: "open",
      }),
    ).toEqual({ ok: false, reason: "preparation_expired" });
    expect(await store.expire()).toEqual([
      expect.objectContaining({
        preparationId: preparation.preparationId,
        status: "expired",
      }),
    ]);
    expect(
      (await store.getTransitionHistory(preparation.preparationId)).map(
        (event) => [event.eventType, event.occurredAt],
      ),
    ).toEqual([
      ["preparation_selected", preparation.selectedAt],
      ["preparation_expired", 1],
    ]);
  });

  it("claims one frozen snapshot with a newer fence and commits terminal truth idempotently", async () => {
    const preparation = await store.create({
      preparationId: randomUUID(),
      fencingToken: "30",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    await store.markReady({
      preparationId: preparation.preparationId,
      fencingToken: "30",
      agentId: agent1Id,
      planEvidence: planEvidence(agent1Id),
    });
    await store.markReady({
      preparationId: preparation.preparationId,
      fencingToken: "30",
      agentId: agent2Id,
      planEvidence: planEvidence(agent2Id),
    });
    const cycleId = `preparation-snapshot-integration-cycle-${runId}`;
    const frozen = await store.freezeWithCompetitiveSnapshot({
      preparationId: preparation.preparationId,
      fencingToken: "30",
      betWindowDurationMs: 60_000,
      draft: {
        diagnostic: false,
        preparationId: preparation.preparationId,
        cycleId,
        duelId: `streaming-${cycleId}`,
        duelKey: runId.replaceAll("-", "").repeat(2),
        contestants: [
          snapshotContestant("agent1", agent1Id),
          snapshotContestant("agent2", agent2Id),
        ],
      },
    });
    expect(frozen).toMatchObject({
      lifecycleStatus: "frozen",
      terminal: null,
      preparation: { status: "frozen", fencingToken: "30" },
    });
    expect(frozen?.digest).toMatch(/^[0-9a-f]{64}$/);

    const claimed = await store.claimLatestCompetitiveSnapshotForRecovery("31");
    expect(claimed).toMatchObject({
      lifecycleStatus: "frozen",
      preparation: {
        preparationId: preparation.preparationId,
        fencingToken: "31",
      },
    });
    await expect(
      store.markCompetitiveSnapshotLocked({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        lockedAt: frozen!.snapshot.betCloseTime - 1,
      }),
    ).rejects.toThrow(/lifecycle_order_invalid/);
    const locked = await store.markCompetitiveSnapshotLocked({
      preparationId: preparation.preparationId,
      fencingToken: "31",
      snapshotDigest: frozen!.digest,
      lockedAt: frozen!.snapshot.betCloseTime,
    });
    expect(locked).toMatchObject({
      lifecycleStatus: "frozen",
      lockedAt: frozen!.snapshot.betCloseTime,
      duelStartedAt: null,
      recoveredAt: null,
    });
    expect(
      await store.markCompetitiveSnapshotLocked({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        lockedAt: frozen!.snapshot.betCloseTime,
      }),
    ).toEqual(locked);
    const duelStartedAt = frozen!.snapshot.betCloseTime + 2_000;
    expect(
      await store.markCompetitiveSnapshotDuelStarted({
        preparationId: preparation.preparationId,
        fencingToken: "30",
        snapshotDigest: frozen!.digest,
        duelStartedAt,
      }),
    ).toBeNull();
    const duel = await store.markCompetitiveSnapshotDuelStarted({
      preparationId: preparation.preparationId,
      fencingToken: "31",
      snapshotDigest: frozen!.digest,
      duelStartedAt,
    });
    expect(duel).toMatchObject({
      lifecycleStatus: "frozen",
      lockedAt: frozen!.snapshot.betCloseTime,
      duelStartedAt,
      recoveredAt: null,
    });
    const terminalAt = duelStartedAt + 1_000;
    await expect(
      store.markCompetitiveSnapshotTerminal({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        terminal: {
          outcome: "win",
          winnerId: "not-a-contestant",
          winReason: "kill",
          cancellationReason: null,
          seed: "42",
          replayHash: "44".repeat(32),
          terminalAt,
        },
      }),
    ).rejects.toThrow(/invalid competitive snapshot terminal/);
    const cancellation = {
      outcome: "cancelled" as const,
      winnerId: null,
      winReason: null,
      cancellationReason: "integration_recovery_cancelled",
      seed: null,
      replayHash: null,
      terminalAt,
    };
    expect(
      await store.markCompetitiveSnapshotTerminal({
        preparationId: preparation.preparationId,
        fencingToken: "30",
        snapshotDigest: frozen!.digest,
        terminal: cancellation,
      }),
    ).toBeNull();
    const terminal = await store.markCompetitiveSnapshotTerminal({
      preparationId: preparation.preparationId,
      fencingToken: "31",
      snapshotDigest: frozen!.digest,
      terminal: cancellation,
    });
    expect(terminal).toMatchObject({
      lifecycleStatus: "terminal",
      terminal: cancellation,
    });
    expect(
      await store.markCompetitiveSnapshotTerminal({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        terminal: cancellation,
      }),
    ).toEqual(terminal);
    await expect(
      store.markCompetitiveSnapshotTerminal({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        terminal: {
          ...cancellation,
          cancellationReason: "contradictory_terminal",
        },
      }),
    ).rejects.toThrow(/terminal_conflict/);
    await expect(
      store.markCompetitiveSnapshotTerminal({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        terminal: {
          ...cancellation,
          cancellationReason: "not safe for public feeds",
        },
      }),
    ).rejects.toThrow(/invalid competitive snapshot terminal/);
    const recoveredAt = terminalAt + 500;
    const recovered = await store.markCompetitiveSnapshotRecovered({
      preparationId: preparation.preparationId,
      fencingToken: "31",
      snapshotDigest: frozen!.digest,
      recoveredAt,
    });
    expect(recovered).toMatchObject({
      lifecycleStatus: "retired",
      lockedAt: frozen!.snapshot.betCloseTime,
      duelStartedAt,
      recoveredAt,
      terminal: cancellation,
    });
    expect(
      await store.markCompetitiveSnapshotRecovered({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        recoveredAt,
      }),
    ).toEqual(recovered);
    await expect(
      store.markCompetitiveSnapshotRecovered({
        preparationId: preparation.preparationId,
        fencingToken: "31",
        snapshotDigest: frozen!.digest,
        recoveredAt: recoveredAt + 1,
      }),
    ).rejects.toThrow(/recovery_conflict/);
    expect(
      await store.claimLatestCompetitiveSnapshotForRecovery("32"),
    ).toBeNull();

    const history = await store.getTransitionHistory(preparation.preparationId);
    expect(history.map((event) => event.eventType)).toEqual([
      "preparation_selected",
      "contestant_ready",
      "contestant_ready",
      "competitive_snapshot_frozen",
      "authority_claimed",
      "market_locked",
      "duel_started",
      "terminal_committed",
      "recovery_committed",
    ]);
    expect(history.every((event) => event.eventSource === "runtime")).toBe(
      true,
    );
    expect(
      history.every(
        (event, index) =>
          index === 0 ||
          BigInt(event.eventSequence) >
            BigInt(history[index - 1]!.eventSequence),
      ),
    ).toBe(true);
    expect(history.slice(0, 3)).toEqual([
      expect.objectContaining({
        eventType: "preparation_selected",
        occurredAt: preparation.selectedAt,
        fencingToken: "30",
        preparationVersion: 1,
        actorAgentId: null,
        snapshotDigest: null,
      }),
      expect.objectContaining({
        eventType: "contestant_ready",
        fencingToken: "30",
        preparationVersion: 2,
        actorAgentId: agent1Id,
        snapshotDigest: null,
      }),
      expect.objectContaining({
        eventType: "contestant_ready",
        fencingToken: "30",
        preparationVersion: 3,
        actorAgentId: agent2Id,
        snapshotDigest: null,
      }),
    ]);
    expect(history.slice(3)).toEqual([
      expect.objectContaining({
        eventType: "competitive_snapshot_frozen",
        occurredAt: frozen!.snapshot.frozenAt,
        fencingToken: "30",
        preparationVersion: 4,
        cycleId,
        duelId: `streaming-${cycleId}`,
        snapshotDigest: frozen!.digest,
      }),
      expect.objectContaining({
        eventType: "authority_claimed",
        fencingToken: "31",
        preparationVersion: 5,
        snapshotDigest: frozen!.digest,
      }),
      expect.objectContaining({
        eventType: "market_locked",
        occurredAt: frozen!.snapshot.betCloseTime,
        fencingToken: "31",
        preparationVersion: 5,
      }),
      expect.objectContaining({
        eventType: "duel_started",
        occurredAt: duelStartedAt,
        fencingToken: "31",
        preparationVersion: 5,
      }),
      expect.objectContaining({
        eventType: "terminal_committed",
        occurredAt: terminalAt,
        terminalOutcome: "cancelled",
        winnerId: null,
        winReason: null,
        reason: "integration_recovery_cancelled",
        terminalSeed: null,
        replayHash: null,
      }),
      expect.objectContaining({
        eventType: "recovery_committed",
        occurredAt: recoveredAt,
        fencingToken: "31",
        preparationVersion: 5,
      }),
    ]);
    expect(Object.keys(history[0]!).sort()).toEqual(
      [
        "actorAgentId",
        "agent1Id",
        "agent2Id",
        "cycleId",
        "duelId",
        "eventKey",
        "eventSequence",
        "eventSource",
        "eventType",
        "fencingToken",
        "occurredAt",
        "preparationId",
        "preparationVersion",
        "reason",
        "replayHash",
        "snapshotDigest",
        "terminalOutcome",
        "terminalSeed",
        "winnerId",
        "winReason",
      ].sort(),
    );

    const immutableEventSequence = history[0]!.eventSequence;
    await expect(
      pool.query(
        `UPDATE streaming_duel_transition_events
         SET "eventType" = "eventType" WHERE "eventSequence" = $1::bigint`,
        [immutableEventSequence],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      pool.query(
        `DELETE FROM streaming_duel_transition_events
         WHERE "eventSequence" = $1::bigint`,
        [immutableEventSequence],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      pool.query(`TRUNCATE streaming_duel_transition_events`),
    ).rejects.toMatchObject({ code: "55000" });
    expect(await store.getTransitionHistory(preparation.preparationId)).toEqual(
      history,
    );
  });

  it("cancels idempotently with a bounded machine-readable reason", async () => {
    const preparation = await store.create({
      preparationId: randomUUID(),
      fencingToken: "9",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    const cancelled = await store.cancel({
      preparationId: preparation.preparationId,
      fencingToken: "9",
      reason: "agent_disconnected",
    });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancellationReason: "agent_disconnected",
      version: 2,
    });
    expect(
      await store.cancel({
        preparationId: preparation.preparationId,
        fencingToken: "9",
        reason: "agent_disconnected",
      }),
    ).toEqual(cancelled);
    await expect(
      store.cancel({
        preparationId: preparation.preparationId,
        fencingToken: "9",
        reason: "not safe for logs",
      }),
    ).rejects.toThrow(/invalid.*reason/i);
    expect(
      (await store.getTransitionHistory(preparation.preparationId)).map(
        (event) => [event.eventType, event.reason],
      ),
    ).toEqual([
      ["preparation_selected", null],
      ["preparation_cancelled", "agent_disconnected"],
    ]);
  });

  it("serializes concurrent selections and leaves exactly one active session", async () => {
    const firstId = randomUUID();
    const secondId = randomUUID();
    await Promise.all([
      store.create({
        preparationId: firstId,
        fencingToken: "10",
        agent1Id,
        agent2Id,
        durationMs: 60_000,
        allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
      }),
      store.create({
        preparationId: secondId,
        fencingToken: "10",
        agent1Id,
        agent2Id: agent3Id,
        durationMs: 60_000,
        allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
      }),
    ]);

    const [first, second, activeCount] = await Promise.all([
      store.get(firstId),
      store.get(secondId),
      pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM streaming_duel_preparations
         WHERE status IN ('preparing', 'ready')`,
      ),
    ]);
    expect([first?.status, second?.status].sort()).toEqual([
      "cancelled",
      "preparing",
    ]);
    expect(activeCount.rows[0]?.count).toBe("1");
  });

  it("atomically couples the durable capability to retry-safe bank custody", async () => {
    const preparation = await store.create({
      preparationId: randomUUID(),
      fencingToken: "11",
      agent1Id,
      agent2Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    await pool.query(
      `INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex")
       VALUES ($1, $2, 2, 0)`,
      [agent1Id, bankItemId],
    );
    const inventorySystem = {
      isInventoryReady: () => true,
      queueOperation: async (
        _playerId: string,
        operation: () => Promise<boolean>,
      ) => operation(),
      lockForTransaction: () => true,
      unlockTransaction: () => undefined,
      persistInventoryImmediate: async () => undefined,
      reloadFromDatabase: async () => undefined,
    };
    const world = {
      pgPool: pool,
      entities: {
        get: (id: string) =>
          id === agent1Id
            ? { data: { inStreamingDuel: false }, position: [0, 0, 0] }
            : undefined,
      },
      getSystem: (name: string) =>
        name === "inventory" ? inventorySystem : null,
    };
    const operationId = randomUUID();
    const request = {
      world: world as never,
      playerId: agent1Id,
      bankId: getDuelPreparationBankId(preparation.preparationId),
      preparationId: preparation.preparationId,
      action: "deposit" as const,
      itemId: bankItemId,
      quantity: 1,
      operationId,
    };

    const committed = await executeAuthoritativeAgentBankTransfer(request);
    const replayed = await executeAuthoritativeAgentBankTransfer(request);
    expect(committed).toMatchObject({
      success: true,
      commitState: "committed",
      replayed: false,
      committedQuantity: 1,
    });
    expect(replayed).toMatchObject({
      success: true,
      commitState: "committed",
      replayed: true,
      committedQuantity: 1,
    });
    const custody = await pool.query<{
      inventoryQuantity: string;
      bankQuantity: string;
      operationCount: string;
    }>(
      `SELECT
         (SELECT COALESCE(SUM(quantity), 0)::text FROM inventory
          WHERE "playerId" = $1 AND "itemId" = $2) AS "inventoryQuantity",
         (SELECT COALESCE(SUM(quantity), 0)::text FROM bank_storage
          WHERE "playerId" = $1 AND "itemId" = $2) AS "bankQuantity",
         (SELECT count(*)::text FROM agent_bank_operations
          WHERE "operationId" = $3) AS "operationCount"`,
      [agent1Id, bankItemId, operationId],
    );
    expect(custody.rows[0]).toEqual({
      inventoryQuantity: "1",
      bankQuantity: "1",
      operationCount: "1",
    });

    await store.markReady({
      preparationId: preparation.preparationId,
      fencingToken: "11",
      agentId: agent1Id,
      planEvidence: planEvidence(agent1Id),
    });
    const rejected = await executeAuthoritativeAgentBankTransfer({
      ...request,
      action: "withdraw",
      operationId: randomUUID(),
    });
    expect(rejected).toMatchObject({
      success: false,
      commitState: "not_committed",
      failureReason: "preparation_agent_ready",
    });
  });

  it("serializes concurrent cross-process custody transfers without duplicating items", async () => {
    const preparation = await store.create({
      preparationId: randomUUID(),
      fencingToken: "12",
      agent1Id,
      agent2Id: agent3Id,
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    await pool.query(
      `INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex")
       VALUES ($1, $2, 1, 0)`,
      [agent3Id, bankItemId],
    );
    const inventorySystem = {
      isInventoryReady: () => true,
      queueOperation: async (
        _playerId: string,
        operation: () => Promise<boolean>,
      ) => operation(),
      // Always succeeding here intentionally models two independent server
      // processes whose in-memory locks cannot see each other.
      lockForTransaction: () => true,
      unlockTransaction: () => undefined,
      persistInventoryImmediate: async () => undefined,
      reloadFromDatabase: async () => undefined,
    };
    const world = {
      pgPool: pool,
      entities: {
        get: (id: string) =>
          id === agent3Id
            ? { data: { inStreamingDuel: false }, position: [0, 0, 0] }
            : undefined,
      },
      getSystem: (name: string) =>
        name === "inventory" ? inventorySystem : null,
    };
    const baseRequest = {
      world: world as never,
      playerId: agent3Id,
      bankId: getDuelPreparationBankId(preparation.preparationId),
      preparationId: preparation.preparationId,
      action: "deposit" as const,
      itemId: bankItemId,
      quantity: 1,
    };
    const operationIds = [randomUUID(), randomUUID()];

    const receipts = await Promise.all(
      operationIds.map((operationId) =>
        executeAuthoritativeAgentBankTransfer({
          ...baseRequest,
          operationId,
        }),
      ),
    );
    expect(receipts.filter((receipt) => receipt.success)).toHaveLength(1);
    expect(receipts.filter((receipt) => !receipt.success)).toEqual([
      expect.objectContaining({
        commitState: "not_committed",
        failureReason: "item_not_owned",
      }),
    ]);

    const custody = await pool.query<{
      inventoryQuantity: string;
      bankQuantity: string;
      operationCount: string;
    }>(
      `SELECT
         (SELECT COALESCE(SUM(quantity), 0)::text FROM inventory
          WHERE "playerId" = $1 AND "itemId" = $2) AS "inventoryQuantity",
         (SELECT COALESCE(SUM(quantity), 0)::text FROM bank_storage
          WHERE "playerId" = $1 AND "itemId" = $2) AS "bankQuantity",
         (SELECT count(*)::text FROM agent_bank_operations
          WHERE "operationId" = ANY($3::text[])) AS "operationCount"`,
      [agent3Id, bankItemId, operationIds],
    );
    expect(custody.rows[0]).toEqual({
      inventoryQuantity: "0",
      bankQuantity: "1",
      operationCount: "1",
    });
  });
});
