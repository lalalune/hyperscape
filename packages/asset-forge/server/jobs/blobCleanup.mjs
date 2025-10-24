/**
 * Blob Cleanup Job
 * Detects and removes orphaned blobs from Vercel Blob Storage
 */

import { list, del } from '@vercel/blob'
import { BlobAssetService } from '../services/BlobAssetService.mjs'

export class BlobCleanupJob {
  constructor() {
    this.blobService = new BlobAssetService()
    this.dryRun = false
  }

  /**
   * Detect orphaned blobs that are not tracked in migration data
   */
  async detectOrphanedBlobs() {
    console.log('🔍 Scanning for orphaned blobs...')

    // Get all blobs from Vercel Blob
    const { blobs } = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    console.log(`Found ${blobs.length} total blobs in storage`)

    // Load migration data to get tracked URLs
    await this.blobService.loadMigrationData()
    const migrationData = this.blobService.migrationData

    // Build set of all tracked URLs
    const trackedUrls = new Set()

    for (const assetData of Object.values(migrationData.assets || {})) {
      if (assetData.blobUrls) {
        for (const url of Object.values(assetData.blobUrls)) {
          trackedUrls.add(url)
        }
      }
    }

    console.log(`Found ${trackedUrls.size} tracked blob URLs in migration data`)

    // Find orphans
    const orphans = blobs.filter(blob => !trackedUrls.has(blob.url))

    console.log(`Detected ${orphans.length} orphaned blobs`)

    return { total: blobs.length, tracked: trackedUrls.size, orphans }
  }

  /**
   * Cleanup orphaned blobs older than specified age
   * @param {Object} options - Cleanup options
   * @param {number} options.maxAge - Maximum age in milliseconds (default: 24 hours)
   * @param {boolean} options.dryRun - If true, only report what would be deleted
   */
  async cleanupOrphanedBlobs(options = {}) {
    const { maxAge = 24 * 60 * 60 * 1000, dryRun = false } = options
    this.dryRun = dryRun

    const { orphans } = await this.detectOrphanedBlobs()

    if (orphans.length === 0) {
      console.log('✅ No orphaned blobs found')
      return { deleted: 0, errors: 0, dryRun }
    }

    // Filter by age
    const now = Date.now()
    const oldOrphans = orphans.filter(blob => {
      const age = now - new Date(blob.uploadedAt).getTime()
      return age > maxAge
    })

    console.log(`Found ${oldOrphans.length} orphaned blobs older than ${maxAge}ms`)

    if (dryRun) {
      console.log('🧪 DRY RUN - Would delete:')
      oldOrphans.forEach(blob => {
        const age = Math.floor((now - new Date(blob.uploadedAt).getTime()) / 1000 / 60 / 60)
        console.log(`  - ${blob.pathname} (${age}h old, ${formatBytes(blob.size)})`)
      })
      return { deleted: 0, errors: 0, dryRun: true, wouldDelete: oldOrphans.length }
    }

    // Delete orphaned blobs
    let deleted = 0
    let errors = 0

    for (const blob of oldOrphans) {
      try {
        await del(blob.url, { token: process.env.BLOB_READ_WRITE_TOKEN })
        deleted++
        const age = Math.floor((now - new Date(blob.uploadedAt).getTime()) / 1000 / 60 / 60)
        console.log(`✅ Deleted orphaned blob: ${blob.pathname} (${age}h old, ${formatBytes(blob.size)})`)
      } catch (error) {
        errors++
        console.error(`❌ Failed to delete blob ${blob.pathname}:`, error.message)
      }
    }

    console.log(`🧹 Cleanup complete: ${deleted} deleted, ${errors} errors`)

    return { deleted, errors, dryRun: false }
  }
}

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const job = new BlobCleanupJob()
  const dryRun = process.argv.includes('--dry-run')
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours

  job.cleanupOrphanedBlobs({ maxAge, dryRun })
    .then(result => {
      console.log('Result:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('Cleanup failed:', error)
      process.exit(1)
    })
}
