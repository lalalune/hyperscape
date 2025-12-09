/**
 * PhysXManager.ts - Centralized PhysX Physics Engine Lifecycle Management
 *
 * This singleton manager handles loading and initialization of the PhysX WASM module.
 * PhysX is a high-performance physics engine used for collision detection, raycasting,
 * and character controllers in both browser and Node.js environments.
 *
 * Key Features:
 * - Singleton pattern ensures PhysX is only loaded once globally
 * - Async loading with promise-based waiting for dependent systems
 * - Environment detection (browser vs Node.js) for appropriate loading strategy
 * - State tracking (NOT_LOADED, LOADING, LOADED, FAILED)
 * - Dependency notification system for systems that need PhysX
 *
 * Usage:
 * ```ts
 * // Load PhysX (idempotent - safe to call multiple times)
 * await loadPhysX();
 *
 * // Wait for PhysX in a system
 * await waitForPhysX('MySystem', 10000); // 10 second timeout
 *
 * // Get PhysX module once loaded
 * const PHYSX = getPhysX();
 * ```
 *
 * Environment-Specific Loading:
 * - Browser: Loads via script tag from CDN at /web/physx-js-webidl.js
 * - Node.js: Loads WASM binary from assets/web/ or fetches from CDN with caching
 *
 * Referenced by: Physics system, Node-based colliders, Character controllers
 */

import { EventEmitter } from "eventemitter3";
import type { PhysXInfo, PhysXModule } from "../types/systems/physics";
import THREE from "../extras/three/three";
import loadPhysXScript from "./physx-script-loader";

/**
 * PhysX Loading States
 *
 * Tracks the current state of PhysX module loading.
 */
export enum PhysXState {
  /** PhysX has not been requested yet */
  NOT_LOADED = "not_loaded",

  /** PhysX WASM is currently loading */
  LOADING = "loading",

  /** PhysX is loaded and ready to use */
  LOADED = "loaded",

  /** PhysX loading failed with an error */
  FAILED = "failed",
}

/**
 * PhysXManager Class (Singleton)
 *
 * Manages PhysX lifecycle and provides async waiting API for dependent systems.
 * Uses EventEmitter to notify waiting systems when PhysX becomes available.
 *
 * The manager handles the complexity of:
 * - Environment detection (browser vs Node.js)
 * - WASM loading and initialization
 * - Foundation/Physics/Scene object creation
 * - Preventing duplicate loads
 * - Coordinating multiple systems waiting for PhysX
 */
class PhysXManager extends EventEmitter {
  private static instance: PhysXManager;
  private state: PhysXState = PhysXState.NOT_LOADED;
  private loadPromise: Promise<PhysXInfo> | null = null;
  private physxInfo: PhysXInfo | null = null;
  private error: Error | null = null;

  /** Map of system names to cleanup functions for systems waiting on PhysX */
  private waitingDependencies = new Map<string, () => void>();

  /**
   * Private constructor for singleton pattern.
   * Use PhysXManager.getInstance() instead.
   */
  private constructor() {
    super();

    // Set up THREE global for Node.js environments
    // PhysX may need THREE for certain utilities
    if (typeof window === "undefined" && !("THREE" in globalThis)) {
      Object.defineProperty(globalThis, "THREE", {
        value: THREE,
        writable: true,
        configurable: true,
      });
    }
  }

  /**
   * Get singleton instance of PhysXManager.
   * Creates the instance on first call.
   *
   * @returns The global PhysXManager instance
   */
  static getInstance(): PhysXManager {
    if (!PhysXManager.instance) {
      PhysXManager.instance = new PhysXManager();
    }
    return PhysXManager.instance;
  }

  /** @returns Current loading state */
  getState(): PhysXState {
    return this.state;
  }

  /** @returns true if PhysX is loaded and ready to use */
  isReady(): boolean {
    return this.state === PhysXState.LOADED && this.physxInfo !== null;
  }

  /** @returns PhysX info object (foundation, physics, etc.) if loaded */
  getPhysXInfo(): PhysXInfo | null {
    return this.physxInfo;
  }

  /**
   * Get Global PhysX Module
   *
   * Accesses the global PHYSX object set by the loading process.
   * Returns null if PhysX hasn't been loaded yet.
   *
   * @returns PhysX module instance or null
   */
  getPhysX(): PhysXModule | null {
    const g = globalThis as { PHYSX?: PhysXModule };
    return g.PHYSX ?? null;
  }

  /**
   * Load PhysX (Idempotent)
   *
   * Initiates PhysX loading if not already loaded or in progress.
   * Safe to call multiple times - returns existing promise if already loading.
   *
   * Loading Process:
   * 1. Detect environment (browser vs Node.js)
   * 2. Load WASM module using appropriate strategy
   * 3. Initialize PhysX foundation and physics objects
   * 4. Set global PHYSX object
   * 5. Notify all waiting dependencies
   *
   * @returns Promise that resolves with PhysX foundation/physics objects
   * @throws Error if loading fails
   */
  async load(): Promise<PhysXInfo> {
    // If already loaded, return immediately
    if (this.state === PhysXState.LOADED && this.physxInfo) {
      return this.physxInfo;
    }

    // If currently loading, return the existing promise
    if (this.state === PhysXState.LOADING && this.loadPromise) {
      return this.loadPromise;
    }

    // If failed, retry
    if (this.state === PhysXState.FAILED) {
      this.state = PhysXState.NOT_LOADED;
      this.error = null;
    }

    // Start loading
    this.state = PhysXState.LOADING;
    this.emit("loading");

    this.loadPromise = this.loadPhysXInternal();

    const info = await this.loadPromise;
    this.physxInfo = info;
    this.state = PhysXState.LOADED;
    this.emit("loaded", info);

    // Notify all waiting dependencies
    this.notifyWaitingDependencies();

    return info;
  }

  /**
   * Wait for PhysX to be Ready
   *
   * Async method for systems to wait until PhysX is loaded.
   * Automatically triggers loading if not already in progress.
   *
   * @param systemName - Name of calling system (for debugging and tracking)
   * @param timeout - Optional timeout in milliseconds (throws on timeout)
   * @returns Promise that resolves when PhysX is loaded
   * @throws Error if PhysX loading failed or timeout reached
   */
  async waitForPhysX(systemName: string, timeout?: number): Promise<PhysXInfo> {
    // If already loaded, return immediately
    if (this.isReady()) {
      return this.physxInfo!; // Non-null assertion safe here because isReady() checks this.physxInfo !== null
    }

    // If failed, throw the error
    if (this.state === PhysXState.FAILED) {
      throw this.error || new Error("PhysX loading failed with unknown error");
    }

    // Create a promise that resolves when PhysX is ready
    const waitPromise = new Promise<PhysXInfo>((resolve, reject) => {
      const onLoaded = (info: PhysXInfo) => {
        this.off("loaded", onLoaded);
        this.off("failed", onFailed);
        resolve(info);
      };

      const onFailed = (error: Error) => {
        this.off("loaded", onLoaded);
        this.off("failed", onFailed);
        reject(error);
      };

      this.once("loaded", onLoaded);
      this.once("failed", onFailed);

      // Track waiting dependency
      this.waitingDependencies.set(systemName, () => {
        this.off("loaded", onLoaded);
        this.off("failed", onFailed);
      });
    });

    // If not loading, trigger load
    if (this.state === PhysXState.NOT_LOADED) {
      await this.load();
    }

    // Apply timeout if specified
    if (timeout) {
      return Promise.race([
        waitPromise,
        new Promise<PhysXInfo>((_, reject) =>
          setTimeout(
            () => reject(new Error(`PhysX load timeout for ${systemName}`)),
            timeout,
          ),
        ),
      ]);
    }

    return waitPromise;
  }

  /**
   * Register Callback for When PhysX is Ready
   *
   * Alternative to waitForPhysX() for callback-based code.
   * If PhysX is already loaded, callback is invoked immediately.
   *
   * @param systemName - Name of system registering callback
   * @param callback - Function to call when PhysX is ready
   */
  onReady(systemName: string, callback: (info: PhysXInfo) => void): void {
    if (this.isReady() && this.physxInfo) {
      // Already ready, call immediately
      callback(this.physxInfo);
    } else {
      // Wait for ready
      this.once("loaded", callback);
      this.waitingDependencies.set(systemName, () =>
        this.off("loaded", callback),
      );
    }
  }

  /**
   * Internal PhysX Loading Implementation
   *
   * Handles environment-specific loading logic:
   *
   * Browser Environment:
   * - Loads physx-js-webidl.js script tag from CDN
   * - Uses locateFile to find .wasm at CDN/web/physx-js-webidl.wasm
   *
   * Node.js/Server Environment:
   * - Dynamically imports PhysXManager.server.ts (to avoid bundling Node modules)
   * - First tries loading WASM from local assets/web/ directory
   * - Falls back to fetching from CDN and caching to temp directory
   * - Provides binary directly to PhysX via wasmBinary option
   *
   * After loading, creates:
   * - PxFoundation (memory allocator and error callback)
   * - PxPhysics (main physics simulation object)
   *
   * @returns PhysX foundation and physics objects
   * @throws Error if loading fails or times out (30 seconds)
   */
  private async loadPhysXInternal(): Promise<PhysXInfo> {
    const isServer =
      typeof process !== "undefined" &&
      process.versions &&
      process.versions.node;
    const isBrowser =
      !isServer &&
      typeof window !== "undefined" &&
      typeof window.document !== "undefined";
    const isTest =
      typeof process !== "undefined" &&
      (process.env.NODE_ENV === "test" || process.env.VITEST);

    // Add a timeout to detect if WASM loading is stuck
    const timeoutId = setTimeout(() => {
      throw new Error("PhysX WASM loading timeout after 30 seconds");
    }, 30000);

    // Configure WASM loading
    const moduleOptions: Record<string, unknown> = {
      onAbort: (what: unknown) => {
        const errorText = String(what);
        const isNodeEnvError = errorText.includes(
          "node environment detected but not enabled at build time",
        );
        if (isNodeEnvError) {
          throw new Error(
            `PhysX WASM requires Node.js-compatible build. Current build only supports browser environments. ${errorText}`,
          );
        }
        throw new Error(`PhysX WASM aborted: ${errorText}`);
      },
    };

    // In Node.js environments, we need to handle WASM loading differently
    if (isServer || isTest) {
      // Dynamically import server-specific loading utilities
      // This keeps Node.js modules out of the client bundle
      // Use dynamic path construction to prevent bundler from trying to resolve this

      const importPath = new Function('return "./PhysXManager.server"')();
      const serverModule = await import(/* @vite-ignore */ importPath);
      const wasmBuffer = await serverModule.loadPhysXWasmForNode();

      // Provide the WASM module directly
      moduleOptions.wasmBinary = wasmBuffer;
    } else if (isBrowser) {
      // For browser, always use absolute CDN URL (no Vite proxy)
      moduleOptions.locateFile = (wasmFileName: string) => {
        if (wasmFileName.endsWith(".wasm")) {
          // Use window.__CDN_URL if set by the application
          const windowWithCdn = window as Window & { __CDN_URL?: string };
          const cdnBaseUrl = windowWithCdn.__CDN_URL || "http://localhost:8088";
          const url = `${cdnBaseUrl}/web/${wasmFileName}`;
          return url;
        }
        return wasmFileName;
      };
    }

    // Use appropriate loader based on environment (use isBrowser defined at the top of function)
    let PHYSX: PhysXModule;

    if (isBrowser) {
      // Browser environment - use script loader
      PHYSX = await loadPhysXScript(moduleOptions);
    } else {
      // Node.js/server environment - use dynamic import for ESM compatibility
      const physxModule = await import("@hyperscape/physx-js-webidl");
      const PhysXLoader = physxModule.default || physxModule;

      // Strong type assumption - PhysXLoader is a function that returns PhysXModule
      PHYSX = await (
        PhysXLoader as (
          options: Record<string, unknown>,
        ) => Promise<PhysXModule>
      )(moduleOptions);
    }

    // Set global PHYSX for compatibility
    Object.defineProperty(globalThis, "PHYSX", {
      value: PHYSX,
      writable: true,
      configurable: true,
    });

    clearTimeout(timeoutId);

    // Create PhysX foundation objects - PHYSX already has the correct type
    const physxWithConstants = PHYSX as PhysXModule & {
      PHYSICS_VERSION: number;
      CreateFoundation: (
        version: number,
        allocator: InstanceType<PhysXModule["PxDefaultAllocator"]>,
        errorCb: InstanceType<PhysXModule["PxDefaultErrorCallback"]>,
      ) => InstanceType<PhysXModule["PxFoundation"]>;
      CreatePhysics: (
        version: number,
        foundation: InstanceType<PhysXModule["PxFoundation"]>,
        tolerances: InstanceType<PhysXModule["PxTolerancesScale"]>,
      ) => InstanceType<PhysXModule["PxPhysics"]>;
    };

    const version = physxWithConstants.PHYSICS_VERSION;
    const allocator = new PHYSX.PxDefaultAllocator();
    const errorCb = new PHYSX.PxDefaultErrorCallback();
    const foundation = physxWithConstants.CreateFoundation(
      version,
      allocator,
      errorCb,
    );

    // Create physics instance for general use
    const tolerances = new PHYSX.PxTolerancesScale();
    const physics = physxWithConstants.CreatePhysics(
      version,
      foundation,
      tolerances,
    );

    return { version, allocator, errorCb, foundation, physics };
  }

  /**
   * Notify Waiting Dependencies
   *
   * Called after PhysX is loaded to clean up waiting system registrations.
   */
  private notifyWaitingDependencies(): void {
    this.waitingDependencies.clear();
  }

  /**
   * Reset Manager State
   *
   * Resets the manager to NOT_LOADED state.
   * Primarily used for testing to clean up between test runs.
   */
  reset(): void {
    this.state = PhysXState.NOT_LOADED;
    this.loadPromise = null;
    this.physxInfo = null;
    this.error = null;
    this.waitingDependencies.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// ============================================================================

/** Global singleton instance of PhysXManager */
export const physxManager = PhysXManager.getInstance();

/**
 * Load PhysX (Convenience Function)
 *
 * Delegates to singleton instance.
 * Idempotent - safe to call multiple times.
 *
 * @returns Promise that resolves when PhysX is loaded
 */
export async function loadPhysX(): Promise<PhysXInfo> {
  return physxManager.load();
}

/**
 * Wait for PhysX to be Ready (Convenience Function)
 *
 * Delegates to singleton instance.
 *
 * @param systemName - Name of calling system
 * @param timeout - Optional timeout in milliseconds
 * @returns Promise that resolves when PhysX is ready
 */
export async function waitForPhysX(
  systemName: string,
  timeout?: number,
): Promise<PhysXInfo> {
  return physxManager.waitForPhysX(systemName, timeout);
}

/**
 * Get PhysX Module (Convenience Function)
 *
 * @returns Global PhysX module or null if not loaded
 */
export function getPhysX(): PhysXModule | null {
  return physxManager.getPhysX();
}

/**
 * Check if PhysX is Ready (Convenience Function)
 *
 * @returns true if PhysX is loaded and ready to use
 */
export function isPhysXReady(): boolean {
  return physxManager.isReady();
}
