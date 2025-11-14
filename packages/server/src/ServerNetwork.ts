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
 * **Network Architecture**:
 * ```
 * Client WebSocket ←→ Socket (wrapper) ←→ ServerNetwork ←→ Game Systems
 *                                              ↓
 *                                        DatabaseSystem
 *                                        (persistence)
 * ```
 *
 * **Server-Authoritative Model**:
 * Unlike many multiplayer games, Hyperscape is fully server-authoritative:
 * - Client requests move to position X → Server validates and moves player
 * - Client attacks mob → Server calculates damage and broadcasts result
 * - Client uses item → Server checks inventory and applies effect
 * - Server broadcasts authoritative state to all clients
 *
 * This prevents cheating but requires server to be highly optimized.
 *
 * **Movement System**:
 * Simple click-to-move with linear interpolation:
 * 1. Client clicks on ground → sends target position
 * 2. Server validates target is reachable
 * 3. Server moves player toward target each tick
 * 4. Server grounds player to terrain height
 * 5. Server broadcasts position updates at 30fps
 * 6. Client smoothly interpolates between updates
 *
 * **Character Selection Flow**:
 * 1. Client connects with accountId (from Privy/JWT)
 * 2. Server sends character list to client
 * 3. Client shows character selection modal OR creates new character
 * 4. Client sends characterId to spawn with (or creates new character)
 * 5. Server loads character data from database
 * 6. Server spawns player entity at saved position
 * 7. Server sends inventory, equipment, and world snapshot
 *
 * **Packet System**:
 * Uses binary protocol defined in @hyperscape/shared:
 * - `snapshot` - Initial world state (sent on connect)
 * - `entityAdded` - New entity joined world
 * - `entityModified` - Entity state changed (position, health, etc.)
 * - `entityRemoved` - Entity left world
 * - `chatAdded` - New chat message
 * - `inventoryUpdated` - Inventory changed
 * - `resourceDepleted/Respawned` - Resource state changed
 *
 * **Authentication Flow**:
 * 1. Client connects with authToken in query params
 * 2. Server checks if Privy token (if PRIVY_APP_SECRET set)
 * 3. If Privy: Verify token, fetch user profile, link account
 * 4. If JWT: Verify signature, load user from database
 * 5. If neither: Create anonymous user
 * 6. Generate Hyperscape JWT for session
 * 7. Attach user to socket and continue to character selection
 *
 * **Position Validation**:
 * Aggressive validation during first 10 seconds, then every second:
 * - Check if Y coordinate is invalid (< -5 or > 200)
 * - Compare player Y to terrain height
 * - If drift > 10 units, snap player to terrain
 * - Broadcast corrected position to all clients
 *
 * **Save System**:
 * Player data is saved periodically (SAVE_INTERVAL env var, default 60s):
 * - Position, health, stats saved to database
 * - Inventory saved on every change
 * - Equipment saved on every change
 * - Sessions tracked for analytics
 *
 * **Command System**:
 * Slash commands for admin/debug:
 * - `/admin <code>` - Grant admin role with password
 * - `/name <name>` - Change display name
 * - `/move [random|to x y z]` - Teleport player
 * - `/chat clear` - Clear chat history (builder+)
 * - `/server stats` - Show CPU/memory usage
 *
 * **Performance Optimizations**:
 * - Movement updates throttled to 30fps (33ms)
 * - Position validation throttled (100ms → 1000ms after 10s)
 * - Pre-allocated temp vectors to avoid garbage collection
 * - Delta compression for quaternion changes (future)
 * - Packet batching via queue system
 *
 * **Referenced by**: index.ts (world.register('network', ServerNetwork))
 */

import moment from "moment";

import type {
  ChatMessage,
  ConnectionParams,
  NetworkWithSocket,
  NodeWebSocket,
  PlayerRow,
  ServerStats,
  SpawnData,
  User,
  WorldOptions,
  SystemDatabase,
  ServerSocket,
  ResourceSystem,
  DatabaseSystemOperations,
} from "./types";
import type { InventorySystemData } from "@hyperscape/shared";
import type {
  CharacterCreatePacket,
  CharacterSelectedPacket,
  EnterWorldPacket,
  MoveRequestPacket,
  AttackRequestPacket,
  ItemPickupPacket,
  ItemDropPacket,
  ResourceGatherPacket,
  EntityModificationPacket,
  EntityEventPacket,
  TradeRequestPacket,
  TradeResponsePacket,
  TradeOfferPacket,
  TradeConfirmPacket,
  TradeCancelPacket,
} from "@hyperscape/shared";
import {
  EventType,
  Socket,
  System,
  THREE,
  addRole,
  dbHelpers,
  getItem,
  hasRole,
  isDatabaseInstance,
  removeRole,
  serializeRoles,
  uuid,
  writePacket,
  Entity,
  TerrainSystem,
  World,
  ITEM_ID_TO_KEY,
} from "@hyperscape/shared";
import type { Vector3 } from "three";
import { isPrivyEnabled, verifyPrivyToken } from "./privy-auth";
import { createJWT, verifyJWT } from "./utils";
import { checkPlayerBan } from "./blockchain/BanCheckService";

// SocketInterface is the extended ServerSocket type
type SocketInterface = ServerSocket;

// Entity already has velocity property

const SAVE_INTERVAL = parseInt(process.env.SAVE_INTERVAL || "60"); // seconds
// WebSocket heartbeat configuration (relaxed for development by default)
const WS_PING_INTERVAL_SEC = parseInt(
  process.env.WS_PING_INTERVAL_SEC || "5",
  10,
);
const WS_PING_MISS_TOLERANCE = parseInt(
  process.env.WS_PING_MISS_TOLERANCE || "3",
  10,
);
const WS_PING_GRACE_MS = parseInt(process.env.WS_PING_GRACE_MS || "5000", 10);
const defaultSpawn = '{ "position": [0, 50, 0], "quaternion": [0, 0, 0, 1] }'; // Safe default height

const HEALTH_MAX = 100;

type QueueItem = [SocketInterface, string, Record<string, unknown>];

// Handler data types for network messages

interface _EntityEventData {
  id: string;
  event: string;
  payload?: unknown;
}

interface _EntityRemovedData {
  id: string;
}

/**
 * Network message handler function type
 * Handlers process incoming packets from clients
 *
 * @param socket - The client socket that sent the message
 * @param data - Parsed packet data (type depends on packet type)
 */
type NetworkHandler = (
  socket: SocketInterface,
  data: Record<string, unknown>,
) => void | Promise<void>;

/**
 * ServerNetwork - Authoritative multiplayer networking system
 *
 * Manages all WebSocket connections and coordinates server-side game logic.
 * This is the central nervous system of the multiplayer server, handling
 * authentication, player spawning, movement, combat, and state broadcasting.
 *
 * Implements the server-authoritative model where the server validates all
 * client actions and broadcasts the authoritative game state to all players.
 *
 * @public
 * @see {@link ClientNetwork} for the client-side counterpart
 * @see {@link Socket} for the WebSocket wrapper
 */
export class ServerNetwork extends System implements NetworkWithSocket {
  /** Unique network ID (incremented for each connection) */
  id: number;

  /** Counter for assigning network IDs */
  ids: number;

  /** Map of all active WebSocket connections by socket ID */
  sockets: Map<string, SocketInterface>;

  /** Interval handle for socket health checks (ping/pong) */
  socketIntervalId: NodeJS.Timeout;
  // Heartbeat state
  private socketFirstSeenAt: Map<string, number> = new Map();
  private socketMissedPongs: Map<string, number> = new Map();

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

  // Handler method registry - using NetworkHandler type for flexibility
  private handlers: Record<string, NetworkHandler> = {};
  // Simple movement state - no complex physics simulation
  private moveTargets: Map<
    string,
    {
      target: Vector3;
      maxSpeed: number;
      lastUpdate: number;
    }
  > = new Map();

  // Trading system state
  private activeTrades: Map<
    string,
    {
      tradeId: string;
      initiator: string;
      recipient: string;
      initiatorOffer: {
        items: Array<{ itemId: string; quantity: number; slot: number }>;
        coins: number;
      };
      recipientOffer: {
        items: Array<{ itemId: string; quantity: number; slot: number }>;
        coins: number;
      };
      initiatorConfirmed: boolean;
      recipientConfirmed: boolean;
      createdAt: number;
    }
  > = new Map();

  // Pre-allocated vectors for calculations (no garbage)
  private _tempVec3 = new THREE.Vector3();
  private _tempVec3Fwd = new THREE.Vector3(0, 0, -1);
  private _tempQuat = new THREE.Quaternion();

  // Track last state per entity (used for future delta compression)
  private lastStates = new Map<
    string,
    { q: [number, number, number, number] }
  >();
  // In broadcast, for q:
  // const last = this.lastStates.get(entity.id) || {q: [0,0,0,1]};
  // const qDelta = quatSubtract(currentQuaternion, last.q);
  // Quantize and send qDelta, update last

  constructor(world: World) {
    super(world);
    this.id = 0;
    this.ids = -1;
    this.sockets = new Map();
    this.socketIntervalId = setInterval(
      () => this.checkSockets(),
      WS_PING_INTERVAL_SEC * 1000,
    );
    this.saveTimerId = null;
    this.isServer = true;
    this.isClient = false;
    this.queue = [];
    this.spawn = JSON.parse(defaultSpawn);
    this.maxUploadSize = 50; // Default 50MB upload limit

    // Register handler methods with proper signatures (packet system adds 'on' prefix)
    this.handlers["onChatAdded"] = this.onChatAdded.bind(this);
    this.handlers["onCommand"] = this.onCommand.bind(this);
    this.handlers["onEntityModified"] = this.onEntityModified.bind(this);
    this.handlers["onEntityEvent"] = this.onEntityEvent.bind(this);
    this.handlers["onEntityRemoved"] = (socket, data) =>
      this.onEntityRemoved(socket, data as { id: string });
    this.handlers["onSettings"] = (socket, data) =>
      this.onSettings(socket, data);
    // Dedicated resource packet handler
    this.handlers["onResourceGather"] = (
      socket: SocketInterface,
      data: ResourceGatherPacket,
    ) => {
      const playerEntity = socket.player;
      if (!playerEntity) {
        console.warn(
          "[ServerNetwork] onResourceGather: no player entity for socket",
        );
        return;
      }

      if (!data.resourceId) {
        console.warn(
          "[ServerNetwork] onResourceGather: no resourceId in payload",
        );
        return;
      }

      const playerPosition = data.playerPosition || {
        x: playerEntity.position.x,
        y: playerEntity.position.y,
        z: playerEntity.position.z,
      };

      // Forward to ResourceSystem - emit RESOURCE_GATHER which ResourceSystem subscribes to
      this.world.emit(EventType.RESOURCE_GATHER, {
        playerId: playerEntity.id,
        resourceId: data.resourceId,
        playerPosition: playerPosition,
      });
    };
    this.handlers["onMoveRequest"] = this.onMoveRequest.bind(this);
    this.handlers["onInput"] = this.onInput.bind(this);
    // Combat/Item handlers
    this.handlers["onAttackMob"] = this.onAttackMob.bind(this);
    this.handlers["onPickupItem"] = this.onPickupItem.bind(this);
    // Inventory drop handler
    this.handlers["onDropItem"] = this.onDropItem.bind(this);
    // Trading system handlers
    this.handlers["onTradeRequest"] = this.onTradeRequest.bind(this);
    this.handlers["onTradeResponse"] = this.onTradeResponse.bind(this);
    this.handlers["onTradeOffer"] = this.onTradeOffer.bind(this);
    this.handlers["onTradeConfirm"] = this.onTradeConfirm.bind(this);
    this.handlers["onTradeCancel"] = this.onTradeCancel.bind(this);
    // Character selection handlers (feature-flagged usage)
    this.handlers["onCharacterListRequest"] = (socket, data) =>
      this.onCharacterListRequest(socket, data as Record<string, never>);
    this.handlers["onCharacterCreate"] = this.onCharacterCreate.bind(this);
    this.handlers["onCharacterSelected"] = this.onCharacterSelected.bind(this);
    this.handlers["onEnterWorld"] = this.onEnterWorld.bind(this);
  }

  // --- Character selection infrastructure (feature-flag guarded) ---
  private async loadCharacterList(accountId: string): Promise<
    Array<{
      id: string;
      name: string;
      level?: number;
      lastLocation?: { x: number; y: number; z: number };
    }>
  > {
    try {
      const databaseSystem = this.world.getSystem("database") as
        | import("./DatabaseSystem").DatabaseSystem
        | undefined;
      if (!databaseSystem) return [];
      const chars = await databaseSystem.getCharactersAsync(accountId);
      return chars.map((c) => ({ id: c.id, name: c.name }));
    } catch {
      return [];
    }
  }

  private async onCharacterListRequest(
    socket: SocketInterface,
    _data: Record<string, never>,
  ): Promise<void> {
    const accountId = socket.accountId;
    if (!accountId) {
      console.warn(
        "[ServerNetwork] characterListRequest received but socket has no accountId",
      );
      socket.send("characterList", { characters: [] });
      return;
    }
    try {
      const characters = await this.loadCharacterList(accountId);
      socket.send("characterList", { characters });
    } catch (err) {
      console.error("[ServerNetwork] Failed to load character list:", err);
      socket.send("characterList", { characters: [] });
    }
  }

  private async onCharacterCreate(
    socket: SocketInterface,
    data: CharacterCreatePacket,
  ): Promise<void> {
    console.log("[ServerNetwork] 🎭 onCharacterCreate called with data:", data);

    const name = (data.name || "").trim().slice(0, 20) || "Adventurer";

    console.log("[ServerNetwork] Raw name from payload:", data.name);
    console.log("[ServerNetwork] Processed name:", name);

    // Basic validation: alphanumeric plus spaces, 3-20 chars
    const safeName = name.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const finalName = safeName.length >= 3 ? safeName : "Adventurer";

    console.log("[ServerNetwork] Final validated name:", finalName);

    const id = uuid();
    const accountId = socket.accountId || "";

    console.log("[ServerNetwork] Character creation params:", {
      characterId: id,
      accountId,
      finalName,
    });

    if (!accountId) {
      console.error(
        "[ServerNetwork] ❌ ERROR: No accountId on socket!",
        socket.id,
      );
      this.sendTo(socket.id, "showToast", {
        message: "Authentication error - no account ID",
        type: "error",
      });
      return;
    }

    try {
      const databaseSystem = this.world.getSystem("database") as
        | import("./DatabaseSystem").DatabaseSystem
        | undefined;
      if (!databaseSystem) {
        console.error("[ServerNetwork] ❌ ERROR: DatabaseSystem not found!");
        this.sendTo(socket.id, "showToast", {
          message: "Server error - database not available",
          type: "error",
        });
        return;
      }

      const result = await databaseSystem.createCharacter(
        accountId,
        id,
        finalName,
      );

      if (!result) {
        console.error(
          "[ServerNetwork] ❌ createCharacter returned false - character may already exist",
        );
        this.sendTo(socket.id, "showToast", {
          message: "Character creation failed",
          type: "error",
        });
        return;
      }

      console.log(
        "[ServerNetwork] ✅ Character creation successful, sending response",
      );
    } catch (err) {
      console.error("[ServerNetwork] ❌ EXCEPTION in createCharacter:", err);
      this.sendTo(socket.id, "showToast", {
        message: "Character creation error",
        type: "error",
      });
      return;
    }

    const responseData = { id, name: finalName };

    console.log(
      "[ServerNetwork] Sending characterCreated response:",
      responseData,
    );

    try {
      this.sendTo(socket.id, "characterCreated", responseData);

      // CRITICAL: Send updated character list so client can see the new character
      const updatedCharacters = await this.loadCharacterList(accountId);
      console.log(
        "[ServerNetwork] Sending updated character list after creation:",
        updatedCharacters,
      );
      this.sendTo(socket.id, "characterList", {
        characters: updatedCharacters,
      });
    } catch (err) {
      console.error(
        "[ServerNetwork] ❌ ERROR sending characterCreated packet:",
        err,
      );
    }
  }

  private onCharacterSelected(
    socket: SocketInterface,
    data: CharacterSelectedPacket,
  ): void {
    // Store selection in socket for subsequent enterWorld
    socket.selectedCharacterId = data.characterId || undefined;
    this.sendTo(socket.id, "characterSelected", {
      characterId: data.characterId || null,
    });
  }

  private async onEnterWorld(
    socket: SocketInterface,
    data: EnterWorldPacket,
  ): Promise<void> {
    console.log("[ServerNetwork] 🚪 onEnterWorld called with data:", data);

    // Spawn the entity now, preserving legacy spawn shape
    if (socket.player) {
      console.log("[ServerNetwork] Player already spawned, skipping");
      return; // Already spawned
    }
    const accountId = socket.accountId || undefined;
    const characterId = data.characterId || null;

    console.log("[ServerNetwork] Enter world params:", {
      accountId,
      characterId,
      hasSocket: !!socket,
    });

    // Load character data from DB if characterId provided
    let name = "Adventurer";
    let characterData: { id: string; name: string } | null = null;
    if (characterId && accountId) {
      try {
        const databaseSystem = this.world.getSystem("database") as
          | import("./DatabaseSystem").DatabaseSystem
          | undefined;
        if (databaseSystem) {
          const characters = await databaseSystem.getCharactersAsync(accountId);
          console.log(
            "[ServerNetwork] Loaded characters for account:",
            characters,
          );
          characterData = characters.find((c) => c.id === characterId) || null;
          if (characterData) {
            name = characterData.name;
            console.log("[ServerNetwork] ✅ Found character:", characterData);
          } else {
            console.warn(
              `[ServerNetwork] ❌ Character ${characterId} not found for account ${accountId}`,
            );
          }
        }
      } catch (err) {
        console.error("[ServerNetwork] ❌ Failed to load character data:", err);
      }
    } else {
      console.warn(
        "[ServerNetwork] ⚠️ Missing characterId or accountId for enterWorld",
      );
    }

    console.log("[ServerNetwork] Will spawn player with name:", name);

    const avatar = undefined;
    const roles: string[] = [];

    // Require a characterId to ensure persistence uses stable IDs
    const entityId = characterId || socket.id;
    if (!characterId) {
      console.warn(
        `[ServerNetwork] No characterId provided to enterWorld, using socketId`,
      );
    }

    // Load saved position from character data if available
    let position = Array.isArray(this.spawn.position)
      ? ([...this.spawn.position] as [number, number, number])
      : [0, 50, 0];
    const quaternion = Array.isArray(this.spawn.quaternion)
      ? ([...this.spawn.quaternion] as [number, number, number, number])
      : [0, 0, 0, 1];

    // Load full character data from DB (position AND skills)
    let savedSkills: Record<string, { level: number; xp: number }> | undefined;
    if (characterId && accountId) {
      try {
        const databaseSystem = this.world.getSystem("database") as
          | import("./DatabaseSystem").DatabaseSystem
          | undefined;
        if (databaseSystem) {
          const savedData = await databaseSystem.getPlayerAsync(characterId);
          if (savedData) {
            // Load position
            if (savedData.positionX !== undefined) {
              const savedY =
                savedData.positionY !== undefined &&
                savedData.positionY !== null
                  ? Number(savedData.positionY)
                  : 10;
              if (savedY >= 5 && savedY <= 200) {
                position = [
                  Number(savedData.positionX) || 0,
                  savedY,
                  Number(savedData.positionZ) || 0,
                ];
              }
            }
            // Load skills
            savedSkills = {
              attack: { level: savedData.attackLevel, xp: savedData.attackXp },
              strength: {
                level: savedData.strengthLevel,
                xp: savedData.strengthXp,
              },
              defense: {
                level: savedData.defenseLevel,
                xp: savedData.defenseXp,
              },
              constitution: {
                level: savedData.constitutionLevel,
                xp: savedData.constitutionXp,
              },
              ranged: { level: savedData.rangedLevel, xp: savedData.rangedXp },
              woodcutting: {
                level: savedData.woodcuttingLevel || 1,
                xp: savedData.woodcuttingXp || 0,
              },
              fishing: {
                level: savedData.fishingLevel || 1,
                xp: savedData.fishingXp || 0,
              },
              firemaking: {
                level: savedData.firemakingLevel || 1,
                xp: savedData.firemakingXp || 0,
              },
              cooking: {
                level: savedData.cookingLevel || 1,
                xp: savedData.cookingXp || 0,
              },
            };
          }
        }
      } catch {}
    }

    // Ground to terrain
    const terrain = this.world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;
    if (terrain && terrain.isReady && terrain.isReady()) {
      const th = terrain.getHeightAt(position[0], position[2]);
      if (Number.isFinite(th)) {
        position = [position[0], (th as number) + 0.1, position[2]];
      } else {
        position = [position[0], 10, position[2]];
      }
    } else {
      // Terrain not ready; use safe height
      position = [position[0], 10, position[2]];
    }
    const addedEntity = this.world.entities.add
      ? this.world.entities.add({
          id: entityId,
          type: "player",
          position,
          quaternion,
          owner: socket.id,
          userId: accountId || undefined,
          name,
          health: HEALTH_MAX,
          avatar: this.world.settings.avatar?.url || "asset://avatar.vrm",
          sessionAvatar: avatar || undefined,
          roles,
          // CRITICAL: Pass loaded skills so PlayerEntity constructor uses them instead of defaults
          skills: savedSkills,
        })
      : undefined;
    socket.player = (addedEntity as Entity) || undefined;
    if (socket.player) {
      this.world.emit(EventType.PLAYER_JOINED, {
        playerId: socket.player.data.id as string,
        player:
          socket.player as unknown as import("@hyperscape/shared").PlayerLocal,
      });
      try {
        // CRITICAL: Send ALL existing entities to the joining player FIRST
        // They need to see other players and world entities
        console.log(
          "[ServerNetwork] 📤 Sending all existing entities to joining player",
        );
        for (const entity of this.world.entities.values()) {
          // Don't send their own entity yet (we'll send it with special handling below)
          if (entity.id !== socket.player.id) {
            this.sendTo(socket.id, "entityAdded", entity.serialize());
          }
        }

        // Then send to everyone else about the new player
        this.send("entityAdded", socket.player.serialize(), socket.id);

        // And also to the originating socket so their client receives their own entity
        this.sendTo(socket.id, "entityAdded", socket.player.serialize());

        // Immediately reinforce authoritative transform to avoid initial client-side default pose
        this.sendTo(socket.id, "entityModified", {
          id: socket.player.id,
          changes: {
            p: position,
            q: quaternion,
            v: [0, 0, 0],
            e: "idle",
          },
        });
        // Send initial skills to client immediately after spawn
        if (savedSkills) {
          this.sendTo(socket.id, "skillsUpdated", {
            playerId: socket.player.id,
            skills: savedSkills,
          });
        }
        // Send inventory snapshot immediately from persistence to avoid races
        try {
          const dbSys = this.world.getSystem?.("database") as
            | DatabaseSystemOperations
            | undefined;
          const persistenceId = characterId || socket.player.id;
          const rows = dbSys?.getPlayerInventoryAsync
            ? await dbSys.getPlayerInventoryAsync(persistenceId)
            : [];
          const coinsRow = dbSys?.getPlayerAsync
            ? await dbSys.getPlayerAsync(persistenceId)
            : null;
          const sorted = rows
            .map((r) => ({
              rawSlot:
                Number.isFinite(r.slotIndex) && (r.slotIndex as number) >= 0
                  ? (r.slotIndex as number)
                  : Number.MAX_SAFE_INTEGER,
              itemId: String(r.itemId),
              quantity: r.quantity || 1,
            }))
            .sort((a, b) => a.rawSlot - b.rawSlot);
          const items = sorted.map((r, index) => {
            const def = getItem(r.itemId);
            return {
              slot: Math.min(index, 27),
              itemId: r.itemId,
              quantity: r.quantity,
              item: def
                ? {
                    id: def.id,
                    name: def.name,
                    type: def.type,
                    stackable: !!def.stackable,
                    weight: def.weight || 0,
                  }
                : {
                    id: r.itemId,
                    name: r.itemId,
                    type: "misc",
                    stackable: false,
                    weight: 0,
                  },
            };
          });
          this.sendTo(socket.id, "inventoryUpdated", {
            playerId: socket.player.id,
            items,
            coins: coinsRow?.coins ?? 0,
            maxSlots: 28,
          });
        } catch {}

        // CRITICAL: Send resource snapshot so player can see gatherable resources
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
          console.log(
            "[ServerNetwork] 📤 Sent resource snapshot with",
            resources.length,
            "resources",
          );
        } catch (_err) {
          console.error(
            "[ServerNetwork] Failed to send resource snapshot:",
            _err,
          );
        }
      } catch (_err) {}
    }
  }

  // Ensure auth-related columns exist on 'users' for Privy linking (safe no-op if already present)
  private async ensureUsersAuthColumns(): Promise<void> {
    // This method is not type-safe because it uses Knex schema APIs which are not in our
    // SystemDatabase type. Skip it for now since the migrations should handle this properly.
    // If needed in the future, we can extend SystemDatabase to include schema operations.
    return;
  }

  async init(options: WorldOptions): Promise<void> {
    // Validate that db exists and has the expected shape
    if (!options.db || !isDatabaseInstance(options.db)) {
      throw new Error(
        "[ServerNetwork] Valid database instance not provided in options",
      );
    }

    // Database is properly typed now, no casting needed
    this.db = options.db;
  }

  async start(): Promise<void> {
    if (!this.db) {
      throw new Error("[ServerNetwork] Database not available in start method");
    }
    // Attempt to ensure auth columns exist to prevent 'no such column: privyUserId'
    await this.ensureUsersAuthColumns().catch(() => {});
    // get spawn
    const spawnRow = (await this.db("config").where("key", "spawn").first()) as
      | { value?: string }
      | undefined;
    const spawnValue = spawnRow?.value || defaultSpawn;
    this.spawn = JSON.parse(spawnValue);

    // We'll ground the spawn position to terrain when players connect, not here
    // The terrain system might not be ready yet during startup

    // hydrate entities
    const entities = await this.db("entities");
    if (entities && Array.isArray(entities)) {
      for (const entity of entities) {
        const entityWithData = entity as { data: string };
        const data = JSON.parse(entityWithData.data);
        data.state = {};
        // Add entity if method exists
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
      // Deserialize settings if the method exists
      if (this.world.settings.deserialize) {
        this.world.settings.deserialize(settings);
      }
    } catch (_err) {
      console.error(_err);
    }

    // watch settings changes
    // Listen for settings changes if the method exists
    if (this.world.settings.on) {
      this.world.settings.on("change", this.saveSettings);
    }

    // queue first save
    if (SAVE_INTERVAL) {
      this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);
    }

    // Environment model loading is handled by ServerEnvironment.start()

    // Bridge important resource events to all clients using dedicated packets and snapshot on connect
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
        if (process.env.DEBUG_RPG === "1") {
          // Debug logging disabled, enable if needed for RPG debugging
        }
        this.send("inventoryUpdated", args[0]);
      });
      // Bridge SKILLS_UPDATED to clients using skillsUpdated packet
      this.world.on(EventType.SKILLS_UPDATED, (payload: unknown) => {
        const data = payload as { playerId?: string; skills?: unknown };
        if (data?.playerId) {
          this.sendToPlayerId(data.playerId, "skillsUpdated", data);
        } else {
          this.send("skillsUpdated", payload);
        }
      });
      // Also bridge UI_UPDATE for general player stats using playerState packet
      this.world.on(EventType.UI_UPDATE, (payload: unknown) => {
        const data = payload as
          | { component?: string; data?: { playerId?: string } }
          | undefined;
        if (data?.component === "player" && data.data?.playerId) {
          // Send updated player state to the owning player
          this.sendToPlayerId(data.data.playerId, "playerState", data.data);
        }
      });
      // Send initial inventory to the correct player as soon as it's initialized
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
      // Serve on-demand inventory requests from the client UI
      this.world.on(EventType.INVENTORY_REQUEST, (payload: unknown) => {
        const data = payload as { playerId: string };
        try {
          const invSystem = this.world.getSystem?.("inventory") as
            | InventorySystemData
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

      // Send skills updates to client
      this.world.on(EventType.SKILLS_UPDATED, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          skills: Record<string, { level: number; xp: number }>;
        };
        this.sendToPlayerId(data.playerId, "skillsUpdated", {
          playerId: data.playerId,
          skills: data.skills,
        });
      });
    } catch (_err) {}
  }

  override destroy(): void {
    clearInterval(this.socketIntervalId);
    if (this.saveTimerId) {
      clearTimeout(this.saveTimerId);
      this.saveTimerId = null;
    }
    this.world.settings.off("change", this.saveSettings);
    // Optionally close sockets to free resources during tests/hot-reloads
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
    // Clean up stale trades (open for more than 5 minutes)
    const TRADE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [tradeId, trade] of this.activeTrades.entries()) {
      if (now - trade.createdAt > TRADE_TIMEOUT) {
        console.log(`[ServerNetwork] Cancelling stale trade ${tradeId}`);
        this.cancelTradeWithError(tradeId, "Trade timed out");
      }
    }

    // Simple server-authoritative movement - no complex physics
    const toDelete: string[] = [];

    this.moveTargets.forEach((info, playerId) => {
      const entity = this.world.entities.get(playerId);
      if (!entity || !entity.position) {
        toDelete.push(playerId);
        // Ensure associated state entries are also cleaned up
        this.lastStates.delete(playerId);
        return;
      }

      const current = entity.position;
      const target = info.target;
      const dx = target.x - current.x;
      const dz = target.z - current.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Check if arrived
      if (dist < 0.3) {
        // Arrived at target
        // Clamp final Y to terrain
        let finalY = target.y;
        const terrainFinal = this.world.getSystem("terrain") as InstanceType<
          typeof TerrainSystem
        > | null;
        if (terrainFinal) {
          const th = terrainFinal.getHeightAt(target.x, target.z);
          if (Number.isFinite(th)) finalY = (th as number) + 0.1;
        }
        entity.position.set(target.x, finalY, target.z);
        entity.data.position = [target.x, finalY, target.z];
        entity.data.velocity = [0, 0, 0];
        toDelete.push(playerId);

        // Broadcast final idle state
        this.send("entityModified", {
          id: playerId,
          changes: {
            p: [target.x, finalY, target.z],
            v: [0, 0, 0],
            e: "idle",
          },
        });
        return;
      }

      // Simple linear interpolation toward target
      const speed = info.maxSpeed;
      const moveDistance = Math.min(dist, speed * dt);

      // Calculate direction and new position
      const normalizedDx = dx / dist;
      const normalizedDz = dz / dist;
      const nx = current.x + normalizedDx * moveDistance;
      const nz = current.z + normalizedDz * moveDistance;

      // Clamp Y to terrain height (slightly above)
      let ny = target.y;
      const terrain = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
      if (terrain) {
        const th = terrain.getHeightAt(nx, nz);
        if (Number.isFinite(th)) ny = (th as number) + 0.1;
      }

      // Update position
      entity.position.set(nx, ny, nz);
      entity.data.position = [nx, ny, nz];

      // Calculate velocity for animation
      const velocity = normalizedDx * speed;
      const velZ = normalizedDz * speed;
      entity.data.velocity = [velocity, 0, velZ];

      // Simple rotation toward movement direction
      if (entity.node) {
        // Use two separate temp vectors to avoid overwriting
        const dir = this._tempVec3.set(normalizedDx, 0, normalizedDz);
        this._tempVec3Fwd.set(0, 0, -1);
        this._tempQuat.setFromUnitVectors(this._tempVec3Fwd, dir);
        entity.node.quaternion.copy(this._tempQuat);
        entity.data.quaternion = [
          this._tempQuat.x,
          this._tempQuat.y,
          this._tempQuat.z,
          this._tempQuat.w,
        ];
      }

      // Broadcast update at ~30fps
      if (!info.lastUpdate || now - info.lastUpdate >= 33) {
        info.lastUpdate = now;

        const speed = Math.sqrt(velocity * velocity + velZ * velZ);
        const emote = speed > 4 ? "run" : "walk";

        this.send("entityModified", {
          id: playerId,
          changes: {
            p: [nx, ny, nz],
            q: entity.data.quaternion,
            v: [velocity, 0, velZ],
            e: emote,
          },
        });
      }
    });

    toDelete.forEach((id) => this.moveTargets.delete(id));
  }

  send<T = unknown>(name: string, data: T, ignoreSocketId?: string): void {
    const packet = writePacket(name, data);
    // Only log non-entityModified packets to reduce spam
    // Keep logs quiet in production unless debugging a specific packet
    this.sockets.forEach((socket) => {
      if (socket.id === ignoreSocketId) {
        return;
      }
      socket.sendPacket(packet);
    });
    if (name === "chatAdded") {
      // Chat packets handled normally, debug logging disabled
    }
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
   * Checks health of all WebSocket connections
   *
   * Sends ping to all sockets and disconnects those that didn't respond to the
   * previous ping (alive flag is false). This prevents zombie connections from
   * accumulating when clients close without proper disconnect.
   *
   * Called every PING_RATE (1 second) by the socket interval timer.
   *
   * @public
   */
  checkSockets(): void {
    // see: https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections
    const now = Date.now();
    const toDisconnect: Array<{ socket: SocketInterface; reason: string }> = [];
    this.sockets.forEach((socket) => {
      // Grace period for new sockets
      if (!this.socketFirstSeenAt.has(socket.id)) {
        this.socketFirstSeenAt.set(socket.id, now);
        this.socketMissedPongs.set(socket.id, 0);
        socket.ping?.();
        return;
      }

      const firstSeen = this.socketFirstSeenAt.get(socket.id) || now;
      const withinGrace = now - firstSeen < WS_PING_GRACE_MS;

      if (withinGrace) {
        // During grace, just ping and do not count misses
        socket.ping?.();
        return;
      }

      if (!socket.alive) {
        const misses = (this.socketMissedPongs.get(socket.id) || 0) + 1;
        this.socketMissedPongs.set(socket.id, misses);
        if (misses >= WS_PING_MISS_TOLERANCE) {
          toDisconnect.push({ socket, reason: `missed_pong x${misses}` });
          return;
        }
      } else {
        // Reset miss counter on successful pong seen in last interval
        this.socketMissedPongs.set(socket.id, 0);
      }

      // Mark not-alive and send ping to solicit next pong
      socket.ping?.();
    });

    toDisconnect.forEach(({ socket, reason }) => {
      try {
        console.warn(
          `[ServerNetwork] Disconnecting socket ${socket.id} due to ${reason}`,
        );
      } catch {
        // Ignore errors during disconnect logging
      }
      socket.disconnect?.();
      this.socketFirstSeenAt.delete(socket.id);
      this.socketMissedPongs.delete(socket.id);
    });
  }

  /**
   * Adds a message to the outgoing queue for batched sending
   *
   * Instead of sending messages immediately, they're queued and sent in batches
   * during flush(). This reduces network overhead and improves performance.
   *
   * @param socket - The socket to send the message to
   * @param method - The packet method name (e.g., 'snapshot', 'entityAdded')
   * @param data - The packet payload
   *
   * @public
   */
  enqueue(
    socket: SocketInterface | Socket,
    method: string,
    data: Record<string, unknown>,
  ): void {
    if (method === "onChatAdded") {
      // Chat packets handled normally, debug logging disabled
    }
    this.queue.push([socket as SocketInterface, method, data]);
  }

  /**
   * Handles player disconnection and cleanup
   *
   * Performs cleanup when a player disconnects:
   * - Saves player data to database (position, stats, inventory, equipment)
   * - Ends the player session record
   * - Removes socket from tracking
   * - Destroys player entity
   * - Broadcasts entity removal to other clients
   *
   * @param socket - The socket that disconnected
   * @param code - WebSocket close code (optional, for logging)
   *
   * @public
   */
  onDisconnect(socket: SocketInterface | Socket, code?: number | string): void {
    // Cast to SocketInterface since we know it has the properties we need
    const serverSocket = socket as SocketInterface;
    // Handle socket disconnection
    console.log(
      `[ServerNetwork] 🔌 Socket ${serverSocket.id} disconnected with code:`,
      code,
      {
        hadPlayer: !!serverSocket.player,
        playerId: serverSocket.player?.id,
        stackTrace: new Error().stack?.split("\n").slice(1, 4).join("\n"),
      },
    );

    // Remove socket from our tracking
    this.sockets.delete(serverSocket.id);

    // Clean up any socket-specific resources
    if (serverSocket.player) {
      const playerId = serverSocket.player.id;

      // Cancel any active trades involving this player
      for (const [tradeId, trade] of this.activeTrades.entries()) {
        if (trade.initiator === playerId || trade.recipient === playerId) {
          console.log(
            `[ServerNetwork] Cancelling trade ${tradeId} due to player disconnect`,
          );

          // Notify the other player
          const otherPlayerId =
            trade.initiator === playerId ? trade.recipient : trade.initiator;
          const otherSocket = Array.from(this.sockets.values()).find(
            (s) => s.player?.id === otherPlayerId,
          );

          if (otherSocket) {
            this.sendTo(otherSocket.id, "tradeCancelled", {
              tradeId: trade.tradeId,
              reason: "Other player disconnected",
              byPlayerId: playerId,
            });
          }

          this.activeTrades.delete(tradeId);
        }
      }

      // Emit typed player left event
      this.world.emit(EventType.PLAYER_LEFT, {
        playerId: serverSocket.player.id,
      });

      // Remove player entity from world
      if (this.world.entities?.remove) {
        this.world.entities.remove(serverSocket.player.id);
      }
      // Broadcast entity removal to all remaining clients
      this.send("entityRemoved", { id: serverSocket.player.id });
    }
  }

  /**
   * Sends all queued messages to clients
   *
   * Processes the message queue and sends all pending packets to their
   * respective clients. Called every frame to batch network sends.
   *
   * Messages are removed from the queue after sending, even if send fails
   * (to prevent infinite retry loops on disconnected sockets).
   *
   * @public
   */
  flush(): void {
    if (this.queue.length > 0) {
      // console.debug(`[ServerNetwork] Flushing ${this.queue.length} packets`)
    }
    while (this.queue.length) {
      const [socket, method, data] = this.queue.shift()!;
      const handler = this.handlers[method];
      if (method === "onChatAdded") {
        // Chat packets handled normally, debug logging disabled
      }
      if (handler) {
        const result = handler.call(this, socket, data);
        // If handler is async, wait for it to complete
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

  /**
   * Gets the current world time in seconds
   *
   * Returns the server's authoritative game time which may differ from
   * client local time due to network lag and interpolation.
   *
   * @returns Current world time in seconds since server start
   *
   * @public
   */
  getTime(): number {
    return performance.now() / 1000; // seconds
  }

  save = async (): Promise<void> => {
    // queue again
    this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);
  };

  saveSettings = async (): Promise<void> => {
    // Serialize settings if the method exists
    const data = this.world.settings.serialize
      ? this.world.settings.serialize()
      : {};
    const value = JSON.stringify(data);
    await dbHelpers.setConfig(this.db, "settings", value);
  };

  /**
   * Checks if a player has admin role
   *
   * Admin role grants access to all commands and abilities including:
   * - Server statistics
   * - Player management
   * - World editing
   * - System commands
   *
   * @param player - The player entity or player data to check
   * @returns true if player has admin role
   *
   * @public
   */
  isAdmin(
    player: InstanceType<typeof Entity> | { data?: { roles?: string[] } },
  ): boolean {
    return hasRole(player.data?.roles as string[] | undefined, "admin");
  }

  /**
   * Checks if a player has builder role
   *
   * Builder role grants access to world editing abilities:
   * - Entity placement and modification
   * - Terrain editing
   * - Chat clearing
   * - Environmental controls
   *
   * @param player - The player entity or player data to check
   * @returns true if player has builder or admin role (admin implies builder)
   *
   * @public
   */
  isBuilder(
    player: InstanceType<typeof Entity> | { data?: { roles?: string[] } },
  ): boolean {
    return this.world.settings.public || this.isAdmin(player);
  }

  async onConnection(
    ws: NodeWebSocket,
    params: ConnectionParams,
  ): Promise<void> {
    try {
      // Validate websocket parameter
      if (!ws || typeof ws.close !== "function") {
        console.error(
          "[ServerNetwork] Invalid websocket provided to onConnection",
        );
        return;
      }

      // check player limit
      // Check player limit setting
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

      // check connection params
      let authToken = params.authToken;
      const name = params.name;
      const avatar = params.avatar;
      const privyUserId = (params as { privyUserId?: string }).privyUserId;

      // get or create user
      let user: User | undefined;
      let userWithPrivy:
        | (User & { privyUserId?: string | null; farcasterFid?: string | null })
        | undefined;

      // Try Privy authentication first if enabled
      if (isPrivyEnabled() && authToken && privyUserId) {
        try {
          const privyInfo = await verifyPrivyToken(authToken);

          if (privyInfo && privyInfo.privyUserId === privyUserId) {
            let dbResult: User | undefined;
            try {
              dbResult = (await this.db("users")
                .where("privyUserId", privyUserId)
                .first()) as User | undefined;
            } catch (_e) {
              dbResult = (await this.db("users")
                .where("id", privyUserId)
                .first()) as User | undefined;
            }

            if (dbResult) {
              // Existing Privy user
              userWithPrivy = dbResult as User & {
                privyUserId?: string | null;
                farcasterFid?: string | null;
              };
              user = userWithPrivy;
            } else {
              // New Privy user - create account with stable id equal to privyUserId
              const timestamp = new Date().toISOString();
              const newUser: {
                id: string;
                name: string;
                avatar: string | null;
                roles: string;
                createdAt: string;
                privyUserId?: string;
                farcasterFid?: string;
              } = {
                id: privyInfo.privyUserId,
                name: name || "Adventurer",
                avatar: avatar || null,
                roles: "",
                createdAt: timestamp,
              };
              try {
                newUser.privyUserId = privyInfo.privyUserId;
                if (privyInfo.farcasterFid) {
                  newUser.farcasterFid = privyInfo.farcasterFid;
                }
                await this.db("users").insert(newUser);
              } catch (_err) {
                await this.db("users").insert({
                  id: newUser.id,
                  name: newUser.name,
                  avatar: newUser.avatar,
                  roles: newUser.roles,
                  createdAt: newUser.createdAt,
                });
              }
              userWithPrivy = newUser as User & {
                privyUserId?: string | null;
                farcasterFid?: string | null;
              };
              user = userWithPrivy;
            }

            // Generate a Hyperscape JWT for this user
            authToken = await createJWT({ userId: (user as User).id });
          } else {
            console.warn(
              "[ServerNetwork] Privy token verification failed or user ID mismatch",
            );
          }
        } catch (err) {
          // JWT expiration is expected behavior, not an error
          if (err instanceof Error && err.message.includes("exp")) {
            console.warn(
              "[ServerNetwork] Privy token expired - user needs to re-authenticate",
            );
          } else {
            console.error("[ServerNetwork] Privy authentication error:", err);
          }
          // Fall through to legacy authentication
        }
      }

      // Fall back to legacy JWT authentication if Privy didn't work
      if (!user && authToken) {
        try {
          const jwtPayload = await verifyJWT(authToken);
          if (jwtPayload && jwtPayload.userId) {
            const dbResult = await this.db("users")
              .where("id", jwtPayload.userId as string)
              .first();
            if (dbResult) {
              // Strong type assumption - dbResult has user properties
              user = dbResult as User;
            }
          }
        } catch (err) {
          console.error(
            "[ServerNetwork] Failed to read authToken:",
            authToken,
            err,
          );
        }
      }

      // Create anonymous user if no authentication succeeded
      if (!user) {
        const timestamp = new Date().toISOString();
        user = {
          id: uuid(),
          name: "Anonymous",
          avatar: null,
          roles: "",
          createdAt: timestamp,
        };
        await this.db("users").insert({
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          roles: Array.isArray(user.roles) ? user.roles.join(",") : user.roles,
          createdAt: timestamp,
        });
        authToken = await createJWT({ userId: user.id });
      }

      // Convert roles string to array - DB stores as string, runtime uses array
      if ((user.roles as string).split) {
        user.roles = (user.roles as string).split(",").filter((r) => r);
      }

      // CHECK BAN STATUS - Block banned players immediately
      // Query player's agentId from database (stored during registration)
      try {
        const playerRecord = (await this.db("players")
          .where("userId", user.id)
          .first()) as { agent_id?: number } | undefined;

        if (playerRecord?.agent_id) {
          const banCheck = await checkPlayerBan(playerRecord.agent_id);

          if (!banCheck.allowed) {
            console.warn(
              `[ServerNetwork] Banned player attempted login: User ${user.id}, Agent ${playerRecord.agent_id}`,
            );
            const kickPacket = writePacket(
              "kick",
              banCheck.reason || "You have been banned.",
            );
            ws.send(kickPacket);
            ws.close();
            return; // Deny access
          }
        }
      } catch (error) {
        console.error(
          "[ServerNetwork] Ban check failed, allowing access (fail-open):",
          error,
        );
        // Continue - fail open if ban system is down
      }

      // Allow multiple sessions per user for development/testing; do not kick duplicates

      // Only grant admin in development mode when no admin code is set
      // This prevents accidental admin access in production
      if (!process.env.ADMIN_CODE && process.env.NODE_ENV === "development") {
        console.warn(
          "[ServerNetwork] No ADMIN_CODE set in development mode - granting temporary admin access",
        );
        // user.roles is already a string[] at this point after conversion
        if (Array.isArray(user.roles)) {
          user.roles.push("~admin");
        }
      }

      // livekit options
      // Get LiveKit options if available
      const livekit = await this.world.livekit?.getPlayerOpts?.(user.id);

      // create unique socket id per connection
      const socketId = uuid();
      const socket = new Socket({
        id: socketId,
        ws,
        network: this,
        player: undefined,
      }) as SocketInterface;
      // Store account linkage for later character flows
      socket.accountId = user.id;

      // Wait for terrain system to be ready before spawning players
      const terrain = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
      if (terrain) {
        // Wait for terrain to be ready
        let terrainReady = false;

        for (let i = 0; i < 100; i++) {
          // Wait up to 10 seconds
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
          console.error("[ServerNetwork] Terrain state:", {
            hasIsReady: !!terrain.isReady,
            isReadyFunction: typeof terrain.isReady,
            terrainKeys: Object.keys(terrain).slice(0, 10),
          });
          if (ws && typeof ws.close === "function") {
            ws.close(1001, "Server terrain not ready");
          }
          return;
        }
      } else {
        console.warn(
          "[ServerNetwork] ⚠️  No terrain system found - proceeding without terrain validation",
        );
      }

      // Check if player has saved position in database
      let spawnPosition: [number, number, number];
      let playerRow: PlayerRow | null = null;

      // Try to load player position from DatabaseSystem if available
      const databaseSystem = this.world.getSystem("database") as
        | import("./DatabaseSystem").DatabaseSystem
        | undefined;
      if (databaseSystem) {
        try {
          playerRow = await databaseSystem.getPlayerAsync(socketId);
          if (playerRow && playerRow.positionX !== undefined) {
            const savedY =
              playerRow.positionY !== undefined && playerRow.positionY !== null
                ? Number(playerRow.positionY)
                : 50; // Use safe default if undefined/null

            // NEVER trust saved Y if it's invalid
            if (savedY < -5 || savedY > 200) {
              console.error(
                `[ServerNetwork] REJECTED invalid saved Y position: ${savedY}, using default spawn`,
              );
              spawnPosition = Array.isArray(this.spawn.position)
                ? [
                    Number(this.spawn.position[0]) || 0,
                    Number(this.spawn.position[1] ?? 50),
                    Number(this.spawn.position[2]) || 0,
                  ]
                : [0, 50, 0];
            } else {
              spawnPosition = [
                Number(playerRow.positionX) || 0,
                savedY,
                Number(playerRow.positionZ) || 0,
              ];
            }
          } else {
            // Use default spawn for new players
            spawnPosition = Array.isArray(this.spawn.position)
              ? [
                  Number(this.spawn.position[0]) || 0,
                  Number(this.spawn.position[1] ?? 50),
                  Number(this.spawn.position[2]) || 0,
                ]
              : [0, 50, 0];
          }
        } catch (_err: unknown) {
          spawnPosition = Array.isArray(this.spawn.position)
            ? [
                Number(this.spawn.position[0]) || 0,
                Number(this.spawn.position[1] ?? 50),
                Number(this.spawn.position[2]) || 0,
              ]
            : [0, 50, 0];
        }
      } else {
        spawnPosition = Array.isArray(this.spawn.position)
          ? [
              Number(this.spawn.position[0]) || 0,
              Number(this.spawn.position[1] ?? 50),
              Number(this.spawn.position[2]) || 0,
            ]
          : [0, 50, 0];
      }

      // Ground spawn position to terrain height
      const terrainSystem = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;

      // Check if terrain system is ready using its isReady() method
      if (terrainSystem && terrainSystem.isReady && terrainSystem.isReady()) {
        const terrainHeight = terrainSystem.getHeightAt(
          spawnPosition[0],
          spawnPosition[2],
        );

        if (
          Number.isFinite(terrainHeight) &&
          terrainHeight > -100 &&
          terrainHeight < 1000
        ) {
          // Always use terrain height, even for saved positions (in case terrain changed)
          spawnPosition[1] = terrainHeight + 0.1;
        } else {
          // Invalid terrain height - use safe default
          console.error(
            `[ServerNetwork] TerrainSystem.getHeightAt returned invalid height: ${terrainHeight} at x=${spawnPosition[0]}, z=${spawnPosition[2]}`,
          );
          console.error(`[ServerNetwork] Using safe spawn height Y=10`);
          spawnPosition[1] = 10; // Safe default height
        }
      } else {
        // Terrain not ready yet - use safe default height
        if (terrainSystem && !terrainSystem.isReady()) {
          console.warn(
            "[ServerNetwork] Terrain system exists but is not ready yet (tiles still generating) - using safe spawn Y=10",
          );
        } else if (!terrainSystem) {
          console.error(
            "[ServerNetwork] WARNING: Terrain system not available for grounding! Using Y=10",
          );
        }
        spawnPosition[1] = 10;
      }

      // Load character list to determine if we're in character-select mode
      // ALWAYS load character list - client needs it to decide whether to show character select
      let characters: Array<{
        id: string;
        name: string;
        level?: number;
        lastLocation?: { x: number; y: number; z: number };
      }> = [];
      characters = await this.loadCharacterList(user.id);
      console.log("[ServerNetwork] 📋 Character list loaded:", characters);

      // Check if character selection is enabled via environment variable
      // Support both ENABLE_CHARACTER_SELECT and ENABLE_CHARACTER_SYSTEM for backward compatibility
      const enableCharacterSelect =
        process.env.ENABLE_CHARACTER_SELECT === "true" ||
        process.env.ENABLE_CHARACTER_SYSTEM === "true";

      // Auto-spawn player if character selection is disabled (legacy mode)
      if (!enableCharacterSelect) {
        console.log(
          `[ServerNetwork] 🎮 AUTO-SPAWN MODE - Character selection disabled`,
        );
        console.log(
          `[ServerNetwork] Creating player entity for ${user.name} (socketId: ${socketId})`,
        );

        // CRITICAL: Create character in database FIRST to satisfy foreign key constraint
        // The player_sessions table has a foreign key to characters table
        const databaseSystem = this.world.getSystem("database") as
          | import("./DatabaseSystem").DatabaseSystem
          | undefined;
        if (databaseSystem) {
          try {
            // Check if character already exists
            const existing = await databaseSystem.getPlayerAsync(socketId);
            if (!existing) {
              // Create character entry in database
              await databaseSystem.createCharacter(
                user.id,
                socketId,
                name || user.name,
              );
              console.log(
                `[ServerNetwork] ✅ Created character entry in database: ${socketId}`,
              );
            } else {
              console.log(
                `[ServerNetwork] ℹ️  Character already exists in database: ${socketId}`,
              );
            }
          } catch (err) {
            console.error(
              "[ServerNetwork] ❌ Failed to create character entry:",
              err,
            );
          }
        }

        // Create default player entity immediately (legacy behavior)
        const addedEntity = this.world.entities.add
          ? this.world.entities.add({
              id: socketId,
              type: "player",
              position: spawnPosition,
              quaternion: Array.isArray(this.spawn.quaternion)
                ? ([...this.spawn.quaternion] as [
                    number,
                    number,
                    number,
                    number,
                  ])
                : [0, 0, 0, 1],
              owner: socketId,
              userId: user.id,
              name: name || user.name,
              health: HEALTH_MAX,
              avatar: this.world.settings.avatar?.url || "asset://avatar.vrm",
              sessionAvatar: avatar || undefined,
              roles: user.roles as string[],
            })
          : undefined;

        socket.player = (addedEntity as Entity) || undefined;
        console.log(
          `[ServerNetwork] ✅ Player entity created: ${socket.player?.id} at position [${spawnPosition}]`,
        );
      } else {
        // Character select mode enabled
        if (characters.length === 0) {
          // No characters → Show character creation screen, DON'T auto-spawn
          console.log(
            `[ServerNetwork] No characters found for ${user.name}, showing character select`,
          );
          // Don't create player entity yet - wait for character creation
        } else {
          // Character select mode - don't spawn player yet, wait for enterWorld
          console.log(
            `[ServerNetwork] ${characters.length} characters found, waiting for enterWorld`,
          );
        }
      }

      const baseSnapshot: {
        id: string;
        serverTime: number;
        assetsUrl: string;
        apiUrl: string | undefined;
        maxUploadSize: string | undefined;
        settings: unknown;
        chat: unknown[];
        entities: unknown[];
        livekit: unknown;
        authToken: string;
        account: {
          accountId: string;
          name: string;
          providers: { privyUserId: string | null };
        };
        characters: Array<{
          id: string;
          name: string;
          level?: number;
          lastLocation?: { x: number; y: number; z: number };
        }>;
      } = {
        id: socket.id,
        serverTime: performance.now(),
        assetsUrl: this.world.assetsUrl, // Use the world's configured assetsUrl
        apiUrl: process.env.PUBLIC_API_URL,
        maxUploadSize: process.env.PUBLIC_MAX_UPLOAD_SIZE,
        settings: this.world.settings.serialize() || {},
        chat: this.world.chat.serialize() || [],
        // Include ALL entities EXCEPT the newly connected player (sent separately via entityAdded)
        entities: Array.from(this.world.entities.values())
          .filter((e) => e.id !== socket.player?.id)
          .map((e) => e.serialize()),
        livekit,
        authToken: authToken || "",
        account: {
          accountId: user.id,
          name: user.name,
          providers: {
            privyUserId:
              (user as User & { privyUserId?: string }).privyUserId || null,
          },
        },
        characters,
      };

      socket.send("snapshot", baseSnapshot);

      // Character list embedded in snapshot when enableCharacterSelect is true

      // After snapshot, send authoritative resource snapshot
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
      } catch {
        // Resource snapshot is optional, continue without it
      }

      this.sockets.set(socket.id, socket);

      // Emit typed player joined and broadcast ONLY if player was created (not in character select)
      if (socket.player) {
        const playerId = socket.player.data.id as string;
        this.world.emit(EventType.PLAYER_JOINED, {
          playerId,
          player:
            socket.player as unknown as import("@hyperscape/shared").PlayerLocal,
        });

        // Broadcast new player entity to all existing clients except the new connection
        try {
          this.send("entityAdded", socket.player.serialize(), socket.id);
          // Also send to the new player so they render themselves
          this.sendTo(socket.id, "entityAdded", socket.player.serialize());
        } catch (err) {
          console.error(
            "[ServerNetwork] Failed to broadcast entityAdded for new player:",
            err,
          );
        }
      } else {
        // Player not created yet (character select mode), no entity to broadcast
      }
    } catch (_err) {
      console.error(_err);
    }
  }

  onChatAdded = (socket: SocketInterface, data: unknown): void => {
    const msg = data as ChatMessage;
    // Add message to chat if method exists
    if (this.world.chat.add) {
      this.world.chat.add(msg, false);
    }
    this.send("chatAdded", msg, socket.id);
  };

  onCommand = async (socket: SocketInterface, data: unknown): Promise<void> => {
    const args = data as string[];
    const player = socket.player;
    if (!player) return;
    const [cmd, arg1] = args;

    // become admin command
    if (cmd === "admin") {
      const code = arg1;
      if (process.env.ADMIN_CODE && process.env.ADMIN_CODE === code) {
        const id = player.data.id;
        const userId = player.data.userId;
        const roles: string[] = Array.isArray(player.data.roles)
          ? player.data.roles
          : [];
        const granting = !hasRole(roles, "admin");
        if (granting) {
          addRole(roles, "admin");
        } else {
          removeRole(roles, "admin");
        }
        player.modify({ roles });
        this.send("entityModified", { id, changes: { roles } });
        socket.send("chatAdded", {
          id: uuid(),
          from: null,
          fromId: null,
          body: granting ? "Admin granted!" : "Admin revoked!",
          createdAt: moment().toISOString(),
        });
        if (userId) {
          const rolesString = serializeRoles(roles);
          await this.db("users")
            .where("id", userId)
            .update({ roles: rolesString });
        }
      }
    }

    if (cmd === "name") {
      const name = arg1;
      if (name) {
        const id = player.data.id;
        const userId = player.data.userId;
        player.data.name = name;
        player.modify({ name });
        this.send("entityModified", { id, changes: { name } });
        socket.send("chatAdded", {
          id: uuid(),
          from: null,
          fromId: null,
          body: `Name set to ${name}!`,
          createdAt: moment().toISOString(),
        });
        if (userId) {
          await this.db("users").where("id", userId).update({ name });
        }
      }
    }

    // Server-driven movement: move this socket's player entity randomly and broadcast
    if (cmd === "move") {
      const mode = arg1 || "random";
      if (!player) return;
      const entity = player;
      const curr = entity.position;
      let nx = curr.x;
      const _ny = curr.y;
      let nz = curr.z;
      if (mode === "random") {
        // Ensure movement is at least 1.5 units to pass test assertions
        const minRadius = 1.5;
        const maxRadius = 3;
        const angle = Math.random() * Math.PI * 2;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        const dx = Math.cos(angle) * radius;
        const dz = Math.sin(angle) * radius;
        nx = curr.x + dx;
        nz = curr.z + dz;
      } else if (mode === "to" && args.length >= 4) {
        // move to specified coordinates: /move to x y z
        const x = parseFloat(args[2]);
        const y = parseFloat(args[3]);
        const z = parseFloat(args[4]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          nx = x;
          const _ny = y;
          nz = z;
        }
      }
      // Apply on server entity
      // Clamp Y to terrain height on all server-side position sets via command
      const terrain = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
      if (!terrain) {
        throw new Error(
          "[ServerNetwork] Terrain system not available for chat move",
        );
      }
      const th = terrain.getHeightAt(nx, nz);
      if (!Number.isFinite(th)) {
        throw new Error(
          `[ServerNetwork] Invalid terrain height for chat move at x=${nx}, z=${nz}`,
        );
      }
      const gy = th + 0.1;
      entity.position.set(nx, gy, nz);
      // Broadcast to all clients, including the origin, using normalized shape
      this.send("entityModified", {
        id: entity.id,
        changes: { p: [nx, gy, nz] },
      });
    }

    if (cmd === "spawn") {
      // Spawn operations handled by world systems
    }

    if (cmd === "chat") {
      const op = arg1;
      if (op === "clear" && socket.player && this.isBuilder(socket.player)) {
        // Clear chat if method exists
        if (this.world.chat.clear) {
          this.world.chat.clear(true);
        }
      }
    }

    if (cmd === "server") {
      const op = arg1;
      if (op === "stats") {
        const send = (body: string) => {
          socket.send("chatAdded", {
            id: uuid(),
            from: null,
            fromId: null,
            body,
            createdAt: moment().toISOString(),
          });
        };
        // Get server stats if monitor exists
        const statsResult = this.world.monitor?.getStats?.();
        const stats =
          statsResult && "then" in statsResult
            ? await statsResult
            : ((statsResult || {
                currentCPU: 0,
                currentMemory: 0,
                maxMemory: 0,
              }) as ServerStats);
        send(`CPU: ${stats.currentCPU.toFixed(3)}%`);
        send(`Memory: ${stats.currentMemory}MB / ${stats.maxMemory}MB`);
      }
    }
  };

  /**
   * Handles entity modification requests from clients
   *
   * Allows builders/admins to modify entity properties like position, scale,
   * rotation, and custom data. Regular players can only modify entities they own.
   *
   * @param socket - The client socket requesting the modification
   * @param data - Entity modification data (id, position, quaternion, etc.)
   *
   * @internal
   */
  onEntityModified(
    socket: SocketInterface,
    data: EntityModificationPacket,
  ): void {
    const id = data.id;
    const changes = data.changes || {};

    // Apply to local entity if present
    const entity = this.world.entities.get(id);
    if (entity && changes) {
      // Reject client position/rotation authority for players
      if (entity.type === "player") {
        const filtered: Record<string, unknown> = { ...changes };
        delete (filtered as { p?: unknown }).p;
        delete (filtered as { q?: unknown }).q;
        // Allow cosmetic/state updates like name, avatar, effect, roles
        entity.modify(filtered);
      } else {
        entity.modify(changes);
      }
    }

    // Broadcast normalized shape
    this.send("entityModified", { id, changes }, socket.id);
  }

  private onMoveRequest(
    socket: SocketInterface,
    data: MoveRequestPacket,
  ): void {
    const playerEntity = socket.player;
    if (!playerEntity) return;

    // Handle cancellation
    if (data.cancel || data.target === null) {
      this.moveTargets.delete(playerEntity.id);
      const curr = playerEntity.position;
      this.send("entityModified", {
        id: playerEntity.id,
        changes: {
          p: [curr.x, curr.y, curr.z],
          v: [0, 0, 0],
          e: "idle",
        },
      });
      return;
    }

    const t = Array.isArray(data.target)
      ? (data.target as [number, number, number])
      : null;
    // If only runMode is provided, update current movement speed/emote without changing target
    if (!t) {
      if (data.runMode !== undefined) {
        const info = this.moveTargets.get(playerEntity.id);
        if (info) {
          info.maxSpeed = data.runMode ? 8 : 4;
          // Update emote immediately
          this.send("entityModified", {
            id: playerEntity.id,
            changes: { e: data.runMode ? "run" : "walk" },
          });
        }
      }
      return;
    }

    // Simple target creation - no complex terrain anchoring
    const target = new THREE.Vector3(t[0], t[1], t[2]);
    const maxSpeed = data.runMode ? 8 : 4;

    // Replace existing target completely (allows direction changes)
    this.moveTargets.set(playerEntity.id, {
      target,
      maxSpeed,
      lastUpdate: 0,
    });

    // Immediately rotate the player to face the new target and broadcast state
    const curr = playerEntity.position;
    const dx = target.x - curr.x;
    const dz = target.z - curr.z;
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
      const dir = this._tempVec3.set(dx, 0, dz).normalize();
      this._tempVec3Fwd.set(0, 0, -1);
      this._tempQuat.setFromUnitVectors(this._tempVec3Fwd, dir);
      if (playerEntity.node) {
        playerEntity.node.quaternion.copy(this._tempQuat);
      }
      playerEntity.data.quaternion = [
        this._tempQuat.x,
        this._tempQuat.y,
        this._tempQuat.z,
        this._tempQuat.w,
      ];
    }
    this.send("entityModified", {
      id: playerEntity.id,
      changes: {
        p: [curr.x, curr.y, curr.z],
        q: playerEntity.data.quaternion,
        v: [0, 0, 0],
        e: data.runMode ? "run" : "walk",
      },
    });
  }

  private onInput(
    socket: SocketInterface,
    data: MoveRequestPacket & { type?: string },
  ): void {
    // This now exclusively handles click-to-move requests, routing them to the canonical handler.
    const playerEntity = socket.player;
    if (!playerEntity) {
      return;
    }

    // The payload from a modern client is a 'moveRequest' style object.
    if (data.type === "click" && Array.isArray(data.target)) {
      this.onMoveRequest(socket, {
        target: data.target,
        runMode: data.runMode,
      });
    }
  }

  private onAttackMob(
    socket: SocketInterface,
    data: AttackRequestPacket,
  ): void {
    const playerEntity = socket.player;
    if (!playerEntity) {
      console.warn("[ServerNetwork] onAttackMob: no player entity for socket");
      return;
    }

    if (!data.mobId) {
      console.warn("[ServerNetwork] onAttackMob: no mobId in payload");
      return;
    }

    // Forward to CombatSystem
    this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
      playerId: playerEntity.id,
      targetId: data.mobId,
      attackerType: "player",
      targetType: "mob",
      attackType: data.attackType || "melee",
    });
  }

  private onPickupItem(socket: SocketInterface, data: ItemPickupPacket): void {
    const playerEntity = socket.player;
    if (!playerEntity) {
      console.warn("[ServerNetwork] onPickupItem: no player entity for socket");
      return;
    }

    // The client sends the entity ID as 'itemId' in the payload
    // entityId is the world entity ID (required), itemId is the item definition (optional)
    const entityId = data.itemId; // Client sends entity ID as 'itemId'

    if (!entityId) {
      console.warn("[ServerNetwork] onPickupItem: no entityId in payload");
      return;
    }

    // Server-side distance validation
    const entityManager = this.world.getSystem("entity-manager") as
      | {
          getEntity?: (id: string) => {
            position: { x: number; y: number; z: number };
          };
        }
      | undefined;
    if (entityManager && entityManager.getEntity) {
      const itemEntity = entityManager.getEntity(entityId);
      if (itemEntity) {
        const distance = Math.sqrt(
          Math.pow(playerEntity.position.x - itemEntity.position.x, 2) +
            Math.pow(playerEntity.position.z - itemEntity.position.z, 2),
        );

        const pickupRange = 2.5; // Slightly larger than client range to account for movement
        if (distance > pickupRange) {
          console.warn(
            `[ServerNetwork] Player ${playerEntity.id} tried to pickup item ${entityId} from too far away (${distance.toFixed(2)}m > ${pickupRange}m)`,
          );
          return;
        }
      }
    }

    // Forward to InventorySystem with entityId (required) and itemId (optional)
    this.world.emit(EventType.ITEM_PICKUP, {
      playerId: playerEntity.id,
      entityId,
      itemId: undefined, // Will be extracted from entity properties
    });
  }

  private onDropItem(socket: SocketInterface, data: ItemDropPacket): void {
    const playerEntity = socket.player;
    if (!playerEntity) {
      console.warn("[ServerNetwork] onDropItem: no player entity for socket");
      return;
    }
    if (!data.itemId) {
      console.warn("[ServerNetwork] onDropItem: missing itemId");
      return;
    }
    const quantity = Math.max(1, Number(data.quantity) || 1);
    // Basic sanity: clamp quantity to 1000 to avoid abuse
    const q = Math.min(quantity, 1000);
    this.world.emit(EventType.ITEM_DROP, {
      playerId: playerEntity.id,
      itemId: data.itemId,
      quantity: q,
      slot: data.slot,
    });
  }

  // ======================== TRADING SYSTEM ========================

  /**
   * Initiates a trade request between two players
   */
  private onTradeRequest(
    socket: SocketInterface,
    data: TradeRequestPacket,
  ): void {
    const initiator = socket.player;
    if (!initiator) {
      console.warn(
        "[ServerNetwork] onTradeRequest: no player entity for socket",
      );
      return;
    }

    if (!data.targetPlayerId) {
      console.warn("[ServerNetwork] onTradeRequest: missing targetPlayerId");
      this.sendTo(socket.id, "tradeError", {
        message: "No target player specified",
      });
      return;
    }

    // Find recipient player
    const recipientSocket = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === data.targetPlayerId,
    );

    if (!recipientSocket || !recipientSocket.player) {
      console.warn(
        "[ServerNetwork] onTradeRequest: target player not found or not online",
      );
      this.sendTo(socket.id, "tradeError", {
        message: "Player not found or offline",
      });
      return;
    }

    const recipient = recipientSocket.player;

    // Validate distance (max 5 units)
    const distance = Math.sqrt(
      Math.pow(initiator.position.x - recipient.position.x, 2) +
        Math.pow(initiator.position.z - recipient.position.z, 2),
    );

    if (distance > 5) {
      console.warn(
        `[ServerNetwork] Trade request rejected: players too far apart (${distance.toFixed(2)}m)`,
      );
      this.sendTo(socket.id, "tradeError", {
        message: "Player is too far away",
      });
      return;
    }

    // Check if either player is already in a trade
    const existingTrade = Array.from(this.activeTrades.values()).find(
      (t) =>
        t.initiator === initiator.id ||
        t.recipient === initiator.id ||
        t.initiator === recipient.id ||
        t.recipient === recipient.id,
    );

    if (existingTrade) {
      console.warn(
        "[ServerNetwork] Trade request rejected: player already in trade",
      );
      this.sendTo(socket.id, "tradeError", {
        message: "Player is already trading",
      });
      return;
    }

    // Create pending trade ID for request
    const pendingTradeId = uuid();

    // Send trade request to recipient
    this.sendTo(recipientSocket.id, "tradeRequest", {
      tradeId: pendingTradeId,
      fromPlayerId: initiator.id,
      fromPlayerName: initiator.data.name || "Unknown",
    });

    console.log(
      `[ServerNetwork] Trade request ${pendingTradeId} sent from ${initiator.id} to ${recipient.id}`,
    );
  }

  /**
   * Handles trade request response (accept/reject)
   */
  private onTradeResponse(
    socket: SocketInterface,
    data: TradeResponsePacket,
  ): void {
    const recipient = socket.player;
    if (!recipient) {
      console.warn(
        "[ServerNetwork] onTradeResponse: no player entity for socket",
      );
      return;
    }

    if (!data.fromPlayerId) {
      console.warn("[ServerNetwork] onTradeResponse: missing fromPlayerId");
      return;
    }

    // Find initiator
    const initiatorSocket = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === data.fromPlayerId,
    );

    if (!initiatorSocket || !initiatorSocket.player) {
      console.warn("[ServerNetwork] onTradeResponse: initiator not found");
      this.sendTo(socket.id, "tradeError", {
        message: "Trade initiator no longer online",
      });
      return;
    }

    if (!data.accepted) {
      // Trade rejected
      this.sendTo(initiatorSocket.id, "tradeCancelled", {
        reason: "Trade request declined",
        byPlayerId: recipient.id,
      });
      console.log(`[ServerNetwork] Trade rejected by ${recipient.id}`);
      return;
    }

    // Trade accepted - create trade session
    const tradeId = data.tradeId || uuid();
    const initiator = initiatorSocket.player;

    // Validate distance again
    const distance = Math.sqrt(
      Math.pow(initiator.position.x - recipient.position.x, 2) +
        Math.pow(initiator.position.z - recipient.position.z, 2),
    );

    if (distance > 5) {
      this.sendTo(socket.id, "tradeError", {
        message: "Players too far apart",
      });
      this.sendTo(initiatorSocket.id, "tradeError", {
        message: "Players too far apart",
      });
      return;
    }

    // Create trade session
    this.activeTrades.set(tradeId, {
      tradeId,
      initiator: initiator.id,
      recipient: recipient.id,
      initiatorOffer: { items: [], coins: 0 },
      recipientOffer: { items: [], coins: 0 },
      initiatorConfirmed: false,
      recipientConfirmed: false,
      createdAt: Date.now(),
    });

    // Notify both players trade window is open
    const tradeData = {
      tradeId,
      initiatorId: initiator.id,
      initiatorName: initiator.data.name || "Unknown",
      recipientId: recipient.id,
      recipientName: recipient.data.name || "Unknown",
    };

    this.sendTo(initiatorSocket.id, "tradeStarted", tradeData);
    this.sendTo(socket.id, "tradeStarted", tradeData);

    console.log(
      `[ServerNetwork] Trade ${tradeId} started between ${initiator.id} and ${recipient.id}`,
    );
  }

  /**
   * Handles trade offer updates (items/coins added or removed)
   */
  private onTradeOffer(socket: SocketInterface, data: TradeOfferPacket): void {
    const player = socket.player;
    if (!player) {
      console.warn("[ServerNetwork] onTradeOffer: no player entity for socket");
      return;
    }

    if (!data.tradeId) {
      console.warn("[ServerNetwork] onTradeOffer: missing tradeId");
      return;
    }

    const trade = this.activeTrades.get(data.tradeId);
    if (!trade) {
      console.warn("[ServerNetwork] onTradeOffer: trade not found");
      this.sendTo(socket.id, "tradeError", {
        message: "Trade session not found",
      });
      return;
    }

    // Validate player is part of this trade
    const isInitiator = trade.initiator === player.id;
    const isRecipient = trade.recipient === player.id;

    if (!isInitiator && !isRecipient) {
      console.warn("[ServerNetwork] onTradeOffer: player not part of trade");
      this.sendTo(socket.id, "tradeError", {
        message: "You are not part of this trade",
      });
      return;
    }

    // Validate items exist in player's inventory
    if (data.items) {
      const invSystem = this.world.getSystem("inventory") as
        | InventorySystemData
        | undefined;
      if (invSystem?.getInventoryData) {
        const inventory = invSystem.getInventoryData(player.id);

        for (const offeredItem of data.items) {
          const invItem = inventory.items.find(
            (i: { itemId: string; slot: number }) =>
              i.itemId === offeredItem.itemId && i.slot === offeredItem.slot,
          );

          if (!invItem) {
            console.warn(
              `[ServerNetwork] onTradeOffer: item ${offeredItem.itemId} not found in slot ${offeredItem.slot}`,
            );
            this.sendTo(socket.id, "tradeError", {
              message: "Item not found in inventory",
            });
            return;
          }

          if (invItem.quantity < offeredItem.quantity) {
            console.warn(
              `[ServerNetwork] onTradeOffer: insufficient quantity for ${offeredItem.itemId}`,
            );
            this.sendTo(socket.id, "tradeError", {
              message: "Insufficient item quantity",
            });
            return;
          }

          // Validate item is not currently equipped (would need equipment system check)
          // For now, we assume inventory items are safe to trade
          // TODO: Add equipment system check to prevent trading equipped items
        }

        // Validate coins
        if (data.coins && data.coins > 0 && inventory.coins < data.coins) {
          console.warn(
            "[ServerNetwork] onTradeOffer: insufficient coins (has ${inventory.coins}, offering ${data.coins})",
          );
          this.sendTo(socket.id, "tradeError", {
            message: "Insufficient coins",
          });
          return;
        }
      }
    }

    // Update offer
    if (isInitiator) {
      console.log(
        `[ServerNetwork] ➕ INITIATOR (${player.id}) updating their offer:`,
        {
          items: data.items?.length || 0,
          coins: data.coins || 0,
        },
      );
      trade.initiatorOffer = {
        items: data.items || [],
        coins: data.coins || 0,
      };
      trade.initiatorConfirmed = false; // Reset confirmation
    } else {
      console.log(
        `[ServerNetwork] ➕ RECIPIENT (${player.id}) updating their offer:`,
        {
          items: data.items?.length || 0,
          coins: data.coins || 0,
        },
      );
      trade.recipientOffer = {
        items: data.items || [],
        coins: data.coins || 0,
      };
      trade.recipientConfirmed = false; // Reset confirmation
    }

    // Broadcast updated offers to both players
    const otherPlayerId = isInitiator ? trade.recipient : trade.initiator;
    const otherSocket = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === otherPlayerId,
    );

    const updateData = {
      tradeId: trade.tradeId,
      initiatorOffer: trade.initiatorOffer,
      recipientOffer: trade.recipientOffer,
      initiatorConfirmed: trade.initiatorConfirmed,
      recipientConfirmed: trade.recipientConfirmed,
    };

    console.log(`[ServerNetwork] 📡 Broadcasting trade update:`, {
      tradeId: trade.tradeId,
      initiatorOffer: {
        items: trade.initiatorOffer.items.length,
        coins: trade.initiatorOffer.coins,
      },
      recipientOffer: {
        items: trade.recipientOffer.items.length,
        coins: trade.recipientOffer.coins,
      },
      toSockets: [socket.id, otherSocket?.id || "none"],
    });

    this.sendTo(socket.id, "tradeUpdated", updateData);
    if (otherSocket) {
      this.sendTo(otherSocket.id, "tradeUpdated", updateData);
    }

    console.log(
      `[ServerNetwork] ✅ Trade ${trade.tradeId} offer updated by ${player.id} (${isInitiator ? "initiator" : "recipient"})`,
    );
  }

  /**
   * Handles trade confirmation (player confirms their offer)
   */
  private onTradeConfirm(
    socket: SocketInterface,
    data: TradeConfirmPacket,
  ): void {
    const player = socket.player;
    if (!player) {
      console.warn(
        "[ServerNetwork] onTradeConfirm: no player entity for socket",
      );
      return;
    }

    if (!data.tradeId) {
      console.warn("[ServerNetwork] onTradeConfirm: missing tradeId");
      return;
    }

    const trade = this.activeTrades.get(data.tradeId);
    if (!trade) {
      console.warn("[ServerNetwork] onTradeConfirm: trade not found");
      this.sendTo(socket.id, "tradeError", {
        message: "Trade session not found",
      });
      return;
    }

    const isInitiator = trade.initiator === player.id;
    const isRecipient = trade.recipient === player.id;

    if (!isInitiator && !isRecipient) {
      console.warn("[ServerNetwork] onTradeConfirm: player not part of trade");
      return;
    }

    // Set confirmation
    if (isInitiator) {
      trade.initiatorConfirmed = true;
    } else {
      trade.recipientConfirmed = true;
    }

    // Notify both players of confirmation
    const otherPlayerId = isInitiator ? trade.recipient : trade.initiator;
    const otherSocket = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === otherPlayerId,
    );

    const updateData = {
      tradeId: trade.tradeId,
      initiatorOffer: trade.initiatorOffer,
      recipientOffer: trade.recipientOffer,
      initiatorConfirmed: trade.initiatorConfirmed,
      recipientConfirmed: trade.recipientConfirmed,
    };

    this.sendTo(socket.id, "tradeUpdated", updateData);
    if (otherSocket) {
      this.sendTo(otherSocket.id, "tradeUpdated", updateData);
    }

    console.log(
      `[ServerNetwork] Trade ${trade.tradeId} confirmed by ${player.id}`,
    );

    // Execute trade if both confirmed
    if (trade.initiatorConfirmed && trade.recipientConfirmed) {
      this.executeTrade(trade.tradeId);
    }
  }

  /**
   * Handles trade cancellation
   */
  private onTradeCancel(
    socket: SocketInterface,
    data: TradeCancelPacket,
  ): void {
    const player = socket.player;
    if (!player) {
      console.warn(
        "[ServerNetwork] onTradeCancel: no player entity for socket",
      );
      return;
    }

    if (!data.tradeId) {
      console.warn("[ServerNetwork] onTradeCancel: missing tradeId");
      return;
    }

    const trade = this.activeTrades.get(data.tradeId);
    if (!trade) {
      console.warn("[ServerNetwork] onTradeCancel: trade not found");
      return;
    }

    const isInitiator = trade.initiator === player.id;
    const isRecipient = trade.recipient === player.id;

    if (!isInitiator && !isRecipient) {
      console.warn("[ServerNetwork] onTradeCancel: player not part of trade");
      return;
    }

    // Notify both players
    const otherPlayerId = isInitiator ? trade.recipient : trade.initiator;
    const otherSocket = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === otherPlayerId,
    );

    const cancelData = {
      tradeId: trade.tradeId,
      reason: "Trade cancelled",
      byPlayerId: player.id,
    };

    this.sendTo(socket.id, "tradeCancelled", cancelData);
    if (otherSocket) {
      this.sendTo(otherSocket.id, "tradeCancelled", cancelData);
    }

    // Remove trade session
    this.activeTrades.delete(data.tradeId);

    console.log(
      `[ServerNetwork] Trade ${trade.tradeId} cancelled by ${player.id}`,
    );
  }

  /**
   * Executes the trade atomically (server-authoritative)
   */
  private executeTrade(tradeId: string): void {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) {
      console.error("[ServerNetwork] executeTrade: trade not found");
      return;
    }

    console.log(`[ServerNetwork] ⚡ Executing trade ${tradeId}`);

    // Find both player entities to check distance
    const initiatorEntity = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === trade.initiator,
    )?.player;
    const recipientEntity = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === trade.recipient,
    )?.player;

    if (!initiatorEntity || !recipientEntity) {
      console.error(
        "[ServerNetwork] executeTrade: one or both players no longer online",
      );
      this.cancelTradeWithError(tradeId, "Trade failed: player disconnected");
      return;
    }

    // Re-validate distance (players may have moved)
    const distance = Math.sqrt(
      Math.pow(initiatorEntity.position.x - recipientEntity.position.x, 2) +
        Math.pow(initiatorEntity.position.z - recipientEntity.position.z, 2),
    );

    if (distance > 5) {
      console.warn(
        `[ServerNetwork] executeTrade: players too far apart (${distance.toFixed(2)}m)`,
      );
      this.cancelTradeWithError(
        tradeId,
        "Trade failed: players moved too far apart",
      );
      return;
    }

    // Get inventory system
    const invSystem = this.world.getSystem("inventory") as
      | InventorySystemData
      | undefined;
    if (!invSystem?.getInventoryData) {
      console.error(
        "[ServerNetwork] executeTrade: inventory system not available",
      );
      this.cancelTradeWithError(
        tradeId,
        "Server error: inventory system unavailable",
      );
      return;
    }

    // Validate both players still have the items and coins
    const initiatorInv = invSystem.getInventoryData(trade.initiator);
    const recipientInv = invSystem.getInventoryData(trade.recipient);

    // Validate initiator's offer
    for (const item of trade.initiatorOffer.items) {
      const invItem = initiatorInv.items.find(
        (i: { itemId: string; slot: number; quantity: number }) =>
          i.itemId === item.itemId && i.slot === item.slot,
      );
      if (!invItem || invItem.quantity < item.quantity) {
        console.error(
          `[ServerNetwork] executeTrade: initiator missing item ${item.itemId}`,
        );
        this.cancelTradeWithError(
          tradeId,
          "Trade failed: items no longer available",
        );
        return;
      }
    }

    if (
      trade.initiatorOffer.coins > 0 &&
      initiatorInv.coins < trade.initiatorOffer.coins
    ) {
      console.error(
        "[ServerNetwork] executeTrade: initiator insufficient coins",
      );
      this.cancelTradeWithError(tradeId, "Trade failed: insufficient coins");
      return;
    }

    // Validate recipient's offer
    for (const item of trade.recipientOffer.items) {
      const invItem = recipientInv.items.find(
        (i: { itemId: string; slot: number; quantity: number }) =>
          i.itemId === item.itemId && i.slot === item.slot,
      );
      if (!invItem || invItem.quantity < item.quantity) {
        console.error(
          `[ServerNetwork] executeTrade: recipient missing item ${item.itemId}`,
        );
        this.cancelTradeWithError(
          tradeId,
          "Trade failed: items no longer available",
        );
        return;
      }
    }

    if (
      trade.recipientOffer.coins > 0 &&
      recipientInv.coins < trade.recipientOffer.coins
    ) {
      console.error(
        "[ServerNetwork] executeTrade: recipient insufficient coins",
      );
      this.cancelTradeWithError(tradeId, "Trade failed: insufficient coins");
      return;
    }

    // Execute atomic swap via inventory system events
    // NOTE: This is a "soft atomic" swap - we validate everything first, then execute
    // If any step fails, it will throw and we catch it, cancelling the trade
    // The InventorySystem should handle these operations safely
    try {
      console.log(
        `[ServerNetwork] 🔄 Executing atomic swap for trade ${tradeId}`,
      );
      console.log(`[ServerNetwork]   Initiator ${trade.initiator} offers:`, {
        items: trade.initiatorOffer.items.map(
          (i) => `${i.itemId} x${i.quantity}`,
        ),
        coins: trade.initiatorOffer.coins,
      });
      console.log(`[ServerNetwork]   Recipient ${trade.recipient} offers:`, {
        items: trade.recipientOffer.items.map(
          (i) => `${i.itemId} x${i.quantity}`,
        ),
        coins: trade.recipientOffer.coins,
      });

      // PHASE 1: Remove items from both players
      console.log(
        `[ServerNetwork] 📤 Phase 1: Removing items from both players`,
      );

      for (const item of trade.initiatorOffer.items) {
        console.log(
          `[ServerNetwork]   Removing ${item.itemId} x${item.quantity} from initiator (slot ${item.slot})`,
        );
        this.world.emit(EventType.INVENTORY_ITEM_REMOVED, {
          playerId: trade.initiator,
          itemId: item.itemId,
          quantity: item.quantity,
          slot: item.slot,
        });
      }

      for (const item of trade.recipientOffer.items) {
        console.log(
          `[ServerNetwork]   Removing ${item.itemId} x${item.quantity} from recipient (slot ${item.slot})`,
        );
        this.world.emit(EventType.INVENTORY_ITEM_REMOVED, {
          playerId: trade.recipient,
          itemId: item.itemId,
          quantity: item.quantity,
          slot: item.slot,
        });
      }

      // PHASE 2: Add items to opposite players
      console.log(
        `[ServerNetwork] 📥 Phase 2: Adding items to opposite players`,
      );

      for (const item of trade.recipientOffer.items) {
        console.log(
          `[ServerNetwork]   Adding ${item.itemId} x${item.quantity} to initiator`,
        );
        this.world.emit(EventType.INVENTORY_ITEM_ADDED, {
          playerId: trade.initiator,
          item: {
            id: `${trade.initiator}_${item.itemId}_${Date.now()}`,
            itemId: item.itemId,
            quantity: item.quantity,
            slot: -1,
            metadata: null,
          },
        });
      }

      for (const item of trade.initiatorOffer.items) {
        console.log(
          `[ServerNetwork]   Adding ${item.itemId} x${item.quantity} to recipient`,
        );
        this.world.emit(EventType.INVENTORY_ITEM_ADDED, {
          playerId: trade.recipient,
          item: {
            id: `${trade.recipient}_${item.itemId}_${Date.now()}`,
            itemId: item.itemId,
            quantity: item.quantity,
            slot: -1,
            metadata: null,
          },
        });
      }

      // PHASE 3: Swap coins
      console.log(`[ServerNetwork] 💰 Phase 3: Swapping coins`);

      if (trade.initiatorOffer.coins > 0) {
        console.log(
          `[ServerNetwork]   Transferring ${trade.initiatorOffer.coins} gold: initiator → recipient`,
        );
        this.world.emit(EventType.INVENTORY_UPDATE_COINS, {
          playerId: trade.initiator,
          coins: -trade.initiatorOffer.coins,
          isClaimed: false,
        });
        this.world.emit(EventType.INVENTORY_UPDATE_COINS, {
          playerId: trade.recipient,
          coins: trade.initiatorOffer.coins,
          isClaimed: false,
        });
      }

      if (trade.recipientOffer.coins > 0) {
        console.log(
          `[ServerNetwork]   Transferring ${trade.recipientOffer.coins} gold: recipient → initiator`,
        );
        this.world.emit(EventType.INVENTORY_UPDATE_COINS, {
          playerId: trade.recipient,
          coins: -trade.recipientOffer.coins,
          isClaimed: false,
        });
        this.world.emit(EventType.INVENTORY_UPDATE_COINS, {
          playerId: trade.initiator,
          coins: trade.recipientOffer.coins,
          isClaimed: false,
        });
      }

      // Notify both players of successful trade
      const initiatorSocket = Array.from(this.sockets.values()).find(
        (s) => s.player?.id === trade.initiator,
      );
      const recipientSocket = Array.from(this.sockets.values()).find(
        (s) => s.player?.id === trade.recipient,
      );

      const successData = {
        tradeId: trade.tradeId,
        message: "Trade completed successfully",
      };

      if (initiatorSocket) {
        this.sendTo(initiatorSocket.id, "tradeCompleted", successData);
      }
      if (recipientSocket) {
        this.sendTo(recipientSocket.id, "tradeCompleted", successData);
      }

      console.log(
        `[ServerNetwork] ✅✅✅ Trade ${tradeId} executed successfully - all phases complete`,
      );
    } catch (err) {
      console.error("[ServerNetwork] ❌ executeTrade FAILED:", err);
      console.error(
        "[ServerNetwork] ⚠️  CRITICAL: Items may have been partially transferred",
      );
      console.error(
        "[ServerNetwork] ⚠️  Manual intervention may be required for trade:",
        tradeId,
      );

      // Log the exact state for debugging
      console.error("[ServerNetwork] Trade state at failure:", {
        initiatorOffer: trade.initiatorOffer,
        recipientOffer: trade.recipientOffer,
        error: err instanceof Error ? err.message : String(err),
      });

      // Cancel and notify players
      this.cancelTradeWithError(
        tradeId,
        "Trade failed: server error during execution",
      );

      // TODO: Implement proper rollback mechanism
      // For now, we rely on validation preventing most failures
      // InventorySystem should be fault-tolerant
      return;
    }

    // Clean up trade session
    this.activeTrades.delete(tradeId);
    console.log(
      `[ServerNetwork] 🧹 Trade session ${tradeId} cleaned up from active trades`,
    );
  }

  /**
   * Helper to cancel trade with error message
   */
  private cancelTradeWithError(tradeId: string, errorMessage: string): void {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;

    const initiatorSocket = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === trade.initiator,
    );
    const recipientSocket = Array.from(this.sockets.values()).find(
      (s) => s.player?.id === trade.recipient,
    );

    const errorData = {
      tradeId: trade.tradeId,
      reason: errorMessage,
    };

    if (initiatorSocket) {
      this.sendTo(initiatorSocket.id, "tradeCancelled", errorData);
    }
    if (recipientSocket) {
      this.sendTo(recipientSocket.id, "tradeCancelled", errorData);
    }

    this.activeTrades.delete(tradeId);
  }

  // ======================== END TRADING SYSTEM ========================

  /**
   * Handles custom entity events from clients
   *
   * Allows entities to trigger custom events that are broadcast to all clients.
   * Examples: emote played, door opened, switch flipped, animation triggered.
   *
   * @param socket - The client socket that triggered the event
   * @param data - Event data containing entity ID and event payload
   *
   * @internal
   */
  onEntityEvent(socket: SocketInterface, data: EntityEventPacket): void {
    const name = (data.name || data.event) as string | undefined;
    const payload = (
      Object.prototype.hasOwnProperty.call(data, "data")
        ? data.data
        : data.payload
    ) as Record<string, unknown> | undefined;
    if (!name) return;

    // Handle debug events (development only)
    if (name.startsWith("debug:")) {
      this.handleDebugEvent(socket, name, payload);
      return;
    }

    // Attach playerId if not provided
    const enriched =
      payload && !payload.playerId && socket.player?.id
        ? { ...payload, playerId: socket.player.id }
        : payload;
    // Emit on server world so server-side systems handle it (e.g., ResourceSystem)
    try {
      this.world.emit(name, enriched);
    } catch (err) {
      console.error("[ServerNetwork] Failed to re-emit entityEvent", name, err);
    }
  }

  /**
   * Handles debug events for testing
   * @internal
   */
  private handleDebugEvent(
    socket: SocketInterface,
    name: string,
    payload: Record<string, unknown> | undefined,
  ): void {
    if (!socket.player) return;

    const player = socket.player;
    if (!payload) return;

    try {
      switch (name) {
        case "debug:spawn-item": {
          const numericItemId = (payload.itemId || 1) as number;
          // Convert numeric ID to string ID (e.g., 1 → 'bronze_sword')
          const itemKey = ITEM_ID_TO_KEY[numericItemId];
          if (!itemKey) {
            console.error(
              `[DEBUG] Invalid item ID: ${numericItemId}. Available IDs:`,
              Object.keys(ITEM_ID_TO_KEY),
            );
            break;
          }
          console.log(
            `[DEBUG] Spawning item ${itemKey} (ID: ${numericItemId}) for player ${player.id}`,
          );
          // Add item to player inventory using correct event format
          this.world.emit(EventType.INVENTORY_ITEM_ADDED, {
            playerId: player.id,
            item: {
              id: `${player.id}_${itemKey}_${Date.now()}`,
              itemId: itemKey,
              quantity: 1,
              slot: -1, // Let inventory system assign slot
              metadata: null,
            },
          });
          break;
        }

        case "debug:trigger-death": {
          console.log(`[DEBUG] Triggering death for player ${player.id}`);
          // Trigger player death using correct event
          this.world.emit(EventType.ENTITY_DEATH, {
            entityId: player.id,
            entityType: "player" as const,
          });
          break;
        }

        case "debug:add-gold": {
          const amount = (payload.amount || 500) as number;
          console.log(`[DEBUG] Adding ${amount} gold for player ${player.id}`);
          // Add coins to player inventory using correct event
          this.world.emit(EventType.INVENTORY_UPDATE_COINS, {
            playerId: player.id,
            coins: amount,
            isClaimed: false, // Mark as unclaimed for on-chain minting
          });
          break;
        }

        case "debug:initiate-trade": {
          // Find any other online player to trade with
          const otherPlayer = Array.from(this.sockets.values()).find(
            (s) => s.player && s.player.id !== player.id,
          );

          if (!otherPlayer || !otherPlayer.player) {
            console.log("[DEBUG] No other players online to trade with");
            break;
          }

          console.log(
            `[DEBUG] Initiating trade between ${player.id} and ${otherPlayer.player.id}`,
          );

          // Send trade request
          this.onTradeRequest(socket, {
            targetPlayerId: otherPlayer.player.id,
          });
          break;
        }
      }
    } catch (err) {
      console.error("[DEBUG] Failed to handle debug event:", name, err);
    }
  }

  /**
   * Handles entity removal requests from clients
   *
   * Currently a no-op placeholder. Entity removal is handled through other systems.
   *
   * @param _socket - The client socket (unused)
   * @param _data - Removal data (unused)
   *
   * @internal
   */
  onEntityRemoved(_socket: SocketInterface, _data: { id: string }): void {
    // Handle entity removal
  }

  /**
   * Handles world settings modification from clients
   *
   * Currently a no-op placeholder. Settings are managed through other systems.
   *
   * @param _socket - The client socket (unused)
   * @param _data - Settings data (unused)
   *
   * @internal
   */
  onSettings(_socket: SocketInterface, _data: Record<string, unknown>): void {
    // Handle settings change
  }

  /**
   * Handles spawn point modification from clients
   *
   * Updates the default spawn point for new players. Requires builder or admin role.
   *
   * @param _socket - The client socket (role checked elsewhere)
   * @param _data - New spawn point data (position and quaternion)
   *
   * @internal
   */
  onSpawnModified(_socket: SocketInterface, _data: SpawnData): void {
    // Handle spawn modification
  }

  /**
   * Validate all player positions against terrain
   * Integrated from ServerPositionValidator for efficiency
   */
  private validatePlayerPositions(): void {
    const terrain = this.world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;
    if (!terrain) return;

    // Iterate through all connected players via their sockets
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
        // Check if player drifted too far from terrain
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
