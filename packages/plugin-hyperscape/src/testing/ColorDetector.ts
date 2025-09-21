import { createCanvas, loadImage, ImageData } from 'canvas'
import { logger } from '@elizaos/core'

export interface ColorDetectorConfig {
  colorTolerance: number
  minClusterSize: number
  mergeDistance: number
  samplingStep: number
  confidenceThreshold: number
}

export interface DetectedEntity {
  color: string
  positions: Array<{ x: number; y: number }>
  confidence: number
  type: string
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ColorCluster {
  color: string
  pixels: Array<{ x: number; y: number }>
  centroid: { x: number; y: number }
  size: number
}

/**
 * Real ColorDetector implementation for analyzing screenshots
 * Detects colored cubes representing game entities in Hyperscape worlds
 */
export class ColorDetector {
  private config: ColorDetectorConfig
  private colorMappings: Map<string, string>

  constructor(config: ColorDetectorConfig) {
    this.config = config
    this.colorMappings = new Map()
    this.initializeColorMappings()
  }

  async init(): Promise<void> {
    logger.info('[ColorDetector] Initializing real color detection system...')
    // Color detector is ready - no async initialization needed
    logger.info(
      '[ColorDetector] Color detection system initialized successfully'
    )
  }

  private initializeColorMappings() {
    const mappings: Array<
      [string, string | { color: number; hex: string; name: string }]
    > = [
      // Items
      [
        'items.sword',
        { color: 16729156, hex: '#FF4444', name: 'Bronze Sword' },
      ],
      ['items.bow', { color: 9127187, hex: '#8B4513', name: 'Wooden Bow' }],
      [
        'items.shield',
        { color: 12632256, hex: '#C0C0C0', name: 'Bronze Shield' },
      ],
      [
        'items.potion',
        { color: 16724736, hex: '#FF3300', name: 'Health Potion' },
      ],
      ['items.food', { color: 16753920, hex: '#FFA500', name: 'Cooked Fish' }],
      ['items.coins', { color: 16766720, hex: '#FFD700', name: 'Gold Coins' }],
      [
        'items.arrows',
        { color: 8421504, hex: '#808080', name: 'Bronze Arrows' },
      ],

      // NPCs/Mobs
      ['npcs.goblin', { color: 2263842, hex: '#228822', name: 'Goblin' }],
      ['npcs.skeleton', { color: 16119260, hex: '#F5F5DC', name: 'Skeleton' }],
      ['npcs.guard', { color: 4356961, hex: '#427361', name: 'Town Guard' }],
      [
        'npcs.merchant',
        { color: 8421504, hex: '#808080', name: 'Shop Keeper' },
      ],
      ['npcs.banker', { color: 16776960, hex: '#FFFF00', name: 'Banker' }],

      // Resources
      [
        'resources.tree',
        { color: 6543953, hex: '#64C351', name: 'Willow Tree' },
      ],
      [
        'resources.iron_rock',
        { color: 4210752, hex: '#404040', name: 'Iron Rock' },
      ],
      [
        'resources.gold_rock',
        { color: 16766720, hex: '#FFD700', name: 'Gold Vein' },
      ],
      [
        'resources.fishing_spot',
        { color: 255, hex: '#0000FF', name: 'Fishing Spot' },
      ],

      // Special/System
      [
        'special.player',
        { color: 16729411, hex: '#FF4543', name: 'Player Avatar' },
      ],
      [
        'special.damage_indicator',
        { color: 16711680, hex: '#FF0000', name: 'Damage Flash' },
      ],
      [
        'special.heal_indicator',
        { color: 65280, hex: '#00FF00', name: 'Healing Effect' },
      ],
      [
        'special.spawn_point',
        { color: 65535, hex: '#00FFFF', name: 'Spawn Location' },
      ],
      [
        'special.bank',
        { color: 9699539, hex: '#9400D3', name: 'Bank Building' },
      ],
      [
        'special.shop',
        { color: 16753920, hex: '#FFA500', name: 'General Store' },
      ],
    ]

    mappings.forEach(([key, value]) => {
      if (typeof value === 'string') {
        this.colorMappings.set(key, value)
      } else {
        this.colorMappings.set(key, value.hex)
      }
    })
  }

  /**
   * Register a new entity color for detection
   */
  registerEntityColor(
    entityType: string,
    config: {
      color: number | string
      hex?: string
      tolerance?: number
      [key: string]: unknown
    }
  ): void {
    let hexColor: string

    if (config.hex) {
      hexColor = config.hex
    } else if (typeof config.color === 'string') {
      hexColor = config.color
    } else if (typeof config.color === 'number') {
      // Convert number to hex
      hexColor = `#${config.color.toString(16).padStart(6, '0').toUpperCase()}`
    } else {
      logger.warn(
        `[ColorDetector] Invalid color config for entity ${entityType}: ${JSON.stringify(config)}` as string
      )
      return
    }

    // Ensure hex color starts with #
    if (!hexColor.startsWith('#')) {
      hexColor = `#${hexColor}`
    }

    this.colorMappings.set(entityType, hexColor)
    logger.info(
      `[ColorDetector] Registered entity color: ${entityType} -> ${hexColor}`
    )
  }

  /**
   * Analyze a screenshot and detect all colored entities
   */
  async detectEntitiesInImage(imageBuffer: Buffer): Promise<DetectedEntity[]> {
    logger.info('[ColorDetector] Analyzing screenshot for colored entities...')

    try {
      const canvas = createCanvas(1, 1) // Temporary canvas
      const ctx = canvas.getContext('2d')
      const img = await loadImage(imageBuffer)

      // Resize canvas to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw image to canvas
      ctx.drawImage(img, 0, 0)

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      logger.info(
        `[ColorDetector] Processing ${canvas.width}x${canvas.height} image`
      )

      // Analyze for each known color
      const detectedEntities: DetectedEntity[] = []

      for (const [entityType, colorHex] of this.colorMappings) {
        const clusters = this.findColorClusters(imageData, colorHex)

        for (const cluster of clusters) {
          if (cluster.size >= this.config.minClusterSize) {
            const entity: DetectedEntity = {
              color: colorHex,
              positions: cluster.pixels,
              confidence: Math.min(cluster.size / 100, 1), // Confidence based on cluster size
              type: entityType,
              boundingBox: this.calculateBoundingBox(cluster.pixels),
            }
            detectedEntities.push(entity)
            logger.info(
              `[ColorDetector] Found ${entityType} at ${JSON.stringify(cluster.centroid)} (${cluster.size} pixels)`
            )
          }
        }
      }

      logger.info(
        `[ColorDetector] Detected ${detectedEntities.length} entities total`
      )
      return detectedEntities
    } catch (error) {
      logger.error('[ColorDetector] Error analyzing image:', error)
      throw error
    }
  }

  /**
   * Find clusters of a specific color in the image
   */
  private findColorClusters(
    imageData: ImageData,
    targetHex: string
  ): ColorCluster[] {
    const { data, width, height } = imageData
    const targetRgb = this.hexToRgb(targetHex)
    if (!targetRgb) return []

    const visited = new Set<string>()
    const clusters: ColorCluster[] = []

    // Sample pixels with step size to improve performance
    for (let y = 0; y < height; y += this.config.samplingStep) {
      for (let x = 0; x < width; x += this.config.samplingStep) {
        const pixelKey = `${x},${y}`
        if (visited.has(pixelKey)) continue

        const pixelIndex = (y * width + x) * 4
        const pixelRgb = {
          r: data[pixelIndex],
          g: data[pixelIndex + 1],
          b: data[pixelIndex + 2],
        }

        if (this.isColorMatch(pixelRgb, targetRgb)) {
          // Found matching pixel - start flood fill to find cluster
          const cluster = this.floodFillCluster(
            imageData,
            x,
            y,
            targetRgb,
            visited
          )
          if (cluster.pixels.length >= this.config.minClusterSize) {
            clusters.push(cluster)
          }
        }
      }
    }

    return this.mergeClusters(clusters)
  }

  /**
   * Flood fill algorithm to find connected pixels of the same color
   */
  private floodFillCluster(
    imageData: ImageData,
    startX: number,
    startY: number,
    targetRgb: { r: number; g: number; b: number },
    visited: Set<string>
  ): ColorCluster {
    const { data, width, height } = imageData
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
    const clusterPixels: Array<{ x: number; y: number }> = []

    while (stack.length > 0) {
      const { x, y } = stack.pop()!
      const pixelKey = `${x},${y}`

      if (
        visited.has(pixelKey) ||
        x < 0 ||
        x >= width ||
        y < 0 ||
        y >= height
      ) {
        continue
      }

      const pixelIndex = (y * width + x) * 4
      const pixelRgb = {
        r: data[pixelIndex],
        g: data[pixelIndex + 1],
        b: data[pixelIndex + 2],
      }

      if (!this.isColorMatch(pixelRgb, targetRgb)) {
        continue
      }

      visited.add(pixelKey)
      clusterPixels.push({ x, y })

      // Add neighboring pixels to stack
      stack.push(
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      )
    }

    const centroid = this.calculateCentroid(clusterPixels)

    return {
      color: this.rgbToHex(targetRgb),
      pixels: clusterPixels,
      centroid,
      size: clusterPixels.length,
    }
  }

  /**
   * Check if two colors match within tolerance
   */
  private isColorMatch(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number }
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(color1.r - color2.r, 2) +
        Math.pow(color1.g - color2.g, 2) +
        Math.pow(color1.b - color2.b, 2)
    )
    return distance <= this.config.colorTolerance
  }

  /**
   * Merge nearby clusters of the same color
   */
  private mergeClusters(clusters: ColorCluster[]): ColorCluster[] {
    const merged: ColorCluster[] = []
    const used = new Set<number>()

    for (let i = 0; i < clusters.length; i++) {
      if (used.has(i)) continue

      let mergedCluster = { ...clusters[i] }
      used.add(i)

      // Find nearby clusters to merge
      for (let j = i + 1; j < clusters.length; j++) {
        if (used.has(j)) continue

        const distance = this.calculateDistance(
          mergedCluster.centroid,
          clusters[j].centroid
        )

        if (distance <= this.config.mergeDistance) {
          // Merge clusters
          mergedCluster.pixels.push(...clusters[j].pixels)
          mergedCluster.centroid = this.calculateCentroid(mergedCluster.pixels)
          mergedCluster.size = mergedCluster.pixels.length
          used.add(j)
        }
      }

      merged.push(mergedCluster)
    }

    return merged
  }

  /**
   * Helper functions
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  private rgbToHex(rgb: { r: number; g: number; b: number }): string {
    return `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`
  }

  private calculateCentroid(pixels: Array<{ x: number; y: number }>): {
    x: number
    y: number
  } {
    if (pixels.length === 0) return { x: 0, y: 0 }

    const sum = pixels.reduce(
      (acc, pixel) => ({ x: acc.x + pixel.x, y: acc.y + pixel.y }),
      { x: 0, y: 0 }
    )

    return {
      x: Math.round(sum.x / pixels.length),
      y: Math.round(sum.y / pixels.length),
    }
  }

  private calculateDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
    )
  }

  private calculateBoundingBox(pixels: Array<{ x: number; y: number }>): {
    x: number
    y: number
    width: number
    height: number
  } {
    if (pixels.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

    const xs = pixels.map(p => p.x)
    const ys = pixels.map(p => p.y)

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }
}
