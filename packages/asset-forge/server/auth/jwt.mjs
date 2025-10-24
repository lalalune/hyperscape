/**
 * JWT Authentication Utilities
 * 
 * Create and verify JWT tokens for session management
 */

import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'

/**
 * JWT_SECRET validation - REQUIRED in ALL environments
 *
 * Security requirements:
 * - Must be set in environment variables
 * - No weak defaults allowed
 * - Minimum 32 bytes (base64 encoded = 43+ chars)
 * - Fail-fast if not properly configured
 *
 * Generate with: openssl rand -base64 32
 */
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET is required in ALL environments.\n' +
    'Generate a secure secret with: openssl rand -base64 32\n' +
    'Add to .env file: JWT_SECRET=your_generated_secret_here'
  )
}

if (JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET is too short (minimum 32 characters required).\n' +
    'Generate a secure secret with: openssl rand -base64 32'
  )
}

const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d' // 7 days default

/**
 * Create a JWT token for a user session
 * 
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export function createJWT(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    privyUserId: user.privyUserId,
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    issuer: 'asset-forge',
    subject: user.id,
  })
}

/**
 * Verify a JWT token
 * 
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'asset-forge',
    })
  } catch (error) {
    console.error('[JWT] Verification failed:', error.message)
    return null
  }
}

/**
 * Decode JWT without verification (for debugging)
 * 
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
export function decodeJWT(token) {
  try {
    return jwt.decode(token)
  } catch (error) {
    return null
  }
}

/**
 * Generate a random session ID
 * 
 * @returns {string} Random session ID
 */
export function generateSessionId() {
  return `session_${randomBytes(32).toString('hex')}`
}

