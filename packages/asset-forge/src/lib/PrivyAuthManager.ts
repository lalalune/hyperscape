/**
 * Privy Authentication Manager for Asset Forge
 * Handles authentication state and token management
 */

import type { User } from '@privy-io/react-auth'

/**
 * Privy authentication state
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

  /** Whether this is the user's first time logging in */
  isNewUser: boolean
}

/**
 * PrivyAuthManager - Authentication state management for Asset Forge
 *
 * Manages Privy authentication state and provides methods for login/logout.
 * Stores authentication data in localStorage for persistence across page refreshes.
 */
export class PrivyAuthManager {
  private static instance: PrivyAuthManager
  private state: PrivyAuthState = {
    isAuthenticated: false,
    privyUserId: null,
    privyToken: null,
    user: null,
    isNewUser: false,
  }

  private listeners: Set<(state: PrivyAuthState) => void> = new Set()

  private constructor() {}

  /**
   * Gets the singleton instance of PrivyAuthManager
   */
  static getInstance(): PrivyAuthManager {
    if (!PrivyAuthManager.instance) {
      PrivyAuthManager.instance = new PrivyAuthManager()
    }
    return PrivyAuthManager.instance
  }

  /**
   * Updates authentication state and notifies listeners
   */
  updateState(updates: Partial<PrivyAuthState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  /**
   * Sets the authenticated user from Privy
   * Called after successful Privy authentication
   */
  setAuthenticatedUser(user: User, token: string, isNewUser: boolean = false): void {
    this.updateState({
      isAuthenticated: true,
      privyUserId: user.id,
      privyToken: token,
      user,
      isNewUser,
    })

    // Store token for persistence
    localStorage.setItem('privy_auth_token', token)
    localStorage.setItem('privy_user_id', user.id)
    if (isNewUser) {
      localStorage.setItem('privy_is_new_user', 'true')
    }
  }

  /**
   * Clears all authentication state
   */
  clearAuth(): void {
    this.updateState({
      isAuthenticated: false,
      privyUserId: null,
      privyToken: null,
      user: null,
      isNewUser: false,
    })

    // Clear from localStorage
    localStorage.removeItem('privy_auth_token')
    localStorage.removeItem('privy_user_id')
    localStorage.removeItem('privy_is_new_user')
  }

  /**
   * Marks that the user has completed onboarding
   */
  completeOnboarding(): void {
    this.updateState({ isNewUser: false })
    localStorage.removeItem('privy_is_new_user')
  }

  /**
   * Gets the current authentication state
   */
  getState(): PrivyAuthState {
    return { ...this.state }
  }

  /**
   * Gets the Privy access token for API calls
   */
  getToken(): string | null {
    return this.state.privyToken
  }

  /**
   * Gets the Privy user ID
   */
  getUserId(): string | null {
    return this.state.privyUserId
  }

  /**
   * Gets the user object
   */
  getUser(): User | null {
    return this.state.user
  }

  /**
   * Checks if the user is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated
  }

  /**
   * Checks if this is a new user who hasn't completed onboarding
   */
  isNewUser(): boolean {
    return this.state.isNewUser
  }

  /**
   * Subscribes to authentication state changes
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
   */
  restoreFromStorage(): { token: string | null; userId: string | null; isNewUser: boolean } {
    const token = localStorage.getItem('privy_auth_token')
    const userId = localStorage.getItem('privy_user_id')
    const isNewUser = localStorage.getItem('privy_is_new_user') === 'true'

    if (token && userId) {
      this.updateState({
        isAuthenticated: true,
        privyUserId: userId,
        privyToken: token,
        isNewUser,
      })
    }

    return { token, userId, isNewUser }
  }
}

/**
 * Singleton instance of PrivyAuthManager
 */
export const privyAuthManager = PrivyAuthManager.getInstance()

// Expose globally for API client access
if (typeof window !== 'undefined') {
  (window as any).privyAuthManager = privyAuthManager
}
