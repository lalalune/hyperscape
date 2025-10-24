/**
 * Blob Asset Service
 * Handles asset operations using Vercel Blob Storage
 */

import fs from 'fs/promises'
import path from 'path'
import { put, del, list, head, copy } from '@vercel/blob'

export class BlobAssetService {
  constructor(options = {}) {
    this.migrationLogPath = options.migrationLogPath || null
    this.migrationData = null
    this.assetsDir = options.assetsDir // Keep for backward compatibility during migration
  }

  /**
   * Load migration data from disk
   */
  async loadMigrationData() {
    if (this.migrationData) return this.migrationData

    if (!this.migrationLogPath) {
      throw new Error('Migration log path not configured')
    }

    try {
      const data = await fs.readFile(this.migrationLogPath, 'utf-8')
      this.migrationData = JSON.parse(data)
      return this.migrationData
    } catch (error) {
      throw new Error(`Failed to load migration data: ${error.message}`)
    }
  }

  /**
   * List all assets with their metadata
   */
  async listAssets() {
    try {
      await this.loadMigrationData()

      const assets = []

      for (const [assetId, assetData] of Object.entries(this.migrationData.assets)) {
        if (!assetData.metadata) continue

        const metadata = assetData.metadata
        const modelFile = assetData.files.find(f => f.relativePath.endsWith('.glb'))

        assets.push({
          id: assetId,
          name: metadata.name || assetId,
          description: metadata.description || '',
          type: metadata.type || 'unknown',
          metadata: metadata,
          hasModel: !!modelFile,
          modelFile: modelFile?.relativePath,
          modelUrl: assetData.blobUrls[modelFile?.relativePath],
          generatedAt: metadata.generatedAt,
          blobUrls: assetData.blobUrls
        })
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

  /**
   * Get blob URL for a model file
   */
  async getModelUrl(assetId) {
    await this.loadMigrationData()

    const assetData = this.migrationData.assets[assetId]
    if (!assetData) {
      throw new Error(`Asset ${assetId} not found`)
    }

    // Check for rigged model first (for characters)
    const metadata = assetData.metadata
    if (metadata?.type === 'character' && metadata?.riggedModelPath) {
      const riggedFileName = path.basename(metadata.riggedModelPath)
      const riggedUrl = assetData.blobUrls[riggedFileName]
      if (riggedUrl) {
        return riggedUrl
      }
    }

    // Find first .glb file
    const modelFile = assetData.files.find(f => f.relativePath.endsWith('.glb'))
    if (!modelFile) {
      throw new Error('Model file not found')
    }

    const url = assetData.blobUrls[modelFile.relativePath]
    if (!url) {
      throw new Error('Model URL not found in migration data')
    }

    return url
  }

  /**
   * Get blob URL for any file in an asset directory
   */
  async getAssetFileUrl(assetId, filePath) {
    await this.loadMigrationData()

    const assetData = this.migrationData.assets[assetId]
    if (!assetData) {
      throw new Error(`Asset ${assetId} not found`)
    }

    const url = assetData.blobUrls[filePath]
    if (!url) {
      throw new Error(`File ${filePath} not found for asset ${assetId}`)
    }

    return url
  }

  /**
   * Get asset metadata
   */
  async getAssetMetadata(assetId) {
    await this.loadMigrationData()

    const assetData = this.migrationData.assets[assetId]
    if (!assetData) {
      throw new Error(`Asset ${assetId} not found`)
    }

    return assetData.metadata
  }

  /**
   * Load a single asset
   */
  async loadAsset(assetId) {
    try {
      await this.loadMigrationData()

      const assetData = this.migrationData.assets[assetId]
      if (!assetData) {
        return null
      }

      const metadata = assetData.metadata
      const modelFile = assetData.files.find(f => f.relativePath.endsWith('.glb'))

      return {
        id: assetId,
        name: metadata.name || assetId,
        description: metadata.description || '',
        type: metadata.type || 'unknown',
        metadata: metadata,
        hasModel: !!modelFile,
        modelFile: modelFile?.relativePath,
        modelUrl: assetData.blobUrls[modelFile?.relativePath],
        generatedAt: metadata.generatedAt,
        blobUrls: assetData.blobUrls
      }
    } catch (error) {
      console.error(`Failed to load asset ${assetId}:`, error)
      return null
    }
  }

  /**
   * Delete asset from blob storage
   */
  async deleteAsset(assetId, includeVariants = false) {
    await this.loadMigrationData()

    const assetData = this.migrationData.assets[assetId]
    if (!assetData) {
      throw new Error(`Asset ${assetId} not found`)
    }

    const metadata = assetData.metadata

    // If it's a base asset and includeVariants is true, delete all variants
    if (metadata.isBaseModel && includeVariants) {
      const allAssets = await this.listAssets()
      const variants = allAssets.filter(
        asset => asset.metadata.parentBaseModel === assetId
      )

      // Delete all variants
      for (const variant of variants) {
        await this.deleteAssetBlobs(variant.id)
      }
    }

    // Delete the main asset
    await this.deleteAssetBlobs(assetId)

    // Remove from migration data
    delete this.migrationData.assets[assetId]
    await this.saveMigrationData()

    return true
  }

  /**
   * Delete all blobs for an asset
   */
  async deleteAssetBlobs(assetId) {
    const assetData = this.migrationData.assets[assetId]
    if (!assetData) return

    const urlsToDelete = Object.values(assetData.blobUrls)

    for (const url of urlsToDelete) {
      try {
        await del(url, {
          token: process.env.BLOB_READ_WRITE_TOKEN
        })
        console.log(`Deleted blob: ${url}`)
      } catch (error) {
        console.error(`Failed to delete blob ${url}:`, error.message)
      }
    }
  }

  /**
   * Update asset metadata (stores updated metadata back to blob)
   */
  async updateAsset(assetId, updates) {
    try {
      await this.loadMigrationData()

      const assetData = this.migrationData.assets[assetId]
      if (!assetData) {
        return null
      }

      const currentMetadata = assetData.metadata

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
        updatedMetadata.name = updates.name
        updatedMetadata.gameId = updates.name

        // Upload updated metadata to blob
        const metadataBuffer = Buffer.from(JSON.stringify(updatedMetadata, null, 2))
        const { url } = await put(`assets/${updates.name}/metadata.json`, metadataBuffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
          token: process.env.BLOB_READ_WRITE_TOKEN
        })

        // Copy all other files to new asset name
        const newAssetData = {
          files: assetData.files.map(f => ({
            ...f,
            blobPath: `assets/${updates.name}/${f.relativePath}`
          })),
          metadata: updatedMetadata,
          blobUrls: {}
        }

        // Copy each file to new location
        for (const file of assetData.files) {
          if (file.relativePath === 'metadata.json') {
            newAssetData.blobUrls['metadata.json'] = url
            continue
          }

          const oldUrl = assetData.blobUrls[file.relativePath]
          // Note: Vercel Blob doesn't have a "copy" operation, so we'd need to
          // download and re-upload. For now, just reference the old URL
          // In production, you'd want to implement proper copying
          newAssetData.blobUrls[file.relativePath] = oldUrl
        }

        // Update migration data
        this.migrationData.assets[updates.name] = newAssetData
        delete this.migrationData.assets[assetId]
        await this.saveMigrationData()

        return this.loadAsset(updates.name)
      } else {
        // Just update metadata
        const metadataBuffer = Buffer.from(JSON.stringify(updatedMetadata, null, 2))
        const { url } = await put(`assets/${assetId}/metadata.json`, metadataBuffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
          token: process.env.BLOB_READ_WRITE_TOKEN
        })

        assetData.metadata = updatedMetadata
        assetData.blobUrls['metadata.json'] = url
        await this.saveMigrationData()

        return this.loadAsset(assetId)
      }
    } catch (error) {
      console.error(`Error updating asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Save migration data back to disk
   */
  async saveMigrationData() {
    if (!this.migrationLogPath) {
      throw new Error('Migration log path not configured')
    }

    await fs.writeFile(
      this.migrationLogPath,
      JSON.stringify(this.migrationData, null, 2)
    )
  }

  /**
   * Upload a new asset to blob storage
   */
  async uploadAsset(assetId, files) {
    const assetData = {
      files: [],
      metadata: null,
      blobUrls: {}
    }

    for (const { relativePath, buffer, contentType } of files) {
      const blobPath = `assets/${assetId}/${relativePath}`

      const { url } = await put(blobPath, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType,
        token: process.env.BLOB_READ_WRITE_TOKEN
      })

      assetData.files.push({
        relativePath,
        blobPath,
        size: buffer.length
      })

      assetData.blobUrls[relativePath] = url

      // Parse metadata if it's the metadata.json file
      if (relativePath === 'metadata.json') {
        assetData.metadata = JSON.parse(buffer.toString('utf-8'))
      }
    }

    // Add to migration data
    await this.loadMigrationData()
    this.migrationData.assets[assetId] = assetData
    await this.saveMigrationData()

    return assetData
  }

  /**
   * Verify blob references and detect broken links
   * Returns list of broken references
   */
  async verifyBlobReferences() {
    await this.loadMigrationData()
    const brokenRefs = []

    for (const [assetId, assetData] of Object.entries(this.migrationData.assets || {})) {
      for (const [path, url] of Object.entries(assetData.blobUrls || {})) {
        try {
          // HEAD request to check if blob still exists
          const response = await fetch(url, { method: 'HEAD' })
          if (!response.ok) {
            brokenRefs.push({ assetId, path, url, status: response.status })
          }
        } catch (error) {
          brokenRefs.push({ assetId, path, url, error: error.message })
        }
      }
    }

    return brokenRefs
  }
}
