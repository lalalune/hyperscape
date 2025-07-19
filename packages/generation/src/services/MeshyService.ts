/**
 * Meshy AI Service
 * Handles 3D model generation, remeshing, and texturing
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { ModelGenerationResult, RemeshResult } from '../types'
import { retry, sleep } from '../utils/helpers'

export interface MeshyConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

export class MeshyService {
  private config: MeshyConfig
  private baseUrl: string

  constructor(config: MeshyConfig) {
    this.config = config
    this.baseUrl = config.baseUrl || 'https://api.meshy.ai'
    
    if (!config.apiKey) {
      throw new Error('Meshy API key is required')
    }
  }

  /**
   * Generate 3D model from image
   */
  async imageToModel(
    imageUrl: string,
    options: {
      targetPolycount?: number
      style?: string
    } = {}
  ): Promise<ModelGenerationResult> {
    console.log(`🎯 Creating 3D model from image...`)
    
    try {
      // Start image-to-3D task
      const taskId = await this.startImageTo3D(imageUrl, options)
      
      // Wait for completion
      const result = await this.waitForCompletion(taskId)
      
      return {
        modelUrl: result.model_urls?.glb || '',
        format: 'glb',
        polycount: options.targetPolycount || 10000,
        textureUrls: this.extractTextureUrls(result),
        metadata: {
          meshyTaskId: taskId,
          processingTime: result.finished_at ? result.finished_at - result.created_at : 0
        }
      }
    } catch (error) {
      console.error('❌ Model generation failed:', error)
      throw new Error(`Failed to generate model: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Generate 3D model from text prompt
   */
  async textToModel(
    prompt: string,
    options: {
      targetPolycount?: number
      style?: string
      enablePBR?: boolean
    } = {}
  ): Promise<ModelGenerationResult> {
    console.log(`🎯 Creating 3D model from text: ${prompt}`)
    
    try {
      // Start text-to-3D task
      const taskId = await this.startTextTo3D(prompt, options)
      
      // Wait for completion
      const result = await this.waitForCompletion(taskId)
      
      return {
        modelUrl: result.model_urls?.glb || '',
        format: 'glb',
        polycount: options.targetPolycount || 10000,
        textureUrls: this.extractTextureUrls(result),
        metadata: {
          meshyTaskId: taskId,
          processingTime: result.finished_at ? result.finished_at - result.created_at : 0
        }
      }
    } catch (error) {
      console.error('❌ Text-to-3D generation failed:', error)
      throw new Error(`Failed to generate model: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Retexture an existing model
   */
  async retextureModel(
    modelUrl: string,
    options: {
      texturePrompt: string
      textureResolution?: number
      enablePBR?: boolean
      stylePrompt?: string
    }
  ): Promise<ModelGenerationResult> {
    console.log(`🎨 Retexturing model: ${options.texturePrompt}`)
    
    try {
      // Start retexturing task
      const taskId = await this.startRetexturing(modelUrl, options)
      
      // Wait for completion
      const result = await this.waitForCompletion(taskId)
      
      return {
        modelUrl: result.model_urls?.glb || '',
        format: 'glb',
        polycount: 0, // Retexturing doesn't change polycount
        textureUrls: this.extractTextureUrls(result),
        metadata: {
          meshyTaskId: taskId,
          processingTime: result.finished_at ? result.finished_at - result.created_at : 0
        }
      }
    } catch (error) {
      console.error('❌ Retexturing failed:', error)
      throw new Error(`Failed to retexture model: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create image-to-3D with enhanced options
   */
  async createImageTo3D(
    imageUrl: string,
    options: {
      ai_model?: string
      enable_pbr?: boolean
      negative_prompt?: string
      topology?: string
      target_polycount?: number
      texture_resolution?: number
      style_prompt?: string
    } = {}
  ): Promise<any> {
    console.log(`🎯 Creating enhanced 3D model from image...`)
    
    try {
      const taskId = await this.startImageTo3D(imageUrl, options)
      const result = await this.waitForCompletion(taskId)
      return result
    } catch (error) {
      console.error('❌ Enhanced image-to-3D failed:', error)
      throw error
    }
  }

  /**
   * Create text-to-3D with enhanced options
   */
  async createTextTo3D(
    prompt: string,
    options: {
      ai_model?: string
      enable_pbr?: boolean
      negative_prompt?: string
      topology?: string
      target_polycount?: number
      texture_resolution?: number
      style_prompt?: string
    } = {}
  ): Promise<any> {
    console.log(`🎯 Creating enhanced 3D model from text: ${prompt}`)
    
    try {
      const taskId = await this.startTextTo3D(prompt, options)
      const result = await this.waitForCompletion(taskId)
      return result
    } catch (error) {
      console.error('❌ Enhanced text-to-3D failed:', error)
      throw error
    }
  }

  /**
   * Remesh an existing model
   */
  async remeshModel(
    modelUrl: string,
    targetPolycount: number
  ): Promise<RemeshResult> {
    console.log(`🔧 Remeshing model to ${targetPolycount} polygons...`)
    
    try {
      // For now, return the same model (remeshing would be implemented with Meshy's remesh API)
      // This is a placeholder for the actual remesh implementation
      return {
        modelUrl,
        originalPolycount: 10000,
        remeshedPolycount: targetPolycount,
        targetPolycount
      }
    } catch (error) {
      console.error('❌ Remeshing failed:', error)
      throw new Error(`Failed to remesh model: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Download model to local directory
   */
  async downloadModel(
    modelUrl: string,
    outputDir: string,
    filename: string
  ): Promise<string> {
    const outputPath = path.join(outputDir, filename)
    
    try {
      const response = await fetch(modelUrl)
      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.statusText}`)
      }
      
      const buffer = await response.arrayBuffer()
      await fs.writeFile(outputPath, Buffer.from(buffer))
      
      return outputPath
    } catch (error) {
      throw new Error(`Failed to download model: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Start image-to-3D task
   */
  private async startImageTo3D(
    imageUrl: string,
    options: any
  ): Promise<string> {
    const response = await retry(
      async () => {
        const res = await fetch(`${this.baseUrl}/openapi/v1/image-to-3d`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image_url: imageUrl,
            enable_pbr: options.enable_pbr ?? true,
            ai_model: options.ai_model || 'meshy-4',
            surface_mode: 'organic',
            topology: options.topology || 'quad',
            target_polycount: options.target_polycount || options.targetPolycount || 2000,
            texture_resolution: options.texture_resolution || 512,
            should_remesh: true,
            negative_prompt: options.negative_prompt || '',
            style_prompt: options.style_prompt || ''
          })
        })

        if (!res.ok) {
          const error = await res.text()
          throw new Error(`Meshy API error: ${res.status} - ${error}`)
        }

        return res.json()
      },
      3
    )

    console.log('🔍 Meshy API Response:', JSON.stringify(response, null, 2))
    return (response as any).result || response
  }

  /**
   * Start text-to-3D task
   */
  private async startTextTo3D(
    prompt: string,
    options: any
  ): Promise<string> {
    const response = await retry(
      async () => {
        const res = await fetch(`${this.baseUrl}/openapi/v1/text-to-3d`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: prompt,
            enable_pbr: options.enable_pbr ?? true,
            ai_model: options.ai_model || 'meshy-4',
            topology: options.topology || 'quad',
            target_polycount: options.target_polycount || options.targetPolycount || 2000,
            texture_resolution: options.texture_resolution || 512,
            negative_prompt: options.negative_prompt || '',
            style_prompt: options.style_prompt || ''
          })
        })

        if (!res.ok) {
          const error = await res.text()
          throw new Error(`Meshy API error: ${res.status} - ${error}`)
        }

        return res.json()
      },
      3
    )

    console.log('🔍 Meshy Text-to-3D Response:', JSON.stringify(response, null, 2))
    return (response as any).result || response
  }

  /**
   * Start retexturing task
   */
  private async startRetexturing(
    modelUrl: string,
    options: any
  ): Promise<string> {
    const response = await retry(
      async () => {
        const res = await fetch(`${this.baseUrl}/openapi/v1/text-to-texture`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model_url: modelUrl,
            prompt: options.texturePrompt,
            enable_pbr: options.enablePBR ?? true,
            texture_resolution: options.textureResolution || 512,
            style_prompt: options.stylePrompt || ''
          })
        })

        if (!res.ok) {
          const error = await res.text()
          throw new Error(`Meshy API error: ${res.status} - ${error}`)
        }

        return res.json()
      },
      3
    )

    console.log('🔍 Meshy Retexturing Response:', JSON.stringify(response, null, 2))
    return (response as any).result || response
  }

  /**
   * Wait for task completion
   */
  private async waitForCompletion(taskId: string, maxWaitTime: number = 300000): Promise<any> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getTaskStatus(taskId)
      
      switch (status.status) {
        case 'SUCCEEDED':
          return status
        case 'FAILED':
          throw new Error(`Task failed: ${status.task_error?.message || 'Unknown error'}`)
        case 'PENDING':
        case 'IN_PROGRESS':
          console.log(`⏳ Progress: ${status.progress || 0}%`)
          await sleep(5000)
          break
        default:
          throw new Error(`Unknown task status: ${status.status}`)
      }
    }
    
    throw new Error('Task timeout')
  }

  /**
   * Get task status
   */
  private async getTaskStatus(taskId: string): Promise<any> {
    // Try different endpoints based on task type
    const endpoints = [
      '/openapi/v1/image-to-3d/',
      '/openapi/v1/text-to-3d/',
      '/openapi/v1/text-to-texture/'
    ]
    
    for (const endpoint of endpoints) {
      try {
        const response = await retry(
          async () => {
            const res = await fetch(`${this.baseUrl}${endpoint}${taskId}`, {
              headers: {
                'Authorization': `Bearer ${this.config.apiKey}`
              }
            })

            if (!res.ok) {
              if (res.status === 404) {
                throw new Error('NOT_FOUND')
              }
              const error = await res.text()
              throw new Error(`Meshy API error: ${res.status} - ${error}`)
            }

            return res.json()
          },
          3
        ) as { result: any }

        console.log('🔍 Meshy Status Response:', JSON.stringify(response, null, 2))
        return response.result || response
      } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
          continue // Try next endpoint
        }
        throw error
      }
    }
    
    throw new Error(`Task ${taskId} not found in any endpoint`)
  }

  /**
   * Extract texture URLs from Meshy response
   */
  private extractTextureUrls(result: any): any {
    if (!result.texture_urls || result.texture_urls.length === 0) {
      return {}
    }

    const textures = result.texture_urls[0]
    return {
      diffuse: textures.base_color,
      normal: textures.normal,
      metallic: textures.metallic,
      roughness: textures.roughness
    }
  }
} 