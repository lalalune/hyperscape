/**
 * Movement actions - MOVE_TO, FOLLOW_ENTITY, STOP_MOVEMENT
 *
 * These actions control player movement in the game world
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { MoveToCommand } from "../types.js";

/**
 * MOVE_TO - Move to a specific location in the world
 */
export const moveToAction: Action = {
  name: "MOVE_TO",
  similes: ["GO_TO", "WALK_TO", "RUN_TO", "TRAVEL_TO"],
  description:
    "Move to a specific location in the world. Specify target coordinates [x, y, z].",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      console.warn("[MOVE_TO] Validation failed: service not found");
      return false;
    }

    if (!service.isConnected()) {
      console.warn("[MOVE_TO] Validation failed: service not connected");
      return false;
    }

    const playerEntity = service.getPlayerEntity();
    if (!playerEntity) {
      console.warn("[MOVE_TO] Validation failed: no player entity");
      return false;
    }

    if (!playerEntity.alive) {
      console.warn(
        `[MOVE_TO] Validation failed: player not alive (alive=${playerEntity.alive})`,
      );
      return false;
    }

    console.info("[MOVE_TO] Validation passed");
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }

      // Parse target coordinates from message content
      const content = message.content.text || "";
      const coordMatch = content.match(
        /\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/,
      );

      if (!coordMatch) {
        await callback?.({
          text: "Could not parse target coordinates. Please specify coordinates like [x, y, z].",
          error: true,
        });
        return {
          success: false,
          error: new Error(
            "return { success: false, error: 'Invalid coordinates' };",
          ),
        };
      }

      const target: [number, number, number] = [
        parseFloat(coordMatch[1]),
        parseFloat(coordMatch[2]),
        parseFloat(coordMatch[3]),
      ];

      const runMode = content.toLowerCase().includes("run");

      const command: MoveToCommand = { target, runMode };

      await service.executeMove(command);

      await callback?.({
        text: `Moving to [${target.join(", ")}]${runMode ? " (running)" : ""}`,
        action: "MOVE_TO",
      });

      return {
        success: true,
        text: `Started moving to ${target.join(", ")}`,
        values: { target, runMode },
        data: { action: "MOVE_TO", target },
      };
    } catch (error) {
      await callback?.({
        text: `Failed to move: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Move to coordinates [10, 5, 20]" },
      },
      {
        name: "agent",
        content: { text: "Moving to [10, 5, 20]", action: "MOVE_TO" },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Run to [50, 5, 100]" },
      },
      {
        name: "agent",
        content: {
          text: "Moving to [50, 5, 100] (running)",
          action: "MOVE_TO",
        },
      },
    ],
  ],
};

/**
 * FOLLOW_ENTITY - Follow another player or NPC
 */
export const followEntityAction: Action = {
  name: "FOLLOW_ENTITY",
  similes: ["FOLLOW", "FOLLOW_PLAYER", "FOLLOW_NPC"],
  description: "Follow another player or NPC by their entity ID or name.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    if (!service.isConnected()) {
      return false;
    }

    if (!playerEntity || !playerEntity.alive) {
      return false;
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const entities = service.getNearbyEntities();

      const content = message.content.text || "";

      // Find entity by name
      const targetEntity = entities.find(
        (e) => e.name && e.name.toLowerCase().includes(content.toLowerCase()),
      );

      if (!targetEntity) {
        await callback?.({
          text: "Could not find that entity nearby.",
          error: true,
        });
        return {
          success: false,
          error: new Error(
            "return { success: false, error: 'Entity not found' };",
          ),
        };
      }

      const command: MoveToCommand = {
        target: targetEntity.position as [number, number, number],
        runMode: false,
      };

      await service.executeMove(command);

      await callback?.({
        text: `Following ${targetEntity.name}`,
        action: "FOLLOW_ENTITY",
      });

      return {
        success: true,
        text: `Started following ${targetEntity.name}`,
        values: { targetEntity: targetEntity.name },
        data: { action: "FOLLOW_ENTITY", targetEntityId: targetEntity.id },
      };
    } catch (error) {
      await callback?.({
        text: `Failed to follow: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Follow Bob" },
      },
      {
        name: "agent",
        content: { text: "Following Bob", action: "FOLLOW_ENTITY" },
      },
    ],
  ],
};

/**
 * STOP_MOVEMENT - Stop current movement
 */
export const stopMovementAction: Action = {
  name: "STOP_MOVEMENT",
  similes: ["STOP", "HALT", "STAY"],
  description: "Stop current movement and stand still.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    return service.isConnected();
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const playerEntity = service.getPlayerEntity();

      if (!playerEntity) {
        return {
          success: false,
          error: new Error(
            "return { success: false, error: 'Player entity not available' };",
          ),
        };
      }

      // Send move command to current position (stops movement)
      const command: MoveToCommand = {
        target: playerEntity.position,
        runMode: false,
      };

      await service.executeMove(command);

      await callback?.({
        text: "Stopped moving",
        action: "STOP_MOVEMENT",
      });

      return {
        success: true,
        text: "Stopped movement",
        data: { action: "STOP_MOVEMENT" },
      };
    } catch (error) {
      await callback?.({
        text: `Failed to stop: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Stop" },
      },
      {
        name: "agent",
        content: { text: "Stopped moving", action: "STOP_MOVEMENT" },
      },
    ],
  ],
};
