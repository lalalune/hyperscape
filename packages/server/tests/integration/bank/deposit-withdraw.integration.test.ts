/**
 * Bank Deposit/Withdraw Handler Integration Tests
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { EventType } from "@hyperforge/shared";
import * as schema from "../../../src/database/schema";
import {
  handleBankClose,
  handleBankDeposit,
  handleBankDepositAll,
  handleBankOpen,
  handleBankWithdraw,
} from "../../../src/systems/ServerNetwork/handlers/bank";
import { rateLimiter } from "../../../src/systems/ServerNetwork/handlers/bank/utils";
import { seedBankStorage, seedInventory, setupBankTestEnv } from "./helpers";

// Skipped: pg-mem + Drizzle ORM 0.44+ compatibility
describe.skip("Bank deposit/withdraw handlers (integration)", () => {
  let cleanup: () => Promise<void>;
  let world: Awaited<ReturnType<typeof setupBankTestEnv>>["world"];
  let socket: Awaited<ReturnType<typeof setupBankTestEnv>>["socket"];
  let db: Awaited<ReturnType<typeof setupBankTestEnv>>["db"];
  let playerId: string;

  beforeEach(async () => {
    const env = await setupBankTestEnv();
    cleanup = env.cleanup;
    world = env.world;
    socket = env.socket;
    db = env.db;
    playerId = env.playerId;
    rateLimiter.reset(playerId);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("deposits inventory items into bank storage", async () => {
    await seedInventory(db.db, playerId, [
      { itemId: "logs", quantity: 1, slotIndex: 0 },
      { itemId: "logs", quantity: 1, slotIndex: 1 },
    ]);

    await handleBankDeposit(
      socket as never,
      { itemId: "logs", quantity: 2, slot: 0 },
      world as never,
    );

    const bankRows = await db.db
      .select()
      .from(schema.bankStorage)
      .where(eq(schema.bankStorage.playerId, playerId));
    const inventoryRows = await db.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.playerId, playerId));

    expect(bankRows.find((row) => row.itemId === "logs")?.quantity).toBe(2);
    expect(inventoryRows.length).toBe(0);
  });

  it("withdraws bank items into inventory", async () => {
    await seedBankStorage(db.db, playerId, [
      { itemId: "logs", quantity: 2, slot: 0, tabIndex: 0 },
    ]);

    await handleBankWithdraw(
      socket as never,
      { itemId: "logs", quantity: 1, slot: 0, tabIndex: 0 },
      world as never,
    );

    const bankRows = await db.db
      .select()
      .from(schema.bankStorage)
      .where(eq(schema.bankStorage.playerId, playerId));
    const inventoryRows = await db.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.playerId, playerId));

    expect(bankRows.find((row) => row.itemId === "logs")?.quantity).toBe(1);
    expect(inventoryRows.length).toBe(1);
    expect(inventoryRows[0]?.itemId).toBe("logs");
  });

  it("deposits all inventory items", async () => {
    await seedInventory(db.db, playerId, [
      { itemId: "logs", quantity: 1, slotIndex: 0 },
      { itemId: "bronze_sword", quantity: 1, slotIndex: 1 },
    ]);

    await handleBankDepositAll(socket as never, {}, world as never);

    const bankRows = await db.db
      .select()
      .from(schema.bankStorage)
      .where(eq(schema.bankStorage.playerId, playerId));

    const bankItems = bankRows.map((row) => row.itemId).sort();
    expect(bankItems).toEqual(["bronze_sword", "logs"]);
  });

  it("sends bank state on open", async () => {
    await handleBankOpen(
      socket as never,
      { bankId: "bank-entity-1" },
      world as never,
    );

    const bankState = socket.sent.find((msg) => msg.packet === "bankState");
    expect(bankState?.data).toMatchObject({
      isOpen: true,
      bankId: "bank-entity-1",
    });
  });

  it("emits bank close event", () => {
    handleBankClose(socket as never, {}, world as never);

    const closeEvent = world.emitted.find(
      (evt) => evt.event === EventType.BANK_CLOSE,
    );
    expect(closeEvent?.data).toMatchObject({ playerId });
  });
});
