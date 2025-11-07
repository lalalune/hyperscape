/**
 * Privy Authentication Middleware
 * Optional JWT authentication that extracts user context if token is present
 */

import { Elysia } from 'elysia'
import { verifyPrivyToken, extractToken } from '../utils/privy'

/**
 * Optional Privy authentication middleware
 * - Extracts and verifies JWT tokens from Authorization header or privy-token cookie
 * - If token is present and valid, attaches user context to request
 * - If no token or invalid token, continues without authentication (optional mode)
 */
export const authMiddleware = new Elysia({ name: 'auth' })
  .derive(async ({ headers, cookie }) => {
    // Extract token from Authorization header or cookie
    const token = extractToken(headers, cookie)

    // No token provided - continue without authentication
    if (!token) {
      return { user: null }
    }

    // Verify token with Privy and extract user context
    const user = await verifyPrivyToken(token)

    // Token verification failed or token invalid
    if (!user) {
      console.log('[Auth] Invalid or expired token - continuing without authentication')
      return { user: null }
    }

    // Token valid - attach user context
    console.log(`[Auth] Authenticated user: ${user.privyId}`)
    return { user }
  })
