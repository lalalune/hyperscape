/**
 * Tigris S3 Storage Service
 *
 * Provides unified interface for file storage that works both locally and on Tigris Data (S3-compatible).
 * - In development: Uses local filesystem
 * - In production: Uses Tigris Data S3 storage via Fly.io
 *
 * Features:
 * - Automatic environment detection
 * - Transparent API for local vs cloud storage
 * - Support for 3D models, images, audio files, manifests
 * - Folder-like organization with prefixes
 * - S3-compatible with AWS SDK
 * - CDN integration for global asset delivery
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import { createLogger } from '../utils/logger.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logger = createLogger('TigrisStorageService')

export class BlobStorageService {
  constructor() {
    // Detect environment - use Tigris S3 if credentials are available
    const hasCredentials = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.BUCKET_NAME
    )
    this.isProduction = hasCredentials || process.env.FLY_APP_NAME
    this.localStoragePath = path.join(__dirname, '../../gdd-assets')
    this.bucketName = process.env.BUCKET_NAME || 'hyperscape-assets'
    this.cdnUrl = process.env.PUBLIC_CDN_URL

    if (this.isProduction && !hasCredentials) {
      logger.warn('Running in production but Tigris credentials not found - falling back to local storage')
      this.isProduction = false
    }

    // Initialize S3 client for Tigris
    if (this.isProduction) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: process.env.AWS_ENDPOINT_URL_S3 || 'https://fly.storage.tigris.dev',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        forcePathStyle: false
      })
    }

    logger.info('TigrisStorageService initialized', {
      mode: this.isProduction ? 'Tigris S3' : 'Local Filesystem',
      hasCredentials,
      bucketName: this.bucketName,
      cdnUrl: this.cdnUrl,
      localPath: this.localStoragePath
    })
  }

  /**
   * Get content type from file extension
   * @private
   */
  _getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const types = {
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.fbx': 'application/octet-stream',
      '.obj': 'text/plain',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg'
    }
    return types[ext] || 'application/octet-stream'
  }

  /**
   * Store a file (text, binary, or buffer)
   *
   * @param {string} filePath - Virtual file path (e.g., "models/sword-001/sword-001.glb")
   * @param {string|Buffer|Blob} content - File content
   * @param {object} options - Additional options
   * @param {string} options.contentType - MIME type (auto-detected if not provided)
   * @param {string} options.cacheControl - Cache-Control header (default: immutable for models)
   * @returns {Promise<{url: string, pathname: string}>}
   */
  async put(filePath, content, options = {}) {
    const contentType = options.contentType || this._getContentType(filePath)
    const cacheControl = options.cacheControl || (
      filePath.endsWith('.glb') || filePath.endsWith('.png')
        ? 'public, max-age=31536000, immutable'  // 1 year for assets
        : 'public, max-age=300'  // 5 minutes for manifests/metadata
    )

    if (this.isProduction) {
      // Use Tigris S3
      logger.info('Storing file in Tigris S3', { filePath, contentType, bucket: this.bucketName })

      // Convert content to Buffer if needed
      let body = content
      if (content instanceof Blob) {
        body = Buffer.from(await content.arrayBuffer())
      } else if (typeof content === 'string') {
        body = Buffer.from(content, 'utf-8')
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl
      })

      await this.s3Client.send(command)

      // Generate CDN URL
      const url = this.cdnUrl
        ? `${this.cdnUrl}/${filePath}`
        : `https://${this.bucketName}.fly.storage.tigris.dev/${filePath}`

      logger.debug('Stored file in Tigris', { url, key: filePath })

      return {
        url,
        pathname: filePath
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
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: filePath
      })

      const result = await this.s3Client.send(command)

      const url = this.cdnUrl
        ? `${this.cdnUrl}/${filePath}`
        : `https://${this.bucketName}.fly.storage.tigris.dev/${filePath}`

      return {
        url,
        size: result.ContentLength,
        uploadedAt: result.LastModified
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
   * @param {string} filePath - Virtual file path
   */
  async delete(filePath) {
    if (this.isProduction) {
      logger.info('Deleting from Tigris S3', { filePath, bucket: this.bucketName })

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath
      })

      await this.s3Client.send(command)
      logger.debug('Deleted file from Tigris', { key: filePath })
    } else {
      const localPath = path.join(this.localStoragePath, filePath)
      await fs.unlink(localPath)
      logger.debug('Deleted local file', { localPath })
    }
  }

  /**
   * List files with a prefix (like a folder)
   *
   * @param {string} prefix - Path prefix (e.g., "models/sword-001/")
   * @param {object} options - List options
   * @returns {Promise<Array<{url: string, pathname: string, size: number}>>}
   */
  async list(prefix, options = {}) {
    if (this.isProduction) {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: options.limit || 1000
      })

      const result = await this.s3Client.send(command)

      if (!result.Contents) {
        return []
      }

      return result.Contents.map(obj => ({
        url: this.cdnUrl
          ? `${this.cdnUrl}/${obj.Key}`
          : `https://${this.bucketName}.fly.storage.tigris.dev/${obj.Key}`,
        pathname: obj.Key,
        size: obj.Size,
        uploadedAt: obj.LastModified
      }))
    } else {
      const localDir = path.join(this.localStoragePath, prefix)

      try {
        const entries = await fs.readdir(localDir, { withFileTypes: true })
        const files = []

        for (const entry of entries) {
          if (entry.isFile()) {
            const filePath = path.join(prefix, entry.name).replace(/\\/g, '/')
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
      // Use S3 CopyObject command for efficient server-side copy
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourcePath}`,
        Key: destPath
      })

      await this.s3Client.send(command)

      const url = this.cdnUrl
        ? `${this.cdnUrl}/${destPath}`
        : `https://${this.bucketName}.fly.storage.tigris.dev/${destPath}`

      return {
        url,
        pathname: destPath
      }
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
      // Delete in batches to avoid overwhelming S3
      const batchSize = 100
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        await Promise.all(batch.map(file => this.delete(file.pathname)))
      }
      logger.info('Deleted folder from Tigris S3', { prefix, count: files.length })
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
      return this.cdnUrl
        ? `${this.cdnUrl}/${filePath}`
        : `https://${this.bucketName}.fly.storage.tigris.dev/${filePath}`
    } else {
      return `/api/assets/${filePath}`
    }
  }
}

// Singleton instance
export const blobStorage = new BlobStorageService()
