/**
 * Event handlers - Map Hyperscape game events to ElizaOS Memory storage
 *
 * These handlers listen to game events and store significant events as memories
 * for the agent to learn from and reference later.
 */

import { logger, type IAgentRuntime } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { EventType } from "../types.js";

/**
 * Register all game event handlers with the service
 */
export function registerEventHandlers(
  runtime: IAgentRuntime,
  service: HyperscapeService,
): void {
  // Combat events
  service.onGameEvent("COMBAT_STARTED", async (data: unknown) => {
    const eventData = data as { targetName: string; targetId: string };
    await storeCombatMemory(runtime, "Combat started", eventData, [
      "combat",
      "started",
    ]);
  });

  service.onGameEvent("COMBAT_ENDED", async (data: unknown) => {
    const eventData = data as { outcome: "victory" | "defeat" };
    await storeCombatMemory(
      runtime,
      `Combat ended: ${eventData.outcome}`,
      eventData,
      ["combat", "ended", eventData.outcome],
    );
  });

  service.onGameEvent("COMBAT_KILL", async (data: unknown) => {
    const eventData = data as { targetName: string; xpGained: number };
    await storeCombatMemory(
      runtime,
      `Defeated ${eventData.targetName}`,
      eventData,
      ["combat", "victory", "kill"],
    );
    logger.info(
      `[HyperscapePlugin] Defeated ${eventData.targetName}, gained ${eventData.xpGained} XP`,
    );
  });

  service.onGameEvent("PLAYER_DIED", async (data: unknown) => {
    await storeCombatMemory(runtime, "Player died in combat", data, [
      "combat",
      "death",
    ]);
    logger.warn("[HyperscapePlugin] Player died");
  });

  // Resource gathering events
  service.onGameEvent("RESOURCE_GATHERED", async (data: unknown) => {
    const eventData = data as {
      resourceName: string;
      resourceType: string;
      position: [number, number, number];
      xpGained: number;
    };
    await storeResourceMemory(
      runtime,
      `Gathered ${eventData.resourceName}`,
      eventData,
      ["resource", "gathered", eventData.resourceType],
    );
  });

  service.onGameEvent("RESOURCE_DEPLETED", async (data: unknown) => {
    const eventData = data as {
      resourceName: string;
      position: [number, number, number];
    };
    await storeResourceMemory(
      runtime,
      `${eventData.resourceName} depleted`,
      eventData,
      ["resource", "depleted"],
    );
  });

  service.onGameEvent("RESOURCE_RESPAWNED", async (data: unknown) => {
    const eventData = data as {
      resourceName: string;
      position: [number, number, number];
    };
    await storeResourceMemory(
      runtime,
      `${eventData.resourceName} respawned`,
      eventData,
      ["resource", "respawned"],
    );
    logger.info(
      `[HyperscapePlugin] Resource respawned: ${eventData.resourceName}`,
    );
  });

  // Skill progression events
  service.onGameEvent("SKILLS_LEVEL_UP", async (data: unknown) => {
    const eventData = data as { skillName: string; newLevel: number };
    await storeFactMemory(
      runtime,
      `Leveled up ${eventData.skillName} to level ${eventData.newLevel}`,
      eventData,
      ["skill", "levelup", eventData.skillName],
    );
    logger.info(
      `[HyperscapePlugin] Skill level up: ${eventData.skillName} → ${eventData.newLevel}`,
    );
  });

  service.onGameEvent("SKILLS_XP_GAINED", async (data: unknown) => {
    const eventData = data as {
      skillName: string;
      xpGained: number;
      totalXp: number;
    };
    logger.debug(
      `[HyperscapePlugin] XP gained in ${eventData.skillName}: +${eventData.xpGained}`,
    );
  });

  // Inventory events
  service.onGameEvent("ITEM_PICKED_UP", async (data: unknown) => {
    const eventData = data as { itemName: string; quantity: number };
    logger.debug(
      `[HyperscapePlugin] Picked up: ${eventData.itemName} x${eventData.quantity}`,
    );
  });

  service.onGameEvent("ITEM_DROPPED", async (data: unknown) => {
    const eventData = data as { itemName: string; quantity: number };
    logger.debug(
      `[HyperscapePlugin] Dropped: ${eventData.itemName} x${eventData.quantity}`,
    );
  });

  // Player interaction events
  service.onGameEvent("PLAYER_JOINED", async (data: unknown) => {
    const eventData = data as { playerName: string; playerId: string };
    await storeFactMemory(
      runtime,
      `Player ${eventData.playerName} joined`,
      eventData,
      ["player", "joined"],
    );
    logger.info(`[HyperscapePlugin] Player joined: ${eventData.playerName}`);
  });

  service.onGameEvent("PLAYER_LEFT", async (data: unknown) => {
    const eventData = data as { playerName: string; playerId: string };
    logger.info(`[HyperscapePlugin] Player left: ${eventData.playerName}`);
  });

  // Chat message handling - process through ElizaOS runtime
  service.onGameEvent("CHAT_MESSAGE", async (data: unknown) => {
    const chatData = data as {
      from: string;
      fromId: string;
      text: string;
      timestamp: number;
    };

    // Ignore messages from the agent itself
    const agentCharacterId = service.getGameState()?.playerEntity?.id;
    if (chatData.fromId === agentCharacterId) {
      return;
    }

    logger.info(
      `[HyperscapePlugin] Chat message from ${chatData.from}: "${chatData.text}"`,
    );

    try {
      // Create memory for the chat message
      const memory = await runtime.createMemory(
        {
          entityId: runtime.agentId, // Use agentId as entityId (it's a UUID)
          agentId: runtime.agentId,
          roomId: runtime.agentId, // Use agentId as roomId
          content: {
            text: chatData.text,
            source: "hyperscape_chat",
          },
          metadata: {
            type: "message",
            senderName: chatData.from,
            senderId: chatData.fromId,
            timestamp: chatData.timestamp,
          },
          // Don't pass embedding - let ElizaOS handle it
        },
        "messages",
        false,
      );

      // Process through ElizaOS message handler to trigger actions
      if (runtime.messageService) {
        await runtime.messageService.handleMessage(
          runtime,
          memory,
          async (responseContent) => {
            // Send response back to game chat
            logger.info(
              `[HyperscapePlugin] Sending response: "${responseContent.text}"`,
            );

            // TODO: Send chat message back to game via service.sendChatMessage()
            // For now just log it
          },
        );
      }
    } catch (error) {
      logger.error(
        { error },
        "[HyperscapePlugin] Failed to process chat message:",
      );
    }
  });

  logger.info("[HyperscapePlugin] Event handlers registered");
}

/**
 * Store combat event as memory
 */
async function storeCombatMemory(
  runtime: IAgentRuntime,
  description: string,
  data: unknown,
  tags: string[],
): Promise<void> {
  try {
    await runtime.createMemory(
      {
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: runtime.agentId, // Use agentId as fallback roomId
        content: {
          text: description,
          source: "hyperscape_game_event",
        },
        metadata: {
          type: "custom",
          timestamp: Date.now(),
          tags: ["hyperscape", "combat", ...tags],
        },
        embedding: [],
      },
      "facts",
      false,
    );

    logger.debug(`[HyperscapePlugin] Stored combat memory: ${description}`);
  } catch (error) {
    logger.error(
      { error },
      "[HyperscapePlugin] Failed to store combat memory:",
    );
  }
}

/**
 * Store resource event as memory
 */
async function storeResourceMemory(
  runtime: IAgentRuntime,
  description: string,
  data: unknown,
  tags: string[],
): Promise<void> {
  try {
    const eventData = data as {
      resourceName?: string;
      position?: [number, number, number];
    };

    await runtime.createMemory(
      {
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: runtime.agentId,
        content: {
          text: `${description}${eventData.position ? ` at [${eventData.position.join(", ")}]` : ""}`,
          source: "hyperscape_game_event",
        },
        metadata: {
          type: "custom",
          timestamp: Date.now(),
          tags: ["hyperscape", "resource", ...tags],
        },
        embedding: [],
      },
      "facts",
      false,
    );

    logger.debug(`[HyperscapePlugin] Stored resource memory: ${description}`);
  } catch (error) {
    logger.error(
      { error },
      "[HyperscapePlugin] Failed to store resource memory:",
    );
  }
}

/**
 * Store general fact as memory
 */
async function storeFactMemory(
  runtime: IAgentRuntime,
  description: string,
  data: unknown,
  tags: string[],
): Promise<void> {
  try {
    await runtime.createMemory(
      {
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: runtime.agentId,
        content: {
          text: description,
          source: "hyperscape_game_event",
        },
        metadata: {
          type: "custom",
          timestamp: Date.now(),
          tags: ["hyperscape", ...tags],
        },
        embedding: [],
      },
      "facts",
      false,
    );

    logger.debug(`[HyperscapePlugin] Stored fact memory: ${description}`);
  } catch (error) {
    logger.error({ error }, "[HyperscapePlugin] Failed to store fact memory:");
  }
}
