import {
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  type Content,
  logger,
} from "@elizaos/core";
import { HyperscapeService } from "../service";

export const hyperscapeStopMovingAction: Action = {
  name: "HYPERSCAPE_STOP_MOVING",
  similes: [
    "STOP",
    "HALT",
    "STOP_WALKING",
    "CANCEL_MOVEMENT",
    "STOP_PATROLLING",
  ],
  description:
    "Instantly stops your current walking or pathing; use to pause movement before speaking or performing another action. Essential for action chaining when you need to halt before a new activity.",
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    const controls = service?.getWorld()?.controls;
    // Valid only if connected and controls are available
    // Optional: Could check if getIsNavigating() or getIsPatrolling() is true
    return !!service && service.isConnected() && !!controls;
  },
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: { reason?: string }, // Optional reason for stopping
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    )!;
    const world = service.getWorld()!;
    const controls = world.controls!;

    const reason = options?.reason || "stop action called";

    // Call the stop navigation method
    controls.stopAllActions();

    if (callback) {
      const successResponse = {
        text: "",
        actions: ["HYPERSCAPE_STOP_MOVING"],
        source: "hyperscape",
        metadata: { status: "movement_stopped", reason },
        success: true,
      };
      await callback(successResponse as Content);
    }

    return {
      text: "",
      success: true,
      values: { success: true, status: "movement_stopped", reason },
      data: { action: "HYPERSCAPE_STOP_MOVING", reason },
    };
  },
  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Stop walking.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Stopped current movement.",
          actions: ["HYPERSCAPE_STOP_MOVE"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Stop moving",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "I've stopped all movement.",
          actions: ["HYPERSCAPE_STOP_MOVE"],
        },
      },
    ],
  ] as ActionExample[][],
};
