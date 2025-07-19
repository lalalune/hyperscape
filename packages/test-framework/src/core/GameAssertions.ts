import { expect } from '@playwright/test'
import { Page } from 'playwright'
import sharp from 'sharp'

// Extend Window interface for Hyperfy globals
declare global {
  interface Window {
    world?: any;
    rpgPlayer?: any;
    rpgGoblin?: any;
    testPlayer?: any;
    testGoblin?: any;
  }
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface HealthData {
  current: number
  maximum: number
}

export interface ImageAnalysis {
  notAllBlack: boolean
  notAllWhite: boolean
  hasExpectedColors: boolean
  entityCount: number
  dominantColor: string
  colorDistribution: Map<string, number>
}

export class GameAssertions {
  /**
   * Assert that a player moved the expected distance
   */
  static assertPlayerMovement(
    initialPos: Vector3, 
    finalPos: Vector3, 
    expectedDistance: number,
    tolerance: number = 0.1
  ): void {
    const actualDistance = Math.sqrt(
      Math.pow(finalPos.x - initialPos.x, 2) +
      Math.pow(finalPos.y - initialPos.y, 2) +
      Math.pow(finalPos.z - initialPos.z, 2)
    )
    
    expect(actualDistance).toBeCloseTo(expectedDistance, tolerance)
    expect(actualDistance).toBeGreaterThan(0) // Player actually moved
    
    console.log(`✅ Player movement verified: ${actualDistance.toFixed(2)} units (expected: ${expectedDistance})`)
  }

  /**
   * Assert that combat damage was dealt correctly
   */
  static assertCombatDamage(
    initialHealth: number,
    finalHealth: number,
    expectedDamage: { min: number, max: number }
  ): void {
    const actualDamage = initialHealth - finalHealth
    
    expect(actualDamage).toBeGreaterThanOrEqual(expectedDamage.min)
    expect(actualDamage).toBeLessThanOrEqual(expectedDamage.max)
    expect(finalHealth).toBeGreaterThanOrEqual(0) // No negative health
    expect(actualDamage).toBeGreaterThan(0) // Some damage was dealt
    
    console.log(`⚔️ Combat damage verified: ${actualDamage} damage (range: ${expectedDamage.min}-${expectedDamage.max})`)
  }

  /**
   * Assert that experience was gained in the expected range
   */
  static assertExperienceGain(
    initialXP: number,
    finalXP: number,
    expectedGain: { min: number, max: number }
  ): void {
    const actualGain = finalXP - initialXP
    
    expect(actualGain).toBeGreaterThanOrEqual(expectedGain.min)
    expect(actualGain).toBeLessThanOrEqual(expectedGain.max)
    expect(actualGain).toBeGreaterThan(0) // XP was actually gained
    
    console.log(`📈 Experience gain verified: ${actualGain} XP (range: ${expectedGain.min}-${expectedGain.max})`)
  }

  /**
   * Assert that an item count changed as expected
   */
  static assertItemCountChange(
    initialCount: number,
    finalCount: number,
    expectedChange: number
  ): void {
    const actualChange = finalCount - initialCount
    
    expect(actualChange).toBe(expectedChange)
    expect(finalCount).toBeGreaterThanOrEqual(0) // No negative item counts
    
    console.log(`📦 Item count change verified: ${actualChange} items (expected: ${expectedChange})`)
  }

  /**
   * Assert that arrows were consumed during ranged combat
   */
  static assertArrowConsumption(
    initialArrows: number,
    finalArrows: number,
    expectedConsumption: number
  ): void {
    const actualConsumption = initialArrows - finalArrows
    
    expect(actualConsumption).toBe(expectedConsumption)
    expect(finalArrows).toBeGreaterThanOrEqual(0) // No negative arrows
    expect(actualConsumption).toBeGreaterThan(0) // Arrows were actually consumed
    
    console.log(`🏹 Arrow consumption verified: ${actualConsumption} arrows used (expected: ${expectedConsumption})`)
  }

  /**
   * Assert that a skill level increased
   */
  static assertSkillLevelIncrease(
    initialLevel: number,
    finalLevel: number,
    skillName: string
  ): void {
    expect(finalLevel).toBeGreaterThan(initialLevel)
    expect(finalLevel).toBeLessThanOrEqual(99) // Max skill level in RuneScape
    
    console.log(`📊 Skill level increase verified: ${skillName} ${initialLevel} → ${finalLevel}`)
  }

  /**
   * Analyze a screenshot for visual validation
   */
  static async analyzeScreenshot(screenshotPath: string): Promise<ImageAnalysis> {
    const image = sharp(screenshotPath)
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
    
    const colorCounts = new Map<string, number>()
    let totalPixels = 0
    let blackPixels = 0
    let whitePixels = 0
    
    // Analyze each pixel
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
      
      colorCounts.set(hexColor, (colorCounts.get(hexColor) || 0) + 1)
      totalPixels++
      
      // Count black and white pixels
      if (r === 0 && g === 0 && b === 0) blackPixels++
      if (r === 255 && g === 255 && b === 255) whitePixels++
    }
    
    // Calculate percentages
    const blackPercentage = (blackPixels / totalPixels) * 100
    const whitePercentage = (whitePixels / totalPixels) * 100
    
    // Find dominant color
    let dominantColor = ''
    let maxCount = 0
    for (const [color, count] of colorCounts) {
      if (count > maxCount) {
        maxCount = count
        dominantColor = color
      }
    }
    
    // Check for expected game colors (from TEST_COLORS)
    const expectedColors = ['#0000FF', '#00FF00', '#FFA500', '#FF0000', '#FFD700']
    const hasExpectedColors = expectedColors.some(color => colorCounts.has(color))
    
    // Estimate entity count based on color clusters
    const significantColors = Array.from(colorCounts.entries())
      .filter(([color, count]) => count > 100 && color !== '#FFFFFF' && color !== '#000000')
    
    return {
      notAllBlack: blackPercentage < 95,
      notAllWhite: whitePercentage < 95,
      hasExpectedColors,
      entityCount: significantColors.length,
      dominantColor,
      colorDistribution: new Map(
        Array.from(colorCounts.entries())
          .map(([color, count]) => [color, (count / totalPixels) * 100])
      )
    }
  }

  /**
   * Assert that visual rendering is working properly
   */
  static async assertVisualRendering(screenshotPath: string): Promise<void> {
    const analysis = await this.analyzeScreenshot(screenshotPath)
    
    expect(analysis.notAllBlack).toBe(true)
    expect(analysis.notAllWhite).toBe(true)
    expect(analysis.entityCount).toBeGreaterThan(0)
    
    console.log(`🎨 Visual rendering verified: ${analysis.entityCount} entities detected, dominant color: ${analysis.dominantColor}`)
  }

  /**
   * Assert that the world has loaded properly
   */
  static async assertWorldLoaded(page: Page): Promise<void> {
    // Check for canvas element
    const hasCanvas = await page.locator('canvas').isVisible()
    expect(hasCanvas).toBe(true)
    
    // Check for world object
    const hasWorld = await page.evaluate(() => !!window.world)
    expect(hasWorld).toBe(true)
    
    // Check that world is ready
    const worldReady = await page.evaluate(() => window.world?.ready || false)
    expect(worldReady).toBe(true)
    
    console.log('🌍 World loading verified: canvas present, world object ready')
  }

  /**
   * Assert that WebGL is working
   */
  static async assertWebGLWorking(page: Page): Promise<void> {
    const hasWebGL = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      return !!gl
    })
    
    expect(hasWebGL).toBe(true)
    console.log('🔧 WebGL support verified')
  }

  /**
   * Assert that specific RPG entities exist
   */
  static async assertRPGEntitiesExist(
    page: Page, 
    expectedEntities: { type: string, count: number }[]
  ): Promise<void> {
    for (const expected of expectedEntities) {
      const actualCount = await page.evaluate((entityType) => {
        if (!window.world?.apps) return 0
        
        const apps = window.world.apps.getAll()
        return apps.filter((app: any) => 
          app.name?.toLowerCase().includes(entityType.toLowerCase()) ||
          app.constructor.name.toLowerCase().includes(entityType.toLowerCase())
        ).length
      }, expected.type)
      
      expect(actualCount).toBeGreaterThanOrEqual(expected.count)
      console.log(`🎮 RPG entity verified: ${actualCount} ${expected.type} entities (expected: ${expected.count})`)
    }
  }

  /**
   * Assert that all required skills are implemented
   */
  static async assertAllSkillsImplemented(page: Page): Promise<void> {
    const requiredSkills = [
      'attack', 'strength', 'defense', 'constitution', 'ranged',
      'woodcutting', 'fishing', 'firemaking', 'cooking'
    ]
    
    for (const skill of requiredSkills) {
      const skillExists = await page.evaluate((skillName) => {
        // Check if skill exists in any RPG app
        if (!window.world?.apps) return false
        
        const apps = window.world.apps.getAll()
        return apps.some((app: any) => 
          app.stats && app.stats[skillName] !== undefined
        )
      }, skill)
      
      expect(skillExists).toBe(true)
      console.log(`📊 Skill verified: ${skill}`)
    }
  }

  /**
   * Assert that equipment tiers are implemented
   */
  static async assertEquipmentTiersImplemented(page: Page): Promise<void> {
    const requiredTiers = ['bronze', 'steel', 'mithril']
    
    for (const tier of requiredTiers) {
      const tierExists = await page.evaluate((tierName) => {
        // Check if equipment tier exists
        if (!window.world?.apps) return false
        
        const apps = window.world.apps.getAll()
        return apps.some((app: any) => 
          app.ITEMS && Object.values(app.ITEMS).some((item: any) => 
            item.tier === tierName
          )
        )
      }, tier)
      
      expect(tierExists).toBe(true)
      console.log(`⚔️ Equipment tier verified: ${tier}`)
    }
  }

  /**
   * Assert that performance metrics are acceptable
   */
  static assertPerformanceMetrics(metrics: {
    loadTime: number
    frameRate: number
    memoryUsage?: number
  }): void {
    expect(metrics.loadTime).toBeLessThan(10000) // 10 seconds max
    expect(metrics.frameRate).toBeGreaterThan(30) // 30 FPS minimum
    
    if (metrics.memoryUsage) {
      expect(metrics.memoryUsage).toBeLessThan(500 * 1024 * 1024) // 500MB max
    }
    
    console.log(`⚡ Performance verified: ${metrics.loadTime}ms load, ${metrics.frameRate}fps, ${metrics.memoryUsage ? Math.round(metrics.memoryUsage / 1024 / 1024) + 'MB' : 'N/A'} memory`)
  }
}