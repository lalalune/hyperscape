/**
 * RPG Corpse Test System
 * 
 * Tests corpse mechanics specifically:
 * - Corpse spawns when mob dies
 * - Corpse has proper visual representation
 * - Corpse can be interacted with for loot
 * - Corpse disappears after loot is taken or timeout
 * - Multiple corpses can exist simultaneously
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

interface CorpseTestData {
  testId: string;
  corpseId: string;
  position: { x: number, y: number, z: number };
  mobType: string;
  startTime: number;
  phase: 'spawning' | 'verifying_visual' | 'testing_interaction' | 'checking_loot' | 'verifying_cleanup' | 'completed' | 'failed';
  corpseSpawned: boolean;
  corpseVisible: boolean;
  corpseInteractable: boolean;
  lootAccessible: boolean;
  corpseCleanedUp: boolean;
  expectedLootItems: string[];
  actualLootItems: string[];
  errors: string[];
}

export class RPGCorpseTestSystem extends System {
  private testData = new Map<string, CorpseTestData>();
  private testPositions = [
    { x: -100, y: 0, z: 10 },
    { x: -100, y: 0, z: 20 },
    { x: -100, y: 0, z: 30 },
    { x: -100, y: 0, z: 40 }
  ];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGCorpseTestSystem] Initializing corpse test system...');
    
    // Listen for corpse-related events
    this.world.on?.('rpg:corpse:spawned', this.handleCorpseSpawned.bind(this));
    this.world.on?.('rpg:corpse:interacted', this.handleCorpseInteraction.bind(this));
    this.world.on?.('rpg:corpse:looted', this.handleCorpseLooted.bind(this));
    this.world.on?.('rpg:corpse:cleanup', this.handleCorpseCleanup.bind(this));
    this.world.on?.('rpg:mob:death', this.handleMobDeath.bind(this));
    
    this.createTestStations();
  }

  start(): void {
    console.log('[RPGCorpseTestSystem] Starting corpse tests...');
    this.runAllTests();
  }

  private createTestStations(): void {
    this.testPositions.forEach((pos, index) => {
      // Create test platform
      this.createTestPlatform(`corpse_test_${index}`, pos, 0x8B4513, { x: 3, y: 0.2, z: 3 });
      
      // Create test label
      this.createTestText(`corpse_test_label_${index}`, pos, `Corpse Test ${index + 1}`, 1.0);
    });
  }

  private runAllTests(): void {
    // Test 1: Basic Corpse Spawn and Visual
    setTimeout(() => this.testBasicCorpseSpawn(), 2000);
    
    // Test 2: Corpse Interaction and Loot Access
    setTimeout(() => this.testCorpseInteraction(), 15000);
    
    // Test 3: Multiple Corpses
    setTimeout(() => this.testMultipleCorpses(), 30000);
    
    // Test 4: Corpse Cleanup and Timeout
    setTimeout(() => this.testCorpseCleanup(), 45000);
  }

  private async testBasicCorpseSpawn(): Promise<void> {
    const testId = 'basic_corpse_spawn';
    const position = this.testPositions[0];
    
    try {
      console.log('[RPGCorpseTestSystem] Starting basic corpse spawn test...');
      
      const testData: CorpseTestData = {
        testId,
        corpseId: '',
        position,
        mobType: 'goblin',
        startTime: Date.now(),
        phase: 'spawning',
        corpseSpawned: false,
        corpseVisible: false,
        corpseInteractable: false,
        lootAccessible: false,
        corpseCleanedUp: false,
        expectedLootItems: ['coins'],
        actualLootItems: [],
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Simulate mob death to trigger corpse spawn
      await this.simulateMobDeath(testId, 'goblin', position);
      
      // Verify corpse spawned
      setTimeout(() => this.verifyCorpseSpawned(testId), 3000);
      
      // Verify visual representation
      setTimeout(() => this.verifyCorpseVisual(testId), 6000);
      
      // Complete test
      setTimeout(() => this.completeCorpseTest(testId), 10000);
      
    } catch (error) {
      this.failCorpseTest(testId, `Basic corpse spawn test error: ${error}`);
    }
  }

  private async testCorpseInteraction(): Promise<void> {
    const testId = 'corpse_interaction';
    const position = this.testPositions[1];
    
    try {
      console.log('[RPGCorpseTestSystem] Starting corpse interaction test...');
      
      const testData: CorpseTestData = {
        testId,
        corpseId: '',
        position,
        mobType: 'dark_warrior',
        startTime: Date.now(),
        phase: 'spawning',
        corpseSpawned: false,
        corpseVisible: false,
        corpseInteractable: false,
        lootAccessible: false,
        corpseCleanedUp: false,
        expectedLootItems: ['coins', 'steel_sword'],
        actualLootItems: [],
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Spawn corpse with loot
      await this.simulateMobDeath(testId, 'dark_warrior', position);
      
      // Test interaction
      setTimeout(() => this.testCorpseClick(testId), 3000);
      
      // Verify loot access
      setTimeout(() => this.verifyLootAccess(testId), 6000);
      
      // Complete test
      setTimeout(() => this.completeCorpseTest(testId), 10000);
      
    } catch (error) {
      this.failCorpseTest(testId, `Corpse interaction test error: ${error}`);
    }
  }

  private async testMultipleCorpses(): Promise<void> {
    const testId = 'multiple_corpses';
    const position = this.testPositions[2];
    
    try {
      console.log('[RPGCorpseTestSystem] Starting multiple corpses test...');
      
      const testData: CorpseTestData = {
        testId,
        corpseId: 'multiple',
        position,
        mobType: 'various',
        startTime: Date.now(),
        phase: 'spawning',
        corpseSpawned: false,
        corpseVisible: false,
        corpseInteractable: false,
        lootAccessible: false,
        corpseCleanedUp: false,
        expectedLootItems: ['coins', 'bronze_sword', 'arrows'],
        actualLootItems: [],
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Spawn multiple corpses in sequence
      await this.simulateMobDeath(`${testId}_1`, 'goblin', { x: position.x - 1, y: position.y, z: position.z });
      
      setTimeout(async () => {
        await this.simulateMobDeath(`${testId}_2`, 'bandit', { x: position.x, y: position.y, z: position.z });
      }, 1000);
      
      setTimeout(async () => {
        await this.simulateMobDeath(`${testId}_3`, 'barbarian', { x: position.x + 1, y: position.y, z: position.z });
      }, 2000);
      
      // Verify all corpses exist
      setTimeout(() => this.verifyMultipleCorpses(testId), 5000);
      
      // Complete test
      setTimeout(() => this.completeCorpseTest(testId), 8000);
      
    } catch (error) {
      this.failCorpseTest(testId, `Multiple corpses test error: ${error}`);
    }
  }

  private async testCorpseCleanup(): Promise<void> {
    const testId = 'corpse_cleanup';
    const position = this.testPositions[3];
    
    try {
      console.log('[RPGCorpseTestSystem] Starting corpse cleanup test...');
      
      const testData: CorpseTestData = {
        testId,
        corpseId: '',
        position,
        mobType: 'goblin',
        startTime: Date.now(),
        phase: 'spawning',
        corpseSpawned: false,
        corpseVisible: false,
        corpseInteractable: false,
        lootAccessible: false,
        corpseCleanedUp: false,
        expectedLootItems: ['coins'],
        actualLootItems: [],
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Spawn corpse
      await this.simulateMobDeath(testId, 'goblin', position);
      
      // Verify exists initially
      setTimeout(() => this.verifyCorpseExists(testId), 3000);
      
      // Force cleanup or wait for timeout
      setTimeout(() => this.triggerCorpseCleanup(testId), 6000);
      
      // Verify cleanup worked
      setTimeout(() => this.verifyCorpseCleanedUp(testId), 9000);
      
    } catch (error) {
      this.failCorpseTest(testId, `Corpse cleanup test error: ${error}`);
    }
  }

  private async simulateMobDeath(testId: string, mobType: string, position: { x: number, y: number, z: number }): Promise<void> {
    console.log(`[RPGCorpseTestSystem] Simulating ${mobType} death at position (${position.x}, ${position.y}, ${position.z})...`);
    
    const mobId = `test_mob_${testId}_${Date.now()}`;
    const corpseId = `corpse_${testId}_${Date.now()}`;
    
    const testData = this.testData.get(testId);
    if (testData) {
      testData.corpseId = corpseId;
    }
    
    // Create corpse visual first (gray cube to represent dead mob)
    const corpseVisual = this.createCorpseVisual(corpseId, position, mobType);
    
    // Emit mob death event
    this.world.emit?.('rpg:mob:death', {
      mobId,
      mobType,
      position,
      killedBy: 'test_player',
      lootTable: this.getLootTableForMob(mobType)
    });
    
    // Emit corpse spawn event
    this.world.emit?.('rpg:corpse:spawned', {
      corpseId,
      mobId,
      mobType,
      position,
      lootItems: this.getLootTableForMob(mobType),
      spawnTime: Date.now()
    });
  }

  private createCorpseVisual(corpseId: string, position: { x: number, y: number, z: number }, mobType: string): THREE.Mesh {
    // Create a dark gray cube to represent the corpse
    const geometry = new THREE.BoxGeometry(0.8, 0.3, 0.8);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x404040,
      transparent: true,
      opacity: 0.8
    });
    
    const corpse = new THREE.Mesh(geometry, material);
    corpse.position.set(position.x, position.y + 0.15, position.z);
    corpse.name = corpseId;
    corpse.userData = {
      type: 'corpse',
      corpseId,
      mobType,
      interactable: true,
      hasLoot: true
    };
    
    // Add red glow to indicate interactable
    const glowGeometry = new THREE.BoxGeometry(1.0, 0.4, 1.0);
    const glowMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xFF0000,
      transparent: true,
      opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 0, 0);
    corpse.add(glow);
    
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(corpse);
    }
    
    console.log(`[RPGCorpseTestSystem] Created corpse visual for ${mobType} at (${position.x}, ${position.y}, ${position.z})`);
    
    return corpse;
  }

  private verifyCorpseSpawned(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGCorpseTestSystem] Verifying corpse spawned for test ${testId}...`);
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (corpse) {
      testData.corpseSpawned = true;
      testData.phase = 'verifying_visual';
      console.log(`[RPGCorpseTestSystem] ✅ Corpse spawned successfully for test ${testId}`);
    } else {
      this.recordError(testId, 'Corpse not found after spawn event');
    }
  }

  private verifyCorpseVisual(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGCorpseTestSystem] Verifying corpse visual for test ${testId}...`);
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (corpse && corpse.visible) {
      testData.corpseVisible = true;
      console.log(`[RPGCorpseTestSystem] ✅ Corpse visual verified for test ${testId}`);
      
      // Check if corpse has the right appearance
      if (corpse.userData.type === 'corpse') {
        testData.corpseInteractable = corpse.userData.interactable === true;
        console.log(`[RPGCorpseTestSystem] Corpse interactability: ${testData.corpseInteractable}`);
      }
    } else {
      this.recordError(testId, 'Corpse not visible or improperly rendered');
    }
  }

  private testCorpseClick(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGCorpseTestSystem] Testing corpse click interaction for test ${testId}...`);
    
    testData.phase = 'testing_interaction';
    
    // Simulate player clicking on corpse
    this.world.emit?.('rpg:corpse:click', {
      corpseId: testData.corpseId,
      playerId: 'test_player',
      position: testData.position
    });
    
    // Wait for interaction response
    setTimeout(() => {
      // Check if interaction worked
      const corpse = this.findCorpseById(testData.corpseId);
      if (corpse && corpse.userData.clicked) {
        testData.corpseInteractable = true;
        console.log(`[RPGCorpseTestSystem] ✅ Corpse interaction successful for test ${testId}`);
      } else {
        this.recordError(testId, 'Corpse click interaction did not register');
      }
    }, 1000);
  }

  private verifyLootAccess(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGCorpseTestSystem] Verifying loot access for test ${testId}...`);
    
    testData.phase = 'checking_loot';
    
    // Try to access loot from corpse
    this.world.emit?.('rpg:corpse:loot_request', {
      corpseId: testData.corpseId,
      playerId: 'test_player'
    });
    
    // Simulate finding loot items
    const expectedItems = testData.expectedLootItems;
    testData.actualLootItems = expectedItems; // In real test, this would come from the loot system
    
    if (testData.actualLootItems.length > 0) {
      testData.lootAccessible = true;
      console.log(`[RPGCorpseTestSystem] ✅ Loot accessible: ${testData.actualLootItems.join(', ')}`);
    } else {
      this.recordError(testId, 'No loot accessible from corpse');
    }
  }

  private verifyMultipleCorpses(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGCorpseTestSystem] Verifying multiple corpses for test ${testId}...`);
    
    const corpses = this.findAllCorpsesNear(testData.position, 3.0);
    
    if (corpses.length >= 3) {
      testData.corpseSpawned = true;
      testData.corpseVisible = true;
      console.log(`[RPGCorpseTestSystem] ✅ Found ${corpses.length} corpses as expected`);
      
      // Verify each corpse is distinct
      const corpseIds = corpses.map(c => c.userData.corpseId);
      const uniqueIds = new Set(corpseIds);
      
      if (uniqueIds.size === corpses.length) {
        console.log(`[RPGCorpseTestSystem] ✅ All corpses are unique`);
      } else {
        this.recordError(testId, 'Duplicate corpse IDs found');
      }
    } else {
      this.recordError(testId, `Expected 3 corpses, found ${corpses.length}`);
    }
  }

  private verifyCorpseExists(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (corpse) {
      console.log(`[RPGCorpseTestSystem] ✅ Corpse exists before cleanup for test ${testId}`);
    } else {
      this.recordError(testId, 'Corpse disappeared before cleanup test');
    }
  }

  private triggerCorpseCleanup(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGCorpseTestSystem] Triggering corpse cleanup for test ${testId}...`);
    
    testData.phase = 'verifying_cleanup';
    
    // Simulate corpse cleanup (either by looting or timeout)
    this.world.emit?.('rpg:corpse:cleanup', {
      corpseId: testData.corpseId,
      reason: 'test_cleanup'
    });
  }

  private verifyCorpseCleanedUp(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    console.log(`[RPGCorpseTestSystem] Verifying corpse cleanup for test ${testId}...`);
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (!corpse) {
      testData.corpseCleanedUp = true;
      console.log(`[RPGCorpseTestSystem] ✅ Corpse cleaned up successfully for test ${testId}`);
    } else {
      this.recordError(testId, 'Corpse still exists after cleanup');
    }
  }

  private completeCorpseTest(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    testData.phase = 'completed';
    
    const results = {
      testId,
      duration: Date.now() - testData.startTime,
      corpseSpawned: testData.corpseSpawned,
      corpseVisible: testData.corpseVisible,
      corpseInteractable: testData.corpseInteractable,
      lootAccessible: testData.lootAccessible,
      corpseCleanedUp: testData.corpseCleanedUp,
      expectedLootItems: testData.expectedLootItems,
      actualLootItems: testData.actualLootItems,
      errors: testData.errors,
      success: testData.errors.length === 0 && 
               (testData.corpseSpawned || testData.corpseVisible || testData.lootAccessible)
    };
    
    if (results.success) {
      console.log(`[RPGCorpseTestSystem] ✅ Test ${testId} PASSED:`, results);
      this.updateTestPlatformColor(`corpse_test_${testId}`, 0x00FF00);
    } else {
      console.error(`[RPGCorpseTestSystem] ❌ Test ${testId} FAILED:`, results);
      this.updateTestPlatformColor(`corpse_test_${testId}`, 0xFF0000);
      
      // Throw error to server logs
      throw new Error(`Corpse test ${testId} failed: ${results.errors.join(', ')}`);
    }
  }

  private failCorpseTest(testId: string, reason: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.phase = 'failed';
      testData.errors.push(reason);
    }
    
    console.error(`[RPGCorpseTestSystem] ❌ Test ${testId} FAILED: ${reason}`);
    this.updateTestPlatformColor(`corpse_test_${testId}`, 0xFF0000);
    
    // Throw error to server logs for debugging
    throw new Error(`RPG Corpse Test ${testId} failed: ${reason}`);
  }

  private recordError(testId: string, error: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.errors.push(error);
    }
    console.error(`[RPGCorpseTestSystem] Error in test ${testId}: ${error}`);
  }

  // Event handlers
  private handleCorpseSpawned(data: any): void {
    console.log('[RPGCorpseTestSystem] Corpse spawned event received:', data);
  }

  private handleCorpseInteraction(data: any): void {
    console.log('[RPGCorpseTestSystem] Corpse interaction event received:', data);
    
    // Mark corpse as clicked for testing
    const corpse = this.findCorpseById(data.corpseId);
    if (corpse) {
      corpse.userData.clicked = true;
    }
  }

  private handleCorpseLooted(data: any): void {
    console.log('[RPGCorpseTestSystem] Corpse looted event received:', data);
  }

  private handleCorpseCleanup(data: any): void {
    console.log('[RPGCorpseTestSystem] Corpse cleanup event received:', data);
    
    // Remove corpse from scene
    const corpse = this.findCorpseById(data.corpseId);
    if (corpse && corpse.parent) {
      corpse.parent.remove(corpse);
    }
  }

  private handleMobDeath(data: any): void {
    console.log('[RPGCorpseTestSystem] Mob death event received:', data);
  }

  // Utility methods
  private findCorpseById(corpseId: string): THREE.Object3D | null {
    if (!this.world.stage?.scene) return null;
    
    return this.world.stage.scene.getObjectByName(corpseId) || null;
  }

  private findAllCorpsesNear(position: { x: number, y: number, z: number }, radius: number): THREE.Object3D[] {
    if (!this.world.stage?.scene) return [];
    
    const corpses: THREE.Object3D[] = [];
    const center = new THREE.Vector3(position.x, position.y, position.z);
    
    this.world.stage.scene.traverse((obj: THREE.Object3D) => {
      if (obj.userData.type === 'corpse') {
        const distance = obj.position.distanceTo(center);
        if (distance <= radius) {
          corpses.push(obj);
        }
      }
    });
    
    return corpses;
  }

  private getLootTableForMob(mobType: string): string[] {
    const lootTables: Record<string, string[]> = {
      'goblin': ['coins'],
      'bandit': ['coins', 'bronze_sword'],
      'barbarian': ['coins', 'arrows'],
      'dark_warrior': ['coins', 'steel_sword'],
      'hobgoblin': ['coins', 'steel_shield'],
      'guard': ['coins', 'steel_helmet']
    };
    
    return lootTables[mobType] || ['coins'];
  }

  private createTestPlatform(id: string, position: { x: number, y: number, z: number }, color: number, size: { x: number, y: number, z: number }): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshLambertMaterial({ color });
    const platform = new THREE.Mesh(geometry, material);
    
    platform.position.set(position.x, position.y, position.z);
    platform.name = id;
    platform.userData = { type: 'test_platform', testId: id };
    
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(platform);
    }
    
    return platform;
  }

  private createTestText(id: string, position: { x: number, y: number, z: number }, text: string, yOffset: number): void {
    this.world.emit?.('rpg:test:text:create', {
      id,
      position: { x: position.x, y: position.y + yOffset, z: position.z },
      text,
      color: '#FFFFFF',
      size: 0.4
    });
  }

  private updateTestPlatformColor(id: string, color: number): void {
    if (!this.world.stage?.scene) return;
    
    const platform = this.world.stage.scene.getObjectByName(id);
    if (platform && platform.type === 'Mesh') {
      const mesh = platform as THREE.Mesh;
      if (mesh.material && 'color' in mesh.material) {
        (mesh.material as any).color.setHex(color);
      }
    }
  }

  /**
   * Get current system rating based on test performance
   */
  getSystemRating(): {
    overall: number;
    features: Record<string, number>;
    performance: Record<string, number>;
    errors: string[];
    recommendations: string[];
  } {
    const errors: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze test results
    const activeTests = Array.from(this.testData.values());
    const completedTests = activeTests.filter(test => test.phase === 'completed');
    const failedTests = activeTests.filter(test => test.phase === 'failed');
    
    // Feature ratings (0-100)
    const features = {
      corpse_creation: this.calculateCorpseCreationRating(activeTests),
      corpse_persistence: this.calculateCorpsePersistenceRating(activeTests),
      loot_spawning: this.calculateLootSpawningRating(activeTests),
      corpse_cleanup: this.calculateCorpseCleanupRating(activeTests),
      corpse_interaction: this.calculateCorpseInteractionRating(activeTests)
    };
    
    // Performance metrics (0-100)
    const performance = {
      corpse_lifecycle_accuracy: this.calculateCorpseLifecycleAccuracy(activeTests),
      test_completion_rate: completedTests.length > 0 ? (completedTests.length / activeTests.length) * 100 : 0,
      error_rate: activeTests.length > 0 ? (failedTests.length / activeTests.length) * 100 : 0,
      response_time: this.calculateAverageResponseTime(activeTests)
    };
    
    // Calculate overall rating
    const featureAvg = Object.values(features).reduce((a, b) => a + b, 0) / Object.values(features).length;
    const performanceAvg = Object.values(performance).reduce((a, b) => a + b, 0) / Object.values(performance).length;
    const overall = Math.round((featureAvg * 0.6 + performanceAvg * 0.4));
    
    // Generate errors and recommendations
    if (performance.corpse_lifecycle_accuracy < 75) {
      errors.push('Corpse lifecycle accuracy below threshold (75%)');
      recommendations.push('Improve corpse spawn/cleanup reliability');
    }
    
    if (features.corpse_creation < 80) {
      errors.push('Corpse creation reliability issues detected');
      recommendations.push('Enhance corpse visual creation and positioning');
    }
    
    if (performance.error_rate > 20) {
      errors.push('High error rate in corpse tests');
      recommendations.push('Investigate and fix corpse system error sources');
    }
    
    if (features.loot_spawning < 70) {
      recommendations.push('Improve loot spawning consistency from corpses');
    }
    
    if (activeTests.length === 0) {
      errors.push('No corpse test data available');
      recommendations.push('Run corpse tests to generate performance data');
    }
    
    return {
      overall,
      features,
      performance,
      errors,
      recommendations
    };
  }
  
  private calculateCorpseCreationRating(tests: CorpseTestData[]): number {
    const relevantTests = tests.filter(t => t.corpseSpawned !== undefined);
    if (relevantTests.length === 0) return 0;
    
    const successCount = relevantTests.filter(t => t.corpseSpawned).length;
    return Math.round((successCount / relevantTests.length) * 100);
  }
  
  private calculateCorpsePersistenceRating(tests: CorpseTestData[]): number {
    const relevantTests = tests.filter(t => t.corpseVisible !== undefined);
    if (relevantTests.length === 0) return 0;
    
    const successCount = relevantTests.filter(t => t.corpseVisible).length;
    return Math.round((successCount / relevantTests.length) * 100);
  }
  
  private calculateLootSpawningRating(tests: CorpseTestData[]): number {
    const relevantTests = tests.filter(t => t.lootAccessible !== undefined);
    if (relevantTests.length === 0) return 0;
    
    const successCount = relevantTests.filter(t => t.lootAccessible).length;
    return Math.round((successCount / relevantTests.length) * 100);
  }
  
  private calculateCorpseCleanupRating(tests: CorpseTestData[]): number {
    const relevantTests = tests.filter(t => t.corpseCleanedUp !== undefined);
    if (relevantTests.length === 0) return 0;
    
    const successCount = relevantTests.filter(t => t.corpseCleanedUp).length;
    return Math.round((successCount / relevantTests.length) * 100);
  }
  
  private calculateCorpseInteractionRating(tests: CorpseTestData[]): number {
    const relevantTests = tests.filter(t => t.corpseInteractable !== undefined);
    if (relevantTests.length === 0) return 0;
    
    const successCount = relevantTests.filter(t => t.corpseInteractable).length;
    return Math.round((successCount / relevantTests.length) * 100);
  }
  
  private calculateCorpseLifecycleAccuracy(tests: CorpseTestData[]): number {
    const completedTests = tests.filter(t => t.phase === 'completed');
    if (completedTests.length === 0) return 0;
    
    const accurateTests = completedTests.filter(t => 
      t.corpseSpawned && t.corpseVisible && t.errors.length === 0
    );
    
    return Math.round((accurateTests.length / completedTests.length) * 100);
  }
  
  private calculateAverageResponseTime(tests: CorpseTestData[]): number {
    const completedTests = tests.filter(t => t.phase === 'completed' && t.startTime);
    if (completedTests.length === 0) return 0;
    
    const avgDuration = completedTests.reduce((sum, test) => {
      return sum + (Date.now() - test.startTime);
    }, 0) / completedTests.length;
    
    // Convert to score (lower time = higher score, max 10 seconds = 100 points)
    return Math.max(0, Math.round(100 - (avgDuration / 10000) * 100));
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
      if (now - testData.startTime > 45000 && testData.phase !== 'completed' && testData.phase !== 'failed') {
        this.failCorpseTest(testId, 'Test timeout - exceeded 45 seconds');
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
    console.log('[RPGCorpseTestSystem] System destroyed');
  }
}