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
  lootStarterChestAction,
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
import { moveToAction } from "../actions/movement.js";
import { KNOWN_LOCATIONS } from "../providers/goalProvider.js";
import { SCRIPTED_AUTONOMY_CONFIG } from "../config/constants.js";
import {
  hasCombatCapableItem,
  hasWeapon,
  hasOre,
  hasBars,
} from "../utils/item-detection.js";
import { getPersonalityTraits } from "../providers/personalityProvider.js";
import { getTimeSinceLastSocial } from "../providers/socialMemory.js";

// Configuration
const DEFAULT_TICK_INTERVAL = 30000; // 30 seconds between decisions
const MIN_TICK_INTERVAL = 15000; // Minimum 15 seconds
const MAX_TICK_INTERVAL = 60000; // Maximum 60 seconds

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
    | "starter_items"
    | "user_command"
    | "questing";
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
        // Shopping
        "BUY_ITEM",
        "SELL_ITEM",
        // Quest interactions
        "TALK_TO_NPC",
        "ACCEPT_QUEST",
        "COMPLETE_QUEST",
        "CHECK_QUEST",
        // Social
        "GREET_PLAYER",
        "SHARE_OPINION",
        "OFFER_HELP",
        // World interactions
        "LOOT_STARTER_CHEST",
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

    // Subscribe to combat events for chat reactions
    if (!this.combatEventHandlerRegistered) {
      this.service.onGameEvent("COMBAT_DAMAGE_DEALT", (data: unknown) => {
        this.handleCombatDamageEvent(data);
      });
      this.combatEventHandlerRegistered = true;
      logger.info(
        "[AutonomousBehavior] Registered combat chat reaction handler",
      );
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
      } catch (error) {
        logger.error(
          "[AutonomousBehavior] Error in tick:",
          error instanceof Error ? error.message : String(error),
        );
      }

      // Calculate how long to wait until next tick
      const tickDuration = Date.now() - tickStart;
      const sleepTime = Math.max(0, this.tickInterval - tickDuration);

      if (this.debug) {
        logger.debug(
          `[AutonomousBehavior] Tick ${this.tickCount} took ${tickDuration}ms, sleeping ${sleepTime}ms`,
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

      // NOTE: Removed smart fallback logic that forced NAVIGATE_TO or goal actions
      // LLM will try again next tick with updated context
      // This gives more autonomy - let the LLM learn from failed validations

      // Simple fallback to IDLE - wait for next tick
      logger.info("[AutonomousBehavior] Falling back to IDLE");
      const idleValid = await idleAction.validate(
        this.runtime,
        tickMessage,
        state,
      );
      if (idleValid) {
        await this.executeAction(idleAction, tickMessage, state);
      }
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
      // Non-critical - just log and continue
      if (this.debug) {
        logger.debug(
          "[AutonomousBehavior] Could not sync thinking to dashboard:",
          error instanceof Error ? error.message : String(error),
        );
      }
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
      lootStarterChestAction,
      talkToNpcAction,
      acceptQuestAction,
      completeQuestAction,
      checkQuestAction,
      buyItemAction,
      sellItemAction,
      greetPlayerAction,
      shareOpinionAction,
      offerHelpAction,
      exploreAction,
      fleeAction,
      idleAction,
      approachEntityAction,
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
    let starterChestNearby = false;
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

      if (entityType === "starter_chest" || name.includes("starter")) {
        starterChestNearby = true;
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
    lines.push("STARTER EQUIPMENT:");
    lines.push(
      "- New players should look for a STARTER CHEST near spawn to get basic tools.",
    );
    lines.push(
      "- The starter chest gives: bronze hatchet, bronze pickaxe, tinderbox, fishing net, food.",
    );
    lines.push("- You can only loot the starter chest ONCE per character.");
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
    lines.push(`Has Axe/Hatchet: ${hasAxe ? "Yes" : "No"}`);
    lines.push(`Has Pickaxe: ${hasPickaxe ? "Yes" : "No"}`);
    lines.push(`Has Fishing Equipment: ${hasNet ? "Yes" : "No"}`);
    lines.push(`Has Tinderbox: ${hasTinderbox ? "Yes" : "No"}`);
    lines.push(`Has Food: ${hasFood ? "Yes" : "No"}`);
    lines.push(`Has Logs: ${hasLogs ? "Yes" : "No"}`);
    if (playerHasOre) lines.push(`Has Ore: Yes (can smelt at furnace)`);
    if (playerHasBars) lines.push(`Has Bars: Yes (can smith at anvil)`);
    lines.push("");

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
    if (starterChestNearby)
      lines.push(`STARTER CHEST: Yes! (can get starter tools)`);
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
      !starterChestNearby &&
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
      // Check for trees WITHIN approach range (20m - CHOP_TREE will walk to tree)
      const APPROACH_RANGE = 20;
      const playerPos = this.service?.getPlayerEntity()?.position;
      const allTrees = nearbyEntitiesForPriority.filter((entity) => {
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

      if (result && typeof result === "object" && "success" in result) {
        if (result.success) {
          logger.info(
            `[AutonomousBehavior] Action ${action.name} completed successfully`,
          );
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
      "",
      "Available actions: SET_GOAL, NAVIGATE_TO, ATTACK_ENTITY, CHOP_TREE, CATCH_FISH, MINE_ROCK, EXPLORE, FLEE, IDLE, APPROACH_ENTITY",
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
    ];

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
