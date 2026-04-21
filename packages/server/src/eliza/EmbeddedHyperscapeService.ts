/**
 * EmbeddedHyperscapeService - Direct world integration for embedded agents
 *
 * Unlike the plugin-hyperscape WebSocket service, this service runs in the same
 * process as the server and has direct access to the World instance.
 *
 * This eliminates network latency and simplifies the architecture for
 * agents that run on the server itself.
 */

import {
  EventType,
  getDuelArenaConfig,
  getItem,
  isPositionInsideCombatArena,
  ALL_WORLD_AREAS,
  type World,
} from "@hyperscape/shared";
import { errMsg } from "../shared/errMsg.js";
import type {
  IEmbeddedHyperscapeService,
  EmbeddedGameState,
  NearbyEntityData,
  AgentQuestProgress,
  AgentQuestInfo,
} from "./types.js";

/** World map data shape matching plugin-hyperscape WorldMapData */
interface EmbeddedWorldMapData {
  towns: Array<{
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    size: string;
    biome: string;
    buildings: Array<{ type: string }>;
  }>;
  pois: Array<{
    id: string;
    name: string;
    category: string;
    position: { x: number; y: number; z: number };
    biome: string;
  }>;
  pointsOfInterest?: Array<{
    id: string;
    name: string;
    category: string;
    position: { x: number; y: number; z: number };
    biome: string;
  }>;
  resources: Array<{
    type: string;
    resourceId: string;
    position: { x: number; y: number; z: number };
    areaId: string;
  }>;
  stations: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    areaId: string;
  }>;
  npcs: Array<{
    id: string;
    type: string;
    name?: string;
    position: { x: number; y: number; z: number };
    areaId: string;
  }>;
}

// Distance threshold for "nearby" entities (in world units)
const NEARBY_DISTANCE = 50;
/** Pre-computed squared distance for comparison without Math.sqrt */
const NEARBY_DISTANCE_SQ = NEARBY_DISTANCE * NEARBY_DISTANCE;
/** How many ticks a cached getNearbyEntities result is valid (for game-tick callers) */
const NEARBY_CACHE_TTL_TICKS = 2;
/** Time-based cache TTL for agent bridge callers (ms) — entities don't move
 *  fast enough to warrant scanning more than once per second */
const NEARBY_CACHE_TTL_MS = 1000;

/**
 * Shared entity snapshot across all EmbeddedHyperscapeService instances.
 * Instead of each agent scanning all 300+ entities independently, we scan once
 * per second and share the raw data. Each agent then filters by its own position.
 */
interface EntitySnapshot {
  id: string;
  position: [number, number, number];
  data: Record<string, unknown>;
  entity: unknown; // raw entity ref for isDead/isAlive checks
}
const SHARED_SNAPSHOT_TTL_MS = 1000;

/** Per-world snapshot cache. Keyed by world reference to prevent cross-contamination
 *  when multiple World instances coexist (e.g. in tests). */
const _snapshotCache = new WeakMap<
  object,
  { snapshot: EntitySnapshot[]; time: number }
>();

function getSharedEntitySnapshot(
  world: {
    entities: { items: { entries: () => IterableIterator<[string, unknown]> } };
  },
  getPos: (entity: unknown) => [number, number, number] | null,
): EntitySnapshot[] {
  const now = Date.now();
  const cached = _snapshotCache.get(world);
  if (
    cached &&
    now - cached.time < SHARED_SNAPSHOT_TTL_MS &&
    cached.snapshot.length > 0
  ) {
    return cached.snapshot.slice();
  }
  const snapshot: EntitySnapshot[] = [];
  for (const [id, entity] of world.entities.items.entries()) {
    const data = (entity as { data?: Record<string, unknown> }).data;
    if (!data) continue;
    const pos = getPos(entity);
    if (!pos) continue;
    snapshot.push({ id, position: pos, data, entity });
  }
  _snapshotCache.set(world, { snapshot, time: now });
  return snapshot.slice();
}

// Event handler type
type EventHandler = (data: unknown) => void;

/**
 * Local chat message structure for agent context
 */
interface LocalChatMessage {
  from: string; // Sender name
  fromId: string; // Sender entity ID
  text: string; // Message content
  timestamp: number; // When received
  distance: number; // Distance from agent when received
}

/**
 * EmbeddedHyperscapeService provides direct World access for embedded agents
 *
 * Key differences from WebSocket-based HyperscapeService:
 * - No network connection needed (same process)
 * - Direct entity manipulation through World
 * - Direct event subscription through World events
 * - No packet encoding/decoding overhead
 */
export class EmbeddedHyperscapeService implements IEmbeddedHyperscapeService {
  private world: World;
  private characterId: string;
  private accountId: string;
  private name: string;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private worldListeners: Array<{
    event: string;
    fn: (...args: unknown[]) => void;
  }> = [];
  private playerEntityId: string | null = null;
  private isActive: boolean = false;
  /** When set, all executeMove targets are clamped to this XZ rectangle. */
  private _arenaBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } | null = null;
  /**
   * When false, the AgentBehaviorTicker skips this agent's autonomous tick.
   * Set to false while the agent is in the duel arena so it doesn't wander
   * off to do quests or explore between DuelCombatAI ticks.
   */
  private _autonomousEnabled: boolean = true;
  /** Set after we re-emit PLAYER_REGISTERED to bootstrap quest state. */
  private _questStateBootstrapEmitted: boolean = false;
  /** Reusable buffer for getNearbyEntities to reduce per-tick allocations. */
  private nearbyBuffer: NearbyEntityData[] = [];

  /** Cached getNearbyEntities result to avoid full world scan every tick */
  private _nearbyCache: NearbyEntityData[] = [];
  private _nearbyCacheTick = -1;
  private _nearbyCacheTime = 0;

  /** Double-buffer for getNearbyEntities to avoid slice() allocations */
  private _nearbyBufferA: NearbyEntityData[] = [];
  private _nearbyBufferB: NearbyEntityData[] = [];
  private _useBufferA = true;

  /** Pool of reusable NearbyEntityData objects to avoid per-entity allocations */
  private _nearbyEntityPool: NearbyEntityData[] = [];
  private _nearbyEntityPoolIndex = 0;

  /** Cached getAllNPCPositions result — NPCs don't move, cache for 10s */
  private _npcPositionsCache: Array<{
    id: string;
    name: string;
    npcId: string;
    position: [number, number, number];
  }> = [];
  private _npcPositionsCacheTime = 0;
  private static readonly NPC_CACHE_TTL_MS = 10_000;

  /** Cached getGameState result to avoid per-tick allocations */
  private _gameStateCache: EmbeddedGameState | null = null;
  private _gameStateCacheTick = -1;

  /** Cached inventory/equipment to avoid repeated system lookups */
  private _inventoryCache: Array<{
    slot: number;
    itemId: string;
    quantity: number;
  }> = [];
  private _inventoryCacheTick = -1;
  private _equipmentCache: Record<string, string | null> = {};
  private _equipmentCacheTick = -1;

  /** Local chat message buffer - stores recent messages from nearby entities */
  private localChatBuffer: LocalChatMessage[] = [];
  private static readonly LOCAL_CHAT_BUFFER_SIZE = 10;
  private static readonly LOCAL_CHAT_RADIUS = NEARBY_DISTANCE; // 50m

  constructor(
    world: World,
    characterId: string,
    accountId: string,
    name: string,
  ) {
    this.world = world;
    this.characterId = characterId;
    this.accountId = accountId;
    this.name = name;
  }

  setDisplayName(name: string): void {
    this.name = name;
  }

  /**
   * Initialize the service and spawn the agent's player entity
   */
  async initialize(): Promise<void> {
    const traceEnabled = process.env.EMBEDDED_AGENT_INIT_TRACE === "true";
    const startTime = Date.now();
    const trace = (step: string) => {
      if (!traceEnabled) return;
      const elapsed = Date.now() - startTime;
      console.debug(
        `[EmbeddedHyperscapeService][Trace] ${this.characterId} ${step} (+${elapsed}ms)`,
      );
    };

    // Check if player entity already exists
    const existingEntity = this.world.entities.get(this.characterId);
    if (existingEntity) {
      this.playerEntityId = this.characterId;
      this.isActive = true;
      this.subscribeToWorldEvents();
      // Emit PLAYER_REGISTERED so QuestSystem (and other systems) load state
      // for this agent. The normal entities.add() path emits this, but when
      // the entity already exists we skip that path entirely.
      this.emitDualChannel("player:registered", {
        playerId: this.characterId,
      });
      return;
    }

    // Load character data from database
    const databaseSystem = this.world.getSystem("database") as
      | {
          getPlayerAsync: (characterId: string) => Promise<{
            name?: string;
            avatar?: string | null;
            wallet?: string | null;
            positionX?: number;
            positionY?: number;
            positionZ?: number;
            attackLevel?: number;
            attackXp?: number;
            strengthLevel?: number;
            strengthXp?: number;
            defenseLevel?: number;
            defenseXp?: number;
            constitutionLevel?: number;
            constitutionXp?: number;
            rangedLevel?: number;
            rangedXp?: number;
            woodcuttingLevel?: number;
            woodcuttingXp?: number;
            miningLevel?: number;
            miningXp?: number;
            fishingLevel?: number;
            fishingXp?: number;
            firemakingLevel?: number;
            firemakingXp?: number;
            cookingLevel?: number;
            cookingXp?: number;
            smithingLevel?: number;
            smithingXp?: number;
            magicLevel?: number;
            magicXp?: number;
            prayerLevel?: number;
            prayerXp?: number;
            coins?: number;
          } | null>;
        }
      | undefined;

    if (!databaseSystem) {
      throw new Error("DatabaseSystem not available");
    }

    // Stream-mode agents default to a DB-free startup path to avoid blocking
    // stream health on remote database latency/transient stalls.
    const skipPersistentLoad =
      this.shouldUseStreamingSpawnPosition() &&
      process.env.STREAMING_AGENT_SKIP_DB_LOAD !== "false";

    // Get saved player data (position, skills) when persistence is enabled.
    // Cast to include magic/prayer skills which may not be in the older type definition.
    let savedData:
      | (Awaited<ReturnType<typeof databaseSystem.getPlayerAsync>> & {
          magicLevel?: number;
          magicXp?: number;
          prayerLevel?: number;
          prayerXp?: number;
        })
      | null = null;
    if (!skipPersistentLoad) {
      trace("before getPlayerAsync");
      savedData = (await databaseSystem.getPlayerAsync(this.characterId)) as
        | (Awaited<ReturnType<typeof databaseSystem.getPlayerAsync>> & {
            magicLevel?: number;
            magicXp?: number;
            prayerLevel?: number;
            prayerXp?: number;
          })
        | null;
      trace("after getPlayerAsync");

      if (!savedData) {
        throw new Error(
          `Character ${this.characterId} not found for account ${this.accountId}`,
        );
      }
    } else {
      trace("skipping getPlayerAsync (STREAMING_AGENT_SKIP_DB_LOAD fast path)");
    }

    // Determine spawn position
    const hasSavedPosition = savedData?.positionX !== undefined;
    let position: [number, number, number];
    if (this.shouldUseStreamingSpawnPosition()) {
      position = this.getStreamingAgentSpawnPosition();
    } else if (hasSavedPosition) {
      const playerPosition = savedData as NonNullable<typeof savedData>;
      position = [
        playerPosition.positionX ?? 0,
        playerPosition.positionY ?? 10,
        playerPosition.positionZ ?? 0,
      ];
    } else {
      position = this.getStreamingAgentSpawnPosition();
      console.warn(
        `[EmbeddedHyperscapeService] No saved spawn for ${this.characterId}; using dynamic fallback spawn`,
      );
    }

    // Snap agent spawns to terrain height for consistent grounded placement.
    trace("before groundSpawnPosition");
    position = this.groundSpawnPosition(position);
    trace("after groundSpawnPosition");

    // Load skills from saved data
    const skills = {
      attack: {
        level: savedData?.attackLevel || 1,
        xp: savedData?.attackXp || 0,
      },
      strength: {
        level: savedData?.strengthLevel || 1,
        xp: savedData?.strengthXp || 0,
      },
      defense: {
        level: savedData?.defenseLevel || 1,
        xp: savedData?.defenseXp || 0,
      },
      constitution: {
        level: savedData?.constitutionLevel || 10,
        xp: savedData?.constitutionXp || 0,
      },
      ranged: {
        level: savedData?.rangedLevel || 1,
        xp: savedData?.rangedXp || 0,
      },
      magic: { level: savedData?.magicLevel || 1, xp: savedData?.magicXp || 0 },
      prayer: {
        level: savedData?.prayerLevel || 1,
        xp: savedData?.prayerXp || 0,
      },
      woodcutting: {
        level: savedData?.woodcuttingLevel || 1,
        xp: savedData?.woodcuttingXp || 0,
      },
      mining: {
        level: savedData?.miningLevel || 1,
        xp: savedData?.miningXp || 0,
      },
      fishing: {
        level: savedData?.fishingLevel || 1,
        xp: savedData?.fishingXp || 0,
      },
      firemaking: {
        level: savedData?.firemakingLevel || 1,
        xp: savedData?.firemakingXp || 0,
      },
      cooking: {
        level: savedData?.cookingLevel || 1,
        xp: savedData?.cookingXp || 0,
      },
      smithing: {
        level: savedData?.smithingLevel || 1,
        xp: savedData?.smithingXp || 0,
      },
    };

    // Calculate health from constitution
    const health = skills.constitution.level;

    const addedEntity = this.world.entities.add
      ? this.world.entities.add({
          id: this.characterId,
          type: "player",
          position,
          quaternion: [0, 0, 0, 1],
          owner: `embedded-agent:${this.characterId}`,
          userId: this.accountId,
          name: savedData?.name || this.name,
          health,
          maxHealth: health,
          avatar:
            savedData?.avatar ||
            this.world.settings?.avatar?.url ||
            "asset://avatars/avatar-male-01.vrm",
          wallet: savedData?.wallet || undefined,
          roles: [],
          skills,
          autoRetaliate: true,
          isLoading: false, // Embedded agents start ready
          isAgent: true, // Mark as AI agent
        })
      : undefined;

    if (!addedEntity) {
      throw new Error("Failed to spawn player entity");
    }

    this.playerEntityId = this.characterId;
    this.isActive = true;

    // Broadcast entityAdded to all connected clients so they see the agent
    const networkSystem = this.world.getSystem("network") as
      | { send?: (name: string, data: unknown) => void }
      | undefined;
    if (networkSystem?.send) {
      const serialized =
        typeof (addedEntity as { serialize?: () => unknown }).serialize ===
        "function"
          ? (addedEntity as { serialize: () => unknown }).serialize()
          : (addedEntity as { data?: unknown }).data;
      networkSystem.send("entityAdded", serialized);
    }

    // Emit player joined event
    this.world.emit(EventType.PLAYER_JOINED, {
      playerId: this.characterId,
      player:
        addedEntity as unknown as import("@hyperscape/shared").PlayerLocal,
      isEmbeddedAgent: true,
    });

    // Subscribe to world events
    this.subscribeToWorldEvents();

    // Explicitly emit PLAYER_REGISTERED on both channels so QuestSystem,
    // CoinPouchSystem, etc. load this agent's persisted state from the DB.
    // Entities.addEntity() already emits this via emitTypedEvent, but we
    // re-emit to guarantee it reaches EventBus subscribers even if there
    // was a race during entity creation.
    this.emitDualChannel("player:registered", {
      playerId: this.characterId,
    });
  }

  /**
   * Subscribe to world events and forward to registered handlers
   */
  private subscribeToWorldEvents(): void {
    // Guard: prevent duplicate subscriptions if initialize() is called
    // multiple times without stop() in between.
    if (this.worldListeners.length > 0) {
      return;
    }

    const track = (event: string, fn: (...args: unknown[]) => void) => {
      this.world.on(event, fn);
      this.worldListeners.push({ event, fn });
    };

    // Subscribe to entity events
    track(EventType.ENTITY_CREATED, (data) => {
      this.broadcastEvent("ENTITY_JOINED", data);
    });

    track(EventType.ENTITY_MODIFIED, (data) => {
      this.broadcastEvent("ENTITY_UPDATED", data);
    });

    track(EventType.ENTITY_REMOVE, (data) => {
      this.broadcastEvent("ENTITY_LEFT", data);
    });

    // Subscribe to inventory events
    track(EventType.INVENTORY_UPDATED, (data) => {
      const eventData = data as { playerId?: string };
      if (eventData.playerId === this.characterId) {
        this.broadcastEvent("INVENTORY_UPDATED", data);
      }
    });

    // Subscribe to skills events
    track(EventType.SKILLS_UPDATED, (data) => {
      const eventData = data as { playerId?: string };
      if (eventData.playerId === this.characterId) {
        this.broadcastEvent("SKILLS_UPDATED", data);
      }
    });

    // Subscribe to chat events - filter by proximity and add to local buffer
    track(EventType.CHAT_MESSAGE, (data) => {
      this.handleChatMessage(data);
      this.broadcastEvent("CHAT_MESSAGE", data);
    });
  }

  /**
   * Handle incoming chat message - filter by proximity and add to local buffer
   */
  private handleChatMessage(data: unknown): void {
    const msg = data as {
      playerId?: string;
      fromId?: string;
      text?: string;
      body?: string;
      from?: string;
    };

    const senderId = msg.playerId || msg.fromId;
    const messageText = msg.text || msg.body;
    const senderName = msg.from || "Unknown";

    // Skip if no sender ID, message text, or if it's our own message
    if (!senderId || !messageText || senderId === this.characterId) {
      return;
    }

    // Get sender position
    const senderEntity = this.world.entities.get(senderId);
    if (!senderEntity) {
      return;
    }

    const senderPos = this.getEntityPosition(senderEntity);
    if (!senderPos) {
      return;
    }

    // Get our position
    const player = this.playerEntityId
      ? this.world.entities.get(this.playerEntityId)
      : null;
    if (!player) {
      return;
    }

    const playerPos = this.getEntityPosition(player);
    if (!playerPos) {
      return;
    }

    // Calculate distance
    const dx = senderPos[0] - playerPos[0];
    const dz = senderPos[2] - playerPos[2];
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Only track messages within local chat radius (50m)
    if (distance > EmbeddedHyperscapeService.LOCAL_CHAT_RADIUS) {
      return;
    }

    // Add to buffer (newest first)
    this.localChatBuffer.unshift({
      from: senderName,
      fromId: senderId,
      text: messageText,
      timestamp: Date.now(),
      distance,
    });

    // Trim buffer to max size
    if (
      this.localChatBuffer.length >
      EmbeddedHyperscapeService.LOCAL_CHAT_BUFFER_SIZE
    ) {
      this.localChatBuffer.length =
        EmbeddedHyperscapeService.LOCAL_CHAT_BUFFER_SIZE;
    }
  }

  /**
   * Broadcast event to registered handlers
   */
  private broadcastEvent(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(
            `[EmbeddedHyperscapeService] Event handler error for ${event}:`,
            err,
          );
        }
      });
    }
  }

  /**
   * Stop the service and remove the player entity
   */
  async stop(): Promise<void> {
    this.isActive = false;

    // Remove world event listeners to prevent leaks on agent restart
    for (const { event, fn } of this.worldListeners) {
      this.world.off(event, fn);
    }
    this.worldListeners = [];

    // Remove player entity and notify clients
    if (this.playerEntityId && this.world.entities?.remove) {
      const networkSystem = this.world.getSystem("network") as
        | { send?: (name: string, data: unknown) => void }
        | undefined;
      if (networkSystem?.send) {
        networkSystem.send("entityRemoved", this.playerEntityId);
      }

      this.world.entities.remove(this.playerEntityId);
      this.world.emit(EventType.PLAYER_LEFT, {
        playerId: this.playerEntityId,
      });
    }

    this.playerEntityId = null;

    // Invalidate nearby entities cache
    this._nearbyCache = [];
    this._nearbyCacheTick = -1;

    // Clear local chat buffer
    this.localChatBuffer = [];

    this.eventHandlers.clear();
  }

  // ============================================================================
  // IEmbeddedHyperscapeService Implementation
  // ============================================================================

  getWorld(): World {
    return this.world;
  }

  invalidateNearbyEntityCache(): void {
    this._nearbyCacheTick = -1;
  }

  getGameState(): EmbeddedGameState | null {
    if (!this.playerEntityId || !this.isActive) {
      return null;
    }

    // Return cached result if same tick (avoids per-tick allocations)
    const currentTick = this.world.currentTick ?? 0;
    if (currentTick === this._gameStateCacheTick && this._gameStateCache) {
      return this._gameStateCache;
    }

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) {
      return null;
    }

    const data = player.data as Record<string, unknown>;
    const position = this.getEntityPosition(player);
    const skills = (data.skills || {}) as Record<
      string,
      { level: number; xp: number }
    >;
    const inventory = this.getInventoryItems();
    const equippedRaw = this.getEquippedItems();

    // Reuse equipment object if possible
    const equipment = this._gameStateCache?.equipment || {};
    // Clear old keys
    for (const key in equipment) {
      delete equipment[key];
    }
    for (const [slot, itemId] of Object.entries(equippedRaw)) {
      if (itemId) equipment[slot] = { itemId };
    }

    // Reuse or create game state object
    if (!this._gameStateCache) {
      this._gameStateCache = {
        playerId: this.playerEntityId,
        position,
        health: (data.health as number) || 10,
        maxHealth: (data.maxHealth as number) || 10,
        alive: data.alive !== false,
        skills,
        inventory,
        equipment,
        nearbyEntities: this.getNearbyEntities(),
        inCombat: !!(data.inCombat || data.combatTarget),
        currentTarget: (data.combatTarget as string) || null,
        activePrayers: (data.activePrayers as string[]) || [],
      };
    } else {
      // Update existing cached object in-place
      this._gameStateCache.playerId = this.playerEntityId;
      this._gameStateCache.position = position;
      this._gameStateCache.health = (data.health as number) || 10;
      this._gameStateCache.maxHealth = (data.maxHealth as number) || 10;
      this._gameStateCache.alive = data.alive !== false;
      this._gameStateCache.skills = skills;
      this._gameStateCache.inventory = inventory;
      this._gameStateCache.equipment = equipment;
      this._gameStateCache.nearbyEntities = this.getNearbyEntities();
      this._gameStateCache.inCombat = !!(data.inCombat || data.combatTarget);
      this._gameStateCache.currentTarget =
        (data.combatTarget as string) || null;
      this._gameStateCache.activePrayers =
        (data.activePrayers as string[]) || [];
    }

    this._gameStateCacheTick = currentTick;
    return this._gameStateCache;
  }

  /**
   * Facing yaw for dashboard scripted intents (attack/gather target cone).
   * Prefer live entity node euler Y; fall back to serialized quaternion in data.
   */
  getPlayerYaw(): number | null {
    if (!this.playerEntityId || !this.isActive) {
      return null;
    }
    const player = this.world.entities.get(this.playerEntityId);
    if (!player) {
      return null;
    }

    const node = (
      player as {
        node?: { rotation?: { y?: number } };
      }
    ).node;
    const eulerY = node?.rotation?.y;
    if (typeof eulerY === "number" && Number.isFinite(eulerY)) {
      return eulerY;
    }

    const quat = (player as { data?: { quaternion?: number[] } }).data
      ?.quaternion;
    if (
      Array.isArray(quat) &&
      quat.length >= 4 &&
      quat.every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      const [x, y, z, w] = quat as [number, number, number, number];
      // Y-axis yaw from quaternion (Y-up, consistent with Three.js body yaw)
      return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
    }

    return null;
  }

  // ============================================================================
  // Local Chat Methods
  // ============================================================================

  /**
   * Get recent chat messages from nearby players/agents
   * Returns messages within 50m, newest first, up to 10 messages
   */
  getLocalChatMessages(): LocalChatMessage[] {
    return this.localChatBuffer;
  }

  /**
   * Owner message from POST /api/agents/:id/message (dashboard / viewport).
   * Cannot rely on CHAT_MESSAGE alone: Chat emits playerId = Privy account id,
   * which is not a world entity id, so handleChatMessage drops it before the buffer.
   */
  ingestOwnerDashboardMessage(text: string, ownerAccountId: string): void {
    const trimmed = text.trim();
    if (!trimmed || !this.isActive) {
      return;
    }
    this.localChatBuffer.unshift({
      from: "Dashboard",
      fromId: ownerAccountId,
      text: trimmed,
      timestamp: Date.now(),
      distance: 0,
    });
    if (
      this.localChatBuffer.length >
      EmbeddedHyperscapeService.LOCAL_CHAT_BUFFER_SIZE
    ) {
      this.localChatBuffer.length =
        EmbeddedHyperscapeService.LOCAL_CHAT_BUFFER_SIZE;
    }
  }

  /**
   * Send a chat message from this agent
   * Message will be broadcast to all clients and appear as overhead bubble
   * @returns The chat message id (for dashboard / API callers)
   */
  async sendChatMessage(text: string): Promise<string> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    // Validate message
    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new Error("Chat message cannot be empty");
    }

    // Enforce length limit (255 chars like player chat)
    const finalText =
      trimmedText.length > 255 ? trimmedText.slice(0, 255) : trimmedText;

    // Get player entity for name
    const player = this.world.entities.get(this.playerEntityId);
    const playerData = player?.data as { name?: string } | undefined;
    const playerName = playerData?.name || this.name;

    // Create chat message
    const chatMessage = {
      id: `${this.playerEntityId}-${Date.now()}`,
      from: playerName,
      fromId: this.playerEntityId,
      body: finalText,
      text: finalText,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      type: "chat",
      userName: playerName,
      userId: this.playerEntityId,
    };

    // Add to world chat system (triggers overhead bubble + broadcast)
    const chatSystem = this.world.chat as {
      add?: (msg: unknown, broadcast?: boolean) => void;
    };
    if (chatSystem?.add) {
      chatSystem.add(chatMessage, true);
    } else {
      // Fallback: emit chat event directly
      this.world.emit(EventType.CHAT_MESSAGE, {
        playerId: this.playerEntityId,
        text: finalText,
      });

      // Broadcast via network
      const networkSystem = this.world.getSystem("network") as
        | { send?: (name: string, data: unknown) => void }
        | undefined;
      if (networkSystem?.send) {
        networkSystem.send("chatAdded", chatMessage);
      }
    }

    return chatMessage.id;
  }

  getNearbyEntities(): NearbyEntityData[] {
    if (!this.playerEntityId || !this.isActive) {
      return [];
    }

    // Return cached result if still fresh (avoids full world scan every tick)
    const currentTick = this.world.currentTick ?? 0;
    const now = Date.now();
    if (
      this._nearbyCacheTick >= 0 &&
      (currentTick - this._nearbyCacheTick < NEARBY_CACHE_TTL_TICKS ||
        now - this._nearbyCacheTime < NEARBY_CACHE_TTL_MS)
    ) {
      return this._nearbyCache;
    }

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) {
      return [];
    }

    const playerPos = this.getEntityPosition(player);
    if (!playerPos) {
      return [];
    }

    // Use double-buffering: write to inactive buffer, then swap
    const nearby = this._useBufferA ? this._nearbyBufferA : this._nearbyBufferB;
    nearby.length = 0;
    this._nearbyEntityPoolIndex = 0;

    // Use shared entity snapshot (scanned once per second across ALL agent instances)
    // instead of each agent independently iterating all 300+ world entities
    const snapshot = getSharedEntitySnapshot(
      this.world as unknown as Parameters<typeof getSharedEntitySnapshot>[0],
      (e) =>
        this.getEntityPosition(
          e as Parameters<typeof this.getEntityPosition>[0],
        ),
    );

    for (const entry of snapshot) {
      if (entry.id === this.playerEntityId) continue; // Skip self

      // Distance-squared comparison (avoids expensive Math.sqrt per entity)
      const dx = entry.position[0] - playerPos[0];
      const dy = entry.position[1] - playerPos[1];
      const dz = entry.position[2] - playerPos[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > NEARBY_DISTANCE_SQ) continue;

      // Only compute sqrt for entities that pass the filter
      const distance = Math.sqrt(distSq);

      const entityData = entry.data;

      // Determine entity type
      const entityType = this.categorizeEntity(entityData);

      // Skip dead mobs — prevents agents from attacking corpses
      if (entityType === "mob") {
        const ent = entry.entity as {
          isDead?: () => boolean;
          isAlive?: () => boolean;
        };
        if (
          (typeof ent.isDead === "function" && ent.isDead()) ||
          (typeof ent.isAlive === "function" && !ent.isAlive()) ||
          entityData.alive === false ||
          entityData.dead === true ||
          entityData.health === 0 ||
          entityData.isDead === true
        ) {
          continue;
        }
      }

      // Extract equipped weapon for players
      let equippedWeapon: string | undefined = undefined;
      const equipData = entityData.equipment as Record<
        string,
        { itemId: string }
      >;
      if (equipData && equipData.weapon) {
        equippedWeapon = equipData.weapon.itemId;
      }

      // Reuse object from pool or create new one (pool grows once, then reuses)
      let entityObj = this._nearbyEntityPool[this._nearbyEntityPoolIndex];
      if (!entityObj) {
        entityObj = {} as NearbyEntityData;
        this._nearbyEntityPool[this._nearbyEntityPoolIndex] = entityObj;
      }
      this._nearbyEntityPoolIndex++;

      // Update object in-place
      entityObj.id = entry.id;
      entityObj.name = (entityData.name as string) || entry.id;
      entityObj.type = entityType;
      entityObj.position = entry.position;
      entityObj.distance = distance;
      entityObj.health = entityData.health as number | undefined;
      entityObj.maxHealth = entityData.maxHealth as number | undefined;
      entityObj.level = entityData.level as number | undefined;
      entityObj.mobType = entityData.mobType as string | undefined;
      entityObj.itemId = entityData.itemId as string | undefined;
      entityObj.resourceType = entityData.resourceType as string | undefined;
      entityObj.equippedWeapon = equippedWeapon;

      nearby.push(entityObj);
    }

    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);

    // Swap buffers - the inactive buffer becomes the cache
    this._useBufferA = !this._useBufferA;
    this._nearbyCache = nearby;
    this._nearbyCacheTick = currentTick;
    this._nearbyCacheTime = Date.now();

    return this._nearbyCache;
  }

  /** Emit a processing event via EventBus (which ProcessingSystem subscribes to) with EventEmitter fallback */
  private emitProcessingEvent(
    eventType: string,
    data: Record<string, unknown>,
  ): void {
    if (this.world.$eventBus) {
      this.world.$eventBus.emitEvent(
        eventType,
        data,
        "EmbeddedHyperscapeService",
      );
    } else {
      this.world.emit(eventType, data);
    }
  }

  /** Emit on both EventBus AND EventEmitter — needed when different systems listen on different channels */
  private emitDualChannel(
    eventType: string,
    data: Record<string, unknown>,
  ): void {
    if (this.world.$eventBus) {
      this.world.$eventBus.emitEvent(
        eventType,
        data,
        "EmbeddedHyperscapeService",
      );
    }
    this.world.emit(eventType, data);
  }

  private findNearbyObjectIdByKeyword(keyword: string): string | null {
    const normalizedKeyword = keyword.toLowerCase();
    const station = this.getNearbyEntities().find((entity) => {
      if (entity.type !== "object") return false;
      const haystack = `${entity.id} ${entity.name}`.toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
    return station?.id ?? null;
  }

  setArenaBounds(bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }): void {
    this._arenaBounds = bounds;
    // Also store on entity data so TileMovementManager.movePlayerToward() can
    // clamp ALL movement paths (combat follow, pending attack walk, etc.) —
    // not just the ones routed through executeMove().
    if (this.playerEntityId) {
      const entity = this.world.entities.get(this.playerEntityId);
      if (entity) {
        (entity.data as Record<string, unknown>).arenaBounds = bounds;
      }
    }
  }

  clearArenaBounds(): void {
    this._arenaBounds = null;
    if (this.playerEntityId) {
      const entity = this.world.entities.get(this.playerEntityId);
      if (entity) {
        (entity.data as Record<string, unknown>).arenaBounds = null;
      }
    }
  }

  /**
   * Disable or re-enable the agent's autonomous behavior loop.
   * Called by DuelOrchestrator when placing agents in the arena (disable) or
   * returning them to the overworld (re-enable), ensuring agents never try to
   * wander off to quests while a DuelCombatAI is running.
   */
  setAutonomousBehaviorEnabled(enabled: boolean): void {
    this._autonomousEnabled = enabled;
  }

  isAutonomousEnabled(): boolean {
    return this._autonomousEnabled;
  }

  async executeMove(
    target: [number, number, number],
    runMode: boolean = false,
  ): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    // Clamp movement target to arena bounds when in arena mode.
    // This prevents out-of-bounds moves at the source, avoiding the need for
    // reactive correction teleports that produce unwanted visual effects.
    if (this._arenaBounds) {
      const b = this._arenaBounds;
      const PAD = 2.0;
      target = [
        Math.min(b.maxX - PAD, Math.max(b.minX + PAD, target[0])),
        target[1],
        Math.min(b.maxZ - PAD, Math.max(b.minZ + PAD, target[2])),
      ];
    } else if (isPositionInsideCombatArena(target[0], target[2])) {
      // Not in a duel — reject moves into combat arenas to prevent
      // the agent from walking into arenas and triggering ejection loops.
      return;
    }

    if (this.requestNetworkMove(target, runMode)) {
      return;
    }

    // Legacy movement system fallback (tests/mocks)
    const movementSystem = this.world.getSystem("movement") as
      | {
          requestMovement?: (
            entityId: string,
            target: [number, number, number],
            options?: { runMode?: boolean },
          ) => void;
        }
      | undefined;
    if (movementSystem?.requestMovement) {
      movementSystem.requestMovement(this.playerEntityId, target, { runMode });
      return;
    }

    // Last-resort fallback: keep node transform and serialized data in sync.
    this.applyDirectPositionFallback(target);
  }

  async executeAttack(targetId: string): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    const targetEntity = this.world.entities.get(targetId);
    if (!targetEntity) return;

    // Guard: don't chase targets inside combat arenas when not in a duel
    if (!this._arenaBounds) {
      const targetPos = this.getEntityPosition(targetEntity);
      if (
        targetPos &&
        isPositionInsideCombatArena(targetPos[0], targetPos[2])
      ) {
        return;
      }
    }

    // Guard: abort if target is dead (race condition between tick check and attack)
    const te = targetEntity as unknown as {
      isDead?: () => boolean;
      isAlive?: () => boolean;
    };
    if (
      (typeof te.isDead === "function" && te.isDead()) ||
      (typeof te.isAlive === "function" && !te.isAlive())
    ) {
      return;
    }

    const targetType: "player" | "mob" =
      targetEntity?.type === "player" ? "player" : "mob";

    // Use the server network's walk-to-and-attack pipeline (same as real players)
    const networkSystem = this.world.getSystem("network") as
      | {
          requestServerAttack?: (
            playerId: string,
            targetId: string,
            targetType: "mob" | "player",
          ) => boolean;
        }
      | undefined;

    if (networkSystem?.requestServerAttack) {
      networkSystem.requestServerAttack(
        this.playerEntityId,
        targetId,
        targetType,
      );
    } else {
      console.warn(
        "[EmbeddedHyperscapeService] Network system requestServerAttack not available",
      );
    }
  }

  async executeGather(resourceId: string): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    // Guard: don't gather resources inside combat arenas when not in a duel
    if (!this._arenaBounds) {
      const resEntity = this.world.entities.get(resourceId);
      if (resEntity) {
        const resPos = this.getEntityPosition(resEntity);
        if (resPos && isPositionInsideCombatArena(resPos[0], resPos[2])) {
          return;
        }
      }
    }

    // Use PendingGatherManager which handles cardinal tile pathfinding,
    // anchor tile lookup, and face direction automatically.
    const networkSystem = this.world.getSystem("network") as unknown as {
      pendingGatherManager?: {
        queuePendingGather: (
          playerId: string,
          resourceId: string,
          currentTick: number,
          runMode?: boolean,
        ) => void;
      };
      tickSystem?: { getCurrentTick: () => number };
    } | null;

    if (networkSystem?.pendingGatherManager && networkSystem?.tickSystem) {
      networkSystem.pendingGatherManager.queuePendingGather(
        this.playerEntityId,
        resourceId,
        networkSystem.tickSystem.getCurrentTick(),
      );
    } else {
      const player = this.world.entities.get(this.playerEntityId) as
        | {
            position?: { x?: number; y?: number; z?: number };
            data?: { position?: unknown };
          }
        | undefined;
      const normalizedPosition = player ? this.getEntityPosition(player) : null;
      if (!normalizedPosition) {
        console.warn(
          `[EmbeddedHyperscapeService] Cannot gather ${resourceId}: player position unavailable`,
        );
        return;
      }
      const [x, y, z] = normalizedPosition;
      const playerPosition = { x, y, z };
      this.world.emit(EventType.RESOURCE_GATHER, {
        playerId: this.playerEntityId,
        resourceId,
        playerPosition,
      });
    }
  }

  async executePickup(itemId: string): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    // Emit pickup event directly to the world
    // Note: itemId here is actually the entityId of the ground item to pick up.
    this.world.emit(EventType.ITEM_PICKUP, {
      playerId: this.playerEntityId,
      entityId: itemId,
    });
  }

  async executeDrop(itemId: string, quantity: number = 1): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    this.world.emit(EventType.ITEM_DROP, {
      playerId: this.playerEntityId,
      itemId: itemId,
      quantity,
    });
  }

  async executeEquip(itemId: string): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    this.world.emit(EventType.EQUIPMENT_TRY_EQUIP, {
      playerId: this.playerEntityId,
      itemId: itemId,
    });
  }

  async executeUse(itemId: string): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    const items = this.getInventoryItems();
    const item = items.find((i) => i.itemId === itemId);

    if (item) {
      this.world.emit(EventType.INVENTORY_USE, {
        playerId: this.playerEntityId,
        itemId: itemId,
        slot: item.slot,
      });
    }
  }

  async executePrayer(prayerId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    const prayerSystem = this.world.getSystem("prayer") as
      | {
          togglePrayer?: (playerId: string, prayerId: string) => void;
        }
      | undefined;

    if (prayerSystem?.togglePrayer) {
      prayerSystem.togglePrayer(this.playerEntityId, prayerId);
      return true;
    }
    console.warn("[EmbeddedHyperscapeService] Prayer system not available");
    return false;
  }

  async executeChat(message: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
    }

    const chatSystem = this.world.getSystem("chat") as
      | {
          add?: (
            message: {
              id: string;
              from: string;
              fromId: string;
              body: string;
              text: string;
              timestamp: number;
              createdAt: string;
            },
            broadcast?: boolean,
          ) => void;
        }
      | undefined;

    if (chatSystem?.add) {
      chatSystem.add(
        {
          id: crypto.randomUUID(),
          from: this.name,
          fromId: this.playerEntityId,
          body: message,
          text: message,
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        },
        true,
      );
      return true;
    }
    console.warn("[EmbeddedHyperscapeService] Chat system not available");
    return false;
  }

  async executeStop(): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      return;
    }

    // Stop current movement
    if (!this.cancelNetworkMove()) {
      const movementSystem = this.world.getSystem("movement") as
        | {
            cancelMovement?: (entityId: string) => void;
          }
        | undefined;

      if (movementSystem?.cancelMovement) {
        movementSystem.cancelMovement(this.playerEntityId);
      }
    }

    // Cancel combat via CombatSystem (keeps internal tracking in sync)
    const combatSystem = this.world.getSystem("combat") as {
      forceEndCombat?: (entityId: string) => void;
    } | null;
    if (combatSystem?.forceEndCombat) {
      try {
        combatSystem.forceEndCombat(this.playerEntityId);
      } catch {
        // Fall through to manual cleanup
      }
    }

    // Clear any remaining combat state (including serialized fields)
    const player = this.world.entities.get(this.playerEntityId);
    if (player) {
      player.data.combatTarget = null;
      player.data.inCombat = false;
      (player.data as Record<string, unknown>).ct = null;
      (player.data as Record<string, unknown>).c = false;
      (player.data as Record<string, unknown>).attackTarget = null;
    }
  }

  async executePrayerToggle(prayerId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!prayerId || typeof prayerId !== "string" || prayerId.length === 0) {
      return false;
    }

    const prayerSystem = this.world.getSystem("prayer") as {
      togglePrayer?: (
        playerId: string,
        prayerId: string,
      ) => { success: boolean; reason?: string };
    } | null;

    if (!prayerSystem?.togglePrayer) return false;

    try {
      const result = prayerSystem.togglePrayer(this.playerEntityId, prayerId);
      return result.success;
    } catch (err) {
      console.warn(
        `[EmbeddedHyperscapeService] Prayer toggle failed for ${prayerId}:`,
        errMsg(err),
      );
      return false;
    }
  }

  private static readonly VALID_STYLES = new Set([
    "accurate",
    "aggressive",
    "defensive",
    "controlled",
    "rapid",
    "longrange",
  ]);

  async executeChangeStyle(newStyle: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    if (!EmbeddedHyperscapeService.VALID_STYLES.has(newStyle)) {
      console.warn(
        `[EmbeddedHyperscapeService] Invalid attack style: ${newStyle}`,
      );
      return false;
    }

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) return false;

    this.world.emit(EventType.ATTACK_STYLE_CHANGED, {
      playerId: this.playerEntityId,
      newStyle,
    });
    return true;
  }

  async executeHomeTeleport(): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) return false;

    if (player.data.inCombat) {
      console.warn(
        "[EmbeddedHyperscapeService] Cannot home teleport while in combat",
      );
      return false;
    }

    if (player.data.inStreamingDuel) {
      console.warn(
        "[EmbeddedHyperscapeService] Cannot home teleport during a duel",
      );
      return false;
    }

    this.world.emit(EventType.HOME_TELEPORT_REQUEST, {
      playerId: this.playerEntityId,
    });
    return true;
  }

  // =========================================================================
  // Banking
  // =========================================================================

  async executeBankOpen(bankId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    // Bank events need both EventBus (BankingSystem) and EventEmitter (InteractionSessionManager)
    this.emitDualChannel(EventType.BANK_OPEN, {
      playerId: this.playerEntityId,
      bankId,
    });
    return true;
  }

  async executeBankDeposit(
    itemId: string,
    quantity: number = 1,
  ): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!itemId) return false;

    this.emitDualChannel(EventType.BANK_DEPOSIT, {
      playerId: this.playerEntityId,
      itemId,
      quantity,
    });
    return true;
  }

  async executeBankWithdraw(
    itemId: string,
    quantity: number = 1,
  ): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!itemId) return false;

    this.emitDualChannel(EventType.BANK_WITHDRAW, {
      playerId: this.playerEntityId,
      itemId,
      quantity,
    });
    return true;
  }

  async executeBankDepositAll(): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    // Find the nearest bank — try nearby entities first, then search world entities directly
    let bankId = this.findNearbyObjectIdByKeyword("bank");

    if (!bankId) {
      // Search all world entities for the closest bank entity
      const player = this.world.entities.get(this.playerEntityId);
      if (!player) return false;
      const playerPos = this.getEntityPosition(player);
      if (!playerPos) return false;

      let bestDist = Infinity;
      for (const [id, entity] of this.world.entities.items.entries()) {
        const data = (entity as { data?: Record<string, unknown> }).data;
        if (!data) continue;
        const typeStr = String(data.type || "").toLowerCase();
        const nameStr = String(data.name || "").toLowerCase();
        if (typeStr !== "bank" && !nameStr.includes("bank")) continue;
        const pos = this.getEntityPosition(entity);
        if (!pos) continue;
        const dx = pos[0] - playerPos[0];
        const dz = pos[2] - playerPos[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < bestDist) {
          bestDist = dist;
          bankId = id;
        }
      }
      // Only use if within reasonable range
      if (!bankId || bestDist > 15) return false;
    }

    // Open the bank first (BankingSystem requires an open bank to deposit)
    this.emitDualChannel(EventType.BANK_OPEN, {
      playerId: this.playerEntityId,
      bankId,
    });

    // BANK_OPEN handler runs synchronously via EventBus, so the bank is
    // already open by the time we reach here — no delay needed.
    this.emitDualChannel(EventType.BANK_DEPOSIT_ALL, {
      playerId: this.playerEntityId,
      bankId,
    });
    return true;
  }

  // =========================================================================
  // Shopping
  // =========================================================================

  async executeStoreBuy(
    storeId: string,
    itemId: string,
    quantity: number = 1,
  ): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!storeId || !itemId) return false;

    // Agents bypass the socket-based store handler and add items directly
    // via the InventorySystem. No coin deduction (agents are NPCs).
    const inventorySystem = this.world.getSystem("inventory") as {
      addItemDirect?: (
        playerId: string,
        params: { itemId: string; quantity: number },
      ) => Promise<boolean>;
    } | null;

    if (inventorySystem?.addItemDirect) {
      const added = await inventorySystem.addItemDirect(this.playerEntityId, {
        itemId,
        quantity,
      });
      return added;
    }

    // Fallback: emit event (may not be handled)
    this.world.emit(EventType.STORE_BUY, {
      playerId: this.playerEntityId,
      storeId,
      itemId,
      quantity,
    });
    return true;
  }

  async executeStoreSell(
    storeId: string,
    itemId: string,
    quantity: number = 1,
  ): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!storeId || !itemId) return false;

    this.world.emit(EventType.STORE_SELL, {
      playerId: this.playerEntityId,
      storeId,
      itemId,
      quantity,
    });
    return true;
  }

  // =========================================================================
  // Crafting / Processing
  // =========================================================================

  async executeCook(itemId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!itemId) return false;

    // Find the inventory slot containing the raw food
    const inventory = this.getInventoryItems();
    const slot = inventory.find((s) => s.itemId === itemId);
    if (!slot) return false;

    // Find a nearby cooking station (range, fire station, or player-lit fire)
    const stationId =
      this.findNearbyObjectIdByKeyword("range") ??
      this.findNearbyObjectIdByKeyword("cooking") ??
      this.findNearbyObjectIdByKeyword("fire");

    if (stationId) {
      // Permanent stations use sourceType "range" so ProcessingSystem skips activeFires check
      const isPermanent =
        stationId.startsWith("station_") || stationId.includes("range");
      this.emitProcessingEvent(EventType.PROCESSING_COOKING_REQUEST, {
        playerId: this.playerEntityId,
        fishSlot: slot.slot,
        ...(isPermanent
          ? { rangeId: stationId, sourceType: "range" as const }
          : { fireId: stationId, sourceType: "fire" as const }),
      });
      return true;
    }

    // No station entity found — check for player-lit fires in ProcessingSystem
    const processingSystem = this.world.getSystem("processing") as {
      getPlayerFires?: (
        playerId: string,
      ) => Array<{ id: string; isActive: boolean }>;
      getActiveFires?: () => Map<
        string,
        {
          id: string;
          isActive: boolean;
          position: { x: number; y: number; z: number };
        }
      >;
    } | null;

    if (processingSystem?.getPlayerFires) {
      const myFires = processingSystem.getPlayerFires(this.playerEntityId);
      const activeFire = myFires.find((f) => f.isActive);
      if (activeFire) {
        this.emitProcessingEvent(EventType.PROCESSING_COOKING_REQUEST, {
          playerId: this.playerEntityId,
          fishSlot: slot.slot,
          fireId: activeFire.id,
          sourceType: "fire" as const,
        });
        return true;
      }
    }

    // Also check all active fires (maybe another player lit one nearby)
    if (processingSystem?.getActiveFires) {
      const playerEntity = this.world.entities.get(this.playerEntityId);
      if (playerEntity?.position) {
        const px = playerEntity.position.x;
        const pz = playerEntity.position.z;
        for (const [, fire] of processingSystem.getActiveFires()) {
          if (!fire.isActive) continue;
          const dx = px - fire.position.x;
          const dz = pz - fire.position.z;
          if (dx * dx + dz * dz < 25) {
            // within ~5 tiles
            this.emitProcessingEvent(EventType.PROCESSING_COOKING_REQUEST, {
              playerId: this.playerEntityId,
              fishSlot: slot.slot,
              fireId: fire.id,
              sourceType: "fire" as const,
            });
            return true;
          }
        }
      }
    }

    return false;
  }

  async executeSmelt(recipe: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!recipe) return false;

    const furnaceId =
      this.findNearbyObjectIdByKeyword("furnace") ?? "unknown-furnace";

    this.emitProcessingEvent(EventType.PROCESSING_SMELTING_REQUEST, {
      playerId: this.playerEntityId,
      barItemId: recipe,
      furnaceId,
      quantity: 1,
    });
    return true;
  }

  async executeSmith(recipe: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!recipe) return false;

    const anvilId =
      this.findNearbyObjectIdByKeyword("anvil") ?? "unknown-anvil";

    this.emitProcessingEvent(EventType.PROCESSING_SMITHING_REQUEST, {
      playerId: this.playerEntityId,
      recipeId: recipe,
      anvilId,
      quantity: 1,
    });
    return true;
  }

  async executeFiremake(logsItemId?: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    const inventory = this.getInventoryItems();
    const tinderboxSlot = inventory.find((i) => i.itemId === "tinderbox");
    if (!tinderboxSlot) return false;

    // Find the specified logs, or any burnable logs
    const logTypes = [
      "logs",
      "oak_logs",
      "willow_logs",
      "teak_logs",
      "maple_logs",
      "mahogany_logs",
      "yew_logs",
      "magic_logs",
    ];
    const logsSlot = logsItemId
      ? inventory.find((i) => i.itemId === logsItemId)
      : inventory.find((i) => logTypes.includes(i.itemId));
    if (!logsSlot) return false;

    this.emitProcessingEvent(EventType.PROCESSING_FIREMAKING_REQUEST, {
      playerId: this.playerEntityId,
      logsId: logsSlot.itemId,
      logsSlot: logsSlot.slot,
      tinderboxSlot: tinderboxSlot.slot,
    });
    return true;
  }

  async executeRunecraft(runeType: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    const inventory = this.getInventoryItems();
    const hasEssence = inventory.some((i) => i.itemId === "rune_essence");
    if (!hasEssence) {
      return false;
    }

    const altarId =
      this.findNearbyObjectIdByKeyword("runecrafting") ??
      this.findNearbyObjectIdByKeyword("altar");
    if (!altarId) {
      return false;
    }

    // Look up the altar entity to get the authoritative runeType (like the client handler does)
    const altarEntity = this.world.entities.get(altarId);
    const altarRuneType = altarEntity
      ? (altarEntity as unknown as { runeType?: string }).runeType
      : undefined;

    this.emitProcessingEvent(EventType.RUNECRAFTING_INTERACT, {
      playerId: this.playerEntityId,
      altarId,
      runeType: altarRuneType || runeType,
    });
    return true;
  }

  async executeCraft(recipeId: string, quantity: number = 1): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!recipeId) return false;

    this.emitDualChannel(EventType.PROCESSING_CRAFTING_REQUEST, {
      playerId: this.playerEntityId,
      recipeId,
      quantity,
    });
    return true;
  }

  async executeFletch(
    recipeId: string,
    quantity: number = 1,
  ): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!recipeId) return false;

    this.emitProcessingEvent(EventType.PROCESSING_FLETCHING_REQUEST, {
      playerId: this.playerEntityId,
      recipeId,
      quantity,
    });
    return true;
  }

  async executeTan(
    inputItemId: string,
    quantity: number = 1,
  ): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!inputItemId) return false;

    this.emitProcessingEvent(EventType.TANNING_REQUEST, {
      playerId: this.playerEntityId,
      inputItemId,
      quantity,
    });
    return true;
  }

  // =========================================================================
  // Quest / NPC Interaction
  // =========================================================================

  async executeNpcInteract(
    npcId: string,
    interaction: string = "talk",
  ): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!npcId) return false;

    this.world.emit(EventType.NPC_INTERACTION, {
      playerId: this.playerEntityId,
      npcId,
      interaction,
    });
    return true;
  }

  async executeQuestAccept(questId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!questId) return false;

    // Look up which NPC starts this quest
    const questSystem = this.world.getSystem("quest") as {
      getQuestDefinition?: (id: string) => { startNpc?: string } | undefined;
    } | null;
    const questDef = questSystem?.getQuestDefinition?.(questId);
    const startNpcId = questDef?.startNpc;

    if (startNpcId) {
      // Drive through the NPC dialogue to accept the quest naturally.
      // 1. Trigger NPC interaction to start dialogue
      const npcEntity = this.findNpcEntityById(startNpcId);
      if (npcEntity) {
        this.world.emit(EventType.NPC_INTERACTION, {
          playerId: this.playerEntityId,
          npcId: startNpcId,
          npc: {
            id: startNpcId,
            name: npcEntity.name,
            type: "npc",
          },
          npcEntityId: npcEntity.entityId,
          interaction: "talk",
        });

        // 2. Auto-select dialogue responses that lead to quest acceptance.
        //    The dialogue system is synchronous on the server — each emit
        //    is processed before the next line runs.
        this.driveDialogueToQuestAccept(startNpcId, questId);
        return true;
      }
    }

    // Fallback: direct accept if NPC not found
    this.world.emit(EventType.QUEST_START_ACCEPTED, {
      playerId: this.playerEntityId,
      questId,
    });
    return true;
  }

  /**
   * Find an NPC world entity by its manifest npcId (e.g. "captain_rowan").
   */
  private findNpcEntityById(
    npcId: string,
  ): { entityId: string; name: string } | null {
    for (const [id, entity] of this.world.entities.items.entries()) {
      const data = entity.data as Record<string, unknown>;
      const entityNpcId =
        (data.npcId as string) || (data.customId as string) || "";
      if (
        entityNpcId === npcId ||
        (data.npcType &&
          ((data.name as string) || "")
            .toLowerCase()
            .includes(npcId.replace(/_/g, " ").toLowerCase()))
      ) {
        return { entityId: id, name: (data.name as string) || npcId };
      }
    }
    return null;
  }

  /**
   * Automatically drive through a dialogue tree to reach and select the
   * response that triggers `startQuest:<questId>`.
   *
   * Walks through the dialogue by selecting responses that lead toward the
   * quest acceptance effect. Handles multi-step dialogue trees (greeting →
   * quest_offer → quest_accepted).
   */
  private driveDialogueToQuestAccept(npcId: string, questId: string): void {
    if (!this.playerEntityId) return;

    const startQuestEffect = `startQuest:${questId}`;
    const completeQuestEffect = `completeQuest:${questId}`;
    const targetEffect = startQuestEffect;

    // Walk through up to 10 dialogue steps to avoid infinite loops.
    // Server-side events are synchronous — no delays needed.
    for (let step = 0; step < 10; step++) {
      const dialogueSystem = this.world.getSystem("dialogue") as {
        activeDialogues?: Map<
          string,
          {
            npcId: string;
            currentNodeId: string;
            isTerminal?: boolean;
            pendingEffect?: string;
            dialogueTree: {
              nodes: Array<{
                id: string;
                text: string;
                effect?: string;
                responses?: Array<{
                  text: string;
                  nextNodeId: string;
                  effect?: string;
                }>;
              }>;
            };
          }
        >;
      } | null;

      if (!dialogueSystem?.activeDialogues) break;

      const dialogueState = dialogueSystem.activeDialogues.get(
        this.playerEntityId,
      );
      if (!dialogueState || dialogueState.npcId !== npcId) break;

      const currentNode = dialogueState.dialogueTree.nodes.find(
        (n) => n.id === dialogueState.currentNodeId,
      );
      if (!currentNode) break;

      // Terminal node — send continue to execute pending effect and end dialogue
      if (!currentNode.responses || currentNode.responses.length === 0) {
        this.world.emit(EventType.DIALOGUE_CONTINUE, {
          playerId: this.playerEntityId,
          npcId,
        });
        break;
      }

      // Find the response that has the quest effect directly
      let bestResponseIndex = currentNode.responses.findIndex(
        (r) => r.effect === targetEffect || r.effect === completeQuestEffect,
      );

      // If no direct quest effect, pick the first response that isn't a
      // farewell/decline (heuristic: avoid responses containing "later",
      // "no", "goodbye", "farewell")
      if (bestResponseIndex < 0) {
        bestResponseIndex = currentNode.responses.findIndex((r) => {
          const text = r.text.toLowerCase();
          return (
            !text.includes("later") &&
            !text.includes("no ") &&
            !text.includes("goodbye") &&
            !text.includes("farewell") &&
            !text.includes("maybe")
          );
        });
      }

      // Last resort: pick the first response
      if (bestResponseIndex < 0) {
        bestResponseIndex = 0;
      }

      // Select this response
      this.world.emit(EventType.DIALOGUE_RESPONSE, {
        playerId: this.playerEntityId,
        npcId,
        responseIndex: bestResponseIndex,
      });
    }

    // If the quest still hasn't started (QUEST_START_CONFIRM screen), auto-accept
    this.world.emit(EventType.QUEST_START_ACCEPTED, {
      playerId: this.playerEntityId,
      questId,
    });
  }

  async executeQuestComplete(questId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!questId) return false;

    const questSystem = this.world.getSystem("quest") as {
      getQuestDefinition?: (id: string) => { startNpc?: string } | undefined;
      completeQuest?: (playerId: string, questId: string) => Promise<boolean>;
    } | null;

    // Try dialogue-driven completion first (NPC has completeQuest effect in dialogue)
    const questDef = questSystem?.getQuestDefinition?.(questId);
    const startNpcId = questDef?.startNpc;

    if (startNpcId) {
      const npcEntity = this.findNpcEntityById(startNpcId);
      if (npcEntity) {
        this.world.emit(EventType.NPC_INTERACTION, {
          playerId: this.playerEntityId,
          npcId: startNpcId,
          npc: {
            id: startNpcId,
            name: npcEntity.name,
            type: "npc",
          },
          npcEntityId: npcEntity.entityId,
          interaction: "talk",
        });

        // The DialogueSystem will use quest overrides to go to "quest_complete"
        // node which has a `completeQuest:quest_id` effect on the terminal node
        this.driveDialogueToQuestAccept(startNpcId, questId);

        // Check if dialogue drove the completion
        const postState = this.getQuestState();
        if (!postState.some((q) => q.questId === questId)) {
          return true;
        }
      }
    }

    // Fallback: direct QuestSystem completion
    if (!questSystem?.completeQuest) return false;
    return await questSystem.completeQuest(this.playerEntityId, questId);
  }

  /**
   * Query active quest state directly from QuestSystem.
   * Returns current stage, progress, and objective details for each active quest.
   */
  getQuestState(): AgentQuestProgress[] {
    if (!this.playerEntityId || !this.isActive) return [];

    const questSystem = this.world.getSystem("quest") as {
      getActiveQuests?: (playerId: string) => Array<{
        questId: string;
        status: string;
        currentStage: string;
        stageProgress: Record<string, number>;
      }>;
      getQuestDefinition?: (questId: string) =>
        | {
            id: string;
            name: string;
            description: string;
            startNpc: string;
            stages: Array<{
              id: string;
              type: string;
              description: string;
              target?: string;
              count?: number;
              npcId?: string;
            }>;
          }
        | undefined;
    } | null;

    if (!questSystem?.getActiveQuests || !questSystem.getQuestDefinition) {
      return [];
    }

    const activeQuests = questSystem.getActiveQuests(this.playerEntityId);

    // If QuestSystem returned empty, it may not have loaded this agent's state.
    // Re-emit PLAYER_REGISTERED once so the async DB load runs; by the next
    // behavior tick (8s later) the data will be available.
    if (activeQuests.length === 0 && !this._questStateBootstrapEmitted) {
      this._questStateBootstrapEmitted = true;
      this.emitDualChannel("player:registered", {
        playerId: this.playerEntityId,
      });
    }

    return activeQuests.map((progress) => {
      const definition = questSystem.getQuestDefinition!(progress.questId);
      const currentStage = definition?.stages.find(
        (s) => s.id === progress.currentStage,
      );
      return {
        questId: progress.questId,
        name: definition?.name || progress.questId,
        status: progress.status,
        currentStage: progress.currentStage,
        stageDescription: currentStage?.description || "",
        stageProgress: progress.stageProgress,
        stageType: (currentStage?.type ||
          "unknown") as AgentQuestProgress["stageType"],
        stageTarget: currentStage?.target,
        stageCount: currentStage?.count,
        startNpc: definition?.startNpc || "",
      };
    });
  }

  /**
   * Query all quest definitions with their status for this agent.
   * Used to discover which quests are available to start.
   */
  getAvailableQuests(): AgentQuestInfo[] {
    if (!this.playerEntityId || !this.isActive) return [];

    const questSystem = this.world.getSystem("quest") as {
      getAllQuestDefinitions?: () => Array<{
        id: string;
        name: string;
        description: string;
        difficulty: string;
        startNpc: string;
        stages: Array<{
          id: string;
          type: string;
          description: string;
          target?: string;
          count?: number;
        }>;
        onStart?: {
          items?: Array<{ itemId: string; quantity: number }>;
        };
        rewards: {
          questPoints: number;
          items: Array<{ itemId: string; quantity: number }>;
          xp: Record<string, number>;
        };
      }>;
      getQuestStatus?: (playerId: string, questId: string) => string;
    } | null;

    if (!questSystem?.getAllQuestDefinitions || !questSystem.getQuestStatus) {
      return [];
    }

    const allDefs = questSystem.getAllQuestDefinitions();
    return allDefs.map((def) => ({
      questId: def.id,
      name: def.name,
      description: def.description,
      difficulty: def.difficulty,
      status: questSystem.getQuestStatus!(this.playerEntityId!, def.id),
      startNpc: def.startNpc,
      onStartItems: def.onStart?.items || [],
      rewardItems: def.rewards.items,
      stages: def.stages.map((s) => ({
        id: s.id,
        type: s.type,
        description: s.description,
        target: s.target,
        count: s.count,
      })),
    }));
  }

  /**
   * Get the agent's actual inventory from InventorySystem (not entity data).
   * Entity data.inventory is often empty — the real inventory lives in
   * InventorySystem's playerInventories Map.
   * Uses tick-based caching to avoid per-tick allocations.
   */
  getInventoryItems(): Array<{
    slot: number;
    itemId: string;
    quantity: number;
  }> {
    if (!this.playerEntityId || !this.isActive) return [];

    // Return cached result if same tick
    const currentTick = this.world.currentTick ?? 0;
    if (currentTick === this._inventoryCacheTick) {
      return this._inventoryCache;
    }

    const inventorySystem = this.world.getSystem("inventory") as {
      getInventory?: (playerId: string) =>
        | {
            items: Array<{
              slot: number;
              itemId: string;
              quantity: number;
              item: { id: string; name: string; type: string };
            }>;
          }
        | undefined;
    } | null;

    if (!inventorySystem?.getInventory) return [];

    const inv = inventorySystem.getInventory(this.playerEntityId);
    if (!inv) return [];

    // Reuse existing cache array, updating in-place where possible
    const items = inv.items;
    this._inventoryCache.length = items.length;
    for (let i = 0; i < items.length; i++) {
      const src = items[i];
      let dst = this._inventoryCache[i];
      if (!dst) {
        dst = { slot: 0, itemId: "", quantity: 0 };
        this._inventoryCache[i] = dst;
      }
      dst.slot = src.slot;
      dst.itemId = src.itemId;
      dst.quantity = src.quantity;
    }

    this._inventoryCacheTick = currentTick;
    return this._inventoryCache;
  }

  /** Slot names for equipment - defined once to avoid per-call array creation */
  private static readonly EQUIPMENT_SLOT_NAMES = [
    "weapon",
    "shield",
    "helmet",
    "body",
    "legs",
    "boots",
    "gloves",
    "cape",
    "amulet",
    "ring",
    "arrows",
  ] as const;

  /**
   * Get the agent's currently equipped items from EquipmentSystem.
   * Uses tick-based caching to avoid per-tick allocations.
   */
  getEquippedItems(): Record<string, string | null> {
    if (!this.playerEntityId || !this.isActive) return {};

    // Return cached result if same tick
    const currentTick = this.world.currentTick ?? 0;
    if (currentTick === this._equipmentCacheTick) {
      return this._equipmentCache;
    }

    const equipmentSystem = this.world.getSystem("equipment") as {
      getPlayerEquipment?: (
        playerId: string,
      ) => Record<string, unknown> | undefined;
    } | null;

    if (!equipmentSystem?.getPlayerEquipment) return {};

    const eq = equipmentSystem.getPlayerEquipment(this.playerEntityId);
    if (!eq) return {};

    // Update cached object in-place
    for (const slot of EmbeddedHyperscapeService.EQUIPMENT_SLOT_NAMES) {
      const slotData = eq[slot] as
        | { itemId?: string | number | null }
        | null
        | undefined;
      if (slotData?.itemId) {
        this._equipmentCache[slot] = String(slotData.itemId);
      } else {
        this._equipmentCache[slot] = null;
      }
    }

    this._equipmentCacheTick = currentTick;
    return this._equipmentCache;
  }

  /**
   * Get the equipped weapon's attack speed in game ticks.
   * Returns the weapon's attackSpeed from item data, or the default (4 ticks).
   */
  getWeaponAttackSpeed(): number {
    const DEFAULT_SPEED = 4;
    if (!this.playerEntityId || !this.isActive) return DEFAULT_SPEED;

    const equipmentSystem = this.world.getSystem("equipment") as {
      getPlayerEquipment?: (
        playerId: string,
      ) => { weapon?: { item?: { attackSpeed?: number; id?: string } } } | null;
    } | null;

    if (!equipmentSystem?.getPlayerEquipment) return DEFAULT_SPEED;

    const eq = equipmentSystem.getPlayerEquipment(this.playerEntityId);
    if (!eq?.weapon?.item) return DEFAULT_SPEED;

    const weapon = eq.weapon.item;
    if (weapon.attackSpeed && weapon.attackSpeed > 0) {
      return weapon.attackSpeed;
    }

    // Fallback: look up from item database
    if (weapon.id) {
      const itemData = getItem(weapon.id);
      if (itemData?.attackSpeed && itemData.attackSpeed > 0) {
        return itemData.attackSpeed;
      }
    }

    return DEFAULT_SPEED;
  }

  /**
   * Get positions of all NPC entities in the world, regardless of distance.
   * Used for quest navigation - agents need to find specific quest NPCs.
   */
  getAllNPCPositions(): Array<{
    id: string;
    name: string;
    npcId: string;
    position: [number, number, number];
  }> {
    if (!this.isActive) return [];

    // NPCs are stationary — cache for 10 seconds to avoid full entity scan per agent
    const now = Date.now();
    if (
      this._npcPositionsCache.length > 0 &&
      now - this._npcPositionsCacheTime <
        EmbeddedHyperscapeService.NPC_CACHE_TTL_MS
    ) {
      return this._npcPositionsCache;
    }

    // Use shared entity snapshot (scanned once per second across ALL agent instances)
    const snapshot = getSharedEntitySnapshot(
      this.world as unknown as Parameters<typeof getSharedEntitySnapshot>[0],
      (e) =>
        this.getEntityPosition(
          e as Parameters<typeof this.getEntityPosition>[0],
        ),
    );

    const npcs: Array<{
      id: string;
      name: string;
      npcId: string;
      position: [number, number, number];
    }> = [];

    for (const entry of snapshot) {
      if (!entry.data.npcType && entry.data.type !== "npc") continue;

      const npcId =
        (entry.data.npcId as string) ||
        (entry.data.customId as string) ||
        entry.id;

      npcs.push({
        id: entry.id,
        name: (entry.data.name as string) || npcId,
        npcId,
        position: entry.position,
      });
    }

    this._npcPositionsCache = npcs;
    this._npcPositionsCacheTime = now;
    return npcs;
  }

  // =========================================================================
  // World Map Data (for agent navigation)
  // =========================================================================

  /** Cached world map — built once since map data doesn't change at runtime */
  private _worldMapCache: EmbeddedWorldMapData | null = null;

  /**
   * Get world map data including towns, POIs, resources, stations, and NPCs.
   * Built from ALL_WORLD_AREAS manifest + world systems (TownSystem, POISystem).
   * Matches the shape returned by HyperscapeService.getWorldMap() on the client.
   */
  getWorldMap(): EmbeddedWorldMapData | undefined {
    if (this._worldMapCache) return this._worldMapCache;

    const result: EmbeddedWorldMapData = {
      towns: [],
      pois: [],
      resources: [],
      stations: [],
      npcs: [],
    };

    try {
      // Get towns from TownSystem
      const townSystem = this.world.getSystem("towns") as
        | {
            getTowns?: () => Array<{
              id: string;
              name: string;
              position: { x: number; y: number; z: number };
              size: string;
              biome: string;
              buildings: Array<{ type: string }>;
            }>;
          }
        | undefined;

      if (townSystem?.getTowns) {
        for (const t of townSystem.getTowns()) {
          result.towns.push({
            id: t.id,
            name: t.name,
            position: { x: t.position.x, y: t.position.y, z: t.position.z },
            size: t.size,
            biome: t.biome,
            buildings: t.buildings.map((b) => ({ type: b.type })),
          });
        }
      }

      // Get POIs from POISystem
      const poiSystem = this.world.getSystem("pois") as
        | {
            getPOIs?: () => Array<{
              id: string;
              name: string;
              category: string;
              position: { x: number; y: number; z: number };
              biome: string;
            }>;
          }
        | undefined;

      if (poiSystem?.getPOIs) {
        for (const p of poiSystem.getPOIs()) {
          result.pois.push({
            id: p.id,
            name: p.name,
            category: p.category,
            position: { x: p.position.x, y: p.position.y, z: p.position.z },
            biome: p.biome,
          });
        }
      }

      // Get resources, stations, and NPCs from ALL_WORLD_AREAS manifest
      for (const area of Object.values(ALL_WORLD_AREAS)) {
        for (const resource of area.resources) {
          result.resources.push({
            type: resource.type,
            resourceId: resource.resourceId,
            position: {
              x: resource.position.x,
              y: resource.position.y,
              z: resource.position.z,
            },
            areaId: area.id,
          });
        }

        if (area.stations) {
          for (const station of area.stations) {
            result.stations.push({
              id: station.id,
              type: station.type,
              position: {
                x: station.position.x,
                y: station.position.y,
                z: station.position.z,
              },
              areaId: area.id,
            });
          }
        }

        for (const npc of area.npcs) {
          result.npcs.push({
            id: npc.id,
            type: npc.type,
            name: npc.name,
            position: {
              x: npc.position.x,
              y: npc.position.y,
              z: npc.position.z,
            },
            areaId: area.id,
          });
        }
      }
    } catch {
      // Graceful fallback — map data is optional
    }

    this._worldMapCache = result;
    return result;
  }

  /**
   * Compact world-map lines for dashboard LLM prompts (chat + character vision).
   * Uses player position when spawned to sort nearest towns/POIs/resources.
   */
  formatMapAwarenessForLlm(): string {
    const map = this.getWorldMap();
    if (!map) {
      return "(World map summary unavailable.)";
    }
    const total =
      map.towns.length +
      map.pois.length +
      map.resources.length +
      map.stations.length +
      map.npcs.length;
    if (total === 0) {
      return "(No static map entries loaded.)";
    }

    const pos = this.getGameState()?.position;
    const distSq = (
      a: [number, number, number],
      b: { x: number; y: number; z: number },
    ): number => {
      const dx = a[0] - b.x;
      const dy = a[1] - b.y;
      const dz = a[2] - b.z;
      return dx * dx + dy * dy + dz * dz;
    };

    const lines: string[] = [];

    if (pos) {
      const nearestTowns = map.towns
        .map((t) => ({ t, d: distSq(pos, t.position) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 6);
      if (nearestTowns.length > 0) {
        lines.push(
          `Nearest towns: ${nearestTowns
            .map(
              ({ t, d }) =>
                `${t.name} (~${Math.sqrt(d).toFixed(0)}m, ${t.biome})`,
            )
            .join("; ")}`,
        );
      }

      const nearestPois = map.pois
        .map((p) => ({ p, d: distSq(pos, p.position) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 5);
      if (nearestPois.length > 0) {
        lines.push(
          `Nearest POIs: ${nearestPois
            .map(
              ({ p, d }) =>
                `${p.name} [${p.category}] (~${Math.sqrt(d).toFixed(0)}m)`,
            )
            .join("; ")}`,
        );
      }

      const nearestRes = map.resources
        .map((r) => ({ r, d: distSq(pos, r.position) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 5);
      if (nearestRes.length > 0) {
        lines.push(
          `Nearest resource nodes: ${nearestRes
            .map(
              ({ r, d }) =>
                `${r.type}/${r.resourceId} (~${Math.sqrt(d).toFixed(0)}m, ${r.areaId})`,
            )
            .join("; ")}`,
        );
      }

      const nearestSt = map.stations
        .map((s) => ({ s, d: distSq(pos, s.position) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 4);
      if (nearestSt.length > 0) {
        lines.push(
          `Nearest stations: ${nearestSt
            .map(
              ({ s, d }) =>
                `${s.id} [${s.type}] (~${Math.sqrt(d).toFixed(0)}m)`,
            )
            .join("; ")}`,
        );
      }
    } else {
      if (map.towns.length > 0) {
        lines.push(
          `Towns (sample): ${map.towns
            .slice(0, 8)
            .map((t) => `${t.name} (${t.biome})`)
            .join(", ")}`,
        );
      }
      if (map.pois.length > 0) {
        lines.push(
          `POIs (sample): ${map.pois
            .slice(0, 6)
            .map((p) => `${p.name} [${p.category}]`)
            .join(", ")}`,
        );
      }
    }

    lines.push(
      `World map counts: ${map.towns.length} towns, ${map.pois.length} POIs, ${map.resources.length} resources, ${map.stations.length} stations, ${map.npcs.length} manifest NPCs.`,
    );

    return lines.join("\n");
  }

  // =========================================================================
  // Combat Advanced
  // =========================================================================

  async executeUnequip(slot: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!slot) return false;

    this.world.emit(EventType.EQUIPMENT_UNEQUIP, {
      playerId: this.playerEntityId,
      slot,
    });
    return true;
  }

  async executeSetAutoRetaliate(enabled: boolean): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) return false;

    player.data.autoRetaliate = enabled;
    return true;
  }

  // =========================================================================
  // Prayer Advanced
  // =========================================================================

  async executePrayerDeactivateAll(): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    const prayerSystem = this.world.getSystem("prayer") as {
      deactivateAll?: (playerId: string) => void;
    } | null;

    if (prayerSystem?.deactivateAll) {
      prayerSystem.deactivateAll(this.playerEntityId);
      return true;
    }
    return false;
  }

  // =========================================================================
  // Trading
  // =========================================================================

  async executeTradeRequest(targetPlayerId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!targetPlayerId) return false;

    this.world.emit("trade:request", {
      playerId: this.playerEntityId,
      targetPlayerId,
    });
    return true;
  }

  // =========================================================================
  // Utility
  // =========================================================================

  async executeFollow(targetEntityId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!targetEntityId) return false;

    const target = this.world.entities.get(targetEntityId);
    if (!target) return false;

    const targetPos = this.getEntityPosition(target);
    if (!targetPos) return false;

    await this.executeMove(targetPos, true);
    return true;
  }

  async executeRespawn(): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    this.world.emit("player:respawn:request", {
      playerId: this.playerEntityId,
    });
    return true;
  }

  isSpawned(): boolean {
    return this.isActive && this.playerEntityId !== null;
  }

  getPlayerId(): string | null {
    return this.playerEntityId;
  }

  onGameEvent(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  offGameEvent(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Normalize position to [x, y, z] array format
   */
  private normalizePosition(pos: unknown): [number, number, number] | null {
    if (Array.isArray(pos) && pos.length >= 3) {
      return [pos[0], pos[1], pos[2]];
    }
    if (pos && typeof pos === "object" && "x" in pos) {
      const objPos = pos as { x: number; y?: number; z?: number };
      return [objPos.x, objPos.y ?? 0, objPos.z ?? 0];
    }
    return null;
  }

  /**
   * Prefer authoritative entity transform, then fall back to serialized data.
   */
  private getEntityPosition(entity: {
    position?: { x?: number; y?: number; z?: number };
    data?: { position?: unknown };
  }): [number, number, number] | null {
    const x = entity.position?.x;
    const y = entity.position?.y;
    const z = entity.position?.z;
    if (
      typeof x === "number" &&
      Number.isFinite(x) &&
      typeof y === "number" &&
      Number.isFinite(y) &&
      typeof z === "number" &&
      Number.isFinite(z)
    ) {
      return [x, y, z];
    }

    return this.normalizePosition(entity.data?.position);
  }

  /**
   * Use server tile movement pipeline so embedded agents move like real players.
   */
  private requestNetworkMove(
    target: [number, number, number],
    runMode: boolean,
  ): boolean {
    if (!this.playerEntityId) {
      return false;
    }

    const networkSystem = this.world.getSystem("network") as
      | {
          requestServerMove?: (
            playerId: string,
            target: [number, number, number],
            options?: { runMode?: boolean },
          ) => boolean;
        }
      | undefined;

    if (!networkSystem?.requestServerMove) {
      return false;
    }

    return (
      networkSystem.requestServerMove(this.playerEntityId, target, {
        runMode,
      }) !== false
    );
  }

  private cancelNetworkMove(): boolean {
    if (!this.playerEntityId) {
      return false;
    }

    const networkSystem = this.world.getSystem("network") as
      | {
          cancelServerMove?: (playerId: string) => boolean;
        }
      | undefined;

    if (!networkSystem?.cancelServerMove) {
      return false;
    }

    return networkSystem.cancelServerMove(this.playerEntityId) !== false;
  }

  /**
   * Fallback movement path when neither network nor movement systems are available.
   */
  private applyDirectPositionFallback(target: [number, number, number]): void {
    if (!this.playerEntityId) {
      return;
    }

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) {
      return;
    }

    const groundedTarget = this.groundSpawnPosition(target);
    const [x, y, z] = groundedTarget;

    // Keep authoritative transform and serializable state aligned.
    if (player.position && typeof player.position.set === "function") {
      player.position.set(x, y, z);
    }
    (player.data as Record<string, unknown>).position = [x, y, z];

    this.world.emit(EventType.ENTITY_MODIFIED, {
      id: this.playerEntityId,
      changes: { position: [x, y, z] },
    });
  }

  /**
   * Categorize an entity by its data
   */
  private categorizeEntity(
    data: Record<string, unknown>,
  ): "player" | "mob" | "npc" | "item" | "resource" | "object" {
    if (data.type === "player") return "player";
    if (data.mobType || data.type === "mob") return "mob";
    if (data.npcType || data.type === "npc") return "npc";
    if (data.itemId || data.type === "item" || data.isItem) return "item";
    if (data.resourceType || data.type === "resource") return "resource";
    const typeStr = String(data.type || "").toLowerCase();
    if (
      typeStr === "tree" ||
      typeStr === "rock" ||
      typeStr === "ore" ||
      typeStr === "fishing_spot" ||
      typeStr === "mining_rock"
    ) {
      return "resource";
    }
    return "object";
  }

  /**
   * Ground spawn position directly to terrain height so agents do not
   * spawn hovering above or clipping below terrain.
   */
  private shouldUseStreamingSpawnPosition(): boolean {
    return (
      this.characterId.startsWith("agent-") &&
      process.env.STREAMING_DUEL_ENABLED !== "false"
    );
  }

  private getStreamingAgentSpawnPosition(): [number, number, number] {
    const lobby = getDuelArenaConfig().lobbySpawnPoint;

    // Stable deterministic spread around the lobby to prevent overlapping spawns.
    let hash = 0;
    for (let i = 0; i < this.characterId.length; i++) {
      hash = (hash * 31 + this.characterId.charCodeAt(i)) >>> 0;
    }

    const angle = ((hash % 360) * Math.PI) / 180;
    const radius = 6 + (hash % 4); // 6-9m ring around lobby center

    return [
      lobby.x + Math.cos(angle) * radius,
      lobby.y,
      lobby.z + Math.sin(angle) * radius,
    ];
  }

  private groundSpawnPosition(
    position: [number, number, number],
  ): [number, number, number] {
    const terrain = this.world.getSystem("terrain") as
      | {
          getHeightAt?: (x: number, z: number) => number;
        }
      | undefined;

    const terrainY = terrain?.getHeightAt?.(position[0], position[2]);
    if (typeof terrainY !== "number" || !Number.isFinite(terrainY)) {
      return position;
    }

    return [position[0], terrainY + 0.1, position[2]];
  }
}
