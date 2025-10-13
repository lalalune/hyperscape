import { System } from './System';
import type { World } from '../World';
import type { Position3D } from '../types/base-types';
import { AttackType } from '../types/core';
import { EventType } from '../types/events';
import * as THREE from 'three';

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
 * Unified Interaction System
 * Handles both click-to-move AND right-click context menus for entities
 * - Click-to-move with visual target marker
 * - Right-click context menus for items, resources, mobs, NPCs, corpses
 * - Mobile long-press support
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
  
  constructor(world: World) {
    super(world);
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
    this.canvas.addEventListener('click', this.onCanvasClick, false);
    this.canvas.addEventListener('contextmenu', this.onContextMenu, true);
    this.canvas.addEventListener('mousemove', this.onMouseMove, false);
    this.canvas.addEventListener('mousedown', this.onMouseDown, true);
    this.canvas.addEventListener('mouseup', this.onMouseUp, false);
    this.canvas.addEventListener('touchstart', this.onTouchStart, true);
    this.canvas.addEventListener('touchend', this.onTouchEnd, true);
    
    // Listen for camera tap events on mobile
    this.world.on('camera:tap', this.onCameraTap);
    
    // Create target marker (visual indicator)
    this.createTargetMarker();
    
    console.log('[InteractionSystem] Unified click-to-move and context menus enabled');
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
  
  private onContextMenu(event: MouseEvent): void {
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
      window.dispatchEvent(new CustomEvent('contextmenu:close'));
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
    const touch = event.touches[0];
    if (!touch) return;
    
    this.touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    
    this.longPressTimer = setTimeout(() => {
      if (this.touchStart) {
        const target = this.getEntityAtPosition(this.touchStart.x, this.touchStart.y);
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
    
    if (this.touchStart && Date.now() - this.touchStart.time < this.LONG_PRESS_DURATION) {
      this.touchStart = null;
      return;
    }
    
    this.touchStart = null;
  }
  
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
  
  // === CONTEXT MENU METHODS (merged from EntityInteractionSystem) ===
  
  private getEntityAtPosition(screenX: number, screenY: number): { 
    id: string; 
    type: string; 
    name: string; 
    entity: unknown;
    position: Position3D 
  } | null {
    if (!this.canvas || !this.world.camera || !this.world.stage?.scene) return null;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this._tempVec2.set(x, y), this.world.camera);
    
    const intersects = this.raycaster.intersectObjects(this.world.stage.scene.children, true);
    
    for (const intersect of intersects) {
      if (intersect.distance > 200) continue;
      
      let obj: THREE.Object3D | null = intersect.object;
      while (obj) {
        const userData = obj.userData;
        const entityId = userData?.entityId || userData?.mobId || userData?.resourceId;
        
        if (entityId) {
          const entity = this.world.entities.get(entityId);
          if (entity) {
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            
            return {
              id: entityId,
              type: entity.type || userData.type || 'unknown',
              name: entity.name || userData.name || 'Entity',
              entity,
              position: { x: worldPos.x, y: worldPos.y, z: worldPos.z }
            };
          }
        }
        
        obj = obj.parent as THREE.Object3D | null;
      }
    }
    
    return null;
  }

  private showContextMenu(target: { id: string; type: string; name: string; entity: unknown; position: Position3D }, screenX: number, screenY: number): void {
    const localPlayer = this.world.getPlayer();
    if (!localPlayer) return;
    
    const actions = this.getActionsForEntityType(target, localPlayer.id);
    
    if (actions.length === 0) {
      console.warn('[InteractionSystem] No actions available for', target.type);
      return;
    }
    
    const evt = new CustomEvent('contextmenu', {
      detail: {
        target: {
          id: target.id,
          type: target.type,
          name: target.name,
          position: target.position
        },
        mousePosition: { x: screenX, y: screenY },
        items: actions.map(action => ({
          id: action.id,
          label: action.label,
          enabled: action.enabled
        }))
      }
    });
    window.dispatchEvent(evt);
    
    const onSelect = (e: Event) => {
      const ce = e as CustomEvent<{ actionId: string; targetId: string }>;
      
      if (!ce?.detail || ce.detail.targetId !== target.id) {
        return;
      }
      
      window.removeEventListener('contextmenu:select', onSelect as EventListener);
      
      const action = actions.find(a => a.id === ce.detail.actionId);
      
      if (action) {
        action.handler();
      }
    };
    window.addEventListener('contextmenu:select', onSelect as EventListener, { once: true });
  }

  private getActionsForEntityType(target: { id: string; type: string; name: string; entity: unknown; position: Position3D }, playerId: string): InteractionAction[] {
    const actions: InteractionAction[] = [];
    
    switch (target.type) {
      case 'item':
        actions.push({
          id: 'pickup',
          label: `Take ${target.name}`,
          icon: '🎒',
          enabled: true,
          handler: () => {
            if (this.world.network?.send) {
              this.world.network.send('pickupItem', { itemId: target.id });
            } else {
              this.world.emit(EventType.ITEM_PICKUP, {
                playerId,
                itemId: target.id
              });
            }
          }
        });
        actions.push({
          id: 'examine',
          label: 'Examine',
          icon: '👁️',
          enabled: true,
          handler: () => {
            this.world.emit(EventType.UI_MESSAGE, {
              playerId,
              message: `It's ${target.name.toLowerCase()}.`,
              type: 'examine'
            });
          }
        });
        break;
        
      case 'headstone':
      case 'corpse':
        actions.push({
          id: 'loot',
          label: `Loot ${target.name}`,
          icon: '💀',
          enabled: true,
          handler: () => {
            this.world.emit(EventType.CORPSE_CLICK, {
              corpseId: target.id,
              playerId,
              position: target.position
            });
          }
        });
        actions.push({
          id: 'examine',
          label: 'Examine',
          icon: '👁️',
          enabled: true,
          handler: () => {
            this.world.emit(EventType.UI_MESSAGE, {
              playerId,
              message: `The corpse of a ${target.name.toLowerCase()}.`,
              type: 'examine'
            });
          }
        });
        break;
        
      case 'resource': {
        type ResourceEntity = { config?: { resourceType?: string } }
        const resourceType = (target.entity as ResourceEntity).config?.resourceType || 'tree';
        
        if (resourceType.includes('tree')) {
          actions.push({
            id: 'chop',
            label: 'Chop',
            icon: '🪓',
            enabled: true,
            handler: () => this.handleResourceAction(target.id, 'chop')
          });
        } else if (resourceType.includes('rock') || resourceType.includes('ore')) {
          actions.push({
            id: 'mine',
            label: 'Mine',
            icon: '⛏️',
            enabled: true,
            handler: () => this.handleResourceAction(target.id, 'mine')
          });
        } else if (resourceType.includes('fish')) {
          actions.push({
            id: 'fish',
            label: 'Fish',
            icon: '🎣',
            enabled: true,
            handler: () => this.handleResourceAction(target.id, 'fish')
          });
        }
        
        actions.push({
          id: 'walk_here',
          label: 'Walk here',
          icon: '🚶',
          enabled: true,
          handler: () => this.walkTo(target.position)
        });
        actions.push({
          id: 'examine',
          label: 'Examine',
          icon: '👁️',
          enabled: true,
          handler: () => this.examineEntity(target, playerId)
        });
        break;
      }
        
      case 'mob': {
        type MobEntity = { getMobData?: () => { health?: number; level?: number } | null }
        const mobData = (target.entity as MobEntity).getMobData ? (target.entity as MobEntity).getMobData!() : null;
        const isAlive = (mobData?.health || 0) > 0;
        
        actions.push({
          id: 'attack',
          label: `Attack ${target.name} (Lv${mobData?.level || 1})`,
          icon: '⚔️',
          enabled: isAlive,
          handler: () => {
            if (this.world.network?.send) {
              this.world.network.send('attackMob', {
                mobId: target.id,
                attackType: 'melee'
              });
            }
            this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
              playerId,
              targetId: target.id,
              attackType: AttackType.MELEE
            });
          }
        });
        actions.push({
          id: 'walk_here',
          label: 'Walk here',
          icon: '🚶',
          enabled: true,
          handler: () => this.walkTo(target.position)
        });
        actions.push({
          id: 'examine',
          label: 'Examine',
          icon: '👁️',
          enabled: true,
          handler: () => this.examineEntity(target, playerId)
        });
        break;
      }
        
      case 'npc': {
        type NPCEntity = { config?: { services?: string[] } }
        const npcConfig = (target.entity as NPCEntity).config || {};
        const services = npcConfig.services || [];
        
        if (services.includes('bank')) {
          actions.push({
            id: 'open-bank',
            label: 'Open Bank',
            icon: '🏦',
            enabled: true,
            handler: () => {
              this.world.emit(EventType.BANK_OPEN, {
                playerId,
                bankId: target.id,
                position: target.position
              });
            }
          });
        }
        
        if (services.includes('store')) {
          actions.push({
            id: 'open-store',
            label: 'Trade',
            icon: '🏪',
            enabled: true,
            handler: () => {
              this.world.emit(EventType.STORE_OPEN, {
                playerId,
                storeId: target.id,
                position: target.position
              });
            }
          });
        }
        
        actions.push({
          id: 'talk',
          label: 'Talk',
          icon: '💬',
          enabled: true,
          handler: () => {
            this.world.emit(EventType.NPC_DIALOGUE, {
              playerId,
              npcId: target.id
            });
          }
        });
        
        actions.push({
          id: 'examine',
          label: 'Examine',
          icon: '👁️',
          enabled: true,
          handler: () => this.examineEntity(target, playerId)
        });
        break;
      }
    }
    
    return actions;
  }

  private handleResourceAction(resourceId: string, action: string): void {
    const localPlayer = this.world.getPlayer();
    if (!localPlayer) return;
    
    if (this.world.network?.send) {
      this.world.network.send('resourceGather', {
        resourceId,
        playerPosition: {
          x: localPlayer.position.x,
          y: localPlayer.position.y,
          z: localPlayer.position.z
        }
      });
    }
    
    this.world.emit(EventType.RESOURCE_ACTION, {
      playerId: localPlayer.id,
      resourceId,
      action
    });
  }

  private walkTo(position: Position3D): void {
    if (this.world.network?.send) {
      this.world.network.send('moveRequest', {
        target: [position.x, position.y || 0, position.z],
        runMode: true,
        cancel: false
      });
    }
  }

  private examineEntity(target: { type: string; name: string; entity: unknown }, playerId: string): void {
    let message = `It's ${target.name.toLowerCase()}.`;
    
    if (target.type === 'mob') {
      type MobEntity = { getMobData?: () => { health?: number; level?: number } | null }
      const mobData = (target.entity as MobEntity).getMobData ? (target.entity as MobEntity).getMobData!() : null;
      message = `A level ${mobData?.level || 1} ${target.name}. ${(mobData?.health || 0) > 0 ? 'It looks dangerous!' : 'It is dead.'}`;
    } else if (target.type === 'resource') {
      type ResourceEntity = { config?: { resourceType?: string } }
      const resourceType = (target.entity as ResourceEntity).config?.resourceType || 'tree';
      if (resourceType.includes('tree')) {
        message = 'A tree. I can chop it down with a hatchet.';
      } else if (resourceType.includes('rock')) {
        message = 'A rock containing ore. I could mine it with a pickaxe.';
      } else if (resourceType.includes('fish')) {
        message = 'Fish are swimming in the water here.';
      }
    }
    
    this.world.emit(EventType.UI_MESSAGE, {
      playerId,
      message,
      type: 'examine'
    });
  }
}
