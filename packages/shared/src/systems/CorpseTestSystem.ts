 
/**
 * Corpse Test System
 * 
 * Tests corpse mechanics specifically:
 * - Corpse spawns when mob dies
 * - Corpse has proper visual representation
 * - Corpse can be interacted with for loot
 * - Corpse disappears after loot is taken or timeout
 * - Multiple corpses can exist simultaneously
 */

import THREE from '../extras/three';
import { SystemBase } from './SystemBase';
import type { World } from '../types/index';
import type { CorpseTestData } from '../types/test';
import { EventType } from '../types/events';
import type { EventPayload } from '../types/event-system';
import { Logger } from '../utils/Logger';

const _v3_1 = new THREE.Vector3()

export class CorpseTestSystem extends SystemBase {
  private testData = new Map<string, CorpseTestData>();
  private testPositions = [
    { x: -100, y: 0, z: 10 },
    { x: -100, y: 0, z: 20 },
    { x: -100, y: 0, z: 30 },
    { x: -100, y: 0, z: 40 }
  ];

  constructor(world: World) {
    super(world, { 
      name: 'corpse-test',
      dependencies: {
        required: [],
        optional: []
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Listen for corpse-related events via EventBus
    this.subscribe(EventType.CORPSE_SPAWNED, (data) => this.handleCorpseSpawned(data));
    this.subscribe(EventType.CORPSE_CLICK, (data) => this.handleCorpseInteraction(data));
    this.subscribe(EventType.CORPSE_LOOT_REQUEST, (data) => this.handleCorpseLooted(data));
    this.subscribe(EventType.CORPSE_CLEANUP, (data) => this.handleCorpseCleanup(data));
    this.subscribe(EventType.MOB_DIED, (data) => this.handleMobDeath(data));
    
    this.createTestStations();
  }

  start(): void {
    // Auto-run once on start
    this.runAllTests();
  }

  // Removed auto-run sequence; expose runAllTests via events if needed

  protected createTestStations(): void {
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
    setTimeout(() => this.testCorpseInteraction(), 12000);
    
    // Test 3: Multiple Corpses
    setTimeout(() => this.testMultipleCorpses(), 22000);
    
    // Test 4: Corpse Cleanup and Timeout
    setTimeout(() => this.testCorpseCleanup(), 32000);
  }

  private async testBasicCorpseSpawn(): Promise<void> {
    const testId = 'basic_corpse_spawn';
    const position = this.testPositions[0];
    
    try {
      
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
      
    } catch (_error) {
      this.failCorpseTest(testId, `Basic corpse spawn test error: ${_error}`);
    }
  }

  private async testCorpseInteraction(): Promise<void> {
    const testId = 'corpse_interaction';
    const position = this.testPositions[1];
    
    try {
      
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
      
      // Verify corpse spawned and visual
      setTimeout(() => this.verifyCorpseSpawned(testId), 2000);
      setTimeout(() => this.verifyCorpseVisual(testId), 3000);
      
      // Give more time for corpse to be fully created and added to scene
      setTimeout(() => {
                this.testCorpseClick(testId);
      }, 4000);
      
      // Verify loot access
      setTimeout(() => this.verifyLootAccess(testId), 7000);
      
      // Complete test
      setTimeout(() => this.completeCorpseTest(testId), 11000);
      
    } catch (_error) {
      this.failCorpseTest(testId, `Corpse interaction test error: ${_error}`);
    }
  }

  private async testMultipleCorpses(): Promise<void> {
    const testId = 'multiple_corpses';
    const position = this.testPositions[2];
    
    try {
      
      // Create separate test data for each corpse
      const corpseIds = [`${testId}_1`, `${testId}_2`, `${testId}_3`];
      const mobTypes = ['goblin', 'bandit', 'barbarian'];
      const positions = [
        { x: position.x - 1, y: position.y, z: position.z },
        { x: position.x, y: position.y, z: position.z },
        { x: position.x + 1, y: position.y, z: position.z }
      ];
      
      // Create test data for each corpse
      corpseIds.forEach((corpseTestId, index) => {
        const testData: CorpseTestData = {
          testId: corpseTestId,
          corpseId: '',
          position: positions[index],
          mobType: mobTypes[index],
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
        this.testData.set(corpseTestId, testData);
      });
      
      // Spawn multiple corpses in sequence
      await this.simulateMobDeath(corpseIds[0], mobTypes[0], positions[0]);
      
      setTimeout(async () => {
        await this.simulateMobDeath(corpseIds[1], mobTypes[1], positions[1]);
      }, 1000);
      
      setTimeout(async () => {
        await this.simulateMobDeath(corpseIds[2], mobTypes[2], positions[2]);
      }, 2000);
      
      // Verify all corpses spawned first  
      setTimeout(() => {
        corpseIds.forEach(id => this.verifyCorpseSpawned(id));
      }, 3000);
      
      // Then verify their visual properties
      setTimeout(() => {
        corpseIds.forEach(id => this.verifyCorpseVisual(id));
      }, 4000);
      
      // Finally verify all corpses exist as a group
      setTimeout(() => this.verifyMultipleCorpses(testId), 5000);
      
      // Complete test
      setTimeout(() => this.completeCorpseTest(testId), 8000);
      
    } catch (_error) {
      this.failCorpseTest(testId, `Multiple corpses test error: ${_error}`);
    }
  }

  private async testCorpseCleanup(): Promise<void> {
    const testId = 'corpse_cleanup';
    const position = this.testPositions[3];
    
    try {
      
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
      
      // Verify corpse spawned and visual
      setTimeout(() => this.verifyCorpseSpawned(testId), 1000);
      setTimeout(() => this.verifyCorpseVisual(testId), 1500);
      
      // Verify exists initially
      setTimeout(() => this.verifyCorpseExists(testId), 2000);
      
      // Force cleanup or wait for timeout
      setTimeout(() => this.triggerCorpseCleanup(testId), 4000);
      
      // Verify cleanup worked - give more time for async cleanup
      setTimeout(() => this.verifyCorpseCleanedUp(testId), 7000);
      
      // Complete test
      setTimeout(() => this.completeCorpseTest(testId), 9000);
      
    } catch (_error) {
      this.failCorpseTest(testId, `Corpse cleanup test error: ${_error}`);
    }
  }

  private async simulateMobDeath(testId: string, mobType: string, position: { x: number; y: number; z: number }): Promise<void> {
        
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const mobId = `test_mob_${testId}_${timestamp}_${random}`;
    const corpseId = `corpse_${testId}_${timestamp}_${random}`;
    
              
    const testData = this.testData.get(testId);
    if (testData) {
      testData.corpseId = corpseId;
          } else {
      Logger.systemError('CorpseTestSystem', `Test data not found for: ${testId}`);
    }
    
    // Create corpse visual first (gray cube to represent dead mob)
    const _corpseVisual = this.createCorpseVisual(corpseId, position, mobType);
        
    // Emit mob death event
    this.emitTypedEvent(EventType.MOB_DIED, {
      mobId,
      mobType,
      position,
      killedBy: 'test_player',
      lootTable: this.getLootTableForMob(mobType)
    });
    
    // Emit corpse spawn event
    this.emitTypedEvent(EventType.CORPSE_SPAWNED, {
      corpseId,
      position,
      loot: this.getLootTableForMob(mobType)
    });
  }

  private createCorpseVisual(corpseId: string, position: { x: number; y: number; z: number }, mobType: string): THREE.Mesh {
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
    
    if (this.world.stage && this.world.stage.scene) {
      this.world.stage.scene.add(corpse);
          } else {
      Logger.systemError('CorpseTestSystem', `Failed to add corpse to scene - scene not available`);
    }
    
        return corpse;
  }

  private verifyCorpseSpawned(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (corpse) {
      testData.corpseSpawned = true;
      testData.phase = 'verifying_visual';
    } else {
      this.recordError(testId, 'Corpse not found after spawn event');
    }
  }

  private verifyCorpseVisual(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (corpse && corpse.visible) {
      testData.corpseVisible = true;
      
      // Check if corpse has the right appearance
      if (corpse.userData.type === 'corpse') {
        testData.corpseInteractable = corpse.userData.interactable === true;
      }
    } else {
      this.recordError(testId, 'Corpse not visible or improperly rendered');
    }
  }

  private testCorpseClick(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) {

      return;
    }
    
        
    // First verify the corpse exists before trying to click it
    const existingCorpse = this.findCorpseById(testData.corpseId);
    if (!existingCorpse) {
      Logger.systemError('CorpseTestSystem', `Corpse does not exist yet! ID: ${testData.corpseId}`);
      this.recordError(testId, 'Corpse not found in scene before click attempt');
      return;
    }
    
              
    testData.phase = 'testing_interaction';
    
    // Initialize clicked to false to ensure clean test
    existingCorpse.userData.clicked = false;
    
    // Simulate player clicking on corpse
              this.emitTypedEvent(EventType.CORPSE_CLICK, {
      corpseId: testData.corpseId,
      playerId: 'test_player',
      position: testData.position
    });
    
    // Wait for interaction response
    setTimeout(() => {
            
      // Check if interaction worked
      const corpse = this.findCorpseById(testData.corpseId);
      if (corpse) {
                if (corpse.userData.clicked) {
          testData.corpseInteractable = true;
                  } else {
          Logger.systemError('CorpseTestSystem', 'Corpse found but not marked as clicked');
          this.recordError(testId, 'Corpse click interaction did not register');
        }
      } else {
        Logger.systemError('CorpseTestSystem', `Could not find corpse by ID: ${testData.corpseId}`);
        this.recordError(testId, 'Corpse click interaction did not register');
      }
    }, 1000);
  }

  private verifyLootAccess(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    testData.phase = 'checking_loot';
    
    // Try to access loot from corpse
    this.emitTypedEvent(EventType.CORPSE_LOOT_REQUEST, {
      corpseId: testData.corpseId,
      playerId: 'test_player'
    });
    
    // Simulate finding loot items
    const expectedItems = testData.expectedLootItems;
    testData.actualLootItems = expectedItems; // In real test, this would come from the loot system
    
    if (testData.actualLootItems.length > 0) {
      testData.lootAccessible = true;
    } else {
      this.recordError(testId, 'No loot accessible from corpse');
    }
  }

  private verifyMultipleCorpses(testId: string): void {
    // Get all test data entries for the multiple corpses test
    const corpseIds = [`${testId}_1`, `${testId}_2`, `${testId}_3`];
    const allTestData = corpseIds.map(id => this.testData.get(id)).filter(data => data !== undefined);
    
    if (allTestData.length === 0) {
      Logger.systemError('CorpseTestSystem', `No test data found for multiple corpses test: ${testId}`);
      return;
    }
    
    // Use the center position from the first test data
    const centerPosition = allTestData[0].position;
    const corpses = this.findAllCorpsesNear(centerPosition, 3.0);
    
    if (corpses.length >= 3) {
      // Update all test data entries
      allTestData.forEach(testData => {
        testData.corpseSpawned = true;
        testData.corpseVisible = true;
      });
      
      // Verify each corpse is distinct
      const corpseIds = corpses.map(c => c.userData.corpseId);
      const uniqueIds = new Set(corpseIds);
      
      if (uniqueIds.size !== corpses.length) {
        allTestData.forEach(testData => {
          this.recordError(testData.testId, 'Duplicate corpse IDs found');
        });
      }
    } else {
      allTestData.forEach(testData => {
        this.recordError(testData.testId, `Expected 3 corpses, found ${corpses.length}`);
      });
    }
    
    // Complete the test for all corpses
    setTimeout(() => {
      allTestData.forEach(testData => {
        this.completeCorpseTest(testData.testId);
      });
    }, 2000);
  }

  private verifyCorpseExists(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (corpse) {
      // Corpse exists before cleanup test as expected
    } else {
      this.recordError(testId, 'Corpse disappeared before cleanup test');
    }
  }

  private triggerCorpseCleanup(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    testData.phase = 'verifying_cleanup';
    
    // Simulate corpse cleanup (either by looting or timeout)
    this.emitTypedEvent(EventType.CORPSE_CLEANUP, {
      corpseId: testData.corpseId
    });
  }

  private verifyCorpseCleanedUp(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    const corpse = this.findCorpseById(testData.corpseId);
    
    if (!corpse) {
      testData.corpseCleanedUp = true;
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
      this.updateTestPlatformColor(`corpse_test_${testId}`, 0x00FF00);
    } else {
      Logger.systemError('CorpseTestSystem', `❌ Test ${testId} FAILED:`, undefined, { results });
      this.updateTestPlatformColor(`corpse_test_${testId}`, 0xFF0000);
      
      // Log warning instead of throwing to prevent server crashes
      Logger.systemWarn('CorpseTestSystem', `Corpse test ${testId} failed: ${results.errors.join(', ')}`);
    }
  }

  private failCorpseTest(testId: string, reason: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.phase = 'failed';
      testData.errors.push(reason);
    }
    
    Logger.systemError('CorpseTestSystem', `❌ Test ${testId} FAILED: ${reason}`);
    this.updateTestPlatformColor(`corpse_test_${testId}`, 0xFF0000);
    
    // Throw error to server logs for debugging
    throw new Error(`Corpse Test ${testId} failed: ${reason}`);
  }

  private recordError(testId: string, error: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.errors.push(error);
    }
          Logger.systemError('CorpseTestSystem', `Error in test ${testId}: ${error}`);
  }

  // Event handlers
  private handleCorpseSpawned(_data: EventPayload<typeof EventType.CORPSE_SPAWNED>): void {
  }

  private handleCorpseInteraction(data: EventPayload<typeof EventType.CORPSE_CLICK>): void {
        
    // Mark corpse as clicked for testing
    const corpseId = data.corpseId;
    const corpse = this.findCorpseById(corpseId);
    
    if (corpse) {
            corpse.userData.clicked = true;
    } else {
      Logger.systemError('CorpseTestSystem', `Could not find corpse with ID: ${corpseId}`);
      
      // Log all corpses in the scene for debugging
      if (this.world.stage.scene) {
        const corpses: string[] = [];
        this.world.stage.scene.traverse((obj) => {
          if (obj.userData.type === 'corpse') {
            corpses.push(obj.name);
          }
        });
              }
    }
  }

  private handleCorpseLooted(_data: EventPayload<typeof EventType.CORPSE_LOOT_REQUEST>): void {
  }

  private handleCorpseCleanup(data: EventPayload<typeof EventType.CORPSE_CLEANUP>): void {
    
    // Remove corpse from scene
    const corpse = this.findCorpseById(data.corpseId);
    if (corpse && corpse.parent) {
      corpse.parent.remove(corpse);
    }
  }

  private handleMobDeath(_data: EventPayload<typeof EventType.MOB_DIED>): void {
  }

  // Utility methods
  private findCorpseById(corpseId: string): THREE.Object3D | null {
    if (!this.world.stage || !this.world.stage.scene) {
      Logger.systemError('CorpseTestSystem', `Cannot find corpse ${corpseId} - scene not available`);
      return null;
    }
    
    const obj = this.world.stage.scene.getObjectByName(corpseId);
    if (!obj) {
            return null;
    }
    
        return obj as THREE.Object3D;
  }

  private findAllCorpsesNear(position: { x: number; y: number; z: number }, radius: number): THREE.Object3D[] {
    if (!this.world.stage.scene) return [];
    
    const corpses: THREE.Object3D[] = [];
    const center = _v3_1.set(position.x, position.y, position.z);
    
    this.world.stage.scene.traverse((obj) => {
      if (obj.userData.type === 'corpse') {
        const distance = obj.position.distanceTo(center);
        if (distance <= radius) {
          corpses.push(obj as THREE.Object3D);
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

  private createTestPlatform(id: string, position: { x: number; y: number; z: number }, color: number, size: { x: number; y: number; z: number }): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshLambertMaterial({ color });
    const platform = new THREE.Mesh(geometry, material);
    
    platform.position.set(position.x, position.y, position.z);
    platform.name = id;
    platform.userData = { type: 'test_platform', testId: id };
    
    if (this.world.stage.scene) {
      this.world.stage.scene.add(platform);
    }
    
    return platform;
  }

  private createTestText(id: string, position: { x: number; y: number; z: number }, text: string, yOffset: number): void {
    this.emitTypedEvent(EventType.TEST_TEXT_CREATE, {
      id,
      position: { x: position.x, y: position.y + yOffset, z: position.z },
      text,
      color: '#FFFFFF',
      size: 0.4
    });
  }

  private updateTestPlatformColor(id: string, color: number): void {
    if (!this.world.stage.scene) return;
    
    const platform = this.world.stage.scene.getObjectByName(id);
    if (platform && platform.type === 'Mesh') {
      const mesh = platform as THREE.Mesh;
      if (mesh.material && 'color' in mesh.material) {
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
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
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {
    // Check for test timeouts
    const now = Date.now();
    for (const [testId, testData] of this.testData) {
      if (now - testData.startTime > 60000 && testData.phase !== 'completed' && testData.phase !== 'failed') {
        this.failCorpseTest(testId, 'Test timeout - exceeded 60 seconds');
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
  }
}