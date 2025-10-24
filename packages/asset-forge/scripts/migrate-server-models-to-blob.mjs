#!/usr/bin/env node
/**
 * Migrate server/world/assets/models to Vercel Blob Storage
 * These are the models referenced by game manifests
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { put } from '@vercel/blob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

const MODELS_DIR = path.join(ROOT_DIR, '..', 'server', 'world', 'assets', 'models')
const DATA_DIR = path.join(ROOT_DIR, 'data')
const MIGRATION_LOG_PATH = path.join(DATA_DIR, 'blob-server-models-migration.json')

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

async function main() {
  console.log('🚀 Starting Server Models Blob Migration\n')

  // Validate blob token
  if (!BLOB_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in environment')
    console.error('   Add it to your .env file or pass it as an environment variable')
    process.exit(1)
  }

  // Create data directory if it doesn't exist
  await fs.mkdir(DATA_DIR, { recursive: true })

  // Scan models directory
  console.log('📊 Scanning models directory...')
  const modelDirs = await fs.readdir(MODELS_DIR)
  const models = modelDirs.filter(name => !name.startsWith('.'))

  console.log(`✓ Found ${models.length} model directories\n`)

  // Migration data structure
  const migrationData = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalModels: models.length,
    totalFiles: 0,
    totalSize: 0,
    models: {}
  }

  // Process each model
  for (const modelId of models) {
    const modelDir = path.join(MODELS_DIR, modelId)
    const stat = await fs.stat(modelDir)

    if (!stat.isDirectory()) continue

    console.log(`📦 Processing: ${modelId}`)

    const modelData = {
      files: [],
      metadata: null,
      blobUrls: {}
    }

    // Get all files in model directory (including subdirectories)
    const files = await getAllFiles(modelDir)

    for (const filePath of files) {
      const relativePath = path.relative(modelDir, filePath)
      const fileBuffer = await fs.readFile(filePath)
      const fileSize = fileBuffer.length

      // Determine content type
      const contentType = getContentType(filePath)

      // Upload to blob (using "models/" prefix to match asset:// protocol)
      const blobPath = `models/${modelId}/${relativePath}`
      console.log(`  ↗ Uploading: ${relativePath} (${formatBytes(fileSize)})`)

      try {
        const { url } = await put(blobPath, fileBuffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType,
          token: BLOB_TOKEN
        })

        modelData.files.push({
          relativePath,
          blobPath,
          size: fileSize
        })

        modelData.blobUrls[relativePath] = url

        // Parse metadata if it's the metadata.json file
        if (relativePath === 'metadata.json') {
          modelData.metadata = JSON.parse(fileBuffer.toString('utf-8'))
        }

        migrationData.totalFiles++
        migrationData.totalSize += fileSize

        console.log(`  ✓ Uploaded: ${url}`)
      } catch (error) {
        console.error(`  ❌ Failed to upload ${relativePath}: ${error.message}`)
        throw error
      }
    }

    migrationData.models[modelId] = modelData
    console.log(`✓ Completed: ${modelId}\n`)
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
  console.log(`   Models: ${migrationData.totalModels}`)
  console.log(`   Files: ${migrationData.totalFiles}`)
  console.log(`   Size: ${formatBytes(migrationData.totalSize)}`)
  console.log(`   Duration: ${calculateDuration(migrationData.startedAt, migrationData.completedAt)}`)
  console.log('\n📝 Next steps:')
  console.log('   1. Update server to use blob URLs for model serving')
  console.log('   2. Test manifest viewer with blob-stored models')
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
