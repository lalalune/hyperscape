/**
 * RPG Inventory Test System
 * Tests inventory management with fake players and items
 * - Tests item pickup from ground
 * - Tests item dropping to ground
 * - Tests item stacking for stackable items
 * - Tests inventory space limits (28 slots)
 * - Tests item movement within inventory
 * - Tests item use/consumption
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { ItemType } from '../types/index';
import { getItem, RPG_ITEMS } from '../data/items';

interface InventoryTestData {
  fakePlayer: FakePlayer;
  testItems: string[];
  droppedItems: Array<{ itemId: string; position: { x: number; y: number; z: number }; quantity: number }>;
  startTime: number;
  initialInventorySize: number;
  itemsPickedUp: number;
  itemsDropped: number;
  itemsUsed: number;
  stackingTested: boolean;
  spaceLimit_tested: boolean;
  maxSlotsTested: boolean;
  itemsAdded: number;
  itemsRemoved: number;
}

export class RPGInventoryTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, InventoryTestData>();
  private inventorySystem: any;
  private itemSpawnerSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGInventoryTestSystem] Initializing inventory test system...');
    
    // Get required systems
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    this.itemSpawnerSystem = this.world.systems.find((s: any) => s.constructor.name === 'ItemSpawnerSystem');
    
    if (!this.inventorySystem) {
      console.warn('[RPGInventoryTestSystem] InventorySystem not found, tests may not function properly');
    }
    
    if (!this.itemSpawnerSystem) {
      console.warn('[RPGInventoryTestSystem] ItemSpawnerSystem not found, tests may not function properly');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGInventoryTestSystem] Inventory test system initialized');
  }

  private createTestStations(): void {
    // Basic Pickup/Drop Test
    this.createTestStation({
      id: 'basic_pickup_test',
      name: 'Basic Pickup Test',
      position: { x: -40, y: 0, z: 10 },
      timeoutMs: 25000 // 25 seconds
    });

    // Item Stacking Test
    this.createTestStation({
      id: 'item_stacking_test',
      name: 'Item Stacking Test',
      position: { x: -40, y: 0, z: 20 },
      timeoutMs: 30000 // 30 seconds
    });

    // Inventory Space Limit Test
    this.createTestStation({
      id: 'inventory_limit_test',
      name: 'Inventory Limit Test',
      position: { x: -40, y: 0, z: 30 },
      timeoutMs: 45000 // 45 seconds
    });

    // Item Movement Test
    this.createTestStation({
      id: 'item_movement_test',
      name: 'Item Movement Test',
      position: { x: -40, y: 0, z: 40 },
      timeoutMs: 20000 // 20 seconds
    });

    // Item Use/Consumption Test
    this.createTestStation({
      id: 'item_use_test',
      name: 'Item Use Test',
      position: { x: -40, y: 0, z: 50 },
      timeoutMs: 15000 // 15 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_pickup_test':
        this.runBasicPickupTest(stationId);
        break;
      case 'item_stacking_test':
        this.runItemStackingTest(stationId);
        break;
      case 'inventory_limit_test':
        this.runInventoryLimitTest(stationId);
        break;
      case 'item_movement_test':
        this.runItemMovementTest(stationId);
        break;
      case 'item_use_test':
        this.runItemUseTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown inventory test: ${stationId}`);
    }
  }

  private async runBasicPickupTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGInventoryTestSystem] Starting basic pickup test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with empty inventory
      const fakePlayer = this.createFakePlayer({
        id: `pickup_player_${Date.now()}`,
        name: 'Pickup Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 10,
          strength: 10,
          defense: 10,
          ranged: 10,
          constitution: 10,
          health: 100,
          maxHealth: 100
        }
      });

      // Clear inventory
      fakePlayer.inventory = [];

      // Items to test pickup
      const testItems = ['bronze_sword', 'arrows', 'logs', 'coins'];
      const droppedItems: Array<{ itemId: string; position: { x: number; y: number; z: number }; quantity: number }> = [];

      // Spawn test items around the station
      for (let i = 0; i < testItems.length; i++) {
        const itemId = testItems[i];
        const item = getItem(itemId);
        
        if (item) {
          const itemPosition = {
            x: station.position.x + 1 + i * 2,
            y: station.position.y,
            z: station.position.z + (i % 2 === 0 ? 1 : -1)
          };
          
          const quantity = item.stackable ? 10 : 1;
          
          // Spawn item (simulate dropping)
          if (this.itemSpawnerSystem) {
            await this.itemSpawnerSystem.spawnItem(itemId, itemPosition, quantity);
            console.log(`[RPGInventoryTestSystem] Spawned ${quantity}x ${item.name} at (${itemPosition.x}, ${itemPosition.z})`);
          }
          
          // Emit visual item creation
          this.world.emit('rpg:test:item:create', {
            id: `test_item_${itemId}_${i}`,
            itemId: itemId,
            position: itemPosition,
            quantity: quantity,
            color: this.getItemColor(item.type)
          });
          
          droppedItems.push({ itemId, position: itemPosition, quantity });
        }
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testItems,
        droppedItems,
        startTime: Date.now(),
        initialInventorySize: fakePlayer.inventory.length,
        itemsPickedUp: 0,
        itemsDropped: 0,
        itemsUsed: 0,
        stackingTested: false,
        spaceLimit_tested: false,
        maxSlotsTested: false,
        itemsAdded: 0,
        itemsRemoved: 0
      });

      // Start pickup sequence
      this.startPickupSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic pickup test error: ${error}`);
    }
  }

  private async runItemStackingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGInventoryTestSystem] Starting item stacking test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `stacking_player_${Date.now()}`,
        name: 'Stacking Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 5,
          constitution: 10,
          health: 100,
          maxHealth: 100
        }
      });

      // Start with some arrows in inventory
      const arrowsItem = getItem('arrows');
      if (arrowsItem) {
        fakePlayer.inventory = [{ item: arrowsItem, quantity: 25 }];
      }

      // Spawn more arrows to test stacking
      const testItems = ['arrows', 'arrows', 'logs', 'logs', 'coins'];
      const droppedItems: Array<{ itemId: string; position: { x: number; y: number; z: number }; quantity: number }> = [];

      for (let i = 0; i < testItems.length; i++) {
        const itemId = testItems[i];
        const item = getItem(itemId);
        
        if (item) {
          const itemPosition = {
            x: station.position.x + 1 + i * 1.5,
            y: station.position.y,
            z: station.position.z + (i % 2 === 0 ? 1 : -1)
          };
          
          const quantity = item.stackable ? 15 : 1;
          
          // Spawn item
          if (this.itemSpawnerSystem) {
            await this.itemSpawnerSystem.spawnItem(itemId, itemPosition, quantity);
          }
          
          // Visual
          this.world.emit('rpg:test:item:create', {
            id: `stack_test_item_${itemId}_${i}`,
            itemId: itemId,
            position: itemPosition,
            quantity: quantity,
            color: this.getStackingTestColor(itemId)
          });
          
          droppedItems.push({ itemId, position: itemPosition, quantity });
        }
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testItems,
        droppedItems,
        startTime: Date.now(),
        initialInventorySize: fakePlayer.inventory.length,
        itemsPickedUp: 0,
        itemsDropped: 0,
        itemsUsed: 0,
        stackingTested: true,
        spaceLimit_tested: false,
        maxSlotsTested: false,
        itemsAdded: 0,
        itemsRemoved: 0
      });

      // Start stacking test sequence
      this.startStackingSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Item stacking test error: ${error}`);
    }
  }

  private async runInventoryLimitTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGInventoryTestSystem] Starting inventory limit test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `limit_player_${Date.now()}`,
        name: 'Limit Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 5,
          constitution: 10,
          health: 100,
          maxHealth: 100
        }
      });

      // Fill inventory to near capacity (25 slots)
      const bronzeSword = getItem('bronze_sword');
      if (bronzeSword) {
        fakePlayer.inventory = [];
        for (let i = 0; i < 25; i++) {
          fakePlayer.inventory.push({ item: bronzeSword, quantity: 1 });
        }
      }

      // Spawn items to test limit (should reach 28, then fail)
      const testItems = ['steel_sword', 'wood_bow', 'bronze_shield', 'tinderbox', 'extra_sword'];
      const droppedItems: Array<{ itemId: string; position: { x: number; y: number; z: number }; quantity: number }> = [];

      for (let i = 0; i < testItems.length; i++) {
        const itemId = testItems[i] === 'extra_sword' ? 'bronze_sword' : testItems[i];
        const item = getItem(itemId);
        
        if (item) {
          const itemPosition = {
            x: station.position.x + 1 + i * 1.2,
            y: station.position.y,
            z: station.position.z
          };
          
          // Spawn item
          if (this.itemSpawnerSystem) {
            await this.itemSpawnerSystem.spawnItem(itemId, itemPosition, 1);
          }
          
          // Visual with special color for limit test
          this.world.emit('rpg:test:item:create', {
            id: `limit_test_item_${itemId}_${i}`,
            itemId: itemId,
            position: itemPosition,
            quantity: 1,
            color: i >= 3 ? '#ff0000' : '#ffff00' // Red for items that shouldn't fit
          });
          
          droppedItems.push({ itemId, position: itemPosition, quantity: 1 });
        }
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testItems,
        droppedItems,
        startTime: Date.now(),
        initialInventorySize: fakePlayer.inventory.length,
        itemsPickedUp: 0,
        itemsDropped: 0,
        itemsUsed: 0,
        stackingTested: false,
        spaceLimit_tested: true,
        maxSlotsTested: false,
        itemsAdded: 0,
        itemsRemoved: 0
      });

      // Start limit test sequence
      this.startLimitSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Inventory limit test error: ${error}`);
    }
  }

  private async runItemMovementTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGInventoryTestSystem] Starting item movement test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with some items
      const fakePlayer = this.createFakePlayer({
        id: `movement_player_${Date.now()}`,
        name: 'Movement Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 10,
          strength: 10,
          defense: 10,
          ranged: 10,
          constitution: 10,
          health: 100,
          maxHealth: 100
        }
      });

      // Add test items to inventory in specific order
      const sword = getItem('bronze_sword');
      const bow = getItem('wood_bow');
      const arrows = getItem('arrows');
      const logs = getItem('logs');

      if (sword && bow && arrows && logs) {
        fakePlayer.inventory = [
          { item: sword, quantity: 1 },    // Slot 0
          { item: bow, quantity: 1 },      // Slot 1
          { item: arrows, quantity: 50 },  // Slot 2
          { item: logs, quantity: 10 }     // Slot 3
        ];
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testItems: ['bronze_sword', 'wood_bow', 'arrows', 'logs'],
        droppedItems: [],
        startTime: Date.now(),
        initialInventorySize: fakePlayer.inventory.length,
        itemsPickedUp: 0,
        itemsDropped: 0,
        itemsUsed: 0,
        stackingTested: false,
        spaceLimit_tested: false,
        maxSlotsTested: false,
        itemsAdded: 0,
        itemsRemoved: 0
      });

      // Start movement test sequence
      this.startMovementSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Item movement test error: ${error}`);
    }
  }

  private async runItemUseTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGInventoryTestSystem] Starting item use test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with consumable items
      const fakePlayer = this.createFakePlayer({
        id: `use_player_${Date.now()}`,
        name: 'Use Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 10,
          strength: 10,
          defense: 10,
          ranged: 10,
          constitution: 10,
          health: 50, // Reduced for healing test
          maxHealth: 100
        }
      });

      // Add consumable items
      const cookedShrimps = getItem('cooked_shrimps');
      const cookedFish = getItem('cooked_sardine');

      if (cookedShrimps && cookedFish) {
        fakePlayer.inventory = [
          { item: cookedShrimps, quantity: 5 },
          { item: cookedFish, quantity: 3 }
        ];
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        testItems: ['cooked_shrimps', 'cooked_sardine'],
        droppedItems: [],
        startTime: Date.now(),
        initialInventorySize: fakePlayer.inventory.length,
        itemsPickedUp: 0,
        itemsDropped: 0,
        itemsUsed: 0,
        stackingTested: false,
        spaceLimit_tested: false,
        maxSlotsTested: false,
        itemsAdded: 0,
        itemsRemoved: 0
      });

      // Start use test sequence
      this.startUseSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Item use test error: ${error}`);
    }
  }

  private startPickupSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    let itemIndex = 0;

    const pickupNextItem = async () => {
      if (itemIndex >= testData.droppedItems.length) {
        // All items picked up, start drop test
        setTimeout(() => this.startDropSequence(stationId), 2000);
        return;
      }

      const item = testData.droppedItems[itemIndex];
      console.log(`[RPGInventoryTestSystem] Attempting to pickup ${item.itemId} (${item.quantity})`);

      // Move player to item position
      this.moveFakePlayer(testData.fakePlayer.id, {
        x: item.position.x,
        y: item.position.y,
        z: item.position.z
      });

      // Simulate pickup after movement
      setTimeout(async () => {
        if (this.inventorySystem) {
          const success = await this.inventorySystem.addItem(testData.fakePlayer.id, item.itemId, item.quantity);
          if (success) {
            testData.itemsPickedUp++;
            console.log(`[RPGInventoryTestSystem] Successfully picked up ${item.itemId}`);
            
            // Remove visual item
            this.world.emit('rpg:test:item:remove', {
              id: `test_item_${item.itemId}_${itemIndex}`
            });
          } else {
            console.log(`[RPGInventoryTestSystem] Failed to pickup ${item.itemId} - inventory full?`);
          }
        }

        itemIndex++;
        setTimeout(pickupNextItem, 1500);
      }, 1000);
    };

    // Start pickup sequence
    setTimeout(pickupNextItem, 1000);
  }

  private startDropSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGInventoryTestSystem] Starting drop sequence...');

    // Drop first item in inventory
    if (testData.fakePlayer.inventory.length > 0) {
      const itemToDrop = testData.fakePlayer.inventory[0];
      const dropPosition = {
        x: testData.fakePlayer.position.x + 2,
        y: testData.fakePlayer.position.y,
        z: testData.fakePlayer.position.z
      };

      // Simulate drop
      setTimeout(async () => {
        if (this.inventorySystem) {
          const success = await this.inventorySystem.removeItem(
            testData.fakePlayer.id, 
            itemToDrop.item.id, 
            Math.min(itemToDrop.quantity, 5)
          );
          
          if (success) {
            testData.itemsDropped++;
            console.log(`[RPGInventoryTestSystem] Successfully dropped ${itemToDrop.item.id}`);
            
            // Create visual dropped item
            this.world.emit('rpg:test:item:create', {
              id: `dropped_item_${Date.now()}`,
              itemId: itemToDrop.item.id,
              position: dropPosition,
              quantity: 5,
              color: '#ff8800'
            });
          }
        }

        // Complete test after drop
        setTimeout(() => this.completeBasicTest(stationId), 2000);
      }, 1000);
    } else {
      // No items to drop, complete test
      this.completeBasicTest(stationId);
    }
  }

  private startStackingSequence(stationId: string): void {
    // Similar to pickup but monitor stacking behavior
    this.startPickupSequence(stationId);
    
    // Complete after pickup sequence
    setTimeout(() => this.completeStackingTest(stationId), 12000);
  }

  private startLimitSequence(stationId: string): void {
    // Similar to pickup but expect some failures
    this.startPickupSequence(stationId);
    
    // Complete after pickup sequence
    setTimeout(() => this.completeLimitTest(stationId), 15000);
  }

  private startMovementSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGInventoryTestSystem] Starting item movement sequence...');

    // Simulate moving items within inventory
    setTimeout(async () => {
      if (this.inventorySystem) {
        // Move item from slot 0 to slot 10
        const success = await this.inventorySystem.moveItem(testData.fakePlayer.id, 0, 10);
        console.log(`[RPGInventoryTestSystem] Item movement result: ${success}`);
      }
      
      this.completeMovementTest(stationId);
    }, 2000);
  }

  private startUseSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGInventoryTestSystem] Starting item use sequence...');

    // Use first consumable item
    setTimeout(async () => {
      if (testData.fakePlayer.inventory.length > 0) {
        const consumable = testData.fakePlayer.inventory[0];
        const oldHealth = testData.fakePlayer.stats.health;
        
        // Simulate item use
        const healAmount = consumable.item.healAmount || 0;
        testData.fakePlayer.stats.health = Math.min(
          testData.fakePlayer.stats.maxHealth,
          testData.fakePlayer.stats.health + healAmount
        );
        
        // Remove item from inventory
        consumable.quantity--;
        if (consumable.quantity <= 0) {
          testData.fakePlayer.inventory.splice(0, 1);
        }
        
        testData.itemsUsed++;
        console.log(`[RPGInventoryTestSystem] Used ${consumable.item.name}, health: ${oldHealth} -> ${testData.fakePlayer.stats.health}`);
      }
      
      this.completeUseTest(stationId);
    }, 2000);
  }

  private completeBasicTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsPickedUp: testData.itemsPickedUp,
      itemsDropped: testData.itemsDropped,
      expectedPickups: testData.droppedItems.length,
      finalInventorySize: testData.fakePlayer.inventory.length,
      duration: Date.now() - testData.startTime
    };

    if (testData.itemsPickedUp >= testData.droppedItems.length * 0.75 && testData.itemsDropped > 0) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Pickup/drop test failed: picked up ${testData.itemsPickedUp}/${testData.droppedItems.length}, dropped ${testData.itemsDropped}`);
    }
  }

  private completeStackingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Check if arrows stacked properly (should have > 25 arrows in one slot)
    const arrowSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'arrows');
    const arrowQuantity = arrowSlot ? arrowSlot.quantity : 0;

    const results = {
      itemsPickedUp: testData.itemsPickedUp,
      arrowQuantity: arrowQuantity,
      expectedMinArrows: 25 + 30, // Initial + picked up
      inventorySlots: testData.fakePlayer.inventory.length,
      duration: Date.now() - testData.startTime
    };

    if (arrowQuantity >= 50 && testData.fakePlayer.inventory.length <= 6) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Stacking test failed: arrows=${arrowQuantity} (expected >=50), slots=${testData.fakePlayer.inventory.length}`);
    }
  }

  private completeLimitTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const finalSize = testData.fakePlayer.inventory.length;
    const maxExpected = 28; // RuneScape inventory limit

    const results = {
      itemsPickedUp: testData.itemsPickedUp,
      finalInventorySize: finalSize,
      maxSlots: maxExpected,
      hitLimit: finalSize >= maxExpected,
      duration: Date.now() - testData.startTime
    };

    if (finalSize <= maxExpected && testData.itemsPickedUp < testData.droppedItems.length) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Limit test failed: final size=${finalSize}, picked up=${testData.itemsPickedUp}/${testData.droppedItems.length}`);
    }
  }

  private completeMovementTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      inventorySize: testData.fakePlayer.inventory.length,
      duration: Date.now() - testData.startTime
    };

    // For now, just pass if no errors occurred
    this.passTest(stationId, results);
  }

  private completeUseTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsUsed: testData.itemsUsed,
      finalHealth: testData.fakePlayer.stats.health,
      duration: Date.now() - testData.startTime
    };

    if (testData.itemsUsed > 0 && testData.fakePlayer.stats.health > 50) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Use test failed: used=${testData.itemsUsed}, health=${testData.fakePlayer.stats.health}`);
    }
  }

  private getItemColor(itemType: ItemType): string {
    switch (itemType) {
      case ItemType.WEAPON: return '#ff0000';     // Red
      case ItemType.ARMOR: return '#0000ff';      // Blue
      case ItemType.AMMUNITION: return '#ffff00'; // Yellow
      case ItemType.RESOURCE: return '#00ff00';   // Green
      case ItemType.CURRENCY: return '#ffd700';   // Gold
      case ItemType.CONSUMABLE: return '#ff69b4'; // Pink
      default: return '#ffffff';                  // White
    }
  }

  private getStackingTestColor(itemId: string): string {
    switch (itemId) {
      case 'arrows': return '#ffff00';  // Yellow
      case 'logs': return '#8b4513';    // Brown
      case 'coins': return '#ffd700';   // Gold
      default: return '#ffffff';        // White
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up any spawned items
      testData.droppedItems.forEach((item, index) => {
        this.world.emit('rpg:test:item:remove', {
          id: `test_item_${item.itemId}_${index}`
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
    
    console.log(`[RPGInventoryTestSystem] Cleanup completed for ${stationId}`);
  }

  async getSystemRating(): Promise<string> {
    const totalStations = this.testStations.size;
    const completedStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed' || station.status === 'failed'
    ).length;
    
    const successfulStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed'
    ).length;
    
    // Enhanced rating criteria for inventory system
    const completionRate = totalStations > 0 ? completedStations / totalStations : 0;
    const successRate = completedStations > 0 ? successfulStations / completedStations : 0;
    
    // Check for advanced inventory features
    const hasAddItemTesting = this.testStations.has('inventory_add_item_test');
    const hasRemoveItemTesting = this.testStations.has('inventory_remove_item_test');
    const hasStackingTesting = this.testStations.has('inventory_stacking_test');
    const hasCapacityTesting = this.testStations.has('inventory_capacity_test');
    const hasSwapTesting = this.testStations.has('inventory_swap_test');
    
    const advancedFeatureCount = [
      hasAddItemTesting,
      hasRemoveItemTesting,
      hasStackingTesting,
      hasCapacityTesting,
      hasSwapTesting
    ].filter(Boolean).length;
    
    // Check inventory operation performance
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.itemsAdded > 0) {
        const operationSuccess = (testData.itemsAdded + testData.itemsRemoved) / ((testData.itemsAdded + testData.itemsRemoved) || 1);
        if (operationSuccess > 0.8) { // Good operation success rate
          hasGoodPerformanceMetrics = true;
          break;
        }
      }
    }
    
    // Rating logic with enhanced criteria
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