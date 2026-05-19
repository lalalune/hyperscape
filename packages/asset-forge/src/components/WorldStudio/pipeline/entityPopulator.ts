/**
 * entityPopulator — Two-phase Poisson disc scatter with mob-resource buffer
 *
 * Phase A: Place mobs first (avoid hand-placed entities)
 * Phase B: Place resources second (avoid mobs via proximity buffer)
 *
 * The mob-resource buffer creates tile-based-MMORPG-style gameplay dynamics:
 * - Safe zones: resources far from mobs (30m) — gather freely
 * - Mid zones: resources closer to mobs (15m) — need to clear area
 * - Extreme zones: resources on top of mobs (3m) — gathering is combat
 *
 * Extension point: EntityPopulator interface allows adding new entity types
 * (herbs, traps, hazards) without modifying core pipeline.
 */

import { NoiseGenerator } from "@hyperforge/procgen/terrain";

import {
  computeZoneDifficulty,
  type ZoneDifficultyConfig,
  type TownInfo,
  type DangerSourceInfo,
  type BiomeQuerier,
  type BiomeDifficultyLookup,
} from "../../WorldBuilder/DifficultyHeatmap";
import type {
  PlacedMobSpawn,
  PlacedResource,
  AutoGenConfig,
  AutoGenZone,
} from "../types";
import {
  createSeededRng,
  hashString,
  weightedSelect,
} from "../utils/procgenUtils";
import {
  poissonDiscSample,
  type PoissonBoundaryTest,
} from "../utils/poissonDisc";
import { SpatialGrid } from "../utils/SpatialGrid";
import {
  BASE_MOB_DENSITY,
  BASE_RESOURCE_DENSITY,
  HAND_PLACED_ENTITY_BUFFER,
} from "../utils/worldConstants";

// ============== ENTITY POPULATOR INTERFACE (Open/Closed) ==============

/** Proximity constraint for entity placement */
export interface ProximityConstraint {
  /** Grid to check distance against */
  gridKey: string;
  /** Minimum distance from entities in that grid */
  minDistance: number;
}

/**
 * Interface for entity populators. Implement this to add new entity types
 * to the generation pipeline without modifying core code.
 *
 * Built-in populators: mobs, mining, woodcutting, fishing
 * Example extension: herbs, traps, hazards, quest objects
 */
export interface EntityPopulator<T> {
  /** Entity type identifier */
  readonly entityType: string;
  /** Primary entities (mobs) go first; secondary (resources) go after */
  readonly phase: "primary" | "secondary";
  /** Minimum spacing between entities of this type */
  readonly spacing: number;
  /** Populate a single zone, return placed entities */
  populate(
    zone: AutoGenZone,
    config: AutoGenConfig,
    rng: () => number,
    inZone: PoissonBoundaryTest,
    grids: Map<string, SpatialGrid>,
  ): T[];
  /** Proximity constraints relative to other entity grids */
  getProximityConstraints(): ProximityConstraint[];
}

// ============== EXISTING ENTITY POSITION ==============

export interface ExistingEntityPosition {
  x: number;
  z: number;
  radius: number;
}

// ============== HELPERS ==============

export function inferResourceType(
  id: string,
): "mining" | "woodcutting" | "fishing" | "farming" {
  if (id.startsWith("ore_") || id.includes("rock")) return "mining";
  if (id.startsWith("tree_") || id.includes("wood")) return "woodcutting";
  if (id.includes("fish")) return "fishing";
  return "farming";
}

// ============== POPULATION DEPENDENCIES ==============

export interface PopulationDeps {
  queryBiome: BiomeQuerier;
  getBiomeDifficulty: BiomeDifficultyLookup;
  noise: NoiseGenerator;
  towns: TownInfo[];
  dangerSources: DangerSourceInfo[];
  waterThreshold: number;
  worldRadius: number;
  zoneDiffConfig: ZoneDifficultyConfig;
}

// ============== MAIN POPULATION ==============

export function populateEntities(
  zones: AutoGenZone[],
  config: AutoGenConfig,
  deps: PopulationDeps,
  existingEntities: ExistingEntityPosition[],
): { mobs: PlacedMobSpawn[]; resources: PlacedResource[] } {
  const allMobs: PlacedMobSpawn[] = [];
  const allResources: PlacedResource[] = [];
  const mobGrid = new SpatialGrid(30); // for proximity checks

  // Pre-populate spatial grid with existing hand-placed entities
  // so auto-gen entities maintain distance from them
  const existingGrid = new SpatialGrid(30);
  for (const e of existingEntities) {
    existingGrid.insert(e.x, e.z);
    // Also add to mob grid so resources avoid existing entities too
    mobGrid.insert(e.x, e.z);
  }

  for (const zone of zones) {
    const tier = config.tiers[zone.tierIndex];
    if (!tier) continue;

    const rng = createSeededRng(config.seed + hashString(zone.id));

    // Build a spatial grid from the zone's precomputed cell positions.
    // This is deterministic (matches the grid sampling exactly) and avoids the
    // expensive computeZoneDifficulty re-evaluation that can produce scalar drift
    // from noise at sub-grid resolution, causing 100% rejection rates.
    const resolution =
      zone.autoGenBounds?.gridResolution ?? config.gridResolution;
    const cellPositions = zone.autoGenBounds?.cellPositions;
    const zoneCellGrid =
      cellPositions && cellPositions.length > 0
        ? new SpatialGrid(resolution)
        : null;
    if (zoneCellGrid && cellPositions) {
      for (const cp of cellPositions) {
        zoneCellGrid.insert(cp.x, cp.z);
      }
    }

    // Cell-based boundary test: check if the candidate position falls within
    // any of the zone's grid cells (within resolution/2 of a cell center).
    // Fast, deterministic, and consistent with the grid sampling that created zones.
    const halfRes = resolution * 0.55; // slight overshoot to cover cell corners
    const inZone: PoissonBoundaryTest = (x: number, z: number) => {
      if (zoneCellGrid) {
        // Check if this point is near any cell center in this zone
        const nearestDist = zoneCellGrid.nearestDistance(x, z);
        if (nearestDist > halfRes) return false;
      } else {
        // Fallback: contour-based test for zones without cellPositions
        const bq = deps.queryBiome(x, z);
        if (bq.height < deps.waterThreshold) return false;
        const [scalarLo, scalarHi] = tier.scalarRange;
        const sample = computeZoneDifficulty(
          x,
          z,
          bq.biome,
          deps.getBiomeDifficulty(bq.biome),
          deps.noise,
          deps.towns,
          deps.dangerSources,
          deps.worldRadius,
          deps.zoneDiffConfig,
        );
        if (
          sample.scalar < scalarLo ||
          sample.scalar >= scalarHi ||
          bq.biome !== zone.biome
        ) {
          return false;
        }
      }
      // Water check at the actual candidate position
      const bq = deps.queryBiome(x, z);
      return bq.height >= deps.waterThreshold;
    };

    const hasMobRules = !!(
      zone.spawnRules.mobs && zone.spawnRules.mobs.table.length > 0
    );
    const hasResRules = !!(
      zone.spawnRules.resources && zone.spawnRules.resources.table.length > 0
    );
    console.log(
      `[EntityPop] Zone "${zone.name}" (tier=${zone.tierIndex}, ${zone.cellCount} cells, ${Math.round(zone.area)}m²): ` +
        `mobRules=${hasMobRules ? zone.spawnRules.mobs!.table.length + " entries" : "none"}, ` +
        `resRules=${hasResRules ? zone.spawnRules.resources!.table.length + " entries" : "none"}, ` +
        `cellGrid=${zoneCellGrid ? "yes" : "no"} (${cellPositions?.length ?? 0} cells)`,
    );

    // Phase A: Mobs (avoid existing hand-placed entities)
    if (zone.spawnRules.mobs && zone.spawnRules.mobs.table.length > 0) {
      const density =
        BASE_MOB_DENSITY * (zone.spawnRules.mobs.densityMultiplier ?? 1);
      const targetCount = Math.max(1, Math.round(zone.area * density));
      const existingBuffer = HAND_PLACED_ENTITY_BUFFER;

      const mobPositions = poissonDiscSample(
        zone.bounds,
        config.mobSpacing,
        targetCount,
        rng,
        (x, z) => {
          if (!inZone(x, z)) return false;
          // Keep distance from hand-placed entities
          return existingGrid.nearestDistance(x, z) >= existingBuffer;
        },
      );

      for (let i = 0; i < mobPositions.length; i++) {
        const pos = mobPositions[i];
        const entry = weightedSelect(
          zone.spawnRules.mobs.table.map((t) => ({ ...t, weight: t.weight })),
          rng,
        );
        if (!entry) continue;

        allMobs.push({
          id: `autogen-mob-${zone.id}-${i}`,
          mobId: entry.mobId,
          name: `${entry.mobId} spawn`,
          position: { x: pos.x, y: 0, z: pos.z },
          spawnRadius: 5 + rng() * 10,
          maxCount: 1 + Math.floor(rng() * 3),
          respawnTicks: 50 + Math.floor(rng() * 30),
          source: "procgen",
          sourceRegionId: zone.id,
          properties: {},
        });

        mobGrid.insert(pos.x, pos.z);
      }
      if (mobPositions.length > 0) {
        console.log(
          `[EntityPop]   → ${mobPositions.length} mob positions placed (target: ${targetCount})`,
        );
      }
    }

    // Phase B: Land resources with mob-proximity buffer (skip water-affinity)
    if (
      zone.spawnRules.resources &&
      zone.spawnRules.resources.table.length > 0
    ) {
      const landTable = zone.spawnRules.resources.table.filter(
        (t) => t.affinity !== "water",
      );
      const waterTable = zone.spawnRules.resources.table.filter(
        (t) => t.affinity === "water",
      );

      const density =
        BASE_RESOURCE_DENSITY *
        (zone.spawnRules.resources.densityMultiplier ?? 1);
      const buffer = tier.mobResourceBuffer;

      // Phase B1: Land resources (mining, woodcutting, farming)
      if (landTable.length > 0) {
        const targetCount = Math.max(1, Math.round(zone.area * density));

        const resourcePositions = poissonDiscSample(
          zone.bounds,
          config.resourceSpacing,
          targetCount * 2, // oversample since we'll reject some
          rng,
          (x, z) => {
            if (!inZone(x, z)) return false;
            // Mob-resource proximity rejection
            const mobDist = mobGrid.nearestDistance(x, z);
            return mobDist >= buffer;
          },
        );

        // Trim to target count
        const finalPositions = resourcePositions.slice(0, targetCount);

        for (let i = 0; i < finalPositions.length; i++) {
          const pos = finalPositions[i];
          const entry = weightedSelect(
            landTable.map((t) => ({ ...t, weight: t.weight })),
            rng,
          );
          if (!entry) continue;

          allResources.push({
            id: `autogen-res-${zone.id}-${i}`,
            resourceId: entry.resourceId,
            resourceType: inferResourceType(entry.resourceId),
            name: entry.resourceId,
            position: { x: pos.x, y: 0, z: pos.z },
            rotation: rng() * Math.PI * 2,
            modelVariant: 0,
            source: "procgen",
            sourceRegionId: zone.id,
            properties:
              entry.clusterSize && entry.clusterSize > 1
                ? { clusterSize: entry.clusterSize }
                : {},
          });
        }
      }

      // Phase B2: Water-affinity resources (fishing spots) — place near shoreline
      if (waterTable.length > 0) {
        // Fishing spots are sparse: ~1 per 5000m² of zone area
        const fishDensity = density * 0.15;
        const fishTarget = Math.max(1, Math.round(zone.area * fishDensity));

        // Expand bounds slightly to reach nearby water outside the zone
        const waterSearchBounds = {
          minX: zone.bounds.minX - 30,
          maxX: zone.bounds.maxX + 30,
          minZ: zone.bounds.minZ - 30,
          maxZ: zone.bounds.maxZ + 30,
        };

        const fishPositions = poissonDiscSample(
          waterSearchBounds,
          config.resourceSpacing * 2, // wider spacing for fishing spots
          fishTarget * 4, // oversample heavily — most candidates will be rejected
          rng,
          (x, z) => {
            // Must be in or very near water
            const bq = deps.queryBiome(x, z);
            if (bq.height >= deps.waterThreshold) return false;
            // Must be near shore: at least one sample within 15m must be above water
            const probeD = 15;
            const nearShore =
              deps.queryBiome(x + probeD, z).height >= deps.waterThreshold ||
              deps.queryBiome(x - probeD, z).height >= deps.waterThreshold ||
              deps.queryBiome(x, z + probeD).height >= deps.waterThreshold ||
              deps.queryBiome(x, z - probeD).height >= deps.waterThreshold;
            return nearShore;
          },
        );

        const finalFish = fishPositions.slice(0, fishTarget);
        const landResCount = allResources.length;

        for (let i = 0; i < finalFish.length; i++) {
          const pos = finalFish[i];
          const entry = weightedSelect(
            waterTable.map((t) => ({ ...t, weight: t.weight })),
            rng,
          );
          if (!entry) continue;

          allResources.push({
            id: `autogen-fish-${zone.id}-${i}`,
            resourceId: entry.resourceId,
            resourceType: "fishing",
            name: entry.resourceId,
            position: { x: pos.x, y: 0, z: pos.z },
            rotation: rng() * Math.PI * 2,
            modelVariant: 0,
            source: "procgen",
            sourceRegionId: zone.id,
            properties: {},
          });
        }

        if (allResources.length > landResCount) {
          console.log(
            `[EntityPop]   → ${allResources.length - landResCount} fishing spots placed near water (target: ${fishTarget})`,
          );
        }
      }
    }
  }

  return { mobs: allMobs, resources: allResources };
}
