/**
 * GPUVegetation.ts - GPU-Driven Dissolve Rendering
 *
 * Provides GPU-accelerated dissolve rendering using WebGPU/Three.js TSL.
 * This module provides SHARED dissolve functionality for vegetation, mobs, and resources.
 *
 * ## Features
 * - Screen-space dithered dissolve (smooth per-fragment fade in/out)
 * - Both NEAR and FAR camera dissolve support
 * - Water level culling
 * - Vertex color support (no texture sampling)
 * - Cutout rendering (alphaTest, not transparent) for opaque pipeline performance
 *
 * ## Dissolve Effect
 * Uses world-position-based dithering so entities smoothly dissolve in/out
 * as the player approaches or moves away. Each fragment has a pseudo-random threshold
 * compared against the distance-based fade factor - more fragments pass
 * based on distance, creating an organic dissolve effect.
 *
 * ## Shared System
 * - `createGPUVegetationMaterial()` - For vegetation (far dissolve + water culling)
 * - `createDissolveMaterial()` - Generic dissolve for any material (mobs, resources)
 * - Both use identical shader logic for consistent visual appearance
 *
 * @module GPUVegetation
 */

import * as THREE from "../../../extras/three/three";
import {
  uniform,
  sub,
  add,
  mul,
  div,
  Fn,
  MeshStandardNodeMaterial,
  float,
  dot,
  vec3,
  vec4,
  smoothstep,
  positionWorld,
  screenUV,
  cameraPosition,
  vertexColor,
  step,
  texture,
  mix,
  output,
  max,
  clamp,
  sqrt,
  mod,
  floor,
  abs,
  viewportCoordinate,
} from "../../../extras/three/three";
import { FOG_NEAR_SQ, FOG_FAR_SQ, fogRenderTarget } from "./FogConfig";
import { TERRAIN_CONSTANTS } from "../../../constants/GameConstants";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * GPU dissolve rendering configuration.
 * Central configuration for all dissolve effects (vegetation, resources, mobs).
 */
export const GPU_VEG_CONFIG = {
  /** Distance where far fade begins (fully opaque inside) - default for generic dissolve */
  FADE_START: 270,

  /** Distance where fully invisible (far) - default for generic dissolve */
  FADE_END: 300,

  /** Distance where near fade ends (fully opaque outside) */
  NEAR_FADE_END: 3,

  /** Distance where near fade begins (fully invisible inside) */
  NEAR_FADE_START: 1,

  /** Max instances per mesh */
  MAX_INSTANCES: 65536,

  /** Water level (Y coordinate) - from centralized TERRAIN_CONSTANTS */
  WATER_LEVEL: TERRAIN_CONSTANTS.WATER_THRESHOLD,

  /** Buffer above water for shoreline avoidance */
  WATER_BUFFER: 3.0,

  // ========== OCCLUSION DISSOLVE CONFIG ==========
  // Camera-to-player line-of-sight dissolve (RuneScape-style)
  // Uses a CONE shape that expands from camera toward player for natural visibility

  /** Radius at camera end of the cone (meters) - keeps near objects visible */
  OCCLUSION_CAMERA_RADIUS: 0.2,

  /** Radius at player end of the cone (meters) - bubble around player */
  OCCLUSION_PLAYER_RADIUS: 1.0,

  /** Extra radius added based on camera distance (meters per meter of distance) */
  OCCLUSION_DISTANCE_SCALE: 0.03,

  /** Minimum distance from camera before occlusion kicks in (prevents near-clip artifacts) */
  OCCLUSION_NEAR_MARGIN: 0.3,

  /** Distance from player where occlusion stops (small buffer behind player) */
  OCCLUSION_FAR_MARGIN: 0.3,

  /** Sharpness of the cutoff edge (higher = sharper, more binary like RuneScape) */
  OCCLUSION_EDGE_SHARPNESS: 0.5,

  /** Maximum occlusion dissolve strength (0 = disabled, matches buildings) */
  OCCLUSION_STRENGTH: 0.0,

  // ========== NEAR-CAMERA DISSOLVE (RuneScape-style depth fade) ==========
  // Prevents hard geometry clipping when camera clips through objects

  /** Distance from camera where near-fade begins (meters) - fully opaque beyond this */
  NEAR_CAMERA_FADE_START: 1.5,

  /** Distance from camera where geometry is fully dissolved (meters) - at near clip */
  NEAR_CAMERA_FADE_END: 0.05,
} as const;

// ============================================================================
// UNIFIED LOD CONFIGURATION
// ============================================================================

/**
 * LOD distances for a category.
 * All distances in meters from camera.
 *
 * LOD Pipeline:
 * - LOD0 (0 to lod1Distance): Full detail mesh
 * - LOD1 (lod1Distance to lod2Distance): Low-poly mesh (~10% verts)
 * - LOD2 (lod2Distance to imposterDistance): Very low-poly mesh (~3% verts)
 * - Impostor (imposterDistance to fadeDistance): Billboard
 * - Culled (> fadeDistance): Hidden
 */
export interface LODDistances {
  /** Distance to switch from LOD0 (full detail) to LOD1 (low poly ~10%) */
  lod1Distance: number;
  /** Distance to switch from LOD1 to LOD2 (very low poly ~3%) */
  lod2Distance: number;
  /** Distance to switch from 3D mesh to billboard imposter */
  imposterDistance: number;
  /** Distance at which to completely fade out/cull */
  fadeDistance: number;
}

/**
 * LOD distances with pre-computed squared values for performance.
 * Use squared distances to avoid Math.sqrt in hot paths.
 */
export interface LODDistancesWithSq extends LODDistances {
  lod1DistanceSq: number;
  lod2DistanceSq: number;
  imposterDistanceSq: number;
  fadeDistanceSq: number;
}

/**
 * UNIFIED LOD CONFIGURATION - Single source of truth for all LOD distances.
 *
 * This is the canonical configuration used by:
 * - VegetationSystem (trees, bushes, grass, etc.)
 * - ResourceEntity (harvestable resources)
 * - Any other LOD systems
 *
 * Categories can be customized based on object size and visual importance.
 */
export const LOD_DISTANCES: Record<string, LODDistances> = {
  // Large vegetation - aggressive LOD for performance
  tree: {
    lod1Distance: 30,
    lod2Distance: 60,
    imposterDistance: 100,
    fadeDistance: 180,
  },

  // Medium vegetation
  bush: {
    lod1Distance: 40,
    lod2Distance: 80,
    imposterDistance: 120,
    fadeDistance: 200,
  },
  fern: {
    lod1Distance: 30,
    lod2Distance: 55,
    imposterDistance: 80,
    fadeDistance: 120,
  },
  rock: {
    lod1Distance: 50,
    lod2Distance: 100,
    imposterDistance: 150,
    fadeDistance: 250,
  },
  fallen_tree: {
    lod1Distance: 45,
    lod2Distance: 90,
    imposterDistance: 130,
    fadeDistance: 200,
  },

  // Small vegetation (aggressive culling - skip LOD2, go straight to impostor)
  flower: {
    lod1Distance: 25,
    lod2Distance: 45, // Same as imposter - skip LOD2
    imposterDistance: 60,
    fadeDistance: 100,
  },
  mushroom: {
    lod1Distance: 15,
    lod2Distance: 30, // Same as imposter - skip LOD2
    imposterDistance: 40,
    fadeDistance: 80,
  },
  grass: {
    lod1Distance: 10,
    lod2Distance: 20, // Same as imposter - skip LOD2
    imposterDistance: 30,
    fadeDistance: 60,
  },

  // Resources (harvestable objects)
  resource: {
    lod1Distance: 45,
    lod2Distance: 85,
    imposterDistance: 120,
    fadeDistance: 200,
  },
  tree_resource: {
    lod1Distance: 25, // Switch to LOD1 very early
    lod2Distance: 50,
    imposterDistance: 80, // Switch to impostor ASAP
    fadeDistance: 150, // Fade out earlier
  },
  rock_resource: {
    lod1Distance: 50,
    lod2Distance: 100,
    imposterDistance: 150,
    fadeDistance: 250,
  },

  // Buildings - simple geometry, skip intermediate LODs and go directly to impostor
  // Buildings use batched static meshes, so LOD stages are unnecessary
  // LOD0 (0-80m): Full detail batched mesh with shadows
  // Impostor (80-200m): Octahedral billboard
  // Culled (>200m): Hidden
  building: {
    lod1Distance: 80, // Same as impostor - skip intermediate LOD
    lod2Distance: 80, // Same as impostor - skip intermediate LOD
    imposterDistance: 80, // Switch to impostor at 80m
    fadeDistance: 200, // Cull at 200m
  },
  station: {
    lod1Distance: 60,
    lod2Distance: 140,
    imposterDistance: 200,
    fadeDistance: 350,
  },

  // Mobs and NPCs (skip LOD2 - use LOD1 to impostor)
  mob: {
    lod1Distance: 40,
    lod2Distance: 70,
    imposterDistance: 100,
    fadeDistance: 150,
  },
  npc: {
    lod1Distance: 50,
    lod2Distance: 90,
    imposterDistance: 120,
    fadeDistance: 180,
  },
  player: {
    lod1Distance: 50,
    lod2Distance: 90,
    imposterDistance: 120,
    fadeDistance: 200,
  },

  // Items (skip LOD2)
  item: {
    lod1Distance: 25,
    lod2Distance: 45,
    imposterDistance: 60,
    fadeDistance: 100,
  },
};

/** Default LOD distances for unknown categories */
export const DEFAULT_LOD_DISTANCES: LODDistances = {
  lod1Distance: 45,
  lod2Distance: 85,
  imposterDistance: 120,
  fadeDistance: 200,
};

/**
 * Reference size (in meters) for LOD distance scaling.
 * Objects larger than this get proportionally extended draw distances.
 * Objects smaller than this get proportionally reduced draw distances.
 *
 * Based on typical "medium" object size (a small tree or large bush).
 */
export const LOD_REFERENCE_SIZE = 5.0;

/**
 * Minimum scale factor (prevents tiny objects from having 0 draw distance)
 */
export const LOD_MIN_SCALE = 0.3;

/**
 * Maximum scale factor (prevents huge objects from having infinite draw distance)
 */
export const LOD_MAX_SCALE = 10.0;

/**
 * Calculate size-based LOD distance scale factor.
 *
 * Formula: scale = clamp(boundingSize / referenceSize, minScale, maxScale)
 *
 * Examples:
 * - 5m object (reference): scale = 1.0x (normal distances)
 * - 10m object: scale = 2.0x (double distances)
 * - 50m object: scale = 10.0x (max, capped)
 * - 2m object: scale = 0.4x (40% of normal)
 * - 0.5m object: scale = 0.3x (min, capped)
 *
 * @param boundingSize - Bounding box diagonal or sphere diameter in meters
 * @returns Scale factor to multiply with base LOD distances
 */
export function calculateLODScaleFactor(boundingSize: number): number {
  if (boundingSize <= 0) return 1.0;
  const rawScale = boundingSize / LOD_REFERENCE_SIZE;
  return Math.max(LOD_MIN_SCALE, Math.min(LOD_MAX_SCALE, rawScale));
}

/** Cache for LOD configs with pre-computed squared distances */
const lodDistanceCache = new Map<string, LODDistancesWithSq>();

/** Cache for size-scaled LOD configs */
const lodDistanceSizeCache = new Map<string, LODDistancesWithSq>();

/**
 * Get LOD distances for a category with pre-computed squared values.
 * Caches results for performance.
 *
 * @param category - Category name (e.g., "tree", "bush", "resource")
 * @returns LOD distances with squared values for distance comparisons
 */
export function getLODDistances(category: string): LODDistancesWithSq {
  // Check cache first
  const cached = lodDistanceCache.get(category);
  if (cached) return cached;

  // Get base config or use default
  const base = LOD_DISTANCES[category] ?? DEFAULT_LOD_DISTANCES;

  // Pre-compute squared distances
  const withSq: LODDistancesWithSq = {
    ...base,
    lod1DistanceSq: base.lod1Distance * base.lod1Distance,
    lod2DistanceSq: base.lod2Distance * base.lod2Distance,
    imposterDistanceSq: base.imposterDistance * base.imposterDistance,
    fadeDistanceSq: base.fadeDistance * base.fadeDistance,
  };

  // Cache and return
  lodDistanceCache.set(category, withSq);
  return withSq;
}

/**
 * Get LOD distances scaled by object size.
 *
 * Larger objects (bigger bounding box) get proportionally extended draw distances,
 * allowing them to be visible from farther away as imposters.
 *
 * This enables:
 * - Giant trees visible as imposters from 1km+ away
 * - Small mushrooms culled at 50m
 * - Medium bushes at default distances
 *
 * @param category - Category name (e.g., "tree", "bush", "resource")
 * @param boundingSize - Bounding box diagonal or sphere diameter in meters
 * @returns LOD distances scaled by object size with pre-computed squared values
 */
export function getLODDistancesScaled(
  category: string,
  boundingSize: number,
): LODDistancesWithSq {
  // Create cache key combining category and size (rounded to avoid cache bloat)
  const roundedSize = Math.round(boundingSize * 10) / 10; // Round to 0.1m precision
  const cacheKey = `${category}_${roundedSize}`;

  // Check cache first
  const cached = lodDistanceSizeCache.get(cacheKey);
  if (cached) return cached;

  // Get base config
  const base = LOD_DISTANCES[category] ?? DEFAULT_LOD_DISTANCES;

  // Calculate scale factor
  const scale = calculateLODScaleFactor(boundingSize);

  // Apply scaling to all distances
  const scaled: LODDistancesWithSq = {
    lod1Distance: base.lod1Distance * scale,
    lod2Distance: base.lod2Distance * scale,
    imposterDistance: base.imposterDistance * scale,
    fadeDistance: base.fadeDistance * scale,
    lod1DistanceSq: (base.lod1Distance * scale) ** 2,
    lod2DistanceSq: (base.lod2Distance * scale) ** 2,
    imposterDistanceSq: (base.imposterDistance * scale) ** 2,
    fadeDistanceSq: (base.fadeDistance * scale) ** 2,
  };

  // Cache and return
  lodDistanceSizeCache.set(cacheKey, scaled);
  return scaled;
}

/**
 * Get LOD configuration for an entity or object, with size-based scaling.
 *
 * Convenience function that extracts bounding size from common object types.
 *
 * @param category - Category name
 * @param object - THREE.Object3D, bounding box, or bounding sphere
 * @returns Scaled LOD distances
 */
export function getLODConfig(
  category: string,
  object?:
    | THREE.Object3D
    | THREE.Box3
    | THREE.Sphere
    | { boundingSize: number }
    | number,
): LODDistancesWithSq {
  // If no object, return base distances
  if (object === undefined || object === null) {
    return getLODDistances(category);
  }

  // Extract bounding size based on object type
  let boundingSize: number;

  if (typeof object === "number") {
    // Direct size value
    boundingSize = object;
  } else if ("boundingSize" in object) {
    // Object with explicit boundingSize property
    boundingSize = object.boundingSize;
  } else if (object instanceof THREE.Box3) {
    // Bounding box - use diagonal
    const size = new THREE.Vector3();
    object.getSize(size);
    boundingSize = size.length();
  } else if (object instanceof THREE.Sphere) {
    // Bounding sphere - use diameter
    boundingSize = object.radius * 2;
  } else if (object instanceof THREE.Object3D) {
    // THREE.Object3D - compute bounding box
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    boundingSize = size.length();
  } else {
    // Unknown type, use base distances
    return getLODDistances(category);
  }

  return getLODDistancesScaled(category, boundingSize);
}

/**
 * Clear the LOD distance cache.
 * Call this if LOD_DISTANCES is modified at runtime.
 */
export function clearLODDistanceCache(): void {
  lodDistanceCache.clear();
  lodDistanceSizeCache.clear();
}

/**
 * Apply LOD settings from a manifest or external configuration.
 * Merges with existing configuration and clears the cache.
 *
 * @param settings - LOD settings with distanceThresholds
 */
export function applyLODSettings(settings: {
  distanceThresholds?: Record<
    string,
    { lod1?: number; lod2?: number; imposter: number; fadeOut: number }
  >;
}): void {
  if (!settings.distanceThresholds) return;

  for (const [category, thresholds] of Object.entries(
    settings.distanceThresholds,
  )) {
    // Map category names (e.g., "fallen" -> "fallen_tree")
    const configKey = category === "fallen" ? "fallen_tree" : category;

    // Calculate lod2Distance: if not provided, use midpoint between lod1 and imposter
    const lod1 = thresholds.lod1 ?? 0;
    const lod2 = thresholds.lod2 ?? (lod1 + thresholds.imposter) / 2;

    LOD_DISTANCES[configKey] = {
      lod1Distance: lod1,
      lod2Distance: lod2,
      imposterDistance: thresholds.imposter,
      fadeDistance: thresholds.fadeOut,
    };
  }

  // Clear cache to force recalculation with new values
  clearLODDistanceCache();

  console.log(
    `[GPUVegetation] Applied LOD settings for ${Object.keys(settings.distanceThresholds).length} categories`,
  );
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Uniforms updated per-frame from CPU.
 */
export type GPUVegetationUniforms = {
  playerPos: { value: THREE.Vector3 };
  cameraPos: { value: THREE.Vector3 };
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
  /** Enable camera-to-player occlusion dissolve (default: true) */
  enableOcclusionDissolve?: boolean;
};

/**
 * Options for creating generic dissolve materials.
 * Used for mobs, resources, and any entity that needs dissolve.
 */
export type DissolveMaterialOptions = {
  /** Distance where far fade begins */
  fadeStart?: number;
  /** Distance where fully invisible (far) */
  fadeEnd?: number;
  /** Distance where near fade ends (fully opaque outside) */
  nearFadeEnd?: number;
  /** Distance where near fade begins (fully invisible inside) */
  nearFadeStart?: number;
  /** Enable near camera dissolve */
  enableNearFade?: boolean;
  /** Enable water level culling */
  enableWaterCulling?: boolean;
  /** Enable camera-to-player occlusion dissolve (default: true) */
  enableOcclusionDissolve?: boolean;
};

/**
 * Material with generic dissolve uniforms.
 */
export type DissolveMaterial = THREE.MeshStandardNodeMaterial & {
  dissolveUniforms: {
    playerPos: { value: THREE.Vector3 };
    cameraPos: { value: THREE.Vector3 };
    fadeStart: { value: number };
    fadeEnd: { value: number };
    nearFadeStart: { value: number };
    nearFadeEnd: { value: number };
  };
};

// ============================================================================
// GPU VEGETATION MATERIAL
// ============================================================================

/**
 * Creates a GPU vegetation material with distance-based dithered fade
 * and camera-to-player occlusion dissolve (RuneScape-style).
 *
 * Uses cutout rendering (alphaTest) for performance - no alpha blending.
 * Dithering is per-instance (not per-fragment) for consistent fade.
 *
 * OCCLUSION DISSOLVE:
 * When objects are between the camera and player, they dissolve to reveal the player.
 * The occlusion cylinder radius scales dynamically with camera distance:
 * - Zoomed in (close camera): small radius, subtle dissolve
 * - Zoomed out (far camera): larger radius, more dissolve coverage
 */
export function createGPUVegetationMaterial(
  options: GPUVegetationMaterialOptions = {},
): GPUVegetationMaterial {
  const material = new MeshStandardNodeMaterial();

  // ========== UNIFORMS ==========
  const uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
  const uCameraPos = uniform(new THREE.Vector3(0, 0, 0));
  const uFadeStart = uniform(options.fadeStart ?? GPU_VEG_CONFIG.FADE_START);
  const uFadeEnd = uniform(options.fadeEnd ?? GPU_VEG_CONFIG.FADE_END);

  // ========== CONSTANTS ==========
  const waterCutoff = float(
    GPU_VEG_CONFIG.WATER_LEVEL + GPU_VEG_CONFIG.WATER_BUFFER,
  );
  const fadeStartSq = mul(uFadeStart, uFadeStart);
  const fadeEndSq = mul(uFadeEnd, uFadeEnd);

  // Occlusion dissolve constants (RuneScape-style cone)
  const enableOcclusion = options.enableOcclusionDissolve !== false; // Default: enabled
  const occlusionCameraRadius = float(GPU_VEG_CONFIG.OCCLUSION_CAMERA_RADIUS);
  const occlusionPlayerRadius = float(GPU_VEG_CONFIG.OCCLUSION_PLAYER_RADIUS);
  const occlusionDistanceScale = float(GPU_VEG_CONFIG.OCCLUSION_DISTANCE_SCALE);
  const occlusionNearMargin = float(GPU_VEG_CONFIG.OCCLUSION_NEAR_MARGIN);
  const occlusionFarMargin = float(GPU_VEG_CONFIG.OCCLUSION_FAR_MARGIN);
  const occlusionEdgeSharpness = float(GPU_VEG_CONFIG.OCCLUSION_EDGE_SHARPNESS);
  const occlusionStrength = float(GPU_VEG_CONFIG.OCCLUSION_STRENGTH);

  // Near-camera dissolve constants (RuneScape-style depth fade)
  const nearCameraFadeStart = float(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_START);
  const nearCameraFadeEnd = float(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_END);

  // ========== ALPHA TEST (DITHERED DISSOLVE + OCCLUSION + NEAR-CAMERA FADE) ==========
  // alphaTestNode controls fragment discard directly
  // Fragment is discarded when alpha < alphaTestNode value
  // We compute a per-fragment threshold, so higher threshold = more likely to discard
  material.alphaTestNode = Fn(() => {
    // Use positionWorld which includes instance transform
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

    // 4. CAMERA-TO-PLAYER OCCLUSION DISSOLVE (RuneScape-style)
    // Dissolve objects between camera and player using a CONE shape
    // The cone is narrow at the camera and wide around the player
    // This creates a natural "bubble" of visibility around the player
    const occlusionFade = enableOcclusion
      ? (() => {
          // Camera to player vector (CT)
          const camToPlayer = vec3(
            sub(uPlayerPos.x, uCameraPos.x),
            sub(uPlayerPos.y, uCameraPos.y),
            sub(uPlayerPos.z, uCameraPos.z),
          );

          // Camera to fragment vector (CP)
          const camToFrag = vec3(
            sub(worldPos.x, uCameraPos.x),
            sub(worldPos.y, uCameraPos.y),
            sub(worldPos.z, uCameraPos.z),
          );

          // Length of camera-to-player vector
          const ctLengthSq = add(
            add(
              mul(camToPlayer.x, camToPlayer.x),
              mul(camToPlayer.y, camToPlayer.y),
            ),
            mul(camToPlayer.z, camToPlayer.z),
          );
          const ctLength = sqrt(ctLengthSq);

          // Normalized camera-to-player direction
          const ctDirX = div(camToPlayer.x, ctLength);
          const ctDirY = div(camToPlayer.y, ctLength);
          const ctDirZ = div(camToPlayer.z, ctLength);

          // Project fragment onto camera-player line (dot product of CP and normalized CT)
          // projDist = how far along the camera->player line this fragment projects
          const projDist = add(
            add(mul(camToFrag.x, ctDirX), mul(camToFrag.y, ctDirY)),
            mul(camToFrag.z, ctDirZ),
          );

          // Check if fragment is between camera and player (with small margins)
          const inRangeNear = step(occlusionNearMargin, projDist);
          const inRangeFar = step(projDist, sub(ctLength, occlusionFarMargin));
          const inRange = mul(inRangeNear, inRangeFar);

          // Calculate perpendicular distance from fragment to the camera-player line
          const projX = add(uCameraPos.x, mul(projDist, ctDirX));
          const projY = add(uCameraPos.y, mul(projDist, ctDirY));
          const projZ = add(uCameraPos.z, mul(projDist, ctDirZ));

          // Perpendicular distance (how far from the center line)
          const perpX = sub(worldPos.x, projX);
          const perpY = sub(worldPos.y, projY);
          const perpZ = sub(worldPos.z, projZ);
          const perpDistSq = add(
            add(mul(perpX, perpX), mul(perpY, perpY)),
            mul(perpZ, perpZ),
          );
          const perpDist = sqrt(perpDistSq);

          // CONE RADIUS CALCULATION (RuneScape-style)
          // t = normalized position along camera->player (0 at camera, 1 at player)
          const t = clamp(div(projDist, ctLength), float(0.0), float(1.0));

          // Cone radius: linearly interpolates from camera radius to player radius
          // Plus extra radius based on total camera distance (for zoom-out support)
          const coneRadius = add(
            add(
              occlusionCameraRadius,
              mul(t, sub(occlusionPlayerRadius, occlusionCameraRadius)),
            ),
            mul(ctLength, occlusionDistanceScale),
          );

          // SHARP EDGE FALLOFF (RuneScape-style binary disappearance)
          // Uses a narrow smoothstep band for sharper cutoff
          const edgeStart = mul(
            coneRadius,
            sub(float(1.0), occlusionEdgeSharpness),
          );
          const rawOcclusionFade = sub(
            float(1.0),
            smoothstep(edgeStart, coneRadius, perpDist),
          );

          // Apply occlusion strength and range check
          return mul(mul(rawOcclusionFade, occlusionStrength), inRange);
        })()
      : float(0.0);

    // 5. NEAR-CAMERA DISSOLVE (RuneScape-style depth fade)
    // Prevents hard geometry clipping when camera clips through vegetation
    const camToFrag = sub(worldPos, uCameraPos);
    const camDistSq = dot(camToFrag, camToFrag);
    const camDist = sqrt(camDistSq);
    const nearCameraFade = sub(
      float(1.0),
      smoothstep(nearCameraFadeEnd, nearCameraFadeStart, camDist),
    );

    // 6. Combine all fade factors (max ensures all effects work independently)
    const combinedFade = max(max(distanceFade, occlusionFade), nearCameraFade);

    // 7. SCREEN-SPACE 4x4 BAYER DITHERING (RuneScape 3 style)
    // 4x4 Bayer matrix: [ 0, 8, 2,10; 12, 4,14, 6; 3,11, 1, 9; 15, 7,13, 5]/16
    const ix = mod(floor(viewportCoordinate.x), float(4.0));
    const iy = mod(floor(viewportCoordinate.y), float(4.0));

    const bit0_x = mod(ix, float(2.0));
    const bit1_x = floor(mul(ix, float(0.5)));
    const bit0_y = mod(iy, float(2.0));
    const bit1_y = floor(mul(iy, float(0.5)));
    const xor0 = abs(sub(bit0_x, bit0_y));
    const xor1 = abs(sub(bit1_x, bit1_y));

    const bayerInt = add(
      add(
        add(mul(xor0, float(8.0)), mul(bit0_y, float(4.0))),
        mul(xor1, float(2.0)),
      ),
      bit1_y,
    );
    const ditherValue = mul(bayerInt, float(0.0625));

    // 8. RS3-style threshold: discard when fade >= dither
    // step returns 0 or 1, multiply by 2 so threshold > 1.0 causes discard
    // IMPORTANT: Only apply dithering when combinedFade > 0, otherwise step(0,0)=1 causes holes
    const hasAnyFade = step(float(0.001), combinedFade);
    const ditherThreshold = mul(
      mul(step(ditherValue, combinedFade), hasAnyFade),
      float(2.0),
    );
    const threshold = max(ditherThreshold, mul(belowWater, float(2.0)));

    return threshold;
  })();

  // ========== SKY-COLOR FOG (smoothstep + NEAR_SQ, applied in outputNode) ==========
  const fogTexNode = texture(fogRenderTarget.texture, screenUV);

  const toCam = sub(cameraPosition, positionWorld);
  const fogDistSq = dot(toCam, toCam);
  const fogFactor = smoothstep(
    float(FOG_NEAR_SQ),
    float(FOG_FAR_SQ),
    fogDistSq,
  );

  // colorNode reads vertex colors manually; vertexColors must be FALSE to
  // prevent the PBR pipeline from multiplying them a second time.
  material.colorNode = options.vertexColors
    ? Fn(() => vertexColor().rgb)()
    : undefined;
  material.vertexColors = false;
  if (options.color) {
    material.color = options.color;
  }
  material.fog = false;

  // Apply fog AFTER PBR lighting via outputNode so fog color isn't darkened
  material.outputNode = Fn(() => {
    const litColor = output;
    return vec4(mix(litColor.rgb, fogTexNode.rgb, fogFactor), litColor.a);
  })();

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

  // Attach uniforms
  const gpuMaterial = material as unknown as GPUVegetationMaterial;
  gpuMaterial.gpuUniforms = {
    playerPos: uPlayerPos,
    cameraPos: uCameraPos,
    fadeStart: uFadeStart,
    fadeEnd: uFadeEnd,
  };

  return gpuMaterial;
}

// ============================================================================
// GENERIC DISSOLVE MATERIAL (FOR MOBS, RESOURCES, ETC.)
// ============================================================================

/**
 * Creates a dissolve material from an existing MeshStandardMaterial.
 * Clones the visual properties and adds the dithered dissolve effect.
 *
 * This uses the SAME shader logic as vegetation for consistent visuals.
 * Supports near-camera, far-camera, and camera-to-player occlusion dissolve.
 *
 * @param source - Source material to clone properties from
 * @param options - Dissolve configuration options
 * @returns Material with dissolve shader attached
 *
 * @example
 * ```ts
 * // Create dissolve material from existing material
 * const dissolveMat = createDissolveMaterial(originalMaterial, {
 *   fadeStart: 270,
 *   fadeEnd: 300,
 *   enableNearFade: true,
 *   nearFadeStart: 1,
 *   nearFadeEnd: 3,
 *   enableOcclusionDissolve: true,
 * });
 *
 * // Update positions each frame
 * dissolveMat.dissolveUniforms.playerPos.value.set(px, py, pz);
 * dissolveMat.dissolveUniforms.cameraPos.value.set(cx, cy, cz);
 * ```
 */
export function createDissolveMaterial(
  source: THREE.MeshStandardMaterial | THREE.Material,
  options: DissolveMaterialOptions = {},
): DissolveMaterial {
  const material = new MeshStandardNodeMaterial();

  // Copy properties from source material.
  // ModelCache converts all materials to MeshStandardNodeMaterial, which may
  // not pass `instanceof MeshStandardMaterial` in the WebGPU build where
  // they are separate classes. Duck-type check for PBR properties instead.
  const src = source as THREE.MeshStandardMaterial & {
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    aoMap?: THREE.Texture | null;
  };
  if (src.color && src.roughness !== undefined) {
    material.color.copy(src.color);
    material.roughness = src.roughness;
    material.metalness = src.metalness;
    material.emissive.copy(src.emissive);
    material.emissiveIntensity = src.emissiveIntensity;
    material.vertexColors = src.vertexColors;
    material.side = src.side;
    material.transparent = false;
    material.depthWrite = true;
    material.opacity = 1.0;

    if (src.map) material.map = src.map;
    if (src.normalMap) material.normalMap = src.normalMap;
    if (src.emissiveMap) material.emissiveMap = src.emissiveMap;
    if (src.roughnessMap) material.roughnessMap = src.roughnessMap;
    if (src.metalnessMap) material.metalnessMap = src.metalnessMap;
    if (src.aoMap) material.aoMap = src.aoMap;
  } else {
    material.color.set(0x888888);
    material.roughness = 0.8;
    material.metalness = 0.0;
  }

  // ========== UNIFORMS ==========
  const uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
  const uCameraPos = uniform(new THREE.Vector3(0, 0, 0));
  const uFadeStart = uniform(options.fadeStart ?? GPU_VEG_CONFIG.FADE_START);
  const uFadeEnd = uniform(options.fadeEnd ?? GPU_VEG_CONFIG.FADE_END);
  const uNearFadeStart = uniform(
    options.nearFadeStart ?? GPU_VEG_CONFIG.NEAR_FADE_START,
  );
  const uNearFadeEnd = uniform(
    options.nearFadeEnd ?? GPU_VEG_CONFIG.NEAR_FADE_END,
  );

  // ========== CONSTANTS ==========
  const fadeStartSq = mul(uFadeStart, uFadeStart);
  const fadeEndSq = mul(uFadeEnd, uFadeEnd);
  const nearFadeStartSq = mul(uNearFadeStart, uNearFadeStart);
  const nearFadeEndSq = mul(uNearFadeEnd, uNearFadeEnd);
  const enableNearFade = options.enableNearFade ?? true;
  const enableWaterCulling = options.enableWaterCulling ?? false;
  const enableOcclusion = options.enableOcclusionDissolve !== false; // Default: enabled
  const waterCutoff = float(
    GPU_VEG_CONFIG.WATER_LEVEL + GPU_VEG_CONFIG.WATER_BUFFER,
  );

  // Occlusion dissolve constants (RuneScape-style cone)
  const occlusionCameraRadius = float(GPU_VEG_CONFIG.OCCLUSION_CAMERA_RADIUS);
  const occlusionPlayerRadius = float(GPU_VEG_CONFIG.OCCLUSION_PLAYER_RADIUS);
  const occlusionDistanceScale = float(GPU_VEG_CONFIG.OCCLUSION_DISTANCE_SCALE);
  const occlusionNearMargin = float(GPU_VEG_CONFIG.OCCLUSION_NEAR_MARGIN);
  const occlusionFarMargin = float(GPU_VEG_CONFIG.OCCLUSION_FAR_MARGIN);
  const occlusionEdgeSharpness = float(GPU_VEG_CONFIG.OCCLUSION_EDGE_SHARPNESS);
  const occlusionStrength = float(GPU_VEG_CONFIG.OCCLUSION_STRENGTH);

  // Near-camera dissolve constants (RuneScape-style depth fade)
  const nearCameraFadeStart = float(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_START);
  const nearCameraFadeEnd = float(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_END);

  // ========== ALPHA TEST (DITHERED DISSOLVE + OCCLUSION + NEAR-CAMERA FADE) ==========
  material.alphaTestNode = Fn(() => {
    const worldPos = positionWorld;

    // Distance calculation from world position to player (horizontal only, squared)
    const toPlayer = sub(worldPos, uPlayerPos);
    const distSq = add(
      mul(toPlayer.x, toPlayer.x),
      mul(toPlayer.z, toPlayer.z),
    );

    // FAR fade: 0.0 when close (keep), 1.0 when far (discard)
    const farFade = smoothstep(fadeStartSq, fadeEndSq, distSq);

    // NEAR fade: 0.0 when outside near zone (keep), 1.0 when too close (discard)
    const nearFade = enableNearFade
      ? sub(float(1.0), smoothstep(nearFadeStartSq, nearFadeEndSq, distSq))
      : float(0.0);

    // Combined distance fade (max of near and far fade)
    const distanceFadeBase = max(farFade, nearFade);

    // NEAR-CAMERA DISSOLVE (prevents hard clipping when camera clips through objects)
    const camToFrag = sub(worldPos, uCameraPos);
    const camDistSq = dot(camToFrag, camToFrag);
    const camDist = sqrt(camDistSq);
    const nearCameraFade = sub(
      float(1.0),
      smoothstep(nearCameraFadeEnd, nearCameraFadeStart, camDist),
    );

    // CAMERA-TO-PLAYER OCCLUSION DISSOLVE (RuneScape-style)
    // Uses a CONE shape that expands from camera toward player
    const occlusionFade = enableOcclusion
      ? (() => {
          // Camera to player vector (CT)
          const camToPlayer = vec3(
            sub(uPlayerPos.x, uCameraPos.x),
            sub(uPlayerPos.y, uCameraPos.y),
            sub(uPlayerPos.z, uCameraPos.z),
          );

          // Camera to fragment vector (CP)
          const camToFrag = vec3(
            sub(worldPos.x, uCameraPos.x),
            sub(worldPos.y, uCameraPos.y),
            sub(worldPos.z, uCameraPos.z),
          );

          // Length of camera-to-player vector
          const ctLengthSq = add(
            add(
              mul(camToPlayer.x, camToPlayer.x),
              mul(camToPlayer.y, camToPlayer.y),
            ),
            mul(camToPlayer.z, camToPlayer.z),
          );
          const ctLength = sqrt(ctLengthSq);

          // Normalized camera-to-player direction
          const ctDirX = div(camToPlayer.x, ctLength);
          const ctDirY = div(camToPlayer.y, ctLength);
          const ctDirZ = div(camToPlayer.z, ctLength);

          // Project fragment onto camera-player line
          const projDist = add(
            add(mul(camToFrag.x, ctDirX), mul(camToFrag.y, ctDirY)),
            mul(camToFrag.z, ctDirZ),
          );

          // Check if fragment is between camera and player (with margins)
          const inRangeNear = step(occlusionNearMargin, projDist);
          const inRangeFar = step(projDist, sub(ctLength, occlusionFarMargin));
          const inRange = mul(inRangeNear, inRangeFar);

          // Calculate perpendicular distance from fragment to the camera-player line
          const projX = add(uCameraPos.x, mul(projDist, ctDirX));
          const projY = add(uCameraPos.y, mul(projDist, ctDirY));
          const projZ = add(uCameraPos.z, mul(projDist, ctDirZ));

          const perpX = sub(worldPos.x, projX);
          const perpY = sub(worldPos.y, projY);
          const perpZ = sub(worldPos.z, projZ);
          const perpDistSq = add(
            add(mul(perpX, perpX), mul(perpY, perpY)),
            mul(perpZ, perpZ),
          );
          const perpDist = sqrt(perpDistSq);

          // CONE RADIUS CALCULATION (RuneScape-style)
          const t = clamp(div(projDist, ctLength), float(0.0), float(1.0));
          const coneRadius = add(
            add(
              occlusionCameraRadius,
              mul(t, sub(occlusionPlayerRadius, occlusionCameraRadius)),
            ),
            mul(ctLength, occlusionDistanceScale),
          );

          // SHARP EDGE FALLOFF (RuneScape-style binary disappearance)
          const edgeStart = mul(
            coneRadius,
            sub(float(1.0), occlusionEdgeSharpness),
          );
          const rawOcclusionFade = sub(
            float(1.0),
            smoothstep(edgeStart, coneRadius, perpDist),
          );

          // Apply occlusion strength and range check
          return mul(mul(rawOcclusionFade, occlusionStrength), inRange);
        })()
      : float(0.0);

    // Combine distance fade, occlusion fade, and near-camera fade
    const distanceFade = max(
      max(distanceFadeBase, occlusionFade),
      nearCameraFade,
    );

    // SCREEN-SPACE 4x4 BAYER DITHERING (RuneScape 3 style)
    const ix = mod(floor(viewportCoordinate.x), float(4.0));
    const iy = mod(floor(viewportCoordinate.y), float(4.0));

    const bit0_x = mod(ix, float(2.0));
    const bit1_x = floor(mul(ix, float(0.5)));
    const bit0_y = mod(iy, float(2.0));
    const bit1_y = floor(mul(iy, float(0.5)));
    const xor0 = abs(sub(bit0_x, bit0_y));
    const xor1 = abs(sub(bit1_x, bit1_y));

    const bayerInt = add(
      add(
        add(mul(xor0, float(8.0)), mul(bit0_y, float(4.0))),
        mul(xor1, float(2.0)),
      ),
      bit1_y,
    );
    const ditherValue = mul(bayerInt, float(0.0625));

    // RS3-style: discard when fade >= dither
    // step returns 0 or 1, multiply by 2 so threshold > 1.0 causes discard
    // IMPORTANT: Only apply dithering when distanceFade > 0, otherwise step(0,0)=1 causes holes
    const hasAnyFade = step(float(0.001), distanceFade);
    const ditherThreshold = mul(
      mul(step(ditherValue, distanceFade), hasAnyFade),
      float(2.0),
    );

    // Water culling (optional)
    const waterCullValue = enableWaterCulling
      ? mul(step(worldPos.y, waterCutoff), float(2.0))
      : float(0.0);
    const threshold = max(ditherThreshold, waterCullValue);

    return threshold;
  })();

  // Material settings for cutout rendering
  material.alphaTest = 0.5; // Fallback
  material.forceSinglePass = true;

  // Attach dissolve uniforms for per-frame updates
  const dissolveMat = material as DissolveMaterial;
  dissolveMat.dissolveUniforms = {
    playerPos: uPlayerPos,
    cameraPos: uCameraPos,
    fadeStart: uFadeStart,
    fadeEnd: uFadeEnd,
    nearFadeStart: uNearFadeStart,
    nearFadeEnd: uNearFadeEnd,
  };

  material.needsUpdate = true;
  return dissolveMat;
}

/**
 * Check if a material has dissolve uniforms attached.
 */
export function isDissolveMaterial(
  material: THREE.Material | null | undefined,
): material is DissolveMaterial {
  return material != null && "dissolveUniforms" in material;
}

// ============================================================================
// IMPOSTER BILLBOARD MATERIAL (FOR VEGETATION/RESOURCE IMPOSTERS)
// ============================================================================

/**
 * Options for creating imposter billboard materials.
 */
export type ImposterMaterialOptions = {
  /** The pre-rendered imposter texture */
  texture: THREE.Texture;
  /** Distance where far fade begins */
  fadeStart?: number;
  /** Distance where fully invisible (far) */
  fadeEnd?: number;
  /** Alpha test threshold for texture cutout (default 0.5) */
  alphaTest?: number;
};

/**
 * Material with imposter-specific uniforms.
 */
export type ImposterMaterial = THREE.MeshStandardNodeMaterial & {
  imposterUniforms: {
    playerPos: { value: THREE.Vector3 };
    fadeStart: { value: number };
    fadeEnd: { value: number };
  };
};

/**
 * Creates an imposter billboard material with dithered dissolve.
 *
 * This material:
 * - Uses the pre-rendered imposter texture
 * - Respects texture alpha (for tree silhouette cutout)
 * - Adds distance-based dithered dissolve (matches 3D vegetation)
 * - Uses same lighting properties as 3D vegetation (roughness, metalness)
 *
 * The dissolve is achieved by dynamically adjusting the alpha test threshold:
 * - Close range: threshold = alphaTest (normal texture cutout)
 * - Far range: threshold increases, discarding more fragments via dither
 *
 * @param options - Imposter material configuration
 * @returns Material with dissolve shader and uniforms
 *
 * @example
 * ```ts
 * const material = createImposterMaterial({
 *   texture: preRenderedTexture,
 *   fadeStart: 300,  // Start dissolve at 300m
 *   fadeEnd: 350,    // Fully dissolved at 350m
 * });
 *
 * // Update player position each frame
 * material.imposterUniforms.playerPos.value.set(px, 0, pz);
 * ```
 */
export function createImposterMaterial(
  options: ImposterMaterialOptions,
): ImposterMaterial {
  const material = new MeshStandardNodeMaterial();

  // Set the pre-rendered texture
  material.map = options.texture;

  // ========== UNIFORMS ==========
  const uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
  // Store fade distances for runtime access (if needed)
  const fadeStartVal = options.fadeStart ?? 300;
  const fadeEndVal = options.fadeEnd ?? 350;
  const uFadeStart = uniform(fadeStartVal);
  const uFadeEnd = uniform(fadeEndVal);

  // ========== CONSTANTS (PRE-COMPUTED ON CPU) ==========
  // OPTIMIZATION: Pre-compute squared distances on CPU rather than per-fragment
  // These don't change at runtime, so avoid redundant GPU multiplication
  const fadeStartSq = float(fadeStartVal * fadeStartVal);
  const fadeEndSq = float(fadeEndVal * fadeEndVal);
  const baseAlphaThreshold = float(options.alphaTest ?? 0.5);

  // ========== ALPHA TEST (TEXTURE CUTOUT + DITHERED DISSOLVE) ==========
  // This combines two alpha test behaviors:
  // 1. Texture alpha cutout (for tree silhouette)
  // 2. Distance-based dithered dissolve (for LOD fade)
  //
  // The texture has alpha=0 for background, alpha=1 for tree.
  // alphaTestNode returns threshold: fragment discarded when texture.alpha < threshold
  //
  // - Close: threshold = baseAlphaThreshold (0.5) → normal cutout
  // - Far: threshold = baseAlphaThreshold + dissolve → even opaque pixels discard
  material.alphaTestNode = Fn(() => {
    const worldPos = positionWorld;

    // Distance calculation from world position to player (horizontal only, squared)
    const toPlayer = sub(worldPos, uPlayerPos);
    const distSq = add(
      mul(toPlayer.x, toPlayer.x),
      mul(toPlayer.z, toPlayer.z),
    );

    // FAR fade: 0.0 when close (keep), 1.0 when far (discard)
    const farFade = smoothstep(fadeStartSq, fadeEndSq, distSq);

    // SCREEN-SPACE 4x4 BAYER DITHERING (RuneScape 3 style)
    const ix = mod(floor(viewportCoordinate.x), float(4.0));
    const iy = mod(floor(viewportCoordinate.y), float(4.0));

    const bit0_x = mod(ix, float(2.0));
    const bit1_x = floor(mul(ix, float(0.5)));
    const bit0_y = mod(iy, float(2.0));
    const bit1_y = floor(mul(iy, float(0.5)));
    const xor0 = abs(sub(bit0_x, bit0_y));
    const xor1 = abs(sub(bit1_x, bit1_y));

    const bayerInt = add(
      add(
        add(mul(xor0, float(8.0)), mul(bit0_y, float(4.0))),
        mul(xor1, float(2.0)),
      ),
      bit1_y,
    );
    const ditherValue = mul(bayerInt, float(0.0625));

    // RS3-style: combine texture cutout with dithered distance fade
    // step returns 0 or 1, multiply by 2 so threshold > 1.0 causes discard
    // IMPORTANT: Only apply dithering when farFade > 0, otherwise step(0,0)=1 causes holes
    const hasAnyFade = step(float(0.001), farFade);
    const ditherDiscard = mul(
      mul(step(ditherValue, farFade), hasAnyFade),
      float(2.0),
    );
    const threshold = max(baseAlphaThreshold, ditherDiscard);

    return threshold;
  })();

  // ========== MATERIAL SETTINGS ==========
  // Match 3D vegetation material for consistent lighting
  material.roughness = 0.95;
  material.metalness = 0.0;
  material.side = THREE.DoubleSide;

  // Cutout rendering (not transparent blend) for performance
  material.transparent = false;
  material.opacity = 1.0;
  material.alphaTest = options.alphaTest ?? 0.5; // Fallback
  material.depthWrite = true;

  // ========== ATTACH UNIFORMS ==========
  const imposterMat = material as ImposterMaterial;
  imposterMat.imposterUniforms = {
    playerPos: uPlayerPos,
    fadeStart: uFadeStart,
    fadeEnd: uFadeEnd,
  };

  material.needsUpdate = true;
  return imposterMat;
}

/**
 * Check if a material is an imposter material.
 */
export function isImposterMaterial(
  material: THREE.Material | null | undefined,
): material is ImposterMaterial {
  return material != null && "imposterUniforms" in material;
}
