/**
 * useAgentEntityMarkers — render agent-emitted NPCs / mob spawns
 * as 3D markers in the viewport.
 *
 * Two visual modes per marker:
 *
 *   - Placeholder (default + always immediate): primary-tinted
 *     cube/icosahedron. Rendered synchronously the moment the
 *     entity arrives so there's never an empty hole in the world.
 *
 *   - Real model (when entity has `assetRef`): we resolve the ref
 *     to a `modelUrl` via the installed pack manifest, load the
 *     GLB, swap it in for the placeholder, and dispose the
 *     placeholder geometry + material. If resolution or load
 *     fails, the placeholder stays — UI never breaks.
 *
 * Lifecycle:
 *   - Listens to `useAgentWorldContent()`
 *   - On change, diffs: add new, update positions, remove deleted
 *   - On unmount or scene-refs change: dispose all markers
 *
 * Cube colors:
 *   - NPC      → primary purple (matches Sparkles brand color)
 *   - mobSpawn → ember orange (combat encounter)
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useAgentWorldContent } from "../state/agentWorldContent";
import type { TerrainSceneRefs } from "../../WorldBuilder/TileBasedTerrain";
import { resolveAssetRef } from "../../../utils/assetRefResolver";
import {
  disposeSubtree,
  loadModelForScene,
} from "../../../utils/loadModelForScene";

interface MarkerEntry {
  group: THREE.Group;
  /** Synchronous placeholder mesh; null after a real model swaps in. */
  placeholderMesh: THREE.Mesh | null;
  /** Material used by the placeholder. Disposed when the model swaps in. */
  placeholderMaterial: THREE.MeshBasicMaterial | null;
  /** Loaded GLB root once async resolution completes. */
  modelRoot: THREE.Object3D | null;
  label: THREE.Sprite;
  /** assetRef the marker is currently showing (or trying to show). */
  currentAssetRef: string | null;
  /**
   * Token bumped per assetRef change so stale async loads can
   * detect they're outdated and bail without mutating the marker.
   */
  loadGeneration: number;
}

const NPC_COLOR = 0x8b5cf6; // primary / purple
const SPAWN_COLOR = 0xf59e0b; // ember / amber
const RESOURCE_COLOR = 0x10b981; // emerald / gathering
const STATION_COLOR = 0x60a5fa; // sky / crafting
const TELEPORT_COLOR = 0xa855f7; // violet / waypoint

// Markers are 2× the natural entity size so they're unmissable
// against terrain even at default zoom — they're visualization
// proxies, not 1:1 game-render. The Hyperia world is large; a
// 0.8m cube vanishes from a few tens of meters away.
const NPC_GEOMETRY = new THREE.BoxGeometry(1.6, 3.2, 1.6);
const SPAWN_GEOMETRY = new THREE.IcosahedronGeometry(1.2, 0);
const RESOURCE_GEOMETRY = new THREE.ConeGeometry(1.0, 2.4, 6);
const STATION_GEOMETRY = new THREE.CylinderGeometry(1.2, 1.2, 1.6, 8);
const TELEPORT_GEOMETRY = new THREE.TorusGeometry(1.6, 0.4, 8, 24);

export function useAgentEntityMarkers(
  sceneRefs: TerrainSceneRefs | null,
): void {
  const agentWorldContent = useAgentWorldContent();
  const groupRef = useRef<THREE.Group | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());

  useEffect(() => {
    if (!sceneRefs?.entityOverlay) return;

    if (!groupRef.current) {
      const group = new THREE.Group();
      group.name = "agent-entity-markers";
      group.frustumCulled = false;
      group.renderOrder = 999;
      sceneRefs.entityOverlay.add(group);
      groupRef.current = group;
    }
    const parent = groupRef.current;

    // Snap a placement onto the terrain. The agent typically emits
    // `y: 0` (it has no terrain-height knowledge), so when y is at
    // or near 0 we sample the terrain at (x, z) and use that
    // instead — otherwise markers rendered on a +20m hill would be
    // 20m underground. When y is non-trivial (agent set it
    // explicitly, e.g. for floating teleport), we trust the
    // emission.
    const groundOf = (
      pos: { x: number; y: number; z: number } | null | undefined,
    ): { x: number; y: number; z: number } => {
      const x = pos?.x ?? 0;
      const z = pos?.z ?? 0;
      const yIn = pos?.y ?? 0;
      if (Math.abs(yIn) < 0.01) {
        const terrainY = sceneRefs.getTerrainHeight(x, z);
        return { x, y: terrainY, z };
      }
      return { x, y: yIn, z };
    };

    const liveIds = new Set<string>();

    // Diagnostic — surfaces "the AI told us about N things" so a
    // user staring at an empty viewport can confirm whether the
    // agent's emissions reached the store or not. Cheap; only logs
    // when the relevant maps are non-empty.
    const counts = {
      npcs: agentWorldContent.npcs.size,
      spawns: agentWorldContent.spawns.size,
      resources: agentWorldContent.resources.size,
      stations: agentWorldContent.stations.size,
      teleports: agentWorldContent.teleports.size,
    };
    const total =
      counts.npcs +
      counts.spawns +
      counts.resources +
      counts.stations +
      counts.teleports;
    if (total > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[useAgentEntityMarkers] rendering ${total} agent placements`,
        counts,
      );
    }

    // ---- NPCs ----
    for (const [id, npc] of agentWorldContent.npcs) {
      const fullId = `npc:${id}`;
      liveIds.add(fullId);
      const npcAssetRef = (npc as unknown as { assetRef?: unknown }).assetRef;
      const ref = typeof npcAssetRef === "string" ? npcAssetRef : null;
      upsertMarker(
        parent,
        markersRef.current,
        fullId,
        NPC_GEOMETRY,
        NPC_COLOR,
        groundOf(npc.position),
        npc.name ?? id,
        ref,
      );
    }

    // ---- Mob spawns ----
    for (const [key, spawn] of agentWorldContent.spawns) {
      const fullId = `spawn:${key}`;
      liveIds.add(fullId);
      const spawnAssetRef = (spawn as unknown as { assetRef?: unknown })
        .assetRef;
      const ref = typeof spawnAssetRef === "string" ? spawnAssetRef : null;
      upsertMarker(
        parent,
        markersRef.current,
        fullId,
        SPAWN_GEOMETRY,
        SPAWN_COLOR,
        groundOf(spawn.position),
        `${spawn.mobId} ×${spawn.maxCount}`,
        ref,
      );
    }

    // ---- Gathering resources ----
    for (const [key, resource] of agentWorldContent.resources) {
      const fullId = `resource:${key}`;
      liveIds.add(fullId);
      const resAssetRef = (resource as unknown as { assetRef?: unknown })
        .assetRef;
      const ref = typeof resAssetRef === "string" ? resAssetRef : null;
      upsertMarker(
        parent,
        markersRef.current,
        fullId,
        RESOURCE_GEOMETRY,
        RESOURCE_COLOR,
        groundOf(resource.position),
        `${resource.resourceId} (${resource.type})`,
        ref,
      );
    }

    // ---- Crafting stations ----
    for (const [id, station] of agentWorldContent.stations) {
      const fullId = `station:${id}`;
      liveIds.add(fullId);
      const stAssetRef = (station as unknown as { assetRef?: unknown })
        .assetRef;
      const ref = typeof stAssetRef === "string" ? stAssetRef : null;
      upsertMarker(
        parent,
        markersRef.current,
        fullId,
        STATION_GEOMETRY,
        STATION_COLOR,
        groundOf(station.position),
        `${station.id} (${station.type})`,
        ref,
      );
    }

    // ---- Teleport nodes ----
    for (const [id, teleport] of agentWorldContent.teleports) {
      const fullId = `teleport:${id}`;
      liveIds.add(fullId);
      const tpAssetRef = (teleport as unknown as { assetRef?: unknown })
        .assetRef;
      const ref = typeof tpAssetRef === "string" ? tpAssetRef : null;
      upsertMarker(
        parent,
        markersRef.current,
        fullId,
        TELEPORT_GEOMETRY,
        TELEPORT_COLOR,
        groundOf(teleport.position),
        `${teleport.name} (${teleport.type})`,
        ref,
      );
    }

    // ---- Cleanup removed markers ----
    for (const [id, entry] of markersRef.current) {
      if (!liveIds.has(id)) {
        disposeMarkerEntry(parent, entry);
        markersRef.current.delete(id);
      }
    }
  }, [
    sceneRefs,
    agentWorldContent.npcs,
    agentWorldContent.spawns,
    agentWorldContent.resources,
    agentWorldContent.stations,
    agentWorldContent.teleports,
  ]);

  useEffect(() => {
    return () => {
      const parent = groupRef.current;
      if (!parent) return;
      for (const entry of markersRef.current.values()) {
        disposeMarkerEntry(parent, entry);
      }
      markersRef.current.clear();
      if (parent.parent) parent.parent.remove(parent);
      groupRef.current = null;
    };
  }, []);
}

function disposeMarkerEntry(parent: THREE.Group, entry: MarkerEntry): void {
  parent.remove(entry.group);
  if (entry.placeholderMaterial) entry.placeholderMaterial.dispose();
  if (entry.modelRoot) disposeSubtree(entry.modelRoot);
  if (entry.label.material instanceof THREE.SpriteMaterial) {
    if (entry.label.material.map) entry.label.material.map.dispose();
    entry.label.material.dispose();
  }
}

function upsertMarker(
  parent: THREE.Group,
  markers: Map<string, MarkerEntry>,
  id: string,
  geometry: THREE.BufferGeometry,
  color: number,
  position: { x: number; y: number; z: number },
  label: string,
  assetRef: string | null,
): void {
  const existing = markers.get(id);
  if (existing) {
    existing.group.position.set(position.x, position.y + 1.6, position.z);
    // If assetRef changed, kick off a fresh load (and tear down
    // any prior real model). Edge case: agent revises a placement
    // to point at a different model.
    if (existing.currentAssetRef !== assetRef) {
      existing.currentAssetRef = assetRef;
      existing.loadGeneration += 1;
      // Restore the placeholder if a previous load had swapped it
      // out, then re-trigger.
      if (!existing.placeholderMesh && existing.modelRoot) {
        existing.group.remove(existing.modelRoot);
        disposeSubtree(existing.modelRoot);
        existing.modelRoot = null;
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.95,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 999;
        existing.placeholderMesh = mesh;
        existing.placeholderMaterial = material;
        existing.group.add(mesh);
      }
      if (assetRef) tryLoadModel(existing, assetRef);
    }
    return;
  }

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 999;
  const labelSprite = makeLabelSprite(label);
  labelSprite.position.set(0, 2.4, 0);
  const group = new THREE.Group();
  group.name = `agent-marker-${id}`;
  group.add(mesh);
  group.add(labelSprite);
  group.position.set(position.x, position.y + 1.6, position.z);
  parent.add(group);

  const entry: MarkerEntry = {
    group,
    placeholderMesh: mesh,
    placeholderMaterial: material,
    modelRoot: null,
    label: labelSprite,
    currentAssetRef: assetRef,
    loadGeneration: 0,
  };
  markers.set(id, entry);

  if (assetRef) tryLoadModel(entry, assetRef);
}

/**
 * Resolve the ref to a model URL, load the GLB, swap it in for
 * the placeholder. Generation token guards against stale loads
 * mutating an entry that's since changed assetRef or been disposed.
 */
function tryLoadModel(entry: MarkerEntry, assetRef: string): void {
  const generation = entry.loadGeneration;
  void (async () => {
    let modelUrl: string | null = null;
    try {
      modelUrl = await resolveAssetRef(assetRef);
    } catch {
      modelUrl = null;
    }
    if (!modelUrl) return;
    if (entry.loadGeneration !== generation) return;

    let root: THREE.Object3D | null = null;
    try {
      root = await loadModelForScene(modelUrl);
    } catch {
      return;
    }
    if (entry.loadGeneration !== generation) {
      // Caller bumped generation — drop this load.
      disposeSubtree(root);
      return;
    }

    // Center / position the loaded model relative to the marker
    // group. The group's own position handles world placement.
    root.position.set(0, 0, 0);

    // Swap the placeholder out.
    if (entry.placeholderMesh) {
      entry.group.remove(entry.placeholderMesh);
      entry.placeholderMesh = null;
    }
    if (entry.placeholderMaterial) {
      entry.placeholderMaterial.dispose();
      entry.placeholderMaterial = null;
    }
    entry.group.add(root);
    entry.modelRoot = root;
  })();
}

/**
 * Tiny canvas-based label sprite. Cheaper than html2canvas, sharp
 * at typical viewing distance, scales naturally with camera zoom.
 */
function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const fontSize = 24;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontSize * dpr}px sans-serif`;
  const padding = 8 * dpr;
  const textWidth = ctx.measureText(text).width;
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(fontSize * dpr + padding * 2);
  ctx.font = `${fontSize * dpr}px sans-serif`;
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.textBaseline = "middle";
  ctx.fillText(text, padding, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  const height = 0.3;
  sprite.scale.set(height * aspect, height, 1);
  return sprite;
}
