/**
 * Production-Grade PhysX Collision Verification and Ground Clamping System
 * 
 * Ensures precise collision detection and ground positioning with:
 * - PhysX collision mesh validation against heightmap
 * - Automatic ground clamping for entities
 * - Underground detection and correction
 * - Multi-layer collision detection
 * - Performance optimized raycasting
 * - Collision mesh integrity verification
 */

import { EventType } from '../types/events';
import type { Entity } from '../types/index';
import { World } from '../World';
import { Physics } from './Physics';
import { SystemBase } from './SystemBase';
import { TerrainValidationSystem } from './TerrainValidationSystem';

import THREE from '../extras/three';
import type { CollisionValidationResult, CollisionError, GroundClampingOptions, EntityGroundState } from '../types/physics'

// Moved shared collision types to be globally reusable
// Types moved to shared physics types

export class PhysXCollisionSystem extends SystemBase {
  private collisionErrors: CollisionError[] = [];
  private entityGroundStates = new Map<string, EntityGroundState>();
  private terrainValidationSystem!: TerrainValidationSystem;
  private physicsSystem!: Physics;
  private lastValidationTime = 0;
  private isValidating = false;
  private _tempVec3_1 = new THREE.Vector3();
  private _tempVec3_2 = new THREE.Vector3();
  
  // Interval handles
  private validationIntervalId: ReturnType<typeof setInterval> | null = null;
  private groundMonitorIntervalId: ReturnType<typeof setInterval> | null = null;
  
  // Constants
  private static readonly VALIDATION_INTERVAL = 3000;
  private static readonly RAYCAST_DISTANCE = 1000;
  private static readonly GROUND_TOLERANCE = 0.1;
  private static readonly UNDERGROUND_THRESHOLD = -0.2;
  private static readonly FLOATING_THRESHOLD = 0.5;
  private static readonly HEIGHT_MISMATCH_TOLERANCE = 0.15;
  private static readonly MAX_VALIDATION_POINTS = 500;
  private static readonly SMOOTHING_FACTOR = 0.1;
  private static readonly BATCH_SIZE = 10;

  constructor(world: World) {
    super(world, { name: 'physx-collision', dependencies: { required: ['physics'], optional: ['terrain-validation'] }, autoCleanup: true });
  }

  async init(): Promise<void> {
    // Find required systems
    this.physicsSystem = this.world.getSystem('physics') as Physics;
    if (!this.physicsSystem) {
      this.logger.error('Physics system not found despite being a required dependency');
    }
    
    this.terrainValidationSystem = this.world.getSystem('terrain-validation') as TerrainValidationSystem;
    if (!this.terrainValidationSystem) {
      this.logger.warn('TerrainValidationSystem not found - some validation features will be limited');
    }
    
    // Listen for entity events via event bus (typed payloads)
    this.subscribe(EventType.ENTITY_POSITION_CHANGED, (data: { entityId: string; position: { x: number; y: number; z: number } }) => {
      this.onEntityMoved({ entityId: data.entityId, position: data.position, oldPosition: { x: data.position.x, y: data.position.y, z: data.position.z } });
    });
    this.subscribe(EventType.ENTITY_SPAWNED, (_data: { entityId: string; entityType: 'player' | 'mob' | 'item' | 'npc' | 'resource' }) => {
      // Ground state initializes on first ENTITY_POSITION_CHANGED
    });
    this.subscribe(EventType.ENTITY_DEATH, (data: { entityId: string }) => this.onEntityDestroyed(data));
    // Listen for validation requests
    this.subscribe(EventType.PHYSICS_VALIDATION_REQUEST, () => this.requestValidation());
    this.subscribe(
      EventType.PHYSICS_GROUND_CLAMP,
      (payload: { entityId: string; position?: { x: number; y: number; z: number }; options?: Partial<GroundClampingOptions> }) => {
        void this.clampEntityToGround({
          entityId: payload.entityId,
          position: payload.position,
          options: payload.options as GroundClampingOptions | undefined
        });
      }
    );
  }

  start(): void {
    // Verify required systems are available
    if (!this.physicsSystem) {
      this.physicsSystem = this.world.getSystem('physics') as Physics;
      if (!this.physicsSystem) {
        this.logger.error('CRITICAL: Physics system not found at startup - collision validation disabled');
        return;
      }
    }
    
    // Start periodic collision validation
    this.validationIntervalId = setInterval(() => {
      if (!this.isValidating) {
        this.validateCollisionIntegrity();
      }
    }, PhysXCollisionSystem.VALIDATION_INTERVAL);
    
    // Start ground state monitoring
    this.startGroundStateMonitoring();
  }

  // Removed Three.js Raycaster pool in favor of PhysX raycasts

  /**
   * Start ground state monitoring for all entities
   */
  private startGroundStateMonitoring(): void {
    // Monitor entity ground states at ~30fps
    this.groundMonitorIntervalId = setInterval(() => {
      this.updateAllEntityGroundStates();
    }, 33); // ~30fps
  }

  /**
   * Validate collision integrity across the world
   */
  public async validateCollisionIntegrity(): Promise<CollisionValidationResult> {
    if (this.isValidating) {
      return this.getLastValidationResult();
    }

    this.isValidating = true;
    const startTime = performance.now();
    
    const result: CollisionValidationResult = {
      isValid: true,
      errors: [],
      totalChecks: 0,
      successfulChecks: 0,
      averageHeight: 0,
      maxHeightDifference: 0,
      validationTime: 0
    };

    // Get validation points from terrain system
    const validationPoints = this.getTerrainValidationPoints();
    result.totalChecks = validationPoints.length;
    
    let heightSum = 0;
    let maxHeightDiff = 0;
    let processedPoints = 0;
    
    // Process points in batches to avoid blocking
    for (let i = 0; i < validationPoints.length; i += PhysXCollisionSystem.BATCH_SIZE) {
      const batch = validationPoints.slice(i, i + PhysXCollisionSystem.BATCH_SIZE);
      
      for (const point of batch) {
        const validation = await this.validateCollisionAtPoint(point.x, point.z);
        
        if (validation.success) {
          result.successfulChecks++;
          heightSum += validation.physxHeight;
          
          maxHeightDiff = Math.max(maxHeightDiff, validation.heightDifference);
          
          // Add error if height difference is significant
          if (validation.heightDifference > PhysXCollisionSystem.HEIGHT_MISMATCH_TOLERANCE) {
            result.errors.push({
              type: 'height_mismatch',
              position: { x: point.x, y: validation.terrainHeight, z: point.z },
              severity: validation.heightDifference > 0.5 ? 'critical' : 'warning',
              message: `PhysX height mismatch: ${validation.heightDifference.toFixed(3)}m difference`,
              timestamp: Date.now(),
              expectedHeight: validation.terrainHeight,
              actualHeight: validation.physxHeight,
              heightDifference: validation.heightDifference
            });
          }
        } else {
          result.errors.push({
            type: 'missing_collision',
            position: { x: point.x, y: validation.terrainHeight, z: point.z },
            severity: 'critical',
            message: 'No PhysX collision found for terrain position',
            timestamp: Date.now(),
            expectedHeight: validation.terrainHeight
          });
        }
        
        processedPoints++;
        
        // Yield to main thread every batch
        if (processedPoints % PhysXCollisionSystem.BATCH_SIZE === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
    }
    
    // Calculate results
    result.averageHeight = result.successfulChecks > 0 ? heightSum / result.successfulChecks : 0;
    result.maxHeightDifference = maxHeightDiff;
    result.validationTime = performance.now() - startTime;
    result.isValid = !result.errors.some(e => e.severity === 'critical');
    
    // Emit validation complete event
    this.emitTypedEvent(EventType.PHYSICS_VALIDATION_COMPLETE, result);
    
    this.isValidating = false;
    this.lastValidationTime = Date.now();

    return result;
  }

  /**
   * Validate collision at a specific point
   */
  private async validateCollisionAtPoint(x: number, z: number): Promise<{
    success: boolean;
    terrainHeight: number;
    physxHeight: number;
    heightDifference: number;
  }> {
    // Get expected terrain height
    const terrainHeight = this.getTerrainHeight(x, z);
    
    // Perform PhysX raycast
    const physxHeight = await this.performPhysXRaycast(x, z);
    const isValid = !Number.isNaN(physxHeight);
    const heightDifference = isValid ? Math.abs(terrainHeight - physxHeight) : 0;
    
    return {
      success: isValid,
      terrainHeight,
      physxHeight: isValid ? physxHeight : terrainHeight,
      heightDifference
    };
  }

  /**
   * Perform PhysX raycast to get collision height
   */
  private async performPhysXRaycast(x: number, z: number, startHeight: number = 500): Promise<number> {
    const origin = this._tempVec3_1.set(x, startHeight, z);
    const direction = this._tempVec3_2.set(0, -1, 0);
    const mask = this.world.createLayerMask ? this.world.createLayerMask('environment') : 0xFFFFFFFF;
    const hit = this.physicsSystem.raycastWithMask(origin, direction, PhysXCollisionSystem.RAYCAST_DISTANCE, mask);
    if (hit && hit.point) {
      return hit.point.y;
    }
    return Number.NaN;
  }

  /**
   * Clamp entity to ground with optional smoothing
   */
  public async clampEntityToGround(data: {
    entityId: string;
    position?: { x: number; y: number; z: number }
    options?: GroundClampingOptions;
  }): Promise<{ x: number; y: number; z: number }> {
    const entity = this.getEntity(data.entityId);
    if (!entity) {
      throw new Error(`Entity ${data.entityId} not found`);
    }
    const position = data.position || entity.position;
    const options = {
      verticalOffset: 0.1,
      allowUnderground: false,
      snapToSurface: true,
      smoothing: true,
      smoothingFactor: PhysXCollisionSystem.SMOOTHING_FACTOR,
      ...data.options
    };
    
    // Perform raycast from above the entity
    const groundHeight = await this.performPhysXRaycast(position.x, position.z, position.y + 50);
    
    // Calculate target Y position
    let targetY = groundHeight + (options.verticalOffset || 0);
    
    // Apply smoothing if requested
    if (options.smoothing) {
      targetY = this.lerp(position.y, targetY, options.smoothingFactor || PhysXCollisionSystem.SMOOTHING_FACTOR);
    }
    
    const newPosition = {
      x: position.x,
      y: targetY,
      z: position.z
    };
    
    // Update entity ground state
    this.updateEntityGroundState(data.entityId, {
      position: newPosition,
      groundHeight,
      isOnGround: Math.abs(targetY - groundHeight) < PhysXCollisionSystem.GROUND_TOLERANCE
    });
    
    // Apply position if snap to surface is enabled
    if (options.snapToSurface) {
      entity.position.set(newPosition.x, newPosition.y, newPosition.z);
      // Emit position correction event
      this.emitTypedEvent(EventType.ENTITY_POSITION_CORRECTED, {
        entityId: data.entityId,
        oldPosition: position,
        newPosition: newPosition,
        reason: 'ground_clamping',
        groundHeight
      });
    }
    
    return newPosition;
  }

  /**
   * Update all entity ground states
   */
  private updateAllEntityGroundStates(): void {
    const entities = this.getAllEntities();
    
    for (const entity of entities) {
      this.updateEntityGroundState(entity.id, {
        position: entity.position,
        checkGround: true
      });
    }
  }

  /**
   * Update entity ground state
   */
  private updateEntityGroundState(entityId: string, data: {
    position?: { x: number; y: number; z: number }
    groundHeight?: number;
    isOnGround?: boolean;
    isUnderground?: boolean;
    isFloating?: boolean;
    checkGround?: boolean;
  }): void {
    let groundState = this.entityGroundStates.get(entityId);
    
    if (!groundState) {
      const entity = this.getEntity(entityId);
      
      groundState = {
        entityId,
        position: entity?.position || { x: 0, y: 0, z: 0 },
        groundHeight: 0,
        isOnGround: false,
        isUnderground: false,
        isFloating: false,
        lastGroundContact: Date.now(),
        verticalVelocity: 0,
        groundNormal: { x: 0, y: 1, z: 0 },
        surfaceType: 'terrain'
      };
      
      this.entityGroundStates.set(entityId, groundState);
    }
    
    // Update position
    if (data.position) {
      const oldY = groundState.position.y;
      groundState.position = { ...data.position };
      groundState.verticalVelocity = (data.position.y - oldY) * 60;
    }
    
    // Check ground if requested
    if (data.checkGround && groundState.position) {
      this.performPhysXRaycast(groundState.position.x, groundState.position.z).then(height => {
        const validHeight = !Number.isNaN(height) ? height : groundState!.groundHeight;
        groundState!.groundHeight = validHeight;
        const delta = groundState!.position.y - validHeight;
        groundState!.isOnGround = Math.abs(delta) < PhysXCollisionSystem.GROUND_TOLERANCE;
        groundState!.isUnderground = delta < PhysXCollisionSystem.UNDERGROUND_THRESHOLD;
        groundState!.isFloating = delta > PhysXCollisionSystem.FLOATING_THRESHOLD;
        if (groundState!.isOnGround) {
          groundState!.lastGroundContact = Date.now();
        }
      });
    }
    
    // Update other properties
    if (data.groundHeight !== undefined) groundState.groundHeight = data.groundHeight;
    if (data.isOnGround !== undefined) groundState.isOnGround = data.isOnGround;
    if (data.isUnderground !== undefined) groundState.isUnderground = data.isUnderground;
    if (data.isFloating !== undefined) groundState.isFloating = data.isFloating;
  }

  /**
   * Get terrain validation points for collision checking
   */
  private getTerrainValidationPoints(): { x: number; z: number }[] {
    const points: { x: number; z: number }[] = [];
    
    // Get loaded terrain bounds
    const bounds = this.getLoadedTerrainBounds();
    const { minX, maxX, minZ, maxZ } = bounds;
    const step = 10; // 10m resolution for collision validation
    
    // Limit total points to avoid performance issues
    const maxPointsPerAxis = Math.sqrt(PhysXCollisionSystem.MAX_VALIDATION_POINTS);
    const actualStepX = Math.max(step, (maxX - minX) / maxPointsPerAxis);
    const actualStepZ = Math.max(step, (maxZ - minZ) / maxPointsPerAxis);
    
    for (let x = minX; x <= maxX; x += actualStepX) {
      for (let z = minZ; z <= maxZ; z += actualStepZ) {
        points.push({ x, z });
        
        if (points.length >= PhysXCollisionSystem.MAX_VALIDATION_POINTS) {
          return points;
        }
      }
    }
    
    return points;
  }

  // Helper methods
  private getTerrainHeight(x: number, z: number): number {
    if (!this.terrainValidationSystem) return 0;
    return this.terrainValidationSystem.getTerrainHeight(x, z) || 0;
  }

  // Three.js meshes are not used for collision; PhysX manages colliders

  private getEntity(entityId: string): Entity | null {
    return this.world.entities.get(entityId);
  }

  private getAllEntities(): Entity[] {
    return Array.from(this.world.entities.values());
  }

  private getLoadedTerrainBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return {
      minX: -1000,
      maxX: 1000,
      minZ: -1000,
      maxZ: 1000
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private getLastValidationResult(): CollisionValidationResult {
    return {
      isValid: false,
      errors: this.collisionErrors,
      totalChecks: 0,
      successfulChecks: 0,
      averageHeight: 0,
      maxHeightDifference: 0,
      validationTime: 0
    };
  }

  // Event handlers
  private onEntityMoved(data: {
    entityId: string;
    position: { x: number; y: number; z: number }
    oldPosition: { x: number; y: number; z: number }
  }): void {
    // Update ground state when entity moves
    this.updateEntityGroundState(data.entityId, {
      position: data.position,
      checkGround: true
    });
    
    // Check for underground condition
    const groundState = this.entityGroundStates.get(data.entityId);
    if (groundState && groundState.isUnderground) {
      
      // Auto-clamp to ground
      this.clampEntityToGround({
        entityId: data.entityId,
        options: { snapToSurface: true }
      });
    }
  }

  private onEntitySpawned(data: { entityId: string; position: { x: number; y: number; z: number } }): void {
    // Initialize ground state for new entity
    this.updateEntityGroundState(data.entityId, {
      position: data.position,
      checkGround: true
    });
    
    // Auto-clamp to ground if requested
    this.clampEntityToGround({
      entityId: data.entityId,
      options: { snapToSurface: false } // Don't auto-snap on spawn
    });
  }

  private onEntityDestroyed(data: { entityId: string }): void {
    // Clean up ground state
    this.entityGroundStates.delete(data.entityId);
  }

  private requestValidation(): void {
    this.validateCollisionIntegrity();
  }

  // Public API
  public getCollisionErrors(): CollisionError[] {
    return [...this.collisionErrors];
  }

  public getEntityGroundState(entityId: string): EntityGroundState | null {
    return this.entityGroundStates.get(entityId) || null;
  }

  public getAllEntityGroundStates(): Map<string, EntityGroundState> {
    return new Map(this.entityGroundStates);
  }

  public isValidationInProgress(): boolean {
    return this.isValidating;
  }

  public getSystemStats(): Record<string, unknown> {
    const undergroundEntities = Array.from(this.entityGroundStates.values()).filter(s => s.isUnderground).length;
    const floatingEntities = Array.from(this.entityGroundStates.values()).filter(s => s.isFloating).length;
    const groundedEntities = Array.from(this.entityGroundStates.values()).filter(s => s.isOnGround).length;
    
    return {
      trackedEntities: this.entityGroundStates.size,
      undergroundEntities,
      floatingEntities,
      groundedEntities,
      collisionErrors: this.collisionErrors.length,
      lastValidationTime: this.lastValidationTime
    };
  }

  // System lifecycle
  update(_dt: number): void {
    // System updates would go here
  }

  destroy(): void {
    this.collisionErrors = [];
    this.entityGroundStates.clear();
    if (this.validationIntervalId) clearInterval(this.validationIntervalId);
    if (this.groundMonitorIntervalId) clearInterval(this.groundMonitorIntervalId);
    this.validationIntervalId = null;
    this.groundMonitorIntervalId = null;
  }

  // Required System interface methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}