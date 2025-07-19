import { AICreationService } from '../core/AICreationService'
import { GDDAsset, SimpleGenerationResult, GenerationResult } from '../types'
import { ProgressTracker } from '../utils/ProgressTracker'
import { AssetPrompts } from '../config/AssetPrompts'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'

export class GDDAssetGenerator {
  private aiService: AICreationService
  private progressTracker: ProgressTracker
  private gddAssets: GDDAsset[]
  
  constructor() {
    this.aiService = new AICreationService({
      openai: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'dall-e-3'
      },
      meshy: {
        apiKey: process.env.MESHY_API_KEY!,
        baseUrl: 'https://api.meshy.ai'
      },
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 500
      },
      output: {
        directory: join(process.cwd(), 'gdd-assets'),
        format: 'glb'
      }
    })
    
    this.progressTracker = new ProgressTracker()
    this.gddAssets = this.loadGDDAssets()
  }
  
  private loadGDDAssets(): GDDAsset[] {
    const batchPath = join(process.cwd(), 'gdd-complete-batch.json')
    
    if (!existsSync(batchPath)) {
      throw new Error(`GDD batch file not found at ${batchPath}`)
    }
    
    return JSON.parse(readFileSync(batchPath, 'utf8'))
  }
  
  async generateAll(limit: number = 10): Promise<void> {
    console.log(chalk.cyan(`🎯 Generating up to ${limit} assets from GDD`))
    
    const remainingAssets = await this.progressTracker.getRemainingAssets()
    const assetsToGenerate = remainingAssets.slice(0, limit)
    
    console.log(chalk.yellow(`📋 Found ${remainingAssets.length} remaining assets`))
    console.log(chalk.yellow(`🔄 Generating ${assetsToGenerate.length} assets in this batch`))
    
    let successCount = 0
    let failureCount = 0
    
    for (let i = 0; i < assetsToGenerate.length; i++) {
      const asset = assetsToGenerate[i]
      const assetId = this.getAssetId(asset)
      
      console.log(chalk.blue(`\n[${i + 1}/${assetsToGenerate.length}] Generating ${asset.name}...`))
      
      try {
        const result = await this.generateAsset(asset)
        
        if (result.success) {
          console.log(chalk.green(`✅ SUCCESS: ${asset.name} (${result.fileSize})`))
          successCount++
        } else {
          console.log(chalk.red(`❌ FAILED: ${asset.name}`))
          failureCount++
        }
        
        // Update progress
        const progress = Math.round(((i + 1) / assetsToGenerate.length) * 100)
        console.log(chalk.cyan(`📈 Batch Progress: ${progress}%`))
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.log(chalk.red(`❌ ERROR: ${asset.name} - ${error}`))
        failureCount++
      }
    }
    
    // Final summary
    console.log(chalk.blue('\n📊 Generation Summary:'))
    console.log(chalk.green(`✅ Success: ${successCount}`))
    console.log(chalk.red(`❌ Failed: ${failureCount}`))
    console.log(chalk.blue(`📈 Success Rate: ${Math.round((successCount / (successCount + failureCount)) * 100)}%`))
  }
  
  async continueGeneration(batchSize: number = 5): Promise<void> {
    console.log(chalk.cyan(`🔄 Continuing generation with batch size ${batchSize}`))
    
    const remainingAssets = await this.progressTracker.getRemainingAssets()
    
    if (remainingAssets.length === 0) {
      console.log(chalk.green('✅ All assets already generated!'))
      return
    }
    
    const batch = remainingAssets.slice(0, batchSize)
    console.log(chalk.yellow(`📋 Processing ${batch.length} assets from ${remainingAssets.length} remaining`))
    
    for (let i = 0; i < batch.length; i++) {
      const asset = batch[i]
      
      console.log(chalk.blue(`\n[${i + 1}/${batch.length}] ${asset.name}...`))
      
      try {
        const result = await this.generateAsset(asset)
        
        if (result.success) {
          console.log(chalk.green(`✅ SUCCESS: ${result.fileSize}`))
        } else {
          console.log(chalk.red(`❌ FAILED`))
        }
        
      } catch (error) {
        console.log(chalk.red(`❌ ERROR: ${error}`))
      }
    }
  }
  
  async generateNext(): Promise<{ success: boolean; assetName?: string; fileSize?: string }> {
    const remainingAssets = await this.progressTracker.getRemainingAssets()
    
    if (remainingAssets.length === 0) {
      return { success: false }
    }
    
    const nextAsset = remainingAssets[0]
    console.log(chalk.blue(`🎯 Generating: ${nextAsset.name}`))
    
    try {
      const result = await this.generateAsset(nextAsset)
      
      return {
        success: result.success,
        assetName: nextAsset.name,
        fileSize: result.fileSize
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to generate ${nextAsset.name}:`, error))
      return { success: false, assetName: nextAsset.name }
    }
  }
  
  private async generateAsset(asset: GDDAsset): Promise<SimpleGenerationResult> {
    const assetId = this.getAssetId(asset)
    
    // Check if already exists
    if (this.progressTracker.assetExists(assetId)) {
      return {
        success: true,
        assetId,
        fileSize: 'Already exists'
      }
    }
    
    // Get the prompt for this asset
    const prompt = AssetPrompts.getPrompt(asset)
    
    if (!prompt) {
      const gameId = asset.metadata?.gameId
      const baseType = gameId ? gameId.toLowerCase().replace(/_/g, '-') : (asset.subtype || asset.type).toLowerCase().replace(/\s+/g, '-')
      throw new Error(`No prompt template found for asset. Tried: gameId='${gameId}', baseType='${baseType}', subtype='${asset.subtype}', type='${asset.type}'`)
    }
    
    console.log(chalk.gray(`📝 Prompt: ${prompt.substring(0, 80)}...`))
    
    // Generate the asset
    const result = await this.aiService.generate({
      ...asset,
      id: assetId,
      description: prompt
    } as any)
    
    if (result.finalAsset?.modelUrl) {
      const stats = await this.progressTracker.getAssetStats(assetId)
      
      return {
        success: true,
        assetId,
        fileSize: stats?.size || 'Unknown',
        modelUrl: result.finalAsset.modelUrl
      }
    }
    
    return {
      success: false,
      assetId
    }
  }
  
  private getAssetId(asset: GDDAsset): string {
    const baseType = asset.subtype || asset.type
    const tier = asset.metadata?.tier || 'basic'
    // Convert underscores to hyphens to match file system format
    const normalizedTier = tier.replace(/_/g, '-')
    return `${baseType}-${normalizedTier}`.toLowerCase().replace(/\s+/g, '-')
  }
}