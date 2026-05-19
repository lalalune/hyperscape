/**
 * minePlacement — Place dedicated mine areas with clustered ore rocks
 *
 * tile-based-MMORPG-style mine POIs: clustered ore deposits within a rocky area
 * that gets terrain coloring (via mine influence vertex attributes).
 *
 * Runs BEFORE populateEntities() so scattered mining rocks can be filtered
 * out of mine boundaries, and mine centers act as exclusion zones.
 */

import type {
  PlacedMine,
  PlacedResource,
  AutoGenConfig,
  AutoGenZone,
  ManifestData,
} from "../types";
import type {
  PopulationDeps,
  ExistingEntityPosition,
} from "../pipeline/entityPopulator";
import { inferResourceType } from "../pipeline/entityPopulator";
import type { TownInfo } from "../../WorldBuilder/DifficultyHeatmap";
import { BIOME_RESOURCE_WEIGHTS } from "../pipeline/spawnTableBuilder";
import {
  createSeededRng,
  hashString,
  weightedSelect,
} from "../utils/procgenUtils";
import { poissonDiscSample } from "../utils/poissonDisc";

// ============== CONSTANTS ==============

/** Minimum mine spacing (meters) */
const MIN_MINE_SPACING = 120;
/** Minimum distance from town centers (meters) — players should walk to mines */
const MIN_TOWN_DISTANCE = 180;
/** Minimum distance from bank structures (meters) */
const MIN_BANK_DISTANCE = 150;
/** Minimum distance from road paths (meters) */
const MIN_ROAD_DISTANCE = 30;
/** Minimum distance from bridge midpoints (meters) — never under bridges */
const MIN_BRIDGE_DISTANCE = 50;
/** Minimum distance from buildings and structures (meters) */
const MIN_STRUCTURE_DISTANCE = 25;
/** Minimum distance from existing entities like trees (meters) */
const MIN_ENTITY_DISTANCE = 10;
/** Maximum height variance across radial probes before rejection */
const MAX_SLOPE_VARIANCE = 5;
/** Rock spacing within mine (meters) — even distribution across whole area */
const MINE_ROCK_SPACING = 3.5;
/** Minimum distance (meters) ore rocks must be inset from the mine boundary edge */
const MINE_EDGE_INSET = 4;
/** Minimum zone area for mine placement (m²) */
const MIN_ZONE_AREA = 8000;
/** Number of angular control points for organic mine shape */
const RADIAL_POINTS = 16;
/** Bowl depth at back wall (m) — entry side is 40% of this */
const BOWL_DEPTH = 3.0;
/** Entry side depth multiplier (gentle ramp) */
const ENTRY_DEPTH_RATIO = 0.4;

/** Mine name suffixes */
const MINE_SUFFIXES = ["Mine", "Quarry", "Deposit", "Pit"];
/** Cardinal directions */
const CARDINALS = [
  "Northern",
  "Southern",
  "Eastern",
  "Western",
  "Central",
] as const;

// ============== ORGANIC SHAPE HELPERS ==============

/** Generate radial offset multipliers for an organic mine boundary */
function generateRadialOffsets(rng: () => number): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < RADIAL_POINTS; i++) {
    offsets.push(0.82 + rng() * 0.36); // 0.82 – 1.18 range (±18%)
  }
  return offsets;
}

/**
 * Get effective mine radius at a given angle using radial offsets.
 * Cosine-interpolates between control points for smooth organic shape.
 */
function getEffectiveRadius(
  baseRadius: number,
  offsets: number[],
  angle: number,
): number {
  const n = offsets.length;
  if (n === 0) return baseRadius;
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const seg = (a / (Math.PI * 2)) * n;
  const i = Math.floor(seg);
  const f = seg - i;
  const v0 = offsets[i % n];
  const v1 = offsets[(i + 1) % n];
  // Cosine interpolation for smooth transitions
  const t = 0.5 * (1 - Math.cos(Math.PI * f));
  return baseRadius * (v0 + (v1 - v0) * t);
}

// ============== HELPERS ==============

/** Get the mining affinity weight for a biome */
function getBiomeMiningAffinity(biome: string): number {
  const weights = BIOME_RESOURCE_WEIGHTS[biome];
  return weights?.["mining"] ?? 0.8;
}

/** Check if a zone has mining rocks in its spawn table */
function zoneHasMiningRocks(zone: AutoGenZone): boolean {
  if (!zone.spawnRules.resources?.table) return false;
  return zone.spawnRules.resources.table.some(
    (entry) => inferResourceType(entry.resourceId) === "mining",
  );
}

/** Get mining rock entries from a zone's spawn table */
function getZoneMiningRocks(
  zone: AutoGenZone,
): Array<{ resourceId: string; weight: number }> {
  if (!zone.spawnRules.resources?.table) return [];
  return zone.spawnRules.resources.table.filter(
    (entry) => inferResourceType(entry.resourceId) === "mining",
  );
}

/** Generate a mine name based on position relative to nearest town */
function generateMineName(
  mineX: number,
  mineZ: number,
  primaryOre: string,
  towns: TownInfo[],
  rng: () => number,
): string {
  // Find nearest town for cardinal direction
  let direction = CARDINALS[Math.floor(rng() * CARDINALS.length)];
  if (towns.length > 0) {
    let nearestTown = towns[0];
    let nearestDist = Infinity;
    for (const town of towns) {
      const dx = mineX - town.position.x;
      const dz = mineZ - town.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestTown = town;
      }
    }
    const dx = mineX - nearestTown.position.x;
    const dz = mineZ - nearestTown.position.z;
    if (Math.abs(dx) > Math.abs(dz)) {
      direction = dx > 0 ? "Eastern" : "Western";
    } else {
      direction = dz > 0 ? "Southern" : "Northern";
    }
  }

  // Clean ore name: "ore_iron" → "Iron"
  const oreName = primaryOre
    .replace(/^ore_/, "")
    .replace(/^rock_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const suffix = MINE_SUFFIXES[Math.floor(rng() * MINE_SUFFIXES.length)];
  return `${direction} ${oreName} ${suffix}`;
}

/** Minimum distance from a point to any segment of a road path */
function distanceToRoadPath(
  x: number,
  z: number,
  path: Array<{ x: number; z: number }>,
): number {
  let minDist = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i].x,
      az = path[i].z;
    const bx = path[i + 1].x,
      bz = path[i + 1].z;
    // Project point onto segment
    const abx = bx - ax,
      abz = bz - az;
    const lenSq = abx * abx + abz * abz;
    if (lenSq === 0) {
      const d = Math.sqrt((x - ax) ** 2 + (z - az) ** 2);
      if (d < minDist) minDist = d;
      continue;
    }
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * abx + (z - az) * abz) / lenSq),
    );
    const px = ax + t * abx,
      pz = az + t * abz;
    const d = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** Check terrain slope at a position using radial probes */
function checkSlope(
  x: number,
  z: number,
  radius: number,
  queryBiome: PopulationDeps["queryBiome"],
): number {
  const centerH = queryBiome(x, z).height;
  let maxDelta = 0;
  for (const [dx, dz] of [
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
  ] as const) {
    const probeH = queryBiome(x + dx, z + dz).height;
    maxDelta = Math.max(maxDelta, Math.abs(probeH - centerH));
  }
  return maxDelta;
}

/**
 * Compute the entry angle for a mine — direction from center toward the
 * nearest town or road point. Rocks are excluded from this sector so
 * the mine has a walkable entrance facing civilization.
 */
function computeEntryAngle(
  centerX: number,
  centerZ: number,
  towns: TownInfo[],
  roads: Array<{ path: Array<{ x: number; z: number }> }> | undefined,
  rng: () => number,
): number {
  let nearestDist = Infinity;
  let nearestAngle = rng() * Math.PI * 2; // fallback: random direction

  for (const town of towns) {
    const dx = town.position.x - centerX;
    const dz = town.position.z - centerZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestAngle = Math.atan2(dz, dx);
    }
  }

  if (roads) {
    for (const road of roads) {
      for (const p of road.path) {
        const dx = p.x - centerX;
        const dz = p.z - centerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestAngle = Math.atan2(dz, dx);
        }
      }
    }
  }

  return nearestAngle;
}

/**
 * Compute angular distance from entry direction (0 = entry, PI = back wall).
 * Shared between getMineBowlHeight and TileBasedTerrain for consistency.
 */
function angleFromEntry(angle: number, entryAngle: number): number {
  let d = Math.abs(angle - entryAngle);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

/**
 * Compute asymmetric depth multiplier: gentle ramp at entry, steep at back.
 * Must match TileBasedTerrain.tsx exactly.
 */
function bowlDepthMultiplier(angleFromEntryVal: number): number {
  return (
    ENTRY_DEPTH_RATIO + (1 - ENTRY_DEPTH_RATIO) * (angleFromEntryVal / Math.PI)
  );
}

/**
 * Compute the bowl-adjusted terrain height at a point inside a mine.
 * Must exactly match the bowl shaping in TileBasedTerrain.tsx so ore rocks
 * sit flush on the depressed terrain surface.
 */
function getMineBowlHeight(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  centerHeight: number,
  radius: number,
  radialOffsets: number[],
  entryAng: number,
  queryBiome: PopulationDeps["queryBiome"],
): number {
  const terrainHeight = queryBiome(x, z).height;
  const dx = x - centerX;
  const dz = z - centerZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const R = getEffectiveRadius(radius, radialOffsets, angle);

  if (dist >= R * 1.2) return terrainHeight;

  const t = Math.min(dist / R, 1.0);
  const bowlFactor = 0.5 * (1 + Math.cos(Math.PI * t));

  // Asymmetric depth: gentle entry ramp, steep back wall
  const afe = angleFromEntry(angle, entryAng);
  const depthMul = bowlDepthMultiplier(afe);

  // Micro-undulation (must match TileBasedTerrain.tsx exactly)
  const undulation1 = Math.sin(x * 0.7 + 1.3) * Math.cos(z * 0.9 + 2.1) * 0.3;
  const undulation2 = Math.sin(x * 2.3 + z * 1.7) * 0.15;
  const undulation3 = Math.cos(x * 4.1 - z * 3.3) * 0.06;
  const floorNoise = (undulation1 + undulation2 + undulation3) * bowlFactor;

  // Rim bumps (suppressed on entry side for smooth ramp)
  const rimT = Math.max(0, 1 - Math.abs(t - 0.88) / 0.12);
  const rimSuppression = Math.min(1, afe / (Math.PI * 0.4)); // 0 at entry, 1 past 72°
  const rimBump =
    (Math.sin(x * 1.5 + z * 2.1) * 0.3 + Math.cos(x * 2.7 - z * 1.3) * 0.15) *
    rimT *
    rimSuppression;

  const targetHeight =
    centerHeight - BOWL_DEPTH * depthMul * bowlFactor + floorNoise + rimBump;

  let blend = 1.0;
  if (dist > R) {
    const fadeT = (dist - R) / (R * 0.2);
    blend = 1.0 - fadeT * fadeT * (3 - 2 * fadeT);
  }

  return terrainHeight + (targetHeight - terrainHeight) * blend;
}

// ============== MAIN FUNCTION ==============

/**
 * Detect bridge midpoints from road paths — segments where both endpoints
 * are below the water threshold (road crosses water).
 */
function detectBridgeMidpoints(
  roads: Array<{ path: Array<{ x: number; z: number }> }> | undefined,
  queryBiome: PopulationDeps["queryBiome"],
  waterThreshold: number,
): Array<{ x: number; z: number }> {
  if (!roads) return [];
  const midpoints: Array<{ x: number; z: number }> = [];
  for (const road of roads) {
    for (let i = 0; i < road.path.length - 1; i++) {
      const a = road.path[i];
      const b = road.path[i + 1];
      const aH = queryBiome(a.x, a.z).height;
      const bH = queryBiome(b.x, b.z).height;
      // If either endpoint is below water, this segment is a bridge/causeway
      if (aH < waterThreshold || bH < waterThreshold) {
        midpoints.push({
          x: (a.x + b.x) / 2,
          z: (a.z + b.z) / 2,
        });
      }
    }
  }
  return midpoints;
}

export function placeMines(
  zones: AutoGenZone[],
  config: AutoGenConfig,
  deps: PopulationDeps,
  manifests: ManifestData,
  towns: TownInfo[],
  seed: number,
  roads?: Array<{ path: Array<{ x: number; z: number }> }>,
  structures?: Array<{ x: number; z: number; radius: number }>,
  existingEntities?: ExistingEntityPosition[],
  banks?: Array<{ x: number; z: number }>,
): { mines: PlacedMine[]; mineResources: PlacedResource[] } {
  const allMines: PlacedMine[] = [];
  const allMineResources: PlacedResource[] = [];
  const rng = createSeededRng(seed + hashString("mines"));

  // Detect bridge midpoints from road segments crossing water
  const bridgeMidpoints = detectBridgeMidpoints(
    roads,
    deps.queryBiome,
    deps.waterThreshold,
  );

  // Track placed mine centers for inter-mine spacing
  const mineCenters: Array<{ x: number; z: number }> = [];

  for (const zone of zones) {
    // Skip small zones or zones without mining rocks
    if (zone.area < MIN_ZONE_AREA) continue;
    if (!zoneHasMiningRocks(zone)) continue;

    const biomeAffinity = getBiomeMiningAffinity(zone.biome);
    const mineCount = Math.min(
      2,
      Math.max(0, Math.floor((zone.area / 50000) * biomeAffinity)),
    );
    if (mineCount === 0) continue;

    const zoneRng = createSeededRng(seed + hashString(zone.id + "-mines"));
    const miningRocks = getZoneMiningRocks(zone);
    if (miningRocks.length === 0) continue;

    // Place mine centers via Poisson disc sampling
    const candidateCenters = poissonDiscSample(
      zone.bounds,
      MIN_MINE_SPACING,
      mineCount * 5,
      zoneRng,
      (x, z) => {
        // Must be above water — check center AND 8 radial probes at max radius
        // to ensure the entire mine footprint is on dry land
        const bq = deps.queryBiome(x, z);
        if (bq.height < deps.waterThreshold) return false;
        const WATER_PROBE_R = 25; // max mine radius — conservative check
        for (let a = 0; a < 8; a++) {
          const angle = (a / 8) * Math.PI * 2;
          const px = x + Math.cos(angle) * WATER_PROBE_R;
          const pz = z + Math.sin(angle) * WATER_PROBE_R;
          if (deps.queryBiome(px, pz).height < deps.waterThreshold)
            return false;
        }

        // Must be far enough from town centers
        for (const town of towns) {
          const dx = x - town.position.x;
          const dz = z - town.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < MIN_TOWN_DISTANCE) return false;
        }

        // Must be far enough from other mine centers
        for (const mc of mineCenters) {
          const dx = x - mc.x;
          const dz = z - mc.z;
          if (Math.sqrt(dx * dx + dz * dz) < MIN_MINE_SPACING) return false;
        }

        // Must be far enough from road paths
        if (roads) {
          for (const road of roads) {
            if (
              road.path.length >= 2 &&
              distanceToRoadPath(x, z, road.path) < MIN_ROAD_DISTANCE
            ) {
              return false;
            }
          }
        }

        // Must be far enough from bridge midpoints (never under bridges)
        for (const bp of bridgeMidpoints) {
          const dx2 = x - bp.x;
          const dz2 = z - bp.z;
          if (Math.sqrt(dx2 * dx2 + dz2 * dz2) < MIN_BRIDGE_DISTANCE)
            return false;
        }

        // Must be far enough from banks (players should walk to mines)
        if (banks) {
          for (const bank of banks) {
            const dx2 = x - bank.x;
            const dz2 = z - bank.z;
            if (Math.sqrt(dx2 * dx2 + dz2 * dz2) < MIN_BANK_DISTANCE)
              return false;
          }
        }

        // Must be far enough from buildings and structures
        if (structures) {
          for (const s of structures) {
            const dx = x - s.x;
            const dz = z - s.z;
            if (
              Math.sqrt(dx * dx + dz * dz) <
              s.radius + MIN_STRUCTURE_DISTANCE
            )
              return false;
          }
        }

        // Must be far enough from existing entities (trees, NPCs, etc.)
        if (existingEntities) {
          for (const e of existingEntities) {
            const dx = x - e.x;
            const dz = z - e.z;
            if (Math.sqrt(dx * dx + dz * dz) < e.radius + MIN_ENTITY_DISTANCE)
              return false;
          }
        }

        // Reject steep slopes
        const radius = 15 + zoneRng() * 10;
        if (checkSlope(x, z, radius, deps.queryBiome) > MAX_SLOPE_VARIANCE) {
          return false;
        }

        return true;
      },
    );

    const centersToPlace = candidateCenters.slice(0, mineCount);

    for (let mi = 0; mi < centersToPlace.length; mi++) {
      const center = centersToPlace[mi];
      const mineRng = createSeededRng(
        seed + hashString(zone.id + `-mine-${mi}`),
      );
      const radius = 15 + mineRng() * 10;
      const radialOffsets = generateRadialOffsets(mineRng);
      const mineId = `autogen-mine-${zone.id}-${mi}`;
      const centerHeight = deps.queryBiome(center.x, center.z).height;

      mineCenters.push({ x: center.x, z: center.z });

      // Select 2-4 ore types from zone's mining spawn table
      const oreTypeCount = 2 + Math.floor(mineRng() * 3); // 2-4
      const selectedOres: Array<{ resourceId: string; count: number }> = [];
      const usedOres = new Set<string>();

      for (let oi = 0; oi < oreTypeCount && oi < miningRocks.length; oi++) {
        const entry = weightedSelect(
          miningRocks.filter((r) => !usedOres.has(r.resourceId)),
          mineRng,
        );
        if (!entry) break;
        usedOres.add(entry.resourceId);

        // Rock count based on ore level
        const rock = manifests.miningRocks.find(
          (r) => r.id === entry.resourceId,
        );
        const level = rock?.levelRequired ?? 1;
        let count: number;
        if (level >= 61) {
          count = 1 + Math.floor(mineRng() * 2); // 1-2
        } else if (level >= 31) {
          count = 2 + Math.floor(mineRng() * 3); // 2-4
        } else {
          count = 3 + Math.floor(mineRng() * 3); // 3-5
        }
        selectedOres.push({ resourceId: entry.resourceId, count });
      }

      const totalRocks = selectedOres.reduce((sum, o) => sum + o.count, 0);

      // Generate mine name
      const primaryOre = selectedOres[0]?.resourceId ?? "ore_copper";
      const name = generateMineName(
        center.x,
        center.z,
        primaryOre,
        towns,
        mineRng,
      );

      // Compute entry direction — used for asymmetric bowl depth
      // (gentle ramp at entry, steep back wall)
      const entryAngle = computeEntryAngle(
        center.x,
        center.z,
        towns,
        roads,
        mineRng,
      );

      // Place ore rocks evenly throughout the mine area via Poisson disc.
      // Rocks fill the whole space with consistent spacing — no C-shape or inner cutoff.
      const maxOffset = Math.max(...radialOffsets);
      const outerBound = radius * maxOffset * 0.7;
      const rockBounds = {
        minX: center.x - outerBound,
        maxX: center.x + outerBound,
        minZ: center.z - outerBound,
        maxZ: center.z + outerBound,
      };

      const rockPositions = poissonDiscSample(
        rockBounds,
        MINE_ROCK_SPACING,
        totalRocks * 3,
        mineRng,
        (x, z) => {
          const dx = x - center.x;
          const dz = z - center.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const angle = Math.atan2(dz, dx);
          const effectiveR = getEffectiveRadius(radius, radialOffsets, angle);

          // The mine floor shader fades over effectiveR * 1.2 using cosine falloff.
          // influence = 0.5*(1+cos(PI * dist/(effectiveR*1.2)))
          // At dist = effectiveR*0.7, influence ≈ 0.36 — still visibly mine floor.
          // Subtract MINE_EDGE_INSET to keep rocks safely inside the visible boundary.
          if (dist > effectiveR * 0.7 - MINE_EDGE_INSET) return false;

          // Must be above water
          return deps.queryBiome(x, z).height >= deps.waterThreshold;
        },
      );

      // Shuffle positions and assign ore types in round-robin for even mix
      const shuffledPositions = [...rockPositions];
      for (let i = shuffledPositions.length - 1; i > 0; i--) {
        const j = Math.floor(mineRng() * (i + 1));
        [shuffledPositions[i], shuffledPositions[j]] = [
          shuffledPositions[j],
          shuffledPositions[i],
        ];
      }

      // Assign ore types evenly — cycle through ore types to distribute across the space
      let posIdx = 0;
      let rockIdx = 0;
      for (const ore of selectedOres) {
        for (
          let ri = 0;
          ri < ore.count && posIdx < shuffledPositions.length;
          ri++
        ) {
          const pos = shuffledPositions[posIdx++];
          const rockY = getMineBowlHeight(
            pos.x,
            pos.z,
            center.x,
            center.z,
            centerHeight,
            radius,
            radialOffsets,
            entryAngle,
            deps.queryBiome,
          );
          allMineResources.push({
            id: `autogen-mine-res-${zone.id}-${mi}-${rockIdx}`,
            resourceId: ore.resourceId,
            resourceType: "mining",
            name: ore.resourceId,
            position: { x: pos.x, y: rockY, z: pos.z },
            rotation: mineRng() * Math.PI * 2,
            modelVariant: 0,
            source: "procgen",
            sourceRegionId: zone.id,
            properties: { mineId },
          });
          rockIdx++;
        }
      }

      allMines.push({
        id: mineId,
        name,
        position: { x: center.x, y: centerHeight, z: center.z },
        radius,
        radialOffsets,
        entryAngle,
        biome: zone.biome,
        tierIndex: zone.tierIndex,
        oreRocks: selectedOres,
        source: "procgen",
        sourceRegionId: zone.id,
        properties: {},
      });
    }
  }

  console.log(
    `[MinePlacement] Placed ${allMines.length} mines with ${allMineResources.length} ore rocks`,
  );

  return { mines: allMines, mineResources: allMineResources };
}

/**
 * Filter out individually scattered mining rocks that fall inside any mine boundary.
 * Called after populateEntities to remove redundant scattered rocks.
 */
export function filterScatteredMiningRocks(
  resources: PlacedResource[],
  mines: PlacedMine[],
): PlacedResource[] {
  if (mines.length === 0) return resources;

  return resources.filter((r) => {
    // Only filter mining resources
    if (r.resourceType !== "mining") return true;
    // Keep mine-placed resources
    if (r.properties.mineId) return true;

    // Check if this scattered rock falls inside any mine's organic boundary
    for (const mine of mines) {
      const dx = r.position.x - mine.position.x;
      const dz = r.position.z - mine.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx);
      const effectiveR = getEffectiveRadius(
        mine.radius,
        mine.radialOffsets,
        angle,
      );
      if (dist <= effectiveR) {
        return false; // Inside mine boundary — filter out
      }
    }
    return true;
  });
}
