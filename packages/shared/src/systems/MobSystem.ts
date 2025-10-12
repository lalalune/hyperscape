
import type { Item } from '../types/core';
import { AttackType, EquipmentSlotName, ItemType, WeaponType } from '../types/core';
import { ItemRarity, MobType } from '../types/entities';
import { EventType } from '../types/events';
import type { Player, World } from '../types/index';
import { SystemBase } from './SystemBase';
// World eliminated - using base World instead
import { ALL_MOBS, MOB_SPAWN_CONSTANTS } from '../data/mobs';
import { ALL_WORLD_AREAS } from '../data/world-areas';
import { MobInstance, MobSpawnConfig } from '../types/core';
import { calculateDistance, groundToTerrain } from '../utils/EntityUtils';
import { EntityManager } from './EntityManager';
import type { XPSystem } from '../types/system-interfaces';

/**
 * Mob System - GDD Compliant
 * Handles mob spawning, AI behavior, and lifecycle management per GDD specifications:
 * - 15-minute global respawn cycle
 * - Fixed spawn locations with biome-appropriate mobs
 * - Aggressive vs non-aggressive behavior based on mob type
 * - Level-based aggro (high-level players ignored by low-level aggressive mobs)
 * - Combat integration with player combat system
 */
export class MobSystem extends SystemBase {
  private mobs = new Map<string, MobInstance>();
  private spawnPoints = new Map<string, { config: MobSpawnConfig, position: { x: number; y: number; z: number } }>();
  private respawnTimers = new Map<string, number>(); // Changed to store respawn times instead of timers
  private lastAIUpdate = 0;
  private entityManager?: EntityManager;
  private mobIdCounter = 0;
  
  private readonly GLOBAL_RESPAWN_TIME = MOB_SPAWN_CONSTANTS.GLOBAL_RESPAWN_TIME;
  private readonly AI_UPDATE_INTERVAL = 1000; // 1 second AI updates
  private readonly MAX_CHASE_DISTANCE = 20; // Maximum chase distance before returning home
  
  // Mob configurations loaded from externalized data
  private readonly MOB_CONFIGS: Record<string, MobSpawnConfig> = this.createMobConfigs();
  /**
   * Convert externalized MobData to MobSpawnConfig format
   */
  private createMobConfigs(): Record<string, MobSpawnConfig> {
    const configs: Record<string, MobSpawnConfig> = {};
    
    for (const [mobId, mobData] of Object.entries(ALL_MOBS)) {
      configs[mobId] = {
        type: mobId as MobType,
        name: mobData.name,
        level: mobData.stats.level,
        stats: {
          attack: mobData.stats.attack,
          strength: mobData.stats.strength,
          defense: mobData.stats.defense,
          constitution: mobData.stats.constitution,
          ranged: mobData.stats.ranged
        },
        equipment: {
        weapon: null,
        armor: null
      }, // Equipment can be added later if needed
        lootTable: `${mobId}_drops`,
        isAggressive: mobData.behavior.aggressive,
        aggroRange: mobData.behavior.aggroRange,
        respawnTime: mobData.respawnTime || this.GLOBAL_RESPAWN_TIME
      };
    }
    
    return configs;
  }

  constructor(world: World) {
    super(world, {
      name: 'mob',
      dependencies: {
        required: ['entity-manager'], // Needs entity manager to spawn/manage mobs
        optional: ['player', 'combat'] // Better with player and combat systems
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Set up type-safe event subscriptions
    // ENTITY_DEATH is in EventMap but only has entityId
    this.subscribe(EventType.ENTITY_DEATH, (data) => this.handleMobDeath({ entityId: data.entityId, killedBy: '', entityType: 'mob' }));
    // ENTITY_DAMAGE_TAKEN is not in EventMap, so it receives the full event
    this.subscribe(EventType.ENTITY_DAMAGE_TAKEN, (data) => this.handleMobDamage(data as { entityId: string; damage: number; damageSource: string; entityType: 'player' | 'mob' }));
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => this.onPlayerEnter(data));
    this.subscribe(EventType.MOB_SPAWN_REQUEST, (data) => this.spawnMobAtLocation(data));
    
    // Initialize spawn points (these would normally be loaded from world data)
    this.initializeSpawnPoints();
    
    // Initialize AI update timing for frame-based updates
    this.lastAIUpdate = Date.now();
  }

  start(): void {
    
    // Get reference to EntityManager
    this.entityManager = this.world.getSystem<EntityManager>('entity-manager');
    // DISABLED: MobSpawnerSystem already handles spawning all mobs
    // Having both systems spawn causes duplicates and memory issues
    // if (this.entityManager) {
    //   this.spawnAllMobs();
    // }
  }

  private onPlayerEnter(_data: unknown): void {
    // Handle player entering the world
    // Could spawn mobs around the player or adjust mob behavior
      }

  private initializeSpawnPoints(): void {
    // Load spawn points from externalized world areas data
    let spawnId = 1;
    
    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      if (area.mobSpawns && area.mobSpawns.length > 0) {
        for (const mobSpawn of area.mobSpawns) {
          const config = this.MOB_CONFIGS[mobSpawn.mobId];
          if (config) {
            // Generate multiple spawn points within the spawn radius
            for (let i = 0; i < mobSpawn.maxCount; i++) {
              // Generate random position within spawn radius
              const angle = Math.random() * Math.PI * 2;
              const distance = Math.random() * mobSpawn.spawnRadius;
              const position = {
                x: mobSpawn.position.x + Math.cos(angle) * distance,
                y: mobSpawn.position.y || 0, // Use specified Y or default to 0 (will be grounded to terrain)
                z: mobSpawn.position.z + Math.sin(angle) * distance
              };

              this.spawnPoints.set(`${areaId}_spawn_${spawnId}`, { config, position });
              spawnId++;
            }
          }
        }
      }
    }
  }

  private spawnAllMobs(): void {
    for (const [spawnId, spawnData] of this.spawnPoints.entries()) {
      // Emit spawn request instead of directly spawning
      // This allows EntityManager to handle the actual entity creation
      this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
        mobType: spawnData.config.type,
        position: spawnData.position,
        level: spawnData.config.level,
        name: spawnData.config.name,
        customId: `mob_${spawnId}_${Date.now()}`
      });
    }
  }

  private async spawnMobInternal(spawnId: string, config: MobSpawnConfig, position: { x: number; y: number; z: number }): Promise<string | null> {
    if (!this.entityManager) {
      return null;
    }
    
    // Ground mob to terrain - use Infinity to allow any initial height difference
    const groundedPosition = groundToTerrain(this.world, position, 0.5, Infinity);
    
    const mobId = `mob_${spawnId}_${Date.now()}`;
    
    const mobData: MobInstance = {
      id: mobId,
      type: config.type,
      name: config.name,
      description: config.description || `A ${config.name}`,
      difficultyLevel: config.difficultyLevel || 1,
      mobType: config.type,
      behavior: config.behavior || {
        aggressive: config.isAggressive,
        aggroRange: config.aggroRange,
        chaseRange: config.aggroRange * 2,
        returnToSpawn: true,
        ignoreLowLevelPlayers: false,
        levelThreshold: 10
      },
      drops: config.drops || [],
      spawnBiomes: config.spawnBiomes || ['plains'],
      modelPath: config.modelPath || `/models/mobs/${config.type}.glb`,
      animationSet: config.animationSet || {
        idle: 'idle',
        walk: 'walk', 
        attack: 'attack',
        death: 'death'
      },
      respawnTime: config.respawnTime,
      xpReward: config.xpReward || config.level * 10,
      level: config.level,
      health: (config.stats?.constitution || 10) * 10, // Health = Constitution * 10 per GDD
      maxHealth: (config.stats?.constitution || 10) * 10,
      position: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
      isAlive: true,
      isAggressive: config.isAggressive,
      aggroRange: config.aggroRange,
      aiState: 'idle' as const,
      homePosition: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
      spawnLocation: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
      equipment: {
        weapon: config.equipment?.weapon ? {
          id: 1,
          name: config.equipment.weapon.name || 'Basic Weapon',
          type: config.equipment.weapon.type === 'ranged' ? AttackType.RANGED : AttackType.MELEE
        } : null,
        armor: config.equipment?.armor ? {
          id: 1,
          name: config.equipment.armor.name || 'Basic Armor'
        } : null
      },
      lootTable: config.lootTable,
      lastAI: Date.now(),
      stats: {
        level: config.level, 
        health: (config.stats?.constitution || 10) * 10,
        attack: config.stats?.attack || 1, 
        strength: config.stats?.strength || 1, 
        defense: config.stats?.defense || 1, 
        constitution: config.stats?.constitution || 10, 
        ranged: config.stats?.ranged || 1 
      },
      target: null,
      wanderRadius: 5 // Default wander radius
    };

    this.mobs.set(mobId, mobData);
    
    // EntityManager will emit MOB_SPAWNED after creating the entity
    // We don't need to emit it here anymore
    
    // Wait for entity to be created by EntityManager
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const entity = this.world.entities.get(mobId);
        if (entity) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
      
      // Timeout after 2 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 2000);
    });
    
    return mobId;
  }

  private spawnMobAtLocation(data: { mobType: string; position: { x: number; y: number; z: number } }): void {
    const config = this.MOB_CONFIGS[data.mobType];
    if (!config) {
      return;
    }

    const spawnId = `custom_${Date.now()}_${++this.mobIdCounter}`;
    this.spawnMobInternal(spawnId, config, data.position);
  }

  private handleMobDamage(data: { entityId: string; damage: number; damageSource: string; entityType: 'player' | 'mob' }): void {
    if (data.entityType !== 'mob') return;
    
    // Validate entityId is defined
    if (!data.entityId) {
      console.warn('[MobSystem] handleMobDamage called with undefined entityId');
      return;
    }
    
    const mob = this.mobs.get(data.entityId);
    if (!mob || !mob.isAlive) return;

    // Apply damage
    mob.health = Math.max(0, mob.health - data.damage);
    
    // Emit damage event for AI system
    this.emitTypedEvent(EventType.MOB_ATTACKED, {
      mobId: data.entityId,
      damage: data.damage,
      attackerId: data.damageSource
    });
    
    // Check if mob died from damage
    if (mob.health <= 0) {
      // Let handleMobDeath emit the proper event with all data
      this.handleMobDeath({
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
    
    // Loot generation is now handled by LootSystem via mob:died event
            // this.generateLoot(mob);
    
    // Schedule respawn per GDD (15-minute global cycle)
    const respawnTime = Date.now() + mob.respawnTime;
    this.respawnTimers.set(data.entityId, respawnTime);
    
    // Emit mob death event with all necessary data for LootSystem
    this.emitTypedEvent(EventType.MOB_DIED, {
      mobId: data.entityId,
      killerId: data.killedBy,
      loot: []
    });
  }

  private respawnMob(mobId: string): void {
    const mob = this.mobs.get(mobId);
    if (!mob) return;

    // Ground spawn location to terrain before respawning - use Infinity to allow any initial height difference
    const groundedPosition = groundToTerrain(this.world, mob.spawnLocation, 0.5, Infinity);

    // Reset mob to spawn state
    mob.isAlive = true;
    mob.health = mob.maxHealth;
    mob.position = { ...groundedPosition };
    mob.homePosition = { ...groundedPosition };
    mob.aiState = 'idle';
    mob.target = null;
    mob.lastAI = Date.now();

    // Clear respawn timer
    this.respawnTimers.delete(mobId);
    
    // Request mob respawn via EntityManager
    if (this.entityManager) {
      const config = this.MOB_CONFIGS[mob.type];
      if (config) {
        // Emit a spawn request - EntityManager will create the entity and emit MOB_SPAWNED
        this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
          mobType: config.type,
          position: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
          level: config.level,
          name: config.name,
          customId: mobId
        });
      }
    }
  }

  private generateLoot(mob: MobInstance): void {
    // Generate loot based on mob's loot table per GDD
    const loot = this.rollLootTable(mob.lootTable, mob.level);
    
    if (loot.length > 0) {
      // Create loot drop at mob's death location
      this.emitTypedEvent(EventType.ITEM_SPAWN_LOOT, {
        lootTable: mob.type,
        position: { x: mob.position.x, y: mob.position.y, z: mob.position.z }
      });
    }
  }

  private rollLootTable(lootTable: string, mobLevel: number): Array<{ item: Item; quantity: number }> {
    // Simplified loot generation - in full implementation would use proper loot tables
    const loot: Array<{ item: Item; quantity: number }> = [];
    
    // Always drop coins per GDD
    const coinAmount = Math.floor(mobLevel * (5 + Math.random() * 10));
    loot.push({ 
      item: { 
        id: '1000', 
        name: 'Coins', 
        type: ItemType.CURRENCY,
        quantity: coinAmount,
        stackable: true,
        maxStackSize: 999,
        value: 1,
        weight: 0,
        equipSlot: null,
                    weaponType: WeaponType.NONE,
        equipable: false,
        attackType: null,
        description: 'Gold coins used as currency',
        examine: 'Gleaming gold coins',
        tradeable: true,
        rarity: ItemRarity.COMMON,
        modelPath: 'items/coins.glb',
        iconPath: 'icons/coins.png',
        healAmount: 0,
        stats: { attack: 0, defense: 0, strength: 0 },
        bonuses: { attack: 0, defense: 0, strength: 0 },
        requirements: { level: 1, skills: {} }
      },
      quantity: coinAmount
    });
    
    // Chance for equipment drops based on mob level
    const equipmentChance = Math.min(0.1 + (mobLevel * 0.01), 0.3); // 10-30% chance
    if (Math.random() < equipmentChance) {
      // Generate appropriate tier equipment
      if (mobLevel <= 5) {
        loot.push({ 
          item: {
            id: '2001', 
            name: 'Bronze sword', 
            type: ItemType.WEAPON,
            quantity: 1,
            stackable: false,
            maxStackSize: 1,
            value: 10,
            weight: 5,
            equipSlot: EquipmentSlotName.WEAPON,
            weaponType: WeaponType.SWORD,
            equipable: true,
            attackType: AttackType.MELEE,
            description: 'A basic bronze sword',
            examine: 'A well-crafted bronze blade',
            tradeable: true,
            rarity: ItemRarity.COMMON,
            modelPath: 'items/bronze_sword.glb',
            iconPath: 'icons/bronze_sword.png',
            healAmount: 0,
            stats: { attack: 5, defense: 0, strength: 2 },
            bonuses: { attack: 5, defense: 0, strength: 2 },
            requirements: { level: 1, skills: {} }
          },
          quantity: 1
        });
      } else if (mobLevel <= 15) {
        loot.push({ 
          item: {
            id: '2002', 
            name: 'Steel sword', 
            type: ItemType.WEAPON,
            quantity: 1,
            stackable: false,
            maxStackSize: 1,
            value: 50,
            weight: 6,
            equipSlot: EquipmentSlotName.WEAPON,
            weaponType: WeaponType.SWORD,
            equipable: true,
            attackType: AttackType.MELEE,
            description: 'A sturdy steel sword',
            examine: 'A well-forged steel blade',
            tradeable: true,
            rarity: ItemRarity.UNCOMMON,
            modelPath: 'items/steel_sword.glb',
            iconPath: 'icons/steel_sword.png',
            healAmount: 0,
            stats: { attack: 12, defense: 0, strength: 5 },
            bonuses: { attack: 12, defense: 0, strength: 5 },
            requirements: { level: 10, skills: {} }
          },
          quantity: 1
        });
      } else {
        loot.push({ 
          item: {
            id: '2003', 
            name: 'Mithril sword', 
            type: ItemType.WEAPON,
            quantity: 1,
            stackable: false,
            maxStackSize: 1,
            value: 250,
            weight: 4,
            equipSlot: EquipmentSlotName.WEAPON,
            weaponType: WeaponType.SWORD,
            equipable: true,
            attackType: AttackType.MELEE,
            description: 'A masterfully crafted mithril sword',
            examine: 'A gleaming blade of pure mithril',
            tradeable: true,
            rarity: ItemRarity.RARE,
            modelPath: 'items/mithril_sword.glb',
            iconPath: 'icons/mithril_sword.png',
            healAmount: 0,
            stats: { attack: 25, defense: 0, strength: 10 },
            bonuses: { attack: 25, defense: 0, strength: 10 },
            requirements: { level: 20, skills: {} }
          },
          quantity: 1
        });
      }
    }
    
    // Dark Rangers drop arrows commonly per GDD
    if (lootTable === 'dark_ranger_drops') {
      loot.push({ 
        item: {
          id: '3001', 
          name: 'Arrows', 
          type: ItemType.AMMUNITION,
          quantity: 10 + Math.floor(Math.random() * 20),
          stackable: true,
          maxStackSize: 100,
          value: 1,
          weight: 0.1,
          equipSlot: EquipmentSlotName.ARROWS,
                      weaponType: WeaponType.NONE,
          equipable: true,
          attackType: AttackType.RANGED,
          description: 'Sharp arrows for ranged combat',
          examine: 'Well-crafted arrows with steel tips',
          tradeable: true,
          rarity: ItemRarity.COMMON,
          modelPath: 'items/arrows.glb',
          iconPath: 'icons/arrows.png',
          healAmount: 0,
          stats: { attack: 0, defense: 0, strength: 0 },
          bonuses: { attack: 0, ranged: 2, strength: 2 },
          requirements: { level: 1, skills: {} }
        },
        quantity: 10 + Math.floor(Math.random() * 20)
      });
    }
    
    return loot;
  }

  // Public API methods for integration tests
  public getAllMobs(): MobInstance[] {
    return Array.from(this.mobs.values());
  }

  public getMob(mobId: string): MobInstance | undefined {
    return this.mobs.get(mobId);
  }

  public getMobsInArea(center: { x: number; y: number; z: number }, radius: number): MobInstance[] {
    return Array.from(this.mobs.values()).filter(mob => {
      if (!mob.isAlive) return false;
      const distance = calculateDistance(mob.position, center);
      return distance <= radius;
    });
  }

  /**
   * Public method to spawn a mob for testing/dynamic purposes
   */
  public async spawnMob(config: MobSpawnConfig, position: { x: number; y: number; z: number }): Promise<string | null> {


    // Convert the config to the internal MobSpawnConfig format
    const mobConfig: MobSpawnConfig = {
      type: config.type,
      name: config.name,
      level: config.level,
      stats: config.stats ?? {
        attack: config.level,
        strength: config.level,
        defense: config.level,
        constitution: 30,
        ranged: 1
      },
      equipment: {
        weapon: null,
        armor: null
      },
      lootTable: 'default',
      isAggressive: config.isAggressive !== false, // Default to true if not specified
      aggroRange: config.aggroRange ?? 5,
      respawnTime: config.respawnTime ?? 0
    };

    const timestamp = Date.now();
    const spawnId = `test_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // spawnMobInternal now returns the actual mob ID
    const mobId = await this.spawnMobInternal(spawnId, mobConfig, position);
    
    return mobId;
  }

  private updateAllMobAI(): void {
    const now = Date.now();
    
    for (const mob of this.mobs.values()) {
      if (!mob.isAlive) continue;
      
      // Update mob AI
      this.updateMobAI(mob, now);
    }
  }

  private updateMobAI(mob: MobInstance, now: number): void {
    // Simple AI state machine
    switch (mob.aiState) {
      case 'idle':
        this.handleIdleAI(mob);
        break;
      case 'patrolling':
        this.handlePatrolAI(mob, now); 
        break;
      case 'chasing':
        this.handleChaseAI(mob);
        break;
      case 'attacking':
        this.handleAttackAI(mob);
        break;
      case 'returning':
        this.handleReturnAI(mob);
        break;
    }
    
    mob.lastAI = now;
  }

  private handleIdleAI(mob: MobInstance): void {
    if (!mob.isAggressive || !mob.position) return;
    
    // Validate position has valid coordinates
    if (typeof mob.position.x !== 'number' || 
        typeof mob.position.y !== 'number' || 
        typeof mob.position.z !== 'number') {
      console.warn(`[MobSystem] Mob ${mob.id} has invalid position coordinates`, mob.position);
      return;
    }
    
    // Look for nearby players to aggro
    const nearbyPlayer = this.findNearbyPlayer(mob);
    if (nearbyPlayer) {
       
      mob.target = nearbyPlayer.id;
      mob.aiState = 'chasing';
    }
  }

  private handlePatrolAI(mob: MobInstance, now: number): void {
    // Validate positions before using
    if (!mob.position || !mob.homePosition ||
        typeof mob.position.x !== 'number' || typeof mob.position.y !== 'number' || typeof mob.position.z !== 'number' ||
        typeof mob.homePosition.x !== 'number' || typeof mob.homePosition.y !== 'number' || typeof mob.homePosition.z !== 'number') {
      console.warn(`[MobSystem] Mob ${mob.id} has invalid position for patrol`, { position: mob.position, homePosition: mob.homePosition });
      return;
    }
    
    // Simple patrol behavior - move randomly around home position
    if (now - mob.lastAI > 3000) { // Change direction every 3 seconds
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 5;
      
      mob.position.x = mob.homePosition.x + Math.cos(angle) * distance;
      mob.position.z = mob.homePosition.z + Math.sin(angle) * distance;
      
      // Update position in world
      this.emitTypedEvent(EventType.MOB_POSITION_UPDATED, {
        entityId: mob.id,
        position: { x: mob.position.x, y: mob.position.y, z: mob.position.z }
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

  private handleChaseAI(mob: MobInstance): void {
    if (!mob.target) {
      mob.aiState = 'returning';
      return;
    }
    
    // Validate mob position first
    if (!mob.position || 
        typeof mob.position.x !== 'number' || 
        typeof mob.position.y !== 'number' || 
        typeof mob.position.z !== 'number') {
      console.warn(`[MobSystem] handleChaseAI: Mob ${mob.id} has invalid position`, mob.position);
      mob.aiState = 'idle';
      return;
    }
    
    const targetPlayer = this.getPlayer(mob.target);
    if (!targetPlayer) {
      mob.target = null;
      mob.aiState = 'returning';
      return;
    }
    
    // Get player position, preferring the main position property, falling back to node.position
    const playerPosition = targetPlayer.position || (targetPlayer.node?.position ? 
      { x: targetPlayer.node.position.x, y: targetPlayer.node.position.y, z: targetPlayer.node.position.z } : null);
    
    if (!playerPosition) {
      console.warn(`[MobSystem] Target player ${targetPlayer.id} has no valid position`);
      mob.target = null;
      mob.aiState = 'returning';
      return;
    }
    
    const distance = calculateDistance(mob.position, playerPosition);
    
    // Check if too far from home - return if so
    if (mob.homePosition && 
        typeof mob.homePosition.x === 'number' && 
        typeof mob.homePosition.y === 'number' && 
        typeof mob.homePosition.z === 'number') {
      const homeDistance = calculateDistance(mob.position, mob.homePosition);
      if (homeDistance > this.MAX_CHASE_DISTANCE) {
        mob.target = null;
        mob.aiState = 'returning';
        return;
      }
    }
    
    // If in attack range, start attacking
    const attackRange = mob.equipment.weapon?.type === 'ranged' ? 8 : 2;
    if (distance <= attackRange) {
      mob.aiState = 'attacking';
      // Start combat with player
      this.emitTypedEvent(EventType.COMBAT_START_ATTACK, {
        attackerId: mob.id,
        targetId: mob.target
      });
      return;
    }
    
    // Move towards target
     
    this.moveTowardsTarget(mob, playerPosition);
  }

  private handleAttackAI(mob: MobInstance): void {
    if (!mob.target) {
      mob.aiState = 'idle';
      return;
    }
    
    // Validate mob position first
    if (!mob.position || 
        typeof mob.position.x !== 'number' || 
        typeof mob.position.y !== 'number' || 
        typeof mob.position.z !== 'number') {
      console.warn(`[MobSystem] handleAttackAI: Mob ${mob.id} has invalid position`, mob.position);
      mob.aiState = 'idle';
      return;
    }
    
    const targetPlayer = this.getPlayer(mob.target);
    
    if (!targetPlayer || (targetPlayer.health !== undefined && targetPlayer.health.current <= 0)) {
      mob.target = null;
      mob.aiState = 'idle';
      return;
    }
    
    // Get player position, preferring the main position property, falling back to node.position
    const playerPosition = targetPlayer.position || (targetPlayer.node?.position ? 
      { x: targetPlayer.node.position.x, y: targetPlayer.node.position.y, z: targetPlayer.node.position.z } : null);
    
    if (!playerPosition) {
      console.warn(`[MobSystem] Target player ${targetPlayer.id} has no valid position`);
      mob.target = null;
      mob.aiState = 'idle';
      return;
    }
    
    const distance = calculateDistance(mob.position, playerPosition);
    const attackRange = mob.equipment.weapon?.type === 'ranged' ? 8 : 2;
    
    // If target moved out of range, chase again
    if (distance > attackRange * 1.5) {
      mob.aiState = 'chasing';
      return;
    }
    
    // Combat system handles the actual attacking
  }

  private handleReturnAI(mob: MobInstance): void {
    // Validate positions before using
    if (!mob.position || !mob.homePosition ||
        typeof mob.position.x !== 'number' || typeof mob.position.y !== 'number' || typeof mob.position.z !== 'number' ||
        typeof mob.homePosition.x !== 'number' || typeof mob.homePosition.y !== 'number' || typeof mob.homePosition.z !== 'number') {
      console.warn(`[MobSystem] handleReturnAI: Mob ${mob.id} has invalid position for returning`, { position: mob.position, homePosition: mob.homePosition });
      mob.aiState = 'idle';
      return;
    }
    
    const homeDistance = calculateDistance(mob.position, mob.homePosition);
    
    if (homeDistance <= 1) {
      mob.aiState = 'idle';
      return;
    }
    
    // Move towards home
    this.moveTowardsTarget(mob, mob.homePosition);
  }

  private findNearbyPlayer(mob: MobInstance): Player | null {
    const players = this.world.getPlayers();
    
    // Validate mob position before processing
    if (!mob.position || 
        typeof mob.position.x !== 'number' || 
        typeof mob.position.y !== 'number' || 
        typeof mob.position.z !== 'number') {
      console.warn(`[MobSystem] findNearbyPlayer: Mob ${mob.id} has invalid position`, mob.position);
      return null;
    }

    for (const player of players) {
      // Get player position, preferring the main position property, falling back to node.position
      let playerPosition: { x: number; y: number; z: number } | null = null;

      if (player.position) {
        playerPosition = player.position;
      } else if (player.node?.position && typeof player.node.position.x === 'number' &&
                 typeof player.node.position.y === 'number' && typeof player.node.position.z === 'number') {
        playerPosition = { x: player.node.position.x, y: player.node.position.y, z: player.node.position.z };
      }

      if (!playerPosition) {
        console.warn(`[MobSystem] Player ${player.id} has no valid position`);
        continue;
      }

      const distance = calculateDistance(mob.position, playerPosition);
      if (distance <= mob.aggroRange) {
        // Get player combat level for level-based aggro checks
        // Get player combat level through the API

        const xpSystem = this.world.getSystem('XPSystem') as XPSystem;
        const playerCombatLevel = xpSystem?.getCombatLevel?.(player.id) || 1;

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

  private getPlayer(playerId: string): Player | null {
    // Get specific player from player system
    return this.world.getPlayer(playerId);
  }

  /**
   * Despawn a mob immediately
   * Used by test systems and cleanup operations
   */
  public despawnMob(mobId: string): boolean {
    if (!mobId) {
      return false;
    }

    const mob = this.mobs.get(mobId);
    if (!mob) {
      return false;
    }

    // Mark as dead and remove from active mobs
    mob.isAlive = false;
    mob.aiState = 'dead';
    
    // Clear any respawn timer
    const respawnTimer = this.respawnTimers.get(mobId);
    if (respawnTimer) {
      this.respawnTimers.delete(mobId);
    }

    // Remove from mobs collection
    this.mobs.delete(mobId);

    // Emit despawn event for cleanup
    this.emitTypedEvent(EventType.MOB_DESPAWN, {
      mobId,
      mobType: mob.type,
      position: { x: mob.position.x, y: mob.position.y, z: mob.position.z }
    });

    return true;
  }

  /**
   * Despawn all mobs (used for cleanup)
   */
  public despawnAllMobs(): number {
    const mobIds = Array.from(this.mobs.keys());
    let despawnedCount = 0;

    for (const mobId of mobIds) {
      if (this.despawnMob(mobId)) {
        despawnedCount++;
      }
    }

    return despawnedCount;
  }

  /**
   * Force kill a mob without loot or respawn
   */
  public killMob(mobId: string): boolean {
    const mob = this.mobs.get(mobId);
    if (!mob) {
      return false;
    }
    
    if (!mob.isAlive) {
      return false;
    }

    // Trigger death without loot
    this.emitTypedEvent(EventType.MOB_DIED, {
      entityId: mobId,
      killedBy: 'system',
      entityType: 'mob'
    });

    return true;
  }

  /**
   * Move mob towards target position
   * DISABLED: Movement now handled by MobEntity which properly syncs to clients
   */
  private moveTowardsTarget(_mob: MobInstance, _targetPosition: { x: number; y: number; z: number }): void {
    // DISABLED: MobEntity.serverUpdate() handles all mob AI and movement
    // Direct mob.position modification does not trigger network sync!
    // MobEntity uses Entity.setPosition() → Entity.markNetworkDirty() → EntityManager broadcasts
  }

  /**
   * Main update loop - preserve AI and respawn logic
   */
  update(_dt: number): void {
    const now = Date.now();
    
    // Update AI at fixed intervals
    if (now - this.lastAIUpdate >= this.AI_UPDATE_INTERVAL) {
      this.lastAIUpdate = now;
      this.updateAllMobAI();
    }
    
    // Check respawn timers
    for (const [mobId, respawnTime] of this.respawnTimers.entries()) {
      if (now >= respawnTime) {
        this.respawnTimers.delete(mobId);
        this.respawnMob(mobId);
      }
    }
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all respawn timers
    this.respawnTimers.clear();
    
    // Despawn all mobs
    this.despawnAllMobs();
    
    // Clear all mob data
    this.mobs.clear();
    this.spawnPoints.clear();
    // Clear system references
    this.entityManager = undefined;
    
    // Reset timing
    this.lastAIUpdate = 0;
    

    
    // Call parent cleanup
    super.destroy();
  }
}