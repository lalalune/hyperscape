/**
 * PhysXManager - Centralized PhysX lifecycle management
 * 
 * This manager ensures PhysX is loaded once and provides a clean
 * API for systems to wait for and access PhysX functionality.
 */

import { EventEmitter } from 'eventemitter3'
import type { PhysXInfo, PhysXModule } from './types/physics'
import THREE from './extras/three'
import loadPhysXScript from './physx-script-loader'

export enum PhysXState {
  NOT_LOADED = 'not_loaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  FAILED = 'failed'
}

class PhysXManager extends EventEmitter {
  private static instance: PhysXManager
  private state: PhysXState = PhysXState.NOT_LOADED
  private loadPromise: Promise<PhysXInfo> | null = null
  private physxInfo: PhysXInfo | null = null
  private error: Error | null = null
  
  // Dependency tracking
  private waitingDependencies = new Map<string, () => void>()

  private constructor() {
    super()
    
    // Set up THREE global if needed
    if (typeof window === 'undefined' && !('THREE' in globalThis)) {
      Object.defineProperty(globalThis, 'THREE', { value: THREE, writable: true, configurable: true });
    }
  }

  static getInstance(): PhysXManager {
    if (!PhysXManager.instance) {
      PhysXManager.instance = new PhysXManager()
    }
    return PhysXManager.instance
  }

  /**
   * Get current PhysX state
   */
  getState(): PhysXState {
    return this.state
  }

  /**
   * Check if PhysX is ready for use
   */
  isReady(): boolean {
    return this.state === PhysXState.LOADED && this.physxInfo !== null
  }

  /**
   * Get PhysX info if loaded, null otherwise
   */
  getPhysXInfo(): PhysXInfo | null {
    return this.physxInfo
  }

  /**
   * Get the global PHYSX object if available
   */
  getPhysX(): PhysXModule | null {
    // Strong type assumption - if PHYSX exists in globalThis, it's the PhysXModule
    const g = globalThis as { PHYSX?: PhysXModule }
    return g.PHYSX ?? null
  }

  /**
   * Load PhysX - idempotent, can be called multiple times safely
   */
  async load(): Promise<PhysXInfo> {
    // If already loaded, return immediately
    if (this.state === PhysXState.LOADED && this.physxInfo) {
      return this.physxInfo
    }

    // If currently loading, return the existing promise
    if (this.state === PhysXState.LOADING && this.loadPromise) {
      return this.loadPromise
    }

    // If failed, retry
    if (this.state === PhysXState.FAILED) {
      this.state = PhysXState.NOT_LOADED
      this.error = null
    }

    // Start loading
    this.state = PhysXState.LOADING
    this.emit('loading')

    this.loadPromise = this.loadPhysXInternal()
    
    try {
      const info = await this.loadPromise
      this.physxInfo = info
      this.state = PhysXState.LOADED
      this.emit('loaded', info)
      
      // Notify all waiting dependencies
      this.notifyWaitingDependencies()
      
      return info
    } catch (error) {
      console.error('[PhysXManager] Load promise caught error:', error) // Added for debugging
      this.state = PhysXState.FAILED
      this.error = error as Error
      this.emit('failed', error)
      throw error
    }
  }

  /**
   * Wait for PhysX to be ready
   * @param systemName - Name of the system waiting (for debugging)
   * @param timeout - Optional timeout in milliseconds
   */
  async waitForPhysX(systemName: string, timeout?: number): Promise<PhysXInfo> {
    // If already loaded, return immediately
    if (this.isReady()) {
      return this.physxInfo!  // Non-null assertion safe here because isReady() checks this.physxInfo !== null
    }

    // If failed, throw the error
    if (this.state === PhysXState.FAILED) {
      throw this.error || new Error('PhysX loading failed with unknown error')
    }

    // Create a promise that resolves when PhysX is ready
    const waitPromise = new Promise<PhysXInfo>((resolve, reject) => {
      const onLoaded = (info: PhysXInfo) => {
        this.off('loaded', onLoaded)
        this.off('failed', onFailed)
        resolve(info)
      }

      const onFailed = (error: Error) => {
        this.off('loaded', onLoaded)
        this.off('failed', onFailed)
        reject(error)
      }

      this.once('loaded', onLoaded)
      this.once('failed', onFailed)

      // Track waiting dependency
      this.waitingDependencies.set(systemName, () => {
        this.off('loaded', onLoaded)
        this.off('failed', onFailed)
      })
    })

    // If not loading, trigger load
    if (this.state === PhysXState.NOT_LOADED) {
      this.load().catch(() => {}) // Error will be handled by waitPromise
    }

    // Apply timeout if specified
    if (timeout) {
      return Promise.race([
        waitPromise,
        new Promise<PhysXInfo>((_, reject) => 
          setTimeout(() => reject(new Error(`PhysX load timeout for ${systemName}`)), timeout)
        )
      ])
    }

    return waitPromise
  }

  /**
   * Register a system that depends on PhysX
   * The callback will be called when PhysX is ready
   */
  onReady(systemName: string, callback: (info: PhysXInfo) => void): void {
    if (this.isReady() && this.physxInfo) {
      // Already ready, call immediately
      callback(this.physxInfo)
    } else {
      // Wait for ready
      this.once('loaded', callback)
      this.waitingDependencies.set(systemName, () => this.off('loaded', callback))
    }
  }

  /**
   * Internal PhysX loading logic
   */
  private async loadPhysXInternal(): Promise<PhysXInfo> {
    const isServer = typeof process !== 'undefined' && process.versions && process.versions.node
    const isBrowser = !isServer && typeof window !== 'undefined' && typeof window.document !== 'undefined'
    const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)

    // Add a timeout to detect if WASM loading is stuck
    const timeoutId = setTimeout(() => {
      throw new Error('PhysX WASM loading timeout after 30 seconds')
    }, 30000)

    try {
      
      // Configure WASM loading
      const moduleOptions: Record<string, unknown> = {
        onAbort: (what: unknown) => {
          const errorText = String(what)
          const isNodeEnvError = errorText.includes('node environment detected but not enabled at build time')
          if (isNodeEnvError) {
            throw new Error(`PhysX WASM requires Node.js-compatible build. Current build only supports browser environments. ${errorText}`)
          }
          throw new Error(`PhysX WASM aborted: ${errorText}`)
        }
      }
      
      // In Node.js environments, we need to handle WASM loading differently
      if (isServer || isTest) {        
        // Pre-load the WASM file for Node.js environments
        try {
          // Dynamically import Node.js modules to avoid bundling issues
          const { readFileSync, existsSync } = await import('node:fs')
          const { fileURLToPath } = await import('node:url')
          const { dirname, join } = await import('node:path')
          
          // Try multiple locations for the WASM file
          const possiblePaths = [
            // First try relative to the current module
            join(dirname(fileURLToPath(import.meta.url)), '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),
            join(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),

            // Try workspace root
            join(dirname(fileURLToPath(import.meta.url)), '../../../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),
            join(dirname(fileURLToPath(import.meta.url)), '../../../../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),

            // Try relative to process.cwd()
            join(process.cwd(), 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm'),
            // Try the build directory (where WASM might be copied)
            join(dirname(fileURLToPath(import.meta.url)), '../public/physx-js-webidl.wasm'),
            // Try build/public directory
            join(process.cwd(), 'packages/hyperscape/build/public/physx-js-webidl.wasm'),
            // Try server public directory  
            join(process.cwd(), 'packages/hyperscape/src/server/public/physx-js-webidl.wasm')
          ]
          
          let wasmPath: string | null = null
          for (const path of possiblePaths) {
            if (existsSync(path)) {
              wasmPath = path
              break
            }
          }
          
          if (wasmPath) {
            console.log('[PhysXManager] Reading WASM file from:', wasmPath)
            const wasmBuffer = readFileSync(wasmPath)
            
            // Provide the WASM module directly
            moduleOptions.wasmBinary = wasmBuffer
            console.log('[PhysXManager] WASM buffer loaded, size:', wasmBuffer.length)
          } else {
            console.error('[PhysXManager] WASM file not found in any of the expected locations')
            console.error('[PhysXManager] Searched paths:', possiblePaths)
            
            // As a fallback, provide a locateFile function that returns a file URL
            moduleOptions.locateFile = (wasmFileName: string) => {
              if (wasmFileName.endsWith('.wasm')) {
                // Try to construct a file URL
                const fallbackPath = join(process.cwd(), 'node_modules/@hyperscape/physx-js-webidl/dist', wasmFileName)
                const fileUrl = new URL(`file://${fallbackPath}`).href
                console.log('[PhysXManager] Fallback WASM URL:', fileUrl)
                return fileUrl
              }
              return wasmFileName
            }
          }
        } catch (e) {
          console.error('[PhysXManager] Failed to load WASM file:', e)
        }
      } else if (isBrowser) {
        // For browser, use the normal locateFile approach
        moduleOptions.locateFile = (wasmFileName: string) => {
          if (wasmFileName.endsWith('.wasm')) {
            const url = `${window.location.origin}/${wasmFileName}`
            console.log('[PhysXManager] Browser WASM URL:', url)
            return url
          }
          return wasmFileName
        }
      }
      
      // Use appropriate loader based on environment (use isBrowser defined at the top of function)
      let PHYSX: PhysXModule
      
      if (isBrowser) {
        // Browser environment - use script loader
        console.log('[PhysXManager] Browser environment detected, loading PhysX via script...')
        PHYSX = await loadPhysXScript(moduleOptions)
      } else {
        // Node.js/server environment - use dynamic import for ESM compatibility
        console.log('[PhysXManager] Node.js/server environment detected, loading PhysX module...')
        try {
          // Use dynamic import for ESM compatibility
          const physxModule = await import('@hyperscape/physx-js-webidl')
          const PhysXLoader = physxModule.default || physxModule
          
          // Strong type assumption - PhysXLoader is a function that returns PhysXModule
          PHYSX = await (PhysXLoader as (options: Record<string, unknown>) => Promise<PhysXModule>)(moduleOptions)
        } catch (e) {
          console.error('[PhysXManager] Failed to load PhysX module:', e)
          throw new Error(`Failed to load PhysX in Node.js environment: ${e}`)
        }
      }
      
      // Set global PHYSX for compatibility
      Object.defineProperty(globalThis, 'PHYSX', { value: PHYSX, writable: true, configurable: true });
      
      clearTimeout(timeoutId)
      console.log('[PhysXManager] PhysX module loaded successfully')


      // Create PhysX foundation objects - PHYSX already has the correct type
      const physxWithConstants = PHYSX as PhysXModule & {
        PHYSICS_VERSION: number;
        CreateFoundation: (version: number, allocator: InstanceType<PhysXModule['PxDefaultAllocator']>, errorCb: InstanceType<PhysXModule['PxDefaultErrorCallback']>) => InstanceType<PhysXModule['PxFoundation']>;
        CreatePhysics: (version: number, foundation: InstanceType<PhysXModule['PxFoundation']>, tolerances: InstanceType<PhysXModule['PxTolerancesScale']>) => InstanceType<PhysXModule['PxPhysics']>;
      };
      
      const version = physxWithConstants.PHYSICS_VERSION
      const allocator = new PHYSX.PxDefaultAllocator()
      const errorCb = new PHYSX.PxDefaultErrorCallback()
      const foundation = physxWithConstants.CreateFoundation(version, allocator, errorCb)
      
      console.log('[PhysXManager] Created PxFoundation')
      
      // Create physics instance for general use
      const tolerances = new PHYSX.PxTolerancesScale()
      const physics = physxWithConstants.CreatePhysics(version, foundation, tolerances)
      
      console.log('[PhysXManager] Created PxPhysics')


      return { version, allocator, errorCb, foundation, physics }
    } catch (error) {
      console.error('[PhysXManager] Failed to load PhysX:', error)
      clearTimeout(timeoutId)
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Notify all waiting dependencies that PhysX is ready
   */
  private notifyWaitingDependencies(): void {
    console.log(`[PhysXManager] Notifying ${this.waitingDependencies.size} waiting dependencies`)
    this.waitingDependencies.clear()
  }

  /**
   * Reset the manager (mainly for testing)
   */
  reset(): void {
    this.state = PhysXState.NOT_LOADED
    this.loadPromise = null
    this.physxInfo = null
    this.error = null
    this.waitingDependencies.clear()
    this.removeAllListeners()
  }
}

// Export singleton instance
export const physxManager = PhysXManager.getInstance()

// Export convenience functions
export async function loadPhysX(): Promise<PhysXInfo> {
  return physxManager.load()
}

export async function waitForPhysX(systemName: string, timeout?: number): Promise<PhysXInfo> {
  return physxManager.waitForPhysX(systemName, timeout)
}

export function getPhysX(): PhysXModule | null {
  return physxManager.getPhysX()
}

export function isPhysXReady(): boolean {
  return physxManager.isReady()
}