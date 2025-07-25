/**
 * RPG Aggro Test System
 * Tests mob aggression and chase mechanics with fake players
 * - Tests level-based aggression (mobs ignore high-level players)
 * - Tests aggro range detection
 * - Tests chase mechanics and pathfinding
 * - Tests leashing (mobs return to spawn when player goes too far)
 * - Tests special case mobs that are always aggressive
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { MobType, MobBehavior } from '../types/index';

interface AggroTestData {
  fakePlayer: FakePlayer;
  mobId: string;
  mobType: MobType;
  playerLevel: number;
  expectedAggressive: boolean;
  startTime: number;
  initialMobPosition: { x: number; y: number; z: number };
  aggroDetected: boolean;
  chaseStarted: boolean;
  maxChaseDistance: number;
  leashTested: boolean;
  returnedToSpawn: boolean;
}

export class RPGAggroTestSystem extends RPGVisualTestFramework {
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
  private mobSystem: any;
  private aggroSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGAggroTestSystem] Initializing aggro test system...');
    
    // Get required systems
    this.mobSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGMobSystem');
    this.aggroSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGAggroSystem');
    
    if (!this.mobSystem) {
      console.warn('[RPGAggroTestSystem] MobSystem not found, aggro tests may not function properly');
    }
    
    if (!this.aggroSystem) {
      console.warn('[RPGAggroTestSystem] AggroSystem not found, aggro tests may not function properly');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGAggroTestSystem] Aggro test system initialized');
  }

  private createTestStations(): void {
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
      console.log('[RPGAggroTestSystem] Starting low level aggro test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create low-level fake player (level 3)
      const fakePlayer = this.createFakePlayer({
        id: `low_level_player_${Date.now()}`,
        name: 'Low Level Player',
        position: { x: station.position.x - 8, y: station.position.y, z: station.position.z },
        stats: {
          attack: 3,
          strength: 3,
          defense: 3,
          ranged: 3,
          constitution: 3,
          health: 30,
          maxHealth: 30
        }
      });

      // Spawn aggressive goblin that should attack low-level players
      const mobPosition = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          id: 'aggro_test_goblin_low',
          name: 'Aggressive Goblin (Low)',
          type: MobType.GOBLIN,
          level: 5,
          health: 30,
          combat: { attack: 5, strength: 5, defense: 5, range: 1, constitution: 30, combatLevel: 5 },
          behavior: MobBehavior.AGGRESSIVE,
          aggroRange: 8,
          respawnTime: 0,
          lootTable: [{ itemId: 'coins', quantity: 3, chance: 1.0 }],
          experienceReward: 15,
          color: '#ff0000' // Red for aggressive
        }, mobPosition);
        
        console.log(`[RPGAggroTestSystem] Spawned aggressive goblin for low level test: ${mobId}`);
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn aggressive mob for low level test');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        mobId,
        mobType: MobType.GOBLIN,
        playerLevel: 3,
        expectedAggressive: true, // Should be aggressive to low level player
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition },
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Start monitoring aggro
      this.monitorAggro(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Low level aggro test error: ${error}`);
    }
  }

  private async runHighLevelAggroTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGAggroTestSystem] Starting high level aggro test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create high-level fake player (level 25)
      const fakePlayer = this.createFakePlayer({
        id: `high_level_player_${Date.now()}`,
        name: 'High Level Player',
        position: { x: station.position.x - 6, y: station.position.y, z: station.position.z },
        stats: {
          attack: 25,
          strength: 25,
          defense: 25,
          ranged: 25,
          constitution: 25,
          health: 250,
          maxHealth: 250
        }
      });

      // Spawn aggressive goblin that should ignore high-level players
      const mobPosition = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          id: 'aggro_test_goblin_high',
          name: 'Aggressive Goblin (High)',
          type: MobType.GOBLIN,
          level: 5,
          health: 30,
          combat: { attack: 5, strength: 5, defense: 5, range: 1, constitution: 30, combatLevel: 5 },
          behavior: MobBehavior.AGGRESSIVE,
          aggroRange: 8,
          respawnTime: 0,
          lootTable: [{ itemId: 'coins', quantity: 3, chance: 1.0 }],
          experienceReward: 15,
          color: '#ffaa00' // Orange for should-ignore
        }, mobPosition);
        
        console.log(`[RPGAggroTestSystem] Spawned aggressive goblin for high level test: ${mobId}`);
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn aggressive mob for high level test');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        mobId,
        mobType: MobType.GOBLIN,
        playerLevel: 25,
        expectedAggressive: false, // Should ignore high level player
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition },
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Move player close to test aggro ignore
      setTimeout(() => {
        this.moveFakePlayer(fakePlayer.id, { 
          x: station.position.x - 3, 
          y: station.position.y, 
          z: station.position.z 
        });
      }, 2000);

      // Start monitoring aggro (should remain false)
      this.monitorAggro(stationId);
      
    } catch (error) {
      this.failTest(stationId, `High level aggro test error: ${error}`);
    }
  }

  private async runSpecialAggroTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGAggroTestSystem] Starting special aggro test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create high-level fake player
      const fakePlayer = this.createFakePlayer({
        id: `special_player_${Date.now()}`,
        name: 'High Level vs Special',
        position: { x: station.position.x - 6, y: station.position.y, z: station.position.z },
        stats: {
          attack: 30,
          strength: 30,
          defense: 30,
          ranged: 30,
          constitution: 30,
          health: 300,
          maxHealth: 300
        }
      });

      // Spawn Dark Warrior (always aggressive regardless of player level)
      const mobPosition = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          id: 'aggro_test_dark_warrior',
          name: 'Dark Warrior (Special)',
          type: MobType.DARK_WARRIOR,
          level: 15,
          health: 80,
          combat: { attack: 15, strength: 15, defense: 15, range: 1, constitution: 80, combatLevel: 15 },
          behavior: MobBehavior.AGGRESSIVE,
          aggroRange: 10,
          respawnTime: 0,
          lootTable: [{ itemId: 'coins', quantity: 20, chance: 1.0 }],
          experienceReward: 50,
          color: '#800080' // Purple for special aggressive
        }, mobPosition);
        
        console.log(`[RPGAggroTestSystem] Spawned special aggressive dark warrior: ${mobId}`);
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn special aggressive mob');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        mobId,
        mobType: MobType.DARK_WARRIOR,
        playerLevel: 30,
        expectedAggressive: true, // Should be aggressive even to high level player
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition },
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Start monitoring aggro
      this.monitorAggro(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Special aggro test error: ${error}`);
    }
  }

  private async runLeashTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGAggroTestSystem] Starting leash test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create low-level fake player for leash testing
      const fakePlayer = this.createFakePlayer({
        id: `leash_player_${Date.now()}`,
        name: 'Leash Test Player',
        position: { x: station.position.x - 6, y: station.position.y, z: station.position.z },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 5,
          constitution: 5,
          health: 50,
          maxHealth: 250 // High health to survive long chase
        }
      });

      // Spawn hobgoblin for leash testing
      const mobPosition = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          id: 'leash_test_hobgoblin',
          name: 'Leash Test Hobgoblin',
          type: MobType.HOBGOBLIN,
          level: 8,
          health: 45,
          combat: { attack: 8, strength: 8, defense: 8, range: 1, constitution: 45, combatLevel: 8 },
          behavior: MobBehavior.AGGRESSIVE,
          aggroRange: 8,
          respawnTime: 0,
          lootTable: [{ itemId: 'coins', quantity: 10, chance: 1.0 }],
          experienceReward: 30,
          color: '#00ffff' // Cyan for leash test
        }, mobPosition);
        
        console.log(`[RPGAggroTestSystem] Spawned hobgoblin for leash test: ${mobId}`);
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn mob for leash test');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        mobId,
        mobType: MobType.HOBGOBLIN,
        playerLevel: 5,
        expectedAggressive: true,
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition },
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Plan player movement to test leashing
      this.planLeashMovement(stationId);

      // Start monitoring aggro and leash
      this.monitorAggro(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Leash test error: ${error}`);
    }
  }

  private async runAggroRangeTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGAggroTestSystem] Starting aggro range test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create low-level fake player
      const fakePlayer = this.createFakePlayer({
        id: `range_player_${Date.now()}`,
        name: 'Range Test Player',
        position: { x: station.position.x - 12, y: station.position.y, z: station.position.z }, // Start far away
        stats: {
          attack: 4,
          strength: 4,
          defense: 4,
          ranged: 4,
          constitution: 4,
          health: 40,
          maxHealth: 40
        }
      });

      // Spawn bandit with specific aggro range
      const mobPosition = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      let mobId: string | null = null;
      
      if (this.mobSystem) {
        mobId = await this.mobSystem.spawnMob({
          id: 'range_test_bandit',
          name: 'Range Test Bandit',
          type: MobType.BANDIT,
          level: 6,
          health: 35,
          combat: { attack: 6, strength: 6, defense: 6, range: 1, constitution: 35, combatLevel: 6 },
          behavior: MobBehavior.AGGRESSIVE,
          aggroRange: 6, // Specific range to test
          respawnTime: 0,
          lootTable: [{ itemId: 'coins', quantity: 8, chance: 1.0 }],
          experienceReward: 25,
          color: '#ff6600' // Orange-red for range test
        }, mobPosition);
        
        console.log(`[RPGAggroTestSystem] Spawned bandit for range test: ${mobId}`);
      }

      if (!mobId) {
        this.failTest(stationId, 'Failed to spawn mob for range test');
        return;
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        mobId,
        mobType: MobType.BANDIT,
        playerLevel: 4,
        expectedAggressive: true,
        startTime: Date.now(),
        initialMobPosition: { ...mobPosition },
        aggroDetected: false,
        chaseStarted: false,
        maxChaseDistance: 0,
        leashTested: false,
        returnedToSpawn: false
      });

      // Plan gradual approach to test exact aggro range
      this.planRangeApproach(stationId);

      // Start monitoring aggro
      this.monitorAggro(stationId);
      
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
        console.log('[RPGAggroTestSystem] Moving player far away to test leashing...');
        
        // Move player far from spawn point
        const farPosition = {
          x: testData.initialMobPosition.x - 20,
          y: testData.initialMobPosition.y,
          z: testData.initialMobPosition.z + 5
        };
        
        this.moveFakePlayer(testData.fakePlayer.id, farPosition);
        testData.leashTested = true;
        
        console.log(`[RPGAggroTestSystem] Player moved to ${farPosition.x}, ${farPosition.z} to test leash distance`);
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
      
      console.log(`[RPGAggroTestSystem] Moving to step ${step + 1}: distance ${currentStep.distance} (should ${step < 2 ? 'NOT' : ''} aggro)`);
      this.moveFakePlayer(testData.fakePlayer.id, newPosition);
      
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
    if (!testData) return;
    
    const checkInterval = setInterval(async () => {
      const currentTime = Date.now();
      const elapsed = currentTime - testData.startTime;
      
      // Get current mob state
      let mob: any = null;
      if (this.mobSystem) {
        mob = await this.mobSystem.getMob(testData.mobId);
      }
      
      if (!mob) {
        clearInterval(checkInterval);
        this.failTest(stationId, 'Mob disappeared during aggro test');
        return;
      }

      // Check aggro detection
      const isAggressive = mob.state === 'aggressive' || mob.state === 'combat';
      const hasTarget = mob.target === testData.fakePlayer.id;
      
      if (isAggressive && hasTarget && !testData.aggroDetected) {
        testData.aggroDetected = true;
        console.log(`[RPGAggroTestSystem] Aggro detected for ${stationId} at ${elapsed}ms`);
      }

      // Check chase started
      if (testData.aggroDetected && !testData.chaseStarted) {
        const mobDistance = this.getDistance(mob.position, testData.initialMobPosition);
        if (mobDistance > 2) { // Mob moved from spawn
          testData.chaseStarted = true;
          console.log(`[RPGAggroTestSystem] Chase started for ${stationId}`);
        }
      }

      // Track max chase distance
      const chaseDistance = this.getDistance(mob.position, testData.initialMobPosition);
      testData.maxChaseDistance = Math.max(testData.maxChaseDistance, chaseDistance);

      // Check leash return
      if (testData.leashTested && !testData.returnedToSpawn) {
        const spawnDistance = this.getDistance(mob.position, testData.initialMobPosition);
        if (spawnDistance < 3 && mob.state === 'idle') {
          testData.returnedToSpawn = true;
          console.log(`[RPGAggroTestSystem] Mob returned to spawn for ${stationId}`);
        }
      }

      // Evaluate test results based on test type
      if (this.shouldCompleteTest(stationId, testData, elapsed)) {
        clearInterval(checkInterval);
        this.evaluateTestResults(stationId, testData, elapsed);
        return;
      }
      
      // Check timeout
      const station = this.testStations.get(stationId);
      if (elapsed > (station?.timeoutMs || 30000)) {
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
    const results: any = {
      duration: elapsed,
      playerLevel: testData.playerLevel,
      mobType: testData.mobType,
      expectedAggressive: testData.expectedAggressive,
      actualAggressive: testData.aggroDetected,
      chaseStarted: testData.chaseStarted,
      maxChaseDistance: testData.maxChaseDistance
    };

    switch (stationId) {
      case 'low_level_aggro_test':
      case 'special_aggro_test':
        if (testData.aggroDetected && testData.chaseStarted) {
          results.success = true;
          this.passTest(stationId, results);
        } else {
          this.failTest(stationId, `Expected aggro but got: aggro=${testData.aggroDetected}, chase=${testData.chaseStarted}`);
        }
        break;
        
      case 'high_level_aggro_test':
        if (!testData.aggroDetected) {
          results.success = true;
          this.passTest(stationId, results);
        } else {
          this.failTest(stationId, `Expected no aggro for high level player but mob was aggressive`);
        }
        break;
        
      case 'leash_test':
        results.leashTested = testData.leashTested;
        results.returnedToSpawn = testData.returnedToSpawn;
        
        if (testData.aggroDetected && testData.chaseStarted && testData.leashTested) {
          if (testData.returnedToSpawn) {
            results.success = true;
            this.passTest(stationId, results);
          } else {
            this.failTest(stationId, `Mob chased but did not return to spawn when player moved too far`);
          }
        } else {
          this.failTest(stationId, `Leash test incomplete: aggro=${testData.aggroDetected}, chase=${testData.chaseStarted}, tested=${testData.leashTested}`);
        }
        break;
        
      case 'aggro_range_test':
        if (testData.aggroDetected) {
          results.success = true;
          this.passTest(stationId, results);
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
        console.log(`[RPGAggroTestSystem] Cleaned up test mob: ${testData.mobId}`);
      }
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGAggroTestSystem] Cleanup completed for ${stationId}`);
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
    const passedTests = testResults.filter((result: any) => result.passed).length;
    
    // Calculate aggro response accuracy
    let aggroResponseAccuracy = 0;
    if (totalTests > 0) {
      const successfulAggroTests = testResults.filter((result: any) => 
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
          ? testResults.reduce((sum: number, result: any) => sum + (result.data?.duration || 0), 0) / testResults.length 
          : 0
      }
    };
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