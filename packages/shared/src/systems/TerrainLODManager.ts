import THREE from "../extras/three/three";
import type { TerrainSystem } from "./shared/world/TerrainSystem";

interface Chunk {
  key: string;
  x: number;
  z: number;
  lod: number;
  lodArray: [number, number];
  worldPosition: { x: number; z: number };
}

interface ChunkUpdate {
  toAdd: Chunk[];
  toRemove: Chunk[];
}

export class TerrainLODManager {
  private minLod = 1;
  private maxLod = 4; // Start with 4 LODs for RPG
  private lod1Range = 2; // 2 chunks at highest detail
  private activeChunks = new Map<string, Chunk>();

  constructor(private terrainSystem: TerrainSystem) {}

  update(playerPosition: THREE.Vector3): ChunkUpdate {
    const requiredChunks = new Set<string>();
    const toAdd: Chunk[] = [];

    // Calculate required chunks at each LOD
    for (let lod = this.minLod; lod <= this.maxLod; lod++) {
      const chunkSize = this.terrainSystem.getTileSize();
      const lodScale = 2 ** (lod - 1);
      const effectiveSize = chunkSize * lodScale;

      const range =
        lod === 1 ? this.lod1Range : Math.ceil(this.lod1Range * lodScale);

      const centerX = Math.floor(playerPosition.x / effectiveSize);
      const centerZ = Math.floor(playerPosition.z / effectiveSize);

      for (let dz = -range; dz <= range; dz++) {
        for (let dx = -range; dx <= range; dx++) {
          const chunkX = centerX + dx;
          const chunkZ = centerZ + dz;
          const key = `${chunkX}_${chunkZ}_${lod}`;

          requiredChunks.add(key);

          if (!this.activeChunks.has(key)) {
            const lodArray = this.calculateSeamLODs(
              chunkX,
              chunkZ,
              lod,
              centerX,
              centerZ,
            );

            toAdd.push({
              key,
              x: chunkX,
              z: chunkZ,
              lod,
              lodArray,
              worldPosition: {
                x: chunkX * effectiveSize,
                z: chunkZ * effectiveSize,
              },
            });
          }
        }
      }
    }

    // Find chunks to remove
    const toRemove = [...this.activeChunks.values()].filter(
      (chunk) => !requiredChunks.has(chunk.key),
    );

    // Update active chunks
    for (const chunk of toAdd) {
      this.activeChunks.set(chunk.key, chunk);
    }
    for (const chunk of toRemove) {
      this.activeChunks.delete(chunk.key);
    }

    return { toAdd, toRemove };
  }

  private calculateSeamLODs(
    chunkX: number,
    chunkZ: number,
    lod: number,
    centerX: number,
    centerZ: number,
  ): [number, number] {
    const distanceFromCenter = Math.max(
      Math.abs(chunkX - centerX),
      Math.abs(chunkZ - centerZ),
    );

    const range =
      lod === 1 ? this.lod1Range : Math.ceil(this.lod1Range * 2 ** (lod - 1));

    const bottomLod =
      distanceFromCenter >= range - 1 ? Math.min(lod + 1, this.maxLod) : lod;
    const rightLod =
      distanceFromCenter >= range - 1 ? Math.min(lod + 1, this.maxLod) : lod;

    return [bottomLod, rightLod];
  }
}
