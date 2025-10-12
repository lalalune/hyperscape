export function cls(...args) {
  let str = ''
  for (const arg of args) {
    if (typeof arg === 'string') {
      str += ' ' + arg
    } else if (typeof arg === 'object') {
      for (const key in arg) {
        const value = arg[key]
        if (value) str += ' ' + key
      }
    }
  }
  return str
}

// export const isTouch = !!navigator.userAgent.match(/OculusBrowser|iPhone|iPad|iPod|Android/i)

// if at least two indicators point to touch, consider it primarily touch-based:
const coarse = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
const noHover = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(hover: none)').matches : false;
const hasTouch = typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints > 0 : false;
export const isTouch = (coarse && hasTouch) || (noHover && hasTouch);

/**
 *
 * Hash File
 *
 * takes a file and generates a sha256 unique hash.
 * carefully does this the same way as the server function.
 *
 */
export async function hashFile(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')
  return hash
}
