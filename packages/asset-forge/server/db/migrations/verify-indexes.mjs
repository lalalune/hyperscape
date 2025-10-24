/**
 * Index Verification Script
 *
 * Verifies that performance indexes are created and being used by queries
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Database path
const DB_PATH = process.env.DATABASE_PATH ||
  (process.env.VERCEL === '1'
    ? '/tmp/asset-forge.db'
    : path.join(__dirname, '../../../data/asset-forge.db')
  )

console.log('[Verify] Using database:', DB_PATH)

const sqlite = new Database(DB_PATH, { readonly: true })

/**
 * Test cases to verify index usage
 */
const testCases = [
  {
    name: 'Assets: User\'s recent assets',
    query: `SELECT * FROM assets WHERE user_id = 'test_user' ORDER BY created_at DESC LIMIT 20`,
    expectedIndex: 'idx_assets_user_created',
  },
  {
    name: 'Assets: User\'s completed assets',
    query: `SELECT * FROM assets WHERE user_id = 'test_user' AND status = 'completed'`,
    expectedIndex: 'idx_assets_user_status',
  },
  {
    name: 'Assets: Filter by type',
    query: `SELECT * FROM assets WHERE type = 'weapon' LIMIT 20`,
    expectedIndex: 'idx_assets_type',
  },
  {
    name: 'Assets: Filter by status',
    query: `SELECT * FROM assets WHERE status = 'completed' LIMIT 20`,
    expectedIndex: 'idx_assets_status',
  },
  {
    name: 'Projects: User\'s recent projects',
    query: `SELECT * FROM projects WHERE user_id = 'test_user' ORDER BY updated_at DESC LIMIT 20`,
    expectedIndex: 'idx_projects_user_updated',
  },
  {
    name: 'Projects: Filter by type',
    query: `SELECT * FROM projects WHERE type = 'weapon'`,
    expectedIndex: 'idx_projects_type',
  },
  {
    name: 'Projects: Filter by game style',
    query: `SELECT * FROM projects WHERE game_style = 'pixel-art'`,
    expectedIndex: 'idx_projects_game_style',
  },
  {
    name: 'Generation History: User\'s history timeline',
    query: `SELECT * FROM generation_history WHERE user_id = 'test_user' ORDER BY started_at DESC LIMIT 50`,
    expectedIndex: 'idx_generation_history_user_started',
  },
  {
    name: 'Generation History: User\'s status filter',
    query: `SELECT * FROM generation_history WHERE user_id = 'test_user' AND status = 'completed'`,
    expectedIndex: 'idx_generation_history_user_status',
  },
  {
    name: 'Generation History: Provider filter',
    query: `SELECT * FROM generation_history WHERE provider = 'meshy'`,
    expectedIndex: 'idx_generation_history_provider',
  },
  {
    name: 'API Keys: User\'s provider lookup',
    query: `SELECT * FROM api_keys WHERE user_id = 'test_user' AND provider = 'openai'`,
    expectedIndex: 'idx_api_keys_user_provider',
  },
  {
    name: 'API Keys: User lookup',
    query: `SELECT * FROM api_keys WHERE user_id = 'test_user'`,
    expectedIndex: 'idx_api_keys_user',
  },
  {
    name: 'Voice Profiles: User lookup',
    query: `SELECT * FROM voice_profiles WHERE user_id = 'test_user'`,
    expectedIndex: 'idx_voice_profiles_user',
  },
  {
    name: 'Voice Profiles: Project lookup',
    query: `SELECT * FROM voice_profiles WHERE project_id = 'test_project'`,
    expectedIndex: 'idx_voice_profiles_project',
  },
  {
    name: 'Sessions: Expire check',
    query: `SELECT * FROM sessions WHERE expires_at > 1234567890`,
    expectedIndex: 'idx_sessions_expires_at',
  },
]

console.log('\n========================================')
console.log('Index Verification Test Suite')
console.log('========================================\n')

let passCount = 0
let failCount = 0
const results = []

for (const test of testCases) {
  console.log(`Testing: ${test.name}`)
  console.log(`Query: ${test.query}`)
  console.log(`Expected Index: ${test.expectedIndex}`)

  try {
    // Run EXPLAIN QUERY PLAN
    const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${test.query}`).all()

    // Check if expected index is used
    const planText = plan.map(row => row.detail).join(' ')
    const usesExpectedIndex = planText.includes(test.expectedIndex)
    const usesTableScan = planText.includes('SCAN TABLE')

    let status
    let detail

    if (usesExpectedIndex) {
      status = 'PASS'
      passCount++
      detail = `✓ Index ${test.expectedIndex} is being used`
    } else if (usesTableScan) {
      status = 'FAIL'
      failCount++
      detail = `✗ Table scan detected - index not used`
    } else {
      status = 'WARN'
      failCount++
      detail = `? Different index used: ${planText}`
    }

    console.log(`Status: ${status}`)
    console.log(`Detail: ${detail}`)
    console.log(`Query Plan:`)
    plan.forEach(row => {
      console.log(`  ${row.detail}`)
    })
    console.log('')

    results.push({
      name: test.name,
      query: test.query,
      expectedIndex: test.expectedIndex,
      status,
      detail,
      queryPlan: plan,
    })
  } catch (error) {
    console.log(`Status: ERROR`)
    console.log(`Error: ${error.message}`)
    console.log('')

    failCount++
    results.push({
      name: test.name,
      query: test.query,
      expectedIndex: test.expectedIndex,
      status: 'ERROR',
      detail: error.message,
    })
  }
}

console.log('========================================')
console.log('Test Summary')
console.log('========================================')
console.log(`Total Tests: ${testCases.length}`)
console.log(`Passed: ${passCount}`)
console.log(`Failed: ${failCount}`)
console.log(`Success Rate: ${((passCount / testCases.length) * 100).toFixed(1)}%`)
console.log('')

// List all created indexes
console.log('========================================')
console.log('All Database Indexes')
console.log('========================================')

const tables = ['assets', 'projects', 'generation_history', 'voice_profiles', 'api_keys', 'sessions', 'users', 'teams']

for (const table of tables) {
  try {
    const indexes = sqlite.prepare(`PRAGMA index_list('${table}')`).all()

    if (indexes.length > 0) {
      console.log(`\n${table.toUpperCase()}:`)
      indexes.forEach(idx => {
        const info = sqlite.prepare(`PRAGMA index_info('${idx.name}')`).all()
        const columns = info.map(i => i.name).join(', ')
        console.log(`  - ${idx.name}: (${columns})`)
      })
    }
  } catch (error) {
    // Table might not exist
  }
}

sqlite.close()

// Exit with error code if any tests failed
if (failCount > 0) {
  console.log('\n⚠️  Some tests failed. Please review the results above.')
  process.exit(1)
} else {
  console.log('\n✓ All tests passed!')
  process.exit(0)
}
