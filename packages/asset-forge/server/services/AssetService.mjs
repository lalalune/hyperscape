/**
 * Asset Service
 * Handles asset listing and retrieval
 */

import fs from 'fs/promises'
import path from 'path'
import { validateAssetId } from '../utils/validators.mjs'
import { wrapError, ErrorCodes } from '../utils/error-helpers.mjs'
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('AssetService')

export class AssetService {
  constructor(assetsDir) {
    this.assetsDir = assetsDir
  }

  async listAssets() {
    try {
      const assetDirs = await fs.readdir(this.assetsDir)
      const assets = []

      for (const assetDir of assetDirs) {
        if (assetDir.startsWith('.') || assetDir.endsWith('.json')) {
          continue
        }

        const assetPath = path.join(this.assetsDir, assetDir)

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
          // Skip assets that can't be loaded but log the error
          logger.warn('Failed to load asset, skipping', {
            assetDir,
            error: error.message,
            errorStack: error.stack
          })
        }
      }

      // Sort by generation date, newest first
      return assets.sort((a, b) =>
        new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime()
      )
    } catch (error) {
      logger.error('Failed to list assets', error)
      throw wrapError(
        error,
        'Failed to list assets from directory',
        ErrorCodes.FILE_READ_ERROR,
        { assetsDir: this.assetsDir }
      )
    }
  }

  async getModelPath(assetId) {
    // SECURITY: Validate asset ID to prevent path traversal attacks
    const validatedAssetId = validateAssetId(assetId)
    const assetPath = path.join(this.assetsDir, validatedAssetId)

    // Check if asset directory exists
    try {
      await fs.access(assetPath)
    } catch (error) {
      throw wrapError(
        error,
        `Asset ${validatedAssetId} not found`,
        ErrorCodes.FILE_READ_ERROR,
        { assetId: validatedAssetId, assetPath }
      )
    }

    // Read metadata to check if it's a character with a rigged model
    try {
      const metadata = await this.getAssetMetadata(validatedAssetId)

      // For characters, prefer the rigged model if available
      if (metadata.type === 'character' && metadata.riggedModelPath) {
        const riggedPath = path.join(assetPath, path.basename(metadata.riggedModelPath))
        try {
          await fs.access(riggedPath)
          logger.info('Returning rigged model for character', {
            assetId: validatedAssetId,
            riggedModelPath: metadata.riggedModelPath
          })
          return riggedPath
        } catch (error) {
          logger.warn('Rigged model not found, falling back to regular model', {
            assetId: validatedAssetId,
            error: error.message
          })
        }
      }
    } catch (error) {
      logger.warn('Could not read metadata, using default model selection', {
        assetId: validatedAssetId,
        error: error.message
      })
    }

    // Default behavior: find the first .glb file
    const files = await fs.readdir(assetPath)
    const glbFile = files.find(f => f.endsWith('.glb'))

    if (!glbFile) {
      throw wrapError(
        new Error('No GLB file found in asset directory'),
        'Model file not found',
        ErrorCodes.FILE_READ_ERROR,
        { assetId: validatedAssetId, files: files.length }
      )
    }

    return path.join(assetPath, glbFile)
  }

  async getAssetMetadata(assetId) {
    // SECURITY: Validate asset ID to prevent path traversal attacks
    const validatedAssetId = validateAssetId(assetId)
    const metadataPath = path.join(this.assetsDir, validatedAssetId, 'metadata.json')
    return JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
  }

  async loadAsset(assetId) {
    // SECURITY: Validate asset ID to prevent path traversal attacks
    const validatedAssetId = validateAssetId(assetId)

    try {
      const assetPath = path.join(this.assetsDir, validatedAssetId)
      const stats = await fs.stat(assetPath)

      if (!stats.isDirectory()) {
        return null
      }

      const metadataPath = path.join(assetPath, 'metadata.json')
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))

      const files = await fs.readdir(assetPath)
      const glbFile = files.find(f => f.endsWith('.glb'))

      return {
        id: validatedAssetId,
        name: metadata.name || validatedAssetId,
        description: metadata.description || '',
        type: metadata.type || 'unknown',
        metadata: metadata,
        hasModel: !!glbFile,
        modelFile: glbFile,
        generatedAt: metadata.generatedAt
      }
    } catch (error) {
      logger.error('Failed to load asset', error, { assetId })
      throw wrapError(
        error,
        `Failed to load asset ${assetId}`,
        ErrorCodes.FILE_READ_ERROR,
        { assetId }
      )
    }
  }

  async deleteAsset(assetId, includeVariants = false) {
    // SECURITY: Validate asset ID to prevent path traversal attacks
    const validatedAssetId = validateAssetId(assetId)
    const assetPath = path.join(this.assetsDir, validatedAssetId)

    // Check if asset exists
    try {
      await fs.access(assetPath)
    } catch (error) {
      throw wrapError(
        error,
        `Asset ${validatedAssetId} not found`,
        ErrorCodes.FILE_READ_ERROR,
        { assetId: validatedAssetId, assetPath }
      )
    }

    // Get metadata to check if it's a base asset
    const metadata = await this.getAssetMetadata(validatedAssetId)

    // If it's a base asset and includeVariants is true, delete all variants
    if (metadata.isBaseModel && includeVariants) {
      const allAssets = await this.listAssets()
      const variants = allAssets.filter(
        asset => asset.metadata.parentBaseModel === validatedAssetId
      )

      // Delete all variants
      for (const variant of variants) {
        await this.deleteAssetDirectory(variant.id)
      }
    }

    // Delete the main asset
    await this.deleteAssetDirectory(validatedAssetId)

    // Update dependencies file if it exists
    await this.updateDependencies(validatedAssetId)

    return true
  }

  async deleteAssetDirectory(assetId) {
    // SECURITY: Validate asset ID to prevent path traversal attacks
    const validatedAssetId = validateAssetId(assetId)
    const assetPath = path.join(this.assetsDir, validatedAssetId)

    try {
      // Recursively delete the directory
      await fs.rm(assetPath, { recursive: true, force: true })
      logger.info('Deleted asset directory', { assetId: validatedAssetId })
    } catch (error) {
      logger.error('Failed to delete asset', error, { assetId: validatedAssetId })
      throw wrapError(
        error,
        `Failed to delete asset ${validatedAssetId}`,
        ErrorCodes.FILE_WRITE_ERROR,
        { assetId: validatedAssetId, assetPath }
      )
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
      // Dependencies file might not exist, which is okay for read operations
      if (error.code === 'ENOENT') {
        logger.debug('No dependencies file to update')
      } else {
        // Other errors should be logged and propagated
        logger.error('Failed to update dependencies file', error)
        throw wrapError(
          error,
          'Failed to update dependencies file',
          ErrorCodes.FILE_WRITE_ERROR,
          { dependenciesPath }
        )
      }
    }
  }

  async updateAsset(assetId, updates) {
    // SECURITY: Validate asset ID to prevent path traversal attacks
    const validatedAssetId = validateAssetId(assetId)

    try {
      const assetPath = path.join(this.assetsDir, validatedAssetId)
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
      if (updates.name && updates.name !== validatedAssetId) {
        // SECURITY: Validate new name to prevent path traversal
        const validatedNewName = validateAssetId(updates.name)

        // Update name in metadata
        updatedMetadata.name = validatedNewName
        updatedMetadata.gameId = validatedNewName

        // Create new directory with new name
        const newAssetPath = path.join(this.assetsDir, validatedNewName)

        // Check if new name already exists
        try {
          await fs.access(newAssetPath)
          throw new Error(`Asset with name ${validatedNewName} already exists`)
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
        await this.updateDependencies(validatedAssetId, validatedNewName)

        return this.loadAsset(validatedNewName)
      } else {
        // Just update metadata
        await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2))
        return this.loadAsset(validatedAssetId)
      }
    } catch (error) {
      logger.error('Error updating asset', error, { assetId, updates })
      throw wrapError(
        error,
        `Error updating asset ${assetId}`,
        ErrorCodes.FILE_WRITE_ERROR,
        { assetId, updates }
      )
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
      // Dependencies file might not exist, which is okay for read operations
      if (error.code === 'ENOENT') {
        logger.debug('No dependencies file to update')
      } else {
        // Other errors should be logged and propagated
        logger.error('Failed to update dependencies file in rename', error)
        throw wrapError(
          error,
          'Failed to update dependencies file',
          ErrorCodes.FILE_WRITE_ERROR,
          { dependenciesPath, oldId, newId }
        )
      }
    }
  }
}
