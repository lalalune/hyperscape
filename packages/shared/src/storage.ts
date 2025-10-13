/**
 * Browser-only storage implementation
 * 
 * For server-side storage, import from './storage.server.js'
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

// Client-only storage - use LocalStorage in browser
if (typeof window !== 'undefined' && window.localStorage) {
  storage = new LocalStorage();
} else {
  // For server environments, they should import NodeStorage directly from storage.server.js
  // This fallback creates a stub that will fail if used
  storage = new LocalStorage(); // Will throw at runtime if used outside browser
}

export { storage };
export type Storage = LocalStorage;
