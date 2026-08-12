import { randomUUID } from "node:crypto";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { ITEMS } from "@hyperforge/shared";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPostgresClientDatabase } from "../../../database/postgres-transaction.js";
import * as schema from "../../../database/schema.js";
import { DatabaseSystem } from "../index.js";

const baseDatabaseUrl =
  process.env.AGENT_AUTONOMY_PROGRESSION_TEST_DATABASE_URL?.trim() ?? "";
const describeDatabase = baseDatabaseUrl ? describe.sequential : describe.skip;

describeDatabase("atomic safe-area death custody", () => {
  let adminPool: pg.Pool;
  let pool: pg.Pool;
  let databaseName: string;
  let databaseSystem: DatabaseSystem;
  const playerId = "safe-death-agent";
  const priorItems = new Map(
    ["shrimp", "bronze_shortsword"].map((itemId) => [
      itemId,
      ITEMS.get(itemId),
    ]),
  );

  beforeAll(async () => {
    ITEMS.set("shrimp", {
      id: "shrimp",
      name: "Shrimp",
      type: "food",
      value: 3,
      stackable: false,
    } as never);
    ITEMS.set("bronze_shortsword", {
      id: "bronze_shortsword",
      name: "Bronze Shortsword",
      type: "weapon",
      value: 100,
      stackable: false,
    } as never);
    databaseName = `hyperia_safe_death_${process.pid}_${Date.now().toString(36)}`;
    const adminUrl = new URL(baseDatabaseUrl);
    adminUrl.pathname = "/postgres";
    adminPool = new pg.Pool({ connectionString: adminUrl.toString(), max: 2 });
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);

    const testUrl = new URL(baseDatabaseUrl);
    testUrl.pathname = `/${databaseName}`;
    pool = new pg.Pool({ connectionString: testUrl.toString(), max: 8 });
    const migrationClient = await pool.connect();
    try {
      await migrate(createPostgresClientDatabase(migrationClient), {
        migrationsFolder: path.resolve(
          import.meta.dirname,
          "../../../database/migrations",
        ),
      });
    } finally {
      migrationClient.release();
    }

    const db = drizzle(pool, { schema });
    await db.insert(schema.users).values({
      id: "safe-death-account",
      name: "Safe Death Account",
      roles: "user",
      createdAt: "2026-08-11T00:00:00.000Z",
    });
    await db.insert(schema.characters).values({
      id: playerId,
      accountId: "safe-death-account",
      name: "Safe Death Agent",
      isAgent: 1,
    });
    await db.insert(schema.inventory).values(
      Array.from({ length: 4 }, (_, slotIndex) => ({
        playerId,
        itemId: "shrimp",
        quantity: 1,
        slotIndex,
      })),
    );
    await db.insert(schema.equipment).values({
      playerId,
      slotType: "weapon",
      itemId: "bronze_shortsword",
      quantity: 1,
    });
    databaseSystem = new DatabaseSystem({} as never);
    (databaseSystem as unknown as { db: typeof db }).db = db;
    (databaseSystem as unknown as { pool: pg.Pool }).pool = pool;
  }, 30_000);

  afterAll(async () => {
    for (const [itemId, item] of priorItems) {
      if (item) ITEMS.set(itemId, item);
      else ITEMS.delete(itemId);
    }
    await pool?.end();
    if (adminPool && databaseName) {
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [databaseName],
      );
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await adminPool.end();
    }
  }, 30_000);

  it("conserves every item exactly across capture, restart replay, kept return, and grave recovery", async () => {
    const deathOperationId = randomUUID();
    const deathRequest = {
      operationId: deathOperationId,
      playerId,
      deathTimestamp: 1_786_395_600_000,
      position: { x: -8.5, y: 28.2, z: -16 },
      killedBy: "wolf",
    };
    const captured =
      await databaseSystem.commitSafeAreaDeathOperationAsync(deathRequest);
    expect(captured).toMatchObject({
      replayed: false,
      dropped: [{ itemId: "shrimp", quantity: 2 }],
      kept: [
        { itemId: "bronze_shortsword", quantity: 1 },
        { itemId: "shrimp", quantity: 2 },
      ],
    });
    await expect(
      pool.query(
        `SELECT
           (SELECT count(*)::int FROM inventory WHERE "playerId" = $1) AS inventory_rows,
           (SELECT count(*)::int FROM equipment WHERE "playerId" = $1) AS equipment_rows`,
        [playerId],
      ),
    ).resolves.toMatchObject({
      rows: [{ inventory_rows: 0, equipment_rows: 0 }],
    });

    const activeLock = await pool.query<{
      items: Array<{ itemId: string; quantity: number }>;
      keptItems: Array<{ itemId: string; quantity: number }>;
      deathOperationId: string;
    }>(
      `SELECT items, "keptItems", "deathOperationId"
       FROM player_deaths WHERE "playerId" = $1`,
      [playerId],
    );
    expect(activeLock.rows).toEqual([
      {
        items: [{ itemId: "shrimp", quantity: 2 }],
        keptItems: [
          { itemId: "bronze_shortsword", quantity: 1 },
          { itemId: "shrimp", quantity: 2 },
        ],
        deathOperationId,
      },
    ]);

    // A distinct second death cannot replace unresolved custody.
    const secondOperationId = randomUUID();
    await expect(
      databaseSystem.commitSafeAreaDeathOperationAsync({
        ...deathRequest,
        operationId: secondOperationId,
        deathTimestamp: deathRequest.deathTimestamp + 1,
      }),
    ).rejects.toThrow("safe_death_active_lock_exists");
    const rejectedReceipt = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM operations_log WHERE id = $1`,
      [secondOperationId],
    );
    expect(rejectedReceipt.rows[0]?.count).toBe("0");

    // Construct a fresh system over the same database to model process restart.
    const db = drizzle(pool, { schema });
    const restarted = new DatabaseSystem({} as never);
    (restarted as unknown as { db: typeof db }).db = db;
    (restarted as unknown as { pool: pg.Pool }).pool = pool;
    await expect(
      restarted.commitSafeAreaDeathOperationAsync(deathRequest),
    ).resolves.toMatchObject({ replayed: true, dropped: captured.dropped });

    const kept = await restarted.commitSafeAreaDeathKeptReturnAsync({
      playerId,
      deathOperationId,
    });
    expect(kept).toMatchObject({ replayed: false, returned: captured.kept });
    await expect(
      restarted.commitSafeAreaDeathKeptReturnAsync({
        playerId,
        deathOperationId,
      }),
    ).resolves.toMatchObject({ replayed: true, returned: captured.kept });

    const gravestoneId = "gravestone_safe-death-agent_exact";
    await pool.query(
      `UPDATE player_deaths SET "gravestoneId" = $2 WHERE "playerId" = $1`,
      [playerId, gravestoneId],
    );
    const firstLootOperationId = randomUUID();
    const firstLoot = await restarted.commitSafeAreaDeathGravestoneLootAsync({
      operationId: firstLootOperationId,
      playerId,
      deathOperationId,
      gravestoneId,
      items: [{ itemId: "shrimp", quantity: 1 }],
    });
    expect(firstLoot).toMatchObject({
      replayed: false,
      transferred: [{ itemId: "shrimp", quantity: 1 }],
      remaining: [{ itemId: "shrimp", quantity: 1 }],
    });
    await expect(
      restarted.commitSafeAreaDeathGravestoneLootAsync({
        operationId: firstLootOperationId,
        playerId,
        deathOperationId,
        gravestoneId,
        items: [{ itemId: "shrimp", quantity: 1 }],
      }),
    ).resolves.toMatchObject({
      replayed: true,
      transferred: firstLoot.transferred,
    });

    const finalLoot = await restarted.commitSafeAreaDeathGravestoneLootAsync({
      operationId: randomUUID(),
      playerId,
      deathOperationId,
      gravestoneId,
    });
    expect(finalLoot).toMatchObject({
      replayed: false,
      transferred: [{ itemId: "shrimp", quantity: 1 }],
      remaining: [],
    });

    const finalCustody = await pool.query<{
      itemId: string;
      quantity: number;
    }>(
      `SELECT "itemId", sum(quantity)::int AS quantity
       FROM inventory WHERE "playerId" = $1
       GROUP BY "itemId" ORDER BY "itemId"`,
      [playerId],
    );
    expect(finalCustody.rows).toEqual([
      { itemId: "bronze_shortsword", quantity: 1 },
      { itemId: "shrimp", quantity: 4 },
    ]);
    const terminal = await pool.query<{
      death_count: string;
      operation_count: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM player_deaths WHERE "playerId" = $1) AS death_count,
         (SELECT count(*)::text FROM operations_log WHERE "playerId" = $1) AS operation_count`,
      [playerId],
    );
    expect(terminal.rows).toEqual([{ death_count: "0", operation_count: "4" }]);
  });
});
