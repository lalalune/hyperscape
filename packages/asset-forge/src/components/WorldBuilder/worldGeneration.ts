/**
 * worldGeneration — Shared world generation logic
 *
 * Extracted from WorldTab so both WorldBuilder and WorldStudio
 * can generate worlds from a WorldCreationConfig.
 */

import { TownGenerator } from "@hyperforge/procgen/building/town";
import type {
  TownBuilding,
  GeneratedTown as ProcgenTown,
} from "@hyperforge/procgen/building/town";
import {
  TerrainGenerator,
  createConfigFromPreset,
  TERRAIN_PRESETS,
  BiomeSystem,
} from "@hyperforge/procgen/terrain";

import type {
  WorldCreationConfig,
  WorldData,
  WorldFoundation,
  GeneratedBiome,
  GeneratedTown,
  GeneratedBuilding,
  GeneratedRoad,
  WorldPosition,
} from "./types";
import { generateWorldName, createNewWorld } from "./utils";
import { GAME_BIOME_DEFINITIONS } from "./GameTerrainAdapter";
import { getActiveBiomeDefinitions } from "../WorldStudio/utils/contentRegistry";

// ============== ROAD GENERATION ==============

interface RoadEdge {
  from: number;
  to: number;
  distance: number;
}

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(x: number, y: number): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return false;
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
    return true;
  }
}

interface RoadNetworkConfig {
  roadWidth: number;
  extraConnectionsRatio: number;
  waterThreshold: number;
  pathStepSize: number;
  smoothingIterations: number;
}

function smoothPath(
  path: WorldPosition[],
  iterations: number,
): WorldPosition[] {
  if (path.length < 3) return path;
  let result = [...path];
  for (let iter = 0; iter < iterations; iter++) {
    const newPath: WorldPosition[] = [result[0]];
    for (let i = 1; i < result.length - 1; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      const next = result[i + 1];
      newPath.push({
        x: (prev.x + curr.x * 2 + next.x) / 4,
        y: (prev.y + curr.y * 2 + next.y) / 4,
        z: (prev.z + curr.z * 2 + next.z) / 4,
      });
    }
    newPath.push(result[result.length - 1]);
    result = newPath;
  }
  return result;
}

function generateRoadPath(
  from: WorldPosition,
  to: WorldPosition,
  terrainGenerator: TerrainGenerator,
  waterThreshold: number,
  pathStepSize: number,
  smoothingIterations: number,
): WorldPosition[] {
  const path: WorldPosition[] = [];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const totalDistance = Math.sqrt(dx * dx + dz * dz);
  const numSamples = Math.max(2, Math.ceil(totalDistance / pathStepSize));

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    let x = from.x + dx * t;
    let z = from.z + dz * t;
    const query = terrainGenerator.queryPoint(x, z);
    let y = query.height;

    if (y < waterThreshold) {
      const searchRadius = pathStepSize * 2;
      const diagonalRadius = pathStepSize * 1.5;
      const offsets = [
        { ox: searchRadius, oz: 0 },
        { ox: -searchRadius, oz: 0 },
        { ox: 0, oz: searchRadius },
        { ox: 0, oz: -searchRadius },
        { ox: diagonalRadius, oz: diagonalRadius },
        { ox: -diagonalRadius, oz: diagonalRadius },
        { ox: diagonalRadius, oz: -diagonalRadius },
        { ox: -diagonalRadius, oz: -diagonalRadius },
      ];

      let bestHeight = y;
      let bestX = x;
      let bestZ = z;

      for (const { ox, oz } of offsets) {
        const testQuery = terrainGenerator.queryPoint(x + ox, z + oz);
        if (
          testQuery.height > bestHeight &&
          testQuery.height >= waterThreshold
        ) {
          bestHeight = testQuery.height;
          bestX = x + ox;
          bestZ = z + oz;
        }
      }

      x = bestX;
      z = bestZ;
      y = bestHeight;
    }

    y = Math.max(y, waterThreshold) + 0.1;
    path.push({ x, y, z });
  }

  return smoothPath(path, smoothingIterations);
}

function generateRoadNetwork(
  towns: GeneratedTown[],
  terrainGenerator: TerrainGenerator,
  config: RoadNetworkConfig,
): GeneratedRoad[] {
  if (towns.length < 2) return [];

  const roads: GeneratedRoad[] = [];
  const edges: RoadEdge[] = [];
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const dx = towns[j].position.x - towns[i].position.x;
      const dz = towns[j].position.z - towns[i].position.z;
      edges.push({ from: i, to: j, distance: Math.sqrt(dx * dx + dz * dz) });
    }
  }

  edges.sort((a, b) => a.distance - b.distance);

  const uf = new UnionFind(towns.length);
  const mstEdges: RoadEdge[] = [];
  const nonMstEdges: RoadEdge[] = [];

  for (const edge of edges) {
    if (uf.union(edge.from, edge.to)) {
      mstEdges.push(edge);
    } else {
      nonMstEdges.push(edge);
    }
  }

  const extraCount = Math.floor(
    nonMstEdges.length * config.extraConnectionsRatio,
  );
  const selectedEdges = [...mstEdges, ...nonMstEdges.slice(0, extraCount)];

  for (let i = 0; i < selectedEdges.length; i++) {
    const edge = selectedEdges[i];
    const fromTown = towns[edge.from];
    const toTown = towns[edge.to];
    const path = generateRoadPath(
      fromTown.position,
      toTown.position,
      terrainGenerator,
      config.waterThreshold,
      config.pathStepSize,
      config.smoothingIterations,
    );
    roads.push({
      id: `road-${i}`,
      path,
      width: config.roadWidth,
      connectedTowns: [fromTown.id, toTown.id],
      isMainRoad: mstEdges.includes(edge),
    });
  }

  return roads;
}

// ============== STAGE FUNCTIONS ==============

/**
 * Stage 1: Create terrain generator + biome system from config.
 * Returns the generator, biome system, and generated biomes.
 */
export function generateTerrainAndBiomes(config: WorldCreationConfig): {
  terrainGenerator: TerrainGenerator;
  biomeSystem: BiomeSystem;
  biomes: GeneratedBiome[];
} {
  const worldSizeMeters = config.terrain.worldSize * config.terrain.tileSize;

  const presetId =
    config.preset && TERRAIN_PRESETS[config.preset]
      ? config.preset
      : "large-island";
  const terrainConfig = createConfigFromPreset(presetId, {
    seed: config.seed,
    worldSize: config.terrain.worldSize,
    tileSize: config.terrain.tileSize,
    tileResolution: config.terrain.tileResolution,
    maxHeight: config.terrain.maxHeight,
    waterThreshold: config.terrain.waterThreshold,
    noise: config.noise,
    biomes: config.biomes,
    island: config.island,
    shoreline: config.shoreline,
  });

  const terrainGenerator = new TerrainGenerator(terrainConfig);

  // R3.P3 — biome system reads engine defaults merged with
  // active plugins' biome contributions. Plugins that declare
  // `desert` / `tropical_jungle` etc. via `contributions.biomes`
  // show up alongside (or override) the engine defaults; blank-
  // no-plugins projects fall through to defaults only.
  const biomeSystem = new BiomeSystem(
    config.seed,
    worldSizeMeters,
    config.biomes,
    getActiveBiomeDefinitions(GAME_BIOME_DEFINITIONS),
  );
  const biomeCenters = biomeSystem.getBiomeCenters();
  const biomes: GeneratedBiome[] = biomeCenters.map((center, index) => {
    const biomeDefinition = biomeSystem.getBiomeDefinition(center.type);
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
      color: biomeDefinition.color,
    };
  });

  // Populate biome tileKeys — assign each tile to its nearest biome center
  const biomeTileSize = config.terrain.tileSize;
  for (let tx = 0; tx < config.terrain.worldSize; tx++) {
    for (let tz = 0; tz < config.terrain.worldSize; tz++) {
      const worldX = tx * biomeTileSize;
      const worldZ = tz * biomeTileSize;
      let closestBiome: GeneratedBiome | null = null;
      let closestDist = Infinity;
      for (const biome of biomes) {
        const dx = worldX - biome.center.x;
        const dz = worldZ - biome.center.z;
        const dist = dx * dx + dz * dz;
        if (dist < closestDist) {
          closestDist = dist;
          closestBiome = biome;
        }
      }
      if (closestBiome) closestBiome.tileKeys.push(`${tx},${tz}`);
    }
  }

  return { terrainGenerator, biomeSystem, biomes };
}

/**
 * Stage 2: Generate towns and buildings from terrain + biomes.
 * Can be called independently to regenerate towns without changing terrain.
 */
export function generateTownsAndBuildings(
  config: WorldCreationConfig,
  terrainGenerator: TerrainGenerator,
  biomes: GeneratedBiome[],
): {
  towns: GeneratedTown[];
  buildings: GeneratedBuilding[];
  rawTowns: ProcgenTown[];
} {
  const worldSizeMeters = config.terrain.worldSize * config.terrain.tileSize;

  const townGenerator = TownGenerator.fromTerrainGenerator(terrainGenerator, {
    seed: config.seed,
    config: {
      townCount: config.towns.townCount,
      minTownSpacing: config.towns.minTownSpacing,
      worldSize: worldSizeMeters,
      waterThreshold: config.terrain.waterThreshold,
      landmarks: {
        fencesEnabled: config.towns.landmarks.fencesEnabled,
        fenceDensity: config.towns.landmarks.fenceDensity,
        fencePostHeight: config.towns.landmarks.fencePostHeight,
        lamppostsInVillages: config.towns.landmarks.lamppostsInVillages,
        lamppostSpacing: config.towns.landmarks.lamppostSpacing,
        marketStallsEnabled: config.towns.landmarks.marketStallsEnabled,
        decorationsEnabled: config.towns.landmarks.decorationsEnabled,
      },
    },
  });

  const townResult = townGenerator.generate();

  const angleToDirection = (angle: number): string => {
    const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (normalized < Math.PI / 4 || normalized >= (Math.PI * 7) / 4)
      return "east";
    if (normalized < (Math.PI * 3) / 4) return "north";
    if (normalized < (Math.PI * 5) / 4) return "west";
    return "south";
  };

  const towns: GeneratedTown[] = townResult.towns.map(
    (procgenTown: ProcgenTown) => {
      const biomeId =
        biomes.find((b) => b.type === procgenTown.biome)?.id ||
        biomes[0]?.id ||
        "";
      return {
        id: procgenTown.id,
        name: procgenTown.name,
        size: procgenTown.size,
        position: {
          x: procgenTown.position.x,
          y: procgenTown.position.y,
          z: procgenTown.position.z,
        },
        layoutType: procgenTown.layoutType || "terminus",
        buildingIds: procgenTown.buildings.map((b: TownBuilding) => b.id),
        entryPoints: (procgenTown.entryPoints || []).map((ep) => ({
          direction: angleToDirection(ep.angle),
          position: { x: ep.position.x, y: 0, z: ep.position.z },
          connectedRoadId: null,
        })),
        biomeId,
      };
    },
  );

  const getBuildingFloors = (buildingType: string): number => {
    const floorsByType: Record<string, number> = {
      bank: 2,
      store: 1,
      anvil: 1,
      well: 1,
      house: 2,
      inn: 2,
      smithy: 1,
      "simple-house": 1,
      "long-house": 1,
    };
    return floorsByType[buildingType] ?? 1;
  };

  const buildings: GeneratedBuilding[] = townResult.towns.flatMap(
    (procgenTown: ProcgenTown) =>
      procgenTown.buildings.map((b: TownBuilding) => ({
        id: b.id,
        type: b.type,
        name: `${b.type.charAt(0).toUpperCase() + b.type.slice(1).replace(/-/g, " ")}`,
        position: { x: b.position.x, y: b.position.y, z: b.position.z },
        rotation: b.rotation,
        townId: procgenTown.id,
        dimensions: {
          width: b.size.width,
          depth: b.size.depth,
          floors: getBuildingFloors(b.type),
        },
      })),
  );

  return { towns, buildings, rawTowns: townResult.towns };
}

/**
 * Stage 3: Generate road network between existing towns.
 * Can be called independently to regenerate roads without changing towns.
 */
export function generateRoadsForTowns(
  config: WorldCreationConfig,
  terrainGenerator: TerrainGenerator,
  towns: GeneratedTown[],
  rawTowns: ProcgenTown[],
): GeneratedRoad[] {
  const interTownRoads = generateRoadNetwork(towns, terrainGenerator, {
    roadWidth: config.roads.roadWidth,
    extraConnectionsRatio: config.roads.extraConnectionsRatio,
    waterThreshold: config.terrain.waterThreshold,
    pathStepSize: config.roads.pathStepSize,
    smoothingIterations: config.roads.smoothingIterations,
  });

  const townInternalRoads: GeneratedRoad[] = [];
  for (const town of rawTowns) {
    const internalRoads = town.internalRoads ?? [];
    for (let i = 0; i < internalRoads.length; i++) {
      const road = internalRoads[i];
      const startY = terrainGenerator.getHeightAt(road.start.x, road.start.z);
      const endY = terrainGenerator.getHeightAt(road.end.x, road.end.z);
      townInternalRoads.push({
        id: `${town.id}_internal_${i}`,
        path: [
          { x: road.start.x, y: startY + 0.1, z: road.start.z },
          { x: road.end.x, y: endY + 0.1, z: road.end.z },
        ],
        width: road.isMain ? 8 : 6,
        connectedTowns: [town.id, town.id],
        isMainRoad: road.isMain,
      });
    }

    const paths = town.paths ?? [];
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const startY = terrainGenerator.getHeightAt(path.start.x, path.start.z);
      const endY = terrainGenerator.getHeightAt(path.end.x, path.end.z);
      townInternalRoads.push({
        id: `${town.id}_path_${i}`,
        path: [
          { x: path.start.x, y: startY + 0.1, z: path.start.z },
          { x: path.end.x, y: endY + 0.1, z: path.end.z },
        ],
        width: path.width || 3,
        connectedTowns: [town.id, town.id],
        isMainRoad: false,
      });
    }
  }

  const roads = [...interTownRoads, ...townInternalRoads];

  // Update town entry points with connected road IDs
  for (const road of interTownRoads) {
    const [townId1, townId2] = road.connectedTowns;
    const town1 = towns.find((t) => t.id === townId1);
    const town2 = towns.find((t) => t.id === townId2);

    if (town1 && town1.entryPoints.length > 0) {
      const roadStart = road.path[0];
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < town1.entryPoints.length; i++) {
        const ep = town1.entryPoints[i];
        const dist = Math.sqrt(
          (ep.position.x - roadStart.x) ** 2 +
            (ep.position.z - roadStart.z) ** 2,
        );
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      town1.entryPoints[closestIdx].connectedRoadId = road.id;
    }

    if (town2 && town2.entryPoints.length > 0) {
      const roadEnd = road.path[road.path.length - 1];
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < town2.entryPoints.length; i++) {
        const ep = town2.entryPoints[i];
        const dist = Math.sqrt(
          (ep.position.x - roadEnd.x) ** 2 + (ep.position.z - roadEnd.z) ** 2,
        );
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      town2.entryPoints[closestIdx].connectedRoadId = road.id;
    }
  }

  return roads;
}

// ============== WORLD GENERATION ==============

/**
 * Generate a complete WorldData object from a WorldCreationConfig.
 * This runs terrain generation, biome assignment, town placement,
 * road network generation, and creates the locked world foundation.
 *
 * Internally uses the stage functions above — kept for backward compatibility.
 */
export function generateWorldFromConfig(
  config: WorldCreationConfig,
): WorldData {
  // Stage 1: Terrain + Biomes
  const { terrainGenerator, biomes } = generateTerrainAndBiomes(config);

  // Stage 2: Towns + Buildings
  const { towns, buildings, rawTowns } = generateTownsAndBuildings(
    config,
    terrainGenerator,
    biomes,
  );

  // Stage 3: Roads
  const roads = generateRoadsForTowns(
    config,
    terrainGenerator,
    towns,
    rawTowns,
  );

  // Assign tiles to biomes (secondary pass using terrain query for visual biome)
  const tileSize = config.terrain.tileSize;
  for (let tx = 0; tx < config.terrain.worldSize; tx++) {
    for (let tz = 0; tz < config.terrain.worldSize; tz++) {
      const tileCenterX = (tx + 0.5) * tileSize;
      const tileCenterZ = (tz + 0.5) * tileSize;
      const tileKey = `${tx},${tz}`;
      const query = terrainGenerator.queryPoint(tileCenterX, tileCenterZ);
      const matchingBiome = biomes.find((b) => b.type === query.biome);
      if (matchingBiome) {
        matchingBiome.tileKeys.push(tileKey);
      }
    }
  }

  // Create foundation
  const foundation: WorldFoundation = {
    version: 1,
    createdAt: Date.now(),
    config,
    biomes,
    towns,
    buildings,
    roads,
    heightmapCache: new Map(),
  };

  const world = createNewWorld(
    foundation,
    generateWorldName(config.seed),
    `Generated world with seed ${config.seed}`,
  );

  console.log(
    `[WorldGeneration] Generated world: ${towns.length} towns, ${buildings.length} buildings, ${roads.length} roads, ${biomes.length} biomes`,
  );

  return world;
}
