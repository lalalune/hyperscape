/**
 * Test framework type definitions
 */

import { World } from '@hyperfy/sdk'

/**
 * Test scenario configuration
 */
export interface TestScenario {
  id: string
  name: string
  description: string
  category?: string
  tags?: string[]
  timeout?: number
  
  setup(context: TestContext): Promise<void>
  execute(context: TestContext): Promise<void>
  validate(context: TestContext): Promise<TestValidation>
  cleanup(context: TestContext): Promise<void>
}

/**
 * Test context provided to scenarios
 */
export interface TestContext {
  world: World
  framework: any
  helpers: TestHelpers
  data: Map<string, any>
  
  log(message: string): void
  warn(message: string): void
  error(message: string): void
  
  wait(ms: number): Promise<void>
  expectCondition(condition: () => boolean, timeout?: number): Promise<void>
}

/**
 * Test helpers for common operations
 */
export interface TestHelpers {
  getEntity(id: string): any
  getAllEntities(): Map<string, any>
  waitForEntity(id: string, timeout?: number): Promise<any>
  
  invokeAPI(method: string, ...args: any[]): any
  emitEvent(event: string, data: any): void
  listenForEvent(event: string, timeout?: number): Promise<any>
  
  takeScreenshot(name: string): Promise<void>
  captureMetrics(): TestMetrics
}

/**
 * Test validation result
 */
export interface TestValidation {
  passed: boolean
  failures: ValidationFailure[]
  warnings: string[]
  metrics?: TestMetrics
}

/**
 * Validation failure details
 */
export interface ValidationFailure {
  type: 'assertion' | 'exception' | 'timeout' | 'other'
  message: string
  expected?: any
  actual?: any
  stack?: string
}

/**
 * Test performance metrics
 */
export interface TestMetrics {
  duration: number
  entityCount: number
  memoryUsage: number
  fps?: number
  customMetrics?: Record<string, number>
}

/**
 * Test result
 */
export interface TestResult {
  scenarioId: string
  scenarioName: string
  status: 'passed' | 'failed' | 'skipped' | 'error'
  startTime: number
  endTime: number
  duration: number
  
  validation?: TestValidation
  error?: Error
  logs: string[]
  screenshots: string[]
}

/**
 * Test runner configuration
 */
export interface TestRunnerConfig {
  scenarios?: string[] | TestScenario[]
  categories?: string[]
  tags?: string[]
  parallel?: boolean
  maxConcurrent?: number
  timeout?: number
  retries?: number
  
  outputDir?: string
  generateReport?: boolean
  captureScreenshots?: boolean
  verbose?: boolean
}

/**
 * Test report
 */
export interface TestReport {
  timestamp: number
  duration: number
  config: TestRunnerConfig
  
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    errorRate: number
  }
  
  results: TestResult[]
  metrics?: AggregateMetrics
}

/**
 * Aggregate test metrics
 */
export interface AggregateMetrics {
  avgDuration: number
  maxDuration: number
  minDuration: number
  avgEntityCount: number
  maxEntityCount: number
  avgMemoryUsage: number
  maxMemoryUsage: number
}

/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
  pluginPath?: string
  pluginModule?: any
  config?: any
}

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  duration: number
  rampUpTime?: number
  targetLoad: number
  
  scenarios: Array<{
    scenario: TestScenario
    weight: number
    users: number
  }>
  
  metrics?: {
    interval?: number
    detailed?: boolean
  }
}

/**
 * Load test metrics
 */
export interface LoadTestMetrics {
  timestamp: number
  activeUsers: number
  completedScenarios: number
  failedScenarios: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  throughput: number
  errorRate: number
}

/**
 * Visual test configuration
 */
export interface VisualTestConfig {
  baselineDir?: string
  outputDir?: string
  threshold?: number
  captureDelay?: number
  viewport?: {
    width: number
    height: number
  }
} 