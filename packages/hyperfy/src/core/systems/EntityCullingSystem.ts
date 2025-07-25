import { System } from './System';
import type { World, Entity } from '../../types/index';

/**
 * Entity Culling and LOD System
 * 
 * Optimizes performance by:
 * - Culling entities outside view frustum
 * - Managing Level of Detail (LOD) based on distance
 * - Controlling entity update frequency based on visibility
 * - Managing entity activity based on player proximity
 */
export class EntityCullingSystem extends System {
  private camera: any = null;
  private culledEntities: Set<string>;
  private lodLevels: Map<string, number>; // entityId -> LOD level
  private distanceCache: Map<string, number>; // entityId -> distance
  private lastCullingUpdate: number = 0;
  private cullingInterval: number = 100; // ms between culling updates
  
  // LOD configuration
  private lodDistances = {
    HIGH: 50,    // Full detail within 50 units
    MEDIUM: 200, // Medium detail within 200 units  
    LOW: 500,    // Low detail within 500 units
    CULLED: 1000 // Culled beyond 1000 units
  };
  
  // Entity categories for different culling strategies
  private entityCategories = new Map<string, 'static' | 'dynamic' | 'critical' | 'ui'>();
  
  constructor(world: World) {
    super(world);
    this.culledEntities = new Set();
    this.lodLevels = new Map();
    this.distanceCache = new Map();
    
    console.log('[EntityCullingSystem] LOD and culling system initialized');
  }
  
  async init(): Promise<void> {
    console.log('[EntityCullingSystem] Initializing entity culling and LOD system...');
    
    // Listen for camera updates
    this.world.on?.('camera:update', this.onCameraUpdate.bind(this));
    this.world.on?.('entity:created', this.onEntityCreated.bind(this));
    this.world.on?.('entity:destroyed', this.onEntityDestroyed.bind(this));
    
    console.log('[EntityCullingSystem] Culling system ready');
  }
  
  start(): void {
    console.log('[EntityCullingSystem] Started - managing entity LOD and culling');
  }
  
  update(dt: number): void {
    const now = Date.now();
    
    // Only update culling at specified intervals
    if (now - this.lastCullingUpdate < this.cullingInterval) {
      return;
    }
    
    this.lastCullingUpdate = now;
    this.updateEntityCulling();
  }
  
  private updateEntityCulling(): void {
    if (!this.camera) return;
    
    const entityManager = this.world['entity-manager'];
    if (!entityManager) return;
    
    const allEntities = entityManager.getAllEntities();
    const cameraPosition = this.camera.position;
    
    for (const entity of allEntities) {
      this.updateEntityLOD(entity, cameraPosition);
    }
  }
  
  private updateEntityLOD(entity: Entity, cameraPosition: any): void {
    const entityPosition = entity.position;
    if (!entityPosition || !cameraPosition) return;
    
    // Calculate distance to camera
    const distance = this.calculateDistance(entityPosition, cameraPosition);
    this.distanceCache.set(entity.id, distance);
    
    // Determine LOD level based on distance and entity category
    const category = this.entityCategories.get(entity.id) || 'dynamic';
    const lodLevel = this.determineLODLevel(distance, category);
    
    // Update LOD if changed
    const currentLOD = this.lodLevels.get(entity.id);
    if (currentLOD !== lodLevel) {
      this.lodLevels.set(entity.id, lodLevel);
      this.applyLOD(entity, lodLevel, distance);
    }
    
    // Handle culling
    this.updateEntityCullingState(entity, lodLevel);
  }
  
  private determineLODLevel(distance: number, category: 'static' | 'dynamic' | 'critical' | 'ui'): number {
    // UI elements always high detail
    if (category === 'ui') return 0;
    
    // Critical entities (players, important NPCs) get better LOD
    const multiplier = category === 'critical' ? 1.5 : 1.0;
    
    if (distance < this.lodDistances.HIGH * multiplier) return 0; // High detail
    if (distance < this.lodDistances.MEDIUM * multiplier) return 1; // Medium detail
    if (distance < this.lodDistances.LOW * multiplier) return 2; // Low detail
    return 3; // Culled
  }
  
  private applyLOD(entity: Entity, lodLevel: number, distance: number): void {
    switch (lodLevel) {
      case 0: // High detail
        this.setEntityUpdateFrequency(entity, 1.0);
        this.setEntityDetailLevel(entity, 'high');
        break;
        
      case 1: // Medium detail
        this.setEntityUpdateFrequency(entity, 0.5);
        this.setEntityDetailLevel(entity, 'medium');
        break;
        
      case 2: // Low detail
        this.setEntityUpdateFrequency(entity, 0.25);
        this.setEntityDetailLevel(entity, 'low');
        break;
        
      case 3: // Culled
        this.setEntityUpdateFrequency(entity, 0.0);
        this.setEntityDetailLevel(entity, 'culled');
        break;
    }
    
    // Emit LOD change event
    this.world.events?.emit('entity:lod_changed', {
      entityId: entity.id,
      lodLevel,
      distance,
      updateFrequency: this.getEntityUpdateFrequency(lodLevel)
    });
  }
  
  private updateEntityCullingState(entity: Entity, lodLevel: number): void {
    const shouldBeCulled = lodLevel >= 3;
    const isCulled = this.culledEntities.has(entity.id);
    
    if (shouldBeCulled && !isCulled) {
      // Start culling entity
      this.culledEntities.add(entity.id);
      this.setEntityActive(entity, false);
      
      this.world.events?.emit('entity:culled', {
        entityId: entity.id,
        reason: 'distance'
      });
      
    } else if (!shouldBeCulled && isCulled) {
      // Stop culling entity
      this.culledEntities.delete(entity.id);
      this.setEntityActive(entity, true);
      
      this.world.events?.emit('entity:unculled', {
        entityId: entity.id
      });
    }
  }
  
  private setEntityUpdateFrequency(entity: Entity, frequency: number): void {
    // Store frequency on entity for systems to use
    (entity as any)._updateFrequency = frequency;
    
    // Adjust hot tracking based on frequency
    if (frequency > 0) {
      this.world.setHot?.(entity, true);
    } else {
      this.world.setHot?.(entity, false);
    }
  }
  
  private setEntityDetailLevel(entity: Entity, level: 'high' | 'medium' | 'low' | 'culled'): void {
    // Store detail level on entity
    (entity as any)._detailLevel = level;
    
    // Apply detail level to mesh components if they exist
    if (entity.hasComponent && entity.hasComponent('mesh')) {
      const meshComponent = entity.getComponent('mesh');
      if (meshComponent && (meshComponent as any).mesh) {
        this.applyMeshLOD((meshComponent as any).mesh, level);
      }
    }
  }
  
  private applyMeshLOD(mesh: any, level: 'high' | 'medium' | 'low' | 'culled'): void {
    if (!mesh) return;
    
    switch (level) {
      case 'high':
        mesh.visible = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        break;
        
      case 'medium':
        mesh.visible = true;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        break;
        
      case 'low':
        mesh.visible = true;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        break;
        
      case 'culled':
        mesh.visible = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        break;
    }
  }
  
  private setEntityActive(entity: Entity, active: boolean): void {
    entity.active = active;
    
    // Hide/show entity in scene
    if ((entity as any).mesh) {
      (entity as any).mesh.visible = active;
    }
    
    // Also handle node visibility
    if (entity.node) {
      entity.node.visible = active;
    }
  }
  
  private calculateDistance(pos1: any, pos2: any): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y; 
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  private getEntityUpdateFrequency(lodLevel: number): number {
    switch (lodLevel) {
      case 0: return 1.0;
      case 1: return 0.5;
      case 2: return 0.25;
      case 3: return 0.0;
      default: return 1.0;
    }
  }
  
  // Public API
  
  // Set camera for culling calculations
  setCamera(camera: any): void {
    this.camera = camera;
    console.log('[EntityCullingSystem] Camera set for culling calculations');
  }
  
  // Configure LOD distances
  configureLOD(distances: {
    HIGH?: number;
    MEDIUM?: number;
    LOW?: number;
    CULLED?: number;
  }): void {
    Object.assign(this.lodDistances, distances);
    console.log('[EntityCullingSystem] LOD distances updated:', this.lodDistances);
  }
  
  // Set entity category for specialized culling
  setEntityCategory(entityId: string, category: 'static' | 'dynamic' | 'critical' | 'ui'): void {
    this.entityCategories.set(entityId, category);
  }
  
  // Get current LOD level for entity
  getEntityLOD(entityId: string): number {
    return this.lodLevels.get(entityId) || 0;
  }
  
  // Get distance to entity
  getEntityDistance(entityId: string): number {
    return this.distanceCache.get(entityId) || 0;
  }
  
  // Force update entity LOD
  forceUpdateEntityLOD(entityId: string): void {
    if (!this.camera) return;
    
    const entityManager = this.world['entity-manager'];
    if (!entityManager) return;
    
    const entity = entityManager.getEntity(entityId);
    if (entity) {
      this.updateEntityLOD(entity, this.camera.position);
    }
  }
  
  // Get culling statistics
  getCullingStats(): {
    totalEntities: number;
    culledEntities: number;
    lodDistribution: { [level: string]: number };
    averageDistance: number;
  } {
    const entityManager = this.world['entity-manager'];
    if (!entityManager) {
      return {
        totalEntities: 0,
        culledEntities: 0,
        lodDistribution: {},
        averageDistance: 0
      };
    }
    
    const allEntities = entityManager.getAllEntities();
    const lodDistribution: { [level: string]: number } = { '0': 0, '1': 0, '2': 0, '3': 0 };
    let totalDistance = 0;
    let validDistances = 0;
    
    for (const entity of allEntities) {
      const lod = this.lodLevels.get(entity.id) || 0;
      lodDistribution[lod.toString()]++;
      
      const distance = this.distanceCache.get(entity.id);
      if (distance !== undefined) {
        totalDistance += distance;
        validDistances++;
      }
    }
    
    return {
      totalEntities: allEntities.length,
      culledEntities: this.culledEntities.size,
      lodDistribution,
      averageDistance: validDistances > 0 ? totalDistance / validDistances : 0
    };
  }
  
  // Event handlers
  private onCameraUpdate(cameraData: any): void {
    this.camera = cameraData.camera || cameraData;
  }
  
  private onEntityCreated(data: { entityId: string; entityType: string }): void {
    // Set default category based on entity type
    let category: 'static' | 'dynamic' | 'critical' | 'ui' = 'dynamic';
    
    if (data.entityType.includes('player')) {
      category = 'critical';
    } else if (data.entityType.includes('ui')) {
      category = 'ui';
    } else if (data.entityType.includes('building') || data.entityType.includes('terrain')) {
      category = 'static';
    }
    
    this.setEntityCategory(data.entityId, category);
  }
  
  private onEntityDestroyed(data: { entityId: string }): void {
    // Clean up tracking data
    this.culledEntities.delete(data.entityId);
    this.lodLevels.delete(data.entityId);
    this.distanceCache.delete(data.entityId);
    this.entityCategories.delete(data.entityId);
  }
  
  destroy(): void {
    this.culledEntities.clear();
    this.lodLevels.clear();
    this.distanceCache.clear();
    this.entityCategories.clear();
    console.log('[EntityCullingSystem] System destroyed');
  }
  
  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}