import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeathState,
  getDuelArenaConfig,
  isPositionInsideCombatArena,
} from "@hyperscape/shared";
import { AgentManager } from "../AgentManager";
import { AgentBehaviorBridge } from "../managers/AgentBehaviorBridge";
import { ejectAgentFromCombatArena } from "../agentRecovery";

type Skill = { level: number; xp: number };

type TestEntity = {
  id: string;
  type: string;
  isAgent?: boolean;
  data: Record<string, any>;
};

type CharacterRow = {
  id: string;
  accountId: string;
  name: string;
  savedData?: Record<string, unknown> | null;
};

function createMockWorld(terrainHeight: number) {
  const entities = new Map<string, TestEntity>();
  const characters = new Map<string, CharacterRow>();
  const combatCalls: Array<{ attackerId: string; targetId: string }> = [];
  const gatherCalls: Array<{ playerId: string; resourceId: string }> = [];

  const defaultSkills: Record<string, Skill> = {
    attack: { level: 10, xp: 0 },
    strength: { level: 10, xp: 0 },
    defense: { level: 10, xp: 0 },
    constitution: { level: 20, xp: 0 },
    ranged: { level: 1, xp: 0 },
    magic: { level: 1, xp: 0 },
    prayer: { level: 1, xp: 0 },
    woodcutting: { level: 1, xp: 0 },
    mining: { level: 1, xp: 0 },
    fishing: { level: 1, xp: 0 },
    firemaking: { level: 1, xp: 0 },
    cooking: { level: 1, xp: 0 },
    smithing: { level: 1, xp: 0 },
  };

  const world = {
    entities: {
      items: entities,
      get: (id: string) => entities.get(id),
      add: (entityData: Record<string, unknown>) => {
        const id = String(entityData.id);
        const skillsFromEntity = (entityData.skills ?? defaultSkills) as Record<
          string,
          Skill
        >;
        const entity: TestEntity = {
          id,
          type: String(entityData.type ?? "object"),
          isAgent: Boolean(entityData.isAgent),
          data: {
            ...entityData,
            skills: Object.fromEntries(
              Object.entries(skillsFromEntity).map(([key, value]) => [
                key,
                { ...value },
              ]),
            ),
          },
        };
        entities.set(id, entity);
        return entity;
      },
      remove: (id: string) => {
        entities.delete(id);
      },
      getAllEntities: () => entities,
    },
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    getSystem: vi.fn((name: string) => {
      if (name === "database") {
        return {
          getCharactersAsync: async (accountId: string) =>
            Array.from(characters.values())
              .filter((character) => character.accountId === accountId)
              .map((character) => ({
                id: character.id,
                name: character.name,
                avatar: null,
                wallet: null,
              })),
          getPlayerAsync: async (characterId: string) =>
            characters.get(characterId)?.savedData ?? null,
        };
      }

      if (name === "terrain") {
        return {
          getHeightAt: () => terrainHeight,
        };
      }

      if (name === "combat") {
        return {
          startCombat: (attackerId: string, targetId: string) => {
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
            target.data.health = Math.max(0, (target.data.health ?? 0) - 4);
            target.data.inCombat = target.data.health > 0;
            target.data.combatTarget =
              target.data.health > 0 ? attackerId : null;
            return true;
          },
        };
      }

      if (name === "resource") {
        return {
          startGathering: (playerId: string, resourceId: string) => {
            gatherCalls.push({ playerId, resourceId });
            const player = entities.get(playerId);
            const woodcutting = player?.data.skills?.woodcutting as Skill;
            if (!woodcutting) {
              return;
            }
            woodcutting.xp += 60;
            while (woodcutting.xp >= 100) {
              woodcutting.xp -= 100;
              woodcutting.level += 1;
            }
          },
        };
      }

      if (name === "movement") {
        return {
          requestMovement: (
            entityId: string,
            target: [number, number, number],
          ) => {
            const entity = entities.get(entityId);
            if (!entity) {
              return;
            }
            entity.data.position = [...target];
          },
          cancelMovement: vi.fn(),
        };
      }

      return null;
    }),
    settings: {
      avatar: { url: "asset://avatars/test.vrm" },
    },
  };

  const registerCharacter = (
    accountId: string,
    characterId: string,
    name: string,
    savedData: Record<string, unknown> | null = null,
  ) => {
    characters.set(characterId, {
      id: characterId,
      accountId,
      name,
      savedData,
    });
  };

  const addMob = (id: string, position: [number, number, number]) => {
    entities.set(id, {
      id,
      type: "mob",
      data: {
        id,
        type: "mob",
        name: "Test Goblin",
        mobType: "goblin",
        position,
        health: 20,
        maxHealth: 20,
      },
    });
  };

  const addResource = (
    id: string,
    position: [number, number, number],
    resourceType: string,
  ) => {
    entities.set(id, {
      id,
      type: "resource",
      data: {
        id,
        type: "resource",
        name: "Test Resource",
        resourceType,
        position,
      },
    });
  };

  return {
    world,
    entities,
    combatCalls,
    gatherCalls,
    registerCharacter,
    addMob,
    addResource,
  };
}

describe("AgentManager autonomous loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.spyOn(AgentBehaviorBridge.prototype, "start").mockResolvedValue();
    vi.spyOn(AgentBehaviorBridge.prototype, "stop").mockImplementation(() => {});
    vi.spyOn(AgentBehaviorBridge.prototype, "startAgent").mockImplementation(
      () => {},
    );
    vi.spyOn(AgentBehaviorBridge.prototype, "stopAgent").mockImplementation(
      () => {},
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recovers agents from stale dead-loop state outside active streaming duel", async () => {
    const terrainHeight = 9;
    const ctx = createMockWorld(terrainHeight);
    ctx.registerCharacter("acct-4", "agent-loop", "Loop Agent");
    ctx.addResource("resource-tree", [2, terrainHeight + 0.1, 0], "tree");

    const manager = new AgentManager(ctx.world as never);
    try {
      await manager.createAgent({
        characterId: "agent-loop",
        accountId: "acct-4",
        name: "Loop Agent",
        scriptedRole: "woodcutting",
        autoStart: true,
      });

      await Promise.resolve();
      await Promise.resolve();

      const agent = ctx.entities.get("agent-loop");
      expect(agent).toBeDefined();

      agent!.data.health = 0;
      agent!.data.deathState = DeathState.DYING;
      agent!.data.isDead = true;
      agent!.data.inCombat = true;
      agent!.data.combatTarget = "mob-goblin";
      agent!.data.inStreamingDuel = true;
      agent!.data.preventRespawn = true;

      await manager.executeBehaviorTick("agent-loop");

      expect(agent!.data.health).toBe(agent!.data.maxHealth);
      expect(agent!.data.deathState).toBe(DeathState.ALIVE);
      expect(agent!.data.isDead).toBe(false);
      expect(agent!.data.inStreamingDuel).toBe(false);
      expect(agent!.data.preventRespawn).toBe(false);
      expect(agent!.data.inCombat).toBe(false);
      expect(agent!.data.combatTarget).toBeNull();
      expect(
        isPositionInsideCombatArena(
          agent!.data.position[0],
          agent!.data.position[2],
        ),
      ).toBe(false);
      expect(
        Math.hypot(agent!.data.position[0], agent!.data.position[2]),
      ).toBeLessThanOrEqual(8);
      expect(agent!.data.position[1]).toBeCloseTo(terrainHeight + 0.1, 5);
      expect(agent!.data._teleport).toBe(true);
    } finally {
      await manager.shutdown();
    }
  });

  it("teleports non-dueling agents out of combat arena tiles", async () => {
    const terrainHeight = 9;
    const ctx = createMockWorld(terrainHeight);
    const arena = getDuelArenaConfig();
    const arenaCenter = [
      arena.baseX + Math.max(1, Math.floor(arena.arenaWidth / 2)),
      terrainHeight + 0.1,
      arena.baseZ + Math.max(1, Math.floor(arena.arenaLength / 2)),
    ] as const;
    ctx.world.entities.add({
      id: "agent-out",
      type: "player",
      isAgent: true,
      position: [...arenaCenter],
      health: 20,
      maxHealth: 20,
      inStreamingDuel: false,
      preventRespawn: false,
    });

    const agent = ctx.entities.get("agent-out");
    expect(agent).toBeDefined();

    const ejected = ejectAgentFromCombatArena(
      ctx.world as never,
      "agent-out",
      "test",
    );

    expect(isPositionInsideCombatArena(arenaCenter[0], arenaCenter[2])).toBe(
      true,
    );
    expect(ejected).toBe(true);
    expect(
      isPositionInsideCombatArena(
        agent!.data.position[0],
        agent!.data.position[2],
      ),
    ).toBe(false);
    expect(agent!.data._teleport).toBe(true);
    expect(agent!.data.inStreamingDuel).toBe(false);
    expect(agent!.data.preventRespawn).toBe(false);
    expect(
      Math.hypot(agent!.data.position[0], agent!.data.position[2]),
    ).toBeLessThanOrEqual(8);
  });
});
