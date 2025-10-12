/**
 * Privy Authentication Manager
 * Handles Privy authentication state and token management for Hyperscape
 */

import type { User } from '@privy-io/react-auth'

export interface PrivyAuthState {
  isAuthenticated: boolean
  privyUserId: string | null
  privyToken: string | null
  user: User | null
  farcasterFid: string | null
}

export class PrivyAuthManager {
  private static instance: PrivyAuthManager
  private state: PrivyAuthState = {
    isAuthenticated: false,
    privyUserId: null,
    privyToken: null,
    user: null,
    farcasterFid: null,
  }
  
  private listeners: Set<(state: PrivyAuthState) => void> = new Set()

  private constructor() {}

  static getInstance(): PrivyAuthManager {
    if (!PrivyAuthManager.instance) {
      PrivyAuthManager.instance = new PrivyAuthManager()
    }
    return PrivyAuthManager.instance
  }

  /**
   * Update authentication state
   */
  updateState(updates: Partial<PrivyAuthState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  /**
   * Set authenticated user from Privy
   */
  setAuthenticatedUser(user: User, token: string): void {
    // Extract Farcaster FID if available
    const farcasterAccount = user.farcaster
    const farcasterFid = farcasterAccount?.fid ? String(farcasterAccount.fid) : null

    this.updateState({
      isAuthenticated: true,
      privyUserId: user.id,
      privyToken: token,
      user,
      farcasterFid,
    })

    // Store token for persistence
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('privy_auth_token', token)
      localStorage.setItem('privy_user_id', user.id)
      if (farcasterFid) {
        localStorage.setItem('farcaster_fid', farcasterFid)
      }
    }

    console.log('[PrivyAuthManager] User authenticated:', {
      userId: user.id,
      hasFarcaster: !!farcasterAccount,
      fid: farcasterFid,
    })
  }

  /**
   * Clear authentication state
   */
  clearAuth(): void {
    this.updateState({
      isAuthenticated: false,
      privyUserId: null,
      privyToken: null,
      user: null,
      farcasterFid: null,
    })

    // Clear from localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('privy_auth_token')
      localStorage.removeItem('privy_user_id')
      localStorage.removeItem('farcaster_fid')
    }

    console.log('[PrivyAuthManager] Authentication cleared')
  }

  /**
   * Get current auth state
   */
  getState(): PrivyAuthState {
    return { ...this.state }
  }

  /**
   * Get Privy token for API calls
   */
  getToken(): string | null {
    return this.state.privyToken
  }

  /**
   * Get Privy user ID
   */
  getUserId(): string | null {
    return this.state.privyUserId
  }

  /**
   * Get Farcaster FID if available
   */
  getFarcasterFid(): string | null {
    return this.state.farcasterFid
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: PrivyAuthState) => void): () => void {
    this.listeners.add(listener)
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState())
      } catch (error) {
        console.error('[PrivyAuthManager] Listener error:', error)
      }
    })
  }

  /**
   * Restore auth from localStorage (for page refresh)
   */
  restoreFromStorage(): { token: string | null; userId: string | null } {
    if (typeof localStorage === 'undefined') {
      return { token: null, userId: null }
    }

    const token = localStorage.getItem('privy_auth_token')
    const userId = localStorage.getItem('privy_user_id')
    const fid = localStorage.getItem('farcaster_fid')

    if (token && userId) {
      this.updateState({
        isAuthenticated: true,
        privyUserId: userId,
        privyToken: token,
        farcasterFid: fid,
      })
      console.log('[PrivyAuthManager] Restored auth from storage')
    }

    return { token, userId }
  }
}

// Export singleton instance
export const privyAuthManager = PrivyAuthManager.getInstance()


