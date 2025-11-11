/**
 * ServerNetwork - Authoritative multiplayer networking system
 *
 * This is the server-side networking system that manages all WebSocket connections,
 * player state synchronization, and authoritative game logic. It's the "brain" of
 * the multiplayer server.
 *
 * **Core Responsibilities**:
 * 1. **Connection Management** - Accept/validate WebSocket connections, handle disconnects
 * 2. **Authentication** - Verify Privy tokens or JWT, create/load user accounts
 * 3. **Character System** - Character selection, creation, and spawning
 * 4. **Player State** - Authoritative position, movement, combat, inventory
 * 5. **Event Broadcasting** - Relay player actions to other clients
 * 6. **Command Processing** - Handle slash commands (/move, /admin, etc.)
 * 7. **Position Validation** - Prevent cheating by validating player positions
 *
 * **Modular Architecture**:
 * This file now coordinates between specialized modules:
 * - authentication.ts - Privy and JWT authentication
 * - character-selection.ts - Character management and spawning
 * - movement.ts - Server-authoritative movement system
 * - socket-management.ts - WebSocket health monitoring
 * - handlers/* - Individual packet handlers (chat, combat, inventory, etc.)
 *
 * @see {@link ServerNetwork/authentication} for authentication logic
 * @see {@link ServerNetwork/movement} for movement system
 * @see {@link ServerNetwork/socket-management} for connection health
 */

import type {
  ConnectionParams,
  NetworkWithSocket,
  NodeWebSocket,
  SpawnData,
  WorldOptions,
  SystemDatabase,
  ServerSocket,
  ResourceSystem,
} from "../types";
import {
  EventType,
  Socket,
  System,
  dbHelpers,
  hasRole,
  isDatabaseInstance,
  writePacket,
  TerrainSystem,
  World,
} from "@hyperscape/shared";

// Import modular components
import { authenticateUser } from "./authentication";
import {
  loadCharacterList,
  handleCharacterListRequest,
  handleCharacterCreate,
  handleCharacterSelected,
  handleEnterWorld,
} from "./character-selection";
import { MovementManager } from "./movement";
import { SocketManager } from "./socket-management";
import { handleChatAdded } from "./handlers/chat";
import { handleAttackMob } from "./handlers/combat";
import { handlePickupItem, handleDropItem } from "./handlers/inventory";
import { handleResourceGather } from "./handlers/resources";
import {
  handleEntityModified,
  handleEntityEvent,
  handleEntityRemoved,
  handleSettings,
} from "./handlers/entities";
import { handleCommand } from "./handlers/commands";

const SAVE_INTERVAL = parseInt(process.env.SAVE_INTERVAL || "60"); // seconds
const defaultSpawn = '{ "position": [0, 50, 0], "quaternion": [0, 0, 0, 1] }'; // Safe default height

type QueueItem = [ServerSocket, string, unknown];

/**
 * Network message handler function type
 */
type NetworkHandler = (
  socket: ServerSocket,
  data: unknown,
) => void | Promise<void>;

/**
 * ServerNetwork - Authoritative multiplayer networking system
 *
 * Coordinates between specialized modules to handle all server networking.
 * This refactored version delegates most logic to focused modules while
 * maintaining the same external API.
 */
export class ServerNetwork extends System implements NetworkWithSocket {
  /** Unique network ID (incremented for each connection) */
  id: number;

  /** Counter for assigning network IDs */
  ids: number;

  /** Map of all active WebSocket connections by socket ID */
  sockets: Map<string, ServerSocket>;

  /** Interval handle for periodic player data saves */
  saveTimerId: NodeJS.Timeout | null;

  /** Flag indicating this is the server network (true) */
  isServer: boolean;

  /** Flag indicating this is a client network (false) */
  isClient: boolean;

  /** Queue of outgoing messages to be batched and sent */
  queue: QueueItem[];

  /** Database instance for persistence operations */
  db!: SystemDatabase;

  /** Default spawn point for new players */
  spawn: SpawnData;

  /** Maximum upload file size in bytes */
  maxUploadSize: number;

  // Position validation
  private lastValidationTime = 0;
  private validationInterval = 100; // Start aggressive, then slow to 1000ms
  private systemUptime = 0;

  // Handler method registry
  private handlers: Record<string, NetworkHandler> = {};

  // Modular managers
  private movementManager!: MovementManager;
  private socketManager!: SocketManager;

  constructor(world: World) {
    super(world);
    this.id = 0;
    this.ids = -1;
    this.sockets = new Map();
    this.saveTimerId = null;
    this.isServer = true;
    this.isClient = false;
    this.queue = [];
    this.spawn = JSON.parse(defaultSpawn);
    this.maxUploadSize = 50; // Default 50MB upload limit

    // Initialize managers (after world is set)
    this.movementManager = new MovementManager(
      this.world,
      this.send.bind(this),
    );
    this.socketManager = new SocketManager(
      this.sockets,
      this.world,
      this.send.bind(this),
    );

    // Register handler methods (delegates to modular handlers)
    this.handlers["onChatAdded"] = (socket, data) =>
      handleChatAdded(socket, data, this.world, this.send.bind(this));

    this.handlers["onCommand"] = (socket, data) =>
      handleCommand(
        socket,
        data,
        this.world,
        this.db,
        this.send.bind(this),
        this.isBuilder.bind(this),
      );

    this.handlers["onEntityModified"] = (socket, data) =>
      handleEntityModified(socket, data, this.world, this.send.bind(this));

    this.handlers["onEntityEvent"] = (socket, data) =>
      handleEntityEvent(socket, data, this.world);

    this.handlers["onEntityRemoved"] = (socket, data) =>
      handleEntityRemoved(socket, data);

    this.handlers["onSettings"] = (socket, data) =>
      handleSettings(socket, data);

    this.handlers["onResourceGather"] = (socket, data) =>
      handleResourceGather(socket, data, this.world);

    this.handlers["onMoveRequest"] = (socket, data) =>
      this.movementManager.handleMoveRequest(socket, data);

    this.handlers["onInput"] = (socket, data) =>
      this.movementManager.handleInput(socket, data);

    this.handlers["onAttackMob"] = (socket, data) =>
      handleAttackMob(socket, data, this.world);

    this.handlers["onPickupItem"] = (socket, data) =>
      handlePickupItem(socket, data, this.world);

    this.handlers["onDropItem"] = (socket, data) =>
      handleDropItem(socket, data, this.world);

    // Character selection handlers
    this.handlers["onCharacterListRequest"] = (socket) =>
      handleCharacterListRequest(socket, this.world);

    this.handlers["onCharacterCreate"] = (socket, data) =>
      handleCharacterCreate(socket, data, this.world, this.sendTo.bind(this));

    this.handlers["onCharacterSelected"] = (socket, data) =>
      handleCharacterSelected(socket, data, this.sendTo.bind(this));

    this.handlers["onEnterWorld"] = (socket, data) =>
      handleEnterWorld(
        socket,
        data,
        this.world,
        this.spawn,
        this.send.bind(this),
        this.sendTo.bind(this),
      );
  }

  async init(options: WorldOptions): Promise<void> {
    // Validate that db exists and has the expected shape
    if (!options.db || !isDatabaseInstance(options.db)) {
      throw new Error(
        "[ServerNetwork] Valid database instance not provided in options",
      );
    }

    this.db = options.db;
  }

  async start(): Promise<void> {
    if (!this.db) {
      throw new Error("[ServerNetwork] Database not available in start method");
    }

    // get spawn
    const spawnRow = (await this.db("config").where("key", "spawn").first()) as
      | { value?: string }
      | undefined;
    const spawnValue = spawnRow?.value || defaultSpawn;
    this.spawn = JSON.parse(spawnValue);

    // hydrate entities
    const entities = await this.db("entities");
    if (entities && Array.isArray(entities)) {
      for (const entity of entities) {
        const entityWithData = entity as { data: string };
        const data = JSON.parse(entityWithData.data);
        data.state = {};
        if (this.world.entities.add) {
          this.world.entities.add(data, true);
        }
      }
    }

    // hydrate settings
    const settingsRow = (await this.db("config")
      .where("key", "settings")
      .first()) as { value?: string } | undefined;
    try {
      const settings = JSON.parse(settingsRow?.value || "{}");
      if (this.world.settings.deserialize) {
        this.world.settings.deserialize(settings);
      }
    } catch (_err) {
      console.error(_err);
    }

    // watch settings changes
    if (this.world.settings.on) {
      this.world.settings.on("change", this.saveSettings);
    }

    // queue first save
    if (SAVE_INTERVAL) {
      this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);
    }

    // Bridge important resource events to all clients
    try {
      this.world.on(EventType.RESOURCE_DEPLETED, (...args: unknown[]) =>
        this.send("resourceDepleted", args[0]),
      );
      this.world.on(EventType.RESOURCE_RESPAWNED, (...args: unknown[]) =>
        this.send("resourceRespawned", args[0]),
      );
      this.world.on(EventType.RESOURCE_SPAWNED, (...args: unknown[]) =>
        this.send("resourceSpawned", args[0]),
      );
      this.world.on(
        EventType.RESOURCE_SPAWN_POINTS_REGISTERED,
        (...args: unknown[]) => this.send("resourceSpawnPoints", args[0]),
      );
      this.world.on(EventType.INVENTORY_UPDATED, (...args: unknown[]) => {
        this.send("inventoryUpdated", args[0]);
      });
      this.world.on(EventType.SKILLS_UPDATED, (payload: unknown) => {
        const data = payload as { playerId?: string; skills?: unknown };
        if (data?.playerId) {
          this.sendToPlayerId(data.playerId, "skillsUpdated", data);
        } else {
          this.send("skillsUpdated", payload);
        }
      });
      this.world.on(EventType.UI_UPDATE, (payload: unknown) => {
        const data = payload as
          | { component?: string; data?: { playerId?: string } }
          | undefined;
        if (data?.component === "player" && data.data?.playerId) {
          this.sendToPlayerId(data.data.playerId, "playerState", data.data);
        }
      });
      this.world.on(EventType.INVENTORY_INITIALIZED, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          inventory: { items: unknown[]; coins: number; maxSlots: number };
        };
        const packet = {
          playerId: data.playerId,
          items: data.inventory.items,
          coins: data.inventory.coins,
          maxSlots: data.inventory.maxSlots,
        };
        this.sendToPlayerId(data.playerId, "inventoryUpdated", packet);
      });
      this.world.on(EventType.INVENTORY_REQUEST, (payload: unknown) => {
        const data = payload as { playerId: string };
        try {
          const invSystem = this.world.getSystem?.("inventory") as
            | {
                getInventoryData?: (id: string) => {
                  items: unknown[];
                  coins: number;
                  maxSlots: number;
                };
              }
            | undefined;
          const inv = invSystem?.getInventoryData
            ? invSystem.getInventoryData(data.playerId)
            : { items: [], coins: 0, maxSlots: 28 };
          const packet = {
            playerId: data.playerId,
            items: inv.items,
            coins: inv.coins,
            maxSlots: inv.maxSlots,
          };
          this.sendToPlayerId(data.playerId, "inventoryUpdated", packet);
        } catch {}
      });
    } catch (_err) {}
  }

  override destroy(): void {
    this.socketManager.destroy();
    if (this.saveTimerId) {
      clearTimeout(this.saveTimerId);
      this.saveTimerId = null;
    }
    this.world.settings.off("change", this.saveSettings);
    for (const [_id, socket] of this.sockets) {
      socket.close?.();
    }
    this.sockets.clear();
  }

  override preFixedUpdate(): void {
    this.flush();
  }

  override update(dt: number): void {
    // Track uptime for validation interval adjustment
    this.systemUptime += dt;
    if (this.systemUptime > 10 && this.validationInterval < 1000) {
      this.validationInterval = 1000; // Slow down after 10 seconds
    }

    // Validate player positions periodically
    this.lastValidationTime += dt * 1000;
    if (this.lastValidationTime >= this.validationInterval) {
      this.validatePlayerPositions();
      this.lastValidationTime = 0;
    }

    // Delegate movement updates to MovementManager
    this.movementManager.update(dt);
  }

  send<T = unknown>(name: string, data: T, ignoreSocketId?: string): void {
    const packet = writePacket(name, data);
    let sentCount = 0;
    this.sockets.forEach((socket) => {
      if (socket.id === ignoreSocketId) {
        return;
      }
      socket.sendPacket(packet);
      sentCount++;
    });
  }

  sendTo<T = unknown>(socketId: string, name: string, data: T): void {
    const socket = this.sockets.get(socketId);
    socket?.send(name, data);
  }

  private sendToPlayerId<T = unknown>(
    playerId: string,
    name: string,
    data: T,
  ): boolean {
    for (const socket of this.sockets.values()) {
      if (socket.player && socket.player.id === playerId) {
        socket.send(name, data);
        return true;
      }
    }
    return false;
  }

  /**
   * Delegate socket health checking to SocketManager
   */
  checkSockets(): void {
    this.socketManager.checkSockets();
  }

  enqueue(socket: ServerSocket | Socket, method: string, data: unknown): void {
    this.queue.push([socket as ServerSocket, method, data]);
  }

  /**
   * Delegate disconnection handling to SocketManager
   */
  onDisconnect(socket: ServerSocket | Socket, code?: number | string): void {
    this.socketManager.handleDisconnect(socket as ServerSocket, code);
  }

  flush(): void {
    while (this.queue.length) {
      const [socket, method, data] = this.queue.shift()!;
      const handler = this.handlers[method];
      if (handler) {
        const result = handler.call(this, socket, data);
        if (result && typeof result.then === "function") {
          result.catch((err: Error) => {
            console.error(
              `[ServerNetwork] Error in async handler ${method}:`,
              err,
            );
          });
        }
      } else {
        console.warn(`[ServerNetwork] No handler for packet: ${method}`);
      }
    }
  }

  getTime(): number {
    return performance.now() / 1000; // seconds
  }

  save = async (): Promise<void> => {
    this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);
  };

  saveSettings = async (): Promise<void> => {
    const data = this.world.settings.serialize
      ? this.world.settings.serialize()
      : {};
    const value = JSON.stringify(data);
    await dbHelpers.setConfig(this.db, "settings", value);
  };

  isAdmin(player: { data?: { roles?: string[] } }): boolean {
    return hasRole(player.data?.roles as string[] | undefined, "admin");
  }

  isBuilder(player: { data?: { roles?: string[] } }): boolean {
    return this.world.settings.public || this.isAdmin(player);
  }

  async onConnection(
    ws: NodeWebSocket,
    params: ConnectionParams,
  ): Promise<void> {
    try {
      if (!ws || typeof ws.close !== "function") {
        console.error(
          "[ServerNetwork] Invalid websocket provided to onConnection",
        );
        return;
      }

      // Check player limit
      const playerLimit = this.world.settings.playerLimit;
      if (
        typeof playerLimit === "number" &&
        playerLimit > 0 &&
        this.sockets.size >= playerLimit
      ) {
        const packet = writePacket("kick", "player_limit");
        ws.send(packet);
        ws.close();
        return;
      }

      // Delegate authentication to authentication module
      const { user, authToken, userWithPrivy } = await authenticateUser(
        params,
        this.db,
      );

      // Get LiveKit options if available
      const livekit = await this.world.livekit?.getPlayerOpts?.(user.id);

      // Create socket
      const socketId = require("@hyperscape/shared").uuid();
      const socket = new Socket({
        id: socketId,
        ws,
        network: this,
        player: undefined,
      }) as ServerSocket;
      socket.accountId = user.id;

      // Wait for terrain system to be ready
      const terrain = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
      if (terrain) {
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
            "[ServerNetwork] ❌ Terrain system not ready after 10 seconds!",
          );
          if (ws && typeof ws.close === "function") {
            ws.close(1001, "Server terrain not ready");
          }
          return;
        }
      }

      // Load character list
      const characters = await loadCharacterList(user.id, this.world);

      // Ground spawn position to terrain
      const databaseSystem = this.world.getSystem("database") as
        | import("../DatabaseSystem").DatabaseSystem
        | undefined;
      let spawnPosition: [number, number, number] = Array.isArray(
        this.spawn.position,
      )
        ? [
            Number(this.spawn.position[0]) || 0,
            Number(this.spawn.position[1] ?? 50),
            Number(this.spawn.position[2]) || 0,
          ]
        : [0, 50, 0];

      // Try to load saved position
      if (databaseSystem) {
        try {
          const playerRow = await databaseSystem.getPlayerAsync(socketId);
          if (playerRow && playerRow.positionX !== undefined) {
            const savedY =
              playerRow.positionY !== undefined && playerRow.positionY !== null
                ? Number(playerRow.positionY)
                : 50;
            if (savedY >= -5 && savedY <= 200) {
              spawnPosition = [
                Number(playerRow.positionX) || 0,
                savedY,
                Number(playerRow.positionZ) || 0,
              ];
            }
          }
        } catch {}
      }

      // Ground to terrain
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

      // Create snapshot
      const baseSnapshot = {
        id: socket.id,
        serverTime: performance.now(),
        assetsUrl: this.world.assetsUrl,
        apiUrl: process.env.PUBLIC_API_URL,
        maxUploadSize: process.env.PUBLIC_MAX_UPLOAD_SIZE,
        settings: this.world.settings.serialize() || {},
        chat: this.world.chat.serialize() || [],
        entities: (() => {
          const allEntities: unknown[] = [];
          if (socket.player) {
            allEntities.push(socket.player.serialize());
            if (this.world.entities?.items) {
              for (const [
                entityId,
                entity,
              ] of this.world.entities.items.entries()) {
                if (entityId !== socket.player.id) {
                  allEntities.push(entity.serialize());
                }
              }
            }
          }
          return allEntities;
        })(),
        livekit,
        authToken: authToken || "",
        account: {
          accountId: user.id,
          name: user.name,
          providers: {
            privyUserId: userWithPrivy?.privyUserId || null,
          },
        },
        characters,
      };

      socket.send("snapshot", baseSnapshot);

      // Send resource snapshot
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
        this.sendTo(socket.id, "resourceSnapshot", payload);
      } catch (_err) {}

      this.sockets.set(socket.id, socket);

      // Emit player joined event if player was created
      if (socket.player) {
        const playerId = socket.player.data.id as string;
        this.world.emit(EventType.PLAYER_JOINED, {
          playerId,
          player:
            socket.player as unknown as import("@hyperscape/shared").PlayerLocal,
        });
        try {
          this.send("entityAdded", socket.player.serialize(), socket.id);
        } catch (err) {
          console.error(
            "[ServerNetwork] Failed to broadcast entityAdded for new player:",
            err,
          );
        }
      }
    } catch (_err) {
      console.error(_err);
    }
  }

  /**
   * Validate all player positions against terrain
   */
  private validatePlayerPositions(): void {
    const terrain = this.world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;
    if (!terrain) return;

    for (const socket of this.sockets.values()) {
      if (!socket.player) continue;

      const player = socket.player;
      const currentY = player.position.y;
      const terrainHeight = terrain.getHeightAt(
        player.position.x,
        player.position.z,
      );

      // Only correct if significantly wrong
      if (!Number.isFinite(currentY) || currentY < -5 || currentY > 200) {
        // Emergency correction
        const correctedY = Number.isFinite(terrainHeight)
          ? terrainHeight + 0.1
          : 10;
        player.position.y = correctedY;
        if (player.data) {
          player.data.position = [
            player.position.x,
            correctedY,
            player.position.z,
          ];
        }
        this.send("entityModified", {
          id: player.id,
          changes: { p: [player.position.x, correctedY, player.position.z] },
        });
      } else if (Number.isFinite(terrainHeight)) {
        const expectedY = terrainHeight + 0.1;
        const errorMargin = Math.abs(currentY - expectedY);

        if (errorMargin > 10) {
          player.position.y = expectedY;
          if (player.data) {
            player.data.position = [
              player.position.x,
              expectedY,
              player.position.z,
            ];
          }
          this.send("entityModified", {
            id: player.id,
            changes: { p: [player.position.x, expectedY, player.position.z] },
          });
        }
      }
    }
  }
}
