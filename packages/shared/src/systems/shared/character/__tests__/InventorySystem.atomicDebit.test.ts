import { describe, expect, it, vi } from "vitest";

import { getItem } from "../../../../data/items";
import type {
  InventoryDebitCommitRequest,
  InventoryDebitCommitReceipt,
  InventorySaveItem,
} from "../../../../types/network/database";
import { EventBus } from "../../infrastructure/EventBus";
import { InventorySystem } from "../InventorySystem";

const PLAYER_ID = "atomic-rune-agent";

function inventoryRows(air = 10, mind = 5, water = 3): InventorySaveItem[] {
  return [
    { itemId: "air_rune", quantity: air, slotIndex: 0, metadata: null },
    { itemId: "mind_rune", quantity: mind, slotIndex: 1, metadata: null },
    { itemId: "water_rune", quantity: water, slotIndex: 2, metadata: null },
  ].filter((item) => item.quantity > 0);
}

function createFixture(
  commit: (
    request: InventoryDebitCommitRequest,
  ) => Promise<InventoryDebitCommitReceipt>,
) {
  const database = { commitInventoryDebitOperationAsync: vi.fn(commit) };
  const eventBus = new EventBus();
  const world = {
    $eventBus: eventBus,
    isServer: true,
    getSystem: (name: string) => (name === "database" ? database : undefined),
  };
  const inventory = new InventorySystem(world as never);
  const items = inventoryRows().map((row) => {
    const item = getItem(row.itemId);
    if (!item) throw new Error(`missing test item ${row.itemId}`);
    return {
      slot: row.slotIndex,
      itemId: row.itemId,
      quantity: row.quantity,
      item,
    };
  });
  (
    inventory as unknown as {
      playerInventories: Map<
        string,
        { playerId: string; items: typeof items; coins: number }
      >;
    }
  ).playerInventories.set(PLAYER_ID, {
    playerId: PLAYER_ID,
    items,
    coins: 0,
  });
  return { inventory, database };
}

function quantities(inventory: InventorySystem): Record<string, number> {
  return Object.fromEntries(
    (inventory.getInventory(PLAYER_ID)?.items ?? []).map((item) => [
      item.itemId,
      item.quantity,
    ]),
  );
}

describe("InventorySystem atomic inventory debit", () => {
  it("changes no live slot until every item type has committed", async () => {
    let releaseCommit:
      ((receipt: InventoryDebitCommitReceipt) => void) | undefined;
    const gate = new Promise<InventoryDebitCommitReceipt>((resolve) => {
      releaseCommit = resolve;
    });
    const fixture = createFixture(async () => gate);
    const pending = fixture.inventory.debitItemsAtomic(PLAYER_ID, "spell-1", [
      { itemId: "mind_rune", quantity: 1 },
      { itemId: "air_rune", quantity: 2 },
    ]);

    await vi.waitFor(() => {
      expect(
        fixture.database.commitInventoryDebitOperationAsync,
      ).toHaveBeenCalledOnce();
    });
    expect(quantities(fixture.inventory)).toEqual({
      air_rune: 10,
      mind_rune: 5,
      water_rune: 3,
    });
    expect(fixture.inventory.isLockedForTransaction(PLAYER_ID)).toBe(true);
    await expect(
      fixture.inventory.removeItemDirect(PLAYER_ID, {
        itemId: "water_rune",
        quantity: 1,
      }),
    ).resolves.toBe(false);
    await expect(
      fixture.inventory.addItemDirect(PLAYER_ID, {
        itemId: "water_rune",
        quantity: 1,
      }),
    ).resolves.toBe(false);
    expect(quantities(fixture.inventory).water_rune).toBe(3);

    const request =
      fixture.database.commitInventoryDebitOperationAsync.mock.calls[0][0];
    expect(request.requirements).toEqual([
      { itemId: "air_rune", quantity: 2 },
      { itemId: "mind_rune", quantity: 1 },
    ]);
    expect(request.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);
    releaseCommit?.({
      ...request,
      replayed: false,
      committed: inventoryRows(8, 4, 3),
    });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ ok: true, replayed: false }),
    );
    expect(quantities(fixture.inventory)).toEqual({
      air_rune: 8,
      mind_rune: 4,
      water_rune: 3,
    });
    expect(fixture.inventory.isLockedForTransaction(PLAYER_ID)).toBe(false);
  });

  it("leaves all live quantities untouched when any required item is insufficient", async () => {
    const fixture = createFixture(async () => {
      throw new Error("inventory_debit_insufficient_items");
    });

    await expect(
      fixture.inventory.debitItemsAtomic(PLAYER_ID, "spell-2", [
        { itemId: "air_rune", quantity: 1 },
        { itemId: "mind_rune", quantity: 999 },
      ]),
    ).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: "insufficient_items" }),
    );
    expect(quantities(fixture.inventory)).toEqual({
      air_rune: 10,
      mind_rune: 5,
      water_rune: 3,
    });
    expect(
      fixture.database.commitInventoryDebitOperationAsync,
    ).toHaveBeenCalledOnce();
  });

  it("recovers a lost commit response with the same operation and applies once", async () => {
    let authoritative = inventoryRows();
    let stored: InventoryDebitCommitReceipt | undefined;
    let calls = 0;
    const fixture = createFixture(async (request) => {
      calls += 1;
      if (!stored) {
        authoritative = inventoryRows(9, 4, 3);
        stored = {
          ...request,
          replayed: false,
          committed: authoritative,
        };
        throw new Error("ECONNRESET after COMMIT");
      }
      return { ...stored, replayed: true, committed: authoritative };
    });

    await expect(
      fixture.inventory.debitItemsAtomic(PLAYER_ID, "spell-3", [
        { itemId: "air_rune", quantity: 1 },
        { itemId: "mind_rune", quantity: 1 },
      ]),
    ).resolves.toEqual(expect.objectContaining({ ok: true, replayed: true }));
    expect(calls).toBe(2);
    expect(quantities(fixture.inventory)).toEqual({
      air_rune: 9,
      mind_rune: 4,
      water_rune: 3,
    });
  });

  it("serializes concurrent debits and combines duplicate requirements", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let authoritative = inventoryRows();
    let callCount = 0;
    const fixture = createFixture(async (request) => {
      callCount += 1;
      if (callCount === 1) await firstGate;
      const requestedAir = request.requirements.find(
        (item) => item.itemId === "air_rune",
      )?.quantity;
      expect(requestedAir).toBe(callCount === 1 ? 2 : 1);
      authoritative = inventoryRows(
        authoritative[0]!.quantity - requestedAir!,
        authoritative[1]!.quantity,
        authoritative[2]!.quantity,
      );
      return {
        ...request,
        replayed: false,
        committed: authoritative,
      };
    });

    const first = fixture.inventory.debitItemsAtomic(PLAYER_ID, "spell-4", [
      { itemId: "air_rune", quantity: 1 },
      { itemId: "air_rune", quantity: 1 },
    ]);
    const second = fixture.inventory.debitItemsAtomic(PLAYER_ID, "spell-5", [
      { itemId: "air_rune", quantity: 1 },
    ]);
    await vi.waitFor(() => expect(callCount).toBe(1));
    expect(quantities(fixture.inventory).air_rune).toBe(10);
    releaseFirst?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ ok: true }),
    ]);
    expect(callCount).toBe(2);
    expect(quantities(fixture.inventory).air_rune).toBe(7);
  });

  it("rejects malformed quantities before persistence", async () => {
    const fixture = createFixture(async (request) => ({
      ...request,
      replayed: false,
      committed: inventoryRows(),
    }));

    await expect(
      fixture.inventory.debitItemsAtomic(PLAYER_ID, "spell-6", [
        { itemId: "air_rune", quantity: Number.NaN },
      ]),
    ).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: "invalid_request" }),
    );
    expect(
      fixture.database.commitInventoryDebitOperationAsync,
    ).not.toHaveBeenCalled();
    expect(quantities(fixture.inventory).air_rune).toBe(10);
  });
});
