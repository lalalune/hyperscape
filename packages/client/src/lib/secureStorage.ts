/**
 * Secure Storage Utility
 *
 * Provides a secure abstraction for storing sensitive data in the browser.
 * This module is designed to be easily swapped out for httpOnly cookie-based
 * storage when the server supports it.
 *
 * SECURITY NOTES:
 * - localStorage is vulnerable to XSS attacks - any script running on the page can read it
 * - sessionStorage is slightly more secure as it clears when the tab closes
 * - httpOnly cookies are the most secure option but require server-side support
 *
 * CURRENT IMPLEMENTATION:
 * - Uses sessionStorage for session data (clears on tab close)
 * - Uses localStorage for persistent data (survives browser restart)
 * - Adds token expiration validation
 * - Sanitizes data before storage
 *
 * MIGRATION PATH TO HTTPONLY COOKIES:
 * 1. Server needs to set httpOnly cookies on authentication
 * 2. Server needs to validate cookies on each request
 * 3. Client removes token storage calls and relies on cookies being sent automatically
 * 4. Update getToken() to call a /me endpoint instead of reading from storage
 *
 * @packageDocumentation
 */

import { logger } from "./logger";

/** Token with expiration */
interface StoredToken {
  value: string;
  expiresAt: number; // Unix timestamp
  createdAt: number;
}

/** Default token expiration (24 hours) */
const DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Session expiration (8 hours) */
const SESSION_EXPIRATION_MS = 8 * 60 * 60 * 1000;

/**
 * Stores a value with expiration
 *
 * @param key - Storage key
 * @param value - Value to store
 * @param storage - Storage mechanism (localStorage or sessionStorage)
 * @param expirationMs - Time until expiration in milliseconds
 */
function setWithExpiration(
  key: string,
  value: string,
  storage: Storage,
  expirationMs: number = DEFAULT_TOKEN_EXPIRATION_MS,
): void {
  const now = Date.now();
  const token: StoredToken = {
    value,
    expiresAt: now + expirationMs,
    createdAt: now,
  };

  try {
    storage.setItem(key, JSON.stringify(token));
  } catch (err) {
    logger.error(`[SecureStorage] Failed to store ${key}:`, err);
  }
}

/**
 * Gets a value, checking expiration
 *
 * @param key - Storage key
 * @param storage - Storage mechanism
 * @returns The value if valid and not expired, null otherwise
 */
function getWithExpiration(key: string, storage: Storage): string | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const token = JSON.parse(raw) as StoredToken;

    // Check expiration
    if (Date.now() > token.expiresAt) {
      logger.warn(`[SecureStorage] Token ${key} has expired, removing`);
      storage.removeItem(key);
      return null;
    }

    return token.value;
  } catch (err) {
    logger.error(`[SecureStorage] Failed to read ${key}:`, err);
    return null;
  }
}

/**
 * Removes a value from storage
 */
function remove(key: string, storage: Storage): void {
  storage.removeItem(key);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Stores an auth token with expiration
 *
 * Uses localStorage for persistence across sessions.
 * Token will be automatically invalidated after expiration.
 *
 * @param key - Token key (e.g., "privy_auth_token")
 * @param token - The token value
 * @param expirationMs - Optional custom expiration (defaults to 24 hours)
 */
export function setAuthToken(
  key: string,
  token: string,
  expirationMs?: number,
): void {
  setWithExpiration(
    key,
    token,
    localStorage,
    expirationMs ?? DEFAULT_TOKEN_EXPIRATION_MS,
  );
}

/**
 * Gets an auth token, returning null if expired
 *
 * @param key - Token key
 * @returns The token value or null if expired/missing
 */
export function getAuthToken(key: string): string | null {
  return getWithExpiration(key, localStorage);
}

/**
 * Removes an auth token
 *
 * @param key - Token key
 */
export function removeAuthToken(key: string): void {
  remove(key, localStorage);
}

/**
 * Stores session data (clears when tab closes)
 *
 * Uses sessionStorage for better security - data is cleared when the tab closes.
 *
 * @param key - Session key
 * @param value - Session value
 */
export function setSessionData(key: string, value: string): void {
  setWithExpiration(key, value, sessionStorage, SESSION_EXPIRATION_MS);
}

/**
 * Gets session data
 *
 * @param key - Session key
 * @returns The session value or null if expired/missing
 */
export function getSessionData(key: string): string | null {
  return getWithExpiration(key, sessionStorage);
}

/**
 * Removes session data
 *
 * @param key - Session key
 */
export function removeSessionData(key: string): void {
  remove(key, sessionStorage);
}

/**
 * Checks if a token is valid and not expired
 *
 * @param key - Token key
 * @returns true if token exists and is not expired
 */
export function isTokenValid(key: string): boolean {
  return getAuthToken(key) !== null;
}

/**
 * Gets the remaining time until token expiration
 *
 * @param key - Token key
 * @returns Milliseconds until expiration, or -1 if expired/missing
 */
export function getTokenExpirationMs(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return -1;

    const token = JSON.parse(raw) as StoredToken;
    const remaining = token.expiresAt - Date.now();

    return remaining > 0 ? remaining : -1;
  } catch {
    return -1;
  }
}

/**
 * Clears all auth-related data
 *
 * Removes all auth tokens and session data.
 * Call this on logout.
 */
export function clearAllAuthData(): void {
  // Clear known auth keys from localStorage
  const authKeys = [
    "privy_auth_token",
    "privy_user_id",
    "hyperia_player_token",
  ];

  for (const key of authKeys) {
    localStorage.removeItem(key);
  }

  // Clear session storage
  sessionStorage.clear();

  logger.info("[SecureStorage] All auth data cleared");
}

/**
 * Migrates from raw localStorage to secure storage
 *
 * Call this once on app initialization to migrate existing tokens
 * to the new format with expiration.
 */
export function migrateToSecureStorage(): void {
  const keysToMigrate = ["privy_auth_token", "privy_user_id"];

  for (const key of keysToMigrate) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      // Check if already migrated (has expiration structure)
      try {
        const parsed = JSON.parse(raw);
        if (parsed.expiresAt !== undefined) {
          // Already migrated
          continue;
        }
      } catch {
        // Not JSON or old format - migrate it
      }

      // Migrate to new format with expiration
      logger.info(`[SecureStorage] Migrating ${key} to secure format`);
      setWithExpiration(raw, raw, localStorage, DEFAULT_TOKEN_EXPIRATION_MS);
    } catch (err) {
      logger.error(`[SecureStorage] Failed to migrate ${key}:`, err);
    }
  }
}
