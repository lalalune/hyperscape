import { Page, Browser, chromium } from 'playwright'
import { promises as fs } from 'fs'
import { join } from 'path'

// Color constants for visual testing
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

export interface VisualTestConfig {
  worldName: string
  testName: string
  timeout: number
  screenshotDir: string
  expectedEntities: Array<{
    type: keyof typeof TEST_COLORS
    count: number
    minDistance?: number
    maxDistance?: number
  }>
  validationRules: VisualValidationRule[]
}

export interface VisualValidationRule {
  name: string
  validate: (analysis: PixelAnalysis) => boolean
  errorMessage: string
}

export interface PixelAnalysis {
  colors: Map<string, { count: number; positions: Array<{ x: number; y: number }> }>
  totalPixels: number
  dominantColor: string
  colorDistribution: Map<string, number>
  entityClusters: Map<string, Array<{ x: number; y: number; size: number }>>
}

export interface TestResult {
  passed: boolean
  screenshotPath: string
  pixelAnalysis: PixelAnalysis
  errors: string[]
  warnings: string[]
  sceneHierarchy: any
  spatialData: any
  logs: string[]
}

export class VisualTestRunner {
  private browser: Browser | null = null
  private page: Page | null = null
  private logMessages: string[] = []

  constructor(
    private config: VisualTestConfig,
    private hyperfyUrl: string = 'http://localhost:3001'
  ) {}

  async initialize(): Promise<void> {
    console.log(`[VisualTestRunner] Initializing browser for test: ${this.config.testName}`)
    
    this.browser = await chromium.launch({
      headless: false, // Keep visible for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    this.page = await this.browser.newPage()
    
    // Set up console logging
    this.page.on('console', (msg) => {
      this.logMessages.push(`[${msg.type()}] ${msg.text()}`)
    })
    
    // Set up error logging
    this.page.on('pageerror', (err) => {
      this.logMessages.push(`[ERROR] ${err.message}`)
    })
    
    // Set viewport for consistent testing
    await this.page.setViewportSize({ width: 1920, height: 1080 })
  }

  async loadWorld(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized')

    console.log(`[VisualTestRunner] Loading world: ${this.config.worldName}`)
    
    // Navigate to Hyperfy world
    await this.page.goto(`${this.hyperfyUrl}/${this.config.worldName}`)
    
    // Wait for world to load
    await this.page.waitForSelector('canvas', { timeout: 30000 })
    
    // Wait for additional loading
    await this.page.waitForTimeout(5000)
    
    console.log(`[VisualTestRunner] World loaded successfully`)
  }

  async runTest(): Promise<TestResult> {
    if (!this.page) throw new Error('Page not initialized')

    console.log(`[VisualTestRunner] Running test: ${this.config.testName}`)
    
    try {
      // Take screenshot
      const screenshotPath = await this.takeScreenshot()
      
      // Analyze pixels
      const pixelAnalysis = await this.analyzePixels(screenshotPath)
      
      // Get scene hierarchy
      const sceneHierarchy = await this.getSceneHierarchy()
      
      // Get spatial data
      const spatialData = await this.getSpatialData()
      
      // Run validation rules
      const errors: string[] = []
      const warnings: string[] = []
      
      for (const rule of this.config.validationRules) {
        try {
          if (!rule.validate(pixelAnalysis)) {
            errors.push(rule.errorMessage)
          }
        } catch (err) {
          warnings.push(`Validation rule '${rule.name}' failed: ${err}`)
        }
      }
      
      // Validate expected entities
      await this.validateExpectedEntities(pixelAnalysis, errors)
      
      // Check for basic scene issues
      await this.validateBasicScene(pixelAnalysis, errors, warnings)
      
      return {
        passed: errors.length === 0,
        screenshotPath,
        pixelAnalysis,
        errors,
        warnings,
        sceneHierarchy,
        spatialData,
        logs: [...this.logMessages]
      }
      
    } catch (error) {
      return {
        passed: false,
        screenshotPath: '',
        pixelAnalysis: this.getEmptyPixelAnalysis(),
        errors: [`Test execution failed: ${error}`],
        warnings: [],
        sceneHierarchy: null,
        spatialData: null,
        logs: [...this.logMessages]
      }
    }
  }

  private async takeScreenshot(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${this.config.testName}-${timestamp}.png`
    const screenshotPath = join(this.config.screenshotDir, filename)
    
    // Ensure directory exists
    await fs.mkdir(this.config.screenshotDir, { recursive: true })
    
    // Take screenshot
    await this.page.screenshot({ path: screenshotPath, fullPage: true })
    
    console.log(`[VisualTestRunner] Screenshot saved: ${screenshotPath}`)
    return screenshotPath
  }

  private async analyzePixels(screenshotPath: string): Promise<PixelAnalysis> {
    // Load and analyze screenshot pixels
    const sharp = require('sharp')
    const image = sharp(screenshotPath)
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
    
    const colors = new Map<string, { count: number; positions: Array<{ x: number; y: number }> }>()
    const colorDistribution = new Map<string, number>()
    let totalPixels = 0
    
    // Analyze each pixel
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const pixelIndex = (y * info.width + x) * info.channels
        const r = data[pixelIndex]
        const g = data[pixelIndex + 1]
        const b = data[pixelIndex + 2]
        
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
        
        if (!colors.has(hexColor)) {
          colors.set(hexColor, { count: 0, positions: [] })
        }
        
        const colorData = colors.get(hexColor)!
        colorData.count++
        colorData.positions.push({ x, y })
        
        totalPixels++
      }
    }
    
    // Calculate distribution percentages
    for (const [color, data] of colors) {
      colorDistribution.set(color, (data.count / totalPixels) * 100)
    }
    
    // Find dominant color
    let dominantColor = ''
    let maxCount = 0
    for (const [color, data] of colors) {
      if (data.count > maxCount) {
        maxCount = data.count
        dominantColor = color
      }
    }
    
    // Cluster similar positioned pixels to find entities
    const entityClusters = this.clusterPixels(colors)
    
    return {
      colors,
      totalPixels,
      dominantColor,
      colorDistribution,
      entityClusters
    }
  }

  private clusterPixels(colors: Map<string, { count: number; positions: Array<{ x: number; y: number }> }>): Map<string, Array<{ x: number; y: number; size: number }>> {
    const clusters = new Map<string, Array<{ x: number; y: number; size: number }>>()
    
    // Only cluster test colors (ignore background noise)
    for (const [colorName, colorValue] of Object.entries(TEST_COLORS)) {
      const colorData = colors.get(colorValue)
      if (!colorData) continue
      
      const colorClusters: Array<{ x: number; y: number; size: number }> = []
      const positions = [...colorData.positions]
      const clustered = new Set<string>()
      
      for (const pos of positions) {
        const key = `${pos.x},${pos.y}`
        if (clustered.has(key)) continue
        
        // Find nearby pixels of same color
        const cluster = this.findNearbyPixels(pos, positions, 20) // Within 20 pixels
        
        if (cluster.length > 10) { // Minimum cluster size
          const centerX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length
          const centerY = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length
          
          colorClusters.push({
            x: Math.round(centerX),
            y: Math.round(centerY),
            size: cluster.length
          })
          
          // Mark all pixels in cluster as used
          cluster.forEach(p => clustered.add(`${p.x},${p.y}`))
        }
      }
      
      if (colorClusters.length > 0) {
        clusters.set(colorName, colorClusters)
      }
    }
    
    return clusters
  }

  private findNearbyPixels(
    center: { x: number; y: number },
    positions: Array<{ x: number; y: number }>,
    maxDistance: number
  ): Array<{ x: number; y: number }> {
    return positions.filter(pos => {
      const distance = Math.sqrt(
        Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - center.y, 2)
      )
      return distance <= maxDistance
    })
  }

  private async getSceneHierarchy(): Promise<any> {
    if (!this.page) return null

    return await this.page.evaluate(() => {
      // Access Three.js scene through window
      const scene = (window as any).scene
      if (!scene) return null
      
      const extractHierarchy = (object: any): any => {
        return {
          name: object.name || object.constructor.name,
          type: object.type,
          position: object.position ? {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z
          } : null,
          rotation: object.rotation ? {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z
          } : null,
          scale: object.scale ? {
            x: object.scale.x,
            y: object.scale.y,
            z: object.scale.z
          } : null,
          visible: object.visible,
          children: object.children ? object.children.map(extractHierarchy) : []
        }
      }
      
      return extractHierarchy(scene)
    })
  }

  private async getSpatialData(): Promise<any> {
    if (!this.page) return null

    return await this.page.evaluate(() => {
      // Get spatial data from Hyperfy world
      const world = (window as any).world
      if (!world) return null
      
      const entities = []
      
      // Try to get player positions
      if (world.players) {
        for (const player of world.players.getAll()) {
          entities.push({
            type: 'player',
            id: player.id,
            position: player.position,
            name: player.name
          })
        }
      }
      
      // Try to get app positions
      if (world.apps) {
        for (const app of world.apps.getAll()) {
          entities.push({
            type: 'app',
            id: app.id,
            position: app.position,
            name: app.name || app.constructor.name
          })
        }
      }
      
      return {
        entities,
        worldBounds: world.bounds || null,
        timestamp: Date.now()
      }
    })
  }

  private async validateExpectedEntities(analysis: PixelAnalysis, errors: string[]): Promise<void> {
    for (const expected of this.config.expectedEntities) {
      const clusters = analysis.entityClusters.get(expected.type)
      const actualCount = clusters ? clusters.length : 0
      
      if (actualCount !== expected.count) {
        errors.push(`Expected ${expected.count} ${expected.type} entities, found ${actualCount}`)
      }
      
      // Validate distances if specified
      if (expected.minDistance && clusters && clusters.length > 1) {
        for (let i = 0; i < clusters.length; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            const distance = Math.sqrt(
              Math.pow(clusters[i].x - clusters[j].x, 2) +
              Math.pow(clusters[i].y - clusters[j].y, 2)
            )
            if (distance < expected.minDistance) {
              errors.push(`${expected.type} entities too close: ${distance} < ${expected.minDistance}`)
            }
          }
        }
      }
    }
  }

  private async validateBasicScene(analysis: PixelAnalysis, errors: string[], warnings: string[]): Promise<void> {
    // Check for completely white/black/single color screens
    const dominantPercentage = analysis.colorDistribution.get(analysis.dominantColor) || 0
    
    if (dominantPercentage > 95) {
      errors.push(`Screen is ${dominantPercentage.toFixed(1)}% single color (${analysis.dominantColor}) - likely rendering issue`)
    }
    
    // Check for reasonable color diversity
    if (analysis.colorDistribution.size < 10) {
      warnings.push(`Very low color diversity (${analysis.colorDistribution.size} colors) - scene may be too simple`)
    }
    
    // Check for test colors presence
    const testColorsFound = Object.values(TEST_COLORS).filter(color => 
      analysis.colors.has(color)
    ).length
    
    if (testColorsFound === 0) {
      errors.push('No test colors found in screenshot - entities may not be rendering')
    }
  }

  private getEmptyPixelAnalysis(): PixelAnalysis {
    return {
      colors: new Map(),
      totalPixels: 0,
      dominantColor: '',
      colorDistribution: new Map(),
      entityClusters: new Map()
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
    
    console.log(`[VisualTestRunner] Cleanup completed for test: ${this.config.testName}`)
  }

  // Utility methods for test creation
  static createPlayerCombatTest(): VisualTestConfig {
    return {
      worldName: 'rpg-combat-test',
      testName: 'player-combat-test',
      timeout: 30000,
      screenshotDir: './test-results/screenshots',
      expectedEntities: [
        { type: 'PLAYER', count: 1 },
        { type: 'GOBLIN', count: 1 },
      ],
      validationRules: [
        {
          name: 'entities-visible',
          validate: (analysis) => {
            const player = analysis.entityClusters.get('PLAYER')
            const goblin = analysis.entityClusters.get('GOBLIN')
            return !!(player && player.length > 0 && goblin && goblin.length > 0)
          },
          errorMessage: 'Player or goblin not visible in combat test'
        }
      ]
    }
  }

  static createMobSpawningTest(): VisualTestConfig {
    return {
      worldName: 'rpg-spawning-test',
      testName: 'mob-spawning-test',
      timeout: 45000,
      screenshotDir: './test-results/screenshots',
      expectedEntities: [
        { type: 'GOBLIN', count: 3 },
        { type: 'BANDIT', count: 2 },
        { type: 'BARBARIAN', count: 1 }
      ],
      validationRules: [
        {
          name: 'mobs-spawned',
          validate: (analysis) => {
            const totalMobs = ['GOBLIN', 'BANDIT', 'BARBARIAN']
              .map(type => analysis.entityClusters.get(type)?.length || 0)
              .reduce((a, b) => a + b, 0)
            return totalMobs >= 6
          },
          errorMessage: 'Not enough mobs spawned in spawning test'
        }
      ]
    }
  }

  static createDeathRespawnTest(): VisualTestConfig {
    return {
      worldName: 'rpg-death-test',
      testName: 'death-respawn-test',
      timeout: 60000,
      screenshotDir: './test-results/screenshots',
      expectedEntities: [
        { type: 'PLAYER', count: 1 },
        { type: 'CORPSE', count: 1 },
        { type: 'ITEM_DROP', count: 1 }
      ],
      validationRules: [
        {
          name: 'death-mechanics',
          validate: (analysis) => {
            const corpse = analysis.entityClusters.get('CORPSE')
            const drops = analysis.entityClusters.get('ITEM_DROP')
            return !!(corpse && corpse.length > 0 && drops && drops.length > 0)
          },
          errorMessage: 'Death mechanics not working - no corpse or item drops'
        }
      ]
    }
  }
}