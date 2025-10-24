#!/usr/bin/env node
/**
 * Rollback Script: Download Assets from Vercel Blob Storage
 *
 * This script downloads all assets from Vercel Blob storage back to the
 * local gdd-assets/ directory, reversing the migration.
 *
 * Usage:
 *   node scripts/rollback-from-blob.mjs [--dry-run] [--force]
 *
 * Options:
 *   --dry-run    Simulate rollback without downloading
 *   --force      Overwrite existing local files
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')
const ASSETS_DIR = path.join(ROOT_DIR, 'gdd-assets')
const MIGRATION_LOG = path.join(ROOT_DIR, 'data', 'blob-migration.json')
const BACKUP_DIR = path.join(ROOT_DIR, 'data', 'blob-backup')

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')

class BlobRollback {
  constructor() {
    this.stats = {
      totalAssets: 0,
      totalFiles: 0,
      totalBytes: 0,
      downloadedFiles: 0,
      downloadedBytes: 0,
      skippedFiles: 0,
      failedFiles: 0,
      errors: []
    }
    this.migrationData = null
  }

  async loadMigrationData() {
    console.log(chalk.blue('📊 Loading migration data...'))

    try {
      const data = await fs.readFile(MIGRATION_LOG, 'utf-8')
      this.migrationData = JSON.parse(data)

      // Calculate totals
      for (const [assetId, assetData] of Object.entries(this.migrationData.assets)) {
        this.stats.totalAssets++
        this.stats.totalFiles += assetData.files.length
        this.stats.totalBytes += assetData.files.reduce((sum, f) => sum + f.size, 0)
      }

      console.log(chalk.green(`✓ Found ${this.stats.totalAssets} assets to restore`))
      console.log(chalk.green(`✓ Total files: ${this.stats.totalFiles}`))
      console.log(chalk.green(`✓ Total size: ${this.formatBytes(this.stats.totalBytes)}`))
    } catch (error) {
      throw new Error(`Failed to load migration data: ${error.message}`)
    }
  }

  async createBackup() {
    if (DRY_RUN) return

    console.log(chalk.blue('\n💾 Creating backup of current assets...'))

    try {
      // Check if assets directory exists
      try {
        await fs.access(ASSETS_DIR)

        // Create backup directory
        await fs.mkdir(BACKUP_DIR, { recursive: true })

        // Backup timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const backupPath = path.join(BACKUP_DIR, `assets-backup-${timestamp}`)

        // Copy entire assets directory
        await this.copyDirectory(ASSETS_DIR, backupPath)

        console.log(chalk.green(`✓ Backup created: ${backupPath}`))
      } catch {
        console.log(chalk.gray('  No existing assets to backup'))
      }
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Backup failed: ${error.message}`))
    }
  }

  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  async downloadAsset(assetId, assetData) {
    console.log(chalk.blue(`\n📦 Restoring: ${assetId}`))

    for (const file of assetData.files) {
      try {
        const blobUrl = assetData.blobUrls[file.relativePath]
        if (!blobUrl) {
          console.log(chalk.yellow(`  ⚠️  No blob URL for ${file.relativePath}`))
          this.stats.skippedFiles++
          continue
        }

        const localPath = path.join(ASSETS_DIR, assetId, file.relativePath)
        const localDir = path.dirname(localPath)

        if (DRY_RUN) {
          console.log(chalk.gray(`  [DRY-RUN] Would download: ${file.relativePath}`))
          this.stats.downloadedFiles++
          this.stats.downloadedBytes += file.size
          continue
        }

        // Check if file exists
        if (!FORCE) {
          try {
            await fs.access(localPath)
            console.log(chalk.gray(`  ⊘ Skipped (exists): ${file.relativePath}`))
            this.stats.skippedFiles++
            continue
          } catch {
            // File doesn't exist, continue with download
          }
        }

        // Create directory
        await fs.mkdir(localDir, { recursive: true })

        // Download file from blob
        const response = await fetch(blobUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Write to disk
        await fs.writeFile(localPath, buffer)

        console.log(chalk.green(`  ✓ ${file.relativePath} (${this.formatBytes(file.size)})`))

        this.stats.downloadedFiles++
        this.stats.downloadedBytes += file.size

      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to download ${file.relativePath}: ${error.message}`))
        this.stats.failedFiles++
        this.stats.errors.push({
          assetId,
          file: file.relativePath,
          error: error.message
        })
      }
    }
  }

  async restoreAllAssets() {
    console.log(chalk.blue('\n🔄 Starting rollback...\n'))

    for (const [assetId, assetData] of Object.entries(this.migrationData.assets)) {
      await this.downloadAsset(assetId, assetData)
    }
  }

  printSummary() {
    console.log(chalk.blue('\n' + '='.repeat(60)))
    console.log(chalk.bold('📊 Rollback Summary'))
    console.log(chalk.blue('='.repeat(60)))

    console.log(`\n${chalk.bold('Assets:')} ${this.stats.totalAssets}`)
    console.log(`${chalk.bold('Files:')} ${this.stats.downloadedFiles}/${this.stats.totalFiles}`)
    console.log(`${chalk.bold('Size:')} ${this.formatBytes(this.stats.downloadedBytes)}/${this.formatBytes(this.stats.totalBytes)}`)

    if (this.stats.skippedFiles > 0) {
      console.log(chalk.yellow(`${chalk.bold('Skipped:')} ${this.stats.skippedFiles} files`))
    }

    if (this.stats.failedFiles > 0) {
      console.log(chalk.red(`${chalk.bold('Failed:')} ${this.stats.failedFiles} files`))
    }

    if (this.stats.errors.length > 0) {
      console.log(chalk.red('\n⚠️  Errors:'))
      this.stats.errors.forEach(err => {
        console.log(chalk.red(`  - ${err.assetId}/${err.file}: ${err.error}`))
      })
    }

    if (DRY_RUN) {
      console.log(chalk.yellow('\n⚠️  DRY RUN - No files were actually downloaded'))
      console.log(chalk.yellow('Run without --dry-run to perform actual rollback'))
    } else {
      console.log(chalk.green('\n✅ Rollback completed successfully!'))
      console.log(chalk.blue('\nNext steps:'))
      console.log(chalk.blue('  1. Set USE_BLOB_STORAGE=false in your .env file'))
      console.log(chalk.blue('  2. Restart your server to use local filesystem'))
    }

    console.log(chalk.blue('\n' + '='.repeat(60) + '\n'))
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🔙 Vercel Blob Rollback Script\n'))

  if (DRY_RUN) {
    console.log(chalk.yellow('⚠️  Running in DRY-RUN mode - no files will be downloaded\n'))
  }

  const rollback = new BlobRollback()

  try {
    // Load migration data
    await rollback.loadMigrationData()

    // Create backup of current state
    await rollback.createBackup()

    // Confirm before proceeding
    if (!DRY_RUN) {
      console.log(chalk.yellow('\n⚠️  This will download all assets from Vercel Blob storage.'))
      console.log(chalk.yellow(`Total size: ${rollback.formatBytes(rollback.stats.totalBytes)}`))

      if (FORCE) {
        console.log(chalk.yellow('⚠️  FORCE mode enabled - will overwrite existing files'))
      }

      console.log(chalk.yellow('Press Ctrl+C to cancel, or Enter to continue...'))

      // Wait for user confirmation
      await new Promise(resolve => {
        process.stdin.once('data', resolve)
      })
    }

    // Restore all assets
    await rollback.restoreAllAssets()

    // Print summary
    rollback.printSummary()

    process.exit(0)
  } catch (error) {
    console.error(chalk.red('\n❌ Rollback failed:'), error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
