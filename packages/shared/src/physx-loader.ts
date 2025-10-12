/**
 * Wrapper for loading PhysX module
 * This handles the CommonJS/ESM compatibility issues
 */

import type PhysX from '@hyperscape/physx-js-webidl'
import type { PhysXModule } from './types/physics'

type PhysXInitOptions = Parameters<typeof PhysX>[0]

// Loader function reference (set once via require() or dynamic import fallback)
let PhysXLoader: ((options?: PhysXInitOptions) => Promise<PhysXModule>) | undefined

// Try different import methods
{
  const nodeRequire = (globalThis as { require?: (id: string) => unknown }).require
  if (!PhysXLoader && nodeRequire) {
      // Try CommonJS require
      const physxModule = nodeRequire('@hyperscape/physx-js-webidl') as
        | typeof PhysX
        | { default: typeof PhysX }
      const candidate = (physxModule as { default?: typeof PhysX }).default ||
        (physxModule as typeof PhysX)
      PhysXLoader = candidate as (options?: PhysXInitOptions) => Promise<PhysXModule>
  }
}

// If require didn't work, use dynamic import as fallback
if (!PhysXLoader) {
  // Use a function that returns a promise for the loader
  PhysXLoader = async (options?: PhysXInitOptions): Promise<PhysXModule> => {
    const physxModule = await import('@hyperscape/physx-js-webidl')

    // The actual loader might be nested
    const candidate = (physxModule as { default?: unknown }).default ?? (physxModule as unknown)
    
    // Strong type assumption - candidate is the loader function
    return (candidate as (options?: PhysXInitOptions) => Promise<PhysXModule>)(options)
  }
}

export default PhysXLoader
export { PhysXLoader }
