/**
 * EmbeddedHyperscapeService - Direct world integration for embedded agents
 *
 * Unlike the plugin-hyperscape WebSocket service, this service runs in the same
 * process as the server and has direct access to the World instance.
 *
 * This eliminates network latency and simplifies the architecture for
 * agents that run on the server itself.
 */

import { EventType, getDuelArenaConfig, type World } from "@hyperscape/shared";
import type {
  IEmbeddedHyperscapeService,
  EmbeddedGameState,
  NearbyEntityData,
  AgentQuestProgress,
  AgentQuestInfo,
} from "./types.js";

// Distance threshold for "nearby" entities (in world units)
const NEARBY_DISTANCE = 50;

// Event handler type
type EventHandler = (data: unknown) => void;

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
  private playerEntityId: string | null = null;
  private isActive: boolean = false;

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

    // Check if player entity already exists
    const existingEntity = this.world.entities.get(this.characterId);
    if (existingEntity) {
      console.log(
        `[EmbeddedHyperscapeService] Player entity already exists: ${this.characterId}`,
      );
      this.playerEntityId = this.characterId;
      this.isActive = true;
      return;
    }

    // Load character data from database
    const databaseSystem = this.world.getSystem("database") as
      | {
          getCharactersAsync: (accountId: string) => Promise<
            Array<{
              id: string;
              name: string;
              avatar?: string | null;
              wallet?: string | null;
            }>
          >;
          getPlayerAsync: (characterId: string) => Promise<{
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

    // Get character info
    const characters = await databaseSystem.getCharactersAsync(this.accountId);
    const characterData = characters.find((c) => c.id === this.characterId);

    if (!characterData) {
      throw new Error(
        `Character ${this.characterId} not found for account ${this.accountId}`,
      );
    }

    // Get saved player data (position, skills)
    // Cast to include magic/prayer skills which may not be in the older type definition
    const savedData = (await databaseSystem.getPlayerAsync(
      this.characterId,
    )) as
      | (Awaited<ReturnType<typeof databaseSystem.getPlayerAsync>> & {
          magicLevel?: number;
          magicXp?: number;
          prayerLevel?: number;
          prayerXp?: number;
        })
      | null;

    // Determine spawn position
    const hasSavedPosition = savedData?.positionX !== undefined;
    let position: [number, number, number] = [0, 10, 0];
    if (this.shouldUseStreamingSpawnPosition()) {
      position = this.getStreamingAgentSpawnPosition();
    } else if (hasSavedPosition) {
      position = [
        savedData.positionX || 0,
        savedData.positionY || 10,
        savedData.positionZ || 0,
      ];
    }

    // Snap agent spawns to terrain height for consistent grounded placement.
    position = this.groundSpawnPosition(position);

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
          name: characterData.name,
          health,
          maxHealth: health,
          avatar:
            characterData.avatar ||
            this.world.settings?.avatar?.url ||
            "asset://avatars/avatar-male-01.vrm",
          wallet: characterData.wallet || undefined,
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
    // Subscribe to entity events
    this.world.on(EventType.ENTITY_CREATED, (data) => {
      this.broadcastEvent("ENTITY_JOINED", data);
    });

    this.world.on(EventType.ENTITY_MODIFIED, (data) => {
      this.broadcastEvent("ENTITY_UPDATED", data);
    });

    this.world.on(EventType.ENTITY_REMOVE, (data) => {
      this.broadcastEvent("ENTITY_LEFT", data);
    });

    // Subscribe to inventory events
    this.world.on(EventType.INVENTORY_UPDATED, (data) => {
      const eventData = data as { playerId?: string };
      if (eventData.playerId === this.characterId) {
        this.broadcastEvent("INVENTORY_UPDATED", data);
      }
    });

    // Subscribe to skills events
    this.world.on(EventType.SKILLS_UPDATED, (data) => {
      const eventData = data as { playerId?: string };
      if (eventData.playerId === this.characterId) {
        this.broadcastEvent("SKILLS_UPDATED", data);
      }
    });

    // Subscribe to chat events
    this.world.on(EventType.CHAT_MESSAGE, (data) => {
      this.broadcastEvent("CHAT_MESSAGE", data);
    });
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
    const inventory = (data.inventory || []) as Array<{
      slot: number;
      itemId: string;
      quantity: number;
    }>;
    const equipment = (data.equipment || {}) as Record<
      string,
      { itemId: string }
    >;

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

  getNearbyEntities(): NearbyEntityData[] {
    if (!this.playerEntityId || !this.isActive) {
      return [];
    }

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) {
      return [];
    }

    const playerPos = this.getEntityPosition(player);
    if (!playerPos) {
      return [];
    }

    const nearby: NearbyEntityData[] = [];

    // Iterate through all entities
    for (const [id, entity] of this.world.entities.items.entries()) {
      if (id === this.playerEntityId) continue; // Skip self

      const entityData = entity.data as Record<string, unknown>;
      const entityPos = this.getEntityPosition(entity);
      if (!entityPos) continue;

      // Calculate distance
      const dx = entityPos[0] - playerPos[0];
      const dy = entityPos[1] - playerPos[1];
      const dz = entityPos[2] - playerPos[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance > NEARBY_DISTANCE) continue;

      // Determine entity type
      const entityType = this.categorizeEntity(entityData);

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

    return nearby;
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

    // Use the resource system directly
    const resourceSystem = this.world.getSystem("resource") as
      | {
          startGathering?: (playerId: string, resourceId: string) => void;
        }
      | undefined;

    if (resourceSystem?.startGathering) {
      resourceSystem.startGathering(this.playerEntityId, resourceId);
    } else {
      console.warn("[EmbeddedHyperscapeService] Resource system not available");
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

    const player = this.world.entities.get(this.playerEntityId);
    if (!player) return;

    const inventory = (player.data.inventory || []) as Array<{
      slot: number;
      itemId: string;
    }>;
    const item = inventory.find((i) => i.itemId === itemId);

    if (item) {
      this.world.emit(EventType.INVENTORY_USE, {
        playerId: this.playerEntityId,
        itemId: itemId,
        slot: item.slot,
      });
    } else {
      console.warn(
        `[EmbeddedHyperscapeService] Cannot use item ${itemId}: not found in inventory`,
      );
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

    // Cancel combat
    const player = this.world.entities.get(this.playerEntityId);
    if (player) {
      player.data.combatTarget = null;
      player.data.inCombat = false;
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
        err instanceof Error ? err.message : String(err),
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

  async executeFiremake(): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;

    this.world.emit(EventType.FIREMAKING_REQUEST, {
      playerId: this.playerEntityId,
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

    this.world.emit(EventType.QUEST_START_ACCEPTED, {
      playerId: this.playerEntityId,
      questId,
    });
    return true;
  }

  async executeQuestComplete(questId: string): Promise<boolean> {
    if (!this.playerEntityId || !this.isActive) return false;
    if (!questId) return false;

    const questSystem = this.world.getSystem("quest") as {
      completeQuest?: (playerId: string, questId: string) => Promise<boolean>;
    } | null;

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
