#!/usr/bin/env node
/**
 * Smart Asset Sync Script with Hash Checking
 * Only downloads/uploads files that have changed
 * Saves bandwidth and time by comparing file hashes
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const ASSETS_REPO = process.env.ASSETS_REPO || 'https://github.com/HyperscapeAI/assets.git'
const ASSETS_DIR = path.join(rootDir, 'world/assets')
const ASSETS_REPO_DIR = path.join(rootDir, '.assets-repo')
const HASH_CACHE_FILE = path.join(rootDir, '.asset-hashes.json')

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
    console.warn('⚠️  Failed to load hash cache:', error.message)
  }
  return {}
}

// Save hash cache
async function saveHashCache(cache) {
  try {
    await fs.writeJson(HASH_CACHE_FILE, cache, { spaces: 2 })
  } catch (error) {
    console.error('❌ Failed to save hash cache:', error.message)
  }
}

// Get all files in a directory recursively
async function getAllFiles(dir, fileList = []) {
  const files = await fs.readdir(dir)
  
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = await fs.stat(filePath)
    
    if (stat.isDirectory()) {
      // Skip git metadata and system files
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

async function syncFromGit() {
  console.log('🔄 Smart sync from repository...')
  console.log(`   Repo: ${ASSETS_REPO}`)
  console.log(`   Target: ${ASSETS_DIR}`)

  // Clone or pull the assets repository
  if (await fs.pathExists(ASSETS_REPO_DIR)) {
    console.log('📥 Pulling latest changes...')
    execSync('git pull', { cwd: ASSETS_REPO_DIR, stdio: 'inherit' })
  } else {
    console.log('📦 Cloning assets repository...')
    execSync(`git clone ${ASSETS_REPO} ${ASSETS_REPO_DIR}`, { stdio: 'inherit' })
  }

  // Load hash cache
  const hashCache = await loadHashCache()
  
  // Get all files in repo
  const repoFiles = await getAllFiles(ASSETS_REPO_DIR)
  
  let copied = 0
  let skipped = 0
  let failed = 0
  
  console.log(`\n📊 Checking ${repoFiles.length} files...`)
  
  for (const repoFile of repoFiles) {
    const relativePath = path.relative(ASSETS_REPO_DIR, repoFile)
    const targetFile = path.join(ASSETS_DIR, relativePath)
    
    try {
      // Calculate hash of source file
      const sourceHash = await hashFile(repoFile)
      
      // Check if target exists and has same hash
      if (await fs.pathExists(targetFile)) {
        const cachedHash = hashCache[relativePath]
        
        if (cachedHash === sourceHash) {
          skipped++
          if (skipped % 100 === 0) {
            console.log(`   Skipped ${skipped} unchanged files...`)
          }
          continue
        }
      }
      
      // File is new or changed - copy it
      await fs.ensureDir(path.dirname(targetFile))
      await fs.copy(repoFile, targetFile, { overwrite: true })
      
      // Update hash cache
      hashCache[relativePath] = sourceHash
      
      copied++
      console.log(`   ✅ ${relativePath}`)
    } catch (error) {
      failed++
      console.error(`   ❌ Failed to copy ${relativePath}:`, error.message)
    }
  }
  
  // Save updated hash cache
  await saveHashCache(hashCache)
  
  console.log(`\n📊 Sync complete:`)
  console.log(`   ✅ Copied: ${copied} files`)
  console.log(`   ⏭️  Skipped: ${skipped} files (unchanged)`)
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed} files`)
  }
  console.log(`\n🎉 Assets synced successfully!`)
}

async function syncToR2() {
  console.log('☁️  Smart sync to Cloudflare R2...')
  
  const BUCKET_NAME = process.env.R2_BUCKET || process.env.S3_BUCKET
  const ACCOUNT_ID = process.env.R2_ACCOUNT_ID

  if (!BUCKET_NAME) {
    console.error('❌ R2_BUCKET environment variable not set')
    process.exit(1)
  }

  if (!ACCOUNT_ID) {
    console.error('❌ R2_ACCOUNT_ID environment variable not set')
    process.exit(1)
  }

  console.log(`   Bucket: ${BUCKET_NAME}`)
  console.log(`   Account: ${ACCOUNT_ID}`)

  // Use wrangler for R2 uploads (supports resume, parallel uploads, etc.)
  const command = `wrangler r2 object put ${BUCKET_NAME} --file={} --key={} --content-type={}`

  // Get all local files
  const localFiles = await getAllFiles(ASSETS_DIR)
  const hashCache = await loadHashCache()
  
  let uploaded = 0
  let skipped = 0
  
  console.log(`\n📊 Checking ${localFiles.length} files...`)
  
  for (const localFile of localFiles) {
    const relativePath = path.relative(ASSETS_DIR, localFile)
    const r2Key = relativePath.replace(/\\/g, '/') // Ensure forward slashes
    
    try {
      // Calculate local file hash
      const localHash = await hashFile(localFile)
      
      // Check R2 file metadata for hash
      const checkCmd = `wrangler r2 object get ${BUCKET_NAME}/${r2Key} --remote-only 2>/dev/null || echo "NOT_FOUND"`
      let needsUpload = true
      
      try {
        const result = execSync(checkCmd, { encoding: 'utf-8' })
        if (!result.includes('NOT_FOUND')) {
          // File exists in R2 - check if hash matches
          const cachedHash = hashCache[`r2:${relativePath}`]
          if (cachedHash === localHash) {
            needsUpload = false
            skipped++
            if (skipped % 100 === 0) {
              console.log(`   Skipped ${skipped} unchanged files...`)
            }
          }
        }
      } catch {
        // File doesn't exist in R2
      }
      
      if (needsUpload) {
        // Determine content type
        let contentType = 'application/octet-stream'
        if (relativePath.endsWith('.mp3')) contentType = 'audio/mpeg'
        else if (relativePath.endsWith('.glb')) contentType = 'model/gltf-binary'
        else if (relativePath.endsWith('.json')) contentType = 'application/json'
        else if (relativePath.endsWith('.png')) contentType = 'image/png'
        else if (relativePath.endsWith('.jpg') || relativePath.endsWith('.jpeg')) contentType = 'image/jpeg'
        else if (relativePath.endsWith('.vrm')) contentType = 'model/vrm'
        
        // Upload to R2
        execSync(
          `wrangler r2 object put ${BUCKET_NAME}/${r2Key} --file="${localFile}" --content-type="${contentType}"`,
          { stdio: 'inherit' }
        )
        
        // Update hash cache
        hashCache[`r2:${relativePath}`] = localHash
        
        uploaded++
        console.log(`   ✅ Uploaded: ${relativePath}`)
      }
    } catch (error) {
      console.error(`   ❌ Failed to upload ${relativePath}:`, error.message)
    }
  }
  
  // Save updated cache
  await saveHashCache(hashCache)
  
  console.log(`\n📊 Upload complete:`)
  console.log(`   ✅ Uploaded: ${uploaded} files`)
  console.log(`   ⏭️  Skipped: ${skipped} files (unchanged)`)
  console.log(`\n🎉 Assets deployed to R2!`)
  console.log(`\n📡 CDN URL: ${process.env.PUBLIC_CDN_URL || `https://pub-${ACCOUNT_ID}.r2.dev`}`)
}

async function verifySync() {
  console.log('🔍 Verifying asset sync...')
  
  const localFiles = await getAllFiles(ASSETS_DIR)
  const hashCache = await loadHashCache()
  
  let verified = 0
  let mismatches = 0
  
  for (const localFile of localFiles) {
    const relativePath = path.relative(ASSETS_DIR, localFile)
    const localHash = await hashFile(localFile)
    const cachedHash = hashCache[relativePath]
    
    if (cachedHash === localHash) {
      verified++
    } else {
      mismatches++
      console.log(`   ⚠️  Hash mismatch: ${relativePath}`)
    }
  }
  
  console.log(`\n📊 Verification:`)
  console.log(`   ✅ Verified: ${verified} files`)
  console.log(`   ⚠️  Mismatches: ${mismatches} files`)
  
  if (mismatches > 0) {
    console.log(`\n💡 Run 'bun run assets:sync' to update mismatched files`)
  } else {
    console.log(`\n🎉 All assets are up to date!`)
  }
}

async function main() {
  const command = process.argv[2] || 'from-git'

  switch (command) {
    case 'from-git':
      await syncFromGit()
      break
    
    case 'to-r2':
    case 'to-s3':
      await syncToR2()
      break
    
    case 'both':
      await syncFromGit()
      await syncToR2()
      break
    
    case 'verify':
      await verifySync()
      break
    
    default:
      console.log('Usage:')
      console.log('  bun scripts/sync-assets-smart.mjs [command]')
      console.log('')
      console.log('Commands:')
      console.log('  from-git  - Smart sync from Git (only changed files)')
      console.log('  to-r2     - Smart upload to R2 (only changed files)')
      console.log('  both      - Sync from Git, then upload to R2')
      console.log('  verify    - Verify local files match cache')
      console.log('')
      console.log('Environment variables:')
      console.log('  ASSETS_REPO     - Git repository URL')
      console.log('  R2_BUCKET       - R2 bucket name')
      console.log('  R2_ACCOUNT_ID   - Cloudflare account ID')
      console.log('  R2_ACCESS_KEY_ID      - R2 access key')
      console.log('  R2_SECRET_ACCESS_KEY  - R2 secret key')
      process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Sync failed:', error)
  process.exit(1)
})

