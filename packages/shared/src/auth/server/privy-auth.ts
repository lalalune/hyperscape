/**
 * Unified Privy Authentication Service
 * 
 * Shared server-side Privy token verification and user management.
 * Uses adapter pattern to work with different database implementations.
 */

import { PrivyClient } from '@privy-io/server-auth'

/**
 * User information extracted from Privy tokens
 */
export interface PrivyUserInfo {
  privyUserId: string
  farcasterFid: string | null
  walletAddress: string | null
  email: string | null
  isVerified: boolean
}

/**
 * User record from application database
 */
export interface User {
  id: string
  privyUserId: string | null
  farcasterFid: string | null
  walletAddress: string | null
  email: string | null
  name: string
  role: string
  isActive: boolean
  createdAt: Date
  lastLoginAt: Date | null
  [key: string]: unknown
}

/**
 * Database adapter interface
 * 
 * Implement this interface for your specific database (PostgreSQL, SQLite, etc.)
 */
export interface PrivyAuthAdapter {
  getUserByPrivyId(privyUserId: string): Promise<User | null>
  createUser(userInfo: PrivyUserInfo): Promise<User>
  updateUser(userId: string, updates: Partial<User>): Promise<void>
}

/**
 * Privy authentication service configuration
 */
export interface PrivyAuthConfig {
  appId: string
  appSecret: string
  adapter: PrivyAuthAdapter
}

/**
 * Unified Privy Authentication Service
 * 
 * Handles Privy token verification and user management using
 * a database adapter pattern for flexibility.
 * 
 * @example
 * ```typescript
 * // PostgreSQL adapter for Hyperscape
 * const adapter: PrivyAuthAdapter = {
 *   getUserByPrivyId: async (privyUserId) => {
 *     return await db.query.users.findFirst({
 *       where: eq(schema.users.privyUserId, privyUserId)
 *     })
 *   },
 *   createUser: async (userInfo) => { ... },
 *   updateUser: async (userId, updates) => { ... }
 * }
 * 
 * const privyAuth = new PrivyAuthService({
 *   appId: process.env.PRIVY_APP_ID,
 *   appSecret: process.env.PRIVY_APP_SECRET,
 *   adapter
 * })
 * ```
 */
export class PrivyAuthService {
  private client: PrivyClient | null = null
  private config: PrivyAuthConfig

  constructor(config: PrivyAuthConfig) {
    this.config = config
    
    if (config.appId && config.appSecret) {
      this.client = new PrivyClient(config.appId, config.appSecret)
    } else {
      console.warn('[PrivyAuth] No credentials configured - authentication disabled')
    }
  }

  /**
   * Check if Privy authentication is enabled
   */
  isEnabled(): boolean {
    return !!this.client
  }

  /**
   * Verify a Privy access token and extract user information
   * 
   * @param token - Privy access token from client
   * @returns User information or null if verification fails
   */
  async verifyPrivyToken(token: string): Promise<PrivyUserInfo | null> {
    if (!this.client) {
      return null
    }

    try {
      // Verify token
      const verifiedClaims = await this.client.verifyAuthToken(token)

      if (!verifiedClaims || !verifiedClaims.userId) {
        return null
      }

      // Get full user profile
      const user = await this.client.getUserById(verifiedClaims.userId)

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
      console.error('[PrivyAuth] Token verification failed:', error)
      return null
    }
  }

  /**
   * Get or create user account from Privy authentication
   * 
   * @param privyUserInfo - Verified Privy user information
   * @returns User record from database
   */
  async getOrCreateUser(privyUserInfo: PrivyUserInfo): Promise<User> {
    // Try to find existing user
    const existingUser = await this.config.adapter.getUserByPrivyId(privyUserInfo.privyUserId)

    if (existingUser) {
      // Update last login and profile data
      await this.config.adapter.updateUser(existingUser.id, {
        lastLoginAt: new Date(),
        farcasterFid: privyUserInfo.farcasterFid || existingUser.farcasterFid,
        walletAddress: privyUserInfo.walletAddress || existingUser.walletAddress,
        email: privyUserInfo.email || existingUser.email,
      })

      return existingUser
    }

    // Create new user
    return await this.config.adapter.createUser(privyUserInfo)
  }

  /**
   * Get Privy user information by ID (admin/system use)
   * 
   * @param userId - Privy user ID
   * @returns User information or null
   */
  async getPrivyUserById(userId: string): Promise<PrivyUserInfo | null> {
    if (!this.client) {
      return null
    }

    try {
      const user = await this.client.getUserById(userId)

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
      console.error('[PrivyAuth] Failed to get user by ID:', error)
      return null
    }
  }
}

/**
 * Factory function to create PrivyAuthService
 */
export function createPrivyAuthService(config: PrivyAuthConfig): PrivyAuthService {
  return new PrivyAuthService(config)
}

