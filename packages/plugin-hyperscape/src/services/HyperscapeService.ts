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
    logger.info("[HyperscapeService] Starting service");
    const service = new HyperscapeService(runtime);

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

  async stop(): Promise<void> {
    logger.info("[HyperscapeService] Stopping service");
    this.autoReconnect = false;

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    await this.disconnect();
  }

  /**
   * Connect to Hyperscape server via WebSocket
   */
  async connect(serverUrl: string): Promise<void> {
    if (this.connectionState.connected || this.connectionState.connecting) {
      logger.warn("[HyperscapeService] Already connected or connecting");
      return;
    }

    this.connectionState.connecting = true;
    this.connectionState.lastConnectAttempt = Date.now();

    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with auth tokens as query params (matching Hyperscape client pattern)
        let wsUrl = serverUrl;
        if (this.authToken) {
          const separator = serverUrl.includes("?") ? "&" : "?";
          wsUrl = `${serverUrl}${separator}authToken=${encodeURIComponent(this.authToken)}`;
          if (this.privyUserId) {
            wsUrl += `&privyUserId=${encodeURIComponent(this.privyUserId)}`;
          }
        }

        logger.info(
          `[HyperscapeService] Connecting to ${wsUrl.replace(/authToken=[^&]+/, "authToken=***")}`,
        );
        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          this.connectionState.connected = true;
          this.connectionState.connecting = false;
          this.connectionState.reconnectAttempts = 0;
          logger.info("[HyperscapeService] Connected to Hyperscape server");
          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on("close", () => {
          this.connectionState.connected = false;
          this.connectionState.connecting = false;
          logger.warn(
            "[HyperscapeService] Disconnected from Hyperscape server",
          );

          if (this.autoReconnect) {
            this.scheduleReconnect();
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
   */
  private buildWebSocketUrl(baseUrl: string): string {
    if (!this.authToken) {
      return baseUrl;
    }
    const separator = baseUrl.includes("?") ? "&" : "?";
    let url = `${baseUrl}${separator}authToken=${encodeURIComponent(this.authToken)}`;
    if (this.privyUserId) {
      url += `&privyUserId=${encodeURIComponent(this.privyUserId)}`;
    }
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
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
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
        const baseUrl =
          process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:5555/ws";
        const serverUrl = this.buildWebSocketUrl(baseUrl);
        await this.connect(serverUrl);
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

      // Broadcast to registered event handlers
      const eventType = this.packetNameToEventType(packetName);
      if (eventType) {
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
      "pickupItem",
      "dropItem",
      "inventoryUpdated",
      "skillsUpdated",
      "showToast",
      "deathScreen",
      "deathScreenClose",
      "requestRespawn",
      "playerSetDead",
      "playerRespawned",
      "corpseLoot",
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
        if (data && data.id === this.characterId) {
          this.gameState.playerEntity = data as PlayerEntity;
          logger.info(
            `[HyperscapeService] 🎮 Player entity spawned: ${data.id}`,
          );
        } else if (data && data.id) {
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

    // Encode as msgpackr: [packetId, data]
    const packet = packr.pack([packetId, data]);
    this.ws!.send(packet);
  }

  /**
   * Get packet ID from packet name (matching packets.ts)
   */
  private getPacketId(name: string): number | null {
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
      "pickupItem",
      "dropItem",
      "inventoryUpdated",
      "skillsUpdated",
      "showToast",
      "deathScreen",
      "deathScreenClose",
      "requestRespawn",
      "playerSetDead",
      "playerRespawned",
      "corpseLoot",
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
