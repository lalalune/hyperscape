/**
 * ViewportContainer — Hosts the TileBasedTerrain 3D viewport for both
 * creation and editing modes.
 *
 * In creation mode: terrain preview with generation controls.
 * In editing mode: same terrain + editing tools (select, place, brush).
 *
 * The TileBasedTerrain component exposes scene refs via onSceneReady,
 * allowing editing tools to add entity markers, ghost previews, etc.
 * to the same Three.js scene without switching renderers.
 *
 * Phase 1 additions:
 * - Selection outline (blue bounding box wireframe)
 * - Transform gizmo (translate/rotate/scale)
 * - F-to-focus camera animation
 */

import * as THREE from "three/webgpu";
import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from "react";

import {
  TileBasedTerrain,
  type TerrainSceneRefs,
  type ViewportSelection,
  type ViewMode,
  type GameEntityData,
} from "../../WorldBuilder/TileBasedTerrain";
import type { WorldPosition } from "../../WorldBuilder/types";
import { useWorldStudio } from "../WorldStudioContext";
import { registerTerrainQuerier } from "../utils/terrainQueryRegistry";
import { useAgentWorldContent } from "../state/agentWorldContent";
import { useEditorWorldSync } from "../hooks/useEditorWorldSync";
import { usePlacementInteraction } from "../hooks/usePlacementInteraction";
import { useZonePainting } from "../hooks/useZonePainting";
import { useBrushInteraction } from "../hooks/useBrushInteraction";
import { usePlacementConfirmation } from "../hooks/usePlacementConfirmation";
import { useBrushOverlaySync } from "../hooks/useBrushOverlaySync";
import { useAreaBoundaryOverlay } from "../hooks/useAreaBoundaryOverlay";
import { useAudioZoneOverlay } from "../hooks/useAudioZoneOverlay";
import { useWizardPreviewOverlay } from "../hooks/useWizardPreviewOverlay";
import { useWaterBodyEditor } from "../hooks/useWaterBodyEditor";
import { useZoneProcgen } from "../hooks/useZoneProcgen";
import { commandHistory } from "../../../editor/commands";
import { useSelectionOutline } from "../hooks/useSelectionOutline";
import { useTransformGizmo } from "../hooks/useTransformGizmo";
import { useMultiTransformGizmo } from "../hooks/useMultiTransformGizmo";
import { useSelectionStore } from "../../../editor/stores/useSelectionStore";
import { useCameraBookmarks } from "../hooks/useCameraBookmarks";
import { ContextMenu, type ContextMenuItem } from "../layout/ContextMenu";
import { useContextMenu } from "../layout/useContextMenu";
import {
  executeDuplicate,
  executeDelete,
  executeCreatePrefab,
} from "../utils/entityActions";
import { ViewModeDropdown } from "./ViewModeDropdown";
import { ViewportOverlayBar } from "../toolbar/ViewportOverlayBar";
import { ViewportOverlay } from "./ViewportOverlay";
import { PIEConsolePanel } from "./PIEConsolePanel";
import { usePIESession } from "../hooks/usePIESession";
import { PIEHudOverlay } from "./PIEHudOverlay";
import { resolveGamePluginSetId } from "../toolbar/gamePluginResolver";
import { usePIEDebugStore } from "../../../editor/stores/usePIEDebugStore";
import { GenerateTownDialog } from "../panels/GenerateTownDialog";
import {
  getTownSafeRadius,
  HAND_PLACED_ENTITY_BUFFER,
  VEGETATION_BUFFER,
} from "../utils/worldConstants";
import {
  runAutoGenPipeline,
  DEFAULT_AUTOGEN_CONFIG,
} from "../hooks/useZoneAutoGen";
import {
  withBiomeDifficultyFallback,
  type TownInfo,
  type DangerSourceInfo,
} from "../../WorldBuilder/DifficultyHeatmap";
import type { PlacedRegion } from "../types";

/** Available grid snap sizes in meters */
const GRID_SNAP_SIZES = [0.25, 0.5, 1.0, 2.0, 4.0] as const;

/**
 * Derive the selectableId used in the 3D scene from a WorldStudio selection.
 * This bridges the gap between Selection.id (entityId) and userData.selectableId.
 *
 * For game world entities (from GameWorldEntitySync), selectableId = group.name
 * e.g., "npc_cook", "station_anvil_2", etc. The Selection.id stores just entityId.
 * We need the selectableId to find the 3D object in the scene.
 */
function getSelectableIdFromSelection(
  selection: {
    type: string;
    id: string;
    entityData?: Record<string, unknown>;
  } | null,
): string | null {
  if (!selection) return null;
  // Extended layer entities use their id directly as selectableId
  const EXTENDED_TYPES = new Set([
    "spawnPoint",
    "teleport",
    "mobSpawn",
    "resource",
    "station",
    "poi",
    "waterBody",
  ]);
  if (EXTENDED_TYPES.has(selection.type)) return selection.id;

  // Game world entities: entityData may contain the selectableId
  if (selection.entityData?.selectableId) {
    return selection.entityData.selectableId as string;
  }

  // Foundation elements and procgen structures use their id
  if (
    selection.type === "town" ||
    selection.type === "building" ||
    selection.type === "road" ||
    selection.type === "bridge" ||
    selection.type === "duelArena"
  ) {
    return selection.id;
  }

  // Vegetation instances: promoted proxy uses selection.id as selectableId
  if (selection.type === "vegetation") {
    return selection.id;
  }

  return null;
}

export function ViewportContainer() {
  const { state, actions, viewportRef, registry, dispatch } = useWorldStudio();
  // Agent-emitted world content (B1 of PLAN_AAA_QUALITY). The viewport
  // counts these alongside designer-placed content; full marker
  // rendering is a follow-up slice.
  const agentWorldContent = useAgentWorldContent();
  const isEditing = state.builder.mode === "editing";
  // Live terrain config (from slider drags) takes priority, then editing config, then creation config.
  // This allows real-time slider updates without full scene teardown.
  const baseConfig =
    isEditing && state.builder.editing.world
      ? state.builder.editing.world.foundation.config
      : state.builder.creation.config;
  const config = state.liveTerrainConfig ?? baseConfig;

  // Ref-stable state for async callbacks (avoids stale closures in setTimeout)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Scene refs from TileBasedTerrain for editing tool integration
  const sceneRefsRef = useRef<TerrainSceneRefs | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  // Imported heightmap querier (overrides procedural terrain)
  const [importedQuerier, setImportedQuerier] = useState<
    | ((
        worldX: number,
        worldZ: number,
      ) => {
        height: number;
        biome: string;
        biomeForestWeight?: number;
        biomeCanyonWeight?: number;
      })
    | null
  >(null);

  const handleSceneReady = useCallback(
    (refs: TerrainSceneRefs) => {
      sceneRefsRef.current = refs;
      // Expose refreshVegetation to sibling components via viewportRef
      viewportRef.current.refreshVegetation = refs.refreshVegetation;
      viewportRef.current.navigateCamera = refs.navigateCamera;
      viewportRef.current.queryBiome = refs.queryBiome;
      viewportRef.current.getBiomeDifficulty = refs.getBiomeDifficulty;
      viewportRef.current.worldCenterOffset = refs.worldCenterOffset;
      // Use a getter so runtimeTowns is always current (towns load after scene ready)
      Object.defineProperty(viewportRef.current, "runtimeTowns", {
        get: () => refs.runtimeTowns,
        configurable: true,
      });
      // Use a getter so vegetationPositions is always current (populated after refreshVegetation)
      Object.defineProperty(viewportRef.current, "vegetationPositions", {
        get: () => refs.vegetationPositions,
        configurable: true,
      });
      // Use a getter so vegetationTrees is always current for manifest export
      Object.defineProperty(viewportRef.current, "vegetationTrees", {
        get: () => refs.vegetationTrees,
        configurable: true,
      });
      viewportRef.current.refreshTownMarkers = refs.refreshTownMarkers;
      viewportRef.current.setVegetationVisible = refs.setVegetationVisible;
      viewportRef.current.getTerrainQuerier = refs.getTerrainQuerier;
      viewportRef.current.setImportedQuerier = setImportedQuerier;
      // Make terrain queries reachable from outside the viewport
      // tree (placement dispatcher needs this to snap agent
      // emissions onto the actual terrain mesh instead of leaving
      // them at y=0 in the ocean).
      registerTerrainQuerier({
        getTerrainHeight: refs.getTerrainHeight,
        getWaterLevel: () => {
          const w = state.builder.editing.world;
          return w?.foundation?.config?.terrain?.waterThreshold ?? 0;
        },
      });
      setSceneReady(true);
    },
    [viewportRef, state.builder.editing.world],
  );

  const handleGameEntitiesLoaded = useCallback(
    (data: GameEntityData) => {
      actions.setGameEntities(data);
    },
    [actions],
  );

  const handleTownsGenerated = useCallback(
    (
      towns: Array<{
        id: string;
        name: string;
        position: { x: number; y: number; z: number };
        size: "hamlet" | "village" | "town";
        safeZoneRadius: number;
        biomeId?: string;
      }>,
    ) => {
      actions.syncRuntimeTowns(towns);
    },
    [actions],
  );

  const activeSceneRefs = sceneReady ? sceneRefsRef.current : null;

  // ----- View mode state -----
  const [viewMode, setViewMode] = useState<ViewMode>("lit");
  const [gridVisible, setGridVisible] = useState(false);

  // ----- Tile loading progress -----
  const [tileProgress, setTileProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);

  // ----- Fly mode state -----
  const [flyMode, setFlyMode] = useState(false);
  const [cameraMoveSpeed, setCameraMoveSpeed] = useState(200);

  // ----- Player preview mode -----
  const [playerMode, setPlayerMode] = useState(false);
  // Time of day: driven by the overlay bar's time slider (context), default 12
  const timeOfDay = state.overlays.timeOfDay ?? 12;
  // Phase 6: Visual parity toggles from overlay bar
  const enableShadows = state.overlays.shadows;
  const enableBloom = state.overlays.bloom;
  const enableGameFog = state.overlays.gameFog;
  const enableSky = state.overlays.sky;
  const enableGrass = state.overlays.grass;

  const handleTogglePlayerMode = useCallback(() => {
    const refs = sceneRefsRef.current;
    if (!refs) return;
    if (refs.isPlayerMode()) {
      refs.exitPlayerMode();
    } else {
      refs.enterPlayerMode();
    }
  }, []);

  // ----- Difficulty heatmap -----
  const [showDifficultyHeatmap, setShowDifficultyHeatmap] = useState(false);

  // Danger sources for heatmap overlay — memoize to avoid re-renders
  const heatmapDangerSources = useMemo(() => {
    if (!isEditing) return undefined;
    const ds = state.extendedLayers.dangerSources;
    if (ds.length === 0) return undefined;
    return ds.map((d) => ({
      position: { x: d.position.x, z: d.position.z },
      radius: d.radius,
      intensity: d.intensity,
      falloffCurve: d.falloffCurve,
    }));
  }, [isEditing, state.extendedLayers.dangerSources]);

  // ----- Context menu -----
  const { contextMenu, showContextMenuAt, hideContextMenu } = useContextMenu();

  // ----- Viewport context menu from TileBasedTerrain (quick RMB click) -----
  const handleViewportContextMenu = useCallback(
    (x: number, y: number) => {
      if (!isEditing) return;
      showContextMenuAt(x, y);
    },
    [isEditing, showContextMenuAt],
  );

  // ----- Generate Town dialog state -----
  const [townDialogPosition, setTownDialogPosition] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);

  // ----- Camera bookmarks -----
  const projectId = state.project.currentProjectId ?? "";
  const { bookmarks, addBookmark } = useCameraBookmarks(projectId);

  // ----- Play-In-Editor (PIE) -----
  // Forward every PIE script-runtime debug entry into the global debug store
  // so the PIE Console panel can render them live.
  const appendDebugEntry = usePIEDebugStore((s) => s.append);
  const {
    startPIE,
    stopPIE,
    interactAtCenter,
    getWidgetRegistry,
    getDataContext,
  } = usePIESession({
    sceneRefs: sceneRefsRef.current,
    state,
    onExit: () => actions.pieStop(),
    onDebug: appendDebugEntry,
  });

  // React to PIE state changes from toolbar
  const prevPieRef = useRef(state.pie);
  useEffect(() => {
    const prev = prevPieRef.current;
    const curr = state.pie;
    prevPieRef.current = curr;

    // PIE_START → start the session
    if (curr.loading && !prev.loading) {
      try {
        // Wipe any leftover debug entries from a previous PIE run so the
        // console reflects only the current session.
        usePIEDebugStore.getState().clear();
        startPIE();
        actions.pieStarted();
      } catch (err) {
        actions.pieError(
          err instanceof Error ? err.message : "Failed to start PIE",
        );
      }
    }

    // PIE_STOP → stop the session
    if (!curr.active && prev.active) {
      stopPIE();
    }
  }, [state.pie, startPIE, stopPIE, actions]);

  // While PIE is active, route left-mouse clicks to `interactAtCenter()` so
  // the player can interact with NPCs/resources/etc. via the crosshair.
  // The camera is in pointer-lock FPS mode, so we listen on document and
  // raycast from the center of the screen.
  useEffect(() => {
    if (!state.pie.active) return;
    const onMouseDown = (e: MouseEvent) => {
      // Only respond to primary button — secondary buttons are reserved for
      // camera look / context menu in other modes.
      if (e.button !== 0) return;
      // Pointer-lock means clicks fire while focus is on document; ignore
      // clicks that originated on UI overlays (which set pointer-events: auto
      // on themselves and won't be the active element if pointer-locked).
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-pie-no-interact]")) return;
      interactAtCenter();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [state.pie.active, interactAtCenter]);

  // When player mode exits (ESC key in viewport), sync PIE state
  const handlePlayerModeChange = useCallback(
    (enabled: boolean) => {
      setPlayerMode(enabled);
      // If player mode was exited while PIE is active, stop PIE
      if (!enabled && state.pie.active) {
        actions.pieStop();
      }
    },
    [state.pie.active, actions],
  );

  // ----- Transform gizmo state -----
  const transformMode = state.tools.transformMode;
  const transformSpace = state.tools.transformSpace;
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [surfaceSnap, setSurfaceSnap] = useState(true);

  // Derive the selectableId from the current selection
  const selection = state.builder.editing.selection;
  const selectedSelectableId = useMemo(
    () =>
      getSelectableIdFromSelection(
        selection as {
          type: string;
          id: string;
          entityData?: Record<string, unknown>;
        } | null,
      ),
    [selection],
  );

  // ----- Vegetation instance promote/demote for gizmo transform -----
  // InstancedMesh instances can't be individually transformed by TransformControls.
  // When a biome tree is selected, we "promote" it into a standalone Object3D,
  // and "demote" it back to the InstancedMesh when deselected.
  const vegProxyRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!activeSceneRefs) return;

    // Demote previous proxy if selection changed away from it
    if (vegProxyRef.current) {
      const prevId = vegProxyRef.current.userData.selectableId;
      if (
        !selection ||
        selection.type !== "vegetation" ||
        selection.id !== prevId
      ) {
        activeSceneRefs.demoteVegetationInstance(vegProxyRef.current);
        vegProxyRef.current = null;
      }
    }

    // Promote new vegetation instance if selected
    if (
      selection?.type === "vegetation" &&
      selection.entityData?.species &&
      selection.entityData?.instanceIndex !== undefined &&
      !vegProxyRef.current
    ) {
      const proxy = activeSceneRefs.promoteVegetationInstance(
        selection.entityData.species as string,
        selection.entityData.instanceIndex as number,
        selection.id,
      );
      vegProxyRef.current = proxy;
    }
  }, [activeSceneRefs, selection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vegProxyRef.current && sceneRefsRef.current) {
        sceneRefsRef.current.demoteVegetationInstance(vegProxyRef.current);
        vegProxyRef.current = null;
      }
    };
  }, []);

  // ----- Interaction mode management -----
  const activeTool = state.tools.activeTool;
  const hasActivePlacement =
    !!state.tools.activePlacement && !state.tools.activePlacement.confirmed;

  // Stable refs so handleSelect doesn't recreate when tool/placement changes.
  // Callback identity must stay stable to avoid cascading TileBasedTerrain
  // scene re-init through: onSelect → handleClick → massive init effect.
  const hasActivePlacementRef = useRef(hasActivePlacement);
  hasActivePlacementRef.current = hasActivePlacement;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Compute showGizmo early — needed for interaction mode decision
  const MOVABLE_TYPES = useMemo(
    () =>
      new Set([
        "spawnPoint",
        "teleport",
        "mobSpawn",
        "resource",
        "station",
        "poi",
        "waterBody",
        "gameNpc",
        "gameStation",
        "gameResource",
        "gameMobSpawn",
        "npc",
        "quest",
        "boss",
        "event",
        "lore",
        "vegetation",
        "bridge",
        "duelArena",
        "building",
        "town",
      ]),
    [],
  );
  // PIE Play mode: hide editor gizmos and tool affordances so the
  // viewport feels like the runtime game (B0 reopen). Simulate mode
  // keeps the editor surface; only `mode === "play"` flips the
  // visibility off.
  const isPiePlayMode = state.pie.active && state.pie.mode === "play";

  const showGizmo =
    isEditing &&
    !isPiePlayMode &&
    activeTool === "select" &&
    selection &&
    MOVABLE_TYPES.has(selection.type);

  const needsToolMode =
    isEditing &&
    !isPiePlayMode &&
    (activeTool === "brush" || activeTool === "place" || hasActivePlacement);

  // Multi-select from Zustand store (used for interaction mode + multi-gizmo)
  const multiSelectionForMode = useSelectionStore((s) => s.multiSelection);
  const showMultiGizmo =
    isEditing &&
    !isPiePlayMode &&
    activeTool === "select" &&
    multiSelectionForMode.length > 1;

  useEffect(() => {
    if (!activeSceneRefs) return;
    if (showGizmo || showMultiGizmo) {
      // Gizmo visible: left free for gizmo handles, middle = orbit, right = pan
      activeSceneRefs.setInteractionMode("gizmo");
    } else if (needsToolMode) {
      activeSceneRefs.setInteractionMode("tool");
    } else {
      activeSceneRefs.setInteractionMode("orbit");
    }
  }, [activeSceneRefs, needsToolMode, showGizmo, showMultiGizmo]);

  // ----- View mode sync -----
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      activeSceneRefs?.setViewMode(mode);
    },
    [activeSceneRefs],
  );

  // ----- Grid toggle -----
  const handleGridToggle = useCallback(() => {
    setGridVisible((v) => {
      const next = !v;
      activeSceneRefs?.setGridVisible(next);
      return next;
    });
  }, [activeSceneRefs]);

  // ----- Snap toggle (click-based, complements Ctrl hold) -----
  const handleSnapToggle = useCallback(() => {
    setSnapEnabled((v) => !v);
  }, []);

  // ----- Surface snap toggle (terrain snapping during translate) -----
  const handleSurfaceSnapToggle = useCallback(() => {
    setSurfaceSnap((v) => !v);
  }, []);

  // ----- Grid size cycling -----
  const gridSize = state.tools.gridSize;
  const handleCycleGridSize = useCallback(() => {
    const idx = GRID_SNAP_SIZES.indexOf(
      gridSize as (typeof GRID_SNAP_SIZES)[number],
    );
    const nextIdx = (idx + 1) % GRID_SNAP_SIZES.length;
    actions.setGridSize(GRID_SNAP_SIZES[nextIdx]);
  }, [gridSize, actions]);

  // ----- Selection outline -----
  useSelectionOutline({
    sceneRefs: activeSceneRefs,
    selectedSelectableId: isEditing ? selectedSelectableId : null,
  });

  // ----- Transform gizmo -----

  // ----- Debounced town move: road regen + terrain refresh -----
  // Triggered directly from handleEntityMoved (not from state watching) to
  // avoid false triggers from SYNC_RUNTIME_TOWNS during initial load.
  // Uses stateRef to read LATEST state inside the timer (avoids stale closure).
  // Accumulates all moved towns so rapidly moving multiple towns is handled.
  const townMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTownMovesRef = useRef<
    Map<string, { x: number; y: number; z: number }>
  >(new Map());

  const debouncedTownRefresh = useCallback(
    (movedTownId: string, newGamePos: { x: number; y: number; z: number }) => {
      pendingTownMovesRef.current.set(movedTownId, newGamePos);

      if (townMoveTimerRef.current) {
        clearTimeout(townMoveTimerRef.current);
      }

      townMoveTimerRef.current = setTimeout(() => {
        const refs = sceneRefsRef.current;
        if (!refs) return;

        const movedTowns = new Map(pendingTownMovesRef.current);
        pendingTownMovesRef.current.clear();
        const pipelineStart = performance.now();

        // ── Step 1: Y-snap moved towns to terrain height ──
        for (const [townId, gamePos] of movedTowns) {
          const terrainY = refs.queryBiome(gamePos.x, gamePos.z).height;
          if (Math.abs(terrainY - gamePos.y) > 0.5) {
            const snapped = { x: gamePos.x, y: terrainY, z: gamePos.z };
            actions.moveTown(townId, snapped);
            movedTowns.set(townId, snapped);
          }
        }

        // ── Step 2: Read latest state ──
        const latestState = stateRef.current;
        const currentWorld = latestState.builder.editing.world;
        if (!currentWorld) return;

        const queryBiome = refs.queryBiome;
        const getBiomeDifficulty = withBiomeDifficultyFallback(
          refs.getBiomeDifficulty,
        );
        const worldSizeMeters =
          currentWorld.foundation.config.terrain.worldSize *
          currentWorld.foundation.config.terrain.tileSize;
        const waterThreshold =
          currentWorld.foundation.config.terrain.waterThreshold;
        const seed = currentWorld.foundation.config.seed;

        // ── Step 3: Build pipeline deps (mirrors useZoneAutoGen.generate) ──
        const towns: TownInfo[] = currentWorld.foundation.towns.map((t) => ({
          position: { x: t.position.x, z: t.position.z },
          safeZoneRadius: getTownSafeRadius(t),
        }));

        const townDetails = currentWorld.foundation.towns.map((t) => {
          const safeR = getTownSafeRadius(t);
          const entryPoints = t.entryPoints
            ?.filter((ep) => ep.position)
            .map((ep) => ({
              angle: Math.atan2(
                ep.position.x - t.position.x,
                ep.position.z - t.position.z,
              ),
              position: { x: ep.position.x, z: ep.position.z },
            }));
          return {
            id: t.id,
            name: t.name,
            position: {
              x: t.position.x,
              y: t.position.y,
              z: t.position.z,
            },
            radius: safeR * 0.35,
            safeZoneRadius: safeR,
            entryPoints: entryPoints?.length ? entryPoints : undefined,
          };
        });

        const dangerSources: DangerSourceInfo[] =
          latestState.extendedLayers.dangerSources.map((ds) => ({
            position: { x: ds.position.x, z: ds.position.z },
            radius: ds.radius,
            intensity: ds.intensity,
            falloffCurve: ds.falloffCurve,
          }));

        // Existing entities for placement avoidance
        const existingEntities: Array<{
          x: number;
          z: number;
          radius: number;
        }> = [];
        const entityBuffer = HAND_PLACED_ENTITY_BUFFER;
        for (const npc of currentWorld.layers.npcs) {
          existingEntities.push({
            x: npc.position.x,
            z: npc.position.z,
            radius: entityBuffer,
          });
        }
        for (const s of latestState.extendedLayers.stations) {
          existingEntities.push({
            x: s.position.x,
            z: s.position.z,
            radius: entityBuffer,
          });
        }
        for (const sp of latestState.extendedLayers.spawnPoints) {
          existingEntities.push({
            x: sp.position.x,
            z: sp.position.z,
            radius: entityBuffer,
          });
        }
        for (const tp of latestState.extendedLayers.teleports) {
          existingEntities.push({
            x: tp.position.x,
            z: tp.position.z,
            radius: entityBuffer,
          });
        }
        for (const poi of latestState.extendedLayers.pois) {
          existingEntities.push({
            x: poi.position.x,
            z: poi.position.z,
            radius: poi.radius ?? entityBuffer,
          });
        }
        const vegPositions = refs.vegetationPositions ?? [];
        for (const veg of vegPositions) {
          existingEntities.push({
            x: veg.x,
            z: veg.z,
            radius: VEGETATION_BUFFER,
          });
        }

        // Structure obstacles for road avoidance
        const ROAD_BLDG_BUFFER = 4;
        const structureObstacles: Array<{
          x: number;
          z: number;
          radius: number;
        }> = [];
        for (const b of currentWorld.foundation.buildings) {
          const halfDiag =
            Math.sqrt(b.dimensions.width ** 2 + b.dimensions.depth ** 2) / 2;
          structureObstacles.push({
            x: b.position.x,
            z: b.position.z,
            radius: halfDiag + ROAD_BLDG_BUFFER,
          });
        }
        for (const poi of latestState.extendedLayers.pois) {
          structureObstacles.push({
            x: poi.position.x,
            z: poi.position.z,
            radius: (poi.radius ?? 10) + ROAD_BLDG_BUFFER,
          });
        }
        for (const s of latestState.extendedLayers.stations) {
          structureObstacles.push({
            x: s.position.x,
            z: s.position.z,
            radius: 4 + ROAD_BLDG_BUFFER,
          });
        }
        for (const arena of latestState.manifests.duelArenas) {
          structureObstacles.push({
            x: arena.center.x,
            z: arena.center.z,
            radius: Math.max(arena.size, 12) + ROAD_BLDG_BUFFER,
          });
        }

        // ── Step 4: Run full auto-gen pipeline (NO townConfig → keeps existing towns) ──
        const pipelineConfig = { ...DEFAULT_AUTOGEN_CONFIG, seed };
        const result = runAutoGenPipeline(pipelineConfig, {
          queryBiome,
          getBiomeDifficulty,
          worldSize: worldSizeMeters,
          waterThreshold,
          seed,
          towns,
          townDetails,
          dangerSources,
          manifests: latestState.manifests,
          existingEntities,
          structureObstacles,
          // NO townConfig — pipeline uses existing towns, skips town generation
        });

        console.log(
          `[TownMove] Pipeline complete in ${Math.round(performance.now() - pipelineStart)}ms: ` +
            `${result.roads.length} roads, ${result.zones.length} zones, ` +
            `${result.mobSpawns.length} mobs, ${result.resources.length} resources`,
        );

        // ── Step 5: Update procgen town positions + rebuild town markers ──
        // Set new road data in ref BEFORE refreshTownMarkers unloads tiles,
        // so regenerated tiles pick up the correct road influence.
        refs.rebuildRoadRibbons(result.roads);

        const lastProcgen = refs.getLastProcgenTowns();
        if (lastProcgen.length > 0) {
          // Shift procgen town positions to match foundation state
          const updatedProcgen = lastProcgen.map((pt) => {
            const ft = currentWorld.foundation.towns.find(
              (t) => t.id === pt.id,
            );
            if (!ft) return pt;
            const dx = ft.position.x - pt.position.x;
            const dy = ft.position.y - pt.position.y;
            const dz = ft.position.z - pt.position.z;
            if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return pt;
            return {
              ...pt,
              position: { ...ft.position },
              buildings: pt.buildings.map((b) => ({
                ...b,
                position: {
                  x: b.position.x + dx,
                  y: b.position.y + dy,
                  z: b.position.z + dz,
                },
              })),
              landmarks: pt.landmarks?.map((l) => ({
                ...l,
                position: {
                  x: l.position.x + dx,
                  y: l.position.y + dy,
                  z: l.position.z + dz,
                },
              })),
              internalRoads: pt.internalRoads?.map((r) => ({
                ...r,
                start: { ...r.start, x: r.start.x + dx, z: r.start.z + dz },
                end: { ...r.end, x: r.end.x + dx, z: r.end.z + dz },
              })),
              entryPoints: pt.entryPoints?.map((ep) => ({
                ...ep,
                position: ep.position
                  ? { x: ep.position.x + dx, z: ep.position.z + dz }
                  : ep.position,
              })),
              plaza: pt.plaza
                ? {
                    ...pt.plaza,
                    position: {
                      ...pt.plaza.position,
                      x: pt.plaza.position.x + dx,
                      z: pt.plaza.position.z + dz,
                    },
                  }
                : undefined,
              paths: pt.paths?.map((p) => ({
                ...p,
                start: { x: p.start.x + dx, z: p.start.z + dz },
                end: { x: p.end.x + dx, z: p.end.z + dz },
              })),
            };
          });
          // refreshTownMarkers rebuilds 3D meshes at new positions, updates
          // runtimeTownsRef for terrain flattening, and unloads ALL tiles
          // so they regenerate with correct flatten zones + road influence.
          refs.refreshTownMarkers(updatedProcgen);
        } else {
          // No stored procgen towns (shouldn't happen) — move meshes manually
          for (const [townId, gamePos] of movedTowns) {
            refs.moveTownInScene(townId, gamePos);
          }
        }

        // ── Step 6: Clear old autogen + apply new entities/zones/roads ──
        actions.clearAllAutogen();

        const offset = refs.worldCenterOffset;
        const toScene = (pos: { x: number; y: number; z: number }) => {
          const y = queryBiome(pos.x, pos.z).height;
          return { x: pos.x + offset, y, z: pos.z + offset };
        };

        // Convert zones to PlacedRegion
        const tiers = pipelineConfig.tiers;
        const regions: PlacedRegion[] = result.zones.map((zone, idx) => ({
          id: `autogen-zone-${idx}`,
          name: zone.name,
          description: `Auto-generated ${zone.biome} zone (${tiers[zone.tierIndex]?.name ?? "Unknown"} tier)`,
          tileKeys: [],
          tags: [
            "autogen",
            zone.biome,
            tiers[zone.tierIndex]?.name.toLowerCase() ?? "unknown",
          ],
          spawnRules: zone.spawnRules,
          autoGenBounds: zone.autoGenBounds,
        }));

        // Convert positions from game-space to scene-space
        const sceneMobs = result.mobSpawns.map((m) => ({
          ...m,
          position: toScene(m.position),
        }));
        const sceneResources = result.resources.map((r) => ({
          ...r,
          position: toScene(r.position),
        }));
        const sceneSpawns = result.spawnPoints.map((sp) => ({
          ...sp,
          position: toScene(sp.position),
        }));
        const sceneTeleports = result.teleports.map((tp) => ({
          ...tp,
          position: toScene(tp.position),
        }));

        actions.batchAddRegions(regions);
        actions.batchAddEntities(sceneMobs, sceneResources);
        for (const sp of sceneSpawns) actions.addSpawnPoint(sp);
        for (const tp of sceneTeleports) actions.addTeleport(tp);
        actions.setFoundationRoads(result.roads);

        // ── Step 7: Refresh vegetation with updated exclusion zones ──
        if (refs.refreshVegetation) {
          const circles: Array<{ x: number; z: number; radius: number }> = [];
          // Building exclusion zones
          for (const b of currentWorld.foundation.buildings) {
            const footprint = Math.max(b.dimensions.width, b.dimensions.depth);
            circles.push({
              x: b.position.x,
              z: b.position.z,
              radius: footprint / 2 + 2,
            });
          }
          // Town center exclusion
          for (const ft of currentWorld.foundation.towns) {
            circles.push({
              x: ft.position.x,
              z: ft.position.z,
              radius: 8,
            });
          }
          // Resource/spawn/teleport exclusion
          for (const r of result.resources) {
            circles.push({ x: r.position.x, z: r.position.z, radius: 2.5 });
          }
          for (const sp of result.spawnPoints) {
            circles.push({ x: sp.position.x, z: sp.position.z, radius: 4 });
          }
          for (const tp of result.teleports) {
            circles.push({ x: tp.position.x, z: tp.position.z, radius: 4 });
          }

          const roadExclusions = result.roads.map((r) => ({
            path: r.path.map((p) => ({ x: p.x, z: p.z })),
            halfWidth: (r.width ?? 6) / 2 + 0.5,
          }));

          const townCenters = currentWorld.foundation.towns.map((t) => ({
            x: t.position.x,
            z: t.position.z,
            safeZoneRadius: getTownSafeRadius(t),
          }));

          refs.refreshVegetation(
            undefined,
            {
              circles,
              roads: roadExclusions,
              towns: townCenters,
            },
            state.brushOverlays.vegetationPaints,
          );
        }

        console.log(
          `[TownMove] Full regeneration complete — ${movedTowns.size} town(s) moved, ` +
            `${result.roads.length} roads, ${result.zones.length} zones, ` +
            `${result.mobSpawns.length + result.resources.length} entities`,
        );
      }, 500);
    },
    [actions],
  );

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (townMoveTimerRef.current) {
        clearTimeout(townMoveTimerRef.current);
      }
    };
  }, []);

  // ----- Gizmo transform persistence -----
  // Map selection type → update action for extended layer entities
  const handleEntityMoved = useCallback(
    (entityId: string, position: { x: number; y: number; z: number }) => {
      if (!selection) return;
      const pos = { x: position.x, y: position.y, z: position.z };
      switch (selection.type) {
        case "spawnPoint":
          actions.updateSpawnPoint(entityId, { position: pos });
          break;
        case "teleport":
          actions.updateTeleport(entityId, { position: pos });
          break;
        case "mobSpawn":
          actions.updateMobSpawn(entityId, { position: pos });
          break;
        case "resource":
          actions.updateResource(entityId, { position: pos });
          break;
        case "station":
          actions.updateStation(entityId, { position: pos });
          break;
        case "poi":
          actions.updatePOI(entityId, { position: pos });
          break;
        case "waterBody":
          actions.updateWaterBody(entityId, { surfaceY: pos.y });
          break;
        case "town": {
          // Town meshes are in scene-space (game + offset), convert back to game-space
          const offset = sceneRefsRef.current?.worldCenterOffset ?? 0;
          const newGamePos = {
            x: pos.x - offset,
            y: pos.y,
            z: pos.z - offset,
          };
          actions.moveTown(entityId, newGamePos);
          // Debounced terrain + road refresh (only on user-initiated drags)
          debouncedTownRefresh(entityId, newGamePos);
          break;
        }
        default:
          // Game entities (gameNpc, gameStation, etc.) — visual only for now
          break;
      }
    },
    [selection, actions, debouncedTownRefresh],
  );

  const handleEntityRotated = useCallback(
    (entityId: string, rotation: { x: number; y: number; z: number }) => {
      if (!selection) return;
      // Extended layer entities store rotation as a single Y-axis value
      const rotY = rotation.y;
      switch (selection.type) {
        case "spawnPoint":
          actions.updateSpawnPoint(entityId, { rotation: rotY });
          break;
        case "resource":
          actions.updateResource(entityId, { rotation: rotY });
          break;
        case "station":
          actions.updateStation(entityId, { rotation: rotY });
          break;
        default:
          break;
      }
    },
    [selection, actions],
  );

  const handleEntityScaled = useCallback(
    (_entityId: string, _scale: { x: number; y: number; z: number }) => {
      // Scale is visual-only — extended layer entities don't have a scale field
    },
    [],
  );

  useTransformGizmo({
    sceneRefs: activeSceneRefs,
    selectedSelectableId: showGizmo ? selectedSelectableId : null,
    mode: transformMode,
    space: transformSpace,
    snapEnabled,
    gridSize,
    surfaceSnap,
    onEntityMoved: handleEntityMoved,
    onEntityRotated: handleEntityRotated,
    onEntityScaled: handleEntityScaled,
    onDraggingChanged: undefined,
  });

  // ----- Multi-select transform gizmo -----
  const isMultiSelectActive = showMultiGizmo;

  useMultiTransformGizmo({
    sceneRefs: activeSceneRefs,
    enabled: isMultiSelectActive,
    mode: transformMode,
    space: transformSpace,
    snapEnabled,
    gridSize,
    onDraggingChanged: undefined,
  });

  // When multi-select is active, detach single-gizmo by ensuring showGizmo
  // is false (already handled: showGizmo requires a single selection, while
  // multi-select uses multiSelection from Zustand store — they are mutually
  // exclusive by design in the selection system).

  // ----- Keyboard shortcuts for gizmo -----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      )
        return;
      if (!isEditing) return;

      // During RMB fly mode, WASD/QE/F are used for camera — don't intercept
      const isInFlyMode = document.pointerLockElement != null;

      // W = translate, E = rotate, R = scale (matches UE5) — only outside fly mode
      if (
        !isInFlyMode &&
        e.key === "w" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        activeTool === "select"
      ) {
        e.preventDefault();
        actions.setTransformMode("translate");
        return;
      }
      if (
        !isInFlyMode &&
        e.key === "e" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        activeTool === "select"
      ) {
        e.preventDefault();
        actions.setTransformMode("rotate");
        return;
      }
      if (
        !isInFlyMode &&
        e.key === "r" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        activeTool === "select"
      ) {
        e.preventDefault();
        actions.setTransformMode("scale");
        return;
      }

      // F = focus on selected object — only outside fly mode
      if (
        !isInFlyMode &&
        e.key === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        selectedSelectableId &&
        activeSceneRefs
      ) {
        e.preventDefault();
        // Find the selected object and focus camera on it
        let found: THREE.Object3D | null = null;
        activeSceneRefs.scene.traverse((obj) => {
          if (found) return;
          if (obj.userData?.selectableId === selectedSelectableId) {
            found = obj;
          }
        });
        if (found) {
          const box = new THREE.Box3().setFromObject(found);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const radius = size.length() / 2;
          activeSceneRefs.focusOnPosition(center, radius);
        }
        return;
      }

      // Delete selected entity — delegates to shared utility for command history
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selection &&
        activeTool === "select"
      ) {
        e.preventDefault();
        executeDelete(
          state,
          actions,
          selection.type,
          selection.id,
          registry,
          dispatch,
        );
        return;
      }

      // Toggle snap with Ctrl (hold)
      // Handled via keydown/keyup below
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Snap toggle via Ctrl hold is handled here
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    isEditing,
    activeTool,
    selectedSelectableId,
    activeSceneRefs,
    selection,
    state.extendedLayers,
    actions,
  ]);

  // Ctrl hold for snap toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") setSnapEnabled(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") setSnapEnabled(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // ----- Camera position polling (for viewport overlay) -----
  // Only update state when position has meaningfully changed (>1 unit) to avoid
  // cascading re-renders in minimap/overlay every 500ms.
  const [cameraPosition, setCameraPosition] = useState<
    { x: number; y: number; z: number } | undefined
  >(undefined);
  const lastCamPosRef = useRef<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });
  useEffect(() => {
    if (!activeSceneRefs) return;
    const interval = setInterval(() => {
      const cam = activeSceneRefs.camera;
      const lp = lastCamPosRef.current;
      const dx = cam.position.x - lp.x;
      const dy = cam.position.y - lp.y;
      const dz = cam.position.z - lp.z;
      // Only trigger React re-render if camera moved >1 unit
      if (dx * dx + dy * dy + dz * dz > 1) {
        const pos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
        lastCamPosRef.current = pos;
        setCameraPosition(pos);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [activeSceneRefs]);

  // ----- Camera teleport from outliner selection -----
  const teleportTarget = state.tools.cameraTeleportTarget;
  useEffect(() => {
    if (!teleportTarget) return;
    viewportRef.current.navigateCamera?.(
      teleportTarget.x,
      teleportTarget.z,
      teleportTarget.close,
    );
    actions.cameraTeleportConsumed();
  }, [teleportTarget, viewportRef, actions]);

  // ----- Entity count for viewport overlay -----
  const entityCount = useMemo(() => {
    const ext = state.extendedLayers;
    const world = state.builder.editing.world;
    let count = 0;
    count += ext.spawnPoints.length;
    count += ext.teleports.length;
    count += ext.mobSpawns.length;
    count += ext.resources.length;
    count += ext.stations.length;
    count += ext.pois.length;
    count += ext.waterBodies.length;
    if (world) {
      count += world.layers.npcs.length;
      count += world.layers.quests.length;
      count += world.layers.bosses.length;
      count += world.layers.events.length;
    }
    // P0.5.b — placement kinds (npcs/spawns/resources/stations/
    // teleports) live in extendedLayers and are already counted
    // above. agentWorldContent now only carries quests + zones.
    count += agentWorldContent.zones.size;
    count += agentWorldContent.quests.size;
    return count;
  }, [state.extendedLayers, state.builder.editing.world, agentWorldContent]);

  // Memoized roads prop — avoids creating a new array reference on every render
  // (which would cause TileBasedTerrain's useEffect to fire on every MOVE_TOWN
  // re-render, overwriting providedRoadsRef with stale road data during drag).
  // P2.a — agent + designer-authored `customRoads` (from path tool / agent's
  // PROPOSE_ROAD) are merged in alongside procgen-generated foundation roads
  // so the viewport renders a single unified road network.
  const foundationRoads = state.builder.editing.world?.foundation.roads;
  const customRoads = state.builder.editing.world?.layers.customRoads;
  const memoizedRoads = useMemo(() => {
    const out: Array<{ path: WorldPosition[]; width: number }> = [];
    if (foundationRoads) {
      for (const r of foundationRoads)
        out.push({ path: r.path, width: r.width });
    }
    if (customRoads) {
      for (const r of customRoads) out.push({ path: r.path, width: r.width });
    }
    return out.length > 0 ? out : undefined;
  }, [foundationRoads, customRoads]);

  // Memoized mines prop — same reason as roads above. Without memoization the
  // inline .map() creates a new array reference every render, which triggers
  // TileBasedTerrain's mine useEffect on every frame, unloading/reloading tiles.
  const extendedMines = state.extendedLayers?.mines;
  const worldCenterOffsetForMines =
    sceneRefsRef.current?.worldCenterOffset ?? 0;
  const memoizedMines = useMemo(() => {
    if (!extendedMines || extendedMines.length === 0) return undefined;
    return extendedMines.map((m) => ({
      position: {
        x: m.position.x - worldCenterOffsetForMines,
        y: m.position.y,
        z: m.position.z - worldCenterOffsetForMines,
      },
      radius: m.radius,
      radialOffsets: m.radialOffsets,
      entryAngle: m.entryAngle,
      biome: m.biome,
    }));
  }, [extendedMines, worldCenterOffsetForMines]);

  // Phase 3C: Memoize biomes and towns arrays for ViewportOverlay to prevent
  // re-renders from inline .map() creating new references every render
  const foundationBiomes = state.builder.editing.world?.foundation.biomes;
  const memoizedBiomes = useMemo(
    () =>
      foundationBiomes?.map((b) => ({ type: b.type, tileKeys: b.tileKeys })),
    [foundationBiomes],
  );
  const foundationTowns = state.builder.editing.world?.foundation.towns;
  const memoizedTowns = useMemo(
    () =>
      foundationTowns?.map((t) => ({
        id: t.id,
        name: t.name,
        position: t.position,
        size: t.size,
      })),
    [foundationTowns],
  );

  // ----- Editing hooks (self-guard on null sceneRefs / inactive tools) -----

  // Sync extended-layer entity markers and ghost preview to the 3D scene
  useEditorWorldSync({
    sceneRefs: activeSceneRefs,
    studioState: state,
    onSelectEntity: useCallback(
      (type: string, id: string) => {
        if (!isEditing) return;
        actions.setSelection({
          type: type as never,
          id,
          path: [{ type, id, name: id }],
        });
      },
      [isEditing, actions],
    ),
  });

  // Click-to-place viewport interaction (raycasts, rotation, confirm/cancel)
  usePlacementInteraction({
    sceneRefs: activeSceneRefs,
    gridSnap: snapEnabled,
    gridSize,
  });

  // Zone tile painting interaction + overlay
  useZonePainting({
    sceneRefs: activeSceneRefs,
  });

  // Brush painting (terrain sculpt, biome paint, vegetation, collision)
  useBrushInteraction({
    sceneRefs: activeSceneRefs,
    studioState: state,
    onTerrainSculpt: useCallback(
      (stroke) => actions.addTerrainSculpt(stroke),
      [actions],
    ),
    onBiomePaint: useCallback(
      (stroke) => actions.addBiomePaint(stroke),
      [actions],
    ),
    onVegetationPaint: useCallback(
      (stroke) => actions.addVegetationPaint(stroke),
      [actions],
    ),
    onMaterialPaint: useCallback(
      (stroke) => actions.addMaterialPaint(stroke),
      [actions],
    ),
    onFoliagePaint: useCallback(
      (stroke) => actions.addFoliagePaint(stroke),
      [actions],
    ),
    onTileCollision: useCallback(
      (tiles) => actions.setTileCollision(tiles),
      [actions],
    ),
  });

  // Apply brush strokes to terrain geometry (visual feedback)
  useBrushOverlaySync({
    sceneRefs: activeSceneRefs,
    studioState: state,
  });

  // Area boundary overlays (difficulty zones, town boundaries, biome regions)
  useAreaBoundaryOverlay(activeSceneRefs);

  // Audio zone overlays (music zones, ambient zones, SFX triggers)
  useAudioZoneOverlay(activeSceneRefs);

  // Wizard generation preview overlay (ghost towns, roads, zones, entities)
  useWizardPreviewOverlay(activeSceneRefs);

  // Phase 8.1: Water body polygon/waypoint editor
  const selectedWaterBody = useMemo(() => {
    const sel = state.builder.editing.selection;
    if (sel?.type !== "waterBody") return null;
    return (
      state.extendedLayers?.waterBodies?.find((wb) => wb.id === sel.id) ?? null
    );
  }, [state.builder.editing.selection, state.extendedLayers?.waterBodies]);

  // Reset water vertex mode when selection moves away from a water body
  useEffect(() => {
    if (!selectedWaterBody && state.tools.isAddingWaterVertices) {
      actions.setAddingWaterVertices(false);
    }
  }, [selectedWaterBody, state.tools.isAddingWaterVertices, actions]);

  useWaterBodyEditor({
    sceneRefs: activeSceneRefs,
    selectedWaterBody,
    onUpdateWaterBody: useCallback(
      (id: string, updates: Partial<import("../types").PlacedWaterBody>) =>
        actions.updateWaterBody(id, updates),
      [actions],
    ),
    isAddingVertices:
      state.tools.isAddingWaterVertices && selectedWaterBody !== null,
  });

  // Zone procgen — populate all regions from toolbar button
  const { generateAll: procgenGenerateAll } = useZoneProcgen();

  // Convert confirmed placement ghost into an actual entity in state
  usePlacementConfirmation();

  // ----- TileBasedTerrain callbacks -----

  // Handle tile count changes during creation preview
  // Use refs for values that change frequently to keep the callback identity stable
  // and avoid re-render loops between ViewportContainer ↔ TileBasedTerrain.
  const isCreationGeneratingRef = useRef(state.builder.creation.isGenerating);
  isCreationGeneratingRef.current = state.builder.creation.isGenerating;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const tileProgressRef = useRef<{ loaded: number; total: number } | null>(
    null,
  );

  const handleTileCountChange = useCallback(
    (loaded: number, total: number) => {
      // Only call setState if values actually changed
      const prev = tileProgressRef.current;
      if (!prev || prev.loaded !== loaded || prev.total !== total) {
        tileProgressRef.current = { loaded, total };
        setTileProgress({ loaded, total });
      }
      if (loaded > 0 && isCreationGeneratingRef.current) {
        actionsRef.current.finishGeneration({
          generationTime: 0,
          tiles: total,
          biomes: 0,
          towns: 0,
          roads: 0,
        });
      }
    },
    [], // stable — reads from refs
  );

  // Map TileBasedTerrain selection to WorldStudio selection
  const handleSelect = useCallback(
    (selection: ViewportSelection | null) => {
      if (!isEditing) return;
      // During placement/drawing modes, suppress selection — clicks handled by interaction hooks
      if (hasActivePlacementRef.current) return;
      if (activeToolRef.current === "zonePaint") return;
      if (!selection) {
        actions.setSelection(null);
        return;
      }
      // Map viewport selection types to WorldStudio selection
      if (
        selection.type === "entity" &&
        selection.entityType &&
        selection.entityId
      ) {
        // Map game world entity types to Selection types
        // Extended layer entities (from useEditorWorldSync) use their type directly
        const isExtended = selection.entityData?.isExtendedLayer;
        const GAME_ENTITY_TYPE_MAP: Record<string, string> = {
          npc: "gameNpc",
          station: "gameStation",
          ore: "gameResource",
          tree: "gameResource",
          mob_spawn: "gameMobSpawn",
        };
        const selType = isExtended
          ? selection.entityType!
          : (GAME_ENTITY_TYPE_MAP[selection.entityType!] ??
            selection.entityType!);
        const displayName =
          selection.entityDisplayName ?? selection.entityId.replace(/_/g, " ");
        actions.setSelection({
          type: selType as never,
          id: selection.entityId,
          path: [{ type: selType, id: selection.entityId, name: displayName }],
          entityData: {
            ...selection.entityData,
            selectableId: selection.id, // Preserve the selectableId for 3D object lookup
            position: selection.position,
          },
        });
      } else if (selection.type === "town") {
        actions.setSelection({
          type: "town" as never,
          id: selection.id,
          path: [
            {
              type: "town",
              id: selection.id,
              name: selection.townName ?? selection.id,
            },
          ],
        });
      } else if (selection.type === "building") {
        actions.setSelection({
          type: "building" as never,
          id: selection.id,
          path: [
            {
              type: "town",
              id: selection.townId ?? "",
              name: selection.townName ?? "",
            },
            {
              type: "building",
              id: selection.id,
              name: selection.buildingType ?? selection.id,
            },
          ],
        });
      } else if (
        selection.type === "vegetation" &&
        selection.vegetationSpecies
      ) {
        // Vegetation instance selection
        const speciesLabel = selection.vegetationSpecies
          .replace(/^tree_/, "")
          .replace(/_/g, " ");
        actions.setSelection({
          type: "vegetation" as never,
          id: selection.id,
          path: [{ type: "vegetation", id: selection.id, name: speciesLabel }],
          entityData: {
            species: selection.vegetationSpecies,
            instanceIndex: selection.vegetationInstanceIndex,
            position: selection.position,
          },
        });
      } else if (selection.type === "bridge") {
        actions.setSelection({
          type: "bridge" as never,
          id: selection.id,
          path: [
            {
              type: "bridge",
              id: selection.id,
              name: selection.id.replace(/_/g, " "),
            },
          ],
        });
      } else if (selection.type === "duelArena") {
        actions.setSelection({
          type: "duelArena" as never,
          id: selection.id,
          path: [{ type: "duelArena", id: selection.id, name: "Duel Arena" }],
        });
      } else if (
        selection.type === "tile" &&
        selection.tileData &&
        activeToolRef.current === "select"
      ) {
        // Tile inspector — only when select tool is active (not brush/place)
        actions.setSelection({
          type: "tile" as never,
          id: selection.id,
          path: [
            {
              type: "tile",
              id: selection.id,
              name: `Tile ${selection.tileKey ?? selection.id}`,
            },
          ],
          tileData: selection.tileData,
        });
      }
    },
    [isEditing, actions],
  );

  // ----- Drag-and-drop from EntityPalette -----
  // EntityPalette's handleDragStart already calls startPlacement() so the ghost
  // exists before dragover fires. Here we just raycast to terrain on dragover
  // to move the ghost, confirm on drop, and cancel on dragleave.

  /** Raycast from a client mouse position to terrain, return world pos or null */
  const raycastToTerrain = useCallback(
    (clientX: number, clientY: number, container: HTMLElement) => {
      if (!activeSceneRefs) return null;
      const rect = container.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const mouse = new THREE.Vector2(ndcX, ndcY);
      activeSceneRefs.raycaster.setFromCamera(mouse, activeSceneRefs.camera);
      const intersects = activeSceneRefs.raycaster.intersectObject(
        activeSceneRefs.terrainContainer,
        true,
      );
      if (intersects.length > 0) {
        const p = intersects[0].point;
        let x = p.x;
        let z = p.z;
        if (snapEnabled) {
          x = Math.round(x);
          z = Math.round(z);
        }
        return { x, y: p.y, z };
      }
      return null;
    },
    [activeSceneRefs, snapEnabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      // Accept entity palette drags
      if (e.dataTransfer.types.includes("application/x-entity-palette")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const pos = raycastToTerrain(
          e.clientX,
          e.clientY,
          e.currentTarget as HTMLElement,
        );
        if (pos) {
          actions.updatePlacementPosition(pos);
        }
        return;
      }
      // Accept file drops (GLTF/GLB)
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [raycastToTerrain, actions],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      // Handle entity palette drop
      if (e.dataTransfer.types.includes("application/x-entity-palette")) {
        e.preventDefault();
        const pos = raycastToTerrain(
          e.clientX,
          e.clientY,
          e.currentTarget as HTMLElement,
        );
        if (pos) {
          actions.updatePlacementPosition(pos);
        }
        actions.confirmPlacement();
        return;
      }
      // Handle file drop (GLTF/GLB import)
      if (e.dataTransfer.files.length > 0) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext !== "gltf" && ext !== "glb") {
          console.warn("[Viewport] Only .gltf and .glb files are supported");
          return;
        }
        const pos = raycastToTerrain(
          e.clientX,
          e.clientY,
          e.currentTarget as HTMLElement,
        );
        // Upload file then create custom asset entity
        const formData = new FormData();
        formData.append("file", file);
        fetch("/api/assets/upload", { method: "POST", body: formData })
          .then((res) => res.json())
          .then((result: { url?: string; originalName?: string }) => {
            if (result.url) {
              const id = `customAsset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              actions.addCustomAsset({
                id,
                name: result.originalName ?? file.name,
                assetId: result.url,
                assetName: result.originalName ?? file.name,
                position: pos ?? { x: 0, y: 0, z: 0 },
                rotation: 0,
                scale: 1,
                modelPath: result.url,
                properties: {},
              });
            }
          })
          .catch((err: unknown) => {
            console.error("[Viewport] Failed to upload asset:", err);
          });
      }
    },
    [raycastToTerrain, actions],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only cancel when leaving the viewport entirely (not entering a child)
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      actions.cancelPlacement();
    },
    [actions],
  );

  // Derive the selectedId to pass to TileBasedTerrain for its own highlighting
  const terrainSelectedId = isEditing ? selectedSelectableId : null;

  // Derive overlay selection info from WorldStudio selection
  const overlaySelection = useMemo(() => {
    if (!selection) return null;
    const name =
      selection.path.length > 0
        ? selection.path[selection.path.length - 1].name
        : selection.id;
    return { type: selection.type, id: selection.id, name };
  }, [selection]);

  // ----- Viewport context menu items -----
  const viewportContextItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (selection) {
      const selType = selection.type;
      const selId = selection.id;
      items.push(
        {
          label: "Focus Selection",
          shortcut: "F",
          onClick: () => {
            if (selectedSelectableId && activeSceneRefs) {
              let found: THREE.Object3D | null = null;
              activeSceneRefs.scene.traverse((obj) => {
                if (found) return;
                if (obj.userData?.selectableId === selectedSelectableId) {
                  found = obj;
                }
              });
              if (found) {
                const box = new THREE.Box3().setFromObject(found);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const radius = size.length() / 2;
                activeSceneRefs.focusOnPosition(center, radius);
              }
            }
            hideContextMenu();
          },
        },
        {
          label: "Duplicate",
          shortcut: "⌘D",
          onClick: () => {
            executeDuplicate(
              state,
              actions,
              selType,
              selId,
              registry,
              dispatch,
            );
            hideContextMenu();
          },
        },
        {
          label: "Delete",
          shortcut: "Del",
          danger: true,
          onClick: () => {
            executeDelete(state, actions, selType, selId, registry, dispatch);
            hideContextMenu();
          },
        },
        {
          label: "Create Prefab",
          onClick: () => {
            const name = executeCreatePrefab(state, actions, [
              { type: selType, id: selId },
            ]);
            if (!name) {
              console.warn("[Viewport] Failed to create prefab from selection");
            }
            hideContextMenu();
          },
        },
        { label: "", separator: true },
      );

      // Flatten Terrain Below — for structures that sit on terrain
      const FLATTENABLE_TYPES = new Set(["building", "bridge", "duelArena"]);
      if (FLATTENABLE_TYPES.has(selType)) {
        items.push({
          label: "Flatten Terrain Below",
          onClick: () => {
            if (selectedSelectableId && activeSceneRefs) {
              let found: THREE.Object3D | null = null;
              activeSceneRefs.scene.traverse((obj) => {
                if (found) return;
                if (obj.userData?.selectableId === selectedSelectableId) {
                  found = obj;
                }
              });
              if (found) {
                const box = new THREE.Box3().setFromObject(found);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                // Sharp falloff gives full strength within 70% of radius, so
                // divide by 0.7 to ensure the entire footprint is fully flattened.
                const diagonal = Math.sqrt(size.x * size.x + size.z * size.z);
                const footprintRadius = diagonal / 2 + 2;
                actions.addTerrainSculpt({
                  id: `flatten_${selId}_${Date.now()}`,
                  center: { x: center.x, z: center.z },
                  radius: footprintRadius / 0.7,
                  strength: 1.0,
                  falloff: "sharp",
                  mode: "flatten",
                  flattenTarget: box.min.y,
                  timestamp: Date.now(),
                });
              }
            }
            hideContextMenu();
          },
        });
      }
    }

    items.push({
      label: "Toggle Grid",
      onClick: () => {
        handleGridToggle();
        hideContextMenu();
      },
    });

    // Generate Town Here — raycast from context menu click position to get world coordinates
    items.push({
      label: "Generate Town Here",
      icon: undefined,
      onClick: () => {
        // Compute world position from the context menu click via camera look-at or raycast
        let worldPos = { x: 0, y: 0, z: 0 };
        if (activeSceneRefs) {
          // Raycast from context menu screen position to terrain
          const rect = activeSceneRefs.container.getBoundingClientRect();
          const ndcX =
            ((contextMenu.position.x - rect.left) / rect.width) * 2 - 1;
          const ndcY =
            -((contextMenu.position.y - rect.top) / rect.height) * 2 + 1;
          const mouse = new THREE.Vector2(ndcX, ndcY);
          activeSceneRefs.raycaster.setFromCamera(
            mouse,
            activeSceneRefs.camera,
          );
          const hits = activeSceneRefs.raycaster.intersectObject(
            activeSceneRefs.terrainContainer,
            true,
          );
          if (hits.length > 0) {
            const p = hits[0].point;
            worldPos = { x: p.x, y: p.y, z: p.z };
          } else {
            // Fallback: project to y=0 plane from camera
            const cam = activeSceneRefs.camera;
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(
              cam.quaternion,
            );
            if (dir.y !== 0) {
              const t = -cam.position.y / dir.y;
              worldPos = {
                x: cam.position.x + dir.x * t,
                y: 0,
                z: cam.position.z + dir.z * t,
              };
            }
          }
        }
        setTownDialogPosition(worldPos);
        hideContextMenu();
      },
    });

    // Create Wilderness Boundary (singleton — only if none exists)
    if (!state.extendedLayers.wildernessBoundary) {
      items.push({
        label: "Create Wilderness Boundary",
        onClick: () => {
          // Raycast to get world position at click
          let worldZ = 0;
          let worldX = 0;
          if (activeSceneRefs) {
            const rect = activeSceneRefs.container.getBoundingClientRect();
            const ndcX =
              ((contextMenu.position.x - rect.left) / rect.width) * 2 - 1;
            const ndcY =
              -((contextMenu.position.y - rect.top) / rect.height) * 2 + 1;
            const mouse = new THREE.Vector2(ndcX, ndcY);
            activeSceneRefs.raycaster.setFromCamera(
              mouse,
              activeSceneRefs.camera,
            );
            const hits = activeSceneRefs.raycaster.intersectObject(
              activeSceneRefs.terrainContainer,
              true,
            );
            if (hits.length > 0) {
              worldX = hits[0].point.x;
              worldZ = hits[0].point.z;
            }
          }
          // Create a default east-west line at click Z position
          const span = 500;
          actions.setWildernessBoundary({
            points: [
              { x: worldX - span, z: worldZ },
              { x: worldX, z: worldZ },
              { x: worldX + span, z: worldZ },
            ],
            levelScale: 10,
            maxLevel: 56,
          });
          hideContextMenu();
        },
      });
    }

    // Camera bookmarks
    if (activeSceneRefs) {
      items.push({ label: "", separator: true });
      items.push({
        label: "Save Camera Bookmark",
        onClick: () => {
          const cam = activeSceneRefs.camera;
          const name = `Bookmark ${bookmarks.length + 1}`;
          addBookmark(
            name,
            { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            { x: 0, y: 0, z: 0 },
          );
          hideContextMenu();
        },
      });
      if (bookmarks.length > 0) {
        for (const bm of bookmarks) {
          items.push({
            label: `📍 ${bm.name}`,
            onClick: () => {
              activeSceneRefs.focusOnPosition(
                new THREE.Vector3(bm.position.x, bm.position.y, bm.position.z),
                20,
              );
              hideContextMenu();
            },
          });
        }
      }
    }

    return items;
  }, [
    selection,
    selectedSelectableId,
    state,
    actions,
    activeSceneRefs,
    bookmarks,
    addBookmark,
    hideContextMenu,
    handleGridToggle,
    contextMenu.position,
  ]);

  return (
    <div
      className="flex-1 relative bg-bg-primary"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <TileBasedTerrain
        config={config}
        // Phase B0'.B / B0'.E follow-up — blank-template projects
        // skip vegetation entirely (no manifest-tree fetch, no
        // procgen tree fallback). Hyperia + every other template
        // gets the full vegetation pipeline.
        showVegetation={state.project.templateId !== "blank"}
        selectedId={terrainSelectedId}
        onTileCountChange={handleTileCountChange}
        onSelect={handleSelect}
        onSceneReady={handleSceneReady}
        hideBuiltinOverlays={isEditing}
        onGameEntitiesLoaded={handleGameEntitiesLoaded}
        onViewportContextMenu={handleViewportContextMenu}
        onFlyModeChange={setFlyMode}
        onPlayerModeChange={handlePlayerModeChange}
        onMoveSpeedChange={setCameraMoveSpeed}
        showDifficultyHeatmap={showDifficultyHeatmap}
        dangerSources={heatmapDangerSources}
        roads={foundationRoads}
        mines={memoizedMines}
        onTownsGenerated={handleTownsGenerated}
        brushOverlays={state.brushOverlays}
        importedQuerier={importedQuerier}
        timeOfDay={timeOfDay}
        enableShadows={enableShadows}
        enableBloom={enableBloom}
        enableGameFog={enableGameFog}
        enableSky={enableSky}
        enableGrass={enableGrass}
      />
      {/* Viewport info overlay (UE5-style corner HUD) */}
      {isEditing && (
        <ViewportOverlay
          selection={overlaySelection}
          entityCount={entityCount}
          activeTool={activeTool}
          transformMode={transformMode}
          transformSpace={transformSpace}
          cameraPosition={cameraPosition}
          gridEnabled={gridVisible}
          snapEnabled={snapEnabled}
          surfaceSnap={surfaceSnap}
          gridSize={gridSize}
          tileProgress={tileProgress}
          worldSizeTiles={config?.terrain.worldSize}
          tileSize={config?.terrain.tileSize}
          biomes={memoizedBiomes}
          roads={memoizedRoads}
          towns={memoizedTowns}
          onNavigateCamera={(x, z) =>
            viewportRef.current.navigateCamera?.(x, z)
          }
          flyMode={flyMode}
          cameraMoveSpeed={cameraMoveSpeed}
          showDifficultyHeatmap={showDifficultyHeatmap}
          onToggleDifficultyHeatmap={() => setShowDifficultyHeatmap((v) => !v)}
          onPopulateAllRegions={() => procgenGenerateAll(Date.now())}
          onToggleGrid={handleGridToggle}
          onToggleSnap={handleSnapToggle}
          onToggleSurfaceSnap={handleSurfaceSnapToggle}
          onCycleGridSize={handleCycleGridSize}
        />
      )}

      {/* View mode dropdown + player preview button (top-right) */}
      {isEditing && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
          <button
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-[4px] border transition-all duration-120 ${
              playerMode
                ? "bg-[rgba(99,102,241,0.15)] text-primary border-primary/40 shadow-[0_0_8px_rgba(99,102,241,0.15)]"
                : "bg-[#16171d] text-white/60 hover:text-white/80 border-[#252733] hover:bg-[#1e1f28]"
            }`}
            onClick={handleTogglePlayerMode}
            title="Player Preview (walk the world at eye height)"
          >
            Player Preview
          </button>
          <ViewModeDropdown
            currentMode={viewMode}
            onModeChange={handleViewModeChange}
          />
        </div>
      )}

      {/* Player preview / PIE overlay indicator */}
      {playerMode && (
        <div
          className="absolute top-10 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 backdrop-blur-sm text-white text-xs font-medium rounded-[4px] border shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          style={{
            backgroundColor: state.pie.active
              ? "rgba(16, 185, 129, 0.85)"
              : "rgba(99, 102, 241, 0.85)",
            borderColor: state.pie.active
              ? "rgba(16, 185, 129, 0.3)"
              : "rgba(99, 102, 241, 0.3)",
          }}
        >
          {state.pie.active
            ? "Play-In-Editor — WASD to move, Shift to sprint, Escape to exit"
            : "Player Preview — Escape to exit"}
        </div>
      )}

      {/* PIE crosshair */}
      {state.pie.active && playerMode && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="w-4 h-4 relative opacity-40">
            <div className="absolute left-1/2 top-0 w-px h-full bg-white -translate-x-1/2" />
            <div className="absolute top-1/2 left-0 w-full h-px bg-white -translate-y-1/2" />
          </div>
        </div>
      )}

      {/* PIE debug console — bottom-right of viewport while PIE is active */}
      {state.pie.active && (
        <div
          data-pie-no-interact
          className="absolute bottom-3 right-3 z-20 pointer-events-none"
        >
          <PIEConsolePanel />
        </div>
      )}

      {/* Viewport overlay toggles (right side, below view mode dropdown) */}
      {isEditing && <ViewportOverlayBar />}

      {/* Viewport context menu */}
      {contextMenu.visible && (
        <ContextMenu
          items={viewportContextItems}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}

      {/* Generate Town dialog */}
      {townDialogPosition && (
        <GenerateTownDialog
          position={townDialogPosition}
          onClose={() => setTownDialogPosition(null)}
          onGenerated={() => setTownDialogPosition(null)}
        />
      )}

      {/* PIE HUD overlay — manifest-driven widgets contributed by the
          active game's plugins (e.g. shooter-demo's crosshair). Only
          renders while PIE is in play mode; static layout per game id. */}
      {state.pie.active && state.pie.mode === "play" ? (
        <PIEHudOverlay
          registry={getWidgetRegistry()}
          getDataContext={getDataContext}
          gameId={resolveGamePluginSetId()}
        />
      ) : null}
    </div>
  );
}
