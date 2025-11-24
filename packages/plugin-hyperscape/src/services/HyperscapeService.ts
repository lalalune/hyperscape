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

import { Service, logger, type IAgentRuntime } from "@elizaos/core";
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
        // PRAGMATIC APPROACH: Parse and execute movement commands directly
        // This bypasses ElizaOS's memory/action evaluation for now
        // TODO: Integrate with full ElizaOS pipeline once entity constraints are resolved

        // Parse movement commands like "Move to coordinates [x, y, z]"
        const coordMatch = messageText.match(
          /\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/,
        );

        if (coordMatch) {
          const target: [number, number, number] = [
            parseFloat(coordMatch[1]),
            parseFloat(coordMatch[2]),
            parseFloat(coordMatch[3]),
          ];

          const runMode = messageText.toLowerCase().includes("run");

          // Check if agent has spawned player entity
          const playerEntity = this.getGameState()?.playerEntity;
          if (!playerEntity) {
            logger.warn(
              `[HyperscapePlugin] ⚠️ Cannot execute movement - no player entity spawned yet`,
            );
            return;
          }

          logger.info(
            `[HyperscapePlugin] 🎯 Executing movement to [${target.join(", ")}]${runMode ? " (running)" : ""} for player ${playerEntity.id}`,
          );

          await this.executeMove({ target, runMode });

          logger.info(
            `[HyperscapePlugin] ✅ Movement command sent successfully`,
          );
          return;
        }

        // If no direct command matched, log for future AI integration
        logger.info(
          `[HyperscapePlugin] No direct command matched - future: integrate with ElizaOS AI`,
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
    ];
    return packetNames[id] || null;
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
          Object.assign(this.gameState.playerEntity, data.changes || data);
        } else if (data && data.id) {
          const entity = this.gameState.nearbyEntities.get(data.id);
          if (entity) {
            Object.assign(entity, data.changes || data);
          }
        }
        break;

      case "entityRemoved":
        if (data && data.id) {
          this.gameState.nearbyEntities.delete(data.id);
        }
        break;

      case "inventoryUpdated":
      case "skillsUpdated":
        if (this.gameState.playerEntity && data) {
          Object.assign(this.gameState.playerEntity, data);
        }
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
    if (handlers) {
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
   * Get complete game state
   */
  getGameState(): GameStateCache {
    return { ...this.gameState };
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
    this.sendCommand("attackEntity", command);
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
   */
  async executeGatherResource(command: GatherResourceCommand): Promise<void> {
    this.sendCommand("gatherResource", command);
  }

  /**
   * Execute bank action command
   */
  async executeBankAction(command: BankCommand): Promise<void> {
    this.sendCommand("bankAction", command);
  }
}
