import { System } from '../../core/systems/System';
import { RPGEntityManager } from './RPGEntityManager';
import { RPGWorldGenerationSystem } from './RPGWorldGenerationSystem';
import { RPGDatabaseSystem } from './RPGDatabaseSystem';
import type { RPGPlayerData } from '../types/index';

export interface RPGPlayerSystemData {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  position: { x: number; y: number; z: number };
  combatLevel: number;
  isAlive: boolean;
  // Core RPG stats from GDD
  stats: {
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
    ranged: number;
  };
  // Equipment state  
  equipment: {
    weapon?: { id: number; name: string; type: 'melee' | 'ranged' };
    shield?: { id: number; name: string };
    helmet?: { id: number; name: string };
    body?: { id: number; name: string };
    legs?: { id: number; name: string };
    arrows?: { id: number; name: string; count: number };
  };
  // Death state
  deathLocation?: { x: number; y: number; z: number };
  respawnTime?: number;
}

/**
 * RPG Player System
 * Manages player state, health, death/respawn mechanics per GDD
 * - Players start with bronze sword equipped
 * - Base level 1 in all skills (Constitution level 10)
 * - Death drops items at location, respawn at starter town
 * - Health determined by Constitution level
 */
export class RPGPlayerSystem extends System {
  private players = new Map<string, RPGPlayerSystemData>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private entityManager?: RPGEntityManager;
  private worldGeneration?: RPGWorldGenerationSystem;
  private databaseSystem?: RPGDatabaseSystem;
  private readonly RESPAWN_TIME = 30000; // 30 seconds per GDD
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds auto-save
  private saveInterval?: NodeJS.Timeout;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGPlayerSystem] Initializing player system...');
    
    // Get reference to database system (only on server)
    if (this.world.isServer) {
      console.log('[RPGPlayerSystem] Server detected, looking for database system...');
      console.log('[RPGPlayerSystem] Available world systems:', Object.keys(this.world).filter(k => k.startsWith('rpg')));
      this.databaseSystem = this.world['rpg-database'];
      if (!this.databaseSystem) {
        console.error('[RPGPlayerSystem] Database system not found! Available keys:', Object.keys(this.world));
        console.warn('[RPGPlayerSystem] ⚠️ Continuing without database system - player data will not persist');
        this.databaseSystem = undefined;
      } else {
        console.log('[RPGPlayerSystem] ✅ Database system found and connected');
      }
    } else {
      console.log('[RPGPlayerSystem] Client detected, skipping database system');
    }
    
    // Listen for player events
    this.world.on?.('enter', this.onPlayerEnter.bind(this));
    this.world.on?.('leave', this.onPlayerLeave.bind(this));
    this.world.on?.('rpg:player:health:update', this.updateHealth.bind(this));
    this.world.on?.('rpg:player:death', this.handleDeath.bind(this));
    this.world.on?.('rpg:skill:levelup', this.updateCombatLevel.bind(this));
    
    // Start periodic auto-save
    this.startAutoSave();
  }

  start(): void {
    console.log('[RPGPlayerSystem] Player system started');
    
    // Get reference to RPGEntityManager
    this.entityManager = (this.world as any)['rpg-app-manager'];
    if (!this.entityManager) {
      console.error('[RPGPlayerSystem] RPGEntityManager not found! Cannot create player entities.');
    }
    
    // Get reference to World Generation System
    this.worldGeneration = (this.world as any)['rpg-world-generation'];
    if (!this.worldGeneration) {
      console.error('[RPGPlayerSystem] RPGWorldGenerationSystem not found! Using fallback spawn points.');
    }
  }

  private async onPlayerEnter(event: { playerId: string; player: any }): Promise<void> {
    // First, try to load existing player data from database
    let existingPlayerData: RPGPlayerData | null = null;
    if (this.databaseSystem) {
      existingPlayerData = this.databaseSystem.getPlayerData(event.playerId);
    }

    let starterTownPosition: { x: number; y: number; z: number };
    let playerData: RPGPlayerSystemData;

    if (existingPlayerData) {
      // Load existing player data
      console.log(`[RPGPlayerSystem] Loading existing player: ${event.playerId}`);
      playerData = {
        id: event.playerId,
        name: existingPlayerData.name,
        health: existingPlayerData.health.current,
        maxHealth: existingPlayerData.health.max,
        position: existingPlayerData.position,
        combatLevel: this.calculateCombatLevel(existingPlayerData.skills),
        isAlive: existingPlayerData.alive,
        stats: {
          attack: existingPlayerData.skills.attack.level,
          strength: existingPlayerData.skills.strength.level,
          defense: existingPlayerData.skills.defense.level,
          constitution: existingPlayerData.skills.constitution.level,
          ranged: existingPlayerData.skills.ranged.level
        },
        equipment: {
          weapon: { id: 1, name: 'Bronze sword', type: 'melee' } // TODO: Load from equipment table
        }
      };
    } else {
      // Create new player - get random starter town per GDD
      if (this.worldGeneration) {
        const starterTowns = this.worldGeneration.getStarterTowns();
        if (starterTowns.length > 0) {
          const randomTown = starterTowns[Math.floor(Math.random() * starterTowns.length)];
          starterTownPosition = randomTown.position;
          console.log(`[RPGPlayerSystem] New player ${event.playerId} spawning at ${randomTown.name} (${JSON.stringify(starterTownPosition)})`);
        } else {
          // Fallback to center if no towns generated yet
          starterTownPosition = { x: 0, y: 2, z: 0 };
          console.warn(`[RPGPlayerSystem] No starter towns found, using fallback position`);
        }
      } else {
        // Fallback positions if world generation system not available
        const fallbackPositions = [
          { x: 0, y: 2, z: 0 },
          { x: 100, y: 2, z: 0 },
          { x: -100, y: 2, z: 0 },
          { x: 0, y: 2, z: 100 },
          { x: 0, y: 2, z: -100 }
        ];
        starterTownPosition = fallbackPositions[Math.floor(Math.random() * fallbackPositions.length)];
        console.warn(`[RPGPlayerSystem] World generation system not available, using fallback position`);
      }
      
      // Initialize new player with GDD-compliant starting state
      playerData = {
        id: event.playerId,
        name: event.player.name || `Player_${event.playerId}`,
        health: 100, // Constitution level 10 starting health
        maxHealth: 100,
        position: starterTownPosition, // Random starter town
        combatLevel: 3, // Starting combat level per GDD
        isAlive: true,
        // Base level 1 stats (Constitution starts at level 10 per GDD)
        stats: {
          attack: 1,
          strength: 1,
          defense: 1,
          constitution: 10, // Starts at level 10 like RuneScape
          ranged: 1
        },
        // Starting equipment per GDD: Bronze sword equipped
        equipment: {
          weapon: { id: 1, name: 'Bronze sword', type: 'melee' }
        }
      };

      // Save new player to database
      await this.savePlayerToDatabase(event.playerId);
    }

    this.players.set(event.playerId, playerData);
    
    // Player entities are now managed by RPGEntityManager
    console.log(`[RPGPlayerSystem] Player registered for ${playerData.name}`);
    
    // Register player with other systems
    this.world.emit?.('rpg:player:register', playerData);
    
    // Initialize player inventory with starting equipment
    this.world.emit?.('rpg:inventory:initialize', {
      playerId: event.playerId,
      startingItems: [
        { id: 1, name: 'Bronze sword', quantity: 1, stackable: false, equipped: true }
      ]
    });
    
    // Initialize player skills
    this.world.emit?.('rpg:skills:initialize', {
      playerId: event.playerId,
      skills: {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        constitution: { level: 10, xp: 1154 }, // Level 10 starting XP
        ranged: { level: 1, xp: 0 },
        woodcutting: { level: 1, xp: 0 },
        fishing: { level: 1, xp: 0 },
        firemaking: { level: 1, xp: 0 },
        cooking: { level: 1, xp: 0 }
      }
    });
    
    console.log(`[RPGPlayerSystem] Player entered: ${event.playerId} at position ${JSON.stringify(playerData.position)}`);
    
    // Send welcome message
    this.world.chat?.send(`Welcome to the RPG world, ${playerData.name}! You start with a bronze sword equipped.`);
  }

  private async onPlayerLeave(event: { playerId: string }): Promise<void> {
    // Save player data before they leave
    await this.savePlayerToDatabase(event.playerId);

    // Clean up respawn timer if exists
    const timer = this.respawnTimers.get(event.playerId);
    if (timer) {
      clearTimeout(timer);
      this.respawnTimers.delete(event.playerId);
    }

    // Clean up player app
    // Player entities are cleaned up by RPGEntityManager

    // Unregister from other systems
    this.world.emit?.('rpg:player:unregister', event.playerId);
    
    this.players.delete(event.playerId);
    console.log(`[RPGPlayerSystem] Player left: ${event.playerId}`);
  }

  private async updateHealth(data: { playerId: string; health: number; maxHealth: number }): Promise<void> {
    const player = this.players.get(data.playerId);
    if (!player) return;

    player.health = data.health;
    player.maxHealth = data.maxHealth;
    
    // Auto-save critical health changes
    await this.savePlayerToDatabase(data.playerId);
    
    this.emitPlayerUpdate(data.playerId);
  }

  private handleDeath(data: { playerId: string }): void {
    const player = this.players.get(data.playerId);
    if (!player) return;

    player.isAlive = false;
    player.health = 0;
    player.deathLocation = { ...player.position }; // Store death location for headstone
    
    console.log(`[RPGPlayerSystem] Player died: ${data.playerId} at ${JSON.stringify(player.deathLocation)}`);
    
    // Create headstone with player's items per GDD
    this.world.emit?.('rpg:death:create_headstone', {
      playerId: data.playerId,
      position: player.deathLocation,
      playerName: player.name
    });
    
    // Drop all player items at death location per GDD
    this.world.emit?.('rpg:inventory:drop_all', {
      playerId: data.playerId,
      position: player.deathLocation
    });
    
    // Emit death event
    this.world.emit?.('rpg:player:died', {
      playerId: data.playerId,
      deathPosition: player.deathLocation
    });
    
    // Send death message per GDD
    this.world.chat?.send(`💀 ${player.name} has died! Items dropped at death location. Respawning in 30 seconds...`);
    
    // Start respawn timer
    const timer = setTimeout(() => {
      this.respawnPlayer(data.playerId);
    }, this.RESPAWN_TIME);
    
    this.respawnTimers.set(data.playerId, timer);
    this.emitPlayerUpdate(data.playerId);
  }

  private respawnPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // Get random starter town per GDD
    let starterTownPosition: { x: number; y: number; z: number };
    if (this.worldGeneration) {
      const starterTowns = this.worldGeneration.getStarterTowns();
      if (starterTowns.length > 0) {
        const randomTown = starterTowns[Math.floor(Math.random() * starterTowns.length)];
        starterTownPosition = randomTown.position;
      } else {
        starterTownPosition = { x: 0, y: 2, z: 0 }; // Fallback
      }
    } else {
      starterTownPosition = { x: 0, y: 2, z: 0 }; // Fallback
    }
    
    // Reset player state
    player.isAlive = true;
    player.health = player.maxHealth;
    player.position = starterTownPosition; // Respawn at random starter town per GDD
    delete player.deathLocation; // Clear death location
    
    // Clear respawn timer
    this.respawnTimers.delete(playerId);
    
    console.log(`[RPGPlayerSystem] Player respawned: ${playerId} at starter town ${JSON.stringify(starterTownPosition)}`);
    
    // Emit respawn event
    this.world.emit?.('rpg:player:respawned', {
      playerId: playerId,
      position: player.position,
      starterTown: starterTownPosition
    });
    
    // Teleport player to respawn location
    this.world.emit?.('rpg:player:teleport', {
      playerId: playerId,
      position: starterTownPosition
    });
    
    // Send respawn message per GDD
    this.world.chat?.send(`✨ ${player.name} has respawned at a starter town! You must retrieve your items from your death location.`);
    
    this.emitPlayerUpdate(playerId);
  }

  private updateCombatLevel(data: { playerId: string; skill: string }): void {
    const player = this.players.get(data.playerId);
    if (!player) return;

    // Request combat level update from XP system
    this.world.emit?.('rpg:player:combat:level:request', { playerId: data.playerId });
  }

  private emitPlayerUpdate(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.world.emit?.('rpg:player:updated', {
        playerId,
        player
      });
    }
  }

  // Public API for apps
  getPlayer(playerId: string): RPGPlayerData | undefined {
    const playerData = this.players.get(playerId);
    if (!playerData) return undefined;
    
    // Convert RPGPlayerSystemData to RPGPlayerData
    return {
      id: playerData.id,
      hyperfyPlayerId: playerData.id, // Assuming they're the same
      name: playerData.name,
      skills: {
        attack: { level: playerData.stats.attack, xp: 0 },
        strength: { level: playerData.stats.strength, xp: 0 },
        defense: { level: playerData.stats.defense, xp: 0 },
        ranged: { level: playerData.stats.ranged, xp: 0 },
        woodcutting: { level: 1, xp: 0 },
        fishing: { level: 1, xp: 0 },
        firemaking: { level: 1, xp: 0 },
        cooking: { level: 1, xp: 0 },
        constitution: { level: playerData.stats.constitution, xp: 0 }
      },
      health: {
        current: playerData.health,
        max: playerData.maxHealth
      },
      position: playerData.position,
      alive: playerData.isAlive
    };
  }

  getAllPlayers(): RPGPlayerData[] {
    return Array.from(this.players.values()).map(playerData => ({
      id: playerData.id,
      hyperfyPlayerId: playerData.id,
      name: playerData.name,
      skills: {
        attack: { level: playerData.stats.attack, xp: 0 },
        strength: { level: playerData.stats.strength, xp: 0 },
        defense: { level: playerData.stats.defense, xp: 0 },
        ranged: { level: playerData.stats.ranged, xp: 0 },
        woodcutting: { level: 1, xp: 0 },
        fishing: { level: 1, xp: 0 },
        firemaking: { level: 1, xp: 0 },
        cooking: { level: 1, xp: 0 },
        constitution: { level: playerData.stats.constitution, xp: 0 }
      },
      health: {
        current: playerData.health,
        max: playerData.maxHealth
      },
      position: playerData.position,
      alive: playerData.isAlive
    }));
  }

  isPlayerAlive(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player ? player.isAlive : false;
  }

  getPlayerHealth(playerId: string): { health: number; maxHealth: number } | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    return { health: player.health, maxHealth: player.maxHealth };
  }

  healPlayer(playerId: string, amount: number): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return false;

    const oldHealth = player.health;
    player.health = Math.min(player.maxHealth, player.health + amount);
    
    if (player.health !== oldHealth) {
      this.world.emit?.('rpg:player:healed', {
        playerId,
        amount: player.health - oldHealth,
        newHealth: player.health
      });
      
      this.emitPlayerUpdate(playerId);
      return true;
    }
    
    return false;
  }

  async updatePlayerPosition(playerId: string, position: { x: number; y: number; z: number }): Promise<void> {
    const player = this.players.get(playerId);
    if (!player) return;

    player.position = { ...position };
    
    // Position changes are frequent, so we don't auto-save every update
    // Auto-save will handle this periodically
    this.emitPlayerUpdate(playerId);
  }

  // New GDD-compliant methods
  async updatePlayerStats(playerId: string, stats: Partial<RPGPlayerSystemData['stats']>): Promise<void> {
    const player = this.players.get(playerId);
    if (!player) return;

    // Update stats and recalculate health if constitution changed
    Object.assign(player.stats, stats);
    
    if (stats.constitution) {
      // Health = Constitution level * 10 (simplified formula)
      const newMaxHealth = stats.constitution * 10;
      const healthDiff = newMaxHealth - player.maxHealth;
      player.maxHealth = newMaxHealth;
      player.health = Math.min(player.maxHealth, player.health + healthDiff);
      
      console.log(`[RPGPlayerSystem] Player ${playerId} constitution updated: ${stats.constitution}, new max health: ${newMaxHealth}`);
    }

    // Save stats changes immediately
    await this.savePlayerToDatabase(playerId);

    this.emitPlayerUpdate(playerId);
  }

  async updatePlayerEquipment(playerId: string, equipment: Partial<RPGPlayerSystemData['equipment']>): Promise<void> {
    const player = this.players.get(playerId);
    if (!player) return;

    Object.assign(player.equipment, equipment);
    
    // Save equipment changes immediately
    await this.savePlayerToDatabase(playerId);
    
    // Emit equipment change for combat system
    this.world.emit?.('rpg:player:equipment:changed', {
      playerId,
      equipment: player.equipment
    });

    this.emitPlayerUpdate(playerId);
  }

  // GDD-compliant API methods
  getPlayerStats(playerId: string): RPGPlayerSystemData['stats'] | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    return { ...player.stats };
  }

  getPlayerEquipment(playerId: string): RPGPlayerSystemData['equipment'] | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    return { ...player.equipment };
  }

  hasWeaponEquipped(playerId: string): boolean {
    const player = this.players.get(playerId);
    return !!(player?.equipment?.weapon);
  }

  canPlayerUseRanged(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    // Must have bow equipped and arrows
    return player.equipment.weapon?.type === 'ranged' && 
           (player.equipment.arrows?.count || 0) > 0;
  }

  damagePlayer(playerId: string, amount: number, source?: string): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return false;

    player.health = Math.max(0, player.health - amount);
    
    console.log(`[RPGPlayerSystem] Player ${playerId} took ${amount} damage from ${source || 'unknown'}, health: ${player.health}/${player.maxHealth}`);
    
    // Check for death
    if (player.health <= 0) {
      this.world.emit?.('rpg:player:death', { playerId });
      return true; // Player died
    }

    this.emitPlayerUpdate(playerId);
    return false; // Player survived
  }

  destroy(): void {
    // Stop auto-save
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    // Clean up all respawn timers
    this.respawnTimers.forEach(timer => clearTimeout(timer));
    this.respawnTimers.clear();
    this.players.clear();
    console.log('[RPGPlayerSystem] System destroyed');
  }

  // Auto-save functionality
  private startAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    this.saveInterval = setInterval(async () => {
      await this.performAutoSave();
    }, this.AUTO_SAVE_INTERVAL);

    console.log(`[RPGPlayerSystem] Auto-save started with ${this.AUTO_SAVE_INTERVAL}ms interval`);
  }

  private async performAutoSave(): Promise<void> {
    const playerIds = Array.from(this.players.keys());
    if (playerIds.length === 0) return;

    console.log(`[RPGPlayerSystem] Auto-saving ${playerIds.length} players...`);
    
    try {
      await Promise.all(playerIds.map(playerId => this.savePlayerToDatabase(playerId)));
      console.log(`[RPGPlayerSystem] Auto-save completed for ${playerIds.length} players`);
    } catch (error) {
      console.error('[RPGPlayerSystem] Auto-save failed:', error);
    }
  }

  private async savePlayerToDatabase(playerId: string): Promise<void> {
    if (!this.databaseSystem) {
      console.warn(`[RPGPlayerSystem] Cannot save player ${playerId}: database system not available`);
      return;
    }

    const player = this.players.get(playerId);
    if (!player) {
      console.warn(`[RPGPlayerSystem] Cannot save player ${playerId}: player not found in memory`);
      return;
    }

    try {
      // Convert system player data to database format
      const dbPlayerData: Partial<RPGPlayerData> = {
        name: player.name,
        skills: {
          attack: { level: player.stats.attack, xp: 0 }, // TODO: Track XP properly
          strength: { level: player.stats.strength, xp: 0 },
          defense: { level: player.stats.defense, xp: 0 },
          ranged: { level: player.stats.ranged, xp: 0 },
          woodcutting: { level: 1, xp: 0 },
          fishing: { level: 1, xp: 0 },
          firemaking: { level: 1, xp: 0 },
          cooking: { level: 1, xp: 0 },
          constitution: { level: player.stats.constitution, xp: 1154 }
        },
        health: {
          current: player.health,
          max: player.maxHealth
        },
        position: player.position,
        alive: player.isAlive
      };

      this.databaseSystem.savePlayerData(playerId, dbPlayerData);
      console.log(`[RPGPlayerSystem] Saved player data for ${playerId}`);
    } catch (error) {
      console.error(`[RPGPlayerSystem] Failed to save player ${playerId}:`, error);
      throw error;
    }
  }

  private calculateCombatLevel(skills: RPGPlayerData['skills']): number {
    // RuneScape combat level formula (simplified)
    const attack = skills.attack.level;
    const strength = skills.strength.level;
    const defense = skills.defense.level;
    const ranged = skills.ranged.level;
    const constitution = skills.constitution.level;
    
    return Math.floor((defense + constitution + Math.floor(Math.max(attack + strength, ranged) * 1.5)) / 4);
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Player entities are now updated by RPGEntityManager
    // This update method is kept for future player-specific logic
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}