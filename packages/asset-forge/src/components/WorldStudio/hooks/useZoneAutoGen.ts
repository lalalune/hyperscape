/**
 * useZoneAutoGen — One-click zone generation pipeline (orchestrator)
 *
 * Thin React hook that wires pipeline stages together:
 *   1. scanLandBounds + sampleDifficultyGrid (grid sampling)
 *   2. floodFillZones + cleanupZones (zone extraction)
 *   3. nameZones (naming)
 *   4. deriveSpawnRules (spawn table derivation)
 *   5. populateEntities (two-phase entity scatter)
 *
 * Pipeline stages live in ../pipeline/ for single-responsibility and testability.
 * Pure orchestration functions and constants live in ../utils/zoneAutoGen/.
 */

import { useCallback } from "react";

import {
  withBiomeDifficultyFallback,
  type TownInfo,
  type DangerSourceInfo,
} from "../../WorldBuilder/DifficultyHeatmap";

import type { PlacedRegion, AutoGenConfig, AutoGenResult } from "../types";
import { useWorldStudio } from "../WorldStudioContext";
import {
  HAND_PLACED_ENTITY_BUFFER,
  VEGETATION_BUFFER,
  getTownSafeRadius,
} from "../utils/worldConstants";

import type { ExistingEntityPosition } from "../pipeline/entityPopulator";

// Re-export everything from the extracted utility modules so that
// existing consumers importing from this file continue to work.
export {
  DEFAULT_TIERS,
  DEFAULT_AUTOGEN_CONFIG,
} from "../utils/zoneAutoGen/tierConfig";
export {
  type TownStageResult,
  type RoadZoneStageResult,
  type PopulationStageResult,
  type AutoGenDeps,
  runAutoGenPipeline,
  mergeStageResults,
  runTownStage,
  runRoadZoneStage,
  runPopulationStage,
} from "../utils/zoneAutoGen/pipeline";

// Local imports for internal use within this hook
import { DEFAULT_TIERS } from "../utils/zoneAutoGen/tierConfig";
import {
  runAutoGenPipeline,
  runTownStage,
  runRoadZoneStage,
  runPopulationStage,
  type AutoGenDeps,
  type TownStageResult,
  type RoadZoneStageResult,
} from "../utils/zoneAutoGen/pipeline";

// ============== REACT HOOK ==============

export function useZoneAutoGen() {
  const { state, actions, viewportRef } = useWorldStudio();

  /** Run the pipeline with given config (preview only — does not commit) */
  const generate = useCallback(
    (config: AutoGenConfig): AutoGenResult | null => {
      const world = state.builder.editing.world;
      if (!world) return null;

      const vp = viewportRef?.current;
      if (!vp?.queryBiome || !vp?.getBiomeDifficulty) return null;

      const getBiomeDifficulty = withBiomeDifficultyFallback(
        vp.getBiomeDifficulty,
      );

      const worldSizeMeters =
        world.foundation.config.terrain.worldSize *
        world.foundation.config.terrain.tileSize;
      const seed = world.foundation.config.seed;

      const towns: TownInfo[] = world.foundation.towns.map((t) => ({
        position: { x: t.position.x, z: t.position.z },
        safeZoneRadius: getTownSafeRadius(t),
      }));

      console.log(
        `[AutoGen] Using ${towns.length} towns for zone generation:`,
        towns
          .map(
            (t, i) =>
              `Town ${i}: (${Math.round(t.position.x)}, ${Math.round(t.position.z)}) r=${t.safeZoneRadius}`,
          )
          .join(", "),
      );

      const dangerSources: DangerSourceInfo[] =
        state.extendedLayers.dangerSources.map((ds) => ({
          position: { x: ds.position.x, z: ds.position.z },
          radius: ds.radius,
          intensity: ds.intensity,
          falloffCurve: ds.falloffCurve,
        }));

      const waterThreshold = world.foundation.config.terrain.waterThreshold;

      // Collect all hand-placed entities to avoid overlapping them
      const existingEntities: ExistingEntityPosition[] = [];
      const entityBuffer = HAND_PLACED_ENTITY_BUFFER;
      for (const npc of world.layers.npcs) {
        existingEntities.push({
          x: npc.position.x,
          z: npc.position.z,
          radius: entityBuffer,
        });
      }
      for (const s of state.extendedLayers.stations) {
        existingEntities.push({
          x: s.position.x,
          z: s.position.z,
          radius: entityBuffer,
        });
      }
      for (const sp of state.extendedLayers.spawnPoints) {
        existingEntities.push({
          x: sp.position.x,
          z: sp.position.z,
          radius: entityBuffer,
        });
      }
      for (const tp of state.extendedLayers.teleports) {
        existingEntities.push({
          x: tp.position.x,
          z: tp.position.z,
          radius: entityBuffer,
        });
      }
      for (const poi of state.extendedLayers.pois) {
        existingEntities.push({
          x: poi.position.x,
          z: poi.position.z,
          radius: poi.radius ?? entityBuffer,
        });
      }

      // Include existing vegetation trees so procgen entities don't overlap them.
      // Positions are in game-space (same as other entities above).
      const vegPositions = vp.vegetationPositions ?? [];
      for (const veg of vegPositions) {
        existingEntities.push({
          x: veg.x,
          z: veg.z,
          radius: VEGETATION_BUFFER,
        });
      }

      console.log(
        `[AutoGen] Manifests loaded=${state.manifests.loaded}: ` +
          `${state.manifests.npcs.length} npcs (${state.manifests.npcs.filter((n) => n.category === "mob").length} mobs), ` +
          `${state.manifests.miningRocks.length} rocks, ` +
          `${state.manifests.trees.length} trees, ` +
          `${state.manifests.fishingSpots.length} fishing. ` +
          `Existing entities: ${existingEntities.length} (${vegPositions.length} vegetation)`,
      );

      const townDetails = world.foundation.towns.map((t) => {
        const safeR = getTownSafeRadius(t);
        // Convert foundation entryPoints (direction string) to angle-based format
        const entryPoints = t.entryPoints
          ?.filter((ep) => ep.position)
          .map((ep) => ({
            angle: Math.atan2(
              ep.position.x - t.position.x,
              ep.position.z - t.position.z,
            ),
            position: { x: ep.position.x, z: ep.position.z },
          }));
        return {
          id: t.id,
          name: t.name,
          position: { x: t.position.x, y: t.position.y, z: t.position.z },
          radius: safeR * 0.35,
          safeZoneRadius: safeR,
          entryPoints: entryPoints?.length ? entryPoints : undefined,
        };
      });

      // Build structure obstacles for road avoidance — ALL procgen structures
      // are obstacles unless explicitly road-connectable (bridges, docks).
      const structureObstacles: Array<{
        x: number;
        z: number;
        radius: number;
      }> = [];
      const ROAD_BLDG_BUFFER = 4;

      // Foundation buildings (existing world)
      for (const b of world.foundation.buildings) {
        const halfDiag =
          Math.sqrt(b.dimensions.width ** 2 + b.dimensions.depth ** 2) / 2;
        structureObstacles.push({
          x: b.position.x,
          z: b.position.z,
          radius: halfDiag + ROAD_BLDG_BUFFER,
        });
      }

      // POIs (dungeons, shrines, landmarks, resource areas, ruins, camps)
      for (const poi of state.extendedLayers.pois) {
        structureObstacles.push({
          x: poi.position.x,
          z: poi.position.z,
          radius: (poi.radius ?? 10) + ROAD_BLDG_BUFFER,
        });
      }

      // Stations (banks, anvils, furnaces, altars, etc.)
      for (const s of state.extendedLayers.stations) {
        structureObstacles.push({
          x: s.position.x,
          z: s.position.z,
          radius: 4 + ROAD_BLDG_BUFFER,
        });
      }

      // Duel arenas (from manifests — each arena has center + size)
      for (const arena of state.manifests.duelArenas) {
        structureObstacles.push({
          x: arena.center.x,
          z: arena.center.z,
          radius: Math.max(arena.size, 12) + ROAD_BLDG_BUFFER,
        });
      }

      // Extract bank positions for mine distance enforcement
      const banks = state.extendedLayers.stations
        .filter((s) => s.bankId)
        .map((s) => ({ x: s.position.x, z: s.position.z }));

      console.log(
        `[AutoGen] Road obstacles: ${structureObstacles.length} structures ` +
          `(${world.foundation.buildings.length} buildings, ` +
          `${state.extendedLayers.pois.length} POIs, ` +
          `${state.extendedLayers.stations.length} stations, ` +
          `${state.manifests.duelArenas.length} arenas), ` +
          `${banks.length} banks`,
      );

      const result = runAutoGenPipeline(config, {
        queryBiome: vp.queryBiome,
        getBiomeDifficulty,
        worldSize: worldSizeMeters,
        waterThreshold,
        seed,
        towns,
        townDetails,
        dangerSources,
        manifests: state.manifests,
        existingEntities,
        structureObstacles,
        banks,
        townConfig: {
          townCount: world.foundation.config.towns.townCount,
          minTownSpacing: world.foundation.config.towns.minTownSpacing,
        },
      });

      console.log(
        `[AutoGen] Pipeline result: ${result.zones.length} zones, ` +
          `${result.mobSpawns.length} mobs, ${result.resources.length} resources, ` +
          `${result.mines.length} mines, ` +
          `${result.spawnPoints.length} spawns, ${result.teleports.length} teleports, ` +
          `${result.roads.length} roads, ${result.generatedTowns.length} new towns ` +
          `(requested townCount=${world.foundation.config.towns.townCount})`,
      );

      return result;
    },
    [
      state.builder.editing.world,
      state.extendedLayers,
      state.manifests,
      viewportRef,
    ],
  );

  /** Build AutoGenDeps from current state + viewport (shared by all stage wrappers) */
  const buildDeps = useCallback(
    (configOverride?: {
      seed?: number;
      townCount?: number;
      minTownSpacing?: number;
    }): {
      deps: AutoGenDeps;
      world: NonNullable<typeof state.builder.editing.world>;
    } | null => {
      const world = state.builder.editing.world;
      if (!world) return null;

      const vp = viewportRef?.current;
      if (!vp?.queryBiome || !vp?.getBiomeDifficulty) return null;

      const getBiomeDifficulty = withBiomeDifficultyFallback(
        vp.getBiomeDifficulty,
      );

      const worldSizeMeters =
        world.foundation.config.terrain.worldSize *
        world.foundation.config.terrain.tileSize;
      const seed = configOverride?.seed ?? world.foundation.config.seed;

      const towns: TownInfo[] = world.foundation.towns.map((t) => ({
        position: { x: t.position.x, z: t.position.z },
        safeZoneRadius: getTownSafeRadius(t),
      }));

      const dangerSources: DangerSourceInfo[] =
        state.extendedLayers.dangerSources.map((ds) => ({
          position: { x: ds.position.x, z: ds.position.z },
          radius: ds.radius,
          intensity: ds.intensity,
          falloffCurve: ds.falloffCurve,
        }));

      const waterThreshold = world.foundation.config.terrain.waterThreshold;

      const existingEntities: ExistingEntityPosition[] = [];
      const entityBuffer = HAND_PLACED_ENTITY_BUFFER;
      for (const npc of world.layers.npcs) {
        existingEntities.push({
          x: npc.position.x,
          z: npc.position.z,
          radius: entityBuffer,
        });
      }
      for (const s of state.extendedLayers.stations) {
        existingEntities.push({
          x: s.position.x,
          z: s.position.z,
          radius: entityBuffer,
        });
      }
      for (const sp of state.extendedLayers.spawnPoints) {
        existingEntities.push({
          x: sp.position.x,
          z: sp.position.z,
          radius: entityBuffer,
        });
      }
      for (const tp of state.extendedLayers.teleports) {
        existingEntities.push({
          x: tp.position.x,
          z: tp.position.z,
          radius: entityBuffer,
        });
      }
      for (const poi of state.extendedLayers.pois) {
        existingEntities.push({
          x: poi.position.x,
          z: poi.position.z,
          radius: poi.radius ?? entityBuffer,
        });
      }
      const vegPositions = vp.vegetationPositions ?? [];
      for (const veg of vegPositions) {
        existingEntities.push({
          x: veg.x,
          z: veg.z,
          radius: VEGETATION_BUFFER,
        });
      }

      const townDetails = world.foundation.towns.map((t) => {
        const safeR = getTownSafeRadius(t);
        const entryPoints = t.entryPoints
          ?.filter((ep) => ep.position)
          .map((ep) => ({
            angle: Math.atan2(
              ep.position.x - t.position.x,
              ep.position.z - t.position.z,
            ),
            position: { x: ep.position.x, z: ep.position.z },
          }));
        return {
          id: t.id,
          name: t.name,
          position: { x: t.position.x, y: t.position.y, z: t.position.z },
          radius: safeR * 0.35,
          safeZoneRadius: safeR,
          entryPoints: entryPoints?.length ? entryPoints : undefined,
        };
      });

      const structureObstacles: Array<{
        x: number;
        z: number;
        radius: number;
      }> = [];
      const ROAD_BLDG_BUFFER = 4;
      for (const b of world.foundation.buildings) {
        const halfDiag =
          Math.sqrt(b.dimensions.width ** 2 + b.dimensions.depth ** 2) / 2;
        structureObstacles.push({
          x: b.position.x,
          z: b.position.z,
          radius: halfDiag + ROAD_BLDG_BUFFER,
        });
      }
      for (const poi of state.extendedLayers.pois) {
        structureObstacles.push({
          x: poi.position.x,
          z: poi.position.z,
          radius: (poi.radius ?? 10) + ROAD_BLDG_BUFFER,
        });
      }
      for (const s of state.extendedLayers.stations) {
        structureObstacles.push({
          x: s.position.x,
          z: s.position.z,
          radius: 4 + ROAD_BLDG_BUFFER,
        });
      }
      for (const arena of state.manifests.duelArenas) {
        structureObstacles.push({
          x: arena.center.x,
          z: arena.center.z,
          radius: Math.max(arena.size, 12) + ROAD_BLDG_BUFFER,
        });
      }

      // Extract bank positions for mine distance enforcement
      const banks = state.extendedLayers.stations
        .filter((s) => s.bankId)
        .map((s) => ({ x: s.position.x, z: s.position.z }));

      const deps: AutoGenDeps = {
        queryBiome: vp.queryBiome,
        getBiomeDifficulty,
        worldSize: worldSizeMeters,
        waterThreshold,
        seed,
        towns,
        townDetails,
        dangerSources,
        manifests: state.manifests,
        existingEntities,
        structureObstacles,
        banks,
        townConfig: {
          townCount:
            configOverride?.townCount ??
            world.foundation.config.towns.townCount,
          minTownSpacing:
            configOverride?.minTownSpacing ??
            world.foundation.config.towns.minTownSpacing,
        },
      };

      return { deps, world };
    },
    [
      state.builder.editing.world,
      state.extendedLayers,
      state.manifests,
      viewportRef,
    ],
  );

  /** Run only the town generation stage */
  const generateTownStage = useCallback(
    (
      config: AutoGenConfig,
      overrides?: {
        seed?: number;
        townCount?: number;
        minTownSpacing?: number;
      },
    ): TownStageResult | null => {
      const built = buildDeps(overrides);
      if (!built) return null;
      return runTownStage(config, built.deps);
    },
    [buildDeps],
  );

  /** Run only the road + zone stage (requires prior TownStageResult) */
  const generateRoadZoneStage = useCallback(
    (
      config: AutoGenConfig,
      townResult: TownStageResult,
      overrides?: { seed?: number },
    ): RoadZoneStageResult | null => {
      const built = buildDeps(overrides);
      if (!built) return null;
      return runRoadZoneStage(config, built.deps, townResult);
    },
    [buildDeps],
  );

  /** Run only the population stage (requires prior stage results) */
  const generatePopulationStage = useCallback(
    (
      config: AutoGenConfig,
      townResult: TownStageResult,
      roadZoneResult: RoadZoneStageResult,
    ) => {
      const built = buildDeps();
      if (!built) return null;
      return runPopulationStage(config, built.deps, townResult, roadZoneResult);
    },
    [buildDeps],
  );

  /** Commit an auto-gen result to state */
  const apply = useCallback(
    async (result: AutoGenResult) => {
      // Auto-gen pipeline produces positions in GAME space (-half..+half).
      // The editor viewport operates in SCENE space (0..worldSize).
      // Convert all entity positions: sceneX = gameX + worldCenterOffset.
      // Also sample terrain height for Y so markers sit on the surface.
      const vp = viewportRef?.current;
      const offset = vp?.worldCenterOffset ?? 0;
      const queryBiome = vp?.queryBiome;

      console.log(
        `[AutoGen] Applying: ${result.zones.length} zones, ` +
          `${result.mobSpawns.length} mobs, ${result.resources.length} resources, ` +
          `${result.mines.length} mines, ` +
          `${result.spawnPoints.length} spawns, ${result.teleports.length} teleports, ` +
          `${result.roads.length} roads, ${result.generatedTowns.length} towns` +
          ` (worldCenterOffset=${offset}, refreshTownMarkers=${typeof vp?.refreshTownMarkers})`,
      );

      /** Convert game-space position to scene-space with terrain height */
      const toScene = (pos: { x: number; y: number; z: number }) => {
        const y = queryBiome ? queryBiome(pos.x, pos.z).height : pos.y;
        return { x: pos.x + offset, y, z: pos.z + offset };
      };
      /** Like toScene but preserves pre-computed Y (for mine bowl-adjusted positions) */
      const toScenePreserveY = (pos: { x: number; y: number; z: number }) => {
        return { x: pos.x + offset, y: pos.y, z: pos.z + offset };
      };

      // First clear any previous auto-gen
      actions.clearAllAutogen();

      // Sync generated towns to foundation (if any were created)
      if (result.generatedTowns.length > 0) {
        console.log(
          `[AutoGen] Syncing ${result.generatedTowns.length} generated towns:`,
          result.generatedTowns
            .map(
              (t) => `${t.name} (${t.size}, ${t.buildings.length} buildings)`,
            )
            .join(", "),
        );
        actions.syncRuntimeTowns(
          result.generatedTowns.map((t) => ({
            id: t.id,
            name: t.name,
            position: { x: t.position.x, y: t.position.y, z: t.position.z },
            size: t.size,
            safeZoneRadius: t.safeZoneRadius,
            biomeId: t.biome ?? "unknown",
            buildings: t.buildings.map((b) => ({
              id: b.id,
              type: b.type,
              position: { x: b.position.x, y: b.position.y, z: b.position.z },
              rotation: b.rotation,
              size: { width: b.size.width, depth: b.size.depth },
            })),
          })),
        );
        // Rebuild 3D town meshes (buildings, roads, landmarks) in the viewport
        if (vp?.refreshTownMarkers) {
          console.log(
            `[AutoGen] Calling refreshTownMarkers with ${result.generatedTowns.length} towns`,
          );
          vp.refreshTownMarkers(result.generatedTowns);
        } else {
          console.warn(
            `[AutoGen] refreshTownMarkers NOT available on viewport ref!`,
          );
        }
      } else {
        console.log(`[AutoGen] No towns generated (generatedTowns is empty)`);
      }

      // Build PlacedRegion objects from zones
      const regions: PlacedRegion[] = result.zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        description: `Auto-generated ${zone.biome} zone (${DEFAULT_TIERS[zone.tierIndex]?.name ?? "Unknown"} tier)`,
        tileKeys: [], // Contour-based zones don't use tile keys
        tags: [
          "autogen",
          zone.biome,
          DEFAULT_TIERS[zone.tierIndex]?.name.toLowerCase() ?? "unknown",
        ],
        spawnRules: zone.spawnRules,
        autoGenBounds: zone.autoGenBounds,
      }));

      // Convert entity positions from game-space to scene-space
      const sceneMobs = result.mobSpawns.map((m) => ({
        ...m,
        position: toScene(m.position),
      }));
      const sceneResources = result.resources.map((r) => ({
        ...r,
        // Mine ore rocks have pre-computed bowl-adjusted Y — preserve it.
        // Regular resources get Y from terrain query.
        position: r.properties.mineId
          ? toScenePreserveY(r.position)
          : toScene(r.position),
      }));
      const sceneSpawns = result.spawnPoints.map((sp) => ({
        ...sp,
        position: toScene(sp.position),
      }));
      const sceneTeleports = result.teleports.map((tp) => ({
        ...tp,
        position: toScene(tp.position),
      }));

      actions.batchAddRegions(regions);
      actions.batchAddEntities(sceneMobs, sceneResources);

      // Add auto-generated spawn points
      for (const sp of sceneSpawns) {
        actions.addSpawnPoint(sp);
      }
      // Add auto-generated lodestones
      for (const tp of sceneTeleports) {
        actions.addTeleport(tp);
      }

      // Add auto-generated mines
      if (result.mines.length > 0) {
        const sceneMines = result.mines.map((m) => ({
          ...m,
          position: toScene(m.position),
        }));
        actions.batchAddMines(sceneMines);
      }

      // Set auto-generated roads on the foundation (game-space, renderer handles conversion)
      if (result.roads.length > 0) {
        actions.setFoundationRoads(result.roads);
      }

      // Rebuild vegetation using AAA density field (SDF + noise + town gradient).
      // Buildings create hard exclusion footprints, towns create broad density
      // gradients, and FBM noise distorts all boundaries for organic forest edges.
      // Trees near settlement edges are scaled smaller (Far Cry 5's "age" technique).
      if (vp?.refreshVegetation) {
        const circles: Array<{ x: number; z: number; radius: number }> = [];

        // Per-building hard exclusions (tight: just the footprint + 2m for eaves/porches)
        // The density field's noise + town gradient handles the broader thinning.
        for (const town of result.generatedTowns) {
          for (const b of town.buildings) {
            const footprint = Math.max(
              b.size?.width ?? 10,
              b.size?.depth ?? 10,
            );
            circles.push({
              x: b.position.x,
              z: b.position.z,
              radius: footprint / 2 + 2,
            });
          }
          // Town plaza/fountain — compact hard exclusion (town gradient handles the rest)
          circles.push({ x: town.position.x, z: town.position.z, radius: 8 });
          // Per-landmark exclusions (wells, benches, etc.)
          if (town.landmarks) {
            for (const lm of town.landmarks) {
              circles.push({
                x: lm.position.x,
                z: lm.position.z,
                radius: Math.max(lm.size.width, lm.size.depth) / 2 + 1.5,
              });
            }
          }
        }

        // Resources — small clear zone for visual clarity
        for (const r of result.resources) {
          circles.push({ x: r.position.x, z: r.position.z, radius: 2.5 });
        }
        // Spawn points + teleports — small clear zone
        for (const sp of result.spawnPoints) {
          circles.push({ x: sp.position.x, z: sp.position.z, radius: 4 });
        }
        for (const tp of result.teleports) {
          circles.push({ x: tp.position.x, z: tp.position.z, radius: 4 });
        }
        // Mine areas — clear vegetation within mine radius + buffer
        for (const mine of result.mines) {
          circles.push({
            x: mine.position.x,
            z: mine.position.z,
            radius: mine.radius + 3,
          });
        }

        // Roads — road surface + small buffer (noise creates organic shoulders)
        const roads = result.roads.map((r) => ({
          path: r.path.map((p) => ({ x: p.x, z: p.z })),
          halfWidth: (r.width ?? 6) / 2 + 0.5,
        }));

        // Town centers for the broad density gradient (tile-based-MMORPG-style:
        // sparse near center, gradually thickening into full forest).
        const towns = result.generatedTowns.map((t) => ({
          x: t.position.x,
          z: t.position.z,
          safeZoneRadius: t.safeZoneRadius,
        }));

        // Diagnostic: dump sample coordinates to verify alignment
        if (circles.length > 0) {
          const sample = circles.slice(0, 3);
          console.log(
            `[AutoGen] Sample exclusion circles (game-space):`,
            sample
              .map(
                (c) =>
                  `(${c.x.toFixed(1)}, ${c.z.toFixed(1)}) r=${c.radius.toFixed(1)}`,
              )
              .join(", "),
          );
        }
        if (towns.length > 0) {
          console.log(
            `[AutoGen] Town centers (game-space):`,
            towns
              .map(
                (t) =>
                  `(${t.x.toFixed(1)}, ${t.z.toFixed(1)}) safeR=${t.safeZoneRadius}`,
              )
              .join(", "),
          );
        }

        await vp.refreshVegetation(
          undefined,
          { circles, roads, towns },
          state.brushOverlays.vegetationPaints,
        );
      }

      // Navigate camera to the first generated town (where buildings are)
      // so the user immediately sees the new content.
      if (result.generatedTowns.length > 0 && vp?.navigateCamera) {
        const t0 = result.generatedTowns[0];
        const cx = t0.position.x + offset;
        const cz = t0.position.z + offset;
        vp.navigateCamera(cx, cz, true);
        console.log(
          `[AutoGen] Camera navigated to town "${t0.name}" at scene (${cx.toFixed(0)}, ${cz.toFixed(0)})`,
        );
      } else if (result.zones.length > 0 && vp?.navigateCamera) {
        const z0 = result.zones[0];
        const cx = z0.centroid.x + offset;
        const cz = z0.centroid.z + offset;
        vp.navigateCamera(cx, cz, true);
        console.log(
          `[AutoGen] Camera navigated to zone "${z0.name}" at scene (${cx.toFixed(0)}, ${cz.toFixed(0)})`,
        );
      }
    },
    [actions, viewportRef],
  );

  /** Clear all auto-generated content */
  const clearAutogen = useCallback(() => {
    actions.clearAllAutogen();
    // Restore full vegetation (no exclusion zones) since wizard content is gone
    viewportRef?.current?.refreshVegetation?.(
      undefined,
      undefined,
      state.brushOverlays.vegetationPaints,
    );
  }, [actions, viewportRef, state.brushOverlays.vegetationPaints]);

  return {
    generate,
    generateTownStage,
    generateRoadZoneStage,
    generatePopulationStage,
    apply,
    clearAutogen,
  };
}
