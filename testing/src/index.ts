/**
 * RPG Testing Suite - Main Export
 *
 * Comprehensive 3D visual testing system for RPG mechanics with scenario-based
 * conditional testing, building proxies, and visual validation.
 */

// Core testing systems
export { ENTITY_COLOR_MAP } from './ColorDetector'
export { RPGTestHelpers, initializeRPGTestHelpers } from './RPGTestHelpers'

// New comprehensive testing framework
export { ScenarioTestFramework } from './ScenarioTestFramework'
export type { TestScenario, TestResult } from './ScenarioTestFramework'

// Building proxy system for 3D environments
export { BuildingProxySystem, BuildingTemplates } from './BuildingProxySystem'
export type { BuildingConfig, BuildingProxy, TriggerZone } from './BuildingProxySystem'

// Comprehensive test runner
export { ComprehensiveTestRunner, runComprehensiveRPGTests, QuickTests } from './ComprehensiveTestRunner'
export type { TestRunnerConfig, ComprehensiveTestReport } from './ComprehensiveTestRunner'

// Test scenarios
export * from '../scenarios'

// Re-export types for convenience
export type { RGBColor, DetectedEntity, EntityPosition, DetectionConfig } from './ColorDetector'

/**
 * Test mode detection
 */
export function isTestMode(): boolean {
  return (
    process.env.RPG_TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development' || // Enable in dev mode for testing
    (typeof window !== 'undefined' && (window as any).RPG_TEST_MODE === true)
  )
}

/**
 * Initialize testing infrastructure when in test mode
 */
export function initializeTestingIfNeeded(world: any): void {
  if (isTestMode()) {
    console.log('[RPG Testing] Test mode detected, initializing test helpers...')

    // Import and initialize test helpers
    import('./RPGTestHelpers')
      .then(({ initializeRPGTestHelpers }) => {
        initializeRPGTestHelpers(world)
        console.log('[RPG Testing] Test helpers initialized successfully')
      })
      .catch(error => {
        console.error('[RPG Testing] Failed to initialize test helpers:', error)
      })
  }
}

/**
 * Test scenario registry for external access
 */
export const TEST_SCENARIOS = {
  PLAYER_MOVEMENT: 'Test player spawning and movement with visual validation',
  ENTITY_SPAWNING: 'Test NPC, item, and chest spawning with color detection',
  COMBAT_SYSTEM: 'Test combat interactions, animations, and death',
  LOOT_SYSTEM: 'Test loot dropping, chest opening, and item pickup',
  EQUIPMENT_SYSTEM: 'Test equipment equipping/unequipping visual changes',
} as const

/**
 * Color validation utilities for test assertions
 */
export class TestValidation {
  /**
   * Assert that specific entities are visible in screenshot
   * (Server-side only due to Sharp dependency)
   */
  static async assertEntitiesVisible(
    imagePath: string,
    expectedEntities: string[],
    tolerance: number = 0.7
  ): Promise<{ passed: boolean; details: any }> {
    if (typeof window !== 'undefined') {
      throw new Error('assertEntitiesVisible is only available server-side')
    }

    const { ColorDetector } = await import('./ColorDetector')
    const detector = new ColorDetector()
    const detected = await detector.detectEntitiesInImage(imagePath)

    const foundTypes = detected.filter(entity => entity.confidence >= tolerance).map(entity => entity.type)

    const allFound = expectedEntities.every(type => foundTypes.includes(type))

    return {
      passed: allFound,
      details: {
        expected: expectedEntities,
        found: foundTypes,
        detected,
        missing: expectedEntities.filter(type => !foundTypes.includes(type)),
      },
    }
  }

  /**
   * Assert that movement occurred between two screenshots
   * (Server-side only due to Sharp dependency)
   */
  static async assertMovementOccurred(
    beforeImage: string,
    afterImage: string,
    entityType: string = 'player'
  ): Promise<{ passed: boolean; details: any }> {
    if (typeof window !== 'undefined') {
      throw new Error('assertMovementOccurred is only available server-side')
    }

    const { ColorDetector } = await import('./ColorDetector')
    const detector = new ColorDetector()
    const comparison = await detector.compareImages(beforeImage, afterImage)

    const entityMoved = comparison.moved.some(movement => movement.type === entityType)

    return {
      passed: entityMoved,
      details: {
        entityType,
        moved: comparison.moved,
        added: comparison.added,
        removed: comparison.removed,
      },
    }
  }

  /**
   * Assert that new entities appeared (spawning test)
   * (Server-side only due to Sharp dependency)
   */
  static async assertEntitiesSpawned(
    beforeImage: string,
    afterImage: string,
    expectedNewEntities: string[]
  ): Promise<{ passed: boolean; details: any }> {
    if (typeof window !== 'undefined') {
      throw new Error('assertEntitiesSpawned is only available server-side')
    }

    const { ColorDetector } = await import('./ColorDetector')
    const detector = new ColorDetector()
    const comparison = await detector.compareImages(beforeImage, afterImage)

    const spawnedTypes = comparison.added.map(entity => entity.type)
    const allSpawned = expectedNewEntities.every(type => spawnedTypes.includes(type))

    return {
      passed: allSpawned,
      details: {
        expected: expectedNewEntities,
        spawned: spawnedTypes,
        added: comparison.added,
        missing: expectedNewEntities.filter(type => !spawnedTypes.includes(type)),
      },
    }
  }
}

/**
 * Test report generation utilities
 */
export class TestReporting {
  /**
   * Generate test summary for CI/CD integration
   */
  static generateCISummary(testResults: any[]): string {
    const total = testResults.length
    const passed = testResults.filter(r => r.passed).length
    const failed = total - passed

    const summary = [
      '## 🎮 RPG Visual Test Results',
      '',
      `- **Total Tests:** ${total}`,
      `- **Passed:** ${passed} ✅`,
      `- **Failed:** ${failed} ${failed > 0 ? '❌' : ''}`,
      `- **Success Rate:** ${((passed / total) * 100).toFixed(1)}%`,
      '',
    ]

    if (failed > 0) {
      summary.push('### Failed Tests:')
      testResults
        .filter(r => !r.passed)
        .forEach(test => {
          summary.push(`- **${test.name}:** ${test.validation?.details?.missing?.join(', ') || 'See logs for details'}`)
        })
    }

    return summary.join('\n')
  }

  /**
   * Generate detailed HTML report with embedded media
   */
  static generateDetailedReport(_testResults: any[], _outputPath: string): Promise<void> {
    // This would generate the comprehensive HTML report
    // Implementation details in the main test runner
    return Promise.resolve()
  }
}

/**
 * Performance monitoring for visual tests
 */
export class TestPerformance {
  private static metrics: Map<string, number[]> = new Map()

  static recordTestDuration(testName: string, duration: number): void {
    if (!this.metrics.has(testName)) {
      this.metrics.set(testName, [])
    }
    this.metrics.get(testName)!.push(duration)
  }

  static getAverageDuration(testName: string): number {
    const durations = this.metrics.get(testName) || []
    return durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0
  }

  static getAllMetrics(): Record<string, { avg: number; count: number; total: number }> {
    const result: Record<string, { avg: number; count: number; total: number }> = {}

    for (const [testName, durations] of this.metrics) {
      const total = durations.reduce((sum, d) => sum + d, 0)
      result[testName] = {
        avg: total / durations.length,
        count: durations.length,
        total,
      }
    }

    return result
  }
}

// Initialize testing if in test mode
if (typeof window !== 'undefined') {
  // Browser environment - wait for world to be available
  const checkForWorld = () => {
    if ((window as any).world) {
      // Always initialize test helpers in development mode for easier testing
      console.log('[RPG Testing] World detected, initializing test helpers...')

      // Import and initialize test helpers directly
      import('./RPGTestHelpers')
        .then(({ initializeRPGTestHelpers }) => {
          initializeRPGTestHelpers((window as any).world)
          console.log('[RPG Testing] Test helpers initialized successfully')
        })
        .catch(error => {
          console.error('[RPG Testing] Failed to initialize test helpers:', error)
        })
    } else {
      setTimeout(checkForWorld, 100)
    }
  }
  checkForWorld()
}
