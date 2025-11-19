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

  constructor() {
    super();

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
  }

  async start(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;
    logger.info("[HyperscapeService] Service started");

    // Get server URL from environment or use default
    const serverUrl =
      process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:3000";
    this.autoReconnect = process.env.HYPERSCAPE_AUTO_RECONNECT !== "false";

    // Connect to server
    await this.connect(serverUrl);
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
        this.ws = new WebSocket(serverUrl);

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
        const serverUrl =
          process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:3000";
        await this.connect(serverUrl);
      } catch (error) {
        logger.error({ error }, "[HyperscapeService] Reconnection failed:");
      }
    }, backoffMs);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as NetworkEvent;

      // Update game state based on event type
      this.updateGameState(message);

      // Broadcast to registered event handlers
      this.broadcastEvent(message.type, message.data);
    } catch (error) {
      logger.error(
        "[HyperscapeService] Failed to parse message:",
        error instanceof Error ? error.message : String(error),
      );
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
