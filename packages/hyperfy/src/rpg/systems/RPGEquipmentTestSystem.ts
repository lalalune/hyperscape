/**
 * RPG Equipment Test System
 * Tests equipment mechanics with fake players and items
 * - Tests equipping weapons, armor, and tools
 * - Tests unequipping and stat changes
 * - Tests level requirements for equipment
 * - Tests equipment bonuses (attack, defense, etc.)
 * - Tests equipment slots (weapon, shield, helmet, body, legs)
 * - Tests equipment conflicts and restrictions
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem, ItemType } from '../data/items';

interface EquipmentTestData {
  fakePlayer: FakePlayer;
  testType: 'basic_equip' | 'stat_changes' | 'level_requirements' | 'equipment_conflicts' | 'comprehensive';
  startTime: number;
  initialStats: { [key: string]: number };
  finalStats: { [key: string]: number };
  itemsEquipped: number;
  itemsUnequipped: number;
  statChangesDetected: number;
  levelRequirementsTested: boolean;
  conflictsTested: boolean;
  testItems: Array<{ itemId: string; slot: string; levelReq: number; expectedBonus: { [key: string]: number } }>;
  equipmentSlotsBefore: { [key: string]: any };
  equipmentSlotsAfter: { [key: string]: any };
}

export class RPGEquipmentTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, EquipmentTestData>();
  private equipmentSystem: any;
  private statsSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGEquipmentTestSystem] Initializing equipment test system...');
    
    // Get required systems
    this.equipmentSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGEquipmentSystem');
    this.statsSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGStatsSystem');
    
    if (!this.equipmentSystem) {
      console.warn('[RPGEquipmentTestSystem] EquipmentSystem not found, tests may not function properly');
    }
    
    if (!this.statsSystem) {
      console.warn('[RPGEquipmentTestSystem] StatsSystem not found, stat change tests may not function properly');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGEquipmentTestSystem] Equipment test system initialized');
  }

  private createTestStations(): void {
    // Basic Equipment Test
    this.createTestStation({
      id: 'basic_equipment_test',
      name: 'Basic Equipment Test',
      position: { x: -80, y: 0, z: 10 },
      timeoutMs: 30000 // 30 seconds
    });

    // Stat Changes Test
    this.createTestStation({
      id: 'stat_changes_test',
      name: 'Stat Changes Test',
      position: { x: -80, y: 0, z: 20 },
      timeoutMs: 25000 // 25 seconds
    });

    // Level Requirements Test
    this.createTestStation({
      id: 'level_requirements_test',
      name: 'Level Requirements Test',
      position: { x: -80, y: 0, z: 30 },
      timeoutMs: 35000 // 35 seconds
    });

    // Equipment Conflicts Test
    this.createTestStation({
      id: 'equipment_conflicts_test',
      name: 'Equipment Conflicts Test',
      position: { x: -80, y: 0, z: 40 },
      timeoutMs: 30000 // 30 seconds
    });

    // Comprehensive Equipment Test
    this.createTestStation({
      id: 'comprehensive_equipment_test',
      name: 'Full Equipment Test',
      position: { x: -80, y: 0, z: 50 },
      timeoutMs: 60000 // 60 seconds for full test
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_equipment_test':
        this.runBasicEquipmentTest(stationId);
        break;
      case 'stat_changes_test':
        this.runStatChangesTest(stationId);
        break;
      case 'level_requirements_test':
        this.runLevelRequirementsTest(stationId);
        break;
      case 'equipment_conflicts_test':
        this.runEquipmentConflictsTest(stationId);
        break;
      case 'comprehensive_equipment_test':
        this.runComprehensiveEquipmentTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown equipment test: ${stationId}`);
    }
  }

  private async runBasicEquipmentTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGEquipmentTestSystem] Starting basic equipment test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with basic stats
      const fakePlayer = this.createFakePlayer({
        id: `basic_equip_player_${Date.now()}`,
        name: 'Basic Equipment Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 10,
          strength: 10,
          defense: 10,
          ranged: 10,
          constitution: 10,
          health: 100,
          maxHealth: 100,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 100,
          maxStamina: 100
        }
      });

      // Give player basic equipment to test
      const bronzeSword = getItem('bronze_sword');
      const bronzeShield = getItem('bronze_shield');
      const leatherHelmet = getItem('leather_helmet');

      if (bronzeSword && bronzeShield && leatherHelmet) {
        fakePlayer.inventory = [
          { item: bronzeSword, quantity: 1 },
          { item: bronzeShield, quantity: 1 },
          { item: leatherHelmet, quantity: 1 }
        ];
      }

      // Test items with expected bonuses
      const testItems: Array<{ itemId: string; slot: string; levelReq: number; expectedBonus: { [key: string]: number } }> = [
        { 
          itemId: 'bronze_sword', 
          slot: 'weapon', 
          levelReq: 1, 
          expectedBonus: { attack: 5, strength: 3 } 
        },
        { 
          itemId: 'bronze_shield', 
          slot: 'shield', 
          levelReq: 1, 
          expectedBonus: { defense: 4 } 
        },
        { 
          itemId: 'leather_helmet', 
          slot: 'helmet', 
          levelReq: 1, 
          expectedBonus: { defense: 2 } 
        }
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'basic_equip',
        startTime: Date.now(),
        initialStats: { ...fakePlayer.stats },
        finalStats: {},
        itemsEquipped: 0,
        itemsUnequipped: 0,
        statChangesDetected: 0,
        levelRequirementsTested: false,
        conflictsTested: false,
        testItems,
        equipmentSlotsBefore: { ...fakePlayer.equipment },
        equipmentSlotsAfter: {}
      });

      // Create equipment display visual
      this.createEquipmentDisplay(stationId, station.position, 'basic_equipment');

      // Start basic equipment sequence
      this.startBasicEquipmentSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic equipment test error: ${error}`);
    }
  }

  private async runStatChangesTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGEquipmentTestSystem] Starting stat changes test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with precise stats for change detection
      const fakePlayer = this.createFakePlayer({
        id: `stat_player_${Date.now()}`,
        name: 'Stat Changes Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 15,
          strength: 12,
          defense: 8,
          ranged: 10,
          constitution: 15,
          health: 150,
          maxHealth: 150,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 100,
          maxStamina: 100
        }
      });

      // Give player equipment with significant stat bonuses
      const steelSword = getItem('steel_sword');
      const steelHelmet = getItem('steel_helmet');
      const steelBody = getItem('steel_body');

      if (steelSword && steelHelmet && steelBody) {
        fakePlayer.inventory = [
          { item: steelSword, quantity: 1 },
          { item: steelHelmet, quantity: 1 },
          { item: steelBody, quantity: 1 }
        ];
      }

      const testItems: Array<{ itemId: string; slot: string; levelReq: number; expectedBonus: { [key: string]: number } }> = [
        { 
          itemId: 'steel_sword', 
          slot: 'weapon', 
          levelReq: 10, 
          expectedBonus: { attack: 8, strength: 6 } 
        },
        { 
          itemId: 'steel_helmet', 
          slot: 'helmet', 
          levelReq: 10, 
          expectedBonus: { defense: 5 } 
        },
        { 
          itemId: 'steel_body', 
          slot: 'body', 
          levelReq: 10, 
          expectedBonus: { defense: 8 } 
        }
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'stat_changes',
        startTime: Date.now(),
        initialStats: { ...fakePlayer.stats },
        finalStats: {},
        itemsEquipped: 0,
        itemsUnequipped: 0,
        statChangesDetected: 0,
        levelRequirementsTested: false,
        conflictsTested: false,
        testItems,
        equipmentSlotsBefore: { ...fakePlayer.equipment },
        equipmentSlotsAfter: {}
      });

      this.createEquipmentDisplay(stationId, station.position, 'stat_bonuses');

      // Start stat changes sequence
      this.startStatChangesSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Stat changes test error: ${error}`);
    }
  }

  private async runLevelRequirementsTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGEquipmentTestSystem] Starting level requirements test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create LOW-level fake player to test requirements blocking
      const fakePlayer = this.createFakePlayer({
        id: `level_req_player_${Date.now()}`,
        name: 'Low Level Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 3,  // Too low for higher tier equipment
          strength: 3,
          defense: 2,
          ranged: 2,
          constitution: 5,
          health: 50,
          maxHealth: 50
        }
      });

      // Give player high-level equipment they shouldn't be able to equip
      const mithrilSword = getItem('mithril_sword');
      const mithrilHelmet = getItem('mithril_helmet');
      const bronzeSword = getItem('bronze_sword'); // They CAN equip this

      if (mithrilSword && mithrilHelmet && bronzeSword) {
        fakePlayer.inventory = [
          { item: mithrilSword, quantity: 1 },    // Requires level 20
          { item: mithrilHelmet, quantity: 1 },   // Requires level 20
          { item: bronzeSword, quantity: 1 }      // Requires level 1 (OK)
        ];
      }

      const testItems: Array<{ itemId: string; slot: string; levelReq: number; expectedBonus: { [key: string]: number } }> = [
        { 
          itemId: 'mithril_sword', 
          slot: 'weapon', 
          levelReq: 20, 
          expectedBonus: { attack: 12, strength: 8 } 
        },
        { 
          itemId: 'mithril_helmet', 
          slot: 'helmet', 
          levelReq: 20, 
          expectedBonus: { defense: 8 } 
        },
        { 
          itemId: 'bronze_sword', 
          slot: 'weapon', 
          levelReq: 1, 
          expectedBonus: { attack: 5, strength: 3 } 
        }
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'level_requirements',
        startTime: Date.now(),
        initialStats: { ...fakePlayer.stats },
        finalStats: {},
        itemsEquipped: 0,
        itemsUnequipped: 0,
        statChangesDetected: 0,
        levelRequirementsTested: true,
        conflictsTested: false,
        testItems,
        equipmentSlotsBefore: { ...fakePlayer.equipment },
        equipmentSlotsAfter: {}
      });

      this.createEquipmentDisplay(stationId, station.position, 'level_requirements');

      // Start level requirements sequence
      this.startLevelRequirementsSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Level requirements test error: ${error}`);
    }
  }

  private async runEquipmentConflictsTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGEquipmentTestSystem] Starting equipment conflicts test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for conflict testing
      const fakePlayer = this.createFakePlayer({
        id: `conflict_player_${Date.now()}`,
        name: 'Conflict Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 20,
          strength: 20,
          defense: 20,
          ranged: 20,
          constitution: 20,
          health: 200,
          maxHealth: 200
        }
      });

      // Give player conflicting equipment (2-handed weapon + shield)
      const steelSword = getItem('steel_sword');
      const bronzeShield = getItem('bronze_shield');
      const woodBow = getItem('wood_bow');
      const arrows = getItem('arrows');

      if (steelSword && bronzeShield && woodBow && arrows) {
        fakePlayer.inventory = [
          { item: steelSword, quantity: 1 },
          { item: bronzeShield, quantity: 1 },
          { item: woodBow, quantity: 1 },
          { item: arrows, quantity: 50 }
        ];
      }

      const testItems: Array<{ itemId: string; slot: string; levelReq: number; expectedBonus: { [key: string]: number } }> = [
        { 
          itemId: 'steel_sword', 
          slot: 'weapon', 
          levelReq: 10, 
          expectedBonus: { attack: 8, strength: 6 } 
        },
        { 
          itemId: 'bronze_shield', 
          slot: 'shield', 
          levelReq: 1, 
          expectedBonus: { defense: 4 } 
        },
        { 
          itemId: 'wood_bow', 
          slot: 'weapon', 
          levelReq: 1, 
          expectedBonus: { ranged: 5 } 
        }
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'equipment_conflicts',
        startTime: Date.now(),
        initialStats: { ...fakePlayer.stats },
        finalStats: {},
        itemsEquipped: 0,
        itemsUnequipped: 0,
        statChangesDetected: 0,
        levelRequirementsTested: false,
        conflictsTested: true,
        testItems,
        equipmentSlotsBefore: { ...fakePlayer.equipment },
        equipmentSlotsAfter: {}
      });

      this.createEquipmentDisplay(stationId, station.position, 'equipment_conflicts');

      // Start conflicts sequence
      this.startConflictsSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Equipment conflicts test error: ${error}`);
    }
  }

  private async runComprehensiveEquipmentTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGEquipmentTestSystem] Starting comprehensive equipment test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with mid-level stats
      const fakePlayer = this.createFakePlayer({
        id: `comprehensive_equip_player_${Date.now()}`,
        name: 'Comprehensive Equipment Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 15,
          strength: 15,
          defense: 15,
          ranged: 15,
          constitution: 15,
          health: 150,
          maxHealth: 150,
          woodcutting: 1,
          fishing: 1,
          firemaking: 1,
          cooking: 1,
          stamina: 100,
          maxStamina: 100
        }
      });

      // Give player full set of equipment
      const steelSword = getItem('steel_sword');
      const steelShield = getItem('steel_shield');
      const steelHelmet = getItem('steel_helmet');
      const steelBody = getItem('steel_body');
      const woodBow = getItem('wood_bow');
      const arrows = getItem('arrows');

      if (steelSword && steelShield && steelHelmet && steelBody && woodBow && arrows) {
        fakePlayer.inventory = [
          { item: steelSword, quantity: 1 },
          { item: steelShield, quantity: 1 },
          { item: steelHelmet, quantity: 1 },
          { item: steelBody, quantity: 1 },
          { item: woodBow, quantity: 1 },
          { item: arrows, quantity: 100 }
        ];
      }

      const testItems: Array<{ itemId: string; slot: string; levelReq: number; expectedBonus: { [key: string]: number } }> = [
        { itemId: 'steel_sword', slot: 'weapon', levelReq: 10, expectedBonus: { attack: 8, strength: 6 } },
        { itemId: 'steel_shield', slot: 'shield', levelReq: 10, expectedBonus: { defense: 6 } },
        { itemId: 'steel_helmet', slot: 'helmet', levelReq: 10, expectedBonus: { defense: 5 } },
        { itemId: 'steel_body', slot: 'body', levelReq: 10, expectedBonus: { defense: 8 } },
        { itemId: 'wood_bow', slot: 'weapon', levelReq: 1, expectedBonus: { ranged: 5 } }
      ];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testType: 'comprehensive',
        startTime: Date.now(),
        initialStats: { ...fakePlayer.stats },
        finalStats: {},
        itemsEquipped: 0,
        itemsUnequipped: 0,
        statChangesDetected: 0,
        levelRequirementsTested: true,
        conflictsTested: true,
        testItems,
        equipmentSlotsBefore: { ...fakePlayer.equipment },
        equipmentSlotsAfter: {}
      });

      this.createEquipmentDisplay(stationId, station.position, 'comprehensive_equipment');

      // Start comprehensive sequence
      this.startComprehensiveSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Comprehensive equipment test error: ${error}`);
    }
  }

  private createEquipmentDisplay(stationId: string, position: { x: number; y: number; z: number }, displayType: string): void {
    const displayColors = {
      'basic_equipment': '#8b4513',         // Brown
      'stat_bonuses': '#4169e1',           // Royal blue
      'level_requirements': '#dc143c',      // Crimson red
      'equipment_conflicts': '#ff8c00',     // Dark orange
      'comprehensive_equipment': '#9370db'  // Medium purple
    };

    // Create equipment rack visual
    this.world.emit('rpg:test:equipment_rack:create', {
      id: `equipment_rack_${stationId}`,
      position: { x: position.x + 3, y: position.y, z: position.z },
      color: displayColors[displayType] || '#8b4513',
      size: { x: 1.5, y: 2, z: 0.5 },
      type: displayType
    });

    // Create equipment slots visual
    const slots = ['weapon', 'shield', 'helmet', 'body', 'legs'];
    slots.forEach((slot, index) => {
      this.world.emit('rpg:test:equipment_slot:create', {
        id: `equipment_slot_${slot}_${stationId}`,
        position: { 
          x: position.x + 3 + (index * 0.3), 
          y: position.y + 1.5, 
          z: position.z + 0.3 
        },
        color: '#cccccc', // Light gray for empty slots
        size: { x: 0.2, y: 0.2, z: 0.1 },
        slot: slot
      });
    });
  }

  private startBasicEquipmentSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGEquipmentTestSystem] Starting basic equipment sequence...');

    let itemIndex = 0;

    const equipNextItem = async () => {
      if (itemIndex >= testData.testItems.length) {
        // All items equipped, now test unequipping
        setTimeout(() => this.startUnequipSequence(stationId), 2000);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      console.log(`[RPGEquipmentTestSystem] Attempting to equip ${testItem.itemId}`);

      if (this.equipmentSystem) {
        const success = await this.equipmentSystem.equipItem(
          testData.fakePlayer.id,
          testItem.itemId
        );

        if (success) {
          testData.itemsEquipped++;
          console.log(`[RPGEquipmentTestSystem] Successfully equipped ${testItem.itemId}`);

          // Update fake player equipment state
          testData.fakePlayer.equipment[testItem.slot] = getItem(testItem.itemId);

          // Update equipment slot visual
          this.world.emit('rpg:test:equipment_slot:update', {
            id: `equipment_slot_${testItem.slot}_${stationId}`,
            color: '#00ff00', // Green for equipped
            itemId: testItem.itemId
          });
        } else {
          console.log(`[RPGEquipmentTestSystem] Failed to equip ${testItem.itemId}`);
        }
      }

      itemIndex++;
      setTimeout(equipNextItem, 2000);
    };

    // Start equipping sequence
    setTimeout(equipNextItem, 1000);
  }

  private startUnequipSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGEquipmentTestSystem] Starting unequip sequence...');

    let itemIndex = 0;

    const unequipNextItem = async () => {
      if (itemIndex >= testData.testItems.length) {
        // All items unequipped
        this.completeBasicEquipmentTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      console.log(`[RPGEquipmentTestSystem] Attempting to unequip ${testItem.itemId}`);

      if (this.equipmentSystem) {
        const success = await this.equipmentSystem.unequipItem(
          testData.fakePlayer.id,
          testItem.slot
        );

        if (success) {
          testData.itemsUnequipped++;
          console.log(`[RPGEquipmentTestSystem] Successfully unequipped ${testItem.itemId}`);

          // Update fake player equipment state
          testData.fakePlayer.equipment[testItem.slot] = null;

          // Update equipment slot visual
          this.world.emit('rpg:test:equipment_slot:update', {
            id: `equipment_slot_${testItem.slot}_${stationId}`,
            color: '#cccccc', // Gray for empty
            itemId: null
          });
        } else {
          console.log(`[RPGEquipmentTestSystem] Failed to unequip ${testItem.itemId}`);
        }
      }

      itemIndex++;
      setTimeout(unequipNextItem, 1500);
    };

    // Start unequipping sequence
    setTimeout(unequipNextItem, 1000);
  }

  private startStatChangesSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGEquipmentTestSystem] Starting stat changes sequence...');

    let itemIndex = 0;

    const equipAndCheckStats = async () => {
      if (itemIndex >= testData.testItems.length) {
        this.completeStatChangesTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      
      // Record stats before equipping
      const statsBefore = { ...testData.fakePlayer.stats };
      
      console.log(`[RPGEquipmentTestSystem] Stats before equipping ${testItem.itemId}:`, statsBefore);

      if (this.equipmentSystem) {
        const success = await this.equipmentSystem.equipItem(
          testData.fakePlayer.id,
          testItem.itemId
        );

        if (success) {
          testData.itemsEquipped++;

          // Check stats after equipping
          setTimeout(async () => {
            const statsAfter = this.statsSystem 
              ? await this.statsSystem.getPlayerStats(testData.fakePlayer.id)
              : testData.fakePlayer.stats;

            console.log(`[RPGEquipmentTestSystem] Stats after equipping ${testItem.itemId}:`, statsAfter);

            // Detect stat changes
            for (const [stat, expectedBonus] of Object.entries(testItem.expectedBonus)) {
              const expectedValue = statsBefore[stat] + expectedBonus;
              if (Math.abs(statsAfter[stat] - expectedValue) < 0.1) { // Allow small rounding errors
                testData.statChangesDetected++;
                console.log(`[RPGEquipmentTestSystem] Detected expected ${stat} change: ${statsBefore[stat]} -> ${statsAfter[stat]} (expected +${expectedBonus})`);
              } else {
                console.log(`[RPGEquipmentTestSystem] Stat change mismatch for ${stat}: expected ${expectedValue}, got ${statsAfter[stat]}`);
              }
            }

            // Update fake player stats
            testData.fakePlayer.stats = { ...statsAfter };
          }, 500);
        }
      }

      itemIndex++;
      setTimeout(equipAndCheckStats, 3000);
    };

    // Start stat checking sequence
    setTimeout(equipAndCheckStats, 1000);
  }

  private startLevelRequirementsSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGEquipmentTestSystem] Starting level requirements sequence...');

    let itemIndex = 0;

    const testLevelRequirement = async () => {
      if (itemIndex >= testData.testItems.length) {
        this.completeLevelRequirementsTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      const playerLevel = testData.fakePlayer.stats.attack; // Use attack level for weapons
      
      console.log(`[RPGEquipmentTestSystem] Testing ${testItem.itemId} (req: ${testItem.levelReq}, player: ${playerLevel})`);

      if (this.equipmentSystem) {
        const success = await this.equipmentSystem.equipItem(
          testData.fakePlayer.id,
          testItem.itemId
        );

        const shouldSucceed = playerLevel >= testItem.levelReq;
        
        if (success === shouldSucceed) {
          console.log(`[RPGEquipmentTestSystem] Level requirement test passed for ${testItem.itemId}: success=${success}, should=${shouldSucceed}`);
          if (success) testData.itemsEquipped++;
        } else {
          console.log(`[RPGEquipmentTestSystem] Level requirement test FAILED for ${testItem.itemId}: success=${success}, should=${shouldSucceed}`);
        }
      }

      itemIndex++;
      setTimeout(testLevelRequirement, 2500);
    };

    // Start level requirement testing
    setTimeout(testLevelRequirement, 1000);
  }

  private startConflictsSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGEquipmentTestSystem] Starting equipment conflicts sequence...');

    // Test sequence: equip sword, then shield (should work), then bow (should unequip sword)
    setTimeout(async () => {
      // Equip sword first
      console.log('[RPGEquipmentTestSystem] Equipping sword...');
      if (this.equipmentSystem) {
        const swordSuccess = await this.equipmentSystem.equipItem(testData.fakePlayer.id, 'steel_sword');
        if (swordSuccess) {
          testData.itemsEquipped++;
          testData.fakePlayer.equipment.weapon = getItem('steel_sword');
        }
      }
    }, 1000);

    setTimeout(async () => {
      // Equip shield (should work with sword)
      console.log('[RPGEquipmentTestSystem] Equipping shield...');
      if (this.equipmentSystem) {
        const shieldSuccess = await this.equipmentSystem.equipItem(testData.fakePlayer.id, 'bronze_shield');
        if (shieldSuccess) {
          testData.itemsEquipped++;
          testData.fakePlayer.equipment.shield = getItem('bronze_shield');
        }
      }
    }, 4000);

    setTimeout(async () => {
      // Equip bow (should unequip sword and shield for 2-handed weapon)
      console.log('[RPGEquipmentTestSystem] Equipping bow (should cause conflicts)...');
      if (this.equipmentSystem) {
        const bowSuccess = await this.equipmentSystem.equipItem(testData.fakePlayer.id, 'wood_bow');
        if (bowSuccess) {
          testData.itemsEquipped++;
          // Check if sword/shield were automatically unequipped
          const weaponStillEquipped = testData.fakePlayer.equipment.weapon?.id === 'steel_sword';
          const shieldStillEquipped = testData.fakePlayer.equipment.shield?.id === 'bronze_shield';
          
          if (!weaponStillEquipped || !shieldStillEquipped) {
            console.log('[RPGEquipmentTestSystem] Conflict resolution worked - previous equipment unequipped');
            testData.statChangesDetected++; // Use this counter for conflict detection
          }

          testData.fakePlayer.equipment.weapon = getItem('wood_bow');
          testData.fakePlayer.equipment.shield = null;
        }
      }

      this.completeConflictsTest(stationId);
    }, 7000);
  }

  private startComprehensiveSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGEquipmentTestSystem] Starting comprehensive equipment sequence...');

    // Phase 1: Equip melee gear (5-15 seconds)
    setTimeout(async () => {
      console.log('[RPGEquipmentTestSystem] Phase 1: Equipping melee gear...');
      
      const meleeItems = ['steel_sword', 'steel_shield', 'steel_helmet'];
      for (const itemId of meleeItems) {
        if (this.equipmentSystem) {
          const success = await this.equipmentSystem.equipItem(testData.fakePlayer.id, itemId);
          if (success) {
            testData.itemsEquipped++;
            const item = getItem(itemId);
            if (item) {
              const slot = item.type === ItemType.WEAPON ? 'weapon' : 
                          item.type === ItemType.ARMOR && item.armorSlot ? item.armorSlot : 'shield';
              testData.fakePlayer.equipment[slot] = item;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }, 2000);

    // Phase 2: Switch to ranged gear (20-30 seconds)
    setTimeout(async () => {
      console.log('[RPGEquipmentTestSystem] Phase 2: Switching to ranged gear...');
      
      // Unequip weapon and shield
      if (this.equipmentSystem) {
        await this.equipmentSystem.unequipItem(testData.fakePlayer.id, 'weapon');
        await this.equipmentSystem.unequipItem(testData.fakePlayer.id, 'shield');
        testData.itemsUnequipped += 2;
      }

      // Equip bow and arrows
      setTimeout(async () => {
        if (this.equipmentSystem) {
          const bowSuccess = await this.equipmentSystem.equipItem(testData.fakePlayer.id, 'wood_bow');
          const arrowSuccess = await this.equipmentSystem.equipItem(testData.fakePlayer.id, 'arrows');
          
          if (bowSuccess) testData.itemsEquipped++;
          if (arrowSuccess) testData.itemsEquipped++;
        }
      }, 2000);
    }, 20000);

    // Phase 3: Full armor set (35-45 seconds)
    setTimeout(async () => {
      console.log('[RPGEquipmentTestSystem] Phase 3: Equipping full armor set...');
      
      if (this.equipmentSystem) {
        const bodySuccess = await this.equipmentSystem.equipItem(testData.fakePlayer.id, 'steel_body');
        if (bodySuccess) {
          testData.itemsEquipped++;
          testData.fakePlayer.equipment.body = getItem('steel_body');
        }
      }

      this.completeComprehensiveTest(stationId);
    }, 35000);
  }

  private completeBasicEquipmentTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsEquipped: testData.itemsEquipped,
      itemsUnequipped: testData.itemsUnequipped,
      expectedEquips: testData.testItems.length,
      expectedUnequips: testData.testItems.length,
      duration: Date.now() - testData.startTime
    };

    if (testData.itemsEquipped >= testData.testItems.length * 0.8 && 
        testData.itemsUnequipped >= testData.testItems.length * 0.8) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Basic equipment test failed: equipped=${testData.itemsEquipped}/${testData.testItems.length}, unequipped=${testData.itemsUnequipped}/${testData.testItems.length}`);
    }
  }

  private completeStatChangesTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Calculate total expected stat changes
    const totalExpectedChanges = testData.testItems.reduce((sum, item) => 
      sum + Object.keys(item.expectedBonus).length, 0
    );

    const results = {
      statChangesDetected: testData.statChangesDetected,
      totalExpectedChanges: totalExpectedChanges,
      itemsEquipped: testData.itemsEquipped,
      changeRate: totalExpectedChanges > 0 ? (testData.statChangesDetected / totalExpectedChanges) : 0,
      duration: Date.now() - testData.startTime
    };

    if (testData.statChangesDetected >= totalExpectedChanges * 0.75) { // 75% of expected changes
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Stat changes test failed: detected ${testData.statChangesDetected}/${totalExpectedChanges} expected changes`);
    }
  }

  private completeLevelRequirementsTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Should only equip bronze sword (level 1), not mithril items (level 20)
    const results = {
      itemsEquipped: testData.itemsEquipped,
      expectedEquips: 1, // Only bronze sword should equip
      totalItems: testData.testItems.length,
      levelRequirementsEnforced: testData.itemsEquipped <= 1,
      duration: Date.now() - testData.startTime
    };

    if (results.levelRequirementsEnforced) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Level requirements test failed: equipped ${testData.itemsEquipped} items (expected ≤1)`);
    }
  }

  private completeConflictsTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsEquipped: testData.itemsEquipped,
      conflictsDetected: testData.statChangesDetected, // Repurposed counter
      conflictResolutionWorked: testData.statChangesDetected > 0,
      duration: Date.now() - testData.startTime
    };

    if (results.conflictResolutionWorked && testData.itemsEquipped >= 2) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Equipment conflicts test failed: conflicts=${results.conflictsDetected}, equipped=${testData.itemsEquipped}`);
    }
  }

  private completeComprehensiveTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsEquipped: testData.itemsEquipped,
      itemsUnequipped: testData.itemsUnequipped,
      totalOperations: testData.itemsEquipped + testData.itemsUnequipped,
      expectedMinOperations: 8, // Minimum successful operations
      duration: Date.now() - testData.startTime
    };

    if (results.totalOperations >= results.expectedMinOperations) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Comprehensive equipment test failed: total operations=${results.totalOperations} (expected ≥${results.expectedMinOperations})`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up equipment display visuals
      this.world.emit('rpg:test:equipment_rack:remove', {
        id: `equipment_rack_${stationId}`
      });

      // Clean up equipment slots
      const slots = ['weapon', 'shield', 'helmet', 'body', 'legs'];
      slots.forEach(slot => {
        this.world.emit('rpg:test:equipment_slot:remove', {
          id: `equipment_slot_${slot}_${stationId}`
        });
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGEquipmentTestSystem] Cleanup completed for ${stationId}`);
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
    
    // Check for advanced equipment features
    const hasBasicEquip = this.testStations.has('basic_equipment_test');
    const hasStatChanges = this.testStations.has('stat_changes_test');
    const hasLevelRequirements = this.testStations.has('level_requirements_test');
    const hasEquipmentConflicts = this.testStations.has('equipment_conflicts_test');
    const hasComprehensiveTest = this.testStations.has('comprehensive_equipment_test');
    
    const advancedFeatureCount = [
      hasBasicEquip, hasStatChanges, hasLevelRequirements, hasEquipmentConflicts, hasComprehensiveTest
    ].filter(Boolean).length;
    
    // Check equipment performance with real validation
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.itemsEquipped > 0) {
        // Equipment performance validation logic
        const equipmentEfficiency = testData.itemsEquipped / (testData.itemsEquipped + testData.itemsUnequipped);
        if (equipmentEfficiency > 0.7) { // At least 70% successful equipment operations
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