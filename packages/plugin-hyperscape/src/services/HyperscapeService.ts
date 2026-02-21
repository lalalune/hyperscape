/**
 * HyperscapeService - Core service for managing WebSocket connection to Hyperscape server
 *
 * This service:
 * - Maintains WebSocket connection to the game server
 * - Listens to all game events and updates cached state
 * - Provides API for executing game commands
 * - Handles automatic reconnection on disconnect
 * - Broadcasts game events to registered handlers
 */

import {
  Service,
  logger,
  ModelType,
  type IAgentRuntime,
  type Memory,
  type Action,
  type UUID,
} from "@elizaos/core";
import WebSocket from "ws";
import { Packr, Unpackr } from "msgpackr";
import type {
  PlayerEntity,
  Entity,
  EventType,
  NetworkEvent,
  GameStateCache,
  ConnectionState,
  MoveToCommand,
  AttackEntityCommand,
  UseItemCommand,
  EquipItemCommand,
  ChatMessageCommand,
  GatherResourceCommand,
  BankCommand,
  QuestData,
  PendingDuelChallenge,
  HyperscapeServiceInterface,
} from "../types.js";
import { AutonomousBehaviorManager } from "../managers/autonomous-behavior-manager.js";
import { registerEventHandlers } from "../events/handlers.js";
import { getAvailableGoals } from "../providers/goalProvider.js";
import { SCRIPTED_AUTONOMY_CONFIG } from "../config/constants.js";
import {
  resolveLocation,
  parseLocationFromMessage,
} from "../utils/location-resolver.js";
import { AgentLiveKit } from "../systems/liveKit.js";
import {
  getPacketId as sharedGetPacketId,
  getPacketName as sharedGetPacketName,
} from "@hyperscape/shared";

// msgpackr instances for binary packet encoding/decoding
const packr = new Packr({ structuredClone: true });
const unpackr = new Unpackr();

/**
 * Fallback packet registry for plugin runtime stability.
 *
 * In some CLI/runtime loading paths the shared packet registry can be accessed
 * before it is fully initialized, which throws during getPacketId/getPacketName.
 * Keeping a local subset for packets this plugin actually uses prevents auth
 * and movement loops from failing hard.
 */
const FALLBACK_PACKET_IDS: Record<string, number> = {
  snapshot: 0,
  chatAdded: 2,
  entityAdded: 4,
  entityModified: 5,
  moveRequest: 6,
  entityEvent: 7,
  entityRemoved: 8,
  playerState: 20,
  resourceDepleted: 27,
  resourceRespawned: 28,
  resourceGather: 31,
  attackMob: 64,
  pickupItem: 70,
  dropItem: 71,
  useItem: 73,
  equipItem: 75,
  inventoryUpdated: 77,
  equipmentUpdated: 80,
  skillsUpdated: 81,
  combatDamageDealt: 93,
  playerUpdated: 97,
  characterSelected: 106,
  enterWorld: 107,
  enterWorldApproved: 108,
  enterWorldRejected: 109,
  syncGoal: 110,
  goalOverride: 111,
  syncAgentThought: 112,
  entityInteract: 139,
  entityTileUpdate: 146,
  tileMovementStart: 147,
  tileMovementEnd: 148,
  duelChallengeSent: 192,
  duelChallengeIncoming: 193,
  duelSessionStarted: 194,
  duelChallengeDeclined: 195,
  duelError: 196,
  authenticate: 255,
  authResult: 256,
  reconnected: 258,
  streamingState: 259,
  prayerToggle: 278,
  prayerToggled: 282,
};

const FALLBACK_PACKET_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(FALLBACK_PACKET_IDS).map(([name, id]) => [id, name]),
) as Record<number, string>;

let loggedPacketIdFallbackWarning = false;
let loggedPacketNameFallbackWarning = false;

// Pre-allocated temp objects for hot path optimizations (avoid GC pressure)
const _tempPosition: [number, number, number] = [0, 0, 0];
const _tempTranslated: Record<string, unknown> = {};

/**
 * Check if a position is valid (non-allocating check)
 * Used for hot path checks without creating arrays
 */
function hasValidPositionData(pos: unknown): boolean {
  if (Array.isArray(pos) && pos.length >= 3) {
    return typeof pos[0] === "number" && typeof pos[2] === "number";
  }
  if (pos && typeof pos === "object" && "x" in pos) {
    const objPos = pos as { x: number; z?: number };
    return typeof objPos.x === "number";
  }
  return false;
}

/**
 * Update an existing position array in place, or create new if none exists
 * Optimized for hot paths - avoids allocation when possible
 */
function updatePositionInPlace(
  existingPos: [number, number, number] | null | undefined,
  newPos: unknown,
): [number, number, number] | null {
  if (Array.isArray(newPos) && newPos.length >= 3) {
    if (existingPos && Array.isArray(existingPos)) {
      // Update existing array in place - no allocation!
      existingPos[0] = newPos[0];
      existingPos[1] = newPos[1];
      existingPos[2] = newPos[2];
      return existingPos;
    }
    // No existing array, must create new one
    return [newPos[0], newPos[1], newPos[2]];
  }
  if (newPos && typeof newPos === "object" && "x" in newPos) {
    const objPos = newPos as { x: number; y?: number; z?: number };
    const z = objPos.z ?? 0;
    if (existingPos && Array.isArray(existingPos)) {
      // Update existing array in place - no allocation!
      existingPos[0] = objPos.x;
      existingPos[1] = objPos.y ?? 0;
      existingPos[2] = z;
      return existingPos;
    }
    // No existing array, must create new one
    return [objPos.x, objPos.y ?? 0, z];
  }
  return null;
}

export class HyperscapeService
  extends Service
  implements HyperscapeServiceInterface
{
  static serviceType = "hyperscapeService";

  capabilityDescription =
    "Manages WebSocket connection to Hyperscape game server and provides game command execution API";

  // Map of service instances by runtime ID (each agent runtime gets its own instance)
  private static instances: Map<string, HyperscapeService> = new Map();

  private ws: WebSocket | null = null;
  private gameState: GameStateCache;
  private connectionState: ConnectionState;
  private eventHandlers: Map<
    EventType,
    Array<(data: unknown) => void | Promise<void>>
  >;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private autoReconnect: boolean = true;
  private liveKit: AgentLiveKit | null = null;
  private authToken: string | undefined;
  private privyUserId: string | undefined;
  private characterId: string | undefined;
  private hasReceivedSnapshot: boolean = false;
  private pluginEventHandlersRegistered: boolean = false;
  private chatHandlerRegistered: boolean = false;
  private chatProcessingChain: Promise<void> = Promise.resolve();
  private autonomousBehaviorManager: AutonomousBehaviorManager | null = null;
  private autonomousBehaviorEnabled: boolean = true;
  /** Temporarily stores the last removed entity for event handlers */
  private _lastRemovedEntity: Entity | null = null;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);

    this.gameState = {
      playerEntity: null,
      nearbyEntities: new Map(),
      currentRoomId: null,
      worldId: null,
      lastUpdate: Date.now(),
      quests: [],
    };

    this.connectionState = {
      connected: false,
      connecting: false,
      lastConnectAttempt: 0,
      reconnectAttempts: 0,
    };

    this.eventHandlers = new Map();
    this.liveKit = new AgentLiveKit();
    this.logBuffer = [];
  }

  private logBuffer: Array<{ timestamp: number; type: string; data: any }>;

  static async start(runtime: IAgentRuntime): Promise<Service> {
    // Per-runtime singleton - each agent gets its own service instance
    const runtimeId = runtime.agentId;
    const existingInstance = HyperscapeService.instances.get(runtimeId);

    if (existingInstance) {
      logger.info(
        `[HyperscapeService] Reusing existing service instance for runtime ${runtimeId}`,
      );
      return existingInstance;
    }

    logger.info(
      `[HyperscapeService] Starting service for runtime ${runtimeId}`,
    );
    const service = new HyperscapeService(runtime);
    HyperscapeService.instances.set(runtimeId, service);

    // Get server URL from environment or use default
    const serverUrl =
      process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:5555/ws";
    service.autoReconnect = process.env.HYPERSCAPE_AUTO_RECONNECT !== "false";

    // Get auth tokens from environment or agent settings
    service.authToken = process.env.HYPERSCAPE_AUTH_TOKEN;
    service.privyUserId = process.env.HYPERSCAPE_PRIVY_USER_ID;

    // Debug: Log what we got from environment
    logger.info(
      `[HyperscapeService] 🔑 Credentials from env: authToken=${service.authToken ? "***" + service.authToken.slice(-8) : "null"}, privyUserId=${service.privyUserId || "null"}`,
    );

    // Try to get from agent settings if not in env
    // First try runtime.getSetting (standard ElizaOS method)
    if (!service.authToken && runtime.agentId) {
      const settings = runtime.getSetting("HYPERSCAPE_AUTH_TOKEN");
      logger.info(
        `[HyperscapeService] 🔑 getSetting("HYPERSCAPE_AUTH_TOKEN") = ${settings ? "***" + String(settings).slice(-8) : "null"}`,
      );
      if (settings) {
        service.authToken = String(settings);
      }
    }
    if (!service.privyUserId && runtime.agentId) {
      const settings = runtime.getSetting("HYPERSCAPE_PRIVY_USER_ID");
      if (settings) {
        service.privyUserId = String(settings);
      }
    }
    if (!service.characterId && runtime.agentId) {
      const settings = runtime.getSetting("HYPERSCAPE_CHARACTER_ID");
      logger.info(
        `[HyperscapeService] 🔑 getSetting("HYPERSCAPE_CHARACTER_ID") = ${settings || "null"}`,
      );
      if (settings) {
        service.characterId = String(settings);
        logger.info(
          `[HyperscapeService] ✅ Character ID set: ${service.characterId}`,
        );
      }
    }

    // Fallback: Try to access character.settings.secrets directly
    // This handles cases where getSetting doesn't find nested secrets
    const character = runtime.character as {
      settings?: { secrets?: Record<string, string> };
    };
    if (character?.settings?.secrets) {
      const secrets = character.settings.secrets;
      logger.info(
        `[HyperscapeService] 🔑 Checking character.settings.secrets directly...`,
      );
      if (!service.authToken && secrets.HYPERSCAPE_AUTH_TOKEN) {
        service.authToken = secrets.HYPERSCAPE_AUTH_TOKEN;
        logger.info(
          `[HyperscapeService] ✅ Found authToken in character.settings.secrets`,
        );
      }
      if (!service.characterId && secrets.HYPERSCAPE_CHARACTER_ID) {
        service.characterId = secrets.HYPERSCAPE_CHARACTER_ID;
        logger.info(
          `[HyperscapeService] ✅ Found characterId in character.settings.secrets: ${service.characterId}`,
        );
      }
      if (!service.privyUserId && secrets.HYPERSCAPE_PRIVY_USER_ID) {
        service.privyUserId = secrets.HYPERSCAPE_PRIVY_USER_ID;
      }
    }

    // Summary of final credential state
    logger.info(
      `[HyperscapeService] 📋 Final credentials:\n` +
        `  - authToken: ${service.authToken ? "SET (***" + service.authToken.slice(-8) + ")" : "NOT SET ⚠️"}\n` +
        `  - privyUserId: ${service.privyUserId || "NOT SET"}\n` +
        `  - characterId: ${service.characterId || "NOT SET ⚠️"}`,
    );

    // Auto-authenticate using wallet if no credentials exist
    if (!service.authToken || !service.characterId) {
      logger.info(
        "[HyperscapeService] No credentials found - attempting wallet-based auth...",
      );

      try {
        // Get wallet address from runtime character settings
        const characterSettings = runtime.character as {
          settings?: {
            secrets?: Record<string, string>;
            evmAddress?: string;
            solanaAddress?: string;
          };
        };

        // Try to get wallet from various sources
        let walletAddress =
          characterSettings?.settings?.evmAddress ||
          characterSettings?.settings?.secrets?.EVM_PUBLIC_KEY ||
          process.env.EVM_PUBLIC_KEY ||
          characterSettings?.settings?.solanaAddress ||
          characterSettings?.settings?.secrets?.SOLANA_PUBLIC_KEY ||
          process.env.SOLANA_PUBLIC_KEY;

        const walletType = walletAddress?.startsWith("0x") ? "evm" : "solana";

        if (walletAddress) {
          // Build API URL from WebSocket URL
          const apiBaseUrl = serverUrl
            .replace(/^ws:/, "http:")
            .replace(/^wss:/, "https:")
            .replace(/\/ws$/, "");

          logger.info(
            `[HyperscapeService] Authenticating with wallet: ${walletAddress.slice(0, 10)}...`,
          );

          const response = await fetch(`${apiBaseUrl}/api/agents/wallet-auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress,
              walletType,
              agentName: runtime.character?.name || "Agent",
              agentId: runtime.agentId, // Pass agentId for dashboard spectating support
            }),
          });

          if (response.ok) {
            const result = (await response.json()) as {
              success: boolean;
              authToken?: string;
              characterId?: string;
              accountId?: string;
            };

            if (result.success && result.authToken && result.characterId) {
              service.authToken = result.authToken;
              service.characterId = result.characterId;
              // Set env vars so viewer can use them
              process.env.HYPERSCAPE_AUTH_TOKEN = result.authToken;
              process.env.HYPERSCAPE_CHARACTER_ID = result.characterId;
              // Set agent ID for embedded viewer polling
              if (runtime.agentId) {
                process.env.HYPERSCAPE_EMBED_AGENT_ID = runtime.agentId;
              }

              // Persist to character secrets for future sessions
              const char = runtime.character as {
                settings?: { secrets?: Record<string, string> };
              };
              if (char?.settings) {
                if (!char.settings.secrets) {
                  char.settings.secrets = {};
                }
                char.settings.secrets.HYPERSCAPE_AUTH_TOKEN = result.authToken;
                char.settings.secrets.HYPERSCAPE_CHARACTER_ID =
                  result.characterId;
                if (result.accountId) {
                  char.settings.secrets.HYPERSCAPE_ACCOUNT_ID =
                    result.accountId;
                }
                logger.info(
                  "[HyperscapeService] ✅ Credentials persisted to character secrets",
                );
              }

              logger.info(
                `[HyperscapeService] ✅ Wallet auth successful! Character: ${result.characterId}`,
              );
            }
          } else {
            const errorText = await response.text().catch(() => "Unknown");
            logger.warn(
              `[HyperscapeService] Wallet auth failed: ${response.status} ${errorText}`,
            );
          }
        } else {
          logger.warn(
            "[HyperscapeService] No wallet address found for auto-auth",
          );
        }
      } catch (error) {
        logger.warn(
          `[HyperscapeService] Wallet auth error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!service.characterId) {
      logger.warn(
        "[HyperscapeService] ⚠️ No HYPERSCAPE_CHARACTER_ID - agent will NOT be able to enter the game world!",
      );
    }
    if (!service.authToken) {
      logger.warn(
        "[HyperscapeService] ⚠️ No HYPERSCAPE_AUTH_TOKEN - agent will NOT be able to authenticate!",
      );
    }

    // NON-BLOCKING CONNECTION: Start WebSocket connection asynchronously to avoid
    // blocking ElizaOS service registration. ElizaOS has a 30-second timeout for
    // service registration that can be exceeded when multiple agents start simultaneously.
    // Auto-reconnect will handle the connection in the background.
    logger.info(
      `[HyperscapeService] Starting async connection to ${serverUrl} (non-blocking)`,
    );

    // Start connection attempt asynchronously - don't await
    const connectWithRetry = async () => {
      const maxRetries = 3;
      const retryDelay = 4000; // 4 seconds between retries

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(
            `[HyperscapeService] Connection attempt ${attempt}/${maxRetries} to ${serverUrl}`,
          );
          await service.connect(serverUrl);
          logger.info("[HyperscapeService] Connected successfully");

          // Register chat message handler after successful connection
          service.registerChatHandler(runtime);
          return;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          logger.warn(
            `[HyperscapeService] Connection attempt ${attempt} failed: ${errorMsg}`,
          );

          if (attempt < maxRetries) {
            logger.info(
              `[HyperscapeService] Retrying in ${retryDelay / 1000}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          } else {
            logger.error(
              `[HyperscapeService] Failed to connect after ${maxRetries} attempts. ` +
                `Auto-reconnect will continue trying in background.`,
            );
          }
        }
      }
    };

    // Fire and forget - connection happens in background
    connectWithRetry().catch((err) => {
      logger.error(
        `[HyperscapeService] Connection retry loop error: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    // Return service immediately - don't wait for connection
    logger.info(
      "[HyperscapeService] Service started (connection in progress asynchronously)",
    );
    return service;
  }

  /**
   * Ensure dashboard entity exists in ElizaOS database for foreign key constraint
   */
  private async ensureDashboardEntity(
    runtime: IAgentRuntime,
    dashboardUuid: string,
  ): Promise<void> {
    try {
      // Check if entity already exists using ElizaOS runtime API
      const existingEntity = await runtime.getEntityById(dashboardUuid as UUID);

      if (existingEntity) {
        logger.debug(
          "[HyperscapePlugin] Dashboard entity already exists in database",
        );
        return;
      }

      // Create the dashboard entity using ElizaOS runtime API
      // This satisfies the foreign key constraint for memories.entityId
      const created = await runtime.createEntity({
        id: dashboardUuid as UUID,
        names: ["Dashboard"],
        agentId: runtime.agentId,
        metadata: {
          username: "dashboard",
          source: "hyperscape_dashboard",
          description: "Hyperscape Dashboard User",
        },
      });

      if (created) {
        logger.info("[HyperscapePlugin] Created dashboard entity in database");
      } else {
        logger.warn(
          "[HyperscapePlugin] Failed to create dashboard entity (may already exist)",
        );
      }
    } catch (error) {
      logger.warn(
        { error },
        "[HyperscapePlugin] Could not ensure dashboard entity (may already exist):",
      );
    }
  }

  /**
   * Register chat message handler to process messages through ElizaOS runtime
   */
  registerChatHandler(runtime: IAgentRuntime): void {
    // Guard against duplicate registration
    if (this.chatHandlerRegistered) {
      logger.debug(
        "[HyperscapeService] Chat handler already registered, skipping",
      );
      return;
    }

    const silentSetting = runtime.getSetting("HYPERSCAPE_SILENT_CHAT");
    const silentChat =
      SCRIPTED_AUTONOMY_CONFIG.SILENT_CHAT ||
      String(silentSetting || "").toLowerCase() === "true";

    if (silentChat) {
      this.chatHandlerRegistered = true;
      logger.info(
        "[HyperscapeService] Chat handler disabled (silent mode enabled)",
      );
      return;
    }

    this.chatHandlerRegistered = true;
    logger.info("[HyperscapeService] Registering chat handler");

    // Ensure dashboard entity exists in ElizaOS database for foreign key constraint
    const dashboardUuid = "00000000-0000-0000-0000-000000000001";
    this.ensureDashboardEntity(runtime, dashboardUuid).catch((error) => {
      logger.error(
        { error },
        "[HyperscapePlugin] Failed to create dashboard entity:",
      );
    });

    this.onGameEvent("CHAT_MESSAGE", (data: unknown) => {
      // Serialize chat processing so one response finishes before the next begins.
      // This prevents overlapping LLM/action executions and response pile-ons.
      this.chatProcessingChain = this.chatProcessingChain
        .catch(() => undefined)
        .then(async () => {
          const chatData = data as {
            from: string;
            fromId?: string;
            text?: string;
            body?: string;
            timestamp: number;
          };

          // Ignore messages from the agent itself
          const agentCharacterId = this.getGameState()?.playerEntity?.id;
          if (chatData.fromId === agentCharacterId) {
            return;
          }

          const messageText = chatData.text || chatData.body || "";
          logger.info(
            `[HyperscapePlugin] Chat message from ${chatData.from}: "${messageText}"`,
          );

          try {
            // Create a Memory object for ElizaOS action processing
            // Note: Memory uses entityId (not userId) for the message sender
            const memory: Memory = {
              id: crypto.randomUUID() as UUID,
              entityId:
                dashboardUuid as `${string}-${string}-${string}-${string}-${string}`,
              agentId: runtime.agentId,
              roomId:
                dashboardUuid as `${string}-${string}-${string}-${string}-${string}`,
              content: {
                text: messageText,
                source: "hyperscape_dashboard",
              },
              createdAt: chatData.timestamp,
            };

            // Import all available actions for matching
            const { moveToAction, stopMovementAction } =
              await import("../actions/movement.js");
            const {
              pickupItemAction,
              equipItemAction,
              useItemAction,
              dropItemAction,
            } = await import("../actions/inventory.js");
            const { attackEntityAction } = await import("../actions/combat.js");
            const { chopTreeAction } = await import("../actions/skills.js");
            const { exploreAction } = await import("../actions/autonomous.js");

            // All available actions with their trigger patterns
            const availableActions: Array<{
              action: Action;
              patterns: RegExp[];
            }> = [
              {
                action: stopMovementAction,
                patterns: [/^(stop|halt|stay|cancel|abort)/i],
              },
              {
                action: moveToAction,
                patterns: [
                  /\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/,
                  /^(go to|move to|walk to|run to)\s+/i,
                ],
              },
              {
                action: pickupItemAction,
                patterns: [/\b(pick\s*up|pickup|grab|take|loot|get)\b/i],
              },
              {
                action: equipItemAction,
                patterns: [/\b(equip|wield|wear|put on)\b/i],
              },
              {
                action: useItemAction,
                patterns: [/\b(use|eat|drink|consume)\b/i],
              },
              {
                action: dropItemAction,
                patterns: [/\b(drop|discard|throw away)\b/i],
              },
              {
                action: attackEntityAction,
                patterns: [/\b(attack|fight|kill|hit|strike)\b/i],
              },
              {
                action: chopTreeAction,
                patterns: [/\b(chop|cut|woodcut)\b.*\b(tree|wood|log)\b/i],
              },
              {
                action: exploreAction,
                patterns: [/\b(explore|wander|look around|scout)\b/i],
              },
            ];

            // Find matching action based on message content
            let actionToInvoke: Action | null = null;
            const normalizedMessage = messageText.trim().toLowerCase();

            // Special handling: Check if this is a "go to <location>" command
            // If so, resolve the location name to coordinates before pattern matching
            const locationQuery = parseLocationFromMessage(messageText);
            if (locationQuery) {
              const playerEntity = this.getPlayerEntity();
              const nearbyEntities = this.getNearbyEntities();

              // Get player position for distance calculation
              let playerPos: [number, number, number] | undefined;
              if (playerEntity?.position) {
                const pos = playerEntity.position;
                if (Array.isArray(pos) && pos.length >= 3) {
                  playerPos = [pos[0], pos[1], pos[2]];
                } else if (typeof pos === "object" && "x" in pos) {
                  const p = pos as unknown as {
                    x: number;
                    y: number;
                    z: number;
                  };
                  playerPos = [p.x, p.y, p.z];
                }
              }

              const resolvedLocation = resolveLocation(
                locationQuery,
                nearbyEntities,
                playerPos,
              );

              if (resolvedLocation) {
                logger.info(
                  `[HyperscapePlugin] 📍 Resolved "${locationQuery}" to ${resolvedLocation.name} at [${resolvedLocation.position.join(", ")}] (${resolvedLocation.distance?.toFixed(1)}m away)`,
                );

                // Execute movement directly to the resolved location
                const behaviorManager = this.getBehaviorManager();
                if (behaviorManager) {
                  const goalDescription = `User command: MOVE_TO - "go to ${resolvedLocation.name}"`;
                  behaviorManager.setGoal({
                    type: "user_command",
                    description: goalDescription,
                    target: 1,
                    progress: 0,
                    startedAt: Date.now(),
                    locked: true,
                    lockedBy: "manual",
                    lockedAt: Date.now(),
                    userMessage: messageText,
                  });
                  logger.info(
                    `[HyperscapePlugin] 🔒 Set locked goal for navigation to ${resolvedLocation.name}`,
                  );
                }

                // Execute the move
                await this.executeMove({
                  target: resolvedLocation.position,
                  runMode: normalizedMessage.includes("run"),
                });

                logger.info(
                  `[HyperscapePlugin] 🚶 Moving to ${resolvedLocation.name} at [${resolvedLocation.position.join(", ")}]`,
                );
                return;
              } else {
                logger.info(
                  `[HyperscapePlugin] ❓ Could not resolve location "${locationQuery}" - falling back to LLM`,
                );
              }
            }

            for (const { action, patterns } of availableActions) {
              for (const pattern of patterns) {
                if (pattern.test(normalizedMessage)) {
                  actionToInvoke = action;
                  logger.info(
                    `[HyperscapePlugin] 🎯 Matched action "${action.name}" from pattern`,
                  );
                  break;
                }
              }
              if (actionToInvoke) break;
            }

            if (actionToInvoke) {
              // PRAGMATIC VALIDATION: Use `this` service (which has player entity)
              // instead of runtime.getService() which may return a different instance
              const playerEntity = this.getPlayerEntity();
              const serviceConnected = this.isConnected();

              logger.info(
                `[HyperscapePlugin] Pre-validation check: connected=${serviceConnected}, hasPlayer=${!!playerEntity}, alive=${playerEntity?.alive}`,
              );

              if (!serviceConnected) {
                logger.warn(
                  `[HyperscapePlugin] ⚠️ Cannot execute ${actionToInvoke.name}: service not connected`,
                );
                return;
              }

              if (!playerEntity) {
                logger.warn(
                  `[HyperscapePlugin] ⚠️ Cannot execute ${actionToInvoke.name}: no player entity`,
                );
                return;
              }

              // Check alive status - default to true if not explicitly false
              // Some server responses may not include 'alive' property
              if (playerEntity.alive === false) {
                logger.warn(
                  `[HyperscapePlugin] ⚠️ Cannot execute ${actionToInvoke.name}: player is dead`,
                );
                return;
              }

              logger.info(
                `[HyperscapePlugin] 🎯 Executing ElizaOS action: ${actionToInvoke.name}`,
              );

              // Set a temporary locked goal to prevent autonomous behavior from interfering
              const behaviorManager = this.getBehaviorManager();
              if (behaviorManager) {
                const goalDescription = `User command: ${actionToInvoke.name} - "${messageText.substring(0, 50)}"`;
                behaviorManager.setGoal({
                  type: "user_command", // Internal goal type for user commands
                  description: goalDescription,
                  target: 1,
                  progress: 0,
                  startedAt: Date.now(),
                  locked: true,
                  lockedBy: "manual",
                  lockedAt: Date.now(),
                  userMessage: messageText, // Store full message for multi-step actions
                });
                logger.info(
                  `[HyperscapePlugin] 🔒 Set locked goal for user command: ${actionToInvoke.name}`,
                );
              }

              // Execute action through ElizaOS handler with callback
              // HandlerCallback returns Memory[] so we return empty array
              const result = await actionToInvoke.handler(
                runtime,
                memory,
                undefined, // state - will be composed by action if needed
                undefined, // options
                async (response) => {
                  // Callback for action response - could send back to game chat
                  logger.info(
                    `[HyperscapePlugin] 📤 Action response: ${response.text}`,
                  );
                  return []; // HandlerCallback expects Memory[] return
                },
              );

              if (result && typeof result === "object" && "success" in result) {
                if (result.success) {
                  logger.info(
                    `[HyperscapePlugin] ✅ Action ${actionToInvoke.name} completed successfully`,
                  );
                  // Check if action is still in progress (e.g., walking to target)
                  const resultText = (result as { text?: string }).text || "";
                  const isInProgress =
                    resultText.includes("Walking") ||
                    resultText.includes("Moving") ||
                    resultText.includes("remaining");

                  if (isInProgress) {
                    logger.info(
                      `[HyperscapePlugin] 🚶 Action in progress, keeping goal locked`,
                    );
                    // Don't clear goal - action needs multiple ticks to complete
                  } else {
                    // Action fully completed - clear the goal
                    if (behaviorManager) {
                      behaviorManager.clearGoal();
                      logger.info(
                        `[HyperscapePlugin] 🔓 Cleared locked goal after action completed`,
                      );
                    }
                  }
                } else {
                  logger.warn(
                    `[HyperscapePlugin] ⚠️ Action ${actionToInvoke.name} failed: ${(result as { error?: Error }).error?.message || "Unknown error"}`,
                  );
                  // Clear goal on failure too
                  if (behaviorManager) {
                    behaviorManager.clearGoal();
                  }
                }
              }
              return;
            }

            // No pattern matched - use ElizaOS LLM to select action
            logger.info(
              `[HyperscapePlugin] 💭 No pattern match, using ElizaOS LLM for: "${messageText}"`,
            );

            // Compose state for LLM context
            const state = await runtime.composeState(memory);

            // Build prompt for action selection
            const actionNames = availableActions
              .map((a) => a.action.name)
              .join(", ");
            const actionPrompt = `You are an AI agent in a game. The user said: "${messageText}"

Available actions: ${actionNames}

Based on the user's message, which action should be taken?
- If the user wants to pick up something, respond with: PICKUP_ITEM
- If the user wants to attack, respond with: ATTACK_ENTITY
- If the user wants to chop trees, respond with: CHOP_TREE
- If the user wants to move somewhere, respond with: MOVE_TO
- If the user wants to stop, respond with: STOP_MOVEMENT
- If the user wants to explore, respond with: EXPLORE
- If the user wants to equip something, respond with: EQUIP_ITEM
- If the user wants to eat/drink/use something, respond with: USE_ITEM
- If the user wants to drop something, respond with: DROP_ITEM
- If none apply, respond with: NONE

Respond with ONLY the action name, nothing else.`;

            try {
              const response = await runtime.useModel(ModelType.TEXT_SMALL, {
                prompt: actionPrompt,
                maxTokens: 50,
                temperature: 0.3,
              });

              const selectedActionName = String(response).trim().toUpperCase();
              logger.info(
                `[HyperscapePlugin] 🤖 LLM selected action: ${selectedActionName}`,
              );

              if (selectedActionName && selectedActionName !== "NONE") {
                const matchedAction = availableActions.find(
                  (a) => a.action.name === selectedActionName,
                );

                if (matchedAction) {
                  // Create response memory with action
                  const responseMemory: Memory = {
                    id: crypto.randomUUID() as UUID,
                    entityId: runtime.agentId,
                    agentId: runtime.agentId,
                    roomId: memory.roomId,
                    content: {
                      text: `Executing ${selectedActionName}`,
                      action: selectedActionName,
                    },
                    createdAt: Date.now(),
                  };

                  // Use ElizaOS processActions to execute
                  await runtime.processActions(
                    memory,
                    [responseMemory],
                    state,
                    async (response) => {
                      logger.info(
                        `[HyperscapePlugin] 📤 Action response: ${response.text}`,
                      );
                      return [];
                    },
                  );

                  logger.info(
                    `[HyperscapePlugin] ✅ ElizaOS processActions completed for ${selectedActionName}`,
                  );
                }
              }
            } catch (llmError) {
              logger.error(
                `[HyperscapePlugin] LLM action selection failed: ${llmError}`,
              );
            }
          } catch (error) {
            logger.error(
              { error },
              "[HyperscapePlugin] Failed to process chat message:",
            );
          }
        });
    });

    logger.info("[HyperscapePlugin] Chat handler registered");
  }

  async stop(): Promise<void> {
    logger.info("[HyperscapeService] Stopping service");
    this.autoReconnect = false;

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    await this.disconnect();

    // Clear this runtime's instance from the map
    const runtimeId = this.runtime.agentId;
    HyperscapeService.instances.delete(runtimeId);
    logger.info(
      `[HyperscapeService] Removed instance for runtime ${runtimeId}`,
    );
  }

  /**
   * Connect to Hyperscape server via WebSocket
   */
  async connect(serverUrl: string): Promise<void> {
    logger.info(
      `[HyperscapeService] 🔌 connect() called - current state: connected=${this.connectionState.connected}, connecting=${this.connectionState.connecting}, hasWs=${!!this.ws}, hasPlayer=${!!this.gameState.playerEntity}`,
    );

    // PERSISTENT WEBSOCKET PATTERN: If already connected, don't reconnect
    if (this.connectionState.connected && this.ws) {
      logger.debug(
        "[HyperscapeService] ✅ Already connected with active WebSocket, skipping reconnect",
      );
      return;
    }

    // If connection in progress, don't start another
    if (this.connectionState.connecting) {
      logger.debug(
        "[HyperscapeService] ⏳ Connection already in progress, skipping",
      );
      return;
    }

    // If WebSocket exists but we're not connected, it's in a bad state - clean it up
    if (this.ws) {
      logger.warn(
        `[HyperscapeService] ⚠️ Found stale WebSocket (not connected), cleaning up`,
      );
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (e) {
        // Ignore errors when closing stale connection
      }
      this.ws = null;
    }

    this.connectionState.connecting = true;
    this.connectionState.lastConnectAttempt = Date.now();

    // Reset snapshot flag for new connection
    this.hasReceivedSnapshot = false;

    return new Promise((resolve, reject) => {
      // Connection timeout - fail fast to avoid hitting ElizaOS's 30s service registration timeout
      // With 3 retries x 4s delay, we need each connection attempt to complete within 6s
      // Total worst case: 6 + 4 + 6 + 4 + 6 = 26 seconds, well within 30s limit
      const CONNECTION_TIMEOUT_MS = 6000;
      let connectionTimeout: NodeJS.Timeout | null = null;
      let hasSettled = false;

      const cleanup = () => {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
      };

      const settleResolve = () => {
        if (hasSettled) return;
        hasSettled = true;
        cleanup();
        resolve();
      };

      const settleReject = (error: Error) => {
        if (hasSettled) return;
        hasSettled = true;
        cleanup();
        this.connectionState.connecting = false;
        // Clean up the WebSocket if it exists
        if (this.ws) {
          try {
            this.ws.removeAllListeners();
            this.ws.close();
          } catch (e) {
            // Ignore cleanup errors
          }
          this.ws = null;
        }
        reject(error);
      };

      try {
        // Build WebSocket URL with auth tokens
        const wsUrl = this.buildWebSocketUrl(serverUrl);

        logger.info(
          `[HyperscapeService] Connecting to ${wsUrl.replace(/authToken=[^&]+/, "authToken=***")}`,
        );
        this.ws = new WebSocket(wsUrl);

        // Set connection timeout
        connectionTimeout = setTimeout(() => {
          settleReject(
            new Error(
              `WebSocket connection timeout (${CONNECTION_TIMEOUT_MS}ms)`,
            ),
          );
        }, CONNECTION_TIMEOUT_MS);

        // Add unique identifier to track this WebSocket
        const wsId = `WS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        (this.ws as any).__wsId = wsId;
        logger.info(
          `[HyperscapeService] Created WebSocket ${wsId} for runtime ${this.runtime.agentId}`,
        );

        this.ws.on("open", async () => {
          const wsId = (this.ws as any).__wsId || "unknown";

          // SECURITY: Check if we need first-message authentication
          // If no authToken in URL, server expects us to send 'authenticate' packet
          const needsFirstMessageAuth = !this.authToken;

          if (needsFirstMessageAuth) {
            logger.info(
              `[HyperscapeService] 🔐 Using first-message authentication (no authToken in URL)`,
            );

            // Set up one-time handler for authResult
            const authResultHandler = (data: WebSocket.Data) => {
              try {
                let buffer: Buffer;
                if (Buffer.isBuffer(data)) {
                  buffer = data;
                } else if (data instanceof ArrayBuffer) {
                  buffer = Buffer.from(data);
                } else if (Array.isArray(data)) {
                  buffer = Buffer.concat(data.map((b) => Buffer.from(b)));
                } else {
                  return; // Not binary data, ignore
                }

                const decoded = unpackr.unpack(buffer);
                if (!Array.isArray(decoded) || decoded.length !== 2) {
                  return;
                }

                const [packetId, packetData] = decoded;
                const packetName = this.getPacketName(packetId as number);

                if (packetName !== "authResult") {
                  return; // Not the packet we're waiting for
                }

                // Remove this handler - we only need it once
                this.ws?.off("message", authResultHandler);

                const authResult = packetData as {
                  success: boolean;
                  error?: string;
                };

                if (authResult.success) {
                  logger.info(
                    `[HyperscapeService] ✅ First-message authentication successful`,
                  );
                  this.connectionState.connected = true;
                  this.connectionState.connecting = false;
                  this.connectionState.reconnectAttempts = 0;

                  // Handle reconnection if needed (same as legacy auth path)
                  const isReconnection = !!this.gameState.playerEntity;
                  if (isReconnection && this.characterId) {
                    logger.warn(
                      `[HyperscapeService] 🔄 ===== RECONNECTION DETECTED (first-message auth) ===== Re-spawning player...`,
                    );

                    // Clear old player entity reference since we're respawning on new socket
                    this.gameState.playerEntity = null;

                    // Use setTimeout to avoid blocking the auth result handler
                    setTimeout(async () => {
                      try {
                        // Wait for connection to stabilize
                        await new Promise((r) => setTimeout(r, 500));

                        // Re-send character selection
                        this.sendBinaryPacket("characterSelected", {
                          characterId: this.characterId,
                        });
                        logger.info(
                          `[HyperscapeService] 📤 Re-sent characterSelected: ${this.characterId} (reconnection)`,
                        );

                        // Wait before entering world
                        await new Promise((r) => setTimeout(r, 500));

                        // Re-send enter world — include duelBot flag for duel bots
                        const isDuelBot2 =
                          this.runtime.getSetting(
                            "HYPERSCAPE_AUTO_ACCEPT_DUELS",
                          ) === "true";
                        this.sendBinaryPacket("enterWorld", {
                          characterId: this.characterId,
                          ...(isDuelBot2
                            ? {
                                duelBot: true,
                                botName:
                                  this.runtime.character?.name ||
                                  this.characterId,
                              }
                            : {}),
                        });
                        logger.info(
                          `[HyperscapeService] 🚪 Re-sent enterWorld: ${this.characterId} (reconnection)`,
                        );

                        // Sync pause state
                        setTimeout(() => {
                          this.syncPauseStateFromServer().catch((err) => {
                            logger.warn(
                              `[HyperscapeService] Failed to sync pause state on reconnection: ${err instanceof Error ? err.message : String(err)}`,
                            );
                          });
                        }, 1000);
                      } catch (err) {
                        logger.error(
                          `[HyperscapeService] Reconnection handling failed: ${err instanceof Error ? err.message : String(err)}`,
                        );
                      }
                    }, 0);
                  }

                  settleResolve();
                } else {
                  logger.error(
                    `[HyperscapeService] ❌ First-message authentication failed: ${authResult.error || "Unknown error"}`,
                  );
                  settleReject(
                    new Error(
                      `Authentication failed: ${authResult.error || "Unknown error"}`,
                    ),
                  );
                }
              } catch (error) {
                // Ignore decode errors - not the packet we're looking for
              }
            };

            // Listen for authResult packet
            this.ws?.on("message", authResultHandler);

            // Send authenticate packet with whatever credentials we have
            // For embedded agents, they may connect without traditional auth tokens
            // The server can choose to allow or reject based on configuration
            const authPacket = packr.pack([
              this.getPacketId("authenticate"),
              {
                authToken: this.authToken || "",
                privyUserId: this.privyUserId || "",
                name: this.runtime.character?.name || "Agent",
                avatar: "",
              },
            ]);
            this.ws?.send(authPacket);
            logger.info(
              `[HyperscapeService] 📤 Sent authenticate packet (WebSocket ${wsId})`,
            );

            // Don't settle yet - wait for authResult
            return;
          }

          // Legacy URL-based auth: complete immediately
          this.connectionState.connected = true;
          this.connectionState.connecting = false;
          this.connectionState.reconnectAttempts = 0;

          // Check if this is a reconnection (player entity already exists)
          const isReconnection = !!this.gameState.playerEntity;

          if (isReconnection && this.characterId) {
            logger.warn(
              `[HyperscapeService] 🔄 ===== RECONNECTION DETECTED ===== Player entity exists (${this.gameState.playerEntity?.id}). Re-spawning player on new server socket...`,
            );
            logger.warn(
              `[HyperscapeService] WebSocket ${wsId} reconnected, sending characterSelected + enterWorld for character ${this.characterId}`,
            );

            // Clear old player entity reference since we're respawning on new socket
            this.gameState.playerEntity = null;
            logger.info(
              `[HyperscapeService] Cleared old player entity reference for re-spawn`,
            );

            // Wait for connection to stabilize
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Re-send character selection
            this.sendBinaryPacket("characterSelected", {
              characterId: this.characterId,
            });
            logger.info(
              `[HyperscapeService] 📤 Re-sent characterSelected: ${this.characterId} (reconnection)`,
            );

            // Wait before entering world
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Re-send enter world — include duelBot flag for duel bots
            const isDuelBotRecon =
              this.runtime.getSetting("HYPERSCAPE_AUTO_ACCEPT_DUELS") ===
              "true";
            this.sendBinaryPacket("enterWorld", {
              characterId: this.characterId,
              ...(isDuelBotRecon
                ? {
                    duelBot: true,
                    botName: this.runtime.character?.name || this.characterId,
                  }
                : {}),
            });
            logger.info(
              `[HyperscapeService] 🚪 Re-sent enterWorld: ${this.characterId} (reconnection)`,
            );

            // Sync pause state from server to maintain consistent state across reconnects
            // Wait for connection to stabilize before syncing
            setTimeout(() => {
              this.syncPauseStateFromServer().catch((err) => {
                logger.warn(
                  `[HyperscapeService] Failed to sync pause state on reconnection: ${err instanceof Error ? err.message : String(err)}`,
                );
              });
            }, 1000);
          } else {
            logger.info(
              `[HyperscapeService] Connected to Hyperscape server (WebSocket ${wsId})`,
            );
          }

          settleResolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on("close", (code: number, reason: Buffer) => {
          this.connectionState.connected = false;
          this.connectionState.connecting = false;

          const reasonStr = reason.toString() || "none";
          logger.warn(
            `[HyperscapeService] 🔌 WebSocket closed - code: ${code}, reason: ${reasonStr}, hasPlayer: ${!!this.gameState.playerEntity}`,
          );

          // PERSISTENT WEBSOCKET PATTERN: Only reconnect on abnormal closure
          // Code 1000 = Normal closure (intentional, don't reconnect)
          // Code 1001 = Going away (server shutdown, don't reconnect)
          // Code 1005 = No status code (browser initiated, don't reconnect)
          // Code 1006 = Abnormal closure (connection lost, DO reconnect)
          const isNormalClosure =
            code === 1000 || code === 1001 || code === 1005;

          if (isNormalClosure) {
            logger.info(
              `[HyperscapeService] ✅ Normal closure (code ${code}), not reconnecting`,
            );
            return;
          }

          // Abnormal closure - reconnect if auto-reconnect enabled
          if (this.autoReconnect) {
            logger.warn(
              `[HyperscapeService] ⚠️ Abnormal closure (code ${code}), scheduling reconnection...`,
            );
            this.scheduleReconnect();
          } else {
            logger.info(
              `[HyperscapeService] Auto-reconnect disabled, not reconnecting`,
            );
          }
        });

        this.ws.on("error", (error: Error) => {
          logger.error("[HyperscapeService] WebSocket error:", error.message);
          settleReject(error);
        });
      } catch (error) {
        logger.error(
          "[HyperscapeService] Failed to connect:",
          error instanceof Error ? error.message : String(error),
        );
        settleReject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Build WebSocket URL with auth tokens as query parameters
   *
   * CRITICAL: Strip any existing query parameters to prevent duplicates.
   * When auto-reconnect is triggered, the URL may already have authToken from previous connection.
   * Duplicate authToken parameters cause server to authenticate as wrong user.
   */
  private buildWebSocketUrl(baseUrl: string): string {
    if (!this.authToken) {
      return baseUrl;
    }

    // Strip any existing query parameters - we'll rebuild them from scratch
    const cleanBaseUrl = baseUrl.split("?")[0];

    // Build fresh URL with current authentication parameters
    let url = `${cleanBaseUrl}?authToken=${encodeURIComponent(this.authToken)}`;
    if (this.privyUserId) {
      url += `&privyUserId=${encodeURIComponent(this.privyUserId)}`;
    }

    logger.info(
      `[HyperscapeService] 🔧 Built WebSocket URL: ${cleanBaseUrl}?authToken=*** (stripped any existing params)`,
    );

    return url;
  }

  /**
   * Set authentication tokens for future connections
   */
  setAuthToken(authToken: string, privyUserId?: string): void {
    this.authToken = authToken;
    this.privyUserId = privyUserId;
    logger.info("[HyperscapeService] Auth token updated");
  }

  /**
   * Disconnect from Hyperscape server
   *
   * Performs intentional disconnect - will not trigger auto-reconnect
   */
  async disconnect(): Promise<void> {
    // Disable auto-reconnect before closing to prevent reconnection
    const wasAutoReconnect = this.autoReconnect;
    this.autoReconnect = false;

    if (this.ws) {
      this.ws.close(); // Code 1000 - normal closure, won't reconnect
      this.ws = null;
    }

    if (this.liveKit) {
      await this.liveKit.stop();
    }

    this.connectionState.connected = false;
    this.connectionState.connecting = false;

    // Restore auto-reconnect setting for future manual connects
    this.autoReconnect = wasAutoReconnect;

    logger.info("[HyperscapeService] Disconnected (intentional)");
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.connectionState.connected && this.ws !== null;
  }

  /**
   * Schedule automatic reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      return; // Already scheduled
    }

    // Allow reconnection even if player exists - the open handler will detect
    // reconnection and re-spawn the player on the new server socket
    if (this.gameState.playerEntity) {
      logger.info(
        `[HyperscapeService] 🔄 Scheduling reconnect with player entity present (${this.gameState.playerEntity.id}) - will re-spawn on new socket`,
      );
    }

    const backoffMs = Math.min(
      1000 * Math.pow(2, this.connectionState.reconnectAttempts),
      30000,
    );

    logger.info(
      `[HyperscapeService] Reconnecting in ${backoffMs}ms (attempt ${this.connectionState.reconnectAttempts + 1})`,
    );

    this.reconnectInterval = setTimeout(async () => {
      this.reconnectInterval = null;
      this.connectionState.reconnectAttempts++;

      try {
        // Pass base URL to connect() - it will build the full URL with auth tokens
        const baseUrl =
          process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:5555/ws";
        await this.connect(baseUrl);
      } catch (error) {
        logger.error(
          "[HyperscapeService] Reconnection failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }, backoffMs);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      // Convert to buffer for msgpackr
      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (data instanceof ArrayBuffer) {
        buffer = Buffer.from(data);
      } else if (Array.isArray(data)) {
        // Multiple buffers - concatenate them
        buffer = Buffer.concat(data.map((b) => Buffer.from(b)));
      } else {
        // String data - try JSON parse for legacy support
        const text = data.toString();
        if (!text || text.trim().length === 0) return;
        if (!text.trim().startsWith("{") && !text.trim().startsWith("["))
          return;

        const message = JSON.parse(text) as NetworkEvent;
        this.updateGameState(message);
        this.broadcastEvent(message.type, message.data);
        return;
      }

      // Decode binary msgpackr packet: [packetId, data]
      const decoded = unpackr.unpack(buffer);
      if (!Array.isArray(decoded) || decoded.length !== 2) {
        return; // Invalid packet format
      }

      const [packetId, packetData] = decoded;

      // Map packet ID to packet name (from packets.ts)
      const packetName = this.getPacketName(packetId as number);

      if (!packetName) {
        return; // Unknown packet ID
      }

      // Handle snapshot packet - auto-join world
      if (packetName === "snapshot" && !this.hasReceivedSnapshot) {
        this.hasReceivedSnapshot = true;
        logger.info("[HyperscapeService] 📸 Snapshot received");
        this.handleSnapshot(packetData);
        this.requestQuestList();
      }

      // Update game state based on packet
      this.updateGameStateFromPacket(packetName, packetData);

      // Debug logging for chatAdded packets
      if (packetName === "chatAdded") {
        logger.info(
          `[HyperscapeService] 💬 Received chatAdded packet:`,
          JSON.stringify(packetData),
        );
      }

      // Broadcast to registered event handlers
      const eventType = this.packetNameToEventType(packetName);
      if (eventType) {
        if (packetName === "chatAdded") {
          logger.info(`[HyperscapeService] 📢 Broadcasting CHAT_MESSAGE event`);
        }
        // Debug: Log entityRemoved packets
        if (packetName === "entityRemoved") {
          logger.info(
            `[HyperscapeService] 🗑️ entityRemoved packet received: ${JSON.stringify(packetData)}, lastRemovedEntity: ${this._lastRemovedEntity?.name || "none"}`,
          );
        }
        this.broadcastEvent(eventType, packetData);
      }
    } catch (error) {
      // Silently ignore decode errors for unknown packet types
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("Unknown key")) {
        logger.debug(
          "[HyperscapeService] Failed to decode message:",
          errorMessage,
        );
      }
    }
  }

  /**
   * Get packet name from packet ID
   * Delegates to shared packets.ts - the single source of truth for packet ordering
   */
  private getPacketName(id: number): string | null {
    try {
      const name = sharedGetPacketName(id);
      if (name) {
        return name;
      }
    } catch (error) {
      if (!loggedPacketNameFallbackWarning) {
        loggedPacketNameFallbackWarning = true;
        logger.warn(
          `[HyperscapeService] Shared packet name lookup failed, using fallback registry`,
        );
      }
    }

    return FALLBACK_PACKET_NAMES[id] ?? null;
  }

  /**
   * Normalize position to [x, y, z] array format
   * Handles both array [x, y, z] and object {x, y, z} formats from server
   * Returns null if position cannot be normalized
   *
   * NOTE: For hot paths (frequent calls), use normalizePositionInPlace which reuses a temp array
   */
  private normalizePosition(pos: unknown): [number, number, number] | null {
    if (Array.isArray(pos) && pos.length >= 3) {
      return [pos[0], pos[1], pos[2]];
    }
    if (pos && typeof pos === "object" && "x" in pos) {
      const objPos = pos as { x: number; y?: number; z: number };
      // Handle both {x, y, z} and {x, z} (no y) formats
      const z = "z" in objPos ? objPos.z : 0;
      return [objPos.x, objPos.y ?? 0, z];
    }
    return null;
  }

  /**
   * Normalize position IN PLACE using pre-allocated temp array
   * Use this for hot paths to avoid GC pressure
   * Returns the _tempPosition array (reused) or null if invalid
   * WARNING: The returned array is reused - copy values if you need to store them!
   */
  private normalizePositionInPlace(
    pos: unknown,
  ): [number, number, number] | null {
    if (Array.isArray(pos) && pos.length >= 3) {
      _tempPosition[0] = pos[0];
      _tempPosition[1] = pos[1];
      _tempPosition[2] = pos[2];
      return _tempPosition;
    }
    if (pos && typeof pos === "object" && "x" in pos) {
      const objPos = pos as { x: number; y?: number; z: number };
      _tempPosition[0] = objPos.x;
      _tempPosition[1] = objPos.y ?? 0;
      _tempPosition[2] = "z" in objPos ? objPos.z : 0;
      return _tempPosition;
    }
    return null;
  }

  /**
   * Ensure critical player fields always exist, even when server payloads are partial.
   * This prevents action/provider crashes during spawn and incremental state updates.
   */
  private ensurePlayerEntityDefaults(): void {
    const player = this.gameState.playerEntity as
      | (Partial<PlayerEntity> & { maxHealth?: number; maxStamina?: number })
      | null;

    if (!player) return;

    const health = player.health as
      | { current?: unknown; max?: unknown }
      | number
      | undefined;
    const currentHealth =
      typeof health === "object" && typeof health?.current === "number"
        ? health.current
        : typeof health === "number"
          ? health
          : 100;
    const maxHealth =
      typeof health === "object" && typeof health?.max === "number"
        ? health.max
        : typeof player.maxHealth === "number"
          ? player.maxHealth
          : 100;
    player.health = { current: currentHealth, max: maxHealth };

    const stamina = player.stamina as
      | { current?: unknown; max?: unknown }
      | number
      | undefined;
    const currentStamina =
      typeof stamina === "object" && typeof stamina?.current === "number"
        ? stamina.current
        : typeof stamina === "number"
          ? stamina
          : 100;
    const maxStamina =
      typeof stamina === "object" && typeof stamina?.max === "number"
        ? stamina.max
        : typeof player.maxStamina === "number"
          ? player.maxStamina
          : 100;
    player.stamina = { current: currentStamina, max: maxStamina };

    if (!Array.isArray(player.items)) {
      player.items = [];
    }

    if (typeof player.coins !== "number") {
      player.coins = 0;
    }

    if (player.alive === undefined || player.alive === null) {
      player.alive = true;
    }

    if (typeof player.inCombat !== "boolean") {
      player.inCombat = false;
    }

    if (player.combatTarget === undefined) {
      player.combatTarget = null;
    }
  }

  // Static abbreviation map - no need to recreate each call
  private static readonly ENTITY_ABBREVIATIONS: Record<string, string> = {
    p: "position",
    v: "velocity",
    q: "quaternion",
    e: "emote",
  };

  /**
   * Translate abbreviated entity property names from server to full names
   * Server sends: p (position), v (velocity), q (quaternion), e (emote)
   * Plugin expects: position, velocity, quaternion, emote
   *
   * NOTE: Uses pre-allocated temp object to avoid GC pressure.
   * The returned object is REUSED - copy values if you need to store them!
   */
  private translateEntityChanges(
    changes: Record<string, unknown>,
  ): Record<string, unknown> {
    // Clear the temp object for reuse
    for (const key in _tempTranslated) {
      delete _tempTranslated[key];
    }

    for (const [key, value] of Object.entries(changes)) {
      const fullName = HyperscapeService.ENTITY_ABBREVIATIONS[key] || key;
      _tempTranslated[fullName] = value;
    }

    return _tempTranslated;
  }

  /**
   * Convert packet name to event type
   */
  private packetNameToEventType(packetName: string): EventType | null {
    const mapping: Record<string, EventType> = {
      entityAdded: "ENTITY_JOINED",
      entityModified: "ENTITY_UPDATED",
      entityRemoved: "ENTITY_LEFT",
      inventoryUpdated: "INVENTORY_UPDATED",
      skillsUpdated: "SKILLS_UPDATED",
      chatAdded: "CHAT_MESSAGE",
    };
    return mapping[packetName] || null;
  }

  /**
   * Handle snapshot packet - auto-select character and enter world
   *
   * IMPORTANT: Agents get their characterId from settings (set when agent is created).
   * They don't need to rely on the snapshot's character list - they can enter directly.
   */
  private async handleSnapshot(snapshotData: any): Promise<void> {
    try {
      logger.info("[HyperscapeService] Processing snapshot...");

      // Extract and store world map data (towns + POIs) from snapshot
      if (snapshotData?.worldMap) {
        this.gameState.worldMap = snapshotData.worldMap;
        const townCount = snapshotData.worldMap.towns?.length ?? 0;
        const poiCount = snapshotData.worldMap.pois?.length ?? 0;
        logger.info(
          `[HyperscapeService] 🗺️ Loaded world map: ${townCount} towns, ${poiCount} POIs`,
        );
      }

      const livekit = snapshotData?.livekit as
        | { wsUrl?: string; token?: string }
        | undefined;
      if (livekit?.wsUrl && livekit?.token) {
        await this.liveKit?.connect({
          wsUrl: livekit.wsUrl,
          token: livekit.token,
        });
      }

      // CRITICAL FIX: If we already have a characterId from settings, use it directly
      // Don't wait for snapshot to include the character - the server JWT auth already
      // verified our identity, we just need to tell it which character to spawn
      if (this.characterId) {
        logger.info(
          `[HyperscapeService] ✅ Using characterId from settings: ${this.characterId}`,
        );

        // Detect if this is a duel bot (auto-accept duels = duel bot behaviour)
        const isDuelBot =
          this.runtime.getSetting("HYPERSCAPE_AUTO_ACCEPT_DUELS") === "true";
        const botName = this.runtime.character?.name;

        // Wait a moment for server to be ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Send character selected packet
        this.sendBinaryPacket("characterSelected", {
          characterId: this.characterId,
        });
        logger.info(
          `[HyperscapeService] 📤 Sent characterSelected: ${this.characterId}`,
        );

        // Wait a moment before entering world
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Send enter world packet — include duelBot flag so server skips DB lookup
        this.sendBinaryPacket("enterWorld", {
          characterId: this.characterId,
          ...(isDuelBot
            ? { duelBot: true, botName: botName || this.characterId }
            : {}),
        });
        logger.info(
          `[HyperscapeService] 🚪 Sent enterWorld: ${this.characterId}${isDuelBot ? " (duelBot)" : ""}`,
        );

        logger.info(
          `[HyperscapeService] ✅ Auto-join complete! Agent should spawn with characterId: ${this.characterId}`,
        );
        return;
      }

      // Fallback: No characterId in settings, try to use snapshot characters
      // (This path is for human players or agents without pre-configured characterId)
      const characters = snapshotData?.characters || [];
      logger.info(
        `[HyperscapeService] No characterId in settings, checking snapshot: ${characters.length} character(s)`,
      );

      if (characters.length === 0) {
        logger.warn(
          "[HyperscapeService] ⚠️ No characterId in settings AND no characters in snapshot - agent cannot enter world!",
        );
        return;
      }

      // Use first character from snapshot as fallback
      const selectedCharacter = characters[0];
      logger.info(
        `[HyperscapeService] Using first character from snapshot: ${selectedCharacter.name} (${selectedCharacter.id})`,
      );

      // Wait a moment for server to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send character selected packet
      this.sendBinaryPacket("characterSelected", {
        characterId: selectedCharacter.id,
      });
      logger.info(
        `[HyperscapeService] 📤 Sent characterSelected: ${selectedCharacter.id}`,
      );

      // Wait a moment before entering world
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send enter world packet
      this.sendBinaryPacket("enterWorld", {
        characterId: selectedCharacter.id,
      });
      logger.info(
        `[HyperscapeService] 🚪 Sent enterWorld: ${selectedCharacter.id}`,
      );

      logger.info(
        `[HyperscapeService] ✅ Auto-join complete! Agent should spawn as ${selectedCharacter.name}`,
      );
    } catch (error) {
      logger.error(
        "[HyperscapeService] Failed to auto-join world:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Update game state from binary packet
   */
  private updateGameStateFromPacket(packetName: string, data: any): void {
    switch (packetName) {
      case "entityAdded":
        // Check if this is the agent's player entity
        logger.debug(
          `[HyperscapeService] 📦 entityAdded - entityId: ${data?.id}, characterId: ${this.characterId}, match: ${data?.id === this.characterId}`,
        );
        if (data && data.id === this.characterId) {
          this.gameState.playerEntity = data as PlayerEntity;
          const wsId = (this.ws as any).__wsId || "unknown";
          logger.info(
            `[HyperscapeService] 🎮 Player entity spawned: ${data.id} on WebSocket ${wsId}, runtime: ${this.runtime.agentId}`,
          );

          // Normalize health to { current, max } format
          // Server sends flat format: { health: number, maxHealth: number }
          const healthData = data as {
            health?: number | { current?: number; max?: number };
            maxHealth?: number;
            hp?: number;
            maxHp?: number;
          };

          let normalizedHealth: { current: number; max: number } = {
            current: 100,
            max: 100,
          };

          if (typeof healthData.health === "number") {
            // Flat format: health = current value, maxHealth = max value
            normalizedHealth = {
              current: healthData.health,
              max: healthData.maxHealth ?? 100,
            };
          } else if (
            typeof healthData.health === "object" &&
            healthData.health
          ) {
            // Nested format: health = { current, max }
            normalizedHealth = {
              current: healthData.health.current ?? 100,
              max: healthData.health.max ?? 100,
            };
          } else if (healthData.hp !== undefined) {
            // Alternative format: hp/maxHp
            normalizedHealth = {
              current: healthData.hp,
              max: healthData.maxHp ?? 100,
            };
          }

          this.gameState.playerEntity.health = normalizedHealth;
          logger.info(
            `[HyperscapeService] 🏥 Health on spawn: ${normalizedHealth.current}/${normalizedHealth.max}`,
          );

          // Normalize position to [x, y, z] array format if present
          const normalizedPos = this.normalizePosition(data.position);
          if (normalizedPos) {
            this.gameState.playerEntity.position = normalizedPos;
            logger.info(
              `[HyperscapeService] Position available on spawn: [${normalizedPos[0].toFixed(0)}, ${normalizedPos[2].toFixed(0)}], starting autonomous exploration`,
            );
            this.startAutonomousExploration();
          } else {
            logger.info(
              `[HyperscapeService] Waiting for position before starting autonomous exploration (raw position: ${JSON.stringify(data.position)})`,
            );
          }
        } else if (data && data.id) {
          // Debug: Log mob entity additions with position info
          const entityData = data as Record<string, unknown>;
          const isMob =
            entityData.mobType ||
            entityData.type === "mob" ||
            /goblin/i.test(String(entityData.name || ""));

          // Check if we already have this entity with a valid position
          const existingEntity = this.gameState.nearbyEntities.get(data.id);
          const existingPos = existingEntity?.position as unknown;

          // Helper to check if position is valid (not at origin 0,0)
          const isValidPosition = (pos: unknown): boolean => {
            if (Array.isArray(pos) && pos.length >= 3) {
              return pos[0] !== 0 || pos[2] !== 0;
            }
            if (pos && typeof pos === "object") {
              const objPos = pos as { x?: number; z?: number };
              return (
                objPos.x !== undefined &&
                objPos.z !== undefined &&
                (objPos.x !== 0 || objPos.z !== 0)
              );
            }
            return false;
          };

          const hasExistingValidPos = isValidPosition(existingPos);
          const incomingPos = entityData.position;
          const hasIncomingValidPos = isValidPosition(incomingPos);

          if (isMob) {
            // Disabled verbose mob logging - use debug level if needed
            // logger.debug(`[HyperscapeService] MOB ADDED: "${entityData.name}" id=${data.id}`);
          } else {
            logger.debug(
              `[HyperscapeService] Entity ${data.id} added (not our player)`,
            );
          }

          // CRITICAL FIX: If we have existing valid position but incoming has (0,0), preserve existing
          // This prevents respawn from overwriting good mob position data with stale/default positions
          if (existingEntity && hasExistingValidPos && !hasIncomingValidPos) {
            // Merge incoming data but preserve our known good position
            const mergedEntity = { ...data, position: existingPos } as Entity;
            this.gameState.nearbyEntities.set(data.id, mergedEntity);
            // Disabled verbose mob logging
            // if (isMob) {
            //   logger.debug(`[HyperscapeService] MOB PRESERVED POSITION: "${entityData.name}"`);
            // }
          } else {
            this.gameState.nearbyEntities.set(data.id, data as Entity);
          }
        }
        break;

      case "entityModified":
        // Update player or nearby entity
        if (
          data &&
          data.id === this.characterId &&
          this.gameState.playerEntity
        ) {
          const changes = data.changes || data;
          // Translate abbreviated property names from server to full names
          // Server sends: p (position), v (velocity), q (quaternion), e (emote)
          const translatedChanges = this.translateEntityChanges(changes);
          Object.assign(this.gameState.playerEntity, translatedChanges);

          // Normalize position to [x, y, z] array format if it was updated
          // Use in-place update to avoid allocation when possible
          if (translatedChanges.position) {
            const normalizedPos = updatePositionInPlace(
              this.gameState.playerEntity.position as
                | [number, number, number]
                | null,
              translatedChanges.position,
            );
            if (normalizedPos) {
              this.gameState.playerEntity.position = normalizedPos;
              logger.info(
                `[HyperscapeService] 📍 Player position updated: [${normalizedPos[0].toFixed(0)}, ${normalizedPos[2].toFixed(0)}]`,
              );
            }
          }
        } else if (data && data.id) {
          const changes = data.changes || data;
          const translatedChanges = this.translateEntityChanges(changes);
          const entity = this.gameState.nearbyEntities.get(data.id);
          if (entity) {
            // Debug: Log mob position updates
            const entityAny = entity as unknown as Record<string, unknown>;
            const isMob =
              entityAny.mobType ||
              entityAny.type === "mob" ||
              /goblin/i.test(String(entity.name || ""));
            // Disabled verbose mob position logging
            // if (isMob && translatedChanges.position) {
            //   logger.debug(`[HyperscapeService] MOB POSITION UPDATE: "${entity.name}" id=${data.id}`);
            // }
            Object.assign(entity, translatedChanges);
          }
        }
        break;

      case "entityRemoved": {
        // Get the entity ID - packet may send just ID string or {id: string}
        const entityId = typeof data === "string" ? data : data?.id;
        if (entityId) {
          // Save entity data BEFORE deletion for the event handler
          const removedEntity = this.gameState.nearbyEntities.get(entityId);
          this.gameState.nearbyEntities.delete(entityId);

          // Store the removed entity in a temporary property for the broadcast
          // We need to store it somewhere handlers can access since we can't
          // modify primitive string data
          if (removedEntity) {
            this._lastRemovedEntity = removedEntity;
          }
        }
        break;
      }

      case "inventoryUpdated":
        if (this.gameState.playerEntity && data) {
          Object.assign(this.gameState.playerEntity, data);
          const invData = data as { items?: unknown[] };
          logger.info(
            `[HyperscapeService] 📦 Inventory updated: ${invData.items?.length || 0} items`,
          );
        }
        break;

      case "skillsUpdated":
        if (this.gameState.playerEntity && data) {
          Object.assign(this.gameState.playerEntity, data);
        }
        break;

      case "equipmentUpdated":
        // Handle equipment changes (equip/unequip items)
        if (this.gameState.playerEntity && data) {
          const equipData = data as { playerId?: string; equipment?: unknown };
          if (equipData.equipment) {
            this.gameState.playerEntity.equipment =
              equipData.equipment as typeof this.gameState.playerEntity.equipment;
            logger.info(
              `[HyperscapeService] ⚔️ Equipment updated: ${JSON.stringify(equipData.equipment)}`,
            );
          }
        }
        break;

      case "playerUpdated":
      case "playerState":
        // Handle player position/state updates
        if (this.gameState.playerEntity && data) {
          // Check if we had a valid position before this update (non-allocating check)
          const hadPositionBefore = hasValidPositionData(
            this.gameState.playerEntity.position,
          );

          // Normalize and update position if present (in-place to avoid allocation)
          if (data.position) {
            const normalizedPos = updatePositionInPlace(
              this.gameState.playerEntity.position as
                | [number, number, number]
                | null,
              data.position,
            );
            if (normalizedPos) {
              this.gameState.playerEntity.position = normalizedPos;
              logger.info(
                `[HyperscapeService] 📍 Player position via ${packetName}: [${normalizedPos[0].toFixed(0)}, ${normalizedPos[2].toFixed(0)}]`,
              );

              // Start autonomous exploration if this is the first position and not already running
              if (!hadPositionBefore && !this.isAutonomousBehaviorRunning()) {
                logger.info(
                  `[HyperscapeService] First position received, starting autonomous exploration`,
                );
                this.startAutonomousExploration();
              }
            } else {
              logger.warn(
                `[HyperscapeService] Could not normalize position: ${JSON.stringify(data.position)}`,
              );
            }
          }

          // Copy other state, but preserve our normalized position and health format
          const savedPosition = this.gameState.playerEntity.position;
          const savedHealth = this.gameState.playerEntity.health;

          // Parse incoming health data - server sends flat format: { health: number, maxHealth: number }
          const healthData = data as {
            health?: number | { current?: number; max?: number };
            maxHealth?: number;
            hp?: number;
            maxHp?: number;
          };

          // Normalize health to the expected { current, max } format
          let normalizedHealth = savedHealth || { current: 100, max: 100 };

          if (typeof healthData.health === "number") {
            // Server sends flat format: health = current value, maxHealth = max value
            normalizedHealth = {
              current: healthData.health,
              max: healthData.maxHealth ?? savedHealth?.max ?? 100,
            };
            logger.info(
              `[HyperscapeService] 🏥 Health update via ${packetName}: ${normalizedHealth.current}/${normalizedHealth.max}`,
            );
          } else if (
            typeof healthData.health === "object" &&
            healthData.health
          ) {
            // Nested format: health = { current, max }
            normalizedHealth = {
              current: healthData.health.current ?? savedHealth?.current ?? 100,
              max: healthData.health.max ?? savedHealth?.max ?? 100,
            };
            logger.info(
              `[HyperscapeService] 🏥 Health update via ${packetName}: ${normalizedHealth.current}/${normalizedHealth.max}`,
            );
          } else if (healthData.hp !== undefined) {
            // Alternative format: hp/maxHp
            normalizedHealth = {
              current: healthData.hp,
              max: healthData.maxHp ?? savedHealth?.max ?? 100,
            };
            logger.info(
              `[HyperscapeService] 🏥 Health update via ${packetName}: ${normalizedHealth.current}/${normalizedHealth.max}`,
            );
          }

          // Copy data but exclude health (we'll set it properly after)
          const {
            health: _h,
            maxHealth: _mh,
            hp: _hp,
            maxHp: _mhp,
            ...otherData
          } = data as Record<string, unknown>;
          Object.assign(this.gameState.playerEntity, otherData);

          // Restore normalized position and health
          if (savedPosition) {
            this.gameState.playerEntity.position = savedPosition;
          }
          this.gameState.playerEntity.health = normalizedHealth;
        }
        break;

      case "goalOverride":
        // Handle manual goal override from dashboard
        this.handleGoalOverride(data);
        break;

      // Tile movement packets (RuneScape-style 600ms tick movement)
      case "tileMovementStart": {
        // Movement started - update position tracking
        // Packet contains: { id, startTile, path, running, destinationTile, moveSeq, emote }
        const moveData = data as {
          id?: string;
          startTile?: { x: number; z: number };
          path?: Array<{ x: number; z: number }>;
          running?: boolean;
          destinationTile?: { x: number; z: number };
        };

        if (moveData.id === this.characterId && this.gameState.playerEntity) {
          // Check if we had a valid position before this update (non-allocating)
          const hadPositionBefore = hasValidPositionData(
            this.gameState.playerEntity.position,
          );

          // Update player's movement state
          if (moveData.startTile) {
            // Convert tile {x, z} to world position [x, y, z] - update in place
            const existingPos = this.gameState.playerEntity.position as
              | [number, number, number]
              | null;
            const currentY = existingPos ? existingPos[1] : 0;
            const updatedPos = updatePositionInPlace(existingPos, {
              x: moveData.startTile.x,
              y: currentY,
              z: moveData.startTile.z,
            });
            if (updatedPos) {
              this.gameState.playerEntity.position = updatedPos;
            }

            // Start autonomous exploration if this is the first position
            if (!hadPositionBefore && !this.isAutonomousBehaviorRunning()) {
              logger.info(
                `[HyperscapeService] First position via tileMovementStart: [${moveData.startTile.x}, ${moveData.startTile.z}], starting autonomous exploration`,
              );
              this.startAutonomousExploration();
            }
          }
          logger.debug(
            `[HyperscapeService] 🚶 Tile movement started: ${moveData.path?.length || 0} tiles, running: ${moveData.running}`,
          );
        } else if (moveData.id) {
          // Update nearby entity - update in place
          const entity = this.gameState.nearbyEntities.get(moveData.id);
          if (entity && moveData.startTile) {
            const existingPos = entity.position as
              | [number, number, number]
              | null;
            const currentY = existingPos?.[1] || 0;
            const updatedPos = updatePositionInPlace(existingPos, {
              x: moveData.startTile.x,
              y: currentY,
              z: moveData.startTile.z,
            });
            if (updatedPos) {
              entity.position = updatedPos;
            }
          }
        }
        break;
      }

      case "entityTileUpdate": {
        // Entity position sync during tile movement
        // Packet contains: { id, tile, worldPos, emote, quaternion, tickNumber, moveSeq }
        const tileData = data as {
          id?: string;
          tile?: { x: number; z: number };
          worldPos?: [number, number, number];
        };

        if (tileData.id === this.characterId && this.gameState.playerEntity) {
          if (tileData.worldPos) {
            // worldPos is already [x, y, z] tuple - update in place
            const updatedPos = updatePositionInPlace(
              this.gameState.playerEntity.position as
                | [number, number, number]
                | null,
              tileData.worldPos,
            );
            if (updatedPos) {
              this.gameState.playerEntity.position = updatedPos;
            }
            logger.debug(
              `[HyperscapeService] 📍 Tile update: [${tileData.worldPos[0].toFixed(0)}, ${tileData.worldPos[2].toFixed(0)}]`,
            );
          }
        } else if (tileData.id) {
          const entity = this.gameState.nearbyEntities.get(tileData.id);
          if (entity && tileData.worldPos) {
            // Update in place to avoid allocation
            const updatedPos = updatePositionInPlace(
              entity.position as [number, number, number] | null,
              tileData.worldPos,
            );
            if (updatedPos) {
              entity.position = updatedPos;
            }
          }
        }
        break;
      }

      case "tileMovementEnd": {
        // Movement completed - entity arrived at destination
        // Packet contains: { id, tile, worldPos }
        const endData = data as {
          id?: string;
          tile?: { x: number; z: number };
          worldPos?: [number, number, number];
        };

        if (endData.id === this.characterId && this.gameState.playerEntity) {
          if (endData.worldPos) {
            // worldPos is already [x, y, z] tuple - update in place
            const updatedPos = updatePositionInPlace(
              this.gameState.playerEntity.position as
                | [number, number, number]
                | null,
              endData.worldPos,
            );
            if (updatedPos) {
              this.gameState.playerEntity.position = updatedPos;
            }
          }
          logger.debug(
            `[HyperscapeService] 🏁 Tile movement ended at tile (${endData.tile?.x}, ${endData.tile?.z})`,
          );
        } else if (endData.id) {
          const entity = this.gameState.nearbyEntities.get(endData.id);
          if (entity && endData.worldPos) {
            const updatedPos = updatePositionInPlace(
              entity.position as [number, number, number] | null,
              endData.worldPos,
            );
            if (updatedPos) {
              entity.position = updatedPos;
            }
          }
        }
        break;
      }

      case "resourceDepleted": {
        // Resource became depleted - update entity's depleted status
        // Packet contains: { resourceId, position, depleted: true }
        const depletedData = data as {
          resourceId?: string;
          position?: [number, number, number];
          depleted?: boolean;
        };

        if (depletedData.resourceId) {
          // Find entity by resourceId - the entity ID should match resourceId
          const entity = this.gameState.nearbyEntities.get(
            depletedData.resourceId,
          );
          if (entity) {
            // Set depleted flag on the entity
            (entity as unknown as Record<string, unknown>).depleted = true;
            logger.info(
              `[HyperscapeService] 🌲 Resource depleted: ${entity.name || depletedData.resourceId}`,
            );
          } else {
            // Entity might have a different ID format - search by matching position or name
            for (const [id, ent] of this.gameState.nearbyEntities) {
              const entAny = ent as unknown as Record<string, unknown>;
              if (entAny.resourceId === depletedData.resourceId) {
                entAny.depleted = true;
                logger.info(
                  `[HyperscapeService] 🌲 Resource depleted (by resourceId): ${ent.name || id}`,
                );
                break;
              }
            }
          }
        }
        break;
      }

      case "resourceRespawned": {
        // Resource respawned - update entity's depleted status
        // Packet contains: { resourceId, position, depleted: false }
        const respawnedData = data as {
          resourceId?: string;
          position?: [number, number, number];
          depleted?: boolean;
        };

        if (respawnedData.resourceId) {
          // Find entity by resourceId
          const entity = this.gameState.nearbyEntities.get(
            respawnedData.resourceId,
          );
          if (entity) {
            (entity as unknown as Record<string, unknown>).depleted = false;
            logger.info(
              `[HyperscapeService] 🌳 Resource respawned: ${entity.name || respawnedData.resourceId}`,
            );
          } else {
            // Search by resourceId property
            for (const [id, ent] of this.gameState.nearbyEntities) {
              const entAny = ent as unknown as Record<string, unknown>;
              if (entAny.resourceId === respawnedData.resourceId) {
                entAny.depleted = false;
                logger.info(
                  `[HyperscapeService] 🌳 Resource respawned (by resourceId): ${ent.name || id}`,
                );
                break;
              }
            }
          }
        }
        break;
      }

      case "combatDamageDealt": {
        // Combat damage dealt - track combat state (health comes from playerUpdated/playerState)
        // Packet contains: { attackerId, targetId, damage, targetType, position }
        // NOTE: We do NOT update health here - the server sends authoritative health via
        // playerUpdated/playerState packets. Calculating health locally from damage can
        // cause race conditions where 0-damage (miss) packets reset health to 100.
        const damageData = data as {
          attackerId?: string;
          targetId?: string;
          damage?: number;
          targetType?: "player" | "mob";
        };

        // Check if we are the target taking damage
        if (
          damageData.targetId === this.characterId &&
          damageData.targetType === "player" &&
          damageData.damage !== undefined &&
          this.gameState.playerEntity
        ) {
          // Mark player as in combat (this is the key state we need)
          (
            this.gameState.playerEntity as unknown as { inCombat: boolean }
          ).inCombat = true;

          // Log damage for debugging (health will be updated by playerUpdated/playerState)
          const currentHealth =
            this.gameState.playerEntity.health?.current ?? "?";
          const maxHealth = this.gameState.playerEntity.health?.max ?? "?";
          logger.info(
            `[HyperscapeService] ⚔️ DAMAGE TAKEN: ${damageData.damage} damage from ${damageData.attackerId}! (current health: ${currentHealth}/${maxHealth})`,
          );
        } else if (damageData.attackerId === this.characterId) {
          // We dealt damage to something
          logger.info(
            `[HyperscapeService] ⚔️ DAMAGE DEALT: ${damageData.damage} damage to ${damageData.targetId}`,
          );
        }
        break;
      }

      // ============================================================================
      // QUEST SYSTEM PACKETS
      // ============================================================================

      case "questList": {
        const questListData = data as {
          quests?: Array<{
            id: string;
            name: string;
            status: string;
            difficulty: string;
            questPoints: number;
          }>;
          questPoints?: number;
        };
        if (questListData.quests && Array.isArray(questListData.quests)) {
          this.gameState.quests = questListData.quests.map((q) => ({
            questId: q.id,
            name: q.name,
            status: q.status,
            description: "",
          }));
          logger.info(
            `[HyperscapeService] 📜 Quest list received: ${questListData.quests.length} quests`,
          );
        }
        break;
      }

      case "questStartConfirm": {
        const confirmData = data as { questId?: string; questName?: string };
        logger.info(
          `[HyperscapeService] 📜 Quest start confirm: ${confirmData.questName || confirmData.questId}`,
        );
        this.sendCommand("questAccept", { questId: confirmData.questId });
        break;
      }

      case "questStarted": {
        const startedData = data as { questId?: string; questName?: string };
        if (startedData.questId) {
          const existing = this.gameState.quests.find(
            (q) => q.questId === startedData.questId,
          );
          if (existing) {
            existing.status = "in_progress";
          } else {
            this.gameState.quests.push({
              questId: startedData.questId,
              name: startedData.questName,
              status: "in_progress",
            });
          }
          logger.info(
            `[HyperscapeService] 📜 Quest started: ${startedData.questName || startedData.questId}`,
          );
        }
        this.requestQuestList();
        break;
      }

      case "questProgressed": {
        const progressData = data as {
          questId?: string;
          stage?: string;
          progress?: Record<string, number>;
          description?: string;
        };
        if (progressData.questId) {
          const existing = this.gameState.quests.find(
            (q) => q.questId === progressData.questId,
          );
          if (existing) {
            existing.stageProgress = progressData.progress;
            existing.description =
              progressData.description || existing.description;
          }
          logger.info(
            `[HyperscapeService] 📜 Quest progressed: ${progressData.questId} - ${progressData.description || ""}`,
          );
        }
        break;
      }

      case "questCompleted": {
        const completedData = data as {
          questId?: string;
          questName?: string;
        };
        if (completedData.questId) {
          const idx = this.gameState.quests.findIndex(
            (q) => q.questId === completedData.questId,
          );
          if (idx >= 0) {
            this.gameState.quests.splice(idx, 1);
          }
          logger.info(
            `[HyperscapeService] 📜 Quest completed: ${completedData.questName || completedData.questId}`,
          );
        }
        this.requestQuestList();
        break;
      }

      // ============================================================================
      // DUEL SYSTEM PACKETS
      // ============================================================================

      case "duelChallengeIncoming": {
        // Incoming duel challenge from another player
        // Packet contains: { challengeId, challengerId, challengerName, challengerCombatLevel }
        const challengeData = data as {
          challengeId?: string;
          challengerId?: string;
          challengerName?: string;
          challengerCombatLevel?: number;
        };

        if (challengeData.challengeId && challengeData.challengerId) {
          this.setPendingDuelChallenge({
            challengeId: challengeData.challengeId,
            challengerId: challengeData.challengerId,
            challengerName: challengeData.challengerName || "Unknown",
            challengerCombatLevel: challengeData.challengerCombatLevel || 0,
            expiresAt: Date.now() + 30000, // 30 second timeout
          });
        }
        break;
      }

      case "duelChallengeDeclined":
      case "duelChallengeSent":
      case "duelError": {
        // Clear pending challenge state on decline/error
        this.clearPendingDuelChallenge();
        break;
      }

      case "duelSessionStarted": {
        // Duel session started - both players accepted, entering rules screen
        // Agent should now be in a duel session
        logger.info(
          `[HyperscapeService] ⚔️ Duel session started - entering duel interface`,
        );
        this.clearPendingDuelChallenge();
        break;
      }

      case "duelFightStart": {
        // Duel countdown finished, fight begins
        const duelData = data as any;
        logger.info(
          `[HyperscapeService] ⚔️ Duel fight started: ${duelData.duelId}`,
        );
        this.broadcastEvent("DUEL_FIGHT_START", duelData);
        break;
      }

      case "duelCompleted": {
        // Duel finished, winner determined
        const duelData = data as any;
        logger.info(
          `[HyperscapeService] ⚔️ Duel completed: ${duelData.duelId} (winner: ${duelData.winnerId})`,
        );
        this.broadcastEvent("DUEL_COMPLETED", duelData);
        // Clear pending challenge state just in case
        this.clearPendingDuelChallenge();
        break;
      }
    }

    this.ensurePlayerEntityDefaults();
    this.gameState.lastUpdate = Date.now();
  }

  /**
   * Update cached game state based on incoming events
   */
  private updateGameState(event: NetworkEvent): void {
    switch (event.type as string) {
      case "PLAYER_JOINED":
      case "PLAYER_SPAWNED":
        // Update player entity if it's the agent's player
        const playerData = event.data as { playerId?: string };
        if (playerData && playerData.playerId === this.runtime?.agentId) {
          this.gameState.playerEntity = event.data as PlayerEntity;
        }
        break;

      case "ENTITY_JOINED":
      case "ENTITY_UPDATED":
        // Update nearby entities
        const entityData = event.data as { id?: string };
        if (entityData && entityData.id) {
          this.gameState.nearbyEntities.set(
            entityData.id,
            event.data as Entity,
          );
        }
        break;

      case "ENTITY_LEFT":
        // Remove entity from nearby
        const leftEntityData = event.data as { id?: string };
        if (leftEntityData && leftEntityData.id) {
          this.gameState.nearbyEntities.delete(leftEntityData.id);
        }
        break;

      case "INVENTORY_UPDATED":
      case "SKILLS_UPDATED":
      case "PLAYER_EQUIPMENT_CHANGED":
        // Update player entity with new data
        if (this.gameState.playerEntity && event.data) {
          Object.assign(this.gameState.playerEntity, event.data);
        }
        break;

      case "questUpdate":
        const questUpdateData = event.data as { quests?: any[] };
        if (questUpdateData.quests && Array.isArray(questUpdateData.quests)) {
          this.gameState.quests = questUpdateData.quests;
          logger.info(
            `[HyperscapeService] 📜 Received quest update: ${questUpdateData.quests.length} active quests`,
          );
        }
        break;

      case "questAccepted":
      case "questCompleted":
        // Server typically sends a full questUpdate shortly after,
        // but we can log these specific events
        const questEventData = event.data as { questId?: string };
        logger.info(
          `[HyperscapeService] 📜 Quest event: ${event.type} - ${questEventData.questId || "unknown"}`,
        );
        break;
    }

    this.ensurePlayerEntityDefaults();
    this.gameState.lastUpdate = Date.now();
  }

  /**
   * Broadcast event to registered handlers
   */
  private broadcastEvent(eventType: EventType, data: unknown): void {
    // Store in log buffer
    this.logBuffer.unshift({
      timestamp: Date.now(),
      type: eventType,
      data,
    });

    // Keep buffer size limited
    if (this.logBuffer.length > 100) {
      this.logBuffer.pop();
    }

    const handlers = this.eventHandlers.get(eventType);
    if (handlers && handlers.length > 0) {
      // Debug: Log ENTITY_LEFT broadcasts
      if (eventType === "ENTITY_LEFT") {
        logger.info(
          `[HyperscapeService] 📢 Broadcasting ENTITY_LEFT to ${handlers.length} handler(s)`,
        );
      }
      for (const handler of handlers) {
        try {
          const result = handler(data);
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch((error) => {
              logger.error(
                `[HyperscapeService] Async event handler error for ${eventType}:`,
                error instanceof Error ? error.message : String(error),
              );
            });
          }
        } catch (error) {
          logger.error(
            `[HyperscapeService] Event handler error for ${eventType}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } else if (eventType === "ENTITY_LEFT") {
      logger.warn(
        `[HyperscapeService] ⚠️ ENTITY_LEFT event but no handlers registered!`,
      );
    }
  }

  /**
   * Register event handler
   */
  onGameEvent(
    eventType: EventType,
    handler: (data: unknown) => void | Promise<void>,
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  offGameEvent(
    eventType: EventType,
    handler: (data: unknown) => void | Promise<void>,
  ): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get current player entity
   */
  getPlayerEntity(): PlayerEntity | null {
    this.ensurePlayerEntityDefaults();
    return this.gameState.playerEntity;
  }

  /**
   * Get nearby entities
   */
  getNearbyEntities(): Entity[] {
    return Array.from(this.gameState.nearbyEntities.values());
  }

  /**
   * Get the last removed entity (for ENTITY_LEFT handlers)
   * This is set before the entity is removed from the cache and cleared after broadcast
   */
  getLastRemovedEntity(): Entity | null {
    const entity = this._lastRemovedEntity;
    this._lastRemovedEntity = null; // Clear after reading
    return entity;
  }

  /**
   * Get complete game state
   */
  getGameState(): GameStateCache {
    return { ...this.gameState };
  }

  /**
   * Get the autonomous behavior manager
   * Used by actions to access/update goals
   */
  getBehaviorManager(): AutonomousBehaviorManager | null {
    return this.autonomousBehaviorManager;
  }

  /**
   * Start autonomous behavior (full ElizaOS decision loop)
   * Called automatically when player spawns, but can also be called manually
   */
  startAutonomousBehavior(): void {
    if (!this.autonomousBehaviorEnabled) {
      logger.info("[HyperscapeService] Autonomous behavior is disabled");
      return;
    }

    if (this.autonomousBehaviorManager?.running) {
      logger.debug("[HyperscapeService] Autonomous behavior already running");
      return;
    }

    if (!this.runtime) {
      logger.warn(
        "[HyperscapeService] No runtime, cannot start autonomous behavior",
      );
      return;
    }

    // Register event handlers if not already registered
    // This ensures kill tracking and other game event handling is set up
    if (!this.pluginEventHandlersRegistered) {
      logger.info(
        "[HyperscapeService] Registering event handlers for game events...",
      );
      registerEventHandlers(this.runtime, this);
      this.pluginEventHandlersRegistered = true;
      logger.info(
        "[HyperscapeService] ✅ Event handlers registered successfully",
      );
    }

    logger.info(
      "[HyperscapeService] 🚀 Starting autonomous behavior (ElizaOS decision loop)...",
    );
    this.autonomousBehaviorManager = new AutonomousBehaviorManager(
      this.runtime,
      {
        tickInterval: 10000, // 10 seconds between decisions
        debug: false,
      },
    );
    this.autonomousBehaviorManager.start();
  }

  /**
   * Stop autonomous behavior
   */
  stopAutonomousBehavior(): void {
    if (this.autonomousBehaviorManager?.running) {
      logger.info("[HyperscapeService] 🛑 Stopping autonomous behavior...");
      this.autonomousBehaviorManager.stop();
    }
  }

  /**
   * Check if autonomous behavior is running
   */
  isAutonomousBehaviorRunning(): boolean {
    return this.autonomousBehaviorManager?.running ?? false;
  }

  /**
   * Enable or disable autonomous behavior
   */
  setAutonomousBehaviorEnabled(enabled: boolean): void {
    this.autonomousBehaviorEnabled = enabled;
    logger.info(
      `[HyperscapeService] Autonomous behavior ${enabled ? "enabled" : "disabled"}`,
    );

    if (!enabled && this.autonomousBehaviorManager?.running) {
      this.stopAutonomousBehavior();
    }
  }

  // Legacy aliases for backward compatibility
  startAutonomousExploration(): void {
    this.startAutonomousBehavior();
  }

  stopAutonomousExploration(): void {
    this.stopAutonomousBehavior();
  }

  isExplorationRunning(): boolean {
    return this.isAutonomousBehaviorRunning();
  }

  setAutonomousExplorationEnabled(enabled: boolean): void {
    this.setAutonomousBehaviorEnabled(enabled);
  }

  /**
   * Check if plugin event handlers are already registered
   */
  arePluginEventHandlersRegistered(): boolean {
    return this.pluginEventHandlersRegistered;
  }

  /**
   * Mark plugin event handlers as registered
   */
  markPluginEventHandlersRegistered(): void {
    this.pluginEventHandlersRegistered = true;
  }

  /**
   * Get recent game logs
   */
  getLogs(): Array<{ timestamp: number; type: string; data: any }> {
    return [...this.logBuffer];
  }

  /**
   * Send binary packet to server using msgpackr protocol
   */
  private sendBinaryPacket(packetName: string, data: unknown): void {
    if (!this.isConnected()) {
      throw new Error("Not connected to Hyperscape server");
    }

    // Get packet ID from name (matching packets.ts)
    const packetId = this.getPacketId(packetName);
    if (packetId === null) {
      throw new Error(`Unknown packet name: ${packetName}`);
    }

    // Debug logging for movement packets
    if (packetName === "moveRequest") {
      const wsId = (this.ws as any).__wsId || "unknown";
      logger.info(
        `[HyperscapeService] 📤 Sending ${packetName} (id: ${packetId}) via WebSocket ${wsId} - wsReady: ${this.ws?.readyState === 1}, hasPlayer: ${!!this.gameState.playerEntity}, runtime: ${this.runtime.agentId}`,
      );
    }

    // Encode as msgpackr: [packetId, data]
    const packet = packr.pack([packetId, data]);
    this.ws!.send(packet);
  }

  /**
   * Get packet ID from packet name
   * Delegates to shared packets.ts - the single source of truth for packet ordering
   */
  private getPacketId(name: string): number | null {
    try {
      const id = sharedGetPacketId(name);
      if (id !== null && id !== undefined) {
        return id;
      }
    } catch (error) {
      if (!loggedPacketIdFallbackWarning) {
        loggedPacketIdFallbackWarning = true;
        logger.warn(
          `[HyperscapeService] Shared packet ID lookup failed, using fallback registry`,
        );
      }
    }

    return FALLBACK_PACKET_IDS[name] ?? null;
  }

  /**
   * Send command to server (legacy method - now uses binary protocol)
   */
  private sendCommand(command: string, data: unknown): void {
    this.sendBinaryPacket(command, data);
  }

  /**
   * Execute movement command
   */
  async executeMove(command: MoveToCommand): Promise<void> {
    // Server rejects move requests that exceed max tile distance.
    // Clamp long jumps so autonomous/user moves are still valid.
    if (
      !command.cancel &&
      Array.isArray(command.target) &&
      command.target.length >= 3
    ) {
      const playerPos = this.normalizePosition(
        this.getPlayerEntity()?.position,
      );
      if (playerPos) {
        const dx = command.target[0] - playerPos[0];
        const dz = command.target[2] - playerPos[2];
        const distance2D = Math.hypot(dx, dz);
        const MAX_MOVE_DISTANCE = 180; // Keep under server hard limit (200) with margin

        if (Number.isFinite(distance2D) && distance2D > MAX_MOVE_DISTANCE) {
          const ratio = MAX_MOVE_DISTANCE / distance2D;
          const clampedTarget: [number, number, number] = [
            playerPos[0] + dx * ratio,
            command.target[1] ?? playerPos[1] ?? 0,
            playerPos[2] + dz * ratio,
          ];

          logger.warn(
            `[HyperscapeService] Clamping move target from ${distance2D.toFixed(1)} to ${MAX_MOVE_DISTANCE} units`,
          );
          this.sendCommand("moveRequest", {
            ...command,
            target: clampedTarget,
          });
          return;
        }
      }
    }

    this.sendCommand("moveRequest", command);
  }

  /**
   * Execute toggle prayer command
   */
  async executeTogglePrayer(prayerId: string): Promise<void> {
    this.sendCommand("prayerToggle", { prayerId, timestamp: Date.now() });
  }

  /**
   * Execute attack command
   */
  async executeAttack(command: AttackEntityCommand): Promise<void> {
    // Server expects { mobId, attackType }, translate from our command format
    this.sendCommand("attackMob", {
      mobId: command.targetEntityId,
      attackType: "melee", // Default to melee for now
    });
  }

  /**
   * Execute use item command
   */
  async executeUseItem(command: UseItemCommand): Promise<void> {
    this.sendCommand("useItem", command);
  }

  /**
   * Execute equip item command
   */
  async executeEquipItem(command: EquipItemCommand): Promise<void> {
    this.sendCommand("equipItem", command);
  }

  /**
   * Execute pickup item command - picks up an item from the ground
   */
  async executePickupItem(itemId: string): Promise<void> {
    // Server requires timestamp for anti-replay validation
    this.sendCommand("pickupItem", { itemId, timestamp: Date.now() });
  }

  /**
   * Execute drop item command - drops an item from inventory to the ground
   * @param itemId - The item type ID
   * @param quantity - How many to drop (for stackable items)
   * @param slot - The specific inventory slot (for non-stackable items with same itemId)
   */
  async executeDropItem(
    itemId: string,
    quantity: number = 1,
    slot?: number,
  ): Promise<void> {
    const payload: { itemId: string; quantity: number; slot?: number } = {
      itemId,
      quantity,
    };
    if (slot !== undefined) {
      payload.slot = slot;
    }
    this.sendCommand("dropItem", payload);
  }

  /**
   * Execute chat message command
   */
  async executeChatMessage(command: ChatMessageCommand): Promise<void> {
    const text = command.message.trim();
    if (!text) {
      throw new Error("Chat message cannot be empty");
    }

    const now = Date.now();
    const senderId = this.characterId || this.runtime.agentId;
    const senderName = this.runtime.character?.name || "Agent";

    // The server accepts outbound player chat on the chatAdded packet.
    this.sendCommand("chatAdded", {
      id: `${senderId}-${now}`,
      from: senderName,
      fromId: senderId,
      body: text,
      text,
      type: "chat",
      timestamp: now,
      createdAt: new Date(now).toISOString(),
    });
  }

  /**
   * Execute gather resource command
   * Maps resourceEntityId to resourceId for server compatibility
   */
  async executeGatherResource(command: GatherResourceCommand): Promise<void> {
    // Get player position for the server
    const player = this.getPlayerEntity();
    const rawPos = player?.position as unknown;
    let playerPosition: { x: number; y: number; z: number } | undefined;

    if (Array.isArray(rawPos) && rawPos.length >= 3) {
      playerPosition = { x: rawPos[0], y: rawPos[1], z: rawPos[2] };
    } else if (rawPos && typeof rawPos === "object" && "x" in rawPos) {
      playerPosition = rawPos as { x: number; y: number; z: number };
    }

    // Send with server-expected field name
    logger.info(
      `[HyperscapeService] Sending resourceGather: resourceId=${command.resourceEntityId}, ` +
        `playerPosition=${JSON.stringify(playerPosition)}`,
    );
    this.sendCommand("resourceGather", {
      resourceId: command.resourceEntityId,
      playerPosition,
    });
  }

  /**
   * Execute bank action command
   */
  async executeBankAction(command: BankCommand): Promise<void> {
    this.sendCommand("bankAction", command);
  }

  // ============================================================================
  // DUEL SYSTEM COMMANDS
  // ============================================================================

  /** Pending duel challenge from another player */
  /** Pending duel challenge from another player */
  private pendingDuelChallenge: PendingDuelChallenge | null = null;

  /**
   * Challenge another player to a duel
   * @param command - Contains targetPlayerId of player to challenge
   */
  async executeDuelChallenge(command: {
    targetPlayerId: string;
  }): Promise<void> {
    if (!this.characterId) {
      throw new Error("No characterId - cannot challenge to duel");
    }
    logger.info(
      `[HyperscapeService] Sending duel:challenge to ${command.targetPlayerId}`,
    );
    this.sendCommand("duel:challenge", {
      targetPlayerId: command.targetPlayerId,
    });
  }

  /**
   * Respond to a duel challenge (accept or decline)
   * @param command - Contains challengeId and accept boolean
   */
  async executeDuelChallengeResponse(command: {
    challengeId: string;
    accept: boolean;
  }): Promise<void> {
    logger.info(
      `[HyperscapeService] Responding to duel challenge ${command.challengeId}: ${command.accept ? "ACCEPT" : "DECLINE"}`,
    );
    this.sendCommand("duel:challenge:respond", {
      challengeId: command.challengeId,
      accept: command.accept,
    });
    // Clear pending challenge after responding
    if (this.pendingDuelChallenge?.challengeId === command.challengeId) {
      this.pendingDuelChallenge = null;
    }
  }

  /**
   * Get the current pending duel challenge (if any)
   */
  getPendingDuelChallenge(): PendingDuelChallenge | null {
    // Check if challenge has expired
    if (this.pendingDuelChallenge) {
      if (Date.now() > this.pendingDuelChallenge.expiresAt) {
        this.pendingDuelChallenge = null;
      }
    }
    return this.pendingDuelChallenge;
  }

  /**
   * Set pending duel challenge (called when duelChallengeIncoming packet received)
   */
  setPendingDuelChallenge(challenge: PendingDuelChallenge): void {
    this.pendingDuelChallenge = challenge;
    logger.info(
      `[HyperscapeService] 🎯 Duel challenge received from ${challenge.challengerName} (${challenge.challengerId})`,
    );
  }

  /**
   * Clear pending duel challenge (called when challenge expires/declined)
   */
  clearPendingDuelChallenge(): void {
    this.pendingDuelChallenge = null;
  }

  /**
   * Interact with a world entity (chest, NPC, etc.)
   * Sends an interaction request to the server
   */
  interactWithEntity(entityId: string, interactionType: string): void {
    if (!this.characterId) {
      logger.debug("[HyperscapeService] Cannot interact: no characterId");
      return;
    }

    const player = this.getPlayerEntity();
    if (!player?.position) {
      logger.debug("[HyperscapeService] Cannot interact: no player position");
      return;
    }

    this.sendCommand("entityInteract", {
      playerId: this.characterId,
      entityId,
      interactionType,
      playerPosition: player.position,
    });

    logger.debug(
      `[HyperscapeService] Sent entityInteract: entityId=${entityId}, type=${interactionType}`,
    );
  }

  /**
   * Handle manual goal override from dashboard
   * Sets the goal with locked flag to prevent autonomous override
   */
  private handleGoalOverride(data: unknown): void {
    const payload = data as {
      goalId?: string;
      unlock?: boolean;
      stop?: boolean;
      resume?: boolean;
      source?: string;
    };

    // Handle unlock command
    if (payload?.unlock) {
      logger.info("[HyperscapeService] 🔓 Goal unlock received from dashboard");
      this.unlockGoal();
      return;
    }

    // Handle stop command - pause goals (prevent auto-setting new ones)
    if (payload?.stop) {
      logger.info("[HyperscapeService] ⏹️ Goal stop received from dashboard");
      const behaviorManager = this.getBehaviorManager();
      if (behaviorManager) {
        behaviorManager.pauseGoals();
      }
      // Also cancel any current movement immediately
      const player = this.getPlayerEntity();
      if (player?.position) {
        logger.info("[HyperscapeService] ⏹️ Cancelling current movement");
        // Send cancel flag to properly clear the movement path on the server
        this.executeMove({
          target: player.position,
          runMode: false,
          cancel: true,
        });
      }
      return;
    }

    // Handle resume command - resume autonomous goal selection
    if (payload?.resume) {
      logger.info("[HyperscapeService] ▶️ Goal resume received from dashboard");
      const behaviorManager = this.getBehaviorManager();
      if (behaviorManager) {
        behaviorManager.resumeGoals();
      }
      return;
    }

    if (!payload?.goalId) {
      logger.warn("[HyperscapeService] goalOverride received without goalId");
      return;
    }

    logger.info(
      `[HyperscapeService] 🎯 Goal override received: ${payload.goalId} from ${payload.source || "unknown"}`,
    );

    // Get available goals
    const availableGoals = getAvailableGoals(this);
    const selectedGoal = availableGoals.find((g) => g.id === payload.goalId);

    if (!selectedGoal) {
      logger.warn(
        `[HyperscapeService] Goal override failed: unknown goal ID "${payload.goalId}"`,
      );
      return;
    }

    // Get current skill levels for progress calculation
    const player = this.getPlayerEntity();
    const skills = player?.skills as
      | Record<string, { level: number; xp: number }>
      | undefined;

    // Calculate progress and target for skill-based goals
    let progress = 0;
    let target = 10;

    if (selectedGoal.targetSkill && selectedGoal.targetSkillLevel) {
      const currentLevel = skills?.[selectedGoal.targetSkill]?.level ?? 1;
      progress = currentLevel;
      target = selectedGoal.targetSkillLevel;
    } else if (selectedGoal.type === "exploration") {
      progress = 0;
      target = 3;
    } else if (selectedGoal.type === "idle") {
      progress = 0;
      target = 1;
    }

    // Set the goal with locked flag
    this.autonomousBehaviorManager?.setGoal({
      type: selectedGoal.type,
      description: selectedGoal.description,
      target,
      progress,
      location: selectedGoal.location,
      targetEntity: selectedGoal.targetEntity,
      targetSkill: selectedGoal.targetSkill,
      targetSkillLevel: selectedGoal.targetSkillLevel,
      startedAt: Date.now(),
      locked: true,
      lockedBy: "manual",
      lockedAt: Date.now(),
    });

    logger.info(
      `[HyperscapeService] ✅ Goal set from dashboard: ${selectedGoal.description} (locked)`,
    );
  }

  /**
   * Unlock the current goal, allowing autonomous behavior to change it
   */
  unlockGoal(): void {
    const goal = this.autonomousBehaviorManager?.getGoal();
    if (goal) {
      goal.locked = false;
      goal.lockedBy = undefined;
      goal.lockedAt = undefined;
      logger.info("[HyperscapeService] 🔓 Goal unlocked");
      this.syncGoalToServer();
    }
  }

  /**
   * Sync goal state to server for dashboard display
   * Called whenever the goal changes
   */
  /**
   * Sync pause state from server after reconnection
   * Ensures goalsPaused state persists across reconnects
   */
  async syncPauseStateFromServer(): Promise<void> {
    if (!this.characterId) {
      logger.debug(
        "[HyperscapeService] Cannot sync pause state: no characterId",
      );
      return;
    }

    try {
      // Query the goal endpoint to get current goalsPaused state
      const serverUrl =
        process.env.HYPERSCAPE_API_URL || "http://localhost:5555";
      const agentId = this.runtime?.agentId;

      if (!agentId) {
        logger.debug("[HyperscapeService] Cannot sync pause state: no agentId");
        return;
      }

      const response = await fetch(`${serverUrl}/api/agents/${agentId}/goal`);

      if (!response.ok) {
        logger.warn(
          `[HyperscapeService] Failed to sync pause state: HTTP ${response.status}`,
        );
        return;
      }

      const data = await response.json();
      const goalsPaused = data.goalsPaused === true;

      // Sync to behavior manager
      if (this.autonomousBehaviorManager) {
        const currentPaused = this.autonomousBehaviorManager.isGoalsPaused();
        if (currentPaused !== goalsPaused) {
          logger.info(
            `[HyperscapeService] 🔄 Syncing pause state from server: ${currentPaused} → ${goalsPaused}`,
          );
          if (goalsPaused) {
            this.autonomousBehaviorManager.pauseGoals();
          } else {
            this.autonomousBehaviorManager.resumeGoals();
          }
        }
      }
    } catch (error) {
      logger.warn(
        `[HyperscapeService] Error syncing pause state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  syncGoalToServer(): void {
    const goal = this.autonomousBehaviorManager?.getGoal();
    const availableGoals = getAvailableGoals(this);

    this.sendCommand("syncGoal", {
      characterId: this.characterId,
      goal: goal
        ? {
            type: goal.type,
            description: goal.description,
            progress: goal.progress,
            target: goal.target,
            location: goal.location,
            targetEntity: goal.targetEntity,
            targetSkill: goal.targetSkill,
            targetSkillLevel: goal.targetSkillLevel,
            startedAt: goal.startedAt,
            locked: goal.locked,
            lockedBy: goal.lockedBy,
          }
        : null,
      availableGoals: availableGoals.map((g) => ({
        id: g.id,
        type: g.type,
        description: g.description,
        priority: g.priority,
        reason: g.reason,
        targetSkill: g.targetSkill,
        targetSkillLevel: g.targetSkillLevel,
        location: g.location,
      })),
    });
  }

  /**
   * Sync agent thought to server for dashboard display
   * Called to show the agent's thought process/decision making
   *
   * @param type - Type of thought (situation assessment, evaluation, thinking, decision)
   * @param content - The thought content (markdown supported)
   */
  syncAgentThought(
    type: "situation" | "evaluation" | "thinking" | "decision",
    content: string,
  ): void {
    if (!this.characterId) {
      logger.debug("[HyperscapeService] Cannot sync thought: no characterId");
      return;
    }

    const thought = {
      id: `thought-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      content,
      timestamp: Date.now(),
    };

    this.sendCommand("syncAgentThought", {
      characterId: this.characterId,
      thought,
    });

    logger.debug(`[HyperscapeService] 🧠 Synced thought: [${type}]`);
  }

  /**
   * Sync LLM reasoning/thoughts to server for dashboard display
   * Simplified wrapper for syncAgentThought - used by AutonomousBehaviorManager
   *
   * @param thinking - The LLM's reasoning/thought process
   */
  syncThoughtsToServer(thinking: string): void {
    if (!thinking || !thinking.trim()) return;
    this.syncAgentThought("thinking", thinking);
  }

  // ============================================
  // Adapter methods for manager compatibility
  // These provide compatibility with managers that expect a local World instance
  // ============================================

  /**
   * Get the current world ID
   * Used by managers that need world context
   */
  get currentWorldId(): string | null {
    return this.gameState.worldId;
  }

  /**
   * Get world reference (not implemented - service uses WebSocket, not local World)
   * Returns null since this service doesn't maintain a local Three.js World
   * Managers should use getGameState() or WebSocket commands instead
   */
  getWorld(): null {
    logger.debug(
      "[HyperscapeService] getWorld() called - this service uses WebSocket, not local World",
    );
    return null;
  }

  /**
   * Get emote manager (not implemented in WebSocket-based service)
   * Emotes are sent via WebSocket commands instead
   */
  getEmoteManager(): null {
    logger.debug(
      "[HyperscapeService] getEmoteManager() - use executeCommand for emotes",
    );
    return null;
  }

  /**
   * Get message manager (not implemented - chat uses WebSocket)
   * Messages are sent via executeChatMessage() instead
   */
  getMessageManager(): null {
    logger.debug(
      "[HyperscapeService] getMessageManager() - use executeChatMessage() instead",
    );
    return null;
  }

  /**
   * Get dynamic action loader (not implemented)
   */
  getDynamicActionLoader(): null {
    return null;
  }

  /**
   * Play an emote animation
   * Sends emote command to server
   */
  async playEmote(emoteName: string): Promise<void> {
    this.sendCommand("entityEvent", {
      entityId: this.characterId,
      event: "emote",
      data: { emote: emoteName },
    });
  }

  public getQuestState(): QuestData[] {
    return this.gameState.quests || [];
  }

  /**
   * Request the server to send us the quest list.
   * Response arrives via "questList" packet which populates gameState.quests.
   */
  public requestQuestList(): void {
    this.sendCommand("getQuestList", {});
  }

  /**
   * Request detailed quest info from the server.
   */
  public requestQuestDetail(questId: string): void {
    this.sendCommand("getQuestDetail", { questId });
  }

  /**
   * Accept a quest by ID. Server will start the quest and grant onStart items.
   */
  public sendQuestAccept(questId: string): void {
    this.sendCommand("questAccept", { questId });
  }

  /**
   * Complete a quest by ID. Quest must be in ready_to_complete status.
   */
  public sendQuestComplete(questId: string): void {
    this.sendCommand("questComplete", { questId });
  }

  /**
   * Get the world map data (towns + POIs)
   * Available after receiving the snapshot from the server.
   */
  public getWorldMap(): import("../types.js").WorldMapData | undefined {
    return this.gameState.worldMap;
  }
}
