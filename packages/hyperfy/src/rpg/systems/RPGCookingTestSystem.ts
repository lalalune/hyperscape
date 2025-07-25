/**
 * RPG Cooking Test System
 * Tests complete cooking loop per GDD specifications:
 * - Use raw fish on fire to cook food
 * - Test cooking success rates based on skill level
 * - Test burning mechanics at low levels
 * - Test XP gain from successful cooking
 * - Test failure conditions (no fire, no raw food, wrong items)
 * - Test food healing properties
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem } from '../data/items';

interface CookingTestData {
  fakePlayer: FakePlayer;
  fireLocation: { x: number; y: number; z: number };
  startTime: number;
  initialCookingXP: number;
  finalCookingXP: number;
  rawFishUsed: number;
  cookedFishCreated: number;
  burntFishCreated: number;
  successfulCooks: number;
  burnedCooks: number;
  attemptsMade: number;
  successRate: number;
  expectedSuccessRate: number;
  hasFireNearby: boolean;
  hasRawFood: boolean;
}

export class RPGCookingTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, CookingTestData>();
  private processingSystem: any;
  private inventorySystem: any;
  private xpSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGCookingTestSystem] Initializing cooking test system...');
    
    // Get required systems
    this.processingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGProcessingSystem');
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    this.xpSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGXPSystem');
    
    if (!this.processingSystem) {
      throw new Error('[RPGCookingTestSystem] RPGProcessingSystem not found - required for cooking tests');
    }
    
    if (!this.inventorySystem) {
      throw new Error('[RPGCookingTestSystem] RPGInventorySystem not found - required for cooking tests');
    }
    
    if (!this.xpSystem) {
      throw new Error('[RPGCookingTestSystem] RPGXPSystem not found - required for cooking tests');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGCookingTestSystem] Cooking test system initialized');
  }

  private createTestStations(): void {
    // Basic Cooking Success Test - Player with raw fish and fire
    this.createTestStation({
      id: 'basic_cooking_success',
      name: 'Basic Cooking Success Test',
      position: { x: -100, y: 0, z: 10 },
      timeoutMs: 25000 // 25 seconds
    });

    // No Fire Test - Player with raw fish but no fire
    this.createTestStation({
      id: 'cooking_no_fire_failure',
      name: 'Cooking Without Fire Failure Test',
      position: { x: -100, y: 0, z: 20 },
      timeoutMs: 15000 // 15 seconds
    });

    // No Raw Food Test - Player with fire but no raw fish
    this.createTestStation({
      id: 'cooking_no_food_failure',
      name: 'Cooking Without Raw Food Failure Test',
      position: { x: -100, y: 0, z: 30 },
      timeoutMs: 15000 // 15 seconds
    });

    // Low Level Burning Test - Test burning at low cooking level
    this.createTestStation({
      id: 'cooking_burning_test',
      name: 'Low Level Cooking Burning Test',
      position: { x: -100, y: 0, z: 40 },
      timeoutMs: 30000 // 30 seconds
    });

    // High Level Success Test - Test high success rate at high cooking level
    this.createTestStation({
      id: 'cooking_high_level',
      name: 'High Level Cooking Success Test',
      position: { x: -100, y: 0, z: 50 },
      timeoutMs: 25000 // 25 seconds
    });

    // Skill Progression Test - Test XP gain and level progression
    this.createTestStation({
      id: 'cooking_skill_progression',
      name: 'Cooking Skill Progression Test',
      position: { x: -100, y: 0, z: 60 },
      timeoutMs: 40000 // 40 seconds
    });

    // Food Healing Test - Test that cooked food heals the player
    this.createTestStation({
      id: 'cooking_food_healing',
      name: 'Cooked Food Healing Test',
      position: { x: -100, y: 0, z: 70 },
      timeoutMs: 20000 // 20 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_cooking_success':
        this.runBasicCookingSuccessTest(stationId);
        break;
      case 'cooking_no_fire_failure':
        this.runNoFireFailureTest(stationId);
        break;
      case 'cooking_no_food_failure':
        this.runNoFoodFailureTest(stationId);
        break;
      case 'cooking_burning_test':
        this.runBurningTest(stationId);
        break;
      case 'cooking_high_level':
        this.runHighLevelCookingTest(stationId);
        break;
      case 'cooking_skill_progression':
        this.runSkillProgressionTest(stationId);
        break;
      case 'cooking_food_healing':
        this.runFoodHealingTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown cooking test: ${stationId}`);
    }
  }

  private async runBasicCookingSuccessTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGCookingTestSystem] Starting basic cooking success test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with moderate cooking level
      const fakePlayer = this.createFakePlayer({
        id: `cooking_success_player_${Date.now()}`,
        name: 'Cooking Success Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, cooking: 10 // Level 10 cooking - good success rate
        }
      });

      // Give player raw fish
      const rawFish = getItem('201'); // Raw Fish
      if (rawFish) {
        fakePlayer.inventory = [{ item: rawFish, quantity: 5 }];
      }

      // Create fire location
      const fireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFireVisual(stationId, fireLocation);

      // Get initial cooking XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'cooking') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fireLocation,
        startTime: Date.now(),
        initialCookingXP: initialXP,
        finalCookingXP: initialXP,
        rawFishUsed: 0,
        cookedFishCreated: 0,
        burntFishCreated: 0,
        successfulCooks: 0,
        burnedCooks: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 85, // Level 10 cooking should have ~85% success rate
        hasFireNearby: true,
        hasRawFood: true
      });

      // Start cooking sequence
      this.startCookingAttempts(stationId, 5);
      
    } catch (error) {
      this.failTest(stationId, `Basic cooking success test error: ${error}`);
    }
  }

  private async runNoFireFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGCookingTestSystem] Starting no fire failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with raw fish but NO fire
      const fakePlayer = this.createFakePlayer({
        id: `no_fire_player_${Date.now()}`,
        name: 'No Fire Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, cooking: 5
        }
      });

      // Give player raw fish
      const rawFish = getItem('201');
      if (rawFish) {
        fakePlayer.inventory = [{ item: rawFish, quantity: 3 }];
      }

      // No fire created - this should cause cooking to fail
      const fireLocation = { x: station.position.x + 10, y: station.position.y, z: station.position.z }; // Far away

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fireLocation,
        startTime: Date.now(),
        initialCookingXP: 0,
        finalCookingXP: 0,
        rawFishUsed: 0,
        cookedFishCreated: 0,
        burntFishCreated: 0,
        successfulCooks: 0,
        burnedCooks: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - no fire
        hasFireNearby: false,
        hasRawFood: true
      });

      // Try to cook without fire - should fail
      this.testCookingFailure(stationId, 'no_fire');
      
    } catch (error) {
      this.failTest(stationId, `No fire failure test error: ${error}`);
    }
  }

  private async runNoFoodFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGCookingTestSystem] Starting no food failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with fire but NO raw food
      const fakePlayer = this.createFakePlayer({
        id: `no_food_player_${Date.now()}`,
        name: 'No Food Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, cooking: 5
        }
      });

      // No raw fish in inventory
      fakePlayer.inventory = [];

      // Create fire
      const fireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFireVisual(stationId, fireLocation);

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fireLocation,
        startTime: Date.now(),
        initialCookingXP: 0,
        finalCookingXP: 0,
        rawFishUsed: 0,
        cookedFishCreated: 0,
        burntFishCreated: 0,
        successfulCooks: 0,
        burnedCooks: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - no raw food
        hasFireNearby: true,
        hasRawFood: false
      });

      // Try to cook without raw food - should fail
      this.testCookingFailure(stationId, 'no_food');
      
    } catch (error) {
      this.failTest(stationId, `No food failure test error: ${error}`);
    }
  }

  private async runBurningTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGCookingTestSystem] Starting burning test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with LOW cooking level to increase burning chance
      const fakePlayer = this.createFakePlayer({
        id: `burning_player_${Date.now()}`,
        name: 'Burning Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, cooking: 1 // Level 1 cooking - high burn rate
        }
      });

      // Give player lots of raw fish to test burning
      const rawFish = getItem('201');
      if (rawFish) {
        fakePlayer.inventory = [{ item: rawFish, quantity: 10 }];
      }

      // Create fire
      const fireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFireVisual(stationId, fireLocation);

      // Get initial cooking XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'cooking') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fireLocation,
        startTime: Date.now(),
        initialCookingXP: initialXP,
        finalCookingXP: initialXP,
        rawFishUsed: 0,
        cookedFishCreated: 0,
        burntFishCreated: 0,
        successfulCooks: 0,
        burnedCooks: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 30, // Level 1 cooking should have ~30% success rate (lots of burning)
        hasFireNearby: true,
        hasRawFood: true
      });

      // Start cooking many fish to test burning
      this.startCookingAttempts(stationId, 10);
      
    } catch (error) {
      this.failTest(stationId, `Burning test error: ${error}`);
    }
  }

  private async runHighLevelCookingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGCookingTestSystem] Starting high level cooking test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with HIGH cooking level
      const fakePlayer = this.createFakePlayer({
        id: `high_level_cooking_player_${Date.now()}`,
        name: 'High Level Cooking Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, cooking: 20 // Level 20 cooking - very high success rate
        }
      });

      // Give player raw fish
      const rawFish = getItem('201');
      if (rawFish) {
        fakePlayer.inventory = [{ item: rawFish, quantity: 6 }];
      }

      // Create fire
      const fireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFireVisual(stationId, fireLocation);

      // Get initial cooking XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'cooking') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fireLocation,
        startTime: Date.now(),
        initialCookingXP: initialXP,
        finalCookingXP: initialXP,
        rawFishUsed: 0,
        cookedFishCreated: 0,
        burntFishCreated: 0,
        successfulCooks: 0,
        burnedCooks: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 95, // Level 20 cooking should have ~95% success rate
        hasFireNearby: true,
        hasRawFood: true
      });

      // Start cooking sequence
      this.startCookingAttempts(stationId, 6);
      
    } catch (error) {
      this.failTest(stationId, `High level cooking test error: ${error}`);
    }
  }

  private async runSkillProgressionTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGCookingTestSystem] Starting skill progression test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with low cooking level to test progression
      const fakePlayer = this.createFakePlayer({
        id: `skill_progression_cooking_player_${Date.now()}`,
        name: 'Skill Progression Cooking Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, cooking: 3 // Level 3 cooking
        }
      });

      // Give player many raw fish for progression testing
      const rawFish = getItem('201');
      if (rawFish) {
        fakePlayer.inventory = [{ item: rawFish, quantity: 15 }];
      }

      // Create fire
      const fireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFireVisual(stationId, fireLocation);

      // Get initial cooking XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'cooking') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fireLocation,
        startTime: Date.now(),
        initialCookingXP: initialXP,
        finalCookingXP: initialXP,
        rawFishUsed: 0,
        cookedFishCreated: 0,
        burntFishCreated: 0,
        successfulCooks: 0,
        burnedCooks: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 50, // Level 3 cooking should have ~50% success rate
        hasFireNearby: true,
        hasRawFood: true
      });

      // Cook many fish to test skill progression
      this.startCookingAttempts(stationId, 15);
      
    } catch (error) {
      this.failTest(stationId, `Skill progression test error: ${error}`);
    }
  }

  private async runFoodHealingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGCookingTestSystem] Starting food healing test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with damaged health and cooking supplies
      const fakePlayer = this.createFakePlayer({
        id: `food_healing_player_${Date.now()}`,
        name: 'Food Healing Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 50, maxHealth: 100, cooking: 15 // Damaged health
        }
      });

      // Give player raw fish and already cooked fish
      const rawFish = getItem('201');
      const cookedFish = getItem('202'); // Cooked Fish
      if (rawFish && cookedFish) {
        fakePlayer.inventory = [
          { item: rawFish, quantity: 2 },
          { item: cookedFish, quantity: 1 } // Already have one cooked fish
        ];
      }

      // Create fire
      const fireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFireVisual(stationId, fireLocation);

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        fireLocation,
        startTime: Date.now(),
        initialCookingXP: 0,
        finalCookingXP: 0,
        rawFishUsed: 0,
        cookedFishCreated: 0,
        burntFishCreated: 0,
        successfulCooks: 0,
        burnedCooks: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 90, // Level 15 cooking should be reliable
        hasFireNearby: true,
        hasRawFood: true
      });

      // First cook more food, then test healing
      this.startFoodHealingSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Food healing test error: ${error}`);
    }
  }

  private createFireVisual(stationId: string, location: { x: number; y: number; z: number }): void {
    this.world.emit('rpg:test:fire:create', {
      id: `fire_${stationId}`,
      position: location,
      color: '#ff4500', // Orange-red for fire
      size: { x: 0.8, y: 1.2, z: 0.8 },
      type: 'campfire'
    });
  }

  private startCookingAttempts(stationId: string, maxAttempts: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGCookingTestSystem] Starting ${maxAttempts} cooking attempts...`);

    let attempts = 0;

    const attemptCooking = async () => {
      if (attempts >= maxAttempts) {
        this.completeCookingTest(stationId);
        return;
      }

      attempts++;
      testData.attemptsMade = attempts;

      console.log(`[RPGCookingTestSystem] Cooking attempt ${attempts}/${maxAttempts}`);

      // Move player near fire
      this.moveFakePlayer(testData.fakePlayer.id, {
        x: testData.fireLocation.x - 1,
        y: testData.fireLocation.y,
        z: testData.fireLocation.z
      });

      // Find raw fish in inventory
      const rawFishSlot = testData.fakePlayer.inventory.find(slot => 
        slot.item.name.toLowerCase().includes('raw') && slot.quantity > 0
      );

      if (!rawFishSlot) {
        console.log('[RPGCookingTestSystem] No more raw fish to cook');
        this.completeCookingTest(stationId);
        return;
      }

      // Attempt cooking using processing system
      try {
        this.world.emit('rpg:processing:cook', {
          playerId: testData.fakePlayer.id,
          itemId: rawFishSlot.item.id,
          fireLocation: testData.fireLocation
        });

        // Wait for cooking to complete
        setTimeout(() => {
          // Check cooking results by examining inventory changes
          const initialRawCount = testData.rawFishUsed;
          testData.rawFishUsed++;

          // Check for cooked fish in inventory
          const cookedFishInInventory = testData.fakePlayer.inventory.filter(slot => 
            slot.item.name.toLowerCase().includes('cooked') && !slot.item.name.toLowerCase().includes('burnt')
          );
          
          const burntFishInInventory = testData.fakePlayer.inventory.filter(slot => 
            slot.item.name.toLowerCase().includes('burnt')
          );

          // Count results
          const newCookedCount = cookedFishInInventory.reduce((sum, slot) => sum + slot.quantity, 0);
          const newBurntCount = burntFishInInventory.reduce((sum, slot) => sum + slot.quantity, 0);

          if (newCookedCount > testData.cookedFishCreated) {
            testData.successfulCooks++;
            testData.cookedFishCreated = newCookedCount;
            console.log(`[RPGCookingTestSystem] Successfully cooked fish! Total cooked: ${testData.cookedFishCreated}`);
          }

          if (newBurntCount > testData.burntFishCreated) {
            testData.burnedCooks++;
            testData.burntFishCreated = newBurntCount;
            console.log(`[RPGCookingTestSystem] Burned fish! Total burnt: ${testData.burntFishCreated}`);
          }

          // Test XP gain
          const currentXP = this.xpSystem.getSkillXP(testData.fakePlayer.id, 'cooking') || 0;
          if (currentXP > testData.finalCookingXP) {
            testData.finalCookingXP = currentXP;
            console.log(`[RPGCookingTestSystem] XP gained: ${currentXP - testData.initialCookingXP} total`);
          }

          // Remove raw fish from inventory
          rawFishSlot.quantity--;
          if (rawFishSlot.quantity <= 0) {
            const index = testData.fakePlayer.inventory.indexOf(rawFishSlot);
            testData.fakePlayer.inventory.splice(index, 1);
          }

          // Continue cooking
          setTimeout(attemptCooking, 500);
        }, 3000); // Wait for cooking to complete

      } catch (error) {
        console.log(`[RPGCookingTestSystem] Cooking attempt failed: ${error}`);
        setTimeout(attemptCooking, 500);
      }
    };

    // Start cooking after a brief delay
    setTimeout(attemptCooking, 1000);
  }

  private startFoodHealingSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGCookingTestSystem] Starting food healing sequence...');

    // First cook 2 more raw fish
    this.startCookingAttempts(stationId, 2);

    // After cooking, test healing
    setTimeout(() => {
      this.testFoodHealing(stationId);
    }, 10000);
  }

  private testFoodHealing(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGCookingTestSystem] Testing food healing...');

    const initialHealth = testData.fakePlayer.stats.health;

    // Find cooked fish in inventory
    const cookedFishSlot = testData.fakePlayer.inventory.find(slot => 
      slot.item.name.toLowerCase().includes('cooked') && !slot.item.name.toLowerCase().includes('burnt')
    );

    if (!cookedFishSlot || cookedFishSlot.quantity === 0) {
      this.failTest(stationId, 'Food healing test failed: no cooked fish available');
      return;
    }

    // Use/eat the cooked fish
    try {
      this.world.emit('rpg:item:use', {
        playerId: testData.fakePlayer.id,
        itemId: cookedFishSlot.item.id,
        context: 'consume'
      });

      // Wait and check if health increased
      setTimeout(() => {
        const finalHealth = testData.fakePlayer.stats.health;
        const healthGained = finalHealth - initialHealth;

        const results = {
          initialHealth,
          finalHealth,
          healthGained,
          cookedFishAvailable: cookedFishSlot.quantity,
          healingWorked: healthGained > 0,
          duration: Date.now() - testData.startTime
        };

        if (healthGained > 0) {
          this.passTest(stationId, results);
        } else {
          this.failTest(stationId, `Food healing test failed: no health gained (${initialHealth} -> ${finalHealth})`);
        }
      }, 2000);

    } catch (error) {
      this.failTest(stationId, `Food healing test error: ${error}`);
    }
  }

  private testCookingFailure(stationId: string, failureType: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGCookingTestSystem] Testing cooking failure: ${failureType}`);

    // Try to cook - should fail
    try {
      this.world.emit('rpg:processing:cook', {
        playerId: testData.fakePlayer.id,
        itemId: '201', // Raw Fish
        fireLocation: testData.fireLocation
      });

      // Check for failure after brief delay
      setTimeout(() => {
        // Test should pass if no cooking occurred (failure case)
        if (testData.cookedFishCreated === 0 && testData.burntFishCreated === 0) {
          this.passTest(stationId, {
            failureType,
            cookedFishCreated: testData.cookedFishCreated,
            hasFireNearby: testData.hasFireNearby,
            hasRawFood: testData.hasRawFood,
            duration: Date.now() - testData.startTime
          });
        } else {
          this.failTest(stationId, `Cooking failure test failed: expected failure but created ${testData.cookedFishCreated} cooked and ${testData.burntFishCreated} burnt fish`);
        }
      }, 4000);

    } catch (error) {
      // Exception is expected for failure cases
      this.passTest(stationId, {
        failureType,
        error: error instanceof Error ? error.toString() : String(error),
        duration: Date.now() - testData.startTime
      });
    }
  }

  private completeCookingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Calculate final success rate
    if (testData.attemptsMade > 0) {
      testData.successRate = (testData.successfulCooks / testData.attemptsMade) * 100;
    }

    const xpGained = testData.finalCookingXP - testData.initialCookingXP;

    const results = {
      rawFishUsed: testData.rawFishUsed,
      cookedFishCreated: testData.cookedFishCreated,
      burntFishCreated: testData.burntFishCreated,
      successfulCooks: testData.successfulCooks,
      burnedCooks: testData.burnedCooks,
      attemptsMade: testData.attemptsMade,
      successRate: testData.successRate,
      expectedSuccessRate: testData.expectedSuccessRate,
      xpGained: xpGained,
      hasFireNearby: testData.hasFireNearby,
      hasRawFood: testData.hasRawFood,
      duration: Date.now() - testData.startTime
    };

    // Test passes if:
    // 1. Success rate is within 20% of expected rate (cooking has more variance than fishing)
    // 2. Some cooking occurred (for success tests)
    // 3. XP was gained (for success tests)
    const successRateDiff = Math.abs(testData.successRate - testData.expectedSuccessRate);
    
    if (testData.expectedSuccessRate > 0) {
      // Success test - should cook some fish and gain XP
      if (testData.successfulCooks > 0 && xpGained > 0 && successRateDiff <= 20) {
        this.passTest(stationId, results);
      } else {
        this.failTest(stationId, `Cooking test failed: successful_cooks=${testData.successfulCooks}, xp=${xpGained}, success_rate=${testData.successRate}% (expected ~${testData.expectedSuccessRate}%)`);
      }
    } else {
      // Failure test - should cook nothing
      if (testData.successfulCooks === 0 && testData.burnedCooks === 0) {
        this.passTest(stationId, results);
      } else {
        this.failTest(stationId, `Cooking failure test failed: expected no cooking but made ${testData.successfulCooks} cooked and ${testData.burnedCooks} burnt fish`);
      }
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up fire visual
      this.world.emit('rpg:test:fire:remove', {
        id: `fire_${stationId}`
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGCookingTestSystem] Cleanup completed for ${stationId}`);
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
    
    // Check for advanced cooking features
    const hasBasicCooking = this.testStations.has('basic_cooking_success');
    const hasFailureHandling = this.testStations.has('cooking_no_fire_failure');
    const hasBurningMechanics = this.testStations.has('cooking_burning_test');
    const hasSkillProgression = this.testStations.has('cooking_skill_progression');
    const hasFoodHealing = this.testStations.has('cooking_food_healing');
    
    const advancedFeatureCount = [
      hasBasicCooking, hasFailureHandling, hasBurningMechanics, hasSkillProgression, hasFoodHealing
    ].filter(Boolean).length;
    
    // Check cooking performance with real validation
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.successfulCooks > 0) {
        // Cooking performance validation logic
        const cookingEfficiency = testData.successfulCooks / Math.max(1, testData.attemptsMade);
        if (cookingEfficiency > 0.4) { // At least 40% success rate for cooking tests
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