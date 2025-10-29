#!/usr/bin/env node
/**
 * Import Monorepo Assets to Database
 *
 * Reads manifest files (items.json, mobs.json, npcs.json, emotes) and imports
 * them into the asset_forge database as asset records.
 */

import { readFileSync } from 'fs'
import { readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'asset_forge',
  user: process.env.DB_USER || 'asset_forge',
  password: process.env.DB_PASSWORD || 'asset_forge_dev_password_2024'
})

const CDN_BASE_URL = process.env.PUBLIC_CDN_URL || 'http://localhost:8080'

// Get or create system user
async function getSystemUser() {
  const result = await pool.query(`
    SELECT id FROM users WHERE email = 'system@hyperscape.ai' LIMIT 1
  `)

  if (result.rows.length > 0) {
    return result.rows[0].id
  }

  // Create system user
  const insertResult = await pool.query(`
    INSERT INTO users (privy_user_id, email, display_name, role)
    VALUES ('system', 'system@hyperscape.ai', 'System', 'admin')
    RETURNING id
  `)

  return insertResult.rows[0].id
}

// Import items from items.json
async function importItems(ownerId) {
  const manifestPath = path.join(__dirname, '../../../../packages/server/world/assets/manifests/items.json')
  const items = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  console.log(`\n📦 Importing ${items.length} items...`)

  let imported = 0
  let skipped = 0

  for (const item of items) {
    try {
      // Check if already exists
      const existing = await pool.query(
        'SELECT id FROM assets WHERE metadata->>\'item_id\' = $1',
        [item.id]
      )

      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      // Determine asset type
      let assetType = 'item'
      if (item.type === 'weapon') assetType = 'equipment'
      if (item.type === 'armor') assetType = 'equipment'
      if (item.type === 'tool') assetType = 'equipment'

      // Insert asset
      await pool.query(`
        INSERT INTO assets (
          name, description, type, category, owner_id,
          file_url, thumbnail_url, status, visibility,
          metadata, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        item.name,
        item.description || item.examine || '',
        assetType,
        item.type,
        ownerId,
        item.modelPath ? `${CDN_BASE_URL}${item.modelPath.replace('asset://', '/assets/world/')}` : null,
        item.iconPath ? `${CDN_BASE_URL}${item.iconPath.replace('asset://', '/assets/world/')}` : null,
        'completed',
        'public',
        JSON.stringify({
          item_id: item.id,
          weapon_type: item.weaponType,
          attack_type: item.attackType,
          equip_slot: item.equipSlot,
          stats: item.stats,
          bonuses: item.bonuses,
          requirements: item.requirements,
          value: item.value,
          weight: item.weight,
          tradeable: item.tradeable,
          rarity: item.rarity
        }),
        [item.type, item.rarity, item.weaponType].filter(Boolean)
      ])

      imported++
      console.log(`  ✅ ${item.name}`)
    } catch (error) {
      console.error(`  ❌ Failed to import ${item.name}:`, error.message)
    }
  }

  console.log(`\n📊 Items: ${imported} imported, ${skipped} skipped`)
  return imported
}

// Import mobs from mobs.json
async function importMobs(ownerId) {
  const manifestPath = path.join(__dirname, '../../../../packages/server/world/assets/manifests/mobs.json')
  const mobs = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  console.log(`\n🧟 Importing ${mobs.length} mobs...`)

  let imported = 0
  let skipped = 0

  for (const mob of mobs) {
    try {
      const existing = await pool.query(
        'SELECT id FROM assets WHERE metadata->>\'mob_id\' = $1',
        [mob.id]
      )

      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      await pool.query(`
        INSERT INTO assets (
          name, description, type, category, owner_id,
          file_url, status, visibility,
          metadata, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        mob.name,
        mob.description || '',
        'character',
        'mob',
        ownerId,
        mob.modelPath ? `${CDN_BASE_URL}${mob.modelPath.replace('asset://', '/assets/world/')}` : null,
        'completed',
        'public',
        JSON.stringify({
          mob_id: mob.id,
          mob_type: mob.type,
          difficulty_level: mob.difficultyLevel,
          level: mob.level,
          stats: mob.stats,
          behavior: mob.behavior,
          loot_table: mob.lootTable,
          spawn_biomes: mob.spawnBiomes,
          xp_reward: mob.xpReward
        }),
        [mob.type, 'mob', `level_${mob.difficultyLevel}`].filter(Boolean)
      ])

      imported++
      console.log(`  ✅ ${mob.name} (Lvl ${mob.level})`)
    } catch (error) {
      console.error(`  ❌ Failed to import ${mob.name}:`, error.message)
    }
  }

  console.log(`\n📊 Mobs: ${imported} imported, ${skipped} skipped`)
  return imported
}

// Import NPCs from npcs.json
async function importNPCs(ownerId) {
  const manifestPath = path.join(__dirname, '../../../../packages/server/world/assets/manifests/npcs.json')
  const npcs = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  console.log(`\n🧙 Importing ${npcs.length} NPCs...`)

  let imported = 0
  let skipped = 0

  for (const npc of npcs) {
    try {
      const existing = await pool.query(
        'SELECT id FROM assets WHERE metadata->>\'npc_id\' = $1',
        [npc.id]
      )

      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      await pool.query(`
        INSERT INTO assets (
          name, description, type, category, owner_id,
          file_url, thumbnail_url, status, visibility,
          metadata, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        npc.name,
        npc.description || '',
        'character',
        'npc',
        ownerId,
        npc.modelPath ? `${CDN_BASE_URL}${npc.modelPath.replace('asset://', '/assets/world/')}` : null,
        npc.iconPath ? `${CDN_BASE_URL}${npc.iconPath.replace('asset://', '/assets/world/')}` : null,
        'completed',
        'public',
        JSON.stringify({
          npc_id: npc.id,
          npc_type: npc.npcType,
          services: npc.services,
          dialogue_lines: npc.dialogueLines
        }),
        [npc.type, npc.npcType, 'npc'].filter(Boolean)
      ])

      imported++
      console.log(`  ✅ ${npc.name}`)
    } catch (error) {
      console.error(`  ❌ Failed to import ${npc.name}:`, error.message)
    }
  }

  console.log(`\n📊 NPCs: ${imported} imported, ${skipped} skipped`)
  return imported
}

// Import emotes
async function importEmotes(ownerId) {
  const emotesDir = path.join(__dirname, '../../../../assets/world/models/emotes')
  const files = await readdir(emotesDir)
  const emoteFiles = files.filter(f => f.endsWith('.glb'))

  console.log(`\n💃 Importing ${emoteFiles.length} emotes...`)

  let imported = 0
  let skipped = 0

  for (const file of emoteFiles) {
    try {
      const emoteName = file.replace('emote-', '').replace('.glb', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const emoteId = file.replace('.glb', '')

      const existing = await pool.query(
        'SELECT id FROM assets WHERE metadata->>\'emote_id\' = $1',
        [emoteId]
      )

      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      await pool.query(`
        INSERT INTO assets (
          name, description, type, category, owner_id,
          file_url, status, visibility,
          metadata, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        emoteName,
        `${emoteName} emote animation`,
        'animation',
        'emote',
        ownerId,
        `${CDN_BASE_URL}/assets/world/models/emotes/${file}`,
        'completed',
        'public',
        JSON.stringify({
          emote_id: emoteId,
          file_name: file
        }),
        ['emote', 'animation']
      ])

      imported++
      console.log(`  ✅ ${emoteName}`)
    } catch (error) {
      console.error(`  ❌ Failed to import ${file}:`, error.message)
    }
  }

  console.log(`\n📊 Emotes: ${imported} imported, ${skipped} skipped`)
  return imported
}

// Import avatars
async function importAvatars(ownerId) {
  console.log(`\n🧑 Importing avatar...`)

  try {
    const existing = await pool.query(
      'SELECT id FROM assets WHERE metadata->>\'avatar_id\' = $1',
      ['default_avatar']
    )

    if (existing.rows.length > 0) {
      console.log('  ⏭️  Avatar already exists, skipping')
      return 0
    }

    await pool.query(`
      INSERT INTO assets (
        name, description, type, category, owner_id,
        file_url, status, visibility,
        metadata, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      'Default Avatar',
      'Default player avatar model',
      'character',
      'avatar',
      ownerId,
      `${CDN_BASE_URL}/assets/world/models/avatars/avatar.vrm`,
      'completed',
      'public',
      JSON.stringify({
        avatar_id: 'default_avatar',
        file_type: 'vrm'
      }),
      ['avatar', 'character', 'vrm']
    ])

    console.log('  ✅ Default Avatar')
    return 1
  } catch (error) {
    console.error('  ❌ Failed to import avatar:', error.message)
    return 0
  }
}

// Main import function
async function main() {
  console.log('🚀 Starting asset import from monorepo...\n')

  try {
    // Get or create system user
    const ownerId = await getSystemUser()
    console.log(`✅ System user ID: ${ownerId}`)

    // Import all assets
    const itemsCount = await importItems(ownerId)
    const mobsCount = await importMobs(ownerId)
    const npcsCount = await importNPCs(ownerId)
    const emotesCount = await importEmotes(ownerId)
    const avatarsCount = await importAvatars(ownerId)

    const totalCount = itemsCount + mobsCount + npcsCount + emotesCount + avatarsCount

    console.log(`\n🎉 Import complete!`)
    console.log(`📊 Total assets imported: ${totalCount}`)
    console.log(`   - Items: ${itemsCount}`)
    console.log(`   - Mobs: ${mobsCount}`)
    console.log(`   - NPCs: ${npcsCount}`)
    console.log(`   - Emotes: ${emotesCount}`)
    console.log(`   - Avatars: ${avatarsCount}`)

  } catch (error) {
    console.error('❌ Import failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
