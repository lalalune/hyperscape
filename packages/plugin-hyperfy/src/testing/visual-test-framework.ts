import { IAgentRuntime, logger } from '../types/eliza-mock'
import { HyperfyService } from '../service'
// Mock types until rpg-state-manager is available
type RPGStateManager = any
type RPGPlayerState = any

/**
 * Visual test verification types
 */
export interface VisualCheck {
  entityType: string
  expectedColor: string | number
  position?: { x: number; y: number; z: number }
  shouldExist: boolean
  tolerance?: number
}

export interface StateCheck {
  property: string
  expectedValue: any
  operator: 'equals' | 'greater' | 'less' | 'contains' | 'matches'
}

export interface TestVerification {
  type: 'visual' | 'state' | 'both'
  visualChecks?: VisualCheck[]
  stateChecks?: StateCheck[]
  screenshot?: boolean
}

/**
 * Concrete test result with actual verification
 */
export interface TestResult {
  passed: boolean
  failures: string[]
  screenshots: string[]
  stateSnapshot: any
  timestamp: Date
}

/**
 * Visual Test Framework using ColorDetector and state verification
 */
export class VisualTestFramework {
  private runtime: IAgentRuntime
  private service: HyperfyService
  private colorDetector: any // Will be the actual ColorDetector instance
  private visualTemplates: Map<string, any> = new Map()

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
    this.service = runtime.getService<HyperfyService>(
      HyperfyService.serviceName
    )!
  }

  /**
   * Initialize visual testing with ColorDetector
   */
  async initialize(): Promise<void> {
    logger.info('[VisualTestFramework] Initializing visual testing...')

    // Load visual templates from hyperfy/src/rpg/config/visuals/templates.json
    await this.loadVisualTemplates()

    // Initialize ColorDetector if available
    const world = this.service.getWorld()
    if (world?.colorDetector) {
      this.colorDetector = world.colorDetector
    } else {
      logger.warn('[VisualTestFramework] ColorDetector not available in world')
    }
  }

  /**
   * Load predefined visual templates
   */
  private async loadVisualTemplates(): Promise<void> {
    // These are from the templates.json mentioned in the analysis
    const templates = {
      items: {
        sword: { color: 16729156, hex: '#FF4444' },
        bow: { color: 9127187, hex: '#8B4513' },
        staff: { color: 9699539, hex: '#9400D3' },
        potion: { color: 16724736, hex: '#FF3300' },
        food: { color: 16753920, hex: '#FFA500' },
      },
      npcs: {
        goblin: { color: 2263842, hex: '#228822' },
        skeleton: { color: 16119260, hex: '#F5F5DC' },
        guard: { color: 4356961, hex: '#427361' },
        merchant: { color: 8421504, hex: '#808080' },
        quest_giver: { color: 16776960, hex: '#FFFF00' },
      },
      resources: {
        tree: { color: 2263842, hex: '#228822' },
        iron_rock: { color: 4210752, hex: '#404040' },
        gold_rock: { color: 16766720, hex: '#FFD700' },
        fishing_spot: { color: 255, hex: '#0000FF' },
      },
      special: {
        player: { color: 16729411, hex: '#FF4543' },
        damage_indicator: { color: 16711680, hex: '#FF0000' },
        heal_indicator: { color: 65280, hex: '#00FF00' },
        spawn_point: { color: 65280, hex: '#00FF00' },
      },
    }

    // Store templates for easy access
    Object.entries(templates).forEach(([category, items]) => {
      Object.entries(items).forEach(([name, data]) => {
        this.visualTemplates.set(`${category}.${name}`, data)
      })
    })
  }

  /**
   * Perform visual verification using ColorDetector
   */
  async verifyVisual(
    checks: VisualCheck[]
  ): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = []

    if (!this.colorDetector) {
      failures.push('ColorDetector not available')
      return { passed: false, failures }
    }

    for (const check of checks) {
      try {
        const template = this.visualTemplates.get(check.entityType)
        if (!template) {
          failures.push(
            `No visual template for entity type: ${check.entityType}`
          )
          continue
        }

        const expectedColor = check.expectedColor || template.color

        // Detect entities of this color in the scene
        const detectedEntities = await this.colorDetector.detectEntities(
          expectedColor,
          {
            tolerance: check.tolerance || 10,
            minClusterSize: 20,
          }
        )

        const entityExists = detectedEntities && detectedEntities.length > 0

        if (check.shouldExist && !entityExists) {
          failures.push(
            `Expected ${check.entityType} (color: ${expectedColor}) not found`
          )
        } else if (!check.shouldExist && entityExists) {
          failures.push(
            `Unexpected ${check.entityType} (color: ${expectedColor}) found`
          )
        }

        // Check position if specified
        if (check.position && entityExists) {
          const entity = detectedEntities[0]
          const distance = this.calculateDistance(
            entity.position,
            check.position
          )
          if (distance > 5) {
            // 5 unit tolerance
            failures.push(
              `${check.entityType} at wrong position. Expected: ${JSON.stringify(check.position)}, Found: ${JSON.stringify(entity.position)}`
            )
          }
        }
      } catch (error) {
        failures.push(
          `Visual check failed for ${check.entityType}: ${error.message}`
        )
      }
    }

    return { passed: failures.length === 0, failures }
  }

  /**
   * Perform state verification
   */
  async verifyState(
    checks: StateCheck[]
  ): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = []
    const rpgManager = this.service.getRPGStateManager?.()

    if (!rpgManager) {
      failures.push('RPG State Manager not available')
      return { passed: false, failures }
    }

    const state = rpgManager.getPlayerState()

    for (const check of checks) {
      try {
        const actualValue = this.getNestedProperty(state, check.property)
        const passed = this.compareValues(
          actualValue,
          check.expectedValue,
          check.operator
        )

        if (!passed) {
          failures.push(
            `State check failed: ${check.property} expected ${check.operator} ${check.expectedValue}, got ${actualValue}`
          )
        }
      } catch (error) {
        failures.push(
          `State check error for ${check.property}: ${error.message}`
        )
      }
    }

    return { passed: failures.length === 0, failures }
  }

  /**
   * Take screenshot for visual record
   */
  async captureScreenshot(name: string): Promise<string> {
    const puppeteerManager = this.service.getPuppeteerManager()
    if (!puppeteerManager) {
      logger.warn(
        '[VisualTestFramework] PuppeteerManager not available for screenshot'
      )
      return ''
    }

    try {
      const screenshot = await puppeteerManager.page?.screenshot({
        encoding: 'base64',
        fullPage: false,
      })

      // In a real implementation, save to file system
      const filename = `screenshot-${name}-${Date.now()}.png`
      logger.info(`[VisualTestFramework] Screenshot captured: ${filename}`)
      return (screenshot as string) || ''
    } catch (error) {
      logger.error('[VisualTestFramework] Screenshot failed:', error)
      return ''
    }
  }

  /**
   * Run a complete test with visual and state verification
   */
  async runTest(
    name: string,
    verification: TestVerification
  ): Promise<TestResult> {
    logger.info(`[VisualTestFramework] Running test: ${name}`)

    const result: TestResult = {
      passed: true,
      failures: [],
      screenshots: [],
      stateSnapshot: null,
      timestamp: new Date(),
    }

    // Capture initial state
    const rpgManager = this.service.getRPGStateManager?.()
    if (rpgManager) {
      result.stateSnapshot = rpgManager.getPlayerState()
    }

    // Visual verification
    if (verification.visualChecks && verification.visualChecks.length > 0) {
      const visualResult = await this.verifyVisual(verification.visualChecks)
      if (!visualResult.passed) {
        result.passed = false
        result.failures.push(...visualResult.failures)
      }
    }

    // State verification
    if (verification.stateChecks && verification.stateChecks.length > 0) {
      const stateResult = await this.verifyState(verification.stateChecks)
      if (!stateResult.passed) {
        result.passed = false
        result.failures.push(...stateResult.failures)
      }
    }

    // Screenshot capture
    if (verification.screenshot) {
      const screenshot = await this.captureScreenshot(name)
      if (screenshot) {
        result.screenshots.push(screenshot)
      }
    }

    // Log result
    if (result.passed) {
      logger.info(`[VisualTestFramework] ✅ Test PASSED: ${name}`)
    } else {
      logger.error(`[VisualTestFramework] ❌ Test FAILED: ${name}`)
      result.failures.forEach(failure => logger.error(`  - ${failure}`))
    }

    return result
  }

  /**
   * Helper to calculate distance between positions
   */
  private calculateDistance(pos1: any, pos2: any): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
        Math.pow(pos1.y - pos2.y, 2) +
        Math.pow(pos1.z - pos2.z, 2)
    )
  }

  /**
   * Helper to get nested property from object
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj)
  }

  /**
   * Helper to compare values based on operator
   */
  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected
      case 'greater':
        return actual > expected
      case 'less':
        return actual < expected
      case 'contains':
        return Array.isArray(actual)
          ? actual.includes(expected)
          : String(actual).includes(String(expected))
      case 'matches':
        return new RegExp(expected).test(String(actual))
      default:
        return false
    }
  }
}

/**
 * Test helpers for common verifications
 */
export class RPGTestHelpers {
  /**
   * Verify combat occurred with damage
   */
  static combatVerification(
    targetEntity: string,
    minDamage: number
  ): TestVerification {
    return {
      type: 'both',
      visualChecks: [
        { entityType: targetEntity, expectedColor: null, shouldExist: true },
        {
          entityType: 'special.damage_indicator',
          expectedColor: null,
          shouldExist: true,
        },
      ],
      stateChecks: [
        {
          property: 'combat.inCombat',
          expectedValue: true,
          operator: 'equals',
        },
        {
          property: 'combat.target',
          expectedValue: targetEntity,
          operator: 'contains',
        },
      ],
      screenshot: true,
    }
  }

  /**
   * Verify inventory change
   */
  static inventoryVerification(
    itemName: string,
    expectedQuantity: number
  ): TestVerification {
    return {
      type: 'state',
      stateChecks: [
        {
          property: 'inventory.items',
          expectedValue: itemName,
          operator: 'contains',
        },
      ],
    }
  }

  /**
   * Verify skill progression
   */
  static skillVerification(
    skillName: string,
    minLevel: number
  ): TestVerification {
    return {
      type: 'state',
      stateChecks: [
        {
          property: `skills.${skillName}.level`,
          expectedValue: minLevel,
          operator: 'greater',
        },
      ],
    }
  }

  /**
   * Verify quest completion
   */
  static questVerification(questName: string): TestVerification {
    return {
      type: 'state',
      stateChecks: [
        {
          property: 'quests.completed',
          expectedValue: questName,
          operator: 'contains',
        },
      ],
    }
  }

  /**
   * Verify player position
   */
  static positionVerification(
    expectedPos: { x: number; y: number; z: number },
    tolerance: number = 5
  ): TestVerification {
    return {
      type: 'both',
      visualChecks: [
        {
          entityType: 'special.player',
          expectedColor: null,
          position: expectedPos,
          shouldExist: true,
        },
      ],
      stateChecks: [
        {
          property: 'location.coordinates.x',
          expectedValue: expectedPos.x - tolerance,
          operator: 'greater',
        },
        {
          property: 'location.coordinates.x',
          expectedValue: expectedPos.x + tolerance,
          operator: 'less',
        },
      ],
    }
  }
}
