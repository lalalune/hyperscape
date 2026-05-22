/**
 * GameWorldAssets — Loads the ACTUAL game assets for World Studio viewport
 *
 * Uses the real GLB tree models from the game (served at /game-models/trees/),
 * NOT procgen placeholder trees. Model paths and scales come from the
 * woodcutting manifest (gathering/woodcutting.json).
 *
 * Also creates bridge and duel arena geometry at game positions.
 */

import * as THREE from "three/webgpu";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { texture, normalMap } from "three/tsl";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createBridgeWoodMaterial,
  createBridgeStoneMaterial,
  createArenaFenceMaterial,
  createArenaFloorMaterial,
} from "./ProceduralMaterials";
import {
  createProceduralBridge,
  ISLAND_BRIDGES,
  type BridgeDef,
} from "./ProceduralBridge";
import { createProceduralArena } from "./ProceduralArena";

import { getTreeConfigForBiome, BIOME_LIST } from "@hyperforge/shared/world";

// ============== TYPES ==============

/** Manifest tree entry from gathering/woodcutting.json */
interface ManifestTreeDef {
  id: string;
  name: string;
  modelPath: string | null;
  modelVariants?: string[];
  scale: number;
}

/**
 * Per-species instancing data extracted from a loaded GLB model.
 * Contains all mesh parts found in the GLB scene for InstancedMesh creation.
 */
export interface TreeSpeciesInstance {
  parts: Array<{
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
  }>;
  /** Manifest scale applied to instances (very small, e.g. 0.008-0.018) */
  manifestScale: number;
}

// ============== GLB TREE LOADING ==============

const gltfLoader = new GLTFLoader();
const speciesCache = new Map<string, TreeSpeciesInstance | null>();
/** Manifest data indexed by tree ID */
const manifestData = new Map<string, ManifestTreeDef>();
let _initPromise: Promise<void> | null = null;
let _initialized = false;

/**
 * Resolve an asset:// URL to a fetchable URL via the HyperForge proxy.
 * asset://models/trees/oak_01.glb → /game-models/trees/oak_01.glb
 *
 * The HyperForge Vite proxy routes /game-models/* to the backend which serves
 * from packages/server/world/assets/models/
 */
function resolveAssetUrl(assetPath: string): string {
  if (assetPath.startsWith("asset://models/")) {
    return assetPath.replace("asset://models/", "/game-models/");
  }
  if (assetPath.startsWith("asset://")) {
    return assetPath.replace("asset://", "/game-models/");
  }
  return assetPath;
}

/**
 * Convert a GLTFLoader MeshStandardMaterial to a WebGPU-compatible
 * MeshStandardNodeMaterial, copying PBR properties and texture maps.
 */
function convertToNodeMaterial(src: THREE.Material): MeshStandardNodeMaterial {
  const dst = new MeshStandardNodeMaterial();

  if (src instanceof THREE.MeshStandardMaterial) {
    dst.color.copy(src.color);
    dst.roughness = src.roughness;
    dst.metalness = src.metalness;
    dst.emissive.copy(src.emissive);
    dst.emissiveIntensity = src.emissiveIntensity;
    dst.side = src.side;
    dst.transparent = src.transparent;
    dst.opacity = src.opacity;
    dst.alphaTest = src.alphaTest;
    dst.depthWrite = src.depthWrite;

    // Assign textures via TSL nodes for proper WebGPU pipeline integration
    if (src.map) {
      src.map.colorSpace = THREE.SRGBColorSpace;
      dst.colorNode = texture(src.map);
    }
    if (src.normalMap) dst.normalNode = normalMap(texture(src.normalMap));
    if (src.roughnessMap) dst.roughnessNode = texture(src.roughnessMap);
    if (src.metalnessMap) dst.metalnessNode = texture(src.metalnessMap);
    if (src.aoMap) dst.aoNode = texture(src.aoMap);
    if (src.emissiveMap) dst.emissiveNode = texture(src.emissiveMap);
    if (src.alphaMap) dst.alphaMap = src.alphaMap;
  }

  return dst;
}

/**
 * Load a single GLB model and extract all mesh geometry + materials.
 * Materials are converted to MeshStandardNodeMaterial for WebGPU compatibility.
 */
async function loadGLBMeshParts(
  url: string,
): Promise<
  Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>
> {
  const gltf = await gltfLoader.loadAsync(url);
  const parts: Array<{
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
  }> = [];

  // Ensure world matrices are computed before extracting geometry
  gltf.scene.updateMatrixWorld(true);

  gltf.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geom = child.geometry.clone();
    // Bake the mesh's local transform into the geometry so instancing just needs position/rotation/scale
    geom.applyMatrix4(child.matrixWorld);

    const rawMat = child.material;
    const src: THREE.Material = Array.isArray(rawMat) ? rawMat[0] : rawMat;
    const mat = convertToNodeMaterial(src);
    parts.push({ geometry: geom, material: mat });
  });

  return parts;
}

/**
 * Initialize tree models by fetching the woodcutting manifest and preloading
 * one GLB variant per species. Call once before accessing getTreeSpeciesInstance().
 */
export async function initTreeModels(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // 1. Fetch woodcutting manifest
    let treeDefs: ManifestTreeDef[] = [];
    try {
      const res = await fetch("/api/manifests/gathering/woodcutting");
      if (res.ok) {
        const json = await res.json();
        const content = json.content ?? json;
        treeDefs = (content.trees ?? content) as ManifestTreeDef[];
      }
    } catch (err) {
      console.warn(
        "[GameWorldAssets] Failed to fetch woodcutting manifest:",
        err,
      );
    }

    // Index manifest data
    for (const def of treeDefs) {
      manifestData.set(def.id, def);
    }

    // 2. Load GLB for each species (first variant only, LOD0)
    const loadPromises: Array<Promise<void>> = [];

    for (const def of treeDefs) {
      const modelPath = def.modelVariants?.[0] ?? def.modelPath;
      if (!modelPath) continue;

      const url = resolveAssetUrl(modelPath);
      const promise = loadGLBMeshParts(url)
        .then((parts) => {
          if (parts.length === 0) {
            speciesCache.set(def.id, null);
            return;
          }
          speciesCache.set(def.id, { parts, manifestScale: def.scale });
          console.log(
            `[GameWorldAssets] Loaded ${def.id} (${parts.length} meshes, scale ${def.scale})`,
          );
        })
        .catch((err) => {
          console.warn(
            `[GameWorldAssets] Failed to load ${def.id} from ${url}:`,
            err,
          );
          speciesCache.set(def.id, null);
        });

      loadPromises.push(promise);
    }

    await Promise.all(loadPromises);
    _initialized = true;
    console.log(
      `[GameWorldAssets] Loaded ${speciesCache.size} tree species from GLB models`,
    );
  })();

  return _initPromise;
}

/** Whether tree models have finished loading */
export function isTreeModelsReady(): boolean {
  return _initialized;
}

/**
 * Get instancing data for a tree species (geometry + material from loaded GLB).
 * Returns null if the species was not found or failed to load.
 * Must call initTreeModels() first.
 */
export function getTreeSpeciesInstance(
  gameTreeId: string,
): TreeSpeciesInstance | null {
  return speciesCache.get(gameTreeId) ?? null;
}

/**
 * Get all unique tree species IDs used across all biomes.
 * Reads from the game's authoritative BiomeTreeConfig via getTreeConfigForBiome().
 */
export function getAllTreeSpeciesIds(): string[] {
  const ids = new Set<string>();
  for (const biome of BIOME_LIST) {
    const config = getTreeConfigForBiome(biome);
    for (const treeId of Object.keys(config.trees)) {
      ids.add(treeId);
    }
  }
  return [...ids];
}

/**
 * Pick a random tree species for a biome based on weighted probabilities.
 * Reads from the game's authoritative BiomeTreeConfig via getTreeConfigForBiome().
 */
export function pickTreeSpecies(biome: string, random: () => number): string {
  const config = getTreeConfigForBiome(biome);
  const trees = config.trees as Record<string, { weight: number }>;
  const entries = Object.entries(trees);
  if (entries.length === 0) return "tree_general";
  const totalWeight = entries.reduce((sum, [, cfg]) => sum + cfg.weight, 0);
  let r = random() * totalWeight;
  for (const [treeId, cfg] of entries) {
    r -= cfg.weight;
    if (r <= 0) return treeId;
  }
  return entries[0][0];
}

/**
 * Get tree density (trees per tile) for a biome.
 * Reads from the game's authoritative BiomeTreeConfig via getTreeConfigForBiome().
 */
export function getTreeDensity(biome: string): number {
  return getTreeConfigForBiome(biome).density;
}

/**
 * Clear all cached tree species data (call on cleanup).
 */
export function clearTreeSpeciesCache(): void {
  speciesCache.forEach((data) => {
    if (!data) return;
    for (const part of data.parts) {
      part.geometry.dispose();
      part.material.dispose();
    }
  });
  speciesCache.clear();
  manifestData.clear();
  _initialized = false;
  _initPromise = null;
}

// ============== ENTITY MODEL LOADING (Stations, Ores, NPCs) ==============

/**
 * Cached model data for non-instanced entities (stations, ores, NPCs).
 * Same structure as TreeSpeciesInstance — extracted mesh parts from GLB.
 */
export interface EntityModelData {
  parts: Array<{
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
  }>;
  scale: number;
  yOffset: number;
}

const stationModelCache = new Map<string, EntityModelData | null>();
const oreModelCache = new Map<string, EntityModelData | null>();
const npcModelCache = new Map<string, EntityModelData | null>();

let _stationInitPromise: Promise<void> | null = null;
let _oreInitPromise: Promise<void> | null = null;
let _npcInitPromise: Promise<void> | null = null;

/**
 * Load station GLB models from the stations manifest.
 * Keyed by station type (e.g., "anvil", "furnace").
 */
export async function initStationModels(): Promise<void> {
  if (stationModelCache.size > 0) return;
  if (_stationInitPromise) return _stationInitPromise;

  _stationInitPromise = (async () => {
    let stations: Array<{
      type: string;
      model: string;
      modelScale?: number;
      modelYOffset?: number;
    }> = [];
    try {
      const res = await fetch("/api/manifests/stations");
      if (res.ok) {
        const json = await res.json();
        const content = json.content ?? json;
        stations = (content.stations ?? content) as typeof stations;
      }
    } catch (err) {
      console.warn("[GameWorldAssets] Failed to fetch stations manifest:", err);
      return;
    }

    const promises = stations.map(async (station) => {
      if (!station.model) {
        stationModelCache.set(station.type, null);
        return;
      }
      const url = resolveAssetUrl(station.model);
      try {
        const parts = await loadGLBMeshParts(url);
        if (parts.length === 0) {
          stationModelCache.set(station.type, null);
          return;
        }
        stationModelCache.set(station.type, {
          parts,
          scale: station.modelScale ?? 1.0,
          yOffset: station.modelYOffset ?? 0,
        });
        console.log(
          `[GameWorldAssets] Loaded station: ${station.type} (${parts.length} meshes)`,
        );
      } catch (err) {
        console.warn(
          `[GameWorldAssets] Failed to load station ${station.type} from ${url}:`,
          err,
        );
        stationModelCache.set(station.type, null);
      }
    });

    await Promise.all(promises);
    console.log(
      `[GameWorldAssets] Loaded ${[...stationModelCache.values()].filter(Boolean).length}/${stations.length} station models`,
    );
  })();

  return _stationInitPromise;
}

/**
 * Load ore/mining rock GLB models from the mining manifest.
 * Keyed by ore ID (e.g., "ore_copper", "ore_iron").
 */
export async function initOreModels(): Promise<void> {
  if (oreModelCache.size > 0) return;
  if (_oreInitPromise) return _oreInitPromise;

  _oreInitPromise = (async () => {
    let rocks: Array<{ id: string; modelPath?: string; scale?: number }> = [];
    try {
      const res = await fetch("/api/manifests/gathering/mining");
      if (res.ok) {
        const json = await res.json();
        const content = json.content ?? json;
        rocks = (content.rocks ?? content) as typeof rocks;
      }
    } catch (err) {
      console.warn("[GameWorldAssets] Failed to fetch mining manifest:", err);
      return;
    }

    const promises = rocks.map(async (rock) => {
      if (!rock.modelPath) {
        oreModelCache.set(rock.id, null);
        return;
      }
      const url = resolveAssetUrl(rock.modelPath);
      try {
        const parts = await loadGLBMeshParts(url);
        if (parts.length === 0) {
          oreModelCache.set(rock.id, null);
          return;
        }
        oreModelCache.set(rock.id, {
          parts,
          scale: rock.scale ?? 1.0,
          yOffset: 0,
        });
        console.log(
          `[GameWorldAssets] Loaded ore: ${rock.id} (${parts.length} meshes)`,
        );
      } catch (err) {
        console.warn(
          `[GameWorldAssets] Failed to load ore ${rock.id} from ${url}:`,
          err,
        );
        oreModelCache.set(rock.id, null);
      }
    });

    await Promise.all(promises);
    console.log(
      `[GameWorldAssets] Loaded ${[...oreModelCache.values()].filter(Boolean).length}/${rocks.length} ore models`,
    );
  })();

  return _oreInitPromise;
}

/**
 * Load NPC GLB/VRM models from the NPC manifest.
 * Keyed by NPC ID (e.g., "bank_clerk", "shopkeeper").
 */
export async function initNpcModels(): Promise<void> {
  if (npcModelCache.size > 0) return;
  if (_npcInitPromise) return _npcInitPromise;

  _npcInitPromise = (async () => {
    let npcs: Array<{
      id: string;
      appearance?: { modelPath?: string; scale?: number };
    }> = [];
    try {
      const res = await fetch("/api/manifests/npcs");
      if (res.ok) {
        const json = await res.json();
        npcs = (json.content ?? json) as typeof npcs;
      }
    } catch (err) {
      console.warn("[GameWorldAssets] Failed to fetch NPC manifest:", err);
      return;
    }

    const promises = npcs.map(async (npc) => {
      const modelPath = npc.appearance?.modelPath;
      if (!modelPath) {
        npcModelCache.set(npc.id, null);
        return;
      }
      const url = resolveAssetUrl(modelPath);
      try {
        const parts = await loadGLBMeshParts(url);
        if (parts.length === 0) {
          npcModelCache.set(npc.id, null);
          return;
        }

        // Match the game's VRM height normalization (createVRMFactory.ts):
        // VRM models are normalized to 1.6m, then manifest scale is applied.
        // Compute bounding box of all parts to find the raw export height.
        const bbox = new THREE.Box3();
        for (const part of parts) {
          part.geometry.computeBoundingBox();
          if (part.geometry.boundingBox) {
            bbox.union(part.geometry.boundingBox);
          }
        }
        const rawHeight = Math.max(0.5, bbox.max.y - bbox.min.y);
        const TARGET_HEIGHT = 1.6; // Standard human height in game
        const manifestScale = npc.appearance?.scale ?? 1.0;
        const normalizedScale = (TARGET_HEIGHT / rawHeight) * manifestScale;

        npcModelCache.set(npc.id, {
          parts,
          scale: normalizedScale,
          yOffset: 0,
        });
        console.log(
          `[GameWorldAssets] Loaded NPC: ${npc.id} (${parts.length} meshes, ` +
            `raw ${rawHeight.toFixed(1)}m → ${(TARGET_HEIGHT * manifestScale).toFixed(1)}m)`,
        );
      } catch (err) {
        console.warn(
          `[GameWorldAssets] Failed to load NPC ${npc.id} from ${url}:`,
          err,
        );
        npcModelCache.set(npc.id, null);
      }
    });

    await Promise.all(promises);
    console.log(
      `[GameWorldAssets] Loaded ${[...npcModelCache.values()].filter(Boolean).length}/${npcs.length} NPC models`,
    );
  })();

  return _npcInitPromise;
}

/** Get a loaded station model by type. Returns null if not loaded or missing. */
export function getStationModel(type: string): EntityModelData | null {
  return stationModelCache.get(type) ?? null;
}

/** Get a loaded ore model by ID. Returns null if not loaded or missing. */
export function getOreModel(oreId: string): EntityModelData | null {
  return oreModelCache.get(oreId) ?? null;
}

/** Get a loaded NPC model by ID. Returns null if not loaded or missing. */
export function getNpcModel(npcId: string): EntityModelData | null {
  return npcModelCache.get(npcId) ?? null;
}

/**
 * Initialize all game entity models (stations, ores, NPCs) in parallel.
 * Call before creating entity markers for real model rendering.
 */
export async function initEntityModels(): Promise<void> {
  await Promise.all([initStationModels(), initOreModels(), initNpcModels()]);
}

/**
 * Clear all entity model caches (call on cleanup).
 */
export function clearEntityModelCache(): void {
  for (const cache of [stationModelCache, oreModelCache, npcModelCache]) {
    cache.forEach((data) => {
      if (!data) return;
      for (const part of data.parts) {
        part.geometry.dispose();
        part.material.dispose();
      }
    });
    cache.clear();
  }
  _stationInitPromise = null;
  _oreInitPromise = null;
  _npcInitPromise = null;
}

// ============== BRIDGES ==============

/**
 * Create bridge meshes with procedural TSL materials and proper arched geometry.
 */
export function createBridgeMeshes(
  worldCenterOffset: number,
  getHeight: (worldX: number, worldZ: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "bridges";

  const woodMat = createBridgeWoodMaterial();
  const stoneMat = createBridgeStoneMaterial();

  for (const bridge of ISLAND_BRIDGES) {
    const startY = getHeight(bridge.startX, bridge.startZ);
    const endY = getHeight(bridge.endX, bridge.endZ);
    const waterY = Math.min(startY, endY) - 2;

    // Offset bridge positions to render-space (terrain-gen coords → world coords)
    const offsetBridge: BridgeDef = {
      ...bridge,
      startX: bridge.startX + worldCenterOffset,
      startZ: bridge.startZ + worldCenterOffset,
      endX: bridge.endX + worldCenterOffset,
      endZ: bridge.endZ + worldCenterOffset,
    };

    const bridgeGroup = createProceduralBridge(
      offsetBridge,
      startY,
      endY,
      waterY,
      woodMat,
      stoneMat,
    );
    if (bridgeGroup) {
      group.add(bridgeGroup);
    }
  }

  console.log(
    `[GameWorldAssets] Created ${ISLAND_BRIDGES.length} procedural bridges`,
  );
  return group;
}

// Re-export for external use
export type { BridgeDef };

// ============== DUEL ARENA ==============

const ARENA_BASE_X = 60;
const ARENA_BASE_Z = 80;

/**
 * Create the duel arena complex with procedural TSL materials.
 */
export function createDuelArena(
  worldCenterOffset: number,
  getHeight: (worldX: number, worldZ: number) => number,
): THREE.Group {
  const baseH = getHeight(ARENA_BASE_X, ARENA_BASE_Z);
  const fenceMat = createArenaFenceMaterial();
  const floorMat = createArenaFloorMaterial();

  const group = createProceduralArena(
    worldCenterOffset,
    baseH,
    fenceMat,
    floorMat,
  );
  console.log(
    "[GameWorldAssets] Created procedural duel arena complex (6 arenas + lobby)",
  );
  return group;
}

// ============== DISPOSE ==============

/**
 * Dispose all assets in a group (geometry + materials).
 */
export function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    if ((child as THREE.Mesh).material) {
      const mat = (child as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}
