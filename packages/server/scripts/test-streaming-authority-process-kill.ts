import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ITEMS, type World } from "@hyperforge/shared";
import {
  executeAuthoritativeAgentBankTransfer,
  getDuelPreparationBankId,
} from "../src/eliza/AuthoritativeAgentBanking.js";
import {
  PostgresStreamingDuelLeaseStore,
  StreamingDuelAuthorityController,
  type StreamingDuelAuthorityConfig,
} from "../src/systems/StreamingDuelScheduler/authority.js";
import {
  DUEL_PREPARATION_BANK_ACTIONS,
  PostgresDuelPreparationStore,
} from "../src/systems/StreamingDuelScheduler/preparation.js";

const { Pool } = pg;
const scriptPath = fileURLToPath(import.meta.url);
const CHAOS_BANK_ITEM_ID = "chaos_bank_item";
const CHAOS_BANK_PLAYER_ID = "chaos-agent-a";

type WorkerEvent = {
  event:
    | "scheduler_started"
    | "scheduler_stopped"
    | "bank_committed"
    | "worker_error";
  holderId: string;
  pid: number;
  at: number;
  reason?: string;
  message?: string;
  operationId?: string;
  committedQuantity?: number;
  replayed?: boolean;
};

function emitWorkerEvent(event: WorkerEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function createBankWorld(pool: pg.Pool): World {
  const inventorySystem = {
    isInventoryReady: () => true,
    queueOperation: async (
      _playerId: string,
      operation: () => Promise<boolean>,
    ) => await operation(),
    lockForTransaction: () => true,
    unlockTransaction: () => undefined,
    persistInventoryImmediate: async () => undefined,
    reloadFromDatabase: async () => undefined,
  };
  return {
    pgPool: pool,
    entities: {
      get: (id: string) =>
        id === CHAOS_BANK_PLAYER_ID
          ? { data: { inStreamingDuel: false }, position: [0, 0, 0] }
          : undefined,
    },
    getSystem: (name: string) =>
      name === "inventory" ? inventorySystem : null,
  } as unknown as World;
}

async function runWorker(): Promise<void> {
  const connectionString = process.env.STREAMING_AUTHORITY_TEST_DATABASE_URL;
  const holderId = process.env.STREAMING_AUTHORITY_TEST_HOLDER_ID;
  const leaseName = process.env.STREAMING_AUTHORITY_TEST_LEASE_NAME;
  const preparationId = process.env.STREAMING_AUTHORITY_TEST_PREPARATION_ID;
  const bankOperationId =
    process.env.STREAMING_AUTHORITY_TEST_BANK_OPERATION_ID;
  if (!connectionString || !holderId || !leaseName) {
    throw new Error("worker authority test configuration is incomplete");
  }
  if (holderId === "authority-a" && (!preparationId || !bankOperationId)) {
    throw new Error("worker bank recovery test configuration is incomplete");
  }

  const pool = new Pool({ connectionString, max: 1 });
  const previousChaosBankItem = ITEMS.get(CHAOS_BANK_ITEM_ID);
  let schedulerRunning = false;
  const config: StreamingDuelAuthorityConfig = {
    role: "authority",
    leaseName,
    leaseDurationMs: 5_000,
    renewIntervalMs: 1_000,
    acquireRetryMs: 200,
  };
  const controller = new StreamingDuelAuthorityController(
    config,
    new PostgresStreamingDuelLeaseStore(pool),
    {
      start: () => {
        schedulerRunning = true;
        emitWorkerEvent({
          event: "scheduler_started",
          holderId,
          pid: process.pid,
          at: Date.now(),
        });
      },
      stop: (reason) => {
        schedulerRunning = false;
        emitWorkerEvent({
          event: "scheduler_stopped",
          holderId,
          pid: process.pid,
          at: Date.now(),
          reason,
        });
      },
      isRunning: () => schedulerRunning,
    },
    {
      holderId,
      onError: (message) => process.stderr.write(`${message}\n`),
    },
  );

  let stopping = false;
  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await controller.stop();
    await pool.end();
    if (previousChaosBankItem) {
      ITEMS.set(CHAOS_BANK_ITEM_ID, previousChaosBankItem);
    } else {
      ITEMS.delete(CHAOS_BANK_ITEM_ID);
    }
    process.exit(0);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());

  try {
    await controller.start();
    if (holderId === "authority-a") {
      if (!schedulerRunning) {
        throw new Error("bank commit attempted before authority verification");
      }
      ITEMS.set(CHAOS_BANK_ITEM_ID, {
        id: CHAOS_BANK_ITEM_ID,
        name: "Chaos Bank Item",
        type: "resource",
        stackable: true,
      } as never);
      const receipt = await executeAuthoritativeAgentBankTransfer({
        world: createBankWorld(pool),
        playerId: CHAOS_BANK_PLAYER_ID,
        bankId: getDuelPreparationBankId(preparationId!),
        preparationId: preparationId!,
        action: "deposit",
        itemId: CHAOS_BANK_ITEM_ID,
        quantity: 1,
        operationId: bankOperationId!,
      });
      if (
        !receipt.success ||
        receipt.commitState !== "committed" ||
        receipt.replayed ||
        receipt.committedQuantity !== 1
      ) {
        throw new Error(
          `initial authority bank commit failed: ${JSON.stringify(receipt)}`,
        );
      }
      emitWorkerEvent({
        event: "bank_committed",
        holderId,
        pid: process.pid,
        at: Date.now(),
        operationId: receipt.operationId,
        committedQuantity: receipt.committedQuantity,
        replayed: receipt.replayed,
      });
    }
  } catch (error) {
    emitWorkerEvent({
      event: "worker_error",
      holderId,
      pid: process.pid,
      at: Date.now(),
      message: error instanceof Error ? error.message : String(error),
    });
    await controller.stop();
    await pool.end();
    if (previousChaosBankItem) {
      ITEMS.set(CHAOS_BANK_ITEM_ID, previousChaosBankItem);
    } else {
      ITEMS.delete(CHAOS_BANK_ITEM_ID);
    }
    process.exit(1);
  }

  await new Promise(() => {});
}

function resolveDockerBinary(): string {
  const configured = process.env.DOCKER_BIN?.trim();
  const candidates = [
    configured,
    "/usr/local/bin/docker",
    "/opt/homebrew/bin/docker",
    "/Applications/Docker.app/Contents/Resources/bin/docker",
    "docker",
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) =>
    candidate.includes("/") ? existsSync(candidate) : true,
  )!;
}

async function runCommand(
  command: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !options.allowFailure) {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited ${exitCode}: ${stderr.trim()}`,
          ),
        );
        return;
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

type WorkerProbe = {
  child: ChildProcessWithoutNullStreams;
  events: WorkerEvent[];
  stderr: string[];
};

function spawnWorker(input: {
  connectionString: string;
  holderId: string;
  leaseName: string;
  preparationId: string;
  bankOperationId: string;
}): WorkerProbe {
  const child = spawn(process.execPath, [scriptPath, "--worker"], {
    env: {
      ...process.env,
      STREAMING_AUTHORITY_TEST_DATABASE_URL: input.connectionString,
      STREAMING_AUTHORITY_TEST_HOLDER_ID: input.holderId,
      STREAMING_AUTHORITY_TEST_LEASE_NAME: input.leaseName,
      STREAMING_AUTHORITY_TEST_PREPARATION_ID: input.preparationId,
      STREAMING_AUTHORITY_TEST_BANK_OPERATION_ID: input.bankOperationId,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end();
  const probe: WorkerProbe = { child, events: [], stderr: [] };
  let buffered = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffered += chunk;
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      try {
        probe.events.push(JSON.parse(line) as WorkerEvent);
      } catch {
        // Ignore non-event runtime output; stderr is retained for diagnostics.
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => probe.stderr.push(chunk));
  return probe;
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  failureMessage: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(failureMessage);
}

async function waitForExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("worker did not exit")), timeoutMs),
    ),
  ]);
}

async function runParent(): Promise<void> {
  const docker = resolveDockerBinary();
  const containerName = `hyperia-streaming-authority-chaos-${process.pid}`;
  const databaseUser = "authority_test";
  const databaseName = "authority_test";
  const databasePassword = `authority-${randomUUID()}`;
  const leaseName = `process-kill-${randomUUID()}`;
  const preparationId = randomUUID();
  const bankOperationId = randomUUID();
  const image =
    process.env.STREAMING_AUTHORITY_TEST_POSTGRES_IMAGE?.trim() ||
    "postgres:16-alpine";
  const workers: WorkerProbe[] = [];
  let pool: pg.Pool | null = null;
  let containerStarted = false;
  const previousChaosBankItem = ITEMS.get(CHAOS_BANK_ITEM_ID);

  try {
    await runCommand(docker, ["info", "--format", "{{.ServerVersion}}"]);
    const existing = await runCommand(
      docker,
      ["container", "inspect", containerName],
      { allowFailure: true },
    );
    if (existing.code === 0) {
      throw new Error(`refusing to reuse existing container ${containerName}`);
    }

    await runCommand(docker, [
      "run",
      "--rm",
      "-d",
      "--name",
      containerName,
      "-e",
      `POSTGRES_USER=${databaseUser}`,
      "-e",
      `POSTGRES_PASSWORD=${databasePassword}`,
      "-e",
      `POSTGRES_DB=${databaseName}`,
      "-p",
      "127.0.0.1::5432",
      image,
    ]);
    containerStarted = true;
    const portResult = await runCommand(docker, [
      "port",
      containerName,
      "5432/tcp",
    ]);
    const portMatch = portResult.stdout.trim().match(/:(\d+)$/);
    if (!portMatch)
      throw new Error("could not resolve temporary PostgreSQL port");
    const connectionString = `postgresql://${databaseUser}:${encodeURIComponent(databasePassword)}@127.0.0.1:${portMatch[1]}/${databaseName}`;
    pool = new Pool({ connectionString, max: 2 });

    await waitFor(
      async () => {
        try {
          await pool!.query("SELECT 1");
          return true;
        } catch {
          return false;
        }
      },
      30_000,
      "temporary PostgreSQL did not become ready",
    );
    await pool.query(
      readFileSync(
        new URL(
          "../src/database/migrations/0056_add_streaming_scheduler_leases.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await pool.query(`CREATE TABLE characters (id text PRIMARY KEY NOT NULL)`);
    await pool.query(
      `INSERT INTO characters (id) VALUES ('chaos-agent-a'), ('chaos-agent-b')`,
    );
    await pool.query(`
      CREATE TABLE inventory (
        id serial PRIMARY KEY,
        "playerId" text NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        "itemId" text NOT NULL,
        quantity integer DEFAULT 1,
        "slotIndex" integer DEFAULT -1,
        metadata jsonb
      )
    `);
    await pool.query(`
      CREATE TABLE bank_storage (
        id serial PRIMARY KEY,
        "playerId" text NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        "itemId" text NOT NULL,
        quantity integer DEFAULT 1 NOT NULL,
        slot integer DEFAULT 0 NOT NULL,
        "tabIndex" integer DEFAULT 0 NOT NULL,
        UNIQUE ("playerId", "tabIndex", slot)
      )
    `);
    await pool.query(
      readFileSync(
        new URL(
          "../src/database/migrations/0059_add_agent_bank_operation_receipts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await pool.query(
      readFileSync(
        new URL(
          "../src/database/migrations/0060_add_streaming_duel_preparations.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const preparationStore = new PostgresDuelPreparationStore(pool);
    const abandonedPreparation = await preparationStore.create({
      preparationId,
      fencingToken: "1",
      agent1Id: "chaos-agent-a",
      agent2Id: "chaos-agent-b",
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    await pool.query(
      `INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex")
       VALUES ($1, $2, 1, 0)`,
      [CHAOS_BANK_PLAYER_ID, CHAOS_BANK_ITEM_ID],
    );

    const first = spawnWorker({
      connectionString,
      holderId: "authority-a",
      leaseName,
      preparationId,
      bankOperationId,
    });
    workers.push(first);
    await waitFor(
      () => first.events.some((event) => event.event === "scheduler_started"),
      10_000,
      `first authority did not start: ${first.stderr.join("")}`,
    );
    await waitFor(
      () => first.events.some((event) => event.event === "bank_committed"),
      10_000,
      `first authority did not commit bank transfer: ${first.stderr.join("")}`,
    );
    const initialBankCommit = first.events.find(
      (event) => event.event === "bank_committed",
    );
    if (
      initialBankCommit?.operationId !== bankOperationId ||
      initialBankCommit.committedQuantity !== 1 ||
      initialBankCommit.replayed !== false
    ) {
      throw new Error("first authority reported an invalid bank receipt");
    }
    await preparationStore.markReady({
      preparationId: abandonedPreparation.preparationId,
      fencingToken: "1",
      agentId: CHAOS_BANK_PLAYER_ID,
    });

    const second = spawnWorker({
      connectionString,
      holderId: "authority-b",
      leaseName,
      preparationId,
      bankOperationId,
    });
    workers.push(second);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    if (second.events.some((event) => event.event === "scheduler_started")) {
      throw new Error("standby scheduler started before authority failure");
    }

    const killedAt = Date.now();
    first.child.kill("SIGKILL");
    await waitForExit(first.child, 5_000);
    await waitFor(
      () => second.events.some((event) => event.event === "scheduler_started"),
      10_000,
      `standby did not acquire after hard kill: ${second.stderr.join("")}`,
    );
    const takeover = second.events.find(
      (event) => event.event === "scheduler_started",
    )!;
    if (takeover.at - killedAt < 3_000) {
      throw new Error(
        "standby started before the killed holder's lease expired",
      );
    }

    const leaseResult = await pool.query<{
      holder_id: string;
      fencing_token: string;
    }>(
      `SELECT holder_id, fencing_token FROM streaming_scheduler_leases WHERE lease_name = $1`,
      [leaseName],
    );
    const lease = leaseResult.rows[0];
    if (lease?.holder_id !== "authority-b" || lease.fencing_token !== "2") {
      throw new Error(
        "takeover did not preserve holder identity/fencing order",
      );
    }
    const recoveredPreparation = await preparationStore.getActive();
    if (
      recoveredPreparation?.preparationId !==
        abandonedPreparation.preparationId ||
      recoveredPreparation.agent1ReadyAt === null ||
      recoveredPreparation.agent2ReadyAt !== null
    ) {
      throw new Error(
        "hard-kill recovery did not preserve the partial preparation",
      );
    }
    ITEMS.set(CHAOS_BANK_ITEM_ID, {
      id: CHAOS_BANK_ITEM_ID,
      name: "Chaos Bank Item",
      type: "resource",
      stackable: true,
    } as never);
    const replayReceipt = await executeAuthoritativeAgentBankTransfer({
      world: createBankWorld(pool),
      playerId: CHAOS_BANK_PLAYER_ID,
      bankId: getDuelPreparationBankId(preparationId),
      preparationId,
      action: "deposit",
      itemId: CHAOS_BANK_ITEM_ID,
      quantity: 1,
      operationId: bankOperationId,
    });
    if (
      !replayReceipt.success ||
      replayReceipt.commitState !== "committed" ||
      !replayReceipt.replayed ||
      replayReceipt.committedQuantity !== 1 ||
      replayReceipt.inventoryQuantityAfter !== 0 ||
      replayReceipt.bankQuantityAfter !== 1
    ) {
      throw new Error(
        `hard-kill bank replay did not reconcile: ${JSON.stringify(replayReceipt)}`,
      );
    }
    const inventoryCustody = await pool.query<{ quantity: number }>(
      `SELECT COALESCE(SUM(quantity), 0)::int AS quantity
       FROM inventory WHERE "playerId" = $1 AND "itemId" = $2`,
      [CHAOS_BANK_PLAYER_ID, CHAOS_BANK_ITEM_ID],
    );
    const bankCustody = await pool.query<{ quantity: number }>(
      `SELECT COALESCE(SUM(quantity), 0)::int AS quantity
       FROM bank_storage WHERE "playerId" = $1 AND "itemId" = $2`,
      [CHAOS_BANK_PLAYER_ID, CHAOS_BANK_ITEM_ID],
    );
    const operationCustody = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM agent_bank_operations WHERE "operationId" = $1`,
      [bankOperationId],
    );
    if (
      inventoryCustody.rows[0]?.quantity !== 0 ||
      bankCustody.rows[0]?.quantity !== 1 ||
      operationCustody.rows[0]?.count !== 1
    ) {
      throw new Error("hard-kill bank replay duplicated or lost custody");
    }
    const replacementPreparation = await preparationStore.create({
      preparationId: randomUUID(),
      fencingToken: lease.fencing_token,
      agent1Id: "chaos-agent-a",
      agent2Id: "chaos-agent-b",
      durationMs: 60_000,
      allowedBankActions: DUEL_PREPARATION_BANK_ACTIONS,
    });
    const supersededPreparation = await preparationStore.get(
      abandonedPreparation.preparationId,
    );
    if (
      replacementPreparation.fencingToken !== "2" ||
      supersededPreparation?.status !== "cancelled" ||
      supersededPreparation.cancellationReason !== "superseded"
    ) {
      throw new Error(
        "takeover did not fence and supersede the killed authority's preparation",
      );
    }
    const failedPreparation = await preparationStore.cancel({
      preparationId: replacementPreparation.preparationId,
      fencingToken: lease.fencing_token,
      reason: "agent_preparation_failed",
    });
    const recoveredFailureCancellation = await new PostgresDuelPreparationStore(
      pool,
    ).get(replacementPreparation.preparationId);
    if (
      failedPreparation?.status !== "cancelled" ||
      failedPreparation.cancellationReason !== "agent_preparation_failed" ||
      recoveredFailureCancellation?.status !== "cancelled" ||
      recoveredFailureCancellation.cancellationReason !==
        "agent_preparation_failed"
    ) {
      throw new Error(
        "agent preparation failure cancellation was not durably recoverable",
      );
    }

    second.child.kill("SIGTERM");
    await waitForExit(second.child, 5_000);
    const released = await pool.query<{ released: boolean }>(
      `
        SELECT expires_at <=
          (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint AS released
        FROM streaming_scheduler_leases
        WHERE lease_name = $1
      `,
      [leaseName],
    );
    if (released.rows[0]?.released !== true) {
      throw new Error("graceful standby shutdown did not release the lease");
    }

    process.stdout.write(
      `${JSON.stringify({
        firstPid: first.child.pid,
        secondPid: second.child.pid,
        takeoverDelayMs: takeover.at - killedAt,
        fencingToken: lease.fencing_token,
        staleOverlap: false,
        gracefulRelease: true,
        partialPreparationRecovered: true,
        stalePreparationSuperseded: true,
        bankReplayAfterProcessKill: true,
        bankReplayAfterReadinessFreeze: true,
        bankCustodyDuplicated: false,
        agentPreparationFailureCancellationDurable: true,
      })}\n`,
    );
  } finally {
    for (const worker of workers) {
      if (worker.child.exitCode === null && worker.child.signalCode === null) {
        worker.child.kill("SIGKILL");
        await waitForExit(worker.child, 2_000).catch(() => {});
      }
    }
    if (pool) await pool.end().catch(() => {});
    if (previousChaosBankItem) {
      ITEMS.set(CHAOS_BANK_ITEM_ID, previousChaosBankItem);
    } else {
      ITEMS.delete(CHAOS_BANK_ITEM_ID);
    }
    if (containerStarted) {
      await runCommand(docker, ["stop", "--time", "1", containerName], {
        allowFailure: true,
      });
    }
  }
}

if (process.argv.includes("--worker")) {
  await runWorker();
} else {
  await runParent();
}
