#!/usr/bin/env node
/**
 * List Blobs Script
 *
 * Lists all blobs in your Vercel Blob storage with filtering options.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=xxx node scripts/list-blobs.mjs [--prefix assets/human]
 */

import 'dotenv/config'
import { list } from '@vercel/blob'
import chalk from 'chalk'

const args = process.argv.slice(2)
const prefixArg = args.find(arg => arg.startsWith('--prefix'))
const prefix = prefixArg ? prefixArg.split('=')[1] : undefined

async function listBlobs() {
  console.log(chalk.bold.blue('\n📋 Listing Vercel Blobs\n'))

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(chalk.red('❌ BLOB_READ_WRITE_TOKEN not found in environment'))
    process.exit(1)
  }

  try {
    let cursor
    let totalBlobs = 0
    let totalSize = 0

    console.log(chalk.blue(`Prefix: ${prefix || '(none - showing all blobs)'}\n`))

    do {
      const response = await list({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        cursor,
        prefix,
        limit: 100
      })

      for (const blob of response.blobs) {
        console.log(chalk.green(`✓ ${blob.pathname}`))
        console.log(chalk.gray(`  URL: ${blob.url}`))
        console.log(chalk.gray(`  Size: ${formatBytes(blob.size)}`))
        console.log(chalk.gray(`  Uploaded: ${new Date(blob.uploadedAt).toLocaleString()}`))
        console.log('')

        totalBlobs++
        totalSize += blob.size
      }

      cursor = response.cursor
    } while (cursor)

    console.log(chalk.blue('─'.repeat(60)))
    console.log(chalk.bold(`\n📊 Total: ${totalBlobs} blobs`))
    console.log(chalk.bold(`💾 Size: ${formatBytes(totalSize)}`))
    console.log('')

  } catch (error) {
    console.error(chalk.red('❌ Failed to list blobs:'), error.message)
    process.exit(1)
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

listBlobs()
