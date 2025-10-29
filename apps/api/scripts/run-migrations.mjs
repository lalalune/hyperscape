#!/usr/bin/env node

/**
 * Database Migrations Runner
 *
 * Runs all pending migrations in order.
 * Migrations are tracked in a migrations table to prevent re-running.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required')
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
 * Create migrations tracking table
 */
async function createMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `
  await pool.query(sql)
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  const result = await pool.query(
    'SELECT migration_name FROM schema_migrations ORDER BY id'
  )
  return result.rows.map(r => r.migration_name)
}

/**
 * Get list of migration files
 */
async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '../database/migrations')

  try {
    const files = await fs.readdir(migrationsDir)
    return files
      .filter(f => f.endsWith('.sql'))
      .filter(f => f !== '003_embeddings.sql') // Skip pgvector migration - using Qdrant instead
      .sort() // Sort by filename (should be numbered like 001_, 002_, etc.)
  } catch (error) {
    console.warn('⚠️  Migrations directory not found or empty')
    return []
  }
}

/**
 * Apply a migration
 */
async function applyMigration(migrationFile) {
  const migrationsDir = path.join(__dirname, '../database/migrations')
  const migrationPath = path.join(migrationsDir, migrationFile)

  console.log(`  📄 Reading: ${migrationFile}`)

  const sql = await fs.readFile(migrationPath, 'utf-8')

  console.log(`  🔨 Executing...`)

  await pool.query(sql)

  // Record migration as applied
  await pool.query(
    'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
    [migrationFile]
  )

  console.log(`  ✅ Applied: ${migrationFile}`)
}

/**
 * Main migration runner
 */
async function main() {
  console.log('🔄 Database Migrations Runner')
  console.log('='.repeat(60))

  try {
    // Create migrations table if it doesn't exist
    await createMigrationsTable()

    // Get applied and pending migrations
    const appliedMigrations = await getAppliedMigrations()
    const allMigrationFiles = await getMigrationFiles()

    const pendingMigrations = allMigrationFiles.filter(
      f => !appliedMigrations.includes(f)
    )

    console.log(`\n📊 Migration Status:`)
    console.log(`   Applied: ${appliedMigrations.length}`)
    console.log(`   Pending: ${pendingMigrations.length}`)
    console.log(`   Total: ${allMigrationFiles.length}`)

    if (pendingMigrations.length === 0) {
      console.log('\n✅ All migrations up to date!')
      return
    }

    console.log(`\n🚀 Running ${pendingMigrations.length} pending migration(s)...\n`)

    for (const migration of pendingMigrations) {
      await applyMigration(migration)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ MIGRATIONS COMPLETE')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run migrations
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
