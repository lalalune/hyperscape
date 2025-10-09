/**
 * Asset Service
 * Handles asset listing and retrieval
 */

import fs from 'fs/promises'
import path from 'path'

export class AssetService {
  constructor(assetsDir) {
    this.assetsDir = assetsDir
  }

  async listAssets() {
    try {
      // Check both root assetsDir and forge subdirectory
      const forgeDir = path.join(this.assetsDir, 'forge')
      const hasForgedir = await fs.access(forgeDir).then(() => true).catch(() => false)
      
      const assetDirs = hasForgedir 
        ? await fs.readdir(forgeDir)
        : await fs.readdir(this.assetsDir)
      
      const baseDir = hasForgedir ? forgeDir : this.assetsDir
      const assets = []

      for (const assetDir of assetDirs) {
        if (assetDir.startsWith('.') || assetDir.endsWith('.json')) {
          continue
        }

        const assetPath = path.join(baseDir, assetDir)
        
        try {
          const stats = await fs.stat(assetPath)
          if (!stats.isDirectory()) continue

          const metadataPath = path.join(assetPath, 'metadata.json')
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
          
          const files = await fs.readdir(assetPath)
          const glbFile = files.find(f => f.endsWith('.glb'))

          assets.push({
            id: assetDir,
            name: metadata.name || assetDir,
            description: metadata.description || '',
            type: metadata.type || 'unknown',
            metadata: metadata,
            hasModel: !!glbFile,
            modelFile: glbFile,
            generatedAt: metadata.generatedAt
          })
        } catch (error) {
          // Skip assets that can't be loaded
          console.warn(`Failed to load asset ${assetDir}:`, error.message)
        }
      }

      // Sort by generation date, newest first
      return assets.sort((a, b) => 
        new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime()
      )
    } catch (error) {
      console.error('Failed to list assets:', error)
      return []
    }
  }

  async getModelPath(assetId) {
    // Try forge subdirectory first, then root
    const forgePath = path.join(this.assetsDir, 'forge', assetId)
    const hasForge = await fs.access(forgePath).then(() => true).catch(() => false)
    const assetPath = hasForge ? forgePath : path.join(this.assetsDir, assetId)
    
    // Check if asset directory exists
    try {
      await fs.access(assetPath)
    } catch (error) {
      throw new Error(`Asset ${assetId} not found`)
    }
    
    // Read metadata to check if it's a character with a rigged model
    try {
      const metadata = await this.getAssetMetadata(assetId)
      
      // For characters, prefer the rigged model if available
      if (metadata.type === 'character' && metadata.riggedModelPath) {
        const riggedPath = path.join(assetPath, path.basename(metadata.riggedModelPath))
        try {
          await fs.access(riggedPath)
          console.log(`Returning rigged model for character ${assetId}: ${metadata.riggedModelPath}`)
          return riggedPath
        } catch {
          console.warn(`Rigged model not found for character ${assetId}, falling back to regular model`)
        }
      }
    } catch (error) {
      console.log(`Could not read metadata for ${assetId}, using default model selection`)
    }
    
    // Default behavior: find the first .glb file
    const files = await fs.readdir(assetPath)
    const glbFile = files.find(f => f.endsWith('.glb'))
    
    if (!glbFile) {
      throw new Error('Model file not found')
    }
    
    return path.join(assetPath, glbFile)
  }

  async getAssetMetadata(assetId) {
    const forgePath = path.join(this.assetsDir, 'forge', assetId, 'metadata.json')
    const hasForge = await fs.access(forgePath).then(() => true).catch(() => false)
    const metadataPath = hasForge ? forgePath : path.join(this.assetsDir, assetId, 'metadata.json')
    return JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
  }
  
  async loadAsset(assetId) {
    try {
      const forgePath = path.join(this.assetsDir, 'forge', assetId)
      const hasForge = await fs.access(forgePath).then(() => true).catch(() => false)
      const assetPath = hasForge ? forgePath : path.join(this.assetsDir, assetId)
      const stats = await fs.stat(assetPath)
      
      if (!stats.isDirectory()) {
        return null
      }

      const metadataPath = path.join(assetPath, 'metadata.json')
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
      
      const files = await fs.readdir(assetPath)
      const glbFile = files.find(f => f.endsWith('.glb'))

      return {
        id: assetId,
        name: metadata.name || assetId,
        description: metadata.description || '',
        type: metadata.type || 'unknown',
        metadata: metadata,
        hasModel: !!glbFile,
        modelFile: glbFile,
        generatedAt: metadata.generatedAt
      }
    } catch (error) {
      console.error(`Failed to load asset ${assetId}:`, error)
      return null
    }
  }
  
  async deleteAsset(assetId, includeVariants = false) {
    const forgePath = path.join(this.assetsDir, 'forge', assetId)
    const hasForge = await fs.access(forgePath).then(() => true).catch(() => false)
    const assetPath = hasForge ? forgePath : path.join(this.assetsDir, assetId)
    
    // Check if asset exists
    try {
      await fs.access(assetPath)
    } catch {
      throw new Error(`Asset ${assetId} not found`)
    }
    
    // Get metadata to check if it's a base asset
    const metadata = await this.getAssetMetadata(assetId)
    
    // If it's a base asset and includeVariants is true, delete all variants
    if (metadata.isBaseModel && includeVariants) {
      const allAssets = await this.listAssets()
      const variants = allAssets.filter(
        asset => asset.metadata.parentBaseModel === assetId
      )
      
      // Delete all variants
      for (const variant of variants) {
        await this.deleteAssetDirectory(variant.id)
      }
    }
    
    // Delete the main asset
    await this.deleteAssetDirectory(assetId)
    
    // Update dependencies file if it exists
    await this.updateDependencies(assetId)
    
    return true
  }
  
  async deleteAssetDirectory(assetId) {
    const forgePath = path.join(this.assetsDir, 'forge', assetId)
    const hasForge = await fs.access(forgePath).then(() => true).catch(() => false)
    const assetPath = hasForge ? forgePath : path.join(this.assetsDir, assetId)
    
    try {
      // Recursively delete the directory
      await fs.rm(assetPath, { recursive: true, force: true })
      console.log(`Deleted asset directory: ${assetId}`)
    } catch (error) {
      console.error(`Failed to delete asset ${assetId}:`, error)
      throw new Error(`Failed to delete asset ${assetId}`)
    }
  }
  
  async updateDependencies(deletedAssetId) {
    const dependenciesPath = path.join(this.assetsDir, '.dependencies.json')
    
    try {
      const dependencies = JSON.parse(await fs.readFile(dependenciesPath, 'utf-8'))
      
      // Remove the deleted asset from dependencies
      delete dependencies[deletedAssetId]
      
      // Remove the deleted asset from other assets' variants lists
      for (const [baseId, deps] of Object.entries(dependencies)) {
        if (deps.variants && deps.variants.includes(deletedAssetId)) {
          deps.variants = deps.variants.filter(id => id !== deletedAssetId)
        }
      }
      
      await fs.writeFile(dependenciesPath, JSON.stringify(dependencies, null, 2))
    } catch (error) {
      // Dependencies file might not exist, which is okay
      console.log('No dependencies file to update')
    }
  }
  
  async updateAsset(assetId, updates) {
    try {
      const forgePath = path.join(this.assetsDir, 'forge', assetId)
      const hasForge = await fs.access(forgePath).then(() => true).catch(() => false)
      const assetPath = hasForge ? forgePath : path.join(this.assetsDir, assetId)
      const metadataPath = path.join(assetPath, 'metadata.json')
      
      // Check if asset exists
      try {
        await fs.access(assetPath)
      } catch {
        return null
      }
      
      // Read current metadata
      const currentMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
      
      // Update metadata with new values
      const updatedMetadata = {
        ...currentMetadata,
        ...updates.metadata,
        lastModified: new Date().toISOString()
      }
      
      // Handle type change if provided
      if (updates.type && updates.type !== currentMetadata.type) {
        updatedMetadata.type = updates.type
      }
      
      // Handle name change if provided  
      if (updates.name && updates.name !== assetId) {
        // Update name in metadata
        updatedMetadata.name = updates.name
        updatedMetadata.gameId = updates.name
        
        // Create new directory with new name
        const baseDir = hasForge ? path.join(this.assetsDir, 'forge') : this.assetsDir
        const newAssetPath = path.join(baseDir, updates.name)
        
        // Check if new name already exists
        try {
          await fs.access(newAssetPath)
          throw new Error(`Asset with name ${updates.name} already exists`)
        } catch (error) {
          // If the error is NOT "file not found", re-throw it
          if (error.code !== 'ENOENT') {
            throw error
          }
          // Otherwise, the path doesn't exist, which is what we want
        }
        
        // Rename directory
        await fs.rename(assetPath, newAssetPath)
        
        // Update metadata in new location
        await fs.writeFile(
          path.join(newAssetPath, 'metadata.json'), 
          JSON.stringify(updatedMetadata, null, 2)
        )
        
        // Update dependencies if needed
        await this.updateDependencies(assetId, updates.name)
        
        return this.loadAsset(updates.name)
      } else {
        // Just update metadata
        await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2))
        return this.loadAsset(assetId)
      }
    } catch (error) {
      console.error(`Error updating asset ${assetId}:`, error)
      throw error
    }
  }
  
  async updateDependencies(oldId, newId) {
    const dependenciesPath = path.join(this.assetsDir, 'dependencies.json')
    
    try {
      const dependencies = JSON.parse(await fs.readFile(dependenciesPath, 'utf-8'))
      
      // Update the key if it exists
      if (dependencies[oldId]) {
        dependencies[newId] = dependencies[oldId]
        delete dependencies[oldId]
      }
      
      // Update references in other assets
      for (const [baseId, deps] of Object.entries(dependencies)) {
        if (deps.variants && deps.variants.includes(oldId)) {
          deps.variants = deps.variants.map(id => id === oldId ? newId : id)
        }
      }
      
      await fs.writeFile(dependenciesPath, JSON.stringify(dependencies, null, 2))
    } catch (error) {
      console.log('No dependencies file to update')
    }
  }
}