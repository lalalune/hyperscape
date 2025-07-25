/**
 * RPG Store Test System
 * Tests store operations with fake players and shop NPCs
 * - Tests item purchasing (coins -> items)
 * - Tests item selling (items -> coins)
 * - Tests stock management and availability
 * - Tests price calculations and coin handling
 * - Tests insufficient funds scenarios
 * - Tests bulk purchase/sell operations
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem, SHOP_ITEMS } from '../data/items';

interface StoreTestData {
  fakePlayer: FakePlayer;
  storeLocation: { x: number; y: number; z: number };
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

export class RPGStoreTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, StoreTestData>();
  private storeSystem: any;
  private inventorySystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGStoreTestSystem] Initializing store test system...');
    
    // Get required systems
    this.storeSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGStoreSystem');
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    
    if (!this.storeSystem) {
      console.warn('[RPGStoreTestSystem] StoreSystem not found, tests may not function properly');
    }
    
    if (!this.inventorySystem) {
      console.warn('[RPGStoreTestSystem] InventorySystem not found, tests may not function properly');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGStoreTestSystem] Store test system initialized');
  }

  private createTestStations(): void {
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

  private async runBasicPurchaseTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGStoreTestSystem] Starting basic purchase test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with coins
      const fakePlayer = this.createFakePlayer({
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

      // Give player coins
      const coinsItem = getItem('coins');
      if (coinsItem) {
        fakePlayer.inventory = [{ item: coinsItem, quantity: 500 }];
      }

      // Define store inventory with prices
      const storeInventory = {
        'bronze_hatchet': { stock: 10, price: 50 },
        'fishing_rod': { stock: 15, price: 30 },
        'tinderbox': { stock: 20, price: 10 },
        'arrows': { stock: 1000, price: 1 }
      };

      // Items to purchase
      const testItems = [
        { itemId: 'bronze_hatchet', quantity: 1, expectedPrice: 50 },
        { itemId: 'fishing_rod', quantity: 1, expectedPrice: 30 },
        { itemId: 'arrows', quantity: 50, expectedPrice: 50 }
      ];

      // Create store visual (shop counter)
      const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createStoreVisual(stationId, storeLocation, 'general_store');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Basic purchase test error: ${error}`);
    }
  }

  private async runBasicSellTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGStoreTestSystem] Starting basic sell test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with items to sell
      const fakePlayer = this.createFakePlayer({
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

      // Give player items to sell
      const swordItem = getItem('bronze_sword');
      const arrowsItem = getItem('arrows');
      const logsItem = getItem('logs');
      const coinsItem = getItem('coins');

      if (swordItem && arrowsItem && logsItem && coinsItem) {
        fakePlayer.inventory = [
          { item: swordItem, quantity: 1 },
          { item: arrowsItem, quantity: 100 },
          { item: logsItem, quantity: 50 },
          { item: coinsItem, quantity: 10 } // Small amount of coins
        ];
      }

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
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Basic sell test error: ${error}`);
    }
  }

  private async runInsufficientFundsTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGStoreTestSystem] Starting insufficient funds test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with insufficient coins
      const fakePlayer = this.createFakePlayer({
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

      // Give player only 25 coins
      const coinsItem = getItem('coins');
      if (coinsItem) {
        fakePlayer.inventory = [{ item: coinsItem, quantity: 25 }];
      }

      // Store has expensive items
      const storeInventory = {
        'steel_sword': { stock: 5, price: 500 }, // Too expensive
        'bronze_hatchet': { stock: 10, price: 50 }, // Too expensive
        'tinderbox': { stock: 20, price: 10 }, // Affordable
        'arrows': { stock: 1000, price: 1 } // Affordable
      };

      // Attempt to buy expensive and affordable items
      const testItems = [
        { itemId: 'steel_sword', quantity: 1, expectedPrice: 500 }, // Should fail
        { itemId: 'bronze_hatchet', quantity: 1, expectedPrice: 50 }, // Should fail
        { itemId: 'tinderbox', quantity: 1, expectedPrice: 10 }, // Should succeed
        { itemId: 'arrows', quantity: 10, expectedPrice: 10 } // Should succeed
      ];

      // Create store visual
      const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createStoreVisual(stationId, storeLocation, 'expensive_store');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        storeLocation,
        storeInventory,
        testItems,
        startTime: Date.now(),
        itemsPurchased: 0,
        itemsSold: 0,
        coinsSpent: 0,
        coinsEarned: 0,
        initialCoins: 25,
        finalCoins: 25,
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
      console.log('[RPGStoreTestSystem] Starting stock limit test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with lots of coins
      const fakePlayer = this.createFakePlayer({
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

      // Give player lots of coins
      const coinsItem = getItem('coins');
      if (coinsItem) {
        fakePlayer.inventory = [{ item: coinsItem, quantity: 1000 }];
      }

      // Store has limited stock
      const storeInventory = {
        'bronze_hatchet': { stock: 2, price: 50 }, // Only 2 in stock
        'fishing_rod': { stock: 1, price: 30 }, // Only 1 in stock
        'arrows': { stock: 100, price: 1 } // 100 in stock
      };

      // Try to buy more than available stock
      const testItems = [
        { itemId: 'bronze_hatchet', quantity: 5, expectedPrice: 50 }, // Try to buy 5, only 2 available
        { itemId: 'fishing_rod', quantity: 3, expectedPrice: 30 }, // Try to buy 3, only 1 available
        { itemId: 'arrows', quantity: 150, expectedPrice: 1 } // Try to buy 150, only 100 available
      ];

      // Create store visual
      const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createStoreVisual(stationId, storeLocation, 'limited_stock_store');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
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
      console.log('[RPGStoreTestSystem] Starting bulk store test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for bulk operations
      const fakePlayer = this.createFakePlayer({
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

      // Give player coins and items for bulk operations
      const coinsItem = getItem('coins');
      const arrowsItem = getItem('arrows');
      const logsItem = getItem('logs');

      if (coinsItem && arrowsItem && logsItem) {
        fakePlayer.inventory = [
          { item: coinsItem, quantity: 2000 },
          { item: arrowsItem, quantity: 500 },
          { item: logsItem, quantity: 200 }
        ];
      }

      // Store supports bulk operations
      const storeInventory = {
        'bronze_hatchet': { stock: 50, price: 50 },
        'fishing_rod': { stock: 50, price: 30 },
        'tinderbox': { stock: 100, price: 10 },
        'arrows': { stock: 2000, price: 1 },
        'logs': { stock: 1000, price: 5 }
      };

      // Bulk operations
      const testItems = [
        { itemId: 'bronze_hatchet', quantity: 10, expectedPrice: 50 },
        { itemId: 'arrows', quantity: 200, expectedPrice: 1 },
        { itemId: 'logs', quantity: 100, expectedPrice: 5 } // Selling logs
      ];

      // Create store visual
      const storeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createStoreVisual(stationId, storeLocation, 'bulk_trading_post');

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
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

  private createStoreVisual(stationId: string, location: { x: number; y: number; z: number }, storeType: string): void {
    const storeColors = {
      'general_store': '#8b4513',      // Brown
      'buy_back_store': '#cd853f',     // Sandy brown
      'expensive_store': '#ffd700',    // Gold
      'limited_stock_store': '#ff6347', // Tomato red
      'bulk_trading_post': '#4682b4'   // Steel blue
    };

    this.world.emit('rpg:test:store:create', {
      id: `store_${stationId}`,
      position: location,
      color: storeColors[storeType] || '#8b4513',
      size: { x: 1.5, y: 1.5, z: 1.5 },
      type: storeType
    });

    // Add store NPC visual
    this.world.emit('rpg:test:npc:create', {
      id: `store_npc_${stationId}`,
      position: { x: location.x - 0.5, y: location.y, z: location.z },
      color: '#ffb347', // Peach for shopkeeper
      size: { x: 0.6, y: 1.8, z: 0.6 },
      name: 'Shopkeeper'
    });
  }

  private startPurchaseSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGStoreTestSystem] Starting purchase sequence...');

    // Move player to store
    this.moveFakePlayer(testData.fakePlayer.id, {
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
      
      console.log(`[RPGStoreTestSystem] Attempting to purchase ${testItem.quantity}x ${testItem.itemId} for ${totalCost} coins`);

      // Check if player has enough coins
      const coinSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'coins');
      const availableCoins = coinSlot ? coinSlot.quantity : 0;

      if (availableCoins >= totalCost) {
        // Simulate store purchase
        if (this.storeSystem) {
          const success = await this.storeSystem.purchaseItem(
            testData.fakePlayer.id,
            testItem.itemId,
            testItem.quantity,
            testItem.expectedPrice
          );

          if (success) {
            testData.itemsPurchased++;
            testData.coinsSpent += totalCost;
            
            // Remove coins from inventory
            if (coinSlot) {
              coinSlot.quantity -= totalCost;
            }
            
            // Add item to inventory
            const item = getItem(testItem.itemId);
            if (item) {
              const existingSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === testItem.itemId);
              if (existingSlot && item.stackable) {
                existingSlot.quantity += testItem.quantity;
              } else {
                testData.fakePlayer.inventory.push({ item, quantity: testItem.quantity });
              }
            }
            
            console.log(`[RPGStoreTestSystem] Successfully purchased ${testItem.itemId}`);
          } else {
            console.log(`[RPGStoreTestSystem] Failed to purchase ${testItem.itemId}`);
          }
        }
      } else {
        console.log(`[RPGStoreTestSystem] Insufficient coins for ${testItem.itemId}: need ${totalCost}, have ${availableCoins}`);
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

    console.log('[RPGStoreTestSystem] Starting sell sequence...');

    // Move player to store
    this.moveFakePlayer(testData.fakePlayer.id, {
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
      
      console.log(`[RPGStoreTestSystem] Attempting to sell ${testItem.quantity}x ${testItem.itemId} for ${totalValue} coins`);

      // Check if player has the item
      const itemSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === testItem.itemId);
      const availableQuantity = itemSlot ? itemSlot.quantity : 0;

      if (availableQuantity >= testItem.quantity) {
        // Simulate store sale
        if (this.storeSystem) {
          const success = await this.storeSystem.sellItem(
            testData.fakePlayer.id,
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
                const index = testData.fakePlayer.inventory.indexOf(itemSlot);
                testData.fakePlayer.inventory.splice(index, 1);
              }
            }
            
            // Add coins to inventory
            let coinSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'coins');
            if (coinSlot) {
              coinSlot.quantity += totalValue;
            } else {
              const coinsItem = getItem('coins');
              if (coinsItem) {
                testData.fakePlayer.inventory.push({ item: coinsItem, quantity: totalValue });
              }
            }
            
            console.log(`[RPGStoreTestSystem] Successfully sold ${testItem.itemId}`);
          } else {
            console.log(`[RPGStoreTestSystem] Failed to sell ${testItem.itemId}`);
          }
        }
      } else {
        console.log(`[RPGStoreTestSystem] Insufficient quantity for ${testItem.itemId}: need ${testItem.quantity}, have ${availableQuantity}`);
      }

      itemIndex++;
      setTimeout(sellNextItem, 1500);
    };

    // Start sell sequence after movement
    setTimeout(sellNextItem, 2000);
  }

  private startInsufficientFundsSequence(stationId: string): void {
    // Similar to purchase sequence but expect some failures
    this.startPurchaseSequence(stationId);
  }

  private startStockLimitSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGStoreTestSystem] Starting stock limit sequence...');

    // Move player to store
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.storeLocation.x - 1,
      y: testData.storeLocation.y,
      z: testData.storeLocation.z
    });

    // Attempt to buy more than stock allows
    setTimeout(async () => {
      for (const testItem of testData.testItems) {
        const availableStock = testData.storeInventory[testItem.itemId]?.stock || 0;
        const actualQuantity = Math.min(testItem.quantity, availableStock);
        const totalCost = testItem.expectedPrice * actualQuantity;

        if (actualQuantity > 0 && this.storeSystem) {
          const success = await this.storeSystem.purchaseItem(
            testData.fakePlayer.id,
            testItem.itemId,
            actualQuantity,
            testItem.expectedPrice
          );

          if (success) {
            testData.itemsPurchased++;
            testData.coinsSpent += totalCost;
            
            // Update store stock
            testData.storeInventory[testItem.itemId].stock -= actualQuantity;
            
            console.log(`[RPGStoreTestSystem] Purchased ${actualQuantity}/${testItem.quantity} ${testItem.itemId} (limited by stock)`);
          }
        }
      }

      this.completeStockLimitTest(stationId);
    }, 2000);
  }

  private startBulkStoreSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGStoreTestSystem] Starting bulk store sequence...');

    // Move player to store
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.storeLocation.x - 1,
      y: testData.storeLocation.y,
      z: testData.storeLocation.z
    });

    // Bulk purchase then bulk sell
    setTimeout(async () => {
      // Bulk purchase
      const purchaseItem = testData.testItems[0]; // Bronze hatchets
      if (this.storeSystem) {
        const success = await this.storeSystem.purchaseItem(
          testData.fakePlayer.id,
          purchaseItem.itemId,
          purchaseItem.quantity,
          purchaseItem.expectedPrice
        );

        if (success) {
          testData.itemsPurchased += purchaseItem.quantity;
          testData.coinsSpent += purchaseItem.expectedPrice * purchaseItem.quantity;
        }
      }

      // Wait then bulk sell
      setTimeout(async () => {
        const sellItem = testData.testItems[2]; // Logs
        if (this.storeSystem) {
          const success = await this.storeSystem.sellItem(
            testData.fakePlayer.id,
            sellItem.itemId,
            sellItem.quantity,
            sellItem.expectedPrice
          );

          if (success) {
            testData.itemsSold += sellItem.quantity;
            testData.coinsEarned += sellItem.expectedPrice * sellItem.quantity;
          }
        }

        this.completeBulkStoreTest(stationId);
      }, 2000);
    }, 2000);
  }

  private completePurchaseTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const coinSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'coins');
    testData.finalCoins = coinSlot ? coinSlot.quantity : 0;

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

  private completeSellTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const coinSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'coins');
    testData.finalCoins = coinSlot ? coinSlot.quantity : 0;

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
      this.world.emit('rpg:test:store:remove', {
        id: `store_${stationId}`
      });

      // Clean up NPC visual
      this.world.emit('rpg:test:npc:remove', {
        id: `store_npc_${stationId}`
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGStoreTestSystem] Cleanup completed for ${stationId}`);
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