/**
 * utils-client.ts - Browser-Specific Utility Functions
 * 
 * Provides utility functions that require browser APIs (window, navigator, crypto).
 * These utilities are only available in browser environments, not on the server.
 * 
 * Functions:
 * 
 * 1. **isTouch** (boolean):
 *    Detects if the device primarily uses touch input (mobile, tablet).
 *    Uses media queries and navigator API to determine touch capability.
 *    Used for: Adapting UI controls, showing/hiding mobile-specific buttons
 * 
 * 2. **hashFile(file)** (async):
 *    Generates SHA-256 hash of a File or Blob for content-addressed storage.
 *    Used for: Deduplicating uploads, cache keys, content verification
 * 
 * 3. **cls(...args)** (string):
 *    Combines class names and conditional classes for React/DOM elements.
 *    Supports strings and conditional objects { 'className': boolean }
 *    Used for: Dynamic CSS class generation in React components
 * 
 * Used by: ClientInput, ClientInterface, React components
 * References: ClientInput.ts (touch detection), UI components (cls)
 */

/**
 * isTouch - Detects if the device primarily uses touch input.
 * 
 * Uses multiple heuristics to reliably detect touch devices:
 * - pointer: coarse media query (touch vs mouse precision)
 * - hover: none media query (no hover capability)
 * - navigator.maxTouchPoints > 0 (hardware support)
 */
const coarse = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
const noHover = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(hover: none)').matches : false;
const hasTouch = typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints > 0 : false;
export const isTouch = (coarse && hasTouch) || (noHover && hasTouch);

/**
 * Hash File
 * Takes a file and generates a sha256 unique hash
 */
export async function hashFile(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')
  return hash
}

/**
 * Class name utility
 * Combines class names and conditional classes
 */
export function cls(...args: (string | Record<string, unknown> | undefined | null)[]): string {
  let str = ''
  for (const arg of args) {
    if (typeof arg === 'string') {
      str += ' ' + arg
    } else if (typeof arg === 'object' && arg !== null) {
      for (const key in arg) {
        const value = arg[key]
        if (value) str += ' ' + key
      }
    }
  }
  return str
}

