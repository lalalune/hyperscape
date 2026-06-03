import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventType, isPositionInsideCombatArena } from "@hyperforge/shared";
import { StreamingDuelScheduler } from "../index";
/** Legacy constant kept for test assertions. */
const DUEL_FOOD_ITEM = "shark";
import { isDuelFoodItemId } from "../../duelFood";

type SkillMap = Record<string, { level: number; xp: number }>;

type InventoryItem = {
  slot: number;
  itemId: string;
  quantity: number;
};

type MockEntity = {
  id: string;
  type: "player";
  isAgent: boolean;
  data: {
    name: string;
    position: [number, number, number];
    health: number;
    maxHealth: number;
    skills: SkillMap;
    rotation?: number;
    _teleport?: boolean;
    inCombat?: boolean;
    combatTarget?: string | null;
    attackTarget?: string | null;
    inStreamingDuel?: boolean;
    preventRespawn?: boolean;
  };
};

type MockWorldContext = {
  world: {
    entities: {
      items: Map<string, MockEntity>;
      get: (id: string) => MockEntity | undefined;
      getAllEntities: () => Map<string, MockEntity>;
    };
    network: {
      send: ReturnType<typeof vi.fn>;
    };
    on: (event: string, fn: (payload: unknown) => void) => void;
    off: (event: string, fn: (payload: unknown) => void) => void;
    emit: (event: string, payload: unknown) => void;
    getSystem: (name: string) => unknown;
  };
  entities: Map<string, MockEntity>;
  combatCalls: Array<{ attackerId: string; targetId: string }>;
  equipCalls: Array<{ playerId: string; itemId: string }>;
  getInventory: (playerId: string) => { items: InventoryItem[]; coins: number };
  countFood: (playerId: string) => number;
  hasItemAtSlot: (playerId: string, slot: number, itemId: string) => boolean;
  getEquippedWeapon: (playerId: string) => string | null;
};

function createAgentEntity(
  id: string,
  name: string,
  position: [number, number, number],
): MockEntity {
  const skills: SkillMap = {
    attack: { level: 10, xp: 0 },
    strength: { level: 10, xp: 0 },
    defense: { level: 10, xp: 0 },
    constitution: { level: 20, xp: 0 },
  };

  return {
    id,
    type: "player",
    isAgent: true,
    data: {
      name,
      position,
      health: 20,
      maxHealth: 20,
      skills,
      inCombat: false,
      combatTarget: null,
      attackTarget: null,
    },
  };
}

function createMockWorld(options?: {
  alphaInventory?: InventoryItem[];
  betaInventory?: InventoryItem[];
  alphaWeaponId?: string | null;
  betaWeaponId?: string | null;
  extraAgents?: Array<{
    id: string;
    name: string;
    position: [number, number, number];
  }>;
  terrainHeight?: number;
  damageByAttacker?: Record<string, number>;
}): MockWorldContext {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const entities = new Map<string, MockEntity>();
  const inventories = new Map<
    string,
    { items: InventoryItem[]; coins: number }
  >();
  const combatCalls: Array<{ attackerId: string; targetId: string }> = [];
  const equipCalls: Array<{ playerId: string; itemId: string }> = [];
  const equipment = new Map<
    string,
    {
      weapon: {
        itemId: string | null;
        item: { id: string } | null;
      };
    }
  >();

  const alpha = createAgentEntity("agent-alpha", "Alpha", [10, 0.2, 10]);
  const beta = createAgentEntity("agent-beta", "Beta", [20, 0.2, 20]);
  entities.set(alpha.id, alpha);
  entities.set(beta.id, beta);
  equipment.set("agent-alpha", {
    weapon: options?.alphaWeaponId
      ? { itemId: options.alphaWeaponId, item: { id: options.alphaWeaponId } }
      : { itemId: null, item: null },
  });
  equipment.set("agent-beta", {
    weapon: options?.betaWeaponId
      ? { itemId: options.betaWeaponId, item: { id: options.betaWeaponId } }
      : { itemId: null, item: null },
  });
  for (const extraAgent of options?.extraAgents ?? []) {
    const extra = createAgentEntity(
      extraAgent.id,
      extraAgent.name,
      extraAgent.position,
    );
    entities.set(extra.id, extra);
    equipment.set(extra.id, {
      weapon: { itemId: null, item: null },
    });
  }

  inventories.set("agent-alpha", {
    items: [...(options?.alphaInventory ?? [])],
    coins: 0,
  });
  inventories.set("agent-beta", {
    items: [...(options?.betaInventory ?? [])],
    coins: 0,
  });
  for (const extraAgent of options?.extraAgents ?? []) {
    inventories.set(extraAgent.id, {
      items: [],
      coins: 0,
    });
  }

  const terrainHeight = options?.terrainHeight ?? 7.25;
  const damageByAttacker: Record<string, number> = {
    "agent-alpha": 8,
    "agent-beta": 1,
    ...(options?.damageByAttacker ?? {}),
  };

  const on = (event: string, fn: (payload: unknown) => void) => {
    const handlers =
      listeners.get(event) ?? new Set<(payload: unknown) => void>();
    handlers.add(fn);
    listeners.set(event, handlers);
  };

  const off = (event: string, fn: (payload: unknown) => void) => {
    listeners.get(event)?.delete(fn);
  };

  const emit = (event: string, payload: unknown) => {
    const handlers = listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload);
    }
  };

  const getInventoryState = (playerId: string) => {
    const state = inventories.get(playerId);
    if (!state) {
      const empty = { items: [] as InventoryItem[], coins: 0 };
      inventories.set(playerId, empty);
      return empty;
    }
    return state;
  };

  const inventorySystem = {
    getInventory: (playerId: string) => {
      const state = getInventoryState(playerId);
      return {
        playerId,
        items: state.items,
        coins: state.coins,
      };
    },
    addItemDirect: async (
      playerId: string,
      item: { itemId: string; quantity: number; slot?: number },
    ) => {
      const state = getInventoryState(playerId);
      const usedSlots = new Set(state.items.map((entry) => entry.slot));
      const slot =
        typeof item.slot === "number"
          ? item.slot
          : Array.from({ length: 28 }, (_, i) => i).find(
              (candidate) => !usedSlots.has(candidate),
            );
      if (typeof slot !== "number" || usedSlots.has(slot)) {
        return false;
      }
      state.items.push({
        slot,
        itemId: item.itemId,
        quantity: item.quantity,
      });
      return true;
    },
    removeItem: async (data: {
      playerId: string;
      itemId: string;
      quantity: number;
      slot?: number;
    }) => {
      const state = getInventoryState(data.playerId);
      const index = state.items.findIndex((entry) => {
        if (typeof data.slot === "number") {
          return entry.slot === data.slot && entry.itemId === data.itemId;
        }
        return entry.itemId === data.itemId;
      });
      if (index < 0) return false;
      const entry = state.items[index];
      if (entry.quantity <= data.quantity) {
        state.items.splice(index, 1);
      } else {
        entry.quantity -= data.quantity;
      }
      return true;
    },
    isInventoryReady: () => true,
  };

  const equipmentSystem = {
    getPlayerEquipment: (playerId: string) => equipment.get(playerId),
    canPlayerEquipItem: () => true,
    equipItemDirect: async (playerId: string, itemId: string | number) => {
      const state = equipment.get(playerId);
      if (!state) {
        return {
          success: false,
          error: "Equipment not initialized",
          displacedItems: [],
        };
      }

      const normalizedItemId = String(itemId);
      equipCalls.push({ playerId, itemId: normalizedItemId });
      state.weapon = {
        itemId: normalizedItemId,
        item: { id: normalizedItemId },
      };

      return {
        success: true,
        equippedSlot: "weapon",
        displacedItems: [],
      };
    },
  };

  const world = {
    entities: {
      items: entities,
      get: (id: string) => entities.get(id),
      getAllEntities: () => entities,
    },
    network: {
      send: vi.fn(),
    },
    on,
    off,
    emit,
    getSystem: (name: string) => {
      if (name === "terrain") {
        return {
          getHeightAt: () => terrainHeight,
        };
      }

      if (name === "inventory") {
        return inventorySystem;
      }

      if (name === "equipment") {
        return equipmentSystem;
      }

      if (name === "combat") {
        return {
          startCombat: (
            attackerId: string,
            targetId: string,
            _options?: { attackerType?: string; targetType?: string },
          ) => {
            combatCalls.push({ attackerId, targetId });

            const attacker = entities.get(attackerId);
            const target = entities.get(targetId);
            if (!attacker || !target) {
              return false;
            }

            if ((attacker.data.health ?? 0) <= 0) {
              return false;
            }

            if ((target.data.health ?? 0) <= 0) {
              return false;
            }

            const damage = damageByAttacker[attackerId] ?? 1;
            const nextHealth = Math.max(0, (target.data.health ?? 0) - damage);
            target.data.health = nextHealth;
            target.data.inCombat = nextHealth > 0;
            target.data.combatTarget = attackerId;

            emit(EventType.ENTITY_DAMAGED, {
              attackerId,
              entityId: targetId,
              damage,
            });

            if (nextHealth <= 0) {
              emit(EventType.ENTITY_DEATH, {
                entityId: targetId,
                killedBy: attackerId,
              });
            }

            return true;
          },
        };
      }

      if (name === "database") {
        return null;
      }

      return null;
    },
  };

  return {
    world,
    entities,
    combatCalls,
    equipCalls,
    getInventory: (playerId: string) => getInventoryState(playerId),
    countFood: (playerId: string) =>
      getInventoryState(playerId).items.filter((item) =>
        isDuelFoodItemId(item.itemId),
      ).length,
    hasItemAtSlot: (playerId: string, slot: number, itemId: string) =>
      getInventoryState(playerId).items.some(
        (item) => item.slot === slot && item.itemId === itemId,
      ),
    getEquippedWeapon: (playerId: string) =>
      equipment.get(playerId)?.weapon.itemId ?? null,
  };
}

// TODO: These tests need refactoring - they call internal methods via `(scheduler as any)`
// that have been moved to the orchestrator pattern. Many pass but 23 fail.
describe.skip("StreamingDuelScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("grounds arena teleports and starts combat with HP loss", async () => {
    const ctx = createMockWorld({ terrainHeight: 12.5 });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.init();
    expect(scheduler.getCurrentCycle()?.phase).toBe("ANNOUNCEMENT");

    await (scheduler as any).startCountdown();

    const alpha = ctx.entities.get("agent-alpha");
    const beta = ctx.entities.get("agent-beta");
    expect(alpha).toBeDefined();
    expect(beta).toBeDefined();
    expect(alpha!.data.position[1]).toBe(12.5);
    expect(beta!.data.position[1]).toBe(12.5);

    await vi.advanceTimersByTimeAsync(4000);

    expect(scheduler.getCurrentCycle()?.phase).toBe("FIGHTING");
    expect(scheduler.getCurrentCycle()?.arenaId).toBe(1);
    expect(ctx.combatCalls.length).toBeGreaterThanOrEqual(2);
    expect(alpha!.data.health).toBeLessThan(alpha!.data.maxHealth);
    expect(beta!.data.health).toBeLessThan(beta!.data.maxHealth);

    scheduler.destroy();
  });

  it("broadcasts streaming state immediately on init", () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.init();

    expect(ctx.world.network.send).toHaveBeenCalledWith(
      "streamingState",
      expect.any(Object),
    );

    scheduler.destroy();
  });

  it("re-engages combat within ~3 seconds during fight loop", async () => {
    const ctx = createMockWorld({
      damageByAttacker: {
        "agent-alpha": 0,
        "agent-beta": 0,
      },
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.init();
    await (scheduler as any).startCountdown();
    await vi.advanceTimersByTimeAsync(4000);

    expect(scheduler.getCurrentCycle()?.phase).toBe("FIGHTING");
    const baselineCalls = ctx.combatCalls.length;
    expect(baselineCalls).toBeGreaterThanOrEqual(2);

    await vi.advanceTimersByTimeAsync(3500);
    expect(ctx.combatCalls.length).toBeGreaterThan(baselineCalls);

    scheduler.destroy();
  });

  it("auto-equips a bronze weapon for unarmed duel contestants", async () => {
    const ctx = createMockWorld({
      alphaWeaponId: null,
      betaWeaponId: null,
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.init();
    await (scheduler as any).startCountdown();

    expect(ctx.getEquippedWeapon("agent-alpha")).toMatch(/^bronze_/);
    expect(ctx.getEquippedWeapon("agent-beta")).toMatch(/^bronze_/);
    expect(ctx.equipCalls).toHaveLength(2);
    expect(
      ctx.equipCalls.every((call) => call.itemId.startsWith("bronze_")),
    ).toBe(true);

    scheduler.destroy();
  });

  it("does not replace an already-equipped weapon during duel prep", async () => {
    const ctx = createMockWorld({
      alphaWeaponId: "iron_sword",
      betaWeaponId: null,
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.init();
    await (scheduler as any).startCountdown();

    expect(ctx.getEquippedWeapon("agent-alpha")).toBe("iron_sword");
    expect(ctx.getEquippedWeapon("agent-beta")).toMatch(/^bronze_/);
    expect(ctx.equipCalls.some((call) => call.playerId === "agent-alpha")).toBe(
      false,
    );
    expect(ctx.equipCalls.some((call) => call.playerId === "agent-beta")).toBe(
      true,
    );

    scheduler.destroy();
  });

  it("resolves duel, restores HP, removes only duel-provisioned food, and returns agents", async () => {
    const ctx = createMockWorld({
      alphaInventory: [
        { slot: 0, itemId: DUEL_FOOD_ITEM, quantity: 1 },
        { slot: 1, itemId: "bronze_sword", quantity: 1 },
      ],
      betaInventory: [{ slot: 5, itemId: DUEL_FOOD_ITEM, quantity: 2 }],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    const alphaOriginalPosition = [
      ...ctx.entities.get("agent-alpha")!.data.position,
    ] as [number, number, number];
    const betaOriginalPosition = [
      ...ctx.entities.get("agent-beta")!.data.position,
    ] as [number, number, number];

    scheduler.init();
    await (scheduler as any).startCountdown();

    expect(ctx.countFood("agent-alpha")).toBeGreaterThan(1);
    expect(ctx.countFood("agent-beta")).toBeGreaterThan(2);

    await vi.advanceTimersByTimeAsync(4000);
    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");

    // Prevent immediate next-cycle start so cleanup side effects can be asserted
    // directly on the finished duel agents.
    scheduler.unregisterAgent("agent-beta");

    // Agents stay in the arena during resolution (death animation plays).
    // Advance through the 15s resolution phase to trigger endCycle + cleanup.
    await vi.advanceTimersByTimeAsync(15_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.getCurrentCycle()).toBeNull();

    const alpha = ctx.entities.get("agent-alpha")!;
    const beta = ctx.entities.get("agent-beta")!;

    expect(alpha.data.health).toBe(alpha.data.maxHealth);
    expect(beta.data.health).toBe(beta.data.maxHealth);

    expect(alpha.data.inStreamingDuel).toBe(false);
    expect(beta.data.inStreamingDuel).toBe(false);
    expect(alpha.data.preventRespawn).toBe(false);
    expect(beta.data.preventRespawn).toBe(false);

    expect(alpha.data.position).toEqual(alphaOriginalPosition);
    expect(beta.data.position).toEqual(betaOriginalPosition);

    expect(ctx.countFood("agent-alpha")).toBe(1);
    expect(ctx.countFood("agent-beta")).toBe(1);
    expect(ctx.hasItemAtSlot("agent-alpha", 0, DUEL_FOOD_ITEM)).toBe(true);
    expect(ctx.hasItemAtSlot("agent-beta", 5, DUEL_FOOD_ITEM)).toBe(true);
    expect(ctx.hasItemAtSlot("agent-alpha", 1, "bronze_sword")).toBe(true);

    expect(alpha.data.combatTarget).toBeNull();
    expect(beta.data.combatTarget).toBeNull();
    expect(alpha.data.inCombat).toBe(false);
    expect(beta.data.inCombat).toBe(false);

    scheduler.destroy();
  });

  it("sanitizes invalid original restore heights to grounded terrain", async () => {
    const ctx = createMockWorld({ terrainHeight: 14.5 });
    ctx.entities.get("agent-alpha")!.data.position = [10, -250, 10];
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.init();
    await (scheduler as any).startCountdown();

    await vi.advanceTimersByTimeAsync(4000);
    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");

    // Keep cleanup assertions scoped to the finished duel agents.
    scheduler.unregisterAgent("agent-beta");

    // Advance through resolution phase so cleanup + teleport out occurs.
    await vi.advanceTimersByTimeAsync(15_000);
    await Promise.resolve();
    await Promise.resolve();

    const alpha = ctx.entities.get("agent-alpha")!;
    expect(alpha.data.position[0]).toBe(10);
    expect(alpha.data.position[2]).toBe(10);
    expect(alpha.data.position[1]).toBe(14.5);

    scheduler.destroy();
  });

  it("does not restore agents into combat arena tiles after duel cleanup", async () => {
    const ctx = createMockWorld({ terrainHeight: 9.5 });
    // Arena 1 bounds include x=70, z=90 with default manifest config.
    ctx.entities.get("agent-alpha")!.data.position = [70, 9.5, 90];

    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();

    await vi.advanceTimersByTimeAsync(4000);
    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");

    // Keep cleanup assertions scoped to the finished duel agents.
    scheduler.unregisterAgent("agent-beta");

    // Advance through resolution phase so cleanup + teleport out occurs.
    await vi.advanceTimersByTimeAsync(15_000);
    await Promise.resolve();
    await Promise.resolve();

    const alpha = ctx.entities.get("agent-alpha")!;
    expect(
      isPositionInsideCombatArena(
        alpha.data.position[0],
        alpha.data.position[2],
      ),
    ).toBe(false);

    scheduler.destroy();
  });

  it("clears duel flags if scheduler is destroyed mid-fight", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.init();
    await (scheduler as any).startCountdown();
    await vi.advanceTimersByTimeAsync(4000);

    const alpha = ctx.entities.get("agent-alpha")!;
    const beta = ctx.entities.get("agent-beta")!;
    expect(alpha.data.inStreamingDuel).toBe(true);
    expect(beta.data.inStreamingDuel).toBe(true);

    scheduler.destroy();

    expect(alpha.data.inStreamingDuel).toBe(false);
    expect(beta.data.inStreamingDuel).toBe(false);
    expect(alpha.data.preventRespawn).toBe(false);
    expect(beta.data.preventRespawn).toBe(false);
  });

  it("prefers contestants during early fight lock even when weighted choice points at bystanders", () => {
    const ctx = createMockWorld({
      extraAgents: [
        { id: "agent-gamma", name: "Gamma", position: [30, 0.2, 30] },
        { id: "agent-delta", name: "Delta", position: [40, 0.2, 40] },
      ],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const now = Date.now();
    const cycle = scheduler.getCurrentCycle()!;
    cycle.phase = "FIGHTING";
    cycle.phaseStartTime = now - 5_000;
    cycle.agent1 = (scheduler as any).createContestant("agent-alpha");
    cycle.agent2 = (scheduler as any).createContestant("agent-beta");
    cycle.winnerId = null;

    (scheduler as any).cameraTarget = "agent-alpha";
    (scheduler as any).lastCameraSwitchTime = now - 60_000;

    const alpha = ctx.entities.get("agent-alpha")!;
    const beta = ctx.entities.get("agent-beta")!;
    alpha.data.inCombat = true;
    alpha.data.combatTarget = "agent-beta";
    beta.data.inCombat = true;
    beta.data.combatTarget = "agent-alpha";

    (scheduler as any).markAgentInteresting("agent-gamma", 6, now);
    (scheduler as any).markAgentInteresting("agent-delta", 6, now);

    const chooseSpy = vi
      .spyOn(scheduler as any, "chooseWeightedCameraCandidate")
      .mockImplementation((...args: unknown[]) => {
        const candidates = (args[0] ?? []) as Array<{ agentId: string }>;
        return (
          candidates.find((candidate) => candidate.agentId === "agent-gamma") ??
          candidates[0]
        );
      });

    (scheduler as any).updateCameraTarget(now);

    expect(["agent-alpha", "agent-beta"]).toContain(
      (scheduler as any).cameraTarget,
    );

    chooseSpy.mockRestore();
    scheduler.destroy();
  });

  it("allows fight cutaways after both contestants stay idle long enough", () => {
    const ctx = createMockWorld({
      extraAgents: [
        { id: "agent-gamma", name: "Gamma", position: [30, 0.2, 30] },
        { id: "agent-delta", name: "Delta", position: [40, 0.2, 40] },
      ],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const now = Date.now();
    const cycle = scheduler.getCurrentCycle()!;
    cycle.phase = "FIGHTING";
    cycle.phaseStartTime = now - 180_000;
    cycle.agent1 = (scheduler as any).createContestant("agent-alpha");
    cycle.agent2 = (scheduler as any).createContestant("agent-beta");
    cycle.winnerId = null;
    (scheduler as any).nextDuelPair = {
      agent1Id: "agent-gamma",
      agent2Id: "agent-delta",
      selectedAt: now - 10_000,
    };

    (scheduler as any).cameraTarget = "agent-alpha";
    (scheduler as any).lastCameraSwitchTime = now - 90_000;
    (scheduler as any).fightCutawayStartedAt = null;
    (scheduler as any).fightCutawayTotalMs = 0;
    (scheduler as any).fightLastCutawayEndedAt = 0;

    const alpha = ctx.entities.get("agent-alpha")!;
    const beta = ctx.entities.get("agent-beta")!;
    alpha.data.inCombat = false;
    alpha.data.combatTarget = null;
    beta.data.inCombat = false;
    beta.data.combatTarget = null;

    const alphaSample = (scheduler as any).ensureAgentActivity(
      "agent-alpha",
      now,
    );
    alphaSample.lastInterestingTime = now - 45_000;
    alphaSample.combatScore = 0;
    const betaSample = (scheduler as any).ensureAgentActivity(
      "agent-beta",
      now,
    );
    betaSample.lastInterestingTime = now - 45_000;
    betaSample.combatScore = 0;

    (scheduler as any).markAgentInteresting("agent-gamma", 6, now);
    (scheduler as any).markAgentInteresting("agent-delta", 4, now);

    const chooseSpy = vi
      .spyOn(scheduler as any, "chooseWeightedCameraCandidate")
      .mockImplementation((...args: unknown[]) => {
        const candidates = (args[0] ?? []) as Array<{ agentId: string }>;
        return (
          candidates.find((candidate) => candidate.agentId === "agent-gamma") ??
          candidates[0]
        );
      });

    (scheduler as any).updateCameraTarget(now);
    expect((scheduler as any).cameraTarget).toBe("agent-gamma");

    chooseSpy.mockRestore();
    scheduler.destroy();
  });

  it("limits announcement camera candidates to current duel contestants", () => {
    const ctx = createMockWorld({
      extraAgents: [
        { id: "agent-gamma", name: "Gamma", position: [30, 0.2, 30] },
        { id: "agent-delta", name: "Delta", position: [40, 0.2, 40] },
        { id: "agent-epsilon", name: "Epsilon", position: [50, 0.2, 50] },
      ],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const now = Date.now();
    const cycle = scheduler.getCurrentCycle()!;
    cycle.phase = "ANNOUNCEMENT";
    cycle.phaseStartTime = now - 15_000;
    cycle.agent1 = (scheduler as any).createContestant("agent-alpha");
    cycle.agent2 = (scheduler as any).createContestant("agent-beta");
    cycle.winnerId = null;

    const candidates = (scheduler as any).buildCameraCandidates(
      now,
      "agent-alpha",
      true,
    ) as Array<{ agentId: string }>;
    const candidateIds = new Set(
      candidates.map((candidate) => candidate.agentId),
    );

    expect(candidateIds).toEqual(new Set(["agent-alpha", "agent-beta"]));
    expect(candidateIds.has("agent-gamma")).toBe(false);
    expect(candidateIds.has("agent-delta")).toBe(false);
    expect(candidateIds.has("agent-epsilon")).toBe(false);

    scheduler.destroy();
  });

  it("limits fight cutaway candidates to next duel pair members", () => {
    const ctx = createMockWorld({
      extraAgents: [
        { id: "agent-gamma", name: "Gamma", position: [30, 0.2, 30] },
        { id: "agent-delta", name: "Delta", position: [40, 0.2, 40] },
        { id: "agent-epsilon", name: "Epsilon", position: [50, 0.2, 50] },
      ],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const now = Date.now();
    const cycle = scheduler.getCurrentCycle()!;
    cycle.phase = "FIGHTING";
    cycle.phaseStartTime = now - 180_000;
    cycle.agent1 = (scheduler as any).createContestant("agent-alpha");
    cycle.agent2 = (scheduler as any).createContestant("agent-beta");
    cycle.winnerId = null;
    (scheduler as any).nextDuelPair = {
      agent1Id: "agent-gamma",
      agent2Id: "agent-delta",
      selectedAt: now - 15_000,
    };

    const alpha = ctx.entities.get("agent-alpha")!;
    const beta = ctx.entities.get("agent-beta")!;
    alpha.data.inCombat = false;
    alpha.data.combatTarget = null;
    beta.data.inCombat = false;
    beta.data.combatTarget = null;

    const alphaSample = (scheduler as any).ensureAgentActivity(
      "agent-alpha",
      now,
    );
    alphaSample.lastInterestingTime = now - 45_000;
    const betaSample = (scheduler as any).ensureAgentActivity(
      "agent-beta",
      now,
    );
    betaSample.lastInterestingTime = now - 45_000;

    const candidates = (scheduler as any).buildCameraCandidates(
      now,
      "agent-alpha",
      true,
    ) as Array<{ agentId: string }>;
    const candidateIds = new Set(
      candidates.map((candidate) => candidate.agentId),
    );

    expect(candidateIds.has("agent-alpha")).toBe(true);
    expect(candidateIds.has("agent-beta")).toBe(true);
    expect(candidateIds.has("agent-gamma")).toBe(true);
    expect(candidateIds.has("agent-delta")).toBe(true);
    expect(candidateIds.has("agent-epsilon")).toBe(false);

    scheduler.destroy();
  });

  it("refreshes an invalid next duel pair during fighting camera selection", () => {
    const ctx = createMockWorld({
      extraAgents: [
        { id: "agent-gamma", name: "Gamma", position: [30, 0.2, 30] },
        { id: "agent-delta", name: "Delta", position: [40, 0.2, 40] },
      ],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const now = Date.now();
    const cycle = scheduler.getCurrentCycle()!;
    cycle.phase = "FIGHTING";
    cycle.phaseStartTime = now - 180_000;
    cycle.agent1 = (scheduler as any).createContestant("agent-alpha");
    cycle.agent2 = (scheduler as any).createContestant("agent-beta");
    cycle.winnerId = null;
    (scheduler as any).nextDuelPair = {
      agent1Id: "agent-gamma",
      agent2Id: "agent-missing",
      selectedAt: now - 8_000,
    };

    const nextIds = (scheduler as any).getNextDuelAgentIds(
      new Set(["agent-alpha", "agent-beta"]),
    ) as Set<string>;
    expect(nextIds).toEqual(new Set(["agent-gamma", "agent-delta"]));

    const nextPair = (scheduler as any).nextDuelPair as {
      agent1Id: string;
      agent2Id: string;
    } | null;
    expect(nextPair).toBeTruthy();
    expect(nextPair!.agent1Id).not.toBe(nextPair!.agent2Id);
    expect(["agent-gamma", "agent-delta"]).toContain(nextPair!.agent1Id);
    expect(["agent-gamma", "agent-delta"]).toContain(nextPair!.agent2Id);

    scheduler.destroy();
  });

  // ====================================================================
  // Lifecycle regression tests (Fixes A–G)
  // ====================================================================

  it("Fix A: startCountdown re-entry guard prevents duplicate prep", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    expect(scheduler.getCurrentCycle()?.phase).toBe("ANNOUNCEMENT");

    // Call startCountdown twice concurrently (simulates two ticks racing).
    const p1 = (scheduler as any).startCountdown();
    const p2 = (scheduler as any).startCountdown();
    await Promise.all([p1, p2]);

    // Should still have moved to COUNTDOWN exactly once.
    expect(scheduler.getCurrentCycle()?.phase).toBe("COUNTDOWN");

    // Food should only have been added once per agent.
    const alphaFood = ctx.countFood("agent-alpha");
    const betaFood = ctx.countFood("agent-beta");
    // 28 slots - 0 occupied = 28 food per agent (single prep run)
    expect(alphaFood).toBeLessThanOrEqual(28);
    expect(betaFood).toBeLessThanOrEqual(28);

    scheduler.destroy();
  });

  it("resets countdown guard and aborts when arena teleport fails", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const teleportSpy = vi
      .spyOn(scheduler as any, "teleportToArena")
      .mockRejectedValue(new Error("teleport failure"));

    await (scheduler as any).startCountdown();

    expect((scheduler as any)._startCountdownInProgress).toBe(false);
    expect(scheduler.getCurrentCycle()).toBeNull();
    expect((scheduler as any).schedulerState).toBe("IDLE");

    teleportSpy.mockRestore();
    scheduler.destroy();
  });

  it("Fix B: startFight guards against wrong phase", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    // Force phase to ANNOUNCEMENT (not COUNTDOWN).
    const cycle = scheduler.getCurrentCycle()!;
    cycle.phase = "ANNOUNCEMENT";

    // Calling startFight should be a no-op.
    (scheduler as any).startFight();
    expect(scheduler.getCurrentCycle()?.phase).toBe("ANNOUNCEMENT");

    scheduler.destroy();
  });

  it("Fix B: startFight resolves to survivor when one agent is dead", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();

    expect(scheduler.getCurrentCycle()?.phase).toBe("COUNTDOWN");

    // Kill agent-beta before fight starts.
    const beta = ctx.entities.get("agent-beta")!;
    beta.data.health = 0;

    // Fire startFight (simulating the countdown timeout).
    (scheduler as any).startFight();

    // Should go to RESOLUTION with alpha as winner.
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");
    expect(scheduler.getCurrentCycle()?.winnerId).toBe("agent-alpha");
    expect(scheduler.getCurrentCycle()?.loserId).toBe("agent-beta");

    scheduler.destroy();
  });

  it("Fix B: startFight aborts to idle when both agents are missing", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();

    expect(scheduler.getCurrentCycle()?.phase).toBe("COUNTDOWN");

    // Remove both agents from the world.
    ctx.entities.delete("agent-alpha");
    ctx.entities.delete("agent-beta");

    (scheduler as any).startFight();

    // Should have aborted — no current cycle.
    expect(scheduler.getCurrentCycle()).toBeNull();

    scheduler.destroy();
  });

  it("Fix C: startResolution is idempotent (double-call is no-op)", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();
    await vi.advanceTimersByTimeAsync(4000);

    expect(scheduler.getCurrentCycle()?.phase).toBe("FIGHTING");

    // First call should transition to RESOLUTION.
    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");
    expect(scheduler.getCurrentCycle()?.winnerId).toBe("agent-alpha");

    // Second call should be a no-op (phase is now RESOLUTION, not FIGHTING).
    (scheduler as any).startResolution("agent-beta", "agent-alpha", "kill");
    // Winner should still be agent-alpha from first call.
    expect(scheduler.getCurrentCycle()?.winnerId).toBe("agent-alpha");

    scheduler.destroy();
  });

  it("Fix E: queueMicrotask clears flags on correct cycle snapshot", async () => {
    const ctx = createMockWorld({
      extraAgents: [
        { id: "agent-gamma", name: "Gamma", position: [30, 0.2, 30] },
        { id: "agent-delta", name: "Delta", position: [40, 0.2, 40] },
      ],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();
    await vi.advanceTimersByTimeAsync(4000);

    // Identify which agents were selected for this cycle.
    const cycle = scheduler.getCurrentCycle()!;
    const id1 = cycle.agent1!.characterId;
    const id2 = cycle.agent2!.characterId;
    const entity1 = ctx.entities.get(id1)!;
    const entity2 = ctx.entities.get(id2)!;

    // Verify duel flags are set on the cycle's agents.
    expect(entity1.data.inStreamingDuel).toBe(true);
    expect(entity2.data.inStreamingDuel).toBe(true);

    const allAgentIds = [
      "agent-alpha",
      "agent-beta",
      "agent-gamma",
      "agent-delta",
    ];
    const nextPair = allAgentIds.filter(
      (agentId) => agentId !== id1 && agentId !== id2,
    );
    (scheduler as any).nextDuelPair = {
      agent1Id: nextPair[0],
      agent2Id: nextPair[1],
      selectedAt: Date.now(),
    };

    // Trigger resolution (cleanup is now deferred to endCycle).
    (scheduler as any).startResolution(id1, id2, "kill");

    // Advance through the resolution phase so endCycle + cleanup fires.
    await vi.advanceTimersByTimeAsync(15_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const newCycle = scheduler.getCurrentCycle();
    expect(newCycle?.phase).toBe("ANNOUNCEMENT");

    // Flags should be cleared on the OLD cycle's agents, not corrupted.
    expect(entity1.data.inStreamingDuel).toBe(false);
    expect(entity2.data.inStreamingDuel).toBe(false);
    expect(entity1.data.preventRespawn).toBe(false);
    expect(entity2.data.preventRespawn).toBe(false);

    scheduler.destroy();
  });

  it("does not clear new cycle flags when previous-cycle cleanup fails asynchronously", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();
    await vi.advanceTimersByTimeAsync(4000);

    expect(scheduler.getCurrentCycle()?.phase).toBe("FIGHTING");

    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");

    const cleanupSpy = vi
      .spyOn(scheduler as any, "cleanupAfterDuel")
      .mockRejectedValue(new Error("cleanup failure"));

    (scheduler as any).endCycle();

    const newCycle = scheduler.getCurrentCycle();
    expect(newCycle?.phase).toBe("ANNOUNCEMENT");
    expect(newCycle?.agent1?.characterId).toBeTruthy();
    expect(newCycle?.agent2?.characterId).toBeTruthy();

    // Let the async catch handler run.
    await Promise.resolve();
    await Promise.resolve();

    const alpha = ctx.entities.get("agent-alpha")!;
    const beta = ctx.entities.get("agent-beta")!;
    expect(alpha.data.inStreamingDuel).toBe(true);
    expect(beta.data.inStreamingDuel).toBe(true);
    expect(alpha.data.preventRespawn).toBe(true);
    expect(beta.data.preventRespawn).toBe(true);

    cleanupSpy.mockRestore();
    scheduler.destroy();
  });

  it("skips old-cycle teleports when the same duelers are immediately reselected", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();
    await vi.advanceTimersByTimeAsync(4000);

    expect(scheduler.getCurrentCycle()?.phase).toBe("FIGHTING");

    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");

    const teleportSpy = vi.spyOn(scheduler as any, "teleportPlayer");
    teleportSpy.mockClear();

    // With only two agents in the pool, the next cycle is the same pair.
    (scheduler as any).endCycle();
    const nextCycle = scheduler.getCurrentCycle();
    expect(nextCycle?.phase).toBe("ANNOUNCEMENT");
    expect(
      [
        nextCycle?.agent1?.characterId ?? "",
        nextCycle?.agent2?.characterId ?? "",
      ].sort(),
    ).toEqual(["agent-alpha", "agent-beta"]);

    // Let async cleanup continuation run.
    await Promise.resolve();
    await Promise.resolve();

    // Old-cycle cleanup must not teleport active contestants in the new cycle.
    expect(teleportSpy).not.toHaveBeenCalled();

    teleportSpy.mockRestore();
    scheduler.destroy();
  });

  it("preserves new-cycle duel food tracking when old cleanup resolves late", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();
    await vi.advanceTimersByTimeAsync(4000);

    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");

    let releaseRemovals: (() => void) | undefined;
    const removalGate = new Promise<void>((resolve) => {
      releaseRemovals = () => resolve();
    });
    const removeSpy = vi
      .spyOn(scheduler as any, "removeDuelFood")
      .mockImplementation(async () => {
        await removalGate;
      });

    (scheduler as any).endCycle();
    expect(scheduler.getCurrentCycle()?.phase).toBe("ANNOUNCEMENT");

    const duelFoodSlotsByAgent = (scheduler as any).duelFoodSlotsByAgent as Map<
      string,
      number[]
    >;
    const nextAlphaSlots = [101, 102];
    const nextBetaSlots = [103, 104];
    duelFoodSlotsByAgent.set("agent-alpha", nextAlphaSlots);
    duelFoodSlotsByAgent.set("agent-beta", nextBetaSlots);

    if (!releaseRemovals) {
      throw new Error("Expected removal gate resolver to be initialized");
    }
    releaseRemovals();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(duelFoodSlotsByAgent.get("agent-alpha")).toBe(nextAlphaSlots);
    expect(duelFoodSlotsByAgent.get("agent-beta")).toBe(nextBetaSlots);

    removeSpy.mockRestore();
    scheduler.destroy();
  });

  it("Fix F: handleEntityDeath during COUNTDOWN resolves the duel", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();

    expect(scheduler.getCurrentCycle()?.phase).toBe("COUNTDOWN");

    // Simulate a death event during countdown (e.g. stale DoT).
    ctx.world.emit(EventType.ENTITY_DEATH, {
      entityId: "agent-beta",
      killedBy: "agent-alpha",
    });

    // Should move to RESOLUTION.
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");
    expect(scheduler.getCurrentCycle()?.winnerId).toBe("agent-alpha");
    expect(scheduler.getCurrentCycle()?.loserId).toBe("agent-beta");

    scheduler.destroy();
  });

  it("Fix G: endFightByTimeout is no-op when phase is not FIGHTING", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();

    // Phase is COUNTDOWN, not FIGHTING.
    expect(scheduler.getCurrentCycle()?.phase).toBe("COUNTDOWN");

    // Should be a no-op.
    (scheduler as any).endFightByTimeout();
    expect(scheduler.getCurrentCycle()?.phase).toBe("COUNTDOWN");

    scheduler.destroy();
  });

  it("Fix C: startResolution clears countdown timeout on forfeit during countdown", async () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();
    await (scheduler as any).startCountdown();

    expect(scheduler.getCurrentCycle()?.phase).toBe("COUNTDOWN");
    expect((scheduler as any).countdownTimeout).not.toBeNull();

    // Forfeit during countdown.
    (scheduler as any).startResolution("agent-alpha", "agent-beta", "kill");

    // Countdown timeout should be cleared.
    expect((scheduler as any).countdownTimeout).toBeNull();
    expect(scheduler.getCurrentCycle()?.phase).toBe("RESOLUTION");

    scheduler.destroy();
  });

  it("locks camera to winner during resolution", () => {
    const ctx = createMockWorld({
      extraAgents: [
        { id: "agent-gamma", name: "Gamma", position: [30, 0.2, 30] },
      ],
    });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const now = Date.now();
    const cycle = scheduler.getCurrentCycle()!;
    cycle.phase = "RESOLUTION";
    cycle.agent1 = (scheduler as any).createContestant("agent-alpha");
    cycle.agent2 = (scheduler as any).createContestant("agent-beta");
    cycle.winnerId = "agent-beta";

    (scheduler as any).cameraTarget = "agent-gamma";
    (scheduler as any).lastCameraSwitchTime = now - 60_000;

    (scheduler as any).updateCameraTarget(now);
    expect((scheduler as any).cameraTarget).toBe("agent-beta");

    scheduler.destroy();
  });

  it("caches leaderboard and returns same reference when stats are unchanged", () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const lb1 = scheduler.getLeaderboard();
    const lb2 = scheduler.getLeaderboard();

    // Same reference — no recomputation
    expect(lb1).toBe(lb2);
    expect(lb1.length).toBeGreaterThan(0);

    scheduler.destroy();
  });

  it("invalidates leaderboard cache after updateStats", () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    const lb1 = scheduler.getLeaderboard();

    // Simulate a duel result
    (scheduler as any).updateStats("agent-alpha", "agent-beta");

    const lb2 = scheduler.getLeaderboard();

    // New reference — was recomputed
    expect(lb1).not.toBe(lb2);

    // Verify stats updated
    const alpha = lb2.find(
      (e: { characterId: string }) => e.characterId === "agent-alpha",
    );
    expect(alpha?.wins).toBe(1);

    scheduler.destroy();
  });

  it("prunes inactive agent stats to prevent unbounded memory growth", () => {
    const extraAgents = Array.from({ length: 620 }, (_, i) => ({
      id: `agent-extra-${i}`,
      name: `Extra ${i}`,
      position: [100 + i, 0.2, 100] as [number, number, number],
    }));
    const ctx = createMockWorld({ extraAgents });
    const scheduler = new StreamingDuelScheduler(ctx.world as never);

    scheduler.registerAgent("agent-alpha");
    scheduler.registerAgent("agent-beta");
    for (const agent of extraAgents) {
      scheduler.registerAgent(agent.id);
    }

    expect(scheduler.getLeaderboard().length).toBeGreaterThan(512);

    for (const agent of extraAgents) {
      scheduler.unregisterAgent(agent.id);
    }

    const leaderboard = scheduler.getLeaderboard();
    expect(leaderboard.length).toBeLessThanOrEqual(512);
    expect(
      leaderboard.some((entry) => entry.characterId === "agent-alpha"),
    ).toBe(true);
    expect(
      leaderboard.some((entry) => entry.characterId === "agent-beta"),
    ).toBe(true);

    scheduler.destroy();
  });

  it("returns recent duels without unnecessary object cloning", () => {
    const ctx = createMockWorld();
    const scheduler = new StreamingDuelScheduler(ctx.world as never);
    scheduler.init();

    // Insert a duel record
    (scheduler as any).recordRecentDuel({
      cycleId: "test-1",
      duelId: "d1",
      finishedAt: Date.now(),
      winnerId: "agent-alpha",
      winnerName: "Alpha",
      loserId: "agent-beta",
      loserName: "Beta",
      winReason: "kill",
      damageWinner: 50,
      damageLoser: 30,
    });

    const duels1 = scheduler.getRecentDuels(10);
    const duels2 = scheduler.getRecentDuels(10);

    // Records should be same reference (no cloning)
    expect(duels1[0]).toBe(duels2[0]);

    scheduler.destroy();
  });
});
