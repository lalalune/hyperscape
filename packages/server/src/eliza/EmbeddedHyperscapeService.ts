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

// Distance threshold for "nearby" entities (in world units)
const NEARBY_DISTANCE = 50;
/** Pre-computed squared distance for comparison without Math.sqrt */
const NEARBY_DISTANCE_SQ = NEARBY_DISTANCE * NEARBY_DISTANCE;
/** How many ticks a cached getNearbyEntities result is valid */
const NEARBY_CACHE_TTL_TICKS = 2;

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
  /** Reusable buffer for getNearbyEntities to reduce per-tick allocations. */
  private nearbyBuffer: NearbyEntityData[] = [];

  /** Cached getNearbyEntities result to avoid full world scan every tick */
  private _nearbyCache: NearbyEntityData[] = [];
  private _nearbyCacheTick = -1;

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

  /**
   * Initialize the service and spawn the agent's player entity
   */
  async initialize(): Promise<void> {
    console.log(
      `[EmbeddedHyperscapeService] Initializing agent ${this.name} (${this.characterId})`,
    );
    const traceEnabled = process.env.EMBEDDED_AGENT_INIT_TRACE === "true";
    const startTime = Date.now();
    const trace = (step: string) => {
      if (!traceEnabled) return;
      const elapsed = Date.now() - startTime;
      console.log(
        `[EmbeddedHyperscapeService][Trace] ${this.characterId} ${step} (+${elapsed}ms)`,
      );
    };

    // Check if player entity already exists
    const existingEntity = this.world.entities.get(this.characterId);
    if (existingEntity) {
      console.log(
        `[EmbeddedHyperscapeService] Player entity already exists: ${this.characterId}`,
      );
      this.playerEntityId = this.characterId;
      this.isActive = true;
      this.subscribeToWorldEvents();
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

    // Spawn the player entity
    console.log(
      `[EmbeddedHyperscapeService] Spawning agent at position [${position.join(", ")}]`,
    );

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

    console.log(
      `[EmbeddedHyperscapeService] ✅ Agent ${this.name} spawned successfully`,
    );

    // Subscribe to world events
    this.subscribeToWorldEvents();
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
    console.log(`[EmbeddedHyperscapeService] Stopping agent ${this.name}`);

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

    console.log(`[EmbeddedHyperscapeService] ✅ Agent ${this.name} stopped`);
  }

  // ============================================================================
  // IEmbeddedHyperscapeService Implementation
  // ============================================================================

  getWorld(): World {
    return this.world;
  }

  getGameState(): EmbeddedGameState | null {
    if (!this.playerEntityId || !this.isActive) {
      return null;
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
    const equipment: Record<string, { itemId: string }> = {};
    for (const [slot, itemId] of Object.entries(equippedRaw)) {
      if (itemId) equipment[slot] = { itemId };
    }

    return {
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
   * Send a chat message from this agent
   * Message will be broadcast to all clients and appear as overhead bubble
   */
  async sendChatMessage(text: string): Promise<void> {
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
  }

  getNearbyEntities(): NearbyEntityData[] {
    if (!this.playerEntityId || !this.isActive) {
      return [];
    }

    // Return cached result if still fresh (avoids full world scan every tick)
    const currentTick = this.world.currentTick ?? 0;
    if (
      currentTick - this._nearbyCacheTick < NEARBY_CACHE_TTL_TICKS &&
      this._nearbyCacheTick >= 0
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

    const nearby = this.nearbyBuffer;
    nearby.length = 0;

    // Iterate through all entities — use distance-squared to avoid Math.sqrt
    for (const [id, entity] of this.world.entities.items.entries()) {
      if (id === this.playerEntityId) continue; // Skip self

      const entityData = entity.data as Record<string, unknown>;
      const entityPos = this.getEntityPosition(entity);
      if (!entityPos) continue;

      // Distance-squared comparison (avoids expensive Math.sqrt per entity)
      const dx = entityPos[0] - playerPos[0];
      const dy = entityPos[1] - playerPos[1];
      const dz = entityPos[2] - playerPos[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > NEARBY_DISTANCE_SQ) continue;

      // Only compute sqrt for entities that pass the filter
      const distance = Math.sqrt(distSq);

      // Determine entity type
      const entityType = this.categorizeEntity(entityData);

      // Skip dead mobs — prevents agents from attacking corpses
      if (entityType === "mob") {
        const ent = entity as unknown as {
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

      nearby.push({
        id,
        name: (entityData.name as string) || id,
        type: entityType,
        position: entityPos,
        distance,
        health: entityData.health as number | undefined,
        maxHealth: entityData.maxHealth as number | undefined,
        level: entityData.level as number | undefined,
        mobType: entityData.mobType as string | undefined,
        itemId: entityData.itemId as string | undefined,
        resourceType: entityData.resourceType as string | undefined,
        equippedWeapon,
      });
    }

    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);

    // Cache a snapshot — callers must not see mutations from the next scan
    this._nearbyCache = nearby.slice();
    this._nearbyCacheTick = currentTick;

    return this._nearbyCache;
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

  async executeMove(
    target: [number, number, number],
    runMode: boolean = false,
  ): Promise<void> {
    if (!this.playerEntityId || !this.isActive) {
      throw new Error("Agent not spawned");
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

  async executePrayer(prayerId: string): Promise<void> {
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
    } else {
      console.warn("[EmbeddedHyperscapeService] Prayer system not available");
    }
  }

  async executeChat(message: string): Promise<void> {
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
    } else {
      console.warn("[EmbeddedHyperscapeService] Chat system not available");
    }
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

    this.world.emit(EventType.BANK_OPEN, {
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

    this.world.emit(EventType.BANK_DEPOSIT, {
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

    this.world.emit(EventType.BANK_WITHDRAW, {
      playerId: this.playerEntityId,
      itemId,
      quantity,
    });
    return true;
  }

  async executeBankDepositAll(): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    this.world.emit(EventType.BANK_DEPOSIT_ALL, {
      playerId: this.playerEntityId,
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

    this.world.emit(EventType.COOKING_REQUEST, {
      playerId: this.playerEntityId,
      itemId,
    });
    return true;
  }

  async executeSmelt(recipe: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!recipe) return false;

    const furnaceId =
      this.findNearbyObjectIdByKeyword("furnace") ?? "unknown-furnace";

    this.world.emit(EventType.SMELTING_REQUEST, {
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

    this.world.emit(EventType.SMITHING_REQUEST, {
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

    this.world.emit(EventType.PROCESSING_FIREMAKING_REQUEST, {
      playerId: this.playerEntityId,
      logsId: logsSlot.itemId,
      logsSlot: logsSlot.slot,
      tinderboxSlot: tinderboxSlot.slot,
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
   */
  getInventoryItems(): Array<{
    slot: number;
    itemId: string;
    quantity: number;
  }> {
    if (!this.playerEntityId || !this.isActive) return [];

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

    return inv.items.map((i) => ({
      slot: i.slot,
      itemId: i.itemId,
      quantity: i.quantity,
    }));
  }

  /**
   * Get the agent's currently equipped items from EquipmentSystem.
   */
  getEquippedItems(): Record<string, string | null> {
    if (!this.playerEntityId || !this.isActive) return {};

    const equipmentSystem = this.world.getSystem("equipment") as {
      getPlayerEquipment?: (
        playerId: string,
      ) => Record<string, unknown> | undefined;
    } | null;

    if (!equipmentSystem?.getPlayerEquipment) return {};

    const eq = equipmentSystem.getPlayerEquipment(this.playerEntityId);
    if (!eq) return {};

    const result: Record<string, string | null> = {};
    const slotNames = [
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
    ];
    for (const slot of slotNames) {
      const slotData = eq[slot] as
        | { itemId?: string | number | null }
        | null
        | undefined;
      if (slotData?.itemId) {
        result[slot] = String(slotData.itemId);
      } else {
        result[slot] = null;
      }
    }
    return result;
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

    const npcs: Array<{
      id: string;
      name: string;
      npcId: string;
      position: [number, number, number];
    }> = [];

    for (const [id, entity] of this.world.entities.items.entries()) {
      const entityData = entity.data as Record<string, unknown>;
      if (!entityData.npcType && entityData.type !== "npc") continue;

      const pos = this.getEntityPosition(entity);
      if (!pos) continue;

      const npcId =
        (entityData.npcId as string) || (entityData.customId as string) || id;

      npcs.push({
        id,
        name: (entityData.name as string) || npcId,
        npcId,
        position: pos,
      });
    }

    return npcs;
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
