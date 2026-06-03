#!/usr/bin/env node
/**
 * Hyperia Admin Tool
 * 
 * Command-line tool for managing user roles and bans in Hyperia.
 * 
 * ROLE COMMANDS:
 *   bun scripts/set-role.mjs list              - List all users with their roles
 *   bun scripts/set-role.mjs list-staff        - List only mods and admins
 *   bun scripts/set-role.mjs set <user> <role> - Set a user's role (user, mod, admin)
 *   bun scripts/set-role.mjs add <user> <role> - Add a role to a user
 *   bun scripts/set-role.mjs remove <user> <role> - Remove a role from a user
 * 
 * BAN COMMANDS:
 *   bun scripts/set-role.mjs ban <user> [duration] [reason] - Ban a user
 *   bun scripts/set-role.mjs unban <user>                   - Unban a user
 *   bun scripts/set-role.mjs list-bans                      - List all active bans
 * 
 * Duration format: 1h, 2d, 1w, 1m (hours, days, weeks, months), or 'perm' for permanent
 * 
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string (or uses default dev URL)
 * 
 * Examples:
 *   bun scripts/set-role.mjs set alice admin        - Make alice an admin
 *   bun scripts/set-role.mjs add bob mod            - Add mod role to bob
 *   bun scripts/set-role.mjs ban eve 7d "spamming" - Ban eve for 7 days
 *   bun scripts/set-role.mjs unban eve             - Unban eve
 *   bun scripts/set-role.mjs list-bans             - Show all active bans
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// Load environment variables from server package
dotenv.config({ path: path.join(rootDir, 'packages/server/.env') })

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
}

const VALID_ROLES = ['user', 'mod', 'admin']

function printUsage() {
  console.log(`
${colors.bright}${colors.cyan}Hyperia Admin Tool${colors.reset}

${colors.bright}Usage:${colors.reset}
  bun scripts/set-role.mjs <command> [args]

${colors.bright}Role Commands:${colors.reset}
  ${colors.green}list${colors.reset}                     List all users with their roles
  ${colors.green}list-staff${colors.reset}               List only moderators and admins
  ${colors.green}set <username> <role>${colors.reset}    Set user's role (replaces existing)
  ${colors.green}add <username> <role>${colors.reset}    Add a role to user
  ${colors.green}remove <username> <role>${colors.reset} Remove a role from user

${colors.bright}Ban Commands:${colors.reset}
  ${colors.yellow}ban <username> [duration] [reason]${colors.reset}  Ban a user
  ${colors.yellow}unban <username>${colors.reset}                    Unban a user
  ${colors.yellow}list-bans${colors.reset}                           List all active bans

${colors.bright}Valid roles:${colors.reset} user, mod, admin

${colors.bright}Duration format:${colors.reset} 1h, 2d, 1w, 1m (hours/days/weeks/months), or 'perm'

${colors.bright}Role hierarchy:${colors.reset}
  ${colors.dim}user${colors.reset}  - Basic player
  ${colors.yellow}mod${colors.reset}   - Moderator (can /teleport, /kick, /ban, /unban)
  ${colors.red}admin${colors.reset} - Administrator (all mod permissions + /mod, /demod, /listmods)

${colors.bright}Moderation rules:${colors.reset}
  - Mods can kick/ban regular users
  - Mods cannot kick/ban other mods or admins
  - Admins can kick/ban mods (but not other admins)

${colors.bright}Examples:${colors.reset}
  bun scripts/set-role.mjs set alice admin        ${colors.dim}# Make alice an admin${colors.reset}
  bun scripts/set-role.mjs add bob mod            ${colors.dim}# Add mod role to bob${colors.reset}
  bun scripts/set-role.mjs ban eve 7d "spamming"  ${colors.dim}# Ban eve for 7 days${colors.reset}
  bun scripts/set-role.mjs ban troll perm "abuse" ${colors.dim}# Permanent ban${colors.reset}
  bun scripts/set-role.mjs unban eve              ${colors.dim}# Unban eve${colors.reset}
  bun scripts/set-role.mjs list-bans              ${colors.dim}# Show all bans${colors.reset}
`)
}

async function getPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to use this script.')
  }
  
  return new pg.Pool({ connectionString })
}

function parseRoles(rolesString) {
  if (!rolesString) return []
  return rolesString.split(',').map(r => r.trim()).filter(r => r)
}

function serializeRoles(roles) {
  return roles.filter(r => !r.startsWith('~')).join(',')
}

function hasRole(roles, ...checkRoles) {
  return checkRoles.some(role => 
    roles.includes(role) || roles.includes(`~${role}`)
  )
}

async function listUsers(pool) {
  console.log(`\n${colors.bright}All Users:${colors.reset}\n`)
  
  const result = await pool.query(`
    SELECT id, name, roles, "createdAt" 
    FROM users 
    ORDER BY "createdAt" DESC
  `)
  
  if (result.rows.length === 0) {
    console.log(`${colors.dim}No users found${colors.reset}`)
    return
  }
  
  // Table header
  console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`)
  console.log(`${colors.bright}${'Name'.padEnd(25)} ${'Roles'.padEnd(30)} ID${colors.reset}`)
  console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`)
  
  for (const user of result.rows) {
    const roles = parseRoles(user.roles)
    let roleDisplay = roles.length > 0 ? roles.join(', ') : 'user'
    
    // Color code roles
    if (hasRole(roles, 'admin')) {
      roleDisplay = `${colors.red}${roleDisplay}${colors.reset}`
    } else if (hasRole(roles, 'mod')) {
      roleDisplay = `${colors.yellow}${roleDisplay}${colors.reset}`
    } else {
      roleDisplay = `${colors.dim}${roleDisplay}${colors.reset}`
    }
    
    console.log(`${user.name.padEnd(25)} ${roleDisplay.padEnd(40)} ${colors.dim}${user.id}${colors.reset}`)
  }
  
  console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`)
  console.log(`${colors.dim}Total: ${result.rows.length} users${colors.reset}\n`)
}

async function listStaff(pool) {
  console.log(`\n${colors.bright}Staff Members:${colors.reset}\n`)
  
  const result = await pool.query(`
    SELECT id, name, roles, "createdAt" 
    FROM users 
    ORDER BY "createdAt" DESC
  `)
  
  const admins = []
  const mods = []
  
  for (const user of result.rows) {
    const roles = parseRoles(user.roles)
    if (hasRole(roles, 'admin')) {
      admins.push(user)
    } else if (hasRole(roles, 'mod')) {
      mods.push(user)
    }
  }
  
  // Admins
  console.log(`${colors.red}${colors.bright}Admins (${admins.length}):${colors.reset}`)
  if (admins.length === 0) {
    console.log(`  ${colors.dim}None${colors.reset}`)
  } else {
    for (const admin of admins) {
      console.log(`  ${admin.name} ${colors.dim}(${admin.id})${colors.reset}`)
    }
  }
  
  console.log()
  
  // Mods
  console.log(`${colors.yellow}${colors.bright}Moderators (${mods.length}):${colors.reset}`)
  if (mods.length === 0) {
    console.log(`  ${colors.dim}None${colors.reset}`)
  } else {
    for (const mod of mods) {
      console.log(`  ${mod.name} ${colors.dim}(${mod.id})${colors.reset}`)
    }
  }
  
  console.log()
}

async function findUser(pool, username) {
  // Case-insensitive search
  const result = await pool.query(
    `SELECT id, name, roles FROM users WHERE LOWER(name) = LOWER($1)`,
    [username]
  )
  return result.rows[0]
}

async function updateUserRoles(pool, userId, roles) {
  const rolesString = serializeRoles(roles)
  await pool.query(
    `UPDATE users SET roles = $1 WHERE id = $2`,
    [rolesString, userId]
  )
}

async function setRole(pool, username, role) {
  if (!VALID_ROLES.includes(role)) {
    console.log(`${colors.red}Error: Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}${colors.reset}`)
    return false
  }
  
  const user = await findUser(pool, username)
  if (!user) {
    console.log(`${colors.red}Error: User "${username}" not found${colors.reset}`)
    return false
  }
  
  // Set role (replace existing non-temp roles)
  const newRoles = role === 'user' ? [] : [role]
  await updateUserRoles(pool, user.id, newRoles)
  
  const roleDisplay = role === 'user' ? 'regular user' : role
  console.log(`${colors.green}✓ Set ${user.name}'s role to: ${roleDisplay}${colors.reset}`)
  return true
}

async function addRole(pool, username, role) {
  if (!VALID_ROLES.includes(role)) {
    console.log(`${colors.red}Error: Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}${colors.reset}`)
    return false
  }
  
  if (role === 'user') {
    console.log(`${colors.yellow}Note: 'user' is the default role, no need to add it${colors.reset}`)
    return true
  }
  
  const user = await findUser(pool, username)
  if (!user) {
    console.log(`${colors.red}Error: User "${username}" not found${colors.reset}`)
    return false
  }
  
  const roles = parseRoles(user.roles)
  
  if (hasRole(roles, role)) {
    console.log(`${colors.yellow}${user.name} already has the ${role} role${colors.reset}`)
    return true
  }
  
  roles.push(role)
  await updateUserRoles(pool, user.id, roles)
  
  console.log(`${colors.green}✓ Added ${role} role to ${user.name}${colors.reset}`)
  return true
}

async function removeRole(pool, username, role) {
  if (!VALID_ROLES.includes(role)) {
    console.log(`${colors.red}Error: Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}${colors.reset}`)
    return false
  }
  
  const user = await findUser(pool, username)
  if (!user) {
    console.log(`${colors.red}Error: User "${username}" not found${colors.reset}`)
    return false
  }
  
  const roles = parseRoles(user.roles)
  
  if (!hasRole(roles, role)) {
    console.log(`${colors.yellow}${user.name} doesn't have the ${role} role${colors.reset}`)
    return true
  }
  
  const idx = roles.indexOf(role)
  if (idx !== -1) {
    roles.splice(idx, 1)
  }
  
  await updateUserRoles(pool, user.id, roles)
  
  console.log(`${colors.green}✓ Removed ${role} role from ${user.name}${colors.reset}`)
  return true
}

// ============================================================================
// BAN FUNCTIONS
// ============================================================================

function parseDuration(durationStr) {
  if (!durationStr || durationStr === 'perm' || durationStr === 'permanent') {
    return null // Permanent
  }
  
  const match = durationStr.match(/^(\d+)([hdwm])$/i)
  if (!match) {
    return undefined // Invalid
  }
  
  const amount = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()
  const now = Date.now()
  
  switch (unit) {
    case 'h':
      return now + amount * 60 * 60 * 1000
    case 'd':
      return now + amount * 24 * 60 * 60 * 1000
    case 'w':
      return now + amount * 7 * 24 * 60 * 60 * 1000
    case 'm':
      return now + amount * 30 * 24 * 60 * 60 * 1000
    default:
      return undefined
  }
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'permanent'
  
  const now = Date.now()
  const diffMs = expiresAt - now
  
  if (diffMs <= 0) return 'expired'
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} remaining`
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} remaining`
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} remaining`
  }
}

async function banUser(pool, username, duration, reason) {
  const user = await findUser(pool, username)
  if (!user) {
    console.log(`${colors.red}Error: User "${username}" not found${colors.reset}`)
    return false
  }
  
  // Check for existing active ban
  const now = Date.now()
  const existingBan = await pool.query(
    `SELECT * FROM user_bans 
     WHERE "bannedUserId" = $1 AND active = 1 
     AND ("expiresAt" IS NULL OR "expiresAt" > $2)`,
    [user.id, now]
  )
  
  if (existingBan.rows.length > 0) {
    console.log(`${colors.yellow}${user.name} is already banned${colors.reset}`)
    return false
  }
  
  // Parse duration
  const expiresAt = parseDuration(duration)
  if (expiresAt === undefined) {
    console.log(`${colors.red}Error: Invalid duration format. Use: 1h, 2d, 1w, 1m, or 'perm'${colors.reset}`)
    return false
  }
  
  // Create ban
  await pool.query(
    `INSERT INTO user_bans ("bannedUserId", "bannedByUserId", reason, "expiresAt", "createdAt", active)
     VALUES ($1, $2, $3, $4, $5, 1)`,
    [user.id, 'CLI', reason || null, expiresAt, now]
  )
  
  const durationText = expiresAt ? `for ${duration}` : 'permanently'
  console.log(`${colors.green}✓ Banned ${user.name} ${durationText}${colors.reset}`)
  if (reason) {
    console.log(`  ${colors.dim}Reason: ${reason}${colors.reset}`)
  }
  
  return true
}

async function unbanUser(pool, username) {
  const user = await findUser(pool, username)
  if (!user) {
    console.log(`${colors.red}Error: User "${username}" not found${colors.reset}`)
    return false
  }
  
  // Find active ban
  const now = Date.now()
  const existingBan = await pool.query(
    `SELECT * FROM user_bans 
     WHERE "bannedUserId" = $1 AND active = 1 
     AND ("expiresAt" IS NULL OR "expiresAt" > $2)`,
    [user.id, now]
  )
  
  if (existingBan.rows.length === 0) {
    console.log(`${colors.yellow}${user.name} is not currently banned${colors.reset}`)
    return false
  }
  
  // Deactivate all active bans for this user
  await pool.query(
    `UPDATE user_bans SET active = 0 WHERE "bannedUserId" = $1 AND active = 1`,
    [user.id]
  )
  
  console.log(`${colors.green}✓ Unbanned ${user.name}${colors.reset}`)
  return true
}

async function listBans(pool) {
  console.log(`\n${colors.bright}Active Bans:${colors.reset}\n`)
  
  const now = Date.now()
  const result = await pool.query(
    `SELECT b.*, u.name as banned_name
     FROM user_bans b
     LEFT JOIN users u ON b."bannedUserId" = u.id
     WHERE b.active = 1 
     AND (b."expiresAt" IS NULL OR b."expiresAt" > $1)
     ORDER BY b."createdAt" DESC`,
    [now]
  )
  
  if (result.rows.length === 0) {
    console.log(`${colors.dim}No active bans${colors.reset}`)
    return
  }
  
  console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`)
  console.log(`${colors.bright}${'User'.padEnd(20)} ${'Expires'.padEnd(25)} Reason${colors.reset}`)
  console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`)
  
  for (const ban of result.rows) {
    const name = ban.banned_name || 'Unknown'
    const expiry = formatExpiry(ban.expiresAt)
    const reason = ban.reason || 'No reason'
    
    let expiryColor = colors.red
    if (ban.expiresAt) {
      expiryColor = colors.yellow
    }
    
    console.log(`${colors.red}${name.padEnd(20)}${colors.reset} ${expiryColor}${expiry.padEnd(25)}${colors.reset} ${colors.dim}${reason}${colors.reset}`)
  }
  
  console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`)
  console.log(`${colors.dim}Total: ${result.rows.length} active ban${result.rows.length !== 1 ? 's' : ''}${colors.reset}\n`)
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    printUsage()
    process.exit(0)
  }
  
  const command = args[0].toLowerCase()
  
  const pool = await getPool()
  
  try {
    switch (command) {
      case 'list':
        await listUsers(pool)
        break
        
      case 'list-staff':
      case 'liststaff':
      case 'staff':
        await listStaff(pool)
        break
        
      case 'set':
        if (args.length < 3) {
          console.log(`${colors.red}Usage: set <username> <role>${colors.reset}`)
          process.exit(1)
        }
        await setRole(pool, args[1], args[2].toLowerCase())
        break
        
      case 'add':
        if (args.length < 3) {
          console.log(`${colors.red}Usage: add <username> <role>${colors.reset}`)
          process.exit(1)
        }
        await addRole(pool, args[1], args[2].toLowerCase())
        break
        
      case 'remove':
        if (args.length < 3) {
          console.log(`${colors.red}Usage: remove <username> <role>${colors.reset}`)
          process.exit(1)
        }
        await removeRole(pool, args[1], args[2].toLowerCase())
        break
      
      // Ban commands
      case 'ban':
        if (args.length < 2) {
          console.log(`${colors.red}Usage: ban <username> [duration] [reason]${colors.reset}`)
          console.log(`${colors.dim}Duration: 1h, 2d, 1w, 1m, or 'perm' (default: permanent)${colors.reset}`)
          process.exit(1)
        }
        // Parse: ban <username> [duration] [reason...]
        const banDuration = args[2] || 'perm'
        const banReason = args.slice(3).join(' ') || null
        await banUser(pool, args[1], banDuration, banReason)
        break
        
      case 'unban':
        if (args.length < 2) {
          console.log(`${colors.red}Usage: unban <username>${colors.reset}`)
          process.exit(1)
        }
        await unbanUser(pool, args[1])
        break
        
      case 'list-bans':
      case 'listbans':
      case 'bans':
        await listBans(pool)
        break
        
      case 'help':
      case '-h':
      case '--help':
        printUsage()
        break
        
      default:
        console.log(`${colors.red}Unknown command: ${command}${colors.reset}`)
        printUsage()
        process.exit(1)
    }
  } catch (err) {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`)
    if (err.code === 'ECONNREFUSED') {
      console.log(`${colors.dim}Make sure PostgreSQL is running and DATABASE_URL is correct${colors.reset}`)
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`)
  process.exit(1)
})
