/**
 * Item Action System
 * 
 * Handles RuneScape-style item interactions with context menus showing
 * available actions like "Wear", "Drop", "Use", "Eat", etc.
 */

import { dataManager } from '../data/DataManager';
import type { Item } from '../types/core';
import { ItemAction, ItemContextMenu, ItemType } from '../types/core';
import { EventType } from '../types/events';
import { Logger } from '../utils/Logger';
import type { World } from '../World';
import { SystemBase } from './SystemBase';

// Re-export for backward compatibility
export type { ItemAction, ItemContextMenu };

export class ItemActionSystem extends SystemBase {
  private contextMenus: Map<string, ItemContextMenu> = new Map();
  private itemActions: Map<string, ItemAction[]> = new Map();

  constructor(world: World) {
    super(world, {
      name: 'item-action',
      dependencies: {
        required: [], // Item action system can work independently
        optional: ['inventory', 'equipment', 'ui'] // Better with inventory, equipment and UI systems
      },
      autoCleanup: true
    });
    this.registerDefaultActions();
  }

  async init(): Promise<void> {
    
    // Set up type-safe event subscriptions for item interactions
    this.subscribe<{ playerId: string; itemId: string; slot: number; position: { x: number; y: number } }>(EventType.ITEM_RIGHT_CLICK, (data) => this.handleItemRightClick(data));
    this.subscribe<{ playerId: string; actionId: string; itemId: string; slot: number }>(EventType.ITEM_ACTION_SELECTED, (data) => this.handleActionSelected(data));
    this.subscribe<{ playerId: string }>(EventType.UI_CLOSE_MENU, (data) => this.handleCloseContextMenu(data));
    
    // Set up ground item interaction subscriptions
    this.subscribe<{ playerId: string; itemId: string; position: { x: number; y: number; z: number } }>(EventType.CORPSE_CLICK, (data) => this.handleGroundItemClick(data));
    
    // Set up player event subscriptions
    this.subscribe<{ playerId: string }>(EventType.PLAYER_LEFT, (data) => this.handlePlayerLeave(data));
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
      condition: (item: Item) => this.isEquippable(item),
      callback: (playerId: string, itemId: string, slot: number | null) => {
        this.handleWearAction(playerId, itemId, slot || undefined);
      }
    });

    this.registerAction('equipment', {
      id: 'remove',
      label: 'Remove',
      priority: 1,
      condition: (item: Item, playerId: string) => this.isEquipped(item, playerId),
      callback: (playerId: string, itemId: string, slot: number | null) => {
        this.handleRemoveAction(playerId, itemId, slot || undefined);
      }
    });

    // Consumption actions
    this.registerAction('food', {
      id: 'eat',
      label: 'Eat',
      priority: 1,
      condition: (item: Item) => item.type === ItemType.CONSUMABLE,
      callback: (playerId: string, itemId: string, slot: number | null) => {
        this.handleEatAction(playerId, itemId, slot || undefined);
      }
    });

    // Tool actions
    this.registerAction('tool', {
      id: 'use',
      label: 'Use',
      priority: 1,
      condition: (item: Item) => item.type === ItemType.TOOL,
      callback: (playerId: string, itemId: string, slot: number | null) => {
        this.handleUseAction(playerId, itemId, slot || undefined);
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
      condition: (item: Item, playerId: string) => !this.isEquipped(item, playerId),
      callback: (playerId: string, itemId: string, slot: number | null) => {
        this.handleDropAction(playerId, itemId, slot || undefined);
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
    
  }

  /**
   * Handle right-click on inventory item
   */
  private handleItemRightClick(event: { playerId: string; itemId: string; slot?: number; position?: { x: number; y: number } }): void {
    const item = this.getItemData(event.itemId);
    if (!item) {
      Logger.systemWarn('ItemActionSystem', `Item not found: ${event.itemId}`);
      return;
    }

    const availableActions = this.getAvailableActions(item, event.playerId);
    
    if (availableActions.length === 0) {
      Logger.systemWarn('ItemActionSystem', `No actions available for item: ${item.name}`);
      return;
    }

    // Create context menu
    const contextMenu: ItemContextMenu = {
      playerId: event.playerId,
      itemId: event.itemId,
      slot: event.slot || null,
      actions: availableActions,
      position: event.position || { x: 0, y: 0 },
      visible: true
    };

    this.contextMenus.set(event.playerId, contextMenu);

    // UI display handled by UI_OPEN_MENU event below

    // Emit UI_OPEN_MENU for test system
    this.emitTypedEvent(EventType.UI_OPEN_MENU, {
      playerId: event.playerId,
      actions: availableActions.map(action => action.label)
    });

  }

  /**
   * Handle ground item click
   */
  private handleGroundItemClick(event: { playerId: string; itemId: string; position?: { x: number; y: number } }): void {
    // Get ground item via event system
    let groundItem: Item | null = null;
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      itemId: event.itemId,
      callback: (item: Item) => { groundItem = item; }
    });
    if (!groundItem) {
      Logger.systemWarn('ItemActionSystem', `Ground item not found: ${event.itemId}`);
      return;
    }

    const groundActions = this.itemActions.get('ground') || [];
    const availableActions = groundActions.filter(action => 
      !action.condition || action.condition(groundItem!, event.playerId)
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
      slot: null, // Ground items don't have inventory slots
      actions: availableActions,
      position: event.position || { x: 0, y: 0 },
      visible: true
    };

    this.contextMenus.set(event.playerId, contextMenu);

    // UI display handled by UI_OPEN_MENU event below

    // Also emit UI_OPEN_MENU for test system
    this.emitTypedEvent(EventType.UI_OPEN_MENU, {
      playerId: event.playerId,
      actions: availableActions.map(action => action.label)
    });
  }

  /**
   * Handle action selection from context menu
   */
  private handleActionSelected(event: { playerId: string; actionId: string }): void {
    const contextMenu = this.contextMenus.get(event.playerId);
    if (!contextMenu) {
      Logger.systemWarn('ItemActionSystem', `No context menu for player: ${event.playerId}`);
      return;
    }

    const action = contextMenu.actions.find(a => a.id === event.actionId);
    if (!action) {
      Logger.systemWarn('ItemActionSystem', `Action not found: ${event.actionId}`);
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
    
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: playerId
    });
  }

  /**
   * Get available actions for an item
   */
  private getAvailableActions(item: Item, playerId: string): ItemAction[] {
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
  private handleWearAction(playerId: string, itemId: string, _slot?: number): void {
    
    // Use TRY_EQUIP to auto-detect the equipment slot from item type
    this.emitTypedEvent(EventType.EQUIPMENT_TRY_EQUIP, {
      playerId: playerId,
      itemId: itemId
    });
  }

  private handleRemoveAction(playerId: string, itemId: string, _slot?: number): void {
    
    const item = this.getItemData(itemId);
    if (item) {
      const equipSlot = this.getEquipmentSlotForItem(item);
      if (equipSlot) {
        this.emitTypedEvent(EventType.EQUIPMENT_UNEQUIP, {
          playerId: playerId,
          slot: equipSlot
        });
      }
    }
  }

  private handleEatAction(playerId: string, itemId: string, slot?: number): void {
    
    this.emitTypedEvent(EventType.INVENTORY_CONSUME_ITEM, {
      playerId: playerId,
      itemId: itemId,
      slot: slot
    });
  }

  private handleUseAction(playerId: string, itemId: string, slot?: number): void {
    
    this.emitTypedEvent(EventType.UI_MESSAGE, {
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
    
    this.emitTypedEvent(EventType.ITEM_DROP, {
      playerId: playerId,
      itemId: itemId,
      slot: slot
    });
  }

  private handleTakeAction(playerId: string, itemId: string): void {
    
    this.emitTypedEvent(EventType.ITEM_PICKUP, {
      playerId: playerId,
      itemId: itemId
    });
  }

  /**
   * Helper methods
   */
  private isEquippable(item: Item): boolean {
    return [ItemType.WEAPON, ItemType.ARMOR, ItemType.AMMUNITION].includes(item.type);
  }

  private isEquipped(item: Item, playerId: string): boolean {
    // Check with equipment system
    // Check with equipment system via event
    let isEquipped = false;
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: playerId,
      itemId: item.id,
      callback: (equipped: boolean) => { isEquipped = equipped; }
    });
    return isEquipped;
  }

  private getEquipmentSlotForItem(item: Item): string | null {
    switch (item.type) {
      case ItemType.WEAPON:
        return 'weapon';
      case ItemType.ARMOR:
        return item.equipSlot || null;
      case ItemType.AMMUNITION:
        return 'arrows';
      default:
        return null;
    }
  }

  private getItemData(itemId: string): Item | null {
    // Get item data through centralized DataManager
    return dataManager.getItem(itemId);
  }

  private sendMessage(playerId: string, message: string, type: 'info' | 'warning' | 'error'): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: playerId,
      message: message,
      type: type
    });
  }

  /**
   * Handle player events
   */
  private handlePlayerJoin(event: { playerId: string }): void {
    // Player joined - could initialize player-specific item action settings
    console.log(`[ItemActionSystem] Player joined: ${event.playerId}`);
  }

  private handlePlayerLeave(event: { playerId: string }): void {
    // Clean up context menu if open
    this.closeContextMenu(event.playerId);
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): {
    registeredActionCategories: string[];
    totalActions: number;
    activeContextMenus: number;
    actionsByCategory: Record<string, number>;
  } {
    return {
      registeredActionCategories: Array.from(this.itemActions.keys()),
      totalActions: Array.from(this.itemActions.values()).reduce((sum, actions) => sum + actions.length, 0),
      activeContextMenus: this.contextMenus.size,
      actionsByCategory: Object.fromEntries(
        Array.from(this.itemActions.entries()).map(([category, actions]) => [
          category,
          actions.length
        ])
      )
    };
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all context menus and item actions
    this.contextMenus.clear();
    this.itemActions.clear();
    
        
    // Call parent cleanup
    super.destroy();
  }
}