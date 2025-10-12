/**
 * Client-side utilities
 */

/**
 * Detect if the device primarily uses touch input
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

