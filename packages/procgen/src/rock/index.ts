/**
 * @hyperforge/procgen/rock
 *
 * Procedural rock generation with noise displacement, vertex colors,
 * and configurable presets for various rock types and styles.
 *
 * @example
 * ```typescript
 * import { RockGenerator, defaultGenerator, exportToGLB } from "@hyperforge/procgen/rock";
 *
 * // Generate from a preset
 * const boulder = defaultGenerator.generateFromPreset("boulder", { seed: "my-rock" });
 * scene.add(boulder.mesh);
 *
 * // Generate with custom parameters
 * const custom = defaultGenerator.generateCustom({
 *   subdivisions: 4,
 *   noise: { amplitude: 0.3 },
 *   colors: { baseColor: "#8b4513" },
 * });
 * scene.add(custom.mesh);
 *
 * // Export to GLB
 * const glb = await exportToGLB(custom.mesh, { filename: "my-rock" });
 * ```
 */

// Main generator
export { RockGenerator, defaultGenerator } from "./RockGenerator";

// Types
export * from "./types";

// Presets
export {
  DEFAULT_PARAMS,
  SHAPE_PRESETS,
  ROCK_TYPE_PRESETS,
  ALL_PRESETS,
  getPreset,
  listPresets,
  mergeParams,
} from "./presets";

// Utilities
export { SimplexNoise } from "./noise";
export { createRng, hashSeed } from "./rng";

// TSL Material (WebGPU compatible triplanar texturing)
export {
  createRockMaterial,
  createVertexColorRockMaterial,
  updateRockColors,
  updateRockTexture,
  type RockMaterialResult,
  type RockMaterialUniforms,
} from "./RockMaterialTSL";

// Texture utilities
export {
  generateUVs,
  samplePattern,
  bakeTexture,
  exportTexturePNG,
  type BakedTexture,
} from "./texture";

// Export utilities
export {
  exportToGLB,
  exportToOBJ,
  extractGeometryData,
  createMeshFromData,
  type ExportOptions,
  type ExportResult,
  type GeometryData,
} from "./exporter";
