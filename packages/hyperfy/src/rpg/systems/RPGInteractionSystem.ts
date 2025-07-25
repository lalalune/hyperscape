/**
 * RPG Interaction System
 * Comprehensive interaction system with raycasting and DOM-based UI
 * - Mouse hover detection and highlighting
 * - Click handlers for different interaction types
 * - Visual feedback (cursors, outlines, tooltips)
 * - Integration with movement system for click-to-move
 * - Action menus for complex interactions
 * - DOM-based UI instead of Three.js UI nodes
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

interface InteractableEntity {
  id: string;
  object: THREE.Object3D;
  type: 'attack' | 'pickup' | 'talk' | 'gather' | 'use' | 'move' | 'mob' | 'item' | 'resource' | 'npc';
  distance: number;
  description: string;
  name: string;
  level?: number;
  health?: number;
  maxHealth?: number;
  actions: InteractionAction[];
  app?: any; // Reference to RPGApp if applicable
}

interface InteractionAction {
  id: string;
  label: string;
  icon?: string;
  enabled: boolean;
  distance?: number;
  callback: () => void;
}

interface InteractionHover {
  entity: InteractableEntity;
  originalMaterial?: THREE.Material | THREE.Material[] | null;
}

export interface InteractionSystemEvents {
  'interaction:attack': { targetId: string; targetType: string }
  'interaction:gather': { targetId: string; resourceType: string; tool?: string }
  'interaction:loot': { targetId: string }
  'interaction:talk': { targetId: string }
  'interaction:pickup': { targetId: string }
  'interaction:use': { targetId: string; itemId: string }
}

export class RPGInteractionSystem extends System {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  
  // Interaction state
  private hoveredEntity: InteractableEntity | null = null;
  private selectedEntity: InteractableEntity | null = null;
  private interactables = new Map<string, InteractableEntity>();
  private isDragging = false;
  private actionMenu: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  
  // Mouse tracking
  private mousePosition = { x: 0, y: 0 };
  private lastClickTime = 0;
  private doubleClickThreshold = 300; // ms
  
  // Test system data tracking (merged from RPGClientInteractionSystem)
  private testData = new Map<string, any>();
  private totalClicks = 0;
  private totalMovements = 0;
  private totalCombatInitiated = 0;
  private totalItemPickups = 0;
  private isShiftHeld = false;
  
  // Menu and hover state
  private isMenuOpen = false;
  private currentHover: InteractionHover | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  // Visual feedback materials
  private highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.3,
    depthTest: false
  });
  
  private attackHighlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.4,
    depthTest: false
  });

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGInteractionSystem] Registering for deferred initialization...');
    
    // Only run on client
    if (!this.world.isClient) {
      console.log('[RPGInteractionSystem] Server detected, skipping client-only interaction system');
      return;
    }

    // Defer actual initialization to start() when rendering context is available
    console.log('[RPGInteractionSystem] Will initialize when rendering context is ready');
  }

  start(): void {
    // Try to initialize when system starts
    this.tryInitialize();
  }

  private tryInitialize(): void {
    // Get rendering context
    this.scene = this.world.stage?.scene;
    this.camera = this.world.stage?.camera;
    this.canvas = (this.world as any).graphics?.renderer?.domElement;

    if (!this.scene || !this.camera || !this.canvas) {
      console.log('[RPGInteractionSystem] Rendering context not yet available, retrying...');
      // Retry after a short delay
      setTimeout(() => this.tryInitialize(), 100);
      return;
    }

    console.log('[RPGInteractionSystem] Rendering context available, initializing...');

    // Initialize DOM elements
    this.initializeDOMElements();

    // Set up event listeners
    this.setupEventListeners();
    
    // Listen for interaction events
    this.world.on?.('rpg:interaction:register', this.registerInteractable.bind(this));
    this.world.on?.('rpg:interaction:unregister', this.unregisterInteractable.bind(this));
    
    console.log('[RPGInteractionSystem] Interaction system initialized successfully');
  }

  /**
   * Initialize DOM elements for action menu
   */
  private initializeDOMElements(): void {
    // Create action menu container
    this.actionMenu = document.createElement('div');
    this.actionMenu.id = 'rpg-action-menu';
    this.actionMenu.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #8B4513;
      border-radius: 8px;
      padding: 8px;
      z-index: 1000;
      display: none;
      min-width: 120px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #FFD700;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(this.actionMenu);

    // Add CSS for action buttons
    const style = document.createElement('style');
    style.textContent = `
      .rpg-action-button {
        display: block;
        width: 100%;
        padding: 6px 12px;
        margin: 2px 0;
        background: transparent;
        border: 1px solid #8B4513;
        border-radius: 4px;
        color: #FFD700;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .rpg-action-button:hover {
        background: rgba(139, 69, 19, 0.3);
        border-color: #FFD700;
        color: #FFFFFF;
      }
      
      .rpg-action-button:disabled {
        color: #666;
        border-color: #444;
        cursor: not-allowed;
      }
      
      .rpg-action-button:disabled:hover {
        background: transparent;
        border-color: #444;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Set up mouse and keyboard event listeners
   */
  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Mouse events
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('click', this.onClick.bind(this));
    this.canvas.addEventListener('contextmenu', this.onRightClick.bind(this));
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    
    // Prevent default context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Close menu on escape
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isMenuOpen) {
        this.closeActionMenu();
      }
    });

    // Close menu on click outside
    document.addEventListener('click', (event) => {
      if (this.isMenuOpen && !this.actionMenu?.contains(event.target as Node)) {
        this.closeActionMenu();
      }
    });
    
    // Update cursor based on hover
    this.canvas.addEventListener('mouseenter', () => {
      document.body.style.cursor = 'default';
    });
  }

  /**
   * Handle mouse movement for hover detection
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.canvas || !this.camera || !this.scene) return;

    // Calculate mouse position in normalized device coordinates
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Find intersections with interactable objects
    const interactableObjects = Array.from(this.interactables.values()).map(e => e.object);
    const intersects = this.raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      // Find the closest interactable
      for (const intersect of intersects) {
        const entity = this.findEntityByObject(intersect.object);
        if (entity && intersect.distance <= entity.distance) {
          this.setHover(entity);
          this.updateCursor(entity.type);
          return;
        }
      }
    }

    // No valid intersection found
    this.clearHover();
    this.updateCursor('default');
  }

  /**
   * Handle mouse click for interactions
   */
  private onClick(event: MouseEvent): void {
    console.log('[RPGInteractionSystem] Click detected');
    
    // Track total clicks for test system
    this.totalClicks++;
    
    // Update mouse position
    this.updateMousePosition(event);

    // Close action menu if open
    if (this.isMenuOpen) {
      this.closeActionMenu();
      return;
    }

    if (!this.currentHover) {
      // Click on empty space - trigger movement
      this.handleMovementClick(event);
      return;
    }

    const entity = this.currentHover.entity;
    console.log(`[RPGInteractionSystem] Clicked on ${entity.description} (${entity.type})`);

    // For left click, perform primary action if available
    const primaryAction = entity.actions.find(action => action.enabled);
    if (primaryAction) {
      primaryAction.callback();
    } else {
      // Fallback to legacy interaction handling
      this.handleLegacyInteraction(entity);
    }
  }

  /**
   * Handle right click for action menu
   */
  private onRightClick(event: MouseEvent): void {
    event.preventDefault();
    
    this.updateMousePosition(event);
    const target = this.performRaycast();

    if (target && target.actions.length > 0) {
      this.showActionMenu(target, event.clientX, event.clientY);
    } else {
      this.closeActionMenu();
    }
  }

  /**
   * Handle mouse down events
   */
  private onMouseDown(event: MouseEvent): void {
    // Can be used for drag detection or other mouse down specific logic
    this.isDragging = false;
  }

  /**
   * Handle mouse up events
   */
  private onMouseUp(event: MouseEvent): void {
    // Reset dragging state
    this.isDragging = false;
  }

  /**
   * Update mouse position in normalized device coordinates
   */
  private updateMousePosition(event: MouseEvent): void {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Perform raycast and return the closest interactable entity
   */
  private performRaycast(): InteractableEntity | null {
    if (!this.camera || !this.scene) return null;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get all interactable objects
    const objects = Array.from(this.interactables.values()).map(target => target.object);
    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      // Find the target that corresponds to the intersected object
      for (const [id, target] of this.interactables) {
        if (target.object === intersects[0].object || target.object.children.includes(intersects[0].object as any)) {
          return target;
        }
      }
    }

    return null;
  }

  /**
   * Show action menu at specified position
   */
  private showActionMenu(target: InteractableEntity, x: number, y: number): void {
    if (!this.actionMenu) return;

    this.isMenuOpen = true;

    // Clear existing buttons
    this.actionMenu.innerHTML = '';

    // Add target info header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 4px 0;
      border-bottom: 1px solid #8B4513;
      margin-bottom: 4px;
      font-weight: bold;
      text-align: center;
    `;
    
    let headerText = target.name || target.description;
    if (target.level) {
      headerText += ` (Lvl ${target.level})`;
    }
    if (target.health !== undefined && target.maxHealth !== undefined) {
      headerText += `\nHP: ${target.health}/${target.maxHealth}`;
    }
    
    header.textContent = headerText;
    this.actionMenu.appendChild(header);

    // Add action buttons
    target.actions.forEach(action => {
      const button = document.createElement('button');
      button.className = 'rpg-action-button';
      button.textContent = action.label;
      button.disabled = !action.enabled;
      
      if (action.enabled) {
        button.onclick = () => {
          action.callback();
          this.closeActionMenu();
        };
      }

      this.actionMenu!.appendChild(button);
    });

    // Position menu
    const menuRect = this.actionMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let menuX = x;
    let menuY = y;

    // Adjust position if menu would go off screen
    if (x + menuRect.width > viewportWidth) {
      menuX = x - menuRect.width;
    }
    if (y + menuRect.height > viewportHeight) {
      menuY = y - menuRect.height;
    }

    this.actionMenu.style.left = `${menuX}px`;
    this.actionMenu.style.top = `${menuY}px`;
    this.actionMenu.style.display = 'block';
  }

  /**
   * Close the action menu
   */
  private closeActionMenu(): void {
    if (this.actionMenu) {
      this.actionMenu.style.display = 'none';
      this.isMenuOpen = false;
    }
  }

  /**
   * Handle click-to-move
   */
  private handleMovementClick(event: MouseEvent): void {
    if (!this.camera || !this.scene) return;

    // Raycast against ground/terrain
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Find ground intersection - check all objects recursively
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Find the first terrain/ground hit or any walkable surface
    let groundHit: THREE.Intersection | null = null;
    for (const hit of intersects) {
      const userData = hit.object.userData;
      // Accept terrain, ground, or any object marked as walkable
      if (userData?.type === 'terrain' || 
          userData?.type === 'ground' || 
          userData?.walkable === true ||
          hit.object.name?.includes('Terrain') ||
          hit.object.name?.includes('Ground')) {
        groundHit = hit;
        break;
      }
    }
    
    if (groundHit) {
      const targetPosition = groundHit.point;
      
      console.log(`[RPGInteractionSystem] Click-to-move to position (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
      
      // Get local player
      const localPlayer = this.world.getPlayer?.();
      if (localPlayer) {
        // Track movement for test system
        this.totalMovements++;
        
        // Emit movement command
        this.world.emit?.('rpg:movement:click_to_move', {
          playerId: localPlayer.id,
          targetPosition: {
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z
          },
          currentPosition: {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
          },
          isRunning: event.shiftKey || this.isShiftHeld // Hold shift to run
        });

        // Show movement target indicator
        this.showMovementTarget(targetPosition);
      }
    }
  }

  /**
   * Show visual indicator for movement target
   */
  private showMovementTarget(position: any): void {
    // Remove existing target indicator
    const existingTarget = this.scene?.getObjectByName('movement_target');
    if (existingTarget) {
      this.scene?.remove(existingTarget);
    }

    // Create new target indicator
    const targetGeometry = new THREE.RingGeometry(0.5, 0.7, 16);
    const targetMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    const targetIndicator = new THREE.Mesh(targetGeometry, targetMaterial);
    targetIndicator.name = 'movement_target';
    if (position instanceof THREE.Vector3) {
      targetIndicator.position.copy(position);
    } else {
      targetIndicator.position.set(position.x, position.y, position.z);
    }
    targetIndicator.position.y += 0.01; // Slightly above ground
    targetIndicator.rotation.x = -Math.PI / 2; // Lie flat on ground
    
    this.scene?.add(targetIndicator);

    // Animate and remove after delay
    let opacity = 0.8;
    const fadeOut = () => {
      opacity -= 0.02;
      targetMaterial.opacity = opacity;
      
      if (opacity > 0) {
        requestAnimationFrame(fadeOut);
      } else {
        this.scene?.remove(targetIndicator);
        targetGeometry.dispose();
        targetMaterial.dispose();
      }
    };
    
    setTimeout(fadeOut, 2000); // Start fading after 2 seconds
  }

  /**
   * Handle legacy interactions for backward compatibility
   */
  private handleLegacyInteraction(entity: InteractableEntity): void {
    // Handle different interaction types
    switch (entity.type) {
      case 'attack':
        this.handleAttackInteraction(entity);
        break;
      case 'pickup':
        this.handlePickupInteraction(entity);
        break;
      case 'talk':
        this.handleTalkInteraction(entity);
        break;
      case 'gather':
        this.handleGatherInteraction(entity);
        break;
      case 'use':
        this.handleUseInteraction(entity);
        break;
    }
  }

  /**
   * Handle attack interactions
   */
  private handleAttackInteraction(entity: InteractableEntity): void {
    const localPlayer = this.world.getPlayer?.();
    if (!localPlayer) return;

    // Track combat initiation
    this.totalCombatInitiated++;

    // Emit attack command
    this.world.emit?.('rpg:combat:start_attack', {
      attackerId: localPlayer.id,
      targetId: entity.id,
      targetType: entity.app?.type === 'player' ? 'player' : 'mob'
    });

    // Show attack feedback
    this.showAttackFeedback(entity);
  }

  /**
   * Handle pickup interactions  
   */
  private handlePickupInteraction(entity: InteractableEntity): void {
    if (entity.app && entity.app.handleInteraction) {
      const localPlayer = this.world.getPlayer?.();
      if (localPlayer) {
        // Track item pickup
        this.totalItemPickups++;
        
        entity.app.handleInteraction({
          playerId: localPlayer.id,
          appId: entity.id,
          interactionType: 'pickup',
          position: entity.object.position,
          playerPosition: localPlayer.position
        });
      }
    }
  }

  /**
   * Handle talk interactions
   */
  private handleTalkInteraction(entity: InteractableEntity): void {
    console.log(`[RPGInteractionSystem] Talking to ${entity.description}`);
    // Implement NPC dialogue system
  }

  /**
   * Handle gather interactions (trees, rocks, etc.)
   */
  private handleGatherInteraction(entity: InteractableEntity): void {
    const localPlayer = this.world.getPlayer?.();
    if (!localPlayer) return;

    console.log(`[RPGInteractionSystem] Gathering from ${entity.description}`);
    
    // Emit gathering command
    this.world.emit?.('rpg:resource:gather', {
      playerId: localPlayer.id,
      resourceId: entity.id,
      resourceType: entity.app?.resourceType || 'unknown'
    });
  }

  /**
   * Handle use interactions
   */
  private handleUseInteraction(entity: InteractableEntity): void {
    console.log(`[RPGInteractionSystem] Using ${entity.description}`);
    // Implement use interaction
  }

  /**
   * Show attack feedback
   */
  private showAttackFeedback(entity: InteractableEntity): void {
    // Flash red highlight
    if (entity.object) {
      const originalMaterial = this.getMeshMaterial(entity.object);
      this.setMeshMaterial(entity.object, this.attackHighlightMaterial);
      
      setTimeout(() => {
        if (originalMaterial) {
          this.setMeshMaterial(entity.object, originalMaterial);
        }
      }, 200);
    }
  }

  /**
   * Register an interactable entity (legacy method)
   */
  private registerInteractable(data: {
    appId: string;
    mesh: THREE.Object3D;
    type: string;
    distance: number;
    description: string;
    app?: any;
  }): void {
    const entity: InteractableEntity = {
      id: data.appId,
      object: data.mesh,
      type: data.type as any,
      distance: data.distance,
      description: data.description,
      name: data.description,
      actions: [], // Empty actions for legacy entities
      app: data.app
    };

    this.interactables.set(data.appId, entity);
    console.log(`[RPGInteractionSystem] Registered interactable: ${data.description} (${data.type})`);
  }

  /**
   * Register an interactable entity with full action support
   */
  public registerInteractableEntity(target: InteractableEntity): void {
    if (!target.object || !target.id) {
      throw new Error('InteractionTarget must have object and id properties');
    }

    this.interactables.set(target.id, target);
    console.log(`[RPGInteractionSystem] Registered interactable entity: ${target.name} (${target.type})`);
  }

  /**
   * Register a mob with attack/loot actions
   */
  public registerMob(object: THREE.Object3D, mobData: {
    id: string;
    name: string;
    level: number;
    health: number;
    maxHealth: number;
    canAttack: boolean;
  }): void {
    const actions: InteractionAction[] = [];

    if (mobData.canAttack && mobData.health > 0) {
      actions.push({
        id: 'attack',
        label: 'Attack',
        enabled: true,
        callback: () => this.emitInteraction('interaction:attack', {
          targetId: mobData.id,
          targetType: 'mob'
        })
      });
    }

    if (mobData.health <= 0) {
      actions.push({
        id: 'loot',
        label: 'Loot',
        enabled: true,
        callback: () => this.emitInteraction('interaction:loot', {
          targetId: mobData.id
        })
      });
    }

    this.registerInteractableEntity({
      object,
      type: 'mob',
      id: mobData.id,
      name: mobData.name,
      description: mobData.name,
      distance: 3.0,
      level: mobData.level,
      health: mobData.health,
      maxHealth: mobData.maxHealth,
      actions
    });
  }

  /**
   * Register a resource with gather action
   */
  public registerResource(object: THREE.Object3D, resourceData: {
    id: string;
    name: string;
    type: 'tree' | 'rock' | 'fish';
    requiredTool?: string;
    canGather: boolean;
  }): void {
    const actions: InteractionAction[] = [];

    if (resourceData.canGather) {
      let actionLabel = 'Gather';
      switch (resourceData.type) {
        case 'tree':
          actionLabel = 'Chop';
          break;
        case 'rock':
          actionLabel = 'Mine';
          break;
        case 'fish':
          actionLabel = 'Fish';
          break;
      }

      actions.push({
        id: 'gather',
        label: actionLabel,
        enabled: true,
        callback: () => this.emitInteraction('interaction:gather', {
          targetId: resourceData.id,
          resourceType: resourceData.type,
          tool: resourceData.requiredTool
        })
      });
    }

    this.registerInteractableEntity({
      object,
      type: 'resource',
      id: resourceData.id,
      name: resourceData.name,
      description: resourceData.name,
      distance: 2.0,
      actions
    });
  }

  /**
   * Register an item with pickup action
   */
  public registerItem(object: THREE.Object3D, itemData: {
    id: string;
    name: string;
    canPickup: boolean;
  }): void {
    const actions: InteractionAction[] = [];

    if (itemData.canPickup) {
      actions.push({
        id: 'pickup',
        label: 'Take',
        enabled: true,
        callback: () => this.emitInteraction('interaction:pickup', {
          targetId: itemData.id
        })
      });
    }

    this.registerInteractableEntity({
      object,
      type: 'item',
      id: itemData.id,
      name: itemData.name,
      description: itemData.name,
      distance: 2.0,
      actions
    });
  }

  /**
   * Register an NPC with talk action
   */
  public registerNPC(object: THREE.Object3D, npcData: {
    id: string;
    name: string;
    canTalk: boolean;
    isShop?: boolean;
  }): void {
    const actions: InteractionAction[] = [];

    if (npcData.canTalk) {
      actions.push({
        id: 'talk',
        label: npcData.isShop ? 'Trade' : 'Talk',
        enabled: true,
        callback: () => this.emitInteraction('interaction:talk', {
          targetId: npcData.id
        })
      });
    }

    this.registerInteractableEntity({
      object,
      type: 'npc',
      id: npcData.id,
      name: npcData.name,
      description: npcData.name,
      distance: 3.0,
      actions
    });
  }

  /**
   * Unregister an interactable entity
   */
  private unregisterInteractable(data: { appId: string }): void {
    const entity = this.interactables.get(data.appId);
    if (entity) {
      // Clear hover if it's the current hover target
      if (this.currentHover?.entity.id === data.appId) {
        this.clearHover();
      }
      
      this.interactables.delete(data.appId);
      console.log(`[RPGInteractionSystem] Unregistered interactable: ${data.appId}`);
    }
  }

  /**
   * Set hover state
   */
  private setHover(entity: InteractableEntity): void {
    if (this.currentHover?.entity.id === entity.id) return;

    // Clear previous hover
    this.clearHover();

    // Set new hover
    const originalMaterial = this.getMeshMaterial(entity.object);
    this.setMeshMaterial(entity.object, this.highlightMaterial);

    this.currentHover = {
      entity,
      originalMaterial
    };

    // Show tooltip
    this.showTooltip(entity.description, entity.type);
  }

  /**
   * Clear hover state
   */
  private clearHover(): void {
    if (this.currentHover) {
      // Restore original material
      if (this.currentHover.originalMaterial) {
        this.setMeshMaterial(this.currentHover.entity.object, this.currentHover.originalMaterial);
      }
      
      this.currentHover = null;
    }

    // Hide tooltip
    this.hideTooltip();
  }

  /**
   * Update cursor based on interaction type
   */
  private updateCursor(type: string): void {
    if (!this.canvas) return;

    switch (type) {
      case 'attack':
        this.canvas.style.cursor = 'crosshair';
        break;
      case 'pickup':
        this.canvas.style.cursor = 'grab';
        break;
      case 'talk':
        this.canvas.style.cursor = 'help';
        break;
      case 'gather':
        this.canvas.style.cursor = 'pointer';
        break;
      case 'use':
        this.canvas.style.cursor = 'pointer';
        break;
      default:
        this.canvas.style.cursor = 'default';
    }
  }

  /**
   * Show tooltip
   */
  private showTooltip(text: string, type: string): void {
    // Create or update tooltip element
    let tooltip = document.getElementById('rpg-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'rpg-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        pointer-events: none;
        z-index: 1000;
        border: 1px solid #444;
      `;
      document.body.appendChild(tooltip);
    }

    // Add type-specific styling
    const typeColor = this.getTypeColor(type);
    tooltip.style.borderColor = typeColor;
    tooltip.innerHTML = `<span style="color: ${typeColor};">[${type.toUpperCase()}]</span> ${text}`;
    tooltip.style.display = 'block';

    // Position tooltip near mouse
    const updateTooltipPosition = (e: MouseEvent) => {
      tooltip!.style.left = `${e.clientX + 10}px`;
      tooltip!.style.top = `${e.clientY - 30}px`;
    };

    document.addEventListener('mousemove', updateTooltipPosition);
    (tooltip as any)._removeListener = () => {
      document.removeEventListener('mousemove', updateTooltipPosition);
    };
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    const tooltip = document.getElementById('rpg-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
      if ((tooltip as any)._removeListener) {
        (tooltip as any)._removeListener();
      }
    }
  }

  /**
   * Get color for interaction type
   */
  private getTypeColor(type: string): string {
    switch (type) {
      case 'attack': return '#ff4444';
      case 'pickup': return '#44ff44';
      case 'talk': return '#4444ff';
      case 'gather': return '#ffaa44';
      case 'use': return '#aa44ff';
      default: return '#ffffff';
    }
  }

  /**
   * Find entity by object
   */
  private findEntityByObject(object: THREE.Object3D): InteractableEntity | null {
    // Traverse up the object hierarchy to find the interactable
    let current = object;
    while (current) {
      for (const entity of this.interactables.values()) {
        if (entity.object === current || entity.object.children.includes(current as any)) {
          return entity;
        }
      }
      current = current.parent!;
    }
    return null;
  }

  /**
   * Get mesh material from object or its children
   */
  private getMeshMaterial(object: THREE.Object3D): THREE.Material | THREE.Material[] | null | undefined {
    if (object instanceof THREE.Mesh) {
      return object.material;
    }
    
    // Check children
    for (const child of object.children) {
      if (child instanceof THREE.Mesh) {
        return child.material;
      }
    }
    
    return undefined;
  }

  /**
   * Set mesh material
   */
  private setMeshMaterial(object: THREE.Object3D, material: THREE.Material | THREE.Material[]): void {
    if (object instanceof THREE.Mesh) {
      object.material = material;
      return;
    }
    
    // Set on children
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });
  }

  /**
   * Event system for interaction events
   */
  public onInteraction<K extends keyof InteractionSystemEvents>(
    event: K,
    callback: (data: InteractionSystemEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as Function);
  }

  public offInteraction<K extends keyof InteractionSystemEvents>(
    event: K,
    callback: (data: InteractionSystemEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback as Function);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitInteraction<K extends keyof InteractionSystemEvents>(
    event: K,
    data: InteractionSystemEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          (callback as any)(data);
        } catch (error) {
          console.error(`Error in interaction event listener for ${event}:`, error);
          throw error;
        }
      });
    }
  }

  /**
   * Update interactable entity data
   */
  public updateInteractable(id: string, updates: Partial<InteractableEntity>): void {
    const existing = this.interactables.get(id);
    if (existing) {
      Object.assign(existing, updates);
    }
  }

  /**
   * Check if target is in range of player
   */
  public isInRange(targetId: string, playerPosition: THREE.Vector3, maxDistance: number): boolean {
    const target = this.interactables.get(targetId);
    if (!target) return false;

    const targetPosition = new THREE.Vector3();
    target.object.getWorldPosition(targetPosition);
    
    return playerPosition.distanceTo(targetPosition) <= maxDistance;
  }

  /**
   * Update method to be called each frame for distance checking
   */
  public updateDistanceChecks(playerPosition: THREE.Vector3): void {
    // Update action enablement based on distance and other factors
    for (const [id, target] of this.interactables) {
      const distance = this.getDistanceTo(target.object, playerPosition);
      
      target.actions.forEach(action => {
        if (action.distance) {
          action.enabled = distance <= action.distance;
        }
      });
    }
  }

  private getDistanceTo(object: THREE.Object3D, position: THREE.Vector3): number {
    const objectPosition = new THREE.Vector3();
    object.getWorldPosition(objectPosition);
    return position.distanceTo(objectPosition);
  }

  destroy(): void {
    // Clear hover
    this.clearHover();
    
    // Close action menu
    this.closeActionMenu();
    
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.removeEventListener('click', this.onClick.bind(this));
      this.canvas.removeEventListener('contextmenu', this.onRightClick.bind(this));
      this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
    }
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    
    // Remove tooltip
    const tooltip = document.getElementById('rpg-tooltip');
    if (tooltip) {
      document.body.removeChild(tooltip);
    }
    
    // Remove action menu
    if (this.actionMenu) {
      document.body.removeChild(this.actionMenu);
      this.actionMenu = null;
    }
    
    // Clear data
    this.interactables.clear();
    this.eventListeners.clear();
    
    console.log('[RPGInteractionSystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}


  /**
   * Handle keyboard events
   */
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

  /**
   * System rating method for test framework
   */
  getSystemRating(): { rating: 'excellent' | 'good' | 'basic'; coverage: number; details: string } {
    const totalInteractions = this.totalClicks + this.totalMovements + this.totalCombatInitiated + this.totalItemPickups;
    
    if (totalInteractions >= 10 && this.totalMovements >= 3 && this.totalCombatInitiated >= 1) {
      return {
        rating: 'excellent',
        coverage: 100,
        details: `Complete interaction system with ${totalInteractions} total interactions: ${this.totalClicks} clicks, ${this.totalMovements} movements, ${this.totalCombatInitiated} combat sessions, ${this.totalItemPickups} item pickups`
      };
    } else if (totalInteractions >= 5) {
      return {
        rating: 'good',
        coverage: 75,
        details: `Functional interaction system with ${totalInteractions} interactions recorded`
      };
    } else {
      return {
        rating: 'basic',
        coverage: 50,
        details: `Basic interaction system with ${totalInteractions} interactions recorded`
      };
    }
  }
}