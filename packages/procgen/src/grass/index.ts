/**
 * Grass Generation Module
 *
 * Procedural grass generation with WebGPU/TSL support.
 * This module provides the core grass generation primitives used by
 * both the game engine (ProceduralGrass system) and Asset Forge.
 *
 * @module Grass
 *
 * @example
 * ```ts
 * import { GrassGen } from "@hyperforge/procgen";
 *
 * // Quick grass field generation
 * const field = GrassGen.GrassGenerator.generateField({
 *   config: { density: 10, patchSize: 30 },
 * });
 * scene.add(field.lod0Mesh);
 *
 * // Or use individual components:
 * const geometry = GrassGen.createGrassBladeGeometry({ segments: 4 });
 * const { material, uniforms } = GrassGen.createGrassMaterial();
 * ```
 */

// Types
export type {
  GrassConfig,
  GrassBladeConfig,
  GrassWindConfig,
  GrassColorConfig,
  GrassLODConfig,
  GrassBiomePreset,
} from "./types.js";

export type { GrassMaterialUniforms } from "./GrassMaterialTSL.js";

export {
  DEFAULT_BLADE_CONFIG,
  DEFAULT_WIND_CONFIG,
  DEFAULT_COLOR_CONFIG,
  DEFAULT_LOD_CONFIG,
  DEFAULT_GRASS_CONFIG,
  GRASS_BIOME_PRESETS,
  getGrassBiomePreset,
  getGrassBiomePresetNames,
  mergeGrassConfig,
} from "./types.js";

// Geometry
export type {
  GrassBladeGeometryOptions,
  GrassClumpGeometryOptions,
  GrassPatchOptions,
  GrassInstanceData,
  GrassPatchResult,
} from "./GrassGeometry.js";

export {
  createGrassBladeGeometry,
  createGrassClumpGeometry,
  createSimpleGrassBladeGeometry,
  createGrassCardGeometry,
  generateGrassPatch,
  attachGrassInstanceAttributes,
} from "./GrassGeometry.js";

// Materials
export type {
  GrassMaterialOptions,
  GrassMaterialResult,
} from "./GrassMaterialTSL.js";

export {
  createGrassMaterial,
  createGrassCardMaterial,
  createGrassUniforms,
  updateGrassTime,
  updateGrassWind,
  updateGrassColors,
} from "./GrassMaterialTSL.js";

// Generator
export type { GrassFieldOptions, GrassFieldResult } from "./GrassGenerator.js";

export { GrassGenerator } from "./GrassGenerator.js";

// Game-accurate shader (same as game engine)
export type {
  GameGrassMaterialOptions,
  GameGrassUniforms,
} from "./GrassShaderTSL.js";

export {
  createGameGrassUniforms,
  createGameGrassMaterial,
  updateGameGrassWind,
  updateGameGrassDayNight,
  updateGameGrassColors,
} from "./GrassShaderTSL.js";
