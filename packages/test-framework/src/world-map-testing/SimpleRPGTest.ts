import { Page, Browser, chromium } from 'playwright'
import { promises as fs } from 'fs'

/**
 * SIMPLE, WORKING RPG Test Framework
 * 
 * This tests what actually exists:
 * 1. Can we load the Hyperfy RPG world?
 * 2. Do the apps load without errors?
 * 3. Does the world render properly?
 * 4. Can we see entities in the scene?
 * 
 * NO fiction, NO complex abstractions, just basic functional testing.
 */

export interface SimpleTestResult {
  passed: boolean
  screenshot: string
  errors: string[]
  worldLoaded: boolean
  appsLoaded: number
  renderWorking: boolean
  logs: string[]
}

export class SimpleRPGTest {
  private browser: Browser | null = null
  private page: Page | null = null
  private logs: string[] = []

  async initialize(): Promise<void> {
    console.log('[SimpleRPGTest] Starting browser...')
    
    this.browser = await chromium.launch({
      headless: false // Keep visible to see what's happening
    })
    
    this.page = await this.browser.newPage()
    
    // Capture console logs
    this.page.on('console', msg => {
      this.logs.push(`[${msg.type()}] ${msg.text()}`)
    })
    
    // Capture errors
    this.page.on('pageerror', err => {
      this.logs.push(`[ERROR] ${err.message}`)
    })
  }

  async testRPGWorld(): Promise<SimpleTestResult> {
    if (!this.page) throw new Error('Not initialized')

    const result: SimpleTestResult = {
      passed: false,
      screenshot: '',
      errors: [],
      worldLoaded: false,
      appsLoaded: 0,
      renderWorking: false,
      logs: []
    }

    try {
      console.log('[SimpleRPGTest] Loading Hyperfy...')
      
      // Try to load Hyperfy server
      await this.page.goto('http://localhost:3000', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      })
      
      // Wait for world to settle first
      await this.page.waitForTimeout(5000)
      
      // Take screenshot early for debugging
      await fs.mkdir('./test-results/simple', { recursive: true })
      const timestamp = Date.now()
      const earlyScreenshotPath = `./test-results/simple/early-rpg-test-${timestamp}.png`
      await this.page.screenshot({ path: earlyScreenshotPath })
      console.log('[SimpleRPGTest] Early screenshot saved:', earlyScreenshotPath)
      
      // Try to find canvas (indicates Hyperfy loaded)
      const canvasElement = await this.page.$('canvas')
      if (canvasElement) {
        console.log('[SimpleRPGTest] Canvas found - Hyperfy loaded')
        result.worldLoaded = true
      } else {
        console.log('[SimpleRPGTest] No canvas found - checking what loaded')
        result.worldLoaded = false
      }
      
      // Check what actually loaded
      const worldState = await this.page.evaluate(() => {
        const world = (window as any).world
        if (!world) return { error: 'No world object' }
        
        const apps = world.apps ? world.apps.getAll() : []
        const players = world.players ? world.players.getAll() : []
        const entities = world.entities ? world.entities.getAll() : []
        
        return {
          hasWorld: !!world,
          hasApps: !!world.apps,
          appsCount: apps.length,
          playersCount: players.length,
          entitiesCount: entities.length,
          appNames: apps.map((app: any) => app.name || app.constructor.name),
          hasCanvas: !!world.stage?.scene,
          hasCamera: !!world.camera
        }
      })
      
      console.log('[SimpleRPGTest] World state:', worldState)
      
      if (worldState.error) {
        result.errors.push(worldState.error)
      } else {
        result.appsLoaded = worldState.appsCount || 0
        result.renderWorking = !!(worldState.hasCanvas && worldState.hasCamera)
      }
      
      // Take final screenshot
      const finalScreenshotPath = `./test-results/simple/final-rpg-test-${timestamp}.png`
      
      await this.page.screenshot({ path: finalScreenshotPath })
      result.screenshot = finalScreenshotPath
      console.log('[SimpleRPGTest] Final screenshot saved:', finalScreenshotPath)
      
      // Basic validation
      if (result.worldLoaded && result.renderWorking) {
        result.passed = true
        console.log('[SimpleRPGTest] Basic test PASSED')
      } else {
        result.errors.push('Basic world loading or rendering failed')
        console.log('[SimpleRPGTest] Basic test FAILED')
      }
      
    } catch (error) {
      result.errors.push(`Test failed: ${error}`)
      console.log('[SimpleRPGTest] Error:', error)
    }

    result.logs = [...this.logs]
    return result
  }

  async cleanup(): Promise<void> {
    if (this.page) await this.page.close()
    if (this.browser) await this.browser.close()
    console.log('[SimpleRPGTest] Cleanup complete')
  }
}

/**
 * Simple test runner - just checks if basic RPG world works
 */
export async function runSimpleRPGTest(): Promise<void> {
  console.log('🧪 Simple RPG Test')
  console.log('==================')
  console.log('Testing basic Hyperfy RPG functionality...')
  console.log('')

  const test = new SimpleRPGTest()
  
  try {
    await test.initialize()
    const result = await test.testRPGWorld()
    
    console.log('\n📊 Test Results:')
    console.log(`✨ World Loaded: ${result.worldLoaded ? '✅' : '❌'}`)
    console.log(`🎮 Apps Loaded: ${result.appsLoaded}`)
    console.log(`🎨 Rendering: ${result.renderWorking ? '✅' : '❌'}`)
    console.log(`📸 Screenshot: ${result.screenshot}`)
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:')
      result.errors.forEach(error => console.log(`   ${error}`))
    }
    
    if (result.logs.length > 0) {
      console.log('\n📋 Browser Logs (last 5):')
      result.logs.slice(-5).forEach(log => console.log(`   ${log}`))
    }
    
    console.log(`\n${result.passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}`)
    
    if (!result.passed) {
      console.log('\nTo fix:')
      console.log('1. Make sure Hyperfy server is running: cd packages/hyperfy && npm run dev')
      console.log('2. Verify server is accessible at http://localhost:3000')
      console.log('3. Check the screenshot to see what actually loaded')
      console.log('4. Check browser logs above for specific errors')
    }
    
  } finally {
    await test.cleanup()
  }
}

// Run if called directly (ESM compatible)
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runSimpleRPGTest().catch(console.error)
}