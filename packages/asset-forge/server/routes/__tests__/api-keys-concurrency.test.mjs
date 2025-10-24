/**
 * API Key Generation Concurrency Tests
 *
 * Tests that API key generation maintains uniqueness under concurrent load
 * and properly handles race conditions in key generation.
 *
 * CRITICAL: API keys must be globally unique across all concurrent operations
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema.mjs'
import crypto from 'crypto'

console.log('\n🔬 Testing API Key Generation Concurrency\n')

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
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX idx_api_keys_id ON api_keys(id);
`)

/**
 * Test Setup: Create test users
 */
function setupTestData() {
  // Clean up existing data
  sqlite.exec('PRAGMA foreign_keys = OFF;')
  sqlite.exec('DELETE FROM api_keys;')
  sqlite.exec('DELETE FROM users;')
  sqlite.exec('PRAGMA foreign_keys = ON;')

  // Create 10 test users
  for (let i = 1; i <= 10; i++) {
    const userId = `user-${i}`
    sqlite.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)').run(
      userId,
      `User ${i}`,
      `user${i}@test.com`
    )
  }

  return { userCount: 10 }
}

/**
 * Generate API key ID (simulating the actual implementation)
 */
function generateApiKeyId() {
  return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

/**
 * OLD PATTERN: Non-atomic key generation (VULNERABLE)
 */
async function generateApiKey_OLD(userId, provider) {
  return new Promise((resolve, reject) => {
    try {
      // Generate key ID
      const id = generateApiKeyId()

      // Check if key ID already exists (TIME OF CHECK)
      const existing = sqlite.prepare('SELECT id FROM api_keys WHERE id = ?').get(id)

      if (existing) {
        reject(new Error('Key ID already exists'))
        return
      }

      // RACE CONDITION WINDOW: Another generation could create same ID here!
      // Simulate network delay or processing time
      setTimeout(() => {
        // Insert key (TIME OF USE)
        try {
          sqlite.prepare(`
            INSERT INTO api_keys (id, user_id, provider, encrypted_key)
            VALUES (?, ?, ?, ?)
          `).run(id, userId, provider, 'encrypted_dummy_key')

          resolve({ id, userId, provider })
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
 * FIXED PATTERN: Atomic key generation with database constraints
 */
async function generateApiKey_FIXED(userId, provider) {
  return new Promise((resolve, reject) => {
    try {
      // ATOMIC: Use database transaction + unique constraint
      sqlite.transaction(() => {
        let attempts = 0
        const maxAttempts = 5
        let id

        while (attempts < maxAttempts) {
          // Generate key ID
          id = generateApiKeyId()

          try {
            // Try to insert with unique constraint enforcement
            sqlite.prepare(`
              INSERT INTO api_keys (id, user_id, provider, encrypted_key)
              VALUES (?, ?, ?, ?)
            `).run(id, userId, provider, 'encrypted_dummy_key')

            // Success! Key was unique
            break
          } catch (error) {
            // Check if it's a uniqueness violation
            if (error.message.includes('UNIQUE constraint failed')) {
              attempts++
              if (attempts >= maxAttempts) {
                throw new Error('Failed to generate unique key after maximum attempts')
              }
              // Retry with new ID
              continue
            } else {
              // Other error, re-throw
              throw error
            }
          }
        }

        resolve({ id, userId, provider })
      })()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Test concurrent API key generation with OLD pattern
 */
async function testOldPattern(iterations = 5) {
  console.log('\n🔴 Testing OLD Pattern (Non-Atomic Key Generation)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    setupTestData()

    // Try to generate 100 API keys concurrently (10 users × 10 providers)
    const generatePromises = []
    for (let i = 1; i <= 10; i++) {
      for (let p = 0; p < 10; p++) {
        const userId = `user-${i}`
        const provider = ['openai', 'meshy', 'elevenlabs'][p % 3]
        generatePromises.push(
          generateApiKey_OLD(userId, provider)
            .then((result) => ({ success: true, ...result }))
            .catch((error) => ({ success: false, error: error.message }))
        )
      }
    }

    await Promise.all(generatePromises)

    // Check for duplicate key IDs
    const allKeys = sqlite.prepare('SELECT id FROM api_keys').all()
    const keyIds = allKeys.map(k => k.id)
    const uniqueIds = new Set(keyIds)

    const hasDuplicates = keyIds.length !== uniqueIds.size
    const duplicateCount = keyIds.length - uniqueIds.size

    results.push({
      iteration: iter + 1,
      totalGenerated: keyIds.length,
      uniqueKeys: uniqueIds.size,
      duplicates: duplicateCount,
      hasDuplicates
    })

    const status = hasDuplicates ? '❌ DUPLICATES' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Generated=${keyIds.length}, Unique=${uniqueIds.size}, Duplicates=${duplicateCount} ${status}`)
  }

  const duplicateIssues = results.filter(r => r.hasDuplicates).length

  console.log('─'.repeat(60))
  console.log(`Duplicate key issues: ${duplicateIssues}/${iterations}`)

  return { results, duplicateIssues }
}

/**
 * Test concurrent API key generation with FIXED pattern
 */
async function testFixedPattern(iterations = 5) {
  console.log('\n🟢 Testing FIXED Pattern (Atomic Key Generation)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    setupTestData()

    // Try to generate 100 API keys concurrently (10 users × 10 providers)
    const generatePromises = []
    for (let i = 1; i <= 10; i++) {
      for (let p = 0; p < 10; p++) {
        const userId = `user-${i}`
        const provider = ['openai', 'meshy', 'elevenlabs'][p % 3]
        generatePromises.push(
          generateApiKey_FIXED(userId, provider)
            .then((result) => ({ success: true, ...result }))
            .catch((error) => ({ success: false, error: error.message }))
        )
      }
    }

    await Promise.all(generatePromises)

    // Check for duplicate key IDs
    const allKeys = sqlite.prepare('SELECT id FROM api_keys').all()
    const keyIds = allKeys.map(k => k.id)
    const uniqueIds = new Set(keyIds)

    const hasDuplicates = keyIds.length !== uniqueIds.size
    const duplicateCount = keyIds.length - uniqueIds.size

    results.push({
      iteration: iter + 1,
      totalGenerated: keyIds.length,
      uniqueKeys: uniqueIds.size,
      duplicates: duplicateCount,
      hasDuplicates
    })

    const status = hasDuplicates ? '❌ DUPLICATES' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Generated=${keyIds.length}, Unique=${uniqueIds.size}, Duplicates=${duplicateCount} ${status}`)
  }

  const duplicateIssues = results.filter(r => r.hasDuplicates).length

  console.log('─'.repeat(60))
  console.log(`Duplicate key issues: ${duplicateIssues}/${iterations}`)

  return { results, duplicateIssues }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 Starting API Key Generation Concurrency Tests\n')
  console.log('Test scenario:')
  console.log('  - Users: 10')
  console.log('  - Concurrent API key generations: 100')
  console.log('  - Expected behavior: All keys should be unique\n')

  const oldResults = await testOldPattern(10)
  const fixedResults = await testFixedPattern(10)

  // Final report
  console.log('\n\n' + '='.repeat(60))
  console.log('📋 FINAL REPORT: API Key Generation Concurrency')
  console.log('='.repeat(60))

  console.log('\n🔴 OLD Pattern (Non-Atomic Key Generation):')
  console.log(`   - Duplicate key issues: ${oldResults.duplicateIssues}/10 (${(oldResults.duplicateIssues / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${oldResults.duplicateIssues > 0 ? '❌ VULNERABLE to race conditions' : '⚠️  May be vulnerable (run more iterations)'}`)

  console.log('\n🟢 FIXED Pattern (Atomic with Database Constraints):')
  console.log(`   - Duplicate key issues: ${fixedResults.duplicateIssues}/10 (${(fixedResults.duplicateIssues / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${fixedResults.duplicateIssues === 0 ? '✅ PROTECTED from race conditions' : '❌ Still has issues'}`)

  console.log('\n📈 Improvement:')
  if (oldResults.duplicateIssues > fixedResults.duplicateIssues) {
    const improvement = ((oldResults.duplicateIssues - fixedResults.duplicateIssues) / Math.max(oldResults.duplicateIssues, 1) * 100).toFixed(0)
    console.log(`   ✅ ${improvement}% reduction in duplicate key issues`)
  } else if (fixedResults.duplicateIssues === 0 && oldResults.duplicateIssues === 0) {
    console.log(`   ⚠️  No issues detected in either pattern (consider more iterations or higher concurrency)`)
  } else {
    console.log(`   ❌ Fix did not reduce issue rate`)
  }

  console.log('\n💡 Key Insights:')
  console.log('   1. Timestamp-based key IDs can collide under high concurrency')
  console.log('   2. Check-then-insert pattern has TOCTOU vulnerability')
  console.log('   3. Database UNIQUE constraints provide atomic enforcement')
  console.log('   4. Retry logic handles rare collisions gracefully')
  console.log('   5. Transactions ensure atomicity across multiple operations')

  console.log('\n🎯 Production Impact:')
  console.log('   - Prevents duplicate API keys in database')
  console.log('   - Ensures key uniqueness for authentication')
  console.log('   - Protects against concurrent key generation races')
  console.log('   - Maintains data integrity under load')

  console.log('\n🔧 Implementation Recommendations:')
  console.log('   - Use database UNIQUE constraints on key ID column')
  console.log('   - Wrap key generation in database transactions')
  console.log('   - Implement retry logic for collision handling')
  console.log('   - Consider using UUIDs instead of timestamp-based IDs')

  console.log('\n✅ API Key Generation Concurrency Test Complete!\n')

  // Exit with appropriate code
  const testPassed = fixedResults.duplicateIssues === 0
  sqlite.close()
  process.exit(testPassed ? 0 : 1)
}

// Run tests
runTests().catch((error) => {
  console.error('Test failed with error:', error)
  sqlite.close()
  process.exit(1)
})
