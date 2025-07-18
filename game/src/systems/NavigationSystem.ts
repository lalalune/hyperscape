import { System } from '../../core/systems/System'
import type { World } from '../../types'
import type { Vector3 } from '../types'
import { RPGEntity } from '../entities/RPGEntity'

export interface NavigationPath {
  _entityId: string
  waypoints: Vector3[]
  currentWaypoint: number
  speed: number
  arrived: boolean
  callback?: () => void
}

export interface NavigationRequest {
  _entityId: string
  destination: Vector3
  speed?: number
  callback?: () => void
}

/**
 * Simple navigation system for direct movement without collision detection
 * This is a basic implementation that can be enhanced with pathfinding later
 */
export class NavigationSystem extends System {
  private activePaths: Map<string, NavigationPath> = new Map()
  private readonly DEFAULT_SPEED = 2 // units per second
  private readonly ARRIVAL_THRESHOLD = 0.5 // distance to consider "arrived"

  constructor(world: World) {
    super(world)
  }

  override async init(_options: any): Promise<void> {
    console.log('[NavigationSystem] Initializing...')
  }

  /**
   * Navigate entity to destination
   */
  navigateTo(request: NavigationRequest): void {
    const { _entityId, destination, speed = this.DEFAULT_SPEED, callback } = request

    // Validate entity ID
    if (!_entityId || typeof _entityId !== 'string') {
      console.error(`[NavigationSystem] Invalid entity ID: ${_entityId}`)
      if (callback) {
        callback()
      }
      return
    }

    // Validate destination
    if (
      !destination ||
      typeof destination.x !== 'number' ||
      typeof destination.y !== 'number' ||
      typeof destination.z !== 'number'
    ) {
      console.error(`[NavigationSystem] Invalid destination for entity ${_entityId}:`, destination)
      if (callback) {
        callback()
      }
      return
    }

    // Get entity
    const entity = this.getEntity(_entityId)
    if (!entity) {
      console.error(`[NavigationSystem] Entity ${_entityId} not found`)
      if (callback) {
        callback()
      }
      return
    }

    // Get current position
    const currentPosition = entity.position || entity.data?.position
    if (!currentPosition) {
      console.warn(`[NavigationSystem] Entity ${_entityId} has no position`)
      return
    }

    const startPos: Vector3 = Array.isArray(currentPosition)
      ? { x: currentPosition[0] || 0, y: currentPosition[1] || 0, z: currentPosition[2] || 0 }
      : currentPosition

    // For now, simple direct path (no pathfinding)
    const waypoints = [startPos, destination]

    // Create navigation path
    const path: NavigationPath = {
      _entityId,
      waypoints,
      currentWaypoint: 1, // Start moving to waypoint 1 (destination)
      speed,
      arrived: false,
      callback,
    }

    this.activePaths.set(_entityId, path)

    console.log(
      `[NavigationSystem] Entity ${_entityId} navigating to [${destination.x}, ${destination.y}, ${destination.z}]`
    )
  }

  /**
   * Update navigation paths
   */
  override fixedUpdate(delta: number): void {
    const deltaSeconds = delta / 1000

    for (const [_entityId, path] of this.activePaths) {
      if (path.arrived) {
        continue
      }

      this.updatePath(path, deltaSeconds)
    }

    // Clean up completed paths
    for (const [_entityId, path] of this.activePaths) {
      if (path.arrived) {
        this.activePaths.delete(_entityId)
      }
    }
  }

  /**
   * Update a single navigation path
   */
  private updatePath(path: NavigationPath, deltaSeconds: number): void {
    const entity = this.getEntity(path._entityId)
    if (!entity) {
      path.arrived = true
      return
    }

    // Get current position
    const currentPosition = entity.position || entity.data?.position
    if (!currentPosition) {
      path.arrived = true
      return
    }

    const currentPos: Vector3 = Array.isArray(currentPosition)
      ? { x: currentPosition[0] || 0, y: currentPosition[1] || 0, z: currentPosition[2] || 0 }
      : currentPosition

    // Get target waypoint
    const targetWaypoint = path.waypoints[path.currentWaypoint]
    if (!targetWaypoint) {
      path.arrived = true
      if (path.callback) {
        path.callback()
      }
      return
    }

    // Calculate direction and distance
    const direction = {
      x: targetWaypoint.x - currentPos.x,
      y: targetWaypoint.y - currentPos.y,
      z: targetWaypoint.z - currentPos.z,
    }

    const distance = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2)

    // Check if arrived at waypoint
    if (distance <= this.ARRIVAL_THRESHOLD) {
      path.currentWaypoint++

      // Check if all waypoints reached
      if (path.currentWaypoint >= path.waypoints.length) {
        path.arrived = true
        console.log(`[NavigationSystem] Entity ${path._entityId} arrived at destination`)

        if (path.callback) {
          path.callback()
        }
        return
      }

      // Continue to next waypoint
      return
    }

    // Normalize direction
    const normalizedDirection = {
      x: direction.x / distance,
      y: direction.y / distance,
      z: direction.z / distance,
    }

    // Calculate movement this frame
    const moveDistance = path.speed * deltaSeconds
    const actualMoveDistance = Math.min(moveDistance, distance)

    // Calculate new position
    const newPosition = {
      x: currentPos.x + normalizedDirection.x * actualMoveDistance,
      y: currentPos.y + normalizedDirection.y * actualMoveDistance,
      z: currentPos.z + normalizedDirection.z * actualMoveDistance,
    }

    // Update entity position
    if (entity.position) {
      entity.position = newPosition
    } else if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        entity.data.position = [newPosition.x, newPosition.y, newPosition.z]
      } else {
        entity.data.position = newPosition
      }
    }

    // Update Three.js node if available
    if (entity.node) {
      entity.node.position.set(newPosition.x, newPosition.y, newPosition.z)
    }
  }

  /**
   * Stop navigation for entity
   */
  stopNavigation(_entityId: string): void {
    const path = this.activePaths.get(_entityId)
    if (path) {
      path.arrived = true
      console.log(`[NavigationSystem] Stopped navigation for entity ${_entityId}`)
    }
  }

  /**
   * Check if entity is currently navigating
   */
  isNavigating(_entityId: string): boolean {
    if (!_entityId || typeof _entityId !== 'string') {
      console.warn(`[NavigationSystem] isNavigating called with invalid _entityId: ${_entityId}`)
      return false
    }

    const path = this.activePaths.get(_entityId)
    return path ? !path.arrived : false
  }

  /**
   * Get distance between two positions
   */
  getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    const dz = pos2.z - pos1.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /**
   * Get entity by ID with comprehensive fallback strategies
   */
  private getEntity(_entityId: string): RPGEntity | undefined {
    if (!_entityId) {
      console.error('[NavigationSystem] getEntity called with undefined/null _entityId')
      return undefined
    }

    // Strategy 1: Try test world entities (Map-based)
    if ((this.world as any).entities?.items) {
      const testEntity = (this.world as any).entities.items.get(_entityId)
      if (testEntity) {
        return testEntity
      }
    }

    // Strategy 2: Try production world entities
    if (this.world.entities?.get) {
      const prodEntity = this.world.entities.get(_entityId)
      if (prodEntity && typeof prodEntity.getComponent === 'function') {
        return prodEntity as unknown as RPGEntity
      }
    }

    // Strategy 3: Try alternative entity storage patterns
    if ((this.world as any).entityManager?.entities) {
      const managerEntity = (this.world as any).entityManager.entities.get(_entityId)
      if (managerEntity) {
        return managerEntity
      }
    }

    // Strategy 4: Try direct world entity lookup
    if ((this.world as any)[_entityId]) {
      const directEntity = (this.world as any)[_entityId]
      if (directEntity && (directEntity.position || directEntity.data?.position)) {
        return directEntity
      }
    }

    console.warn(`[NavigationSystem] Entity ${_entityId} not found in any storage strategy`)
    return undefined
  }

  override destroy(): void {
    this.activePaths.clear()
    super.destroy()
  }
}
