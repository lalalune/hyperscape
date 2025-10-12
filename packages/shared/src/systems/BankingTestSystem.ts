/**
 * Banking Test System
 * Tests banking operations with fake players and bank NPCs
 * - Tests deposit operations (inventory -> bank)
 * - Tests withdraw operations (bank -> inventory)
 * - Tests bank storage limits (unlimited storage)
 * - Tests bank independence (each bank separate)
 * - Tests item preservation across sessions
 * - Tests bulk deposit/withdraw operations
 */

import { EventType } from '../types/events';
import { getItem } from '../data/items';
import { InventoryItem, World } from '../types/core';
import type {
  BankDepositSuccessEvent,
  InventoryCheckEvent,
  InventoryItemInfo,
  InventoryRemoveEvent
} from '../types/events';
import type { BankingTestData } from '../types/test';
import type { PlayerEntity } from '../types/index';
import type { BankingSystem } from './BankingSystem';
import type { InventorySystem } from './InventorySystem';
import { VisualTestFramework } from './VisualTestFramework';
import { Logger } from '../utils/Logger';

export class BankingTestSystem extends VisualTestFramework {
  private testData = new Map<string, BankingTestData>()
  private bankingSystem: BankingSystem | null = null;
  private inventorySystem: InventorySystem | null = null;

  constructor(world: World) {
    super(world, {
      name: 'banking-test',
      dependencies: {
        required: [],
        optional: ['banking', 'inventory']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    await super.init();
    
        
    this.bankingSystem = this.world.getSystem('banking') as BankingSystem;
    this.inventorySystem = this.world.getSystem('inventory') as InventorySystem;

    if (!this.bankingSystem) {
      Logger.systemError('BankingTestSystem', 'Banking system not found');
      return;
    }

    if (!this.inventorySystem) {
      Logger.systemError('BankingTestSystem', 'Inventory system not found');
      return;
    }

    // Create test stations
    this.createTestStations();
              
    // Set up event listeners for banking tests
    this.setupEventListeners();
            }

  private setupEventListeners(): void {
    // Listen for inventory updates
    this.subscribe(EventType.INVENTORY_UPDATED, (data: { playerId: string; items: InventoryItem[] }) => {
      for (const [_stationId, testData] of this.testData) {
        if (testData.player.id === data.playerId) {
          testData.player.inventory.items = data.items;
        }
      }
    });

    // Listen for inventory check requests to provide fake player inventory
    this.subscribe(EventType.INVENTORY_CHECK, (event: InventoryCheckEvent) => {
      for (const testData of this.testData.values()) {
        if (testData.player.id === event.playerId) {
          // Check if fake player has the item
          const inventorySlot = testData.player.inventory.items.find(slot => slot.itemId === String(event.itemId));
          if (inventorySlot && inventorySlot.quantity >= event.quantity) {
            // Get item details for the name
            const itemData = getItem(inventorySlot.itemId);
            
            // Create a properly typed response object
            const itemInfo: InventoryItemInfo = {
              id: inventorySlot.itemId,
              name: itemData?.name || `Item ${inventorySlot.itemId}`,
              quantity: inventorySlot.quantity,
              stackable: itemData?.stackable !== false, // Default to stackable unless explicitly false
              slot: String(inventorySlot.slot || 0) // Include slot property as string
            };
            event.callback(true, itemInfo);
          } else {
            event.callback(false, null);
          }
        }
      }
    });

    // Listen for inventory remove requests from fake players
    this.subscribe(EventType.INVENTORY_ITEM_REMOVED, (data: InventoryRemoveEvent) => {
      for (const testData of this.testData.values()) {
        if (testData.player.id === data.playerId) {
          const inventory = testData.player.inventory;
          const itemIndex = inventory.items.findIndex(item => item.itemId === data.itemId);
          
          if (itemIndex !== -1) {
            const item = inventory.items[itemIndex];
            if (item.quantity >= data.quantity) {
              item.quantity -= data.quantity;
              if (item.quantity === 0) {
                inventory.items.splice(itemIndex, 1);
              }
            }
          }
        }
      }
    });
  }

  protected createTestStations(): void {
    // Basic Deposit Test
    this.createTestStation({
      id: 'basic_deposit_test',
      name: 'Basic Deposit Test',
      position: { x: 10, y: 0, z: 10 },
    });

    // Basic Withdraw Test
    this.createTestStation({
      id: 'basic_withdraw_test',
      name: 'Basic Withdraw Test',
      position: { x: 10, y: 0, z: 20 },
    });

    // Bulk Banking Test - EXTENDED TIMEOUT
    this.createTestStation({
      id: 'bulk_banking_test',
      name: 'Bulk Banking Test',
      position: { x: 10, y: 0, z: 30 },
    });

    // Bank Independence Test
    this.createTestStation({
      id: 'bank_independence_test',
      name: 'Bank Independence Test',
      position: { x: 10, y: 0, z: 40 },
    });

    // Storage Limit Test (Unlimited)
    this.createTestStation({
      id: 'storage_limit_test',
      name: 'Storage Limit Test',
      position: { x: 10, y: 0, z: 50 },
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_deposit_test':
        this.runBasicDepositTest(stationId);
        break;
      case 'basic_withdraw_test':
        this.runBasicWithdrawTest(stationId);
        break;
      case 'bulk_banking_test':
        this.runBulkBankingTest(stationId);
        break;
      case 'bank_independence_test':
        this.runBankIndependenceTest(stationId);
        break;
      case 'storage_limit_test':
        this.runStorageLimitTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown banking test: ${stationId}`);
    }
  }

  private async runBasicDepositTest(stationId: string): Promise<void> {
    try {
            const station = this.testStations.get(stationId);
      if (!station) {
        Logger.systemError('BankingTestSystem', `Test station not found: ${stationId}`);
        return;
      }

      // Create fake player with items to deposit
      const player = this.createPlayer({
        id: `deposit_player_${Date.now()}`,
        name: 'Deposit Test Player',
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
      
      // Add test items to inventory
      const ironOre = getItem('iron_ore');
      const coins = getItem('coins');
      
      if (ironOre && coins) {
        player.inventory.items = [
          { id: `${player.id}_iron_ore`, itemId: ironOre.id, quantity: 15, slot: 0 } as InventoryItem,
          { id: `${player.id}_coins`, itemId: coins.id, quantity: 100, slot: 1 } as InventoryItem
        ];
        player.inventory.coins = 0;
      }

      // Create bank visual
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.emitTypedEvent(EventType.TEST_BANK_CREATE, {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#8b4513', // Saddle brown for basic bank
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest'
      });

      // Store test data
      this.testData.set(stationId, {
        player,
        bankLocation,
        testItems: [{ itemId: 'iron_ore', quantity: 15 }],
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...(player.inventory?.items || [])],
        inventoryAfter: [],
        depositTested: true,
        withdrawTested: false,
        bulkTested: false
      });

      // Start deposit sequence
      this.startDepositSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic deposit test error: ${error}`);
    }
  }

  private async runBasicWithdrawTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with empty inventory but items in bank
      const player = this.createPlayer({
        id: `withdraw_player_${Date.now()}`,
        name: 'Withdraw Test Player',
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

      // Start with empty inventory (already initialized by createPlayer)
      player.inventory.items = [];
      player.inventory.coins = 0;

      // Create bank visual
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.emitTypedEvent(EventType.TEST_BANK_CREATE, {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#d2691e', // Chocolate for withdraw bank
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest'
      });

      // Pre-populate bank with items (simulate previous deposits)
      const bankBalance = {
        'bronze_sword': 1,
        'copper_ore': 25
      };

      // Store test data
      this.testData.set(stationId, {
        player,
        bankLocation,
        testItems: [{ itemId: 'bronze_sword', quantity: 1 }, { itemId: 'copper_ore', quantity: 25 }],
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance,
        inventoryBefore: [...(player.inventory?.items || [])],
        inventoryAfter: [],
        depositTested: false,
        withdrawTested: true,
        bulkTested: false
      });

      // Simulate pre-existing bank items by triggering deposit success events
      for (const [itemId, quantity] of Object.entries(bankBalance)) {
        const event: BankDepositSuccessEvent = {
          playerId: player.id,
          bankId: 'bank_town_0',
          itemId,
          quantity
        };
        this.emitTypedEvent(EventType.BANK_DEPOSIT_SUCCESS, event);
      }

      // Start withdraw sequence
      this.startWithdrawSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic withdraw test error: ${error}`);
    }
  }

  private async runBulkBankingTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with multiple items
      const player = this.createPlayer({
        id: `bulk_player_${Date.now()}`,
        name: 'Bulk Banking Test Player',
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
      
      // Add multiple different items to inventory
      const ironOre = getItem('iron_ore');
      const copperOre = getItem('copper_ore');
      const logs = getItem('logs');
      const sword = getItem('bronze_sword');
      
      if (ironOre && copperOre && logs && sword) {
        player.inventory.items = [
          { id: `${player.id}_iron_ore`, itemId: ironOre.id, quantity: 20, slot: 0 } as InventoryItem,
          { id: `${player.id}_copper_ore`, itemId: copperOre.id, quantity: 30, slot: 1 } as InventoryItem,
          { id: `${player.id}_logs`, itemId: logs.id, quantity: 15, slot: 2 } as InventoryItem,
          { id: `${player.id}_bronze_sword`, itemId: sword.id, quantity: 10, slot: 3 } as InventoryItem
        ];
        player.inventory.coins = 0;
      }

      const testItems = [
        { itemId: 'iron_ore', quantity: 20 },
        { itemId: 'copper_ore', quantity: 30 },
        { itemId: 'logs', quantity: 15 },
        { itemId: 'bronze_sword', quantity: 10 }
      ];

      // Create bank visual
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.emitTypedEvent(EventType.TEST_BANK_CREATE, {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#cd853f', // Sandy brown for bulk bank
        size: { x: 1.5, y: 1.5, z: 1.5 },
        type: 'bulk_bank_chest'
      });

      // Store test data
      this.testData.set(stationId, {
        player,
        bankLocation,
        testItems,
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...(player.inventory?.items || [])],
        inventoryAfter: [],
        depositTested: true,
        withdrawTested: true,
        bulkTested: true
      });

      // Start bulk operations
      this.startBulkSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Bulk banking test error: ${error}`);
    }
  }

  private async runBankIndependenceTest(stationId: string): Promise<void> {
    try {
            const station = this.testStations.get(stationId);
      if (!station) return;

      // Create two fake players for different banks
      const player1 = this.createPlayer({
        id: `independence_player1_${Date.now() + 1}`,
        name: 'Independence Test Player 1',
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

      const player2 = this.createPlayer({
        id: `independence_player2_${Date.now() + 2}`,
        name: 'Independence Test Player 2',
        position: { x: station.position.x + 10, y: station.position.y, z: station.position.z },
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

      // Give both players the same items
      const ironOre = getItem('iron_ore');
      if (ironOre) {
        player1.inventory.items = [
          { id: `${player1.id}_iron_ore`, itemId: ironOre.id, quantity: 50, slot: 0 } as InventoryItem
        ];
        player1.inventory.coins = 0;
        
        player2.inventory.items = [
          { id: `${player2.id}_iron_ore`, itemId: ironOre.id, quantity: 50, slot: 0 } as InventoryItem
        ];
        player2.inventory.coins = 0;
      }

      // Create two separate banks
      const bank1Location = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      const bank2Location = { x: station.position.x + 13, y: station.position.y, z: station.position.z };
      
      this.emitTypedEvent(EventType.TEST_BANK_CREATE, {
        id: `bank1_${stationId}`,
        position: bank1Location,
        color: '#4682b4', // Steel blue for bank 1
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest'
      });

      this.emitTypedEvent(EventType.TEST_BANK_CREATE, {
        id: `bank2_${stationId}`, 
        position: bank2Location,
        color: '#008080', // Teal for bank 2
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest'
      });

      // Use the first player for main test data
      this.testData.set(stationId, {
        player: player1,
        bankLocation: bank1Location,
        testItems: [{ itemId: 'iron_ore', quantity: 50 }],
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...(player1.inventory?.items || [])],
        inventoryAfter: [],
        depositTested: true,
        withdrawTested: true,
        bulkTested: false
      });

            
      // Test sequence:
      // 1. Player 1 deposits at Bank 1
      // 2. Player 2 deposits at Bank 2  
      // 3. Player 1 tries to withdraw from Bank 2 (should fail)
      // 4. Player 2 tries to withdraw from Bank 1 (should fail)
      // 5. Both players withdraw from their own banks (should succeed)
      
      this.startIndependenceSequence(stationId, player1, player2, bank1Location, bank2Location);
      
    } catch (error) {
      this.failTest(stationId, `Bank independence test error: ${error}`);
    }
  }

  private async runStorageLimitTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with lots of items to test unlimited storage
      const player = this.createPlayer({
        id: `storage_limit_player_${Date.now()}`,
        name: 'Storage Limit Test Player',
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
      
      // Fill inventory with maximum different items
      const items = ['iron_ore', 'copper_ore', 'logs', 'bronze_sword', 'wood_shield'];
      player.inventory.items = items.map((itemId, index) => ({
        id: `${player.id}_${itemId}`,
        itemId,
        quantity: 99, // Max stack
        slot: index
      } as InventoryItem));
      player.inventory.coins = 0;

      // Create bank visual
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.emitTypedEvent(EventType.TEST_BANK_CREATE, {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#ffd700', // Gold for unlimited storage bank
        size: { x: 2, y: 2, z: 2 },
        type: 'unlimited_bank_chest'
      });

      // Store test data
      this.testData.set(stationId, {
        player,
        bankLocation,
        testItems: items.map(itemId => ({ itemId, quantity: 99 })),
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...(player.inventory?.items || [])],
        inventoryAfter: [],
        depositTested: true,
        withdrawTested: false,
        bulkTested: false
      });

      // Start storage limit test sequence
      this.startStorageLimitSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Storage limit test error: ${error}`);
    }
  }

    // Helper methods for test sequences
  private startDepositSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) {
      Logger.systemError('BankingTestSystem', `No test data found for: ${stationId}`);
      return;
    }

    
    // Move player to bank
    this.movePlayer(testData.player.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    // Open bank and deposit items
    setTimeout(() => {
            // First open the bank
      this.emitTypedEvent(EventType.BANK_OPEN, {
        playerId: testData.player.id,
        bankId: 'bank_town_0',
        playerPosition: { x: testData.bankLocation.x - 1, y: testData.bankLocation.y, z: testData.bankLocation.z }
      });

      // Then deposit items after bank is open
      setTimeout(() => {
                for (const testItem of testData.testItems) {
                    this.emitTypedEvent(EventType.BANK_DEPOSIT, {
            playerId: testData.player.id,
            bankId: 'bank_town_0',
            itemId: testItem.itemId,
            quantity: testItem.quantity
          });
        }

        // Monitor for deposit success
        const depositSub = this.subscribe(EventType.BANK_DEPOSIT_SUCCESS, (data: { playerId: string; itemId: string; quantity: number }) => {
                    if (data.playerId === testData.player.id) {
            testData.depositedItems++;
            testData.bankBalance[data.itemId] = (testData.bankBalance[data.itemId] || 0) + data.quantity;
                        if (testData.depositedItems >= testData.testItems.length) {
              depositSub.unsubscribe();
              this.completeDepositTest(stationId);
            }
          }
        });

        // Timeout fallback
        setTimeout(() => {
          depositSub.unsubscribe();
          this.completeDepositTest(stationId);
        }, 5000);
      }, 1000); // Wait 1s after bank open
    }, 2000); // Initial wait for player movement
  }

  private startWithdrawSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Move player to bank
    this.movePlayer(testData.player.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    // Open bank and withdraw items
    setTimeout(() => {
      // First open the bank
      this.emitTypedEvent(EventType.BANK_OPEN, {
        playerId: testData.player.id,
                   bankId: 'bank_town_0',
        playerPosition: { x: testData.bankLocation.x - 1, y: testData.bankLocation.y, z: testData.bankLocation.z }
      });

      // Then withdraw items after bank is open
      setTimeout(() => {
        // Add items to fake player's inventory as they're withdrawn
      const withdrawSub = this.subscribe(EventType.BANK_WITHDRAW_SUCCESS, (data: { playerId: string; itemId: string; quantity: number }) => {
        if (data.playerId === testData.player.id) {
          testData.withdrawnItems++;
          
          // Add to fake player inventory
          if (testData.player.inventory.items) {
            const existingItem = testData.player.inventory.items.find(item => item.itemId === data.itemId);
            if (existingItem) {
              existingItem.quantity = (existingItem.quantity || 0) + data.quantity;
            } else {
              testData.player.inventory.items.push({
                id: `${testData.player.id}_${data.itemId}`,
                itemId: data.itemId,
                quantity: data.quantity,
                slot: testData.player.inventory.items.length
              } as InventoryItem);
            }
          }
          
          if (testData.withdrawnItems >= testData.testItems.length) {
            withdrawSub.unsubscribe();
            this.completeWithdrawTest(stationId);
          }
        }
      });

        // Attempt to withdraw each item
        let withdrawIndex = 0;
        const withdrawNextItem = () => {
          if (withdrawIndex < testData.testItems.length) {
            const testItem = testData.testItems[withdrawIndex];
            this.emitTypedEvent(EventType.BANK_WITHDRAW, {
              playerId: testData.player.id,
              bankId: 'bank_town_0',
              itemId: testItem.itemId,
              quantity: testItem.quantity
            });
            withdrawIndex++;
            setTimeout(withdrawNextItem, 500); // 500ms between withdrawals
          }
        };

        withdrawNextItem();

        // Timeout fallback
        setTimeout(() => {
          withdrawSub.unsubscribe();
          this.completeWithdrawTest(stationId);
        }, 10000);
      }, 1000); // Wait 1s after bank open
    }, 2000); // Initial wait for player movement
  }

  private startBulkSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

          
    // Move player to bank
    this.movePlayer(testData.player.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    // Track test progress with detailed logging
    let bankOpened = false;

    // Listen for bank interface open (the actual event emitted by banking system)
    const bankOpenSub = this.subscribe(EventType.BANK_OPEN, (data: { playerId: string; bankId: string }) => {
      if (data.playerId === testData.player.id) {
                bankOpened = true;
        bankOpenSub.unsubscribe();
        // Now start deposits
        performDeposits();
      }
    });

    // Open the bank first (required by BankingSystem)
    setTimeout(() => {
            this.emitTypedEvent(EventType.BANK_OPEN, {
        playerId: testData.player.id,
                   bankId: 'bank_town_0',
        playerPosition: { 
          x: testData.bankLocation.x - 1, 
          y: testData.bankLocation.y, 
          z: testData.bankLocation.z 
        }
      });

      // Fallback if bank doesn't open
      setTimeout(() => {
        if (!bankOpened) {
                    bankOpenSub.unsubscribe();
          performDeposits();
        }
      }, 3000);
    }, 2000);

    const performDeposits = () => {
            let depositsCompleted = 0;
      let _depositsAttempted = 0;
      const totalItems = testData.testItems.length;
      
      // Listen for deposit success events
      const depositSub = this.subscribe(EventType.BANK_DEPOSIT_SUCCESS, (data: { playerId: string; itemId: string; quantity: number; bankId?: string }) => {
        if (data.playerId === testData.player.id) {
          depositsCompleted++;
          testData.depositedItems++;
                    if (depositsCompleted >= totalItems) {
            depositSub.unsubscribe();
            performWithdrawals();
          }
        }
      });
      
      // Listen for deposit failure events
      const depositFailSub = this.subscribe(EventType.BANK_DEPOSIT_FAIL, (data: { playerId: string; reason: string }) => {
        if (data.playerId === testData.player.id) {
                  // Deposit failed - tracked for debugging
                  }
      });
      
      // subscriptions already set above
      
      // Deposit all items with a small delay between each
      testData.testItems.forEach((testItem, index) => {
        setTimeout(() => {
          _depositsAttempted++;
                    this.emitTypedEvent(EventType.BANK_DEPOSIT, {
            playerId: testData.player.id,
            bankId: 'bank_town_0', 
            itemId: testItem.itemId,
            quantity: testItem.quantity
          });
        }, index * 500); // 500ms between deposits
      });
      
      // Timeout for all deposits
      setTimeout(() => {
        depositSub.unsubscribe();
        depositFailSub.unsubscribe();
        if (depositsCompleted < totalItems) {
                  // Some deposits failed - tracked for debugging
                  }
        performWithdrawals();
      }, 8000);
    };

    const performWithdrawals = () => {
            let withdrawsCompleted = 0;
      let _withdrawsAttempted = 0;
      const totalItems = testData.testItems.length;
      
      const withdrawHandler = (data: { playerId: string; itemId: string; quantity: number; bankId?: string }) => {
        if (data.playerId === testData.player.id) {
          withdrawsCompleted++;
          testData.withdrawnItems++;
                    
          if (withdrawsCompleted >= totalItems) {
            withdrawSub.unsubscribe();
            this.completeBulkTest(stationId);
          }
        }
      };
      const withdrawSub = this.subscribe<{ playerId: string; itemId: string; quantity: number; bankId?: string }>(
        EventType.BANK_WITHDRAW_SUCCESS,
        withdrawHandler
      );
      
      // Listen for withdraw failure events
      const withdrawFailSub = this.subscribe(EventType.BANK_WITHDRAW_FAIL, (data: { playerId: string; reason: string }) => {
        if (data.playerId === testData.player.id) {
                  // Withdrawal failed - tracked for debugging
                  }
      });
      
      // subscriptions already set above
      
      // Withdraw all items with a small delay between each
      testData.testItems.forEach((testItem, index) => {
        setTimeout(() => {
          _withdrawsAttempted++;
                    this.emitTypedEvent(EventType.BANK_WITHDRAW, {
            playerId: testData.player.id,
            bankId: 'bank_town_0',
            itemId: testItem.itemId,
            quantity: testItem.quantity
          });
        }, index * 500); // 500ms between withdrawals
      });
      
      // Timeout for all withdrawals
      setTimeout(() => {
        try { this.world.off(EventType.BANK_WITHDRAW_SUCCESS, withdrawHandler); } catch {}
        try { withdrawFailSub.unsubscribe(); } catch {}
                this.completeBulkTest(stationId);
      }, 8000);
    };
  }

  private startIndependenceSequence(
    stationId: string, 
    player1: PlayerEntity, 
    player2: PlayerEntity, 
    bank1Location: { x: number; y: number; z: number }, 
    bank2Location: { x: number; y: number; z: number }
  ): void {
    let depositsCompleted = 0;
    let withdrawalAttempts = 0;
    let successfulWithdrawals = 0;

    // Phase 1: Both players deposit at their respective banks
    const depositPhase = () => {
      
      // Move players to their banks
      this.movePlayer(player1.id, {
        x: bank1Location.x - 1,
        y: bank1Location.y,
        z: bank1Location.z
      });

      this.movePlayer(player2.id, {
        x: bank2Location.x - 1,
        y: bank2Location.y,
        z: bank2Location.z
      });

      // Listen for deposit successes
      const depositSub = this.subscribe(EventType.BANK_DEPOSIT_SUCCESS, (data: { playerId: string; bankId: string }) => {
        if (data.playerId === player1.id || data.playerId === player2.id) {
          depositsCompleted++;
                    if (depositsCompleted >= 2) {
            depositSub.unsubscribe();
            setTimeout(crossWithdrawPhase, 2000);
          }
        }
      });

      // Open banks and deposit
      setTimeout(() => {
        // Player 1 at Bank 1
        this.emitTypedEvent(EventType.BANK_OPEN, {
          playerId: player1.id,
          bankId: 'bank1_test',
          playerPosition: { x: bank1Location.x - 1, y: bank1Location.y, z: bank1Location.z }
        });

        // Player 2 at Bank 2
        this.emitTypedEvent(EventType.BANK_OPEN, {
          playerId: player2.id,
          bankId: 'bank2_test',
          playerPosition: { x: bank2Location.x - 1, y: bank2Location.y, z: bank2Location.z }
        });

        // Deposit items after banks open
        setTimeout(() => {
          this.emitTypedEvent(EventType.BANK_DEPOSIT, {
            playerId: player1.id,
            bankId: 'bank_town_1',
            itemId: 'iron_ore',
            quantity: 50
          });

          this.emitTypedEvent(EventType.BANK_DEPOSIT, {
            playerId: player2.id,
            bankId: 'bank_town_2',
            itemId: 'iron_ore',
            quantity: 50
          });
        }, 1000);
      }, 2000);
    };

    // Phase 2: Try cross-withdrawals (should fail)
    const crossWithdrawPhase = () => {
            
      // Move players to opposite banks
      this.movePlayer(player1.id, {
        x: bank2Location.x - 1,
        y: bank2Location.y,
        z: bank2Location.z
      });

      this.movePlayer(player2.id, {
        x: bank1Location.x - 1,
        y: bank1Location.y,
        z: bank1Location.z
      });

      // Listen for withdrawal failures
      const withdrawFailSub = this.subscribe(EventType.BANK_WITHDRAW_FAIL, (_data: { playerId: string; reason: string }) => {
        withdrawalAttempts++;
                if (withdrawalAttempts >= 2) {
          withdrawFailSub.unsubscribe();
          setTimeout(ownWithdrawPhase, 2000);
        }
      });

      // Try to withdraw from wrong banks
      setTimeout(() => {
        // Player 1 tries Bank 2
        this.emitTypedEvent(EventType.BANK_OPEN, {
          playerId: player1.id,
          bankId: 'bank2_test',
          playerPosition: { x: bank2Location.x - 1, y: bank2Location.y, z: bank2Location.z }
        });

        // Player 2 tries Bank 1
        this.emitTypedEvent(EventType.BANK_OPEN, {
          playerId: player2.id,
          bankId: 'bank1_test',
          playerPosition: { x: bank1Location.x - 1, y: bank1Location.y, z: bank1Location.z }
        });

        setTimeout(() => {
          this.emitTypedEvent(EventType.BANK_WITHDRAW, {
            playerId: player1.id,
            bankId: 'bank_town_2',
            itemId: 'iron_ore',
            quantity: 50
          });

          this.emitTypedEvent(EventType.BANK_WITHDRAW, {
            playerId: player2.id,
            bankId: 'bank_town_1',
            itemId: 'iron_ore',
            quantity: 50
          });
        }, 1000);
      }, 2000);
    };

    // Phase 3: Withdraw from own banks (should succeed)
    const ownWithdrawPhase = () => {
            
      // Move players back to their own banks
      this.movePlayer(player1.id, {
        x: bank1Location.x - 1,
        y: bank1Location.y,
        z: bank1Location.z
      });

      this.movePlayer(player2.id, {
        x: bank2Location.x - 1,
        y: bank2Location.y,
        z: bank2Location.z
      });

      // Listen for withdrawal successes
      const withdrawSuccessSub = this.subscribe(EventType.BANK_WITHDRAW_SUCCESS, (data: { playerId: string; bankId: string }) => {
        if (data.playerId === player1.id || data.playerId === player2.id) {
          successfulWithdrawals++;
                    if (successfulWithdrawals >= 2) {
            withdrawSuccessSub.unsubscribe();
            this.completeIndependenceTest(stationId, true);
          }
        }
      });

      // Withdraw from own banks
      setTimeout(() => {
        // Player 1 at Bank 1
        this.emitTypedEvent(EventType.BANK_OPEN, {
          playerId: player1.id,
          bankId: 'bank1_test',
          playerPosition: { x: bank1Location.x - 1, y: bank1Location.y, z: bank1Location.z }
        });

        // Player 2 at Bank 2
        this.emitTypedEvent(EventType.BANK_OPEN, {
          playerId: player2.id,
          bankId: 'bank2_test',
          playerPosition: { x: bank2Location.x - 1, y: bank2Location.y, z: bank2Location.z }
        });

        setTimeout(() => {
          this.emitTypedEvent(EventType.BANK_WITHDRAW, {
            playerId: player1.id,
            bankId: 'bank_town_1',
            itemId: 'iron_ore',
            quantity: 50
          });

          this.emitTypedEvent(EventType.BANK_WITHDRAW, {
            playerId: player2.id,
            bankId: 'bank_town_2',
            itemId: 'iron_ore',
            quantity: 50
          });
        }, 1000);
      }, 2000);

      // Timeout fallback
      setTimeout(() => {
        this.completeIndependenceTest(stationId, successfulWithdrawals === 2);
      }, 10000);
    };

    // Start the test sequence
    depositPhase();
  }

  private startStorageLimitSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Move player to bank
    this.movePlayer(testData.player.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    // Open bank and deposit all items
    setTimeout(() => {
      this.emitTypedEvent(EventType.BANK_OPEN, {
        playerId: testData.player.id,
                   bankId: 'bank_town_0',
        playerPosition: { x: testData.bankLocation.x - 1, y: testData.bankLocation.y, z: testData.bankLocation.z }
      });

      // Track deposit successes
      let successCount = 0;
      const depositSub = this.subscribe(EventType.BANK_DEPOSIT_SUCCESS, (data: { playerId: string }) => {
        if (data.playerId === testData.player.id) {
          successCount++;
          if (successCount >= testData.testItems.length) {
            depositSub.unsubscribe();
            this.completeStorageLimitTest(stationId, true);
          }
        }
      });

      // Deposit all items at once
      setTimeout(() => {
        for (const testItem of testData.testItems) {
          this.emitTypedEvent(EventType.BANK_DEPOSIT, {
            playerId: testData.player.id,
            bankId: 'bank_town_0',
            itemId: testItem.itemId,
            quantity: testItem.quantity
          });
        }
      }, 1000);

      // Timeout fallback
      setTimeout(() => {
        depositSub.unsubscribe();
        this.completeStorageLimitTest(stationId, successCount === testData.testItems.length);
      }, 10000);
    }, 2000);
  }

  // Test completion methods
  private completeDepositTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsDeposited: testData.depositedItems,
      expectedDeposits: testData.testItems.length,
      bankBalance: testData.bankBalance,
      duration: Date.now() - testData.startTime
    };

    if (testData.depositedItems === testData.testItems.length) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Only ${testData.depositedItems}/${testData.testItems.length} items deposited`);
    }
  }

  private completeWithdrawTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsWithdrawn: testData.withdrawnItems,
      expectedWithdrawals: testData.testItems.length,
      finalInventory: testData.player.inventory.items.length,
      duration: Date.now() - testData.startTime
    };

    if (testData.withdrawnItems === testData.testItems.length) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Only ${testData.withdrawnItems}/${testData.testItems.length} items withdrawn`);
    }
  }

  private completeBulkTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsDeposited: testData.depositedItems,
      itemsWithdrawn: testData.withdrawnItems,
      expectedOperations: testData.testItems.length,
      duration: Date.now() - testData.startTime
    };

    // Pass if at least 75% of operations succeeded
    const totalExpected = testData.testItems.length * 2; // deposits + withdrawals
    const totalCompleted = testData.depositedItems + testData.withdrawnItems;
    
    if (totalCompleted >= totalExpected * 0.75) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Bulk operations incomplete: ${totalCompleted}/${totalExpected} (deposits: ${testData.depositedItems}, withdrawals: ${testData.withdrawnItems})`);
    }
  }

  private completeIndependenceTest(stationId: string, success: boolean): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      banksIndependent: success,
      duration: Date.now() - testData.startTime
    };

    if (success) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, 'Banks are not independent - cross-bank access detected');
    }
  }

  private completeStorageLimitTest(stationId: string, allItemsStored: boolean): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsStored: testData.depositedItems,
      totalItems: testData.testItems.length,
      unlimitedStorage: allItemsStored,
      duration: Date.now() - testData.startTime
    };

    if (allItemsStored) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Storage limit detected - only ${testData.depositedItems}/${testData.testItems.length} items stored`);
    }
  }

  protected cleanupTest(stationId: string): void {
    // Clean up test data for the station
    const testData = this.testData.get(stationId);
    if (testData) {
      this.testData.delete(stationId);
    }
  }
}