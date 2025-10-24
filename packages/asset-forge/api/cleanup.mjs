/**
 * Vercel Cron Endpoint for Blob Cleanup
 * Scheduled job to clean up orphaned blobs
 */

import { BlobCleanupJob } from '../server/jobs/blobCleanup.mjs'

export default async function handler(req, res) {
  // Verify cron secret is configured
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured')
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'CRON_SECRET environment variable is not set'
    })
  }

  // Verify cron secret for security
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const job = new BlobCleanupJob()

    // Set migration log path from environment or default location
    job.blobService.migrationLogPath = process.env.MIGRATION_LOG_PATH ||
      '/tmp/blob-assets.json'

    const result = await job.cleanupOrphanedBlobs({
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      dryRun: false
    })

    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Blob cleanup cron failed:', error)
    return res.status(500).json({
      error: 'Cleanup failed',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

// Export config for Vercel serverless function
export const config = {
  maxDuration: 60,
  memory: 1024
}
