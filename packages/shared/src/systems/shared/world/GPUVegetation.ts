/**
 * GPUVegetation.ts - GPU-Driven Vegetation Rendering
 *
 * Provides GPU-accelerated vegetation rendering using WebGPU/Three.js TSL.
 *
 * ## Features
 * - Screen-space dithered dissolve (smooth per-fragment fade in/out)
 * - Water level culling
 * - Vertex color support (no texture sampling)
 * - Cutout rendering (alphaTest, not transparent) for opaque pipeline performance
 *
 * ## Dissolve Effect
 * Uses world-position-based dithering so vegetation smoothly dissolves in
 * as the player approaches. Each fragment has a pseudo-random threshold
 * compared against the distance-based fade factor - more fragments pass
 * as the player gets closer, creating an organic dissolve effect.
 *
 * @module GPUVegetation
 */

import * as THREE from "../../../extras/three/three";
import {
  uniform,
  sub,
  add,
  mul,
  Fn,
  MeshStandardNodeMaterial,
  float,
  fract,
  sin,
  cos,
  dot,
  vec2,
  smoothstep,
  positionWorld,
  step,
} from "../../../extras/three/three";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * GPU vegetation rendering configuration.
 *
 * NOTE: FADE_START/FADE_END are DEFAULT values. VegetationSystem typically
 * overrides these when creating materials (currently uses 250-300m).
 * These defaults are kept for standalone usage of createGPUVegetationMaterial().
 */
export const GPU_VEG_CONFIG = {
  /** Distance where fade begins (fully opaque inside) - often overridden by VegetationSystem */
  FADE_START: 270,

  /** Distance where fully invisible - often overridden by VegetationSystem */
  FADE_END: 300,

  /** Max instances per mesh */
  MAX_INSTANCES: 65536,

  /** Water level (Y coordinate) - MUST match TerrainSystem.CONFIG.WATER_THRESHOLD */
  WATER_LEVEL: 5.4,

  /** Buffer above water for shoreline avoidance */
  WATER_BUFFER: 3.0,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Uniforms updated per-frame from CPU.
 */
export type GPUVegetationUniforms = {
  playerPos: { value: THREE.Vector3 };
  fadeStart: { value: number };
  fadeEnd: { value: number };
};

/**
 * Material with GPU vegetation uniforms.
 */
export type GPUVegetationMaterial = THREE.Material & {
  gpuUniforms: GPUVegetationUniforms;
};

/**
 * Options for creating GPU vegetation materials.
 */
export type GPUVegetationMaterialOptions = {
  color?: THREE.Color;
  alphaTest?: number;
  fadeStart?: number;
  fadeEnd?: number;
  vertexColors?: boolean;
};

// ============================================================================
// GPU VEGETATION MATERIAL
// ============================================================================

/**
 * Creates a GPU vegetation material with distance-based dithered fade.
 *
 * Uses cutout rendering (alphaTest) for performance - no alpha blending.
 * Dithering is per-instance (not per-fragment) for consistent fade.
 */
export function createGPUVegetationMaterial(
  options: GPUVegetationMaterialOptions = {},
): GPUVegetationMaterial {
  const material = new MeshStandardNodeMaterial();

  // ========== UNIFORMS ==========
  const uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
  const uFadeStart = uniform(options.fadeStart ?? GPU_VEG_CONFIG.FADE_START);
  const uFadeEnd = uniform(options.fadeEnd ?? GPU_VEG_CONFIG.FADE_END);

  // ========== CONSTANTS ==========
  const waterCutoff = float(
    GPU_VEG_CONFIG.WATER_LEVEL + GPU_VEG_CONFIG.WATER_BUFFER,
  );
  const fadeStartSq = mul(uFadeStart, uFadeStart);
  const fadeEndSq = mul(uFadeEnd, uFadeEnd);

  // ========== ALPHA TEST (DITHERED DISSOLVE) ==========
  // alphaTestNode controls fragment discard directly
  // Fragment is discarded when alpha < alphaTestNode value
  // We compute a per-fragment threshold, so higher threshold = more likely to discard
  material.alphaTestNode = Fn(() => {
    // Use positionWorld which includes instance transform - this gives us the
    // world position of each vertex being rendered
    const worldPos = positionWorld;

    // 1. Water check: if below water, use threshold of 2.0 to always discard
    const belowWater = step(worldPos.y, waterCutoff); // 1 if below, 0 if above

    // 2. Distance calculation from WORLD position to player (horizontal only, squared)
    const toPlayer = sub(worldPos, uPlayerPos);
    const distSq = add(
      mul(toPlayer.x, toPlayer.x),
      mul(toPlayer.z, toPlayer.z),
    );

    // 3. Distance factor: 0.0 when close (keep fragment), 1.0 when far (discard fragment)
    // smoothstep(edge0, edge1, x): returns 0 when x<=edge0, 1 when x>=edge1
    const distanceFade = smoothstep(fadeStartSq, fadeEndSq, distSq);

    // 4. WORLD-SPACE DITHERING for smooth per-fragment dissolve
    const ditherScale = float(3.0);

    const ditherInput = vec2(
      add(mul(worldPos.x, ditherScale), mul(worldPos.y, float(0.7))),
      add(mul(worldPos.z, ditherScale), mul(worldPos.y, float(0.5))),
    );

    // Hash function for pseudo-random dither value (0.0 - 1.0)
    const hash1 = fract(
      mul(sin(dot(ditherInput, vec2(12.9898, 78.233))), float(43758.5453)),
    );
    const hash2 = fract(
      mul(cos(dot(ditherInput, vec2(39.346, 11.135))), float(23421.6312)),
    );
    const ditherValue = mul(add(hash1, hash2), float(0.5));

    // 5. Compute alpha threshold
    // alphaTest discards when: opacity (1.0) < threshold
    // So threshold > 1.0 means discard, threshold < 1.0 means keep
    //
    // Formula: threshold = ditherValue + distanceFade
    // - Close (distanceFade=0): threshold = ditherValue (0-1) → all kept
    // - Middle (distanceFade=0.5): threshold = 0.5-1.5 → dithered
    // - Far (distanceFade=1): threshold = 1-2 → all discarded
    const baseThreshold = add(ditherValue, distanceFade);

    // Combine with water check (below water = always discard with threshold > 1)
    const threshold = add(baseThreshold, mul(belowWater, float(2.0)));

    return threshold;
  })();

  // ========== MATERIAL SETTINGS ==========
  if (options.vertexColors) {
    material.vertexColors = true;
  }
  if (options.color) {
    material.color = options.color;
  }

  // CUTOUT rendering with dynamic alphaTestNode
  // alphaTestNode returns per-fragment threshold, fragment discarded when alpha < threshold
  // This is more efficient than transparent blending and provides proper depth sorting
  material.transparent = false; // Opaque rendering for performance
  material.opacity = 1.0; // Full opacity - alphaTestNode controls visibility
  material.alphaTest = 0.5; // Fallback (alphaTestNode overrides this)
  material.side = THREE.DoubleSide;
  material.depthWrite = true;

  // Matte vegetation
  material.roughness = 0.95;
  material.metalness = 0.0;

  // Debug: Log that material was created with fade distances
  const fs = options.fadeStart ?? GPU_VEG_CONFIG.FADE_START;
  const fe = options.fadeEnd ?? GPU_VEG_CONFIG.FADE_END;
  console.log(
    `[GPUVegetation] Material created with alphaTestNode dissolve: fadeStart=${fs}m, fadeEnd=${fe}m (fadeStartSq=${fs * fs}, fadeEndSq=${fe * fe})`,
  );

  // Attach uniforms
  const gpuMaterial = material as unknown as GPUVegetationMaterial;
  gpuMaterial.gpuUniforms = {
    playerPos: uPlayerPos,
    fadeStart: uFadeStart,
    fadeEnd: uFadeEnd,
  };

  return gpuMaterial;
}
