import THREE from "../extras/three/three";
import type { TerrainSystem } from "./shared/world/TerrainSystem";

/**
 * Chunk data for terrain LOD management
 */
interface Chunk {
  key: string;
  x: number;
  z: number;
  lod: number;
  lodArray: [number, number];
  worldPosition: { x: number; z: number };
  distance: number;
  /** Geomorph factor 0-1 for smooth LOD transitions */
  morphFactor: number;
  /** Screen-space error estimate for adaptive refinement */
  screenSpaceError: number;
}

/**
 * Result of LOD update with chunks to add/remove
 */
interface ChunkUpdate {
  toAdd: Chunk[];
  toRemove: Chunk[];
  /** Chunks that need morph factor updates */
  toMorph: Chunk[];
}

/**
 * Configuration for LOD manager
 */
interface LODConfig {
  minLod: number;
  maxLod: number;
  lod1Range: number;
  updateThreshold: number;
  /** Enable geomorphing for smooth LOD transitions */
  enableGeomorphing: boolean;
  /** Morph range as percentage of LOD boundary (0.2 = 20%) */
  morphRange: number;
  /** Enable adaptive refinement based on screen-space error */
  enableAdaptive: boolean;
  /** Target screen-space error in pixels */
  targetScreenError: number;
  /** Field of view for screen error calculation */
  fov: number;
  /** Screen height for screen error calculation */
  screenHeight: number;
}

/**
 * TerrainLODManager - Level of Detail management for terrain chunks
 *
 * Manages which terrain chunks should be loaded at which detail level
 * based on player position. Uses concentric rings of decreasing detail
 * to balance visual quality with performance.
 *
 * LOD Levels:
 * - LOD 1: Highest detail, closest to player
 * - LOD 2: Half resolution, medium distance
 * - LOD 3: Quarter resolution, far distance
 * - LOD 4: Lowest detail, horizon
 *
 * Features:
 * - Configurable LOD ranges and levels
 * - Seam LOD calculation to avoid gaps between detail levels
 * - Performance-optimized with reusable arrays
 * - Distance-based chunk sorting for prioritized loading
 * - Geomorphing for smooth LOD transitions (no popping)
 * - Adaptive refinement based on screen-space error
 */
export class TerrainLODManager {
  private config: LODConfig = {
    minLod: 1,
    maxLod: 4,
    lod1Range: 2,
    updateThreshold: 5,
    enableGeomorphing: true,
    morphRange: 0.2,
    enableAdaptive: false,
    targetScreenError: 2.0,
    fov: 60,
    screenHeight: 1080,
  };
  private activeChunks = new Map<string, Chunk>();
  private lastPlayerPosition = new THREE.Vector3();
  private _reusableToRemove: Chunk[] = [];
  private _reusableToAdd: Chunk[] = [];
  private _reusableToMorph: Chunk[] = [];

  constructor(private terrainSystem: TerrainSystem) {}

  /**
   * Configure LOD parameters
   */
  configure(config: Partial<LODConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LODConfig> {
    return { ...this.config };
  }

  /**
   * Update LOD based on player position
   * Returns chunks to add, remove, and morph
   */
  update(playerPosition: THREE.Vector3): ChunkUpdate {
    const requiredChunks = new Set<string>();
    this._reusableToAdd.length = 0;
    this._reusableToMorph.length = 0;

    const { minLod, maxLod, lod1Range, enableGeomorphing, morphRange } = this.config;

    // Calculate required chunks at each LOD level
    for (let lod = minLod; lod <= maxLod; lod++) {
      const chunkSize = this.terrainSystem.getTileSize();
      const lodScale = 2 ** (lod - 1);
      const effectiveSize = chunkSize * lodScale;

      // Range increases with LOD level
      const range = lod === 1 ? lod1Range : Math.ceil(lod1Range * lodScale);

      const centerX = Math.floor(playerPosition.x / effectiveSize);
      const centerZ = Math.floor(playerPosition.z / effectiveSize);

      // Calculate LOD boundary distances for geomorphing
      const lodBoundaryDist = range * effectiveSize;
      const morphStartDist = lodBoundaryDist * (1 - morphRange);

      for (let dz = -range; dz <= range; dz++) {
        for (let dx = -range; dx <= range; dx++) {
          const chunkX = centerX + dx;
          const chunkZ = centerZ + dz;
          const key = `${chunkX}_${chunkZ}_${lod}`;

          requiredChunks.add(key);

          const worldX = chunkX * effectiveSize + effectiveSize / 2;
          const worldZ = chunkZ * effectiveSize + effectiveSize / 2;
          const distance = Math.sqrt(
            (worldX - playerPosition.x) ** 2 +
              (worldZ - playerPosition.z) ** 2,
          );

          // Calculate geomorph factor
          let morphFactor = 1.0;
          if (enableGeomorphing && distance > morphStartDist) {
            morphFactor = 1.0 - (distance - morphStartDist) / (lodBoundaryDist - morphStartDist);
            morphFactor = Math.max(0, Math.min(1, morphFactor));
          }

          // Calculate screen-space error for adaptive refinement
          const screenSpaceError = this.calculateScreenError(distance, lod);

          if (!this.activeChunks.has(key)) {
            const lodArray = this.calculateSeamLODs(
              chunkX,
              chunkZ,
              lod,
              centerX,
              centerZ,
            );

            this._reusableToAdd.push({
              key,
              x: chunkX,
              z: chunkZ,
              lod,
              lodArray,
              worldPosition: { x: worldX, z: worldZ },
              distance,
              morphFactor,
              screenSpaceError,
            });
          } else {
            // Update existing chunk's morph factor
            const existing = this.activeChunks.get(key)!;
            if (Math.abs(existing.morphFactor - morphFactor) > 0.01) {
              existing.morphFactor = morphFactor;
              existing.distance = distance;
              existing.screenSpaceError = screenSpaceError;
              this._reusableToMorph.push(existing);
            }
          }
        }
      }
    }

    // Sort by distance - load closest chunks first
    this._reusableToAdd.sort((a, b) => a.distance - b.distance);

    // Find chunks to remove
    this._reusableToRemove.length = 0;
    for (const chunk of this.activeChunks.values()) {
      if (!requiredChunks.has(chunk.key)) {
        this._reusableToRemove.push(chunk);
      }
    }

    // Update active chunks map
    for (const chunk of this._reusableToAdd) {
      this.activeChunks.set(chunk.key, chunk);
    }
    for (const chunk of this._reusableToRemove) {
      this.activeChunks.delete(chunk.key);
    }

    this.lastPlayerPosition.copy(playerPosition);

    return {
      toAdd: this._reusableToAdd,
      toRemove: this._reusableToRemove,
      toMorph: this._reusableToMorph,
    };
  }

  /**
   * Calculate screen-space error for adaptive LOD refinement
   */
  private calculateScreenError(distance: number, lod: number): number {
    const { fov, screenHeight } = this.config;
    
    // Geometric error at this LOD (higher LOD = larger triangles = more error)
    const chunkSize = this.terrainSystem.getTileSize();
    const lodScale = 2 ** (lod - 1);
    const geometricError = chunkSize * lodScale / 64; // Approximate triangle size
    
    // Project to screen space
    const fovRad = (fov * Math.PI) / 180;
    const screenError = (geometricError * screenHeight) / (2 * distance * Math.tan(fovRad / 2));
    
    return screenError;
  }

  /**
   * Get recommended LOD for a distance (for adaptive refinement)
   */
  getRecommendedLOD(distance: number): number {
    const { targetScreenError, minLod, maxLod } = this.config;
    
    for (let lod = minLod; lod <= maxLod; lod++) {
      const error = this.calculateScreenError(distance, lod);
      if (error <= targetScreenError) {
        return lod;
      }
    }
    
    return maxLod;
  }

  /**
   * Check if update is needed based on player movement
   */
  needsUpdate(playerPosition: THREE.Vector3): boolean {
    return (
      playerPosition.distanceTo(this.lastPlayerPosition) >
      this.config.updateThreshold
    );
  }

  /**
   * Calculate seam LODs for chunk boundaries
   * Ensures smooth transitions between LOD levels
   */
  private calculateSeamLODs(
    chunkX: number,
    chunkZ: number,
    lod: number,
    centerX: number,
    centerZ: number,
  ): [number, number] {
    const { lod1Range, maxLod } = this.config;
    const distanceFromCenter = Math.max(
      Math.abs(chunkX - centerX),
      Math.abs(chunkZ - centerZ),
    );

    const range = lod === 1 ? lod1Range : Math.ceil(lod1Range * 2 ** (lod - 1));

    // At edge of LOD ring, seam to next LOD level
    const atEdge = distanceFromCenter >= range - 1;
    const bottomLod = atEdge ? Math.min(lod + 1, maxLod) : lod;
    const rightLod = atEdge ? Math.min(lod + 1, maxLod) : lod;

    return [bottomLod, rightLod];
  }

  /**
   * Get statistics about current LOD state
   */
  getStats(): {
    totalChunks: number;
    chunksPerLod: Record<number, number>;
    memoryEstimate: number;
  } {
    const chunksPerLod: Record<number, number> = {};

    for (const chunk of this.activeChunks.values()) {
      chunksPerLod[chunk.lod] = (chunksPerLod[chunk.lod] || 0) + 1;
    }

    // Rough memory estimate (vertices * 12 bytes for position/normal/uv)
    let memoryEstimate = 0;
    for (const [lod, count] of Object.entries(chunksPerLod)) {
      const resolution = Math.max(1, 64 / 2 ** (parseInt(lod) - 1));
      const verticesPerChunk = resolution * resolution;
      memoryEstimate += count * verticesPerChunk * 12;
    }

    return {
      totalChunks: this.activeChunks.size,
      chunksPerLod,
      memoryEstimate,
    };
  }

  /**
   * Clear all active chunks
   */
  clear(): void {
    this.activeChunks.clear();
    this._reusableToAdd.length = 0;
    this._reusableToRemove.length = 0;
    this.lastPlayerPosition.set(0, 0, 0);
  }

  /**
   * Get chunk at world position
   */
  getChunkAtPosition(
    worldX: number,
    worldZ: number,
    lod: number = 1,
  ): Chunk | undefined {
    const chunkSize = this.terrainSystem.getTileSize();
    const lodScale = 2 ** (lod - 1);
    const effectiveSize = chunkSize * lodScale;

    const chunkX = Math.floor(worldX / effectiveSize);
    const chunkZ = Math.floor(worldZ / effectiveSize);
    const key = `${chunkX}_${chunkZ}_${lod}`;

    return this.activeChunks.get(key);
  }

  /**
   * Get all active chunks
   */
  getActiveChunks(): ReadonlyMap<string, Chunk> {
    return this.activeChunks;
  }
}
