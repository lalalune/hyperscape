#!/usr/bin/env node
/**
 * Migrate all assets from gdd-assets/ to Vercel Blob Storage
 * This script uploads all files and creates a migration log
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { put } from '@vercel/blob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

const ASSETS_DIR = path.join(ROOT_DIR, 'gdd-assets')
const DATA_DIR = path.join(ROOT_DIR, 'data')
const MIGRATION_LOG_PATH = path.join(DATA_DIR, 'blob-migration.json')

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

async function main() {
  console.log('🚀 Starting Vercel Blob Migration\n')

  // Validate blob token
  if (!BLOB_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in environment')
    console.error('   Add it to your .env file or pass it as an environment variable')
    process.exit(1)
  }

  // Create data directory if it doesn't exist
  await fs.mkdir(DATA_DIR, { recursive: true })

  // Scan assets directory
  console.log('📊 Scanning assets directory...')
  const assetDirs = await fs.readdir(ASSETS_DIR)
  const assets = assetDirs.filter(name => name !== '.gitkeep')

  console.log(`✓ Found ${assets.length} assets\n`)

  // Migration data structure
  const migrationData = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalAssets: assets.length,
    totalFiles: 0,
    totalSize: 0,
    assets: {}
  }

  // Process each asset
  for (const assetId of assets) {
    const assetDir = path.join(ASSETS_DIR, assetId)
    const stat = await fs.stat(assetDir)

    if (!stat.isDirectory()) continue

    console.log(`📦 Processing: ${assetId}`)

    const assetData = {
      files: [],
      metadata: null,
      blobUrls: {}
    }

    // Get all files in asset directory (including subdirectories)
    const files = await getAllFiles(assetDir)

    for (const filePath of files) {
      const relativePath = path.relative(assetDir, filePath)
      const fileBuffer = await fs.readFile(filePath)
      const fileSize = fileBuffer.length

      // Determine content type
      const contentType = getContentType(filePath)

      // Upload to blob
      const blobPath = `assets/${assetId}/${relativePath}`
      console.log(`  ↗ Uploading: ${relativePath} (${formatBytes(fileSize)})`)

      try {
        const { url } = await put(blobPath, fileBuffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType,
          token: BLOB_TOKEN
        })

        assetData.files.push({
          relativePath,
          blobPath,
          size: fileSize
        })

        assetData.blobUrls[relativePath] = url

        // Parse metadata if it's the metadata.json file
        if (relativePath === 'metadata.json') {
          assetData.metadata = JSON.parse(fileBuffer.toString('utf-8'))
        }

        migrationData.totalFiles++
        migrationData.totalSize += fileSize

        console.log(`  ✓ Uploaded: ${url}`)
      } catch (error) {
        console.error(`  ❌ Failed to upload ${relativePath}: ${error.message}`)
        throw error
      }
    }

    migrationData.assets[assetId] = assetData
    console.log(`✓ Completed: ${assetId}\n`)
  }

  // Mark migration as complete
  migrationData.completedAt = new Date().toISOString()

  // Save migration log
  console.log('💾 Saving migration log...')
  await fs.writeFile(
    MIGRATION_LOG_PATH,
    JSON.stringify(migrationData, null, 2),
    'utf-8'
  )

  console.log(`✓ Migration log saved to: ${MIGRATION_LOG_PATH}\n`)

  // Summary
  console.log('✅ Migration Complete!')
  console.log(`   Assets: ${migrationData.totalAssets}`)
  console.log(`   Files: ${migrationData.totalFiles}`)
  console.log(`   Size: ${formatBytes(migrationData.totalSize)}`)
  console.log(`   Duration: ${calculateDuration(migrationData.startedAt, migrationData.completedAt)}`)
  console.log('\n📝 Next steps:')
  console.log('   1. Set USE_BLOB_STORAGE=true in your .env file')
  console.log('   2. Restart your server')
  console.log('   3. Test asset loading')
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dir) {
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath)
      files.push(...subFiles)
    } else {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  const contentTypes = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  }

  return contentTypes[ext] || 'application/octet-stream'
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Calculate duration between two ISO timestamps
 */
function calculateDuration(start, end) {
  const durationMs = new Date(end) - new Date(start)
  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

// Run migration
main().catch(error => {
  console.error('\n❌ Migration failed:', error)
  process.exit(1)
})
