/**
 * Aggro Test System
 * Tests mob aggression and chase mechanics with fake players
 * - Tests level-based aggression (mobs ignore high-level players)
 * - Tests aggro range detection
 * - Tests chase mechanics and pathfinding
 * - Tests leashing (mobs return to spawn when player goes too far)
 * - Tests special case mobs that are always aggressive
 */

import { World } from '../World';
import { MobInstance, Position3D } from '../types/core';
import { MobType } from '../types/index';
import type { AggroTestData, AggroTestResults } from '../types/test';
import { getSystem } from '../utils/SystemUtils';
import type { AggroSystem } from './AggroSystem';
import type { MobSystem } from './MobSystem';
import { VisualTestFramework } from './VisualTestFramework';
import { EventType } from '../types/events';

export class AggroTestSystem extends VisualTestFramework {
  private testData = new Map<string, AggroTestData>();
  private testResults = new Map<string, { 
    passed: boolean; 
    score: number; 
    testName: string;
    data?: {
      actualAggressive?: boolean;
      expectedAggressive?: boolean;
      duration?: number;
    };
  }>();
  private mobSystem!: MobSystem;
  private aggroSystem!: AggroSystem;

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    
    // Get required systems
    this.mobSystem = getSystem(this.world, 'mob') as MobSystem;
    this.aggroSystem = getSystem(this.world, 'aggro') as AggroSystem;
    
    // Create test stations
    this.createTestStations();
    
  }

  protected createTestStations(): void {
    // Low Level Player vs Aggressive Mob Test
    this.createTestStation({
      id: 'low_level_aggro_test',
      name: 'Low Level Aggro Test',
      position: { x: -30, y: 0, z: 10 },
      timeoutMs: 30000 // 30 seconds
    });

    // High Level Player vs Aggressive Mob Test (should be ignored)
    this.createTestStation({
      id: 'high_level_aggro_test',
      name: 'High Level Aggro Test',
      position: { x: -30, y: 0, z: 20 },
      timeoutMs: 25000 // 25 seconds
    });

    // Special Aggressive Mob Test (always aggressive regardless of level)
    this.createTestStation({
      id: 'special_aggro_test',
      name: 'Special Aggro Test',
      position: { x: -30, y: 0, z: 30 },
      timeoutMs: 35000 // 35 seconds
    });

    // Leash Distance Test
    this.createTestStation({
      id: 'leash_test',
      name: 'Leash Distance Test',
      position: { x: -30, y: 0, z: 40 },
      timeoutMs: 45000 // 45 seconds
    });

    // Aggro Range Test
    this.createTestStation({
      id: 'aggro_range_test',
      name: 'Aggro Range Test',
      position: { x: -30, y: 0, z: 50 },
      timeoutMs: 20000 // 20 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'low_level_aggro_test':
        this.runLowLevelAggroTest(stationId);
        break;
      case 'high_level_aggro_test':
        this.runHighLevelAggroTest(stationId);
        break;
      case 'special_aggro_test':
        this.runSpecialAggroTest(stationId);
        break;
      case 'leash_test':
        this.runLeashTest(stationId);
        break;
      case 'aggro_range_test':
        this.runAggroRangeTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown aggro test: ${stationId}`);
    }
  }

  private async runLowLevelAggroTest(stationId: string): Promise<void> {
    try {
      console.log(`[AggroTestSystem] Starting runLowLevelAggroTest for ${stationId}`);
      const stationPosition = this.validateStationPosition(stationId);
      console.log(`[AggroTestSystem] Station position received:`, stationPosition);
      if (!stationPosition) return;

      // Validate that stationPosition has proper coordinates before using them
      if (typeof stationPosition.x !== 'number' || typeof stationPosition.y !== 'number' || typeof stationPosition.z !== 'number') {
        console.error(`[AggroTestSystem] Invalid station position coordinates:`, stationPosition);
        this.failTest(stationId, `Invalid station position: ${JSON.stringify(stationPosition)}`);
        return;
      }

      console.log(`[AggroTestSystem] Creating fake player at position:`, { x: stationPosition.x - 8, y: stationPosition.y, z: stationPosition.z });
      // Create low-level fake player (level 3)
      const player = this.createPlayer({
        id: `low_level_player_${Date.now()}`,
        name: 'Low Level Player',
        position: { x: stationPosition.x - 8, y: stationPosition.y, z: stationPosition.z },
        stats: {
          attack: 3,
          strength: 3,
          defense: 3,
          ranged: 3,
          constitution: 3,
          health: 30,
          maxHealth: 30,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 30,
          maxStamina: 30
        }
      });

      // Spawn aggressive goblin that should attack low-level players
      const mobPosition = { x: stationPosition.x + 2, y: stationPosition.y, z: stationPosition.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          type: MobType.GOBLIN,
          name: 'Aggressive Goblin (Low)',
          level: 5,
          stats: { attack: 5, strength: 5, defense: 5, ranged: 1, constitution: 3 },
          equipment: { weapon: null, armor: null },
          lootTable: 'coins_basic',
          isAggressive: true,
          aggroRange: 8,
          respawnTime: 0
        }, mobPosition);
        
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn aggressive mob for low level test');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        mobId,
        mobType: MobType.GOBLIN as string,
        playerLevel: 3,
        expectedAggressive: true, // Should be aggressive to low level player
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition } as Position3D,
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Start monitoring aggro
      // Add delay to ensure mob is fully spawned before monitoring
      setTimeout(() => {
        console.log(`[AggroTestSystem] Beginning aggro monitoring for ${stationId}`);
        this.monitorAggro(stationId);
      }, 1000);
      
    } catch (error) {
      console.error(`[AggroTestSystem] Low level aggro test caught error:`, error);
      console.error(`[AggroTestSystem] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      this.failTest(stationId, `Low level aggro test error: ${error}`);
    }
  }

  private async runHighLevelAggroTest(stationId: string): Promise<void> {
    try {
      console.log(`[AggroTestSystem] Starting High Level Aggro Test`);
      
      const stationPosition = this.validateStationPosition(stationId);
      if (!stationPosition) {
        console.error(`[AggroTestSystem] Station position validation failed for ${stationId}`);
        return;
      }

      // Verify mob system is available
      if (!this.mobSystem) {
        console.error(`[AggroTestSystem] MobSystem is not available`);
        this.failTest(stationId, 'MobSystem not available for spawning mobs');
        return;
      }

      // Create high-level fake player (level 25)
      console.log(`[AggroTestSystem] Creating high-level fake player`);
      const player = this.createPlayer({
        id: `high_level_player_${Date.now()}`,
        name: 'High Level Player',
        position: { x: stationPosition.x - 6, y: stationPosition.y, z: stationPosition.z },
        stats: {
          attack: 25,
          strength: 25,
          defense: 25,
          ranged: 25,
          constitution: 25,
          health: 250,
          maxHealth: 250,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 250,
          maxStamina: 250
        }
      });

      // Spawn aggressive goblin that should ignore high-level players
      const mobPosition = { x: stationPosition.x + 2, y: stationPosition.y, z: stationPosition.z };
      console.log(`[AggroTestSystem] Spawning goblin at position:`, mobPosition);
      
      let mobId: string | null = null;
      try {
        mobId = await this.mobSystem.spawnMob({
          type: MobType.GOBLIN,
          name: 'Aggressive Goblin (High)',
          level: 5,
          stats: { attack: 5, strength: 5, defense: 5, ranged: 1, constitution: 3 },
          equipment: { weapon: null, armor: null },
          lootTable: 'coins_basic',
          isAggressive: true,
          aggroRange: 8,
          respawnTime: 0
        }, mobPosition);
        
        console.log(`[AggroTestSystem] Mob spawned with ID: ${mobId}`);
      } catch (spawnError) {
        console.error(`[AggroTestSystem] Error spawning mob:`, spawnError);
        this.failTest(stationId, `Failed to spawn mob: ${spawnError}`);
        return;
      }

      if (!mobId) {
        console.error(`[AggroTestSystem] Mob spawn returned null`);
        this.failTest(stationId, 'Failed to spawn aggressive mob for high level test');
        return;
      }

      // Store test data
      console.log(`[AggroTestSystem] Storing test data for ${stationId}`);
      this.testData.set(stationId, {
        player,
        mobId,
        mobType: MobType.GOBLIN as string,
        playerLevel: 25,
        expectedAggressive: false, // Should ignore high level player
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition } as Position3D,
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Move player close to test aggro ignore
      console.log(`[AggroTestSystem] Scheduling player movement in 2 seconds`);
      setTimeout(() => {
        console.log(`[AggroTestSystem] Moving player closer to mob`);
        this.movePlayer(player.id, { 
          x: stationPosition.x - 3, 
          y: stationPosition.y, 
          z: stationPosition.z 
        });
      }, 2000);

      // Start monitoring aggro (should remain false)
      console.log(`[AggroTestSystem] Starting aggro monitoring after delay`);
      // Add delay to ensure mob is fully spawned before monitoring
      setTimeout(() => {
        console.log(`[AggroTestSystem] Beginning aggro monitoring for ${stationId}`);
        this.monitorAggro(stationId);
      }, 1000);
      
    } catch (error) {
      console.error(`[AggroTestSystem] High level aggro test error:`, error);
      this.failTest(stationId, `High level aggro test error: ${error}`);
    }
  }

  private async runSpecialAggroTest(stationId: string): Promise<void> {
    try {
      const stationPosition = this.validateStationPosition(stationId);
      if (!stationPosition) return;

      // Create high-level fake player
      const player = this.createPlayer({
        id: `special_player_${Date.now()}`,
        name: 'High Level vs Special',
        position: { x: stationPosition.x - 6, y: stationPosition.y, z: stationPosition.z },
        stats: {
          attack: 30,
          strength: 30,
          defense: 30,
          ranged: 30,
          constitution: 30,
          health: 300,
          maxHealth: 300,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 300,
          maxStamina: 300
        }
      });

      // Spawn Dark Warrior (always aggressive regardless of player level)
      const mobPosition = { x: stationPosition.x + 3, y: stationPosition.y, z: stationPosition.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          type: MobType.DARK_WARRIOR,
          name: 'Dark Warrior (Special)',
          level: 15,
          stats: { attack: 15, strength: 15, defense: 15, ranged: 1, constitution: 8 },
          equipment: { weapon: null, armor: null },
          lootTable: 'coins_medium',
          isAggressive: true,
          aggroRange: 10,
          respawnTime: 0
        }, mobPosition);
        
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn special aggressive mob');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        mobId,
        mobType: MobType.DARK_WARRIOR as string,
        playerLevel: 30,
        expectedAggressive: true, // Should be aggressive even to high level player
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition } as Position3D,
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Start monitoring aggro
      // Add delay to ensure mob is fully spawned before monitoring
      setTimeout(() => {
        console.log(`[AggroTestSystem] Beginning aggro monitoring for ${stationId}`);
        this.monitorAggro(stationId);
      }, 1000);
      
    } catch (error) {
      this.failTest(stationId, `Special aggro test error: ${error}`);
    }
  }

  private async runLeashTest(stationId: string): Promise<void> {
    try {
      const stationPosition = this.validateStationPosition(stationId);
      if (!stationPosition) return;

      // Create low-level fake player for leash testing
      const player = this.createPlayer({
        id: `leash_player_${Date.now()}`,
        name: 'Leash Test Player',
        position: { x: stationPosition.x - 6, y: stationPosition.y, z: stationPosition.z },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 5,
          constitution: 5,
          health: 50,
          maxHealth: 250, // High health to survive long chase
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 250,
          maxStamina: 250
        }
      });

      // Spawn hobgoblin for leash testing
      const mobPosition = { x: stationPosition.x + 2, y: stationPosition.y, z: stationPosition.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          type: MobType.HOBGOBLIN,
          name: 'Leash Test Hobgoblin',
          level: 8,
          stats: { attack: 8, strength: 8, defense: 8, ranged: 1, constitution: 5 },
          equipment: { weapon: null, armor: null },
          lootTable: 'coins_medium',
          isAggressive: true,
          aggroRange: 8,
          respawnTime: 0
        }, mobPosition);
        
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn mob for leash test');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        mobId,
        mobType: MobType.HOBGOBLIN as string,
        playerLevel: 5,
        expectedAggressive: true,
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition } as Position3D,
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Plan player movement to test leashing
      this.planLeashMovement(stationId);

      // Start monitoring aggro and leash
      // Add delay to ensure mob is fully spawned before monitoring
      setTimeout(() => {
        console.log(`[AggroTestSystem] Beginning aggro monitoring for ${stationId}`);
        this.monitorAggro(stationId);
      }, 1000);
      
    } catch (error) {
      this.failTest(stationId, `Leash test error: ${error}`);
    }
  }

  private async runAggroRangeTest(stationId: string): Promise<void> {
    try {
      const stationPosition = this.validateStationPosition(stationId);
      if (!stationPosition) return;

      // Create low-level fake player
      const player = this.createPlayer({
        id: `range_player_${Date.now()}`,
        name: 'Range Test Player',
        position: { x: stationPosition.x - 12, y: stationPosition.y, z: stationPosition.z }, // Start far away
        stats: {
          attack: 4,
          strength: 4,
          defense: 4,
          ranged: 4,
          constitution: 4,
          health: 40,
          maxHealth: 40,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 40,
          maxStamina: 40
        }
      });

      // Spawn bandit with specific aggro range
      const mobPosition = { x: stationPosition.x + 2, y: stationPosition.y, z: stationPosition.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          type: MobType.BANDIT,
          name: 'Range Test Bandit',
          level: 6,
          stats: { attack: 6, strength: 6, defense: 6, ranged: 1, constitution: 4 },
          equipment: { weapon: null, armor: null },
          lootTable: 'coins_basic',
          isAggressive: true,
          aggroRange: 6, // Specific range to test
          respawnTime: 0
        }, mobPosition);
        
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn mob for range test');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        mobId,
        mobType: MobType.BANDIT as string,
        playerLevel: 4,
        expectedAggressive: true,
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition } as Position3D,
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Plan gradual approach to test exact aggro range
      this.planRangeApproach(stationId);

      // Start monitoring aggro
      // Add delay to ensure mob is fully spawned before monitoring
      setTimeout(() => {
        console.log(`[AggroTestSystem] Beginning aggro monitoring for ${stationId}`);
        this.monitorAggro(stationId);
      }, 1000);
      
    } catch (error) {
      this.failTest(stationId, `Aggro range test error: ${error}`);
    }
  }

  private planLeashMovement(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Wait for aggro, then move player far away to test leashing
    setTimeout(() => {
      if (testData.aggroDetected) {
        
        // Move player far from spawn point (beyond hobgoblin's 25 unit leash range)
        const farPosition = {
          x: testData.initialMobPosition.x - 30,
          y: testData.initialMobPosition.y,
          z: testData.initialMobPosition.z + 10
        };
        
        this.movePlayer(testData.player.id, farPosition);
        testData.leashTested = true;
        
      }
    }, 8000); // Move after 8 seconds
  }

  private planRangeApproach(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    let step = 0;
    const steps = [
      { x: -10, distance: 10 }, // Should not aggro (outside range)
      { x: -8, distance: 8 },   // Should not aggro (at edge)
      { x: -5, distance: 5 },   // Should aggro (inside range)
    ];

    const moveToNextStep = () => {
      if (step >= steps.length) return;
      
      const currentStep = steps[step];
      const newPosition = {
        x: testData.initialMobPosition.x + currentStep.x,
        y: testData.initialMobPosition.y,
        z: testData.initialMobPosition.z
      };
      
      this.movePlayer(testData.player.id, newPosition);
      
      step++;
      
      if (step < steps.length) {
        setTimeout(moveToNextStep, 4000); // Wait 4 seconds between steps
      }
    };

    // Start movement sequence after 2 seconds
    setTimeout(moveToNextStep, 2000);
  }

  private monitorAggro(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) {
      console.error(`[AggroTestSystem] No test data found for ${stationId}`);
      return;
    }
    
    console.log(`[AggroTestSystem] Starting aggro monitoring for ${stationId}`);
    let checkCount = 0;
    
    const checkInterval = setInterval(async () => {
      checkCount++;
      const currentTime = Date.now();
      const elapsed = currentTime - testData.startTime;
      
      // Log monitoring progress every 5 checks (2.5 seconds)
      if (checkCount % 5 === 0) {
        console.log(`[AggroTestSystem] Monitoring ${stationId}: elapsed=${elapsed}ms, aggro=${testData.aggroDetected}, chase=${testData.chaseStarted}`);
      }
      
      // Get current mob state
      let mob: MobInstance | undefined = undefined;
      if (this.mobSystem) {
        mob = (await this.mobSystem.getMob(testData.mobId)) as MobInstance | undefined;
      }
      
      if (!mob) {
        // Try a few more times before giving up (mob might not be fully registered yet)
        if (checkCount < 3) {
          console.warn(`[AggroTestSystem] Mob ${testData.mobId} not found yet, will retry (attempt ${checkCount}/3)`);
          return; // Continue checking
        }
        
        console.error(`[AggroTestSystem] Mob ${testData.mobId} not found after ${checkCount} checks - mob may have despawned`);
        clearInterval(checkInterval);
        this.failTest(stationId, 'Mob disappeared during aggro test');
        return;
      }

      // Check aggro detection
      const mobData = mob as MobInstance;
      const isAggressive = mobData.aiState === 'attacking' || mobData.aiState === 'chasing';
      const hasTarget = mobData.target === testData.player.id;
      
      if (checkCount % 5 === 0) {
        console.log(`[AggroTestSystem] Mob state: aiState=${mobData.aiState}, target=${mobData.target}, isAggressive=${isAggressive}`);
      }
      
      if (isAggressive && hasTarget && !testData.aggroDetected) {
        console.log(`[AggroTestSystem] Aggro detected for ${stationId}!`);
        testData.aggroDetected = true;
      }

      // Check chase started
      if (testData.aggroDetected && !testData.chaseStarted) {
        if (mobData.position && typeof mobData.position.x === 'number' && typeof mobData.position.y === 'number' && typeof mobData.position.z === 'number') {
          const mobDistance = this.getDistance(mobData.position, testData.initialMobPosition);
          if (mobDistance > 2) { // Mob moved from spawn
            console.log(`[AggroTestSystem] Chase started for ${stationId}! Distance from spawn: ${mobDistance}`);
            testData.chaseStarted = true;
          }
        }
      }

      // Track max chase distance
      if (mobData.position && typeof mobData.position.x === 'number' && typeof mobData.position.y === 'number' && typeof mobData.position.z === 'number') {
        const chaseDistance = this.getDistance(mobData.position, testData.initialMobPosition);
        testData.maxChaseDistance = Math.max(testData.maxChaseDistance, chaseDistance);
      }

      // Check leash return
      if (testData.leashTested && !testData.returnedToSpawn) {
        if (mobData.position && typeof mobData.position.x === 'number' && typeof mobData.position.y === 'number' && typeof mobData.position.z === 'number') {
          const spawnDistance = this.getDistance(mobData.position, testData.initialMobPosition);
          if (spawnDistance < 3 && mobData.aiState === 'idle') {
            console.log(`[AggroTestSystem] Mob returned to spawn for ${stationId}`);
            testData.returnedToSpawn = true;
          }
        }
      }

      // Evaluate test results based on test type
      if (this.shouldCompleteTest(stationId, testData, elapsed)) {
        console.log(`[AggroTestSystem] Test ${stationId} should complete. Elapsed: ${elapsed}ms`);
        clearInterval(checkInterval);
        this.evaluateTestResults(stationId, testData, elapsed);
        return;
      }
      
      // Check timeout
      const station = this.testStations.get(stationId);
      if (elapsed > (station?.timeoutMs || 30000)) {
        console.error(`[AggroTestSystem] Test ${stationId} timed out after ${elapsed}ms`);
        clearInterval(checkInterval);
        this.failTest(stationId, `Aggro test timeout after ${elapsed}ms`);
        return;
      }
      
    }, 500); // Check every 500ms
  }

  private shouldCompleteTest(stationId: string, testData: AggroTestData, elapsed: number): boolean {
    switch (stationId) {
      case 'low_level_aggro_test':
        return testData.aggroDetected && testData.chaseStarted && elapsed > 5000;
        
      case 'high_level_aggro_test':
        return elapsed > 15000; // Wait to confirm no aggro
        
      case 'special_aggro_test':
        return testData.aggroDetected && testData.chaseStarted && elapsed > 5000;
        
      case 'leash_test':
        return testData.leashTested && (testData.returnedToSpawn || elapsed > 30000);
        
      case 'aggro_range_test':
        return testData.aggroDetected && elapsed > 15000; // After all movement steps
        
      default:
        return false;
    }
  }

  private evaluateTestResults(stationId: string, testData: AggroTestData, elapsed: number): void {
    const results: AggroTestResults = {
      duration: elapsed,
      playerLevel: testData.playerLevel,
      mobType: testData.mobType,
      expectedAggressive: testData.expectedAggressive,
      actualAggressive: testData.aggroDetected,
      chaseStarted: testData.chaseStarted,
      maxChaseDistance: testData.maxChaseDistance,
      passed: false
    };

    switch (stationId) {
      case 'low_level_aggro_test':
      case 'special_aggro_test':
        if (testData.aggroDetected && testData.chaseStarted) {
          results.passed = true;
          this.passTest(stationId, { 
            actualAggressive: results.actualAggressive,
            expectedAggressive: results.expectedAggressive,
            duration: results.duration 
          });
        } else {
          this.failTest(stationId, `Expected aggro but got: aggro=${testData.aggroDetected}, chase=${testData.chaseStarted}`);
        }
        break;
        
      case 'high_level_aggro_test':
        if (!testData.aggroDetected) {
          results.passed = true;
          this.passTest(stationId, { 
            actualAggressive: results.actualAggressive,
            expectedAggressive: results.expectedAggressive,
            duration: results.duration 
          });
        } else {
          this.failTest(stationId, `Expected no aggro for high level player but mob was aggressive`);
        }
        break;
        
      case 'leash_test':
        results.leashTested = testData.leashTested;
        results.returnedToSpawn = testData.returnedToSpawn;
        
        if (testData.aggroDetected && testData.chaseStarted && testData.leashTested) {
          if (testData.returnedToSpawn) {
            results.passed = true;
            this.passTest(stationId, { 
              leashTested: results.leashTested,
              returnedToSpawn: results.returnedToSpawn,
              duration: results.duration 
            });
          } else {
            this.failTest(stationId, `Mob chased but did not return to spawn when player moved too far`);
          }
        } else {
          this.failTest(stationId, `Leash test incomplete: aggro=${testData.aggroDetected}, chase=${testData.chaseStarted}, tested=${testData.leashTested}`);
        }
        break;
        
      case 'aggro_range_test':
        if (testData.aggroDetected) {
          results.passed = true;
          this.passTest(stationId, { 
            aggroDetected: testData.aggroDetected,
            duration: results.duration 
          });
        } else {
          this.failTest(stationId, `No aggro detected during range test - mob may have incorrect aggro range`);
        }
        break;
        
      default:
        this.failTest(stationId, `Unknown test type for evaluation`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
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

  getSystemRating(): { health: number; score: number; features: string[]; performance: Record<string, number> } {
    const testResultsMap = this.testResults;
    if (!testResultsMap) {
      return {
        health: 0,
        score: 0,
        features: [],
        performance: {}
      };
    }
    const testResults = Array.from(testResultsMap.values());
    const totalTests = testResults.length;
    const passedTests = testResults.filter((result: { passed: boolean }) => result.passed).length;
    
    // Calculate aggro response accuracy
    let aggroResponseAccuracy = 0;
    if (totalTests > 0) {
      const successfulAggroTests = testResults.filter((result: { passed: boolean; data?: { actualAggressive?: boolean; expectedAggressive?: boolean } }) => 
        result.passed && result.data && (
          result.data.actualAggressive === result.data.expectedAggressive
        )
      ).length;
      aggroResponseAccuracy = (successfulAggroTests / totalTests) * 100;
    }
    
    // Calculate overall health
    const health = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return {
      health,
      score: Math.round(aggroResponseAccuracy),
      features: [
        'Basic Aggro Detection',
        'Aggro Range Testing', 
        'Level-based Aggro Logic',
        'Aggro Target Switching',
        'Combat State Aggro'
      ],
      performance: {
        aggroResponseAccuracy,
        testPassRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        averageTestDuration: testResults.length > 0 
          ? testResults.reduce((sum: number, result: { data?: { duration?: number } }) => sum + (result.data?.duration || 0), 0) / testResults.length 
          : 0
      }
    };
  }

  private validateStationPosition(stationId: string): Position3D {
    const station = this.testStations.get(stationId)!;
    return station.position;
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
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}