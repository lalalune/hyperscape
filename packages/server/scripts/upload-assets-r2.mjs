#!/usr/bin/env node
/**
 * Upload Assets to Cloudflare R2
 *
 * Uploads assets from world/assets/ to R2 CDN for production.
 * Uses hash caching to only upload changed files.
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const ASSETS_DIR = path.join(rootDir, 'world/assets')
const HASH_CACHE_FILE = path.join(rootDir, '.r2-upload-hashes.json')

// Calculate SHA-256 hash of a file
async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

// Load hash cache
async function loadHashCache() {
  try {
    if (await fs.pathExists(HASH_CACHE_FILE)) {
      return await fs.readJson(HASH_CACHE_FILE)
    }
  } catch (error) {
    console.warn('Warning: Failed to load hash cache:', error.message)
  }
  return {}
}

// Save hash cache
async function saveHashCache(cache) {
  try {
    await fs.writeJson(HASH_CACHE_FILE, cache, { spaces: 2 })
  } catch (error) {
    console.error('Failed to save hash cache:', error.message)
  }
}

// Get all files in a directory recursively
async function getAllFiles(dir, fileList = []) {
  const files = await fs.readdir(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = await fs.stat(filePath)

    if (stat.isDirectory()) {
      if (file === '.git' || file === 'node_modules' || file === '.DS_Store') {
        continue
      }
      await getAllFiles(filePath, fileList)
    } else {
      fileList.push(filePath)
    }
  }

  return fileList
}

// Get content type for file
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const types = {
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.vrm': 'model/vrm',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  }
  return types[ext] || 'application/octet-stream'
}

async function uploadToR2() {
  console.log('Uploading assets to Cloudflare R2...\n')

  const BUCKET_NAME = process.env.R2_BUCKET
  const ACCOUNT_ID = process.env.R2_ACCOUNT_ID

  if (!BUCKET_NAME) {
    console.error('Error: R2_BUCKET environment variable not set')
    console.log('\nSet these environment variables:')
    console.log('  R2_BUCKET=your-bucket-name')
    console.log('  R2_ACCOUNT_ID=your-account-id')
    process.exit(1)
  }

  if (!ACCOUNT_ID) {
    console.error('Error: R2_ACCOUNT_ID environment variable not set')
    process.exit(1)
  }

  console.log(`Bucket: ${BUCKET_NAME}`)
  console.log(`Source: ${ASSETS_DIR}\n`)

  // Check assets directory exists
  if (!await fs.pathExists(ASSETS_DIR)) {
    console.error(`Error: Assets directory not found: ${ASSETS_DIR}`)
    console.log('Run "bun install" to download assets first.')
    process.exit(1)
  }

  const localFiles = await getAllFiles(ASSETS_DIR)
  const hashCache = await loadHashCache()

  let uploaded = 0
  let skipped = 0
  let failed = 0

  console.log(`Checking ${localFiles.length} files...\n`)

  for (const localFile of localFiles) {
    const relativePath = path.relative(ASSETS_DIR, localFile)
    const r2Key = relativePath.replace(/\\/g, '/') // Forward slashes for R2

    try {
      const localHash = await hashFile(localFile)
      const cachedHash = hashCache[relativePath]

      // Skip if hash matches (already uploaded)
      if (cachedHash === localHash) {
        skipped++
        continue
      }

      const contentType = getContentType(localFile)

      execSync(
        `wrangler r2 object put ${BUCKET_NAME}/${r2Key} --file="${localFile}" --content-type="${contentType}"`,
        { stdio: 'pipe' }
      )

      hashCache[relativePath] = localHash
      uploaded++
      console.log(`  Uploaded: ${relativePath}`)

    } catch (error) {
      failed++
      console.error(`  Failed: ${relativePath} - ${error.message}`)
    }
  }

  await saveHashCache(hashCache)

  console.log(`\nUpload complete:`)
  console.log(`  Uploaded: ${uploaded} files`)
  console.log(`  Skipped: ${skipped} files (unchanged)`)
  if (failed > 0) {
    console.log(`  Failed: ${failed} files`)
  }

  console.log(`\nCDN URL: ${process.env.PUBLIC_CDN_URL || `https://pub-${ACCOUNT_ID}.r2.dev`}`)
}

async function main() {
  const command = process.argv[2]

  if (command === '--help' || command === '-h') {
    console.log('Upload assets to Cloudflare R2\n')
    console.log('Usage: bun scripts/upload-assets-r2.mjs\n')
    console.log('Environment variables:')
    console.log('  R2_BUCKET       - R2 bucket name (required)')
    console.log('  R2_ACCOUNT_ID   - Cloudflare account ID (required)')
    console.log('  PUBLIC_CDN_URL  - CDN URL for display (optional)')
    process.exit(0)
  }

  await uploadToR2()
}

main().catch(error => {
  console.error('Upload failed:', error)
  process.exit(1)
})
