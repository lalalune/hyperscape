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
import { useThemeStore } from "@/ui";
import { Entity, THREE, createRenderer } from "@hyperscape/shared";
import type { UniversalRenderer } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";
import { MinimapStaminaOrb } from "./MinimapStaminaBar";
import { MinimapHomeTeleportOrb } from "./MinimapHomeTeleportOrb";
import { ThreeResourceManager } from "../../lib/ThreeResourceManager";

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
  zoom = 50,
  className = "",
  style = {},
  onCompassClick,
  isVisible = true,
  resizable = true,
  onSizeChange,
  minSize = 120,
  maxSize,
  embedded = false,
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
  const rendererRef = useRef<UniversalRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [entityPips, setEntityPips] = useState<EntityPip[]>([]);
  const entityPipsRefForRender = useRef<EntityPip[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const entityCacheRef = useRef<Map<string, EntityPip>>(new Map());
  const rendererInitializedRef = useRef<boolean>(false);

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

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        "ontouchstart" in window || navigator.maxTouchPoints > 0,
      );
    };
    checkTouch();
  }, []);

  // Initialize minimap renderer and camera
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas || !overlayCanvas) return;

    // console.log('[Minimap] Initializing renderer...');

    // Create orthographic camera for overhead view - much higher up
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
    camera.position.set(0, 500, 0); // Much higher for better overview
    camera.lookAt(0, 0, 0);

    // PERFORMANCE: Only see layer 0 (excludes grass on layer 1, vegetation on layer 2)
    // By default cameras only see layer 0, but ensure we don't enable other layers
    camera.layers.set(0);

    // Mark camera as minimap for systems that need to check (e.g., water system)
    camera.userData.isMinimap = true;

    cameraRef.current = camera;

    // Track if component is still mounted for async renderer creation
    let mounted = true;

    // Only create renderer if it doesn't exist
    if (!rendererRef.current || !rendererInitializedRef.current) {
      // console.log('[Minimap] Creating new renderer');
      createRenderer({
        canvas,
        alpha: true,
        antialias: false,
      })
        .then((renderer) => {
          if (!mounted) {
            if ("dispose" in renderer)
              (renderer as { dispose: () => void }).dispose();
            return;
          }

          renderer.setSize(width, height);

          rendererRef.current = renderer;
          rendererInitializedRef.current = true;
          // console.log('[Minimap] Renderer initialized successfully');
        })
        .catch((error) => {
          console.warn("[Minimap] Failed to create renderer:", error);
          rendererRef.current = null;
          rendererInitializedRef.current = false;
        });
    } else {
      // console.log('[Minimap] Reusing existing renderer');
      // Update renderer size when reusing
      if (rendererRef.current) {
        rendererRef.current.setSize(width, height);
      }
      // console.log('[Minimap] Renderer size updated');
    }

    // Ensure both canvases have the correct backing size
    canvas.width = width;
    canvas.height = height;
    overlayCanvas.width = width;
    overlayCanvas.height = height;

    return () => {
      // Set mounted to false to prevent renderer initialization after unmount
      mounted = false;
      // Don't dispose renderer on unmount - we want to reuse it
      // Only pause rendering when hidden, don't dispose
      if (rendererRef.current && rendererInitializedRef.current && !isVisible) {
        // console.log('[Minimap] Pausing renderer (component hidden)');
        // Pause rendering when hidden
        if ("setAnimationLoop" in rendererRef.current) {
          rendererRef.current.setAnimationLoop(null);
        }
      }
    };
    // Note: extent intentionally omitted - changes handled via extentRef in render loop (lines 582-590)
  }, [width, height, world]);

  // Use the actual world scene instead of creating a separate one
  useEffect(() => {
    if (!world.stage.scene) return;

    // Use the world's actual scene for minimap rendering
    sceneRef.current = world.stage.scene;

    // No cleanup needed - we're using the world's scene
  }, [world]);

  // Handle visibility changes to pause/resume rendering
  useEffect(() => {
    if (!rendererRef.current) return;

    if (isVisible) {
      // console.log('[Minimap] Resuming renderer (component visible)');
      // Resume rendering when visible
      if ("setAnimationLoop" in rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
      }
    } else {
      // console.log('[Minimap] Pausing renderer (component hidden)');
      // Pause rendering when hidden
      if ("setAnimationLoop" in rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
      }
    }
  }, [isVisible]);

  // Cleanup renderer, camera, and scene reference when component is actually unmounted
  useEffect(() => {
    return () => {
      // Dispose renderer
      if (rendererRef.current && rendererInitializedRef.current) {
        // console.log('[Minimap] Disposing renderer on component unmount');
        ThreeResourceManager.disposeRenderer(rendererRef.current);
        rendererRef.current = null;
        rendererInitializedRef.current = false;
      }

      // Clear camera reference and userData
      if (cameraRef.current) {
        // Clear camera userData to prevent dangling references
        if (cameraRef.current.userData) {
          Object.keys(cameraRef.current.userData).forEach((key) => {
            delete cameraRef.current!.userData[key];
          });
        }
        cameraRef.current = null;
      }

      // Clear scene reference (we don't own it, just borrowed from world)
      sceneRef.current = null;

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
            color: "#00ff00",
          };
          entityCacheRef.current.set("local-player", playerPip);
        } else {
          playerPip.position = player.node.position;
          playerPip.color = "#00ff00";
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
                color: "#00ff00",
              };
              entityCacheRef.current.set("spectated-player", spectatedPip);
            } else {
              spectatedPip.position = cameraInfo.target.node.position;
              spectatedPip.color = "#00ff00";
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
              playerPip.color = "#0088ff";
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
                color: "#0088ff",
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

          switch (entity.type) {
            case "player":
              // Already handled above; skip to avoid duplicates
              continue;
            case "mob":
            case "enemy":
              color = "#ff4444";
              type = "enemy";
              break;
            case "building":
            case "structure":
              color = "#ffaa00";
              type = "building";
              break;
            case "item":
            case "loot":
              color = "#ffff44";
              type = "item";
              break;
            case "resource":
              color = "#22cc55"; // Green for resources (trees, rocks, etc)
              type = "resource";
              break;
            default:
              // Treat unknown as items for now
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
          } else {
            // New entity, create a new Vector3
            entityPip = {
              id: entity.id,
              type,
              position: new THREE.Vector3(pos.x, 0, pos.z),
              color,
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

    // PERFORMANCE: Throttle 3D rendering to ~15fps (render every 4th frame)
    // 2D overlay (pips) still updates every frame for smooth interaction
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

      // --- Render 3D scene (throttled for performance) ---
      // Only render 3D every N frames to reduce GPU load
      const shouldRender3D = frameCount % RENDER_EVERY_N_FRAMES === 0;
      if (shouldRender3D && rendererRef.current && sceneRef.current && cam) {
        // PERFORMANCE: Disable fog for minimap rendering (top-down view doesn't need it)
        const savedFog = sceneRef.current.fog;
        sceneRef.current.fog = null;

        // Also disable terrain shader fog (it uses custom uniforms, not scene.fog)
        // Access terrain material uniforms directly - TerrainSystem exposes getTerrainMaterialWithUniforms()
        type TerrainMaterialUniforms = {
          fogEnabled: { value: number };
        };
        type TerrainMaterial = { terrainUniforms: TerrainMaterialUniforms };
        type TerrainSystemWithMaterial = {
          getTerrainMaterialWithUniforms: () => TerrainMaterial | null;
        };

        let terrainMat: TerrainMaterial | null = null;

        try {
          const terrainSystem = world.getSystem("terrain") as
            | TerrainSystemWithMaterial
            | undefined;
          if (terrainSystem?.getTerrainMaterialWithUniforms) {
            terrainMat = terrainSystem.getTerrainMaterialWithUniforms();
            if (terrainMat?.terrainUniforms) {
              // Disable fog completely for minimap (fogEnabled = 0.0)
              terrainMat.terrainUniforms.fogEnabled.value = 0.0;
            }
          }
        } catch {
          // If terrain system isn't ready yet, fog will remain - that's okay
        }

        rendererRef.current.render(sceneRef.current, cam);

        // Restore fog for main camera
        sceneRef.current.fog = savedFog;
        if (terrainMat?.terrainUniforms) {
          terrainMat.terrainUniforms.fogEnabled.value = 1.0;
        }
      }

      // Always draw 2D pips on overlay canvas
      const ctx = overlayCanvas.getContext("2d");
      if (ctx) {
        // Clear the overlay each frame
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        // If no renderer, fill background on overlay
        if (!rendererRef.current) {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }

        // Draw entity pips (use ref to avoid re-creating the render loop)
        // Use for-loop instead of forEach to avoid creating callback functions every frame
        const pipsArray = entityPipsRefForRender.current;
        for (let pipIdx = 0; pipIdx < pipsArray.length; pipIdx++) {
          const pip = pipsArray[pipIdx];
          // Convert world position to screen position
          if (cameraRef.current) {
            // Reuse pre-allocated vector instead of cloning to avoid GC pressure
            _tempProjectVec.copy(pip.position);
            _tempProjectVec.project(cameraRef.current);

            const x = (_tempProjectVec.x * 0.5 + 0.5) * width;
            const y = (_tempProjectVec.y * -0.5 + 0.5) * height;

            // Only draw if within bounds
            if (x >= 0 && x <= width && y >= 0 && y <= height) {
              // Set pip properties based on type
              let radius = 3;
              let borderColor = "#ffffff";
              let borderWidth = 1;

              switch (pip.type) {
                case "player":
                  // RS3-style: simple dot for player, no arrow
                  // Use group color if in a group
                  radius =
                    pip.groupIndex !== undefined && pip.groupIndex >= 0 ? 5 : 4;
                  borderWidth = 1;
                  break;
                case "enemy":
                  radius = 3;
                  borderColor = "#ffffff";
                  borderWidth = 1;
                  break;
                case "building":
                  radius = 4;
                  borderColor = "#000000";
                  borderWidth = 2;
                  break;
                case "item":
                  radius = 2;
                  borderColor = "#ffffff";
                  borderWidth = 1;
                  break;
                case "resource":
                  radius = 3;
                  borderColor = "#ffffff";
                  borderWidth = 1;
                  break;
                case "quest":
                  // Quest markers are larger and more visible
                  radius = pip.isActive ? 7 : 5;
                  borderColor = "#000000";
                  borderWidth = 1;
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
                // Create pulsing effect using time
                const pulseTime = Date.now() / 500; // 500ms per cycle
                pulseScale = 1 + 0.15 * Math.sin(pulseTime * Math.PI * 2);
              }

              // Draw pip
              ctx.fillStyle = pipColor;
              ctx.beginPath();

              // Draw different shapes for different types
              if (pip.type === "building") {
                // Square for buildings
                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderWidth;
                ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
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
                // Circle for everything else
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
        if (target && cameraRef.current) {
          // Reuse pre-allocated vector instead of creating new one
          _tempDestVec.set(target.x, 0, target.z);
          _tempDestVec.project(cameraRef.current);
          const sx = (_tempDestVec.x * 0.5 + 0.5) * width;
          const sy = (_tempDestVec.y * -0.5 + 0.5) * height;
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#ff3333";
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
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

  // Resize handlers for corner drag
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

        // Calculate new size based on corner being dragged
        // For square minimap, use the larger dimension change
        if (corner === "se") {
          const delta = Math.max(dx, dy);
          newW = resizeStartRef.current.w + delta;
        } else if (corner === "sw") {
          const delta = Math.max(-dx, dy);
          newW = resizeStartRef.current.w + delta;
        } else if (corner === "ne") {
          const delta = Math.max(dx, -dy);
          newW = resizeStartRef.current.w + delta;
        } else if (corner === "nw") {
          const delta = Math.max(-dx, -dy);
          newW = resizeStartRef.current.w + delta;
        }

        // Keep it square and clamp to bounds (use newW since minimap is always square)
        // If maxSize is not specified, allow unlimited resizing (use very large number)
        const effectiveMaxSize = maxSize ?? 9999;
        const size = Math.max(
          minSize,
          Math.min(effectiveMaxSize, Math.round(newW / 8) * 8),
        );
        setCurrentWidth(size);
        setCurrentHeight(size);
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
      {/* Compass control - only shown when not being managed externally */}
      {!onCompassClick && (
        <div
          title="Click to face North"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const cam = cameraRef.current;
            if (cam) {
              cam.up.set(0, 0, -1);
            }
            // Reorient main camera to face North (RS3-like) using camera system directly
            const camSys = world.getSystem("client-camera-system") as {
              resetCamera?: () => void;
            } | null;
            camSys?.resetCamera?.();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute rounded-full border border-white/60 bg-black/60 flex items-center justify-center cursor-pointer z-10 pointer-events-auto touch-manipulation"
          style={{
            top: isTouchDevice ? 4 : 6,
            left: isTouchDevice ? 4 : 6,
            width: isTouchDevice ? 44 : 40,
            height: isTouchDevice ? 44 : 40,
          }}
        >
          <div
            className="relative w-7 h-7 pointer-events-none"
            style={{ transform: `rotate(${yawDeg}deg)` }}
          >
            {/* Rotating ring */}
            <div className="absolute inset-0 rounded-full border border-white/50 pointer-events-none" />
            {/* N marker at top of compass (rotates with ring) */}
            <div className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[11px] text-red-500 font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none">
              N
            </div>
            {/* S/E/W faint labels */}
            <div className="absolute left-1/2 bottom-0.5 -translate-x-1/2 text-[9px] text-white/70 pointer-events-none">
              S
            </div>
            <div className="absolute top-1/2 left-0.5 -translate-y-1/2 text-[9px] text-white/70 pointer-events-none">
              W
            </div>
            <div className="absolute top-1/2 right-0.5 -translate-y-1/2 text-[9px] text-white/70 pointer-events-none">
              E
            </div>
          </div>
        </div>
      )}

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

      {/* Home Teleport Orb - bottom left corner (hidden when embedded) */}
      {!embedded && (
        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            bottom: 6,
            left: 6,
          }}
        >
          <MinimapHomeTeleportOrb
            world={world}
            size={Math.max(36, Math.min(48, width * 0.2))}
          />
        </div>
      )}

      {/* Stamina Orb - bottom right corner (hidden when embedded) */}
      {!embedded && (
        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            bottom: 6,
            right: 6,
          }}
        >
          <MinimapStaminaOrb
            world={world}
            size={Math.max(36, Math.min(48, width * 0.2))}
          />
        </div>
      )}
    </div>
  );
}
