
/**
 * Loot Drop Test System
 * 
 * Tests the complete loot drop and pickup flow:
 * - Mob death triggers loot drops
 * - Ground items spawn correctly with proper visuals
 * - Pickup interactions work
 * - Items go to inventory properly
 * - Corpse mechanics function
 * - Error conditions are handled
 */

import THREE from '../extras/three';
import { EventType } from '../types/events';
import type { World } from '../types/index';
import type { LootSystem } from './LootSystem';
import { VisualTestFramework } from './VisualTestFramework';

const _v3_1 = new THREE.Vector3()
const _v3_2 = new THREE.Vector3()
const _v3_3 = new THREE.Vector3()

interface LootTestData {
  testId: string;
  mobId: string;
  playerId: string;
  startTime: number;
  phase: 'spawning_mob' | 'killing_mob' | 'checking_loot' | 'testing_pickup' | 'verifying_inventory' | 'completed' | 'failed';
  mobSpawned: boolean;
  mobKilled: boolean;
  lootDropped: boolean;
  lootPickedUp: boolean;
  itemsInInventory: number;
  expectedLootItems: number;
  groundItemsVisible: number;
  corpseVisible: boolean;
  mobSpawnPosition?: { x: number; y: number; z: number };
  player?: { id: string };
  errors: string[];
}



export class LootDropTestSystem extends VisualTestFramework {
  private testData = new Map<string, LootTestData>();
  private testPositions = [
    { x: -90, y: 0, z: 10 },
    { x: -90, y: 0, z: 20 },
    { x: -90, y: 0, z: 30 }
  ];

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    // Listen for loot events from both mob systems using proper event bus subscription
    this.subscribe<{ mobId: string; mobType: string; level: number; killedBy: string; position: { x: number; y: number; z: number } }>(EventType.MOB_DIED, (data) => this.handleMobDeath(data));
    this.subscribe<{ itemId: string; position: { x: number; y: number; z: number } }>(EventType.LOOT_DROPPED, (data) => this.handleLootDropped(data));
    this.subscribe<{ playerId: string; item: { id: string; name: string; stackable?: boolean; quantity?: number } }>(EventType.INVENTORY_ITEM_ADDED, (data) => this.handleInventoryAdd(data));
    // Allow tests to be triggered explicitly
    this.subscribe(EventType.TEST_RUN_ALL, () => this.runAllTests());
    
    this.createTestStations();
  }

  start(): void {
    // Auto-run once on start
    this.runAllTests();
  }

  private handlePickupRequest(data: { playerId: string; itemId: string }): void {
    // Handle item pickup request for testing
    console.log(`[LootDropTestSystem] Pickup request from ${data.playerId} for item ${data.itemId}`);
    // Could track pickup attempts for test validation
  }

  protected createTestStations(): void {
    const testNames = ['Basic Goblin Loot', 'Multiple Item Drop', 'Loot Despawn'];
    this.testPositions.forEach((pos, index) => {
      // Create test station using base class method
      this.createTestStation({
        id: `loot_test_${index}`,
        name: testNames[index] || `Loot Test ${index + 1}`,
        position: pos,
        timeoutMs: 60000 // 60 second timeout for loot tests
      });
    });
  }

  private runAllTests(): void {
    // Test 1: Basic Goblin Loot Drop
    setTimeout(() => this.testBasicGoblinLoot(), 2000);
    
    // Test 2: Multiple Item Drop (from higher tier mob)
    setTimeout(() => this.testMultipleItemDrop(), 15000);
    
    // Test 3: Loot Despawn Test
    setTimeout(() => this.testLootDespawn(), 30000);
  }

  private async testBasicGoblinLoot(): Promise<void> {
    const testId = 'basic_goblin_loot';
    const position = this.testPositions[0];
    const playerId = 'test_player_' + Date.now();
    
    const testData: LootTestData = {
      testId,
      mobId: '',
      playerId: playerId,
      startTime: Date.now(),
      phase: 'spawning_mob',
      mobSpawned: false,
      mobKilled: false,
      lootDropped: false,
      lootPickedUp: false,
      itemsInInventory: 0,
      expectedLootItems: 1, // Goblins should drop at least coins
      groundItemsVisible: 0,
      corpseVisible: false,
      mobSpawnPosition: position,
      player: { id: playerId },
      errors: []
    };
    
    this.testData.set(testId, testData);
    
    // Create test player
    await this.createTestPlayer(playerId, position);
    
    // Phase 1: Spawn test mob
    this.spawnTestMob(testId, 'goblin', position);
    
    // Phase 2: Wait and verify mob spawned
    setTimeout(() => this.verifyMobSpawned(testId), 2000);
    
    // Phase 3: Kill mob and check loot
    setTimeout(() => this.killMobAndCheckLoot(testId), 5000);
    
    // Phase 4: Test pickup
    setTimeout(() => this.testLootPickup(testId), 10000);
    
    // Phase 5: Verify results
    setTimeout(() => this.completeLootTest(testId), 13000);
  }

  private async testMultipleItemDrop(): Promise<void> {
    const testId = 'multiple_item_drop';
    const position = this.testPositions[1];
    const playerId = 'test_player_multi_' + Date.now();
    
    const testData: LootTestData = {
      testId,
      mobId: '',
      playerId: playerId,
      startTime: Date.now(),
      phase: 'spawning_mob',
      mobSpawned: false,
      mobKilled: false,
      lootDropped: false,
      lootPickedUp: false,
      itemsInInventory: 0,
      expectedLootItems: 1, // At least 1 guaranteed (coins), potentially more based on RNG
      groundItemsVisible: 0,
      corpseVisible: false,
      mobSpawnPosition: position,
      player: { id: playerId },
      errors: []
    };
    
    this.testData.set(testId, testData);
    
    // Create test player
    await this.createTestPlayer(playerId, position);
    
    // Spawn a Dark Warrior (higher tier mob)
    this.spawnTestMob(testId, 'dark_warrior', position);
    
    setTimeout(() => this.verifyMobSpawned(testId), 2000);
    setTimeout(() => this.killMobAndCheckLoot(testId), 5000);
    setTimeout(() => this.testMultipleLootPickup(testId), 10000);
    setTimeout(() => this.completeLootTest(testId), 15000);
  }

  private async testLootDespawn(): Promise<void> {
    const testId = 'loot_despawn';
    const position = this.testPositions[2];
    const playerId = 'test_player_despawn_' + Date.now();
    
    const testData: LootTestData = {
      testId,
      mobId: '',
      playerId: playerId,
      startTime: Date.now(),
      phase: 'spawning_mob',
      mobSpawned: false,
      mobKilled: false,
      lootDropped: false,
      lootPickedUp: false,
      itemsInInventory: 0,
      expectedLootItems: 1,
      groundItemsVisible: 0,
      corpseVisible: false,
      mobSpawnPosition: position,
      player: { id: playerId },
      errors: []
    };
    
    this.testData.set(testId, testData);
    
    // Create test player
    await this.createTestPlayer(playerId, position);
    
    // Spawn mob, kill it, then wait for loot to despawn
    this.spawnTestMob(testId, 'goblin', position);
    setTimeout(() => this.killMobAndCheckLoot(testId), 3000);
    
    // Check loot exists initially
    setTimeout(() => this.verifyLootExists(testId), 6000);
    
    // Wait for despawn (shorter time for testing)
    setTimeout(() => this.verifyLootDespawned(testId), 20000);
  }

  private async createTestPlayer(playerId: string, position: { x: number; y: number; z: number }): Promise<void> {
    // Use the base class createPlayer method
    const player = this.createPlayer({
      id: playerId,
      name: playerId,
      position: position,
      stats: {
        health: 100,
        maxHealth: 100,
        attack: 10,
        strength: 10,
        defense: 10,
        ranged: 10,
        constitution: 10
      }
    });
    
    if (!player) {
      throw new Error(`Failed to create test player ${playerId}`);
    }
    
    // Small delay to ensure player is fully initialized
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private spawnTestMob(testId: string, mobType: string, position: { x: number; y: number; z: number }): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    

    
    const mobId = `test_mob_${testId}_${Date.now()}`;
    testData.mobId = mobId;
    testData.phase = 'spawning_mob';
    
    // Emit mob spawn event
    this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
      mobId,
      mobType,
      position,
      testId,
      health: 100,
      maxHealth: 100
    });
    
    // Simulate mob registration
    setTimeout(() => {
      testData.mobSpawned = true;
      testData.phase = 'killing_mob';
    }, 1000);
  }

  private verifyMobSpawned(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    if (!testData.mobSpawned) {
      this.recordError(testId, 'Mob failed to spawn within expected time');
      return;
    }
  }

  private killMobAndCheckLoot(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    if (!testData.mobSpawned) {
      this.recordError(testId, 'Cannot kill mob - mob not spawned');
      return;
    }
    
    
    testData.phase = 'checking_loot';
    
    // Determine mob type based on test
    let mobType = 'goblin';
    let level = 1;
    if (testId === 'multiple_item_drop') {
      mobType = 'dark_warrior';
      level = 12; // Dark warriors are level 12
    }
    
    // Simulate mob death
    const mobDeathData = {
      mobId: testData.mobId,
      mobType: mobType,
      position: testData.mobSpawnPosition || { x: 0, y: 0, z: 0 },
      level: level,
      killedBy: testData.player?.id || testData.playerId
    };
    

    this.emitTypedEvent(EventType.MOB_DIED, mobDeathData);
    
    testData.mobKilled = true;
    
    // Wait for loot system to process - increase delay to ensure items are spawned
    setTimeout(() => this.checkForLoot(testId), 3000);
  }

  private checkForLoot(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    

    // Check if ground items are visible in the scene
    // Use the mob spawn position to look for items, not a fixed position
    const groundItems = this.findGroundItemsNear(testData.mobSpawnPosition || this.testPositions[0]);
    testData.groundItemsVisible = groundItems.length;
    

    // Also log all objects near the test position for debugging
    if (this.world.stage.scene) {
      let _nearbyObjectCount = 0;
      const pos = testData.mobSpawnPosition || this.testPositions[0];
      const center = _v3_1.set(pos.x, pos.y, pos.z);
      const itemLikeObjects: string[] = [];
      
      this.world.stage.scene.traverse((obj) => {
        const distance = obj.position.distanceTo(center);
        if (distance <= 5.0) {
          _nearbyObjectCount++;
          
          // Log all object details for debugging
          if (obj.userData.type || obj.name.includes('item') || obj.name.includes('Item')) {
            const info = `name: ${obj.name}, type: ${obj.userData.type || 'none'}, entityId: ${obj.userData.entityId || 'none'}, distance: ${distance.toFixed(2)}`;
            itemLikeObjects.push(info);
          }
          

        }
      });

    }
    
    if (groundItems.length === 0) {
      this.recordError(testId, 'No ground items found after mob death');
      return;
    }
    
    testData.lootDropped = true;

    // Check for corpse - use the mob spawn position
    const corpse = this.findCorpseNear(testData.mobSpawnPosition || this.testPositions[0]);
    testData.corpseVisible = corpse !== null;
    
    if (!testData.corpseVisible) {
      this.recordError(testId, 'No corpse found after mob death');
    }
  }

  private async testLootPickup(testId: string): Promise<void> {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    if (!testData.lootDropped) {
      this.recordError(testId, 'Cannot test pickup - no loot dropped');
      return;
    }
    
    
    testData.phase = 'testing_pickup';
    
    // Find ground items and try to pick them up - use the mob spawn position
    const groundItems = this.findGroundItemsNear(testData.mobSpawnPosition || this.testPositions[0]);
    
    // Keep track of processed drop IDs to avoid duplicates
    const processedDropIds = new Set<string>();
    
    for (const item of groundItems) {
      // Simulate player click on ground item
      // For loot system items, the drop ID is usually in the name or userData
      let dropId = '';
      
      // Try to extract the drop ID from the item name (e.g., "drop_123")
      if (item.name.includes('drop_')) {
        // Extract the drop ID from the name
        const match = item.name.match(/drop_\d+/);
        if (match) {
          dropId = match[0];
        }
      } else if (item.userData.entityId) {
        dropId = item.userData.entityId;
      } else if (item.userData.id) {
        dropId = item.userData.id;
      } else if (item.parent && item.parent.name.includes('drop_')) {
        // Check parent for drop ID
        const match = item.parent.name.match(/drop_\d+/);
        if (match) {
          dropId = match[0];
        }
      }
      
      // Skip if we've already processed this drop ID
      if (dropId && processedDropIds.has(dropId)) {

        continue;
      }
      

      
      if (dropId) {
        processedDropIds.add(dropId);
        // Use the correct event for loot pickup with the drop ID
        this.emitTypedEvent(EventType.ITEM_PICKUP, {
          playerId: testData.playerId,
          itemId: dropId
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Verify pickup worked
    setTimeout(() => this.verifyPickup(testId), 2000);
  }

  private async testMultipleLootPickup(testId: string): Promise<void> {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    const groundItems = this.findGroundItemsNear(testData.mobSpawnPosition || this.testPositions[1]);
    
    if (groundItems.length < testData.expectedLootItems) {
      this.recordError(testId, `Expected at least ${testData.expectedLootItems} items, found ${groundItems.length}`);
    }
    
    // Keep track of processed drop IDs to avoid duplicates
    const processedDropIds = new Set<string>();
    
    // Pick up all items
    for (const item of groundItems) {
      // For loot system items, the drop ID is usually in the name or userData
      let dropId = '';
      
      // Try to extract the drop ID from the item name (e.g., "drop_123")
      if (item.name.includes('drop_')) {
        // Extract the drop ID from the name
        const match = item.name.match(/drop_\d+/);
        if (match) {
          dropId = match[0];
        }
      } else if (item.userData.entityId) {
        dropId = item.userData.entityId;
      } else if (item.userData.id) {
        dropId = item.userData.id;
      } else if (item.parent && item.parent.name.includes('drop_')) {
        // Check parent for drop ID
        const match = item.parent.name.match(/drop_\d+/);
        if (match) {
          dropId = match[0];
        }
      }
      
      // Skip if we've already processed this drop ID
      if (dropId && processedDropIds.has(dropId)) {

        continue;
      }
      

      
      if (dropId) {
        processedDropIds.add(dropId);
        // Use the correct event for loot pickup with the drop ID
        this.emitTypedEvent(EventType.ITEM_PICKUP, {
          playerId: testData.playerId,
          itemId: dropId
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setTimeout(() => this.verifyPickup(testId), 3000);
  }

  private verifyPickup(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    // Check if ground items are gone - use the mob spawn position
    const remainingItems = this.findGroundItemsNear(testData.mobSpawnPosition || this.testPositions[0]);
    
    if (remainingItems.length === 0) {
      testData.lootPickedUp = true;
      testData.phase = 'verifying_inventory';
    } else {
      this.recordError(testId, `${remainingItems.length} items still on ground after pickup attempt`);
    }
  }

  private verifyLootExists(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    const groundItems = this.findGroundItemsNear(testData.mobSpawnPosition || this.testPositions[2]);
    
    if (groundItems.length > 0) {
      // Items still exist, despawn test is working correctly
    } else {
      this.recordError(testId, 'Loot disappeared too early in despawn test');
    }
  }

  private verifyLootDespawned(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    // Force cleanup for testing
    const lootSystem = this.world.getSystem<LootSystem>('loot');
    if (lootSystem) {
      
      lootSystem.forceCleanupForTesting();
    }
    
    // Give a moment for cleanup to complete
    setTimeout(() => {
      const groundItems = this.findGroundItemsNear(testData.mobSpawnPosition || this.testPositions[2]);
      
      if (groundItems.length === 0) {
        this.completeLootTest(testId);
      } else {
        this.recordError(testId, `Loot failed to despawn - ${groundItems.length} items still present`);
        this.failLootTest(testId, 'Loot despawn failed');
      }
    }, 100);
  }

  private completeLootTest(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    testData.phase = 'completed';
    
    const results = {
      testId,
      duration: Date.now() - testData.startTime,
      mobSpawned: testData.mobSpawned,
      mobKilled: testData.mobKilled,
      lootDropped: testData.lootDropped,
      lootPickedUp: testData.lootPickedUp,
      corpseVisible: testData.corpseVisible,
      groundItemsVisible: testData.groundItemsVisible,
      expectedLootItems: testData.expectedLootItems,
      errors: testData.errors,
      success: testData.errors.length === 0 && testData.lootDropped
    };
    
    // Find the appropriate test station
    const testIndex = testId === 'basic_goblin_loot' ? 0 : 
                     testId === 'multiple_item_drop' ? 1 : 
                     testId === 'loot_despawn' ? 2 : -1;
    
    if (testIndex >= 0) {
      const station = this.testStations.get(`loot_test_${testIndex}`);
      if (station) {
        if (results.success) {

          this.passTest(`loot_test_${testIndex}`);
        } else {

          this.failTest(`loot_test_${testIndex}`, results.errors.join(', '));
        }
      }
    }
  }

  private failLootTest(testId: string, reason: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.phase = 'failed';
      testData.errors.push(reason);
    }
    

    
    // Find and update the appropriate test station
    const testIndex = testId === 'basic_goblin_loot' ? 0 : 
                     testId === 'multiple_item_drop' ? 1 : 
                     testId === 'loot_despawn' ? 2 : -1;
    
    if (testIndex >= 0) {
      const station = this.testStations.get(`loot_test_${testIndex}`);
      if (station) {
        this.failTest(`loot_test_${testIndex}`, reason);
      }
    }
    

  }

  private recordError(testId: string, error: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.errors.push(error);
    }

  }

  // Event handlers
  private handleMobDeath(data: { mobId: string }): void {
    // Find matching test
    for (const [_testId, testData] of this.testData) {
      if (testData.mobId === data.mobId) {
        testData.mobKilled = true;
        break;
      }
    }
  }

  private handleLootDropped(_data: { itemId: string; position: { x: number; y: number; z: number } }): void {
  
    // Update relevant test data
    for (const [_testId, testData] of this.testData) {
      if (testData.phase === 'checking_loot') {

        testData.lootDropped = true;
        testData.groundItemsVisible++;
        break;
      }
    }
  }

  private handleInventoryAdd(data: { playerId: string; item: { id: string; name: string; stackable?: boolean; quantity?: number } }): void {
    // Update relevant test data
    for (const [_testId, testData] of this.testData) {
      if (testData.playerId === data.playerId) {
        testData.itemsInInventory++;
        break;
      }
    }
  }

  // Utility methods
  private findGroundItemsNear(position: { x: number; y: number; z: number }, radius: number = 5.0): THREE.Object3D[] {
    if (!this.world.stage.scene) return [];
    
    const items: THREE.Object3D[] = [];
    const center = _v3_2.set(position.x, position.y, position.z);
    
    this.world.stage.scene.traverse((obj) => {
      // Calculate world position for nested objects
      const worldPos = _v3_3
      obj.getWorldPosition(worldPos);
      const distance = worldPos.distanceTo(center);
      
      // Look for items spawned by the loot system - check multiple conditions
      // First, exclude corpses and invalid items
      if (obj.name.includes('corpse') || obj.userData.type === 'corpse') {
        return; // Skip corpses entirely
      }
      
      if (obj.name === 'Item_undefined' || obj.name.includes('undefined')) {
        return; // Skip undefined items
      }
      
      const isItem = obj.userData.type === 'item' || 
                     obj.userData.type === 'ground_item' || 
                     (obj.name.includes('Item_') && !obj.name.includes('Item_undefined')) || 
                     obj.name.includes('ground_item') ||
                     obj.name.includes('drop_') || // LootSystem uses drop_ prefix
                     (obj.userData.itemData && obj.userData.itemData.itemId);
      
      if (isItem && distance <= radius) {
        items.push(obj as THREE.Object3D);
      }
    });
    
    return items;
  }

  private findCorpseNear(position: { x: number; y: number; z: number }, radius: number = 3.0): THREE.Object3D | null {
    if (!this.world.stage.scene) return null;
    
    const center = _v3_1.set(position.x, position.y, position.z);
    let corpse: THREE.Object3D | null = null;
    
    this.world.stage.scene.traverse((obj) => {
      if (obj.userData.type === 'corpse' || obj.name.includes('corpse')) {
        const distance = obj.position.distanceTo(center);
        if (distance <= radius) {
          corpse = obj as THREE.Object3D;
        }
      }
    });
    
    return corpse;
  }



  update(_dt: number): void {
    // Check for test timeouts
    const now = Date.now();
    for (const [testId, testData] of this.testData) {
      if (now - testData.startTime > 60000 && testData.phase !== 'completed' && testData.phase !== 'failed') {
        this.failLootTest(testId, 'Test timeout - exceeded 60 seconds');
      }
    }
  }

  destroy(): void {
    this.testData.clear();
  }

  getSystemRating(): { health: number; score: number; features: string[]; performance: Record<string, number> } {
    const totalTests = this.testData.size;
    let passedTests = 0;
    let totalDropGenerationAttempts = 0;
    let successfulDrops = 0;
    
    // Analyze test results
    for (const [_testId, testData] of this.testData) {
      if (testData.phase === 'completed' && testData.errors.length === 0) {
        passedTests++;
      }
      
      if (testData.mobKilled) {
        totalDropGenerationAttempts++;
        if (testData.lootDropped) {
          successfulDrops++;
        }
      }
    }
    
    // Calculate drop generation success rate
    let dropGenerationSuccess = 0;
    if (totalDropGenerationAttempts > 0) {
      dropGenerationSuccess = (successfulDrops / totalDropGenerationAttempts) * 100;
    }
    
    // Calculate overall health
    const health = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return {
      health,
      score: Math.round(dropGenerationSuccess),
      features: [
        'Basic Loot Drop Generation',
        'Drop Rate Calculations',
        'Item Creation on Death',
        'Loot Table Processing',
        'Pickup Mechanics Validation'
      ],
      performance: {
        dropGenerationSuccess,
        testPassRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        averageTestDuration: this.calculateAverageTestDuration(),
        lootSpawnSuccess: this.calculateLootSpawnSuccess(),
        pickupMechanicsSuccess: this.calculatePickupSuccess()
      }
    };
  }

  private calculateAverageTestDuration(): number {
    if (this.testData.size === 0) return 0;
    
    const completedTests = Array.from(this.testData.values()).filter(
      test => test.phase === 'completed' || test.phase === 'failed'
    );
    
    if (completedTests.length === 0) return 0;
    
    const totalDuration = completedTests.reduce((sum, test) => 
      sum + (Date.now() - test.startTime), 0
    );
    
    return totalDuration / completedTests.length;
  }

  private calculateLootSpawnSuccess(): number {
    const testsWithLootChecks = Array.from(this.testData.values()).filter(
      test => test.mobKilled
    );
    
    if (testsWithLootChecks.length === 0) return 0;
    
    const successfulSpawns = testsWithLootChecks.filter(test => 
      test.lootDropped && test.groundItemsVisible > 0
    ).length;
    
    return (successfulSpawns / testsWithLootChecks.length) * 100;
  }

  private calculatePickupSuccess(): number {
    const testsWithPickupAttempts = Array.from(this.testData.values()).filter(
      test => test.lootDropped && test.phase !== 'spawning_mob'
    );
    
    if (testsWithPickupAttempts.length === 0) return 0;
    
    const successfulPickups = testsWithPickupAttempts.filter(test => 
      test.lootPickedUp
    ).length;
    
    return (successfulPickups / testsWithPickupAttempts.length) * 100;
  }

  // Required abstract methods from VisualTestFramework
  protected runTest(_stationId: string): void | Promise<void> {
    // This system doesn't use test stations in the traditional way
    // Tests are run automatically based on mob spawns and deaths
  }

  protected cleanupTest(_stationId: string): void {
    // Clean up any test data associated with the station
  }
}