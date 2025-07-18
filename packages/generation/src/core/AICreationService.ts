/**
 * Unified AI Creation Service
 * Manages the complete generation pipeline from description to final asset
 */

import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { 
  GenerationRequest, 
  GenerationResult, 
  GenerationStage,
  AICreationConfig,
  AssetType
} from '../types'
import { ImageGenerationService } from '../services/ImageGenerationService'
import { MeshyService } from '../services/MeshyService'
import { ModelAnalysisService } from '../services/ModelAnalysisService'
import { CacheService } from '../services/CacheService'
import { generateId } from '../utils/helpers'
import { ImageGenerationResult } from '../types'

export class AICreationService extends EventEmitter {
  private imageService: ImageGenerationService
  private meshyService: MeshyService
  private analysisService: ModelAnalysisService
  private cacheService: CacheService
  private config: AICreationConfig
  private activeGenerations: Map<string, GenerationResult> = new Map()

  constructor(config: AICreationConfig) {
    super()
    this.config = config
    
    // Initialize services
    this.imageService = new ImageGenerationService(config.openai)
    this.meshyService = new MeshyService(config.meshy)
    this.analysisService = new ModelAnalysisService()
    this.cacheService = new CacheService(config.cache)
  }

  /**
   * Generate a single asset through the complete pipeline
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const result: GenerationResult = {
      id: request.id || generateId(),
      request,
      stages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.activeGenerations.set(result.id, result)
    
    try {
      // Stage 1: Generate image from description
      await this.generateImage(result)
      
      // Stage 2: Generate 3D model from image
      await this.generateModel(result)
      
      // Stage 3: Remesh model
      await this.remeshModel(result)
      
      // Stage 4: Analyze model (hardpoints, placement, rigging)
      await this.analyzeModel(result)
      
      // Stage 5: Finalize asset
      await this.finalizeAsset(result)
      
      this.emit('complete', result)
      return result
      
    } catch (error) {
      this.emit('error', { result, error })
      throw error
    } finally {
      this.activeGenerations.delete(result.id)
    }
  }

  /**
   * Batch generate multiple assets
   */
  async batchGenerate(requests: GenerationRequest[]): Promise<GenerationResult[]> {
    const results: GenerationResult[] = []
    
    // Process in parallel with concurrency limit
    const batchSize = 5
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(req => this.generate(req))
      )
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          this.emit('batch-error', result.reason)
        }
      }
    }
    
    return results
  }

  /**
   * Regenerate a specific stage
   */
  async regenerateStage(
    resultId: string, 
    stage: GenerationStage['stage']
  ): Promise<GenerationResult> {
    // Load existing result from cache
    const cachedResult = await this.cacheService.get<GenerationResult>(`result:${resultId}`)
    if (!cachedResult) {
      throw new Error(`Result ${resultId} not found`)
    }

    const result = cachedResult
    
    // Clear stages from the specified stage onwards
    const stageIndex = result.stages.findIndex(s => s.stage === stage)
    if (stageIndex >= 0) {
      result.stages = result.stages.slice(0, stageIndex)
    }

    // Regenerate from the specified stage
    switch (stage) {
      case 'image':
        await this.generateImage(result)
        await this.generateModel(result)
        await this.remeshModel(result)
        await this.analyzeModel(result)
        await this.finalizeAsset(result)
        break
      case 'model':
        await this.generateModel(result)
        await this.remeshModel(result)
        await this.analyzeModel(result)
        await this.finalizeAsset(result)
        break
      case 'remesh':
        await this.remeshModel(result)
        await this.analyzeModel(result)
        await this.finalizeAsset(result)
        break
      case 'analysis':
        await this.analyzeModel(result)
        await this.finalizeAsset(result)
        break
      case 'final':
        await this.finalizeAsset(result)
        break
    }

    return result
  }

  /**
   * Get active generations
   */
  getActiveGenerations(): GenerationResult[] {
    return Array.from(this.activeGenerations.values())
  }

  /**
   * Get generation by ID
   */
  async getGeneration(id: string): Promise<GenerationResult | null> {
    // Check active generations first
    if (this.activeGenerations.has(id)) {
      return this.activeGenerations.get(id)!
    }
    
    // Check cache
    return await this.cacheService.get<GenerationResult>(`result:${id}`)
  }

  // Private methods for each stage
  private async generateImage(result: GenerationResult): Promise<void> {
    const stage: GenerationStage = {
      stage: 'image',
      status: 'processing',
      timestamp: new Date()
    }
    result.stages.push(stage)
    this.emit('stage-start', { result, stage: 'image' })

    try {
      // Check cache first
      const cacheKey = `${result.request.id}:image`
      const cached = await this.cacheService.get<ImageGenerationResult>(cacheKey)
      if (cached) {
        result.imageResult = cached
        stage.status = 'completed'
        stage.output = cached
      } else {
        // Generate new image
        const imageResult = await this.imageService.generateImage(
          result.request.description,
          result.request.type,
          result.request.style
        )
        
        result.imageResult = imageResult
        stage.status = 'completed'
        stage.output = imageResult
        
        // Cache the result
        await this.cacheService.set(cacheKey, imageResult)
      }
      
      result.updatedAt = new Date()
      await this.cacheResult(result)
      this.emit('stage-complete', { result, stage: 'image' })
      
    } catch (error) {
      stage.status = 'failed'
      stage.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  private async generateModel(result: GenerationResult): Promise<void> {
    if (!result.imageResult) {
      throw new Error('Image generation required before model generation')
    }

    const stage: GenerationStage = {
      stage: 'model',
      status: 'processing',
      timestamp: new Date()
    }
    result.stages.push(stage)
    this.emit('stage-start', { result, stage: 'model' })

    try {
      const modelResult = await this.meshyService.imageToModel(
        result.imageResult.imageUrl,
        {
          targetPolycount: 10000,
          style: result.request.style
        }
      )
      
      result.modelResult = modelResult
      stage.status = 'completed'
      stage.output = modelResult
      
      result.updatedAt = new Date()
      await this.cacheResult(result)
      this.emit('stage-complete', { result, stage: 'model' })
      
    } catch (error) {
      stage.status = 'failed'
      stage.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  private async remeshModel(result: GenerationResult): Promise<void> {
    if (!result.modelResult) {
      throw new Error('Model generation required before remeshing')
    }

    const stage: GenerationStage = {
      stage: 'remesh',
      status: 'processing',
      timestamp: new Date()
    }
    result.stages.push(stage)
    this.emit('stage-start', { result, stage: 'remesh' })

    try {
      // Determine target polycount based on asset type
      const targetPolycount = this.getTargetPolycount(result.request.type)
      
      const remeshResult = await this.meshyService.remeshModel(
        result.modelResult.modelUrl,
        targetPolycount
      )
      
      result.remeshResult = remeshResult
      stage.status = 'completed'
      stage.output = remeshResult
      
      result.updatedAt = new Date()
      await this.cacheResult(result)
      this.emit('stage-complete', { result, stage: 'remesh' })
      
    } catch (error) {
      stage.status = 'failed'
      stage.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  private async analyzeModel(result: GenerationResult): Promise<void> {
    const modelUrl = result.remeshResult?.modelUrl || result.modelResult?.modelUrl
    if (!modelUrl) {
      throw new Error('Model required for analysis')
    }

    const stage: GenerationStage = {
      stage: 'analysis',
      status: 'processing',
      timestamp: new Date()
    }
    result.stages.push(stage)
    this.emit('stage-start', { result, stage: 'analysis' })

    try {
      // Analyze based on asset type
      switch (result.request.type) {
        case 'weapon':
          result.analysisResult = await this.analysisService.analyzeWeapon(
            modelUrl,
            result.request.subtype as any
          )
          break
        case 'armor':
          result.analysisResult = await this.analysisService.analyzeArmor(
            modelUrl,
            result.request.subtype as any
          )
          break
        case 'character':
          result.analysisResult = await this.analysisService.analyzeForRigging(
            modelUrl,
            result.request.metadata?.creatureType || 'biped'
          )
          break
        case 'building':
          // Determine building type from subtype or description
          let buildingType = result.request.subtype as any
          if (!buildingType) {
            // Try to infer from description
            const desc = result.request.description.toLowerCase()
            if (desc.includes('bank')) buildingType = 'bank'
            else if (desc.includes('store') || desc.includes('shop')) buildingType = 'store'
            else if (desc.includes('house') || desc.includes('home')) buildingType = 'house'
            else if (desc.includes('temple') || desc.includes('church')) buildingType = 'temple'
            else if (desc.includes('castle')) buildingType = 'castle'
            else if (desc.includes('inn') || desc.includes('tavern')) buildingType = 'inn'
            else buildingType = 'house' // default
          }
          result.analysisResult = await this.analysisService.analyzeBuilding(
            modelUrl,
            buildingType
          )
          break
        case 'tool':
        case 'consumable':
        case 'resource':
        case 'decoration':
        case 'misc':
          // These types might not need specific analysis
          // Could add basic analysis like size, orientation, etc.
          console.log(`ℹ️ No specific analysis needed for ${result.request.type}`)
          break
      }
      
      stage.status = 'completed'
      stage.output = result.analysisResult
      
      result.updatedAt = new Date()
      await this.cacheResult(result)
      this.emit('stage-complete', { result, stage: 'analysis' })
      
    } catch (error) {
      stage.status = 'failed'
      stage.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  private async finalizeAsset(result: GenerationResult): Promise<void> {
    const stage: GenerationStage = {
      stage: 'final',
      status: 'processing',
      timestamp: new Date()
    }
    result.stages.push(stage)
    this.emit('stage-start', { result, stage: 'final' })

    try {
      // Save final asset with metadata
      const modelUrl = result.remeshResult?.modelUrl || result.modelResult?.modelUrl
      if (!modelUrl) {
        throw new Error('No model available for finalization')
      }

      // Create output directory
      const outputDir = path.join(this.config.output.directory, result.id)
      await fs.mkdir(outputDir, { recursive: true })

      // Download and save model
      const modelPath = await this.meshyService.downloadModel(
        modelUrl,
        outputDir,
        `${result.request.name}.${this.config.output.format}`
      )

      // Save metadata
      const metadata = {
        ...result.request,
        analysisResult: result.analysisResult,
        generatedAt: new Date(),
        modelPath
      }
      
      await fs.writeFile(
        path.join(outputDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      )

      result.finalAsset = {
        modelUrl: modelPath,
        metadata
      }
      
      stage.status = 'completed'
      stage.output = result.finalAsset
      
      result.updatedAt = new Date()
      await this.cacheResult(result)
      this.emit('stage-complete', { result, stage: 'final' })
      
    } catch (error) {
      stage.status = 'failed'
      stage.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  private async cacheResult(result: GenerationResult): Promise<void> {
    await this.cacheService.set(`result:${result.id}`, result)
  }

  private getTargetPolycount(type: AssetType): number {
    switch (type) {
      case 'weapon':
      case 'tool':
        return 2000
      case 'armor':
      case 'consumable':
        return 3000
      case 'decoration':
        return 5000
      case 'character':
        return 8000
      case 'building':
        return 10000
      case 'resource':
        return 1500
      case 'misc':
        return 2500
      default:
        return 5000
    }
  }
} 