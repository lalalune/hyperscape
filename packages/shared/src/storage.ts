/**
 * storage.ts - Browser LocalStorage Wrapper
 * 
 * Provides a simple JSON-based storage interface for browser environments.
 * Data is persisted to the browser's localStorage API.
 * 
 * Features:
 * - Automatic JSON serialization/deserialization
 * - Safe fallback when localStorage is unavailable (SSR, tests, etc.)
 * - Type-safe interface with unknown return type for proper type checking
 * 
 * For server-side storage (Node.js), import from './storage.server.js' instead.
 * Server-side storage uses file-based persistence with JSON files.
 * 
 * Usage:
 * ```typescript
 * import { storage } from './storage';
 * storage.set('playerPrefs', { volume: 0.8, quality: 'high' });
 * const prefs = storage.get('playerPrefs');
 * storage.remove('playerPrefs');
 * ```
 * 
 * Used by: ClientRuntime, ClientInterface (preferences), PlayerLocal
 * References: storage.server.ts (server-side implementation)
 */

/**
 * LocalStorage - Browser localStorage wrapper with JSON serialization.
 * 
 * Provides a consistent API for storing and retrieving data in the browser.
 */
export class LocalStorage {
  get(key: string): unknown {
    if (typeof localStorage === 'undefined') return null
    const data = localStorage.getItem(key)
    if (data === null) return null
    return JSON.parse(data)
  }

  set(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') return
    const data = JSON.stringify(value)
    localStorage.setItem(key, data)
  }

  remove(key: string): void {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(key)
  }
}

// Re-export NodeStorage type for compatibility
// The actual implementation is in storage.server.ts
export type { NodeStorage } from './storage.server.js';

// Export based on environment
let storage: LocalStorage;

if (typeof window !== 'undefined' && window.localStorage) {
  storage = new LocalStorage();
} else {
  storage = new LocalStorage();
}

export { storage };
export type Storage = LocalStorage;
