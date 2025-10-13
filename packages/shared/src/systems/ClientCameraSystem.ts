/**
 * Core Camera System
 * camera system that supports multiple control modes:
 * - First Person (pointer lock, WASD movement)
 * - Third Person/MMO(right-click drag, click-to-move)
 * - Top-down/RTS (pan, zoom, click-to-move)
 */

import THREE from '../extras/three';
import { SystemBase } from './SystemBase';

import type { CameraTarget, System, World } from '../types';
import { EventType } from '../types/events';
import { clamp } from '../utils';
// CameraTarget interface moved to shared types

// Define TerrainSystem interface for type checking
interface TerrainSystem extends System {
  getHeightAt(x: number, z: number): number;
  getNormalAt(x: number, z: number): { x: number; y: number; z: number };
}

const _v3_1 = new THREE.Vector3()
const _v3_2 = new THREE.Vector3()
const _v3_3 = new THREE.Vector3()
const _q_1 = new THREE.Quaternion()
const _sph_1 = new THREE.Spherical()
// Pre-allocated arrays for getCameraInfo to avoid allocations
const _cameraInfoOffset: number[] = [0, 0, 0]
const _cameraInfoPosition: number[] = [0, 0, 0]

export class ClientCameraSystem extends SystemBase {
  private camera: THREE.PerspectiveCamera | null = null;
  private target: CameraTarget | null = null;
  private canvas: HTMLCanvasElement | null = null;
  
  // Camera state for different modes
  private spherical = new THREE.Spherical(6, Math.PI * 0.3, 0); // current radius, phi, theta
  private targetSpherical = new THREE.Spherical(6, Math.PI * 0.3, 0); // target spherical for smoothing
  private targetPosition = new THREE.Vector3();
  private smoothedTarget = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(0, 2, 0);
  private lookAtTarget = new THREE.Vector3();
  // Collision-aware effective radius
  private effectiveRadius = 6;
  // Zoom handling flags to make zoom move instantly with no easing
  private zoomDirty = false;
  private lastDesiredRadius = this.spherical.radius;
  
  // Control settings
  private readonly settings = {
      // RS3-like zoom bounds (further min to avoid getting too close)
      minDistance: 5.0,
      maxDistance: 15.0,
      // RS3-like pitch limits: tighten min to prevent overhead
      minPolarAngle: Math.PI * 0.24,
      maxPolarAngle: Math.PI * 0.45,
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
      zoomStep: 0.6
  };
  
  // Mouse state
  private mouseState = {
    rightDown: false,
    middleDown: false,
    leftDown: false,
    lastPosition: new THREE.Vector2(),
    delta: new THREE.Vector2(),
    leftDownPosition: new THREE.Vector2(), // Track where left click started
    hasDragged: false, // Track if significant drag occurred
    lastDragEndTime: 0 // Track when last drag ended to suppress click events
  };
  // Touch state for mobile
  private touchState = {
    active: false,
    touchId: -1,
    startPosition: new THREE.Vector2(),
    lastPosition: new THREE.Vector2()
  };
  // Two-finger touch state for pinch zoom
  private pinchState = {
    active: false,
    initialDistance: 0,
    lastDistance: 0
  };
  // Orbit state to prevent press-down snap until actual drag movement
  private orbitingActive = false;
  private orbitingPrimed = false;
  
  // Bound event handlers for cleanup
  private boundHandlers = {
    mouseDown: this.onMouseDown.bind(this),
    mouseMove: this.onMouseMove.bind(this),
    mouseUp: this.onMouseUp.bind(this),
    mouseWheel: this.onMouseWheel.bind(this),
    mouseLeave: this.onMouseLeave.bind(this),
    contextMenu: this.onContextMenu.bind(this),
    keyDown: this.onKeyDown.bind(this),
    keyUp: this.onKeyUp.bind(this),
    touchStart: this.onTouchStart.bind(this),
    touchMove: this.onTouchMove.bind(this),
    touchEnd: this.onTouchEnd.bind(this)
  };

  constructor(world: World) {
    super(world, { name: 'client-camera', dependencies: { required: [], optional: [] }, autoCleanup: true });
  }

  async init(): Promise<void> {
    if (!this.world.isClient) return;
    
    // Listen for camera events via event bus (typed)
    this.subscribe(EventType.CAMERA_SET_TARGET, (data: { target: { position: THREE.Vector3 } }) => this.onSetTarget({ target: { position: data.target.position } as CameraTarget }));
    this.subscribe(EventType.CAMERA_RESET, () => this.resetCamera());

    // Listen for player events
    this.subscribe(EventType.PLAYER_AVATAR_READY, (data: { playerId: string; avatar: unknown; camHeight: number }) => this.onAvatarReady({ playerId: data.playerId, avatar: (data.avatar as { base?: THREE.Object3D } ).base ?? ({} as THREE.Object3D), camHeight: data.camHeight }));
    
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
      console.log('[ClientCameraSystem] Detaching camera from world.rig to make it independent');
      
      // Get world position and rotation before removing from parent
      const worldPos = _v3_1
      const worldQuat = _q_1
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
      
      console.log('[ClientCameraSystem] Camera is now independent from rig transforms');
    } else if (this.camera.parent && this.camera.parent !== this.world.stage.scene) {
      console.warn('[ClientCameraSystem] Camera has unexpected parent:', this.camera.parent);
    }
  }

  private tryInitialize(): void {
    this.camera = this.world.camera;
    this.canvas = this.world.graphics?.renderer?.domElement ?? null;

    if (!this.camera || !this.canvas) {
      setTimeout(() => this.tryInitialize(), 100);
      return;
    }

    // Ensure camera is detached from rig once it's available
    this.detachCameraFromRig();
    
    // Initialize camera position to avoid starting at origin
    if (this.camera.position.lengthSq() < 0.01) {
      console.log('[ClientCameraSystem] Initializing camera position');
      this.camera.position.set(0, 10, 10); // Start above and behind origin
    }

    this.setupEventListeners();
  
    
    // Try to follow local player - check once, then rely on player:ready event
    this.initializePlayerTarget();
      }

  private initializePlayerTarget(): void {
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id) {
      this.logger.info(`Setting player as camera target: ${localPlayer.id}`);
      this.onSetTarget({ target: localPlayer as CameraTarget });
      
        this.initializeCameraPosition();
    } else {
      this.logger.info('No local player found yet, waiting for player:ready event');
    }
  }
  
  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Use capture phase for mouse events so camera runs before other interaction systems
    this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown as EventListener, true);
    this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove as EventListener, true);
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp as EventListener, true);
    this.canvas.addEventListener('wheel', this.boundHandlers.mouseWheel as EventListener, true);
    this.canvas.addEventListener('mouseleave', this.boundHandlers.mouseLeave as EventListener, true);
    
    // Listen to click events to suppress them after drags
    this.canvas.addEventListener('click', this.onClickCapture.bind(this) as EventListener, true);
    
    // Listen to contextmenu to mark when we're handling camera rotation
    // Use capture phase to run before InteractionSystem
    this.canvas.addEventListener('contextmenu', this.boundHandlers.contextMenu as EventListener, true);
    
    document.addEventListener('keydown', this.boundHandlers.keyDown as EventListener);
    document.addEventListener('keyup', this.boundHandlers.keyUp as EventListener);
    
    // Touch events for mobile camera control
    this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart as EventListener, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove as EventListener, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd as EventListener);
    this.canvas.addEventListener('touchcancel', this.boundHandlers.touchEnd as EventListener);
  }

  private onMouseDown(event: MouseEvent): void {
    // Handle camera controls in capture phase before other systems
    
    if (event.button === 2) { // Right mouse button - context menu (optional, could disable)
      event.preventDefault(); // Prevent context menu
      event.stopPropagation(); // Stop event from reaching other systems
      this.mouseState.rightDown = true;
    } else if (event.button === 1) { // Middle mouse button for zoom
      event.preventDefault();
      event.stopPropagation(); // Stop event from reaching other systems
      this.mouseState.middleDown = true;
      this.canvas!.style.cursor = 'grabbing';
    } else if (event.button === 0) { // Left mouse button - drag to rotate OR click to move
      this.mouseState.leftDown = true;
      this.mouseState.leftDownPosition.set(event.clientX, event.clientY);
      this.mouseState.hasDragged = false;
      
      // Align targets to current spherical to avoid any initial jump
      this.targetSpherical.theta = this.spherical.theta;
      this.targetSpherical.phi = this.spherical.phi;
      // Prime orbiting; activate only after passing small drag threshold
      this.orbitingPrimed = true;
      this.orbitingActive = false;
      
      // Don't prevent default yet - wait to see if user drags or just clicks
    }

    this.mouseState.lastPosition.set(event.clientX, event.clientY);
  }

  private onMouseMove(event: MouseEvent): void {
    // Handle middle mouse button drag for zoom
    if (this.mouseState.middleDown) {
      event.preventDefault();
      event.stopPropagation();
      
      const deltaY = event.clientY - this.mouseState.lastPosition.y;
      
      // Vertical drag changes zoom: drag down = zoom out, drag up = zoom in
      const zoomSensitivity = 0.02;
      this.targetSpherical.radius += deltaY * zoomSensitivity;
      this.targetSpherical.radius = clamp(
        this.targetSpherical.radius,
        this.settings.minDistance,
        this.settings.maxDistance
      );
      
      // Snap zoom immediately for responsive feel
      this.spherical.radius = this.targetSpherical.radius;
      this.effectiveRadius = this.targetSpherical.radius;
      this.zoomDirty = true;
      this.lastDesiredRadius = this.spherical.radius;
      
      this.mouseState.lastPosition.set(event.clientX, event.clientY);
      return;
    }
    
    // Left-click drag for camera rotation
    if (!this.mouseState.leftDown) return;

    this.mouseState.delta.set(
      event.clientX - this.mouseState.lastPosition.x,
      event.clientY - this.mouseState.lastPosition.y
    );

    // Check if user has dragged enough to be considered a drag (not a click)
    if (!this.mouseState.hasDragged) {
      const totalDrag = Math.hypot(
        event.clientX - this.mouseState.leftDownPosition.x,
        event.clientY - this.mouseState.leftDownPosition.y
      );
      
      if (totalDrag > 5) { // 5px threshold
        // User is dragging - mark as dragged and prevent click-to-move
        this.mouseState.hasDragged = true;
        event.preventDefault();
        event.stopPropagation();
      }
    }

    // If we've established this is a drag, handle rotation
    if (this.mouseState.hasDragged) {
      event.preventDefault();
      event.stopPropagation();
      
      // Activate orbiting only after surpassing a small movement threshold
      if (!this.orbitingActive) {
        const drag = Math.abs(this.mouseState.delta.x) + Math.abs(this.mouseState.delta.y);
        if (drag > 3) {
          this.orbitingActive = true;
          this.orbitingPrimed = false;
          this.canvas!.style.cursor = 'grabbing';
        }
      }
      
      if (!this.orbitingActive) {
        this.mouseState.lastPosition.set(event.clientX, event.clientY);
        return;
      }
      
      const invert = this.settings.invertY === true ? -1 : 1;
      // RS3-like: keep rotation responsive when fully zoomed out
      const minR = this.settings.minDistance;
      const maxR = this.settings.maxDistance;
      const r = THREE.MathUtils.clamp(this.spherical.radius, minR, maxR);
      const t = (r - minR) / (maxR - minR); // 0 at min zoom, 1 at max zoom
      const speedScale = THREE.MathUtils.lerp(1.0, 1.3, t); // slightly faster when zoomed out
      const inputScale = this.settings.rotateSpeed * 0.01 * speedScale;
      this.targetSpherical.theta -= this.mouseState.delta.x * inputScale;
      this.targetSpherical.phi -= invert * this.mouseState.delta.y * inputScale;
      this.targetSpherical.phi = clamp(
        this.targetSpherical.phi,
        this.settings.minPolarAngle,
        this.settings.maxPolarAngle
      );
    }

    this.mouseState.lastPosition.set(event.clientX, event.clientY);
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2) { // Right mouse button
      event.preventDefault();
      event.stopPropagation();
      this.mouseState.rightDown = false;
    }
    
    if (event.button === 1) { // Middle mouse button
      event.preventDefault();
      event.stopPropagation();
      this.mouseState.middleDown = false;
      this.canvas!.style.cursor = 'default';
    }
    
    if (event.button === 0) { // Left mouse button
      // If user dragged, prevent click-to-move from triggering
      if (this.mouseState.hasDragged) {
        event.preventDefault();
        event.stopPropagation();
        
        // Mark time of drag end to suppress subsequent click event
        this.mouseState.lastDragEndTime = performance.now();
        
        // Freeze target to current to avoid any snap when stopping rotation
        this.targetSpherical.theta = this.spherical.theta;
        this.targetSpherical.phi = this.spherical.phi;
        this.canvas!.style.cursor = 'default';
      }
      // Otherwise, let the click event propagate to InteractionSystem for click-to-move
      
      this.mouseState.leftDown = false;
      this.mouseState.hasDragged = false;
      this.orbitingActive = false;
      this.orbitingPrimed = false;
    }
  }

  private onClickCapture(event: MouseEvent): void {
    // If a drag just ended (within last 50ms), suppress the click event
    const timeSinceDragEnd = performance.now() - this.mouseState.lastDragEndTime;
    if (timeSinceDragEnd < 50) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
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
        const steps = Math.max(1, Math.min(5, Math.round(Math.abs(event.deltaY) / 100)));
        this.targetSpherical.radius += sign * steps * this.settings.zoomStep;
      }
    }
    
    this.targetSpherical.radius = clamp(this.targetSpherical.radius, this.settings.minDistance, this.settings.maxDistance);
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
    this.mouseState.hasDragged = false;
    this.orbitingActive = false;
    this.orbitingPrimed = false;
    if (this.canvas) {
      this.canvas.style.cursor = 'default';
    }
  }

  private onContextMenu(event: MouseEvent): void {
    // Check if clicking on an entity - if so, let InteractionSystem handle it
    // Raycast to check if clicking on an entity
    if (this.world.camera && this.canvas) {
      const rect = this.canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), this.world.camera)
      
      const scene = this.world.stage?.scene
      if (scene) {
        const intersects = raycaster.intersectObjects(scene.children, true)
        
        // Check if any intersected object has entity userData
        for (const intersect of intersects) {
          let obj = intersect.object
          while (obj) {
            if (obj.userData && obj.userData.entityId) {
              // Clicking on entity - let InteractionSystem handle it
              return
            }
            obj = obj.parent as THREE.Object3D
          }
        }
      }
    }
    
    // Not clicking on entity - prevent default context menu
    event.preventDefault();
    event.stopPropagation();
  }

  private onKeyDown(event: KeyboardEvent): void {
    // RS-style camera control via arrow keys: rotate around character only
    const rotateStep = 0.06;
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      // ArrowLeft should rotate view left: decrease theta
      this.targetSpherical.theta -= rotateStep;
      return;
    }
    if (event.code === 'ArrowRight') {
      event.preventDefault();
      // ArrowRight should rotate view right: increase theta
      this.targetSpherical.theta += rotateStep;
      return;
    }
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      this.targetSpherical.phi = clamp(
        this.targetSpherical.phi - rotateStep,
        this.settings.minPolarAngle,
        this.settings.maxPolarAngle
      );
      return;
    }
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      this.targetSpherical.phi = clamp(
        this.targetSpherical.phi + rotateStep,
        this.settings.minPolarAngle,
        this.settings.maxPolarAngle
      );
      return;
    }

    if (event.code === 'Home' || event.code === 'NumpadHome') {
      this.resetCamera();
      event.preventDefault();
    }
  }

  private onKeyUp(_event: KeyboardEvent): void {
    // Reserved for future keyboard camera controls
  }

  private onTouchStart(event: TouchEvent): void {
    // Ignore touches that start on UI elements (so UI remains interactive on mobile)
    const first = event.touches[0]
    if (first) {
      const topEl = document.elementFromPoint(first.clientX, first.clientY)
      if (topEl && this.canvas && topEl !== this.canvas) {
        return
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
        touch2.clientY - touch1.clientY
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

      const totalDragDistance = Math.hypot(touch.clientX - this.touchState.startPosition.x, touch.clientY - this.touchState.startPosition.y);
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
        this.targetSpherical.phi = clamp(this.targetSpherical.phi, this.settings.minPolarAngle, this.settings.maxPolarAngle);
      }
      this.touchState.lastPosition.set(touch.clientX, touch.clientY);
    } else if (this.pinchState.active && event.touches.length === 2) {
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const distanceDelta = this.pinchState.lastDistance - distance;
      const pinchSensitivity = 0.01;
      this.targetSpherical.radius += distanceDelta * pinchSensitivity;
      this.targetSpherical.radius = clamp(this.targetSpherical.radius, this.settings.minDistance, this.settings.maxDistance);
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
        y: this.touchState.startPosition.y
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
    const cameraRight = _v3_1
    const cameraForward = _v3_2

    // Get camera right vector
    cameraRight.setFromMatrixColumn(this.camera.matrix, 0).normalize();
    
    // Get camera forward vector projected on XZ plane
    this.camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();

    const panSpeed = this.settings.panSpeed * 0.01;
    
    // Apply pan to camera offset
    this.cameraOffset.x -= deltaX * panSpeed * cameraRight.x + deltaY * panSpeed * cameraForward.x;
    this.cameraOffset.z -= deltaX * panSpeed * cameraRight.z + deltaY * panSpeed * cameraForward.z;
  }

  private resetCamera(): void {
    if (!this.target) return;

    this.targetSpherical.radius = 8;
    this.targetSpherical.theta = 0;
    this.targetSpherical.phi = Math.PI * 0.4;
    this.spherical.radius = this.targetSpherical.radius;
    this.spherical.theta = this.targetSpherical.theta;
    this.spherical.phi = this.targetSpherical.phi;
    // RS3 shoulder/head height
    this.cameraOffset.set(0, 1.8, 0);
  }

  private onSetTarget(event: { target: CameraTarget }): void {
    this.target = event.target;
    this.logger.info('Target set', { x: this.target.position.x, y: this.target.position.y, z: this.target.position.z });
    
    if (this.target) {
      this.initializeCameraPosition();
    }
  }
  
  private onAvatarReady(event: { playerId: string; avatar: THREE.Object3D; camHeight: number }): void {
    // Use avatar height directly without extra offset since player is at terrain level
    this.cameraOffset.y = event.camHeight || 1.6;
    
    const localPlayer = this.world.getPlayer();
    if (localPlayer && localPlayer.id === event.playerId && !this.target) {
      this.onSetTarget({ target: localPlayer as CameraTarget });
    }
  }

  private initializeCameraPosition(): void {
    if (!this.target || !this.camera) return;

    const targetPos = this.target.position;
    if (!targetPos) return;

    // Ensure camera is independent before positioning
    this.detachCameraFromRig();

    // Set up orbit center in world space
    const orbitCenter = _v3_1.set(targetPos.x, targetPos.y + this.cameraOffset.y, targetPos.z);
    
    this.cameraPosition.setFromSpherical(this.spherical);
    this.cameraPosition.add(orbitCenter);
    
    // Set camera world position directly (no parent transforms)
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(orbitCenter);
    
    // Force update matrices since camera has no parent
    this.camera.updateMatrixWorld(true);
  }

  update(_deltaTime: number): void {
    if(!this.target || !this.target.position) return;
    if(!this.camera) return;
    
    // Safety check: ensure camera is still detached from rig
    if (this.camera.parent === this.world.rig) {
      console.warn('[ClientCameraSystem] Camera re-attached to rig, detaching again');
      this.detachCameraFromRig();
    }
    
    // Get target position in world space
    const targetPos = this.target.position;
    
    // Optionally validate player terrain position (commented out to avoid errors)
    // this.validatePlayerOnTerrain(targetPos);

    // For server-authoritative movement, follow target directly without smoothing
    // This prevents jitter when server sends instant position updates
    this.targetPosition.copy(targetPos);
    this.targetPosition.add(this.cameraOffset);
    
    // RS3: no target smoothing; follow the player position directly to avoid any lag/jitter
    this.smoothedTarget.copy(this.targetPosition);

    // Apply spherical smoothing only while orbiting. When not orbiting, snap to target to avoid drift.
    const rotationDamping = this.settings.rotationDampingFactor;
    if (this.mouseState.rightDown || this.touchState.active) {
      const phiDelta = (this.targetSpherical.phi - this.spherical.phi);
      const thetaDelta = this.shortestAngleDelta(this.spherical.theta, this.targetSpherical.theta);
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
    } else {
      this.spherical.phi = this.targetSpherical.phi;
      this.spherical.theta = this.targetSpherical.theta;
    }

    // Hard clamp after smoothing to enforce strict RS3-like limits
    this.spherical.radius = clamp(
      this.spherical.radius,
      this.settings.minDistance,
      this.settings.maxDistance
    );

    // Collision-aware effective radius with smoothing to avoid snap on MMB press
    const desiredDistance = this.spherical.radius;
    const collidedDistance = this.computeCollisionAdjustedDistance(desiredDistance);
    const targetEffective = Math.min(desiredDistance, collidedDistance);
    if (this.zoomDirty || this.orbitingActive) {
      // When zoom just changed, honor immediate response
      this.effectiveRadius = targetEffective;
    } else {
      const radiusDamping = this.settings.radiusDampingFactor ?? 0.18;
      this.effectiveRadius += (targetEffective - this.effectiveRadius) * radiusDamping;
    }

    // Calculate camera position from spherical coordinates using effective radius
    const tempSpherical = _sph_1.set(this.effectiveRadius, this.spherical.phi, this.spherical.theta);
    this.cameraPosition.setFromSpherical(tempSpherical);
    this.cameraPosition.add(this.smoothedTarget);

    // Calculate look-at target - look at player's chest/torso height
    this.lookAtTarget.copy(this.smoothedTarget);
    // RS3-style: look directly at a fixed chest-height above target (no dynamic min/max)
    this.lookAtTarget.y = this.smoothedTarget.y + 1.5;

    // Follow target. If zoom changed this frame, snap position instantly for straight-in/out motion
    // RS3: move camera directly with no positional lerp to avoid swoop or lag
    this.camera.position.copy(this.cameraPosition);
    this.zoomDirty = false;
    
    // Camera always looks at the lookAt target
    // This keeps the player centered regardless of avatar rotation
    this.camera.lookAt(this.lookAtTarget);
    
    // Update camera matrices since it has no parent transform to inherit from
    this.camera.updateMatrixWorld(true);

    // Do not clamp camera height to terrain; effective radius collision handles occlusion
  }

  private computeCollisionAdjustedDistance(desiredDistance: number): number {
    if (!this.camera || !this.target) return desiredDistance;

    // Direction from orbit center (smoothed target) to ideal camera position
    const dir = _v3_3.set(
      this.cameraPosition.x - this.smoothedTarget.x,
      this.cameraPosition.y - this.smoothedTarget.y,
      this.cameraPosition.z - this.smoothedTarget.z
    ).normalize();

    const origin = _v3_2.set(this.smoothedTarget.x, this.smoothedTarget.y, this.smoothedTarget.z);
    const mask = this.world.createLayerMask('environment');
    const hit = this.world.raycast(origin, dir, desiredDistance, mask);
    // Strong type assumption - RaycastHit.distance is always number
    if (hit && hit.distance > 0) {
      const minDist = this.settings.minDistance;
      const margin = 0.4;
      return Math.max(Math.min(desiredDistance, hit.distance - margin), minDist);
    }
    return desiredDistance;
  }

  private shortestAngleDelta(a: number, b: number): number {
    let delta = (b - a) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }


  private validatePlayerOnTerrain(playerPos: THREE.Vector3 | { x: number; y: number; z: number }): void {
    // Get terrain system
    const terrainSystem = this.world.getSystem<TerrainSystem>('terrain');
    if (!terrainSystem) {
      // No terrain system available
      return;
    }

    // Get player coordinates
    const px = 'x' in playerPos ? playerPos.x : (playerPos as THREE.Vector3).x;
    const py = 'y' in playerPos ? playerPos.y : (playerPos as THREE.Vector3).y;
    const pz = 'z' in playerPos ? playerPos.z : (playerPos as THREE.Vector3).z;

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
    if (Math.random() < 0.0167) { // ~1/60 chance
      console.log(`[ClientCameraSystem] Player terrain validation OK - Player Y: ${py.toFixed(2)}, Terrain: ${terrainHeight.toFixed(2)}, Diff: ${heightDifference.toFixed(2)}`);
    }
  }

  // Public API methods for testing and external access
  public setTarget(target: CameraTarget): void {
    this.target = target;
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
      isControlling: this.mouseState.rightDown || this.touchState.active,
      spherical: { radius: this.spherical.radius, phi: this.spherical.phi, theta: this.spherical.theta }
    };
  }

  destroy(): void {
    if (this.canvas) {
      // Remove capture phase listeners
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown as EventListener, true);
      this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove as EventListener, true);
      this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp as EventListener, true);
      this.canvas.removeEventListener('wheel', this.boundHandlers.mouseWheel as EventListener, true);
      this.canvas.removeEventListener('mouseleave', this.boundHandlers.mouseLeave as EventListener, true);
      // Note: can't remove onClickCapture because it was bound inline - that's okay, canvas cleanup will handle it
      this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextMenu as EventListener, true);
      document.removeEventListener('keydown', this.boundHandlers.keyDown as EventListener);
      document.removeEventListener('keyup', this.boundHandlers.keyUp as EventListener);
      
      // Clean up touch events
      this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart as EventListener);
      this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove as EventListener);
      this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd as EventListener);
      this.canvas.removeEventListener('touchcancel', this.boundHandlers.touchEnd as EventListener);
      
      this.canvas.style.cursor = 'default';
    }
    
    this.camera = null;
    this.target = null;
    this.canvas = null;
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
