/**
 * WorldTab
 *
 * Integrated world creation and editing component.
 * Combines the Creation Mode (procedural generation) and Editing Mode (layered content).
 * Designed to be used as a tab within the WorldBuilderPage.
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
import React, { useCallback, useEffect, useRef, useState } from "react";

import { CreationPanel } from "./CreationMode";
import { EditorLayout, SavedWorldsDialog } from "./EditingMode";
import { TileBasedTerrain } from "./TileBasedTerrain";
import { WorldBuilderProvider, useWorldBuilder } from "./WorldBuilderContext";
import { ModeBanner } from "./shared";
import type {
  WorldData,
  WorldFoundation,
  GeneratedBiome,
  GeneratedTown,
  GeneratedBuilding,
  GeneratedRoad,
  WorldPosition,
  Selection,
} from "./types";
import {
  importWorldFromFile,
  generateWorldName,
  createNewWorld,
  downloadGameManifests,
  downloadAllGameManifests,
  autosaveWorld,
  saveWorldToIndexedDB,
  listWorldsInIndexedDB,
  loadWorldFromIndexedDB,
  deleteWorldFromIndexedDB,
} from "./utils";

// ============== ROAD GENERATION ==============

interface RoadEdge {
  from: number;
  to: number;
  distance: number;
}

/**
 * Union-Find data structure for Kruskal's MST algorithm
 */
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // Path compression
    }
    return this.parent[x];
  }

  union(x: number, y: number): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return false; // Already in same set

    // Union by rank
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

/**
 * Generate roads between towns using Minimum Spanning Tree + extra connections
 */
interface RoadNetworkConfig {
  roadWidth: number;
  extraConnectionsRatio: number;
  waterThreshold: number;
  pathStepSize: number;
  smoothingIterations: number;
}

function generateRoadNetwork(
  towns: GeneratedTown[],
  terrainGenerator: TerrainGenerator,
  config: RoadNetworkConfig,
): GeneratedRoad[] {
  if (towns.length < 2) return [];

  const roads: GeneratedRoad[] = [];

  // Calculate all pairwise distances
  const edges: RoadEdge[] = [];
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const dx = towns[j].position.x - towns[i].position.x;
      const dz = towns[j].position.z - towns[i].position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      edges.push({ from: i, to: j, distance });
    }
  }

  // Sort edges by distance (Kruskal's algorithm)
  edges.sort((a, b) => a.distance - b.distance);

  // Find MST edges
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

  // Add some extra connections beyond MST for redundancy
  const extraCount = Math.floor(
    nonMstEdges.length * config.extraConnectionsRatio,
  );
  const selectedEdges = [...mstEdges, ...nonMstEdges.slice(0, extraCount)];

  // Generate road paths for each selected edge
  for (let i = 0; i < selectedEdges.length; i++) {
    const edge = selectedEdges[i];
    const fromTown = towns[edge.from];
    const toTown = towns[edge.to];
    const isMainRoad = mstEdges.includes(edge);

    // Generate terrain-aware path between towns
    const path = generateRoadPath(
      fromTown.position,
      toTown.position,
      terrainGenerator,
      config.waterThreshold,
      config.pathStepSize,
      config.smoothingIterations,
    );

    const road: GeneratedRoad = {
      id: `road-${i}`,
      path,
      width: config.roadWidth,
      connectedTowns: [fromTown.id, toTown.id],
      isMainRoad,
    };

    roads.push(road);
  }

  return roads;
}

/**
 * Generate a terrain-aware path between two points using simple waypoint system
 * Uses intermediate sampling to avoid water and steep slopes
 */
function generateRoadPath(
  from: WorldPosition,
  to: WorldPosition,
  terrainGenerator: TerrainGenerator,
  waterThreshold: number,
  pathStepSize: number,
  smoothingIterations: number,
): WorldPosition[] {
  const path: WorldPosition[] = [];

  // Calculate total distance
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const totalDistance = Math.sqrt(dx * dx + dz * dz);

  // Sample points along the path at regular intervals using config
  const numSamples = Math.max(2, Math.ceil(totalDistance / pathStepSize));

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    let x = from.x + dx * t;
    let z = from.z + dz * t;

    // Query terrain height at this point
    const query = terrainGenerator.queryPoint(x, z);
    let y = query.height;

    // If underwater, try to find higher ground nearby
    // Search radius scales with pathStepSize for appropriate terrain resolution
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

    // Ensure road surface is slightly above terrain
    y = Math.max(y, waterThreshold) + 0.1;

    path.push({ x, y, z });
  }

  // Smooth the path to reduce jaggedness
  return smoothPath(path, smoothingIterations);
}

/**
 * Smooth a path using simple averaging
 */
function smoothPath(
  path: WorldPosition[],
  iterations: number,
): WorldPosition[] {
  if (path.length < 3) return path;

  let result = [...path];

  for (let iter = 0; iter < iterations; iter++) {
    const newPath: WorldPosition[] = [result[0]]; // Keep start point

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

    newPath.push(result[result.length - 1]); // Keep end point
    result = newPath;
  }

  return result;
}

// ============== WORLD TAB CONTENT ==============

interface WorldTabContentProps {
  /** Callback when a world is generated and locked */
  onWorldCreated?: (world: WorldData) => void;
  /** Callback when a world is saved */
  onWorldSave?: (world: WorldData) => Promise<void>;
  /** Callback when world export is requested */
  onWorldExport?: (world: WorldData) => void;
  /** Callback when world import is requested */
  onWorldImport?: (world: WorldData) => void;
}

const WorldTabContent: React.FC<WorldTabContentProps> = ({
  onWorldCreated,
  onWorldSave,
  onWorldExport,
  onWorldImport,
}) => {
  const { state, actions, computed } = useWorldBuilder();
  const isSavingRef = useRef(false);

  // Visualization state
  const [showVegetation, setShowVegetation] = React.useState(false);

  // Fly mode state - controlled externally for better UX
  const [flyModeEnabled, setFlyModeEnabled] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not focused on an input
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ctrl/Cmd + Z = Undo
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "z" &&
        !event.shiftKey
      ) {
        if (!isInput && computed.canUndo) {
          event.preventDefault();
          actions.undo();
        }
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "y" || (event.key === "z" && event.shiftKey))
      ) {
        if (!isInput && computed.canRedo) {
          event.preventDefault();
          actions.redo();
        }
        return;
      }

      // Ctrl/Cmd + S = Save
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (
          state.editing.world &&
          state.editing.hasUnsavedChanges &&
          !isSavingRef.current
        ) {
          isSavingRef.current = true;
          onWorldSave?.(state.editing.world)
            .then(() => {
              actions.markSaved();
              isSavingRef.current = false;
            })
            .catch((err) => {
              actions.setSaveError(
                err instanceof Error ? err.message : "Save failed",
              );
              isSavingRef.current = false;
            });
        }
        return;
      }

      // Escape = Deselect / Cancel
      if (event.key === "Escape") {
        if (state.editing.selection) {
          event.preventDefault();
          actions.setSelection(null);
        }
        return;
      }

      // Delete / Backspace = Delete selected item (if applicable)
      if ((event.key === "Delete" || event.key === "Backspace") && !isInput) {
        const selection = state.editing.selection;
        if (selection) {
          event.preventDefault();
          // Only delete layer items, not foundation items
          switch (selection.type) {
            case "npc":
              actions.removeNPC(selection.id);
              actions.setSelection(null);
              break;
            case "quest":
              actions.removeQuest(selection.id);
              actions.setSelection(null);
              break;
            case "boss":
              actions.removeBoss(selection.id);
              actions.setSelection(null);
              break;
            case "event":
              actions.removeEvent(selection.id);
              actions.setSelection(null);
              break;
            case "lore":
              actions.removeLore(selection.id);
              actions.setSelection(null);
              break;
            case "difficultyZone":
              actions.removeDifficultyZone(selection.id);
              actions.setSelection(null);
              break;
            case "customPlacement":
              actions.removeCustomPlacement(selection.id);
              actions.setSelection(null);
              break;
            // Foundation items (biome, town, building) cannot be deleted
          }
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.editing, actions, computed.canUndo, computed.canRedo, onWorldSave]);

  // Auto-save to localStorage when world changes
  const autosaveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    const world = state.editing.world;
    if (!world || !state.editing.hasUnsavedChanges) return;

    // Debounce autosave by 2 seconds
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      autosaveWorld(world);
      console.log(`[WorldBuilder] Auto-saved "${world.name}" to localStorage`);
    }, 2000);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [state.editing.world, state.editing.hasUnsavedChanges]);

  // Handle generate preview - TileBasedTerrain auto-regenerates when config changes
  // This just triggers UI state change and randomizes seed
  const handleGeneratePreview = useCallback(() => {
    actions.startGeneration();
    // Randomize the seed to trigger a new terrain
    actions.randomizeSeed();
  }, [actions]);

  // Handle generation complete (called from TileBasedTerrain tile count updates)
  const handleGenerationComplete = useCallback(
    (stats: {
      tileCount: number;
      biomeCount: number;
      townCount: number;
      roadCount: number;
      generationTime: number;
    }) => {
      actions.finishGeneration({
        tiles: stats.tileCount,
        biomes: stats.biomeCount,
        towns: stats.townCount,
        roads: stats.roadCount,
        generationTime: stats.generationTime,
      });
    },
    [actions],
  );

  // Handle apply and lock
  const handleApplyAndLock = useCallback(() => {
    const config = state.creation.config;
    const worldSizeMeters = config.terrain.worldSize * config.terrain.tileSize;

    // Create terrain generator for procgen integration
    let terrainConfig;
    if (config.preset && TERRAIN_PRESETS[config.preset]) {
      terrainConfig = createConfigFromPreset(config.preset, {
        seed: config.seed,
        worldSize: config.terrain.worldSize,
        tileSize: config.terrain.tileSize,
        tileResolution: config.terrain.tileResolution,
        maxHeight: config.terrain.maxHeight,
        waterThreshold: config.terrain.waterThreshold,
      });
    } else {
      terrainConfig = createConfigFromPreset("large-island", {
        seed: config.seed,
        worldSize: config.terrain.worldSize,
        tileSize: config.terrain.tileSize,
        tileResolution: config.terrain.tileResolution,
        maxHeight: config.terrain.maxHeight,
        waterThreshold: config.terrain.waterThreshold,
      });
    }

    const terrainGenerator = new TerrainGenerator(terrainConfig);

    // Generate real biomes using BiomeSystem
    const biomeSystem = new BiomeSystem(
      config.seed,
      worldSizeMeters,
      config.biomes,
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
        tileKeys: [], // Would require tile-by-tile assignment
        color: biomeDefinition.color,
      };
    });

    // Generate real towns using TownGenerator
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

    // Helper to convert entry point angle to direction string
    const angleToDirection = (angle: number): string => {
      const normalized =
        ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (normalized < Math.PI / 4 || normalized >= (Math.PI * 7) / 4)
        return "east";
      if (normalized < (Math.PI * 3) / 4) return "north";
      if (normalized < (Math.PI * 5) / 4) return "west";
      return "south";
    };

    // Map procgen towns to WorldBuilder format
    const towns: GeneratedTown[] = townResult.towns.map(
      (procgenTown: ProcgenTown) => {
        // Find which biome the town is in
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

    // Estimate building floors based on type
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

    // Map procgen buildings to WorldBuilder format
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

    // Generate road network connecting all towns (inter-town roads)
    const interTownRoads = generateRoadNetwork(towns, terrainGenerator, {
      roadWidth: config.roads.roadWidth,
      extraConnectionsRatio: config.roads.extraConnectionsRatio,
      waterThreshold: config.terrain.waterThreshold,
      pathStepSize: config.roads.pathStepSize,
      smoothingIterations: config.roads.smoothingIterations,
    });

    // Also include town internal roads in the roads array for terrain road influence
    // This ensures roads through/within towns are properly rendered on terrain
    const townInternalRoads: GeneratedRoad[] = [];
    for (const town of townResult.towns) {
      const internalRoads = town.internalRoads ?? [];
      for (let i = 0; i < internalRoads.length; i++) {
        const road = internalRoads[i];
        // Convert internal road segment to GeneratedRoad format
        // Sample terrain height at start and end
        const startY = terrainGenerator.getHeightAt(road.start.x, road.start.z);
        const endY = terrainGenerator.getHeightAt(road.end.x, road.end.z);

        townInternalRoads.push({
          id: `${town.id}_internal_${i}`,
          path: [
            { x: road.start.x, y: startY + 0.1, z: road.start.z },
            { x: road.end.x, y: endY + 0.1, z: road.end.z },
          ],
          width: road.isMain ? 8 : 6, // Main streets are wider
          connectedTowns: [town.id, town.id], // Internal to same town
          isMainRoad: road.isMain,
        });
      }

      // Also add paths to buildings as narrow walkways
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
          width: path.width || 3, // Narrower paths
          connectedTowns: [town.id, town.id],
          isMainRoad: false,
        });
      }
    }

    // Combine inter-town and town internal roads
    const roads = [...interTownRoads, ...townInternalRoads];
    console.log(
      `[WorldTab] Generated ${interTownRoads.length} inter-town roads + ${townInternalRoads.length} town internal roads/paths = ${roads.length} total`,
    );

    // Update town entry points with connected road IDs (only inter-town roads)
    for (const road of interTownRoads) {
      const [townId1, townId2] = road.connectedTowns;
      const town1 = towns.find((t) => t.id === townId1);
      const town2 = towns.find((t) => t.id === townId2);

      if (town1 && town1.entryPoints.length > 0) {
        // Find the entry point closest to the road start
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
        // Find the entry point closest to the road end
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

    // Assign tiles to biomes based on dominant influence
    // Sample at tile centers to determine which biome owns each tile
    const tileSize = config.terrain.tileSize;
    for (let tx = 0; tx < config.terrain.worldSize; tx++) {
      for (let tz = 0; tz < config.terrain.worldSize; tz++) {
        // Calculate tile center in world coordinates
        const tileCenterX = (tx + 0.5) * tileSize;
        const tileCenterZ = (tz + 0.5) * tileSize;
        const tileKey = `${tx},${tz}`;

        // Query terrain to get dominant biome at this location
        const query = terrainGenerator.queryPoint(tileCenterX, tileCenterZ);

        // Find the biome that matches this type
        const matchingBiome = biomes.find((b) => b.type === query.biome);
        if (matchingBiome) {
          matchingBiome.tileKeys.push(tileKey);
        }
      }
    }

    // Create foundation with real data
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

    // Create world using utility
    const world = createNewWorld(
      foundation,
      generateWorldName(config.seed),
      `Generated world with seed ${config.seed}`,
    );

    // Apply and switch to editing
    actions.applyAndLock(world);
    onWorldCreated?.(world);
  }, [state.creation.config, actions, onWorldCreated]);

  // Handle save
  const handleSave = useCallback(async () => {
    const world = state.editing.world;
    if (!world || !onWorldSave) return;

    actions.setSaveError(null);

    await onWorldSave(world)
      .then(() => {
        actions.markSaved();
      })
      .catch((error: Error) => {
        actions.setSaveError(error.message || "Failed to save world");
      });
  }, [state.editing.world, onWorldSave, actions]);

  // Handle export (WorldBuilder format)
  const handleExport = useCallback(() => {
    const world = state.editing.world;
    if (!world) return;
    onWorldExport?.(world);
  }, [state.editing.world, onWorldExport]);

  // Handle export to game manifest format (buildings.json + world-config.json)
  const handleExportToGame = useCallback(() => {
    const world = state.editing.world;
    if (!world) return;
    downloadGameManifests(world);
  }, [state.editing.world]);

  // Handle export all manifests (npcs, mobs, bosses, quests, zones, etc.)
  const handleExportAllManifests = useCallback(() => {
    const world = state.editing.world;
    if (!world) return;
    downloadAllGameManifests(world);
  }, [state.editing.world]);

  // Handle save to IndexedDB
  const handleSaveToIndexedDB = useCallback(async () => {
    const world = state.editing.world;
    if (!world) return;

    try {
      await saveWorldToIndexedDB(world);
      actions.markSaved();
    } catch (err) {
      actions.setSaveError(
        err instanceof Error ? err.message : "Failed to save to local storage",
      );
    }
  }, [state.editing.world, actions]);

  // State for saved worlds dialog
  const [savedWorldsDialogOpen, setSavedWorldsDialogOpen] = useState(false);
  const [savedWorldsList, setSavedWorldsList] = useState<
    Array<{ id: string; name: string; modifiedAt: number }>
  >([]);
  const [isLoadingWorld, setIsLoadingWorld] = useState(false);

  // Handle show saved worlds dialog
  const handleShowSavedWorldsDialog = useCallback(async () => {
    try {
      const worlds = await listWorldsInIndexedDB();
      setSavedWorldsList(worlds);
      setSavedWorldsDialogOpen(true);
    } catch (err) {
      actions.setSaveError(
        err instanceof Error ? err.message : "Failed to access local storage",
      );
    }
  }, [actions]);

  // Handle load from IndexedDB
  const handleLoadWorld = useCallback(
    async (worldId: string) => {
      setIsLoadingWorld(true);

      try {
        const loadedWorld = await loadWorldFromIndexedDB(worldId);

        if (loadedWorld) {
          actions.loadWorld(loadedWorld);
          setSavedWorldsDialogOpen(false);
        } else {
          actions.setSaveError("World not found in local storage");
        }
      } catch (err) {
        actions.setSaveError(
          err instanceof Error
            ? err.message
            : "Failed to load from local storage",
        );
      } finally {
        setIsLoadingWorld(false);
      }
    },
    [actions],
  );

  // Handle delete from IndexedDB
  const handleDeleteWorld = useCallback(
    async (worldId: string) => {
      try {
        await deleteWorldFromIndexedDB(worldId);
        const worlds = await listWorldsInIndexedDB();
        setSavedWorldsList(worlds);
      } catch (err) {
        actions.setSaveError(
          err instanceof Error
            ? err.message
            : "Failed to delete from local storage",
        );
      }
    },
    [actions],
  );

  // Handle import
  const handleImport = useCallback(
    async (file: File) => {
      actions.setSaveError(null);

      const worldData = await importWorldFromFile(file).catch(
        (error: Error) => {
          actions.setSaveError(`Import failed: ${error.message}`);
          return null;
        },
      );

      if (worldData) {
        actions.loadWorld(worldData);
        onWorldImport?.(worldData);
      }
    },
    [actions, onWorldImport],
  );

  // Render based on mode
  if (computed.isCreationMode) {
    const config = state.creation.config;

    return (
      <div className="flex h-full">
        {/* Left panel - Creation controls */}
        <div className="w-96 flex-shrink-0 border-r border-border-primary overflow-hidden">
          <CreationPanel
            onGeneratePreview={handleGeneratePreview}
            onApplyAndLock={handleApplyAndLock}
            showVegetation={showVegetation}
            onToggleVegetation={setShowVegetation}
            flyModeEnabled={flyModeEnabled}
            onToggleFlyMode={setFlyModeEnabled}
          />
        </div>

        {/* Right panel - Tile-based Terrain Viewer */}
        <div className="flex-1 flex flex-col">
          <ModeBanner />
          <div className="flex-1">
            <TileBasedTerrain
              config={config}
              showVegetation={showVegetation}
              flyModeEnabled={flyModeEnabled}
              onFlyModeChange={setFlyModeEnabled}
              onTileCountChange={(loaded, total) => {
                // Update preview stats when tiles change
                if (loaded > 0 && !state.creation.isGenerating) {
                  // Trigger generation complete callback once tiles start loading
                  handleGenerationComplete({
                    generationTime: 0,
                    tileCount: total,
                    biomeCount: 0, // Calculated during Apply & Lock
                    townCount: 0, // Calculated during Apply & Lock
                    roadCount: 0, // Calculated during Apply & Lock
                  });
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Editing mode - use the EditorLayout
  return (
    <div className="flex flex-col h-full">
      <ModeBanner />
      <div className="flex-1">
        {/* Saved Worlds Dialog */}
        <SavedWorldsDialog
          isOpen={savedWorldsDialogOpen}
          onClose={() => setSavedWorldsDialogOpen(false)}
          worlds={savedWorldsList}
          onLoad={handleLoadWorld}
          onDelete={handleDeleteWorld}
          isLoading={isLoadingWorld}
        />

        <EditorLayout
          flyModeEnabled={flyModeEnabled}
          onFlyModeToggle={setFlyModeEnabled}
          viewport={
            state.editing.world ? (
              <TileBasedTerrain
                config={state.editing.world.foundation.config}
                roads={state.editing.world.foundation.roads}
                selectedId={state.editing.selection?.id}
                flyModeEnabled={flyModeEnabled}
                onFlyModeChange={setFlyModeEnabled}
                onSelect={(viewportSelection) => {
                  if (!viewportSelection) {
                    actions.setSelection(null);
                    return;
                  }
                  // Convert ViewportSelection to Selection
                  const selection: Selection = {
                    type: viewportSelection.type as Selection["type"],
                    id: viewportSelection.id,
                    path: [],
                    tileData: viewportSelection.tileData,
                  };
                  // Build path based on selection type
                  if (
                    viewportSelection.type === "building" &&
                    viewportSelection.townId
                  ) {
                    selection.path = [
                      {
                        type: "town",
                        id: viewportSelection.townId,
                        name:
                          viewportSelection.townName ||
                          viewportSelection.townId,
                      },
                    ];
                  }
                  actions.setSelection(selection);
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-text-muted">
                  No world loaded. Create a new world or import an existing one.
                </p>
              </div>
            )
          }
          onSave={onWorldSave ? handleSave : undefined}
          onExport={onWorldExport ? handleExport : undefined}
          onExportToGame={state.editing.world ? handleExportToGame : undefined}
          onExportAllManifests={
            state.editing.world ? handleExportAllManifests : undefined
          }
          onSaveToIndexedDB={
            state.editing.world ? handleSaveToIndexedDB : undefined
          }
          onImport={handleImport}
          onImportFromIndexedDB={handleShowSavedWorldsDialog}
        />
      </div>
    </div>
  );
};

// ============== MAIN COMPONENT ==============

interface WorldTabProps extends WorldTabContentProps {}

export const WorldTab: React.FC<WorldTabProps> = (props) => {
  return (
    <WorldBuilderProvider>
      <WorldTabContent {...props} />
    </WorldBuilderProvider>
  );
};

export default WorldTab;
