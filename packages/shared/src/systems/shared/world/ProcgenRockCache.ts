/**
 * ProcgenRockCache - Cached Procedural Rock Variants with LOD Support
 *
 * Pre-generates and caches a limited number of rock mesh variants per preset.
 * This provides visual variety while maintaining performance through shared geometry.
 *
 * LOD Strategy:
 * - LOD0 (0-50m): Full detail rock with vertex colors
 * - LOD1 (50-100m): Simplified rock - fewer subdivisions
 * - LOD2 (100-150m): Very low poly cross-billboard
 * - Impostor (150m+): Octahedral billboard from ImpostorManager
 *
 * Design:
 * - 3 variants per preset (good balance of variety vs memory)
 * - Variants are generated with different seeds for unique shapes
 * - LOD1/LOD2 meshes use progressively simpler geometry
 * - Clones are returned to callers (shared geometry, individual transforms)
 *
 * Persistence:
 * - Generated variants are cached in IndexedDB for persistence across sessions
 * - On app load, checks IndexedDB first to avoid regeneration
 * - Cache is version-aware and invalidates on version change
 */

import * as THREE from "three";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import { ProcgenRockInstancer } from "./ProcgenRockInstancer";
import { applySkyFog } from "./FogConfig";
import type { World } from "../../../core/World";
import {
  procgenCacheDB,
  serializeGeometry,
  deserializeGeometry,
  serializeColor,
  deserializeColor,
  type SerializedRockVariant,
  type SerializedGeometry,
} from "../../../utils/rendering/ProcgenCacheDB";

// Note: TSL triplanar material imports removed - using simple vertex colors for now
// TODO: Re-add when implementing baked texture atlas

/** Number of variants to cache per rock preset */
const VARIANTS_PER_PRESET = 3;

/**
 * Cache version - increment this when the generation algorithm changes
 * to invalidate cached variants and force regeneration.
 *
 * Version history:
 * - v1: Initial rock generation
 * - v2: Added scraping algorithm for realistic flat faces, triplanar textures for LOD0
 * - v3: Fixed WebGPU lighting - use MeshStandardNodeMaterial instead of WebGL MeshStandardMaterial
 * - v4: LOD0 uses proper TSL triplanar material, LOD1 uses vertex colors only
 * - v5: LOD0 uses pure texture mode (no vertex color multiplication)
 * - v6: Reverted to simple vertex colors for LOD0 (triplanar was broken)
 */
const CACHE_VERSION = 6;

/** World reference for instancer registration */
let worldRef: World | null = null;

/**
 * Set the world reference for instancer registration.
 * Call this during game initialization.
 */
export function setProcgenRockWorld(world: World): void {
  worldRef = world;
}

/** Base seeds for variant generation (spread apart for visual diversity) */
const VARIANT_SEEDS = [54321, 98765, 13579];

/**
 * LOD Configuration for Rocks
 *
 * Performance budget per rock at each LOD:
 * - LOD0 (0-50m):    ~800-1500 tris, full detail for close inspection
 * - LOD1 (50-100m):  ~100-300 tris, simplified geometry
 * - LOD2 (100-150m): ~12 tris, billboard cards
 * - Impostor (150m+): 2 tris, octahedral billboard
 */

/**
 * LOD0 geometry options - full detail rock
 */
const LOD0_SUBDIVISIONS = 5;

/**
 * LOD1 geometry options - simplified rock
 */
const LOD1_SUBDIVISIONS = 2;

/**
 * LOD2 "card rock" - billboard cards for distant viewing
 */
const LOD2_CARD_OPTIONS = {
  numCrossCards: 2,
  cardSizeMultiplier: 0.9,
};

/**
 * Cached rock variant data.
 */
interface RockVariant {
  mesh: THREE.Mesh;
  lod1Mesh: THREE.Mesh | null;
  lod2Group: THREE.Group | null;
  vertexCount: number;
  triangleCount: number;
  dimensions: { width: number; height: number; depth: number };
  averageColor: THREE.Color;
}

/**
 * Cache entry for a preset's variants.
 */
interface PresetCache {
  /** Array of generated variants */
  variants: RockVariant[];
  /** Whether generation is in progress */
  loading: boolean;
  /** Promise for waiting on generation */
  loadPromise: Promise<void> | null;
}

/**
 * Global cache of rock variants per preset.
 */
const presetCache = new Map<string, PresetCache>();

/**
 * RockGenerator and material imports (lazy loaded to avoid circular deps).
 */
let RockGenerator:
  | typeof import("@hyperforge/procgen/rock").RockGenerator
  | null = null;
// These are loaded but reserved for future use:
let _getPreset: typeof import("@hyperforge/procgen/rock").getPreset | null =
  null;
let _mergeParams: typeof import("@hyperforge/procgen/rock").mergeParams | null =
  null;
let _DEFAULT_PARAMS:
  | typeof import("@hyperforge/procgen/rock").DEFAULT_PARAMS
  | null = null;
let _ColorMode: typeof import("@hyperforge/procgen/rock").ColorMode | null =
  null;
let procgenLoaded = false;
let procgenLoadPromise: Promise<void> | null = null;
let procgenLoadFailed = false;

/**
 * Lazy load the procgen rock module.
 * Only runs on client (browser) - returns immediately on server.
 */
async function loadProcgen(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (procgenLoaded) return true;
  if (procgenLoadFailed) return false;
  if (procgenLoadPromise) {
    await procgenLoadPromise;
    return procgenLoaded;
  }

  console.log("[ProcgenRockCache] Loading @hyperforge/procgen/rock...");

  procgenLoadPromise = import("@hyperforge/procgen/rock")
    .then((procgen) => {
      RockGenerator = procgen.RockGenerator;
      _getPreset = procgen.getPreset;
      _mergeParams = procgen.mergeParams;
      _DEFAULT_PARAMS = procgen.DEFAULT_PARAMS;
      _ColorMode = procgen.ColorMode;
      procgenLoaded = true;
      console.log(
        "[ProcgenRockCache] Successfully loaded @hyperforge/procgen/rock",
      );
    })
    .catch((err) => {
      procgenLoadFailed = true;
      console.error(
        "[ProcgenRockCache] Failed to load @hyperforge/procgen/rock:",
        err,
      );
    });

  await procgenLoadPromise;
  return procgenLoaded;
}

/**
 * Count vertices and triangles in a geometry.
 */
function countGeometry(geo: THREE.BufferGeometry): {
  vertexCount: number;
  triangleCount: number;
} {
  const vertexCount = geo.attributes.position?.count ?? 0;
  const triangleCount = geo.index ? geo.index.count / 3 : vertexCount / 3;
  return { vertexCount, triangleCount };
}

/**
 * Generate LOD1 rock using procgen with reduced geometry settings.
 */
function generateLOD1Rock(
  generator: InstanceType<
    typeof import("@hyperforge/procgen/rock").RockGenerator
  >,
  presetName: string,
  seed: number,
): { mesh: THREE.Mesh; vertexCount: number; triangleCount: number } | null {
  const result = generator.generateFromPreset(presetName, {
    seed,
    params: {
      subdivisions: LOD1_SUBDIVISIONS,
      smooth: { iterations: 1, strength: 0.3 },
    },
  });

  if (!result) return null;

  const stats = countGeometry(result.geometry);
  return { mesh: result.mesh, ...stats };
}

/**
 * Extract metadata from a generated rock.
 */
function extractRockMetadata(mesh: THREE.Mesh): {
  averageColor: THREE.Color;
  dimensions: { width: number; height: number; depth: number };
} {
  const averageColor = new THREE.Color(0x7a7a7a); // Default gray

  // Extract average color from vertex colors
  const geometry = mesh.geometry;
  if (geometry.attributes.color) {
    const colors = geometry.attributes.color;
    let r = 0,
      g = 0,
      b = 0;
    const count = colors.count;
    for (let i = 0; i < count; i++) {
      r += colors.getX(i);
      g += colors.getY(i);
      b += colors.getZ(i);
    }
    if (count > 0) {
      averageColor.setRGB(r / count, g / count, b / count);
    }
  }

  // Calculate dimensions from bounding box
  const bbox = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  return {
    averageColor,
    dimensions: {
      width: size.x,
      height: size.y,
      depth: size.z,
    },
  };
}

/**
 * Generate LOD2 "card rock" using cross-billboard technique.
 */
function generateLOD2CardRock(
  dimensions: { width: number; height: number; depth: number },
  averageColor: THREE.Color,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "LOD2_CardRock";

  const { width, height, depth } = dimensions;
  const avgSize = (width + depth) / 2;
  const cardWidth = avgSize * LOD2_CARD_OPTIONS.cardSizeMultiplier;
  const cardHeight = height * LOD2_CARD_OPTIONS.cardSizeMultiplier;
  const cardGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);

  // Use MeshBasicNodeMaterial for WebGPU compatibility
  const cardMaterial = new MeshBasicNodeMaterial();
  cardMaterial.color = new THREE.Color(averageColor);
  cardMaterial.side = THREE.DoubleSide;
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
 * Serialize a rock variant for IndexedDB storage.
 * @param variant - The rock variant to serialize
 * @param presetName - The preset name (needed to recreate triplanar material on load)
 */
function serializeRockVariant(
  variant: RockVariant,
  presetName: string,
): SerializedRockVariant {
  // Serialize LOD2 card geometries
  const lod2Geometries: SerializedGeometry[] = [];
  if (variant.lod2Group) {
    variant.lod2Group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        lod2Geometries.push(serializeGeometry(child.geometry));
      }
    });
  }

  return {
    geometry: serializeGeometry(variant.mesh.geometry),
    lod1Geometry: variant.lod1Mesh
      ? serializeGeometry(variant.lod1Mesh.geometry)
      : undefined,
    lod2Geometries: lod2Geometries.length > 0 ? lod2Geometries : undefined,
    dimensions: { ...variant.dimensions },
    averageColor: serializeColor(variant.averageColor),
    vertexCount: variant.vertexCount,
    triangleCount: variant.triangleCount,
    presetName, // Store preset name for material recreation
  };
}

/**
 * Create the material for LOD0.
 * Currently uses simple vertex colors (same as LOD1) for reliability.
 * TODO: Implement baked texture atlas for better quality without triplanar overhead.
 */
async function createLOD0Material(
  _presetName: string,
): Promise<THREE.Material> {
  const material = new MeshStandardNodeMaterial();
  material.vertexColors = true;
  material.roughness = 0.85;
  material.metalness = 0.0;
  applySkyFog(material);
  return material;
}

/**
 * Deserialize a rock variant from IndexedDB storage.
 *
 * LOD0: TSL triplanar textured material for close-up detail
 * LOD1: Simple vertex colors for performance (mid-distance)
 * LOD2: Billboard cards with average color (far distance)
 */
async function deserializeRockVariant(
  data: SerializedRockVariant,
): Promise<RockVariant> {
  const presetName = data.presetName ?? "boulder"; // Fallback for old cached data

  // Deserialize main geometry and create LOD0 mesh with TSL triplanar material
  const geometry = deserializeGeometry(data.geometry);
  const lod0Material = await createLOD0Material(presetName);
  const mesh = new THREE.Mesh(geometry, lod0Material);
  mesh.name = `ProcgenRock_${presetName}_LOD0`;

  // Deserialize LOD1 with vertex colors (simpler material for performance)
  let lod1Mesh: THREE.Mesh | null = null;
  if (data.lod1Geometry) {
    const lod1Geo = deserializeGeometry(data.lod1Geometry);
    // Use MeshStandardNodeMaterial with vertex colors for LOD1
    const lod1Mat = new MeshStandardNodeMaterial();
    lod1Mat.vertexColors = true;
    lod1Mat.roughness = 0.85;
    lod1Mat.metalness = 0.0;
    applySkyFog(lod1Mat);
    lod1Mesh = new THREE.Mesh(lod1Geo, lod1Mat);
    lod1Mesh.name = `ProcgenRock_${presetName}_LOD1`;
  }

  // Deserialize LOD2 card group (billboard with average color)
  const averageColor = deserializeColor(data.averageColor);
  const lod2Group = generateLOD2CardRock(data.dimensions, averageColor);

  return {
    mesh,
    lod1Mesh,
    lod2Group,
    vertexCount: data.vertexCount,
    triangleCount: data.triangleCount,
    dimensions: { ...data.dimensions },
    averageColor,
  };
}

/**
 * Generate rock variants for a preset.
 */
async function generateVariants(presetName: string): Promise<RockVariant[]> {
  const loaded = await loadProcgen();

  if (!loaded || !RockGenerator) {
    console.warn(
      `[ProcgenRockCache] Cannot generate "${presetName}" - procgen module not loaded`,
    );
    return [];
  }

  const variants: RockVariant[] = [];
  const generator = new RockGenerator();

  let totalVerts = 0;
  let totalTris = 0;

  for (let i = 0; i < VARIANTS_PER_PRESET; i++) {
    const seed = VARIANT_SEEDS[i];

    // Yield between variants to prevent blocking main thread
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    // Generate LOD0 (full detail)
    const result = generator.generateFromPreset(presetName, {
      seed,
      params: { subdivisions: LOD0_SUBDIVISIONS },
    });

    if (!result) {
      console.warn(
        `[ProcgenRockCache] Failed to generate ${presetName} variant ${i}`,
      );
      continue;
    }

    // Count geometry and extract metadata
    const { vertexCount, triangleCount } = countGeometry(result.geometry);
    const { averageColor, dimensions } = extractRockMetadata(result.mesh);

    // Keep the material from RockGenerator - it already creates proper TSL materials
    // with triplanar texturing based on color mode (Texture, Blend, or Vertex)

    // Generate LOD1 and LOD2
    const lod1Result = generateLOD1Rock(generator, presetName, seed);

    // LOD1 uses MeshStandardNodeMaterial for consistent lighting with LOD0
    if (lod1Result?.mesh) {
      const lod1Mat = new MeshStandardNodeMaterial();
      lod1Mat.vertexColors = true;
      lod1Mat.roughness = 0.85;
      lod1Mat.metalness = 0.0;
      applySkyFog(lod1Mat);
      lod1Result.mesh.material = lod1Mat;
    }

    const lod2Group = generateLOD2CardRock(dimensions, averageColor);

    variants.push({
      mesh: result.mesh,
      lod1Mesh: lod1Result?.mesh ?? null,
      lod2Group,
      vertexCount,
      triangleCount,
      dimensions,
      averageColor,
    });

    totalVerts += vertexCount;
    totalTris += triangleCount;
  }

  generator.dispose();

  if (variants.length > 0) {
    const avgVerts = Math.round(totalVerts / variants.length);
    const avgTris = Math.round(totalTris / variants.length);
    console.log(
      `[ProcgenRockCache] Generated ${variants.length} variants for "${presetName}" ` +
        `(avg: ${avgVerts} verts, ${avgTris} tris)`,
    );

    // Save to IndexedDB for persistence (include preset name for material recreation)
    const serialized = variants.map((v) => serializeRockVariant(v, presetName));
    procgenCacheDB
      .saveCachedVariants("rocks", presetName, serialized, CACHE_VERSION)
      .catch((err) =>
        console.warn(
          `[ProcgenRockCache] Failed to persist ${presetName}:`,
          err,
        ),
      );
  }

  return variants;
}

/**
 * Ensure variants are loaded for a preset.
 * Checks IndexedDB cache first, generates only if not found.
 */
export async function ensureRockVariantsLoaded(
  presetName: string,
): Promise<void> {
  let cache = presetCache.get(presetName);

  if (cache?.variants.length) {
    return; // Already loaded in memory
  }

  if (cache?.loading && cache.loadPromise) {
    await cache.loadPromise;
    return;
  }

  // Start loading
  cache = {
    variants: [],
    loading: true,
    loadPromise: null,
  };
  presetCache.set(presetName, cache);

  const loadPromise = (async () => {
    // Try to load from IndexedDB first
    const cached =
      await procgenCacheDB.loadCachedVariants<SerializedRockVariant>(
        "rocks",
        presetName,
        CACHE_VERSION,
      );

    let variants: RockVariant[];

    if (cached && cached.length > 0) {
      // Deserialize from cache (async to create proper materials)
      variants = await Promise.all(cached.map(deserializeRockVariant));
      console.log(
        `[ProcgenRockCache] Loaded ${variants.length} cached variants for "${presetName}"`,
      );
    } else {
      // Generate fresh variants
      variants = await generateVariants(presetName);
    }

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
 * Get a cached rock variant mesh for a preset.
 * Returns a clone with shared geometry but individual transform.
 *
 * @param presetName - Rock preset name (e.g., "boulder", "granite")
 * @param variantIndex - Optional specific variant index (0-2), random if not specified
 * @returns Cloned mesh with LOD data, or null if not loaded
 */
export function getRockVariant(
  presetName: string,
  variantIndex?: number,
): {
  mesh: THREE.Mesh;
  lod1Mesh: THREE.Mesh | null;
  lod2Group: THREE.Group | null;
  dimensions: { width: number; height: number; depth: number };
  averageColor: THREE.Color;
} | null {
  const cache = presetCache.get(presetName);

  if (!cache?.variants.length) {
    return null;
  }

  // Select variant
  const idx =
    variantIndex !== undefined
      ? Math.abs(variantIndex) % cache.variants.length
      : Math.floor(Math.random() * cache.variants.length);

  const variant = cache.variants[idx];

  // Return cloned mesh (shared geometry, individual instance)
  return {
    mesh: variant.mesh.clone(),
    lod1Mesh: variant.lod1Mesh?.clone() ?? null,
    lod2Group: variant.lod2Group?.clone() ?? null,
    dimensions: { ...variant.dimensions },
    averageColor: variant.averageColor.clone(),
  };
}

/**
 * Get the number of cached variants for a preset.
 */
export function getRockVariantCount(presetName: string): number {
  return presetCache.get(presetName)?.variants.length ?? 0;
}

/**
 * Check if a preset is loaded and ready.
 */
export function isRockPresetLoaded(presetName: string): boolean {
  const cache = presetCache.get(presetName);
  return !!cache?.variants.length && !cache.loading;
}

/**
 * Pre-warm the cache by loading variants for multiple presets.
 */
export async function preWarmRockCache(presets: string[]): Promise<void> {
  console.log(
    `[ProcgenRockCache] Pre-warming cache with ${presets.length} presets...`,
  );
  const startTime = performance.now();

  for (const preset of presets) {
    await ensureRockVariantsLoaded(preset);
    // Small delay between presets to avoid blocking
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }

  const elapsed = Math.round(performance.now() - startTime);
  console.log(`[ProcgenRockCache] Pre-warm complete in ${elapsed}ms`);
}

/**
 * Add a rock instance using the instancer system.
 * Returns the instance ID.
 */
export async function addRockInstance(
  presetName: string,
  position: THREE.Vector3,
  rotation: number,
  scale: number,
  entityId?: string,
): Promise<string | null> {
  // Ensure variants are loaded
  await ensureRockVariantsLoaded(presetName);

  // Get instancer (create if needed)
  const instancer = ProcgenRockInstancer.getInstance(worldRef);
  if (!instancer) {
    console.warn(
      "[ProcgenRockCache] No world reference set, cannot create instancer",
    );
    return null;
  }

  // Add to instancer
  const id =
    entityId ??
    `rock_${presetName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await instancer.addInstance(id, presetName, position, rotation, scale);

  return id;
}

/**
 * Remove a rock instance.
 * @returns true if instance was found and removed, false otherwise
 */
export function removeRockInstance(instanceId: string): boolean {
  const instancer = ProcgenRockInstancer.getInstance(worldRef);
  if (!instancer) {
    return false;
  }
  return instancer.removeInstance(instanceId);
}

/**
 * Clear all cached rock variants (memory only).
 */
export function clearRockCache(): void {
  // Dispose geometries and materials
  for (const [, cache] of presetCache) {
    for (const variant of cache.variants) {
      variant.mesh.geometry.dispose();
      if (variant.mesh.material instanceof THREE.Material) {
        variant.mesh.material.dispose();
      }
      if (variant.lod1Mesh) {
        variant.lod1Mesh.geometry.dispose();
        if (variant.lod1Mesh.material instanceof THREE.Material) {
          variant.lod1Mesh.material.dispose();
        }
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
  console.log("[ProcgenRockCache] Memory cache cleared");
}

/**
 * Clear all cached rock variants (memory + IndexedDB).
 * Use this to force regeneration on next load.
 */
export async function clearRockCacheAll(): Promise<void> {
  clearRockCache();
  await procgenCacheDB.clearStore("rocks");
  console.log("[ProcgenRockCache] All caches cleared (memory + IndexedDB)");
}

/**
 * Default rock presets per biome type.
 * Used when no specific biome rock config is provided.
 */
export const BIOME_ROCK_PRESETS: Record<string, string[]> = {
  tundra: ["granite", "basalt", "boulder"],
  forest: ["boulder", "granite", "limestone"],
  canyon: ["sandstone", "limestone", "pebble"],
};

/**
 * Get default rock presets for a biome.
 */
export function getRockPresetsForBiome(biomeType: string): string[] {
  return (
    BIOME_ROCK_PRESETS[biomeType.toLowerCase()] ?? [
      "boulder",
      "pebble",
      "granite",
    ]
  );
}

/**
 * All available rock presets.
 */
export const ALL_ROCK_PRESETS = [
  // Shape presets
  "boulder",
  "pebble",
  "crystal",
  "asteroid",
  "cliff",
  "lowpoly",
  // Geology presets
  "sandstone",
  "limestone",
  "granite",
  "marble",
  "basalt",
  "slate",
  "obsidian",
  "quartzite",
];
