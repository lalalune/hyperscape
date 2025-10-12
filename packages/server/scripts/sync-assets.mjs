#!/usr/bin/env node
/**
 * Asset Sync Script
 * Syncs assets from the HyperscapeAI/assets repository to local world/assets
 * Can also sync to S3/R2 for production deployment
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const ASSETS_REPO = process.env.ASSETS_REPO || 'https://github.com/HyperscapeAI/assets.git'
const ASSETS_DIR = path.join(rootDir, 'world/assets')
const ASSETS_REPO_DIR = path.join(rootDir, '.assets-repo')

async function syncFromGit() {
  console.log('🔄 Syncing assets from repository...')
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

  // Sync assets to world/assets
  console.log('📋 Copying assets...')
  await fs.ensureDir(ASSETS_DIR)
  await fs.copy(ASSETS_REPO_DIR, ASSETS_DIR, {
    overwrite: true,
    filter: (src) => {
      // Skip git metadata
      if (src.includes('.git')) return false
      if (src.includes('node_modules')) return false
      if (src.includes('.DS_Store')) return false
      return true
    }
  })

  console.log('✅ Assets synced successfully!')
}

async function syncToS3() {
  console.log('☁️  Syncing assets to S3/R2...')
  
  const S3_BUCKET = process.env.S3_BUCKET || process.env.R2_BUCKET
  const S3_REGION = process.env.S3_REGION || 'auto'
  const CDN_PREFIX = process.env.CDN_PREFIX || 'world-assets'

  if (!S3_BUCKET) {
    console.error('❌ S3_BUCKET or R2_BUCKET environment variable not set')
    process.exit(1)
  }

  console.log(`   Bucket: ${S3_BUCKET}`)
  console.log(`   Region: ${S3_REGION}`)
  console.log(`   Prefix: ${CDN_PREFIX}`)

  // Use AWS CLI or rclone for S3-compatible storage
  const command = process.env.USE_RCLONE 
    ? `rclone sync ${ASSETS_DIR} ${S3_BUCKET}:${CDN_PREFIX} --progress`
    : `aws s3 sync ${ASSETS_DIR} s3://${S3_BUCKET}/${CDN_PREFIX} --acl public-read --region ${S3_REGION} --delete`

  console.log(`🚀 Running: ${command}`)
  execSync(command, { stdio: 'inherit' })

  console.log('✅ Assets uploaded to S3/R2 successfully!')
  
  // Output CDN URL
  const cdnUrl = process.env.CDN_URL || `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${CDN_PREFIX}`
  console.log(`\n📡 CDN URL: ${cdnUrl}`)
  console.log('   Update your .env with:')
  console.log(`   PUBLIC_CDN_URL=${cdnUrl}`)
}

async function main() {
  const command = process.argv[2] || 'from-git'

  switch (command) {
    case 'from-git':
      await syncFromGit()
      break
    
    case 'to-s3':
    case 'to-r2':
      await syncToS3()
      break
    
    case 'both':
      await syncFromGit()
      await syncToS3()
      break
    
    default:
      console.log('Usage:')
      console.log('  bun scripts/sync-assets.mjs [command]')
      console.log('')
      console.log('Commands:')
      console.log('  from-git  - Sync from Git repository to local (default)')
      console.log('  to-s3     - Upload local assets to S3/R2')
      console.log('  both      - Sync from Git, then upload to S3/R2')
      console.log('')
      console.log('Environment variables:')
      console.log('  ASSETS_REPO  - Git repository URL')
      console.log('  S3_BUCKET    - S3/R2 bucket name')
      console.log('  S3_REGION    - AWS region (default: auto)')
      console.log('  CDN_PREFIX   - Prefix for assets in bucket (default: world-assets)')
      console.log('  CDN_URL      - Custom CDN URL to display')
      console.log('  USE_RCLONE   - Use rclone instead of AWS CLI')
      process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Sync failed:', error)
  process.exit(1)
})

