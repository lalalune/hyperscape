/**
 * useEditorWorldSync — Bridge between WorldStudioContext state and TileBasedTerrain scene
 *
 * Translates WorldStudioContext state changes into 3D scene objects:
 * - Extended layer entities (spawn points, teleports, mob spawns, resources, stations)
 *   are visualized as colored marker meshes in the viewport
 * - Markers are registered as selectables via TerrainSceneRefs.addSelectable
 * - Active placement ghost is rendered as a translucent preview mesh
 * - Teleport network connections are drawn as lines
 *
 * All geometry/material creation and scene-graph mutation logic lives in
 * utils/editorMarkers.ts. This hook is a thin React lifecycle wrapper.
 */

import * as THREE from "three/webgpu";
import { useEffect, useRef, useCallback } from "react";

import type { TerrainSceneRefs } from "../../WorldBuilder/TileBasedTerrain";
import { queueDisposal } from "../utils/deferredGpuDisposal";
import { initEntityModels } from "../../WorldBuilder/GameWorldAssets";

import type { WorldStudioState } from "../WorldStudioContext";
import type {
  ExtendedWorldLayers,
  ActivePlacement,
  AudioLayers,
} from "../types";
import type { EntityTypeRegistry } from "../../../gameModules/EntityTypeRegistry";

import {
  type SyncState,
  createInitialSyncState,
  syncExtendedLayers,
  syncGhostPlacement,
  syncBoundaryRing,
  disposeSyncState,
} from "../utils/editorMarkers";

// Re-export for external consumers that import from the hook module
export { getPlacementYOffset } from "../utils/editorMarkers";

// ============== HOOK ==============

interface SyncOptions {
  sceneRefs: TerrainSceneRefs | null;
  studioState: WorldStudioState;
  onSelectEntity?: (type: string, id: string) => void;
  /** Entity type registry for generic module entity markers */
  registry?: EntityTypeRegistry;
}

/**
 * Syncs WorldStudioContext state to TileBasedTerrain's 3D viewport.
 * Creates/updates/removes marker meshes for extended layer entities.
 */
export function useEditorWorldSync({
  sceneRefs,
  studioState,
  onSelectEntity,
  registry,
}: SyncOptions) {
  const syncRef = useRef<SyncState>(createInitialSyncState());

  // Keep a stable ref to sceneRefs for cleanup
  const sceneRefsRef = useRef(sceneRefs);
  sceneRefsRef.current = sceneRefs;

  // Keep stable ref to onSelectEntity
  const onSelectEntityRef = useRef(onSelectEntity);
  onSelectEntityRef.current = onSelectEntity;

  // Keep stable ref to registry
  const registryRef = useRef(registry);
  registryRef.current = registry;

  // Pre-load Hyperia's NPC / station / ore GLB models into the
  // shared cache so `tryLoadEntityModel` can resolve them at
  // marker render time. R3.P4 of `PLAN_HYPERIA_DECOUPLING.md` —
  // gated on `project.plugins` so blank / non-Hyperia projects
  // don't get Hyperia GLBs pasted into their model cache. The
  // 5e5aad816 fix made this run unconditionally to give blank-
  // template AI worlds real assets at marker render time; that
  // shipped Hyperia models everywhere as the universal fallback.
  // R0.QW2 (assetRefResolver wiring) gives a cleaner path: when
  // an entity carries `assetRef`, marker rendering resolves
  // through the pack-aware path BEFORE this Hyperia cache. So
  // non-Hyperia projects can still render real models per-pack
  // without polluting the Hyperia caches.
  //
  // Async fire-and-forget; markers placed before init resolves
  // stay placeholder until the next render pass after init lands.
  // When the project's plugin set changes (rare; project-switch
  // path), the effect re-runs and will load Hyperia models if
  // the new project includes the Hyperscape plugin.
  const projectPlugins = studioState.project.plugins;
  const projectAssetPacks = studioState.project.assetPacks;
  const projectTargetsHyperia = projectPlugins.some(
    (id) =>
      id === "@hyperforge/hyperscape" || id === "com.hyperforge.hyperscape",
  );
  // Pack-presence gate — AI-onboarding flows install Hyperia
  // ASSET PACKS (so the agent's auto-filled assetRefs resolve
  // to real GLBs) without installing the Hyperscape gameplay
  // plugin. Without this branch, the plugin-only gate above
  // would skip `initEntityModels` for those projects and the
  // renderer falls back to colored placeholder cubes — exactly
  // the "AI placement broken / no trees" bug the user reported.
  // Any pack id that starts with `@hyperforge/asset-pack-hyperia-`
  // OR `@hyperforge/content-pack-hyperia-` triggers Hyperia
  // model loading; non-Hyperia packs continue to flow through
  // the per-pack `assetRefResolver` path.
  const projectHasHyperiaContent = projectAssetPacks.some(
    (id) =>
      id.startsWith("@hyperforge/asset-pack-hyperia-") ||
      id.startsWith("@hyperforge/content-pack-hyperia-"),
  );
  const shouldLoadHyperiaModels =
    projectTargetsHyperia || projectHasHyperiaContent;
  useEffect(() => {
    if (!shouldLoadHyperiaModels) {
      // No Hyperia plugin AND no Hyperia content/asset packs —
      // leave the Hyperia model caches empty. The assetRef path
      // (R0.QW2) handles renderable entities for whatever packs
      // ARE installed; the rest fall through to abstract colored
      // markers. Empty-state copy in the painter / scatter
      // panels suggests installing a content pack.
      return;
    }
    void initEntityModels().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn("[useEditorWorldSync] initEntityModels failed:", err);
    });
  }, [shouldLoadHyperiaModels]);

  // Sync extended layer entities
  const handleSyncLayers = useCallback(
    (layers: ExtendedWorldLayers, audioLayers?: AudioLayers) => {
      const sync = syncRef.current;
      const refs = sceneRefsRef.current;
      if (!refs || sync.disposed) return;
      syncExtendedLayers(layers, sync, refs, registryRef.current, audioLayers);
    },
    [],
  );

  // Sync ghost placement preview
  const handleSyncGhost = useCallback((placement: ActivePlacement | null) => {
    const sync = syncRef.current;
    const refs = sceneRefsRef.current;
    if (!refs || sync.disposed) return;
    syncGhostPlacement(placement, sync, refs);
  }, []);

  // Sync extended layers when they change
  useEffect(() => {
    handleSyncLayers(studioState.extendedLayers, studioState.audioLayers);
  }, [studioState.extendedLayers, studioState.audioLayers, handleSyncLayers]);

  // Sync ghost placement
  useEffect(() => {
    handleSyncGhost(studioState.tools.activePlacement);
  }, [studioState.tools.activePlacement, handleSyncGhost]);

  // World boundary ring visualization
  useEffect(() => {
    const sync = syncRef.current;
    const refs = sceneRefsRef.current;
    if (!refs || sync.disposed) return;

    const worldData = studioState.builder.editing.world;
    const islandConfig = worldData?.foundation.config.island?.enabled
      ? worldData.foundation.config.island
      : null;
    const tileSize = worldData?.foundation.config.terrain.tileSize ?? 1;

    syncBoundaryRing(sync, refs, islandConfig, tileSize);

    return () => {
      if (sync.boundaryRing) {
        refs.scene.remove(sync.boundaryRing);
        queueDisposal(sync.boundaryRing.geometry);
        queueDisposal(sync.boundaryRing.material as THREE.Material);
        sync.boundaryRing = null;
      }
    };
  }, [sceneRefs, studioState.builder.editing.world]);

  // Cleanup on unmount
  useEffect(() => {
    const sync = syncRef.current;
    return () => {
      disposeSyncState(sync, sceneRefsRef.current);
    };
  }, []);
}
