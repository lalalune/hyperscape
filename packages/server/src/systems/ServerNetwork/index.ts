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
 * - broadcast.ts - Network message broadcasting
 * - save-manager.ts - Periodic state persistence
 * - position-validator.ts - Anti-cheat position validation
 * - event-bridge.ts - World event to network message bridge
 * - initialization.ts - Startup state loading
 * - connection-handler.ts - WebSocket connection flow
 * - handlers/* - Individual packet handlers (chat, combat, inventory, etc.)
 *
 * @see {@link ServerNetwork/authentication} for authentication logic
 * @see {@link ServerNetwork/movement} for movement system
 * @see {@link ServerNetwork/socket-management} for connection health
 * @see {@link ServerNetwork/broadcast} for message broadcasting
 * @see {@link ServerNetwork/connection-handler} for connection flow
 */

import type {
  ConnectionParams,
  NetworkWithSocket,
  NodeWebSocket,
  SpawnData,
  WorldOptions,
  SystemDatabase,
  ServerSocket,
} from "../../shared/types";
import {
  Socket,
  System,
  hasRole,
  isDatabaseInstance,
  World,
  EventType,
  CombatSystem,
  LootSystem,
  ResourceSystem,
} from "@hyperscape/shared";

// PlayerDeathSystem type for tick processing (not exported from main index)
interface PlayerDeathSystemWithTick {
  processTick(currentTick: number): void;
}

// Import modular components
import {
  handleCharacterListRequest,
  handleCharacterCreate,
  handleCharacterSelected,
  handleEnterWorld,
} from "./character-selection";
import { MovementManager } from "./movement";
import { TileMovementManager } from "./tile-movement";
import { MobTileMovementManager } from "./mob-tile-movement";
import { ActionQueue } from "./action-queue";
import { TickSystem, TickPriority } from "../TickSystem";
import { SocketManager } from "./socket-management";
import { BroadcastManager } from "./broadcast";
import { SaveManager } from "./save-manager";
import { PositionValidator } from "./position-validator";
import { EventBridge } from "./event-bridge";
import { InitializationManager } from "./initialization";
import { ConnectionHandler } from "./connection-handler";
import { handleChatAdded } from "./handlers/chat";
import { handleAttackMob, handleChangeAttackStyle } from "./handlers/combat";
import {
  handlePickupItem,
  handleDropItem,
  handleEquipItem,
  handleUnequipItem,
} from "./handlers/inventory";
import { handleResourceGather } from "./handlers/resources";
import {
  handleBankOpen,
  handleBankDeposit,
  handleBankWithdraw,
  handleBankDepositAll,
  handleBankClose,
} from "./handlers/bank";
import {
  handleEntityModified,
  handleEntityEvent,
  handleEntityRemoved,
  handleSettings,
} from "./handlers/entities";
import { handleCommand } from "./handlers/commands";
import {
  handleStoreOpen,
  handleStoreBuy,
  handleStoreSell,
  handleStoreClose,
} from "./handlers/store";

const defaultSpawn = '{ "position": [0, 50, 0], "quaternion": [0, 0, 0, 1] }';

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

  /** Handler method registry */
  private handlers: Record<string, NetworkHandler> = {};

  /** Agent goal storage (characterId -> goal data) for dashboard display */
  static agentGoals: Map<string, unknown> = new Map();

  /** Agent available goals storage (characterId -> available goals) for dashboard selection */
  static agentAvailableGoals: Map<string, unknown[]> = new Map();

  /** Character ID to socket mapping for sending goal overrides */
  static characterSockets: Map<string, ServerSocket> = new Map();

  /** Modular managers */
  private movementManager!: MovementManager;
  private tileMovementManager!: TileMovementManager;
  private mobTileMovementManager!: MobTileMovementManager;
  private actionQueue!: ActionQueue;
  private tickSystem!: TickSystem;
  private socketManager!: SocketManager;
  private broadcastManager!: BroadcastManager;
  private saveManager!: SaveManager;
  private positionValidator!: PositionValidator;
  private eventBridge!: EventBridge;
  private initializationManager!: InitializationManager;
  private connectionHandler!: ConnectionHandler;

  constructor(world: World) {
    super(world);
    this.id = 0;
    this.ids = -1;
    this.sockets = new Map();
    this.isServer = true;
    this.isClient = false;
    this.queue = [];
    this.spawn = JSON.parse(defaultSpawn);
    this.maxUploadSize = 50; // Default 50MB upload limit

    // Initialize managers will happen in init() after world.db is set
  }

  /**
   * Initialize managers after database is available
   *
   * Managers need access to world and database, so we initialize them
   * after world.init() sets world.db.
   */
  private initializeManagers(): void {
    // Broadcast manager (needed by many others)
    this.broadcastManager = new BroadcastManager(this.sockets);

    // Legacy movement manager (for compatibility)
    this.movementManager = new MovementManager(
      this.world,
      this.broadcastManager.sendToAll.bind(this.broadcastManager),
    );

    // Tick system for RuneScape-style 600ms ticks
    this.tickSystem = new TickSystem();

    // Tile-based movement manager (RuneScape-style)
    this.tileMovementManager = new TileMovementManager(
      this.world,
      this.broadcastManager.sendToAll.bind(this.broadcastManager),
    );

    // Action queue for OSRS-style input processing
    this.actionQueue = new ActionQueue();

    // Set up action queue handlers - these execute the actual game logic
    this.actionQueue.setHandlers({
      movement: (socket, data) => {
        this.tileMovementManager.handleMoveRequest(socket, data);
      },
      combat: (socket, data) => {
        // Combat actions trigger the combat system
        const playerEntity = socket.player;
        if (!playerEntity) return;

        const payload = data as { mobId?: string; targetId?: string };
        const targetId = payload.mobId || payload.targetId;
        if (!targetId) return;

        this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
          playerId: playerEntity.id,
          targetId,
          attackerType: "player",
          targetType: "mob",
          attackType: "melee",
        });
      },
      interaction: (socket, data) => {
        // Generic interaction handler - can be extended for object/NPC interactions
        console.log(
          `[ActionQueue] Interaction from ${socket.player?.id}:`,
          data,
        );
      },
    });

    // FIRST: Update world.currentTick on each tick so all systems can read it
    // This must run before any other tick processing (INPUT is earliest priority)
    // Mobs use this to run AI only once per tick instead of every frame
    this.tickSystem.onTick((tickNumber) => {
      this.world.currentTick = tickNumber;
    }, TickPriority.INPUT);

    // Register action queue to process inputs at INPUT priority
    this.tickSystem.onTick((tickNumber) => {
      this.actionQueue.processTick(tickNumber);
    }, TickPriority.INPUT);

    // Register tile movement to run on each tick (after inputs)
    this.tickSystem.onTick((tickNumber) => {
      this.tileMovementManager.onTick(tickNumber);
    }, TickPriority.MOVEMENT);

    // Mob tile-based movement manager (same tick system as players)
    this.mobTileMovementManager = new MobTileMovementManager(
      this.world,
      this.broadcastManager.sendToAll.bind(this.broadcastManager),
    );

    // Register mob tile movement to run on each tick (same priority as player movement)
    this.tickSystem.onTick((tickNumber) => {
      this.mobTileMovementManager.onTick(tickNumber);
    }, TickPriority.MOVEMENT);

    // Register combat system to process on each tick (after movement, before AI)
    // This is OSRS-accurate: combat runs on the game tick, not per-frame
    this.tickSystem.onTick((tickNumber) => {
      const combatSystem = this.world.getSystem(
        "combat",
      ) as CombatSystem | null;
      if (combatSystem) {
        combatSystem.processCombatTick(tickNumber);
      }
    }, TickPriority.COMBAT);

    // Register death system to process on each tick (after combat)
    // Handles gravestone expiration and ground item despawn (OSRS-accurate tick-based timing)
    this.tickSystem.onTick((tickNumber) => {
      const playerDeathSystem = this.world.getSystem(
        "player-death",
      ) as unknown as PlayerDeathSystemWithTick | null;
      if (
        playerDeathSystem &&
        typeof playerDeathSystem.processTick === "function"
      ) {
        playerDeathSystem.processTick(tickNumber);
      }
    }, TickPriority.COMBAT); // Same priority as combat (after movement)

    // Register loot system to process on each tick (after combat)
    // Handles mob corpse despawn (OSRS-accurate tick-based timing)
    this.tickSystem.onTick((tickNumber) => {
      const lootSystem = this.world.getSystem("loot") as LootSystem | null;
      if (
        lootSystem &&
        typeof (lootSystem as unknown as PlayerDeathSystemWithTick)
          .processTick === "function"
      ) {
        (lootSystem as unknown as PlayerDeathSystemWithTick).processTick(
          tickNumber,
        );
      }
    }, TickPriority.COMBAT); // Same priority as combat (after movement)

    // Register resource gathering system to process on each tick (after combat)
    // OSRS-accurate: Woodcutting attempts every 4 ticks (2.4 seconds)
    this.tickSystem.onTick((tickNumber) => {
      const resourceSystem = this.world.getSystem(
        "resource",
      ) as ResourceSystem | null;
      if (
        resourceSystem &&
        typeof resourceSystem.processGatheringTick === "function"
      ) {
        resourceSystem.processGatheringTick(tickNumber);
      }
    }, TickPriority.RESOURCES);

    // Socket manager
    this.socketManager = new SocketManager(
      this.sockets,
      this.world,
      this.broadcastManager.sendToAll.bind(this.broadcastManager),
    );

    // Clean up player state when player disconnects (prevents memory leak)
    this.world.on(EventType.PLAYER_LEFT, (event: { playerId: string }) => {
      this.tileMovementManager.cleanup(event.playerId);
      this.actionQueue.cleanup(event.playerId);
    });

    // Sync tile position when player respawns at spawn point
    // CRITICAL: Without this, TileMovementManager has stale tile position from death location
    // and paths would be calculated from wrong starting tile
    this.world.on(
      EventType.PLAYER_RESPAWNED,
      (event: {
        playerId: string;
        spawnPosition: { x: number; y: number; z: number };
      }) => {
        if (event.playerId && event.spawnPosition) {
          this.tileMovementManager.syncPlayerPosition(
            event.playerId,
            event.spawnPosition,
          );
          // Also clear any pending actions from before death
          this.actionQueue.cleanup(event.playerId);
          console.log(
            `[ServerNetwork] Synced tile position for respawned player ${event.playerId} at (${event.spawnPosition.x}, ${event.spawnPosition.z})`,
          );
        }
      },
    );

    // Handle mob tile movement requests from MobEntity AI
    this.world.on(EventType.MOB_NPC_MOVE_REQUEST, (event) => {
      const moveEvent = event as {
        mobId: string;
        targetPos: { x: number; y: number; z: number };
        targetEntityId?: string;
        tilesPerTick?: number;
      };
      this.mobTileMovementManager.requestMoveTo(
        moveEvent.mobId,
        moveEvent.targetPos,
        moveEvent.targetEntityId || null,
        moveEvent.tilesPerTick,
      );
    });

    // Initialize mob tile movement state on spawn
    // This ensures mobs have proper tile state from the moment they're created
    this.world.on(EventType.MOB_NPC_SPAWNED, (event) => {
      const spawnEvent = event as {
        mobId: string;
        mobType: string;
        position: { x: number; y: number; z: number };
      };
      this.mobTileMovementManager.initializeMob(
        spawnEvent.mobId,
        spawnEvent.position,
        2, // Default walk speed: 2 tiles per tick
      );
    });

    // Clean up mob tile movement state on mob death
    // This immediately clears stale tile state when mob dies
    this.world.on(EventType.NPC_DIED, (event) => {
      const diedEvent = event as { mobId: string };
      this.mobTileMovementManager.cleanup(diedEvent.mobId);
    });

    // Clean up mob tile movement state on mob despawn (backup cleanup)
    this.world.on(EventType.MOB_NPC_DESPAWNED, (event) => {
      const despawnEvent = event as { mobId: string };
      this.mobTileMovementManager.cleanup(despawnEvent.mobId);
    });

    // CRITICAL: Reinitialize mob tile state on respawn
    // Without this, the mob's tile state has stale currentTile from death location
    // causing teleportation when the mob starts moving again
    this.world.on(EventType.MOB_NPC_RESPAWNED, (event) => {
      const respawnEvent = event as {
        mobId: string;
        position: { x: number; y: number; z: number };
      };
      // Clear old state and initialize at new spawn position
      this.mobTileMovementManager.cleanup(respawnEvent.mobId);
      this.mobTileMovementManager.initializeMob(
        respawnEvent.mobId,
        respawnEvent.position,
        2, // Default walk speed: 2 tiles per tick
      );
    });

    // Save manager
    this.saveManager = new SaveManager(this.world, this.db);

    // Position validator
    this.positionValidator = new PositionValidator(
      this.world,
      this.sockets,
      this.broadcastManager,
    );

    // Event bridge
    this.eventBridge = new EventBridge(this.world, this.broadcastManager);

    // Initialization manager
    this.initializationManager = new InitializationManager(this.world, this.db);

    // Connection handler
    this.connectionHandler = new ConnectionHandler(
      this.world,
      this.sockets,
      this.broadcastManager,
      () => this.spawn,
      this.db,
    );

    // Register handlers
    this.registerHandlers();
  }

  /**
   * Register all packet handlers
   *
   * Sets up the handler registry with delegates to modular handlers.
   */
  private registerHandlers(): void {
    // Character selection handlers
    this.handlers["characterSelected"] = (socket, data) =>
      handleCharacterSelected(
        socket,
        data,
        this.world,
        this.broadcastManager.sendTo.bind(this.broadcastManager),
      );

    this.handlers["enterWorld"] = (socket, data) =>
      handleEnterWorld(
        socket,
        data,
        this.world,
        this.db,
        this.broadcastManager.sendToAll.bind(this.broadcastManager),
      );

    this.handlers["onChatAdded"] = (socket, data) =>
      handleChatAdded(
        socket,
        data,
        this.world,
        this.broadcastManager.sendToAll.bind(this.broadcastManager),
      );

    this.handlers["onCommand"] = (socket, data) =>
      handleCommand(
        socket,
        data,
        this.world,
        this.db,
        this.broadcastManager.sendToAll.bind(this.broadcastManager),
        this.isBuilder.bind(this),
      );

    this.handlers["onEntityModified"] = (socket, data) =>
      handleEntityModified(
        socket,
        data,
        this.world,
        this.broadcastManager.sendToAll.bind(this.broadcastManager),
      );

    this.handlers["onEntityEvent"] = (socket, data) =>
      handleEntityEvent(socket, data, this.world);

    this.handlers["onEntityRemoved"] = (socket, data) =>
      handleEntityRemoved(socket, data);

    this.handlers["onSettingsModified"] = (socket, data) =>
      handleSettings(socket, data);

    this.handlers["onResourceGather"] = (socket, data) =>
      handleResourceGather(socket, data, this.world);

    // Route movement and combat through action queue for OSRS-style tick processing
    // Actions are queued and processed on tick boundaries, not immediately
    this.handlers["onMoveRequest"] = (socket, data) => {
      this.actionQueue.queueMovement(socket, data);
    };

    this.handlers["onInput"] = (socket, data) => {
      // Legacy input handler - convert clicks to movement queue
      const payload = data as {
        type?: string;
        target?: number[];
        runMode?: boolean;
      };
      if (payload.type === "click" && Array.isArray(payload.target)) {
        this.actionQueue.queueMovement(socket, {
          target: payload.target,
          runMode: payload.runMode,
        });
      }
    };

    // Combat is queued - OSRS style: clicking enemy queues attack action
    this.handlers["onAttackMob"] = (socket, data) => {
      this.actionQueue.queueCombat(socket, data);
    };

    this.handlers["onChangeAttackStyle"] = (socket, data) =>
      handleChangeAttackStyle(socket, data, this.world);

    this.handlers["onPickupItem"] = (socket, data) =>
      handlePickupItem(socket, data, this.world);

    this.handlers["onDropItem"] = (socket, data) =>
      handleDropItem(socket, data, this.world);

    this.handlers["onEquipItem"] = (socket, data) =>
      handleEquipItem(socket, data, this.world);

    this.handlers["onUnequipItem"] = (socket, data) =>
      handleUnequipItem(socket, data, this.world);

    // Death/respawn handlers
    this.handlers["onRequestRespawn"] = (socket, data) => {
      const playerEntity = socket.player;
      if (playerEntity) {
        console.log(
          `[ServerNetwork] Received respawn request from player ${playerEntity.id}`,
        );
        this.world.emit(EventType.PLAYER_RESPAWN_REQUEST, {
          playerId: playerEntity.id,
        });
      } else {
        console.warn(
          "[ServerNetwork] requestRespawn: no player entity on socket",
        );
      }
    };

    // Character selection handlers
    this.handlers["onCharacterListRequest"] = (socket) =>
      handleCharacterListRequest(socket, this.world);

    this.handlers["onCharacterCreate"] = (socket, data) =>
      handleCharacterCreate(
        socket,
        data,
        this.world,
        this.broadcastManager.sendToSocket.bind(this.broadcastManager),
      );

    this.handlers["onCharacterSelected"] = (socket, data) =>
      handleCharacterSelected(
        socket,
        data,
        this.broadcastManager.sendToSocket.bind(this.broadcastManager),
      );

    this.handlers["onEnterWorld"] = (socket, data) =>
      handleEnterWorld(
        socket,
        data,
        this.world,
        this.spawn,
        this.broadcastManager.sendToAll.bind(this.broadcastManager),
        this.broadcastManager.sendToSocket.bind(this.broadcastManager),
      );

    // Agent goal sync handler - stores goal and available goals for dashboard display
    this.handlers["onSyncGoal"] = (socket, data) => {
      const goalData = data as {
        characterId?: string;
        goal: unknown;
        availableGoals?: unknown[];
      };
      if (goalData.characterId) {
        // Store goal
        ServerNetwork.agentGoals.set(goalData.characterId, goalData.goal);

        // Store available goals if provided
        if (goalData.availableGoals) {
          ServerNetwork.agentAvailableGoals.set(
            goalData.characterId,
            goalData.availableGoals,
          );
        }

        // Track socket for this character (for sending goal overrides)
        ServerNetwork.characterSockets.set(goalData.characterId, socket);

        console.log(
          `[ServerNetwork] Goal synced for character ${goalData.characterId}:`,
          goalData.goal ? "active" : "cleared",
          goalData.availableGoals
            ? `(${goalData.availableGoals.length} available goals)`
            : "",
        );
      }
    };

    // Bank handlers
    this.handlers["onBankOpen"] = (socket, data) =>
      handleBankOpen(socket, data as { bankId: string }, this.world);

    this.handlers["onBankDeposit"] = (socket, data) =>
      handleBankDeposit(
        socket,
        data as { itemId: string; quantity: number; slot?: number },
        this.world,
      );

    this.handlers["onBankWithdraw"] = (socket, data) =>
      handleBankWithdraw(
        socket,
        data as { itemId: string; quantity: number },
        this.world,
      );

    this.handlers["onBankDepositAll"] = (socket, data) =>
      handleBankDepositAll(socket, data, this.world);

    this.handlers["onBankClose"] = (socket, data) =>
      handleBankClose(socket, data, this.world);

    // NPC interaction handler - client clicked on NPC
    this.handlers["onNpcInteract"] = (socket, data) => {
      const playerEntity = socket.player;
      if (!playerEntity) return;

      const payload = data as {
        npcId: string;
        npc: { id: string; name: string; type: string };
      };

      // Emit NPC_INTERACTION event for DialogueSystem to handle
      // npcId is the entity instance ID, pass as npcEntityId for distance checking
      this.world.emit(EventType.NPC_INTERACTION, {
        playerId: playerEntity.id,
        npcId: payload.npcId,
        npc: payload.npc,
        npcEntityId: payload.npcId,
      });
    };

    // Dialogue handlers
    this.handlers["onDialogueResponse"] = (socket, data) => {
      const playerEntity = socket.player;
      if (!playerEntity) return;
      const payload = data as {
        npcId: string;
        responseIndex: number;
        nextNodeId: string;
        effect?: string;
      };
      // Emit event for DialogueSystem to handle
      this.world.emit(EventType.DIALOGUE_RESPONSE, {
        playerId: playerEntity.id,
        npcId: payload.npcId,
        responseIndex: payload.responseIndex,
        nextNodeId: payload.nextNodeId,
        effect: payload.effect,
      });
    };

    this.handlers["onDialogueClose"] = (socket, data) => {
      const playerEntity = socket.player;
      if (!playerEntity) return;
      const payload = data as { npcId: string };
      // Emit event for DialogueSystem to handle cleanup
      this.world.emit(EventType.DIALOGUE_END, {
        playerId: playerEntity.id,
        npcId: payload.npcId,
      });
    };

    // Store handlers
    this.handlers["onStoreOpen"] = (socket, data) =>
      handleStoreOpen(
        socket,
        data as {
          npcId: string;
          storeId?: string;
          npcPosition?: { x: number; y: number; z: number };
        },
        this.world,
      );

    this.handlers["onStoreBuy"] = (socket, data) =>
      handleStoreBuy(
        socket,
        data as { storeId: string; itemId: string; quantity: number },
        this.world,
      );

    this.handlers["onStoreSell"] = (socket, data) =>
      handleStoreSell(
        socket,
        data as { storeId: string; itemId: string; quantity: number },
        this.world,
      );

    this.handlers["onStoreClose"] = (socket, data) =>
      handleStoreClose(socket, data as { storeId: string }, this.world);
  }

  async init(options: WorldOptions): Promise<void> {
    // Validate that db exists and has the expected shape
    if (!options.db || !isDatabaseInstance(options.db)) {
      throw new Error(
        "[ServerNetwork] Valid database instance not provided in options",
      );
    }

    this.db = options.db;

    // Initialize managers now that db is available
    this.initializeManagers();
  }

  async start(): Promise<void> {
    if (!this.db) {
      throw new Error("[ServerNetwork] Database not available in start method");
    }

    // Load spawn configuration
    this.spawn = await this.initializationManager.loadSpawnPoint();

    // Hydrate entities from database
    await this.initializationManager.hydrateEntities();

    // Load world settings
    await this.initializationManager.loadSettings();

    // Start save manager (timer + settings watcher)
    this.saveManager.start();

    // Setup event bridge (world events → network messages)
    this.eventBridge.setupEventListeners();

    // Start tick system (600ms RuneScape-style ticks)
    this.tickSystem.start();
    console.log(
      "[ServerNetwork] Tick system started (600ms ticks) with action queue",
    );
  }

  override destroy(): void {
    this.socketManager.destroy();
    this.saveManager.destroy();
    this.tickSystem.stop();

    for (const [_id, socket] of this.sockets) {
      socket.close?.();
    }
    this.sockets.clear();
  }

  override preFixedUpdate(): void {
    this.flush();
  }

  override update(dt: number): void {
    // Validate player positions periodically
    this.positionValidator.update(dt);

    // Delegate movement updates to MovementManager
    this.movementManager.update(dt);
  }

  /**
   * Broadcast message to all connected clients
   *
   * Delegates to BroadcastManager.
   */
  send<T = unknown>(name: string, data: T, ignoreSocketId?: string): void {
    this.broadcastManager.sendToAll(name, data, ignoreSocketId);
  }

  /**
   * Send message to specific socket
   *
   * Delegates to BroadcastManager.
   */
  sendTo<T = unknown>(socketId: string, name: string, data: T): void {
    this.broadcastManager.sendToSocket(socketId, name, data);
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

  isAdmin(player: { data?: { roles?: string[] } }): boolean {
    return hasRole(player.data?.roles as string[] | undefined, "admin");
  }

  isBuilder(player: { data?: { roles?: string[] } }): boolean {
    return this.world.settings.public || this.isAdmin(player);
  }

  /**
   * Handle incoming WebSocket connection
   *
   * Delegates to ConnectionHandler for the full connection flow.
   */
  async onConnection(
    ws: NodeWebSocket,
    params: ConnectionParams,
  ): Promise<void> {
    await this.connectionHandler.handleConnection(ws, params);
  }
}
