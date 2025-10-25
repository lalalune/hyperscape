/**
 * Generation Service
 * Handles AI-powered asset generation pipelines
 */

import EventEmitter from 'events'
import { AICreationService } from './AICreationService.mjs'
import { ImageHostingService } from './ImageHostingService.mjs'
import { getGenerationPrompts, getGPT4EnhancementPrompts } from '../utils/promptLoader.mjs'
import fs from 'fs/promises'
import path from 'path'
import fetch from 'node-fetch'

export class GenerationService extends EventEmitter {
  constructor() {
    super()
    
    this.activePipelines = new Map()
    
    // Check for required API keys
    if (!process.env.OPENAI_API_KEY || !process.env.MESHY_API_KEY) {
      console.warn('[GenerationService] Missing API keys - generation features will be limited')
    }
    
    // Initialize AI service with backend environment variables
    this.aiService = new AICreationService({
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'dall-e-3',  // Use DALL-E 3 by default (doesn't require org verification)
        imageServerBaseUrl: process.env.IMAGE_SERVER_URL || 'http://localhost:8081'
      },
      meshy: {
        apiKey: process.env.MESHY_API_KEY || '',
        baseUrl: 'https://api.meshy.ai'
      },
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 500
      },
      output: {
        directory: 'gdd-assets',
        format: 'glb'
      }
    })
    
    // Initialize image hosting service
    this.imageHostingService = new ImageHostingService()
  }

  /**
   * Start a new generation pipeline
   */
  async startPipeline(config) {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const pipeline = {
      id: pipelineId,
      config,
      status: 'initializing',
      progress: 0,
      stages: {
        textInput: { status: 'completed', progress: 100, result: { description: config.description } },
        promptOptimization: { status: 'pending', progress: 0 },
        imageGeneration: { status: 'pending', progress: 0 },
        image3D: { status: 'pending', progress: 0 },
        textureGeneration: { status: 'pending', progress: 0 },
        ...(config.generationType === 'avatar' && config.enableRigging ? { rigging: { status: 'pending', progress: 0 } } : {}),
        ...(config.enableSprites ? { spriteGeneration: { status: 'pending', progress: 0 } } : {})
      },
      results: {},
      createdAt: new Date().toISOString()
    }
    
    this.activePipelines.set(pipelineId, pipeline)
    
    // Start processing asynchronously
    this.processPipeline(pipelineId).catch(error => {
      console.error(`Pipeline ${pipelineId} failed:`, error)
      pipeline.status = 'failed'
      pipeline.error = error.message
    })
    
    return {
      pipelineId,
      status: pipeline.status,
      message: 'Pipeline started successfully'
    }
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId)
    
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`)
    }
    
    return {
      id: pipeline.id,
      status: pipeline.status,
      progress: pipeline.progress,
      stages: pipeline.stages,
      results: pipeline.results,
      error: pipeline.error,
      createdAt: pipeline.createdAt,
      completedAt: pipeline.completedAt
    }
  }

  /**
   * Process a pipeline through all stages
   */
  async processPipeline(pipelineId) {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return
    
    try {
      pipeline.status = 'processing'
      let enhancedPrompt = pipeline.config.description
      let imageUrl = null
      let meshyTaskId = null
      let baseModelPath = null
      
      // Stage 1: GPT-4 Prompt Enhancement (honor toggle; skip if explicitly disabled)
      if (pipeline.config.metadata?.useGPT4Enhancement !== false) {
        pipeline.stages.promptOptimization.status = 'processing'
        
        try {
          const optimizationResult = await this.enhancePromptWithGPT4(pipeline.config)
          enhancedPrompt = optimizationResult.optimizedPrompt
          
          pipeline.stages.promptOptimization.status = 'completed'
          pipeline.stages.promptOptimization.progress = 100
          pipeline.stages.promptOptimization.result = optimizationResult
          pipeline.results.promptOptimization = optimizationResult
        } catch (error) {
          console.warn('GPT-4 enhancement failed, using original prompt:', error)
          pipeline.stages.promptOptimization.status = 'completed'
          pipeline.stages.promptOptimization.progress = 100
          pipeline.stages.promptOptimization.result = {
            originalPrompt: pipeline.config.description,
            optimizedPrompt: pipeline.config.description,
            error: error.message
          }
        }
        
        pipeline.progress = 10
      } else {
        pipeline.stages.promptOptimization.status = 'skipped'
      }
      
      // Stage 2: Image Source (User-provided or AI-generated)
      const hasUserRef = !!(pipeline.config.referenceImage && (pipeline.config.referenceImage.url || pipeline.config.referenceImage.dataUrl))
      if (hasUserRef) {
        // Use user-provided reference image; skip auto image generation
        imageUrl = pipeline.config.referenceImage.dataUrl || pipeline.config.referenceImage.url
        pipeline.stages.imageGeneration.status = 'skipped'
        pipeline.stages.imageGeneration.progress = 0
        pipeline.stages.imageGeneration.result = { source: 'user-provided' }
        pipeline.results.imageGeneration = pipeline.stages.imageGeneration.result
        pipeline.progress = 20
      } else {
        pipeline.stages.imageGeneration.status = 'processing'
        
        try {
          // Load generation prompts
          const generationPrompts = await getGenerationPrompts()
          
          // For avatars, ensure T-pose is in the prompt
          // For armor, ensure it's standalone with hollow openings
          // Build effective style text from custom prompts when available
          // Also, if HQ cues are present, sanitize prompt from low-poly cues and add HQ details
          const effectiveStyle = (pipeline.config.customPrompts && pipeline.config.customPrompts.gameStyle)
            ? pipeline.config.customPrompts.gameStyle
            : (pipeline.config.style || 'game-ready')

          const wantsHQPrompt = /\b(4k|ultra|high\s*quality|realistic|cinematic|photoreal|pbr)\b/i.test(effectiveStyle)
          let imagePrompt = enhancedPrompt
          if (wantsHQPrompt) {
            imagePrompt = imagePrompt
              .replace(/\b(low-?poly|stylized|minimalist|blocky|simplified)\b/gi, '')
              .trim()
            imagePrompt = `${imagePrompt} highly detailed, realistic, sharp features, high-resolution textures`
          }
          if (pipeline.config.generationType === 'avatar' || pipeline.config.type === 'character') {
            const tposePrompt = generationPrompts?.posePrompts?.avatar?.tpose || 'standing in T-pose with arms stretched out horizontally'
            imagePrompt = `${enhancedPrompt} ${tposePrompt}`
          } else if (pipeline.config.type === 'armor') {
            const isChest = pipeline.config.subtype?.toLowerCase().includes('chest') || pipeline.config.subtype?.toLowerCase().includes('body')
            if (isChest) {
              const chestPrompt = generationPrompts?.posePrompts?.armor?.chest || 'floating chest armor SHAPED FOR T-POSE BODY - shoulder openings must point STRAIGHT OUT SIDEWAYS at 90 degrees like a scarecrow (NOT angled down), wide "T" shape when viewed from front, ends at shoulders with no arm extensions, torso-only armor piece, hollow shoulder openings pointing horizontally, no armor stand'
              imagePrompt = `${enhancedPrompt} ${chestPrompt}`
            } else {
              const genericArmorPrompt = generationPrompts?.posePrompts?.armor?.generic || 'floating armor piece shaped for T-pose body fitting, openings positioned at correct angles for T-pose (horizontal for shoulders), hollow openings, no armor stand or mannequin'
              imagePrompt = `${enhancedPrompt} ${genericArmorPrompt}`
            }
          }
            
          const imageResult = await this.aiService.imageService.generateImage(
            imagePrompt,
            pipeline.config.type,
            effectiveStyle
          )
          
          imageUrl = imageResult.imageUrl
          
          pipeline.stages.imageGeneration.status = 'completed'
          pipeline.stages.imageGeneration.progress = 100
          pipeline.stages.imageGeneration.result = imageResult
          pipeline.results.imageGeneration = imageResult
          pipeline.progress = 25
        } catch (error) {
          console.error('Image generation failed:', error)
          pipeline.stages.imageGeneration.status = 'failed'
          pipeline.stages.imageGeneration.error = error.message
          throw error
        }
      }
      
      // Stage 3: Image to 3D with Meshy AI
      pipeline.stages.image3D.status = 'processing'
      
      try {
        // Save image to disk first if it's a data URL
        let imageUrlForMeshy = imageUrl
        if (imageUrl.startsWith('data:')) {
          const imageData = imageUrl.split(',')[1]
          const imageBuffer = Buffer.from(imageData, 'base64')
          const imagePath = path.join('temp-images', `${pipeline.config.assetId}-concept.png`)
          await fs.mkdir('temp-images', { recursive: true })
          await fs.writeFile(imagePath, imageBuffer)
          
          // If we have an image server, use it
          if (process.env.IMAGE_SERVER_URL) {
            imageUrlForMeshy = `${process.env.IMAGE_SERVER_URL}/${path.basename(imagePath)}`
          } else {
            // Need to upload to a public URL for Meshy
            console.warn('No IMAGE_SERVER_URL configured, Meshy needs a public URL')
          }
        }
        
        // Ensure we have a publicly accessible URL for Meshy
        console.log('📸 Initial image URL:', imageUrlForMeshy)
        
        // Meshy can't access localhost, 127.0.0.1, or data URIs - rehost if needed
        if (
          imageUrlForMeshy.startsWith('data:') ||
          imageUrlForMeshy.includes('localhost') ||
          imageUrlForMeshy.includes('127.0.0.1')
        ) {
          console.warn('⚠️ Non-public image reference detected - uploading to public hosting...')
          
          // Use the image hosting service to get a public URL
          try {
            imageUrlForMeshy = await this.imageHostingService.uploadImage(imageUrl)
            console.log('✅ Image uploaded to public URL:', imageUrlForMeshy)
          } catch (uploadError) {
            console.error('❌ Failed to upload image:', uploadError.message)
            console.log(ImageHostingService.getSetupInstructions())
            throw new Error('Cannot make image publicly accessible. See instructions above.')
          }
        }
        
        // Determine quality settings based on explicit config, style cues, and avatar type
        const styleText = (pipeline.config.customPrompts && pipeline.config.customPrompts.gameStyle) || ''
        const wantsHighQuality = /\b(4k|ultra|high\s*quality|realistic|cinematic|marvel|skyrim)\b/i.test(styleText)
        const isAvatar = pipeline.config.generationType === 'avatar' || pipeline.config.type === 'character'

        const quality = pipeline.config.quality || (wantsHighQuality || isAvatar ? 'ultra' : 'standard')
        const targetPolycount = quality === 'ultra' ? 20000 : quality === 'high' ? 12000 : 6000
        const textureResolution = quality === 'ultra' ? 4096 : quality === 'high' ? 2048 : 1024
        const enablePbr = quality !== 'standard'

        // Allow per-quality model selection via env, with a sensible default
        const qualityUpper = quality.toUpperCase()
        const aiModelEnv = process.env[`MESHY_MODEL_${qualityUpper}`] || process.env.MESHY_MODEL_DEFAULT
        const aiModel = aiModelEnv || 'meshy-5'

        meshyTaskId = await this.aiService.meshyService.startImageTo3D(imageUrlForMeshy, {
          enable_pbr: enablePbr,
          ai_model: aiModel,
          topology: 'quad',
          targetPolycount: targetPolycount,
          texture_resolution: textureResolution
        })
        
        // Poll for completion
        let meshyResult = null
        let attempts = 0
        const pollIntervalMs = parseInt(process.env.MESHY_POLL_INTERVAL_MS || '5000', 10)
        const timeoutMs = parseInt(
          (process.env[`MESHY_TIMEOUT_${qualityUpper}_MS`] || process.env.MESHY_TIMEOUT_MS || '300000'),
          10
        )
        const maxAttempts = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs))
        
        console.log(`⏳ Meshy polling configured: quality=${quality}, model=${aiModel}, interval=${pollIntervalMs}ms, timeout=${timeoutMs}ms, maxAttempts=${maxAttempts}`)
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
          
          const status = await this.aiService.meshyService.getTaskStatus(meshyTaskId)
          pipeline.stages.image3D.progress = status.progress || (attempts / maxAttempts * 100)
          
          if (status.status === 'SUCCEEDED') {
            meshyResult = status
            break
          } else if (status.status === 'FAILED') {
            throw new Error(status.error || 'Meshy conversion failed')
          }
          
          attempts++
        }
        
        if (!meshyResult) {
          throw new Error('Meshy conversion timed out')
        }
        
        // Download and save the model
        const modelBuffer = await this.downloadFile(meshyResult.model_urls.glb)
        const outputDir = path.join('gdd-assets', pipeline.config.assetId)
        await fs.mkdir(outputDir, { recursive: true })
        
        // Save raw model first
        const rawModelPath = path.join(outputDir, `${pipeline.config.assetId}_raw.glb`)
        await fs.writeFile(rawModelPath, modelBuffer)
        
        // Normalize the model based on type
        let normalizedModelPath = path.join(outputDir, `${pipeline.config.assetId}.glb`)
        
        if (pipeline.config.type === 'character') {
          // Normalize character height
          console.log('🔧 Normalizing character model...')
          try {
            const { AssetNormalizationService } = await import('../../dist/services/processing/AssetNormalizationService.js')
            const normalizer = new AssetNormalizationService()
            
            const targetHeight = pipeline.config.metadata?.characterHeight || 
                               pipeline.config.riggingOptions?.heightMeters || 
                               1.83
            
            const normalized = await normalizer.normalizeCharacter(rawModelPath, targetHeight)
            await fs.writeFile(normalizedModelPath, Buffer.from(normalized.glb))
            
            console.log(`✅ Character normalized to ${targetHeight}m height`)
            
            // Update with normalized dimensions
            pipeline.stages.image3D.normalized = true
            pipeline.stages.image3D.dimensions = normalized.metadata.dimensions
          } catch (error) {
            console.warn('⚠️ Normalization failed, using raw model:', error.message)
            await fs.copyFile(rawModelPath, normalizedModelPath)
          }
        } else if (pipeline.config.type === 'weapon') {
          // Normalize weapon with grip at origin
          console.log('🔧 Normalizing weapon model...')
          try {
            const { WeaponHandleDetector } = await import('../../dist/services/processing/WeaponHandleDetector.js')
            const detector = new WeaponHandleDetector()
            
            const result = await detector.exportNormalizedWeapon(rawModelPath, normalizedModelPath)
            
            console.log(`✅ Weapon normalized with grip at origin`)
            
            // Update with normalized dimensions
            pipeline.stages.image3D.normalized = true
            pipeline.stages.image3D.dimensions = result.dimensions
          } catch (error) {
            console.warn('⚠️ Weapon normalization failed, using raw model:', error.message)
            await fs.copyFile(rawModelPath, normalizedModelPath)
          }
        } else {
          // For other types, just copy for now
          await fs.copyFile(rawModelPath, normalizedModelPath)
        }
        
        baseModelPath = normalizedModelPath
        
        // Save concept art
        if (imageUrl.startsWith('data:')) {
          const imageData = imageUrl.split(',')[1]
          const imageBuffer = Buffer.from(imageData, 'base64')
          await fs.writeFile(path.join(outputDir, 'concept-art.png'), imageBuffer)
        }
        
        // Save metadata - EXACT structure from arrows-base reference
        const metadata = {
          name: pipeline.config.assetId,
          gameId: pipeline.config.assetId,
          type: pipeline.config.type,
          subtype: pipeline.config.subtype,
          description: pipeline.config.description,
          detailedPrompt: enhancedPrompt,
          generatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          isBaseModel: true,
          materialVariants: pipeline.config.materialPresets ? 
            pipeline.config.materialPresets.map(preset => preset.id) : [],
          isPlaceholder: false,
          hasModel: true,
          hasConceptArt: true,
          modelPath: baseModelPath,
          conceptArtUrl: './concept-art.png',
          gddCompliant: true,
          workflow: 'GPT-4 → GPT-Image-1 → Meshy Image-to-3D (Base Model)',
          meshyTaskId: meshyTaskId,
          meshyStatus: 'completed',
          variants: [],  // Will be populated as variants are generated
          variantCount: 0,
          lastVariantGenerated: null,
          updatedAt: new Date().toISOString(),
          // Normalization info
          normalized: pipeline.stages.image3D.normalized || false,
          normalizationDate: pipeline.stages.image3D.normalized ? new Date().toISOString() : undefined,
          dimensions: pipeline.stages.image3D.dimensions || undefined
        }
        
        await fs.writeFile(
          path.join(outputDir, 'metadata.json'),
          JSON.stringify(metadata, null, 2)
        )
        
        pipeline.stages.image3D.status = 'completed'
        pipeline.stages.image3D.progress = 100
        pipeline.stages.image3D.result = {
          taskId: meshyTaskId,
          modelUrl: meshyResult.model_urls.glb,
          polycount: meshyResult.polycount,
          localPath: baseModelPath
        }
        pipeline.results.image3D = pipeline.stages.image3D.result
        pipeline.progress = 50
        
      } catch (error) {
        console.error('Image to 3D conversion failed:', error)
        pipeline.stages.image3D.status = 'failed'
        pipeline.stages.image3D.error = error.message
        throw error
      }
      
      // Stage 4: Material Variant Generation (Retexturing)
      if (pipeline.config.enableRetexturing && pipeline.config.materialPresets?.length > 0) {
        pipeline.stages.textureGeneration.status = 'processing'
        
        const variants = []
        const totalVariants = pipeline.config.materialPresets.length
        
        for (let i = 0; i < totalVariants; i++) {
          const preset = pipeline.config.materialPresets[i]
          
          try {
            console.log(`🎨 Generating variant ${i + 1}/${totalVariants}: ${preset.displayName}`)
            
            // Update progress
            pipeline.stages.textureGeneration.progress = Math.round((i / totalVariants) * 100)
            
            // Use Meshy retexture API
            const retextureTaskId = await this.aiService.meshyService.startRetextureTask(
              { inputTaskId: meshyTaskId },
              { textStylePrompt: preset.stylePrompt },
              {
                artStyle: 'realistic',
                aiModel: 'meshy-5',
                enableOriginalUV: true
              }
            )
            
            // Wait for completion
            let retextureResult = null
            let retextureAttempts = 0
            const maxRetextureAttempts = 60
            
            while (retextureAttempts < maxRetextureAttempts) {
              await new Promise(resolve => setTimeout(resolve, 5000))
              
              const status = await this.aiService.meshyService.getRetextureTaskStatus(retextureTaskId)
              
              if (status.status === 'SUCCEEDED') {
                retextureResult = status
                break
              } else if (status.status === 'FAILED') {
                throw new Error(status.error || 'Retexture failed')
              }
              
              retextureAttempts++
            }
            
            if (!retextureResult) {
              throw new Error('Retexture timed out')
            }
            
            // Save variant
            const variantId = `${pipeline.config.assetId}-${preset.id}`
            const variantDir = path.join('gdd-assets', variantId)
            await fs.mkdir(variantDir, { recursive: true })
            
            const variantBuffer = await this.downloadFile(retextureResult.model_urls.glb)
            await fs.writeFile(path.join(variantDir, `${variantId}.glb`), variantBuffer)
            
            // Copy concept art
            const conceptArtPath = path.join('gdd-assets', pipeline.config.assetId, 'concept-art.png')
            if (await fs.access(conceptArtPath).then(() => true).catch(() => false)) {
              await fs.copyFile(conceptArtPath, path.join(variantDir, 'concept-art.png'))
            }
            
            // Save variant metadata - EXACT structure from arrows-bronze reference
            const variantMetadata = {
              id: variantId,
              gameId: variantId,
              name: variantId,
              type: pipeline.config.type,
              subtype: pipeline.config.subtype,
              isBaseModel: false,
              isVariant: true,
              parentBaseModel: pipeline.config.assetId,
              materialPreset: {
                id: preset.id,
                displayName: preset.displayName,
                category: preset.category,
                tier: preset.tier,
                color: preset.color,
                stylePrompt: preset.stylePrompt
              },
              workflow: 'Meshy AI Retexture',
              baseModelTaskId: meshyTaskId,
              retextureTaskId: retextureTaskId,
              retextureStatus: 'completed',
              modelPath: `${variantId}.glb`,
              conceptArtPath: null,
              hasModel: true,
              hasConceptArt: true,
              generatedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              description: pipeline.config.description,
              isPlaceholder: false,
              gddCompliant: true
            }
            
            await fs.writeFile(
              path.join(variantDir, 'metadata.json'),
              JSON.stringify(variantMetadata, null, 2)
            )
            
            variants.push({
              id: variantId,
              name: preset.displayName,
              modelUrl: retextureResult.model_urls.glb,
              success: true
            })
            
          } catch (error) {
            console.error(`Failed to generate variant ${preset.displayName}:`, error)
            variants.push({
              id: `${pipeline.config.assetId}-${preset.id}`,
              name: preset.displayName,
              success: false,
              error: error.message
            })
          }
        }
        
        pipeline.stages.textureGeneration.status = 'completed'
        pipeline.stages.textureGeneration.progress = 100
        pipeline.stages.textureGeneration.result = { variants, totalVariants }
        pipeline.results.textureGeneration = pipeline.stages.textureGeneration.result
        pipeline.progress = 75
        
        // Update base model metadata with variant information
        const successfulVariants = variants.filter(v => v.success)
        if (successfulVariants.length > 0) {
          const baseMetadataPath = path.join('gdd-assets', pipeline.config.assetId, 'metadata.json')
          const baseMetadata = JSON.parse(await fs.readFile(baseMetadataPath, 'utf-8'))
          
          baseMetadata.variants = successfulVariants.map(v => v.id)
          baseMetadata.variantCount = successfulVariants.length
          baseMetadata.lastVariantGenerated = successfulVariants[successfulVariants.length - 1].id
          baseMetadata.updatedAt = new Date().toISOString()
          
          await fs.writeFile(baseMetadataPath, JSON.stringify(baseMetadata, null, 2))
        }
        
      } else {
        pipeline.stages.textureGeneration.status = 'skipped'
      }
      
      // Stage 5: Auto-Rigging (for avatars only)
      if (pipeline.config.generationType === 'avatar' && pipeline.config.enableRigging && meshyTaskId) {
        pipeline.stages.rigging = { status: 'processing', progress: 0 }
        
        try {
          console.log('🦴 Starting auto-rigging for avatar...')
          
          // Start rigging task
          const riggingTaskId = await this.aiService.meshyService.startRiggingTask(
            { inputTaskId: meshyTaskId },
            { heightMeters: pipeline.config.riggingOptions?.heightMeters || 1.7 }
          )
          
          console.log(`Rigging task started: ${riggingTaskId}`)
          
          // Poll for rigging completion
          let riggingResult = null
          let riggingAttempts = 0
          const maxRiggingAttempts = 60 // 5 minutes
          
          while (riggingAttempts < maxRiggingAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            const status = await this.aiService.meshyService.getRiggingTaskStatus(riggingTaskId)
            pipeline.stages.rigging.progress = status.progress || (riggingAttempts / maxRiggingAttempts * 100)
            
            if (status.status === 'SUCCEEDED') {
              riggingResult = status
              break
            } else if (status.status === 'FAILED') {
              throw new Error(status.task_error?.message || 'Rigging failed')
            }
            
            riggingAttempts++
          }
          
          if (!riggingResult) {
            throw new Error('Rigging timed out')
          }
          
          // Download rigged model and animations
          const outputDir = path.join('gdd-assets', pipeline.config.assetId)
          const riggedAssets = {}
          
          // IMPORTANT: For rigged avatars, we DON'T replace the main model
          // We keep the original T-pose model and save animations separately
          // This prevents the T-pose + animation layering issue
          console.log('🦴 Processing rigged character assets...')
          
          // Download animations if available
          if (riggingResult.result && riggingResult.result.basic_animations) {
            const animations = riggingResult.result.basic_animations
            
            // CRITICAL: First, get the rigged model from the walking animation
            // This contains the model with bones that we need for animations
            if (animations.walking_glb_url) {
              console.log('🦴 Downloading rigged model and animations...')
              const walkingBuffer = await this.downloadFile(animations.walking_glb_url)
              
              // Save the walking animation
              const walkingPath = path.join(outputDir, 'animations', 'walking.glb')
              await fs.mkdir(path.dirname(walkingPath), { recursive: true })
              await fs.writeFile(walkingPath, walkingBuffer)
              riggedAssets.walking = 'animations/walking.glb'
              
              // Extract T-pose from the walking animation
              console.log('🎯 Extracting T-pose from walking animation...')
              try {
                const tposePath = path.join(outputDir, 't-pose.glb')
                await this.extractTPoseFromAnimation(walkingPath, tposePath)
                riggedAssets.tpose = 't-pose.glb'
                console.log('✅ T-pose extracted successfully')
            } catch (tposeError) {
              console.error('⚠️ Failed to extract T-pose:', tposeError.message)
              // Continue anyway - not critical for the pipeline
            }
            
            // IMPORTANT: Save rigged T-pose model for animation player
            // The walking GLB contains a rigged model in T-pose on frame 0, followed by walking animation
            // The animation player will:
            // - Use the unrigged model for asset viewer (clean T-pose, no bones)
            // - Use this rigged model for animation player with:
            //   - Resting: Show frame 0 (T-pose) with no animation
            //   - Walking: Play the walking animation
            //   - Running: Play the running animation
            const riggedModelPath = path.join(outputDir, `${pipeline.config.assetId}_rigged.glb`)
            await fs.writeFile(riggedModelPath, walkingBuffer)
            console.log('✅ Saved rigged model for animation player')
          }
            
            // Download running animation GLB
            if (animations.running_glb_url) {
              const runningBuffer = await this.downloadFile(animations.running_glb_url)
              const runningPath = path.join(outputDir, 'animations', 'running.glb')
              await fs.writeFile(runningPath, runningBuffer)
              riggedAssets.running = 'animations/running.glb'
            }
          }
          
          // Update metadata with rigging information
          const metadataPath = path.join(outputDir, 'metadata.json')
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
          
          metadata.isRigged = true
          metadata.riggingTaskId = riggingTaskId
          metadata.riggingStatus = 'completed'
          metadata.rigType = 'humanoid-standard'
          metadata.characterHeight = pipeline.config.riggingOptions?.heightMeters || 1.7
          metadata.animations = {
            basic: riggedAssets
          }
          metadata.riggedModelPath = `${pipeline.config.assetId}_rigged.glb`
          metadata.tposeModelPath = riggedAssets.tpose || null
          metadata.supportsAnimation = true
          metadata.animationCompatibility = ['mixamo', 'unity', 'unreal']
          
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
          
          pipeline.stages.rigging.status = 'completed'
          pipeline.stages.rigging.progress = 100
          pipeline.stages.rigging.result = {
            taskId: riggingTaskId,
            animations: riggedAssets
          }
          pipeline.results.rigging = pipeline.stages.rigging.result
          pipeline.progress = 85
          
        } catch (error) {
          console.error('❌ Rigging failed:', error.message)
          console.error('Full error:', error)
          
          // Update metadata to indicate rigging failed
          try {
            const outputDir = path.join('gdd-assets', pipeline.config.assetId)
            const metadataPath = path.join(outputDir, 'metadata.json')
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
            
            metadata.isRigged = false
            metadata.riggingStatus = 'failed'
            metadata.riggingError = error.message
            metadata.riggingAttempted = true
            
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
          } catch (metadataError) {
            console.error('Failed to update metadata after rigging failure:', metadataError)
          }
          
          pipeline.stages.rigging.status = 'failed'
          pipeline.stages.rigging.error = error.message
          pipeline.stages.rigging.progress = 0
          
          // Continue without rigging - don't fail the entire pipeline
          console.log('⚠️  Continuing without rigging - avatar will not have animations')
        }
      }
      
      // Complete
      pipeline.status = 'completed'
      pipeline.completedAt = new Date().toISOString()
      pipeline.progress = 100
      
      // Compile final asset info
      pipeline.finalAsset = {
        id: pipeline.config.assetId,
        name: pipeline.config.name,
        modelUrl: `/assets/${pipeline.config.assetId}/${pipeline.config.assetId}.glb`,
        conceptArtUrl: `/assets/${pipeline.config.assetId}/concept-art.png`,
        variants: pipeline.results.textureGeneration?.variants || []
      }
      
    } catch (error) {
      pipeline.status = 'failed'
      pipeline.error = error.message
      throw error
    }
  }

  /**
   * Enhance prompt with GPT-4
   */
  async enhancePromptWithGPT4(config) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required for GPT-4 enhancement')
    }
    
    // Load GPT-4 enhancement prompts
    const gpt4Prompts = await getGPT4EnhancementPrompts()
    
    const isAvatar = config.generationType === 'avatar' || config.type === 'character'
    const isArmor = config.type === 'armor'
    const isChestArmor = isArmor && (config.subtype?.toLowerCase().includes('chest') || config.subtype?.toLowerCase().includes('body'))
    
    // Build system prompt from loaded prompts
    let systemPrompt = gpt4Prompts?.systemPrompt?.base || `You are an expert at optimizing prompts for 3D asset generation. 
Your task is to enhance the user's description to create better results with image generation and 3D conversion.`
    
    if (isAvatar) {
      systemPrompt += '\n' + (gpt4Prompts?.typeSpecific?.avatar?.critical || `CRITICAL for characters: The character MUST be in a T-pose (arms stretched out horizontally, legs slightly apart) for proper rigging. The character must have EMPTY HANDS - no weapons, tools, or held items. Always add "standing in T-pose with empty hands" to the description.`)
    }
    
    if (isArmor) {
      systemPrompt += '\n' + (gpt4Prompts?.typeSpecific?.armor?.base || `CRITICAL for armor pieces: The armor must be shown ALONE without any armor stand, mannequin, or body inside.`)
      if (isChestArmor) {
        systemPrompt += ' ' + (gpt4Prompts?.typeSpecific?.armor?.chest || 'EXTRA IMPORTANT for chest/body armor: This MUST be shaped for a SCARECROW POSE (T-POSE) - imagine a scarecrow with arms sticking STRAIGHT OUT SIDEWAYS...')
      }
      systemPrompt += ' ' + (gpt4Prompts?.typeSpecific?.armor?.positioning || 'The armor MUST be positioned and SHAPED for a SCARECROW/T-POSE body...')
    }
    
    // Add focus points
    const focusPoints = gpt4Prompts?.systemPrompt?.focusPoints || [
      'Clear, specific visual details',
      'Material and texture descriptions',
      'Geometric shape and form',
      `Style consistency (especially for ${config.style || 'low-poly RuneScape'} style)`
    ]
    
    systemPrompt += '\nFocus on:\n' + focusPoints.map(point => '- ' + point.replace('${config.style || \'low-poly RuneScape\'}', config.style || 'low-poly RuneScape')).join('\n')
    
    if (isAvatar) {
      systemPrompt += '\n' + (gpt4Prompts?.typeSpecific?.avatar?.focus || '- T-pose stance with empty hands for rigging compatibility')
    }
    
    if (isArmor) {
      const armorFocus = gpt4Prompts?.typeSpecific?.armor?.focus || [
        '- Armor SHAPED for T-pose body (shoulder openings pointing straight sideways, not down)',
        '- Chest armor should form a "T" or cross shape when viewed from above',
        '- Shoulder openings at 180° angle to each other (straight line across)'
      ]
      systemPrompt += '\n' + armorFocus.join('\n')
    }
    
    systemPrompt += '\n' + (gpt4Prompts?.systemPrompt?.closingInstruction || 'Keep the enhanced prompt concise but detailed.')
    
    // Include custom game style text (if present) ahead of the description for better style adherence
    const stylePrefix = config.customPrompts?.gameStyle ? `${config.customPrompts.gameStyle} — ` : ''
    const baseDescription = `${stylePrefix}${config.description}`
    const userPrompt = isArmor 
      ? (gpt4Prompts?.typeSpecific?.armor?.enhancementPrefix || `Enhance this armor piece description for 3D generation. CRITICAL: The armor must be SHAPED FOR A T-POSE BODY - shoulder openings must point STRAIGHT SIDEWAYS at 90 degrees (like a scarecrow), NOT angled downward! Should look like a wide "T" shape. Ends at shoulders (no arm extensions), hollow openings, no armor stand: `) + `"${baseDescription}"`
      : `Enhance this ${config.type} asset description for 3D generation: "${baseDescription}"`
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      })
      
      if (!response.ok) {
        throw new Error(`GPT-4 API error: ${response.status}`)
      }
      
      const data = await response.json()
      const optimizedPrompt = data.choices[0].message.content.trim()
      
      return {
        originalPrompt: config.description,
        optimizedPrompt,
        model: 'gpt-4',
        keywords: this.extractKeywords(optimizedPrompt)
      }
      
    } catch (error) {
      console.error('GPT-4 enhancement failed:', error)
      // Load generation prompts for fallback
      const generationPrompts = await getGenerationPrompts()
      const fallbackTemplate = generationPrompts?.imageGeneration?.fallbackEnhancement || 
        '${config.description}. ${config.style || "game-ready"} style, clean geometry, game-ready 3D asset.'
      
      // Replace template variables
      const fallbackPrompt = fallbackTemplate
        .replace('${config.description}', config.description)
        .replace('${config.style || "game-ready"}', config.style || 'game-ready')
      
      return {
        originalPrompt: config.description,
        optimizedPrompt: fallbackPrompt,
        error: error.message
      }
    }
  }

  /**
   * Extract keywords from prompt
   */
  extractKeywords(prompt) {
    const keywords = []
    const patterns = [
      /\b(bronze|steel|iron|mithril|adamant|rune)\b/gi,
      /\b(sword|shield|bow|staff|armor|helmet)\b/gi,
      /\b(leather|metal|wood|crystal|bone)\b/gi,
      /\b(low-poly|high-poly|realistic|stylized)\b/gi
    ]
    
    patterns.forEach(pattern => {
      const matches = prompt.match(pattern)
      if (matches) {
        keywords.push(...matches.map(m => m.toLowerCase()))
      }
    })
    
    return [...new Set(keywords)]
  }

  /**
   * Download file from URL
   */
  async downloadFile(url) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`)
    }
    return Buffer.from(await response.arrayBuffer())
  }
  
  /**
   * Extract T-pose from an animation GLB file by removing animations
   */
  async extractTPoseFromAnimation(inputPath, outputPath) {
    const inputBuffer = await fs.readFile(inputPath)
    
    // Verify GLB magic number
    const magic = inputBuffer.readUInt32LE(0)
    if (magic !== 0x46546C67) { // 'glTF' in little-endian
      throw new Error('Not a valid GLB file')
    }
    
    const version = inputBuffer.readUInt32LE(4)
    const totalLength = inputBuffer.readUInt32LE(8)
    
    // Parse chunks
    let offset = 12 // Skip header
    const chunks = []
    
    while (offset < inputBuffer.length) {
      const chunkLength = inputBuffer.readUInt32LE(offset)
      const chunkType = inputBuffer.readUInt32BE(offset + 4)
      
      const typeStr = String.fromCharCode(
        (chunkType >> 24) & 0xff,
        (chunkType >> 16) & 0xff,
        (chunkType >> 8) & 0xff,
        chunkType & 0xff
      )
      
      const chunkData = inputBuffer.slice(offset + 8, offset + 8 + chunkLength)
      chunks.push({ type: typeStr, data: chunkData })
      
      // Chunks are padded to 4-byte boundaries
      const paddedLength = Math.ceil(chunkLength / 4) * 4
      offset += 8 + paddedLength
    }
    
    // Find and modify the JSON chunk to remove animations
    const jsonChunk = chunks.find(c => c.type === 'JSON')
    if (!jsonChunk) {
      throw new Error('No JSON chunk found in GLB')
    }
    
    // Parse the glTF JSON
    const gltfJson = JSON.parse(jsonChunk.data.toString())
    
    // Remove animations
    delete gltfJson.animations
    
    // Convert back to buffer
    const newJsonStr = JSON.stringify(gltfJson)
    const newJsonBuffer = Buffer.from(newJsonStr)
    
    // Pad to 4-byte boundary with spaces (0x20) as per glTF spec
    const paddedLength = Math.ceil(newJsonBuffer.length / 4) * 4
    const paddedJsonBuffer = Buffer.alloc(paddedLength, 0x20) // Fill with spaces
    newJsonBuffer.copy(paddedJsonBuffer)
    
    // Update JSON chunk
    jsonChunk.data = paddedJsonBuffer
    
    // Reconstruct GLB
    let newTotalLength = 12 // header
    chunks.forEach(chunk => {
      newTotalLength += 8 + chunk.data.length // chunk header + data
    })
    
    // Create output buffer
    const outputBuffer = Buffer.alloc(newTotalLength)
    
    // Write header
    outputBuffer.writeUInt32LE(0x46546C67, 0) // magic
    outputBuffer.writeUInt32LE(version, 4)
    outputBuffer.writeUInt32LE(newTotalLength, 8)
    
    // Write chunks
    offset = 12
    chunks.forEach(chunk => {
      // Chunk header
      outputBuffer.writeUInt32LE(chunk.data.length, offset)
      
      // Convert type string back to uint32
      let typeInt = 0
      for (let i = 0; i < 4; i++) {
        typeInt |= (chunk.type.charCodeAt(i) << (24 - i * 8))
      }
      outputBuffer.writeUInt32BE(typeInt, offset + 4)
      
      // Chunk data
      chunk.data.copy(outputBuffer, offset + 8)
      
      offset += 8 + chunk.data.length
    })
    
    // Write output file
    await fs.writeFile(outputPath, outputBuffer)
  }

  /**
   * Clean up old pipelines
   */
  cleanupOldPipelines() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    
    for (const [id, pipeline] of this.activePipelines.entries()) {
      const createdAt = new Date(pipeline.createdAt).getTime()
      if (createdAt < oneHourAgo && (pipeline.status === 'completed' || pipeline.status === 'failed')) {
        this.activePipelines.delete(id)
      }
    }
  }
}

// Cleanup old pipelines periodically
setInterval(() => {
  if (global.generationService) {
    global.generationService.cleanupOldPipelines()
  }
}, 30 * 60 * 1000) // Every 30 minutes 