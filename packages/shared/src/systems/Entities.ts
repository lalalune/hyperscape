import { Entity } from '../entities/Entity';
import { PlayerLocal } from '../entities/PlayerLocal';
import { PlayerRemote } from '../entities/PlayerRemote';
import { PlayerEntity } from '../entities/PlayerEntity';
import type { ComponentDefinition, EntityConstructor, EntityData, Entities as IEntities, Player, World } from '../types/index';
import { EventType } from '../types/events';
import { SystemBase } from './SystemBase';
import { MobEntity } from '../entities/MobEntity';
import { NPCEntity } from '../entities/NPCEntity';
import type { MobEntityConfig, NPCEntityConfig, PlayerEntityData } from '../types/entities';
import { EntityType, InteractionType, MobAIState, NPCType } from '../types/entities';
import { getMobById } from '../data/mobs';
import type { MobEntityData } from '../types/core';
// import { ServerNetwork } from './ServerNetwork'; // ServerNetwork moved to server package

// ComponentDefinition interface moved to shared types



// EntityConstructor interface moved to shared types

// Simple entity implementation that uses the base Entity class directly
class GenericEntity extends Entity {
  constructor(world: World, data: EntityData, local?: boolean) {
    super(world, data, local);
  }
}

// Entity type registry
const EntityTypes: Record<string, EntityConstructor> = {
  entity: GenericEntity,
  player: PlayerEntity as unknown as EntityConstructor,  // Base player entity for server (cast due to PlayerEntityData requirements)
  playerLocal: PlayerLocal,  // Client-only: local player
  playerRemote: PlayerRemote,  // Client-only: remote players
};

/**
 * Entities System
 *
 * - Runs on both the server and client.
 * - Supports inserting entities into the world
 * - Executes entity scripts
 *
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
      // CRITICAL: Server should NEVER use PlayerLocal or PlayerRemote - those are client-only!
      // Check if we're on the server by looking for ServerNetwork system
      const serverNetwork = this.world.getSystem('network') as { isServer?: boolean } | null;
      const isServerWorld = serverNetwork?.isServer === true;
      
      
      if (isServerWorld) {
        // On server, always use the base player entity type
        EntityClass = EntityTypes['player'] || EntityTypes.entity;
        console.log(`[Entities] Creating server player entity: ${data.id}`);
      } else {
        // On client, determine if local or remote
        type NetworkWithId = { id?: string }
        const networkId = this.world.network?.id || (this.world.getSystem('network') as NetworkWithId)?.id;
        const isLocal = data.owner === networkId;
        EntityClass = EntityTypes[isLocal ? 'playerLocal' : 'playerRemote'];
        console.log(`[Entities] Creating ${isLocal ? 'LOCAL' : 'REMOTE'} player entity: ${data.id}, owner: ${data.owner}, networkId: ${networkId}`);
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
      
      // Use model path from manifest data, or null if not found (will use fallback mesh)
      const modelPath = (mobData && typeof mobData.modelPath === 'string' && mobData.modelPath.length > 0)
        ? mobData.modelPath
        : null; // No fallback path - if not in manifest, use fallback mesh
      
      console.log(`[Entities] CLIENT creating MobEntity from snapshot:`, {
        id: data.id,
        name: name,
        derivedMobType,
        foundInDB: !!mobData,
        hasModelPath: !!modelPath,
        modelPath,
        position: positionArray
      });

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
        mobType: derivedMobType as unknown as import('../types/entities').MobType,
        level: 1,
        currentHealth: 100,
        maxHealth: 100,
        attackPower: 10,
        defense: 2,
        attackSpeed: 1.5,
        moveSpeed: 5,
        aggroRange: 10,
        combatRange: 2,
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
      // Use type cast to bypass constructor signature mismatch at compile time
      // eslint-disable-next-line no-undef
      const entity = new MobEntity(this.world, mobConfig as unknown as MobEntityData);
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
      
      // For now, NPCs don't have models generated yet - use fallback
      // Once models are generated, they'll be loaded via modelPath
      const modelPath = null; // Will be set when models are generated in 3D Asset Forge

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
        model: modelPath,
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
            behavior: 'friendly' as unknown as import('../types/core').NPCBehavior,
            state: 'idle' as unknown as import('../types/core').NPCState,
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
      // Use type cast to bypass constructor signature mismatch at compile time
      // eslint-disable-next-line no-undef
      const entity = new NPCEntity(this.world, npcConfig as unknown as NPCEntityData);
      this.items.set(entity.id, entity);

      // Initialize entity if it has an init method
      if (entity.init) {
        (entity.init() as Promise<void>)?.catch(err => this.logger.error(`Entity ${entity.id} async init failed`, err));
      }

      return entity;
    } else if (data.type in EntityTypes) {
      EntityClass = EntityTypes[data.type];
    } else {
      EntityClass = EntityTypes.entity;
    }

    // Cast data to appropriate type for player entities
    // eslint-disable-next-line no-undef
    const entity = data.type === 'player' 
      ? new EntityClass(this.world, data as unknown as PlayerEntityData, local)
      : new EntityClass(this.world, data, local);
    this.items.set(entity.id, entity);

    if (data.type === 'player') {
      this.players.set(entity.id, entity as Player);
      
      // On the client, remote players emit enter events here.
      // On the server, enter events are delayed for players entering until after their snapshot is sent
      // so they can respond correctly to follow-through events.
      const network = this.world.network || this.world.getSystem('network');
      if (network?.isClient) {
        type NetworkWithId = { id?: string }
        const netId = network.id || (network as NetworkWithId)?.id;
        if (data.owner !== netId) {
          this.emitTypedEvent('PLAYER_JOINED', { playerId: entity.id, player: entity as PlayerLocal });
        }
      }
      
      // On server, emit PLAYER_REGISTERED for all player entities so systems can initialize
      if (network?.isServer) {
        console.log(`[Entities] Server emitting PLAYER_REGISTERED for ${entity.id}`)
        this.emitTypedEvent('PLAYER_REGISTERED', { playerId: entity.id });
        // Also emit via world to ensure event reaches all systems
        this.world.emit(EventType.PLAYER_REGISTERED, { playerId: entity.id });
      }
    }

    // Strong type assumption - world has network system when dealing with owned entities
    type NetworkWithId = { id?: string }
    const currentNetworkId = this.world.network?.id || (this.world.getSystem('network') as NetworkWithId)?.id;
    if (data.owner === currentNetworkId) {
      console.log(`[Entities] Setting LOCAL PLAYER: ${entity.id} (was: ${this.player?.id || 'none'})`);
      if (this.player) {
        console.warn(`[Entities] WARNING: Replacing existing local player ${this.player.id} with ${entity.id}!`);
      }
      this.player = entity as Player;
      this.emitTypedEvent('PLAYER_REGISTERED', { playerId: entity.id });
    }

    // Initialize the entity if it has an init method
    if (entity.init) {
      (entity.init() as Promise<void>)?.catch(err => this.logger.error(`Entity ${entity.id} async init failed`, err));
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
      try {
        entity.update?.(delta);
      } catch (error) {
        // Strong type assumption - error is Error type
        const err = error as Error;
        this.logger.error(`Error updating entity ${entity.id || 'unknown'}: ${err.message || String(error)}`);
        throw error;
      }
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
    for (const data of datas) {
      this.add(data);
    }
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