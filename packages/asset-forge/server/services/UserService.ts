/**
 * User Service
 * Handles user operations with caching and business logic
 */

import { db } from '../db/db'
import { users, adminWhitelist, activityLog, type User, type NewUser } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export class UserService {
  private userCache = new Map<string, { user: User; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get user by Privy user ID, with caching
   */
  async getUserByPrivyId(privyUserId: string): Promise<User | null> {
    // Check cache
    const cached = this.userCache.get(privyUserId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.user
    }

    // Fetch from database
    const [user] = await db.select().from(users).where(eq(users.privyUserId, privyUserId)).limit(1)

    if (user) {
      // Update cache
      this.userCache.set(privyUserId, { user, timestamp: Date.now() })
    }

    return user || null
  }

  /**
   * Get or create user (handles first-time login)
   * Uses upsert to handle race conditions
   */
  async getOrCreateUser(privyUserId: string, walletAddress?: string, email?: string): Promise<User> {
    // Try to get existing user first
    let user = await this.getUserByPrivyId(privyUserId)
    if (user) {
      // Update wallet/email if provided and not already set
      if ((walletAddress && !user.walletAddress) || (email && !user.email)) {
        user = await this.updateUser(user.id, {
          walletAddress: walletAddress || user.walletAddress,
          email: email || user.email,
        })
      }
      return user
    }

    // Check if wallet is whitelisted for admin
    let role: 'admin' | 'member' = 'member'
    if (walletAddress) {
      const [whitelisted] = await db
        .select()
        .from(adminWhitelist)
        .where(eq(adminWhitelist.walletAddress, walletAddress))
        .limit(1)

      if (whitelisted) {
        role = 'admin'
        console.log(`[UserService] Wallet ${walletAddress} is whitelisted - creating admin user`)
      }
    }

    // Create new user with conflict handling
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          privyUserId,
          walletAddress,
          email,
          role,
          settings: {},
        })
        .onConflictDoUpdate({
          target: users.privyUserId,
          set: {
            walletAddress: walletAddress || undefined,
            email: email || undefined,
            lastLoginAt: new Date(),
          },
        })
        .returning()

      // Cache the new user
      this.userCache.set(privyUserId, { user: newUser, timestamp: Date.now() })

      console.log(`[UserService] Created new user: ${privyUserId} (role: ${role})`)
      return newUser
    } catch (error) {
      console.error('[UserService] Error creating user:', error)
      throw error
    }
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()

    if (!updated) {
      throw new Error(`User ${userId} not found`)
    }

    // Clear cache
    this.clearCacheByUserId(userId)

    return updated
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId))

    // Clear cache
    this.clearCacheByUserId(userId)
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
    return user?.role === 'admin'
  }

  /**
   * Log user activity
   */
  async logActivity(
    userId: string,
    entityType: string,
    action: string,
    details: Record<string, any> = {},
    entityId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await db.insert(activityLog).values({
      userId,
      entityType,
      entityId,
      action,
      details,
      ipAddress,
      userAgent,
    })
  }

  /**
   * Clear cache for specific user
   */
  clearCacheByUserId(userId: string): void {
    // Find and remove from cache (need to iterate since we key by privyUserId)
    for (const [key, value] of this.userCache.entries()) {
      if (value.user.id === userId) {
        this.userCache.delete(key)
        break
      }
    }
  }

  /**
   * Clear cache for Privy user ID
   */
  clearCache(privyUserId: string): void {
    this.userCache.delete(privyUserId)
  }

  /**
   * Clear entire cache (for testing or manual refresh)
   */
  clearAllCache(): void {
    this.userCache.clear()
    console.log('[UserService] Cache cleared')
  }
}

// Export singleton instance
export const userService = new UserService()
