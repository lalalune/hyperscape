/**
 * Island Mask Generator
 *
 * Creates island-shaped terrain by applying a radial mask with natural
 * coastline variations. Uses noise-based edge displacement for organic shores.
 */

import { NoiseGenerator } from "./NoiseGenerator";
import type { IslandConfig } from "./types";

/**
 * Default island configuration.
 *
 * Edge noise tuned for visible per-seed coastline variation
 * (the prior values — `edgeNoiseScale: 0.0015` /
 * `edgeNoiseStrength: 0.03` — produced ~3% radius variance
 * which read as "every island looks the same Hyperia shape"
 * regardless of seed). Current values yield ~12% variance with
 * higher-frequency detail so coastlines actually differ across
 * seeds. The "archipelago" preset uses similar values; bringing
 * the default in line with that preset's frequency makes
 * single-island generation visibly seed-dependent.
 */
export const DEFAULT_ISLAND_CONFIG: IslandConfig = {
  enabled: true,
  maxWorldSizeTiles: 100,
  falloffTiles: 4,
  edgeNoiseScale: 0.005,
  edgeNoiseStrength: 0.12,
};

/**
 * Configuration for the inner pond feature
 */
export interface PondConfig {
  /** Pond center X offset from world origin */
  centerX: number;
  /** Pond center Z offset from world origin */
  centerZ: number;
  /** Pond radius in meters */
  radius: number;
  /** Pond depth as normalized height depression (0-1) */
  depth: number;
}

/**
 * Default pond configuration (creates a small pond west of spawn)
 */
export const DEFAULT_POND_CONFIG: PondConfig = {
  centerX: -80,
  centerZ: 60,
  radius: 50,
  depth: 0.55,
};

/**
 * IslandMask handles island-shaped terrain generation
 */
export class IslandMask {
  private readonly config: IslandConfig;
  private readonly pondConfig: PondConfig;
  private readonly noise: NoiseGenerator;
  private readonly tileSize: number;

  constructor(
    seed: number,
    tileSize: number,
    config: Partial<IslandConfig> = {},
    pondConfig: Partial<PondConfig> = {},
  ) {
    this.config = { ...DEFAULT_ISLAND_CONFIG, ...config };
    this.pondConfig = { ...DEFAULT_POND_CONFIG, ...pondConfig };
    this.noise = new NoiseGenerator(seed);
    this.tileSize = tileSize;
  }

  /**
   * Get the active world size in meters when island mask is enabled
   */
  getActiveWorldSizeMeters(): number {
    return this.config.maxWorldSizeTiles * this.tileSize;
  }

  /**
   * Calculate island mask value at a world position
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @returns Mask value: 1.0 = full land, 0.0 = ocean
   */
  getIslandMaskAt(worldX: number, worldZ: number): number {
    if (!this.config.enabled) {
      return 1.0;
    }

    const maxRadiusMeters = this.getActiveWorldSizeMeters() / 2;
    if (maxRadiusMeters <= 0) {
      return 1.0;
    }

    const falloffMeters = Math.max(
      this.config.falloffTiles * this.tileSize,
      this.tileSize,
    );

    // Calculate coastline noise for natural variation
    const { edgeNoiseScale, edgeNoiseStrength } = this.config;
    const edgeNoise =
      edgeNoiseScale > 0 && edgeNoiseStrength > 0
        ? this.noise.simplex2D(worldX * edgeNoiseScale, worldZ * edgeNoiseScale)
        : 0;

    const radiusVariance = maxRadiusMeters * edgeNoiseStrength * edgeNoise;
    const adjustedRadius = Math.max(
      falloffMeters,
      maxRadiusMeters + radiusVariance,
    );
    const falloffStart = adjustedRadius - falloffMeters;

    const distance = Math.sqrt(worldX * worldX + worldZ * worldZ);

    if (distance <= falloffStart) {
      return 1.0;
    }
    if (distance >= adjustedRadius) {
      return 0.0;
    }

    // Smooth falloff using smoothstep
    const t = (distance - falloffStart) / falloffMeters;
    const smooth = t * t * (3 - 2 * t);
    return 1.0 - smooth;
  }

  /**
   * Calculate natural coastline mask with more detailed noise
   * This version uses angle-based noise sampling for bays and peninsulas
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @param baseRadius - Base island radius in meters
   * @param falloff - Falloff transition width in meters
   * @returns Mask value and effective radius
   */
  getNaturalCoastlineMask(
    worldX: number,
    worldZ: number,
    baseRadius: number,
    falloff: number,
  ): { mask: number; effectiveRadius: number } {
    const distance = Math.sqrt(worldX * worldX + worldZ * worldZ);
    const angle = Math.atan2(worldZ, worldX);

    // Multi-octave noise based on angle creates irregular coastline
    // Use position on a circle to sample noise (avoids seam at angle wrap)
    const coastlineNoiseX = Math.cos(angle) * 2;
    const coastlineNoiseZ = Math.sin(angle) * 2;

    // Large-scale bays and peninsulas
    const coastNoise1 = this.noise.fractal2D(
      coastlineNoiseX,
      coastlineNoiseZ,
      3,
      0.5,
      2.0,
    );
    // Medium features
    const coastNoise2 = this.noise.fractal2D(
      coastlineNoiseX * 3,
      coastlineNoiseZ * 3,
      2,
      0.5,
      2.0,
    );
    // Small coves and points
    const coastNoise3 = this.noise.simplex2D(
      coastlineNoiseX * 8,
      coastlineNoiseZ * 8,
    );

    // Combine for natural variation (±30% of radius)
    const coastlineVariation =
      coastNoise1 * 0.2 + coastNoise2 * 0.08 + coastNoise3 * 0.02;
    const effectiveRadius = baseRadius * (1 + coastlineVariation);

    // Calculate mask
    let mask = 1.0;
    if (distance > effectiveRadius - falloff) {
      // Smooth transition from land to ocean using smoothstep
      const edgeDist = distance - (effectiveRadius - falloff);
      const t = Math.min(1.0, edgeDist / falloff);
      const smoothstep = t * t * (3 - 2 * t);
      mask = 1.0 - smoothstep;
    }

    // Outside island = deep ocean
    if (distance > effectiveRadius + 50) {
      mask = 0;
    }

    return { mask, effectiveRadius };
  }

  /**
   * Calculate pond depression at a position
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @returns Depth value to subtract from terrain height (0 = no depression)
   */
  getPondDepression(worldX: number, worldZ: number): number {
    const { centerX, centerZ, radius, depth } = this.pondConfig;

    const dx = worldX - centerX;
    const dz = worldZ - centerZ;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance >= radius * 2) {
      return 0;
    }

    // Smooth bowl shape for pond
    const pondFactor = 1.0 - distance / (radius * 2);
    return pondFactor * pondFactor * depth;
  }

  /**
   * Apply island shaping to a base height value
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @param baseHeightNormalized - Normalized base terrain height (0-1)
   * @param baseElevation - Base island elevation (normalized, typically 0.4-0.5)
   * @returns Final normalized height with island shaping applied
   */
  applyIslandShaping(
    worldX: number,
    worldZ: number,
    baseHeightNormalized: number,
    baseElevation: number = 0.42,
  ): number {
    // Get island mask (this uses the simple radial version)
    const islandMask = this.getIslandMaskAt(worldX, worldZ);

    // Keep existing terrain features but modulate by island mask
    let height = baseHeightNormalized * islandMask;

    // Add base island elevation (so center is above vegetation threshold)
    // Vegetation spawns above ~11.4m (water 5.4m + 6m buffer)
    height = height * 0.2 + baseElevation * islandMask;

    // Apply pond depression
    const pondDepression = this.getPondDepression(worldX, worldZ);
    height -= pondDepression;

    // Ocean floor outside island
    if (islandMask === 0) {
      height = 0.05; // Very low = deep underwater
    }

    return Math.max(0, Math.min(1, height));
  }

  /**
   * Apply detailed natural coastline shaping
   * This version creates more organic coastlines with bays and peninsulas
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @param baseHeightNormalized - Normalized base terrain height (0-1)
   * @param islandRadius - Island radius in meters
   * @param coastFalloff - Coastline transition width in meters
   * @param baseElevation - Base island elevation (normalized)
   * @returns Final normalized height
   */
  applyNaturalCoastlineShaping(
    worldX: number,
    worldZ: number,
    baseHeightNormalized: number,
    islandRadius: number = 350,
    coastFalloff: number = 100,
    baseElevation: number = 0.42,
  ): number {
    const { mask: islandMask } = this.getNaturalCoastlineMask(
      worldX,
      worldZ,
      islandRadius,
      coastFalloff,
    );

    // Keep existing terrain features but modulate by island mask
    let height = baseHeightNormalized * islandMask;

    // Add base island elevation
    height = height * 0.2 + baseElevation * islandMask;

    // Apply pond depression
    const pondDepression = this.getPondDepression(worldX, worldZ);
    height -= pondDepression;

    // Ocean floor outside island
    if (islandMask === 0) {
      height = 0.05;
    }

    return Math.max(0, Math.min(1, height));
  }

  /**
   * Check if a position is on land (above water)
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @param waterThresholdNormalized - Water threshold as normalized height
   * @returns true if the position is on land
   */
  isOnLand(
    worldX: number,
    worldZ: number,
    waterThresholdNormalized: number = 0.18,
  ): boolean {
    const islandMask = this.getIslandMaskAt(worldX, worldZ);
    // Position is on land if it's within the island and above water threshold
    return islandMask > waterThresholdNormalized;
  }

  /**
   * Get the configuration
   */
  getConfig(): IslandConfig {
    return { ...this.config };
  }

  /**
   * Get the pond configuration
   */
  getPondConfig(): PondConfig {
    return { ...this.pondConfig };
  }
}
