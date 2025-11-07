/**
 * Privy Authentication Middleware for Elysia
 * Verifies JWT tokens from Privy and attaches user to context
 */

import { Elysia } from 'elysia'
import { PrivyClient } from '@privy-io/server-auth'
import { userService } from '../services/UserService'
import type { User } from '../db/schema'

// Validate environment variables
if (!process.env.PRIVY_APP_ID) {
  throw new Error('PRIVY_APP_ID environment variable is required')
}
if (!process.env.PRIVY_APP_SECRET) {
  throw new Error('PRIVY_APP_SECRET environment variable is required')
}

// Initialize Privy client
const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
})

/**
 * Authentication plugin
 * Adds optional user authentication to all routes
 */
export const authPlugin = new Elysia({ name: 'privy-auth' })
  .derive(async ({ request, set }) => {
    const authHeader = request.headers.get('authorization')

    // No auth header = public access
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null as User | null }
    }

    try {
      // Extract and verify JWT token
      const token = authHeader.substring(7)
      const verifiedClaims = await privy.verifyAuthToken(token)

      // Get or create user in database
      const user = await userService.getOrCreateUser(
        verifiedClaims.userId,
        (verifiedClaims as any).wallet?.address,
        (verifiedClaims as any).email
      )

      // Update last login (async, don't wait)
      userService.updateLastLogin(user.id).catch((err) =>
        console.error('[Auth] Failed to update last login:', err)
      )

      return { user }
    } catch (error: any) {
      console.error('[Auth] Token verification failed:', error.message)
      return { user: null as User | null }
    }
  })

/**
 * Require authentication guard
 * Blocks requests without valid authentication
 */
export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401
      return {
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      }
    }
  })

/**
 * Require admin guard
 * Blocks requests from non-admin users
 */
export const requireAdmin = new Elysia({ name: 'require-admin' })
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401
      return {
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      }
    }

    if (user.role !== 'admin') {
      set.status = 403
      return {
        error: 'Forbidden',
        message: 'Admin access required',
      }
    }
  })

// Type augmentation for Elysia context
declare module 'elysia' {
  interface Context {
    user: User | null
  }
}
