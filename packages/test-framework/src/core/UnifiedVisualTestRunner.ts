import { Browser, Page, chromium } from 'playwright'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import sharp from 'sharp'

export const TEST_COLORS = {
  PLAYER: '#0000FF',      // Blue
  GOBLIN: '#00FF00',      // Green
  BANDIT: '#FFA500',      // Orange
  BARBARIAN: '#8B4513',   // Brown
  HOBGOBLIN: '#006400',   // Dark Green
  GUARD: '#4169E1',       // Royal Blue
  DARK_WARRIOR: '#8B0000', // Dark Red
  BLACK_KNIGHT: '#000000', // Black
  ICE_WARRIOR: '#ADD8E6',  // Light Blue
  DARK_RANGER: '#800080',  // Purple
  ITEM_DROP: '#FFD700',    // Gold
  CORPSE: '#FF0000',       // Red
  TREE: '#228B22',         // Forest Green
  FISHING_SPOT: '#00CED1', // Dark Turquoise
  FIRE: '#FF6347',         // Tomato
  COIN: '#FFD700',         // Gold
  WEAPON: '#C0C0C0',       // Silver
  TOOL: '#8B4513',         // Saddle Brown
  BACKGROUND: '#87CEEB'    // Sky Blue
} as const

export interface EntityExpectation {
  type: keyof typeof TEST_COLORS
  count: number
  minDistance?: number
  maxDistance?: number
  position?: { x: number; y: number }
  tolerance?: number
}

export interface VisualTestConfig {
  name: string
  url: string
  timeout: number
  expectedEntities: EntityExpectation[]
  screenshotPath: string
  waitForStable?: number
  customValidations?: Array<(analysis: PixelAnalysis) => { passed: boolean; error?: string }>
}

export interface PixelCluster {
  x: number
  y: number
  size: number
  confidence: number
}

export interface PixelAnalysis {
  totalPixels: number
  dominantColor: string
  colorDistribution: Map<string, number>
  entities: Map<string, PixelCluster[]>
  screenHealth: {
    isAllSameColor: boolean
    colorVariance: number
    dominantPercentage: number
  }
}

export interface TestResult {
  passed: boolean
  screenshotPath: string
  analysis: PixelAnalysis
  errors: string[]
  warnings: string[]
  duration: number
  timestamp: number
}

export class UnifiedVisualTestRunner {
  private browser: Browser | null = null
  private page: Page | null = null
  private logMessages: string[] = []

  constructor(
    private headless: boolean = false,
    private viewportWidth: number = 1920,
    private viewportHeight: number = 1080
  ) {}

  async initialize(): Promise<void> {
    console.log('[UnifiedVisualTestRunner] Starting browser...')
    
    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
    
    this.page = await this.browser.newPage()
    
    // Set up logging
    this.page.on('console', (msg) => {
      this.logMessages.push(`[CONSOLE] ${msg.text()}`)
    })
    
    this.page.on('pageerror', (err) => {
      this.logMessages.push(`[ERROR] ${err.message}`)
    })
    
    await this.page.setViewportSize({ 
      width: this.viewportWidth, 
      height: this.viewportHeight 
    })
    
    console.log('[UnifiedVisualTestRunner] Browser initialized')
  }

  async runTest(config: VisualTestConfig): Promise<TestResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []

    try {
      if (!this.page) {
        throw new Error('Browser not initialized')
      }

      console.log(`[Test] Running visual test: ${config.name}`)
      
      // Navigate to test URL
      console.log(`[Test] Navigating to: ${config.url}`)
      const response = await this.page.goto(config.url, { 
        waitUntil: 'networkidle',
        timeout: config.timeout 
      })

      if (!response || response.status() !== 200) {
        errors.push(`Failed to load page: HTTP ${response?.status() || 'unknown'}`)
      }

      // Wait for world to stabilize
      const waitTime = config.waitForStable || 5000
      console.log(`[Test] Waiting ${waitTime}ms for world to stabilize...`)
      await this.page.waitForTimeout(waitTime)

      // Take screenshot
      console.log('[Test] Taking screenshot...')
      const screenshotPath = await this.takeScreenshot(config.screenshotPath, config.name)

      // Analyze screenshot with Sharp (server-side)
      console.log('[Test] Analyzing pixels...')
      const analysis = await this.analyzePixels(screenshotPath)

      // Validate expectations
      console.log('[Test] Validating expectations...')
      await this.validateExpectations(config.expectedEntities, analysis, errors, warnings)

      // Run custom validations
      if (config.customValidations) {
        for (const validation of config.customValidations) {
          const result = validation(analysis)
          if (!result.passed && result.error) {
            errors.push(result.error)
          }
        }
      }

      const duration = Date.now() - startTime
      const result: TestResult = {
        passed: errors.length === 0,
        screenshotPath,
        analysis,
        errors,
        warnings,
        duration,
        timestamp: startTime
      }

      console.log(`[Test] ${config.name} ${result.passed ? 'PASSED' : 'FAILED'} in ${duration}ms`)
      return result

    } catch (error) {
      const duration = Date.now() - startTime
      return {
        passed: false,
        screenshotPath: '',
        analysis: this.getEmptyAnalysis(),
        errors: [`Test execution failed: ${error}`],
        warnings,
        duration,
        timestamp: startTime
      }
    }
  }

  private async takeScreenshot(basePath: string, testName: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized')

    // Ensure directory exists
    await fs.mkdir(dirname(basePath), { recursive: true })

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${testName}-${timestamp}.png`
    const fullPath = join(basePath, filename)

    await this.page.screenshot({ 
      path: fullPath, 
      fullPage: true,
      type: 'png'
    })

    console.log(`[Screenshot] Saved: ${fullPath}`)
    return fullPath
  }

  private async analyzePixels(imagePath: string): Promise<PixelAnalysis> {
    console.log('[Analysis] Processing image with Sharp...')
    
    // Load image with Sharp
    const image = sharp(imagePath)
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })

    const colorCount = new Map<string, number>()
    const colorPositions = new Map<string, Array<{ x: number; y: number }>>()
    let totalPixels = 0

    // Sample pixels for efficiency (every 4th pixel)
    const step = 4
    for (let y = 0; y < info.height; y += step) {
      for (let x = 0; x < info.width; x += step) {
        const pixelIndex = (y * info.width + x) * info.channels
        const r = data[pixelIndex]
        const g = data[pixelIndex + 1]
        const b = data[pixelIndex + 2]
        
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
        
        colorCount.set(hexColor, (colorCount.get(hexColor) || 0) + 1)
        
        // Store positions for test colors only
        if (Object.values(TEST_COLORS).includes(hexColor as any)) {
          if (!colorPositions.has(hexColor)) {
            colorPositions.set(hexColor, [])
          }
          colorPositions.get(hexColor)!.push({ x, y })
        }
        
        totalPixels++
      }
    }

    // Calculate color distribution
    const colorDistribution = new Map<string, number>()
    for (const [color, count] of colorCount) {
      colorDistribution.set(color, (count / totalPixels) * 100)
    }

    // Find dominant color
    let dominantColor = '#000000'
    let maxCount = 0
    for (const [color, count] of colorCount) {
      if (count > maxCount) {
        maxCount = count
        dominantColor = color
      }
    }

    // Cluster entities
    const entities = this.clusterEntities(colorPositions)

    // Screen health metrics
    const dominantPercentage = (maxCount / totalPixels) * 100
    const screenHealth = {
      isAllSameColor: dominantPercentage > 95,
      colorVariance: this.calculateColorVariance(colorDistribution),
      dominantPercentage
    }

    return {
      totalPixels,
      dominantColor,
      colorDistribution,
      entities,
      screenHealth
    }
  }

  private clusterEntities(colorPositions: Map<string, Array<{ x: number; y: number }>>): Map<string, PixelCluster[]> {
    const entities = new Map<string, PixelCluster[]>()

    // Find entity type for each test color
    for (const [colorName, colorValue] of Object.entries(TEST_COLORS)) {
      const positions = colorPositions.get(colorValue)
      if (!positions || positions.length === 0) continue

      const clusters = this.clusterPixelsByDistance(positions, 30) // 30 pixel cluster radius
      
      if (clusters.length > 0) {
        entities.set(colorName, clusters)
      }
    }

    return entities
  }

  private clusterPixelsByDistance(positions: Array<{ x: number; y: number }>, maxDistance: number): PixelCluster[] {
    const clusters: PixelCluster[] = []
    const used = new Set<string>()

    for (const pos of positions) {
      const key = `${pos.x},${pos.y}`
      if (used.has(key)) continue

      // Find all pixels within distance
      const cluster: Array<{ x: number; y: number }> = []
      for (const other of positions) {
        const otherKey = `${other.x},${other.y}`
        if (used.has(otherKey)) continue

        const distance = Math.sqrt(
          Math.pow(pos.x - other.x, 2) + Math.pow(pos.y - other.y, 2)
        )

        if (distance <= maxDistance) {
          cluster.push(other)
          used.add(otherKey)
        }
      }

      // Only create cluster if it has enough pixels
      if (cluster.length >= 5) {
        const centerX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length
        const centerY = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length
        
        clusters.push({
          x: Math.round(centerX),
          y: Math.round(centerY),
          size: cluster.length,
          confidence: Math.min(cluster.length / 50, 1.0) // Higher confidence for larger clusters
        })
      }
    }

    return clusters
  }

  private calculateColorVariance(colorDistribution: Map<string, number>): number {
    const percentages = Array.from(colorDistribution.values())
    const mean = percentages.reduce((sum, p) => sum + p, 0) / percentages.length
    const variance = percentages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / percentages.length
    return Math.sqrt(variance)
  }

  private async validateExpectations(
    expectations: EntityExpectation[],
    analysis: PixelAnalysis,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Check screen health first
    if (analysis.screenHealth.isAllSameColor) {
      errors.push(`Screen appears to be single color (${analysis.dominantColor}) - likely rendering issue`)
      return
    }

    if (analysis.screenHealth.colorVariance < 5) {
      warnings.push(`Low color variance (${analysis.screenHealth.colorVariance.toFixed(1)}) - scene may be too simple`)
    }

    // Validate each entity expectation
    for (const expectation of expectations) {
      const entities = analysis.entities.get(expectation.type) || []
      const actualCount = entities.length

      if (actualCount !== expectation.count) {
        errors.push(`${expectation.type}: expected ${expectation.count}, found ${actualCount}`)
        continue
      }

      // Validate positions if specified
      if (expectation.position && entities.length > 0) {
        const entity = entities[0]
        const distance = Math.sqrt(
          Math.pow(entity.x - expectation.position.x, 2) +
          Math.pow(entity.y - expectation.position.y, 2)
        )
        const tolerance = expectation.tolerance || 50

        if (distance > tolerance) {
          errors.push(`${expectation.type}: expected at (${expectation.position.x}, ${expectation.position.y}), found at (${entity.x}, ${entity.y}), distance: ${distance.toFixed(1)}`)
        }
      }

      // Validate inter-entity distances
      if (expectation.minDistance && entities.length > 1) {
        for (let i = 0; i < entities.length; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const distance = Math.sqrt(
              Math.pow(entities[i].x - entities[j].x, 2) +
              Math.pow(entities[i].y - entities[j].y, 2)
            )
            if (distance < expectation.minDistance) {
              errors.push(`${expectation.type}: entities too close (${distance.toFixed(1)} < ${expectation.minDistance})`)
            }
          }
        }
      }
    }
  }

  private getEmptyAnalysis(): PixelAnalysis {
    return {
      totalPixels: 0,
      dominantColor: '#000000',
      colorDistribution: new Map(),
      entities: new Map(),
      screenHealth: {
        isAllSameColor: true,
        colorVariance: 0,
        dominantPercentage: 100
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close()
      this.page = null
    }

    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }

    console.log('[UnifiedVisualTestRunner] Cleanup completed')
  }

  getLogs(): string[] {
    return [...this.logMessages]
  }
}