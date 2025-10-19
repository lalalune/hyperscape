/**
 * Direct script loader for PhysX
 * This loads PhysX by directly injecting the script tag
 */

import type PhysX from '@hyperscape/physx-js-webidl'
import type { PhysXModule } from './types/physics'

type PhysXInitOptions = Parameters<typeof PhysX>[0]
interface PhysXWindow extends Window {
  PhysX?: typeof PhysX
}

export async function loadPhysXScript(options?: PhysXInitOptions): Promise<PhysXModule> {
  // Check if PhysX is already loaded
  const w = window as PhysXWindow
  if (w.PhysX) {
    return w.PhysX!(options)
  }

  return new Promise((resolve, reject) => {
    // Check again in case it was loaded while we were waiting
        if (w.PhysX) {
      w.PhysX!(options).then(resolve).catch(reject)
      return
    }

    const script = document.createElement('script')
    // Load from CDN (always absolute URL to avoid Vite conflicts)
    const windowWithCdn = window as Window & { __CDN_URL?: string }
    const cdnUrl = windowWithCdn.__CDN_URL || 'http://localhost:8088'
    const scriptUrl = `${cdnUrl}/web/physx-js-webidl.js`
    
    script.src = scriptUrl
    script.async = true
    
    script.onload = () => {      
      // Give it a moment to initialize
      setTimeout(() => {
        const w2 = window as PhysXWindow
        if (w2.PhysX) {
          const PhysXFn = w2.PhysX!
          PhysXFn(options).then((physx) => {
            resolve(physx)
          }).catch((error) => {
            console.error('[physx-script-loader] PhysX initialization failed:', error)
            reject(error)
          })
        } else {
          console.error('[physx-script-loader] PhysX function not found after script load')
          reject(new Error('PhysX global function not found after script load'))
        }
      }, 100)
    }
    
    script.onerror = (error) => {
      console.error('[physx-script-loader] Failed to load PhysX script:', error)
      reject(new Error('Failed to load PhysX script'))
    }
    
    document.head.appendChild(script)
  })
}

export default loadPhysXScript
