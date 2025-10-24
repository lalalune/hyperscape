/**
 * Unified Authentication Middleware
 * 
 * Shared Express middleware for authentication and authorization.
 * Works with any database through dependency injection.
 */

import type { Request, Response, NextFunction } from 'express'
import type { JWTService, JWTPayload } from './jwt'
import type { User } from './privy-auth'

/**
 * Extended Express Request with user data
 */
export interface AuthenticatedRequest extends Request {
  user?: User
  userId?: string
  token?: JWTPayload
}

/**
 * Configuration for authentication middleware
 */
export interface AuthMiddlewareConfig {
  /** JWT service for token verification */
  jwtService: JWTService
  
  /** Function to get user by ID from database */
  getUserById: (userId: string) => Promise<User | null>
  
  /** Optional function to check API credit limits */
  checkApiCredits?: (userId: string, creditsNeeded: number) => Promise<boolean>
  
  /** Optional function to get user's credit usage */
  getUserCredits?: (userId: string) => Promise<{ used: number; limit: number }>
}

/**
 * Extract JWT token from request
 * 
 * Checks Authorization header (Bearer token) and query parameters
 */
function extractToken(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const rawHeader = req.headers?.authorization
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Check query parameter (for WebSocket upgrades, image requests, etc.)
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token
  }

  // Check cookie (optional fallback)
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token
  }

  return null
}

/**
 * Create authentication middleware with dependency injection
 * 
 * @param config - Middleware configuration
 * @returns Authentication middleware functions
 * 
 * @example
 * ```typescript
 * const authMiddleware = createAuthMiddleware({
 *   jwtService,
 *   getUserById: async (userId) => db.users.findById(userId)
 * })
 * 
 * app.get('/api/protected', authMiddleware.authenticateUser, (req, res) => {
 *   res.json({ user: req.user })
 * })
 * ```
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const { jwtService, getUserById, checkApiCredits, getUserCredits } = config

  /**
   * Require authentication - Returns 401 if not authenticated
   */
  async function authenticateUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = extractToken(req)

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      })
      return
    }

    // Verify JWT
    const payload = jwtService.verifyJWT(token)

    if (!payload) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Token verification failed',
      })
      return
    }

    // Get user from database
    const user = await getUserById(payload.userId)

    if (!user) {
      res.status(401).json({
        error: 'User not found',
        message: 'Token is valid but user does not exist',
      })
      return
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been disabled',
      })
      return
    }

    // Attach to request
    req.user = user
    req.userId = user.id
    req.token = payload

    next()
  }

  /**
   * Optional authentication - Tries to authenticate but doesn't require it
   */
  async function optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = extractToken(req)

    if (!token) {
      req.user = undefined
      req.userId = undefined
      req.token = undefined
      next()
      return
    }

    const payload = jwtService.verifyJWT(token)

    if (!payload) {
      req.user = undefined
      req.userId = undefined
      req.token = undefined
      next()
      return
    }

    const user = await getUserById(payload.userId)

    if (user && user.isActive) {
      req.user = user
      req.userId = user.id
      req.token = payload
    } else {
      req.user = undefined
      req.userId = undefined
      req.token = undefined
    }

    next()
  }

  /**
   * Require admin role - Returns 403 if not admin
   */
  async function requireAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // First authenticate
    await authenticateUser(req, res, () => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      if (req.user.role !== 'admin') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Admin access required',
        })
        return
      }

      next()
    })
  }

  /**
   * Require specific role(s)
   */
  function requireRole(...roles: string[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      await authenticateUser(req, res, () => {
        if (!req.user) {
          res.status(401).json({
            error: 'Authentication required',
          })
          return
        }

        if (!roles.includes(req.user.role)) {
          res.status(403).json({
            error: 'Forbidden',
            message: `Required role: ${roles.join(' or ')}`,
          })
          return
        }

        next()
      })
    }
  }

  /**
   * Require API credits - Returns 429 if limit exceeded
   */
  function requireApiCredits(creditsNeeded = 1) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      if (!checkApiCredits || !getUserCredits) {
        // Skip credit check if not configured
        next()
        return
      }

      const hasCredits = await checkApiCredits(req.user.id, creditsNeeded)

      if (!hasCredits) {
        const credits = await getUserCredits(req.user.id)
        
        res.status(429).json({
          error: 'API limit exceeded',
          message: `You have used ${credits.used} of ${credits.limit} credits. This operation requires ${creditsNeeded} credits.`,
          usage: {
            used: credits.used,
            limit: credits.limit,
            available: credits.limit - credits.used,
            needed: creditsNeeded,
          },
        })
        return
      }

      next()
    }
  }

  return {
    authenticateUser,
    optionalAuth,
    requireAdmin,
    requireRole,
    requireApiCredits,
  }
}

/**
 * Type for authentication middleware
 */
export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>
