/**
 * Sync Assets to Tigris S3
 *
 * Uploads all assets from local gdd-assets/ directory to Tigris S3 bucket.
 * This script syncs:
 * - 3D models (GLB, FBX, OBJ files)
 * - Metadata files (JSON)
 * - Concept art images (PNG, JPG)
 * - Animations
 * - Sprites
 *
 * Usage:
 *   node scripts/sync-to-tigris.mjs [options]
 *
 * Options:
 *   --dry-run     Show what would be uploaded without actually uploading
 *   --force       Upload all files even if they already exist
 *   --prefix      Only sync files matching prefix (e.g., "models/sword-")
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isForce = args.includes('--force')
const prefixArg = args.find(arg => arg.startsWith('--prefix='))
const filterPrefix = prefixArg ? prefixArg.split('=')[1] : null

// Configuration
const config = {
  bucket: process.env.BUCKET_NAME || 'hyperscape-assets',
  endpoint: process.env.AWS_ENDPOINT_URL_S3 || 'https://fly.storage.tigris.dev',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  localPath: path.join(__dirname, '../gdd-assets'),
  cdnUrl: process.env.PUBLIC_CDN_URL
}

// Validate configuration
if (!config.accessKeyId || !config.secretAccessKey) {
  console.error('❌ Error: AWS credentials not found')
  console.error('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables')
  console.error('Run: fly storage create')
  process.exit(1)
}

// Initialize S3 client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: config.endpoint,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  },
  forcePathStyle: false
})

// Stats tracking
const stats = {
  scanned: 0,
  uploaded: 0,
  skipped: 0,
  errors: 0,
  totalBytes: 0
}

/**
 * Get content type from file extension
 */
function getContentType(filePath) {
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
    '.wav': 'audio/wav'
  }
  return types[ext] || 'application/octet-stream'
}

/**
 * Get cache control header based on file type
 */
function getCacheControl(filePath) {
  // Immutable assets (models, images) - cache for 1 year
  if (filePath.match(/\.(glb|gltf|png|jpg|jpeg|webp|mp3|wav)$/i)) {
    return 'public, max-age=31536000, immutable'
  }
  // Mutable assets (metadata, manifests) - cache for 5 minutes
  return 'public, max-age=300'
}

/**
 * Calculate MD5 hash of file content
 */
async function getFileHash(filePath) {
  const content = await fs.readFile(filePath)
  return crypto.createHash('md5').update(content).digest('hex')
}

/**
 * Check if file exists in S3 with same content
 */
async function fileExistsInS3(s3Key, localHash) {
  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: s3Key
    })
    const result = await s3Client.send(command)

    // Compare ETag (which is MD5 hash for simple uploads)
    const s3Hash = result.ETag?.replace(/"/g, '')
    return s3Hash === localHash
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false
    }
    throw error
  }
}

/**
 * Upload a single file to S3
 */
async function uploadFile(localPath, s3Key) {
  try {
    const fileContent = await fs.readFile(localPath)
    const stats = await fs.stat(localPath)

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: getContentType(localPath),
      CacheControl: getCacheControl(localPath)
    })

    if (isDryRun) {
      console.log(`  [DRY RUN] Would upload: ${s3Key} (${formatBytes(stats.size)})`)
      return { success: true, bytes: stats.size }
    }

    await s3Client.send(command)

    const url = config.cdnUrl
      ? `${config.cdnUrl}/${s3Key}`
      : `https://${config.bucket}.fly.storage.tigris.dev/${s3Key}`

    console.log(`  ✅ Uploaded: ${s3Key} (${formatBytes(stats.size)})`)
    console.log(`     URL: ${url}`)

    return { success: true, bytes: stats.size }
  } catch (error) {
    console.error(`  ❌ Error uploading ${s3Key}:`, error.message)
    return { success: false, bytes: 0 }
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Recursively scan directory and upload files
 */
async function syncDirectory(localDir, s3Prefix = 'models') {
  try {
    const entries = await fs.readdir(localDir, { withFileTypes: true })

    for (const entry of entries) {
      const localPath = path.join(localDir, entry.name)
      const s3Key = path.join(s3Prefix, entry.name).replace(/\\/g, '/')

      if (entry.isDirectory()) {
        // Recursively sync subdirectory
        await syncDirectory(localPath, s3Key)
      } else if (entry.isFile()) {
        stats.scanned++

        // Apply prefix filter if specified
        if (filterPrefix && !s3Key.startsWith(filterPrefix)) {
          stats.skipped++
          continue
        }

        // Check if file needs uploading
        if (!isForce) {
          const localHash = await getFileHash(localPath)
          const exists = await fileExistsInS3(s3Key, localHash)

          if (exists) {
            console.log(`  ⏭️  Skipped (unchanged): ${s3Key}`)
            stats.skipped++
            continue
          }
        }

        // Upload file
        const result = await uploadFile(localPath, s3Key)
        if (result.success) {
          stats.uploaded++
          stats.totalBytes += result.bytes
        } else {
          stats.errors++
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error scanning directory ${localDir}:`, error.message)
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Asset Forge → Tigris S3 Sync')
  console.log('=' .repeat(60))
  console.log(`Bucket: ${config.bucket}`)
  console.log(`Endpoint: ${config.endpoint}`)
  console.log(`Local path: ${config.localPath}`)
  console.log(`CDN URL: ${config.cdnUrl || '(none - using Tigris direct)'}`)

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files will be uploaded')
  }
  if (isForce) {
    console.log('⚡ FORCE MODE - All files will be uploaded')
  }
  if (filterPrefix) {
    console.log(`🔎 Filter: Only syncing files matching "${filterPrefix}"`)
  }

  console.log('=' .repeat(60))
  console.log()

  const startTime = Date.now()

  // Check if local directory exists
  try {
    await fs.access(config.localPath)
  } catch (error) {
    console.error(`❌ Error: Local directory not found: ${config.localPath}`)
    console.error('Generate some assets first before syncing.')
    process.exit(1)
  }

  // Start syncing
  console.log('📦 Scanning and uploading assets...\n')
  await syncDirectory(config.localPath)

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log()
  console.log('=' .repeat(60))
  console.log('📊 Sync Summary')
  console.log('=' .repeat(60))
  console.log(`Files scanned:  ${stats.scanned}`)
  console.log(`Files uploaded: ${stats.uploaded}`)
  console.log(`Files skipped:  ${stats.skipped}`)
  console.log(`Errors:         ${stats.errors}`)
  console.log(`Total uploaded: ${formatBytes(stats.totalBytes)}`)
  console.log(`Duration:       ${duration}s`)
  console.log('=' .repeat(60))

  if (stats.errors > 0) {
    console.log('⚠️  Some files failed to upload. Check errors above.')
    process.exit(1)
  }

  if (isDryRun) {
    console.log('✅ Dry run completed. Run without --dry-run to actually upload.')
  } else {
    console.log('✅ Sync completed successfully!')
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
