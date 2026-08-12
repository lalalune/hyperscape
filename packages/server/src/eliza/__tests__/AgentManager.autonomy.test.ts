import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeathState,
  ITEMS,
  getDuelArenaConfig,
  isPositionInsideCombatArena,
  prayerDataProvider,
} from "@hyperforge/shared";
import { AgentManager } from "../AgentManager";
import { EmbeddedHyperiaService } from "../EmbeddedHyperiaService";
import prayersManifest from "../../../world/assets/manifests/prayers.json";

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

const EMPTY_FROZEN_ARMOR_IDS = {
  helmet: null,
  body: null,
  legs: null,
  boots: null,
  gloves: null,
  cape: null,
  amulet: null,
  ring: null,
} as const;

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
  const duelPreparationItems = [
    {
      id: "test_prep_sword",
      name: "Test Preparation Sword",
      type: "weapon",
      equipSlot: "weapon",
      attackType: "MELEE",
      stackable: false,
      bonuses: { attack: 8, strength: 7 },
      requirements: { level: 1, skills: { attack: 1 } },
    },
    {
      id: "shortbow",
      name: "Shortbow",
      type: "weapon",
      equipSlot: "2h",
      attackType: "RANGED",
      weaponType: "BOW",
      stackable: false,
      bonuses: { attackRanged: 8 },
      requirements: { skills: { ranged: 1 } },
    },
    {
      id: "bronze_arrow",
      name: "Bronze Arrow",
      type: "ammunition",
      equipSlot: "arrows",
      stackable: true,
      requirements: { skills: { ranged: 1 } },
    },
    {
      id: "staff_of_air",
      name: "Staff of Air",
      type: "weapon",
      equipSlot: "weapon",
      attackType: "MAGIC",
      weaponType: "STAFF",
      stackable: false,
      bonuses: { attackMagic: 10 },
      requirements: { skills: { magic: 1 } },
    },
    {
      id: "fire_rune",
      name: "Fire Rune",
      type: "material",
      stackable: true,
    },
    {
      id: "mind_rune",
      name: "Mind Rune",
      type: "material",
      stackable: true,
    },
    {
      id: "lobster",
      name: "Lobster",
      type: "consumable",
      healAmount: 12,
      stackable: false,
    },
    {
      id: "test_prep_junk",
      name: "Test Preparation Junk",
      type: "material",
      stackable: false,
    },
    {
      id: "test_prep_weak_body",
      name: "Test Preparation Weak Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      bonuses: { defenseStab: 2, defenseSlash: 2, defenseCrush: 2 },
    },
    {
      id: "test_prep_strong_body",
      name: "Test Preparation Strong Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      requirements: { skills: { defence: 20 } },
      bonuses: { defenseStab: 12, defenseSlash: 14, defenseCrush: 10 },
    },
    {
      id: "test_prep_overleveled_body",
      name: "Test Preparation Overleveled Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      requirements: { skills: { defence: 40 } },
      bonuses: { defenseStab: 50, defenseSlash: 50, defenseCrush: 50 },
    },
    {
      id: "test_prep_metal_body",
      name: "Test Preparation Metal Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      bonuses: {
        attackMagic: -30,
        defenseStab: 30,
        defenseSlash: 30,
        defenseCrush: 30,
      },
    },
    {
      id: "test_prep_wizard_body",
      name: "Test Preparation Wizard Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      bonuses: { attackMagic: 3, defenseMagic: 3 },
    },
    {
      id: "test_prep_ranged_defense_body",
      name: "Test Preparation Ranged Defense Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      bonuses: { defenseRanged: 20, defenseMagic: 1 },
    },
    {
      id: "test_prep_magic_defense_body",
      name: "Test Preparation Magic Defense Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      bonuses: { defenseRanged: 1, defenseMagic: 20 },
    },
    {
      id: "test_prep_shield",
      name: "Test Preparation Shield",
      type: "armor",
      equipSlot: "shield",
      stackable: false,
      bonuses: { defenseStab: 5, defenseSlash: 5, defenseCrush: 5 },
    },
    {
      id: "test_prep_melee_body",
      name: "Test Preparation Melee Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      bonuses: { defenseStab: 4, defenseSlash: 4, defenseCrush: 4 },
    },
    {
      id: "test_prep_ranged_body",
      name: "Test Preparation Ranged Body",
      type: "armor",
      equipSlot: "body",
      stackable: false,
      bonuses: { attackRanged: 8, defenseRanged: 2 },
    },
    {
      id: "water_rune",
      name: "Water Rune",
      type: "material",
      stackable: true,
    },
  ] as const;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    prayerDataProvider.loadPrayers(prayersManifest);
    prayerDataProvider.rebuild();
    for (const item of duelPreparationItems) {
      ITEMS.set(item.id, item as never);
    }
    vi.spyOn(
      EmbeddedHyperiaService.prototype,
      "executeDuelPreparationPlan",
    ).mockImplementation(async function (
      this: EmbeddedHyperiaService,
      request,
    ) {
      return {
        ok: true,
        playerId: (this as unknown as { characterId: string }).characterId,
        operationId: request.operationId,
        preparationId: request.preparationId,
        requestFingerprint: "test-atomic-plan-fingerprint",
        changed: true,
        replayed: false,
        committed: request.committed,
        recoveryEvidence: request.recoveryEvidence,
      };
    });
  });

  afterEach(() => {
    for (const item of duelPreparationItems) {
      ITEMS.delete(item.id);
    }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("keeps scripted agents off model runtimes unless explicitly enabled", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-scripted", "agent-scripted", "Scripted Agent");
    ctx.registerCharacter("acct-hybrid", "agent-hybrid", "Hybrid Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    const ensureChatRuntime = vi
      .spyOn(
        manager as unknown as {
          ensureChatRuntime(characterId: string): Promise<unknown>;
        },
        "ensureChatRuntime",
      )
      .mockResolvedValue(null);

    try {
      await manager.createAgent({
        characterId: "agent-scripted",
        accountId: "acct-scripted",
        name: "Scripted Agent",
        scriptedRole: "combat",
        autoStart: true,
      });

      expect(ensureChatRuntime).not.toHaveBeenCalled();
      expect(manager.getAgentInfo("agent-scripted")?.llmEnabled).toBe(false);

      await manager.createAgent({
        characterId: "agent-hybrid",
        accountId: "acct-hybrid",
        name: "Hybrid Agent",
        scriptedRole: "combat",
        enableLlm: true,
        autoStart: false,
      });
      expect(manager.getAgentInfo("agent-hybrid")?.llmEnabled).toBe(true);
    } finally {
      await manager.shutdown();
    }
  });

  it("fences pending model output when a chat runtime is stopped or replaced", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-runtime", "agent-runtime", "Runtime Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    await manager.createAgent({
      characterId: "agent-runtime",
      accountId: "acct-runtime",
      name: "Runtime Agent",
      autoStart: false,
    });
    const instance = (manager as any).agents.get("agent-runtime");
    const stop = vi.fn().mockResolvedValue(undefined);
    instance.chatRuntime = { stop };
    instance.chatRuntimeInfo = {
      provider: "test-provider",
      model: "test-model",
      source: "test",
    };
    instance.chatRuntimeConfigSig = "old-runtime";
    instance.pendingLlmResult = { action: { type: "idle" } };
    instance.llmPlan = {
      steps: ["old step"],
      currentStep: 0,
      createdAt: Date.now(),
      goal: "old goal",
    };
    instance.llmOutcomeBuffer = ["fail", "fail"];
    instance.llmCircuitOpenUntil = Date.now() + 60_000;
    const priorBehaviorEpoch = instance.behaviorEpoch;
    const priorRuntimeGeneration = instance.chatRuntimeGeneration;

    await (manager as any).stopChatRuntime("agent-runtime");

    expect(stop).toHaveBeenCalledTimes(1);
    expect(instance.chatRuntime).toBeNull();
    expect(instance.chatRuntimeInfo).toBeNull();
    expect(instance.chatRuntimeConfigSig).toBeUndefined();
    expect(instance.pendingLlmResult).toBeUndefined();
    expect(instance.llmPlan).toBeUndefined();
    expect(instance.llmOutcomeBuffer).toEqual([]);
    expect(instance.llmCircuitOpenUntil).toBeUndefined();
    expect(instance.behaviorEpoch).toBe(priorBehaviorEpoch + 1);
    expect(instance.chatRuntimeGeneration).toBe(priorRuntimeGeneration + 1);

    await manager.shutdown();
  });

  it("recovers agents from stale dead-loop state outside active streaming duel", async () => {
    const terrainHeight = 9;
    const ctx = createMockWorld(terrainHeight);
    ctx.registerCharacter("acct-4", "agent-loop", "Loop Agent");
    ctx.addResource("resource-tree", [2, terrainHeight + 0.1, 0], "tree");

    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
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
      expect(agent!.data.position[1]).toBeCloseTo(terrainHeight + 0.1, 5);
      expect(
        isPositionInsideCombatArena(
          agent!.data.position[0],
          agent!.data.position[2],
        ),
      ).toBe(false);
      expect(
        Math.hypot(agent!.data.position[0], agent!.data.position[2]),
      ).toBeLessThanOrEqual(8);
    } finally {
      await manager.shutdown();
    }
  });

  it("teleports non-dueling agents out of combat arena tiles", async () => {
    const terrainHeight = 9;
    const ctx = createMockWorld(terrainHeight);
    ctx.registerCharacter("acct-5", "agent-out", "Outside Agent");

    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-out",
        accountId: "acct-5",
        name: "Outside Agent",
        scriptedRole: "combat",
        autoStart: true,
      });

      await Promise.resolve();
      await Promise.resolve();

      const agent = ctx.entities.get("agent-out");
      expect(agent).toBeDefined();

      // Place agent inside arena 1 while not in a duel.
      const arena = getDuelArenaConfig();
      agent!.data.position = [
        arena.baseX + arena.arenaWidth / 2,
        terrainHeight + 0.1,
        arena.baseZ + arena.arenaLength / 2,
      ];
      agent!.data.inStreamingDuel = false;
      agent!.data.preventRespawn = false;

      await manager.executeBehaviorTick("agent-out");

      expect(
        isPositionInsideCombatArena(
          agent!.data.position[0],
          agent!.data.position[2],
        ),
      ).toBe(false);
      expect(agent!.data._teleport).toBe(true);
      expect(agent!.data.inStreamingDuel).toBe(false);
      expect(agent!.data.preventRespawn).toBe(false);

      // Ejected agents should remain near the starter area, away from arenas.
      expect(
        Math.hypot(agent!.data.position[0], agent!.data.position[2]),
      ).toBeLessThanOrEqual(8);
    } finally {
      await manager.shutdown();
    }
  });

  it("automatically opens only the selected agent's private preparation bank", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-prep", "agent-prep", "Prepared Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-prep",
        accountId: "acct-prep",
        name: "Prepared Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-prep");
      const open = vi
        .spyOn(instance.service, "executeDuelPreparationBankOpen")
        .mockResolvedValue({
          success: true,
          operationId: "f9771187-7443-4612-bf51-f2db8903dd77",
          commitState: "not_applicable",
          replayed: false,
          action: "open",
          playerId: "agent-prep",
          bankId: "duel-preparation:3c477a8d-ae92-4a0e-88ec-7b6fa779e761",
          itemId: null,
          requestedQuantity: 0,
          committedQuantity: 0,
          inventoryQuantityAfter: null,
          bankQuantityAfter: null,
          bankItems: [
            { itemId: "test_prep_sword", quantity: 1, slot: 0, tabIndex: 0 },
          ],
        });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "3c477a8d-ae92-4a0e-88ec-7b6fa779e761",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-prep",
        agent1Name: "Prepared Agent",
        agent2Id: "agent-opponent",
        agent2Name: "Opponent",
      });

      expect(open).toHaveBeenCalledWith("3c477a8d-ae92-4a0e-88ec-7b6fa779e761");
      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      expect(atomicPlan.mock.calls[0][0]).toMatchObject({
        preparationId: "3c477a8d-ae92-4a0e-88ec-7b6fa779e761",
        operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        expectedBank: [
          { itemId: "test_prep_sword", quantity: 1, slot: 0, tabIndex: 0 },
        ],
        committed: {
          bank: [],
          inventory: [],
          equipment: [
            {
              slotType: "weapon",
              itemId: "test_prep_sword",
              quantity: 1,
            },
          ],
          selectedSpell: null,
        },
      });
      expect(instance.goal).toMatchObject({
        type: "banking",
        description: "Prepare a legal duel loadout against Opponent",
      });
      expect(instance.duelPreparation).toMatchObject({
        status: "planning",
        opponentId: "agent-opponent",
        bankItems: [],
      });
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({
          agentId: "agent-prep",
          preparationId: "3c477a8d-ae92-4a0e-88ec-7b6fa779e761",
        }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_bank_status",
        expect.objectContaining({
          agentId: "agent-prep",
          success: true,
        }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("drains an ordinary equipment action before opening private preparation custody", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-fenced", "agent-fenced", "Fenced Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-fenced",
        accountId: "acct-fenced",
        name: "Fenced Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-fenced");
      const bridge = (manager as any).behaviorBridge;
      let finishEquip!: () => void;
      const equipPending = new Promise<any>((resolve) => {
        finishEquip = () =>
          resolve({
            ok: true,
            playerId: "agent-fenced",
            itemId: "ordinary_sword",
            slot: "weapon",
            changed: true,
          });
      });
      const equip = vi
        .spyOn(instance.service, "executeEquip")
        .mockImplementation(() => equipPending);
      const open = vi
        .spyOn(instance.service, "executeDuelPreparationBankOpen")
        .mockResolvedValue({ success: true, bankItems: [] });

      const applyPromise = bridge.applyTickResultWithDrain({
        characterId: "agent-fenced",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "equip", itemId: "ordinary_sword" },
        updatedState: {
          goal: { type: "exploring", description: "Ordinary exploration" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });
      await vi.waitFor(() => expect(equip).toHaveBeenCalledTimes(1));

      const preparationPromise = (manager as any).handleDuelPreparationSelected(
        {
          preparationId: "11a64a30-58d8-430c-b52c-19c9761804af",
          selectedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          agent1Id: "agent-fenced",
          agent1Name: "Fenced Agent",
          agent2Id: "agent-opponent",
          agent2Name: "Opponent",
        },
      );

      await vi.waitFor(() =>
        expect(instance.duelPreparation?.preparationId).toBe(
          "11a64a30-58d8-430c-b52c-19c9761804af",
        ),
      );
      expect(instance.behaviorEpoch).toBe(1);
      expect(open).not.toHaveBeenCalled();

      finishEquip();
      await applyPromise;
      await preparationPromise;

      expect(open).toHaveBeenCalledWith("11a64a30-58d8-430c-b52c-19c9761804af");
      expect(instance.goal).toMatchObject({ type: "banking" });
    } finally {
      await manager.shutdown();
    }
  });

  it("advances the food cooldown only after an authoritative consumption receipt", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-food-truth", "agent-food-truth", "Food Truth");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-food-truth",
        accountId: "acct-food-truth",
        name: "Food Truth",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-food-truth");
      const bridge = (manager as any).behaviorBridge;
      const foodId = Array.from(ITEMS.entries()).find(
        ([, item]) =>
          typeof (item as { healAmount?: unknown }).healAmount === "number" &&
          Number((item as { healAmount: number }).healAmount) > 0,
      )?.[0];
      expect(foodId).toBeDefined();
      instance.lastAteAt = 100;
      const use = vi
        .spyOn(instance.service, "executeUse")
        .mockResolvedValueOnce({ ok: false } as never)
        .mockResolvedValueOnce({ ok: true } as never);
      const makeResult = () => ({
        characterId: "agent-food-truth",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "use" as const, itemId: foodId! },
        updatedState: {
          goal: { type: "combat" as const, description: "Train safely" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      await bridge.applyTickResultWithDrain(makeResult());
      expect(use).toHaveBeenCalledTimes(1);
      expect(instance.lastAteAt).toBe(100);

      const successfulAttemptStartedAt = Date.now();
      await bridge.applyTickResultWithDrain(makeResult());
      expect(use).toHaveBeenCalledTimes(2);
      expect(instance.lastAteAt).toBeGreaterThanOrEqual(
        successfulAttemptStartedAt,
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("advances processing activity only after authoritative completion", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-processing", "agent-processing", "Processor");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-processing",
        accountId: "acct-processing",
        name: "Processor",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-processing");
      const bridge = (manager as any).behaviorBridge;
      instance.lastActivity = 100;
      const persist = vi.fn().mockResolvedValue(undefined);
      bridge.persistAutonomyCheckpoint = persist;
      const smelt = vi
        .spyOn(instance.service, "executeSmelt")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error("processing subsystem unavailable"));
      const result = {
        characterId: "agent-processing",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "smelt", recipe: "bronze_bar" },
        updatedState: {
          goal: { type: "smithing", description: "Smelt bronze" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      };

      await bridge.applyTickResultWithDrain(result);
      expect(smelt).toHaveBeenCalledTimes(1);
      expect(instance.lastActivity).toBe(100);
      expect(persist).toHaveBeenNthCalledWith(1, instance, {
        attemptedActionType: "smelt",
        appliedActionType: null,
        outcome: "rejected",
      });
      expect(instance.ordinaryProcessingRetries).toEqual([
        expect.objectContaining({
          actionType: "smelt",
          intentId: "bronze_bar",
          consecutiveFailures: 1,
        }),
      ]);

      // A stale worker/model result cannot replay the exact rejection while
      // its technical cooldown is active.
      await bridge.applyTickResultWithDrain(result);
      expect(smelt).toHaveBeenCalledTimes(1);
      expect(instance.lastActivity).toBe(100);
      expect(persist).toHaveBeenNthCalledWith(2, instance, {
        attemptedActionType: "idle",
        appliedActionType: null,
        outcome: "idle",
      });

      instance.ordinaryProcessingRetries[0].retryAfter = Date.now() - 1;
      await bridge.applyTickResultWithDrain(result);
      expect(smelt).toHaveBeenCalledTimes(2);
      expect(instance.lastActivity).toBeGreaterThan(100);
      expect(persist).toHaveBeenNthCalledWith(3, instance, {
        attemptedActionType: "smelt",
        appliedActionType: "smelt",
        outcome: "completed",
      });
      expect(instance.ordinaryProcessingRetries).toEqual([]);

      const lastSuccessfulActivity = instance.lastActivity;
      await bridge.applyTickResultWithDrain(result);
      expect(smelt).toHaveBeenCalledTimes(3);
      expect(instance.lastActivity).toBe(lastSuccessfulActivity);
      expect(persist).toHaveBeenNthCalledWith(4, instance, {
        attemptedActionType: "smelt",
        appliedActionType: null,
        outcome: "failed",
      });
    } finally {
      await manager.shutdown();
    }
  });

  it("checkpoints ordinary autonomy only after the action dispatch returns", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-checkpoint",
      "agent-checkpoint",
      "Checkpoint Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-checkpoint",
        accountId: "acct-checkpoint",
        name: "Checkpoint Agent",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-checkpoint");
      const bridge = (manager as any).behaviorBridge;
      let finishSmelt!: () => void;
      const smeltPending = new Promise<boolean>((resolve) => {
        finishSmelt = () => resolve(true);
      });
      vi.spyOn(instance.service, "executeSmelt").mockReturnValue(smeltPending);
      const persist = vi.fn().mockResolvedValue(undefined);
      bridge.persistAutonomyCheckpoint = persist;

      const apply = bridge.applyTickResultWithDrain({
        characterId: "agent-checkpoint",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "smelt", recipe: "bronze_bar" },
        updatedState: {
          goal: { type: "smithing", description: "Smelt bronze" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      await Promise.resolve();
      expect(persist).not.toHaveBeenCalled();
      finishSmelt();
      await apply;
      expect(persist).toHaveBeenCalledOnce();
      expect(persist).toHaveBeenCalledWith(instance, {
        attemptedActionType: "smelt",
        appliedActionType: "smelt",
        outcome: "completed",
      });
    } finally {
      await manager.shutdown();
    }
  });

  it("binds gravestone custody to the tracked attempt and waits for completion", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-grave-recovery",
      "agent-grave-recovery",
      "Grave Recovery",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-grave-recovery",
        accountId: "acct-grave-recovery",
        name: "Grave Recovery",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-grave-recovery");
      const bridge = (manager as any).behaviorBridge;
      const attempt = {
        attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        characterId: "agent-grave-recovery",
        phase: "ordinary_progression",
        goalType: null,
        actionType: "lootGravestone",
        decisionSource: "scripted",
        startedAt: Date.now(),
      };
      bridge.beginAutonomyProgressionAttempt = vi
        .fn()
        .mockResolvedValue(attempt);
      let finishLoot!: (success: boolean) => void;
      const lootPending = new Promise<boolean>((resolve) => {
        finishLoot = resolve;
      });
      const loot = vi
        .spyOn(instance.service, "executeLootGravestone")
        .mockReturnValue(lootPending);
      const persist = vi.fn().mockResolvedValue(undefined);
      bridge.persistAutonomyCheckpoint = persist;

      const apply = bridge.applyTickResultWithDrain({
        characterId: "agent-grave-recovery",
        behaviorEpoch: instance.behaviorEpoch,
        action: {
          type: "lootGravestone",
          gravestoneId: "gravestone_agent-grave-recovery_1",
        },
        updatedState: {
          goal: null,
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      await vi.waitFor(() => expect(loot).toHaveBeenCalledOnce());
      expect(loot).toHaveBeenCalledWith(
        "gravestone_agent-grave-recovery_1",
        attempt.attemptId,
      );
      expect(persist).not.toHaveBeenCalled();

      finishLoot(true);
      await apply;
      expect(persist).toHaveBeenCalledWith(
        instance,
        {
          attemptedActionType: "lootGravestone",
          appliedActionType: "lootGravestone",
          outcome: "completed",
        },
        attempt,
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("forwards the tracked attempt and safe context through both manager adapters", async () => {
    const ctx = createMockWorld(9);
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      const instance = {
        config: { characterId: "adapter-agent" },
      } as never;
      const actionResult = {
        attemptedActionType: "smelt",
        appliedActionType: "smelt",
        outcome: "completed",
      } as const;
      const attempt = {
        attemptId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        characterId: "adapter-agent",
        phase: "ordinary_progression",
        goalType: "smelting",
        actionType: "smelt",
        decisionSource: "scripted",
        startedAt: 1_000,
      } as const;
      const safeContext = {
        goal: { type: "smelting", description: "Smelt one verified bar" },
        plan: null,
        memories: [],
        recentActionLog: [],
        tickCounter: 4,
      } as const;
      const persist = vi.fn().mockResolvedValue(undefined);
      (manager as any).persistAutonomyCheckpoint = persist;

      await (manager as any).behaviorBridge.persistAutonomyCheckpoint(
        instance,
        actionResult,
        attempt,
        safeContext,
      );
      await (manager as any).behaviorTicker.persistAutonomyCheckpoint(
        instance,
        actionResult,
        attempt,
        safeContext,
      );

      expect(persist).toHaveBeenNthCalledWith(
        1,
        instance,
        actionResult,
        attempt,
        safeContext,
      );
      expect(persist).toHaveBeenNthCalledWith(
        2,
        instance,
        actionResult,
        attempt,
        safeContext,
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("confirms the durable started edge before dispatching a tracked action", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-start-first",
      "agent-start-first",
      "Start First",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-start-first",
        accountId: "acct-start-first",
        name: "Start First",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-start-first");
      const bridge = (manager as any).behaviorBridge;
      const attempt = {
        attemptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        characterId: "agent-start-first",
        phase: "ordinary_progression",
        goalType: "smelting",
        actionType: "smelt",
        decisionSource: "scripted",
        startedAt: Date.now(),
      };
      let confirmStart!: () => void;
      const startPending = new Promise<typeof attempt>((resolve) => {
        confirmStart = () => resolve(attempt);
      });
      const begin = vi.fn().mockReturnValue(startPending);
      bridge.beginAutonomyProgressionAttempt = begin;
      const smelt = vi
        .spyOn(instance.service, "executeSmelt")
        .mockResolvedValue(true);
      const persist = vi.fn().mockResolvedValue(undefined);
      bridge.persistAutonomyCheckpoint = persist;

      const apply = bridge.applyTickResultWithDrain({
        characterId: "agent-start-first",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "smelt", recipe: "bronze_bar" },
        updatedState: {
          goal: { type: "smelting", description: "Smelt bronze" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
      expect(smelt).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
      confirmStart();
      await apply;

      expect(begin).toHaveBeenCalledWith(instance, "smelt", "scripted");
      expect(smelt).toHaveBeenCalledOnce();
      expect(persist).toHaveBeenCalledWith(
        instance,
        {
          attemptedActionType: "smelt",
          appliedActionType: "smelt",
          outcome: "completed",
        },
        attempt,
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("fails closed when the started edge cannot be confirmed", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-untracked", "agent-untracked", "Untracked");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-untracked",
        accountId: "acct-untracked",
        name: "Untracked",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-untracked");
      const bridge = (manager as any).behaviorBridge;
      instance.lastActivity = 100;
      bridge.beginAutonomyProgressionAttempt = vi
        .fn()
        .mockRejectedValue(new Error("progression database unavailable"));
      const smelt = vi.spyOn(instance.service, "executeSmelt");
      const persist = vi.fn().mockResolvedValue(undefined);
      bridge.persistAutonomyCheckpoint = persist;

      await bridge.applyTickResultWithDrain({
        characterId: "agent-untracked",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "smelt", recipe: "bronze_bar" },
        updatedState: {
          goal: { type: "smelting", description: "Smelt bronze" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      expect(smelt).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
      expect(instance.lastActivity).toBe(100);
      expect(instance.recentActionLog).toEqual([
        { tick: 1, action: "scripted:smelt", result: "failed" },
      ]);
    } finally {
      await manager.shutdown();
    }
  });

  it("closes a tracked action from pre-selection context when selection fences it in flight", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-fenced-ledger",
      "agent-fenced-ledger",
      "Fenced Ledger",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-fenced-ledger",
        accountId: "acct-fenced-ledger",
        name: "Fenced Ledger",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-fenced-ledger");
      const bridge = (manager as any).behaviorBridge;
      const attempt = {
        attemptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        characterId: "agent-fenced-ledger",
        phase: "ordinary_progression",
        goalType: "smelting",
        actionType: "smelt",
        decisionSource: "scripted",
        startedAt: Date.now(),
      };
      bridge.beginAutonomyProgressionAttempt = vi
        .fn()
        .mockResolvedValue(attempt);
      let finishSmelt!: () => void;
      const smeltPending = new Promise<boolean>((resolve) => {
        finishSmelt = () => resolve(true);
      });
      const smelt = vi
        .spyOn(instance.service, "executeSmelt")
        .mockReturnValue(smeltPending);
      const persist = vi.fn().mockResolvedValue(undefined);
      bridge.persistAutonomyCheckpoint = persist;
      instance.recentActionLog = [];

      const apply = bridge.applyTickResultWithDrain({
        characterId: "agent-fenced-ledger",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "smelt", recipe: "bronze_bar" },
        updatedState: {
          goal: { type: "smelting", description: "Smelt before selection" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });
      await vi.waitFor(() => expect(smelt).toHaveBeenCalledOnce());

      instance.behaviorEpoch += 1;
      instance.duelPreparation = {
        preparationId: "preparation-fence",
      } as never;
      instance.goal = {
        type: "banking",
        description: "Private duel preparation",
      };
      finishSmelt();
      await apply;

      expect(instance.recentActionLog).toEqual([]);
      expect(persist).toHaveBeenCalledWith(
        instance,
        {
          attemptedActionType: "smelt",
          appliedActionType: "smelt",
          outcome: "completed",
        },
        attempt,
        expect.objectContaining({
          goal: {
            type: "smelting",
            description: "Smelt before selection",
          },
          recentActionLog: [],
        }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("commits a consumed model plan and feedback only after its action result returns", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-model-truth",
      "agent-model-truth",
      "Model Truth",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-model-truth",
        accountId: "acct-model-truth",
        name: "Model Truth",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-model-truth");
      const bridge = (manager as any).behaviorBridge;
      const useModel = vi.fn();
      instance.chatRuntime = { useModel };
      instance.autonomyRecoveryPending = true;
      instance.memories = ["Previously verified context"];
      instance.recentActionLog = [];
      instance.tickCounter = 0;
      instance.llmPlan = {
        steps: ["Old advisory step"],
        currentStep: 0,
        createdAt: 10,
        goal: "Old goal",
      };
      instance.pendingLlmResult = {
        action: { type: "smelt", recipe: "bronze_bar" },
        reasoning: "Convert held ore into a usable bar.",
        goal: { type: "smelting", description: "Prepare a bronze bar" },
        plan: ["Smelt the ore", "Reassess the inventory"],
        thinking: "The furnace action is currently legal.",
        planStep: 1,
      };

      let finishSmelt!: () => void;
      const smeltPending = new Promise<boolean>((resolve) => {
        finishSmelt = () => {
          instance.chatRuntime = null;
          resolve(false);
        };
      });
      const smelt = vi
        .spyOn(instance.service, "executeSmelt")
        .mockReturnValue(smeltPending);
      const persist = vi.fn().mockResolvedValue(undefined);
      bridge.persistAutonomyCheckpoint = persist;

      const apply = bridge.applyTickResultWithDrain({
        characterId: "agent-model-truth",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "idle" },
        updatedState: {
          goal: { type: "idle", description: "Worker fallback" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      await vi.waitFor(() => expect(smelt).toHaveBeenCalledOnce());
      expect(instance.llmPlan.steps).toEqual(["Old advisory step"]);
      expect(instance.recentActionLog).toEqual([]);
      expect(instance.autonomyRecoveryPending).toBe(true);
      expect(persist).not.toHaveBeenCalled();

      finishSmelt();
      await apply;

      expect(instance.llmPlan).toMatchObject({
        steps: ["Smelt the ore", "Reassess the inventory"],
        currentStep: 1,
        goal: "Prepare a bronze bar",
      });
      expect(instance.memories).toEqual(["Previously verified context"]);
      expect(instance.recentActionLog).toEqual([
        { tick: 1, action: "llm:smelt", result: "rejected" },
      ]);
      expect(instance.recentLlmActions).toEqual(["smelt:rejected:none"]);
      expect(instance.autonomyRecoveryPending).toBe(false);
      expect(instance.pendingLlmResult).toBeUndefined();
      expect(useModel).not.toHaveBeenCalled();
      expect(persist).toHaveBeenCalledWith(instance, {
        attemptedActionType: "smelt",
        appliedActionType: null,
        outcome: "rejected",
      });
    } finally {
      await manager.shutdown();
    }
  });

  it("discards an unconsumed prefetch when persistent navigation owns the tick", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-stale-model",
      "agent-stale-model",
      "Stale Model",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-stale-model",
        accountId: "acct-stale-model",
        name: "Stale Model",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-stale-model");
      const bridge = (manager as any).behaviorBridge;
      const useModel = vi.fn();
      instance.chatRuntime = { useModel };
      instance.navigationTarget = {
        position: [500, 0, 500],
        description: "Verified destination",
        setAt: Date.now(),
      };
      instance.pendingLlmResult = {
        action: { type: "smelt", recipe: "bronze_bar" },
        reasoning: "This observation will become stale.",
        goal: { type: "smelting", description: "Smelt bronze" },
        plan: ["Smelt bronze"],
        thinking: null,
        planStep: 0,
      };
      const move = vi
        .spyOn(instance.service, "executeMove")
        .mockResolvedValue(true);
      const smelt = vi.spyOn(instance.service, "executeSmelt");

      await bridge.applyTickResultWithDrain({
        characterId: "agent-stale-model",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "idle" },
        updatedState: {
          goal: { type: "exploring", description: "Continue navigation" },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      expect(move).toHaveBeenCalledWith([500, 0, 500], true);
      expect(smelt).not.toHaveBeenCalled();
      expect(instance.pendingLlmResult).toBeUndefined();
      expect(instance.llmPlan).toBeUndefined();
      expect(instance.recentLlmActions).toBeUndefined();
      expect(instance.recentActionLog).toEqual([
        {
          tick: 1,
          action: "scripted:move",
          result: "dispatched; applied=move",
        },
      ]);
      expect(useModel).not.toHaveBeenCalled();
    } finally {
      await manager.shutdown();
    }
  });

  it("keeps a skill-training bank approach ahead of a stale model prefetch", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-training-bank",
      "agent-training-bank",
      "Training Bank Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-training-bank",
        accountId: "acct-training-bank",
        name: "Training Bank Agent",
        scriptedRole: "mining",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-training-bank");
      const bridge = (manager as any).behaviorBridge;
      instance.chatRuntime = { useModel: vi.fn() };
      instance.pendingLlmResult = {
        action: { type: "smelt", recipe: "bronze_bar" },
        reasoning: "This observation predates the training-bank route.",
        goal: { type: "smelting", description: "Smelt bronze" },
        plan: ["Smelt bronze"],
        thinking: null,
        planStep: 0,
      };
      const move = vi
        .spyOn(instance.service, "executeMove")
        .mockResolvedValue(true);
      const smelt = vi.spyOn(instance.service, "executeSmelt");

      await bridge.applyTickResultWithDrain({
        characterId: "agent-training-bank",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "move", target: [110, 0, 100], runMode: true },
        updatedState: {
          goal: {
            type: "banking",
            description: "Stage Fletching training",
            questId: "fletchers_introduction",
            questName: "Fletcher's Introduction",
          },
          questsAccepted: [],
          currentTargetId: null,
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      expect(move).toHaveBeenCalledWith([110, 0, 100], true);
      expect(smelt).not.toHaveBeenCalled();
      expect(instance.pendingLlmResult).toBeUndefined();
      expect(instance.goal).toMatchObject({
        type: "banking",
        questId: "fletchers_introduction",
      });
      expect(instance.llmPlan).toBeUndefined();
    } finally {
      await manager.shutdown();
    }
  });

  it("keeps guaranteed-source quest acquisition ahead of a stale model prefetch", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-training-source",
      "agent-training-source",
      "Training Source Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-training-source",
        accountId: "acct-training-source",
        name: "Training Source Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-training-source");
      const bridge = (manager as any).behaviorBridge;
      instance.chatRuntime = { useModel: vi.fn() };
      instance.pendingLlmResult = {
        action: { type: "smelt", recipe: "bronze_bar" },
        reasoning: "This observation predates the guaranteed source target.",
        goal: { type: "smelting", description: "Smelt bronze" },
        plan: ["Smelt bronze"],
        thinking: null,
        planStep: 0,
      };
      const attack = vi
        .spyOn(instance.service, "executeAttack")
        .mockResolvedValue(true);
      const smelt = vi.spyOn(instance.service, "executeSmelt");

      await bridge.applyTickResultWithDrain({
        characterId: "agent-training-source",
        behaviorEpoch: instance.behaviorEpoch,
        action: { type: "attack", targetId: "exact-cow" },
        updatedState: {
          goal: {
            type: "provisioning",
            description: "Acquire guaranteed cowhide for Crafting training",
            questId: "crafting_basics",
            questName: "Crafting Basics",
          },
          questsAccepted: [],
          currentTargetId: "exact-cow",
          lastGatherTargetId: null,
          lastGatherQueuedAt: 0,
          lastCombatChatAt: 0,
        },
      });

      expect(attack).toHaveBeenCalledWith("exact-cow");
      expect(smelt).not.toHaveBeenCalled();
      expect(instance.pendingLlmResult).toBeUndefined();
      expect(instance.goal).toMatchObject({
        type: "provisioning",
        questId: "crafting_basics",
      });
      expect(instance.llmPlan).toBeUndefined();
    } finally {
      await manager.shutdown();
    }
  });

  it("finishes a previously committed withdrawal from authoritative inventory after restart", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-resume", "agent-resume", "Resume Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-resume",
        accountId: "acct-resume",
        name: "Resume Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-resume");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-resume",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: { attack: { level: 10, xp: 0 } },
        inventory: [{ slot: 0, itemId: "test_prep_sword", quantity: 1 }],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "85975a78-8943-4efc-b12e-0d08c414997b",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-resume",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toEqual([
        { slotType: "weapon", itemId: "test_prep_sword", quantity: 1 },
      ]);
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-resume" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("recovers a committed whole-plan receipt after restart without replanning", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-plan-recovery",
      "agent-plan-recovery",
      "Plan Recovery Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-plan-recovery",
        accountId: "acct-plan-recovery",
        name: "Plan Recovery Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-plan-recovery");
      const policyBinding = (manager as any).getCompetitiveAgentPolicyBinding(
        "agent-plan-recovery",
        "duel-preparation-role-v3",
      );
      const planEvidence = {
        primaryStyle: "melee",
        availableStyles: ["melee"],
        planningSource: "deterministic",
        planningPolicyVersion: "duel-preparation-role-v3",
        agentPolicyFingerprint: policyBinding.fingerprint,
        modelProvider: policyBinding.provider,
        model: policyBinding.model,
        tacticalStrategy: {
          approach: "balanced",
          tacticalMacro: "pressure",
          attackStyle: "aggressive",
          prayer: null,
          preferredCombatRole: null,
          foodThreshold: 40,
          switchDefensiveAt: 30,
          reasoning: "Use the deterministic role-aware competitive fallback.",
        },
      } as const;
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({ success: true, bankItems: [] });
      const recover = vi
        .spyOn(instance.service, "executeDuelPreparationPlanRecovery")
        .mockImplementation(async (operationId, preparationId) => ({
          ok: true,
          playerId: "agent-plan-recovery",
          operationId: String(operationId),
          preparationId: String(preparationId),
          requestFingerprint: "persisted-plan-fingerprint",
          changed: false,
          replayed: true,
          committed: {
            bank: [],
            inventory: [],
            equipment: [
              {
                slotType: "weapon",
                itemId: "test_prep_sword",
                quantity: 1,
              },
            ],
            selectedSpell: null,
          },
          recoveryEvidence: planEvidence,
        }));
      const plan = vi.mocked(instance.service.executeDuelPreparationPlan);
      plan.mockClear();

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "41c7c91b-fbfa-46c8-8ee9-f267f3cf86e7",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-plan-recovery",
        agent2Id: "agent-opponent",
      });

      expect(recover).toHaveBeenCalledOnce();
      expect(plan).not.toHaveBeenCalled();
      expect(instance.duelPreparation.status).toBe("planning");
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          agentId: "agent-plan-recovery",
          recoveredCommittedPlan: true,
          atomicPlanReplayed: true,
          planEvidence,
        }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({
          agentId: "agent-plan-recovery",
          planEvidence,
        }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("provisions a complete owned ranged setup and bounded food without creating supplies", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-ranged", "agent-ranged", "Ranged Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-ranged",
        accountId: "acct-ranged",
        name: "Ranged Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-ranged");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-ranged",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 1, xp: 0 },
          strength: { level: 1, xp: 0 },
          ranged: { level: 10, xp: 0 },
          magic: { level: 1, xp: 0 },
        },
        inventory: [],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "shortbow", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "bronze_arrow", quantity: 60, slot: 1, tabIndex: 0 },
          { itemId: "lobster", quantity: 8, slot: 2, tabIndex: 0 },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const autocast = vi.spyOn(instance.service, "executeSetAutocast");
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "3ce02ec1-8635-40f4-ac92-f06667323b31",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-ranged",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(autocast).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      expect(atomicPlan.mock.calls[0][0].committed).toMatchObject({
        inventory: Array.from({ length: 4 }, () =>
          expect.objectContaining({ itemId: "lobster", quantity: 1 }),
        ),
        equipment: [
          { slotType: "arrows", itemId: "bronze_arrow", quantity: 50 },
          { slotType: "weapon", itemId: "shortbow", quantity: 1 },
        ],
        selectedSpell: null,
      });
      expect(instance.duelPreparation.strategy).toEqual({
        primaryStyle: "ranged",
        availableStyles: ["ranged"],
        opponentHistorySampleSize: 0,
        defensiveFocus: null,
        weaponId: "shortbow",
        ammunitionId: "bronze_arrow",
        spellId: null,
        foodItemId: "lobster",
        foodQuantity: 4,
        tacticalStrategy: {
          approach: "balanced",
          tacticalMacro: "orbit",
          attackStyle: "aggressive",
          prayer: null,
          preferredCombatRole: null,
          foodThreshold: 40,
          switchDefensiveAt: 30,
          reasoning: "Use the deterministic role-aware competitive fallback.",
        },
        loadouts: {
          ranged: {
            weaponId: "shortbow",
            ammunitionId: "bronze_arrow",
            spellId: null,
            armorIds: EMPTY_FROZEN_ARMOR_IDS,
          },
        },
      });
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-ranged" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("replaces equipped armor with the strongest legal owned option for the opening role", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-armor", "agent-armor", "Armored Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-armor",
        accountId: "acct-armor",
        name: "Armored Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-armor");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-armor",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 10, xp: 0 },
          strength: { level: 10, xp: 0 },
          defense: { level: 20, xp: 0 },
        },
        inventory: [],
        equipment: {
          weapon: { itemId: "test_prep_sword", quantity: 1 },
          body: { itemId: "test_prep_weak_body", quantity: 1 },
        },
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          {
            itemId: "test_prep_strong_body",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
          {
            itemId: "test_prep_overleveled_body",
            quantity: 1,
            slot: 1,
            tabIndex: 0,
          },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "47c42b2d-9993-4d47-8168-1220642369c2",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-armor",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toContainEqual({
        slotType: "body",
        itemId: "test_prep_strong_body",
        quantity: 1,
      });
      expect(
        atomicPlan.mock.calls[0][0].committed.equipment,
      ).not.toContainEqual(
        expect.objectContaining({ itemId: "test_prep_overleveled_body" }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          agentId: "agent-armor",
          defensiveEquipmentCount: 1,
        }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-armor" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("uses opening-role offense before aggregate defense when selecting owned armor", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-mage-armor", "agent-mage-armor", "Mage Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-mage-armor",
        accountId: "acct-mage-armor",
        name: "Mage Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-mage-armor");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-mage-armor",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: { magic: { level: 1, xp: 0 } },
        inventory: [],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "staff_of_air", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "mind_rune", quantity: 20, slot: 1, tabIndex: 0 },
          {
            itemId: "test_prep_metal_body",
            quantity: 1,
            slot: 2,
            tabIndex: 0,
          },
          {
            itemId: "test_prep_wizard_body",
            quantity: 1,
            slot: 3,
            tabIndex: 0,
          },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      vi.spyOn(instance.service, "executeSetAutocast").mockResolvedValue(true);
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "11fc364f-4dbf-4efb-94ca-67a73cc719fb",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-mage-armor",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toEqual([
        { slotType: "body", itemId: "test_prep_wizard_body", quantity: 1 },
        { slotType: "weapon", itemId: "staff_of_air", quantity: 1 },
      ]);
      expect(atomicPlan.mock.calls[0][0].committed.bank).toContainEqual(
        expect.objectContaining({ itemId: "test_prep_metal_body" }),
      );
      expect(instance.duelPreparation.strategy.primaryStyle).toBe("mage");
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-mage-armor" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("causally changes owned armor selection from verified opponent opening history", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-ranged-focus",
      "agent-ranged-focus",
      "Ranged Focus Agent",
    );
    ctx.registerCharacter(
      "acct-magic-focus",
      "agent-magic-focus",
      "Magic Focus Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      for (const [characterId, accountId, name] of [
        ["agent-ranged-focus", "acct-ranged-focus", "Ranged Focus Agent"],
        ["agent-magic-focus", "acct-magic-focus", "Magic Focus Agent"],
      ] as const) {
        await manager.createAgent({
          characterId,
          accountId,
          name,
          scriptedRole: "combat",
          autoStart: true,
        });
        const instance = (manager as any).agents.get(characterId);
        vi.spyOn(instance.service, "getGameState").mockReturnValue({
          playerId: characterId,
          position: [0, 9, 0],
          health: 20,
          maxHealth: 20,
          alive: true,
          skills: {
            attack: { level: 10, xp: 0 },
            strength: { level: 10, xp: 0 },
          },
          inventory: [],
          equipment: {
            weapon: { itemId: "test_prep_sword", quantity: 1 },
          },
          nearbyEntities: [],
          inCombat: false,
          currentTarget: null,
          activePrayers: [],
        });
        vi.spyOn(
          instance.service,
          "executeDuelPreparationBankOpen",
        ).mockResolvedValue({
          success: true,
          bankItems: [
            {
              itemId: "test_prep_ranged_defense_body",
              quantity: 1,
              slot: 0,
              tabIndex: 0,
            },
            {
              itemId: "test_prep_magic_defense_body",
              quantity: 1,
              slot: 1,
              tabIndex: 0,
            },
          ],
        });
      }

      const selectedAt = Date.now();
      const historyFor = (opponentOpeningStyle: "ranged" | "mage") => [
        {
          cycleId: `prior-${opponentOpeningStyle}`,
          finishedAt: selectedAt - 1_000,
          result: "loss",
          ownOpeningStyle: "melee",
          opponentOpeningStyle,
          ownDamage: 8,
          opponentDamage: 20,
          winReason: "kill",
        },
      ];
      await (manager as any).handleDuelPreparationSelected({
        preparationId: "70c869b9-edc7-4655-971e-0f5d8bf1ea53",
        selectedAt,
        expiresAt: selectedAt + 60_000,
        agent1Id: "agent-ranged-focus",
        agent2Id: "opponent-ranged-focus",
        agent1OpponentHistory: historyFor("ranged"),
      });
      await (manager as any).handleDuelPreparationSelected({
        preparationId: "350fe2ad-b4bc-43ad-a064-1156418f96a6",
        selectedAt,
        expiresAt: selectedAt + 60_000,
        agent1Id: "agent-magic-focus",
        agent2Id: "opponent-magic-focus",
        agent1OpponentHistory: historyFor("mage"),
      });

      const rangedInstance = (manager as any).agents.get("agent-ranged-focus");
      const magicInstance = (manager as any).agents.get("agent-magic-focus");
      const planCalls = vi.mocked(
        rangedInstance.service.executeDuelPreparationPlan,
      ).mock.calls;
      const rangedPlan = planCalls.find(
        (call: any[]) =>
          call[0].preparationId === "70c869b9-edc7-4655-971e-0f5d8bf1ea53",
      )?.[0];
      const magicPlan = planCalls.find(
        (call: any[]) =>
          call[0].preparationId === "350fe2ad-b4bc-43ad-a064-1156418f96a6",
      )?.[0];
      expect(rangedPlan?.committed.equipment).toContainEqual({
        slotType: "body",
        itemId: "test_prep_ranged_defense_body",
        quantity: 1,
      });
      expect(magicPlan?.committed.equipment).toContainEqual({
        slotType: "body",
        itemId: "test_prep_magic_defense_body",
        quantity: 1,
      });
      expect(rangedInstance.duelPreparation.strategy).toMatchObject({
        defensiveFocus: "ranged",
        opponentHistorySampleSize: 1,
      });
      expect(magicInstance.duelPreparation.strategy).toMatchObject({
        defensiveFocus: "mage",
        opponentHistorySampleSize: 1,
      });
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          agentId: "agent-ranged-focus",
          defensiveFocus: "ranged",
          opponentHistorySampleSize: 1,
        }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("authoritatively removes role-penalizing worn armor when no useful replacement exists", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-mage-empty",
      "agent-mage-empty",
      "Unarmored Mage",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-mage-empty",
        accountId: "acct-mage-empty",
        name: "Unarmored Mage",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-mage-empty");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-mage-empty",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: { magic: { level: 1, xp: 0 } },
        inventory: [{ slot: 0, itemId: "mind_rune", quantity: 20 }],
        equipment: {
          weapon: { itemId: "staff_of_air", quantity: 1 },
          body: { itemId: "test_prep_metal_body", quantity: 1 },
        },
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({ success: true, bankItems: [] });
      const equip = vi.spyOn(instance.service, "executeEquip");
      const unequip = vi
        .spyOn(instance.service, "executeUnequipOwned")
        .mockResolvedValue({
          ok: true,
          playerId: "agent-mage-empty",
          itemId: "test_prep_metal_body",
          slot: "body",
          changed: true,
        });
      vi.spyOn(instance.service, "executeSetAutocast").mockResolvedValue(true);
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "d5658048-c818-4fcf-84d2-b24935380cae",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-mage-empty",
        agent2Id: "agent-opponent",
      });

      expect(equip).not.toHaveBeenCalled();
      expect(unequip).not.toHaveBeenCalled();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toEqual([
        { slotType: "weapon", itemId: "staff_of_air", quantity: 1 },
      ]);
      expect(atomicPlan.mock.calls[0][0].committed.bank).toContainEqual(
        expect.objectContaining({ itemId: "test_prep_metal_body" }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          defensiveEquipmentCount: 0,
          defensiveUnequipCount: 1,
        }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-mage-empty" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("never provisions or equips a shield for a two-handed opening weapon", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-2h", "agent-2h", "Two Handed Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-2h",
        accountId: "acct-2h",
        name: "Two Handed Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-2h");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-2h",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: { ranged: { level: 10, xp: 0 } },
        inventory: [],
        equipment: {
          shield: { itemId: "test_prep_shield", quantity: 1 },
        },
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "shortbow", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "bronze_arrow", quantity: 50, slot: 1, tabIndex: 0 },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "943694b1-aa19-4ff7-8f46-bb13289734f9",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-2h",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toEqual([
        { slotType: "arrows", itemId: "bronze_arrow", quantity: 50 },
        { slotType: "weapon", itemId: "shortbow", quantity: 1 },
      ]);
      expect(atomicPlan.mock.calls[0][0].committed.bank).toContainEqual(
        expect.objectContaining({ itemId: "test_prep_shield" }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({ defensiveEquipmentCount: 0 }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-2h" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("does not report readiness when authoritative defensive equipment equip fails", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-armor-fail",
      "agent-armor-fail",
      "Armor Failure",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-armor-fail",
        accountId: "acct-armor-fail",
        name: "Armor Failure",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-armor-fail");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-armor-fail",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 10, xp: 0 },
          strength: { level: 10, xp: 0 },
          defense: { level: 20, xp: 0 },
        },
        inventory: [],
        equipment: {
          weapon: { itemId: "test_prep_sword", quantity: 1 },
        },
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          {
            itemId: "test_prep_strong_body",
            quantity: 1,
            slot: 0,
            tabIndex: 0,
          },
        ],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationPlan",
      ).mockResolvedValue({
        ok: false,
        playerId: "agent-armor-fail",
        operationId: "65c62158-c8fa-48ef-b2d0-558590c568d1",
        preparationId: "65c62158-c8fa-48ef-b2d0-558590c568d1",
        changed: false,
        replayed: false,
        reason: "committed_state_apply_failed",
      });

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "65c62158-c8fa-48ef-b2d0-558590c568d1",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-armor-fail",
        agent2Id: "agent-opponent",
      });

      expect(instance.duelPreparation.status).toBe("failed");
      expect(instance.duelPreparation.failureReason).toBe(
        "committed_state_apply_failed",
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          agentId: "agent-armor-fail",
          status: "failed",
          failureReason: "committed_state_apply_failed",
        }),
      );
      expect(ctx.world.emit).not.toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.anything(),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("atomically banks displaced armor without a transient inventory overflow", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-capacity", "agent-capacity", "Capacity Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    const slots = [
      "shield",
      "helmet",
      "body",
      "legs",
      "boots",
      "gloves",
      "cape",
      "amulet",
      "ring",
    ] as const;
    const temporaryItemIds = ["test_prep_weak_sword", "test_prep_old_arrow"];
    try {
      ITEMS.set("test_prep_weak_sword", {
        id: "test_prep_weak_sword",
        name: "Weak Sword",
        type: "weapon",
        equipSlot: "weapon",
        attackType: "MELEE",
        stackable: false,
        bonuses: {},
      } as never);
      ITEMS.set("test_prep_old_arrow", {
        id: "test_prep_old_arrow",
        name: "Old Arrow",
        type: "ammunition",
        equipSlot: "arrows",
        stackable: true,
      } as never);
      for (const slot of slots) {
        const weakId = `test_prep_weak_${slot}`;
        const strongId = `test_prep_strong_${slot}`;
        temporaryItemIds.push(weakId, strongId);
        ITEMS.set(weakId, {
          id: weakId,
          name: `Weak ${slot}`,
          type: "armor",
          equipSlot: slot,
          stackable: false,
          bonuses: { defenseStab: 1 },
        } as never);
        ITEMS.set(strongId, {
          id: strongId,
          name: `Strong ${slot}`,
          type: "armor",
          equipSlot: slot,
          stackable: false,
          bonuses: { defenseStab: 10 },
        } as never);
      }

      await manager.createAgent({
        characterId: "agent-capacity",
        accountId: "acct-capacity",
        name: "Capacity Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-capacity");
      const equipment = Object.fromEntries([
        ["weapon", { itemId: "test_prep_weak_sword", quantity: 1 }],
        ["arrows", { itemId: "test_prep_old_arrow", quantity: 30 }],
        ...slots.map((slot) => [
          slot,
          { itemId: `test_prep_weak_${slot}`, quantity: 1 },
        ]),
      ]);
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-capacity",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 10, xp: 0 },
          strength: { level: 10, xp: 0 },
          defense: { level: 10, xp: 0 },
          ranged: { level: 1, xp: 0 },
          magic: { level: 5, xp: 0 },
        },
        inventory: [],
        equipment,
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "test_prep_sword", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "shortbow", quantity: 1, slot: 1, tabIndex: 0 },
          { itemId: "bronze_arrow", quantity: 50, slot: 2, tabIndex: 0 },
          { itemId: "staff_of_air", quantity: 1, slot: 3, tabIndex: 0 },
          { itemId: "mind_rune", quantity: 20, slot: 4, tabIndex: 0 },
          { itemId: "water_rune", quantity: 20, slot: 5, tabIndex: 0 },
          { itemId: "lobster", quantity: 4, slot: 6, tabIndex: 0 },
          ...slots.map((slot, index) => ({
            itemId: `test_prep_strong_${slot}`,
            quantity: 1,
            slot: index + 7,
            tabIndex: 0,
          })),
        ],
      });
      const deposit = vi.spyOn(instance.service, "executeBankDeposit");
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "1ea25621-5643-40c2-a9bd-668b9bfc17d2",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-capacity",
        agent2Id: "agent-opponent",
      });

      expect(instance.duelPreparation.status).toBe("planning");
      expect(instance.duelPreparation.failureReason).toBeNull();
      expect(deposit).not.toHaveBeenCalled();
      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      const committed = atomicPlan.mock.calls[0][0].committed;
      for (const slot of slots) {
        expect(committed.equipment).toContainEqual({
          slotType: slot,
          itemId: `test_prep_strong_${slot}`,
          quantity: 1,
        });
        expect(committed.bank).toContainEqual(
          expect.objectContaining({ itemId: `test_prep_weak_${slot}` }),
        );
      }
      expect(committed.inventory.length).toBeLessThanOrEqual(28);
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-capacity" }),
      );
    } finally {
      for (const itemId of temporaryItemIds) ITEMS.delete(itemId);
      await manager.shutdown();
    }
  });

  it("counts an equipped ammunition stack exactly and merges only the bounded top-up", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-ranged-stack",
      "agent-ranged-stack",
      "Stack Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-ranged-stack",
        accountId: "acct-ranged-stack",
        name: "Stack Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-ranged-stack");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-ranged-stack",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 1, xp: 0 },
          strength: { level: 1, xp: 0 },
          ranged: { level: 10, xp: 0 },
          magic: { level: 1, xp: 0 },
        },
        inventory: [],
        equipment: {
          weapon: { itemId: "shortbow", quantity: 1 },
          arrows: { itemId: "bronze_arrow", quantity: 30 },
        },
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "bronze_arrow", quantity: 100, slot: 0, tabIndex: 0 },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      vi.spyOn(instance.service, "executeSetAutocast").mockResolvedValue(true);
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "d5ca0a7a-1e63-4d53-ae63-601d89f3a5a1",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-ranged-stack",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toContainEqual({
        slotType: "arrows",
        itemId: "bronze_arrow",
        quantity: 50,
      });
      expect(atomicPlan.mock.calls[0][0].committed.bank).toContainEqual(
        expect.objectContaining({ itemId: "bronze_arrow", quantity: 80 }),
      );
      expect(instance.duelPreparation.strategy).toMatchObject({
        primaryStyle: "ranged",
        ammunitionId: "bronze_arrow",
      });
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-ranged-stack" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("clears a full ordinary inventory before withdrawing the exact duel loadout", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-full-prep", "agent-full-prep", "Full Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-full-prep",
        accountId: "acct-full-prep",
        name: "Full Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-full-prep");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-full-prep",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 1, xp: 0 },
          strength: { level: 1, xp: 0 },
          ranged: { level: 10, xp: 0 },
          magic: { level: 1, xp: 0 },
        },
        inventory: Array.from({ length: 28 }, (_, slot) => ({
          slot,
          itemId: "test_prep_junk",
          quantity: 1,
        })),
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "shortbow", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "bronze_arrow", quantity: 60, slot: 1, tabIndex: 0 },
          { itemId: "lobster", quantity: 8, slot: 2, tabIndex: 0 },
        ],
      });
      const deposit = vi
        .spyOn(instance.service, "executeBankDeposit")
        .mockResolvedValue({ success: true, commitState: "committed" });
      const withdraw = vi
        .spyOn(instance.service, "executeBankWithdraw")
        .mockResolvedValue({ success: true, commitState: "committed" });
      vi.spyOn(instance.service, "executeEquip").mockResolvedValue({
        ok: true,
        playerId: "agent-full-prep",
        itemId: "shortbow",
        slot: "weapon",
        changed: true,
      });
      vi.spyOn(instance.service, "executeSetAutocast").mockResolvedValue(true);
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "8d0d86df-b5a5-41ab-bfb9-4980de8b6096",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-full-prep",
        agent2Id: "agent-opponent",
      });

      expect(deposit).not.toHaveBeenCalled();
      expect(withdraw).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      expect(atomicPlan.mock.calls[0][0].committed.bank).toContainEqual(
        expect.objectContaining({ itemId: "test_prep_junk", quantity: 28 }),
      );
      expect(atomicPlan.mock.calls[0][0].committed.inventory).toHaveLength(4);
      expect(
        atomicPlan.mock.calls[0][0].committed.inventory.every(
          (row: { itemId: string; quantity: number }) =>
            row.itemId === "lobster" && row.quantity === 1,
        ),
      ).toBe(true);
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toEqual([
        { slotType: "arrows", itemId: "bronze_arrow", quantity: 50 },
        { slotType: "weapon", itemId: "shortbow", quantity: 1 },
      ]);
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-full-prep" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("fails preparation before any withdrawal or equip when inventory reconciliation fails", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-reconcile-fail",
      "agent-reconcile-fail",
      "Safe Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-reconcile-fail",
        accountId: "acct-reconcile-fail",
        name: "Safe Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-reconcile-fail");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-reconcile-fail",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 10, xp: 0 },
          strength: { level: 10, xp: 0 },
          ranged: { level: 1, xp: 0 },
          magic: { level: 1, xp: 0 },
        },
        inventory: [{ slot: 0, itemId: "test_prep_junk", quantity: 1 }],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "test_prep_sword", quantity: 1, slot: 0, tabIndex: 0 },
        ],
      });
      const deposit = vi
        .spyOn(instance.service, "executeBankDeposit")
        .mockResolvedValue({ success: true, commitState: "committed" });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const atomicPlan = vi
        .spyOn(instance.service, "executeDuelPreparationPlan")
        .mockImplementation(async (request: any) => ({
          ok: false,
          playerId: "agent-reconcile-fail",
          operationId: request.operationId,
          preparationId: request.preparationId,
          changed: false,
          replayed: false,
          reason: "persistence_failed",
        }));

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "6768d591-f62a-4f86-96b8-a0c5ae56ecce",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-reconcile-fail",
        agent2Id: "agent-opponent",
      });

      expect(deposit).not.toHaveBeenCalled();
      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      expect(instance.duelPreparation).toMatchObject({
        status: "failed",
        failureReason: "persistence_failed",
      });
      expect(ctx.world.emit).not.toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.anything(),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("provisions only owned runes for the strongest castable magic setup", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-mage", "agent-mage", "Magic Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-mage",
        accountId: "acct-mage",
        name: "Magic Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-mage");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-mage",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 1, xp: 0 },
          strength: { level: 1, xp: 0 },
          ranged: { level: 1, xp: 0 },
          magic: { level: 13, xp: 0 },
        },
        inventory: [],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "staff_of_air", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "fire_rune", quantity: 60, slot: 1, tabIndex: 0 },
          { itemId: "mind_rune", quantity: 20, slot: 2, tabIndex: 0 },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const autocast = vi
        .spyOn(instance.service, "executeSetAutocast")
        .mockResolvedValue(true);
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "296308e6-bf81-4a8d-988b-3bcd02158f14",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-mage",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(autocast).not.toHaveBeenCalled();
      expect(atomicPlan.mock.calls[0][0].committed).toMatchObject({
        equipment: [
          { slotType: "weapon", itemId: "staff_of_air", quantity: 1 },
        ],
        selectedSpell: "fire_strike",
      });
      expect(atomicPlan.mock.calls[0][0].committed.inventory).toEqual([
        expect.objectContaining({ itemId: "fire_rune", quantity: 60 }),
        expect.objectContaining({ itemId: "mind_rune", quantity: 20 }),
      ]);
      expect(instance.duelPreparation.strategy).toMatchObject({
        primaryStyle: "mage",
        weaponId: "staff_of_air",
        spellId: "fire_strike",
      });
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-mage" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("provisions complete owned alternatives while equipping only the primary strategy", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-multistyle",
      "agent-multistyle",
      "Adaptive Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-multistyle",
        accountId: "acct-multistyle",
        name: "Adaptive Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-multistyle");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-multistyle",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 20, xp: 0 },
          strength: { level: 20, xp: 0 },
          ranged: { level: 15, xp: 0 },
          magic: { level: 13, xp: 0 },
        },
        inventory: [],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "test_prep_sword", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "shortbow", quantity: 1, slot: 1, tabIndex: 0 },
          { itemId: "bronze_arrow", quantity: 60, slot: 2, tabIndex: 0 },
          { itemId: "staff_of_air", quantity: 1, slot: 3, tabIndex: 0 },
          { itemId: "fire_rune", quantity: 60, slot: 4, tabIndex: 0 },
          { itemId: "mind_rune", quantity: 20, slot: 5, tabIndex: 0 },
          { itemId: "lobster", quantity: 8, slot: 6, tabIndex: 0 },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const autocast = vi
        .spyOn(instance.service, "executeSetAutocast")
        .mockResolvedValue(true);
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "9712c3e3-7908-43cb-a50e-1099d0c33eb1",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-multistyle",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(autocast).not.toHaveBeenCalled();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toEqual([
        { slotType: "weapon", itemId: "test_prep_sword", quantity: 1 },
      ]);
      expect(
        atomicPlan.mock.calls[0][0].committed.inventory.map(
          (row: { itemId: string; quantity: number }) => [
            row.itemId,
            row.quantity,
          ],
        ),
      ).toEqual([
        ["bronze_arrow", 50],
        ["fire_rune", 60],
        ["lobster", 1],
        ["lobster", 1],
        ["lobster", 1],
        ["lobster", 1],
        ["mind_rune", 20],
        ["shortbow", 1],
        ["staff_of_air", 1],
      ]);
      expect(instance.duelPreparation.strategy).toEqual({
        primaryStyle: "melee",
        availableStyles: ["melee", "ranged", "mage"],
        opponentHistorySampleSize: 0,
        defensiveFocus: null,
        weaponId: "test_prep_sword",
        ammunitionId: null,
        spellId: null,
        foodItemId: "lobster",
        foodQuantity: 4,
        tacticalStrategy: {
          approach: "balanced",
          tacticalMacro: "pressure",
          attackStyle: "aggressive",
          prayer: null,
          preferredCombatRole: null,
          foodThreshold: 40,
          switchDefensiveAt: 30,
          reasoning: "Use the deterministic role-aware competitive fallback.",
        },
        loadouts: {
          melee: {
            weaponId: "test_prep_sword",
            ammunitionId: null,
            spellId: null,
            armorIds: EMPTY_FROZEN_ARMOR_IDS,
          },
          ranged: {
            weaponId: "shortbow",
            ammunitionId: "bronze_arrow",
            spellId: null,
            armorIds: EMPTY_FROZEN_ARMOR_IDS,
          },
          mage: {
            weaponId: "staff_of_air",
            ammunitionId: null,
            spellId: "fire_strike",
            armorIds: EMPTY_FROZEN_ARMOR_IDS,
          },
        },
      });
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.objectContaining({ agentId: "agent-multistyle" }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("lets a validated ElizaOS preference choose the opening role while preserving every legal alternative, including a displaced equipped weapon", async () => {
    vi.stubEnv("EMBEDDED_AGENT_DUEL_PREPARATION_LLM", "true");
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-model-prep",
      "agent-model-prep",
      "Adaptive Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-model-prep",
        accountId: "acct-model-prep",
        name: "Adaptive Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-model-prep");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-model-prep",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 20, xp: 0 },
          strength: { level: 20, xp: 0 },
          ranged: { level: 10, xp: 0 },
          magic: { level: 1, xp: 0 },
          prayer: { level: 26, xp: 0 },
        },
        inventory: [],
        equipment: {
          weapon: { itemId: "test_prep_sword", quantity: 1 },
        },
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
        prayerPointUnits: 26_000_000,
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "shortbow", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "bronze_arrow", quantity: 60, slot: 1, tabIndex: 0 },
          { itemId: "test_prep_shield", quantity: 1, slot: 2, tabIndex: 0 },
          {
            itemId: "test_prep_ranged_body",
            quantity: 1,
            slot: 3,
            tabIndex: 0,
          },
          {
            itemId: "test_prep_melee_body",
            quantity: 1,
            slot: 4,
            tabIndex: 0,
          },
        ],
      });
      const useModel = vi.fn(async (..._args: unknown[]) =>
        Promise.resolve(
          JSON.stringify({
            primaryStyle: "ranged",
            reason: "Open with mobility against this opponent.",
            tacticalStrategy: {
              approach: "balanced",
              tacticalMacro: "kite",
              attackStyle: "accurate",
              prayer: "hawk_eye",
              preferredCombatRole: null,
              foodThreshold: 35,
              switchDefensiveAt: 25,
              reasoning: "Use frozen spacing macros and adapt visible roles.",
            },
          }),
        ),
      );
      instance.chatRuntime = { useModel, stop: vi.fn(async () => undefined) };
      instance.chatRuntimeInfo = {
        provider: "openai",
        model: "test/model",
        source: "test",
      };
      instance.chatRuntimeConfigSig = "test-runtime-config";
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      vi.spyOn(instance.service, "executeSetAutocast").mockResolvedValue(true);
      const atomicPlan = vi.mocked(instance.service.executeDuelPreparationPlan);

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "fcbdc73f-834a-4622-a707-952881ae853a",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-model-prep",
        agent1Name: "Adaptive Agent",
        agent2Id: "agent-opponent",
        agent2Name: "Pressure Agent",
      });

      expect(useModel).toHaveBeenCalledOnce();
      const modelOptions = useModel.mock.calls[0]?.[1] as
        { prompt?: unknown } | undefined;
      const prompt = String(modelOptions?.prompt);
      expect(prompt).toContain("Pressure Agent");
      expect(prompt).toContain('["melee","ranged"]');
      expect(prompt).not.toContain("test_prep_sword");
      expect(prompt).not.toContain("shortbow");
      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(atomicPlan.mock.calls[0][0].committed.equipment).toEqual([
        { slotType: "arrows", itemId: "bronze_arrow", quantity: 50 },
        { slotType: "body", itemId: "test_prep_ranged_body", quantity: 1 },
        { slotType: "weapon", itemId: "shortbow", quantity: 1 },
      ]);
      expect(atomicPlan.mock.calls[0][0].committed.inventory).toHaveLength(3);
      expect(atomicPlan.mock.calls[0][0].committed.inventory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemId: "test_prep_melee_body",
            quantity: 1,
          }),
          expect.objectContaining({ itemId: "test_prep_shield", quantity: 1 }),
          expect.objectContaining({ itemId: "test_prep_sword", quantity: 1 }),
        ]),
      );
      expect(instance.duelPreparation.strategy).toMatchObject({
        primaryStyle: "ranged",
        availableStyles: ["ranged", "melee"],
        weaponId: "shortbow",
        ammunitionId: "bronze_arrow",
        loadouts: {
          ranged: {
            weaponId: "shortbow",
            armorIds: expect.objectContaining({
              body: "test_prep_ranged_body",
            }),
          },
          melee: {
            weaponId: "test_prep_sword",
            armorIds: expect.objectContaining({
              body: "test_prep_melee_body",
            }),
          },
        },
        tacticalStrategy: {
          tacticalMacro: "kite",
          preferredCombatRole: null,
          foodThreshold: 35,
        },
      });
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          agentId: "agent-model-prep",
          primaryStyle: "ranged",
          planningSource: "model",
          planningPolicyVersion: "duel-preparation-role-v3",
          tacticalMacro: "kite",
        }),
      );
      const readyPayload = ctx.world.emit.mock.calls.find(
        ([event]) => event === "duel:preparation:ready",
      )?.[1] as
        | {
            planEvidence?: {
              agentPolicyFingerprint?: string;
              modelProvider?: string;
              model?: string;
            };
          }
        | undefined;
      const frozenBinding = manager.getCompetitiveAgentPolicyBinding(
        "agent-model-prep",
        "duel-preparation-role-v3",
      );
      expect(readyPayload?.planEvidence).toMatchObject({
        agentPolicyFingerprint: frozenBinding?.fingerprint,
        modelProvider: frozenBinding?.provider,
        model: frozenBinding?.model,
      });
      instance.chatRuntimeInfo = {
        ...instance.chatRuntimeInfo,
        model: "test/changed-model",
      };
      expect(
        manager.getCompetitiveAgentPolicyBinding(
          "agent-model-prep",
          "duel-preparation-role-v3",
        )?.fingerprint,
      ).not.toBe(frozenBinding?.fingerprint);
    } finally {
      await manager.shutdown();
    }
  });

  it("never changes competitive equipment when the complete bank plan does not commit", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-bank-failure",
      "agent-bank-failure",
      "Safe Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-bank-failure",
        accountId: "acct-bank-failure",
        name: "Safe Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-bank-failure");
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: "agent-bank-failure",
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: {
          attack: { level: 20, xp: 0 },
          strength: { level: 20, xp: 0 },
          ranged: { level: 15, xp: 0 },
          magic: { level: 1, xp: 0 },
        },
        inventory: [],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [
          { itemId: "test_prep_sword", quantity: 1, slot: 0, tabIndex: 0 },
          { itemId: "shortbow", quantity: 1, slot: 1, tabIndex: 0 },
          { itemId: "bronze_arrow", quantity: 50, slot: 2, tabIndex: 0 },
        ],
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const autocast = vi.spyOn(instance.service, "executeSetAutocast");
      const atomicPlan = vi
        .spyOn(instance.service, "executeDuelPreparationPlan")
        .mockImplementation(async (request: any) => ({
          ok: false,
          playerId: "agent-bank-failure",
          operationId: request.operationId,
          preparationId: request.preparationId,
          changed: false,
          replayed: false,
          reason: "persistence_failed",
        }));

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "6425b0d0-5c32-4313-8728-dd2e38a92ed3",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-bank-failure",
        agent2Id: "agent-opponent",
      });

      expect(withdraw).not.toHaveBeenCalled();
      expect(atomicPlan).toHaveBeenCalledOnce();
      expect(instance.duelPreparation).toMatchObject({
        status: "failed",
        failureReason: "persistence_failed",
      });
      expect(equip).not.toHaveBeenCalled();
      expect(autocast).not.toHaveBeenCalled();
      expect(ctx.world.emit).not.toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.anything(),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it.each([
    {
      label: "a ranged weapon without compatible ammunition",
      accountId: "acct-incomplete-ranged",
      characterId: "agent-incomplete-ranged",
      preparationId: "338017b9-f772-4f9e-a575-f71b99a9d843",
      skills: {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        ranged: { level: 10, xp: 0 },
        magic: { level: 1, xp: 0 },
      },
      bankItems: [{ itemId: "shortbow", quantity: 1, slot: 0, tabIndex: 0 }],
    },
    {
      label: "a magic weapon without the required runes",
      accountId: "acct-incomplete-magic",
      characterId: "agent-incomplete-magic",
      preparationId: "4a20b3e2-f340-4526-92da-63165dbb0e3f",
      skills: {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 13, xp: 0 },
      },
      bankItems: [
        { itemId: "staff_of_air", quantity: 1, slot: 0, tabIndex: 0 },
        { itemId: "fire_rune", quantity: 60, slot: 1, tabIndex: 0 },
      ],
    },
  ])("fails closed for $label", async (fixture) => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      fixture.accountId,
      fixture.characterId,
      "Incomplete Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: fixture.characterId,
        accountId: fixture.accountId,
        name: "Incomplete Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get(fixture.characterId);
      vi.spyOn(instance.service, "getGameState").mockReturnValue({
        playerId: fixture.characterId,
        position: [0, 9, 0],
        health: 20,
        maxHealth: 20,
        alive: true,
        skills: fixture.skills,
        inventory: [],
        equipment: {},
        nearbyEntities: [],
        inCombat: false,
        currentTarget: null,
        activePrayers: [],
      });
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: fixture.bankItems,
      });
      const withdraw = vi.spyOn(instance.service, "executeBankWithdraw");
      const equip = vi.spyOn(instance.service, "executeEquip");
      const autocast = vi.spyOn(instance.service, "executeSetAutocast");

      await (manager as any).handleDuelPreparationSelected({
        preparationId: fixture.preparationId,
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: fixture.characterId,
        agent2Id: "agent-opponent",
      });

      expect(instance.duelPreparation).toMatchObject({
        status: "failed",
        failureReason: "no_complete_owned_combat_setup",
      });
      expect(withdraw).not.toHaveBeenCalled();
      expect(equip).not.toHaveBeenCalled();
      expect(autocast).not.toHaveBeenCalled();
      expect(ctx.world.emit).not.toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.anything(),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("fails closed when the selected agent owns no legal preparation weapon", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-unarmed", "agent-unarmed", "Unarmed Agent");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-unarmed",
        accountId: "acct-unarmed",
        name: "Unarmed Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-unarmed");
      vi.spyOn(
        instance.service,
        "executeDuelPreparationBankOpen",
      ).mockResolvedValue({
        success: true,
        bankItems: [],
      });
      const revoke = vi.spyOn(
        instance.service,
        "revokeDuelPreparationBankAccess",
      );

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "6ecb99d2-3a66-461e-a74a-3fd90e0d7551",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-unarmed",
        agent2Id: "agent-opponent",
      });

      expect(instance.duelPreparation).toMatchObject({
        status: "failed",
        failureReason: "no_owned_legal_weapon",
      });
      expect(revoke).toHaveBeenCalledWith(
        "6ecb99d2-3a66-461e-a74a-3fd90e0d7551",
      );
      expect(ctx.world.emit).not.toHaveBeenCalledWith(
        "duel:preparation:ready",
        expect.anything(),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          status: "failed",
          failureReason: "no_owned_legal_weapon",
        }),
      );
      expect(ctx.world.emit).toHaveBeenCalledWith(
        "duel:preparation:agent_plan_status",
        expect.objectContaining({
          agentId: "agent-opponent",
          status: "failed",
          failureReason: "agent_unavailable",
        }),
      );
    } finally {
      await manager.shutdown();
    }
  });

  it("releases both local agents when their shared preparation is cancelled", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter("acct-alpha", "agent-alpha", "Alpha");
    ctx.registerCharacter("acct-beta", "agent-beta", "Beta");
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });

    try {
      await manager.createAgent({
        characterId: "agent-alpha",
        accountId: "acct-alpha",
        name: "Alpha",
        autoStart: true,
      });
      await manager.createAgent({
        characterId: "agent-beta",
        accountId: "acct-beta",
        name: "Beta",
        autoStart: true,
      });
      const preparationId = "2ffca39d-3041-45fc-a2cc-239c7a12368f";
      const instances = (manager as any).agents as Map<string, any>;
      const alpha = instances.get("agent-alpha");
      const beta = instances.get("agent-beta");
      const alphaRevoke = vi.spyOn(
        alpha.service,
        "revokeDuelPreparationBankAccess",
      );
      const betaRevoke = vi.spyOn(
        beta.service,
        "revokeDuelPreparationBankAccess",
      );
      for (const instance of [alpha, beta]) {
        instance.duelPreparation = {
          preparationId,
          status: "planning",
        };
        instance.goal = { type: "banking", description: "prepare" };
      }

      (manager as any).duelPreparationTerminalListener({ preparationId });

      expect(alpha.duelPreparation).toBeUndefined();
      expect(beta.duelPreparation).toBeUndefined();
      expect(alpha.goal).toBeNull();
      expect(beta.goal).toBeNull();
      expect(alphaRevoke).toHaveBeenCalledWith(preparationId);
      expect(betaRevoke).toHaveBeenCalledWith(preparationId);
    } finally {
      await manager.shutdown();
    }
  });

  it("recovers persisted readiness without reopening the agent bank", async () => {
    const ctx = createMockWorld(9);
    ctx.registerCharacter(
      "acct-recovered",
      "agent-recovered",
      "Recovered Agent",
    );
    const manager = new AgentManager(ctx.world as never, {
      startBehaviorBridge: false,
    });
    try {
      await manager.createAgent({
        characterId: "agent-recovered",
        accountId: "acct-recovered",
        name: "Recovered Agent",
        scriptedRole: "combat",
        autoStart: true,
      });
      const instance = (manager as any).agents.get("agent-recovered");
      const open = vi.spyOn(instance.service, "executeDuelPreparationBankOpen");
      const revoke = vi.spyOn(
        instance.service,
        "revokeDuelPreparationBankAccess",
      );

      await (manager as any).handleDuelPreparationSelected({
        preparationId: "8619852c-221f-433e-837c-8c50f22f0d70",
        selectedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        agent1Id: "agent-recovered",
        agent1Ready: true,
        agent2Id: "agent-opponent",
        agent2Ready: false,
      });

      expect(instance.duelPreparation).toMatchObject({
        status: "ready",
        bankItems: [],
      });
      expect(open).not.toHaveBeenCalled();
      expect(revoke).toHaveBeenCalledWith(
        "8619852c-221f-433e-837c-8c50f22f0d70",
      );
    } finally {
      await manager.shutdown();
    }
  });
});
