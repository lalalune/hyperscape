/**
 * RPG Camera System
 * Overrides default Hyperfy camera controls with MMORPG-style controls:
 * - Right-click drag to rotate camera around player
 * - Mouse wheel to zoom in/out
 * - Middle mouse button drag to pan
 * - Smooth camera following
 * - Collision avoidance
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

interface PlayerTarget extends THREE.Object3D {
  base?: THREE.Object3D;
  playerId?: string;
  data?: { id: string };
}

export class RPGCameraSystem extends System {
  private camera: THREE.PerspectiveCamera | null = null;
  private target: PlayerTarget | null = null; // Player to follow
  private canvas: HTMLCanvasElement | null = null;
  
  // Camera state
  private spherical = new THREE.Spherical();
  private targetPosition = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();
  private lookAtTarget = new THREE.Vector3();
  
  // Control settings
  private readonly MIN_DISTANCE = 3;
  private readonly MAX_DISTANCE = 20;
  private readonly MIN_POLAR_ANGLE = Math.PI * 0.1; // 18 degrees from top
  private readonly MAX_POLAR_ANGLE = Math.PI * 0.8; // 144 degrees from top
  private readonly ROTATE_SPEED = 1.0;
  private readonly ZOOM_SPEED = 1.0;
  private readonly PAN_SPEED = 2.0;
  private readonly DAMPING_FACTOR = 0.05;
  
  // Mouse state
  private isRightMouseDown = false;
  private isMiddleMouseDown = false;
  private mouseLastPosition = new THREE.Vector2();
  private mouseDelta = new THREE.Vector2();
  
  // Camera offset from target
  private cameraOffset = new THREE.Vector3(0, 2, 0); // Look at point above player
  
  // Collision detection
  private raycaster = new THREE.Raycaster();
  
  // Bound event handlers for proper cleanup
  private boundHandlers = {
    contextMenu: (e: Event) => e.preventDefault(),
    mouseDown: this.onMouseDown.bind(this),
    mouseMove: this.onMouseMove.bind(this),
    mouseUp: this.onMouseUp.bind(this),
    mouseWheel: this.onMouseWheel.bind(this),
    mouseLeave: this.onMouseLeave.bind(this),
    keyDown: this.onKeyDown.bind(this)
  };

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGCameraSystem] Registering for deferred initialization...');
    
    // Only run on client
    if (!this.world.isClient) {
      console.log('[RPGCameraSystem] Server detected, skipping client-only camera system');
      return;
    }

    // Defer actual initialization to start() when camera and canvas are available
    console.log('[RPGCameraSystem] Will initialize when camera and canvas are ready');
  }

  start(): void {
    // Try to initialize when system starts
    this.tryInitialize();
  }

  private tryInitialize(): void {
    // Get camera from world rig instead of stage for RPG mode
    this.camera = this.world.camera || this.world.stage?.camera as THREE.PerspectiveCamera;
    this.canvas = (this.world as any).graphics?.renderer?.domElement;

    if (!this.camera || !this.canvas) {
      console.log('[RPGCameraSystem] Camera or canvas not yet available, retrying...');
      // Retry after a short delay
      setTimeout(() => this.tryInitialize(), 100);
      return;
    }

    console.log('[RPGCameraSystem] Camera and canvas available, initializing...');

    // Initialize camera position with reasonable defaults for MMORPG
    this.spherical.radius = 6; // Start at medium distance
    this.spherical.theta = 0; // Start facing forward
    this.spherical.phi = Math.PI * 0.3; // Start at 54 degrees from top (good overhead angle)

    // Set up event listeners
    this.setupEventListeners();
    
    // Listen for player and avatar events
    this.world.on?.('rpg:camera:follow_player', this.setTarget.bind(this));
    this.world.on?.('rpg:player:avatar_ready', this.onAvatarReady.bind(this));
    
    // Disable pointer lock for RPG mode and take control
    const controls = (this.world as any).controls;
    if (controls) {
      if (controls.unlockPointer) {
        controls.unlockPointer();
        console.log('[RPGCameraSystem] Pointer lock disabled for RPG mode');
      }
      
      // Disable default camera controls by setting lower priority
      const playerControl = controls.controls?.[0]; // Usually player control is first
      if (playerControl && playerControl.camera) {
        playerControl.camera.write = false; // Disable default camera writing
        console.log('[RPGCameraSystem] Disabled default camera controls');
      }
    }
    
    console.log('[RPGCameraSystem] Camera system initialized successfully');
    
    // Try to follow local player
    const localPlayer = this.world.getPlayer?.();
    if (localPlayer) {
      this.setTarget({ player: localPlayer });
    }
  }
  
  private onAvatarReady(data: { playerId: string; avatar: any; camHeight: number; isFallback?: boolean }): void {
    console.log(`[RPGCameraSystem] Avatar ready for player ${data.playerId}, camHeight: ${data.camHeight}`);
    
    // Adjust camera offset based on avatar height
    this.cameraOffset.y = data.camHeight || 1.6;
    
    // If this is the local player and we don't have a target yet, follow them
    const localPlayer = this.world.getPlayer?.();
    if (localPlayer && data.playerId === localPlayer.id && !this.target) {
      this.setTarget({ player: localPlayer });
    }
  }

  /**
   * Set up mouse and keyboard event listeners
   */
  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Disable default context menu on right click
    this.canvas.addEventListener('contextmenu', this.boundHandlers.contextMenu);
    
    // Mouse events
    this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
    this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove);
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp);
    this.canvas.addEventListener('wheel', this.boundHandlers.mouseWheel);
    
    // Handle mouse leaving canvas
    this.canvas.addEventListener('mouseleave', this.boundHandlers.mouseLeave);
    
    // Keyboard events for camera reset
    document.addEventListener('keydown', this.boundHandlers.keyDown);
  }

  /**
   * Handle mouse down events
   */
  private onMouseDown(event: MouseEvent): void {
    if (event.button === 2) { // Right mouse button
      this.isRightMouseDown = true;
      this.canvas!.style.cursor = 'grabbing';
    } else if (event.button === 1) { // Middle mouse button
      this.isMiddleMouseDown = true;
      this.canvas!.style.cursor = 'move';
      event.preventDefault(); // Prevent default middle mouse behavior
    }

    this.mouseLastPosition.set(event.clientX, event.clientY);
  }

  /**
   * Handle mouse move events
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.isRightMouseDown && !this.isMiddleMouseDown) return;

    this.mouseDelta.set(
      event.clientX - this.mouseLastPosition.x,
      event.clientY - this.mouseLastPosition.y
    );

    if (this.isRightMouseDown) {
      // Rotate camera around target
      this.spherical.theta -= this.mouseDelta.x * this.ROTATE_SPEED * 0.01;
      this.spherical.phi += this.mouseDelta.y * this.ROTATE_SPEED * 0.01;
      
      // Clamp phi to prevent camera flipping
      this.spherical.phi = Math.max(this.MIN_POLAR_ANGLE, Math.min(this.MAX_POLAR_ANGLE, this.spherical.phi));
    }

    if (this.isMiddleMouseDown) {
      // Pan camera (move target position)
      this.panCamera(this.mouseDelta.x, this.mouseDelta.y);
    }

    this.mouseLastPosition.set(event.clientX, event.clientY);
  }

  /**
   * Handle mouse up events
   */
  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2 || this.isRightMouseDown) {
      this.isRightMouseDown = false;
    }
    if (event.button === 1 || this.isMiddleMouseDown) {
      this.isMiddleMouseDown = false;
    }

    if (!this.isRightMouseDown && !this.isMiddleMouseDown) {
      this.canvas!.style.cursor = 'default';
    }
  }

  /**
   * Handle mouse wheel for zooming
   */
  private onMouseWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const zoomDelta = event.deltaY * this.ZOOM_SPEED * 0.001;
    this.spherical.radius += zoomDelta;
    
    // Clamp zoom distance
    this.spherical.radius = Math.max(this.MIN_DISTANCE, Math.min(this.MAX_DISTANCE, this.spherical.radius));
  }

  /**
   * Handle keyboard events
   */
  private onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'Home':
      case 'NumpadHome':
        // Reset camera to default position behind player
        this.resetCamera();
        event.preventDefault();
        break;
    }
  }

  /**
   * Handle mouse leaving canvas - separate handler for proper cleanup
   */
  private onMouseLeave(event: MouseEvent): void {
    // Reset all mouse states when leaving canvas
    if (this.isRightMouseDown || this.isMiddleMouseDown) {
      this.isRightMouseDown = false;
      this.isMiddleMouseDown = false;
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  /**
   * Pan camera by moving the target position
   */
  private panCamera(deltaX: number, deltaY: number): void {
    if (!this.camera || !this.target) return;

    // Calculate pan vector in camera space
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    
    cameraRight.setFromMatrixColumn(this.camera.matrix, 0); // Right vector
    cameraUp.setFromMatrixColumn(this.camera.matrix, 1);    // Up vector
    
    // Apply pan
    const panVector = new THREE.Vector3();
    panVector.addScaledVector(cameraRight, -deltaX * this.PAN_SPEED * 0.01);
    panVector.addScaledVector(cameraUp, deltaY * this.PAN_SPEED * 0.01);
    
    this.cameraOffset.add(panVector);
  }

  /**
   * Reset camera to default position
   */
  private resetCamera(): void {
    if (!this.target) return;

    // Reset to default spherical coordinates
    this.spherical.radius = 8;
    this.spherical.theta = 0;
    this.spherical.phi = Math.PI * 0.4; // 72 degrees from top
    
    // Reset offset
    this.cameraOffset.set(0, 2, 0);
    
    console.log('[RPGCameraSystem] Camera reset to default position');
  }

  /**
   * Set target to follow (usually the player)
   */
  private setTarget(data: { player: any }): void {
    this.target = data.player;
    console.log(`[RPGCameraSystem] Now following player: ${data.player?.playerId || data.player?.data?.id || 'unknown'}`);
    
    // If we have a target, initialize camera position relative to it
    if (this.target) {
      const targetPos = this.target.position || this.target.base?.position;
      if (targetPos) {
        // Set initial camera position
        this.targetPosition.copy(targetPos);
        this.targetPosition.add(this.cameraOffset);
        
        this.cameraPosition.setFromSpherical(this.spherical);
        this.cameraPosition.add(this.targetPosition);
        
        if (this.camera) {
          this.camera.position.copy(this.cameraPosition);
          this.camera.lookAt(targetPos);
          this.camera.updateMatrixWorld();
        }
      }
    }
  }

  /**
   * Update camera position and rotation
   */
  update(deltaTime: number): void {
    if (!this.camera || !this.target) return;

    // Get target position - handle both Vector3 and object with position property
    const targetPos = this.target.position || this.target.base?.position || this.target;
    if (!targetPos) return;

    // Calculate target position (player position + offset)
    this.targetPosition.copy(targetPos);
    this.targetPosition.add(this.cameraOffset);

    // Calculate camera position from spherical coordinates
    this.cameraPosition.setFromSpherical(this.spherical);
    this.cameraPosition.add(this.targetPosition);

    // Check for collisions and adjust camera position
    this.handleCameraCollisions();

    // Calculate look-at target (slightly above player)
    this.lookAtTarget.copy(targetPos);
    this.lookAtTarget.y += 1.7; // Look at head level

    // Smooth camera movement with damping
    this.camera.position.lerp(this.cameraPosition, this.DAMPING_FACTOR);
    this.camera.lookAt(this.lookAtTarget);
    
    // Update world rig position to match our camera for consistency
    if (this.world.rig) {
      this.world.rig.position.copy(this.camera.position);
      this.world.rig.quaternion.copy(this.camera.quaternion);
    }
    
    // Update camera matrix
    this.camera.updateMatrixWorld();
  }

  /**
   * Handle camera collisions with world geometry
   */
  private handleCameraCollisions(): void {
    if (!this.camera || !this.target) return;

    // Cast ray from target to desired camera position
    const direction = new THREE.Vector3();
    direction.subVectors(this.cameraPosition, this.targetPosition).normalize();
    
    this.raycaster.set(this.targetPosition, direction);
    
    // Get world geometry for collision testing
    const worldObjects = this.world.stage?.scene?.children.filter((child: any) => 
      child.userData?.collision === true || 
      child.userData?.type === 'terrain' ||
      child.userData?.type === 'building'
    ) || [];
    
    if (worldObjects.length > 0) {
      const intersects = this.raycaster.intersectObjects(worldObjects, true);
      
      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitDistance = hit.distance;
        const desiredDistance = this.spherical.radius;
        
        if (hitDistance < desiredDistance) {
          // Adjust camera position to avoid collision
          const safeDistance = Math.max(hitDistance - 0.5, this.MIN_DISTANCE);
          this.cameraPosition.copy(this.targetPosition);
          this.cameraPosition.addScaledVector(direction, safeDistance);
        }
      }
    }
  }

  /**
   * Get current camera configuration for debugging
   */
  getCameraInfo(): any {
    return {
      target: this.target?.playerId || null,
      spherical: {
        radius: this.spherical.radius,
        theta: this.spherical.theta,
        phi: this.spherical.phi
      },
      offset: this.cameraOffset.toArray(),
      position: this.camera?.position.toArray() || null,
      isControlling: this.isRightMouseDown || this.isMiddleMouseDown
    };
  }

  /**
   * Enable/disable camera system
   */
  setEnabled(enabled: boolean): void {
    if (enabled) {
      console.log('[RPGCameraSystem] Camera system enabled');
    } else {
      console.log('[RPGCameraSystem] Camera system disabled');
      this.isRightMouseDown = false;
      this.isMiddleMouseDown = false;
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  destroy(): void {
    // Remove event listeners properly using stored references
    if (this.canvas) {
      this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextMenu);
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
      this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove);
      this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp);
      this.canvas.removeEventListener('wheel', this.boundHandlers.mouseWheel);
      this.canvas.removeEventListener('mouseleave', this.boundHandlers.mouseLeave);
      this.canvas.style.cursor = 'default';
    }
    
    document.removeEventListener('keydown', this.boundHandlers.keyDown);
    
    // Clear references
    this.camera = null;
    this.target = null;
    this.canvas = null;
    
    console.log('[RPGCameraSystem] System destroyed and cleaned up');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}