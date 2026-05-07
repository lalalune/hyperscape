/**
 * Biome System
 *
 * Handles biome placement and influence calculations for terrain generation.
 * Implements a grid-jitter placement system with Gaussian influence falloff
 * for smooth, natural biome transitions.
 */

import { NoiseGenerator, createSeededRNG } from "./NoiseGenerator";
import type {
  BiomeConfig,
  BiomeCenter,
  BiomeInfluence,
  BiomeDefinition,
} from "./types";

/**
 * Default biome configuration
 */
export const DEFAULT_BIOME_CONFIG: BiomeConfig = {
  gridSize: 3,
  jitter: 0.35,
  minInfluence: 2000,
  maxInfluence: 3500,
  gaussianCoeff: 0.15,
  boundaryNoiseScale: 0.003,
  boundaryNoiseAmount: 0.15,
};

/**
 * Below this gaussian weight, contributions are visually
 * imperceptible (< 0.01% of dominant biome) and not worth the
 * Map.get / Map.set overhead. Math: at distance ~5x influence
 * radius, weight = exp(-25 * gaussianCoeff) ≈ exp(-3.75) ≈ 0.024.
 * At ~7x: ≈ 0.001. Threshold below picks centers up to roughly
 * the 0.1% mark — generous safety margin while still skipping
 * the long tail.
 */
const MIN_SIGNIFICANT_WEIGHT = 1e-4;

/**
 * Module-scope comparator — declaring it here avoids creating a
 * fresh closure per call to `Array.prototype.sort` on the hot path.
 */
function byWeightDesc(a: BiomeInfluence, b: BiomeInfluence): number {
  return b.weight - a.weight;
}

/**
 * Parallel-array (struct-of-arrays) layout of biome centers for
 * the hot path. Avoids per-vertex pointer chasing through the
 * `BiomeCenter[]` array of objects — cache-friendly iteration over
 * three contiguous Float64Arrays / one string array. Built once
 * at construction; rebuilt only if biomeCenters mutates (rare).
 */
interface BiomeCentersSoA {
  count: number;
  x: Float64Array;
  z: Float64Array;
  influence: Float64Array;
  /** Reciprocal of influence; precomputed to skip per-vertex divide. */
  invInfluence: Float64Array;
  type: string[];
}

/**
 * BiomeSystem handles biome placement and influence calculations
 */
export class BiomeSystem {
  private readonly config: BiomeConfig;
  private readonly biomeDefinitions: Record<string, BiomeDefinition>;
  private readonly noise: NoiseGenerator;
  private readonly worldSize: number;
  private biomeCenters: BiomeCenter[] = [];

  /**
   * Per-instance pooled scratch state for `getBiomeInfluencesAtPosition`.
   *
   * Why pooled: that function is on the hottest path of the entire
   * pipeline (called once per vertex during tile mesh generation —
   * tens of millions of calls per world regen). Allocating a new
   * `Map<string, number>` and `BiomeInfluence[]` per call cost
   * ~3M+ allocations per regen and dominated GC pressure (the
   * actual cause of the user's 2 FPS regression — the function's
   * arithmetic is fast; its garbage isn't).
   *
   * Pooling caveat: the returned `BiomeInfluence[]` is a BORROWED
   * reference into `_pooledInfluences`. The caller must consume it
   * synchronously and not retain past the next call. The two
   * existing call sites (`getDominantBiome` reads `[0].type`
   * immediately; `TerrainGenerator.queryPoint` stores it on a
   * query object that's read inline by `terrainHelpers.generate
   * TileGeometry`) both satisfy this contract.
   */
  private readonly _pooledWeightMap = new Map<string, number>();
  private readonly _pooledInfluences: BiomeInfluence[] = [];
  /** Pre-allocated `BiomeInfluence` objects we re-use slot-by-slot. */
  private readonly _influenceObjectPool: BiomeInfluence[] = [];
  /** SoA mirror of `biomeCenters` for cache-friendly iteration. */
  private centersSoA: BiomeCentersSoA = {
    count: 0,
    x: new Float64Array(0),
    z: new Float64Array(0),
    influence: new Float64Array(0),
    invInfluence: new Float64Array(0),
    type: [],
  };

  constructor(
    seed: number,
    worldSizeMeters: number,
    config: Partial<BiomeConfig> = {},
    biomeDefinitions: Record<string, BiomeDefinition> = {},
  ) {
    this.config = { ...DEFAULT_BIOME_CONFIG, ...config };
    this.biomeDefinitions = biomeDefinitions;
    this.noise = new NoiseGenerator(seed);
    this.worldSize = worldSizeMeters;

    this.initializeBiomeCenters(seed);
    this.rebuildCentersSoA();

    for (const id of Object.keys(this.biomeDefinitions)) {
      this.biomeIds[id] = this.nextBiomeId++;
    }
  }

  /**
   * Rebuild the parallel-array layout from `biomeCenters`. Cheap —
   * runs once at construction and again if `biomeCenters` is ever
   * mutated.
   */
  private rebuildCentersSoA(): void {
    const n = this.biomeCenters.length;
    const xs = new Float64Array(n);
    const zs = new Float64Array(n);
    const inf = new Float64Array(n);
    const invInf = new Float64Array(n);
    const types: string[] = new Array<string>(n);
    for (let i = 0; i < n; i++) {
      const c = this.biomeCenters[i];
      xs[i] = c.x;
      zs[i] = c.z;
      inf[i] = c.influence;
      invInf[i] = c.influence > 0 ? 1 / c.influence : 0;
      types[i] = c.type;
    }
    this.centersSoA = {
      count: n,
      x: xs,
      z: zs,
      influence: inf,
      invInfluence: invInf,
      type: types,
    };
  }

  /**
   * Compute biome centers arranged in a regular polygon.
   * For 3 types = equilateral triangle, 4 = square, etc.
   * Generalizes the island-style biome placement for any N.
   */
  static computePolygonCenters(
    biomeTypes: string[],
    radius: number,
    influence: number,
  ): BiomeCenter[] {
    const centers: BiomeCenter[] = [];
    for (let i = 0; i < biomeTypes.length; i++) {
      const angle = (i / biomeTypes.length) * Math.PI * 2 - Math.PI / 2;
      centers.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        type: biomeTypes[i],
        influence,
      });
    }
    return centers;
  }

  /**
   * Initialize biome centers using deterministic grid-jitter placement
   */
  private initializeBiomeCenters(seed: number): void {
    if (this.config.explicitCenters) {
      this.biomeCenters = [...this.config.explicitCenters];
      return;
    }

    const { gridSize, jitter, minInfluence, maxInfluence } = this.config;
    const cellSize = this.worldSize / gridSize;

    // Use deterministic PRNG for reproducible biome placement
    const random = createSeededRNG(seed);

    const biomeTypes = Object.keys(this.biomeDefinitions);
    if (biomeTypes.length === 0) {
      return;
    }

    this.biomeCenters = [];

    // Grid-jitter placement for even distribution
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        // Base position at grid cell center
        const baseX = (gx + 0.5) * cellSize - this.worldSize / 2;
        const baseZ = (gz + 0.5) * cellSize - this.worldSize / 2;

        // Jitter within cell (controlled randomness)
        const jitterX = (random() - 0.5) * 2 * jitter * cellSize;
        const jitterZ = (random() - 0.5) * 2 * jitter * cellSize;

        const x = baseX + jitterX;
        const z = baseZ + jitterZ;

        // Random biome type from provided definitions and influence
        const typeIndex = Math.floor(random() * biomeTypes.length);
        const influenceRange = maxInfluence - minInfluence;
        const influence = minInfluence + random() * influenceRange;

        this.biomeCenters.push({
          x,
          z,
          type: biomeTypes[typeIndex],
          influence,
        });
      }
    }
  }

  /**
   * Get all biome centers
   */
  getBiomeCenters(): ReadonlyArray<BiomeCenter> {
    return this.biomeCenters;
  }

  /**
   * Get biome definition by ID
   */
  getBiomeDefinition(biomeId: string): BiomeDefinition {
    const def = this.biomeDefinitions[biomeId];
    if (def) return def;
    const keys = Object.keys(this.biomeDefinitions);
    return keys.length > 0
      ? this.biomeDefinitions[keys[0]]
      : {
          id: biomeId,
          name: biomeId,
          color: 0x808080,
          terrainMultiplier: 1,
          difficultyLevel: 0,
          heightRange: [0, 1],
          resourceDensity: 1,
        };
  }

  /**
   * Calculate biome influences at a world position.
   *
   * Returns all biomes with their normalized weights (sum to 1.0).
   * The returned array is a BORROWED reference into the instance's
   * pooled scratch state — callers must consume it synchronously
   * and not retain past the next call to this method.
   *
   * Hot path: called once per vertex during tile mesh generation
   * (10M+ calls per world regen at 100×100 tiles × 32×32 verts).
   * The previous implementation allocated a fresh `Map` + array +
   * one object per influence per call — millions of allocations
   * dominated GC pressure (the actual cause of the user-visible
   * 2 FPS regression). This implementation:
   *
   *   - Reuses the pooled `_pooledWeightMap` and `_pooledInfluences`
   *     (zero allocations on the hot path after warmup).
   *   - Iterates the parallel-array SoA layout for cache locality.
   *   - Skips centers whose normalized squared distance produces a
   *     gaussian weight below `MIN_SIGNIFICANT_WEIGHT` (saves the
   *     `Math.exp` + Map mutation for the long tail).
   *   - Pre-multiplies by `invInfluence` to skip a divide per center.
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @param _baseHeight - Reserved for future height-biome coupling (currently unused)
   */
  getBiomeInfluencesAtPosition(
    worldX: number,
    worldZ: number,
    _baseHeight: number,
  ): BiomeInfluence[] {
    const { gaussianCoeff, boundaryNoiseScale, boundaryNoiseAmount } =
      this.config;

    // Add boundary noise for organic edges. Cheap simplex sample.
    const boundaryNoise = this.noise.simplex2D(
      worldX * boundaryNoiseScale,
      worldZ * boundaryNoiseScale,
    );
    const noiseScale = 1 + boundaryNoise * boundaryNoiseAmount;
    // Squared-distance threshold beyond which gaussian weight is
    // below MIN_SIGNIFICANT_WEIGHT. Derived from
    //   exp(-x²·c) = MIN  ⇒  x² = -ln(MIN) / c
    // Computed once per call (not per center).
    const sqDistanceCutoff = -Math.log(MIN_SIGNIFICANT_WEIGHT) / gaussianCoeff;

    // Reuse pooled Map + array. Clear, don't reallocate.
    const weightMap = this._pooledWeightMap;
    weightMap.clear();
    const out = this._pooledInfluences;
    out.length = 0;

    // Hot loop — iterate the SoA layout. Indexed access into
    // typed arrays is cache-friendly and inlinable.
    const soa = this.centersSoA;
    const xs = soa.x;
    const zs = soa.z;
    const invInf = soa.invInfluence;
    const types = soa.type;
    const count = soa.count;
    for (let i = 0; i < count; i++) {
      const dx = worldX - xs[i];
      const dz = worldZ - zs[i];
      // Distance² (skip sqrt; we'll work in squared space).
      // The boundary noise scales linear distance, so its square
      // is `noiseScale²`. Apply once.
      const sqDistance = (dx * dx + dz * dz) * (noiseScale * noiseScale);
      // Normalize by influence. `invInf` is precomputed.
      const inv = invInf[i];
      const normSq = sqDistance * inv * inv;
      // Skip centers whose contribution would be visually
      // imperceptible. Saves the `exp` + Map ops for the long
      // tail of distant biome centers.
      if (normSq > sqDistanceCutoff) continue;
      const weight = Math.exp(-normSq * gaussianCoeff);
      // Merge same-type biomes (multiple centers may share a type).
      const type = types[i];
      const existing = weightMap.get(type);
      weightMap.set(type, existing === undefined ? weight : existing + weight);
    }

    // Materialize into the pooled output array. Reuse pre-allocated
    // BiomeInfluence objects from `_influenceObjectPool` to avoid
    // per-call object allocation.
    let totalWeight = 0;
    let outIdx = 0;
    for (const [type, weight] of weightMap) {
      let slot = this._influenceObjectPool[outIdx];
      if (!slot) {
        slot = { type, weight };
        this._influenceObjectPool[outIdx] = slot;
      } else {
        slot.type = type;
        slot.weight = weight;
      }
      out.push(slot);
      totalWeight += weight;
      outIdx++;
    }

    // Normalize weights so they sum to 1.0.
    if (totalWeight > 0) {
      const invTotal = 1 / totalWeight;
      for (let i = 0; i < out.length; i++) {
        out[i].weight *= invTotal;
      }
    } else {
      // Edge case: query point is so far from every center that
      // every center's contribution rounded below the threshold.
      // Fall back to the first defined biome at full weight.
      const fallback = Object.keys(this.biomeDefinitions)[0] ?? "unknown";
      let slot = this._influenceObjectPool[0];
      if (!slot) {
        slot = { type: fallback, weight: 1.0 };
        this._influenceObjectPool[0] = slot;
      } else {
        slot.type = fallback;
        slot.weight = 1.0;
      }
      out.push(slot);
    }

    // Sort by weight descending — typical N is small (3–9), so
    // in-place sort is fine. Array.prototype.sort with a comparator
    // does allocate internally; an insertion sort would be allocation-
    // free but the difference at N≤9 is in the noise.
    out.sort(byWeightDesc);

    return out;
  }

  /**
   * Get the dominant biome at a world position
   */
  getDominantBiome(worldX: number, worldZ: number, baseHeight: number): string {
    const influences = this.getBiomeInfluencesAtPosition(
      worldX,
      worldZ,
      baseHeight,
    );
    if (influences.length > 0) return influences[0].type;
    const keys = Object.keys(this.biomeDefinitions);
    return keys.length > 0 ? keys[0] : "unknown";
  }

  /**
   * Get the dominant biome for a terrain tile (at tile center)
   */
  getBiomeForTile(tileX: number, tileZ: number, tileSize: number): string {
    // Tile geometry is centered at (tileX * tileSize, tileZ * tileSize)
    const worldX = tileX * tileSize;
    const worldZ = tileZ * tileSize;
    return this.getDominantBiome(worldX, worldZ, 0);
  }

  private biomeIds: Record<string, number> = {};
  private nextBiomeId = 0;

  /** Get numeric biome ID for shader use */
  getBiomeId(biomeName: string): number {
    const id = this.biomeIds[biomeName];
    if (id === undefined) {
      this.biomeIds[biomeName] = this.nextBiomeId++;
      return this.biomeIds[biomeName];
    }
    return id;
  }

  /**
   * Blend multiple biome colors based on influences
   * @returns RGB color (0-1 range)
   */
  blendBiomeColors(influences: BiomeInfluence[]): {
    r: number;
    g: number;
    b: number;
  } {
    let r = 0;
    let g = 0;
    let b = 0;

    for (const influence of influences) {
      const biome = this.getBiomeDefinition(influence.type);
      const color = biome.color;

      // Extract RGB from hex
      const biomeR = ((color >> 16) & 0xff) / 255;
      const biomeG = ((color >> 8) & 0xff) / 255;
      const biomeB = (color & 0xff) / 255;

      r += biomeR * influence.weight;
      g += biomeG * influence.weight;
      b += biomeB * influence.weight;
    }

    return { r, g, b };
  }
}
