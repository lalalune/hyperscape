/**
 * One-Time Migration: Manifests to PostgreSQL
 * Migrates all manifest files from filesystem into preview_manifests table
 * Includes all GLB file references and manifest data
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Database connection - use Railway environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Increased for Railway
})

// Fallback to local config if DATABASE_URL not set
if (!process.env.DATABASE_URL) {
  console.log('⚠️  DATABASE_URL not set, using local configuration')
}

// Path to original manifests - check multiple locations
async function getManifestsPath() {
  const possiblePaths = [
    path.join(__dirname, '../../../../assets/world/manifests'), // Local dev
    path.join(__dirname, '../../../../../assets/world/manifests'), // Railway from apps/api
    '/app/assets/world/manifests', // Railway absolute
    process.env.MANIFESTS_PATH
  ].filter(Boolean)

  for (const testPath of possiblePaths) {
    try {
      const stats = await fs.stat(testPath)
      if (stats.isDirectory()) {
        console.log(`✅ Found manifests at: ${testPath}`)
        return testPath
      }
    } catch {
      // Path doesn't exist, continue
    }
  }

  // Default to workspace path
  console.log('⚠️  No manifest path found, using default')
  return path.join(__dirname, '../../../../assets/world/manifests')
}

/**
 * Ensure preview_manifests table has all required columns
 */
async function updateTableSchema() {
  console.log('\n🔧 Checking/updating preview_manifests schema...')

  try {
    // Add is_original column if it doesn't exist
    await pool.query(`
      ALTER TABLE preview_manifests 
      ADD COLUMN IF NOT EXISTS is_original BOOLEAN DEFAULT false
    `)
    
    // Add status column if it doesn't exist
    await pool.query(`
      ALTER TABLE preview_manifests 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft'
    `)
    
    // Add published_at column if it doesn't exist
    await pool.query(`
      ALTER TABLE preview_manifests 
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE
    `)

    console.log('  ✅ Schema updated successfully')
  } catch (error) {
    console.error('  ❌ Schema update failed:', error.message)
    throw error
  }
}

/**
 * Get or create system user for original manifests
 */
async function getSystemUser() {
  console.log('\n👤 Getting system user...')

  try {
    const result = await pool.query(`
      SELECT id FROM users WHERE privy_user_id = 'system' LIMIT 1
    `)

    if (result.rows.length > 0) {
      console.log(`  ✅ Found system user: ${result.rows[0].id}`)
      return result.rows[0].id
    }

    // Create system user
    console.log('  🆕 Creating system user...')
    const insertResult = await pool.query(`
      INSERT INTO users (privy_user_id, email, display_name, role)
      VALUES ('system', 'system@hyperscape.ai', 'System', 'admin')
      ON CONFLICT (privy_user_id) DO UPDATE
      SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
      RETURNING id
    `)

    console.log(`  ✅ Created system user: ${insertResult.rows[0].id}`)
    return insertResult.rows[0].id
  } catch (error) {
    console.error('  ❌ Failed to get/create system user:', error.message)
    throw error
  }
}

/**
 * Load manifest file from filesystem
 */
async function loadManifest(manifestType, manifestsPath) {
  try {
    const filePath = path.join(manifestsPath, `${manifestType}.json`)
    console.log(`  📂 Reading: ${filePath}`)
    
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    
    if (!Array.isArray(data)) {
      console.warn(`  ⚠️  Manifest ${manifestType} is not an array, converting...`)
      return Object.values(data)
    }
    
    return data
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`  ⚠️  Manifest file not found: ${manifestType}.json`)
      return []
    }
    throw error
  }
}

/**
 * Extract all GLB references from manifest items
 */
function extractGLBReferences(manifestData) {
  const glbRefs = []
  
  for (const item of manifestData) {
    // Check modelPath
    if (item.modelPath && item.modelPath.endsWith('.glb')) {
      glbRefs.push(item.modelPath)
    }
    
    // Check iconPath for potential GLB references
    if (item.iconPath && item.iconPath.endsWith('.glb')) {
      glbRefs.push(item.iconPath)
    }
    
    // Check nested appearance objects (NPCs)
    if (item.appearance && item.appearance.modelPath) {
      if (item.appearance.modelPath.endsWith('.glb')) {
        glbRefs.push(item.appearance.modelPath)
      }
    }
  }
  
  return glbRefs
}

/**
 * Migrate a single manifest type to PostgreSQL
 */
async function migrateManifest(userId, manifestType, manifestsPath) {
  console.log(`\n📋 Migrating ${manifestType} manifest...`)

  try {
    // Load original manifest from filesystem
    const content = await loadManifest(manifestType, manifestsPath)

    if (!Array.isArray(content) || content.length === 0) {
      console.log(`  ⏭️  Skipping ${manifestType} - no items found`)
      return { success: true, skipped: true }
    }

    console.log(`  📊 Found ${content.length} items in ${manifestType}.json`)
    
    // Extract GLB references
    const glbRefs = extractGLBReferences(content)
    console.log(`  🎨 Found ${glbRefs.length} GLB model references`)
    if (glbRefs.length > 0) {
      console.log(`     Sample: ${glbRefs[0]}`)
    }

    // Check if preview manifest already exists
    const existingResult = await pool.query(
      `SELECT id, content FROM preview_manifests
       WHERE user_id = $1 AND manifest_type = $2`,
      [userId, manifestType]
    )

    if (existingResult.rows.length > 0) {
      console.log(`  ♻️  Updating existing preview manifest...`)

      // Update existing manifest
      const updateResult = await pool.query(
        `UPDATE preview_manifests
         SET content = $1,
             is_original = true,
             status = 'published',
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND manifest_type = $3
         RETURNING id`,
        [JSON.stringify(content), userId, manifestType]
      )

      console.log(`  ✅ Updated ${manifestType} with ${content.length} items (ID: ${updateResult.rows[0].id})`)
      return { success: true, updated: true, itemCount: content.length, glbCount: glbRefs.length }
    } else {
      console.log(`  🆕 Creating new preview manifest...`)

      // Create new manifest
      const insertResult = await pool.query(
        `INSERT INTO preview_manifests (
          user_id,
          manifest_type,
          content,
          is_original,
          status,
          published_at,
          version
        )
        VALUES ($1, $2, $3, true, 'published', CURRENT_TIMESTAMP, 1)
        RETURNING id`,
        [userId, manifestType, JSON.stringify(content)]
      )

      console.log(`  ✅ Created ${manifestType} with ${content.length} items (ID: ${insertResult.rows[0].id})`)
      return { success: true, created: true, itemCount: content.length, glbCount: glbRefs.length }
    }
  } catch (error) {
    console.error(`  ❌ Failed to migrate ${manifestType}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Verify migration by checking database contents
 */
async function verifyMigration(userId) {
  console.log('\n🔍 Verifying migration...')

  try {
    const result = await pool.query(`
      SELECT
        manifest_type,
        jsonb_array_length(content) as item_count,
        is_original,
        status,
        version,
        published_at,
        updated_at
      FROM preview_manifests
      WHERE user_id = $1
      ORDER BY manifest_type
    `, [userId])

    if (result.rows.length === 0) {
      console.log('  ⚠️  No manifests found in database!')
      return false
    }

    console.log('\n📊 Migration Summary:')
    console.log('┌────────────────┬───────────┬─────────────┬───────────┬─────────┬─────────────────────┐')
    console.log('│ Type           │ Items     │ Original    │ Status    │ Version │ Published At        │')
    console.log('├────────────────┼───────────┼─────────────┼───────────┼─────────┼─────────────────────┤')

    for (const row of result.rows) {
      const type = row.manifest_type.padEnd(14)
      const count = String(row.item_count || 0).padStart(9)
      const isOrig = (row.is_original ? 'Yes' : 'No').padEnd(11)
      const status = row.status.padEnd(9)
      const version = String(row.version).padStart(7)
      const published = row.published_at 
        ? new Date(row.published_at).toISOString().slice(0, 16).replace('T', ' ')
        : 'N/A'.padEnd(16)

      console.log(`│ ${type} │ ${count} │ ${isOrig} │ ${status} │ ${version} │ ${published} │`)
    }

    console.log('└────────────────┴───────────┴─────────────┴───────────┴─────────┴─────────────────────┘')

    return true
  } catch (error) {
    console.error('  ❌ Verification failed:', error.message)
    return false
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  const MANIFESTS_PATH = await getManifestsPath()
  
  console.log('🚀 Starting Manifests → PostgreSQL Migration')
  console.log('=' .repeat(60))
  console.log(`📂 Source: ${MANIFESTS_PATH}`)
  console.log(`🗄️  Target: PostgreSQL (${process.env.DATABASE_URL ? 'Railway' : 'Local'})`)
  console.log('=' .repeat(60))

  const startTime = Date.now()
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    totalItems: 0,
    totalGLBs: 0
  }

  try {
    // Step 1: Update table schema
    await updateTableSchema()

    // Step 2: Get or create system user
    const systemUserId = await getSystemUser()

    // Step 3: Migrate each manifest type
    const manifestTypes = ['items', 'mobs', 'npcs']
    
    for (const type of manifestTypes) {
      const result = await migrateManifest(systemUserId, type, MANIFESTS_PATH)
      
      if (result.success) {
        if (result.created) results.created++
        if (result.updated) results.updated++
        if (result.skipped) results.skipped++
        results.totalItems += result.itemCount || 0
        results.totalGLBs += result.glbCount || 0
      } else {
        results.failed++
      }
    }

    // Step 4: Verify migration
    const verified = await verifyMigration(systemUserId)

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ MIGRATION COMPLETE')
    console.log('='.repeat(60))
    console.log(`⏱️  Duration: ${duration}s`)
    console.log(`📦 Manifests Created: ${results.created}`)
    console.log(`🔄 Manifests Updated: ${results.updated}`)
    console.log(`⏭️  Manifests Skipped: ${results.skipped}`)
    console.log(`❌ Manifests Failed: ${results.failed}`)
    console.log(`📊 Total Items: ${results.totalItems}`)
    console.log(`🎨 Total GLB References: ${results.totalGLBs}`)
    console.log(`✓  Verification: ${verified ? 'PASSED' : 'FAILED'}`)
    console.log('='.repeat(60))

    if (results.failed > 0 || !verified) {
      console.log('\n⚠️  Migration completed with errors. Please review logs.')
      process.exit(1)
    }

    console.log('\n🎉 All manifests successfully migrated to PostgreSQL!')
    console.log('   The API will now serve manifests from the database.')
    console.log('   Original JSON files are preserved for backup.\n')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

