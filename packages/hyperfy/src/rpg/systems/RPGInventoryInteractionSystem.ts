/**
 * RPG Inventory Interaction System
 * 
 * Handles drag-and-drop functionality for inventory management
 * and equipment slots, providing RuneScape-style inventory interactions.
 */

import { System } from '../../core/systems/System';

export interface DragData {
  sourceType: 'inventory' | 'equipment' | 'ground';
  sourceSlot: number;
  itemId: string;
  itemData: any;
  dragElement?: HTMLElement;
  originalPosition?: { x: number; y: number };
}

export interface DropTarget {
  type: 'inventory' | 'equipment';
  slot: number | string;
  element: HTMLElement;
  accepts: string[]; // Item types this slot accepts
}

export class RPGInventoryInteractionSystem extends System {
  private currentDrag: DragData | null = null;
  private dropTargets: Map<string, DropTarget> = new Map();
  private dragPreview?: HTMLElement;
  private isDragging: boolean = false;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGInventoryInteractionSystem] Initializing inventory interaction system...');
    
    // Listen for UI events
    this.world.on?.('rpg:ui:inventory_opened', this.setupInventoryInteractions.bind(this));
    this.world.on?.('rpg:ui:inventory_closed', this.cleanupInteractions.bind(this));
    
    // Listen for drag/drop events
    this.world.on?.('rpg:inventory:drag_start', this.handleDragStart.bind(this));
    this.world.on?.('rpg:inventory:drag_end', this.handleDragEnd.bind(this));
    this.world.on?.('rpg:inventory:drop', this.handleDrop.bind(this));
    
    // Listen for player events
    this.world.on?.('enter', this.handlePlayerJoin.bind(this));
    this.world.on?.('leave', this.handlePlayerLeave.bind(this));
  }

  start(): void {
    console.log('[RPGInventoryInteractionSystem] Inventory interaction system started');
  }

  /**
   * Setup drag and drop interactions for inventory UI
   */
  private setupInventoryInteractions(event: { playerId: string; inventoryElement: HTMLElement; equipmentElement?: HTMLElement }): void {
    console.log(`[RPGInventoryInteractionSystem] Setting up interactions for player: ${event.playerId}`);
    
    if (event.inventoryElement) {
      this.setupInventorySlots(event.playerId, event.inventoryElement);
    }
    
    if (event.equipmentElement) {
      this.setupEquipmentSlots(event.playerId, event.equipmentElement);
    }
  }

  /**
   * Setup drag interactions for inventory slots
   */
  private setupInventorySlots(playerId: string, inventoryElement: HTMLElement): void {
    const inventorySlots = inventoryElement.querySelectorAll('[data-inventory-slot]');
    
    inventorySlots.forEach((slot, index) => {
      const slotElement = slot as HTMLElement;
      const slotIndex = parseInt(slotElement.dataset.inventorySlot || index.toString());
      
      // Make slots draggable
      this.makeSlotDraggable(playerId, slotElement, 'inventory', slotIndex);
      
      // Register as drop target
      this.registerDropTarget(`inventory_${playerId}_${slotIndex}`, {
        type: 'inventory',
        slot: slotIndex,
        element: slotElement,
        accepts: ['weapon', 'armor', 'food', 'tool', 'resource', 'ammunition']
      });
    });
    
    console.log(`[RPGInventoryInteractionSystem] Setup ${inventorySlots.length} inventory slots for player: ${playerId}`);
  }

  /**
   * Setup drag interactions for equipment slots
   */
  private setupEquipmentSlots(playerId: string, equipmentElement: HTMLElement): void {
    const equipmentSlots = equipmentElement.querySelectorAll('[data-equipment-slot]');
    
    equipmentSlots.forEach(slot => {
      const slotElement = slot as HTMLElement;
      const slotType = slotElement.dataset.equipmentSlot || '';
      
      // Make equipment slots draggable (for unequipping)
      this.makeSlotDraggable(playerId, slotElement, 'equipment', slotType);
      
      // Register as drop target with type restrictions
      const acceptedTypes = this.getAcceptedTypesForEquipmentSlot(slotType);
      this.registerDropTarget(`equipment_${playerId}_${slotType}`, {
        type: 'equipment',
        slot: slotType,
        element: slotElement,
        accepts: acceptedTypes
      });
    });
    
    console.log(`[RPGInventoryInteractionSystem] Setup ${equipmentSlots.length} equipment slots for player: ${playerId}`);
  }

  /**
   * Make a slot draggable
   */
  private makeSlotDraggable(playerId: string, element: HTMLElement, sourceType: 'inventory' | 'equipment', slot: number | string): void {
    element.draggable = true;
    
    element.addEventListener('dragstart', (event) => {
      this.handleDragStartEvent(event, playerId, sourceType, slot);
    });
    
    element.addEventListener('dragend', (event) => {
      this.handleDragEndEvent(event);
    });
    
    // Also support touch interactions for mobile
    let touchStart: { x: number; y: number } | null = null;
    
    element.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
      
      // Prevent scrolling during drag
      event.preventDefault();
    });
    
    element.addEventListener('touchmove', (event) => {
      if (!touchStart) return;
      
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStart.x);
      const deltaY = Math.abs(touch.clientY - touchStart.y);
      
      // If moved enough, start drag
      if (deltaX > 10 || deltaY > 10) {
        this.handleTouchDragStart(event, playerId, sourceType, slot);
        touchStart = null;
      }
      
      event.preventDefault();
    });
    
    element.addEventListener('touchend', () => {
      if (this.isDragging) {
        this.handleTouchDragEnd();
      }
      touchStart = null;
    });
  }

  /**
   * Register a drop target
   */
  private registerDropTarget(id: string, target: DropTarget): void {
    this.dropTargets.set(id, target);
    
    target.element.addEventListener('dragover', (event) => {
      this.handleDragOver(event, target);
    });
    
    target.element.addEventListener('drop', (event) => {
      this.handleDropEvent(event, target);
    });
    
    // Add visual feedback classes
    target.element.classList.add('rpg-drop-target');
  }

  /**
   * Handle drag start from HTML5 drag API
   */
  private handleDragStartEvent(event: DragEvent, playerId: string, sourceType: 'inventory' | 'equipment', slot: number | string): void {
    const itemData = this.getItemInSlot(playerId, sourceType, slot);
    if (!itemData) {
      event.preventDefault();
      return;
    }

    const dragData: DragData = {
      sourceType: sourceType,
      sourceSlot: typeof slot === 'string' ? parseInt(slot) || 0 : slot,
      itemId: itemData.id,
      itemData: itemData,
      dragElement: event.target as HTMLElement,
      originalPosition: { x: event.clientX, y: event.clientY }
    };

    this.startDrag(dragData);
    
    // Set drag data for HTML5 API
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({
        sourceType: sourceType,
        sourceSlot: slot,
        itemId: itemData.id
      }));
      event.dataTransfer.effectAllowed = 'move';
    }

    // Create drag preview
    this.createDragPreview(itemData, event.clientX, event.clientY);
    
    console.log(`[RPGInventoryInteractionSystem] Started dragging ${itemData.name} from ${sourceType} slot ${slot}`);
  }

  /**
   * Handle touch-based drag start
   */
  private handleTouchDragStart(event: TouchEvent, playerId: string, sourceType: 'inventory' | 'equipment', slot: number | string): void {
    const itemData = this.getItemInSlot(playerId, sourceType, slot);
    if (!itemData) return;

    const touch = event.touches[0];
    const dragData: DragData = {
      sourceType: sourceType,
      sourceSlot: typeof slot === 'string' ? parseInt(slot) || 0 : slot,
      itemId: itemData.id,
      itemData: itemData,
      dragElement: event.target as HTMLElement,
      originalPosition: { x: touch.clientX, y: touch.clientY }
    };

    this.startDrag(dragData);
    this.createDragPreview(itemData, touch.clientX, touch.clientY);
    
    // Setup touch move handler for preview
    const touchMoveHandler = (moveEvent: TouchEvent) => {
      if (this.dragPreview) {
        const touch = moveEvent.touches[0];
        this.updateDragPreview(touch.clientX, touch.clientY);
      }
    };
    
    document.addEventListener('touchmove', touchMoveHandler);
    
    // Store handler for cleanup
    (this as any).touchMoveHandler = touchMoveHandler;
  }

  /**
   * Start drag operation
   */
  private startDrag(dragData: DragData): void {
    this.currentDrag = dragData;
    this.isDragging = true;
    
    // Add visual feedback
    if (dragData.dragElement) {
      dragData.dragElement.classList.add('rpg-dragging');
    }
    
    // Highlight valid drop targets
    this.highlightValidDropTargets(dragData.itemData);
    
    // Emit drag start event
    this.world.emit?.('rpg:ui:drag_started', {
      sourceType: dragData.sourceType,
      sourceSlot: dragData.sourceSlot,
      itemId: dragData.itemId
    });
  }

  /**
   * Handle drag over event
   */
  private handleDragOver(event: DragEvent, target: DropTarget): void {
    if (!this.currentDrag) return;
    
    // Check if this target accepts the current item
    if (this.canDropOnTarget(this.currentDrag.itemData, target)) {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';
      
      // Add hover effect
      target.element.classList.add('rpg-drop-hover');
    }
  }

  /**
   * Handle drop event
   */
  private handleDropEvent(event: DragEvent, target: DropTarget): void {
    event.preventDefault();
    
    if (!this.currentDrag) return;
    
    // Remove hover effect
    target.element.classList.remove('rpg-drop-hover');
    
    // Check if drop is valid
    if (!this.canDropOnTarget(this.currentDrag.itemData, target)) {
      console.warn(`[RPGInventoryInteractionSystem] Invalid drop: ${this.currentDrag.itemData.name} cannot be dropped on ${target.type} slot ${target.slot}`);
      this.cancelDrag();
      return;
    }
    
    // Perform the drop
    this.performDrop(this.currentDrag, target);
  }

  /**
   * Handle touch drag end
   */
  private handleTouchDragEnd(): void {
    if (!this.currentDrag) return;
    
    // Find drop target under the current position
    if (this.dragPreview) {
      const rect = this.dragPreview.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Find element under the drag preview
      this.dragPreview.style.display = 'none';
      const elementUnder = document.elementFromPoint(centerX, centerY);
      this.dragPreview.style.display = 'block';
      
      if (elementUnder) {
        const target = this.findDropTargetForElement(elementUnder);
        if (target && this.canDropOnTarget(this.currentDrag.itemData, target)) {
          this.performDrop(this.currentDrag, target);
          return;
        }
      }
    }
    
    // No valid drop target found
    this.cancelDrag();
  }

  /**
   * Handle HTML5 drag end
   */
  private handleDragEndEvent(event: DragEvent): void {
    this.endDrag();
  }

  /**
   * Perform the actual drop operation
   */
  private performDrop(dragData: DragData, target: DropTarget): void {
    console.log(`[RPGInventoryInteractionSystem] Dropping ${dragData.itemData.name} from ${dragData.sourceType}:${dragData.sourceSlot} to ${target.type}:${target.slot}`);
    
    // Handle different drop scenarios
    if (dragData.sourceType === 'inventory' && target.type === 'equipment') {
      // Equip item
      this.world.emit?.('rpg:equipment:try_equip', {
        playerId: this.getCurrentPlayerId(),
        itemId: dragData.itemId,
        inventorySlot: dragData.sourceSlot
      });
    } else if (dragData.sourceType === 'equipment' && target.type === 'inventory') {
      // Unequip item
      this.world.emit?.('rpg:equipment:unequip', {
        playerId: this.getCurrentPlayerId(),
        slot: dragData.sourceSlot
      });
    } else if (dragData.sourceType === 'inventory' && target.type === 'inventory') {
      // Move item within inventory
      this.world.emit?.('rpg:inventory:move', {
        playerId: this.getCurrentPlayerId(),
        fromSlot: dragData.sourceSlot,
        toSlot: target.slot
      });
    } else if (dragData.sourceType === 'equipment' && target.type === 'equipment') {
      // Swap equipment (if compatible)
      this.world.emit?.('rpg:equipment:swap', {
        playerId: this.getCurrentPlayerId(),
        fromSlot: dragData.sourceSlot,
        toSlot: target.slot
      });
    }
    
    this.endDrag();
  }

  /**
   * Cancel drag operation
   */
  private cancelDrag(): void {
    console.log('[RPGInventoryInteractionSystem] Drag operation cancelled');
    this.endDrag();
  }

  /**
   * End drag operation and cleanup
   */
  private endDrag(): void {
    if (this.currentDrag) {
      // Remove visual feedback
      if (this.currentDrag.dragElement) {
        this.currentDrag.dragElement.classList.remove('rpg-dragging');
      }
      
      // Emit drag end event
      this.world.emit?.('rpg:ui:drag_ended', {
        sourceType: this.currentDrag.sourceType,
        sourceSlot: this.currentDrag.sourceSlot,
        itemId: this.currentDrag.itemId
      });
    }
    
    // Clear drag state
    this.currentDrag = null;
    this.isDragging = false;
    
    // Remove drag preview
    this.removeDragPreview();
    
    // Remove highlight from drop targets
    this.clearDropTargetHighlights();
    
    // Cleanup touch handler
    if ((this as any).touchMoveHandler) {
      document.removeEventListener('touchmove', (this as any).touchMoveHandler);
      (this as any).touchMoveHandler = null;
    }
  }

  /**
   * Create visual drag preview
   */
  private createDragPreview(itemData: any, x: number, y: number): void {
    this.dragPreview = document.createElement('div');
    this.dragPreview.className = 'rpg-drag-preview';
    this.dragPreview.style.cssText = `
      position: fixed;
      top: ${y - 20}px;
      left: ${x - 20}px;
      width: 40px;
      height: 40px;
      background: ${this.getItemColor(itemData)};
      border: 2px solid #fff;
      border-radius: 4px;
      pointer-events: none;
      z-index: 10000;
      opacity: 0.8;
      transform: rotate(5deg);
    `;
    
    // Add item name
    const label = document.createElement('div');
    label.textContent = itemData.name;
    label.style.cssText = `
      position: absolute;
      top: 45px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
      white-space: nowrap;
    `;
    this.dragPreview.appendChild(label);
    
    document.body.appendChild(this.dragPreview);
    
    // Update position on mouse move
    const mouseMoveHandler = (event: MouseEvent) => {
      if (this.dragPreview) {
        this.updateDragPreview(event.clientX, event.clientY);
      }
    };
    
    document.addEventListener('mousemove', mouseMoveHandler);
    (this as any).mouseMoveHandler = mouseMoveHandler;
  }

  /**
   * Update drag preview position
   */
  private updateDragPreview(x: number, y: number): void {
    if (this.dragPreview) {
      this.dragPreview.style.left = `${x - 20}px`;
      this.dragPreview.style.top = `${y - 20}px`;
    }
  }

  /**
   * Remove drag preview
   */
  private removeDragPreview(): void {
    if (this.dragPreview) {
      document.body.removeChild(this.dragPreview);
      this.dragPreview = undefined;
    }
    
    // Remove mouse move handler
    if ((this as any).mouseMoveHandler) {
      document.removeEventListener('mousemove', (this as any).mouseMoveHandler);
      (this as any).mouseMoveHandler = null;
    }
  }

  /**
   * Highlight valid drop targets
   */
  private highlightValidDropTargets(itemData: any): void {
    for (const target of this.dropTargets.values()) {
      if (this.canDropOnTarget(itemData, target)) {
        target.element.classList.add('rpg-drop-valid');
      } else {
        target.element.classList.add('rpg-drop-invalid');
      }
    }
  }

  /**
   * Clear drop target highlights
   */
  private clearDropTargetHighlights(): void {
    for (const target of this.dropTargets.values()) {
      target.element.classList.remove('rpg-drop-valid', 'rpg-drop-invalid', 'rpg-drop-hover');
    }
  }

  /**
   * Check if item can be dropped on target
   */
  private canDropOnTarget(itemData: any, target: DropTarget): boolean {
    // Check if target accepts this item type
    if (!target.accepts.includes(itemData.type)) {
      return false;
    }
    
    // Additional checks for equipment slots
    if (target.type === 'equipment') {
      const slotType = target.slot as string;
      
      // Check specific equipment slot compatibility
      if (slotType === 'weapon' && itemData.type !== 'weapon') return false;
      if (slotType === 'shield' && itemData.type !== 'shield') return false;
      if (slotType === 'arrows' && itemData.type !== 'ammunition') return false;
      if ((slotType === 'helmet' || slotType === 'body' || slotType === 'legs') && itemData.type !== 'armor') return false;
      
      // Check armor slot compatibility
      if (itemData.type === 'armor' && itemData.armorSlot !== slotType) return false;
    }
    
    return true;
  }

  /**
   * Get accepted item types for equipment slot
   */
  private getAcceptedTypesForEquipmentSlot(slotType: string): string[] {
    switch (slotType) {
      case 'weapon':
        return ['weapon'];
      case 'shield':
        return ['shield'];
      case 'helmet':
      case 'body':
      case 'legs':
        return ['armor'];
      case 'arrows':
        return ['ammunition'];
      default:
        return [];
    }
  }

  /**
   * Get item data from slot
   */
  private getItemInSlot(playerId: string, sourceType: 'inventory' | 'equipment', slot: number | string): any {
    if (sourceType === 'inventory') {
      // Get from inventory system
      // Get from inventory system via event
      this.world.emit?.('rpg:inventory:get_item', {
        playerId: playerId,
        slot: slot,
        callback: (item: any) => { return item; }
      });
      return null; // Simplified for MVP
    } else if (sourceType === 'equipment') {
      // Get from equipment system
      // Get from equipment system via event
      this.world.emit?.('rpg:equipment:get_item', {
        playerId: playerId,
        slot: slot,
        callback: (item: any) => { return item; }
      });
      return null; // Simplified for MVP
    }
    
    return null;
  }

  /**
   * Find drop target for element
   */
  private findDropTargetForElement(element: Element): DropTarget | null {
    // Walk up the DOM tree to find a drop target
    let currentElement: Element | null = element;
    
    while (currentElement) {
      for (const target of this.dropTargets.values()) {
        if (target.element === currentElement || target.element.contains(currentElement)) {
          return target;
        }
      }
      currentElement = currentElement.parentElement;
    }
    
    return null;
  }

  /**
   * Get current player ID (simplified for MVP)
   */
  private getCurrentPlayerId(): string {
    const localPlayer = this.world.getPlayer?.();
    return localPlayer?.id || 'player1';
  }

  /**
   * Get item color for visual representation
   */
  private getItemColor(itemData: any): string {
    const colorMap: Record<string, string> = {
      'weapon': '#ffffff',
      'armor': '#8b4513',
      'shield': '#4169e1',
      'ammunition': '#ffd700',
      'food': '#32cd32',
      'tool': '#c0c0c0',
      'resource': '#654321'
    };
    
    return colorMap[itemData.type] || '#808080';
  }

  /**
   * Cleanup interactions
   */
  private cleanupInteractions(): void {
    this.dropTargets.clear();
    if (this.isDragging) {
      this.cancelDrag();
    }
    console.log('[RPGInventoryInteractionSystem] Cleaned up interactions');
  }

  /**
   * Handle player join
   */
  private handlePlayerJoin(event: { playerId: string }): void {
    console.log(`[RPGInventoryInteractionSystem] Player ${event.playerId} joined`);
  }

  /**
   * Handle player leave
   */
  private handlePlayerLeave(event: { playerId: string }): void {
    // Clean up any drag operations for this player
    if (this.currentDrag && this.getCurrentPlayerId() === event.playerId) {
      this.cancelDrag();
    }
    console.log(`[RPGInventoryInteractionSystem] Player ${event.playerId} left`);
  }

  /**
   * Handle system-level drag start
   */
  private handleDragStart(event: any): void {
    // System-level drag start handling if needed
  }

  /**
   * Handle system-level drag end
   */
  private handleDragEnd(event: any): void {
    // System-level drag end handling if needed
  }

  /**
   * Handle system-level drop
   */
  private handleDrop(event: any): void {
    // System-level drop handling if needed
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): any {
    return {
      isDragging: this.isDragging,
      dropTargetsCount: this.dropTargets.size,
      currentDrag: this.currentDrag ? {
        sourceType: this.currentDrag.sourceType,
        sourceSlot: this.currentDrag.sourceSlot,
        itemId: this.currentDrag.itemId
      } : null
    };
  }

  destroy(): void {
    this.cleanupInteractions();
    this.currentDrag = null;
    console.log('[RPGInventoryInteractionSystem] System destroyed');
  }
}