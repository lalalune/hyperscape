/**
 * ProcgenPlantCache - Cached Procedural Plant Variants with LOD Support
 *
 * Pre-generates and caches a limited number of plant mesh variants per preset.
 * This provides visual variety while maintaining performance through shared geometry.
 *
 * LOD Strategy:
 * - LOD0 (0-30m): Full detail plant with textures
 * - LOD1 (30-60m): Medium detail (fewer leaves, simpler geometry)
 * - LOD2 (60-100m): Cross-billboard cards
 * - Impostor (100m+): Octahedral billboard from ImpostorManager
 *
 * Design:
 * - 2 variants per preset (plants are smaller so need less variety)
 * - Variants are generated with different seeds for unique shapes
 * - LOD1/LOD2 use PlantGenerator's built-in LOD support
 * - Clones are returned to callers (shared geometry, individual transforms)
 */

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { ProcgenPlantInstancer } from "./ProcgenPlantInstancer";
import { applySkyFog } from "./FogConfig";
import type { World } from "../../../core/World";

/** Number of variants to cache per plant preset */
const VARIANTS_PER_PRESET = 2;

/** World reference for instancer registration */
let worldRef: World | null = null;

/**
 * Set the world reference for instancer registration.
 * Call this during game initialization.
 */
export function setProcgenPlantWorld(world: World): void {
  worldRef = world;
}

/** Base seeds for variant generation */
const VARIANT_SEEDS = [11111, 22222];

/**
 * LOD Configuration for Plants
 *
 * Performance budget per plant at each LOD:
 * - LOD0 (0-30m):    ~500-1500 tris, full detail
 * - LOD1 (30-60m):   ~100-300 tris, simplified
 * - LOD2 (60-100m):  ~8-12 tris, billboard cards
 * - Impostor (100m+): 2 tris, octahedral billboard
 */

/**
 * LOD2 card options
 */
const LOD2_CARD_OPTIONS = {
  numCrossCards: 2,
  cardSizeMultiplier: 0.85,
};

/**
 * Cached plant variant data.
 */
interface PlantVariant {
  group: THREE.Group;
  lod1Group: THREE.Group | null;
  lod2Group: THREE.Group | null;
  vertexCount: number;
  triangleCount: number;
  dimensions: { width: number; height: number; depth: number };
  leafColor: THREE.Color;
}

/**
 * Cache entry for a preset's variants.
 */
interface PresetCache {
  /** Array of generated variants */
  variants: PlantVariant[];
  /** Whether generation is in progress */
  loading: boolean;
  /** Promise for waiting on generation */
  loadPromise: Promise<void> | null;
}

/**
 * Global cache of plant variants per preset.
 */
const presetCache = new Map<string, PresetCache>();

/**
 * PlantGenerator import (lazy loaded).
 */
let PlantGenerator:
  | typeof import("@hyperforge/procgen/plant").PlantGenerator
  | null = null;
let RenderQualityEnum:
  | typeof import("@hyperforge/procgen/plant").RenderQualityEnum
  | null = null;
let procgenLoaded = false;
let procgenLoadPromise: Promise<void> | null = null;
let procgenLoadFailed = false;

/**
 * Lazy load the procgen plant module.
 */
async function loadProcgen(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (procgenLoaded) return true;
  if (procgenLoadFailed) return false;
  if (procgenLoadPromise) {
    await procgenLoadPromise;
    return procgenLoaded;
  }

  console.log("[ProcgenPlantCache] Loading @hyperforge/procgen/plant...");

  procgenLoadPromise = import("@hyperforge/procgen/plant")
    .then((procgen) => {
      PlantGenerator = procgen.PlantGenerator;
      RenderQualityEnum = procgen.RenderQualityEnum;
      procgenLoaded = true;
      console.log(
        "[ProcgenPlantCache] Successfully loaded @hyperforge/procgen/plant",
      );
    })
    .catch((err) => {
      procgenLoadFailed = true;
      console.error(
        "[ProcgenPlantCache] Failed to load @hyperforge/procgen/plant:",
        err,
      );
    });

  await procgenLoadPromise;
  return procgenLoaded;
}

/**
 * Count vertices and triangles in a group.
 */
function countGeometry(group: THREE.Group): {
  vertexCount: number;
  triangleCount: number;
} {
  let vertexCount = 0;
  let triangleCount = 0;

  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geo = child.geometry;
      if (geo.attributes.position) {
        vertexCount += geo.attributes.position.count;
      }
      if (geo.index) {
        triangleCount += geo.index.count / 3;
      } else if (geo.attributes.position) {
        triangleCount += geo.attributes.position.count / 3;
      }
    }
  });

  return { vertexCount, triangleCount };
}

/**
 * Extract metadata from a generated plant.
 */
function extractPlantMetadata(group: THREE.Group): {
  leafColor: THREE.Color;
  dimensions: { width: number; height: number; depth: number };
} {
  let leafColor = new THREE.Color(0x3d7a3d); // Default green

  // Extract color from leaf materials
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (child.name.toLowerCase().includes("leaf") && mat.color) {
        leafColor = mat.color.clone();
      }
    }
  });

  // Calculate dimensions from bounding box
  const bbox = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  return {
    leafColor,
    dimensions: {
      width: size.x,
      height: size.y,
      depth: size.z,
    },
  };
}

/**
 * Generate LOD2 "card plant" using cross-billboard technique.
 */
function generateLOD2CardPlant(
  dimensions: { width: number; height: number; depth: number },
  leafColor: THREE.Color,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "LOD2_CardPlant";

  const { width, height, depth } = dimensions;
  const avgSize = (width + depth) / 2;
  const cardWidth = avgSize * LOD2_CARD_OPTIONS.cardSizeMultiplier;
  const cardHeight = height * LOD2_CARD_OPTIONS.cardSizeMultiplier;
  const cardGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);

  // Use MeshBasicNodeMaterial for WebGPU compatibility
  const cardMaterial = new MeshBasicNodeMaterial();
  cardMaterial.color = new THREE.Color(leafColor);
  cardMaterial.side = THREE.DoubleSide;
  cardMaterial.transparent = true;
  cardMaterial.alphaTest = 0.1;
  applySkyFog(cardMaterial);

  const centerY = height * 0.5;

  // Two perpendicular cards for cross-billboard
  const card1 = new THREE.Mesh(cardGeometry, cardMaterial);
  card1.position.set(0, centerY, 0);
  group.add(card1);

  const card2 = new THREE.Mesh(cardGeometry, cardMaterial);
  card2.position.set(0, centerY, 0);
  card2.rotation.y = Math.PI / 2;
  group.add(card2);

  return group;
}

/**
 * Generate plant variants for a preset.
 */
async function generateVariants(presetName: string): Promise<PlantVariant[]> {
  const loaded = await loadProcgen();

  if (!loaded || !PlantGenerator || !RenderQualityEnum) {
    console.warn(
      `[ProcgenPlantCache] Cannot generate "${presetName}" - procgen module not loaded`,
    );
    return [];
  }

  const variants: PlantVariant[] = [];
  let totalVerts = 0;
  let totalTris = 0;

  for (let i = 0; i < VARIANTS_PER_PRESET; i++) {
    const seed = VARIANT_SEEDS[i];

    // Yield between variants
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    // Generate LOD0 (full detail)
    const generator = new PlantGenerator({
      seed,
      quality: RenderQualityEnum.Maximum,
      generateTextures: true,
      textureSize: 512,
    });

    // Load preset and generate
    generator.loadPreset(
      presetName as Parameters<typeof generator.loadPreset>[0],
    );
    const result = generator.generate();

    // Count geometry
    const lod0Stats = countGeometry(result.group);

    // Extract metadata
    const { leafColor, dimensions } = extractPlantMetadata(result.group);

    // Generate LOD1 (medium quality)
    const lod1Generator = new PlantGenerator({
      seed,
      quality: RenderQualityEnum.Medium,
      generateTextures: false,
    });
    lod1Generator.loadPreset(
      presetName as Parameters<typeof generator.loadPreset>[0],
    );
    const lod1Result = lod1Generator.generate();

    // Generate LOD2 card plant
    const lod2Group = generateLOD2CardPlant(dimensions, leafColor);

    variants.push({
      group: result.group,
      lod1Group: lod1Result.group,
      lod2Group,
      vertexCount: lod0Stats.vertexCount,
      triangleCount: lod0Stats.triangleCount,
      dimensions,
      leafColor,
    });

    totalVerts += lod0Stats.vertexCount;
    totalTris += lod0Stats.triangleCount;
  }

  if (variants.length > 0) {
    const avgVerts = Math.round(totalVerts / variants.length);
    const avgTris = Math.round(totalTris / variants.length);
    console.log(
      `[ProcgenPlantCache] Generated ${variants.length} variants for "${presetName}" ` +
        `(avg: ${avgVerts} verts, ${avgTris} tris)`,
    );
  }

  return variants;
}

/**
 * Ensure variants are loaded for a preset.
 */
export async function ensurePlantVariantsLoaded(
  presetName: string,
): Promise<void> {
  let cache = presetCache.get(presetName);

  if (cache?.variants.length) {
    return;
  }

  if (cache?.loading && cache.loadPromise) {
    await cache.loadPromise;
    return;
  }

  cache = {
    variants: [],
    loading: true,
    loadPromise: null,
  };
  presetCache.set(presetName, cache);

  const loadPromise = (async () => {
    const variants = await generateVariants(presetName);
    const existingCache = presetCache.get(presetName);
    if (existingCache) {
      existingCache.variants = variants;
      existingCache.loading = false;
    }
  })();

  cache.loadPromise = loadPromise;
  await loadPromise;
}

/**
 * Get a cached plant variant for a preset.
 */
export function getPlantVariant(
  presetName: string,
  variantIndex?: number,
): {
  group: THREE.Group;
  lod1Group: THREE.Group | null;
  lod2Group: THREE.Group | null;
  dimensions: { width: number; height: number; depth: number };
  leafColor: THREE.Color;
} | null {
  const cache = presetCache.get(presetName);

  if (!cache?.variants.length) {
    return null;
  }

  const idx =
    variantIndex !== undefined
      ? Math.abs(variantIndex) % cache.variants.length
      : Math.floor(Math.random() * cache.variants.length);

  const variant = cache.variants[idx];

  return {
    group: variant.group.clone(),
    lod1Group: variant.lod1Group?.clone() ?? null,
    lod2Group: variant.lod2Group?.clone() ?? null,
    dimensions: { ...variant.dimensions },
    leafColor: variant.leafColor.clone(),
  };
}

/**
 * Get the number of cached variants for a preset.
 */
export function getPlantVariantCount(presetName: string): number {
  return presetCache.get(presetName)?.variants.length ?? 0;
}

/**
 * Check if a preset is loaded.
 */
export function isPlantPresetLoaded(presetName: string): boolean {
  const cache = presetCache.get(presetName);
  return !!cache?.variants.length && !cache.loading;
}

/**
 * Pre-warm the cache by loading variants for multiple presets.
 */
export async function preWarmPlantCache(presets: string[]): Promise<void> {
  console.log(
    `[ProcgenPlantCache] Pre-warming cache with ${presets.length} presets...`,
  );
  const startTime = performance.now();

  for (const preset of presets) {
    await ensurePlantVariantsLoaded(preset);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }

  const elapsed = Math.round(performance.now() - startTime);
  console.log(`[ProcgenPlantCache] Pre-warm complete in ${elapsed}ms`);
}

/**
 * Add a plant instance using the instancer system.
 */
export async function addPlantInstance(
  presetName: string,
  position: THREE.Vector3,
  rotation: number,
  scale: number,
  entityId?: string,
): Promise<string | null> {
  await ensurePlantVariantsLoaded(presetName);

  const instancer = ProcgenPlantInstancer.getInstance(worldRef);
  if (!instancer) {
    console.warn(
      "[ProcgenPlantCache] No world reference set, cannot create instancer",
    );
    return null;
  }

  const id =
    entityId ??
    `plant_${presetName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await instancer.addInstance(id, presetName, position, rotation, scale);

  return id;
}

/**
 * Remove a plant instance.
 * @returns true if instance was found and removed, false otherwise
 */
export function removePlantInstance(instanceId: string): boolean {
  const instancer = ProcgenPlantInstancer.getInstance(worldRef);
  if (!instancer) {
    return false;
  }
  return instancer.removeInstance(instanceId);
}

/**
 * Clear all cached plant variants.
 */
export function clearPlantCache(): void {
  for (const [, cache] of presetCache) {
    for (const variant of cache.variants) {
      variant.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      if (variant.lod1Group) {
        variant.lod1Group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }
      if (variant.lod2Group) {
        variant.lod2Group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }
    }
  }
  presetCache.clear();
  console.log("[ProcgenPlantCache] Cache cleared");
}

/**
 * Default plant presets per biome type.
 */
export const BIOME_PLANT_PRESETS: Record<string, string[]> = {
  tundra: ["bergenia", "pulmonaria"],
  forest: ["monstera", "philodendron", "calathea", "ficus", "hosta"],
  canyon: ["zamioculcas", "aglaonema", "syngonium"],
};

/**
 * Get default plant presets for a biome.
 */
export function getPlantPresetsForBiome(biomeType: string): string[] {
  return (
    BIOME_PLANT_PRESETS[biomeType.toLowerCase()] ?? [
      "monstera",
      "philodendron",
      "hosta",
    ]
  );
}

/**
 * All available plant presets.
 */
export const ALL_PLANT_PRESETS = [
  "gloriosum",
  "monstera",
  "pothos",
  "philodendron",
  "alocasia",
  "calathea",
  "anthurium",
  "aglaonema",
  "dieffenbachia",
  "spathiphyllum",
  "syngonium",
  "caladium",
  "colocasia",
  "xanthosoma",
  "arum",
  "calla",
  "zamioculcas",
  "maranta",
  "stromanthe",
  "ctenanthe",
  "ficus",
  "schefflera",
  "fatsia",
  "polyscias",
  "aralia",
  "hosta",
  "heuchera",
  "brunnera",
  "pulmonaria",
  "bergenia",
];
