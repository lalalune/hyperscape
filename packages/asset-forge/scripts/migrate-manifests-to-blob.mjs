#!/usr/bin/env node
/**
 * Migrate server/world/assets/manifests to Vercel Blob Storage
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { put } from '@vercel/blob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

const MANIFESTS_DIR = path.join(ROOT_DIR, '..', 'server', 'world', 'assets', 'manifests')
const DATA_DIR = path.join(ROOT_DIR, 'data')
const MIGRATION_LOG_PATH = path.join(DATA_DIR, 'blob-manifests-migration.json')

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

async function main() {
  console.log('🚀 Starting Manifests Blob Migration\n')

  if (!BLOB_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found')
    process.exit(1)
  }

  await fs.mkdir(DATA_DIR, { recursive: true })

  console.log('📊 Scanning manifests directory...')
  const files = await fs.readdir(MANIFESTS_DIR)
  const manifestFiles = files.filter(f => f.endsWith('.json'))

  console.log(`✓ Found ${manifestFiles.length} manifest files\n`)

  const migrationData = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalFiles: manifestFiles.length,
    totalSize: 0,
    manifests: {}
  }

  for (const filename of manifestFiles) {
    const filePath = path.join(MANIFESTS_DIR, filename)
    const fileBuffer = await fs.readFile(filePath)
    const fileSize = fileBuffer.length

    console.log(`📄 Uploading: ${filename} (${formatBytes(fileSize)})`)

    const blobPath = `manifests/${filename}`

    try {
      const { url } = await put(blobPath, fileBuffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        token: BLOB_TOKEN
      })

      migrationData.manifests[filename] = {
        blobPath,
        url,
        size: fileSize
      }

      migrationData.totalSize += fileSize

      console.log(`✓ Uploaded: ${url}\n`)
    } catch (error) {
      console.error(`❌ Failed to upload ${filename}: ${error.message}`)
      throw error
    }
  }

  migrationData.completedAt = new Date().toISOString()

  console.log('💾 Saving migration log...')
  await fs.writeFile(
    MIGRATION_LOG_PATH,
    JSON.stringify(migrationData, null, 2),
    'utf-8'
  )

  console.log(`✓ Migration log saved\n`)

  console.log('✅ Migration Complete!')
  console.log(`   Files: ${migrationData.totalFiles}`)
  console.log(`   Size: ${formatBytes(migrationData.totalSize)}`)
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

main().catch(error => {
  console.error('\n❌ Migration failed:', error)
  process.exit(1)
})
