/**
 * Privy Authentication Manager
 * Handles Privy authentication state and token management for Hyperia
 */

import type { User } from "@privy-io/react-auth";
import { clearCsrfToken } from "../lib/api-client";

/**
 * Privy authentication state
 *
 * Contains all authentication-related state including user data,
 * tokens, and Farcaster integration.
 *
 * @public
 */
export interface PrivyAuthState {
  /** Whether the Privy SDK has finished initializing */
  privySdkReady: boolean;

  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;

  /** Privy user ID (unique identifier from Privy) */
  privyUserId: string | null;

  /** Privy access token for API calls */
  privyToken: string | null;

  /** Full Privy user object with profile data */
  user: User | null;

  /** Farcaster FID if the user has linked their Farcaster account */
  farcasterFid: string | null;
}

/**
 * Storage type for auth tokens
 * - 'localStorage': Persists across browser sessions, but vulnerable to XSS
 * - 'sessionStorage': Per-tab only, cleared on tab close, more secure
 * - 'memory': In-memory only, most secure but lost on page refresh
 */
export type AuthStorageType = "localStorage" | "sessionStorage" | "memory";

/**
 * PrivyAuthManager - Privy authentication state management
 *
 * Manages Privy authentication state and provides methods for login/logout.
 * Stores authentication data for persistence across page refreshes.
 *
 * @remarks
 * This is a singleton that manages Privy-specific authentication separately
 * from the PlayerTokenManager (which handles in-game identity).
 *
 * @security
 * SECURITY NOTE: Tokens stored in browser storage are accessible to JavaScript and
 * potentially vulnerable to XSS attacks. For enhanced security in production:
 * 1. Use httpOnly cookies set by the server for sensitive tokens (requires server changes)
 * 2. Use Privy SDK's getAccessToken() for API calls instead of cached tokens
 * 3. Implement CSP headers to mitigate XSS risks
 * 4. The Privy SDK handles its own secure token storage and refresh
 * 5. Consider using sessionStorage instead of localStorage for per-tab isolation
 *
 * Current implementation stores tokens for quick synchronous access patterns,
 * but relies on Privy SDK for actual token refresh and validation.
 *
 * @public
 */
export class PrivyAuthManager {
  private static instance: PrivyAuthManager;
  private state: PrivyAuthState = {
    privySdkReady: false,
    isAuthenticated: false,
    privyUserId: null,
    privyToken: null,
    user: null,
    farcasterFid: null,
  };

  private listeners: Set<(state: PrivyAuthState) => void> = new Set();

  /**
   * Storage type for auth tokens
   * Can be changed via setStorageType() before authentication
   */
  private storageType: AuthStorageType = "localStorage";

  private constructor() {}

  /**
   * Gets the appropriate storage based on configured type
   */
  private getStorage(): Storage | null {
    switch (this.storageType) {
      case "sessionStorage":
        return typeof sessionStorage !== "undefined" ? sessionStorage : null;
      case "localStorage":
        return typeof localStorage !== "undefined" ? localStorage : null;
      case "memory":
      default:
        return null;
    }
  }

  private getValueFromKnownStorages(key: string): string | null {
    const storages: Storage[] = [];
    const configuredStorage = this.getStorage();
    if (configuredStorage) {
      storages.push(configuredStorage);
    }
    if (
      typeof sessionStorage !== "undefined" &&
      !storages.includes(sessionStorage)
    ) {
      storages.push(sessionStorage);
    }
    if (
      typeof localStorage !== "undefined" &&
      !storages.includes(localStorage)
    ) {
      storages.push(localStorage);
    }

    for (const storage of storages) {
      try {
        const value = storage.getItem(key);
        if (value) return value;
      } catch {
        // Ignore unavailable storage
      }
    }

    return null;
  }

  /**
   * Sets the storage type for auth tokens
   * Must be called before authentication to take effect
   *
   * @param type - Storage type to use
   *
   * @public
   */
  setStorageType(type: AuthStorageType): void {
    this.storageType = type;
  }

  /**
   * Gets the current storage type
   *
   * @public
   */
  getStorageType(): AuthStorageType {
    return this.storageType;
  }

  /**
   * Gets the singleton instance of PrivyAuthManager
   *
   * @returns The singleton instance
   *
   * @public
   */
  static getInstance(): PrivyAuthManager {
    if (!PrivyAuthManager.instance) {
      PrivyAuthManager.instance = new PrivyAuthManager();
    }
    return PrivyAuthManager.instance;
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
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
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
    const farcasterAccount = user.farcaster;
    const farcasterFid = farcasterAccount?.fid
      ? String(farcasterAccount.fid)
      : null;

    this.updateState({
      isAuthenticated: true,
      privyUserId: user.id,
      privyToken: token,
      user,
      farcasterFid,
    });

    // Store token for persistence using configured storage type
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem("privy_auth_token", token);
        storage.setItem("privy_user_id", user.id);
        if (farcasterFid) {
          storage.setItem("farcaster_fid", farcasterFid);
        }
      } catch (error) {
        // Storage may be unavailable (private browsing, quota exceeded, etc.)
        console.warn("[PrivyAuthManager] Failed to store auth token:", error);
      }
    }
    // If storageType is 'memory', tokens are only kept in state (this.state)
  }

  /**
   * Clears all authentication state
   *
   * Removes auth data from memory and localStorage. Called on logout.
   * Also clears CSRF token cache for security.
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
    });

    // Clear from configured storage
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.removeItem("privy_auth_token");
        storage.removeItem("privy_user_id");
        storage.removeItem("farcaster_fid");
      } catch (error) {
        console.warn("[PrivyAuthManager] Failed to clear auth storage:", error);
      }
    }

    // Also clear from both storages to ensure clean logout
    // (in case storage type was changed during session)
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("privy_auth_token");
        localStorage.removeItem("privy_user_id");
        localStorage.removeItem("farcaster_fid");
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("privy_auth_token");
        sessionStorage.removeItem("privy_user_id");
        sessionStorage.removeItem("farcaster_fid");
      }
    } catch {
      // Ignore errors from unavailable storage
    }

    // Clear CSRF token cache
    clearCsrfToken();
  }

  /**
   * Sets the Privy SDK ready state
   *
   * Called by PrivyAuthHandler when Privy SDK finishes initializing.
   * This gates auth-dependent logic in the App component to prevent
   * race conditions during initial page load.
   *
   * @param ready - Whether Privy SDK is ready
   *
   * @public
   */
  setPrivySdkReady(ready: boolean): void {
    if (this.state.privySdkReady !== ready) {
      this.updateState({ privySdkReady: ready });
    }
  }

  /**
   * Gets the current authentication state
   *
   * @returns A copy of the current auth state
   *
   * @public
   */
  getState(): PrivyAuthState {
    return { ...this.state };
  }

  /**
   * Gets the Privy access token for API calls
   *
   * @returns The access token or null if not authenticated
   *
   * @public
   */
  getToken(): string | null {
    return this.state.privyToken;
  }

  /**
   * Gets the Privy user ID
   *
   * @returns The user ID or null if not authenticated
   *
   * @public
   */
  getUserId(): string | null {
    return this.state.privyUserId;
  }

  /**
   * Gets the Farcaster FID if the user has linked their account
   *
   * @returns The Farcaster FID or null if not linked
   *
   * @public
   */
  getFarcasterFid(): string | null {
    return this.state.farcasterFid;
  }

  /**
   * Checks if the user is currently authenticated
   *
   * @returns true if authenticated, false otherwise
   *
   * @public
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
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
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.getState());
    });
  }

  /**
   * Hydrates cached auth metadata from storage without asserting a real session.
   *
   * Cached tokens/user IDs are helpful for transitional UI and legacy sync paths,
   * but the actual authenticated session must come from the Privy SDK itself.
   * Marking the app authenticated from storage alone can leave startup stuck in an
   * invalid "loading" state until the SDK later corrects it.
   *
   * @returns Object with restored token and userId (or null if not found)
   *
   * @public
   */
  restoreFromStorage(): { token: string | null; userId: string | null } {
    try {
      const token = this.getValueFromKnownStorages("privy_auth_token");
      const userId = this.getValueFromKnownStorages("privy_user_id");
      const fid = this.getValueFromKnownStorages("farcaster_fid");

      if (token || userId) {
        this.updateState({
          privyUserId: userId,
          privyToken: token,
          farcasterFid: fid,
        });
      }

      return { token, userId };
    } catch (error) {
      console.warn("[PrivyAuthManager] Failed to restore from storage:", error);
      return { token: null, userId: null };
    }
  }
}

/**
 * Singleton instance of PrivyAuthManager
 *
 * Use this throughout the application for Privy authentication.
 *
 * @public
 */
export const privyAuthManager = PrivyAuthManager.getInstance();
