import { afterEach, describe, expect, it, vi } from "vitest";

import { dataManager } from "../../../../data/DataManager";
import { EventType } from "../../../../types/events";
import { EventBus } from "../../infrastructure/EventBus";
import { EquipmentSystem } from "../EquipmentSystem";

describe("EquipmentSystem atomic arrow debit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createFixture(
    commitImplementation?: (request: any) => Promise<any>,
  ) {
    const eventBus = new EventBus();
    const definitions = new Map<string, any>([
      [
        "shortbow",
        {
          id: "shortbow",
          name: "Shortbow",
          type: "weapon",
          attackType: "ranged",
          weaponType: "BOW",
          equipSlot: "2h",
          stackable: false,
        },
      ],
      [
        "bronze_arrow",
        {
          id: "bronze_arrow",
          name: "Bronze Arrow",
          type: "ammunition",
          equipSlot: "arrows",
          stackable: true,
        },
      ],
    ]);
    vi.spyOn(dataManager, "getItem").mockImplementation(
      (itemId: string) => definitions.get(itemId) ?? null,
    );

    let locked = false;
    const inventory = {
      lockForTransaction: vi.fn(() => {
        if (locked) return false;
        locked = true;
        return true;
      }),
      unlockTransaction: vi.fn(() => {
        locked = false;
      }),
    };
    const commit = vi.fn(
      commitImplementation ??
        (async (request: any) => ({
          operationId: request.operationId,
          playerId: request.playerId,
          requestFingerprint: request.requestFingerprint,
          replayed: false,
          slotType: request.slotType,
          itemId: request.itemId,
          quantity: request.quantity,
          committed: [
            { slotType: "weapon", itemId: "shortbow", quantity: 1 },
            { slotType: "arrows", itemId: "bronze_arrow", quantity: 1 },
          ],
        })),
    );
    const database = {
      savePlayerEquipmentAsync: vi.fn(async () => undefined),
      getPlayerEquipmentAsync: vi.fn(async () => [
        { slotType: "weapon", itemId: "shortbow", quantity: 1 },
        { slotType: "arrows", itemId: "bronze_arrow", quantity: 1 },
      ]),
      commitEquipmentStackDebitOperationAsync: commit,
    };
    const player = { id: "agent-a", data: {} };
    const world = {
      $eventBus: eventBus,
      isServer: true,
      entities: new Map([[player.id, player]]),
      network: { send: vi.fn() },
      getPlayer: (playerId: string) =>
        playerId === player.id ? player : undefined,
      getSystem: (name: string) => {
        if (name === "database") return database;
        if (name === "inventory") return inventory;
        return undefined;
      },
    };

    return { eventBus, world, database, inventory, commit, definitions };
  }

  async function initialize(fixture: ReturnType<typeof createFixture>) {
    const equipment = new EquipmentSystem(fixture.world as never);
    await equipment.init();
    fixture.eventBus.emitEvent(
      EventType.PLAYER_REGISTERED,
      { playerId: "agent-a" },
      "test",
    );
    const state = equipment.getPlayerEquipment("agent-a");
    if (!state) throw new Error("equipment not initialized");
    state.weapon.itemId = "shortbow";
    state.weapon.item = fixture.definitions.get("shortbow");
    state.weapon.quantity = 1;
    state.arrows.itemId = "bronze_arrow";
    state.arrows.item = fixture.definitions.get("bronze_arrow");
    state.arrows.quantity = 2;
    return equipment;
  }

  it("does not mutate live equipment before the durable receipt", async () => {
    let releaseCommit: ((receipt: any) => void) | undefined;
    const commitGate = new Promise<any>((resolve) => {
      releaseCommit = resolve;
    });
    const fixture = createFixture(async (request) => {
      const committed = await commitGate;
      return {
        operationId: request.operationId,
        playerId: request.playerId,
        requestFingerprint: request.requestFingerprint,
        replayed: false,
        slotType: request.slotType,
        itemId: request.itemId,
        quantity: request.quantity,
        committed,
      };
    });
    const equipment = await initialize(fixture);

    const pending = equipment.consumeArrowAtomic(
      "agent-a",
      "arrow-operation-1",
      "bronze_arrow",
    );
    await vi.waitFor(() => expect(fixture.commit).toHaveBeenCalledOnce());

    expect(equipment.getArrowCount("agent-a")).toBe(2);
    await expect(
      equipment.consumeArrowAtomic(
        "agent-a",
        "arrow-operation-2",
        "bronze_arrow",
      ),
    ).resolves.toMatchObject({ ok: false, reason: "inventory_busy" });

    releaseCommit?.([
      { slotType: "weapon", itemId: "shortbow", quantity: 1 },
      { slotType: "arrows", itemId: "bronze_arrow", quantity: 1 },
    ]);
    await expect(pending).resolves.toMatchObject({
      ok: true,
      changed: true,
      replayed: false,
    });
    expect(equipment.getArrowCount("agent-a")).toBe(1);
    expect(fixture.commit.mock.calls[0]?.[0]).toMatchObject({
      operationId: "arrow-operation-1",
      playerId: "agent-a",
      slotType: "arrows",
      itemId: "bronze_arrow",
      quantity: 1,
      requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(fixture.inventory.unlockTransaction).toHaveBeenCalledOnce();
  });

  it("retries an ambiguous response with the exact operation identity", async () => {
    let calls = 0;
    const fixture = createFixture(async (request) => {
      calls += 1;
      if (calls === 1) throw new Error("connection reset after commit");
      return {
        operationId: request.operationId,
        playerId: request.playerId,
        requestFingerprint: request.requestFingerprint,
        replayed: true,
        slotType: request.slotType,
        itemId: request.itemId,
        quantity: request.quantity,
        committed: [
          { slotType: "weapon", itemId: "shortbow", quantity: 1 },
          { slotType: "arrows", itemId: "bronze_arrow", quantity: 1 },
        ],
      };
    });
    const equipment = await initialize(fixture);

    await expect(
      equipment.consumeArrowAtomic(
        "agent-a",
        "arrow-operation-replay",
        "bronze_arrow",
      ),
    ).resolves.toMatchObject({ ok: true, replayed: true });
    expect(fixture.commit).toHaveBeenCalledTimes(2);
    expect(fixture.commit.mock.calls[1]?.[0]).toEqual(
      fixture.commit.mock.calls[0]?.[0],
    );
    expect(equipment.getArrowCount("agent-a")).toBe(1);
  });

  it("leaves live equipment unchanged after a deterministic rejection", async () => {
    const fixture = createFixture(async () => {
      throw new Error("equipment_stack_debit_insufficient_items");
    });
    const equipment = await initialize(fixture);

    await expect(
      equipment.consumeArrowAtomic(
        "agent-a",
        "arrow-operation-insufficient",
        "bronze_arrow",
      ),
    ).resolves.toMatchObject({ ok: false, reason: "insufficient_items" });
    expect(fixture.commit).toHaveBeenCalledOnce();
    expect(equipment.getArrowCount("agent-a")).toBe(2);
    expect(fixture.inventory.unlockTransaction).toHaveBeenCalledOnce();
  });

  it("clears the arrow slot when the committed debit consumes the final arrow", async () => {
    const fixture = createFixture(async (request) => ({
      operationId: request.operationId,
      playerId: request.playerId,
      requestFingerprint: request.requestFingerprint,
      replayed: false,
      slotType: request.slotType,
      itemId: request.itemId,
      quantity: request.quantity,
      committed: [{ slotType: "weapon", itemId: "shortbow", quantity: 1 }],
    }));
    const equipment = await initialize(fixture);
    equipment.getPlayerEquipment("agent-a")!.arrows.quantity = 1;

    await expect(
      equipment.consumeArrowAtomic(
        "agent-a",
        "arrow-operation-final",
        "bronze_arrow",
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(equipment.getArrowCount("agent-a")).toBe(0);
    expect(equipment.getPlayerEquipment("agent-a")?.arrows.itemId).toBeNull();
  });
});
