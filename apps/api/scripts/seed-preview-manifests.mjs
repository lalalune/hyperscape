/**
 * Seed Preview Manifests
 * Loads original game manifests into preview_manifests table as templates
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'asset_forge',
  user: process.env.DB_USER || 'asset_forge',
  password: process.env.DB_PASSWORD || 'asset_forge_dev_password_2024',
})

// Path to original manifests
const MANIFESTS_PATH = path.join(
  __dirname,
  '../../../../packages/server/world/assets/manifests'
)

/**
 * Get or create system user for original manifests
 */
async function getSystemUser() {
  const result = await pool.query(`
    SELECT id FROM users WHERE privy_user_id = 'system' LIMIT 1
  `)

  if (result.rows.length > 0) {
    return result.rows[0].id
  }

  // Create system user
  const insertResult = await pool.query(`
    INSERT INTO users (privy_user_id, email, display_name, role)
    VALUES ('system', 'system@hyperscape.ai', 'System', 'admin')
    ON CONFLICT (privy_user_id) DO UPDATE
    SET email = EXCLUDED.email
    RETURNING id
  `)

  return insertResult.rows[0].id
}

/**
 * Load manifest file
 */
async function loadManifest(manifestType) {
  try {
    const filePath = path.join(MANIFESTS_PATH, `${manifestType}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️  Manifest file not found: ${manifestType}.json`)
      return []
    }
    throw error
  }
}

/**
 * Seed preview manifest for a given type
 */
async function seedPreviewManifest(userId, manifestType) {
  console.log(`\n📋 Processing ${manifestType} manifest...`)

  // Load original manifest
  const content = await loadManifest(manifestType)

  if (!Array.isArray(content) || content.length === 0) {
    console.log(`  ⏭️  Skipping ${manifestType} - no items found`)
    return
  }

  console.log(`  📊 Found ${content.length} items in ${manifestType}.json`)

  // Check if preview manifest already exists
  const existingResult = await pool.query(
    `SELECT id, content FROM preview_manifests
     WHERE user_id = $1 AND manifest_type = $2`,
    [userId, manifestType]
  )

  if (existingResult.rows.length > 0) {
    console.log(`  ♻️  Updating existing preview manifest...`)

    // Update existing manifest
    await pool.query(
      `UPDATE preview_manifests
       SET content = $1,
           is_original = true,
           status = 'published',
           published_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND manifest_type = $3`,
      [JSON.stringify(content), userId, manifestType]
    )

    console.log(`  ✅ Updated ${manifestType} with ${content.length} items`)
  } else {
    console.log(`  🆕 Creating new preview manifest...`)

    // Create new manifest
    await pool.query(
      `INSERT INTO preview_manifests (
        user_id,
        manifest_type,
        content,
        is_original,
        status,
        published_at,
        version
      )
      VALUES ($1, $2, $3, true, 'published', CURRENT_TIMESTAMP, 1)`,
      [userId, manifestType, JSON.stringify(content)]
    )

    console.log(`  ✅ Created ${manifestType} with ${content.length} items`)
  }
}

/**
 * Main seeding function
 */
async function seedAllManifests() {
  console.log('🌱 Starting preview manifests seeding...\n')

  try {
    // Get or create system user
    console.log('👤 Getting system user...')
    const systemUserId = await getSystemUser()
    console.log(`   ✅ System user ID: ${systemUserId}`)

    // Manifest types to seed
    const manifestTypes = ['items', 'mobs', 'npcs']

    // Seed each manifest type
    for (const type of manifestTypes) {
      await seedPreviewManifest(systemUserId, type)
    }

    console.log('\n✅ Preview manifests seeding complete!\n')

    // Show summary
    const summaryResult = await pool.query(`
      SELECT
        manifest_type,
        jsonb_array_length(content) as item_count,
        is_original,
        status,
        version
      FROM preview_manifests
      WHERE user_id = $1
      ORDER BY manifest_type
    `, [systemUserId])

    console.log('📊 Summary:')
    console.log('┌────────────────┬───────────┬─────────────┬───────────┬─────────┐')
    console.log('│ Type           │ Items     │ Original    │ Status    │ Version │')
    console.log('├────────────────┼───────────┼─────────────┼───────────┼─────────┤')

    for (const row of summaryResult.rows) {
      const type = row.manifest_type.padEnd(14)
      const count = String(row.item_count || 0).padStart(9)
      const isOrig = (row.is_original ? 'Yes' : 'No').padEnd(11)
      const status = row.status.padEnd(9)
      const version = String(row.version).padStart(7)

      console.log(`│ ${type} │ ${count} │ ${isOrig} │ ${status} │ ${version} │`)
    }

    console.log('└────────────────┴───────────┴─────────────┴───────────┴─────────┘\n')

  } catch (error) {
    console.error('❌ Error seeding preview manifests:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// Run seeding
seedAllManifests().catch(error => {
  console.error(error)
  process.exit(1)
})
