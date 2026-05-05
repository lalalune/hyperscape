/**
 * TerrainShader - TSL Node Material for stylized terrain
 * Biome textures via triplanar/top-down mapping, blended by height/slope/noise
 *
 * **SHARED CODE:**
 * The core terrain material is also available in @hyperforge/procgen TerrainGen module.
 * For standalone terrain rendering (Asset Forge, viewers), use:
 *   import { TerrainGen } from '@hyperforge/procgen';
 *   const material = TerrainGen.createTerrainMaterial();
 *
 * This file (TerrainShader.ts) includes additional game-specific integrations
 * like heightmap support, compute shader vertex colors, and road influence.
 */

import * as THREE from "../../../extras/three/three";
import {
  MeshStandardNodeMaterial,
  texture,
  positionWorld,
  normalWorld,
  screenUV,
  cameraPosition,
  attribute,
  uniform,
  float,
  vec2,
  vec3,
  vec4,
  add,
  sub,
  mul,
  div,
  dot,
  mix,
  smoothstep,
  step,
  abs,
  sin,
  cos,
  pow,
  clamp,
  max as tslMax,
  floor,
  normalize,
  Fn,
  output,
  type ShaderNode,
} from "../../../extras/three/three";
import { getRoadInfluenceTextureState } from "./RoadInfluenceMask";
import { getLamppostLightTextureState } from "./LamppostLightMask";
import { TERRAIN_CONSTANTS } from "../../../constants/GameConstants";
import { FOG_NEAR_SQ, FOG_FAR_SQ, fogRenderTarget } from "./FogConfig";

import { MINE_BIOME_PALETTES, ROAD_COLORS } from "../../../world/biome-colors";
import { SUN_LIGHT, SUN_SHADE } from "./LightingConfig";
import {
  TERRAIN_SHADER,
  TUNDRA,
  FOREST,
  CANYON,
  ACCENT,
} from "./TerrainConstants";
import {
  createPermutation,
  perlin2D,
  seamlessPerlin2D,
  seamlessFbm,
} from "../../../utils/noise/PerlinNoise";

export const TERRAIN_SHADER_CONSTANTS = {
  ...TERRAIN_SHADER,
  WATER_LEVEL: TERRAIN_CONSTANTS.WATER_THRESHOLD,
};

/**
 * Half-lambert anime shade: wraps N·L to [0,1] for soft fill, then
 * tints the shadow side with a cool blue-teal hue shift (Genshin-style).
 * Applied to albedo before PBR so the colour shift survives lighting.
 */
export const TERRAIN_SHADE = {
  TINT_COLOR: SUN_SHADE.TINT_COLOR,
  STRENGTH: 0.7,
  FRESNEL_POWER: 3.0,
  FRESNEL_INTENSITY: 0.2,
};

/**
 * Shared TSL anime shading: half-lambert cool tint + fresnel rim highlight.
 * Used by both terrain and grass so the shading stays in sync.
 */
export function applyAnimeShade(
  baseColor: any,
  normal: any,
  sunDirNode: any,
): any {
  const sDir = normalize(vec3(sunDirNode));
  const NdotL = dot(normal, sDir);
  const halfLambert = add(mul(NdotL, float(0.5)), float(0.5));
  const shadeFactor = sub(float(1.0), halfLambert);
  const coolTint = vec3(...TERRAIN_SHADE.TINT_COLOR);
  const tintedBase = mul(baseColor, coolTint);
  const shaded = mix(
    baseColor,
    tintedBase,
    mul(shadeFactor, float(TERRAIN_SHADE.STRENGTH)),
  );

  const viewDir = normalize(sub(positionWorld, cameraPosition));
  const rim = clamp(
    add(float(1.0), dot(viewDir, normal)),
    float(0.0),
    float(1.0),
  );
  const fresnelRim = mul(
    pow(rim, float(TERRAIN_SHADE.FRESNEL_POWER)),
    float(TERRAIN_SHADE.FRESNEL_INTENSITY),
  );
  return add(shaded, vec3(fresnelRim, fresnelRim, fresnelRim));
}

const TERRAIN_TEX_TILE = 0.3;
const TERRAIN_TEX_DIR = "textures/terrain-biomes";

const TERRAIN_BIOME_TEXTURES = {
  grass: {
    file: "grass.png",
    fallback: [0.28, 0.63, 0.2] as [number, number, number],
  },
  dirt: {
    file: "dirt.png",
    fallback: [0.55, 0.48, 0.36] as [number, number, number],
  },
  cliff: {
    file: "cliff.png",
    fallback: [0.71, 0.67, 0.6] as [number, number, number],
  },
  desertGrass: {
    file: "desertGrass.png",
    fallback: [0.51, 0.41, 0.28] as [number, number, number],
  },
  desertDirt: {
    file: "desertDirt.png",
    fallback: [0.54, 0.42, 0.32] as [number, number, number],
  },
  desertCliff: {
    file: "desertDirt.png",
    fallback: [0.54, 0.42, 0.32] as [number, number, number],
  },
  snowGrass: {
    file: "snowgrass.png",
    fallback: [0.79, 0.8, 0.8] as [number, number, number],
  },
  snowDirt: {
    file: "snowdirt.png",
    fallback: [0.78, 0.82, 0.84] as [number, number, number],
  },
  snowCliff: {
    file: "snowdirt.png",
    fallback: [0.78, 0.82, 0.84] as [number, number, number],
  },
};

function getCdnUrl(): string {
  if (typeof window !== "undefined") {
    const w = window as Window & { __CDN_URL?: string };
    if (w.__CDN_URL) return w.__CDN_URL;
    const meta = import.meta as ImportMeta & {
      env?: Record<string, string>;
    };
    if (meta.env?.PUBLIC_CDN_URL) return meta.env.PUBLIC_CDN_URL;
  }
  return "http://localhost:5555/game-assets";
}

function createTerrainBiomeTex(
  url: string,
  pr: number,
  pg: number,
  pb: number,
): THREE.Texture {
  let tex: THREE.Texture;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = `rgb(${Math.round(pr * 255)},${Math.round(pg * 255)},${Math.round(pb * 255)})`;
    ctx.fillRect(0, 0, 2, 2);
    tex = new THREE.Texture(canvas);
  } else {
    const data = new Uint8Array([
      Math.round(pr * 255),
      Math.round(pg * 255),
      Math.round(pb * 255),
      255,
    ]);
    tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  }
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  if (typeof window !== "undefined") {
    new THREE.TextureLoader().load(
      url,
      (loaded) => {
        tex.image = loaded.image;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      },
      undefined,
      (err) =>
        console.warn(
          `[TerrainShader] Failed to load ${url.split("/").pop()}:`,
          err,
        ),
    );
  }
  return tex;
}

// ============================================================================
// SHARED TERRAIN BASE COLOR (used by terrain shader AND tree ground-blend)
// ============================================================================

// --- Biome palettes from shared constants (TerrainConstants.ts) ---
const TUNDRA_GRASS = vec3(...TUNDRA.GRASS);
const TUNDRA_GRASS_DARK = vec3(...TUNDRA.GRASS_DARK);
const TUNDRA_GRASS_HIGH = vec3(...TUNDRA.GRASS_HIGH);
const TUNDRA_VARIATION = vec3(...TUNDRA.VARIATION);
const TUNDRA_DIRT = vec3(...TUNDRA.DIRT);
const TUNDRA_DIRT_DARK = vec3(...TUNDRA.DIRT_DARK);
const TUNDRA_CLIFF = vec3(...TUNDRA.CLIFF);
const TUNDRA_CLIFF_DARK = vec3(...TUNDRA.CLIFF_DARK);

const FOREST_GRASS = vec3(...FOREST.GRASS);
const FOREST_GRASS_DARK = vec3(...FOREST.GRASS_DARK);
const FOREST_GRASS_HIGH = vec3(...FOREST.GRASS_HIGH);
const FOREST_VARIATION = vec3(...FOREST.VARIATION);
const FOREST_DIRT = vec3(...FOREST.DIRT);
const FOREST_DIRT_DARK = vec3(...FOREST.DIRT_DARK);
const FOREST_CLIFF = vec3(...FOREST.CLIFF);
const FOREST_CLIFF_DARK = vec3(...FOREST.CLIFF_DARK);

const CANYON_SAND = vec3(...CANYON.SAND);
const CANYON_SAND_DARK = vec3(...CANYON.SAND_DARK);
const CANYON_SAND_HIGH = vec3(...CANYON.SAND_HIGH);
const CANYON_VARIATION = vec3(...CANYON.VARIATION);
const CANYON_ROCK = vec3(...CANYON.ROCK);
const CANYON_ROCK_DARK = vec3(...CANYON.ROCK_DARK);
const CANYON_CLIFF = vec3(...CANYON.CLIFF);
const CANYON_CLIFF_DARK = vec3(...CANYON.CLIFF_DARK);

const CLIFF_TINT = vec3(...ACCENT.CLIFF_TINT);

// Legacy aliases used by road overlay and other shader sections (default = forest)
const GRASS_GREEN = FOREST_GRASS;
const GRASS_DARK = FOREST_GRASS_DARK;
const DIRT_BROWN = FOREST_DIRT;
const DIRT_DARK = FOREST_DIRT_DARK;
const ROCK_GRAY = vec3(...ACCENT.ROCK_GRAY);
const ROCK_DARK = vec3(...ACCENT.ROCK_DARK);
const SAND_YELLOW = vec3(...ACCENT.SAND_YELLOW);
const SNOW_WHITE = vec3(...ACCENT.SNOW_WHITE);
const MUD_BROWN = vec3(...ACCENT.MUD_BROWN);
const WATER_EDGE = vec3(...ACCENT.WATER_EDGE);

/**
 * Compute the procedural terrain base color at a world position.
 * Uses noise-distorted coordinate mapping (ported from reference) for organic
 * cliff/dirt/shoreline boundaries instead of clean smoothstep bands.
 */
export function computeTerrainBaseColor(
  height: any,
  slope: any,
  noiseVal: any,
  noiseVal2: any,
  distortNoise: any,
  variationNoise: any,
  forestWeight?: any,
  canyonWeight?: any,
) {
  const fW = forestWeight ?? float(0.0);
  const dW = canyonWeight ?? float(0.0);
  const tW = sub(float(1.0), add(fW, dW));

  // Distorted slope: offset normalY by noise for organic cliff edges
  const distortedNY = add(
    sub(float(1.0), slope),
    mul(
      sub(distortNoise, float(0.5)),
      float(TERRAIN_SHADER_CONSTANTS.ROCK_DISTORT_STRENGTH),
    ),
  );
  const dSlope = sub(float(1.0), distortedNY);

  // Distorted height for organic sand/shoreline boundaries
  const dHeight = add(
    height,
    mul(
      sub(distortNoise, float(0.5)),
      float(TERRAIN_SHADER_CONSTANTS.HEIGHT_DISTORT_STRENGTH),
    ),
  );

  // Biome-blended grass
  const grassVariation = smoothstep(float(0.4), float(0.6), noiseVal2);
  const tundraGrass = mix(TUNDRA_GRASS, TUNDRA_GRASS_DARK, grassVariation);
  const forestGrass = mix(FOREST_GRASS, FOREST_GRASS_DARK, grassVariation);
  const canyonGrass = mix(CANYON_SAND, CANYON_SAND_DARK, grassVariation);
  let c: ShaderNode = add(
    add(mul(tundraGrass, tW), mul(forestGrass, fW)),
    mul(canyonGrass, dW),
  );

  // Height-based ground color gradient (subtle shift at altitude)
  const heightGrad = mul(
    smoothstep(float(25.0), float(55.0), height),
    float(0.3),
  );
  const grassHigh = add(
    add(mul(TUNDRA_GRASS_HIGH, tW), mul(FOREST_GRASS_HIGH, fW)),
    mul(CANYON_SAND_HIGH, dW),
  );
  c = mix(c, grassHigh, heightGrad);

  // Low-frequency ground variation overlay (patchy color areas)
  const gVar = clamp(
    pow(add(variationNoise, float(0.3)), float(5.0)),
    float(0.0),
    float(1.0),
  );
  const varColor = add(
    add(mul(TUNDRA_VARIATION, tW), mul(FOREST_VARIATION, fW)),
    mul(CANYON_VARIATION, dW),
  );
  c = mix(c, varColor, mul(gVar, float(0.25)));

  // Biome-blended dirt
  const dirtVariation = smoothstep(float(0.3), float(0.7), noiseVal2);
  const tundraDirt = mix(TUNDRA_DIRT, TUNDRA_DIRT_DARK, dirtVariation);
  const forestDirt = mix(FOREST_DIRT, FOREST_DIRT_DARK, dirtVariation);
  const canyonDirt = mix(CANYON_ROCK, CANYON_ROCK_DARK, dirtVariation);
  const dirtColor = add(
    add(mul(tundraDirt, tW), mul(forestDirt, fW)),
    mul(canyonDirt, dW),
  );

  // Per-biome cliff color with rock texture variation
  const cliffVariation = smoothstep(float(0.3), float(0.7), noiseVal);
  const tundraCliff = mix(TUNDRA_CLIFF, TUNDRA_CLIFF_DARK, cliffVariation);
  const forestCliff = mix(FOREST_CLIFF, FOREST_CLIFF_DARK, cliffVariation);
  const canyonCliff = mix(CANYON_CLIFF, CANYON_CLIFF_DARK, cliffVariation);
  let cliffColor: any = add(
    add(mul(tundraCliff, tW), mul(forestCliff, fW)),
    mul(canyonCliff, dW),
  );
  const rockTexVar = mul(pow(distortNoise, float(0.5)), float(0.3));
  cliffColor = mix(cliffColor, CLIFF_TINT, rockTexVar);

  // Noise-driven dirt patches on flat areas (using distorted slope)
  const nDirtFactor = mul(
    smoothstep(
      float(TERRAIN_SHADER_CONSTANTS.DIRT_THRESHOLD - 0.05),
      float(TERRAIN_SHADER_CONSTANTS.DIRT_THRESHOLD + 0.15),
      noiseVal,
    ),
    smoothstep(float(0.3), float(0.05), dSlope),
  );
  c = mix(c, dirtColor, nDirtFactor);

  // Dirt on moderate slopes (bell curve, using distorted slope)
  const dirtSlopeF = mul(
    smoothstep(float(0.15), float(0.4), dSlope),
    smoothstep(float(0.6), float(0.3), dSlope),
  );
  c = mix(c, dirtColor, mul(dirtSlopeF, float(0.6)));

  // Cliff on steep slopes (using distorted slope)
  c = mix(c, cliffColor, smoothstep(float(0.3), float(0.55), dSlope));

  // Sand near water (flat areas, stronger in canyon — using distorted height)
  const sandBlend = mul(
    smoothstep(float(18.0), float(12.0), dHeight),
    smoothstep(float(0.25), float(0.0), slope),
  );
  const sandStrength = mix(float(0.6), float(0.9), dW);
  c = mix(c, SAND_YELLOW, mul(sandBlend, sandStrength));

  // Shoreline transitions (using distorted height)
  c = mix(
    c,
    DIRT_DARK,
    mul(smoothstep(float(22.0), float(14.0), dHeight), float(0.4)),
  );
  c = mix(
    c,
    MUD_BROWN,
    mul(smoothstep(float(15.0), float(10.0), dHeight), float(0.7)),
  );
  c = mix(
    c,
    WATER_EDGE,
    mul(smoothstep(float(11.0), float(7.0), dHeight), float(0.9)),
  );

  // Saturation boost: pull color away from grey
  const luma = dot(c, vec3(0.299, 0.587, 0.114));
  const grey = vec3(luma, luma, luma);
  c = mix(grey, c, float(TERRAIN_SHADER_CONSTANTS.SATURATION_BOOST));

  return c;
}

// ============================================================================
// PERLIN NOISE TEXTURE GENERATION
// ============================================================================

// Cached noise texture - generated once, reused everywhere
let cachedNoiseTexture: THREE.DataTexture | null = null;
const NOISE_SIZE = TERRAIN_SHADER.NOISE_SIZE;

/**
 * Generate a Perlin noise texture - call once at startup
 * Returns a DataTexture that tiles seamlessly
 */
export function generateNoiseTexture(seed: number = 12345): THREE.DataTexture {
  if (cachedNoiseTexture) return cachedNoiseTexture;

  const perm = createPermutation(seed);
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);

  for (let y = 0; y < NOISE_SIZE; y++) {
    for (let x = 0; x < NOISE_SIZE; x++) {
      // Normalize to 0-1 range
      const nx = x / NOISE_SIZE;
      const ny = y / NOISE_SIZE;

      // Use seamless noise that tiles perfectly
      const noise = seamlessFbm(nx, ny, perm, 4);

      // Normalize from [-1, 1] to [0, 1]
      const value = (noise + 1) * 0.5;
      const byte = Math.floor(Math.max(0, Math.min(255, value * 255)));

      const idx = (y * NOISE_SIZE + x) * 4;
      data[idx] = byte; // R
      data[idx + 1] = byte; // G
      data[idx + 2] = byte; // B
      data[idx + 3] = 255; // A
    }
  }

  const tex = new THREE.DataTexture(
    data,
    NOISE_SIZE,
    NOISE_SIZE,
    THREE.RGBAFormat,
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;

  cachedNoiseTexture = tex;
  console.log("[TerrainShader] Generated seamless Perlin noise texture");
  return tex;
}

/**
 * Get the cached noise texture (for GrassSystem alignment)
 */
export function getNoiseTexture(): THREE.DataTexture | null {
  return cachedNoiseTexture;
}

// Cached permutation for CPU sampling
let cachedPerm: number[] | null = null;

/**
 * Sample noise at world position (for CPU-side grass placement)
 * Returns 0-1 value matching EXACTLY what the shader samples from the texture
 */
export function sampleNoiseAtPosition(
  worldX: number,
  worldZ: number,
  seed: number = 12345,
): number {
  // Ensure permutation is created
  if (!cachedPerm) {
    cachedPerm = createPermutation(seed);
  }

  // Calculate UV the same way the shader does
  const u = worldX * TERRAIN_SHADER_CONSTANTS.NOISE_SCALE;
  const v = worldZ * TERRAIN_SHADER_CONSTANTS.NOISE_SCALE;

  // The texture tiles, so wrap to 0-1
  const wrappedU = u - Math.floor(u);
  const wrappedV = v - Math.floor(v);

  // Sample the same seamless noise function used to generate the texture
  const noise = seamlessFbm(wrappedU, wrappedV, cachedPerm, 4);
  return (noise + 1) * 0.5;
}

/**
 * Check if terrain at a given position should display as grass (green).
 * Uses the same logic as the terrain shader to determine surface type.
 *
 * Grass appears when:
 * - Not in a dirt patch (noise-based brown areas)
 * - Not on steep slopes (dirt/rock)
 * - Not in natural shoreline zone (near water level)
 * - Below snow line (height < 45)
 *
 * Note: Flat zones (buildings, arenas) should always have grass regardless of height,
 * since they're artificial surfaces. Detected by very low slope.
 *
 * @param worldX - World X position
 * @param worldZ - World Z position
 * @param height - Terrain height at position (Y value)
 * @param slope - Terrain slope at position (0-1, where 0 is flat, 1 is vertical)
 * @param seed - Noise seed (default 12345)
 * @returns Value from 0-1 indicating how "grassy" the terrain is (1 = full grass, 0 = no grass)
 */
export function getGrassiness(
  _worldX: number,
  _worldZ: number,
  height: number,
  slope: number,
  _seed: number = 12345,
): number {
  // SIMPLIFIED: Grow grass almost everywhere except steep rock and snow.
  // The terrain shader handles visual color blending (grass/dirt), so we don't
  // need to match it exactly. Grass should appear on ALL green-ish terrain.
  //
  // Only exclude:
  // 1. Very steep slopes (rock faces) - slope > 0.6
  // 2. Snow at high elevation - height > 45m
  //
  // DO NOT exclude based on:
  // - Dirt patches (they're brownish-green blend, still have grass)
  // - Shoreline (complex, inconsistent water levels)
  // - Moderate slopes (grass grows on hills)

  let grassiness = 1.0;

  // === VERY STEEP SLOPES = ROCK ===
  // Only exclude on truly vertical rock faces (slope > 0.6)
  // Gentler slopes (up to 0.6) should have grass
  if (slope > 0.6) {
    const rockFactor = smoothstepCPU(0.6, 0.8, slope);
    grassiness -= rockFactor;
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, grassiness));
}

/**
 * CPU-side smoothstep matching GLSL behavior
 */
function smoothstepCPU(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Calculate terrain slope from height samples.
 * Uses central difference method with 4 neighboring samples.
 *
 * @param getHeight - Function to get terrain height at (x, z)
 * @param x - World X position
 * @param z - World Z position
 * @param sampleDistance - Distance between height samples (default 1.0m)
 * @returns Slope value from 0 (flat) to 1 (vertical)
 */
export function calculateSlope(
  getHeight: (x: number, z: number) => number,
  x: number,
  z: number,
  sampleDistance: number = 1.0,
): number {
  // Sample heights at neighboring points
  const hPosX = getHeight(x + sampleDistance, z);
  const hNegX = getHeight(x - sampleDistance, z);
  const hPosZ = getHeight(x, z + sampleDistance);
  const hNegZ = getHeight(x, z - sampleDistance);

  // Calculate gradients using central difference
  const dhdx = (hPosX - hNegX) / (2 * sampleDistance);
  const dhdz = (hPosZ - hNegZ) / (2 * sampleDistance);

  // Gradient magnitude
  const gradientMag = Math.sqrt(dhdx * dhdx + dhdz * dhdz);

  // Convert to slope (matching shader's: slope = 1 - abs(normal.y))
  // normal.y = 1 / sqrt(1 + gradientMag^2)
  const normalY = 1 / Math.sqrt(1 + gradientMag * gradientMag);
  const slope = 1 - Math.abs(normalY);

  return slope;
}

// ============================================================================
// CPU TERRAIN COLOR — mirrors computeTerrainBaseColor() for grass placement
// ============================================================================

type RGB = { r: number; g: number; b: number };

// sRGB channel → linear.  GPU auto-converts SRGBColorSpace textures to linear
// before any math.  All CPU constants must also be in linear so the blending
// (mixRGB / blendBiome / darken) produces identical results to the GPU shader.
function srgbCh(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const lin = (r: number, g: number, b: number): RGB => ({
  r: srgbCh(r),
  g: srgbCh(g),
  b: srgbCh(b),
});

// GPU shader darkens textures by multiplying with TEX_DARKEN (0.65).
const TEX_DARKEN_CPU = 0.65;
const darken = (c: RGB): RGB => ({
  r: c.r * TEX_DARKEN_CPU,
  g: c.g * TEX_DARKEN_CPU,
  b: c.b * TEX_DARKEN_CPU,
});

// Texture-matching constants: sRGB fallback values → linear via lin().
// Non-texture constants: raw linear values matching GPU vec3() exactly.

// Tundra/snow — snowgrass.png avg sRGB (0.79, 0.80, 0.80)
const _TUNDRA_GRASS: RGB = lin(0.79, 0.8, 0.8);
const _TUNDRA_GRASS_DARK: RGB = darken(_TUNDRA_GRASS);
const _TUNDRA_GRASS_HIGH: RGB = { r: 0.68, g: 0.72, b: 0.78 };
const _TUNDRA_VARIATION: RGB = { r: 0.6, g: 0.64, b: 0.7 };
// snowdirt.png avg sRGB (0.78, 0.82, 0.84)
const _TUNDRA_DIRT: RGB = lin(0.78, 0.82, 0.84);
const _TUNDRA_DIRT_DARK: RGB = darken(_TUNDRA_DIRT);
const _TUNDRA_CLIFF: RGB = lin(0.78, 0.82, 0.84);
const _TUNDRA_CLIFF_DARK: RGB = darken(_TUNDRA_CLIFF);

// Forest — grass.png avg sRGB (0.39, 0.52, 0.24)
const _FOREST_GRASS: RGB = lin(0.39, 0.52, 0.24);
const _FOREST_GRASS_DARK: RGB = darken(_FOREST_GRASS);
const _FOREST_GRASS_HIGH: RGB = { r: 0.24, g: 0.45, b: 0.18 };
const _FOREST_VARIATION: RGB = { r: 0.15, g: 0.35, b: 0.1 };
// dirt.png avg sRGB (0.55, 0.48, 0.36)
const _FOREST_DIRT: RGB = lin(0.55, 0.48, 0.36);
const _FOREST_DIRT_DARK: RGB = darken(_FOREST_DIRT);
// cliff.png avg sRGB (0.71, 0.67, 0.60)
const _FOREST_CLIFF: RGB = lin(0.71, 0.67, 0.6);
const _FOREST_CLIFF_DARK: RGB = darken(_FOREST_CLIFF);

// Canyon/desert — desertGrass.png avg sRGB (0.51, 0.41, 0.28)
const _CANYON_SAND: RGB = lin(0.51, 0.41, 0.28);
const _CANYON_SAND_DARK: RGB = darken(_CANYON_SAND);
const _CANYON_SAND_HIGH: RGB = { r: 0.62, g: 0.38, b: 0.22 };
const _CANYON_VARIATION: RGB = { r: 0.58, g: 0.34, b: 0.16 };
// desertDirt.png avg sRGB (0.54, 0.42, 0.32)
const _CANYON_ROCK: RGB = lin(0.54, 0.42, 0.32);
const _CANYON_ROCK_DARK: RGB = darken(_CANYON_ROCK);
const _CANYON_CLIFF: RGB = lin(0.54, 0.42, 0.32);
const _CANYON_CLIFF_DARK: RGB = darken(_CANYON_CLIFF);

const _CLIFF_TINT: RGB = { r: 0.28, g: 0.3, b: 0.36 };
const _SAND_YELLOW: RGB = { r: 0.7, g: 0.6, b: 0.38 };
const _DIRT_DARK_CPU: RGB = { r: 0.22, g: 0.15, b: 0.08 };
const _MUD_BROWN: RGB = { r: 0.18, g: 0.12, b: 0.08 };
const _WATER_EDGE: RGB = { r: 0.08, g: 0.06, b: 0.04 };

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function blendBiome(
  tundra: RGB,
  forest: RGB,
  canyon: RGB,
  tW: number,
  fW: number,
  dW: number,
): RGB {
  return {
    r: tundra.r * tW + forest.r * fW + canyon.r * dW,
    g: tundra.g * tW + forest.g * fW + canyon.g * dW,
    b: tundra.b * tW + forest.b * fW + canyon.b * dW,
  };
}

function sampleNoiseCPU(worldX: number, worldZ: number, scale: number): number {
  const tex = cachedNoiseTexture;
  if (tex?.image?.data) {
    const data = tex.image.data as Uint8Array;
    const u = worldX * scale;
    const v = worldZ * scale;
    // Bilinear sample matching GPU's LinearFilter + RepeatWrapping
    const px = (((u % 1) + 1) % 1) * NOISE_SIZE - 0.5;
    const py = (((v % 1) + 1) % 1) * NOISE_SIZE - 0.5;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const fx = px - x0;
    const fy = py - y0;
    const ix0 = ((x0 % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
    const iy0 = ((y0 % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
    const ix1 = (ix0 + 1) % NOISE_SIZE;
    const iy1 = (iy0 + 1) % NOISE_SIZE;
    const v00 = data[(iy0 * NOISE_SIZE + ix0) * 4] / 255;
    const v10 = data[(iy0 * NOISE_SIZE + ix1) * 4] / 255;
    const v01 = data[(iy1 * NOISE_SIZE + ix0) * 4] / 255;
    const v11 = data[(iy1 * NOISE_SIZE + ix1) * 4] / 255;
    return (
      v00 * (1 - fx) * (1 - fy) +
      v10 * fx * (1 - fy) +
      v01 * (1 - fx) * fy +
      v11 * fx * fy
    );
  }
  // Fallback: direct computation if texture not yet generated
  if (!cachedPerm) cachedPerm = createPermutation(12345);
  const u = worldX * scale;
  const v = worldZ * scale;
  const wu = u - Math.floor(u);
  const wv = v - Math.floor(v);
  return (seamlessFbm(wu, wv, cachedPerm, 4) + 1) * 0.5;
}

/**
 * CPU mirror of the GPU `computeTerrainBaseColor()`.
 * Returns the procedural terrain color AND a grassWeight (0-1) indicating
 * how much of the surface is "grass texture" vs dirt/cliff/sand/shoreline.
 */
export function computeTerrainColorCPU(
  worldX: number,
  worldZ: number,
  height: number,
  slope: number,
  forestW: number,
  canyonW: number,
): { r: number; g: number; b: number; grassWeight: number } {
  const fW = forestW;
  const dW = canyonW;
  const tW = 1 - fW - dW;

  const noiseVal = sampleNoiseCPU(
    worldX,
    worldZ,
    TERRAIN_SHADER_CONSTANTS.NOISE_SCALE,
  );
  const noiseVal2 = Math.sin(noiseVal * 6.28) * 0.3 + 0.5;
  const distortN = sampleNoiseCPU(
    worldX,
    worldZ,
    TERRAIN_SHADER_CONSTANTS.DISTORT_NOISE_SCALE,
  );
  const variationN = sampleNoiseCPU(
    worldX,
    worldZ,
    TERRAIN_SHADER_CONSTANTS.VARIATION_NOISE_SCALE,
  );

  const distortedNY =
    1 -
    slope +
    (distortN - 0.5) * TERRAIN_SHADER_CONSTANTS.ROCK_DISTORT_STRENGTH;
  const dSlope = 1 - distortedNY;
  const dHeight =
    height +
    (distortN - 0.5) * TERRAIN_SHADER_CONSTANTS.HEIGHT_DISTORT_STRENGTH;

  // Biome-blended grass
  const grassVar = smoothstepCPU(0.4, 0.6, noiseVal2);
  const tundraGrass = mixRGB(_TUNDRA_GRASS, _TUNDRA_GRASS_DARK, grassVar);
  const forestGrass = mixRGB(_FOREST_GRASS, _FOREST_GRASS_DARK, grassVar);
  const canyonGrass = mixRGB(_CANYON_SAND, _CANYON_SAND_DARK, grassVar);
  let c = blendBiome(tundraGrass, forestGrass, canyonGrass, tW, fW, dW);

  // Height-based gradient
  const heightGrad = smoothstepCPU(25, 55, height) * 0.3;
  const grassHigh = blendBiome(
    _TUNDRA_GRASS_HIGH,
    _FOREST_GRASS_HIGH,
    _CANYON_SAND_HIGH,
    tW,
    fW,
    dW,
  );
  c = mixRGB(c, grassHigh, heightGrad);

  // Low-frequency variation
  const gVar = Math.max(0, Math.min(1, Math.pow(variationN + 0.3, 5)));
  const varColor = blendBiome(
    _TUNDRA_VARIATION,
    _FOREST_VARIATION,
    _CANYON_VARIATION,
    tW,
    fW,
    dW,
  );
  c = mixRGB(c, varColor, gVar * 0.25);

  // Biome-blended dirt
  const dirtVar = smoothstepCPU(0.3, 0.7, noiseVal2);
  const dirtColor = blendBiome(
    mixRGB(_TUNDRA_DIRT, _TUNDRA_DIRT_DARK, dirtVar),
    mixRGB(_FOREST_DIRT, _FOREST_DIRT_DARK, dirtVar),
    mixRGB(_CANYON_ROCK, _CANYON_ROCK_DARK, dirtVar),
    tW,
    fW,
    dW,
  );

  // Biome-blended cliff
  const cliffVar = smoothstepCPU(0.3, 0.7, noiseVal);
  let cliffColor = blendBiome(
    mixRGB(_TUNDRA_CLIFF, _TUNDRA_CLIFF_DARK, cliffVar),
    mixRGB(_FOREST_CLIFF, _FOREST_CLIFF_DARK, cliffVar),
    mixRGB(_CANYON_CLIFF, _CANYON_CLIFF_DARK, cliffVar),
    tW,
    fW,
    dW,
  );
  const rockTexV = Math.pow(distortN, 0.5) * 0.3;
  cliffColor = mixRGB(cliffColor, _CLIFF_TINT, rockTexV);

  // Track grass weight: starts at 1, reduced by each non-grass layer
  let grassWeight = 1.0;

  // Dirt patches on flat areas
  const nDirtF =
    smoothstepCPU(
      TERRAIN_SHADER_CONSTANTS.DIRT_THRESHOLD - 0.05,
      TERRAIN_SHADER_CONSTANTS.DIRT_THRESHOLD + 0.15,
      noiseVal,
    ) * smoothstepCPU(0.3, 0.05, dSlope);
  c = mixRGB(c, dirtColor, nDirtF);
  grassWeight -= nDirtF;

  // Dirt on moderate slopes
  const dirtSlopeF =
    smoothstepCPU(0.15, 0.4, dSlope) * smoothstepCPU(0.6, 0.3, dSlope) * 0.6;
  c = mixRGB(c, dirtColor, dirtSlopeF);
  grassWeight -= dirtSlopeF;

  // Cliff on steep slopes
  const cliffF = smoothstepCPU(0.3, 0.55, dSlope);
  c = mixRGB(c, cliffColor, cliffF);
  grassWeight -= cliffF;

  // Sand near water
  const sandBlend =
    smoothstepCPU(18, 12, dHeight) * smoothstepCPU(0.25, 0.0, slope);
  const sandStr = 0.6 + (0.9 - 0.6) * dW;
  const sandF = sandBlend * sandStr;
  c = mixRGB(c, _SAND_YELLOW, sandF);
  grassWeight -= sandF;

  // Shoreline transitions
  const shore1 = smoothstepCPU(22, 14, dHeight) * 0.4;
  c = mixRGB(c, _DIRT_DARK_CPU, shore1);
  grassWeight -= shore1;

  const shore2 = smoothstepCPU(15, 10, dHeight) * 0.7;
  c = mixRGB(c, _MUD_BROWN, shore2);
  grassWeight -= shore2;

  const shore3 = smoothstepCPU(11, 7, dHeight) * 0.9;
  c = mixRGB(c, _WATER_EDGE, shore3);
  grassWeight -= shore3;

  // Saturation boost
  const luma = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  const sat = TERRAIN_SHADER_CONSTANTS.SATURATION_BOOST;
  c = {
    r: luma + (c.r - luma) * sat,
    g: luma + (c.g - luma) * sat,
    b: luma + (c.b - luma) * sat,
  };

  return {
    r: c.r,
    g: c.g,
    b: c.b,
    grassWeight: Math.max(0, Math.min(1, grassWeight)),
  };
}

// ============================================================================
// TERRAIN MATERIAL - classic MMORPG Style (No Textures)
// ============================================================================

/**
 * Maximum number of vertex lights supported
 * Keep low for performance - vertex lighting is cheap but not free
 */
export const MAX_VERTEX_LIGHTS = 8;

export type TerrainUniforms = {
  sunPosition: { value: THREE.Vector3 };
  sunDirection: { value: THREE.Vector3 };
  time: { value: number };
  fogEnabled: { value: number }; // 1.0 = fog enabled, 0.0 = fog disabled (for minimap)
  dayIntensity: { value: number }; // 0 = night, 1 = day
  // Vertex lighting uniforms (lampposts, etc.) — absent when includeVertexLighting=false
  vertexLightPositions?: { value: THREE.Vector3 }[]; // Array of 8 light positions
  vertexLightColors?: { value: THREE.Vector3 }[]; // Array of 8 light colors
  vertexLightParams?: { value: THREE.Vector2 }[]; // Array of 8 (intensity, range) pairs
};

/**
 * Vertex light data for updating terrain lighting
 */
export interface VertexLight {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  range: number;
}

/**
 * Update terrain vertex lights from lamppost positions
 * Call this when player moves to update nearby lights
 */
export function updateTerrainVertexLights(
  uniforms: TerrainUniforms,
  lights: VertexLight[],
): void {
  if (!uniforms.vertexLightPositions) return; // No vertex lighting (editor mode)
  const count = Math.min(lights.length, MAX_VERTEX_LIGHTS);

  for (let i = 0; i < MAX_VERTEX_LIGHTS; i++) {
    if (i < count) {
      const light = lights[i];
      uniforms.vertexLightPositions[i].value.copy(light.position);
      uniforms.vertexLightColors![i].value.set(
        light.color.r,
        light.color.g,
        light.color.b,
      );
      uniforms.vertexLightParams![i].value.set(light.intensity, light.range);
    } else {
      // Disable unused lights by setting intensity to 0
      uniforms.vertexLightParams![i].value.set(0, 1);
    }
  }
}

/**
 * Options for createTerrainMaterial — "one system, two contexts."
 * The game uses defaults. The editor overrides attribute format and disables
 * game-specific features (vertex lighting, river proximity) it doesn't have.
 */
export interface TerrainMaterialOptions {
  /** Read biome weights from packed terrainBlend (vec4) + biomeData (vec2)
   *  instead of separate float attributes. Used by World Studio editor. */
  packedAttributes?: boolean;
  /** Include 8-light vertex lighting for lampposts/torches (default: true) */
  includeVertexLighting?: boolean;
  /** Include river bed/bank coloring from riverProximity attribute (default: true) */
  includeRiverProximity?: boolean;
  /** Enable distance fog (default: true). Disable for editor at altitude. */
  fogEnabled?: boolean;
  /** Override texture base URL (default: CDN). Editor serves from asset-forge API. */
  textureBaseUrl?: string;
  /**
   * Phase C4 first cut — N-channel base color from per-vertex RGB.
   *
   * When `true`, the material reads `baseColor` directly from the
   * per-vertex `color` attribute (already populated by
   * `terrainHelpers.generateTileGeometry()` from the runtime
   * content registry's biome colors) and SKIPS the 3-biome
   * tundra/forest/canyon texture-blend pipeline entirely. Works
   * for projects with any number of biomes (5 tropical, 5 arctic,
   * 21 themed mix) — the per-vertex RGB is the single source of
   * truth for ground color.
   *
   * When `false` (default — Hyperia game pipeline path), the
   * shader uses the existing 3-channel texture blend with
   * tundra/forest/canyon grass + dirt + cliff textures, weighted
   * by `biomeForestWeight` + `biomeCanyonWeight` per-vertex
   * attributes (tundra weight implicit = 1 - fW - cW). This is
   * the textured path that gives Hyperia's distinctive
   * snowy-mountain / forest / canyon look.
   *
   * Downstream effects (sand-near-water, shoreline, river bed,
   * road overlay, mine overlay, lighting, fog) apply in BOTH
   * paths — they're height- / influence- / lighting-driven, not
   * biome-textured.
   *
   * Phase C4 follow-up replaces this with a true N-channel
   * texture-array path so non-Hyperia themed packs can ship
   * their own grass/dirt/cliff textures (palm-grove sand,
   * basalt cliff, snow-pine bark, etc.). Today: vertex color
   * only — visibly correct biome tints, no per-biome surface
   * textures.
   */
  useVertexColorBase?: boolean;
}

/**
 * Stylized terrain material with biome texture sampling
 * Grass/dirt textures use top-down projection; cliff textures use triplanar mapping
 */
export function createTerrainMaterial(
  options: TerrainMaterialOptions = {},
): THREE.Material & {
  terrainUniforms: TerrainUniforms;
} {
  const {
    packedAttributes = false,
    includeVertexLighting = true,
    includeRiverProximity = true,
    fogEnabled = true,
    textureBaseUrl,
    useVertexColorBase = false,
  } = options;

  // Ensure noise texture is generated (still used for dirt patch variation)
  const noiseTex = generateNoiseTexture();

  const sunPositionUniform = uniform(vec3(100, 100, 100));
  const sunDirectionUniform = uniform(vec3(...SUN_LIGHT.DEFAULT_DIRECTION));
  const timeUniform = uniform(float(0));
  const noiseScale = uniform(float(TERRAIN_SHADER_CONSTANTS.NOISE_SCALE));

  // Sky-color fog: uses the shared render target texture (updated in-place by SkySystem)
  // When fogEnabled=false (editor), skip fog texture entirely — editor has no SkySystem.
  const fogTexNode = fogEnabled
    ? texture(fogRenderTarget.texture, screenUV)
    : null;
  const fogEnabledUniform = uniform(float(fogEnabled ? 1.0 : 0.0));

  // ============================================================================
  // VERTEX LIGHTING UNIFORMS (for lampposts, torches, etc.)
  // ============================================================================
  // Create arrays of uniforms for each light
  const vertexLightPositionUniforms: ReturnType<typeof uniform>[] = [];
  const vertexLightColorUniforms: ReturnType<typeof uniform>[] = [];
  const vertexLightParamUniforms: ReturnType<typeof uniform>[] = []; // (intensity, range)

  if (includeVertexLighting) {
    for (let i = 0; i < MAX_VERTEX_LIGHTS; i++) {
      vertexLightPositionUniforms.push(uniform(vec3(0, 0, 0)));
      vertexLightColorUniforms.push(uniform(vec3(1, 0.9, 0.6))); // Warm lamplight default
      vertexLightParamUniforms.push(uniform(vec2(0, 15))); // intensity=0 (off), range=15m
    }
  }

  const worldPos = positionWorld;
  const worldNormal = normalWorld;
  const height = worldPos.y;
  const slope = sub(float(1.0), abs(worldNormal.y));

  // ============================================================================
  // TERRAIN BASE COLOR (shared function + anti-dithering noise)
  // ============================================================================

  const toCamera = sub(worldPos, cameraPosition);
  const distSq = dot(toCamera, toCamera);

  // Sample Perlin noise
  const noiseUV = mul(vec2(worldPos.x, worldPos.z), noiseScale);
  const noiseValue = texture(noiseTex, noiseUV).r;
  const noiseValue2 = add(
    mul(sin(mul(noiseValue, float(6.28))), float(0.3)),
    float(0.5),
  );

  // Distortion noise (high-freq) for organic cliff/shoreline edges
  const distortNoiseUV = mul(
    vec2(worldPos.x, worldPos.z),
    float(TERRAIN_SHADER_CONSTANTS.DISTORT_NOISE_SCALE),
  );
  const distortNoise = texture(noiseTex, distortNoiseUV).r;

  // Variation noise (low-freq) for large-scale ground color patches
  const variationNoiseUV = mul(
    vec2(worldPos.x, worldPos.z),
    float(TERRAIN_SHADER_CONSTANTS.VARIATION_NOISE_SCALE),
  );
  const variationNoise = texture(noiseTex, variationNoiseUV).r;

  // Fine detail noise (LOD-gated)
  const closeEnough = smoothstep(float(12000.0), float(8000.0), distSq);
  const noiseUV3 = mul(vec2(worldPos.x, worldPos.z), float(0.12));
  const fineNoiseSample = texture(noiseTex, noiseUV3).r;
  const fineNoise = mix(float(0.5), fineNoiseSample, closeEnough);
  const microNoise = add(
    mul(cos(mul(noiseValue, float(12.56))), float(0.2)),
    float(0.5),
  );

  // Biome weight attributes — packed (editor) or separate (game)
  let fW: any, dW: any;
  if (packedAttributes) {
    const terrainBlend = attribute("terrainBlend", "vec4");
    fW = terrainBlend.x;
    dW = terrainBlend.y;
  } else {
    fW = attribute("biomeForestWeight", "float");
    dW = attribute("biomeCanyonWeight", "float");
  }
  const tW = sub(float(1.0), add(fW, dW));

  // --- TERRAIN BIOME TEXTURES ---
  const texBase = textureBaseUrl || `${getCdnUrl()}/${TERRAIN_TEX_DIR}`;
  const loadBiomeTex = (key: keyof typeof TERRAIN_BIOME_TEXTURES) => {
    const cfg = TERRAIN_BIOME_TEXTURES[key];
    return createTerrainBiomeTex(`${texBase}/${cfg.file}`, ...cfg.fallback);
  };

  const tGrass = loadBiomeTex("grass");
  const tDirt = loadBiomeTex("dirt");
  const tCliff = loadBiomeTex("cliff");
  const tDesertGrass = loadBiomeTex("desertGrass");
  const tDesertDirt = loadBiomeTex("desertDirt");
  const tDesertCliff = loadBiomeTex("desertCliff");
  const tSnowGrass = loadBiomeTex("snowGrass");
  const tSnowDirt = loadBiomeTex("snowDirt");
  const tSnowCliff = loadBiomeTex("snowCliff");

  // UV projections — dual-scale blend to break visible texture tiling.
  // Sample at primary scale and a non-harmonic secondary scale (×0.27),
  // blend 50/50 with noise so the two grids never visually align.
  const tileScale = float(TERRAIN_TEX_TILE);
  const tileScale2 = float(TERRAIN_TEX_TILE * 0.13);
  const uvFlat = mul(vec2(worldPos.x, worldPos.z), tileScale);
  const uvFront = mul(vec2(worldPos.x, worldPos.y), tileScale);
  const uvSide = mul(vec2(worldPos.z, worldPos.y), tileScale);
  const uvFlat2 = mul(vec2(worldPos.x, worldPos.z), tileScale2);
  const uvFront2 = mul(vec2(worldPos.x, worldPos.y), tileScale2);
  const uvSide2 = mul(vec2(worldPos.z, worldPos.y), tileScale2);
  const tileBlend = smoothstep(float(0.2), float(0.8), noiseValue);

  // Triplanar blend weights for cliff textures (^4 sharpening)
  const tnx = abs(worldNormal.x);
  const tny = abs(worldNormal.y);
  const tnz = abs(worldNormal.z);
  const tw4x = mul(mul(tnx, tnx), mul(tnx, tnx));
  const tw4y = mul(mul(tny, tny), mul(tny, tny));
  const tw4z = mul(mul(tnz, tnz), mul(tnz, tnz));
  const twSum = add(add(tw4x, tw4y), tw4z);
  const twX = div(tw4x, twSum);
  const twY = div(tw4y, twSum);
  const twZ = div(tw4z, twSum);

  // Flat textures — blend two scales per biome texture
  const dualFlat = (t: THREE.Texture) =>
    mix(texture(t, uvFlat).rgb, texture(t, uvFlat2).rgb, tileBlend);
  const sGrass = dualFlat(tGrass);
  const sDirt = dualFlat(tDirt);
  const sDesertGrass = dualFlat(tDesertGrass);
  const sDesertDirt = dualFlat(tDesertDirt);
  const sSnowGrass = dualFlat(tSnowGrass);
  const sSnowDirt = dualFlat(tSnowDirt);

  // Cliff textures — triplanar with dual-scale blend
  const triCliff = (t: THREE.Texture) => {
    const s1 = add(
      add(mul(texture(t, uvFlat).rgb, twY), mul(texture(t, uvSide).rgb, twX)),
      mul(texture(t, uvFront).rgb, twZ),
    );
    const s2 = add(
      add(mul(texture(t, uvFlat2).rgb, twY), mul(texture(t, uvSide2).rgb, twX)),
      mul(texture(t, uvFront2).rgb, twZ),
    );
    return mix(s1, s2, tileBlend);
  };
  const sCliff = triCliff(tCliff);
  const sDesertCliff = triCliff(tDesertCliff);
  const sSnowCliff = triCliff(tSnowCliff);

  const TEX_DARKEN = float(0.65);

  // Distorted slope: offset normalY by noise for organic cliff edges
  const distortedNY = add(
    abs(worldNormal.y),
    mul(
      sub(distortNoise, float(0.5)),
      float(TERRAIN_SHADER_CONSTANTS.ROCK_DISTORT_STRENGTH),
    ),
  );
  const dSlope = sub(float(1.0), distortedNY);

  // Distorted height for organic sand/shoreline boundaries
  const dHeight = add(
    height,
    mul(
      sub(distortNoise, float(0.5)),
      float(TERRAIN_SHADER_CONSTANTS.HEIGHT_DISTORT_STRENGTH),
    ),
  );

  // Biome-blended grass (textured)
  const grassVar = smoothstep(float(0.4), float(0.6), noiseValue2);
  const tundraGrassC = mix(sSnowGrass, mul(sSnowGrass, TEX_DARKEN), grassVar);
  const forestGrassC = mix(sGrass, mul(sGrass, TEX_DARKEN), grassVar);
  const canyonGrassC = mix(
    sDesertGrass,
    mul(sDesertGrass, TEX_DARKEN),
    grassVar,
  );
  let baseColor: ShaderNode = add(
    add(mul(tundraGrassC, tW), mul(forestGrassC, fW)),
    mul(canyonGrassC, dW),
  );

  // Height-based ground color gradient (subtle shift at altitude)
  const heightGrad = mul(
    smoothstep(float(25.0), float(55.0), height),
    float(0.3),
  );
  const grassHighC = add(
    add(mul(TUNDRA_GRASS_HIGH, tW), mul(FOREST_GRASS_HIGH, fW)),
    mul(CANYON_SAND_HIGH, dW),
  );
  baseColor = mix(baseColor, grassHighC, heightGrad);

  // Low-frequency ground variation overlay (patchy color areas)
  const gVariation = clamp(
    pow(add(variationNoise, float(0.3)), float(5.0)),
    float(0.0),
    float(1.0),
  );
  const varColorC = add(
    add(mul(TUNDRA_VARIATION, tW), mul(FOREST_VARIATION, fW)),
    mul(CANYON_VARIATION, dW),
  );
  baseColor = mix(baseColor, varColorC, mul(gVariation, float(0.25)));

  // Biome-blended dirt
  const dirtVar = smoothstep(float(0.3), float(0.7), noiseValue2);
  const tundraDirtC = mix(sSnowDirt, mul(sSnowDirt, TEX_DARKEN), dirtVar);
  const forestDirtC = mix(sDirt, mul(sDirt, TEX_DARKEN), dirtVar);
  const canyonDirtC = mix(sDesertDirt, mul(sDesertDirt, TEX_DARKEN), dirtVar);
  const dirtColor = add(
    add(mul(tundraDirtC, tW), mul(forestDirtC, fW)),
    mul(canyonDirtC, dW),
  );

  // Per-biome cliff with rock texture variation
  const cliffVar = smoothstep(float(0.3), float(0.7), noiseValue);
  const tundraCliffC = mix(sSnowCliff, mul(sSnowCliff, TEX_DARKEN), cliffVar);
  const forestCliffC = mix(sCliff, mul(sCliff, TEX_DARKEN), cliffVar);
  const canyonCliffC = mix(
    sDesertCliff,
    mul(sDesertCliff, TEX_DARKEN),
    cliffVar,
  );
  let cliffColor: any = add(
    add(mul(tundraCliffC, tW), mul(forestCliffC, fW)),
    mul(canyonCliffC, dW),
  );
  const rockTexVarC = mul(pow(distortNoise, float(0.5)), float(0.3));
  cliffColor = mix(cliffColor, CLIFF_TINT, rockTexVarC);

  // Noise-driven dirt patches on flat areas (using distorted slope)
  const dirtPatchFactor = smoothstep(
    float(TERRAIN_SHADER_CONSTANTS.DIRT_THRESHOLD - 0.05),
    float(TERRAIN_SHADER_CONSTANTS.DIRT_THRESHOLD + 0.15),
    noiseValue,
  );
  const flatnessFactor = smoothstep(float(0.3), float(0.05), dSlope);
  baseColor = mix(baseColor, dirtColor, mul(dirtPatchFactor, flatnessFactor));

  // Dirt on moderate slopes (bell curve, using distorted slope)
  const dirtSlopeFactor = mul(
    smoothstep(float(0.15), float(0.4), dSlope),
    smoothstep(float(0.6), float(0.3), dSlope),
  );
  baseColor = mix(baseColor, dirtColor, mul(dirtSlopeFactor, float(0.6)));

  // Cliff on steep slopes (using distorted slope)
  baseColor = mix(
    baseColor,
    cliffColor,
    smoothstep(float(0.3), float(0.55), dSlope),
  );

  // Phase C4 first cut — N-channel base color from per-vertex RGB.
  // When `useVertexColorBase=true` (non-Hyperia themed projects),
  // the per-vertex `color` attribute (already populated by
  // `terrainHelpers.generateTileGeometry()` from the runtime
  // content registry's biome colors) replaces the 3-channel
  // tundra/forest/canyon texture-blend baseColor. Works for any
  // number of biomes — N-channel via the per-vertex attribute,
  // no texture-array needed for this first cut.
  //
  // Downstream effects below (sand-near-water, shoreline, river
  // bed, road overlay, mine overlay, lighting, fog) apply
  // unmodified — they're height- / influence- / lighting-driven,
  // not biome-textured.
  if (useVertexColorBase) {
    baseColor = attribute("color", "vec3");
  }

  // Sand near water (flat areas, stronger in canyon — using distorted height)
  const sandBlend = mul(
    smoothstep(float(18.0), float(12.0), dHeight),
    smoothstep(float(0.25), float(0.0), slope),
  );
  const sandStrength = mix(float(0.6), float(0.9), dW);
  baseColor = mix(baseColor, SAND_YELLOW, mul(sandBlend, sandStrength));

  // Shoreline transitions (using distorted height)
  baseColor = mix(
    baseColor,
    DIRT_DARK,
    mul(smoothstep(float(22.0), float(14.0), dHeight), float(0.4)),
  );
  baseColor = mix(
    baseColor,
    MUD_BROWN,
    mul(smoothstep(float(15.0), float(10.0), dHeight), float(0.7)),
  );
  baseColor = mix(
    baseColor,
    WATER_EDGE,
    mul(smoothstep(float(11.0), float(7.0), dHeight), float(0.9)),
  );

  // Saturation boost: pull color away from grey
  const lumaB = dot(baseColor, vec3(0.299, 0.587, 0.114));
  const greyB = vec3(lumaB, lumaB, lumaB);
  baseColor = mix(
    greyB,
    baseColor,
    float(TERRAIN_SHADER_CONSTANTS.SATURATION_BOOST),
  );

  // === RIVER BED / BANK COLORING ===
  if (includeRiverProximity) {
    // riverProximity: 1.0 = in channel (muddy brown), smoothstep to 0.0 at bank edge
    const riverProx = attribute("riverProximity", "float");
    const riverbedColor = vec3(0.32, 0.22, 0.12); // dark muddy brown
    const riverBankColor = vec3(0.45, 0.35, 0.22); // sandy bank brown
    // In channel (proximity > 0.7): full riverbed, bank zone: blend sandy brown → natural
    const riverBedBlend = smoothstep(float(0.5), float(0.8), riverProx);
    const riverColor = mix(riverBankColor, riverbedColor, riverBedBlend);
    baseColor = mix(baseColor, riverColor, riverProx);
  }

  // Anti-dithering noise variation (±4% brightness, ±2% color shift)
  const brightnessVar = mul(sub(fineNoise, float(0.5)), float(0.08));
  const colorVar = mul(sub(microNoise, float(0.5)), float(0.04));
  const variedColor = add(
    baseColor,
    vec3(
      add(brightnessVar, colorVar),
      brightnessVar,
      sub(brightnessVar, colorVar),
    ),
  );

  // === ROAD OVERLAY ===
  // Multi-technique procedural dirt road matching World Studio quality:
  // noise-distorted edges, multi-layer composition, height-based blending,
  // edge border darkening. Uses GPU road mask when available, falls back
  // to per-vertex attribute.
  const roadInfluenceAttr = packedAttributes
    ? attribute("terrainBlend", "vec4").z
    : attribute("roadInfluence", "float");
  const roadMaskState = getRoadInfluenceTextureState();
  const roadHalfWorld = roadMaskState.uWorldSize.mul(0.5);
  const roadUvX = worldPos.x
    .sub(roadMaskState.uCenterX)
    .add(roadHalfWorld)
    .div(roadMaskState.uWorldSize);
  const roadUvZ = worldPos.z
    .sub(roadMaskState.uCenterZ)
    .add(roadHalfWorld)
    .div(roadMaskState.uWorldSize);
  const roadUV = vec2(roadUvX.clamp(0.001, 0.999), roadUvZ.clamp(0.001, 0.999));
  const roadMaskSample = roadMaskState.textureNode.sample(roadUV).r;
  const hasRoadMask = smoothstep(
    float(1.0),
    float(2.0),
    roadMaskState.uWorldSize,
  );
  const dx = abs(worldPos.x.sub(roadMaskState.uCenterX));
  const dz = abs(worldPos.z.sub(roadMaskState.uCenterZ));
  const insideMask = step(dx, roadHalfWorld).mul(step(dz, roadHalfWorld));
  const useMask = hasRoadMask.mul(insideMask);
  const roadInfluence = mix(roadInfluenceAttr, roadMaskSample, useMask);

  // Multi-scale noise samples for road detail (matching procgen TerrainShaderTSL)
  const roadUVCoord = vec2(worldPos.x, worldPos.z);
  const rn1 = texture(noiseTex, mul(roadUVCoord, float(0.015))).r; // large patches
  const rn2 = texture(noiseTex, mul(roadUVCoord, float(0.045))).r; // medium detail
  const rn3 = texture(noiseTex, mul(roadUVCoord, float(0.12))).r; // fine grain
  const rn4 = texture(noiseTex, mul(roadUVCoord, float(0.3))).r; // micro detail

  // Noise-distorted edge mask for natural, irregular road boundaries
  const edgeDistortion = add(
    mul(sub(rn2, float(0.5)), float(0.35)), // medium wiggles
    mul(sub(rn3, float(0.5)), float(0.15)), // fine roughness
  );
  const distortedInfluence = add(roadInfluence, edgeDistortion);
  const roadEdgeMask = smoothstep(float(0.25), float(0.55), distortedInfluence);

  // Layer 1: compacted earth base (warm brown, two-tone + micro variation)
  const earthBase = mix(
    vec3(...ROAD_COLORS.earthBaseA),
    vec3(...ROAD_COLORS.earthBaseB),
    smoothstep(
      float(0.3),
      float(0.7),
      add(mul(rn1, float(0.8)), mul(rn4, float(0.2))),
    ),
  );

  // Layer 2: surface dust (lighter sandy patches)
  const dustMask = smoothstep(float(0.55), float(0.75), rn2);
  const withDust = mix(
    earthBase,
    vec3(...ROAD_COLORS.dust),
    mul(dustMask, float(0.35)),
  );

  // Layer 3: gravel highlights + cracks between pebbles
  const gravelMask = smoothstep(float(0.7), float(0.8), rn3);
  const gravelShadow = smoothstep(float(0.15), float(0.25), rn3);
  const withGravel = mix(
    withDust,
    vec3(...ROAD_COLORS.gravel),
    mul(gravelMask, float(0.4)),
  );
  const withCracks = mix(
    mul(withGravel, float(0.82)),
    withGravel,
    gravelShadow,
  );

  // Layer 4: wear track darkening (center of road, compacted)
  const wearTrack = mul(mul(roadEdgeMask, roadEdgeMask), roadEdgeMask); // pow(roadMask, 3)
  const wornRoad = mul(withCracks, mix(float(1.0), float(0.88), wearTrack));

  // Layer 5: grass tufts at road margins (edge scatter)
  const edgeZone = mul(
    smoothstep(float(0.15), float(0.4), roadEdgeMask),
    smoothstep(float(0.75), float(0.45), roadEdgeMask),
  );
  const edgeScatter = mul(edgeZone, smoothstep(float(0.4), float(0.65), rn2));
  const roadDetailColor = mix(
    wornRoad,
    variedColor,
    mul(edgeScatter, float(0.4)),
  );

  // Height-based blending: grass "pokes through" road at edges
  const grassH = add(mul(noiseValue, float(0.4)), float(0.6));
  const roadH = add(mul(rn3, float(0.3)), float(0.1));
  const grassBl = add(grassH, mul(sub(float(1.0), roadEdgeMask), float(2.0)));
  const roadBl = add(roadH, mul(roadEdgeMask, float(2.0)));
  const maxH = tslMax(grassBl, roadBl);
  const depthParam = float(0.15);
  const thresh = sub(maxH, depthParam);
  const gW = tslMax(sub(grassBl, thresh), float(0.0));
  const rW = tslMax(sub(roadBl, thresh), float(0.0));
  const totalW = add(gW, rW);
  const heightBlended = div(
    add(mul(variedColor, gW), mul(roadDetailColor, rW)),
    totalW,
  );

  // Edge border darkening: narrow dark band at road edge for readability
  const edgeBand = mul(
    smoothstep(float(0.28), float(0.4), roadEdgeMask),
    smoothstep(float(0.55), float(0.42), roadEdgeMask),
  );
  const borderDarken = mul(edgeBand, float(0.12));
  const baseWithRoads = mul(heightBlended, sub(float(1.0), borderDarken));

  // === MINE FLOOR OVERLAY ===
  // AAA multi-layered rocky quarry floor matching Asset Forge shader quality.
  // Exposed bedrock, gravel scatter, dirt accumulation, radial gradient,
  // height-based edge blending with surrounding terrain.
  const mineInfluenceAttr = packedAttributes
    ? attribute("terrainBlend", "vec4").w
    : attribute("mineInfluence", "float");
  const mineBiomeIdAttr = packedAttributes
    ? attribute("biomeData", "vec2").y
    : attribute("mineBiomeId", "float");

  // Mine-specific noise at scales appropriate for 15-25m mine areas
  const mineUV = vec2(worldPos.x, worldPos.z);
  const mn1 = texture(noiseTex, mul(mineUV, float(0.035))).r; // stone slabs (~28m)
  const mn2 = texture(noiseTex, mul(mineUV, float(0.14))).r; // stone surface (~7m)
  const mn3 = texture(noiseTex, mul(mineUV, float(0.5))).r; // gravel (~2m)
  const mn4 = texture(noiseTex, mul(mineUV, float(1.4))).r; // micro cracks (~0.7m)

  // Noise-distorted organic edge
  const mineEdgeDistortion = add(
    mul(sub(mn1, float(0.5)), float(0.22)),
    add(
      mul(sub(mn2, float(0.5)), float(0.14)),
      mul(sub(mn3, float(0.5)), float(0.06)),
    ),
  );
  const distortedMineInfluence = add(mineInfluenceAttr, mineEdgeDistortion);
  const mineCoreMask = smoothstep(
    float(0.42),
    float(0.68),
    distortedMineInfluence,
  );
  const mineEdgeMask = smoothstep(
    float(0.12),
    float(0.42),
    distortedMineInfluence,
  );

  // Biome color palette: primary (bedrock), secondary (dark crevices), tertiary (gravel)
  // 0=forest, 1=tundra, 2=desert, 3=mountains, 4=plains, 5=swamp, 6=valley
  const mb = mineBiomeIdAttr;
  const mbForest = mul(step(float(-0.5), mb), step(mb, float(0.5)));
  const mbTundra = mul(step(float(0.5), mb), step(mb, float(1.5)));
  const mbDesert = mul(step(float(1.5), mb), step(mb, float(2.5)));
  const mbMountain = mul(step(float(2.5), mb), step(mb, float(3.5)));
  const mbSwamp = mul(step(float(4.5), mb), step(mb, float(5.5)));
  const mbValley = step(float(5.5), mb);

  // Primary (bedrock) — colors from shared MINE_BIOME_PALETTES
  const MP = MINE_BIOME_PALETTES;
  let minePrimary: ShaderNode = vec3(...MP.plains.primary);
  minePrimary = mix(minePrimary, vec3(...MP.forest.primary), mbForest);
  minePrimary = mix(minePrimary, vec3(...MP.tundra.primary), mbTundra);
  minePrimary = mix(minePrimary, vec3(...MP.desert.primary), mbDesert);
  minePrimary = mix(minePrimary, vec3(...MP.mountains.primary), mbMountain);
  minePrimary = mix(minePrimary, vec3(...MP.swamp.primary), mbSwamp);
  minePrimary = mix(minePrimary, vec3(...MP.valley.primary), mbValley);

  // Secondary (dark crevices)
  let mineSecondary: ShaderNode = vec3(...MP.plains.secondary);
  mineSecondary = mix(mineSecondary, vec3(...MP.forest.secondary), mbForest);
  mineSecondary = mix(mineSecondary, vec3(...MP.tundra.secondary), mbTundra);
  mineSecondary = mix(mineSecondary, vec3(...MP.desert.secondary), mbDesert);
  mineSecondary = mix(
    mineSecondary,
    vec3(...MP.mountains.secondary),
    mbMountain,
  );
  mineSecondary = mix(mineSecondary, vec3(...MP.swamp.secondary), mbSwamp);
  mineSecondary = mix(mineSecondary, vec3(...MP.valley.secondary), mbValley);

  // Tertiary (gravel highlights)
  let mineTertiary: ShaderNode = vec3(...MP.plains.tertiary);
  mineTertiary = mix(mineTertiary, vec3(...MP.forest.tertiary), mbForest);
  mineTertiary = mix(mineTertiary, vec3(...MP.tundra.tertiary), mbTundra);
  mineTertiary = mix(mineTertiary, vec3(...MP.desert.tertiary), mbDesert);
  mineTertiary = mix(mineTertiary, vec3(...MP.mountains.tertiary), mbMountain);
  mineTertiary = mix(mineTertiary, vec3(...MP.swamp.tertiary), mbSwamp);
  mineTertiary = mix(mineTertiary, vec3(...MP.valley.tertiary), mbValley);

  // Layer 1: Exposed bedrock — broad slab patches
  const mineSlabPattern = smoothstep(float(0.32), float(0.68), mn1);
  const mineBedrockColor = mix(minePrimary, mineSecondary, mineSlabPattern);

  // Layer 2: Stone surface texture — highlights and shadows
  const mineSurfaceLight = smoothstep(float(0.45), float(0.75), mn2);
  const mineSurfaceShadow = smoothstep(float(0.35), float(0.15), mn2);
  const mineTexturedStone = mul(
    mix(mineBedrockColor, mineTertiary, mul(mineSurfaceLight, float(0.35))),
    mix(float(1.0), float(0.88), mineSurfaceShadow),
  );

  // Layer 3: Gravel scatter with pebble shadows
  const mineGravelHighlight = smoothstep(float(0.58), float(0.78), mn3);
  const mineGravelShadow = smoothstep(float(0.22), float(0.38), mn3);
  const mineWithGravel = mix(
    mineTexturedStone,
    mineTertiary,
    mul(mineGravelHighlight, float(0.3)),
  );
  const mineWithCracks = mix(
    mul(mineWithGravel, float(0.84)),
    mineWithGravel,
    mineGravelShadow,
  );

  // Layer 4: Micro crack imperfections
  const mineCrackMask = smoothstep(float(0.42), float(0.58), mn4);
  const mineWithMicro = mul(
    mineWithCracks,
    mix(float(0.92), float(1.02), mineCrackMask),
  );

  // Layer 5: Radial gradient — center rock, edge gravel/dirt
  const mineCenterW = smoothstep(float(0.45), float(0.85), mineInfluenceAttr);
  const mineEdgeGravelDirt = mix(
    mix(mineSecondary, minePrimary, float(0.4)),
    mineTertiary,
    mn3,
  );
  const mineRadialMixed = mix(
    mix(mineWithMicro, mineEdgeGravelDirt, float(0.4)),
    mineWithMicro,
    mineCenterW,
  );

  // Layer 6: Wear / foot traffic darkening
  const mineWearPattern = smoothstep(float(0.55), float(0.75), mn1);
  const mineWornFloor = mul(
    mineRadialMixed,
    sub(float(1.0), mul(mineWearPattern, mul(mineCoreMask, float(0.08)))),
  );

  // Layer 7: Edge darkening band
  const mineEdgeBand = mul(
    smoothstep(float(0.15), float(0.32), mineEdgeMask),
    smoothstep(float(0.52), float(0.32), mineEdgeMask),
  );
  const mineBorderDarken = mul(mineEdgeBand, float(0.14));
  const mineFloorFinal = mul(mineWornFloor, sub(float(1.0), mineBorderDarken));

  // Blend mine floor onto terrain
  const baseWithMines = mix(baseWithRoads, mineFloorFinal, mineEdgeMask);

  // Half-lambert cool tint + fresnel rim — tints the ALBEDO before PBR.
  // PBR then adds a single Lambert N·L + shadow on top.
  const animeBase = applyAnimeShade(
    baseWithMines,
    worldNormal,
    sunDirectionUniform,
  );

  // ============================================================================
  // VERTEX LIGHTING (lampposts, torches, etc.)
  // Simple additive point lights with smooth attenuation
  // Skipped in editor mode (no lamppost data available)
  // ============================================================================

  let litTerrain: ShaderNode = animeBase;

  if (includeVertexLighting) {
    // Helper to calculate single light contribution
    const calculateLightContribution = (
      lightPos: ReturnType<typeof uniform>,
      lightColor: ReturnType<typeof uniform>,
      lightParams: ReturnType<typeof uniform>, // x=intensity, y=range
    ) => {
      const toLightVec = sub(lightPos, worldPos);
      const distToLight = add(
        add(mul(toLightVec.x, toLightVec.x), mul(toLightVec.y, toLightVec.y)),
        mul(toLightVec.z, toLightVec.z),
      );
      const dist = mul(distToLight, float(1));
      const rangeSq = mul(lightParams.y, lightParams.y);
      const attenuation = mul(
        smoothstep(rangeSq, float(0), dist),
        lightParams.x,
      );
      return mul(lightColor, attenuation);
    };

    let lightAccum: ShaderNode = vec3(0, 0, 0);
    for (let i = 0; i < MAX_VERTEX_LIGHTS; i++) {
      lightAccum = add(
        lightAccum,
        calculateLightContribution(
          vertexLightPositionUniforms[i],
          vertexLightColorUniforms[i],
          vertexLightParamUniforms[i],
        ),
      );
    }

    // Lamppost light mask (baked, night-only)
    const lampMaskState = getLamppostLightTextureState();
    const lampHalfWorld = lampMaskState.uWorldSize.mul(0.5);
    const lampUvX = worldPos.x
      .sub(lampMaskState.uCenterX)
      .add(lampHalfWorld)
      .div(lampMaskState.uWorldSize);
    const lampUvZ = worldPos.z
      .sub(lampMaskState.uCenterZ)
      .add(lampHalfWorld)
      .div(lampMaskState.uWorldSize);
    const lampUV = vec2(
      lampUvX.clamp(0.001, 0.999),
      lampUvZ.clamp(0.001, 0.999),
    );
    const lampMask = lampMaskState.textureNode.sample(lampUV).r;
    const hasLampMask = smoothstep(
      float(1.0),
      float(2.0),
      lampMaskState.uWorldSize,
    );
    const lampDx = abs(worldPos.x.sub(lampMaskState.uCenterX));
    const lampDz = abs(worldPos.z.sub(lampMaskState.uCenterZ));
    const lampInside = step(lampDx, lampHalfWorld).mul(
      step(lampDz, lampHalfWorld),
    );
    const lampUse = hasLampMask.mul(lampInside);
    const lampIntensity = lampMask.mul(lampUse).mul(lampMaskState.uNightMix);
    const lampColor = vec3(1.0, 0.9, 0.6);
    lightAccum = add(lightAccum, mul(lampColor, lampIntensity));

    // Apply vertex lighting additively
    litTerrain = mul(animeBase, add(vec3(1, 1, 1), lightAccum));
  }

  // === CREATE MATERIAL ===
  // Base color + vertex lights only.  PBR handles Lambert N·L + shadow.
  const dayIntensityUniform = uniform(1.0);

  const material = new MeshStandardNodeMaterial();
  material.colorNode = litTerrain;
  material.roughness = 1.0;
  material.metalness = 0.0;
  material.side = THREE.FrontSide;
  material.fog = false;

  // === DISTANCE FOG (smoothstep with squared distances — avoids per-fragment sqrt) ===
  // Skipped entirely in editor mode (fogEnabled=false) — editor has no SkySystem fog target.
  if (fogEnabled && fogTexNode) {
    const baseFogFactor = smoothstep(
      float(FOG_NEAR_SQ),
      float(FOG_FAR_SQ),
      distSq,
    );
    const fogFactor = mul(baseFogFactor, fogEnabledUniform);
    const fogColor = fogTexNode.rgb;
    material.outputNode = Fn(() => {
      return vec4(mix(output.rgb, fogColor, fogFactor), output.a);
    })();
  }

  const terrainUniforms: TerrainUniforms = {
    sunPosition: sunPositionUniform,
    sunDirection: sunDirectionUniform as unknown as { value: THREE.Vector3 },
    time: timeUniform,
    fogEnabled: fogEnabledUniform,
    dayIntensity: dayIntensityUniform as unknown as { value: number },
    // Vertex lighting arrays — only populated when includeVertexLighting=true
    ...(includeVertexLighting
      ? {
          vertexLightPositions: vertexLightPositionUniforms.map(
            (u) => u as unknown as { value: THREE.Vector3 },
          ),
          vertexLightColors: vertexLightColorUniforms.map(
            (u) => u as unknown as { value: THREE.Vector3 },
          ),
          vertexLightParams: vertexLightParamUniforms.map(
            (u) => u as unknown as { value: THREE.Vector2 },
          ),
        }
      : {}),
  };
  const result = material as typeof material & {
    terrainUniforms: TerrainUniforms;
  };
  result.terrainUniforms = terrainUniforms;
  return result;
}
