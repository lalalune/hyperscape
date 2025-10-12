/**
 * Store Test System
 * Tests store operations with fake players and shop NPCs
 * - Tests item purchasing (coins -> items)
 * - Tests item selling (items -> coins)
 * - Tests stock management and availability
 * - Tests price calculations and coin handling
 * - Tests insufficient funds scenarios
 * - Tests bulk purchase/sell operations
 */

import { getItemPrice } from '../constants/store-data';
import { getItem } from '../data/items';
import { VisualTestFramework } from './VisualTestFramework';
import type { PlayerEntity } from '../types/test'
import type { World } from '../types';
import { getSystem } from '../utils/SystemUtils';
import { StoreSystem } from './StoreSystem';
import { InventorySystem } from './InventorySystem';
import { EventType } from '../types/events';
import * as THREE from 'three';
import type { Inventory, InventoryItem, PlayerEquipmentItems } from '../types/core';

interface StoreTestData {
  player: PlayerEntity;
  storeLocation: { x: number; y: number; z: number }
  storeInventory: { [itemId: string]: { stock: number; price: number } };
  testItems: Array<{ itemId: string; quantity: number; expectedPrice: number }>;
  startTime: number;
  itemsPurchased: number;
  itemsSold: number;
  coinsSpent: number;
  coinsEarned: number;
  initialCoins: number;
  finalCoins: number;
  purchaseTested: boolean;
  sellTested: boolean;
  insufficientFundsTested: boolean;
}

export class StoreTestSystem extends VisualTestFramework {
  private testData = new Map<string, StoreTestData>();
  private storeSystem!: StoreSystem;
  private inventorySystem!: InventorySystem;

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    // Get required systems
    this.storeSystem = getSystem<StoreSystem>(this.world, 'store')!;
    this.inventorySystem = getSystem<InventorySystem>(this.world, 'inventory')!;
    
    // Create test stations
    this.createTestStations();
  }

  protected createTestStations(): void {
    // Basic Purchase Test
    this.createTestStation({
      id: 'basic_purchase_test',
      name: 'Basic Purchase Test',
      position: { x: -60, y: 0, z: 10 },
      timeoutMs: 30000 // 30 seconds
    });

    // Basic Sell Test
    this.createTestStation({
      id: 'basic_sell_test',
      name: 'Basic Sell Test',
      position: { x: -60, y: 0, z: 20 },
      timeoutMs: 30000 // 30 seconds
    });

    // Insufficient Funds Test
    this.createTestStation({
      id: 'insufficient_funds_test',
      name: 'Insufficient Funds Test',
      position: { x: -60, y: 0, z: 30 },
      timeoutMs: 25000 // 25 seconds
    });

    // Stock Limit Test
    this.createTestStation({
      id: 'stock_limit_test',
      name: 'Stock Limit Test',
      position: { x: -60, y: 0, z: 40 },
      timeoutMs: 35000 // 35 seconds
    });

    // Bulk Operations Test
    this.createTestStation({
      id: 'bulk_store_test',
      name: 'Bulk Store Test',
      position: { x: -60, y: 0, z: 50 },
      timeoutMs: 45000 // 45 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_purchase_test':
        this.runBasicPurchaseTest(stationId);
        break;
      case 'basic_sell_test':
        this.runBasicSellTest(stationId);
        break;
      case 'insufficient_funds_test':
        this.runInsufficientFundsTest(stationId);
        break;
      case 'stock_limit_test':
        this.runStockLimitTest(stationId);
        break;
      case 'bulk_store_test':
        this.runBulkStoreTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown store test: ${stationId}`);
    }
  }

  /**
   * Create a visual representation of a store
   */
  private createStoreVisual(storeId: string, position: { x: number; y: number; z: number }, storeType: string): void {
    // Create a simple cube to represent the store
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({ 
      color: storeType === 'general_store' ? 0x8B4513 : 0x4169E1  // Brown for general, blue for others
    });
    const storeMesh = new THREE.Mesh(geometry, material);
    storeMesh.position.set(position.x, position.y + 1, position.z);
    storeMesh.name = `store_${storeId}`;
    
    // Add to scene if available
    const stage = this.world.getSystem('Stage');
    if (stage && 'scene' in stage) {
      (stage as { scene: { add: (mesh: THREE.Mesh) => void } }).scene.add(storeMesh);
    }
    
      }

  private async runBasicPurchaseTest(stationId: string): Promise<void> {
    const station = this.testStations.get(stationId)!;

    // Create fake player with coins
    const basePlayer = this.createPlayer({
      id: `purchase_player_${Date.now()}`,
      name: 'Purchase Test Player',
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

    // Cast to proper Player type and initialize inventory
    const player = basePlayer as PlayerEntity;
    // Remove invalid property assignments - these don't exist on Player type
    player.equipment = {
      weapon: null,
      shield: null,
      helmet: null,
      body: null,
      legs: null,
      arrows: null
    } as PlayerEquipmentItems;
    player.inventory = {
      items: [],
      capacity: 30,
      coins: 500
    } as Inventory;

    // Define store inventory with prices from centralized store data
    const storeInventory = {
      'bronze_hatchet': { stock: 10, price: getItemPrice('bronze_hatchet') },
      'fishing_rod': { stock: 15, price: getItemPrice('fishing_rod') },
      'tinderbox': { stock: 20, price: getItemPrice('tinderbox') },
      'arrows': { stock: 1000, price: getItemPrice('arrows') }
    };
  
    // Items to purchase (using actual store prices)
    const testItems = [
      { itemId: 'bronze_hatchet', quantity: 1, expectedPrice: getItemPrice('bronze_hatchet') },
      { itemId: 'fishing_rod', quantity: 1, expectedPrice: getItemPrice('fishing_rod') },
      { itemId: 'arrows', quantity: 50, expectedPrice: getItemPrice('arrows') }
    ];

    // Create store visual (shop counter)
    const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
    this.createStoreVisual(stationId, storeLocation, 'general_store');

    // Store test data
    this.testData.set(stationId, {
      player,
      storeLocation,
      storeInventory,
      testItems,
      startTime: Date.now(),
      itemsPurchased: 0,
      itemsSold: 0,
      coinsSpent: 0,
      coinsEarned: 0,
      initialCoins: 500,
      finalCoins: 500,
      purchaseTested: true,
      sellTested: false,
      insufficientFundsTested: false
    });

    // Start purchase sequence
    this.startPurchaseSequence(stationId);
  }

  private async runBasicSellTest(stationId: string): Promise<void> {
    const station = this.testStations.get(stationId)!;

    // Create fake player with items to sell
    const basePlayer = this.createPlayer({
      id: `sell_player_${Date.now()}`,
      name: 'Sell Test Player',
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

    // Cast to proper Player type and initialize with items to sell
    const player = basePlayer as PlayerEntity;
    // Remove invalid property assignments - these don't exist on Player type
    player.equipment = {
      weapon: null,
      shield: null,
      helmet: null,
      body: null,
      legs: null,
      arrows: null
    } as PlayerEquipmentItems;
    player.inventory = {
      items: [
        { id: 'sword_1', itemId: 'sword', quantity: 1, slot: 0 } as InventoryItem,
        { id: 'arrows_1', itemId: 'arrows', quantity: 100, slot: 1 } as InventoryItem,
        { id: 'logs_1', itemId: 'logs', quantity: 50, slot: 2 } as InventoryItem
      ],
      capacity: 30,
      coins: 10
    } as Inventory;

    // Store accepts these items at reduced prices
    const storeInventory = {
      'bronze_sword': { stock: 0, price: 80 }, // Sells to store for less than buy price
      'arrows': { stock: 500, price: 1 },
      'logs': { stock: 100, price: 4 }
    };

    // Items to sell
    const testItems = [
      { itemId: 'bronze_sword', quantity: 1, expectedPrice: 80 },
      { itemId: 'arrows', quantity: 50, expectedPrice: 50 },
      { itemId: 'logs', quantity: 25, expectedPrice: 100 }
    ];

    // Create store visual
    const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
    this.createStoreVisual(stationId, storeLocation, 'buy_back_store');

    // Store test data
    this.testData.set(stationId, {
      player,
      storeLocation,
      storeInventory,
      testItems,
      startTime: Date.now(),
      itemsPurchased: 0,
      itemsSold: 0,
      coinsSpent: 0,
      coinsEarned: 0,
      initialCoins: 10,
      finalCoins: 10,
      purchaseTested: false,
      sellTested: true,
      insufficientFundsTested: false
    });

    // Start sell sequence
    this.startSellSequence(stationId);
  }

  private async runInsufficientFundsTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with insufficient coins
      const basePlayer = this.createPlayer({
        id: `broke_player_${Date.now()}`,
        name: 'Broke Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 5,
          constitution: 5,
          health: 50,
          maxHealth: 50
        }
      });

      // Cast to proper Player type and give player only 10 coins
      const player = basePlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      } as PlayerEquipmentItems;
      player.inventory = {
        items: [],
        capacity: 30,
        coins: 10
      } as Inventory;

      // Update the coins through the inventory system
      this.emitTypedEvent(EventType.INVENTORY_UPDATE_COINS, {
        playerId: player.id,
        amount: 10
      })

      // Store has items with real prices
      const storeInventory = {
        'steel_sword': { stock: 5, price: 500 }, // Too expensive (500 > 10)
        'bronze_hatchet': { stock: 10, price: getItemPrice('bronze_hatchet') }, // 1 coin - affordable
        'fishing_rod': { stock: 15, price: getItemPrice('fishing_rod') }, // 5 coins - affordable
        'tinderbox': { stock: 20, price: getItemPrice('tinderbox') }, // 2 coins - affordable
        'arrows': { stock: 1000, price: getItemPrice('arrows') } // 1 coin - affordable
      };

      // Attempt to buy items - some will succeed, some will fail
      const testItems = [
        { itemId: 'steel_sword', quantity: 1, expectedPrice: 500 }, // Should fail (500 > 10)
        { itemId: 'fishing_rod', quantity: 3, expectedPrice: getItemPrice('fishing_rod') }, // Should fail (15 > 10)
        { itemId: 'bronze_hatchet', quantity: 1, expectedPrice: getItemPrice('bronze_hatchet') }, // Should succeed (1 <= 10)
        { itemId: 'tinderbox', quantity: 1, expectedPrice: getItemPrice('tinderbox') }, // Should succeed (2 <= 9)
        { itemId: 'arrows', quantity: 5, expectedPrice: getItemPrice('arrows') } // Should succeed (5 <= 7)
      ];

      // Create store visual
      const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createStoreVisual(stationId, storeLocation, 'expensive_store');

      // Store test data
      this.testData.set(stationId, {
        player,
        storeLocation,
        storeInventory,
        testItems,
        startTime: Date.now(),
        itemsPurchased: 0,
        itemsSold: 0,
        coinsSpent: 0,
        coinsEarned: 0,
        initialCoins: 10,
        finalCoins: 10,
        purchaseTested: true,
        sellTested: false,
        insufficientFundsTested: true
      });

      // Start insufficient funds test
      this.startInsufficientFundsSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Insufficient funds test error: ${error}`);
    }
  }

  private async runStockLimitTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with lots of coins
      const basePlayer = this.createPlayer({
        id: `stock_player_${Date.now()}`,
        name: 'Stock Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 15,
          strength: 15,
          defense: 15,
          ranged: 15,
          constitution: 15,
          health: 150,
          maxHealth: 150
        }
      });

      // Cast to proper Player type and give player lots of coins
      const player = basePlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      } as PlayerEquipmentItems;
      player.inventory = {
        items: [],
        capacity: 30,
        coins: 1000
      } as Inventory;

      // Store has limited stock
      const storeInventory = {
        'bronze_hatchet': { stock: 2, price: getItemPrice('bronze_hatchet') }, // Only 2 in stock
        'fishing_rod': { stock: 1, price: getItemPrice('fishing_rod') }, // Only 1 in stock
        'arrows': { stock: 100, price: getItemPrice('arrows') } // 100 in stock
      };

      // Try to buy more than available stock
      const testItems = [
        { itemId: 'bronze_hatchet', quantity: 5, expectedPrice: getItemPrice('bronze_hatchet') }, // Try to buy 5, only 2 available
        { itemId: 'fishing_rod', quantity: 3, expectedPrice: getItemPrice('fishing_rod') }, // Try to buy 3, only 1 available
        { itemId: 'arrows', quantity: 150, expectedPrice: getItemPrice('arrows') } // Try to buy 150, only 100 available
      ];

      // Create store visual
      const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createStoreVisual(stationId, storeLocation, 'limited_stock_store');

      // Store test data
      this.testData.set(stationId, {
        player,
        storeLocation,
        storeInventory,
        testItems,
        startTime: Date.now(),
        itemsPurchased: 0,
        itemsSold: 0,
        coinsSpent: 0,
        coinsEarned: 0,
        initialCoins: 1000,
        finalCoins: 1000,
        purchaseTested: true,
        sellTested: false,
        insufficientFundsTested: false
      });

      // Start stock limit test
      this.startStockLimitSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Stock limit test error: ${error}`);
    }
  }

  private async runBulkStoreTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for bulk operations
      const basePlayer = this.createPlayer({
        id: `bulk_store_player_${Date.now()}`,
        name: 'Bulk Store Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
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

      // Cast to proper Player type and give player coins and items for bulk operations
      const player = basePlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      } as PlayerEquipmentItems;
      
      const coinsItem = getItem('coins');
      const arrowsItem = getItem('arrows');
      const logsItem = getItem('logs');

      if (coinsItem && arrowsItem && logsItem) {
        player.inventory = {
          items: [
            { id: 'arrows_1', itemId: 'arrows', quantity: 500, slot: 0 } as InventoryItem,
            { id: 'logs_1', itemId: 'logs', quantity: 200, slot: 1 } as InventoryItem
          ],
          capacity: 30,
          coins: 2000
        } as Inventory;
      } else {
        player.inventory = {
          items: [],
          capacity: 30,
          coins: 2000
        } as Inventory;
      }

      // Store supports bulk operations
      const storeInventory = {
        'bronze_hatchet': { stock: 50, price: getItemPrice('bronze_hatchet') },
        'fishing_rod': { stock: 50, price: getItemPrice('fishing_rod') },
        'tinderbox': { stock: 100, price: getItemPrice('tinderbox') },
        'arrows': { stock: 2000, price: getItemPrice('arrows') },
        'logs': { stock: 1000, price: getItemPrice('logs') }
      };

      // Bulk operations
      const testItems = [
        { itemId: 'bronze_hatchet', quantity: 10, expectedPrice: getItemPrice('bronze_hatchet') },
        { itemId: 'arrows', quantity: 200, expectedPrice: getItemPrice('arrows') },
        { itemId: 'logs', quantity: 100, expectedPrice: getItemPrice('logs') } // Selling logs
      ];

      // Create store visual
      const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createStoreVisual(stationId, storeLocation, 'bulk_trading_post');

      // Store test data
      this.testData.set(stationId, {
        player,
        storeLocation,
        storeInventory,
        testItems,
        startTime: Date.now(),
        itemsPurchased: 0,
        itemsSold: 0,
        coinsSpent: 0,
        coinsEarned: 0,
        initialCoins: 2000,
        finalCoins: 2000,
        purchaseTested: true,
        sellTested: true,
        insufficientFundsTested: false
      });

      // Start bulk operations
      this.startBulkStoreSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Bulk store test error: ${error}`);
    }
  }

  private startPurchaseSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Move player to store
    this.movePlayer(testData.player.id, {
      x: testData.storeLocation.x - 1,
      y: testData.storeLocation.y,
      z: testData.storeLocation.z
    });

    let itemIndex = 0;

    const purchaseNextItem = async () => {
      if (itemIndex >= testData.testItems.length) {
        // All purchases attempted
        this.completePurchaseTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      const totalCost = testItem.expectedPrice * testItem.quantity;
      
      // Removed console.log(`[StoreTestSystem] Attempting to purchase: ${testItem.itemId} x${testItem.quantity} for ${totalCost} coins`);

      // Check if player has enough coins
      const availableCoins = testData.player.inventory.coins;


      if (availableCoins >= totalCost) {
        // Simulate store purchase
        if (this.storeSystem) {
          // Assume purchaseItem method exists on store system
          try {
            const success = await this.storeSystem.purchaseItem(
              testData.player.id,
              testItem.itemId,
              testItem.quantity,
              testItem.expectedPrice
            );

            if (success) {
              testData.itemsPurchased++;
              testData.coinsSpent += totalCost;
              // Removed console.log(`[StoreTestSystem] Purchase successful for ${testItem.itemId}`);
              
              // Remove coins from inventory
              if (availableCoins >= totalCost) {
                testData.player.inventory.coins -= totalCost;
              }
              
              // Add item to inventory
              const item = getItem(testItem.itemId);
              if (item) {
                const existingSlot = testData.player.inventory.items.find(slot => slot.itemId === testItem.itemId);
                if (existingSlot && item.stackable) {
                  existingSlot.quantity += testItem.quantity;
                } else {
                  testData.player.inventory.items.push({ 
                    id: `${testItem.itemId}_${Date.now()}`, 
                    itemId: testItem.itemId,
                    quantity: testItem.quantity, 
                    slot: testData.player.inventory.items.length
                  } as InventoryItem);
                }
              } else {
                // Removed console.error(`[StoreTestSystem] Failed to get item: ${testItem.itemId}`);
                // Don't count this as a successful purchase if we can't get the item
                testData.itemsPurchased--;
              }
              
            } else {
              // Removed console.warn('[StoreTestSystem] Purchase failed');
            }
          } catch (_error) {
            // Removed console.warn('[StoreTestSystem] Purchase item warning:', _error);
          }
        } else {
          // Removed console.warn('[StoreTestSystem] Store system or purchaseItem method not available');
        }
      } else {
        // Removed console.warn(`[StoreTestSystem] Insufficient funds for purchase: need ${totalCost}, have ${availableCoins}`);
      }

      itemIndex++;
      setTimeout(purchaseNextItem, 1500);
    };

    // Start purchase sequence after movement
    setTimeout(purchaseNextItem, 2000);
  }

  private startSellSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Move player to store
    this.movePlayer(testData.player.id, {
      x: testData.storeLocation.x - 1,
      y: testData.storeLocation.y,
      z: testData.storeLocation.z
    });

    let itemIndex = 0;

    const sellNextItem = async () => {
      if (itemIndex >= testData.testItems.length) {
        // All sales attempted
        this.completeSellTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      const totalValue = testItem.expectedPrice * testItem.quantity;
      

      // Check if player has the item
      const itemSlot = testData.player.inventory.items.find(slot => slot.itemId === testItem.itemId);
      const availableQuantity = itemSlot ? itemSlot.quantity : 0;

      if (availableQuantity >= testItem.quantity) {
        // Simulate store sale
        if (this.storeSystem) {
          // Assume sellItem method exists on store system
          try {
            const success = await this.storeSystem.sellItem(
              testData.player.id,
              testItem.itemId,
              testItem.quantity,
              testItem.expectedPrice
            );

            if (success) {
              testData.itemsSold++;
              testData.coinsEarned += totalValue;
              
              // Remove item from inventory
              if (itemSlot) {
                itemSlot.quantity -= testItem.quantity;
                if (itemSlot.quantity <= 0) {
                  const index = testData.player.inventory.items.indexOf(itemSlot);
                  testData.player.inventory.items.splice(index, 1);
                }
              }
              
              // Add coins to inventory
              testData.player.inventory.coins += totalValue;
              
            } else {
              // Removed console.warn('[StoreTestSystem] Sell failed');
            }
          } catch (_error) {
            // Removed console.warn('[StoreTestSystem] Sell item warning:', _error);
          }
        } else {
          // Removed console.warn('[StoreTestSystem] Store system or sellItem method not available');
        }
      } else {
        // Removed console.warn('[StoreTestSystem] Insufficient item quantity for sale');
      }

      itemIndex++;
      setTimeout(sellNextItem, 1500);
    };

    // Start sell sequence after movement
    setTimeout(sellNextItem, 2000);
  }

  private startInsufficientFundsSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Removed console.log(`[StoreTestSystem] Starting insufficient funds sequence`);

    // Move player to store
    this.movePlayer(testData.player.id, {
      x: testData.storeLocation.x - 1,
      y: testData.storeLocation.y,
      z: testData.storeLocation.z
    });

    let itemIndex = 0;

    const purchaseNextItem = async () => {
      if (itemIndex >= testData.testItems.length) {
        // All purchases attempted
        this.completeInsufficientFundsTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      const storeItem = testData.storeInventory[testItem.itemId];
      const actualPrice = storeItem ? storeItem.price : testItem.expectedPrice;
      const totalCost = actualPrice * testItem.quantity;
      
      // Removed console.log(`[StoreTestSystem] Attempting to purchase: ${testItem.itemId} x${testItem.quantity} for ${totalCost} coins`);

      // Get current coins before purchase
      const availableCoins = testData.player.inventory.coins;
      const coinsBefore = availableCoins;

      if (availableCoins >= totalCost) {
        // Attempt store purchase
        if (this.storeSystem) {
          try {
            // Store will handle the actual purchase through events
            await this.storeSystem.purchaseItem(
              testData.player.id,
              testItem.itemId,
              testItem.quantity,
              actualPrice
            );

            // Wait a bit for the purchase to process
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if coins were deducted (indicates successful purchase)
            const coinsAfter = testData.player.inventory.coins;
            const coinsDeducted = coinsBefore - coinsAfter;
            
            if (coinsDeducted > 0) {
              testData.itemsPurchased++;
              testData.coinsSpent += coinsDeducted;
              // Removed console.log(`[StoreTestSystem] Purchase successful for ${testItem.itemId}, spent ${coinsDeducted} coins`);
            } else {
              // Removed console.log(`[StoreTestSystem] Purchase failed for ${testItem.itemId}, no coins deducted`);
            }
          } catch (_error) {
            // Removed console.warn(`[StoreTestSystem] Purchase error:`, _error);
          }
        }
      } else {
        // Removed console.log(`[StoreTestSystem] Insufficient funds: ${availableCoins} < ${totalCost}`);
      }

      // Move to next item
      itemIndex++;
      setTimeout(purchaseNextItem, 1000);
    };

    // Start purchase sequence after movement
    setTimeout(purchaseNextItem, 2000);
  }

  private startStockLimitSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Move player to store
    this.movePlayer(testData.player.id, {
      x: testData.storeLocation.x - 1,
      y: testData.storeLocation.y,
      z: testData.storeLocation.z
    });

    // Attempt to buy more than stock allows
    setTimeout(async () => {
      // Track initial inventory
      const initialInventory = new Map<string, number>();
      testData.player.inventory.items.forEach(slot => {
        initialInventory.set(slot.itemId, slot.quantity);
      });

      for (const testItem of testData.testItems) {
        const availableStock = testData.storeInventory[testItem.itemId]?.stock || 0;
        const requestedQuantity = testItem.quantity;
        const _expectedPurchase = Math.min(requestedQuantity, availableStock);

        if (this.storeSystem) {
          // Assume purchaseItem method exists on store system
          try {
            // Attempt to purchase more than available
            await this.storeSystem.purchaseItem(
              testData.player.id,
              testItem.itemId,
              requestedQuantity, // Try to buy more than stock
              testItem.expectedPrice
            );

            // Wait for purchase to process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check actual items received
            const currentQuantity = testData.player.inventory.items
              .find(slot => slot.itemId === testItem.itemId)?.quantity || 0;
            const previousQuantity = initialInventory.get(testItem.itemId) || 0;
            const actuallyPurchased = currentQuantity - previousQuantity;

            if (actuallyPurchased > 0) {
              testData.itemsPurchased += actuallyPurchased;
              testData.coinsSpent += testItem.expectedPrice * actuallyPurchased;
              
              // Update store stock
              testData.storeInventory[testItem.itemId].stock -= actuallyPurchased;
              
              // Removed console.log(`[StoreTestSystem] Stock limit test: Requested ${requestedQuantity}, got ${actuallyPurchased} (stock was ${availableStock})`);
            }
          } catch (_error) {
            // Removed console.warn(`[StoreTestSystem] Purchase error:`, _error);
          }
        } else {
          // Removed console.error('[StoreTestSystem] Store system not available for stock limit test!');
        }
      }

      // Complete test after all purchases
      setTimeout(() => this.completeStockLimitTest(stationId), 1000);
    }, 3000); // Wait longer for systems to initialize
  }

  private startBulkStoreSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Move player to store
    this.movePlayer(testData.player.id, {
      x: testData.storeLocation.x - 1,
      y: testData.storeLocation.y,
      z: testData.storeLocation.z
    });

    // Bulk purchase then bulk sell
    setTimeout(async () => {
      // Bulk purchase
      const purchaseItem = testData.testItems[0]; // Bronze hatchets
      if (this.storeSystem) {
        // Assume purchaseItem method exists on store system
        try {
          const success = await this.storeSystem.purchaseItem(
            testData.player.id,
            purchaseItem.itemId,
            purchaseItem.quantity,
            purchaseItem.expectedPrice
          );

          if (success) {
            testData.itemsPurchased += purchaseItem.quantity;
            testData.coinsSpent += purchaseItem.expectedPrice * purchaseItem.quantity;
          }
        } catch (_error) {
          // Removed console.warn('[StoreTestSystem] Purchase item warning:', _error);
        }
      } else {
        // Removed console.warn('[StoreTestSystem] Store system or purchaseItem method not available');
      }

      // Wait then bulk sell
      setTimeout(async () => {
        const sellItem = testData.testItems[2]; // Logs
        if (this.storeSystem) {
          // Assume sellItem method exists on store system
          try {
            const success = await this.storeSystem.sellItem(
              testData.player.id,
              sellItem.itemId,
              sellItem.quantity,
              sellItem.expectedPrice
            );

            if (success) {
              testData.itemsSold += sellItem.quantity;
              testData.coinsEarned += sellItem.expectedPrice * sellItem.quantity;
            }
          } catch (_error) {
            // Removed console.warn('[StoreTestSystem] Bulk sell error:', _error);
          }
        }

        this.completeBulkStoreTest(stationId);
      }, 2000);
    }, 2000);
  }

  private completePurchaseTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    testData.finalCoins = testData.player.inventory.coins;

    const results = {
      itemsPurchased: testData.itemsPurchased,
      expectedPurchases: testData.testItems.length,
      coinsSpent: testData.coinsSpent,
      initialCoins: testData.initialCoins,
      finalCoins: testData.finalCoins,
      duration: Date.now() - testData.startTime
    };

    if (testData.itemsPurchased >= testData.testItems.length * 0.8) { // 80% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Purchase test failed: ${testData.itemsPurchased}/${testData.testItems.length} items purchased`);
    }
  }

  private completeInsufficientFundsTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    testData.finalCoins = testData.player.inventory.coins;

    const results = {
      itemsPurchased: testData.itemsPurchased,
      expectedPurchases: 3, // Only 3 items should be affordable with 10 coins
      coinsSpent: testData.coinsSpent,
      initialCoins: testData.initialCoins,
      finalCoins: testData.finalCoins,
      duration: Date.now() - testData.startTime
    };

    // For insufficient funds test, we expect exactly 3 purchases (bronze_hatchet, tinderbox, and arrows)
    if (testData.itemsPurchased === 3) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Insufficient funds test failed: ${testData.itemsPurchased}/3 affordable items purchased`);
    }
  }

  private completeSellTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    testData.finalCoins = testData.player.inventory.coins;

    const results = {
      itemsSold: testData.itemsSold,
      expectedSales: testData.testItems.length,
      coinsEarned: testData.coinsEarned,
      initialCoins: testData.initialCoins,
      finalCoins: testData.finalCoins,
      duration: Date.now() - testData.startTime
    };

    if (testData.itemsSold >= testData.testItems.length * 0.8) { // 80% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Sell test failed: ${testData.itemsSold}/${testData.testItems.length} items sold`);
    }
  }

  private completeStockLimitTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const totalStock = Object.values(testData.storeInventory).reduce((sum, item) => sum + item.stock, 0);
    const originalStock = 2 + 1 + 100; // Original stock amounts

    const results = {
      itemsPurchased: testData.itemsPurchased,
      coinsSpent: testData.coinsSpent,
      stockRemaining: totalStock,
      stockConsumed: originalStock - totalStock,
      limitedByStock: testData.itemsPurchased < testData.testItems.reduce((sum, item) => sum + item.quantity, 0),
      duration: Date.now() - testData.startTime
    };

    if (results.limitedByStock && testData.itemsPurchased > 0) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Stock limit test failed: should be limited by stock but purchased ${testData.itemsPurchased} items`);
    }
  }

  private completeBulkStoreTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsPurchased: testData.itemsPurchased,
      itemsSold: testData.itemsSold,
      coinsSpent: testData.coinsSpent,
      coinsEarned: testData.coinsEarned,
      netCoins: testData.coinsEarned - testData.coinsSpent,
      duration: Date.now() - testData.startTime
    };

    if (testData.itemsPurchased >= 10 && testData.itemsSold >= 100) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Bulk store test failed: purchased=${testData.itemsPurchased}, sold=${testData.itemsSold}`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up store visuals
      this.emitTypedEvent(EventType.TEST_STORE_REMOVE, {
        id: `store_${stationId}`
      });

      // Clean up NPC visual
      this.emitTypedEvent(EventType.TEST_NPC_REMOVE, {
        id: `store_npc_${stationId}`
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.player.id);
      
      // Emit cleanup events
      this.emitTypedEvent(EventType.TEST_PLAYER_REMOVE, {
        id: `fake_player_${testData.player.id}`
      });
      
      this.testData.delete(stationId);
    }
    
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
    
    // Check for advanced store features
    const hasBasicPurchase = this.testStations.has('basic_purchase_test');
    const hasBasicSell = this.testStations.has('basic_sell_test');
    const hasInsufficientFunds = this.testStations.has('insufficient_funds_test');
    const hasStockLimits = this.testStations.has('stock_limit_test');
    const hasBulkOperations = this.testStations.has('bulk_store_test');
    
    const advancedFeatureCount = [
      hasBasicPurchase, hasBasicSell, hasInsufficientFunds, hasStockLimits, hasBulkOperations
    ].filter(Boolean).length;
    
    // Check store performance with real validation
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.itemsPurchased > 0) {
        // Store performance validation logic
        const transactionEfficiency = (testData.itemsPurchased + testData.itemsSold) / Math.max(1, testData.coinsSpent + testData.coinsEarned) * 100;
        if (transactionEfficiency > 0.1) { // At least some reasonable transaction rate
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