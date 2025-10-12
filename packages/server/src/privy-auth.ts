/**
 * Server-side Privy Authentication
 * Verifies Privy access tokens and extracts user information
 */

import { PrivyClient } from '@privy-io/server-auth'

// Initialize Privy client (lazy initialization)
let privyClient: PrivyClient | null = null

function getPrivyClient(): PrivyClient | null {
  if (privyClient) {
    return privyClient
  }

  const appId = process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET

  if (!appId || !appSecret) {
    console.warn('[Privy Auth] Privy credentials not configured. Authentication will fall back to legacy mode.')
    return null
  }

  try {
    privyClient = new PrivyClient(appId, appSecret)
    console.log('[Privy Auth] Privy client initialized')
    return privyClient
  } catch (error) {
    console.error('[Privy Auth] Failed to initialize Privy client:', error)
    return null
  }
}

export interface PrivyUserInfo {
  privyUserId: string
  farcasterFid: string | null
  walletAddress: string | null
  email: string | null
  isVerified: boolean
}

/**
 * Verify a Privy access token and extract user information
 */
export async function verifyPrivyToken(token: string): Promise<PrivyUserInfo | null> {
  const client = getPrivyClient()
  
  if (!client) {
    // Privy not configured, return null
    return null
  }

  try {
    // Verify the token with Privy
    const verifiedClaims = await client.verifyAuthToken(token)
    
    if (!verifiedClaims || !verifiedClaims.userId) {
      console.warn('[Privy Auth] Invalid token claims')
      return null
    }

    // Get full user data
    const user = await client.getUserById(verifiedClaims.userId)

    if (!user) {
      console.warn('[Privy Auth] User not found:', verifiedClaims.userId)
      return null
    }

    // Extract user information
    const privyUserId = user.id
    const farcasterFid = user.farcaster?.fid ? String(user.farcaster.fid) : null
    const walletAddress = user.wallet?.address || null
    const email = user.email?.address || null
    const isVerified = true // If we got here, token is verified

    console.log('[Privy Auth] Token verified for user:', {
      privyUserId,
      hasFarcaster: !!farcasterFid,
      hasWallet: !!walletAddress,
      hasEmail: !!email,
    })

    return {
      privyUserId,
      farcasterFid,
      walletAddress,
      email,
      isVerified,
    }
  } catch (error) {
    console.error('[Privy Auth] Token verification failed:', error)
    return null
  }
}

/**
 * Check if Privy authentication is enabled
 */
export function isPrivyEnabled(): boolean {
  const appId = process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  return !!(appId && appSecret)
}

/**
 * Get Privy user by ID (for admin/system use)
 */
export async function getPrivyUserById(userId: string): Promise<PrivyUserInfo | null> {
  const client = getPrivyClient()
  
  if (!client) {
    return null
  }

  try {
    const user = await client.getUserById(userId)
    
    if (!user) {
      return null
    }

    return {
      privyUserId: user.id,
      farcasterFid: user.farcaster?.fid ? String(user.farcaster.fid) : null,
      walletAddress: user.wallet?.address || null,
      email: user.email?.address || null,
      isVerified: true,
    }
  } catch (error) {
    console.error('[Privy Auth] Failed to get user:', error)
    return null
  }
}


