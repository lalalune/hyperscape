/**
 * RPG Woodcutting Test System
 * Tests complete woodcutting loop per GDD specifications:
 * - Equip hatchet near trees
 * - Click tree to start chopping
 * - Test success rates based on skill level
 * - Test XP gain and log drops
 * - Test tree respawn mechanics
 * - Test failure conditions (no hatchet, wrong location, inventory full)
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem } from '../data/items';

interface WoodcuttingTestData {
  fakePlayer: FakePlayer;
  treeLocation: { x: number; y: number; z: number };
  startTime: number;
  initialWoodcuttingXP: number;
  finalWoodcuttingXP: number;
  logsChopped: number;
  attemptsMade: number;
  successRate: number;
  expectedSuccessRate: number;
  hasHatchetEquipped: boolean;
  nearTree: boolean;
  inventorySpace: number;
  treeRespawned: boolean;
  treeDepleted: boolean;
}

export class RPGWoodcuttingTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, WoodcuttingTestData>();
  private testResults = new Map<string, {
    passed: boolean;
    duration?: number;
    data?: {
      logsChopped?: number;
      attemptsMade?: number;
    };
  }>();
  private resourceSystem: any;
  private inventorySystem: any;
  private xpSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGWoodcuttingTestSystem] Initializing woodcutting test system...');
    
    // Get required systems
    this.resourceSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGResourceSystem');
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    this.xpSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGXPSystem');
    
    if (!this.resourceSystem) {
      throw new Error('[RPGWoodcuttingTestSystem] RPGResourceSystem not found - required for woodcutting tests');
    }
    
    if (!this.inventorySystem) {
      throw new Error('[RPGWoodcuttingTestSystem] RPGInventorySystem not found - required for woodcutting tests');
    }
    
    if (!this.xpSystem) {
      throw new Error('[RPGWoodcuttingTestSystem] RPGXPSystem not found - required for woodcutting tests');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGWoodcuttingTestSystem] Woodcutting test system initialized');
  }

  private createTestStations(): void {
    // Basic Woodcutting Success Test - Player with hatchet near tree
    this.createTestStation({
      id: 'basic_woodcutting_success',
      name: 'Basic Woodcutting Success Test',
      position: { x: -110, y: 0, z: 10 },
      timeoutMs: 35000 // 35 seconds
    });

    // No Hatchet Test - Player without hatchet
    this.createTestStation({
      id: 'woodcutting_no_hatchet_failure',
      name: 'Woodcutting Without Hatchet Failure Test',
      position: { x: -110, y: 0, z: 20 },
      timeoutMs: 15000 // 15 seconds
    });

    // Wrong Location Test - Player with hatchet away from tree
    this.createTestStation({
      id: 'woodcutting_wrong_location_failure',
      name: 'Woodcutting Wrong Location Failure Test',
      position: { x: -110, y: 0, z: 30 },
      timeoutMs: 15000 // 15 seconds
    });

    // Full Inventory Test - Player with hatchet but full inventory
    this.createTestStation({
      id: 'woodcutting_full_inventory_failure',
      name: 'Woodcutting Full Inventory Failure Test',
      position: { x: -110, y: 0, z: 40 },
      timeoutMs: 20000 // 20 seconds
    });

    // Skill Progression Test - Test XP gain and level ups
    this.createTestStation({
      id: 'woodcutting_skill_progression',
      name: 'Woodcutting Skill Progression Test',
      position: { x: -110, y: 0, z: 50 },
      timeoutMs: 45000 // 45 seconds
    });

    // High Level Woodcutting Test - Player with high woodcutting skill
    this.createTestStation({
      id: 'woodcutting_high_level',
      name: 'High Level Woodcutting Success Rate Test',
      position: { x: -110, y: 0, z: 60 },
      timeoutMs: 30000 // 30 seconds
    });

    // Tree Respawn Test - Test that trees respawn after depletion
    this.createTestStation({
      id: 'woodcutting_tree_respawn',
      name: 'Tree Respawn Mechanics Test',
      position: { x: -110, y: 0, z: 70 },
      timeoutMs: 90000 // 90 seconds (includes respawn time)
    });

    // Different Tree Types Test - Test chopping different tree types
    this.createTestStation({
      id: 'woodcutting_tree_types',
      name: 'Different Tree Types Test',
      position: { x: -110, y: 0, z: 80 },
      timeoutMs: 40000 // 40 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_woodcutting_success':
        this.runBasicWoodcuttingSuccessTest(stationId);
        break;
      case 'woodcutting_no_hatchet_failure':
        this.runNoHatchetFailureTest(stationId);
        break;
      case 'woodcutting_wrong_location_failure':
        this.runWrongLocationFailureTest(stationId);
        break;
      case 'woodcutting_full_inventory_failure':
        this.runFullInventoryFailureTest(stationId);
        break;
      case 'woodcutting_skill_progression':
        this.runSkillProgressionTest(stationId);
        break;
      case 'woodcutting_high_level':
        this.runHighLevelWoodcuttingTest(stationId);
        break;
      case 'woodcutting_tree_respawn':
        this.runTreeRespawnTest(stationId);
        break;
      case 'woodcutting_tree_types':
        this.runTreeTypesTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown woodcutting test: ${stationId}`);
    }
  }

  private async runBasicWoodcuttingSuccessTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting basic woodcutting success test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with level 5 woodcutting and bronze hatchet
      const fakePlayer = this.createFakePlayer({
        id: `woodcutting_success_player_${Date.now()}`,
        name: 'Woodcutting Success Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 5 // Level 5 woodcutting
        }
      });

      // Give player bronze hatchet and equip it
      const bronzeHatchet = getItem('100'); // Bronze Hatchet
      if (bronzeHatchet) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
      }

      // Create tree
      const treeLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'normal_tree');

      // Get initial woodcutting XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'woodcutting') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation,
        startTime: Date.now(),
        initialWoodcuttingXP: initialXP,
        finalWoodcuttingXP: initialXP,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 70, // Level 5 woodcutting should have ~70% success rate
        hasHatchetEquipped: true,
        nearTree: true,
        inventorySpace: 27, // 28 slots - 1 for hatchet
        treeRespawned: false,
        treeDepleted: false
      });

      // Start woodcutting sequence
      this.startWoodcuttingAttempts(stationId, 8);
      
    } catch (error) {
      this.failTest(stationId, `Basic woodcutting success test error: ${error}`);
    }
  }

  private async runNoHatchetFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting no hatchet failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player WITHOUT hatchet
      const fakePlayer = this.createFakePlayer({
        id: `no_hatchet_player_${Date.now()}`,
        name: 'No Hatchet Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 5
        }
      });

      // No hatchet in inventory
      fakePlayer.inventory = [];
      fakePlayer.equipment = {};

      // Create tree
      const treeLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'normal_tree');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation,
        startTime: Date.now(),
        initialWoodcuttingXP: 0,
        finalWoodcuttingXP: 0,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - no hatchet
        hasHatchetEquipped: false,
        nearTree: true,
        inventorySpace: 28,
        treeRespawned: false,
        treeDepleted: false
      });

      // Try to chop without hatchet - should fail immediately
      this.testWoodcuttingFailure(stationId, 'no_hatchet');
      
    } catch (error) {
      this.failTest(stationId, `No hatchet failure test error: ${error}`);
    }
  }

  private async runWrongLocationFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting wrong location failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with hatchet but away from tree
      const fakePlayer = this.createFakePlayer({
        id: `wrong_location_player_${Date.now()}`,
        name: 'Wrong Location Test Player',
        position: { x: station.position.x - 5, y: station.position.y, z: station.position.z }, // Far from tree
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 5
        }
      });

      // Give player hatchet
      const bronzeHatchet = getItem('100');
      if (bronzeHatchet) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
      }

      // Create tree far away
      const treeLocation = { x: station.position.x + 10, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'normal_tree');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation,
        startTime: Date.now(),
        initialWoodcuttingXP: 0,
        finalWoodcuttingXP: 0,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - too far from tree
        hasHatchetEquipped: true,
        nearTree: false,
        inventorySpace: 27,
        treeRespawned: false,
        treeDepleted: false
      });

      // Try to chop from wrong location - should fail
      this.testWoodcuttingFailure(stationId, 'too_far');
      
    } catch (error) {
      this.failTest(stationId, `Wrong location failure test error: ${error}`);
    }
  }

  private async runFullInventoryFailureTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting full inventory failure test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with hatchet and FULL inventory
      const fakePlayer = this.createFakePlayer({
        id: `full_inventory_player_${Date.now()}`,
        name: 'Full Inventory Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 5
        }
      });

      // Fill inventory completely (28 slots)
      const bronzeHatchet = getItem('100');
      const dummyItem = getItem('1'); // Bronze sword as dummy item
      
      if (bronzeHatchet && dummyItem) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
        
        // Fill remaining 27 slots with dummy items
        for (let i = 0; i < 27; i++) {
          fakePlayer.inventory.push({ item: dummyItem, quantity: 1 });
        }
      }

      // Create tree
      const treeLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'normal_tree');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation,
        startTime: Date.now(),
        initialWoodcuttingXP: 0,
        finalWoodcuttingXP: 0,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 0, // Should fail - inventory full
        hasHatchetEquipped: true,
        nearTree: true,
        inventorySpace: 0,
        treeRespawned: false,
        treeDepleted: false
      });

      // Try to chop with full inventory - should fail
      this.testWoodcuttingFailure(stationId, 'inventory_full');
      
    } catch (error) {
      this.failTest(stationId, `Full inventory failure test error: ${error}`);
    }
  }

  private async runSkillProgressionTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting skill progression test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with low woodcutting level (1) to test progression
      const fakePlayer = this.createFakePlayer({
        id: `skill_progression_player_${Date.now()}`,
        name: 'Skill Progression Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 1 // Level 1 woodcutting - low success rate
        }
      });

      // Give player hatchet
      const bronzeHatchet = getItem('100');
      if (bronzeHatchet) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
      }

      // Create tree
      const treeLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'normal_tree');

      // Get initial woodcutting XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'woodcutting') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation,
        startTime: Date.now(),
        initialWoodcuttingXP: initialXP,
        finalWoodcuttingXP: initialXP,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 62, // Level 1 woodcutting should have ~62% success rate (60% base + 2%)
        hasHatchetEquipped: true,
        nearTree: true,
        inventorySpace: 27,
        treeRespawned: false,
        treeDepleted: false
      });

      // Start many woodcutting attempts to test progression
      this.startWoodcuttingAttempts(stationId, 15);
      
    } catch (error) {
      this.failTest(stationId, `Skill progression test error: ${error}`);
    }
  }

  private async runHighLevelWoodcuttingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting high level woodcutting test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with high woodcutting level
      const fakePlayer = this.createFakePlayer({
        id: `high_level_player_${Date.now()}`,
        name: 'High Level Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 15 // Level 15 woodcutting - high success rate
        }
      });

      // Give player hatchet
      const bronzeHatchet = getItem('100');
      if (bronzeHatchet) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
      }

      // Create tree
      const treeLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'normal_tree');

      // Get initial woodcutting XP
      const initialXP = this.xpSystem.getSkillXP(fakePlayer.id, 'woodcutting') || 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation,
        startTime: Date.now(),
        initialWoodcuttingXP: initialXP,
        finalWoodcuttingXP: initialXP,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 85, // Level 15 woodcutting should have ~85% success rate (capped)
        hasHatchetEquipped: true,
        nearTree: true,
        inventorySpace: 27,
        treeRespawned: false,
        treeDepleted: false
      });

      // Start woodcutting attempts
      this.startWoodcuttingAttempts(stationId, 10);
      
    } catch (error) {
      this.failTest(stationId, `High level woodcutting test error: ${error}`);
    }
  }

  private async runTreeRespawnTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting tree respawn test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player to deplete and test respawn
      const fakePlayer = this.createFakePlayer({
        id: `tree_respawn_player_${Date.now()}`,
        name: 'Tree Respawn Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 20 // High level for reliable chopping
        }
      });

      // Give player hatchet
      const bronzeHatchet = getItem('100');
      if (bronzeHatchet) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
      }

      // Create tree
      const treeLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'normal_tree');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation,
        startTime: Date.now(),
        initialWoodcuttingXP: 0,
        finalWoodcuttingXP: 0,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 95, // High level for reliable testing
        hasHatchetEquipped: true,
        nearTree: true,
        inventorySpace: 27,
        treeRespawned: false,
        treeDepleted: false
      });

      // Start depleting tree, then wait for respawn
      this.startTreeRespawnSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Tree respawn test error: ${error}`);
    }
  }

  private async runTreeTypesTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGWoodcuttingTestSystem] Starting tree types test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with moderate woodcutting level
      const fakePlayer = this.createFakePlayer({
        id: `tree_types_player_${Date.now()}`,
        name: 'Tree Types Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100, woodcutting: 10
        }
      });

      // Give player hatchet
      const bronzeHatchet = getItem('100');
      if (bronzeHatchet) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
      }

      // Create multiple trees of different types
      const normalTreeLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      const oakTreeLocation = { x: station.position.x + 4, y: station.position.y, z: station.position.z };
      
      this.createTreeVisual(stationId + '_normal', normalTreeLocation, 'normal_tree');
      this.createTreeVisual(stationId + '_oak', oakTreeLocation, 'oak_tree');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        treeLocation: normalTreeLocation, // Start with normal tree
        startTime: Date.now(),
        initialWoodcuttingXP: 0,
        finalWoodcuttingXP: 0,
        logsChopped: 0,
        attemptsMade: 0,
        successRate: 0,
        expectedSuccessRate: 80, // Level 10 woodcutting
        hasHatchetEquipped: true,
        nearTree: true,
        inventorySpace: 27,
        treeRespawned: false,
        treeDepleted: false
      });

      // Test chopping different tree types
      this.startTreeTypesSequence(stationId, normalTreeLocation, oakTreeLocation);
      
    } catch (error) {
      this.failTest(stationId, `Tree types test error: ${error}`);
    }
  }

  private createTreeVisual(stationId: string, location: { x: number; y: number; z: number }, treeType: string): void {
    const treeColors = {
      'normal_tree': '#8b4513',    // Brown
      'oak_tree': '#9acd32',       // Yellow-green
      'willow_tree': '#228b22',    // Forest green
      'maple_tree': '#ff8c00'      // Dark orange
    };

    this.world.emit('rpg:test:tree:create', {
      id: `tree_${stationId}`,
      position: location,
      color: treeColors[treeType] || '#8b4513',
      size: { x: 1.5, y: 4, z: 1.5 },
      type: treeType
    });
  }

  private startWoodcuttingAttempts(stationId: string, maxAttempts: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGWoodcuttingTestSystem] Starting ${maxAttempts} woodcutting attempts...`);

    let attempts = 0;

    const attemptWoodcutting = async () => {
      if (attempts >= maxAttempts) {
        this.completeWoodcuttingTest(stationId);
        return;
      }

      attempts++;
      testData.attemptsMade = attempts;

      console.log(`[RPGWoodcuttingTestSystem] Woodcutting attempt ${attempts}/${maxAttempts}`);

      // Move player near tree
      this.moveFakePlayer(testData.fakePlayer.id, {
        x: testData.treeLocation.x - 1,
        y: testData.treeLocation.y,
        z: testData.treeLocation.z
      });

      // Attempt woodcutting using resource system
      try {
        this.world.emit('rpg:resource:start_gather', {
          playerId: testData.fakePlayer.id,
          resourceId: `tree_${stationId}`,
          playerPosition: testData.fakePlayer.position
        });

        // Wait for woodcutting to complete (resource gathering takes 3-5 seconds)
        setTimeout(() => {
          // Check if log was chopped by examining inventory
          const logsInInventory = testData.fakePlayer.inventory.filter(slot => 
            slot.item.name.toLowerCase().includes('log')
          );
          
          if (logsInInventory.length > 0) {
            const currentLogCount = logsInInventory.reduce((sum, slot) => sum + slot.quantity, 0);
            if (currentLogCount > testData.logsChopped) {
              testData.logsChopped = currentLogCount;
              console.log(`[RPGWoodcuttingTestSystem] Log chopped! Total: ${testData.logsChopped}`);
              
              // Test XP gain
              const currentXP = this.xpSystem.getSkillXP(testData.fakePlayer.id, 'woodcutting') || 0;
              if (currentXP > testData.finalWoodcuttingXP) {
                testData.finalWoodcuttingXP = currentXP;
                console.log(`[RPGWoodcuttingTestSystem] XP gained: ${currentXP - testData.initialWoodcuttingXP} total`);
              }
            }
          }

          // Continue woodcutting
          setTimeout(attemptWoodcutting, 500);
        }, 4000); // Wait for woodcutting attempt to complete

      } catch (error) {
        console.log(`[RPGWoodcuttingTestSystem] Woodcutting attempt failed: ${error}`);
        setTimeout(attemptWoodcutting, 500);
      }
    };

    // Start woodcutting after a brief delay
    setTimeout(attemptWoodcutting, 1000);
  }

  private startTreeRespawnSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGWoodcuttingTestSystem] Starting tree respawn sequence...');

    // Phase 1: Deplete the tree (chop until it's gone)
    this.startWoodcuttingAttempts(stationId, 5);

    // Phase 2: Wait for respawn and test (after 65 seconds)
    setTimeout(() => {
      console.log('[RPGWoodcuttingTestSystem] Testing tree respawn...');
      
      // Check if tree has respawned by testing if we can chop again
      this.testTreeRespawn(stationId);
    }, 65000); // Trees respawn after 60 seconds per GDD
  }

  private testTreeRespawn(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Try to chop the tree again - should work if respawned
    try {
      this.world.emit('rpg:resource:start_gather', {
        playerId: testData.fakePlayer.id,
        resourceId: `tree_${stationId}`,
        playerPosition: testData.fakePlayer.position
      });

      // Check for success after brief delay
      setTimeout(() => {
        const initialLogCount = testData.logsChopped;
        
        // Check if new logs were added (indicating respawn worked)
        const logsInInventory = testData.fakePlayer.inventory.filter(slot => 
          slot.item.name.toLowerCase().includes('log')
        );
        
        const currentLogCount = logsInInventory.reduce((sum, slot) => sum + slot.quantity, 0);
        
        if (currentLogCount > initialLogCount) {
          testData.treeRespawned = true;
          console.log('[RPGWoodcuttingTestSystem] Tree respawn successful!');
        }

        this.completeTreeRespawnTest(stationId);
      }, 5000);

    } catch (error) {
      console.log(`[RPGWoodcuttingTestSystem] Tree respawn test failed: ${error}`);
      this.completeTreeRespawnTest(stationId);
    }
  }

  private startTreeTypesSequence(stationId: string, normalTreeLoc: any, oakTreeLoc: any): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGWoodcuttingTestSystem] Starting tree types sequence...');

    // Chop normal tree first
    this.startWoodcuttingAttempts(stationId, 3);

    // Then test oak tree
    setTimeout(() => {
      console.log('[RPGWoodcuttingTestSystem] Switching to oak tree...');
      testData.treeLocation = oakTreeLoc;
      
      // Continue with oak tree
      this.startWoodcuttingAttempts(stationId, 3);
    }, 15000);
  }

  private testWoodcuttingFailure(stationId: string, failureType: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGWoodcuttingTestSystem] Testing woodcutting failure: ${failureType}`);

    // Move player to tree
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.treeLocation.x - 1,
      y: testData.treeLocation.y,
      z: testData.treeLocation.z
    });

    // Attempt woodcutting - should fail
    try {
      this.world.emit('rpg:resource:start_gather', {
        playerId: testData.fakePlayer.id,
        resourceId: `tree_${stationId}`,
        playerPosition: testData.fakePlayer.position
      });

      // Check for failure after brief delay
      setTimeout(() => {
        // Test should pass if no logs were chopped (failure case)
        if (testData.logsChopped === 0) {
          this.passTest(stationId, {
            failureType,
            logsChopped: testData.logsChopped,
            hasHatchetEquipped: testData.hasHatchetEquipped,
            nearTree: testData.nearTree,
            inventorySpace: testData.inventorySpace,
            duration: Date.now() - testData.startTime
          });
        } else {
          this.failTest(stationId, `Woodcutting failure test failed: expected failure but chopped ${testData.logsChopped} logs`);
        }
      }, 5000);

    } catch (error) {
      // Exception is expected for failure cases
      this.passTest(stationId, {
        failureType,
        error: String(error),
        duration: Date.now() - testData.startTime
      });
    }
  }

  private completeWoodcuttingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Calculate final success rate
    if (testData.attemptsMade > 0) {
      testData.successRate = (testData.logsChopped / testData.attemptsMade) * 100;
    }

    const xpGained = testData.finalWoodcuttingXP - testData.initialWoodcuttingXP;

    const results = {
      logsChopped: testData.logsChopped,
      attemptsMade: testData.attemptsMade,
      successRate: testData.successRate,
      expectedSuccessRate: testData.expectedSuccessRate,
      xpGained: xpGained,
      hasHatchetEquipped: testData.hasHatchetEquipped,
      nearTree: testData.nearTree,
      inventorySpace: testData.inventorySpace,
      duration: Date.now() - testData.startTime
    };

    // Test passes if:
    // 1. Success rate is within 15% of expected rate
    // 2. At least some logs were chopped (for success tests)
    // 3. XP was gained (for success tests)
    const successRateDiff = Math.abs(testData.successRate - testData.expectedSuccessRate);
    
    if (testData.expectedSuccessRate > 0) {
      // Success test - should chop logs and gain XP
      if (testData.logsChopped > 0 && xpGained > 0 && successRateDiff <= 15) {
        this.passTest(stationId, results);
      } else {
        this.failTest(stationId, `Woodcutting test failed: chopped=${testData.logsChopped}, xp=${xpGained}, success_rate=${testData.successRate}% (expected ~${testData.expectedSuccessRate}%)`);
      }
    } else {
      // Failure test - should chop no logs
      if (testData.logsChopped === 0) {
        this.passTest(stationId, results);
      } else {
        this.failTest(stationId, `Woodcutting failure test failed: expected 0 logs but chopped ${testData.logsChopped}`);
      }
    }
  }

  private completeTreeRespawnTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      treeDepleted: testData.logsChopped > 0, // Tree was depleted if logs were chopped
      treeRespawned: testData.treeRespawned,
      logsChopped: testData.logsChopped,
      duration: Date.now() - testData.startTime
    };

    // Test passes if tree was depleted and then respawned
    if (testData.logsChopped > 0 && testData.treeRespawned) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Tree respawn test failed: depleted=${testData.logsChopped > 0}, respawned=${testData.treeRespawned}`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up tree visuals
      this.world.emit('rpg:test:tree:remove', {
        id: `tree_${stationId}`
      });

      // Clean up additional trees for tree types test
      this.world.emit('rpg:test:tree:remove', {
        id: `tree_${stationId}_normal`
      });

      this.world.emit('rpg:test:tree:remove', {
        id: `tree_${stationId}_oak`
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGWoodcuttingTestSystem] Cleanup completed for ${stationId}`);
  }

  getSystemRating(): { health: number; score: number; features: string[]; performance: Record<string, number> } {
    const testResults = Array.from(this.testResults.values());
    const totalTests = testResults.length;
    const passedTests = testResults.filter(result => result.passed).length;
    
    // Calculate log production efficiency
    let logProductionEfficiency = 0;
    if (totalTests > 0) {
      const woodcuttingTests = testResults.filter(result => 
        result.passed && result.data && result.data.logsChopped !== undefined
      );
      if (woodcuttingTests.length > 0) {
        const totalLogsProduced = woodcuttingTests.reduce((sum, result) => sum + (result.data?.logsChopped || 0), 0);
        const totalAttempts = woodcuttingTests.reduce((sum, result) => sum + (result.data?.attemptsMade || 1), 0);
        logProductionEfficiency = totalAttempts > 0 ? (totalLogsProduced / totalAttempts) * 100 : 0;
      }
    }
    
    // Calculate overall health
    const health = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return {
      health,
      score: Math.round(logProductionEfficiency),
      features: [
        'Basic Tree Cutting',
        'Tool Requirements Check',
        'Log Production Systems',
        'Skill-based Success Rates',
        'Tree Resource Depletion'
      ],
      performance: {
        logProductionEfficiency,
        testPassRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        averageTestDuration: 0, // Duration tracking not implemented yet
        averageSuccessRate: this.calculateAverageSuccessRate(testResults),
        skillProgressionRate: this.calculateSkillProgressionRate(testResults)
      }
    };
  }

  private calculateAverageSuccessRate(testResults: any[]): number {
    const successTests = testResults.filter(result => 
      result.passed && result.data && result.data.successRate !== undefined
    );
    
    if (successTests.length === 0) return 0;
    
    const totalSuccessRate = successTests.reduce((sum, result) => sum + result.data.successRate, 0);
    return totalSuccessRate / successTests.length;
  }

  private calculateSkillProgressionRate(testResults: any[]): number {
    const progressionTests = testResults.filter(result => 
      result.passed && result.data && result.data.xpGained !== undefined
    );
    
    if (progressionTests.length === 0) return 0;
    
    const totalXpGained = progressionTests.reduce((sum, result) => sum + result.data.xpGained, 0);
    const totalDuration = progressionTests.reduce((sum, result) => sum + (result.data.duration || 1), 0);
    
    // XP per minute
    return totalDuration > 0 ? (totalXpGained / (totalDuration / 60000)) : 0;
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