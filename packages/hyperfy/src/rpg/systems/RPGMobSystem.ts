import { System } from '../../core/systems/System';
import { RPGEntityManager } from './RPGEntityManager';

export interface RPGMobData {
  id: string;
  type: 'goblin' | 'hobgoblin' | 'guard' | 'dark_warrior' | 'black_knight' | 'ice_warrior' | 'dark_ranger' | 'bandit' | 'barbarian';
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  position: { x: number; y: number; z: number };
  isAlive: boolean;
  isAggressive: boolean;
  aggroRange: number;
  respawnTime: number;
  spawnLocation: { x: number; y: number; z: number };
  
  // Combat stats per GDD
  stats: {
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
    ranged: number;
  };
  
  // Equipment and drops
  equipment: {
    weapon?: { id: number; name: string; type: 'melee' | 'ranged' };
    armor?: { id: number; name: string };
  };
  
  // Loot table reference
  lootTable: string;
  
  // AI state
  aiState: 'idle' | 'patrolling' | 'chasing' | 'attacking' | 'returning' | 'dead';
  target?: string; // Player ID being targeted
  lastAI: number; // Last AI update timestamp
  homePosition: { x: number; y: number; z: number };
}

interface MobSpawnConfig {
  type: RPGMobData['type'];
  name: string;
  level: number;
  stats: RPGMobData['stats'];
  equipment: RPGMobData['equipment'];
  lootTable: string;
  isAggressive: boolean;
  aggroRange: number;
  respawnTime: number;
}

/**
 * RPG Mob System - GDD Compliant
 * Handles mob spawning, AI behavior, and lifecycle management per GDD specifications:
 * - 15-minute global respawn cycle
 * - Fixed spawn locations with biome-appropriate mobs
 * - Aggressive vs non-aggressive behavior based on mob type
 * - Level-based aggro (high-level players ignored by low-level aggressive mobs)
 * - Combat integration with player combat system
 */
export class RPGMobSystem extends System {
  private mobs = new Map<string, RPGMobData>();
  private spawnPoints = new Map<string, { config: MobSpawnConfig; position: { x: number; y: number; z: number } }>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private aiUpdateInterval?: NodeJS.Timeout;
  private entityManager?: RPGEntityManager;
  
  private readonly GLOBAL_RESPAWN_TIME = 15 * 60 * 1000; // 15 minutes per GDD
  private readonly AI_UPDATE_INTERVAL = 1000; // 1 second AI updates
  private readonly MAX_CHASE_DISTANCE = 20; // Maximum chase distance before returning home
  
  // Mob configurations per GDD
  private readonly MOB_CONFIGS: Record<RPGMobData['type'], MobSpawnConfig> = {
    // Level 1 - Beginner Enemies
    goblin: {
      type: 'goblin',
      name: 'Goblin',
      level: 2,
      stats: { attack: 1, strength: 1, defense: 1, constitution: 3, ranged: 1 },
      equipment: { weapon: { id: 101, name: 'Rusty Dagger', type: 'melee' } },
      lootTable: 'goblin_drops',
      isAggressive: true,
      aggroRange: 5,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    bandit: {
      type: 'bandit',
      name: 'Bandit',
      level: 3,
      stats: { attack: 2, strength: 2, defense: 1, constitution: 4, ranged: 1 },
      equipment: { weapon: { id: 102, name: 'Short Sword', type: 'melee' } },
      lootTable: 'bandit_drops',
      isAggressive: true,
      aggroRange: 4,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    barbarian: {
      type: 'barbarian',
      name: 'Barbarian',
      level: 4,
      stats: { attack: 3, strength: 4, defense: 2, constitution: 6, ranged: 1 },
      equipment: { weapon: { id: 103, name: 'Battle Axe', type: 'melee' } },
      lootTable: 'barbarian_drops',
      isAggressive: true,
      aggroRange: 6,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    
    // Level 2 - Intermediate Enemies
    hobgoblin: {
      type: 'hobgoblin',
      name: 'Hobgoblin',
      level: 8,
      stats: { attack: 6, strength: 7, defense: 5, constitution: 12, ranged: 1 },
      equipment: { weapon: { id: 201, name: 'Steel Scimitar', type: 'melee' } },
      lootTable: 'hobgoblin_drops',
      isAggressive: true,
      aggroRange: 7,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    guard: {
      type: 'guard',
      name: 'Corrupted Guard',
      level: 12,
      stats: { attack: 8, strength: 8, defense: 10, constitution: 15, ranged: 1 },
      equipment: { weapon: { id: 202, name: 'Steel Sword', type: 'melee' }, armor: { id: 301, name: 'Steel Armor' } },
      lootTable: 'guard_drops',
      isAggressive: true,
      aggroRange: 8,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    dark_warrior: {
      type: 'dark_warrior',
      name: 'Dark Warrior',
      level: 15,
      stats: { attack: 12, strength: 15, defense: 8, constitution: 18, ranged: 1 },
      equipment: { weapon: { id: 203, name: 'Dark Blade', type: 'melee' } },
      lootTable: 'dark_warrior_drops',
      isAggressive: true,
      aggroRange: 10,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    
    // Level 3 - Advanced Enemies
    black_knight: {
      type: 'black_knight',
      name: 'Black Knight',
      level: 25,
      stats: { attack: 20, strength: 22, defense: 18, constitution: 30, ranged: 1 },
      equipment: { weapon: { id: 301, name: 'Black Sword', type: 'melee' }, armor: { id: 401, name: 'Black Armor' } },
      lootTable: 'black_knight_drops',
      isAggressive: true,
      aggroRange: 12,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    ice_warrior: {
      type: 'ice_warrior',
      name: 'Ice Warrior',
      level: 30,
      stats: { attack: 18, strength: 20, defense: 25, constitution: 35, ranged: 1 },
      equipment: { weapon: { id: 302, name: 'Frozen Blade', type: 'melee' }, armor: { id: 402, name: 'Ice Armor' } },
      lootTable: 'ice_warrior_drops',
      isAggressive: true,
      aggroRange: 10,
      respawnTime: this.GLOBAL_RESPAWN_TIME
    },
    dark_ranger: {
      type: 'dark_ranger',
      name: 'Dark Ranger',
      level: 28,
      stats: { attack: 15, strength: 12, defense: 15, constitution: 25, ranged: 25 },
      equipment: { weapon: { id: 303, name: 'Dark Longbow', type: 'ranged' } },
      lootTable: 'dark_ranger_drops',
      isAggressive: true,
      aggroRange: 15, // Longer range for ranged enemies
      respawnTime: this.GLOBAL_RESPAWN_TIME
    }
  };

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGMobSystem] Initializing GDD-compliant mob system...');
    
    // Listen for world events
    this.world.on?.('rpg:entity:death', this.handleMobDeath.bind(this));
    this.world.on?.('rpg:entity:damage', this.handleMobDamage.bind(this));
    this.world.on?.('rpg:player:register', this.onPlayerEnter.bind(this));
    this.world.on?.('rpg:mob:spawn:request', this.spawnMobAtLocation.bind(this));
    
    // Initialize spawn points (these would normally be loaded from world data)
    this.initializeSpawnPoints();
    
    // Start AI update loop
    this.startAILoop();
    
    console.log('[RPGMobSystem] Mob system initialized with GDD mechanics');
  }

  start(): void {
    console.log('[RPGMobSystem] Mob system started');
    
    // Get reference to EntityManager - it may not be available yet
    this.entityManager = (this.world as any)['rpg-entity-manager'];
    if (!this.entityManager) {
      console.log('[RPGMobSystem] RPGEntityManager not yet available, will try again during update');
    } else {
      // Spawn initial mobs if EntityManager is available
      this.spawnAllMobs();
    }
  }


  private initializeSpawnPoints(): void {
    // Initialize spawn points across different zones (simplified for MVP)
    // In a full implementation, these would be loaded from world configuration
    
    const spawnConfigs = [
      // Level 1 zone spawns
      { type: 'goblin' as const, count: 10, area: { x: 50, z: 50, radius: 30 } },
      { type: 'bandit' as const, count: 5, area: { x: -40, z: 30, radius: 20 } },
      { type: 'barbarian' as const, count: 8, area: { x: 60, z: -40, radius: 25 } },
      
      // Level 2 zone spawns  
      { type: 'hobgoblin' as const, count: 6, area: { x: 100, z: 100, radius: 40 } },
      { type: 'guard' as const, count: 4, area: { x: -80, z: 80, radius: 25 } },
      { type: 'dark_warrior' as const, count: 5, area: { x: 120, z: -60, radius: 30 } },
      
      // Level 3 zone spawns
      { type: 'black_knight' as const, count: 3, area: { x: 200, z: 150, radius: 35 } },
      { type: 'ice_warrior' as const, count: 4, area: { x: -150, z: 200, radius: 40 } },
      { type: 'dark_ranger' as const, count: 3, area: { x: 180, z: -120, radius: 30 } }
    ];

    let spawnId = 1;
    for (const spawnConfig of spawnConfigs) {
      const config = this.MOB_CONFIGS[spawnConfig.type];
      
      for (let i = 0; i < spawnConfig.count; i++) {
        // Generate random position within spawn area
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * spawnConfig.area.radius;
        const position = {
          x: spawnConfig.area.x + Math.cos(angle) * distance,
          y: 2, // Standard ground level
          z: spawnConfig.area.z + Math.sin(angle) * distance
        };

        this.spawnPoints.set(`spawn_${spawnId}`, { config, position });
        spawnId++;
      }
    }

    console.log(`[RPGMobSystem] Initialized ${this.spawnPoints.size} spawn points across all difficulty zones`);
  }

  private spawnAllMobs(): void {
    for (const [spawnId, spawnData] of this.spawnPoints.entries()) {
      this.spawnMob(spawnId, spawnData.config, spawnData.position);
    }
    
    console.log(`[RPGMobSystem] Spawned ${this.mobs.size} mobs across the world`);
  }

  private async spawnMob(spawnId: string, config: MobSpawnConfig, position: { x: number; y: number; z: number }): Promise<void> {
    if (!this.entityManager) {
      console.error('[RPGMobSystem] Cannot spawn mob - entityManager not available');
      return;
    }
    
    const mobId = `mob_${spawnId}_${Date.now()}`;
    
    const mobData: RPGMobData = {
      id: mobId,
      type: config.type,
      name: config.name,
      level: config.level,
      health: config.stats.constitution * 10, // Health = Constitution * 10 per GDD
      maxHealth: config.stats.constitution * 10,
      position: { ...position },
      homePosition: { ...position },
      isAlive: true,
      isAggressive: config.isAggressive,
      aggroRange: config.aggroRange,
      respawnTime: config.respawnTime,
      spawnLocation: { ...position },
      stats: { ...config.stats },
      equipment: { ...config.equipment },
      lootTable: config.lootTable,
      aiState: 'idle',
      lastAI: Date.now()
    };

    this.mobs.set(mobId, mobData);
    
    // Mob entities are now created by RPGEntityManager
    console.log(`[RPGMobSystem] Mob ${config.type} registered: ${mobId}`);
    
    // Register mob with combat system and AI system
    this.world.emit?.('rpg:mob:register', mobData);
    this.world.emit?.('rpg:mob:spawned', { 
      mob: {
        id: mobId,
        mobData: config,
        currentHealth: mobData.health,
        isAlive: true,
        homePosition: { x: position.x, y: position.y, z: position.z },
        spawnPoint: {
          respawnTime: config.respawnTime,
          spawnRadius: config.aggroRange
        },
        mesh: null // Will be set by the mob app
      }
    });
    
    console.log(`[RPGMobSystem] Spawned ${config.name} (Level ${config.level}) at ${JSON.stringify(position)}`);
  }

  private spawnMobAtLocation(data: { type: RPGMobData['type']; position: { x: number; y: number; z: number } }): void {
    const config = this.MOB_CONFIGS[data.type];
    if (!config) {
      console.error(`[RPGMobSystem] Unknown mob type: ${data.type}`);
      return;
    }

    const spawnId = `custom_${Date.now()}`;
    this.spawnMob(spawnId, config, data.position);
  }

  private handleMobDamage(data: { entityId: string; damage: number; damageSource: string; entityType: 'player' | 'mob' }): void {
    if (data.entityType !== 'mob') return;
    
    const mob = this.mobs.get(data.entityId);
    if (!mob || !mob.isAlive) return;

    // Apply damage
    mob.health = Math.max(0, mob.health - data.damage);
    
    console.log(`[RPGMobSystem] ${mob.name} (${data.entityId}) took ${data.damage} damage from ${data.damageSource} (${mob.health}/${mob.maxHealth} HP)`);
    
    // Emit damage event for AI system
    this.world.emit?.('rpg:mob:damaged', {
      mobId: data.entityId,
      damage: data.damage,
      attackerId: data.damageSource
    });
    
    // Check if mob died from damage
    if (mob.health <= 0) {
      this.world.emit?.('rpg:entity:death', {
        entityId: data.entityId,
        killedBy: data.damageSource,
        entityType: 'mob'
      });
    }
  }

  private handleMobDeath(data: { entityId: string; killedBy: string; entityType: 'player' | 'mob' }): void {
    if (data.entityType !== 'mob') return;
    
    const mob = this.mobs.get(data.entityId);
    if (!mob) return;

    mob.isAlive = false;
    mob.aiState = 'dead';
    mob.health = 0;
    
    console.log(`[RPGMobSystem] ${mob.name} (${data.entityId}) killed by ${data.killedBy}`);
    
    // Emit AI system death event
    this.world.emit?.('rpg:mob:killed', {
      mobId: data.entityId,
      killerId: data.killedBy
    });
    
    // Mob entities are cleaned up by RPGEntityManager
    
    // Generate loot per GDD
    this.generateLoot(mob, data.killedBy);
    
    // Schedule respawn per GDD (15-minute global cycle)
    const respawnTimer = setTimeout(async () => {
      await this.respawnMob(data.entityId);
    }, mob.respawnTime);
    
    this.respawnTimers.set(data.entityId, respawnTimer);
    
    // Emit mob death event
    this.world.emit?.('rpg:mob:died', {
      mobId: data.entityId,
      mobType: mob.type,
      level: mob.level,
      killedBy: data.killedBy,
      position: mob.position
    });
  }

  private async respawnMob(mobId: string): Promise<void> {
    const mob = this.mobs.get(mobId);
    if (!mob) return;

    // Reset mob to spawn state
    mob.isAlive = true;
    mob.health = mob.maxHealth;
    mob.position = { ...mob.spawnLocation };
    mob.homePosition = { ...mob.spawnLocation };
    mob.aiState = 'idle';
    mob.target = undefined;
    mob.lastAI = Date.now();

    // Clear respawn timer
    this.respawnTimers.delete(mobId);
    
    // Create mob entity via EntityManager
    if (this.entityManager) {
      try {
        const config = this.MOB_CONFIGS[mob.type];
        if (config) {
          this.world.emit('mob:spawn', {
            mobType: config.type,
            level: config.level,
            position: mob.position,
            respawnTime: config.respawnTime
          });
          
          console.log(`[RPGMobSystem] Respawned ${config.type}: ${mobId}`);
        }
      } catch (error) {
        console.error(`[RPGMobSystem] Failed to respawn mob ${mobId}:`, error);
      }
    }
    
    // Re-register with combat system and AI system
    this.world.emit?.('rpg:mob:register', mob);
    this.world.emit?.('rpg:mob:spawned', { 
      mob: {
        id: mobId,
        mobData: this.MOB_CONFIGS[mob.type],
        currentHealth: mob.health,
        isAlive: true,
        homePosition: { x: mob.homePosition.x, y: mob.homePosition.y, z: mob.homePosition.z },
        spawnPoint: {
          respawnTime: mob.respawnTime,
          spawnRadius: mob.aggroRange
        }
      }
    });
    
    console.log(`[RPGMobSystem] Respawned ${mob.name} at spawn location`);
  }

  private generateLoot(mob: RPGMobData, killedBy: string): void {
    // Generate loot based on mob's loot table per GDD
    const loot = this.rollLootTable(mob.lootTable, mob.level);
    
    if (loot.length > 0) {
      // Create loot drop at mob's death location
      this.world.emit?.('rpg:world:create_loot_drop', {
        position: mob.position,
        items: loot,
        droppedBy: mob.name,
        killedBy: killedBy
      });
      
      console.log(`[RPGMobSystem] Generated ${loot.length} loot items from ${mob.name}`);
    }
  }

  private rollLootTable(lootTable: string, mobLevel: number): any[] {
    // Simplified loot generation - in full implementation would use proper loot tables
    const loot: any[] = [];
    
    // Always drop coins per GDD
    const coinAmount = Math.floor(mobLevel * (5 + Math.random() * 10));
    loot.push({ id: 1000, name: 'Coins', quantity: coinAmount, stackable: true });
    
    // Chance for equipment drops based on mob level
    const equipmentChance = Math.min(0.1 + (mobLevel * 0.01), 0.3); // 10-30% chance
    if (Math.random() < equipmentChance) {
      // Generate appropriate tier equipment
      if (mobLevel <= 5) {
        loot.push({ id: 2001, name: 'Bronze sword', quantity: 1, stackable: false });
      } else if (mobLevel <= 15) {
        loot.push({ id: 2002, name: 'Steel sword', quantity: 1, stackable: false });
      } else {
        loot.push({ id: 2003, name: 'Mithril sword', quantity: 1, stackable: false });
      }
    }
    
    // Dark Rangers drop arrows commonly per GDD
    if (lootTable === 'dark_ranger_drops') {
      loot.push({ id: 3001, name: 'Arrows', quantity: 10 + Math.floor(Math.random() * 20), stackable: true });
    }
    
    return loot;
  }

  private startAILoop(): void {
    this.aiUpdateInterval = setInterval(() => {
      this.updateAllMobAI();
    }, this.AI_UPDATE_INTERVAL);
  }

  private updateAllMobAI(): void {
    const now = Date.now();
    
    for (const mob of this.mobs.values()) {
      if (!mob.isAlive) continue;
      
      // Update mob AI
      this.updateMobAI(mob, now);
    }
  }

  private updateMobAI(mob: RPGMobData, now: number): void {
    // Simple AI state machine
    switch (mob.aiState) {
      case 'idle':
        this.handleIdleAI(mob, now);
        break;
      case 'patrolling':
        this.handlePatrolAI(mob, now); 
        break;
      case 'chasing':
        this.handleChaseAI(mob, now);
        break;
      case 'attacking':
        this.handleAttackAI(mob, now);
        break;
      case 'returning':
        this.handleReturnAI(mob, now);
        break;
    }
    
    mob.lastAI = now;
  }

  private handleIdleAI(mob: RPGMobData, now: number): void {
    if (!mob.isAggressive) return;
    
    // Look for nearby players to aggro
    const nearbyPlayer = this.findNearbyPlayer(mob);
    if (nearbyPlayer) {
      mob.target = nearbyPlayer.id;
      mob.aiState = 'chasing';
      console.log(`[RPGMobSystem] ${mob.name} aggroed onto ${nearbyPlayer.name}`);
    }
  }

  private handlePatrolAI(mob: RPGMobData, now: number): void {
    // Simple patrol behavior - move randomly around home position
    if (now - mob.lastAI > 3000) { // Change direction every 3 seconds
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 5;
      
      mob.position.x = mob.homePosition.x + Math.cos(angle) * distance;
      mob.position.z = mob.homePosition.z + Math.sin(angle) * distance;
      
      // Update position in world
      this.world.emit?.('rpg:mob:position:update', {
        entityId: mob.id,
        position: mob.position
      });
    }
    
    // Check for aggro while patrolling
    if (mob.isAggressive) {
      const nearbyPlayer = this.findNearbyPlayer(mob);
      if (nearbyPlayer) {
        mob.target = nearbyPlayer.id;
        mob.aiState = 'chasing';
      }
    }
  }

  private handleChaseAI(mob: RPGMobData, now: number): void {
    if (!mob.target) {
      mob.aiState = 'returning';
      return;
    }
    
    const targetPlayer = this.getPlayer(mob.target);
    if (!targetPlayer) {
      mob.target = undefined;
      mob.aiState = 'returning';
      return;
    }
    
    const distance = this.calculateDistance(mob.position, targetPlayer.position);
    
    // Check if too far from home - return if so
    const homeDistance = this.calculateDistance(mob.position, mob.homePosition);
    if (homeDistance > this.MAX_CHASE_DISTANCE) {
      mob.target = undefined;
      mob.aiState = 'returning';
      return;
    }
    
    // If in attack range, start attacking
    const attackRange = mob.equipment.weapon?.type === 'ranged' ? 8 : 2;
    if (distance <= attackRange) {
      mob.aiState = 'attacking';
      // Start combat with player
      this.world.emit?.('rpg:combat:start_attack', {
        attackerId: mob.id,
        targetId: mob.target
      });
      return;
    }
    
    // Move towards target
    this.moveTowardsTarget(mob, targetPlayer.position);
  }

  private handleAttackAI(mob: RPGMobData, now: number): void {
    if (!mob.target) {
      mob.aiState = 'idle';
      return;
    }
    
    const targetPlayer = this.getPlayer(mob.target);
    if (!targetPlayer || !targetPlayer.isAlive) {
      mob.target = undefined;
      mob.aiState = 'idle';
      return;
    }
    
    const distance = this.calculateDistance(mob.position, targetPlayer.position);
    const attackRange = mob.equipment.weapon?.type === 'ranged' ? 8 : 2;
    
    // If target moved out of range, chase again
    if (distance > attackRange * 1.5) {
      mob.aiState = 'chasing';
      return;
    }
    
    // Combat system handles the actual attacking
  }

  private handleReturnAI(mob: RPGMobData, now: number): void {
    const homeDistance = this.calculateDistance(mob.position, mob.homePosition);
    
    if (homeDistance <= 1) {
      mob.aiState = 'idle';
      return;
    }
    
    // Move towards home
    this.moveTowardsTarget(mob, mob.homePosition);
  }

  private findNearbyPlayer(mob: RPGMobData): any {
    const players = this.world.entities?.getPlayers?.() || [];
    
    for (const player of players) {
      if (!player?.position) continue;
      
      const distance = this.calculateDistance(mob.position, player.position);
      if (distance <= mob.aggroRange) {
        // Get player combat level for level-based aggro checks
        const playerCombatLevel = (this.world as any).rpg?.getCombatLevel?.(player.id) || 1;
        
        // GDD: High-level players ignored by low-level aggressive mobs (except special cases)
        if (mob.level < 15 && playerCombatLevel > mob.level * 2) {
          continue; // Skip high-level players for low-level mobs
        }
        
        // Special cases: Dark Warriors and higher always aggressive per GDD
        if (mob.type === 'dark_warrior' || mob.type === 'black_knight' || 
            mob.type === 'ice_warrior' || mob.type === 'dark_ranger') {
          return player; // Always aggressive regardless of player level
        }
        
        return player;
      }
    }
    
    return null;
  }

  private getPlayer(playerId: string): any {
    // Get specific player from player system
    return this.world.getPlayer?.(playerId);
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private moveTowardsTarget(mob: RPGMobData, targetPosition: { x: number; y: number; z: number }): void {
    const dx = targetPosition.x - mob.position.x;
    const dz = targetPosition.z - mob.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance > 0) {
      const speed = 2; // units per second
      const moveX = (dx / distance) * speed * (this.AI_UPDATE_INTERVAL / 1000);
      const moveZ = (dz / distance) * speed * (this.AI_UPDATE_INTERVAL / 1000);
      
      mob.position.x += moveX;
      mob.position.z += moveZ;
      
      // Update position in world
      this.world.emit?.('rpg:mob:position:update', {
        entityId: mob.id,
        position: mob.position
      });
    }
  }

  private onPlayerEnter(playerData: any): void {
    // When a player enters, check if any mobs should aggro
    // This is handled by the regular AI loop
  }

  // Public API for other systems
  getMob(mobId: string): RPGMobData | undefined {
    return this.mobs.get(mobId);
  }

  getAllMobs(): RPGMobData[] {
    return Array.from(this.mobs.values());
  }

  getMobsInArea(center: { x: number; y: number; z: number }, radius: number): RPGMobData[] {
    return Array.from(this.mobs.values()).filter(mob => {
      const distance = this.calculateDistance(mob.position, center);
      return distance <= radius && mob.isAlive;
    });
  }

  getMobsByType(type: RPGMobData['type']): RPGMobData[] {
    return Array.from(this.mobs.values()).filter(mob => mob.type === type && mob.isAlive);
  }


  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Try to get EntityManager if we don't have it yet
    if (!this.entityManager) {
      this.entityManager = (this.world as any)['rpg-entity-manager'];
      if (this.entityManager && this.mobs.size === 0) {
        console.log('[RPGMobSystem] EntityManager now available, spawning initial mobs');
        this.spawnAllMobs();
      }
    }
    
    // Update mob states and positions if needed
    if (this.mobs.size > 0) {
      for (const mob of this.mobs.values()) {
        if (mob.isAlive) {
          // Sync position updates with EntityManager if needed
          this.world.emit?.('entity:position:update', {
            entityId: mob.id,
            position: [mob.position.x, mob.position.y, mob.position.z]
          });
        }
      }
    }
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}

  // Public API for testing and external access
  public getActiveMobCount(): number {
    return this.mobs.size;
  }

  public getSpawnPointCount(): number {
    return this.spawnPoints.size;
  }

  public testSpawnMob(type: RPGMobData['type'], position: { x: number; y: number; z: number }): boolean {
    try {
      this.spawnMobAtLocation({ type, position });
      return true;
    } catch (error) {
      console.error('[RPGMobSystem] Test spawn failed:', error);
      return false;
    }
  }
}