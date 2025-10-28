#!/usr/bin/env node

/**
 * Railway Startup Script
 *
 * Runs database initialization and migrations before starting the API server.
 * This ensures the database is properly set up on every deployment.
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Run a Node.js script and wait for it to complete
 */
function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 ${description}...`)
    console.log(`   Running: ${scriptPath}\n`)

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    })

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${description} completed successfully\n`)
        resolve()
      } else {
        // Don't reject - continue even if these fail
        // The scripts have || true behavior built-in
        console.log(`\n⚠️  ${description} exited with code ${code} (continuing anyway)\n`)
        resolve()
      }
    })

    child.on('error', (err) => {
      console.error(`\n❌ ${description} failed:`, err.message)
      resolve() // Still resolve to continue
    })
  })
}

/**
 * Start the API server
 */
function startServer() {
  console.log('\n🚀 Starting API Server...\n')

  const serverPath = path.join(__dirname, '../server/api.mjs')
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })

  server.on('exit', (code) => {
    console.log(`\n❌ Server exited with code ${code}`)
    process.exit(code || 1)
  })

  server.on('error', (err) => {
    console.error(`\n❌ Server failed to start:`, err)
    process.exit(1)
  })

  // Handle shutdown signals
  process.on('SIGTERM', () => {
    console.log('\n📡 Received SIGTERM, shutting down gracefully...')
    server.kill('SIGTERM')
  })

  process.on('SIGINT', () => {
    console.log('\n📡 Received SIGINT, shutting down gracefully...')
    server.kill('SIGINT')
  })
}

/**
 * Main startup sequence
 */
async function main() {
  console.log('=' .repeat(60))
  console.log('🚀 Asset Forge API - Railway Startup')
  console.log('=' .repeat(60))

  const startTime = Date.now()

  try {
    // Only run setup and migration if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      console.log('\n✅ DATABASE_URL detected - running database initialization\n')

      // Step 1: Setup database schema
      const setupScript = path.join(__dirname, 'setup-railway-database.mjs')
      await runScript(setupScript, 'Database Schema Setup')

      // Step 2: Migrate manifests to PostgreSQL
      const migrateScript = path.join(__dirname, '../server/scripts/migrate-manifests-to-postgres.mjs')
      await runScript(migrateScript, 'Manifest Migration')
    } else {
      console.log('\n⚠️  DATABASE_URL not set - skipping database initialization')
      console.log('   (This is expected for local development)\n')
    }

    const setupDuration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('=' .repeat(60))
    console.log('✅ Initialization Complete')
    console.log('=' .repeat(60))
    console.log(`⏱️  Setup Duration: ${setupDuration}s`)
    console.log('=' .repeat(60))

    // Step 3: Start the API server
    startServer()

  } catch (error) {
    console.error('\n❌ Startup failed:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Run startup sequence
main().catch(error => {
  console.error('Fatal startup error:', error)
  process.exit(1)
})
