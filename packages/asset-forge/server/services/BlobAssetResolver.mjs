/**
 * Blob Asset Resolver
 * Resolves asset:// protocol URLs to Vercel Blob URLs
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '../..')

export class BlobAssetResolver {
  constructor() {
    this.modelsMap = null
    this.manifestsMap = null
    this.modelsLogPath = path.join(ROOT_DIR, 'data', 'blob-server-models-migration.json')
    this.manifestsLogPath = path.join(ROOT_DIR, 'data', 'blob-manifests-migration.json')
  }

  /**
   * Load migration data
   */
  async loadMigrationData() {
    if (this.modelsMap && this.manifestsMap) {
      return
    }

    try {
      // Load models migration data
      const modelsData = await fs.readFile(this.modelsLogPath, 'utf-8')
      const modelsMigration = JSON.parse(modelsData)

      // Build models URL map
      this.modelsMap = new Map()
      for (const [modelId, modelData] of Object.entries(modelsMigration.models)) {
        for (const [relativePath, url] of Object.entries(modelData.blobUrls)) {
          // Map both with and without trailing path
          this.modelsMap.set(`models/${modelId}/${relativePath}`, url)
          // Also support just the model ID for direct access
          if (relativePath.endsWith('.glb')) {
            this.modelsMap.set(`models/${modelId}/${modelId}.glb`, url)
          }
        }
      }

      // Load manifests migration data
      const manifestsData = await fs.readFile(this.manifestsLogPath, 'utf-8')
      const manifestsMigration = JSON.parse(manifestsData)

      // Build manifests URL map
      this.manifestsMap = new Map()
      for (const [filename, manifestData] of Object.entries(manifestsMigration.manifests)) {
        this.manifestsMap.set(`manifests/${filename}`, manifestData.url)
        // Also support without manifests/ prefix
        this.manifestsMap.set(filename, manifestData.url)
      }

      console.log(`✓ Loaded ${this.modelsMap.size} model URLs and ${this.manifestsMap.size} manifest URLs`)
    } catch (error) {
      console.error('Failed to load migration data:', error.message)
      throw new Error(`Blob asset resolver initialization failed: ${error.message}`)
    }
  }

  /**
   * Resolve asset:// protocol URL to blob URL
   * @param {string} assetUrl - URL with asset:// protocol (e.g., "asset://models/sword-bronze/sword-bronze.glb")
   * @returns {string} - Blob URL
   */
  async resolveAssetUrl(assetUrl) {
    await this.loadMigrationData()

    // Remove asset:// protocol
    const cleanPath = assetUrl.replace(/^asset:\/\//, '')

    // Check models map
    const modelUrl = this.modelsMap.get(cleanPath)
    if (modelUrl) {
      return modelUrl
    }

    // Check manifests map
    const manifestUrl = this.manifestsMap.get(cleanPath)
    if (manifestUrl) {
      return manifestUrl
    }

    throw new Error(`Asset not found in blob storage: ${assetUrl}`)
  }

  /**
   * Get blob URL for a model
   */
  async getModelUrl(modelId, filename = null) {
    await this.loadMigrationData()

    if (filename) {
      const url = this.modelsMap.get(`models/${modelId}/${filename}`)
      if (url) return url
    }

    // Try common patterns
    const patterns = [
      `models/${modelId}/${modelId}.glb`,
      `models/${modelId}/${modelId}_rigged.glb`,
      `models/${modelId}/model.glb`
    ]

    for (const pattern of patterns) {
      const url = this.modelsMap.get(pattern)
      if (url) return url
    }

    throw new Error(`Model not found: ${modelId}`)
  }

  /**
   * Get blob URL for a manifest
   */
  async getManifestUrl(manifestType) {
    await this.loadMigrationData()

    const filename = `${manifestType}.json`
    const url = this.manifestsMap.get(filename)

    if (!url) {
      throw new Error(`Manifest not found: ${manifestType}`)
    }

    return url
  }

  /**
   * Check if blob storage is available
   */
  async isAvailable() {
    try {
      await this.loadMigrationData()
      return true
    } catch {
      return false
    }
  }
}

// Singleton instance
export const blobAssetResolver = new BlobAssetResolver()
