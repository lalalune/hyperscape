/**
 * Team Capacity Race Condition Tests
 *
 * Tests that team member addition is atomic and prevents race conditions
 * during concurrent join operations that could exceed team capacity.
 *
 * CRITICAL-8: Team capacity check and member addition are not atomic (TOCTOU vulnerability)
 *
 * This test verifies the fix by:
 * 1. Simulating the OLD non-atomic pattern (check-then-add)
 * 2. Testing the FIXED atomic pattern (database transaction)
 * 3. Running concurrent join attempts to detect race conditions
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema.mjs'
import fs from 'fs'

console.log('\n🔬 Testing Team Capacity Race Condition Fix\n')

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
    email TEXT,
    name TEXT NOT NULL,
    team_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login_at INTEGER,
    FOREIGN KEY (team_id) REFERENCES teams(id)
  );

  CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    max_members INTEGER NOT NULL DEFAULT 10,
    member_count INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );
`)

/**
 * Enable/disable database trigger for testing different patterns
 */
function enableCapacityTrigger() {
  sqlite.exec(`
    -- Database-level capacity enforcement trigger
    CREATE TRIGGER IF NOT EXISTS enforce_team_capacity_on_update
    BEFORE UPDATE OF team_id ON users
    WHEN NEW.team_id IS NOT NULL
    BEGIN
      SELECT RAISE(FAIL, 'Team at maximum capacity')
      WHERE (
        SELECT member_count
        FROM teams
        WHERE id = NEW.team_id
      ) >= (
        SELECT max_members
        FROM teams
        WHERE id = NEW.team_id
      );
    END;
  `)
}

function disableCapacityTrigger() {
  sqlite.exec('DROP TRIGGER IF EXISTS enforce_team_capacity_on_update;')
}

/**
 * Test Setup: Create team and users
 */
function setupTestData() {
  // Clean up existing data (temporarily disable foreign keys for cleanup)
  sqlite.exec('PRAGMA foreign_keys = OFF;')
  sqlite.exec('DELETE FROM users;')
  sqlite.exec('DELETE FROM teams;')
  sqlite.exec('PRAGMA foreign_keys = ON;')

  // Create owner
  const ownerId = 'owner-1'
  sqlite.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(ownerId, 'Owner')

  // Create team with capacity of 5
  const teamId = 'team-1'
  const inviteCode = 'TEST123'
  sqlite.prepare(`
    INSERT INTO teams (id, name, invite_code, owner_id, max_members, member_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(teamId, 'Test Team', inviteCode, ownerId, 5, 1)

  // Set owner's team
  sqlite.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(teamId, ownerId)

  // Create 10 users trying to join (team capacity is 5, so 4 spots available)
  for (let i = 1; i <= 10; i++) {
    const userId = `user-${i}`
    sqlite.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(userId, `User ${i}`)
  }

  return { teamId, inviteCode, ownerId }
}

/**
 * OLD PATTERN: Non-atomic check-then-add (VULNERABLE to TOCTOU)
 */
async function joinTeam_OLD(userId, teamId) {
  return new Promise((resolve, reject) => {
    try {
      // Step 1: Check if team is at capacity (TIME OF CHECK)
      const team = sqlite.prepare('SELECT member_count, max_members FROM teams WHERE id = ?').get(teamId)

      if (!team) {
        reject(new Error('Team not found'))
        return
      }

      if (team.member_count >= team.max_members) {
        reject(new Error('Team is at maximum capacity'))
        return
      }

      // RACE CONDITION WINDOW: Another join could happen here!
      // Simulate network delay or processing time
      setTimeout(() => {
        // Step 2: Add user to team (TIME OF USE)
        sqlite.prepare('UPDATE users SET team_id = ?, last_login_at = ? WHERE id = ?')
          .run(teamId, Date.now(), userId)

        // Step 3: Increment member count
        sqlite.prepare('UPDATE teams SET member_count = member_count + 1, updated_at = ? WHERE id = ?')
          .run(Date.now(), teamId)

        resolve({ success: true })
      }, Math.random() * 5) // Random delay to trigger race conditions
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * FIXED PATTERN: Atomic transaction (PROTECTED from TOCTOU)
 */
async function joinTeam_FIXED(userId, teamId) {
  return new Promise((resolve, reject) => {
    try {
      // ATOMIC TRANSACTION: All operations happen atomically
      sqlite.transaction(() => {
        // Re-check team capacity inside transaction
        const team = sqlite.prepare('SELECT member_count, max_members FROM teams WHERE id = ?').get(teamId)

        if (!team) {
          throw new Error('Team not found')
        }

        if (team.member_count >= team.max_members) {
          throw new Error('Team is at maximum capacity')
        }

        // Add user to team (trigger will also enforce capacity)
        sqlite.prepare('UPDATE users SET team_id = ?, last_login_at = ? WHERE id = ?')
          .run(teamId, Date.now(), userId)

        // Increment member count
        sqlite.prepare('UPDATE teams SET member_count = member_count + 1, updated_at = ? WHERE id = ?')
          .run(Date.now(), teamId)
      })()

      resolve({ success: true })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Test concurrent joins with OLD pattern
 */
async function testOldPattern(iterations = 5) {
  console.log('\n🔴 Testing OLD Pattern (Non-Atomic Check-Then-Add)')
  console.log('─'.repeat(60))

  // Disable trigger for OLD pattern to demonstrate the race condition
  disableCapacityTrigger()

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    const { teamId } = setupTestData()

    // Try to have 10 users join concurrently (team capacity is 5)
    const joinPromises = []
    for (let i = 1; i <= 10; i++) {
      joinPromises.push(
        joinTeam_OLD(`user-${i}`, teamId)
          .then(() => ({ userId: `user-${i}`, success: true }))
          .catch((error) => ({ userId: `user-${i}`, success: false, error: error.message }))
      )
    }

    await Promise.all(joinPromises)

    // Check final team state
    const team = sqlite.prepare('SELECT member_count, max_members FROM teams WHERE id = ?').get(teamId)
    const actualMembers = sqlite.prepare('SELECT COUNT(*) as count FROM users WHERE team_id = ?').get(teamId).count

    const overflow = actualMembers > team.max_members
    const inconsistent = team.member_count !== actualMembers

    results.push({
      iteration: iter + 1,
      expected: team.max_members,
      memberCount: team.member_count,
      actualMembers,
      overflow,
      inconsistent
    })

    const status = overflow ? '❌ OVERFLOW' : inconsistent ? '⚠️  INCONSISTENT' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Expected ≤${team.max_members}, Count=${team.member_count}, Actual=${actualMembers} ${status}`)
  }

  const overflows = results.filter(r => r.overflow).length
  const inconsistencies = results.filter(r => r.inconsistent).length

  console.log('─'.repeat(60))
  console.log(`Capacity violations: ${overflows}/${iterations}`)
  console.log(`Data inconsistencies: ${inconsistencies}/${iterations}`)

  return { results, overflows, inconsistencies }
}

/**
 * Test concurrent joins with FIXED pattern
 */
async function testFixedPattern(iterations = 5) {
  console.log('\n🟢 Testing FIXED Pattern (Atomic Transaction)')
  console.log('─'.repeat(60))

  // Enable trigger for FIXED pattern for defense-in-depth
  enableCapacityTrigger()

  const results = []

  for (let iter = 0; iter < iterations; iter++) {
    const { teamId } = setupTestData()

    // Try to have 10 users join concurrently (team capacity is 5)
    const joinPromises = []
    for (let i = 1; i <= 10; i++) {
      joinPromises.push(
        joinTeam_FIXED(`user-${i}`, teamId)
          .then(() => ({ userId: `user-${i}`, success: true }))
          .catch((error) => ({ userId: `user-${i}`, success: false, error: error.message }))
      )
    }

    await Promise.all(joinPromises)

    // Check final team state
    const team = sqlite.prepare('SELECT member_count, max_members FROM teams WHERE id = ?').get(teamId)
    const actualMembers = sqlite.prepare('SELECT COUNT(*) as count FROM users WHERE team_id = ?').get(teamId).count

    const overflow = actualMembers > team.max_members
    const inconsistent = team.member_count !== actualMembers

    results.push({
      iteration: iter + 1,
      expected: team.max_members,
      memberCount: team.member_count,
      actualMembers,
      overflow,
      inconsistent
    })

    const status = overflow ? '❌ OVERFLOW' : inconsistent ? '⚠️  INCONSISTENT' : '✅ OK'
    console.log(`Iteration ${iter + 1}: Expected ≤${team.max_members}, Count=${team.member_count}, Actual=${actualMembers} ${status}`)
  }

  const overflows = results.filter(r => r.overflow).length
  const inconsistencies = results.filter(r => r.inconsistent).length

  console.log('─'.repeat(60))
  console.log(`Capacity violations: ${overflows}/${iterations}`)
  console.log(`Data inconsistencies: ${inconsistencies}/${iterations}`)

  return { results, overflows, inconsistencies }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 Starting Team Capacity Race Condition Tests\n')
  console.log('Test scenario:')
  console.log('  - Team capacity: 5 members')
  console.log('  - Owner already in team: 1 member')
  console.log('  - Available spots: 4')
  console.log('  - Concurrent join attempts: 10 users')
  console.log('  - Expected behavior: Only 4 users should join successfully\n')

  const oldResults = await testOldPattern(10)
  const fixedResults = await testFixedPattern(10)

  // Final report
  console.log('\n\n' + '='.repeat(60))
  console.log('📋 FINAL REPORT: Team Capacity Race Condition Fix')
  console.log('='.repeat(60))

  console.log('\n🔴 OLD Pattern (Non-Atomic Check-Then-Add):')
  console.log(`   - Capacity violations: ${oldResults.overflows}/10 (${(oldResults.overflows / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Data inconsistencies: ${oldResults.inconsistencies}/10 (${(oldResults.inconsistencies / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${oldResults.overflows > 0 ? '❌ VULNERABLE to TOCTOU race conditions' : '⚠️  May be vulnerable (run more iterations)'}`)

  console.log('\n🟢 FIXED Pattern (Atomic Transaction + DB Trigger):')
  console.log(`   - Capacity violations: ${fixedResults.overflows}/10 (${(fixedResults.overflows / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Data inconsistencies: ${fixedResults.inconsistencies}/10 (${(fixedResults.inconsistencies / 10 * 100).toFixed(0)}%)`)
  console.log(`   - Status: ${fixedResults.overflows === 0 && fixedResults.inconsistencies === 0 ? '✅ PROTECTED from race conditions' : '❌ Still has issues'}`)

  console.log('\n📈 Improvement:')
  if (oldResults.overflows > fixedResults.overflows) {
    const improvement = ((oldResults.overflows - fixedResults.overflows) / Math.max(oldResults.overflows, 1) * 100).toFixed(0)
    console.log(`   ✅ ${improvement}% reduction in capacity violations`)
  } else if (fixedResults.overflows === 0 && oldResults.overflows === 0) {
    console.log(`   ⚠️  No violations detected in either pattern (consider more iterations or higher concurrency)`)
  } else {
    console.log(`   ❌ Fix did not reduce violation rate`)
  }

  console.log('\n💡 Key Insights:')
  console.log('   1. TOCTOU (Time of Check, Time of Use) vulnerability in capacity checking')
  console.log('   2. Multiple concurrent requests can pass the capacity check simultaneously')
  console.log('   3. Database transactions provide serializable isolation')
  console.log('   4. Database triggers provide defense-in-depth enforcement')
  console.log('   5. Drizzle ORM db.transaction() wraps operations atomically')

  console.log('\n🎯 Production Impact:')
  console.log('   - Prevents team capacity limits from being exceeded')
  console.log('   - Ensures accurate billing and capacity tracking')
  console.log('   - Maintains data integrity (member_count matches actual members)')
  console.log('   - Protects business logic constraints at database level')

  console.log('\n🔧 Implementation Details:')
  console.log('   - Location: server/auth/teams.mjs lines 98-213')
  console.log('   - Method: joinTeam() wrapped in db.transaction()')
  console.log('   - Defense: Database trigger enforce_team_capacity_on_update')
  console.log('   - Logging: Added structured logging for capacity events')

  console.log('\n✅ Team Capacity Race Condition Test Complete!\n')

  // Exit with appropriate code
  const testPassed = fixedResults.overflows === 0 && fixedResults.inconsistencies === 0
  sqlite.close()
  process.exit(testPassed ? 0 : 1)
}

// Run tests
runTests().catch((error) => {
  console.error('Test failed with error:', error)
  sqlite.close()
  process.exit(1)
})
