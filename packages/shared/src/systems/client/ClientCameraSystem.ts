/**
 * Core Camera System
 * camera system that supports multiple control modes:
 * - First Person (pointer lock, WASD movement)
 * - Third Person/MMO(right-click drag, click-to-move)
 * - Top-down/RTS (pan, zoom, click-to-move)
 */

import * as THREE from "../../extras/three/three";
import { SystemBase } from "../shared/infrastructure/SystemBase";

import type { CameraTarget, System, World } from "../../types";
import { EventType } from "../../types/events";
import { clamp } from "../../utils";
import { RaycastService } from "./interaction/services/RaycastService";
// CameraTarget interface moved to shared types

// Define TerrainSystem interface for type checking
interface TerrainSystem extends System {
  getHeightAt(x: number, z: number): number;
  getNormalAt(x: number, z: number): { x: number; y: number; z: number };
}

interface StreamingCameraStateUpdate {
  cameraTarget?: string | null;
  cycle?: {
    phase?: "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";
    agent1?: { id?: string | null } | null;
    agent2?: { id?: string | null } | null;
    winnerId?: string | null;
  };
}

const _v3_1 = new THREE.Vector3();
const _v3_2 = new THREE.Vector3();
const _v3_3 = new THREE.Vector3();
const _q_1 = new THREE.Quaternion();
const _sph_1 = new THREE.Spherical();
const _cinematicActorPos = new THREE.Vector3();
const _cinematicOpponentPos = new THREE.Vector3();
const _cinematicFocusPos = new THREE.Vector3();
const _cinematicLookAtPos = new THREE.Vector3();
const _cinematicProbePos = new THREE.Vector3();
const _cinematicProbeTarget = new THREE.Vector3();
const _cinematicProbeDir = new THREE.Vector3();
const _cinematicBestOffset = new THREE.Vector3();
const _cinematicTransitionDir = new THREE.Vector3();
const _cinematicOrientationMatrix = new THREE.Matrix4();
const _cinematicOrientationQuat = new THREE.Quaternion();
const _cinematicOrientationUp = new THREE.Vector3(0, 1, 0);
// Pre-allocated arrays for getCameraInfo to avoid allocations
const _cameraInfoOffset: number[] = [0, 0, 0];
const _cameraInfoPosition: number[] = [0, 0, 0];

export class ClientCameraSystem extends SystemBase {
  private camera: THREE.PerspectiveCamera | null = null;
  private target: CameraTarget | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raycastService: RaycastService | null = null;
  private initRetryCount = 0;
  private static readonly MAX_INIT_RETRIES = 30; // 3 seconds max wait

  // Camera state for different modes
  private spherical = new THREE.Spherical(6, Math.PI * 0.42, Math.PI); // current radius, phi, theta
  private targetSpherical = new THREE.Spherical(6, Math.PI * 0.42, Math.PI); // target spherical for smoothing
  private targetPosition = new THREE.Vector3();
  private smoothedTarget = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(0, 1.3, 0);
  private lookAtTarget = new THREE.Vector3();
  // Collision-aware effective radius
  private effectiveRadius = 6;
  // Zoom handling flags to make zoom move instantly with no easing
  private zoomDirty = false;
  private lastDesiredRadius = this.spherical.radius;

  // Control settings
  private readonly settings = {
    // RS3-like zoom bounds (further min to avoid getting too close)
    minDistance: 2.0,
    maxDistance: 15.0,
    // Pitch limits: allow higher arc for more overhead viewing
    minPolarAngle: Math.PI * 0.15,
    maxPolarAngle: Math.PI * 0.48,
    // RS3-like feel
    rotateSpeed: 0.9,
    zoomSpeed: 1.2,
    panSpeed: 2.0,
    // Separate damping for crisp zoom vs smooth rotation
    rotationDampingFactor: 0.12,
    zoomDampingFactor: 0.22,
    // Damping for radius changes to avoid snap on MMB press
    radiusDampingFactor: 0.18,
    cameraLerpFactor: 0.1,
    invertY: false,
    // Discrete zoom step per wheel notch (world units)
    zoomStep: 0.6,
    // Over-the-shoulder offset: character moves to left when zoomed in (like Fortnite)
    shoulderOffsetMax: 0.15, // Max horizontal offset when fully zoomed in
    shoulderOffsetSide: -1, // -1 = left, 1 = right
  };

  // Cinematic spectator controls for duel streaming
  private streamPageMode = false;
  private cinematicEnabled = false;
  private cinematicClock = Math.random() * 1000;
  private latestStreamingState: StreamingCameraStateUpdate | null = null;
  private lastStreamingStateAt = 0;
  private cinematicLosMask: number | null = null;
  private cinematicCollisionMask: number | null = null;
  private cinematicThetaCache = this.spherical.theta;
  private cinematicThetaCacheValid = false;
  private cinematicPhiCache = this.spherical.phi;
  private cinematicPhiCacheValid = false;
  private cinematicLastLosRefreshAt = 0;
  private cinematicLastBaseTheta = 0;
  private cinematicLastHasOpponent = false;
  private cinematicFacingTheta = this.spherical.theta;
  private cinematicFacingThetaValid = false;
  private cinematicLookSlerpReady = false;
  private cinematicLastActorSample = new THREE.Vector3();
  private cinematicLastOpponentSample = new THREE.Vector3();
  private readonly cinematicTuning = {
    thetaRefreshRate: 1.35,
    thetaIdleDriftRate: 0.6,
    thetaTargetRate: 0.85,
    thetaAppliedRate: 0.8,
    phiTargetRate: 0.65,
    phiAppliedRate: 0.6,
    maxDriftStep: 0.028,
    flipPenaltyStartRad: 1.45,
    focusBaseSpeed: 8.5,
    focusDistanceSpeedGain: 0.75,
    focusMaxSpeed: 180,
    lookBaseSpeed: 9,
    lookDistanceSpeedGain: 0.85,
    lookMaxSpeed: 220,
    lookSlerpRate: 4.8,
  } as const;

  // Mouse state
  private mouseState = {
    rightDown: false,
    middleDown: false,
    leftDown: false,
    lastPosition: new THREE.Vector2(),
    delta: new THREE.Vector2(),
  };
  // Touch state for mobile
  private touchState = {
    active: false,
    touchId: -1,
    startPosition: new THREE.Vector2(),
    lastPosition: new THREE.Vector2(),
  };
  // Two-finger touch state for pinch zoom
  private pinchState = {
    active: false,
    initialDistance: 0,
    lastDistance: 0,
  };
  // Orbit state to prevent press-down snap until actual drag movement
  private orbitingActive = false;
  private orbitingPrimed = false;
  // Track left-click drag to suppress click events when dragging
  private leftDragStarted = false;
  private leftMouseStartPosition = new THREE.Vector2();

  // Bound event handlers for cleanup
  private boundHandlers = {
    mouseDown: this.onMouseDown.bind(this),
    mouseMove: this.onMouseMove.bind(this),
    mouseUp: this.onMouseUp.bind(this),
    mouseWheel: this.onMouseWheel.bind(this),
    mouseLeave: this.onMouseLeave.bind(this),
    contextMenu: this.onContextMenu.bind(this),
    click: this.onClickCapture.bind(this),
    keyDown: this.onKeyDown.bind(this),
    keyUp: this.onKeyUp.bind(this),
    touchStart: this.onTouchStart.bind(this),
    touchMove: this.onTouchMove.bind(this),
    touchEnd: this.onTouchEnd.bind(this),
  };

  constructor(world: World) {
    super(world, {
      name: "client-camera",
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    if (!this.world.isClient) return;

    // Listen for camera events via event bus (typed)
    this.subscribe(
      EventType.CAMERA_SET_TARGET,
      (data: { target?: CameraTarget }) => {
        if (!data?.target) {
          return;
        }
        // Preserve full entity identity (id/characterId/data) so spectator
        // follow checks can verify the camera is locked on the expected target.
        this.onSetTarget({ target: data.target });
      },
    );
    this.subscribe(EventType.CAMERA_RESET, () => this.resetCamera());

    // Listen for player events
    this.subscribe(
      EventType.PLAYER_AVATAR_READY,
      (data: { playerId: string; avatar: unknown; camHeight: number }) =>
        this.onAvatarReady({
          playerId: data.playerId,
          // Handle null avatar (from instanced rendering) or extract base from avatar object
          avatar: data.avatar
            ? ((data.avatar as { base?: THREE.Object3D }).base ??
              ({} as THREE.Object3D))
            : ({} as THREE.Object3D),
          camHeight: data.camHeight,
        }),
    );
    this.subscribe(EventType.PLAYER_REGISTERED, () => {
      if (!this.target) {
        this.initializePlayerTarget();
      }
    });
    this.subscribe(EventType.PLAYER_READY, () => {
      if (!this.target) {
        this.initializePlayerTarget();
      }
    });

    const context = this.resolveCinematicContext();
    this.streamPageMode = context.streamPageMode;
    this.cinematicEnabled =
      context.streamPageMode || context.embeddedSpectatorMode;
    this.subscribe<StreamingCameraStateUpdate>(
      "streaming:state:update",
      (state) => {
        this.latestStreamingState = state;
        this.lastStreamingStateAt = Date.now();
        this.tryRetargetFromStreamingState();
      },
    );

    // Don't detect camera mode here - wait until systems are fully loaded
  }

  start(): void {
    if (!this.world.isClient) return;
    this.tryInitialize();
    this.detachCameraFromRig();
  }

  private detachCameraFromRig(): void {
    if (!this.camera || !this.world.stage?.scene) return;

    // Remove camera from rig if it's attached
    if (this.camera.parent === this.world.rig) {
      // Get world position and rotation before removing from parent
      const worldPos = _v3_1;
      const worldQuat = _q_1;
      this.camera.getWorldPosition(worldPos);
      this.camera.getWorldQuaternion(worldQuat);

      // Remove from rig
      if (this.world.rig) {
        this.world.rig.remove(this.camera);
      }

      // Add directly to scene
      this.world.stage.scene.add(this.camera);

      // Restore world transform
      this.camera.position.copy(worldPos);
      this.camera.quaternion.copy(worldQuat);
    } else if (
      this.camera.parent &&
      this.camera.parent !== this.world.stage.scene
    ) {
      console.warn(
        "[ClientCameraSystem] Camera has unexpected parent:",
        this.camera.parent,
      );
    }
  }

  private tryInitialize(): void {
    this.camera = this.world.camera;
    this.canvas = this.world.graphics?.renderer?.domElement ?? null;

    if (!this.camera || !this.canvas) {
      this.initRetryCount++;
      if (this.initRetryCount < ClientCameraSystem.MAX_INIT_RETRIES) {
        setTimeout(() => this.tryInitialize(), 100);
      } else {
        console.error(
          "[ClientCameraSystem] Failed to initialize: camera or canvas not available after max retries",
        );
      }
      return;
    }

    // Get shared RaycastService from InteractionRouter for cache sharing
    // Both systems benefit from the same 16ms frame-based cache
    const interaction = this.world.getSystem("interaction") as
      | { getRaycastService?: () => RaycastService }
      | undefined;
    const sharedService = interaction?.getRaycastService?.();
    if (sharedService) {
      this.raycastService = sharedService;
    } else if (this.initRetryCount < ClientCameraSystem.MAX_INIT_RETRIES) {
      // InteractionRouter not ready yet (registerSystems is async)
      // Retry initialization in 100ms to get the shared service
      this.initRetryCount++;
      if (this.initRetryCount === 1) {
        // Only log once on first retry
        console.log("[ClientCameraSystem] Waiting for InteractionRouter...");
      }
      setTimeout(() => this.tryInitialize(), 100);
      return;
    } else {
      // Max retries reached - create our own RaycastService as fallback
      console.warn(
        "[ClientCameraSystem] InteractionRouter not available after max retries, creating standalone RaycastService",
      );
      this.raycastService = new RaycastService(this.world);
    }

    // Ensure camera is detached from rig once it's available
    this.detachCameraFromRig();

    // Initialize camera position to avoid starting at origin
    if (this.camera.position.lengthSq() < 0.01) {
      this.camera.position.set(0, 10, 10); // Start above and behind origin
    }

    this.setupEventListeners();

    // Try to follow local player now; update() retries if local player is not ready yet.
    this.initializePlayerTarget();
  }

  private initializePlayerTarget(): void {
    if (this.tryAcquireLocalPlayerTarget()) {
      this.initializeCameraPosition();
    } else {
      this.logger.info("No local player found yet, waiting for spawn");
    }
  }

  private tryAcquireLocalPlayerTarget(): boolean {
    const localPlayer = this.world.getPlayer();
    if (!localPlayer || !localPlayer.id) {
      return false;
    }

    this.logger.info(`Setting player as camera target: ${localPlayer.id}`);
    this.onSetTarget({ target: localPlayer as CameraTarget });
    this.emitTypedEvent(EventType.CAMERA_TARGET_CHANGED, {
      target: localPlayer as CameraTarget,
    });
    return true;
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Use capture phase for mouse events so camera runs before other interaction systems
    this.canvas.addEventListener(
      "mousedown",
      this.boundHandlers.mouseDown as EventListener,
      true,
    );
    this.canvas.addEventListener(
      "mousemove",
      this.boundHandlers.mouseMove as EventListener,
      true,
    );
    this.canvas.addEventListener(
      "mouseup",
      this.boundHandlers.mouseUp as EventListener,
      true,
    );
    this.canvas.addEventListener(
      "wheel",
      this.boundHandlers.mouseWheel as EventListener,
      true,
    );
    this.canvas.addEventListener(
      "mouseleave",
      this.boundHandlers.mouseLeave as EventListener,
      true,
    );

    // Listen to contextmenu to mark when we're handling camera rotation
    // Use capture phase to run before InteractionSystem
    this.canvas.addEventListener(
      "contextmenu",
      this.boundHandlers.contextMenu as EventListener,
      true,
    );
    // Capture click events to suppress them when we've been dragging
    this.canvas.addEventListener(
      "click",
      this.boundHandlers.click as EventListener,
      true,
    );

    document.addEventListener(
      "keydown",
      this.boundHandlers.keyDown as EventListener,
    );
    document.addEventListener(
      "keyup",
      this.boundHandlers.keyUp as EventListener,
    );

    // Touch events for mobile camera control
    this.canvas.addEventListener(
      "touchstart",
      this.boundHandlers.touchStart as EventListener,
      { passive: false },
    );
    this.canvas.addEventListener(
      "touchmove",
      this.boundHandlers.touchMove as EventListener,
      { passive: false },
    );
    this.canvas.addEventListener(
      "touchend",
      this.boundHandlers.touchEnd as EventListener,
    );
    this.canvas.addEventListener(
      "touchcancel",
      this.boundHandlers.touchEnd as EventListener,
    );
  }

  private onMouseDown(event: MouseEvent): void {
    // Handle camera controls in capture phase before other systems

    if (event.button === 2) {
      // Right mouse button - context menu (optional, could disable)
      event.preventDefault(); // Prevent context menu
      event.stopPropagation(); // Stop event from reaching other systems
      this.mouseState.rightDown = true;
    } else if (event.button === 1) {
      // Middle mouse button for camera rotation
      event.preventDefault();
      event.stopPropagation(); // Stop event from reaching other systems
      this.mouseState.middleDown = true;

      // Align targets to current spherical to avoid any initial jump
      this.targetSpherical.theta = this.spherical.theta;
      this.targetSpherical.phi = this.spherical.phi;
      // Prime orbiting; activate only after passing small drag threshold
      this.orbitingPrimed = true;
      this.orbitingActive = false;

      this.canvas!.style.cursor = "grabbing";
    } else if (event.button === 0) {
      // Left mouse button - can rotate camera if dragged, or click-to-move if not
      this.mouseState.leftDown = true;
      this.leftDragStarted = false;
      this.leftMouseStartPosition.set(event.clientX, event.clientY);

      // Align targets to current spherical to avoid any initial jump (same as middle mouse)
      this.targetSpherical.theta = this.spherical.theta;
      this.targetSpherical.phi = this.spherical.phi;
      // Prime orbiting; activate only after passing small drag threshold
      this.orbitingPrimed = true;
      // Don't prevent default yet - let click propagate if no drag occurs
    }

    this.mouseState.lastPosition.set(event.clientX, event.clientY);
  }

  private onMouseMove(event: MouseEvent): void {
    // Handle middle mouse button OR left mouse button drag for camera rotation
    if (this.mouseState.middleDown || this.mouseState.leftDown) {
      this.mouseState.delta.set(
        event.clientX - this.mouseState.lastPosition.x,
        event.clientY - this.mouseState.lastPosition.y,
      );

      // For left mouse, check if we've exceeded drag threshold from start position
      if (this.mouseState.leftDown && !this.leftDragStarted) {
        const totalDrag = Math.hypot(
          event.clientX - this.leftMouseStartPosition.x,
          event.clientY - this.leftMouseStartPosition.y,
        );
        if (totalDrag > 5) {
          // 5px threshold before we consider it a drag
          this.leftDragStarted = true;
          this.orbitingActive = true;
          this.orbitingPrimed = false;
          this.canvas!.style.cursor = "grabbing";
        }
      }

      // For middle mouse, activate orbiting after small movement threshold
      if (this.mouseState.middleDown && !this.orbitingActive) {
        const drag =
          Math.abs(this.mouseState.delta.x) + Math.abs(this.mouseState.delta.y);
        if (drag > 3) {
          this.orbitingActive = true;
          this.orbitingPrimed = false;
          this.canvas!.style.cursor = "grabbing";
        }
      }

      // Only rotate camera if we've actually started dragging
      if (this.orbitingActive) {
        event.preventDefault();
        event.stopPropagation();

        const invert = this.settings.invertY === true ? -1 : 1;
        // RS3-like: keep rotation responsive when fully zoomed out
        const minR = this.settings.minDistance;
        const maxR = this.settings.maxDistance;
        const r = THREE.MathUtils.clamp(this.spherical.radius, minR, maxR);
        const t = (r - minR) / (maxR - minR); // 0 at min zoom, 1 at max zoom
        const speedScale = THREE.MathUtils.lerp(1.0, 1.3, t); // slightly faster when zoomed out
        const inputScale = this.settings.rotateSpeed * 0.01 * speedScale;
        this.targetSpherical.theta -= this.mouseState.delta.x * inputScale;
        this.targetSpherical.phi -=
          invert * this.mouseState.delta.y * inputScale;
        this.targetSpherical.phi = clamp(
          this.targetSpherical.phi,
          this.settings.minPolarAngle,
          this.settings.maxPolarAngle,
        );
      }

      this.mouseState.lastPosition.set(event.clientX, event.clientY);
      return;
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2) {
      // Right mouse button
      event.preventDefault();
      event.stopPropagation();
      this.mouseState.rightDown = false;
    }

    if (event.button === 1) {
      // Middle mouse button
      event.preventDefault();
      event.stopPropagation();
      this.mouseState.middleDown = false;
      this.orbitingActive = false;
      this.orbitingPrimed = false;
      this.canvas!.style.cursor = "default";
    }

    if (event.button === 0) {
      // Left mouse button
      this.mouseState.leftDown = false;
      // If we were dragging (orbiting), reset state and prevent click
      if (this.leftDragStarted) {
        event.preventDefault();
        event.stopPropagation();
        this.orbitingActive = false;
        this.orbitingPrimed = false;
        this.canvas!.style.cursor = "default";
        // leftDragStarted stays true briefly so onClickCapture can suppress the click
      } else {
        // No drag occurred - reset orbiting state that was primed
        this.orbitingPrimed = false;
      }
    }
  }

  private onMouseWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();

    // Check if this is a pinch gesture (trackpad two-finger pinch)
    if (event.ctrlKey) {
      // Trackpad pinch: deltaY is proportional to pinch amount
      // Negative = pinch in (zoom out), Positive = spread out (zoom in)
      const pinchSensitivity = 0.05;
      this.targetSpherical.radius -= event.deltaY * pinchSensitivity;
    } else {
      // Regular scroll wheel or trackpad scroll
      const sign = Math.sign(event.deltaY);
      if (sign !== 0) {
        // Discrete notches with modest scaling for trackpads/high-res wheels
        const steps = Math.max(
          1,
          Math.min(5, Math.round(Math.abs(event.deltaY) / 100)),
        );
        this.targetSpherical.radius += sign * steps * this.settings.zoomStep;
      }
    }

    this.targetSpherical.radius = clamp(
      this.targetSpherical.radius,
      this.settings.minDistance,
      this.settings.maxDistance,
    );
    // RS-style: snap zoom immediately (no swooping)
    this.spherical.radius = this.targetSpherical.radius;
    this.effectiveRadius = this.targetSpherical.radius;
    this.zoomDirty = true;
    this.lastDesiredRadius = this.spherical.radius;
  }

  private onMouseLeave(_event: MouseEvent): void {
    this.mouseState.rightDown = false;
    this.mouseState.middleDown = false;
    this.mouseState.leftDown = false;
    this.orbitingActive = false;
    this.orbitingPrimed = false;
    this.leftDragStarted = false;
    if (this.canvas) {
      this.canvas.style.cursor = "default";
    }
  }

  private onContextMenu(event: MouseEvent): void {
    // Check if clicking on an entity - if so, let InteractionSystem handle it
    // Use shared RaycastService for zero-allocation entity detection
    if (this.raycastService && this.canvas) {
      const hasEntity = this.raycastService.hasEntityAtPosition(
        event.clientX,
        event.clientY,
        this.canvas,
      );

      if (hasEntity) {
        // Clicking on entity - let InteractionSystem handle it
        return;
      }
    }

    // Not clicking on entity - prevent default context menu
    event.preventDefault();
    event.stopPropagation();
  }

  private onClickCapture(event: MouseEvent): void {
    // Suppress click events if we were dragging to rotate camera
    if (this.leftDragStarted) {
      event.preventDefault();
      event.stopPropagation();
      // Reset the flag after suppressing
      this.leftDragStarted = false;
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    // RS-style camera control via arrow keys: rotate around character only
    const rotateStep = 0.06;
    if (event.code === "ArrowLeft") {
      event.preventDefault();
      // ArrowLeft should rotate view left: decrease theta
      this.targetSpherical.theta -= rotateStep;
      return;
    }
    if (event.code === "ArrowRight") {
      event.preventDefault();
      // ArrowRight should rotate view right: increase theta
      this.targetSpherical.theta += rotateStep;
      return;
    }
    if (event.code === "ArrowUp") {
      event.preventDefault();
      this.targetSpherical.phi = clamp(
        this.targetSpherical.phi - rotateStep,
        this.settings.minPolarAngle,
        this.settings.maxPolarAngle,
      );
      return;
    }
    if (event.code === "ArrowDown") {
      event.preventDefault();
      this.targetSpherical.phi = clamp(
        this.targetSpherical.phi + rotateStep,
        this.settings.minPolarAngle,
        this.settings.maxPolarAngle,
      );
      return;
    }

    if (event.code === "Home" || event.code === "NumpadHome") {
      this.resetCamera();
      event.preventDefault();
    }
  }

  private onKeyUp(_event: KeyboardEvent): void {
    // Reserved for future keyboard camera controls
  }

  private onTouchStart(event: TouchEvent): void {
    // Ignore touches that start on UI elements (so UI remains interactive on mobile)
    const first = event.touches[0];
    if (first) {
      const topEl = document.elementFromPoint(first.clientX, first.clientY);
      if (topEl && this.canvas && topEl !== this.canvas) {
        return;
      }
    }
    // Handle two-finger pinch zoom
    if (event.touches.length === 2) {
      event.preventDefault();
      event.stopPropagation();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY,
      );

      this.pinchState.active = true;
      this.pinchState.initialDistance = distance;
      this.pinchState.lastDistance = distance;

      // Deactivate single-touch rotation when pinching
      this.touchState.active = false;
      this.orbitingActive = false;
      this.orbitingPrimed = false;
      return;
    }

    // Only handle single-finger touch for camera rotation or tap-to-move
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    this.touchState.active = true;
    this.touchState.touchId = touch.identifier;
    this.touchState.startPosition.set(touch.clientX, touch.clientY);
    this.touchState.lastPosition.set(touch.clientX, touch.clientY);

    // Align targets to current spherical to avoid any initial jump
    this.targetSpherical.theta = this.spherical.theta;
    this.targetSpherical.phi = this.spherical.phi;
    this.orbitingPrimed = true;
    this.orbitingActive = false;

    // Don't prevent default yet - let taps go through
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.touchState.active && event.touches.length === 1) {
      let touch: Touch | null = null;
      for (let i = 0; i < event.touches.length; i++) {
        if (event.touches[i].identifier === this.touchState.touchId) {
          touch = event.touches[i];
          break;
        }
      }
      if (!touch) return;

      const totalDragDistance = Math.hypot(
        touch.clientX - this.touchState.startPosition.x,
        touch.clientY - this.touchState.startPosition.y,
      );
      if (!this.orbitingActive && totalDragDistance > 10) {
        this.orbitingActive = true;
        this.orbitingPrimed = false;
      }

      if (this.orbitingActive) {
        event.preventDefault();
        const deltaX = touch.clientX - this.touchState.lastPosition.x;
        const deltaY = touch.clientY - this.touchState.lastPosition.y;
        const invert = this.settings.invertY ? -1 : 1;
        const inputScale = this.settings.rotateSpeed * 0.008;
        this.targetSpherical.theta -= deltaX * inputScale;
        this.targetSpherical.phi -= invert * deltaY * inputScale;
        this.targetSpherical.phi = clamp(
          this.targetSpherical.phi,
          this.settings.minPolarAngle,
          this.settings.maxPolarAngle,
        );
      }
      this.touchState.lastPosition.set(touch.clientX, touch.clientY);
    } else if (this.pinchState.active && event.touches.length === 2) {
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY,
      );
      const distanceDelta = this.pinchState.lastDistance - distance;
      const pinchSensitivity = 0.01;
      this.targetSpherical.radius += distanceDelta * pinchSensitivity;
      this.targetSpherical.radius = clamp(
        this.targetSpherical.radius,
        this.settings.minDistance,
        this.settings.maxDistance,
      );
      this.spherical.radius = this.targetSpherical.radius;
      this.effectiveRadius = this.targetSpherical.radius;
      this.zoomDirty = true;
      this.lastDesiredRadius = this.spherical.radius;
      this.pinchState.lastDistance = distance;
    }
  }

  private onTouchEnd(event: TouchEvent): void {
    if (this.touchState.active && !this.orbitingActive) {
      this.world.emit(EventType.CAMERA_TAP, {
        x: this.touchState.startPosition.x,
        y: this.touchState.startPosition.y,
      });
    }

    if (this.pinchState.active && event.touches.length < 2) {
      this.pinchState.active = false;
    }

    let touchFound = false;
    for (let i = 0; i < event.touches.length; i++) {
      if (event.touches[i].identifier === this.touchState.touchId) {
        touchFound = true;
        break;
      }
    }

    if (!touchFound) {
      this.touchState.active = false;
      this.touchState.touchId = -1;
      this.orbitingActive = false;
      this.orbitingPrimed = false;
    }
  }

  private panCamera(deltaX: number, deltaY: number): void {
    if (!this.camera || !this.target) return;

    // Simple pan: move the camera offset in world space based on current camera orientation
    const cameraRight = _v3_1;
    const cameraForward = _v3_2;

    // Get camera right vector
    cameraRight.setFromMatrixColumn(this.camera.matrix, 0).normalize();

    // Get camera forward vector projected on XZ plane
    this.camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();

    const panSpeed = this.settings.panSpeed * 0.01;

    // Apply pan to camera offset
    this.cameraOffset.x -=
      deltaX * panSpeed * cameraRight.x + deltaY * panSpeed * cameraForward.x;
    this.cameraOffset.z -=
      deltaX * panSpeed * cameraRight.z + deltaY * panSpeed * cameraForward.z;
  }

  private resetCamera(): void {
    if (!this.target) return;

    this.targetSpherical.radius = 8;
    this.targetSpherical.theta = Math.PI;
    this.targetSpherical.phi = Math.PI * 0.42;
    this.spherical.radius = this.targetSpherical.radius;
    this.spherical.theta = this.targetSpherical.theta;
    this.spherical.phi = this.targetSpherical.phi;
    // Over-the-shoulder height - lower for better view
    this.cameraOffset.set(0, 1.3, 0);
    this.resetCinematicSamplingState();
  }

  private onSetTarget(event: { target: CameraTarget }): void {
    const previousTarget = this.target;
    this.target = event.target;
    this.resetCinematicSamplingState();
    if (this.getTargetWorldPosition(_v3_1)) {
      this.logger.info("Target set", {
        x: _v3_1.x,
        y: _v3_1.y,
        z: _v3_1.z,
      });
    }

    if (this.target) {
      if (!this.isCinematicCameraActive() || !previousTarget) {
        this.initializeCameraPosition();
      }
    }
  }

  private onAvatarReady(event: {
    playerId: string;
    avatar: THREE.Object3D;
    camHeight: number;
  }): void {
    // Use avatar height directly without extra offset since player is at terrain level
    this.cameraOffset.y = event.camHeight || 1.6;

    const localPlayer = this.world.getPlayer();

    // Normal player mode: set target to local player
    if (localPlayer && localPlayer.id === event.playerId && !this.target) {
      this.onSetTarget({ target: localPlayer as CameraTarget });
      return;
    }

    // SPECTATOR MODE FIX: If no local player, check if this is a remote player we should follow
    // This happens in spectator mode where we're watching an agent
    if (!localPlayer && !this.target) {
      // Try to find the player entity (could be in items or players map)
      const remotePlayer =
        this.world.entities.items.get(event.playerId) ||
        this.world.entities.players.get(event.playerId);
      if (remotePlayer) {
        this.onSetTarget({ target: remotePlayer as CameraTarget });
      }
    } else if (!localPlayer && this.target) {
      // SPECTATOR FIX: Camera already has target, but avatar just loaded - reinitialize camera position
      // with the correct camHeight now that we know the avatar's actual height
      const targetId = this.target.data?.id;
      if (targetId === event.playerId) {
        this.initializeCameraPosition();
      }
    }
  }

  private initializeCameraPosition(): void {
    if (!this.target || !this.camera) return;

    if (!this.getTargetWorldPosition(_v3_1)) return;

    // Ensure camera is independent before positioning
    this.detachCameraFromRig();

    // Set up orbit center in world space
    const orbitCenter = _v3_1.set(
      _v3_1.x,
      _v3_1.y + this.cameraOffset.y,
      _v3_1.z,
    );
    this.targetPosition.copy(orbitCenter);
    this.smoothedTarget.copy(orbitCenter);
    this.lookAtTarget.copy(orbitCenter);
    this.cinematicLookSlerpReady = false;

    this.cameraPosition.setFromSpherical(this.spherical);
    this.cameraPosition.add(orbitCenter);

    // Set camera world position directly (no parent transforms)
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(orbitCenter);

    // Force update matrices since camera has no parent
    this.camera.updateMatrixWorld(true);
  }

  private resolveCinematicContext(): {
    streamPageMode: boolean;
    embeddedSpectatorMode: boolean;
  } {
    if (typeof window === "undefined") {
      return { streamPageMode: false, embeddedSpectatorMode: false };
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const streamPageMode = params.get("page") === "stream";
      const embeddedFlag = (params.get("embedded") ?? "").toLowerCase();
      const mode = (params.get("mode") ?? "").toLowerCase();
      const embeddedFromQuery =
        (embeddedFlag === "1" ||
          embeddedFlag === "true" ||
          embeddedFlag === "yes") &&
        mode === "spectator";

      const win = window as Window & {
        __HYPERSCAPE_EMBEDDED__?: boolean;
        __HYPERSCAPE_CONFIG__?: { mode?: string };
      };
      const embeddedFromConfig =
        win.__HYPERSCAPE_EMBEDDED__ === true &&
        win.__HYPERSCAPE_CONFIG__?.mode === "spectator";

      return {
        streamPageMode,
        embeddedSpectatorMode: embeddedFromQuery || embeddedFromConfig,
      };
    } catch {
      return { streamPageMode: false, embeddedSpectatorMode: false };
    }
  }

  private isCinematicCameraActive(): boolean {
    if (!this.cinematicEnabled || !this.target) {
      return false;
    }

    if (
      this.mouseState.middleDown ||
      (this.mouseState.leftDown && this.leftDragStarted) ||
      this.touchState.active
    ) {
      return false;
    }

    if (this.streamPageMode) {
      return true;
    }

    const hasFreshStreamingSignal =
      Date.now() - this.lastStreamingStateAt <= 20_000;
    return hasFreshStreamingSignal;
  }

  private resolveStreamingCameraTargetId(
    state: StreamingCameraStateUpdate | null,
  ): string | null {
    if (!state) {
      return null;
    }

    if (
      typeof state.cameraTarget === "string" &&
      state.cameraTarget.trim().length > 0
    ) {
      return state.cameraTarget;
    }

    const cycle = state.cycle;
    if (!cycle) {
      return null;
    }

    const phase = cycle.phase ?? "IDLE";
    const agent1Id = cycle.agent1?.id ?? null;
    const agent2Id = cycle.agent2?.id ?? null;
    const winnerId = cycle.winnerId ?? null;

    if (phase === "RESOLUTION" && winnerId) {
      return winnerId;
    }

    return agent1Id || agent2Id || winnerId;
  }

  private tryRetargetFromStreamingState(force = false): boolean {
    if (!this.cinematicEnabled) {
      return false;
    }

    const targetId = this.resolveStreamingCameraTargetId(
      this.latestStreamingState,
    );
    if (!targetId) {
      return false;
    }

    const currentTargetId = this.target
      ? (this.resolveEntityId(this.resolveTargetEntity(this.target)) ??
        this.resolveEntityId(this.target))
      : null;
    if (!force && currentTargetId === targetId) {
      return true;
    }

    const entity = this.resolveEntityById(targetId);
    if (!entity) {
      return false;
    }

    return this.setCinematicTarget(entity);
  }

  private isLikelyAgentEntity(entity: unknown): boolean {
    if (!entity || typeof entity !== "object") {
      return false;
    }

    const typed = entity as {
      id?: string;
      type?: string;
      data?: { id?: string; isAgent?: boolean | number };
    };
    const candidateId =
      typed.id ?? typed.data?.id ?? this.resolveEntityId(entity);
    if (typeof candidateId === "string" && candidateId.startsWith("agent-")) {
      return true;
    }
    if (typed.type === "player") {
      return true;
    }
    return typed.data?.isAgent === true || typed.data?.isAgent === 1;
  }

  private isValidSpectatorFallbackEntity(entity: unknown): boolean {
    if (!this.isLikelyAgentEntity(entity)) {
      return false;
    }
    return this.copyEntityPosition(entity, _v3_1);
  }

  private setCinematicTarget(entity: unknown): boolean {
    if (!this.isValidSpectatorFallbackEntity(entity)) {
      return false;
    }

    const target = entity as CameraTarget;
    this.onSetTarget({ target });
    this.emitTypedEvent(EventType.CAMERA_TARGET_CHANGED, { target });
    return true;
  }

  private tryAcquireSpectatorFallbackTarget(): boolean {
    if (!this.cinematicEnabled) {
      return false;
    }

    const cycle = this.latestStreamingState?.cycle;
    const resolvedStreamTargetId = this.resolveStreamingCameraTargetId(
      this.latestStreamingState,
    );
    const preferredIds = [
      resolvedStreamTargetId,
      this.latestStreamingState?.cameraTarget ?? null,
      cycle?.winnerId ?? null,
      cycle?.agent1?.id ?? null,
      cycle?.agent2?.id ?? null,
    ];
    for (const preferredId of preferredIds) {
      if (!preferredId) {
        continue;
      }
      const preferredEntity = this.resolveEntityById(preferredId);
      if (preferredEntity && this.setCinematicTarget(preferredEntity)) {
        return true;
      }
    }

    const entities = this.world.entities as {
      players?: Map<string, unknown>;
      items?: Map<string, unknown>;
      getAllEntities?: () => Map<string, unknown>;
    };

    if (entities.players) {
      for (const [, entity] of entities.players) {
        if (!entity) {
          continue;
        }
        if (this.setCinematicTarget(entity)) {
          return true;
        }
      }
    }

    if (entities.items) {
      for (const [, entity] of entities.items) {
        if (!entity) {
          continue;
        }
        if (this.setCinematicTarget(entity)) {
          return true;
        }
      }
    }

    if (entities.getAllEntities) {
      for (const [, entity] of entities.getAllEntities()) {
        if (this.setCinematicTarget(entity)) {
          return true;
        }
      }
    }

    return false;
  }

  private getTargetWorldPosition(out: THREE.Vector3): boolean {
    if (!this.target) {
      return false;
    }

    const resolvedTarget = this.resolveTargetEntity(this.target);
    if (this.copyEntityPosition(resolvedTarget, out)) {
      return true;
    }

    return this.copyEntityPosition(this.target, out);
  }

  private resolveEntityById(entityId: string): unknown | null {
    const direct = this.world.entities.get(entityId);
    if (direct) return direct;

    const entities = this.world.entities as {
      items?: Map<string, unknown>;
      players?: Map<string, unknown>;
      getAllEntities?: () => Map<string, unknown>;
    };

    const fromItems = entities.items?.get(entityId);
    if (fromItems) return fromItems;

    const fromPlayers = entities.players?.get(entityId);
    if (fromPlayers) return fromPlayers;

    if (entities.getAllEntities) {
      for (const [id, entity] of entities.getAllEntities()) {
        if (id === entityId || this.resolveEntityId(entity) === entityId) {
          return entity;
        }
      }
    }

    return null;
  }

  private resolveEntityId(entity: unknown): string | null {
    if (!entity || typeof entity !== "object") {
      return null;
    }

    const data = entity as {
      id?: string;
      characterId?: string;
      data?: { id?: string; characterId?: string };
    };

    if (typeof data.id === "string" && data.id.length > 0) {
      return data.id;
    }
    if (typeof data.characterId === "string" && data.characterId.length > 0) {
      return data.characterId;
    }
    if (typeof data.data?.id === "string" && data.data.id.length > 0) {
      return data.data.id;
    }
    if (
      typeof data.data?.characterId === "string" &&
      data.data.characterId.length > 0
    ) {
      return data.data.characterId;
    }

    return null;
  }

  private resolveTargetEntity(target: CameraTarget): unknown {
    const directTarget = target as CameraTarget & {
      entity?: unknown;
      id?: string;
      characterId?: string;
    };
    if (directTarget.entity) {
      return directTarget.entity;
    }

    const targetId =
      directTarget.data?.id ||
      directTarget.id ||
      directTarget.characterId ||
      null;
    if (targetId) {
      const entity = this.resolveEntityById(targetId);
      if (entity) {
        return entity;
      }
    }

    return target;
  }

  private copyEntityPosition(entity: unknown, out: THREE.Vector3): boolean {
    if (!entity || typeof entity !== "object") {
      return false;
    }

    const source = entity as {
      position?: unknown;
      base?: {
        position?: unknown;
        getWorldPosition?: (target: THREE.Vector3) => THREE.Vector3;
      };
      node?: {
        position?: unknown;
        getWorldPosition?: (target: THREE.Vector3) => THREE.Vector3;
      };
      data?: { position?: unknown };
      getWorldPosition?: (target: THREE.Vector3) => THREE.Vector3;
    };

    if (typeof source.getWorldPosition === "function") {
      source.getWorldPosition(out);
      return true;
    }

    const rawPosition =
      source.position ?? source.node?.position ?? source.base?.position;

    if (Array.isArray(rawPosition) && rawPosition.length >= 3) {
      const x = Number(rawPosition[0]);
      const y = Number(rawPosition[1]);
      const z = Number(rawPosition[2]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        out.set(x, y, z);
        return true;
      }
      return false;
    }

    if (rawPosition && typeof rawPosition === "object") {
      const vector = rawPosition as { x?: number; y?: number; z?: number };
      if (
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z)
      ) {
        out.set(vector.x as number, vector.y as number, vector.z as number);
        return true;
      }
    }

    if (typeof source.node?.getWorldPosition === "function") {
      source.node.getWorldPosition(out);
      return true;
    }

    if (typeof source.base?.getWorldPosition === "function") {
      source.base.getWorldPosition(out);
      return true;
    }

    const dataPosition = source.data?.position;
    if (Array.isArray(dataPosition) && dataPosition.length >= 3) {
      const x = Number(dataPosition[0]);
      const y = Number(dataPosition[1]);
      const z = Number(dataPosition[2]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        out.set(x, y, z);
        return true;
      }
      return false;
    }

    if (dataPosition && typeof dataPosition === "object") {
      const vector = dataPosition as { x?: number; y?: number; z?: number };
      if (
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z)
      ) {
        out.set(vector.x as number, vector.y as number, vector.z as number);
        return true;
      }
    }

    return false;
  }

  private resolveOpponentEntity(
    actorEntity: unknown,
    actorId: string | null,
  ): unknown | null {
    const actorData = actorEntity as {
      data?: {
        combatTarget?: string | null;
        ct?: string | null;
        attackTarget?: string | null;
      };
    };

    let opponentId =
      actorData.data?.combatTarget ||
      actorData.data?.ct ||
      actorData.data?.attackTarget ||
      null;

    if (!opponentId && actorId && this.latestStreamingState?.cycle) {
      const cycle = this.latestStreamingState.cycle;
      const agent1Id = cycle.agent1?.id ?? null;
      const agent2Id = cycle.agent2?.id ?? null;
      if (actorId === agent1Id && agent2Id) {
        opponentId = agent2Id;
      } else if (actorId === agent2Id && agent1Id) {
        opponentId = agent1Id;
      }
    }

    if (!opponentId) {
      return null;
    }

    const opponentEntity = this.resolveEntityById(opponentId);
    if (!opponentEntity || opponentEntity === actorEntity) {
      return null;
    }

    return opponentEntity;
  }

  private resetCinematicSamplingState(): void {
    this.cinematicThetaCache = this.spherical.theta;
    this.cinematicThetaCacheValid = false;
    this.cinematicPhiCache = this.spherical.phi;
    this.cinematicPhiCacheValid = false;
    this.cinematicLastLosRefreshAt = 0;
    this.cinematicLastBaseTheta = this.spherical.theta;
    this.cinematicLastHasOpponent = false;
    this.cinematicFacingTheta = this.spherical.theta;
    this.cinematicFacingThetaValid = false;
  }

  private moveAngleToward(
    current: number,
    target: number,
    maxSpeedRadPerSec: number,
    deltaSeconds: number,
  ): number {
    const delta = this.shortestAngleDelta(current, target);
    const maxStep = Math.max(0, maxSpeedRadPerSec * deltaSeconds);
    return current + clamp(delta, -maxStep, maxStep);
  }

  private getDampingAlpha(ratePerSecond: number, deltaSeconds: number): number {
    const dt = Math.max(0, deltaSeconds);
    if (ratePerSecond <= 0 || dt <= 0) {
      return 0;
    }
    return clamp(1 - Math.exp(-ratePerSecond * dt), 0, 1);
  }

  private getCinematicLosMask(): number {
    if (this.cinematicLosMask !== null) {
      return this.cinematicLosMask;
    }

    const mask = this.world.createLayerMask(
      "environment",
      "prop",
      "building",
      "obstacle",
      "player",
    );
    this.cinematicLosMask = mask || this.world.createLayerMask("environment");
    return this.cinematicLosMask;
  }

  private getCollisionProbeMask(): number {
    if (this.cinematicCollisionMask !== null) {
      return this.cinematicCollisionMask;
    }

    const mask = this.world.createLayerMask(
      "environment",
      "prop",
      "building",
      "obstacle",
    );
    this.cinematicCollisionMask =
      mask || this.world.createLayerMask("environment");
    return this.cinematicCollisionMask;
  }

  private hasLineOfSight(
    source: THREE.Vector3,
    target: THREE.Vector3,
    occlusionMargin = 0.55,
  ): boolean {
    const direction = _cinematicProbeDir.copy(target).sub(source);
    const distance = direction.length();
    if (distance <= 0.001) {
      return true;
    }

    direction.multiplyScalar(1 / distance);
    const hit = this.world.raycast(
      source,
      direction,
      distance,
      this.getCinematicLosMask(),
    );
    if (!hit) {
      return true;
    }

    return hit.distance >= distance - occlusionMargin;
  }

  private shouldRefreshCinematicView(
    now: number,
    baseTheta: number,
    actorPosition: THREE.Vector3,
    opponentPosition: THREE.Vector3 | null,
  ): boolean {
    if (!this.cinematicThetaCacheValid || !this.cinematicPhiCacheValid) {
      return true;
    }

    if (now - this.cinematicLastLosRefreshAt >= 500) {
      return true;
    }

    if (
      Math.abs(
        this.shortestAngleDelta(this.cinematicLastBaseTheta, baseTheta),
      ) > 0.35
    ) {
      return true;
    }

    const hasOpponent = Boolean(opponentPosition);
    if (hasOpponent !== this.cinematicLastHasOpponent) {
      return true;
    }

    if (actorPosition.distanceToSquared(this.cinematicLastActorSample) > 1.0) {
      return true;
    }

    if (
      hasOpponent &&
      opponentPosition &&
      opponentPosition.distanceToSquared(this.cinematicLastOpponentSample) > 1.5
    ) {
      return true;
    }

    return false;
  }

  private resolveCinematicView(
    now: number,
    deltaSeconds: number,
    baseTheta: number,
    phi: number,
    radius: number,
    focus: THREE.Vector3,
    actorPosition: THREE.Vector3,
    opponentPosition: THREE.Vector3 | null,
  ): { theta: number; phi: number } {
    const shouldRefresh = this.shouldRefreshCinematicView(
      now,
      baseTheta,
      actorPosition,
      opponentPosition,
    );

    if (shouldRefresh) {
      const selectedView = this.selectCinematicView(
        baseTheta,
        phi,
        radius,
        focus,
        actorPosition,
        opponentPosition,
      );
      const refreshDeltaSeconds = Math.max(
        0.016,
        (now - this.cinematicLastLosRefreshAt) / 1000,
      );

      this.cinematicThetaCache = this.cinematicThetaCacheValid
        ? this.moveAngleToward(
            this.cinematicThetaCache,
            selectedView.theta,
            this.cinematicTuning.thetaRefreshRate,
            refreshDeltaSeconds,
          )
        : selectedView.theta;
      this.cinematicPhiCache = this.cinematicPhiCacheValid
        ? this.moveAngleToward(
            this.cinematicPhiCache,
            selectedView.phi,
            this.cinematicTuning.phiTargetRate,
            refreshDeltaSeconds,
          )
        : selectedView.phi;
      this.cinematicThetaCacheValid = true;
      this.cinematicPhiCacheValid = true;
      this.cinematicLastLosRefreshAt = now;
      this.cinematicLastBaseTheta = baseTheta;
      this.cinematicLastHasOpponent = Boolean(opponentPosition);
      this.cinematicLastActorSample.copy(actorPosition);
      if (opponentPosition) {
        this.cinematicLastOpponentSample.copy(opponentPosition);
      }

      return {
        theta: this.cinematicThetaCache,
        phi: this.cinematicPhiCache,
      };
    }

    // Keep subtle motion even between LOS refreshes.
    const drift = this.shortestAngleDelta(this.cinematicThetaCache, baseTheta);
    this.cinematicThetaCache = this.moveAngleToward(
      this.cinematicThetaCache,
      baseTheta,
      this.cinematicTuning.thetaIdleDriftRate,
      deltaSeconds,
    );
    this.cinematicThetaCache += clamp(
      drift * 0.05,
      -this.cinematicTuning.maxDriftStep,
      this.cinematicTuning.maxDriftStep,
    );
    this.cinematicPhiCache = this.moveAngleToward(
      this.cinematicPhiCache,
      phi,
      this.cinematicTuning.phiTargetRate * 0.55,
      deltaSeconds,
    );
    return {
      theta: this.cinematicThetaCache,
      phi: this.cinematicPhiCache,
    };
  }

  private selectCinematicView(
    baseTheta: number,
    phi: number,
    radius: number,
    focus: THREE.Vector3,
    actorPosition: THREE.Vector3,
    opponentPosition: THREE.Vector3 | null,
  ): { theta: number; phi: number } {
    const coarseThetaOffsets = [0, 0.4, -0.4, 0.85, -0.85];
    const coarsePhiOffsets = [0, -0.1, 0.1];
    const fineThetaOffsets = [0, 0.15, -0.15];
    const finePhiOffsets = [0, -0.05, 0.05];
    let bestScore = -Infinity;
    let bestTheta = baseTheta;
    let bestPhi = phi;
    const seenCandidates = new Set<string>();
    const coarseCandidates: Array<{
      theta: number;
      phi: number;
      score: number;
    }> = [];
    const anchorTheta = this.cinematicThetaCacheValid
      ? this.cinematicThetaCache
      : this.spherical.theta;
    const anchorPhi = this.cinematicPhiCacheValid
      ? this.cinematicPhiCache
      : this.spherical.phi;

    const evaluateCandidate = (theta: number, candidatePhi: number): number => {
      const key = `${theta.toFixed(3)}|${candidatePhi.toFixed(3)}`;
      if (seenCandidates.has(key)) {
        return -Infinity;
      }
      seenCandidates.add(key);
      return this.scoreCinematicViewCandidate({
        theta,
        candidatePhi,
        baseTheta,
        anchorTheta,
        anchorPhi,
        radius,
        focus,
        actorPosition,
        opponentPosition,
      });
    };

    for (const thetaOffset of coarseThetaOffsets) {
      const theta = baseTheta + thetaOffset;

      for (const phiOffset of coarsePhiOffsets) {
        const candidatePhi = clamp(
          phi + phiOffset,
          this.settings.minPolarAngle + 0.01,
          this.settings.maxPolarAngle - 0.01,
        );
        const score = evaluateCandidate(theta, candidatePhi);
        if (score > bestScore) {
          bestScore = score;
          bestTheta = theta;
          bestPhi = candidatePhi;
        }
        if (Number.isFinite(score)) {
          coarseCandidates.push({ theta, phi: candidatePhi, score });
        }
      }
    }

    coarseCandidates.sort((a, b) => b.score - a.score);
    const refineSeeds = coarseCandidates.slice(0, 2);
    for (const seed of refineSeeds) {
      for (const thetaOffset of fineThetaOffsets) {
        const theta = seed.theta + thetaOffset;

        for (const phiOffset of finePhiOffsets) {
          const candidatePhi = clamp(
            seed.phi + phiOffset,
            this.settings.minPolarAngle + 0.01,
            this.settings.maxPolarAngle - 0.01,
          );
          const score = evaluateCandidate(theta, candidatePhi);
          if (score > bestScore) {
            bestScore = score;
            bestTheta = theta;
            bestPhi = candidatePhi;
          }
        }
      }
    }

    return { theta: bestTheta, phi: bestPhi };
  }

  private scoreCinematicViewCandidate(params: {
    theta: number;
    candidatePhi: number;
    baseTheta: number;
    anchorTheta: number;
    anchorPhi: number;
    radius: number;
    focus: THREE.Vector3;
    actorPosition: THREE.Vector3;
    opponentPosition: THREE.Vector3 | null;
  }): number {
    const {
      theta,
      candidatePhi,
      baseTheta,
      anchorTheta,
      anchorPhi,
      radius,
      focus,
      actorPosition,
      opponentPosition,
    } = params;
    const thetaOffset = this.shortestAngleDelta(baseTheta, theta);
    const phiOffset = candidatePhi - anchorPhi;

    _cinematicBestOffset.setFromSpherical(
      _sph_1.set(radius, candidatePhi, theta),
    );
    _cinematicProbePos.copy(focus).add(_cinematicBestOffset);

    let score = -Math.abs(thetaOffset) * 0.62;
    score -= Math.abs(phiOffset) * 0.95;
    score -=
      Math.abs(this.shortestAngleDelta(this.spherical.theta, theta)) * 0.15;
    const turnDelta = Math.abs(this.shortestAngleDelta(anchorTheta, theta));
    score -= turnDelta * 0.95;
    if (turnDelta > this.cinematicTuning.flipPenaltyStartRad) {
      score -= 4.8;
    }
    score -= Math.abs(candidatePhi - anchorPhi) * 1.05;

    const probeDirection = _cinematicProbeDir
      .copy(_cinematicProbePos)
      .sub(focus);
    const probeDistance = probeDirection.length();
    if (probeDistance > 0.001) {
      probeDirection.multiplyScalar(1 / probeDistance);
      const probeHit = this.world.raycast(
        focus,
        probeDirection,
        probeDistance,
        this.getCollisionProbeMask(),
      );
      if (probeHit && probeHit.distance < probeDistance - 0.35) {
        score -= 6.6;
      }
    }

    _cinematicProbeTarget.copy(actorPosition);
    _cinematicProbeTarget.y += 1.05;
    const actorVisible = this.hasLineOfSight(
      _cinematicProbePos,
      _cinematicProbeTarget,
      0.78,
    );
    score += actorVisible ? 6.2 : -7.6;

    let opponentVisible = false;
    if (opponentPosition) {
      _cinematicProbeTarget.copy(opponentPosition);
      _cinematicProbeTarget.y += 1;
      opponentVisible = this.hasLineOfSight(
        _cinematicProbePos,
        _cinematicProbeTarget,
        0.78,
      );
      score += opponentVisible ? 3.1 : -2.4;
    }

    if (actorVisible && (!opponentPosition || opponentVisible)) {
      score += 1.15;
    } else if (!actorVisible && (!opponentPosition || !opponentVisible)) {
      score -= 2.1;
    }

    return score;
  }

  private moveVectorToward(
    current: THREE.Vector3,
    target: THREE.Vector3,
    deltaSeconds: number,
    baseSpeed: number,
    distanceSpeedGain: number,
    maxSpeed: number,
  ): void {
    const distance = current.distanceTo(target);
    if (!Number.isFinite(distance) || distance <= 0.0001) {
      current.copy(target);
      return;
    }

    const speed = clamp(
      baseSpeed + distance * distanceSpeedGain,
      baseSpeed,
      maxSpeed,
    );
    const step = Math.min(distance, speed * Math.max(0, deltaSeconds));
    if (step <= 0) {
      return;
    }
    _cinematicTransitionDir
      .copy(target)
      .sub(current)
      .multiplyScalar(step / distance);
    current.add(_cinematicTransitionDir);
  }

  private applyCinematicLookSlerp(deltaSeconds: number): void {
    if (!this.camera) {
      return;
    }

    _cinematicOrientationMatrix.lookAt(
      this.camera.position,
      this.lookAtTarget,
      _cinematicOrientationUp,
    );
    _cinematicOrientationQuat.setFromRotationMatrix(
      _cinematicOrientationMatrix,
    );

    if (!this.cinematicLookSlerpReady) {
      this.camera.quaternion.copy(_cinematicOrientationQuat);
      this.cinematicLookSlerpReady = true;
      return;
    }

    const alpha = this.getDampingAlpha(
      this.cinematicTuning.lookSlerpRate,
      deltaSeconds,
    );
    if (alpha <= 0) {
      return;
    }
    this.camera.quaternion.slerp(_cinematicOrientationQuat, alpha);
  }

  private buildCinematicFrame(deltaTime: number): {
    focus: THREE.Vector3;
    lookAt: THREE.Vector3;
    theta: number;
    phi: number;
    radius: number;
  } | null {
    if (!this.target || !this.isCinematicCameraActive()) {
      return null;
    }

    const actorEntity = this.resolveTargetEntity(this.target);
    const hasActorPos =
      this.copyEntityPosition(actorEntity, _cinematicActorPos) ||
      this.copyEntityPosition(this.target, _cinematicActorPos);
    if (!hasActorPos) {
      return null;
    }

    const actorId = this.resolveEntityId(actorEntity);
    const opponentEntity = this.resolveOpponentEntity(actorEntity, actorId);
    const hasOpponent = opponentEntity
      ? this.copyEntityPosition(opponentEntity, _cinematicOpponentPos)
      : false;
    const now = Date.now();
    const dt = Math.max(0.001, deltaTime || 0.016);

    this.cinematicClock += Math.max(0.001, deltaTime || 0.016);

    if (hasOpponent) {
      const separation = _cinematicActorPos.distanceTo(_cinematicOpponentPos);

      _cinematicFocusPos
        .copy(_cinematicActorPos)
        .multiplyScalar(0.58)
        .add(
          _cinematicProbeTarget
            .copy(_cinematicOpponentPos)
            .multiplyScalar(0.42),
        );
      _cinematicFocusPos.y += 1.05;

      _cinematicLookAtPos
        .copy(_cinematicActorPos)
        .add(_cinematicOpponentPos)
        .multiplyScalar(0.5);
      _cinematicLookAtPos.y += 1.12;

      let facingTheta = this.cinematicFacingTheta;
      if (separation > 0.25) {
        const rawFacingTheta = Math.atan2(
          _cinematicOpponentPos.x - _cinematicActorPos.x,
          _cinematicOpponentPos.z - _cinematicActorPos.z,
        );
        if (!this.cinematicFacingThetaValid) {
          this.cinematicFacingTheta = rawFacingTheta;
          this.cinematicFacingThetaValid = true;
        } else {
          this.cinematicFacingTheta = this.moveAngleToward(
            this.cinematicFacingTheta,
            rawFacingTheta,
            1.9,
            dt,
          );
        }
        facingTheta = this.cinematicFacingTheta;
      } else if (!this.cinematicFacingThetaValid) {
        this.cinematicFacingTheta = this.spherical.theta;
        this.cinematicFacingThetaValid = true;
        facingTheta = this.cinematicFacingTheta;
      }

      const orbitDrift =
        this.cinematicClock * 0.05 +
        Math.sin(this.cinematicClock * 0.21) * 0.12 +
        Math.sin(this.cinematicClock * 0.08 + 1.7) * 0.08;
      const baseTheta = facingTheta + Math.PI * 0.56 + orbitDrift;
      const baseRadius = clamp(
        6.2 + separation * 1.45,
        this.settings.minDistance + 2,
        this.settings.maxDistance,
      );
      const radius = clamp(
        baseRadius + Math.sin(this.cinematicClock * 0.32) * 0.2,
        this.settings.minDistance + 2,
        this.settings.maxDistance,
      );
      const phi = clamp(
        Math.PI * 0.285 +
          Math.sin(this.cinematicClock * 0.18 + separation * 0.2) * 0.035,
        this.settings.minPolarAngle + 0.03,
        this.settings.maxPolarAngle - 0.03,
      );

      const cinematicView = this.resolveCinematicView(
        now,
        dt,
        baseTheta,
        phi,
        radius,
        _cinematicFocusPos,
        _cinematicActorPos,
        _cinematicOpponentPos,
      );

      return {
        focus: _cinematicFocusPos,
        lookAt: _cinematicLookAtPos,
        theta: cinematicView.theta,
        phi: cinematicView.phi,
        radius,
      };
    }

    this.cinematicFacingThetaValid = false;
    _cinematicFocusPos.copy(_cinematicActorPos);
    _cinematicFocusPos.y += 1;
    _cinematicLookAtPos.copy(_cinematicActorPos);
    _cinematicLookAtPos.y += 1.12;

    const thetaDrift =
      Math.sin(this.cinematicClock * 0.15) * 0.03 + this.cinematicClock * 0.012;
    const baseTheta = this.spherical.theta + thetaDrift;
    const radius = clamp(
      this.targetSpherical.radius + Math.sin(this.cinematicClock * 0.34) * 0.12,
      this.settings.minDistance + 1.5,
      this.settings.maxDistance - 0.5,
    );
    const phi = clamp(
      Math.PI * 0.3 + Math.sin(this.cinematicClock * 0.17 + 0.6) * 0.028,
      this.settings.minPolarAngle + 0.02,
      this.settings.maxPolarAngle - 0.02,
    );
    const cinematicView = this.resolveCinematicView(
      now,
      dt,
      baseTheta,
      phi,
      radius,
      _cinematicFocusPos,
      _cinematicActorPos,
      null,
    );

    return {
      focus: _cinematicFocusPos,
      lookAt: _cinematicLookAtPos,
      theta: cinematicView.theta,
      phi: cinematicView.phi,
      radius,
    };
  }

  update(deltaTime: number): void {
    if (!this.camera) return;
    if (!this.target) {
      this.tryAcquireLocalPlayerTarget();
      this.tryRetargetFromStreamingState();
      // Avoid locking onto arbitrary bystanders before the first streaming state
      // arrives; this prevents an initial hard retarget once state sync lands.
      const hasStreamingStateSignal =
        this.latestStreamingState !== null || this.lastStreamingStateAt > 0;
      const allowSpectatorFallback =
        !this.cinematicEnabled || hasStreamingStateSignal;
      if (allowSpectatorFallback) {
        this.tryAcquireSpectatorFallbackTarget();
      }
      if (!this.target) {
        return;
      }
    }

    const frameDt = Math.max(0.001, deltaTime || 0.016);

    // Safety check: ensure camera is still detached from rig
    if (this.camera.parent === this.world.rig) {
      console.warn(
        "[ClientCameraSystem] Camera re-attached to rig, detaching again",
      );
      this.detachCameraFromRig();
    }

    const cinematicFrame = this.buildCinematicFrame(deltaTime);
    if (cinematicFrame) {
      this.targetPosition.copy(cinematicFrame.focus);
      this.moveVectorToward(
        this.smoothedTarget,
        this.targetPosition,
        frameDt,
        this.cinematicTuning.focusBaseSpeed,
        this.cinematicTuning.focusDistanceSpeedGain,
        this.cinematicTuning.focusMaxSpeed,
      );
      this.targetSpherical.radius += clamp(
        cinematicFrame.radius - this.targetSpherical.radius,
        -2.2 * frameDt,
        2.2 * frameDt,
      );
      this.targetSpherical.phi = this.moveAngleToward(
        this.targetSpherical.phi,
        cinematicFrame.phi,
        this.cinematicTuning.phiTargetRate,
        frameDt,
      );
      this.targetSpherical.theta = this.moveAngleToward(
        this.targetSpherical.theta,
        cinematicFrame.theta,
        this.cinematicTuning.thetaTargetRate,
        frameDt,
      );
      this.moveVectorToward(
        this.lookAtTarget,
        cinematicFrame.lookAt,
        frameDt,
        this.cinematicTuning.lookBaseSpeed,
        this.cinematicTuning.lookDistanceSpeedGain,
        this.cinematicTuning.lookMaxSpeed,
      );
    } else {
      let hasTargetPosition = this.getTargetWorldPosition(_v3_1);
      if (!hasTargetPosition) {
        if (this.tryRetargetFromStreamingState(true)) {
          hasTargetPosition = this.getTargetWorldPosition(_v3_1);
        }
        if (!hasTargetPosition && this.tryAcquireSpectatorFallbackTarget()) {
          hasTargetPosition = this.getTargetWorldPosition(_v3_1);
        }
        if (!hasTargetPosition) {
          return;
        }
      }

      // For server-authoritative movement, follow target directly without smoothing.
      this.targetPosition.copy(_v3_1);
      this.targetPosition.add(this.cameraOffset);

      // RS3: no target smoothing; follow the player position directly to avoid any lag/jitter
      this.smoothedTarget.copy(this.targetPosition);
    }

    // Apply spherical smoothing only while orbiting. When not orbiting, snap to target to avoid drift.
    const rotationDamping = this.settings.rotationDampingFactor;
    const isOrbiting =
      this.mouseState.middleDown ||
      (this.mouseState.leftDown && this.leftDragStarted) ||
      this.touchState.active;
    const shouldSmoothSpherical = isOrbiting || Boolean(cinematicFrame);
    if (shouldSmoothSpherical) {
      if (cinematicFrame) {
        this.spherical.phi = this.moveAngleToward(
          this.spherical.phi,
          this.targetSpherical.phi,
          this.cinematicTuning.phiAppliedRate,
          frameDt,
        );
        this.spherical.theta = this.moveAngleToward(
          this.spherical.theta,
          this.targetSpherical.theta,
          this.cinematicTuning.thetaAppliedRate,
          frameDt,
        );
      } else {
        const phiDelta = this.targetSpherical.phi - this.spherical.phi;
        const thetaDelta = this.shortestAngleDelta(
          this.spherical.theta,
          this.targetSpherical.theta,
        );
        if (Math.abs(phiDelta) > 1e-5) {
          this.spherical.phi += phiDelta * rotationDamping;
        } else {
          this.spherical.phi = this.targetSpherical.phi;
        }
        if (Math.abs(thetaDelta) > 1e-5) {
          this.spherical.theta += thetaDelta * rotationDamping;
        } else {
          this.spherical.theta = this.targetSpherical.theta;
        }
      }
    } else {
      this.spherical.phi = this.targetSpherical.phi;
      this.spherical.theta = this.targetSpherical.theta;
    }

    // Hard clamp after smoothing to enforce strict RS3-like limits
    this.spherical.radius = clamp(
      this.spherical.radius,
      this.settings.minDistance,
      this.settings.maxDistance,
    );

    // Collision-aware effective radius with smoothing to avoid snap on MMB press
    const desiredDistance = this.spherical.radius;
    const collidedDistance =
      this.computeCollisionAdjustedDistance(desiredDistance);
    const targetEffective = Math.min(desiredDistance, collidedDistance);
    if (this.zoomDirty || this.orbitingActive) {
      // When zoom just changed, honor immediate response
      this.effectiveRadius = targetEffective;
    } else {
      const radiusDamping = this.settings.radiusDampingFactor ?? 0.18;
      this.effectiveRadius +=
        (targetEffective - this.effectiveRadius) * radiusDamping;
    }

    // Calculate camera position from spherical coordinates using effective radius
    const tempSpherical = _sph_1.set(
      this.effectiveRadius,
      this.spherical.phi,
      this.spherical.theta,
    );
    this.cameraPosition.setFromSpherical(tempSpherical);
    this.cameraPosition.add(this.smoothedTarget);

    if (!cinematicFrame) {
      // Calculate look-at target - look at player's chest/torso height
      this.lookAtTarget.copy(this.smoothedTarget);
      // Over-the-shoulder: look at shoulder/upper chest height
      this.lookAtTarget.y = this.smoothedTarget.y + 0.2;

      // Apply over-the-shoulder offset (Fortnite-style)
      // When zoomed in close, offset the look-at target horizontally so character appears on left/right
      const zoomFactor = THREE.MathUtils.clamp(
        (this.settings.maxDistance - this.effectiveRadius) /
          (this.settings.maxDistance - this.settings.minDistance),
        0,
        1,
      );
      const shoulderOffset = this.settings.shoulderOffsetMax * zoomFactor;

      // Calculate the right vector relative to camera's current orientation
      const cameraRight = _v3_1
        .set(Math.cos(this.spherical.theta), 0, Math.sin(this.spherical.theta))
        .normalize();

      // Apply horizontal offset to look-at target
      this.lookAtTarget.x +=
        cameraRight.x * shoulderOffset * this.settings.shoulderOffsetSide;
      this.lookAtTarget.z +=
        cameraRight.z * shoulderOffset * this.settings.shoulderOffsetSide;
    }

    // Follow target. If zoom changed this frame, snap position instantly for straight-in/out motion
    // RS3: move camera directly with no positional lerp to avoid swoop or lag
    this.camera.position.copy(this.cameraPosition);
    this.zoomDirty = false;

    if (cinematicFrame) {
      this.applyCinematicLookSlerp(frameDt);
    } else {
      // Camera always looks at the lookAt target
      // This keeps the player centered regardless of avatar rotation
      this.camera.lookAt(this.lookAtTarget);
      this.cinematicLookSlerpReady = false;
    }

    // Update camera matrices since it has no parent transform to inherit from
    this.camera.updateMatrixWorld(true);

    // Do not clamp camera height to terrain; effective radius collision handles occlusion
  }

  private computeCollisionAdjustedDistance(desiredDistance: number): number {
    if (!this.camera || !this.target) return desiredDistance;

    // Direction from orbit center (smoothed target) to ideal camera position
    const dir = _v3_3
      .set(
        this.cameraPosition.x - this.smoothedTarget.x,
        this.cameraPosition.y - this.smoothedTarget.y,
        this.cameraPosition.z - this.smoothedTarget.z,
      )
      .normalize();

    const origin = _v3_2.set(
      this.smoothedTarget.x,
      this.smoothedTarget.y,
      this.smoothedTarget.z,
    );
    const hit = this.world.raycast(
      origin,
      dir,
      desiredDistance,
      this.getCollisionProbeMask(),
    );
    // Strong type assumption - RaycastHit.distance is always number
    if (hit && hit.distance > 0) {
      const minDist = this.settings.minDistance;
      const margin = 0.4;
      return Math.max(
        Math.min(desiredDistance, hit.distance - margin),
        minDist,
      );
    }
    return desiredDistance;
  }

  private shortestAngleDelta(a: number, b: number): number {
    let delta = (b - a) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  private validatePlayerOnTerrain(
    playerPos: THREE.Vector3 | { x: number; y: number; z: number },
  ): void {
    // Get terrain system
    const terrainSystem = this.world.getSystem("terrain");
    if (!terrainSystem) {
      // No terrain system available
      return;
    }

    // Get player coordinates
    const px = "x" in playerPos ? playerPos.x : (playerPos as THREE.Vector3).x;
    const py = "y" in playerPos ? playerPos.y : (playerPos as THREE.Vector3).y;
    const pz = "z" in playerPos ? playerPos.z : (playerPos as THREE.Vector3).z;

    // Get terrain height at player position
    const terrainHeight = terrainSystem.getHeightAt(px, pz);

    // Check if terrain height is valid
    if (!isFinite(terrainHeight) || isNaN(terrainHeight)) {
      const errorMsg = `[CRITICAL] Invalid terrain height at player position: x=${px}, z=${pz}, terrainHeight=${terrainHeight}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Check if player is properly positioned on terrain
    // Allow some tolerance for player height above terrain (0.0 to 5.0 units)
    const heightDifference = py - terrainHeight;

    if (heightDifference < -0.5) {
      const errorMsg = `[CRITICAL] Player is BELOW terrain! Player Y: ${py}, Terrain Height: ${terrainHeight}, Difference: ${heightDifference}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (heightDifference > 10.0) {
      const errorMsg = `[CRITICAL] Player is FLOATING above terrain! Player Y: ${py}, Terrain Height: ${terrainHeight}, Difference: ${heightDifference}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Additional check: if player Y is exactly 0 or very close to 0, might indicate spawn issue
    if (Math.abs(py) < 0.01 && Math.abs(terrainHeight) > 1.0) {
      const errorMsg = `[CRITICAL] Player Y position is near zero (${py}) but terrain height is ${terrainHeight} - likely spawn failure!`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Log successful validation periodically (every 60 frames)
    if (Math.random() < 0.0167) {
      // ~1/60 chance
    }
  }

  // Public API methods for testing and external access
  public setTarget(target: CameraTarget): void {
    this.onSetTarget({ target });
    this.emitTypedEvent(EventType.CAMERA_TARGET_CHANGED, { target });
  }

  public getCameraInfo(): {
    camera: THREE.PerspectiveCamera | null;
    target: CameraTarget | null;
    offset: number[];
    position: number[] | null;
    isControlling: boolean;
    spherical: { radius: number; phi: number; theta: number };
  } {
    // Use pre-allocated arrays to avoid memory allocations
    _cameraInfoOffset[0] = this.cameraOffset.x;
    _cameraInfoOffset[1] = this.cameraOffset.y;
    _cameraInfoOffset[2] = this.cameraOffset.z;

    let position: number[] | null = null;
    if (this.camera) {
      _cameraInfoPosition[0] = this.camera.position.x;
      _cameraInfoPosition[1] = this.camera.position.y;
      _cameraInfoPosition[2] = this.camera.position.z;
      position = _cameraInfoPosition;
    }

    return {
      camera: this.camera,
      target: this.target,
      offset: _cameraInfoOffset,
      position: position,
      isControlling:
        this.mouseState.middleDown ||
        (this.mouseState.leftDown && this.leftDragStarted) ||
        this.touchState.active,
      spherical: {
        radius: this.spherical.radius,
        phi: this.spherical.phi,
        theta: this.spherical.theta,
      },
    };
  }

  destroy(): void {
    if (this.canvas) {
      // Remove capture phase listeners
      this.canvas.removeEventListener(
        "mousedown",
        this.boundHandlers.mouseDown as EventListener,
        true,
      );
      this.canvas.removeEventListener(
        "mousemove",
        this.boundHandlers.mouseMove as EventListener,
        true,
      );
      this.canvas.removeEventListener(
        "mouseup",
        this.boundHandlers.mouseUp as EventListener,
        true,
      );
      this.canvas.removeEventListener(
        "wheel",
        this.boundHandlers.mouseWheel as EventListener,
        true,
      );
      this.canvas.removeEventListener(
        "mouseleave",
        this.boundHandlers.mouseLeave as EventListener,
        true,
      );
      this.canvas.removeEventListener(
        "contextmenu",
        this.boundHandlers.contextMenu as EventListener,
        true,
      );
      this.canvas.removeEventListener(
        "click",
        this.boundHandlers.click as EventListener,
        true,
      );
      document.removeEventListener(
        "keydown",
        this.boundHandlers.keyDown as EventListener,
      );
      document.removeEventListener(
        "keyup",
        this.boundHandlers.keyUp as EventListener,
      );

      // Clean up touch events
      this.canvas.removeEventListener(
        "touchstart",
        this.boundHandlers.touchStart as EventListener,
      );
      this.canvas.removeEventListener(
        "touchmove",
        this.boundHandlers.touchMove as EventListener,
      );
      this.canvas.removeEventListener(
        "touchend",
        this.boundHandlers.touchEnd as EventListener,
      );
      this.canvas.removeEventListener(
        "touchcancel",
        this.boundHandlers.touchEnd as EventListener,
      );

      this.canvas.style.cursor = "default";
    }

    this.camera = null;
    this.target = null;
    this.canvas = null;
    this.raycastService = null;
    this.cinematicLosMask = null;
    this.cinematicCollisionMask = null;
    this.cinematicLookSlerpReady = false;
    this.resetCinematicSamplingState();
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}
