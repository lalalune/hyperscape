/**
 * Client Utility Functions
 *
 * This module provides core utility functions for the Hyperscape client application:
 * - className composition for React components (cls)
 * - Device detection for touch vs. pointer interfaces (isTouch)
 * - File hashing for content verification and deduplication (hashFile)
 *
 * These utilities are used throughout the client package by React components,
 * file upload handlers, and responsive UI logic.
 */

/**
 * Conditionally joins class names together for React className props
 *
 * Accepts both strings and objects where keys are class names and values are booleans.
 * Only includes classes when their boolean value is truthy.
 *
 * @param args - Array of class name strings or conditional objects
 * @returns A space-separated string of class names
 *
 * @example
 * cls('btn', 'primary') // => ' btn primary'
 * cls('btn', { 'active': true, 'disabled': false }) // => ' btn active'
 * cls({ 'hidden': isHidden, 'visible': !isHidden }) // => ' hidden' or ' visible'
 */
export function cls(...args: (string | Record<string, unknown>)[]) {
  let str = "";
  for (const arg of args) {
    // Check if arg has string methods
    if ((arg as string).charAt) {
      str += " " + (arg as string);
    } else {
      // Must be an object - strong type assumption based on signature
      const obj = arg as Record<string, unknown>;
      for (const key in obj) {
        const value = obj[key];
        if (value) str += " " + key;
      }
    }
  }
  return str;
}

/**
 * Detects if the device primarily uses touch input
 *
 * Uses multiple indicators to reliably determine touch interfaces:
 * - Media query for coarse pointer (touchscreens)
 * - Media query for hover capability (touch devices typically can't hover)
 * - Touch points API (number of supported touch points)
 *
 * Requires at least two indicators to point to touch to avoid false positives
 * (e.g., a touchscreen laptop with a trackpad should be treated as pointer-based)
 *
 * This is used by UI components to show/hide touch controls, adjust button sizes,
 * and optimize pointer interactions.
 */
const coarse = window.matchMedia("(pointer: coarse)").matches;
const noHover = window.matchMedia("(hover: none)").matches;
const hasTouch = navigator.maxTouchPoints > 0;
export const isTouch = (coarse && hasTouch) || (noHover && hasTouch);

/**
 * Generates a SHA-256 hash of a file for content verification
 *
 * Creates a cryptographic hash of the file contents using the Web Crypto API.
 * The hash is returned as a hexadecimal string. This implementation matches
 * the server-side hash function to ensure consistent file identification across
 * client and server.
 *
 * Used for:
 * - Deduplicating uploaded files
 * - Verifying file integrity
 * - Content-addressable storage identification
 *
 * @param file - File or Blob to hash
 * @returns Promise resolving to a 64-character hexadecimal hash string
 *
 * @example
 * const file = new File(['content'], 'test.txt')
 * const hash = await hashFile(file) // => 'a1b2c3d4...'
 */
export async function hashFile(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash;
}
