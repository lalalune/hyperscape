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
  type IAgentRuntime,
  type Memory,
  type Action,
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
  HyperscapeServiceInterface,
} from "../types.js";
import { AutonomousBehaviorManager } from "../managers/autonomous-behavior-manager.js";
import { registerEventHandlers } from "../events/handlers.js";
import { getAvailableGoals } from "../providers/goalProvider.js";

// msgpackr instances for binary packet encoding/decoding
const packr = new Packr({ structuredClone: true });
const unpackr = new Unpackr();

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
  private eventHandlers: Map<EventType, Array<(data: unknown) => void>>;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private autoReconnect: boolean = true;
  private authToken: string | undefined;
  private privyUserId: string | undefined;
  private characterId: string | undefined;
  private hasReceivedSnapshot: boolean = false;
  private pluginEventHandlersRegistered: boolean = false;
  private chatHandlerRegistered: boolean = false;
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
    };

    this.connectionState = {
      connected: false,
      connecting: false,
      lastConnectAttempt: 0,
      reconnectAttempts: 0,
    };

    this.eventHandlers = new Map();
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

    // Try to get from agent settings if not in env
    if (!service.authToken && runtime.agentId) {
      const settings = runtime.getSetting("HYPERSCAPE_AUTH_TOKEN");
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
      if (settings) {
        service.characterId = String(settings);
        logger.info(`[HyperscapeService] Character ID: ${service.characterId}`);
      }
    }

    if (!service.characterId) {
      logger.info(
        "[HyperscapeService] No HYPERSCAPE_CHARACTER_ID - waiting for character selection (this is normal)",
      );
    }

    // Try to connect with retry logic (ElizaOS expects services to be ready when start() completes)
    // Retry for up to 25 seconds (within ElizaOS's 30-second service startup timeout)
    const maxRetries = 5;
    const retryDelay = 5000; // 5 seconds between retries
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(
          `[HyperscapeService] Connection attempt ${attempt}/${maxRetries} to ${serverUrl}`,
        );
        await service.connect(serverUrl);
        logger.info("[HyperscapeService] Service started and connected");

        // Register chat message handler to process messages through ElizaOS runtime
        service.registerChatHandler(runtime);

        return service;
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          `[HyperscapeService] Connection attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          logger.info(
            `[HyperscapeService] Retrying in ${retryDelay / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed - log error but return service anyway
    // Auto-reconnect will keep trying in the background
    logger.error(
      `[HyperscapeService] Failed to connect after ${maxRetries} attempts. ` +
        `Service will continue retrying in background. Last error: ${lastError?.message}`,
    );

    logger.info(
      "[HyperscapeService] Service started (will retry connection in background)",
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
      // Insert dashboard entity directly into entities table if it doesn't exist
      // This satisfies the foreign key constraint for memories.entityId
      const db = (runtime as any).databaseAdapter?.db || (runtime as any).db;

      if (db) {
        // Use INSERT OR IGNORE for SQLite / ON CONFLICT DO NOTHING for PostgreSQL
        await db.run(
          `
          INSERT INTO entities (id, name, details, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO NOTHING
        `,
          [
            dashboardUuid,
            "Dashboard",
            JSON.stringify({
              username: "dashboard",
              source: "hyperscape_dashboard",
              description: "Hyperscape Dashboard User",
            }),
            new Date().toISOString(),
          ],
        );

        logger.info(
          "[HyperscapePlugin] Ensured dashboard entity exists in database",
        );
      } else {
        logger.warn(
          "[HyperscapePlugin] Could not access database to create dashboard entity",
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

    this.onGameEvent("CHAT_MESSAGE", async (data: unknown) => {
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
          id: dashboardUuid as `${string}-${string}-${string}-${string}-${string}`,
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

        // Import registered actions to find appropriate one
        const { moveToAction, stopMovementAction } = await import(
          "../actions/movement.js"
        );

        // Determine which action to invoke based on message content
        let actionToInvoke: Action | null = null;

        // Check for stop commands
        const stopPatterns = /^(stop|halt|stay|cancel|abort)/i;
        if (stopPatterns.test(messageText.trim())) {
          actionToInvoke = stopMovementAction;
        }
        // Check for movement commands (coordinates pattern)
        else if (
          messageText.match(
            /\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/,
          )
        ) {
          actionToInvoke = moveToAction;
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
            } else {
              logger.warn(
                `[HyperscapePlugin] ⚠️ Action ${actionToInvoke.name} failed: ${(result as { error?: Error }).error?.message || "Unknown error"}`,
              );
            }
          }
          return;
        }

        // No specific action matched - log for future AI integration
        // In a full implementation, this would go through ElizaOS's AI
        // to determine the appropriate action based on context
        logger.info(
          `[HyperscapePlugin] 💭 No direct action matched for: "${messageText}"`,
        );
        logger.info(
          `[HyperscapePlugin] Future: Route through ElizaOS AI for intelligent action selection`,
        );
      } catch (error) {
        logger.error(
          { error },
          "[HyperscapePlugin] Failed to process chat message:",
        );
      }
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
      try {
        // Build WebSocket URL with auth tokens
        const wsUrl = this.buildWebSocketUrl(serverUrl);

        logger.info(
          `[HyperscapeService] Connecting to ${wsUrl.replace(/authToken=[^&]+/, "authToken=***")}`,
        );
        this.ws = new WebSocket(wsUrl);

        // Add unique identifier to track this WebSocket
        const wsId = `WS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        (this.ws as any).__wsId = wsId;
        logger.info(
          `[HyperscapeService] Created WebSocket ${wsId} for runtime ${this.runtime.agentId}`,
        );

        this.ws.on("open", async () => {
          this.connectionState.connected = true;
          this.connectionState.connecting = false;
          this.connectionState.reconnectAttempts = 0;

          // Check if this is a reconnection (player entity already exists)
          const isReconnection = !!this.gameState.playerEntity;
          const wsId = (this.ws as any).__wsId || "unknown";

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

            // Re-send enter world
            this.sendBinaryPacket("enterWorld", {
              characterId: this.characterId,
            });
            logger.info(
              `[HyperscapeService] 🚪 Re-sent enterWorld: ${this.characterId} (reconnection)`,
            );
          } else {
            logger.info(
              `[HyperscapeService] Connected to Hyperscape server (WebSocket ${wsId})`,
            );
          }

          resolve();
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
          this.connectionState.connecting = false;
          reject(error);
        });
      } catch (error) {
        this.connectionState.connecting = false;
        logger.error(
          "[HyperscapeService] Failed to connect:",
          error instanceof Error ? error.message : String(error),
        );
        reject(error);
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
   * Get packet name from packet ID (matching packets.ts)
   */
  private getPacketName(id: number): string | null {
    // CRITICAL: This list MUST exactly match packages/shared/src/platform/shared/packets.ts
    // Any mismatch will cause packet IDs to be misinterpreted!
    const packetNames = [
      "snapshot",
      "command",
      "chatAdded",
      "chatCleared",
      "entityAdded",
      "entityModified",
      "moveRequest",
      "entityEvent",
      "entityRemoved",
      "playerTeleport",
      "playerPush",
      "playerSessionAvatar",
      "settingsModified",
      "spawnModified",
      "kick",
      "ping",
      "pong",
      "input",
      "inputAck",
      "correction",
      "playerState",
      "serverStateUpdate",
      "deltaUpdate",
      "compressedUpdate",
      "resourceSnapshot",
      "resourceSpawnPoints",
      "resourceSpawned",
      "resourceDepleted",
      "resourceRespawned",
      "resourceGather",
      "gatheringComplete",
      "attackMob",
      "changeAttackStyle", // ✅ ADDED - was missing!
      "pickupItem",
      "dropItem",
      "equipItem",
      "unequipItem", // ✅ ADDED - was missing!
      "inventoryUpdated",
      "equipmentUpdated", // ✅ ADDED - was missing!
      "skillsUpdated",
      "showToast",
      "deathScreen",
      "deathScreenClose",
      "requestRespawn",
      "playerSetDead",
      "playerRespawned",
      "corpseLoot",
      "attackStyleChanged", // ✅ ADDED - was missing!
      "attackStyleUpdate", // ✅ ADDED - was missing!
      "combatDamageDealt", // ✅ ADDED - was missing!
      "playerUpdated", // ✅ ADDED - was missing!
      "characterListRequest",
      "characterCreate",
      "characterList",
      "characterCreated",
      "characterSelected",
      "enterWorld",
      "syncGoal", // Agent goal sync packet (for dashboard display)
      "goalOverride", // Agent goal override packet (dashboard -> plugin)
    ];
    return packetNames[id] || null;
  }

  /**
   * Translate abbreviated entity property names from server to full names
   * Server sends: p (position), v (velocity), q (quaternion), e (emote)
   * Plugin expects: position, velocity, quaternion, emote
   */
  private translateEntityChanges(
    changes: Record<string, unknown>,
  ): Record<string, unknown> {
    const translated: Record<string, unknown> = {};
    const abbreviations: Record<string, string> = {
      p: "position",
      v: "velocity",
      q: "quaternion",
      e: "emote",
    };

    for (const [key, value] of Object.entries(changes)) {
      const fullName = abbreviations[key] || key;
      translated[fullName] = value;
    }

    return translated;
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
   */
  private async handleSnapshot(snapshotData: any): Promise<void> {
    try {
      logger.info("[HyperscapeService] Processing snapshot...");

      // Extract character list from snapshot
      const characters = snapshotData?.characters || [];
      logger.info(
        `[HyperscapeService] Found ${characters.length} character(s)`,
      );

      if (characters.length === 0) {
        logger.info(
          "[HyperscapeService] No characters found - agent will join after character creation/selection",
        );
        return;
      }

      // Find character by ID if specified
      let selectedCharacter: any | null = null;
      if (this.characterId) {
        selectedCharacter =
          characters.find((c: any) => c.id === this.characterId) || null;
        if (selectedCharacter) {
          logger.info(
            `[HyperscapeService] ✅ Found character by ID: ${selectedCharacter.name} (${this.characterId})`,
          );
        } else {
          logger.warn(
            `[HyperscapeService] Character ${this.characterId} not found, using first character`,
          );
        }
      }

      // Fall back to first character if no ID or not found
      if (!selectedCharacter && characters.length > 0) {
        selectedCharacter = characters[0];
        logger.info(
          `[HyperscapeService] Using first character: ${selectedCharacter.name} (${selectedCharacter.id})`,
        );
      }

      // Safety check - should not happen since we checked characters.length above
      if (!selectedCharacter) {
        logger.error(
          "[HyperscapeService] No character available after selection logic",
        );
        return;
      }

      // Store character details for logging
      const characterName = selectedCharacter.name;
      const characterAvatar = selectedCharacter.avatar || "default avatar";
      const characterWallet = selectedCharacter.wallet || "no wallet";

      logger.info(
        `[HyperscapeService] 🎭 Selected character details:\n` +
          `  Name: ${characterName}\n` +
          `  ID: ${selectedCharacter.id}\n` +
          `  Avatar: ${characterAvatar}\n` +
          `  Wallet: ${characterWallet}`,
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
        `[HyperscapeService] ✅ Auto-join complete! Agent should spawn as ${characterName} with avatar: ${characterAvatar}`,
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

          // Start autonomous exploration when player spawns
          this.startAutonomousExploration();
        } else if (data && data.id) {
          logger.debug(
            `[HyperscapeService] Entity ${data.id} added (not our player)`,
          );
          this.gameState.nearbyEntities.set(data.id, data as Entity);
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
          // Log position updates for debugging
          if (translatedChanges.position) {
            const pos = translatedChanges.position as
              | number[]
              | { x: number; y: number; z: number };
            const posStr = Array.isArray(pos)
              ? `[${pos[0]?.toFixed?.(0) || pos[0]}, ${pos[1]?.toFixed?.(0) || pos[1]}, ${pos[2]?.toFixed?.(0) || pos[2]}]`
              : `{x:${pos.x?.toFixed?.(0) || pos.x}, y:${pos.y?.toFixed?.(0) || pos.y}, z:${pos.z?.toFixed?.(0) || pos.z}}`;
            logger.info(
              `[HyperscapeService] 📍 Player position updated: ${posStr}`,
            );
          }
        } else if (data && data.id) {
          const changes = data.changes || data;
          const translatedChanges = this.translateEntityChanges(changes);
          // Log if we get entityModified for a different entity (to debug why player isn't updating)
          if (data.id && translatedChanges.position) {
            logger.debug(
              `[HyperscapeService] 📍 Entity ${data.id} position updated (not player ${this.characterId})`,
            );
          }
          const entity = this.gameState.nearbyEntities.get(data.id);
          if (entity) {
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

      case "playerUpdated":
      case "playerState":
        // Handle player position/state updates
        if (this.gameState.playerEntity && data) {
          // Update position if present
          if (data.position) {
            this.gameState.playerEntity.position = data.position;
            const pos = data.position;
            const posStr = Array.isArray(pos)
              ? `[${pos[0]?.toFixed?.(0) || pos[0]}, ${pos[1]?.toFixed?.(0) || pos[1]}, ${pos[2]?.toFixed?.(0) || pos[2]}]`
              : `{x:${pos.x?.toFixed?.(0) || pos.x}, z:${pos.z?.toFixed?.(0) || pos.z}}`;
            logger.info(
              `[HyperscapeService] 📍 Player position via ${packetName}: ${posStr}`,
            );
          }
          // Also copy any other state (health, etc)
          Object.assign(this.gameState.playerEntity, data);
        }
        break;

      case "goalOverride":
        // Handle manual goal override from dashboard
        this.handleGoalOverride(data);
        break;
    }

    this.gameState.lastUpdate = Date.now();
  }

  /**
   * Update cached game state based on incoming events
   */
  private updateGameState(event: NetworkEvent): void {
    switch (event.type) {
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
    }

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
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error(
            `[HyperscapeService] Event handler error for ${eventType}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      });
    } else if (eventType === "ENTITY_LEFT") {
      logger.warn(
        `[HyperscapeService] ⚠️ ENTITY_LEFT event but no handlers registered!`,
      );
    }
  }

  /**
   * Register event handler
   */
  onGameEvent(eventType: EventType, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  offGameEvent(eventType: EventType, handler: (data: unknown) => void): void {
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
   * Get packet ID from packet name (matching packets.ts)
   */
  private getPacketId(name: string): number | null {
    // CRITICAL: This list MUST exactly match packages/shared/src/platform/shared/packets.ts
    // Any mismatch will cause packet IDs to be misinterpreted!
    const packetNames = [
      "snapshot",
      "command",
      "chatAdded",
      "chatCleared",
      "entityAdded",
      "entityModified",
      "moveRequest",
      "entityEvent",
      "entityRemoved",
      "playerTeleport",
      "playerPush",
      "playerSessionAvatar",
      "settingsModified",
      "spawnModified",
      "kick",
      "ping",
      "pong",
      "input",
      "inputAck",
      "correction",
      "playerState",
      "serverStateUpdate",
      "deltaUpdate",
      "compressedUpdate",
      "resourceSnapshot",
      "resourceSpawnPoints",
      "resourceSpawned",
      "resourceDepleted",
      "resourceRespawned",
      "resourceGather",
      "gatheringComplete",
      "attackMob",
      "changeAttackStyle", // ✅ ADDED - was missing!
      "pickupItem",
      "dropItem",
      "equipItem",
      "unequipItem", // ✅ ADDED - was missing!
      "inventoryUpdated",
      "equipmentUpdated", // ✅ ADDED - was missing!
      "skillsUpdated",
      "showToast",
      "deathScreen",
      "deathScreenClose",
      "requestRespawn",
      "playerSetDead",
      "playerRespawned",
      "corpseLoot",
      "attackStyleChanged", // ✅ ADDED - was missing!
      "attackStyleUpdate", // ✅ ADDED - was missing!
      "combatDamageDealt", // ✅ ADDED - was missing!
      "playerUpdated", // ✅ ADDED - was missing!
      "characterListRequest",
      "characterCreate",
      "characterList",
      "characterCreated",
      "characterSelected",
      "enterWorld",
      "syncGoal", // Agent goal sync packet (for dashboard display)
      "goalOverride", // Agent goal override packet (dashboard -> plugin)
    ];
    const index = packetNames.indexOf(name);
    return index >= 0 ? index : null;
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
    this.sendCommand("moveRequest", command);
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
   * Execute chat message command
   */
  async executeChatMessage(command: ChatMessageCommand): Promise<void> {
    this.sendCommand("chatMessage", command);
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

  /**
   * Handle manual goal override from dashboard
   * Sets the goal with locked flag to prevent autonomous override
   */
  private handleGoalOverride(data: unknown): void {
    const payload = data as {
      goalId?: string;
      unlock?: boolean;
      source?: string;
    };

    // Handle unlock command
    if (payload?.unlock) {
      logger.info("[HyperscapeService] 🔓 Goal unlock received from dashboard");
      this.unlockGoal();
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
}
