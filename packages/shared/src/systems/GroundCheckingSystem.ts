import type { Entity, World, WorldOptions } from '../types'
import THREE from '../extras/three'
import { System } from './System'
import { TerrainSystem } from './TerrainSystem'
import { TransformComponent } from '../components/TransformComponent'
import type { GroundCheckingSystemResult, GroundCheckingSystemEntity } from '../types/physics'

const _groundCheckResult: GroundCheckingSystemResult = {
  groundHeight: 0,
  isValid: false,
  correction: new THREE.Vector3(),
}

// Local type aliases for clarity
type GroundCheckResult = GroundCheckingSystemResult
type GroundCheckEntity = GroundCheckingSystemEntity

export class GroundCheckingSystem extends System {
  private entities: Map<string, GroundCheckEntity> = new Map()
  private checkInterval = 100 // Check every 100ms
  private rayDirection = new THREE.Vector3(0, -1, 0)
  private maxRayDistance = 1000
  private minGroundOffset = 0.1 // Minimum height above ground
  
  constructor(world: World) {
    super(world)
  }

  async init(_options: WorldOptions): Promise<void> {
    // Start the ground checking loop
    this.startGroundCheckLoop()
  }

  /**
   * Register an entity for ground checking
   */
  registerEntity(id: string, position: THREE.Vector3, groundOffset: number = 0.5) {
    this.entities.set(id, {
      id,
      position: position.clone(),
      needsGroundCheck: true,
      lastGroundCheck: 0,
      groundOffset
    })
  }

  /**
   * Unregister an entity from ground checking
   */
  unregisterEntity(id: string) {
    this.entities.delete(id)
  }

  /**
   * Update an entity's position for ground checking
   */
  updateEntityPosition(id: string, position: THREE.Vector3) {
    const entity = this.entities.get(id)
    if (entity) {
      entity.position.copy(position)
      entity.needsGroundCheck = true
    }
  }

  /**
   * Get the ground height at a specific world position using multiple methods
   */
  getGroundHeight(worldPos: THREE.Vector3): GroundCheckResult {
    // Use terrain system
    const terrainSystem = this.world.getSystem<TerrainSystem>('terrain') as TerrainSystem
    const terrainHeight = terrainSystem.getHeightAt(worldPos.x, worldPos.z)

    _groundCheckResult.groundHeight = terrainHeight
    _groundCheckResult.isValid = true
    _groundCheckResult.correction.set(0, terrainHeight - worldPos.y, 0)
    return _groundCheckResult
  }

  /**
   * Check if an entity needs ground correction
   */
  checkEntityGround(entity: GroundCheckEntity): GroundCheckResult | null {
    const groundResult = this.getGroundHeight(entity.position)
    
    const targetY = groundResult.groundHeight + entity.groundOffset
    const currentY = entity.position.y
    const yDifference = Math.abs(currentY - targetY)

    // If entity is significantly below or above ground, needs correction
    if (yDifference > 0.1) {
      _groundCheckResult.groundHeight = groundResult.groundHeight
      _groundCheckResult.isValid = true
      _groundCheckResult.correction.set(0, targetY - currentY, 0)
      return _groundCheckResult
    }

    return null // No correction needed
  }

  /**
   * Apply ground correction to an entity
   */
  applyGroundCorrection(entityId: string, correction: GroundCheckResult) {
    // Get the actual entity from the world
    const entity = this.world.entities.get(entityId) as Entity
    const transform = entity.getComponent('Transform') as TransformComponent

    // Apply the correction
    transform.position.add(correction.correction)
    
    // Update our tracking
    const trackedEntity = this.entities.get(entityId)!
    trackedEntity.position.copy(transform.position)
    trackedEntity.needsGroundCheck = false
    trackedEntity.lastGroundCheck = Date.now()

    // Emit event for other systems
    this.world.emit('entity:ground-corrected', {
      entityId,
      oldPosition: transform.position.clone().sub(correction.correction),
      newPosition: transform.position.clone(),
      correction: correction.correction
    })
  }

  /**
   * Force a ground check for a specific entity
   */
  forceGroundCheck(entityId: string) {
    const entity = this.entities.get(entityId)!
    entity.needsGroundCheck = true
    this.performGroundCheck(entity)
  }

  /**
   * Perform ground check on a single entity
   */
  private performGroundCheck(entity: GroundCheckEntity) {
    const correction = this.checkEntityGround(entity)
    if (correction) {
      this.applyGroundCorrection(entity.id, correction)
    }
  }

  /**
   * Main ground checking loop
   */
  private startGroundCheckLoop() {
    const checkLoop = () => {
      if (this.entities.size > 0) {
        for (const entity of this.entities.values()) {
          this.performGroundCheck(entity);
        }
      }
      setTimeout(checkLoop, this.checkInterval);
    };
    checkLoop();
  }

  /**
   * Utility: Position any entity on the ground at a given world position
   */
  static positionOnGround(world: World, entity: Entity, worldX: number, worldZ: number, offset: number = 0.5): void {
    const groundCheckingSystem = world.getSystem<GroundCheckingSystem>('ground-checking') as GroundCheckingSystem
    const testPosition = new THREE.Vector3(worldX, 100, worldZ)
    const groundResult = groundCheckingSystem.getGroundHeight(testPosition)
    
    // Position the entity
    const transform = entity.getComponent('Transform') as TransformComponent
    transform.position.set(worldX, groundResult.groundHeight + offset, worldZ)
  }
  
  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}