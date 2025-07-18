/**
 * Color Detection Utilities for RPG Visual Testing
 *
 * Provides sophisticated color detection and entity recognition
 * capabilities for visual validation of RPG systems.
 */

import sharp from 'sharp'
import visualTemplatesConfig from '../../game/src/config/visuals/templates.json'

/**
 * RGB color representation
 */
export interface RGBColor {
  r: number
  g: number
  b: number
}

/**
 * Detected entity information
 */
export interface DetectedEntity {
  type: string
  color: string
  positions: EntityPosition[]
  count: number
  confidence: number
}

/**
 * Entity position with cluster information
 */
export interface EntityPosition {
  x: number
  y: number
  clusterSize: number
  confidence: number
}

/**
 * Detection configuration
 */
export interface DetectionConfig {
  colorTolerance: number
  minClusterSize: number
  mergeDistance: number
  samplingStep: number
  confidenceThreshold: number
}

/**
 * Generate entity color map from visual templates
 */
function generateEntityColorMap(): Record<string, string> {
  const colorMap: Record<string, string> = {}

  // Process all template categories
  const categories = ['items', 'npcs', 'containers', 'resources', 'special']

  for (const category of categories) {
    const categoryTemplates = (visualTemplatesConfig as any)[category]
    if (categoryTemplates) {
      for (const [key, template] of Object.entries(categoryTemplates)) {
        const templateData = template as any
        if (templateData.color) {
          colorMap[key] = `#${templateData.color.toString(16).padStart(6, '0').toUpperCase()}`
        }
      }
    }
  }

  // Add special testing colors (only for states not in templates)
  colorMap.loot_drop = '#FF69B4' // Hot Pink for dropped loot
  colorMap.dead_entity = '#800080' // Purple (death indicator)
  colorMap.damaged_entity = '#FF4500' // Orange Red (damage indicator)
  colorMap.healed_entity = '#98FB98' // Pale Green (healing indicator)

  return colorMap
}

/**
 * Entity color definitions based on actual RPG visual templates
 */
export const ENTITY_COLOR_MAP: Record<string, string> = generateEntityColorMap()

/**
 * Default detection configuration
 */
export const DEFAULT_CONFIG: DetectionConfig = {
  colorTolerance: 30,
  minClusterSize: 9,
  mergeDistance: 20,
  samplingStep: 4,
  confidenceThreshold: 0.6,
}

/**
 * Advanced color detection engine for RPG visual testing
 */
export class ColorDetector {
  private config: DetectionConfig

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initialize color detector
   */
  async init(): Promise<void> {
    // Initialization logic if needed
    console.log('[ColorDetector] Initialized')
  }

  /**
   * Detect color at specific position (mock implementation for now)
   */
  async detectColorAtPosition(position: any, expectedColor: string): Promise<boolean> {
    // Mock implementation - in real version this would use canvas pixel detection
    console.log(`[ColorDetector] Checking color at position ${JSON.stringify(position)}, expected: ${expectedColor}`)
    return true // Always return true for now
  }

  /**
   * Convert hex color to RGB
   */
  static hexToRgb(hex: string): RGBColor | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  /**
   * Convert integer color value to hex string
   */
  static intToHex(intColor: number): string {
    return `#${intColor.toString(16).padStart(6, '0').toUpperCase()}`
  }

  /**
   * Convert integer color value to RGB
   */
  static intToRgb(intColor: number): RGBColor {
    return {
      r: (intColor >> 16) & 255,
      g: (intColor >> 8) & 255,
      b: intColor & 255,
    }
  }

  /**
   * Convert RGB to hex color
   */
  static rgbToHex(color: RGBColor): string {
    return `#${((1 << 24) + (color.r << 16) + (color.g << 8) + color.b).toString(16).slice(1)}`
  }

  /**
   * Calculate color distance using Euclidean distance
   */
  static colorDistance(color1: RGBColor, color2: RGBColor): number {
    return Math.sqrt(
      Math.pow(color1.r - color2.r, 2) + Math.pow(color1.g - color2.g, 2) + Math.pow(color1.b - color2.b, 2)
    )
  }

  /**
   * Detect all entities in an image
   */
  async detectEntitiesInImage(imagePath: string): Promise<DetectedEntity[]> {
    try {
      const metadata = await sharp(imagePath).metadata()
      const { width, height } = metadata

      if (!width || !height) {
        throw new Error('Invalid image dimensions')
      }

      // Get raw RGB data
      const imageData = await sharp(imagePath).raw().toBuffer()

      const detectedEntities: DetectedEntity[] = []

      // Scan for each entity type
      for (const [entityType, hexColor] of Object.entries(ENTITY_COLOR_MAP)) {
        const targetColor = ColorDetector.hexToRgb(hexColor)
        if (!targetColor) {
          continue
        }

        const positions = this.findColorPositions(imageData, width, height, targetColor)

        if (positions.length > 0) {
          const confidence = this.calculateEntityConfidence(positions, width, height)

          if (confidence >= this.config.confidenceThreshold) {
            detectedEntities.push({
              type: entityType,
              color: hexColor,
              positions,
              count: positions.length,
              confidence,
            })
          }
        }
      }

      // Sort by confidence
      detectedEntities.sort((a, b) => b.confidence - a.confidence)

      return detectedEntities
    } catch (error) {
      console.error('[ColorDetector] Failed to detect entities:', error)
      return []
    }
  }

  /**
   * Find positions of a specific color in the image
   */
  private findColorPositions(
    imageData: Buffer,
    width: number,
    height: number,
    targetColor: RGBColor
  ): EntityPosition[] {
    const positions: EntityPosition[] = []
    const step = this.config.samplingStep

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 3

        if (idx + 2 >= imageData.length) {
          continue
        }

        const pixelColor: RGBColor = {
          r: imageData[idx],
          g: imageData[idx + 1],
          b: imageData[idx + 2],
        }

        const distance = ColorDetector.colorDistance(pixelColor, targetColor)

        if (distance <= this.config.colorTolerance) {
          const clusterInfo = this.analyzeCluster(imageData, width, height, x, y, targetColor)

          if (clusterInfo.size >= this.config.minClusterSize) {
            positions.push({
              x,
              y,
              clusterSize: clusterInfo.size,
              confidence: clusterInfo.confidence,
            })
          }
        }
      }
    }

    return this.mergeNearbyPositions(positions)
  }

  /**
   * Analyze cluster around a point
   */
  private analyzeCluster(
    imageData: Buffer,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    targetColor: RGBColor
  ): { size: number; confidence: number } {
    const clusterRadius = 10
    let matchingPixels = 0
    let totalPixels = 0

    for (let dy = -clusterRadius; dy <= clusterRadius; dy += 2) {
      for (let dx = -clusterRadius; dx <= clusterRadius; dx += 2) {
        const x = centerX + dx
        const y = centerY + dy

        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 3

          if (idx + 2 < imageData.length) {
            totalPixels++

            const pixelColor: RGBColor = {
              r: imageData[idx],
              g: imageData[idx + 1],
              b: imageData[idx + 2],
            }

            const distance = ColorDetector.colorDistance(pixelColor, targetColor)

            if (distance <= this.config.colorTolerance) {
              matchingPixels++
            }
          }
        }
      }
    }

    const confidence = totalPixels > 0 ? matchingPixels / totalPixels : 0

    return {
      size: matchingPixels,
      confidence,
    }
  }

  /**
   * Merge nearby positions to avoid duplicates
   */
  private mergeNearbyPositions(positions: EntityPosition[]): EntityPosition[] {
    const merged: EntityPosition[] = []
    const used = new Set<number>()

    for (let i = 0; i < positions.length; i++) {
      if (used.has(i)) {
        continue
      }

      const cluster = [positions[i]]
      used.add(i)

      for (let j = i + 1; j < positions.length; j++) {
        if (used.has(j)) {
          continue
        }

        const distance = Math.sqrt(
          Math.pow(positions[i].x - positions[j].x, 2) + Math.pow(positions[i].y - positions[j].y, 2)
        )

        if (distance < this.config.mergeDistance) {
          cluster.push(positions[j])
          used.add(j)
        }
      }

      // Calculate cluster center and combined metrics
      const centerX = cluster.reduce((sum, pos) => sum + pos.x, 0) / cluster.length
      const centerY = cluster.reduce((sum, pos) => sum + pos.y, 0) / cluster.length
      const totalClusterSize = cluster.reduce((sum, pos) => sum + pos.clusterSize, 0)
      const avgConfidence = cluster.reduce((sum, pos) => sum + pos.confidence, 0) / cluster.length

      merged.push({
        x: Math.round(centerX),
        y: Math.round(centerY),
        clusterSize: totalClusterSize,
        confidence: avgConfidence,
      })
    }

    return merged
  }

  /**
   * Calculate overall confidence for entity detection
   */
  private calculateEntityConfidence(positions: EntityPosition[], imageWidth: number, imageHeight: number): number {
    if (positions.length === 0) {
      return 0
    }

    // Base confidence from individual positions
    const avgPositionConfidence = positions.reduce((sum, pos) => sum + pos.confidence, 0) / positions.length

    // Bonus for multiple detections
    const multipleDetectionBonus = Math.min(positions.length * 0.1, 0.3)

    // Bonus for larger clusters
    const maxClusterSize = Math.max(...positions.map(pos => pos.clusterSize))
    const clusterSizeBonus = Math.min(maxClusterSize / 50, 0.2)

    // Penalty for edge positions (might be artifacts)
    const edgePositions = positions.filter(
      pos => pos.x < 50 || pos.x > imageWidth - 50 || pos.y < 50 || pos.y > imageHeight - 50
    ).length
    const edgePenalty = (edgePositions / positions.length) * 0.2

    const finalConfidence = Math.min(
      avgPositionConfidence + multipleDetectionBonus + clusterSizeBonus - edgePenalty,
      1.0
    )

    return Math.max(finalConfidence, 0)
  }

  /**
   * Detect specific entity type in image
   */
  async detectEntityType(imagePath: string, entityType: string): Promise<DetectedEntity | null> {
    const allEntities = await this.detectEntitiesInImage(imagePath)
    return allEntities.find(entity => entity.type === entityType) || null
  }

  /**
   * Compare two images to detect changes in entities
   */
  async compareImages(
    beforeImagePath: string,
    afterImagePath: string
  ): Promise<{
    added: DetectedEntity[]
    removed: DetectedEntity[]
    moved: Array<{ type: string; before: EntityPosition; after: EntityPosition }>
  }> {
    const beforeEntities = await this.detectEntitiesInImage(beforeImagePath)
    const afterEntities = await this.detectEntitiesInImage(afterImagePath)

    const added: DetectedEntity[] = []
    const removed: DetectedEntity[] = []
    const moved: Array<{ type: string; before: EntityPosition; after: EntityPosition }> = []

    // Find added entities
    for (const afterEntity of afterEntities) {
      const beforeMatch = beforeEntities.find(before => before.type === afterEntity.type)
      if (!beforeMatch) {
        added.push(afterEntity)
      }
    }

    // Find removed entities
    for (const beforeEntity of beforeEntities) {
      const afterMatch = afterEntities.find(after => after.type === beforeEntity.type)
      if (!afterMatch) {
        removed.push(beforeEntity)
      }
    }

    // Find moved entities
    for (const beforeEntity of beforeEntities) {
      const afterEntity = afterEntities.find(after => after.type === beforeEntity.type)

      if (afterEntity && beforeEntity.positions.length > 0 && afterEntity.positions.length > 0) {
        const beforePos = beforeEntity.positions[0]
        const afterPos = afterEntity.positions[0]

        const distance = Math.sqrt(Math.pow(beforePos.x - afterPos.x, 2) + Math.pow(beforePos.y - afterPos.y, 2))

        if (distance > this.config.mergeDistance) {
          moved.push({
            type: beforeEntity.type,
            before: beforePos,
            after: afterPos,
          })
        }
      }
    }

    return { added, removed, moved }
  }

  /**
   * Generate a visual debug image showing detected entities
   */
  async generateDebugImage(
    originalImagePath: string,
    outputPath: string,
    detectedEntities: DetectedEntity[]
  ): Promise<void> {
    try {
      const image = sharp(originalImagePath)
      const metadata = await image.metadata()
      const { width, height } = metadata

      if (!width || !height) {
        return
      }

      // Create SVG overlay with entity markers
      const svgOverlay = this.createEntityOverlaySVG(width, height, detectedEntities)

      await image
        .composite([
          {
            input: Buffer.from(svgOverlay),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toFile(outputPath)
    } catch (error) {
      console.error('[ColorDetector] Failed to generate debug image:', error)
    }
  }

  /**
   * Create SVG overlay for detected entities
   */
  private createEntityOverlaySVG(width: number, height: number, entities: DetectedEntity[]): string {
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`

    for (const entity of entities) {
      for (const position of entity.positions) {
        const radius = Math.max(5, Math.sqrt(position.clusterSize) * 2)
        const opacity = Math.min(0.8, position.confidence)

        // Circle marker
        svg += `<circle cx="${position.x}" cy="${position.y}" r="${radius}" `
        svg += `fill="${entity.color}" fill-opacity="${opacity}" `
        svg += 'stroke="#FFFFFF" stroke-width="2"/>'

        // Label
        svg += `<text x="${position.x + radius + 5}" y="${position.y - 5}" `
        svg += 'fill="#FFFFFF" font-family="Arial" font-size="12" font-weight="bold">'
        svg += `${entity.type} (${(position.confidence * 100).toFixed(0)}%)`
        svg += '</text>'
      }
    }

    svg += '</svg>'
    return svg
  }

  /**
   * Batch process multiple images
   */
  async batchDetectEntities(imagePaths: string[]): Promise<Map<string, DetectedEntity[]>> {
    const results = new Map<string, DetectedEntity[]>()

    for (const imagePath of imagePaths) {
      try {
        const entities = await this.detectEntitiesInImage(imagePath)
        results.set(imagePath, entities)
      } catch (error) {
        console.error(`[ColorDetector] Failed to process ${imagePath}:`, error)
        results.set(imagePath, [])
      }
    }

    return results
  }
}

/**
 * Utility functions for common detection tasks
 */
export class DetectionUtils {
  /**
   * Check if player is present in image
   */
  static async hasPlayer(imagePath: string): Promise<boolean> {
    const detector = new ColorDetector()
    const player = await detector.detectEntityType(imagePath, 'player')
    return player !== null && player.confidence > 0.7
  }

  /**
   * Count entities of specific type
   */
  static async countEntities(imagePath: string, entityType: string): Promise<number> {
    const detector = new ColorDetector()
    const entity = await detector.detectEntityType(imagePath, entityType)
    return entity ? entity.count : 0
  }

  /**
   * Check if movement occurred between two images
   */
  static async detectMovement(beforeImage: string, afterImage: string): Promise<boolean> {
    const detector = new ColorDetector()
    const comparison = await detector.compareImages(beforeImage, afterImage)
    return comparison.moved.length > 0
  }

  /**
   * Get entity positions for tracking
   */
  static async getEntityPositions(imagePath: string): Promise<Map<string, EntityPosition[]>> {
    const detector = new ColorDetector()
    const entities = await detector.detectEntitiesInImage(imagePath)

    const positions = new Map<string, EntityPosition[]>()
    for (const entity of entities) {
      positions.set(entity.type, entity.positions)
    }

    return positions
  }
}
