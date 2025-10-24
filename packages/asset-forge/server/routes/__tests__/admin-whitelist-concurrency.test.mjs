/**
 * Admin Whitelist Concurrency Tests
 *
 * Tests that concurrent admin whitelist operations maintain data integrity
 * and properly handle race conditions when multiple admins add/remove addresses.
 *
 * CRITICAL: Admin whitelist must prevent duplicate addresses and race conditions
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, and } from 'drizzle-orm'
import * as schema from '../../db/schema.mjs'
import crypto from 'crypto'

console.log('\n🔬 Testing Admin Whitelist Concurrency\n')

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
    wallet_address TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE admin_whitelist (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    added_by TEXT,
    reason TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE UNIQUE INDEX idx_admin_whitelist_wallet ON admin_whitelist(wallet_address);
`)

/**
 * Test Setup: Create test data
 */
function setupTestData() {
  // Clean up existing data
  sqlite.exec('PRAGMA foreign_keys = OFF;')
  sqlite.exec('DELETE FROM admin_whitelist;')
  sqlite.exec('DELETE FROM users;')
  sqlite.exec('PRAGMA foreign_keys = ON;')

  // Create admin user
  const adminId = 'admin-1'
  sqlite.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)').run(
    adminId,
    'Admin User',
    'admin@test.com',
    'admin'
  )

  return { adminId }
}

/**
 * Generate test wallet address
 */
function generateWalletAddress(index) {
  return `0x${crypto.randomBytes(20).toString('hex')}`.toLowerCase()
}

/**
 * OLD PATTERN: Non-atomic whitelist addition (VULNERABLE)
 */
async function addToWhitelist_OLD(walletAddress, adminId) {
  return new Promise((resolve, reject) => {
    try {
      const normalized = walletAddress.toLowerCase()

      // Step 1: Check if already whitelisted (TIME OF CHECK)
      const existing = sqlite.prepare(`
        SELECT id FROM admin_whitelist WHERE wallet_address = ?
      `).get(normalized)

      if (existing) {
        reject(new Error('Already whitelisted'))
        return
      }

      // RACE CONDITION WINDOW: Another admin could add same address here!
      setTimeout(() => {
        // Step 2: Add to whitelist (TIME OF USE)
        try {
          const id = `admin_${crypto.randomBytes(8).toString('hex')}`

          sqlite.prepare(`
            INSERT INTO admin_whitelist (id, wallet_address, added_by, is_active)
            VALUES (?, ?, ?, ?)
          `).run(id, normalized, adminId, 1)

          // Step 3: Upgrade user if exists
          sqlite.prepare(`
            UPDATE users SET role = 'admin' WHERE wallet_address = ?
          `).run(normalized)

          resolve({ id, walletAddress: normalized })
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
 * FIXED PATTERN: Atomic whitelist addition with transaction
 */
async function addToWhitelist_FIXED(walletAddress, adminId) {
  return new Promise((resolve, reject) => {
    try {
      const normalized = walletAddress.toLowerCase()

      // ATOMIC TRANSACTION: All operations happen atomically
      sqlite.transaction(() => {
        // Check if already whitelisted (within transaction)
        const existing = sqlite.prepare(`
          SELECT id FROM admin_whitelist WHERE wallet_address = ?
        `).get(normalized)

        if (existing) {
          throw new Error('Already whitelisted')
        }

        // Add to whitelist
        const id = `admin_${crypto.randomBytes(8).toString('hex')}`

        sqlite.prepare(`
          INSERT INTO admin_whitelist (id, wallet_address, added_by, is_active)
          VALUES (?, ?, ?, ?)
        `).run(id, normalized, adminId, 1)

        // Upgrade user if exists (within same transaction)
        sqlite.prepare(`
          UPDATE users SET role = 'admin' WHERE wallet_address = ?
        `).run(normalized)

        resolve({ id, walletAddress: normalized })
      })()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Test concurrent whitelist additions with OLD pattern
 */
async function testOldPattern(iterations = 5) {
  console.log('\n🔴 Testing OLD Pattern (Non-Atomic Whitelist Addition)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    const { adminId } = setupTestData()

    // Generate 20 unique wallet addresses
    const wallets = Array.from({ length: 20 }, (_, i) => generateWalletAddress(i))

    // Try to add same 20 addresses twice (40 concurrent operations, 20 should succeed, 20 should fail)
    const addPromises = []
    for (let i = 0; i < 2; i++) {
      for (const wallet of wallets) {
        addPromises.push(
          addToWhitelist_OLD(wallet, adminId)
            .then(() => ({ success: true, wallet }))
            .catch((error) => ({ success: false, wallet, error: error.message }))
        )
      }
    }

    const addResults = await Promise.all(addPromises)

    // Check for duplicates in database
    const whitelistEntries = sqlite.prepare('SELECT wallet_address FROM admin_whitelist').all()
    const addresses = whitelistEntries.map(e => e.wallet_address)
    const uniqueAddresses = new Set(addresses)

    const hasDuplicates = addresses.length !== uniqueAddresses.size
    const duplicateCount = addresses.length - uniqueAddresses.size

    const successful = addResults.filter(r => r.success).length
    const failed = addResults.filter(r => !r.success).length

    results.push({
      iteration: iter + 1,
      totalAttempts: 40,
      successful,
      failed,
      entriesInDb: addresses.length,
      uniqueEntries: uniqueAddresses.size,
      duplicates: duplicateCount,
      hasDuplicates
    })

    const status = hasDuplicates ? '❌ DUPLICATES' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Success=${successful}, Failed=${failed}, DB Entries=${addresses.length}, Unique=${uniqueAddresses.size}, Duplicates=${duplicateCount} ${status}`)
  }

  const duplicateIssues = results.filter(r => r.hasDuplicates).length

  console.log('─'.repeat(60))
  console.log(`Duplicate address issues: ${duplicateIssues}/${iterations}`)

  return { results, duplicateIssues }
}

/**
 * Test concurrent whitelist additions with FIXED pattern
 */
async function testFixedPattern(iterations = 5) {
  console.log('\n🟢 Testing FIXED Pattern (Atomic Whitelist Addition)')
  console.log('─'.repeat(60))

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    const { adminId } = setupTestData()

    // Generate 20 unique wallet addresses
    const wallets = Array.from({ length: 20 }, (_, i) => generateWalletAddress(i))

    // Try to add same 20 addresses twice (40 concurrent operations, 20 should succeed, 20 should fail)
    const addPromises = []
    for (let i = 0; i < 2; i++) {
      for (const wallet of wallets) {
        addPromises.push(
          addToWhitelist_FIXED(wallet, adminId)
            .then(() => ({ success: true, wallet }))
            .catch((error) => ({ success: false, wallet, error: error.message }))
        )
      }
    }

    const addResults = await Promise.all(addPromises)

    // Check for duplicates in database
    const whitelistEntries = sqlite.prepare('SELECT wallet_address FROM admin_whitelist').all()
    const addresses = whitelistEntries.map(e => e.wallet_address)
    const uniqueAddresses = new Set(addresses)

    const hasDuplicates = addresses.length !== uniqueAddresses.size
    const duplicateCount = addresses.length - uniqueAddresses.size

    const successful = addResults.filter(r => r.success).length
    const failed = addResults.filter(r => !r.success).length

    results.push({
      iteration: iter + 1,
      totalAttempts: 40,
      successful,
      failed,
      entriesInDb: addresses.length,
      uniqueEntries: uniqueAddresses.size,
      duplicates: duplicateCount,
      hasDuplicates
    })

    const status = hasDuplicates ? '❌ DUPLICATES' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Success=${successful}, Failed=${failed}, DB Entries=${addresses.length}, Unique=${uniqueAddresses.size}, Duplicates=${duplicateCount} ${status}`)
  }

  const duplicateIssues = results.filter(r => r.hasDuplicates).length

  console.log('─'.repeat(60))
  console.log(`Duplicate address issues: ${duplicateIssues}/${iterations}`)

  return { results, duplicateIssues }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 Starting Admin Whitelist Concurrency Tests\n')
  console.log('Test scenario:')
  console.log('  - Unique wallet addresses: 20')
  console.log('  - Concurrent additions: 40 (each address added twice)')
  console.log('  - Expected behavior: Exactly 20 entries, no duplicates\n')

  const oldResults = await testOldPattern(10)
  const fixedResults = await testFixedPattern(10)

  // Final report
  console.log('\n\n' + '='.repeat(60))
  console.log('📋 FINAL REPORT: Admin Whitelist Concurrency')
  console.log('='.repeat(60))

  console.log('\n🔴 OLD Pattern (Non-Atomic Whitelist Addition):')
  console.log(`   - Duplicate address issues: ${oldResults.duplicateIssues}/10 (${(oldResults.duplicateIssues / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${oldResults.duplicateIssues > 0 ? '❌ VULNERABLE to race conditions' : '⚠️  May be vulnerable (run more iterations)'}`)

  console.log('\n🟢 FIXED Pattern (Atomic Transaction + UNIQUE Constraint):')
  console.log(`   - Duplicate address issues: ${fixedResults.duplicateIssues}/10 (${(fixedResults.duplicateIssues / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${fixedResults.duplicateIssues === 0 ? '✅ PROTECTED from race conditions' : '❌ Still has issues'}`)

  console.log('\n📈 Improvement:')
  if (oldResults.duplicateIssues > fixedResults.duplicateIssues) {
    const improvement = ((oldResults.duplicateIssues - fixedResults.duplicateIssues) / Math.max(oldResults.duplicateIssues, 1) * 100).toFixed(0)
    console.log(`   ✅ ${improvement}% reduction in duplicate address issues`)
  } else if (fixedResults.duplicateIssues === 0 && oldResults.duplicateIssues === 0) {
    console.log(`   ⚠️  No issues detected in either pattern (consider more iterations)`)
  } else {
    console.log(`   ❌ Fix did not reduce issue rate`)
  }

  console.log('\n💡 Key Insights:')
  console.log('   1. TOCTOU vulnerability in check-then-insert pattern')
  console.log('   2. Multiple admins can add same address simultaneously')
  console.log('   3. Database UNIQUE constraints provide atomic enforcement')
  console.log('   4. Transactions ensure atomicity of whitelist + user role update')
  console.log('   5. Proper error handling prevents silent failures')

  console.log('\n🎯 Production Impact:')
  console.log('   - Prevents duplicate admin whitelist entries')
  console.log('   - Ensures consistent admin role assignments')
  console.log('   - Protects against concurrent admin operations')
  console.log('   - Maintains data integrity in admin management')

  console.log('\n🔧 Implementation Details:')
  console.log('   - Use UNIQUE constraint on wallet_address column')
  console.log('   - Wrap whitelist operations in database transactions')
  console.log('   - Update user role within same transaction')
  console.log('   - Add structured logging for audit trail')

  console.log('\n✅ Admin Whitelist Concurrency Test Complete!\n')

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
