/**
 * Inventory Systems E2E Tests
 * Tests inventory, banking, looting, and item management
 * Visual verification with real gameplay testing
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Inventory System - Add and Remove Items', () => {
  test('Should add item to first empty slot', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { items: Array<{ slot: number; itemId: string; quantity: number }> } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_inv',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const inventorySystem = world.getSystem('inventory');
      const invBefore = inventorySystem?.getInventory?.('player_inv');
      const itemsBefore = invBefore?.items.length ?? 0;

      // Add logs
      world.emit('inventory:item:added', {
        playerId: 'player_inv',
        item: {
          itemId: 'logs',
          quantity: 5,
        },
      });

      const invAfter = inventorySystem?.getInventory?.('player_inv');
      const logsItem = invAfter?.items.find(item => item.itemId === 'logs');

      return {
        itemsBefore,
        itemsAfter: invAfter?.items.length ?? 0,
        logsQuantity: logsItem?.quantity ?? 0,
        logsSlot: logsItem?.slot ?? -1,
      };
    });

    expect(result?.itemsAfter).toBe((result?.itemsBefore ?? 0) + 1);
    expect(result?.logsQuantity).toBe(5);
    expect(result?.logsSlot).toBeGreaterThanOrEqual(0);
  });

  test('Stackable items should stack to existing slots', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { items: Array<{ itemId: string; quantity: number; slot: number }> } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_stack',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Add 10 arrows
      world.emit('inventory:item:added', {
        playerId: 'player_stack',
        item: { itemId: 'arrows', quantity: 10 },
      });

      const inventorySystem = world.getSystem('inventory');
      const inv1 = inventorySystem?.getInventory?.('player_stack');
      const slotsBefore = inv1?.items.length ?? 0;

      // Add 20 more arrows (should stack)
      world.emit('inventory:item:added', {
        playerId: 'player_stack',
        item: { itemId: 'arrows', quantity: 20 },
      });

      const inv2 = inventorySystem?.getInventory?.('player_stack');
      const arrowItem = inv2?.items.find(item => item.itemId === 'arrows');

      return {
        slotsBefore,
        slotsAfter: inv2?.items.length ?? 0,
        totalArrows: arrowItem?.quantity ?? 0,
      };
    });

    // Should still be 1 slot (stacked)
    expect(result?.slotsAfter).toBe(result?.slotsBefore);
    expect(result?.totalArrows).toBe(30);
  });

  test('Should reject adding items when inventory full (28 slots)', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    let inventoryFull = false;

    page.on('console', (msg) => {
      if (msg.text().includes('inventory full') || msg.text().includes('INVENTORY_FULL')) {
        inventoryFull = true;
      }
    });

    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return;

      world.entities.add({
        id: 'player_full',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Fill inventory with 28 non-stackable items
      for (let i = 0; i < 28; i++) {
        world.emit('inventory:item:added', {
          playerId: 'player_full',
          item: {
            itemId: `unique_item_${i}`,
            quantity: 1,
            stackable: false,
          },
        });
      }

      // Try to add one more (should fail)
      world.emit('inventory:item:added', {
        playerId: 'player_full',
        item: { itemId: 'extra_item', quantity: 1 },
      });
    });

    await page.waitForTimeout(500);

    expect(inventoryFull).toBe(true);
  });

  test('Should remove items from inventory', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { items: Array<{ itemId: string; quantity: number }> } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_remove',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Add logs
      world.emit('inventory:item:added', {
        playerId: 'player_remove',
        item: { itemId: 'logs', quantity: 10 },
      });

      const inventorySystem = world.getSystem('inventory');
      const invBefore = inventorySystem?.getInventory?.('player_remove');
      const logsBefore = invBefore?.items.find(i => i.itemId === 'logs')?.quantity ?? 0;

      // Remove 3 logs
      world.emit('inventory:item:removed', {
        playerId: 'player_remove',
        itemId: 'logs',
        quantity: 3,
      });

      const invAfter = inventorySystem?.getInventory?.('player_remove');
      const logsAfter = invAfter?.items.find(i => i.itemId === 'logs')?.quantity ?? 0;

      return {
        logsBefore,
        logsAfter,
      };
    });

    expect(result?.logsAfter).toBe((result?.logsBefore ?? 0) - 3);
  });
});

test.describe('Banking System - Deposit and Withdraw', () => {
  test('Should deposit items from inventory to bank', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { items: Array<{ itemId: string; quantity: number }> }; getBankData?: (playerId: string, bankId: string) => { items: Array<{ id: string; quantity: number }> } | null } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_bank',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Add logs to inventory
      world.emit('inventory:item:added', {
        playerId: 'player_bank',
        item: { itemId: 'logs', quantity: 15 },
      });

      // Open bank
      world.emit('bank:open', {
        playerId: 'player_bank',
        bankId: 'bank_town_0',
      });

      const inventorySystem = world.getSystem('inventory');
      const invBefore = inventorySystem?.getInventory?.('player_bank');
      const logsBefore = invBefore?.items.find(i => i.itemId === 'logs')?.quantity ?? 0;

      // Deposit 10 logs
      world.emit('bank:deposit', {
        playerId: 'player_bank',
        itemId: 'logs',
        quantity: 10,
      });

      const invAfter = inventorySystem?.getInventory?.('player_bank');
      const logsAfter = invAfter?.items.find(i => i.itemId === 'logs')?.quantity ?? 0;

      const bankingSystem = world.getSystem('banking');
      const bankData = bankingSystem?.getBankData?.('player_bank', 'bank_town_0');
      const logsInBank = bankData?.items.find(i => i.id === 'logs')?.quantity ?? 0;

      return {
        logsBefore,
        logsAfter,
        logsInBank,
      };
    });

    expect(result?.logsAfter).toBe((result?.logsBefore ?? 0) - 10);
    expect(result?.logsInBank).toBe(10);
  });

  test('Should withdraw items from bank to inventory', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { items: Array<{ itemId: string; quantity: number }> }; getBankData?: (playerId: string, bankId: string) => { items: Array<{ id: string; quantity: number }> } | null } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_withdraw',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Open bank and add items directly
      world.emit('bank:open', {
        playerId: 'player_withdraw',
        bankId: 'bank_town_0',
      });

      // Deposit first
      world.emit('inventory:item:added', {
        playerId: 'player_withdraw',
        item: { itemId: 'raw_shrimps', quantity: 20 },
      });

      world.emit('bank:deposit', {
        playerId: 'player_withdraw',
        itemId: 'raw_shrimps',
        quantity: 20,
      });

      const inventorySystem = world.getSystem('inventory');
      const invBefore = inventorySystem?.getInventory?.('player_withdraw');
      const fishBefore = invBefore?.items.find(i => i.itemId === 'raw_shrimps')?.quantity ?? 0;

      // Withdraw
      world.emit('bank:withdraw', {
        playerId: 'player_withdraw',
        itemId: 'raw_shrimps',
        quantity: 5,
      });

      const invAfter = inventorySystem?.getInventory?.('player_withdraw');
      const fishAfter = invAfter?.items.find(i => i.itemId === 'raw_shrimps')?.quantity ?? 0;

      return {
        fishBefore,
        fishAfter,
      };
    });

    expect(result?.fishAfter).toBe((result?.fishBefore ?? 0) + 5);
  });

  test('Banks should be independent (no shared storage)', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getBankData?: (playerId: string, bankId: string) => { items: Array<{ id: string; quantity: number }> } | null } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_banks',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Deposit to bank 0
      world.emit('bank:open', {
        playerId: 'player_banks',
        bankId: 'bank_town_0',
      });

      world.emit('inventory:item:added', {
        playerId: 'player_banks',
        item: { itemId: 'logs', quantity: 10 },
      });

      world.emit('bank:deposit', {
        playerId: 'player_banks',
        itemId: 'logs',
        quantity: 10,
      });

      world.emit('bank:close', {
        playerId: 'player_banks',
        bankId: 'bank_town_0',
      });

      const bankingSystem = world.getSystem('banking');
      const bank0 = bankingSystem?.getBankData?.('player_banks', 'bank_town_0');
      const bank1 = bankingSystem?.getBankData?.('player_banks', 'bank_town_1');

      return {
        bank0Items: bank0?.items.length ?? 0,
        bank1Items: bank1?.items.length ?? 0,
      };
    });

    expect(result?.bank0Items).toBe(1);
    expect(result?.bank1Items).toBe(0); // Bank 1 should be empty
  });
});

test.describe('Loot System - Drop and Pickup', () => {
  test('Mob should drop loot on death', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    let lootDropped = false;

    page.on('console', (msg) => {
      if (msg.text().includes('LOOT_DROPPED') || msg.text().includes('loot dropped')) {
        lootDropped = true;
      }
    });

    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return;

      world.entities.add({
        id: 'goblin_loot',
        type: 'mob',
        mobType: 'goblin',
        position: [5, 5, 5],
        lootTable: 'goblin_drops',
      }, true);

      // Kill mob
      world.emit('mob:died', {
        mobId: 'goblin_loot',
        mobType: 'goblin',
        level: 2,
        killedBy: 'test_player',
        position: { x: 5, y: 5, z: 5 },
      });
    });

    await page.waitForTimeout(1000);

    expect(lootDropped).toBe(true);
  });

  test('Player should pick up ground items', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { items: Array<{ itemId: string; quantity: number }> } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_pickup',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      // Create ground item
      const groundItem = world.entities.add({
        id: 'ground_sword',
        type: 'item',
        position: [1, 5, 0], // Near player
        itemId: 'bronze_sword',
        quantity: 1,
      }, true);

      const inventorySystem = world.getSystem('inventory');
      const invBefore = inventorySystem?.getInventory?.('player_pickup');
      const itemsBefore = invBefore?.items.length ?? 0;

      // Pick up item
      world.emit('item:pickup', {
        playerId: 'player_pickup',
        entityId: 'ground_sword',
        itemId: 'bronze_sword',
      });

      const invAfter = inventorySystem?.getInventory?.('player_pickup');
      const hasSword = invAfter?.items.some(i => i.itemId === 'bronze_sword');

      return {
        itemsBefore,
        itemsAfter: invAfter?.items.length ?? 0,
        hasSword: hasSword ?? false,
      };
    });

    expect(result?.itemsAfter).toBeGreaterThan(result?.itemsBefore ?? 0);
    expect(result?.hasSword).toBe(true);
  });
});

test.describe('Inventory System - Coins', () => {
  test('Should add and remove coins correctly', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { coins: number } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_coins',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const inventorySystem = world.getSystem('inventory');
      const coinsBefore = inventorySystem?.getInventory?.('player_coins')?.coins ?? 0;

      // Add coins
      world.emit('inventory:update:coins', {
        playerId: 'player_coins',
        coins: coinsBefore + 50,
      });

      const coinsAfterAdd = inventorySystem?.getInventory?.('player_coins')?.coins ?? 0;

      // Remove coins
      world.emit('inventory:remove:coins', {
        playerId: 'player_coins',
        amount: 30,
        callback: (success: boolean) => {
          return success;
        },
      });

      const coinsAfterRemove = inventorySystem?.getInventory?.('player_coins')?.coins ?? 0;

      return {
        coinsBefore,
        coinsAfterAdd,
        coinsAfterRemove,
      };
    });

    expect(result?.coinsAfterAdd).toBe((result?.coinsBefore ?? 0) + 50);
    expect(result?.coinsAfterRemove).toBe((result?.coinsAfterAdd ?? 0) - 30);
  });

  test('Should reject coin removal if insufficient funds', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const canRemove = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getInventory?: (id: string) => { coins: number } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_poor',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      let removalSuccess = false;

      // Try to remove more coins than available
      world.emit('inventory:remove:coins', {
        playerId: 'player_poor',
        amount: 500, // Player only has 100
        callback: (success: boolean) => {
          removalSuccess = success;
        },
      });

      return removalSuccess;
    });

    expect(canRemove).toBe(false);
  });
});

test.describe('Inventory System - Item Drop on Death', () => {
  test('Should drop all items at death location per GDD', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    let allItemsDropped = false;

    page.on('console', (msg) => {
      if (msg.text().includes('INVENTORY_DROP_ALL') || msg.text().includes('drop all')) {
        allItemsDropped = true;
      }
    });

    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return;

      world.entities.add({
        id: 'player_death_items',
        type: 'player',
        position: [10, 5, 10],
      }, true);

      // Add items
      world.emit('inventory:item:added', {
        playerId: 'player_death_items',
        item: { itemId: 'logs', quantity: 10 },
      });

      world.emit('inventory:item:added', {
        playerId: 'player_death_items',
        item: { itemId: 'raw_shrimps', quantity: 5 },
      });

      // Trigger death
      world.emit('entity:death', {
        entityId: 'player_death_items',
        killedBy: 'goblin',
        entityType: 'player',
      });
    });

    await page.waitForTimeout(1000);

    expect(allItemsDropped).toBe(true);
  });
});

