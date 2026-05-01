/**
 * editorMarkers — Pure Three.js marker factories for world editor entities
 *
 * Extracted from useEditorWorldSync. All geometry/material creation and
 * marker lifecycle logic lives here. The hook retains only React state
 * management (useEffect, useRef, useCallback) and delegates scene mutations
 * to these factory/disposal functions.
 */

import * as THREE from "three/webgpu";
import {
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
  LineBasicNodeMaterial,
  SpriteNodeMaterial,
} from "three/webgpu";

import {
  getNpcModel,
  getStationModel,
  getOreModel,
  getTreeSpeciesInstance,
} from "../../WorldBuilder/GameWorldAssets";
import { MaterialPool } from "./MaterialPool";
import {
  queueDisposal,
  stageAddition,
  cancelStagedAdditions,
  cancelStagedObject,
} from "./deferredGpuDisposal";
import {
  getCachedAssetRefModel,
  loadAssetRefModelOnce,
} from "./assetRefModelLoader";

import type { TerrainSceneRefs } from "../../WorldBuilder/TileBasedTerrain";
import type {
  ExtendedWorldLayers,
  ActivePlacement,
  AudioLayers,
  PlacedNPC,
  PlacedSpawnPoint,
  PlacedTeleport,
  PlacedMobSpawn,
  PlacedResource,
  PlacedStation,
  PlacedPOI,
  PlacedWaterBody,
  PlacedDangerSource,
} from "../types";
import type { EntityTypeRegistry } from "../../../gameModules/EntityTypeRegistry";
import type { MarkerConfig } from "../../../gameModules/GameModule";

// ============== MARKER COLORS ==============

export const MARKER_COLORS = {
  npc: 0xa855f7, // purple
  spawnPoint: 0x22c55e, // green
  teleport: 0x8b5cf6, // violet
  mobSpawn: 0xef4444, // red
  resource: 0x3b82f6, // blue
  station: 0xf59e0b, // amber
  poi: 0xec4899, // pink
  waterBody: 0x06b6d4, // cyan
  dangerSource: 0xe54545, // danger red
  ghost: 0xffffff, // white (translucent)
} as const;

export type MarkerType = keyof typeof MARKER_COLORS;

// ============== GEOMETRY CACHE ==============

const MARKER_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();

export function getMarkerGeometry(type: string): THREE.BufferGeometry {
  let geo = MARKER_GEOMETRY_CACHE.get(type);
  if (geo) return geo;

  switch (type) {
    case "npc": {
      // Capsule-like figure: body cylinder + head sphere
      const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
      bodyGeo.translate(0, 0.6, 0);
      const headGeo = new THREE.SphereGeometry(0.25, 8, 6);
      headGeo.translate(0, 1.45, 0);
      const merged = new THREE.BufferGeometry();
      // Merge body + head
      const bodyPos = bodyGeo.getAttribute("position");
      const headPos = headGeo.getAttribute("position");
      const positions = new Float32Array(bodyPos.count * 3 + headPos.count * 3);
      for (let i = 0; i < bodyPos.count * 3; i++)
        positions[i] = (bodyPos.array as Float32Array)[i];
      for (let i = 0; i < headPos.count * 3; i++)
        positions[bodyPos.count * 3 + i] = (headPos.array as Float32Array)[i];
      merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      // Merge indices
      const bodyIdx = bodyGeo.getIndex()!;
      const headIdx = headGeo.getIndex()!;
      const indices = new Uint16Array(bodyIdx.count + headIdx.count);
      for (let i = 0; i < bodyIdx.count; i++)
        indices[i] = (bodyIdx.array as Uint16Array)[i];
      for (let i = 0; i < headIdx.count; i++)
        indices[bodyIdx.count + i] =
          (headIdx.array as Uint16Array)[i] + bodyPos.count;
      merged.setIndex(new THREE.BufferAttribute(indices, 1));
      merged.computeVertexNormals();
      bodyGeo.dispose();
      headGeo.dispose();
      geo = merged;
      break;
    }
    case "spawnPoint":
      geo = new THREE.ConeGeometry(0.6, 1.5, 6);
      geo.translate(0, 0.75, 0);
      break;
    case "teleport":
      geo = new THREE.TorusGeometry(0.8, 0.15, 8, 16);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0.3, 0);
      break;
    case "mobSpawn":
      geo = new THREE.SphereGeometry(0.7, 8, 6);
      geo.translate(0, 0.7, 0);
      break;
    case "resource":
      geo = new THREE.OctahedronGeometry(0.6);
      geo.translate(0, 0.6, 0);
      break;
    case "station":
      geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      break;
    case "poi":
      geo = new THREE.DodecahedronGeometry(0.7);
      geo.translate(0, 0.7, 0);
      break;
    case "waterBody":
      geo = new THREE.CylinderGeometry(0.8, 0.8, 0.3, 12);
      geo.translate(0, 0.15, 0);
      break;
    case "dangerSource":
      // Upward-pointing tetrahedron with warning feel
      geo = new THREE.TetrahedronGeometry(0.8);
      geo.translate(0, 0.8, 0);
      break;
    default:
      geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      geo.translate(0, 0.25, 0);
  }

  MARKER_GEOMETRY_CACHE.set(type, geo);
  return geo;
}

/**
 * Get marker geometry from a GameModule MarkerConfig.
 * Falls back to the type-based cache when possible, otherwise creates a new geometry.
 */
export function getMarkerGeometryFromConfig(
  config: MarkerConfig,
): THREE.BufferGeometry {
  const scale = config.scale ?? 1;
  const yOffset = config.yOffset ?? 0;
  let geo: THREE.BufferGeometry;

  switch (config.shape) {
    case "capsule":
      geo = new THREE.CapsuleGeometry(0.3 * scale, 0.8 * scale, 4, 8);
      geo.translate(0, 0.7 * scale + yOffset, 0);
      break;
    case "cylinder":
      geo = new THREE.CylinderGeometry(
        0.4 * scale,
        0.4 * scale,
        1.2 * scale,
        8,
      );
      geo.translate(0, 0.6 * scale + yOffset, 0);
      break;
    case "sphere":
      geo = new THREE.SphereGeometry(0.5 * scale, 8, 6);
      geo.translate(0, 0.5 * scale + yOffset, 0);
      break;
    case "cube":
      geo = new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale);
      geo.translate(0, 0.4 * scale + yOffset, 0);
      break;
    case "billboard":
      geo = new THREE.PlaneGeometry(0.8 * scale, 0.8 * scale);
      geo.translate(0, 1.0 * scale + yOffset, 0);
      break;
    default:
      geo = new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.5 * scale);
      geo.translate(0, 0.25 * scale + yOffset, 0);
  }

  return geo;
}

/**
 * Get marker color for an entity type. Uses hardcoded MARKER_COLORS first,
 * falls back to registry schema color, then defaults to gray.
 */
export function getMarkerColor(
  type: string,
  registry?: EntityTypeRegistry,
): number {
  if (MARKER_COLORS[type as MarkerType])
    return MARKER_COLORS[type as MarkerType];
  if (registry) {
    const schema = registry.get(type) ?? registry.getBySelectionType(type);
    if (schema) {
      return parseInt(schema.color.replace("#", ""), 16) || 0x888888;
    }
  }
  return 0x888888;
}

/** Dispose all cached marker geometries (call on hook unmount) */
export function disposeMarkerGeometryCache(): void {
  for (const [, geo] of MARKER_GEOMETRY_CACHE) {
    queueDisposal(geo);
  }
  MARKER_GEOMETRY_CACHE.clear();
}

// ============== MARKER MESH CREATION ==============

export function createMarkerMesh(
  type: MarkerType,
  position: { x: number; y: number; z: number },
  rotation: number = 0,
  pool?: MaterialPool,
): THREE.Mesh {
  const geo = getMarkerGeometry(type);
  // Use pooled material when available — one GPU material per marker type
  // instead of one per entity (reduces allocation from N to ~9)
  const mat = pool
    ? pool.acquireMarker(type, MARKER_COLORS[type])
    : createFallbackMarkerMaterial(type);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.name = `marker-${type}`;
  // Track whether material is pooled (shared) so we don't dispose it individually
  mesh.userData._pooledMaterial = !!pool;
  return mesh;
}

function createFallbackMarkerMaterial(
  type: MarkerType,
): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial();
  mat.color = new THREE.Color(MARKER_COLORS[type]);
  mat.emissive = new THREE.Color(MARKER_COLORS[type]);
  mat.emissiveIntensity = 0.3;
  mat.roughness = 0.7;
  mat.metalness = 0.2;
  return mat;
}

// ============== REAL MODEL LOADING ==============

/**
 * Try to load the actual 3D model for an entity from GameWorldAssets cache.
 * Returns a THREE.Group containing cloned model meshes, or null if no model is available.
 */
export function tryLoadEntityModel(
  category: string,
  templateId: string,
  opts?: { ghost?: boolean; cloneTracker?: Set<THREE.Material> },
): THREE.Group | null {
  let modelData: {
    parts: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>;
    scale?: number;
    yOffset?: number;
    manifestScale?: number;
  } | null = null;

  if (category === "npcs" || category === "npc") {
    modelData = getNpcModel(templateId);
  } else if (category === "stations" || category === "station") {
    modelData = getStationModel(templateId);
  } else if (category === "resources-mining" || category === "resource") {
    modelData = getOreModel(templateId);
  } else if (category === "resources-woodcutting") {
    const tree = getTreeSpeciesInstance(templateId);
    if (tree) {
      modelData = {
        parts: tree.parts,
        scale: tree.manifestScale,
        yOffset: 0,
      };
    }
  } else if (category === "mob-spawns" || category === "mobSpawn") {
    // Mob spawns reference an NPC model
    modelData = getNpcModel(templateId);
  }

  if (!modelData || modelData.parts.length === 0) return null;

  const group = new THREE.Group();
  const scale =
    modelData.scale ??
    (modelData as { manifestScale?: number }).manifestScale ??
    1;

  for (const part of modelData.parts) {
    let mat: THREE.Material;
    if (opts?.ghost) {
      // Ghost: clone material, make translucent
      mat = part.material.clone();
      (mat as THREE.MeshStandardMaterial).transparent = true;
      (mat as THREE.MeshStandardMaterial).opacity = 0.45;
      mat.depthWrite = false;
      // Track clone for comprehensive disposal
      opts.cloneTracker?.add(mat);
    } else {
      mat = part.material;
    }
    const mesh = new THREE.Mesh(part.geometry, mat);
    mesh.castShadow = !opts?.ghost;
    group.add(mesh);
  }

  group.scale.setScalar(scale);
  if (modelData.yOffset) group.position.y = modelData.yOffset;

  return group;
}

/**
 * Compute the Y offset needed to sit a model's bottom on the ground plane.
 * Returns 0 when no model is available (abstract markers have geometry pre-translated above y=0).
 */
export function getPlacementYOffset(
  category: string,
  templateId: string,
): number {
  const group = tryLoadEntityModel(category, templateId);
  if (!group) return 0;
  const bbox = new THREE.Box3().setFromObject(group);
  return Math.max(0, -bbox.min.y);
}

// ============== GHOST PREVIEW ==============

export function categoryToMarkerType(category: string): string {
  if (category === "npcs") return "npc";
  if (category.startsWith("resources-")) return "resource";
  if (category === "mob-spawns") return "mobSpawn";
  if (category === "spawn-points") return "spawnPoint";
  if (category === "water-bodies") return "waterBody";
  if (category === "danger-sources") return "dangerSource";
  if (category === "pois") return "poi";
  return category.replace(/-/g, "");
}

/**
 * Create the ghost preview for placement. Tries to use the real 3D model
 * from GameWorldAssets cache (translucent). Falls back to an abstract marker shape.
 */
export function createGhostObject(
  category: string,
  templateId: string,
  position: { x: number; y: number; z: number },
  rotation: number = 0,
  cloneTracker?: Set<THREE.Material>,
): THREE.Object3D {
  // Try real model first — pass clone tracker for disposal tracking
  const modelGroup = tryLoadEntityModel(category, templateId, {
    ghost: true,
    cloneTracker,
  });
  if (modelGroup) {
    // Mark cloned materials for cleanup
    modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData._ghostClone = true;
    });

    // Compute bbox offset so model bottom sits on terrain surface (not half buried)
    const bbox = new THREE.Box3().setFromObject(modelGroup);
    const bottomOffset = Math.max(0, -bbox.min.y);
    modelGroup.position.set(position.x, position.y + bottomOffset, position.z);
    modelGroup.rotation.y = rotation;
    modelGroup.name = "placement-ghost";
    modelGroup.userData.bottomOffset = bottomOffset;
    return modelGroup;
  }

  // Fallback: abstract marker shape
  const markerType = categoryToMarkerType(category);
  const geo = getMarkerGeometry(markerType);
  const mat = new MeshStandardNodeMaterial();
  mat.color = new THREE.Color(
    MARKER_COLORS[markerType as MarkerType] ?? 0xffffff,
  );
  mat.emissive = new THREE.Color(
    MARKER_COLORS[markerType as MarkerType] ?? 0xffffff,
  );
  mat.emissiveIntensity = 0.5;
  mat.transparent = true;
  mat.opacity = 0.6;
  mat.depthWrite = false;
  cloneTracker?.add(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.y = rotation;
  mesh.name = "placement-ghost";
  mesh.userData._fallbackGhost = true;
  return mesh;
}

// ============== LABEL SPRITES ==============

export function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 24px sans-serif";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.strokeText(text, 128, 40);
  ctx.fillText(text, 128, 40);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new SpriteNodeMaterial();
  mat.map = texture;
  mat.depthTest = false;
  mat.transparent = true;
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.5, 0.375, 1);
  sprite.position.y = 1.5;
  // UE5 style: labels hidden by default, shown on hover/selection
  sprite.visible = false;
  sprite.userData.isLabel = true;
  sprite.userData.labelAspect = 256 / 64; // cached for screen-space sizing
  return sprite;
}

// ============== MANAGED MARKERS ==============

export interface ManagedMarker {
  id: string;
  type: string;
  mesh: THREE.Mesh | null; // null when using real model
  label: THREE.Sprite;
  group: THREE.Group;
  hasRealModel: boolean;
}

export interface SyncState {
  markers: Map<string, ManagedMarker>;
  ghostObject: THREE.Object3D | null;
  ghostCategory: string | null;
  ghostTemplateId: string | null;
  boundaryRing: THREE.Mesh | null;
  connectionLines: THREE.Group | null;
  /** Tracks all ghost-cloned materials for comprehensive disposal */
  ghostClones: Set<THREE.Material>;
  materialPool: MaterialPool;
  disposed: boolean;
}

export function createInitialSyncState(): SyncState {
  return {
    markers: new Map(),
    ghostObject: null,
    ghostCategory: null,
    ghostTemplateId: null,
    boundaryRing: null,
    connectionLines: null,
    ghostClones: new Set(),
    materialPool: new MaterialPool(),
    disposed: false,
  };
}

// ============== DISPOSE MODEL GROUP ==============

/**
 * Dispose all children of a model group (cloned ghost materials).
 * Optionally removes disposed materials from a tracking set.
 */
export function disposeModelGroup(
  group: THREE.Group,
  cloneTracker?: Set<THREE.Material>,
): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Only dispose material if it's a ghost clone (not the cached original)
      if (child.userData._ghostClone) {
        const mat = child.material as THREE.Material;
        queueDisposal(mat);
        cloneTracker?.delete(mat);
      }
    }
  });
}

// ============== GHOST DISPOSAL ==============

/** Dispose a ghost object (handles both model groups and fallback meshes) */
export function disposeGhostObject(
  ghost: THREE.Object3D,
  overlay: THREE.Group,
  ghostClones: Set<THREE.Material>,
): void {
  overlay.remove(ghost);
  if (ghost instanceof THREE.Group) {
    disposeModelGroup(ghost, ghostClones);
  } else if (ghost instanceof THREE.Mesh) {
    if (ghost.userData._fallbackGhost) {
      const mat = ghost.material as THREE.Material;
      queueDisposal(mat);
      ghostClones.delete(mat);
    }
  }
}

// ============== SYNC EXTENDED LAYERS ==============

/** State keys handled by the hardcoded sync passes below. */
const HANDLED_STATE_KEYS = new Set([
  "npcs",
  "spawnPoints",
  "teleports",
  "mobSpawns",
  "resources",
  "stations",
  "pois",
  "waterBodies",
  "dangerSources",
  "mines",
  "customAssets",
  "regions",
  "wildernessBoundary",
]);

/**
 * Diff extended layers state against current markers and create/remove as needed.
 * Pure scene-graph mutation — no React state involved.
 */
export function syncExtendedLayers(
  layers: ExtendedWorldLayers,
  sync: SyncState,
  refs: TerrainSceneRefs,
  registry?: EntityTypeRegistry,
  audioLayers?: AudioLayers,
): void {
  if (sync.disposed) return;

  const overlay = refs.entityOverlay;
  const activeIds = new Set<string>();

  // Helper: add or update a marker. Tries to use real 3D models from cache.
  const upsertMarker = (
    id: string,
    type: MarkerType,
    name: string,
    position: { x: number; y: number; z: number },
    rotation: number = 0,
    modelCategory?: string,
    templateId?: string,
    /**
     * Pack-aware asset reference (`<packId>/<entryId>`). When
     * provided, takes priority over `modelCategory`/`templateId`
     * — placements with an `assetRef` resolve through the asset
     * pack pipeline (`assetRefResolver` → `loadModelForScene`)
     * instead of the Hyperia-only `tryLoadEntityModel` cache.
     * Async load is fire-and-forget; the marker first renders
     * with its abstract fallback and the real model swaps in
     * when the load resolves.
     */
    assetRef?: string,
  ) => {
    activeIds.add(id);
    const existing = sync.markers.get(id);
    if (existing) {
      existing.group.position.set(position.x, position.y, position.z);
      existing.group.rotation.y = rotation;
    } else {
      const label = createLabelSprite(name);
      const group = new THREE.Group();

      // Try real model first
      let mesh: THREE.Mesh | null = null;
      let hasRealModel = false;

      // Pack-aware path takes priority. If the assetRef is already
      // cached, clone + add immediately. If it's a known-failed
      // entry (cached as null), skip pack path silently and fall
      // through to the legacy/abstract paths. If we haven't tried
      // it yet (cache miss), kick off the async load and queue a
      // post-load swap-in so the marker upgrades from abstract to
      // real once the GLB lands.
      if (assetRef) {
        const cached = getCachedAssetRefModel(assetRef);
        if (cached) {
          group.add(cached.clone(true));
          hasRealModel = true;
        } else if (cached === undefined) {
          void loadAssetRefModelOnce(assetRef).then((loaded) => {
            if (sync.disposed || !loaded) return;
            const marker = sync.markers.get(id);
            if (!marker) return;
            // Strip the abstract fallback if present, then graft
            // the loaded model in. Keep the label; it lives at
            // the group level.
            if (marker.mesh) {
              marker.group.remove(marker.mesh);
              queueDisposal(marker.mesh.geometry);
              // Material is owned by the shared MaterialPool —
              // do NOT dispose it here.
              marker.mesh = null;
            }
            marker.group.add(loaded.clone(true));
            marker.hasRealModel = true;
            // Auto-gen markers were scaled 5x for visibility; un-scale
            // now that they have a real model.
            if (id.startsWith("autogen-")) marker.group.scale.setScalar(1);
          });
        }
      }

      // Legacy Hyperia-cache path — only when the pack-aware path
      // didn't already produce a real model AND no assetRef was
      // declared (an entity with assetRef has opted in to the
      // pack-aware path; we don't second-guess by also probing
      // Hyperia caches with a templateId that may belong to a
      // different game).
      if (!hasRealModel && !assetRef && modelCategory && templateId) {
        const modelGroup = tryLoadEntityModel(modelCategory, templateId);
        if (modelGroup) {
          group.add(modelGroup);
          hasRealModel = true;
        }
      }

      // Fallback: abstract colored marker — material from pool (shared)
      if (!hasRealModel) {
        mesh = createMarkerMesh(
          type,
          { x: 0, y: 0, z: 0 },
          0,
          sync.materialPool,
        );
        group.add(mesh);
      }

      group.add(label);
      group.position.set(position.x, position.y, position.z);
      group.rotation.y = rotation;
      group.name = `entity-${type}-${id}`;
      // Auto-gen fallback markers: scale up so they're visible from zone-overview distance.
      // Real 3D models already have proper scale — don't inflate them.
      if (id.startsWith("autogen-") && !hasRealModel) {
        group.scale.setScalar(5);
      }

      // Store entity info for selection routing
      // isExtendedLayer distinguishes editor-placed entities from game manifest entities
      const selectData = {
        selectable: true,
        selectableType: "entity" as const,
        selectableId: id,
        entityType: type,
        entityId: id,
        isExtendedLayer: true,
      };
      group.userData = selectData;
      // Propagate to all mesh children for raycast hit detection
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.userData = { ...selectData };
      });

      // Stage the group addition — GPU buffers created gradually, not all at once.
      // Register as selectable in the onAdd callback so it's queryable once visible.
      stageAddition(group, overlay, () => {
        refs.addSelectable(group);
      });

      sync.markers.set(id, { id, type, mesh, label, group, hasRealModel });
    }
  };

  // assetRef lives on `properties.assetRef` since it's an
  // optional manifest field carried alongside type-specific data.
  const refOf = (p: { properties?: Record<string, unknown> }) => {
    const raw = p.properties?.assetRef;
    return typeof raw === "string" ? raw : undefined;
  };

  // NPCs — pack-aware ref → falls back to Hyperia npc cache
  layers.npcs.forEach((npc: PlacedNPC) => {
    upsertMarker(
      npc.id,
      "npc",
      npc.name,
      npc.position,
      npc.rotation,
      "npcs",
      npc.npcTypeId,
      refOf(npc),
    );
  });

  // Spawn points (no model — abstract marker)
  layers.spawnPoints.forEach((sp: PlacedSpawnPoint) => {
    upsertMarker(sp.id, "spawnPoint", sp.name, sp.position, sp.rotation);
  });

  // Teleports — pack-aware ref → no Hyperia fallback (teleports have no
  // canonical model in the legacy cache)
  layers.teleports.forEach((tp: PlacedTeleport) => {
    upsertMarker(
      tp.id,
      "teleport",
      tp.name,
      tp.position,
      0,
      undefined,
      undefined,
      refOf(tp),
    );
  });

  // Mob spawns — pack-aware ref → falls back to Hyperia mob cache
  layers.mobSpawns.forEach((ms: PlacedMobSpawn) => {
    upsertMarker(
      ms.id,
      "mobSpawn",
      ms.name,
      ms.position,
      0,
      "mob-spawns",
      ms.mobId,
      refOf(ms),
    );
  });

  // Resources — pack-aware ref → falls back to Hyperia resource cache
  layers.resources.forEach((r: PlacedResource) => {
    const resCat =
      r.resourceType === "mining"
        ? "resources-mining"
        : r.resourceType === "woodcutting"
          ? "resources-woodcutting"
          : "resource";
    upsertMarker(
      r.id,
      "resource",
      r.name,
      r.position,
      r.rotation,
      resCat,
      r.resourceId,
      refOf(r),
    );
  });

  // Stations — pack-aware ref → falls back to Hyperia station cache
  layers.stations.forEach((s: PlacedStation) => {
    upsertMarker(
      s.id,
      "station",
      s.name,
      s.position,
      s.rotation,
      "stations",
      s.stationType,
      refOf(s),
    );
  });

  // POIs — pack-aware ref → no Hyperia fallback
  layers.pois.forEach((p: PlacedPOI) => {
    upsertMarker(
      p.id,
      "poi",
      p.name,
      p.position,
      0,
      undefined,
      undefined,
      refOf(p),
    );
  });

  // Water Bodies (no model — abstract marker)
  layers.waterBodies.forEach((w: PlacedWaterBody) => {
    const pos = w.waypoints?.[0]
      ? { x: w.waypoints[0].x, y: 0, z: w.waypoints[0].z }
      : { x: 0, y: 0, z: 0 };
    upsertMarker(w.id, "waterBody", w.name, pos);
  });

  // Danger Sources (no assetRef on local Placed type — abstract marker)
  layers.dangerSources.forEach((ds: PlacedDangerSource) => {
    upsertMarker(ds.id, "dangerSource", ds.name, ds.position);
  });

  // Generic sync pass: iterate all registry entity types not handled above
  if (registry) {
    for (const schema of registry.getAll()) {
      if (HANDLED_STATE_KEYS.has(schema.storage.stateKey)) continue;
      if (!schema.spatial) continue;

      const root =
        schema.storage.stateRoot === "audioLayers" ? audioLayers : layers;
      if (!root) continue;

      const arr = (root as Record<string, unknown>)[schema.storage.stateKey] as
        | Array<{
            id: string;
            name?: string;
            position?: { x: number; y: number; z: number };
            rotation?: number;
          }>
        | undefined;
      if (!Array.isArray(arr)) continue;

      const color = parseInt(schema.color.replace("#", ""), 16) || 0x888888;
      for (const entity of arr) {
        if (!entity.position) continue;
        activeIds.add(entity.id);
        const existing = sync.markers.get(entity.id);
        if (existing) {
          existing.group.position.set(
            entity.position.x,
            entity.position.y,
            entity.position.z,
          );
          if (entity.rotation != null)
            existing.group.rotation.y = entity.rotation;
        } else {
          const label = createLabelSprite(entity.name ?? schema.name);
          const group = new THREE.Group();

          // Create marker from schema config
          const geo = getMarkerGeometryFromConfig(schema.marker);
          const mat = new MeshStandardNodeMaterial();
          mat.color = new THREE.Color(color);
          mat.emissive = new THREE.Color(color);
          mat.emissiveIntensity = 0.3;
          mat.roughness = 0.7;
          mat.metalness = 0.2;
          const mesh = new THREE.Mesh(geo, mat);
          group.add(mesh);
          group.add(label);
          group.position.set(
            entity.position.x,
            entity.position.y,
            entity.position.z,
          );
          if (entity.rotation != null) group.rotation.y = entity.rotation;
          group.name = `entity-${schema.selectionType}-${entity.id}`;

          const selectData = {
            selectable: true,
            selectableType: "entity" as const,
            selectableId: entity.id,
            entityType: schema.selectionType,
            entityId: entity.id,
            isExtendedLayer: true,
          };
          group.userData = selectData;
          group.traverse((child) => {
            if (child instanceof THREE.Mesh) child.userData = { ...selectData };
          });

          stageAddition(group, overlay, () => {
            refs.addSelectable(group);
          });

          sync.markers.set(entity.id, {
            id: entity.id,
            type: schema.selectionType,
            mesh,
            label,
            group,
            hasRealModel: false,
          });
        }
      }
    }
  }

  // Teleport network connection lines
  syncTeleportLines(layers, sync, refs);

  // Remove markers that no longer exist in state
  removeStaleMarkers(activeIds, sync, refs);
}

// ============== TELEPORT LINES ==============

function syncTeleportLines(
  layers: ExtendedWorldLayers,
  sync: SyncState,
  refs: TerrainSceneRefs,
): void {
  if (sync.connectionLines) {
    cancelStagedAdditions(sync.connectionLines);
    refs.scene.remove(sync.connectionLines);
    // Dispose geometries per line; material is shared — dispose once
    let sharedMat: THREE.Material | null = null;
    sync.connectionLines.traverse((child) => {
      if (child instanceof THREE.Line) {
        queueDisposal(child.geometry);
        if (!sharedMat) sharedMat = child.material as THREE.Material;
      }
    });
    if (sharedMat) queueDisposal(sharedMat);
    sync.connectionLines = null;
  }

  const lineGroup = new THREE.Group();
  lineGroup.name = "teleport-connections";
  const drawnPairs = new Set<string>();
  // Shared material instance — all teleport lines look the same,
  // no need for separate GPU pipeline per connection
  const lineMat = new LineBasicNodeMaterial();
  lineMat.color = new THREE.Color(0x8b5cf6);
  lineMat.transparent = true;
  lineMat.opacity = 0.6;
  lineMat.depthWrite = false;

  for (const tp of layers.teleports) {
    for (const connId of tp.connections) {
      const pairKey =
        tp.id < connId ? `${tp.id}:${connId}` : `${connId}:${tp.id}`;
      if (drawnPairs.has(pairKey)) continue;
      drawnPairs.add(pairKey);

      const target = layers.teleports.find((t) => t.id === connId);
      if (!target) continue;

      const points = [
        new THREE.Vector3(tp.position.x, tp.position.y + 1, tp.position.z),
        new THREE.Vector3(
          target.position.x,
          target.position.y + 1,
          target.position.z,
        ),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMat);
      line.renderOrder = 998;
      lineGroup.add(line);
    }
  }

  if (lineGroup.children.length > 0) {
    // Stage children — each line gets its GPU buffer created gradually
    refs.scene.add(lineGroup);
    const lineChildren = [...lineGroup.children];
    lineGroup.clear();
    for (const child of lineChildren) {
      stageAddition(child, lineGroup);
    }
    sync.connectionLines = lineGroup;
  }
}

// ============== STALE MARKER REMOVAL ==============

function removeStaleMarkers(
  activeIds: Set<string>,
  sync: SyncState,
  refs: TerrainSceneRefs,
): void {
  const overlay = refs.entityOverlay;
  let removedCount = 0;

  for (const [id, marker] of sync.markers) {
    if (!activeIds.has(id)) {
      // Cancel any pending staged addition for this specific marker group.
      // Uses cancelStagedObject (matches by object) rather than
      // cancelStagedAdditions (matches by parent) — the latter would
      // cancel ALL pending marker additions to the overlay.
      cancelStagedObject(marker.group);
      overlay.remove(marker.group);
      refs.removeSelectable(marker.group);
      // Only dispose the abstract marker mesh material if it's NOT pooled.
      // Pooled materials are shared across all markers of the same type
      // and disposed when the pool itself is disposed (on hook unmount).
      if (marker.mesh) {
        if (!marker.mesh.userData._pooledMaterial) {
          queueDisposal(marker.mesh.material as THREE.Material);
        } else {
          sync.materialPool.releaseMarker(marker.type);
        }
      }
      const labelMat = marker.label.material as THREE.SpriteMaterial;
      if (labelMat.map) queueDisposal(labelMat.map);
      queueDisposal(labelMat);
      sync.markers.delete(id);
      removedCount++;
    }
  }

  const newCount = activeIds.size - (sync.markers.size - removedCount);
  if (newCount > 0 || removedCount > 0) {
    console.log(
      `[GPU-DEBUG] entity-sync: created=${newCount > 0 ? newCount : 0} removed=${removedCount} total=${sync.markers.size}`,
    );
  }
}

// ============== GHOST SYNC ==============

/**
 * Sync ghost placement preview — creates/updates/removes the ghost object.
 * Returns updated ghost state fields to write back to SyncState.
 */
export function syncGhostPlacement(
  placement: ActivePlacement | null,
  sync: SyncState,
  refs: TerrainSceneRefs,
): void {
  // No placement or confirmed → remove ghost
  if (!placement || placement.confirmed) {
    if (sync.ghostObject) {
      disposeGhostObject(
        sync.ghostObject,
        refs.entityOverlay,
        sync.ghostClones,
      );
      sync.ghostObject = null;
      sync.ghostCategory = null;
      sync.ghostTemplateId = null;
    }
    return;
  }

  // Don't show ghost until first real mouse position (avoids flash at origin)
  const pos = placement.position;
  if (pos.x === 0 && pos.y === 0 && pos.z === 0) return;

  // Reuse existing ghost if same template — just update transform
  if (
    sync.ghostObject &&
    sync.ghostCategory === placement.category &&
    sync.ghostTemplateId === placement.templateId
  ) {
    const offset = sync.ghostObject.userData.bottomOffset ?? 0;
    sync.ghostObject.position.set(pos.x, pos.y + offset, pos.z);
    sync.ghostObject.rotation.y = placement.rotation;
    return;
  }

  // Template or category changed — dispose old, create new
  if (sync.ghostObject) {
    disposeGhostObject(sync.ghostObject, refs.entityOverlay, sync.ghostClones);
  }

  const ghost = createGhostObject(
    placement.category,
    placement.templateId,
    pos,
    placement.rotation,
    sync.ghostClones,
  );
  refs.entityOverlay.add(ghost);
  sync.ghostObject = ghost;
  sync.ghostCategory = placement.category;
  sync.ghostTemplateId = placement.templateId;
}

// ============== BOUNDARY RING ==============

/**
 * Create or update the world boundary ring visualization.
 * Returns the new ring mesh, or null if ring is not needed.
 */
export function syncBoundaryRing(
  sync: SyncState,
  refs: TerrainSceneRefs,
  islandConfig: { maxWorldSizeTiles: number } | null,
  tileSize: number,
): void {
  // Remove existing ring
  if (sync.boundaryRing) {
    refs.scene.remove(sync.boundaryRing);
    queueDisposal(sync.boundaryRing.geometry);
    queueDisposal(sync.boundaryRing.material as THREE.Material);
    sync.boundaryRing = null;
  }

  if (!islandConfig) return;

  const boundaryRadius = (islandConfig.maxWorldSizeTiles * tileSize) / 2;

  const ringGeo = new THREE.RingGeometry(
    boundaryRadius - 5,
    boundaryRadius + 5,
    128,
  );
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new MeshBasicNodeMaterial();
  ringMat.color = new THREE.Color(0xff4444);
  ringMat.transparent = true;
  ringMat.opacity = 0.15;
  ringMat.side = THREE.DoubleSide;
  ringMat.depthWrite = false;
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 1;
  ring.name = "world-boundary-ring";
  ring.renderOrder = 999;
  refs.scene.add(ring);
  sync.boundaryRing = ring;
}

// ============== FULL CLEANUP ==============

/** Dispose all sync state resources. Call on hook unmount. */
export function disposeSyncState(
  sync: SyncState,
  refs: TerrainSceneRefs | null,
): void {
  sync.disposed = true;
  if (!refs) return;

  for (const [, marker] of sync.markers) {
    refs.entityOverlay.remove(marker.group);
    refs.removeSelectable(marker.group);
    if (marker.mesh) {
      // Skip pooled materials — pool.dispose() handles them below
      if (!marker.mesh.userData._pooledMaterial) {
        queueDisposal(marker.mesh.material as THREE.Material);
      }
    }
    const labelMat = marker.label.material as THREE.SpriteMaterial;
    if (labelMat.map) queueDisposal(labelMat.map);
    queueDisposal(labelMat);
  }
  sync.markers.clear();

  if (sync.ghostObject) {
    refs.entityOverlay.remove(sync.ghostObject);
    if (sync.ghostObject instanceof THREE.Group) {
      disposeModelGroup(sync.ghostObject);
    } else if (
      sync.ghostObject instanceof THREE.Mesh &&
      sync.ghostObject.userData._fallbackGhost
    ) {
      queueDisposal(sync.ghostObject.material as THREE.Material);
    }
    sync.ghostObject = null;
  }

  // Dispose any remaining tracked ghost clone materials
  for (const mat of sync.ghostClones) {
    queueDisposal(mat);
  }
  sync.ghostClones.clear();

  if (sync.connectionLines) {
    refs.scene.remove(sync.connectionLines);
    let sharedLineMat: THREE.Material | null = null;
    sync.connectionLines.traverse((child) => {
      if (child instanceof THREE.Line) {
        queueDisposal(child.geometry);
        if (!sharedLineMat) sharedLineMat = child.material as THREE.Material;
      }
    });
    if (sharedLineMat) queueDisposal(sharedLineMat);
    sync.connectionLines = null;
  }

  // Dispose material pool — frees all shared marker materials
  // (pool.dispose is a batch operation but only ~9 materials total)
  sync.materialPool.dispose();

  // Dispose cached marker geometries — prevents accumulation across
  // mount/unmount cycles (these are module-level singletons)
  disposeMarkerGeometryCache();
}
