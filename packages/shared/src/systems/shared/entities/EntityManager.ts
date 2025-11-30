/**
 * EntityManager - Manages all entities in the world
 *
 * This system is responsible for:
 * - Creating and destroying entities
 * - Managing entity lifecycle
 * - Network synchronization
 * - Entity queries and lookups
 */

import { World } from "../../../core/World";
import { Entity, EntityConfig } from "../../../entities/Entity";
import { ItemEntity } from "../../../entities/world/ItemEntity";
import { HeadstoneEntity } from "../../../entities/world/HeadstoneEntity";
import { BankEntity } from "../../../entities/world/BankEntity";
import { MobEntity } from "../../../entities/npc/MobEntity";
import { NPCEntity } from "../../../entities/npc/NPCEntity";
import { ResourceEntity } from "../../../entities/world/ResourceEntity";
import type {
  ItemEntityConfig,
  ItemSpawnData,
  MobEntityConfig,
  MobSpawnData,
  NPCEntityConfig,
  NPCEntityProperties as _NPCEntityProperties,
  NPCSpawnData as _NPCSpawnData,
  ResourceEntityConfig,
  ResourceEntityProperties as _ResourceEntityProperties,
  ResourceSpawnData as _ResourceSpawnData,
  HeadstoneEntityConfig,
  BankEntityConfig,
} from "../../../types/entities";
import {
  EntityType,
  InteractionType,
  ItemRarity,
  MobAIState,
  NPCType,
  ResourceType,
} from "../../../types/entities";
import { NPCBehavior, NPCState } from "../../../types/core/core";
import { EventType } from "../../../types/events";
import { TerrainSystem } from "..";
import { SystemBase } from "..";
import { getItem } from "../../../data/items";
import { getNPCById } from "../../../data/npcs";
import { getExternalNPC } from "../../../utils/ExternalAssetUtils";

export class EntityManager extends SystemBase {
  private entities = new Map<string, Entity>();
  private entitiesNeedingUpdate = new Set<string>();
  private networkDirtyEntities = new Set<string>();
  private nextEntityId = 1;

  constructor(world: World) {
    super(world, {
      name: "entity-manager",
      dependencies: {
        required: [], // Entity manager is foundational and can work independently
        optional: ["client-graphics", "database"], // Better with graphics and persistence
      },
      autoCleanup: false,
    });
  }

  async init(): Promise<void> {
    // The World.register method already registers this system on the world object
    // No need for manual registration

    // Set up type-safe event subscriptions for entity management (16+ listeners!)
    // NOTE: We don't subscribe to ENTITY_SPAWNED here as that would create a circular loop
    // ENTITY_SPAWNED is emitted BY this system after spawning, not TO request spawning
    this.subscribe(EventType.ENTITY_DEATH, (data) =>
      this.handleEntityDestroy(
        data as { entityId: string; killedBy?: string; entityType?: string },
      ),
    );
    this.subscribe(EventType.ENTITY_INTERACT, (data) =>
      this.handleInteractionRequest({
        entityId: (data as { entityId: string }).entityId,
        playerId: (data as { playerId: string }).playerId,
        interactionType: (data as { action?: string }).action || "interact",
      }),
    );
    this.subscribe(EventType.ENTITY_MOVE_REQUEST, (data) =>
      this.handleMoveRequest(
        data as {
          entityId: string;
          position: { x: number; y: number; z: number };
        },
      ),
    );
    this.subscribe(EventType.ENTITY_PROPERTY_REQUEST, (data) =>
      this.handlePropertyRequest({
        entityId: (data as { entityId: string }).entityId,
        propertyName: (data as { property: string }).property,
        value: (data as { value: unknown }).value,
      }),
    );

    // Listen for specific entity type spawn requests
    // NOTE: Don't subscribe to ITEM_SPAWNED - that's an event we emit AFTER spawning, not a spawn request
    // Subscribing to it would cause duplicate spawns!
    // NOTE: Don't subscribe to ITEM_PICKUP - InventorySystem handles that and destroys the entity
    // Subscribe to ITEM_SPAWN for dropped/spawned items
    this.subscribe(EventType.ITEM_SPAWN, (data) => {
      const typedData = data as {
        itemId?: string;
        itemType?: string;
        position: { x: number; y: number; z: number };
        quantity?: number;
      };
      const itemIdToUse =
        typedData.itemId || typedData.itemType || "unknown_item";
      this.handleItemSpawn({
        customId: `item_${itemIdToUse}_${Date.now()}`,
        name: itemIdToUse,
        position: typedData.position,
        itemId: itemIdToUse,
        quantity: typedData.quantity || 1,
      });
    });
    // EntityManager should handle spawn REQUESTS, not completed spawns
    this.subscribe(EventType.MOB_NPC_SPAWN_REQUEST, (data) => {
      const typedData = data as {
        mobType: string;
        position: { x: number; y: number; z: number };
        level?: number;
        customId?: string;
      };
      this.handleMobSpawn({
        mobType: typedData.mobType,
        position: typedData.position,
        level: typedData.level || 1,
        customId: typedData.customId || `mob_${Date.now()}`,
        name: typedData.mobType,
      });
    });
    this.subscribe<{
      npcId: string;
      name: string;
      type: string;
      position: { x: number; y: number; z: number };
      services?: string[];
      modelPath?: string;
    }>(EventType.NPC_SPAWN_REQUEST, (data) => this.handleNPCSpawnRequest(data));
    this.subscribe(EventType.MOB_NPC_ATTACKED, (data) => {
      const typedData = data as {
        mobId: string;
        damage: number;
        attackerId: string;
      };
      this.handleMobAttacked({
        entityId: typedData.mobId,
        damage: typedData.damage,
        attackerId: typedData.attackerId,
      });
    });
    this.subscribe(EventType.COMBAT_MOB_NPC_ATTACK, (data) => {
      const typedData = data as { mobId: string; targetId: string };
      this.handleMobAttack({
        mobId: typedData.mobId,
        targetId: typedData.targetId,
        damage: 0,
      });
    });
    // RESOURCE_GATHERED has different structure in EventMap
    // Map the string resourceType to the enum value
    this.subscribe(EventType.RESOURCE_GATHERED, (data) => {
      const typedData = data as { resourceType: string };
      const resourceTypeMap: Record<string, ResourceType> = {
        tree: ResourceType.TREE,
        rock: ResourceType.MINING_ROCK,
        ore: ResourceType.MINING_ROCK,
        herb: ResourceType.TREE, // Map herb to tree for now
        fish: ResourceType.FISHING_SPOT,
      };
      this.handleResourceSpawn({
        resourceId: `resource_${Date.now()}`,
        resourceType: resourceTypeMap[typedData.resourceType] || "tree",
        position: { x: 0, y: 0, z: 0 },
      });
    });
    this.subscribe(EventType.RESOURCE_HARVEST, (data) => {
      const typedData = data as {
        resourceId: string;
        playerId: string;
        success: boolean;
      };
      this.handleResourceHarvest({
        entityId: typedData.resourceId,
        playerId: typedData.playerId,
        amount: typedData.success ? 1 : 0,
      });
    });
    // NPC_INTERACTION has different structure in EventMap
    this.subscribe(EventType.NPC_INTERACTION, (data) => {
      const typedData = data as { npcId: string };
      this.handleNPCSpawn({
        customId: typedData.npcId,
        name: "NPC",
        npcType: NPCType.QUEST_GIVER, // Default to quest giver
        position: { x: 0, y: 0, z: 0 },
        model: null,
        dialogues: [],
        questGiver: true,
        shopkeeper: false,
        bankTeller: false,
      });
    });
    this.subscribe(EventType.NPC_DIALOGUE, (data) => {
      const typedData = data as {
        npcId: string;
        playerId: string;
        dialogueId: string;
      };
      this.handleNPCDialogue({
        entityId: typedData.npcId,
        playerId: typedData.playerId,
        dialogueId: typedData.dialogueId,
      });
    });

    // Network sync for clients
    if (this.world.isClient) {
      this.subscribe(EventType.CLIENT_CONNECT, (data) => {
        const typedData = data as { clientId: string };
        this.handleClientConnect({ playerId: typedData.clientId });
      });
      this.subscribe(EventType.CLIENT_DISCONNECT, (data) => {
        const typedData = data as { clientId: string };
        this.handleClientDisconnect({ playerId: typedData.clientId });
      });
    }
  }

  /**
   * Start method - called after init, spawns world objects
   */
  async start(): Promise<void> {
    // Server spawns static world objects (banks, etc.)
    if (this.world.isServer) {
      await this.spawnWorldObjects();
    }
  }

  /**
   * Spawn static world objects (banks, etc.)
   * These are permanent fixtures in the world, not mobs or NPCs
   */
  private async spawnWorldObjects(): Promise<void> {
    // Get terrain system for height lookup
    const terrain = this.world.getSystem<TerrainSystem>("terrain");

    // Get terrain height at bank location
    let bankY = 40; // Default height
    if (terrain?.getHeightAt) {
      const height = terrain.getHeightAt(0, -25);
      if (height !== null && height !== undefined && Number.isFinite(height)) {
        bankY = (height as number) + 1; // +1 to sit on ground
      }
    }

    // Spawn bank at (0, y, -25) - behind player spawn, safe from goblin
    const bankConfig: BankEntityConfig = {
      id: "bank_spawn_bank",
      name: "Bank",
      type: EntityType.BANK,
      position: { x: 0, y: bankY, z: -25 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.BANK,
      interactionDistance: 3,
      description: "A secure place to store your items.",
      model: null,
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 1, max: 1 },
        level: 1,
        bankId: "spawn_bank",
      },
    };

    try {
      await this.spawnEntity(bankConfig);
      console.log(`[EntityManager] Spawned bank at (0, ${bankY}, -25)`);
    } catch (err) {
      console.error("[EntityManager] Error spawning bank:", err);
    }
  }

  update(deltaTime: number): void {
    // Update all entities that need updates
    this.entitiesNeedingUpdate.forEach((entityId) => {
      const entity = this.entities.get(entityId);
      if (entity) {
        entity.update(deltaTime);

        // Check if entity marked itself as dirty and needs network sync
        if (this.world.isServer && entity.networkDirty) {
          this.networkDirtyEntities.add(entityId);
          entity.networkDirty = false; // Reset flag after adding to set
        }
      }
    });

    // Send network updates
    if (this.world.isServer && this.networkDirtyEntities.size > 0) {
      this.sendNetworkUpdates();
    }
  }

  fixedUpdate(deltaTime: number): void {
    // Fixed update for physics
    this.entities.forEach((entity) => {
      entity.fixedUpdate(deltaTime);
    });
  }

  async spawnEntity(config: EntityConfig): Promise<Entity | null> {
    // CRITICAL: Only server should spawn entities
    // Clients receive entities via snapshot/network sync
    if (!this.world.isServer) {
      console.warn(
        `[EntityManager] Client attempted to spawn entity ${config.id || "unknown"} - blocked (entities come from server)`,
      );
      return null;
    }

    // Generate entity ID if not provided
    if (!config.id) {
      config.id = `entity_${this.nextEntityId++}`;
    }

    // Check if entity already exists
    if (this.entities.has(config.id)) {
      return this.entities.get(config.id) || null;
    }

    // VALIDATE config before creating entity
    if (
      !config.position ||
      !Number.isFinite(config.position.x) ||
      !Number.isFinite(config.position.y) ||
      !Number.isFinite(config.position.z)
    ) {
      throw new Error(
        `Invalid position for entity ${config.id}: ${JSON.stringify(config.position)}`,
      );
    }

    if (config.position.y < -200 || config.position.y > 2000) {
      throw new Error(
        `Entity spawn position out of range: Y=${config.position.y} (expected 0-100)`,
      );
    }

    let entity: Entity;

    switch (config.type) {
      case "item":
        entity = new ItemEntity(this.world, config as ItemEntityConfig);
        break;
      case EntityType.HEADSTONE:
      case "headstone":
        entity = new HeadstoneEntity(
          this.world,
          config as HeadstoneEntityConfig,
        );
        break;
      case EntityType.BANK:
      case "bank":
        entity = new BankEntity(this.world, config as BankEntityConfig);
        break;
      case "mob":
        entity = new MobEntity(this.world, config as MobEntityConfig);
        break;
      case "resource":
        entity = new ResourceEntity(this.world, config as ResourceEntityConfig);
        break;
      case "npc":
        entity = new NPCEntity(this.world, config as NPCEntityConfig);
        break;
      default:
        throw new Error(`[EntityManager] Unknown entity type: ${config.type}`);
    }

    // Initialize entity (this will throw if it fails)
    await entity.init();

    // Store entity
    this.entities.set(config.id, entity);
    this.entitiesNeedingUpdate.add(config.id);

    // Register with world entities system so other systems can find it
    this.world.entities.set(config.id, entity);

    // Broadcast entityAdded to all clients (server-only)
    if (this.world.isServer) {
      const network = this.world.network as {
        send?: (method: string, data: unknown, excludeId?: string) => void;
      };
      if (network?.send) {
        network.send("entityAdded", entity.serialize());
      }
    }

    // Emit spawn event using world.emit to avoid type mismatch
    this.emitTypedEvent(EventType.ENTITY_SPAWNED, {
      entityId: config.id,
      entityType: config.type,
      position: config.position,
      entityData: entity.getNetworkData(),
    });

    // CRITICAL FIX: Broadcast new entity to all connected clients
    if (this.world.isServer) {
      const network = this.world.network;
      if (network && typeof network.send === "function") {
        try {
          network.send("entityAdded", entity.serialize());
        } catch (error) {
          console.warn(
            `[EntityManager] Failed to broadcast entity ${config.id}:`,
            error,
          );
        }
      }
    }

    return entity;
  }

  destroyEntity(entityId: string): boolean {
    const entity = this.getEntity(entityId);
    if (!entity) {
      return false;
    }

    // Send entityRemoved packet to all clients before destroying
    const network = this.world.network;
    if (network && network.isServer) {
      try {
        network.send("entityRemoved", entityId);
      } catch (error) {
        console.warn(
          `[EntityManager] Failed to send entityRemoved packet for ${entityId}:`,
          error,
        );
      }
    }

    // Call entity destroy method
    entity.destroy();

    // Remove from tracking
    this.entities.delete(entityId);
    this.entitiesNeedingUpdate.delete(entityId);
    this.networkDirtyEntities.delete(entityId);

    // Remove from world entities system
    this.world.entities.remove(entityId);

    // Emit destroy event
    this.emitTypedEvent(EventType.ENTITY_DEATH, {
      entityId,
      entityType: entity.type,
    });

    return true;
  }

  getEntity(entityId: string): Entity | undefined {
    const entity = this.entities.get(entityId);
    if (entity) {
      return entity;
    }
    for (const e of this.entities.values()) {
      //console.log(`[EntityManager] Entity: ${e.id} - ${e.type} - ${entityId}, is same: ${e.id === entityId}`);
      if (e.id === entityId) {
        return e;
      }
    }
  }

  /**
   * Get all entities (for debugging and iteration)
   */
  getAllEntities(): Map<string, Entity> {
    return this.entities;
  }

  /**
   * Get all entities of a specific type
   */
  getEntitiesByType(type: string): Entity[] {
    return Array.from(this.entities.values()).filter(
      (entity) => entity.type === type,
    );
  }

  /**
   * Get entities within range of a position
   */
  getEntitiesInRange(
    center: { x: number; y: number; z: number },
    range: number,
    type?: string,
  ): Entity[] {
    return Array.from(this.entities.values()).filter((entity) => {
      if (type && entity.type !== type) return false;
      const distance = entity.getDistanceTo(center);
      return distance <= range;
    });
  }

  private handleEntityDestroy(data: { entityId: string }): void {
    this.destroyEntity(data.entityId);
  }

  private async handleInteractionRequest(data: {
    entityId: string;
    playerId: string;
    interactionType?: string;
  }): Promise<void> {
    const entity = this.getEntity(data.entityId);
    if (!entity) {
      return;
    }
    await entity.handleInteraction({
      ...data,
      interactionType: data.interactionType || "interact",
      position: entity.getPosition(),
      playerPosition: { x: 0, y: 0, z: 0 }, // Default player position - would be provided by actual system
    });
  }

  private handleMoveRequest(data: {
    entityId: string;
    position: { x: number; y: number; z: number };
  }): void {
    const entity = this.getEntity(data.entityId);
    if (!entity) {
      return;
    }
    // Do not override local player physics-driven movement. Let PlayerLocal handle motion.
    const isLocalPlayer =
      entity.isPlayer &&
      this.world.entities.player &&
      entity.id === this.world.entities.player.id;
    if (isLocalPlayer) {
      return;
    }
    entity.setPosition(data.position.x, data.position.y, data.position.z);
  }

  private handlePropertyRequest(data: {
    entityId: string;
    propertyName: string;
    value: unknown;
  }): void {
    const entity = this.getEntity(data.entityId);
    if (!entity) {
      return;
    }
    entity.setProperty(data.propertyName, data.value);
  }

  private async handleItemSpawn(data: ItemSpawnData): Promise<void> {
    const itemIdToUse = data.itemId || data.id || "unknown_item";

    // Get item data from items database to get model path and other properties
    const itemData = getItem(itemIdToUse);

    // Create proper ItemEntityConfig (not generic EntityConfig)
    const config: ItemEntityConfig = {
      id: data.customId || `item_${this.nextEntityId++}`,
      name: data.name || itemData?.name || itemIdToUse,
      type: EntityType.ITEM,
      position: data.position || { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.PICKUP,
      interactionDistance: 2,
      description: itemData?.description || data.name || itemIdToUse,
      model: itemData?.modelPath || data.model || null,
      modelPath: itemData?.modelPath || data.model || undefined,
      // ItemEntityConfig required fields at top level
      itemType: String(itemData?.type || "misc"),
      itemId: itemIdToUse,
      quantity: data.quantity || 1,
      stackable: itemData?.stackable !== false,
      value: itemData?.value || data.value || 0,
      weight: itemData?.weight || this.getItemWeight(itemIdToUse),
      rarity: itemData?.rarity || ItemRarity.COMMON,
      stats: (itemData?.stats as Record<string, number>) || {},
      requirements: {
        level: itemData?.requirements?.level || 1,
        attack:
          (itemData?.requirements?.skills as Record<string, number>)?.attack ||
          0,
      },
      effects: [],
      armorSlot: null,
      examine: itemData?.examine || "",
      iconPath: itemData?.iconPath || "",
      healAmount: itemData?.healAmount || 0,
      // Properties field for Entity base class (must include ItemEntityProperties)
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 1, max: 1 },
        level: 1,
        harvestable: false,
        dialogue: [],
        // ItemEntityProperties required fields
        itemId: itemIdToUse,
        quantity: data.quantity || 1,
        stackable: itemData?.stackable !== false,
        value: itemData?.value || data.value || 0,
        weight: itemData?.weight || this.getItemWeight(itemIdToUse),
        rarity: itemData?.rarity || ItemRarity.COMMON,
      },
    };

    await this.spawnEntity(config);
  }

  private handleItemPickup(data: { entityId: string; playerId: string }): void {
    const entity = this.getEntity(data.entityId);
    if (!entity) {
      return;
    }

    // Get properties before destroying
    const itemId = entity.getProperty("itemId");
    const quantity = entity.getProperty("quantity");

    this.destroyEntity(data.entityId);

    this.emitTypedEvent(EventType.ITEM_PICKUP, {
      playerId: data.playerId,
      item: itemId,
      quantity: quantity,
    });
  }

  async handleMobSpawn(data: MobSpawnData): Promise<void> {
    // Strong type assumption - MobSpawnData.position is always Position3D with valid coordinates
    // If invalid coordinates are passed, that's a bug in the calling code
    let position = data.position;
    if (!position) {
      throw new Error("[EntityManager] Mob spawn position is required");
    }

    const mobType = data.mobType;
    if (!mobType) {
      throw new Error("[EntityManager] Mob type is required");
    }

    const level = data.level || 1;

    // Ground to terrain height map explicitly for server/client authoritative spawn
    const terrain = this.world.getSystem<TerrainSystem>("terrain");
    if (terrain) {
      const th = terrain.getHeightAt(position.x, position.z);
      if (Number.isFinite(th)) {
        position = { x: position.x, y: (th as number) + 0.1, z: position.z };
      }
    }

    // Get NPC data to access modelPath
    const npcDataFromDB = getNPCById(mobType);
    const modelPath = npcDataFromDB?.appearance.modelPath;

    if (!modelPath) {
      throw new Error(`[EntityManager] Mob ${mobType} has no model path`);
    }

    // CRITICAL FIX: Always use the provided customId to ensure client/server ID consistency
    // Only generate a new ID if customId is not provided (fallback case)
    const mobId = data.customId || `mob_${this.nextEntityId++}`;

    // Get scale from manifest (default to 1.0 if not specified)
    const manifestScale = npcDataFromDB?.appearance?.scale ?? 1;

    const config: MobEntityConfig = {
      id: mobId,
      name: `Mob: ${data.name || mobType || "Unknown"} (Lv${level})`,
      type: EntityType.MOB,
      position: position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: manifestScale, y: manifestScale, z: manifestScale },
      visible: true,
      interactable: true,
      interactionType: InteractionType.ATTACK,
      interactionDistance: 5,
      description: `${mobType} (Level ${level})`,
      model: modelPath,
      // MobEntity specific fields
      mobType: mobType, // Mob ID from mobs.json
      level: level,
      currentHealth: this.getMobMaxHealth(mobType, level),
      maxHealth: this.getMobMaxHealth(mobType, level),
      attackPower: this.getMobAttackPower(mobType, level),
      defense: this.getMobDefense(mobType, level),
      attackSpeed: this.getMobAttackSpeed(mobType),
      moveSpeed: this.getMobMoveSpeed(mobType),
      aggressive: npcDataFromDB?.combat.aggressive ?? true, // Default to aggressive if not specified
      retaliates: npcDataFromDB?.combat.retaliates ?? true, // Default to retaliating if not specified
      attackable: npcDataFromDB?.combat.attackable ?? true, // Default to attackable if not specified
      movementType: npcDataFromDB?.movement.type ?? "wander", // Default to wander if not specified
      aggroRange: this.getMobAggroRange(mobType),
      combatRange: this.getMobCombatRange(mobType),
      wanderRadius: 10, // 10 meter wander radius from spawn (RuneScape-style)
      xpReward: this.getMobXPReward(mobType, level),
      lootTable: this.getMobLootTable(mobType),
      respawnTime: 300000, // 5 minutes default
      spawnPoint: position,
      aiState: MobAIState.IDLE,
      lastAttackTime: 0,
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: {
          current: this.getMobMaxHealth(mobType, level),
          max: this.getMobMaxHealth(mobType, level),
        },
        level: level,
      },
      targetPlayerId: null,
      deathTime: null,
    };

    const entity = await this.spawnEntity(config);

    // Emit MOB_NPC_SPAWNED event to notify other systems (like AggroSystem)
    // that a mob has been successfully spawned
    if (entity) {
      this.emitTypedEvent(EventType.MOB_NPC_SPAWNED, {
        mobId: config.id,
        mobType: mobType,
        position: position,
      });
    }
  }

  private handleMobAttacked(_data: {
    entityId: string;
    damage: number;
    attackerId: string;
  }): void {
    // NO-OP: MobEntity.takeDamage() now calls die() directly when health reaches 0
    // This event handler is kept for backward compatibility but does nothing
    // Event chain: CombatSystem → takeDamage() → die() (no EntityManager involved)
  }

  private handleMobAttack(data: {
    mobId: string;
    targetId: string;
    damage: number;
  }): void {
    const mob = this.entities.get(data.mobId);
    if (!mob) {
      return;
    }

    const damage = mob.getProperty("attackPower");

    this.emitTypedEvent(EventType.PLAYER_DAMAGE, {
      playerId: data.targetId,
      damage,
      source: data.mobId,
      sourceType: "mob",
    });
  }

  private handleClientConnect(data: { playerId: string }): void {
    // Send all current entities to new client
    const entityData = Array.from(this.entities.values()).map((entity) => ({
      type: entity.type,
      data: entity.getNetworkData(),
    }));

    this.emitTypedEvent(EventType.CLIENT_ENTITY_SYNC, {
      playerId: data.playerId,
      entities: entityData,
    });
  }

  private handleClientDisconnect(data: { playerId: string }): void {
    // Clean up any player-specific entity data
    this.entities.forEach((entity, entityId) => {
      if (entity.getProperty("ownerId") === data.playerId) {
        this.destroyEntity(entityId);
      }
    });
  }

  private sendNetworkUpdates(): void {
    // Only send network updates on the server
    if (!this.world.isServer) {
      this.networkDirtyEntities.clear();
      return;
    }

    // Disabled - too spammy
    // if (this.networkDirtyEntities.size > 0) {
    //   console.log(`[EntityManager.sendNetworkUpdates] Syncing ${this.networkDirtyEntities.size} dirty entities:`, Array.from(this.networkDirtyEntities));
    // }

    const network = this.world.network as {
      send?: (method: string, data: unknown, excludeId?: string) => void;
    };

    if (!network || !network.send) {
      // No network system, clear dirty entities and return
      this.networkDirtyEntities.clear();
      return;
    }

    this.networkDirtyEntities.forEach((entityId) => {
      // CRITICAL FIX: Players are in world.players, not EntityManager.entities
      // Check both locations to find the entity
      let entity = this.entities.get(entityId);
      if (!entity && this.world.getPlayer) {
        const playerEntity = this.world.getPlayer(entityId);
        if (playerEntity) {
          entity = playerEntity;
          console.log(
            `[EntityManager] 📍 Found player ${entityId} in world.players (not in EntityManager.entities)`,
          );
        }
      }

      if (entity) {
        // Get current position from entity
        const pos = entity.position;
        const rot = entity.node?.quaternion;

        // Get network data from entity (includes health and other properties)
        const networkData = entity.getNetworkData();

        // Debug logging disabled (too spammy)
        // if (entity.type === 'player') {
        //   console.log(`[EntityManager] 📤 Syncing player ${entityId}`);
        //   console.log(`[EntityManager] 📤 networkData keys:`, Object.keys(networkData));
        //   console.log(`[EntityManager] 📤 networkData.c (inCombat):`, (networkData as { c?: boolean }).c);
        //   console.log(`[EntityManager] 📤 networkData.e (emote):`, (networkData as { e?: string }).e);
        //   console.log(`[EntityManager] 📤 Full networkData:`, JSON.stringify(networkData, null, 2));
        // }

        // Send entityModified packet with position/rotation changes
        // Call directly on network object to preserve 'this' context
        // Non-null assertion safe because we checked network.send exists above
        network.send!("entityModified", {
          id: entityId,
          changes: {
            p: [pos.x, pos.y, pos.z],
            q: rot ? [rot.x, rot.y, rot.z, rot.w] : undefined,
            ...networkData, // Include all entity-specific data (health, aiState, etc.)
          },
        });
      } else {
        console.warn(
          `[EntityManager] ⚠️ Cannot sync ${entityId}: entity not found in EntityManager.entities or world.players`,
        );
      }
    });

    // Clear dirty entities
    this.networkDirtyEntities.clear();
  }

  getDebugInfo(): {
    totalEntities: number;
    entitiesByType: Record<string, number>;
    entitiesNeedingUpdate: number;
    networkDirtyEntities: number;
  } {
    return {
      totalEntities: this.entities.size,
      entitiesByType: this.getEntityTypeCount(),
      entitiesNeedingUpdate: this.entitiesNeedingUpdate.size,
      networkDirtyEntities: this.networkDirtyEntities.size,
    };
  }

  private getEntityTypeCount(): Record<string, number> {
    const counts: Record<string, number> = {};

    this.entities.forEach((entity) => {
      counts[entity.type] = (counts[entity.type] || 0) + 1;
    });

    return counts;
  }

  /**
   * Helper method to create a simple test item entity with minimal configuration
   */
  async createTestItem(config: {
    id?: string;
    name: string;
    position: { x: number; y: number; z: number };
    itemId?: string;
    quantity?: number;
  }): Promise<Entity | null> {
    const itemConfig: ItemEntityConfig = {
      id: config.id || `test_item_${this.nextEntityId++}`,
      type: EntityType.ITEM,
      name: config.name,
      position: config.position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.PICKUP,
      interactionDistance: 2,
      description: `Test item: ${config.name}`,
      model: null,
      // ItemEntityConfig-specific fields
      itemType: config.itemId || "test-item",
      itemId: config.itemId || "test-item",
      quantity: config.quantity || 1,
      stackable: false,
      value: 0,
      weight: 0,
      rarity: ItemRarity.COMMON,
      stats: {},
      requirements: {},
      effects: [],
      armorSlot: null,
      // Properties field
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: {
          current: 1,
          max: 1,
        },
        level: 1,
        itemId: config.itemId || "test-item",
        harvestable: false,
        dialogue: [],
        quantity: config.quantity || 1,
        stackable: false,
        value: 0,
        weight: 0,
        rarity: ItemRarity.COMMON,
      },
    };

    return this.spawnEntity(itemConfig);
  }

  // Helper methods for mob stats calculation - NOW DATA-DRIVEN!
  // All values loaded from mobs.json instead of hardcoded

  private getMobMaxHealth(mobType: string, level: number): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 100 + (level - 1) * 10;
    }
    return npcData.stats.health + (level - npcData.stats.level) * 10;
  }

  private getMobAttackPower(mobType: string, level: number): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 5 + (level - 1) * 2;
    }
    return npcData.stats.attack + (level - npcData.stats.level) * 2;
  }

  private getMobDefense(mobType: string, level: number): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 2 + (level - 1);
    }
    return npcData.stats.defense + (level - npcData.stats.level);
  }

  private getMobAttackSpeed(mobType: string): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 1.5;
    }
    return npcData.combat.attackSpeed;
  }

  private getMobMoveSpeed(mobType: string): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 3.0; // Default: 3 units/sec (walking speed, matches player walk)
    }
    return npcData.movement.speed;
  }

  private getMobAggroRange(mobType: string): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 15.0; // Default: 15 meters detection range (increased from 10)
    }
    return npcData.combat.aggroRange;
  }

  private getMobCombatRange(mobType: string): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 1.5; // Default: 1.5 meters melee range
    }
    return npcData.combat.combatRange;
  }

  private getMobXPReward(mobType: string, level: number): number {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return 10 * level;
    }
    const levelDiff = level - npcData.stats.level;
    return npcData.combat.xpReward + levelDiff * 5;
  }

  private getMobLootTable(mobType: string): Array<{
    itemId: string;
    chance: number;
    minQuantity: number;
    maxQuantity: number;
  }> {
    const npcData = getNPCById(mobType);
    if (!npcData) {
      return [{ itemId: "coins", chance: 0.5, minQuantity: 1, maxQuantity: 5 }];
    }

    // Convert unified NPCData drops to expected format
    const allDrops: Array<{
      itemId: string;
      chance: number;
      minQuantity: number;
      maxQuantity: number;
    }> = [];

    // Add default drop if enabled
    if (npcData.drops.defaultDrop.enabled) {
      allDrops.push({
        itemId: npcData.drops.defaultDrop.itemId,
        chance: 1.0,
        minQuantity: npcData.drops.defaultDrop.quantity,
        maxQuantity: npcData.drops.defaultDrop.quantity,
      });
    }

    // Add all drop tiers
    for (const drop of npcData.drops.always) {
      allDrops.push({
        itemId: drop.itemId,
        chance: drop.chance,
        minQuantity: drop.minQuantity,
        maxQuantity: drop.maxQuantity,
      });
    }

    for (const drop of npcData.drops.common) {
      allDrops.push({
        itemId: drop.itemId,
        chance: drop.chance,
        minQuantity: drop.minQuantity,
        maxQuantity: drop.maxQuantity,
      });
    }

    for (const drop of npcData.drops.uncommon) {
      allDrops.push({
        itemId: drop.itemId,
        chance: drop.chance,
        minQuantity: drop.minQuantity,
        maxQuantity: drop.maxQuantity,
      });
    }

    for (const drop of npcData.drops.rare) {
      allDrops.push({
        itemId: drop.itemId,
        chance: drop.chance,
        minQuantity: drop.minQuantity,
        maxQuantity: drop.maxQuantity,
      });
    }

    for (const drop of npcData.drops.veryRare) {
      allDrops.push({
        itemId: drop.itemId,
        chance: drop.chance,
        minQuantity: drop.minQuantity,
        maxQuantity: drop.maxQuantity,
      });
    }

    return allDrops.length > 0
      ? allDrops
      : [{ itemId: "coins", chance: 0.5, minQuantity: 1, maxQuantity: 5 }];
  }

  private getItemWeight(_itemId: string): number {
    // Default weight for items - could be expanded with item data
    return 1;
  }

  private handleResourceSpawn(data: {
    resourceId: string;
    position: { x: number; y: number; z: number };
    resourceType: string;
  }): void {
    // Resource spawn logic
    this.spawnResource(data.resourceId, data.position, data.resourceType);
  }

  private async spawnResource(
    resourceId: string,
    position: { x: number; y: number; z: number },
    resourceType: string,
  ): Promise<Entity | null> {
    // Create readable resource name
    const resourceName = resourceType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const config: ResourceEntityConfig = {
      id: resourceId,
      type: EntityType.RESOURCE,
      name: `Resource: ${resourceName}`,
      position: position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.GATHER,
      interactionDistance: 3,
      description: `A ${resourceType} resource`,
      model: null,
      resourceType: resourceType as ResourceType,
      resourceId: resourceId,
      harvestSkill: "woodcutting",
      requiredLevel: 1,
      harvestTime: 3000, // 3 seconds to harvest
      respawnTime: 60000,
      harvestYield: [{ itemId: "wood", quantity: 1, chance: 1.0 }],
      depleted: false,
      lastHarvestTime: 0,
      properties: {
        health: {
          current: 1,
          max: 1,
        },
        resourceType: resourceType as ResourceType,
        harvestable: true,
        respawnTime: 60000,
        toolRequired: "none",
        skillRequired: "none",
        xpReward: 10,
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        level: 1,
      },
    };

    return this.spawnEntity(config);
  }

  private async handleResourceHarvest(_data: {
    entityId: string;
    playerId: string;
    amount: number;
  }): Promise<void> {
    // Resource harvest logic would go here
    // For now, just log it
  }

  private async handleNPCSpawnRequest(data: {
    npcId: string;
    name: string;
    type: string;
    position: { x: number; y: number; z: number };
    services?: string[];
    modelPath?: string;
  }): Promise<void> {
    // Determine NPC type prefix based on services/type
    let typePrefix = "NPC";
    if (data.type === "bank" || data.services?.includes("banking")) {
      typePrefix = "Bank";
    } else if (
      data.type === "general_store" ||
      data.services?.includes("buy_items")
    ) {
      typePrefix = "Store";
    } else if (data.type === "skill_trainer") {
      typePrefix = "Trainer";
    } else if (data.type === "quest_giver") {
      typePrefix = "Quest";
    }

    // Try to get model path from external NPCs if not provided
    let modelPath: string | null = null;
    if (data.modelPath) {
      modelPath = data.modelPath;
    } else {
      const externalNPC = getExternalNPC(data.npcId);
      if (externalNPC && externalNPC.appearance.modelPath) {
        modelPath = externalNPC.appearance.modelPath as string;
      }
    }

    const config: NPCEntityConfig = {
      id: `npc_${data.npcId}_${this.nextEntityId++}`,
      name: `${typePrefix}: ${data.name}`,
      type: EntityType.NPC,
      position: data.position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.TALK,
      interactionDistance: 3,
      description: data.name,
      model: modelPath,
      npcType: this.mapTypeToNPCType(data.type),
      npcId: data.npcId,
      dialogueLines: [],
      services: data.services || [],
      inventory: [],
      skillsOffered: [],
      questsAvailable: [],
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 100, max: 100 },
        level: 1,
        npcComponent: {
          behavior: NPCBehavior.FRIENDLY,
          state: NPCState.IDLE,
          currentTarget: null,
          spawnPoint: data.position,
          wanderRadius: 0,
          aggroRange: 0,
          isHostile: false,
          combatLevel: 1,
          aggressionLevel: 0,
          dialogueLines: [],
          dialogue: null,
          services: data.services || [],
        },
        dialogue: [],
        shopInventory: [],
        questGiver: data.type === "quest_giver",
      },
    };

    await this.spawnEntity(config);

    // If it's a store, register it with the store system
    if (data.type === "general_store" || data.services?.includes("buy_items")) {
      // Map NPC ID to store ID based on position
      // NPCs are named like "lumbridge_shopkeeper", stores are like "store_town_0"
      let storeId = "store_town_0"; // Default to central
      if (
        data.npcId.includes("lumbridge") ||
        (data.position.x < 50 &&
          data.position.x > -50 &&
          data.position.z < 50 &&
          data.position.z > -50)
      ) {
        storeId = "store_town_0"; // Central
      } else if (data.position.x > 50) {
        storeId = "store_town_1"; // Eastern
      } else if (data.position.x < -50) {
        storeId = "store_town_2"; // Western
      } else if (data.position.z > 50) {
        storeId = "store_town_3"; // Northern
      } else if (data.position.z < -50) {
        storeId = "store_town_4"; // Southern
      }

      this.emitTypedEvent(EventType.STORE_REGISTER_NPC, {
        npcId: data.npcId,
        storeId: storeId,
        position: data.position,
        name: data.name,
        area: "town",
      });
    }
  }

  private mapTypeToNPCType(type: string): NPCType {
    switch (type) {
      case "bank":
        return NPCType.BANK;
      case "general_store":
        return NPCType.STORE;
      case "skill_trainer":
        return NPCType.TRAINER;
      case "quest_giver":
        return NPCType.QUEST_GIVER;
      default:
        return NPCType.QUEST_GIVER;
    }
  }

  private handleNPCSpawn(_data: {
    customId: string;
    name: string;
    npcType: NPCType;
    position: { x: number; y: number; z: number };
    model: unknown;
    dialogues: string[];
    questGiver: boolean;
    shopkeeper: boolean;
    bankTeller: boolean;
  }): void {
    // NPC spawn logic
  }

  private handleNPCDialogue(_data: {
    entityId: string;
    playerId: string;
    dialogueId: string;
  }): void {
    // NPC dialogue logic
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clean up all entities
    for (const entity of this.entities.values()) {
      if (entity) {
        // Assume destroy method exists on entities
        entity.destroy();
      }
    }
    this.entities.clear();

    // Clear tracking sets
    this.entitiesNeedingUpdate.clear();
    this.networkDirtyEntities.clear();

    // Reset entity ID counter
    this.nextEntityId = 1;

    // Call parent cleanup
    super.destroy();
  }
}
