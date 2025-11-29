import { System } from "..";
import type { World } from "../../../core/World";
import type { Position3D } from "../../../types/core/base-types";
import { AttackType } from "../../../types/core/core";
import { EventType } from "../../../types/events";
import type { Entity } from "../../../entities/Entity";
import * as THREE from "three";
import { worldToTile, tileToWorld, TILE_SIZE } from "../movement/TileSystem";

interface InteractionAction {
  id: string;
  label: string;
  icon?: string;
  enabled: boolean;
  handler: () => void;
}

const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

/**
 * Interaction System
 *
 * Handles click-to-move and right-click context menus for entities.
 *
 * Features:
 * - Click-to-move with visual target marker
 * - Right-click context menus for items, resources, mobs, NPCs, corpses
 * - Mobile long-press support for context menus
 */
export class InteractionSystem extends System {
  // Click-to-move state
  private canvas: HTMLCanvasElement | null = null;
  private targetMarker: THREE.Mesh | null = null;
  private targetPosition: THREE.Vector3 | null = null;
  private isDragging: boolean = false;
  private mouseDownButton: number | null = null;
  private mouseDownClientPos: { x: number; y: number } | null = null;
  private readonly dragThresholdPx: number = 5;
  private readonly maxClickDistance: number = 100;

  // Context menu state
  private raycaster = new THREE.Raycaster();
  private _tempVec2 = new THREE.Vector2();
  private touchStart: { x: number; y: number; time: number } | null = null;
  private longPressTimer: NodeJS.Timeout | null = null;
  private readonly LONG_PRESS_DURATION = 500;

  // Debouncing for interactions to prevent duplicates
  private recentPickupRequests = new Map<string, number>();
  private readonly PICKUP_DEBOUNCE_TIME = 1000; // 1 second
  private recentAttackRequests = new Map<string, number>();
  private readonly ATTACK_DEBOUNCE_TIME = 1000; // 1 second
  private recentResourceRequests = new Map<string, number>();
  private readonly RESOURCE_DEBOUNCE_TIME = 1000; // 1 second

  // Auto-pickup tracking
  private pendingPickups = new Map<
    string,
    { itemId: string; position: Position3D }
  >();

  constructor(world: World) {
    super(world);
  }

  /**
   * Check if player controls are enabled (not in spectator mode)
   * Returns true if controls are enabled and input should be processed
   */
  private areControlsEnabled(): boolean {
    // Check the client-input system for disabled state
    const input = this.world.getSystem("client-input") as {
      isEnabled?: () => boolean;
      _controlsEnabled?: boolean;
    } | null;

    if (input) {
      // Try isEnabled() method first
      if (typeof input.isEnabled === "function") {
        return input.isEnabled();
      }
      // Fall back to direct property access
      if (typeof input._controlsEnabled === "boolean") {
        return input._controlsEnabled;
      }
    }

    // Default to enabled if we can't determine state
    return true;
  }

  override start(): void {
    this.canvas = this.world.graphics?.renderer?.domElement ?? null;
    if (!this.canvas) return;

    // Bind once so we can remove correctly on destroy
    this.onCanvasClick = this.onCanvasClick.bind(this);
    this.onRightClick = this.onRightClick.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    // Add event listeners with capture phase for context menu priority
    this.canvas.addEventListener("click", this.onCanvasClick, false);
    this.canvas.addEventListener("contextmenu", this.onContextMenu, true);
    this.canvas.addEventListener("mousemove", this.onMouseMove, false);
    this.canvas.addEventListener("mousedown", this.onMouseDown, true);
    this.canvas.addEventListener("mouseup", this.onMouseUp, false);
    this.canvas.addEventListener("touchstart", this.onTouchStart, true);
    this.canvas.addEventListener("touchend", this.onTouchEnd, true);

    // Listen for camera tap events on mobile
    this.world.on(EventType.CAMERA_TAP, this.onCameraTap);

    // Listen for movement completion events to trigger auto-pickup
    this.world.on(EventType.ENTITY_MODIFIED, this.onEntityModified.bind(this));

    // Create target marker (visual indicator)
    this.createTargetMarker();
  }

  private createTargetMarker(): void {
    // Create a tile-sized square marker (RuneScape-style)
    // Slightly smaller than full tile for visual clarity
    const tileSize = TILE_SIZE * 0.9;

    // Create a plane geometry for the tile marker
    const geometry = new THREE.PlaneGeometry(tileSize, tileSize, 4, 4);
    geometry.rotateX(-Math.PI / 2); // Lay flat on ground

    // Yellow/gold color like RuneScape destination markers
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      depthTest: true,
    });

    this.targetMarker = new THREE.Mesh(geometry, material);
    this.targetMarker.visible = false;
    this.targetMarker.renderOrder = 999; // Render on top

    const scene = this.world.stage?.scene;
    if (scene) {
      scene.add(this.targetMarker);
    }
  }

  private projectMarkerOntoTerrain(
    centerX: number,
    centerZ: number,
    fallbackY: number,
  ): void {
    if (!this.targetMarker) return;

    const geometry = this.targetMarker.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;

    if (!positionAttribute) return;

    // Get terrain system for fast heightmap lookup
    const terrainSystem = this.world.getSystem("terrain") as
      | { getHeightAt: (x: number, z: number) => number }
      | undefined;

    if (!terrainSystem) {
      this.targetMarker.position.setY(fallbackY);
      for (let i = 0; i < positionAttribute.count; i++) {
        positionAttribute.setY(i, 0.05);
      }
      positionAttribute.needsUpdate = true;
      return;
    }

    let totalTerrainY = 0;
    let validVertices = 0;

    // Query heightmap for each vertex - this is instant!
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const z = positionAttribute.getZ(i);

      // Get terrain height at this vertex position (world space)
      const terrainY = terrainSystem.getHeightAt(centerX + x, centerZ + z);

      if (Number.isFinite(terrainY)) {
        totalTerrainY += terrainY;
        validVertices++;
        // Store world Y temporarily
        positionAttribute.setY(i, terrainY + 0.05);
      } else {
        // Fallback for this vertex
        positionAttribute.setY(i, fallbackY + 0.05);
      }
    }

    // Calculate average terrain height and position marker
    if (validVertices > 0) {
      const avgTerrainY = totalTerrainY / validVertices;
      this.targetMarker.position.setY(avgTerrainY);

      // Convert all vertex Y values to local space (relative to marker)
      for (let i = 0; i < positionAttribute.count; i++) {
        const worldY = positionAttribute.getY(i);
        const localY = worldY - avgTerrainY;
        positionAttribute.setY(i, localY);
      }
    } else {
      // No valid terrain data, use flat marker
      this.targetMarker.position.setY(fallbackY);
      for (let i = 0; i < positionAttribute.count; i++) {
        positionAttribute.setY(i, 0.05);
      }
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private onContextMenu(event: MouseEvent): void {
    // Block context menus if controls are disabled (spectator mode)
    if (!this.areControlsEnabled()) return;

    const target = this.getEntityAtPosition(event.clientX, event.clientY);
    if (target) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.showContextMenu(target, event.clientX, event.clientY);
    }
  }

  private onRightClick = (event: MouseEvent): void => {
    event.preventDefault();
    // If user dragged with RMB (orbit gesture for camera), suppress context action
    if (this.isDragging) {
      this.isDragging = false;
      this.mouseDownButton = null;
      this.mouseDownClientPos = null;
      return;
    }

    // If the event was already marked as handled by camera system, don't cancel movement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((event as any).cameraHandled) {
      return;
    }

    // Only cancel movement on a clean right-click (no drag, not camera rotation)
    this.clearTarget();
  };

  private onCameraTap = (event: { x: number; y: number }): void => {
    if (!this.canvas || !this.world.camera) return;

    // Block input if controls are disabled (spectator mode)
    if (!this.areControlsEnabled()) return;

    // Check if tapping on an entity first
    const target = this.getEntityAtPosition(event.x, event.y);
    if (target) {
      return;
    }

    // Calculate mouse position
    const rect = this.canvas.getBoundingClientRect();
    _mouse.x = ((event.x - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((event.y - rect.top) / rect.height) * 2 + 1;

    this.handleMoveRequest(_mouse);
  };

  private clearTarget(): void {
    if (this.targetMarker) {
      this.targetMarker.visible = false;
    }
    this.targetPosition = null;

    // Send cancel movement to server
    if (this.world.network?.send) {
      this.world.network.send("moveRequest", {
        target: null,
        cancel: true,
      });
    }
  }

  private onCanvasClick = (event: MouseEvent): void => {
    // If a drag just ended, the camera system will have suppressed this click
    if (event.defaultPrevented) return;

    if (event.button !== 0) return; // Left click only
    if (!this.canvas || !this.world.camera) return;

    // Block input if controls are disabled (spectator mode)
    if (!this.areControlsEnabled()) return;

    // Check if clicking on an interactable entity (item, NPC, etc.)
    const target = this.getEntityAtPosition(event.clientX, event.clientY);
    if (target) {
      // Handle item pickup with left-click
      if (target.type === "item") {
        event.preventDefault();
        const localPlayer = this.world.getPlayer();
        if (localPlayer) {
          // Check distance to item
          const distance = this.calculateDistance(
            localPlayer.position,
            target.position,
          );
          const pickupRange = 2.0; // Same as ItemEntity interaction range

          if (distance > pickupRange) {
            // Too far - move towards the item first
            this.moveToItem(localPlayer, target);
            return;
          }

          // Close enough - proceed with pickup
          this.attemptPickup(localPlayer, target);
        }
        return;
      }

      // Handle bank with left-click (Use Bank directly)
      if (target.type === "bank") {
        event.preventDefault();
        const localPlayer = this.world.getPlayer();
        if (localPlayer) {
          const distance = this.calculateDistance(
            localPlayer.position,
            target.position,
          );
          const bankRange = 3.0;

          if (distance > bankRange) {
            // Walk to bank, then open
            this.walkTo(target.position);
            const walkTime = Math.min(distance * 400, 3000);
            setTimeout(() => {
              if (this.world.network?.send) {
                const bankId =
                  (target.entity as { userData?: { bankId?: string } })
                    ?.userData?.bankId || target.id;
                this.world.network.send("bankOpen", { bankId });
              }
            }, walkTime);
            return;
          }

          // Close enough - open bank immediately
          if (this.world.network?.send) {
            const bankId =
              (target.entity as { userData?: { bankId?: string } })?.userData
                ?.bankId || target.id;
            this.world.network.send("bankOpen", { bankId });
          }
        }
        return;
      }

      // For other entities (mobs, NPCs, players, resources), don't show movement indicator
      // They should use context menus or other interaction methods
      return;
    }

    // Always handle left-click movement even if another system prevented default

    // Now prevent default for our handling
    event.preventDefault();

    // Calculate mouse position
    const rect = this.canvas.getBoundingClientRect();
    _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.handleMoveRequest(_mouse, event.shiftKey);
  };

  private handleMoveRequest(_mouse: THREE.Vector2, isShiftDown = false): void {
    if (!this.world.camera) return;

    // Block movement if controls are disabled (spectator mode)
    if (!this.areControlsEnabled()) return;

    // Raycast to find click position
    _raycaster.setFromCamera(_mouse, this.world.camera);

    // Raycast against full scene to find terrain
    const scene = this.world.stage?.scene;
    let target: THREE.Vector3 | null = null;
    let clickedOnEntity = false;
    if (scene) {
      const intersects = _raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        // Check if we clicked on an entity (player, mob, item, npc, resource)
        // by checking userData for entityId
        const clickedObject = intersects[0].object;
        if (clickedObject.userData && clickedObject.userData.entityId) {
          clickedOnEntity = true;
        } else {
          target = intersects[0].point.clone();
        }
      }
    }

    // If we clicked on an entity, don't show movement indicator
    if (clickedOnEntity) {
      return;
    }

    if (!target) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      target = new THREE.Vector3();
      _raycaster.ray.intersectPlane(plane, target);
    }

    if (target) {
      // Clear any previous target
      if (this.targetMarker && this.targetMarker.visible) {
        // Hide old marker immediately
        this.targetMarker.visible = false;
      }

      // Clamp target distance from player on XZ plane (server will also validate)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = (this.world as any).entities?.player;
      if (player && player.position) {
        const p = player.position as THREE.Vector3;
        const flatDir = new THREE.Vector3(target.x - p.x, 0, target.z - p.z);
        const dist = flatDir.length();
        if (dist > this.maxClickDistance) {
          flatDir.normalize().multiplyScalar(this.maxClickDistance);
          target = new THREE.Vector3(
            p.x + flatDir.x,
            target.y,
            p.z + flatDir.z,
          );
        }
      }

      // SNAP TARGET TO TILE CENTER (RuneScape-style)
      const targetTile = worldToTile(target.x, target.z);
      const snappedPos = tileToWorld(targetTile);
      target = new THREE.Vector3(snappedPos.x, target.y, snappedPos.z);

      // Update target position and show NEW marker at tile center
      this.targetPosition = target.clone();
      if (this.targetMarker) {
        this.targetMarker.position.set(target.x, 0, target.z);
        // Project the marker onto terrain to follow contours
        this.projectMarkerOntoTerrain(target.x, target.z, target.y);
        this.targetMarker.visible = true;
      }

      // ONLY send move request to server - no local movement!
      // Server is completely authoritative for movement
      if (this.world.network?.send) {
        // Note: No need to cancel first - server replaces path automatically
        // Sending cancel would cause idle flicker before new movement starts

        // Read player's runMode toggle if available; otherwise, use shift key status
        let runMode = isShiftDown;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const player = (this.world as any).entities?.player as {
          runMode?: boolean;
        };
        if (player && typeof player.runMode === "boolean") {
          runMode = player.runMode;
        }
        // Send both world coordinates and tile coordinates
        this.world.network.send("moveRequest", {
          target: [target.x, target.y, target.z],
          targetTile: { x: targetTile.x, z: targetTile.z },
          runMode,
          cancel: false, // Explicitly not cancelling
        });
      }
    }
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.canvas) return;
    if (this.mouseDownButton === null || !this.mouseDownClientPos) return;
    const dx = event.clientX - this.mouseDownClientPos.x;
    const dy = event.clientY - this.mouseDownClientPos.y;
    if (
      !this.isDragging &&
      (Math.abs(dx) > this.dragThresholdPx ||
        Math.abs(dy) > this.dragThresholdPx)
    ) {
      this.isDragging = true;
    }
  };

  private onMouseDown = (event: MouseEvent): void => {
    // Block interactions if controls are disabled (spectator mode)
    if (!this.areControlsEnabled()) return;

    if (event.button === 2) {
      const target = this.getEntityAtPosition(event.clientX, event.clientY);
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.showContextMenu(target, event.clientX, event.clientY);
        return;
      }
    } else {
      // Close any open menus on left-click
      window.dispatchEvent(new CustomEvent("contextmenu:close"));
    }

    this.isDragging = false;
    this.mouseDownButton = event.button;
    this.mouseDownClientPos = { x: event.clientX, y: event.clientY };
  };

  private onMouseUp = (_event: MouseEvent): void => {
    this.isDragging = false;
    this.mouseDownButton = null;
    this.mouseDownClientPos = null;
  };

  private onTouchStart(event: TouchEvent): void {
    // Block touch interactions if controls are disabled (spectator mode)
    if (!this.areControlsEnabled()) return;

    const touch = event.touches[0];
    if (!touch) return;

    this.touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    this.longPressTimer = setTimeout(() => {
      if (this.touchStart) {
        const target = this.getEntityAtPosition(
          this.touchStart.x,
          this.touchStart.y,
        );
        if (target) {
          event.preventDefault();
          event.stopPropagation();
          this.showContextMenu(target, this.touchStart.x, this.touchStart.y);
        }
        this.touchStart = null;
      }
    }, this.LONG_PRESS_DURATION);
  }

  private onTouchEnd(_event: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (
      this.touchStart &&
      Date.now() - this.touchStart.time < this.LONG_PRESS_DURATION
    ) {
      this.touchStart = null;
      return;
    }

    this.touchStart = null;
  }

  override update(): void {
    // Animate target marker
    if (this.targetMarker && this.targetMarker.visible) {
      const time = Date.now() * 0.001;
      // Pulse effect (scale animation)
      const scale = 1 + Math.sin(time * 4) * 0.1;
      this.targetMarker.scale.set(scale, 1, scale);
      // Note: No rotation effect since marker is projected onto terrain

      // Hide marker when player reaches target
      const player = this.world.entities.player;
      if (player && this.targetPosition) {
        const distance = player.position.distanceTo(this.targetPosition);
        if (distance < 0.5) {
          this.targetMarker.visible = false;
          this.targetPosition = null;
        }
      }
    }
  }

  // === CONTEXT MENU METHODS (merged from EntityInteractionSystem) ===

  private getEntityAtPosition(
    screenX: number,
    screenY: number,
  ): {
    id: string;
    type: string;
    name: string;
    entity: unknown;
    position: Position3D;
  } | null {
    if (!this.canvas || !this.world.camera || !this.world.stage?.scene)
      return null;

    const rect = this.canvas.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this._tempVec2.set(x, y), this.world.camera);

    const intersects = this.raycaster.intersectObjects(
      this.world.stage.scene.children,
      true,
    );

    for (const intersect of intersects) {
      if (intersect.distance > 200) continue;

      let obj: THREE.Object3D | null = intersect.object;
      while (obj) {
        const userData = obj.userData;
        // Look for any entity identifier - entityId, mobId, resourceId, or itemId
        const entityId =
          userData?.entityId ||
          userData?.mobId ||
          userData?.resourceId ||
          userData?.itemId;

        if (entityId) {
          const entity = this.world.entities.get(entityId);
          if (entity) {
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);

            return {
              id: entityId,
              type: entity.type || userData.type || "unknown",
              name: entity.name || userData.name || "Entity",
              entity,
              position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
            };
          }
        }

        obj = obj.parent as THREE.Object3D | null;
      }
    }

    return null;
  }

  private showContextMenu(
    target: {
      id: string;
      type: string;
      name: string;
      entity: unknown;
      position: Position3D;
    },
    screenX: number,
    screenY: number,
  ): void {
    const localPlayer = this.world.getPlayer();
    if (!localPlayer) return;

    const actions = this.getActionsForEntityType(target, localPlayer.id);

    if (actions.length === 0) {
      console.warn("[InteractionSystem] No actions available for", target.type);
      return;
    }

    const evt = new CustomEvent("contextmenu", {
      detail: {
        target: {
          id: target.id,
          type: target.type,
          name: target.name,
          position: target.position,
        },
        mousePosition: { x: screenX, y: screenY },
        items: actions.map((action) => ({
          id: action.id,
          label: action.label,
          enabled: action.enabled,
        })),
      },
    });
    window.dispatchEvent(evt);

    const onSelect = (e: Event) => {
      const ce = e as CustomEvent<{ actionId: string; targetId: string }>;

      if (!ce?.detail || ce.detail.targetId !== target.id) {
        return;
      }

      window.removeEventListener(
        "contextmenu:select",
        onSelect as EventListener,
      );

      const action = actions.find((a) => a.id === ce.detail.actionId);

      if (action) {
        action.handler();
      }
    };
    window.addEventListener("contextmenu:select", onSelect as EventListener, {
      once: true,
    });
  }

  private getActionsForEntityType(
    target: {
      id: string;
      type: string;
      name: string;
      entity: unknown;
      position: Position3D;
    },
    playerId: string,
  ): InteractionAction[] {
    const actions: InteractionAction[] = [];

    switch (target.type) {
      case "item":
        actions.push({
          id: "pickup",
          label: `Take ${target.name}`,
          icon: "🎒",
          enabled: true,
          handler: () => {
            const player = this.world.getPlayer();
            if (!player) return;

            // Check distance to item
            const distance = this.calculateDistance(
              player.position,
              target.position,
            );
            const pickupRange = 2.0; // Same as ItemEntity interaction range

            if (distance > pickupRange) {
              // Too far - move towards the item first
              this.moveToItem(player, target);
              return;
            }

            // Close enough - proceed with pickup
            this.attemptPickup(player, target);
          },
        });
        actions.push({
          id: "examine",
          label: "Examine",
          icon: "👁️",
          enabled: true,
          handler: () => {
            this.world.emit(EventType.UI_MESSAGE, {
              playerId,
              message: `It's ${target.name.toLowerCase()}.`,
              type: "examine",
            });
          },
        });
        break;

      case "headstone":
      case "corpse":
        actions.push({
          id: "loot",
          label: `Loot ${target.name}`,
          icon: "💀",
          enabled: true,
          handler: () => {
            const player = this.world.getPlayer();
            if (!player) return;

            // Check distance to gravestone (RuneScape-style: walk if too far, then loot)
            const distance = this.calculateDistance(
              player.position,
              target.position,
            );
            const lootRange = 2.0; // Must be within 2 meters to loot

            if (distance > lootRange) {
              // Too far - walk to gravestone first
              console.log(
                `[InteractionSystem] 🚶 Walking to loot gravestone (distance: ${distance.toFixed(1)}m)`,
              );

              this.walkTo(target.position);

              // Schedule loot action after walking (RuneScape behavior)
              setTimeout(() => {
                // Re-check distance after walking
                const newDistance = this.calculateDistance(
                  player.position,
                  target.position,
                );

                if (newDistance <= lootRange + 0.5) {
                  // Close enough now - trigger entity interaction
                  const entity = target.entity as {
                    handleInteraction?: (data: unknown) => Promise<void>;
                  };
                  if (entity?.handleInteraction) {
                    entity.handleInteraction({
                      entityId: target.id,
                      playerId,
                      playerPosition: player.position,
                    });
                  }
                } else {
                  console.warn(
                    "[InteractionSystem] Still too far from gravestone after walking",
                  );
                }
              }, 2000); // Wait 2 seconds for walking

              return;
            }

            // Close enough - trigger entity interaction immediately
            const entity = target.entity as {
              handleInteraction?: (data: unknown) => Promise<void>;
            };
            if (entity?.handleInteraction) {
              entity.handleInteraction({
                entityId: target.id,
                playerId,
                playerPosition: player.position,
              });
            }
          },
        });
        actions.push({
          id: "examine",
          label: "Examine",
          icon: "👁️",
          enabled: true,
          handler: () => {
            this.world.emit(EventType.UI_MESSAGE, {
              playerId,
              message: `The corpse of a ${target.name.toLowerCase()}.`,
              type: "examine",
            });
          },
        });
        break;

      case "resource": {
        type ResourceEntity = { config?: { resourceType?: string } };
        const resourceType =
          (target.entity as ResourceEntity).config?.resourceType || "tree";

        if (resourceType.includes("tree")) {
          actions.push({
            id: "chop",
            label: "Chop",
            icon: "🪓",
            enabled: true,
            handler: () => this.handleResourceAction(target.id, "chop"),
          });
        } else if (
          resourceType.includes("rock") ||
          resourceType.includes("ore")
        ) {
          actions.push({
            id: "mine",
            label: "Mine",
            icon: "⛏️",
            enabled: true,
            handler: () => this.handleResourceAction(target.id, "mine"),
          });
        } else if (resourceType.includes("fish")) {
          actions.push({
            id: "fish",
            label: "Fish",
            icon: "🎣",
            enabled: true,
            handler: () => this.handleResourceAction(target.id, "fish"),
          });
        }

        actions.push({
          id: "walk_here",
          label: "Walk here",
          icon: "🚶",
          enabled: true,
          handler: () => this.walkTo(target.position),
        });
        actions.push({
          id: "examine",
          label: "Examine",
          icon: "👁️",
          enabled: true,
          handler: () => this.examineEntity(target, playerId),
        });
        break;
      }

      case "mob": {
        type MobEntity = {
          getMobData?: () => { health?: number; level?: number } | null;
        };
        const mobData = (target.entity as MobEntity).getMobData
          ? (target.entity as MobEntity).getMobData!()
          : null;
        const isAlive = (mobData?.health || 0) > 0;

        actions.push({
          id: "attack",
          label: `Attack ${target.name} (Lv${mobData?.level || 1})`,
          icon: "⚔️",
          enabled: isAlive,
          handler: () => {
            // Check if mob is still alive before attacking
            const currentMobData = (target.entity as MobEntity).getMobData
              ? (target.entity as MobEntity).getMobData!()
              : null;
            const isStillAlive = (currentMobData?.health || 0) > 0;

            if (!isStillAlive) {
              return; // Mob is dead, don't attack
            }

            // Check for debouncing to prevent duplicate attack requests
            const attackKey = `${playerId}:${target.id}`;
            const now = Date.now();
            const lastRequest = this.recentAttackRequests.get(attackKey);

            if (lastRequest && now - lastRequest < this.ATTACK_DEBOUNCE_TIME) {
              return;
            }

            // Record this attack request
            this.recentAttackRequests.set(attackKey, now);

            // Clean up old entries (older than 5 seconds)
            for (const [
              key,
              timestamp,
            ] of this.recentAttackRequests.entries()) {
              if (now - timestamp > 5000) {
                this.recentAttackRequests.delete(key);
              }
            }

            if (this.world.network?.send) {
              this.world.network.send("attackMob", {
                mobId: target.id,
                attackType: "melee",
              });
            } else {
              console.warn(
                "[InteractionSystem] No network.send available for attack",
              );
              // Fallback for single-player
              this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
                playerId,
                targetId: target.id,
                attackType: AttackType.MELEE,
              });
            }
          },
        });
        actions.push({
          id: "walk_here",
          label: "Walk here",
          icon: "🚶",
          enabled: true,
          handler: () => this.walkTo(target.position),
        });
        actions.push({
          id: "examine",
          label: "Examine",
          icon: "👁️",
          enabled: true,
          handler: () => this.examineEntity(target, playerId),
        });
        break;
      }

      case "npc": {
        type NPCEntity = { config?: { services?: string[] } };
        const npcConfig = (target.entity as NPCEntity).config || {};
        const services = npcConfig.services || [];

        if (services.includes("bank")) {
          actions.push({
            id: "open-bank",
            label: "Open Bank",
            icon: "🏦",
            enabled: true,
            handler: () => {
              this.world.emit(EventType.BANK_OPEN, {
                playerId,
                bankId: target.id,
                position: target.position,
              });
            },
          });
        }

        if (services.includes("store")) {
          actions.push({
            id: "open-store",
            label: "Trade",
            icon: "🏪",
            enabled: true,
            handler: () => {
              this.world.emit(EventType.STORE_OPEN, {
                playerId,
                storeId: target.id,
                position: target.position,
              });
            },
          });
        }

        actions.push({
          id: "talk",
          label: "Talk",
          icon: "💬",
          enabled: true,
          handler: () => {
            this.world.emit(EventType.NPC_DIALOGUE, {
              playerId,
              npcId: target.id,
            });
          },
        });

        actions.push({
          id: "examine",
          label: "Examine",
          icon: "👁️",
          enabled: true,
          handler: () => this.examineEntity(target, playerId),
        });
        break;
      }

      case "bank": {
        // Primary action: Use Bank
        actions.push({
          id: "use-bank",
          label: "Use Bank",
          icon: "🏦",
          enabled: true,
          handler: () => {
            const player = this.world.getPlayer();
            if (!player) return;

            const distance = this.calculateDistance(
              player.position,
              target.position,
            );
            const bankRange = 3.0;

            if (distance > bankRange) {
              // Walk to bank, then open
              this.walkTo(target.position);
              const walkTime = Math.min(distance * 400, 3000);
              setTimeout(() => {
                if (this.world.network?.send) {
                  const bankId =
                    (target.entity as { userData?: { bankId?: string } })
                      ?.userData?.bankId || target.id;
                  this.world.network.send("bankOpen", { bankId });
                }
              }, walkTime);
              return;
            }

            // Close enough - open bank
            if (this.world.network?.send) {
              const bankId =
                (target.entity as { userData?: { bankId?: string } })?.userData
                  ?.bankId || target.id;
              this.world.network.send("bankOpen", { bankId });
            }
          },
        });

        // Examine action
        actions.push({
          id: "examine",
          label: "Examine",
          icon: "👁️",
          enabled: true,
          handler: () => {
            this.world.emit(EventType.UI_MESSAGE, {
              playerId,
              message: "A secure place to store your items.",
              type: "examine",
            });
          },
        });
        break;
      }
    }

    return actions;
  }

  private handleResourceAction(resourceId: string, action: string): void {
    const localPlayer = this.world.getPlayer();
    if (!localPlayer) return;

    // Get the resource entity to check distance
    const resourceEntity = this.world.entities.get(resourceId);
    if (!resourceEntity) {
      console.warn(
        "[InteractionSystem] Resource entity not found:",
        resourceId,
      );
      return;
    }

    // Check distance to resource (RuneScape-style: walk if too far, then interact)
    const resourcePos = resourceEntity.position;
    const playerPos = localPlayer.position;
    const distance = Math.sqrt(
      Math.pow(resourcePos.x - playerPos.x, 2) +
        Math.pow(resourcePos.z - playerPos.z, 2),
    );

    const interactionDistance = 3.0; // Must be within 3 meters

    if (distance > interactionDistance) {
      // Too far - walk to resource first (RuneScape behavior)
      console.log(
        `[InteractionSystem] 🚶 Walking to ${action} (distance: ${distance.toFixed(1)}m)`,
      );

      // Walk to just outside interaction range
      const targetDistance = interactionDistance - 0.5; // Stop 0.5m before max range
      const direction = {
        x: (resourcePos.x - playerPos.x) / distance,
        z: (resourcePos.z - playerPos.z) / distance,
      };

      const targetPos = {
        x: resourcePos.x - direction.x * targetDistance,
        y: resourcePos.y,
        z: resourcePos.z - direction.z * targetDistance,
      };

      this.walkTo(targetPos);

      // Schedule the resource action to execute after walking
      setTimeout(() => {
        // Re-check distance after walking
        const newDistance = Math.sqrt(
          Math.pow(resourcePos.x - localPlayer.position.x, 2) +
            Math.pow(resourcePos.z - localPlayer.position.z, 2),
        );

        if (newDistance <= interactionDistance + 0.5) {
          // Close enough now - execute the action
          this.executeResourceAction(resourceId, action);
        } else {
          console.warn(
            "[InteractionSystem] Still too far after walking, skipping action",
          );
        }
      }, 2000); // Wait 2 seconds for walking

      return;
    }

    // Close enough - execute immediately
    this.executeResourceAction(resourceId, action);
  }

  private executeResourceAction(resourceId: string, action: string): void {
    const localPlayer = this.world.getPlayer();
    if (!localPlayer) return;

    // Check for debouncing to prevent duplicate resource requests
    const resourceKey = `${localPlayer.id}:${resourceId}`;
    const now = Date.now();
    const lastRequest = this.recentResourceRequests.get(resourceKey);

    if (lastRequest && now - lastRequest < this.RESOURCE_DEBOUNCE_TIME) {
      return;
    }

    // Record this resource request
    this.recentResourceRequests.set(resourceKey, now);

    // Clean up old entries (older than 5 seconds)
    for (const [key, timestamp] of this.recentResourceRequests.entries()) {
      if (now - timestamp > 5000) {
        this.recentResourceRequests.delete(key);
      }
    }

    // Send network packet to server to start gathering
    if (this.world.network?.send) {
      this.world.network.send("resourceGather", {
        resourceId,
        playerPosition: {
          x: localPlayer.position.x,
          y: localPlayer.position.y,
          z: localPlayer.position.z,
        },
      });
    } else {
      console.warn(
        "[InteractionSystem] No network.send available for resource gathering",
      );
      // Fallback for single-player - emit RESOURCE_GATHER directly
      this.world.emit(EventType.RESOURCE_GATHER, {
        playerId: localPlayer.id,
        resourceId,
        playerPosition: {
          x: localPlayer.position.x,
          y: localPlayer.position.y,
          z: localPlayer.position.z,
        },
      });
    }
  }

  private walkTo(position: Position3D): void {
    if (this.world.network?.send) {
      this.world.network.send("moveRequest", {
        target: [position.x, position.y || 0, position.z],
        runMode: true,
        cancel: false,
      });
    }
  }

  private examineEntity(
    target: { type: string; name: string; entity: unknown },
    playerId: string,
  ): void {
    let message = `It's ${target.name.toLowerCase()}.`;

    if (target.type === "mob") {
      type MobEntity = {
        getMobData?: () => { health?: number; level?: number } | null;
      };
      const mobData = (target.entity as MobEntity).getMobData
        ? (target.entity as MobEntity).getMobData!()
        : null;
      message = `A level ${mobData?.level || 1} ${target.name}. ${(mobData?.health || 0) > 0 ? "It looks dangerous!" : "It is dead."}`;
    } else if (target.type === "resource") {
      type ResourceEntity = { config?: { resourceType?: string } };
      const resourceType =
        (target.entity as ResourceEntity).config?.resourceType || "tree";
      if (resourceType.includes("tree")) {
        message = "A tree. I can chop it down with a hatchet.";
      } else if (resourceType.includes("rock")) {
        message = "A rock containing ore. I could mine it with a pickaxe.";
      } else if (resourceType.includes("fish")) {
        message = "Fish are swimming in the water here.";
      }
    }

    this.world.emit(EventType.UI_MESSAGE, {
      playerId,
      message,
      type: "examine",
    });
  }

  // === Distance-based pickup helper methods ===

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: Position3D, pos2: Position3D): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Move player towards an item
   */
  private moveToItem(
    player: Entity,
    target: { id: string; position: Position3D },
  ): void {
    // Track this pickup for auto-completion when movement finishes
    this.pendingPickups.set(player.id, {
      itemId: target.id,
      position: target.position,
    });

    // Send move request to get closer to the item
    if (this.world.network?.send) {
      this.world.network.send("moveRequest", {
        target: [target.position.x, target.position.y, target.position.z],
        runMode: false,
      });
    }

    // Show feedback message
    this.world.emit(EventType.UI_MESSAGE, {
      playerId: player.id,
      message: "Moving towards the item...",
      type: "info",
    });
  }

  /**
   * Attempt to pickup an item (with debouncing)
   */
  private attemptPickup(
    player: Entity,
    target: { id: string; position: Position3D; entity: unknown },
  ): void {
    // Check for debouncing to prevent duplicate pickup requests
    const pickupKey = `${player.id}:${target.id}`;
    const now = Date.now();
    const lastRequest = this.recentPickupRequests.get(pickupKey);

    if (lastRequest && now - lastRequest < this.PICKUP_DEBOUNCE_TIME) {
      return;
    }

    // Record this pickup request
    this.recentPickupRequests.set(pickupKey, now);

    // Clean up old entries (older than 5 seconds)
    for (const [key, timestamp] of this.recentPickupRequests.entries()) {
      if (now - timestamp > 5000) {
        this.recentPickupRequests.delete(key);
      }
    }

    if (this.world.network?.send) {
      this.world.network.send("pickupItem", { itemId: target.id });
    } else {
      console.warn("[InteractionSystem] No network.send available for pickup");
      // Fallback for single-player
      const entity = target.entity as {
        handleInteraction?: (data: unknown) => Promise<void>;
      };
      if (entity?.handleInteraction) {
        entity.handleInteraction({
          entityId: target.id,
          playerId: player.id,
          playerPosition: player.position,
        });
      }
    }
  }

  override destroy(): void {
    // Clean up event listeners
    this.world.off(EventType.ENTITY_MODIFIED, this.onEntityModified.bind(this));
    super.destroy();
  }

  /**
   * Handle entity modification events to detect movement completion
   */
  private onEntityModified(data: {
    id: string;
    changes: { e?: string; p?: number[] };
  }): void {
    // Check if this is a movement completion event (idle state)
    if (data.changes.e === "idle") {
      const player = this.world.getPlayer();
      if (player && player.id === data.id) {
        // Check if we have a pending pickup for this player
        const pendingPickup = this.pendingPickups.get(player.id);
        if (pendingPickup) {
          // Check if we're close enough to the item now
          const distance = this.calculateDistance(
            player.position,
            pendingPickup.position,
          );
          const pickupRange = 2.0;

          if (distance <= pickupRange) {
            // Close enough - attempt pickup
            const target = {
              id: pendingPickup.itemId,
              position: pendingPickup.position,
              entity: null, // We don't have the entity reference here
            };
            this.attemptPickup(player, target);
          }

          // Clear the pending pickup regardless
          this.pendingPickups.delete(player.id);
        }
      }
    }
  }
}
