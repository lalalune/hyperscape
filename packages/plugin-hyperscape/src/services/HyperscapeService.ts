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

    // Connect to server
    await service.connect(serverUrl);

    logger.info("[HyperscapeService] Service started and connected");
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
      // Check if data is binary (Buffer or ArrayBuffer)
      // Hyperscape uses binary msgpackr protocol, so we skip binary messages
      if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
        // Binary data - skip parsing (Hyperscape uses msgpackr binary protocol)
        // These are likely game state updates, snapshots, or other binary packets
        // We'll handle them when we implement proper msgpackr decoding
        return;
      }

      // Try to parse as text/JSON
      const text = data.toString();

      // Skip empty messages
      if (!text || text.trim().length === 0) {
        return;
      }

      // Check if it looks like JSON (starts with { or [)
      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
        // Not JSON, likely binary data converted to string (contains '�')
        return;
      }

      const message = JSON.parse(text) as NetworkEvent;

      // Update game state based on event type
      this.updateGameState(message);

      // Broadcast to registered event handlers
      this.broadcastEvent(message.type, message.data);
    } catch (error) {
      // Only log errors for actual JSON parse failures, not binary data
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Skip logging binary data parse errors (they contain "Unrecognized token" and "�")
      if (
        !errorMessage.includes("Unrecognized token") &&
        !errorMessage.includes("�")
      ) {
        logger.error(
          "[HyperscapeService] Failed to parse message:",
          errorMessage,
        );
      }
      // Silently ignore binary data parse errors
    }
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
   * Send command to server
   */
  private sendCommand(command: string, data: unknown): void {
    if (!this.isConnected()) {
      throw new Error("Not connected to Hyperscape server");
    }

    const message = JSON.stringify({
      type: command,
      data,
      timestamp: Date.now(),
    });

    this.ws!.send(message);
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
