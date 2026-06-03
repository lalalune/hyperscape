/**
 * Client Utility Functions
 *
 * This module provides core utility functions for the Hyperia client application:
 * - Device detection for touch vs. pointer interfaces (isTouch)
 * - File hashing for content verification and deduplication (hashFile)
 *
 * Note: For className composition, use `cls` from `./classnames.ts` instead.
 *
 * These utilities are used throughout the client package by React components,
 * file upload handlers, and responsive UI logic.
 */

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

/**
 * TypeScript exhaustiveness check helper
 *
 * Use in switch statements on discriminated unions to ensure all cases are handled.
 * TypeScript will report a compile-time error if any case is missing.
 *
 * @param value - The value that should be of type `never` if all cases are handled
 * @param message - Optional custom error message
 * @throws Error if called at runtime (indicates unhandled case)
 *
 * @example
 * ```typescript
 * type Status = 'pending' | 'approved' | 'rejected';
 *
 * function handleStatus(status: Status): string {
 *   switch (status) {
 *     case 'pending':
 *       return 'Waiting...';
 *     case 'approved':
 *       return 'Success!';
 *     case 'rejected':
 *       return 'Failed';
 *     default:
 *       return assertNever(status); // TypeScript error if case is missing
 *   }
 * }
 * ```
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(
    message ?? `Unexpected value in exhaustive check: ${JSON.stringify(value)}`,
  );
}
