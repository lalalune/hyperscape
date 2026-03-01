/**
 * AgentBehaviorTicker - Extracted behavior loop and action selection from AgentManager
 *
 * Handles:
 * - Autonomous behavior tick loop (8s interval)
 * - Quest management (auto-accept, track progress, complete)
 * - Shopping (buy tools/weapons)
 * - Inventory management (drop junk, bury bones)
 * - Equipment management (equip best gear)
 * - Eating (health recovery)
 * - Action selection (quest-driven or default combat/explore)
 * - Combat chat reactions
 */

import { getItem, EventType } from "@hyperscape/shared";
import type { World } from "@hyperscape/shared";
import {
  ejectAgentFromCombatArena,
  recoverAgentFromDeathLoop,
} from "../agentRecovery.js";
import { errMsg } from "../../shared/errMsg.js";
import type {
  EmbeddedAgentConfig,
  AgentState,
  EmbeddedGameState,
  NearbyEntityData,
  AgentQuestProgress,
} from "../types.js";
import type { EmbeddedHyperscapeService } from "../EmbeddedHyperscapeService.js";

/**
 * Active goal for an embedded agent (visible on dashboard)
 */
export interface AgentGoal {
  type: "questing" | "combat" | "gathering" | "idle";
  description: string;
  questId?: string;
  questName?: string;
  questStageType?: string;
  questStageTarget?: string;
  questStageCount?: number;
  questStartNpc?: string;
}

/**
 * Combat chat reaction types
 */
export type CombatChatReactionType =
  | "critical_hit_dealt"
  | "critical_hit_taken"
  | "near_death"
  | "victory_imminent";

/**
 * Pending chat reaction for an agent
 */
export interface PendingChatReaction {
  type: CombatChatReactionType;
  opponentName: string;
  timestamp: number;
}

/**
 * Internal agent instance tracking
 */
export interface AgentInstance {
  config: EmbeddedAgentConfig;
  service: EmbeddedHyperscapeService;
  state: AgentState;
  startedAt: number;
  lastActivity: number;
  error?: string;
  behaviorInterval: ReturnType<typeof setInterval> | null;
  goal: AgentGoal | null;
  questsAccepted: Set<string>;
  currentTargetId: string | null;
  lastAteAt: number;
  dropCooldownUntil: number;
  lastGatherTargetId: string | null;
  lastGatherQueuedAt: number;
  /** Pending chat reaction from combat event (processed on next behavior tick) */
  pendingChatReaction: PendingChatReaction | null;
  /** Timestamp of last combat chat to prevent spam */
  lastCombatChatAt: number;
}

export type EmbeddedBehaviorAction =
  | { type: "attack"; targetId: string }
  | { type: "gather"; targetId: string }
  | { type: "pickup"; targetId: string }
  | { type: "lootGravestone"; gravestoneId: string }
  | { type: "move"; target: [number, number, number]; runMode?: boolean }
  | { type: "questAccept"; questId: string }
  | { type: "questComplete"; questId: string }
  | { type: "firemake"; logsItemId: string }
  | { type: "stop" }
  | { type: "idle" };

/** Autonomous behavior tick interval for embedded agents */
export const EMBEDDED_BEHAVIOR_TICK_INTERVAL = 8000;

export const EMBEDDED_AGENT_AUTONOMY_ENABLED = (() => {
  const raw = process.env.EMBEDDED_AGENT_AUTONOMY_ENABLED;
  if (raw == null || raw.trim().length === 0) return true;
  const normalized = raw.trim().toLowerCase();
  return !(
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "off"
  );
})();

/** Combat chat reaction thresholds */
export const CRITICAL_HIT_THRESHOLD = 0.3; // 30% of max health
export const NEAR_DEATH_THRESHOLD = 0.2; // 20% of current health
export const COMBAT_CHAT_COOLDOWN = 15000; // 15 seconds between combat chats

/**
 * Interface for the HyperscapeService methods used by the ticker.
 */
interface HyperscapeService {
  setAutonomousBehaviorEnabled?(enabled: boolean): void;
}

export function setAgentAutonomyIfSupported(
  service: HyperscapeService,
  enabled: boolean,
): boolean {
  if (typeof service.setAutonomousBehaviorEnabled !== "function") {
    return false;
  }
  service.setAutonomousBehaviorEnabled(enabled);
  return true;
}

/**
 * AgentBehaviorTicker manages the autonomous behavior loop and action selection
 * for embedded agents.
 */
export class AgentBehaviorTicker {
  constructor(
    private readonly world: World,
    private readonly getAgent: (
      characterId: string,
    ) => AgentInstance | undefined,
    private readonly getAllAgentIds: () => string[],
  ) {}

  // ─── BEHAVIOR LOOP ───────────────────────────────────────────────────

  /**
   * Start autonomous behavior loop for an embedded agent.
   * Uses an 8-second interval with a 3-second initial delay.
   */
  public startBehaviorLoop(characterId: string): void {
    const instance = this.getAgent(characterId);
    if (!instance || instance.state !== "running") {
      return;
    }

    // Replace any existing loop.
    this.stopBehaviorLoop(characterId);

    const runTick = async () => {
      try {
        const current = this.getAgent(characterId);
        if (!current || current.state !== "running") {
          return;
        }

        await this.executeBehaviorTick(characterId);
      } catch (err) {
        console.warn(
          `[AgentManager] Behavior tick failed for ${characterId}: ${errMsg(
            err,
          )}`,
        );
      } finally {
        tickInProgress = false;
      }
    };

    let tickInProgress = false;
    instance.behaviorInterval = setInterval(() => {
      if (tickInProgress) return;
      tickInProgress = true;
      void runTick();
    }, EMBEDDED_BEHAVIOR_TICK_INTERVAL);

    // Delay the first tick so PLAYER_REGISTERED has time to fire and
    // QuestSystem can load the player's quest state from the database.
    setTimeout(() => {
      if (tickInProgress) return;
      tickInProgress = true;
      void runTick();
    }, 3000);
  }

  /**
   * Stop autonomous behavior loop for an embedded agent.
   */
  public stopBehaviorLoop(characterId: string): void {
    const instance = this.getAgent(characterId);
    if (!instance) {
      return;
    }

    if (instance.behaviorInterval) {
      clearInterval(instance.behaviorInterval);
      instance.behaviorInterval = null;
    }

    // Best-effort stop so paused/stopped agents don't keep pathing or attacking.
    void instance.service.executeStop().catch(() => {});
  }

  /**
   * Execute one autonomous behavior tick.
   *
   * Quest-aware: agents auto-accept quests, track objectives, and complete them.
   */
  public async executeBehaviorTick(characterId: string): Promise<void> {
    const instance = this.getAgent(characterId);
    if (!instance || instance.state !== "running") {
      return;
    }

    const entity = this.world.entities.get(characterId);

    if (recoverAgentFromDeathLoop(this.world, characterId, "AgentManager")) {
      instance.lastActivity = Date.now();
      return;
    }

    if (ejectAgentFromCombatArena(this.world, characterId, "AgentManager")) {
      instance.lastActivity = Date.now();
      return;
    }

    const inStreamingDuel =
      (entity?.data as { inStreamingDuel?: boolean } | undefined)
        ?.inStreamingDuel === true;

    if (inStreamingDuel) {
      return;
    }

    const gameState = instance.service.getGameState();
    if (!gameState || !gameState.position) {
      return;
    }

    // === COMBAT CHAT REACTIONS (non-blocking) ===
    if (instance.pendingChatReaction) {
      const reaction = instance.pendingChatReaction;
      instance.pendingChatReaction = null;

      try {
        const message = this.getCombatChatResponse(reaction);
        await instance.service.sendChatMessage(message);
        instance.lastCombatChatAt = Date.now();
        console.log(
          `[AgentManager] ${instance.config.name} combat chat (${reaction.type}): "${message}"`,
        );
      } catch (err) {
        console.warn(
          `[AgentManager] ${instance.config.name} failed to send combat chat: ${errMsg(err)}`,
        );
      }
    }

    // === QUEST MANAGEMENT ===
    await this.manageQuests(instance);

    // === INVENTORY MANAGEMENT ===
    await this.manageInventory(instance);

    // === SHOPPING: buy missing tools/weapons ===
    await this.manageShopping(instance);

    // === EQUIPMENT MANAGEMENT ===
    await this.manageEquipment(instance, gameState);

    // === SURVIVAL: EAT FOOD IF NEEDED ===
    if (await this.assessAndEat(instance, gameState)) {
      return; // Ate food this tick — skip action to let health update
    }

    // === PICK ACTION ===
    const action = this.pickBehaviorAction(instance, gameState);

    const logParts = [
      `[AgentManager] ${instance.config.name} tick: action=${action.type}`,
    ];
    if ("targetId" in action) logParts.push(`target=${action.targetId}`);
    if ("target" in action) {
      const t = (action as { target: number[] }).target;
      logParts.push(`pos=[${t.map((n: number) => n.toFixed(0)).join(",")}]`);
    }
    if (instance.goal)
      logParts.push(
        `goal=${instance.goal.type}${instance.goal.questName ? `:${instance.goal.questName}` : ""}`,
      );
    console.log(logParts.join(" "));

    switch (action.type) {
      case "attack":
        await instance.service.executeAttack(action.targetId);
        instance.lastActivity = Date.now();
        break;

      case "gather":
        await instance.service.executeGather(action.targetId);
        instance.lastActivity = Date.now();
        break;

      case "pickup":
        await instance.service.executePickup(action.targetId);
        instance.lastActivity = Date.now();
        break;

      case "lootGravestone":
        this.world.emit(EventType.CORPSE_LOOT_ALL_REQUEST, {
          corpseId: action.gravestoneId,
          playerId: instance.service.getPlayerId(),
        });
        console.log(
          `[AgentManager] ${instance.config.name} looting gravestone ${action.gravestoneId}`,
        );
        instance.lastActivity = Date.now();
        break;

      case "move":
        await instance.service.executeMove(action.target, action.runMode);
        instance.lastActivity = Date.now();
        break;

      case "firemake":
        await instance.service.executeFiremake(action.logsItemId);
        instance.lastActivity = Date.now();
        break;

      case "questAccept": {
        const accepted = await instance.service.executeQuestAccept(
          action.questId,
        );
        if (accepted) {
          // Verify quest actually started by checking quest state after a moment
          // (QUEST_START_ACCEPTED is handled synchronously by QuestSystem)
          const postAcceptState = instance.service.getQuestState();
          const questStarted = postAcceptState.some(
            (q) => q.questId === action.questId,
          );
          if (questStarted) {
            instance.questsAccepted.add(action.questId);
            console.log(
              `[AgentManager] ${instance.config.name} accepted quest: ${action.questId}`,
            );
          } else {
            console.warn(
              `[AgentManager] ${instance.config.name} quest accept sent but not started yet: ${action.questId} (will retry)`,
            );
          }
        }
        instance.lastActivity = Date.now();
        break;
      }

      case "questComplete":
        await instance.service.executeQuestComplete(action.questId);
        console.log(
          `[AgentManager] ${instance.config.name} completed quest: ${action.questId}`,
        );
        instance.goal = null;
        instance.lastActivity = Date.now();
        break;

      case "stop":
        await instance.service.executeStop();
        instance.lastActivity = Date.now();
        break;

      case "idle":
      default:
        break;
    }
  }

  // ─── BEHAVIOR MANAGEMENT ─────────────────────────────────────────────

  /**
   * Manage quest state for an agent: auto-accept, track progress, update goals.
   * Only accepts quests the agent can actually execute (kill quests first).
   */
  public async manageQuests(instance: AgentInstance): Promise<void> {
    const activeQuests = instance.service.getQuestState();
    const availableQuests = instance.service.getAvailableQuests();

    const resourceSystemAvailable = !!this.world.getSystem("resource");

    // If there's an active quest, set the goal to work on it
    if (activeQuests.length > 0) {
      // Prefer a quest the agent can actually complete right now
      const quest =
        activeQuests.find(
          (q) =>
            q.status === "ready_to_complete" ||
            q.stageType === "kill" ||
            q.stageType === "dialogue" ||
            (q.stageType === "gather" && resourceSystemAvailable),
        ) || activeQuests[0];

      // If the only active quest is a gather quest and resources don't exist,
      // fall through to combat so agents don't wander endlessly.
      if (
        quest.stageType === "gather" &&
        !resourceSystemAvailable &&
        quest.status !== "ready_to_complete"
      ) {
        instance.goal = {
          type: "combat",
          description: "Train combat (gather resources unavailable)",
        };
        return;
      }

      instance.goal = {
        type: "questing",
        description:
          quest.status === "ready_to_complete"
            ? `Turn in: ${quest.name}`
            : `${quest.stageDescription || quest.name}`,
        questId: quest.questId,
        questName: quest.name,
        questStageType: quest.stageType,
        questStageTarget: quest.stageTarget,
        questStageCount: quest.stageCount,
        questStartNpc: quest.startNpc,
      };
      return;
    }

    // No active quest — accept the next available one.
    // Kill quests first (reliable), then gather quests only if resources exist.
    const questPriority = [
      "goblin_slayer",
      ...(resourceSystemAvailable
        ? ["lumberjacks_first_lesson", "fresh_catch", "torvins_tools"]
        : []),
    ];

    for (const questId of questPriority) {
      const quest = availableQuests.find(
        (q) => q.questId === questId && q.status === "not_started",
      );
      if (quest && !instance.questsAccepted.has(questId)) {
        instance.goal = {
          type: "questing",
          description: `Accept quest: ${quest.name}`,
          questId: quest.questId,
          questName: quest.name,
          questStartNpc: quest.startNpc,
        };
        return;
      }
    }

    // All quests done or accepted — combat training
    instance.goal = {
      type: "combat",
      description: "Train combat on goblins",
    };
  }

  /**
   * Buy tools and weapons the agent needs but doesn't have.
   * Checks quest requirements, current equipment, and coins.
   * One purchase per tick to avoid spam.
   */
  public async manageShopping(instance: AgentInstance): Promise<void> {
    const inventory = instance.service.getInventoryItems();
    const equipped = instance.service.getEquippedItems();
    const goal = instance.goal;

    // Get coins from game state
    const gameState = instance.service.getGameState();
    if (!gameState) return;

    // Read coins from the entity data (CoinPouchSystem stores here)
    const entity = instance.service
      .getWorld()
      .entities.get(instance.service.getPlayerId() || "");
    const coins =
      ((entity?.data as Record<string, unknown>)?.coins as number) || 0;
    if (coins < 10) return; // Not enough to buy anything

    const hasItemInInventoryOrEquipped = (itemId: string): boolean => {
      const item = getItem(itemId);
      const equipSlot = item?.equipSlot;
      if (equipSlot) {
        const equippedItem = equipped[equipSlot];
        if (equippedItem === itemId) return true;
        // Two-handed weapons are represented by weapon slot in equipment state.
        if (equipSlot === "2h" && equipped.weapon === itemId) return true;
      } else if (equipped.weapon === itemId) {
        // Fallback for weapon-like items where metadata may be missing.
        return true;
      }
      return inventory.some((i) => i.itemId === itemId);
    };

    const hasAnyOfType = (keyword: string): boolean => {
      const equippedWeapon = equipped.weapon || "";
      if (equippedWeapon.includes(keyword)) return true;
      return inventory.some((i) => i.itemId.includes(keyword));
    };

    // Priority 1: Buy a weapon if unarmed
    if (
      !equipped.weapon &&
      !inventory.some((i) => {
        const item = getItem(i.itemId);
        return item?.equipSlot === "weapon" || item?.equipSlot === "2h";
      })
    ) {
      if (coins >= 100) {
        console.log(
          `[AgentManager] ${instance.config.name} buying bronze_shortsword (unarmed, ${coins} coins)`,
        );
        await instance.service.executeStoreBuy(
          "sword_store",
          "bronze_shortsword",
          1,
        );
        return;
      }
      if (coins >= 10) {
        console.log(
          `[AgentManager] ${instance.config.name} buying bronze_dagger (unarmed, ${coins} coins)`,
        );
        await instance.service.executeStoreBuy(
          "sword_store",
          "bronze_dagger",
          1,
        );
        return;
      }
    }

    // Priority 2: Buy tools needed for current quest
    if (goal?.type === "questing") {
      const stageTarget = goal.questStageTarget || "";
      const stageType = goal.questStageType || "";

      // Need hatchet for woodcutting quests (both chop_logs and burn_logs stages)
      if (
        (stageType === "gather" && stageTarget.includes("log")) ||
        goal.questId === "lumberjacks_first_lesson"
      ) {
        if (!hasAnyOfType("hatchet")) {
          if (coins >= 50) {
            console.log(
              `[AgentManager] ${instance.config.name} buying bronze_hatchet for woodcutting quest (${coins} coins)`,
            );
            await instance.service.executeStoreBuy(
              "general_store",
              "bronze_hatchet",
              1,
            );
            return;
          }
        }
      }

      // Need pickaxe for mining quests
      if (
        (stageType === "gather" &&
          (stageTarget.includes("ore") || stageTarget.includes("essence"))) ||
        goal.questId === "torvins_tools"
      ) {
        if (!hasAnyOfType("pickaxe")) {
          if (coins >= 50) {
            console.log(
              `[AgentManager] ${instance.config.name} buying bronze_pickaxe for mining quest (${coins} coins)`,
            );
            await instance.service.executeStoreBuy(
              "general_store",
              "bronze_pickaxe",
              1,
            );
            return;
          }
        }
      }

      // Need fishing equipment for fishing quests
      if (
        (stageType === "gather" && stageTarget.includes("shrimp")) ||
        goal.questId === "fresh_catch"
      ) {
        if (!hasItemInInventoryOrEquipped("small_fishing_net")) {
          if (coins >= 5) {
            console.log(
              `[AgentManager] ${instance.config.name} buying small_fishing_net for fishing quest (${coins} coins)`,
            );
            await instance.service.executeStoreBuy(
              "fishing_store",
              "small_fishing_net",
              1,
            );
            return;
          }
        }
      }

      // Need tinderbox for firemaking quests
      if (stageType === "interact" && stageTarget.includes("fire")) {
        if (!hasItemInInventoryOrEquipped("tinderbox")) {
          if (coins >= 5) {
            console.log(
              `[AgentManager] ${instance.config.name} buying tinderbox (${coins} coins)`,
            );
            await instance.service.executeStoreBuy(
              "general_store",
              "tinderbox",
              1,
            );
            return;
          }
        }
      }
    }
  }

  /**
   * Keep inventory tidy: drop low-value junk to make room for useful items.
   * Agents get inventories clogged with sharks from duels and bones from kills.
   * Runs once per tick. Drops one item per tick to avoid spam.
   *
   * Priority to keep: weapons > armor > tools > food (max 5) > everything else
   * Priority to drop: bones, excess food beyond 5, other junk
   */
  public async manageInventory(instance: AgentInstance): Promise<void> {
    const inventory = instance.service.getInventoryItems();
    if (inventory.length < 20) return; // Keep 8+ free slots for quest loot and gear
    if (Date.now() < instance.dropCooldownUntil) return;

    // Count food items
    let foodCount = 0;
    const dropCandidates: Array<{
      itemId: string;
      slot: number;
      priority: number;
    }> = [];

    for (const slot of inventory) {
      const itemData = getItem(slot.itemId);
      const healAmount = itemData
        ? ((itemData as unknown as Record<string, unknown>).healAmount as
            | number
            | undefined)
        : undefined;
      const isFood = healAmount && healAmount > 0;
      const isWeapon =
        itemData?.equipSlot === "weapon" || itemData?.equipSlot === "2h";
      const isArmor = itemData?.equipSlot && !isWeapon;
      const isTool = itemData?.type === "tool";

      if (isFood) {
        foodCount++;
        if (foodCount > 5) {
          dropCandidates.push({
            itemId: slot.itemId,
            slot: slot.slot,
            priority: 2,
          });
        }
        continue;
      }

      // Never drop weapons, armor, tools, or quest-critical items
      const questTools = [
        "tinderbox",
        "bronze_hatchet",
        "hatchet",
        "bronze_pickaxe",
        "pickaxe",
        "fishing_rod",
        "net",
        "logs",
        "oak_logs",
      ];
      if (isWeapon || isArmor || isTool || questTools.includes(slot.itemId))
        continue;

      // Bones — bury for prayer XP instead of dropping
      if (slot.itemId === "bones" || slot.itemId.endsWith("_bones")) {
        console.log(
          `[AgentManager] ${instance.config.name} burying ${slot.itemId} for prayer XP`,
        );
        await instance.service.executeUse(slot.itemId);
        return; // One action per tick
      }

      // Other non-essential items
      dropCandidates.push({
        itemId: slot.itemId,
        slot: slot.slot,
        priority: 1,
      });
    }

    if (dropCandidates.length === 0) return;

    // Sort by priority (lowest first = drop first)
    dropCandidates.sort((a, b) => a.priority - b.priority);

    // Drop up to 3 items when very full, 1 otherwise
    const dropCount =
      inventory.length >= 27 ? Math.min(3, dropCandidates.length) : 1;
    for (let i = 0; i < dropCount; i++) {
      const toDrop = dropCandidates[i];
      console.log(
        `[AgentManager] ${instance.config.name} dropping ${toDrop.itemId} (inventory: ${inventory.length - i}/28)`,
      );
      await instance.service.executeDrop(toDrop.itemId, 1);
    }

    // Set cooldown so agent doesn't immediately pick up what it dropped
    instance.dropCooldownUntil = Date.now() + 25000; // 25 seconds (~3 ticks)
  }

  /**
   * Assess health situation and eat food if needed.
   * Returns true if food was eaten this tick (caller should skip other actions).
   *
   * Decision logic is contextual:
   * - In combat: eat when health drops below 50% (urgent)
   * - Out of combat: eat when health below 70% (proactive recovery)
   * - Don't waste high-value food on small damage (pick lowest heal that covers the gap)
   * - Don't eat at full health
   */
  public async assessAndEat(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): Promise<boolean> {
    const { health, maxHealth, inCombat } = gameState;
    if (maxHealth <= 0) return false;

    const healthPercent = health / maxHealth;
    // Cooldown is shorter in combat and can be bypassed at critical HP.
    const EAT_COOLDOWN_MS = inCombat ? 6000 : 12000;
    const criticalInCombat = inCombat && healthPercent <= 0.25;
    if (!criticalInCombat && Date.now() - instance.lastAteAt < EAT_COOLDOWN_MS)
      return false;

    const missingHp = maxHealth - health;

    if (missingHp < 2) return false;

    // Decide threshold based on situation
    const eatThreshold = inCombat ? 0.5 : 0.7;
    if (healthPercent >= eatThreshold) return false;

    // Find food in inventory
    const inventory = instance.service.getInventoryItems();
    if (inventory.length === 0) return false;

    // Score each food item: prefer the smallest heal that covers the gap
    // (don't waste a shark healing 20hp when we only need 3hp)
    let bestFood: { itemId: string; healAmount: number; slot: number } | null =
      null;

    for (const slot of inventory) {
      const itemData = getItem(slot.itemId);
      if (!itemData) continue;

      const healAmount = (itemData as unknown as Record<string, unknown>)
        .healAmount as number | undefined;
      if (!healAmount || healAmount <= 0) continue;

      if (!bestFood) {
        bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
        continue;
      }

      // Prefer food that covers the gap without over-healing too much
      const bestOverheal = Math.max(0, bestFood.healAmount - missingHp);
      const thisOverheal = Math.max(0, healAmount - missingHp);

      if (thisOverheal < bestOverheal) {
        bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
      } else if (
        thisOverheal === bestOverheal &&
        healAmount > bestFood.healAmount
      ) {
        // Same efficiency — pick the bigger heal
        bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
      }
    }

    if (!bestFood) return false;

    console.log(
      `[AgentManager] ${instance.config.name} eating ${bestFood.itemId} (hp: ${health}/${maxHealth}, heal: ${bestFood.healAmount})`,
    );
    await instance.service.executeUse(bestFood.itemId);
    instance.lastAteAt = Date.now();
    return true;
  }

  /**
   * Inspect inventory and equip the best gear available.
   * Runs every tick — handles: server restarts, new loot pickups,
   * quest reward items, and any other inventory changes.
   *
   * Reads directly from InventorySystem and EquipmentSystem
   * (entity data.inventory is unreliable — often empty).
   */
  public async manageEquipment(
    instance: AgentInstance,
    _gameState: EmbeddedGameState,
  ): Promise<void> {
    // Read real inventory from InventorySystem (not entity data)
    const inventory = instance.service.getInventoryItems();
    if (inventory.length === 0) return;

    // Read real equipment from EquipmentSystem
    const equipped = instance.service.getEquippedItems();

    // --- WEAPON ---
    const equippedWeaponId = equipped.weapon || null;
    let bestWeapon: { itemId: string; score: number } | null = null;

    for (const slot of inventory) {
      const itemData = getItem(slot.itemId);
      if (!itemData) continue;
      if (itemData.equipSlot !== "weapon" && itemData.equipSlot !== "2h")
        continue;

      const bonuses = itemData.bonuses as Record<string, number> | undefined;
      const score = (bonuses?.attack || 0) + (bonuses?.strength || 0);

      if (!bestWeapon || score > bestWeapon.score) {
        bestWeapon = { itemId: slot.itemId, score };
      }
    }

    let equippedWeaponScore = 0;
    if (equippedWeaponId) {
      const d = getItem(equippedWeaponId);
      if (d) {
        const b = d.bonuses as Record<string, number> | undefined;
        equippedWeaponScore = (b?.attack || 0) + (b?.strength || 0);
      }
    }

    if (
      bestWeapon &&
      bestWeapon.score > equippedWeaponScore &&
      bestWeapon.itemId !== equippedWeaponId
    ) {
      console.log(
        `[AgentManager] ${instance.config.name} equipping weapon ${bestWeapon.itemId} (score ${bestWeapon.score} > ${equippedWeaponScore})`,
      );
      await instance.service.executeEquip(bestWeapon.itemId);
      return; // one equip per tick
    }

    // --- ARMOR SLOTS ---
    const armorSlots = [
      "helmet",
      "body",
      "legs",
      "shield",
      "boots",
      "gloves",
      "cape",
    ] as const;

    for (const slotName of armorSlots) {
      const equippedId = equipped[slotName] || null;

      let bestArmor: { itemId: string; score: number } | null = null;

      for (const slot of inventory) {
        const itemData = getItem(slot.itemId);
        if (!itemData) continue;
        if (itemData.equipSlot !== slotName) continue;

        const bonuses = itemData.bonuses as Record<string, number> | undefined;
        const score = (bonuses?.defense || 0) + (bonuses?.attack || 0);

        if (!bestArmor || score > bestArmor.score) {
          bestArmor = { itemId: slot.itemId, score };
        }
      }

      if (bestArmor) {
        let currentScore = 0;
        if (equippedId) {
          const d = getItem(equippedId);
          if (d) {
            const b = d.bonuses as Record<string, number> | undefined;
            currentScore = (b?.defense || 0) + (b?.attack || 0);
          }
        }

        if (bestArmor.score > currentScore && bestArmor.itemId !== equippedId) {
          console.log(
            `[AgentManager] ${instance.config.name} equipping ${bestArmor.itemId} in ${slotName} (score ${bestArmor.score} > ${currentScore})`,
          );
          await instance.service.executeEquip(bestArmor.itemId);
          return; // one equip per tick
        }
      }
    }
  }

  // ─── ACTION SELECTION ─────────────────────────────────────────────────

  /**
   * Decide the next behavior action for an agent.
   * Quest-aware: routes actions based on active quest objectives.
   * Key principle: ALWAYS do something productive. Never just wander aimlessly.
   */
  public pickBehaviorAction(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): EmbeddedBehaviorAction {
    const healthPercent =
      gameState.maxHealth > 0 ? gameState.health / gameState.maxHealth : 1;
    const position = gameState.position!;

    const nearbyItems = gameState.nearbyEntities
      .filter((entity) => entity.type === "item" && entity.distance <= 15)
      .sort((a, b) => a.distance - b.distance);

    const nearbyMobs = gameState.nearbyEntities
      .filter(
        (entity) =>
          entity.type === "mob" &&
          entity.distance <= 40 &&
          (entity.health === undefined || entity.health > 0),
      )
      .sort((a, b) => a.distance - b.distance);

    const nearbyResources = gameState.nearbyEntities
      .filter((entity) => entity.type === "resource" && entity.distance <= 45)
      .sort((a, b) => a.distance - b.distance);

    // Already fighting — let the combat system handle auto-attacks.
    if (gameState.inCombat) {
      return { type: "idle" };
    }

    // Gravestone recovery: if agent's own gravestone is nearby, walk to it and loot
    const gravestone = this.findOwnGravestone(instance, gameState);
    if (gravestone) {
      const dx = position[0] - gravestone.position[0];
      const dz = position[2] - gravestone.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 4) {
        return { type: "move", target: gravestone.position, runMode: true };
      }
      // Close enough — loot all items from gravestone
      return { type: "lootGravestone", gravestoneId: gravestone.id };
    }

    // Opportunistic loot pickup (skip if we just dropped something to avoid loop).
    if (nearbyItems.length > 0 && Date.now() > instance.dropCooldownUntil) {
      return { type: "pickup", targetId: nearbyItems[0].id };
    }

    const goal = instance.goal;

    // === QUEST-DRIVEN BEHAVIOR ===
    if (goal?.type === "questing" && goal.questId) {
      const questAction = this.pickQuestAction(
        instance,
        position,
        nearbyMobs,
        nearbyResources,
        healthPercent,
      );
      if (questAction) return questAction;
    }

    // === DEFAULT: fight anything nearby, or return to spawn ===
    return this.pickCombatOrExplore(
      instance,
      position,
      nearbyMobs,
      nearbyResources,
      healthPercent,
    );
  }

  /**
   * Pick the best action for the agent's current quest objective.
   * Returns null if quest state doesn't dictate a specific action
   * (caller should fall through to default combat).
   */
  public pickQuestAction(
    instance: AgentInstance,
    position: [number, number, number],
    nearbyMobs: NearbyEntityData[],
    nearbyResources: NearbyEntityData[],
    healthPercent: number,
  ): EmbeddedBehaviorAction | null {
    const goal = instance.goal!;
    const activeQuests = instance.service.getQuestState();
    const activeQuest = activeQuests.find((q) => q.questId === goal.questId);

    // Quest not yet accepted — walk to NPC, then accept
    if (!activeQuest && !instance.questsAccepted.has(goal.questId!)) {
      return this.moveToNpcOrAccept(
        instance,
        position,
        goal.questId!,
        goal.questStartNpc,
      );
    }

    // Quest is ready to complete — walk to NPC, then turn in
    if (activeQuest?.status === "ready_to_complete") {
      return this.moveToNpcOrComplete(instance, position, activeQuest);
    }

    // Quest in progress — route by stage type
    if (activeQuest?.status === "in_progress") {
      const stageType = activeQuest.stageType;
      const stageTarget = activeQuest.stageTarget || "";

      // Dialogue stages (e.g., "return to NPC") — walk to NPC and complete
      if (stageType === "dialogue") {
        return this.moveToNpcOrComplete(instance, position, activeQuest);
      }

      if (stageType === "kill") {
        const characterId = instance.service.getPlayerId() || "";
        const targetMob = this.findMobForQuest(
          characterId,
          nearbyMobs,
          stageTarget,
        );
        if (targetMob && healthPercent > 0.4) {
          instance.currentTargetId = targetMob.id;
          return { type: "attack", targetId: targetMob.id };
        }
        instance.currentTargetId = null;
        return this.moveTowardSpawn(instance, position);
      }

      if (stageType === "gather") {
        const resource = this.findResourceForQuest(
          nearbyResources,
          stageTarget,
        );
        if (resource) {
          const rdx = position[0] - resource.position[0];
          const rdz = position[2] - resource.position[2];
          const dist2d = Math.sqrt(rdx * rdx + rdz * rdz);

          if (dist2d < 4) {
            // Close enough — queue gather via PendingGatherManager.
            // Cooldown prevents re-queuing the same resource (which cancels the walk).
            const GATHER_REQUEUE_COOLDOWN = 30000;
            if (
              instance.lastGatherTargetId === resource.id &&
              Date.now() - instance.lastGatherQueuedAt < GATHER_REQUEUE_COOLDOWN
            ) {
              return { type: "idle" };
            }
            console.log(
              `[AgentManager] ${instance.config.name} gathering ${resource.name || resource.id} for quest`,
            );
            instance.lastGatherTargetId = resource.id;
            instance.lastGatherQueuedAt = Date.now();
            return { type: "gather", targetId: resource.id };
          }

          // Too far — move toward the resource
          return {
            type: "move",
            target: [resource.position[0], position[1], resource.position[2]],
            runMode: false,
          };
        }
        // No resources nearby — navigate toward known tree areas
        return this.moveTowardResourceArea(instance, position, stageTarget);
      }

      if (stageType === "interact") {
        // Interact stages: firemaking, cooking, smelting, etc.
        // Determine action based on target keyword
        if (stageTarget === "fire") {
          // Firemaking: need tinderbox + logs in inventory
          const inventory = instance.service.getInventoryItems();
          const hasTinderbox = inventory.some((i) => i.itemId === "tinderbox");
          const logTypes = [
            "logs",
            "oak_logs",
            "willow_logs",
            "teak_logs",
            "maple_logs",
          ];
          const logsItem = inventory.find((i) => logTypes.includes(i.itemId));

          if (hasTinderbox && logsItem) {
            return { type: "firemake", logsItemId: logsItem.itemId };
          }

          // No logs — need to gather some first. Find a nearby tree.
          const tree = this.findResourceForQuest(nearbyResources, "logs");
          if (tree) {
            const rdx = position[0] - tree.position[0];
            const rdz = position[2] - tree.position[2];
            const dist2d = Math.sqrt(rdx * rdx + rdz * rdz);
            if (dist2d < 4) {
              return { type: "gather", targetId: tree.id };
            }
            return {
              type: "move",
              target: [tree.position[0], position[1], tree.position[2]],
              runMode: false,
            };
          }
          // No trees nearby — move toward known tree areas
          return this.moveTowardResourceArea(instance, position, "logs");
        }

        // Other interact types (cooking, smelting) — fall through to combat for now
      }
    }

    return null;
  }

  /**
   * Find a mob for this agent's kill quest. Spreads agents across different
   * mobs so they don't all pile on the same one (only the killing blow
   * gets quest credit).
   */
  public findMobForQuest(
    agentId: string,
    nearbyMobs: NearbyEntityData[],
    stageTarget: string,
  ): NearbyEntityData | undefined {
    if (nearbyMobs.length === 0) return undefined;

    const target = stageTarget.toLowerCase();

    // Filter to mobs matching the quest target
    const matchingMobs = nearbyMobs.filter((m) => {
      const name = (m.name || "").toLowerCase();
      const mType = (m.mobType || "").toLowerCase();
      return (
        name.includes(target) ||
        mType.includes(target) ||
        target.includes(name) ||
        target.includes(mType)
      );
    });
    const candidates = matchingMobs.length > 0 ? matchingMobs : nearbyMobs;

    // Collect mob IDs already targeted by other agents
    const takenTargets = new Set<string>();
    for (const id of this.getAllAgentIds()) {
      if (id !== agentId) {
        const inst = this.getAgent(id);
        if (inst?.currentTargetId) {
          takenTargets.add(inst.currentTargetId);
        }
      }
    }

    // Prefer a mob nobody else is targeting
    const untargeted = candidates.find((m) => !takenTargets.has(m.id));
    if (untargeted) return untargeted;

    // All mobs are taken — pick the one with fewest agents on it
    const targetCounts = new Map<string, number>();
    for (const id of this.getAllAgentIds()) {
      if (id !== agentId) {
        const inst = this.getAgent(id);
        if (inst?.currentTargetId) {
          targetCounts.set(
            inst.currentTargetId,
            (targetCounts.get(inst.currentTargetId) || 0) + 1,
          );
        }
      }
    }
    candidates.sort(
      (a, b) => (targetCounts.get(a.id) || 0) - (targetCounts.get(b.id) || 0),
    );

    return candidates[0];
  }

  public findResourceForQuest(
    nearbyResources: NearbyEntityData[],
    stageTarget: string,
  ): NearbyEntityData | undefined {
    const keywords = this.getResourceKeywords(stageTarget);
    const matches = nearbyResources.filter((r) => {
      const haystack = `${(r.name || "").toLowerCase()} ${(r.resourceType || "").toLowerCase()}`;
      return keywords.some((kw) => haystack.includes(kw));
    });
    if (matches.length === 0) return undefined;

    // Prefer basic resources (level 1) — e.g. "Tree" over "Oak Tree" / "Maple Tree"
    // Basic resources have shorter names and lower IDs (tree_normal vs tree_oak)
    const basic = matches.find((r) => {
      const name = (r.name || "").toLowerCase();
      return (
        name === "tree" ||
        name === "rock" ||
        name === "fishing spot" ||
        (r.resourceType || "").includes("normal")
      );
    });
    return basic || matches[0];
  }

  public moveToNpcOrAccept(
    instance: AgentInstance,
    position: [number, number, number],
    questId: string,
    questStartNpc?: string,
  ): EmbeddedBehaviorAction {
    if (questStartNpc) {
      const npcPositions = instance.service.getAllNPCPositions();
      const npc = npcPositions.find(
        (n) =>
          n.npcId === questStartNpc ||
          n.name
            .toLowerCase()
            .includes(questStartNpc.replace(/_/g, " ").toLowerCase()),
      );
      if (npc) {
        const dx = position[0] - npc.position[0];
        const dz = position[2] - npc.position[2];
        if (Math.sqrt(dx * dx + dz * dz) > 6) {
          return { type: "move", target: npc.position, runMode: false };
        }
      }
    }
    return { type: "questAccept", questId };
  }

  public moveToNpcOrComplete(
    instance: AgentInstance,
    position: [number, number, number],
    activeQuest: AgentQuestProgress,
  ): EmbeddedBehaviorAction {
    const npcPositions = instance.service.getAllNPCPositions();
    const startNpc = activeQuest.startNpc;
    const npc = npcPositions.find(
      (n) =>
        n.npcId === startNpc ||
        n.name
          .toLowerCase()
          .includes(startNpc.replace(/_/g, " ").toLowerCase()),
    );
    if (npc) {
      const dx = position[0] - npc.position[0];
      const dz = position[2] - npc.position[2];
      if (Math.sqrt(dx * dx + dz * dz) > 6) {
        return { type: "move", target: npc.position, runMode: false };
      }
    }
    return { type: "questComplete", questId: activeQuest.questId };
  }

  /**
   * Navigate toward an area where the target resource might be found.
   */
  public moveTowardResourceArea(
    instance: AgentInstance,
    position: [number, number, number],
    stageTarget: string,
  ): EmbeddedBehaviorAction {
    const keywords = this.getResourceKeywords(stageTarget);
    const world = instance.service.getWorld();
    let bestPos: [number, number, number] | null = null;
    let bestDist = Infinity;

    for (const [, entity] of world.entities.items.entries()) {
      const data = (entity as { data?: Record<string, unknown> }).data;
      if (!data || data.depleted === true) continue;

      const haystack =
        `${String(data.name || "").toLowerCase()} ${String(data.resourceType || "").toLowerCase()} ${String(data.type || "").toLowerCase()}`.trim();
      if (!keywords.some((kw) => haystack.includes(kw))) continue;

      const entityPos = this.getWorldEntityPosition(
        entity as { position?: unknown; data?: Record<string, unknown> },
      );
      if (!entityPos) continue;

      const dx = position[0] - entityPos[0];
      const dz = position[2] - entityPos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = entityPos;
      }
    }

    if (bestPos) {
      return {
        type: "move",
        target: [bestPos[0], position[1], bestPos[2]],
        runMode: false,
      };
    }

    return this.moveTowardSpawn(instance, position);
  }

  /**
   * Default behavior: fight nearby mobs, or head back to spawn.
   */
  public pickCombatOrExplore(
    instance: AgentInstance,
    position: [number, number, number],
    nearbyMobs: NearbyEntityData[],
    nearbyResources: NearbyEntityData[],
    healthPercent: number,
  ): EmbeddedBehaviorAction {
    if (nearbyMobs.length > 0 && healthPercent > 0.5) {
      const agentId = instance.service.getPlayerId() || "";
      const target = this.findMobForQuest(agentId, nearbyMobs, "goblin");
      if (target) {
        instance.currentTargetId = target.id;
        return { type: "attack", targetId: target.id };
      }
      return { type: "attack", targetId: nearbyMobs[0].id };
    }
    if (nearbyResources.length > 0) {
      return { type: "gather", targetId: nearbyResources[0].id };
    }
    return this.moveTowardSpawn(instance, position);
  }

  // ─── WORLD HELPERS ────────────────────────────────────────────────────

  /**
   * Find a gravestone belonging to this agent that's nearby.
   * Returns the gravestone entity data if found, null otherwise.
   */
  public findOwnGravestone(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): { id: string; position: [number, number, number] } | null {
    const playerId = instance.service.getPlayerId();
    if (!playerId) return null;

    // Scan nearby entities for gravestones (type "object" with name containing the player ID)
    for (const entity of gameState.nearbyEntities) {
      if (entity.type !== "object") continue;
      const name = (entity.name || "").toLowerCase();
      const id = entity.id || "";

      // Gravestone IDs are formatted as "gravestone_<playerId>_<timestamp>"
      if (id.includes("gravestone") && id.includes(playerId)) {
        return { id: entity.id, position: entity.position };
      }
      if (name.includes("gravestone") && name.includes(playerId)) {
        return { id: entity.id, position: entity.position };
      }
    }

    return null;
  }

  /**
   * Move the agent toward a dynamically discovered hub area (goblins/chest/bank).
   */
  public moveTowardSpawn(
    instance: AgentInstance,
    position: [number, number, number],
  ): EmbeddedBehaviorAction {
    const [px, , pz] = position;
    const world = instance.service.getWorld();
    let anchor: [number, number, number] | null = null;
    let anchorDist = Infinity;

    for (const [, entity] of world.entities.items.entries()) {
      const data = (entity as { data?: Record<string, unknown> }).data;
      if (!data) continue;
      const name = String(data.name || "").toLowerCase();
      const isAnchor =
        name.includes("starter chest") ||
        name.includes("goblin") ||
        name.includes("bank") ||
        name.includes("spawn") ||
        name.includes("start");
      if (!isAnchor) continue;

      const entityPos = this.getWorldEntityPosition(
        entity as { position?: unknown; data?: Record<string, unknown> },
      );
      if (!entityPos) continue;

      const dx = entityPos[0] - px;
      const dz = entityPos[2] - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < anchorDist) {
        anchorDist = dist;
        anchor = entityPos;
      }
    }

    if (anchor && anchorDist > 25) {
      const angle =
        Math.atan2(anchor[2] - pz, anchor[0] - px) +
        (Math.random() - 0.5) * 0.4;
      const step = Math.min(20, Math.max(10, anchorDist * 0.4));
      return {
        type: "move",
        target: [
          px + Math.cos(angle) * step,
          position[1],
          pz + Math.sin(angle) * step,
        ] as [number, number, number],
        runMode: false,
      };
    }

    if (anchor) {
      return {
        type: "move",
        target: this.getRandomNearbyTarget(
          [anchor[0], position[1], anchor[2]],
          8,
          18,
        ),
        runMode: false,
      };
    }

    return {
      type: "move",
      target: this.getRandomNearbyTarget(position, 8, 18),
      runMode: false,
    };
  }

  public getWorldEntityPosition(entity: {
    position?: unknown;
    data?: Record<string, unknown>;
  }): [number, number, number] | null {
    const directPos = entity.position;
    if (Array.isArray(directPos) && directPos.length >= 3) {
      return [directPos[0], directPos[1], directPos[2]];
    }
    if (
      directPos &&
      typeof directPos === "object" &&
      "x" in directPos &&
      "z" in directPos
    ) {
      const p = directPos as { x: number; y?: number; z: number };
      return [p.x, p.y ?? 0, p.z];
    }

    const dataPos = entity.data?.position;
    if (Array.isArray(dataPos) && dataPos.length >= 3) {
      return [dataPos[0] as number, dataPos[1] as number, dataPos[2] as number];
    }
    if (
      dataPos &&
      typeof dataPos === "object" &&
      "x" in dataPos &&
      "z" in dataPos
    ) {
      const p = dataPos as { x: number; y?: number; z: number };
      return [p.x, p.y ?? 0, p.z];
    }
    return null;
  }

  /**
   * Map quest gather targets to resource keywords that match world entities.
   * Quest targets use item IDs (e.g., "logs", "raw_shrimp", "copper_ore")
   * but world resources use different names (e.g., "tree", "fishing_spot", "rock").
   */
  public getResourceKeywords(stageTarget: string): string[] {
    const target = stageTarget.toLowerCase();
    const keywords = [target];

    if (target.includes("log") || target.includes("wood")) {
      keywords.push("tree", "oak", "willow", "maple", "yew");
    }
    if (
      target.includes("shrimp") ||
      target.includes("fish") ||
      target.includes("trout") ||
      target.includes("salmon")
    ) {
      keywords.push("fishing", "spot", "fishing_spot");
    }
    if (
      target.includes("ore") ||
      target.includes("copper") ||
      target.includes("tin") ||
      target.includes("iron") ||
      target.includes("coal")
    ) {
      keywords.push("rock", "ore", "mining");
    }
    if (target.includes("essence")) {
      keywords.push("essence", "rune", "altar");
    }

    return keywords;
  }

  /**
   * Choose a random nearby movement target.
   */
  public getRandomNearbyTarget(
    origin: [number, number, number],
    minDistance: number,
    maxDistance: number,
  ): [number, number, number] {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    const x = origin[0] + Math.cos(angle) * distance;
    const z = origin[2] + Math.sin(angle) * distance;

    // Keep current Y to avoid abrupt vertical jumps.
    return [x, origin[1], z];
  }

  // ─── COMBAT CHAT ──────────────────────────────────────────────────────

  /**
   * Handle combat damage events to queue chat reactions for agents.
   * Should be called from the AgentManager's EventType.COMBAT_DAMAGE_DEALT listener.
   */
  public handleCombatDamageDealt(data: unknown): void {
    const payload = data as {
      attackerId: string;
      targetId: string;
      damage: number;
    };

    const { attackerId, targetId, damage } = payload;
    const now = Date.now();

    // Check if attacker is an agent
    const attackerInstance = this.getAgent(attackerId);
    if (attackerInstance && attackerInstance.state === "running") {
      // Check if this was a critical hit dealt
      const targetEntity = this.world.entities.get(targetId);
      const targetData = targetEntity?.data as {
        maxHealth?: number;
        health?: number;
        name?: string;
      };

      if (
        targetData?.maxHealth &&
        damage >= targetData.maxHealth * CRITICAL_HIT_THRESHOLD
      ) {
        // Agent dealt a critical hit
        if (now - attackerInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
          attackerInstance.pendingChatReaction = {
            type: "critical_hit_dealt",
            opponentName: targetData.name || "opponent",
            timestamp: now,
          };
        }
      }

      // Check if target is near death (victory imminent)
      if (targetData?.health && targetData?.maxHealth) {
        const remainingHealthPercent = targetData.health / targetData.maxHealth;
        if (remainingHealthPercent <= NEAR_DEATH_THRESHOLD && damage > 0) {
          if (now - attackerInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
            attackerInstance.pendingChatReaction = {
              type: "victory_imminent",
              opponentName: targetData.name || "opponent",
              timestamp: now,
            };
          }
        }
      }
    }

    // Check if target is an agent
    const targetInstance = this.getAgent(targetId);
    if (targetInstance && targetInstance.state === "running") {
      const attackerEntity = this.world.entities.get(attackerId);
      const attackerData = attackerEntity?.data as { name?: string };
      const opponentName = attackerData?.name || "opponent";

      const targetEntity = this.world.entities.get(targetId);
      const targetData = targetEntity?.data as {
        maxHealth?: number;
        health?: number;
      };

      // Check if this was a critical hit taken
      if (
        targetData?.maxHealth &&
        damage >= targetData.maxHealth * CRITICAL_HIT_THRESHOLD
      ) {
        if (now - targetInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
          targetInstance.pendingChatReaction = {
            type: "critical_hit_taken",
            opponentName,
            timestamp: now,
          };
        }
      }

      // Check if agent is near death
      if (targetData?.health && targetData?.maxHealth) {
        const remainingHealthPercent = targetData.health / targetData.maxHealth;
        if (remainingHealthPercent <= NEAR_DEATH_THRESHOLD) {
          if (now - targetInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
            targetInstance.pendingChatReaction = {
              type: "near_death",
              opponentName,
              timestamp: now,
            };
          }
        }
      }
    }
  }

  /**
   * Get a scripted chat response for a combat reaction
   */
  public getCombatChatResponse(reaction: PendingChatReaction): string {
    const responses: Record<CombatChatReactionType, string[]> = {
      critical_hit_dealt: [
        "That's gonna leave a mark!",
        "Feel the power!",
        "You're going down!",
        "How'd you like that one?",
        "Boom! Direct hit!",
      ],
      critical_hit_taken: [
        "Ouch! Lucky shot!",
        "Is that all you got?",
        "This isn't over!",
        "You'll pay for that!",
        "Okay, now I'm mad!",
      ],
      near_death: [
        "I'm not done yet!",
        "Come on, one more hit...",
        "Getting dangerous...",
        "This is intense!",
        "Need to focus...",
      ],
      victory_imminent: [
        "Time to finish this!",
        "Any last words?",
        "GG!",
        "Victory is mine!",
        "Almost there!",
      ],
    };

    const options = responses[reaction.type];
    return options[Math.floor(Math.random() * options.length)];
  }
}
