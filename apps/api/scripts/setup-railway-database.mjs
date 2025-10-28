#!/usr/bin/env node

/**
 * Railway Database Setup Script
 *
 * This script initializes the PostgreSQL database schema on Railway.
 * It should be run once after creating the PostgreSQL service.
 *
 * Usage:
 *   railway run node scripts/setup-railway-database.mjs
 *
 * Or locally with DATABASE_URL:
 *   DATABASE_URL=<railway-db-url> node scripts/setup-railway-database.mjs
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Database connection
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required')
  console.error('   Run this script via: railway run node scripts/setup-railway-database.mjs')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
})

/**
 * Test database connection
 */
async function testConnection() {
  console.log('🔌 Testing database connection...')

  try {
    const result = await pool.query('SELECT NOW() as now, current_database() as db, version() as version')
    const { now, db, version } = result.rows[0]

    console.log('  ✅ Connected to PostgreSQL')
    console.log(`     Database: ${db}`)
    console.log(`     Time: ${now}`)
    console.log(`     Version: ${version.split(' ')[0]} ${version.split(' ')[1]}`)

    return true
  } catch (error) {
    console.error('  ❌ Connection failed:', error.message)
    return false
  }
}

/**
 * Check if schema is already initialized
 */
async function checkSchemaExists() {
  console.log('\n🔍 Checking existing schema...')

  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const tables = result.rows.map(r => r.table_name)

    if (tables.length === 0) {
      console.log('  📭 No tables found - fresh database')
      return { exists: false, tables: [] }
    }

    console.log(`  📊 Found ${tables.length} existing tables:`)
    tables.forEach(table => console.log(`     - ${table}`))

    // Check for key tables
    const keyTables = ['users', 'preview_manifests', 'manifest_submissions']
    const hasKeyTables = keyTables.every(t => tables.includes(t))

    return { exists: hasKeyTables, tables }
  } catch (error) {
    console.error('  ❌ Failed to check schema:', error.message)
    return { exists: false, tables: [], error }
  }
}

/**
 * Apply database schema
 */
async function applySchema() {
  console.log('\n📋 Applying database schema...')

  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql')
    console.log(`  📂 Reading schema from: ${schemaPath}`)

    const schemaSql = await fs.readFile(schemaPath, 'utf-8')

    console.log('  🔨 Executing schema SQL...')
    await pool.query(schemaSql)

    console.log('  ✅ Schema applied successfully')
    return true
  } catch (error) {
    console.error('  ❌ Failed to apply schema:', error.message)
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    return false
  }
}

/**
 * Verify schema was created correctly
 */
async function verifySchema() {
  console.log('\n✔️  Verifying schema...')

  const requiredTables = [
    'users',
    'teams',
    'team_members',
    'preview_manifests',
    'manifest_submissions',
    'api_keys',
    'admin_whitelist',
    'ai_context_preferences'
  ]

  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = ANY($1)
      ORDER BY table_name
    `, [requiredTables])

    const foundTables = result.rows.map(r => r.table_name)
    const missingTables = requiredTables.filter(t => !foundTables.includes(t))

    if (missingTables.length === 0) {
      console.log(`  ✅ All ${requiredTables.length} required tables exist`)
      foundTables.forEach(table => console.log(`     ✓ ${table}`))
      return true
    } else {
      console.error(`  ❌ Missing ${missingTables.length} required tables:`)
      missingTables.forEach(table => console.error(`     ✗ ${table}`))
      return false
    }
  } catch (error) {
    console.error('  ❌ Verification failed:', error.message)
    return false
  }
}

/**
 * Get table statistics
 */
async function getTableStats() {
  console.log('\n📊 Database Statistics:')

  try {
    const result = await pool.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `)

    console.log('\n┌────────────────────────────┬──────────────┐')
    console.log('│ Table                      │ Size         │')
    console.log('├────────────────────────────┼──────────────┤')

    result.rows.forEach(row => {
      const table = row.tablename.padEnd(26)
      const size = row.size.padStart(12)
      console.log(`│ ${table} │ ${size} │`)
    })

    console.log('└────────────────────────────┴──────────────┘')
  } catch (error) {
    console.error('  ⚠️  Could not fetch statistics:', error.message)
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log('🚀 Railway Database Setup')
  console.log('='.repeat(60))
  console.log(`📍 Target: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'Railway PostgreSQL'}`)
  console.log('='.repeat(60))

  const startTime = Date.now()

  try {
    // Step 1: Test connection
    const connected = await testConnection()
    if (!connected) {
      console.error('\n❌ Setup failed: Could not connect to database')
      process.exit(1)
    }

    // Step 2: Check existing schema
    const { exists, tables } = await checkSchemaExists()

    if (exists) {
      console.log('\n⚠️  Schema already exists!')
      console.log('   If you want to reset the database, you need to:')
      console.log('   1. Drop all tables manually, or')
      console.log('   2. Create a new PostgreSQL service in Railway')
      console.log('\n   Skipping schema creation.')

      await getTableStats()
    } else {
      console.log('\n🆕 Fresh database - proceeding with schema creation')

      // Step 3: Apply schema
      const applied = await applySchema()
      if (!applied) {
        console.error('\n❌ Setup failed: Could not apply schema')
        process.exit(1)
      }

      // Step 4: Verify schema
      const verified = await verifySchema()
      if (!verified) {
        console.error('\n❌ Setup failed: Schema verification failed')
        process.exit(1)
      }

      // Step 5: Show statistics
      await getTableStats()
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n' + '='.repeat(60))
    console.log('✅ DATABASE SETUP COMPLETE')
    console.log('='.repeat(60))
    console.log(`⏱️  Duration: ${duration}s`)
    console.log('\n📋 Next Steps:')
    console.log('   1. Deploy your API service: railway up')
    console.log('   2. Run migrations: railway run node server/scripts/migrate-manifests-to-postgres.mjs')
    console.log('   3. Verify deployment: railway logs')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ SETUP FAILED:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run setup
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
