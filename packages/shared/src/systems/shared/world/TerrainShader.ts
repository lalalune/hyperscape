/**
 * TerrainShader - TSL Node Material for OSRS-style vertex color terrain
 * Flat shaded, no textures - pure vertex colors based on height/slope/noise
 */

import * as THREE from "../../../extras/three/three";
import {
  MeshStandardNodeMaterial,
  texture,
  positionWorld,
  normalWorld,
  cameraPosition,
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
} from "../../../extras/three/three";

export const TERRAIN_CONSTANTS = {
  TRIPLANAR_SCALE: 0.5, // Unused in OSRS style but kept for compatibility
  SNOW_HEIGHT: 50.0,
  FOG_NEAR: 150.0, // Default fog near distance
  FOG_FAR: 350.0, // Default fog far distance
  NOISE_SCALE: 0.0008, // For dirt patch variation
  DIRT_THRESHOLD: 0.5,
  LOD_FULL_DETAIL: 100.0,
  LOD_MEDIUM_DETAIL: 200.0,
  // OSRS style water level
  WATER_LEVEL: 5.0,
  // Default fog color (warm beige)
  FOG_COLOR: new THREE.Color(0xd4c8b8),
};

// ============================================================================
// PERLIN NOISE TEXTURE GENERATION
// ============================================================================

// Cached noise texture - generated once, reused everywhere
let cachedNoiseTexture: THREE.DataTexture | null = null;
const NOISE_SIZE = 256; // Texture resolution

// Simple Perlin-like noise implementation
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

// Seeded permutation table for deterministic noise
function createPermutation(seed: number): number[] {
  const p: number[] = [];
  for (let i = 0; i < 256; i++) p[i] = i;

  // Fisher-Yates shuffle with seed
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }

  // Double the permutation table
  return [...p, ...p];
}

function perlin2D(x: number, y: number, perm: number[]): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[X] + Y];
  const ab = perm[perm[X] + Y + 1];
  const ba = perm[perm[X + 1] + Y];
  const bb = perm[perm[X + 1] + Y + 1];

  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);

  return lerp(x1, x2, v);
}

// Multi-octave fractal noise (non-seamless version, kept for reference)
function _fbm(
  x: number,
  y: number,
  perm: number[],
  octaves: number = 4,
): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * perlin2D(x * frequency, y * frequency, perm);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

/**
 * Seamless 2D Perlin noise using proper torus mapping
 * Maps the 2D plane onto a 4D torus to eliminate seams
 */
function seamlessPerlin2D(x: number, y: number, perm: number[]): number {
  // Map 2D coordinates to 4D torus
  // This creates truly seamless tiling
  const TWO_PI = Math.PI * 2;
  const radius = 1.0;

  // Convert to angles (0-1 maps to 0-2PI)
  const angleX = x * TWO_PI;
  const angleY = y * TWO_PI;

  // Map to 4D coordinates on a torus
  const nx = Math.cos(angleX) * radius;
  const ny = Math.sin(angleX) * radius;
  const nz = Math.cos(angleY) * radius;
  const nw = Math.sin(angleY) * radius;

  // Sample 2D noise at 4 different 2D positions and blend
  // This simulates 4D noise sampling using 2D noise
  const n1 = perlin2D(nx * 4 + 100, nz * 4 + 100, perm);
  const n2 = perlin2D(ny * 4 + 200, nw * 4 + 200, perm);
  const n3 = perlin2D(nx * 4 + ny * 4 + 300, nz * 4 + nw * 4 + 300, perm);

  return (n1 + n2 + n3) / 3;
}

/**
 * Multi-octave seamless fractal noise
 */
function seamlessFbm(
  x: number,
  y: number,
  perm: number[],
  octaves: number = 4,
): number {
  let value = 0;
  let amplitude = 0.5;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    // Each octave uses a different offset to add variation
    const ox = x + i * 17.3;
    const oy = y + i * 31.7;
    value += amplitude * seamlessPerlin2D(ox, oy, perm);
    maxValue += amplitude;
    amplitude *= 0.5;
  }

  return value / maxValue;
}

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
  const u = worldX * TERRAIN_CONSTANTS.NOISE_SCALE;
  const v = worldZ * TERRAIN_CONSTANTS.NOISE_SCALE;

  // The texture tiles, so wrap to 0-1
  const wrappedU = u - Math.floor(u);
  const wrappedV = v - Math.floor(v);

  // Sample the same seamless noise function used to generate the texture
  const noise = seamlessFbm(wrappedU, wrappedV, cachedPerm, 4);
  return (noise + 1) * 0.5;
}

// ============================================================================
// TERRAIN MATERIAL - OSRS Style (No Textures)
// ============================================================================

export type TerrainUniforms = {
  sunPosition: { value: THREE.Vector3 };
  time: { value: number };
  fogNear: { value: number };
  fogFar: { value: number };
  fogNearSq: { value: number }; // Pre-computed fogNear^2 for GPU optimization
  fogFarSq: { value: number }; // Pre-computed fogFar^2 for GPU optimization
  fogColor: { value: THREE.Vector3 };
  fogEnabled: { value: number }; // 1.0 = fog enabled, 0.0 = fog disabled (for minimap)
};

/**
 * OSRS-style vertex color terrain material
 * No textures - pure flat shaded colors based on height, slope, and noise
 */
export function createTerrainMaterial(): THREE.Material & {
  terrainUniforms: TerrainUniforms;
} {
  // Ensure noise texture is generated (still used for dirt patch variation)
  const noiseTex = generateNoiseTexture();

  const sunPositionUniform = uniform(vec3(100, 100, 100));
  const timeUniform = uniform(float(0));
  const noiseScale = uniform(float(TERRAIN_CONSTANTS.NOISE_SCALE));

  // Fog uniforms - sync with Environment system
  // PRE-COMPUTE squared distances to avoid per-fragment multiplication
  const fogNearUniform = uniform(float(TERRAIN_CONSTANTS.FOG_NEAR));
  const fogFarUniform = uniform(float(TERRAIN_CONSTANTS.FOG_FAR));
  const fogNearSqUniform = uniform(
    float(TERRAIN_CONSTANTS.FOG_NEAR * TERRAIN_CONSTANTS.FOG_NEAR),
  );
  const fogFarSqUniform = uniform(
    float(TERRAIN_CONSTANTS.FOG_FAR * TERRAIN_CONSTANTS.FOG_FAR),
  );
  const fogColorUniform = uniform(
    vec3(
      TERRAIN_CONSTANTS.FOG_COLOR.r,
      TERRAIN_CONSTANTS.FOG_COLOR.g,
      TERRAIN_CONSTANTS.FOG_COLOR.b,
    ),
  );
  // Fog enabled: 1.0 = normal fog, 0.0 = no fog (for minimap rendering)
  const fogEnabledUniform = uniform(float(1.0));

  const worldPos = positionWorld;
  const worldNormal = normalWorld;
  const height = worldPos.y;
  const slope = sub(float(1.0), abs(worldNormal.y));

  // ============================================================================
  // OSRS-STYLE VERTEX COLORS
  // Flat, distinct colors - no gradients, no textures
  // ============================================================================

  // Core terrain colors (OSRS palette)
  const grassGreen = vec3(0.3, 0.55, 0.15); // Rich green grass
  const grassDark = vec3(0.22, 0.42, 0.1); // Darker grass variation
  const dirtBrown = vec3(0.45, 0.32, 0.18); // Light brown dirt
  const dirtDark = vec3(0.32, 0.22, 0.12); // Dark brown dirt
  const rockGray = vec3(0.45, 0.42, 0.38); // Gray rock
  const rockDark = vec3(0.3, 0.28, 0.25); // Dark rock
  const sandYellow = vec3(0.7, 0.6, 0.38); // Sandy beach
  const snowWhite = vec3(0.92, 0.94, 0.96); // Snow caps
  const mudBrown = vec3(0.18, 0.12, 0.08); // Wet mud near water
  const waterEdge = vec3(0.08, 0.06, 0.04); // Dark water's edge

  // ============================================================================
  // DISTANCE-BASED LOD FOR NOISE SAMPLING
  // PERFORMANCE: Reduced from 4 to 2 texture samples (compute derived values instead)
  // ============================================================================
  const toCamera = sub(worldPos, cameraPosition);
  const distSq = add(
    add(mul(toCamera.x, toCamera.x), mul(toCamera.y, toCamera.y)),
    mul(toCamera.z, toCamera.z),
  );
  // LOD threshold: 100m^2 = 10000 - closer threshold for faster falloff
  const _lodDetailFactor = smoothstep(float(15000.0), float(8000.0), distSq);

  // Sample Perlin noise - ONLY 1 base sample always needed
  const noiseUV = mul(vec2(worldPos.x, worldPos.z), noiseScale);
  const noiseValue = texture(noiseTex, noiseUV).r;

  // PERFORMANCE: Derive secondary noise mathematically instead of texture sample
  // Uses sin transform of base noise for variation (no extra texture fetch)
  const noiseValue2 = add(
    mul(sin(mul(noiseValue, float(6.28))), float(0.3)),
    float(0.5),
  );

  // CONDITIONAL fine detail sample - only when close
  // Uses step function to completely skip sample at distance (cheaper than smoothstep mix)
  const closeEnough = smoothstep(float(12000.0), float(8000.0), distSq);
  const noiseUV3 = mul(vec2(worldPos.x, worldPos.z), float(0.12));
  const fineNoiseSample = texture(noiseTex, noiseUV3).r;
  const fineNoise = mix(float(0.5), fineNoiseSample, closeEnough);

  // PERFORMANCE: Derive micro noise from base noise (no 4th texture sample)
  const microNoise = add(
    mul(cos(mul(noiseValue, float(12.56))), float(0.2)),
    float(0.5),
  );

  // === BASE: GRASS with light/dark variation ===
  const grassVariation = smoothstep(float(0.4), float(0.6), noiseValue2);
  let baseColor = mix(grassGreen, grassDark, grassVariation);

  // === DIRT PATCHES (noise-based, flat ground only) ===
  // Wider transition for smoother blending
  const dirtPatchFactor = smoothstep(
    float(TERRAIN_CONSTANTS.DIRT_THRESHOLD - 0.05),
    float(TERRAIN_CONSTANTS.DIRT_THRESHOLD + 0.15),
    noiseValue,
  );
  const flatnessFactor = smoothstep(float(0.3), float(0.05), slope);
  const dirtVariation = smoothstep(float(0.3), float(0.7), noiseValue2);
  const dirtColor = mix(dirtBrown, dirtDark, dirtVariation);
  baseColor = mix(baseColor, dirtColor, mul(dirtPatchFactor, flatnessFactor));

  // === SLOPE-BASED DIRT (steeper = more dirt) ===
  // Gradual transition
  baseColor = mix(
    baseColor,
    dirtColor,
    mul(smoothstep(float(0.15), float(0.5), slope), float(0.6)),
  );

  // === ROCK ON STEEP SLOPES ===
  const rockVariation = smoothstep(float(0.3), float(0.7), noiseValue);
  const rockColorFinal = mix(rockGray, rockDark, rockVariation);
  baseColor = mix(
    baseColor,
    rockColorFinal,
    smoothstep(float(0.45), float(0.75), slope),
  );

  // === SNOW AT HIGH ELEVATION ===
  // Very gradual snow transition
  baseColor = mix(
    baseColor,
    snowWhite,
    smoothstep(float(TERRAIN_CONSTANTS.SNOW_HEIGHT - 5.0), float(60.0), height),
  );

  // === SAND NEAR WATER (flat areas only) ===
  const sandBlend = mul(
    smoothstep(float(10.0), float(6.0), height),
    smoothstep(float(0.25), float(0.0), slope),
  );
  baseColor = mix(baseColor, sandYellow, mul(sandBlend, float(0.6)));

  // === SHORELINE TRANSITIONS (gradual) ===
  // Zone 1: Wet dirt (8-14m) - wider zone
  const wetDirtZone = smoothstep(float(14.0), float(8.0), height);
  baseColor = mix(baseColor, dirtDark, mul(wetDirtZone, float(0.4)));

  // Zone 2: Mud (6-9m)
  const mudZone = smoothstep(float(9.0), float(6.0), height);
  baseColor = mix(baseColor, mudBrown, mul(mudZone, float(0.7)));

  // Zone 3: Water's edge (5-6.5m)
  const edgeZone = smoothstep(float(6.5), float(5.0), height);
  baseColor = mix(baseColor, waterEdge, mul(edgeZone, float(0.9)));

  // === ANTI-DITHERING: Add fine noise variation to break up banding ===
  // Subtle brightness variation based on high-frequency noise
  const brightnessVar = mul(sub(fineNoise, float(0.5)), float(0.08)); // ±4% brightness
  const colorVar = mul(sub(microNoise, float(0.5)), float(0.04)); // ±2% color shift

  // Apply variations to break up vertex interpolation artifacts
  const variedColor = add(
    baseColor,
    vec3(
      add(brightnessVar, colorVar),
      brightnessVar,
      sub(brightnessVar, colorVar),
    ),
  );

  // === DISTANCE FOG ===
  // NOTE: distSq already computed above for LOD - reusing it here
  // Fog squared distances are pre-computed uniforms (avoids per-fragment mul)
  // Smoothstep fog factor using squared distances: 0 at fogNear, 1 at fogFar
  // Multiply by fogEnabled to allow complete fog disable (for minimap rendering)
  const baseFogFactor = smoothstep(fogNearSqUniform, fogFarSqUniform, distSq);
  const fogFactor = mul(baseFogFactor, fogEnabledUniform);

  // Mix terrain color with fog color based on distance
  const finalColor = mix(variedColor, fogColorUniform, fogFactor);

  // === CREATE MATERIAL ===
  const material = new MeshStandardNodeMaterial();
  material.colorNode = finalColor;
  material.roughness = 1.0; // Fully matte - no specular
  material.metalness = 0.0;
  material.side = THREE.FrontSide;
  material.fog = false; // We handle fog in the shader
  // Smooth shading (default) - no flat shading

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
