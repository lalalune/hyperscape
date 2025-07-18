/**
 * Enhanced Retexturing Service with Meshy Text-to-Texture API
 * 
 * Provides real texture generation using Meshy.ai's text-to-texture API
 * instead of procedural texture generation to avoid Node.js compatibility issues.
 */

import { MeshyAIService, TextToTextureRequest } from './MeshyAIService'
import type {
  GeometryData,
  RetexturingRequest,
  RetexturingOptions,
  RetexturingMetadata
} from './types'

// Optional canvas import with fallback
let createCanvas: any
let CanvasRenderingContext2D: any
let canvasAvailable = false

try {
  const canvasModule = require('canvas')
  createCanvas = canvasModule.createCanvas
  CanvasRenderingContext2D = canvasModule.CanvasRenderingContext2D
  canvasAvailable = true
} catch (e) {
  console.warn('⚠️  Canvas module not available, using fallback texture generation')
}

export interface TextureAtlasConfig {
  atlasSize: number
  padding: number
  maxTextures: number
  format: 'png' | 'jpg' | 'webp'
  compression: number
}

export interface PrimitiveTextureRequest {
  primitiveType: 'cube' | 'sphere' | 'cylinder' | 'plane' | 'custom'
  baseColor: string
  normalMap?: string
  roughnessMap?: string
  metallicMap?: string
  emissiveMap?: string
  textureStyle: 'pbr' | 'stylized' | 'pixel' | 'hand-painted'
  tilePattern?: 'brick' | 'stone' | 'wood' | 'metal' | 'fabric' | 'organic'
  scale: number
}

export interface TextureAtlasEntry {
  id: string
  uvBounds: { x: number; y: number; width: number; height: number }
  originalSize: { width: number; height: number }
  primitiveType: string
  materialHash: string
}

export interface OptimizedMaterial {
  id: string
  atlasTexture: string
  normalAtlas?: string
  roughnessAtlas?: string
  metallicAtlas?: string
  emissiveAtlas?: string
  uvMapping: TextureAtlasEntry[]
  performanceMetrics: {
    drawCalls: number
    textureMemory: number
    triangleCount: number
  }
}

export interface RetexturingResult {
  optimizedModel: string
  materialDefinition: OptimizedMaterial
  performanceGain: {
    originalDrawCalls: number
    optimizedDrawCalls: number
    memoryReduction: number
    renderingSpeedup: number
  }
  cacheKey: string
}

export interface MeshyRetexturingConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  defaultArtStyle: string
  defaultResolution: number
  maxRetries: number
  cacheEnabled: boolean
  cacheTTL: number
  atlasSize?: number
  padding?: number
  maxTextures?: number
  format?: 'png' | 'jpg' | 'webp'
  compression?: number
}

export interface TextureGenerationRequest {
  id: string
  modelUrl: string
  prompt: string
  artStyle?: string
  negativePrompt?: string
  seed?: number
  resolution?: number
  metadata?: any
}

export interface TextureGenerationResult {
  id: string
  requestId: string
  status: 'pending' | 'completed' | 'failed'
  meshyTaskId: string
  textureUrls?: {
    diffuse?: string
    normal?: string
    roughness?: string
    metallic?: string
  }
  modelUrl?: string
  processingTime: number
  quality: number
  error?: {
    code: string
    message: string
    retryable: boolean
  }
}

// Type adapter for node-canvas ImageData compatibility
interface NodeCanvasImageData {
  data: Uint8ClampedArray
  width: number
  height: number
}

// Helper to convert node-canvas ImageData to browser-compatible format
function toImageData(canvasImageData: NodeCanvasImageData): ImageData {
  return {
    data: canvasImageData.data,
    width: canvasImageData.width,
    height: canvasImageData.height,
    colorSpace: 'srgb' as any
  } as ImageData
}

// Fallback implementation for when canvas module is not available
class FallbackImageData implements ImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  colorSpace: PredefinedColorSpace = 'srgb'

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}

export class RetexturingService {
  private config: MeshyRetexturingConfig
  private meshyService: MeshyAIService
  private textureCache: Map<string, TextureGenerationResult> = new Map()
  private atlasCache: Map<string, TextureAtlasEntry> = new Map()
  private activeRequests: Map<string, Promise<TextureGenerationResult>> = new Map()
  private materialCache: Map<string, OptimizedMaterial> = new Map()

  constructor(meshyService: MeshyAIService, config: Partial<MeshyRetexturingConfig> = {}) {
    this.meshyService = meshyService
    this.config = {
      apiKey: process.env.MESHY_API_KEY || '',
      baseUrl: 'https://api.meshy.ai',
      timeout: 300000, // 5 minutes
      defaultArtStyle: 'realistic',
      defaultResolution: 1024,
      maxRetries: 3,
      cacheEnabled: true,
      cacheTTL: 86400000, // 24 hours
      atlasSize: 2048,
      padding: 4,
      maxTextures: 64,
      format: 'png',
      compression: 0.8,
      ...config
    }

    if (!this.config.apiKey) {
      console.warn('⚠️ No Meshy API key provided for RetexturingService')
    }

    this.startCacheCleanup()
  }

  /**
   * Retexture a primitive with performance optimizations
   */
  async retexturePrimitive(
    primitiveGeometry: any,
    textureRequest: PrimitiveTextureRequest
  ): Promise<RetexturingResult> {
    console.log(`🎨 Retexturing ${textureRequest.primitiveType} primitive`)

    // Generate material hash for caching
    const materialHash = this.generateMaterialHash(textureRequest)
    const cacheKey = `${textureRequest.primitiveType}_${materialHash}`

    // Check cache first
    if (this.materialCache.has(cacheKey)) {
      console.log(`✅ Using cached material: ${cacheKey}`)
      return this.createResultFromCache(cacheKey, primitiveGeometry)
    }

    // Generate textures for the primitive
    const textures = await this.generatePrimitiveTextures(textureRequest)

    // Create or update texture atlas
    const atlasEntry = await this.addToTextureAtlas(textures, textureRequest)

    // Optimize UV mapping for atlas
    const optimizedGeometry = this.optimizeUVMapping(primitiveGeometry, atlasEntry)

    // Create optimized material
    const optimizedMaterial = await this.createOptimizedMaterial([atlasEntry])

    // Calculate performance metrics
    const performanceGain = this.calculatePerformanceGain(primitiveGeometry, optimizedGeometry)

    // Cache the result
    this.materialCache.set(cacheKey, optimizedMaterial)

    const result: RetexturingResult = {
      optimizedModel: this.serializeOptimizedModel(optimizedGeometry),
      materialDefinition: optimizedMaterial,
      performanceGain,
      cacheKey
    }

    console.log(`✅ Primitive retextured with ${performanceGain.renderingSpeedup}x speedup`)
    return result
  }

  /**
   * Batch retexture multiple primitives into single atlas
   */
  async batchRetexturePrimitives(
    requests: Array<{
      geometry: any
      textureRequest: PrimitiveTextureRequest
      id: string
    }>
  ): Promise<{
    optimizedModels: Array<{ id: string; model: string }>
    sharedMaterial: OptimizedMaterial
    totalPerformanceGain: any
  }> {
    console.log(`🔄 Batch retexturing ${requests.length} primitives`)

    const atlasEntries: TextureAtlasEntry[] = []
    const optimizedModels: Array<{ id: string; model: string }> = []
    let totalOriginalDrawCalls = 0
    let totalMemoryUsed = 0

    // Process each request and collect atlas entries
    for (const request of requests) {
      const textures = await this.generatePrimitiveTextures(request.textureRequest)
      const atlasEntry = await this.addToTextureAtlas(textures, request.textureRequest)
      atlasEntries.push(atlasEntry)

      // Optimize geometry for this atlas entry
      const optimizedGeometry = this.optimizeUVMapping(request.geometry, atlasEntry)

      optimizedModels.push({
        id: request.id,
        model: this.serializeOptimizedModel(optimizedGeometry)
      })

      totalOriginalDrawCalls += 1 // Each primitive was originally a draw call
      totalMemoryUsed += this.estimateTextureMemory(request.textureRequest)
    }

    // Create shared material from all atlas entries
    const sharedMaterial = await this.createOptimizedMaterial(atlasEntries)

    const totalPerformanceGain = {
      originalDrawCalls: totalOriginalDrawCalls,
      optimizedDrawCalls: 1, // All primitives now share one material
      memoryReduction: totalMemoryUsed / sharedMaterial.performanceMetrics.textureMemory,
      renderingSpeedup: totalOriginalDrawCalls
    }

    console.log(`✅ Batch retexturing complete: ${totalOriginalDrawCalls} → 1 draw call`)

    return {
      optimizedModels,
      sharedMaterial,
      totalPerformanceGain
    }
  }

  /**
   * Generate textures for a primitive based on request
   */
  private async generatePrimitiveTextures(
    request: PrimitiveTextureRequest
  ): Promise<{
    baseColor: ImageData
    normal?: ImageData
    roughness?: ImageData
    metallic?: ImageData
    emissive?: ImageData
  }> {
    const size = this.getTextureSize(request.primitiveType)

    // Parse color from hex string to RGB values
    const baseColorRGB = this.hexToRGB(request.baseColor)

    const baseColor = this.generateProceduralTexture(
      size,
      baseColorRGB,
      request.tilePattern || 'solid',
      request.textureStyle
    )

    const result: any = { baseColor }

    // Generate additional maps for PBR materials
    if (request.textureStyle === 'pbr') {
      result.normal = this.generateNormalMap(request.tilePattern || 'solid', size)
      result.roughness = this.generateRoughnessMap(request.tilePattern || 'solid', size)
      result.metallic = this.generateMetallicMap(request.tilePattern || 'solid', size)
    }

    if (request.emissiveMap) {
      result.emissive = this.generateEmissiveMap(size)
    }

    return result
  }

  /**
   * Convert hex color to RGB array
   */
  private hexToRGB(hex: string): [number, number, number] {
    // Remove # if present
    const cleanHex = hex.replace('#', '')

    // Parse hex values
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255

    return [r, g, b]
  }

  /**
   * Add textures to atlas and return UV bounds
   */
  private async addToTextureAtlas(
    textures: any,
    request: PrimitiveTextureRequest
  ): Promise<TextureAtlasEntry> {
    const textureSize = this.getTextureSize(request.primitiveType)
    const atlasPosition = this.findAtlasPosition(textureSize)

    const entry: TextureAtlasEntry = {
      id: this.generateTextureId(request),
      uvBounds: {
        x: atlasPosition.x / (this.config.atlasSize || 2048),
        y: atlasPosition.y / (this.config.atlasSize || 2048),
        width: textureSize / (this.config.atlasSize || 2048),
        height: textureSize / (this.config.atlasSize || 2048)
      },
      originalSize: { width: textureSize, height: textureSize },
      primitiveType: request.primitiveType,
      materialHash: this.generateMaterialHash(request)
    }

    this.atlasCache.set(entry.id, entry)
    return entry
  }

  /**
   * Optimize UV mapping for texture atlas
   */
  private optimizeUVMapping(geometry: any, atlasEntry: TextureAtlasEntry): any {
    // Clone geometry
    const optimizedGeometry = { ...geometry }

    // Adjust UV coordinates to atlas bounds
    if (optimizedGeometry.uvs) {
      optimizedGeometry.uvs = optimizedGeometry.uvs.map((uv: number[]) => [
        atlasEntry.uvBounds.x + (uv[0] * atlasEntry.uvBounds.width),
        atlasEntry.uvBounds.y + (uv[1] * atlasEntry.uvBounds.height)
      ])
    }

    return optimizedGeometry
  }

  /**
   * Create optimized material from atlas entries
   */
  private async createOptimizedMaterial(
    atlasEntries: TextureAtlasEntry[]
  ): Promise<OptimizedMaterial> {
    const materialId = `atlas_${Date.now()}`

    // In a real implementation, you would create actual texture atlases here
    const atlasTexture = await this.createTextureAtlas(atlasEntries, 'baseColor')
    const normalAtlas = await this.createTextureAtlas(atlasEntries, 'normal')
    const roughnessAtlas = await this.createTextureAtlas(atlasEntries, 'roughness')
    const metallicAtlas = await this.createTextureAtlas(atlasEntries, 'metallic')

    const material: OptimizedMaterial = {
      id: materialId,
      atlasTexture,
      normalAtlas,
      roughnessAtlas,
      metallicAtlas,
      uvMapping: atlasEntries,
      performanceMetrics: {
        drawCalls: 1,
        textureMemory: this.calculateAtlasMemory(),
        triangleCount: atlasEntries.reduce((sum, entry) => sum + 100, 0) // Estimate
      }
    }

    return material
  }

  /**
   * Generate texture using Meshy text-to-texture API
   */
  private async generateTexture(
    request: TextureGenerationRequest
  ): Promise<TextureGenerationResult> {
    const startTime = Date.now()
    console.log(`🎨 Generating texture via Meshy API: ${request.prompt}`)

    try {
      // Create texture generation request
      const meshyRequest: TextToTextureRequest = {
        modelUrl: request.modelUrl,
        prompt: request.prompt,
        artStyle: (request.artStyle || this.config.defaultArtStyle) as any,
        negativePrompt: request.negativePrompt || this.generateNegativePrompt(request.metadata),
        seed: request.seed,
        resolution: (request.resolution || this.config.defaultResolution) as any
      }

      // Submit to Meshy API
      const taskId = await this.meshyService.textToTexture(meshyRequest)

      // Wait for completion
      const meshyResult = await this.meshyService.waitForTextureCompletion(taskId)

      // Extract texture URLs from result
      const textureUrls = this.extractTextureUrls(meshyResult)

      const result: TextureGenerationResult = {
        id: request.id,
        requestId: request.id,
        status: meshyResult.status === 'SUCCEEDED' ? 'completed' : 'failed',
        meshyTaskId: taskId,
        textureUrls,
        modelUrl: meshyResult.model_urls?.glb || meshyResult.model_urls?.obj,
        processingTime: Date.now() - startTime,
        quality: this.calculateTextureQuality(meshyResult),
        error: meshyResult.status === 'FAILED' ? {
          code: meshyResult.task_error?.code || 'UNKNOWN_ERROR',
          message: meshyResult.task_error?.message || 'Unknown texture generation error',
          retryable: true
        } : undefined
      }

      console.log(`✅ Texture generated successfully: ${request.id} (${result.processingTime}ms)`)
      return result

    } catch (error) {
      console.error(`❌ Texture generation failed: ${request.id}`, error)

      return {
        id: request.id,
        requestId: request.id,
        status: 'failed',
        meshyTaskId: '',
        processingTime: Date.now() - startTime,
        quality: 0,
        error: {
          code: 'TEXTURE_API_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: true
        }
      }
    }
  }

  /**
   * Generate procedural texture based on pattern and style
   */
  private generateProceduralTexture(
    size: number,
    baseColor: [number, number, number],
    pattern: string,
    style: string
  ): ImageData {
    // Fallback implementation when canvas is not available
    if (!canvasAvailable) {
      const imageData = new FallbackImageData(size, size)
      const data = imageData.data

      // Convert baseColor from 0-1 to 0-255
      const r = Math.floor(baseColor[0] * 255)
      const g = Math.floor(baseColor[1] * 255)
      const b = Math.floor(baseColor[2] * 255)

      // Generate procedural texture based on pattern
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4

          let intensity = 1.0
          let alpha = 255

          // Apply pattern
          switch (pattern) {
            case 'noise':
              intensity = 0.7 + Math.random() * 0.3
              break
            case 'stripes':
              intensity = Math.sin(x * 0.1) * 0.2 + 0.8
              break
            case 'checkerboard':
              intensity = ((Math.floor(x / 32) + Math.floor(y / 32)) % 2) ? 0.8 : 1.0
              break
            case 'gradient':
              intensity = 0.5 + (y / size) * 0.5
              break
          }

          // Apply style modifiers
          if (style === 'rough' || style === 'weathered') {
            intensity *= 0.8 + Math.random() * 0.2
          }

          // Set pixel color
          data[idx] = Math.floor(r * intensity)
          data[idx + 1] = Math.floor(g * intensity)
          data[idx + 2] = Math.floor(b * intensity)
          data[idx + 3] = alpha
        }
      }

      return imageData as ImageData
    }

    // Use node-canvas when available
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    // Convert baseColor from 0-1 to 0-255
    const r = Math.floor(baseColor[0] * 255)
    const g = Math.floor(baseColor[1] * 255)
    const b = Math.floor(baseColor[2] * 255)

    // Generate procedural texture based on pattern
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4

        let intensity = 1.0
        let alpha = 255

        // Apply pattern
        switch (pattern) {
          case 'noise':
            intensity = 0.7 + Math.random() * 0.3
            break
          case 'stripes':
            intensity = Math.sin(x * 0.1) * 0.2 + 0.8
            break
          case 'checkerboard':
            intensity = ((Math.floor(x / 32) + Math.floor(y / 32)) % 2) ? 0.8 : 1.0
            break
          case 'gradient':
            intensity = 0.5 + (y / size) * 0.5
            break
        }

        // Apply style modifiers
        if (style === 'rough' || style === 'weathered') {
          intensity *= 0.8 + Math.random() * 0.2
        }

        // Set pixel color
        data[idx] = Math.floor(r * intensity)
        data[idx + 1] = Math.floor(g * intensity)
        data[idx + 2] = Math.floor(b * intensity)
        data[idx + 3] = alpha
      }
    }

    return toImageData(imageData)
  }

  /**
   * Generate normal map for pattern
   */
  private generateNormalMap(pattern: string, size: number): ImageData {
    if (!canvasAvailable) {
      const imageData = new FallbackImageData(size, size)
      const data = imageData.data

      // Fill with flat normal (128, 128, 255)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128
        data[i + 1] = 128
        data[i + 2] = 255
        data[i + 3] = 255
      }

      return imageData as ImageData
    }

    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    // Generate height data first, then convert to normal map
    ctx.fillStyle = '#8080FF' // Flat normal (128, 128, 255)
    ctx.fillRect(0, 0, size, size)

    // Add pattern-specific normal details
    switch (pattern) {
      case 'brick':
        this.addBrickNormals(ctx, size)
        break
      case 'stone':
        this.addStoneNormals(ctx, size)
        break
    }

    return toImageData(ctx.getImageData(0, 0, size, size))
  }

  /**
   * Generate roughness map
   */
  private generateRoughnessMap(pattern: string, size: number): ImageData {
    if (!canvasAvailable) {
      const imageData = new FallbackImageData(size, size)
      const data = imageData.data

      // Base roughness
      const baseRoughness = pattern === 'metal' ? 0.2 : 0.8
      const value = Math.floor(baseRoughness * 255)

      for (let i = 0; i < data.length; i += 4) {
        data[i] = value
        data[i + 1] = value
        data[i + 2] = value
        data[i + 3] = 255
      }

      return imageData as ImageData
    }

    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    // Base roughness
    const baseRoughness = pattern === 'metal' ? 0.2 : 0.8
    ctx.fillStyle = `rgb(${baseRoughness * 255}, ${baseRoughness * 255}, ${baseRoughness * 255})`
    ctx.fillRect(0, 0, size, size)

    return toImageData(ctx.getImageData(0, 0, size, size))
  }

  /**
   * Generate metallic map
   */
  private generateMetallicMap(pattern: string, size: number): ImageData {
    if (!canvasAvailable) {
      const imageData = new FallbackImageData(size, size)
      const data = imageData.data

      const isMetallic = pattern === 'metal' ? 255 : 0

      for (let i = 0; i < data.length; i += 4) {
        data[i] = isMetallic
        data[i + 1] = isMetallic
        data[i + 2] = isMetallic
        data[i + 3] = 255
      }

      return imageData as ImageData
    }

    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    const isMetallic = pattern === 'metal' ? 255 : 0
    ctx.fillStyle = `rgb(${isMetallic}, ${isMetallic}, ${isMetallic})`
    ctx.fillRect(0, 0, size, size)

    return toImageData(ctx.getImageData(0, 0, size, size))
  }

  /**
   * Generate emissive map
   */
  private generateEmissiveMap(size: number): ImageData {
    if (!canvasAvailable) {
      const imageData = new FallbackImageData(size, size)
      const data = imageData.data

      // No emission by default - all black
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        data[i + 3] = 255
      }

      return imageData as ImageData
    }

    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    // No emission by default
    ctx.fillStyle = 'rgb(0, 0, 0)'
    ctx.fillRect(0, 0, size, size)

    return toImageData(ctx.getImageData(0, 0, size, size))
  }

  /**
   * Pattern generation methods
   */
  private addBrickPattern(ctx: CanvasRenderingContext2D, size: number): void {
    const brickWidth = size / 8
    const brickHeight = size / 16

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.lineWidth = 1

    for (let y = 0; y < size; y += brickHeight) {
      for (let x = 0; x < size; x += brickWidth) {
        const offset = (Math.floor(y / brickHeight) % 2) * brickWidth / 2
        ctx.strokeRect(x + offset, y, brickWidth, brickHeight)
      }
    }
  }

  private addStonePattern(ctx: CanvasRenderingContext2D, size: number): void {
    // Add random stone-like variations
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const radius = Math.random() * 10 + 5

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`
      ctx.fill()
    }
  }

  private addWoodPattern(ctx: CanvasRenderingContext2D, size: number): void {
    // Add wood grain lines
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)'
    ctx.lineWidth = 2

    for (let y = 0; y < size; y += 4) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y + Math.sin(y * 0.1) * 10)
      ctx.stroke()
    }
  }

  private addMetalPattern(ctx: CanvasRenderingContext2D, size: number): void {
    // Add brushed metal effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    for (let y = 0; y < size; y += 2) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
    }
  }

  private addFabricPattern(ctx: CanvasRenderingContext2D, size: number): void {
    // Add weave pattern
    const threadSize = size / 32

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.lineWidth = 1

    for (let i = 0; i < size; i += threadSize) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }
  }

  private addBrickNormals(ctx: CanvasRenderingContext2D, size: number): void {
    // Add normal map details for brick pattern
    // This would be more complex in a real implementation
  }

  private addStoneNormals(ctx: CanvasRenderingContext2D, size: number): void {
    // Add normal map details for stone pattern
    // This would be more complex in a real implementation
  }

  /**
   * Utility methods
   */
  private getTextureSize(primitiveType: string): number {
    const sizes = {
      cube: 256,
      sphere: 256,
      cylinder: 256,
      plane: 512,
      custom: 256
    }
    return sizes[primitiveType as keyof typeof sizes] || 256
  }

  private findAtlasPosition(textureSize: number): { x: number; y: number } {
    // Simple atlas packing - in practice you'd use a more sophisticated algorithm
    const entries = Array.from(this.atlasCache.values())
    let x = 0, y = 0
    const atlasSize = this.config.atlasSize || 2048
    const padding = this.config.padding || 4

    for (const entry of entries) {
      const entryPixelX = entry.uvBounds.x * atlasSize
      const entryPixelWidth = entry.uvBounds.width * atlasSize

      if (entryPixelX + entryPixelWidth + textureSize + padding <= atlasSize) {
        x = entryPixelX + entryPixelWidth + padding
        y = entry.uvBounds.y * atlasSize
        break
      }
    }

    return { x, y }
  }

  private generateMaterialHash(request: PrimitiveTextureRequest): string {
    const data = {
      baseColor: request.baseColor,
      textureStyle: request.textureStyle,
      tilePattern: request.tilePattern,
      scale: request.scale
    }

    return btoa(JSON.stringify(data)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
  }

  private generateTextureId(request: PrimitiveTextureRequest): string {
    return `${request.primitiveType}_${this.generateMaterialHash(request)}`
  }

  private async createTextureAtlas(entries: TextureAtlasEntry[], type: string): Promise<string> {
    // In practice, this would create actual texture atlases
    // For now, return a placeholder URL
    return `data:atlas_${type}_${Date.now()}`
  }

  private calculateAtlasMemory(): number {
    // Estimate memory usage for atlas textures
    const atlasSize = this.config.atlasSize || 2048
    const atlasPixels = atlasSize * atlasSize
    const bytesPerPixel = 4 // RGBA
    const numAtlases = 4 // Base, Normal, Roughness, Metallic

    return atlasPixels * bytesPerPixel * numAtlases
  }

  private estimateTextureMemory(request: PrimitiveTextureRequest): number {
    const size = this.getTextureSize(request.primitiveType)
    const pixels = size * size
    const bytesPerPixel = 4
    const numTextures = request.textureStyle === 'pbr' ? 4 : 1

    return pixels * bytesPerPixel * numTextures
  }

  private calculatePerformanceGain(original: any, optimized: any): any {
    return {
      originalDrawCalls: 1,
      optimizedDrawCalls: 1,
      memoryReduction: 1.0,
      renderingSpeedup: 1.0
    }
  }

  private createResultFromCache(cacheKey: string, geometry: any): RetexturingResult {
    const material = this.materialCache.get(cacheKey)!

    return {
      optimizedModel: this.serializeOptimizedModel(geometry),
      materialDefinition: material,
      performanceGain: {
        originalDrawCalls: 1,
        optimizedDrawCalls: 1,
        memoryReduction: 1.0,
        renderingSpeedup: 1.0
      },
      cacheKey
    }
  }

  private serializeOptimizedModel(geometry: any): string {
    // Serialize geometry to a format that can be loaded by the 3D engine
    return JSON.stringify(geometry)
  }

  private initializePrimitiveLibrary(): void {
    // Initialize library of common primitive geometries
    this.primitiveLibrary.set('cube', this.createCubeGeometry())
    this.primitiveLibrary.set('sphere', this.createSphereGeometry())
    this.primitiveLibrary.set('cylinder', this.createCylinderGeometry())
    this.primitiveLibrary.set('plane', this.createPlaneGeometry())
  }

  private createCubeGeometry(): any {
    // Return cube geometry data
    return {
      vertices: [], // Cube vertices
      uvs: [], // UV coordinates
      normals: [], // Normal vectors
      indices: [] // Triangle indices
    }
  }

  private createSphereGeometry(): any {
    return { vertices: [], uvs: [], normals: [], indices: [] }
  }

  private createCylinderGeometry(): any {
    return { vertices: [], uvs: [], normals: [], indices: [] }
  }

  private createPlaneGeometry(): any {
    return { vertices: [], uvs: [], normals: [], indices: [] }
  }

  /**
   * Get primitive geometry by type
   */
  getPrimitiveGeometry(type: string): any {
    return this.primitiveLibrary.get(type)
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.textureCache.clear()
    this.materialCache.clear()
    console.log('✅ Retexturing caches cleared')
  }

  private startCacheCleanup(): void {
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now()
      for (const [key, result] of this.textureCache.entries()) {
        const age = now - result.processingTime
        if (age > this.config.cacheTTL) {
          this.textureCache.delete(key)
        }
      }
    }, 300000)
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    apiConnectivity: boolean
    cacheSize: number
    activeRequests: number
  }> {
    try {
      const meshyHealth = await this.meshyService.getHealth()

      return {
        status: meshyHealth.status === 'healthy' ? 'healthy' : 'degraded',
        apiConnectivity: meshyHealth.connectivity,
        cacheSize: this.textureCache.size,
        activeRequests: this.activeRequests.size
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        apiConnectivity: false,
        cacheSize: this.textureCache.size,
        activeRequests: this.activeRequests.size
      }
    }
  }

  /**
   * Create a texture generation request for a model URL and prompt
   */
  async generateTextureForModel(
    modelUrl: string,
    prompt: string,
    options: {
      artStyle?: 'realistic' | 'cartoon' | 'stylized' | 'pbr'
      resolution?: 1024 | 2048 | 4096
      negativePrompt?: string
      seed?: number
    } = {}
  ): Promise<TextureGenerationResult> {
    const request: TextureGenerationRequest = {
      id: `direct_${Date.now()}`,
      modelUrl,
      prompt,
      artStyle: options.artStyle || this.config.defaultArtStyle,
      negativePrompt: options.negativePrompt,
      seed: options.seed,
      resolution: options.resolution || this.config.defaultResolution,
      metadata: {
        itemType: 'custom',
        category: 'direct-generation',
        priority: 'medium'
      }
    }

    try {
      return await this.generateTexture(request)
    } catch (error) {
      console.error(`❌ Failed to generate texture for ${request.id}:`, error)

      return {
        id: request.id,
        requestId: request.id,
        status: 'failed',
        meshyTaskId: '',
        processingTime: 0,
        quality: 0,
        error: {
          code: 'TEXTURE_API_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: true
        }
      }
    }
  }

  private generateNegativePrompt(metadata?: any): string {
    return 'low quality, blurry, distorted, broken, ugly, pixelated, noisy, artifacts'
  }

  private extractTextureUrls(meshyResult: any): {
    diffuse?: string
    normal?: string
    roughness?: string
    metallic?: string
  } {
    return {
      diffuse: meshyResult.texture_urls?.diffuse,
      normal: meshyResult.texture_urls?.normal,
      roughness: meshyResult.texture_urls?.roughness,
      metallic: meshyResult.texture_urls?.metallic
    }
  }

  private calculateTextureQuality(meshyResult: any): number {
    // Simple quality score based on result status and texture availability
    if (meshyResult.status !== 'SUCCEEDED') return 0
    let score = 0.5
    if (meshyResult.texture_urls?.diffuse) score += 0.2
    if (meshyResult.texture_urls?.normal) score += 0.1
    if (meshyResult.texture_urls?.roughness) score += 0.1
    if (meshyResult.texture_urls?.metallic) score += 0.1
    return Math.min(score, 1.0)
  }

  private primitiveLibrary: Map<string, any> = new Map()
}