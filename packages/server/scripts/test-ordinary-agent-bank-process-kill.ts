import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ITEMS } from "@hyperforge/shared";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { createPostgresClientDatabase } from "../src/database/postgres-transaction.js";
import { executeAuthoritativeAgentBankTransfer } from "../src/eliza/AuthoritativeAgentBanking.js";
import {
  beginAgentAutonomyProgressionAttempt,
  recoverOpenAgentAutonomyProgressionAttempt,
} from "../src/eliza/agentAutonomyProgression.js";
import type { AgentInstance } from "../src/eliza/managers/AgentBehaviorTicker.js";
import {
  getOrdinaryBankOperationId,
  getOrdinaryBankStageOperationId,
  resolveOrdinaryBankingRecovery,
} from "../src/eliza/ordinaryAgentBanking.js";

const ATTEMPT_ID = "6de83f0c-52dd-4496-b234-d679a76152ad";
const WITHDRAW_ATTEMPT_ID = "e2e81860-e084-4a56-a9df-d3bd368593a4";
const COMPOSITE_ATTEMPT_ID = "0fc0bd47-66e2-4c5f-a414-b9f6f0f779a2";
const CHARACTER_ID = "ordinary-bank-process-kill-agent";
const ACCOUNT_ID = "ordinary-bank-process-kill-account";
const TOOL_ID = "ordinary_bank_process_tool";
const RESOURCE_ID = "ordinary_bank_process_resource";
const COMPOSITE_ITEM_A = "ordinary_bank_process_composite_a";
const COMPOSITE_ITEM_B = "ordinary_bank_process_composite_b";

function makeInstance(): AgentInstance {
  return {
    config: {
      characterId: CHARACTER_ID,
      accountId: ACCOUNT_ID,
      name: "Ordinary Bank Process Kill Agent",
    },
    goal: { type: "banking", description: "Bank verified surplus" },
    memories: [],
    recentActionLog: [],
    tickCounter: 0,
    pendingLlmResult: undefined,
  } as unknown as AgentInstance;
}

function registerItems(): void {
  ITEMS.set(TOOL_ID, {
    id: TOOL_ID,
    name: "Process Tool",
    type: "tool",
    stackable: false,
  } as never);
  ITEMS.set(RESOURCE_ID, {
    id: RESOURCE_ID,
    name: "Process Resource",
    type: "resource",
    stackable: true,
  } as never);
  ITEMS.set(COMPOSITE_ITEM_A, {
    id: COMPOSITE_ITEM_A,
    name: "Process Composite A",
    type: "resource",
    stackable: false,
  } as never);
  ITEMS.set(COMPOSITE_ITEM_B, {
    id: COMPOSITE_ITEM_B,
    name: "Process Composite B",
    type: "resource",
    stackable: true,
  } as never);
}

async function runWriter(
  connectionString: string,
  mode: "deposit" | "withdraw" | "composite",
): Promise<never> {
  registerItems();
  const pool = new pg.Pool({ connectionString, max: 4 });
  const inventorySystem = {
    isInventoryReady: () => true,
    queueOperation: async (
      _playerId: string,
      operation: () => Promise<boolean>,
    ) => operation(),
    lockForTransaction: () => true,
    unlockTransaction: () => undefined,
    persistInventoryImmediate: async () => undefined,
    reloadFromDatabase: async () => {
      await pool.query(
        `SELECT "itemId", quantity FROM inventory WHERE "playerId" = $1`,
        [CHARACTER_ID],
      );
    },
  };
  const entities = new Map<string, unknown>([
    [
      CHARACTER_ID,
      { position: { x: 0, y: 0, z: 0 }, data: { inStreamingDuel: false } },
    ],
    ["bank-1", { position: { x: 1, y: 0, z: 1 }, data: { type: "bank" } }],
  ]);
  const world = {
    pgPool: pool,
    entities: { get: (id: string) => entities.get(id) },
    getSystem: (name: string) =>
      name === "inventory" ? inventorySystem : null,
  };

  const attempt = await beginAgentAutonomyProgressionAttempt(pool, {
    attemptId:
      mode === "deposit"
        ? ATTEMPT_ID
        : mode === "withdraw"
          ? WITHDRAW_ATTEMPT_ID
          : COMPOSITE_ATTEMPT_ID,
    characterId: CHARACTER_ID,
    goalType: "banking",
    actionType: mode === "deposit" ? "bankDepositAll" : "bankWithdraw",
    decisionSource: "scripted",
    startedAt:
      mode === "deposit" ? 10_000 : mode === "withdraw" ? 11_000 : 12_000,
  });
  const receipt =
    mode === "deposit"
      ? await executeAuthoritativeAgentBankTransfer({
          world: world as never,
          playerId: CHARACTER_ID,
          bankId: "bank-1",
          action: "deposit_all",
          operationId: getOrdinaryBankOperationId(attempt.attemptId),
          retainedItems: [{ itemId: TOOL_ID, quantity: 1 }],
        })
      : mode === "withdraw"
        ? await executeAuthoritativeAgentBankTransfer({
            world: world as never,
            playerId: CHARACTER_ID,
            bankId: "bank-1",
            action: "withdraw",
            itemId: RESOURCE_ID,
            quantity: 5,
            operationId: getOrdinaryBankStageOperationId(attempt.attemptId),
          })
        : await executeAuthoritativeAgentBankTransfer({
            world: world as never,
            playerId: CHARACTER_ID,
            bankId: "bank-1",
            action: "withdraw",
            withdrawItems: [
              { itemId: COMPOSITE_ITEM_B, quantity: 3 },
              { itemId: COMPOSITE_ITEM_A, quantity: 2 },
            ],
            operationId: getOrdinaryBankStageOperationId(attempt.attemptId),
          });
  const valid =
    mode === "deposit"
      ? receipt.success &&
        receipt.committedQuantity === 7 &&
        receipt.inventoryQuantityAfter === 1
      : mode === "withdraw"
        ? receipt.success &&
          receipt.committedQuantity === 5 &&
          receipt.inventoryQuantityAfter === 5 &&
          receipt.bankQuantityAfter === 2
        : receipt.success &&
          receipt.itemId === null &&
          receipt.committedQuantity === 5 &&
          receipt.inventoryQuantityAfter === 5 &&
          receipt.bankQuantityAfter === null;
  if (!valid) {
    throw new Error(
      `writer ${mode} receipt mismatch: ${JSON.stringify(receipt)}`,
    );
  }
  process.stdout.write(
    mode === "deposit"
      ? "BANK_RECEIPT_AND_CUSTODY_COMMITTED\n"
      : mode === "withdraw"
        ? "BANK_WITHDRAWAL_RECEIPT_AND_CUSTODY_COMMITTED\n"
        : "BANK_COMPOSITE_RECEIPT_AND_CUSTODY_COMMITTED\n",
  );
  await new Promise<never>(() => {});
}

async function waitForWriterReady(
  child: ReturnType<typeof spawn>,
  marker: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let output = "";
    let errors = "";
    const timeout = setTimeout(
      () => reject(new Error(`bank writer readiness timeout: ${errors}`)),
      20_000,
    );
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.includes(marker)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      errors += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (!output.includes(marker)) {
        clearTimeout(timeout);
        reject(
          new Error(
            `bank writer exited before readiness: ${code ?? signal}: ${errors}`,
          ),
        );
      }
    });
  });
}

async function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}

async function runParent(): Promise<void> {
  const baseUrl =
    process.env.AGENT_AUTONOMY_PROGRESSION_TEST_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Set AGENT_AUTONOMY_PROGRESSION_TEST_DATABASE_URL for the bank process-kill proof",
    );
  }

  const databaseName = `hyperia_bank_kill_${process.pid}_${Date.now().toString(36)}`;
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new pg.Pool({
    connectionString: adminUrl.toString(),
    max: 2,
  });
  let pool: pg.Pool | null = null;
  let child: ReturnType<typeof spawn> | null = null;

  try {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const testUrl = new URL(baseUrl);
    testUrl.pathname = `/${databaseName}`;
    pool = new pg.Pool({ connectionString: testUrl.toString(), max: 12 });
    const migrationClient = await pool.connect();
    try {
      await migrate(createPostgresClientDatabase(migrationClient), {
        migrationsFolder: path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../src/database/migrations",
        ),
      });
    } finally {
      migrationClient.release();
    }
    await pool.query(
      `INSERT INTO users (id, name, roles, "createdAt")
       VALUES ($1, 'Ordinary Bank Kill Account', 'user', '2026-08-10T00:00:00.000Z')`,
      [ACCOUNT_ID],
    );
    await pool.query(
      `INSERT INTO characters (id, "accountId", name, "isAgent")
       VALUES ($1, $2, 'Ordinary Bank Kill Agent', 1)`,
      [CHARACTER_ID, ACCOUNT_ID],
    );
    await pool.query(
      `INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex")
       VALUES ($1, $2, 1, 0), ($1, $3, 7, 1)`,
      [CHARACTER_ID, TOOL_ID, RESOURCE_ID],
    );

    child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "--writer", testUrl.toString()],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    await waitForWriterReady(child, "BANK_RECEIPT_AND_CUSTODY_COMMITTED");
    if (!child.kill("SIGKILL")) throw new Error("failed to kill bank writer");
    await waitForExit(child);

    const replacements = await Promise.all(
      Array.from({ length: 5 }, () =>
        recoverOpenAgentAutonomyProgressionAttempt(
          pool!,
          makeInstance(),
          10_500,
          resolveOrdinaryBankingRecovery,
        ),
      ),
    );
    const recovered = replacements.filter(
      (value): value is NonNullable<typeof value> => value !== null,
    );
    if (recovered.length !== 1) {
      throw new Error(
        `expected one bank recovery winner, got ${recovered.length}`,
      );
    }
    if (
      recovered[0].checkpoint.lastActionOutcome !== "completed" ||
      recovered[0].checkpoint.lastAppliedActionType !== "bankDepositAll" ||
      recovered[0].checkpoint.requiresReassessment !== true
    ) {
      throw new Error("bank recovery checkpoint did not preserve exact truth");
    }

    const proof = await pool.query<{
      receipt_count: string;
      carried_tool: string;
      carried_resource: string;
      banked_resource: string;
      terminal_source: string;
      terminal_outcome: string;
      applied_action: string;
      open_attempt_id: string | null;
    }>(
      `SELECT
         (SELECT count(*)::text FROM agent_bank_operations
          WHERE "operationId" = $2) AS receipt_count,
         COALESCE((SELECT sum(quantity)::text FROM inventory
          WHERE "playerId" = $1 AND "itemId" = $3), '0') AS carried_tool,
         COALESCE((SELECT sum(quantity)::text FROM inventory
          WHERE "playerId" = $1 AND "itemId" = $4), '0') AS carried_resource,
         COALESCE((SELECT sum(quantity)::text FROM bank_storage
          WHERE "playerId" = $1 AND "itemId" = $4), '0') AS banked_resource,
         (SELECT event_source FROM agent_autonomy_progression_events
          WHERE attempt_id = $5 AND event_type = 'attempt_terminal') AS terminal_source,
         (SELECT action_outcome FROM agent_autonomy_progression_events
          WHERE attempt_id = $5 AND event_type = 'attempt_terminal') AS terminal_outcome,
         (SELECT applied_action_type FROM agent_autonomy_progression_events
          WHERE attempt_id = $5 AND event_type = 'attempt_terminal') AS applied_action,
         (SELECT open_attempt_id FROM agent_autonomy_progression_heads
          WHERE character_id = $1) AS open_attempt_id`,
      [
        CHARACTER_ID,
        getOrdinaryBankOperationId(ATTEMPT_ID),
        TOOL_ID,
        RESOURCE_ID,
        ATTEMPT_ID,
      ],
    );
    const row = proof.rows[0];
    if (
      row.receipt_count !== "1" ||
      row.carried_tool !== "1" ||
      row.carried_resource !== "0" ||
      row.banked_resource !== "7" ||
      row.terminal_source !== "restart_reconciliation" ||
      row.terminal_outcome !== "completed" ||
      row.applied_action !== "bankDepositAll" ||
      row.open_attempt_id !== null
    ) {
      throw new Error(
        `bank process-kill proof mismatch: ${JSON.stringify(row)}`,
      );
    }

    child = spawn(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        "--writer",
        testUrl.toString(),
        "withdraw",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    await waitForWriterReady(
      child,
      "BANK_WITHDRAWAL_RECEIPT_AND_CUSTODY_COMMITTED",
    );
    if (!child.kill("SIGKILL")) {
      throw new Error("failed to kill bank withdrawal writer");
    }
    await waitForExit(child);

    const withdrawalReplacements = await Promise.all(
      Array.from({ length: 5 }, () =>
        recoverOpenAgentAutonomyProgressionAttempt(
          pool!,
          makeInstance(),
          11_500,
          resolveOrdinaryBankingRecovery,
        ),
      ),
    );
    const withdrawalRecovered = withdrawalReplacements.filter(
      (value): value is NonNullable<typeof value> => value !== null,
    );
    if (
      withdrawalRecovered.length !== 1 ||
      withdrawalRecovered[0].checkpoint.lastActionOutcome !== "completed" ||
      withdrawalRecovered[0].checkpoint.lastAppliedActionType !== "bankWithdraw"
    ) {
      throw new Error(
        `bank withdrawal recovery mismatch: ${JSON.stringify(withdrawalRecovered)}`,
      );
    }

    const withdrawalProof = await pool.query<{
      receipt_count: string;
      carried_resource: string;
      banked_resource: string;
      terminal_source: string;
      terminal_outcome: string;
      applied_action: string;
      open_attempt_id: string | null;
    }>(
      `SELECT
         (SELECT count(*)::text FROM agent_bank_operations
          WHERE "operationId" = $2) AS receipt_count,
         COALESCE((SELECT sum(quantity)::text FROM inventory
          WHERE "playerId" = $1 AND "itemId" = $3), '0') AS carried_resource,
         COALESCE((SELECT sum(quantity)::text FROM bank_storage
          WHERE "playerId" = $1 AND "itemId" = $3), '0') AS banked_resource,
         (SELECT event_source FROM agent_autonomy_progression_events
          WHERE attempt_id = $4 AND event_type = 'attempt_terminal') AS terminal_source,
         (SELECT action_outcome FROM agent_autonomy_progression_events
          WHERE attempt_id = $4 AND event_type = 'attempt_terminal') AS terminal_outcome,
         (SELECT applied_action_type FROM agent_autonomy_progression_events
          WHERE attempt_id = $4 AND event_type = 'attempt_terminal') AS applied_action,
         (SELECT open_attempt_id FROM agent_autonomy_progression_heads
          WHERE character_id = $1) AS open_attempt_id`,
      [
        CHARACTER_ID,
        getOrdinaryBankStageOperationId(WITHDRAW_ATTEMPT_ID),
        RESOURCE_ID,
        WITHDRAW_ATTEMPT_ID,
      ],
    );
    const withdrawalRow = withdrawalProof.rows[0];
    if (
      withdrawalRow.receipt_count !== "1" ||
      withdrawalRow.carried_resource !== "5" ||
      withdrawalRow.banked_resource !== "2" ||
      withdrawalRow.terminal_source !== "restart_reconciliation" ||
      withdrawalRow.terminal_outcome !== "completed" ||
      withdrawalRow.applied_action !== "bankWithdraw" ||
      withdrawalRow.open_attempt_id !== null
    ) {
      throw new Error(
        `bank withdrawal process-kill proof mismatch: ${JSON.stringify(withdrawalRow)}`,
      );
    }

    await pool.query(
      `INSERT INTO bank_storage
         ("playerId", "itemId", quantity, slot, "tabIndex")
       VALUES
         ($1, $2, 4,
          (SELECT COALESCE(max(slot), -1) + 1 FROM bank_storage
           WHERE "playerId" = $1 AND "tabIndex" = 0), 0),
         ($1, $3, 8,
          (SELECT COALESCE(max(slot), -1) + 2 FROM bank_storage
           WHERE "playerId" = $1 AND "tabIndex" = 0), 0)`,
      [CHARACTER_ID, COMPOSITE_ITEM_A, COMPOSITE_ITEM_B],
    );
    child = spawn(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        "--writer",
        testUrl.toString(),
        "composite",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    await waitForWriterReady(
      child,
      "BANK_COMPOSITE_RECEIPT_AND_CUSTODY_COMMITTED",
    );
    if (!child.kill("SIGKILL")) {
      throw new Error("failed to kill composite bank writer");
    }
    await waitForExit(child);

    const compositeReplacements = await Promise.all(
      Array.from({ length: 5 }, () =>
        recoverOpenAgentAutonomyProgressionAttempt(
          pool!,
          makeInstance(),
          12_500,
          resolveOrdinaryBankingRecovery,
        ),
      ),
    );
    const compositeRecovered = compositeReplacements.filter(
      (value): value is NonNullable<typeof value> => value !== null,
    );
    if (
      compositeRecovered.length !== 1 ||
      compositeRecovered[0].checkpoint.lastActionOutcome !== "completed" ||
      compositeRecovered[0].checkpoint.lastAppliedActionType !== "bankWithdraw"
    ) {
      throw new Error(
        `composite bank recovery mismatch: ${JSON.stringify(compositeRecovered)}`,
      );
    }

    const compositeProof = await pool.query<{
      receipt_count: string;
      component_count: string;
      requested_total: string;
      committed_total: string;
      carried_a: string;
      carried_b: string;
      banked_a: string;
      banked_b: string;
      terminal_source: string;
      terminal_outcome: string;
      open_attempt_id: string | null;
    }>(
      `SELECT
         (SELECT count(*)::text FROM agent_bank_operations
          WHERE "operationId" = $2) AS receipt_count,
         (SELECT count(*)::text FROM agent_bank_operation_items
          WHERE "operationId" = $2) AS component_count,
         (SELECT sum("requestedQuantity")::text
          FROM agent_bank_operation_items
          WHERE "operationId" = $2) AS requested_total,
         (SELECT sum("committedQuantity")::text
          FROM agent_bank_operation_items
          WHERE "operationId" = $2) AS committed_total,
         COALESCE((SELECT sum(quantity)::text FROM inventory
          WHERE "playerId" = $1 AND "itemId" = $3), '0') AS carried_a,
         COALESCE((SELECT sum(quantity)::text FROM inventory
          WHERE "playerId" = $1 AND "itemId" = $4), '0') AS carried_b,
         COALESCE((SELECT sum(quantity)::text FROM bank_storage
          WHERE "playerId" = $1 AND "itemId" = $3), '0') AS banked_a,
         COALESCE((SELECT sum(quantity)::text FROM bank_storage
          WHERE "playerId" = $1 AND "itemId" = $4), '0') AS banked_b,
         (SELECT event_source FROM agent_autonomy_progression_events
          WHERE attempt_id = $5 AND event_type = 'attempt_terminal') AS terminal_source,
         (SELECT action_outcome FROM agent_autonomy_progression_events
          WHERE attempt_id = $5 AND event_type = 'attempt_terminal') AS terminal_outcome,
         (SELECT open_attempt_id FROM agent_autonomy_progression_heads
          WHERE character_id = $1) AS open_attempt_id`,
      [
        CHARACTER_ID,
        getOrdinaryBankStageOperationId(COMPOSITE_ATTEMPT_ID),
        COMPOSITE_ITEM_A,
        COMPOSITE_ITEM_B,
        COMPOSITE_ATTEMPT_ID,
      ],
    );
    const compositeRow = compositeProof.rows[0];
    if (
      compositeRow.receipt_count !== "1" ||
      compositeRow.component_count !== "2" ||
      compositeRow.requested_total !== "5" ||
      compositeRow.committed_total !== "5" ||
      compositeRow.carried_a !== "2" ||
      compositeRow.carried_b !== "3" ||
      compositeRow.banked_a !== "2" ||
      compositeRow.banked_b !== "5" ||
      compositeRow.terminal_source !== "restart_reconciliation" ||
      compositeRow.terminal_outcome !== "completed" ||
      compositeRow.open_attempt_id !== null
    ) {
      throw new Error(
        `composite bank process-kill proof mismatch: ${JSON.stringify(compositeRow)}`,
      );
    }

    process.stdout.write(
      `${JSON.stringify({
        writerKilledAfterBankCommit: true,
        startCommittedBeforeCustody: true,
        exactReceiptRecoveredAfterRestart: true,
        oneOfFiveReplacementWorkersRecovered: true,
        committedActionNotReplayed: row.receipt_count === "1",
        retainedToolQuantity: Number(row.carried_tool),
        bankedSurplusQuantity: Number(row.banked_resource),
        withdrawalWriterKilledAfterCommit: true,
        exactWithdrawalReceiptRecoveredAfterRestart: true,
        oneOfFiveWithdrawalReplacementWorkersRecovered: true,
        withdrawalCommittedActionNotReplayed:
          withdrawalRow.receipt_count === "1",
        stagedResourceQuantity: Number(withdrawalRow.carried_resource),
        bankedResourceRemaining: Number(withdrawalRow.banked_resource),
        terminalSource: row.terminal_source,
        terminalOutcome: row.terminal_outcome,
        withdrawalTerminalSource: withdrawalRow.terminal_source,
        withdrawalTerminalOutcome: withdrawalRow.terminal_outcome,
        compositeWriterKilledAfterCommit: true,
        exactCompositeReceiptRecoveredAfterRestart: true,
        oneOfFiveCompositeReplacementWorkersRecovered: true,
        compositeCommittedActionNotReplayed: compositeRow.receipt_count === "1",
        compositeComponentCount: Number(compositeRow.component_count),
        compositeRequestedTotal: Number(compositeRow.requested_total),
        compositeCommittedTotal: Number(compositeRow.committed_total),
        compositeCarriedA: Number(compositeRow.carried_a),
        compositeCarriedB: Number(compositeRow.carried_b),
        compositeBankedA: Number(compositeRow.banked_a),
        compositeBankedB: Number(compositeRow.banked_b),
        compositeTerminalSource: compositeRow.terminal_source,
        compositeTerminalOutcome: compositeRow.terminal_outcome,
      })}\n`,
    );
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await waitForExit(child);
    }
    await pool?.end();
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [databaseName],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await adminPool.end();
  }
}

if (process.argv[2] === "--writer") {
  const connectionString = process.argv[3];
  if (!connectionString) throw new Error("writer connection string missing");
  await runWriter(
    connectionString,
    process.argv[4] === "withdraw"
      ? "withdraw"
      : process.argv[4] === "composite"
        ? "composite"
        : "deposit",
  );
} else {
  await runParent();
}
