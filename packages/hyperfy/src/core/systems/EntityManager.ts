import { System } from './System';
import type { World, Entity } from '../../types/index';
import { Entity as EntityClass } from '../entities/Entity';
import { createComponent, ComponentRegistry } from '../components';

/**
 * EntityManager System
 * 
 * Replaces the Apps system with pure ECS entity management.
 * - Creates and manages entities with components
 * - Handles entity lifecycle (creation, update, destruction)
 * - Provides entity queries and filtering
 * - Entity pooling and recycling for performance
 * - No sandboxing or script restrictions
 */
export class EntityManager extends System {
  private entities: Map<string, Entity>;
  private entitiesByType: Map<string, Set<Entity>>;
  private entitiesByComponent: Map<string, Set<Entity>>;
  private hot: Set<Entity>;
  
  // Entity pooling system for performance optimization
  private entityPools: Map<string, Entity[]>;
  private pooledEntities: Set<string>;
  private maxPoolSize: number;
  private poolHitCount: number;
  private poolMissCount: number;
  
  constructor(world: World) {
    super(world);
    this.entities = new Map();
    this.entitiesByType = new Map();
    this.entitiesByComponent = new Map();
    this.hot = new Set();
    
    // Initialize entity pooling system
    this.entityPools = new Map();
    this.pooledEntities = new Set();
    this.maxPoolSize = 100; // Max entities per type in pool
    this.poolHitCount = 0;
    this.poolMissCount = 0;
    
    console.log('[EntityManager] Pure ECS EntityManager initialized with pooling');
    console.log('[EntityManager] No App framework - direct entity/component access');
    console.log(`[EntityManager] Entity pooling enabled - max pool size: ${this.maxPoolSize}`);
  }
  
  async init(options: any): Promise<void> {
    await super.init(options);
    console.log('[EntityManager] Initialized with pure ECS architecture');
  }
  
  start(): void {
    super.start();
    console.log('[EntityManager] Started - managing entities with components');
  }
  
  // Try to get a pooled entity or create a new one
  private getOrCreateEntity(data: any): Entity {
    const entityType = data.type || 'entity';
    const pool = this.entityPools.get(entityType);
    
    // Try to reuse a pooled entity
    if (pool && pool.length > 0) {
      const entity = pool.pop()!;
      this.poolHitCount++;
      
      // Reset entity to clean state
      entity.removeAllComponents();
      this.pooledEntities.delete(entity.id);
      
      // Update entity properties
      Object.assign(entity, {
        id: data.id || `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name || 'Entity',
        type: entityType,
        position: data.position,
        quaternion: data.quaternion,
        scale: data.scale,
        active: true,
        destroyed: false,
        ...data
      });
      
      console.log(`[EntityManager] Reused pooled entity: ${entity.id} (${entity.type}) - Pool hit`);
      return entity;
    }
    
    // Create new entity if none available in pool
    this.poolMissCount++;
    const entityData = {
      id: data.id || `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: data.name || 'Entity',
      type: entityType,
      position: data.position,
      quaternion: data.quaternion,
      scale: data.scale,
      ...data
    };
    
    const entity = new EntityClass(this.world, entityData, true);
    console.log(`[EntityManager] Created new entity: ${entity.id} (${entity.type}) - Pool miss`);
    return entity;
  }

  // Create a new entity with optional components (now with pooling)
  createEntity(data: {
    id?: string;
    name?: string;
    type?: string;
    position?: [number, number, number];
    quaternion?: [number, number, number, number];
    scale?: [number, number, number];
    components?: Array<{ type: string; data?: any }>;
    [key: string]: any;
  }): Entity {
    // Use pooling system to get or create entity
    const entity = this.getOrCreateEntity(data);
    
    // Add to tracking maps
    this.entities.set(entity.id, entity);
    this.addToTypeIndex(entity);
    
    // Add specified components
    if (data.components) {
      for (const componentDef of data.components) {
        try {
          entity.addComponent(componentDef.type, componentDef.data);
          this.addToComponentIndex(entity, componentDef.type);
        } catch (error) {
          console.error(`[EntityManager] Failed to add component ${componentDef.type}:`, error);
        }
      }
    }
    
    // Enable updates if entity has update methods
    if (entity.update || entity.fixedUpdate || entity.lateUpdate) {
      this.hot.add(entity);
      this.world.setHot(entity, true);
    }
    
    console.log(`[EntityManager] Created entity: ${entity.id} (${entity.type})`);
    
    // Emit creation event
    this.world.events?.emit('entity:created', {
      entityId: entity.id,
      entityType: entity.type
    });
    
    return entity;
  }
  
  // Get entity by ID
  getEntity(id: string): Entity | null {
    return this.entities.get(id) || null;
  }
  
  // Get all entities
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }
  
  // Get entities by type
  getEntitiesByType(type: string): Entity[] {
    const entities = this.entitiesByType.get(type);
    return entities ? Array.from(entities) : [];
  }
  
  // Query entities that have a specific component
  getEntitiesWithComponent(componentType: string): Entity[] {
    const entities = this.entitiesByComponent.get(componentType);
    return entities ? Array.from(entities) : [];
  }
  
  // Query entities that have all specified components
  getEntitiesWithComponents(componentTypes: string[]): Entity[] {
    if (componentTypes.length === 0) return [];
    
    // Start with entities that have the first component
    let result = this.getEntitiesWithComponent(componentTypes[0]);
    
    // Filter by remaining components
    for (let i = 1; i < componentTypes.length; i++) {
      const componentType = componentTypes[i];
      result = result.filter(entity => entity.hasComponent(componentType));
    }
    
    return result;
  }
  
  // Query entities matching a filter function
  queryEntities(filter: (entity: Entity) => boolean): Entity[] {
    return Array.from(this.entities.values()).filter(filter);
  }
  
  // Try to recycle an entity into the pool instead of destroying
  private recycleEntity(entity: Entity): boolean {
    const entityType = entity.type;
    
    // Don't pool if already pooled or if we've reached max pool size
    if (this.pooledEntities.has(entity.id)) return false;
    
    let pool = this.entityPools.get(entityType);
    if (!pool) {
      pool = [];
      this.entityPools.set(entityType, pool);
    }
    
    if (pool.length >= this.maxPoolSize) {
      return false; // Pool is full, let entity be destroyed
    }
    
    // Clean up entity for reuse
    entity.removeAllComponents();
    entity.active = false;
    entity.destroyed = false;
    
    // Remove from active tracking but keep entity instance
    this.entities.delete(entity.id);
    this.removeFromTypeIndex(entity);
    
    // Remove from component index for all components
    for (const componentType of entity.components.keys()) {
      this.removeFromComponentIndex(entity, componentType);
    }
    
    this.hot.delete(entity);
    this.world.setHot(entity, false);
    
    // Add to pool
    pool.push(entity);
    this.pooledEntities.add(entity.id);
    
    console.log(`[EntityManager] Recycled entity ${entity.id} (${entity.type}) to pool - Pool size: ${pool.length}`);
    return true;
  }

  // Destroy an entity (with optional recycling)
  destroyEntity(id: string, forceDestroy: boolean = false): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;
    
    // Try to recycle entity first (unless forced to destroy)
    if (!forceDestroy && this.recycleEntity(entity)) {
      // Entity was recycled successfully
      this.world.events?.emit('entity:recycled', {
        entityId: entity.id,
        entityType: entity.type
      });
      return true;
    }
    
    // Remove from tracking for permanent destruction
    this.entities.delete(id);
    this.removeFromTypeIndex(entity);
    this.removeFromAllComponentIndices(entity);
    
    // Remove from hot updates
    if (this.hot.has(entity)) {
      this.hot.delete(entity);
      this.world.setHot(entity, false);
    }
    
    // Destroy the entity
    entity.destroy(true);
    
    console.log(`[EntityManager] Destroyed entity: ${id}`);
    
    // Emit destruction event
    this.world.events?.emit('entity:destroyed', {
      entityId: id
    });
    
    return true;
  }
  
  // Add component to existing entity
  addComponentToEntity(entityId: string, componentType: string, data?: any): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    
    try {
      entity.addComponent(componentType, data);
      this.addToComponentIndex(entity, componentType);
      
      console.log(`[EntityManager] Added component ${componentType} to entity ${entityId}`);
      return true;
    } catch (error) {
      console.error(`[EntityManager] Failed to add component ${componentType} to entity ${entityId}:`, error);
      return false;
    }
  }
  
  // Remove component from entity
  removeComponentFromEntity(entityId: string, componentType: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    
    if (entity.hasComponent(componentType)) {
      entity.removeComponent(componentType);
      this.removeFromComponentIndex(entity, componentType);
      
      console.log(`[EntityManager] Removed component ${componentType} from entity ${entityId}`);
      return true;
    }
    
    return false;
  }
  
  // Get available component types
  getAvailableComponentTypes(): string[] {
    return Object.keys(ComponentRegistry);
  }
  
  // System update methods
  fixedUpdate(delta: number): void {
    // Update all hot entities
    for (const entity of this.hot) {
      if (entity.fixedUpdate) {
        try {
          entity.fixedUpdate(delta);
        } catch (error) {
          console.error(`[EntityManager] Error in entity ${entity.id} fixedUpdate:`, error);
        }
      }
    }
  }
  
  update(delta: number): void {
    // Update all hot entities
    for (const entity of this.hot) {
      if (entity.update) {
        try {
          entity.update(delta);
        } catch (error) {
          console.error(`[EntityManager] Error in entity ${entity.id} update:`, error);
        }
      }
    }
  }
  
  lateUpdate(delta: number): void {
    // Update all hot entities
    for (const entity of this.hot) {
      if (entity.lateUpdate) {
        try {
          entity.lateUpdate(delta);
        } catch (error) {
          console.error(`[EntityManager] Error in entity ${entity.id} lateUpdate:`, error);
        }
      }
    }
  }
  
  // Entity pooling management and statistics
  getPoolingStats(): {
    totalPools: number;
    poolSizes: { [type: string]: number };
    poolHitRate: number;
    totalHits: number;
    totalMisses: number;
    pooledEntityCount: number;
  } {
    const poolSizes: { [type: string]: number } = {};
    for (const [type, pool] of this.entityPools.entries()) {
      poolSizes[type] = pool.length;
    }
    
    const totalRequests = this.poolHitCount + this.poolMissCount;
    const hitRate = totalRequests > 0 ? (this.poolHitCount / totalRequests) * 100 : 0;
    
    return {
      totalPools: this.entityPools.size,
      poolSizes,
      poolHitRate: Math.round(hitRate * 100) / 100,
      totalHits: this.poolHitCount,
      totalMisses: this.poolMissCount,
      pooledEntityCount: this.pooledEntities.size
    };
  }
  
  // Clear all entity pools (for cleanup or memory management)
  clearAllPools(): void {
    const stats = this.getPoolingStats();
    this.entityPools.clear();
    this.pooledEntities.clear();
    console.log(`[EntityManager] Cleared all entity pools - freed ${stats.pooledEntityCount} pooled entities`);
  }
  
  // Clear pool for specific entity type
  clearPool(entityType: string): number {
    const pool = this.entityPools.get(entityType);
    if (pool) {
      const count = pool.length;
      this.entityPools.delete(entityType);
      // Remove pooled entities from tracking
      for (const entity of pool) {
        this.pooledEntities.delete(entity.id);
      }
      console.log(`[EntityManager] Cleared ${entityType} pool - freed ${count} entities`);
      return count;
    }
    return 0;
  }
  
  // Warm up entity pools by pre-creating entities
  warmUpPools(poolConfig: { [entityType: string]: number }): void {
    console.log('[EntityManager] Warming up entity pools...');
    for (const [entityType, count] of Object.entries(poolConfig)) {
      for (let i = 0; i < count; i++) {
        const entity = new EntityClass(this.world, {
          id: `pool-${entityType}-${Date.now()}-${i}`,
          name: `Pooled ${entityType}`,
          type: entityType,
          active: false
        }, true);
        
        let pool = this.entityPools.get(entityType);
        if (!pool) {
          pool = [];
          this.entityPools.set(entityType, pool);
        }
        
        pool.push(entity);
        this.pooledEntities.add(entity.id);
      }
      console.log(`[EntityManager] Warmed up ${entityType} pool with ${count} entities`);
    }
  }

  // Event handlers
  onComponentAdded(entityId: string, componentType: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      this.addToComponentIndex(entity, componentType);
    }
  }
  
  onComponentRemoved(entityId: string, componentType: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      this.removeFromComponentIndex(entity, componentType);
    }
  }
  
  // Private indexing methods
  private addToTypeIndex(entity: Entity): void {
    const type = entity.type;
    if (!this.entitiesByType.has(type)) {
      this.entitiesByType.set(type, new Set());
    }
    this.entitiesByType.get(type)!.add(entity);
  }
  
  private removeFromTypeIndex(entity: Entity): void {
    const type = entity.type;
    const entities = this.entitiesByType.get(type);
    if (entities) {
      entities.delete(entity);
      if (entities.size === 0) {
        this.entitiesByType.delete(type);
      }
    }
  }
  
  private addToComponentIndex(entity: Entity, componentType: string): void {
    if (!this.entitiesByComponent.has(componentType)) {
      this.entitiesByComponent.set(componentType, new Set());
    }
    this.entitiesByComponent.get(componentType)!.add(entity);
  }
  
  private removeFromComponentIndex(entity: Entity, componentType: string): void {
    const entities = this.entitiesByComponent.get(componentType);
    if (entities) {
      entities.delete(entity);
      if (entities.size === 0) {
        this.entitiesByComponent.delete(componentType);
      }
    }
  }
  
  private removeFromAllComponentIndices(entity: Entity): void {
    for (const componentType of entity.components.keys()) {
      this.removeFromComponentIndex(entity, componentType);
    }
  }
  
  // Statistics and debugging
  getStats(): {
    totalEntities: number;
    entitiesByType: Record<string, number>;
    entitiesByComponent: Record<string, number>;
    hotEntities: number;
  } {
    const entitiesByType: Record<string, number> = {};
    for (const [type, entities] of this.entitiesByType) {
      entitiesByType[type] = entities.size;
    }
    
    const entitiesByComponent: Record<string, number> = {};
    for (const [componentType, entities] of this.entitiesByComponent) {
      entitiesByComponent[componentType] = entities.size;
    }
    
    return {
      totalEntities: this.entities.size,
      entitiesByType,
      entitiesByComponent,
      hotEntities: this.hot.size
    };
  }
  
  // Cleanup
  override destroy(): void {
    // Destroy all entities
    for (const entity of this.entities.values()) {
      entity.destroy();
    }
    
    // Clear all maps
    this.entities.clear();
    this.entitiesByType.clear();
    this.entitiesByComponent.clear();
    this.hot.clear();
    
    console.log('[EntityManager] All entities destroyed and cleared');
  }
}