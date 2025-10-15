import {
  composeContext,
  generateMessageResponse,
  shouldRespond,
} from "../utils/ai-helpers";
import {
  IAgentRuntime,
  Memory,
  State,
  elizaLogger,
  ActionExample,
  HandlerCallback,
  ChannelType,
  UUID,
  Content,
  parseKeyValueXml,
  ModelType,
} from "@elizaos/core";
import type { HyperscapeService } from "../service";
import { World, Entity } from "../types/core-types";
import type { ChatMessage } from "../types/core-types";
import type { ClientInputSystem } from "../types/system-types";
import { isClientInputSystem } from "../types/system-types";

interface BehaviorManagerInterface {
  startAutonomousBehavior(): void;
  stopAutonomousBehavior(): void;
  isActive(): boolean;
}

interface ResponseContent {
  text?: string;
  action?: string;
  coordinates?: string;
  message?: string;
  [key: string]: string | number | boolean | undefined;
}

interface BehaviorResponse {
  content: ResponseContent;
  context: string;
}

export class BehaviorManager {
  private isRunning: boolean = false;
  public runtime: IAgentRuntime;
  private service: HyperscapeService;
  private world: World | null = null;
  private maxIterations: number = -1; // -1 for infinite, set to limit for testing

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.service = this.getService();
    this.world = this.service?.getWorld();
  }

  /**
   * Check if the behavior loop is running
   */
  public get running(): boolean {
    return this.isRunning;
  }

  /**
   * Set maximum iterations for testing purposes
   */
  public setMaxIterations(max: number): void {
    this.maxIterations = max;
  }

  /**
   * Start the autonomous behavior loop
   */
  public start(): void {
    if (this.isRunning) {
      console.warn("[BehaviorManager] Already running, ignoring start request");
      return;
    }

    console.info("[BehaviorManager] Starting autonomous behavior...");
    this.isRunning = true;

    // Start the async loop without blocking
    this.runLoop().catch((error) => {
      console.error("[BehaviorManager] Error in behavior loop:", error);
      this.isRunning = false;
    });
  }

  /**
   * Stop the autonomous behavior loop
   */
  public stop(): void {
    if (!this.isRunning) {
      console.warn("[BehaviorManager] Not running, ignoring stop request");
      return;
    }

    console.info("[BehaviorManager] Stopping autonomous behavior...");
    this.isRunning = false;
  }

  /**
   * Main behavior loop that runs continuously while active
   */
  private async runLoop(): Promise<void> {
    let iterations = 0;

    while (this.isRunning) {
      // Check if we've hit the max iterations limit (for testing)
      if (this.maxIterations > 0 && iterations >= this.maxIterations) {
        console.info(
          `[BehaviorManager] Reached max iterations (${this.maxIterations}), stopping`,
        );
        this.isRunning = false;
        break;
      }

      await this.executeBehavior();
      iterations++;

      // Brief pause between behavior executions
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.info("[BehaviorManager] Behavior loop ended");
  }

  /**
   * Get the Hyperscape service instance
   */
  private getService(): HyperscapeService | null {
    return this.runtime.getService<HyperscapeService>("hyperscape") || null;
  }

  /**
   * Execute a single behavior cycle
   */
  private async executeBehavior(): Promise<void> {
    // Create a behavior context message
    const behaviorMessage: Memory = {
      id: crypto.randomUUID() as UUID,
      agentId: this.runtime.agentId,
      content: {
        text: "Observing current environment and deciding on next action",
        source: "behavior_manager",
      },
      roomId: (this.world!.entities.player!.data.id ||
        crypto.randomUUID()) as UUID,
      createdAt: Date.now(),
      entityId: this.runtime.agentId,
      metadata: {
        type: "behavior",
        userId: this.runtime.agentId,
      },
    };

    // Compose the current state
    const state = await this.runtime.composeState(behaviorMessage, []);

    // Check if we should respond/act
    const shouldAct = await shouldRespond(this.runtime, behaviorMessage, state);

    if (!shouldAct) {
      console.debug(
        "[BehaviorManager] No autonomous action needed at this time",
      );
      return;
    }

    // Generate a behavioral response
    const context = composeContext({
      state,
      template: `
# Autonomous Behavior Instructions

You are an AI agent in a 3D virtual world called Hyperscape. You can move around, chat with other players, and interact with objects.

## Current Situation
Player Position: {{playerPosition}}
Nearby Entities: {{nearbyEntities}}
Recent Chat: {{recentMessages}}

## Available Actions
- Move to different locations using coordinates
- Chat with other players
- Examine objects and entities
- Explore the environment

## Behavior Guidelines
- Be curious and explore the world
- Interact with other players in a friendly manner
- Take reasonable actions based on your surroundings
- Don't repeat the same action too frequently
- Express your thoughts and observations

Choose an appropriate action for the current situation. Respond with your decision in the following format:
<action>move_to_location</action>
<coordinates>x,y,z</coordinates>
<thought>Brief explanation of why you're taking this action</thought>

Or for chat:
<action>send_chat</action>
<message>Your message to send</message>
<thought>Brief explanation of your message</thought>
        `,
    });

    console.debug(
      "[BehaviorManager] Generating autonomous behavior response...",
    );

    const response = await generateMessageResponse({
      runtime: this.runtime as IAgentRuntime,
      context: await context,
      modelType: ModelType.TEXT_LARGE,
    });

    // Parse and execute the behavioral response
    const content: Content = {
      text: response.text,
      ...response.data,
    };
    await this.executeBehaviorAction(content, this.world!);
  }

  /**
   * Execute a behavior action based on the response
   */
  private async executeBehaviorAction(
    response: Content,
    world: World,
  ): Promise<void> {
    // Content always has a text property
    const responseText = response.text || "";

    const parsedResponse = parseKeyValueXml(responseText) as BehaviorResponse;

    const action = parsedResponse.content?.action;
    const thought = parsedResponse.context;

    if (thought) {
      console.info(`[BehaviorManager] Agent thought: ${thought}`);
    }

    switch (action) {
      case "move_to_location":
        await this.handleMoveAction(parsedResponse.content);
        break;

      case "send_chat":
        await this.handleChatAction(parsedResponse.content);
        break;

      default:
        console.debug(
          `[BehaviorManager] Unknown or no action specified: ${action}`,
        );
    }
  }

  /**
   * Handle movement actions
   */
  private async handleMoveAction(content: ResponseContent): Promise<void> {
    const coordinatesText = content.coordinates!;

    const coords = coordinatesText
      .split(",")
      .map((c: string) => parseFloat(c.trim()));

    const [x, y, z] = coords;
    console.info(`[BehaviorManager] Moving to coordinates: ${x}, ${y}, ${z}`);

    const controls = this.world!.systems.find(isClientInputSystem)!;
    await controls.goto(x, z); // Hyperscape typically uses x,z for ground movement
    console.info("[BehaviorManager] Movement command executed");
  }

  /**
   * Handle chat actions
   */
  private async handleChatAction(content: ResponseContent): Promise<void> {
    const message = content.message as string;

    const messageManager = this.service!.getMessageManager()!;
    await messageManager.sendMessage(message);
    console.info(`[BehaviorManager] Sent chat message: ${message}`);
  }

  /**
   * Get nearby entities for context
   */
  private getNearbyEntities(world: World): string {
    const entities = world.entities.items;

    const entityDescriptions: string[] = [];
    entities.forEach((entity, id) => {
      if (entity.data.name && id !== world.entities.player!.data.id) {
        entityDescriptions.push(`${entity.data.name} (${id})`);
      }
    });

    return entityDescriptions.length > 0
      ? entityDescriptions.join(", ")
      : "No named entities nearby";
  }

  /**
   * Get recent chat history for context
   */
  private async getRecentChatHistory(): Promise<string> {
    const messageManager = this.service!.getMessageManager()!;
    const world = this.service!.getWorld()!;
    const roomId = world.entities.player!.data.id;

    const recentMessages = await messageManager.getRecentMessages(
      roomId as UUID,
      5,
    );

    return recentMessages
      .slice(-3) // Get last 3 messages
      .map(
        (msg) =>
          `${(msg.metadata as { username?: string })?.username || "Unknown"}: ${msg.content.text || ""}`,
      )
      .join("\n");
  }

  private createMemoryFromChatHistory(messages: ChatMessage[]): Memory {
    const latestMessage = messages[messages.length - 1];
    return {
      id: crypto.randomUUID() as UUID,
      agentId: this.runtime.agentId,
      content: {
        text: messages.map((m) => `${m.from}: ${m.text}`).join("\n"),
        source: "chat_history",
      },
      roomId: (this.world?.entities?.player?.data?.id ||
        crypto.randomUUID()) as UUID,
      createdAt: latestMessage?.timestamp || Date.now(),
      entityId: this.runtime.agentId,
      metadata: {
        type: "chat_history",
        userId: latestMessage?.from || ("unknown" as UUID),
      },
    };
  }
}
