/**
 * Privy Authentication Module
 * 
 * Handles server-side Privy token verification and user management
 */

import { PrivyClient } from '@privy-io/server-auth'
import { db, schema } from '../db/index.mjs'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

// Cached Privy client instance
let privyClient = null

/**
 * Get or create the Privy client instance
 */
function getPrivyClient() {
  if (privyClient) {
    return privyClient
  }

  const appId = process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET

  if (!appId || !appSecret) {
    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction) {
      throw new Error(
        '[Privy] CRITICAL: Missing required Privy credentials in production. ' +
        'Please set PRIVY_APP_ID and PRIVY_APP_SECRET environment variables. ' +
        'See .env.example for configuration details.'
      )
    }

    console.warn('[Privy] No credentials configured - authentication disabled in development')
    return null
  }

  privyClient = new PrivyClient(appId, appSecret)
  return privyClient
}

/**
 * Check if Privy authentication is enabled
 */
export function isPrivyEnabled() {
  const appId = process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  return !!(appId && appSecret)
}

/**
 * Validate Privy credentials at startup
 *
 * This function should be called during server initialization to fail-fast
 * if required credentials are missing in production.
 *
 * @throws {Error} In production if credentials are missing
 */
export function validatePrivyConfig() {
  const appId = process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!appId || !appSecret) {
    if (isProduction) {
      const message = [
        '🚨 CRITICAL: Missing required Privy credentials in production',
        '',
        'Required environment variables:',
        '  - PRIVY_APP_ID (or PUBLIC_PRIVY_APP_ID)',
        '  - PRIVY_APP_SECRET',
        '',
        'Current status:',
        `  - PRIVY_APP_ID: ${appId ? '✓ set' : '✗ missing'}`,
        `  - PRIVY_APP_SECRET: ${appSecret ? '✓ set' : '✗ missing'}`,
        '',
        'Please set these environment variables before deploying to production.',
        'See .env.example for configuration details.',
      ].join('\n')

      throw new Error(message)
    }

    console.warn('⚠️  [Privy] Authentication disabled - no credentials configured (development mode)')
    console.warn('   Set PRIVY_APP_ID and PRIVY_APP_SECRET to enable authentication')
    return false
  }

  console.log('✓ [Privy] Authentication credentials validated')
  return true
}

/**
 * Verify a Privy access token and extract user information
 * 
 * @param {string} token - Privy access token
 * @returns {Promise<Object|null>} User information or null
 */
export async function verifyPrivyToken(token) {
  const client = getPrivyClient()

  if (!client) {
    return null
  }

  try {
    // Verify token
    const verifiedClaims = await client.verifyAuthToken(token)

    if (!verifiedClaims || !verifiedClaims.userId) {
      return null
    }

    // Get full user profile
    const user = await client.getUserById(verifiedClaims.userId)

    if (!user) {
      return null
    }

    return {
      privyUserId: user.id,
      farcasterFid: user.farcaster?.fid ? String(user.farcaster.fid) : null,
      walletAddress: user.wallet?.address || null,
      email: user.email?.address || null,
      isVerified: true,
    }
  } catch (error) {
    console.error('[Privy] Token verification failed:', error)
    return null
  }
}

/**
 * Check if wallet address is in admin whitelist
 */
async function isAdminWhitelisted(walletAddress) {
  if (!walletAddress) return false

  const normalized = walletAddress.toLowerCase()
  const whitelist = await db.query.adminWhitelist.findFirst({
    where: eq(schema.adminWhitelist.walletAddress, normalized),
  })

  return whitelist && whitelist.isActive
}

/**
 * Get or create user account from Privy authentication
 *
 * @param {Object} privyUserInfo - Verified Privy user information
 * @returns {Promise<Object>} User record
 */
export async function getOrCreateUser(privyUserInfo) {
  const { privyUserId, farcasterFid, walletAddress, email } = privyUserInfo

  // Check if wallet is admin whitelisted
  const isAdmin = await isAdminWhitelisted(walletAddress)

  // Try to find existing user by Privy ID
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.privyUserId, privyUserId),
  })

  if (existingUser) {
    // Update last login and role if whitelisted
    await db.update(schema.users)
      .set({
        lastLoginAt: new Date(),
        farcasterFid: farcasterFid || existingUser.farcasterFid,
        walletAddress: walletAddress || existingUser.walletAddress,
        email: email || existingUser.email,
        role: isAdmin ? 'admin' : existingUser.role,
      })
      .where(eq(schema.users.id, existingUser.id))

    // Return updated user with new role
    return {
      ...existingUser,
      role: isAdmin ? 'admin' : existingUser.role,
      lastLoginAt: new Date(),
      farcasterFid: farcasterFid || existingUser.farcasterFid,
      walletAddress: walletAddress || existingUser.walletAddress,
      email: email || existingUser.email,
    }
  }

  // Create new user
  const userId = `user_${randomBytes(16).toString('hex')}`
  const userName = email?.split('@')[0] || farcasterFid || walletAddress?.slice(0, 8) || 'User'

  const newUser = {
    id: userId,
    privyUserId,
    farcasterFid,
    walletAddress,
    email,
    name: userName,
    role: isAdmin ? 'admin' : 'user',
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  }

  await db.insert(schema.users).values(newUser)

  return newUser
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  return await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })
}


