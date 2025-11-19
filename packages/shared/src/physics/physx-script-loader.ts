/**
 * PhysX ES Module Loader
 *
 * Loads PhysX using dynamic import() since the PhysX build is an ES module.
 * ES modules cannot be loaded via regular script tags - they must use import()
 * or script tags with type="module". This loader uses dynamic import() and
 * attaches the PhysX function to window.PhysX for compatibility.
 */
import type PhysX from "@hyperscape/physx-js-webidl";
import type { PhysXModule } from "../types/systems/physics";

type PhysXInitOptions = Parameters<typeof PhysX>[0];
interface PhysXWindow extends Window {
  PhysX?: typeof PhysX;
}

export async function loadPhysXScript(
  options?: PhysXInitOptions,
): Promise<PhysXModule> {
  // Check if PhysX is already loaded
  const w = window as PhysXWindow;
  if (w.PhysX) {
    return w.PhysX!(options);
  }

  // Get CDN URL
  const windowWithCdn = window as Window & { __CDN_URL?: string };
  const cdnUrl = windowWithCdn.__CDN_URL || "http://localhost:8080";
  const scriptUrl = `${cdnUrl}/web/physx-js-webidl.js`;

  try {
    // Use dynamic import for ES modules
    // The PhysX build is an ES module, so we need to use import() instead of script tags
    const physxModule = await import(/* @vite-ignore */ scriptUrl);
    const PhysXFn = physxModule.default || physxModule;

    if (typeof PhysXFn !== "function") {
      throw new Error(
        "PhysX module did not export a function. Got: " + typeof PhysXFn,
      );
    }

    // Attach to window for future lookups
    if (!w.PhysX) {
      w.PhysX = PhysXFn as typeof PhysX;
    }

    // Initialize PhysX with options
    const physx = await PhysXFn(options);
    return physx;
  } catch (error) {
    console.error(
      "[physx-script-loader] Failed to load PhysX via dynamic import:",
      error,
    );
    // Re-throw with more context
    throw new Error(
      `Failed to load PhysX module from ${scriptUrl}. ` +
        `The PhysX build must be an ES module. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export default loadPhysXScript;
