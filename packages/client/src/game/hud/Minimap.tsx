/**
 * Minimap.tsx - 2D Minimap Component
 *
 * Shows player position, nearby entities, and terrain on a 2D minimap.
 * Orchestrates canvas lifecycle, RAF loop, and satellite hooks.
 *
 * Rendering: Overlay (roads, buildings, entities, destination) is rendered
 * off-thread by shared MinimapWorker via OffscreenCanvas. Terrain background
 * stays on main thread (biome-aware cache in useMinimapTerrainCache).
 * Interaction logic lives in useMinimapInteraction.ts.
 */

import React, { memo, useEffect, useRef } from "react";
import { useThemeStore, useQuestSelectionStore } from "@/ui";
import {
  Entity,
  THREE,
  MinimapWorkerManager,
  isMinimapWorkerSupported,
  type MinimapEntity as WorkerEntity,
  type MinimapRoad as WorkerRoad,
  type MinimapBuilding as WorkerBuilding,
} from "@hyperscape/shared";
import type { ClientWorld } from "../../types";
import { type EntityPip, useMinimapEntityPips } from "./useMinimapEntityPips";
import { useQuestStatusSync } from "./useQuestStatusSync";
import {
  type MinimapRoadWithAABB,
  type MinimapTown,
  type MinimapRoad,
  useMinimapWorldCaches,
} from "./useMinimapWorldCaches";
import {
  MINIMAP_TERRAIN_OVERSHOOT,
  useMinimapTerrainCache,
} from "./useMinimapTerrainCache";
import {
  type MinimapRenderState,
  type HyperscapeWindow,
  createRenderState,
  getSpectatorTarget,
} from "./minimapTypes";
import { useMinimapInteraction } from "./useMinimapInteraction";

// Shared with terrain-cache generation so draw-time coverage matches the
// cached snapshot's real world footprint.
const TERRAIN_OVERSHOOT = MINIMAP_TERRAIN_OVERSHOOT;

// Terrain draw is just a transformed drawImage() pass, so keep it in sync with
// live overlay motion instead of throttling it behind the player.
const RENDER_EVERY_N_FRAMES = 1;

/** Minimal structural interface for elements that can be rotated via inline style */
interface CSSStylable {
  style: { transform: string };
}

/** Drag handle props passed from Window component for edit mode dragging */
interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  style: React.CSSProperties;
}

interface MinimapProps {
  world: ClientWorld;
  width?: number;
  height?: number;
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
  onCompassClick?: () => void;
  isVisible?: boolean;
  /** If true, minimap can be resized by dragging corners */
  resizable?: boolean;
  /** Callback when size changes */
  onSizeChange?: (width: number, height: number) => void;
  /** Minimum size when resizable */
  minSize?: number;
  /** Maximum size when resizable */
  maxSize?: number;
  /** If true, removes decorative border/shadow for embedding in panels */
  embedded?: boolean;
  /** If true, minimap can be collapsed to a corner icon */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Drag handle props for edit mode (passed from Window component) */
  dragHandleProps?: DragHandleProps;
  /** Whether edit mode is unlocked (shows drag border) */
  isUnlocked?: boolean;
}

function MinimapInner({
  world,
  width: initialWidth = 200,
  height: initialHeight = 200,
  zoom = 10,
  className = "",
  style = {},
  onCompassClick: _onCompassClick,
  isVisible = true,
  resizable = true,
  onSizeChange,
  minSize = 80,
  maxSize,
  embedded: _embedded = false,
  collapsible = false,
  defaultCollapsed = false,
  onCollapseChange,
  dragHandleProps,
  isUnlocked = false,
}: MinimapProps) {
  const theme = useThemeStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const entityPipsRefForRender = useRef<EntityPip[]>([]);
  const entityCacheRef = useRef<Map<string, EntityPip>>(new Map());
  const renderStateRef = useRef<MinimapRenderState>(createRenderState());
  const lastDestinationWorldRef = useRef<{ x: number; z: number } | null>(null);
  const workerRef = useRef<MinimapWorkerManager | null>(null);
  const workerInitializedRef = useRef(false);

  // Always rotate with the main camera (RS3-style).
  const rotateWithCameraRef = useRef<boolean>(true);
  // Direct ref to the collapsed compass SVG -- yaw is written via DOM to avoid
  // triggering React reconciliation from inside requestAnimationFrame.
  const compassRef = useRef<CSSStylable | null>(null);

  const {
    terrainOffscreenRef,
    terrainCacheCenterRef,
    terrainCacheExtentRef,
    terrainCacheUpRef,
    invalidateTerrainCache,
    clearTerrainCache,
    ensureTerrainCache,
  } = useMinimapTerrainCache(world);

  // Cached 2D rendering contexts -- avoids DOM query every frame
  const mainCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Static world feature caches -- populated once, used for overlay with fixed pixel sizes
  const roadsCacheRef = useRef<MinimapRoad[] | null>(null);
  const roadsWithAABBRef = useRef<MinimapRoadWithAABB[] | null>(null);
  const townsCacheRef = useRef<MinimapTown[] | null>(null);

  // Quest statuses for minimap quest icons (ref for access in entity loop)
  const questStatusesRef = useRef<Map<string, string>>(new Map());
  const setQuestStatuses = useQuestSelectionStore((s) => s.setQuestStatuses);

  useQuestStatusSync({ world, questStatusesRef, setQuestStatuses });

  // ── Interaction hook ─────────────────────────────────────────────────────────
  const interaction = useMinimapInteraction({
    world,
    initialWidth,
    initialHeight,
    zoom,
    resizable,
    minSize,
    maxSize,
    onSizeChange,
    collapsible,
    defaultCollapsed,
    onCollapseChange,
    cameraRef,
    canvasRef,
    overlayCanvasRef,
    containerRef,
    renderStateRef,
    lastDestinationWorldRef,
  });

  const {
    width,
    height,
    widthRef,
    heightRef,
    extentRef,
    targetExtentRef,
    isCollapsed,
    isResizing,
    toggleCollapse,
    onCollapseButtonClick,
    onOverlayClick,
    onPreventDefault,
    onStopAndPrevent,
    handleResizeStart,
  } = interaction;

  // ── Camera init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas || !overlayCanvas) return;

    const camera = new THREE.OrthographicCamera(
      -targetExtentRef.current,
      targetExtentRef.current,
      targetExtentRef.current,
      -targetExtentRef.current,
      0.1,
      2000,
    );
    const initialForward = new THREE.Vector3();
    if (world?.camera) {
      world.camera.getWorldDirection(initialForward);
    } else {
      initialForward.set(0, 0, -1);
    }
    initialForward.y = 0;
    if (initialForward.lengthSq() < 0.0001) {
      initialForward.set(0, 0, -1);
    } else {
      initialForward.normalize();
    }
    camera.up.copy(initialForward);
    camera.position.set(0, 500, 0);
    camera.lookAt(0, 0, 0);
    camera.userData.isMinimap = true;
    cameraRef.current = camera;

    canvas.width = width;
    canvas.height = height;
    mainCtxRef.current = canvas.getContext("2d");
    overlayCtxRef.current = overlayCanvas.getContext("2d");
    invalidateTerrainCache();

    // Resize worker if it exists
    if (workerRef.current) {
      workerRef.current.resize(width, height);
    }

    // Note: extent intentionally omitted - changes handled via extentRef in render loop
  }, [width, height, world]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (cameraRef.current) {
        cameraRef.current.userData = {};
        cameraRef.current = null;
      }
      clearTerrainCache();
      roadsCacheRef.current = null;
      roadsWithAABBRef.current = null;
      townsCacheRef.current = null;
      entityCacheRef.current.clear();
      if (workerRef.current) {
        workerRef.current.dispose();
        workerRef.current = null;
        workerInitializedRef.current = false;
      }
    };
  }, [clearTerrainCache]);

  // ── Satellite hooks ──────────────────────────────────────────────────────────
  useMinimapEntityPips({
    world,
    isVisible,
    extentRef,
    questStatusesRef,
    entityPipsRefForRender,
    entityCacheRef,
  });
  useMinimapWorldCaches({
    world,
    roadsCacheRef,
    roadsWithAABBRef,
    townsCacheRef,
  });

  // ── RAF render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !isVisible) return;

    let rafId: number | null = null;
    let frameCount = 0;

    const render = () => {
      frameCount++;
      const frameTimeMs = performance.now();
      const cam = cameraRef.current;
      const rs = renderStateRef.current;
      const forwardVec = rs.forwardVec;
      const projectVec = rs.projectVec;
      const destVec = rs.destVec;
      const targetPos = rs.targetPos;
      const pvMatrix = rs.projectionViewMatrix;

      // --- Camera Position Update (follow player or spectated entity) ---
      const player = world.entities?.player as Entity | undefined;
      let hasTarget = false;

      if (player) {
        targetPos.x = player.node.position.x;
        targetPos.z = player.node.position.z;
        hasTarget = true;
      } else {
        const spectatorTarget = getSpectatorTarget(world);
        if (spectatorTarget) {
          targetPos.x = spectatorTarget.position.x;
          targetPos.z = spectatorTarget.position.z;
          hasTarget = true;
        }
      }

      if (cam && hasTarget) {
        cam.position.x = targetPos.x;
        cam.position.z = targetPos.z;
        cam.lookAt(targetPos.x, 0, targetPos.z);

        if (rotateWithCameraRef.current && world.camera) {
          world.camera.getWorldDirection(forwardVec);
          forwardVec.y = 0;
          if (forwardVec.lengthSq() > 1e-6) {
            forwardVec.normalize();
            const yaw = Math.atan2(forwardVec.x, -forwardVec.z);
            cam.up.set(Math.sin(yaw), 0, -Math.cos(yaw));
            if (compassRef.current) {
              compassRef.current.style.transform = `rotate(${THREE.MathUtils.radToDeg(yaw)}deg)`;
            }
          }
        } else {
          cam.up.set(0, 0, -1);
        }

        // Clear destination when reached
        const destWorld = lastDestinationWorldRef.current;
        if (destWorld) {
          const dx = destWorld.x - targetPos.x;
          const dz = destWorld.z - targetPos.z;
          if (dx * dx + dz * dz < 0.36) {
            lastDestinationWorldRef.current = null;
          }
        }

        // Also clear global raycast target when player reaches it
        const hw = window as HyperscapeWindow;
        if (hw.__lastRaycastTarget) {
          const dx = hw.__lastRaycastTarget.x - targetPos.x;
          const dz = hw.__lastRaycastTarget.z - targetPos.z;
          if (dx * dx + dz * dz < 0.36) delete hw.__lastRaycastTarget;
        }
      }

      // --- Camera Frustum Update (for zoom) ---
      if (cam) {
        const currentExtent = extentRef.current;
        const desiredExtent = targetExtentRef.current;
        if (Math.abs(desiredExtent - currentExtent) > 0.01) {
          const zoomDelta = desiredExtent - currentExtent;
          const zoomStep =
            Math.sign(zoomDelta) *
            Math.min(60, Math.max(2, Math.abs(zoomDelta) * 0.24));
          extentRef.current =
            Math.abs(zoomDelta) <= Math.abs(zoomStep)
              ? desiredExtent
              : currentExtent + zoomStep;
        }
        const liveExtent = extentRef.current;
        if (cam.right !== liveExtent) {
          cam.left = -liveExtent;
          cam.right = liveExtent;
          cam.top = liveExtent;
          cam.bottom = -liveExtent;
          cam.updateProjectionMatrix();
        }
      }

      // --- Update camera matrices every frame ---
      if (cam) {
        cam.updateMatrixWorld();
        pvMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        rs.hasCachedMatrix = true;
      }

      // --- Canvas 2D terrain background ---
      const shouldRedrawTerrain = frameCount % RENDER_EVERY_N_FRAMES === 0;
      if (shouldRedrawTerrain && cam) {
        const mainCanvas = canvasRef.current;
        const mainCtx = mainCtxRef.current;
        if (mainCanvas && mainCtx) {
          const cw = mainCanvas.width;
          const ch = mainCanvas.height;
          const centerX = cam.position.x;
          const centerZ = cam.position.z;
          const currentExtent = extentRef.current;
          const upX = cam.up.x;
          const upZ = cam.up.z;
          const cachedYaw = Math.atan2(
            terrainCacheUpRef.current.x,
            -terrainCacheUpRef.current.z,
          );
          const currentYaw = Math.atan2(upX, -upZ);
          const deltaYaw = currentYaw - cachedYaw;

          ensureTerrainCache({
            centerX,
            centerZ,
            currentExtent,
            upX,
            upZ,
            viewportPixels: Math.max(cw, ch),
          });

          mainCtx.save();
          mainCtx.translate(cw / 2, ch / 2);
          mainCtx.rotate(-deltaYaw);
          mainCtx.translate(-cw / 2, -ch / 2);

          if (terrainOffscreenRef.current) {
            mainCtx.imageSmoothingEnabled = true;
            mainCtx.imageSmoothingQuality = "high";
            const cachedExt = terrainCacheExtentRef.current;
            const extentScale = cachedExt > 0 ? cachedExt / currentExtent : 1;
            const drawScale = Math.max(1 / TERRAIN_OVERSHOOT, extentScale);
            const drawW = cw * TERRAIN_OVERSHOOT * drawScale;
            const drawH = ch * TERRAIN_OVERSHOOT * drawScale;
            const cachedUpX = terrainCacheUpRef.current.x;
            const cachedUpZ = terrainCacheUpRef.current.z;
            const cachedRightX = -cachedUpZ;
            const cachedRightZ = cachedUpX;
            const cachedCenterX = terrainCacheCenterRef.current.x;
            const cachedCenterZ = terrainCacheCenterRef.current.z;
            const centerDeltaX = centerX - cachedCenterX;
            const centerDeltaZ = centerZ - cachedCenterZ;
            const offsetRight =
              centerDeltaX * cachedRightX + centerDeltaZ * cachedRightZ;
            const offsetUp =
              centerDeltaX * cachedUpX + centerDeltaZ * cachedUpZ;
            const pixelsPerWorldX = cw / (2 * currentExtent);
            const pixelsPerWorldY = ch / (2 * currentExtent);
            const offsetX = -offsetRight * pixelsPerWorldX;
            const offsetY = offsetUp * pixelsPerWorldY;
            mainCtx.fillStyle = "#11161c";
            mainCtx.fillRect(0, 0, cw, ch);
            mainCtx.drawImage(
              terrainOffscreenRef.current,
              cw / 2 - drawW / 2 + offsetX,
              ch / 2 - drawH / 2 + offsetY,
              drawW,
              drawH,
            );
          } else {
            mainCtx.fillStyle = "#11161c";
            mainCtx.fillRect(0, 0, cw, ch);
          }

          mainCtx.restore();
        }
      }

      // --- Worker overlay (roads, buildings, entities, destination) ---
      if (cam && isMinimapWorkerSupported()) {
        // Lazy-init worker on first frame (ImageBitmap mode — avoids
        // transferControlToOffscreen() which makes the overlay canvas opaque)
        if (!workerInitializedRef.current && overlayCanvas) {
          workerInitializedRef.current = true;
          const mgr = new MinimapWorkerManager(
            overlayCanvas.width,
            overlayCanvas.height,
          );
          workerRef.current = mgr;
          mgr.init();
          mgr.setOnBitmap((bitmap) => {
            const ctx = overlayCtxRef.current;
            if (ctx) {
              ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
              ctx.drawImage(bitmap, 0, 0);
              bitmap.close();
            }
          });
        }

        const worker = workerRef.current;
        if (worker?.isReady()) {
          // Camera yaw from world camera forward direction
          let yaw = 0;
          if (rotateWithCameraRef.current && cam.up) {
            yaw = Math.atan2(cam.up.x, -cam.up.z);
          }

          worker.updateCamera({
            x: cam.position.x,
            z: cam.position.z,
            extent: extentRef.current,
            rotation: yaw,
          });

          // Convert EntityPip[] to WorkerEntity[]
          const pips = entityPipsRefForRender.current;
          const workerEntities: WorkerEntity[] = [];
          for (let i = 0; i < pips.length; i++) {
            const pip = pips[i];
            workerEntities.push({
              id: pip.id,
              x: pip.position.x,
              z: pip.position.z,
              type: pip.type as WorkerEntity["type"],
              color: pip.color,
              size: pip.type === "quest" ? 6 : pip.type === "player" ? 4 : 3,
              isLocalPlayer: pip.isLocalPlayer,
              groupIndex: pip.groupIndex,
              subType: pip.subType,
              isActive: pip.isActive,
              icon: pip.icon,
            });
          }
          worker.updateEntities(workerEntities);

          // Send roads (only when cache changes, but send every frame for simplicity — worker replaces array)
          const roads = roadsWithAABBRef.current;
          if (roads) {
            worker.updateRoads(roads as WorkerRoad[]);
          }

          // Send buildings from town data
          const towns = townsCacheRef.current;
          if (towns) {
            const workerBuildings: WorkerBuilding[] = [];
            for (const town of towns) {
              for (const b of town.buildings) {
                workerBuildings.push({
                  x: b.position.x,
                  z: b.position.z,
                  width: b.size.width,
                  depth: b.size.depth,
                  rotation: b.rotation,
                });
              }
            }
            worker.updateBuildings(workerBuildings);
          }

          // Destination marker
          const lastTarget = (window as HyperscapeWindow).__lastRaycastTarget;
          const destWorldRef = lastDestinationWorldRef.current;
          const hasLastTarget =
            lastTarget &&
            Number.isFinite(lastTarget.x) &&
            Number.isFinite(lastTarget.z);
          const markerX = hasLastTarget ? lastTarget.x : destWorldRef?.x;
          const markerZ = hasLastTarget ? lastTarget.z : destWorldRef?.z;

          if (markerX !== undefined && markerZ !== undefined) {
            worker.updateDestination(markerX, markerZ);
          } else {
            worker.clearDestination();
          }

          worker.render();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [isVisible, world]);

  // ── Collapsed state render ───────────────────────────────────────────────────
  if (collapsible && isCollapsed) {
    return (
      <div
        className={`minimap-collapsed cursor-pointer select-none ${className}`}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: `2px solid ${theme.colors.border.decorative}`,
          backgroundColor: theme.colors.background.glass,
          boxShadow: `${theme.shadows.md}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
        onClick={toggleCollapse}
        title="Expand Minimap (Tab)"
      >
        <svg
          ref={(el) => {
            compassRef.current = el;
          }}
          width="18"
          height="18"
          viewBox="0 0 18 18"
          style={{
            transform: "rotate(0deg)",
            transition: "transform 0.1s ease-out",
          }}
        >
          <polygon
            points="9,2 14,14 9,11 4,14"
            fill={theme.colors.accent.primary}
            stroke={theme.colors.text.primary}
            strokeWidth="1"
          />
        </svg>
      </div>
    );
  }

  // ── Expanded state render ────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`minimap overflow-hidden relative touch-none select-none ${className}`}
      style={{
        width,
        height,
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        ...style,
      }}
      onMouseDown={onPreventDefault}
      onContextMenu={onPreventDefault}
    >
      {/* Terrain canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 block w-full h-full z-0"
      />
      {/* 2D overlay for pips */}
      <canvas
        ref={overlayCanvasRef}
        width={width}
        height={height}
        className="absolute inset-0 block w-full h-full pointer-events-auto cursor-crosshair z-[1]"
        onClick={onOverlayClick}
        onMouseDown={onStopAndPrevent}
        onContextMenu={onStopAndPrevent}
      />
      {/* Resize handle (SE corner) */}
      {resizable && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20 pointer-events-auto"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${theme.colors.border.decorative} 50%)`,
          }}
          onPointerDown={handleResizeStart}
        />
      )}

      {/* Resize indicator overlay when resizing */}
      {isResizing && (
        <div className="absolute inset-0 border-2 border-yellow-400/50 rounded-lg pointer-events-none z-30" />
      )}

      {/* Edit mode drag overlay */}
      {isUnlocked && dragHandleProps && (
        <div
          className="absolute cursor-move pointer-events-auto"
          style={{
            zIndex: 50,
            top: 10,
            left: 10,
            right: 10,
            bottom: 10,
            background: "rgba(100, 180, 255, 0.08)",
            border: "1px dashed rgba(100, 180, 255, 0.4)",
            borderRadius: 4,
          }}
          onPointerDown={dragHandleProps.onPointerDown}
          title="Drag to move minimap"
        />
      )}

      {/* Collapse button (top-right) */}
      {collapsible && (
        <button
          className="absolute z-20 pointer-events-auto cursor-pointer"
          style={{
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            borderRadius: theme.borderRadius.sm,
            border: `1px solid ${theme.colors.border.default}`,
            backgroundColor: theme.colors.background.glass,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: theme.colors.text.secondary,
            padding: 0,
          }}
          onClick={onCollapseButtonClick}
          title="Collapse Minimap (Tab)"
        >
          −
        </button>
      )}
    </div>
  );
}

export const Minimap = memo(MinimapInner);
