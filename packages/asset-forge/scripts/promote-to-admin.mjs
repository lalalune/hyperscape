#!/usr/bin/env node
/**
 * Promote User to Admin Script
 *
 * Usage:
 *   node scripts/promote-to-admin.mjs <email|wallet|name>
 *   node scripts/promote-to-admin.mjs                         # Shows all users
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Database path
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/asset-forge.db')

console.log('📊 Using database:', DB_PATH)

const db = new Database(DB_PATH)

// Get command line argument
const identifier = process.argv[2]

if (!identifier) {
  // Show all users
  console.log('\n📋 Current Users:')
  console.log('─'.repeat(80))

  const users = db.prepare(`
    SELECT id, email, name, role, wallet_address, created_at
    FROM users
    ORDER BY created_at DESC
  `).all()

  if (users.length === 0) {
    console.log('No users found in database')
  } else {
    users.forEach((user) => {
      const date = new Date(user.created_at * 1000).toLocaleDateString()
      const roleEmoji = user.role === 'admin' ? '👑' : '👤'
      console.log(`${roleEmoji} ${user.email || 'No email'}`)
      console.log(`   Name: ${user.name}`)
      console.log(`   Role: ${user.role}`)
      if (user.wallet_address) {
        console.log(`   Wallet: ${user.wallet_address}`)
      }
      console.log(`   Created: ${date}`)
      console.log('─'.repeat(80))
    })

    console.log(`\nTotal users: ${users.length}`)
    console.log('\n💡 Usage: node scripts/promote-to-admin.mjs <email|wallet|name>')
  }

  db.close()
  process.exit(0)
}

// Promote user to admin
console.log(`\n🔍 Looking for user: ${identifier}`)

// Try to find user by email, wallet address, or name
let user = db.prepare('SELECT * FROM users WHERE email = ?').get(identifier)

if (!user) {
  user = db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(identifier)
}

if (!user) {
  user = db.prepare('SELECT * FROM users WHERE name = ?').get(identifier)
}

if (!user) {
  console.error(`❌ User not found: ${identifier}`)
  console.log('\n💡 Try using email, wallet address, or name')
  db.close()
  process.exit(1)
}

if (user.role === 'admin') {
  console.log(`✅ User is already an admin!`)
  console.log(`   Name: ${user.name}`)
  console.log(`   Email: ${user.email || 'No email'}`)
  if (user.wallet_address) {
    console.log(`   Wallet: ${user.wallet_address}`)
  }
  db.close()
  process.exit(0)
}

// Update user role to admin
const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id)

if (result.changes > 0) {
  console.log(`\n✅ Successfully promoted user to admin!`)
  console.log(`   Name: ${user.name}`)
  console.log(`   Email: ${user.email || 'No email'}`)
  if (user.wallet_address) {
    console.log(`   Wallet: ${user.wallet_address}`)
  }
  console.log(`   Previous Role: ${user.role}`)
  console.log(`   New Role: admin`)
  console.log(`\n👑 ${user.name} now has admin privileges!`)
  console.log(`\n🔄 Please refresh your browser to see the changes.`)
} else {
  console.error(`❌ Failed to update user role`)
}

db.close()
