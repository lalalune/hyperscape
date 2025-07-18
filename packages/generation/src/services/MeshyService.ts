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
        const res = await fetch(`${this.baseUrl}/openapi/v2/image-to-3d`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image_url: imageUrl,
            enable_pbr: true,
            surface_mode: 'organic',
            topology: 'quad',
            target_polycount: options.targetPolycount || 30000,
            should_remesh: true
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

    return (response as any).result
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
    const response = await retry(
      async () => {
        const res = await fetch(`${this.baseUrl}/task/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        })

        if (!res.ok) {
          const error = await res.text()
          throw new Error(`Meshy API error: ${res.status} - ${error}`)
        }

        return res.json()
      },
      3
    ) as { result: any }

    return response.result
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