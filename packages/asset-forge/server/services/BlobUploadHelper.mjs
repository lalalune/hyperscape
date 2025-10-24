/**
 * BlobUploadHelper - Helper service for uploading generated assets to Vercel Blob Storage
 *
 * Provides reusable utilities for uploading files from filesystem to blob storage
 * after asset generation completes. Updates migration data automatically.
 *
 * @module BlobUploadHelper
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createLogger } from '../../src/utils/logger.ts'
import { validateImageBuffer, validateModelBuffer, FileValidationError } from '../utils/fileValidation.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../../')
const logger = createLogger('[BlobUploadHelper]')

/**
 * Upload generated asset files to Vercel Blob Storage
 *
 * @param {string} assetId - The asset identifier
 * @param {Object} options - Upload options
 * @param {string[]} [options.filePatterns] - Specific file patterns to upload (e.g., ['*.glb', 'metadata.json'])
 * @param {string} [options.baseDir='gdd-assets'] - Base directory containing assets
 * @param {boolean} [options.skipIfBlobDisabled=true] - Skip upload if USE_BLOB_STORAGE is not true
 * @returns {Promise<Object>} Upload result with blob URLs
 */
export async function uploadGeneratedAssetToBlob(assetId, options = {}) {
  const {
    filePatterns = null,
    baseDir = 'gdd-assets',
    skipIfBlobDisabled = true
  } = options

  // Check if blob storage is enabled
  const useBlobStorage = process.env.USE_BLOB_STORAGE === 'true'
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN

  if (skipIfBlobDisabled && !useBlobStorage) {
    logger.info(`📦 Blob upload skipped for ${assetId} (USE_BLOB_STORAGE not enabled)`)
    return { skipped: true, reason: 'blob_storage_disabled' }
  }

  if (!hasBlobToken) {
    logger.warn(`⚠️  Blob upload skipped for ${assetId} (BLOB_READ_WRITE_TOKEN not set)`)
    return { skipped: true, reason: 'no_blob_token' }
  }

  try {
    logger.info(`📤 Starting blob upload for asset: ${assetId}`)

    // Import BlobAssetService dynamically to avoid circular deps
    const { BlobAssetService } = await import('./BlobAssetService.mjs')
    const blobService = new BlobAssetService()

    const assetDir = path.join(ROOT_DIR, baseDir, assetId)

    // Check if asset directory exists
    try {
      await fs.access(assetDir)
    } catch (error) {
      logger.error(`❌ Asset directory not found: ${assetDir}`)
      return { error: 'asset_directory_not_found', assetId }
    }

    // Collect all files to upload
    const filesToUpload = await collectFilesForUpload(assetDir, filePatterns)

    if (filesToUpload.length === 0) {
      logger.warn(`⚠️  No files found to upload for ${assetId}`)
      return { skipped: true, reason: 'no_files_found' }
    }

    logger.info(`📦 Uploading ${filesToUpload.length} files for ${assetId}`)

    // Prepare file buffers for BlobAssetService
    const fileBuffers = []
    for (const file of filesToUpload) {
      const buffer = await fs.readFile(file.absolutePath)
      const contentType = getContentType(file.relativePath)

      // Validate file before upload
      try {
        await validateFileBuffer(buffer, file.relativePath)
        logger.info(`✅ Validated: ${file.relativePath} (${formatBytes(buffer.length)})`)
      } catch (error) {
        if (error instanceof FileValidationError) {
          logger.warn(`⚠️  Skipping invalid file ${file.relativePath}: ${error.message}`)
          continue // Skip invalid files but don't fail the entire upload
        }
        throw error
      }

      fileBuffers.push({
        relativePath: file.relativePath,
        buffer,
        contentType
      })
    }

    // Upload to blob storage using BlobAssetService
    const uploadResult = await blobService.uploadAsset(assetId, fileBuffers)

    logger.info(`✅ Successfully uploaded ${filesToUpload.length} files to blob for ${assetId}`)
    logger.info(`🔗 Blob URLs:`, Object.keys(uploadResult.blobUrls))

    return {
      success: true,
      assetId,
      filesUploaded: filesToUpload.length,
      blobUrls: uploadResult.blobUrls,
      metadata: uploadResult.metadata
    }

  } catch (error) {
    logger.error(`❌ Error uploading ${assetId} to blob:`, error)
    return {
      error: 'upload_failed',
      assetId,
      message: error.message
    }
  }
}

/**
 * Collect files from asset directory for upload
 *
 * @param {string} assetDir - Asset directory path
 * @param {string[]|null} filePatterns - File patterns to match (null = all files)
 * @returns {Promise<Array>} Array of file objects with paths
 */
async function collectFilesForUpload(assetDir, filePatterns = null) {
  const files = []

  async function scanDirectory(dir, relativePath = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name)
      const entryAbsolutePath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(entryAbsolutePath, entryRelativePath)
      } else {
        // Check if file matches patterns (if specified)
        if (filePatterns === null || matchesPattern(entry.name, filePatterns)) {
          files.push({
            relativePath: entryRelativePath,
            absolutePath: entryAbsolutePath
          })
        }
      }
    }
  }

  await scanDirectory(assetDir)
  return files
}

/**
 * Check if filename matches any of the provided patterns
 *
 * @param {string} filename - File name to check
 * @param {string[]} patterns - Array of glob-like patterns
 * @returns {boolean} True if matches
 */
function matchesPattern(filename, patterns) {
  return patterns.some(pattern => {
    // Simple glob matching: *.glb, metadata.json, etc.
    if (pattern.startsWith('*')) {
      const extension = pattern.slice(1)
      return filename.endsWith(extension)
    }
    return filename === pattern
  })
}

/**
 * Get content type for file based on extension
 *
 * @param {string} filename - File name
 * @returns {string} MIME type
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const contentTypes = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.txt': 'text/plain',
    '.md': 'text/markdown'
  }
  return contentTypes[ext] || 'application/octet-stream'
}

/**
 * Validate file buffer before upload
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - File name
 * @returns {Promise<void>}
 */
async function validateFileBuffer(buffer, filename) {
  const ext = path.extname(filename).toLowerCase()

  // Validate images
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    await validateImageBuffer(buffer)
  }

  // Validate models
  if (ext === '.glb') {
    await validateModelBuffer(buffer)
  }

  // JSON files should be valid JSON
  if (ext === '.json') {
    try {
      JSON.parse(buffer.toString('utf-8'))
    } catch (error) {
      throw new FileValidationError('Invalid JSON file', 'INVALID_JSON')
    }
  }

  // All files should have reasonable size
  const maxSize = 100 * 1024 * 1024 // 100MB
  if (buffer.length > maxSize) {
    throw new FileValidationError(
      `File size (${formatBytes(buffer.length)}) exceeds maximum (${formatBytes(maxSize)})`,
      'FILE_TOO_LARGE'
    )
  }
}

/**
 * Format bytes to human-readable string
 *
 * @param {number} bytes - Byte count
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

export default {
  uploadGeneratedAssetToBlob
}
