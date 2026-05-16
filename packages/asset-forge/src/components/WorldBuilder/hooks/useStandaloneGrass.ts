/**
 * useStandaloneGrass — owns the EditorGrassManager lifecycle for
 * the studio's game-accurate grass toggle.
 *
 * Phase 1.1 eleventh carve from `TileBasedTerrain.tsx`. Mirrors
 * the `useStandaloneSky` / `useGameFog` / `useShadowsCSM` pattern:
 * the hook owns the lifecycle effect + the ref it manages, the
 * parent reads `grassRef.current` from other call sites
 * (generateTile / unloadTile / regenerateTile / animation loop /
 * cleanup) where the ref-stability matters more than re-renders.
 *
 * Why gated on Hyperia content:
 *
 * `EditorGrassManager` hardcodes a 3-channel tundra / forest /
 * canyon grass blend — the same Hyperia-shaped assumption the
 * Phase 2.1 first cut closes for the terrain shader. For non-
 * Hyperia themed projects (tropical / arctic / desert / volcanic
 * / wetland), every per-vertex weight resolves to tundraW=1, so
 * grass renders as snow over the corrected biome tints — visually
 * worse than no grass. The hook suppresses creation when the
 * Hyperia content pack isn't installed; the Phase 2.1 follow-up
 * (N-channel grass + per-pack textures) will retire that gate.
 *
 * What the parent still owns (and reads `grassRef.current` for):
 *
 *  - generateTile / regenerateTileInPlace: when a new tile loads,
 *    `grassRef.current?.addTile(centerX, centerZ, tileSize)`.
 *  - unloadTile: `grassRef.current?.removeTile(centerX, centerZ)`.
 *  - Animation loop: day-cycle intensity / sun direction syncs,
 *    plus `processQueue(1)` + `update(camera.position)` per
 *    frame.
 *  - Destroy path: `grassRef.current?.dispose()`.
 *
 * The hook can't own those without also owning the animation
 * loop and the tile lifecycle — both are deep parent concerns.
 */

import { useEffect, useRef, type RefObject } from "react";

import { THREE } from "@/utils/webgpu-renderer";

import { EditorGrassManager } from "../EditorGrassManager";
import { GAME_WATER_THRESHOLD } from "../GameTerrainAdapter";

/**
 * Per-tile coords the hook needs at effect-fire time so it can
 * seed the freshly-created `EditorGrassManager` with every
 * already-loaded tile. Structural subset of `TileBasedTerrain`'s
 * internal `TileData` — keeping it minimal here lets the hook
 * sit outside the parent's import graph for `TileData`.
 */
export interface GrassTileSeed {
  tileX: number;
  tileZ: number;
}

/**
 * Minimal terrain-querier shape the grass manager consumes. The
 * parent's `terrainQuerierRef` typically points at the full
 * studio querier returning `TerrainPointQuery`; the grass
 * manager only needs the 3 fields below.
 */
export interface GrassTerrainQuery {
  readonly height: number;
  readonly biomeForestWeight?: number;
  readonly biomeCanyonWeight?: number;
}

export type GrassTerrainQuerier = (
  terrainX: number,
  terrainZ: number,
) => GrassTerrainQuery;

/**
 * Minimal `TerrainGenerator` surface the grass-height fallback
 * uses when the querier isn't available yet.
 */
export interface GrassHeightFallback {
  getHeightAt(x: number, z: number): number;
}

/**
 * Minimal foliage-manager surface the hook toggles to avoid
 * duplicate grass instances. Real type lives at
 * `FoliageRenderer.FoliageManager`.
 */
export interface GrassFoliageManager {
  setEnabled(enabled: boolean): void;
}

export interface UseStandaloneGrassHostRefs {
  sceneRef: RefObject<THREE.Scene | null>;
  /** Studio terrain querier; null until the generator is ready. */
  terrainQuerierRef: RefObject<GrassTerrainQuerier | null>;
  /** Fallback when querier isn't populated. May be null. */
  generatorRef: RefObject<GrassHeightFallback | null>;
  /** World-space → scene-space offset (subtracted from world coords). */
  worldCenterOffsetRef: RefObject<number>;
  /** Hyperia content gate — see header. */
  hyperiaContentEnabledRef: RefObject<boolean>;
  /** Foliage manager toggled off while grass is on. */
  foliageManagerRef: RefObject<GrassFoliageManager | null>;
  /** Currently-loaded tiles to seed into a freshly-created grass instance. */
  tilesRef: RefObject<ReadonlyMap<string, GrassTileSeed>>;
}

export interface UseStandaloneGrassResult {
  /**
   * Stable RefObject holding the live `EditorGrassManager`, or
   * null when grass is disabled / suppressed by the Hyperia
   * gate. Parent reads this from generateTile / unloadTile /
   * regenerateTileInPlace / animation loop / cleanup.
   */
  grassRef: RefObject<EditorGrassManager | null>;
}

/**
 * Install the grass-toggle effect. Re-fires whenever
 * `enableGrass` or `tileSize` changes; tears down the existing
 * instance, optionally creates a new one, and seeds it with
 * every already-loaded tile so the user sees grass immediately
 * (not on the next tile-load tick).
 */
export function useStandaloneGrass(opts: {
  enableGrass: boolean;
  tileSize: number;
  hostRefs: UseStandaloneGrassHostRefs;
}): UseStandaloneGrassResult {
  const { enableGrass, tileSize, hostRefs } = opts;
  const grassRef = useRef<EditorGrassManager | null>(null);

  useEffect(() => {
    const scene = hostRefs.sceneRef.current;
    if (!scene) return;

    const grassAllowed =
      enableGrass && hostRefs.hyperiaContentEnabledRef.current;

    if (grassAllowed) {
      const querier = hostRefs.terrainQuerierRef.current;
      const gen = hostRefs.generatorRef.current;
      const offset = hostRefs.worldCenterOffsetRef.current ?? 0;

      // Height callback in scene-space — EditorGrassManager
      // handles offset internally for its world->terrain math,
      // but its standalone height-callback signature takes
      // scene-space coords so we apply the offset here.
      const getHeight = (sceneX: number, sceneZ: number): number => {
        if (querier) return querier(sceneX - offset, sceneZ - offset).height;
        if (gen) return gen.getHeightAt(sceneX - offset, sceneZ - offset);
        return 0;
      };

      // Terrain querier (takes world-space coords, without offset).
      const editorQuerier: GrassTerrainQuerier = (terrainX, terrainZ) => {
        if (querier) return querier(terrainX, terrainZ);
        return {
          height: gen ? gen.getHeightAt(terrainX, terrainZ) : 0,
          biomeForestWeight: 0,
          biomeCanyonWeight: 0,
        };
      };

      const grass = new EditorGrassManager(scene, {
        waterThreshold: GAME_WATER_THRESHOLD,
      });
      grass.setTerrainCallbacks(editorQuerier, getHeight, offset);

      // Seed every already-loaded tile so the user sees grass
      // immediately — without this the user would see grass
      // appear only on the next tile-load tick.
      const halfTile = tileSize / 2;
      const tiles = hostRefs.tilesRef.current;
      if (tiles) {
        for (const [, td] of tiles) {
          const cx = td.tileX * tileSize + halfTile;
          const cz = td.tileZ * tileSize + halfTile;
          grass.addTile(cx, cz, tileSize);
        }
      }

      grassRef.current = grass;

      // Disable FoliageRenderer to avoid duplicate grass instances.
      hostRefs.foliageManagerRef.current?.setEnabled(false);
    } else {
      if (grassRef.current) {
        grassRef.current.dispose();
        grassRef.current = null;
      }
      // Re-enable FoliageRenderer when StandaloneGrass is off.
      hostRefs.foliageManagerRef.current?.setEnabled(true);
    }

    return () => {
      if (grassRef.current) {
        grassRef.current.dispose();
        grassRef.current = null;
      }
    };
  }, [
    enableGrass,
    tileSize,
    hostRefs.foliageManagerRef,
    hostRefs.generatorRef,
    hostRefs.hyperiaContentEnabledRef,
    hostRefs.sceneRef,
    hostRefs.terrainQuerierRef,
    hostRefs.tilesRef,
    hostRefs.worldCenterOffsetRef,
  ]);

  return { grassRef };
}
