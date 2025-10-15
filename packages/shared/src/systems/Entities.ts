/**
 * Entities.ts - Entity Management System
 * 
 * Central registry and lifecycle manager for all entities in the game world.
 * Manages players, mobs, NPCs, and generic entities with component-based architecture.
 * 
 * Key Responsibilities:
 * - Entity creation and destruction (add/remove)
 * - Entity type registration and instantiation
 * - Component registration and management
 * - Player tracking (both local and remote)
 * - Entity lookup and iteration
 * - Entity lifecycle events (add/remove/modify)
 * - Hot update tracking (entities that need update() called each frame)
 * 
 * Entity Types:
 * - GenericEntity: Base entity for props, items, etc.
 * - PlayerEntity: Base player (server-side)
 * - PlayerLocal: Local player with input handling (client-side)
 * - PlayerRemote: Remote networked players (client-side)
 * - MobEntity: Enemy creatures with AI
 * - NPCEntity: Non-hostile characters with dialogue
 * 
 * Component System:
 * Entities can have components attached for modular functionality:
 * - CombatComponent: Health, attack, defense
 * - DataComponent: Custom entity data storage
 * - InteractionComponent: Player interaction handlers
 * - StatsComponent: Numeric stats (level, XP, etc.)
 * - UsageComponent: Item usage/consumption logic
 * - VisualComponent: 3D model, materials, animations
 * 
 * Network Synchronization:
 * - Server creates entities and broadcasts to clients
 * - Clients receive entityAdded/entityModified/entityRemoved packets
 * - Entity state is serialized and replicated across network
 * 
 * Usage:
 * ```typescript
 * // Create entity
 * const entity = world.entities.add({
 *   id: 'tree1',
 *   type: 'entity',
 *   position: { x: 10, y: 0, z: 5 }
 * });
 * 
 * // Get entity
 * const tree = world.entities.get('tree1');
 * 
 * // Remove entity
 * world.entities.remove('tree1');
 * ```
 * 
 * Runs on: Both client and server
 * Used by: All systems that deal with entities
 * References: Entity.ts, PlayerEntity.ts, MobEntity.ts, NPCEntity.ts
 */

import { Entity } from '../entities/Entity';
import { PlayerLocal } from '../entities/PlayerLocal';
import { PlayerRemote } from '../entities/PlayerRemote';
import { PlayerEntity } from '../entities/PlayerEntity';
import type { ComponentDefinition, EntityConstructor, EntityData, Entities as IEntities, Player, World } from '../types/index';
import { EventType } from '../types/events';
import { SystemBase } from './SystemBase';
import { MobEntity } from '../entities/MobEntity';
import { NPCEntity } from '../entities/NPCEntity';
import { ItemEntity } from '../entities/ItemEntity';
import { ResourceEntity } from '../entities/ResourceEntity';
import { HeadstoneEntity } from '../entities/HeadstoneEntity';
import type { MobEntityConfig, NPCEntityConfig, ItemEntityConfig, ResourceEntityConfig } from '../types/entities';
import { EntityType, InteractionType, MobAIState, NPCType, ItemRarity, ResourceType } from '../types/entities';
import { getMobById } from '../data/mobs';
import { NPCBehavior, NPCState } from '../types/core';

/**
 * GenericEntity - Simple entity implementation for non-specialized entities.
 * Used for props, decorations, ground items, and other basic world objects.
 */
class GenericEntity extends Entity {
  constructor(world: World, data: EntityData, local?: boolean) {
    super(world, data, local);
  }
}

/**
 * Entity type registry - maps type strings to entity constructors.
 * New entity types can be registered at runtime via registerEntityType().
 */
const EntityTypes: Record<string, EntityConstructor> = {
  entity: GenericEntity,
  player: PlayerEntity,        // Server-side player entity
  playerLocal: PlayerLocal,     // Client-side local player
  playerRemote: PlayerRemote,   // Client-side remote players
  item: ItemEntity as unknown as EntityConstructor,             // Ground items
  mob: MobEntity as unknown as EntityConstructor,               // Enemy entities
  npc: NPCEntity as unknown as EntityConstructor,               // NPC entities
  resource: ResourceEntity as unknown as EntityConstructor,     // Resource entities (trees, rocks, etc)
  headstone: HeadstoneEntity as unknown as EntityConstructor,   // Death markers
};

/**
 * Entities System - Central entity registry and lifecycle manager.
 * 
 * Manages all entities in the world including players, mobs, NPCs, and props.
 * Provides component-based architecture for modular entity functionality.
 */
export class Entities extends SystemBase implements IEntities {
  items: Map<string, Entity>;
  players: Map<string, Player>;
  player?: Player;
  apps: Map<string, Entity>;
  private hot: Set<Entity>;
  private removed: string[];
  private componentRegistry = new Map<string, ComponentDefinition>();

  constructor(world: World) {
    super(world, { name: 'entities', dependencies: { required: [], optional: [] }, autoCleanup: true });
    this.items = new Map();
    this.players = new Map();
    this.player = undefined;
    this.apps = new Map();
    this.hot = new Set();
    this.removed = [];
  }

  get(id: string): Entity | null {
    return this.items.get(id) || null;
  }

  values(): IterableIterator<Entity> {
    return this.items.values();
  }

  getPlayer(entityId: string): Player | null {
    const player = this.players.get(entityId);
    if (!player) {
      // Don't throw - return null for disconnected players
      // This allows systems to gracefully handle missing players
      return null;
    }
    return player;
  }

  registerComponentType(definition: ComponentDefinition): void {
    this.componentRegistry.set(definition.type, definition);
  }
  
  getComponentDefinition(type: string): ComponentDefinition | undefined {
    return this.componentRegistry.get(type);
  }
  
  // TypeScript-specific methods for interface compliance
  has(entityId: string): boolean {
    return this.items.has(entityId);
  }

  set(entityId: string, entity: Entity): void {
    this.items.set(entityId, entity);
    if (entity.isPlayer) {
      this.players.set(entityId, entity as Player);
    }
  }

  create(name: string, options?: Partial<EntityData> & { type?: string }): Entity {
    const data: EntityData = {
      id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: options?.type || 'entity',
      name,
      ...options
    };
    return this.add(data, true);
  }

  add(data: EntityData, local?: boolean): Entity {
    // Check if entity already exists to prevent duplicates
    const existingEntity = this.items.get(data.id);
    if (existingEntity) {
      console.warn(`[Entities] Entity ${data.id} already exists, skipping duplicate creation`);
      return existingEntity;
    }

    let EntityClass: EntityConstructor;
    
    if (data.type === 'player') {
      // Check if we're on the server
      const network = this.world.network || this.world.getSystem('network');
      const isServer = network?.isServer === true;
      
      if (isServer) {
        // On server, always use the base player entity type
        EntityClass = EntityTypes.player;
        console.log(`[Entities] Creating server player entity: ${data.id}`);
      } else {
        // On client, determine if local or remote based on ownership
        const isLocal = data.owner === network?.id;
        EntityClass = EntityTypes[isLocal ? 'playerLocal' : 'playerRemote'];
        console.log(`[Entities] Creating ${isLocal ? 'LOCAL' : 'REMOTE'} player entity: ${data.id}, owner: ${data.owner}, networkId: ${network?.id}`);
      }
    } else if (data.type === 'mob') {
      // Client-side: build a real MobEntity from snapshot data so models load
      const positionArray = (data.position || [0, 0, 0]) as [number, number, number];
      const quaternionArray = (data.quaternion || [0, 0, 0, 1]) as [number, number, number, number];
      // Derive mobType from name: "Mob: goblin (Lv1)" -> goblin
      const name = data.name || 'Mob';
      const mobTypeMatch = name.match(/Mob:\s*([^()]+)/i);
      const derivedMobType = (mobTypeMatch ? mobTypeMatch[1].trim() : name).toLowerCase().replace(/\s+/g, '_');
      const mobData = getMobById(derivedMobType);
      const modelPath = mobData?.modelPath || null;
      

      const mobConfig: MobEntityConfig = {
        id: data.id,
        name: name,
        type: EntityType.MOB,
        position: { x: positionArray[0], y: positionArray[1], z: positionArray[2] },
        rotation: { x: quaternionArray[0], y: quaternionArray[1], z: quaternionArray[2], w: quaternionArray[3] },
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
        interactable: true,
        interactionType: InteractionType.ATTACK,
        interactionDistance: 5,
        description: name,
        model: modelPath,
        // Minimal required MobEntity fields with sensible defaults
        mobType: derivedMobType, // Mob ID from mobs.json
        level: 1,
        currentHealth: 100,
        maxHealth: 100,
        attackPower: 10,
        defense: 2,
        attackSpeed: 1.5,
        moveSpeed: 3.0, // Walking speed (matches player walk)
        aggroRange: 15.0, // 15 meters detection range
        combatRange: 1.5, // 1.5 meters melee range
        xpReward: 10,
        lootTable: [],
        respawnTime: 300000,
        spawnPoint: { x: positionArray[0], y: positionArray[1], z: positionArray[2] },
        aiState: MobAIState.IDLE,
        lastAttackTime: 0,
        properties: {
          movementComponent: null,
          combatComponent: null,
          healthComponent: null,
          visualComponent: null,
          health: { current: 100, max: 100 },
          level: 1,
        },
        targetPlayerId: null,
        deathTime: null,
      };

      // Construct specialized mob entity so it can load its 3D model on the client
      // MobEntityConfig is compatible with MobEntity constructor
      const entity = new MobEntity(this.world, mobConfig);
      this.items.set(entity.id, entity);

      // Initialize entity if it has an init method
      if (entity.init) {
        (entity.init() as Promise<void>)?.catch(err => this.logger.error(`Entity ${entity.id} async init failed`, err));
      }

      return entity;
    } else if (data.type === 'item') {
      // Client-side: build a real ItemEntity from snapshot data so models load
      const positionArray = (data.position || [0, 0, 0]) as [number, number, number];
      const quaternionArray = (data.quaternion || [0, 0, 0, 1]) as [number, number, number, number];
      const name = data.name || 'Item';
      
      // Extract itemId from network data (ItemEntity.getNetworkData() puts it at top level)
      const networkData = data as Record<string, unknown>;
      const itemId = (networkData.itemId as string) || data.id;
      const itemType = (networkData.itemType as string) || 'misc';
      const quantity = (networkData.quantity as number) || 1;
      const stackable = (networkData.stackable as boolean) || false;
      const value = (networkData.value as number) || 0;
      const weight = (networkData.weight as number) || 0;
      const rarity = (networkData.rarity as string) || 'common';
      const modelPath = (networkData.model as string) || null;

      const itemConfig: ItemEntityConfig = {
        id: data.id,
        name: name,
        type: EntityType.ITEM,
        position: { x: positionArray[0], y: positionArray[1], z: positionArray[2] },
        rotation: { x: quaternionArray[0], y: quaternionArray[1], z: quaternionArray[2], w: quaternionArray[3] },
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
        interactable: true,
        interactionType: InteractionType.PICKUP,
        interactionDistance: 2,
        description: name,
        model: modelPath,
        // ItemEntityConfig required fields
        itemId: itemId,
        itemType: itemType,
        quantity: quantity,
        stackable: stackable,
        value: value,
        weight: weight,
        rarity: (rarity as ItemRarity) || ItemRarity.COMMON,
        stats: {},
        requirements: { level: 1 },
        effects: [],
        armorSlot: null,
        examine: '',
        modelPath: modelPath || '',
        iconPath: '',
        healAmount: 0,
        properties: {
          movementComponent: null,
          combatComponent: null,
          healthComponent: null,
          visualComponent: null,
          health: { current: 1, max: 1 },
          level: 1,
          // ItemEntityProperties required fields
          itemId: itemId,
          harvestable: false,
          dialogue: [],
          quantity: quantity,
          stackable: stackable,
          value: value,
          weight: weight,
          rarity: (rarity as ItemRarity) || ItemRarity.COMMON,
        },
      };

      const entity = new ItemEntity(this.world, itemConfig);
      this.items.set(entity.id, entity);

      // Initialize entity if it has an init method
      if (entity.init) {
        (entity.init() as Promise<void>)?.catch(err => this.logger.error(`Entity ${entity.id} async init failed`, err));
      }

      return entity;
    } else if (data.type === 'npc') {
      // Client-side: build a real NPCEntity from snapshot data so models load
      const positionArray = (data.position || [0, 0, 0]) as [number, number, number];
      const quaternionArray = (data.quaternion || [0, 0, 0, 1]) as [number, number, number, number];
      // Derive npcType from name: "Bank: Bank Clerk Niles" -> bank, "Store: General Store Owner Mara" -> store
      const name = data.name || 'NPC';
      const npcTypeMatch = name.match(/^(Bank|Store|Trainer|Quest):/i);
      let derivedNPCType: NPCType = NPCType.QUEST_GIVER;
      if (npcTypeMatch) {
        const prefix = npcTypeMatch[1].toLowerCase();
        if (prefix === 'bank') derivedNPCType = NPCType.BANK;
        else if (prefix === 'store') derivedNPCType = NPCType.STORE;
        else if (prefix === 'trainer') derivedNPCType = NPCType.TRAINER;
      }

      const npcConfig: NPCEntityConfig = {
        id: data.id,
        name: name,
        type: EntityType.NPC,
        position: { x: positionArray[0], y: positionArray[1], z: positionArray[2] },
        rotation: { x: quaternionArray[0], y: quaternionArray[1], z: quaternionArray[2], w: quaternionArray[3] },
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
        interactable: true,
        interactionType: InteractionType.TALK,
        interactionDistance: 3,
        description: name,
        model: null, // NPCs don't have models generated yet
        // Minimal required NPCEntity fields
        npcType: derivedNPCType,
        npcId: data.id,
        dialogueLines: ['Hello there!'],
        services: [],
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
            spawnPoint: { x: positionArray[0], y: positionArray[1], z: positionArray[2] },
            wanderRadius: 0,
            aggroRange: 0,
            isHostile: false,
            combatLevel: 1,
            aggressionLevel: 0,
            dialogueLines: ['Hello there!'],
            dialogue: null,
            services: []
          },
          dialogue: [],
          shopInventory: [],
          questGiver: false
        }
      };

      // Construct specialized NPC entity so it can load its 3D model on the client when available
      // NPCEntityConfig is compatible with NPCEntity constructor
      const entity = new NPCEntity(this.world, npcConfig);
      this.items.set(entity.id, entity);

      // Initialize entity if it has an init method
      if (entity.init) {
        (entity.init() as Promise<void>)?.catch(err => this.logger.error(`Entity ${entity.id} async init failed`, err));
      }

      return entity;
    } else if (data.type === 'resource') {
      // Client-side: build a real ResourceEntity from snapshot data
      const positionArray = (data.position || [0, 0, 0]) as [number, number, number];
      const quaternionArray = (data.quaternion || [0, 0, 0, 1]) as [number, number, number, number];

      const resourceConfig: ResourceEntityConfig = {
        id: data.id,
        name: data.name || 'Resource',
        type: EntityType.RESOURCE,
        position: { x: positionArray[0], y: positionArray[1], z: positionArray[2] },
        rotation: { x: quaternionArray[0], y: quaternionArray[1], z: quaternionArray[2], w: quaternionArray[3] },
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
        interactable: true,
        interactionType: InteractionType.GATHER,
        interactionDistance: (data as { interactionDistance?: number }).interactionDistance || 3,
        description: (data as { description?: string }).description || 'A resource',
        model: (data as { model?: string }).model || null,
        properties: {
          movementComponent: null,
          combatComponent: null,
          healthComponent: null,
          visualComponent: null,
          health: { current: 1, max: 1 },
          level: 1,
          resourceType: ResourceType.TREE,
          harvestable: true,
          respawnTime: 60000,
          toolRequired: 'none',
          skillRequired: 'none',
          xpReward: 10
        },
        resourceType: (data as { resourceType?: string }).resourceType === 'tree' ? ResourceType.TREE : 
                      (data as { resourceType?: string }).resourceType === 'fishing_spot' ? ResourceType.FISHING_SPOT :
                      (data as { resourceType?: string }).resourceType === 'mining_rock' ? ResourceType.MINING_ROCK : ResourceType.TREE,
        resourceId: (data as { resourceId?: string }).resourceId || 'normal_tree',
        harvestSkill: (data as { harvestSkill?: string }).harvestSkill || 'woodcutting',
        requiredLevel: (data as { requiredLevel?: number }).requiredLevel || 1,
        harvestTime: (data as { harvestTime?: number }).harvestTime || 3000,
        harvestYield: (data as { harvestYield?: Array<{ itemId: string; quantity: number; chance: number }> }).harvestYield || [],
        respawnTime: (data as { respawnTime?: number }).respawnTime || 60000,
        depleted: (data as { depleted?: boolean }).depleted || false,
        lastHarvestTime: 0
      };

      const entity = new ResourceEntity(this.world, resourceConfig);
      this.items.set(entity.id, entity);

      // Initialize entity
      if (entity.init) {
        (entity.init() as Promise<void>)?.catch(err => this.logger.error(`Entity ${entity.id} async init failed`, err));
      }

      return entity;
    } else if (data.type in EntityTypes) {
      EntityClass = EntityTypes[data.type];
    } else {
      EntityClass = EntityTypes.entity;
    }

    // All entity constructors now accept EntityData
    const entity = new EntityClass(this.world, data, local);
    this.items.set(entity.id, entity);

    if (data.type === 'player') {
      this.players.set(entity.id, entity as Player);
      
      const network = this.world.network || this.world.getSystem('network');
      
      // On client, emit enter events for remote players
      if (network?.isClient && data.owner !== network.id) {
        this.emitTypedEvent('PLAYER_JOINED', { playerId: entity.id, player: entity as PlayerLocal });
      }
      
      // On server, emit PLAYER_REGISTERED for all player entities
      if (network?.isServer) {
        console.log(`[Entities] Server emitting PLAYER_REGISTERED for ${entity.id}`)
        this.emitTypedEvent('PLAYER_REGISTERED', { playerId: entity.id });
        this.world.emit(EventType.PLAYER_REGISTERED, { playerId: entity.id });
      }
      
      // Set local player if this entity is owned by us
      if (data.owner === network?.id) {
        console.log(`[Entities] Setting LOCAL PLAYER: ${entity.id} (was: ${this.player?.id || 'none'})`);
        console.log(`[Entities] About to initialize local player entity...`);
        if (this.player) {
          console.warn(`[Entities] WARNING: Replacing existing local player ${this.player.id} with ${entity.id}!`);
        }
        this.player = entity as Player;
        this.emitTypedEvent('PLAYER_REGISTERED', { playerId: entity.id });
      }
    }

    // Initialize the entity
    console.log(`[Entities] Calling init() for entity ${entity.id} (type: ${data.type})`);
    const initPromise = entity.init() as Promise<void>;
    if (initPromise) {
      initPromise
        .then(() => {
          console.log(`[Entities] Entity ${entity.id} init() completed successfully`);
        })
        .catch(err => {
          this.logger.error(`Entity ${entity.id} (type: ${data.type}) async init failed:`, err);
          console.error(`[Entities] Entity ${entity.id} init() failed:`, err);
        });
    } else {
      console.log(`[Entities] Entity ${entity.id} has no async init() or it returned void`);
    }

    return entity;
  }

  remove(id: string): boolean {
    const entity = this.items.get(id);
    if (!entity) {
      this.logger.warn(`Tried to remove entity that did not exist: ${id}`);
      return false;
    }
    
    if (entity.isPlayer) {
      this.players.delete(entity.id);
      this.emitTypedEvent('PLAYER_LEFT', { playerId: entity.id });
    }
    
    entity.destroy(true);
    this.items.delete(id);
    this.removed.push(id);
    return true;
  }

  // TypeScript interface compliance method
  destroyEntity(entityId: string): boolean {
    return this.remove(entityId);
  }

  setHot(entity: Entity, hot: boolean): void {
    if (hot) {
      this.hot.add(entity);
    } else {
      this.hot.delete(entity);
    }
  }

  override fixedUpdate(delta: number): void {
    const hotEntities = Array.from(this.hot);
    for (const entity of hotEntities) {
      entity.fixedUpdate?.(delta);
    }
  }

  override update(delta: number): void {
    const hotEntities = Array.from(this.hot);
    for (const entity of hotEntities) {
      entity.update(delta);
    }
  }

  override lateUpdate(delta: number): void {
    const hotEntities = Array.from(this.hot);
    for (const entity of hotEntities) {
      entity.lateUpdate?.(delta);
    }
  }

  serialize(): EntityData[] {
    const data: EntityData[] = [];
    this.items.forEach(entity => {
      data.push(entity.serialize());
    });
    return data;
  }

  async deserialize(datas: EntityData[]): Promise<void> {
    console.log(`[Entities] deserialize() called with ${datas.length} entities`);
    const entityTypes = datas.map(d => `${d.type}:${d.id}`);
    console.log('[Entities] Entity types to deserialize:', entityTypes);
    
    const playerEntities = datas.filter(d => d.type === 'player');
    console.log(`[Entities] Found ${playerEntities.length} player entities in snapshot`);
    if (playerEntities.length > 0) {
      playerEntities.forEach(p => {
        console.log(`[Entities] Player entity: ${p.id}, owner: ${p.owner}`);
      });
    }
    
    for (const data of datas) {
      this.add(data);
    }
    
    console.log('[Entities] deserialize() complete');
  }

  override destroy(): void {
    // Create array of IDs to avoid modifying map while iterating
    const entityIds = Array.from(this.items.keys());
    for (const id of entityIds) {
      this.remove(id);
    }
    
    this.items.clear();
    this.players.clear();
    this.hot.clear();
    this.removed = [];
  }

  // TypeScript interface compliance methods
  getLocalPlayer(): Player | null {
    return this.player || null;
  }

  getAll(): Entity[] {
    return Array.from(this.items.values());
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  // Alias for World.ts compatibility
  getPlayers(): Player[] {
    return this.getAllPlayers();
  }

  getRemovedIds(): string[] {
    const ids = [...new Set(this.removed)]; // Remove duplicates
    this.removed = [];
    return ids;
  }
  
  // Missing lifecycle methods
  postFixedUpdate(): void {
    // Add postLateUpdate calls for entities
    const hotEntities = Array.from(this.hot);
    for (const entity of hotEntities) {
      entity.postLateUpdate?.(0);
    }
  }
} 