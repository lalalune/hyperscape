import { System } from './System';
import type { World } from '../World';
import * as THREE from 'three';

const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

/**
 * InteractionSystem - Handles click-to-move with visual feedback
 */
export class InteractionSystem extends System {
  private canvas: HTMLCanvasElement | null = null;
  private targetMarker: THREE.Mesh | null = null;
  private targetPosition: THREE.Vector3 | null = null;
  private isDragging: boolean = false;
  private mouseDownButton: number | null = null;
  private mouseDownClientPos: { x: number; y: number } | null = null;
  private readonly dragThresholdPx: number = 5;
  private readonly maxClickDistance: number = 100;
  
  constructor(world: World) {
    super(world);
  }
  
  override start(): void {
    this.canvas = this.world.graphics?.renderer?.domElement ?? null;
    if (!this.canvas) return;
    
    // Bind once so we can remove correctly on destroy
    this.onCanvasClick = this.onCanvasClick.bind(this);
    this.onRightClick = this.onRightClick.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    
    // Use regular bubbling phase (false) so resource clicks can prevent movement
    // ResourceInteractionSystem uses capture phase, so it runs first
    this.canvas.addEventListener('click', this.onCanvasClick, false);
    this.canvas.addEventListener('contextmenu', this.onRightClick, false);
    this.canvas.addEventListener('mousemove', this.onMouseMove, false);
    this.canvas.addEventListener('mousedown', this.onMouseDown, false);
    this.canvas.addEventListener('mouseup', this.onMouseUp, false);
    
    // Listen for camera tap events on mobile
    this.world.on('camera:tap', this.onCameraTap);
    
    // Create target marker (visual indicator)
    this.createTargetMarker();
    
    console.log('[InteractionSystem] Click-to-move enabled with visual feedback');
  }
  
  private createTargetMarker(): void {
    // Create a circle marker for the target position
    const geometry = new THREE.RingGeometry(0.3, 0.5, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.targetMarker = new THREE.Mesh(geometry, material);
    this.targetMarker.rotation.x = -Math.PI / 2; // Lay flat on ground
    this.targetMarker.position.y = 0.01; // Slightly above ground to avoid z-fighting
    this.targetMarker.visible = false;
    
    const scene = this.world.stage?.scene;
    if (scene) {
      scene.add(this.targetMarker);
    }
  }
  
  private onRightClick = (event: MouseEvent): void => {
    event.preventDefault();
    // If user dragged with RMB (orbit gesture for camera), suppress context action
    // AND don't cancel movement - camera rotation should not stop movement
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
    // This allows right-click context menus while stopping movement
    this.clearTarget();
  };
  
  private onCameraTap = (event: { x: number, y: number }): void => {
    if (!this.canvas || !this.world.camera) return;
    
    // Calculate mouse position
    const rect = this.canvas.getBoundingClientRect();
    _mouse.x = ((event.x - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((event.y - rect.top) / rect.height) * 2 + 1;
    
    this.handleMoveRequest(_mouse);
  }
  
  private clearTarget(): void {
    if (this.targetMarker) {
      this.targetMarker.visible = false;
    }
    this.targetPosition = null;
    
    // Send cancel movement to server
    if (this.world.network?.send) {
      this.world.network.send('moveRequest', {
        target: null,
        cancel: true
      });
    }
    console.log('[InteractionSystem] Movement cancelled');
  }
  
  private onCanvasClick = (event: MouseEvent): void => {
    // If a drag just ended, the camera system will have suppressed this click
    if (event.defaultPrevented) return;
    
    if (event.button !== 0) return; // Left click only
    if (!this.canvas || !this.world.camera) return;
    
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

    // Raycast to find click position
    _raycaster.setFromCamera(_mouse, this.world.camera);
    
    // Raycast against full scene to find terrain sooner; fallback to infinite ground plane
    const scene = this.world.stage?.scene;
    let target: THREE.Vector3 | null = null;
    if (scene) {
      const intersects = _raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        target = intersects[0].point.clone();
      }
    }
    if (!target) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      target = new THREE.Vector3();
      _raycaster.ray.intersectPlane(plane, target);
    }
    
    if (target) {
      console.log(`[InteractionSystem] Click at (${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`);
      
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
          target = new THREE.Vector3(p.x + flatDir.x, target.y, p.z + flatDir.z);
        }
      }

      // Update target position and show NEW marker
      this.targetPosition = target.clone();
      if (this.targetMarker) {
        this.targetMarker.position.set(target.x, target.y + 0.01, target.z);
        this.targetMarker.visible = true;
      }
      
      // ONLY send move request to server - no local movement!
      // Server is completely authoritative for movement
      if (this.world.network?.send) {
        // Cancel any previous movement first to ensure server resets pathing
        try { this.world.network.send('moveRequest', { target: null, cancel: true }) } catch {}
        // Read player's runMode toggle if available; otherwise, use shift key status
        let runMode = isShiftDown;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const player = (this.world as any).entities?.player as { runMode?: boolean };
          if (player && typeof player.runMode === 'boolean') {
            runMode = player.runMode;
          }
        } catch (_e) {}
        this.world.network.send('moveRequest', {
          target: [target.x, target.y, target.z],
          runMode,
          cancel: false  // Explicitly not cancelling
        });
        console.log('[InteractionSystem] Sent move request to server (server-authoritative)');
      }
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.canvas) return;
    if (this.mouseDownButton === null || !this.mouseDownClientPos) return;
    const dx = event.clientX - this.mouseDownClientPos.x;
    const dy = event.clientY - this.mouseDownClientPos.y;
    if (!this.isDragging && (Math.abs(dx) > this.dragThresholdPx || Math.abs(dy) > this.dragThresholdPx)) {
      this.isDragging = true;
    }
  };

  private onMouseDown = (event: MouseEvent): void => {
    this.isDragging = false;
    this.mouseDownButton = event.button;
    this.mouseDownClientPos = { x: event.clientX, y: event.clientY };
  };

  private onMouseUp = (_event: MouseEvent): void => {
    this.isDragging = false;
    this.mouseDownButton = null;
    this.mouseDownClientPos = null;
  };
  
  override update(): void {
    // Animate target marker
    if (this.targetMarker && this.targetMarker.visible) {
      const time = Date.now() * 0.001;
      // Pulse effect
      const scale = 1 + Math.sin(time * 4) * 0.1;
      this.targetMarker.scale.set(scale, scale, scale);
      // Rotation effect
      this.targetMarker.rotation.z = time * 2;
      
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
  
  override destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onCanvasClick);
      this.canvas.removeEventListener('contextmenu', this.onRightClick);
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('mouseup', this.onMouseUp);
    }
    this.world.off('camera:tap', this.onCameraTap);
    const scene = this.world.stage?.scene;
    if (this.targetMarker && scene) {
      scene.remove(this.targetMarker);
      this.targetMarker.geometry.dispose();
      (this.targetMarker.material as THREE.Material).dispose();
    }
  }
}
