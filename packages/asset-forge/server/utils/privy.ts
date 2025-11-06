/**
 * Privy Authentication Utilities
 * Handles JWT token verification and permission checks for secure authentication
 */

import { PrivyClient } from '@privy-io/server-auth'
import type { UserContextType, AssetMetadataType } from '../models'

// Initialize Privy client with app credentials from environment
export const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID || '',
  process.env.PRIVY_APP_SECRET || '',
  {
    // Optional: use verification key for faster local JWT verification
    // If not provided, Privy SDK will fetch it automatically (adds ~100ms per request)
    verificationKey: process.env.PRIVY_VERIFICATION_KEY
  }
)

/**
 * Verifies a Privy authentication token and extracts user context
 *
 * @param token - The JWT token to verify (without "Bearer " prefix)
 * @returns User context with privyId, walletAddress, and admin status, or null if invalid
 *
 * @example
 * ```typescript
 * const user = await verifyPrivyToken(token)
 * if (user) {
 *   console.log('Authenticated:', user.privyId)
 *   console.log('Is Admin:', user.isAdmin)
 * }
 * ```
 */
export async function verifyPrivyToken(token: string): Promise<UserContextType | null> {
  try {
    // Verify the JWT token with Privy
    const claims = await privyClient.verifyAuthToken(token)

    // Check if user is an admin
    const adminIds = (process.env.ADMIN_PRIVY_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)

    const isAdmin = adminIds.includes(claims.userId)

    // Extract user identity from verified claims
    return {
      privyId: claims.userId,
      // Extract wallet address if present (linked_accounts can contain wallet info)
      walletAddress: undefined, // Privy SDK doesn't directly expose wallet in verifyAuthToken
      isAdmin
    }
  } catch (error) {
    // Token verification failed (expired, invalid signature, etc.)
    console.error('[Privy] Token verification failed:', error)
    return null
  }
}

/**
 * Extracts authentication token from request headers or cookies
 *
 * Supports two authentication methods:
 * 1. Authorization header: "Bearer <token>"
 * 2. Cookie: "privy-token=<token>"
 *
 * @param headers - Request headers object
 * @param cookie - Request cookies object (Elysia Cookie type)
 * @returns Extracted token string or null if not found
 */
export function extractToken(
  headers: Record<string, string | undefined>,
  cookie: Record<string, { value: unknown } | undefined>
): string | null {
  // Try Authorization header first (standard REST API pattern)
  const authHeader = headers.authorization || headers.Authorization
  if (authHeader) {
    // Remove "Bearer " prefix if present
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader
    return token
  }

  // Fall back to cookie (browser-based auth pattern)
  const cookieValue = cookie['privy-token']?.value
  if (cookieValue && typeof cookieValue === 'string') {
    return cookieValue
  }

  return null
}

/**
 * Checks if a user has permission to modify an asset
 *
 * Permission rules:
 * - Admins can modify any asset
 * - Regular users can only modify their own assets
 * - Unauthenticated users cannot modify assets
 * - All assets are public (readable by everyone)
 *
 * @param user - The authenticated user context (null if unauthenticated)
 * @param asset - The asset metadata to check permissions for
 * @returns true if user can modify the asset, false otherwise
 *
 * @example
 * ```typescript
 * if (!canModifyAsset(user, asset)) {
 *   return { error: 'Permission denied' }
 * }
 * ```
 */
export function canModifyAsset(
  user: UserContextType | null,
  asset: AssetMetadataType
): boolean {
  // No user = no permission
  if (!user || !user.privyId) {
    return false
  }

  // Admins can modify anything
  if (user.isAdmin) {
    return true
  }

  // Regular users can only modify their own assets
  return asset.createdBy === user.privyId
}

/**
 * Error class for permission denied errors
 */
export class PermissionDeniedError extends Error {
  constructor(message = 'Permission denied') {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}
