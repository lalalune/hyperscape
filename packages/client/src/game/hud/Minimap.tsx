/**
 * Minimap.tsx - 2D Minimap Component
 *
 * Shows player position, nearby entities, and terrain on a 2D minimap.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useThemeStore, useQuestSelectionStore } from "@/ui";
import { Entity, EventType, THREE } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";
// Water threshold height — matches TERRAIN_CONSTANTS.WATER_THRESHOLD
const MINIMAP_WATER_THRESHOLD = 9.0;

// Height-based color palette for Canvas 2D terrain background.
// Colors map to height ranges after the water threshold.
// These approximate the visual terrain biome colors seen in the 3D view.
const MINIMAP_TERRAIN_COLORS: Array<{
  maxHeight: number;
  r: number;
  g: number;
  b: number;
}> = [
  { maxHeight: MINIMAP_WATER_THRESHOLD, r: 30, g: 60, b: 130 }, // deep water
  { maxHeight: MINIMAP_WATER_THRESHOLD + 1, r: 50, g: 100, b: 160 }, // shallow water
  { maxHeight: 15, r: 70, g: 110, b: 70 }, // swamp/wetland
  { maxHeight: 22, r: 80, g: 140, b: 60 }, // low grassland
  { maxHeight: 30, r: 90, g: 130, b: 50 }, // grassland
  { maxHeight: 36, r: 110, g: 120, b: 55 }, // forest / rolling hills
  { maxHeight: 42, r: 130, g: 110, b: 80 }, // highland
  { maxHeight: 48, r: 140, g: 120, b: 95 }, // mountain
  { maxHeight: Infinity, r: 160, g: 155, b: 155 }, // snow peak
];

/**
 * Convert a world-space (wx, wz) point to canvas pixel coordinates.
 * Derived by inverting the terrain-pixel unproject transform, accounting for
 * the minimap orthographic camera's up vector (which rotates with the player).
 */
function worldToPx(
  wx: number,
  wz: number,
  centerX: number,
  centerZ: number,
  extent: number,
  upX: number,
  upZ: number,
  cw: number,
  ch: number,
): [number, number] {
  const dx = wx - centerX;
  const dz = wz - centerZ;
  // Project (dx,dz) onto camera right and up axes.
  // right = (-upZ, upX) in XZ.  ndcX = dot((dx,dz), right) / extent
  const ndcX = (dz * upX - dx * upZ) / extent;
  // ndcY = -dot((dx,dz), up) / extent  (canvas Y is inverted vs world Z)
  const ndcY = -(dx * upX + dz * upZ) / extent;
  return [(ndcX * 0.5 + 0.5) * cw, (-ndcY * 0.5 + 0.5) * ch];
}

// === PRE-ALLOCATED VECTORS FOR HOT PATHS ===
// These vectors are reused in RAF loops and intervals to avoid GC pressure

/** Temp vector for RAF loop camera direction calculations */
const _tempForwardVec = new THREE.Vector3();

/** Temp vector for pip position projection in render loop */
const _tempProjectVec = new THREE.Vector3();

/** Temp vector for destination marker rendering */
const _tempDestVec = new THREE.Vector3();

/** Temp vector for screenToWorldXZ unprojection */
const _tempUnprojectVec = new THREE.Vector3();

/** Pre-allocated position object for RAF loop target position - avoids GC pressure */
const _tempTargetPos: { x: number; z: number } = { x: 0, z: 0 };

/** Cached projection-view matrix from last 3D render - keeps pips synced with throttled 3D */
const _cachedProjectionViewMatrix = new THREE.Matrix4();
let _hasCachedMatrix = false;

interface EntityPip {
  id: string;
  type: "player" | "enemy" | "building" | "item" | "resource" | "quest";
  position: THREE.Vector3;
  color: string;
  /** Whether this pip is actively selected/tracked (for pulse animation) */
  isActive?: boolean;
  /** Shape variant for special rendering */
  icon?: "star" | "circle" | "diamond";
  /** Group member index for color assignment (-1 or undefined = not in group) */
  groupIndex?: number;
  /** Whether this is the local player (renders as square) */
  isLocalPlayer?: boolean;
  /** Location subtype for minimap icons (bank, shop, altar, etc.) */
  subType?: string;
}

/** Window extension for last raycast target diagnostic (used by both world clicks and minimap) */
type WindowWithRaycastTarget = Window &
  typeof globalThis & {
    __lastRaycastTarget?: {
      x: number;
      y: number;
      z: number;
      method: string;
    };
  };

/** Color palette for group members (up to 8 unique) */
const GROUP_COLORS = [
  "#4CAF50", // Green - party leader
  "#2196F3", // Blue
  "#9C27B0", // Purple
  "#FF9800", // Orange
  "#00BCD4", // Cyan
  "#E91E63", // Pink
  "#CDDC39", // Lime
  "#607D8B", // Blue-grey
];

/**
 * Draw a star shape on canvas for quest markers
 */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number = 5,
): void {
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < 2 * points; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

/**
 * Draw a diamond shape on canvas
 */
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size); // Top
  ctx.lineTo(cx + size, cy); // Right
  ctx.lineTo(cx, cy + size); // Bottom
  ctx.lineTo(cx - size, cy); // Left
  ctx.closePath();
}

/**
 * Draw a red flag destination marker (RS3-style)
 * Simple: thin pole + small filled triangle flag
 */
function drawFlag(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Pole
  ctx.strokeStyle = "#880000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 3);
  ctx.lineTo(cx, cy - 5);
  ctx.stroke();

  // Flag (small filled triangle off the pole)
  ctx.fillStyle = "#ff0000";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx + 5, cy - 3);
  ctx.lineTo(cx, cy - 1);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw minimap icon for a location type.
 * Style: clean filled glyph with 1px dark outline, ~8px.
 * Returns true if drawn, false for default dot fallback.
 */
function drawMinimapIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  subType: string,
): boolean {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000000";

  switch (subType) {
    // --- Bank: gold coin ($) ---
    case "bank":
      ctx.fillStyle = "#daa520";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", cx + 0.5, cy + 1);
      break;

    // --- Shop: small open-top bag ---
    case "shop":
      ctx.fillStyle = "#daa520";
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 4);
      ctx.lineTo(cx - 4, cy + 5);
      ctx.lineTo(cx + 4, cy + 5);
      ctx.lineTo(cx + 5, cy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    // --- Prayer altar: simple cross ---
    case "altar":
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx - 1.5, cy - 6, 3, 12);
      ctx.fillRect(cx - 5, cy - 2.5, 10, 3);
      ctx.strokeRect(cx - 1.5, cy - 6, 3, 12);
      ctx.strokeRect(cx - 5, cy - 2.5, 10, 3);
      break;

    // --- Runecrafting altar: purple circle ---
    case "runecrafting_altar":
      ctx.fillStyle = "#7744cc";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("R", cx + 0.5, cy + 1);
      break;

    // --- Anvil: dark flat anvil silhouette ---
    case "anvil":
      ctx.fillStyle = "#666666";
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 4);
      ctx.lineTo(cx - 4, cy - 1);
      ctx.lineTo(cx - 5, cy - 4);
      ctx.lineTo(cx + 5, cy - 4);
      ctx.lineTo(cx + 4, cy - 1);
      ctx.lineTo(cx + 6, cy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    // --- Furnace: orange circle with flame ---
    case "furnace":
      ctx.fillStyle = "#dd5500";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Simple flame (inverted drop)
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.quadraticCurveTo(cx + 3, cy + 1, cx, cy + 4);
      ctx.quadraticCurveTo(cx - 3, cy + 1, cx, cy - 4);
      ctx.fill();
      break;

    // --- Cooking range: brown circle with steam ---
    case "range":
      ctx.fillStyle = "#8b5e3c";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Two short steam lines
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + 1);
      ctx.lineTo(cx - 2, cy - 3);
      ctx.moveTo(cx + 2, cy + 1);
      ctx.lineTo(cx + 2, cy - 3);
      ctx.stroke();
      break;

    // --- Fishing spot: cyan dot with fish ---
    case "fishing":
      ctx.fillStyle = "#2288cc";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      // Tiny fish shape
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx - 1, cy, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(cx + 2.5, cy);
      ctx.lineTo(cx + 5, cy - 2.5);
      ctx.lineTo(cx + 5, cy + 2.5);
      ctx.closePath();
      ctx.fill();
      break;

    // --- Mining rock: brown dot with pickaxe ---
    case "mining":
      ctx.fillStyle = "#8b6914";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      // Diagonal pick handle
      ctx.strokeStyle = "#dddddd";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, cy + 3.5);
      ctx.lineTo(cx + 3.5, cy - 3.5);
      ctx.stroke();
      // Pick head
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 5);
      ctx.lineTo(cx + 5, cy - 1);
      ctx.stroke();
      break;

    // --- Tree: green circle ---
    case "tree":
      ctx.fillStyle = "#228822";
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#115511";
      ctx.stroke();
      break;

    // --- Quest NPC (available): blue circle with white "!" ---
    case "quest_available":
    case "quest":
      ctx.fillStyle = "#2196F3";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", cx + 0.5, cy + 1);
      break;

    // --- Quest NPC (in progress): blue circle with white "?" ---
    case "quest_in_progress":
      ctx.fillStyle = "#2196F3";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", cx + 0.5, cy + 1);
      break;

    default:
      ctx.restore();
      return false;
  }

  ctx.restore();
  return true;
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

export function Minimap({
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
  const [entityPips, setEntityPips] = useState<EntityPip[]>([]);
  const entityPipsRefForRender = useRef<EntityPip[]>([]);
  const entityCacheRef = useRef<Map<string, EntityPip>>(new Map());

  // Canvas 2D terrain background cache
  const terrainCacheRef = useRef<ImageData | null>(null);
  // World-space center when the cache was last generated (reused object — no per-frame allocation)
  const terrainCacheCenterRef = useRef<{ x: number; z: number }>({
    x: Infinity,
    z: Infinity,
  });
  // Extent (half-width in world units) when the cache was last generated
  const terrainCacheExtentRef = useRef<number>(0);
  // Camera up vector when the cache was last generated (reused object)
  const terrainCacheUpRef = useRef<{ x: number; z: number }>({ x: 0, z: -1 });

  // Cached 2D rendering contexts — avoids DOM query every frame
  const mainCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Static world feature caches — populated once, never change after world init
  const roadsCacheRef = useRef<Array<{
    path: Array<{ x: number; z: number }>;
    width: number;
  }> | null>(null);
  const townsCacheRef = useRef<Array<{
    buildings: Array<{
      position: { x: number; z: number };
      size: { width: number; depth: number };
      rotation: number;
    }>;
  }> | null>(null);

  // Quest statuses for minimap quest icons (ref for access in entity loop)
  const questStatusesRef = useRef<Map<string, string>>(new Map());
  const setQuestStatuses = useQuestSelectionStore((s) => s.setQuestStatuses);

  // Fetch quest statuses from server for minimap quest icons
  useEffect(() => {
    /** Server quest status type */
    type ServerQuestStatus =
      | "not_started"
      | "in_progress"
      | "ready_to_complete"
      | "completed";
    type ClientQuestState = "available" | "active" | "completed";

    const mapStatus = (status: ServerQuestStatus): ClientQuestState => {
      switch (status) {
        case "not_started":
          return "available";
        case "in_progress":
        case "ready_to_complete":
          return "active";
        case "completed":
          return "completed";
        default:
          return "available";
      }
    };

    const fetchQuestList = () => {
      world.network?.send?.("getQuestList", {});
    };

    const onQuestList = (data: unknown) => {
      if (typeof data !== "object" || data === null) return;
      const payload = data as {
        quests?: Array<{ id: string; status: ServerQuestStatus }>;
      };
      if (!Array.isArray(payload.quests)) return;

      const mapped = payload.quests.map((q) => ({
        id: q.id,
        state: mapStatus(q.status),
      }));

      // Update ref for synchronous access in entity loop
      const map = new Map<string, string>();
      for (const q of mapped) {
        map.set(q.id, q.state);
      }
      questStatusesRef.current = map;

      // Update store for external consumers
      setQuestStatuses(mapped);
    };

    const onQuestEvent = () => {
      fetchQuestList();
    };

    world.network?.on("questList", onQuestList);
    world.on(EventType.QUEST_STARTED, onQuestEvent);
    world.on(EventType.QUEST_PROGRESSED, onQuestEvent);
    world.on(EventType.QUEST_COMPLETED, onQuestEvent);

    // Initial fetch
    fetchQuestList();

    return () => {
      world.network?.off("questList", onQuestList);
      world.off(EventType.QUEST_STARTED, onQuestEvent);
      world.off(EventType.QUEST_PROGRESSED, onQuestEvent);
      world.off(EventType.QUEST_COMPLETED, onQuestEvent);
    };
  }, [world, setQuestStatuses]);

  // Collapsed state for collapsible minimap
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Handle collapse toggle
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      onCollapseChange?.(newValue);
      return newValue;
    });
  }, [onCollapseChange]);

  // Current size state (for resizing)
  const [currentWidth, setCurrentWidth] = useState(initialWidth);
  const [currentHeight, setCurrentHeight] = useState(initialHeight);
  const width = currentWidth;
  const height = currentHeight;

  // Refs for width/height to allow RAF loop to access current values without stale closures
  const widthRef = useRef(width);
  const heightRef = useRef(height);

  // Keep dimension refs updated for RAF loop access
  useEffect(() => {
    widthRef.current = width;
    heightRef.current = height;
  }, [width, height]);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Calculate extent based on size - larger size = more visible area (not scaled)
  // Use the average of width/height to determine extent
  const sizeBasedExtent = useMemo(() => {
    // Base extent at 200px is the initial zoom value
    // When size increases, we reveal more map (increase extent proportionally)
    const baseSize = 200;
    const avgSize = (width + height) / 2;
    return zoom * (avgSize / baseSize);
  }, [width, height, zoom]);

  // Minimap zoom state (orthographic half-extent in world units)
  const [extent, setExtent] = useState<number>(sizeBasedExtent);
  const extentRef = useRef<number>(extent); // Ref for synchronous access in render loop
  const MIN_EXTENT = 20;
  const MAX_EXTENT = 1000; // Increased to support larger sizes and full viewport
  const STEP_EXTENT = 10;

  // Update extent when size changes (reveals more map)
  useEffect(() => {
    setExtent(sizeBasedExtent);
  }, [sizeBasedExtent]);

  // Rotation: follow main camera yaw (RS3-like) with North toggle
  const [rotateWithCamera] = useState<boolean>(true);
  const rotateWithCameraRef = useRef<boolean>(rotateWithCamera);
  const [yawDeg, setYawDeg] = useState<number>(0);

  // Refs for destination state - allows RAF loop to access without restarting
  const lastDestinationWorldRef = useRef<{ x: number; z: number } | null>(null);
  const lastMinimapClickScreenRef = useRef<{ x: number; y: number } | null>(
    null,
  );
  // Persistent destination (stays until reached or new click)
  const [lastDestinationWorld, setLastDestinationWorld] = useState<{
    x: number;
    z: number;
  } | null>(null);
  // For minimap clicks: keep the pixel where user clicked until arrival
  const [lastMinimapClickScreen, setLastMinimapClickScreen] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Red click indicator state
  const [clickIndicator] = useState<{
    x: number;
    y: number;
    opacity: number;
  } | null>(null);

  // Initialize minimap camera (no WebGPU renderer needed — Canvas 2D handles all drawing)
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas || !overlayCanvas) return;

    // Create orthographic camera for overhead view
    const camera = new THREE.OrthographicCamera(
      -extent,
      extent,
      extent,
      -extent,
      0.1,
      2000,
    );
    // Orient minimap to match main camera heading on XZ plane
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

    // Mark camera as minimap for systems that need to check (e.g., water system)
    camera.userData.isMinimap = true;

    cameraRef.current = camera;

    // Ensure both canvases have the correct backing size
    canvas.width = width;
    canvas.height = height;
    overlayCanvas.width = width;
    overlayCanvas.height = height;

    // Cache 2D contexts once (getContext is a DOM query — avoid calling every frame)
    mainCtxRef.current = canvas.getContext("2d");
    overlayCtxRef.current = overlayCanvas.getContext("2d");

    // Invalidate terrain cache when canvas dimensions change
    terrainCacheRef.current = null;

    // Note: extent intentionally omitted - changes handled via extentRef in render loop
  }, [width, height, world]);

  // Cleanup camera reference and terrain cache when component unmounts
  useEffect(() => {
    return () => {
      // Clear camera reference and userData
      if (cameraRef.current) {
        if (cameraRef.current.userData) {
          Object.keys(cameraRef.current.userData).forEach((key) => {
            delete cameraRef.current!.userData[key];
          });
        }
        cameraRef.current = null;
      }

      // Clear terrain cache and static world feature caches
      terrainCacheRef.current = null;
      terrainCacheCenterRef.current.x = Infinity;
      terrainCacheCenterRef.current.z = Infinity;
      roadsCacheRef.current = null;
      townsCacheRef.current = null;

      // Clear entity cache to prevent memory retention
      entityCacheRef.current.clear();
    };
  }, []);

  // Keep refs in sync with state for render loop access
  // This allows the single RAF loop to read current values without restarting
  useEffect(() => {
    extentRef.current = extent;
  }, [extent]);

  useEffect(() => {
    rotateWithCameraRef.current = rotateWithCamera;
  }, [rotateWithCamera]);

  useEffect(() => {
    lastDestinationWorldRef.current = lastDestinationWorld;
  }, [lastDestinationWorld]);

  useEffect(() => {
    lastMinimapClickScreenRef.current = lastMinimapClickScreen;
  }, [lastMinimapClickScreen]);

  // Collect entity data for pips (update at a moderate cadence, only when visible)
  useEffect(() => {
    if (!world.entities || !isVisible) return;

    // console.log('[Minimap] Starting entity detection updates');
    let intervalId: number | null = null;

    // Pre-allocate working arrays/maps to avoid GC pressure in 200ms interval
    // We swap between two caches to track which entities are still valid
    const workingPips: EntityPip[] = [];
    const seenIds = new Set<string>();

    const update = () => {
      // Clear working arrays (reuse allocation)
      workingPips.length = 0;
      seenIds.clear();

      const player = world.entities?.player as Entity | undefined;
      let playerPipId: string | null = null;

      if (player?.node?.position) {
        // Normal mode: local player is the green pip
        // Reuse cached pip if available
        let playerPip = entityCacheRef.current.get("local-player");
        if (!playerPip) {
          playerPip = {
            id: "local-player",
            type: "player",
            position: player.node.position,
            color: "#ffffff",
            isLocalPlayer: true,
          };
          entityCacheRef.current.set("local-player", playerPip);
        } else {
          playerPip.position = player.node.position;
          playerPip.color = "#ffffff";
          playerPip.isLocalPlayer = true;
        }
        workingPips.push(playerPip);
        seenIds.add("local-player");
        playerPipId = player.id;
      } else {
        // Spectator mode: get spectated entity from camera system as green pip
        const config = (
          window as {
            __HYPERSCAPE_CONFIG__?: { mode?: string; followEntity?: string };
          }
        ).__HYPERSCAPE_CONFIG__;
        if (config?.mode === "spectator") {
          const cameraSystem = world.getSystem("client-camera-system") as {
            getCameraInfo?: () => {
              target?: { id?: string; node?: { position?: THREE.Vector3 } };
            };
          } | null;
          const cameraInfo = cameraSystem?.getCameraInfo?.();
          if (cameraInfo?.target?.node?.position) {
            // Reuse cached pip if available
            let spectatedPip = entityCacheRef.current.get("spectated-player");
            if (!spectatedPip) {
              spectatedPip = {
                id: "spectated-player",
                type: "player",
                position: cameraInfo.target.node.position,
                color: "#ffffff",
                isLocalPlayer: true,
              };
              entityCacheRef.current.set("spectated-player", spectatedPip);
            } else {
              spectatedPip.position = cameraInfo.target.node.position;
              spectatedPip.color = "#ffffff";
              spectatedPip.isLocalPlayer = true;
            }
            workingPips.push(spectatedPip);
            seenIds.add("spectated-player");
            playerPipId = cameraInfo.target.id ?? null;
          }
        }
      }

      // Add other players using entities system for reliable positions
      if (world.entities) {
        const players = world.entities.getAllPlayers();
        for (let i = 0; i < players.length; i++) {
          const otherPlayer = players[i];
          // Skip local player or spectated entity (already shown as green pip)
          if (
            (player && otherPlayer.id === player.id) ||
            (playerPipId && otherPlayer.id === playerPipId)
          ) {
            continue;
          }
          const otherEntity = world.entities.get(otherPlayer.id);
          if (otherEntity && otherEntity.node && otherEntity.node.position) {
            // Reuse existing pip from cache if available to avoid GC pressure
            let playerPip = entityCacheRef.current.get(otherPlayer.id);
            if (playerPip) {
              // Reuse existing Vector3, just update coordinates
              playerPip.position.set(
                otherEntity.node.position.x,
                0,
                otherEntity.node.position.z,
              );
              playerPip.color = "#ffffff";
            } else {
              // New entity, create a new Vector3
              playerPip = {
                id: otherPlayer.id,
                type: "player",
                position: new THREE.Vector3(
                  otherEntity.node.position.x,
                  0,
                  otherEntity.node.position.z,
                ),
                color: "#ffffff",
              };
              entityCacheRef.current.set(otherPlayer.id, playerPip);
            }
            workingPips.push(playerPip);
            seenIds.add(otherPlayer.id);
          }
        }
      }

      // Add pips for all known entities safely (cached)
      // Note: We use the entity system exclusively for detecting mobs/buildings.
      // Scene traversal was removed as it caused stale dots (matched static objects by name)
      if (world.entities) {
        const allEntities = world.entities.getAll();
        for (let i = 0; i < allEntities.length; i++) {
          const entity = allEntities[i];
          // Skip if no valid position
          const pos = entity?.position;
          if (!pos) continue;

          let color = "#ffffff";
          let type: EntityPip["type"] = "item";
          let subType: string | undefined;

          switch (entity.type) {
            case "player":
              // Already handled above; skip to avoid duplicates
              continue;
            case "mob":
            case "enemy":
              color = "#ffff00"; // OSRS: yellow for NPCs/mobs
              type = "enemy";
              break;
            case "npc": {
              color = "#ffff00"; // OSRS: yellow for NPCs
              type = "enemy"; // NPCs show as yellow dots like mobs
              // Detect NPC service type for minimap icons
              const npcConfig = (
                entity as unknown as {
                  config?: {
                    services?: string[];
                    questIds?: string[];
                  };
                }
              ).config;
              const serviceTypes = npcConfig?.services;
              if (serviceTypes?.includes("bank")) {
                subType = "bank";
              } else if (serviceTypes?.includes("shop")) {
                subType = "shop";
              }
              // Quest icon with state awareness (overrides shop for quest+shop NPCs)
              if (serviceTypes?.includes("quest")) {
                const questIds = npcConfig?.questIds;
                const statuses = questStatusesRef.current;
                if (questIds && questIds.length > 0 && statuses.size > 0) {
                  let hasAvailable = false;
                  let hasActive = false;
                  let allCompleted = true;
                  for (const qid of questIds) {
                    const state = statuses.get(qid);
                    if (state === "available") hasAvailable = true;
                    else if (state === "active") hasActive = true;
                    if (state !== "completed") allCompleted = false;
                  }
                  if (hasAvailable) {
                    subType = "quest_available";
                  } else if (hasActive) {
                    subType = "quest_in_progress";
                  } else if (!allCompleted) {
                    // No status data yet, show generic quest icon
                    subType = "quest_available";
                  }
                  // If all completed, don't override subType (keep bank/shop or nothing)
                } else {
                  // No quest status data loaded yet, show generic quest icon
                  subType = "quest_available";
                }
              }
              break;
            }
            case "bank":
              color = "#ffff00";
              type = "building";
              subType = "bank";
              break;
            case "furnace":
              color = "#ffff00";
              type = "building";
              subType = "furnace";
              break;
            case "anvil":
              color = "#ffff00";
              type = "building";
              subType = "anvil";
              break;
            case "range":
              color = "#ffff00";
              type = "building";
              subType = "range";
              break;
            case "altar":
              color = "#ffff00";
              type = "building";
              subType = "altar";
              break;
            case "runecrafting_altar":
              color = "#ffff00";
              type = "building";
              subType = "runecrafting_altar";
              break;
            case "building":
            case "structure":
              color = "#ffff00"; // OSRS: yellow (same as NPCs)
              type = "building";
              break;
            case "item":
            case "loot":
              color = "#ff0000"; // OSRS: red for ground items
              type = "item";
              break;
            case "resource": {
              color = "#ffff00"; // OSRS: yellow (same as NPCs)
              type = "resource";
              // Detect resource subtype for minimap icons
              const resConfig = (
                entity as unknown as {
                  config?: { resourceType?: string; harvestSkill?: string };
                }
              ).config;
              if (
                resConfig?.resourceType === "fishing_spot" ||
                resConfig?.harvestSkill === "fishing"
              ) {
                subType = "fishing";
              } else if (
                resConfig?.resourceType === "mining_rock" ||
                resConfig?.harvestSkill === "mining"
              ) {
                subType = "mining";
              } else if (
                resConfig?.resourceType === "tree" ||
                resConfig?.harvestSkill === "woodcutting"
              ) {
                subType = "tree";
              }
              break;
            }
            default:
              color = "#cccccc";
              type = "item";
          }

          // Reuse existing pip from cache if available to avoid GC pressure
          let entityPip = entityCacheRef.current.get(entity.id);
          if (entityPip) {
            // Reuse existing Vector3, just update coordinates
            entityPip.position.set(pos.x, 0, pos.z);
            entityPip.type = type;
            entityPip.color = color;
            entityPip.subType = subType;
          } else {
            // New entity, create a new Vector3
            entityPip = {
              id: entity.id,
              type,
              position: new THREE.Vector3(pos.x, 0, pos.z),
              color,
              subType,
            };
            entityCacheRef.current.set(entity.id, entityPip);
          }
          workingPips.push(entityPip);
          seenIds.add(entity.id);
        }
      }

      // Clean up cache: remove entities that are no longer present
      // This prevents stale pips from entities that despawned
      const cacheKeys = entityCacheRef.current.keys();
      for (const id of cacheKeys) {
        if (!seenIds.has(id)) {
          entityCacheRef.current.delete(id);
        }
      }

      setEntityPips(workingPips);
    };

    update();
    intervalId = window.setInterval(update, 200);
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        // console.log('[Minimap] Stopped entity detection updates');
      }
    };
  }, [world, isVisible]);

  // Single unified render loop - handles camera position, frustum, and rendering
  // Uses refs for all state access to avoid restarting the RAF loop
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !isVisible) return;

    let rafId: number | null = null;
    let frameCount = 0;

    // Throttle terrain background redraw to ~15fps (every 4th frame)
    // 2D pip overlay still updates every frame for smooth interaction
    const RENDER_EVERY_N_FRAMES = 4;

    // Note: We use module-level pre-allocated vectors (_tempForwardVec, _tempProjectVec, etc.)
    // to avoid allocations in this hot render loop

    const render = () => {
      // Skip render loop entirely when not visible to reduce CPU usage
      if (!isVisible) {
        // Don't continue RAF when hidden - the useEffect will restart when visible
        return;
      }

      frameCount++;
      // Cache time once per frame — reused for pulse animations, avoids Date.now() per-pip
      const frameTimeMs = performance.now();
      const cam = cameraRef.current;

      // --- Camera Position Update (follow player or spectated entity) ---
      // Reuse pre-allocated _tempTargetPos to avoid GC pressure
      const player = world.entities?.player as Entity | undefined;
      let hasTarget = false;

      if (player) {
        // Normal mode: follow local player
        _tempTargetPos.x = player.node.position.x;
        _tempTargetPos.z = player.node.position.z;
        hasTarget = true;
      } else {
        // Spectator mode: get camera target from camera system
        const config = (
          window as {
            __HYPERSCAPE_CONFIG__?: { mode?: string; followEntity?: string };
          }
        ).__HYPERSCAPE_CONFIG__;
        if (config?.mode === "spectator") {
          const cameraSystem = world.getSystem("client-camera-system") as {
            getCameraInfo?: () => {
              target?: { position?: { x: number; z: number } };
            };
          } | null;
          const cameraInfo = cameraSystem?.getCameraInfo?.();
          if (cameraInfo?.target?.position) {
            _tempTargetPos.x = cameraInfo.target.position.x;
            _tempTargetPos.z = cameraInfo.target.position.z;
            hasTarget = true;
          }
        }
      }

      if (cam && hasTarget) {
        // Keep centered on target (player or spectated entity)
        // Using pre-allocated _tempTargetPos to avoid GC pressure
        cam.position.x = _tempTargetPos.x;
        cam.position.z = _tempTargetPos.z;
        cam.lookAt(_tempTargetPos.x, 0, _tempTargetPos.z);

        // Rotate minimap with main camera yaw if enabled
        if (rotateWithCameraRef.current && world.camera) {
          const worldCam = world.camera;
          // Reuse pre-allocated vector to avoid GC pressure
          worldCam.getWorldDirection(_tempForwardVec);
          _tempForwardVec.y = 0;
          if (_tempForwardVec.lengthSq() > 1e-6) {
            _tempForwardVec.normalize();
            // Compute yaw so that up vector rotates the minimap
            const yaw = Math.atan2(_tempForwardVec.x, -_tempForwardVec.z);
            const upX = Math.sin(yaw);
            const upZ = -Math.cos(yaw);
            cam.up.set(upX, 0, upZ);
            // Update yaw display (used by compass)
            const newYawDeg = THREE.MathUtils.radToDeg(yaw);
            setYawDeg((prev) =>
              Math.abs(prev - newYawDeg) > 0.1 ? newYawDeg : prev,
            );
          }
        } else {
          cam.up.set(0, 0, -1);
        }

        // Clear destination when reached (using refs for sync access)
        const destWorld = lastDestinationWorldRef.current;
        if (destWorld) {
          const dx = destWorld.x - _tempTargetPos.x;
          const dz = destWorld.z - _tempTargetPos.z;
          if (Math.hypot(dx, dz) < 0.6) {
            setLastDestinationWorld(null);
            setLastMinimapClickScreen(null);
          }
        }

        // Also clear global raycast target when player reaches it
        const windowWithTarget = window as {
          __lastRaycastTarget?: { x: number; z: number };
        };
        if (windowWithTarget.__lastRaycastTarget) {
          const dx = windowWithTarget.__lastRaycastTarget.x - _tempTargetPos.x;
          const dz = windowWithTarget.__lastRaycastTarget.z - _tempTargetPos.z;
          if (Math.hypot(dx, dz) < 0.6) {
            delete windowWithTarget.__lastRaycastTarget;
          }
        }
      }

      // --- Camera Frustum Update (for zoom) ---
      if (cam) {
        const currentExtent = extentRef.current;
        if (cam.right !== currentExtent) {
          cam.left = -currentExtent;
          cam.right = currentExtent;
          cam.top = currentExtent;
          cam.bottom = -currentExtent;
          cam.updateProjectionMatrix();
        }
      }

      // --- Canvas 2D terrain background (throttled, same cadence as old 3D render) ---
      // Declared early so the matrix update below can use the same flag.
      const shouldRedrawTerrain = frameCount % RENDER_EVERY_N_FRAMES === 0;

      // --- Update camera matrices on terrain-draw frames ---
      // Pips use this matrix for projection. By updating only when terrain is
      // (re)drawn, all layers share the same camera snapshot and stay aligned.
      if (cam && shouldRedrawTerrain) {
        cam.updateMatrixWorld();
        _cachedProjectionViewMatrix.multiplyMatrices(
          cam.projectionMatrix,
          cam.matrixWorldInverse,
        );
        _hasCachedMatrix = true;
      }
      if (shouldRedrawTerrain && cam) {
        const mainCanvas = canvasRef.current;
        // Use cached context — avoids a DOM query every frame
        const mainCtx = mainCtxRef.current;
        if (mainCanvas && mainCtx) {
          {
            const cw = mainCanvas.width;
            const ch = mainCanvas.height;

            // Snapshot camera state — used for both terrain generation and overlay drawing
            // so all layers are guaranteed to be aligned with each other.
            const centerX = cam.position.x;
            const centerZ = cam.position.z;
            const currentExtent = extentRef.current;
            const upX = cam.up.x;
            const upZ = cam.up.z;

            // Check whether terrain cache needs to be regenerated.
            // Trigger when: player moved >20 units, camera rotated, extent changed, or cache empty.
            const cacheCtr = terrainCacheCenterRef.current;
            const ddx = centerX - cacheCtr.x;
            const ddz = centerZ - cacheCtr.z;
            const moved = ddx * ddx + ddz * ddz > 400; // 20² world units
            const extentChanged =
              terrainCacheExtentRef.current !== currentExtent;
            // Detect camera rotation (dot-product divergence in up vector)
            const cacheUp = terrainCacheUpRef.current;
            const rotated =
              Math.abs(upX - cacheUp.x) > 0.01 ||
              Math.abs(upZ - cacheUp.z) > 0.01;
            const sizeChanged =
              terrainCacheRef.current !== null &&
              (terrainCacheRef.current.width !== cw ||
                terrainCacheRef.current.height !== ch);

            if (
              !terrainCacheRef.current ||
              moved ||
              rotated ||
              extentChanged ||
              sizeChanged
            ) {
              // Sample terrain heights in a grid, map to RGBA colors
              type TerrainSystemLike = {
                getHeightAt: (worldX: number, worldZ: number) => number;
              };
              const terrainSystem = world.getSystem("terrain") as
                | TerrainSystemLike
                | null
                | undefined;
              if (terrainSystem?.getHeightAt) {
                const imageData = mainCtx.createImageData(cw, ch);
                const data = imageData.data;
                // right = perpendicular to up in XZ plane (for top-down ortho camera)
                const rightX = -upZ;
                const rightZ = upX;
                for (let py = 0; py < ch; py++) {
                  for (let px = 0; px < cw; px++) {
                    // Convert pixel to world coords (accounting for camera up direction)
                    // NDC: x in [-1,1], y in [-1,1] (flipped — screen y is down)
                    const ndcX = (px / cw) * 2 - 1;
                    const ndcY = 1 - (py / ch) * 2;
                    // Unproject through orthographic camera:
                    // world = cam position + ndcX * right * extent - ndcY * up * extent
                    const worldX =
                      centerX +
                      ndcX * rightX * currentExtent -
                      ndcY * upX * currentExtent;
                    const worldZ =
                      centerZ +
                      ndcX * rightZ * currentExtent -
                      ndcY * upZ * currentExtent;

                    let h: number;
                    try {
                      h = terrainSystem.getHeightAt(worldX, worldZ);
                    } catch {
                      h = 0;
                    }

                    // Map height to color
                    let r = 30,
                      g = 60,
                      b = 130;
                    for (let ci = 0; ci < MINIMAP_TERRAIN_COLORS.length; ci++) {
                      const entry = MINIMAP_TERRAIN_COLORS[ci];
                      if (h <= entry.maxHeight) {
                        r = entry.r;
                        g = entry.g;
                        b = entry.b;
                        break;
                      }
                    }

                    // Height-based lightening for land (adds sense of elevation)
                    if (h > MINIMAP_WATER_THRESHOLD) {
                      const lift =
                        Math.min(
                          30,
                          ((h - MINIMAP_WATER_THRESHOLD) / 40) * 30,
                        ) | 0;
                      r = Math.min(255, r + lift);
                      g = Math.min(255, g + lift);
                      b = Math.min(255, b + lift);
                    }

                    const idx = (py * cw + px) * 4;
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = 255;
                  }
                }
                terrainCacheRef.current = imageData;
                // Save all camera parameters that were used to generate the ImageData.
                // Road/building overlays MUST use these same values to stay aligned.
                terrainCacheCenterRef.current.x = centerX;
                terrainCacheCenterRef.current.z = centerZ;
                terrainCacheExtentRef.current = currentExtent;
                terrainCacheUpRef.current.x = upX;
                terrainCacheUpRef.current.z = upZ;
              }
            }

            // Paint the cached terrain onto the base canvas
            if (terrainCacheRef.current) {
              mainCtx.putImageData(terrainCacheRef.current, 0, 0);
            } else {
              // Fallback: dark background until terrain system is ready
              mainCtx.fillStyle = "#1a1a2e";
              mainCtx.fillRect(0, 0, cw, ch);
            }

            // --- Road and building overlays (Canvas 2D vector, drawn every terrain frame) ---
            // Lazy-populate static caches once the world systems are ready.
            if (!roadsCacheRef.current) {
              const roadSys = world.getSystem("roads") as {
                getRoads?: () => Array<{
                  path: Array<{ x: number; z: number }>;
                  width: number;
                }>;
              } | null;
              const roads = roadSys?.getRoads?.();
              if (roads && roads.length > 0) {
                roadsCacheRef.current = roads.map((r) => ({
                  path: r.path,
                  width: r.width,
                }));
              }
            }
            if (!townsCacheRef.current) {
              const townSys = world.getSystem("towns") as {
                getTowns?: () => Array<{
                  buildings: Array<{
                    position: { x: number; z: number };
                    size: { width: number; depth: number };
                    rotation: number;
                  }>;
                }>;
              } | null;
              const towns = townSys?.getTowns?.();
              if (towns && towns.length > 0) {
                townsCacheRef.current = towns;
              }
            }

            // CRITICAL: Use the CACHED terrain parameters (center, up, extent) for all
            // vector overlays. The terrain ImageData was baked with these values — any
            // divergence here causes visible layer sliding as the camera moves/rotates.
            const overlayUpX = terrainCacheUpRef.current.x;
            const overlayUpZ = terrainCacheUpRef.current.z;
            const overlayCenterX = terrainCacheCenterRef.current.x;
            const overlayCenterZ = terrainCacheCenterRef.current.z;
            const overlayExtent = terrainCacheExtentRef.current;
            // Pixels per world unit (derived from cached extent)
            const worldScale = cw / (2 * overlayExtent);

            // Draw roads
            const roadsData = roadsCacheRef.current;
            if (roadsData && roadsData.length > 0) {
              mainCtx.save();
              mainCtx.lineCap = "round";
              mainCtx.lineJoin = "round";
              for (const road of roadsData) {
                if (road.path.length < 2) continue;
                // Quick visibility check using cached overlay center
                const fp = road.path[0];
                const fdx = Math.abs(fp.x - overlayCenterX);
                const fdz = Math.abs(fp.z - overlayCenterZ);
                const lp = road.path[road.path.length - 1];
                const ldx = Math.abs(lp.x - overlayCenterX);
                const ldz = Math.abs(lp.z - overlayCenterZ);
                if (
                  fdx > overlayExtent * 3 &&
                  fdz > overlayExtent * 3 &&
                  ldx > overlayExtent * 3 &&
                  ldz > overlayExtent * 3
                ) {
                  continue;
                }
                const roadPx = Math.max(
                  1,
                  Math.min(6, road.width * worldScale),
                );
                // Outline pass (darker border)
                mainCtx.strokeStyle = "rgba(100, 80, 50, 0.7)";
                mainCtx.lineWidth = roadPx + 1;
                mainCtx.beginPath();
                const [x0, y0] = worldToPx(
                  road.path[0].x,
                  road.path[0].z,
                  overlayCenterX,
                  overlayCenterZ,
                  overlayExtent,
                  overlayUpX,
                  overlayUpZ,
                  cw,
                  ch,
                );
                mainCtx.moveTo(x0, y0);
                for (let ri = 1; ri < road.path.length; ri++) {
                  const [xi, yi] = worldToPx(
                    road.path[ri].x,
                    road.path[ri].z,
                    overlayCenterX,
                    overlayCenterZ,
                    overlayExtent,
                    overlayUpX,
                    overlayUpZ,
                    cw,
                    ch,
                  );
                  mainCtx.lineTo(xi, yi);
                }
                mainCtx.stroke();
                // Fill pass (tan/dirt color)
                mainCtx.strokeStyle = "rgba(190, 160, 110, 0.85)";
                mainCtx.lineWidth = roadPx;
                mainCtx.beginPath();
                mainCtx.moveTo(x0, y0);
                for (let ri = 1; ri < road.path.length; ri++) {
                  const [xi, yi] = worldToPx(
                    road.path[ri].x,
                    road.path[ri].z,
                    overlayCenterX,
                    overlayCenterZ,
                    overlayExtent,
                    overlayUpX,
                    overlayUpZ,
                    cw,
                    ch,
                  );
                  mainCtx.lineTo(xi, yi);
                }
                mainCtx.stroke();
              }
              mainCtx.restore();
            }

            // Draw building footprints
            const townsData = townsCacheRef.current;
            if (townsData && townsData.length > 0) {
              mainCtx.save();
              mainCtx.lineWidth = 0.5;
              for (const town of townsData) {
                for (const building of town.buildings) {
                  const bx = building.position.x;
                  const bz = building.position.z;
                  // Visibility cull using cached overlay center
                  if (
                    Math.abs(bx - overlayCenterX) > overlayExtent * 2 ||
                    Math.abs(bz - overlayCenterZ) > overlayExtent * 2
                  ) {
                    continue;
                  }
                  const hw = building.size.width * 0.5;
                  const hd = building.size.depth * 0.5;
                  const cos = Math.cos(building.rotation);
                  const sin = Math.sin(building.rotation);
                  // Four corners in world XZ (rotated around building center)
                  const c0x = bx + cos * hw - sin * hd;
                  const c0z = bz + sin * hw + cos * hd;
                  const c1x = bx - cos * hw - sin * hd;
                  const c1z = bz - sin * hw + cos * hd;
                  const c2x = bx - cos * hw + sin * hd;
                  const c2z = bz - sin * hw - cos * hd;
                  const c3x = bx + cos * hw + sin * hd;
                  const c3z = bz + sin * hw - cos * hd;
                  const [p0x, p0y] = worldToPx(
                    c0x,
                    c0z,
                    overlayCenterX,
                    overlayCenterZ,
                    overlayExtent,
                    overlayUpX,
                    overlayUpZ,
                    cw,
                    ch,
                  );
                  const [p1x, p1y] = worldToPx(
                    c1x,
                    c1z,
                    overlayCenterX,
                    overlayCenterZ,
                    overlayExtent,
                    overlayUpX,
                    overlayUpZ,
                    cw,
                    ch,
                  );
                  const [p2x, p2y] = worldToPx(
                    c2x,
                    c2z,
                    overlayCenterX,
                    overlayCenterZ,
                    overlayExtent,
                    overlayUpX,
                    overlayUpZ,
                    cw,
                    ch,
                  );
                  const [p3x, p3y] = worldToPx(
                    c3x,
                    c3z,
                    overlayCenterX,
                    overlayCenterZ,
                    overlayExtent,
                    overlayUpX,
                    overlayUpZ,
                    cw,
                    ch,
                  );
                  mainCtx.beginPath();
                  mainCtx.moveTo(p0x, p0y);
                  mainCtx.lineTo(p1x, p1y);
                  mainCtx.lineTo(p2x, p2y);
                  mainCtx.lineTo(p3x, p3y);
                  mainCtx.closePath();
                  mainCtx.fillStyle = "rgba(110, 95, 78, 0.92)";
                  mainCtx.fill();
                  mainCtx.strokeStyle = "rgba(60, 45, 30, 0.9)";
                  mainCtx.stroke();
                }
              }
              mainCtx.restore();
            }
          }
        }
      }

      // Draw 2D pips on overlay canvas every frame for smooth interaction
      // Use cached context — avoids a DOM query every frame
      const ctx = overlayCtxRef.current;
      if (ctx) {
        // Clear the overlay each frame
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // Draw entity pips (use ref to avoid re-creating the render loop)
        // Use for-loop instead of forEach to avoid creating callback functions every frame
        const pipsArray = entityPipsRefForRender.current;
        for (let pipIdx = 0; pipIdx < pipsArray.length; pipIdx++) {
          const pip = pipsArray[pipIdx];
          // Convert world position to screen position using cached matrix
          // This keeps pips synced with the throttled 3D render (not the live camera)
          if (_hasCachedMatrix) {
            // Reuse pre-allocated vector instead of cloning to avoid GC pressure
            _tempProjectVec.copy(pip.position);
            // Apply cached projection-view matrix manually instead of using project()
            _tempProjectVec.applyMatrix4(_cachedProjectionViewMatrix);

            // Use refs for width/height to avoid stale closure values during resize
            const x = (_tempProjectVec.x * 0.5 + 0.5) * widthRef.current;
            const y = (_tempProjectVec.y * -0.5 + 0.5) * heightRef.current;

            // Only draw if within bounds (use refs for current dimensions)
            if (
              x >= 0 &&
              x <= widthRef.current &&
              y >= 0 &&
              y <= heightRef.current
            ) {
              // Set pip properties based on type
              // RS3-style: dots are compact, icons are larger for readability
              let radius = 3;
              let borderColor = "#000000";
              let borderWidth = 1;

              switch (pip.type) {
                case "player":
                  radius =
                    pip.groupIndex !== undefined && pip.groupIndex >= 0 ? 4 : 3;
                  break;
                case "enemy":
                  radius = 3;
                  break;
                case "building":
                  radius = 3;
                  break;
                case "item":
                  radius = 3;
                  break;
                case "resource":
                  radius = 3;
                  break;
                case "quest":
                  radius = pip.isActive ? 7 : 5;
                  break;
              }

              // Determine pip color (group members use GROUP_COLORS)
              let pipColor = pip.color;
              if (
                pip.type === "player" &&
                pip.groupIndex !== undefined &&
                pip.groupIndex >= 0
              ) {
                pipColor = GROUP_COLORS[pip.groupIndex % GROUP_COLORS.length];
              }

              // Apply pulse animation for active pips (quests, etc.)
              let pulseScale = 1;
              if (pip.isActive) {
                // frameTimeMs is cached once per frame — avoid per-pip Date.now() call
                const pulseTime = frameTimeMs / 500; // 500ms per cycle
                pulseScale = 1 + 0.15 * Math.sin(pulseTime * Math.PI * 2);
              }

              // Draw pip
              ctx.fillStyle = pipColor;
              ctx.beginPath();

              // Try subtype icon first (bank, shop, altar, etc.)
              if (pip.subType && drawMinimapIcon(ctx, x, y, pip.subType)) {
                // Icon was drawn by drawMinimapIcon
              } else if (pip.isLocalPlayer) {
                // RS3/OSRS: local player is a white square (slightly larger than dots)
                const sqHalf = 2.5;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(x - sqHalf, y - sqHalf, sqHalf * 2, sqHalf * 2);
              } else if (pip.type === "quest" || pip.icon === "star") {
                // Star for quest markers
                const scaledRadius = radius * pulseScale;
                drawStar(ctx, x, y, scaledRadius, scaledRadius * 0.5, 5);
                ctx.fill();
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderWidth;
                ctx.stroke();

                // Add glow effect for active quests
                if (pip.isActive) {
                  ctx.save();
                  ctx.shadowColor = pipColor;
                  ctx.shadowBlur = 8;
                  ctx.fill();
                  ctx.restore();
                }
              } else if (pip.icon === "diamond") {
                // Diamond shape
                drawDiamond(ctx, x, y, radius);
                ctx.fill();
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderWidth;
                ctx.stroke();
              } else {
                // Circle for everything else (players, mobs, items)
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fill();

                // Add border for better visibility
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderWidth;
                ctx.stroke();
              }
            }
          }
        }

        // Draw red click indicator, fading out
        if (clickIndicator && clickIndicator.opacity > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, clickIndicator.opacity));
          ctx.fillStyle = "#ff0000";
          ctx.beginPath();
          ctx.arc(clickIndicator.x, clickIndicator.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw destination like world clicks: project world target to minimap
        const windowWithTarget = window as {
          __lastRaycastTarget?: {
            x: number;
            y: number;
            z: number;
            method: string;
          };
        };
        const lastTarget = windowWithTarget.__lastRaycastTarget;
        const destWorldRef = lastDestinationWorldRef.current;
        const target =
          lastTarget &&
          Number.isFinite(lastTarget.x) &&
          Number.isFinite(lastTarget.z)
            ? { x: lastTarget.x, z: lastTarget.z }
            : destWorldRef
              ? { x: destWorldRef.x, z: destWorldRef.z }
              : null;
        if (target && _hasCachedMatrix) {
          // Reuse pre-allocated vector instead of creating new one
          _tempDestVec.set(target.x, 0, target.z);
          // Apply cached projection-view matrix to stay synced with throttled 3D render
          _tempDestVec.applyMatrix4(_cachedProjectionViewMatrix);
          // Use refs for width/height to avoid stale closure values during resize
          const sx = (_tempDestVec.x * 0.5 + 0.5) * widthRef.current;
          const sy = (_tempDestVec.y * -0.5 + 0.5) * heightRef.current;
          // RS3-style red flag destination marker
          drawFlag(ctx, sx, sy);
        }
      }

      // Log performance every 60 frames (approximately 1 second)
      // if (frameCount % 60 === 0) {
      //   console.log(`[Minimap] Render frame ${frameCount}, visible: ${isVisible}, entities: ${entityPipsRefForRender.current.length}`);
      // }

      rafId = requestAnimationFrame(render);
    };

    // console.log('[Minimap] Starting render loop');
    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        // console.log('[Minimap] Stopping render loop');
      }
    };
  }, [isVisible, world]);

  // Keep latest pips in a ref so the render loop doesn't restart
  useEffect(() => {
    entityPipsRefForRender.current = entityPips;
  }, [entityPips]);

  // Convert a click in the minimap to a world XZ position
  const screenToWorldXZ = useCallback(
    (clientX: number, clientY: number): { x: number; z: number } | null => {
      const cam = cameraRef.current;
      const cvs = overlayCanvasRef.current || canvasRef.current;
      if (!cam || !cvs) return null;

      const rect = cvs.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      // Reuse pre-allocated vector instead of creating new one
      _tempUnprojectVec.set(ndcX, ndcY, 0);
      _tempUnprojectVec.unproject(cam);
      // For top-down ortho, y is constant; grab x/z
      return { x: _tempUnprojectVec.x, z: _tempUnprojectVec.z };
    },
    [],
  );

  // Clamp to same max travel distance as InteractionSystem (currently 100 units)
  const MAX_TRAVEL_DISTANCE = 100;

  // Shared click handler core
  const handleMinimapClick = useCallback(
    (clientX: number, clientY: number) => {
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
      if (dist > MAX_TRAVEL_DISTANCE) {
        const scale = MAX_TRAVEL_DISTANCE / dist;
        targetX = player.position.x + dx * scale;
        targetZ = player.position.z + dz * scale;
      }

      const worldWithSystem = world as {
        getSystem: (name: string) => {
          getHeightAt: (x: number, z: number) => number;
        };
      };
      const terrainSystem = worldWithSystem.getSystem("terrain");
      let targetY = 0;
      const h = terrainSystem.getHeightAt(targetX, targetZ);
      targetY = (Number.isFinite(h) ? h : 0) + 0.1;

      // Send server-authoritative move request instead of local movement
      const currentRun = (player as { runMode: boolean }).runMode === true;
      const worldWithNetwork = world as {
        network: { send: (method: string, data: unknown) => void };
      };
      worldWithNetwork.network.send("moveRequest", {
        target: [targetX, targetY, targetZ],
        runMode: currentRun,
        cancel: false,
      });

      // Persist destination dot until arrival (no auto-fade)
      setLastDestinationWorld({ x: targetX, z: targetZ });
      // Expose same diagnostic target used by world clicks so minimap renders dot identically
      (window as WindowWithRaycastTarget).__lastRaycastTarget = {
        x: targetX,
        y: targetY,
        z: targetZ,
        method: "minimap",
      };
    },
    [screenToWorldXZ, world],
  );

  const onOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      handleMinimapClick(e.clientX, e.clientY);
    },
    [handleMinimapClick],
  );

  // Wheel handler for minimap zoom - uses native WheelEvent for passive: false support
  // Uses functional update to ensure correct extent value during rapid scrolling
  // No dependencies - handler is stable and listener doesn't need to be re-attached
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const sign = Math.sign(e.deltaY);
      if (sign === 0) return;
      // Notched steps for smooth zoom
      const steps = Math.max(
        1,
        Math.min(5, Math.round(Math.abs(e.deltaY) / 100)),
      );
      // Use functional update to always have the latest extent value
      setExtent((prev) =>
        THREE.MathUtils.clamp(
          prev + sign * steps * STEP_EXTENT,
          MIN_EXTENT,
          MAX_EXTENT,
        ),
      );
    },
    [], // No dependencies - uses functional update
  );

  // Attach wheel listener with { passive: false } to allow preventDefault()
  // React's onWheel is passive by default, causing "Unable to preventDefault" errors
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Resize handlers for corner drag - allows independent width and height
  const handleResizeStart = useCallback(
    (e: React.PointerEvent, corner: "se" | "sw" | "ne" | "nw") => {
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

        let newW = resizeStartRef.current.w;
        let newH = resizeStartRef.current.h;

        // Calculate new size based on corner being dragged
        // Width and height are independent - no longer forcing square
        if (corner === "se") {
          newW = resizeStartRef.current.w + dx;
          newH = resizeStartRef.current.h + dy;
        } else if (corner === "sw") {
          newW = resizeStartRef.current.w - dx;
          newH = resizeStartRef.current.h + dy;
        } else if (corner === "ne") {
          newW = resizeStartRef.current.w + dx;
          newH = resizeStartRef.current.h - dy;
        } else if (corner === "nw") {
          newW = resizeStartRef.current.w - dx;
          newH = resizeStartRef.current.h - dy;
        }

        // Clamp to bounds independently for width and height
        // If maxSize is not specified, allow unlimited resizing (use very large number)
        const effectiveMaxSize = maxSize ?? 9999;
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
      };

      const handleUp = () => {
        setIsResizing(false);
        resizeStartRef.current = null;
        onSizeChange?.(currentWidth, currentHeight);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [
      resizable,
      width,
      height,
      minSize,
      maxSize,
      currentWidth,
      currentHeight,
      onSizeChange,
    ],
  );

  // Render collapsed state as a 32x32 icon
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
        {/* Player direction arrow in collapsed state */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          style={{
            transform: `rotate(${yawDeg}deg)`,
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
      onMouseDown={(e) => {
        // Only prevent default to avoid text selection, don't stop propagation
        // as it blocks resize handles from receiving events
        e.preventDefault();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      {/* 3D canvas */}
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
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      {/* Resize handles (SE corner only for simplicity) */}
      {resizable && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20 pointer-events-auto"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${theme.colors.border.decorative} 50%)`,
          }}
          onPointerDown={(e) => handleResizeStart(e, "se")}
        />
      )}

      {/* Resize indicator overlay when resizing */}
      {isResizing && (
        <div className="absolute inset-0 border-2 border-yellow-400/50 rounded-lg pointer-events-none z-30" />
      )}

      {/* Edit mode drag overlay - makes the entire minimap content draggable */}
      {/* This is positioned INSIDE the edges so resize handles remain accessible */}
      {/* Corners (12px) and edges (8px) are reserved for resize, interior is for drag */}
      {isUnlocked && dragHandleProps && (
        <div
          className="absolute cursor-move pointer-events-auto"
          style={{
            zIndex: 50,
            // Inset from all edges to leave room for resize handles
            // Edges are 8px wide, corners are 12px
            top: 10,
            left: 10,
            right: 10,
            bottom: 10,
            // Subtle visual feedback for drag area
            background: "rgba(100, 180, 255, 0.08)",
            border: "1px dashed rgba(100, 180, 255, 0.4)",
            borderRadius: 4,
          }}
          onPointerDown={dragHandleProps.onPointerDown}
          title="Drag to move minimap"
        />
      )}

      {/* Collapse button (top-right) - only shown when collapsible */}
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleCollapse();
          }}
          title="Collapse Minimap (Tab)"
        >
          −
        </button>
      )}
    </div>
  );
}
