#!/usr/bin/env node

/**
 * Quick Railway Database Connection Test
 *
 * Tests:
 * - Database connectivity
 * - Schema existence
 * - Table counts
 * - Sample data retrieval
 *
 * Usage:
 *   railway run node scripts/test-railway-connection.mjs
 */

import pg from 'pg'

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  console.error('   Run: railway run node scripts/test-railway-connection.mjs')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function testConnection() {
  console.log('🧪 Railway Database Connection Test')
  console.log('='.repeat(60))

  try {
    // Test 1: Basic connectivity
    console.log('\n1️⃣  Testing connection...')
    const timeResult = await pool.query('SELECT NOW() as now, current_database() as db')
    console.log(`   ✅ Connected to: ${timeResult.rows[0].db}`)
    console.log(`   ⏰ Server time: ${timeResult.rows[0].now}`)

    // Test 2: Check tables
    console.log('\n2️⃣  Checking schema...')
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    if (tablesResult.rows.length === 0) {
      console.log('   ⚠️  No tables found! Run setup-railway-database.mjs first')
      process.exit(1)
    }

    console.log(`   ✅ Found ${tablesResult.rows.length} tables`)

    // Test 3: Check key tables exist
    console.log('\n3️⃣  Verifying key tables...')
    const keyTables = ['users', 'preview_manifests', 'manifest_submissions', 'teams', 'api_keys']
    const existingTables = tablesResult.rows.map(r => r.table_name)

    for (const table of keyTables) {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table}`)
      } else {
        console.log(`   ❌ ${table} (missing)`)
      }
    }

    // Test 4: Count rows in key tables
    console.log('\n4️⃣  Counting table rows...')
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM preview_manifests'),
      pool.query('SELECT COUNT(*) as count FROM manifest_submissions'),
      pool.query('SELECT COUNT(*) as count FROM teams'),
    ])

    console.log(`   Users: ${counts[0].rows[0].count}`)
    console.log(`   Preview Manifests: ${counts[1].rows[0].count}`)
    console.log(`   Submissions: ${counts[2].rows[0].count}`)
    console.log(`   Teams: ${counts[3].rows[0].count}`)

    // Test 5: Check preview manifests detail
    if (parseInt(counts[1].rows[0].count) > 0) {
      console.log('\n5️⃣  Preview manifests detail...')
      const manifestsResult = await pool.query(`
        SELECT
          manifest_type,
          jsonb_array_length(content) as item_count,
          is_original,
          status,
          version
        FROM preview_manifests
        ORDER BY manifest_type
      `)

      console.log('\n   ┌────────────────┬───────┬──────────┬──────────┬─────────┐')
      console.log('   │ Type           │ Items │ Original │ Status   │ Version │')
      console.log('   ├────────────────┼───────┼──────────┼──────────┼─────────┤')

      for (const row of manifestsResult.rows) {
        const type = row.manifest_type.padEnd(14)
        const items = String(row.item_count || 0).padStart(5)
        const orig = (row.is_original ? 'Yes' : 'No').padEnd(8)
        const status = (row.status || 'N/A').padEnd(8)
        const version = String(row.version || 1).padStart(7)
        console.log(`   │ ${type} │ ${items} │ ${orig} │ ${status} │ ${version} │`)
      }

      console.log('   └────────────────┴───────┴──────────┴──────────┴─────────┘')
    } else {
      console.log('\n5️⃣  No preview manifests found')
      console.log('   💡 Run: railway run node server/scripts/migrate-manifests-to-postgres.mjs')
    }

    // Test 6: Database size
    console.log('\n6️⃣  Database statistics...')
    const sizeResult = await pool.query(`
      SELECT
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        pg_size_pretty(pg_total_relation_size('preview_manifests')) as manifests_size
    `)
    console.log(`   Database size: ${sizeResult.rows[0].db_size}`)
    console.log(`   Manifests table size: ${sizeResult.rows[0].manifests_size}`)

    console.log('\n' + '='.repeat(60))
    console.log('✅ ALL TESTS PASSED')
    console.log('='.repeat(60))
    console.log('\n💡 Next steps:')
    console.log('   - If no manifests: Run migration script')
    console.log('   - If no users: Users will be created on first login')
    console.log('   - Deploy API: git push origin main')
    console.log('   - Test frontend: Check VITE_API_URL points to this API\n')

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

testConnection()
