import { test, expect } from '@playwright/test';

test.describe('Stats System', () => {
  test('player stats initialize correctly', async ({ page }) => {
    await page.goto('/test-world?test=stats-init');
    await page.waitForSelector('[data-testid="world-loaded"]');
    
    // Get initial player stats through the RPG API
    const initialStats = await page.evaluate(() => {
      const world = (window as any).world;
      const rpg = world?.rpg;
      if (!rpg) return null;
      
      // Try to get player stats
      const playerId = 'test-player';
      return rpg.getPlayerStats(playerId);
    });
    
    // Verify stats exist and have correct initial values
    expect(initialStats).toBeTruthy();
    expect(initialStats.attack?.level).toBe(1);
    expect(initialStats.strength?.level).toBe(1);
    expect(initialStats.defense?.level).toBe(1);
    expect(initialStats.hitpoints?.level).toBe(10);
    expect(initialStats.hitpoints?.max).toBe(100);
  });

  test('experience calculation works correctly', async ({ page }) => {
    await page.goto('/test-world?test=stats-xp');
    await page.waitForSelector('[data-testid="world-loaded"]');
    
    // Test XP to level calculation
    const xpTests = await page.evaluate(() => {
      const world = (window as any).world;
      const rpg = world?.rpg;
      if (!rpg || !rpg.statsSystem) return null;
      
      const statsSystem = rpg.statsSystem;
      return {
        level1: statsSystem.getXPForLevel(1),
        level2: statsSystem.getXPForLevel(2), 
        level10: statsSystem.getXPForLevel(10),
        level99: statsSystem.getXPForLevel(99)
      };
    });
    
    expect(xpTests).toBeTruthy();
    expect(xpTests.level1).toBe(0);
    expect(xpTests.level2).toBe(83);
    expect(xpTests.level10).toBeGreaterThan(1000);
    expect(xpTests.level99).toBeGreaterThan(13000000);
  });

  test('granting XP updates stats correctly', async ({ page }) => {
    await page.goto('/test-world?test=stats-grant-xp');
    await page.waitForSelector('[data-testid="world-loaded"]');
    
    // Grant XP and verify level up
    const xpResult = await page.evaluate(() => {
      const world = (window as any).world;
      const rpg = world?.rpg;
      if (!rpg || !rpg.statsSystem) return null;
      
      const playerId = 'test-player';
      const statsSystem = rpg.statsSystem;
      
      // Get initial stats
      const initialStats = statsSystem.getPlayerStats(playerId);
      const initialAttackLevel = initialStats?.attack?.level || 1;
      
      // Grant enough XP for level 2 (83 XP)
      statsSystem.grantXP(playerId, 'attack', 100, 'test');
      
      // Get updated stats
      const updatedStats = statsSystem.getPlayerStats(playerId);
      const newAttackLevel = updatedStats?.attack?.level || 1;
      
      return {
        initialLevel: initialAttackLevel,
        newLevel: newAttackLevel,
        leveledUp: newAttackLevel > initialAttackLevel
      };
    });
    
    expect(xpResult).toBeTruthy();
    expect(xpResult.leveledUp).toBe(true);
    expect(xpResult.newLevel).toBe(2);
  });
});