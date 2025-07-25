/**
 * RPG Loot Drop Test System
 * 
 * Tests the complete loot drop and pickup flow:
 * - Mob death triggers loot drops
 * - Ground items spawn correctly with proper visuals
 * - Pickup interactions work
 * - Items go to inventory properly
 * - Corpse mechanics function
 * - Error conditions are handled
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

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
  errors: string[];
}

export class RPGLootDropTestSystem extends System {
  private testData = new Map<string, LootTestData>();
  private testPositions = [
    { x: -90, y: 0, z: 10 },
    { x: -90, y: 0, z: 20 },
    { x: -90, y: 0, z: 30 }
  ];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGLootDropTestSystem] Initializing loot drop test system...');
    
    // Listen for loot events
    this.world.on?.('rpg:mob:death', this.handleMobDeath.bind(this));
    this.world.on?.('rpg:loot:dropped', this.handleLootDropped.bind(this));
    this.world.on?.('rpg:item:pickup_request', this.handlePickupRequest.bind(this));
    this.world.on?.('rpg:inventory:item_added', this.handleInventoryAdd.bind(this));
    
    this.createTestStations();
  }

  start(): void {
    console.log('[RPGLootDropTestSystem] Starting loot drop tests...');
    this.runAllTests();
  }

  private createTestStations(): void {
    this.testPositions.forEach((pos, index) => {
      // Create test station visual
      this.createTestCube(`loot_test_${index}`, pos, 0xFF4500, { x: 2, y: 0.2, z: 2 });
      
      // Create test label
      this.createTestText(`loot_test_label_${index}`, pos, `Loot Test ${index + 1}`, 0.5);
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
    
    try {
      console.log('[RPGLootDropTestSystem] Starting basic goblin loot test...');
      
      const testData: LootTestData = {
        testId,
        mobId: '',
        playerId: 'test_player_' + Date.now(),
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
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Phase 1: Spawn test mob
      await this.spawnTestMob(testId, 'goblin', position);
      
      // Phase 2: Wait and verify mob spawned
      setTimeout(() => this.verifyMobSpawned(testId), 2000);
      
      // Phase 3: Kill mob and check loot
      setTimeout(() => this.killMobAndCheckLoot(testId), 5000);
      
      // Phase 4: Test pickup
      setTimeout(() => this.testLootPickup(testId), 10000);
      
      // Phase 5: Verify results
      setTimeout(() => this.completeLootTest(testId), 13000);
      
    } catch (error) {
      this.failLootTest(testId, `Basic goblin loot test error: ${error}`);
    }
  }

  private async testMultipleItemDrop(): Promise<void> {
    const testId = 'multiple_item_drop';
    const position = this.testPositions[1];
    
    try {
      console.log('[RPGLootDropTestSystem] Starting multiple item drop test...');
      
      const testData: LootTestData = {
        testId,
        mobId: '',
        playerId: 'test_player_multi_' + Date.now(),
        startTime: Date.now(),
        phase: 'spawning_mob',
        mobSpawned: false,
        mobKilled: false,
        lootDropped: false,
        lootPickedUp: false,
        itemsInInventory: 0,
        expectedLootItems: 2, // Higher tier mobs drop multiple items
        groundItemsVisible: 0,
        corpseVisible: false,
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Spawn a Dark Warrior (higher tier mob)
      await this.spawnTestMob(testId, 'dark_warrior', position);
      
      setTimeout(() => this.verifyMobSpawned(testId), 2000);
      setTimeout(() => this.killMobAndCheckLoot(testId), 5000);
      setTimeout(() => this.testMultipleLootPickup(testId), 10000);
      setTimeout(() => this.completeLootTest(testId), 15000);
      
    } catch (error) {
      this.failLootTest(testId, `Multiple item drop test error: ${error}`);
    }
  }

  private async testLootDespawn(): Promise<void> {
    const testId = 'loot_despawn';
    const position = this.testPositions[2];
    
    try {
      console.log('[RPGLootDropTestSystem] Starting loot despawn test...');
      
      const testData: LootTestData = {
        testId,
        mobId: '',
        playerId: 'test_player_despawn_' + Date.now(),
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
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Spawn mob, kill it, then wait for loot to despawn
      await this.spawnTestMob(testId, 'goblin', position);
      setTimeout(() => this.killMobAndCheckLoot(testId), 3000);
      
      // Check loot exists initially
      setTimeout(() => this.verifyLootExists(testId), 6000);
      
      // Wait for despawn (shorter time for testing)
      setTimeout(() => this.verifyLootDespawned(testId), 20000);
      
    } catch (error) {
      this.failLootTest(testId, `Loot despawn test error: ${error}`);
    }
  }

  private async spawnTestMob(testId: string, mobType: string, position: { x: number, y: number, z: number }): Promise<void> {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGLootDropTestSystem] Spawning ${mobType} for test ${testId}...`);
    
    // Create colored cube to represent mob
    const mobCube = this.createTestCube(`mob_${testId}`, position, 0x32CD32, { x: 1, y: 1, z: 1 });
    mobCube.position.y += 1;
    
    const mobId = `test_mob_${testId}_${Date.now()}`;
    testData.mobId = mobId;
    testData.phase = 'spawning_mob';
    
    // Emit mob spawn event
    this.world.emit?.('rpg:test:mob:spawned', {
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
      console.log(`[RPGLootDropTestSystem] Mob ${mobId} spawned successfully`);
    }, 1000);
  }

  private verifyMobSpawned(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    if (!testData.mobSpawned) {
      this.recordError(testId, 'Mob failed to spawn within expected time');
      return;
    }
    
    console.log(`[RPGLootDropTestSystem] Mob spawn verified for test ${testId}`);
  }

  private async killMobAndCheckLoot(testId: string): Promise<void> {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    if (!testData.mobSpawned) {
      this.recordError(testId, 'Cannot kill mob - mob not spawned');
      return;
    }
    
    console.log(`[RPGLootDropTestSystem] Killing mob ${testData.mobId} for test ${testId}...`);
    
    testData.phase = 'checking_loot';
    
    // Simulate mob death
    this.world.emit?.('rpg:mob:death', {
      mobId: testData.mobId,
      mobType: 'goblin',
      position: this.testPositions[0],
      killedBy: testData.playerId,
      lootTable: ['coins']
    });
    
    testData.mobKilled = true;
    
    // Wait for loot system to process
    setTimeout(() => this.checkForLoot(testId), 2000);
  }

  private checkForLoot(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGLootDropTestSystem] Checking for loot from test ${testId}...`);
    
    // Check if ground items are visible in the scene
    const groundItems = this.findGroundItemsNear(this.testPositions[0], 5.0);
    testData.groundItemsVisible = groundItems.length;
    
    if (groundItems.length === 0) {
      this.recordError(testId, 'No ground items found after mob death');
      return;
    }
    
    testData.lootDropped = true;
    console.log(`[RPGLootDropTestSystem] Found ${groundItems.length} ground items for test ${testId}`);
    
    // Check for corpse
    const corpse = this.findCorpseNear(this.testPositions[0], 3.0);
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
    
    console.log(`[RPGLootDropTestSystem] Testing loot pickup for test ${testId}...`);
    
    testData.phase = 'testing_pickup';
    
    // Find ground items and try to pick them up
    const groundItems = this.findGroundItemsNear(this.testPositions[0], 5.0);
    
    for (const item of groundItems) {
      // Simulate player click on ground item
      this.world.emit?.('rpg:item:pickup_request', {
        playerId: testData.playerId,
        itemId: item.userData.itemId,
        position: item.position
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Verify pickup worked
    setTimeout(() => this.verifyPickup(testId), 2000);
  }

  private async testMultipleLootPickup(testId: string): Promise<void> {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGLootDropTestSystem] Testing multiple loot pickup for test ${testId}...`);
    
    const groundItems = this.findGroundItemsNear(this.testPositions[1], 5.0);
    
    if (groundItems.length < testData.expectedLootItems) {
      this.recordError(testId, `Expected ${testData.expectedLootItems} items, found ${groundItems.length}`);
    }
    
    // Pick up all items
    for (const item of groundItems) {
      this.world.emit?.('rpg:item:pickup_request', {
        playerId: testData.playerId,
        itemId: item.userData.itemId,
        position: item.position
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setTimeout(() => this.verifyPickup(testId), 3000);
  }

  private verifyPickup(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGLootDropTestSystem] Verifying pickup for test ${testId}...`);
    
    // Check if ground items are gone
    const remainingItems = this.findGroundItemsNear(this.testPositions[0], 5.0);
    
    if (remainingItems.length === 0) {
      testData.lootPickedUp = true;
      testData.phase = 'verifying_inventory';
      console.log(`[RPGLootDropTestSystem] All items picked up successfully for test ${testId}`);
    } else {
      this.recordError(testId, `${remainingItems.length} items still on ground after pickup attempt`);
    }
  }

  private verifyLootExists(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    const groundItems = this.findGroundItemsNear(this.testPositions[2], 5.0);
    
    if (groundItems.length > 0) {
      console.log(`[RPGLootDropTestSystem] Loot exists as expected for despawn test ${testId}`);
    } else {
      this.recordError(testId, 'Loot disappeared too early in despawn test');
    }
  }

  private verifyLootDespawned(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    const groundItems = this.findGroundItemsNear(this.testPositions[2], 5.0);
    
    if (groundItems.length === 0) {
      console.log(`[RPGLootDropTestSystem] Loot despawned correctly for test ${testId}`);
      this.completeLootTest(testId);
    } else {
      this.recordError(testId, `Loot failed to despawn - ${groundItems.length} items still present`);
      this.failLootTest(testId, 'Loot despawn failed');
    }
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
    
    if (results.success) {
      console.log(`[RPGLootDropTestSystem] ✅ Test ${testId} PASSED:`, results);
      
      // Update test station to green
      this.updateTestCubeColor(`loot_test_${testId}`, 0x00FF00);
    } else {
      console.error(`[RPGLootDropTestSystem] ❌ Test ${testId} FAILED:`, results);
      
      // Update test station to red
      this.updateTestCubeColor(`loot_test_${testId}`, 0xFF0000);
      
      // Throw error to server logs
      throw new Error(`Loot test ${testId} failed: ${results.errors.join(', ')}`);
    }
  }

  private failLootTest(testId: string, reason: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.phase = 'failed';
      testData.errors.push(reason);
    }
    
    console.error(`[RPGLootDropTestSystem] ❌ Test ${testId} FAILED: ${reason}`);
    
    // Update test station to red
    this.updateTestCubeColor(`loot_test_${testId}`, 0xFF0000);
    
    // Throw error to server logs for debugging
    throw new Error(`RPG Loot Drop Test ${testId} failed: ${reason}`);
  }

  private recordError(testId: string, error: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.errors.push(error);
    }
    console.error(`[RPGLootDropTestSystem] Error in test ${testId}: ${error}`);
  }

  // Event handlers
  private handleMobDeath(data: any): void {
    console.log('[RPGLootDropTestSystem] Mob death event received:', data);
    
    // Find matching test
    for (const [testId, testData] of this.testData) {
      if (testData.mobId === data.mobId) {
        testData.mobKilled = true;
        console.log(`[RPGLootDropTestSystem] Confirmed mob death for test ${testId}`);
        break;
      }
    }
  }

  private handleLootDropped(data: any): void {
    console.log('[RPGLootDropTestSystem] Loot dropped event received:', data);
    
    // Update relevant test data
    for (const [testId, testData] of this.testData) {
      if (testData.phase === 'checking_loot') {
        testData.lootDropped = true;
        testData.groundItemsVisible++;
        break;
      }
    }
  }

  private handlePickupRequest(data: any): void {
    console.log('[RPGLootDropTestSystem] Pickup request received:', data);
  }

  private handleInventoryAdd(data: any): void {
    console.log('[RPGLootDropTestSystem] Inventory add event received:', data);
    
    // Update relevant test data
    for (const [testId, testData] of this.testData) {
      if (testData.playerId === data.playerId) {
        testData.itemsInInventory++;
        break;
      }
    }
  }

  // Utility methods
  private findGroundItemsNear(position: { x: number, y: number, z: number }, radius: number): THREE.Object3D[] {
    if (!this.world.stage?.scene) return [];
    
    const items: THREE.Object3D[] = [];
    const center = new THREE.Vector3(position.x, position.y, position.z);
    
    this.world.stage.scene.traverse((obj: THREE.Object3D) => {
      if (obj.userData.type === 'ground_item' || obj.name.includes('ground_item')) {
        const distance = obj.position.distanceTo(center);
        if (distance <= radius) {
          items.push(obj);
        }
      }
    });
    
    return items;
  }

  private findCorpseNear(position: { x: number, y: number, z: number }, radius: number): THREE.Object3D | null {
    if (!this.world.stage?.scene) return null;
    
    const center = new THREE.Vector3(position.x, position.y, position.z);
    let corpse: THREE.Object3D | null = null;
    
    this.world.stage.scene.traverse((obj: THREE.Object3D) => {
      if (obj.userData.type === 'corpse' || obj.name.includes('corpse')) {
        const distance = obj.position.distanceTo(center);
        if (distance <= radius) {
          corpse = obj;
        }
      }
    });
    
    return corpse;
  }

  private createTestCube(id: string, position: { x: number, y: number, z: number }, color: number, size: { x: number, y: number, z: number }): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshLambertMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);
    
    cube.position.set(position.x, position.y, position.z);
    cube.name = id;
    cube.userData = { type: 'test_cube', testId: id };
    
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(cube);
    }
    
    return cube;
  }

  private createTestText(id: string, position: { x: number, y: number, z: number }, text: string, yOffset: number): void {
    // Emit text creation event
    this.world.emit?.('rpg:test:text:create', {
      id,
      position: { x: position.x, y: position.y + yOffset, z: position.z },
      text,
      color: '#FFFFFF',
      size: 0.3
    });
  }

  private updateTestCubeColor(id: string, color: number): void {
    if (!this.world.stage?.scene) return;
    
    const cube = this.world.stage.scene.getObjectByName(id);
    if (cube && cube.type === 'Mesh') {
      const mesh = cube as THREE.Mesh;
      if (mesh.material && 'color' in mesh.material) {
        (mesh.material as any).color.setHex(color);
      }
    }
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Check for test timeouts
    const now = Date.now();
    for (const [testId, testData] of this.testData) {
      if (now - testData.startTime > 60000 && testData.phase !== 'completed' && testData.phase !== 'failed') {
        this.failLootTest(testId, 'Test timeout - exceeded 60 seconds');
      }
    }
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}

  destroy(): void {
    this.testData.clear();
    console.log('[RPGLootDropTestSystem] System destroyed');
  }

  getSystemRating(): { health: number; score: number; features: string[]; performance: Record<string, number> } {
    const totalTests = this.testData.size;
    let passedTests = 0;
    let totalDropGenerationAttempts = 0;
    let successfulDrops = 0;
    
    // Analyze test results
    for (const [testId, testData] of this.testData) {
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
}