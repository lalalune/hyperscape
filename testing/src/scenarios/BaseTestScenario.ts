import type { World } from '../../../types'
import {
  Vector3,
  RPGEntity,
  InventoryComponent,
  StatsComponent,
  CombatComponent,
  MovementComponent,
  ResourceComponent,
  ItemComponent,
  NPCComponent,
  QuestComponent,
  ConstructionComponent,
  ConstructionSiteComponent,
  SkillsComponent,
} from '../../types/index'

/**
 * Base class for all test scenarios
 * Provides common functionality for entity management, logging, and validation
 */
export abstract class BaseTestScenario {
  protected world: World
  protected scenarioName: string
  protected scenarioColor: string
  protected testEntities: Map<string, RPGEntity> = new Map()
  protected progressLog: string[] = []
  protected startTime: number = 0
  protected endTime: number = 0

  constructor(world: World, scenarioName: string, scenarioColor: string) {
    this.world = world
    this.scenarioName = scenarioName
    this.scenarioColor = scenarioColor
  }

  /**
   * Set up the scenario (spawn entities, configure components, etc.)
   */
  abstract setup(): Promise<boolean>

  /**
   * Execute the main scenario logic
   */
  abstract execute(): Promise<boolean>

  /**
   * Validate the scenario results
   */
  abstract validate(): Promise<boolean>

  /**
   * Clean up spawned entities and reset state
   */
  abstract cleanup(): Promise<void>

  /**
   * Run the complete scenario workflow
   */
  async run(): Promise<{ success: boolean; duration: number; logs: string[] }> {
    this.startTime = Date.now()
    this.progressLog = []

    console.log(`[${this.scenarioName}] Starting scenario...`)

    try {
      // Setup phase
      this.logProgress(`🔧 Setting up ${this.scenarioName}...`)
      const setupSuccess = await this.setup()
      if (!setupSuccess) {
        throw new Error('Scenario setup failed')
      }

      // Execution phase
      this.logProgress(`▶️ Executing ${this.scenarioName}...`)
      const executeSuccess = await this.execute()
      if (!executeSuccess) {
        throw new Error('Scenario execution failed')
      }

      // Validation phase
      this.logProgress(`✅ Validating ${this.scenarioName}...`)
      const validateSuccess = await this.validate()
      if (!validateSuccess) {
        throw new Error('Scenario validation failed')
      }

      this.endTime = Date.now()
      const duration = this.endTime - this.startTime

      this.logProgress(`🎉 ${this.scenarioName} completed successfully in ${duration}ms`)

      return {
        success: true,
        duration,
        logs: [...this.progressLog],
      }
    } catch (error) {
      this.endTime = Date.now()
      const duration = this.endTime - this.startTime

      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logProgress(`❌ ${this.scenarioName} failed: ${errorMessage}`)

      return {
        success: false,
        duration,
        logs: [...this.progressLog],
      }
    } finally {
      // Always cleanup
      await this.cleanup()
    }
  }

  /**
   * Spawn a test entity with the specified properties
   */
  protected spawnTestEntity(id: string, type: string, position: Vector3, color: string): RPGEntity | null {
    try {
      // Try different entity creation methods based on world type
      let entity: RPGEntity | null = null

      // Method 1: Try standard Hyperfy entity creation
      if (this.world.entities?.create) {
        const entityData = {
          id: `test_${id}_${Date.now()}`,
          type,
          position,
          components: new Map(),
          data: { id: `test_${id}_${Date.now()}`, type, position },
        }

        entity = this.world.entities.create(`test_${id}`, entityData) as RPGEntity
      }

      // Method 2: Try alternative entity creation
      if (!entity && (this.world as any).entities?.items) {
        const entityId = `test_${id}_${Date.now()}`
        entity = {
          id: entityId,
          data: { id: entityId, type, position },
          position,
          components: new Map(),
          getComponent: function <T>(componentType: string): T | null {
            return (this.components.get(componentType) as T) || null
          },
          hasComponent: function (componentType: string): boolean {
            return this.components.has(componentType)
          },
          addComponent: function (componentType: string, component: any): void {
            this.components.set(componentType, { type: componentType, ...component })
          },
        } as RPGEntity
        ;(this.world as any).entities.items.set(entityId, entity)
      }

      // Method 3: Create mock entity for testing
      if (!entity) {
        const entityId = `test_${id}_${Date.now()}`
        entity = {
          id: entityId,
          data: { id: entityId, type, position },
          position,
          components: new Map(),
          getComponent: function <T>(componentType: string): T | null {
            return (this.components.get(componentType) as T) || null
          },
          hasComponent: function (componentType: string): boolean {
            return this.components.has(componentType)
          },
          addComponent: function (componentType: string, component: any): void {
            this.components.set(componentType, { type: componentType, ...component })
          },
        } as RPGEntity
      }

      if (entity) {
        // Add visual component with color
        entity.addComponent('visual', {
          type: 'visual',
          color: color,
          model: type === 'npc' ? 'humanoid' : type === 'item' ? 'item' : 'cube',
          scale: { x: 1, y: 1, z: 1 },
          visible: true,
          highlighted: false,
        })

        // Add position component
        entity.addComponent('position', {
          type: 'position',
          x: position.x,
          y: position.y,
          z: position.z,
          rotation: { x: 0, y: 0, z: 0 },
        })

        this.testEntities.set(id, entity)
        console.log(
          `[${this.scenarioName}] Spawned ${type} entity '${id}' at (${position.x}, ${position.y}, ${position.z}) with color ${color}`
        )

        return entity
      }

      return null
    } catch (error) {
      console.error(`[${this.scenarioName}] Failed to spawn entity '${id}':`, error)
      return null
    }
  }

  /**
   * Remove a test entity
   */
  protected removeTestEntity(id: string): void {
    const entity = this.testEntities.get(id)
    if (entity) {
      // Try to remove from world entities
      if (this.world.entities?.remove) {
        this.world.entities.remove(entity.id)
      } else if ((this.world as any).entities?.items) {
        ;(this.world as any).entities.items.delete(entity.id)
      }

      this.testEntities.delete(id)
      console.log(`[${this.scenarioName}] Removed entity '${id}'`)
    }
  }

  /**
   * Log progress message
   */
  protected logProgress(message: string): void {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    this.progressLog.push(logMessage)
    console.log(`[${this.scenarioName}] ${message}`)
  }

  /**
   * Wait for a specified duration
   */
  protected async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get scenario results summary
   */
  getResultsSummary(): {
    name: string
    color: string
    duration: number
    logs: string[]
    entityCount: number
  } {
    return {
      name: this.scenarioName,
      color: this.scenarioColor,
      duration: this.endTime - this.startTime,
      logs: [...this.progressLog],
      entityCount: this.testEntities.size,
    }
  }

  /**
   * Verify entity has expected component
   */
  protected verifyEntityComponent(entity: RPGEntity, componentType: string): boolean {
    const hasComponent = entity.hasComponent(componentType)
    if (!hasComponent) {
      this.logProgress(`❌ Entity ${entity.id} missing ${componentType} component`)
    }
    return hasComponent
  }

  /**
   * Verify entity position
   */
  protected verifyEntityPosition(entity: RPGEntity, expectedPosition: Vector3, tolerance = 1.0): boolean {
    const position = entity.position
    const distance = Math.sqrt(
      Math.pow(position.x - expectedPosition.x, 2) +
        Math.pow(position.y - expectedPosition.y, 2) +
        Math.pow(position.z - expectedPosition.z, 2)
    )

    if (distance > tolerance) {
      this.logProgress(
        `❌ Entity ${entity.id} position mismatch. Expected: ${JSON.stringify(expectedPosition)}, Actual: ${JSON.stringify(position)}`
      )
      return false
    }

    return true
  }
}
