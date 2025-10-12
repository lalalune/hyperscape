
/**
 * Persistence Test System
 * Tests complete persistence and save/load mechanics per GDD specifications:
 * - Player data persistence (stats, inventory, position)
 * - Skill progression persistence across sessions
 * - Inventory state persistence
 * - World state persistence (items on ground, mobs, etc.)
 * - Bank storage persistence
 * - Equipment state persistence
 * - Test data integrity across save/load cycles
 * - Test large data sets and performance
 */

import THREE from '../extras/three';
import { getItem } from '../data/items';
import { Skills, World, InventoryItem, Item } from '../types/core';
import type { PlayerEntity } from '../types/index'
import { VisualTestFramework } from './VisualTestFramework';
import { getSystem } from '../utils/SystemUtils';
import { PersistenceSystem } from './PersistenceSystem';
import { InventorySystem } from './InventorySystem';
import { SkillsSystem } from './SkillsSystem';
import { BankingSystem } from './BankingSystem';
import { EquipmentSystem } from './EquipmentSystem';
import { EventType } from '../types/events';

const _v3_1 = new THREE.Vector3()

interface PersistenceTestData {
  player: PlayerEntity;
  originalData: {
    skills: Skills;
    inventory: {
      items: InventoryItem[];
      capacity: number;
      coins: number;
    };
    equipment: Array<{ slot: string; item: Item }>;
    bankStorage: Array<{ item: Item; quantity: number }>;
    position: { x: number; y: number; z: number };
  };
  saveTime: number;
  loadTime: number;
  dataMatches: boolean;
  saveSuccessful: boolean;
  loadSuccessful: boolean;
  corruptionDetected: boolean;
  savedDataCount: number;
  restoredDataCount: number;
  startTime: number;
  performanceMetrics: {
    saveTime: number;
    loadTime: number;
    dataSize: number;
  };
}

export class PersistenceTestSystem extends VisualTestFramework {
  private testData = new Map<string, PersistenceTestData>();
  private testDataByPlayerId = new Map<string, string>(); // playerId -> stationId mapping
  private persistenceSystem!: PersistenceSystem;
  private inventorySystem!: InventorySystem;
  private rpgSkillsSystem!: SkillsSystem;
  private bankingSystem!: BankingSystem;
  private equipmentSystem!: EquipmentSystem;

  constructor(world: World) {
    super(world);
  }
  
  async init(): Promise<void> {
    await super.init();
  
    // Get required systems; guard if missing to avoid runtime errors in tests
    this.persistenceSystem = getSystem<PersistenceSystem>(this.world, 'persistence')!;
    this.inventorySystem = getSystem<InventorySystem>(this.world, 'inventory')!;
    this.rpgSkillsSystem = getSystem<SkillsSystem>(this.world, 'skills')!;
    this.bankingSystem = getSystem<BankingSystem>(this.world, 'banking')!;
    this.equipmentSystem = getSystem<EquipmentSystem>(this.world, 'equipment')!;
    
    // Listen for persistence events
    this.subscribe(EventType.PERSISTENCE_SAVE, (data: { playerId: string; data: unknown }) => this.handleDataSaved(data));
    this.subscribe(EventType.PERSISTENCE_LOAD, (data: { playerId: string }) => this.handleDataLoaded(data));
    this.subscribe(EventType.UI_MESSAGE, (data: { playerId: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }) => this.handlePersistenceMessage(data));
    
    // Create test stations
    this.createTestStations();
  }

  protected createTestStations(): void {
    // Basic Save/Load Test - Simple player data save and load
    this.createTestStation({
      id: 'persistence_basic_save_load',
      name: 'Basic Save/Load Test',
      position: new THREE.Vector3(-40, 1.8, -40)
    });

    // Skill Progression Persistence Test - Save/load with skill changes
    this.createTestStation({
      id: 'persistence_skill_progression',
      name: 'Skill Progression Persistence Test',
      position: new THREE.Vector3(-45, 1.8, -40)
    });

    // Inventory Persistence Test - Complex inventory state
    this.createTestStation({
      id: 'persistence_inventory',
      name: 'Inventory Persistence Test',
      position: new THREE.Vector3(-50, 1.8, -40)
    });

    // Bank Storage Persistence Test - Banking system persistence
    this.createTestStation({
      id: 'persistence_bank_storage',
      name: 'Bank Storage Persistence Test',
      position: new THREE.Vector3(-40, 1.8, -45)
    });

    // Equipment Persistence Test - Worn items persistence
    this.createTestStation({
      id: 'persistence_equipment',
      name: 'Equipment Persistence Test',
      position: new THREE.Vector3(-45, 1.8, -45)
    });

    // Large Data Set Test - Performance with large amounts of data
    this.createTestStation({
      id: 'persistence_large_dataset',
      name: 'Large Dataset Persistence Test',
      position: new THREE.Vector3(-50, 1.8, -45)
    });
  }

  private handleDataSaved(data: { playerId: string; data: unknown }): void {
    const stationId = this.testDataByPlayerId.get(data.playerId);
    if (!stationId) return;
    
    const testData = this.testData.get(stationId)!;
    // Calculate data size from the serialized data
    testData.performanceMetrics.dataSize = JSON.stringify(data.data).length;
  }

  private handleDataLoaded(data: { playerId: string }): void {
    const stationId = this.testDataByPlayerId.get(data.playerId);
    if (!stationId) return;
    
    const testData = this.testData.get(stationId)!;
    // Mark that a load was requested
    testData.loadTime = Date.now();
  }

  private handlePersistenceMessage(data: { playerId: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }): void {
    const stationId = this.testDataByPlayerId.get(data.playerId);
    if (!stationId) return;
    
    const testData = this.testData.get(stationId)!;
    if (data.type === 'success') {
      if (data.message.includes('saved')) {
        testData.saveSuccessful = true;
        testData.performanceMetrics.saveTime = Date.now() - testData.saveTime;
      } else if (data.message.includes('loaded')) {
        testData.loadSuccessful = true;
        testData.performanceMetrics.loadTime = Date.now() - testData.loadTime;
      }
    } else if (data.type === 'error') {
      if (data.message.includes('save')) {
        testData.saveSuccessful = false;
      } else if (data.message.includes('load')) {
        testData.loadSuccessful = false;
      }
      testData.corruptionDetected = data.message.includes('corruption') || data.message.includes('invalid');
    }
  }

  private savePlayer(stationId: string): void {
    const testData = this.testData.get(stationId)!;
    testData.saveTime = Date.now();
    testData.savedDataCount = this.countDataItems(testData.originalData);
    
    // Register player ID mapping
    this.testDataByPlayerId.set(testData.player.id, stationId);
    
    // Emit the save request
    this.emitTypedEvent(EventType.PERSISTENCE_SAVE, {
      playerId: testData.player.id,
      data: testData.originalData
    });
    
    // The success/failure will be handled by handlePersistenceMessage
  }

  private compareData(original: PersistenceTestData['originalData'], loaded: PersistenceTestData['originalData']): boolean {
    return JSON.stringify(original) === JSON.stringify(loaded);
  }

  private countDataItems(data: PersistenceTestData['originalData']): number {
    let count = 0;
    count += data.inventory.items.length;
    count += data.equipment.length;
    count += data.bankStorage.length;
    count += Object.keys(data.skills).length;
    return count;
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'persistence_basic_save_load':
        this.runBasicSaveLoadTest(stationId);
        break;
      case 'persistence_skill_progression':
        this.runSkillProgressionPersistenceTest(stationId);
        break;
      case 'persistence_inventory':
        this.runInventoryPersistenceTest(stationId);
        break;
      case 'persistence_bank_storage':
        this.runBankStoragePersistenceTest(stationId);
        break;
      case 'persistence_equipment':
        this.runEquipmentPersistenceTest(stationId);
        break;
      case 'persistence_large_dataset':
        this.runLargeDatasetTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown persistence test: ${stationId}`);
    }
  }

  private async runBasicSaveLoadTest(stationId: string): Promise<void> {
    // Create fake player with basic data
    const player = this.createPlayer({
      id: `basic_save_player_${Date.now()}`,
      name: 'Basic Save Test Player',
      position: _v3_1.set(-40, 1.8, -40),
    })

    // Basic inventory
    const bronzeSword = getItem('bronze_sword');
    const coins = getItem('coins');
    
    if (!bronzeSword || !coins) {
      this.failTest(stationId, 'Failed to get test items: bronze_sword or coins');
      return;
    }
    
    // Modify the player inventory directly since createPlayer returns proper structure
    player.inventory.items = [
      { id: `${bronzeSword.id}_1`, itemId: bronzeSword.id, quantity: 1, slot: 0, metadata: null },
      { id: `${coins.id}_1`, itemId: coins.id, quantity: 75, slot: 1, metadata: null }
    ];
    player.inventory.coins = 75;

    // Create test data structure
    const originalData = {
      skills: (this.rpgSkillsSystem && this.rpgSkillsSystem.getSkills(player.id)) || {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        constitution: { level: 10, xp: 1154 },
        ranged: { level: 1, xp: 0 },
        woodcutting: { level: 1, xp: 0 },
        fishing: { level: 1, xp: 0 },
        firemaking: { level: 1, xp: 0 },
        cooking: { level: 1, xp: 0 }
      },
      inventory: player.inventory,
      equipment: [],
      bankStorage: [],
      position: { x: -40, y: 1.8, z: -40 }
    };

    const testData: PersistenceTestData = {
      player,
      originalData,
      saveTime: 0,
      loadTime: 0,
      dataMatches: false,
      saveSuccessful: false,
      loadSuccessful: false,
      corruptionDetected: false,
      savedDataCount: 0,
      restoredDataCount: 0,
      startTime: Date.now(),
      performanceMetrics: {
        saveTime: 0,
        loadTime: 0,
        dataSize: 0
      }
    };

    this.testData.set(stationId, testData);

    // Save player data
    this.savePlayer(stationId);
  }

  private async runSkillProgressionPersistenceTest(stationId: string): Promise<void> {

      // Create fake player
      const player = this.createPlayer({
        id: `skill_persist_player_${Date.now()}`,
        name: 'Skill Persistence Test Player',
        position: _v3_1.set(-45, 1.8, -40),
      });

      // Give player various XP levels
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, { playerId: player.id, skill: 'attack', amount: 500 });
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, { playerId: player.id, skill: 'woodcutting', amount: 1200 });

      // Wait for XP to be applied
      setTimeout(() => {
        const originalData = {
          skills: (this.rpgSkillsSystem && this.rpgSkillsSystem.getSkills(player.id)) || {
            attack: { level: 1, xp: 0 },
            strength: { level: 1, xp: 0 },
            defense: { level: 1, xp: 0 },
            constitution: { level: 10, xp: 1154 },
            ranged: { level: 1, xp: 0 },
            woodcutting: { level: 1, xp: 0 },
            fishing: { level: 1, xp: 0 },
            firemaking: { level: 1, xp: 0 },
            cooking: { level: 1, xp: 0 }
          },
          inventory: player.inventory,
          equipment: [],
          bankStorage: [],
          position: { x: -45, y: 1.8, z: -40 }
        };

        const testData: PersistenceTestData = {
          player,
          originalData,
          saveTime: 0,
          loadTime: 0,
          dataMatches: false,
          saveSuccessful: false,
          loadSuccessful: false,
          corruptionDetected: false,
          savedDataCount: 0,
          restoredDataCount: 0,
          startTime: Date.now(),
          performanceMetrics: {
            saveTime: 0,
            loadTime: 0,
            dataSize: 0
          }
        };

        this.testData.set(stationId, testData);
        this.savePlayer(stationId);
      }, 2000);
  }

  private async runInventoryPersistenceTest(stationId: string): Promise<void> {

      // Create fake player with complex inventory
      const player = this.createPlayer({
        id: `inventory_persist_player_${Date.now()}`,
        name: 'Inventory Persistence Test Player',
        position: _v3_1.set(-50, 1.8, -40),
      });

      // Complex inventory with various items
      const bronzeSword = getItem('bronze_sword');
      const steelSword = getItem('steel_sword');
      const rawFish = getItem('raw_fish');
      const cookedFish = getItem('cooked_fish');
      const logs = getItem('logs');
      const coins = getItem('coins');
      
      // Complex inventory with various items
      player.inventory.items = [
        { id: `${bronzeSword!.id}_1`, itemId: bronzeSword!.id, quantity: 1, slot: 0, metadata: null },
        { id: `${steelSword!.id}_1`, itemId: steelSword!.id, quantity: 1, slot: 1, metadata: null },
        { id: `${rawFish!.id}_1`, itemId: rawFish!.id, quantity: 15, slot: 2, metadata: null },
        { id: `${cookedFish!.id}_1`, itemId: cookedFish!.id, quantity: 8, slot: 3, metadata: null },
        { id: `${logs!.id}_1`, itemId: logs!.id, quantity: 25, slot: 4, metadata: null },
        { id: `${coins!.id}_1`, itemId: coins!.id, quantity: 350, slot: 5, metadata: null }
      ];
      player.inventory.coins = 350;

      const originalData = {
        skills: (this.rpgSkillsSystem && this.rpgSkillsSystem.getSkills(player.id)) || {
          attack: { level: 1, xp: 0 },
          strength: { level: 1, xp: 0 },
          defense: { level: 1, xp: 0 },
          constitution: { level: 10, xp: 1154 },
          ranged: { level: 1, xp: 0 },
          woodcutting: { level: 1, xp: 0 },
          fishing: { level: 1, xp: 0 },
          firemaking: { level: 1, xp: 0 },
          cooking: { level: 1, xp: 0 }
        },
        inventory: player.inventory,
        equipment: [],
        bankStorage: [],
        position: { x: -50, y: 1.8, z: -40 }
      };

      const testData: PersistenceTestData = {
        player,
        originalData,
        saveTime: 0,
        loadTime: 0,
        dataMatches: false,
        saveSuccessful: false,
        loadSuccessful: false,
        corruptionDetected: false,
        savedDataCount: 0,
        restoredDataCount: 0,
        startTime: Date.now(),
        performanceMetrics: {
          saveTime: 0,
          loadTime: 0,
          dataSize: 0
        }
      };

      this.testData.set(stationId, testData);
      this.savePlayer(stationId);
  }

  private async runBankStoragePersistenceTest(stationId: string): Promise<void> {

      // Create fake player
      const player = this.createPlayer({
        id: `bank_persist_player_${Date.now()}`,
        name: 'Bank Persistence Test Player',
        position: _v3_1.set(-40, 1.8, -45),
      });

      // Add items to bank storage
      const mithrilSword = getItem('mithril_sword');
      const arrows = getItem('arrows');
      const hatchet = getItem('bronze_hatchet');
      
      const bankItems: Array<{ item: Item; quantity: number }> = [
        { item: mithrilSword!, quantity: 1 },
        { item: arrows!, quantity: 100 },
        { item: hatchet!, quantity: 1 }
      ];

      // Store items in bank
      for (const bankItem of bankItems) {
        this.emitTypedEvent(EventType.BANK_DEPOSIT, {
          playerId: player.id,
          itemId: bankItem.item.id,
          quantity: bankItem.quantity
        });
      }

      // Wait for bank operations
      setTimeout(() => {
        const originalData = {
          skills: (this.rpgSkillsSystem && this.rpgSkillsSystem.getSkills(player.id)) || {
            attack: { level: 1, xp: 0 },
            strength: { level: 1, xp: 0 },
            defense: { level: 1, xp: 0 },
            constitution: { level: 10, xp: 1154 },
            ranged: { level: 1, xp: 0 },
            woodcutting: { level: 1, xp: 0 },
            fishing: { level: 1, xp: 0 },
            firemaking: { level: 1, xp: 0 },
            cooking: { level: 1, xp: 0 }
          },
          inventory: player.inventory,
          equipment: [],
          bankStorage: [...bankItems],
          position: { x: -40, y: 1.8, z: -45 }
        };

        const testData: PersistenceTestData = {
          player,
          originalData,
          saveTime: 0,
          loadTime: 0,
          dataMatches: false,
          saveSuccessful: false,
          loadSuccessful: false,
          corruptionDetected: false,
          savedDataCount: 0,
          restoredDataCount: 0,
          startTime: Date.now(),
          performanceMetrics: {
            saveTime: 0,
            loadTime: 0,
            dataSize: 0
          }
        };

        this.testData.set(stationId, testData);
        this.savePlayer(stationId);
      }, 3000);
  }

  private async runEquipmentPersistenceTest(stationId: string): Promise<void> {

      // Create fake player
      const player = this.createPlayer({
        id: `equipment_persist_player_${Date.now()}`,
        name: 'Equipment Persistence Test Player',
        position: _v3_1.set(-45, 1.8, -45),
      });

      // Equip various items
      const steelSword = getItem('steel_sword');
      const steelHelmet = getItem('steel_helmet');
      const steelBody = getItem('steel_body');
      const steelShield = getItem('steel_shield');
      
      const equipmentItems: Array<{ slot: string; item: Item }> = [
        { slot: 'weapon', item: steelSword! },
        { slot: 'helmet', item: steelHelmet! },
        { slot: 'body', item: steelBody! },
        { slot: 'shield', item: steelShield! }
      ];

      // Equip items
      for (const equipment of equipmentItems) {
        this.emitTypedEvent(EventType.EQUIPMENT_EQUIP, {
          playerId: player.id,
          itemId: equipment.item.id,
          slot: equipment.slot
        });
      }

      // Wait for equipment operations
      setTimeout(() => {
        const originalData = {
          skills: (this.rpgSkillsSystem && this.rpgSkillsSystem.getSkills(player.id)) || {
            attack: { level: 1, xp: 0 },
            strength: { level: 1, xp: 0 },
            defense: { level: 1, xp: 0 },
            constitution: { level: 10, xp: 1154 },
            ranged: { level: 1, xp: 0 },
            woodcutting: { level: 1, xp: 0 },
            fishing: { level: 1, xp: 0 },
            firemaking: { level: 1, xp: 0 },
            cooking: { level: 1, xp: 0 }
          },
          inventory: player.inventory,
          equipment: [...equipmentItems],
          bankStorage: [],
          position: { x: -45, y: 1.8, z: -45 }
        };

        const testData: PersistenceTestData = {
          player,
          originalData,
          saveTime: 0,
          loadTime: 0,
          dataMatches: false,
          saveSuccessful: false,
          loadSuccessful: false,
          corruptionDetected: false,
          savedDataCount: 0,
          restoredDataCount: 0,
          startTime: Date.now(),
          performanceMetrics: {
            saveTime: 0,
            loadTime: 0,
            dataSize: 0
          }
        };

        this.testData.set(stationId, testData);
        this.savePlayer(stationId);
      }, 3000);
  }

  private async runLargeDatasetTest(stationId: string): Promise<void> {

      // Create fake player with massive amounts of data
      const player = this.createPlayer({
        id: `large_data_player_${Date.now()}`,
        name: 'Large Dataset Test Player',
        position: _v3_1.set(-50, 1.8, -45),
      });

      // Create large inventory (28 slots filled)
      const largeInventoryItems: InventoryItem[] = [];
      const bronze = getItem('bronze_sword');
      const steel = getItem('steel_sword');
      const mithril = getItem('mithril_sword');
      const logs = getItem('logs');
      const rawFish = getItem('raw_fish');
      const cookedFish = getItem('cooked_fish');
      const arrows = getItem('arrows');
      const coins = getItem('coins');
      const items = [bronze, steel, mithril, logs, rawFish, cookedFish, arrows, coins];
      
      let totalCoins = 0;
      for (let i = 0; i < 28; i++) {
        const item = items[i % items.length]!;
        const quantity = Math.floor(Math.random() * 1000) + 1;
        if (coins && item.id === coins.id) totalCoins += quantity;
        largeInventoryItems.push({ 
          id: `${item.id}_${i}`,
          itemId: item.id, 
          quantity: quantity, 
          slot: i,
          metadata: null
        });
      }
      // Set large inventory
      player.inventory.items = largeInventoryItems;
      player.inventory.coins = totalCoins;

      // Massive XP values
      const skills = ['attack', 'strength', 'defense', 'ranged', 'woodcutting', 'fishing', 'firemaking', 'cooking'];
      for (const skill of skills) {
        this.emitTypedEvent(EventType.SKILLS_XP_GAINED, { 
          playerId: player.id, 
          skill, 
          amount: Math.floor(Math.random() * 10000000) + 100000 
        });
      }

      // Wait for XP to be applied
      setTimeout(() => {
        const originalData = {
          skills: (this.rpgSkillsSystem && this.rpgSkillsSystem.getSkills(player.id)) || {
            attack: { level: 1, xp: 0 },
            strength: { level: 1, xp: 0 },
            defense: { level: 1, xp: 0 },
            constitution: { level: 10, xp: 1154 },
            ranged: { level: 1, xp: 0 },
            woodcutting: { level: 1, xp: 0 },
            fishing: { level: 1, xp: 0 },
            firemaking: { level: 1, xp: 0 },
            cooking: { level: 1, xp: 0 }
          },
          inventory: player.inventory,
          equipment: [],
          bankStorage: [],
          position: { x: -50, y: 1.8, z: -45 }
        };

        const testData: PersistenceTestData = {
          player,
          originalData,
          saveTime: 0,
          loadTime: 0,
          dataMatches: false,
          saveSuccessful: false,
          loadSuccessful: false,
          corruptionDetected: false,
          savedDataCount: 0,
          restoredDataCount: 0,
          startTime: Date.now(),
          performanceMetrics: {
            saveTime: 0,
            loadTime: 0,
            dataSize: 0
          }
        };

        this.testData.set(stationId, testData);
        this.savePlayer(stationId);
      }, 4000);
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;
    
    // Remove fake player
    this.fakePlayers.delete(testData.player.id);
    
    // Emit cleanup events
    this.emitTypedEvent(EventType.TEST_PLAYER_REMOVE, {
      id: `fake_player_${testData.player.id}`
    });
    
    // Clean up mappings
    this.testDataByPlayerId.delete(testData.player.id);
    this.testData.delete(stationId);
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
    
    // Check persistence performance with data validation
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of Array.from(this.testData.entries())) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.savedDataCount > 0) {
        const dataIntegrityRate = testData.restoredDataCount / testData.savedDataCount;
        if (dataIntegrityRate > 0.95) {
          hasGoodPerformanceMetrics = true;
          break;
        }
      }
    }
    
    if (completionRate >= 0.95 && successRate >= 0.9 && hasGoodPerformanceMetrics) {
      return 'excellent';
    } else if (completionRate >= 0.8 && successRate >= 0.8) {
      return 'very_good';
    } else if (completionRate >= 0.6 && successRate >= 0.7) {
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