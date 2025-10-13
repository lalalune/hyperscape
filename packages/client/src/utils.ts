export function cls(...args: (string | Record<string, unknown>)[]) {
  let str = ''
  for (const arg of args) {
    // Check if arg has string methods
    if ((arg as string).charAt) {
      str += ' ' + (arg as string)
    } else {
      // Must be an object - strong type assumption
      const obj = arg as Record<string, unknown>
      for (const key in obj) {
        const value = obj[key]
        if (value) str += ' ' + key
      }
    }
  }
  return str
}

// export const isTouch = !!navigator.userAgent.match(/OculusBrowser|iPhone|iPad|iPod|Android/i)

// if at least two indicators point to touch, consider it primarily touch-based:
const coarse = window.matchMedia('(pointer: coarse)').matches;
const noHover = window.matchMedia('(hover: none)').matches;
const hasTouch = navigator.maxTouchPoints > 0;
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
