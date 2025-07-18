import { World } from '@hyperfy/sdk'
import { TestScenario, TestContext, TestHelpers, TestMetrics } from '../types'
import { TestRunner } from './TestRunner'
import { PluginLoader } from '../helpers/PluginLoader'
import { TestHelpers as TestHelpersImpl } from '../helpers/TestHelpers'

/**
 * Main test framework class
 */
export class TestFramework {
  private world?: World
  private plugin?: any
  private pluginLoader: PluginLoader
  private scenarios: Map<string, TestScenario> = new Map()
  private runner?: TestRunner
  
  constructor() {
    this.pluginLoader = new PluginLoader()
  }
  
  /**
   * Initialize the test framework with a plugin
   */
  async initialize(config: {
    pluginPath?: string
    pluginModule?: any
    pluginConfig?: any
  }): Promise<void> {
    console.log('[TestFramework] Initializing...')
    
    // Load the plugin
    const { world, plugin } = await this.pluginLoader.loadPlugin(config)
    this.world = world
    this.plugin = plugin
    
    // Create test runner
    this.runner = new TestRunner(this)
    
    console.log('[TestFramework] Initialized successfully')
  }
  
  /**
   * Register a test scenario
   */
  registerScenario(scenario: TestScenario): void {
    if (this.scenarios.has(scenario.id)) {
      throw new Error(`Scenario with id '${scenario.id}' already registered`)
    }
    
    this.scenarios.set(scenario.id, scenario)
    console.log(`[TestFramework] Registered scenario: ${scenario.name}`)
  }
  
  /**
   * Register multiple scenarios
   */
  registerScenarios(scenarios: TestScenario[]): void {
    scenarios.forEach(scenario => this.registerScenario(scenario))
  }
  
  /**
   * Get a registered scenario
   */
  getScenario(id: string): TestScenario | undefined {
    return this.scenarios.get(id)
  }
  
  /**
   * Get all scenarios
   */
  getAllScenarios(): TestScenario[] {
    return Array.from(this.scenarios.values())
  }
  
  /**
   * Get scenarios by category
   */
  getScenariosByCategory(category: string): TestScenario[] {
    return this.getAllScenarios().filter(s => s.category === category)
  }
  
  /**
   * Get scenarios by tags
   */
  getScenariosByTags(tags: string[]): TestScenario[] {
    return this.getAllScenarios().filter(s => 
      s.tags && tags.some(tag => s.tags!.includes(tag))
    )
  }
  
  /**
   * Create a test context for scenarios
   */
  createTestContext(): TestContext {
    if (!this.world) {
      throw new Error('Framework not initialized')
    }
    
    const logs: string[] = []
    const data = new Map<string, any>()
    const helpers = new TestHelpersImpl(this.world, this.plugin)
    
    return {
      world: this.world,
      framework: this,
      helpers,
      data,
      
      log: (message: string) => {
        const timestamp = new Date().toISOString()
        const logMessage = `[${timestamp}] ${message}`
        logs.push(logMessage)
        console.log(logMessage)
      },
      
      warn: (message: string) => {
        const timestamp = new Date().toISOString()
        const logMessage = `[${timestamp}] ⚠️ ${message}`
        logs.push(logMessage)
        console.warn(logMessage)
      },
      
      error: (message: string) => {
        const timestamp = new Date().toISOString()
        const logMessage = `[${timestamp}] ❌ ${message}`
        logs.push(logMessage)
        console.error(logMessage)
      },
      
      wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
      
      expectCondition: async (condition: () => boolean, timeout = 5000) => {
        const start = Date.now()
        while (Date.now() - start < timeout) {
          if (condition()) return
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        throw new Error('Condition not met within timeout')
      }
    }
  }
  
  /**
   * Get the test runner
   */
  getRunner(): TestRunner {
    if (!this.runner) {
      throw new Error('Framework not initialized')
    }
    return this.runner
  }
  
  /**
   * Get the loaded plugin
   */
  getPlugin(): any {
    return this.plugin
  }
  
  /**
   * Get the world instance
   */
  getWorld(): World | undefined {
    return this.world
  }
  
  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    console.log('[TestFramework] Cleaning up...')
    
    if (this.plugin && this.plugin.destroy) {
      this.plugin.destroy()
    }
    
    this.scenarios.clear()
    this.world = undefined
    this.plugin = undefined
    
    console.log('[TestFramework] Cleanup complete')
  }
} 