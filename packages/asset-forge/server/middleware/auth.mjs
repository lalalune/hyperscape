/**
 * Authentication Middleware
 *
 * Handles Privy JWT verification and user authentication
 */

import { PrivyClient } from '@privy-io/server-auth'
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('AuthMiddleware')

// Initialize Privy client
let privyClient = null

if (process.env.VITE_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) {
  privyClient = new PrivyClient(
    process.env.VITE_PUBLIC_PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET
  )
  logger.info('Privy authentication initialized')
} else {
  logger.warn('Privy credentials not configured - authentication will be in development mode')
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7) // Remove 'Bearer ' prefix
}

/**
 * Authenticate user middleware
 * Verifies Privy JWT token and sets req.user
 */
export async function authenticateUser(req, res, next) {
  try {
    const token = extractBearerToken(req)

    // Development mode: Allow requests without authentication
    if (!privyClient) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          error: 'Authentication not configured',
          message: 'Privy authentication is not configured on this server'
        })
      }

      // Development fallback
      logger.debug('Authentication bypassed in development mode')
      req.user = {
        id: 'dev-user-123',
        privyId: 'privy_dev_user',
        email: 'dev@localhost',
        role: 'developer'
      }
      return next()
    }

    // Require token in production
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      })
    }

    // Verify Privy JWT token
    const verifiedClaims = await privyClient.verifyAuthToken(token)

    // Extract user info from verified claims
    const userId = verifiedClaims.userId

    // Set user on request object
    req.user = {
      id: userId,
      privyId: userId,
      email: verifiedClaims.email || null,
      walletAddress: verifiedClaims.wallet?.address || null,
      role: 'user' // Default role, can be enhanced with database lookup
    }

    logger.debug('User authenticated', {
      userId,
      email: req.user.email
    })

    next()
  } catch (error) {
    logger.error('Authentication failed', {
      error: error.message,
      stack: error.stack
    })

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token'
    })
  }
}

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't require it
 * Sets req.user if token is valid, otherwise continues without user
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = extractBearerToken(req)

    if (!token || !privyClient) {
      // No token or no Privy client, continue without auth
      return next()
    }

    // Try to verify token
    const verifiedClaims = await privyClient.verifyAuthToken(token)
    const userId = verifiedClaims.userId

    req.user = {
      id: userId,
      privyId: userId,
      email: verifiedClaims.email || null,
      walletAddress: verifiedClaims.wallet?.address || null,
      role: 'user'
    }

    logger.debug('User optionally authenticated', { userId })
    next()
  } catch (error) {
    // Authentication failed, but that's okay for optional auth
    logger.debug('Optional authentication failed, continuing without user')
    next()
  }
}

/**
 * Require admin role middleware
 * Must be used after authenticateUser
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    })
  }

  // Check if user has admin role
  // In production, this should check the database
  const isAdmin = req.user.role === 'admin' || req.user.role === 'developer'

  if (!isAdmin) {
    logger.warn('Admin access denied', {
      userId: req.user.id,
      role: req.user.role
    })

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    })
  }

  logger.debug('Admin access granted', {
    userId: req.user.id,
    role: req.user.role
  })

  next()
}

/**
 * Verify API key middleware
 * Checks X-API-Key header against database
 */
export async function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key in the X-API-Key header or apiKey query parameter'
    })
  }

  try {
    // TODO: Verify API key against database when schema is implemented
    // For now, check against environment variable for development
    const validKey = process.env.API_KEY

    if (validKey && apiKey !== validKey) {
      logger.warn('Invalid API key attempt', {
        keyPrefix: apiKey.substring(0, 8)
      })

      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      })
    }

    logger.debug('API key verified', {
      keyPrefix: apiKey.substring(0, 8)
    })

    next()
  } catch (error) {
    logger.error('API key verification error', {
      error: error.message
    })

    return res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to verify API key'
    })
  }
}
