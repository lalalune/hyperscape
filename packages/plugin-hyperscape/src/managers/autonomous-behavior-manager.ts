/**
 * AutonomousBehaviorManager - Full ElizaOS Decision Loop
 *
 * This manager implements the complete ElizaOS action/decision flow for
 * autonomous agent behavior. Unlike the simple ExplorationManager, this
 * uses the full ElizaOS pipeline:
 *
 * 1. Create internal "tick" message
 * 2. Compose state (gather context from all providers)
 * 3. Run evaluators (assess situation)
 * 4. Process actions (LLM selects action based on state)
 * 5. Execute selected action
 * 6. Store result in memory
 *
 * This enables the agent to make intelligent, context-aware decisions
 * about what to do autonomously.
 */

import {
  logger,
  ModelType,
  type IAgentRuntime,
  type Memory,
  type UUID,
  type Action,
  type State,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type {
  Entity,
  GoalType,
  InventoryItem,
  PlayerEntity,
} from "../types.js";

// Import autonomous actions directly for execution
import {
  exploreAction,
  fleeAction,
  idleAction,
  approachEntityAction,
  attackEntityAction,
} from "../actions/autonomous.js";
import { setGoalAction, navigateToAction } from "../actions/goals.js";
import {
  chopTreeAction,
  mineRockAction,
  catchFishAction,
  lightFireAction,
  cookFoodAction,
} from "../actions/skills.js";
import {
  pickupItemAction,
  equipItemAction,
  dropItemAction,
  useItemAction,
  lootGravestoneAction,
} from "../actions/inventory.js";
import {
  greetPlayerAction,
  shareOpinionAction,
  offerHelpAction,
} from "../actions/social.js";
import {
  talkToNpcAction,
  acceptQuestAction,
  completeQuestAction,
  checkQuestAction,
} from "../actions/quests.js";
import {
  smeltOreAction,
  smithItemAction,
  fletchItemAction,
  runecraftAction,
} from "../actions/crafting.js";
import { buyItemAction, sellItemAction } from "../actions/shopping.js";
import {
  bankDepositAction,
  bankWithdrawAction,
  bankDepositAllAction,
} from "../actions/banking.js";
import { moveToAction } from "../actions/movement.js";
import {
  KNOWN_LOCATIONS,
  updateKnownLocationsFromNearbyEntities,
} from "../providers/goalProvider.js";
import { SCRIPTED_AUTONOMY_CONFIG } from "../config/constants.js";
import {
  hasCombatCapableItem,
  hasWeapon,
  hasOre,
  hasBars,
  hasFood as hasAnyFood,
  hasAxe,
  hasPickaxe,
  hasFishingEquipment,
} from "../utils/item-detection.js";
import { getBankPosition } from "../utils/world-data.js";
import {
  planNextGoal,
  buildPlannerContext,
  logPlannerDecision,
} from "./goal-progression-planner.js";
import { getPersonalityTraits } from "../providers/personalityProvider.js";
import { getTimeSinceLastSocial } from "../providers/socialMemory.js";

// Configuration
const DEFAULT_TICK_INTERVAL = 5000; // 5 seconds between decisions
const MIN_TICK_INTERVAL = 2000; // Minimum 2 seconds (fast-tick mode)
const MAX_TICK_INTERVAL = 15000; // Maximum 15 seconds

type AutonomyMode = "llm" | "scripted";
type ScriptedRole =
  | "combat"
  | "woodcutting"
  | "fishing"
  | "mining"
  | "balanced";
type ResourceSkill = "woodcutting" | "fishing" | "mining";

export interface AutonomousBehaviorConfig {
  /** Interval between decision ticks in milliseconds */
  tickInterval?: number;
  /** Whether to log detailed debug info */
  debug?: boolean;
  /** Actions to consider for autonomous behavior */
  allowedActions?: string[];
  /** Autonomy mode (LLM or scripted) */
  autonomyMode?: AutonomyMode;
}

/** Simple goal structure stored in memory */
export interface CurrentGoal {
  type:
    | "combat_training"
    | "woodcutting"
    | "mining"
    | "smithing"
    | "fishing"
    | "firemaking"
    | "cooking"
    | "exploration"
    | "idle"
    | "user_command"
    | "questing"
    | "banking";
  description: string;
  target: number;
  progress: number;
  location?: string;
  /** Dynamic position found at runtime (overrides KNOWN_LOCATIONS lookup) */
  targetPosition?: [number, number, number];
  targetEntity?: string;
  /** For skill-based goals: which skill to train */
  targetSkill?: string;
  /** For skill-based goals: target level to reach */
  targetSkillLevel?: number;
  startedAt: number;
  /** If true, autonomous SET_GOAL will skip (manual override active) */
  locked?: boolean;
  /** Who locked the goal */
  lockedBy?: "manual" | "autonomous";
  /** When the goal was locked */
  lockedAt?: number;
  /** Original user message for multi-step user commands */
  userMessage?: string;
  /** For questing goals: which quest */
  questId?: string;
  /** For questing goals: current stage type (kill, gather, interact, dialogue) */
  questStageType?: "kill" | "gather" | "interact" | "dialogue" | "travel";
  /** For questing goals: target to kill/gather/interact with */
  questStageTarget?: string;
  /** For questing goals: count required */
  questStageCount?: number;
  /** For questing goals: NPC that starts/ends the quest */
  questStartNpc?: string;
}

export class AutonomousBehaviorManager {
  private isRunning = false;
  private runtime: IAgentRuntime;
  private service: HyperscapeService | null = null;
  private tickInterval: number;
  private debug: boolean;
  private allowedActions: Set<string>;
  private autonomyMode: AutonomyMode;
  private scriptedRole: ScriptedRole | null = null;
  private actionContext: { messageText?: string } | null = null;
  private lastTickTime = 0;
  private tickCount = 0;

  /** Current goal - persists between ticks */
  private currentGoal: CurrentGoal | null = null;

  /** If true, the user explicitly paused goals - don't auto-set new ones */
  private goalPaused: boolean = false;

  /**
   * Goal history - tracks recently completed goals to encourage variety
   * Used by goal templates provider to penalize repetitive goal selection
   */
  private goalHistory: Array<{ goal: CurrentGoal; completedAt: number }> = [];
  private readonly GOAL_HISTORY_RETENTION = 5 * 60 * 1000; // Keep history for 5 minutes
  private readonly MAX_GOAL_HISTORY = 10; // Max goals to track

  /**
   * Target locking for combat - prevents switching targets mid-fight
   * Agent should finish killing current target before switching to another
   */
  private lockedTargetId: string | null = null;
  private lockedTargetStartTime: number = 0;
  private readonly TARGET_LOCK_TIMEOUT = 30000; // 30s max lock duration

  /** Whether agent is currently in a streaming duel (suppresses autonomous actions) */
  private inActiveDuel = false;

  /** When the agent entered reactive combat (attacked while on a non-combat goal) */
  private reactiveCombatStartTime: number = 0;
  private readonly REACTIVE_COMBAT_MAX_MS = 15000; // 15s max reactive fight

  /** Saved goal before duel interruption — restored after duel completion */
  private savedGoal: CurrentGoal | null = null;

  /** Duel outcome history for strategy analysis */
  private duelHistory: Array<{
    opponentName: string;
    won: boolean;
    myHealth: number;
    foodUsed: number;
    timestamp: number;
  }> = [];
  private readonly MAX_DUEL_HISTORY = 10;

  /** Whether duel event handlers have been registered */
  private duelEventHandlerRegistered = false;

  /**
   * Combat chat reaction state - prompts agent to react to combat events
   */
  private pendingChatReaction: {
    type:
      | "critical_hit_dealt"
      | "critical_hit_taken"
      | "near_death"
      | "victory_imminent";
    opponentName: string;
    timestamp: number;
  } | null = null;
  private lastCombatChatAt = 0;
  private readonly COMBAT_CHAT_COOLDOWN = 15000; // 15 seconds between combat chats
  private readonly CRITICAL_HIT_THRESHOLD = 0.3; // 30% of max health
  private readonly NEAR_DEATH_THRESHOLD = 0.2; // 20% of current health
  private combatEventHandlerRegistered = false;

  /** Stored event handler references for cleanup during stop() */
  private combatDamageHandler: ((data: unknown) => void) | null = null;
  private duelStartHandler: (() => void) | null = null;
  private duelCompletedHandler: ((data: unknown) => void) | null = null;

  /** Action lock — skip LLM while an action is in progress */
  private actionLock: {
    actionName: string;
    startedAt: number;
    timeoutMs: number;
    /** Minimum lock duration — stays locked even if movement stops */
    minDurationMs: number;
  } | null = null;
  private readonly ACTION_LOCK_MAX_MS = 20000; // Safety: max 20s lock

  /** Last executed action — used in prompt for continuity */
  private lastActionName: string | null = null;
  private lastActionResult: "success" | "failure" | null = null;
  private lastActionTime: number = 0;

  /** Request a fast follow-up tick (2s instead of normal interval) */
  private nextTickFast = false;

  /** LLM rate limiting - exponential backoff on consecutive failures */
  private llmConsecutiveFailures = 0;
  private llmLastFailureAt = 0;
  private readonly LLM_MAX_CONSECUTIVE_FAILURES = 5;
  private readonly LLM_BASE_BACKOFF_MS = 5000; // 5 second base backoff
  private readonly LLM_MAX_BACKOFF_MS = 60000; // 60 second max backoff

  constructor(runtime: IAgentRuntime, config?: AutonomousBehaviorConfig) {
    this.runtime = runtime;
    this.tickInterval = Math.max(
      MIN_TICK_INTERVAL,
      Math.min(
        MAX_TICK_INTERVAL,
        config?.tickInterval ?? DEFAULT_TICK_INTERVAL,
      ),
    );
    this.debug = config?.debug ?? false;

    const rawMode =
      config?.autonomyMode ||
      (String(runtime.getSetting("HYPERSCAPE_AUTONOMY_MODE") || "") as
        | AutonomyMode
        | "") ||
      (SCRIPTED_AUTONOMY_CONFIG.MODE as AutonomyMode);
    this.autonomyMode = rawMode === "scripted" ? "scripted" : "llm";

    const rawRole = String(
      runtime.getSetting("HYPERSCAPE_SCRIPTED_ROLE") ||
        SCRIPTED_AUTONOMY_CONFIG.ROLE ||
        "",
    ).toLowerCase();
    if (
      rawRole === "combat" ||
      rawRole === "woodcutting" ||
      rawRole === "fishing" ||
      rawRole === "mining" ||
      rawRole === "balanced"
    ) {
      this.scriptedRole = rawRole;
    }

    this.allowedActions = new Set(
      config?.allowedActions ?? [
        // Goal-oriented actions (highest priority)
        "SET_GOAL",
        "NAVIGATE_TO",
        // Combat and interaction
        "ATTACK_ENTITY",
        "APPROACH_ENTITY",
        // Survival
        "FLEE",
        // Exploration
        "EXPLORE",
        // Skills
        "CHOP_TREE",
        "MINE_ROCK",
        "CATCH_FISH",
        "LIGHT_FIRE",
        "COOK_FOOD",
        // Crafting
        "SMELT_ORE",
        "SMITH_ITEM",
        "FLETCH_ITEM",
        "RUNECRAFT",
        // Looting & Equipment
        "PICKUP_ITEM",
        "EQUIP_ITEM",
        // Banking
        "BANK_DEPOSIT",
        "BANK_WITHDRAW",
        "BANK_DEPOSIT_ALL",
        // Shopping
        "BUY_ITEM",
        "SELL_ITEM",
        // Quest interactions
        "TALK_TO_NPC",
        "ACCEPT_QUEST",
        "COMPLETE_QUEST",
        "CHECK_QUEST",
        // Item usage
        "USE_ITEM",
        "DROP_ITEM",
        "MOVE_TO",
        // Social
        "GREET_PLAYER",
        "SHARE_OPINION",
        "OFFER_HELP",
        // Idle
        "IDLE",
      ],
    );
  }

  /**
   * Check if the manager is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Start autonomous behavior
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("[AutonomousBehavior] Already running, ignoring start");
      return;
    }

    this.service =
      this.runtime.getService<HyperscapeService>("hyperscapeService");
    if (!this.service) {
      logger.error(
        "[AutonomousBehavior] HyperscapeService not found, cannot start",
      );
      return;
    }

    logger.info("[AutonomousBehavior] Starting autonomous behavior...");
    logger.info(`[AutonomousBehavior] Tick interval: ${this.tickInterval}ms`);
    logger.info(
      `[AutonomousBehavior] Allowed actions: ${Array.from(this.allowedActions).join(", ")}`,
    );

    // Subscribe to combat events for chat reactions (store refs for cleanup)
    if (!this.combatEventHandlerRegistered) {
      this.combatDamageHandler = (data: unknown) => {
        this.handleCombatDamageEvent(data);
      };
      this.service.onGameEvent("COMBAT_DAMAGE_DEALT", this.combatDamageHandler);
      this.combatEventHandlerRegistered = true;
      logger.info(
        "[AutonomousBehavior] Registered combat chat reaction handler",
      );
    }

    // Subscribe to duel events for goal save/restore and duel awareness (store refs for cleanup)
    if (!this.duelEventHandlerRegistered) {
      this.duelStartHandler = () => {
        this.onDuelStart();
      };
      this.duelCompletedHandler = (data: unknown) => {
        this.onDuelCompleted(data);
      };
      this.service.onGameEvent("DUEL_FIGHT_START", this.duelStartHandler);
      this.service.onGameEvent("DUEL_COMPLETED", this.duelCompletedHandler);
      this.duelEventHandlerRegistered = true;
      logger.info("[AutonomousBehavior] Registered duel event handlers");
    }

    // Register bank location from world data if not already known
    if (!KNOWN_LOCATIONS.bank) {
      const bankPos = getBankPosition();
      if (bankPos) {
        KNOWN_LOCATIONS.bank = {
          position: bankPos,
          description: "Bank for depositing items",
          entities: ["bank", "banker", "bank_clerk"],
        };
        logger.info(
          `[AutonomousBehavior] Registered bank location: [${bankPos.join(", ")}]`,
        );
      }
    }

    this.isRunning = true;
    this.tickCount = 0;
    this.runLoop().catch((err) => {
      logger.error(
        "[AutonomousBehavior] Loop crashed:",
        err instanceof Error ? err.message : String(err),
      );
      this.isRunning = false;
    });
  }

  /**
   * Stop autonomous behavior
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn("[AutonomousBehavior] Not running, ignoring stop");
      return;
    }

    logger.info("[AutonomousBehavior] Stopping autonomous behavior...");
    this.isRunning = false;

    // Unregister event handlers to prevent memory leaks
    if (this.service && this.combatDamageHandler) {
      this.service.offGameEvent(
        "COMBAT_DAMAGE_DEALT",
        this.combatDamageHandler,
      );
      this.combatDamageHandler = null;
      this.combatEventHandlerRegistered = false;
      logger.info("[AutonomousBehavior] Unregistered combat event handler");
    }

    if (this.service && this.duelStartHandler) {
      this.service.offGameEvent("DUEL_FIGHT_START", this.duelStartHandler);
      this.duelStartHandler = null;
    }

    if (this.service && this.duelCompletedHandler) {
      this.service.offGameEvent("DUEL_COMPLETED", this.duelCompletedHandler);
      this.duelCompletedHandler = null;
      this.duelEventHandlerRegistered = false;
      logger.info("[AutonomousBehavior] Unregistered duel event handlers");
    }
  }

  /**
   * Handle combat damage events for chat reactions
   */
  private handleCombatDamageEvent(data: unknown): void {
    if (!this.service) return;

    const payload = data as {
      attackerId: string;
      targetId: string;
      damage: number;
    };

    const { attackerId, targetId, damage } = payload;
    const now = Date.now();

    // Check cooldown
    if (now - this.lastCombatChatAt < this.COMBAT_CHAT_COOLDOWN) {
      return;
    }

    const player = this.service.getPlayerEntity();
    if (!player) return;

    const myId = player.id;

    // Get entity data helper
    const getEntityData = (entityId: string) => {
      const entities = this.service?.getNearbyEntities() || [];
      return entities.find((e) => e.id === entityId);
    };

    // Check if we dealt a critical hit
    if (attackerId === myId) {
      const target = getEntityData(targetId);
      const targetMaxHealth =
        target?.health?.max ||
        ((target as { maxHealth?: unknown } | undefined)?.maxHealth as
          | number
          | undefined);

      if (
        targetMaxHealth &&
        damage >= targetMaxHealth * this.CRITICAL_HIT_THRESHOLD
      ) {
        this.pendingChatReaction = {
          type: "critical_hit_dealt",
          opponentName: target?.name || "opponent",
          timestamp: now,
        };
        return;
      }

      // Check if target is near death (victory imminent)
      const targetHealth = target?.health?.current || target?.health;
      if (targetHealth && targetMaxHealth) {
        const remainingPercent =
          (targetHealth as number) / (targetMaxHealth as number);
        if (remainingPercent <= this.NEAR_DEATH_THRESHOLD && damage > 0) {
          this.pendingChatReaction = {
            type: "victory_imminent",
            opponentName: target?.name || "opponent",
            timestamp: now,
          };
          return;
        }
      }
    }

    // Check if we took a critical hit
    if (targetId === myId) {
      const attacker = getEntityData(attackerId);
      const opponentName = attacker?.name || "opponent";
      const myMaxHealth =
        player.health?.max ||
        ((player as { maxHealth?: unknown }).maxHealth as number | undefined);

      if (myMaxHealth && damage >= myMaxHealth * this.CRITICAL_HIT_THRESHOLD) {
        this.pendingChatReaction = {
          type: "critical_hit_taken",
          opponentName,
          timestamp: now,
        };
        return;
      }

      // Check if we're near death
      const myHealth = player.health?.current || player.health;
      if (myHealth && myMaxHealth) {
        const remainingPercent = (myHealth as number) / (myMaxHealth as number);
        if (remainingPercent <= this.NEAR_DEATH_THRESHOLD) {
          this.pendingChatReaction = {
            type: "near_death",
            opponentName,
            timestamp: now,
          };
        }
      }
    }
  }

  /**
   * Get scripted chat response for combat reaction
   */
  private getCombatChatResponse(reaction: {
    type:
      | "critical_hit_dealt"
      | "critical_hit_taken"
      | "near_death"
      | "victory_imminent";
    opponentName: string;
    timestamp: number;
  }): string {
    const responses: Record<typeof reaction.type, string[]> = {
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

  /**
   * Process pending combat chat reaction (called during tick)
   */
  private async processCombatChatReaction(): Promise<void> {
    if (!this.pendingChatReaction || !this.service) {
      return;
    }

    const reaction = this.pendingChatReaction;
    this.pendingChatReaction = null;

    try {
      const message = this.getCombatChatResponse(reaction);
      if (message) {
        await this.service.executeChatMessage({ message });
        this.lastCombatChatAt = Date.now();
        logger.info(
          `[AutonomousBehavior] Combat chat (${reaction.type}): "${message}"`,
        );
      }
    } catch (err) {
      logger.warn(
        `[AutonomousBehavior] Failed to send combat chat: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Main behavior loop
   */
  private async runLoop(): Promise<void> {
    // Initial delay to let things settle
    await this.sleep(3000);

    while (this.isRunning) {
      const tickStart = Date.now();

      try {
        await this.tick();
        // Reset LLM failure counter on successful tick
        if (this.llmConsecutiveFailures > 0) {
          this.llmConsecutiveFailures = 0;
          logger.info(
            "[AutonomousBehavior] LLM rate limit cleared after successful tick",
          );
        }
      } catch (error) {
        // Track consecutive failures for LLM rate limiting
        this.llmConsecutiveFailures++;
        this.llmLastFailureAt = Date.now();
        const backoffMs = Math.min(
          this.LLM_BASE_BACKOFF_MS *
            Math.pow(2, this.llmConsecutiveFailures - 1),
          this.LLM_MAX_BACKOFF_MS,
        );
        logger.error(
          `[AutonomousBehavior] Error in tick (failure ${this.llmConsecutiveFailures}, backoff ${Math.round(backoffMs / 1000)}s):`,
          error instanceof Error ? error.message : String(error),
        );
      }

      // Calculate how long to wait until next tick
      const tickDuration = Date.now() - tickStart;
      const baseInterval = this.nextTickFast
        ? MIN_TICK_INTERVAL
        : this.tickInterval;
      this.nextTickFast = false; // Reset after use
      const sleepTime = Math.max(0, baseInterval - tickDuration);

      if (this.debug) {
        logger.debug(
          `[AutonomousBehavior] Tick ${this.tickCount} took ${tickDuration}ms, sleeping ${sleepTime}ms${baseInterval === MIN_TICK_INTERVAL ? " (fast-tick)" : ""}`,
        );
      }

      await this.sleep(sleepTime);
    }

    logger.info("[AutonomousBehavior] Behavior loop ended");
  }

  /**
   * Single decision tick - the full ElizaOS pipeline
   */
  private async tick(): Promise<void> {
    this.tickCount++;
    this.lastTickTime = Date.now();

    // Step 1: Validate we can act
    if (!this.canAct()) {
      if (this.debug) {
        logger.debug("[AutonomousBehavior] Cannot act, skipping tick");
      }
      return;
    }

    // Check action lock — skip LLM if still executing previous action
    if (this.actionLock) {
      const elapsed = Date.now() - this.actionLock.startedAt;
      const isMoving = this.service?.isMoving ?? false;

      // Stay locked if minimum duration hasn't elapsed yet (gather/attack cooldown)
      const withinMinDuration = elapsed < this.actionLock.minDurationMs;
      if (
        elapsed < this.actionLock.timeoutMs &&
        (isMoving || withinMinDuration)
      ) {
        logger.debug(
          `[AutonomousBehavior] Action lock active: ${this.actionLock.actionName} ` +
            `(${Math.round(elapsed / 1000)}s) — ${isMoving ? "moving" : "cooldown"}, skipping tick`,
        );
        return;
      }

      // Lock expired or movement/cooldown finished — clear it
      logger.info(
        `[AutonomousBehavior] Action lock cleared: ${this.actionLock.actionName} ` +
          `(${isMoving ? "timeout" : withinMinDuration ? "timeout" : "complete"})`,
      );
      this.actionLock = null;
      this.nextTickFast = true; // Quick follow-up after lock clears
    }

    // LLM rate limiting - exponential backoff on consecutive failures
    if (this.llmConsecutiveFailures > 0) {
      const backoffMs = Math.min(
        this.LLM_BASE_BACKOFF_MS * Math.pow(2, this.llmConsecutiveFailures - 1),
        this.LLM_MAX_BACKOFF_MS,
      );
      const timeSinceFailure = Date.now() - this.llmLastFailureAt;
      if (timeSinceFailure < backoffMs) {
        logger.debug(
          `[AutonomousBehavior] LLM rate limited: ${this.llmConsecutiveFailures} failures, waiting ${Math.round((backoffMs - timeSinceFailure) / 1000)}s more`,
        );
        return;
      }
    }

    // Pre-save current goal if inventory is near-full (banking may be triggered)
    const playerForGoalSave = this.service?.getPlayerEntity();
    const inventoryCountForSave = Array.isArray(playerForGoalSave?.items)
      ? playerForGoalSave.items.length
      : 0;
    if (
      inventoryCountForSave >= 25 &&
      this.currentGoal &&
      this.currentGoal.type !== "banking" &&
      !this.savedGoal
    ) {
      this.savedGoal = { ...this.currentGoal };
    }

    // Process pending combat chat reaction (non-blocking)
    await this.processCombatChatReaction();

    logger.info(`[AutonomousBehavior] === Tick ${this.tickCount} ===`);

    // SPONTANEOUS SOCIAL BEHAVIOR
    // Personality-driven chance to do something social instead of grinding
    const shouldDoSocial = this.checkSpontaneousSocialBehavior();
    if (shouldDoSocial) {
      const tickMessage = this.createTickMessage();
      const socialState = await this.runtime.composeState(tickMessage);
      const socialAction = this.pickSocialAction();
      if (socialAction) {
        const isValid = await socialAction.validate(
          this.runtime,
          tickMessage,
          socialState,
        );
        if (isValid) {
          logger.info(
            `[AutonomousBehavior] 💬 Spontaneous social: ${socialAction.name}`,
          );
          await this.executeAction(socialAction, tickMessage, socialState);
          return;
        }
      }
    }

    // Check for locked user command goal - continue executing it
    if (this.currentGoal?.locked && this.currentGoal?.lockedBy === "manual") {
      const goalDescription = this.currentGoal.description || "";
      const originalUserMessage = this.currentGoal.userMessage || "";
      logger.info(
        `[AutonomousBehavior] 🔒 Locked user command goal: ${goalDescription}`,
      );
      logger.info(
        `[AutonomousBehavior] 📝 Original user message: "${originalUserMessage}"`,
      );

      // Extract action name from goal description (format: "User command: ACTION_NAME - ...")
      const actionMatch = goalDescription.match(/User command: (\w+)/);
      if (actionMatch) {
        const actionName = actionMatch[1];
        logger.info(
          `[AutonomousBehavior] Continuing user command: ${actionName}`,
        );

        // Use statically imported actions (avoid per-tick dynamic import overhead)
        const actionMap: Record<string, Action> = {
          PICKUP_ITEM: pickupItemAction,
          DROP_ITEM: dropItemAction,
          ATTACK_ENTITY: attackEntityAction,
          CHOP_TREE: chopTreeAction,
          MOVE_TO: moveToAction,
        };

        const userAction = actionMap[actionName];
        if (userAction) {
          // Create a message with the ORIGINAL user text so action handlers can match correctly
          const userCommandMessage: Memory = {
            id: crypto.randomUUID() as UUID,
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId: this.runtime.agentId,
            content: {
              text: originalUserMessage, // Use original message for item/target matching!
              source: "user_command_continuation",
            },
            createdAt: Date.now(),
          };
          const state = await this.runtime.composeState(userCommandMessage);

          // Validate the action
          const isValid = await userAction.validate(
            this.runtime,
            userCommandMessage,
            state,
          );

          if (isValid) {
            logger.info(
              `[AutonomousBehavior] Executing user command action: ${actionName}`,
            );
            await this.executeAction(userAction, userCommandMessage, state);
            return; // Don't do normal tick processing
          } else {
            // Check if goal was set recently - agent might still be walking to target
            const goalAge = Date.now() - (this.currentGoal?.startedAt || 0);
            const GRACE_PERIOD_MS = 60000; // 60 seconds grace period for multi-step actions

            if (goalAge < GRACE_PERIOD_MS) {
              logger.info(
                `[AutonomousBehavior] User command action ${actionName} validation failed, but goal is only ${Math.round(goalAge / 1000)}s old - keeping goal (grace period)`,
              );
              // Skip this tick but don't clear the goal - agent might still be walking
              return;
            }

            logger.info(
              `[AutonomousBehavior] User command action ${actionName} no longer valid after ${Math.round(goalAge / 1000)}s, clearing goal`,
            );
            // Action is no longer valid (e.g., item picked up, target dead)
            // Clear the goal so normal behavior can resume
            this.clearGoal();
          }
        }
      }
    }

    // Step 2: Create internal "tick" message
    const tickMessage = this.createTickMessage();

    // Step 3: Compose state (gathers context from all providers)
    if (this.debug) logger.debug("[AutonomousBehavior] Composing state...");
    const state = await this.runtime.composeState(tickMessage);

    // Step 4: Run evaluators (assess the situation)
    if (this.debug) logger.debug("[AutonomousBehavior] Running evaluators...");
    const evaluatorResults = await this.runtime.evaluate(
      tickMessage,
      state,
      false, // didRespond
    );

    if (this.debug && evaluatorResults && evaluatorResults.length > 0) {
      logger.debug(
        `[AutonomousBehavior] ${evaluatorResults.length} evaluators ran: ${evaluatorResults.map((e) => e.name).join(", ")}`,
      );
    }

    // Step 5: Select and execute an action using the LLM
    if (this.debug) logger.debug("[AutonomousBehavior] Selecting action...");

    let selectedAction = await this.selectAction(tickMessage, state);

    if (!selectedAction) {
      logger.info("[AutonomousBehavior] No action selected this tick");
      return;
    }

    logger.info(
      `[AutonomousBehavior] LLM selected action: ${selectedAction.name}`,
    );

    // NOTE: Removed defensive overrides - LLM now has full autonomy to:
    // - Choose actions even without a goal (it will learn from context)
    // - Choose when to equip weapons (it has equipment context)

    logger.info(
      `[AutonomousBehavior] Executing action: ${selectedAction.name}`,
    );

    // Step 6: Validate the selected action
    const isValid = await selectedAction.validate(
      this.runtime,
      tickMessage,
      state,
    );
    if (!isValid) {
      logger.warn(
        `[AutonomousBehavior] Action ${selectedAction.name} failed validation`,
      );

      // Smart fallback: try a goal-appropriate alternative before idling
      const fallback = this.getFallbackAction(selectedAction.name);
      if (fallback) {
        logger.info(
          `[AutonomousBehavior] Validation fallback: ${selectedAction.name} → ${fallback.name}`,
        );
        const fallbackValid = await fallback.validate(
          this.runtime,
          tickMessage,
          state,
        );
        if (fallbackValid) {
          await this.executeAction(fallback, tickMessage, state);
          return;
        }
      }

      // No fallback worked — fast-tick to retry quickly (2s, not 5s idle)
      logger.info("[AutonomousBehavior] No valid fallback — fast-tick retry");
      this.nextTickFast = true;
      return;
    }

    // Step 7: Execute the selected action
    await this.executeAction(selectedAction, tickMessage, state);
  }

  /** Last LLM reasoning - synced to dashboard as agent thoughts */
  private lastThinking: string = "";

  /**
   * Select an action using the LLM based on current state
   * Now parses THINKING + ACTION format for genuine LLM reasoning
   */
  private async selectAction(
    message: Memory,
    state: State,
  ): Promise<Action | null> {
    if (this.autonomyMode === "scripted") {
      return this.selectActionScripted(state);
    }

    // --- SHORT-CIRCUIT: Skip LLM for obvious decisions ---
    const shortCircuit = this.tryShortCircuit();
    if (shortCircuit) {
      logger.info(`[AutonomousBehavior] Short-circuit: ${shortCircuit.name}`);

      // Sync short-circuit decisions as thoughts so the dashboard shows activity
      // for agents that rarely/never reach the LLM path.
      const goal = this.currentGoal;
      const thought = goal
        ? `[${goal.type}] ${goal.description} → ${shortCircuit.name}`
        : `→ ${shortCircuit.name}`;
      this.lastThinking = thought;
      this.syncThinkingToDashboard(thought);

      return shortCircuit;
    }

    // Get available actions for autonomous behavior
    const availableActions = this.getAvailableActions();

    // Build the action selection prompt (now asks for THINKING + ACTION)
    const prompt = this.buildActionSelectionPrompt(state, availableActions);

    try {
      // Use the LLM to select an action - allow longer response for reasoning
      const response = await this.runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
      });

      const responseText =
        typeof response === "string" ? response : String(response);

      // Parse THINKING and ACTION from the response
      const { thinking, actionName } = this.parseThinkingAndAction(
        responseText,
        availableActions,
      );

      // Store thinking for dashboard sync
      if (thinking) {
        this.lastThinking = thinking;
        logger.info(`[AutonomousBehavior] LLM Thinking: ${thinking}`);

        // Sync to dashboard via service
        this.syncThinkingToDashboard(thinking);
      }

      if (this.debug) {
        logger.debug(
          `[AutonomousBehavior] LLM full response:\n${responseText.trim()}`,
        );
      }

      let selectedActionName = actionName;

      if (!selectedActionName) {
        // If there's an active goal, don't derail it — retry next tick
        if (this.currentGoal) {
          logger.warn(
            "[AutonomousBehavior] Could not parse LLM action — retrying goal next tick",
          );
          this.lastThinking = `LLM unclear — retrying goal: ${this.currentGoal.description}`;
          this.syncThinkingToDashboard(this.lastThinking);
          this.nextTickFast = true;
          return null;
        }
        logger.warn(
          "[AutonomousBehavior] Could not parse action from LLM response, defaulting to EXPLORE",
        );
        this.lastThinking =
          "Could not determine action - exploring to find opportunities";
        this.syncThinkingToDashboard(this.lastThinking);
        return exploreAction;
      }

      // If goals are paused by user, block SET_GOAL and force IDLE
      if (this.goalPaused && selectedActionName === "SET_GOAL") {
        logger.info(
          "[AutonomousBehavior] Blocked SET_GOAL because goals are paused by user - forcing IDLE",
        );
        this.lastThinking = "Goals are paused - waiting for direction";
        this.syncThinkingToDashboard(this.lastThinking);
        selectedActionName = "IDLE";
      }

      logger.info(
        `[AutonomousBehavior] Selected action: ${selectedActionName}`,
      );

      // Find the action object
      const action = availableActions.find(
        (a) => a.name === selectedActionName,
      );
      return action || exploreAction;
    } catch (error) {
      logger.error(
        "[AutonomousBehavior] Error selecting action:",
        error instanceof Error ? error.message : String(error),
      );

      // If the agent has an active goal, don't override it with explore —
      // return null to idle this tick and retry the short-circuit next tick.
      // This prevents LLM errors (e.g. rate limits) from derailing goal progress.
      if (this.currentGoal) {
        this.lastThinking = `LLM error — retrying goal: ${this.currentGoal.description}`;
        this.syncThinkingToDashboard(this.lastThinking);
        this.nextTickFast = true;
        return null;
      }

      this.lastThinking = "Error occurred - exploring as fallback";
      this.syncThinkingToDashboard(this.lastThinking);
      return exploreAction;
    }
  }

  private selectActionScripted(state: State): Action | null {
    this.actionContext = null;

    const service = this.service;
    if (!service) return null;
    const player = service.getPlayerEntity();
    if (!player) return null;

    const healthPercent = this.getHealthPercent(player);
    const survivalAssessment = state.survivalAssessment as
      | { urgency?: string }
      | undefined;

    const immediateDanger =
      player.inCombat || survivalAssessment?.urgency === "critical";
    if (
      healthPercent <= SCRIPTED_AUTONOMY_CONFIG.FLEE_HEALTH_PERCENT &&
      immediateDanger
    ) {
      // In scripted mode, explicitly select survival behavior when danger is high.
      return fleeAction;
    }

    const goal = this.currentGoal;
    const preferredGoal = this.getPreferredGoalType();

    if (!goal || (preferredGoal && goal.type !== preferredGoal)) {
      return setGoalAction;
    }

    if (this.goalPaused) {
      return idleAction;
    }

    switch (goal.type) {
      case "combat_training":
        return this.selectCombatAction(player);
      case "woodcutting":
        return this.selectResourceAction("woodcutting", player);
      case "fishing":
        return this.selectResourceAction("fishing", player);
      case "mining":
        return this.selectResourceAction("mining", player);
      case "exploration":
        return exploreAction;
      case "idle":
        return idleAction;
      default:
        return exploreAction;
    }
  }

  private getPreferredGoalType(): CurrentGoal["type"] | null {
    switch (this.scriptedRole) {
      case "combat":
        return "combat_training";
      case "woodcutting":
        return "woodcutting";
      case "fishing":
        return "fishing";
      case "mining":
        return "mining";
      default:
        return null;
    }
  }

  private selectCombatAction(player: PlayerEntity): Action {
    const attackableMobs = this.getAttackableMobs(player);

    if (attackableMobs.length > 0) {
      return attackEntityAction;
    }

    if (this.currentGoal?.location) {
      return navigateToAction;
    }

    return exploreAction;
  }

  private selectResourceAction(
    skill: ResourceSkill,
    player: PlayerEntity,
  ): Action {
    if (!this.hasToolForSkill(skill, player.items)) {
      const toolItem = this.findNearbyToolItem(skill, player);
      if (toolItem) {
        this.actionContext = { messageText: this.getToolHint(skill) };
        return pickupItemAction;
      }

      return exploreAction;
    }

    const resources = this.getResourceCandidates(skill, player);

    if (resources.approachable.length > 0) {
      return this.getResourceActionForSkill(skill);
    }

    if (resources.candidates.length > 0 && this.currentGoal) {
      const target = this.getPositionArray(
        resources.candidates[0].entity.position,
      );
      if (target) {
        this.currentGoal.targetPosition = target;
      }
      return navigateToAction;
    }

    return exploreAction;
  }

  private getResourceActionForSkill(skill: ResourceSkill): Action {
    if (skill === "fishing") return catchFishAction;
    if (skill === "mining") return mineRockAction;
    return chopTreeAction;
  }

  private getHealthPercent(player: PlayerEntity): number {
    const current = player.health?.current ?? 100;
    const max = player.health?.max ?? 100;
    return max > 0 ? (current / max) * 100 : 100;
  }

  private getCombatLevel(player: PlayerEntity): number {
    const skills = player.skills;
    return Math.floor(
      (skills.attack.level +
        skills.strength.level +
        skills.defense.level +
        skills.constitution.level +
        skills.ranged.level) /
        5,
    );
  }

  private getNearbyThreats(player: PlayerEntity): Entity[] {
    if (!this.getPositionXZ(player.position) || !this.service) return [];

    return this.service.getNearbyEntities().filter((entity) => {
      if (!this.isMobEntity(entity)) return false;
      if (entity.alive === false) return false;
      const dist = this.getDistance2D(player.position, entity.position);
      return dist !== null && dist < 15;
    });
  }

  private getAttackableMobs(player: PlayerEntity): Entity[] {
    if (!this.service) return [];

    const combatLevel = this.getCombatLevel(player);
    return this.service.getNearbyEntities().filter((entity) => {
      if (!this.isMobEntity(entity)) return false;
      if (entity.alive === false) return false;

      const mobLevel = this.getMobLevel(entity);
      if (mobLevel !== null) {
        if (
          mobLevel >
            combatLevel + SCRIPTED_AUTONOMY_CONFIG.MOB_LEVEL_MAX_ABOVE ||
          mobLevel < combatLevel - SCRIPTED_AUTONOMY_CONFIG.MOB_LEVEL_MAX_BELOW
        ) {
          return false;
        }
      }

      const dist = this.getDistance2D(player.position, entity.position);
      return dist !== null && dist <= 50;
    });
  }

  private getResourceCandidates(
    skill: ResourceSkill,
    player: PlayerEntity,
  ): {
    candidates: Array<{ entity: Entity; distance: number }>;
    approachable: Array<{ entity: Entity; distance: number }>;
  } {
    if (!this.service) {
      return { candidates: [], approachable: [] };
    }

    const skillLevel = player.skills[skill]?.level ?? 1;
    const maxAbove = SCRIPTED_AUTONOMY_CONFIG.RESOURCE_LEVEL_MAX_ABOVE;
    const maxBelow = SCRIPTED_AUTONOMY_CONFIG.RESOURCE_LEVEL_MAX_BELOW;
    const approachRange = SCRIPTED_AUTONOMY_CONFIG.RESOURCE_APPROACH_RANGE;

    const resources = this.service
      .getNearbyEntities()
      .filter((entity) => this.isResourceForSkill(entity, skill))
      .filter((entity) => entity.depleted !== true);

    const withDistance = resources
      .map((entity) => {
        const dist = this.getDistance2D(player.position, entity.position);
        return { entity, distance: dist };
      })
      .filter(
        (item): item is { entity: Entity; distance: number } =>
          typeof item.distance === "number",
      )
      .sort((a, b) => a.distance - b.distance);

    const inBand = withDistance.filter(({ entity }) => {
      const requiredLevel = entity.requiredLevel ?? 1;
      if (requiredLevel > skillLevel + maxAbove) return false;
      return requiredLevel >= skillLevel - maxBelow;
    });

    const fallback = withDistance.filter(({ entity }) => {
      const requiredLevel = entity.requiredLevel ?? 1;
      return requiredLevel <= skillLevel + maxAbove;
    });

    const chosen = inBand.length > 0 ? inBand : fallback;
    const approachable = chosen.filter(
      (item) => item.distance <= approachRange,
    );

    return { candidates: chosen, approachable };
  }

  private hasToolForSkill(
    skill: ResourceSkill,
    items: InventoryItem[],
  ): boolean {
    const toolHint = this.getToolHint(skill);
    return items.some((item) =>
      this.getInventoryItemName(item).includes(toolHint),
    );
  }

  private getToolHint(skill: ResourceSkill): string {
    if (skill === "fishing") return "fishing rod";
    if (skill === "mining") return "pickaxe";
    return "hatchet";
  }

  private findNearbyToolItem(
    skill: ResourceSkill,
    player: PlayerEntity,
  ): Entity | null {
    if (!this.service) return null;
    const hint = this.getToolHint(skill);

    const playerPos = player.position;
    const items = this.service
      .getNearbyEntities()
      .filter((entity) => this.isGroundItem(entity));

    const candidates = items
      .map((entity) => {
        const name = (entity.name || entity.itemId || "").toLowerCase();
        if (!name.includes(hint)) return null;
        const dist = this.getDistance2D(playerPos, entity.position);
        if (dist === null) return null;
        return { entity, distance: dist };
      })
      .filter(
        (entry): entry is { entity: Entity; distance: number } =>
          entry !== null,
      )
      .sort((a, b) => a.distance - b.distance);

    return candidates.length > 0 ? candidates[0].entity : null;
  }

  private isGroundItem(entity: Entity): boolean {
    const type = (entity.type || "").toLowerCase();
    const entityType = (entity.entityType || "").toLowerCase();
    return type === "item" || entityType === "item" || !!entity.itemId;
  }

  private getInventoryItemName(item: InventoryItem): string {
    return (item.name || item.item?.name || item.itemId || "")
      .toString()
      .toLowerCase();
  }

  private isMobEntity(entity: Entity): boolean {
    if (entity.mobType) return true;
    const type = (entity.type || "").toLowerCase();
    const entityType = (entity.entityType || "").toLowerCase();
    if (type === "mob" || entityType === "mob") return true;
    const name = entity.name?.toLowerCase() || "";
    return /goblin|bandit|skeleton|zombie|rat|spider|wolf/i.test(name);
  }

  private isResourceForSkill(entity: Entity, skill: ResourceSkill): boolean {
    const resourceType = (entity.resourceType || "").toLowerCase();
    const name = entity.name?.toLowerCase() || "";

    if (skill === "woodcutting") {
      return resourceType === "tree" || name.includes("tree");
    }
    if (skill === "fishing") {
      return resourceType === "fishing_spot" || name.includes("fishing spot");
    }
    if (skill === "mining") {
      return (
        resourceType === "mining_rock" ||
        resourceType === "ore" ||
        name.includes("rock") ||
        name.includes("ore")
      );
    }
    return false;
  }

  private getMobLevel(entity: Entity): number | null {
    if (typeof entity.level === "number") return entity.level;
    const name = entity.name || "";
    const match = name.match(/lv\.?\s*(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private getPositionXZ(
    pos:
      | [number, number, number]
      | { x: number; y?: number; z: number }
      | null
      | undefined,
  ): { x: number; z: number } | null {
    if (!pos) return null;
    if (Array.isArray(pos) && pos.length >= 3) {
      return { x: pos[0], z: pos[2] };
    }
    const obj = pos as { x: number; z: number };
    return { x: obj.x, z: obj.z };
  }

  private getPositionArray(
    pos:
      | [number, number, number]
      | { x: number; y?: number; z: number }
      | null
      | undefined,
  ): [number, number, number] | null {
    if (!pos) return null;
    if (Array.isArray(pos) && pos.length >= 3) {
      return [pos[0], pos[1], pos[2]];
    }
    const obj = pos as { x: number; y?: number; z: number };
    return [obj.x, obj.y ?? 0, obj.z];
  }

  private getDistance2D(
    posA:
      | [number, number, number]
      | { x: number; y?: number; z: number }
      | null
      | undefined,
    posB:
      | [number, number, number]
      | { x: number; y?: number; z: number }
      | null
      | undefined,
  ): number | null {
    const a = this.getPositionXZ(posA);
    const b = this.getPositionXZ(posB);
    if (!a || !b) return null;
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Parse THINKING and ACTION from LLM response
   * Handles format: "THINKING: [reasoning]\nACTION: [action_name]"
   */
  private parseThinkingAndAction(
    response: string,
    actions: Action[],
  ): { thinking: string; actionName: string | null } {
    let thinking = "";
    let actionName: string | null = null;

    // Try to extract THINKING section
    const thinkingMatch = response.match(/THINKING:\s*(.+?)(?=ACTION:|$)/is);
    if (thinkingMatch) {
      thinking = thinkingMatch[1].trim();
      // Clean up any trailing whitespace or newlines
      thinking = thinking.replace(/\n+$/, "").trim();
      // Limit length for dashboard display
      if (thinking.length > 500) {
        thinking = thinking.substring(0, 497) + "...";
      }
    }

    // Try to extract ACTION section
    const actionMatch = response.match(/ACTION:\s*(\w+)/i);
    if (actionMatch) {
      const rawAction = actionMatch[1].toUpperCase();
      // Verify it's a valid action
      const validAction = actions.find((a) => a.name === rawAction);
      if (validAction) {
        actionName = validAction.name;
      }
    }

    // Fallback: if no ACTION: prefix, try to find any action name in the response
    if (!actionName) {
      actionName = this.parseActionFromResponse(response, actions);
    }

    // If no thinking was extracted but we have a response, use a cleaned version
    if (!thinking && response.trim()) {
      // Remove ACTION line and use rest as thinking
      thinking = response
        .replace(/ACTION:\s*\w+/gi, "")
        .replace(/THINKING:/gi, "")
        .trim();
      if (thinking.length > 500) {
        thinking = thinking.substring(0, 497) + "...";
      }
    }

    return { thinking, actionName };
  }

  /**
   * Sync the LLM's thinking to the dashboard for display
   */
  private syncThinkingToDashboard(thinking: string): void {
    if (!this.service) return;

    try {
      // Use the service to sync thoughts to the server
      // This will be displayed in the agent dashboard
      this.service.syncThoughtsToServer(thinking);
    } catch (error) {
      // Non-critical but worth logging so we can see which agents can't
      // reach the server (typically "Not connected to Hyperscape server").
      logger.warn(
        "[AutonomousBehavior] Could not sync thinking to dashboard:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Get the last LLM reasoning (for external access)
   */
  getLastThinking(): string {
    return this.lastThinking;
  }

  /**
   * Get available autonomous actions
   */
  /**
   * Skip LLM for obvious decisions — deterministic short-circuit.
   * Returns an action if the decision is obvious, null to fall through to LLM.
   */
  private tryShortCircuit(): Action | null {
    const player = this.service?.getPlayerEntity();
    if (!player) return null;

    const goal = this.currentGoal;

    // 0a. HIGHEST PRIORITY: Gravestone recovery — if we died and see our gravestone, go loot it
    const gravestone = this.findOwnGravestone();
    if (gravestone) {
      const dist = this.getEntityDistance2D(
        player.position,
        gravestone.position,
      );
      if (dist !== null && dist > 4) {
        // Too far — navigate to gravestone (run mode)
        logger.info(
          `[AutonomousBehavior] Gravestone detected ${dist.toFixed(1)}m away — running to recover items`,
        );
        return (
          this.getAvailableActions().find(
            (a) => a.name === "LOOT_GRAVESTONE",
          ) || moveToAction
        );
      }
      // Close enough — loot it
      logger.info(
        `[AutonomousBehavior] Gravestone within range — looting items`,
      );
      return (
        this.getAvailableActions().find((a) => a.name === "LOOT_GRAVESTONE") ||
        null
      );
    }

    // 0b. Pick up valuable ground items (coins, weapons, tools, food) — after gravestone but before goal check
    const valuableItem = this.findValuableGroundItem();
    if (valuableItem && !player.inCombat) {
      logger.info(
        `[AutonomousBehavior] Valuable ground item nearby: ${valuableItem.name} — picking up`,
      );
      return pickupItemAction;
    }

    // 1. No goal → use deterministic planner first, fallback to LLM SET_GOAL
    if (!goal) {
      const plan = this.tryPlannerGoal(player);
      if (plan) {
        // Planner set a goal — request fast tick so agent acts immediately
        this.nextTickFast = true;
        return null; // goal is set, next tick will act on it
      }
      // Planner returned null — fall through to LLM for SET_GOAL
      return (
        this.getAvailableActions().find((a) => a.name === "SET_GOAL") || null
      );
    }

    // 2. Goal completion detection — check skill-based goals
    if (goal.targetSkill && goal.targetSkillLevel) {
      const currentLevel = player.skills?.[goal.targetSkill]?.level ?? 1;
      if (currentLevel >= goal.targetSkillLevel) {
        logger.info(
          `[AutonomousBehavior] Goal COMPLETE via planner check: ${goal.targetSkill} level ${currentLevel} >= ${goal.targetSkillLevel}`,
        );
        this.clearGoal();
        // clearGoal() now chains via planner, fast tick requested there
        return null;
      }
    }

    // 2.1. Quest goal status change detection — re-plan when the quest's
    // server-side status evolves past what the goal was targeting.
    //   - Accept goal + quest now in_progress → Phase 3 continues it
    //   - In-progress goal + quest now ready_to_complete → Phase 2 turns it in
    //   - Turn-in goal + quest now completed → planner picks next goal
    if (goal.type === "questing" && goal.questId) {
      const quests = this.service?.getQuestState?.() || [];
      const quest = quests.find(
        (q: { questId?: string }) => q.questId === goal.questId,
      );
      const currentStatus = quest?.status;
      const isAcceptGoal = goal.description?.startsWith("Accept quest:");
      const isTurnInGoal = goal.description?.startsWith("Turn in quest:");

      if (
        // Accept goal → quest is now active or done
        (isAcceptGoal && currentStatus && currentStatus !== "not_started") ||
        // In-progress goal → quest stage complete, ready to turn in
        (!isAcceptGoal &&
          !isTurnInGoal &&
          currentStatus === "ready_to_complete") ||
        // Any non-accept goal → quest completed
        (!isAcceptGoal && currentStatus === "completed")
      ) {
        logger.info(
          `[AutonomousBehavior] Quest ${goal.questId} status → ${currentStatus} — re-planning`,
        );
        this.clearGoal();
        return null;
      }
    }

    // 2.5. Stale exploration invalidation — if the planner set exploration because
    // quest data wasn't loaded yet, re-evaluate now that data may have arrived.
    if (goal.type === "exploration") {
      const quests = this.service?.getQuestState?.() || [];
      if (quests.length > 0) {
        logger.info(
          "[AutonomousBehavior] Quest data arrived while exploring — re-evaluating goal",
        );
        this.clearGoal();
        return null; // clearGoal chains into tryPlannerGoal, next tick acts on new goal
      }
    }

    // 2.5a. Goal requires a tool the player doesn't have → check bank or re-plan
    // This prevents the LLM from trying to fish without a net, chop without an axe, etc.
    const toolCheckMap: Record<
      string,
      {
        hasIt: (p: PlayerEntity) => boolean;
        bankKeywords: string[];
      }
    > = {
      fishing: {
        hasIt: (p) => hasFishingEquipment(p),
        bankKeywords: ["net", "fishing"],
      },
      woodcutting: {
        hasIt: (p) => hasAxe(p),
        bankKeywords: ["axe", "hatchet"],
      },
      mining: { hasIt: (p) => hasPickaxe(p), bankKeywords: ["pickaxe"] },
    };
    const toolInfo = toolCheckMap[goal.type];
    if (toolInfo && !toolInfo.hasIt(player)) {
      // Check if the tool might be in the bank
      const cachedBankItems = this.service?.getBankItems?.() || [];
      const toolInBank = cachedBankItems.some((item) => {
        const name = (item.name || item.itemId || "").toLowerCase();
        return toolInfo.bankKeywords.some((kw) => name.includes(kw));
      });

      if (toolInBank) {
        logger.info(
          `[AutonomousBehavior] Goal "${goal.type}" tool is in bank — switching to banking to withdraw`,
        );
        this.savedGoal = { ...goal };
        this.currentGoal = {
          type: "banking",
          description: `Withdraw ${goal.type} tool from bank`,
          target: 1,
          progress: 0,
          location: "bank",
          startedAt: Date.now(),
        };
        this.nextTickFast = true;
        return null;
      }

      logger.info(
        `[AutonomousBehavior] Goal "${goal.type}" requires a tool the player doesn't have — clearing goal to re-plan`,
      );
      this.clearGoal();
      this.nextTickFast = true;
      return null; // Re-plan on next tick
    }

    // 2.5b. Eat food in combat when low health (survival reflex)
    const healthPercent = this.getHealthPercent(player);
    if (player.inCombat && healthPercent < 50 && hasAnyFood(player)) {
      const foodItem = this.findFirstFoodItem(player);
      if (foodItem && this.service) {
        logger.info(
          `[AutonomousBehavior] Low health in combat (${Math.round(healthPercent)}%) — eating ${foodItem.name}`,
        );
        // Fire-and-forget: send eat command, continue to combat handling
        this.service.executeUseItem({ itemId: foodItem.id }).catch((err) => {
          logger.warn(
            `[AutonomousBehavior] Failed to eat food: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
        this.nextTickFast = true;
        // Don't return — fall through to combat handling so we keep fighting
      }
    }

    // 3. Combat handling — context-aware
    if (player.inCombat) {
      const isCombatGoal =
        goal.type === "combat_training" ||
        (goal.type === "questing" && goal.questStageType === "kill");

      if (isCombatGoal) {
        // Goal IS combat → keep fighting
        return (
          this.getAvailableActions().find((a) => a.name === "ATTACK_ENTITY") ||
          null
        );
      }

      // Goal is NOT combat (e.g., fishing) — reactive combat
      const now = Date.now();
      if (this.reactiveCombatStartTime === 0) {
        // Just got attacked — start reactive timer, save goal
        this.reactiveCombatStartTime = now;
        if (!this.savedGoal) {
          this.savedGoal = { ...goal };
        }
        logger.info(
          `[AutonomousBehavior] Reactive combat started — fighting back (max ${this.REACTIVE_COMBAT_MAX_MS / 1000}s)`,
        );
        return (
          this.getAvailableActions().find((a) => a.name === "ATTACK_ENTITY") ||
          null
        );
      }

      if (now - this.reactiveCombatStartTime < this.REACTIVE_COMBAT_MAX_MS) {
        // Still within reactive window — keep fighting
        return (
          this.getAvailableActions().find((a) => a.name === "ATTACK_ENTITY") ||
          null
        );
      }

      // Exceeded reactive window — flee and restore goal
      logger.info("[AutonomousBehavior] Reactive combat timeout — fleeing");
      this.reactiveCombatStartTime = 0;
      if (this.savedGoal) {
        this.currentGoal = this.savedGoal;
        this.savedGoal = null;
      }
      return this.getAvailableActions().find((a) => a.name === "FLEE") || null;
    }

    // Not in combat — clear reactive timer if it was set
    if (this.reactiveCombatStartTime !== 0) {
      this.reactiveCombatStartTime = 0;
      // Combat ended naturally — restore saved goal if we have one
      if (this.savedGoal && goal.type !== this.savedGoal.type) {
        logger.info(
          "[AutonomousBehavior] Reactive combat ended — restoring saved goal",
        );
        this.currentGoal = this.savedGoal;
        this.savedGoal = null;
        this.nextTickFast = true;
        return null;
      }
    }

    // 4. Inventory full → switch to banking goal (deterministic, no LLM needed)
    const inventoryItems = Array.isArray(player.items) ? player.items : [];
    if (inventoryItems.length >= 28 && goal.type !== "banking") {
      // Save current goal and switch to banking
      if (!this.savedGoal) {
        this.savedGoal = { ...goal };
      }
      this.currentGoal = {
        type: "banking",
        description: "Bank items — inventory is full",
        progress: 0,
        target: 1,
        location: "bank",
        startedAt: Date.now(),
      };
      logger.info(
        "[AutonomousBehavior] Short-circuit: inventory full → banking goal",
      );
      // Check if bank is nearby
      const bank = this.findNearestBankEntity();
      if (bank) {
        return (
          this.getAvailableActions().find(
            (a) => a.name === "BANK_DEPOSIT_ALL",
          ) || null
        );
      }
      // No bank nearby — navigate to one
      return (
        this.getAvailableActions().find((a) => a.name === "NAVIGATE_TO") || null
      );
    }

    // 5. Banking goal + bank nearby → BANK_DEPOSIT_ALL
    if (goal.type === "banking") {
      const bank = this.findNearestBankEntity();
      if (bank) {
        return (
          this.getAvailableActions().find(
            (a) => a.name === "BANK_DEPOSIT_ALL",
          ) || null
        );
      }
    }

    // 5.5. Goal requires travel to a known destination → NAVIGATE_TO directly
    // Prevents wasting LLM ticks on EXPLORE when the agent already knows where to go
    if (
      this.lastActionName !== "NAVIGATE_TO" &&
      !player.inCombat &&
      this.shouldNavigateToGoal(goal, player)
    ) {
      const navigateAction =
        this.getAvailableActions().find((a) => a.name === "NAVIGATE_TO") ||
        null;
      if (navigateAction) {
        logger.info(
          `[AutonomousBehavior] Short-circuit: goal "${goal.type}" requires travel — NAVIGATE_TO`,
        );
        return navigateAction;
      }
    }

    // 6. Last action was NAVIGATE_TO and succeeded → check if arrived, then act
    if (
      this.lastActionName === "NAVIGATE_TO" &&
      this.lastActionResult === "success"
    ) {
      const goalAction = this.getGoalActionOnArrival(goal, player);
      if (goalAction) {
        logger.info(
          `[AutonomousBehavior] Arrived at destination — acting on goal: ${goalAction.name}`,
        );
        return goalAction;
      }

      // getGoalActionOnArrival returned null — but we may actually be near matching resources
      // (e.g., fishing spots nearby but resolveCurrentGoalTarget couldn't find the exact position).
      // Check for nearby resources before blindly re-issuing NAVIGATE_TO.
      const nearbyEntities = this.service?.getNearbyEntities() || [];
      const nearbyResourceAction = this.getResourceActionForGoal(
        goal,
        nearbyEntities,
      );
      if (nearbyResourceAction) {
        logger.info(
          `[AutonomousBehavior] Post-NAVIGATE_TO: resources found nearby — ${nearbyResourceAction.name}`,
        );
        return nearbyResourceAction;
      }

      // Not arrived yet — keep navigating
      return (
        this.getAvailableActions().find((a) => a.name === "NAVIGATE_TO") || null
      );
    }

    // 7. Last action was same resource action and goal type matches → repeat
    if (this.lastActionName && this.lastActionResult === "success") {
      const repeatMap: Record<string, string> = {
        woodcutting: "CHOP_TREE",
        fishing: "CATCH_FISH",
        mining: "MINE_ROCK",
      };
      const expectedAction = repeatMap[goal.type];
      if (expectedAction && this.lastActionName === expectedAction) {
        // Same goal, same action succeeded — check if resources still nearby
        const entities = this.service?.getNearbyEntities() || [];
        const hasResources = this.hasNearbyResourcesForGoal(
          goal.type,
          entities,
        );

        // Check if all nearby resources are depleted
        if (
          !hasResources &&
          this.hasDepletedResourcesForGoal(goal.type, entities)
        ) {
          logger.info(
            `[AutonomousBehavior] Resources depleted for ${goal.type} — exploring for more`,
          );
          return exploreAction;
        }
        if (hasResources) {
          return (
            this.getAvailableActions().find((a) => a.name === expectedAction) ||
            null
          );
        }
      }
    }

    // 8. Goal-action enforcement — prevent the LLM from going rogue.
    // If we have a clear goal, select the appropriate action deterministically
    // instead of letting the LLM pick ATTACK_ENTITY during a questing goal.
    if (!player.inCombat) {
      const actions = this.getAvailableActions();
      const find = (name: string) =>
        actions.find((a) => a.name === name) || null;

      switch (goal.type) {
        case "combat_training": {
          // Attack mobs in the area
          const mob = find("ATTACK_ENTITY");
          if (mob) return mob;
          break;
        }
        case "questing": {
          // Determine quest-appropriate action based on stage type
          if (goal.questStageType === "kill") {
            const attack = find("ATTACK_ENTITY");
            if (attack) return attack;
          } else {
            // For non-kill quests (dialogue, gather, interact, accept),
            // navigate to the quest location — never attack random mobs
            const nav = find("NAVIGATE_TO");
            if (nav) return nav;
          }
          break;
        }
        case "cooking": {
          const cook = find("COOK_FOOD");
          if (cook) return cook;
          break;
        }
        case "smithing": {
          if (goal.location === "furnace") {
            const smelt = find("SMELT_ORE");
            if (smelt) return smelt;
          } else {
            const smith = find("SMITH_ITEM");
            if (smith) return smith;
          }
          break;
        }
        case "banking": {
          const bank = find("NAVIGATE_TO");
          if (bank) return bank;
          break;
        }
        case "fishing": {
          const fish = find("CATCH_FISH");
          if (fish) return fish;
          break;
        }
        case "woodcutting": {
          const chop = find("CHOP_TREE");
          if (chop) return chop;
          break;
        }
        case "mining": {
          const mine = find("MINE_ROCK");
          if (mine) return mine;
          break;
        }
        default:
          break; // exploration, idle → let LLM decide
      }
    }

    return null; // No short-circuit — use LLM
  }

  /**
   * Try the deterministic planner to set a goal.
   * Returns true if a goal was set, false otherwise.
   */
  private tryPlannerGoal(player: PlayerEntity): boolean {
    if (!this.service) return false;
    if (this.goalPaused) return false;

    const quests = this.service.getQuestState?.() || [];
    const recentGoalCounts = this.getRecentGoalCounts();
    const bankItems = this.service.getBankItems?.() || [];
    const bankItemNames = bankItems.map((b) =>
      (b.name || b.itemId || "").toLowerCase(),
    );
    const ctx = buildPlannerContext(
      player,
      quests,
      recentGoalCounts,
      bankItemNames,
    );
    const plan = planNextGoal(ctx);

    if (plan) {
      logPlannerDecision(plan);
      this.setGoal(plan.goal);
      logger.info(
        `[AutonomousBehavior] Planner set goal: ${plan.goal.type} — ${plan.reason}`,
      );

      // Sync planner reasoning as thinking to the dashboard so agents
      // show activity even when LLM calls fail on subsequent ticks
      this.lastThinking = `Goal: ${plan.goal.description} (${plan.reason})`;
      this.syncThinkingToDashboard(this.lastThinking);

      // If it's a quest accept, send the accept packet
      if (
        plan.goal.type === "questing" &&
        plan.goal.questId &&
        plan.goal.description.startsWith("Accept quest:")
      ) {
        this.service.sendQuestAccept(plan.goal.questId);
        // Refresh quest list to get updated state
        setTimeout(() => this.service?.requestQuestList?.(), 1500);
      }

      return true;
    }

    return false;
  }

  private findNearestBankEntity(): { id: string; name?: string } | null {
    const entities = this.service?.getNearbyEntities() || [];
    return (
      (entities.find((entity) => {
        const name = entity.name?.toLowerCase() || "";
        const type = (entity.type || "").toLowerCase();
        return type === "bank" || name.includes("bank");
      }) as { id: string; name?: string } | undefined) || null
    );
  }

  /**
   * Find the player's own gravestone among nearby entities.
   * Mirrors AgentBehaviorTicker.findOwnGravestone for LLM agents.
   */
  private findOwnGravestone(): Entity | null {
    const player = this.service?.getPlayerEntity();
    const playerId = player?.id;
    if (!playerId) return null;

    const entities = this.service?.getNearbyEntities() || [];
    for (const entity of entities) {
      const id = entity.id || "";
      const name = (entity.name || "").toLowerCase();
      // Gravestone IDs are formatted as "gravestone_<playerId>_<timestamp>"
      if (
        (id.includes("gravestone") && id.includes(playerId)) ||
        (name.includes("gravestone") && name.includes(playerId))
      ) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Find valuable ground items nearby (coins, tools, food, weapons).
   * Returns the closest one within 10m, or null.
   */
  private findValuableGroundItem(): Entity | null {
    const player = this.service?.getPlayerEntity();
    if (!player?.position) return null;

    const inventoryItems = Array.isArray(player.items) ? player.items : [];
    if (inventoryItems.length >= 28) return null; // inventory full

    const entities = this.service?.getNearbyEntities() || [];
    const VALUABLE_KEYWORDS = [
      "coin",
      "gold",
      "sword",
      "scimitar",
      "axe",
      "hatchet",
      "pickaxe",
      "fishing",
      "net",
      "rod",
      "food",
      "shrimp",
      "trout",
      "salmon",
      "lobster",
      "swordfish",
      "shark",
      "bread",
      "meat",
      "ore",
      "bar",
      "rune",
      "arrow",
      "bow",
      "staff",
      "helmet",
      "platebody",
      "legs",
      "shield",
      "boots",
      "gloves",
    ];

    let bestItem: Entity | null = null;
    let bestDist = 10; // max 10m

    for (const entity of entities) {
      const entityType = (entity.type || "").toLowerCase();
      if (entityType !== "item" && entityType !== "grounditem") continue;

      const name = (entity.name || "").toLowerCase();
      const isValuable = VALUABLE_KEYWORDS.some((kw) => name.includes(kw));
      if (!isValuable) continue;

      const dist = this.getEntityDistance2D(player.position, entity.position);
      if (dist !== null && dist < bestDist) {
        bestDist = dist;
        bestItem = entity;
      }
    }

    return bestItem;
  }

  /**
   * 2D distance helper for short-circuit checks
   */
  private getEntityDistance2D(pos1: unknown, pos2: unknown): number | null {
    let x1: number, z1: number;
    if (Array.isArray(pos1) && pos1.length >= 3) {
      x1 = pos1[0];
      z1 = pos1[2];
    } else if (pos1 && typeof pos1 === "object" && "x" in pos1) {
      const p = pos1 as { x: number; z: number };
      x1 = p.x;
      z1 = p.z;
    } else {
      return null;
    }

    let x2: number, z2: number;
    if (Array.isArray(pos2) && pos2.length >= 3) {
      x2 = pos2[0];
      z2 = pos2[2];
    } else if (pos2 && typeof pos2 === "object" && "x" in pos2) {
      const p = pos2 as { x: number; z: number };
      x2 = p.x;
      z2 = p.z;
    } else {
      return null;
    }

    return Math.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2);
  }

  private hasNearbyResourcesForGoal(
    goalType: string,
    entities: Array<{
      name?: string;
      resourceType?: string;
      type?: string;
      depleted?: boolean;
    }>,
  ): boolean {
    return entities.some((e) => {
      if (e.depleted) return false;
      const rt = (e.resourceType || "").toLowerCase();
      const name = (e.name || "").toLowerCase();
      switch (goalType) {
        case "woodcutting":
          return rt === "tree" || /tree/i.test(name);
        case "fishing":
          return rt === "fishing_spot" || name.includes("fishing spot");
        case "mining":
          return rt === "mining_rock" || rt === "ore" || name.includes("rock");
        default:
          return false;
      }
    });
  }

  /**
   * Check if nearby resources for goal type are all depleted (exist but can't be used).
   */
  private hasDepletedResourcesForGoal(
    goalType: string,
    entities: Array<{
      name?: string;
      resourceType?: string;
      type?: string;
      depleted?: boolean;
    }>,
  ): boolean {
    return entities.some((e) => {
      if (!e.depleted) return false;
      const rt = (e.resourceType || "").toLowerCase();
      const name = (e.name || "").toLowerCase();
      switch (goalType) {
        case "woodcutting":
          return rt === "tree" || /tree/i.test(name);
        case "fishing":
          return rt === "fishing_spot" || name.includes("fishing spot");
        case "mining":
          return rt === "mining_rock" || rt === "ore" || name.includes("rock");
        default:
          return false;
      }
    });
  }

  /**
   * Get a fallback action when the selected action fails validation.
   * Tries goal-appropriate alternatives before giving up.
   */
  private getFallbackAction(failedActionName: string): Action | null {
    const goal = this.currentGoal;
    const actions = this.getAvailableActions();
    const find = (name: string) => actions.find((a) => a.name === name) || null;

    switch (failedActionName) {
      case "CHOP_TREE":
      case "MINE_ROCK":
      case "CATCH_FISH": {
        // Resource action failed → try navigating to resource location
        if (goal?.location) return find("NAVIGATE_TO");
        return find("EXPLORE");
      }
      case "NAVIGATE_TO":
        return find("EXPLORE");
      case "ATTACK_ENTITY":
        // No valid target → navigate to combat area or explore
        if (goal?.location) return find("NAVIGATE_TO");
        return find("EXPLORE");
      case "BANK_DEPOSIT_ALL":
      case "BANK_DEPOSIT":
        // Bank not nearby → ensure goal has location and navigate
        if (goal && !goal.location) {
          goal.location = "bank";
        }
        return find("NAVIGATE_TO");
      default:
        return null;
    }
  }

  /**
   * After NAVIGATE_TO succeeds, check if we've arrived at destination
   * and return the appropriate goal action.
   */
  private getGoalActionOnArrival(
    goal: CurrentGoal,
    player: PlayerEntity,
  ): Action | null {
    // Resolve the target position for the current goal
    const targetPos = this.resolveCurrentGoalTarget(goal);
    if (!targetPos) return null;

    const dist = this.getDistance2D(player.position, targetPos);
    if (dist === null || dist > 15) return null; // Not arrived yet

    // We're within 15 units of destination — map goal type to action
    const actions = this.getAvailableActions();
    const find = (name: string) => actions.find((a) => a.name === name) || null;

    switch (goal.type) {
      case "woodcutting":
        return find("CHOP_TREE");
      case "mining":
        return find("MINE_ROCK");
      case "fishing":
        return find("CATCH_FISH");
      case "combat_training":
        return find("ATTACK_ENTITY");
      case "banking":
        return find("BANK_DEPOSIT_ALL");
      case "smithing":
        if (hasOre({ items: player.items } as PlayerEntity))
          return find("SMELT_ORE");
        if (hasBars({ items: player.items } as PlayerEntity))
          return find("SMITH_ITEM");
        return null;
      case "cooking":
        return find("COOK_FOOD");
      case "questing": {
        // Check quest state to determine if ready to turn in
        const questState = this.service?.getQuestState?.() || [];
        const activeQuest = questState.find(
          (q: { questId?: string; id?: string; status?: string }) =>
            q.questId === goal.questId || q.id === goal.questId,
        ) as { status?: string } | undefined;

        if (activeQuest?.status === "ready_to_complete")
          return find("COMPLETE_QUEST");
        if (!goal.questStageType) return find("ACCEPT_QUEST");

        switch (goal.questStageType) {
          case "kill":
            return find("ATTACK_ENTITY");
          case "dialogue":
            return find("TALK_TO_NPC");
          case "gather": {
            const target = (goal.questStageTarget || "").toLowerCase();
            if (target.includes("log") || target.includes("wood"))
              return find("CHOP_TREE");
            if (target.includes("ore")) return find("MINE_ROCK");
            if (target.includes("fish") || target.includes("shrimp"))
              return find("CATCH_FISH");
            return null;
          }
          case "interact": {
            const iTarget = (goal.questStageTarget || "").toLowerCase();
            if (iTarget.includes("smelt") || iTarget.includes("furnace"))
              return find("SMELT_ORE");
            if (iTarget.includes("smith") || iTarget.includes("anvil"))
              return find("SMITH_ITEM");
            if (iTarget.includes("cook") || iTarget.includes("range"))
              return find("COOK_FOOD");
            if (iTarget.includes("fire")) return find("LIGHT_FIRE");
            return find("TALK_TO_NPC");
          }
          default:
            return null;
        }
      }
      default:
        return null;
    }
  }

  /**
   * Resolve the target position for the current goal.
   * Updates KNOWN_LOCATIONS from nearby entities, then checks
   * goal.targetPosition, KNOWN_LOCATIONS, and quest-specific lookups.
   */
  private resolveCurrentGoalTarget(
    goal: CurrentGoal,
  ): [number, number, number] | null {
    if (goal.targetPosition) return goal.targetPosition;

    // Ensure KNOWN_LOCATIONS has latest positions from nearby entities
    if (this.service) {
      updateKnownLocationsFromNearbyEntities(this.service);
    }

    if (goal.location) {
      const loc = KNOWN_LOCATIONS[goal.location];
      if (loc?.position) return loc.position;
    }

    // Questing fallback: resolve via questStartNpc or quest stage location
    if (goal.type === "questing") {
      if (goal.questStartNpc) {
        const npcLoc = KNOWN_LOCATIONS[goal.questStartNpc];
        if (npcLoc?.position) return npcLoc.position;
      }
      const stagePos = this.resolveQuestStageLocation(
        goal.questStageType,
        goal.questStageTarget,
      );
      if (stagePos) return stagePos;
    }

    return null;
  }

  /**
   * Map quest stage type + target to a known area position.
   */
  private resolveQuestStageLocation(
    stageType?: string,
    stageTarget?: string,
  ): [number, number, number] | null {
    if (!stageType || !stageTarget) return null;
    const target = stageTarget.toLowerCase();
    let areaKey: string | null = null;

    if (stageType === "kill") {
      areaKey = "spawn";
    } else if (stageType === "gather") {
      if (target.includes("log") || target.includes("wood")) areaKey = "forest";
      else if (target.includes("ore")) areaKey = "mine";
      else if (target.includes("fish") || target.includes("shrimp"))
        areaKey = "fishing";
    } else if (stageType === "interact") {
      if (target.includes("smelt") || target.includes("furnace"))
        areaKey = "furnace";
      else if (target.includes("smith") || target.includes("anvil"))
        areaKey = "anvil";
    }

    if (areaKey) {
      const loc = KNOWN_LOCATIONS[areaKey];
      if (loc?.position) return loc.position;
    }
    return null;
  }

  /**
   * Check if the current goal requires travel to a known destination
   * that is > 15 units away. Skips if nearby resources already match the goal.
   */
  private shouldNavigateToGoal(
    goal: CurrentGoal,
    player: PlayerEntity,
  ): boolean {
    // Resolve a target position for this goal
    const targetPos = this.resolveCurrentGoalTarget(goal);
    if (!targetPos) return false;

    // Check distance — only navigate if far away
    const dist = this.getDistance2D(player.position, targetPos);
    if (dist === null || dist <= 15) return false;

    // If the goal is a resource-gathering type, check if matching resources are already nearby
    const entities = this.service?.getNearbyEntities() || [];
    const resourceGoalTypes = ["woodcutting", "fishing", "mining"];
    if (resourceGoalTypes.includes(goal.type)) {
      if (this.hasNearbyResourcesForGoal(goal.type, entities)) return false;
    }

    // For questing kill goals, check if combat targets are already nearby
    if (goal.type === "questing" && goal.questStageType === "kill") {
      if (this.hasNearbyResourcesForGoal("combat_training", entities))
        return false;
      // Also check for any attackable entities nearby
      const hasTarget = entities.some((e) => {
        const type = (e.type || "").toLowerCase();
        return type === "mob" || type === "npc" || type === "monster";
      });
      if (hasTarget) return false;
    }

    return true;
  }

  /**
   * Map a goal type to the appropriate resource action when matching resources are nearby.
   * Returns null if no matching resources or goal type has no resource action.
   */
  private getResourceActionForGoal(
    goal: CurrentGoal,
    entities: Array<{
      name?: string;
      resourceType?: string;
      type?: string;
      depleted?: boolean;
    }>,
  ): Action | null {
    const goalTypeToAction: Record<string, string> = {
      woodcutting: "CHOP_TREE",
      fishing: "CATCH_FISH",
      mining: "MINE_ROCK",
      combat_training: "ATTACK_ENTITY",
    };

    // For questing goals, map stage type to resource type
    let effectiveGoalType: string = goal.type;
    if (goal.type === "questing" && goal.questStageType) {
      const stageMap: Record<string, string> = {
        kill: "combat_training",
        gather: this.questStageTargetToGoalType(goal.questStageTarget),
      };
      effectiveGoalType = stageMap[goal.questStageType] || goal.type;
    }

    const actionName = goalTypeToAction[effectiveGoalType];
    if (!actionName) return null;

    if (!this.hasNearbyResourcesForGoal(effectiveGoalType, entities))
      return null;

    return (
      this.getAvailableActions().find((a) => a.name === actionName) || null
    );
  }

  /**
   * Map quest stage target text to an effective goal type for resource matching.
   */
  private questStageTargetToGoalType(target?: string): string {
    if (!target) return "";
    const t = target.toLowerCase();
    if (t.includes("log") || t.includes("wood")) return "woodcutting";
    if (t.includes("ore")) return "mining";
    if (t.includes("fish") || t.includes("shrimp")) return "fishing";
    return "";
  }

  /**
   * Find the first food item in the player's inventory.
   */
  private findFirstFoodItem(
    player: PlayerEntity,
  ): { id: string; name: string } | null {
    const items = Array.isArray(player.items) ? player.items : [];
    for (const item of items) {
      const name = (
        item.name ||
        (item as { item?: { name?: string } }).item?.name ||
        item.itemId ||
        ""
      )
        .toString()
        .toLowerCase();
      if (
        name.includes("shrimp") ||
        name.includes("anchovies") ||
        name.includes("sardine") ||
        name.includes("herring") ||
        name.includes("trout") ||
        name.includes("salmon") ||
        name.includes("tuna") ||
        name.includes("lobster") ||
        name.includes("swordfish") ||
        name.includes("shark") ||
        name.includes("bread") ||
        name.includes("meat") ||
        name.includes("cooked") ||
        name.includes("pie") ||
        name.includes("cake")
      ) {
        return {
          id: item.id || item.itemId || "",
          name,
        };
      }
    }
    return null;
  }

  private getAvailableActions(): Action[] {
    return [
      setGoalAction,
      navigateToAction,
      attackEntityAction,
      chopTreeAction,
      mineRockAction,
      catchFishAction,
      lightFireAction,
      cookFoodAction,
      smeltOreAction,
      smithItemAction,
      fletchItemAction,
      runecraftAction,
      pickupItemAction,
      equipItemAction,
      talkToNpcAction,
      acceptQuestAction,
      completeQuestAction,
      checkQuestAction,
      buyItemAction,
      sellItemAction,
      bankDepositAction,
      bankWithdrawAction,
      bankDepositAllAction,
      greetPlayerAction,
      shareOpinionAction,
      offerHelpAction,
      exploreAction,
      fleeAction,
      idleAction,
      approachEntityAction,
      useItemAction,
      dropItemAction,
      moveToAction,
      lootGravestoneAction,
    ];
  }

  /**
   * Build prompt for action selection with OSRS common sense knowledge
   * This prompt gives the LLM context AND common sense rules so it can make intelligent decisions
   */
  private buildActionSelectionPrompt(state: State, actions: Action[]): string {
    const goal = this.currentGoal;
    const player = this.service?.getPlayerEntity();
    const nearbyEntities = this.service?.getNearbyEntities() || [];

    // Extract player stats
    const skills = player?.skills as
      | Record<string, { level: number; xp: number }>
      | undefined;
    const skillsData = state.skillsData as
      | { totalLevel?: number; combatLevel?: number }
      | undefined;

    // Extract facts from evaluators
    const survivalFacts = (state.survivalFacts as string[]) || [];
    const combatFacts = (state.combatFacts as string[]) || [];

    // Get equipment status using item detection utilities
    const hasWeaponEquipped = hasWeapon(player);
    const hasCombatItem = hasCombatCapableItem(player);
    const playerHasOre = hasOre(player);
    const playerHasBars = hasBars(player);

    // Check for specific tools in inventory
    const inventory = player?.items || [];
    const inventoryNames = inventory.map(
      (item: { name?: string; itemId?: string }) =>
        (item.name || item.itemId || "").toLowerCase(),
    );
    const hasAxe = inventoryNames.some(
      (n: string) => n.includes("axe") || n.includes("hatchet"),
    );
    const hasPickaxe = inventoryNames.some((n: string) =>
      n.includes("pickaxe"),
    );
    const hasTinderbox = inventoryNames.some((n: string) =>
      n.includes("tinderbox"),
    );
    const hasNet = inventoryNames.some(
      (n: string) => n.includes("net") || n.includes("rod"),
    );
    const hasFood = inventoryNames.some(
      (n: string) =>
        n.includes("shrimp") ||
        n.includes("bread") ||
        n.includes("meat") ||
        n.includes("fish") ||
        n.includes("cooked") ||
        n.includes("trout") ||
        n.includes("salmon"),
    );
    const hasLogs = inventoryNames.some((n: string) => n.includes("log"));

    const currentHealth = player?.health?.current ?? 100;
    const maxHealth = player?.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? Math.round((currentHealth / maxHealth) * 100) : 100;

    // Calculate distance helper
    const playerPos = player?.position;
    const getDistance = (entityPos: unknown): number | null => {
      if (!playerPos || !entityPos) return null;
      let ex = 0,
        ez = 0,
        px = 0,
        pz = 0;
      if (Array.isArray(entityPos)) {
        ex = entityPos[0];
        ez = entityPos[2];
      } else if (
        typeof entityPos === "object" &&
        entityPos &&
        "x" in entityPos
      ) {
        ex = (entityPos as { x: number; z: number }).x;
        ez = (entityPos as { x: number; z: number }).z;
      }
      if (Array.isArray(playerPos)) {
        px = playerPos[0];
        pz = playerPos[2];
      } else if (typeof playerPos === "object" && "x" in playerPos) {
        px = (playerPos as { x: number; z: number }).x;
        pz = (playerPos as { x: number; z: number }).z;
      }
      return Math.sqrt((px - ex) ** 2 + (pz - ez) ** 2);
    };

    // Count nearby entities
    let treesNearby = 0,
      rocksNearby = 0,
      fishingSpotsNearby = 0,
      mobsNearby = 0;
    let bankNearby = false;
    let furnaceNearby = false;
    let anvilNearby = false;
    let npcsNearby = 0;
    let playersNearby = 0;
    const mobNames: string[] = [];
    const npcNames: string[] = [];
    const playerNames: string[] = [];

    for (const entity of nearbyEntities) {
      const dist = getDistance(entity.position);
      if (dist === null || dist > 30) continue;

      const name = entity.name?.toLowerCase() || "";
      const resourceType = entity.resourceType;
      const entityType = entity.entityType;
      const type = (entity.type || "").toLowerCase();

      if (entity.depleted === true) continue;

      if (
        entityType === "banker" ||
        entityType === "bank" ||
        type === "bank" ||
        type === "banker" ||
        name.includes("bank")
      ) {
        bankNearby = true;
      } else if (resourceType === "tree" || name.includes("tree")) {
        treesNearby++;
      } else if (
        resourceType === "rock" ||
        resourceType === "ore" ||
        name.includes("rock") ||
        /copper|tin|iron|coal/i.test(name)
      ) {
        rocksNearby++;
      } else if (resourceType === "fishing_spot" || name.includes("fishing")) {
        fishingSpotsNearby++;
      } else if (
        type === "furnace" ||
        entityType === "furnace" ||
        name.includes("furnace")
      ) {
        furnaceNearby = true;
      } else if (
        type === "anvil" ||
        entityType === "anvil" ||
        name.includes("anvil")
      ) {
        anvilNearby = true;
      } else if (
        entityType === "npc" ||
        type === "npc" ||
        entityType === "quest_giver" ||
        entityType === "shopkeeper" ||
        entityType === "banker"
      ) {
        npcsNearby++;
        if (npcNames.length < 3) npcNames.push(entity.name || "NPC");
      } else if (entity.playerId && entity.id !== player?.id) {
        playersNearby++;
        if (playerNames.length < 3) playerNames.push(entity.name || "Player");
      } else if (
        entity.mobType ||
        entity.type === "mob" ||
        /goblin|bandit|skeleton|zombie|rat|spider|wolf/i.test(name)
      ) {
        if (entity.alive !== false) {
          mobsNearby++;
          if (mobNames.length < 3) mobNames.push(entity.name || "mob");
        }
      }
    }

    // Build the prompt with THINKING + ACTION format
    const lines: string[] = [];

    // === SYSTEM INSTRUCTION ===
    const traits = getPersonalityTraits(this.runtime);
    lines.push(
      "You are a character living in an OSRS-style RPG. You have your own personality and preferences.",
    );
    lines.push(
      "Think through your decision step by step, keeping your personality in mind.",
    );
    lines.push("");
    lines.push("RESPONSE FORMAT:");
    lines.push(
      "THINKING: [Your reasoning about what to do and why, in character]",
    );
    lines.push("ACTION: [The action name to take]");
    lines.push("");

    // === PERSONALITY ===
    lines.push("=== YOUR PERSONALITY ===");
    if (traits.sociability > 0.6)
      lines.push("- You're SOCIAL and love chatting with players");
    else if (traits.sociability < 0.3)
      lines.push("- You prefer keeping to yourself and focusing on tasks");
    if (traits.adventurousness > 0.6)
      lines.push("- You're ADVENTUROUS and love quests and exploring");
    else if (traits.adventurousness < 0.3)
      lines.push("- You prefer familiar routines and efficient grinding");
    if (traits.helpfulness > 0.6)
      lines.push("- You're HELPFUL and go out of your way to assist others");
    if (traits.preferredSkills.length > 0)
      lines.push(`- Favorite activities: ${traits.preferredSkills.join(", ")}`);
    if (traits.quirks.length > 0) lines.push(`- Quirk: ${traits.quirks[0]}`);
    lines.push("");

    // === OSRS COMMON SENSE RULES ===
    lines.push("=== GAME KNOWLEDGE (Important!) ===");
    lines.push("These are the fundamental rules of the game:");
    lines.push("");
    lines.push("GATHERING SKILLS:");
    lines.push(
      "- Woodcutting: You NEED an axe/hatchet to chop trees. Without one, you cannot cut trees.",
    );
    lines.push(
      "- Mining: You NEED a pickaxe to mine rocks. Without one, you cannot mine ore.",
    );
    lines.push(
      "- Fishing: You NEED a fishing net or rod to catch fish. Without one, you cannot fish.",
    );
    lines.push("- Firemaking: You NEED a tinderbox AND logs to make a fire.");
    lines.push("");
    lines.push("COMBAT:");
    lines.push(
      "- You fight MUCH better with a weapon equipped. Unarmed combat is very weak.",
    );
    lines.push(
      "- If you have a weapon in inventory but not equipped, EQUIP IT before fighting!",
    );
    lines.push(
      "- Having food lets you heal during combat. Without food, you might die.",
    );
    lines.push("- If health drops below 30%, you should FLEE to survive.");
    lines.push("");
    lines.push("GETTING STARTED:");
    lines.push(
      "- New players should talk to NPCs and accept quests to get starter tools.",
    );
    lines.push(
      '- "Lumberjack\'s First Lesson" gives bronze hatchet + tinderbox (talk to Forester Wilma).',
    );
    lines.push(
      '- "Fresh Catch" gives a small fishing net (talk to Fisherman Pete).',
    );
    lines.push(
      '- "Torvin\'s Tools" gives bronze pickaxe + hammer (talk to Torvin).',
    );
    lines.push(
      "- Use ACCEPT_QUEST to accept available quests. Quest items are granted immediately on accept.",
    );
    lines.push(
      "- Use COMPLETE_QUEST to turn in completed quests for XP rewards.",
    );
    lines.push("");
    lines.push("BANKING:");
    lines.push(
      "- When your inventory is full, go to a bank and deposit items.",
    );
    lines.push(
      "- Keep essential tools (axe, pickaxe, tinderbox, net) and bank everything else.",
    );
    lines.push("- Before combat, withdraw food from the bank.");
    lines.push("- Banks are found in towns and near the duel arena.");
    lines.push(
      "- Use BANK_DEPOSIT_ALL to dump inventory and keep only essential tools.",
    );
    lines.push("");
    lines.push("GENERAL LOGIC:");
    lines.push("- Have a goal and work toward it. Don't wander aimlessly.");
    lines.push(
      "- If you need to be somewhere specific, NAVIGATE_TO that location first.",
    );
    lines.push(
      "- If the resources/mobs for your goal aren't nearby, travel to where they are.",
    );
    lines.push(
      "- Only use IDLE if you're genuinely waiting for something (like health regen).",
    );
    lines.push("");

    // === CURRENT STATUS ===
    lines.push("=== YOUR CURRENT STATUS ===");
    lines.push(`Health: ${healthPercent}% (${currentHealth}/${maxHealth})`);
    lines.push(`In Combat: ${player?.inCombat ? "Yes" : "No"}`);
    if (skills) {
      const combatSkills = ["attack", "strength", "defense"];
      const skillSummary = combatSkills
        .map((s) => (skills[s] ? `${s}:${skills[s].level}` : null))
        .filter(Boolean)
        .join(", ");
      if (skillSummary) lines.push(`Combat Skills: ${skillSummary}`);
      if (skillsData?.combatLevel)
        lines.push(`Combat Level: ${skillsData.combatLevel}`);
    }
    lines.push("");

    // === INVENTORY/EQUIPMENT ===
    lines.push("=== YOUR EQUIPMENT & INVENTORY ===");
    lines.push(`Weapon Equipped: ${hasWeaponEquipped ? "YES" : "NO"}`);
    if (!hasWeaponEquipped && hasCombatItem) {
      lines.push(
        `>>> You have a COMBAT WEAPON in inventory but NOT equipped! <<<`,
      );
    }
    const inventoryItems = Array.isArray(player?.items) ? player.items : [];
    const inventoryCount = inventoryItems.length;
    const maxInventory = 28;
    lines.push(`Inventory: ${inventoryCount}/${maxInventory} slots`);
    if (inventoryCount >= maxInventory) {
      lines.push(
        `>>> INVENTORY FULL! You MUST bank items before you can gather or loot more. Use BANK_DEPOSIT_ALL. <<<`,
      );
    } else if (inventoryCount >= 25) {
      lines.push(
        `>>> Inventory nearly full (${inventoryCount}/${maxInventory}) - consider banking soon! <<<`,
      );
    }
    // Check bank for tools not in inventory
    const cachedBank = this.service?.getBankItems?.() || [];
    const bankNames = cachedBank.map((b) =>
      (
        (b as { name?: string; itemId?: string }).name ||
        (b as { name?: string; itemId?: string }).itemId ||
        ""
      ).toLowerCase(),
    );
    const axeInBank = !hasAxe && bankNames.some((n) => n.includes("hatchet"));
    const pickInBank =
      !hasPickaxe && bankNames.some((n) => n.includes("pickaxe"));
    const netInBank =
      !hasNet &&
      bankNames.some((n) => n.includes("net") || n.includes("fishing"));
    const tinderInBank =
      !hasTinderbox && bankNames.some((n) => n.includes("tinderbox"));
    const weaponInBank = bankNames.some(
      (n) =>
        n.includes("shortsword") ||
        n.includes("longsword") ||
        n.includes("scimitar") ||
        n.includes("dagger"),
    );

    if (bankNames.length > 0) {
      lines.push(`Bank: ${bankNames.length} item types cached`);
    }

    lines.push(
      `Has Axe/Hatchet: ${hasAxe ? "Yes" : axeInBank ? "IN BANK — use BANK_DEPOSIT_ALL to withdraw tools" : "No"}`,
    );
    lines.push(
      `Has Pickaxe: ${hasPickaxe ? "Yes" : pickInBank ? "IN BANK — use BANK_DEPOSIT_ALL to withdraw tools" : "No"}`,
    );
    lines.push(
      `Has Fishing Equipment: ${hasNet ? "Yes" : netInBank ? "IN BANK — use BANK_DEPOSIT_ALL to withdraw tools" : "No"}`,
    );
    lines.push(
      `Has Tinderbox: ${hasTinderbox ? "Yes" : tinderInBank ? "IN BANK — use BANK_DEPOSIT_ALL to withdraw tools" : "No"}`,
    );
    if (!hasWeaponEquipped && !hasCombatItem && weaponInBank) {
      lines.push(
        `Has Weapon: IN BANK — use BANK_DEPOSIT_ALL to withdraw tools`,
      );
    }
    lines.push(`Has Food: ${hasFood ? "Yes" : "No"}`);
    lines.push(`Has Logs: ${hasLogs ? "Yes" : "No"}`);
    if (playerHasOre) lines.push(`Has Ore: Yes (can smelt at furnace)`);
    if (playerHasBars) lines.push(`Has Bars: Yes (can smith at anvil)`);
    lines.push("");

    // === LAST ACTION CONTEXT ===
    if (this.lastActionName) {
      const elapsed = Math.round((Date.now() - this.lastActionTime) / 1000);
      lines.push(
        `LAST ACTION (${elapsed}s ago): ${this.lastActionName} — ${this.lastActionResult || "unknown"}`,
      );
      lines.push("");
    }

    // === GOAL STATUS ===
    lines.push("=== YOUR CURRENT GOAL ===");
    if (goal) {
      lines.push(`Goal: ${goal.description}`);
      lines.push(`Type: ${goal.type}`);
      if (goal.targetSkill && goal.targetSkillLevel && skills) {
        const currentLevel = skills[goal.targetSkill]?.level ?? 1;
        lines.push(
          `Skill Progress: ${goal.targetSkill} level ${currentLevel}/${goal.targetSkillLevel}`,
        );
        if (currentLevel >= goal.targetSkillLevel) {
          lines.push(
            `*** GOAL COMPLETE! You've reached level ${goal.targetSkillLevel}. Set a new goal. ***`,
          );
        }
      } else {
        lines.push(`Progress: ${goal.progress}/${goal.target}`);
        if (goal.progress >= goal.target) {
          lines.push(`*** GOAL COMPLETE! Set a new goal. ***`);
        }
      }
      if (goal.location) lines.push(`Target Location: ${goal.location}`);
      if (goal.targetEntity) lines.push(`Target Entity: ${goal.targetEntity}`);

      // Quest-specific goal info
      if (goal.type === "questing" && goal.questId) {
        lines.push("");
        lines.push(`Quest ID: ${goal.questId}`);
        if (goal.questStageType)
          lines.push(`Current Objective Type: ${goal.questStageType}`);
        if (goal.questStageTarget)
          lines.push(`Objective Target: ${goal.questStageTarget}`);
        if (goal.questStageCount)
          lines.push(`Required Count: ${goal.questStageCount}`);
        if (goal.questStartNpc)
          lines.push(`Quest NPC: ${goal.questStartNpc.replace(/_/g, " ")}`);
      }
    } else if (this.goalPaused) {
      lines.push("Goals are PAUSED by user. Wait for direction or use IDLE.");
    } else {
      lines.push("*** NO GOAL SET ***");
      lines.push("You should SET_GOAL to give yourself direction!");
    }
    lines.push("");

    // === QUEST STATUS ===
    const questState = this.service?.getQuestState?.() || [];
    if (questState.length > 0) {
      const activeQuests = questState.filter(
        (q: { status?: string }) =>
          q.status === "in_progress" || q.status === "ready_to_complete",
      );
      const notStartedQuests = questState.filter(
        (q: { status?: string }) => q.status === "not_started",
      );

      if (activeQuests.length > 0) {
        lines.push("=== ACTIVE QUESTS ===");
        for (const q of activeQuests) {
          const questAny = q as Record<string, unknown>;
          const name =
            (questAny.name as string) ||
            (questAny.questId as string) ||
            "Unknown";
          const status = questAny.status as string;
          lines.push(`- ${name} [${status}]`);
          if (questAny.stageProgress) {
            for (const [key, value] of Object.entries(
              questAny.stageProgress as Record<string, number>,
            )) {
              lines.push(`  Progress: ${key} = ${value}`);
            }
          }
          if (status === "ready_to_complete") {
            lines.push(`  ** READY TO TURN IN! Use COMPLETE_QUEST! **`);
          }
        }
        lines.push("");
      }

      if (notStartedQuests.length > 0 && !goal) {
        lines.push("=== AVAILABLE QUESTS (not started) ===");
        for (const q of notStartedQuests.slice(0, 3)) {
          const questAny = q as Record<string, unknown>;
          const name =
            (questAny.name as string) ||
            (questAny.questId as string) ||
            "Unknown";
          lines.push(`- ${name}: ${(questAny.description as string) || ""}`);
        }
        lines.push("Use ACCEPT_QUEST to start one!");
        lines.push("");
      }
    }

    // === NEARBY ENVIRONMENT ===
    lines.push("=== WHAT'S NEARBY ===");
    if (bankNearby)
      lines.push(`Bank: Yes! (can BANK_DEPOSIT_ALL to free inventory space)`);
    if (treesNearby > 0) lines.push(`Trees: ${treesNearby} (need axe to chop)`);
    if (rocksNearby > 0)
      lines.push(`Rocks/Ore: ${rocksNearby} (need pickaxe to mine)`);
    if (fishingSpotsNearby > 0)
      lines.push(`Fishing Spots: ${fishingSpotsNearby} (need net/rod)`);
    if (furnaceNearby)
      lines.push(`Furnace: Yes! (can SMELT_ORE if you have ore)`);
    if (anvilNearby)
      lines.push(`Anvil: Yes! (can SMITH_ITEM if you have bars)`);
    if (npcsNearby > 0)
      lines.push(
        `NPCs: ${npcsNearby} - ${npcNames.join(", ")} (can TALK_TO_NPC, ACCEPT_QUEST, BUY_ITEM)`,
      );
    if (playersNearby > 0)
      lines.push(
        `Other Players: ${playersNearby} - ${playerNames.join(", ")} (can GREET_PLAYER, SHARE_OPINION, OFFER_HELP)`,
      );
    if (mobsNearby > 0)
      lines.push(`Attackable Mobs: ${mobsNearby} - ${mobNames.join(", ")}`);
    if (
      !bankNearby &&
      treesNearby === 0 &&
      rocksNearby === 0 &&
      fishingSpotsNearby === 0 &&
      mobsNearby === 0 &&
      !furnaceNearby &&
      !anvilNearby &&
      npcsNearby === 0 &&
      playersNearby === 0
    ) {
      lines.push("(Nothing of interest nearby - consider traveling)");
    }
    lines.push("");

    // === KNOWN LOCATIONS ===
    lines.push("=== WORLD LOCATIONS ===");
    const spawnLoc = KNOWN_LOCATIONS.spawn?.position;
    const forestLoc = KNOWN_LOCATIONS.forest?.position;
    const mineLoc = KNOWN_LOCATIONS.mine?.position;
    const fishingLoc = KNOWN_LOCATIONS.fishing?.position;
    lines.push(
      spawnLoc
        ? `spawn: [${spawnLoc[0]}, ${spawnLoc[2]}] - Starting area with goblins for combat`
        : "spawn: dynamic (learned from live world data)",
    );
    lines.push(
      forestLoc
        ? `forest: [${forestLoc[0]}, ${forestLoc[2]}] - Trees for woodcutting`
        : "forest: dynamic (learned from live world data)",
    );
    lines.push(
      mineLoc
        ? `mine: [${mineLoc[0]}, ${mineLoc[2]}] - Rocks for mining`
        : "mine: dynamic (learned from live world data)",
    );
    lines.push(
      fishingLoc
        ? `fishing: [${fishingLoc[0]}, ${fishingLoc[2]}] - Fishing spots`
        : "fishing: dynamic (learned from live world data)",
    );
    lines.push("");

    // === SURVIVAL WARNINGS ===
    if (survivalFacts.length > 0 || combatFacts.length > 0) {
      lines.push("=== WARNINGS ===");
      survivalFacts.forEach((f) => lines.push(`! ${f}`));
      combatFacts.forEach((f) => lines.push(`! ${f}`));
      lines.push("");
    }

    // === AVAILABLE ACTIONS ===
    lines.push("=== AVAILABLE ACTIONS ===");
    for (const action of actions) {
      lines.push(`${action.name}: ${action.description}`);
    }
    lines.push("");
    lines.push("=== DECISION PRIORITY ===");
    lines.push("1. If urgency is CRITICAL or health < 30% with threats: FLEE");
    lines.push("2. If NO GOAL: SET_GOAL (you must have purpose!)");
    lines.push("3. If goal requires travel: NAVIGATE_TO the goal location");
    lines.push("4. If combat_training goal with mobs nearby: ATTACK_ENTITY");
    lines.push("5. If woodcutting goal with trees nearby: CHOP_TREE");
    lines.push("6. If fishing goal with spots nearby: CATCH_FISH");
    lines.push("7. If mining goal with rocks nearby: MINE_ROCK");
    lines.push("8. If have ore and furnace nearby: SMELT_ORE");
    lines.push("9. If have bars and anvil nearby: SMITH_ITEM");
    lines.push("10. If NPC quest giver nearby: TALK_TO_NPC or ACCEPT_QUEST");
    lines.push(
      "11. If players nearby and feeling social: GREET_PLAYER or SHARE_OPINION",
    );
    lines.push("12. If someone seems to need help: OFFER_HELP");
    lines.push("13. If waiting for respawn/recovery: IDLE briefly");
    lines.push("14. If goal is exploration or no targets: EXPLORE");

    // Compute priority action directly based on goal and nearby entities
    let priorityAction: string | null = null;
    const nearbyEntitiesForPriority = this.service?.getNearbyEntities() || [];

    if (!goal) {
      // If goals are paused (user clicked stop), don't auto-set a new goal
      if (this.goalPaused) {
        priorityAction = "IDLE";
        lines.push("  ** GOALS PAUSED ** - Waiting for user to set a new goal");
      } else {
        priorityAction = "SET_GOAL";
      }
    } else if (goal.type === "combat_training") {
      // Check for nearby mobs - flexible detection
      const mobs = nearbyEntitiesForPriority.filter((entity) => {
        const isMob =
          !!entity.mobType ||
          entity.type === "mob" ||
          entity.entityType === "mob" ||
          (entity.name &&
            /goblin|bandit|skeleton|zombie|rat|spider|wolf/i.test(entity.name));
        return isMob && entity.alive !== false;
      });
      if (mobs.length > 0) {
        priorityAction = "ATTACK_ENTITY";
        lines.push(`  ** ${mobs.length} attackable mob(s) nearby! **`);
      } else {
        const playerPos = this.service?.getPlayerEntity()?.position;
        const playerXZ = this.getPositionXZ(playerPos);
        const spawnPos = KNOWN_LOCATIONS.spawn?.position;
        if (!playerXZ) {
          priorityAction = "EXPLORE";
          lines.push(
            "  Player position unavailable - explore to refresh navigation context.",
          );
        } else if (spawnPos) {
          const distToSpawn = Math.sqrt(
            Math.pow(playerXZ.x - spawnPos[0], 2) +
              Math.pow(playerXZ.z - spawnPos[2], 2),
          );

          if (distToSpawn > 15) {
            priorityAction = "NAVIGATE_TO";
            lines.push(
              `  No mobs nearby - navigate to spawn (${Math.round(distToSpawn)} units away)`,
            );
          } else {
            priorityAction = "EXPLORE";
            lines.push("  Near spawn but no mobs visible - explore nearby");
          }
        } else {
          priorityAction = "EXPLORE";
          lines.push(
            "  No mobs nearby and spawn location not resolved yet - explore to discover combat area.",
          );
        }
      }
    } else if (goal.type === "woodcutting") {
      // Check for trees WITHIN approach range (40m — matches skills.ts validation)
      const APPROACH_RANGE = 40;
      const playerPos = this.service?.getPlayerEntity()?.position;
      const allTrees = nearbyEntitiesForPriority.filter((entity) => {
        if (entity.depleted) return false; // Skip depleted trees
        const name = entity.name?.toLowerCase() || "";
        const resourceType = (entity.resourceType || "").toLowerCase();
        const type = (entity.type || "").toLowerCase();
        // Exclude items
        if (name.startsWith("item:")) return false;
        return (
          resourceType === "tree" ||
          type === "tree" ||
          (entity.name && /tree/i.test(entity.name) && !name.includes("item"))
        );
      });

      // Filter by distance - trees within approach range
      const approachableTrees = allTrees.filter((entity) => {
        if (!playerPos) return false;
        const dist = this.getDistance2D(playerPos, entity.position);
        if (dist === null) return false;
        return dist <= APPROACH_RANGE;
      });

      if (approachableTrees.length > 0) {
        priorityAction = "CHOP_TREE";
        lines.push(
          `  ** ${approachableTrees.length} tree(s) within approach range! Use CHOP_TREE to walk to and chop them! **`,
        );
      } else if (allTrees.length > 0) {
        // Trees exist but not in approach range - need to navigate to forest
        priorityAction = "NAVIGATE_TO";
        lines.push(
          `  Trees in world but too far (${allTrees.length} total). Navigate to forest.`,
        );
      } else {
        const forestPos = KNOWN_LOCATIONS.forest?.position;
        const playerXZ = this.getPositionXZ(playerPos);
        if (!playerXZ) {
          priorityAction = "EXPLORE";
          lines.push(
            "  Player position unavailable - explore to refresh navigation context.",
          );
        } else if (forestPos) {
          const distToForest = Math.sqrt(
            Math.pow(playerXZ.x - forestPos[0], 2) +
              Math.pow(playerXZ.z - forestPos[2], 2),
          );

          if (distToForest > 15) {
            priorityAction = "NAVIGATE_TO";
            lines.push(
              `  No trees nearby - navigate to forest (${Math.round(distToForest)} units away)`,
            );
          } else {
            priorityAction = "EXPLORE";
            lines.push("  At forest but no trees visible - explore nearby");
          }
        } else {
          priorityAction = "EXPLORE";
          lines.push(
            "  No trees nearby and forest location not resolved yet - explore to discover tree area.",
          );
        }
      }
    } else if (goal.type === "fishing") {
      const spots = nearbyEntitiesForPriority.filter((entity) => {
        if (entity.depleted) return false; // Skip depleted spots
        const resourceType = (entity.resourceType || "").toLowerCase();
        const name = entity.name?.toLowerCase() || "";
        return resourceType === "fishing_spot" || name.includes("fishing spot");
      });

      if (spots.length > 0) {
        priorityAction = "CATCH_FISH";
        lines.push(`  ** ${spots.length} fishing spot(s) nearby! **`);
      } else if (goal.location) {
        priorityAction = "NAVIGATE_TO";
        lines.push("  No fishing spots nearby - navigate to goal location.");
      } else {
        priorityAction = "EXPLORE";
        lines.push("  No fishing spots visible - explore nearby.");
      }
    } else if (goal.type === "mining") {
      const rocks = nearbyEntitiesForPriority.filter((entity) => {
        if (entity.depleted) return false; // Skip depleted rocks
        const resourceType = (entity.resourceType || "").toLowerCase();
        const name = entity.name?.toLowerCase() || "";
        return (
          resourceType === "mining_rock" ||
          resourceType === "ore" ||
          name.includes("rock") ||
          name.includes("ore")
        );
      });

      if (rocks.length > 0) {
        priorityAction = "MINE_ROCK";
        lines.push(`  ** ${rocks.length} rock(s) nearby! **`);
      } else if (goal.location) {
        priorityAction = "NAVIGATE_TO";
        lines.push("  No rocks nearby - navigate to goal location.");
      } else {
        priorityAction = "EXPLORE";
        lines.push("  No rocks visible - explore nearby.");
      }
    } else if (goal.type === "questing") {
      // Quest-driven priority: map quest stage to appropriate action
      const questStageType = goal.questStageType;
      const questStageTarget = goal.questStageTarget || "";

      // Check if quest is ready to complete
      const questReadyToComplete = questState.some(
        (q: { questId?: string; status?: string }) =>
          q.questId === goal.questId && q.status === "ready_to_complete",
      );

      if (questReadyToComplete) {
        // Quest objective done - find the NPC and turn it in
        const questNpcName = (goal.questStartNpc || "").replace(/_/g, " ");
        const npcNearby =
          npcsNearby > 0 &&
          npcNames.some((n) =>
            n.toLowerCase().includes(questNpcName.toLowerCase()),
          );
        if (npcNearby) {
          priorityAction = "COMPLETE_QUEST";
          lines.push(
            `  ** Quest ready to complete! NPC ${questNpcName} is nearby! **`,
          );
        } else {
          priorityAction = "NAVIGATE_TO";
          lines.push(
            `  ** Quest ready - navigate to ${questNpcName} to turn in. **`,
          );
        }
      } else if (questStageType === "kill") {
        if (mobsNearby > 0) {
          priorityAction = "ATTACK_ENTITY";
          lines.push(
            `  ** Kill quest: ${mobsNearby} mob(s) nearby! Target: ${questStageTarget} **`,
          );
        } else {
          priorityAction = "NAVIGATE_TO";
          lines.push(
            `  No ${questStageTarget}s nearby - navigate to find them.`,
          );
        }
      } else if (questStageType === "gather") {
        // Map gather target to appropriate action
        if (
          questStageTarget.includes("log") ||
          questStageTarget.includes("wood")
        ) {
          if (treesNearby > 0) {
            priorityAction = "CHOP_TREE";
            lines.push(`  ** Gather quest: ${treesNearby} trees nearby! **`);
          } else {
            priorityAction = "NAVIGATE_TO";
            lines.push(`  No trees nearby - navigate to forest.`);
          }
        } else if (
          questStageTarget.includes("ore") ||
          questStageTarget.includes("copper") ||
          questStageTarget.includes("tin") ||
          questStageTarget.includes("essence")
        ) {
          if (rocksNearby > 0) {
            priorityAction = "MINE_ROCK";
            lines.push(`  ** Gather quest: ${rocksNearby} rocks nearby! **`);
          } else {
            priorityAction = "NAVIGATE_TO";
            lines.push(`  No rocks nearby - navigate to mine.`);
          }
        } else if (
          questStageTarget.includes("shrimp") ||
          questStageTarget.includes("fish")
        ) {
          if (fishingSpotsNearby > 0) {
            priorityAction = "CATCH_FISH";
            lines.push(
              `  ** Gather quest: ${fishingSpotsNearby} fishing spots nearby! **`,
            );
          } else {
            priorityAction = "NAVIGATE_TO";
            lines.push(`  No fishing spots nearby - navigate to fishing area.`);
          }
        } else {
          priorityAction = "EXPLORE";
          lines.push(`  Looking for ${questStageTarget}...`);
        }
      } else if (questStageType === "interact") {
        if (questStageTarget.includes("fire")) {
          priorityAction = "LIGHT_FIRE";
          lines.push(
            `  ** Interact quest: light fires! Need tinderbox + logs. **`,
          );
        } else if (
          questStageTarget.includes("shrimp") ||
          questStageTarget.includes("cook")
        ) {
          priorityAction = "COOK_FOOD";
          lines.push(
            `  ** Interact quest: cook food! Need fire + raw food. **`,
          );
        } else if (
          questStageTarget.includes("bar") ||
          questStageTarget.includes("smelt")
        ) {
          if (furnaceNearby) {
            priorityAction = "SMELT_ORE";
            lines.push(`  ** Interact quest: smelt at nearby furnace! **`);
          } else {
            priorityAction = "NAVIGATE_TO";
            lines.push(`  Need furnace - navigate to smelting area.`);
          }
        } else if (
          questStageTarget.includes("sword") ||
          questStageTarget.includes("hatchet") ||
          questStageTarget.includes("pickaxe")
        ) {
          if (anvilNearby) {
            priorityAction = "SMITH_ITEM";
            lines.push(`  ** Interact quest: smith at nearby anvil! **`);
          } else {
            priorityAction = "NAVIGATE_TO";
            lines.push(`  Need anvil - navigate to smithing area.`);
          }
        } else if (questStageTarget.includes("rune")) {
          priorityAction = "RUNECRAFT";
          lines.push(`  ** Interact quest: craft runes at altar! **`);
        } else if (
          questStageTarget.includes("arrow") ||
          questStageTarget.includes("bow") ||
          questStageTarget.includes("shaft")
        ) {
          priorityAction = "FLETCH_ITEM";
          lines.push(`  ** Interact quest: fletch items! **`);
        } else {
          priorityAction = "EXPLORE";
          lines.push(`  Looking for ${questStageTarget} interaction...`);
        }
      } else {
        priorityAction = "EXPLORE";
      }
    } else if (goal.type === "banking") {
      // Banking goal — deposit all, then restore previous goal
      const bankNearby = nearbyEntitiesForPriority.some((entity) => {
        const name = entity.name?.toLowerCase() || "";
        const type = (entity.type || "").toLowerCase();
        return type === "bank" || name.includes("bank");
      });

      if (bankNearby) {
        priorityAction = "BANK_DEPOSIT_ALL";
        lines.push("  ** Bank nearby! Deposit your items! **");
      } else {
        priorityAction = "NAVIGATE_TO";
        lines.push("  Navigate to nearest bank to deposit items.");
      }
    } else if (goal.type === "exploration") {
      priorityAction = "EXPLORE";
    } else if (goal.type === "idle") {
      priorityAction = "IDLE";
    }

    if (priorityAction) {
      lines.push("");
      lines.push(`** RECOMMENDED ACTION: ${priorityAction} **`);
    }

    lines.push("");

    // === DECISION GUIDANCE ===
    lines.push("=== MAKE YOUR DECISION ===");
    lines.push("Think about:");
    lines.push("1. What is your goal? Do you have one?");
    lines.push("2. Do you have the required tools/equipment for your goal?");
    lines.push(
      "3. Are the resources/mobs for your goal nearby, or do you need to travel?",
    );
    lines.push("4. Is your health safe? Should you flee or heal?");
    lines.push("");
    lines.push("Now reason through your decision:");
    lines.push("");
    lines.push("THINKING:");

    return lines.join("\n");
  }

  /**
   * Parse action name from LLM response
   */
  private parseActionFromResponse(
    response: string,
    actions: Action[],
  ): string | null {
    const upperResponse = response.toUpperCase().trim();

    // Look for exact action name matches
    for (const action of actions) {
      if (upperResponse.includes(action.name)) {
        return action.name;
      }
    }

    // Check for similes
    for (const action of actions) {
      if (action.similes) {
        for (const simile of action.similes) {
          if (upperResponse.includes(simile)) {
            return action.name;
          }
        }
      }
    }

    return null;
  }

  /**
   * Execute a selected action
   */
  private async executeAction(
    action: Action,
    message: Memory,
    state: State,
  ): Promise<void> {
    logger.info(`[AutonomousBehavior] Executing action: ${action.name}`);

    try {
      const actionMessage: Memory = this.actionContext?.messageText
        ? {
            ...message,
            content: {
              ...message.content,
              text: this.actionContext.messageText,
            },
          }
        : message;
      this.actionContext = null;

      const result = await action.handler(
        this.runtime,
        actionMessage,
        state,
        undefined,
        async (content) => {
          // Callback when action produces output
          if (this.debug)
            logger.debug(`[AutonomousBehavior] Action output: ${content.text}`);

          // Store in memory for learning - use ElizaOS pattern (no manual id/createdAt)
          try {
            await this.runtime.createMemory(
              {
                entityId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                roomId: this.runtime.agentId, // Use agentId as roomId (standard pattern)
                content: {
                  text: content.text || "Autonomous action taken",
                  action: content.action,
                  source: "autonomous_behavior",
                },
              },
              "messages",
              false, // not unique
            );

            if (this.debug) {
              logger.debug("[AutonomousBehavior] Stored action memory");
            }
          } catch (error) {
            // Memory storage is optional, don't fail the action
            logger.warn(
              "[AutonomousBehavior] Could not store memory:",
              error instanceof Error ? error.message : String(error),
            );
          }

          // Return empty array - the callback return value is not critical
          return [];
        },
      );

      // Track last action for prompt context
      this.lastActionName = action.name;
      this.lastActionTime = Date.now();

      if (result && typeof result === "object" && "success" in result) {
        this.lastActionResult = result.success ? "success" : "failure";

        // Sync action to server dashboard
        try {
          const err = result.error;
          const resultText =
            result.text ||
            (err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "") ||
            "";
          const status = result.success ? "OK" : "FAIL";
          this.service?.syncAgentThought(
            "action",
            `${action.name} [${status}]${resultText ? ` — ${resultText}` : ""}`,
          );
        } catch {
          /* non-critical */
        }

        if (result.success) {
          logger.info(
            `[AutonomousBehavior] Action ${action.name} completed successfully`,
          );

          // Set action lock for movement-based actions
          if (result.data?.moving) {
            this.actionLock = {
              actionName: action.name,
              startedAt: Date.now(),
              timeoutMs: this.ACTION_LOCK_MAX_MS,
              minDurationMs: 0, // Clears when movement stops
            };
            logger.info(
              `[AutonomousBehavior] Action lock set: ${action.name} (moving)`,
            );
          }

          // Gather actions: server needs time for walk-to + gather cycle
          const GATHER_ACTIONS = [
            "CHOP_TREE",
            "MINE_ROCK",
            "CATCH_FISH",
            "COOK_FOOD",
            "LIGHT_FIRE",
          ];
          if (!result.data?.moving && GATHER_ACTIONS.includes(action.name)) {
            this.actionLock = {
              actionName: action.name,
              startedAt: Date.now(),
              timeoutMs: this.ACTION_LOCK_MAX_MS,
              minDurationMs: 5000, // ~1 gather cycle
            };
            logger.info(
              `[AutonomousBehavior] Action lock set: ${action.name} (gather cooldown 5s)`,
            );
          }

          // In-range attack: server needs time for combat cycle
          if (!result.data?.moving && action.name === "ATTACK_ENTITY") {
            this.actionLock = {
              actionName: action.name,
              startedAt: Date.now(),
              timeoutMs: this.ACTION_LOCK_MAX_MS,
              minDurationMs: 3000, // ~1 attack cycle
            };
            logger.info(
              `[AutonomousBehavior] Action lock set: ${action.name} (attack cooldown 3s)`,
            );
          }

          // Smelt/smith: server needs time for crafting
          const CRAFT_ACTIONS = [
            "SMELT_ORE",
            "SMITH_ITEM",
            "FLETCH_ITEM",
            "RUNECRAFT",
          ];
          if (!result.data?.moving && CRAFT_ACTIONS.includes(action.name)) {
            this.actionLock = {
              actionName: action.name,
              startedAt: Date.now(),
              timeoutMs: this.ACTION_LOCK_MAX_MS,
              minDurationMs: 4000, // ~1 craft cycle
            };
            logger.info(
              `[AutonomousBehavior] Action lock set: ${action.name} (craft cooldown 4s)`,
            );
          }

          // Fast-tick only for transition actions — NOT gather/attack/craft
          const FAST_TICK_ACTIONS = new Set([
            "SET_GOAL",
            "NAVIGATE_TO",
            "EQUIP_ITEM",
            "PICKUP_ITEM",
            "BANK_DEPOSIT_ALL",
            "BANK_DEPOSIT",
            "BANK_WITHDRAW",
            "DROP_ITEM",
            "USE_ITEM",
            "ACCEPT_QUEST",
            "COMPLETE_QUEST",
            "TALK_TO_NPC",
            "BUY_ITEM",
            "SELL_ITEM",
          ]);
          if (!result.data?.moving && FAST_TICK_ACTIONS.has(action.name)) {
            this.nextTickFast = true;
          }

          // Banking done — restore previous goal if we saved one
          if (
            action.name === "BANK_DEPOSIT_ALL" &&
            !result.data?.moving &&
            this.savedGoal &&
            this.currentGoal?.type === "banking"
          ) {
            logger.info(
              `[AutonomousBehavior] Banking complete, restoring saved goal: ${this.savedGoal.type}`,
            );
            this.currentGoal = this.savedGoal;
            this.savedGoal = null;
            this.nextTickFast = true;
          }
        } else {
          logger.warn(
            `[AutonomousBehavior] Action ${action.name} failed: ${result.error || "unknown error"}`,
          );
        }
      }
    } catch (error) {
      logger.error(
        `[AutonomousBehavior] Error executing action ${action.name}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Check if the agent can currently act
   */
  private canAct(): boolean {
    if (!this.service) {
      if (this.debug) logger.debug("[AutonomousBehavior] No service");
      return false;
    }

    if (!this.service.isConnected()) {
      if (this.debug) logger.debug("[AutonomousBehavior] Not connected");
      return false;
    }

    const player = this.service.getPlayerEntity();
    if (!player) {
      if (this.debug) logger.debug("[AutonomousBehavior] No player entity");
      return false;
    }

    // Only skip if explicitly dead - undefined means alive
    if (player.alive === false) {
      if (this.debug)
        logger.debug("[AutonomousBehavior] Player is explicitly dead");
      return false;
    }

    // Don't try autonomous actions during an active duel
    if (this.inActiveDuel) {
      if (this.debug)
        logger.debug(
          "[AutonomousBehavior] In active duel, skipping autonomous actions",
        );
      return false;
    }

    return true;
  }

  /**
   * Create an internal message to trigger the decision cycle
   */
  private createTickMessage(): Memory {
    // Build context message that will be seen by action selection
    const messageText = this.buildTickMessageText();

    return {
      id: crypto.randomUUID() as UUID,
      entityId: this.runtime.agentId,
      agentId: this.runtime.agentId,
      roomId: this.runtime.agentId, // Use agentId as roomId (standard ElizaOS pattern)
      content: {
        text: messageText,
        source: "autonomous_tick",
        inReplyTo: undefined,
      },
      createdAt: Date.now(),
    };
  }

  /**
   * Build the message text for the tick
   *
   * This gives the LLM context about what it should be doing
   */
  private buildTickMessageText(): string {
    const player = this.service?.getPlayerEntity();
    if (!player) {
      return "Autonomous decision tick - waiting for player entity";
    }

    // Defensive position check - position might not be loaded yet
    if (
      !player.position ||
      !Array.isArray(player.position) ||
      player.position.length < 3
    ) {
      return "Autonomous decision tick - waiting for player position data";
    }

    // Defensive health calculation
    const currentHealth = player.health?.current ?? 100;
    const maxHealth = player.health?.max ?? 100;
    const healthPercent =
      maxHealth > 0 ? Math.round((currentHealth / maxHealth) * 100) : 100;

    const nearbyEntities = this.service?.getNearbyEntities() || [];
    const nearbyCount = nearbyEntities.length;

    // Safe position formatting
    const posX =
      typeof player.position[0] === "number"
        ? player.position[0].toFixed(1)
        : "?";
    const posZ =
      typeof player.position[2] === "number"
        ? player.position[2].toFixed(1)
        : "?";

    // Build quest progress summary
    const questLines: string[] = [];
    const quests = this.service?.getQuestState?.() || [];
    for (const q of quests) {
      if (q.status !== "in_progress") continue;
      const name = q.name || q.questId || "unknown";
      if (q.stageProgress && typeof q.stageProgress === "object") {
        const entries = Object.entries(q.stageProgress);
        if (entries.length > 0) {
          const progressParts = entries
            .map(([key, val]) => `${key}: ${val}`)
            .join(", ");
          questLines.push(`  - ${name} (${progressParts})`);
        } else {
          questLines.push(`  - ${name}`);
        }
      } else {
        questLines.push(`  - ${name}`);
      }
    }

    // Build a natural language prompt for the decision
    const lines = [
      "AUTONOMOUS BEHAVIOR TICK",
      "",
      "You are an AI agent playing a 3D RPG game autonomously.",
      "Decide what action to take based on your current situation.",
      "",
      `Current Status:`,
      `- Health: ${healthPercent}%`,
      `- Position: [${posX}, ${posZ}]`,
      `- In Combat: ${player.inCombat ? "Yes" : "No"}`,
      `- Nearby Entities: ${nearbyCount}`,
      `- Inventory: ${Array.isArray(player.items) ? player.items.length : 0}/28`,
    ];

    if (this.currentGoal) {
      lines.push(
        `- Current Goal: ${this.currentGoal.type} — ${this.currentGoal.description}`,
      );
    }

    if (questLines.length > 0) {
      lines.push(`- Active Quests:`);
      lines.push(...questLines);
    }

    lines.push(
      "",
      "Available actions: SET_GOAL, NAVIGATE_TO, ATTACK_ENTITY, CHOP_TREE, CATCH_FISH, MINE_ROCK, EXPLORE, FLEE, IDLE, APPROACH_ENTITY, LOOT_GRAVESTONE, PICKUP_ITEM",
      "",
      "GOAL-ORIENTED BEHAVIOR:",
      "1. You MUST have a goal. If no goal, use SET_GOAL first.",
      "2. If goal requires being at a location, use NAVIGATE_TO.",
      "3. At goal location, take appropriate action (ATTACK_ENTITY for combat goals).",
      "",
      "PRIORITY:",
      "- FLEE if health < 30% and danger",
      "- SET_GOAL if no active goal",
      "- NAVIGATE_TO if not at goal location",
      "- ATTACK_ENTITY if combat goal and mob nearby",
      "- EXPLORE if exploration goal",
      "- IDLE only if waiting for something",
      "",
      "What action should you take?",
    );

    return lines.join("\n");
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get statistics about the behavior manager
   */
  getStats(): {
    running: boolean;
    tickCount: number;
    lastTickTime: number;
    tickInterval: number;
    hasGoal: boolean;
    goalType: string | null;
    goalProgress: string | null;
  } {
    return {
      running: this.isRunning,
      tickCount: this.tickCount,
      lastTickTime: this.lastTickTime,
      tickInterval: this.tickInterval,
      hasGoal: this.currentGoal !== null,
      goalType: this.currentGoal?.type ?? null,
      goalProgress: this.currentGoal
        ? `${this.currentGoal.progress}/${this.currentGoal.target}`
        : null,
    };
  }

  /**
   * Process a message using the canonical ElizaOS messageService pipeline.
   * Use this for responding to player chat messages.
   * For autonomous game behavior, the tick() method is preferred.
   */
  async processMessageCanonically(
    messageText: string,
    source: string = "hyperscape_chat",
  ): Promise<{ responded: boolean; responseText?: string }> {
    if (!this.runtime.messageService) {
      logger.warn(
        "[AutonomousBehavior] messageService not available, falling back to manual processing",
      );
      return { responded: false };
    }

    const message: Memory = {
      id: crypto.randomUUID() as UUID,
      entityId: this.runtime.agentId,
      agentId: this.runtime.agentId,
      roomId: this.runtime.agentId,
      content: {
        text: messageText,
        source,
      },
      createdAt: Date.now(),
    };

    let responseText = "";

    try {
      const result = await this.runtime.messageService.handleMessage(
        this.runtime,
        message,
        async (content) => {
          if (content.text) {
            responseText = content.text;
            logger.info(
              `[AutonomousBehavior] Canonical response: ${content.text}`,
            );
          }
          return [];
        },
      );

      return {
        responded: result.didRespond ?? responseText.length > 0,
        responseText: responseText || undefined,
      };
    } catch (error) {
      logger.error(
        "[AutonomousBehavior] Error in canonical message processing:",
        error instanceof Error ? error.message : String(error),
      );
      return { responded: false };
    }
  }

  /**
   * Get the current goal
   */
  getGoal(): CurrentGoal | null {
    return this.currentGoal;
  }

  /**
   * Set a new goal
   */
  setGoal(goal: CurrentGoal): void {
    // Save previous goal to history before setting new one
    if (this.currentGoal) {
      this.addToGoalHistory(this.currentGoal);
    }

    this.currentGoal = goal;
    // Only clear paused state for autonomous goals (not locked/user commands)
    // If it's a locked goal (user command while paused), keep paused state
    // so agent returns to idle after command completes
    if (!goal.locked) {
      this.goalPaused = false;
    }
    logger.info(
      `[AutonomousBehavior] Goal set: ${goal.description} (target: ${goal.target})${goal.locked ? " [locked]" : ""}`,
    );
    // Sync to server for dashboard display
    this.service?.syncGoalToServer();
  }

  /**
   * Clear the current goal
   */
  clearGoal(): void {
    // Save completed goal to history
    if (this.currentGoal) {
      this.addToGoalHistory(this.currentGoal);
    }
    this.currentGoal = null;
    logger.info("[AutonomousBehavior] Goal cleared");

    // Goal chaining: try the planner immediately for the next goal
    const player = this.service?.getPlayerEntity();
    if (player && !this.goalPaused) {
      const chained = this.tryPlannerGoal(player);
      if (chained) {
        logger.info(
          "[AutonomousBehavior] Goal chained via planner → fast tick",
        );
        this.nextTickFast = true;
      }
    }

    // Sync to server for dashboard display
    this.service?.syncGoalToServer();
  }

  /**
   * Add a goal to history (for diversity tracking)
   */
  private addToGoalHistory(goal: CurrentGoal): void {
    // Clean up old entries first
    const now = Date.now();
    this.goalHistory = this.goalHistory.filter(
      (entry) => now - entry.completedAt < this.GOAL_HISTORY_RETENTION,
    );

    // Add new entry
    this.goalHistory.push({ goal, completedAt: now });

    // Trim to max size
    if (this.goalHistory.length > this.MAX_GOAL_HISTORY) {
      this.goalHistory = this.goalHistory.slice(-this.MAX_GOAL_HISTORY);
    }

    logger.debug(
      `[AutonomousBehavior] Goal added to history: ${goal.type} (${this.goalHistory.length} in history)`,
    );
  }

  /**
   * Get recent goal history for diversity scoring
   * Returns goals completed in the last GOAL_HISTORY_RETENTION ms
   */
  getGoalHistory(): Array<{
    type: string;
    skill?: string;
    completedAt: number;
  }> {
    const now = Date.now();
    return this.goalHistory
      .filter((entry) => now - entry.completedAt < this.GOAL_HISTORY_RETENTION)
      .map((entry) => ({
        type: entry.goal.type,
        skill: entry.goal.targetSkill,
        completedAt: entry.completedAt,
      }));
  }

  /**
   * Get count of recent goals by type (for diversity scoring)
   */
  getRecentGoalCounts(): Record<string, number> {
    const history = this.getGoalHistory();
    const counts: Record<string, number> = {};
    for (const entry of history) {
      const key = entry.skill || entry.type;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  /**
   * Pause goal selection (user explicitly stopped the goal via dashboard)
   * This prevents the agent from auto-setting a new goal until resumed
   */
  pauseGoals(): void {
    this.currentGoal = null;
    this.goalPaused = true;
    logger.info("[AutonomousBehavior] Goals paused by user");
    // Sync to server for dashboard display
    this.service?.syncGoalToServer();
  }

  /**
   * Resume goal selection (called when user sets a new goal or sends a command)
   */
  resumeGoals(): void {
    this.goalPaused = false;
    logger.info("[AutonomousBehavior] Goals resumed");
  }

  /**
   * Check if goals are paused
   */
  isGoalsPaused(): boolean {
    return this.goalPaused;
  }

  /**
   * Update goal progress (for non-skill goals like exploration)
   * For skill-based goals, use setSkillProgress() instead
   */
  updateGoalProgress(increment: number = 1): void {
    if (!this.currentGoal) return;

    // For skill-based goals, DON'T update progress via kills
    // Progress is tracked by skill level, not kill count
    if (this.currentGoal.targetSkill && this.currentGoal.targetSkillLevel) {
      logger.debug(
        `[AutonomousBehavior] Skill-based goal - progress tracked via skill level, not kill count`,
      );
      return;
    }

    this.currentGoal.progress += increment;
    logger.info(
      `[AutonomousBehavior] Goal progress: ${this.currentGoal.progress}/${this.currentGoal.target}`,
    );

    // Check if goal is complete (for non-skill goals like exploration)
    if (this.currentGoal.progress >= this.currentGoal.target) {
      logger.info(
        `[AutonomousBehavior] Goal COMPLETE: ${this.currentGoal.description}`,
      );
      this.currentGoal = null; // Clear so agent picks new goal
    }

    // Sync to server for dashboard display
    this.service?.syncGoalToServer();
  }

  /**
   * Update skill-based goal progress (called when skill level changes)
   */
  setSkillProgress(newLevel: number): void {
    if (!this.currentGoal) return;
    if (!this.currentGoal.targetSkill || !this.currentGoal.targetSkillLevel)
      return;

    this.currentGoal.progress = newLevel;
    logger.info(
      `[AutonomousBehavior] Skill goal progress: ${this.currentGoal.progress}/${this.currentGoal.target} (${this.currentGoal.targetSkill})`,
    );

    // Sync to server for dashboard display
    this.service?.syncGoalToServer();
  }

  /**
   * Check if agent has an active goal
   */
  hasGoal(): boolean {
    return this.currentGoal !== null;
  }

  /**
   * Get duel outcome history for strategy context
   */
  getDuelHistory(): Array<{
    opponentName: string;
    won: boolean;
    myHealth: number;
    foodUsed: number;
    timestamp: number;
  }> {
    return this.duelHistory;
  }

  // ============================================================================
  // DUEL AWARENESS - Save/restore goals and track outcomes across duels
  // ============================================================================

  /**
   * Called when a duel fight starts — save current goal and enter duel mode
   */
  private onDuelStart(): void {
    logger.info(
      "[AutonomousBehavior] ⚔️ Duel starting — saving goal and entering duel mode",
    );
    this.inActiveDuel = true;

    // Save current goal for restoration after duel
    if (this.currentGoal) {
      this.savedGoal = { ...this.currentGoal };
      logger.info(
        `[AutonomousBehavior] Saved goal: ${this.currentGoal.type} - ${this.currentGoal.description}`,
      );
    }
  }

  /**
   * Called when a duel completes — restore goal and record outcome
   */
  private onDuelCompleted(data: unknown): void {
    const duelData = data as {
      winnerId?: string;
      loserId?: string;
      winnerName?: string;
      loserName?: string;
      duelId?: string;
    };

    const myId = this.runtime.agentId;
    const won = duelData.winnerId === myId;
    const opponentName = won
      ? duelData.loserName || "Unknown"
      : duelData.winnerName || "Unknown";

    logger.info(
      `[AutonomousBehavior] ⚔️ Duel completed — ${won ? "WON" : "LOST"} against ${opponentName}`,
    );

    // Record duel outcome
    const player = this.service?.getPlayerEntity();
    this.duelHistory.push({
      opponentName,
      won,
      myHealth: player?.health?.current ?? 0,
      foodUsed: 0, // TODO: track food consumption during duel
      timestamp: Date.now(),
    });
    if (this.duelHistory.length > this.MAX_DUEL_HISTORY) {
      this.duelHistory.shift();
    }

    // Exit duel mode
    this.inActiveDuel = false;

    // Restore saved goal
    if (this.savedGoal) {
      this.currentGoal = this.savedGoal;
      this.savedGoal = null;
      logger.info(
        `[AutonomousBehavior] Restored goal: ${this.currentGoal.type} - ${this.currentGoal.description}`,
      );
    } else {
      logger.info(
        "[AutonomousBehavior] No saved goal to restore — agent will pick a new one",
      );
    }
  }

  // ============================================================================
  // TARGET LOCKING - Prevents switching targets mid-combat
  // ============================================================================

  /**
   * Lock onto a combat target
   * Agent will prioritize this target until it's dead, gone, or timeout
   */
  lockTarget(targetId: string): void {
    this.lockedTargetId = targetId;
    this.lockedTargetStartTime = Date.now();
    logger.info(`[AutonomousBehavior] 🎯 Target locked: ${targetId}`);
  }

  /**
   * Clear the current target lock
   * Called when target dies, despawns, or lock expires
   */
  clearTargetLock(): void {
    if (this.lockedTargetId) {
      logger.info(
        `[AutonomousBehavior] 🎯 Target lock cleared: ${this.lockedTargetId}`,
      );
    }
    this.lockedTargetId = null;
    this.lockedTargetStartTime = 0;
  }

  /**
   * Get the currently locked target ID
   * Returns null if no lock, lock expired, or target is no longer valid
   */
  getLockedTarget(): string | null {
    if (!this.lockedTargetId) return null;

    // Check for timeout
    const lockAge = Date.now() - this.lockedTargetStartTime;
    if (lockAge > this.TARGET_LOCK_TIMEOUT) {
      logger.info(
        `[AutonomousBehavior] 🎯 Target lock expired after ${Math.round(lockAge / 1000)}s`,
      );
      this.clearTargetLock();
      return null;
    }

    // Validate target still exists and is alive
    const nearbyEntities = this.service?.getNearbyEntities() || [];
    const target = nearbyEntities.find((e) => e.id === this.lockedTargetId);

    if (!target) {
      logger.info(
        `[AutonomousBehavior] 🎯 Locked target ${this.lockedTargetId} no longer nearby`,
      );
      this.clearTargetLock();
      return null;
    }

    if (target.alive === false || target.dead === true) {
      logger.info(
        `[AutonomousBehavior] 🎯 Locked target ${this.lockedTargetId} is dead`,
      );
      this.clearTargetLock();
      return null;
    }

    return this.lockedTargetId;
  }

  /**
   * Check if we have a valid locked target
   */
  hasLockedTarget(): boolean {
    return this.getLockedTarget() !== null;
  }

  // ============================================================================
  // SPONTANEOUS SOCIAL BEHAVIOR
  // ============================================================================

  /**
   * Check if the agent should do something social this tick.
   * Based on personality traits and time since last social interaction.
   */
  private checkSpontaneousSocialBehavior(): boolean {
    const traits = getPersonalityTraits(this.runtime);
    const timeSince = getTimeSinceLastSocial();

    // Base chance: personality-driven (5-15% per tick)
    const baseChance = 0.05 + traits.sociability * 0.1;

    // Increase chance if it's been a while since social activity
    let timeBonus = 0;
    if (timeSince > 120000) timeBonus = 0.1; // 2+ min without social
    if (timeSince > 300000) timeBonus = 0.2; // 5+ min without social

    // Only trigger if players are nearby
    const nearbyEntities = this.service?.getNearbyEntities() || [];
    const hasNearbyPlayers = nearbyEntities.some(
      (e) =>
        (!!e.playerId || e.entityType === "player") &&
        e.id !== this.service?.getPlayerEntity()?.id,
    );

    if (!hasNearbyPlayers) return false;

    const totalChance = baseChance + timeBonus;
    return Math.random() < totalChance;
  }

  /**
   * Pick a social action based on personality and context.
   */
  private pickSocialAction(): Action | null {
    const traits = getPersonalityTraits(this.runtime);
    const roll = Math.random();

    if (traits.helpfulness > 0.6 && roll < 0.3) {
      return offerHelpAction;
    }
    if (traits.chattiness > 0.5 && roll < 0.6) {
      return shareOpinionAction;
    }
    return greetPlayerAction;
  }
}
