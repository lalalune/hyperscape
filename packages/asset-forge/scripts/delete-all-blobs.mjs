#!/usr/bin/env node
/**
 * Delete All Blobs Script
 *
 * WARNING: This deletes ALL blobs in your Vercel Blob storage.
 * Use with caution!
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=xxx node scripts/delete-all-blobs.mjs [--prefix assets/human] [--confirm]
 */

import 'dotenv/config'
import { list, del } from '@vercel/blob'
import chalk from 'chalk'

const args = process.argv.slice(2)
const prefixArg = args.find(arg => arg.startsWith('--prefix'))
const prefix = prefixArg ? prefixArg.split('=')[1] : undefined
const confirmed = args.includes('--confirm')

async function deleteAllBlobs() {
  console.log(chalk.bold.red('\n⚠️  Delete All Blobs\n'))

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(chalk.red('❌ BLOB_READ_WRITE_TOKEN not found in environment'))
    process.exit(1)
  }

  // List all blobs first
  console.log(chalk.blue('📋 Scanning blobs...\n'))

  let cursor
  const blobsToDelete = []

  try {
    do {
      const response = await list({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        cursor,
        prefix,
        limit: 100
      })

      blobsToDelete.push(...response.blobs)
      cursor = response.cursor
    } while (cursor)

    if (blobsToDelete.length === 0) {
      console.log(chalk.yellow('No blobs found to delete'))
      process.exit(0)
    }

    console.log(chalk.yellow(`Found ${blobsToDelete.length} blobs to delete`))

    if (prefix) {
      console.log(chalk.yellow(`Prefix filter: ${prefix}`))
    } else {
      console.log(chalk.red('⚠️  No prefix filter - will delete ALL blobs!'))
    }

    // Show sample
    console.log(chalk.gray('\nSample blobs:'))
    blobsToDelete.slice(0, 5).forEach(blob => {
      console.log(chalk.gray(`  - ${blob.pathname}`))
    })
    if (blobsToDelete.length > 5) {
      console.log(chalk.gray(`  ... and ${blobsToDelete.length - 5} more`))
    }

    if (!confirmed) {
      console.log(chalk.red('\n⚠️  This action cannot be undone!'))
      console.log(chalk.yellow('Add --confirm to proceed with deletion'))
      process.exit(0)
    }

    // Delete all blobs
    console.log(chalk.blue('\n🗑️  Deleting blobs...\n'))

    let deleted = 0
    let failed = 0

    for (const blob of blobsToDelete) {
      try {
        await del(blob.url, {
          token: process.env.BLOB_READ_WRITE_TOKEN
        })
        console.log(chalk.green(`✓ Deleted: ${blob.pathname}`))
        deleted++
      } catch (error) {
        console.error(chalk.red(`✗ Failed: ${blob.pathname} - ${error.message}`))
        failed++
      }
    }

    console.log(chalk.blue('\n' + '─'.repeat(60)))
    console.log(chalk.bold(`\n✅ Deleted: ${deleted} blobs`))
    if (failed > 0) {
      console.log(chalk.red(`❌ Failed: ${failed} blobs`))
    }
    console.log('')

  } catch (error) {
    console.error(chalk.red('❌ Failed to delete blobs:'), error.message)
    process.exit(1)
  }
}

deleteAllBlobs()
