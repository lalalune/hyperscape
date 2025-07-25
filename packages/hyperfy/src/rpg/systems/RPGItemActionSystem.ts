/**
 * RPG Item Action System
 * 
 * Handles RuneScape-style item interactions with context menus showing
 * available actions like "Wear", "Drop", "Use", "Eat", etc.
 */

import { System } from '../../core/systems/System';
import { RPGItem, ItemType } from '../data/items';

export interface ItemAction {
  id: string;
  label: string;
  callback: (playerId: string, itemId: string, slot?: number) => void;
  priority: number; // Lower number = higher priority in menu
  condition?: (item: RPGItem, playerId: string) => boolean;
}

export interface ItemContextMenu {
  playerId: string;
  itemId: string;
  slot?: number;
  actions: ItemAction[];
  position: { x: number; y: number };
  visible: boolean;
}

export class RPGItemActionSystem extends System {
  private contextMenus: Map<string, ItemContextMenu> = new Map();
  private itemActions: Map<string, ItemAction[]> = new Map();

  constructor(world: any) {
    super(world);
    this.registerDefaultActions();
  }

  async init(): Promise<void> {
    console.log('[RPGItemActionSystem] Initializing item action system...');
    
    // Listen for item interaction events
    this.world.on?.('rpg:item:right_click', this.handleItemRightClick.bind(this));
    this.world.on?.('rpg:item:action_selected', this.handleActionSelected.bind(this));
    this.world.on?.('rpg:ui:close_context_menu', this.handleCloseContextMenu.bind(this));
    
    // Listen for ground item clicks
    this.world.on?.('rpg:ground_item:clicked', this.handleGroundItemClick.bind(this));
    
    // Listen for player events
    this.world.on?.('enter', this.handlePlayerJoin.bind(this));
    this.world.on?.('leave', this.handlePlayerLeave.bind(this));
  }

  start(): void {
    console.log('[RPGItemActionSystem] Item action system started');
  }

  /**
   * Register default item actions for all item types
   */
  private registerDefaultActions(): void {
    // Equipment actions
    this.registerAction('equipment', {
      id: 'wear',
      label: 'Wear',
      priority: 1,
      condition: (item: RPGItem) => this.isEquippable(item),
      callback: (playerId: string, itemId: string, slot?: number) => {
        this.handleWearAction(playerId, itemId, slot);
      }
    });

    this.registerAction('equipment', {
      id: 'remove',
      label: 'Remove',
      priority: 1,
      condition: (item: RPGItem, playerId: string) => this.isEquipped(item, playerId),
      callback: (playerId: string, itemId: string, slot?: number) => {
        this.handleRemoveAction(playerId, itemId, slot);
      }
    });

    // Consumption actions
    this.registerAction('food', {
      id: 'eat',
      label: 'Eat',
      priority: 1,
      condition: (item: RPGItem) => item.type === ItemType.CONSUMABLE,
      callback: (playerId: string, itemId: string, slot?: number) => {
        this.handleEatAction(playerId, itemId, slot);
      }
    });

    // Tool actions
    this.registerAction('tool', {
      id: 'use',
      label: 'Use',
      priority: 1,
      condition: (item: RPGItem) => item.type === ItemType.TOOL,
      callback: (playerId: string, itemId: string, slot?: number) => {
        this.handleUseAction(playerId, itemId, slot);
      }
    });

    // Universal actions
    this.registerAction('universal', {
      id: 'examine',
      label: 'Examine',
      priority: 10,
      condition: () => true, // Always available
      callback: (playerId: string, itemId: string) => {
        this.handleExamineAction(playerId, itemId);
      }
    });

    this.registerAction('universal', {
      id: 'drop',
      label: 'Drop',
      priority: 9,
      condition: (item: RPGItem, playerId: string) => !this.isEquipped(item, playerId),
      callback: (playerId: string, itemId: string, slot?: number) => {
        this.handleDropAction(playerId, itemId, slot);
      }
    });

    // Ground item actions
    this.registerAction('ground', {
      id: 'take',
      label: 'Take',
      priority: 1,
      condition: () => true,
      callback: (playerId: string, itemId: string) => {
        this.handleTakeAction(playerId, itemId);
      }
    });
  }

  /**
   * Register a new item action
   */
  public registerAction(category: string, action: ItemAction): void {
    if (!this.itemActions.has(category)) {
      this.itemActions.set(category, []);
    }
    
    const actions = this.itemActions.get(category)!;
    actions.push(action);
    
    // Sort by priority
    actions.sort((a, b) => a.priority - b.priority);
    
    console.log(`[RPGItemActionSystem] Registered action '${action.label}' for category '${category}'`);
  }

  /**
   * Handle right-click on inventory item
   */
  private handleItemRightClick(event: { playerId: string; itemId: string; slot?: number; position?: { x: number; y: number } }): void {
    const item = this.getItemData(event.itemId);
    if (!item) {
      console.warn(`[RPGItemActionSystem] Item not found: ${event.itemId}`);
      return;
    }

    const availableActions = this.getAvailableActions(item, event.playerId);
    
    if (availableActions.length === 0) {
      console.warn(`[RPGItemActionSystem] No actions available for item: ${item.name}`);
      return;
    }

    // Create context menu
    const contextMenu: ItemContextMenu = {
      playerId: event.playerId,
      itemId: event.itemId,
      slot: event.slot,
      actions: availableActions,
      position: event.position || { x: 0, y: 0 },
      visible: true
    };

    this.contextMenus.set(event.playerId, contextMenu);

    // Send to client for UI display
    this.world.emit?.('rpg:ui:show_context_menu', {
      playerId: event.playerId,
      menu: {
        itemName: item.name,
        actions: availableActions.map(action => ({
          id: action.id,
          label: action.label
        })),
        position: contextMenu.position
      }
    });

    console.log(`[RPGItemActionSystem] Showing context menu for ${item.name} with ${availableActions.length} actions`);
  }

  /**
   * Handle ground item click
   */
  private handleGroundItemClick(event: { playerId: string; itemId: string; position?: { x: number; y: number } }): void {
    // Get ground item via event system
    let groundItem: any = null;
    this.world.emit?.('rpg:ground_item:get', {
      itemId: event.itemId,
      callback: (item: any) => { groundItem = item; }
    });
    if (!groundItem) {
      console.warn(`[RPGItemActionSystem] Ground item not found: ${event.itemId}`);
      return;
    }

    const groundActions = this.itemActions.get('ground') || [];
    const availableActions = groundActions.filter(action => 
      !action.condition || action.condition(groundItem.item, event.playerId)
    );

    if (availableActions.length === 0) {
      // No context menu, just try to pick up
      this.handleTakeAction(event.playerId, event.itemId);
      return;
    }

    // Create context menu for ground item
    const contextMenu: ItemContextMenu = {
      playerId: event.playerId,
      itemId: event.itemId,
      actions: availableActions,
      position: event.position || { x: 0, y: 0 },
      visible: true
    };

    this.contextMenus.set(event.playerId, contextMenu);

    // Send to client for UI display
    this.world.emit?.('rpg:ui:show_context_menu', {
      playerId: event.playerId,
      menu: {
        itemName: groundItem.item.name,
        actions: availableActions.map(action => ({
          id: action.id,
          label: action.label
        })),
        position: contextMenu.position
      }
    });
  }

  /**
   * Handle action selection from context menu
   */
  private handleActionSelected(event: { playerId: string; actionId: string }): void {
    const contextMenu = this.contextMenus.get(event.playerId);
    if (!contextMenu) {
      console.warn(`[RPGItemActionSystem] No context menu for player: ${event.playerId}`);
      return;
    }

    const action = contextMenu.actions.find(a => a.id === event.actionId);
    if (!action) {
      console.warn(`[RPGItemActionSystem] Action not found: ${event.actionId}`);
      return;
    }

    // Execute the action
    action.callback(contextMenu.playerId, contextMenu.itemId, contextMenu.slot);

    // Close context menu
    this.closeContextMenu(event.playerId);
  }

  /**
   * Handle context menu close
   */
  private handleCloseContextMenu(event: { playerId: string }): void {
    this.closeContextMenu(event.playerId);
  }

  /**
   * Close context menu for player
   */
  private closeContextMenu(playerId: string): void {
    this.contextMenus.delete(playerId);
    
    this.world.emit?.('rpg:ui:hide_context_menu', {
      playerId: playerId
    });
  }

  /**
   * Get available actions for an item
   */
  private getAvailableActions(item: RPGItem, playerId: string): ItemAction[] {
    const availableActions: ItemAction[] = [];

    // Check equipment actions
    const equipmentActions = this.itemActions.get('equipment') || [];
    for (const action of equipmentActions) {
      if (!action.condition || action.condition(item, playerId)) {
        availableActions.push(action);
      }
    }

    // Check type-specific actions
    const typeActions = this.itemActions.get(item.type) || [];
    for (const action of typeActions) {
      if (!action.condition || action.condition(item, playerId)) {
        availableActions.push(action);
      }
    }

    // Add universal actions
    const universalActions = this.itemActions.get('universal') || [];
    for (const action of universalActions) {
      if (!action.condition || action.condition(item, playerId)) {
        availableActions.push(action);
      }
    }

    // Sort by priority and remove duplicates
    const uniqueActions = new Map<string, ItemAction>();
    for (const action of availableActions) {
      if (!uniqueActions.has(action.id) || uniqueActions.get(action.id)!.priority > action.priority) {
        uniqueActions.set(action.id, action);
      }
    }

    return Array.from(uniqueActions.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Action Handlers
   */
  private handleWearAction(playerId: string, itemId: string, slot?: number): void {
    console.log(`[RPGItemActionSystem] Player ${playerId} wearing item ${itemId}`);
    
    this.world.emit?.('rpg:equipment:try_equip', {
      playerId: playerId,
      itemId: itemId,
      inventorySlot: slot
    });
  }

  private handleRemoveAction(playerId: string, itemId: string, slot?: number): void {
    console.log(`[RPGItemActionSystem] Player ${playerId} removing item ${itemId}`);
    
    const item = this.getItemData(itemId);
    if (item) {
      const equipSlot = this.getEquipmentSlotForItem(item);
      if (equipSlot) {
        this.world.emit?.('rpg:equipment:unequip', {
          playerId: playerId,
          slot: equipSlot
        });
      }
    }
  }

  private handleEatAction(playerId: string, itemId: string, slot?: number): void {
    console.log(`[RPGItemActionSystem] Player ${playerId} eating item ${itemId}`);
    
    this.world.emit?.('rpg:inventory:consume_item', {
      playerId: playerId,
      itemId: itemId,
      slot: slot
    });
  }

  private handleUseAction(playerId: string, itemId: string, slot?: number): void {
    console.log(`[RPGItemActionSystem] Player ${playerId} using tool ${itemId}`);
    
    this.world.emit?.('rpg:tool:use', {
      playerId: playerId,
      itemId: itemId,
      slot: slot
    });
  }

  private handleExamineAction(playerId: string, itemId: string): void {
    const item = this.getItemData(itemId);
    if (item) {
      const description = item.description || `A ${item.name.toLowerCase()}.`;
      this.sendMessage(playerId, description, 'info');
    }
  }

  private handleDropAction(playerId: string, itemId: string, slot?: number): void {
    console.log(`[RPGItemActionSystem] Player ${playerId} dropping item ${itemId}`);
    
    this.world.emit?.('rpg:inventory:drop_item', {
      playerId: playerId,
      itemId: itemId,
      slot: slot
    });
  }

  private handleTakeAction(playerId: string, itemId: string): void {
    console.log(`[RPGItemActionSystem] Player ${playerId} taking ground item ${itemId}`);
    
    this.world.emit?.('rpg:item:pickup_request', {
      playerId: playerId,
      itemId: itemId
    });
  }

  /**
   * Helper methods
   */
  private isEquippable(item: RPGItem): boolean {
    return [ItemType.WEAPON, ItemType.ARMOR, ItemType.AMMUNITION].includes(item.type);
  }

  private isEquipped(item: RPGItem, playerId: string): boolean {
    // Check with equipment system
    // Check with equipment system via event
    let isEquipped = false;
    this.world.emit?.('rpg:equipment:is_equipped', {
      playerId: playerId,
      itemId: item.id,
      callback: (equipped: boolean) => { isEquipped = equipped; }
    });
    return isEquipped;
  }

  private getEquipmentSlotForItem(item: RPGItem): string | null {
    switch (item.type) {
      case ItemType.WEAPON:
        return 'weapon';
      case ItemType.ARMOR:
        return item.armorSlot || null;
      case ItemType.AMMUNITION:
        return 'arrows';
      default:
        return null;
    }
  }

  private getItemData(itemId: string): RPGItem | null {
    // This would integrate with the item data system
    // Simplified for MVP
    const itemMap: Record<string, RPGItem> = {
      'bronze_sword': {
        id: 'bronze_sword',
        name: 'Bronze Sword',
        type: ItemType.WEAPON,
        description: 'A basic sword made of bronze.',
        stackable: false,
        maxStack: 1,
        value: 100,
        weight: 2
      },
      'bronze_helmet': {
        id: 'bronze_helmet',
        name: 'Bronze Helmet',
        type: ItemType.ARMOR,
        armorSlot: 'helmet' as any,
        description: 'A bronze helmet that provides basic protection.',
        stackable: false,
        maxStack: 1,
        value: 60,
        weight: 2
      },
      'cooked_fish': {
        id: 'cooked_fish',
        name: 'Cooked Fish',
        type: ItemType.CONSUMABLE,
        description: 'A delicious cooked fish that restores health.',
        stackable: true,
        maxStack: 100,
        value: 5,
        weight: 0.1
      },
      'arrows': {
        id: 'arrows',
        name: 'Arrows',
        type: ItemType.AMMUNITION,
        description: 'Sharp arrows for use with bows.',
        stackable: true,
        maxStack: 1000,
        value: 1,
        weight: 0.1
      }
    };
    
    return itemMap[itemId] || null;
  }

  private sendMessage(playerId: string, message: string, type: 'info' | 'warning' | 'error'): void {
    this.world.emit?.('rpg:ui:message', {
      playerId: playerId,
      message: message,
      type: type
    });
  }

  /**
   * Handle player events
   */
  private handlePlayerJoin(event: { playerId: string }): void {
    // Initialize any player-specific data if needed
    console.log(`[RPGItemActionSystem] Player ${event.playerId} joined`);
  }

  private handlePlayerLeave(event: { playerId: string }): void {
    // Clean up context menus
    this.closeContextMenu(event.playerId);
    console.log(`[RPGItemActionSystem] Player ${event.playerId} left`);
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): any {
    return {
      registeredActionCategories: Array.from(this.itemActions.keys()),
      totalActions: Array.from(this.itemActions.values()).reduce((sum, actions) => sum + actions.length, 0),
      activeContextMenus: this.contextMenus.size,
      actionsByCategory: Object.fromEntries(
        Array.from(this.itemActions.entries()).map(([category, actions]) => [
          category,
          actions.map(action => ({ id: action.id, label: action.label, priority: action.priority }))
        ])
      )
    };
  }

  destroy(): void {
    this.contextMenus.clear();
    this.itemActions.clear();
    console.log('[RPGItemActionSystem] System destroyed');
  }
}