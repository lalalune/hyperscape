/**
 * Entity Interaction System
 * Single system that handles right-click context menus for ALL entity types
 * - Items, resources, mobs, corpses, NPCs, banks, stores
 * - One raycast, one menu system
 * - Extensible action system
 */

import THREE from '../extras/three';
import { SystemBase } from './SystemBase';
import type { World } from '../types';
import { EventType } from '../types/events';
import type { Position3D } from '../types/base-types';
import { AttackType } from '../types/core';

interface InteractionAction {
  id: string;
  label: string;
  icon?: string;
  enabled: boolean;
  handler: () => void;
}

export class EntityInteractionSystem extends SystemBase {
  private raycaster = new THREE.Raycaster();
  private canvas: HTMLCanvasElement | null = null;
  private _tempVec2 = new THREE.Vector2();
  
  // Mobile long-press support
  private touchStart: { x: number; y: number; time: number } | null = null;
  private longPressTimer: NodeJS.Timeout | null = null;
  private readonly LONG_PRESS_DURATION = 500;
  
  constructor(world: World) {
    super(world, { 
      name: 'entity-interaction', 
      dependencies: { required: [], optional: [] },
      autoCleanup: true 
    });
  }

  async init(): Promise<void> {
    // No event subscriptions needed - we handle everything via mouse/touch events
  }

  start(): void {
    this.canvas = this.world.graphics?.renderer?.domElement || null;
    
    if (this.canvas) {
      // Bind event handlers
      this.onContextMenu = this.onContextMenu.bind(this);
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      
      // Add event listeners with capture phase for priority
      this.canvas.addEventListener('contextmenu', this.onContextMenu, true);
      this.canvas.addEventListener('mousedown', this.onMouseDown, true);
      this.canvas.addEventListener('touchstart', this.onTouchStart, true);
      this.canvas.addEventListener('touchend', this.onTouchEnd, true);
      
      console.log('[EntityInteractionSystem] ✅ Initialized');
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

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 2) { // Right-click
      const target = this.getEntityAtPosition(event.clientX, event.clientY);
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.showContextMenu(target, event.clientX, event.clientY);
      }
    } else {
      // Close any open menus on left-click
      window.dispatchEvent(new CustomEvent('contextmenu:close'));
    }
  }
  
  private onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    if (!touch) return;
    
    this.touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    
    // Long-press for context menu
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
    
    // Quick tap - allow movement (don't show menu)
    if (this.touchStart && Date.now() - this.touchStart.time < this.LONG_PRESS_DURATION) {
      this.touchStart = null;
      return;
    }
    
    this.touchStart = null;
  }

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
    
    // Raycast against all scene objects
    const intersects = this.raycaster.intersectObjects(this.world.stage.scene.children, true);
    
    // Check intersections in priority order
    for (const intersect of intersects) {
      if (intersect.distance > 200) continue;
      
      // Traverse up to find entity userData
      let obj: THREE.Object3D | null = intersect.object;
      while (obj) {
        const userData = obj.userData;
        const entityId = userData?.entityId || userData?.mobId || userData?.resourceId;
        
        if (entityId) {
          // Found an entity - get it from world
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
    
    // Context menu for entity
    
    // Get actions based on entity type
    const actions = this.getActionsForEntityType(target, localPlayer.id);
    
    if (actions.length === 0) {
      console.warn('[EntityInteractionSystem] No actions available for', target.type);
      return;
    }
    
    // Dispatch unified context menu event
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
    
    // Listen for action selection
    const onSelect = (e: Event) => {
      const ce = e as CustomEvent<{ actionId: string; targetId: string }>;
      console.log('[EntityInteractionSystem] Received contextmenu:select:', ce.detail);
      
      if (!ce?.detail || ce.detail.targetId !== target.id) {
        console.log('[EntityInteractionSystem] Ignoring - wrong target or no detail');
        return;
      }
      
      window.removeEventListener('contextmenu:select', onSelect as EventListener);
      
      // Find and execute the action
      const action = actions.find(a => a.id === ce.detail.actionId);
      console.log('[EntityInteractionSystem] Found action:', action ? action.id : 'NOT FOUND');
      console.log('[EntityInteractionSystem] Available actions:', actions.map(a => a.id));
      
      if (action) {
        console.log('[EntityInteractionSystem] Executing action handler for:', action.id);
        action.handler();
      } else {
        console.error('[EntityInteractionSystem] Action not found:', ce.detail.actionId);
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
            console.log('[EntityInteractionSystem] Pickup action triggered for', target.id);
            if (this.world.network?.send) {
              this.world.network.send('pickupItem', { itemId: target.id });
              console.log('[EntityInteractionSystem] Sent pickupItem packet to server');
            } else {
              console.warn('[EntityInteractionSystem] No network.send available for pickup');
              // Fallback for single-player
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
            this.emitTypedEvent(EventType.UI_MESSAGE, {
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
            this.emitTypedEvent(EventType.UI_MESSAGE, {
              playerId,
              message: `The corpse of a ${target.name.toLowerCase()}.`,
              type: 'examine'
            });
          }
        });
        break;
        
      case 'resource': {
        const resourceType = target.entity.config?.resourceType || 'tree';
        
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
        const mobData = target.entity.getMobData ? target.entity.getMobData() : null;
        const isAlive = mobData?.health > 0;
        
        actions.push({
          id: 'attack',
          label: `Attack ${target.name} (Lv${mobData?.level || 1})`,
          icon: '⚔️',
          enabled: isAlive,
          handler: () => {
            console.log('[EntityInteractionSystem] Attack action triggered for mob:', target.id);
            if (this.world.network?.send) {
              this.world.network.send('attackMob', {
                mobId: target.id,
                attackType: 'melee'
              });
              console.log('[EntityInteractionSystem] Sent attackMob packet to server');
            } else {
              console.warn('[EntityInteractionSystem] No network.send available for attack');
            }
            // Also emit local event for immediate feedback
            this.emitTypedEvent(EventType.COMBAT_ATTACK_REQUEST, {
              playerId,
              targetId: target.id,
              attackType: AttackType.MELEE
            });
            console.log('[EntityInteractionSystem] Emitted COMBAT_ATTACK_REQUEST event');
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
        const npcConfig = target.entity.config || {};
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
    
    console.log('[EntityInteractionSystem] Resource action triggered:', action, resourceId);
    
    // Send network packet to server to start gathering
    if (this.world.network?.send) {
      this.world.network.send('resourceGather', {
        resourceId,
        playerPosition: {
          x: localPlayer.position.x,
          y: localPlayer.position.y,
          z: localPlayer.position.z
        }
      });
      console.log('[EntityInteractionSystem] Sent resourceGather packet to server');
    } else {
      console.warn('[EntityInteractionSystem] No network.send available for resource gathering');
    }
    
    // Also emit local event for immediate feedback
    this.emitTypedEvent(EventType.RESOURCE_ACTION, {
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
      const mobData = target.entity.getMobData ? target.entity.getMobData() : null;
      message = `A level ${mobData?.level || 1} ${target.name}. ${mobData?.health > 0 ? 'It looks dangerous!' : 'It is dead.'}`;
    } else if (target.type === 'resource') {
      const resourceType = target.entity.config?.resourceType || 'tree';
      if (resourceType.includes('tree')) {
        message = 'A tree. I can chop it down with a hatchet.';
      } else if (resourceType.includes('rock')) {
        message = 'A rock containing ore. I could mine it with a pickaxe.';
      } else if (resourceType.includes('fish')) {
        message = 'Fish are swimming in the water here.';
      }
    }
    
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message,
      type: 'examine'
    });
  }

  update(_deltaTime: number): void {
    // No update logic needed
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('contextmenu', this.onContextMenu as EventListener);
      this.canvas.removeEventListener('mousedown', this.onMouseDown as EventListener);
      this.canvas.removeEventListener('touchstart', this.onTouchStart as EventListener);
      this.canvas.removeEventListener('touchend', this.onTouchEnd as EventListener);
    }
    
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    super.destroy();
  }
}

