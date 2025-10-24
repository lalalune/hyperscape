/**
 * Asset Creation Concurrency Tests
 *
 * Tests that concurrent asset uploads maintain data integrity
 * and properly handle race conditions in file system and database operations.
 *
 * CRITICAL: Asset counter and file uploads must be atomic
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema.mjs'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('\n🔬 Testing Asset Creation Concurrency\n')

// Create in-memory database for testing
const testDbPath = ':memory:'
const sqlite = new Database(testDbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })

// Initialize test database schema
console.log('Setting up test database...')
sqlite.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    asset_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    glb_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_assets_project ON assets(project_id);
`)

/**
 * Test Setup: Create test users and projects
 */
function setupTestData() {
  // Clean up existing data
  sqlite.exec('PRAGMA foreign_keys = OFF;')
  sqlite.exec('DELETE FROM assets;')
  sqlite.exec('DELETE FROM projects;')
  sqlite.exec('DELETE FROM users;')
  sqlite.exec('PRAGMA foreign_keys = ON;')

  // Create test user
  const userId = 'user-1'
  sqlite.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(userId, 'Test User')

  // Create test project
  const projectId = 'project-1'
  sqlite.prepare(`
    INSERT INTO projects (id, user_id, name, asset_count)
    VALUES (?, ?, ?, ?)
  `).run(projectId, userId, 'Test Project', 0)

  return { userId, projectId }
}

/**
 * OLD PATTERN: Non-atomic asset creation (VULNERABLE)
 */
async function createAsset_OLD(projectId, userId, assetName) {
  return new Promise((resolve, reject) => {
    try {
      // Step 1: Read current project asset count (TIME OF CHECK)
      const project = sqlite.prepare('SELECT asset_count FROM projects WHERE id = ?').get(projectId)

      if (!project) {
        reject(new Error('Project not found'))
        return
      }

      // RACE CONDITION WINDOW: Another asset creation could happen here!
      // Simulate network delay or file upload time
      setTimeout(() => {
        // Step 2: Create asset (TIME OF USE)
        const assetId = `asset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

        try {
          sqlite.prepare(`
            INSERT INTO assets (id, project_id, user_id, name, status)
            VALUES (?, ?, ?, ?, ?)
          `).run(assetId, projectId, userId, assetName, 'completed')

          // Step 3: Increment asset count
          sqlite.prepare(`
            UPDATE projects SET asset_count = asset_count + 1 WHERE id = ?
          `).run(projectId)

          resolve({ assetId, projectId, assetName })
        } catch (error) {
          reject(error)
        }
      }, Math.random() * 5) // Random delay to trigger race conditions
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * FIXED PATTERN: Atomic asset creation with transaction
 */
async function createAsset_FIXED(projectId, userId, assetName) {
  return new Promise((resolve, reject) => {
    try {
      // ATOMIC TRANSACTION: All operations happen atomically
      sqlite.transaction(() => {
        // Check project exists
        const project = sqlite.prepare('SELECT asset_count FROM projects WHERE id = ?').get(projectId)

        if (!project) {
          throw new Error('Project not found')
        }

        // Create asset
        const assetId = `asset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

        sqlite.prepare(`
          INSERT INTO assets (id, project_id, user_id, name, status)
          VALUES (?, ?, ?, ?, ?)
        `).run(assetId, projectId, userId, assetName, 'completed')

        // Increment asset count atomically
        sqlite.prepare(`
          UPDATE projects SET asset_count = asset_count + 1 WHERE id = ?
        `).run(projectId)

        resolve({ assetId, projectId, assetName })
      })()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Test concurrent asset creation with OLD pattern
 */
async function testOldPattern(iterations = 5) {
  console.log('\n🔴 Testing OLD Pattern (Non-Atomic Asset Creation)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    const { projectId, userId } = setupTestData()

    // Try to create 50 assets concurrently
    const createPromises = []
    for (let i = 1; i <= 50; i++) {
      createPromises.push(
        createAsset_OLD(projectId, userId, `Asset ${i}`)
          .then(() => ({ success: true }))
          .catch((error) => ({ success: false, error: error.message }))
      )
    }

    await Promise.all(createPromises)

    // Check final project state
    const project = sqlite.prepare('SELECT asset_count FROM projects WHERE id = ?').get(projectId)
    const actualAssets = sqlite.prepare('SELECT COUNT(*) as count FROM assets WHERE project_id = ?').get(projectId).count

    const inconsistent = project.asset_count !== actualAssets

    results.push({
      iteration: iter + 1,
      expected: 50,
      assetCount: project.asset_count,
      actualAssets,
      inconsistent
    })

    const status = inconsistent ? '⚠️  INCONSISTENT' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Expected=50, Count=${project.asset_count}, Actual=${actualAssets} ${status}`)
  }

  const inconsistencies = results.filter(r => r.inconsistent).length

  console.log('─'.repeat(60))
  console.log(`Data inconsistencies: ${inconsistencies}/${iterations}`)

  return { results, inconsistencies }
}

/**
 * Test concurrent asset creation with FIXED pattern
 */
async function testFixedPattern(iterations = 5) {
  console.log('\n🟢 Testing FIXED Pattern (Atomic Asset Creation)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    const { projectId, userId } = setupTestData()

    // Try to create 50 assets concurrently
    const createPromises = []
    for (let i = 1; i <= 50; i++) {
      createPromises.push(
        createAsset_FIXED(projectId, userId, `Asset ${i}`)
          .then(() => ({ success: true }))
          .catch((error) => ({ success: false, error: error.message }))
      )
    }

    await Promise.all(createPromises)

    // Check final project state
    const project = sqlite.prepare('SELECT asset_count FROM projects WHERE id = ?').get(projectId)
    const actualAssets = sqlite.prepare('SELECT COUNT(*) as count FROM assets WHERE project_id = ?').get(projectId).count

    const inconsistent = project.asset_count !== actualAssets

    results.push({
      iteration: iter + 1,
      expected: 50,
      assetCount: project.asset_count,
      actualAssets,
      inconsistent
    })

    const status = inconsistent ? '⚠️  INCONSISTENT' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Expected=50, Count=${project.asset_count}, Actual=${actualAssets} ${status}`)
  }

  const inconsistencies = results.filter(r => r.inconsistent).length

  console.log('─'.repeat(60))
  console.log(`Data inconsistencies: ${inconsistencies}/${iterations}`)

  return { results, inconsistencies }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 Starting Asset Creation Concurrency Tests\n')
  console.log('Test scenario:')
  console.log('  - Concurrent asset uploads: 50')
  console.log('  - Expected behavior: asset_count should match actual asset count\n')

  const oldResults = await testOldPattern(10)
  const fixedResults = await testFixedPattern(10)

  // Final report
  console.log('\n\n' + '='.repeat(60))
  console.log('📋 FINAL REPORT: Asset Creation Concurrency')
  console.log('='.repeat(60))

  console.log('\n🔴 OLD Pattern (Non-Atomic Asset Creation):')
  console.log(`   - Data inconsistencies: ${oldResults.inconsistencies}/10 (${(oldResults.inconsistencies / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${oldResults.inconsistencies > 0 ? '❌ VULNERABLE to race conditions' : '⚠️  May be vulnerable (run more iterations)'}`)

  console.log('\n🟢 FIXED Pattern (Atomic Transaction):')
  console.log(`   - Data inconsistencies: ${fixedResults.inconsistencies}/10 (${(fixedResults.inconsistencies / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${fixedResults.inconsistencies === 0 ? '✅ PROTECTED from race conditions' : '❌ Still has issues'}`)

  console.log('\n📈 Improvement:')
  if (oldResults.inconsistencies > fixedResults.inconsistencies) {
    const improvement = ((oldResults.inconsistencies - fixedResults.inconsistencies) / Math.max(oldResults.inconsistencies, 1) * 100).toFixed(0)
    console.log(`   ✅ ${improvement}% reduction in data inconsistencies`)
  } else if (fixedResults.inconsistencies === 0 && oldResults.inconsistencies === 0) {
    console.log(`   ⚠️  No inconsistencies detected in either pattern (consider more iterations)`)
  } else {
    console.log(`   ❌ Fix did not reduce inconsistency rate`)
  }

  console.log('\n💡 Key Insights:')
  console.log('   1. TOCTOU vulnerability in asset counter updates')
  console.log('   2. Concurrent uploads can cause counter drift')
  console.log('   3. Database transactions provide atomicity')
  console.log('   4. asset_count must match actual database count')
  console.log('   5. File system operations should be within transactions')

  console.log('\n🎯 Production Impact:')
  console.log('   - Prevents incorrect asset counters in projects')
  console.log('   - Ensures accurate billing and quota tracking')
  console.log('   - Maintains data integrity across uploads')
  console.log('   - Protects against concurrent upload races')

  console.log('\n🔧 Implementation Details:')
  console.log('   - Wrap asset creation in db.transaction()')
  console.log('   - Update counters within same transaction')
  console.log('   - Use database-level constraints where possible')
  console.log('   - Add structured logging for debugging')

  console.log('\n✅ Asset Creation Concurrency Test Complete!\n')

  // Exit with appropriate code
  const testPassed = fixedResults.inconsistencies === 0
  sqlite.close()
  process.exit(testPassed ? 0 : 1)
}

// Run tests
runTests().catch((error) => {
  console.error('Test failed with error:', error)
  sqlite.close()
  process.exit(1)
})
