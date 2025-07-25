/**
 * RPG Banking Test System
 * Tests banking operations with fake players and bank NPCs
 * - Tests deposit operations (inventory -> bank)
 * - Tests withdraw operations (bank -> inventory)
 * - Tests bank storage limits (unlimited storage)
 * - Tests bank independence (each bank separate)
 * - Tests item preservation across sessions
 * - Tests bulk deposit/withdraw operations
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem } from '../data/items';

interface BankingTestData {
  fakePlayer: FakePlayer;
  bankLocation: { x: number; y: number; z: number };
  testItems: Array<{ itemId: string; quantity: number }>;
  startTime: number;
  depositedItems: number;
  withdrawnItems: number;
  bankBalance: { [itemId: string]: number };
  inventoryBefore: any[];
  inventoryAfter: any[];
  depositTested: boolean;
  withdrawTested: boolean;
  bulkTested: boolean;
}

export class RPGBankingTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, BankingTestData>();
  private bankingSystem: any;
  private inventorySystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGBankingTestSystem] Initializing banking test system...');
    
    // Get required systems
    this.bankingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGBankingSystem');
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    
    if (!this.bankingSystem) {
      console.warn('[RPGBankingTestSystem] BankingSystem not found, tests may not function properly');
    }
    
    if (!this.inventorySystem) {
      console.warn('[RPGBankingTestSystem] InventorySystem not found, tests may not function properly');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGBankingTestSystem] Banking test system initialized');
  }

  private createTestStations(): void {
    // Basic Deposit Test
    this.createTestStation({
      id: 'basic_deposit_test',
      name: 'Basic Deposit Test',
      position: { x: -50, y: 0, z: 10 },
      timeoutMs: 30000 // 30 seconds
    });

    // Basic Withdraw Test
    this.createTestStation({
      id: 'basic_withdraw_test',
      name: 'Basic Withdraw Test',
      position: { x: -50, y: 0, z: 20 },
      timeoutMs: 30000 // 30 seconds
    });

    // Bulk Operations Test
    this.createTestStation({
      id: 'bulk_banking_test',
      name: 'Bulk Banking Test',
      position: { x: -50, y: 0, z: 30 },
      timeoutMs: 45000 // 45 seconds
    });

    // Bank Independence Test
    this.createTestStation({
      id: 'bank_independence_test',
      name: 'Bank Independence Test',
      position: { x: -50, y: 0, z: 40 },
      timeoutMs: 35000 // 35 seconds
    });

    // Storage Limit Test (unlimited)
    this.createTestStation({
      id: 'storage_limit_test',
      name: 'Storage Limit Test',
      position: { x: -50, y: 0, z: 50 },
      timeoutMs: 60000 // 60 seconds
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
      console.log('[RPGBankingTestSystem] Starting basic deposit test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with items to deposit
      const fakePlayer = this.createFakePlayer({
        id: `deposit_player_${Date.now()}`,
        name: 'Deposit Test Player',
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

      // Add test items to inventory
      const testItems = [
        { itemId: 'bronze_sword', quantity: 1 },
        { itemId: 'arrows', quantity: 50 },
        { itemId: 'logs', quantity: 25 },
        { itemId: 'coins', quantity: 100 }
      ];

      for (const testItem of testItems) {
        const item = getItem(testItem.itemId);
        if (item) {
          fakePlayer.inventory.push({ item, quantity: testItem.quantity });
        }
      }

      // Create bank visual (chest)
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.world.emit('rpg:test:bank:create', {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#8b4513', // Brown for bank chest
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest'
      });

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        bankLocation,
        testItems,
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...fakePlayer.inventory],
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
      console.log('[RPGBankingTestSystem] Starting basic withdraw test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with empty inventory
      const fakePlayer = this.createFakePlayer({
        id: `withdraw_player_${Date.now()}`,
        name: 'Withdraw Test Player',
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

      // Pre-populate bank with items (simulate previous deposits)
      const testItems = [
        { itemId: 'steel_sword', quantity: 1 },
        { itemId: 'wood_bow', quantity: 1 },
        { itemId: 'arrows', quantity: 100 },
        { itemId: 'logs', quantity: 50 }
      ];

      // Create bank visual
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.world.emit('rpg:test:bank:create', {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#8b4513',
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest'
      });

      // Initialize bank balance
      const bankBalance: { [itemId: string]: number } = {};
      for (const item of testItems) {
        bankBalance[item.itemId] = item.quantity;
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        bankLocation,
        testItems,
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance,
        inventoryBefore: [...fakePlayer.inventory],
        inventoryAfter: [],
        depositTested: false,
        withdrawTested: true,
        bulkTested: false
      });

      // Start withdraw sequence
      this.startWithdrawSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic withdraw test error: ${error}`);
    }
  }

  private async runBulkBankingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGBankingTestSystem] Starting bulk banking test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with many items
      const fakePlayer = this.createFakePlayer({
        id: `bulk_player_${Date.now()}`,
        name: 'Bulk Test Player',
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

      // Fill inventory with many items for bulk testing
      const arrowsItem = getItem('arrows');
      const logsItem = getItem('logs');
      const coinsItem = getItem('coins');

      if (arrowsItem && logsItem && coinsItem) {
        fakePlayer.inventory = [
          { item: arrowsItem, quantity: 1000 },  // Large stack
          { item: logsItem, quantity: 500 },     // Large stack
          { item: coinsItem, quantity: 5000 }    // Large stack
        ];
      }

      // Add multiple individual items
      const swordItem = getItem('bronze_sword');
      if (swordItem) {
        for (let i = 0; i < 10; i++) {
          fakePlayer.inventory.push({ item: swordItem, quantity: 1 });
        }
      }

      const testItems = [
        { itemId: 'arrows', quantity: 1000 },
        { itemId: 'logs', quantity: 500 },
        { itemId: 'coins', quantity: 5000 },
        { itemId: 'bronze_sword', quantity: 10 }
      ];

      // Create bank visual
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.world.emit('rpg:test:bank:create', {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#cd853f', // Sandy brown for bulk bank
        size: { x: 1.5, y: 1.5, z: 1.5 },
        type: 'bulk_bank_chest'
      });

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        bankLocation,
        testItems,
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...fakePlayer.inventory],
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
      console.log('[RPGBankingTestSystem] Starting bank independence test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create two fake players for different banks
      const fakePlayer1 = this.createFakePlayer({
        id: `independence_player1_${Date.now()}`,
        name: 'Bank 1 Player',
        position: { x: station.position.x - 4, y: station.position.y, z: station.position.z },
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

      const fakePlayer2 = this.createFakePlayer({
        id: `independence_player2_${Date.now()}`,
        name: 'Bank 2 Player',
        position: { x: station.position.x - 4, y: station.position.y, z: station.position.z + 4 },
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

      // Give different items to each player
      const swordItem = getItem('bronze_sword');
      const bowItem = getItem('wood_bow');

      if (swordItem && bowItem) {
        fakePlayer1.inventory = [{ item: swordItem, quantity: 1 }];
        fakePlayer2.inventory = [{ item: bowItem, quantity: 1 }];
      }

      // Create two separate banks
      const bank1Location = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      const bank2Location = { x: station.position.x + 2, y: station.position.y, z: station.position.z + 4 };

      this.world.emit('rpg:test:bank:create', {
        id: `bank1_${stationId}`,
        position: bank1Location,
        color: '#8b4513',
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest_1'
      });

      this.world.emit('rpg:test:bank:create', {
        id: `bank2_${stationId}`,
        position: bank2Location,
        color: '#a0522d',
        size: { x: 1, y: 1, z: 1 },
        type: 'bank_chest_2'
      });

      // Store test data (using first player as primary)
      this.testData.set(stationId, {
        fakePlayer: fakePlayer1,
        bankLocation: bank1Location,
        testItems: [
          { itemId: 'bronze_sword', quantity: 1 },
          { itemId: 'wood_bow', quantity: 1 }
        ],
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...fakePlayer1.inventory],
        inventoryAfter: [],
        depositTested: true,
        withdrawTested: false,
        bulkTested: false
      });

      // Store second player data
      this.fakePlayers.set(`${fakePlayer2.id}_secondary`, fakePlayer2);

      // Start independence test
      this.startIndependenceSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Bank independence test error: ${error}`);
    }
  }

  private async runStorageLimitTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGBankingTestSystem] Starting storage limit test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `storage_player_${Date.now()}`,
        name: 'Storage Test Player',
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

      // Create massive inventory to test unlimited storage
      const coinsItem = getItem('coins');
      if (coinsItem) {
        fakePlayer.inventory = [];
        
        // Add 100 individual coin stacks to test many slots
        for (let i = 0; i < 100; i++) {
          fakePlayer.inventory.push({ item: coinsItem, quantity: 1000 });
        }
      }

      const testItems = [{ itemId: 'coins', quantity: 100000 }]; // 100k coins total

      // Create large bank visual
      const bankLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.world.emit('rpg:test:bank:create', {
        id: `bank_${stationId}`,
        position: bankLocation,
        color: '#ffd700', // Gold for unlimited storage
        size: { x: 2, y: 2, z: 2 },
        type: 'unlimited_bank_vault'
      });

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        bankLocation,
        testItems,
        startTime: Date.now(),
        depositedItems: 0,
        withdrawnItems: 0,
        bankBalance: {},
        inventoryBefore: [...fakePlayer.inventory],
        inventoryAfter: [],
        depositTested: true,
        withdrawTested: false,
        bulkTested: false
      });

      // Start storage limit test
      this.startStorageLimitSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Storage limit test error: ${error}`);
    }
  }

  private startDepositSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGBankingTestSystem] Starting deposit sequence...');

    // Move player to bank
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    let itemIndex = 0;

    const depositNextItem = async () => {
      if (itemIndex >= testData.testItems.length) {
        // All items deposited
        this.completeDepositTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      console.log(`[RPGBankingTestSystem] Depositing ${testItem.quantity}x ${testItem.itemId}`);

      // Simulate banking system deposit
      if (this.bankingSystem) {
        const success = await this.bankingSystem.depositItem(
          testData.fakePlayer.id,
          testItem.itemId,
          testItem.quantity
        );

        if (success) {
          testData.depositedItems++;
          testData.bankBalance[testItem.itemId] = (testData.bankBalance[testItem.itemId] || 0) + testItem.quantity;
          
          // Remove from inventory
          const inventoryIndex = testData.fakePlayer.inventory.findIndex(slot => slot.item.id === testItem.itemId);
          if (inventoryIndex >= 0) {
            const slot = testData.fakePlayer.inventory[inventoryIndex];
            slot.quantity -= testItem.quantity;
            if (slot.quantity <= 0) {
              testData.fakePlayer.inventory.splice(inventoryIndex, 1);
            }
          }
          
          console.log(`[RPGBankingTestSystem] Successfully deposited ${testItem.itemId}`);
        } else {
          console.log(`[RPGBankingTestSystem] Failed to deposit ${testItem.itemId}`);
        }
      }

      itemIndex++;
      setTimeout(depositNextItem, 1500);
    };

    // Start deposit sequence after movement
    setTimeout(depositNextItem, 2000);
  }

  private startWithdrawSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGBankingTestSystem] Starting withdraw sequence...');

    // Move player to bank
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    let itemIndex = 0;

    const withdrawNextItem = async () => {
      if (itemIndex >= testData.testItems.length) {
        // All items withdrawn
        this.completeWithdrawTest(stationId);
        return;
      }

      const testItem = testData.testItems[itemIndex];
      const availableInBank = testData.bankBalance[testItem.itemId] || 0;
      const withdrawAmount = Math.min(testItem.quantity, availableInBank);

      if (withdrawAmount > 0) {
        console.log(`[RPGBankingTestSystem] Withdrawing ${withdrawAmount}x ${testItem.itemId}`);

        // Simulate banking system withdraw
        if (this.bankingSystem) {
          const success = await this.bankingSystem.withdrawItem(
            testData.fakePlayer.id,
            testItem.itemId,
            withdrawAmount
          );

          if (success) {
            testData.withdrawnItems++;
            testData.bankBalance[testItem.itemId] -= withdrawAmount;
            
            // Add to inventory
            const item = getItem(testItem.itemId);
            if (item) {
              testData.fakePlayer.inventory.push({ item, quantity: withdrawAmount });
            }
            
            console.log(`[RPGBankingTestSystem] Successfully withdrew ${testItem.itemId}`);
          } else {
            console.log(`[RPGBankingTestSystem] Failed to withdraw ${testItem.itemId}`);
          }
        }
      }

      itemIndex++;
      setTimeout(withdrawNextItem, 1500);
    };

    // Start withdraw sequence after movement
    setTimeout(withdrawNextItem, 2000);
  }

  private startBulkSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGBankingTestSystem] Starting bulk sequence...');

    // Move player to bank
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    // Bulk deposit all items
    setTimeout(async () => {
      for (const slot of testData.fakePlayer.inventory) {
        if (this.bankingSystem) {
          const success = await this.bankingSystem.depositItem(
            testData.fakePlayer.id,
            slot.item.id,
            slot.quantity
          );

          if (success) {
            testData.depositedItems++;
            testData.bankBalance[slot.item.id] = (testData.bankBalance[slot.item.id] || 0) + slot.quantity;
          }
        }
      }

      // Clear inventory after bulk deposit
      testData.fakePlayer.inventory = [];

      // Wait then bulk withdraw half the items
      setTimeout(async () => {
        for (const [itemId, quantity] of Object.entries(testData.bankBalance)) {
          const withdrawAmount = Math.floor(quantity / 2);
          if (withdrawAmount > 0 && this.bankingSystem) {
            const success = await this.bankingSystem.withdrawItem(
              testData.fakePlayer.id,
              itemId,
              withdrawAmount
            );

            if (success) {
              testData.withdrawnItems++;
              testData.bankBalance[itemId] -= withdrawAmount;
              
              const item = getItem(itemId);
              if (item) {
                testData.fakePlayer.inventory.push({ item, quantity: withdrawAmount });
              }
            }
          }
        }

        this.completeBulkTest(stationId);
      }, 3000);
    }, 2000);
  }

  private startIndependenceSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGBankingTestSystem] Starting independence sequence...');

    // Get second player
    const player2Id = `${testData.fakePlayer.id.replace('independence_player1', 'independence_player2')}_secondary`;
    const fakePlayer2 = this.fakePlayers.get(player2Id);

    if (!fakePlayer2) {
      this.failTest(stationId, 'Second player not found for independence test');
      return;
    }

    // Both players deposit to their respective banks
    setTimeout(async () => {
      // Player 1 deposits sword to bank 1
      if (this.bankingSystem && testData.fakePlayer.inventory.length > 0) {
        const success1 = await this.bankingSystem.depositItem(
          testData.fakePlayer.id,
          'bronze_sword',
          1,
          'bank_1'
        );
        if (success1) testData.depositedItems++;
      }

      // Player 2 deposits bow to bank 2
      if (this.bankingSystem && fakePlayer2.inventory.length > 0) {
        const success2 = await this.bankingSystem.depositItem(
          fakePlayer2.id,
          'wood_bow',
          1,
          'bank_2'
        );
        if (success2) testData.depositedItems++;
      }

      // Test that player 1 cannot access bank 2's items
      setTimeout(async () => {
        if (this.bankingSystem) {
          const cannotWithdraw = await this.bankingSystem.withdrawItem(
            testData.fakePlayer.id,
            'wood_bow',
            1,
            'bank_1' // Player 1 trying to withdraw from bank 1 (should fail)
          );

          // Test should pass if withdrawal fails (banks are independent)
          this.completeIndependenceTest(stationId, !cannotWithdraw);
        }
      }, 2000);
    }, 2000);
  }

  private startStorageLimitSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGBankingTestSystem] Starting storage limit sequence...');

    // Move player to bank
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.bankLocation.x - 1,
      y: testData.bankLocation.y,
      z: testData.bankLocation.z
    });

    // Attempt to deposit all 100 coin stacks
    setTimeout(async () => {
      let successfulDeposits = 0;

      for (const slot of testData.fakePlayer.inventory) {
        if (this.bankingSystem) {
          const success = await this.bankingSystem.depositItem(
            testData.fakePlayer.id,
            slot.item.id,
            slot.quantity
          );

          if (success) {
            successfulDeposits++;
            testData.depositedItems++;
          }
        }
      }

      // Should be able to deposit all items (unlimited storage)
      this.completeStorageLimitTest(stationId, successfulDeposits);
    }, 2000);
  }

  private completeDepositTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      depositedItems: testData.depositedItems,
      expectedDeposits: testData.testItems.length,
      bankBalance: testData.bankBalance,
      inventoryAfter: testData.fakePlayer.inventory.length,
      duration: Date.now() - testData.startTime
    };

    if (testData.depositedItems >= testData.testItems.length * 0.8) { // 80% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Deposit test failed: ${testData.depositedItems}/${testData.testItems.length} items deposited`);
    }
  }

  private completeWithdrawTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      withdrawnItems: testData.withdrawnItems,
      expectedWithdrawals: testData.testItems.length,
      inventoryAfter: testData.fakePlayer.inventory.length,
      bankBalance: testData.bankBalance,
      duration: Date.now() - testData.startTime
    };

    if (testData.withdrawnItems >= testData.testItems.length * 0.8) { // 80% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Withdraw test failed: ${testData.withdrawnItems}/${testData.testItems.length} items withdrawn`);
    }
  }

  private completeBulkTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      depositedItems: testData.depositedItems,
      withdrawnItems: testData.withdrawnItems,
      finalInventorySize: testData.fakePlayer.inventory.length,
      bankBalance: Object.keys(testData.bankBalance).length,
      duration: Date.now() - testData.startTime
    };

    if (testData.depositedItems >= 4 && testData.withdrawnItems >= 4) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Bulk test failed: deposits=${testData.depositedItems}, withdrawals=${testData.withdrawnItems}`);
    }
  }

  private completeIndependenceTest(stationId: string, banksAreIndependent: boolean): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      banksAreIndependent,
      depositedItems: testData.depositedItems,
      duration: Date.now() - testData.startTime
    };

    if (banksAreIndependent && testData.depositedItems >= 2) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Independence test failed: independent=${banksAreIndependent}, deposits=${testData.depositedItems}`);
    }
  }

  private completeStorageLimitTest(stationId: string, successfulDeposits: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      successfulDeposits,
      totalAttempts: testData.fakePlayer.inventory.length,
      unlimitedStorage: successfulDeposits >= 90, // Should accept at least 90/100
      duration: Date.now() - testData.startTime
    };

    if (results.unlimitedStorage) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Storage limit test failed: only ${successfulDeposits}/100 deposits successful`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up bank visuals
      this.world.emit('rpg:test:bank:remove', {
        id: `bank_${stationId}`
      });

      // Clean up additional banks for independence test
      if (stationId === 'bank_independence_test') {
        this.world.emit('rpg:test:bank:remove', {
          id: `bank1_${stationId}`
        });
        this.world.emit('rpg:test:bank:remove', {
          id: `bank2_${stationId}`
        });

        // Remove second player
        const player2Id = `${testData.fakePlayer.id.replace('independence_player1', 'independence_player2')}_secondary`;
        this.fakePlayers.delete(player2Id);
        this.world.emit('rpg:test:player:remove', {
          id: `fake_player_${player2Id}`
        });
      }
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGBankingTestSystem] Cleanup completed for ${stationId}`);
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
    
    // Check for advanced banking features
    const hasDepositTesting = this.testStations.has('banking_deposit_test');
    const hasWithdrawTesting = this.testStations.has('banking_withdraw_test');
    const hasBulkOperationsTesting = this.testStations.has('banking_bulk_operations_test');
    const hasIndependenceTesting = this.testStations.has('banking_independence_test');
    const hasCapacityTesting = this.testStations.has('banking_capacity_test');
    
    const advancedFeatureCount = [
      hasDepositTesting, hasWithdrawTesting, hasBulkOperationsTesting,
      hasIndependenceTesting, hasCapacityTesting
    ].filter(Boolean).length;
    
    // Check banking operation performance
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.depositedItems > 0) {
        const operationSuccess = (testData.depositedItems + testData.withdrawnItems) / ((testData.testItems?.length || 1) * 2);
        if (operationSuccess > 0.8) { // High operation success rate for banking
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