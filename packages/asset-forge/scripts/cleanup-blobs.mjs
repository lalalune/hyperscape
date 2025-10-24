#!/usr/bin/env node
/**
 * Blob Cleanup CLI Tool
 * Usage:
 *   npm run cleanup-blobs              # Detect orphans only
 *   npm run cleanup-blobs --dry-run    # Show what would be deleted
 *   npm run cleanup-blobs --execute    # Actually delete orphaned blobs
 */

import { config } from 'dotenv'
import { BlobCleanupJob } from '../server/jobs/blobCleanup.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') })

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isExecute = args.includes('--execute')
const maxAgeHours = parseInt(args.find(arg => arg.startsWith('--max-age='))?.split('=')[1] || '24')

console.log('🧹 Blob Cleanup Tool')
console.log('====================')
console.log()

async function main() {
  const job = new BlobCleanupJob()

  // Set migration log path
  job.blobService.migrationLogPath = process.env.MIGRATION_LOG_PATH ||
    path.join(__dirname, '../data/blob-assets.json')

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not set in environment')
    console.error('Please create .env.local with your Vercel Blob token')
    process.exit(1)
  }

  if (isExecute) {
    console.log('⚠️  EXECUTE MODE - Will delete orphaned blobs')
    console.log(`   Max age: ${maxAgeHours} hours`)
    console.log()

    const result = await job.cleanupOrphanedBlobs({
      maxAge: maxAgeHours * 60 * 60 * 1000,
      dryRun: false
    })

    console.log()
    console.log('📊 Cleanup Results:')
    console.log(`   Deleted: ${result.deleted}`)
    console.log(`   Errors: ${result.errors}`)
  } else if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No blobs will be deleted')
    console.log(`   Max age: ${maxAgeHours} hours`)
    console.log()

    const result = await job.cleanupOrphanedBlobs({
      maxAge: maxAgeHours * 60 * 60 * 1000,
      dryRun: true
    })

    console.log()
    console.log('📊 Dry Run Results:')
    console.log(`   Would delete: ${result.wouldDelete || 0} blobs`)
    console.log()
    console.log('To actually delete these blobs, run with --execute flag')
  } else {
    console.log('🔍 DETECT MODE - Only scanning for orphans')
    console.log()

    const result = await job.detectOrphanedBlobs()

    console.log()
    console.log('📊 Detection Results:')
    console.log(`   Total blobs: ${result.total}`)
    console.log(`   Tracked: ${result.tracked}`)
    console.log(`   Orphans: ${result.orphans.length}`)

    if (result.orphans.length > 0) {
      console.log()
      console.log('Orphaned blobs:')
      result.orphans.forEach(blob => {
        const age = Math.floor((Date.now() - new Date(blob.uploadedAt).getTime()) / 1000 / 60 / 60)
        const size = blob.size < 1024 ? blob.size + ' B' :
                    blob.size < 1024 * 1024 ? (blob.size / 1024).toFixed(2) + ' KB' :
                    (blob.size / 1024 / 1024).toFixed(2) + ' MB'
        console.log(`  - ${blob.pathname} (${age}h old, ${size})`)
      })
      console.log()
      console.log('To see what would be deleted, run with --dry-run flag')
      console.log('To actually delete, run with --execute flag')
    }
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})
