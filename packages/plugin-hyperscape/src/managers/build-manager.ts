import { IAgentRuntime, logger, UUID } from '@elizaos/core'
import { Entity, World } from '../types/core-types'
import type { Vector3 } from '@hyperscape/hyperscape'
import type { BuildManager as IBuildManager } from '../types/core-interfaces'
import { THREE } from '@hyperscape/hyperscape'

/**
 * BuildManager handles entity creation, modification, and build system operations
 * for agents in Hyperscape worlds
 */
export class BuildManager implements IBuildManager {
  private runtime: IAgentRuntime
  private world: World | null = null
  private buildPermissions: Map<UUID, string[]> = new Map()
  private _tempVec3 = new THREE.Vector3()

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
  }

  /**
   * Set the current world for build operations
   */
  setWorld(world: World | null): void {
    this.world = world
  }

  /**
   * Create a new entity in the world
   */
  createEntity(type: string, position: Vector3, data?: any): Entity | null {
    if (!this.world) {
      logger.warn('BuildManager: No world available for entity creation')
      return null
    }

    try {
      // Get the entities system from the world
      const entities = this.world.entities
      if (!entities || !entities.add) {
        logger.warn('BuildManager: Entities system not available')
        return null
      }

      // Create entity data
      const entityData = {
        id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        position: [position.x, position.y, position.z] as [
          number,
          number,
          number,
        ],
        active: true,
        visible: true,
        ...data,
      }

      // Add entity to world
      const entity = entities.add(entityData)
      if (entity) {
        logger.info(
          `BuildManager: Created entity ${entityData.id} of type ${type}`
        )
      }

      return entityData
    } catch (error) {
      logger.error(`BuildManager: Failed to create entity: ${error}`)
      return null
    }
  }

  /**
   * Destroy an entity by ID
   */
  destroyEntity(entityId: string): boolean {
    if (!this.world) {
      logger.warn('BuildManager: No world available for entity destruction')
      return false
    }

    try {
      const entities = this.world.entities
      if (!entities || !entities.remove) {
        logger.warn('BuildManager: Entities system not available')
        return false
      }

      const success = entities.remove(entityId)
      if (success) {
        logger.info(`BuildManager: Destroyed entity ${entityId}`)
      }

      return success
    } catch (error) {
      logger.error(
        `BuildManager: Failed to destroy entity ${entityId}: ${error}`
      )
      return false
    }
  }

  /**
   * Update an entity with new data
   */
  updateEntity(entityId: string, data: any): boolean {
    if (!this.world) {
      logger.warn('BuildManager: No world available for entity update')
      return false
    }

    try {
      const entities = this.world.entities
      if (!entities || !entities.get) {
        logger.warn('BuildManager: Entities system not available')
        return false
      }

      const entity = entities.get(entityId)
      if (!entity) {
        logger.warn(`BuildManager: Entity ${entityId} not found`)
        return false
      }

      // Update entity properties
      Object.assign(entity, data)
      logger.info(`BuildManager: Updated entity ${entityId}`)
      return true
    } catch (error) {
      logger.error(
        `BuildManager: Failed to update entity ${entityId}: ${error}`
      )
      return false
    }
  }

  /**
   * Check if building is allowed at a position
   */
  canBuild(position: Vector3, type: string): boolean {
    if (!this.world) {
      return false
    }

    // Basic validation - can be extended with more complex rules
    try {
      // Check if position is within world bounds (basic check)
      const maxDistance = 1000 // Max distance from origin
      const distance = Math.sqrt(
        position.x ** 2 + position.y ** 2 + position.z ** 2
      )

      if (distance > maxDistance) {
        return false
      }

      // Check for overlapping entities (basic collision check)
      const entities = this.world.entities
      if (entities && entities.values) {
        for (const entity of entities.values()) {
          if (entity.position) {
            const entityPos = entity.position
            const dx = entityPos.x - position.x
            const dy = entityPos.y - position.y
            const dz = entityPos.z - position.z
            const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2)

            // Minimum spacing between entities
            if (distance < 2.0) {
              return false
            }
          }
        }
      }

      return true
    } catch (error) {
      logger.error(`BuildManager: Error checking build permissions: ${error}`)
      return false
    }
  }

  /**
   * Get build permissions for an agent
   */
  getBuildPermissions(agentId: UUID): string[] {
    return this.buildPermissions.get(agentId) || ['basic_build']
  }

  /**
   * Set build permissions for an agent
   */
  setBuildPermissions(agentId: UUID, permissions: string[]): void {
    this.buildPermissions.set(agentId, permissions)
    logger.info(
      `BuildManager: Set permissions for agent ${agentId}: ${permissions.join(', ')}`
    )
  }

  /**
   * Clear all build permissions
   */
  clearPermissions(): void {
    this.buildPermissions.clear()
    logger.info('BuildManager: Cleared all build permissions')
  }

  /**
   * Get stats about the current world
   */
  getWorldStats(): { entityCount: number; activeEntities: number } {
    if (!this.world || !this.world.entities) {
      return { entityCount: 0, activeEntities: 0 }
    }

    let entityCount = 0
    let activeEntities = 0

    try {
      if (this.world.entities.values) {
        for (const entity of this.world.entities.values()) {
          entityCount++
          if (entity.active !== false) {
            activeEntities++
          }
        }
      }
    } catch (error) {
      logger.error(`BuildManager: Error getting world stats: ${error}`)
    }

    return { entityCount, activeEntities }
  }

  /**
   * Translate an entity to a new position
   */
  translate(entityId: string, position: Vector3): boolean {
    if (!this.world) {
      logger.warn('BuildManager: No world available for translation')
      return false
    }

    try {
      const entity = this.world.entities.get(entityId)
      if (!entity) {
        logger.warn(`BuildManager: Entity ${entityId} not found`)
        return false
      }

      // Update entity position
      if (entity.position) {
        entity.position.copy(position)
      }

      logger.info(
        `BuildManager: Translated entity ${entityId} to position`,
        position
      )
      return true
    } catch (error) {
      logger.error('BuildManager: Translation failed:', error)
      return false
    }
  }

  /**
   * Rotate an entity
   */
  rotate(entityId: string, rotation: any): boolean {
    if (!this.world) {
      logger.warn('BuildManager: No world available for rotation')
      return false
    }

    try {
      const entity = this.world.entities.get(entityId)
      if (!entity) {
        logger.warn(`BuildManager: Entity ${entityId} not found`)
        return false
      }

      // Update entity rotation
      if (entity.rotation || entity.node.quaternion) {
        if (entity.node.quaternion) {
          entity.node.quaternion.copy(rotation)
        } else if (entity.rotation) {
          entity.rotation.copy(rotation)
        }
      }

      logger.info(`BuildManager: Rotated entity ${entityId}`)
      return true
    } catch (error) {
      logger.error('BuildManager: Rotation failed:', error)
      return false
    }
  }

  /**
   * Scale an entity
   */
  scale(entityId: string, scale: Vector3): boolean {
    if (!this.world) {
      logger.warn('BuildManager: No world available for scaling')
      return false
    }

    try {
      const entity = this.world.entities.get(entityId)
      if (!entity) {
        logger.warn(`BuildManager: Entity ${entityId} not found`)
        return false
      }

      // Update entity scale
      if (entity.scale) {
        entity.scale.copy(scale)
      }

      logger.info(`BuildManager: Scaled entity ${entityId} to`, scale)
      return true
    } catch (error) {
      logger.error('BuildManager: Scaling failed:', error)
      return false
    }
  }

  /**
   * Duplicate an entity
   */
  duplicate(entityId: string): Entity | null {
    if (!this.world) {
      logger.warn('BuildManager: No world available for duplication')
      return null
    }

    try {
      const originalEntity = this.world.entities.get(entityId)
      if (!originalEntity) {
        logger.warn(
          `BuildManager: Entity ${entityId} not found for duplication`
        )
        return null
      }

      // Create a duplicate with offset position
      const position = originalEntity.position || { x: 0, y: 0, z: 0 }
      const duplicatePosition = this._tempVec3.set(
        position.x + 1,
        position.y,
        position.z + 1
      )

      // Create new entity with same type and modified position
      const duplicate = this.createEntity(
        originalEntity.type || 'group',
        duplicatePosition,
        { ...originalEntity.data }
      )

      if (duplicate) {
        logger.info(
          `BuildManager: Duplicated entity ${entityId} as ${duplicate.id}`
        )
      }

      return duplicate
    } catch (error) {
      logger.error('BuildManager: Duplication failed:', error)
      return null
    }
  }

  /**
   * Delete an entity
   */
  delete(entityId: string): boolean {
    return this.destroyEntity(entityId)
  }

  /**
   * Import an entity from external data
   */
  importEntity(entityData: any, position?: Vector3): Entity | null {
    if (!this.world) {
      logger.warn('BuildManager: No world available for entity import')
      return null
    }

    try {
      // Use provided position or default
      const importPosition = position || this._tempVec3.set(0, 0, 0)

      // Create entity from imported data
      const entity = this.createEntity(
        entityData.type || 'group',
        importPosition,
        entityData
      )

      if (entity) {
        logger.info(`BuildManager: Imported entity as ${entity.id}`)
      }

      return entity
    } catch (error) {
      logger.error('BuildManager: Entity import failed:', error)
      return null
    }
  }
}
