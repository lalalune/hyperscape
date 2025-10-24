/**
 * Performance Benchmark Script
 *
 * Measures query performance before and after index application
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

console.log('[Benchmark] Using database:', DB_PATH)

const sqlite = new Database(DB_PATH)

// Enable query timing
sqlite.pragma('cache_size = -64000') // 64MB cache
sqlite.pragma('temp_store = MEMORY')

/**
 * Run query multiple times and measure average performance
 */
function benchmarkQuery(query, iterations = 100) {
  const times = []

  // Warm up (exclude from results)
  for (let i = 0; i < 10; i++) {
    sqlite.prepare(query).all()
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    sqlite.prepare(query).all()
    const end = performance.now()
    times.push(end - start)
  }

  // Calculate statistics
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  const sorted = times.sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]

  return { avg, min, max, median, p95 }
}

/**
 * Benchmark queries
 */
const queries = [
  {
    name: 'Assets: User recent (with index)',
    query: `SELECT * FROM assets WHERE user_id = 'test_user' ORDER BY created_at DESC LIMIT 20`,
  },
  {
    name: 'Assets: User status filter (with index)',
    query: `SELECT * FROM assets WHERE user_id = 'test_user' AND status = 'completed' LIMIT 50`,
  },
  {
    name: 'Assets: Type filter (with index)',
    query: `SELECT * FROM assets WHERE type = 'weapon' LIMIT 50`,
  },
  {
    name: 'Projects: User recent (with index)',
    query: `SELECT * FROM projects WHERE user_id = 'test_user' ORDER BY updated_at DESC LIMIT 20`,
  },
  {
    name: 'Projects: Type filter (with index)',
    query: `SELECT * FROM projects WHERE type = 'weapon' LIMIT 50`,
  },
  {
    name: 'Generation History: User timeline (with index)',
    query: `SELECT * FROM generation_history WHERE user_id = 'test_user' ORDER BY started_at DESC LIMIT 100`,
  },
  {
    name: 'Generation History: Status filter (with index)',
    query: `SELECT * FROM generation_history WHERE user_id = 'test_user' AND status = 'completed' LIMIT 100`,
  },
  {
    name: 'API Keys: User provider lookup (with index)',
    query: `SELECT * FROM api_keys WHERE user_id = 'test_user' AND provider = 'openai'`,
  },
]

console.log('\n========================================')
console.log('Query Performance Benchmark')
console.log('========================================\n')

// Get table row counts
console.log('Table Statistics:')
const tables = ['assets', 'projects', 'generation_history', 'voice_profiles', 'api_keys', 'sessions']
tables.forEach(table => {
  try {
    const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count
    console.log(`  ${table}: ${count.toLocaleString()} rows`)
  } catch (error) {
    console.log(`  ${table}: table not found`)
  }
})
console.log('')

// Run benchmarks
const results = []

for (const test of queries) {
  console.log(`Benchmarking: ${test.name}`)

  try {
    const stats = benchmarkQuery(test.query, 100)

    console.log(`  Average: ${stats.avg.toFixed(2)}ms`)
    console.log(`  Median:  ${stats.median.toFixed(2)}ms`)
    console.log(`  P95:     ${stats.p95.toFixed(2)}ms`)
    console.log(`  Min:     ${stats.min.toFixed(2)}ms`)
    console.log(`  Max:     ${stats.max.toFixed(2)}ms`)

    // Get query plan
    const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${test.query}`).all()
    const planText = plan.map(row => row.detail).join(' | ')
    console.log(`  Plan: ${planText}`)
    console.log('')

    results.push({
      name: test.name,
      query: test.query,
      avg: stats.avg,
      median: stats.median,
      p95: stats.p95,
      min: stats.min,
      max: stats.max,
      queryPlan: planText,
    })
  } catch (error) {
    console.log(`  Error: ${error.message}`)
    console.log('')
  }
}

// Summary
console.log('========================================')
console.log('Performance Summary')
console.log('========================================\n')

console.log('Query Performance (Average Times):')
results.forEach(r => {
  const color = r.avg < 50 ? '✓' : r.avg < 150 ? '⚠' : '✗'
  console.log(`  ${color} ${r.name}: ${r.avg.toFixed(2)}ms (p95: ${r.p95.toFixed(2)}ms)`)
})

console.log('')

// Overall statistics
const avgOfAvgs = results.reduce((sum, r) => sum + r.avg, 0) / results.length
const avgOfP95s = results.reduce((sum, r) => sum + r.p95, 0) / results.length

console.log(`Overall Average: ${avgOfAvgs.toFixed(2)}ms`)
console.log(`Overall P95: ${avgOfP95s.toFixed(2)}ms`)

console.log('')

// Performance goals
if (avgOfAvgs < 150) {
  console.log('✓ Performance goal achieved! Average query time < 150ms')
} else {
  console.log('⚠ Performance goal not met. Average query time > 150ms')
}

if (avgOfP95s < 200) {
  console.log('✓ P95 goal achieved! P95 query time < 200ms')
} else {
  console.log('⚠ P95 goal not met. P95 query time > 200ms')
}

sqlite.close()
