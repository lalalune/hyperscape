 
/**
 * UI System
 * Server-side system that manages UI state and coordinates with client-side UI apps
 * Sends UI update events that client-side UI apps listen for
 */

import type { World } from '../types';
import { EventType } from '../types/events';
import { Player, UIState, Equipment, SkillData, PlayerEquipmentItems, EquipmentSlot, Item, EquipmentSlotName } from '../types/core';
import type { EquipmentData, InventoryData, SkillsData, UIRequestData } from '../types/systems';
import { SystemBase } from './SystemBase';
import { getItem } from '../data/items';

export class UISystem extends SystemBase {
  private playerUIStates = new Map<string, UIState>();

  constructor(world: World) {
    super(world, {
      name: 'ui',
      dependencies: {
        required: ['player', 'inventory', 'equipment'], // Core dependencies
        optional: ['combat', 'skills'] // Additional systems for full UI support
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Set up type-safe event subscriptions for UI updates
    this.subscribe(EventType.PLAYER_UPDATED, (data) => {
      // Convert the playerData to Player format
      if (data.playerData) {
        const player = {
          id: data.playerData.id,
          name: data.playerData.name,
          level: data.playerData.level,
          health: { current: data.playerData.health, max: data.playerData.maxHealth },
          combat: { combatLevel: data.playerData.level },
          position: data.playerData.position || { x: 0, y: 0, z: 0 },
          alive: data.playerData.alive
        } as unknown as Player;
        this.updatePlayerUI({ playerId: data.playerId, player });
      }
    });
    this.subscribe(EventType.PLAYER_HEALTH_UPDATED, (data) => {
      this.updateHealthUI(data);
    });
    this.subscribe(EventType.PLAYER_SKILLS_UPDATED, (data) => {
      this.updateSkillsUI(data);
    });
    this.subscribe(EventType.INVENTORY_UPDATED, (data) => {
      const inventoryData = { 
        playerId: data.playerId, 
        inventory: { 
          items: data.items,
          coins: 0,  // Default value since it's not in the event payload
          maxSlots: 28  // Default inventory size
        } as unknown as InventoryData 
      };
      this.updateInventoryUI(inventoryData);
    });
    this.subscribe(EventType.PLAYER_EQUIPMENT_UPDATED, (data) => {
      // Convert Record<string, string | null> to EquipmentData
      // The events provide item IDs as strings, but UI expects full item objects
      const equipmentData = {
        weapon: data.equipment['weapon'] ? { itemId: data.equipment['weapon'], name: 'Unknown', stats: { attack: 0, defense: 0, strength: 0 } } : null,
        shield: data.equipment['shield'] ? { itemId: data.equipment['shield'], name: 'Unknown', stats: { attack: 0, defense: 0, strength: 0 } } : null,
        helmet: data.equipment['helmet'] ? { itemId: data.equipment['helmet'], name: 'Unknown', stats: { attack: 0, defense: 0, strength: 0 } } : null,
        body: data.equipment['body'] ? { itemId: data.equipment['body'], name: 'Unknown', stats: { attack: 0, defense: 0, strength: 0 } } : null,
        legs: data.equipment['legs'] ? { itemId: data.equipment['legs'], name: 'Unknown', stats: { attack: 0, defense: 0, strength: 0 } } : null,
        boots: data.equipment['boots'] ? { itemId: data.equipment['boots'], name: 'Unknown', stats: { attack: 0, defense: 0, strength: 0 } } : null,
        arrows: data.equipment['arrows'] ? { itemId: data.equipment['arrows'], name: 'Unknown', stats: { attack: 0, defense: 0, strength: 0 } } : null
      } as unknown as EquipmentData;
      this.updateEquipmentUI({ playerId: data.playerId, equipment: equipmentData });
    });
    this.subscribe(EventType.COMBAT_STARTED, (data) => {
      this.updateCombatUI({ attackerId: data.attackerId, targetId: data.targetId });
    });
    this.subscribe(EventType.COMBAT_ENDED, (data) => {
      this.updateCombatUI({ attackerId: data.winnerId || undefined });
    });
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => {
      const base: Player = {
        id: data.playerId,
        name: data.playerId,
        health: { current: 100, max: 100 },
        combat: { combatLevel: 1 },
        equipment: {} as unknown as PlayerEquipmentItems,
        position: { x: 0, y: 0, z: 0 },
        alive: true
      } as unknown as Player;
      this.initializePlayerUI(base);
    });
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data) => {
      this.cleanupPlayerUI(data.playerId);
    });
    
    this.subscribe(EventType.UI_REQUEST, (data) => this.handleUIRequest(data as UIRequestData));
    // Listen for equipment changes to update UI
    this.subscribe(EventType.PLAYER_EQUIPMENT_CHANGED, (data) => {
      // Update UI when equipment changes
      if (data.playerId) {
        const uiState = this.playerUIStates.get(data.playerId);
        if (uiState) {
          // Update the equipment slot that changed
          const slotName = data.slot;
          const itemId = data.itemId;
          // Get current equipment and update the slot
          const equipment = uiState.equipment;
          if (equipment && slotName) {
            // Map slot to equipment property
            const equipmentSlot = equipment[slotName as keyof Equipment];
            if (equipmentSlot && itemId === null) {
              // Clear the slot
              equipment[slotName as keyof Equipment] = null;
            } else if (itemId) {
              // Set new item in slot - would need to fetch item data
              // For now, just mark as changed
            }
          }
        }
      }
    });
    // NOTE: Context menu creation DISABLED
    // EntityContextMenu (React component) now handles ALL context menus
    // UISystem creating DOM menus was causing conflicts and blocking React menu clicks
    // Keeping this code commented for reference:
    
    /* DISABLED - EntityContextMenu handles this now
    if (typeof window !== 'undefined') {
      window.addEventListener('contextmenu', (e: Event) => {
        const ce = e as CustomEvent<{ target: { id: string; name: string; position: { x: number; y: number; z: number } }; mousePosition: { x: number; y: number }; items?: Array<{ id: string; label: string; enabled: boolean }> }>
        if (!ce?.detail) return;
        const items = ce.detail.items || [
          { id: 'chop', label: 'Chop', enabled: true },
          { id: 'walk_here', label: 'Walk here', enabled: true },
        ];

        // Remove existing menu
        const old = document.getElementById('context-menu');
        if (old && old.parentElement) old.parentElement.removeChild(old);

        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${ce.detail.mousePosition.x}px`;
        menu.style.top = `${ce.detail.mousePosition.y}px`;
        menu.style.background = 'rgba(20,20,20,0.95)';
        menu.style.border = '1px solid #555';
        menu.style.padding = '6px 0';
        menu.style.color = '#fff';
        menu.style.fontFamily = 'sans-serif';
        menu.style.fontSize = '14px';
        menu.style.zIndex = '99999';
        menu.style.minWidth = '160px';

        items.forEach(item => {
          const row = document.createElement('div');
          row.textContent = item.label;
          row.style.padding = '6px 12px';
          row.style.cursor = item.enabled ? 'pointer' : 'not-allowed';
          row.style.opacity = item.enabled ? '1' : '0.5';
          row.addEventListener('mouseenter', () => { row.style.background = '#2a2a2a'; });
          row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
          if (item.enabled) {
            row.addEventListener('click', () => {
              const select = new CustomEvent('contextmenu:select', { detail: { actionId: item.id, targetId: ce.detail.target.id } });
              window.dispatchEvent(select);
              // Also emit UI_CLOSE_MENU for systems that listen for it
              const closeEvt = new CustomEvent('ui:close_menu');
              window.dispatchEvent(closeEvt);
              if (menu.parentElement) menu.parentElement.removeChild(menu);
            });
            // Allow right-click to select as well (intuitive RS feel)
            row.addEventListener('contextmenu', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const select = new CustomEvent('contextmenu:select', { detail: { actionId: item.id, targetId: ce.detail.target.id } });
              window.dispatchEvent(select);
              const closeEvt = new CustomEvent('ui:close_menu');
              window.dispatchEvent(closeEvt);
              if (menu.parentElement) menu.parentElement.removeChild(menu);
            });
            row.addEventListener('mousedown', (ev) => {
              // If user right-clicks the row, treat it as selection
              if (ev.button === 2) {
                ev.preventDefault();
                ev.stopPropagation();
                const select = new CustomEvent('contextmenu:select', { detail: { actionId: item.id, targetId: ce.detail.target.id } });
                window.dispatchEvent(select);
                const closeEvt = new CustomEvent('ui:close_menu');
                window.dispatchEvent(closeEvt);
                if (menu.parentElement) menu.parentElement.removeChild(menu);
              }
            }, { capture: false });
          }
          menu.appendChild(row);
        });

        document.body.appendChild(menu);

        const dismiss = (evt: MouseEvent | KeyboardEvent) => {
          const el = document.getElementById('context-menu');
          if (el && el.parentElement) el.parentElement.removeChild(el);
          window.removeEventListener('mousedown', dismiss as EventListener);
          window.removeEventListener('scroll', dismiss as EventListener, true);
          window.removeEventListener('keydown', dismiss as EventListener);
        };
        setTimeout(() => {
          window.addEventListener('mousedown', dismiss as EventListener, { once: true, capture: true });
          window.addEventListener('scroll', dismiss as EventListener, { once: true, capture: true });
          window.addEventListener('keydown', dismiss as EventListener, { once: true, capture: true });
        }, 0);
      });
    }
    */ // END DISABLED SECTION
  }

  private convertPlayerEquipmentToEquipment(playerEquipment: PlayerEquipmentItems): Equipment {
    const convertSlot = (item: Item | null, slotName: string): EquipmentSlot | null => {
      if (!item) return null;
      
      return {
        id: `${item.id}_slot`,
        name: item.name,
        slot: slotName as EquipmentSlotName,
        itemId: item.id,
        item: item
      };
    };

    return {
      weapon: convertSlot(playerEquipment.weapon, 'weapon'),
      shield: convertSlot(playerEquipment.shield, 'shield'),
      helmet: convertSlot(playerEquipment.helmet, 'helmet'),
      body: convertSlot(playerEquipment.body, 'body'),
      legs: convertSlot(playerEquipment.legs, 'legs'),
      arrows: convertSlot(playerEquipment.arrows, 'arrows')
    };
  }

  private convertEquipmentDataToEquipment(equipmentData: EquipmentData): Equipment {
    const convertDataSlot = (data: { itemId: string; name: string; stats: { attack: number; defense: number; strength: number } } | null, slotName: string): EquipmentSlot | null => {
      if (!data) return null;
      
      return {
        id: `${data.itemId}_slot`,
        name: data.name,
        slot: slotName as EquipmentSlotName,
        itemId: data.itemId,
        item: null // EquipmentData doesn't contain full item info
      };
    };

    return {
      weapon: convertDataSlot(equipmentData.weapon, 'weapon'),
      shield: convertDataSlot(equipmentData.shield, 'shield'),
      helmet: convertDataSlot(equipmentData.helmet, 'helmet'),
      body: convertDataSlot(equipmentData.body, 'body'),
      legs: convertDataSlot(equipmentData.legs, 'legs'),
      arrows: convertDataSlot(equipmentData.arrows, 'arrows')
    };
  }

  private initializePlayerUI(playerData: Player): void {
    const uiState: UIState = {
      playerId: playerData.id,
      health: { 
        current: playerData.health.current, 
        max: playerData.health.max 
      },
      skills: {
        attack: { level: 1, xp: 0 } as SkillData,
        strength: { level: 1, xp: 0 } as SkillData,
        defense: { level: 1, xp: 0 } as SkillData,
        constitution: { level: 1, xp: 0 } as SkillData,
        ranged: { level: 1, xp: 0 } as SkillData,
        woodcutting: { level: 1, xp: 0 } as SkillData,
        fishing: { level: 1, xp: 0 } as SkillData,
        firemaking: { level: 1, xp: 0 } as SkillData,
        cooking: { level: 1, xp: 0 } as SkillData
      },
      inventory: { items: [], capacity: 28, coins: 0 },
      equipment: playerData.equipment ? this.convertPlayerEquipmentToEquipment(playerData.equipment) : {
        weapon: null, shield: null, helmet: null, body: null, legs: null, arrows: null
      },
      combatLevel: playerData.combat.combatLevel,
      inCombat: false,
      minimapData: { position: playerData.position }
    };

    this.playerUIStates.set(playerData.id, uiState);
    
    this.sendUIUpdate(playerData.id, 'init', { ...uiState });
  }

  private cleanupPlayerUI(playerId: string): void {
    this.playerUIStates.delete(playerId);
  }

  private updatePlayerUI(data: { playerId: string; player: Player }): void {
    const uiState = this.playerUIStates.get(data.playerId)!;

    // Update core player data
    uiState.health = { 
      current: data.player.health.current, 
      max: data.player.health.max 
    };
    uiState.combatLevel = data.player.combat.combatLevel;
    uiState.minimapData.position = data.player.position;

    this.sendUIUpdate(data.playerId, 'player', {
      health: { ...uiState.health },
      combatLevel: uiState.combatLevel,
      position: { ...data.player.position },
      isAlive: data.player.alive
    });
  }

  private updateHealthUI(data: { playerId: string; health: number; maxHealth: number }): void {
    const uiState = this.playerUIStates.get(data.playerId)!;

    uiState.health = { current: data.health, max: data.maxHealth };
    
    this.sendUIUpdate(data.playerId, 'health', {
      current: data.health,
      max: data.maxHealth
    });
  }

  private updateSkillsUI(data: { playerId: string; skills: SkillsData }): void {
    const uiState = this.playerUIStates.get(data.playerId)!;

    uiState.skills = data.skills;
    
    this.sendUIUpdate(data.playerId, 'skills', { ...data.skills });
  }

  private updateInventoryUI(data: { playerId: string; inventory: InventoryData }): void {
    const uiState = this.playerUIStates.get(data.playerId);
    if (!uiState) return; // Guard if UI not initialized yet

    const inventoryData = {
      items: data.inventory.items.map(item => ({
        id: `${item.itemId}_${item.slot}`, // Generate unique ID
        itemId: item.itemId,
        quantity: item.quantity,
        slot: item.slot,
        metadata: null as Record<string, number | string | boolean> | null
      })),
      capacity: data.inventory.maxSlots || 28,
      coins: data.inventory.coins || 0
    };

    uiState.inventory = inventoryData;
    
    this.sendUIUpdate(data.playerId, 'inventory', { ...data.inventory, maxSlots: data.inventory.maxSlots });
  }

  private updateEquipmentUI(data: { playerId: string; equipment: EquipmentData }): void {
    const uiState = this.playerUIStates.get(data.playerId)!;

    uiState.equipment = this.convertEquipmentDataToEquipment(data.equipment);
    
    this.sendUIUpdate(data.playerId, 'equipment', data.equipment);
  }

  private updateCombatUI(data: { attackerId?: string; targetId?: string }): void {
    // Update combat status for both attacker and target
    if (data.attackerId) {
      const attackerState = this.playerUIStates.get(data.attackerId);
      if (attackerState) {
        attackerState.inCombat = !!data.targetId; // true if starting combat, false if ending
        this.sendUIUpdate(data.attackerId, 'combat', { inCombat: attackerState.inCombat });
      }
    }
  }

  private sendUIUpdate(playerId: string, component: string, data: unknown): void {
    // Send UI update event that client-side UI apps can listen for
    this.emitTypedEvent(EventType.UI_PLAYER_UPDATE, {
      playerId,
      playerData: {
        component,
        data: data as Record<string, unknown>
      }
    });
  }

  // Public API for other systems
  getPlayerUIState(playerId: string): UIState | undefined {
    return this.playerUIStates.get(playerId);
  }

  forceUIRefresh(playerId: string): void {
    const uiState = this.playerUIStates.get(playerId)!;
    this.sendUIUpdate(playerId, 'refresh', { 
      ...uiState, 
      inventory: { ...uiState.inventory, items: [...uiState.inventory.items] },
      health: { ...uiState.health },
      skills: { ...uiState.skills },
      equipment: { ...uiState.equipment },
      minimapData: { ...uiState.minimapData }
    });
  }

  // Method to send custom UI messages
  sendUIMessage(playerId: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message,
      type
    });
  }

  private handleUIRequest(data: UIRequestData): void {
    const { playerId } = data;
    const rpgAPI = this.world;
    
    const playerData = rpgAPI.getRPGPlayer?.(playerId);
    const skills = rpgAPI.getSkills?.(playerId);
    const rawInventory = rpgAPI.getInventory?.(playerId);
    const equipment = rpgAPI.getEquipment?.(playerId);
    const health = rpgAPI.getPlayerHealth?.(playerId);
    const stamina = rpgAPI.getPlayerStamina?.(playerId);

    const ensureInventoryItem = (item: unknown, index: number) => {
      const rawItem = item as Record<string, unknown>;
      const itemId = (rawItem.itemId || rawItem.id || 'unknown') as string;
      const itemData = getItem(itemId);
      const slot = (rawItem.slot ?? index) as number;
      
      return {
        slot: slot,
        itemId: itemId,
        quantity: (rawItem.quantity || 1) as number,
        item: {
          id: itemData?.id || itemId,
          name: itemData?.name || (rawItem.name as string) || 'Unknown Item',
          type: itemData?.type || 'misc',
          stackable: itemData?.stackable ?? (rawItem.stackable as boolean) ?? true,
          weight: itemData?.weight ?? (rawItem.weight as number) ?? 0.1
        }
      };
    };

    let inventory: InventoryData;
    if (Array.isArray(rawInventory)) {
      inventory = {
        items: rawInventory.map(ensureInventoryItem),
        maxSlots: 28,
        coins: 0
      };
    } else if (rawInventory && typeof rawInventory === 'object') {
      const inventoryObj = rawInventory as { items: unknown[]; capacity?: number; coins?: number };
      inventory = {
        items: (inventoryObj.items || []).map(ensureInventoryItem),
        maxSlots: inventoryObj.capacity || 28,
        coins: inventoryObj.coins || 0
      };
    } else {
      inventory = {
        items: [],
        maxSlots: 28,
        coins: 0
      };
    }
    
    const uiData = {
      health: health || (playerData?.health || 100),
      maxHealth: 100,
      stamina: stamina || 100,
      maxStamina: 100,
      level: 1,
      xp: 0,
      maxXp: 83,
      coins: 0,
      combatStyle: 'attack' as const,
              skills: skills || {
          attack: 1,
          strength: 1,
          defense: 1,
          constitution: 1,
          ranged: 1,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1
        }
    };

    this.emitTypedEvent(EventType.UI_PLAYER_UPDATE, {
      playerId,
      playerData: uiData
    });

    this.emitTypedEvent(EventType.INVENTORY_UPDATED, {
      playerId,
      items: inventory.items
    });

    this.emitTypedEvent(EventType.UI_EQUIPMENT_UPDATE, {
      playerId,
      equipment: equipment || {}
    });
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    this.playerUIStates.clear();
    super.destroy();
  }
}