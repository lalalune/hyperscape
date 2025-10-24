/**
 * Unified JWT Service
 * 
 * Shared JWT creation, verification, and session management.
 */

import crypto from 'crypto'
import {
  JsonWebTokenError,
  TokenExpiredError,
  type Algorithm,
  type JwtPayload as JwtPayloadBase,
  type SignOptions,
  decode,
  sign,
  verify,
} from 'jsonwebtoken'

/**
 * JWT configuration options
 */
export interface JWTConfig {
  /** Secret key for signing tokens */
  secret: string
  
  /** Token expiry time (e.g., '7d', '24h', '1h') */
  expiry: string
  
  /** Issuer name for the token */
  issuer: string
  
  /** Algorithm to use for signing */
  algorithm?: Algorithm
}

/**
 * JWT payload interface
 */
export interface JWTPayload extends JwtPayloadBase {
  userId: string
  email?: string
  role?: string
  [key: string]: unknown
}

/**
 * Unified JWT Service
 * 
 * Provides JWT creation, verification, and session management
 * with consistent behavior across all applications.
 * 
 * @example
 * ```typescript
 * const jwtService = new JWTService({
 *   secret: process.env.JWT_SECRET,
 *   expiry: '7d',
 *   issuer: 'hyperscape'
 * })
 * 
 * const token = jwtService.createJWT({ userId: '123', role: 'admin' })
 * const payload = jwtService.verifyJWT(token)
 * ```
 */
export class JWTService {
  private config: Required<JWTConfig>

  constructor(config: JWTConfig) {
    if (!config.secret) {
      throw new Error('JWT secret is required')
    }
    
    if (config.secret.length < 32) {
      console.warn('[JWT] Secret is shorter than 32 characters - use a longer secret in production')
    }
    
    this.config = {
      ...config,
      algorithm: config.algorithm || 'HS256',
    }
  }

  /**
   * Create a JWT token
   * 
   * @param payload - Token payload (must include userId)
   * @returns JWT token string
   */
  createJWT(payload: JWTPayload): string {
    if (!payload.userId) {
      throw new Error('userId is required in JWT payload')
    }

    const signOptions: SignOptions = {
      expiresIn: this.config.expiry as SignOptions['expiresIn'],
      issuer: this.config.issuer,
      subject: payload.userId,
      algorithm: this.config.algorithm,
    }

    return sign(payload, this.config.secret, signOptions)
  }

  /**
   * Verify a JWT token
   * 
   * @param token - JWT token to verify
   * @returns Decoded payload or null if invalid
   */
  verifyJWT(token: string): JWTPayload | null {
    try {
      const payload = verify(token, this.config.secret, {
        issuer: this.config.issuer,
        algorithms: [this.config.algorithm],
      })

      if (typeof payload === 'string') {
        return null
      }

      return payload as JWTPayload
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        console.debug('[JWT] Token expired:', error.message)
      } else if (error instanceof JsonWebTokenError) {
        console.debug('[JWT] Token invalid:', error.message)
      } else {
        console.error('[JWT] Verification failed:', error)
      }
      return null
    }
  }

  /**
   * Decode JWT without verification (for debugging)
   * 
   * ⚠️ WARNING: This does not verify the token signature!
   * Only use for debugging or inspecting tokens.
   * 
   * @param token - JWT token
   * @returns Decoded payload or null
   */
  decodeJWT(token: string): JWTPayload | null {
    try {
      const decoded = decode(token)
      if (!decoded || typeof decoded === 'string') {
        return null
      }
      return decoded as JWTPayload
    } catch (error) {
      console.error('[JWT] Decode failed:', error)
      return null
    }
  }

  /**
   * Check if a token is expired
   * 
   * @param token - JWT token
   * @returns true if expired, false otherwise
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeJWT(token)
    if (!payload || !payload.exp) return true
    
    return Date.now() >= payload.exp * 1000
  }

  /**
   * Get token expiry date
   * 
   * @param token - JWT token
   * @returns Expiry date or null
   */
  getTokenExpiry(token: string): Date | null {
    const payload = this.decodeJWT(token)
    if (!payload || !payload.exp) return null
    
    return new Date(payload.exp * 1000)
  }

  /**
   * Generate a random session ID
   * 
   * @returns Random session ID string
   */
  generateSessionId(): string {
    return `session_${crypto.randomBytes(32).toString('hex')}`
  }

  /**
   * Generate a random user ID
   * 
   * @param prefix - Optional prefix (e.g., 'user_')
   * @returns Random user ID string
   */
  generateUserId(prefix = 'user_'): string {
    return `${prefix}${crypto.randomBytes(16).toString('hex')}`
  }

  /**
   * Refresh a token (create new token with same payload)
   * 
   * @param token - Existing JWT token
   * @returns New JWT token or null if verification fails
   */
  refreshToken(token: string): string | null {
    const payload = this.verifyJWT(token)
    if (!payload) return null
    
    // Remove standard claims (iat, exp, iss, sub)
    const { iat, exp, iss, sub, ...customPayload } = payload

    return this.createJWT(customPayload as JWTPayload)
  }
}

/**
 * Factory function to create JWT service
 */
export function createJWTService(config: JWTConfig): JWTService {
  return new JWTService(config)
}
