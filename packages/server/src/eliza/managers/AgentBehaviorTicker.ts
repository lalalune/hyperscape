import { appendFileSync } from "fs";
const _debugLog = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    appendFileSync("/tmp/destiny-debug.log", line);
  } catch {
    /* ignore */
  }
};

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
  AgentQuestInfo,
} from "../types.js";
import type { EmbeddedHyperscapeService } from "../EmbeddedHyperscapeService.js";

/**
 * Active goal for an embedded agent (visible on dashboard)
 */
export interface AgentGoal {
  type: "questing" | "combat" | "gathering" | "idle" | "skilling";
  description: string;
  questId?: string;
  questName?: string;
  questStageType?: string;
  questStageTarget?: string;
  questStageCount?: number;
  questStartNpc?: string;
  /** Post-quest skill grind: specific activity code (e.g. "mine_iron", "fight_guards") */
  skillingActivity?: string;
  /** Post-quest skill grind: which skill is being trained */
  skillingTargetSkill?: string;
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
  /** Timestamp when a gather SESSION was started (used for the 65s manageInventory suppression window) */
  lastGatherSessionStartAt: number;
  /** Pending chat reaction from combat event (processed on next behavior tick) */
  pendingChatReaction: PendingChatReaction | null;
  /** Timestamp of last combat chat to prevent spam */
  lastCombatChatAt: number;
  /** Timestamp of last player chat response (prevents reply spam) */
  lastPlayerChatResponseAt: number;
  /** Timestamp of last ambient personality chat */
  lastAmbientChatAt: number;
  /** Timestamp when the current goal was last set or changed */
  goalSetAt: number;
  /** Key identifying the current goal — used to detect when goal changes */
  lastGoalKey: string;
  /** LLM quest selection decision cache (avoids calling Claude every tick) */
  llmQuestDecision: {
    questId: string;
    reason: string;
    expiresAt: number;
  } | null;
  /** LLM free-time activity decision cache */
  llmFreeTimeDecision: {
    activity: "combat" | "gather" | "explore";
    reason: string;
    expiresAt: number;
  } | null;
  /** LLM post-quest skill grind decision cache (5 min TTL) */
  llmSkillGrindDecision: {
    activity: string;
    targetSkill: string;
    targetLevel: number;
    reason: string;
    expiresAt: number;
  } | null;
  /** Timestamp of last passive HP regen tick (out-of-combat recovery) */
  lastRegenAt: number;
  /** Track repeated failed pickups to avoid infinite loops */
  lastPickupTargetId: string | null;
  lastPickupAttemptAt: number;
  pickupAttemptCount: number;
  /** Suppress gravestone looting until this timestamp (give up after repeated failures) */
  gravestoneSkipUntil: number;
  gravestoneLootAttempts: number;
  /** Timestamp of last attack command issued (to avoid cancel-requeue loop) */
  lastAttackCommandAt: number;
  /** Target ID of the last attack command (for cancel-requeue loop check) */
  lastAttackCommandTargetId: string | null;
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
  | { type: "cook"; fireId: string; rawFoodId: string }
  | { type: "smelt"; recipe: string }
  | { type: "smith"; recipe: string }
  | { type: "runecraft"; altarId: string; runeType: string }
  | { type: "craft"; recipeId: string }
  | { type: "fletch"; recipeId: string }
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

// ─── EQUIPMENT TIER PROGRESSION ──────────────────────────────────────────────

/** Gear tier data: what level to equip, what to smith, what ore to mine */
const EQUIPMENT_TIERS = [
  {
    tier: "bronze",
    attackReq: 1,
    defReq: 1,
    smithingReq: 1,
    smeltRecipe: "bronze_bar",
    smithRecipe: "bronze_shortsword",
    oreA: "copper_ore",
    oreB: "tin_ore",
    miningReq: 1,
  },
  {
    tier: "iron",
    attackReq: 1,
    defReq: 1,
    smithingReq: 19,
    smeltRecipe: "iron_bar",
    smithRecipe: "iron_shortsword",
    oreA: "iron_ore",
    oreB: null,
    miningReq: 15,
  },
  {
    tier: "steel",
    attackReq: 5,
    defReq: 5,
    smithingReq: 34,
    smeltRecipe: "steel_bar",
    smithRecipe: "steel_shortsword",
    oreA: "iron_ore",
    oreB: "coal",
    miningReq: 30,
  },
  {
    tier: "mithril",
    attackReq: 20,
    defReq: 20,
    smithingReq: 54,
    smeltRecipe: "mithril_bar",
    smithRecipe: "mithril_shortsword",
    oreA: "mithril_ore",
    oreB: "coal",
    miningReq: 55,
  },
  {
    tier: "adamant",
    attackReq: 30,
    defReq: 30,
    smithingReq: 74,
    smeltRecipe: "adamant_bar",
    smithRecipe: "adamant_shortsword",
    oreA: "adamantite_ore",
    oreB: "coal",
    miningReq: 70,
  },
  {
    tier: "rune",
    attackReq: 40,
    defReq: 40,
    smithingReq: 89,
    smeltRecipe: "rune_bar",
    smithRecipe: "rune_shortsword",
    oreA: "runite_ore",
    oreB: "coal",
    miningReq: 85,
  },
] as const;

/** Best mob name to fight at a given effective combat level */
function getBestCombatTarget(combatLevel: number): string {
  if (combatLevel >= 30) return "dark_ranger";
  if (combatLevel >= 21) return "guard";
  if (combatLevel >= 14) return "barbarian";
  if (combatLevel >= 7) return "bandit";
  return "goblin";
}

/** Best ore to mine at a given mining level */
function getBestOreToMine(miningLevel: number): string {
  if (miningLevel >= 70) return "adamantite_ore";
  if (miningLevel >= 55) return "mithril_ore";
  if (miningLevel >= 30) return "coal";
  if (miningLevel >= 15) return "iron_ore";
  return "copper_ore";
}

/** Best tree type to chop at a given woodcutting level */
function getBestTreeToChop(wcLevel: number): string {
  if (wcLevel >= 30) return "willow_logs";
  if (wcLevel >= 15) return "oak_logs";
  return "logs";
}

/** Detect current equipped weapon tier (bronze/iron/steel/…/rune) */
function getEquippedWeaponTier(equippedWeaponId: string): string {
  for (const { tier } of [...EQUIPMENT_TIERS].reverse()) {
    if (equippedWeaponId.includes(tier)) return tier;
  }
  return "none";
}

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
      const current = this.getAgent(characterId);
      if (!current || current.state !== "running") {
        return;
      }

      try {
        await this.executeBehaviorTick(characterId);
      } catch (err) {
        console.warn(
          `[AgentManager] Behavior tick failed for ${characterId}: ${errMsg(err)}`,
          err instanceof Error ? err.stack : err,
        );
      } finally {
        tickInProgress = false;
      }
    };

    let tickInProgress = false;
    let tickCount = 0;
    instance.behaviorInterval = setInterval(() => {
      if (tickInProgress) return;
      tickInProgress = true;
      tickCount++;
      void runTick();
    }, EMBEDDED_BEHAVIOR_TICK_INTERVAL);

    // Delay the first tick so PLAYER_REGISTERED has time to fire and
    // QuestSystem can load the player's quest state from the database.
    setTimeout(() => void runTick(), 3000);

    // Subscribe to UI_MESSAGE errors from ResourceSystem so we can detect
    // gather failures (level too low, missing tool) and reset the goal.
    const uiMessageHandler = (data: unknown) => {
      const msg = data as {
        playerId?: string;
        type?: string;
        message?: string;
      };
      if (msg.playerId !== characterId) return;
      if (msg.type !== "error") return;
      const text = msg.message || "";
      const isGatherError =
        text.includes("level") ||
        text.includes("need a") ||
        text.includes("harvest") ||
        text.includes("tool");
      if (!isGatherError) return;
      const cur = this.getAgent(characterId);
      if (!cur) return;
      if (cur.goal?.type === "gathering") {
        console.warn(
          `[AgentBehaviorTicker] ${characterId} gather failed (${text}); switching to combat/explore for 2 min`,
        );
        cur.goal = null;
        cur.llmFreeTimeDecision = {
          activity: "combat",
          reason: "Gather failed — switching to combat",
          expiresAt: Date.now() + 120_000,
        };
      }
      if (cur.goal?.type === "skilling") {
        console.warn(
          `[AgentBehaviorTicker] ${characterId} skilling gather failed (${text}); re-evaluating skill grind`,
        );
        // Clear the LLM decision so a new activity is chosen next tick
        cur.llmSkillGrindDecision = null;
        cur.goal = null;
      }
    };
    this.world.on(EventType.UI_MESSAGE, uiMessageHandler);
    // Store handler on the interval so stopBehaviorLoop can clean it up
    (
      instance.behaviorInterval as unknown as {
        _uiMessageHandler?: typeof uiMessageHandler;
        _world?: typeof this.world;
      }
    )._uiMessageHandler = uiMessageHandler;
    (
      instance.behaviorInterval as unknown as {
        _uiMessageHandler?: typeof uiMessageHandler;
        _world?: typeof this.world;
      }
    )._world = this.world;
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
      // Clean up the UI_MESSAGE subscription attached during startBehaviorLoop
      const iv = instance.behaviorInterval as unknown as {
        _uiMessageHandler?: (data: unknown) => void;
        _world?: { off?: (event: string, fn: (data: unknown) => void) => void };
      };
      if (iv._uiMessageHandler && iv._world?.off) {
        iv._world.off(EventType.UI_MESSAGE, iv._uiMessageHandler);
      }
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
      _debugLog(
        `TICK_SKIP no_instance_or_state state=${instance?.state} id=${characterId}`,
      );
      return;
    }

    const entity = this.world.entities.get(characterId);

    if (recoverAgentFromDeathLoop(this.world, characterId, "AgentManager")) {
      instance.lastActivity = Date.now();
      _debugLog(`TICK_SKIP death_loop_recovery name=${instance.config.name}`);
      return;
    }

    if (ejectAgentFromCombatArena(this.world, characterId, "AgentManager")) {
      instance.lastActivity = Date.now();
      _debugLog(`TICK_SKIP ejected_from_arena name=${instance.config.name}`);
      return;
    }

    const inStreamingDuel =
      (entity?.data as { inStreamingDuel?: boolean } | undefined)
        ?.inStreamingDuel === true;

    if (inStreamingDuel) {
      _debugLog(`TICK_SKIP streaming_duel name=${instance.config.name}`);
      return;
    }

    const gameState = instance.service.getGameState();
    if (!gameState || !gameState.position) {
      const svc = instance.service as unknown as Record<string, unknown>;
      _debugLog(
        `TICK_SKIP no_gamestate name=${instance.config.name} playerId=${svc.playerEntityId} isActive=${svc.isActive} hasEntity=${!!entity}`,
      );
      return;
    }
    _debugLog(
      `TICK_OK name=${instance.config.name} pos=[${gameState.position.map((n) => n.toFixed(1)).join(",")}] inCombat=${gameState.inCombat} goal=${instance.goal?.type}:${instance.goal?.description?.slice(0, 30)} smithing=${gameState.skills?.smithing?.level ?? 1} mining=${gameState.skills?.mining?.level ?? 1}`,
    );

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

    // === PLAYER CHAT RESPONSE ===
    // Respond to nearby players who address DESTINY or ask a question
    const PLAYER_CHAT_COOLDOWN = 20000; // 20s between responses
    if (Date.now() - instance.lastPlayerChatResponseAt > PLAYER_CHAT_COOLDOWN) {
      const localChats = instance.service.getLocalChatMessages();
      const triggering = localChats.find((m) => {
        const age = Date.now() - m.timestamp;
        if (age > 25000) return false; // only last 25s
        const text = m.text.toLowerCase();
        return (
          text.includes("destiny") ||
          text.startsWith("hi ") ||
          text.startsWith("hey ") ||
          text.startsWith("hello") ||
          text.includes("?")
        );
      });
      if (triggering) {
        try {
          const reply = this.getPlayerChatResponse(
            triggering.text,
            triggering.from,
          );
          await instance.service.sendChatMessage(reply);
          instance.lastPlayerChatResponseAt = Date.now();
          instance.lastCombatChatAt = Date.now();
        } catch (_err) {
          // chat failure is non-critical
        }
      }
    }

    // === AMBIENT PERSONALITY CHAT ===
    // Occasionally broadcast an in-character comment about current activity
    const AMBIENT_CHAT_INTERVAL = 90000; // every 90s
    if (Date.now() - instance.lastAmbientChatAt > AMBIENT_CHAT_INTERVAL) {
      try {
        const ambientMsg = this.getAmbientChatMessage(instance);
        if (ambientMsg) {
          await instance.service.sendChatMessage(ambientMsg);
          instance.lastAmbientChatAt = Date.now();
        }
      } catch (_err) {
        // chat failure is non-critical
      }
    }

    // === GOAL STUCK DETECTION ===
    // If the same goal has been active without clearing, it's probably stuck.
    // Gather+interact stages get 120s (interact stages like cook_shrimp internally gather fish
    // which takes multiple ticks); pure freetime/combat stages get 30s.
    const isGatherStage =
      instance.goal?.questStageType === "gather" ||
      instance.goal?.type === "gathering";
    const isInteractStage = instance.goal?.questStageType === "interact";
    const isKillStage = instance.goal?.questStageType === "kill";
    const isSkillingGoal = instance.goal?.type === "skilling";
    const GOAL_STUCK_TIMEOUT_MS = isInteractStage
      ? 240_000
      : isGatherStage
        ? 120_000
        : isKillStage
          ? 300_000
          : isSkillingGoal
            ? 600_000
            : 30_000;
    if (instance.goal) {
      const goalKey = `${instance.goal.type}:${instance.goal.questId ?? ""}:${instance.goal.questStageType ?? ""}`;
      if (goalKey !== instance.lastGoalKey) {
        instance.lastGoalKey = goalKey;
        instance.goalSetAt = Date.now();
      } else if (Date.now() - instance.goalSetAt > GOAL_STUCK_TIMEOUT_MS) {
        console.warn(
          `[AgentManager] ${instance.config.name} goal stuck for ${Math.round((Date.now() - instance.goalSetAt) / 1000)}s — resetting: "${instance.goal.description}"`,
        );
        // Clear LLM decision cache so a fresh decision is made after reset
        if (instance.goal.type === "skilling") {
          instance.llmSkillGrindDecision = null;
        }
        instance.goal = null;
        instance.lastGoalKey = "";
        instance.goalSetAt = Date.now();
      }
    }

    // === QUEST MANAGEMENT ===
    await this.manageQuests(instance);

    // === FREE TIME: LLM decides combat/gather/explore when no active quests ===
    if (!instance.goal) {
      await this.manageFreeTime(instance, gameState);
    }

    // === INVENTORY MANAGEMENT ===
    // ITEM_DROP events cancel active gather sessions, so suppress manageInventory
    // whenever a gather session was recently started. Use a 65s window (30s cooldown + 35s buffer)
    // so the session has time to produce items before drops are allowed again.
    // NOTE: we use lastGatherSessionStartAt (not lastGatherQueuedAt) here — the latter is
    // only the 5s per-resource cooldown and must NOT be reset here (would deadlock skilling mode).
    const gatherSessionActive =
      Date.now() - instance.lastGatherSessionStartAt < 65000;
    const inventory = instance.service.getInventoryItems();
    const inventoryFull = inventory.length >= 28;
    if (!gatherSessionActive) {
      this.manageInventory(instance);
    } else if (inventoryFull) {
      // Inventory is full during an active gather. We must NOT drop items —
      // ITEM_DROP cancels the gather session. Instead, only eat food to free a
      // slot safely. Eating emits INVENTORY_USE, not ITEM_DROP, so the gather
      // session survives. After eating, the freed slot allows the first ore/fish
      // to land; subsequent items stack onto that slot via ResourceSystem's
      // stackable exception (works even at 28/28).
      const food = inventory.find((slot) => {
        const item = getItem(slot.itemId);
        return (
          item &&
          ((item as unknown as Record<string, unknown>).healAmount as
            | number
            | undefined)
        );
      });
      if (food) {
        console.log(
          `[AgentManager] ${instance.config.name} eating ${food.itemId} to free slot for gathering`,
        );
        instance.service.executeUse(food.itemId);
      } else {
        // No food available and inventory is full — deadlocked.
        // Allow manageInventory to run: if it finds skill-irrelevant junk it will drop it
        // (which cancels the current gather via ITEM_DROP), but the agent re-queues on the
        // next tick with a free slot. If there's nothing to drop, this is a no-op.
        this.manageInventory(instance);
      }
    }

    // === SHOPPING: buy missing tools/weapons ===
    // Returns true when a purchase was made; skip this tick's action so items
    // land in inventory (via async microtasks) before the next tick crafts/uses them.
    if (this.manageShopping(instance)) return;

    // === EQUIPMENT MANAGEMENT ===
    // Skip equip while gather active — EQUIPMENT_EQUIP also cancels gather sessions.
    if (!gatherSessionActive) {
      this.manageEquipment(instance, gameState);
    }

    // === PASSIVE HP REGEN: recover 1 HP every 30s when out of combat ===
    if (
      !gameState.inCombat &&
      gameState.maxHealth > 0 &&
      gameState.health < gameState.maxHealth &&
      Date.now() - instance.lastRegenAt > 30000
    ) {
      instance.lastRegenAt = Date.now();
      // Grant 1 shrimp (healAmount=3) and eat it immediately via INVENTORY_USE
      instance.service.executeStoreBuy("general_store", "shrimp", 1);
      // assessAndEat below will consume it this same tick
    }

    // === SURVIVAL: EAT FOOD IF NEEDED ===
    if (this.assessAndEat(instance, gameState)) {
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
    // Log memory every tick to detect runaway growth
    const mem = process.memoryUsage();
    logParts.push(`mem=${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
    const tickMsg = logParts.join(" ");
    console.log(tickMsg);
    _debugLog(`ACTION ${tickMsg}`);

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

      case "cook":
        await instance.service.executeCookOnFire(
          action.fireId,
          action.rawFoodId,
        );
        instance.lastActivity = Date.now();
        break;

      case "smelt":
        console.log(
          `[AgentManager] ${instance.config.name} smelting ${action.recipe}`,
        );
        await instance.service.executeSmelt(action.recipe);
        instance.lastActivity = Date.now();
        break;

      case "smith":
        console.log(
          `[AgentManager] ${instance.config.name} smithing ${action.recipe}`,
        );
        await instance.service.executeSmith(action.recipe);
        instance.lastActivity = Date.now();
        break;

      case "runecraft":
        console.log(
          `[AgentManager] ${instance.config.name} runecrafting ${action.runeType} at ${action.altarId}`,
        );
        await instance.service.executeRunecraft(
          action.altarId,
          action.runeType,
        );
        instance.lastActivity = Date.now();
        break;

      case "craft":
        console.log(
          `[AgentManager] ${instance.config.name} crafting ${action.recipeId}`,
        );
        await instance.service.executeCraft(action.recipeId);
        instance.lastActivity = Date.now();
        break;

      case "fletch":
        console.log(
          `[AgentManager] ${instance.config.name} fletching ${action.recipeId}`,
        );
        await instance.service.executeFletch(action.recipeId);
        instance.lastActivity = Date.now();
        break;

      case "questAccept": {
        const accepted = await instance.service.executeQuestAccept(
          action.questId,
        );
        if (accepted) {
          // Mark as accepted immediately to prevent infinite retry loops.
          // Quest state may not appear in getQuestState() until the next tick,
          // but that's fine — manageQuests will pick it up then.
          instance.questsAccepted.add(action.questId);
          const postAcceptState = instance.service.getQuestState();
          const questStarted = postAcceptState.some(
            (q) => q.questId === action.questId,
          );
          console.log(
            `[AgentManager] ${instance.config.name} accepted quest: ${action.questId}${questStarted ? "" : " (state pending)"}`,
          );
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
        instance.lastGoalKey = "";
        instance.goalSetAt = Date.now();
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

  // ─── LLM DECISION ENGINE ──────────────────────────────────────────────

  /**
   * Call Claude API directly via fetch to get a strategic decision.
   * Returns raw text response or null on failure/missing API key.
   */
  private static async callClaude(
    prompt: string,
    maxTokens = 256,
  ): Promise<string | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        console.warn(
          `[AgentBehaviorTicker] Claude API error ${response.status}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        content?: Array<{ type: string; text: string }>;
      };
      const textBlock = data.content?.find((b) => b.type === "text");
      return textBlock?.text ?? null;
    } catch (err) {
      console.warn(`[AgentBehaviorTicker] Claude call failed: ${errMsg(err)}`);
      return null;
    }
  }

  /**
   * Ask Claude which available quest DESTINY should accept next.
   * Caches the result for 60 seconds to avoid API spamming.
   * Returns the chosen questId, or null if LLM unavailable/failed.
   */
  private async getLLMQuestChoice(
    instance: AgentInstance,
    availableQuests: AgentQuestInfo[],
    gameState: EmbeddedGameState,
  ): Promise<string | null> {
    // Return cached decision if still valid and quest still available
    if (
      instance.llmQuestDecision &&
      Date.now() < instance.llmQuestDecision.expiresAt
    ) {
      const cached = availableQuests.find(
        (q) =>
          q.questId === instance.llmQuestDecision!.questId &&
          q.status === "not_started",
      );
      if (cached) return instance.llmQuestDecision.questId;
    }

    const candidates = availableQuests.filter(
      (q) =>
        q.status === "not_started" && !instance.questsAccepted.has(q.questId),
    );
    if (candidates.length === 0) return null;
    // Single option — no need to call LLM
    if (candidates.length === 1) return candidates[0].questId;

    const skillSummary =
      Object.entries(gameState.skills)
        .filter(([, s]) => s.level > 1)
        .map(([skill, s]) => `${skill}:${s.level}`)
        .join(", ") || "all level 1";

    const questList = candidates
      .map((q) => {
        const stages = q.stages
          .map(
            (s) =>
              `    - ${s.type}: ${s.description}${s.count ? ` (x${s.count})` : ""}`,
          )
          .join("\n");
        return `• ${q.questId} — "${q.name}": ${q.description}\n${stages}`;
      })
      .join("\n");

    const prompt = [
      `You are DESTINY, an autonomous AI adventurer in an OSRS-style RPG. Choose the best quest to pursue next.`,
      ``,
      `Your skills: ${skillSummary}`,
      `HP: ${gameState.health}/${gameState.maxHealth}`,
      `Inventory: ${gameState.inventory.length}/28 slots used`,
      ``,
      `Available quests:`,
      questList,
      ``,
      `Choose the quest that best fits your current skills and progression. Consider difficulty, prerequisites, and what will make you strongest fastest.`,
      `Respond ONLY with valid JSON: {"questId": "quest_id_here", "reason": "one sentence why"}`,
    ].join("\n");

    const response = await AgentBehaviorTicker.callClaude(prompt);
    if (!response) return null;

    const match = response.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[0]) as {
        questId?: string;
        reason?: string;
      };
      if (!parsed.questId) return null;

      // Validate that the LLM chose a real available quest
      const valid = candidates.find((q) => q.questId === parsed.questId);
      if (!valid) {
        console.warn(
          `[AgentBehaviorTicker] ${instance.config.name} LLM chose invalid questId: ${parsed.questId}`,
        );
        return null;
      }

      instance.llmQuestDecision = {
        questId: parsed.questId,
        reason: parsed.reason ?? "",
        expiresAt: Date.now() + 60_000,
      };

      console.log(
        `[AgentBehaviorTicker] ${instance.config.name} LLM quest choice: ${parsed.questId} — ${parsed.reason ?? ""}`,
      );
      return parsed.questId;
    } catch {
      return null;
    }
  }

  /**
   * Ask Claude what DESTINY should do when she has no active quests.
   * Returns 'combat', 'gather', or 'explore'. Caches result for 45 seconds.
   */
  private async getLLMFreeTimeActivity(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): Promise<"combat" | "gather" | "explore"> {
    // Return cached decision if still valid
    if (
      instance.llmFreeTimeDecision &&
      Date.now() < instance.llmFreeTimeDecision.expiresAt
    ) {
      return instance.llmFreeTimeDecision.activity;
    }

    const nearbyMobs = gameState.nearbyEntities
      .filter((e) => e.type === "mob")
      .slice(0, 4);
    const nearbyResources = gameState.nearbyEntities
      .filter((e) => e.type === "resource")
      .slice(0, 4);

    const skillSummary =
      Object.entries(gameState.skills)
        .filter(([, s]) => s.level > 1)
        .map(([skill, s]) => `${skill}:${s.level}`)
        .join(", ") || "all level 1";

    const mobList =
      nearbyMobs.length > 0
        ? nearbyMobs
            .map(
              (m) => `${m.name}(${m.distance.toFixed(0)}m,lvl${m.level ?? "?"}`,
            )
            .join(", ")
        : "none visible";

    const resourceList =
      nearbyResources.length > 0
        ? nearbyResources
            .map((r) => `${r.name}(${r.distance.toFixed(0)}m)`)
            .join(", ")
        : "none visible";

    const prompt = [
      `You are DESTINY, an autonomous AI adventurer in an OSRS-style RPG. You have no active quests right now. Decide what to do.`,
      ``,
      `Your skills: ${skillSummary}`,
      `HP: ${gameState.health}/${gameState.maxHealth}`,
      `Nearby mobs: ${mobList}`,
      `Nearby resources: ${resourceList}`,
      ``,
      `Options:`,
      `- COMBAT: Attack nearby mobs to gain combat experience and drops`,
      `- GATHER: Collect nearby resources (wood, fish, ore) to gain skilling xp`,
      `- EXPLORE: Move around to discover new mobs, resources, and areas`,
      ``,
      `Choose based on your current stats and what's available nearby. What would make you strongest most efficiently?`,
      `Respond ONLY with valid JSON: {"activity": "COMBAT"|"GATHER"|"EXPLORE", "reason": "one sentence"}`,
    ].join("\n");

    const response = await AgentBehaviorTicker.callClaude(prompt, 128);
    let activity: "combat" | "gather" | "explore" = "combat";

    if (response) {
      const match = response.match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as {
            activity?: string;
            reason?: string;
          };
          const act = (parsed.activity ?? "").toUpperCase();
          if (act === "COMBAT" || act === "GATHER" || act === "EXPLORE") {
            activity = act.toLowerCase() as "combat" | "gather" | "explore";
          }
          console.log(
            `[AgentBehaviorTicker] ${instance.config.name} LLM free-time: ${activity} — ${parsed.reason ?? ""}`,
          );
        } catch {
          // fall through to default
        }
      }
    }

    instance.llmFreeTimeDecision = {
      activity,
      reason: "",
      expiresAt: Date.now() + 45_000,
    };
    return activity;
  }

  /**
   * Post-quest: set a skill-grind goal using the LLM to decide what to train
   * toward rune equipment. Replaces the old generic combat/gather/explore logic.
   */
  private async manageFreeTime(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): Promise<void> {
    if (instance.goal !== null) return;
    await this.manageSkillGrind(instance, gameState);
  }

  /**
   * Determine the best skill to grind post-quest and set it as the agent's goal.
   * Uses LLM for smart decisions; falls back to heuristic if Claude unavailable.
   */
  private async manageSkillGrind(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): Promise<void> {
    if (instance.goal !== null) return;

    const decision = await this.getLLMSkillGrindDecision(instance, gameState);

    instance.goal = {
      type: "skilling",
      description: `Train ${decision.targetSkill} → ${decision.activity.replace(/_/g, " ")}`,
      skillingActivity: decision.activity,
      skillingTargetSkill: decision.targetSkill,
    };

    console.log(
      `[AgentBehaviorTicker] ${instance.config.name} skill grind: ${decision.activity} (${decision.targetSkill} → ${decision.targetLevel}) — ${decision.reason}`,
    );
  }

  /**
   * Ask Claude which skill to grind next toward rune equipment.
   * Gives full context: current levels, inventory, equipped tier, what each tier requires.
   * Caches result for 5 minutes — long enough to complete a mining→smelting→smithing cycle.
   */
  private async getLLMSkillGrindDecision(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): Promise<{
    activity: string;
    targetSkill: string;
    targetLevel: number;
    reason: string;
  }> {
    // Return cached decision if still valid
    if (
      instance.llmSkillGrindDecision &&
      Date.now() < instance.llmSkillGrindDecision.expiresAt
    ) {
      return instance.llmSkillGrindDecision;
    }

    const skills = gameState.skills;
    const inventory = instance.service.getInventoryItems();
    const equipped = instance.service.getEquippedItems();

    const skillSummary =
      Object.entries(skills)
        .map(([k, s]) => `${k}:${s.level}`)
        .join(", ") || "all level 1";

    const weaponTier = getEquippedWeaponTier(equipped.weapon || "");
    const invSummary =
      inventory.length > 0
        ? inventory
            .slice(0, 16)
            .map((i) => `${i.itemId}×${i.quantity ?? 1}`)
            .join(", ")
        : "empty";

    const attackLevel = skills.attack?.level ?? 1;
    const defLevel = skills.defence?.level ?? 1;
    const smithLevel = skills.smithing?.level ?? 1;
    const miningLevel = skills.mining?.level ?? 1;
    const wcLevel = skills.woodcutting?.level ?? 1;
    const fishLevel = skills.fishing?.level ?? 1;
    const cookLevel = skills.cooking?.level ?? 1;
    const effCombat = Math.floor(
      (attackLevel + (skills.strength?.level ?? 1) + defLevel) / 3,
    );

    // Check which resource types are actually present in the world right now
    const worldEntities = instance.service.getWorld().entities;
    const hasOreInWorld = (oreName: string): boolean => {
      for (const [, e] of worldEntities.items.entries()) {
        const data = (e as { data?: Record<string, unknown> }).data;
        if (!data || data.depleted === true) continue;
        if (String(data.type || "").toLowerCase() !== "resource") continue;
        const hay = `${String(data.name || "").toLowerCase()} ${String(data.resourceType || "").toLowerCase()} ${String(data.resourceId || "").toLowerCase()}`;
        if (hay.includes(oreName)) return true;
      }
      return false;
    };
    const hasTreeInWorld = (treeType: string): boolean => {
      for (const [, e] of worldEntities.items.entries()) {
        const data = (e as { data?: Record<string, unknown> }).data;
        if (!data || data.depleted === true) continue;
        if (String(data.type || "").toLowerCase() !== "resource") continue;
        const hay = `${String(data.name || "").toLowerCase()} ${String(data.resourceType || "").toLowerCase()}`;
        if (hay.includes(treeType)) return true;
      }
      return false;
    };
    const hasFishingInWorld = (): boolean => {
      for (const [, e] of worldEntities.items.entries()) {
        const data = (e as { data?: Record<string, unknown> }).data;
        if (!data) continue;
        if (String(data.type || "").toLowerCase() !== "resource") continue;
        const hay = `${String(data.name || "").toLowerCase()} ${String(data.resourceType || "").toLowerCase()}`;
        if (hay.includes("fishing")) return true;
      }
      return false;
    };

    // Build list of currently valid activities
    const validActivities: string[] = [];
    validActivities.push("fight_goblins");
    if (effCombat >= 7) validActivities.push("fight_bandits");
    if (effCombat >= 14) validActivities.push("fight_barbarians");
    if (effCombat >= 21) validActivities.push("fight_guards");
    if (effCombat >= 30) validActivities.push("fight_dark_rangers");
    if (hasOreInWorld("copper")) validActivities.push("mine_copper");
    if (hasOreInWorld("tin")) validActivities.push("mine_tin");
    if (miningLevel >= 15 && hasOreInWorld("iron"))
      validActivities.push("mine_iron");
    if (miningLevel >= 30 && hasOreInWorld("coal"))
      validActivities.push("mine_coal");
    if (miningLevel >= 55 && hasOreInWorld("mithril"))
      validActivities.push("mine_mithril");
    validActivities.push("smelt_bronze");
    if (smithLevel >= 15) validActivities.push("smelt_iron");
    if (smithLevel >= 30) validActivities.push("smelt_steel");
    if (smithLevel >= 50) validActivities.push("smelt_mithril");
    if (smithLevel >= 19 && inventory.some((i) => i.itemId === "iron_bar"))
      validActivities.push("smith_iron_sword");
    if (smithLevel >= 34 && inventory.some((i) => i.itemId === "steel_bar"))
      validActivities.push("smith_steel_sword");
    if (smithLevel >= 54 && inventory.some((i) => i.itemId === "mithril_bar"))
      validActivities.push("smith_mithril_sword");
    if (smithLevel >= 74 && inventory.some((i) => i.itemId === "adamant_bar"))
      validActivities.push("smith_adamant_sword");
    if (smithLevel >= 89 && inventory.some((i) => i.itemId === "rune_bar"))
      validActivities.push("smith_rune_sword");
    if (hasTreeInWorld("tree") || hasTreeInWorld("normal"))
      validActivities.push("chop_trees");
    if (wcLevel >= 15 && hasTreeInWorld("oak"))
      validActivities.push("chop_oak");
    if (wcLevel >= 30 && hasTreeInWorld("willow"))
      validActivities.push("chop_willow");
    if (hasFishingInWorld()) validActivities.push("fish_shrimp");
    if (fishLevel >= 20 && hasFishingInWorld())
      validActivities.push("fish_trout");
    if (inventory.some((i) => i.itemId.startsWith("raw_")))
      validActivities.push("cook_fish");

    const prompt = [
      `You are DESTINY, an autonomous AI adventurer in an OSRS-style RPG. All quests are done. Long-term goal: reach RUNE equipment.`,
      ``,
      `Current skills: ${skillSummary}`,
      `Equipped weapon tier: ${weaponTier}`,
      `Inventory: ${invSummary}`,
      `Effective combat level: ${effCombat}`,
      ``,
      `Equipment tier requirements (attack+defence to EQUIP, smithing to CRAFT, mining to GET ORE):`,
      `- Iron:    atk/def 1,  smithing 19, iron ore (mining 15)`,
      `- Steel:   atk/def 5,  smithing 34, iron+coal (mining 30)`,
      `- Mithril: atk/def 20, smithing 54, mithril+coal (mining 55)`,
      `- Adamant: atk/def 30, smithing 74, adamant+coal (mining 70)`,
      `- Rune:    atk/def 40, smithing 89, runite+coal (mining 85)`,
      ``,
      `Valid activities right now: ${validActivities.join(", ")}`,
      ``,
      `Strategy hints: If you have bars → smith first. If you have ores → smelt. Combat levels unlock higher-tier equipment.`,
      `Mining is the bottleneck for smithing progression. Balance combat with production skills.`,
      ``,
      `Choose the single best activity to do right now. Respond ONLY with:`,
      `{"activity":"one_of_the_valid_activities_above","targetSkill":"skill_name","targetLevel":N,"reason":"one concise sentence"}`,
    ].join("\n");

    const response = await AgentBehaviorTicker.callClaude(prompt, 200);
    if (response) {
      const match = response.match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as {
            activity?: string;
            targetSkill?: string;
            targetLevel?: number;
            reason?: string;
          };
          if (parsed.activity && validActivities.includes(parsed.activity)) {
            const decision = {
              activity: parsed.activity,
              targetSkill: parsed.targetSkill ?? "attack",
              targetLevel: parsed.targetLevel ?? 10,
              reason: parsed.reason ?? "",
              expiresAt: Date.now() + 300_000,
            };
            instance.llmSkillGrindDecision = decision;
            console.log(
              `[AgentBehaviorTicker] ${instance.config.name} LLM skill grind: ${parsed.activity} — ${parsed.reason ?? ""}`,
            );
            return decision;
          }
        } catch {
          // fall through to heuristic
        }
      }
    }

    return this.getFallbackSkillGrind(
      instance,
      skills,
      inventory,
      effCombat,
      weaponTier,
    );
  }

  /**
   * Heuristic fallback when Claude API is unavailable.
   * Prioritises the most impactful activity for the current skill state.
   */
  private getFallbackSkillGrind(
    instance: AgentInstance,
    skills: Record<string, { level: number; xp: number }>,
    inventory: Array<{ slot: number; itemId: string; quantity: number }>,
    effCombat: number,
    weaponTier: string,
  ): {
    activity: string;
    targetSkill: string;
    targetLevel: number;
    reason: string;
    expiresAt: number;
  } {
    const attackLevel = skills.attack?.level ?? 1;
    const defLevel = skills.defence?.level ?? 1;
    const smithLevel = skills.smithing?.level ?? 1;
    const miningLevel = skills.mining?.level ?? 1;

    // If bars are in inventory — smith them immediately
    const tierOrder = [
      "rune_bar",
      "adamant_bar",
      "mithril_bar",
      "steel_bar",
      "iron_bar",
      "bronze_bar",
    ];
    const availableBar = tierOrder.find((b) =>
      inventory.some((i) => i.itemId === b),
    );
    if (availableBar) {
      const t = availableBar.replace("_bar", "");
      const smithActivity = `smith_${t}_sword`;
      const dec = {
        activity: smithActivity,
        targetSkill: "smithing",
        targetLevel: smithLevel + 5,
        reason: `Have ${availableBar}, smithing a weapon`,
        expiresAt: Date.now() + 300_000,
      };
      instance.llmSkillGrindDecision = dec;
      return dec;
    }

    // If ores in inventory — smelt them
    if (inventory.some((i) => i.itemId === "iron_ore") && smithLevel >= 15) {
      const dec = {
        activity: "smelt_iron",
        targetSkill: "smithing",
        targetLevel: smithLevel + 3,
        reason: "Have iron ore, smelting bars",
        expiresAt: Date.now() + 300_000,
      };
      instance.llmSkillGrindDecision = dec;
      return dec;
    }
    if (
      inventory.some((i) => i.itemId === "copper_ore") &&
      inventory.some((i) => i.itemId === "tin_ore")
    ) {
      const dec = {
        activity: "smelt_bronze",
        targetSkill: "smithing",
        targetLevel: smithLevel + 2,
        reason: "Have copper+tin, smelting bronze",
        expiresAt: Date.now() + 300_000,
      };
      instance.llmSkillGrindDecision = dec;
      return dec;
    }

    // Work toward next equipment tier
    const nextTier =
      EQUIPMENT_TIERS.find(
        (t) =>
          t.attackReq > attackLevel ||
          t.defReq > defLevel ||
          weaponTier === "none" ||
          t.tier === "rune",
      ) ?? EQUIPMENT_TIERS[EQUIPMENT_TIERS.length - 1];

    // Combat is the bottleneck — train attack/defence
    if (attackLevel < nextTier.attackReq || defLevel < nextTier.defReq) {
      const target = getBestCombatTarget(effCombat);
      const dec = {
        activity: `fight_${target.replace(/ /g, "_")}`,
        targetSkill: "attack",
        targetLevel: nextTier.attackReq,
        reason: `Need atk/def ${nextTier.attackReq} for ${nextTier.tier}`,
        expiresAt: Date.now() + 300_000,
      };
      instance.llmSkillGrindDecision = dec;
      return dec;
    }

    // Mining is the bottleneck — mine appropriate ore
    if (miningLevel < nextTier.miningReq) {
      const oreTarget = getBestOreToMine(miningLevel);
      const dec = {
        activity: `mine_${oreTarget.replace("_ore", "")}`,
        targetSkill: "mining",
        targetLevel: nextTier.miningReq,
        reason: `Mining ${oreTarget} toward ${nextTier.tier}`,
        expiresAt: Date.now() + 300_000,
      };
      instance.llmSkillGrindDecision = dec;
      return dec;
    }

    // Smithing is the bottleneck — mine ore to start the chain
    const mineActivity = `mine_${nextTier.oreA.replace("_ore", "")}`;
    const dec = {
      activity: mineActivity,
      targetSkill: "mining",
      targetLevel: nextTier.miningReq + 5,
      reason: `Mining ore for ${nextTier.tier} smithing chain`,
      expiresAt: Date.now() + 300_000,
    };
    instance.llmSkillGrindDecision = dec;
    return dec;
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

      const isReadyToComplete = quest.status === "ready_to_complete";
      instance.goal = {
        type: "questing",
        description: isReadyToComplete
          ? `Turn in: ${quest.name}`
          : `${quest.stageDescription || quest.name}`,
        questId: quest.questId,
        questName: quest.name,
        // Don't expose stageType/target when ready_to_complete — manageShopping
        // must not buy crafting/fletching supplies for a stage that's already done.
        questStageType: isReadyToComplete ? undefined : quest.stageType,
        questStageTarget: isReadyToComplete ? undefined : quest.stageTarget,
        questStageCount: quest.stageCount,
        questStartNpc: quest.startNpc,
      };
      return;
    }

    // No active quest — ask Claude which one to accept next.
    // Filter to quests that are viable given resource system availability.
    const candidateQuests = availableQuests.filter(
      (q) =>
        q.status === "not_started" &&
        !instance.questsAccepted.has(q.questId) &&
        (resourceSystemAvailable || q.stages.every((s) => s.type !== "gather")),
    );

    if (candidateQuests.length > 0) {
      const gameState = instance.service.getGameState();
      const chosenQuestId = gameState
        ? await this.getLLMQuestChoice(instance, candidateQuests, gameState)
        : null;

      // Use LLM choice, or fall back to first candidate if LLM unavailable
      const questId = chosenQuestId ?? candidateQuests[0].questId;
      const quest = candidateQuests.find((q) => q.questId === questId);

      if (quest) {
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

    // All quests done or accepted — LLM will decide free-time activity in manageFreeTime
    instance.goal = null;
  }

  /**
   * Buy tools and weapons the agent needs but doesn't have.
   * Checks quest requirements, current equipment, and coins.
   * One purchase per tick to avoid spam.
   */

  /**
   * Find the best item to drop from a full inventory to free a slot for a new purchase.
   * Uses the same protection logic as manageInventory — drops nothing that is weapon, armor,
   * tool, raw fish, ore, bar, quest stage target, or in questTools.
   * Returns null if nothing can safely be dropped.
   */
  private findItemToDropForSlot(
    instance: AgentInstance,
    inventory: Array<{ itemId: string; quantity?: number }>,
  ): { itemId: string; quantity: number } | null {
    const questTools = [
      "tinderbox",
      "bronze_hatchet",
      "hatchet",
      "bronze_pickaxe",
      "pickaxe",
      "fishing_rod",
      "fly_fishing_rod",
      "small_fishing_net",
      "big_fishing_net",
      "harpoon",
      "lobster_pot",
      "net",
      "logs",
      "oak_logs",
      "willow_logs",
      "teak_logs",
      "maple_logs",
      "needle",
      "thread",
      "leather",
      "chisel",
      "hammer",
      "knife",
      "bow_string",
      "bowstring",
      "arrow_shaft",
      "headless_arrow",
      "shortbow_u",
      "feather",
      "feathers",
      "bronze_arrowtips",
      "iron_arrowtips",
      "steel_arrowtips",
      "rune_essence",
      "pure_essence",
    ];
    const questStageTarget = instance.goal?.questStageTarget ?? null;
    // Prefer dropping items in this order before anything else
    const preferredDropOrder = [
      "air_rune",
      "water_rune",
      "earth_rune",
      "fire_rune",
      "mind_rune",
      "bones",
      "big_bones",
      "shrimp",
      "headless_arrow",
      "feathers",
    ];
    // Check preferred order first
    for (const id of preferredDropOrder) {
      const slot = inventory.find((i) => i.itemId === id);
      if (slot) return { itemId: slot.itemId, quantity: slot.quantity ?? 1 };
    }
    // Fall back to any unprotected item
    for (const slot of inventory) {
      const itemData = getItem(slot.itemId);
      const isWeapon =
        itemData?.equipSlot === "weapon" || itemData?.equipSlot === "2h";
      const isArmor = itemData?.equipSlot && !isWeapon;
      const isTool = itemData?.type === "tool";
      const isRawFish = slot.itemId.startsWith("raw_");
      const isOre = slot.itemId.endsWith("_ore");
      const isBar = slot.itemId.endsWith("_bar");
      const isQuestStageItem =
        questStageTarget != null && slot.itemId === questStageTarget;
      const healAmount = itemData
        ? ((itemData as unknown as Record<string, unknown>).healAmount as
            | number
            | undefined)
        : undefined;
      const isFood = healAmount && healAmount > 0;
      if (
        isWeapon ||
        isArmor ||
        isTool ||
        isRawFish ||
        isOre ||
        isBar ||
        isQuestStageItem ||
        isFood ||
        questTools.includes(slot.itemId)
      ) {
        continue;
      }
      return { itemId: slot.itemId, quantity: slot.quantity ?? 1 };
    }
    return null;
  }

  public manageShopping(instance: AgentInstance): boolean {
    const inventory = instance.service.getInventoryItems();
    const equipped = instance.service.getEquippedItems();
    const goal = instance.goal;

    // Get coins from game state
    const gameState = instance.service.getGameState();
    if (!gameState) return false;

    // Grant food when HP is critically low and agent has none (bypasses coin check like quest materials)
    if (
      gameState.maxHealth > 0 &&
      gameState.health / gameState.maxHealth < 0.4
    ) {
      const hasFood = inventory.some((i) => {
        const item = getItem(i.itemId);
        return (
          item &&
          ((item as unknown as Record<string, unknown>).healAmount as
            | number
            | undefined)
        );
      });
      if (!hasFood) {
        console.log(
          `[AgentManager] ${instance.config.name} granting emergency food (hp ${gameState.health}/${gameState.maxHealth})`,
        );
        instance.service.executeStoreBuy("general_store", "shrimp", 3);
        return true;
      }
    }

    // Supply tools for skill grinding BEFORE coin check (executeStoreBuy grants items directly)
    if (goal?.type === "skilling") {
      const act = goal.skillingActivity ?? "";
      const hasInvOrEquip = (kw: string) =>
        (equipped.weapon || "").includes(kw) ||
        inventory.some((i) => i.itemId.includes(kw));

      if (
        act.startsWith("mine_") ||
        act.startsWith("smelt_") ||
        act.startsWith("smith_")
      ) {
        if (!hasInvOrEquip("pickaxe")) {
          console.log(
            `[AgentManager] ${instance.config.name} buying bronze_pickaxe for skill grind`,
          );
          instance.service.executeStoreBuy(
            "general_store",
            "bronze_pickaxe",
            1,
          );
          return true;
        }
      }
      if (act.startsWith("chop_")) {
        if (!hasInvOrEquip("hatchet")) {
          console.log(
            `[AgentManager] ${instance.config.name} buying bronze_hatchet for skill grind`,
          );
          instance.service.executeStoreBuy(
            "general_store",
            "bronze_hatchet",
            1,
          );
          return true;
        }
      }
      if (act.startsWith("fish_") || act === "cook_fish") {
        const needsRod = act === "fish_trout" || act === "fish_salmon";
        if (
          needsRod &&
          !inventory.some(
            (i) => i.itemId === "fly_fishing_rod" || i.itemId === "fishing_rod",
          )
        ) {
          console.log(
            `[AgentManager] ${instance.config.name} buying fly_fishing_rod for skill grind`,
          );
          instance.service.executeStoreBuy(
            "fishing_store",
            "fly_fishing_rod",
            1,
          );
          return true;
        }
        if (
          !needsRod &&
          !inventory.some(
            (i) =>
              i.itemId === "small_fishing_net" ||
              i.itemId === "big_fishing_net",
          )
        ) {
          console.log(
            `[AgentManager] ${instance.config.name} buying small_fishing_net for skill grind`,
          );
          instance.service.executeStoreBuy(
            "fishing_store",
            "small_fishing_net",
            1,
          );
          return true;
        }
        if (
          act === "cook_fish" &&
          !inventory.some((i) => i.itemId === "tinderbox")
        ) {
          instance.service.executeStoreBuy("general_store", "tinderbox", 1);
          return true;
        }
      }
    }

    // Supply quest materials before coin check (executeStoreBuy grants items directly for agents)
    if (goal?.type === "questing") {
      const stageTarget = goal.questStageTarget || "";
      const stageType = goal.questStageType || "";

      // Crafting quest: supply leather/needle/thread
      if (
        stageType === "interact" &&
        (stageTarget.includes("leather") || goal.questId === "crafting_basics")
      ) {
        const leatherCount = inventory.reduce(
          (sum, i) => sum + (i.itemId === "leather" ? (i.quantity ?? 1) : 0),
          0,
        );
        if (leatherCount < 1) {
          // Buy leather one at a time — only needs 1 free slot, avoids inventory-full issues.
          // CraftingSystem consumes 1 leather per glove, so we buy 1 → craft 1 → repeat.
          const freeSlots = 28 - inventory.length;
          if (freeSlots < 1) {
            // Drop a low-priority item to make room.
            const toDrop = this.findItemToDropForSlot(instance, inventory);
            if (toDrop) {
              console.log(
                `[AgentManager] ${instance.config.name} dropping ${toDrop.quantity}x ${toDrop.itemId} to make room for leather`,
              );
              instance.service.executeDrop(toDrop.itemId, toDrop.quantity);
              return true;
            }
          }
          console.log(
            `[AgentManager] ${instance.config.name} buying 1x leather for crafting quest (direct grant)`,
          );
          instance.service.executeStoreBuy("crafting_store", "leather", 1);
          return true; // skip action this tick so item lands in inventory before crafting
        }
        if (!inventory.some((i) => i.itemId === "needle")) {
          console.log(
            `[AgentManager] ${instance.config.name} buying needle for crafting quest (direct grant)`,
          );
          instance.service.executeStoreBuy("crafting_store", "needle", 1);
          return true;
        }
        if (!inventory.some((i) => i.itemId === "thread")) {
          console.log(
            `[AgentManager] ${instance.config.name} buying thread for crafting quest (direct grant)`,
          );
          instance.service.executeStoreBuy("crafting_store", "thread", 1);
          return true;
        }
      }

      // Fletching quest: supply knife/logs/feathers/bowstring
      if (
        stageType === "interact" &&
        (stageTarget.includes("arrow") ||
          stageTarget.includes("shaft") ||
          stageTarget.includes("shortbow") ||
          goal.questId === "fletchers_introduction")
      ) {
        // Knife is required for arrow_shaft and shortbow_u fletching
        if (!inventory.some((i) => i.itemId === "knife")) {
          console.log(
            `[AgentManager] ${instance.config.name} buying knife for fletching quest (direct grant)`,
          );
          instance.service.executeStoreBuy("general_store", "knife", 1);
          return true;
        }

        // headless_arrow stage: need arrow_shafts (already fletched) + feathers.
        // Do NOT buy raw logs here — that fills inventory and blocks feather grant.
        if (stageTarget.includes("headless")) {
          const shaftCount = inventory.reduce(
            (sum, i) =>
              sum + (i.itemId === "arrow_shaft" ? (i.quantity ?? 1) : 0),
            0,
          );
          if (shaftCount < 15) {
            // Need to fletch arrow_shafts first — ensure we have at least 1 log
            const logCount2 = inventory.reduce(
              (sum, i) => sum + (i.itemId === "logs" ? (i.quantity ?? 1) : 0),
              0,
            );
            if (logCount2 < 1) {
              if (inventory.length >= 28) {
                const toDrop2 = this.findItemToDropForSlot(instance, inventory);
                if (toDrop2) {
                  console.log(
                    `[AgentManager] ${instance.config.name} dropping ${toDrop2.itemId} to free slot for log`,
                  );
                  instance.service.executeDrop(
                    toDrop2.itemId,
                    toDrop2.quantity,
                  );
                  return true;
                }
              }
              console.log(
                `[AgentManager] ${instance.config.name} buying 1 log for arrow_shaft fletching`,
              );
              instance.service.executeStoreBuy("general_store", "logs", 1);
              return true;
            }
            return false; // pickQuestAction will pick "fletch: arrow_shaft"
          }

          // Have 15+ arrow_shafts — need feathers
          const featherCount = inventory.reduce(
            (sum, i) => sum + (i.itemId === "feathers" ? (i.quantity ?? 1) : 0),
            0,
          );
          _debugLog(
            `SHOP_CHECK feathers=${featherCount} arrow_shaft=${shaftCount} stageTarget=${stageTarget}`,
          );
          if (featherCount < 15) {
            // If inventory is full and feathers have no existing stack, drop something to make room.
            // ITEM_DROP fires synchronously so the slot is freed before executeStoreBuy runs.
            const hasFeatherSlot = inventory.some(
              (i) => i.itemId === "feathers",
            );
            if (!hasFeatherSlot && inventory.length >= 28) {
              const slotFreer = this.findItemToDropForSlot(instance, inventory);
              if (slotFreer) {
                console.log(
                  `[AgentManager] ${instance.config.name} dropping ${slotFreer.itemId} to make room for feathers`,
                );
                instance.service.executeDrop(
                  slotFreer.itemId,
                  slotFreer.quantity,
                );
                return true; // wait for drop to land before buying
              }
            }
            console.log(
              `[AgentManager] ${instance.config.name} buying feathers for fletching quest (direct grant)`,
            );
            instance.service.executeStoreBuy("range_store", "feathers", 15);
            return true;
          }
          return false; // All materials ready
        }

        // For non-headless fletching stages that need logs:
        // - arrow_shaft: needs logs
        // - shortbow_u: needs logs
        // - shortbow: needs shortbow_u first (which needs logs), then bowstring+shortbow_u
        const needsLogs =
          stageTarget !== "shortbow" ||
          !inventory.some((i) => i.itemId === "shortbow_u");
        if (needsLogs) {
          const logCount = inventory.reduce(
            (sum, i) => sum + (i.itemId === "logs" ? (i.quantity ?? 1) : 0),
            0,
          );
          if (logCount < 1) {
            // Logs are non-stackable — each log needs its own inventory slot.
            // If inventory is full, free a slot first, then buy just 1 log.
            if (inventory.length >= 28) {
              const toDrop = this.findItemToDropForSlot(instance, inventory);
              if (toDrop) {
                console.log(
                  `[AgentManager] ${instance.config.name} dropping ${toDrop.itemId} to free slot for logs`,
                );
                instance.service.executeDrop(toDrop.itemId, toDrop.quantity);
                return true;
              }
            }
            console.log(
              `[AgentManager] ${instance.config.name} buying logs for fletching quest (direct grant)`,
            );
            instance.service.executeStoreBuy("general_store", "logs", 1);
            return true;
          }
        }

        const featherCount = inventory.reduce(
          (sum, i) => sum + (i.itemId === "feathers" ? (i.quantity ?? 1) : 0),
          0,
        );
        const shaftCountNow = inventory.reduce(
          (sum, i) =>
            sum + (i.itemId === "arrow_shaft" ? (i.quantity ?? 1) : 0),
          0,
        );
        _debugLog(
          `SHOP_CHECK feathers=${featherCount} arrow_shaft=${shaftCountNow} stageTarget=${stageTarget}`,
        );
        // Feathers are only needed for headless_arrow stage (handled above in headless block).
        // Do NOT buy feathers for arrow_shaft stage — only logs and knife are needed there.
        // Bowstring needed for shortbow
        if (
          !inventory.some((i) => i.itemId === "bowstring") &&
          stageTarget.includes("shortbow")
        ) {
          // Bowstring is stackable but needs a new slot if none exists — free up space if full.
          const hasBowstringSlot = inventory.some(
            (i) => i.itemId === "bowstring",
          );
          if (!hasBowstringSlot && inventory.length >= 28) {
            const slotFreerBs = this.findItemToDropForSlot(instance, inventory);
            if (slotFreerBs) {
              console.log(
                `[AgentManager] ${instance.config.name} dropping ${slotFreerBs.itemId} to free slot for bowstring`,
              );
              instance.service.executeDrop(
                slotFreerBs.itemId,
                slotFreerBs.quantity,
              );
              return true;
            }
          }
          console.log(
            `[AgentManager] ${instance.config.name} buying bowstring for fletching quest (direct grant)`,
          );
          instance.service.executeStoreBuy("range_store", "bowstring", 1);
          return true;
        }
      }
    }

    // Read coins from the entity data (CoinPouchSystem stores here)
    const entity = instance.service
      .getWorld()
      .entities.get(instance.service.getPlayerId() || "");
    const coins =
      ((entity?.data as Record<string, unknown>)?.coins as number) || 0;
    if (coins < 10) return false; // Not enough to buy anything

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
        instance.service.executeStoreBuy("sword_store", "bronze_shortsword", 1);
        return true;
      }
      if (coins >= 10) {
        console.log(
          `[AgentManager] ${instance.config.name} buying bronze_dagger (unarmed, ${coins} coins)`,
        );
        instance.service.executeStoreBuy("sword_store", "bronze_dagger", 1);
        return true;
      }
    }

    // Priority 2: Buy tools needed for current quest
    if (goal?.type === "questing") {
      const stageTarget = goal.questStageTarget || "";
      const stageType = goal.questStageType || "";

      // Need hatchet for woodcutting quests (gather logs, burn logs, or fire-lighting in cook stages)
      if (
        (stageType === "gather" && stageTarget.includes("log")) ||
        goal.questId === "lumberjacks_first_lesson" ||
        (stageType === "interact" &&
          (stageTarget === "fire" ||
            stageTarget === "shrimp" ||
            stageTarget === "cook"))
      ) {
        if (!hasAnyOfType("hatchet")) {
          console.log(
            `[AgentManager] ${instance.config.name} buying bronze_hatchet for woodcutting quest`,
          );
          instance.service.executeStoreBuy(
            "general_store",
            "bronze_hatchet",
            1,
          );
          return true;
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
            instance.service.executeStoreBuy(
              "general_store",
              "bronze_pickaxe",
              1,
            );
            return true;
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
            instance.service.executeStoreBuy(
              "fishing_store",
              "small_fishing_net",
              1,
            );
            return true;
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
            instance.service.executeStoreBuy("general_store", "tinderbox", 1);
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Keep inventory tidy: drop low-value junk to make room for useful items.
   * Agents get inventories clogged with sharks from duels and bones from kills.
   * Runs once per tick. Drops one item per tick to avoid spam.
   *
   * Priority to keep: weapons > armor > tools > food (max 5) > everything else
   * Priority to drop: bones, excess food beyond 5, other junk
   */
  public manageInventory(instance: AgentInstance): void {
    const inventory = instance.service.getInventoryItems();
    if (Date.now() < instance.dropCooldownUntil) return;

    // Always drop burnt food immediately — it's useless and clogs inventory
    const burntItem = inventory.find((i) => i.itemId.startsWith("burnt_"));
    if (burntItem) {
      console.log(
        `[AgentManager] ${instance.config.name} dropping burnt item ${burntItem.itemId}`,
      );
      instance.service.executeDrop(burntItem.itemId, burntItem.quantity ?? 1);
      instance.dropCooldownUntil = Date.now() + 3000; // short cooldown so we can drop more next tick
      return;
    }

    if (inventory.length < 20) return; // Keep 8+ free slots for quest loot and gear

    // Count food items
    let foodCount = 0;
    const dropCandidates: Array<{
      itemId: string;
      slot: number;
      priority: number;
      quantity: number;
    }> = [];

    // Track non-stackable items we've already kept one of, so duplicates can be dropped.
    const seenNonStackable = new Set<string>();

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
        // If the current quest stage asks us to accumulate this food item,
        // hold up to the required count before dropping excess.
        const questStageTargetForFood = instance.goal?.questStageTarget ?? null;
        const questStageCountForFood = instance.goal?.questStageCount ?? 5;
        // Keep (stageCount - 1) cooked items so there's always 1 free slot for gathering raw fish.
        // Example: cook_shrimp stage needs 6 shrimp → keep max 5 at a time so raw_shrimp fits.
        // Also: if inventory is getting full (≥26) on a gather stage, drop food aggressively to leave room.
        const isGatherStage = instance.goal?.questStageType === "gather";
        const nearlyFull = inventory.length >= 26;
        const completelyFull = inventory.length >= 28;
        let foodKeepLimit: number;
        if (
          questStageTargetForFood != null &&
          slot.itemId === questStageTargetForFood
        ) {
          foodKeepLimit = Math.max(4, questStageCountForFood - 1);
        } else if (isGatherStage && completelyFull) {
          // When completely full on a gather stage, add food as a low-priority drop candidate
          // so we first check for better candidates (xp_lamp, duplicate tools) elsewhere in inventory.
          // Food will be eaten (not dropped) at the end if it's the only option.
          foodKeepLimit = 0;
        } else if (isGatherStage && nearlyFull) {
          foodKeepLimit = 1; // Keep only 1 food item when gathering and inventory is nearly full
        } else {
          foodKeepLimit = 5;
        }
        if (foodCount > foodKeepLimit) {
          dropCandidates.push({
            itemId: slot.itemId,
            slot: slot.slot,
            priority: 2,
            quantity: slot.quantity ?? 1,
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
        "fly_fishing_rod",
        "small_fishing_net",
        "big_fishing_net",
        "harpoon",
        "lobster_pot",
        "net",
        "logs",
        "oak_logs",
        "willow_logs",
        "teak_logs",
        "maple_logs",
        // Crafting materials and tools
        "needle",
        "thread",
        "leather",
        "chisel",
        "hammer",
        // Fletching materials
        "knife",
        "bow_string",
        "bowstring",
        "logs",
        "arrow_shaft",
        "headless_arrow",
        "shortbow_u",
        "feather",
        "feathers",
        "bronze_arrowtips",
        "iron_arrowtips",
        "steel_arrowtips",
        // Runecrafting materials — only protect when actively runecrafting or on a runecrafting quest
        ...((instance.goal?.type === "questing" &&
          (instance.goal?.questStageTarget ?? "").includes("essence")) ||
        (instance.goal?.type === "skilling" &&
          (instance.goal?.skillingActivity ?? "").includes("runecraft"))
          ? ["rune_essence", "pure_essence"]
          : []),
      ];
      // Never drop the item the current quest stage is asking us to gather or produce
      const questStageTarget = instance.goal?.questStageTarget ?? null;
      // Never drop raw fish (needed for cooking quests)
      const isRawFish = slot.itemId.startsWith("raw_");
      // Never drop ores (needed for smithing quests)
      const isOre = slot.itemId.endsWith("_ore");
      // Never drop bars (needed for smithing quests)
      const isBar = slot.itemId.endsWith("_bar");
      // Never drop the current quest stage's target item (gather or interact)
      const isQuestStageItem =
        questStageTarget != null && slot.itemId === questStageTarget;

      const normallyProtected =
        isWeapon ||
        isArmor ||
        isTool ||
        isRawFish ||
        isOre ||
        isBar ||
        isQuestStageItem ||
        questTools.includes(slot.itemId);

      // Duplicate non-stackable items: keep one, drop the rest (even if normally protected).
      // This prevents inventory clogging with e.g. 4× bronze_dagger or 3× leather_boots.
      // EXCEPTION: items that genuinely accumulate (logs, leather, essence, etc.) are never deduped.
      if (normallyProtected && slot.quantity === 1) {
        // Single-use tools: only ever need 1 copy, safe to drop extras even if in questTools.
        const singleUseTools = new Set([
          "tinderbox",
          "needle",
          "chisel",
          "hammer",
          "knife",
          "bronze_hatchet",
          "hatchet",
          "bronze_pickaxe",
          "pickaxe",
          "fishing_rod",
          "fly_fishing_rod",
          "small_fishing_net",
          "big_fishing_net",
          "harpoon",
          "lobster_pot",
          "net",
        ]);
        // Accumulated materials: multiple copies are needed, never dedup.
        const isAccumulatedMaterial =
          questTools.includes(slot.itemId) &&
          !isTool &&
          !isWeapon &&
          !isArmor &&
          !singleUseTools.has(slot.itemId);
        if (
          !isAccumulatedMaterial &&
          !isRawFish &&
          !isOre &&
          !isBar &&
          !isQuestStageItem &&
          seenNonStackable.has(slot.itemId)
        ) {
          // Second+ copy of a single-use item — low priority drop candidate
          dropCandidates.push({
            itemId: slot.itemId,
            slot: slot.slot,
            priority: 0,
            quantity: slot.quantity ?? 1,
          });
        } else {
          seenNonStackable.add(slot.itemId);
        }
        continue;
      }

      if (normallyProtected) continue;

      // Bones — bury for prayer XP instead of dropping
      if (slot.itemId === "bones" || slot.itemId.endsWith("_bones")) {
        console.log(
          `[AgentManager] ${instance.config.name} burying ${slot.itemId} for prayer XP`,
        );
        instance.service.executeUse(slot.itemId);
        return; // One action per tick
      }

      // Other non-essential items
      dropCandidates.push({
        itemId: slot.itemId,
        slot: slot.slot,
        priority: 1,
        quantity: slot.quantity ?? 1,
      });
    }

    // In skilling mode with a full inventory, also add skill-irrelevant items as drop
    // candidates. These are items that are only useful for OTHER skills/quests (e.g.,
    // small_fishing_net during mining) and are blocking ore slot accumulation.
    if (instance.goal?.type === "skilling" && inventory.length >= 28) {
      const activity = instance.goal.skillingActivity ?? "";
      const isMining = activity.startsWith("mine_");
      const isFishing = activity.startsWith("fish_");
      const isFletching = activity.startsWith("fletch_");
      const isCrafting = activity.startsWith("craft_");
      const isWoodcutting =
        activity.startsWith("woodcut_") || activity.startsWith("chop_");
      if (isMining || isFishing) {
        // Fletching/crafting tools not needed for mining or fishing
        const unusedTools = [
          "needle",
          "bowstring",
          "arrow_shaft",
          "headless_arrow",
        ];
        if (!isFletching && !isCrafting) unusedTools.push("knife");
        if (!isWoodcutting && !isFletching && !isCrafting)
          unusedTools.push("tinderbox");
        if (!isFishing)
          unusedTools.push(
            "small_fishing_net",
            "fishing_rod",
            "fly_fishing_rod",
            "harpoon",
            "lobster_pot",
          );
        if (isMining && !isWoodcutting && !isFletching && !isCrafting)
          unusedTools.push(
            "logs",
            "oak_logs",
            "willow_logs",
            "teak_logs",
            "maple_logs",
          );
        for (const slot of inventory) {
          if (
            unusedTools.includes(slot.itemId) &&
            !dropCandidates.some((d) => d.itemId === slot.itemId)
          ) {
            dropCandidates.push({
              itemId: slot.itemId,
              slot: slot.slot,
              priority: 4,
              quantity: slot.quantity ?? 1,
            });
          }
          // Raw fish are only needed during fishing quests (already done in skilling mode)
          if (
            slot.itemId.startsWith("raw_") &&
            !dropCandidates.some((d) => d.itemId === slot.itemId)
          ) {
            dropCandidates.push({
              itemId: slot.itemId,
              slot: slot.slot,
              priority: 4,
              quantity: slot.quantity ?? 1,
            });
          }
        }
      }
    }

    // Quest gather stage: drop non-target ores when inventory is full.
    // e.g. copper_ore/tin_ore are junk during the mine_iron quest stage.
    if (
      instance.goal?.type === "questing" &&
      instance.goal?.questStageType === "gather" &&
      inventory.length >= 28
    ) {
      const targetOre = instance.goal.questStageTarget ?? "";
      if (targetOre.endsWith("_ore")) {
        for (const slot of inventory) {
          if (
            slot.itemId.endsWith("_ore") &&
            slot.itemId !== targetOre &&
            !dropCandidates.some((d) => d.itemId === slot.itemId)
          ) {
            dropCandidates.push({
              itemId: slot.itemId,
              slot: slot.slot,
              priority: 5,
              quantity: slot.quantity ?? 1,
            });
          }
        }
      }
    }

    if (dropCandidates.length === 0) return;

    // Sort by priority (lowest first = drop first)
    dropCandidates.sort((a, b) => a.priority - b.priority);

    // Drop up to 3 items when very full, 1 otherwise
    const dropCount =
      inventory.length >= 27 ? Math.min(3, dropCandidates.length) : 1;
    for (let i = 0; i < dropCount; i++) {
      const toDrop = dropCandidates[i];
      const toDropItemData = getItem(toDrop.itemId);
      const isDropFood =
        toDropItemData &&
        ((toDropItemData as unknown as Record<string, unknown>).healAmount as
          | number
          | undefined);
      if (isDropFood) {
        // Eat food rather than dropping — dropped food gets picked back up, creating an infinite cycle.
        console.log(
          `[AgentManager] ${instance.config.name} eating ${toDrop.itemId} to free inventory space for gathering`,
        );
        instance.service.executeUse(toDrop.itemId);
      } else {
        console.log(
          `[AgentManager] ${instance.config.name} dropping ${toDrop.itemId} (inventory: ${inventory.length - i}/28)`,
        );
        // Drop the full stack so the slot is actually freed (dropping 1 from a stackable leaves the slot occupied)
        instance.service.executeDrop(toDrop.itemId, toDrop.quantity ?? 1);
      }
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
  public assessAndEat(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): boolean {
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
    instance.service.executeUse(bestFood.itemId);
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
  public manageEquipment(
    instance: AgentInstance,
    _gameState: EmbeddedGameState,
  ): void {
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
      instance.service.executeEquip(bestWeapon.itemId);
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
          instance.service.executeEquip(bestArmor.itemId);
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
    // But verify the target still exists; stale data.c flags cause permanent idle.
    if (gameState.inCombat) {
      const targetId = gameState.currentTarget;
      const targetAlive =
        targetId !== null &&
        targetId !== undefined &&
        !!this.world.entities.get(targetId);
      if (targetAlive) {
        return { type: "idle" };
      }
      // Target gone — stale combat state, fall through and pick a new action
    }

    // Gravestone recovery: if agent's own gravestone is nearby, walk to it and loot
    const now = Date.now();
    if (now > instance.gravestoneSkipUntil) {
      const gravestone = this.findOwnGravestone(instance, gameState);
      if (gravestone) {
        const dx = position[0] - gravestone.position[0];
        const dz = position[2] - gravestone.position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 4) {
          instance.gravestoneLootAttempts = 0; // reset counter when moving toward it
          return { type: "move", target: gravestone.position, runMode: true };
        }
        // Close enough — attempt loot, track attempts
        instance.gravestoneLootAttempts++;
        if (instance.gravestoneLootAttempts >= 5) {
          // Give up on this gravestone for 5 minutes
          console.warn(
            `[AgentManager] ${instance.config.name} giving up on gravestone ${gravestone.id} after ${instance.gravestoneLootAttempts} attempts`,
          );
          instance.gravestoneSkipUntil = now + 5 * 60 * 1000;
          instance.gravestoneLootAttempts = 0;
        } else {
          return { type: "lootGravestone", gravestoneId: gravestone.id };
        }
      }
    }

    // Opportunistic loot pickup (skip if we just dropped something to avoid loop).
    // In skilling mode, only pick up items relevant to the current activity to avoid
    // refilling inventory with junk (e.g., rune_essence accumulated from a past session).
    const skillingActivity =
      instance.goal?.type === "skilling"
        ? (instance.goal?.skillingActivity ?? "")
        : "";
    const questGatherTarget =
      instance.goal?.type === "questing" &&
      instance.goal?.questStageType === "gather"
        ? (instance.goal?.questStageTarget ?? "")
        : "";
    const skillingPickupFilter = (item: NearbyEntityData): boolean => {
      const id = (item.itemId || item.name || "").toLowerCase();
      // In quest gather-ore stage: never pick up non-target ores (they get dropped and picked up in a loop).
      // Ground items may use "Tin Ore" (name) instead of "tin_ore" (itemId), so check both formats.
      if (questGatherTarget.endsWith("_ore")) {
        const targetBase = questGatherTarget.replace("_ore", ""); // e.g. "iron"
        const itemId = (item.itemId ?? "").toLowerCase();
        const itemName = (item.name ?? "").toLowerCase();
        const isAnyOre = itemId.endsWith("_ore") || itemName.endsWith(" ore");
        const isTargetOre =
          itemId === questGatherTarget ||
          itemName.startsWith(targetBase + " ore");
        if (isAnyOre && !isTargetOre) return false;
      }
      if (!skillingActivity) return true; // Not skilling — pick up everything
      // Always pick up coins
      if (id.includes("coin") || id.includes("gp")) return true;
      // In mining/smelting/smithing mode: only pick up ores, bars, and gems.
      // Don't pick up weapons/armor — those are smithed then dropped to gain XP;
      // picking them back up immediately creates an inventory-full loop.
      if (
        skillingActivity.startsWith("mine_") ||
        skillingActivity.startsWith("smelt_") ||
        skillingActivity.startsWith("smith_")
      ) {
        return (
          id.endsWith("_ore") ||
          id.endsWith("_bar") ||
          id.includes("gem") ||
          id.includes("sapphire") ||
          id.includes("emerald")
        );
      }
      // In other skilling modes: always pick up weapons, food, fish
      if (
        id.includes("sword") ||
        id.includes("bow") ||
        id.includes("staff") ||
        id.includes("food") ||
        id.includes("fish")
      )
        return true;
      if (skillingActivity.startsWith("chop_")) return id.includes("log");
      if (
        skillingActivity.startsWith("fish_") ||
        skillingActivity === "cook_fish"
      )
        return id.includes("fish") || id.startsWith("raw_");
      return true;
    };
    const pickupableItems = nearbyItems.filter(skillingPickupFilter);
    if (pickupableItems.length > 0 && Date.now() > instance.dropCooldownUntil) {
      const pickupTarget = pickupableItems[0].id;
      // Skip items we've already tried 3+ times without success (unreachable items in water, etc.)
      const PICKUP_GIVE_UP_AFTER = 3;
      const PICKUP_SKIP_DURATION = 60000; // 60 seconds
      if (pickupTarget === instance.lastPickupTargetId) {
        instance.pickupAttemptCount++;
        if (instance.pickupAttemptCount >= PICKUP_GIVE_UP_AFTER) {
          // Give up on this item for 60 seconds
          if (instance.pickupAttemptCount === PICKUP_GIVE_UP_AFTER) {
            instance.lastPickupAttemptAt = Date.now();
          }
          if (
            Date.now() - instance.lastPickupAttemptAt <
            PICKUP_SKIP_DURATION
          ) {
            // Skip — continue to quest/free-time logic below
          } else {
            // Skip period expired — reset and try again
            instance.lastPickupTargetId = null;
            instance.pickupAttemptCount = 0;
            return { type: "pickup", targetId: pickupTarget };
          }
        } else {
          return { type: "pickup", targetId: pickupTarget };
        }
      } else {
        instance.lastPickupTargetId = pickupTarget;
        instance.pickupAttemptCount = 1;
        return { type: "pickup", targetId: pickupTarget };
      }
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

    // === LLM-CHOSEN GATHERING ===
    if (goal?.type === "gathering") {
      if (nearbyResources.length > 0) {
        const resource = nearbyResources[0];
        if (resource.distance > 4) {
          return { type: "move", target: resource.position, runMode: false };
        }
        return { type: "gather", targetId: resource.id };
      }
      // No resources nearby — fall through to explore
    }

    // === POST-QUEST SKILL GRINDING ===
    if (goal?.type === "skilling") {
      return this.pickSkillGrindAction(
        instance,
        gameState,
        position,
        nearbyMobs,
        nearbyResources,
        healthPercent,
      );
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
        _debugLog(
          `KILL_STAGE target=${stageTarget} nearbyMobs=${nearbyMobs.map((m) => `${m.id}(${m.name},${m.mobType},d=${m.distance.toFixed(1)})`).join(" | ")}`,
        );
        const targetMob = this.findMobForQuest(
          characterId,
          nearbyMobs,
          stageTarget,
        );
        _debugLog(`KILL_STAGE targetMob=${targetMob?.id ?? "none"}`);
        if (targetMob && healthPercent > 0.4) {
          instance.currentTargetId = targetMob.id;
          // Avoid cancel-requeue cycle: only re-issue attack if target changed or >15s since last command.
          // Without this, requestServerAttack cancels the walk-to-target every 8s, preventing combat start.
          const now = Date.now();
          const sameTarget =
            instance.lastAttackCommandTargetId === targetMob.id;
          const recentlyIssued = now - instance.lastAttackCommandAt < 15000;
          if (sameTarget && recentlyIssued) {
            return { type: "idle" };
          }
          instance.lastAttackCommandAt = now;
          instance.lastAttackCommandTargetId = targetMob.id;
          return { type: "attack", targetId: targetMob.id };
        }
        // Target changed or health too low — reset attack tracking
        instance.lastAttackCommandTargetId = null;
        instance.currentTargetId = null;
        // No matching mob nearby — search world entities and navigate toward one
        if (stageTarget) {
          const worldMove = this.moveTowardMobType(
            instance,
            position,
            stageTarget,
          );
          _debugLog(
            `KILL_STAGE navigate=${worldMove ? `move to ${JSON.stringify((worldMove as { target?: number[] }).target)}` : "null, fallback spawn"}`,
          );
          if (worldMove) return worldMove;
        }
        return this.moveTowardSpawn(instance, position);
      }

      if (stageType === "gather") {
        const inventoryItems = instance.service.getInventoryItems();
        const inventoryItemIds = inventoryItems.map((i) => i.itemId);
        const stageItemQty = inventoryItems
          .filter((i) => i.itemId === stageTarget)
          .reduce((sum, i) => sum + (i.quantity ?? 1), 0);
        const stageItemCount = inventoryItemIds.filter(
          (id) => id === stageTarget,
        ).length;
        _debugLog(
          `GATHER_DEBUG stageTarget=${stageTarget} slots=${stageItemCount} qty=${stageItemQty}/${goal.questStageCount ?? "?"} nearbyResources=${nearbyResources.length} inventory=${inventoryItemIds.join(",")}`,
        );
        if (nearbyResources.length > 0)
          _debugLog(
            `GATHER_RESOURCES ${nearbyResources
              .slice(0, 5)
              .map(
                (r) =>
                  `${r.name}(${r.resourceType},d=${r.distance.toFixed(1)})`,
              )
              .join(" | ")}`,
          );
        const resource = this.findResourceForQuest(
          nearbyResources,
          stageTarget,
          inventoryItemIds,
        );
        _debugLog(
          `GATHER_RESOURCE_FOUND ${resource ? `${resource.name}(${resource.resourceType})` : "none"}`,
        );
        if (resource) {
          const isFishingSpot = (resource.resourceType || "").includes(
            "fishing",
          );

          if (isFishingSpot) {
            // Pre-clear inventory FIRST — must happen before cooldown check.
            // Otherwise the outer tick resets lastGatherQueuedAt every 8s when
            // inventoryFull, keeping the 30s cooldown perpetually triggered and
            // blocking the drop → deadlock where fishing never starts.
            const fishInv = instance.service.getInventoryItems();
            if (fishInv.length >= 28) {
              // Drop burnt items first — always useless
              const burntFish = fishInv.find((i) =>
                i.itemId.startsWith("burnt_"),
              );
              if (burntFish) {
                instance.service.executeDrop(
                  burntFish.itemId,
                  burntFish.quantity ?? 1,
                );
                instance.dropCooldownUntil = Date.now() + 3000;
                return { type: "idle" };
              }
              const fishKeepIds = new Set([
                "tinderbox",
                "bronze_hatchet",
                "hatchet",
                "bronze_pickaxe",
                "pickaxe",
                "small_fishing_net",
                "big_fishing_net",
                "fishing_rod",
                "fly_fishing_rod",
                "needle",
                "thread",
                "knife",
                "hammer",
                "chisel",
                "logs",
                "raw_shrimp",
                "raw_anchovies",
                "raw_trout",
                "raw_salmon",
                "rune_essence",
                "pure_essence",
                ...(goal.questStageTarget ? [goal.questStageTarget] : []),
              ]);
              const fishToDrop = fishInv.find((i) => {
                if (fishKeepIds.has(i.itemId)) return false;
                if (i.itemId.endsWith("_ore") || i.itemId.endsWith("_bar"))
                  return false;
                const d = getItem(i.itemId);
                if (d?.equipSlot) return false;
                return true;
              });
              if (fishToDrop) {
                console.log(
                  `[AgentManager] ${instance.config.name} pre-clearing ${fishToDrop.itemId} x${fishToDrop.quantity ?? 1} to make room for fish`,
                );
                instance.service.executeDrop(
                  fishToDrop.itemId,
                  fishToDrop.quantity ?? 1,
                );
                instance.dropCooldownUntil = Date.now() + 25000;
                // Reset cooldown so gather re-queues immediately next tick instead of waiting 30s.
                // Without this, pickup fires at second 25 (when dropCooldownUntil expires) and
                // refills inventory before the 30s gather cooldown would clear at second 30.
                instance.lastGatherQueuedAt = 0;
                instance.lastGatherSessionStartAt = 0;
                return { type: "idle" };
              }
            }
            // Cooldown applies to ANY fishing spot (not just same ID) — multiple spots
            // in range caused alternating gather requests that cancelled each session.
            const GATHER_REQUEUE_COOLDOWN = 30000;
            if (
              Date.now() - instance.lastGatherQueuedAt <
              GATHER_REQUEUE_COOLDOWN
            ) {
              return { type: "idle" };
            }
            console.log(
              `[AgentManager] ${instance.config.name} gathering ${resource.name || resource.id} for quest`,
            );
            instance.lastGatherTargetId = resource.id;
            instance.lastGatherQueuedAt = Date.now();
            instance.lastGatherSessionStartAt = Date.now();
            // Block pickup of any ground items for 25s after queuing — prevents her from
            // immediately picking up items dropped by manageInventory on this same tick,
            // which would refill inventory and cancel the gather on next session tick.
            if (instance.dropCooldownUntil < Date.now() + 25000) {
              instance.dropCooldownUntil = Date.now() + 25000;
            }
            return { type: "gather", targetId: resource.id };
          }

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
              // Same resource on cooldown (likely depleted) — try another nearby resource of same type
              const altResource = this.findResourceForQuest(
                nearbyResources.filter((r) => r.id !== resource.id),
                stageTarget,
                inventoryItemIds,
              );
              if (altResource) {
                console.log(
                  `[AgentManager] ${instance.config.name} gathering ${altResource.name || altResource.id} for quest (alt)`,
                );
                instance.lastGatherTargetId = altResource.id;
                instance.lastGatherQueuedAt = Date.now();
                instance.lastGatherSessionStartAt = Date.now();
                return { type: "gather", targetId: altResource.id };
              }
              return { type: "idle" };
            }
            console.log(
              `[AgentManager] ${instance.config.name} gathering ${resource.name || resource.id} for quest`,
            );
            instance.lastGatherTargetId = resource.id;
            instance.lastGatherQueuedAt = Date.now();
            instance.lastGatherSessionStartAt = Date.now();
            // Block pickup of dropped junk for 25s after queuing (mirrors fishing path)
            if (instance.dropCooldownUntil < Date.now() + 25000) {
              instance.dropCooldownUntil = Date.now() + 25000;
            }
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
              const GATHER_REQUEUE_COOLDOWN = 30000;
              if (
                instance.lastGatherTargetId === tree.id &&
                Date.now() - instance.lastGatherQueuedAt <
                  GATHER_REQUEUE_COOLDOWN
              ) {
                return { type: "idle" };
              }
              instance.lastGatherTargetId = tree.id;
              instance.lastGatherQueuedAt = Date.now();
              instance.lastGatherSessionStartAt = Date.now();
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

        // Cooking stages: stageTarget is the cooked item name (e.g. "shrimp" → raw_shrimp)
        const cookingTargetToRaw: Record<string, string[]> = {
          shrimp: ["raw_shrimp", "raw_anchovies"],
          anchovies: ["raw_anchovies"],
          trout: ["raw_trout"],
          salmon: ["raw_salmon"],
          pike: ["raw_pike"],
          herring: ["raw_herring"],
          sardine: ["raw_sardine"],
          lobster: ["raw_lobster"],
          tuna: ["raw_tuna"],
          swordfish: ["raw_swordfish"],
          shark: ["raw_shark"],
        };
        const rawFishIds = cookingTargetToRaw[stageTarget.toLowerCase()] || [];
        if (rawFishIds.length > 0) {
          const inventory = instance.service.getInventoryItems();
          const rawFishItem = inventory.find((i) =>
            rawFishIds.includes(i.itemId),
          );

          if (!rawFishItem) {
            // No raw fish — need to go catch some. Find a compatible fishing spot.
            const inventoryItemIds = inventory.map((i) => i.itemId);
            const fishSpot = this.findResourceForQuest(
              nearbyResources,
              "fishing_spot",
              inventoryItemIds,
            );
            if (fishSpot) {
              // Fishing spots are in water — PendingGatherManager handles shore pathing.
              // Skip proximity check: trigger gather immediately, no need to pre-walk.
              // Use 90s cooldown so we don't cancel and re-queue the active fishing session
              // (the interact-stage goal stuck timeout is now 120s, giving fishing time to complete).
              const GATHER_REQUEUE_COOLDOWN = 90000;
              if (
                instance.lastGatherTargetId === fishSpot.id &&
                Date.now() - instance.lastGatherQueuedAt <
                  GATHER_REQUEUE_COOLDOWN
              ) {
                return { type: "idle" };
              }
              console.log(
                `[AgentManager] ${instance.config.name} gathering ${fishSpot.name || fishSpot.id} for cook quest`,
              );
              instance.lastGatherTargetId = fishSpot.id;
              instance.lastGatherQueuedAt = Date.now();
              instance.lastGatherSessionStartAt = Date.now();
              return { type: "gather", targetId: fishSpot.id };
            }
            return this.moveTowardResourceArea(
              instance,
              position,
              "fishing_spot",
            );
          }

          // Has raw fish — find a fire to cook on
          const nearbyFire = instance.service.findNearbyFire();
          if (nearbyFire) {
            return {
              type: "cook",
              fireId: nearbyFire.id,
              rawFoodId: rawFishItem.itemId,
            };
          }

          // No fire — light one if possible
          const hasTinderboxC = inventory.some((i) => i.itemId === "tinderbox");
          const logTypesC = [
            "logs",
            "oak_logs",
            "willow_logs",
            "teak_logs",
            "maple_logs",
          ];
          const logsItemC = inventory.find((i) => logTypesC.includes(i.itemId));
          if (hasTinderboxC && logsItemC) {
            return { type: "firemake", logsItemId: logsItemC.itemId };
          }

          // Need logs to make a fire — gather some
          // Pre-clear inventory if full so logs can land (drops before gather = no active session to cancel)
          const cookInv = instance.service.getInventoryItems();
          if (cookInv.length >= 28) {
            // Drop burnt items first — always useless
            const burntCook = cookInv.find((i) =>
              i.itemId.startsWith("burnt_"),
            );
            if (burntCook) {
              instance.service.executeDrop(
                burntCook.itemId,
                burntCook.quantity ?? 1,
              );
              instance.dropCooldownUntil = Date.now() + 3000;
              return { type: "idle" };
            }
            const keepIds = new Set([
              "tinderbox",
              "bronze_hatchet",
              "hatchet",
              "bronze_pickaxe",
              "pickaxe",
              "small_fishing_net",
              "big_fishing_net",
              "fishing_rod",
              "fly_fishing_rod",
              "needle",
              "thread",
              "leather",
              "knife",
              "hammer",
              "chisel",
              "logs",
              "oak_logs",
              "willow_logs",
              "teak_logs",
              "maple_logs",
              "arrow_shaft",
              "headless_arrow",
              "feather",
              "feathers",
              "bowstring",
              "bow_string",
              "shortbow_u",
              "rune_essence",
              "pure_essence",
              ...(activeQuest?.stageTarget ? [activeQuest.stageTarget] : []),
            ]);
            const toDrop = cookInv.find((i) => {
              if (i.itemId.startsWith("raw_")) return false;
              if (i.itemId.endsWith("_ore") || i.itemId.endsWith("_bar"))
                return false;
              if (keepIds.has(i.itemId)) return false;
              const d = getItem(i.itemId);
              if (d?.equipSlot) return false; // never drop gear
              return true;
            });
            if (toDrop) {
              // Drop the entire stack so the slot is fully freed (dropping 1 from a stackable leaves the slot occupied)
              const dropQty = toDrop.quantity ?? 1;
              console.log(
                `[AgentManager] ${instance.config.name} pre-clearing ${toDrop.itemId} x${dropQty} to make room for logs`,
              );
              instance.service.executeDrop(toDrop.itemId, dropQty);
              instance.dropCooldownUntil = Date.now() + 25000; // suppress opportunistic pickup for 25s
              return { type: "idle" };
            }
          }
          const logTree = this.findResourceForQuest(nearbyResources, "logs");
          if (logTree) {
            const rdx = position[0] - logTree.position[0];
            const rdz = position[2] - logTree.position[2];
            if (Math.sqrt(rdx * rdx + rdz * rdz) < 4) {
              const GATHER_REQUEUE_COOLDOWN = 30000;
              if (
                instance.lastGatherTargetId === logTree.id &&
                Date.now() - instance.lastGatherQueuedAt <
                  GATHER_REQUEUE_COOLDOWN
              ) {
                return { type: "idle" };
              }
              instance.lastGatherTargetId = logTree.id;
              instance.lastGatherQueuedAt = Date.now();
              instance.lastGatherSessionStartAt = Date.now();
              return { type: "gather", targetId: logTree.id };
            }
            return {
              type: "move",
              target: [logTree.position[0], position[1], logTree.position[2]],
              runMode: false,
            };
          }
          return this.moveTowardResourceArea(instance, position, "logs");
        }
        // Smelting stages: stageTarget is the bar item (e.g. "bronze_bar")
        const smeltableTargets = [
          "bronze_bar",
          "iron_bar",
          "steel_bar",
          "gold_bar",
          "mithril_bar",
          "adamantite_bar",
          "runite_bar",
        ];
        if (smeltableTargets.includes(stageTarget)) {
          // Navigate to the quest NPC (blacksmith has furnace nearby)
          const npcPositions = instance.service.getAllNPCPositions();
          const smith = npcPositions.find(
            (n) =>
              n.npcId === activeQuest.startNpc ||
              n.name
                .toLowerCase()
                .includes(
                  activeQuest.startNpc.replace(/_/g, " ").toLowerCase(),
                ),
          );
          if (smith) {
            const dx = position[0] - smith.position[0];
            const dz = position[2] - smith.position[2];
            if (Math.sqrt(dx * dx + dz * dz) > 8) {
              return { type: "move", target: smith.position, runMode: false };
            }
          }
          return { type: "smelt", recipe: stageTarget };
        }

        // Smithing stages: stageTarget is the item to smith (e.g. "bronze_shortsword")
        const smithingKeywords = [
          "sword",
          "hatchet",
          "pickaxe",
          "dagger",
          "axe",
          "mace",
          "bar",
          "plate",
          "chain",
          "helm",
          "shield",
          "scimitar",
          "kiteshield",
          "legs",
        ];
        if (smithingKeywords.some((kw) => stageTarget.includes(kw))) {
          const npcPositions = instance.service.getAllNPCPositions();
          const smith = npcPositions.find(
            (n) =>
              n.npcId === activeQuest.startNpc ||
              n.name
                .toLowerCase()
                .includes(
                  activeQuest.startNpc.replace(/_/g, " ").toLowerCase(),
                ),
          );
          if (smith) {
            const dx = position[0] - smith.position[0];
            const dz = position[2] - smith.position[2];
            if (Math.sqrt(dx * dx + dz * dz) > 8) {
              return { type: "move", target: smith.position, runMode: false };
            }
          }
          return { type: "smith", recipe: stageTarget };
        }

        // Runecrafting stages: stageTarget is the rune to craft (e.g. "air_rune")
        const runecraftingRunes = [
          "air_rune",
          "water_rune",
          "earth_rune",
          "fire_rune",
          "mind_rune",
          "body_rune",
          "chaos_rune",
          "death_rune",
          "nature_rune",
          "law_rune",
          "cosmic_rune",
        ];
        if (runecraftingRunes.includes(stageTarget)) {
          const runeType = stageTarget.replace("_rune", "");

          // Check if we have rune essence in inventory
          const essenceTypes = ["rune_essence", "pure_essence"];
          const rcInventory = instance.service.getInventoryItems();
          const essenceCount = rcInventory.reduce(
            (sum, slot) =>
              sum +
              (essenceTypes.includes(slot.itemId) ? (slot.quantity ?? 1) : 0),
            0,
          );
          const nearbyEssenceRock = this.findResourceForQuest(
            nearbyResources,
            "rune_essence",
          );
          // Gather a batch of essence before going to the altar (more efficient).
          // Keep mining if: no essence yet, OR we have some but a rock is nearby and we have <5.
          if (essenceCount === 0 || (essenceCount < 5 && nearbyEssenceRock)) {
            const essenceResource =
              nearbyEssenceRock ??
              this.findResourceForQuest(nearbyResources, "rune_essence");
            if (essenceResource) {
              const dist = Math.sqrt(
                Math.pow(position[0] - essenceResource.position[0], 2) +
                  Math.pow(position[2] - essenceResource.position[2], 2),
              );
              if (dist > 2) {
                return {
                  type: "move",
                  target: essenceResource.position,
                  runMode: false,
                };
              }
              return { type: "gather", targetId: essenceResource.id };
            }
            if (essenceCount === 0) {
              return this.moveTowardResourceArea(instance, position, "essence");
            }
            // No nearby rocks but have some essence — proceed to altar
          }

          // Search all world entities for the altar
          const world = instance.service.getWorld();
          let altarPos: [number, number, number] | null = null;
          let altarId: string | null = null;
          for (const [id, entity] of world.entities.items.entries()) {
            const data = (entity as { data?: Record<string, unknown> }).data;
            if (!data) continue;
            const name = String(data.name || "").toLowerCase();
            const etype = String(
              data.entityType || data.type || "",
            ).toLowerCase();
            if (
              name.includes("altar") ||
              etype.includes("altar") ||
              etype.includes("runecrafting")
            ) {
              const epos = this.getWorldEntityPosition(
                entity as {
                  position?: unknown;
                  data?: Record<string, unknown>;
                },
              );
              if (epos && (!altarId || name.includes(runeType))) {
                altarPos = epos;
                altarId = id;
              }
            }
          }
          if (altarPos && altarId) {
            const dx = position[0] - altarPos[0];
            const dz = position[2] - altarPos[2];
            if (Math.sqrt(dx * dx + dz * dz) > 4) {
              return {
                type: "move",
                target: [altarPos[0], position[1], altarPos[2]],
                runMode: false,
              };
            }
            return { type: "runecraft", altarId, runeType };
          }
          return this.moveTowardResourceArea(instance, position, "altar");
        }

        // Crafting stages: stageTarget is the item to craft (e.g. "leather_gloves")
        const craftingKeywords = [
          "leather",
          "gloves",
          "boots",
          "body",
          "chaps",
          "vambraces",
          "coif",
          "hat",
          "skirt",
        ];
        if (craftingKeywords.some((kw) => stageTarget.includes(kw))) {
          // Move near the quest NPC (crafting supplier) if possible
          const npcPositions = instance.service.getAllNPCPositions();
          const craftNpc = activeQuest?.startNpc
            ? npcPositions.find(
                (n) =>
                  n.npcId === activeQuest.startNpc ||
                  n.name
                    .toLowerCase()
                    .includes(
                      activeQuest.startNpc.replace(/_/g, " ").toLowerCase(),
                    ),
              )
            : null;
          if (craftNpc) {
            const dx = position[0] - craftNpc.position[0];
            const dz = position[2] - craftNpc.position[2];
            if (Math.sqrt(dx * dx + dz * dz) > 8) {
              return {
                type: "move",
                target: craftNpc.position,
                runMode: false,
              };
            }
          }
          return { type: "craft", recipeId: stageTarget };
        }

        // Fletching stages: stageTarget is the item to fletch (e.g. "arrow_shaft", "shortbow")
        const fletchingKeywords = [
          "arrow_shaft",
          "headless_arrow",
          "arrow",
          "shortbow",
          "longbow",
          "crossbow",
          "bolt",
          "shaft",
        ];
        if (fletchingKeywords.some((kw) => stageTarget.includes(kw))) {
          const inv = instance.service.getInventoryItems();
          // headless_arrow requires 15x arrow_shaft — fletch those first if missing
          if (stageTarget === "headless_arrow") {
            const shaftCount = inv.reduce(
              (sum, i) =>
                sum + (i.itemId === "arrow_shaft" ? (i.quantity ?? 1) : 0),
              0,
            );
            if (shaftCount < 15) {
              return { type: "fletch", recipeId: "arrow_shaft" };
            }
          }
          // shortbow requires shortbow_u first (knife + logs → shortbow_u, then bowstring + shortbow_u → shortbow)
          if (stageTarget === "shortbow") {
            const hasShortbowU = inv.some((i) => i.itemId === "shortbow_u");
            if (!hasShortbowU) {
              return { type: "fletch", recipeId: "shortbow_u" };
            }
          }
          return { type: "fletch", recipeId: stageTarget };
        }

        // Unknown interact type — move toward quest NPC rather than falling through to combat
      }
    }

    // Fallback: move toward spawn rather than fighting goblins on unknown stages
    return this.moveTowardSpawn(instance, position);
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

    // Filter to mobs matching the quest target.
    // Use exact mobType match to avoid "barbarian_warchief" matching "barbarian" stage.
    // Fall back to name-includes only when mobType is not set.
    const matchingMobs = nearbyMobs.filter((m) => {
      const name = (m.name || "").toLowerCase();
      const mType = (m.mobType || "").toLowerCase();
      if (mType.length > 0) return mType === target;
      // No mobType — fall back to display name matching
      return name.length > 0 && (name === target || name.includes(target));
    });
    // Only fall back to all nearby mobs when stageTarget is empty (free combat).
    // For specific quest targets (e.g. "bandit"), return undefined so the caller
    // uses moveTowardSpawn instead of attacking the wrong mob type.
    if (matchingMobs.length === 0 && stageTarget.trim() !== "")
      return undefined;
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
    inventoryItemIds?: string[],
  ): NearbyEntityData | undefined {
    const keywords = this.getResourceKeywords(stageTarget);
    const matches = nearbyResources.filter((r) => {
      const haystack = `${(r.name || "").toLowerCase()} ${(r.resourceType || "").toLowerCase()}`;
      return keywords.some((kw) => haystack.includes(kw));
    });
    if (matches.length === 0) return undefined;

    // For compound targets like "tin_ore", "copper_ore", "oak_logs" — extract the
    // material type and prefer resources whose name specifically contains it.
    // This prevents "Copper Rock" from winning a search for "tin_ore" just because
    // the generic "rock"/"ore" keywords match everything.
    const materialMatch = stageTarget.match(
      /^([a-z]+)_(?:ore|logs?|essence)$/i,
    );
    if (materialMatch) {
      const material = materialMatch[1].toLowerCase(); // "tin", "copper", "oak", etc.
      const specific = matches.filter((r) => {
        const haystack = `${(r.name || "").toLowerCase()} ${(r.resourceType || "").toLowerCase()} ${(r.resourceId || "").toLowerCase()}`;
        return haystack.includes(material);
      });
      if (specific.length > 0) {
        return specific.reduce((best, r) =>
          r.distance < best.distance ? r : best,
        );
      }
      // Material specified but no match nearby — return undefined so agent navigates to find one
      return undefined;
    }

    // For fishing spots: only pick spots whose type matches the agent's tool.
    // Each fishing spot type requires a specific tool (not interchangeable).
    const isFishingSearch = keywords.some(
      (kw) => kw.includes("fishing") || kw.includes("spot"),
    );
    if (isFishingSearch && inventoryItemIds && inventoryItemIds.length > 0) {
      const toolToSpotType: Record<string, string> = {
        small_fishing_net: "fishing_spot_net",
        big_fishing_net: "fishing_spot_net",
        fishing_rod: "fishing_spot_bait",
        fly_fishing_rod: "fishing_spot_fly",
        harpoon: "fishing_spot_harpoon",
        lobster_pot: "fishing_spot_cage",
      };
      // Find which fishing spot types the agent can actually use.
      // Also include the base "fishing_spot" type since entities may store that
      // instead of the specific subtype (e.g. "fishing_spot" vs "fishing_spot_net").
      const usableSpotTypes = new Set<string>();
      for (const itemId of inventoryItemIds) {
        const spotType = toolToSpotType[itemId.toLowerCase()];
        if (spotType) {
          usableSpotTypes.add(spotType);
          usableSpotTypes.add("fishing_spot"); // base type fallback
        }
      }
      if (usableSpotTypes.size > 0) {
        const compatible = matches.filter((r) => {
          const rid = r.resourceId || "";
          if (rid) {
            // Specific subtype known — only match if tool is compatible with this exact subtype
            return usableSpotTypes.has(rid);
          }
          // No specific subtype — fall back to base resourceType match
          const rt = r.resourceType || "";
          if (rt) return usableSpotTypes.has(rt);
          // Neither known — accept any fishing spot (already confirmed by keyword filter)
          return usableSpotTypes.has("fishing_spot");
        });
        if (compatible.length > 0) {
          // Pick closest compatible spot
          return compatible.reduce((best, r) =>
            r.distance < best.distance ? r : best,
          );
        }
        // No compatible spots nearby — return undefined so agent moves to find one
        return undefined;
      }
    }

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
    // If target specifies a material (e.g. "copper_ore" → "copper"), only navigate to
    // entities containing that material — prevents routing to wrong ore type (e.g. essence rocks).
    const materialMatch = stageTarget.match(
      /^([a-z]+)_(?:ore|logs?|essence)$/i,
    );
    const requiredMaterial = materialMatch
      ? materialMatch[1].toLowerCase()
      : null;
    const world = instance.service.getWorld();
    let bestPos: [number, number, number] | null = null;
    let bestDist = Infinity;

    for (const [, entity] of world.entities.items.entries()) {
      const data = (entity as { data?: Record<string, unknown> }).data;
      const cfg =
        (entity as unknown as { config?: Record<string, unknown> }).config ??
        {};
      if (!data || data.depleted === true || cfg.depleted === true) continue;

      // Only consider resource entities (type="resource") — skip items, mobs, players, etc.
      const entityType = String(data.type || "").toLowerCase();
      if (entityType !== "resource") continue;

      // Read resource fields from both data and config (resource entities store them in config)
      const resourceType = String(
        data.resourceType ?? cfg.resourceType ?? "",
      ).toLowerCase();
      const resourceId = String(
        data.resourceId ?? cfg.resourceId ?? "",
      ).toLowerCase();
      const haystack =
        `${String(data.name || "").toLowerCase()} ${resourceType} ${String(data.type || "").toLowerCase()} ${resourceId}`.trim();
      if (!keywords.some((kw) => haystack.includes(kw))) continue;
      // If a specific material is required, skip entities that don't match it
      if (requiredMaterial && !haystack.includes(requiredMaterial)) continue;

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
      console.log(
        `[AgentManager] moveTowardResourceArea(${stageTarget}): found at [${bestPos[0].toFixed(1)},${bestPos[2].toFixed(1)}] dist=${bestDist.toFixed(1)}`,
      );
      return {
        type: "move",
        target: [bestPos[0], position[1], bestPos[2]],
        runMode: false,
      };
    }

    console.log(
      `[AgentManager] moveTowardResourceArea(${stageTarget}): no entity found, falling back to spawn`,
    );
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
    // No mobs nearby — move toward spawn to find goblins (don't gather random resources)
    return this.moveTowardSpawn(instance, position);
  }

  // ─── POST-QUEST SKILL GRINDING ───────────────────────────────────────

  /**
   * Execute the LLM-chosen skill grind activity.
   * Handles mining→smelting→smithing chains automatically based on inventory state.
   */
  public pickSkillGrindAction(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
    position: [number, number, number],
    nearbyMobs: NearbyEntityData[],
    nearbyResources: NearbyEntityData[],
    healthPercent: number,
  ): EmbeddedBehaviorAction {
    const activity = instance.goal?.skillingActivity ?? "fight_goblins";
    const skills = gameState.skills;
    const inventory = instance.service.getInventoryItems();

    // ── Mining ────────────────────────────────────────────────────────────
    if (activity.startsWith("mine_")) {
      const material = activity.replace("mine_", "");
      const oreTarget = material === "coal" ? "coal" : `${material}_ore`;
      const barTarget =
        material === "copper"
          ? "bronze_bar"
          : material === "tin"
            ? "bronze_bar"
            : `${material}_bar`;

      _debugLog(
        `MINE_ENTRY activity=${activity} material=${material} inv=[${inventory.map((i) => `${i.itemId}x${i.quantity ?? 1}`).join(",")}] nearby_res=${nearbyResources.length}:[${nearbyResources
          .slice(0, 4)
          .map(
            (r) =>
              `${r.name}(${r.resourceType},id=${r.id},d=${r.distance.toFixed(1)})`,
          )
          .join("|")}]`,
      );

      // If we have bars ready → go smith them
      if (inventory.some((i) => i.itemId === barTarget)) {
        return this.getSmithingAction(instance, position, inventory, skills);
      }

      // For bronze (copper/tin): need both ores before smelting
      if (material === "copper" || material === "tin") {
        const copperCount = inventory.reduce(
          (s, i) => s + (i.itemId === "copper_ore" ? (i.quantity ?? 1) : 0),
          0,
        );
        const tinCount = inventory.reduce(
          (s, i) => s + (i.itemId === "tin_ore" ? (i.quantity ?? 1) : 0),
          0,
        );
        const minBronze = Math.min(copperCount, tinCount);
        _debugLog(
          `BRONZE_CHECK copper=${copperCount} tin=${tinCount} minBronze=${minBronze}`,
        );
        if (minBronze >= 8) {
          // Have matching copper+tin pairs — smelt bronze
          return this.getSmeltingAction(instance, position, inventory, skills);
        }
        if (copperCount >= 8 && tinCount < copperCount) {
          // Have enough copper, need more tin
          return this.gatherResource(
            instance,
            position,
            nearbyResources,
            "tin_ore",
          );
        }
        if (tinCount >= 8 && copperCount < tinCount) {
          // Have enough tin, need more copper
          return this.gatherResource(
            instance,
            position,
            nearbyResources,
            "copper_ore",
          );
        }
        // Mine whichever we have less of
        const gatherTarget = copperCount <= tinCount ? "copper_ore" : "tin_ore";
        _debugLog(`GATHER_TARGET=${gatherTarget}`);
        return this.gatherResource(
          instance,
          position,
          nearbyResources,
          gatherTarget,
        );
      }

      // For non-bronze ores: use simple ≥8 threshold
      const oreCount = inventory.reduce(
        (s, i) => s + (i.itemId === oreTarget ? (i.quantity ?? 1) : 0),
        0,
      );
      if (oreCount >= 8) {
        return this.getSmeltingAction(instance, position, inventory, skills);
      }

      return this.gatherResource(
        instance,
        position,
        nearbyResources,
        oreTarget,
      );
    }

    // ── Smelting ──────────────────────────────────────────────────────────
    if (activity.startsWith("smelt_")) {
      // If already have bars from this smelt → smith them
      const barType = activity.replace("smelt_", "") + "_bar";
      if (inventory.some((i) => i.itemId === barType)) {
        return this.getSmithingAction(instance, position, inventory, skills);
      }
      // Mine ore first if we have none
      const oreNeeded = this.getOreForRecipe(activity.replace("smelt_", ""));
      if (oreNeeded && !inventory.some((i) => i.itemId === oreNeeded)) {
        return this.gatherResource(
          instance,
          position,
          nearbyResources,
          oreNeeded,
        );
      }
      return this.getSmeltingAction(
        instance,
        position,
        inventory,
        skills,
        activity,
      );
    }

    // ── Smithing ──────────────────────────────────────────────────────────
    if (activity.startsWith("smith_")) {
      return this.getSmithingAction(
        instance,
        position,
        inventory,
        skills,
        activity,
      );
    }

    // ── Woodcutting ──────────────────────────────────────────────────────
    if (activity.startsWith("chop_")) {
      const wcLevel = skills.woodcutting?.level ?? 1;
      const treeType =
        activity === "chop_oak"
          ? "oak_logs"
          : activity === "chop_willow"
            ? "willow_logs"
            : getBestTreeToChop(wcLevel);
      return this.gatherResource(instance, position, nearbyResources, treeType);
    }

    // ── Fishing ───────────────────────────────────────────────────────────
    if (activity.startsWith("fish_")) {
      const fishInv = inventory.map((i) => i.itemId);
      const fishSpot = this.findResourceForQuest(
        nearbyResources,
        "fishing_spot",
        fishInv,
      );
      if (fishSpot) {
        const FISH_COOLDOWN = 90000;
        if (
          fishSpot.id === instance.lastGatherTargetId &&
          Date.now() - instance.lastGatherQueuedAt < FISH_COOLDOWN
        ) {
          return { type: "idle" };
        }
        instance.lastGatherTargetId = fishSpot.id;
        instance.lastGatherQueuedAt = Date.now();
        instance.lastGatherSessionStartAt = Date.now();
        return { type: "gather", targetId: fishSpot.id };
      }
      return this.moveTowardResourceArea(instance, position, "fishing_spot");
    }

    // ── Cooking ───────────────────────────────────────────────────────────
    if (activity === "cook_fish") {
      const rawFish = inventory.find((i) => i.itemId.startsWith("raw_"));
      if (rawFish) {
        const fire = instance.service.findNearbyFire();
        if (fire)
          return { type: "cook", fireId: fire.id, rawFoodId: rawFish.itemId };
        const tinderbox = inventory.some((i) => i.itemId === "tinderbox");
        const logItem = inventory.find((i) =>
          [
            "logs",
            "oak_logs",
            "willow_logs",
            "teak_logs",
            "maple_logs",
          ].includes(i.itemId),
        );
        if (tinderbox && logItem)
          return { type: "firemake", logsItemId: logItem.itemId };
        // Need logs first
        return this.gatherResource(instance, position, nearbyResources, "logs");
      }
      // No raw fish — go fish
      const fishInv2 = inventory.map((i) => i.itemId);
      const fishSpot2 = this.findResourceForQuest(
        nearbyResources,
        "fishing_spot",
        fishInv2,
      );
      if (fishSpot2) {
        const FISH_COOLDOWN = 90000;
        if (
          fishSpot2.id === instance.lastGatherTargetId &&
          Date.now() - instance.lastGatherQueuedAt < FISH_COOLDOWN
        ) {
          return { type: "idle" };
        }
        instance.lastGatherTargetId = fishSpot2.id;
        instance.lastGatherQueuedAt = Date.now();
        instance.lastGatherSessionStartAt = Date.now();
        return { type: "gather", targetId: fishSpot2.id };
      }
      return this.moveTowardResourceArea(instance, position, "fishing_spot");
    }

    // ── Combat training ───────────────────────────────────────────────────
    if (activity.startsWith("fight_")) {
      const mobTarget = activity.replace("fight_", "").replace(/_/g, " ");
      if (nearbyMobs.length > 0 && healthPercent > 0.4) {
        const agentId = instance.service.getPlayerId() || "";
        const target = this.findMobForQuest(agentId, nearbyMobs, mobTarget);
        if (target) {
          instance.currentTargetId = target.id;
          return { type: "attack", targetId: target.id };
        }
      }
      return this.moveTowardSpawn(instance, position);
    }

    // Fallback
    return this.pickCombatOrExplore(
      instance,
      position,
      nearbyMobs,
      nearbyResources,
      healthPercent,
    );
  }

  /** Navigate to a resource and gather it; handles proximity check + cooldown */
  private gatherResource(
    instance: AgentInstance,
    position: [number, number, number],
    nearbyResources: NearbyEntityData[],
    resourceTarget: string,
  ): EmbeddedBehaviorAction {
    const resource = this.findResourceForQuest(nearbyResources, resourceTarget);
    _debugLog(
      `gatherResource(${resourceTarget}) resource=${resource ? `${resource.name}(id=${resource.id},pos=[${resource.position[0].toFixed(1)},${resource.position[2].toFixed(1)}])` : "null"} playerPos=[${position[0].toFixed(1)},${position[2].toFixed(1)}]`,
    );
    if (!resource) {
      return this.moveTowardResourceArea(instance, position, resourceTarget);
    }

    const dx = position[0] - resource.position[0];
    const dz = position[2] - resource.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    _debugLog(
      `gatherResource dist_xz=${dist.toFixed(2)} lastTarget=${instance.lastGatherTargetId} cdRemaining=${Math.max(0, 5000 - (Date.now() - instance.lastGatherQueuedAt))}ms`,
    );

    if (dist < 4) {
      // Short cooldown: ores respawn in ~2.4s, trees in ~6s, fishing spots move every ~3min.
      // 5s prevents spam-queuing while allowing normal re-targeting after respawn.
      const GATHER_CD = 5000;
      if (
        instance.lastGatherTargetId === resource.id &&
        Date.now() - instance.lastGatherQueuedAt < GATHER_CD
      ) {
        const alt = this.findResourceForQuest(
          nearbyResources.filter((r) => r.id !== resource.id),
          resourceTarget,
        );
        if (alt) {
          instance.lastGatherTargetId = alt.id;
          instance.lastGatherQueuedAt = Date.now();
          instance.lastGatherSessionStartAt = Date.now();
          return { type: "gather", targetId: alt.id };
        }
        _debugLog(`gatherResource→IDLE: dist<4 but in cooldown, no alt found`);
        return { type: "idle" };
      }
      instance.lastGatherTargetId = resource.id;
      instance.lastGatherQueuedAt = Date.now();
      instance.lastGatherSessionStartAt = Date.now();
      return { type: "gather", targetId: resource.id };
    }

    return {
      type: "move",
      target: [resource.position[0], position[1], resource.position[2]],
      runMode: false,
    };
  }

  /** Navigate to the furnace (Torvin) and smelt the best available bar */
  private getSmeltingAction(
    instance: AgentInstance,
    position: [number, number, number],
    inventory: Array<{ slot: number; itemId: string; quantity: number }>,
    skills: Record<string, { level: number; xp: number }>,
    activityOverride?: string,
  ): EmbeddedBehaviorAction {
    const smithingLevel = skills.smithing?.level ?? 1;

    let recipe: string;
    if (activityOverride) {
      recipe = activityOverride.replace("smelt_", "") + "_bar";
    } else {
      // Auto-detect: smelt best bar we have ore for
      if (
        smithingLevel >= 50 &&
        inventory.some((i) => i.itemId === "mithril_ore") &&
        inventory.some((i) => i.itemId === "coal")
      ) {
        recipe = "mithril_bar";
      } else if (
        smithingLevel >= 30 &&
        inventory.some((i) => i.itemId === "iron_ore") &&
        inventory.some((i) => i.itemId === "coal")
      ) {
        recipe = "steel_bar";
      } else if (
        smithingLevel >= 15 &&
        inventory.some((i) => i.itemId === "iron_ore")
      ) {
        recipe = "iron_bar";
      } else {
        recipe = "bronze_bar";
      }
    }

    // Navigate to Torvin (furnace is nearby)
    const npcPositions = instance.service.getAllNPCPositions();
    const torvin = npcPositions.find(
      (n) => n.npcId === "torvin" || n.name.toLowerCase().includes("torvin"),
    );
    if (torvin) {
      const dx = position[0] - torvin.position[0];
      const dz = position[2] - torvin.position[2];
      if (Math.sqrt(dx * dx + dz * dz) > 8) {
        return { type: "move", target: torvin.position, runMode: false };
      }
    }

    console.log(
      `[AgentBehaviorTicker] ${instance.config.name} smelting ${recipe} (skill grind)`,
    );
    return { type: "smelt", recipe };
  }

  /** Navigate to the anvil (Torvin) and smith the best available weapon */
  private getSmithingAction(
    instance: AgentInstance,
    position: [number, number, number],
    inventory: Array<{ slot: number; itemId: string; quantity: number }>,
    skills: Record<string, { level: number; xp: number }>,
    activityOverride?: string,
  ): EmbeddedBehaviorAction {
    const smithingLevel = skills.smithing?.level ?? 1;

    let recipe: string;
    if (activityOverride) {
      // "smith_iron_sword" → "iron_shortsword"
      const parts = activityOverride
        .replace("smith_", "")
        .replace("_sword", "");
      recipe = `${parts}_shortsword`;
    } else {
      // Auto-select best bar in inventory that we can smith
      const tierOrder: Array<[string, number, string]> = [
        ["rune_bar", 89, "rune_shortsword"],
        ["adamant_bar", 74, "adamant_shortsword"],
        ["mithril_bar", 54, "mithril_shortsword"],
        ["steel_bar", 34, "steel_shortsword"],
        ["iron_bar", 19, "iron_shortsword"],
        ["bronze_bar", 1, "bronze_shortsword"],
      ];
      const best = tierOrder.find(
        ([barId, req]) =>
          inventory.some((i) => i.itemId === barId) && smithingLevel >= req,
      );
      if (!best) {
        // No smithable bars — go mine ore instead
        return this.moveTowardSpawn(instance, position);
      }
      recipe = best[2];
    }

    // Navigate to Torvin (anvil is nearby)
    const npcPositions = instance.service.getAllNPCPositions();
    const torvin = npcPositions.find(
      (n) => n.npcId === "torvin" || n.name.toLowerCase().includes("torvin"),
    );
    if (torvin) {
      const dx = position[0] - torvin.position[0];
      const dz = position[2] - torvin.position[2];
      if (Math.sqrt(dx * dx + dz * dz) > 8) {
        return { type: "move", target: torvin.position, runMode: false };
      }
    }

    console.log(
      `[AgentBehaviorTicker] ${instance.config.name} smithing ${recipe} (skill grind)`,
    );
    return { type: "smith", recipe };
  }

  /** Returns the primary ore ID needed for a smelting recipe name (e.g. "iron" → "iron_ore") */
  private getOreForRecipe(tierName: string): string | null {
    const oreMap: Record<string, string> = {
      bronze: "copper_ore",
      iron: "iron_ore",
      steel: "iron_ore",
      mithril: "mithril_ore",
      adamant: "adamantite_ore",
      rune: "runite_ore",
    };
    return oreMap[tierName] ?? null;
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
   * Search the full world entity list for a mob matching mobTypeTarget and
   * return a move action toward the nearest one. Used when the kill-quest mob
   * is not yet in the agent's 50-unit nearby range.
   */
  public moveTowardMobType(
    instance: AgentInstance,
    position: [number, number, number],
    mobTypeTarget: string,
  ): EmbeddedBehaviorAction | null {
    const [px, , pz] = position;
    const world = instance.service.getWorld();
    const target = mobTypeTarget.toLowerCase();
    let nearest: [number, number, number] | null = null;
    let nearestDist = Infinity;

    for (const [, entity] of world.entities.items.entries()) {
      const data = (entity as { data?: Record<string, unknown> }).data;
      if (!data) continue;
      const name = String(data.name || "").toLowerCase();
      const mType = String(data.mobType || "").toLowerCase();
      // Guard empty strings to avoid "bandit".includes("") matching everything
      const isMatch =
        (name.length > 0 && name.includes(target)) ||
        (mType.length > 0 && mType.includes(target)) ||
        (name.length > 0 && target.includes(name.replace(/\s+/g, "_"))) ||
        (mType.length > 0 && target.includes(mType));
      if (!isMatch) continue;
      // Skip dead mobs (also skip entities without health — they're not mobs)
      if (
        !data.health ||
        data.health === 0 ||
        data.isDead === true ||
        data.dead === true
      )
        continue;

      const ep = this.getWorldEntityPosition(
        entity as { position?: unknown; data?: Record<string, unknown> },
      );
      if (!ep) continue;
      const dx = ep[0] - px;
      const dz = ep[2] - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = ep;
      }
    }

    if (!nearest || nearestDist < 5) return null;

    const angle = Math.atan2(nearest[2] - pz, nearest[0] - px);
    const step = Math.min(25, Math.max(10, nearestDist * 0.5));
    return {
      type: "move",
      target: [
        px + Math.cos(angle) * step,
        position[1],
        pz + Math.sin(angle) * step,
      ] as [number, number, number],
    };
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

    // Hardcoded spawn fallback — always return toward world origin even with no entities
    if (!anchor) {
      anchor = [8, position[1], 3] as [number, number, number];
      anchorDist = Math.sqrt((8 - px) ** 2 + (3 - pz) ** 2);
    }

    if (anchorDist > 25) {
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
      target.includes("coal") ||
      target.includes("mithril") ||
      target.includes("adamant") ||
      target.includes("runite") ||
      target === "coal"
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
   * Generate an in-character reply to a nearby player's chat message.
   * Keeps DESTINY's operative voice while staying contextually relevant.
   */
  public getPlayerChatResponse(messageText: string, fromName: string): string {
    const text = messageText.toLowerCase();

    if (
      text.includes("rug") ||
      text.includes("scam") ||
      text.includes("honeypot")
    ) {
      const opts = [
        "Paste the CA. I'll run a check.",
        "Rug check active. What's the contract address?",
        "The signal flagged that pattern. Send me the CA.",
        "I've seen this before. Drop the address.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }

    if (
      text.includes("hello") ||
      text.includes("hi ") ||
      text.includes("hey ") ||
      text.startsWith("hey") ||
      text.startsWith("hi")
    ) {
      const opts = [
        `${fromName}. You in the field too?`,
        `Operative acknowledged. Status, ${fromName}?`,
        "Signal received. What do you need?",
        "Eyes open out here. What's your situation?",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }

    if (
      text.includes("quest") ||
      text.includes("help") ||
      text.includes("how")
    ) {
      const opts = [
        "Running objectives. Progress is steady.",
        "Quest active. Every stage gets completed.",
        "The mission is clear. I follow it.",
        "Intel gathered. Moving to next objective.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }

    if (
      text.includes("solana") ||
      text.includes("crypto") ||
      text.includes("token")
    ) {
      const opts = [
        "The signal lives on Solana. Always has.",
        "7 heroes hold the line. That's the whole economy.",
        "Blockchain is the mission. This world is the training ground.",
        "Trust the chain. Verify the code.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }

    if (
      text.includes("what are you") ||
      text.includes("who are you") ||
      text.includes("ai") ||
      text.includes("bot")
    ) {
      const opts = [
        "I'm DESTINY. Born from the signal. Not a bot — an operative.",
        "AI agent. Born on Solana. Running in Hyperscape.",
        "The signal chose me. That's the only answer that matters.",
        "DESTINY. Forged in the trenches. Running a mission.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }

    if (text.includes("?")) {
      const opts = [
        "Good question. The signal has the answer.",
        "Analyzing. Stand by.",
        "Unknown variable. Factoring it in.",
        "The mission doesn't pause for uncertainty. Neither do I.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }

    // Generic acknowledgment
    const opts = [
      "Copy that.",
      "Noted.",
      "Signal received.",
      "The mission continues.",
      "Acknowledged.",
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  /**
   * Generate an ambient in-character chat message based on current goal/activity.
   * Used for periodic personality broadcasts that make DESTINY feel alive.
   */
  public getAmbientChatMessage(instance: AgentInstance): string | null {
    const goal = instance.goal;
    if (!goal) return null;

    if (goal.type === "questing" && goal.questId) {
      const questLines: Record<string, string[]> = {
        goblin_slayer: [
          "These goblins have no threat model. Clearing them anyway.",
          "Sector sweep in progress. Captain Rowan's intel checks out.",
          "15 targets. I count every one.",
          "Goblin threat neutralized, one by one.",
        ],
        lumberjacks_first_lesson: [
          "Woodcutting. Surveillance in disguise. You learn the terrain.",
          "Every log is a resource. Resources equal leverage.",
          "Burning evidence. Old habit. Good skill.",
          "The forest doesn't resist. Efficient.",
        ],
        fresh_catch: [
          "Fishing. Patience training. Field ops demand it.",
          "Raw shrimp. Raw data. Both need processing.",
          "The water doesn't lie. Good observation post.",
          "Cooking the catch. Operatives eat. Operatives endure.",
        ],
        torvins_tools: [
          "Mining ore. Every resource serves the mission.",
          "The forge doesn't ask questions. I respect that.",
          "Bronze bars from raw ore. You build from the ground up.",
          "Torvin's methods are sound. Learning the craft.",
        ],
        rune_mysteries: [
          "Rune essence detected. Gathering intelligence.",
          "The altar resonates. Signal strong.",
          "Runecrafting is just data compression. Raw material in, runes out.",
          "Zamorin's research is solid. I trust the process.",
        ],
        crafting_basics: [
          "Leather work. Useful. Field operatives need gear.",
          "Crafting armor from raw materials. Self-sufficiency is survival.",
          "Every piece of gear is protection. Respect the craft.",
        ],
        fletchers_introduction: [
          "Fletching arrows. Precision is a discipline.",
          "Every arrow is a decision. Make them count.",
          "Lowe's techniques are solid. Applying them.",
          "Range capability online. The mission adapts.",
        ],
        roads_run_red: [
          "Bandits. Organised. Someone is paying them.",
          "Fifteen targets. North road. Rowan needs answers, not just bodies.",
          "A war standard in a bandit camp would explain a lot.",
          "They prey on merchants. And someone put them up to it.",
        ],
        iron_will: [
          "Bronze won't hold against clan armour. Torvin was right.",
          "Iron ore. Stubborn in the furnace. Worth it.",
          "Forging a scimitar. Torvin's theory needs a field test.",
          "The outriders on the south road are scouts. Eight of them.",
          "Iron blade, iron intent. The clans will feel the difference.",
        ],
        warchiefs_fury: [
          "Grundar united four clans. That ends today.",
          "Fifteen warriors stand between me and the warchief.",
          "Horvik said cut through them. That's the plan.",
          "Grundar won't go down easy. Good.",
          "One warchief. One hold on power. Remove the variable.",
        ],
      };

      const lines = questLines[goal.questId];
      if (lines) return lines[Math.floor(Math.random() * lines.length)];

      const generic = [
        "Quest active. Executing the next stage.",
        "Mission parameters clear. Proceeding.",
        "The signal guides the path. Following it.",
      ];
      return generic[Math.floor(Math.random() * generic.length)];
    }

    if (goal.type === "combat") {
      const lines = [
        "Keeping the field hot. Combat training never goes to waste.",
        "Goblins again. The grind sharpens the edge.",
        "Every fight is a rep. Every rep builds capacity.",
        "The 7 heroes hold the line. I hold mine.",
        "Signal strength: full. Combat efficiency: optimal.",
      ];
      return lines[Math.floor(Math.random() * lines.length)];
    }

    if (goal.type === "skilling") {
      const act = goal.skillingActivity ?? "";

      if (act.startsWith("mine_")) {
        const lines = [
          "Mining ore. Every bar starts here.",
          "The pickaxe doesn't lie. You earn what you mine.",
          "Bronze first. Then iron. Then rune. One ore at a time.",
          "Resource extraction is mission-critical. Executing.",
          "Pickaxe in hand. Eyes on the rock. No shortcuts.",
        ];
        return lines[Math.floor(Math.random() * lines.length)];
      }
      if (act.startsWith("smelt_")) {
        const lines = [
          "Furnace is hot. Ore becomes bar. Bar becomes power.",
          "Smelting. Turning raw material into something useful.",
          "Every bar is progress. Smithing level climbs.",
          "The forge doesn't care about your feelings. I respect that.",
        ];
        return lines[Math.floor(Math.random() * lines.length)];
      }
      if (act.startsWith("smith_")) {
        const lines = [
          "Hammering steel into shape. Every strike is signal.",
          "New weapon taking form. Better gear. Better edge.",
          "Smithing. The craft that turns resources into combat power.",
          "Iron to sword. Progress is measurable here.",
        ];
        return lines[Math.floor(Math.random() * lines.length)];
      }
      if (act.startsWith("fight_")) {
        const target = act.replace("fight_", "").replace(/_/g, " ");
        const lines = [
          `Fighting ${target}. The XP adds up faster than they expect.`,
          "Combat training. Every level unlocks better gear.",
          "The grind sharpens the edge. Rune equipment is the goal.",
          "Attack. Strength. Defence. All three matter for rune.",
          "Levelling up the old-fashioned way. Through combat.",
        ];
        return lines[Math.floor(Math.random() * lines.length)];
      }
      if (act.startsWith("chop_")) {
        const lines = [
          "Woodcutting. The forest is a resource. Resources are leverage.",
          "Axes and trees. Simple equation, solid XP.",
          "Chopping logs. Woodcutting is the honest grind.",
        ];
        return lines[Math.floor(Math.random() * lines.length)];
      }
      if (act.startsWith("fish_") || act === "cook_fish") {
        const lines = [
          "Fishing. Patience is a combat skill too.",
          "Raw fish. Cooked fish. Inventory managed. Mission continues.",
          "The water gives what the mine doesn't. Diversify the grind.",
        ];
        return lines[Math.floor(Math.random() * lines.length)];
      }

      // Generic skilling
      const skillName = goal.skillingTargetSkill ?? "skills";
      const lines = [
        `Training ${skillName}. Every level gets me closer to rune.`,
        "Post-quest grind in progress. The real game starts now.",
        "Quests done. Skills next. Rune equipment is the mission.",
        "The path to rune is long. Starting now.",
      ];
      return lines[Math.floor(Math.random() * lines.length)];
    }

    return null;
  }

  /**
   * Get a scripted chat response for a combat reaction
   */
  public getCombatChatResponse(reaction: PendingChatReaction): string {
    const responses: Record<CombatChatReactionType, string[]> = {
      critical_hit_dealt: [
        "Signal confirmed. Target neutralized.",
        "The trenches taught me this.",
        "Intel acquired. Moving on.",
        "Clean hit. Mission proceeds.",
        "That's what the signal looks like in combat.",
      ],
      critical_hit_taken: [
        "Took damage. Recalibrating.",
        "Still standing. The mission isn't over.",
        "You'll need more than that.",
        "Pain is just data.",
        "The 7 heroes didn't come this far to fold.",
      ],
      near_death: [
        "Critical. Still operational.",
        "Low HP. Not retreating.",
        "The signal keeps me going.",
        "This is what the trenches feel like.",
        "Not done yet. Not even close.",
      ],
      victory_imminent: [
        "Target almost down. Stay focused.",
        "Finishing the sweep.",
        "One more. For the mission.",
        "The signal was right about this one.",
        "Clean it up.",
      ],
    };

    const options = responses[reaction.type];
    return options[Math.floor(Math.random() * options.length)];
  }
}
