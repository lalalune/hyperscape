import { describe, expect, it, vi } from "vitest";

import { getItem } from "../../../../data/items";
import { PlayerMigration } from "../../../../types/core/core";
import { EventBus } from "../../infrastructure/EventBus";
import { PlayerSystem } from "../PlayerSystem";

describe("PlayerSystem atomic food consumption", () => {
  function createFixture(
    debitImplementation?: (...args: any[]) => Promise<any>,
  ) {
    const eventBus = new EventBus();
    const healthComponent = {
      data: { current: 30, max: 60, isDead: false },
    };
    const entity = {
      setHealth: vi.fn((health: number) => {
        healthComponent.data.current = health;
      }),
      getComponent: vi.fn((name: string) =>
        name === "health" ? healthComponent : null,
      ),
    };
    const rawInventory = {
      playerId: "agent-a",
      coins: 0,
      items: [
        {
          slot: 4,
          itemId: "lobster",
          quantity: 2,
          item: getItem("lobster")!,
        },
      ],
    };
    const debitItemsAtomic = vi.fn(
      debitImplementation ??
        (async (
          playerId: string,
          operationId: string,
          requirements: any[],
        ) => ({
          ok: true,
          playerId,
          operationId,
          changed: true,
          replayed: false,
          requirements,
        })),
    );
    const inventory = {
      getInventory: vi.fn(() => rawInventory),
      debitItemsAtomic,
    };
    const world = {
      isServer: true,
      currentTick: 100,
      $eventBus: eventBus,
      entities: new Map([["agent-a", entity]]),
      getPlayer: vi.fn(() => entity),
      getSystem: vi.fn((name: string) =>
        name === "inventory" ? inventory : undefined,
      ),
    };
    const system = new PlayerSystem(world as never);
    const player = PlayerMigration.createNewPlayer(
      "agent-a",
      "agent-a",
      "Agent A",
    );
    player.health.current = 30;
    player.health.max = 60;
    player.alive = true;
    (
      system as unknown as {
        players: Map<string, typeof player>;
      }
    ).players.set(player.id, player);

    return {
      world,
      system,
      player,
      entity,
      healthComponent,
      rawInventory,
      debitItemsAtomic,
    };
  }

  it("does not heal, delay, or message before the durable debit receipt", async () => {
    let releaseDebit: ((receipt: any) => void) | undefined;
    const debitGate = new Promise<any>((resolve) => {
      releaseDebit = resolve;
    });
    const fixture = createFixture(async () => debitGate);
    const emitEvent = vi.spyOn(fixture.world.$eventBus, "emitEvent");

    const pending = fixture.system.consumeFoodAtomic(
      "agent-a",
      "lobster",
      4,
      "food-operation-1",
    );
    await vi.waitFor(() =>
      expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce(),
    );

    expect(fixture.player.health.current).toBe(30);
    expect(fixture.entity.setHealth).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalledWith(
      "ui:message",
      expect.anything(),
      expect.anything(),
    );

    releaseDebit?.({
      ok: true,
      playerId: "agent-a",
      operationId: "food-operation-1",
      changed: true,
      replayed: false,
      requirements: [{ itemId: "lobster", quantity: 1 }],
    });
    await expect(pending).resolves.toMatchObject({
      ok: true,
      committed: true,
      consumed: true,
      healedAmount: 12,
      newHealth: 42,
    });
    expect(fixture.debitItemsAtomic).toHaveBeenCalledWith(
      "agent-a",
      "food-operation-1",
      [{ itemId: "lobster", quantity: 1 }],
    );
    expect(fixture.player.health.current).toBe(42);
  });

  it("preserves damage that lands while durable custody is pending", async () => {
    let releaseDebit: ((receipt: any) => void) | undefined;
    const fixture = createFixture(
      async () =>
        new Promise<any>((resolve) => {
          releaseDebit = resolve;
        }),
    );
    const pending = fixture.system.consumeFoodAtomic(
      "agent-a",
      "lobster",
      4,
      "food-operation-damage",
    );
    await vi.waitFor(() =>
      expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce(),
    );

    fixture.player.health.current = 20;
    fixture.healthComponent.data.current = 20;
    releaseDebit?.({
      ok: true,
      playerId: "agent-a",
      operationId: "food-operation-damage",
      changed: true,
      replayed: false,
      requirements: [{ itemId: "lobster", quantity: 1 }],
    });

    await expect(pending).resolves.toMatchObject({
      ok: true,
      healedAmount: 12,
      newHealth: 32,
    });
    expect(fixture.player.health.current).toBe(32);
  });

  it("creates no heal when inventory custody fails", async () => {
    const fixture = createFixture(async () => ({
      ok: false,
      playerId: "agent-a",
      operationId: "food-operation-failed",
      changed: false,
      replayed: false,
      requirements: [{ itemId: "lobster", quantity: 1 }],
      reason: "persistence_failed",
    }));

    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        4,
        "food-operation-failed",
      ),
    ).resolves.toMatchObject({
      ok: false,
      committed: false,
      consumed: false,
      reason: "persistence_failed",
    });
    expect(fixture.player.health.current).toBe(30);
    expect(fixture.entity.setHealth).not.toHaveBeenCalled();

    // A failed attempt does not consume the eat-delay budget.
    fixture.debitItemsAtomic.mockResolvedValueOnce({
      ok: true,
      playerId: "agent-a",
      operationId: "food-operation-retry",
      changed: true,
      replayed: false,
      requirements: [{ itemId: "lobster", quantity: 1 }],
    });
    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        4,
        "food-operation-retry",
      ),
    ).resolves.toMatchObject({ ok: true, newHealth: 42 });
  });

  it("allows only one in-flight food action per player", async () => {
    let releaseDebit: ((receipt: any) => void) | undefined;
    const fixture = createFixture(
      async () =>
        new Promise<any>((resolve) => {
          releaseDebit = resolve;
        }),
    );
    const first = fixture.system.consumeFoodAtomic(
      "agent-a",
      "lobster",
      4,
      "food-operation-first",
    );
    await vi.waitFor(() =>
      expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce(),
    );
    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        4,
        "food-operation-second",
      ),
    ).resolves.toMatchObject({
      ok: false,
      reason: "action_in_progress",
    });
    expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce();

    releaseDebit?.({
      ok: true,
      playerId: "agent-a",
      operationId: "food-operation-first",
      changed: true,
      replayed: false,
      requirements: [{ itemId: "lobster", quantity: 1 }],
    });
    await expect(first).resolves.toMatchObject({ ok: true });
  });

  it("replays one operation without applying its heal twice", async () => {
    const fixture = createFixture();
    const first = await fixture.system.consumeFoodAtomic(
      "agent-a",
      "lobster",
      4,
      "food-operation-replayed",
    );
    expect(first).toMatchObject({ ok: true, replayed: false, newHealth: 42 });

    const replay = await fixture.system.consumeFoodAtomic(
      "agent-a",
      "lobster",
      4,
      "food-operation-replayed",
    );
    expect(replay).toMatchObject({ ok: true, replayed: true, newHealth: 42 });
    expect(fixture.player.health.current).toBe(42);
    expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce();
  });

  it("makes a committed debit terminal when the player dies before healing", async () => {
    let releaseDebit: ((receipt: any) => void) | undefined;
    const fixture = createFixture(
      async () =>
        new Promise<any>((resolve) => {
          releaseDebit = resolve;
        }),
    );
    const pending = fixture.system.consumeFoodAtomic(
      "agent-a",
      "lobster",
      4,
      "food-operation-death",
    );
    await vi.waitFor(() =>
      expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce(),
    );

    fixture.player.alive = false;
    fixture.player.health.current = 0;
    releaseDebit?.({
      ok: true,
      playerId: "agent-a",
      operationId: "food-operation-death",
      changed: true,
      replayed: false,
      requirements: [{ itemId: "lobster", quantity: 1 }],
    });
    await expect(pending).resolves.toMatchObject({
      ok: false,
      committed: true,
      consumed: true,
      healedAmount: 0,
      newHealth: 0,
      reason: "player_not_alive",
    });

    fixture.player.alive = true;
    fixture.player.health.current = 30;
    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        4,
        "food-operation-death",
      ),
    ).resolves.toMatchObject({
      ok: false,
      committed: true,
      consumed: true,
      replayed: true,
      healedAmount: 0,
      reason: "player_not_alive",
    });
    expect(fixture.player.health.current).toBe(30);
    expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce();
  });

  it("never heals a replay after a committed snapshot-apply failure", async () => {
    const fixture = createFixture(async () => ({
      ok: false,
      playerId: "agent-a",
      operationId: "food-operation-apply-failed",
      changed: false,
      replayed: false,
      requirements: [{ itemId: "lobster", quantity: 1 }],
      reason: "committed_state_apply_failed",
    }));

    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        4,
        "food-operation-apply-failed",
      ),
    ).resolves.toMatchObject({
      ok: false,
      committed: true,
      consumed: true,
      replayed: false,
      healedAmount: 0,
      reason: "committed_state_apply_failed",
    });

    fixture.debitItemsAtomic.mockResolvedValueOnce({
      ok: true,
      playerId: "agent-a",
      operationId: "food-operation-apply-failed",
      changed: true,
      replayed: true,
      requirements: [{ itemId: "lobster", quantity: 1 }],
    });
    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        4,
        "food-operation-apply-failed",
      ),
    ).resolves.toMatchObject({
      ok: false,
      committed: true,
      consumed: true,
      replayed: true,
      healedAmount: 0,
      reason: "committed_state_apply_failed",
    });
    expect(fixture.player.health.current).toBe(30);
    expect(fixture.debitItemsAtomic).toHaveBeenCalledOnce();
  });

  it("rejects full-health and wrong-slot requests before persistence", async () => {
    const fixture = createFixture();
    fixture.player.health.current = fixture.player.health.max;
    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        4,
        "food-operation-full",
      ),
    ).resolves.toMatchObject({ ok: false, reason: "full_health" });

    fixture.player.health.current = 30;
    await expect(
      fixture.system.consumeFoodAtomic(
        "agent-a",
        "lobster",
        3,
        "food-operation-wrong-slot",
      ),
    ).resolves.toMatchObject({ ok: false, reason: "item_not_owned" });
    expect(fixture.debitItemsAtomic).not.toHaveBeenCalled();
  });
});
