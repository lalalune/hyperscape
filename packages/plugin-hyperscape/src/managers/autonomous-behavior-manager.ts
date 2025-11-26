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

// Import autonomous actions directly for execution
import {
  exploreAction,
  fleeAction,
  idleAction,
  approachEntityAction,
} from "../actions/autonomous.js";

// Configuration
const DEFAULT_TICK_INTERVAL = 10000; // 10 seconds between decisions
const MIN_TICK_INTERVAL = 5000; // Minimum 5 seconds
const MAX_TICK_INTERVAL = 30000; // Maximum 30 seconds

/**
 * Generate a UUID v4
 */
function generateUUID(): UUID {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as UUID;
}

export interface AutonomousBehaviorConfig {
  /** Interval between decision ticks in milliseconds */
  tickInterval?: number;
  /** Whether to log detailed debug info */
  debug?: boolean;
  /** Actions to consider for autonomous behavior */
  allowedActions?: string[];
}

export class AutonomousBehaviorManager {
  private isRunning = false;
  private runtime: IAgentRuntime;
  private service: HyperscapeService | null = null;
  private tickInterval: number;
  private debug: boolean;
  private allowedActions: Set<string>;
  private lastTickTime = 0;
  private tickCount = 0;

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

    // Default allowed actions for autonomous behavior
    this.allowedActions = new Set(
      config?.allowedActions ?? [
        "EXPLORE",
        "FLEE",
        "IDLE",
        "APPROACH_ENTITY",
        "MOVE_TO",
        "ATTACK_ENTITY",
        "CHOP_TREE",
        "CATCH_FISH",
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

    logger.info(`[AutonomousBehavior] === Tick ${this.tickCount} ===`);

    // Step 2: Create internal "tick" message
    const tickMessage = this.createTickMessage();

    // Step 3: Compose state (gathers context from all providers)
    logger.info("[AutonomousBehavior] Composing state...");
    const state = await this.runtime.composeState(tickMessage);

    // Step 4: Run evaluators (assess the situation)
    logger.info("[AutonomousBehavior] Running evaluators...");
    const evaluatorResults = await this.runtime.evaluate(
      tickMessage,
      state,
      false, // didRespond
    );

    if (evaluatorResults && evaluatorResults.length > 0) {
      logger.info(
        `[AutonomousBehavior] ${evaluatorResults.length} evaluators ran: ${evaluatorResults.map((e) => e.name).join(", ")}`,
      );
    }

    // Step 5: Select and execute an action using the LLM
    logger.info("[AutonomousBehavior] Selecting action...");

    const selectedAction = await this.selectAction(tickMessage, state);

    if (!selectedAction) {
      logger.info("[AutonomousBehavior] No action selected this tick");
      return;
    }

    logger.info(`[AutonomousBehavior] Selected action: ${selectedAction.name}`);

    // Step 6: Validate the selected action
    const isValid = await selectedAction.validate(
      this.runtime,
      tickMessage,
      state,
    );
    if (!isValid) {
      logger.warn(
        `[AutonomousBehavior] Action ${selectedAction.name} failed validation, falling back to IDLE`,
      );
      // Fall back to IDLE which should always be valid
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

  /**
   * Select an action using the LLM based on current state
   */
  private async selectAction(
    _message: Memory,
    state: State,
  ): Promise<Action | null> {
    // Get available actions for autonomous behavior
    const availableActions = this.getAvailableActions();

    // Build the action selection prompt
    const prompt = this.buildActionSelectionPrompt(state, availableActions);

    try {
      // Use the LLM to select an action
      const response = await this.runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        stopSequences: ["\n\n"],
      });

      const responseText =
        typeof response === "string" ? response : String(response);
      logger.info(`[AutonomousBehavior] LLM response: ${responseText.trim()}`);

      // Parse the selected action from response
      const selectedActionName = this.parseActionFromResponse(
        responseText,
        availableActions,
      );

      if (!selectedActionName) {
        logger.warn(
          "[AutonomousBehavior] Could not parse action from LLM response, defaulting to EXPLORE",
        );
        return exploreAction;
      }

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
      // Default to EXPLORE on error
      return exploreAction;
    }
  }

  /**
   * Get available autonomous actions
   */
  private getAvailableActions(): Action[] {
    return [exploreAction, fleeAction, idleAction, approachEntityAction];
  }

  /**
   * Build prompt for action selection
   */
  private buildActionSelectionPrompt(state: State, actions: Action[]): string {
    // Extract facts from evaluators
    const survivalFacts = (state.survivalFacts as string[]) || [];
    const explorationFacts = (state.explorationFacts as string[]) || [];
    const combatFacts = (state.combatFacts as string[]) || [];
    const survivalRecommendations =
      (state.survivalRecommendations as string[]) || [];

    const lines = [
      "You are an AI agent playing a 3D RPG game. Select ONE action to perform.",
      "",
      "=== CURRENT SITUATION ===",
    ];

    // Add survival facts
    if (survivalFacts.length > 0) {
      lines.push("Survival Status:");
      survivalFacts.forEach((f) => lines.push(`  ${f}`));
    }

    // Add recommendations
    if (survivalRecommendations.length > 0) {
      lines.push("Recommendations:");
      survivalRecommendations.forEach((r) => lines.push(`  ${r}`));
    }

    // Add exploration facts
    if (explorationFacts.length > 0) {
      lines.push("Exploration:");
      explorationFacts.forEach((f) => lines.push(`  ${f}`));
    }

    // Add combat facts
    if (combatFacts.length > 0) {
      lines.push("Combat:");
      combatFacts.forEach((f) => lines.push(`  ${f}`));
    }

    lines.push("");
    lines.push("=== AVAILABLE ACTIONS ===");

    for (const action of actions) {
      lines.push(`${action.name}: ${action.description}`);
    }

    lines.push("");
    lines.push("=== DECISION RULES ===");
    lines.push(
      "- If urgency is CRITICAL or health < 30% with threats: choose FLEE",
    );
    lines.push(
      "- If there are interesting entities nearby: choose APPROACH_ENTITY",
    );
    lines.push("- If safe and healthy: choose EXPLORE to discover new areas");
    lines.push("- If nothing specific to do: choose IDLE");
    lines.push("");
    lines.push(
      "Respond with ONLY the action name (e.g., EXPLORE or FLEE or IDLE):",
    );

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
      const result = await action.handler(
        this.runtime,
        message,
        state,
        undefined,
        async (content) => {
          // Callback when action produces output
          logger.info(`[AutonomousBehavior] Action output: ${content.text}`);

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
                metadata: {
                  type: "autonomous_action",
                  actionName: action.name,
                  timestamp: Date.now(),
                  tags: ["hyperscape", "autonomous", action.name.toLowerCase()],
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
      id: generateUUID(),
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

    // Defensive health calculation
    const currentHealth =
      player.health?.current ??
      (player as unknown as { hp?: number }).hp ??
      100;
    const maxHealth =
      player.health?.max ??
      (player as unknown as { maxHp?: number }).maxHp ??
      100;
    const healthPercent =
      maxHealth > 0 ? Math.round((currentHealth / maxHealth) * 100) : 100;

    const nearbyEntities = this.service?.getNearbyEntities() || [];
    const nearbyCount = nearbyEntities.length;

    // Build a natural language prompt for the decision
    const lines = [
      "AUTONOMOUS BEHAVIOR TICK",
      "",
      "You are an AI agent playing a 3D RPG game autonomously.",
      "Decide what action to take based on your current situation.",
      "",
      `Current Status:`,
      `- Health: ${healthPercent}%`,
      `- Position: [${player.position[0].toFixed(1)}, ${player.position[2].toFixed(1)}]`,
      `- In Combat: ${player.inCombat ? "Yes" : "No"}`,
      `- Nearby Entities: ${nearbyCount}`,
      "",
      "Available autonomous actions: EXPLORE, FLEE, IDLE, APPROACH_ENTITY",
      "",
      "Choose the most appropriate action based on:",
      "- If health is critical (<30%) and enemies nearby: FLEE",
      "- If safe and idle: EXPLORE to discover new areas",
      "- If interesting entity nearby: APPROACH_ENTITY",
      "- If nothing to do or recovering: IDLE",
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
  } {
    return {
      running: this.isRunning,
      tickCount: this.tickCount,
      lastTickTime: this.lastTickTime,
      tickInterval: this.tickInterval,
    };
  }
}
