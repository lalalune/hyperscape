/**
 * RPG Client Interaction System
 * Handles all client-side user interactions and connects them to server systems
 * - Point-and-click movement
 * - Click-to-attack combat
 * - Item pickup interactions
 * - Equipment management
 * - UI feedback
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

export class RPGClientInteractionSystem extends System {
  private controls: any;
  private camera: any;
  private scene: any;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private localPlayer: any;
  private currentTarget: any = null;
  private currentTargetType: string = '';
  private isShiftHeld = false;
  private interactionUI: any = null;
  
  // Test system data tracking
  private testData = new Map<string, any>();
  private totalClicks = 0;
  private totalMovements = 0;
  private totalCombatInitiated = 0;
  private totalItemPickups = 0;

  constructor(world: any) {
    super(world);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  async init(): Promise<void> {
    console.log('[RPGClientInteractionSystem] Registering for deferred initialization...');
    
    // Only run on client
    if (!this.world.isClient) {
      console.log('[RPGClientInteractionSystem] Server detected, skipping client system');
      return;
    }

    // Defer actual initialization to start() when player and rendering context are available
    console.log('[RPGClientInteractionSystem] Will initialize when player and rendering context are ready');
  }

  start(): void {
    // Try to initialize when system starts
    this.tryInitialize();
  }

  private tryInitialize(): void {
    // Get local player - try multiple methods
    this.localPlayer = this.world.getPlayer?.() || this.world.entities?.getLocalPlayer?.();
    if (!this.localPlayer) {
      console.log('[RPGClientInteractionSystem] Local player not yet available, retrying...');
      // Retry after a short delay
      setTimeout(() => this.tryInitialize(), 100);
      return;
    }

    // Set up camera and scene references - try multiple sources
    this.camera = this.world.camera || this.world.stage?.camera;
    this.scene = this.world.stage?.scene;
    
    if (!this.camera || !this.scene) {
      console.log('[RPGClientInteractionSystem] Camera or scene not yet available, retrying...');
      // Retry after a short delay
      setTimeout(() => this.tryInitialize(), 100);
      return;
    }

    console.log('[RPGClientInteractionSystem] Player and rendering context available, initializing...');
    console.log(`[RPGClientInteractionSystem] Local player: ${this.localPlayer.id || this.localPlayer.data?.id}`);
    console.log(`[RPGClientInteractionSystem] Camera type: ${this.camera.constructor.name}`);
    console.log(`[RPGClientInteractionSystem] Scene children: ${this.scene.children.length}`);

    // Set up event listeners
    this.setupEventListeners();
    
    // Listen for world events
    this.world.on('rpg:player:position:update', this.onPlayerPositionUpdate.bind(this));
    this.world.on('rpg:combat:session:started', this.onCombatStarted.bind(this));
    this.world.on('rpg:combat:session:ended', this.onCombatEnded.bind(this));
    this.world.on('rpg:item:spawned', this.onItemSpawned.bind(this));
    
    // Listen for avatar ready events to ensure we have proper player reference
    this.world.on('rpg:player:avatar_ready', this.onAvatarReady.bind(this));
    
    console.log('[RPGClientInteractionSystem] Client interaction system initialized successfully');
  }
  
  private onAvatarReady(data: { playerId: string; avatar: any; camHeight: number }): void {
    console.log(`[RPGClientInteractionSystem] Avatar ready for player ${data.playerId}`);
    
    // Update local player reference if needed
    if (!this.localPlayer || (this.localPlayer.id || this.localPlayer.data?.id) === data.playerId) {
      this.localPlayer = this.world.getPlayer?.() || this.world.entities?.getLocalPlayer?.();
    }
  }

  private setupEventListeners(): void {
    // Mouse click handler
    window.addEventListener('click', this.onMouseClick.bind(this), false);
    window.addEventListener('contextmenu', this.onRightClick.bind(this), false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    
    // Keyboard handlers
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
    window.addEventListener('keyup', this.onKeyUp.bind(this), false);
    
    console.log('[RPGClientInteractionSystem] Event listeners set up');
  }

  private onMouseClick(event: MouseEvent): void {
    if (!this.camera || !this.scene) return;

    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Get all intersectable objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length === 0) {
      // Click on empty ground - move player
      this.handleGroundClick(event);
      return;
    }

    const clickedObject = intersects[0];
    const userData = clickedObject.object.userData;

    console.log('[RPGClientInteractionSystem] Clicked object:', userData);

    // Determine what was clicked and handle accordingly
    if (userData.type === 'rpg_item') {
      this.handleItemClick(clickedObject, userData);
    } else if (userData.type === 'rpg_mob') {
      this.handleMobClick(clickedObject, userData);
    } else if (userData.type === 'rpg_player') {
      this.handlePlayerClick(clickedObject, userData);
    } else {
      // Unknown object or terrain - try to move
      this.handleGroundClick(event);
    }
  }

  private onRightClick(event: MouseEvent): void {
    event.preventDefault();
    
    if (!this.camera || !this.scene) return;

    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      const clickedObject = intersects[0];
      const userData = clickedObject.object.userData;

      // Handle right-click context actions
      if (userData.type === 'rpg_item') {
        this.handleItemRightClick(clickedObject, userData);
      }
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.camera || !this.scene) return;

    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    // Update cursor and highlight targets
    this.updateCursorAndHighlight(intersects);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      this.isShiftHeld = true;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      this.isShiftHeld = false;
    }
  }

  private handleGroundClick(event: MouseEvent): void {
    if (!this.localPlayer) {
      console.warn('[RPGClientInteractionSystem] No local player available for ground click');
      return;
    }

    // Calculate world position from click
    const worldPosition = this.getWorldPositionFromClick(event);
    if (!worldPosition) {
      console.warn('[RPGClientInteractionSystem] Could not determine world position from click');
      return;
    }

    const isRunning = this.isShiftHeld; // Hold shift to run

    console.log(`[RPGClientInteractionSystem] Ground click - moving to (${worldPosition.x.toFixed(2)}, ${worldPosition.z.toFixed(2)}) ${isRunning ? 'running' : 'walking'}`);

    // Track for test system
    this.totalClicks++;
    this.totalMovements++;

    // Get current player position - handle different position sources
    const playerPos = this.localPlayer.position || this.localPlayer.base?.position || { x: 0, y: 0, z: 0 };
    const playerId = this.localPlayer.id || this.localPlayer.data?.id;
    
    if (!playerId) {
      console.error('[RPGClientInteractionSystem] Player ID not found');
      return;
    }

    // Send movement request to server
    this.world.emit('rpg:movement:click_to_move', {
      playerId: playerId,
      targetPosition: {
        x: worldPosition.x,
        y: worldPosition.y,
        z: worldPosition.z
      },
      currentPosition: {
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z
      },
      isRunning: isRunning
    });

    console.log(`[RPGClientInteractionSystem] Emitted click-to-move event for player ${playerId}`);

    // Clear any current combat target
    this.clearCurrentTarget();
  }

  private handleItemClick(clickedObject: any, userData: any): void {
    if (!this.localPlayer) return;

    console.log(`[RPGClientInteractionSystem] Clicked item: ${userData.name}`);

    // Track for test system
    this.totalClicks++;
    this.totalItemPickups++;

    // Calculate distance to item
    const itemPosition = clickedObject.point;
    const playerPosition = this.localPlayer.position;
    const distance = playerPosition.distanceTo(itemPosition);

    const PICKUP_RANGE = 2.0; // meters

    if (distance <= PICKUP_RANGE) {
      // Close enough to pick up immediately
      this.world.emit('rpg:inventory:pickup_item', {
        playerId: this.localPlayer.id,
        itemId: userData.id,
        itemType: userData.itemType
      });
    } else {
      // Move closer to item first, then pick up
      this.totalMovements++;
      this.world.emit('rpg:movement:click_to_move', {
        playerId: this.localPlayer.id,
        targetPosition: {
          x: itemPosition.x,
          y: itemPosition.y,
          z: itemPosition.z
        },
        currentPosition: {
          x: playerPosition.x,
          y: playerPosition.y,
          z: playerPosition.z
        },
        isRunning: this.isShiftHeld,
        onArrival: {
          action: 'pickup_item',
          itemId: userData.id,
          itemType: userData.itemType
        }
      });
    }
  }

  private handleMobClick(clickedObject: any, userData: any): void {
    if (!this.localPlayer) return;

    console.log(`[RPGClientInteractionSystem] Clicked mob: ${userData.name || userData.id}`);

    // Track for test system
    this.totalClicks++;
    this.totalCombatInitiated++;
    this.totalMovements++;

    // Set as current target
    this.setCurrentTarget(userData.id, 'mob');

    // Start combat with the mob
    this.world.emit('rpg:combat:start_attack', {
      attackerId: this.localPlayer.id,
      targetId: userData.id,
      attackStyle: 'accurate' // Default attack style for MVP
    });

    // Move into range if needed (combat system will handle range checking)
    const mobPosition = clickedObject.point;
    const playerPosition = this.localPlayer.position;
    
    this.world.emit('rpg:movement:click_to_move', {
      playerId: this.localPlayer.id,
      targetPosition: {
        x: mobPosition.x,
        y: mobPosition.y,
        z: mobPosition.z
      },
      currentPosition: {
        x: playerPosition.x,
        y: playerPosition.y,
        z: playerPosition.z
      },
      isRunning: this.isShiftHeld,
      onArrival: {
        action: 'start_combat',
        targetId: userData.id
      }
    });
  }

  private handlePlayerClick(clickedObject: any, userData: any): void {
    if (!this.localPlayer) return;
    
    console.log(`[RPGClientInteractionSystem] Clicked player: ${userData.name || userData.id}`);
    
    // Track for test system
    this.totalClicks++;
    this.totalMovements++;
    
    // For MVP, we don't have PvP, so just move toward the player (follow)
    const targetPosition = clickedObject.point;
    const playerPosition = this.localPlayer.position;
    
    this.world.emit('rpg:movement:click_to_move', {
      playerId: this.localPlayer.id,
      targetPosition: {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z
      },
      currentPosition: {
        x: playerPosition.x,
        y: playerPosition.y,
        z: playerPosition.z
      },
      isRunning: this.isShiftHeld
    });
  }

  private handleItemRightClick(clickedObject: any, userData: any): void {
    console.log(`[RPGClientInteractionSystem] Right-clicked item: ${userData.name}`);
    
    // Show context menu for item (examine, pick up, etc.)
    this.showItemContextMenu(userData, clickedObject.point);
  }

  private getWorldPositionFromClick(event: MouseEvent): THREE.Vector3 | null {
    if (!this.camera || !this.scene) return null;

    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Create a ray from camera through mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // First try to intersect with terrain and world objects
    const intersectableObjects = this.scene.children.filter((child: any) => {
      // Include terrain, ground, and walkable surfaces
      return child.userData?.type === 'terrain' || 
             child.userData?.type === 'ground' ||
             child.userData?.walkable === true ||
             child.userData?.clickable !== false ||
             (child.name && (child.name.includes('terrain') || child.name.includes('ground') || child.name.includes('Terrain')));
    });

    // Log available objects for debugging
    if (intersectableObjects.length === 0) {
      console.log('[RPGClientInteractionSystem] No terrain objects found. Scene children:', 
        this.scene.children.map((child: any) => ({ 
          name: child.name, 
          type: child.type, 
          userData: child.userData 
        })).slice(0, 10) // Limit to first 10 for readability
      );
    }

    if (intersectableObjects.length > 0) {
      const intersects = this.raycaster.intersectObjects(intersectableObjects, true);
      if (intersects.length > 0) {
        // Return the first intersection point as THREE.Vector3
        const point = intersects[0].point;
        console.log(`[RPGClientInteractionSystem] Terrain intersection at (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})`);
        return new THREE.Vector3(point.x, point.y, point.z);
      }
    }

    // Fallback: Intersect with a ground plane at y = 0
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const worldPosition = new THREE.Vector3();
    
    if (this.raycaster.ray.intersectPlane(groundPlane, worldPosition)) {
      console.log(`[RPGClientInteractionSystem] Using fallback ground plane for click position: (${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)}, ${worldPosition.z.toFixed(2)})`);
      return worldPosition;
    }

    console.warn('[RPGClientInteractionSystem] Could not determine world position from click');
    return null;
  }

  private updateCursorAndHighlight(intersects: THREE.Intersection[]): void {
    // Clear previous target highlight
    this.clearTargetHighlight();

    if (intersects.length === 0) {
      document.body.style.cursor = 'default';
      return;
    }

    const topObject = intersects[0];
    const userData = topObject.object.userData;

    // Update cursor based on what we're hovering over
    if (userData.type === 'rpg_item') {
      document.body.style.cursor = 'pointer';
      this.highlightTarget(topObject.object, 'item');
    } else if (userData.type === 'rpg_mob') {
      document.body.style.cursor = 'crosshair';
      this.highlightTarget(topObject.object, 'enemy');
    } else if (userData.type === 'rpg_player') {
      document.body.style.cursor = 'help';
      this.highlightTarget(topObject.object, 'player');
    } else {
      document.body.style.cursor = 'default';
    }
  }

  private highlightTarget(object: THREE.Object3D, type: string): void {
    // Add visual highlight to target
    // This is a simple implementation - could be enhanced with outline effects
    if (object instanceof THREE.Mesh && object.material) {
      const material = object.material as any;
      if (material.emissive) {
        material.emissive = this.getHighlightColor(type);
      }
    }
  }

  private clearTargetHighlight(): void {
    // Clear all highlights - simple implementation
    // In production, would track highlighted objects more carefully
  }

  private getHighlightColor(type: string): THREE.Color {
    switch (type) {
      case 'item': return new THREE.Color(0x00ff00); // Green for items
      case 'enemy': return new THREE.Color(0xff0000); // Red for enemies
      case 'player': return new THREE.Color(0x0000ff); // Blue for players
      default: return new THREE.Color(0xffffff); // White default
    }
  }

  private setCurrentTarget(targetId: string, targetType: string): void {
    this.currentTarget = targetId;
    this.currentTargetType = targetType;
    
    // Update UI to show current target
    this.updateTargetUI();
  }

  private clearCurrentTarget(): void {
    this.currentTarget = null;
    this.currentTargetType = '';
    
    // Clear target UI
    this.updateTargetUI();
  }

  private updateTargetUI(): void {
    // Update UI elements to show current target
    // This would integrate with the UI system
    if (this.currentTarget) {
      console.log(`[RPGClientInteractionSystem] Current target: ${this.currentTarget} (${this.currentTargetType})`);
    }
  }

  private showItemContextMenu(userData: any, position: THREE.Vector3): void {
    console.log(`[RPGClientInteractionSystem] Showing context menu for ${userData.name}`);
    
    // Create simple context menu
    // This is a basic implementation - would be enhanced with proper UI
    const actions = [
      { label: 'Examine', action: () => this.examineItem(userData) },
      { label: 'Pick Up', action: () => this.pickupItem(userData) }
    ];
    
    // For now, just log the available actions
    console.log('[RPGClientInteractionSystem] Available actions:', actions.map(a => a.label));
  }

  private examineItem(userData: any): void {
    console.log(`[RPGClientInteractionSystem] Examining ${userData.name}`);
    
    // Send examine request to server for detailed info
    this.world.emit('rpg:item:examine', {
      playerId: this.localPlayer.id,
      itemId: userData.id
    });
  }

  private pickupItem(userData: any): void {
    console.log(`[RPGClientInteractionSystem] Attempting to pick up ${userData.name}`);
    
    this.world.emit('rpg:inventory:pickup_item', {
      playerId: this.localPlayer.id,
      itemId: userData.id,
      itemType: userData.itemType
    });
  }

  // Event handlers for world events
  private onPlayerPositionUpdate(data: any): void {
    if (data.entityId === this.localPlayer?.id) {
      // Update local player position reference
      // This helps with distance calculations
    }
  }

  private onCombatStarted(data: any): void {
    if (data.attackerId === this.localPlayer?.id) {
      console.log(`[RPGClientInteractionSystem] Combat started with ${data.targetId}`);
      this.setCurrentTarget(data.targetId, 'combat');
    }
  }

  private onCombatEnded(data: any): void {
    if (data.attackerId === this.localPlayer?.id) {
      console.log(`[RPGClientInteractionSystem] Combat ended`);
      this.clearCurrentTarget();
    }
  }

  private onItemSpawned(data: any): void {
    console.log(`[RPGClientInteractionSystem] Item spawned: ${data.config?.name} at (${data.position.x}, ${data.position.y}, ${data.position.z})`);
    
    // Items are automatically made interactive by the ItemSpawnerSystem
    // This handler could be used for UI notifications or sound effects
  }

  // Public API
  getCurrentTarget(): { id: string; type: string } | null {
    if (this.currentTarget) {
      return { id: this.currentTarget, type: this.currentTargetType };
    }
    return null;
  }

  isInCombat(): boolean {
    return this.currentTargetType === 'combat';
  }

  // System lifecycle methods
  update(dt: number): void {
    // Update interaction system
    // Could handle continuous actions like following targets
  }

  destroy(): void {
    // Clean up event listeners
    window.removeEventListener('click', this.onMouseClick.bind(this));
    window.removeEventListener('contextmenu', this.onRightClick.bind(this));
    window.removeEventListener('mousemove', this.onMouseMove.bind(this));
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    
    console.log('[RPGClientInteractionSystem] System destroyed');
  }

  // System rating method for test framework
  getSystemRating(): { rating: 'excellent' | 'good' | 'basic'; coverage: number; details: string } {
    const totalInteractions = this.totalClicks + this.totalMovements + this.totalCombatInitiated + this.totalItemPickups;
    
    if (totalInteractions >= 10 && this.totalMovements >= 3 && this.totalCombatInitiated >= 1) {
      return {
        rating: 'excellent',
        coverage: 100,
        details: `Complete client interaction system with ${totalInteractions} total interactions: ${this.totalClicks} clicks, ${this.totalMovements} movements, ${this.totalCombatInitiated} combat sessions, ${this.totalItemPickups} item pickups`
      };
    } else if (totalInteractions >= 5) {
      return {
        rating: 'good',
        coverage: 75,
        details: `Functional client interaction system with ${totalInteractions} interactions recorded`
      };
    } else {
      return {
        rating: 'basic',
        coverage: 50,
        details: `Basic client interaction system with ${totalInteractions} interactions recorded`
      };
    }
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