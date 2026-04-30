/**
 * useProjectLoader — Load a world project from the server on mount
 *
 * Fetches project data, deserializes world, sets context state,
 * acquires edit lock, and releases lock on unmount.
 */

import { useEffect, useRef } from "react";

import {
  deserializeWorld,
  serializeWorld,
} from "../../WorldBuilder/utils/worldPersistence";
import {
  DEFAULT_CREATION_CONFIG,
  DEFAULT_NOISE_CONFIG,
  DEFAULT_BIOME_CONFIG,
  DEFAULT_ISLAND_CONFIG,
  DEFAULT_SHORELINE_CONFIG,
  DEFAULT_TOWN_CONFIG,
  DEFAULT_ROAD_CONFIG,
} from "../../WorldBuilder/types";
import type { WorldCreationConfig, WorldData } from "../../WorldBuilder/types";
import { generateWorldFromConfig } from "../../WorldBuilder/worldGeneration";
import { BiomeSystem } from "@hyperforge/procgen/terrain";
import { GAME_BIOME_DEFINITIONS } from "../../WorldBuilder/GameTerrainAdapter";
import {
  getWorldProject,
  saveWorldProject,
  acquireProjectLock,
  releaseProjectLock,
  fetchGame,
} from "../../../utils/worldProjectApi";
import {
  deserializeManifestOverrides,
  type SerializedManifestOverrides,
  type ExtendedWorldLayers,
  type AudioLayers,
  type Prefab,
  EMPTY_EXTENDED_LAYERS,
  EMPTY_AUDIO_LAYERS,
} from "../types";
import { useWorldStudio } from "../WorldStudioContext";
import { rehydrateAgentWorldContentFromProject } from "../state/agentWorldContent";
import type { GameModeManifest } from "@hyperforge/shared/runtime";

/**
 * Config matching the live Hyperia game world.
 * Seed 0, 100x100 tiles (10km x 10km), uses the game's exact terrain pipeline.
 */
const HYPERIA_GAME_WORLD_CONFIG: WorldCreationConfig = {
  seed: 0,
  preset: null,
  useGamePipeline: true,
  terrain: {
    tileSize: 100,
    worldSize: 100,
    tileResolution: 64,
    maxHeight: 50,
    waterThreshold: 16,
  },
  noise: DEFAULT_NOISE_CONFIG,
  biomes: DEFAULT_BIOME_CONFIG,
  island: DEFAULT_ISLAND_CONFIG,
  shoreline: DEFAULT_SHORELINE_CONFIG,
  towns: DEFAULT_TOWN_CONFIG,
  roads: DEFAULT_ROAD_CONFIG,
};

/**
 * Ensure biomes exist and have tileKeys populated.
 * Worlds saved before the biome generation fix may have an empty biomes array
 * or biomes with empty tileKeys. This regenerates/backfills as needed.
 */
function repairBiomes(world: WorldData): void {
  const config = world.foundation.config;
  const { worldSize, tileSize } = config.terrain;
  const worldSizeMeters = worldSize * tileSize;

  // If no biomes at all, regenerate from config
  if (world.foundation.biomes.length === 0) {
    const biomeConfig = config.biomes ?? DEFAULT_BIOME_CONFIG;
    const biomeSystem = new BiomeSystem(
      config.seed,
      worldSizeMeters,
      biomeConfig,
      GAME_BIOME_DEFINITIONS,
    );
    const centers = biomeSystem.getBiomeCenters();
    world.foundation.biomes = centers.map((center, index) => {
      const def = biomeSystem.getBiomeDefinition(center.type);
      return {
        id: `biome-${index}`,
        type: center.type,
        center: {
          x: center.x + worldSizeMeters / 2,
          y: 0,
          z: center.z + worldSizeMeters / 2,
        },
        influenceRadius: center.influence,
        tileKeys: [],
        color: def.color,
      };
    });
  }

  // Backfill tileKeys if all empty
  const biomes = world.foundation.biomes;
  if (biomes.length === 0) return;
  const allEmpty = biomes.every((b) => b.tileKeys.length === 0);
  if (!allEmpty) return;

  for (let tx = 0; tx < worldSize; tx++) {
    for (let tz = 0; tz < worldSize; tz++) {
      const wx = tx * tileSize;
      const wz = tz * tileSize;
      let closest = biomes[0];
      let closestDist = Infinity;
      for (const biome of biomes) {
        const dx = wx - biome.center.x;
        const dz = wz - biome.center.z;
        const dist = dx * dx + dz * dz;
        if (dist < closestDist) {
          closestDist = dist;
          closest = biome;
        }
      }
      closest.tileKeys.push(`${tx},${tz}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Restore validation — guard against corrupted or malformed save data
// ---------------------------------------------------------------------------

/** Validate an array field from save data; returns empty array + warns if invalid. */
function validateArrayField<T extends { id: string }>(
  data: unknown,
  fieldName: string,
): T[] {
  if (!Array.isArray(data)) {
    if (data !== undefined && data !== null) {
      console.warn(
        `[ProjectLoader] Expected array for ${fieldName}, got ${typeof data}. Using empty array.`,
      );
    }
    return [];
  }
  return data.filter((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) {
      console.warn(
        `[ProjectLoader] Skipping malformed entry in ${fieldName}:`,
        item,
      );
      return false;
    }
    return true;
  }) as T[];
}

function validateExtendedLayers(
  saved: ExtendedWorldLayers,
): ExtendedWorldLayers {
  // Cast to unknown-indexed for defensive field access — save data may be malformed
  const raw = saved as unknown as Record<string, unknown>;
  return {
    ...EMPTY_EXTENDED_LAYERS,
    spawnPoints: validateArrayField(
      raw.spawnPoints,
      "extendedLayers.spawnPoints",
    ),
    teleports: validateArrayField(raw.teleports, "extendedLayers.teleports"),
    mobSpawns: validateArrayField(raw.mobSpawns, "extendedLayers.mobSpawns"),
    resources: validateArrayField(raw.resources, "extendedLayers.resources"),
    stations: validateArrayField(raw.stations, "extendedLayers.stations"),
    pois: validateArrayField(raw.pois, "extendedLayers.pois"),
    waterBodies: validateArrayField(
      raw.waterBodies,
      "extendedLayers.waterBodies",
    ),
    regions: validateArrayField(raw.regions, "extendedLayers.regions"),
    dangerSources: validateArrayField(
      raw.dangerSources,
      "extendedLayers.dangerSources",
    ),
    customAssets: validateArrayField(
      raw.customAssets,
      "extendedLayers.customAssets",
    ),
  };
}

function validateAudioLayers(saved: AudioLayers): AudioLayers {
  const raw = saved as unknown as Record<string, unknown>;
  return {
    ...EMPTY_AUDIO_LAYERS,
    musicZones: validateArrayField(raw.musicZones, "audioLayers.musicZones"),
    ambientZones: validateArrayField(
      raw.ambientZones,
      "audioLayers.ambientZones",
    ),
    sfxTriggers: validateArrayField(raw.sfxTriggers, "audioLayers.sfxTriggers"),
  };
}

export function useProjectLoader(projectId: string) {
  const { actions } = useWorldStudio();
  const lockAcquiredRef = useRef(false);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      actions.loadStart();
      try {
        const project = await getWorldProject(projectId);
        if (cancelled || controller.signal.aborted) return;

        // Fetch the owning game record to pick up its GameMode manifest
        // (Phase 4). This is non-fatal — if the fetch fails, PIE falls back
        // to the client-side Hyperia default.
        let gameMode: GameModeManifest | null = null;
        try {
          const game = await fetchGame(project.teamId, project.gameId);
          if (game.gameMode) gameMode = game.gameMode;
        } catch (err) {
          console.warn(
            "[ProjectLoader] Failed to fetch game record for gameMode; " +
              "PIE will use the default manifest:",
            err,
          );
        }
        if (cancelled || controller.signal.aborted) return;

        // Detect Hyperia-template projects for first-open world
        // generation. Phase B0'.B: prefer the typed `templateId`
        // surface; fall back to the deprecated `worldData._placeholder`
        // sentinel for rows that haven't been migrated through the
        // 0007_project_typed_layers backfill yet.
        const rawData = project.worldData as Record<string, unknown>;
        const isHyperiaTemplate =
          project.templateId === "hyperia" || rawData?._placeholder === true;
        const hasGeneratedTerrain =
          rawData &&
          typeof rawData === "object" &&
          !rawData._placeholder &&
          // serialized worlds carry a `tiles` or `terrain` key — the
          // placeholder sentinel only carries `_placeholder`.
          ("tiles" in rawData || "terrain" in rawData || "biomes" in rawData);
        let world;
        if (isHyperiaTemplate && !hasGeneratedTerrain) {
          // Generate the Hyperia game world on first open
          const generated = await new Promise<
            ReturnType<typeof generateWorldFromConfig>
          >((resolve, reject) => {
            setTimeout(() => {
              try {
                resolve(generateWorldFromConfig(HYPERIA_GAME_WORLD_CONFIG));
              } catch (err) {
                reject(err);
              }
            }, 50);
          });
          if (cancelled) return;
          world = generated;
          // Persist so next load is instant
          const serialized = serializeWorld(generated);
          saveWorldProject(project.id, { worldData: serialized }).catch((err) =>
            console.error(
              "[ProjectLoader] Failed to save generated world:",
              err,
            ),
          );
        } else {
          world = deserializeWorld(
            rawData as unknown as Parameters<typeof deserializeWorld>[0],
          );
        }

        // Repair biomes for worlds saved before the biome generation fix
        repairBiomes(world);

        // Set project context. `templateId` + `plugins` come from
        // the typed-layer surface (B0'.A); usePIESession reads them
        // to decide which plugin set to install on Play.
        actions.setProject(
          project.teamId,
          project.gameId,
          project.id,
          project.name,
          project.version,
          gameMode,
          project.templateId ?? null,
          project.plugins ?? [],
          project.assetPacks ?? [],
        );

        // Load world into editing state
        actions.loadWorld(world);
        actions.switchToEditing();
        actions.loadSuccess();

        // Phase B4 of the AAA gap audit — rehydrate the agent
        // world-content store from `project.worldContent` so the
        // agent's prior NPCs/spawns/quests/zones survive a refresh.
        // Without this every reload returned the editor to a clean
        // canvas and the agent's work appeared lost.
        try {
          const counts = rehydrateAgentWorldContentFromProject(
            project.worldContent ?? null,
          );
          if (
            counts.npcs > 0 ||
            counts.spawns > 0 ||
            counts.zones > 0 ||
            counts.quests > 0
          ) {
            console.info(
              "[ProjectLoader] Rehydrated agent worldContent:",
              counts,
            );
          }
          if (counts.dropped > 0) {
            console.warn(
              `[ProjectLoader] Dropped ${counts.dropped} malformed worldContent entries during rehydration.`,
            );
          }
        } catch (err) {
          console.warn(
            "[ProjectLoader] Failed to rehydrate agent worldContent (non-fatal):",
            err,
          );
        }

        // Restore brush overlays (terrain sculpts, biome paints) if saved
        const savedBrushOverlays = (rawData as Record<string, unknown>)
          ?.brushOverlays as
          | {
              terrainSculpts?: unknown[];
              biomePaints?: unknown[];
              vegetationPaints?: unknown[];
              tileCollisions?: unknown[];
            }
          | undefined;
        if (
          savedBrushOverlays &&
          typeof savedBrushOverlays === "object" &&
          (savedBrushOverlays.terrainSculpts?.length ||
            savedBrushOverlays.biomePaints?.length)
        ) {
          actions.restoreBrushOverlays(
            savedBrushOverlays as Parameters<
              typeof actions.restoreBrushOverlays
            >[0],
          );
        }

        // Restore extended layers (spawn points, teleports, resources, etc.)
        const savedExtendedLayers = (rawData as Record<string, unknown>)
          ?.extendedLayers as ExtendedWorldLayers | undefined;
        if (savedExtendedLayers && typeof savedExtendedLayers === "object") {
          const validated = validateExtendedLayers(savedExtendedLayers);
          actions.restoreExtendedLayers(validated);
        }

        // Restore audio layers (music zones, ambient zones, SFX triggers)
        const savedAudioLayers = (rawData as Record<string, unknown>)
          ?.audioLayers as AudioLayers | undefined;
        if (savedAudioLayers && typeof savedAudioLayers === "object") {
          const validated = validateAudioLayers(savedAudioLayers);
          actions.restoreAudioLayers(validated);
        }

        // Restore prefabs
        const savedPrefabs = (rawData as Record<string, unknown>)?.prefabs as
          | Prefab[]
          | undefined;
        if (Array.isArray(savedPrefabs)) {
          const validated = savedPrefabs.filter((p) => {
            if (
              !p ||
              typeof p !== "object" ||
              !p.id ||
              !Array.isArray(p.entries)
            ) {
              console.warn("[ProjectLoader] Skipping malformed prefab:", p);
              return false;
            }
            return true;
          });
          actions.restorePrefabs(validated);
        }

        // Restore manifest overrides from snapshot
        if (project.manifestSnapshot) {
          try {
            actions.loadManifestOverrides(
              deserializeManifestOverrides(
                project.manifestSnapshot as SerializedManifestOverrides,
              ),
            );
          } catch (e) {
            console.warn(
              "[ProjectLoader] Failed to restore manifest overrides:",
              e,
            );
          }
        }

        // Acquire edit lock
        try {
          const lockResult = await acquireProjectLock(projectId);
          if (!cancelled && lockResult.success) {
            lockAcquiredRef.current = true;
            actions.setProjectLock(lockResult.lockedBy ?? null);
          }
        } catch {
          // Lock failure is non-fatal — user can still view
        }
      } catch (err) {
        if (!cancelled) {
          actions.loadError(
            err instanceof Error ? err.message : "Failed to load project",
          );
        }
      }
    }

    load().catch((err) => {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("[ProjectLoader] Unexpected error:", err);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
      // Release lock on unmount
      if (lockAcquiredRef.current) {
        lockAcquiredRef.current = false;
        releaseProjectLock(projectIdRef.current).catch(() => {
          // Best-effort lock release
        });
      }
    };
  }, [projectId, actions]);
}
