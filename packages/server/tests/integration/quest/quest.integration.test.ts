/**
 * Quest System Integration Tests
 *
 * Comprehensive test coverage for QuestSystem including:
 * - Quest start flow (request → accept → in_progress)
 * - Kill tracking and progress updates
 * - Quest completion with rewards
 * - Validation and error handling
 * - Event emission verification
 * - Database integration
 *
 * Tests use real QuestSystem with minimal world mock.
 *
 * @technical-debt
 * These tests use MockWorld and MockQuestRepository which violates the project's
 * "NO MOCKS" policy. This should be refactored to use real Hyperia instances
 * with Playwright for true integration testing. The current implementation tests
 * the QuestSystem logic correctly but doesn't validate real database operations
 * or network message handling. See: .cursor/rules/testing.mdc
 *
 * Priority: Medium | Effort: High
 * Tracking: https://github.com/PlayHyperia/hyperia/issues/702
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QuestSystem } from "@hyperforge/shared";
import { EventType } from "@hyperforge/shared";
import type {
  QuestDefinition,
  QuestStatus,
} from "@hyperforge/shared/types/game/quest-types";

// Mock world interface - minimal mock to test real QuestSystem logic
interface MockWorld {
  isServer: boolean;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, data: unknown) => void;
  getSystem: (name: string) => unknown;
  $eventBus?: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    emit: (event: string, data: unknown) => void;
    off: (event: string, handler: (...args: unknown[]) => void) => void;
    emitEvent?: (type: string, data: unknown) => void;
  };
  // For quest requirement checking
  getSkillLevel?: (playerId: string, skillName: string) => number;
  hasItem?: (playerId: string, itemId: string, quantity: number) => boolean;
}

// Mock quest definitions for testing
const mockQuestDefinitions: Record<string, QuestDefinition> = {
  goblin_slayer: {
    id: "goblin_slayer",
    name: "Goblin Slayer",
    description: "Kill 15 goblins to prove your worth.",
    difficulty: "novice",
    questPoints: 1,
    replayable: false,
    requirements: {
      quests: [],
      skills: {},
      items: [],
    },
    startNpc: "cook",
    stages: [
      {
        id: "talk_to_cook",
        type: "dialogue",
        description: "Talk to the Cook to start the quest.",
      },
      {
        id: "kill_goblins",
        type: "kill",
        description: "Kill 15 goblins.",
        target: "goblin",
        count: 15,
      },
      {
        id: "return_to_cook",
        type: "dialogue",
        description: "Return to the Cook.",
      },
    ],
    onStart: {
      items: [{ itemId: "bronze_shortsword", quantity: 1 }],
    },
    rewards: {
      questPoints: 1,
      items: [{ itemId: "xp_lamp_100", quantity: 1 }],
      xp: { attack: 500, strength: 500 },
    },
  },
  advanced_quest: {
    id: "advanced_quest",
    name: "Advanced Quest",
    description: "A harder quest requiring goblin_slayer completion.",
    difficulty: "intermediate",
    questPoints: 2,
    replayable: false,
    requirements: {
      quests: ["goblin_slayer"],
      skills: { attack: 10 },
      items: [],
    },
    startNpc: "guard",
    stages: [
      {
        id: "talk_to_guard",
        type: "dialogue",
        description: "Talk to the Guard.",
      },
      {
        id: "kill_orcs",
        type: "kill",
        description: "Kill 10 orcs.",
        target: "orc",
        count: 10,
      },
    ],
    rewards: {
      questPoints: 2,
      items: [],
      xp: { defence: 1000 },
    },
  },
};

// Mock database repository for testing
class MockQuestRepository {
  private questProgress: Map<
    string,
    {
      playerId: string;
      questId: string;
      status: string;
      currentStage: string | null;
      stageProgress: Record<string, number>;
      startedAt: number | null;
      completedAt: number | null;
    }
  > = new Map();
  private questPoints: Map<string, number> = new Map();

  async getAllPlayerQuests(playerId: string) {
    const results: Array<{
      questId: string;
      status: "not_started" | "in_progress" | "completed";
      currentStage: string | null;
      stageProgress: Record<string, number>;
      startedAt: number | null;
      completedAt: number | null;
    }> = [];

    for (const [key, value] of this.questProgress) {
      if (key.startsWith(`${playerId}:`)) {
        results.push({
          questId: value.questId,
          status: value.status as "not_started" | "in_progress" | "completed",
          currentStage: value.currentStage,
          stageProgress: value.stageProgress,
          startedAt: value.startedAt,
          completedAt: value.completedAt,
        });
      }
    }
    return results;
  }

  async getQuestPoints(playerId: string) {
    return this.questPoints.get(playerId) ?? 0;
  }

  async startQuest(playerId: string, questId: string, initialStage: string) {
    this.questProgress.set(`${playerId}:${questId}`, {
      playerId,
      questId,
      status: "in_progress",
      currentStage: initialStage,
      stageProgress: {},
      startedAt: Date.now(),
      completedAt: null,
    });
  }

  async updateProgress(
    playerId: string,
    questId: string,
    stage: string,
    progress: Record<string, number>,
  ) {
    const key = `${playerId}:${questId}`;
    const existing = this.questProgress.get(key);
    if (existing) {
      existing.currentStage = stage;
      existing.stageProgress = progress;
    }
  }

  async completeQuestWithPoints(
    playerId: string,
    questId: string,
    questPoints: number,
  ) {
    const key = `${playerId}:${questId}`;
    const existing = this.questProgress.get(key);
    if (existing) {
      existing.status = "completed";
      existing.completedAt = Date.now();
    }
    const currentPoints = this.questPoints.get(playerId) ?? 0;
    this.questPoints.set(playerId, currentPoints + questPoints);
  }

  // Test helpers
  getProgress(playerId: string, questId: string) {
    return this.questProgress.get(`${playerId}:${questId}`);
  }

  clear() {
    this.questProgress.clear();
    this.questPoints.clear();
  }
}

describe("QuestSystem Integration Tests", () => {
  let questSystem: QuestSystem;
  let mockWorld: MockWorld;
  let eventHandlers: Map<string, ((...args: unknown[]) => void)[]>;
  let emittedEvents: Array<{ event: string; data: unknown }>;
  let mockQuestRepo: MockQuestRepository;

  beforeEach(async () => {
    eventHandlers = new Map();
    emittedEvents = [];
    mockQuestRepo = new MockQuestRepository();

    // Create a proper mock EventBus with subscribe method
    const eventBus = {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)!.push(handler);
      },
      emit: (event: string, data: unknown) => {
        emittedEvents.push({ event, data });
        const handlers = eventHandlers.get(event) || [];
        for (const handler of handlers) {
          handler(data);
        }
      },
      off: (_event: string, _handler: (...args: unknown[]) => void) => {
        // No-op for tests
      },
      // EventBus subscribe method returns an EventSubscription
      subscribe: (event: string, handler: (evt: { data: unknown }) => void) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        // Wrap handler to match SystemEvent format
        const wrappedHandler = (data: unknown) => {
          handler({ data });
        };
        eventHandlers.get(event)!.push(wrappedHandler);

        return {
          unsubscribe: () => {
            const handlers = eventHandlers.get(event);
            if (handlers) {
              const index = handlers.indexOf(wrappedHandler);
              if (index > -1) {
                handlers.splice(index, 1);
              }
            }
          },
        };
      },
      emitEvent: (type: string, data: unknown) => {
        emittedEvents.push({ event: type, data });
        const handlers = eventHandlers.get(type) || [];
        for (const handler of handlers) {
          handler(data);
        }
      },
    };

    mockWorld = {
      isServer: true,
      on: eventBus.on,
      emit: eventBus.emit,
      $eventBus: eventBus,
      getSystem: (name: string) => {
        if (name === "database") {
          return {
            getQuestRepository: () => mockQuestRepo,
          };
        }
        if (name === "inventory") {
          return {
            addItem: vi.fn().mockResolvedValue(true),
          };
        }
        return undefined;
      },
      // Skill level lookup - returns 99 for all skills to pass requirement checks
      getSkillLevel: (_playerId: string, _skillName: string) => 99,
      // Item check - returns true to pass item requirement checks
      hasItem: (_playerId: string, _itemId: string, _quantity: number) => true,
    };

    questSystem = new QuestSystem(
      mockWorld as unknown as import("@hyperforge/shared").World,
    );

    await questSystem.init();

    // Inject mock quest definitions AFTER init (to override any loaded manifest)
    // @ts-expect-error - accessing private for testing
    questSystem.questDefinitions = new Map(
      Object.entries(mockQuestDefinitions),
    );
    // @ts-expect-error - accessing private for testing
    questSystem.manifestLoaded = true;

    // Clear stage caches since we replaced the definitions
    // @ts-expect-error - accessing private for testing
    questSystem._stageByIdCache.clear();
    // @ts-expect-error - accessing private for testing
    questSystem._stageIndexCache.clear();
    // @ts-expect-error - accessing private for testing
    questSystem._gatherStageCache.clear();
    // @ts-expect-error - accessing private for testing
    questSystem._interactStageCache.clear();

    // Rebuild caches for mock definitions
    for (const [questId, definition] of Object.entries(mockQuestDefinitions)) {
      // @ts-expect-error - accessing private for testing
      questSystem.buildStageCaches(questId, definition);
    }

    // Simulate player registration to initialize player state
    eventBus.emitEvent(EventType.PLAYER_REGISTERED, { playerId: "player-1" });
    eventBus.emitEvent(EventType.PLAYER_REGISTERED, { playerId: "player-2" });

    // Clear events from setup
    emittedEvents = [];
  });

  afterEach(() => {
    questSystem.destroy();
    mockQuestRepo.clear();
  });

  // =========================================================================
  // QUEST STATUS TESTS
  // =========================================================================

  describe("Quest Status", () => {
    it("returns not_started for unstarted quest", () => {
      const status = questSystem.getQuestStatus("player-1", "goblin_slayer");
      expect(status).toBe("not_started");
    });

    it("returns in_progress for active quest", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      const status = questSystem.getQuestStatus("player-1", "goblin_slayer");
      expect(status).toBe("in_progress");
    });

    it("returns completed for finished quest", async () => {
      // Start and complete quest
      await questSystem.startQuest("player-1", "goblin_slayer");

      // Simulate killing 15 goblins
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }

      await questSystem.completeQuest("player-1", "goblin_slayer");

      const status = questSystem.getQuestStatus("player-1", "goblin_slayer");
      expect(status).toBe("completed");
    });

    it("returns ready_to_complete when objective is done", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      // Kill 15 goblins
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }

      const status = questSystem.getQuestStatus("player-1", "goblin_slayer");
      expect(status).toBe("ready_to_complete");
    });
  });

  // =========================================================================
  // QUEST START TESTS
  // =========================================================================

  describe("Quest Start", () => {
    it("starts quest successfully", async () => {
      const success = await questSystem.startQuest("player-1", "goblin_slayer");

      expect(success).toBe(true);
      expect(questSystem.getQuestStatus("player-1", "goblin_slayer")).toBe(
        "in_progress",
      );
    });

    it("emits QUEST_STARTED event on start", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      const startEvent = emittedEvents.find(
        (e) => e.event === EventType.QUEST_STARTED,
      );
      expect(startEvent).toBeDefined();
      expect(startEvent?.data).toMatchObject({
        playerId: "player-1",
        questId: "goblin_slayer",
        questName: "Goblin Slayer",
      });
    });

    it("emits CHAT_MESSAGE on quest start", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      const chatEvent = emittedEvents.find(
        (e) => e.event === EventType.CHAT_MESSAGE,
      );
      expect(chatEvent).toBeDefined();
      expect((chatEvent?.data as { message: string }).message).toContain(
        "Goblin Slayer",
      );
    });

    it("grants starting items", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      const itemEvent = emittedEvents.find(
        (e) => e.event === EventType.INVENTORY_ITEM_ADDED,
      );
      expect(itemEvent).toBeDefined();
      expect(itemEvent?.data).toMatchObject({
        playerId: "player-1",
        item: {
          itemId: "bronze_shortsword",
          quantity: 1,
        },
      });
    });

    it("rejects starting already active quest", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      const secondStart = await questSystem.startQuest(
        "player-1",
        "goblin_slayer",
      );
      expect(secondStart).toBe(false);
    });

    it("rejects starting already completed quest", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      // Complete the quest
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }
      await questSystem.completeQuest("player-1", "goblin_slayer");

      const restart = await questSystem.startQuest("player-1", "goblin_slayer");
      expect(restart).toBe(false);
    });

    it("rejects quest when prerequisites not met", async () => {
      // advanced_quest requires goblin_slayer to be completed
      const success = await questSystem.startQuest(
        "player-1",
        "advanced_quest",
      );
      expect(success).toBe(false);
    });

    it("allows quest when prerequisites are met", async () => {
      // Complete goblin_slayer first
      await questSystem.startQuest("player-1", "goblin_slayer");
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }
      await questSystem.completeQuest("player-1", "goblin_slayer");

      // Now advanced_quest should be startable
      const success = await questSystem.startQuest(
        "player-1",
        "advanced_quest",
      );
      expect(success).toBe(true);
    });

    it("rejects starting non-existent quest", async () => {
      const success = await questSystem.startQuest(
        "player-1",
        "non_existent_quest",
      );
      expect(success).toBe(false);
    });

    it("saves quest to database on start", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      const dbProgress = mockQuestRepo.getProgress("player-1", "goblin_slayer");
      expect(dbProgress).toBeDefined();
      expect(dbProgress?.status).toBe("in_progress");
      expect(dbProgress?.currentStage).toBe("kill_goblins");
    });
  });

  // =========================================================================
  // KILL TRACKING TESTS
  // =========================================================================

  describe("Kill Tracking", () => {
    beforeEach(async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");
      emittedEvents = [];
    });

    it("tracks kill progress", () => {
      mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
        killedBy: "player-1",
        mobType: "goblin",
        npcId: "goblin-1",
      });

      const activeQuests = questSystem.getActiveQuests("player-1");
      const quest = activeQuests.find((q) => q.questId === "goblin_slayer");
      expect(quest?.stageProgress.kills).toBe(1);
    });

    it("emits QUEST_PROGRESSED event on kill", () => {
      mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
        killedBy: "player-1",
        mobType: "goblin",
        npcId: "goblin-1",
      });

      const progressEvent = emittedEvents.find(
        (e) => e.event === EventType.QUEST_PROGRESSED,
      );
      expect(progressEvent).toBeDefined();
      expect(progressEvent?.data).toMatchObject({
        playerId: "player-1",
        questId: "goblin_slayer",
        progress: { kills: 1 },
      });
    });

    it("tracks multiple kills correctly", () => {
      for (let i = 0; i < 10; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }

      const activeQuests = questSystem.getActiveQuests("player-1");
      const quest = activeQuests.find((q) => q.questId === "goblin_slayer");
      expect(quest?.stageProgress.kills).toBe(10);
    });

    it("marks quest ready_to_complete when objective met", () => {
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }

      const activeQuests = questSystem.getActiveQuests("player-1");
      const quest = activeQuests.find((q) => q.questId === "goblin_slayer");
      expect(quest?.status).toBe("ready_to_complete");
    });

    it("sends chat message when objective complete", () => {
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }

      const chatEvents = emittedEvents.filter(
        (e) => e.event === EventType.CHAT_MESSAGE,
      );
      const completionMessage = chatEvents.find((e) =>
        (e.data as { message: string }).message.includes("killed enough"),
      );
      expect(completionMessage).toBeDefined();
    });

    it("ignores kills of wrong mob type", () => {
      mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
        killedBy: "player-1",
        mobType: "orc", // Wrong mob type
        npcId: "orc-1",
      });

      const activeQuests = questSystem.getActiveQuests("player-1");
      const quest = activeQuests.find((q) => q.questId === "goblin_slayer");
      expect(quest?.stageProgress.kills).toBeUndefined();
    });

    it("ignores kills from other players", () => {
      mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
        killedBy: "player-2", // Different player
        mobType: "goblin",
        npcId: "goblin-1",
      });

      const activeQuests = questSystem.getActiveQuests("player-1");
      const quest = activeQuests.find((q) => q.questId === "goblin_slayer");
      expect(quest?.stageProgress.kills).toBeUndefined();
    });

    it("updates database on kill progress", () => {
      mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
        killedBy: "player-1",
        mobType: "goblin",
        npcId: "goblin-1",
      });

      const dbProgress = mockQuestRepo.getProgress("player-1", "goblin_slayer");
      expect(dbProgress?.stageProgress.kills).toBe(1);
    });
  });

  // =========================================================================
  // QUEST COMPLETION TESTS
  // =========================================================================

  describe("Quest Completion", () => {
    beforeEach(async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      // Complete the objective
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }

      emittedEvents = [];
    });

    it("completes quest successfully", async () => {
      const success = await questSystem.completeQuest(
        "player-1",
        "goblin_slayer",
      );
      expect(success).toBe(true);
      expect(questSystem.getQuestStatus("player-1", "goblin_slayer")).toBe(
        "completed",
      );
    });

    it("emits QUEST_COMPLETED event", async () => {
      await questSystem.completeQuest("player-1", "goblin_slayer");

      const completeEvent = emittedEvents.find(
        (e) => e.event === EventType.QUEST_COMPLETED,
      );
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.data).toMatchObject({
        playerId: "player-1",
        questId: "goblin_slayer",
        questName: "Goblin Slayer",
      });
    });

    it("awards quest points", async () => {
      await questSystem.completeQuest("player-1", "goblin_slayer");

      const points = questSystem.getQuestPoints("player-1");
      expect(points).toBe(1);
    });

    it("grants reward items", async () => {
      await questSystem.completeQuest("player-1", "goblin_slayer");

      const itemEvent = emittedEvents.find(
        (e) => e.event === EventType.INVENTORY_ITEM_ADDED,
      );
      expect(itemEvent).toBeDefined();
      expect(itemEvent?.data).toMatchObject({
        playerId: "player-1",
        item: {
          itemId: "xp_lamp_100",
          quantity: 1,
        },
      });
    });

    it("rejects completion when not ready", async () => {
      // Start a new quest without completing objective
      await questSystem.startQuest("player-2", "goblin_slayer");

      const success = await questSystem.completeQuest(
        "player-2",
        "goblin_slayer",
      );
      expect(success).toBe(false);
    });

    it("rejects completion of non-active quest", async () => {
      const success = await questSystem.completeQuest(
        "player-1",
        "advanced_quest",
      );
      expect(success).toBe(false);
    });

    it("saves completion to database atomically", async () => {
      await questSystem.completeQuest("player-1", "goblin_slayer");

      const dbProgress = mockQuestRepo.getProgress("player-1", "goblin_slayer");
      expect(dbProgress?.status).toBe("completed");
      expect(dbProgress?.completedAt).toBeDefined();

      const dbPoints = await mockQuestRepo.getQuestPoints("player-1");
      expect(dbPoints).toBe(1);
    });
  });

  // =========================================================================
  // QUEST REQUEST FLOW TESTS
  // =========================================================================

  describe("Quest Request Flow", () => {
    it("emits QUEST_START_CONFIRM on requestQuestStart", () => {
      questSystem.requestQuestStart("player-1", "goblin_slayer");

      const confirmEvent = emittedEvents.find(
        (e) => e.event === EventType.QUEST_START_CONFIRM,
      );
      expect(confirmEvent).toBeDefined();
      expect(confirmEvent?.data).toMatchObject({
        playerId: "player-1",
        questId: "goblin_slayer",
        questName: "Goblin Slayer",
        difficulty: "novice",
      });
    });

    it("includes requirements and rewards in confirm event", () => {
      questSystem.requestQuestStart("player-1", "goblin_slayer");

      const confirmEvent = emittedEvents.find(
        (e) => e.event === EventType.QUEST_START_CONFIRM,
      );
      const data = confirmEvent?.data as {
        requirements: { quests: string[] };
        rewards: { questPoints: number; items: Array<{ itemId: string }> };
      };

      expect(data.requirements.quests).toEqual([]);
      expect(data.rewards.questPoints).toBe(1);
      expect(data.rewards.items).toContainEqual({
        itemId: "xp_lamp_100",
        quantity: 1,
      });
    });

    it("rejects request for already active quest", () => {
      questSystem.requestQuestStart("player-1", "goblin_slayer");
      questSystem.startQuest("player-1", "goblin_slayer");

      emittedEvents = [];
      const result = questSystem.requestQuestStart("player-1", "goblin_slayer");

      expect(result).toBe(false);
      const confirmEvent = emittedEvents.find(
        (e) => e.event === EventType.QUEST_START_CONFIRM,
      );
      expect(confirmEvent).toBeUndefined();
    });
  });

  // =========================================================================
  // PLAYER CLEANUP TESTS
  // =========================================================================

  describe("Player Cleanup", () => {
    it("removes player state on PLAYER_CLEANUP event", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      mockWorld.$eventBus!.emitEvent(EventType.PLAYER_CLEANUP, {
        playerId: "player-1",
      });

      // Player state should be cleared
      const status = questSystem.getQuestStatus("player-1", "goblin_slayer");
      expect(status).toBe("not_started"); // No state = not started
    });
  });

  // =========================================================================
  // QUEST DEFINITION QUERIES
  // =========================================================================

  describe("Quest Definition Queries", () => {
    it("returns all quest definitions", () => {
      const definitions = questSystem.getAllQuestDefinitions();
      // Check that we have at least the expected quests (more may be added)
      expect(definitions.length).toBeGreaterThanOrEqual(2);
      expect(definitions.map((d) => d.id)).toContain("goblin_slayer");
      expect(definitions.map((d) => d.id)).toContain("advanced_quest");
    });

    it("returns specific quest definition", () => {
      const definition = questSystem.getQuestDefinition("goblin_slayer");
      expect(definition).toBeDefined();
      expect(definition?.name).toBe("Goblin Slayer");
      expect(definition?.stages.length).toBe(3);
    });

    it("returns undefined for non-existent quest", () => {
      const definition = questSystem.getQuestDefinition("non_existent");
      expect(definition).toBeUndefined();
    });
  });

  // =========================================================================
  // ACTIVE QUESTS QUERIES
  // =========================================================================

  describe("Active Quests Queries", () => {
    it("returns empty array when no active quests", () => {
      const activeQuests = questSystem.getActiveQuests("player-1");
      expect(activeQuests).toEqual([]);
    });

    it("returns active quests for player", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      const activeQuests = questSystem.getActiveQuests("player-1");
      expect(activeQuests.length).toBe(1);
      expect(activeQuests[0].questId).toBe("goblin_slayer");
    });

    it("tracks multiple active quests", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      // Complete goblin_slayer to unlock advanced_quest
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }
      await questSystem.completeQuest("player-1", "goblin_slayer");

      await questSystem.startQuest("player-1", "advanced_quest");

      const activeQuests = questSystem.getActiveQuests("player-1");
      expect(activeQuests.length).toBe(1);
      expect(activeQuests[0].questId).toBe("advanced_quest");
    });
  });

  // =========================================================================
  // QUEST POINTS TESTS
  // =========================================================================

  describe("Quest Points", () => {
    it("starts with 0 quest points", () => {
      const points = questSystem.getQuestPoints("player-1");
      expect(points).toBe(0);
    });

    it("accumulates quest points across completions", async () => {
      // Complete goblin_slayer (1 QP)
      const gs1 = await questSystem.startQuest("player-1", "goblin_slayer");
      expect(gs1).toBe(true);

      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }
      const gc1 = await questSystem.completeQuest("player-1", "goblin_slayer");
      expect(gc1).toBe(true);

      expect(questSystem.getQuestPoints("player-1")).toBe(1);

      // Complete advanced_quest (2 QP)
      const as2 = await questSystem.startQuest("player-1", "advanced_quest");
      expect(as2).toBe(true);

      for (let i = 0; i < 10; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "orc",
          npcId: `orc-${i}`,
        });
      }
      // Verify quest status is ready to complete before completing
      const status2 = questSystem.getQuestStatus("player-1", "advanced_quest");
      expect(status2).toBe("ready_to_complete");

      const ac2 = await questSystem.completeQuest("player-1", "advanced_quest");
      expect(ac2).toBe(true);

      expect(questSystem.getQuestPoints("player-1")).toBe(3);
    });
  });

  // =========================================================================
  // HAS COMPLETED QUEST TESTS
  // =========================================================================

  describe("hasCompletedQuest", () => {
    it("returns false for uncompleted quest", () => {
      expect(questSystem.hasCompletedQuest("player-1", "goblin_slayer")).toBe(
        false,
      );
    });

    it("returns false for in-progress quest", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");

      expect(questSystem.hasCompletedQuest("player-1", "goblin_slayer")).toBe(
        false,
      );
    });

    it("returns true for completed quest", async () => {
      await questSystem.startQuest("player-1", "goblin_slayer");
      for (let i = 0; i < 15; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }
      await questSystem.completeQuest("player-1", "goblin_slayer");

      expect(questSystem.hasCompletedQuest("player-1", "goblin_slayer")).toBe(
        true,
      );
    });
  });

  // =========================================================================
  // FULL QUEST FLOW TEST
  // =========================================================================

  describe("Full Quest Flow", () => {
    it("complete quest flow: request → accept → kill → complete", async () => {
      // Step 1: Request quest start (shows confirmation screen)
      const requested = questSystem.requestQuestStart(
        "player-1",
        "goblin_slayer",
      );
      expect(requested).toBe(true);

      let confirmEvent = emittedEvents.find(
        (e) => e.event === EventType.QUEST_START_CONFIRM,
      );
      expect(confirmEvent).toBeDefined();

      // Step 2: Player accepts (triggered by QUEST_START_ACCEPTED event in real system)
      const started = await questSystem.startQuest("player-1", "goblin_slayer");
      expect(started).toBe(true);
      expect(questSystem.getQuestStatus("player-1", "goblin_slayer")).toBe(
        "in_progress",
      );

      // Step 3: Track kills
      for (let i = 0; i < 14; i++) {
        mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
          killedBy: "player-1",
          mobType: "goblin",
          npcId: `goblin-${i}`,
        });
      }
      expect(questSystem.getQuestStatus("player-1", "goblin_slayer")).toBe(
        "in_progress",
      );

      // Final kill
      mockWorld.$eventBus!.emitEvent(EventType.NPC_DIED, {
        killedBy: "player-1",
        mobType: "goblin",
        npcId: "goblin-14",
      });
      expect(questSystem.getQuestStatus("player-1", "goblin_slayer")).toBe(
        "ready_to_complete",
      );

      // Step 4: Complete quest (triggered by dialogue effect)
      const completed = await questSystem.completeQuest(
        "player-1",
        "goblin_slayer",
      );
      expect(completed).toBe(true);
      expect(questSystem.getQuestStatus("player-1", "goblin_slayer")).toBe(
        "completed",
      );
      expect(questSystem.getQuestPoints("player-1")).toBe(1);
      expect(questSystem.hasCompletedQuest("player-1", "goblin_slayer")).toBe(
        true,
      );
    });
  });
});
