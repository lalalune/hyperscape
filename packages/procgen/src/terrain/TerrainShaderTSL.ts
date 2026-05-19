/**
 * TerrainShaderTSL - Game-accurate terrain material for TSL/WebGPU
 *
 * This is the EXACT same terrain shader code used in the game engine.
 * Both Asset Forge and the game engine share this code for visual consistency.
 *
 * Features:
 * - tile-based-MMORPG-style flat-shaded vertex colors (no textures)
 * - Height and slope-based biome blending
 * - Noise-based dirt patches
 * - Snow at high elevations
 * - Sand/shoreline near water
 * - Distance fog
 * - Road overlay support
 *
 * @module TerrainShaderTSL
 */

import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  texture,
  positionWorld,
  normalWorld,
  cameraPosition,
  attribute,
  uniform,
  float,
  vec2,
  vec3,
  add,
  sub,
  mul,
  mix,
  smoothstep,
  abs,
  sin,
  cos,
  max as tslMax,
  div,
  dot,
  normalize,
  pow,
  clamp,
} from "three/tsl";
import type Node from "three/src/nodes/core/Node.js";
import { MINE_BIOME_PALETTES, ROAD_COLORS } from "./biome-colors";
import {
  TERRAIN_SHADER,
  TUNDRA,
  FOREST,
  CANYON,
  ACCENT,
} from "./TerrainConstants";
import { createPermutation, seamlessFbm } from "../math/PerlinNoise";

export const TERRAIN_CONSTANTS = {
  ...TERRAIN_SHADER,
  FOG_NEAR: 150.0,
  FOG_FAR: 350.0,
  WATER_LEVEL: 16, // Overridden at runtime by game; standalone default for procgen previews
  FOG_COLOR: new THREE.Color(0xd4c8b8),
} as const;

// ============================================================================
// PERLIN NOISE TEXTURE GENERATION
// ============================================================================

let cachedNoiseTexture: THREE.DataTexture | null = null;
const NOISE_SIZE = TERRAIN_SHADER.NOISE_SIZE;

/**
 * Generate a Perlin noise texture for terrain shading
 */
export function generateNoiseTexture(seed: number = 12345): THREE.DataTexture {
  if (cachedNoiseTexture) return cachedNoiseTexture;

  const perm = createPermutation(seed);
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);

  for (let y = 0; y < NOISE_SIZE; y++) {
    for (let x = 0; x < NOISE_SIZE; x++) {
      const nx = x / NOISE_SIZE;
      const ny = y / NOISE_SIZE;

      const noise = seamlessFbm(nx, ny, perm, 4);
      const value = (noise + 1) * 0.5;
      const byte = Math.floor(Math.max(0, Math.min(255, value * 255)));

      const idx = (y * NOISE_SIZE + x) * 4;
      data[idx] = byte;
      data[idx + 1] = byte;
      data[idx + 2] = byte;
      data[idx + 3] = 255;
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
  return tex;
}

/**
 * Get the cached noise texture
 */
export function getNoiseTexture(): THREE.DataTexture | null {
  return cachedNoiseTexture;
}

// CPU-side noise sampling
let cachedPerm: number[] | null = null;

/**
 * Sample noise at world position (for CPU-side operations like grass placement)
 */
export function sampleNoiseAtPosition(
  worldX: number,
  worldZ: number,
  seed: number = 12345,
): number {
  if (!cachedPerm) {
    cachedPerm = createPermutation(seed);
  }

  const u = worldX * TERRAIN_CONSTANTS.NOISE_SCALE;
  const v = worldZ * TERRAIN_CONSTANTS.NOISE_SCALE;

  const wrappedU = u - Math.floor(u);
  const wrappedV = v - Math.floor(v);

  const noise = seamlessFbm(wrappedU, wrappedV, cachedPerm, 4);
  return (noise + 1) * 0.5;
}

function smoothstepCPU(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Check if terrain at position should display as grass
 */
export function getGrassiness(
  _worldX: number,
  _worldZ: number,
  height: number,
  slope: number,
  _seed: number = 12345,
): number {
  let grassiness = 1.0;

  // Very steep slopes = rock
  if (slope > 0.6) {
    const rockFactor = smoothstepCPU(0.6, 0.8, slope);
    grassiness -= rockFactor;
  }

  // Snow at high elevation
  if (height > TERRAIN_CONSTANTS.SNOW_HEIGHT - 5.0) {
    const snowFactor = smoothstepCPU(
      TERRAIN_CONSTANTS.SNOW_HEIGHT - 5.0,
      TERRAIN_CONSTANTS.SNOW_HEIGHT + 5.0,
      height,
    );
    grassiness -= snowFactor;
  }

  return Math.max(0, Math.min(1, grassiness));
}

/**
 * Calculate terrain slope from height samples
 */
export function calculateSlope(
  getHeight: (x: number, z: number) => number,
  x: number,
  z: number,
  sampleDistance: number = 1.0,
): number {
  const hPosX = getHeight(x + sampleDistance, z);
  const hNegX = getHeight(x - sampleDistance, z);
  const hPosZ = getHeight(x, z + sampleDistance);
  const hNegZ = getHeight(x, z - sampleDistance);

  const dhdx = (hPosX - hNegX) / (2 * sampleDistance);
  const dhdz = (hPosZ - hNegZ) / (2 * sampleDistance);

  const gradientMag = Math.sqrt(dhdx * dhdx + dhdz * dhdz);
  const normalY = 1 / Math.sqrt(1 + gradientMag * gradientMag);
  const slope = 1 - Math.abs(normalY);

  return slope;
}

// ============================================================================
// MATERIAL LAYER DEFINITIONS
// ============================================================================

/** Material layer identifiers (indices 0-7 map to splatmap channels) */
export type MaterialLayerId =
  | "grass"
  | "dirt"
  | "rock"
  | "sand"
  | "snow"
  | "gravel"
  | "mud"
  | "volcanic";

/** A single material layer definition */
export interface MaterialLayerDef {
  index: number;
  id: MaterialLayerId;
  name: string;
  colorLight: [number, number, number];
  colorDark: [number, number, number];
  roughness: number;
  /** CSS hex for UI swatches */
  uiColor: string;
}

/** All 8 terrain material layers — index matches splatmap channel order */
export const MATERIAL_LAYER_DEFINITIONS: readonly MaterialLayerDef[] = [
  // materialWeights0.x
  {
    index: 0,
    id: "grass",
    name: "Grass",
    colorLight: [0.3, 0.58, 0.15],
    colorDark: [0.18, 0.42, 0.08],
    roughness: 0.95,
    uiColor: "#4d9426",
  },
  // materialWeights0.y
  {
    index: 1,
    id: "dirt",
    name: "Dirt",
    colorLight: [0.42, 0.3, 0.16],
    colorDark: [0.28, 0.18, 0.09],
    roughness: 0.9,
    uiColor: "#6b4d29",
  },
  // materialWeights0.z
  {
    index: 2,
    id: "rock",
    name: "Rock",
    colorLight: [0.5, 0.48, 0.44],
    colorDark: [0.34, 0.32, 0.28],
    roughness: 0.85,
    uiColor: "#807a70",
  },
  // materialWeights0.w
  {
    index: 3,
    id: "sand",
    name: "Sand",
    colorLight: [0.82, 0.72, 0.5],
    colorDark: [0.7, 0.6, 0.38],
    roughness: 0.92,
    uiColor: "#d1b880",
  },
  // materialWeights1.x
  {
    index: 4,
    id: "snow",
    name: "Snow",
    colorLight: [0.92, 0.94, 0.96],
    colorDark: [0.78, 0.82, 0.88],
    roughness: 0.7,
    uiColor: "#eaf0f5",
  },
  // materialWeights1.y
  {
    index: 5,
    id: "gravel",
    name: "Gravel",
    colorLight: [0.52, 0.48, 0.42],
    colorDark: [0.38, 0.35, 0.3],
    roughness: 0.95,
    uiColor: "#857a6b",
  },
  // materialWeights1.z
  {
    index: 6,
    id: "mud",
    name: "Mud",
    colorLight: [0.28, 0.24, 0.14],
    colorDark: [0.16, 0.14, 0.08],
    roughness: 0.98,
    uiColor: "#473d24",
  },
  // materialWeights1.w
  {
    index: 7,
    id: "volcanic",
    name: "Volcanic",
    colorLight: [0.3, 0.25, 0.22],
    colorDark: [0.18, 0.12, 0.1],
    roughness: 0.8,
    uiColor: "#4d4038",
  },
] as const;

// ============================================================================
// TERRAIN MATERIAL UNIFORMS
// ============================================================================

export interface TerrainUniforms {
  sunPosition: { value: THREE.Vector3 };
  time: { value: number };
  fogNear: { value: number };
  fogFar: { value: number };
  fogNearSq: { value: number };
  fogFarSq: { value: number };
  fogColor: { value: THREE.Vector3 };
  fogEnabled: { value: number };
}

export interface TerrainMaterialOptions {
  /** Enable fog (default: true) */
  fogEnabled?: boolean;
  /** Include road overlay attribute (default: true) */
  includeRoadOverlay?: boolean;
  /** Include mine floor overlay attribute (default: true) */
  includeMineOverlay?: boolean;
  /** Custom fog color */
  fogColor?: THREE.Color;
  /** Custom fog distances */
  fogNear?: number;
  fogFar?: number;
  /** Include material layer splatmap blending (default: true) */
  includeMaterialLayers?: boolean;
  /** Apply anime-style shading: half-lambert cool tint + fresnel rim (default: false) */
  animeShading?: boolean;
  /** Saturation boost multiplier applied before fog (default: 1.0) */
  saturationBoost?: number;
  /** Base URL for biome textures (e.g. "http://localhost:3401/game-textures/terrain-biomes").
   *  When provided, loads 8 biome PNGs with dual-scale anti-tiling and triplanar cliffs.
   *  Falls back to procedural color via a 2x2 canvas placeholder until textures load. */
  textureBaseUrl?: string;
}

// ============================================================================
// TERRAIN MATERIAL - tile-based MMORPG Style (No Textures)
// ============================================================================

/**
 * Create the game-accurate tile-based-MMORPG-style terrain material
 *
 * This is the EXACT same material used in the game engine.
 * Uses TSL (Three Shader Language) for WebGPU rendering.
 */
export function createTerrainMaterial(
  options: TerrainMaterialOptions = {},
): MeshStandardNodeMaterial & { terrainUniforms: TerrainUniforms } {
  const {
    fogEnabled = true,
    includeRoadOverlay = true,
    includeMineOverlay = true,
    includeMaterialLayers = true,
    fogColor = TERRAIN_CONSTANTS.FOG_COLOR,
    fogNear = TERRAIN_CONSTANTS.FOG_NEAR,
    fogFar = TERRAIN_CONSTANTS.FOG_FAR,
  } = options;

  // Generate noise texture
  const noiseTex = generateNoiseTexture();

  // Uniforms
  const sunPositionUniform = uniform(vec3(100, 100, 100));
  const timeUniform = uniform(float(0));
  const noiseScale = uniform(float(TERRAIN_CONSTANTS.NOISE_SCALE));

  const fogNearUniform = uniform(float(fogNear));
  const fogFarUniform = uniform(float(fogFar));
  const fogNearSqUniform = uniform(float(fogNear * fogNear));
  const fogFarSqUniform = uniform(float(fogFar * fogFar));
  const fogColorUniform = uniform(vec3(fogColor.r, fogColor.g, fogColor.b));
  const fogEnabledUniform = uniform(float(fogEnabled ? 1.0 : 0.0));

  const worldPos = positionWorld;
  const worldNormal = normalWorld;
  const height = worldPos.y;
  const slope = sub(float(1.0), abs(worldNormal.y));

  // ============================================================================
  // PER-BIOME TERRAIN COLORS (matches game's TerrainShader.ts palettes)
  // ============================================================================

  // --- Biome palettes from shared constants (TerrainConstants.ts) ---
  const TUNDRA_GRASS = vec3(...TUNDRA.GRASS);
  const TUNDRA_GRASS_DARK = vec3(...TUNDRA.GRASS_DARK);
  const TUNDRA_DIRT = vec3(...TUNDRA.DIRT);
  const TUNDRA_DIRT_DARK = vec3(...TUNDRA.DIRT_DARK);
  const TUNDRA_CLIFF = vec3(...TUNDRA.CLIFF);
  const TUNDRA_CLIFF_DARK = vec3(...TUNDRA.CLIFF_DARK);

  const FOREST_GRASS = vec3(...FOREST.GRASS);
  const FOREST_GRASS_DARK = vec3(...FOREST.GRASS_DARK);
  const FOREST_DIRT = vec3(...FOREST.DIRT);
  const FOREST_DIRT_DARK = vec3(...FOREST.DIRT_DARK);
  const FOREST_CLIFF = vec3(...FOREST.CLIFF);
  const FOREST_CLIFF_DARK = vec3(...FOREST.CLIFF_DARK);

  const CANYON_SAND = vec3(...CANYON.SAND);
  const CANYON_SAND_DARK = vec3(...CANYON.SAND_DARK);
  const CANYON_ROCK = vec3(...CANYON.ROCK);
  const CANYON_ROCK_DARK = vec3(...CANYON.ROCK_DARK);
  const CANYON_CLIFF = vec3(...CANYON.CLIFF);
  const CANYON_CLIFF_DARK = vec3(...CANYON.CLIFF_DARK);

  const FOREST_GRASS_HIGH = vec3(...FOREST.GRASS_HIGH);
  const TUNDRA_GRASS_HIGH = vec3(...TUNDRA.GRASS_HIGH);
  const CANYON_SAND_HIGH = vec3(...CANYON.SAND_HIGH);

  const FOREST_VARIATION = vec3(...FOREST.VARIATION);
  const TUNDRA_VARIATION = vec3(...TUNDRA.VARIATION);
  const CANYON_VARIATION = vec3(...CANYON.VARIATION);

  // Legacy aliases (default = forest biome)
  const dirtDark = FOREST_DIRT_DARK;
  const sandYellow = vec3(...ACCENT.SAND_YELLOW);
  const mudBrown = vec3(...ACCENT.MUD_BROWN);
  const waterEdge = vec3(...ACCENT.WATER_EDGE);

  // Packed vertex attributes (forestWeight, canyonWeight, roadInfluence, mineInfluence)
  const terrainBlend = attribute("terrainBlend", "vec4");
  const biomeDataAttr = attribute("biomeData", "vec2");

  // Per-vertex biome weights (set by TileBasedTerrain from GameTerrainAdapter)
  const fW = terrainBlend.x;
  const dW = terrainBlend.y;
  const tW = sub(float(1.0), add(fW, dW)); // tundra = remainder

  // Distance-based LOD
  const toCamera = sub(worldPos, cameraPosition);
  const distSq = add(
    add(mul(toCamera.x, toCamera.x), mul(toCamera.y, toCamera.y)),
    mul(toCamera.z, toCamera.z),
  );

  // Noise sampling
  const noiseUV = mul(vec2(worldPos.x, worldPos.z), noiseScale);
  const noiseValue = texture(noiseTex, noiseUV).r;

  // Derived noise (no extra texture fetch)
  const noiseValue2 = add(
    mul(sin(mul(noiseValue, float(6.28))), float(0.3)),
    float(0.5),
  );

  // Fine detail (conditional based on distance)
  const closeEnough = smoothstep(float(12000.0), float(8000.0), distSq);
  const noiseUV3 = mul(vec2(worldPos.x, worldPos.z), float(0.12));
  const fineNoiseSample = texture(noiseTex, noiseUV3).r;
  const fineNoise = mix(float(0.5), fineNoiseSample, closeEnough);

  // Micro noise (derived)
  const microNoise = add(
    mul(cos(mul(noiseValue, float(12.56))), float(0.2)),
    float(0.5),
  );

  // === NOISE DISTORTION for organic terrain transitions (game parity) ===
  const distortUV = mul(
    vec2(worldPos.x, worldPos.z),
    float(TERRAIN_CONSTANTS.DISTORT_NOISE_SCALE),
  );
  const distortN = texture(noiseTex, distortUV).r;
  const distortedSlope = sub(
    slope,
    mul(
      sub(distortN, float(0.5)),
      float(TERRAIN_CONSTANTS.ROCK_DISTORT_STRENGTH),
    ),
  );
  const distortedHeight = add(
    height,
    mul(
      sub(distortN, float(0.5)),
      float(TERRAIN_CONSTANTS.HEIGHT_DISTORT_STRENGTH),
    ),
  );

  // Variation noise for large-scale patchy color regions (game parity)
  const variationUV = mul(
    vec2(worldPos.x, worldPos.z),
    float(TERRAIN_CONSTANTS.VARIATION_NOISE_SCALE),
  );
  const variationNoise = texture(noiseTex, variationUV).r;

  // === BIOME-BLENDED GRASS with variation ===
  const grassVariation = smoothstep(float(0.4), float(0.6), noiseValue2);
  const tundraGrass = mix(TUNDRA_GRASS, TUNDRA_GRASS_DARK, grassVariation);
  const forestGrass = mix(FOREST_GRASS, FOREST_GRASS_DARK, grassVariation);
  const canyonGrass = mix(CANYON_SAND, CANYON_SAND_DARK, grassVariation);
  let baseColor: Node = add(
    add(mul(tundraGrass, tW), mul(forestGrass, fW)),
    mul(canyonGrass, dW),
  );

  // === HEIGHT GRADIENT — lighter grass at altitude (game parity) ===
  const heightGrad = smoothstep(float(25.0), float(55.0), height);
  const highGrass = add(
    add(mul(TUNDRA_GRASS_HIGH, tW), mul(FOREST_GRASS_HIGH, fW)),
    mul(CANYON_SAND_HIGH, dW),
  );
  baseColor = mix(baseColor, highGrass, mul(heightGrad, float(0.3)));

  // === VARIATION OVERLAY — large patchy color regions (game parity) ===
  const variationPow = clamp(
    pow(add(variationNoise, float(0.3)), float(5.0)),
    float(0.0),
    float(1.0),
  );
  const variationOverlay = add(
    add(mul(TUNDRA_VARIATION, tW), mul(FOREST_VARIATION, fW)),
    mul(CANYON_VARIATION, dW),
  );
  baseColor = mix(baseColor, variationOverlay, mul(variationPow, float(0.25)));

  // === BIOME-BLENDED DIRT PATCHES ===
  const dirtPatchFactor = smoothstep(
    float(TERRAIN_CONSTANTS.DIRT_THRESHOLD - 0.05),
    float(TERRAIN_CONSTANTS.DIRT_THRESHOLD + 0.15),
    noiseValue,
  );
  const flatnessFactor = smoothstep(float(0.3), float(0.05), distortedSlope);
  const dirtVariation = smoothstep(float(0.3), float(0.7), noiseValue2);
  const tundraDirt = mix(TUNDRA_DIRT, TUNDRA_DIRT_DARK, dirtVariation);
  const forestDirt = mix(FOREST_DIRT, FOREST_DIRT_DARK, dirtVariation);
  const canyonDirt = mix(CANYON_ROCK, CANYON_ROCK_DARK, dirtVariation);
  const dirtColor = add(
    add(mul(tundraDirt, tW), mul(forestDirt, fW)),
    mul(canyonDirt, dW),
  );
  baseColor = mix(baseColor, dirtColor, mul(dirtPatchFactor, flatnessFactor));

  // === SLOPE-BASED DIRT (fades out where cliff takes over) ===
  const dirtSlopeFactor = mul(
    smoothstep(float(0.15), float(0.4), distortedSlope),
    smoothstep(float(0.6), float(0.3), distortedSlope),
  );
  baseColor = mix(baseColor, dirtColor, mul(dirtSlopeFactor, float(0.6)));

  // === PER-BIOME CLIFF ON STEEP SLOPES ===
  const cliffVariation = smoothstep(float(0.3), float(0.7), noiseValue);
  const tundraCliff = mix(TUNDRA_CLIFF, TUNDRA_CLIFF_DARK, cliffVariation);
  const forestCliff = mix(FOREST_CLIFF, FOREST_CLIFF_DARK, cliffVariation);
  const canyonCliff = mix(CANYON_CLIFF, CANYON_CLIFF_DARK, cliffVariation);
  let cliffColor: Node = add(
    add(mul(tundraCliff, tW), mul(forestCliff, fW)),
    mul(canyonCliff, dW),
  );
  // CLIFF_TINT: bluish-grey rock texture variation (game parity)
  const CLIFF_TINT = vec3(...ACCENT.CLIFF_TINT);
  const rockTexVar = mul(pow(distortN, float(0.5)), float(0.3));
  cliffColor = mix(cliffColor, CLIFF_TINT, rockTexVar);
  baseColor = mix(
    baseColor,
    cliffColor,
    smoothstep(float(0.3), float(0.55), distortedSlope),
  );

  // === SAND NEAR WATER (stronger in canyon) ===
  const sandBlend = mul(
    smoothstep(float(18.0), float(12.0), distortedHeight),
    smoothstep(float(0.25), float(0.0), slope),
  );
  const sandStrength = mix(float(0.6), float(0.9), dW);
  baseColor = mix(baseColor, sandYellow, mul(sandBlend, sandStrength));

  // === SHORELINE TRANSITIONS (distorted for organic boundaries) ===
  baseColor = mix(
    baseColor,
    dirtDark,
    mul(smoothstep(float(22.0), float(14.0), distortedHeight), float(0.4)),
  );
  baseColor = mix(
    baseColor,
    mudBrown,
    mul(smoothstep(float(15.0), float(10.0), distortedHeight), float(0.7)),
  );
  baseColor = mix(
    baseColor,
    waterEdge,
    mul(smoothstep(float(11.0), float(7.0), distortedHeight), float(0.9)),
  );

  // === BIOME TEXTURE OVERLAY (optional) ===
  // When textureBaseUrl is provided, loads biome PNGs and replaces procedural flat
  // colors with textured versions. Dual-scale UV anti-tiling + triplanar cliffs.
  // A 2x2 canvas placeholder renders the fallback color until the real texture loads.
  if (options.textureBaseUrl) {
    const baseUrl = options.textureBaseUrl.endsWith("/")
      ? options.textureBaseUrl
      : options.textureBaseUrl + "/";

    // Create texture with async load + immediate fallback color canvas
    const loadBiomeTex = (file: string, fr: number, fg: number, fb: number) => {
      let tex: THREE.Texture;
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = c.height = 2;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = `rgb(${Math.round(fr * 255)},${Math.round(fg * 255)},${Math.round(fb * 255)})`;
        ctx.fillRect(0, 0, 2, 2);
        tex = new THREE.Texture(c);
      } else {
        const d = new Uint8Array([
          Math.round(fr * 255),
          Math.round(fg * 255),
          Math.round(fb * 255),
          255,
        ]);
        tex = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
      }
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      if (typeof window !== "undefined") {
        new THREE.TextureLoader().load(
          baseUrl + file,
          (ld) => {
            tex.image = ld.image;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
          },
          undefined,
          () => {
            /* silent fallback to canvas placeholder */
          },
        );
      }
      return tex;
    };

    // Load biome textures (fallback colors from game's TERRAIN_BIOME_TEXTURES)
    const tGrass = loadBiomeTex("grass.png", 0.28, 0.63, 0.2);
    const tDirt = loadBiomeTex("dirt.png", 0.55, 0.48, 0.36);
    const tCliff = loadBiomeTex("cliff.png", 0.71, 0.67, 0.6);
    const tDesertGrass = loadBiomeTex("desertGrass.png", 0.51, 0.41, 0.28);
    const tDesertDirt = loadBiomeTex("desertDirt.png", 0.54, 0.42, 0.32);
    const tDesertCliff = loadBiomeTex("desertDirt.png", 0.54, 0.42, 0.32);
    const tSnowGrass = loadBiomeTex("snowgrass.png", 0.79, 0.8, 0.8);
    const tSnowDirt = loadBiomeTex("snowdirt.png", 0.78, 0.82, 0.84);
    const tSnowCliff = loadBiomeTex("snowdirt.png", 0.78, 0.82, 0.84);

    // Dual-scale UV for anti-tiling (primary 0.3, secondary 0.039)
    const tileScale = float(0.3);
    const tileScale2 = float(0.039);
    const uvP = mul(vec2(worldPos.x, worldPos.z), tileScale);
    const uvP2 = mul(vec2(worldPos.x, worldPos.z), tileScale2);
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

    // Flat texture sampling: blend two UV scales
    const dualFlat = (t: THREE.Texture) => {
      const s1 = vec3(texture(t, uvP).r, texture(t, uvP).g, texture(t, uvP).b);
      const s2 = vec3(
        texture(t, uvP2).r,
        texture(t, uvP2).g,
        texture(t, uvP2).b,
      );
      return mix(s1, s2, tileBlend);
    };

    // Triplanar cliff: 3-axis projection with dual-scale blend
    const uvFP = mul(vec2(worldPos.x, worldPos.y), tileScale);
    const uvSP = mul(vec2(worldPos.z, worldPos.y), tileScale);
    const uvFP2 = mul(vec2(worldPos.x, worldPos.y), tileScale2);
    const uvSP2 = mul(vec2(worldPos.z, worldPos.y), tileScale2);
    const triCliff = (t: THREE.Texture) => {
      const sFlat = (u: Node) =>
        vec3(texture(t, u).r, texture(t, u).g, texture(t, u).b);
      const s1 = add(
        add(mul(sFlat(uvP), twY), mul(sFlat(uvSP), twX)),
        mul(sFlat(uvFP), twZ),
      );
      const s2 = add(
        add(mul(sFlat(uvP2), twY), mul(sFlat(uvSP2), twX)),
        mul(sFlat(uvFP2), twZ),
      );
      return mix(s1, s2, tileBlend);
    };

    // Sample all biome textures
    const sGrass = dualFlat(tGrass);
    const sDirt = dualFlat(tDirt);
    const sDesertGrass = dualFlat(tDesertGrass);
    const sDesertDirt = dualFlat(tDesertDirt);
    const sSnowGrass = dualFlat(tSnowGrass);
    const sSnowDirt = dualFlat(tSnowDirt);
    const sCliff = triCliff(tCliff);
    const sDesertCliff = triCliff(tDesertCliff);
    const sSnowCliff = triCliff(tSnowCliff);

    // Darken to match procedural brightness range
    const TEX_DARKEN = float(0.65);

    // Per-biome textured colors (blended by biome weights)
    const texGrass = mul(
      add(add(mul(sSnowGrass, tW), mul(sGrass, fW)), mul(sDesertGrass, dW)),
      TEX_DARKEN,
    );
    const texDirt = mul(
      add(add(mul(sSnowDirt, tW), mul(sDirt, fW)), mul(sDesertDirt, dW)),
      TEX_DARKEN,
    );
    const texCliff = mul(
      add(add(mul(sSnowCliff, tW), mul(sCliff, fW)), mul(sDesertCliff, dW)),
      TEX_DARKEN,
    );

    // Compute textured terrain color using same blend logic as procedural path
    let texBase: Node = texGrass;
    texBase = mix(texBase, texDirt, mul(dirtPatchFactor, flatnessFactor));
    texBase = mix(texBase, texDirt, mul(dirtSlopeFactor, float(0.6)));
    texBase = mix(
      texBase,
      texCliff,
      smoothstep(float(0.3), float(0.55), distortedSlope),
    );
    texBase = mix(
      texBase,
      mul(sDesertGrass, TEX_DARKEN),
      mul(sandBlend, sandStrength),
    );
    texBase = mix(
      texBase,
      mul(texDirt, float(0.7)),
      mul(smoothstep(float(22.0), float(14.0), distortedHeight), float(0.4)),
    );
    texBase = mix(
      texBase,
      mul(texDirt, float(0.4)),
      mul(smoothstep(float(15.0), float(10.0), distortedHeight), float(0.7)),
    );

    // Replace procedural base with textured version
    baseColor = texBase;
  }

  // === ANTI-DITHERING ===
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

  // === ROAD OVERLAY (optional) ===
  // Multi-technique procedural dirt road: noise-distorted edges, height-based
  // blending, multi-layer composition, edge border darkening
  let colorWithRoads: Node = variedColor;
  let roadRoughnessBlend: Node = float(1.0); // terrain default roughness
  if (includeRoadOverlay) {
    const roadInfluence = terrainBlend.z;
    const roadUV = vec2(worldPos.x, worldPos.z);

    // --- Multi-scale noise samples ---
    const rn1 = texture(noiseTex, mul(roadUV, float(0.015))).r; // large patches
    const rn2 = texture(noiseTex, mul(roadUV, float(0.045))).r; // medium detail
    const rn3 = texture(noiseTex, mul(roadUV, float(0.12))).r; // fine grain
    const rn4 = texture(noiseTex, mul(roadUV, float(0.3))).r; // micro detail

    // === NOISE-DISTORTED EDGE MASK ===
    // Distort roadInfluence with noise for irregular, natural-looking edges
    const edgeDistortion = add(
      mul(sub(rn2, float(0.5)), float(0.35)), // medium wiggles
      mul(sub(rn3, float(0.5)), float(0.15)), // fine roughness
    );
    const distortedInfluence = add(roadInfluence, edgeDistortion);
    // Sharp-ish smoothstep for defined edges (0.25-0.55 controls edge width)
    const roadMask = smoothstep(float(0.25), float(0.55), distortedInfluence);

    // === MULTI-LAYER ROAD COMPOSITION ===
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
    // Darken the cracks between gravel
    const withCracks = mix(
      mul(withGravel, float(0.82)),
      withGravel,
      gravelShadow,
    );

    // Layer 4: wear track darkening (center of road, compacted)
    const wearTrack = mul(mul(roadMask, roadMask), roadMask); // pow(roadMask, 3)
    const wornRoad = mul(withCracks, mix(float(1.0), float(0.88), wearTrack));

    // Layer 5: grass tufts at road margins (edge scatter)
    const edgeZone = mul(
      smoothstep(float(0.15), float(0.4), roadMask),
      smoothstep(float(0.75), float(0.45), roadMask),
    );
    const edgeScatter = mul(edgeZone, smoothstep(float(0.4), float(0.65), rn2));
    const roadDetailColor = mix(
      wornRoad,
      variedColor,
      mul(edgeScatter, float(0.4)),
    );

    // === HEIGHT-BASED BLENDING ===
    // Grass "pokes through" road at edges (taller grass wins over short dirt)
    const grassH = add(mul(noiseValue, float(0.4)), float(0.6));
    const roadH = add(mul(rn3, float(0.3)), float(0.1));
    const grassBl = add(grassH, mul(sub(float(1.0), roadMask), float(2.0)));
    const roadBl = add(roadH, mul(roadMask, float(2.0)));
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

    // === EDGE BORDER DARKENING ===
    // Narrow dark band at road edge for readability
    const edgeBand = mul(
      smoothstep(float(0.28), float(0.4), roadMask),
      smoothstep(float(0.55), float(0.42), roadMask),
    );
    const borderDarken = mul(edgeBand, float(0.12));
    colorWithRoads = mul(heightBlended, sub(float(1.0), borderDarken));

    // === ROAD ROUGHNESS ===
    // Gravel rough, compacted center smoother
    const roadRoughGravel = mix(
      float(0.65),
      float(0.92),
      sub(float(1.0), gravelShadow),
    );
    const roadRough = mix(roadRoughGravel, float(0.55), wearTrack);
    roadRoughnessBlend = mix(float(1.0), roadRough, roadMask);
  }

  // === MINE FLOOR OVERLAY (optional) ===
  // AAA multi-layered rocky quarry floor: exposed bedrock, gravel scatter,
  // dirt accumulation, radial center-to-edge gradient, height-based edge
  // blending with surrounding terrain. Matches road overlay quality level.
  let colorWithMines: Node = colorWithRoads;
  let mineRoughnessBlend: Node = roadRoughnessBlend;
  if (includeMineOverlay) {
    const mineInfluence = terrainBlend.w;
    const mineBiomeId = biomeDataAttr.y;

    // Mine-specific noise at scales appropriate for 15-25m mine areas
    const mineUV = vec2(worldPos.x, worldPos.z);
    const mn1 = texture(noiseTex, mul(mineUV, float(0.035))).r; // stone slabs (~28m)
    const mn2 = texture(noiseTex, mul(mineUV, float(0.14))).r; // stone surface (~7m)
    const mn3 = texture(noiseTex, mul(mineUV, float(0.5))).r; // gravel (~2m)
    const mn4 = texture(noiseTex, mul(mineUV, float(1.4))).r; // micro cracks (~0.7m)

    // === NOISE-DISTORTED ORGANIC EDGE ===
    const mineEdgeDistortion = add(
      mul(sub(mn1, float(0.5)), float(0.22)),
      add(
        mul(sub(mn2, float(0.5)), float(0.14)),
        mul(sub(mn3, float(0.5)), float(0.06)),
      ),
    );
    const distortedInfluence = add(mineInfluence, mineEdgeDistortion);

    // Two-tier mask: core (solid floor) and edge (transition zone)
    const coreMask = smoothstep(float(0.42), float(0.68), distortedInfluence);
    const edgeMask = smoothstep(float(0.12), float(0.42), distortedInfluence);

    // === BIOME COLOR PALETTE (from shared MINE_BIOME_PALETTES) ===
    // 0=forest, 1=tundra, 2=desert, 3=mountains, 4=plains, 5=swamp, 6=valley
    const MP = MINE_BIOME_PALETTES;

    // Biome selection masks
    const b = mineBiomeId;
    const isForest = mul(
      smoothstep(float(-0.5), float(0.5), b),
      smoothstep(float(1.5), float(0.5), b),
    );
    const isTundra = mul(
      smoothstep(float(0.5), float(1.5), b),
      smoothstep(float(2.5), float(1.5), b),
    );
    const isDesert = mul(
      smoothstep(float(1.5), float(2.5), b),
      smoothstep(float(3.5), float(2.5), b),
    );
    const isMountain = mul(
      smoothstep(float(2.5), float(3.5), b),
      smoothstep(float(4.5), float(3.5), b),
    );
    const isSwamp = mul(
      smoothstep(float(4.5), float(5.5), b),
      smoothstep(float(6.5), float(5.5), b),
    );
    const isValley = smoothstep(float(5.5), float(6.5), b);

    // Build primary (bedrock)
    let minePrimary: Node = vec3(...MP.plains.primary);
    minePrimary = mix(minePrimary, vec3(...MP.forest.primary), isForest);
    minePrimary = mix(minePrimary, vec3(...MP.tundra.primary), isTundra);
    minePrimary = mix(minePrimary, vec3(...MP.desert.primary), isDesert);
    minePrimary = mix(minePrimary, vec3(...MP.mountains.primary), isMountain);
    minePrimary = mix(minePrimary, vec3(...MP.swamp.primary), isSwamp);
    minePrimary = mix(minePrimary, vec3(...MP.valley.primary), isValley);

    // Build secondary (dark crevices)
    let mineSecondary: Node = vec3(...MP.plains.secondary);
    mineSecondary = mix(mineSecondary, vec3(...MP.forest.secondary), isForest);
    mineSecondary = mix(mineSecondary, vec3(...MP.tundra.secondary), isTundra);
    mineSecondary = mix(mineSecondary, vec3(...MP.desert.secondary), isDesert);
    mineSecondary = mix(
      mineSecondary,
      vec3(...MP.mountains.secondary),
      isMountain,
    );
    mineSecondary = mix(mineSecondary, vec3(...MP.swamp.secondary), isSwamp);
    mineSecondary = mix(mineSecondary, vec3(...MP.valley.secondary), isValley);

    // Build tertiary (gravel highlights)
    let mineTertiary: Node = vec3(...MP.plains.tertiary);
    mineTertiary = mix(mineTertiary, vec3(...MP.forest.tertiary), isForest);
    mineTertiary = mix(mineTertiary, vec3(...MP.tundra.tertiary), isTundra);
    mineTertiary = mix(mineTertiary, vec3(...MP.desert.tertiary), isDesert);
    mineTertiary = mix(
      mineTertiary,
      vec3(...MP.mountains.tertiary),
      isMountain,
    );
    mineTertiary = mix(mineTertiary, vec3(...MP.swamp.tertiary), isSwamp);
    mineTertiary = mix(mineTertiary, vec3(...MP.valley.tertiary), isValley);

    // === LAYER 1: EXPOSED BEDROCK BASE ===
    // Large stone slab pattern — broad patches of primary/secondary
    const slabPattern = smoothstep(float(0.32), float(0.68), mn1);
    const bedrockColor = mix(minePrimary, mineSecondary, slabPattern);

    // === LAYER 2: STONE SURFACE TEXTURE ===
    // Medium-scale surface detail — highlights and shadows on stone faces
    const surfaceLight = smoothstep(float(0.45), float(0.75), mn2);
    const surfaceShadow = smoothstep(float(0.35), float(0.15), mn2);
    const texturedStone = mul(
      mix(bedrockColor, mineTertiary, mul(surfaceLight, float(0.35))),
      mix(float(1.0), float(0.88), surfaceShadow),
    );

    // === LAYER 3: GRAVEL / CRUSHED STONE SCATTER ===
    // High-freq pebble highlights with shadows between stones
    const gravelHighlight = smoothstep(float(0.58), float(0.78), mn3);
    const gravelShadow = smoothstep(float(0.22), float(0.38), mn3);
    const withGravel = mix(
      texturedStone,
      mineTertiary,
      mul(gravelHighlight, float(0.3)),
    );
    // Darken cracks between pebbles
    const withCracks = mix(
      mul(withGravel, float(0.84)),
      withGravel,
      gravelShadow,
    );

    // === LAYER 4: MICRO CRACK / SURFACE IMPERFECTIONS ===
    const crackMask = smoothstep(float(0.42), float(0.58), mn4);
    const withMicroDetail = mul(
      withCracks,
      mix(float(0.92), float(1.02), crackMask),
    );

    // === LAYER 5: RADIAL GRADIENT (center rock → edge gravel/dirt) ===
    // mineInfluence is high at center, low at edges
    const centerWeight = smoothstep(float(0.45), float(0.85), mineInfluence);
    // Edges get more gravel + dirt mixed in
    const dirtBlend = mix(mineSecondary, minePrimary, float(0.4));
    const edgeGravelDirt = mix(dirtBlend, mineTertiary, mn3);
    const radialMixed = mix(
      mix(withMicroDetail, edgeGravelDirt, float(0.4)), // edges: 40% gravel/dirt
      withMicroDetail, // center: pure detailed stone
      centerWeight,
    );

    // === LAYER 6: WEAR / FOOT TRAFFIC (darkened compacted areas) ===
    // Random patches of worn, compacted stone (like well-trodden mine paths)
    const wearPattern = smoothstep(float(0.55), float(0.75), mn1);
    const wearDarken = mul(wearPattern, mul(coreMask, float(0.08)));
    const wornFloor = mul(radialMixed, sub(float(1.0), wearDarken));

    // === LAYER 7: HEIGHT-BASED EDGE BLENDING ===
    // Terrain naturally blends into mine floor at edges (grass/soil competition)
    const terrainH = add(mul(noiseValue, float(0.4)), float(0.6));
    const mineFloorH = add(mul(mn2, float(0.3)), float(0.2));
    const terrainBias = add(
      terrainH,
      mul(sub(float(1.0), edgeMask), float(2.0)),
    );
    const mineBias = add(mineFloorH, mul(edgeMask, float(2.0)));
    const maxBias = tslMax(terrainBias, mineBias);
    const blendDepth = float(0.18);
    const blendThresh = sub(maxBias, blendDepth);
    const tWeight = tslMax(sub(terrainBias, blendThresh), float(0.0));
    const mWeight = tslMax(sub(mineBias, blendThresh), float(0.0));
    const totalWeight = add(tWeight, mWeight);
    const heightBlended = div(
      add(mul(colorWithRoads, tWeight), mul(wornFloor, mWeight)),
      totalWeight,
    );

    // === LAYER 8: EDGE DARKENING BAND ===
    // Narrow dark rim at mine boundary for visual definition (disturbed earth)
    const edgeBand = mul(
      smoothstep(float(0.15), float(0.32), edgeMask),
      smoothstep(float(0.52), float(0.32), edgeMask),
    );
    const borderDarken = mul(edgeBand, float(0.14));
    const mineFloorFinal = mul(heightBlended, sub(float(1.0), borderDarken));

    // Final blend
    colorWithMines = mix(colorWithRoads, mineFloorFinal, edgeMask);

    // === ROUGHNESS ===
    // Exposed rock = rough, gravel = medium-rough, compacted areas slightly smoother
    const rockRoughness = mix(
      float(0.82),
      float(0.96),
      sub(float(1.0), surfaceLight),
    );
    const gravelRoughBlend = mix(
      rockRoughness,
      float(0.88),
      mul(gravelHighlight, float(0.4)),
    );
    const compactSmooth = mul(wearPattern, mul(coreMask, float(0.12)));
    const mineRoughness = sub(gravelRoughBlend, compactSmooth);
    mineRoughnessBlend = mix(roadRoughnessBlend, mineRoughness, edgeMask);
  }

  // === MATERIAL LAYER SPLATMAP BLENDING (optional) ===
  // Reads materialWeights0 (grass, dirt, rock, sand) and materialWeights1 (snow, gravel, mud, volcanic).
  // When total weight > 0, overrides the procedural biome color with explicit material layers.
  // When total weight == 0, falls through to existing biome-blended color (backward compat).
  let colorAfterMaterials: Node = colorWithMines;
  let roughnessAfterMaterials: Node = mineRoughnessBlend;
  if (includeMaterialLayers) {
    const mw0 = attribute("materialWeights0", "vec4");
    const mw1 = attribute("materialWeights1", "vec4");
    const totalMatWeight = add(
      add(add(mw0.x, mw0.y), add(mw0.z, mw0.w)),
      add(add(mw1.x, mw1.y), add(mw1.z, mw1.w)),
    );

    // Procedural color per material layer (reuses existing noise samples for zero extra cost)
    const ML = MATERIAL_LAYER_DEFINITIONS;
    const matLayerColors: Node[] = ML.map((layer) =>
      mix(
        vec3(...layer.colorLight),
        vec3(...layer.colorDark),
        grassVariation, // reuse existing noise-based variation
      ),
    );

    // Weighted blend: sum(weight_i * color_i) / totalWeight
    let matColorSum: Node = mul(matLayerColors[0], mw0.x);
    matColorSum = add(matColorSum, mul(matLayerColors[1], mw0.y));
    matColorSum = add(matColorSum, mul(matLayerColors[2], mw0.z));
    matColorSum = add(matColorSum, mul(matLayerColors[3], mw0.w));
    matColorSum = add(matColorSum, mul(matLayerColors[4], mw1.x));
    matColorSum = add(matColorSum, mul(matLayerColors[5], mw1.y));
    matColorSum = add(matColorSum, mul(matLayerColors[6], mw1.z));
    matColorSum = add(matColorSum, mul(matLayerColors[7], mw1.w));
    const matColor = div(matColorSum, tslMax(totalMatWeight, float(0.001)));

    // Per-layer roughness blend
    const matRoughValues = ML.map((l) => float(l.roughness));
    let matRoughSum: Node = mul(matRoughValues[0], mw0.x);
    matRoughSum = add(matRoughSum, mul(matRoughValues[1], mw0.y));
    matRoughSum = add(matRoughSum, mul(matRoughValues[2], mw0.z));
    matRoughSum = add(matRoughSum, mul(matRoughValues[3], mw0.w));
    matRoughSum = add(matRoughSum, mul(matRoughValues[4], mw1.x));
    matRoughSum = add(matRoughSum, mul(matRoughValues[5], mw1.y));
    matRoughSum = add(matRoughSum, mul(matRoughValues[6], mw1.z));
    matRoughSum = add(matRoughSum, mul(matRoughValues[7], mw1.w));
    const matRoughness = div(matRoughSum, tslMax(totalMatWeight, float(0.001)));

    // Crossfade: 0 weight = biome fallback, any weight = material layer
    const matBlend = smoothstep(float(0.0), float(0.01), totalMatWeight);
    colorAfterMaterials = mix(colorWithMines, matColor, matBlend);
    roughnessAfterMaterials = mix(mineRoughnessBlend, matRoughness, matBlend);
  }

  // === ANIME SHADING (Phase 7) ===
  // Half-lambert cool tint on shadow side + fresnel rim highlight.
  // Constants inlined from LightingConfig.SUN_SHADE to avoid circular dep.
  let colorAfterShading = colorAfterMaterials;
  if (options.animeShading) {
    const sunDir = normalize(vec3(sunPositionUniform));
    const NdotL = dot(normalWorld, sunDir);
    const halfLambert = add(mul(NdotL, float(0.5)), float(0.5));
    const shadeFactor = sub(float(1.0), halfLambert);
    // Game parity: STRENGTH=0.7, FRESNEL_POWER=3, FRESNEL_INTENSITY=0.2
    const coolTint = vec3(0.0, 0.5, 0.7);
    const tintedBase = mul(colorAfterMaterials, coolTint);
    colorAfterShading = mix(
      colorAfterMaterials,
      tintedBase,
      mul(shadeFactor, float(0.7)),
    );

    // Fresnel rim highlight
    const viewDir = normalize(sub(positionWorld, cameraPosition));
    const rim = clamp(
      add(float(1.0), dot(viewDir, normalWorld)),
      float(0.0),
      float(1.0),
    );
    const fresnelRim = mul(pow(rim, float(3.0)), float(0.2));
    colorAfterShading = add(
      colorAfterShading,
      vec3(fresnelRim, fresnelRim, fresnelRim),
    );
  }

  // === SATURATION BOOST ===
  const satBoost =
    options.saturationBoost ?? TERRAIN_CONSTANTS.SATURATION_BOOST;
  if (satBoost !== 1.0) {
    const luma = dot(colorAfterShading, vec3(0.299, 0.587, 0.114));
    const grey = vec3(luma, luma, luma);
    colorAfterShading = mix(grey, colorAfterShading, float(satBoost));
  }

  // === DISTANCE FOG ===
  const baseFogFactor = smoothstep(fogNearSqUniform, fogFarSqUniform, distSq);
  const fogFactor = mul(baseFogFactor, fogEnabledUniform);
  const finalColor = mix(colorAfterShading, fogColorUniform, fogFactor);

  // === CREATE MATERIAL ===
  const material = new MeshStandardNodeMaterial();
  material.colorNode = finalColor;
  material.roughnessNode = roughnessAfterMaterials;
  material.metalness = 0.0;
  material.side = THREE.FrontSide;
  material.fog = false;

  const terrainUniforms: TerrainUniforms = {
    sunPosition: sunPositionUniform,
    time: timeUniform,
    fogNear: fogNearUniform,
    fogFar: fogFarUniform,
    fogNearSq: fogNearSqUniform,
    fogFarSq: fogFarSqUniform,
    fogColor: fogColorUniform,
    fogEnabled: fogEnabledUniform,
  };

  const result = material as typeof material & {
    terrainUniforms: TerrainUniforms;
  };
  result.terrainUniforms = terrainUniforms;
  return result;
}

/**
 * Update fog uniforms
 */
export function updateTerrainFog(
  uniforms: TerrainUniforms,
  near: number,
  far: number,
  color?: THREE.Color,
): void {
  uniforms.fogNear.value = near;
  uniforms.fogFar.value = far;
  uniforms.fogNearSq.value = near * near;
  uniforms.fogFarSq.value = far * far;
  if (color) {
    (uniforms.fogColor.value as THREE.Vector3).set(color.r, color.g, color.b);
  }
}

/**
 * Enable/disable fog
 */
export function setTerrainFogEnabled(
  uniforms: TerrainUniforms,
  enabled: boolean,
): void {
  uniforms.fogEnabled.value = enabled ? 1.0 : 0.0;
}
