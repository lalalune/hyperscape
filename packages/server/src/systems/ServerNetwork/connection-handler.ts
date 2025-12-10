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
  uuid,
} from "@hyperscape/shared";
import type {
  ConnectionParams,
  NodeWebSocket,
  ServerSocket,
  SpawnData,
  ResourceSystem,
  NetworkWithSocket,
  SystemDatabase,
} from "../../shared/types";
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

      // Check for spectator mode - spectators don't need authentication
      const isSpectator = params.mode === "spectator";

      if (isSpectator) {
        await this.handleSpectatorConnection(ws, params);
        return;
      }

      // Check player limit (only for players, not spectators)
      if (!this.checkPlayerLimit(ws)) {
        return;
      }

      // Get client IP from params (passed from websocket layer)
      const clientIP = (params as { clientIP?: string }).clientIP || "unknown";

      // Authenticate user (may return null if rate limited)
      const authResult = await authenticateUser(params, this.db, clientIP);

      // Handle rate limiting - close connection gracefully
      if (!authResult) {
        console.warn(
          `[ConnectionHandler] Account creation rate limited for IP: ${clientIP}`,
        );
        ws.close(4029, "Account creation rate limited");
        return;
      }

      const { user, authToken, userWithPrivy } = authResult;

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

      // Remove old socket for same account (prevents duplicate connections)
      // Grace period: Only close old sockets that are stale (no player after 10s) or have a player
      // This prevents closing sockets that are still in the spawn process
      const GRACE_PERIOD_MS = 10000; // 10 seconds
      for (const [oldSocketId, oldSocket] of this.sockets) {
        if (
          oldSocket.accountId === socket.accountId &&
          oldSocketId !== socket.id
        ) {
          const socketAge = Date.now() - (oldSocket.createdAt || 0);
          const hasPlayer = !!oldSocket.player;
          const isStale = socketAge > GRACE_PERIOD_MS;

          // Only close if the old socket has a player (legitimate reconnection)
          // OR if it's been idle for too long without spawning a player (stale connection)
          if (hasPlayer || isStale) {
            console.warn(
              `[ConnectionHandler] 🔄 Detected reconnection for account ${socket.accountId}`,
            );
            console.warn(
              `[ConnectionHandler] Closing old socket ${oldSocketId} (hasPlayer: ${hasPlayer}, age: ${Math.round(socketAge / 1000)}s), replacing with new socket ${socket.id}`,
            );
            oldSocket.ws?.close?.();
            this.sockets.delete(oldSocketId);
          } else {
            console.warn(
              `[ConnectionHandler] ⏳ Found recent socket ${oldSocketId} for account ${socket.accountId} (age: ${Math.round(socketAge / 1000)}s, no player yet)`,
            );
            console.warn(
              `[ConnectionHandler] ❌ Rejecting new connection ${socket.id} - socket ${oldSocketId} is still spawning (within grace period)`,
            );
            // Close the NEW connection and don't register it
            socket.ws?.close?.();
            return;
          }
        }
      }

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
    const socketId = uuid();

    const socket = new Socket({
      id: socketId,
      ws,
      network: this.world.network as unknown as NetworkWithSocket,
      player: undefined,
    }) as ServerSocket;
    socket.accountId = accountId;
    socket.createdAt = Date.now(); // Track creation time for reconnection grace period

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
    const isSpectator = (socket as ServerSocket & { isSpectator?: boolean }).isSpectator === true;

    if (isSpectator) {
      // Spectators don't have a player entity - serialize all world entities
      if (this.world.entities?.items) {
        for (const [_entityId, entity] of this.world.entities.items.entries()) {
          const serialized = entity.serialize();
          allEntities.push(serialized);
        }
      }
    } else if (socket.player) {
      // Normal players: serialize their player first, then other entities
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

  /**
   * Handle spectator connection
   *
   * Spectators are read-only connections that don't spawn players.
   * They receive entity updates but cannot send commands.
   *
   * SECURITY: Spectators must authenticate via JWT/Privy token to prove identity.
   * The server verifies the token and checks character ownership - we never trust
   * client-provided user IDs directly.
   *
   * @param ws - WebSocket connection
   * @param params - Connection parameters
   * @private
   */
  private async handleSpectatorConnection(
    ws: NodeWebSocket,
    params: ConnectionParams,
  ): Promise<void> {
    try {
      const characterId = params.followEntity || params.characterId;

      // SECURITY: Require character ID
      if (!characterId) {
        console.warn(
          "[ConnectionHandler] ❌ Spectator missing characterId/followEntity",
        );
        ws.close(4003, "Missing character ID");
        return;
      }

      // SECURITY: Require authentication token - we verify identity server-side
      if (!params.authToken) {
        console.warn(
          "[ConnectionHandler] ❌ Spectator missing authToken for authentication",
        );
        ws.close(4001, "Authentication required for spectator mode");
        return;
      }

      // SECURITY: Authenticate the user via the same flow as regular connections
      // This verifies the JWT/Privy token and returns the verified user
      let verifiedUserId: string | null = null;

      try {
        const { user } = await authenticateUser(params, this.db);
        verifiedUserId = user.id;
        console.log(
          `[ConnectionHandler] 🔐 Spectator authenticated as: ${verifiedUserId}`,
        );
      } catch (authErr) {
        console.warn(
          "[ConnectionHandler] ❌ Spectator authentication failed:",
          authErr,
        );
        ws.close(4001, "Authentication failed");
        return;
      }

      if (!verifiedUserId) {
        console.warn(
          "[ConnectionHandler] ❌ Spectator authentication returned no user",
        );
        ws.close(4001, "Authentication failed");
        return;
      }

      // SECURITY: Verify this character belongs to the authenticated user
      const databaseSystem = this.world.getSystem("database") as
        | import("../DatabaseSystem").DatabaseSystem
        | undefined;

      if (!databaseSystem) {
        console.error(
          "[ConnectionHandler] ❌ DatabaseSystem not available for ownership verification",
        );
        ws.close(5000, "Server error");
        return;
      }

      const characters =
        await databaseSystem.getCharactersAsync(verifiedUserId);
      const ownsCharacter = characters.some((c) => c.id === characterId);

      if (!ownsCharacter) {
        console.warn(
          `[ConnectionHandler] ❌ SECURITY: Verified user ${verifiedUserId} does not own character ${characterId}. Rejecting spectator.`,
        );
        ws.close(
          4003,
          "Permission denied - character not owned by this account",
        );
        return;
      }

      console.log(
        `[ConnectionHandler] ✅ Spectator ownership verified: ${verifiedUserId} owns ${characterId}`,
      );

      // Create socket with verified accountId
      const socketId = uuid();

      const socket = new Socket({
        id: socketId,
        ws,
        network: this.world.network as unknown as NetworkWithSocket,
        player: undefined,
      }) as ServerSocket;

      // Mark as spectator with VERIFIED accountId (not client-provided)
      socket.accountId = verifiedUserId;
      socket.createdAt = Date.now();
      (socket as ServerSocket & { isSpectator?: boolean; spectatingCharacterId?: string }).isSpectator = true;
      (socket as ServerSocket & { isSpectator?: boolean; spectatingCharacterId?: string }).spectatingCharacterId = characterId;

      // Wait for terrain system
      if (!(await this.waitForTerrain(ws))) {
        return;
      }

      // Send snapshot to spectator (no character list, no auth token)
      await this.sendSpectatorSnapshot(socket, params);

      // Send resource snapshot
      await this.sendResourceSnapshot(socket);

      // Register spectator socket
      this.sockets.set(socket.id, socket);
    } catch (err) {
      console.error(
        "[ConnectionHandler] Error in handleSpectatorConnection:",
        err,
      );
    }
  }

  /**
   * Create and send spectator snapshot
   *
   * Spectators receive a limited snapshot with no authentication or character data.
   *
   * @param socket - Spectator socket
   * @param params - Connection parameters (may include followEntity hint)
   * @private
   */
  private async sendSpectatorSnapshot(
    socket: ServerSocket,
    params: ConnectionParams,
  ): Promise<void> {
    const spectatorSnapshot = {
      id: socket.id,
      serverTime: performance.now(),
      assetsUrl: this.world.assetsUrl,
      apiUrl: process.env.PUBLIC_API_URL,
      maxUploadSize: process.env.PUBLIC_MAX_UPLOAD_SIZE,
      settings: this.world.settings.serialize() || {},
      chat: this.world.chat.serialize() || [],
      entities: this.serializeEntities(socket),
      livekit: undefined,
      authToken: "", // No auth for spectators
      account: {
        accountId: socket.accountId,
        name: "Spectator",
        providers: {},
      },
      characters: [], // No character selection for spectators
      spectatorMode: true, // Flag for client to recognize spectator mode
      followEntity: params.followEntity || params.characterId, // Hint for which entity to follow
    };

    socket.send("snapshot", spectatorSnapshot);
  }
}
