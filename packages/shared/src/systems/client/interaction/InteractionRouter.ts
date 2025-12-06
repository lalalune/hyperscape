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

import { System } from "../..";
import type { World } from "../../../core/World";
import type { InteractableEntityType } from "./types";
import type { Position3D } from "../../../types/core/base-types";
import { INPUT, TIMING } from "./constants";
import { EventType } from "../../../types/events/event-types";
import { worldToTile, tileToWorld } from "../../shared/movement/TileSystem";

// Services
import { ActionQueueService } from "./services/ActionQueueService";
import { RaycastService } from "./services/RaycastService";
import { VisualFeedbackService } from "./services/VisualFeedbackService";
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

export class InteractionRouter extends System {
  private canvas: HTMLCanvasElement | null = null;

  // Services
  private actionQueue: ActionQueueService;
  private raycastService: RaycastService;
  private visualFeedback: VisualFeedbackService;
  private contextMenu: ContextMenuController;

  // Handlers by entity type
  private handlers = new Map<InteractableEntityType, BaseInteractionHandler>();

  // Input state
  private isDragging = false;
  private mouseDownButton: number | null = null;
  private mouseDownClientPos: { x: number; y: number } | null = null;
  private touchStart: { x: number; y: number; time: number } | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(world: World) {
    super(world);

    // Initialize services
    this.actionQueue = new ActionQueueService(world);
    this.raycastService = new RaycastService(world);
    this.visualFeedback = new VisualFeedbackService(world);
    this.contextMenu = new ContextMenuController();

    // Register handlers
    this.registerHandlers();
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
  }

  override start(): void {
    this.canvas = this.world.graphics?.renderer?.domElement ?? null;
    if (!this.canvas) {
      console.warn(`[InteractionRouter] No canvas found, graphics not ready`);
      return;
    }

    // Initialize visual feedback
    this.visualFeedback.initialize();

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
    this.canvas.addEventListener("mouseup", this.onMouseUp, false);
    this.canvas.addEventListener("mousemove", this.onMouseMove, false);
    this.canvas.addEventListener("touchstart", this.onTouchStart, true);
    this.canvas.addEventListener("touchend", this.onTouchEnd, true);

    // Listen for camera tap events on mobile
    this.world.on(EventType.CAMERA_TAP, this.onCameraTap);

    // Listen for entity modification events to detect movement completion
    // This is critical for accurate item pickup (range 0 actions)
    this.world.on(EventType.ENTITY_MODIFIED, this.onEntityModified);
  }

  override update(): void {
    // Update action queue (check if player reached targets)
    this.actionQueue.update();

    // Update visual feedback (animate markers)
    this.visualFeedback.update();
  }

  override destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener("click", this.onCanvasClick);
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
      this.canvas.removeEventListener("mousedown", this.onMouseDown);
      this.canvas.removeEventListener("mouseup", this.onMouseUp);
      this.canvas.removeEventListener("mousemove", this.onMouseMove);
      this.canvas.removeEventListener("touchstart", this.onTouchStart);
      this.canvas.removeEventListener("touchend", this.onTouchEnd);
    }

    this.world.off(EventType.CAMERA_TAP, this.onCameraTap);
    this.world.off(EventType.ENTITY_MODIFIED, this.onEntityModified);

    this.actionQueue.destroy();
    this.visualFeedback.destroy();
    this.contextMenu.destroy();

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    super.destroy();
  }

  // === Input Handlers ===

  private onCanvasClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (!this.canvas || !this.areControlsEnabled()) return;

    // Check for entity at click position
    const target = this.raycastService.getEntityAtPosition(
      event.clientX,
      event.clientY,
      this.canvas,
    );

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

    const target = this.raycastService.getEntityAtPosition(
      event.clientX,
      event.clientY,
      this.canvas,
    );

    if (target) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const handler = this.handlers.get(target.entityType);
      if (handler) {
        const actions = handler.getContextMenuActions(target);
        this.contextMenu.showMenu(
          target,
          actions,
          event.clientX,
          event.clientY,
        );
      }
    }
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (!this.areControlsEnabled()) return;

    if (event.button === 2) {
      // Right-click - handled by onContextMenu
      const target = this.canvas
        ? this.raycastService.getEntityAtPosition(
            event.clientX,
            event.clientY,
            this.canvas,
          )
        : null;

      if (target) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const handler = this.handlers.get(target.entityType);
        if (handler) {
          const actions = handler.getContextMenuActions(target);
          this.contextMenu.showMenu(
            target,
            actions,
            event.clientX,
            event.clientY,
          );
        }
        return;
      }
    } else {
      // Left-click - close menus
      this.contextMenu.closeMenu();
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

  private onMouseMove = (event: MouseEvent): void => {
    if (this.mouseDownButton === null || !this.mouseDownClientPos) return;

    const dx = event.clientX - this.mouseDownClientPos.x;
    const dy = event.clientY - this.mouseDownClientPos.y;

    if (
      !this.isDragging &&
      (Math.abs(dx) > INPUT.DRAG_THRESHOLD_PX ||
        Math.abs(dy) > INPUT.DRAG_THRESHOLD_PX)
    ) {
      this.isDragging = true;
    }
  };

  private onTouchStart = (event: TouchEvent): void => {
    if (!this.areControlsEnabled()) return;

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
        const target = this.raycastService.getEntityAtPosition(
          this.touchStart.x,
          this.touchStart.y,
          this.canvas,
        );

        if (target) {
          event.preventDefault();
          event.stopPropagation();

          const handler = this.handlers.get(target.entityType);
          if (handler) {
            const actions = handler.getContextMenuActions(target);
            this.contextMenu.showMenu(
              target,
              actions,
              this.touchStart.x,
              this.touchStart.y,
            );
          }
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
    const serverPosition: Position3D = data.changes.p
      ? { x: data.changes.p[0], y: data.changes.p[1], z: data.changes.p[2] }
      : player.position;

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

    // Show yellow X click indicator
    this.visualFeedback.showClickIndicator(
      { x: terrainPos.x, y: terrainPos.y, z: terrainPos.z },
      "ground",
    );

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
    const tile = worldToTile(terrainPos.x, terrainPos.z);
    const snappedPos = tileToWorld(tile);

    // Show target marker
    this.visualFeedback.showTargetMarker({
      x: snappedPos.x,
      y: terrainPos.y,
      z: snappedPos.z,
    });

    // Send move request
    if (this.world.network?.send) {
      let runMode = shiftKey;
      const playerEntity = this.world.getPlayer() as {
        runMode?: boolean;
      } | null;
      if (playerEntity && typeof playerEntity.runMode === "boolean") {
        runMode = playerEntity.runMode;
      }

      this.world.network.send("moveRequest", {
        target: [snappedPos.x, terrainPos.y, snappedPos.z],
        targetTile: { x: tile.x, z: tile.z },
        runMode,
        cancel: false,
      });
    }
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
}
