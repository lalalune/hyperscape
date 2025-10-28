/**
 * Authentication Middleware for Hono
 * Handles user authentication and admin authorization
 */

import { query } from '../database/db.mjs'
import { validateUserId } from '../validation/user-schemas.mjs'

/**
 * Helper: Validates and extracts user ID from request headers
 * Returns the canonical userId or throws an error with response details
 */
function validateAndExtractUserId(c) {
  const rawUserId = c.req.header('x-user-id')

  if (!rawUserId) {
    return {
      error: true,
      response: c.json({
        error: 'Unauthorized',
        message: 'Authentication required. Please provide x-user-id header.'
      }, 401)
    }
  }

  // Validate and canonicalize user ID
  const validation = validateUserId(rawUserId)

  if (!validation.valid) {
    console.warn(`[Auth Middleware] Invalid user ID format: ${validation.error}`)
    return {
      error: true,
      response: c.json({
        error: 'Unauthorized',
        message: 'Invalid user ID format. Please ensure you are using a valid authentication token.'
      }, 401)
    }
  }

  return { error: false, userId: validation.userId }
}

/**
 * Basic authentication check
 * Verifies user exists and attaches to context
 *
 * SECURITY: Validates user ID format before querying database
 */
export async function requireAuth(c, next) {
  try {
    // Get userId from header (set by frontend from Privy)
    const result = validateAndExtractUserId(c)
    if (result.error) return result.response

    const userId = result.userId

    // Fetch user from database by privy_user_id
    const dbResult = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, role, settings, created_at, updated_at
       FROM users
       WHERE privy_user_id = $1`,
      [userId]
    )

    if (dbResult.rows.length === 0) {
      console.log(`[Auth Middleware] User not found for validated userId: ${userId}`)
      return c.json({
        error: 'Unauthorized',
        message: 'User not found. Please ensure you are registered.'
      }, 401)
    }

    // Attach user to context
    c.set('user', dbResult.rows[0])

    console.log(`[Auth Middleware] User authenticated: ${userId}`)

    await next()
  } catch (error) {
    console.error('[Auth Middleware] Error in requireAuth:', error)
    return c.json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    }, 500)
  }
}

/**
 * Admin-only authorization check
 * Requires authentication and admin role
 *
 * SECURITY: Validates user ID format before querying database
 */
export async function requireAdmin(c, next) {
  try {
    // First check authentication
    const result = validateAndExtractUserId(c)
    if (result.error) return result.response

    const userId = result.userId

    // Fetch user from database
    const dbResult = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, role, settings, created_at, updated_at
       FROM users
       WHERE privy_user_id = $1`,
      [userId]
    )

    if (dbResult.rows.length === 0) {
      console.log(`[Auth Middleware] Admin check: User not found for validated userId: ${userId}`)
      return c.json({
        error: 'Unauthorized',
        message: 'User not found. Please ensure you are registered.'
      }, 401)
    }

    const user = dbResult.rows[0]

    // Check if user is admin
    if (user.role !== 'admin') {
      console.warn(`[Auth Middleware] Non-admin user attempted admin access: ${userId}`)
      return c.json({
        error: 'Forbidden',
        message: 'Admin access required. You do not have permission to access this resource.'
      }, 403)
    }

    // Attach user to context
    c.set('user', user)

    console.log(`[Auth Middleware] Admin user authenticated: ${userId}`)

    await next()
  } catch (error) {
    console.error('[Auth Middleware] Error in requireAdmin:', error)
    return c.json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    }, 500)
  }
}

/**
 * Team Leader or Admin authorization check
 * Requires authentication and team_leader or admin role
 *
 * SECURITY: Validates user ID format before querying database
 */
export async function requireTeamLeaderOrAdmin(c, next) {
  try {
    // First check authentication
    const result = validateAndExtractUserId(c)
    if (result.error) return result.response

    const userId = result.userId

    // Fetch user from database
    const dbResult = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, role, settings, created_at, updated_at
       FROM users
       WHERE privy_user_id = $1`,
      [userId]
    )

    if (dbResult.rows.length === 0) {
      console.log(`[Auth Middleware] Team leader check: User not found for validated userId: ${userId}`)
      return c.json({
        error: 'Unauthorized',
        message: 'User not found. Please ensure you are registered.'
      }, 401)
    }

    const user = dbResult.rows[0]

    // Check if user is admin or team_leader
    if (user.role !== 'admin' && user.role !== 'team_leader') {
      console.warn(`[Auth Middleware] Non-privileged user attempted team leader access: ${userId}`)
      return c.json({
        error: 'Forbidden',
        message: 'Team Leader or Admin access required. You do not have permission to access this resource.'
      }, 403)
    }

    // Attach user to context
    c.set('user', user)

    console.log(`[Auth Middleware] Team leader/admin user authenticated: ${userId}`)

    await next()
  } catch (error) {
    console.error('[Auth Middleware] Error in requireTeamLeaderOrAdmin:', error)
    return c.json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    }, 500)
  }
}
