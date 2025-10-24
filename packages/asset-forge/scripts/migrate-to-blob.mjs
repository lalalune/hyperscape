#!/usr/bin/env node
/**
 * Migration Script: Upload Assets to Vercel Blob Storage
 *
 * This script migrates all assets from the local gdd-assets/ directory
 * to Vercel Blob storage, preserving directory structure and metadata.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=xxx node scripts/migrate-to-blob.mjs [--dry-run]
 *
 * Options:
 *   --dry-run    Simulate migration without uploading
 *   --force      Overwrite existing blobs
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { put } from '@vercel/blob'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')
const ASSETS_DIR = path.join(ROOT_DIR, 'gdd-assets')
const MIGRATION_LOG = path.join(ROOT_DIR, 'data', 'blob-migration.json')

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')

class BlobMigration {
  constructor() {
    this.stats = {
      totalAssets: 0,
      totalFiles: 0,
      totalBytes: 0,
      uploadedFiles: 0,
      uploadedBytes: 0,
      skippedFiles: 0,
      failedFiles: 0,
      errors: []
    }
    this.migrationData = {
      startedAt: new Date().toISOString(),
      completedAt: null,
      assets: {}
    }
  }

  async validateEnvironment() {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        'BLOB_READ_WRITE_TOKEN environment variable is required.\n' +
        'Get your token from: https://vercel.com/dashboard/stores'
      )
    }
  }

  async scanAssets() {
    console.log(chalk.blue('📊 Scanning assets directory...'))

    const assetDirs = await fs.readdir(ASSETS_DIR)

    for (const assetDir of assetDirs) {
      if (assetDir.startsWith('.') || assetDir.endsWith('.json')) {
        continue
      }

      const assetPath = path.join(ASSETS_DIR, assetDir)
      const stats = await fs.stat(assetPath)

      if (!stats.isDirectory()) continue

      // Scan all files in this asset directory
      const files = await this.scanAssetDirectory(assetPath, assetDir)

      this.stats.totalAssets++
      this.stats.totalFiles += files.length
      this.stats.totalBytes += files.reduce((sum, f) => sum + f.size, 0)

      this.migrationData.assets[assetDir] = {
        files: files,
        metadata: null,
        blobUrls: {}
      }
    }

    console.log(chalk.green(`✓ Found ${this.stats.totalAssets} assets`))
    console.log(chalk.green(`✓ Total files: ${this.stats.totalFiles}`))
    console.log(chalk.green(`✓ Total size: ${this.formatBytes(this.stats.totalBytes)}`))
  }

  async scanAssetDirectory(assetPath, assetId) {
    const files = []

    async function scanRecursive(dir, relativePath = '') {
      const entries = await fs.readdir(dir)

      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const relPath = path.join(relativePath, entry)
        const stats = await fs.stat(fullPath)

        if (stats.isDirectory()) {
          await scanRecursive(fullPath, relPath)
        } else {
          files.push({
            localPath: fullPath,
            relativePath: relPath,
            blobPath: `assets/${assetId}/${relPath}`,
            size: stats.size,
            ext: path.extname(entry)
          })
        }
      }
    }

    await scanRecursive(assetPath)
    return files
  }

  async uploadAsset(assetId, assetData) {
    console.log(chalk.blue(`\n📦 Processing: ${assetId}`))

    for (const file of assetData.files) {
      try {
        // Read file
        const fileBuffer = await fs.readFile(file.localPath)

        if (DRY_RUN) {
          console.log(chalk.gray(`  [DRY-RUN] Would upload: ${file.blobPath} (${this.formatBytes(file.size)})`))
          this.stats.uploadedFiles++
          this.stats.uploadedBytes += file.size
          assetData.blobUrls[file.relativePath] = `https://[blob-storage]/${file.blobPath}`
          continue
        }

        // Upload to Vercel Blob
        const contentType = this.getContentType(file.ext)
        const { url } = await put(file.blobPath, fileBuffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType,
          token: process.env.BLOB_READ_WRITE_TOKEN
        })

        console.log(chalk.green(`  ✓ ${file.relativePath} → ${url}`))

        assetData.blobUrls[file.relativePath] = url
        this.stats.uploadedFiles++
        this.stats.uploadedBytes += file.size

        // Special handling for metadata.json
        if (file.relativePath === 'metadata.json') {
          const metadata = JSON.parse(fileBuffer.toString('utf-8'))
          assetData.metadata = metadata
        }

      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to upload ${file.relativePath}: ${error.message}`))
        this.stats.failedFiles++
        this.stats.errors.push({
          assetId,
          file: file.relativePath,
          error: error.message
        })
      }
    }
  }

  async migrateAllAssets() {
    console.log(chalk.blue('\n🚀 Starting migration...\n'))

    for (const [assetId, assetData] of Object.entries(this.migrationData.assets)) {
      await this.uploadAsset(assetId, assetData)
    }
  }

  async saveMigrationLog() {
    this.migrationData.completedAt = new Date().toISOString()

    // Ensure data directory exists
    const dataDir = path.dirname(MIGRATION_LOG)
    await fs.mkdir(dataDir, { recursive: true })

    await fs.writeFile(
      MIGRATION_LOG,
      JSON.stringify({
        ...this.migrationData,
        stats: this.stats
      }, null, 2)
    )

    console.log(chalk.blue(`\n📝 Migration log saved to: ${MIGRATION_LOG}`))
  }

  printSummary() {
    console.log(chalk.blue('\n' + '='.repeat(60)))
    console.log(chalk.bold('📊 Migration Summary'))
    console.log(chalk.blue('='.repeat(60)))

    console.log(`\n${chalk.bold('Assets:')} ${this.stats.totalAssets}`)
    console.log(`${chalk.bold('Files:')} ${this.stats.uploadedFiles}/${this.stats.totalFiles}`)
    console.log(`${chalk.bold('Size:')} ${this.formatBytes(this.stats.uploadedBytes)}/${this.formatBytes(this.stats.totalBytes)}`)

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
      console.log(chalk.yellow('\n⚠️  DRY RUN - No files were actually uploaded'))
      console.log(chalk.yellow('Run without --dry-run to perform actual migration'))
    } else {
      console.log(chalk.green('\n✅ Migration completed successfully!'))
    }

    console.log(chalk.blue('\n' + '='.repeat(60) + '\n'))
  }

  getContentType(ext) {
    const contentTypes = {
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.bin': 'application/octet-stream',
      '.txt': 'text/plain'
    }
    return contentTypes[ext.toLowerCase()] || 'application/octet-stream'
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
  console.log(chalk.bold.blue('\n🔄 Vercel Blob Migration Script\n'))

  if (DRY_RUN) {
    console.log(chalk.yellow('⚠️  Running in DRY-RUN mode - no files will be uploaded\n'))
  }

  const migration = new BlobMigration()

  try {
    // Validate environment
    await migration.validateEnvironment()

    // Scan all assets
    await migration.scanAssets()

    // Confirm before proceeding
    if (!DRY_RUN) {
      console.log(chalk.yellow('\n⚠️  This will upload all assets to Vercel Blob storage.'))
      console.log(chalk.yellow(`Total size: ${migration.formatBytes(migration.stats.totalBytes)}`))
      console.log(chalk.yellow('Press Ctrl+C to cancel, or Enter to continue...'))

      // Wait for user confirmation
      await new Promise(resolve => {
        process.stdin.once('data', resolve)
      })
    }

    // Migrate all assets
    await migration.migrateAllAssets()

    // Save migration log
    await migration.saveMigrationLog()

    // Print summary
    migration.printSummary()

    process.exit(0)
  } catch (error) {
    console.error(chalk.red('\n❌ Migration failed:'), error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
