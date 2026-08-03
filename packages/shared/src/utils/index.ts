/**
 * Utility functions
 * Helper functions organized by domain
 */

// Core utilities (flat)
export * from "./IdGenerator";
export * from "./RoleManager";
export * from "./Logger";
export * from "./SystemUtils";
export * from "./IdentifierUtils";
export * from "./PlayerIdMapper";
export * from "./ExternalAssetUtils";
export * from "./downloadFile";
export * from "./SeededRandom"; // rules-accurate deterministic RNG
export * from "./FrameBudgetManager"; // Frame time budget management for reducing jank

// Export ValidationUtils without calculateDistance* (they re-export from MathUtils)
export {
  isNumber,
  isBoolean,
  isString,
  isObject,
  isArray,
  isValidColor,
  isValidUrl,
  validatePosition,
} from "./ValidationUtils";

// Math utilities (flat) - canonical source for calculateDistance*
export * from "./MathUtils";
export * from "./NoiseGenerator";

// Organized subdirectories
export * from "./game"; // Combat, entity, component utils
export * from "./physics"; // Physics, movement, spawning
export * from "./rendering"; // Rendering, mesh, model cache, UI
export * from "./spatial"; // Spatial data structures for culling
export * from "./workers"; // Web worker utilities for parallel processing

// Distance utilities (classic MMORPG-style Chebyshev)
export * from "./distance";
