/**
 * `ViewportSelection` — what gets returned when the user clicks
 * something in the 3D viewport.
 *
 * Previously declared inline in `TileBasedTerrain.tsx`. Lives in
 * its own file so consumers (the world tab, the WorldStudio
 * viewport container, future tools) can import it without
 * pulling the entire 4,500-line terrain monolith.
 *
 * The discriminator is the `type` field; per-type optional
 * fields below are populated when relevant (e.g. `townId` for
 * town selections, `vegetationSpecies` for tree clicks).
 */

/**
 * Tile inspector data — included on terrain selections so the
 * properties panel can render the "what's at this point" block
 * without re-querying the terrain generator.
 */
export interface TerrainTileInspectorData {
  tileX: number;
  tileZ: number;
  chunkX: number;
  chunkZ: number;
  worldX: number;
  worldZ: number;
  height: number;
  biome: string;
  slope: number;
  walkable: boolean;
  inTown: boolean;
  townId?: string;
  inWilderness: boolean;
  difficultyLevel: number;
}

/** Selection info returned when clicking objects in the viewport. */
export interface ViewportSelection {
  type:
    | "terrain"
    | "chunk"
    | "tile"
    | "biome"
    | "town"
    | "building"
    | "road"
    | "entity"
    | "vegetation"
    | "bridge"
    | "duelArena";
  id: string;
  position: { x: number; y: number; z: number };
  townId?: string;
  townName?: string;
  buildingType?: string;
  biomeType?: string;
  tileKey?: string;
  /** Entity type for entity selections (spawnPoint, teleport, mobSpawn, etc.) */
  entityType?: string;
  /** Entity ID for entity selections */
  entityId?: string;
  /** Display name for entity selections */
  entityDisplayName?: string;
  /** Full entity metadata from userData (for game world entities) */
  entityData?: Record<string, unknown>;
  /** Vegetation instance data (for vegetation selections) */
  vegetationSpecies?: string;
  vegetationInstanceIndex?: number;
  /** Tile inspector data for terrain selections */
  tileData?: TerrainTileInspectorData;
}
