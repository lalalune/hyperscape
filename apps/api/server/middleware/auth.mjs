/**
 * Authentication Middleware
 * Handles user authentication and admin authorization
 */

import { query } from '../database/db.mjs'
import { validateUserId } from '../validation/user-schemas.mjs'

/**
 * Helper: Validates and extracts user ID from request headers
 * Returns the canonical userId or null if validation fails
 * Sends 401 response directly when validation fails
 */
function validateAndExtractUserId(req, res) {
  const rawUserId = req.headers['x-user-id']

  if (!rawUserId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please provide x-user-id header.'
    })
    return null
  }

  // Validate and canonicalize user ID
  const validation = validateUserId(rawUserId)
  
  if (!validation.valid) {
    console.warn(`[Auth Middleware] Invalid user ID format: ${validation.error}`)
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid user ID format. Please ensure you are using a valid authentication token.'
    })
    return null
  }

  return validation.userId
}

/**
 * Basic authentication check
 * Verifies user exists and attaches to req.user
 * 
 * SECURITY: Validates user ID format before querying database
 */
export async function requireAuth(req, res, next) {
  try {
    // Get userId from header (set by frontend from Privy)
    const userId = validateAndExtractUserId(req, res)
    if (!userId) return

    // Fetch user from database by privy_user_id
    const result = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, role, settings, created_at, updated_at
       FROM users
       WHERE privy_user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      console.log(`[Auth Middleware] User not found for validated userId: ${userId}`)
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found. Please ensure you are registered.'
      })
    }

    // Attach user to request
    req.user = result.rows[0]
    
    console.log(`[Auth Middleware] User authenticated: ${userId}`)

    next()
  } catch (error) {
    console.error('[Auth Middleware] Error in requireAuth:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    })
  }
}

/**
 * Admin-only authorization check
 * Requires authentication and admin role
 * 
 * SECURITY: Validates user ID format before querying database
 */
export async function requireAdmin(req, res, next) {
  try {
    // First check authentication
    const userId = validateAndExtractUserId(req, res)
    if (!userId) return

    // Fetch user from database
    const result = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, role, settings, created_at, updated_at
       FROM users
       WHERE privy_user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      console.log(`[Auth Middleware] Admin check: User not found for validated userId: ${userId}`)
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found. Please ensure you are registered.'
      })
    }

    const user = result.rows[0]

    // Check if user is admin
    if (user.role !== 'admin') {
      console.warn(`[Auth Middleware] Non-admin user attempted admin access: ${userId}`)
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required. You do not have permission to access this resource.'
      })
    }

    // Attach user to request
    req.user = user
    
    console.log(`[Auth Middleware] Admin user authenticated: ${userId}`)

    next()
  } catch (error) {
    console.error('[Auth Middleware] Error in requireAdmin:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    })
  }
}

/**
 * Team Leader or Admin authorization check
 * Requires authentication and team_leader or admin role
 * 
 * SECURITY: Validates user ID format before querying database
 */
export async function requireTeamLeaderOrAdmin(req, res, next) {
  try {
    // First check authentication
    const userId = validateAndExtractUserId(req, res)
    if (!userId) return

    // Fetch user from database
    const result = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, role, settings, created_at, updated_at
       FROM users
       WHERE privy_user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      console.log(`[Auth Middleware] Team leader check: User not found for validated userId: ${userId}`)
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found. Please ensure you are registered.'
      })
    }

    const user = result.rows[0]

    // Check if user is admin or team_leader
    if (user.role !== 'admin' && user.role !== 'team_leader') {
      console.warn(`[Auth Middleware] Non-privileged user attempted team leader access: ${userId}`)
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Team Leader or Admin access required. You do not have permission to access this resource.'
      })
    }

    // Attach user to request
    req.user = user
    
    console.log(`[Auth Middleware] Team leader/admin user authenticated: ${userId}`)

    next()
  } catch (error) {
    console.error('[Auth Middleware] Error in requireTeamLeaderOrAdmin:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    })
  }
}
