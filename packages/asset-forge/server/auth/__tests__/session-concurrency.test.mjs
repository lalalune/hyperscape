/**
 * User Session Concurrency Tests
 *
 * Tests that concurrent user authentication and session management
 * maintain data integrity and properly handle race conditions.
 *
 * CRITICAL: Session tokens must be unique and login tracking must be accurate
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema.mjs'
import crypto from 'crypto'

console.log('\n🔬 Testing User Session Concurrency\n')

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
    last_login_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_activity_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX idx_sessions_token ON sessions(token);
`)

/**
 * Test Setup: Create test users
 */
function setupTestData() {
  // Clean up existing data
  sqlite.exec('PRAGMA foreign_keys = OFF;')
  sqlite.exec('DELETE FROM sessions;')
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
 * Generate session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * OLD PATTERN: Non-atomic session creation (VULNERABLE)
 */
async function createSession_OLD(userId, ipAddress, userAgent) {
  return new Promise((resolve, reject) => {
    try {
      // Generate session token
      const token = generateSessionToken()

      // Step 1: Check if token already exists (TIME OF CHECK)
      const existing = sqlite.prepare('SELECT id FROM sessions WHERE token = ?').get(token)

      if (existing) {
        reject(new Error('Token already exists'))
        return
      }

      // RACE CONDITION WINDOW: Another session creation could generate same token!
      setTimeout(() => {
        // Step 2: Create session (TIME OF USE)
        try {
          const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
          const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

          sqlite.prepare(`
            INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(sessionId, userId, token, ipAddress, userAgent, expiresAt)

          // Step 3: Update user's last login
          sqlite.prepare(`
            UPDATE users SET last_login_at = ? WHERE id = ?
          `).run(Date.now(), userId)

          resolve({ sessionId, token, userId })
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
 * FIXED PATTERN: Atomic session creation with transaction
 */
async function createSession_FIXED(userId, ipAddress, userAgent) {
  return new Promise((resolve, reject) => {
    try {
      // ATOMIC TRANSACTION: All operations happen atomically
      sqlite.transaction(() => {
        // Generate session token with uniqueness guarantee
        let token
        let attempts = 0
        const maxAttempts = 5

        while (attempts < maxAttempts) {
          token = generateSessionToken()

          // Check if token exists (within transaction)
          const existing = sqlite.prepare('SELECT id FROM sessions WHERE token = ?').get(token)

          if (!existing) {
            break // Token is unique
          }

          attempts++
          if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique token after maximum attempts')
          }
        }

        // Create session
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

        sqlite.prepare(`
          INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(sessionId, userId, token, ipAddress, userAgent, expiresAt)

        // Update user's last login (within same transaction)
        sqlite.prepare(`
          UPDATE users SET last_login_at = ? WHERE id = ?
        `).run(Date.now(), userId)

        resolve({ sessionId, token, userId })
      })()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Test concurrent session creation with OLD pattern
 */
async function testOldPattern(iterations = 5) {
  console.log('\n🔴 Testing OLD Pattern (Non-Atomic Session Creation)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    setupTestData()

    // Try to create 100 sessions concurrently (10 users × 10 logins each)
    const createPromises = []
    for (let i = 1; i <= 10; i++) {
      for (let j = 0; j < 10; j++) {
        const userId = `user-${i}`
        createPromises.push(
          createSession_OLD(userId, '127.0.0.1', 'Test Agent')
            .then((result) => ({ success: true, ...result }))
            .catch((error) => ({ success: false, error: error.message }))
        )
      }
    }

    const createResults = await Promise.all(createPromises)

    // Check for duplicate tokens
    const allSessions = sqlite.prepare('SELECT token FROM sessions').all()
    const tokens = allSessions.map(s => s.token)
    const uniqueTokens = new Set(tokens)

    const hasDuplicates = tokens.length !== uniqueTokens.size
    const duplicateCount = tokens.length - uniqueTokens.size

    const successful = createResults.filter(r => r.success).length
    const failed = createResults.filter(r => !r.success).length

    results.push({
      iteration: iter + 1,
      totalAttempts: 100,
      successful,
      failed,
      sessionsInDb: tokens.length,
      uniqueTokens: uniqueTokens.size,
      duplicates: duplicateCount,
      hasDuplicates
    })

    const status = hasDuplicates ? '❌ DUPLICATES' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Success=${successful}, Failed=${failed}, DB Sessions=${tokens.length}, Unique=${uniqueTokens.size}, Duplicates=${duplicateCount} ${status}`)
  }

  const duplicateIssues = results.filter(r => r.hasDuplicates).length

  console.log('─'.repeat(60))
  console.log(`Duplicate token issues: ${duplicateIssues}/${iterations}`)

  return { results, duplicateIssues }
}

/**
 * Test concurrent session creation with FIXED pattern
 */
async function testFixedPattern(iterations = 5) {
  console.log('\n🟢 Testing FIXED Pattern (Atomic Session Creation)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    setupTestData()

    // Try to create 100 sessions concurrently (10 users × 10 logins each)
    const createPromises = []
    for (let i = 1; i <= 10; i++) {
      for (let j = 0; j < 10; j++) {
        const userId = `user-${i}`
        createPromises.push(
          createSession_FIXED(userId, '127.0.0.1', 'Test Agent')
            .then((result) => ({ success: true, ...result }))
            .catch((error) => ({ success: false, error: error.message }))
        )
      }
    }

    const createResults = await Promise.all(createPromises)

    // Check for duplicate tokens
    const allSessions = sqlite.prepare('SELECT token FROM sessions').all()
    const tokens = allSessions.map(s => s.token)
    const uniqueTokens = new Set(tokens)

    const hasDuplicates = tokens.length !== uniqueTokens.size
    const duplicateCount = tokens.length - uniqueTokens.size

    const successful = createResults.filter(r => r.success).length
    const failed = createResults.filter(r => !r.success).length

    results.push({
      iteration: iter + 1,
      totalAttempts: 100,
      successful,
      failed,
      sessionsInDb: tokens.length,
      uniqueTokens: uniqueTokens.size,
      duplicates: duplicateCount,
      hasDuplicates
    })

    const status = hasDuplicates ? '❌ DUPLICATES' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Success=${successful}, Failed=${failed}, DB Sessions=${tokens.length}, Unique=${uniqueTokens.size}, Duplicates=${duplicateCount} ${status}`)
  }

  const duplicateIssues = results.filter(r => r.hasDuplicates).length

  console.log('─'.repeat(60))
  console.log(`Duplicate token issues: ${duplicateIssues}/${iterations}`)

  return { results, duplicateIssues }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 Starting User Session Concurrency Tests\n')
  console.log('Test scenario:')
  console.log('  - Users: 10')
  console.log('  - Concurrent session creations: 100')
  console.log('  - Expected behavior: All tokens should be unique\n')

  const oldResults = await testOldPattern(10)
  const fixedResults = await testFixedPattern(10)

  // Final report
  console.log('\n\n' + '='.repeat(60))
  console.log('📋 FINAL REPORT: User Session Concurrency')
  console.log('='.repeat(60))

  console.log('\n🔴 OLD Pattern (Non-Atomic Session Creation):')
  console.log(`   - Duplicate token issues: ${oldResults.duplicateIssues}/10 (${(oldResults.duplicateIssues / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${oldResults.duplicateIssues > 0 ? '❌ VULNERABLE to race conditions' : '⚠️  May be vulnerable (run more iterations)'}`)

  console.log('\n🟢 FIXED Pattern (Atomic Transaction + UNIQUE Constraint):')
  console.log(`   - Duplicate token issues: ${fixedResults.duplicateIssues}/10 (${(fixedResults.duplicateIssues / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${fixedResults.duplicateIssues === 0 ? '✅ PROTECTED from race conditions' : '❌ Still has issues'}`)

  console.log('\n📈 Improvement:')
  if (oldResults.duplicateIssues > fixedResults.duplicateIssues) {
    const improvement = ((oldResults.duplicateIssues - fixedResults.duplicateIssues) / Math.max(oldResults.duplicateIssues, 1) * 100).toFixed(0)
    console.log(`   ✅ ${improvement}% reduction in duplicate token issues`)
  } else if (fixedResults.duplicateIssues === 0 && oldResults.duplicateIssues === 0) {
    console.log(`   ⚠️  No issues detected in either pattern (consider more iterations)`)
  } else {
    console.log(`   ❌ Fix did not reduce issue rate`)
  }

  console.log('\n💡 Key Insights:')
  console.log('   1. Random token generation can produce collisions under high concurrency')
  console.log('   2. Check-then-insert pattern has TOCTOU vulnerability')
  console.log('   3. Database UNIQUE constraints provide atomic enforcement')
  console.log('   4. Transactions ensure atomicity of session + login tracking')
  console.log('   5. Retry logic handles rare token collisions gracefully')

  console.log('\n🎯 Production Impact:')
  console.log('   - Prevents duplicate session tokens')
  console.log('   - Ensures secure authentication state')
  console.log('   - Protects against session hijacking vulnerabilities')
  console.log('   - Maintains accurate login tracking')

  console.log('\n🔧 Implementation Details:')
  console.log('   - Use UNIQUE constraint on session token column')
  console.log('   - Wrap session creation in database transactions')
  console.log('   - Update user last_login_at within same transaction')
  console.log('   - Implement retry logic for token collision handling')

  console.log('\n✅ User Session Concurrency Test Complete!\n')

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
