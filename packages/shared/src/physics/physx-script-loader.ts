/**
 * Direct script loader for PhysX
 * This loads PhysX by directly injecting the script tag
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
  // Add cache-busting parameter to force browser to reload correct version
  const cacheBust = Date.now();
  const scriptUrl = `${cdnUrl}/web/physx-js-webidl.js?v=${cacheBust}`;

  try {
    // PhysX is built as an ES6 module (EXPORT_ES6=1, MODULARIZE=1)
    // We must use dynamic import() to load it, not a script tag
    // The @vite-ignore comment tells Vite not to try to bundle this
    const physxModule = await import(/* @vite-ignore */ scriptUrl);

    // Extract the PhysX factory function from the module
    // It's exported as default, but may also be available as named export
    const PhysXFn = physxModule.default || physxModule.PhysX || physxModule;

    if (typeof PhysXFn !== "function") {
      throw new Error(
        `PhysX export is not a function. Got: ${typeof PhysXFn}. Module keys: ${Object.keys(physxModule).join(", ")}`,
      );
    }

    // Store on window for future use
    if (!w.PhysX) {
      (window as any).PhysX = PhysXFn;
    }

    // Initialize PhysX with the provided options
    const physx = await PhysXFn(options);

    return physx;
  } catch (error) {
    console.error("[physx-script-loader] Failed to load PhysX module:", error);

    // If dynamic import fails, provide helpful error message
    if (
      error instanceof TypeError &&
      error.message.includes("Failed to fetch")
    ) {
      throw new Error(
        `Failed to load PhysX from ${scriptUrl}. ` +
          `Make sure the CDN is running and the file is accessible. ` +
          `CORS headers may need to be configured.`,
      );
    }

    throw error;
  }
}

export default loadPhysXScript;
