/**
 * Blob Storage Service
 *
 * Provides unified interface for file storage that works both locally and on Vercel.
 * - In development: Uses local filesystem
 * - In production: Uses Vercel Blob storage
 *
 * Features:
 * - Automatic environment detection
 * - Transparent API for local vs cloud storage
 * - Support for 3D models, images, audio files
 * - Folder-like organization with prefixes
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { put, del, list, head } from '@vercel/blob'
import { createLogger } from '../utils/logger.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logger = createLogger('BlobStorageService')

export class BlobStorageService {
  constructor() {
    // Detect environment - use Blob if token is available
    const hasToken = !!process.env.HYPER_READ_WRITE_TOKEN
    this.isProduction = hasToken || process.env.VERCEL === '1'
    this.localStoragePath = path.join(__dirname, '../../gdd-assets')

    if (this.isProduction && !hasToken) {
      logger.warn('Running in production but HYPER_READ_WRITE_TOKEN not found - falling back to local storage')
      this.isProduction = false
    }

    logger.info('BlobStorageService initialized', {
      mode: this.isProduction ? 'Vercel Blob' : 'Local Filesystem',
      hasToken,
      localPath: this.localStoragePath
    })
  }

  /**
   * Store a file (text, binary, or buffer)
   *
   * @param {string} filePath - Virtual file path (e.g., "assets/sword-001/model.glb")
   * @param {string|Buffer|Blob} content - File content
   * @param {object} options - Additional options
   * @param {string} options.contentType - MIME type
   * @param {boolean} options.access - 'public' or 'private' (default: 'public')
   * @returns {Promise<{url: string, pathname: string}>}
   */
  async put(filePath, content, options = {}) {
    const { contentType, access = 'public' } = options

    if (this.isProduction) {
      // Use Vercel Blob
      logger.info('Storing file in Vercel Blob', { filePath, contentType })

      const result = await put(filePath, content, {
        access,
        contentType,
        addRandomSuffix: false // Keep clean paths
      })

      return {
        url: result.url,
        pathname: result.pathname
      }
    } else {
      // Use local filesystem
      const localPath = path.join(this.localStoragePath, filePath)
      const dir = path.dirname(localPath)

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true })

      // Write file
      if (Buffer.isBuffer(content)) {
        await fs.writeFile(localPath, content)
      } else if (content instanceof Blob) {
        const buffer = Buffer.from(await content.arrayBuffer())
        await fs.writeFile(localPath, buffer)
      } else {
        await fs.writeFile(localPath, content, 'utf-8')
      }

      logger.debug('Stored file locally', { localPath })

      // Return local URL
      return {
        url: `/api/assets/${filePath}`,
        pathname: filePath
      }
    }
  }

  /**
   * Retrieve file metadata (check if exists, get size, etc.)
   *
   * @param {string} filePath - Virtual file path
   * @returns {Promise<{url: string, size: number, uploadedAt: Date}>}
   */
  async head(filePath) {
    if (this.isProduction) {
      const result = await head(filePath)
      return {
        url: result.url,
        size: result.size,
        uploadedAt: result.uploadedAt
      }
    } else {
      const localPath = path.join(this.localStoragePath, filePath)
      const stats = await fs.stat(localPath)

      return {
        url: `/api/assets/${filePath}`,
        size: stats.size,
        uploadedAt: stats.mtime
      }
    }
  }

  /**
   * Delete a file
   *
   * @param {string} filePath - Virtual file path or URL
   */
  async delete(filePath) {
    if (this.isProduction) {
      logger.info('Deleting from Vercel Blob', { filePath })
      await del(filePath)
    } else {
      const localPath = path.join(this.localStoragePath, filePath)
      await fs.unlink(localPath)
      logger.debug('Deleted local file', { localPath })
    }
  }

  /**
   * List files with a prefix (like a folder)
   *
   * @param {string} prefix - Path prefix (e.g., "assets/sword-001/")
   * @param {object} options - List options
   * @returns {Promise<Array<{url: string, pathname: string, size: number}>>}
   */
  async list(prefix, options = {}) {
    if (this.isProduction) {
      const result = await list({ prefix, ...options })
      return result.blobs.map(blob => ({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt
      }))
    } else {
      const localDir = path.join(this.localStoragePath, prefix)

      try {
        const entries = await fs.readdir(localDir, { withFileTypes: true })
        const files = []

        for (const entry of entries) {
          if (entry.isFile()) {
            const filePath = path.join(prefix, entry.name)
            const fullPath = path.join(localDir, entry.name)
            const stats = await fs.stat(fullPath)

            files.push({
              url: `/api/assets/${filePath}`,
              pathname: filePath,
              size: stats.size,
              uploadedAt: stats.mtime
            })
          }
        }

        return files
      } catch (error) {
        if (error.code === 'ENOENT') {
          return [] // Directory doesn't exist
        }
        throw error
      }
    }
  }

  /**
   * Copy a file from one location to another
   *
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   */
  async copy(sourcePath, destPath) {
    if (this.isProduction) {
      // Read from source and write to destination
      const sourceUrl = sourcePath.startsWith('http') ? sourcePath : (await this.head(sourcePath)).url
      const response = await fetch(sourceUrl)
      const content = await response.blob()

      return this.put(destPath, content, {
        contentType: response.headers.get('content-type')
      })
    } else {
      const sourceLocalPath = path.join(this.localStoragePath, sourcePath)
      const destLocalPath = path.join(this.localStoragePath, destPath)
      const destDir = path.dirname(destLocalPath)

      await fs.mkdir(destDir, { recursive: true })
      await fs.copyFile(sourceLocalPath, destLocalPath)

      return {
        url: `/api/assets/${destPath}`,
        pathname: destPath
      }
    }
  }

  /**
   * Delete entire folder (prefix)
   *
   * @param {string} prefix - Folder prefix to delete
   */
  async deleteFolder(prefix) {
    if (this.isProduction) {
      const files = await this.list(prefix)
      await Promise.all(files.map(file => this.delete(file.url)))
      logger.info('Deleted folder from Vercel Blob', { prefix, count: files.length })
    } else {
      const localDir = path.join(this.localStoragePath, prefix)
      await fs.rm(localDir, { recursive: true, force: true })
      logger.debug('Deleted local folder', { localDir })
    }
  }

  /**
   * Check if file exists
   *
   * @param {string} filePath - Virtual file path
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    try {
      await this.head(filePath)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get public URL for a file
   *
   * @param {string} filePath - Virtual file path
   * @returns {Promise<string>}
   */
  async getUrl(filePath) {
    if (this.isProduction) {
      const metadata = await this.head(filePath)
      return metadata.url
    } else {
      return `/api/assets/${filePath}`
    }
  }
}

// Singleton instance
export const blobStorage = new BlobStorageService()
