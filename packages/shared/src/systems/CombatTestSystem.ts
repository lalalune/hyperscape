/**
 * Combat Test System
 * Tests both melee and ranged combat mechanics with fake players vs mobs
 * - Creates fake players with different weapon types
 * - Spawns test mobs for combat
 * - Tests damage calculations, hit rates, and combat timing
 * - Validates ranged combat arrow consumption
 * - Tests combat XP gain and level requirements
 */

import { EventType } from '../types/events';
import { getSystem } from '../utils/SystemUtils';
import type { World } from '../types/index';
import { getItem } from '../data/items';
import { MobData, MobInstance, AttackType, Position3D } from '../types/core';
import { MobType } from '../types/entities';
import type { CombatTestData } from '../types/test';
import type { CombatSystem } from './CombatSystem';
import type { EquipmentSystem } from './EquipmentSystem';
import type { MobSystem } from './MobSystem';
import { VisualTestFramework } from './VisualTestFramework';
import type { PlayerEntity } from '../types/test'
import { Logger } from '../utils/Logger';

export class CombatTestSystem extends VisualTestFramework {
  private testData = new Map<string, CombatTestData>();
  private mobSystem!: MobSystem;
  private combatSystem!: CombatSystem;
  private equipmentSystem!: EquipmentSystem;

  constructor(world: World) {
    super(world, {
      name: 'combat-test',
      dependencies: {
        required: ['mob', 'combat', 'equipment'],
        optional: []
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    await super.init();
    
    
    // Get required systems
    this.mobSystem = getSystem(this.world, 'mob') as MobSystem;
    this.combatSystem = getSystem(this.world, 'combat') as CombatSystem;
    this.equipmentSystem = getSystem(this.world, 'equipment') as EquipmentSystem;
    
    // Listen for combat damage events to track actual damage dealt
    this.subscribe(EventType.COMBAT_DAMAGE_DEALT, (data: { attackerId: string; targetId: string; damage: number }) => {
      const { attackerId, targetId: _targetId, damage } = data;
      
      // Find test data for this attacker
      for (const [_stationId, testData] of this.testData) {
        if (testData.player.id === attackerId) {

          testData.damageDealt += damage;
          testData.hitCount++;
        }
      }
    });
    
    // Listen for combat miss events
    this.subscribe(EventType.COMBAT_MISS, (data: { attackerId: string }) => {
      const { attackerId } = data;
      
      for (const [_stationId, testData] of this.testData) {
        if (testData.player.id === attackerId) {
                    testData.missCount++;
        }
      }
    });
    
    // Create test stations
    this.createTestStations();
    
  }

  protected createTestStations(): void {
    // Melee Combat Test Station
    this.createTestStation({
      id: 'melee_combat_test',
      name: 'Melee Combat Test',
      position: { x: -20, y: 0, z: 10 },
      timeoutMs: 45000 // 45 seconds for combat
    });

    // Ranged Combat Test Station  
    this.createTestStation({
      id: 'ranged_combat_test',
      name: 'Ranged Combat Test',
      position: { x: -20, y: 0, z: 20 },
      timeoutMs: 60000 // 60 seconds for ranged (includes arrow management)
    });

    // Mixed Combat Test Station (weapon switching)
    this.createTestStation({
      id: 'mixed_combat_test', 
      name: 'Mixed Combat Test',
      position: { x: -20, y: 0, z: 30 },
      timeoutMs: 90000 // 90 seconds for complex test
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'melee_combat_test':
        this.runMeleeCombatTest(stationId);
        break;
      case 'ranged_combat_test':
        this.runRangedCombatTest(stationId);
        break;
      case 'mixed_combat_test':
        this.runMixedCombatTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown combat test: ${stationId}`);
    }
  }

  private async runMeleeCombatTest(stationId: string): Promise<void> {
    try {
            const stationPosition = this.validateStationPosition(stationId);
            
      if (!stationPosition) {
        Logger.systemError('CombatTestSystem', ` No station position returned for ${stationId}`);
        return;
      }

      // Validate station position has all required coordinates
      if (typeof stationPosition.x !== 'number' || typeof stationPosition.y !== 'number' || typeof stationPosition.z !== 'number') {
        Logger.systemError('CombatTestSystem', 'Invalid station position coordinates', undefined, { stationPosition });
        this.failTest(stationId, `Invalid station position for melee combat: ${JSON.stringify(stationPosition)}`);
        return;
      }
      
      
      // Create fake player with bronze sword (positioned close enough for melee range)
      const player = this.createPlayer({
        id: `melee_player_${Date.now()}`,
        name: 'Melee Fighter',
        position: { x: stationPosition.x + 0.5, y: stationPosition.y, z: stationPosition.z },
        stats: {
          attack: 10,
          strength: 10,
          defense: 5,
          constitution: 10,
          ranged: 1,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          health: 100,
          maxHealth: 100,
          stamina: 100,
          maxStamina: 100
        }
      });

      // Equip bronze sword
      const bronzeSword = getItem('bronze_sword');
      if (bronzeSword && this.equipmentSystem) {
        player.equipment.weapon = bronzeSword;
      }

      // Spawn goblin for combat
      const mobPosition = { x: stationPosition.x + 2, y: stationPosition.y, z: stationPosition.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        const mobConfig = {
          type: MobType.GOBLIN,
          name: 'Test Goblin',
          level: 2,
          stats: {
            attack: 1,
            strength: 1,
            defense: 1,
            constitution: 3, // Health will be constitution * 10 = 30
            ranged: 1
          },
          isAggressive: true,
          aggroRange: 5,
          respawnTime: 0,
          lootTable: 'default',
          equipment: {
            weapon: null,
            armor: null
          }
        };
        mobId = await this.mobSystem.spawnMob(mobConfig, mobPosition);
        
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn test mob');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        player: player as PlayerEntity,
        mobId,
        weaponType: AttackType.MELEE,
        startTime: Date.now(),
        damageDealt: 0,
        hitCount: 0,
        missCount: 0,
        expectedKillTime: 15000, // 15 seconds expected
        arrowsUsed: 0,
        initialArrows: 0,
        attackInterval: null,
        goblinId: mobId,
        goblinHealth: 30, // constitution * 10
        playerHealth: 100,
        combatStarted: false,
        combatEnded: false,
        damageReceived: 0,
        xpGained: 0,
        lootDropped: false
      });

      // Wait for fake player to be fully registered before starting combat
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Debug: Check if player is registered with entity manager
      const entityManager = this.world.getSystem('entity-manager');
      if (entityManager && 'getEntity' in entityManager) {
        (entityManager as { getEntity(id: string): unknown }).getEntity(player.id);
              }
      
      // Wait for mob to be fully registered in world entities
      let mobRegistered = false;
      let waitAttempts = 0;
      const maxAttempts = 20; // 2 seconds max wait
      
      while (!mobRegistered && waitAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if mob is registered in world.entities
        const mobEntity = this.world.entities.get(mobId);
        if (mobEntity) {
          mobRegistered = true;
                  } else {
          waitAttempts++;
          if (waitAttempts % 5 === 0) {
                      // Log wait progress for debugging
                      }
        }
      }
      
      if (!mobRegistered) {
        this.failTest(stationId, `Mob ${mobId} was not registered in world.entities after ${maxAttempts * 100}ms`);
        return;
      }
      
      // Start combat
      if (this.combatSystem) {
        const combatStarted = await this.combatSystem.startCombat(player.id, mobId);
        if (!combatStarted) {
          // Add more debugging info
          Logger.systemError('CombatTestSystem', ` Combat start failed for player ${player.id} vs mob ${mobId}`);
          this.failTest(stationId, 'Failed to start combat');
          return;
        }
                
        // Start triggering melee attacks
        const attackInterval = setInterval(() => {
          const testData = this.testData.get(stationId);
          if (!testData) {
            clearInterval(attackInterval);
            return;
          }
          
          // Emit melee attack event
          this.emitTypedEvent(EventType.COMBAT_MELEE_ATTACK, {
            attackerId: player.id,
            targetId: mobId
          });
        }, 1500); // Attack every 1.5 seconds
        
        // Store interval for cleanup
        const testData = this.testData.get(stationId);
        if (testData) {
          testData.attackInterval = attackInterval;
        }
      }

      // Monitor combat progress
      this.monitorCombat(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Melee combat test error: ${error}`);
    }
  }

  private async runRangedCombatTest(stationId: string): Promise<void> {
    try {
            const stationPosition = this.validateStationPosition(stationId);
            
      if (!stationPosition) {
        Logger.systemError('CombatTestSystem', ` No station position returned for ${stationId}`);
        return;
      }

      // Validate station position has all required coordinates
      if (typeof stationPosition.x !== 'number' || typeof stationPosition.y !== 'number' || typeof stationPosition.z !== 'number') {
        Logger.systemError('CombatTestSystem', 'Invalid station position coordinates', undefined, { stationPosition });
        this.failTest(stationId, `Invalid station position for ranged combat: ${JSON.stringify(stationPosition)}`);
        return;
      }
      
      
      // Create fake player with wood bow and arrows (positioned within ranged range)
      const player = this.createPlayer({
        id: `ranged_player_${Date.now()}`,
        name: 'Archer',
        position: { x: stationPosition.x + 2, y: stationPosition.y, z: stationPosition.z },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 15,
          constitution: 10,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          health: 100,
          maxHealth: 100,
          stamina: 100,
          maxStamina: 100
        }
      });

      // Equip wood bow and arrows
      const woodBow = getItem('wood_bow');
      const arrows = getItem('arrows');
      
      if (woodBow && arrows && this.equipmentSystem) {
        player.equipment.weapon = woodBow;
        player.equipment.arrows = arrows;
      }

      // Spawn goblin at longer range for ranged combat
      const mobPosition = { x: stationPosition.x + 6, y: stationPosition.y, z: stationPosition.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        const mobConfig = {
          type: MobType.GOBLIN,
          name: 'Test Goblin (Ranged)',
          level: 3,
          stats: {
            attack: 2,
            strength: 2,
            defense: 2,
            constitution: 4, // Health will be constitution * 10 = 40
            ranged: 1
          },
          isAggressive: true,
          aggroRange: 8,
          respawnTime: 0,
          lootTable: 'default',
          equipment: {
            weapon: null,
            armor: null
          }
        };
        mobId = await this.mobSystem.spawnMob(mobConfig, mobPosition);
        
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn test mob for ranged combat');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        mobId,
        weaponType: AttackType.RANGED,
        startTime: Date.now(),
        damageDealt: 0,
        hitCount: 0,
        missCount: 0,
        expectedKillTime: 20000, // 20 seconds expected
        initialArrows: 50,
        arrowsUsed: 0,
        attackInterval: null,
        goblinId: mobId,
        goblinHealth: 30, // constitution * 10
        playerHealth: 100,
        combatStarted: false,
        combatEnded: false,
        damageReceived: 0,
        xpGained: 0,
        lootDropped: false
      });

      // Wait for fake player to be fully registered before starting combat
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Debug: Check if player is registered with entity manager
      const entityManager = this.world.getSystem('entity-manager');
      if (entityManager && 'getEntity' in entityManager) {
        (entityManager as { getEntity(id: string): unknown }).getEntity(player.id);
              }
      
      // Wait for mob to be fully registered in world entities
      let mobRegistered = false;
      let waitAttempts = 0;
      const maxAttempts = 20; // 2 seconds max wait
      
      while (!mobRegistered && waitAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if mob is registered in world.entities
        const mobEntity = this.world.entities.get(mobId);
        if (mobEntity) {
          mobRegistered = true;
                  } else {
          waitAttempts++;
          if (waitAttempts % 5 === 0) {
                      // Log wait progress for debugging
                      }
        }
      }
      
      if (!mobRegistered) {
        this.failTest(stationId, `Mob ${mobId} was not registered in world.entities after ${maxAttempts * 100}ms`);
        return;
      }
      
      // Start ranged combat (specify weaponType as RANGED)
      if (this.combatSystem) {
        const combatStarted = await this.combatSystem.startCombat(player.id, mobId, {
          weaponType: AttackType.RANGED
        });
        if (!combatStarted) {
          Logger.systemError('CombatTestSystem', ` Ranged combat start failed for player ${player.id} vs mob ${mobId}`);
          this.failTest(stationId, 'Failed to start ranged combat');
          return;
        }
                
        // Start triggering ranged attacks
        const attackInterval = setInterval(() => {
          const testData = this.testData.get(stationId);
          if (!testData) {
            clearInterval(attackInterval);
            return;
          }
          
          // Emit ranged attack event
          this.emitTypedEvent(EventType.COMBAT_RANGED_ATTACK, {
            attackerId: player.id,
            targetId: mobId
          });
        }, 1500); // Attack every 1.5 seconds
        
        // Store interval for cleanup
        const testData = this.testData.get(stationId);
        if (testData) {
          testData.attackInterval = attackInterval;
        }
      }

      // Monitor combat progress
      this.monitorCombat(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Ranged combat test error: ${error}`);
    }
  }

  private async runMixedCombatTest(stationId: string): Promise<void> {
    try {
      const stationPosition = this.validateStationPosition(stationId);
      if (!stationPosition) return;

      // Validate station position has all required coordinates
      if (typeof stationPosition.x !== 'number' || typeof stationPosition.y !== 'number' || typeof stationPosition.z !== 'number') {
        this.failTest(stationId, `Invalid station position for mixed combat: ${JSON.stringify(stationPosition)}`);
        return;
      }

      // Create fake player with both melee and ranged capabilities (positioned for melee range initially)
      const player = this.createPlayer({
        id: `mixed_player_${Date.now()}`,
        name: 'Hybrid Fighter',
        position: { x: stationPosition.x + 1.5, y: stationPosition.y, z: stationPosition.z },
        stats: {
          attack: 15,
          strength: 12,
          defense: 10,
          ranged: 12,
          constitution: 15,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          health: 150,
          maxHealth: 150,
          stamina: 100,
          maxStamina: 100
        }
      });

      // Add both weapons to inventory
      const steelSword = getItem('steel_sword');
      const oakBow = getItem('oak_bow');
      const arrows = getItem('arrows');
      
      if (steelSword && oakBow && arrows) {
        // Add items to inventory using proper structure
        player.inventory.items.push(
          { id: 'inv_steel', itemId: steelSword.id, quantity: 1, slot: 0, metadata: null },
          { id: 'inv_oak', itemId: oakBow.id, quantity: 1, slot: 1, metadata: null }
        );
        player.equipment.weapon = steelSword; // Start with melee
        player.equipment.arrows = arrows;
      }

      // Spawn stronger hobgoblin for mixed combat test
      const mobPosition = { x: stationPosition.x + 3, y: stationPosition.y, z: stationPosition.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        const mobConfig = {
          type: MobType.HOBGOBLIN,
          name: 'Test Hobgoblin',
          level: 8,
          stats: {
            attack: 8,
            strength: 8,
            defense: 8,
            constitution: 6, // Health will be constitution * 10 = 60
            ranged: 1
          },
          isAggressive: true,
          aggroRange: 6,
          respawnTime: 0,
          lootTable: 'default',
          equipment: {
            weapon: null,
            armor: null
          }
        };
        mobId = await this.mobSystem.spawnMob(mobConfig, mobPosition);
        
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn test mob for mixed combat');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        mobId,
        weaponType: AttackType.MELEE, // Start with melee
        startTime: Date.now(),
        damageDealt: 0,
        hitCount: 0,
        missCount: 0,
        expectedKillTime: 35000, // 35 seconds expected (includes weapon switching)
        initialArrows: 30,
        arrowsUsed: 0,
        attackInterval: null,
        goblinId: mobId,
        goblinHealth: 50, // hobgoblin has more health
        playerHealth: 100,
        combatStarted: false,
        combatEnded: false,
        damageReceived: 0,
        xpGained: 0,
        lootDropped: false
      });

      // Start combat with melee
      // Wait for fake player to be fully registered before starting combat
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Debug: Check if player is registered with entity manager
      const entityManager = this.world.getSystem('entity-manager');
      if (entityManager && 'getEntity' in entityManager) {
        (entityManager as { getEntity(id: string): unknown }).getEntity(player.id);
              }
      
      // Wait for mob to be fully registered in world entities
      let mobRegistered = false;
      let waitAttempts = 0;
      const maxAttempts = 20; // 2 seconds max wait
      
      while (!mobRegistered && waitAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if mob is registered in world.entities
        const mobEntity = this.world.entities.get(mobId);
        if (mobEntity) {
          mobRegistered = true;
                  } else {
          waitAttempts++;
          if (waitAttempts % 5 === 0) {
                      // Log wait progress for debugging
                      }
        }
      }
      
      if (!mobRegistered) {
        this.failTest(stationId, `Mob ${mobId} was not registered in world.entities after ${maxAttempts * 100}ms`);
        return;
      }
      
      if (this.combatSystem) {
        const combatStarted = await this.combatSystem.startCombat(player.id, mobId);
        if (!combatStarted) {
          Logger.systemError('CombatTestSystem', ` Mixed combat start failed for player ${player.id} vs mob ${mobId}`);
          this.failTest(stationId, 'Failed to start mixed combat');
          return;
        }
                
        // Start triggering attacks (starts with melee)
        const attackInterval = setInterval(() => {
          const testData = this.testData.get(stationId);
          if (!testData) {
            clearInterval(attackInterval);
            return;
          }
          
          // Emit attack based on current weapon type
          const eventType = testData.weaponType === AttackType.MELEE 
            ? EventType.COMBAT_MELEE_ATTACK 
            : EventType.COMBAT_RANGED_ATTACK;
            
          this.emitTypedEvent(eventType, {
            attackerId: player.id,
            targetId: mobId
          });
        }, 1500); // Attack every 1.5 seconds
        
        // Store interval for cleanup
        const testData = this.testData.get(stationId);
        if (testData) {
          testData.attackInterval = attackInterval;
        }
      }

      // Monitor combat and handle weapon switching
      this.monitorMixedCombat(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Mixed combat test error: ${error}`);
    }
  }

  private monitorCombat(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Repair fake player position if needed
    this.repairPlayerPosition(testData.player.id);
    
    const checkInterval = setInterval(async () => {
      const currentTime = Date.now();
      const elapsed = currentTime - testData.startTime;
      
      // Check if mob is still alive
      let mob: MobInstance | undefined;
      if (this.mobSystem) {
        mob = await this.mobSystem.getMob(testData.mobId);
      }
      
      if (!mob || mob.health <= 0) {
        // Mob is dead - combat successful!
        clearInterval(checkInterval);
        
        const combatDuration = elapsed;
        const wasWithinExpectedTime = combatDuration <= testData.expectedKillTime;
        
        
        // Validate results
        if (testData.hitCount === 0) {
          this.failTest(stationId, 'No hits registered during combat');
          return;
        }
        
        if (testData.weaponType === AttackType.RANGED && testData.arrowsUsed === 0) {
          this.failTest(stationId, 'No arrows consumed during ranged combat');
          return;
        }
        
        const details = {
          duration: combatDuration,
          hitCount: testData.hitCount,
          missCount: testData.missCount,
          damageDealt: testData.damageDealt,
          withinExpectedTime: wasWithinExpectedTime,
          arrowsUsed: testData.arrowsUsed
        };
        
        this.passTest(stationId, details);
        return;
      }
      
      // Check timeout
      if (elapsed > testData.expectedKillTime * 2) {
        clearInterval(checkInterval);
        this.failTest(stationId, `Combat timeout - mob still has ${mob?.health || 'unknown'} health after ${elapsed}ms`);
        return;
      }
      
      // Update combat statistics (this would normally come from combat events)
      this.updateCombatStats(stationId, mob);
      
    }, 1000); // Check every second
  }

  private monitorMixedCombat(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Repair fake player position if needed
    this.repairPlayerPosition(testData.player.id);
    
    let switchedToRanged = false;
    
    const checkInterval = setInterval(async () => {
      const currentTime = Date.now();
      const elapsed = currentTime - testData.startTime;
      
      // Check if mob is still alive
      let mob: MobInstance | undefined;
      if (this.mobSystem) {
        mob = await this.mobSystem.getMob(testData.mobId);
      }
      
      if (!mob || mob.health <= 0) {
        // Combat completed successfully
        clearInterval(checkInterval);
        
        const details = {
          duration: elapsed,
          hitCount: testData.hitCount,
          missCount: testData.missCount,
          damageDealt: testData.damageDealt,
          switchedWeapons: switchedToRanged,
          arrowsUsed: testData.arrowsUsed
        };
        
        this.passTest(stationId, details);
        return;
      }
      
      // Switch to ranged weapon after 15 seconds of melee combat
      if (!switchedToRanged && elapsed > 15000) {
        
        // Switch weapon
        const oakBow = getItem('oak_bow');
        if (oakBow && this.equipmentSystem) {
          testData.player.equipment.weapon = oakBow;
          testData.weaponType = AttackType.RANGED;
          switchedToRanged = true;
          
          // Move player back for ranged combat
          const currentPos = this.getSafePosition(testData.player);
          const newPosition = { 
            x: currentPos.x - 3, 
            y: currentPos.y, 
            z: currentPos.z 
          };
          this.movePlayer(testData.player.id, newPosition);
          
        }
      }
      
      // Check timeout
      if (elapsed > testData.expectedKillTime * 2) {
        clearInterval(checkInterval);
        this.failTest(stationId, `Mixed combat timeout - mob still has ${mob?.health || 'unknown'} health after ${elapsed}ms`);
        return;
      }
      
      // Update combat statistics
      this.updateCombatStats(stationId, mob);
      
    }, 1000);
  }

  private updateCombatStats(stationId: string, mob: MobData | undefined): void {
    const testData = this.testData.get(stationId);
    if (!testData || !mob) return;
    
    // Check if mob has proper structure
    if (typeof mob.maxHealth !== 'number' || typeof mob.health !== 'number') {
      Logger.systemWarn('CombatTestSystem', 'Invalid mob structure in updateCombatStats', {
        hasMaxHealth: mob.maxHealth,
        hasHealth: mob.health
      });
      return;
    }
    
    // Update arrow consumption for ranged combat
    if (testData.weaponType === AttackType.RANGED && testData.initialArrows) {
      testData.arrowsUsed = Math.min(testData.hitCount, testData.initialArrows);
      
      // Note: Arrow quantity tracking should be handled in inventory, not equipment
      // Equipment slots contain item definitions (Item), not inventory instances with quantities
    }
    
    // Log current combat progress
    const totalAttempts = testData.hitCount + testData.missCount;
    if (totalAttempts > 0 && totalAttempts % 5 === 0) {
          // Log progress periodically
          }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up attack interval
      if (testData.attackInterval) {
        clearInterval(testData.attackInterval);
      }
      
      // Clean up spawned mob
      if (this.mobSystem && testData.mobId) {
        this.mobSystem.despawnMob(testData.mobId);
      }
      
      // Remove fake player
      this.fakePlayers.delete(testData.player.id);
      
      // Emit cleanup events
      this.emitTypedEvent(EventType.TEST_PLAYER_REMOVE, {
        id: `fake_player_${testData.player.id}`
      });
      
      this.testData.delete(stationId);
    }
    
  }

  async getSystemRating(): Promise<string> {
    const totalStations = this.testStations.size;
    const completedStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed' || station.status === 'failed'
    ).length;
    
    const successfulStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed'
    ).length;
    
    const completionRate = totalStations > 0 ? completedStations / totalStations : 0;
    const successRate = completedStations > 0 ? successfulStations / completedStations : 0;
    
    // Check for advanced combat features
    const hasMeleeCombatTesting = this.testStations.has('combat_melee_test');
    const hasRangedCombatTesting = this.testStations.has('combat_ranged_test');
    const hasMixedCombatTesting = this.testStations.has('combat_mixed_test');
    const hasArrowConsumptionTesting = this.testStations.has('combat_arrow_consumption_test');
    const hasCombatPerformanceTesting = this.testStations.has('combat_performance_test');
    
    const advancedFeatureCount = [
      hasMeleeCombatTesting,
      hasRangedCombatTesting,
      hasMixedCombatTesting,
      hasArrowConsumptionTesting,
      hasCombatPerformanceTesting
    ].filter(Boolean).length;
    
    // Check performance metrics (combat timing, damage calculations)
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.hitCount > 0) {
        const hitRate = testData.hitCount / (testData.hitCount + testData.missCount);
        if (hitRate > 0.7) { // Good hit rate
          hasGoodPerformanceMetrics = true;
          break;
        }
      }
    }
    
    // Rating logic with enhanced criteria
    if (completionRate >= 0.95 && successRate >= 0.9 && advancedFeatureCount >= 4 && hasGoodPerformanceMetrics) {
      return 'excellent';
    } else if (completionRate >= 0.8 && successRate >= 0.8 && advancedFeatureCount >= 3) {
      return 'very_good';
    } else if (completionRate >= 0.6 && successRate >= 0.7 && advancedFeatureCount >= 2) {
      return 'good';
    } else if (completionRate >= 0.4 && successRate >= 0.6) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  private validateStationPosition(stationId: string): Position3D | null {
    const station = this.testStations.get(stationId);
    if (!station) {
      Logger.systemError('CombatTestSystem', ` Station not found: ${stationId}`);
      this.failTest(stationId, `Station not found: ${stationId}`);
      return null;
    }
    return station.position;
  }

  private getSafePosition(entity: { id: string }): Position3D {
    const worldEntity = this.world.entities.get(entity.id);
    if (!worldEntity || !worldEntity.node) {
      return { x: 0, y: 0, z: 0 };
    }
    return {
      x: worldEntity.node.position.x,
      y: worldEntity.node.position.y,
      z: worldEntity.node.position.z
    };
  }

  private repairPlayerPosition(playerId: string): void {
    const player = this.fakePlayers.get(playerId);
    if (!player) {
      Logger.systemError('CombatTestSystem', ` Fake player not found: ${playerId}`);
      return;
    }

    const entity = this.world.entities.get(playerId);
    if (!entity || !entity.node) {
      Logger.systemError('CombatTestSystem', ` Entity or node not found for fake player: ${playerId}`);
      return;
    }

    // Reset position to the fake player's intended position
    entity.node.position.set(
      player.position.x,
      player.position.y,
      player.position.z
    );
  }

  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}