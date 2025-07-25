/**
 * RPGEntityManager - Manages all RPG entities in the world
 * 
 * This system is responsible for:
 * - Creating and destroying entities
 * - Managing entity lifecycle
 * - Network synchronization
 * - Entity queries and lookups
 */

import { System } from '../../core/systems/System';
import { RPGEntity, RPGEntityConfig, EntityWorld } from '../entities/RPGEntity';
import { ItemEntity, ItemEntityConfig } from '../entities/ItemEntity';
import { MobEntity, MobEntityConfig } from '../entities/MobEntity';
import { ResourceEntity, ResourceEntityConfig } from '../entities/ResourceEntity';
import { NPCEntity, NPCEntityConfig } from '../entities/NPCEntity';

export interface EntitySpawnRequest {
  type: 'item' | 'mob' | 'npc' | 'resource' | 'static';
  config: RPGEntityConfig;
}

export class RPGEntityManager extends System {
  private entities = new Map<string, RPGEntity>();
  private entitiesNeedingUpdate = new Set<string>();
  private networkDirtyEntities = new Set<string>();
  private entityWorld: EntityWorld;
  private nextEntityId = 1;

  constructor(world: any) {
    super(world);
    
    // Create entity world interface
    this.entityWorld = {
      isServer: world.isServer || false,
      isClient: world.isClient || false,
      getTime: () => Date.now(),
      getPlayer: (playerId?: string) => world.getPlayer?.(playerId),
      getPlayers: () => world.getPlayers?.() || [],
      emit: (event: string, data?: any) => world.emit?.(event, data),
      on: (event: string, callback: (data?: any) => void) => world.on?.(event, callback),
      off: (event: string, callback: (data?: any) => void) => world.off?.(event, callback),
      stage: world.stage,
      loader: world.loader,
      terrain: world.terrain
    };
  }

  async init(): Promise<void> {
    console.log('[RPGEntityManager] Initializing entity management system...');
    
    // Register world name
    this.world['rpg-entity-manager'] = this;
    
    // Listen for entity spawn/destroy requests
    this.world.on('entity:spawn', this.handleEntitySpawn.bind(this));
    this.world.on('entity:destroy', this.handleEntityDestroy.bind(this));
    this.world.on('entity:interact', this.handleInteractionRequest.bind(this));
    this.world.on('entity:move_request', this.handleMoveRequest.bind(this));
    this.world.on('entity:property_request', this.handlePropertyRequest.bind(this));
    
    // Listen for specific entity type spawn requests
    this.world.on('item:spawn', this.handleItemSpawn.bind(this));
    this.world.on('item:pickup', this.handleItemPickup.bind(this));
    this.world.on('mob:spawn', this.handleMobSpawn.bind(this));
    this.world.on('mob:attacked', this.handleMobAttacked.bind(this));
    this.world.on('mob:attack', this.handleMobAttack.bind(this));
    this.world.on('resource:spawn', this.handleResourceSpawn.bind(this));
    this.world.on('resource:harvest', this.handleResourceHarvest.bind(this));
    this.world.on('npc:spawn', this.handleNPCSpawn.bind(this));
    this.world.on('npc:dialogue', this.handleNPCDialogue.bind(this));
    
    // Network sync for clients
    if (this.world.isClient) {
      this.world.on('client:connect', this.handleClientConnect.bind(this));
      this.world.on('client:disconnect', this.handleClientDisconnect.bind(this));
    }
    
    console.log('[RPGEntityManager] Entity manager initialized');
  }

  update(deltaTime: number): void {
    // Update all entities that need updates
    this.entitiesNeedingUpdate.forEach(entityId => {
      const entity = this.entities.get(entityId);
      if (entity) {
        entity.update(deltaTime);
      }
    });
    
    // Send network updates
    if (this.world.isServer && this.networkDirtyEntities.size > 0) {
      this.sendNetworkUpdates();
    }
  }

  fixedUpdate(deltaTime: number): void {
    // Fixed update for physics
    this.entities.forEach(entity => {
      entity.fixedUpdate(deltaTime);
    });
  }

  async spawnEntity(config: RPGEntityConfig): Promise<RPGEntity | null> {
    // Generate entity ID if not provided
    if (!config.id) {
      config.id = `entity_${this.nextEntityId++}`;
    }
    
    console.log(`[RPGEntityManager] Spawning ${config.type} entity: ${config.id}`);
    
    let entity: RPGEntity;
    
    // Create appropriate entity type
    switch (config.type) {
      case 'item':
        entity = new ItemEntity(this.entityWorld, config as ItemEntityConfig);
        break;
      case 'mob':
        entity = new MobEntity(this.entityWorld, config as MobEntityConfig);
        break;
      case 'resource':
        entity = new ResourceEntity(this.entityWorld, config as ResourceEntityConfig);
        break;
      case 'npc':
        entity = new NPCEntity(this.entityWorld, config as NPCEntityConfig);
        break;
      default:
        console.error(`[RPGEntityManager] Unknown entity type: ${config.type}`);
        return null;
    }
    
    // Initialize entity
    await entity.init();
    
    // Store entity
    this.entities.set(config.id, entity);
    this.entitiesNeedingUpdate.add(config.id);
    
    // Mark for network sync
    if (this.world.isServer) {
      this.networkDirtyEntities.add(config.id);
    }
    
    // Emit spawn event
    this.world.emit('entity:spawned', {
      entityId: config.id,
      entityType: config.type,
      entityData: entity.getNetworkData()
    });
    
    console.log(`[RPGEntityManager] Successfully spawned ${config.type} entity: ${config.id}`);
    return entity;
  }

  destroyEntity(entityId: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    
    console.log(`[RPGEntityManager] Destroying entity: ${entityId}`);
    
    // Call entity destroy method
    entity.destroy();
    
    // Remove from tracking
    this.entities.delete(entityId);
    this.entitiesNeedingUpdate.delete(entityId);
    this.networkDirtyEntities.delete(entityId);
    
    // Emit destroy event
    this.world.emit('entity:destroyed', {
      entityId,
      entityType: entity.type
    });
    
    return true;
  }

  getEntity(entityId: string): RPGEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get all entities of a specific type
   */
  getEntitiesByType(type: string): RPGEntity[] {
    return Array.from(this.entities.values()).filter(entity => entity.type === type);
  }

  /**
   * Get entities within range of a position
   */
  getEntitiesInRange(center: { x: number; y: number; z: number }, range: number, type?: string): RPGEntity[] {
    return Array.from(this.entities.values()).filter(entity => {
      if (type && entity.type !== type) return false;
      const distance = entity.getDistanceTo(center);
      return distance <= range;
    });
  }

  private async handleEntitySpawn(data: EntitySpawnRequest): Promise<void> {
    await this.spawnEntity(data.config);
  }

  private handleEntityDestroy(data: { entityId: string }): void {
    this.destroyEntity(data.entityId);
  }

  private async handleInteractionRequest(data: any): Promise<void> {
    const entity = this.entities.get(data.entityId);
    if (!entity) {
      console.warn(`[RPGEntityManager] Entity not found: ${data.entityId}`);
      return;
    }
    await entity.handleInteraction(data);
  }

  private handleMoveRequest(data: any): void {
    const entity = this.entities.get(data.entityId);
    if (!entity) {
      console.warn(`[RPGEntityManager] Entity not found: ${data.entityId}`);
      return;
    }
    entity.setPosition(data.position.x, data.position.y, data.position.z);
  }

  private handlePropertyRequest(data: any): void {
    const entity = this.entities.get(data.entityId);
    if (!entity) {
      console.warn(`[RPGEntityManager] Entity not found: ${data.entityId}`);
      return;
    }
    entity.setProperty(data.key, data.value);
  }

  private async handleItemSpawn(data: any): Promise<void> {
    const config: RPGEntityConfig = {
      id: data.customId || `item_${this.nextEntityId++}`,
      name: data.name || 'Item',
      type: 'item',
      position: data.position || { x: 0, y: 0, z: 0 },
      interactable: true,
      interactionType: 'pickup',
      interactionDistance: 2,
      model: data.model,
      properties: {
        itemId: data.id,
        quantity: data.quantity || 1,
        stackable: data.stackable !== false,
        value: data.value || 0,
        weight: this.getItemWeight(data.id),
        rarity: this.getItemRarity(data.id),
        ...data
      }
    };
    
    await this.spawnEntity(config);
  }

  private handleItemPickup(data: any): void {
    const entity = this.entities.get(data.entityId);
    if (!entity) {
      console.warn(`[RPGEntityManager] Cannot pickup entity ${data.entityId} - not found`);
      return;
    }
    
    // Get properties before destroying
    const itemId = entity.getProperty('itemId');
    const quantity = entity.getProperty('quantity');
    
    this.destroyEntity(data.entityId);
    
    this.world.emit('item:picked_up', {
      playerId: data.playerId,
      item: itemId,
      quantity: quantity
    });
  }

  private async handleMobSpawn(data: any): Promise<void> {
    const position = data.position || { x: 0, y: 0, z: 0 };
    
    const config: MobEntityConfig = {
      id: data.customId || `mob_${this.nextEntityId++}`,
      name: data.name || data.mobType || 'Mob',
      type: 'mob',
      position: position,
      interactable: true,
      interactionType: 'attack',
      interactionDistance: data.attackRange || 5,
      model: data.model,
      // MobEntity specific fields
      mobType: data.mobType,
      level: data.level || 1,
      currentHealth: data.health || this.getMobMaxHealth(data.mobType, data.level || 1),
      maxHealth: data.maxHealth || this.getMobMaxHealth(data.mobType, data.level || 1),
      attackPower: this.getMobAttackPower(data.mobType, data.level || 1),
      defense: this.getMobDefense(data.mobType, data.level || 1),
      attackSpeed: this.getMobAttackSpeed(data.mobType),
      moveSpeed: this.getMobMoveSpeed(data.mobType),
      aggroRange: this.getMobAggroRange(data.mobType),
      combatRange: this.getMobCombatRange(data.mobType),
      xpReward: this.getMobXPReward(data.mobType, data.level || 1),
      lootTable: this.getMobLootTable(data.mobType),
      respawnTime: data.respawnTime || 300000, // 5 minutes default
      spawnPoint: position, // This was missing!
      aiState: 'idle',
      lastAttackTime: 0
    };
    
    await this.spawnEntity(config);
  }

  private handleMobAttacked(data: any): void {
    const mob = this.entities.get(data.entityId);
    if (!mob) {
      console.warn(`[RPGEntityManager] Cannot handle mob attacked - entity ${data.entityId} not found`);
      return;
    }
    
    const currentHealth = mob.getProperty('health');
    const newHealth = Math.max(0, currentHealth - data.damage);
    
    mob.setProperty('health', newHealth);
    
    if (newHealth <= 0) {
      this.world.emit('mob:died', {
        entityId: data.entityId,
        killedBy: data.attackerId,
        position: mob.getPosition()
      });
      
      this.destroyEntity(data.entityId);
    }
  }

  private handleMobAttack(data: any): void {
    const mob = this.entities.get(data.mobId);
    if (!mob) {
      console.warn(`[RPGEntityManager] Cannot handle mob attack - entity ${data.mobId} not found`);
      return;
    }
    
    const damage = mob.getProperty('attackPower');
    
    this.world.emit('player:damage', {
      playerId: data.targetId,
      damage,
      source: data.mobId,
      sourceType: 'mob'
    });
  }

  private handleClientConnect(data: { playerId: string }): void {
    // Send all current entities to new client
    const entityData = Array.from(this.entities.values()).map(entity => ({
      type: entity.type,
      data: entity.getNetworkData()
    }));
    
    this.world.emit('client:entity_sync', {
      playerId: data.playerId,
      entities: entityData
    });
  }

  private handleClientDisconnect(data: { playerId: string }): void {
    // Clean up any player-specific entity data
    this.entities.forEach((entity, entityId) => {
      if (entity.getProperty('ownerId') === data.playerId) {
        this.destroyEntity(entityId);
      }
    });
  }

  private sendNetworkUpdates(): void {
    const updates: any[] = [];
    
    this.networkDirtyEntities.forEach(entityId => {
      const entity = this.entities.get(entityId);
      if (entity) {
        updates.push({
          entityId,
          data: entity.getNetworkData()
        });
      }
    });
    
    this.world.emit('network:entity_updates', { updates });
    
    // Clear dirty entities
    this.networkDirtyEntities.clear();
  }

  private getItemType(itemId: string): any {
    // Get item type from data
    return 'misc';
  }

  private isItemStackable(itemId: string): boolean {
    // Check if item is stackable
    return true;
  }

  private getItemValue(itemId: string): number {
    // Get item value
    return 1;
  }

  /**
   * Get item weight - simplified without defensive checks
   */
  private getItemWeight(itemId: string): number {
    // Weight calculation based on item type
    return 1;
  }

  private getItemRarity(itemId: string): any {
    // Get item rarity
    return 'common';
  }

  private getMobMaxHealth(mobType: string, level: number): number {
    // Base health calculation
    const baseHealth = {
      goblin: 30,
      bandit: 40,
      barbarian: 50,
      hobgoblin: 60,
      guard: 80,
      dark_warrior: 100,
      black_knight: 150,
      ice_warrior: 120,
      dark_ranger: 100
    };
    
    return baseHealth[mobType] + (level * 10);
  }

  private getMobAttackPower(mobType: string, level: number): number {
    // Attack power calculation
    const baseAttack = {
      goblin: 5,
      bandit: 8,
      barbarian: 10,
      hobgoblin: 12,
      guard: 15,
      dark_warrior: 20,
      black_knight: 25,
      ice_warrior: 22,
      dark_ranger: 18
    };
    
    return baseAttack[mobType] + (level * 2);
  }

  private getMobDefense(mobType: string, level: number): number {
    // Defense calculation
    const baseDefense = {
      goblin: 2,
      bandit: 3,
      barbarian: 5,
      hobgoblin: 6,
      guard: 10,
      dark_warrior: 12,
      black_knight: 20,
      ice_warrior: 15,
      dark_ranger: 8
    };
    
    return baseDefense[mobType] + level;
  }

  private getMobAttackSpeed(mobType: string): number {
    // Attack speed in attacks per second
    return 1.0;
  }

  private getMobMoveSpeed(mobType: string): number {
    // Movement speed
    const speeds = {
      goblin: 4,
      bandit: 5,
      barbarian: 3,
      hobgoblin: 4,
      guard: 3,
      dark_warrior: 4,
      black_knight: 2.5,
      ice_warrior: 3,
      dark_ranger: 6
    };
    
    return speeds[mobType];
  }

  private getMobAggroRange(mobType: string): number {
    // Aggro detection range
    return 10;
  }

  private getMobCombatRange(mobType: string): number {
    // Combat engagement range
    return 2;
  }

  private getMobXPReward(mobType: string, level: number): number {
    // XP reward calculation
    const baseXP = {
      goblin: 15,
      bandit: 20,
      barbarian: 25,
      hobgoblin: 30,
      guard: 40,
      dark_warrior: 50,
      black_knight: 80,
      ice_warrior: 60,
      dark_ranger: 70
    };
    
    return baseXP[mobType] * level;
  }

  private getMobLootTable(mobType: string): Array<{ itemId: string; chance: number; minQuantity: number; maxQuantity: number }> {
    // Simplified loot tables
    const tables = {
      goblin: [
        { itemId: 'coins', chance: 1.0, minQuantity: 1, maxQuantity: 5 },
        { itemId: 'bronze_sword', chance: 0.1, minQuantity: 1, maxQuantity: 1 }
      ],
      bandit: [
        { itemId: 'coins', chance: 1.0, minQuantity: 5, maxQuantity: 15 },
        { itemId: 'bronze_shield', chance: 0.15, minQuantity: 1, maxQuantity: 1 }
      ],
      barbarian: [
        { itemId: 'coins', chance: 1.0, minQuantity: 8, maxQuantity: 20 },
        { itemId: 'bronze_body', chance: 0.1, minQuantity: 1, maxQuantity: 1 }
      ]
    };
    
    return tables[mobType] || [];
  }

  private async handleResourceSpawn(data: any): Promise<void> {
    const config: RPGEntityConfig = {
      id: data.customId || `resource_${this.nextEntityId++}`,
      name: data.name || 'Resource',
      type: 'resource',
      position: data.position || { x: 0, y: 0, z: 0 },
      interactable: true,
      interactionType: 'gather',
      interactionDistance: 3,
      model: data.model,
      properties: {
        resourceType: data.resourceType,
        harvestable: true,
        respawnTime: data.respawnTime || 60000,
        toolRequired: data.toolRequired,
        skillRequired: data.skillRequired,
        xpReward: data.xpReward || 10,
        ...data
      }
    };
    
    await this.spawnEntity(config);
  }

  private handleResourceHarvest(data: any): void {
    const resource = this.entities.get(data.entityId);
    if (!resource) {
      console.warn(`[RPGEntityManager] Cannot harvest resource - entity ${data.entityId} not found`);
      return;
    }
    
    resource.setProperty('harvestable', false);
    
    // Schedule respawn
    setTimeout(() => {
      if (this.entities.has(data.entityId)) {
        resource.setProperty('harvestable', true);
      }
    }, resource.getProperty('respawnTime'));
  }

  private async handleNPCSpawn(data: any): Promise<void> {
    const config: RPGEntityConfig = {
      id: data.customId || `npc_${this.nextEntityId++}`,
      name: data.name || 'NPC',
      type: 'npc',
      position: data.position || { x: 0, y: 0, z: 0 },
      interactable: true,
      interactionType: 'talk',
      interactionDistance: 3,
      model: data.model,
      properties: {
        dialogue: data.dialogue,
        shopInventory: data.shopInventory,
        questGiver: data.questGiver,
        ...data
      }
    };
    
    await this.spawnEntity(config);
  }

  private handleNPCDialogue(data: any): void {
    const npc = this.entities.get(data.entityId);
    if (!npc) {
      console.warn(`[RPGEntityManager] Cannot start NPC dialogue - entity ${data.entityId} not found`);
      return;
    }
    
    this.world.emit('npc:dialogue_start', {
      playerId: data.playerId,
      npcId: data.entityId,
      dialogue: npc.getProperty('dialogue')
    });
  }

  getDebugInfo(): any {
    return {
      totalEntities: this.entities.size,
      entitiesByType: this.getEntityTypeCount(),
      entitiesNeedingUpdate: this.entitiesNeedingUpdate.size,
      networkDirtyEntities: this.networkDirtyEntities.size
    };
  }

  private getEntityTypeCount(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    this.entities.forEach(entity => {
      counts[entity.type] = (counts[entity.type] || 0) + 1;
    });
    
    return counts;
  }

  destroy(): void {
    // Destroy all entities
    this.entities.forEach(entity => {
      entity.destroy();
    });
    
    this.entities.clear();
    this.entitiesNeedingUpdate.clear();
    this.networkDirtyEntities.clear();
    
    console.log('[RPGEntityManager] Entity manager destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}