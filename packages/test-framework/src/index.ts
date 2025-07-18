/**
 * @hyperscape/test-framework
 * 
 * Testing framework for Hyperfy applications
 */

export * from './core/TestFramework'
export * from './core/TestScenario'
export * from './core/TestRunner'
export * from './core/TestResult'

export * from './helpers/PluginLoader'
export * from './helpers/TestHelpers'
export * from './helpers/ValidationHelpers'

export * from './runners/ScenarioRunner'
export * from './runners/LoadTestRunner'
export * from './runners/VisualTestRunner'

export * from './types'

import { TestFramework } from './core/TestFramework'

/**
 * Create a new test framework instance
 */
export function createTestFramework(): TestFramework {
  return new TestFramework()
}

// Default export
export default createTestFramework 