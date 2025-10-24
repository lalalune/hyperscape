/**
 * Privy Authentication Manager
 * Manages authentication state and storage
 */

import { EventEmitter } from 'events'

interface User {
  id: string
  wallet?: { address: string }
  email?: { address: string }
  google?: { email: string }
  [key: string]: unknown
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

class PrivyAuthManager extends EventEmitter {
  private state: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
  }

  private readonly STORAGE_KEY = 'asset-forge-auth'

  constructor() {
    super()
    this.restoreFromStorage()
  }

  /**
   * Set authenticated user and token
   */
  async setAuthenticatedUser(user: User, token: string): Promise<void> {
    this.state = {
      user,
      token,
      isAuthenticated: true,
    }

    // Persist to localStorage
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          user,
          token,
          timestamp: Date.now(),
        })
      )
    } catch (error) {
      console.error('[PrivyAuthManager] Failed to save to localStorage:', error)
    }

    this.emit('state-changed', this.state)
    this.emit('authenticated', user)
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.state = {
      user: null,
      token: null,
      isAuthenticated: false,
    }

    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.error('[PrivyAuthManager] Failed to clear localStorage:', error)
    }

    this.emit('state-changed', this.state)
    this.emit('logged-out')
  }

  /**
   * Restore session from localStorage
   */
  restoreFromStorage(): AuthState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const { user, token, timestamp } = JSON.parse(stored)

        // Check if session is not too old (7 days)
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
        if (Date.now() - timestamp < sevenDaysMs) {
          this.state = {
            user,
            token,
            isAuthenticated: true,
          }
          console.log('[PrivyAuthManager] Session restored from storage')
        } else {
          console.log('[PrivyAuthManager] Session expired, clearing storage')
          this.clearAuth()
        }
      }
    } catch (error) {
      console.error('[PrivyAuthManager] Failed to restore from localStorage:', error)
    }

    return this.state
  }

  /**
   * Get current authentication state
   */
  getState(): AuthState {
    return { ...this.state }
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.state.user
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.state.token
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated
  }
}

// Export singleton instance
export const privyAuthManager = new PrivyAuthManager()

