/**
 * Connection Handler Module - WebSocket connection management
 *
 * Handles incoming WebSocket connections including authentication, terrain waiting,
 * spawn position calculation, snapshot creation, and player initialization.
 *
 * This is the most complex module in ServerNetwork as it orchestrates many systems:
 * - Authentication (Privy, JWT)
 * - Character system (loading character list)
 * - Terrain system (waiting for ready, grounding spawn position)
 * - Database system (loading saved player position)
 * - Resource system (sending resource snapshot)
 * - LiveKit (optional video chat integration)
 *
 * Responsibilities:
 * - Validate incoming connections
 * - Check player limit
 * - Authenticate users
 * - Wait for terrain system to be ready
 * - Calculate grounded spawn position
 * - Create and send initial snapshot
 * - Register socket in sockets map
 * - Emit player joined event
 *
 * Usage:
 * ```typescript
 * const handler = new ConnectionHandler(world, sockets, broadcast, spawn);
 * await handler.handleConnection(ws, params);
 * ```
 */

import type { World } from "@hyperscape/shared";
import {
  Socket,
  EventType,
  TerrainSystem,
  writePacket,
} from "@hyperscape/shared";
import type {
  ConnectionParams,
  NodeWebSocket,
  ServerSocket,
  SpawnData,
  ResourceSystem,
  NetworkWithSocket,
  SystemDatabase,
} from "../types";
import { authenticateUser } from "./authentication";
import { loadCharacterList } from "./character-selection";
import type { BroadcastManager } from "./broadcast";

/**
 * ConnectionHandler - Manages WebSocket connection flow
 *
 * Orchestrates the complex connection sequence from initial WebSocket
 * to fully-initialized player.
 */
export class ConnectionHandler {
  /**
   * Create a ConnectionHandler
   *
   * @param world - Game world instance
   * @param sockets - Map of active sockets (modified by reference)
   * @param broadcast - Broadcast manager for sending messages
   * @param getSpawn - Function to get current spawn point
   * @param db - Database instance for authentication
   */
  constructor(
    private world: World,
    private sockets: Map<string, ServerSocket>,
    private broadcast: BroadcastManager,
    private getSpawn: () => SpawnData,
    private db: SystemDatabase,
  ) {}

  /**
   * Handle incoming WebSocket connection
   *
   * This is the main entry point for new connections. Performs the full
   * connection flow including validation, auth, terrain waiting, and snapshot.
   *
   * @param ws - WebSocket connection from client
   * @param params - Connection parameters (auth tokens, etc.)
   */
  async handleConnection(
    ws: NodeWebSocket,
    params: ConnectionParams,
  ): Promise<void> {
    try {
      // Validate WebSocket
      if (!ws || typeof ws.close !== "function") {
        console.error(
          "[ConnectionHandler] Invalid websocket provided to onConnection",
        );
        return;
      }

      // Check player limit
      if (!this.checkPlayerLimit(ws)) {
        return;
      }

      // Authenticate user
      const { user, authToken, userWithPrivy } = await authenticateUser(
        params,
        this.db,
      );

      // Get LiveKit options if available
      const livekit = await this.world.livekit?.getPlayerOpts?.(user.id);

      // Create socket
      const socket = this.createSocket(ws, user.id);

      // Wait for terrain system
      if (!(await this.waitForTerrain(ws))) {
        return;
      }

      // Load character list
      const characters = await loadCharacterList(user.id, this.world);

      // Calculate spawn position
      const spawnPosition = await this.calculateSpawnPosition(socket.id);

      // Create and send snapshot
      await this.sendSnapshot(socket, {
        user,
        authToken,
        userWithPrivy,
        livekit,
        characters,
        spawnPosition,
      });

      // Send resource snapshot
      await this.sendResourceSnapshot(socket);

      // Register socket
      this.sockets.set(socket.id, socket);

      // Emit player joined event if player exists
      if (socket.player) {
        this.emitPlayerJoined(socket);
      }
    } catch (err) {
      console.error("[ConnectionHandler] Error in handleConnection:", err);
    }
  }

  /**
   * Check if server has reached player limit
   *
   * Kicks connection if player limit is reached.
   *
   * @param ws - WebSocket to potentially kick
   * @returns True if connection can proceed, false if kicked
   * @private
   */
  private checkPlayerLimit(ws: NodeWebSocket): boolean {
    const playerLimit = this.world.settings.playerLimit;

    if (
      typeof playerLimit === "number" &&
      playerLimit > 0 &&
      this.sockets.size >= playerLimit
    ) {
      const packet = writePacket("kick", "player_limit");
      ws.send(packet);
      ws.close();
      return false;
    }

    return true;
  }

  /**
   * Create Socket instance for new connection
   *
   * @param ws - WebSocket connection
   * @param accountId - User account ID
   * @returns Configured ServerSocket
   * @private
   */
  private createSocket(ws: NodeWebSocket, accountId: string): ServerSocket {
    const socketId = require("@hyperscape/shared").uuid();
    const socket = new Socket({
      id: socketId,
      ws,
      network: this.world.network as unknown as NetworkWithSocket,
      player: undefined,
    }) as ServerSocket;
    socket.accountId = accountId;
    return socket;
  }

  /**
   * Wait for terrain system to be ready
   *
   * Terrain must be ready before we can ground spawn positions.
   * Polls for up to 10 seconds, then fails the connection.
   *
   * @param ws - WebSocket to close if terrain not ready
   * @returns True if terrain ready, false if timed out
   * @private
   */
  private async waitForTerrain(ws: NodeWebSocket): Promise<boolean> {
    const terrain = this.world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;

    if (!terrain) {
      return true; // No terrain system, proceed anyway
    }

    let terrainReady = false;
    for (let i = 0; i < 100; i++) {
      if (terrain.isReady && terrain.isReady()) {
        terrainReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!terrainReady) {
      console.error(
        "[ConnectionHandler] ❌ Terrain system not ready after 10 seconds!",
      );
      if (ws && typeof ws.close === "function") {
        ws.close(1001, "Server terrain not ready");
      }
      return false;
    }

    return true;
  }

  /**
   * Calculate spawn position grounded to terrain
   *
   * Tries to load saved position from database, otherwise uses configured
   * spawn point. Grounds position to terrain height.
   *
   * @param socketId - Socket ID (used to lookup saved position)
   * @returns Grounded spawn position [x, y, z]
   * @private
   */
  private async calculateSpawnPosition(
    socketId: string,
  ): Promise<[number, number, number]> {
    const spawn = this.getSpawn();

    // Start with configured spawn point
    let spawnPosition: [number, number, number] = Array.isArray(spawn.position)
      ? [
          Number(spawn.position[0]) || 0,
          Number(spawn.position[1] ?? 50),
          Number(spawn.position[2]) || 0,
        ]
      : [0, 50, 0];

    // Try to load saved position from database
    const databaseSystem = this.world.getSystem("database") as
      | import("../DatabaseSystem").DatabaseSystem
      | undefined;

    if (databaseSystem) {
      try {
        const playerRow = await databaseSystem.getPlayerAsync(socketId);
        if (playerRow && playerRow.positionX !== undefined) {
          const savedY =
            playerRow.positionY !== undefined && playerRow.positionY !== null
              ? Number(playerRow.positionY)
              : 50;

          // Only use saved Y if reasonable
          if (savedY >= -5 && savedY <= 200) {
            spawnPosition = [
              Number(playerRow.positionX) || 0,
              savedY,
              Number(playerRow.positionZ) || 0,
            ];
          }
        }
      } catch {
        // Failed to load, use default
      }
    }

    // Ground to terrain
    const terrain = this.world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;

    if (terrain && terrain.isReady && terrain.isReady()) {
      const terrainHeight = terrain.getHeightAt(
        spawnPosition[0],
        spawnPosition[2],
      );

      if (
        Number.isFinite(terrainHeight) &&
        terrainHeight > -100 &&
        terrainHeight < 1000
      ) {
        spawnPosition[1] = terrainHeight + 0.1;
      } else {
        spawnPosition[1] = 10;
      }
    } else {
      spawnPosition[1] = 10;
    }

    return spawnPosition;
  }

  /**
   * Create and send initial snapshot to client
   *
   * The snapshot contains everything the client needs to render the world:
   * server time, settings, chat, entities, character list, etc.
   *
   * @param socket - Socket to send snapshot to
   * @param data - Snapshot data from connection flow
   * @private
   */
  private async sendSnapshot(
    socket: ServerSocket,
    data: {
      user: { id: string; name: string };
      authToken?: string;
      userWithPrivy?: { privyUserId?: string | null };
      livekit?: unknown;
      characters: unknown[];
      spawnPosition: [number, number, number];
    },
  ): Promise<void> {
    const baseSnapshot = {
      id: socket.id,
      serverTime: performance.now(),
      assetsUrl: this.world.assetsUrl,
      apiUrl: process.env.PUBLIC_API_URL,
      maxUploadSize: process.env.PUBLIC_MAX_UPLOAD_SIZE,
      settings: this.world.settings.serialize() || {},
      chat: this.world.chat.serialize() || [],
      entities: this.serializeEntities(socket),
      livekit: data.livekit,
      authToken: data.authToken || "",
      account: {
        accountId: data.user.id,
        name: data.user.name,
        providers: {
          privyUserId: data.userWithPrivy?.privyUserId || null,
        },
      },
      characters: data.characters,
    };

    socket.send("snapshot", baseSnapshot);
  }

  /**
   * Serialize all entities for snapshot
   *
   * Returns array of serialized entities, with player's own entity first
   * if they have one.
   *
   * @param socket - Socket requesting snapshot
   * @returns Array of serialized entities
   * @private
   */
  private serializeEntities(socket: ServerSocket): unknown[] {
    const allEntities: unknown[] = [];

    if (socket.player) {
      allEntities.push(socket.player.serialize());

      if (this.world.entities?.items) {
        for (const [entityId, entity] of this.world.entities.items.entries()) {
          if (entityId !== socket.player.id) {
            allEntities.push(entity.serialize());
          }
        }
      }
    }

    return allEntities;
  }

  /**
   * Send resource snapshot to client
   *
   * Provides current state of all resources (trees, rocks, etc.) including
   * availability and respawn times.
   *
   * @param socket - Socket to send resource snapshot to
   * @private
   */
  private async sendResourceSnapshot(socket: ServerSocket): Promise<void> {
    try {
      const resourceSystem = this.world.getSystem?.("resource") as
        | ResourceSystem
        | undefined;
      const resources = resourceSystem?.getAllResources?.() || [];

      const payload = {
        resources: resources.map((r) => ({
          id: r.id,
          type: r.type,
          position: r.position,
          isAvailable: r.isAvailable,
          respawnAt:
            !r.isAvailable && r.lastDepleted && r.respawnTime
              ? r.lastDepleted + r.respawnTime
              : undefined,
        })),
      };

      this.broadcast.sendToSocket(socket.id, "resourceSnapshot", payload);
    } catch {
      // Resource system not available or error, skip
    }
  }

  /**
   * Emit player joined event and broadcast to other clients
   *
   * Notifies all systems that a player has joined and broadcasts
   * their entity to other connected players.
   *
   * @param socket - Socket that joined
   * @private
   */
  private emitPlayerJoined(socket: ServerSocket): void {
    const playerId = socket.player!.data.id as string;

    this.world.emit(EventType.PLAYER_JOINED, {
      playerId,
      player:
        socket.player as unknown as import("@hyperscape/shared").PlayerLocal,
    });

    try {
      this.broadcast.sendToAll(
        "entityAdded",
        socket.player!.serialize(),
        socket.id,
      );
    } catch (err) {
      console.error(
        "[ConnectionHandler] Failed to broadcast entityAdded for new player:",
        err,
      );
    }
  }
}
