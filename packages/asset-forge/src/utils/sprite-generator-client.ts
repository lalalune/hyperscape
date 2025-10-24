/**
 * Client-side sprite generation utility
 * Processes sprite metadata created by the server and generates actual sprites
 */

import { AssetService as AssetServiceInstance } from '@/services/api/AssetService'
import { SpriteGenerationService } from '@/services/generation/SpriteGenerationService'
import { apiFetch } from '@/utils/api'

export interface SpriteMetadata {
  baseModel: string
  modelPath: string
  config: {
    angles: number
    resolution: number
    backgroundColor: string
  }
  status: 'pending_client_generation' | 'completed'
  angles: number[]
  generatedAt: string
}

export class SpriteGeneratorClient {
  private spriteService: SpriteGenerationService
  private assetService = AssetServiceInstance
  
  constructor() {
    this.spriteService = new SpriteGenerationService()
  }
  
  /**
   * Check for assets that need sprite generation and process them
   */
  async processPendingSprites(): Promise<void> {
    console.log('🔍 Checking for assets that need sprite generation...')
    
    const assets = await this.assetService.listAssets()
    
    for (const asset of assets) {
      if (asset.metadata.isBaseModel) {
        await this.checkAndGenerateSprites(asset.id)
      }
    }
  }
  
  /**
   * Check if an asset needs sprites generated and process if needed
   */
  async checkAndGenerateSprites(assetId: string): Promise<boolean> {
    try {
      // Check for sprite metadata
      const metadataUrl = `/api/assets/${assetId}/sprite-metadata.json`
      const response = await apiFetch(metadataUrl)
      
      if (!response.ok) {
        // No sprite metadata, sprites not needed
        return false
      }
      
      const metadata: SpriteMetadata = await response.json()
      
      if (metadata.status === 'completed') {
        console.log(`✅ Sprites already generated for ${assetId}`)
        return true
      }
      
      console.log(`🎨 Generating sprites for ${assetId}...`)
      
      // Generate sprites
      const sprites = await this.spriteService.generateSprites({
        modelPath: `/api/assets/${assetId}/model`,
        outputSize: metadata.config.resolution,
        angles: metadata.angles,
        backgroundColor: metadata.config.backgroundColor,
        padding: 0.1
      })
      
      console.log(`✅ Generated ${sprites.length} sprites for ${assetId}`)

      // GitHub Issue #1: Implement sprite persistence to server or blob storage
      // For now, we'll just return success

      return true
      
    } catch (error) {
      console.error(`Failed to process sprites for ${assetId}:`, error)
      return false
    }
  }
  
  /**
   * Generate sprites for a specific asset on demand
   */
  async generateSpritesForAsset(
    assetId: string,
    config?: {
      angles?: number
      resolution?: number
      backgroundColor?: string
    }
  ): Promise<Array<{ angle: number; imageUrl: string }>> {
    const modelUrl = `/api/assets/${assetId}/model`
    
    const angleCount = config?.angles || 8
    const sprites = await this.spriteService.generateSprites({
      modelPath: modelUrl,
      outputSize: config?.resolution || 512,
      angles: Array.from({ length: angleCount }, (_, i) => (360 / angleCount) * i),
      backgroundColor: config?.backgroundColor || 'transparent',
      padding: 0.1
    })
    
    return sprites.map(sprite => ({
      angle: parseFloat(sprite.angle),
      imageUrl: sprite.imageUrl
    }))
  }
}

// Export singleton instance
export const spriteGeneratorClient = new SpriteGeneratorClient() 