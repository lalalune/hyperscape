/**
 * RPG UI System
 * Server-side system that manages UI state and coordinates with client-side UI apps
 * Sends UI update events that client-side UI apps listen for
 */

import { System } from '../../core/systems/System';

interface UIState {
  playerId: string;
  health: { current: number; max: number };
  skills: any;
  inventory: any;
  equipment: any;
  combatLevel: number;
  inCombat: boolean;
  minimapData: any;
}

export class RPGUISystem extends System {
  private playerUIStates = new Map<string, UIState>();

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGUISystem] Initializing RPG UI coordination system...');
    
    // Listen for RPG system events to update UI state
    this.world.on?.('rpg:player:updated', this.updatePlayerUI.bind(this));
    this.world.on?.('rpg:player:health:update', this.updateHealthUI.bind(this));
    this.world.on?.('rpg:skills:updated', this.updateSkillsUI.bind(this));
    this.world.on?.('rpg:inventory:updated', this.updateInventoryUI.bind(this));
    this.world.on?.('rpg:equipment:updated', this.updateEquipmentUI.bind(this));
    this.world.on?.('rpg:combat:session:started', this.updateCombatUI.bind(this));
    this.world.on?.('rpg:combat:session:ended', this.updateCombatUI.bind(this));
    this.world.on?.('rpg:player:register', this.initializePlayerUI.bind(this));
    this.world.on?.('rpg:player:unregister', this.cleanupPlayerUI.bind(this));
    
    // Listen for UI requests from React components
    this.world.on?.('rpg:ui:request', this.handleUIRequest.bind(this));
    
    console.log('[RPGUISystem] UI coordination system initialized');
  }

  start(): void {
    console.log('[RPGUISystem] UI system started');
  }

  private initializePlayerUI(playerData: any): void {
    const uiState: UIState = {
      playerId: playerData.id,
      health: { current: playerData.health, max: playerData.maxHealth },
      skills: {},
      inventory: { items: [], maxSlots: 28 },
      equipment: playerData.equipment || {},
      combatLevel: playerData.combatLevel || 3,
      inCombat: false,
      minimapData: { position: playerData.position }
    };

    this.playerUIStates.set(playerData.id, uiState);
    
    // Send initial UI state to client
    this.sendUIUpdate(playerData.id, 'init', uiState);
    console.log(`[RPGUISystem] Initialized UI state for player: ${playerData.id}`);
  }

  private cleanupPlayerUI(playerId: string): void {
    this.playerUIStates.delete(playerId);
    console.log(`[RPGUISystem] Cleaned up UI state for player: ${playerId}`);
  }

  private updatePlayerUI(data: { playerId: string; player: any }): void {
    const uiState = this.playerUIStates.get(data.playerId);
    if (!uiState) return;

    // Update core player data
    uiState.health = { 
      current: data.player.health, 
      max: data.player.maxHealth 
    };
    uiState.combatLevel = data.player.combatLevel;
    uiState.minimapData.position = data.player.position;

    this.sendUIUpdate(data.playerId, 'player', {
      health: uiState.health,
      combatLevel: uiState.combatLevel,
      position: data.player.position,
      isAlive: data.player.isAlive
    });
  }

  private updateHealthUI(data: { playerId: string; health: number; maxHealth: number }): void {
    const uiState = this.playerUIStates.get(data.playerId);
    if (!uiState) return;

    uiState.health = { current: data.health, max: data.maxHealth };
    
    this.sendUIUpdate(data.playerId, 'health', uiState.health);
  }

  private updateSkillsUI(data: { playerId: string; skills: any }): void {
    const uiState = this.playerUIStates.get(data.playerId);
    if (!uiState) return;

    uiState.skills = data.skills;
    
    this.sendUIUpdate(data.playerId, 'skills', uiState.skills);
  }

  private updateInventoryUI(data: { playerId: string; inventory: any }): void {
    const uiState = this.playerUIStates.get(data.playerId);
    if (!uiState) return;

    uiState.inventory = data.inventory;
    
    this.sendUIUpdate(data.playerId, 'inventory', uiState.inventory);
  }

  private updateEquipmentUI(data: { playerId: string; equipment: any }): void {
    const uiState = this.playerUIStates.get(data.playerId);
    if (!uiState) return;

    uiState.equipment = data.equipment;
    
    this.sendUIUpdate(data.playerId, 'equipment', uiState.equipment);
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

  private sendUIUpdate(playerId: string, component: string, data: any): void {
    // Send UI update event that client-side UI apps can listen for
    this.world.emit?.('rpg:ui:update', {
      playerId,
      component,
      data
    });
  }

  // Public API for other systems
  getPlayerUIState(playerId: string): UIState | undefined {
    return this.playerUIStates.get(playerId);
  }

  forceUIRefresh(playerId: string): void {
    const uiState = this.playerUIStates.get(playerId);
    if (uiState) {
      this.sendUIUpdate(playerId, 'refresh', uiState);
    }
  }

  // Method to send custom UI messages
  sendUIMessage(playerId: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.sendUIUpdate(playerId, 'message', { message, type });
  }

  // Handle UI data requests from React components
  private handleUIRequest(data: { playerId: string }): void {
    const { playerId } = data;
    console.log(`[RPGUISystem] Handling UI request for player: ${playerId}`);
    
    // Check if RPG API is available, if not retry
    const rpgAPI = (this.world as any).rpg;
    if (!rpgAPI) {
      console.log('[RPGUISystem] RPG API not available yet, retrying in 100ms...');
      setTimeout(() => this.handleUIRequest(data), 100);
      return;
    }
    
    try {
      // Gather data from all RPG systems
      const playerData = rpgAPI.getPlayer?.(playerId);
      const skills = rpgAPI.getSkills?.(playerId);
      const inventory = rpgAPI.getInventory?.(playerId);
      const equipment = rpgAPI.getEquipment?.(playerId);
      const health = rpgAPI.getPlayerHealth?.(playerId);
      const stamina = rpgAPI.getPlayerStamina?.(playerId);
      
      // Send comprehensive UI update with all data
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
          range: 1,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1
        }
      };

      // Send player stats update
      this.world.emit?.('rpg:stats:update', {
        playerId,
        ...uiData
      });

      // Send inventory update
      if (inventory) {
        this.world.emit?.('rpg:inventory:update', {
          playerId,
          items: inventory.items || []
        });
      }

      // Send equipment update
      if (equipment) {
        this.world.emit?.('rpg:equipment:update', {
          playerId,
          equipment: equipment || {}
        });
      }

      console.log(`[RPGUISystem] Sent UI data response for player: ${playerId}`);
      
    } catch (error) {
      console.error('[RPGUISystem] Error handling UI request:', error);
      
      // Send fallback data
      this.world.emit?.('rpg:stats:update', {
        playerId,
        health: 100,
        maxHealth: 100,
        stamina: 100,
        maxStamina: 100,
        level: 1,
        xp: 0,
        maxXp: 83,
        coins: 0,
        combatStyle: 'attack' as const,
        skills: {
          attack: 1,
          strength: 1,
          defense: 1,
          constitution: 1,
          range: 1,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1
        }
      });
    }
  }

  destroy(): void {
    this.playerUIStates.clear();
    console.log('[RPGUISystem] System destroyed');
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
}