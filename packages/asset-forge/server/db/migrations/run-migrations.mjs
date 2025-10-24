/**
 * Migration Runner
 *
 * Applies database migrations in order
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Run all migrations in the migrations directory
 *
 * @param {Database.Database} sqlite - SQLite database instance
 */
export function runMigrations(sqlite) {
  console.log('[Migrations] Starting migration process...')

  // Create migrations tracking table if it doesn't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // Get list of applied migrations
  const appliedMigrations = sqlite
    .prepare('SELECT filename FROM migrations')
    .all()
    .map(row => row.filename)

  console.log('[Migrations] Applied migrations:', appliedMigrations.length)

  // Get all migration files
  const migrationsDir = __dirname
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort() // Apply in alphabetical order (001_, 002_, etc.)

  console.log('[Migrations] Found migration files:', migrationFiles.length)

  // Apply pending migrations
  let appliedCount = 0
  for (const filename of migrationFiles) {
    if (appliedMigrations.includes(filename)) {
      console.log(`[Migrations] ✓ Skipping ${filename} (already applied)`)
      continue
    }

    console.log(`[Migrations] → Applying ${filename}...`)

    try {
      // Read migration file
      const migrationPath = path.join(migrationsDir, filename)
      const sql = fs.readFileSync(migrationPath, 'utf8')

      // Execute migration in a transaction
      const applyMigration = sqlite.transaction(() => {
        // Execute the migration SQL
        sqlite.exec(sql)

        // Record migration as applied
        sqlite
          .prepare('INSERT INTO migrations (filename) VALUES (?)')
          .run(filename)
      })

      applyMigration()

      console.log(`[Migrations] ✓ Applied ${filename} successfully`)
      appliedCount++
    } catch (error) {
      console.error(`[Migrations] ✗ Failed to apply ${filename}:`, error)
      throw error
    }
  }

  if (appliedCount > 0) {
    console.log(`[Migrations] ✓ Successfully applied ${appliedCount} new migration(s)`)
  } else {
    console.log('[Migrations] ✓ All migrations up to date')
  }
}

/**
 * Get migration status
 *
 * @param {Database.Database} sqlite - SQLite database instance
 * @returns {Object} Migration status information
 */
export function getMigrationStatus(sqlite) {
  // Get applied migrations
  const applied = sqlite
    .prepare('SELECT filename, applied_at FROM migrations ORDER BY id')
    .all()

  // Get all migration files
  const migrationsDir = __dirname
  const allMigrations = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()

  const appliedFilenames = applied.map(m => m.filename)
  const pending = allMigrations.filter(file => !appliedFilenames.includes(file))

  return {
    total: allMigrations.length,
    applied: applied.length,
    pending: pending.length,
    appliedMigrations: applied,
    pendingMigrations: pending,
  }
}
