/**
 * Add wallet address to admin whitelist
 * Usage: node scripts/add-admin-whitelist.mjs <wallet-address> [reason]
 */

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

// Load environment variables
config({ path: path.join(ROOT_DIR, '.env.local') })
config({ path: path.join(ROOT_DIR, '.env') })

// Import database after env vars are loaded
const { db, schema } = await import('../server/db/index.mjs')
const { eq } = await import('drizzle-orm')

const walletAddress = process.argv[2]
const reason = process.argv[3] || 'Initial admin setup'

if (!walletAddress) {
  console.error('Usage: node scripts/add-admin-whitelist.mjs <wallet-address> [reason]')
  process.exit(1)
}

const normalized = walletAddress.toLowerCase()

try {
  // Check if already whitelisted
  const existing = await db.select()
    .from(schema.adminWhitelist)
    .where(eq(schema.adminWhitelist.walletAddress, normalized))
    .limit(1)

  if (existing.length > 0) {
    console.log(`✅ Wallet address already whitelisted: ${walletAddress}`)
    console.log(`   Status: ${existing[0].isActive ? 'Active' : 'Inactive'}`)
    console.log(`   Added: ${existing[0].createdAt}`)
    process.exit(0)
  }

  // Add to whitelist
  const id = `admin_${crypto.randomBytes(8).toString('hex')}`

  await db.insert(schema.adminWhitelist).values({
    id,
    walletAddress: normalized,
    addedBy: null, // System added
    reason: reason,
    isActive: true,
    createdAt: new Date(),
    expiresAt: null,
  })

  console.log(`✅ Successfully added wallet to admin whitelist:`)
  console.log(`   Wallet: ${walletAddress}`)
  console.log(`   Normalized: ${normalized}`)
  console.log(`   Reason: ${reason}`)
  console.log(`   ID: ${id}`)

  // Check if user exists with this wallet
  const users = await db.select()
    .from(schema.users)
    .where(eq(schema.users.walletAddress, normalized))
    .limit(1)

  if (users.length > 0) {
    await db.update(schema.users)
      .set({ role: 'admin' })
      .where(eq(schema.users.id, users[0].id))
    console.log(`   ✅ Updated existing user to admin role: ${users[0].name}`)
  } else {
    console.log(`   ℹ️  No existing user found with this wallet. User will become admin on first login.`)
  }

  process.exit(0)
} catch (error) {
  console.error('❌ Error adding to whitelist:', error.message)
  process.exit(1)
}
