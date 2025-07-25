/**
 * RPG Player Spawn System
 * 
 * Handles player spawning with starter equipment as defined in the GDD:
 * - Player starts with bronze sword, helmet, and chest armor equipped
 * - Immediately triggers goblin aggro for combat testing
 * - Integrates with equipment and combat systems
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

export interface PlayerSpawnData {
  playerId: string;
  position: THREE.Vector3;
  spawnTime: number;
  hasStarterEquipment: boolean;
  aggroTriggered: boolean;
}

export class RPGPlayerSpawnSystem extends System {
  private spawnedPlayers = new Map<string, PlayerSpawnData>();
  
  // GDD-compliant starter equipment
  private readonly STARTER_EQUIPMENT = [
    {
      id: 'bronze_sword',
      name: 'Bronze Sword',
      type: 'weapon',
      weaponType: 'melee',
      bonuses: { attack: 2, strength: 1 },
      slot: 'weapon'
    },
    {
      id: 'bronze_helmet',
      name: 'Bronze Helmet',
      type: 'armor',
      armorSlot: 'helmet',
      bonuses: { defense: 2 },
      slot: 'helmet'
    },
    {
      id: 'bronze_body',
      name: 'Bronze Body',
      type: 'armor',
      armorSlot: 'body',
      bonuses: { defense: 5 },
      slot: 'body'
    }
  ];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGPlayerSpawnSystem] Initializing player spawn system...');
    
    // Listen for player events
    this.world.on?.('enter', this.handlePlayerJoin.bind(this));
    this.world.on?.('leave', this.handlePlayerLeave.bind(this));
    
    // Listen for spawn completion events
    this.world.on?.('rpg:player:spawn_complete', this.handleSpawnComplete.bind(this));
    
    console.log('[RPGPlayerSpawnSystem] Player spawn system initialized');
  }

  start(): void {
    console.log('[RPGPlayerSpawnSystem] Player spawn system started');
  }

  /**
   * Handle player join - start spawn process
   */
  private handlePlayerJoin(event: { playerId: string }): void {
    console.log(`[RPGPlayerSpawnSystem] Player ${event.playerId} joined - starting spawn process`);
    
    const player = this.world.getPlayer?.(event.playerId);
    if (!player) {
      console.warn(`[RPGPlayerSpawnSystem] Player object not found: ${event.playerId}`);
      return;
    }
    
    // Create spawn data
    const playerPos = player.position;
    let position: THREE.Vector3;
    
    if (playerPos && typeof playerPos.clone === 'function') {
      position = playerPos.clone() as THREE.Vector3;
    } else if (playerPos && 'x' in playerPos && 'y' in playerPos && 'z' in playerPos) {
      position = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    } else {
      position = new THREE.Vector3(0, 0, 0);
    }
    
    const spawnData: PlayerSpawnData = {
      playerId: event.playerId,
      position: position,
      spawnTime: Date.now(),
      hasStarterEquipment: false,
      aggroTriggered: false
    };
    
    this.spawnedPlayers.set(event.playerId, spawnData);
    
    // Start spawn sequence
    this.spawnPlayerWithEquipment(event.playerId);
  }

  /**
   * Spawn player with starter equipment
   */
  private async spawnPlayerWithEquipment(playerId: string): Promise<void> {
    const spawnData = this.spawnedPlayers.get(playerId);
    if (!spawnData) return;
    
    try {
      console.log(`[RPGPlayerSpawnSystem] Equipping starter equipment for player: ${playerId}`);
      
      // First, register player with equipment system
      this.world.emit?.('rpg:player:register', { id: playerId });
      
      // Wait a moment for systems to initialize
      await this.delay(100);
      
      // Equip each starter item
      for (const item of this.STARTER_EQUIPMENT) {
        console.log(`[RPGPlayerSpawnSystem] Force-equipping ${item.name} to ${item.slot} for player ${playerId}`);
        
        // Force equip the item (bypass inventory checks for starter equipment)
        this.world.emit?.('rpg:equipment:force_equip', {
          playerId: playerId,
          item: item,
          slot: item.slot
        });
        
        // Small delay between equipment
        await this.delay(50);
      }
      
      spawnData.hasStarterEquipment = true;
      
      console.log(`[RPGPlayerSpawnSystem] Starter equipment complete for player: ${playerId}`);
      
      // Trigger aggro after equipment is ready
      this.triggerGoblinAggro(playerId);
      
      // Emit spawn complete event
      this.world.emit?.('rpg:player:spawn_complete', {
        playerId: playerId,
        equipment: this.STARTER_EQUIPMENT,
        position: spawnData.position
      });
      
    } catch (error) {
      console.error(`[RPGPlayerSpawnSystem] Failed to equip starter equipment for player ${playerId}:`, error);
    }
  }

  /**
   * Trigger goblin aggro near player spawn
   */
  private triggerGoblinAggro(playerId: string): void {
    const spawnData = this.spawnedPlayers.get(playerId);
    if (!spawnData || spawnData.aggroTriggered) return;
    
    const player = this.world.getPlayer?.(playerId);
    if (!player) return;
    
    console.log(`[RPGPlayerSpawnSystem] Triggering goblin aggro for player: ${playerId}`);
    
    // Spawn a few goblins near the player for immediate combat
    const playerPos = player.position || new THREE.Vector3(0, 0, 0);
    
    const goblinSpawnPositions = [
      new THREE.Vector3(playerPos.x + 3, playerPos.y, playerPos.z + 2),
      new THREE.Vector3(playerPos.x - 2, playerPos.y, playerPos.z + 4),
      new THREE.Vector3(playerPos.x + 1, playerPos.y, playerPos.z - 3)
    ];
    
    goblinSpawnPositions.forEach((position, index) => {
      setTimeout(() => {
        this.spawnAggroGoblin(playerId, position, index);
      }, index * 500); // Stagger spawns by 500ms
    });
    
    spawnData.aggroTriggered = true;
    
    console.log(`[RPGPlayerSpawnSystem] Spawned ${goblinSpawnPositions.length} aggressive goblins for player ${playerId}`);
  }

  /**
   * Spawn an aggressive goblin that will attack the player
   */
  private spawnAggroGoblin(playerId: string, position: THREE.Vector3, index: number): void {
    const goblinId = `starter_goblin_${playerId}_${index}`;
    
    // Spawn goblin mob
    this.world.emit?.('rpg:mob:spawn_request', {
      mobType: 'goblin',
      position: position,
      mobId: goblinId,
      aggressive: true,
      targetPlayerId: playerId,
      spawnReason: 'starter_aggro'
    });
    
    // Force aggro toward the specific player
    this.world.emit?.('rpg:aggro:force_target', {
      mobId: goblinId,
      targetId: playerId,
      aggroAmount: 100,
      reason: 'starter_spawn'
    });
    
    console.log(`[RPGPlayerSpawnSystem] Spawned aggressive goblin ${goblinId} targeting player ${playerId}`);
  }

  /**
   * Handle spawn completion
   */
  private handleSpawnComplete(event: { playerId: string }): void {
    console.log(`[RPGPlayerSpawnSystem] Spawn sequence complete for player: ${event.playerId}`);
    
    // Send welcome message
    this.world.emit?.('rpg:ui:message', {
      playerId: event.playerId,
      message: 'Welcome to the RPG world! You are equipped and ready for battle.',
      type: 'info'
    });
    
    // Additional spawn effects could go here
    // - Tutorial prompts
    // - Spawn effects
    // - Camera positioning
  }

  /**
   * Handle player leave
   */
  private handlePlayerLeave(event: { playerId: string }): void {
    // Clean up spawn data
    this.spawnedPlayers.delete(event.playerId);
    
    // Cleanup any starter goblins that were spawned for this player
    this.cleanupPlayerMobs(event.playerId);
    
    console.log(`[RPGPlayerSpawnSystem] Cleaned up spawn data for player: ${event.playerId}`);
  }

  /**
   * Clean up mobs spawned for a specific player
   */
  private cleanupPlayerMobs(playerId: string): void {
    // Find and despawn any starter goblins for this player
    for (let i = 0; i < 3; i++) {
      const goblinId = `starter_goblin_${playerId}_${i}`;
      this.world.emit?.('rpg:mob:despawn', { mobId: goblinId });
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if player has completed spawn process
   */
  public hasPlayerCompletedSpawn(playerId: string): boolean {
    const spawnData = this.spawnedPlayers.get(playerId);
    return spawnData?.hasStarterEquipment && spawnData?.aggroTriggered || false;
  }

  /**
   * Get spawn data for player
   */
  public getPlayerSpawnData(playerId: string): PlayerSpawnData | null {
    return this.spawnedPlayers.get(playerId) || null;
  }

  /**
   * Force re-equip starter equipment (for testing)
   */
  public forceReequipStarter(playerId: string): void {
    console.log(`[RPGPlayerSpawnSystem] Force re-equipping starter equipment for player: ${playerId}`);
    this.spawnPlayerWithEquipment(playerId);
  }

  /**
   * Manually trigger goblin aggro (for testing)
   */
  public forceTriggerAggro(playerId: string): void {
    const spawnData = this.spawnedPlayers.get(playerId);
    if (spawnData) {
      spawnData.aggroTriggered = false; // Reset flag
      this.triggerGoblinAggro(playerId);
    }
  }

  /**
   * Get all spawned players
   */
  public getAllSpawnedPlayers(): PlayerSpawnData[] {
    return Array.from(this.spawnedPlayers.values());
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): any {
    return {
      totalSpawnedPlayers: this.spawnedPlayers.size,
      playersWithEquipment: Array.from(this.spawnedPlayers.values()).filter(p => p.hasStarterEquipment).length,
      playersWithAggro: Array.from(this.spawnedPlayers.values()).filter(p => p.aggroTriggered).length,
      starterEquipmentItems: this.STARTER_EQUIPMENT.length,
      playerSpawnData: Object.fromEntries(
        Array.from(this.spawnedPlayers.entries()).map(([playerId, data]) => [
          playerId,
          {
            hasStarterEquipment: data.hasStarterEquipment,
            aggroTriggered: data.aggroTriggered,
            spawnTime: data.spawnTime,
            position: {
              x: data.position.x,
              y: data.position.y,
              z: data.position.z
            }
          }
        ])
      )
    };
  }

  destroy(): void {
    // Clean up all spawned player data
    for (const playerId of this.spawnedPlayers.keys()) {
      this.cleanupPlayerMobs(playerId);
    }
    this.spawnedPlayers.clear();
    console.log('[RPGPlayerSpawnSystem] System destroyed');
  }
}