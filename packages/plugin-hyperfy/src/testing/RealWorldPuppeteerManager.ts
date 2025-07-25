import puppeteer, { Browser, Page } from 'puppeteer'
import { logger } from '@elizaos/core'
import fs from 'fs/promises'
import path from 'path'

export interface WorldConnection {
  worldUrl: string
  worldId: string
  screenshotDir?: string
}

export interface ScreenshotResult {
  buffer: Buffer
  path?: string
  timestamp: number
  worldInfo: {
    url: string
    id: string
  }
}

/**
 * Real Puppeteer manager that connects to actual Hyperfy worlds
 * Takes real screenshots of running game content
 */
export class RealWorldPuppeteerManager {
  private browser: Browser | null = null
  private page: Page | null = null
  private currentConnection: WorldConnection | null = null
  private screenshotCounter = 0

  async initialize(): Promise<void> {
    logger.info('[RealWorldPuppeteerManager] Initializing browser...')
    
    this.browser = await puppeteer.launch({
      headless: true, // Set to false for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      }
    })

    this.page = await this.browser.newPage()
    
    // Set up console logging
    this.page.on('console', msg => {
      logger.info(`[Browser Console] ${msg.text()}`)
    })
    
    // Set up error handling
    this.page.on('pageerror', error => {
      logger.error('[Browser Error]', error.message)
    })

    logger.info('[RealWorldPuppeteerManager] Browser initialized successfully')
  }

  async connectToWorld(connection: WorldConnection): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.')
    }

    logger.info(`[RealWorldPuppeteerManager] Connecting to world: ${connection.worldUrl}`)
    
    this.currentConnection = connection
    
    try {
      // Navigate to the world URL
      await this.page.goto(connection.worldUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      })

      // Wait for the game world to load
      await this.waitForWorldLoad()
      
      logger.info('[RealWorldPuppeteerManager] Successfully connected to world')
      
    } catch (error) {
      logger.error('[RealWorldPuppeteerManager] Failed to connect to world:', error)
      throw error
    }
  }

  private async waitForWorldLoad(): Promise<void> {
    if (!this.page) return
    
    logger.info('[RealWorldPuppeteerManager] Waiting for world to load...')
    
    // Wait for canvas element (Hyperfy uses canvas for 3D rendering)
    await this.page.waitForSelector('canvas', { timeout: 15000 })
    
    // Wait for additional resources to load
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check if the canvas has meaningful content (not just black/white)
    const canvasInfo = await this.page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      if (!canvas) return null
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data
      
      // Count different colors
      const colorCounts = new Map<string, number>()
      
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]
        const g = pixels[i + 1] 
        const b = pixels[i + 2]
        const colorKey = `${r},${g},${b}`
        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1)
      }
      
      return {
        width: canvas.width,
        height: canvas.height,
        uniqueColors: colorCounts.size,
        totalPixels: pixels.length / 4,
        topColors: Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      }
    })
    
    logger.info(`[RealWorldPuppeteerManager] Canvas info:`, canvasInfo)
    
    if (canvasInfo && canvasInfo.uniqueColors > 10) {
      logger.info('[RealWorldPuppeteerManager] World appears to have loaded with visual content')
    } else {
      logger.warn('[RealWorldPuppeteerManager] World may not have loaded properly - limited visual content detected')
    }
  }

  async takeScreenshot(name?: string): Promise<ScreenshotResult> {
    if (!this.page || !this.currentConnection) {
      throw new Error('Not connected to a world. Call connectToWorld() first.')
    }

    this.screenshotCounter++
    const timestamp = Date.now()
    const screenshotName = name || `screenshot-${this.screenshotCounter}-${timestamp}`
    
    logger.info(`[RealWorldPuppeteerManager] Taking screenshot: ${screenshotName}`)
    
    try {
      // Take screenshot
      const buffer = await this.page.screenshot({
        type: 'png',
        fullPage: false,
        encoding: 'binary'
      }) as Buffer

      // Save to file if directory specified
      let savedPath: string | undefined
      if (this.currentConnection.screenshotDir) {
        // Ensure directory exists
        await fs.mkdir(this.currentConnection.screenshotDir, { recursive: true })
        
        savedPath = path.join(this.currentConnection.screenshotDir, `${screenshotName}.png`)
        await fs.writeFile(savedPath, buffer)
        logger.info(`[RealWorldPuppeteerManager] Screenshot saved to: ${savedPath}`)
      }

      // Analyze screenshot content
      await this.analyzeScreenshot(buffer, screenshotName)

      return {
        buffer,
        path: savedPath,
        timestamp,
        worldInfo: {
          url: this.currentConnection.worldUrl,
          id: this.currentConnection.worldId
        }
      }

    } catch (error) {
      logger.error('[RealWorldPuppeteerManager] Screenshot failed:', error)
      throw error
    }
  }

  private async analyzeScreenshot(buffer: Buffer, name: string): Promise<void> {
    try {
      // Basic analysis to detect if screenshot is mostly empty
      const Canvas = (await import('canvas')).default
      const { createCanvas, loadImage } = Canvas
      
      const img = await loadImage(buffer)
      const canvas = createCanvas(img.width, img.height)
      const ctx = canvas.getContext('2d')
      
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data
      
      // Count black and white pixels
      let blackPixels = 0
      let whitePixels = 0
      let totalPixels = pixels.length / 4
      
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        
        if (r < 30 && g < 30 && b < 30) {
          blackPixels++
        } else if (r > 225 && g > 225 && b > 225) {
          whitePixels++
        }
      }
      
      const blackPercentage = (blackPixels / totalPixels) * 100
      const whitePercentage = (whitePixels / totalPixels) * 100
      
      logger.info(`[RealWorldPuppeteerManager] Screenshot analysis for ${name}:`)
      logger.info(`  - Dimensions: ${img.width}x${img.height}`)
      logger.info(`  - Black pixels: ${blackPercentage.toFixed(1)}%`)
      logger.info(`  - White pixels: ${whitePercentage.toFixed(1)}%`)
      
      if (blackPercentage > 90) {
        logger.warn(`[RealWorldPuppeteerManager] WARNING: Screenshot is ${blackPercentage.toFixed(1)}% black - may indicate loading issue`)
      } else if (whitePercentage > 90) {
        logger.warn(`[RealWorldPuppeteerManager] WARNING: Screenshot is ${whitePercentage.toFixed(1)}% white - may indicate rendering issue`)
      } else {
        logger.info(`[RealWorldPuppeteerManager] Screenshot appears to contain meaningful visual content`)
      }
      
    } catch (error) {
      logger.error('[RealWorldPuppeteerManager] Screenshot analysis failed:', error)
    }
  }

  async executeScript(script: string): Promise<any> {
    if (!this.page) {
      throw new Error('Browser not initialized')
    }

    return await this.page.evaluate(script)
  }

  async getWorldInfo(): Promise<any> {
    if (!this.page) {
      throw new Error('Browser not initialized')
    }

    return await this.page.evaluate(() => {
      // Try to get Hyperfy world information
      return {
        url: window.location.href,
        title: document.title,
        canvas: {
          present: !!document.querySelector('canvas'),
          count: document.querySelectorAll('canvas').length
        },
        // Try to access Hyperfy globals if available
        hyperfy: typeof (window as any).hyperfy !== 'undefined' ? {
          connected: true,
          version: (window as any).hyperfy.version || 'unknown'
        } : { connected: false }
      }
    })
  }

  async cleanup(): Promise<void> {
    logger.info('[RealWorldPuppeteerManager] Cleaning up...')
    
    if (this.page) {
      await this.page.close()
      this.page = null
    }
    
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    
    this.currentConnection = null
    logger.info('[RealWorldPuppeteerManager] Cleanup complete')
  }
}