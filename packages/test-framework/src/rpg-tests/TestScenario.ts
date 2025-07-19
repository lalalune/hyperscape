import { promises as fs } from 'fs'
import { join } from 'path'

export interface TestResult {
  phase: string
  passed: boolean
  screenshotPath: string
  pixelAnalysis: any
  errors: string[]
  warnings: string[]
  sceneHierarchy: any
  spatialData: any
  logs: string[]
}

export interface WorldConfig {
  worldName: string
  apps: Array<{
    type: string
    position: { x: number; y: number; z: number }
    config: Record<string, any>
  }>
}

export abstract class TestScenario {
  abstract name: string
  abstract description: string
  
  protected results: TestResult[] = []
  protected startTime: number = 0
  protected endTime: number = 0

  constructor(
    protected hyperfyUrl: string = 'http://localhost:3000',
    protected outputDir: string = './test-results'
  ) {}

  abstract createTestWorld(): Promise<void>
  abstract runTest(): Promise<void>
  abstract validateResults(): Promise<boolean>
  abstract cleanup(): Promise<void>

  async execute(): Promise<{
    passed: boolean
    duration: number
    results: TestResult[]
    summary: string
  }> {
    this.startTime = Date.now()
    
    console.log(`[TestScenario] Starting test: ${this.name}`)
    console.log(`[TestScenario] Description: ${this.description}`)
    
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true })
      
      // Create test world
      console.log(`[TestScenario] Creating test world...`)
      await this.createTestWorld()
      
      // Wait for world to stabilize
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Run the test
      console.log(`[TestScenario] Running test...`)
      await this.runTest()
      
      // Validate results
      console.log(`[TestScenario] Validating results...`)
      const passed = await this.validateResults()
      
      // Cleanup
      console.log(`[TestScenario] Cleaning up...`)
      await this.cleanup()
      
      this.endTime = Date.now()
      const duration = this.endTime - this.startTime
      
      const summary = this.generateSummary(passed, duration)
      
      // Save results
      await this.saveResults(passed, duration, summary)
      
      console.log(`[TestScenario] Test completed: ${this.name}`)
      console.log(`[TestScenario] Passed: ${passed}`)
      console.log(`[TestScenario] Duration: ${duration}ms`)
      
      return {
        passed,
        duration,
        results: this.results,
        summary
      }
      
    } catch (error) {
      this.endTime = Date.now()
      const duration = this.endTime - this.startTime
      
      const errorResult: TestResult = {
        phase: 'error',
        passed: false,
        screenshotPath: '',
        pixelAnalysis: null,
        errors: [`Test execution failed: ${error}`],
        warnings: [],
        sceneHierarchy: null,
        spatialData: null,
        logs: []
      }
      
      this.results.push(errorResult)
      
      const summary = this.generateSummary(false, duration)
      await this.saveResults(false, duration, summary)
      
      console.error(`[TestScenario] Test failed: ${this.name}`, error)
      
      return {
        passed: false,
        duration,
        results: this.results,
        summary
      }
    }
  }

  protected async deployWorld(config: WorldConfig): Promise<void> {
    console.log(`[TestScenario] Deploying world: ${config.worldName}`)
    
    // Create world directory
    const worldDir = join(this.outputDir, 'worlds', config.worldName)
    await fs.mkdir(worldDir, { recursive: true })
    
    // Create manifest.json
    const manifest = {
      name: config.worldName,
      apps: config.apps.map(app => `${app.type}.hyp`)
    }
    
    await fs.writeFile(
      join(worldDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )
    
    // Create app files
    for (const app of config.apps) {
      const appContent = this.generateAppContent(app)
      await fs.writeFile(
        join(worldDir, `${app.type}.hyp`),
        appContent
      )
    }
    
    console.log(`[TestScenario] World deployed: ${config.worldName}`)
  }

  protected generateAppContent(app: {
    type: string
    position: { x: number; y: number; z: number }
    config: Record<string, any>
  }): string {
    const configEntries = Object.entries(app.config)
      .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
      .join(',\n')

    return `// Test ${app.type} for visual testing
app.configure([
${Object.entries(app.config).map(([key, value]) => `  {
    key: '${key}',
    type: '${typeof value}',
    initial: ${JSON.stringify(value)}
  }`).join(',\n')}
])

// Position the app
app.position.set(${app.position.x}, ${app.position.y}, ${app.position.z})

// Create test cube for visual verification
const testCube = app.create('mesh')
testCube.geometry = 'box'
testCube.scale.set(2, 2, 2)
testCube.material.color = props.visualColor || '#ffffff'
testCube.position.set(0, 1, 0)
testCube.castShadow = true
testCube.receiveShadow = true

// Add test ID for identification
testCube.userData.testId = '${app.type.toLowerCase()}'
testCube.userData.testType = '${app.type}'

app.add(testCube)

// Add to global test registry
if (!window.testEntities) {
  window.testEntities = new Map()
}
window.testEntities.set(app.instanceId, {
  type: '${app.type}',
  position: app.position,
  config: props
})

console.log('[${app.type}] Test app initialized at (${app.position.x}, ${app.position.y}, ${app.position.z})')
`
  }

  protected async destroyWorld(worldName: string): Promise<void> {
    console.log(`[TestScenario] Destroying world: ${worldName}`)
    
    // In a real implementation, this would call Hyperfy APIs to destroy the world
    // For now, we'll just clean up the files
    const worldDir = join(this.outputDir, 'worlds', worldName)
    
    try {
      await fs.rm(worldDir, { recursive: true, force: true })
      console.log(`[TestScenario] World destroyed: ${worldName}`)
    } catch (error) {
      console.warn(`[TestScenario] Could not destroy world: ${worldName}`, error)
    }
  }

  protected generateSummary(passed: boolean, duration: number): string {
    const phases = this.results.map(r => r.phase)
    const errors = this.results.flatMap(r => r.errors)
    const warnings = this.results.flatMap(r => r.warnings)
    
    let summary = `Test: ${this.name}\n`
    summary += `Status: ${passed ? 'PASSED' : 'FAILED'}\n`
    summary += `Duration: ${duration}ms\n`
    summary += `Phases: ${phases.join(', ')}\n`
    
    if (errors.length > 0) {
      summary += `\nErrors (${errors.length}):\n`
      errors.forEach((error, i) => {
        summary += `  ${i + 1}. ${error}\n`
      })
    }
    
    if (warnings.length > 0) {
      summary += `\nWarnings (${warnings.length}):\n`
      warnings.forEach((warning, i) => {
        summary += `  ${i + 1}. ${warning}\n`
      })
    }
    
    return summary
  }

  protected async saveResults(passed: boolean, duration: number, summary: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${this.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`
    const resultsPath = join(this.outputDir, 'results', filename)
    
    await fs.mkdir(join(this.outputDir, 'results'), { recursive: true })
    
    const resultsData = {
      name: this.name,
      description: this.description,
      passed,
      duration,
      startTime: this.startTime,
      endTime: this.endTime,
      summary,
      results: this.results
    }
    
    await fs.writeFile(resultsPath, JSON.stringify(resultsData, null, 2))
    
    // Also save summary as text
    const summaryPath = join(this.outputDir, 'results', `${this.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.txt`)
    await fs.writeFile(summaryPath, summary)
    
    console.log(`[TestScenario] Results saved: ${resultsPath}`)
  }
}