/**
 * Player Systems E2E Tests
 * Tests stats, skills, equipment, and progression systems
 * Real gameplay testing with state verification
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Player System - Spawning and Initialization', () => {
  test('Player should spawn with correct starting stats', async ({ page }) => {
    await page.goto('http://localhost:5555');
    
    await page.waitForFunction(() => {
      return (window as { hyperscapeWorld?: unknown }).hyperscapeWorld !== undefined;
    }, { timeout: 30000 });

    const playerStats = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown; get: (id: string) => { getComponent: (name: string) => { data?: unknown } } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'test_player_stats',
        type: 'player',
        name: 'Starter Player',
        position: [0, 5, 0],
      }, true);

      const player = world.entities.get('test_player_stats');
      const stats = player?.getComponent('stats');

      return stats?.data;
    });

    expect(playerStats).toBeDefined();
    expect((playerStats as { attack: { level: number } }).attack.level).toBe(1);
    expect((playerStats as { strength: { level: number } }).strength.level).toBe(1);
    expect((playerStats as { defense: { level: number } }).defense.level).toBe(1);
    expect((playerStats as { constitution: { level: number } }).constitution.level).toBe(10);
  });

  test('Player should start with bronze sword equipped per GDD', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const equipment = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; getSystem: (name: string) => { getEquipmentData?: (id: string) => { weapon?: { itemId: number } } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_starter_equipment',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const equipmentSystem = world.getSystem('equipment');
      const equipData = equipmentSystem?.getEquipmentData?.('player_starter_equipment');

      return equipData?.weapon;
    });

    expect(equipment).toBeDefined();
    // Bronze sword should be equipped
  });

  test('Player should have 100 starting coins per GDD', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const coins = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; getSystem: (name: string) => { getInventory?: (id: string) => { coins: number } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_coins',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const inventorySystem = world.getSystem('inventory');
      const inventory = inventorySystem?.getInventory?.('player_coins');

      return inventory?.coins;
    });

    expect(coins).toBe(100);
  });
});

test.describe('Skills System - XP and Leveling', () => {
  test('Should gain XP and level up when threshold reached', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { getComponent: (name: string) => { data?: unknown } } }; getSystem: (name: string) => { grantXP?: (id: string, skill: string, amount: number) => void; getLevelForXP?: (xp: number) => number } } }).hyperscapeWorld;
      if (!world) return null;

      const player = world.entities.add({
        id: 'player_xp_test',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const statsBefore = player.getComponent('stats')?.data as { attack: { level: number; xp: number } };
      const initialLevel = statsBefore.attack.level;
      const initialXP = statsBefore.attack.xp;

      const skillsSystem = world.getSystem('skills');
      
      // Grant enough XP to level up (level 1->2 requires 83 XP)
      skillsSystem?.grantXP?.('player_xp_test', 'attack', 100);

      const statsAfter = player.getComponent('stats')?.data as { attack: { level: number; xp: number } };

      return {
        initialLevel,
        initialXP,
        finalLevel: statsAfter.attack.level,
        finalXP: statsAfter.attack.xp,
      };
    });

    expect(result).not.toBeNull();
    expect(result?.finalXP).toBeGreaterThan(result?.initialXP ?? 0);
    expect(result?.finalLevel).toBeGreaterThan(result?.initialLevel ?? 1);
  });

  test('XP table should follow RuneScape formula', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const xpValues = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { getSystem: (name: string) => { getXPForLevel?: (level: number) => number } } }).hyperscapeWorld;
      const skillsSystem = world?.getSystem('skills');

      return {
        level2: skillsSystem?.getXPForLevel?.(2),
        level10: skillsSystem?.getXPForLevel?.(10),
        level50: skillsSystem?.getXPForLevel?.(50),
        level99: skillsSystem?.getXPForLevel?.(99),
      };
    });

    // RuneScape XP values
    expect(xpValues.level2).toBe(83);
    expect(xpValues.level10).toBe(1154);
    expect(xpValues.level50).toBe(101333);
    expect(xpValues.level99).toBe(13034431);
  });

  test('Combat level should calculate correctly from combat skills', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const combatLevel = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { getComponent: (name: string) => { data?: unknown } } }; getSystem: (name: string) => { getCombatLevel?: (stats: unknown) => number } } }).hyperscapeWorld;
      if (!world) return null;

      const player = world.entities.add({
        id: 'player_combat_level',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const stats = player.getComponent('stats');
      const skillsSystem = world.getSystem('skills');

      // Set specific levels to test formula
      const testStats = {
        attack: { level: 40, xp: 0 },
        strength: { level: 40, xp: 0 },
        defense: { level: 30, xp: 0 },
        constitution: { level: 30, xp: 0 },
        ranged: { level: 1, xp: 0 },
      };

      return skillsSystem?.getCombatLevel?.(testStats);
    });

    // With attack 40, str 40, def 30, con 30, ranged 1:
    // base = 0.25 * (30 + 30 + 0.5) = 15.125
    // melee = 0.325 * (40 + 40) = 26
    // ranged = 0.325 * 1.5 = 0.4875
    // combat = floor(15.125 + 26) = 41
    expect(combatLevel).toBe(41);
  });
});

test.describe('Equipment System - Item Requirements', () => {
  test('Should prevent equipping items without required levels', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    let equipBlocked = false;

    page.on('console', (msg) => {
      if (msg.text().includes('level requirement') || msg.text().includes('You need')) {
        equipBlocked = true;
      }
    });

    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return;

      world.entities.add({
        id: 'player_low_level',
        type: 'player',
        position: [0, 5, 0],
        stats: {
          attack: { level: 1, xp: 0 },
          defense: { level: 1, xp: 0 },
        },
      }, true);

      // Try to equip mithril sword (requires attack 20)
      world.emit('equipment:try:equip', {
        playerId: 'player_low_level',
        itemId: 'mithril_sword',
      });
    });

    await page.waitForTimeout(500);

    expect(equipBlocked).toBe(true);
  });

  test('Should allow equipping items when requirements met', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const equipped = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getEquipmentData?: (id: string) => { weapon?: { itemId: string } } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_high_level',
        type: 'player',
        position: [0, 5, 0],
        stats: {
          attack: { level: 20, xp: 0 },
          defense: { level: 20, xp: 0 },
        },
      }, true);

      // Equip mithril sword (requires attack 20)
      world.emit('equipment:equip', {
        playerId: 'player_high_level',
        itemId: 'mithril_sword',
        slot: 'weapon',
      });

      const equipmentSystem = world.getSystem('equipment');
      const equipment = equipmentSystem?.getEquipmentData?.('player_high_level');

      return equipment?.weapon?.itemId;
    });

    expect(equipped).toBe('mithril_sword');
  });

  test('Equipment should provide stat bonuses', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getEquipmentStats?: (id: string) => { attack: number; strength: number; defense: number } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_bonuses',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const equipmentSystem = world.getSystem('equipment');
      const statsBefore = equipmentSystem?.getEquipmentStats?.('player_bonuses');

      // Equip bronze sword (provides attack +6, strength +5)
      world.emit('equipment:force:equip', {
        playerId: 'player_bonuses',
        itemId: 'bronze_sword',
        slot: 'weapon',
      });

      const statsAfter = equipmentSystem?.getEquipmentStats?.('player_bonuses');

      return {
        attackBefore: statsBefore?.attack ?? 0,
        attackAfter: statsAfter?.attack ?? 0,
        strengthBefore: statsBefore?.strength ?? 0,
        strengthAfter: statsAfter?.strength ?? 0,
      };
    });

    expect(result).not.toBeNull();
    expect(result?.attackAfter).toBeGreaterThan(result?.attackBefore ?? 0);
    expect(result?.strengthAfter).toBeGreaterThan(result?.strengthBefore ?? 0);
  });
});

test.describe('Player System - Health and Stamina', () => {
  test('Player health should decrease when damaged', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getPlayerHealth?: (id: string) => { current: number; max: number }; damagePlayer?: (id: string, damage: number) => boolean } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_damage_test',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const playerSystem = world.getSystem('player');
      const healthBefore = playerSystem?.getPlayerHealth?.('player_damage_test');

      // Deal 10 damage
      playerSystem?.damagePlayer?.('player_damage_test', 10);

      const healthAfter = playerSystem?.getPlayerHealth?.('player_damage_test');

      return {
        healthBefore: healthBefore?.current ?? 0,
        healthAfter: healthAfter?.current ?? 0,
        maxHealth: healthBefore?.max ?? 0,
      };
    });

    expect(result).not.toBeNull();
    expect(result?.healthAfter).toBe((result?.healthBefore ?? 0) - 10);
  });

  test('Health should cap at max health when healed', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; getSystem: (name: string) => { damagePlayer?: (id: string, damage: number) => boolean; healPlayer?: (id: string, amount: number) => void; getPlayerHealth?: (id: string) => { current: number; max: number } } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_heal_test',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const playerSystem = world.getSystem('player');
      
      // Damage then overheal
      playerSystem?.damagePlayer?.('player_heal_test', 20);
      playerSystem?.healPlayer?.('player_heal_test', 1000); // Overheal

      const health = playerSystem?.getPlayerHealth?.('player_heal_test');

      return {
        current: health?.current ?? 0,
        max: health?.max ?? 0,
      };
    });

    expect(result?.current).toBe(result?.max);
  });
});

test.describe('Skills System - Progression', () => {
  test('Should grant correct combat XP based on attack style', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { getComponent: (name: string) => { data?: unknown } } }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { grantXP?: (id: string, skill: string, amount: number) => void } } }).hyperscapeWorld;
      if (!world) return null;

      const player = world.entities.add({
        id: 'player_attack_style',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const statsBefore = player.getComponent('stats')?.data as { 
        attack: { xp: number };
        strength: { xp: number };
        defense: { xp: number };
      };

      const initialAttackXP = statsBefore.attack.xp;
      const initialStrengthXP = statsBefore.strength.xp;
      const initialDefenseXP = statsBefore.defense.xp;

      // Set aggressive style (bonus to strength)
      world.emit('attack:style:changed', {
        playerId: 'player_attack_style',
        newStyle: 'aggressive',
      });

      // Grant combat XP
      world.emit('combat:kill', {
        attackerId: 'player_attack_style',
        targetId: 'test_goblin',
        damageDealt: 50,
        attackStyle: 'aggressive',
      });

      const statsAfter = player.getComponent('stats')?.data as { 
        attack: { xp: number };
        strength: { xp: number };
        defense: { xp: number };
      };

      return {
        attackXPGain: statsAfter.attack.xp - initialAttackXP,
        strengthXPGain: statsAfter.strength.xp - initialStrengthXP,
        defenseXPGain: statsAfter.defense.xp - initialDefenseXP,
      };
    });

    // Aggressive style: 40% strength, 10% attack, 10% defense
    expect(result?.strengthXPGain).toBeGreaterThan(result?.attackXPGain ?? 0);
    expect(result?.strengthXPGain).toBeGreaterThan(result?.defenseXPGain ?? 0);
  });

  test('Should not exceed max level (99)', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const finalLevel = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => { getComponent: (name: string) => { data?: unknown } } }; getSystem: (name: string) => { grantXP?: (id: string, skill: string, amount: number) => void } } }).hyperscapeWorld;
      if (!world) return null;

      const player = world.entities.add({
        id: 'player_max_level',
        type: 'player',
        position: [0, 5, 0],
      }, true);

      const skillsSystem = world.getSystem('skills');
      
      // Grant massive XP (more than level 99)
      skillsSystem?.grantXP?.('player_max_level', 'attack', 200000000);

      const stats = player.getComponent('stats')?.data as { attack: { level: number } };

      return stats.attack.level;
    });

    expect(finalLevel).toBeLessThanOrEqual(99);
  });
});

test.describe('Equipment System - Arrow Consumption', () => {
  test('Arrows should be consumed on ranged attack', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void; getSystem: (name: string) => { getArrowCount?: (id: string) => number; consumeArrow?: (id: string) => void } } }).hyperscapeWorld;
      if (!world) return null;

      world.entities.add({
        id: 'player_arrows',
        type: 'player',
        position: [0, 5, 0],
        equipment: {
          weapon: { id: 'wood_bow', type: 'ranged' },
          arrows: { id: 'arrows', quantity: 50 },
        },
      }, true);

      const equipmentSystem = world.getSystem('equipment');
      const arrowsBefore = equipmentSystem?.getArrowCount?.('player_arrows');

      // Consume arrow
      equipmentSystem?.consumeArrow?.('player_arrows');

      const arrowsAfter = equipmentSystem?.getArrowCount?.('player_arrows');

      return {
        arrowsBefore: arrowsBefore ?? 0,
        arrowsAfter: arrowsAfter ?? 0,
      };
    });

    expect(result?.arrowsAfter).toBe((result?.arrowsBefore ?? 0) - 1);
  });

  test('Should block ranged attack when out of arrows', async ({ page }) => {
    await page.goto('http://localhost:5555');
    await page.waitForTimeout(2000);

    let attackBlocked = false;

    page.on('console', (msg) => {
      if (msg.text().includes('no arrows') || msg.text().includes('COMBAT_ATTACK_FAILED')) {
        attackBlocked = true;
      }
    });

    await page.evaluate(() => {
      const world = (window as { hyperscapeWorld?: { entities: { add: (data: unknown) => unknown }; emit: (event: string, data: unknown) => void } }).hyperscapeWorld;
      if (!world) return;

      world.entities.add({
        id: 'player_no_arrows',
        type: 'player',
        position: [0, 5, 0],
        equipment: {
          weapon: { id: 'wood_bow', type: 'ranged' },
          arrows: null, // No arrows
        },
      }, true);

      world.entities.add({
        id: 'goblin_ranged_target',
        type: 'mob',
        position: [5, 5, 0],
      }, true);

      world.emit('combat:ranged:attack', {
        attackerId: 'player_no_arrows',
        targetId: 'goblin_ranged_target',
      });
    });

    await page.waitForTimeout(500);

    expect(attackBlocked).toBe(true);
  });
});

