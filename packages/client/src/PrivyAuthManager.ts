/**
 * Privy Authentication Manager
 * Handles Privy authentication state and token management for Hyperscape
 */

import type { User } from '@privy-io/react-auth'

/**
 * Privy authentication state
 * 
 * Contains all authentication-related state including user data,
 * tokens, and Farcaster integration.
 * 
 * @public
 */
export interface PrivyAuthState {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean
  
  /** Privy user ID (unique identifier from Privy) */
  privyUserId: string | null
  
  /** Privy access token for API calls */
  privyToken: string | null
  
  /** Full Privy user object with profile data */
  user: User | null
  
  /** Farcaster FID if the user has linked their Farcaster account */
  farcasterFid: string | null
}

/**
 * PrivyAuthManager - Privy authentication state management
 * 
 * Manages Privy authentication state and provides methods for login/logout.
 * Stores authentication data in localStorage for persistence across page refreshes.
 * 
 * @remarks
 * This is a singleton that manages Privy-specific authentication separately
 * from the PlayerTokenManager (which handles in-game identity).
 * 
 * @public
 */
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

  /**
   * Gets the singleton instance of PrivyAuthManager
   * 
   * @returns The singleton instance
   * 
   * @public
   */
  static getInstance(): PrivyAuthManager {
    if (!PrivyAuthManager.instance) {
      PrivyAuthManager.instance = new PrivyAuthManager()
    }
    return PrivyAuthManager.instance
  }

  /**
   * Updates authentication state
   * 
   * Merges the provided updates with the current state and notifies all listeners.
   * This is the internal method used by setAuthenticatedUser and clearAuth.
   * 
   * @param updates - Partial state updates to apply
   * 
   * @public
   */
  updateState(updates: Partial<PrivyAuthState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  /**
   * Sets the authenticated user from Privy
   * 
   * Called after successful Privy authentication. Stores the user object,
   * access token, and Farcaster FID (if linked) in state and localStorage.
   * 
   * @param user - Privy user object with profile data
   * @param token - Privy access token for API calls
   * 
   * @public
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
    localStorage.setItem('privy_auth_token', token)
    localStorage.setItem('privy_user_id', user.id)
    if (farcasterFid) {
      localStorage.setItem('farcaster_fid', farcasterFid)
    }

    console.log('[PrivyAuthManager] User authenticated:', {
      userId: user.id,
      hasFarcaster: !!farcasterAccount,
      fid: farcasterFid,
    })
  }

  /**
   * Clears all authentication state
   * 
   * Removes auth data from memory and localStorage. Called on logout.
   * 
   * @public
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
    localStorage.removeItem('privy_auth_token')
    localStorage.removeItem('privy_user_id')
    localStorage.removeItem('farcaster_fid')

    console.log('[PrivyAuthManager] Authentication cleared')
  }

  /**
   * Gets the current authentication state
   * 
   * @returns A copy of the current auth state
   * 
   * @public
   */
  getState(): PrivyAuthState {
    return { ...this.state }
  }

  /**
   * Gets the Privy access token for API calls
   * 
   * @returns The access token or null if not authenticated
   * 
   * @public
   */
  getToken(): string | null {
    return this.state.privyToken
  }

  /**
   * Gets the Privy user ID
   * 
   * @returns The user ID or null if not authenticated
   * 
   * @public
   */
  getUserId(): string | null {
    return this.state.privyUserId
  }

  /**
   * Gets the Farcaster FID if the user has linked their account
   * 
   * @returns The Farcaster FID or null if not linked
   * 
   * @public
   */
  getFarcasterFid(): string | null {
    return this.state.farcasterFid
  }

  /**
   * Checks if the user is currently authenticated
   * 
   * @returns true if authenticated, false otherwise
   * 
   * @public
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated
  }

  /**
   * Subscribes to authentication state changes
   * 
   * Registers a listener that will be called whenever the auth state changes.
   * Useful for updating UI in response to login/logout events.
   * 
   * @param listener - Callback function that receives the new state
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = privyAuthManager.subscribe((state) => {
   *   console.log('Auth state changed:', state.isAuthenticated);
   * });
   * 
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   * 
   * @public
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
      listener(this.getState())
    })
  }

  /**
   * Restores authentication from localStorage
   * 
   * Attempts to restore auth state from localStorage on page load.
   * This allows the user to stay logged in across page refreshes.
   * 
   * @returns Object with restored token and userId (or null if not found)
   * 
   * @public
   */
  restoreFromStorage(): { token: string | null; userId: string | null } {
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

/**
 * Singleton instance of PrivyAuthManager
 * 
 * Use this throughout the application for Privy authentication.
 * 
 * @public
 */
export const privyAuthManager = PrivyAuthManager.getInstance()


