import {
  type Action,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";
import type {
  Component,
  HyperscapeActionDescriptor,
} from "../types/core-types";
import { HyperscapeService } from "../service";
import { World, Entity } from "../types/core-types";

/**
 * CLAUDE.md Compliance: Strong typing for dynamic action results
 */
export interface DynamicActionResult {
  success: boolean;
  pending?: boolean;
  message?: string;
  error?: string;
  data?: Record<string, string | number | boolean | unknown>;
}

export interface DynamicActionResponse {
  text: string;
  success: boolean;
  data: {
    action: string;
    parameters: Record<string, unknown>;
    result: DynamicActionResult;
  };
}

// HyperscapeActionDescriptor is now imported from core-types

/**
 * Manages dynamic discovery and registration of actions from Hyperscape worlds
 */
export class DynamicActionLoader {
  private runtime: IAgentRuntime;
  private registeredActions: Map<string, Action> = new Map();
  private worldActions: Map<string, HyperscapeActionDescriptor> = new Map();

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  /**
   * Discovers available actions from a Hyperscape world
   */
  async discoverActions(world: World): Promise<HyperscapeActionDescriptor[]> {
    logger.info("[DynamicActionLoader] Discovering actions from world...");

    // Check if world exposes actions through a specific protocol
    const worldActions = world.actions as {
      getAvailableActions?: () => Promise<HyperscapeActionDescriptor[]>;
    };
    if (worldActions?.getAvailableActions) {
      const actions = await worldActions.getAvailableActions();
      logger.info(
        `[DynamicActionLoader] Found ${actions.length} actions from world`,
      );
      return actions;
    }

    const actionProviders: HyperscapeActionDescriptor[] = [];
    world.entities.items.forEach((entity: Entity) => {
      if (entity.components) {
        const actionComponent = Array.from(entity.components.values()).find(
          (c: Component) => c.type === "action-provider",
        ) as Component & {
          data?: { actions?: HyperscapeActionDescriptor[] };
        };
        if (actionComponent?.data?.actions) {
          actionProviders.push(...actionComponent.data.actions);
        }
      }
    });

    logger.info(
      `[DynamicActionLoader] Found ${actionProviders.length} actions from entity scan`,
    );
    return actionProviders;
  }

  /**
   * Registers a discovered action with the runtime
   */
  async registerAction(
    descriptor: HyperscapeActionDescriptor,
    runtime: IAgentRuntime,
  ): Promise<void> {
    logger.info(`[DynamicActionLoader] Registering action: ${descriptor.name}`);

    // Create Action object from descriptor
    const action: Action = {
      name: descriptor.name,
      description: descriptor.description,
      similes: this.generateSimiles(descriptor),

      validate: async (runtime: IAgentRuntime): Promise<boolean> => {
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        return !!service && service.isConnected() && !!service.getWorld();
      },

      handler: this.createDynamicHandler(descriptor),

      examples: this.generateExamples(descriptor) as ActionExample[][],
    };

    // Store the action
    this.registeredActions.set(descriptor.name, action);
    this.worldActions.set(descriptor.name, descriptor);

    // Register with runtime
    await runtime.registerAction(action);
    logger.info(
      `[DynamicActionLoader] Successfully registered action: ${descriptor.name}`,
    );
  }

  /**
   * Unregisters an action from the runtime
   */
  async unregisterAction(
    actionName: string,
    runtime: IAgentRuntime,
  ): Promise<void> {
    logger.info(`[DynamicActionLoader] Unregistering action: ${actionName}`);

    this.registeredActions.delete(actionName);
    this.worldActions.delete(actionName);

    const index = runtime.actions.findIndex(
      (a: Action) => a.name === actionName,
    );
    if (index !== -1) {
      runtime.actions.splice(index, 1);
    }
  }

  /**
   * Creates a dynamic handler for a discovered action
   */
  private createDynamicHandler(descriptor: HyperscapeActionDescriptor) {
    return async (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
      _options?: {},
      callback?: HandlerCallback,
    ): Promise<DynamicActionResponse> => {
      logger.info(`[DynamicAction] Executing ${descriptor.name}`);

      const service = runtime.getService<HyperscapeService>(
        HyperscapeService.serviceName,
      )!;
      const world = service.getWorld()!;

      // Extract parameters from message or state
      const params = await this.extractParameters(
        descriptor,
        message,
        state,
        runtime,
      );

      // Execute the action through world interface
      let result: DynamicActionResult;
      const worldActions = world.actions as {
        execute?: (
          name: string,
          params: Record<string, unknown>,
        ) => Promise<DynamicActionResult>;
      };
      if (worldActions?.execute) {
        result = await worldActions.execute(descriptor.name, params);
      } else {
        world.network.send("executeAction", {
          action: descriptor.name,
          parameters: params,
        });
        result = { success: true, pending: true };
      }

      // Generate response based on result
      const responseText = await this.generateResponse(
        descriptor,
        params,
        result,
        runtime,
        state,
      );

      if (callback) {
        await callback({
          text: responseText,
          metadata: { action: descriptor.name, result },
        });
      }

      return {
        text: responseText,
        success: true,
        data: { action: descriptor.name, parameters: params, result },
      };
    };
  }

  /**
   * Extracts parameters for an action from the message and state
   */
  private async extractParameters(
    descriptor: HyperscapeActionDescriptor,
    message: Memory,
    state: State | undefined,
    runtime: IAgentRuntime,
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};

    // Simple extraction from message text
    const messageText = message.content?.text || "";

    for (const param of descriptor.parameters) {
      if (param.type === "string") {
        // Extract quoted strings or specific patterns
        const regex = new RegExp(`${param.name}[:\\s]+["']?([^"']+)["']?`, "i");
        const match = messageText.match(regex);
        if (match) {
          params[param.name] = match[1];
        }
      } else if (param.type === "number") {
        // Extract numbers
        const regex = new RegExp(`${param.name}[:\\s]+(\\d+)`, "i");
        const match = messageText.match(regex);
        if (match) {
          params[param.name] = parseInt(match[1]);
        }
      }

      // Use default if not found and required
      if (params[param.name] === undefined && param.default !== undefined) {
        params[param.name] = param.default;
      }
    }

    return params;
  }

  /**
   * Generates response text for an executed action
   */
  private async generateResponse(
    descriptor: HyperscapeActionDescriptor,
    params: Record<string, unknown>,
    result: DynamicActionResult,
    runtime: IAgentRuntime,
    state?: State,
  ): Promise<string> {
    // Simple response generation
    if (result.success) {
      return `Successfully executed ${descriptor.name}${result.message ? ": " + result.message : ""}`;
    } else {
      return `Failed to execute ${descriptor.name}: ${result.error || "Unknown error"}`;
    }
  }

  /**
   * Generates similes for an action based on its descriptor
   */
  private generateSimiles(descriptor: HyperscapeActionDescriptor): string[] {
    const similes: string[] = [];

    // Generate based on category
    switch (descriptor.category) {
      case "combat":
        similes.push("FIGHT", "ATTACK", "BATTLE");
        break;
      case "inventory":
        similes.push("MANAGE_ITEMS", "INVENTORY");
        break;
      case "skills":
        similes.push("TRAIN", "PRACTICE", "SKILL");
        break;
      case "quest":
        similes.push("QUEST", "MISSION", "TASK");
        break;
      case "social":
        similes.push("INTERACT", "COMMUNICATE");
        break;
      case "movement":
        similes.push("MOVE", "NAVIGATE", "GO");
        break;
    }

    // Add name variations
    const words = descriptor.name.split("_");
    if (words.length > 1) {
      similes.push(words.join(" "));
      similes.push(
        words
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(""),
      );
    }

    return similes;
  }

  /**
   * Generates examples for an action from its descriptor
   */
  private generateExamples(
    descriptor: HyperscapeActionDescriptor,
  ): ActionExample[][] {
    const examples: ActionExample[][] = [];

    // Use provided examples
    for (const exampleText of descriptor.examples || []) {
      examples.push([
        {
          name: "user",
          content: { text: exampleText },
        },
        {
          name: "assistant",
          content: {
            text: `I'll ${descriptor.name.toLowerCase().replace(/_/g, " ")} for you.`,
            action: descriptor.name,
          },
        },
      ]);
    }

    // Generate category-specific examples if none provided
    if (examples.length === 0) {
      switch (descriptor.category) {
        case "combat":
          examples.push([
            {
              name: "user",
              content: { text: `Attack the goblin` },
            },
            {
              name: "assistant",
              content: {
                text: `Engaging in combat!`,
                action: descriptor.name,
              },
            },
          ]);
          break;
        // Add more category-specific examples as needed
      }
    }

    return examples;
  }

  /**
   * Gets all registered actions
   */
  getRegisteredActions(): Map<string, Action> {
    return new Map(this.registeredActions);
  }

  /**
   * Gets world action descriptors
   */
  getWorldActions(): Map<string, HyperscapeActionDescriptor> {
    return new Map(this.worldActions);
  }

  /**
   * Clears all registered actions
   */
  clear(): void {
    this.registeredActions.clear();
    this.worldActions.clear();
  }
}
