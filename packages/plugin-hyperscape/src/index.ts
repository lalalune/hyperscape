/**
 * @hyperscape/plugin-hyperscape - ElizaOS Plugin for Hyperscape
 *
 * This plugin connects ElizaOS AI agents to Hyperscape multiplayer RPG worlds,
 * enabling agents to play as real players with full access to game mechanics.
 *
 * Architecture:
 * - Service: HyperscapeService manages WebSocket connection and game state
 * - Providers: Supply game context (health, inventory, nearby entities, skills, equipment, actions)
 * - Actions: Execute game commands (movement, combat, skills, inventory, social, banking)
 * - Event Handlers: Store game events as memories for learning
 */

import type { Plugin, IAgentRuntime } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { z } from "zod";

// Service
import { HyperscapeService } from "./services/HyperscapeService.js";

// Providers
import { gameStateProvider } from "./providers/gameState.js";
import { inventoryProvider } from "./providers/inventory.js";
import { nearbyEntitiesProvider } from "./providers/nearbyEntities.js";
import { skillsProvider } from "./providers/skills.js";
import { equipmentProvider } from "./providers/equipment.js";
import { availableActionsProvider } from "./providers/availableActions.js";

// Actions
import {
  moveToAction,
  followEntityAction,
  stopMovementAction,
} from "./actions/movement.js";
import {
  attackEntityAction,
  changeCombatStyleAction,
} from "./actions/combat.js";
import {
  chopTreeAction,
  catchFishAction,
  lightFireAction,
  cookFoodAction,
} from "./actions/skills.js";
import {
  equipItemAction,
  useItemAction,
  dropItemAction,
} from "./actions/inventory.js";
import { chatMessageAction } from "./actions/social.js";
import { bankDepositAction, bankWithdrawAction } from "./actions/banking.js";
import {
  exploreAction,
  fleeAction,
  idleAction,
  approachEntityAction,
} from "./actions/autonomous.js";

// Evaluators
import {
  survivalEvaluator,
  explorationEvaluator,
  socialEvaluator,
  combatEvaluator,
} from "./evaluators/index.js";

// Event handlers
import { registerEventHandlers } from "./events/handlers.js";

// API routes
import { callbackRoute, statusRoute } from "./routes/auth.js";
import { getSettingsRoute } from "./routes/settings.js";
import { getLogsRoute } from "./routes/logs.js";
import { messageRoute } from "./routes/message.js";

// Configuration schema
const configSchema = z.object({
  HYPERSCAPE_SERVER_URL: z
    .string()
    .url()
    .optional()
    .default("ws://localhost:5555/ws")
    .describe("WebSocket URL for Hyperscape server"),
  HYPERSCAPE_AUTO_RECONNECT: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val !== "false")
    .describe("Automatically reconnect on disconnect"),
  HYPERSCAPE_AUTH_TOKEN: z
    .string()
    .optional()
    .describe("Privy auth token for authenticated connections"),
  HYPERSCAPE_PRIVY_USER_ID: z
    .string()
    .optional()
    .describe("Privy user ID for authenticated connections"),
});

/**
 * Hyperscape Plugin for ElizaOS
 *
 * Enables AI agents to play Hyperscape as real players with:
 * - Real-time game state awareness via providers
 * - Full action repertoire (movement, combat, skills, inventory, social)
 * - Event-driven memory storage for learning
 * - Automatic reconnection and error handling
 */
export const hyperscapePlugin: Plugin = {
  name: "@hyperscape/plugin-hyperscape",
  description:
    "Connect ElizaOS AI agents to Hyperscape 3D multiplayer RPG worlds",

  config: {
    HYPERSCAPE_SERVER_URL: process.env.HYPERSCAPE_SERVER_URL,
    HYPERSCAPE_AUTO_RECONNECT: process.env.HYPERSCAPE_AUTO_RECONNECT,
    HYPERSCAPE_AUTH_TOKEN: process.env.HYPERSCAPE_AUTH_TOKEN,
    HYPERSCAPE_PRIVY_USER_ID: process.env.HYPERSCAPE_PRIVY_USER_ID,
  },

  async init(config: Record<string, string>, runtime: IAgentRuntime) {
    logger.info("[HyperscapePlugin] Initializing plugin...");

    try {
      // Validate configuration
      const validatedConfig = await configSchema.parseAsync(config);

      // Set environment variables from validated config
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value !== undefined) {
          process.env[key] = String(value);
        }
      }

      logger.info("[HyperscapePlugin] Configuration validated");
      logger.info(
        `[HyperscapePlugin] Server URL: ${validatedConfig.HYPERSCAPE_SERVER_URL}`,
      );
      logger.info(
        `[HyperscapePlugin] Auto-reconnect: ${validatedConfig.HYPERSCAPE_AUTO_RECONNECT}`,
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages =
          error.issues?.map((e) => e.message)?.join(", ") ||
          "Unknown validation error";
        throw new Error(
          `[HyperscapePlugin] Invalid configuration: ${errorMessages}`,
        );
      }
      throw new Error(
        `[HyperscapePlugin] Configuration error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    logger.info("[HyperscapePlugin] Plugin initialized successfully");
  },

  // Service for managing game connection and state
  services: [HyperscapeService],

  // Providers supply game context to the agent
  providers: [
    gameStateProvider, // Player health, stamina, position, combat status
    inventoryProvider, // Inventory items, coins, free slots
    nearbyEntitiesProvider, // Players, NPCs, resources nearby
    skillsProvider, // Skill levels and XP
    equipmentProvider, // Equipped items
    availableActionsProvider, // Context-aware available actions
  ],

  // Evaluators assess game state for autonomous decision making
  evaluators: [
    survivalEvaluator, // Assess health, threats, survival needs (runs first)
    explorationEvaluator, // Identify exploration opportunities
    socialEvaluator, // Identify social interaction opportunities
    combatEvaluator, // Assess combat opportunities and threats
  ],

  // HTTP API routes for agent management
  routes: [
    callbackRoute,
    statusRoute,
    getSettingsRoute,
    getLogsRoute,
    messageRoute,
  ],

  // Actions the agent can perform in the game
  actions: [
    // Autonomous behavior actions (used by AutonomousBehaviorManager)
    exploreAction, // Move to explore new areas
    fleeAction, // Run away from danger
    idleAction, // Stand still and observe
    approachEntityAction, // Move towards a specific entity

    // Movement
    moveToAction,
    followEntityAction,
    stopMovementAction,

    // Combat
    attackEntityAction,
    changeCombatStyleAction,

    // Skills
    chopTreeAction,
    catchFishAction,
    lightFireAction,
    cookFoodAction,

    // Inventory
    equipItemAction,
    useItemAction,
    dropItemAction,

    // Social
    chatMessageAction,

    // Banking
    bankDepositAction,
    bankWithdrawAction,
  ],

  // Event handlers for storing game events as memories
  events: {
    // Service started - register event handlers
    RUN_STARTED: [
      async (payload) => {
        const runtime = payload.runtime;
        const service =
          runtime.getService<HyperscapeService>("hyperscapeService");

        if (service) {
          // Only register handlers once per service instance
          if (!service.arePluginEventHandlersRegistered()) {
            registerEventHandlers(runtime, service);
            service.markPluginEventHandlersRegistered();
            logger.info(
              "[HyperscapePlugin] Event handlers registered on RUN_STARTED",
            );
          } else {
            logger.debug(
              "[HyperscapePlugin] Event handlers already registered, skipping",
            );
          }
        } else {
          logger.warn(
            "[HyperscapePlugin] HyperscapeService not found, could not register event handlers",
          );
        }
      },
    ],
  },
};

// Default export
export default hyperscapePlugin;

// Export types for external use
export * from "./types.js";
export { HyperscapeService };

// Export content packs
export * from "./content-packs/index.js";
