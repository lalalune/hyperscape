/**
 * brushApplication — Shared brush application utilities
 *
 * Extracted from useBrushOverlaySync so both the real-time hook AND
 * tile generation can apply brush strokes consistently.
 * This ensures sculpt strokes persist across tile unload/reload.
 */

import * as THREE from "three/webgpu";

import type {
  TerrainSculptStroke,
  BiomePaintStroke,
  VegetationPaintStroke,
  MaterialPaintStroke,
  BrushFalloff,
} from "../types";

// ============== CONSTANTS ==============

const SCULPT_HEIGHT_STEP = 2.0; // meters per full-strength application

// Biome colors (must match TileBasedTerrain BIOME_COLORS)
const BIOME_COLORS: Record<string, [number, number, number]> = {
  plains: [0.486, 0.729, 0.373],
  forest: [0.227, 0.42, 0.208],
  valley: [0.353, 0.541, 0.31],
  desert: [0.769, 0.639, 0.353],
  tundra: [0.722, 0.784, 0.784],
  swamp: [0.29, 0.353, 0.227],
  mountains: [0.541, 0.541, 0.541],
  lakes: [0.29, 0.478, 0.722],
  canyon: [0.6, 0.45, 0.3],
};

// ============== BRUSH MATH ==============

function brushInfluence(
  dist: number,
  radius: number,
  falloff: BrushFalloff,
): number {
  if (dist >= radius) return 0;
  const t = dist / radius;
  switch (falloff) {
    case "sharp":
      return t < 0.7 ? 1.0 : Math.max(0, (1 - t) / 0.3);
    case "linear":
      return 1 - t;
    case "smooth":
    default:
      return 1 - t * t * (3 - 2 * t);
  }
}

/** Check if a circle overlaps an AABB (2D in XZ plane) */
function circleOverlapsAABB(
  cx: number,
  cz: number,
  radius: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean {
  const nearX = Math.max(minX, Math.min(cx, maxX));
  const nearZ = Math.max(minZ, Math.min(cz, maxZ));
  return (nearX - cx) ** 2 + (nearZ - cz) ** 2 <= radius * radius;
}

// ============== TERRAIN SCULPT ==============

/** Set of meshes that need normals recomputed after a batch of sculpt strokes. */
const _dirtyMeshes = new Set<THREE.Mesh>();

export function applyTerrainSculptToTiles(
  terrainContainer: THREE.Group,
  stroke: TerrainSculptStroke,
): void {
  const { center, radius, strength, mode, falloff, flattenTarget } = stroke;

  for (const child of terrainContainer.children) {
    if (!(child instanceof THREE.Mesh)) continue;

    const mesh = child;
    const positions = mesh.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    if (!positions) continue;

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;

    // Quick culling — skip tiles that don't overlap the stroke circle
    if (
      !circleOverlapsAABB(
        center.x,
        center.z,
        radius,
        mesh.position.x + bb.min.x,
        mesh.position.x + bb.max.x,
        mesh.position.z + bb.min.z,
        mesh.position.z + bb.max.z,
      )
    )
      continue;

    let modified = false;

    for (let i = 0; i < positions.count; i++) {
      const worldX = mesh.position.x + positions.getX(i);
      const worldZ = mesh.position.z + positions.getZ(i);

      const dx = worldX - center.x;
      const dz = worldZ - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= radius) continue;

      const inf = brushInfluence(dist, radius, falloff) * strength;
      const y = positions.getY(i);

      switch (mode) {
        case "raise":
          positions.setY(i, y + inf * SCULPT_HEIGHT_STEP);
          break;
        case "lower":
          positions.setY(i, y - inf * SCULPT_HEIGHT_STEP);
          break;
        case "flatten": {
          const target = flattenTarget ?? y;
          positions.setY(i, y + (target - y) * inf);
          break;
        }
        case "smooth": {
          const stride = Math.round(Math.sqrt(positions.count));
          let sum = 0;
          let cnt = 0;
          for (const di of [-1, 0, 1]) {
            for (const dj of [-1, 0, 1]) {
              if (di === 0 && dj === 0) continue;
              const ni = i + di + dj * stride;
              if (ni >= 0 && ni < positions.count) {
                sum += positions.getY(ni);
                cnt++;
              }
            }
          }
          if (cnt > 0) {
            positions.setY(i, y + (sum / cnt - y) * inf * 0.5);
          }
          break;
        }
      }
      modified = true;
    }

    if (modified) {
      positions.needsUpdate = true;
      mesh.geometry.computeBoundingBox();
      _dirtyMeshes.add(mesh);
    }
  }
}

/** Flush deferred vertex normal computation for all modified meshes. */
export function flushDirtyNormals(): void {
  for (const mesh of _dirtyMeshes) {
    mesh.geometry.computeVertexNormals();
  }
  _dirtyMeshes.clear();
}

// ============== BIOME PAINT ==============

export function applyBiomePaintToTiles(
  terrainContainer: THREE.Group,
  stroke: BiomePaintStroke,
): void {
  const { center, radius, strength, falloff, targetBiome } = stroke;
  const bc = BIOME_COLORS[targetBiome] ?? BIOME_COLORS.plains;

  for (const child of terrainContainer.children) {
    if (!(child instanceof THREE.Mesh)) continue;

    const mesh = child;
    const positions = mesh.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    if (!positions || !colors) continue;

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;

    if (
      !circleOverlapsAABB(
        center.x,
        center.z,
        radius,
        mesh.position.x + bb.min.x,
        mesh.position.x + bb.max.x,
        mesh.position.z + bb.min.z,
        mesh.position.z + bb.max.z,
      )
    )
      continue;

    let modified = false;

    for (let i = 0; i < positions.count; i++) {
      const worldX = mesh.position.x + positions.getX(i);
      const worldZ = mesh.position.z + positions.getZ(i);

      const dx = worldX - center.x;
      const dz = worldZ - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= radius) continue;

      const inf = brushInfluence(dist, radius, falloff) * strength;

      const r = colors.getX(i);
      const g = colors.getY(i);
      const b = colors.getZ(i);

      colors.setXYZ(
        i,
        r + (bc[0] - r) * inf,
        g + (bc[1] - g) * inf,
        b + (bc[2] - b) * inf,
      );
      modified = true;
    }

    if (modified) {
      colors.needsUpdate = true;
    }
  }
}

// ============== GEOMETRY-LEVEL SCULPT APPLICATION ==============

/**
 * Apply terrain sculpt strokes directly to a BufferGeometry's position attribute.
 * Used during tile generation to bake brush strokes into newly created tiles,
 * ensuring strokes persist across tile unload/reload cycles.
 *
 * @param geometry - The tile's BufferGeometry (positions in local tile space)
 * @param tileWorldX - World X offset of the tile mesh
 * @param tileWorldZ - World Z offset of the tile mesh
 * @param strokes - All terrain sculpt strokes to consider
 */
export function applySculptStrokesToGeometry(
  geometry: THREE.BufferGeometry,
  tileWorldX: number,
  tileWorldZ: number,
  strokes: TerrainSculptStroke[],
): boolean {
  if (strokes.length === 0) return false;

  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!positions) return false;

  // Compute tile AABB for quick culling
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const minX = tileWorldX + bb.min.x;
  const maxX = tileWorldX + bb.max.x;
  const minZ = tileWorldZ + bb.min.z;
  const maxZ = tileWorldZ + bb.max.z;

  let anyModified = false;

  for (const stroke of strokes) {
    const { center, radius, strength, mode, falloff, flattenTarget } = stroke;

    // Quick culling — skip strokes that don't overlap this tile
    if (!circleOverlapsAABB(center.x, center.z, radius, minX, maxX, minZ, maxZ))
      continue;

    for (let i = 0; i < positions.count; i++) {
      const worldX = tileWorldX + positions.getX(i);
      const worldZ = tileWorldZ + positions.getZ(i);

      const dx = worldX - center.x;
      const dz = worldZ - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= radius) continue;

      const inf = brushInfluence(dist, radius, falloff) * strength;
      const y = positions.getY(i);

      switch (mode) {
        case "raise":
          positions.setY(i, y + inf * SCULPT_HEIGHT_STEP);
          break;
        case "lower":
          positions.setY(i, y - inf * SCULPT_HEIGHT_STEP);
          break;
        case "flatten": {
          const target = flattenTarget ?? y;
          positions.setY(i, y + (target - y) * inf);
          break;
        }
        case "smooth": {
          const stride = Math.round(Math.sqrt(positions.count));
          let sum = 0;
          let cnt = 0;
          for (const di of [-1, 0, 1]) {
            for (const dj of [-1, 0, 1]) {
              if (di === 0 && dj === 0) continue;
              const ni = i + di + dj * stride;
              if (ni >= 0 && ni < positions.count) {
                sum += positions.getY(ni);
                cnt++;
              }
            }
          }
          if (cnt > 0) {
            positions.setY(i, y + (sum / cnt - y) * inf * 0.5);
          }
          break;
        }
      }
      anyModified = true;
    }
  }

  if (anyModified) {
    positions.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
  }

  return anyModified;
}

// ============== VEGETATION PAINT ==============

/** Compact tree data format matching WorldJsonTree */
export type PaintedTreeData = {
  s: string;
  x: number;
  y: number;
  z: number;
  sc: number;
  r: number;
};

/** Default tree species used when painting (most common game species) */
const DEFAULT_PAINT_SPECIES = ["oak", "pine", "birch", "willow"];

/** Min spacing between painted trees to avoid clumping (meters) */
const PAINT_TREE_MIN_SPACING = 4;
const PAINT_TREE_MIN_SPACING_SQ =
  PAINT_TREE_MIN_SPACING * PAINT_TREE_MIN_SPACING;

/** Deterministic hash from string → unsigned 32-bit integer */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Seeded LCG PRNG — fast, deterministic, good enough for tree placement */
function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate tree positions within a single "add" vegetation paint stroke.
 * Uses seeded Poisson-like rejection sampling for well-spaced placement.
 */
function scatterTreesInStroke(
  stroke: VegetationPaintStroke,
  getHeight: (worldX: number, worldZ: number) => number,
  existingTrees: Array<{ x: number; z: number }>,
): PaintedTreeData[] {
  const { center, radius, strength, falloff, speciesFilter, id } = stroke;

  // Only "tree" category has 3D models; other categories (bush, fern, etc.)
  // are not yet supported in the vegetation rendering pipeline.
  const hasTreeCategory =
    speciesFilter.length === 0 || speciesFilter.includes("tree");
  if (!hasTreeCategory) return [];

  const rng = createSeededRng(hashString(id));

  // Target density: ~1 tree per 16m² at full strength
  const area = Math.PI * radius * radius;
  const targetCount = Math.max(1, Math.round(area * strength * 0.06));

  const trees: PaintedTreeData[] = [];
  const placed: Array<{ x: number; z: number }> = [];

  const maxAttempts = targetCount * 10;
  let attempts = 0;

  while (trees.length < targetCount && attempts < maxAttempts) {
    attempts++;

    // Uniform random point in circle (sqrt for uniform area distribution)
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * radius;
    const x = center.x + Math.cos(angle) * dist;
    const z = center.z + Math.sin(angle) * dist;

    // Density falloff at brush edges
    const influence = brushInfluence(dist, radius, falloff);
    if (rng() > influence) continue;

    // Min spacing: check against newly placed trees in this stroke
    let tooClose = false;
    for (const p of placed) {
      const ddx = x - p.x;
      const ddz = z - p.z;
      if (ddx * ddx + ddz * ddz < PAINT_TREE_MIN_SPACING_SQ) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    // Min spacing: check against existing trees
    for (const t of existingTrees) {
      const ddx = x - t.x;
      const ddz = z - t.z;
      if (ddx * ddx + ddz * ddz < PAINT_TREE_MIN_SPACING_SQ) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const y = getHeight(x, z);
    const speciesIdx = Math.floor(rng() * DEFAULT_PAINT_SPECIES.length);
    const scale = 0.8 + rng() * 0.4; // 0.8..1.2
    const rotation = rng() * Math.PI * 2;

    trees.push({
      s: DEFAULT_PAINT_SPECIES[speciesIdx],
      x,
      y,
      z,
      sc: scale,
      r: rotation,
    });
    placed.push({ x, z });
  }

  return trees;
}

/**
 * Apply vegetation paint strokes to a tree list.
 *
 * "add" strokes scatter new trees within the brush radius using seeded
 * Poisson-like sampling. "remove" strokes filter out existing trees within
 * the brush radius, weighted by strength and falloff.
 *
 * Strokes are applied in timestamp order for deterministic results.
 *
 * @param trees - Base tree list (procgen or manifest)
 * @param strokes - Vegetation paint strokes from brush tool
 * @param getHeight - Height querier: (worldX, worldZ) => terrainHeight
 * @returns Modified tree list with additions/removals
 */
export function applyVegetationPaintStrokes(
  trees: PaintedTreeData[],
  strokes: VegetationPaintStroke[],
  getHeight: (worldX: number, worldZ: number) => number,
): PaintedTreeData[] {
  if (strokes.length === 0) return trees;

  // Sort by timestamp for deterministic application order
  const sorted = [...strokes].sort((a, b) => a.timestamp - b.timestamp);

  let result = [...trees];

  for (const stroke of sorted) {
    if (stroke.mode === "remove") {
      // Remove trees within stroke radius, weighted by influence + strength.
      // Uses position-based hash for deterministic removal (not Math.random).
      result = result.filter((tree) => {
        const dx = tree.x - stroke.center.x;
        const dz = tree.z - stroke.center.z;
        const distSq = dx * dx + dz * dz;
        const radiusSq = stroke.radius * stroke.radius;
        if (distSq >= radiusSq) return true; // Outside radius — keep

        const dist = Math.sqrt(distSq);
        const influence =
          brushInfluence(dist, stroke.radius, stroke.falloff) * stroke.strength;

        // Deterministic threshold from tree position
        const hash =
          (((tree.x * 73856093) | 0) ^ ((tree.z * 19349663) | 0)) >>> 0;
        const threshold = (hash % 1000) / 1000;
        return threshold > influence;
      });
    } else {
      // Add trees: scatter within stroke radius, avoiding existing trees
      const existingPositions = result.map((t) => ({ x: t.x, z: t.z }));
      const newTrees = scatterTreesInStroke(
        stroke,
        getHeight,
        existingPositions,
      );
      result.push(...newTrees);
    }
  }

  return result;
}

// ============== MATERIAL PAINT ==============

/** Material layer index mapping */
const MATERIAL_LAYER_INDEX: Record<string, number> = {
  grass: 0,
  dirt: 1,
  rock: 2,
  sand: 3,
  snow: 4,
  gravel: 5,
  mud: 6,
  volcanic: 7,
};

/**
 * Apply a material paint stroke to all terrain tiles in a container.
 * Modifies materialWeights0 (layers 0-3) and materialWeights1 (layers 4-7)
 * vertex attributes directly.
 */
export function applyMaterialPaintToTiles(
  terrainContainer: THREE.Group,
  stroke: MaterialPaintStroke,
): void {
  const { center, radius, strength, falloff, targetMaterial } = stroke;
  const layerIndex = MATERIAL_LAYER_INDEX[targetMaterial] ?? 0;

  for (const child of terrainContainer.children) {
    if (!(child instanceof THREE.Mesh)) continue;

    const mesh = child;
    const positions = mesh.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    if (!positions) continue;

    const mw0Attr = mesh.geometry.getAttribute(
      "materialWeights0",
    ) as THREE.BufferAttribute | null;
    const mw1Attr = mesh.geometry.getAttribute(
      "materialWeights1",
    ) as THREE.BufferAttribute | null;
    if (!mw0Attr || !mw1Attr) continue;

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;

    if (
      !circleOverlapsAABB(
        center.x,
        center.z,
        radius,
        mesh.position.x + bb.min.x,
        mesh.position.x + bb.max.x,
        mesh.position.z + bb.min.z,
        mesh.position.z + bb.max.z,
      )
    )
      continue;

    const mw0 = mw0Attr.array as Float32Array;
    const mw1 = mw1Attr.array as Float32Array;
    let modified = false;

    for (let i = 0; i < positions.count; i++) {
      const worldX = mesh.position.x + positions.getX(i);
      const worldZ = mesh.position.z + positions.getZ(i);

      const dx = worldX - center.x;
      const dz = worldZ - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= radius) continue;

      const inf = brushInfluence(dist, radius, falloff) * strength;
      if (inf <= 0.001) continue;

      // Read current 8 weights
      const i4 = i * 4;
      const w = [
        mw0[i4],
        mw0[i4 + 1],
        mw0[i4 + 2],
        mw0[i4 + 3],
        mw1[i4],
        mw1[i4 + 1],
        mw1[i4 + 2],
        mw1[i4 + 3],
      ];

      // Increase target layer by inf, decrease others proportionally
      const oldTarget = w[layerIndex];
      const newTarget = Math.min(1, oldTarget + inf);
      const added = newTarget - oldTarget;
      w[layerIndex] = newTarget;

      // Redistribute the added weight from other channels proportionally
      const othersSum = 1 - oldTarget;
      if (othersSum > 0.001) {
        const scale = Math.max(0, 1 - added / othersSum);
        for (let j = 0; j < 8; j++) {
          if (j !== layerIndex) w[j] *= scale;
        }
      }

      // Normalize
      let total = 0;
      for (let j = 0; j < 8; j++) total += w[j];
      if (total > 0) {
        const inv = 1 / total;
        for (let j = 0; j < 8; j++) w[j] *= inv;
      }

      // Write back
      mw0[i4] = w[0];
      mw0[i4 + 1] = w[1];
      mw0[i4 + 2] = w[2];
      mw0[i4 + 3] = w[3];
      mw1[i4] = w[4];
      mw1[i4 + 1] = w[5];
      mw1[i4 + 2] = w[6];
      mw1[i4 + 3] = w[7];
      modified = true;
    }

    if (modified) {
      mw0Attr.needsUpdate = true;
      mw1Attr.needsUpdate = true;
    }
  }
}

/**
 * Apply material paint strokes to a single tile geometry (for bake during tile generation).
 * tileWorldX/Z is the world-space origin of the tile.
 */
export function applyMaterialPaintStrokesToGeometry(
  geometry: THREE.BufferGeometry,
  tileWorldX: number,
  tileWorldZ: number,
  strokes: MaterialPaintStroke[],
): void {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const mw0Attr = geometry.getAttribute(
    "materialWeights0",
  ) as THREE.BufferAttribute | null;
  const mw1Attr = geometry.getAttribute(
    "materialWeights1",
  ) as THREE.BufferAttribute | null;
  if (!positions || !mw0Attr || !mw1Attr) return;

  const mw0 = mw0Attr.array as Float32Array;
  const mw1 = mw1Attr.array as Float32Array;

  // Sort by timestamp to apply in order
  const sorted = [...strokes].sort((a, b) => a.timestamp - b.timestamp);

  for (const stroke of sorted) {
    const layerIndex = MATERIAL_LAYER_INDEX[stroke.targetMaterial] ?? 0;

    for (let i = 0; i < positions.count; i++) {
      const worldX = tileWorldX + positions.getX(i);
      const worldZ = tileWorldZ + positions.getZ(i);

      const dx = worldX - stroke.center.x;
      const dz = worldZ - stroke.center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= stroke.radius) continue;

      const inf =
        brushInfluence(dist, stroke.radius, stroke.falloff) * stroke.strength;
      if (inf <= 0.001) continue;

      const i4 = i * 4;
      const w = [
        mw0[i4],
        mw0[i4 + 1],
        mw0[i4 + 2],
        mw0[i4 + 3],
        mw1[i4],
        mw1[i4 + 1],
        mw1[i4 + 2],
        mw1[i4 + 3],
      ];

      const oldTarget = w[layerIndex];
      const newTarget = Math.min(1, oldTarget + inf);
      const added = newTarget - oldTarget;
      w[layerIndex] = newTarget;

      const othersSum = 1 - oldTarget;
      if (othersSum > 0.001) {
        const scale = Math.max(0, 1 - added / othersSum);
        for (let j = 0; j < 8; j++) {
          if (j !== layerIndex) w[j] *= scale;
        }
      }

      let total = 0;
      for (let j = 0; j < 8; j++) total += w[j];
      if (total > 0) {
        const inv = 1 / total;
        for (let j = 0; j < 8; j++) w[j] *= inv;
      }

      mw0[i4] = w[0];
      mw0[i4 + 1] = w[1];
      mw0[i4 + 2] = w[2];
      mw0[i4 + 3] = w[3];
      mw1[i4] = w[4];
      mw1[i4 + 1] = w[5];
      mw1[i4 + 2] = w[6];
      mw1[i4 + 3] = w[7];
    }
  }

  mw0Attr.needsUpdate = true;
  mw1Attr.needsUpdate = true;
}

/**
 * Re-apply brush sculpt strokes to a freshly-generated tile geometry.
 *
 * Convenience wrapper around `applySculptStrokesToGeometry` that
 * absorbs the two-line tile-world-offset calculation duplicated
 * across `generateTile` and `swapTileResolution` in
 * `TileBasedTerrain.tsx`. Both call sites had byte-identical
 * setup:
 *
 *   const sculpts = brushOverlaysRef.current?.terrainSculpts;
 *   if (sculpts && sculpts.length > 0) {
 *     const halfTileOffset = tileSize / 2;
 *     applySculptStrokesToGeometry(
 *       geometry,
 *       tileX * tileSize + halfTileOffset,
 *       tileZ * tileSize + halfTileOffset,
 *       sculpts,
 *     );
 *   }
 *
 * After: one call to `reapplyTileSculpts(geometry, tileX, tileZ, tileSize, sculpts)`.
 * No-op when `strokes` is `undefined` / empty so callers can pass the
 * ref's `?.terrainSculpts` directly without guarding.
 */
export function reapplyTileSculpts(
  geometry: THREE.BufferGeometry,
  tileX: number,
  tileZ: number,
  tileSize: number,
  strokes: ReadonlyArray<TerrainSculptStroke> | undefined,
): boolean {
  if (!strokes || strokes.length === 0) return false;
  const halfTileOffset = tileSize / 2;
  return applySculptStrokesToGeometry(
    geometry,
    tileX * tileSize + halfTileOffset,
    tileZ * tileSize + halfTileOffset,
    strokes as TerrainSculptStroke[],
  );
}
