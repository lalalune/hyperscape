/**
 * useMinimapInteraction.ts - Minimap zoom, resize, click-to-teleport, and collapse interaction handlers.
 *
 * Extracts all user interaction logic from the Minimap component into a single hook.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THREE, INPUT, TerrainSystem } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";
import {
  type MinimapRenderState,
  type HyperscapeWindow,
} from "./MinimapRenderer";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Zoom bounds and step size -- kept at module scope for stability across re-renders */
const MIN_EXTENT = 20;
const MAX_EXTENT = 1000;
const STEP_EXTENT = 10;

/**
 * Reference minimap pixel size at which the initial zoom level is 1:1.
 * sizeBasedExtent = zoom * (avgSize / MINIMAP_BASE_SIZE_PX)
 */
const MINIMAP_BASE_SIZE_PX = 200;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UseMinimapInteractionOptions {
  world: ClientWorld;
  initialWidth: number;
  initialHeight: number;
  zoom: number;
  resizable: boolean;
  minSize: number;
  maxSize?: number;
  onSizeChange?: (width: number, height: number) => void;
  collapsible: boolean;
  defaultCollapsed: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  /** Refs from the parent component needed for coordinate transforms */
  cameraRef: React.RefObject<THREE.OrthographicCamera | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  renderStateRef: React.RefObject<MinimapRenderState>;
  lastDestinationWorldRef: React.MutableRefObject<{
    x: number;
    z: number;
  } | null>;
}

export interface UseMinimapInteractionReturn {
  /** Current display width */
  width: number;
  /** Current display height */
  height: number;
  /** Ref to width for RAF loop access */
  widthRef: React.RefObject<number>;
  /** Ref to height for RAF loop access */
  heightRef: React.RefObject<number>;
  /** Live displayed extent in world units */
  extentRef: React.MutableRefObject<number>;
  /** Target extent (for smooth zoom animation) */
  targetExtentRef: React.RefObject<number>;
  /** Whether the minimap is collapsed */
  isCollapsed: boolean;
  /** Whether the minimap is being resized */
  isResizing: boolean;
  /** Toggle collapsed state */
  toggleCollapse: () => void;
  /** Collapse button click handler (swallows event) */
  onCollapseButtonClick: (e: React.MouseEvent) => void;
  /** Overlay canvas click handler */
  onOverlayClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Generic preventDefault handler */
  onPreventDefault: (e: React.SyntheticEvent) => void;
  /** stopPropagation + preventDefault handler */
  onStopAndPrevent: (e: React.SyntheticEvent) => void;
  /** SE corner resize pointerDown handler */
  handleResizeStart: (e: React.PointerEvent) => void;
  /** Debounce ref for minimap click timing */
  lastClickTimeRef: React.RefObject<number>;
}

export function useMinimapInteraction(
  opts: UseMinimapInteractionOptions,
): UseMinimapInteractionReturn {
  const {
    world,
    initialWidth,
    initialHeight,
    zoom,
    resizable,
    minSize,
    maxSize,
    onSizeChange,
    collapsible: _collapsible,
    defaultCollapsed,
    onCollapseChange,
    cameraRef,
    canvasRef,
    overlayCanvasRef,
    containerRef,
    renderStateRef,
    lastDestinationWorldRef,
  } = opts;

  // ── Collapse state ───────────────────────────────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      onCollapseChange?.(newValue);
      return newValue;
    });
  }, [onCollapseChange]);

  const onCollapseButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleCollapse();
    },
    [toggleCollapse],
  );

  // ── Size state ───────────────────────────────────────────────────────────────
  const [currentWidth, setCurrentWidth] = useState(initialWidth);
  const [currentHeight, setCurrentHeight] = useState(initialHeight);
  const width = currentWidth;
  const height = currentHeight;

  const widthRef = useRef(width);
  const heightRef = useRef(height);

  useEffect(() => {
    widthRef.current = width;
    heightRef.current = height;
  }, [width, height]);

  // ── Zoom / extent state ──────────────────────────────────────────────────────
  const sizeBasedExtent = useMemo(() => {
    const avgSize = (width + height) / 2;
    return zoom * (avgSize / MINIMAP_BASE_SIZE_PX);
  }, [width, height, zoom]);

  const [targetExtent, setTargetExtent] = useState<number>(sizeBasedExtent);
  const targetExtentRef = useRef<number>(targetExtent);
  const extentRef = useRef<number>(targetExtent);

  useEffect(() => {
    setTargetExtent(sizeBasedExtent);
  }, [sizeBasedExtent]);

  useEffect(() => {
    targetExtentRef.current = targetExtent;
  }, [targetExtent]);

  // ── Resize state ─────────────────────────────────────────────────────────────
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const latestSizeRef = useRef({ w: initialWidth, h: initialHeight });

  // Cleanup dangling resize listeners on unmount
  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (!resizable) return;
      e.preventDefault();
      e.stopPropagation();

      setIsResizing(true);
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: width,
        h: height,
      };

      const handleMove = (moveEvent: PointerEvent) => {
        if (!resizeStartRef.current) return;

        const dx = moveEvent.clientX - resizeStartRef.current.x;
        const dy = moveEvent.clientY - resizeStartRef.current.y;
        const newW = resizeStartRef.current.w + dx;
        const newH = resizeStartRef.current.h + dy;

        const effectiveMaxSize = maxSize ?? Infinity;
        const clampedW = Math.max(
          minSize,
          Math.min(effectiveMaxSize, Math.round(newW / 8) * 8),
        );
        const clampedH = Math.max(
          minSize,
          Math.min(effectiveMaxSize, Math.round(newH / 8) * 8),
        );
        setCurrentWidth(clampedW);
        setCurrentHeight(clampedH);
        latestSizeRef.current = { w: clampedW, h: clampedH };
      };

      const cleanupResize = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        resizeCleanupRef.current = null;
      };

      const handleUp = () => {
        setIsResizing(false);
        resizeStartRef.current = null;
        onSizeChange?.(latestSizeRef.current.w, latestSizeRef.current.h);
        cleanupResize();
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      resizeCleanupRef.current = cleanupResize;
    },
    [resizable, width, height, minSize, maxSize, onSizeChange],
  );

  // ── Click-to-move ────────────────────────────────────────────────────────────
  const lastClickTimeRef = useRef<number>(0);

  const screenToWorldXZ = useCallback(
    (clientX: number, clientY: number): { x: number; z: number } | null => {
      const cam = cameraRef.current;
      const cvs = overlayCanvasRef.current || canvasRef.current;
      if (!cam || !cvs) return null;

      const rect = cvs.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const vec = renderStateRef.current.unprojectVec;
      vec.set(ndcX, ndcY, 0);
      vec.unproject(cam);
      return { x: vec.x, z: vec.z };
    },
    [cameraRef, overlayCanvasRef, canvasRef, renderStateRef],
  );

  const handleMinimapClick = useCallback(
    (clientX: number, clientY: number) => {
      const now = performance.now();
      if (now - lastClickTimeRef.current < 150) return;
      lastClickTimeRef.current = now;

      const worldPos = screenToWorldXZ(clientX, clientY);
      if (!worldPos) return;

      const player = world.entities?.player as
        | { position?: { x: number; z: number }; runMode?: boolean }
        | undefined;
      if (!player?.position) return;
      const dx = worldPos.x - player.position.x;
      const dz = worldPos.z - player.position.z;
      const dist = Math.hypot(dx, dz);
      let targetX = worldPos.x;
      let targetZ = worldPos.z;
      if (dist > INPUT.MAX_CLICK_DISTANCE_TILES) {
        const scale = INPUT.MAX_CLICK_DISTANCE_TILES / dist;
        targetX = player.position.x + dx * scale;
        targetZ = player.position.z + dz * scale;
      }

      const terrainSystem = world.getSystem<TerrainSystem>("terrain");
      let targetY = 0;
      if (terrainSystem?.getHeightAt) {
        const h = terrainSystem.getHeightAt(targetX, targetZ);
        targetY = (Number.isFinite(h) ? h : 0) + 0.1;
      }

      const currentRun = (player as { runMode?: boolean }).runMode === true;
      world.network?.send?.("moveRequest", {
        target: [targetX, targetY, targetZ],
        runMode: currentRun,
        cancel: false,
      });

      lastDestinationWorldRef.current = { x: targetX, z: targetZ };
      (window as HyperscapeWindow).__lastRaycastTarget = {
        x: targetX,
        y: targetY,
        z: targetZ,
        method: "minimap",
      };
    },
    [screenToWorldXZ, world, lastDestinationWorldRef],
  );

  const onOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      handleMinimapClick(e.clientX, e.clientY);
    },
    [handleMinimapClick],
  );

  // ── Generic event handlers ───────────────────────────────────────────────────
  const onPreventDefault = useCallback(
    (e: React.SyntheticEvent) => e.preventDefault(),
    [],
  );

  const onStopAndPrevent = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sign = Math.sign(e.deltaY);
    if (sign === 0) return;
    const steps = Math.max(
      1,
      Math.min(5, Math.round(Math.abs(e.deltaY) / 100)),
    );
    setTargetExtent((prev) =>
      THREE.MathUtils.clamp(
        prev + sign * steps * STEP_EXTENT,
        MIN_EXTENT,
        MAX_EXTENT,
      ),
    );
  }, []);

  // Attach wheel listener with { passive: false } to allow preventDefault()
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, containerRef]);

  return {
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
    lastClickTimeRef,
  };
}
