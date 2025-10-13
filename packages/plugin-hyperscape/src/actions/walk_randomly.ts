import {
  logger,
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  type Content,
} from "@elizaos/core";
import { HyperscapeService } from "../service";

// Constants for default values
const RANDOM_WALK_DEFAULT_INTERVAL = 4000; // ms (4 seconds)
const RANDOM_WALK_DEFAULT_MAX_DISTANCE = 30; // meters

export const hyperscapeWalkRandomlyAction: Action = {
  name: "HYPERSCAPE_WALK_RANDOMLY",
  similes: ["WANDER", "PACE_AROUND", "WALK_AROUND", "MOVE_RANDOMLY"], // Reverted similes/desc
  description:
    "Makes your character wander to random points nearby; use for idle behavior or ambient movement. Can be chained with STOP actions to control wandering patterns in complex scenarios.",
  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    // Keep validation simple: Check if controls exist
    return !!service && service.isConnected() && !!service.getWorld()?.controls;
  },
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: {
      interval?: number;
      distance?: number;
      command?: "start" | "stop";
    }, // Reverted options
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    const world = service?.getWorld();
    const controls = world?.controls;

    if (!service || !world || !controls || !callback) {
      logger.error(
        "Hyperscape service, world, or controls not found for HYPERSCAPE_WALK_RANDOMLY action.",
      );
      if (callback) {
        await callback({
          text: "Error: Cannot wander. Hyperscape connection/controls unavailable.",
          success: false,
        });
      }
      return {
        text: "Error: Cannot wander. Hyperscape connection/controls unavailable.",
        success: false,
        values: { success: false, error: "connection_unavailable" },
        data: { action: "HYPERSCAPE_WALK_RANDOMLY" },
      };
    }

    const command = options?.command || "start";
    // Use provided interval (in seconds) or default (in ms)
    const intervalMs = options?.interval
      ? options.interval * 1000
      : RANDOM_WALK_DEFAULT_INTERVAL;
    const maxDistance = options?.distance || RANDOM_WALK_DEFAULT_MAX_DISTANCE;

    if (command === "stop") {
      if (controls.getIsWalkingRandomly()) {
        controls.stopRandomWalk();
        return {
          text: "Stopped wandering.",
          success: true,
          values: { success: true, command: "stop", wasWandering: true },
          data: { action: "HYPERSCAPE_WALK_RANDOMLY", status: "stopped" },
        };
      } else {
        return {
          text: "Was not wandering.",
          success: true,
          values: { success: true, command: "stop", wasWandering: false },
          data: {
            action: "HYPERSCAPE_WALK_RANDOMLY",
            status: "already_stopped",
          },
        };
      }
    } else {
      // command === 'start'
      controls.startRandomWalk();

      if (callback) {
        const startResponse = {
          text: "",
          actions: ["HYPERSCAPE_WALK_RANDOMLY"],
          source: "hyperscape",
          metadata: { status: "started", intervalMs, maxDistance },
        };
        await callback(startResponse as Content);
      }

      return {
        text: "",
        success: true,
        values: { success: true, command: "start", intervalMs, maxDistance },
        data: {
          action: "HYPERSCAPE_WALK_RANDOMLY",
          status: "started",
          intervalMs,
          maxDistance,
        },
      };
    }
  },
  examples: [
    [
      { name: "{{user}}", content: { text: "Wander around for a bit." } },
      {
        name: "{{agent}}",
        content: {
          thought:
            "User wants me to start wandering around the area - I should begin random movement",
          text: "Starting to wander randomly... (New target every ~5.0s)",
          actions: ["HYPERSCAPE_WALK_RANDOMLY"],
          source: "hyperscape",
        },
      },
    ],
    [
      { name: "{{user}}", content: { text: "Just pace around here." } },
      {
        name: "{{agent}}",
        content: {
          thought:
            "User wants me to pace in this general area - I should start wandering locally",
          text: "Starting to wander randomly... (New target every ~5.0s)",
          actions: ["HYPERSCAPE_WALK_RANDOMLY"],
          source: "hyperscape",
        },
      },
    ],
    [
      { name: "{{user}}", content: { text: "Stop wandering." } },
      {
        name: "{{agent}}",
        content: {
          thought:
            "User wants me to stop my random movement - I should halt the wandering behavior",
          text: "Stopped wandering.",
          actions: ["HYPERSCAPE_WALK_RANDOMLY"],
          source: "hyperscape",
        },
      },
    ],
  ],
};
