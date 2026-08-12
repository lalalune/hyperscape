import { describe, expect, it, vi } from "vitest";
import { PlayerMigration } from "../../../../types/core/core";
import { EventType } from "../../../../types/events";
import { EventBus } from "../../infrastructure/EventBus";
import { PlayerSystem } from "../PlayerSystem";

describe("PlayerSystem authoritative healing", () => {
  it("persists an explicit null when autocast is cleared", () => {
    const savePlayer = vi.fn();
    const entity = { data: { selectedSpell: "wind_strike" as string | null } };
    const world = {
      isServer: true,
      getPlayer: vi.fn(() => entity),
      entities: { get: vi.fn(() => entity) },
      $eventBus: new EventBus(),
      getSystem: vi.fn((name: string) =>
        name === "database" ? { savePlayer } : null,
      ),
    };
    const system = new PlayerSystem(world as never);
    const player = PlayerMigration.createNewPlayer(
      "player-autocast",
      "player-autocast",
      "Player Autocast",
    );
    (player as unknown as { data: { selectedSpell: string | null } }).data = {
      selectedSpell: "wind_strike",
    };
    const internals = system as unknown as {
      players: Map<string, typeof player>;
      databaseSystem: { savePlayer: typeof savePlayer };
      handleSetAutocast: (data: {
        playerId: string;
        spellId: string | null;
      }) => void;
    };
    internals.databaseSystem = { savePlayer };
    internals.players.set("player-autocast", player);
    internals.handleSetAutocast({
      playerId: "player-autocast",
      spellId: null,
    });

    expect(savePlayer).toHaveBeenCalledWith("player-autocast", {
      selectedSpell: null,
    });
    expect(entity.data.selectedSpell).toBeNull();
  });

  it("updates the combat entity and emits the exact applied heal", () => {
    const healthComponent = {
      data: { current: 20, max: 60, isDead: false },
    };
    const statsComponent = {
      data: { health: { current: 20, max: 60 } },
    };
    const entity = {
      setHealth: vi.fn((health: number) => {
        healthComponent.data.current = health;
      }),
      getComponent: vi.fn((name: string) =>
        name === "health"
          ? healthComponent
          : name === "stats"
            ? statsComponent
            : null,
      ),
    };
    const eventBus = new EventBus();
    const emitEvent = vi.spyOn(eventBus, "emitEvent");
    const world = {
      isServer: true,
      getPlayer: vi.fn(() => entity),
      entities: { get: vi.fn(() => entity) },
      $eventBus: eventBus,
      getSystem: vi.fn(() => null),
    };
    const system = new PlayerSystem(world as never);
    const player = PlayerMigration.createNewPlayer(
      "player-a",
      "player-a",
      "Player A",
    );
    player.health.current = 20;
    player.health.max = 60;
    (
      system as unknown as {
        players: Map<string, typeof player>;
      }
    ).players.set("player-a", player);

    expect(system.healPlayer("player-a", 14)).toBe(true);

    expect(player.health.current).toBe(34);
    expect(entity.setHealth).toHaveBeenCalledWith(34);
    expect(healthComponent.data.current).toBe(34);
    expect(statsComponent.data.health).toEqual({ current: 34, max: 60 });
    expect(emitEvent).toHaveBeenCalledWith(
      EventType.ENTITY_HEALED,
      {
        entityId: "player-a",
        healAmount: 14,
        newHealth: 34,
      },
      "player",
    );
  });

  it("persists exact damage and healing snapshots through the coalesced boundary", () => {
    const savePlayer = vi.fn();
    const healthComponent = {
      data: { current: 10, max: 10, isDead: false },
    };
    const entity = {
      setHealth: vi.fn((health: number) => {
        healthComponent.data.current = health;
      }),
      getComponent: vi.fn((name: string) =>
        name === "health" ? healthComponent : null,
      ),
    };
    const world = {
      isServer: true,
      getPlayer: vi.fn(() => entity),
      entities: { get: vi.fn(() => entity) },
      $eventBus: new EventBus(),
      getSystem: vi.fn(() => null),
    };
    const system = new PlayerSystem(world as never);
    const player = PlayerMigration.createNewPlayer(
      "player-health-persistence",
      "player-health-persistence",
      "Persistent Player",
    );
    player.health.current = 10;
    player.health.max = 10;
    const internals = system as unknown as {
      players: Map<string, typeof player>;
      databaseSystem: { savePlayer: typeof savePlayer };
    };
    internals.players.set("player-health-persistence", player);
    internals.databaseSystem = { savePlayer };

    expect(system.damagePlayer("player-health-persistence", 7)).toBe(true);
    expect(savePlayer).toHaveBeenLastCalledWith("player-health-persistence", {
      health: 3,
      maxHealth: 10,
    });

    expect(system.healPlayer("player-health-persistence", 2)).toBe(true);
    expect(savePlayer).toHaveBeenLastCalledWith("player-health-persistence", {
      health: 5,
      maxHealth: 10,
    });
  });

  it("hydrates the runtime entity from exact persisted partial health", async () => {
    const persistedRow = {
      id: 1,
      playerId: "account-health",
      name: "Persisted Player",
      combatLevel: 3,
      attackLevel: 1,
      strengthLevel: 1,
      defenseLevel: 1,
      constitutionLevel: 10,
      rangedLevel: 1,
      magicLevel: 1,
      prayerLevel: 1,
      woodcuttingLevel: 1,
      miningLevel: 1,
      fishingLevel: 1,
      firemakingLevel: 1,
      cookingLevel: 1,
      smithingLevel: 1,
      agilityLevel: 1,
      craftingLevel: 1,
      fletchingLevel: 1,
      runecraftingLevel: 1,
      attackXp: 0,
      strengthXp: 0,
      defenseXp: 0,
      constitutionXp: 0,
      rangedXp: 0,
      magicXp: 0,
      prayerXp: 0,
      prayerPoints: 1,
      prayerMaxPoints: 1,
      activePrayers: [],
      woodcuttingXp: 0,
      miningXp: 0,
      fishingXp: 0,
      firemakingXp: 0,
      cookingXp: 0,
      smithingXp: 0,
      agilityXp: 0,
      craftingXp: 0,
      fletchingXp: 0,
      runecraftingXp: 0,
      health: 3,
      maxHealth: 10,
      coins: 0,
      positionX: 1,
      positionY: 2,
      positionZ: 3,
      selectedSpell: "wind_strike",
      lastLogin: 0,
      createdAt: 0,
    };
    const entity = {
      data: {},
      setHealthAndMaxHealth: vi.fn(),
      setHealth: vi.fn(),
    };
    const databaseSystem = {
      getPlayerAsync: vi.fn(async () => persistedRow),
      savePlayer: vi.fn(),
    };
    const world = {
      isServer: true,
      getPlayer: vi.fn(() => entity),
      entities: { get: vi.fn(() => entity) },
      $eventBus: new EventBus(),
      getSystem: vi.fn(() => null),
    };
    const system = new PlayerSystem(world as never);
    (
      system as unknown as { databaseSystem: typeof databaseSystem }
    ).databaseSystem = databaseSystem;

    await system.onPlayerEnter({
      playerId: "runtime-health",
      userId: "account-health",
    } as never);

    expect(databaseSystem.getPlayerAsync).toHaveBeenCalledWith(
      "account-health",
    );
    expect(entity.setHealthAndMaxHealth).toHaveBeenCalledWith(3, 10);
    expect(entity.setHealth).not.toHaveBeenCalled();
    expect(entity.data).toMatchObject({ selectedSpell: "wind_strike" });
    expect(system.getPlayerHealth("runtime-health")).toEqual({
      current: 3,
      max: 10,
    });
  });

  it("awaits direct full-player snapshots for graceful shutdown", async () => {
    const savePlayerAsync = vi.fn(async () => undefined);
    const world = {
      isServer: true,
      entities: { get: vi.fn(() => null) },
      $eventBus: new EventBus(),
      getSystem: vi.fn(() => null),
    };
    const system = new PlayerSystem(world as never);
    const player = PlayerMigration.createNewPlayer(
      "runtime-shutdown",
      "runtime-shutdown",
      "Shutdown Player",
    );
    player.health.current = 3;
    player.health.max = 10;
    const internals = system as unknown as {
      players: Map<string, typeof player>;
      databaseSystem: { savePlayerAsync: typeof savePlayerAsync };
    };
    internals.players.set("runtime-shutdown", player);
    internals.databaseSystem = { savePlayerAsync };

    await system.saveAllPlayersToDatabase();

    expect(savePlayerAsync).toHaveBeenCalledOnce();
    expect(savePlayerAsync).toHaveBeenCalledWith(
      "runtime-shutdown",
      expect.objectContaining({
        health: 3,
        maxHealth: 10,
      }),
    );
  });

  it("reports only the applied amount when healing reaches maximum HP", () => {
    const entity = {
      setHealth: vi.fn(),
      getComponent: vi.fn(() => null),
    };
    const eventBus = new EventBus();
    const emitEvent = vi.spyOn(eventBus, "emitEvent");
    const world = {
      isServer: true,
      getPlayer: vi.fn(() => entity),
      entities: { get: vi.fn(() => entity) },
      $eventBus: eventBus,
      getSystem: vi.fn(() => null),
    };
    const system = new PlayerSystem(world as never);
    const player = PlayerMigration.createNewPlayer(
      "player-b",
      "player-b",
      "Player B",
    );
    player.health.current = 58;
    player.health.max = 60;
    (
      system as unknown as {
        players: Map<string, typeof player>;
      }
    ).players.set("player-b", player);

    expect(system.healPlayer("player-b", 20)).toBe(true);
    expect(player.health.current).toBe(60);
    expect(emitEvent).toHaveBeenCalledWith(
      EventType.ENTITY_HEALED,
      {
        entityId: "player-b",
        healAmount: 2,
        newHealth: 60,
      },
      "player",
    );
    expect(system.healPlayer("player-b", 20)).toBe(false);
  });

  it("restores an alive winner's hidden health pool and every entity view", () => {
    const healthComponent = {
      data: { current: 7, max: 82, isDead: false },
    };
    const statsComponent = {
      data: {
        health: { current: 7, max: 82 },
        hitpoints: { current: 7, max: 82 },
      },
    };
    const entity = {
      setHealth: vi.fn(),
      setHealthAndMaxHealth: vi.fn((current: number, max: number) => {
        healthComponent.data.current = current;
        healthComponent.data.max = max;
      }),
      resetDeathState: vi.fn(),
      getComponent: vi.fn((name: string) =>
        name === "health"
          ? healthComponent
          : name === "stats"
            ? statsComponent
            : null,
      ),
    };
    const world = {
      isServer: true,
      getPlayer: vi.fn(() => entity),
      entities: { get: vi.fn(() => entity) },
      $eventBus: new EventBus(),
      getSystem: vi.fn(() => null),
    };
    const system = new PlayerSystem(world as never);
    const player = PlayerMigration.createNewPlayer(
      "winner",
      "winner",
      "Winner",
    );
    player.health.current = 7;
    player.health.max = 82;
    player.alive = true;
    (
      system as unknown as {
        players: Map<string, typeof player>;
      }
    ).players.set("winner", player);

    expect(system.restorePlayerHealth("winner", 82)).toBe(true);

    expect(player.health).toEqual({ current: 82, max: 82 });
    expect(player.alive).toBe(true);
    expect(entity.setHealthAndMaxHealth).toHaveBeenCalledWith(82, 82);
    expect(entity.resetDeathState).toHaveBeenCalledOnce();
    expect(healthComponent.data).toEqual({
      current: 82,
      max: 82,
      isDead: false,
    });
    expect(statsComponent.data.health).toEqual({ current: 82, max: 82 });
    expect(statsComponent.data.hitpoints).toEqual({ current: 82, max: 82 });
  });
});
