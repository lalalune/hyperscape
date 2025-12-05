/**
 * Minimap.tsx - 2D Minimap Component
 *
 * Shows player position, nearby entities, and terrain on a 2D minimap.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Entity, THREE, createRenderer } from "@hyperscape/shared";
import type { UniversalRenderer } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";

interface EntityPip {
  id: string;
  type: "player" | "enemy" | "building" | "item" | "resource";
  position: THREE.Vector3;
  color: string;
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
}

export function Minimap({
  world,
  width = 200,
  height = 200,
  zoom = 50,
  className = "",
  style = {},
  onCompassClick,
  isVisible = true,
}: MinimapProps) {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<UniversalRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [entityPips, setEntityPips] = useState<EntityPip[]>([]);
  const entityPipsRefForRender = useRef<EntityPip[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const entityCacheRef = useRef<Map<string, EntityPip>>(new Map());
  const rendererInitializedRef = useRef<boolean>(false);

  // Minimap zoom state (orthographic half-extent in world units)
  const [extent, setExtent] = useState<number>(zoom);
  const MIN_EXTENT = 20;
  const MAX_EXTENT = 200;
  const STEP_EXTENT = 10;

  // Rotation: follow main camera yaw (RS3-like) with North toggle
  const [rotateWithCamera] = useState<boolean>(true);
  const [yawDeg, setYawDeg] = useState<number>(0);
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
    const webglCanvas = webglCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!webglCanvas || !overlayCanvas) return;

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
    cameraRef.current = camera;

    // Track if component is still mounted for async renderer creation
    let mounted = true;

    // Only create renderer if it doesn't exist
    if (!rendererRef.current || !rendererInitializedRef.current) {
      // console.log('[Minimap] Creating new renderer');
      createRenderer({
        canvas: webglCanvas,
        alpha: true,
        antialias: false,
        preferWebGPU: false, // Use WebGL for minimap (simpler, more compatible)
      })
        .then((renderer) => {
          if (!mounted) {
            if ("dispose" in renderer)
              (renderer as { dispose: () => void }).dispose();
            return;
          }

          renderer.setSize(width, height);

          // Configure clear color (WebGL-specific)
          if ("setClearColor" in renderer) {
            (renderer as THREE.WebGLRenderer).setClearColor(0x1a1a2e, 0.9);
          }

          rendererRef.current = renderer;
          rendererInitializedRef.current = true;
          // console.log('[Minimap] Renderer initialized successfully');
        })
        .catch((_error) => {
          // console.error("[Minimap] Failed to create renderer:", _error);
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
    webglCanvas.width = width;
    webglCanvas.height = height;
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
          (rendererRef.current as THREE.WebGLRenderer).setAnimationLoop(null);
        }
      }
    };
  }, [width, height, extent, world]);

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
        (rendererRef.current as THREE.WebGLRenderer).setAnimationLoop(null);
      }
    } else {
      // console.log('[Minimap] Pausing renderer (component hidden)');
      // Pause rendering when hidden
      if ("setAnimationLoop" in rendererRef.current) {
        (rendererRef.current as THREE.WebGLRenderer).setAnimationLoop(null);
      }
    }
  }, [isVisible]);

  // Cleanup renderer when component is actually unmounted
  useEffect(() => {
    return () => {
      if (rendererRef.current && rendererInitializedRef.current) {
        // console.log('[Minimap] Disposing renderer on component unmount');
        if ("dispose" in rendererRef.current) {
          (rendererRef.current as { dispose: () => void }).dispose();
        }
        rendererRef.current = null;
        rendererInitializedRef.current = false;
      }
    };
  }, []);

  // Update camera position based on player position (or spectated entity in spectator mode)
  useEffect(() => {
    let rafId: number | null = null;
    const loop = () => {
      const cam = cameraRef.current;
      const player = world.entities?.player as Entity | undefined;

      // Get target position - either local player or spectated entity
      let targetPosition: { x: number; z: number } | null = null;

      if (player) {
        // Normal mode: follow local player
        targetPosition = {
          x: player.node.position.x,
          z: player.node.position.z,
        };
      } else {
        // Spectator mode: get camera target from camera system
        const config = (
          window as {
            __HYPERSCAPE_CONFIG__?: { mode?: string; followEntity?: string };
          }
        ).__HYPERSCAPE_CONFIG__;
        if (config?.mode === "spectator") {
          // Try to get camera target position
          const cameraSystem = world.getSystem("client-camera-system") as {
            getCameraInfo?: () => {
              target?: { position?: { x: number; z: number } };
            };
          } | null;
          const cameraInfo = cameraSystem?.getCameraInfo?.();
          if (cameraInfo?.target?.position) {
            targetPosition = {
              x: cameraInfo.target.position.x,
              z: cameraInfo.target.position.z,
            };
          }
        }
      }

      if (cam && targetPosition) {
        // Keep centered on target (player or spectated entity)
        cam.position.x = targetPosition.x;
        cam.position.z = targetPosition.z;
        cam.lookAt(targetPosition.x, 0, targetPosition.z);

        // Rotate minimap with main camera yaw if enabled
        if (rotateWithCamera && world.camera) {
          const worldCam = world.camera;
          const forward = new THREE.Vector3();
          worldCam.getWorldDirection(forward);
          forward.y = 0;
          if (forward.lengthSq() > 1e-6) {
            forward.normalize();
            // Compute yaw so that up vector rotates the minimap
            const yaw = Math.atan2(forward.x, -forward.z); // yaw=0 when facing -Z
            const upX = Math.sin(yaw);
            const upZ = -Math.cos(yaw);
            cam.up.set(upX, 0, upZ);
            setYawDeg(THREE.MathUtils.radToDeg(yaw));
          }
        } else {
          cam.up.set(0, 0, -1);
          setYawDeg(0);
        }

        // Do not sync world clicks into minimap dot; minimap dot should stay fixed where clicked

        // Clear destination when reached
        if (lastDestinationWorld) {
          const dx = lastDestinationWorld.x - targetPosition.x;
          const dz = lastDestinationWorld.z - targetPosition.z;
          if (Math.hypot(dx, dz) < 0.6) {
            setLastDestinationWorld(null);
            setLastMinimapClickScreen(null);
          }
        }

        // Also clear global raycast target when player reaches it
        // This prevents stale destination dots from persisting
        const windowWithTarget = window as {
          __lastRaycastTarget?: { x: number; z: number };
        };
        if (windowWithTarget.__lastRaycastTarget) {
          const dx = windowWithTarget.__lastRaycastTarget.x - targetPosition.x;
          const dz = windowWithTarget.__lastRaycastTarget.z - targetPosition.z;
          if (Math.hypot(dx, dz) < 0.6) {
            delete windowWithTarget.__lastRaycastTarget;
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [world, rotateWithCamera, lastDestinationWorld, lastMinimapClickScreen]);

  // Update camera frustum when extent changes
  useEffect(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.updateProjectionMatrix();
  }, [extent]);

  // Collect entity data for pips (update at a moderate cadence, only when visible)
  useEffect(() => {
    if (!world.entities || !isVisible) return;

    // console.log('[Minimap] Starting entity detection updates');
    let intervalId: number | null = null;
    const update = () => {
      const pips: EntityPip[] = [];
      const newCache = new Map<string, EntityPip>();

      const player = world.entities?.player as Entity | undefined;
      let playerPipId: string | null = null;

      if (player?.node?.position) {
        // Normal mode: local player is the green pip
        const playerPip: EntityPip = {
          id: "local-player",
          type: "player",
          position: player.node.position,
          color: "#00ff00",
        };
        pips.push(playerPip);
        newCache.set("local-player", playerPip);
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
            const spectatedPip: EntityPip = {
              id: "spectated-player",
              type: "player",
              position: cameraInfo.target.node.position,
              color: "#00ff00",
            };
            pips.push(spectatedPip);
            newCache.set("spectated-player", spectatedPip);
            playerPipId = cameraInfo.target.id ?? null;
          }
        }
      }

      // Add other players using entities system for reliable positions
      if (world.entities) {
        const players = world.entities.getAllPlayers();
        players.forEach((otherPlayer) => {
          // Skip local player or spectated entity (already shown as green pip)
          if (
            (player && otherPlayer.id === player.id) ||
            (playerPipId && otherPlayer.id === playerPipId)
          ) {
            return;
          }
          const otherEntity = world.entities.get(otherPlayer.id);
          if (otherEntity && otherEntity.node && otherEntity.node.position) {
            const playerPip: EntityPip = {
              id: otherPlayer.id,
              type: "player",
              position: new THREE.Vector3(
                otherEntity.node.position.x,
                0,
                otherEntity.node.position.z,
              ),
              color: "#0088ff",
            };
            pips.push(playerPip);
            newCache.set(otherPlayer.id, playerPip);
          }
        });
      }

      // Add pips for all known entities safely (cached)
      // Note: We use the entity system exclusively for detecting mobs/buildings.
      // Scene traversal was removed as it caused stale dots (matched static objects by name)
      if (world.entities) {
        const allEntities = world.entities.getAll();
        allEntities.forEach((entity) => {
          // Skip if no valid position
          const pos = entity?.position;
          if (!pos) return;

          let color = "#ffffff";
          let type: EntityPip["type"] = "item";

          switch (entity.type) {
            case "player":
              // Already handled above; skip to avoid duplicates
              return;
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

          const entityPip: EntityPip = {
            id: entity.id,
            type,
            position: new THREE.Vector3(pos.x, 0, pos.z),
            color,
          };
          pips.push(entityPip);
          newCache.set(entity.id, entityPip);
        });
      }

      // Update cache
      entityCacheRef.current = newCache;
      setEntityPips(pips);
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

  // Render pips on canvas (only when visible)
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !isVisible) return;

    let rafId: number | null = null;
    let _frameCount = 0;

    const render = () => {
      // Only render if visible
      if (!isVisible) {
        rafId = requestAnimationFrame(render);
        return;
      }

      _frameCount++;

      // Render WebGL if available
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // Always draw 2D pips on overlay canvas
      const ctx = overlayCanvas.getContext("2d");
      if (ctx) {
        // Clear the overlay each frame
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        // If no WebGL renderer, fill background on overlay
        if (!rendererRef.current) {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }

        // Draw entity pips (use ref to avoid re-creating the render loop)
        entityPipsRefForRender.current.forEach((pip) => {
          // Convert world position to screen position
          if (cameraRef.current) {
            const vector = pip.position.clone();
            vector.project(cameraRef.current);

            const x = (vector.x * 0.5 + 0.5) * width;
            const y = (vector.y * -0.5 + 0.5) * height;

            // Only draw if within bounds
            if (x >= 0 && x <= width && y >= 0 && y <= height) {
              // Set pip properties based on type
              let radius = 3;
              let borderColor = "#ffffff";
              let borderWidth = 1;

              switch (pip.type) {
                case "player":
                  // RS3-style: simple dot for player, no arrow
                  radius = 4;
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
              }

              // Draw pip
              ctx.fillStyle = pip.color;
              ctx.beginPath();

              // Draw different shapes for different types
              if (pip.type === "building") {
                // Square for buildings
                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderWidth;
                ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
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
        });

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
        const target =
          lastTarget &&
          Number.isFinite(lastTarget.x) &&
          Number.isFinite(lastTarget.z)
            ? { x: lastTarget.x, z: lastTarget.z }
            : lastDestinationWorld
              ? { x: lastDestinationWorld.x, z: lastDestinationWorld.z }
              : null;
        if (target && cameraRef.current) {
          const v = new THREE.Vector3(target.x, 0, target.z);
          v.project(cameraRef.current);
          const sx = (v.x * 0.5 + 0.5) * width;
          const sy = (v.y * -0.5 + 0.5) * height;
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
  }, [isVisible]);

  // Keep latest pips in a ref so the render loop doesn't restart
  useEffect(() => {
    entityPipsRefForRender.current = entityPips;
  }, [entityPips]);

  // Convert a click in the minimap to a world XZ position
  const screenToWorldXZ = useCallback(
    (clientX: number, clientY: number): { x: number; z: number } | null => {
      const cam = cameraRef.current;
      const canvas = overlayCanvasRef.current || webglCanvasRef.current;
      if (!cam || !canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const v = new THREE.Vector3(ndcX, ndcY, 0);
      v.unproject(cam);
      // For top-down ortho, y is constant; grab x/z
      return { x: v.x, z: v.z };
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
      const windowWithTarget = window as unknown as {
        __lastRaycastTarget: {
          x: number;
          y: number;
          z: number;
          method: string;
        };
      };
      windowWithTarget.__lastRaycastTarget = {
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

  const onMinimapWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const sign = Math.sign(e.deltaY);
      if (sign === 0) return;
      // Notched steps
      const steps = Math.max(
        1,
        Math.min(5, Math.round(Math.abs(e.deltaY) / 100)),
      );
      const next = THREE.MathUtils.clamp(
        extent + sign * steps * STEP_EXTENT,
        MIN_EXTENT,
        MAX_EXTENT,
      );
      setExtent(next);
    },
    [extent],
  );

  const onOverlayWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const sign = Math.sign(e.deltaY);
      if (sign === 0) return;
      const steps = Math.max(
        1,
        Math.min(5, Math.round(Math.abs(e.deltaY) / 100)),
      );
      const next = THREE.MathUtils.clamp(
        extent + sign * steps * STEP_EXTENT,
        MIN_EXTENT,
        MAX_EXTENT,
      );
      setExtent(next);
    },
    [extent],
  );

  return (
    <div
      className={`minimap border-2 border-white/30 rounded-full overflow-visible bg-black/80 relative touch-none select-none ${className}`}
      style={{
        width,
        height,
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        ...style,
      }}
      onWheel={onMinimapWheel}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* WebGL canvas */}
      <canvas
        ref={webglCanvasRef}
        width={width}
        height={height}
        className="absolute inset-0 block w-full h-full z-0 rounded-full overflow-hidden"
      />
      {/* 2D overlay for pips */}
      <canvas
        ref={overlayCanvasRef}
        width={width}
        height={height}
        className="absolute inset-0 block w-full h-full pointer-events-auto cursor-crosshair z-[1] rounded-full overflow-hidden"
        onClick={onOverlayClick}
        onWheel={onOverlayWheel}
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
    </div>
  );
}
