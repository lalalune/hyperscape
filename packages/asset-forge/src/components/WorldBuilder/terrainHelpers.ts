/**
 * Terrain helper functions extracted from TileBasedTerrain.tsx.
 *
 * Pure geometry/material creation and tile generation utilities
 * used by the tile-based terrain viewer.
 */

import {
  createTerrainMaterial as createGameTerrainMaterial,
  type TerrainUniforms,
} from "@hyperforge/shared";
import {
  getRoadHeightAndInfluence,
  computeRoadBounds,
  ROAD_BLEND_WIDTH,
  ROAD_MINIMUM_WIDTH,
  type RoadPathLike,
  type RoadBounds,
  calculateMineInfluenceAtPoint,
  getMineEffectiveRadius,
} from "@hyperforge/shared/world";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { THREE } from "@/utils/webgpu-renderer";
import type { GeneratedRoad } from "./types";
import {
  getActiveBiomeDefinitions,
  subscribeContentRegistry,
} from "../WorldStudio/utils/contentRegistry";

// ============== TYPES ==============

/** Generic terrain query interface — satisfied by both procgen TerrainGenerator and GameTerrainAdapter */
export interface TerrainQueryResult {
  height: number;
  biome: string;
  color?: { r: number; g: number; b: number };
  /** Forest biome weight 0-1 for per-biome shader blending (legacy 3-channel path) */
  biomeForestWeight?: number;
  /** Canyon biome weight 0-1 for per-biome shader blending (legacy 3-channel path) */
  biomeCanyonWeight?: number;
  /**
   * Phase 2.1 — full per-biome influences sorted descending by
   * weight. Optional because legacy `GameTerrainAdapter` paths
   * may not populate it; `TerrainGenerator.queryPoint` does.
   * The N-channel attribute write path reads up to top-4 entries
   * for the per-vertex `biomeIndices` + `biomeWeights` attrs.
   */
  biomeInfluences?: ReadonlyArray<{ type: string; weight: number }>;
}
export type TerrainQuerier = (
  worldX: number,
  worldZ: number,
) => TerrainQueryResult;

// Mine area type alias for backwards compatibility with prop types
export type MineAreaData = import("@hyperforge/shared/world").MineArea;

/** Town flatten data passed into tile generation */
export interface TownFlattenZone {
  /** Game-space X */
  x: number;
  /** Game-space Z */
  z: number;
  /** Terrain height at town center */
  centerHeight: number;
  /** Radius of fully-flat inner zone (buildings sit here) */
  innerRadius: number;
  /** Radius of outer blend zone (smooth ramp back to natural terrain) */
  outerRadius: number;
}

// ============== CONSTANTS ==============

/**
 * Default fallback biome colors. Used only when:
 *   1. The procgen path doesn't supply `query.color` (it reads from
 *      this lookup), AND
 *   2. The runtime `contentRegistry` doesn't yet have the biome id
 *      (project hasn't loaded any content packs).
 *
 * For themed projects (`tropical_beach`, `jungle`, `frozen_tundra`,
 * etc.) the registry-backed `lookupBiomeColor()` resolves first
 * and this map is bypassed. Phase C4 N-channel rewrite makes this
 * unconditionally registry-driven.
 */
const FALLBACK_BIOME_COLORS: Record<
  string,
  { r: number; g: number; b: number }
> = {
  plains: { r: 0.486, g: 0.729, b: 0.373 },
  forest: { r: 0.227, g: 0.42, b: 0.208 },
  valley: { r: 0.353, g: 0.541, b: 0.31 },
  desert: { r: 0.769, g: 0.639, b: 0.353 },
  tundra: { r: 0.722, g: 0.784, b: 0.784 },
  swamp: { r: 0.29, g: 0.353, b: 0.227 },
  mountains: { r: 0.541, g: 0.541, b: 0.541 },
  lakes: { r: 0.29, g: 0.478, b: 0.722 },
  canyon: { r: 0.553, g: 0.431, b: 0.388 },
};

/**
 * Cached biome→RGB map, rebuilt lazily on first access and
 * invalidated when the content registry changes via
 * `subscribeContentRegistry`. Critical for hot-path performance:
 * `lookupBiomeColor` is called once per vertex during tile mesh
 * generation (tens of millions of calls per world regen at
 * 100×100 tiles × 32×32 verts), so the previous per-call
 * registry walk + object spread tanked viewport FPS to ~2.
 *
 * Cache pattern: nullable `Map<string, RGB>` — null means
 * "rebuild on next access." Subscriber clears it on every
 * registry mutation (setContentPackContent / setPluginBiomes).
 * Hot path is one Map.get + fallback — no allocation, no spread.
 */
let _biomeColorCache: Map<string, { r: number; g: number; b: number }> | null =
  null;

/**
 * Phase 2.1 (N-channel terrain) — stable biome-id → palette
 * index map, used by `generateTileGeometry` to write packed
 * `biomeIndices` per-vertex attributes that the upcoming
 * N-channel TSL shader will look up against a `biomePalette`
 * uniform array.
 *
 * Indexing semantics:
 *   - Order is alphabetical by biome id (deterministic, stable
 *     across tile regens within the same registry epoch).
 *   - Indices restart from 0 each time the registry mutates.
 *   - Index 0 is reserved as the "fallback" slot for biomes
 *     not present in the active palette (defensive default).
 *
 * The same invalidation hook clears both caches together so
 * they stay in lockstep — a registry change rebuilds both on
 * next access.
 */
let _biomePaletteIndexCache: Map<string, number> | null = null;

subscribeContentRegistry(() => {
  _biomeColorCache = null;
  _biomePaletteIndexCache = null;
});

function getBiomeColorMap(): Map<string, { r: number; g: number; b: number }> {
  if (_biomeColorCache !== null) return _biomeColorCache;
  const map = new Map<string, { r: number; g: number; b: number }>();
  // Pass empty engineDefaults — when no content pack is registered,
  // `getActiveBiomeDefinitions({})` returns `{}` and the static
  // `FALLBACK_BIOME_COLORS` map below resolves classic ids. When a
  // themed pack is loaded, it returns the pack's registered biomes.
  const active = getActiveBiomeDefinitions({});
  for (const [id, def] of Object.entries(active)) {
    const hex = def.color;
    map.set(id, {
      r: ((hex >> 16) & 0xff) / 255,
      g: ((hex >> 8) & 0xff) / 255,
      b: (hex & 0xff) / 255,
    });
  }
  _biomeColorCache = map;
  return map;
}

/**
 * Resolve a biome's RGB. O(1) Map lookup — see `_biomeColorCache`
 * above for the invalidation pattern. Themed packs register their
 * biome colors at project load (or pre-procgen in
 * DesignWithAIDialog); this function reads the cached merged map
 * with a constant-time hash lookup. Fallback table covers Hyperia
 * classic ids (forest / canyon / tundra) for legacy projects
 * before any content pack registers.
 */
function lookupBiomeColor(biomeId: string): {
  r: number;
  g: number;
  b: number;
} {
  const cached = getBiomeColorMap().get(biomeId);
  if (cached) return cached;
  return FALLBACK_BIOME_COLORS[biomeId] ?? FALLBACK_BIOME_COLORS.plains!;
}

/**
 * Build (or reuse) the biome-id → palette-index Map. Indices are
 * assigned by alphabetical sort of active biome ids (deterministic,
 * stable across tile regens within the same registry epoch).
 *
 * Used by the N-channel terrain attribute write path: the
 * per-vertex `biomeIndices` attribute holds up to 4 palette indices
 * per vertex, and the upcoming N-channel TSL shader looks them up
 * against a `biomePalette: vec3[]` uniform array. The palette
 * uniform is populated using THIS SAME mapping so
 * `palette[indices[i]] = lookupBiomeColor(idxToBiome[i])`.
 *
 * Hot-path-safe: O(1) Map.get after first build per registry epoch.
 */
function getBiomePaletteIndexMap(): Map<string, number> {
  if (_biomePaletteIndexCache !== null) return _biomePaletteIndexCache;
  const sortedIds = Array.from(getBiomeColorMap().keys()).sort();
  const map = new Map<string, number>();
  for (let i = 0; i < sortedIds.length; i++) map.set(sortedIds[i], i);
  _biomePaletteIndexCache = map;
  return map;
}

/**
 * Resolve a biome's palette index. Returns 0 (fallback slot) for
 * biomes not in the active palette — defensive default that keeps
 * the shader from sampling out of bounds when stale per-vertex
 * data outlives a registry mutation.
 */
function lookupBiomePaletteIndex(biomeId: string): number {
  return getBiomePaletteIndexMap().get(biomeId) ?? 0;
}

/**
 * Public read for the palette uniform: returns biome ids in
 * palette-index order (i.e. `result[i]` is the biome that the
 * `biomeIndices` attribute value `i` references). The TSL shader
 * setup will translate each id through `lookupBiomeColor` to fill
 * the `vec3[]` palette uniform.
 */
export function getActiveBiomePaletteOrder(): ReadonlyArray<string> {
  const map = getBiomePaletteIndexMap();
  const out: string[] = new Array(map.size);
  for (const [id, idx] of map) out[idx] = id;
  return out;
}

// Shoreline tint color (sandy brown)
const SHORELINE_COLOR = { r: 0.545, g: 0.451, b: 0.333 };

// Water colors
const WATER_COLOR = 0x2a5599;
const WATER_OPACITY = 0.75;

// Road colors matching the game's terrain shader (compacted dirt with gravel)
const ROAD_CENTER_COLOR = new THREE.Color(0.4, 0.333, 0.267); // #665544 — compacted dirt
const ROAD_EDGE_COLOR = new THREE.Color(0.349, 0.29, 0.239); // #594a3d — road edge
const ROAD_MAIN_COLOR = new THREE.Color(0.32, 0.24, 0.18); // Darker main roads

// Biome name to ID mapping (matching game's shader expectations) — hoisted to module scope
const BIOME_NAME_TO_ID: Record<string, number> = {
  plains: 0,
  forest: 1,
  valley: 2,
  desert: 3,
  tundra: 4,
  swamp: 5,
  mountains: 6,
  lakes: 7,
  canyon: 8,
};

// ============== AUTO-MATERIAL FROM BIOME ==============

/**
 * Compute default material layer weights for a vertex based on biome, slope, and altitude.
 * Returns 8 weights (indices 0-7: grass, dirt, rock, sand, snow, gravel, mud, volcanic).
 * Weights are normalized to sum to 1.0.
 */
function computeAutoMaterialWeights(
  biome: string,
  slope: number,
  height: number,
  waterThreshold: number,
): [number, number, number, number, number, number, number, number] {
  // Accumulate raw weights, normalize at end
  let grass = 0,
    dirt = 0,
    rock = 0,
    sand = 0;
  let snow = 0,
    gravel = 0,
    mud = 0,
    volcanic = 0;

  const snowLine = 45; // height threshold for snow
  const nearWater = height < waterThreshold + 5;

  // Base from biome
  switch (biome) {
    case "desert":
    case "canyon":
      sand = 0.7;
      rock = 0.2;
      gravel = 0.1;
      break;
    case "swamp":
      mud = 0.6;
      grass = 0.3;
      dirt = 0.1;
      break;
    case "tundra":
      snow = 0.5;
      rock = 0.3;
      gravel = 0.2;
      break;
    case "mountains":
      rock = 0.5;
      gravel = 0.3;
      dirt = 0.2;
      break;
    default: // plains, forest, valley, lakes
      grass = 0.7;
      dirt = 0.3;
      break;
  }

  // Slope overrides — steep slopes push toward rock/gravel
  if (slope > 0.15) {
    const slopeFactor = Math.min(1, (slope - 0.15) / 0.4); // 0 at 0.15, 1 at 0.55
    const slopeBlend = slopeFactor * slopeFactor * (3 - 2 * slopeFactor); // smoothstep
    // Blend toward rock
    grass *= 1 - slopeBlend * 0.9;
    sand *= 1 - slopeBlend * 0.7;
    mud *= 1 - slopeBlend * 0.8;
    snow *= 1 - slopeBlend * 0.5;
    rock += slopeBlend * 0.6;
    gravel += slopeBlend * 0.2;
    dirt += slopeBlend * 0.1;
  }

  // Near water → push toward sand
  if (nearWater) {
    const waterBlend = Math.max(0, 1 - (height - waterThreshold) / 5);
    grass *= 1 - waterBlend * 0.8;
    dirt *= 1 - waterBlend * 0.6;
    sand += waterBlend * 0.7;
  }

  // High altitude → push toward snow
  if (height > snowLine - 5) {
    const snowBlend = Math.min(1, Math.max(0, (height - (snowLine - 5)) / 10));
    grass *= 1 - snowBlend * 0.9;
    dirt *= 1 - snowBlend * 0.7;
    sand *= 1 - snowBlend * 0.5;
    snow += snowBlend * 0.8;
  }

  // Normalize
  const total = grass + dirt + rock + sand + snow + gravel + mud + volcanic;
  if (total > 0) {
    const inv = 1 / total;
    return [
      grass * inv,
      dirt * inv,
      rock * inv,
      sand * inv,
      snow * inv,
      gravel * inv,
      mud * inv,
      volcanic * inv,
    ];
  }
  return [1, 0, 0, 0, 0, 0, 0, 0]; // default: grass
}

// ============== HELPER FUNCTIONS ==============

/**
 * Create template geometry for tiles (cloned for each tile)
 */
export function createTemplateGeometry(
  tileSize: number,
  resolution: number,
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(
    tileSize,
    tileSize,
    resolution - 1,
    resolution - 1,
  );
  geometry.rotateX(-Math.PI / 2);
  // Center at origin - tiles will be positioned by their mesh
  geometry.translate(tileSize / 2, 0, tileSize / 2);
  return geometry;
}

/**
 * Create terrain material using the game's terrain shader.
 * This ensures Asset Forge renders terrain identically to the game,
 * including road influence blending via the roadInfluence vertex attribute.
 *
 * No fallback - the game shader must load for correct road rendering.
 */
export interface EditorTerrainMaterialOptions {
  /**
   * Phase C4 first cut — N-channel base color from per-vertex RGB.
   * When `true`, the material reads `baseColor` from the per-vertex
   * `color` attribute (already populated by `generateTileGeometry`
   * from the runtime content registry's biome colors) instead of
   * the 3-biome tundra/forest/canyon texture blend. Set to `true`
   * for non-Hyperia themed projects (tropical / arctic / desert /
   * etc.) so themed biomes render their authored tints. Hyperia
   * projects keep the textured path (the default).
   */
  useVertexColorBase?: boolean;
}

/**
 * Phase 0.2 — module-level registry of palette textures owned by
 * live terrain materials. When the content registry mutates
 * (themed pack installed mid-session, agent registers new
 * biomes, etc.) we walk this set and refresh each texture's
 * data in place. The shader's uniform binding to the texture
 * object doesn't change — same `THREE.DataTexture`, same GPU
 * resource, just fresh texel data + `needsUpdate=true`. So
 * mid-session pack installation propagates to render without
 * a material recompile or scene rebuild.
 *
 * Add (`createTerrainMaterial`) and remove on material disposal
 * (currently the consumer doesn't dispose materials, so this
 * grows monotonically per dev-server session — acceptable for
 * a development tool).
 */
const _liveBiomePaletteTextures = new Set<THREE.DataTexture>();

subscribeContentRegistry(() => {
  for (const tex of _liveBiomePaletteTextures) {
    refreshBiomePaletteTexture(tex);
  }
});

/**
 * Rewrite an existing palette texture's data from the current
 * registry contents. Index assignment is alphabetical-by-id
 * (deterministic, matches the per-vertex `biomeIndices` write
 * path in `generateTileGeometry`). Adding a biome appends a new
 * slot — existing per-vertex indices stay valid. Removing a
 * biome shifts indices and would invalidate baked tile meshes;
 * not handled in this pass.
 *
 * If the active palette outgrows the texture's allocated size
 * (more biomes than texels), we can't grow the texture in place
 * — log a warning and fall back to clamping. A texture resize
 * requires recreating the DataTexture, which means recreating
 * the material binding; leaving that to the future "rebuild
 * material on content change" path.
 */
function refreshBiomePaletteTexture(tex: THREE.DataTexture): void {
  const order = getActiveBiomePaletteOrder();
  const data = tex.image.data as Float32Array;
  const allocatedSlots = data.length / 4;
  const writeCount = Math.min(order.length, allocatedSlots);
  if (order.length > allocatedSlots) {
    // eslint-disable-next-line no-console
    console.warn(
      `[terrainHelpers] palette has ${order.length} biomes but texture only allocated ${allocatedSlots} slots — clamping to ${writeCount}. Reload the project to grow the palette.`,
    );
  }
  for (let i = 0; i < writeCount; i++) {
    const c = lookupBiomeColor(order[i]);
    data[i * 4 + 0] = c.r;
    data[i * 4 + 1] = c.g;
    data[i * 4 + 2] = c.b;
    data[i * 4 + 3] = 1;
  }
  // Zero out unused slots — any stale `biomeIndices` values that
  // overflow the active palette will sample (0,0,0,1) instead of
  // the previous (e.g. uninstalled) biome's color.
  for (let i = writeCount; i < allocatedSlots; i++) {
    data[i * 4 + 0] = 0;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 1;
  }
  tex.needsUpdate = true;
}

/**
 * Build the 1×N RGB palette texture that the N-channel splatmap
 * shader path samples. Each texel maps a biome palette index
 * (assigned by `getBiomePaletteIndexMap`) to its RGB color from
 * the runtime content registry. The TSL shader does
 * `texture(palette, ((idx + 0.5) / N, 0.5)).rgb` per channel and
 * accumulates `paletteSample[i] * weights[i]` for i in 0..3.
 *
 * Returns `null` if the active palette is empty (no content packs
 * registered yet) — caller should fall back to the legacy paths.
 *
 * Caveat — texture lifecycle: callers should `dispose()` the
 * texture when the material is replaced (registry change, project
 * switch). The shader holds a uniform binding to `texture.image`,
 * so updating texels in place + `needsUpdate=true` works for
 * mid-session palette changes without recompiling the shader.
 *
 * Phase 0.2 — texture is registered in `_liveBiomePaletteTextures`
 * so the registry subscriber refreshes it on content-pack mutation.
 * Allocates with headroom (16 slots minimum) so adding a few
 * biomes mid-session doesn't require recreating the texture.
 */
function buildBiomePaletteTexture(): {
  texture: THREE.DataTexture;
  size: number;
} | null {
  const order = getActiveBiomePaletteOrder();
  const n = order.length;
  if (n === 0) return null;
  // Allocate with headroom so adding a few biomes mid-session
  // (e.g. `agent installs an additional themed pack`) doesn't
  // require recreating the texture. The shader's UV math uses
  // `paletteSize` (the allocated count), so unused slots
  // contribute 0 weight via the per-vertex `biomeIndices`/
  // `biomeWeights` (existing tiles never reference past-active
  // biomes; new tiles get the new indices).
  const allocatedSize = Math.max(16, n * 2);
  // RGBA float texture — three.js (post-r137) doesn't accept
  // RGBFormat for DataTexture; use RGBAFormat and write 4 floats
  // per texel (alpha=1, unused). 1×allocatedSize layout.
  const data = new Float32Array(allocatedSize * 4);
  for (let i = 0; i < n; i++) {
    const c = lookupBiomeColor(order[i]);
    data[i * 4 + 0] = c.r;
    data[i * 4 + 1] = c.g;
    data[i * 4 + 2] = c.b;
    data[i * 4 + 3] = 1;
  }
  // Tail slots: zeros (never sampled at meaningful weights since
  // `biomeIndices` only references registered biomes).
  for (let i = n; i < allocatedSize; i++) data[i * 4 + 3] = 1;
  const tex = new THREE.DataTexture(
    data,
    allocatedSize,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  // Nearest filtering — index lookups should be exact texel reads,
  // not lerps between neighboring biome colors.
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  // Register for mid-session refresh by the contentRegistry
  // subscriber above. When packs install / uninstall, the texel
  // data updates in place — no shader recompile.
  _liveBiomePaletteTextures.add(tex);
  return { texture: tex, size: allocatedSize };
}

export function createTerrainMaterial(
  options: EditorTerrainMaterialOptions = {},
): THREE.Material & {
  terrainUniforms: TerrainUniforms;
} {
  // Phase 2.1 second cut — when the editor enables vertex-color
  // base (non-Hyperia projects), prefer the N-channel splatmap
  // path over the per-vertex pre-blended RGB path. The splatmap
  // gives smoother per-fragment blending (interpolated indices +
  // weights at fragment stage rather than baked vertex colors)
  // and is the architecturally correct AAA pattern. Falls back
  // to vertex-color when no content packs are registered (palette
  // would be empty).
  const useVertexColorBase = options.useVertexColorBase ?? false;
  const palette = useVertexColorBase ? buildBiomePaletteTexture() : null;

  // Use the ACTUAL game terrain shader — same code that renders in Hyperia.
  // "One system, two contexts" — packedAttributes + disabled game-only features.
  const material = createGameTerrainMaterial({
    packedAttributes: true, // Editor packs biome weights into vec4+vec2
    includeVertexLighting: false, // No lamppost/torch data in editor
    includeRiverProximity: false, // No riverProximity attribute in editor
    fogEnabled: false, // Editor camera at altitude — fog not useful
    textureBaseUrl: `${window.location.protocol}//${window.location.hostname}:3401/game-textures/terrain-biomes`,
    useVertexColorBase,
    paletteTexture: palette?.texture,
    paletteSize: palette?.size,
  });
  return material;
}

/**
 * Clip a road path so it stops at town safe zone boundaries instead of
 * going through town centers. Inter-town roads connect edge-to-edge,
 * and internal town streets handle the interior.
 *
 * Uses the town's innerRadius (safeZoneRadius * 0.85) as the clip boundary
 * to match the flat terrain zone.
 */
export function clipRoadPathAtTowns<T extends { x: number; z: number }>(
  path: T[],
  connectedTowns: [string, string],
  runtimeTowns: Array<{
    id: string;
    position: { x: number; z: number };
    safeZoneRadius: number;
  }>,
): T[] {
  if (path.length < 2) return path;

  const townA = runtimeTowns.find((t) => t.id === connectedTowns[0]);
  const townB = runtimeTowns.find((t) => t.id === connectedTowns[1]);

  let startIdx = 0;
  let endIdx = path.length - 1;

  // Clip from start: skip points inside Town A
  if (townA) {
    const clipR = townA.safeZoneRadius * 0.85;
    const clipRSq = clipR * clipR;
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i].x - townA.position.x;
      const dz = path[i].z - townA.position.z;
      if (dx * dx + dz * dz < clipRSq) {
        startIdx = i + 1;
      } else {
        break;
      }
    }
  }

  // Clip from end: skip points inside Town B
  if (townB) {
    const clipR = townB.safeZoneRadius * 0.85;
    const clipRSq = clipR * clipR;
    for (let i = path.length - 1; i > startIdx; i--) {
      const dx = path[i].x - townB.position.x;
      const dz = path[i].z - townB.position.z;
      if (dx * dx + dz * dz < clipRSq) {
        endIdx = i - 1;
      } else {
        break;
      }
    }
  }

  if (endIdx <= startIdx) return path.slice(0, 2); // Degenerate: towns overlap

  return path.slice(startIdx, endIdx + 1);
}

// Road influence and height blending — delegated to shared pure functions
// from @hyperforge/shared/world (imported at top of file).

/**
 * Create water material
 * Uses MeshStandardNodeMaterial for WebGPU compatibility
 */
export function createWaterMaterial(): THREE.Material {
  const material = new MeshStandardNodeMaterial();
  material.color = new THREE.Color(WATER_COLOR);
  material.transparent = true;
  material.opacity = WATER_OPACITY;
  material.roughness = 0.1;
  material.metalness = 0.3;
  material.side = THREE.DoubleSide;
  return material;
}

/**
 * Generate tile geometry with proper heightmap, colors, and road influence.
 * Uses the same approach as the game's TerrainSystem for unified rendering.
 *
 * If `existingGeometry` is provided with the same vertex count, updates its
 * attributes IN-PLACE — no new GPU buffers are created. This is critical for
 * dirty-tile regeneration performance: avoids Metal staging buffer churn and
 * eliminates allocation + dispose overhead (~20% faster per tile).
 */
export function generateTileGeometry(
  tileX: number,
  tileZ: number,
  templateGeometry: THREE.PlaneGeometry,
  queryTerrain: TerrainQuerier,
  tileSize: number,
  waterThreshold: number,
  maxHeight: number,
  worldSizeTiles: number,
  roads?: GeneratedRoad[],
  townFlattenZones?: TownFlattenZone[],
  mines?: MineAreaData[],
  existingGeometry?: THREE.BufferGeometry,
): { geometry: THREE.PlaneGeometry | THREE.BufferGeometry; hasWater: boolean } {
  // Reuse existing geometry if it has the same vertex count (dirty-tile regen).
  // Fall back to cloning the template for new tiles or LOD changes.
  const canReuse =
    existingGeometry &&
    existingGeometry.attributes.position &&
    existingGeometry.attributes.position.count ===
      templateGeometry.attributes.position.count;

  const geometry = canReuse ? existingGeometry : templateGeometry.clone();
  const positions = geometry.attributes.position;

  // Reuse existing typed arrays when updating in-place, allocate for new geometry
  const colorAttr = canReuse
    ? (geometry.getAttribute("color") as THREE.BufferAttribute | null)
    : null;
  const colors = colorAttr
    ? (colorAttr.array as Float32Array)
    : new Float32Array(positions.count * 3);
  // Packed vertex attributes to stay within WebGPU's 8-buffer limit.
  // terrainBlend (vec4): .x=forestWeight, .y=canyonWeight, .z=roadInfluence, .w=mineInfluence
  // biomeData   (vec2): .x=biomeId, .y=mineBiomeId
  const terrainBlend =
    canReuse && geometry.getAttribute("terrainBlend")
      ? ((geometry.getAttribute("terrainBlend") as THREE.BufferAttribute)
          .array as Float32Array)
      : new Float32Array(positions.count * 4);
  const biomeData =
    canReuse && geometry.getAttribute("biomeData")
      ? ((geometry.getAttribute("biomeData") as THREE.BufferAttribute)
          .array as Float32Array)
      : new Float32Array(positions.count * 2);

  // Material layer splatmap weights (8 channels across 2 vec4 attributes)
  // Initialized to 0 = biome fallback in shader (no material layers painted)
  const matWeights0 =
    canReuse && geometry.getAttribute("materialWeights0")
      ? ((geometry.getAttribute("materialWeights0") as THREE.BufferAttribute)
          .array as Float32Array)
      : new Float32Array(positions.count * 4);
  const matWeights1 =
    canReuse && geometry.getAttribute("materialWeights1")
      ? ((geometry.getAttribute("materialWeights1") as THREE.BufferAttribute)
          .array as Float32Array)
      : new Float32Array(positions.count * 4);
  // Phase 2.1 (N-channel terrain) — per-vertex top-K biome blend
  // attributes. Replaces the legacy 3-channel
  // `biomeForestWeight` + `biomeCanyonWeight` hardcode.
  // `biomeIndices` (vec4) holds up to 4 biome palette indices
  // (encoded as floats so they round-trip through Float32Array;
  // the shader will floor-and-cast to int when sampling the
  // `biomePalette` uniform). `biomeWeights` (vec4) holds the
  // matching normalized weights summing to 1. The TSL shader
  // (next session) blends N biome colors via these attributes
  // + a palette uniform; this commit ships the CPU-side
  // foundation only — values are written every regen but the
  // shader doesn't read them yet.
  const biomeIndices =
    canReuse && geometry.getAttribute("biomeIndices")
      ? ((geometry.getAttribute("biomeIndices") as THREE.BufferAttribute)
          .array as Float32Array)
      : new Float32Array(positions.count * 4);
  const biomeWeights =
    canReuse && geometry.getAttribute("biomeWeights")
      ? ((geometry.getAttribute("biomeWeights") as THREE.BufferAttribute)
          .array as Float32Array)
      : new Float32Array(positions.count * 4);

  let hasWater = false;
  const shorelineThreshold = waterThreshold / maxHeight + 0.1; // Normalized

  // Calculate world center offset - island mask is centered at (0,0)
  // so we need to offset our tile coordinates to be centered around the world center
  const worldCenterOffset = (worldSizeTiles * tileSize) / 2;

  // PlaneGeometry is centered at origin, so vertices range from -tileSize/2 to +tileSize/2
  // We need to offset by half a tile to align with the tile grid system where:
  // - Tile (0,0) covers world coords (0, 0) to (tileSize, tileSize)
  // - In terrain generator coords: (-worldCenterOffset, -worldCenterOffset) to (-worldCenterOffset + tileSize, ...)
  const halfTileSize = tileSize / 2;

  // ---- Phase 1B: Spatial pre-filtering for roads per tile ----
  // Compute tile AABB in world-space and filter roads whose bounding box overlaps.
  // Most roads are nowhere near the current tile, so this avoids iterating all segments.
  const tileWorldMinX = tileX * tileSize - worldCenterOffset;
  const tileWorldMaxX = tileWorldMinX + tileSize;
  const tileWorldMinZ = tileZ * tileSize - worldCenterOffset;
  const tileWorldMaxZ = tileWorldMinZ + tileSize;

  let tileRoads: ReadonlyArray<RoadPathLike> | undefined;
  if (roads && roads.length > 0) {
    const filtered: RoadPathLike[] = [];
    for (const road of roads) {
      if (road.path.length < 2) continue;
      const bounds = computeRoadBounds(road);
      // AABB overlap test
      if (
        bounds.maxX < tileWorldMinX ||
        bounds.minX > tileWorldMaxX ||
        bounds.maxZ < tileWorldMinZ ||
        bounds.minZ > tileWorldMaxZ
      )
        continue;
      filtered.push(road);
    }
    if (filtered.length > 0) tileRoads = filtered;
  }

  // ---- Phase 1C: Pre-compute squared radii for town/mine rejection ----
  type TownFlattenPrecomputed = TownFlattenZone & {
    outerRadiusSq: number;
    innerRadiusSq: number;
  };
  let precomputedTowns: TownFlattenPrecomputed[] | undefined;
  if (townFlattenZones && townFlattenZones.length > 0) {
    precomputedTowns = townFlattenZones.map((tz) => ({
      ...tz,
      outerRadiusSq: tz.outerRadius * tz.outerRadius,
      innerRadiusSq: tz.innerRadius * tz.innerRadius,
    }));
  }

  type MinePrecomputed = NonNullable<typeof mines>[number] & { maxRSq: number };
  let precomputedMines: MinePrecomputed[] | undefined;
  if (mines && mines.length > 0) {
    precomputedMines = mines.map((m) => ({
      ...m,
      maxRSq: m.radius * 1.5 * (m.radius * 1.5),
    }));
  }

  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localZ = positions.getZ(i);

    // World coordinates in terrain generator space (centered at 0,0)
    // Add halfTileSize to convert from centered geometry coords to tile-corner coords
    const worldX = localX + halfTileSize + tileX * tileSize - worldCenterOffset;
    const worldZ = localZ + halfTileSize + tileZ * tileSize - worldCenterOffset;

    // Query terrain
    const query = queryTerrain(worldX, worldZ);
    let height = query.height;

    // Flatten terrain under towns: full-flat inside innerRadius,
    // smooth hermite blend back to natural terrain at outerRadius
    // Track how much this vertex is influenced by town flattening (0 = none, 1 = fully flat)
    let townFlattenInfluence = 0;
    if (precomputedTowns) {
      for (const tz of precomputedTowns) {
        const dx = worldX - tz.x;
        const dz = worldZ - tz.z;
        const distSq = dx * dx + dz * dz;
        // Squared distance rejection — avoid sqrt for points clearly outside
        if (distSq >= tz.outerRadiusSq) continue;
        if (distSq <= tz.innerRadiusSq) {
          // Fully flat at town center height
          height = tz.centerHeight;
          townFlattenInfluence = 1;
        } else {
          // Only compute sqrt when inside the blend zone
          const dist = Math.sqrt(distSq);
          // Smooth blend: 0 at innerRadius (full flatten) → 1 at outerRadius (natural)
          const t = (dist - tz.innerRadius) / (tz.outerRadius - tz.innerRadius);
          // Hermite smoothstep for natural-looking ramp
          const blend = t * t * (3 - 2 * t);
          height = tz.centerHeight + (height - tz.centerHeight) * blend;
          townFlattenInfluence = 1 - blend;
        }
        break; // Only one town per vertex (first match)
      }
    }

    // ---- Phase 1A: Merged road height + influence in single pass ----
    // Flatten terrain under roads AND compute shader influence attribute together.
    let roadInfluenceValue = 0;
    if (tileRoads && townFlattenInfluence < 1) {
      const roadResult = getRoadHeightAndInfluence(worldX, worldZ, tileRoads);
      roadInfluenceValue = roadResult.influence;
      if (roadResult.heightInfluence > 0) {
        // Road path height + small offset so road sits slightly above terrain
        const targetHeight = roadResult.height + 0.1;
        // Reduce road influence proportionally to town flatten influence
        const effectiveInfluence =
          roadResult.heightInfluence * (1 - townFlattenInfluence);
        height = height + (targetHeight - height) * effectiveInfluence;
      }
    } else if (tileRoads) {
      // Inside fully-flat town zone — still need influence for shader coloring
      const roadResult = getRoadHeightAndInfluence(worldX, worldZ, tileRoads);
      roadInfluenceValue = roadResult.influence;
    }

    // RuneScape-style mine depression: gentle, shallow bowl that blends
    // smoothly into the surrounding terrain. No rim or steep walls — just
    // a subtle dip where mining has worn the ground down.
    if (precomputedMines && townFlattenInfluence < 1) {
      for (const mine of precomputedMines) {
        const dx = worldX - mine.position.x;
        const dz = worldZ - mine.position.z;
        const distSq = dx * dx + dz * dz;

        // Quick squared-distance reject (avoids sqrt)
        if (distSq >= mine.maxRSq) continue;

        const dist = Math.sqrt(distSq);

        // Organic boundary: effective radius varies by angle
        const angle = Math.atan2(dz, dx);
        const R = getMineEffectiveRadius(
          mine.radius,
          mine.radialOffsets,
          angle,
        );
        if (dist >= R * 1.2) continue;

        const centerHeight = mine.position.y;
        const townBlend = 1 - townFlattenInfluence;

        // Smooth cosine bowl: deepest at center, level at edge
        const t = Math.min(dist / R, 1.0);
        const bowlFactor = 0.5 * (1 + Math.cos(Math.PI * t));

        // Asymmetric depth: gentle entry ramp (40%), steep back wall (100%)
        // Must match minePlacement.ts getMineBowlHeight exactly
        let afe = Math.abs(angle - mine.entryAngle);
        if (afe > Math.PI) afe = 2 * Math.PI - afe;
        const depthMul = 0.4 + 0.6 * (afe / Math.PI);

        // Micro-undulation: rocky, uneven mine floor (deterministic from position)
        const undulation1 =
          Math.sin(worldX * 0.7 + 1.3) * Math.cos(worldZ * 0.9 + 2.1) * 0.3;
        const undulation2 = Math.sin(worldX * 2.3 + worldZ * 1.7) * 0.15;
        const undulation3 = Math.cos(worldX * 4.1 - worldZ * 3.3) * 0.06;
        const floorNoise =
          (undulation1 + undulation2 + undulation3) * bowlFactor;

        // Rim bumps: suppressed on entry side for smooth ramp
        const rimT = Math.max(0, 1 - Math.abs(t - 0.88) / 0.12);
        const rimSuppression = Math.min(1, afe / (Math.PI * 0.4));
        const rimBump =
          (Math.sin(worldX * 1.5 + worldZ * 2.1) * 0.3 +
            Math.cos(worldX * 2.7 - worldZ * 1.3) * 0.15) *
          rimT *
          rimSuppression;

        const targetHeight =
          centerHeight - 3.0 * depthMul * bowlFactor + floorNoise + rimBump;

        // Blend bowl into natural terrain — full blend inside R, fade to 0 by 1.2R
        let blend = 1.0;
        if (dist > R) {
          const fadeT = (dist - R) / (R * 0.2);
          blend = 1.0 - fadeT * fadeT * (3 - 2 * fadeT);
        }
        blend *= townBlend;

        height = height + (targetHeight - height) * blend;
        break;
      }
    }

    // Set vertex height
    positions.setY(i, height);

    // Check if this tile has water
    if (height < waterThreshold) {
      hasWater = true;
    }

    // Get biome color — use query-provided color (game pipeline) or look up from table
    let r: number, g: number, b: number;
    if (query.color) {
      r = query.color.r;
      g = query.color.g;
      b = query.color.b;
    } else {
      const biomeColor = lookupBiomeColor(query.biome);
      r = biomeColor.r;
      g = biomeColor.g;
      b = biomeColor.b;
    }

    // Apply shoreline tinting near water level
    const normalizedHeight = height / maxHeight;
    const waterLevel = waterThreshold / maxHeight;

    if (
      normalizedHeight > waterLevel &&
      normalizedHeight < shorelineThreshold
    ) {
      const shoreFactor =
        (1.0 -
          (normalizedHeight - waterLevel) / (shorelineThreshold - waterLevel)) *
        0.6;
      r = r + (SHORELINE_COLOR.r - r) * shoreFactor;
      g = g + (SHORELINE_COLOR.g - g) * shoreFactor;
      b = b + (SHORELINE_COLOR.b - b) * shoreFactor;
    }

    // Store color
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    // Store packed biome data and terrain blend weights for shader
    const i2 = i * 2;
    const i4blend = i * 4;
    biomeData[i2] = BIOME_NAME_TO_ID[query.biome] ?? 0;
    terrainBlend[i4blend] = query.biomeForestWeight ?? 0; // .x = forestWeight
    terrainBlend[i4blend + 1] = query.biomeCanyonWeight ?? 0; // .y = canyonWeight
    terrainBlend[i4blend + 2] = roadInfluenceValue; // .z = roadInfluence
    // .w = mineInfluence (set below if mines exist)

    // Phase 2.1 (N-channel terrain) — top-4 palette indices +
    // weights for the upcoming N-channel TSL shader. Reads from
    // `query.biomeInfluences` (already sorted descending by
    // weight inside `BiomeSystem.getBiomeInfluencesAtPosition`).
    // Defensive fallback if query lacks influences (shouldn't
    // happen post Phase 0.3): single-biome palette = dominant.
    const influences = query.biomeInfluences;
    if (influences && influences.length > 0) {
      const k = Math.min(4, influences.length);
      let topSum = 0;
      for (let s = 0; s < k; s++) topSum += influences[s].weight;
      // Renormalize over the top-k subset so shader weights
      // still sum to 1 even after dropping the long tail.
      const invTopSum = topSum > 0 ? 1 / topSum : 0;
      for (let s = 0; s < 4; s++) {
        if (s < k) {
          biomeIndices[i4blend + s] = lookupBiomePaletteIndex(
            influences[s].type,
          );
          biomeWeights[i4blend + s] = influences[s].weight * invTopSum;
        } else {
          biomeIndices[i4blend + s] = 0;
          biomeWeights[i4blend + s] = 0;
        }
      }
    } else {
      // No influences — single-channel fallback at index 0.
      biomeIndices[i4blend] = lookupBiomePaletteIndex(query.biome);
      biomeIndices[i4blend + 1] = 0;
      biomeIndices[i4blend + 2] = 0;
      biomeIndices[i4blend + 3] = 0;
      biomeWeights[i4blend] = 1;
      biomeWeights[i4blend + 1] = 0;
      biomeWeights[i4blend + 2] = 0;
      biomeWeights[i4blend + 3] = 0;
    }

    // Mine influence for terrain shader — rocky floor color overlay.
    // Skip function call overhead when no mines exist (common case for most tiles).
    if (precomputedMines) {
      const mineResult = calculateMineInfluenceAtPoint(worldX, worldZ, mines);
      terrainBlend[i4blend + 3] = mineResult.influence; // .w = mineInfluence
      biomeData[i2 + 1] = mineResult.biomeIndex; // .y = mineBiomeId
    }

    // Auto-material weights from biome + height (slope handled by shader)
    const mw = computeAutoMaterialWeights(
      query.biome,
      0,
      height,
      waterThreshold,
    );
    const i4 = i * 4;
    matWeights0[i4] = mw[0]; // grass
    matWeights0[i4 + 1] = mw[1]; // dirt
    matWeights0[i4 + 2] = mw[2]; // rock
    matWeights0[i4 + 3] = mw[3]; // sand
    matWeights1[i4] = mw[4]; // snow
    matWeights1[i4 + 1] = mw[5]; // gravel
    matWeights1[i4 + 2] = mw[6]; // mud
    matWeights1[i4 + 3] = mw[7]; // volcanic
  }

  if (canReuse) {
    // In-place update: mark existing attributes as needing GPU upload.
    // No new BufferAttribute objects — reuses the same GPU buffers.
    positions.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
    const tbAttr = geometry.getAttribute(
      "terrainBlend",
    ) as THREE.BufferAttribute | null;
    if (tbAttr) tbAttr.needsUpdate = true;
    const bdAttr = geometry.getAttribute(
      "biomeData",
    ) as THREE.BufferAttribute | null;
    if (bdAttr) bdAttr.needsUpdate = true;
    const mw0Attr = geometry.getAttribute(
      "materialWeights0",
    ) as THREE.BufferAttribute | null;
    if (mw0Attr) mw0Attr.needsUpdate = true;
    const mw1Attr = geometry.getAttribute(
      "materialWeights1",
    ) as THREE.BufferAttribute | null;
    if (mw1Attr) mw1Attr.needsUpdate = true;
    // Phase 2.1 — N-channel attributes follow the same in-place
    // update pattern as the rest of the dirty-tile regen path.
    const biomeIndicesAttr = geometry.getAttribute(
      "biomeIndices",
    ) as THREE.BufferAttribute | null;
    if (biomeIndicesAttr) biomeIndicesAttr.needsUpdate = true;
    const biomeWeightsAttr = geometry.getAttribute(
      "biomeWeights",
    ) as THREE.BufferAttribute | null;
    if (biomeWeightsAttr) biomeWeightsAttr.needsUpdate = true;
  } else {
    // New geometry: create fresh BufferAttribute objects
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute(
      "terrainBlend",
      new THREE.BufferAttribute(terrainBlend, 4),
    );
    geometry.setAttribute("biomeData", new THREE.BufferAttribute(biomeData, 2));
    geometry.setAttribute(
      "materialWeights0",
      new THREE.BufferAttribute(matWeights0, 4),
    );
    geometry.setAttribute(
      "materialWeights1",
      new THREE.BufferAttribute(matWeights1, 4),
    );
    // Phase 2.1 — N-channel biome blend attributes. Shader does
    // not yet read these (lands next session); written every
    // regen so the foundation is in place.
    geometry.setAttribute(
      "biomeIndices",
      new THREE.BufferAttribute(biomeIndices, 4),
    );
    geometry.setAttribute(
      "biomeWeights",
      new THREE.BufferAttribute(biomeWeights, 4),
    );
    positions.needsUpdate = true;
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return { geometry, hasWater };
}
