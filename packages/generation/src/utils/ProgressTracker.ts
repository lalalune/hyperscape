import { existsSync, readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'
import { GDDAsset } from '../types'

export interface ProgressReport {
  totalAssets: number
  generatedCount: number
  failedCount: number
  remainingCount: number
  successRate: number
  totalSize: string
  averageSize: string
  generatedCost: string
  remainingCost: string
  remainingAssets: Array<{
    name: string
    type: string
    tier?: string
  }>
}

export interface AssetStats {
  size: string
  sizeBytes: number
  path: string
  generatedAt: string
}

export class ProgressTracker {
  private outputDir: string
  private batchPath: string
  private allAssets: GDDAsset[]
  
  constructor() {
    this.outputDir = join(process.cwd(), 'gdd-assets')
    this.batchPath = join(process.cwd(), 'gdd-complete-batch.json')
    this.allAssets = this.loadAllAssets()
  }
  
  private loadAllAssets(): GDDAsset[] {
    if (!existsSync(this.batchPath)) {
      return []
    }
    
    return JSON.parse(readFileSync(this.batchPath, 'utf8'))
  }
  
  async generateReport(): Promise<ProgressReport> {
    const generatedAssets = this.getGeneratedAssets()
    const failedAssets = this.getFailedAssets()
    const remainingAssets = await this.getRemainingAssets()
    
    // Calculate sizes
    const totalSizeBytes = generatedAssets.reduce((sum, asset) => sum + asset.sizeBytes, 0)
    const averageSizeBytes = generatedAssets.length > 0 ? totalSizeBytes / generatedAssets.length : 0
    
    // Calculate costs (estimated at $0.14 per asset)
    const costPerAsset = 0.14
    const generatedCost = generatedAssets.length * costPerAsset
    const remainingCost = remainingAssets.length * costPerAsset
    
    return {
      totalAssets: this.allAssets.length,
      generatedCount: generatedAssets.length,
      failedCount: failedAssets.length,
      remainingCount: remainingAssets.length,
      successRate: Math.round((generatedAssets.length / this.allAssets.length) * 100),
      totalSize: this.formatBytes(totalSizeBytes),
      averageSize: this.formatBytes(averageSizeBytes),
      generatedCost: generatedCost.toFixed(2),
      remainingCost: remainingCost.toFixed(2),
      remainingAssets: remainingAssets.map(asset => ({
        name: asset.name,
        type: asset.type,
        tier: asset.metadata?.tier
      }))
    }
  }
  
  getGeneratedAssets(): Array<AssetStats & { name: string; type: string }> {
    if (!existsSync(this.outputDir)) {
      return []
    }
    
    const assets: Array<AssetStats & { name: string; type: string }> = []
    const dirs = readdirSync(this.outputDir)
    
    for (const dir of dirs) {
      const dirPath = join(this.outputDir, dir)
      
      if (!statSync(dirPath).isDirectory()) continue
      
      const metadataPath = join(dirPath, 'metadata.json')
      const glbFiles = readdirSync(dirPath).filter(f => f.endsWith('.glb'))
      
      if (glbFiles.length > 0 && existsSync(metadataPath)) {
        const glbPath = join(dirPath, glbFiles[0])
        const glbStats = statSync(glbPath)
        
        if (glbStats.size > 0) {
          const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
          
          assets.push({
            name: metadata.name || dir,
            type: metadata.type || 'unknown',
            size: this.formatBytes(glbStats.size),
            sizeBytes: glbStats.size,
            path: glbPath,
            generatedAt: metadata.generatedAt || glbStats.mtime.toISOString()
          })
        }
      }
    }
    
    return assets.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  getFailedAssets(): string[] {
    if (!existsSync(this.outputDir)) {
      return []
    }
    
    const failed: string[] = []
    const dirs = readdirSync(this.outputDir)
    
    for (const dir of dirs) {
      const dirPath = join(this.outputDir, dir)
      
      if (!statSync(dirPath).isDirectory()) continue
      
      const glbFiles = readdirSync(dirPath).filter(f => f.endsWith('.glb'))
      
      if (glbFiles.length === 0) {
        failed.push(dir)
      } else {
        // Check if GLB file is valid (non-zero size)
        const glbPath = join(dirPath, glbFiles[0])
        if (statSync(glbPath).size === 0) {
          failed.push(dir)
        }
      }
    }
    
    return failed
  }
  
  async getRemainingAssets(): Promise<GDDAsset[]> {
    const generatedAssets = this.getGeneratedAssets()
    // Use the directory names as the generated asset IDs
    const generatedDirNames = new Set()
    
    if (existsSync(this.outputDir)) {
      const dirs = readdirSync(this.outputDir)
      for (const dir of dirs) {
        const dirPath = join(this.outputDir, dir)
        if (statSync(dirPath).isDirectory()) {
          const glbFiles = readdirSync(dirPath).filter(f => f.endsWith('.glb'))
          if (glbFiles.length > 0) {
            generatedDirNames.add(dir)
          }
        }
      }
    }
    
    return this.allAssets.filter(asset => {
      const assetId = this.getAssetIdConsistent(asset.name, asset.subtype || asset.type, asset.metadata?.tier)
      return !generatedDirNames.has(assetId)
    })
  }
  
  assetExists(assetId: string): boolean {
    const assetDir = join(this.outputDir, assetId)
    
    if (!existsSync(assetDir)) {
      return false
    }
    
    const glbFiles = readdirSync(assetDir).filter(f => f.endsWith('.glb'))
    
    if (glbFiles.length === 0) {
      return false
    }
    
    const glbPath = join(assetDir, glbFiles[0])
    return statSync(glbPath).size > 0
  }
  
  async getAssetStats(assetId: string): Promise<AssetStats | null> {
    const assetDir = join(this.outputDir, assetId)
    
    if (!existsSync(assetDir)) {
      return null
    }
    
    const glbFiles = readdirSync(assetDir).filter(f => f.endsWith('.glb'))
    
    if (glbFiles.length === 0) {
      return null
    }
    
    const glbPath = join(assetDir, glbFiles[0])
    const stats = statSync(glbPath)
    
    let generatedAt = stats.mtime.toISOString()
    
    // Try to get from metadata
    const metadataPath = join(assetDir, 'metadata.json')
    if (existsSync(metadataPath)) {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
      generatedAt = metadata.generatedAt || generatedAt
    }
    
    return {
      size: this.formatBytes(stats.size),
      sizeBytes: stats.size,
      path: glbPath,
      generatedAt
    }
  }
  
  private getAssetIdConsistent(name: string, type: string, tier?: string): string {
    // This method matches the logic from GDDAssetGenerator.getAssetId
    const baseType = type
    const tierValue = tier || 'basic'
    const normalizedTier = tierValue.replace(/_/g, '-')
    return `${baseType}-${normalizedTier}`.toLowerCase().replace(/\s+/g, '-')
  }

  private getAssetId(name: string, type: string, tier?: string): string {
    // Try to extract base type and tier from name
    const nameLower = name.toLowerCase()
    
    // Extract tier if present
    const tierMatch = tier || 
      (nameLower.includes('bronze') ? 'bronze' :
       nameLower.includes('steel') ? 'steel' :
       nameLower.includes('mithril') ? 'mithril' :
       nameLower.includes('leather') ? 'leather' :
       nameLower.includes('hard leather') ? 'hard-leather' :
       nameLower.includes('studded leather') ? 'studded-leather' :
       nameLower.includes('wood') ? 'wood' :
       nameLower.includes('oak') ? 'oak' :
       nameLower.includes('willow') ? 'willow' :
       'basic')
    
    // Extract base type
    const baseType = type.toLowerCase().replace(/\s+/g, '-')
    
    return `${baseType}-${tierMatch}`.replace(/\s+/g, '-')
  }
  
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}