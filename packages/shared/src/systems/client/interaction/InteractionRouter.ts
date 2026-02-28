/**
 * InteractionRouter
 *
 * Main coordinator for the interaction system.
 * Replaces the legacy InteractionSystem god class.
 *
 * Responsibilities:
 * - Listen to input events (mouse, touch)
 * - Delegate to RaycastService for entity detection
 * - Route to appropriate handler based on entity type
 * - Manage handler registration
 * - Coordinate visual feedback and context menus
 *
 * This is a slim coordinator (~200 lines) that delegates
 * actual interaction logic to focused handler classes.
 */

import * as THREE from "three";
import { LineBasicNodeMaterial } from "three/webgpu";
import { System } from "../../shared/infrastructure/System";
import type { World } from "../../../core/World";
import type { InteractableEntityType, ContextMenuAction } from "./types";
import type { Position3D } from "../../../types/core/base-types";
import type { PostProcessingComposer } from "../../../utils/rendering/PostProcessingFactory";
import {
  INPUT,
  TIMING,
  MESSAGE_TYPES,
  DEBUG_INTERACTIONS,
  PATH_VISUALIZATION,
} from "./constants";
import { EventType } from "../../../types/events/event-types";
import {
  worldToTile,
  tileToWorld,
  type TileCoord,
} from "../../shared/movement/TileSystem";
import { BFSPathfinder } from "../../shared/movement/BFSPathfinder";
import { CollisionMask } from "../../shared/movement/CollisionFlags";
import type { BuildingCollisionService } from "../../shared/world/BuildingCollisionService";

// Services
import { ActionQueueService } from "./services/ActionQueueService";
import { RaycastService } from "./services/RaycastService";
import { VisualFeedbackService } from "./services/VisualFeedbackService";
import { EntityHighlightService } from "./services/EntityHighlightService";
import { ContextMenuController } from "./ContextMenuController";

// Handlers
import { BaseInteractionHandler } from "./handlers/BaseInteractionHandler";
import { ItemInteractionHandler } from "./handlers/ItemInteractionHandler";
import { NPCInteractionHandler } from "./handlers/NPCInteractionHandler";
import { MobInteractionHandler } from "./handlers/MobInteractionHandler";
import { ResourceInteractionHandler } from "./handlers/ResourceInteractionHandler";
import { BankInteractionHandler } from "./handlers/BankInteractionHandler";
import { CorpseInteractionHandler } from "./handlers/CorpseInteractionHandler";
import { PlayerInteractionHandler } from "./handlers/PlayerInteractionHandler";
import { CookingSourceInteractionHandler } from "./handlers/CookingSourceInteractionHandler";
import { SmeltingSourceInteractionHandler } from "./handlers/SmeltingSourceInteractionHandler";
import { SmithingSourceInteractionHandler } from "./handlers/SmithingSourceInteractionHandler";
import { AltarInteractionHandler } from "./handlers/AltarInteractionHandler";
import { StarterChestInteractionHandler } from "./handlers/StarterChestInteractionHandler";
import { ForfeitPillarInteractionHandler } from "./handlers/ForfeitPillarInteractionHandler";
import { RunecraftingAltarInteractionHandler } from "./handlers/RunecraftingAltarInteractionHandler";
import { SignpostInteractionHandler } from "./handlers/SignpostInteractionHandler";
import { BuildingSignInteractionHandler } from "./handlers/BuildingSignInteractionHandler";

/**
 * Targeting mode state for "Use X on Y" interactions
 */
interface TargetingModeState {
  active: boolean;
  sourceItem: { id: string; slot: number; name?: string } | null;
  validTargetIds: Set<string>;
  actionType: "firemaking" | "cooking" | "smelting" | "none";
}

export class InteractionRouter extends System {
  private canvas: HTMLCanvasElement | null = null;

  // Services
  private actionQueue: ActionQueueService;
  private raycastService: RaycastService;
  private visualFeedback: VisualFeedbackService;
  private highlightService: EntityHighlightService;
  private contextMenu: ContextMenuController;

  // Handlers by entity type
  private handlers = new Map<InteractableEntityType, BaseInteractionHandler>();

  // Input state
  private isDragging = false;
  private mouseDownButton: number | null = null;
  private mouseDownClientPos: { x: number; y: number } | null = null;
  private touchStart: { x: number; y: number; time: number } | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // Hover highlight throttle
  private lastHoverTime = 0;
  private static readonly HOVER_THROTTLE_MS = 50;

  // Targeting mode state (OSRS "Use X on Y")
  private targetingMode: TargetingModeState = {
    active: false,
    sourceItem: null,
    validTargetIds: new Set(),
    actionType: "none",
  };

  // Path visualization
  private pathLine: THREE.Line | null = null;
  private pathLineTimeout: ReturnType<typeof setTimeout> | null = null;
  private pathfinder: BFSPathfinder = new BFSPathfinder();

  // Pending-move queue: ensures the most recent click always reaches the server
  // even when two clicks arrive within the server's rate-limit window (67ms / 15 req/sec).
  private _lastMoveSentAt = 0;
  private _pendingMove: {
    target: [number, number, number];
    targetTile: { x: number; z: number };
    runMode: boolean;
    cancel: boolean;
  } | null = null;
  private _pendingMoveTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly MOVE_SEND_COOLDOWN_MS = 70;

  constructor(world: World) {
    super(world);

    // Initialize services
    this.actionQueue = new ActionQueueService(world);
    this.raycastService = new RaycastService(world);
    this.visualFeedback = new VisualFeedbackService(world);
    this.highlightService = new EntityHighlightService(world);
    this.contextMenu = new ContextMenuController();

    // Register handlers
    this.registerHandlers();
  }

  /**
   * Get the shared RaycastService instance
   *
   * Other systems (e.g., ClientCameraSystem) should use this
   * instead of creating their own instance, to benefit from
   * shared caching (16ms frame-based cache).
   */
  getRaycastService(): RaycastService {
    return this.raycastService;
  }

  private registerHandlers(): void {
    this.handlers.set(
      "item",
      new ItemInteractionHandler(this.world, this.actionQueue),
    );
    this.handlers.set(
      "npc",
      new NPCInteractionHandler(this.world, this.actionQueue),
    );
    this.handlers.set(
      "mob",
      new MobInteractionHandler(this.world, this.actionQueue),
    );
    this.handlers.set(
      "resource",
      new ResourceInteractionHandler(this.world, this.actionQueue),
    );
    this.handlers.set(
      "bank",
      new BankInteractionHandler(this.world, this.actionQueue),
    );
    this.handlers.set(
      "corpse",
      new CorpseInteractionHandler(this.world, this.actionQueue),
    );
    this.handlers.set(
      "headstone",
      new CorpseInteractionHandler(this.world, this.actionQueue),
    );
    this.handlers.set(
      "player",
      new PlayerInteractionHandler(this.world, this.actionQueue),
    );
    // Cooking sources (fires and ranges)
    const cookingHandler = new CookingSourceInteractionHandler(
      this.world,
      this.actionQueue,
    );
    this.handlers.set("fire", cookingHandler);
    this.handlers.set("range", cookingHandler);

    // Smelting source (furnaces)
    this.handlers.set(
      "furnace",
      new SmeltingSourceInteractionHandler(this.world, this.actionQueue),
    );

    // Smithing source (anvils)
    this.handlers.set(
      "anvil",
      new SmithingSourceInteractionHandler(this.world, this.actionQueue),
    );

    // Altar (prayer recharge)
    this.handlers.set(
      "altar",
      new AltarInteractionHandler(this.world, this.actionQueue),
    );

    // Runecrafting altar (essence → runes)
    this.handlers.set(
      "runecrafting_altar",
      new RunecraftingAltarInteractionHandler(this.world, this.actionQueue),
    );

    // Starter chest (new player equipment)
    this.handlers.set(
      "starter_chest",
      new StarterChestInteractionHandler(this.world, this.actionQueue),
    );

    // Forfeit pillar (duel arena surrender)
    this.handlers.set(
      "forfeit_pillar",
      new ForfeitPillarInteractionHandler(this.world, this.actionQueue),
    );

    // Signpost (town direction signs)
    this.handlers.set(
      "signpost",
      new SignpostInteractionHandler(this.world, this.actionQueue),
    );

    // Building sign (hanging signs on building facades)
    this.handlers.set(
      "building_sign",
      new BuildingSignInteractionHandler(this.world, this.actionQueue),
    );
  }

  override start(): void {
    this.canvas = this.world.graphics?.renderer?.domElement ?? null;
    if (!this.canvas) {
      console.warn(`[InteractionRouter] No canvas found, graphics not ready`);
      return;
    }

    // Initialize visual feedback
    this.visualFeedback.initialize();

    // Wire highlight service to post-processing composer
    const graphics = this.world.graphics as
      | { composer?: PostProcessingComposer | null }
      | undefined;
    if (graphics?.composer) {
      this.highlightService.setComposer(graphics.composer);
    }

    // Bind event handlers
    this.onCanvasClick = this.onCanvasClick.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    // Add event listeners
    this.canvas.addEventListener("click", this.onCanvasClick, false);
    this.canvas.addEventListener("contextmenu", this.onContextMenu, true);
    this.canvas.addEventListener("mousedown", this.onMouseDown, true);
    window.addEventListener("mouseup", this.onMouseUp, false);
    this.canvas.addEventListener("mousemove", this.onMouseMove, false);
    this.canvas.addEventListener("touchstart", this.onTouchStart, true);
    this.canvas.addEventListener("touchend", this.onTouchEnd, true);

    // Listen for camera tap events on mobile
    this.world.on(EventType.CAMERA_TAP, this.onCameraTap);

    // Listen for entity modification events to detect movement completion
    // This is critical for accurate item pickup (range 0 actions)
    this.world.on(EventType.ENTITY_MODIFIED, this.onEntityModified);

    // Listen for targeting mode events (OSRS "Use X on Y")
    this.world.on(EventType.TARGETING_START, this.onTargetingStart);
    this.world.on(EventType.TARGETING_COMPLETE, this.onTargetingComplete);
    this.world.on(EventType.TARGETING_CANCEL, this.onTargetingCancel);
  }

  override update(): void {
    // Update action queue (check if player reached targets)
    this.actionQueue.update();

    // Update visual feedback (animate markers)
    this.visualFeedback.update();
  }

  /**
   * Cancel any pending client-side action (walk-to, interaction).
   * Used when player teleports to prevent stale actions from executing.
   */
  cancelCurrentAction(): void {
    this.actionQueue.cancelCurrentAction();
    this.visualFeedback.hideTargetMarker();
    this.visualFeedback.hideMovementIndicator();
  }

  override destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener("click", this.onCanvasClick);
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
      this.canvas.removeEventListener("mousedown", this.onMouseDown);
      window.removeEventListener("mouseup", this.onMouseUp);
      this.canvas.removeEventListener("mousemove", this.onMouseMove);
      this.canvas.removeEventListener("touchstart", this.onTouchStart);
      this.canvas.removeEventListener("touchend", this.onTouchEnd);
      this.canvas.style.cursor = "default";
    }

    this.highlightService.clearHover();

    this.world.off(EventType.CAMERA_TAP, this.onCameraTap);
    this.world.off(EventType.ENTITY_MODIFIED, this.onEntityModified);
    this.world.off(EventType.TARGETING_START, this.onTargetingStart);
    this.world.off(EventType.TARGETING_COMPLETE, this.onTargetingComplete);
    this.world.off(EventType.TARGETING_CANCEL, this.onTargetingCancel);

    this.actionQueue.destroy();
    this.visualFeedback.destroy();
    this.contextMenu.destroy();

    // Clear path visualization
    this.clearPathVisualization();

    // Clear handlers map to prevent memory leaks on recreation
    this.handlers.clear();

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    if (this._pendingMoveTimer) {
      clearTimeout(this._pendingMoveTimer);
      this._pendingMoveTimer = null;
      this._pendingMove = null;
    }

    super.destroy();
  }

  // === Input Handlers ===

  private onCanvasClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (!this.canvas || !this.areControlsEnabled()) return;
    if (this.isEventFromModal(event)) return;

    // Check for entity at click position
    const target = this.raycastService.getEntityAtPosition(
      event.clientX,
      event.clientY,
      this.canvas,
    );

    // OSRS-style targeting mode: handle world entity clicks for cooking
    if (this.targetingMode.active) {
      event.preventDefault();

      if (target && this.isValidWorldTarget(target.entityId)) {
        // Valid target clicked - emit TARGETING_SELECT
        const player = this.world.getPlayer();
        if (player && this.targetingMode.sourceItem) {
          this.world.emit(EventType.TARGETING_SELECT, {
            playerId: player.id,
            sourceItemId: this.targetingMode.sourceItem.id,
            sourceSlot: this.targetingMode.sourceItem.slot,
            targetId: target.entityId,
            targetType: "world_entity" as const,
          });
        }
      } else {
        // Clicked empty space or invalid target - cancel targeting mode
        const player = this.world.getPlayer();
        if (player) {
          this.world.emit(EventType.TARGETING_CANCEL, { playerId: player.id });
        }
      }
      return;
    }

    if (target) {
      // Show red X click indicator
      this.visualFeedback.showClickIndicator(target.hitPoint, "entity");

      // Route to handler
      const handler = this.handlers.get(target.entityType);
      if (handler) {
        event.preventDefault();
        handler.onLeftClick(target);
        return;
      }
    }

    // No entity - handle as movement click
    event.preventDefault();
    this.handleMoveClick(event.clientX, event.clientY, event.shiftKey);
  };

  private onContextMenu = (event: MouseEvent): void => {
    if (!this.areControlsEnabled()) return;
    if (!this.canvas) return;
    if (this.isEventFromModal(event)) return;

    if (DEBUG_INTERACTIONS) console.time("[ContextMenu] Total");
    if (DEBUG_INTERACTIONS) console.time("[ContextMenu] Raycast");

    const target = this.raycastService.getEntityAtPosition(
      event.clientX,
      event.clientY,
      this.canvas,
    );

    if (DEBUG_INTERACTIONS) console.timeEnd("[ContextMenu] Raycast");

    if (target) {
      // Entity right-click - show entity-specific menu
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const handler = this.handlers.get(target.entityType);
      if (handler) {
        if (DEBUG_INTERACTIONS) console.time("[ContextMenu] GetActions");
        const actions = handler.getContextMenuActions(target);
        if (DEBUG_INTERACTIONS) console.timeEnd("[ContextMenu] GetActions");

        if (DEBUG_INTERACTIONS) console.time("[ContextMenu] ShowMenu");
        this.contextMenu.showMenu(
          target,
          actions,
          event.clientX,
          event.clientY,
        );
        if (DEBUG_INTERACTIONS) console.timeEnd("[ContextMenu] ShowMenu");
      }
    } else {
      // Terrain right-click - show "Walk here" menu
      this.showTerrainContextMenu(event.clientX, event.clientY, event.shiftKey);
    }

    if (DEBUG_INTERACTIONS) console.timeEnd("[ContextMenu] Total");
  };

  /**
   * Show terrain context menu with "Walk here", "Show path here", and "Cancel" options
   * Used by both desktop right-click and mobile long-press
   */
  private showTerrainContextMenu(
    screenX: number,
    screenY: number,
    shiftKey: boolean = false,
  ): void {
    if (!this.canvas) return;

    const terrainPos = this.raycastService.getTerrainPosition(
      screenX,
      screenY,
      this.canvas,
    );

    if (!terrainPos) return;

    const walkAction: ContextMenuAction = {
      id: "walk-here",
      label: "Walk here",
      enabled: true,
      priority: 0,
      handler: () => {
        this.handleMoveClick(screenX, screenY, shiftKey);
      },
    };

    const showPathAction: ContextMenuAction = {
      id: "show-path",
      label: "Show path here",
      enabled: true,
      priority: 1,
      handler: () => {
        this.showPathToPosition(terrainPos);
      },
    };

    const cancelAction: ContextMenuAction = {
      id: "cancel",
      label: "Cancel",
      enabled: true,
      priority: 100,
      handler: () => {
        // Just close the menu - no action needed
      },
    };

    this.contextMenu.showMenu(
      null,
      [walkAction, showPathAction, cancelAction],
      screenX,
      screenY,
    );
  }

  /**
   * Show a visual path from the player to the target position.
   * The path is calculated using BFS pathfinding and displayed as a colored line.
   *
   * Path colors indicate pathfinding result:
   * - Green: Complete path found
   * - Orange: Partial path (destination unreachable but got close)
   * - Red: No path found (blocked) - shows direct line to indicate intended target
   */
  private showPathToPosition(targetPos: THREE.Vector3): void {
    const player = this.world.getPlayer?.();
    if (!player) {
      if (DEBUG_INTERACTIONS) {
        console.warn("[ShowPath] Cannot show path: no player found");
      }
      return;
    }

    const scene = this.world.stage?.scene;
    if (!scene) {
      if (DEBUG_INTERACTIONS) {
        console.warn("[ShowPath] Cannot show path: no scene available");
      }
      return;
    }

    // Clear any existing path visualization
    this.clearPathVisualization();

    // Get player and target tiles
    const playerTile = worldToTile(player.position.x, player.position.z);
    const targetTile = worldToTile(targetPos.x, targetPos.z);

    // Get terrain system for height lookups and walkability
    const terrain = this.world.getSystem("terrain") as {
      getHeightAt?: (x: number, z: number) => number | null;
      isPositionWalkable?: (
        x: number,
        z: number,
      ) => { walkable: boolean; reason?: string };
    } | null;

    // Get collision matrix for static obstacles and directional walls
    const collision = this.world.collision as {
      hasFlags?: (x: number, z: number, flags: number) => boolean;
      isBlocked?: (
        fromX: number,
        fromZ: number,
        toX: number,
        toZ: number,
      ) => boolean;
    } | null;

    // Get collision service for building walls
    const collisionService = this.getBuildingCollisionService();

    // Determine player's current floor and building ID for layer separation
    // This must match the server's logic exactly via checkBuildingMovement
    let playerFloor = 0;
    let playerBuildingId: string | null = null;

    if (collisionService) {
      // Check if player's tile is in a building footprint
      playerBuildingId = collisionService.isTileInBuildingFootprint(
        playerTile.x,
        playerTile.z,
      );

      // Get floor from collision query
      const playerCollision = collisionService.queryCollision(
        playerTile.x,
        playerTile.z,
        0,
      );
      if (
        playerCollision.isInsideBuilding &&
        playerCollision.floorIndex !== null
      ) {
        playerFloor = playerCollision.floorIndex;
      }
    }

    // Track what collision systems are available for accurate path representation
    // If systems are missing, paths may be incomplete - log warning in debug mode
    const hasTerrainWalkability = terrain?.isPositionWalkable !== undefined;
    const hasCollisionMatrix = collision?.hasFlags !== undefined;
    const hasBuildingCollision = collisionService !== null;

    if (DEBUG_INTERACTIONS) {
      console.log("[ShowPath] Collision systems available:", {
        terrain: hasTerrainWalkability,
        collision: hasCollisionMatrix,
        buildings: hasBuildingCollision,
        playerFloor,
        playerBuildingId,
      });
    }

    // Create walkability checker that MATCHES the server's isTileWalkable logic EXACTLY
    // Uses BuildingCollisionService.checkBuildingMovement for consistent behavior
    const isWalkable = (tile: TileCoord, fromTile?: TileCoord): boolean => {
      let isTargetInBuilding = false;

      // =========================================================================
      // BUILDING CHECKS: Layer separation, walls, steps, floor walkability
      // Uses checkBuildingMovement - SAME as server's tile-movement.ts
      // =========================================================================
      if (hasBuildingCollision) {
        const buildingCheck = collisionService!.checkBuildingMovement(
          fromTile ?? null,
          tile,
          playerFloor,
          playerBuildingId,
        );

        // BuildingCollisionService handles all building-related blocking
        if (!buildingCheck.buildingAllowsMovement) {
          return false;
        }

        isTargetInBuilding = buildingCheck.targetInBuildingFootprint;
      }

      // =========================================================================
      // COLLISION MATRIX: Non-building directional walls
      // =========================================================================
      if (
        hasCollisionMatrix &&
        fromTile &&
        collision!.isBlocked &&
        collision!.isBlocked(fromTile.x, fromTile.z, tile.x, tile.z)
      ) {
        return false;
      }

      // =========================================================================
      // GROUND LAYER CHECKS (static objects, terrain)
      // =========================================================================

      // Check CollisionMatrix for static objects (rocks, trees, etc. AND furniture/anvils inside buildings)
      // BLOCKS_WALK = BLOCKED | WATER | STEEP_SLOPE — must match server's isTileWalkable
      if (
        hasCollisionMatrix &&
        collision!.hasFlags!(tile.x, tile.z, CollisionMask.BLOCKS_WALK)
      ) {
        return false;
      }

      // If target is inside a building footprint, skip terrain checks
      // (building floor is walkable and overrides terrain features like slopes)
      if (isTargetInBuilding) {
        return true;
      }

      // Check terrain walkability (slope, water, etc.)
      if (hasTerrainWalkability) {
        const result = terrain!.isPositionWalkable!(tile.x + 0.5, tile.z + 0.5);
        if (!result.walkable) return false;
      }

      return true;
    };

    // Find path using BFS
    const path = this.pathfinder.findPath(playerTile, targetTile, isWalkable);

    if (path.length === 0) {
      // No path found - show a red line directly to target to indicate intent
      if (DEBUG_INTERACTIONS) {
        console.log("[ShowPath] No path found, showing blocked indicator");
      }
      this.createPathLine(
        [playerTile, targetTile],
        terrain,
        PATH_VISUALIZATION.COLOR_BLOCKED,
        true, // blocked/unreachable
      );
      return;
    }

    // Check if path is partial (couldn't reach actual destination)
    const isPartial = this.pathfinder.wasLastPathPartial();
    const lineColor = isPartial
      ? PATH_VISUALIZATION.COLOR_PARTIAL
      : PATH_VISUALIZATION.COLOR_COMPLETE;

    if (DEBUG_INTERACTIONS) {
      console.log("[ShowPath] Path found:", {
        length: path.length,
        partial: isPartial,
        from: playerTile,
        to: targetTile,
      });
    }

    // Create the path line visualization
    this.createPathLine(path, terrain, lineColor, false);
  }

  /**
   * Create a Three.js line to visualize the path.
   *
   * @param path - Array of tiles representing the path
   * @param terrain - Terrain system for height lookups (may be null)
   * @param color - Line color (hex)
   * @param isBlocked - If true, path is blocked/unreachable (uses lower opacity)
   */
  private createPathLine(
    path: TileCoord[],
    terrain: {
      getHeightAt?: (x: number, z: number) => number | null;
    } | null,
    color: number,
    isBlocked: boolean,
  ): void {
    const scene = this.world.stage?.scene;
    if (!scene) {
      if (DEBUG_INTERACTIONS) {
        console.warn("[ShowPath] Cannot create path line: no scene");
      }
      return;
    }

    if (path.length < 2) {
      if (DEBUG_INTERACTIONS) {
        console.warn(
          "[ShowPath] Cannot create path line: need at least 2 points, got",
          path.length,
        );
      }
      return;
    }

    // Create points array with world positions
    const points: THREE.Vector3[] = [];

    for (const tile of path) {
      const worldPos = tileToWorld(tile);
      let y = 0;

      // Get terrain height at this position if terrain system is available
      if (terrain?.getHeightAt) {
        const height = terrain.getHeightAt(worldPos.x, worldPos.z);
        if (height !== null && Number.isFinite(height)) {
          y = height;
        }
      }

      points.push(
        new THREE.Vector3(
          worldPos.x,
          y + PATH_VISUALIZATION.HEIGHT_OFFSET,
          worldPos.z,
        ),
      );
    }

    // Create geometry and material
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new LineBasicNodeMaterial();
    material.color = new THREE.Color(color);
    material.linewidth = PATH_VISUALIZATION.LINE_WIDTH;
    material.transparent = true;
    material.opacity = isBlocked
      ? PATH_VISUALIZATION.OPACITY_BLOCKED
      : PATH_VISUALIZATION.OPACITY_NORMAL;
    material.depthTest = true;
    material.depthWrite = false;

    // Create line and add to scene
    this.pathLine = new THREE.Line(geometry, material);
    this.pathLine.name = "PathVisualization";
    this.pathLine.renderOrder = 999;
    scene.add(this.pathLine);

    // Auto-clear after configured duration
    this.pathLineTimeout = setTimeout(() => {
      this.clearPathVisualization();
    }, PATH_VISUALIZATION.AUTO_CLEAR_MS);
  }

  /**
   * Clear the current path visualization
   */
  private clearPathVisualization(): void {
    if (this.pathLineTimeout) {
      clearTimeout(this.pathLineTimeout);
      this.pathLineTimeout = null;
    }

    if (this.pathLine) {
      const scene = this.world.stage?.scene;
      if (scene) {
        scene.remove(this.pathLine);
      }
      this.pathLine.geometry.dispose();
      if (this.pathLine.material instanceof THREE.Material) {
        this.pathLine.material.dispose();
      }
      this.pathLine = null;
    }
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (!this.areControlsEnabled()) return;

    // Skip if event originated from a modal or UI overlay
    if (this.isEventFromModal(event)) return;

    if (event.button === 2) {
      // Right-click - let onContextMenu handle the menu (avoid duplicate raycast)
      // Just track the mouse state here
    } else {
      // Left-click - close menus
      this.contextMenu.closeMenu();
    }

    // Clear hover highlight while mouse is down
    this.highlightService.clearHover();

    this.isDragging = false;
    this.mouseDownButton = event.button;
    this.mouseDownClientPos = { x: event.clientX, y: event.clientY };
  };

  private onMouseUp = (_event: MouseEvent): void => {
    this.isDragging = false;
    this.mouseDownButton = null;
    this.mouseDownClientPos = null;
  };

  private onMouseMove = (event: MouseEvent): void => {
    // Recover from stale drag state: if no buttons are held but we think one is,
    // the mouseup was lost (e.g. released over a UI overlay outside the canvas)
    if (this.mouseDownButton !== null && event.buttons === 0) {
      this.isDragging = false;
      this.mouseDownButton = null;
      this.mouseDownClientPos = null;
    }

    // Drag detection
    if (this.mouseDownButton !== null && this.mouseDownClientPos) {
      const dx = event.clientX - this.mouseDownClientPos.x;
      const dy = event.clientY - this.mouseDownClientPos.y;

      if (
        !this.isDragging &&
        (Math.abs(dx) > INPUT.DRAG_THRESHOLD_PX ||
          Math.abs(dy) > INPUT.DRAG_THRESHOLD_PX)
      ) {
        this.isDragging = true;
      }
    }

    // Hover highlighting (skip while dragging)
    if (!this.isDragging && this.areControlsEnabled()) {
      this.updateHoverHighlight(event.clientX, event.clientY);
    }
  };

  /**
   * Throttled hover highlight update via raycast
   */
  private updateHoverHighlight(screenX: number, screenY: number): void {
    const now = performance.now();
    if (now - this.lastHoverTime < InteractionRouter.HOVER_THROTTLE_MS) return;
    this.lastHoverTime = now;

    if (!this.canvas) return;

    // Check if entity highlighting is disabled in preferences
    const prefs = this.world.prefs as
      | { entityHighlighting?: boolean }
      | undefined;
    if (prefs?.entityHighlighting === false) {
      this.highlightService.clearHover();
      this.canvas.style.cursor = "default";
      return;
    }

    const target = this.raycastService.getEntityAtPosition(
      screenX,
      screenY,
      this.canvas,
    );

    this.highlightService.setHoverTarget(target);

    // Update cursor to indicate interactability
    if (target && target.entityType) {
      this.canvas.style.cursor = "pointer";
    } else {
      this.canvas.style.cursor = "default";
    }
  }

  private onTouchStart = (event: TouchEvent): void => {
    if (!this.areControlsEnabled()) return;
    if (this.isEventFromModal(event)) return;

    const touch = event.touches[0];
    if (!touch) return;

    this.touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    // Long-press timer for context menu
    this.longPressTimer = setTimeout(() => {
      if (this.touchStart && this.canvas) {
        // Capture coordinates before clearing touchStart
        const touchX = this.touchStart.x;
        const touchY = this.touchStart.y;

        const target = this.raycastService.getEntityAtPosition(
          touchX,
          touchY,
          this.canvas,
        );

        if (target) {
          event.preventDefault();
          event.stopPropagation();

          const handler = this.handlers.get(target.entityType);
          if (handler) {
            const actions = handler.getContextMenuActions(target);
            this.contextMenu.showMenu(target, actions, touchX, touchY);
          }
        } else {
          // Terrain long-press - show "Walk here" menu (like right-click on desktop)
          this.showTerrainContextMenu(touchX, touchY, false);
        }
        this.touchStart = null;
      }
    }, TIMING.LONG_PRESS_MS);
  };

  private onTouchEnd = (_event: TouchEvent): void => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (
      this.touchStart &&
      Date.now() - this.touchStart.time < TIMING.LONG_PRESS_MS
    ) {
      this.touchStart = null;
      return;
    }

    this.touchStart = null;
  };

  private onCameraTap = (event: { x: number; y: number }): void => {
    if (!this.canvas || !this.areControlsEnabled()) return;

    // Check if tapping on entity
    const target = this.raycastService.getEntityAtPosition(
      event.x,
      event.y,
      this.canvas,
    );
    if (target) {
      return; // Handled by entity interaction
    }

    // Handle as movement
    this.handleMoveClick(event.x, event.y, false);
  };

  /**
   * Handle entity modification events to detect movement completion
   *
   * When player becomes "idle" (movement finished), check queued actions
   * using the server-authoritative position for accurate range checking.
   *
   * This is the OSRS-style pattern for reliable item pickup:
   * - Server sends final position in changes.p
   * - We use that exact position to check if player reached the item
   * - No reliance on interpolated client position
   */
  private onEntityModified = (data: {
    id: string;
    changes: { e?: string; p?: number[] };
  }): void => {
    // Only care about "idle" state (movement completed)
    if (data.changes.e !== "idle") return;

    // Only care about the local player
    const player = this.world.getPlayer();
    if (!player || player.id !== data.id) return;

    // Extract server-authoritative position from changes.p
    // CRITICAL: This is the accurate position, not the interpolated player.position
    let serverPosition: Position3D;

    // Validate position data to prevent NaN propagation
    const p = data.changes.p;
    if (
      Array.isArray(p) &&
      p.length >= 3 &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1]) &&
      Number.isFinite(p[2])
    ) {
      serverPosition = { x: p[0], y: p[1], z: p[2] };
    } else {
      // Fallback to player position if data is malformed
      if (DEBUG_INTERACTIONS && p !== undefined) {
        console.warn(
          `[InteractionRouter] Invalid position data in ENTITY_MODIFIED:`,
          p,
        );
      }
      serverPosition = player.position;
    }

    // Notify action queue that player is now idle at this position
    this.actionQueue.onPlayerIdle(serverPosition);
  };

  // === Movement ===

  private handleMoveClick(
    screenX: number,
    screenY: number,
    shiftKey: boolean,
  ): void {
    if (!this.canvas || !this.world.camera) return;

    const terrainPos = this.raycastService.getTerrainPosition(
      screenX,
      screenY,
      this.canvas,
    );
    if (!terrainPos) return;

    // Cancel any pending action
    this.actionQueue.cancelCurrentAction();

    // Clamp distance from player
    const player = this.world.getPlayer();
    if (player) {
      const dx = terrainPos.x - player.position.x;
      const dz = terrainPos.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > INPUT.MAX_CLICK_DISTANCE_TILES) {
        const scale = INPUT.MAX_CLICK_DISTANCE_TILES / dist;
        terrainPos.x = player.position.x + dx * scale;
        terrainPos.z = player.position.z + dz * scale;
      }
    }

    // Snap to tile center
    let tile = worldToTile(terrainPos.x, terrainPos.z);
    let snappedPos = tileToWorld(tile);

    // NOTE: Door pathfinding is handled SERVER-SIDE via two-stage navigation.
    // The server detects when the target is inside a building and the player is outside,
    // then automatically routes through the nearest door.
    // Client-side redirection was removed to avoid conflict with server logic.

    // Stair click targeting: if clicking on stairs, redirect to destination tile
    // This makes the player walk ACROSS the stairs (from bottom to top or vice versa)
    if (player) {
      const stairTarget = this.checkStairClickTargeting(tile, player);
      if (stairTarget !== null) {
        // Update the target tile and position to the other end of the stairs
        tile = stairTarget.destinationTile;
        snappedPos = tileToWorld(tile);
        terrainPos.y = stairTarget.elevation;
      }
    }

    // Show movement indicator at the snapped tile center (where player will actually move)
    this.visualFeedback.showClickIndicator(
      { x: snappedPos.x, y: terrainPos.y, z: snappedPos.z },
      "ground",
    );

    // Show target marker (syncs with minimap)
    this.visualFeedback.showTargetMarker({
      x: snappedPos.x,
      y: terrainPos.y,
      z: snappedPos.z,
    });

    // M1 — Optimistic pivot: immediately rotate the character toward the new
    // destination without waiting for the server round-trip. Only updates the
    // target quaternion so the existing path and catch-up state are untouched.
    const localPlayer = this.world.getPlayer();
    if (localPlayer) {
      const networkWithInterpolator = this.world.network as {
        tileInterpolator?: {
          setOptimisticTarget: (
            entityId: string,
            worldPos: { x: number; z: number },
          ) => void;
        };
      } | null;
      networkWithInterpolator?.tileInterpolator?.setOptimisticTarget(
        localPlayer.id,
        snappedPos,
      );
    }

    // Send move request (M2 — pending-move queue ensures last click always wins)
    {
      let runMode = shiftKey;
      const playerEntity = this.world.getPlayer() as {
        runMode?: boolean;
      } | null;
      if (playerEntity && typeof playerEntity.runMode === "boolean") {
        runMode = playerEntity.runMode;
      }

      this._sendMoveRequest({
        target: [snappedPos.x, terrainPos.y, snappedPos.z],
        targetTile: { x: tile.x, z: tile.z },
        runMode,
        cancel: false,
      });
    }
  }

  // === Pending-Move Queue helpers ===

  private _sendMoveRequest(payload: {
    target: [number, number, number];
    targetTile: { x: number; z: number };
    runMode: boolean;
    cancel: boolean;
  }): void {
    const now = Date.now();
    const elapsed = now - this._lastMoveSentAt;
    if (elapsed < InteractionRouter.MOVE_SEND_COOLDOWN_MS) {
      // Within rate-limit window: overwrite any previous pending request and
      // schedule a flush so the most recent destination always reaches the server.
      this._pendingMove = payload;
      if (this._pendingMoveTimer) clearTimeout(this._pendingMoveTimer);
      this._pendingMoveTimer = setTimeout(
        () => this._flushPendingMove(),
        InteractionRouter.MOVE_SEND_COOLDOWN_MS - elapsed,
      );
      return;
    }
    this._doSendMove(payload);
  }

  private _flushPendingMove(): void {
    if (!this._pendingMove) return;
    this._doSendMove(this._pendingMove);
    this._pendingMove = null;
    this._pendingMoveTimer = null;
  }

  private _doSendMove(payload: {
    target: [number, number, number];
    targetTile: { x: number; z: number };
    runMode: boolean;
    cancel: boolean;
  }): void {
    this._lastMoveSentAt = Date.now();
    this.world.network?.send(MESSAGE_TYPES.MOVE_REQUEST, payload);
  }

  /**
   * Get BuildingCollisionService from TownSystem
   */
  private getBuildingCollisionService(): BuildingCollisionService | null {
    const townSystem = this.world.getSystem("towns") as {
      getCollisionService?: () => BuildingCollisionService;
    } | null;
    return townSystem?.getCollisionService?.() ?? null;
  }

  /**
   * Check if door pathfinding is needed and return redirected tile.
   * When player is outside a building and clicks inside, redirect to nearest door.
   *
   * @param targetTile - The tile the player clicked on
   * @param player - The player entity
   * @returns Redirected door tile, or null if no redirect needed
   */
  private checkDoorPathfinding(
    targetTile: { x: number; z: number },
    player: { position: { x: number; z: number } },
  ): { x: number; z: number } | null {
    const collisionService = this.getBuildingCollisionService();
    if (!collisionService) return null;

    // Get player's current tile
    const playerTile = worldToTile(player.position.x, player.position.z);

    // Check if target tile is inside a building
    const targetBuildingId = collisionService.getBuildingAtTile(
      targetTile.x,
      targetTile.z,
    );
    if (!targetBuildingId) return null; // Target not inside a building

    // Check if player is also inside a building
    const playerBuildingId = collisionService.getBuildingAtTile(
      playerTile.x,
      playerTile.z,
    );

    // If player is inside the same building, no redirect needed
    if (playerBuildingId === targetBuildingId) return null;

    // If player is inside a different building, also redirect to door
    // (they need to exit current building and enter target building)
    // For now, just redirect to target building's door

    // Find closest door to player's position
    const closestDoor = collisionService.findClosestDoorTile(
      targetBuildingId,
      playerTile.x,
      playerTile.z,
    );

    if (closestDoor) {
      return { x: closestDoor.tileX, z: closestDoor.tileZ };
    }

    return null;
  }

  /**
   * Check if clicking on stairs and return destination tile + elevation.
   * When clicking on stairs, the movement should target the tile at the OTHER end
   * of the stairs (so player walks across them) with the destination floor's Y position.
   *
   * @param targetTile - The tile the player clicked on
   * @param player - The player entity (to determine current floor)
   * @returns Stair destination info (tile + elevation), or null if not clicking on stairs
   */
  private checkStairClickTargeting(
    targetTile: { x: number; z: number },
    player: { position: { x: number; y: number; z: number } },
  ): {
    destinationTile: { x: number; z: number };
    elevation: number;
  } | null {
    const collisionService = this.getBuildingCollisionService();
    if (!collisionService) return null;

    // Get player's current tile to determine their floor
    const playerTile = worldToTile(player.position.x, player.position.z);

    // Query player's building state to get current floor
    const playerCollision = collisionService.queryCollision(
      playerTile.x,
      playerTile.z,
      0, // Start at ground floor
    );

    // Determine player's current floor from their Y position
    // This is a rough estimate - check multiple floors to find best match
    let currentFloor = 0;
    if (playerCollision.isInsideBuilding && playerCollision.buildingId) {
      const building = collisionService.getBuilding(playerCollision.buildingId);
      if (building) {
        // Find floor closest to player's Y position
        let closestFloor = 0;
        let closestDiff = Infinity;
        for (const floor of building.floors) {
          const diff = Math.abs(player.position.y - floor.elevation);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestFloor = floor.floorIndex;
          }
        }
        currentFloor = closestFloor;
      }
    }

    // Check if target tile is a stair and get destination landing tile
    // This returns the tile at the OTHER end of the stairs so player walks across
    const stairLanding = collisionService.getStairLandingTile(
      targetTile.x,
      targetTile.z,
      currentFloor,
    );

    if (stairLanding) {
      return {
        destinationTile: { x: stairLanding.tileX, z: stairLanding.tileZ },
        elevation: stairLanding.elevation,
      };
    }

    return null;
  }

  // === Utilities ===

  private areControlsEnabled(): boolean {
    const input = this.world.getSystem("client-input") as {
      isEnabled?: () => boolean;
      _controlsEnabled?: boolean;
    } | null;

    if (input) {
      if (typeof input.isEnabled === "function") {
        return input.isEnabled();
      }
      if (typeof input._controlsEnabled === "boolean") {
        return input._controlsEnabled;
      }
    }

    return true;
  }

  /**
   * Check if an event originated from within a modal overlay.
   * This prevents game interactions when clicking on modal UI elements.
   */
  private isEventFromModal(event: MouseEvent | TouchEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;

    // Check if the target is inside a modal (role="dialog" or data-modal attribute)
    const modal = target.closest('[role="dialog"], [data-modal="true"]');
    if (modal) return true;

    // Check if the target has a high z-index overlay (modal backdrop)
    // Modals typically use z-index >= 10000
    let el: HTMLElement | null = target;
    while (el) {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex, 10);
      if (!isNaN(zIndex) && zIndex >= 10000) {
        return true;
      }
      el = el.parentElement;
    }

    return false;
  }

  // === Targeting Mode (OSRS "Use X on Y") ===

  /**
   * Enter targeting mode when player uses an item.
   */
  private onTargetingStart = (payload: unknown): void => {
    const data = payload as {
      sourceItem: { id: string; slot: number; name?: string };
      validTargetTypes: string[];
      validTargetIds: string[];
      actionType: "firemaking" | "cooking" | "smelting" | "none";
    };

    this.targetingMode = {
      active: true,
      sourceItem: data.sourceItem,
      validTargetIds: new Set(data.validTargetIds),
      actionType: data.actionType,
    };

    // Change cursor during targeting mode
    if (this.canvas) {
      this.canvas.style.cursor = "crosshair";
    }
  };

  /**
   * Exit targeting mode after successful action.
   */
  private onTargetingComplete = (): void => {
    this.exitTargetingMode();
  };

  /**
   * Exit targeting mode when cancelled.
   */
  private onTargetingCancel = (): void => {
    this.exitTargetingMode();
  };

  /**
   * Reset targeting mode state.
   */
  private exitTargetingMode(): void {
    this.targetingMode = {
      active: false,
      sourceItem: null,
      validTargetIds: new Set(),
      actionType: "none",
    };

    // Restore default cursor
    if (this.canvas) {
      this.canvas.style.cursor = "";
    }
  }

  /**
   * Check if an entity ID is a valid target in current targeting mode.
   */
  private isValidWorldTarget(entityId: string): boolean {
    if (!this.targetingMode.active) return false;

    // Check if entity ID is in valid targets
    if (this.targetingMode.validTargetIds.has(entityId)) {
      return true;
    }

    // For cooking, check if entity is a fire or range by ID pattern
    if (this.targetingMode.actionType === "cooking") {
      if (entityId.startsWith("fire_") || entityId.includes("range")) {
        return true;
      }
    }

    // For smelting, check if entity is a furnace by ID pattern
    if (this.targetingMode.actionType === "smelting") {
      if (entityId.startsWith("furnace_") || entityId.includes("furnace")) {
        return true;
      }
    }

    return false;
  }
}
