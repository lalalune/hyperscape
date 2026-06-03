/**
 * Direct script loader for PhysX
 * This loads PhysX by directly injecting the script tag
 *
 * Features:
 * - Automatic retry with exponential backoff on failure
 * - Proper CDN URL resolution with fallbacks
 * - WASM instantiation timeout handling
 * - Robust error recovery
 */

import type PhysX from "@hyperforge/physx-js-webidl";
import type { PhysXModule } from "../types/systems/physics";

type PhysXInitOptions = Parameters<typeof PhysX>[0];
interface PhysXWindow extends Window {
  PhysX?: typeof PhysX;
  __CDN_URL?: string;
  Module?: Record<string, unknown>;
}

/** Configuration for retry behavior */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/** Timeout for WASM instantiation after script loads */
const WASM_INIT_TIMEOUT_MS = 60000; // 60 seconds for WASM init

/**
 * Resolve candidate CDN roots for PhysX assets.
 *
 * PhysX files are served under /web/, while game assets are often configured
 * under /game-assets/. In local client-only runs we therefore try both roots.
 */
function resolveCdnUrls(): string[] {
  const w = window as PhysXWindow;
  const candidates: string[] = [];

  const pushCandidate = (value?: string): void => {
    if (!value) return;
    const normalized = value.replace(/\/$/, "");
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  pushCandidate(w.__CDN_URL);

  // If CDN is configured as ".../game-assets", PhysX may still live at ".../web".
  if (w.__CDN_URL?.endsWith("/game-assets")) {
    pushCandidate(w.__CDN_URL.slice(0, -"/game-assets".length));
  }

  pushCandidate(window.location.origin);

  return candidates.length > 0 ? candidates : [window.location.origin];
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for exponential backoff
 */
function getRetryDelay(attempt: number): number {
  const delay =
    RETRY_CONFIG.initialDelayMs *
    Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Load PhysX script and initialize WASM with timeout
 */
async function loadAndInitPhysX(
  cdnUrl: string,
  options?: PhysXInitOptions,
): Promise<PhysXModule> {
  const w = window as PhysXWindow;

  // Check if PhysX is already loaded
  if (w.PhysX) {
    console.log("[physx-script-loader] PhysX already loaded, reusing...");
    return initPhysXModule(w.PhysX, cdnUrl, options);
  }

  return new Promise((resolve, reject) => {
    // Set up Module configuration BEFORE loading the script
    // This ensures locateFile is available when Emscripten looks for the WASM
    if (!w.Module) {
      w.Module = {};
    }

    // Configure locateFile for the Module global
    w.Module.locateFile = (wasmFileName: string) => {
      if (wasmFileName.endsWith(".wasm")) {
        const url = `${cdnUrl}/web/${wasmFileName}?v=1.0.0`;
        console.log(
          `[physx-script-loader] Module.locateFile: ${wasmFileName} -> ${url}`,
        );
        return url;
      }
      return wasmFileName;
    };

    // Check if script is already in the DOM but PhysX not initialized yet
    const existingScript = document.querySelector(
      'script[src*="physx-js-webidl.js"]',
    );
    if (existingScript) {
      console.log(
        "[physx-script-loader] Script already in DOM, waiting for PhysX global...",
      );
      waitForPhysXGlobal(cdnUrl, options).then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    const scriptUrl = `${cdnUrl}/web/physx-js-webidl.js?v=1.0.0`;

    console.log("[physx-script-loader] Loading PhysX from:", scriptUrl);
    console.log("[physx-script-loader] CDN URL:", cdnUrl);

    script.src = scriptUrl;
    script.async = true;

    script.onload = () => {
      console.log("[physx-script-loader] Script loaded successfully");
      waitForPhysXGlobal(cdnUrl, options).then(resolve).catch(reject);
    };

    script.onerror = (error) => {
      console.error(
        "[physx-script-loader] Failed to load PhysX script:",
        error,
      );
      // Remove failed script from DOM to allow retry
      script.remove();
      reject(new Error(`Failed to load PhysX script from ${scriptUrl}`));
    };

    document.head.appendChild(script);
  });
}

/**
 * Wait for PhysX global to become available after script load
 */
async function waitForPhysXGlobal(
  cdnUrl: string,
  options?: PhysXInitOptions,
): Promise<PhysXModule> {
  const w = window as PhysXWindow;
  const maxWaitTime = 5000; // 5 seconds for the global to appear
  const checkInterval = 100;
  let waited = 0;

  while (!w.PhysX && waited < maxWaitTime) {
    await sleep(checkInterval);
    waited += checkInterval;
  }

  if (!w.PhysX) {
    throw new Error(
      `PhysX global not found after ${maxWaitTime}ms - script may have failed to execute`,
    );
  }

  console.log("[physx-script-loader] PhysX global found, initializing WASM...");
  return initPhysXModule(w.PhysX, cdnUrl, options);
}

/**
 * Initialize PhysX module with WASM
 * Includes timeout handling for stuck WASM instantiation
 */
async function initPhysXModule(
  PhysXFn: typeof PhysX,
  cdnUrl: string,
  options?: PhysXInitOptions,
): Promise<PhysXModule> {
  // Merge our locateFile with any options passed in
  const mergedOptions = {
    ...options,
    locateFile: (file: string) => {
      if (file.endsWith(".wasm")) {
        const url = `${cdnUrl}/web/${file}?v=1.0.0`;
        console.log(`[physx-script-loader] locateFile: ${file} -> ${url}`);
        return url;
      }
      return file;
    },
  };

  // Create WASM initialization with timeout
  const initPromise = PhysXFn(mergedOptions);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `PhysX WASM instantiation timeout after ${WASM_INIT_TIMEOUT_MS / 1000} seconds`,
        ),
      );
    }, WASM_INIT_TIMEOUT_MS);
  });

  try {
    const physx = await Promise.race([initPromise, timeoutPromise]);
    console.log("[physx-script-loader] PhysX WASM initialized successfully");
    return physx;
  } catch (error) {
    console.error(
      "[physx-script-loader] PhysX WASM initialization failed:",
      error,
    );
    throw error;
  }
}

/**
 * Load PhysX script with automatic retry on failure
 *
 * @param options - PhysX initialization options
 * @returns Promise that resolves with the initialized PhysX module
 */
export async function loadPhysXScript(
  options?: PhysXInitOptions,
): Promise<PhysXModule> {
  const w = window as PhysXWindow;

  // Check if PhysX is already fully loaded and initialized
  if (w.PhysX) {
    for (const cdnUrl of resolveCdnUrls()) {
      try {
        return await initPhysXModule(w.PhysX, cdnUrl, options);
      } catch (error) {
        console.warn(
          `[physx-script-loader] Existing PhysX failed to initialize with ${cdnUrl}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    console.warn(
      "[physx-script-loader] Existing PhysX failed to initialize, will retry fresh load",
    );
    // Clear the failed PhysX to allow fresh load
    delete w.PhysX;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelay(attempt - 1);
      console.log(
        `[physx-script-loader] Retry ${attempt}/${RETRY_CONFIG.maxRetries} after ${delay}ms delay...`,
      );
      await sleep(delay);
    }

    const cdnUrls = resolveCdnUrls();
    console.log(
      `[physx-script-loader] Loading attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1} (candidates: ${cdnUrls.join(", ")})`,
    );

    for (const cdnUrl of cdnUrls) {
      try {
        return await loadAndInitPhysX(cdnUrl, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[physx-script-loader] Attempt ${attempt + 1} failed for ${cdnUrl}:`,
          lastError.message,
        );

        // Clear any partial state to allow clean retry/fallback candidate
        delete w.PhysX;
        const existingScript = document.querySelector(
          'script[src*="physx-js-webidl.js"]',
        );
        if (existingScript) {
          existingScript.remove();
        }
      }
    }
  }

  throw new Error(
    `Failed to load PhysX after ${RETRY_CONFIG.maxRetries + 1} attempts. Last error: ${lastError?.message}`,
  );
}

export default loadPhysXScript;
