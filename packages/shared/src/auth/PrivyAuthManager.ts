/**
 * Unified Privy Authentication Manager
 * 
 * Shared authentication state management for all Hyperscape applications.
 * Supports both Hyperscape game client and Asset Forge with configurable options.
 * 
 * @packageDocumentation
 */

import type { User } from '@privy-io/react-auth'
import EventEmitter from 'eventemitter3'

/**
 * Configuration options for PrivyAuthManager
 */
export interface PrivyAuthConfig {
  /**
   * Prefix for localStorage keys
   * @default 'privy_'
   */
  storagePrefix?: string
  
  /**
   * API endpoint for token exchange (optional)
   * If provided, will exchange Privy token for app-specific JWT
   * @example '/api/auth/login'
   */
  tokenExchangeEndpoint?: string
  
  /**
   * Name of the app-specific token field in state
   * @default 'appToken'
   */
  appTokenName?: string
  
  /**
   * Whether to use EventEmitter for state changes
   * @default true
   */
  useEventEmitter?: boolean
}

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
  
  /** App-specific JWT token (if token exchange is enabled) */
  appToken: string | null
  
  /** Full Privy user object with profile data */
  user: User | null
  
  /** Farcaster FID if the user has linked their Farcaster account */
  farcasterFid: string | null
}

/**
 * Unified PrivyAuthManager
 * 
 * Manages Privy authentication state with support for multiple applications.
 * Can optionally exchange Privy tokens for app-specific JWTs.
 * 
 * @example
 * ```typescript
 * // Hyperscape usage (no token exchange)
 * const authManager = new PrivyAuthManager({
 *   storagePrefix: 'hyperscape_'
 * })
 * 
 * // Asset Forge usage (with token exchange)
 * const authManager = new PrivyAuthManager({
 *   storagePrefix: 'asset_forge_',
 *   tokenExchangeEndpoint: '/api/auth/login',
 *   appTokenName: 'assetForgeToken'
 * })
 * ```
 */
export class PrivyAuthManager extends EventEmitter {
  private static instances = new Map<string, PrivyAuthManager>()
  private config: Required<PrivyAuthConfig>
  private state: PrivyAuthState = {
    isAuthenticated: false,
    privyUserId: null,
    privyToken: null,
    appToken: null,
    user: null,
    farcasterFid: null,
  }
  
  private legacyListeners: Set<(state: PrivyAuthState) => void> = new Set()

  private constructor(config?: PrivyAuthConfig) {
    super()
    
    this.config = {
      storagePrefix: config?.storagePrefix || 'privy_',
      tokenExchangeEndpoint: config?.tokenExchangeEndpoint || '',
      appTokenName: config?.appTokenName || 'appToken',
      useEventEmitter: config?.useEventEmitter !== false,
    }
  }

  /**
   * Gets a singleton instance of PrivyAuthManager
   * 
   * @param config - Configuration options (only used on first call)
   * @param instanceKey - Key for multiple instances (default: 'default')
   * @returns The singleton instance
   */
  static getInstance(config?: PrivyAuthConfig, instanceKey = 'default'): PrivyAuthManager {
    if (!PrivyAuthManager.instances.has(instanceKey)) {
      PrivyAuthManager.instances.set(instanceKey, new PrivyAuthManager(config))
    }
    return PrivyAuthManager.instances.get(instanceKey)!
  }

  /**
   * Updates authentication state
   */
  private updateState(updates: Partial<PrivyAuthState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  /**
   * Sets the authenticated user from Privy
   * 
   * Optionally exchanges Privy token for app-specific JWT if endpoint configured.
   */
  async setAuthenticatedUser(user: User, privyToken: string): Promise<void> {
    const farcasterAccount = user.farcaster
    const farcasterFid = farcasterAccount?.fid ? String(farcasterAccount.fid) : null

    this.updateState({
      isAuthenticated: true,
      privyUserId: user.id,
      privyToken,
      user,
      farcasterFid,
    })

    // Store Privy token
    this.setStorageItem('token', privyToken)
    this.setStorageItem('user_id', user.id)
    if (farcasterFid) {
      this.setStorageItem('farcaster_fid', farcasterFid)
    }

    // Exchange token if endpoint configured
    if (this.config.tokenExchangeEndpoint) {
      try {
        const response = await fetch(this.config.tokenExchangeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ privyToken }),
        })

        if (response.ok) {
          const data = await response.json()
          this.state.appToken = data.token
          this.setStorageItem(this.config.appTokenName, data.token)
          this.emit('authenticated', this.state)
        } else {
          console.error('[PrivyAuth] Token exchange failed:', await response.text())
        }
      } catch (error) {
        console.error('[PrivyAuth] Token exchange error:', error)
      }
    }

    this.emit('state-changed', this.state)
  }

  /**
   * Clears all authentication state
   */
  clearAuth(): void {
    this.updateState({
      isAuthenticated: false,
      privyUserId: null,
      privyToken: null,
      appToken: null,
      user: null,
      farcasterFid: null,
    })

    // Clear from localStorage
    this.removeStorageItem('token')
    this.removeStorageItem('user_id')
    this.removeStorageItem('farcaster_fid')
    this.removeStorageItem(this.config.appTokenName)

    this.emit('logged-out')
    this.emit('state-changed', this.state)
  }

  /**
   * Gets the current authentication state
   */
  getState(): PrivyAuthState {
    return { ...this.state }
  }

  /**
   * Gets the authentication token (app token if available, otherwise Privy token)
   */
  getToken(): string | null {
    return this.state.appToken || this.state.privyToken
  }
  
  /**
   * Gets the Privy access token specifically
   */
  getPrivyToken(): string | null {
    return this.state.privyToken
  }
  
  /**
   * Gets the app-specific token (if token exchange was performed)
   */
  getAppToken(): string | null {
    return this.state.appToken
  }

  /**
   * Gets the Privy user ID
   */
  getUserId(): string | null {
    return this.state.privyUserId
  }

  /**
   * Gets the Farcaster FID
   */
  getFarcasterFid(): string | null {
    return this.state.farcasterFid
  }

  /**
   * Checks if authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated
  }

  /**
   * Subscribes to authentication state changes (legacy API)
   * 
   * @deprecated Use EventEmitter events instead: on('state-changed', listener)
   */
  subscribe(listener: (state: PrivyAuthState) => void): () => void {
    this.legacyListeners.add(listener)
    return () => {
      this.legacyListeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    // EventEmitter listeners
    this.emit('state-changed', this.getState())
    
    // Legacy listeners
    this.legacyListeners.forEach(listener => {
      listener(this.getState())
    })
  }

  /**
   * Restores authentication from localStorage
   */
  restoreFromStorage(): { token: string | null; userId: string | null } {
    const privyToken = this.getStorageItem('token')
    const userId = this.getStorageItem('user_id')
    const appToken = this.getStorageItem(this.config.appTokenName)
    const fid = this.getStorageItem('farcaster_fid')

    if (privyToken && userId) {
      this.updateState({
        isAuthenticated: true,
        privyUserId: userId,
        privyToken,
        appToken,
        farcasterFid: fid,
      })
    }

    return { token: appToken || privyToken, userId }
  }

  /**
   * Helper to get storage key with prefix
   */
  private getStorageKey(key: string): string {
    return `${this.config.storagePrefix}${key}`
  }

  /**
   * Helper to set localStorage item
   */
  private setStorageItem(key: string, value: string): void {
    localStorage.setItem(this.getStorageKey(key), value)
  }

  /**
   * Helper to get localStorage item
   */
  private getStorageItem(key: string): string | null {
    return localStorage.getItem(this.getStorageKey(key))
  }

  /**
   * Helper to remove localStorage item
   */
  private removeStorageItem(key: string): void {
    localStorage.removeItem(this.getStorageKey(key))
  }
}

/**
 * Default singleton instance for Hyperscape
 */
export const privyAuthManager = PrivyAuthManager.getInstance({
  storagePrefix: 'privy_auth_',
})

/**
 * Factory function to create configured instances
 */
export function createPrivyAuthManager(config: PrivyAuthConfig, instanceKey?: string): PrivyAuthManager {
  return PrivyAuthManager.getInstance(config, instanceKey)
}

