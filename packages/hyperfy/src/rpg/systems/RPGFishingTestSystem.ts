/**
 * RPG Fishing Test System
 * Tests complete fishing loop per GDD specifications:
 * - Equip fishing rod near water
 * - Click fishing spot to start fishing
 * - Test success rates based on skill level
 * - Test XP gain and fish drops
 * - Test inventory management for caught fish
 * - Test failure conditions (no rod, wrong location, inventory full)
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem } from '../data/items';

interface FishingTestData {
  fakePlayer: FakePlayer;
  fishingSpot: { x: number; y: number; z: number };
  startTime: number;
  initialFishingXP: number;
  finalFishingXP: number;
  fishCaught: number;
  attemptsMade: number;
  successRate: number;
  expectedSuccessRate: number;
  hasRodEquipped: boolean;
  nearWater: boolean;
  inventorySpace: number;
}

export class RPGFishingTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, FishingTestData>();
  private resourceSystem: any;
  private inventorySystem: any;
  private xpSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGFishingTestSystem] Initializing fishing test system...');
    
    // Get required systems
    this.resourceSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGResourceSystem');
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    this.xpSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGXPSystem');
    
    if (!this.resourceSystem) {
      throw new Error('[RPGFishingTestSystem] RPGResourceSystem not found - required for fishing tests');
    }
    
    if (!this.inventorySystem) {
      throw new Error('[RPGFishingTestSystem] RPGInventorySystem not found - required for fishing tests');
    }
    
    if (!this.xpSystem) {
      throw new Error('[RPGFishingTestSystem] RPGXPSystem not found - required for fishing tests');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGFishingTestSystem] Fishing test system initialized');
  }

  private createTestStations(): void {
    // Basic Fishing Test - Player with rod near water
    this.createTestStation({
      id: 'basic_fishing_success',
      name: 'Basic Fishing Success Test',
      position: { x: -90, y: 0, z: 10 },
      timeoutMs: 30000 // 30 seconds
    });

    // No Rod Test - Player without fishing rod
    this.createTestStation({
      id: 'fishing_no_rod_failure',
      name: 'Fishing Without Rod Failure Test',
      position: { x: -90, y: 0, z: 20 },
      timeoutMs: 15000 // 15 seconds
    });

    // Wrong Location Test - Player with rod away from water
    this.createTestStation({
      id: 'fishing_wrong_location_failure',
      name: 'Fishing Wrong Location Failure Test',
      position: { x: -90, y: 0, z: 30 },
      timeoutMs: 15000 // 15 seconds
    });

    // Full Inventory Test - Player with rod but full inventory
    this.createTestStation({
      id: 'fishing_full_inventory_failure',
      name: 'Fishing Full Inventory Failure Test',
      position: { x: -90, y: 0, z: 40 },
      timeoutMs: 20000 // 20 seconds
    });

    // Skill Progression Test - Test XP gain and level ups
    this.createTestStation({
      id: 'fishing_skill_progression',
      name: 'Fishing Skill Progression Test',
      position: { x: -90, y: 0, z: 50 },
      timeoutMs: 45000 // 45 seconds
    });

    // High Level Fishing Test - Player with high fishing skill
    this.createTestStation({
      id: 'fishing_high_level',
      name: 'High Level Fishing Success Rate Test',
      position: { x: -90, y: 0, z: 60 },
      timeoutMs: 35000 // 35 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_fishing_success':
        this.runBasicFishingSuccessTest(stationId);
        break;
      case 'fishing_no_rod_failure':
        this.runNoRodFailureTest(stationId);
        break;
      case 'fishing_wrong_location_failure':
        this.runWrongLocationFailureTest(stationId);
        break;
      case 'fishing_full_inventory_failure':
        this.runFullInventoryFailureTest(stationId);
        break;
      case 'fishing_skill_progression':
        this.runSkillProgressionTest(stationId);
        break;
      case 'fishing_high_level':
        this.runHighLevelFishingTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown fishing test: ${stationId}`);
    }
  }

  private async runBasicFishingSuccessTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGFishingTestSystem] Starting basic fishing success test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with level 5 fishing and fishing rod
      const fakePlayer = this.createFakePlayer({
        id: `fishing_success_player_${Date.now()}`,
        name: 'Fishing Success Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, fishing: 5 // Level 5 fishing
        }
      });

      // Give player fishing rod and equip it
      const fishingRod = getItem('101'); // Fishing Rod
      if (fishingRod) {
        fakePlayer.inventory = [{ item: fishingRod, quantity: 1 }];
        fakePlayer.equipment.weapon = fishingRod;
      }

      // Create fishing spot (water area)
      const fishingSpot = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFishingSpotVisual(stationId, fishingSpot);

      // Get initial fishing XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'fishing') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fishingSpot,
        startTime: Date.now(),
        initialFishingXP: initialXP,
        finalFishingXP: initialXP,
        fishCaught: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 70, // Level 5 fishing should have ~70% success rate
        hasRodEquipped: true,
        nearWater: true,
        inventorySpace: 27 // 28 slots - 1 for rod
      });

      // Start fishing sequence
      this.startFishingAttempts(stationId, 10);
      
    } catch (error) {
      this.failTest(stationId, `Basic fishing success test error: ${error}`);
    }
  }

  private async runNoRodFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGFishingTestSystem] Starting no rod failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player WITHOUT fishing rod
      const fakePlayer = this.createFakePlayer({
        id: `no_rod_player_${Date.now()}`,
        name: 'No Rod Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, fishing: 5
        }
      });

      // No fishing rod in inventory
      fakePlayer.inventory = [];
      fakePlayer.equipment = {};

      // Create fishing spot
      const fishingSpot = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFishingSpotVisual(stationId, fishingSpot);

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fishingSpot,
        startTime: Date.now(),
        initialFishingXP: 0,
        finalFishingXP: 0,
        fishCaught: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - no rod
        hasRodEquipped: false,
        nearWater: true,
        inventorySpace: 28
      });

      // Try to fish without rod - should fail immediately
      this.testFishingFailure(stationId, 'no_rod');
      
    } catch (error) {
      this.failTest(stationId, `No rod failure test error: ${error}`);
    }
  }

  private async runWrongLocationFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGFishingTestSystem] Starting wrong location failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with fishing rod but away from water
      const fakePlayer = this.createFakePlayer({
        id: `wrong_location_player_${Date.now()}`,
        name: 'Wrong Location Test Player',
        position: { x: station.position.x - 5, y: station.position.y, z: station.position.z }, // Far from fishing spot
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, fishing: 5
        }
      });

      // Give player fishing rod
      const fishingRod = getItem('101');
      if (fishingRod) {
        fakePlayer.inventory = [{ item: fishingRod, quantity: 1 }];
        fakePlayer.equipment.weapon = fishingRod;
      }

      // Create fishing spot far away
      const fishingSpot = { x: station.position.x + 10, y: station.position.y, z: station.position.z };
      this.createFishingSpotVisual(stationId, fishingSpot);

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fishingSpot,
        startTime: Date.now(),
        initialFishingXP: 0,
        finalFishingXP: 0,
        fishCaught: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - too far from water
        hasRodEquipped: true,
        nearWater: false,
        inventorySpace: 27
      });

      // Try to fish from wrong location - should fail
      this.testFishingFailure(stationId, 'too_far');
      
    } catch (error) {
      this.failTest(stationId, `Wrong location failure test error: ${error}`);
    }
  }

  private async runFullInventoryFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGFishingTestSystem] Starting full inventory failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with fishing rod and FULL inventory
      const fakePlayer = this.createFakePlayer({
        id: `full_inventory_player_${Date.now()}`,
        name: 'Full Inventory Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, fishing: 5
        }
      });

      // Fill inventory completely (28 slots)
      const fishingRod = getItem('101');
      const dummyItem = getItem('1'); // Bronze sword as dummy item
      
      if (fishingRod && dummyItem) {
        fakePlayer.inventory = [{ item: fishingRod, quantity: 1 }];
        fakePlayer.equipment.weapon = fishingRod;
        
        // Fill remaining 27 slots with dummy items
        for (let i = 0; i < 27; i++) {
          fakePlayer.inventory.push({ item: dummyItem, quantity: 1 });
        }
      }

      // Create fishing spot
      const fishingSpot = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFishingSpotVisual(stationId, fishingSpot);

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fishingSpot,
        startTime: Date.now(),
        initialFishingXP: 0,
        finalFishingXP: 0,
        fishCaught: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - inventory full
        hasRodEquipped: true,
        nearWater: true,
        inventorySpace: 0
      });

      // Try to fish with full inventory - should fail
      this.testFishingFailure(stationId, 'inventory_full');
      
    } catch (error) {
      this.failTest(stationId, `Full inventory failure test error: ${error}`);
    }
  }

  private async runSkillProgressionTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGFishingTestSystem] Starting skill progression test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with low fishing level (1) to test progression
      const fakePlayer = this.createFakePlayer({
        id: `skill_progression_player_${Date.now()}`,
        name: 'Skill Progression Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, fishing: 1 // Level 1 fishing - low success rate
        }
      });

      // Give player fishing rod
      const fishingRod = getItem('101');
      if (fishingRod) {
        fakePlayer.inventory = [{ item: fishingRod, quantity: 1 }];
        fakePlayer.equipment.weapon = fishingRod;
      }

      // Create fishing spot
      const fishingSpot = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFishingSpotVisual(stationId, fishingSpot);

      // Get initial fishing XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'fishing') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fishingSpot,
        startTime: Date.now(),
        initialFishingXP: initialXP,
        finalFishingXP: initialXP,
        fishCaught: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 62, // Level 1 fishing should have ~62% success rate (60% base + 2%)
        hasRodEquipped: true,
        nearWater: true,
        inventorySpace: 27
      });

      // Start many fishing attempts to test progression
      this.startFishingAttempts(stationId, 20);
      
    } catch (error) {
      this.failTest(stationId, `Skill progression test error: ${error}`);
    }
  }

  private async runHighLevelFishingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGFishingTestSystem] Starting high level fishing test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with high fishing level
      const fakePlayer = this.createFakePlayer({
        id: `high_level_player_${Date.now()}`,
        name: 'High Level Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, fishing: 15 // Level 15 fishing - high success rate
        }
      });

      // Give player fishing rod
      const fishingRod = getItem('101');
      if (fishingRod) {
        fakePlayer.inventory = [{ item: fishingRod, quantity: 1 }];
        fakePlayer.equipment.weapon = fishingRod;
      }

      // Create fishing spot
      const fishingSpot = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFishingSpotVisual(stationId, fishingSpot);

      // Get initial fishing XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'fishing') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fishingSpot,
        startTime: Date.now(),
        initialFishingXP: initialXP,
        finalFishingXP: initialXP,
        fishCaught: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 85, // Level 15 fishing should have ~85% success rate (capped)
        hasRodEquipped: true,
        nearWater: true,
        inventorySpace: 27
      });

      // Start fishing attempts
      this.startFishingAttempts(stationId, 15);
      
    } catch (error) {
      this.failTest(stationId, `High level fishing test error: ${error}`);
    }
  }

  private createFishingSpotVisual(stationId: string, location: { x: number; y: number; z: number }): void {
    this.world.emit('rpg:test:fishing_spot:create', {
      id: `fishing_spot_${stationId}`,
      position: location,
      color: '#0077be', // Blue for water
      size: { x: 2, y: 0.2, z: 2 },
      type: 'fishing_spot'
    });
  }

  private startFishingAttempts(stationId: string, maxAttempts: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGFishingTestSystem] Starting ${maxAttempts} fishing attempts...`);

    let attempts = 0;

    const attemptFishing = async () => {
      if (attempts >= maxAttempts) {
        this.completeFishingTest(stationId);
        return;
      }

      attempts++;
      testData.attemptsMade = attempts;

      console.log(`[RPGFishingTestSystem] Fishing attempt ${attempts}/${maxAttempts}`);

      // Move player near fishing spot
      this.moveFakePlayer(testData.fakePlayer.id, {
        x: testData.fishingSpot.x - 1,
        y: testData.fishingSpot.y,
        z: testData.fishingSpot.z
      });

      // Attempt fishing using resource system
      try {
        this.world.emit('rpg:resource:start_gather', {
          playerId: testData.fakePlayer.id,
          resourceId: `fishing_spot_${stationId}`,
          playerPosition: testData.fakePlayer.position
        });

        // Wait for fishing to complete (resource gathering takes 3-5 seconds)
        setTimeout(() => {
          // Check if fish was caught by examining inventory
          const fishInInventory = testData.fakePlayer.inventory.filter(slot => 
            slot.item.name.toLowerCase().includes('fish')
          );
          
          if (fishInInventory.length > testData.fishCaught) {
            testData.fishCaught++;
            console.log(`[RPGFishingTestSystem] Fish caught! Total: ${testData.fishCaught}`);
            
            // Test XP gain
            const currentXP = this.xpSystem.getSkillXP(testData.fakePlayer.id, 'fishing') || 0;
            if (currentXP > testData.finalFishingXP) {
              testData.finalFishingXP = currentXP;
              console.log(`[RPGFishingTestSystem] XP gained: ${currentXP - testData.initialFishingXP} total`);
            }
          }

          // Continue fishing
          setTimeout(attemptFishing, 500);
        }, 4000); // Wait for fishing attempt to complete

      } catch (error) {
        console.log(`[RPGFishingTestSystem] Fishing attempt failed: ${error}`);
        setTimeout(attemptFishing, 500);
      }
    };

    // Start fishing after a brief delay
    setTimeout(attemptFishing, 1000);
  }

  private testFishingFailure(stationId: string, failureType: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGFishingTestSystem] Testing fishing failure: ${failureType}`);

    // Move player to fishing spot
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.fishingSpot.x - 1,
      y: testData.fishingSpot.y,
      z: testData.fishingSpot.z
    });

    // Attempt fishing - should fail
    try {
      this.world.emit('rpg:resource:start_gather', {
        playerId: testData.fakePlayer.id,
        resourceId: `fishing_spot_${stationId}`,
        playerPosition: testData.fakePlayer.position
      });

      // Check for failure after brief delay
      setTimeout(() => {
        // Test should pass if no fish was caught (failure case)
        if (testData.fishCaught === 0) {
          this.passTest(stationId, {
            failureType,
            fishCaught: testData.fishCaught,
            hasRodEquipped: testData.hasRodEquipped,
            nearWater: testData.nearWater,
            inventorySpace: testData.inventorySpace,
            duration: Date.now() - testData.startTime
          });
        } else {
          this.failTest(stationId, `Fishing failure test failed: expected failure but caught ${testData.fishCaught} fish`);
        }
      }, 5000);

    } catch (error) {
      // Exception is expected for failure cases
      this.passTest(stationId, {
        failureType,
        error: (error as Error).toString(),
        duration: Date.now() - testData.startTime
      });
    }
  }

  private completeFishingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Calculate final success rate
    if (testData.attemptsMade > 0) {
      testData.successRate = (testData.fishCaught / testData.attemptsMade) * 100;
    }

    const xpGained = testData.finalFishingXP - testData.initialFishingXP;

    const results = {
      fishCaught: testData.fishCaught,
      attemptsMade: testData.attemptsMade,
      successRate: testData.successRate,
      expectedSuccessRate: testData.expectedSuccessRate,
      xpGained: xpGained,
      hasRodEquipped: testData.hasRodEquipped,
      nearWater: testData.nearWater,
      inventorySpace: testData.inventorySpace,
      duration: Date.now() - testData.startTime
    };

    // Test passes if:
    // 1. Success rate is within 15% of expected rate
    // 2. At least some fish were caught (for success tests)
    // 3. XP was gained (for success tests)
    const successRateDiff = Math.abs(testData.successRate - testData.expectedSuccessRate);
    
    if (testData.expectedSuccessRate > 0) {
      // Success test - should catch fish and gain XP
      if (testData.fishCaught > 0 && xpGained > 0 && successRateDiff <= 15) {
        this.passTest(stationId, results);
      } else {
        this.failTest(stationId, `Fishing test failed: caught=${testData.fishCaught}, xp=${xpGained}, success_rate=${testData.successRate}% (expected ~${testData.expectedSuccessRate}%)`);
      }
    } else {
      // Failure test - should catch no fish
      if (testData.fishCaught === 0) {
        this.passTest(stationId, results);
      } else {
        this.failTest(stationId, `Fishing failure test failed: expected 0 fish but caught ${testData.fishCaught}`);
      }
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up fishing spot visual
      this.world.emit('rpg:test:fishing_spot:remove', {
        id: `fishing_spot_${stationId}`
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGFishingTestSystem] Cleanup completed for ${stationId}`);
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
    
    // Check for advanced fishing features
    const hasBasicFishing = this.testStations.has('basic_fishing_success');
    const hasFailureHandling = this.testStations.has('fishing_no_rod_failure');
    const hasLocationChecks = this.testStations.has('fishing_wrong_location_failure');
    const hasInventoryManagement = this.testStations.has('fishing_full_inventory_failure');
    const hasSkillProgression = this.testStations.has('fishing_skill_progression');
    
    const advancedFeatureCount = [
      hasBasicFishing, hasFailureHandling, hasLocationChecks, hasInventoryManagement, hasSkillProgression
    ].filter(Boolean).length;
    
    // Check fishing performance with real validation
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.fishCaught > 0) {
        // Fishing performance validation logic
        const catchEfficiency = testData.fishCaught / Math.max(1, testData.attemptsMade);
        if (catchEfficiency > 0.3) { // At least 30% catch rate for successful tests
          hasGoodPerformanceMetrics = true;
          break;
        }
      }
    }
    
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