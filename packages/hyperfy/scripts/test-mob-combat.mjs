#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMobCombat() {
  console.log('🎯 Testing mob combat system...');
  
  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  // Capture uncaught exceptions
  page.on('pageerror', error => {
    console.error('❌ Page error:', error.message);
    errors.push({
      text: error.message,
      stack: error.stack
    });
  });

  try {
    // Navigate to the local server
    console.log('📡 Navigating to http://localhost:3333...');
    await page.goto('http://localhost:3333', { waitUntil: 'networkidle' });
    
    // Wait for world to load
    console.log('⏳ Waiting for world to initialize...');
    await page.waitForTimeout(5000);

    // Get world state
    const worldInfo = await page.evaluate(() => {
      const world = window.world;
      if (!world) return null;
      
      // Get player info
      const player = world.getPlayer?.();
      const playerInfo = player ? {
        id: player.id,
        position: player.position,
        health: player.health
      } : null;

      // Get mob entities
      const entityManager = world.systems?.['rpg-entity-manager'];
      const mobs = [];
      
      if (entityManager?.entities) {
        for (const [id, entity] of entityManager.entities) {
          if (entity.config?.type === 'mob') {
            mobs.push({
              id: entity.id,
              type: entity.config.mobType,
              position: entity.getPosition(),
              health: entity.config.currentHealth,
              aiState: entity.config.aiState,
              target: entity.config.targetPlayerId
            });
          }
        }
      }

      return { player: playerInfo, mobs, hasWorld: true };
    });

    console.log('🌍 World state:', JSON.stringify(worldInfo, null, 2));

    // If no mobs, spawn some near the player
    if (worldInfo?.mobs?.length === 0 && worldInfo?.player) {
      console.log('🧟 Spawning test mobs...');
      await page.evaluate(() => {
        const world = window.world;
        const player = world.getPlayer?.();
        if (!player) return;

        const positions = [
          { x: player.position.x + 5, y: player.position.y, z: player.position.z },
          { x: player.position.x - 5, y: player.position.y, z: player.position.z },
          { x: player.position.x, y: player.position.y, z: player.position.z + 5 }
        ];

        positions.forEach((pos, i) => {
          world.emit('mob:spawn', {
            mobType: 'goblin',
            level: 1,
            position: pos,
            customId: `test_goblin_${i}`
          });
        });
      });

      await page.waitForTimeout(2000);
    }

    // Move player near a mob to trigger combat
    console.log('🏃 Moving player near mobs...');
    await page.evaluate(() => {
      const world = window.world;
      const player = world.getPlayer?.();
      const entityManager = world.systems?.['rpg-entity-manager'];
      
      if (player && entityManager?.entities) {
        // Find nearest mob
        let nearestMob = null;
        let minDistance = Infinity;
        
        for (const [id, entity] of entityManager.entities) {
          if (entity.config?.type === 'mob' && entity.config.currentHealth > 0) {
            const pos = entity.getPosition();
            const dx = pos.x - player.position.x;
            const dz = pos.z - player.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < minDistance) {
              minDistance = distance;
              nearestMob = entity;
            }
          }
        }

        if (nearestMob) {
          const mobPos = nearestMob.getPosition();
          // Move player very close to mob to trigger aggro
          player.position.x = mobPos.x - 1;
          player.position.z = mobPos.z - 1;
          console.log(`Moved player near ${nearestMob.config.mobType} at ${mobPos.x}, ${mobPos.z}`);
        }
      }
    });

    // Wait for combat to start
    console.log('⚔️ Waiting for combat...');
    await page.waitForTimeout(5000);

    // Check for errors during combat
    if (errors.length > 0) {
      console.error('\n❌ Errors detected during combat:');
      errors.forEach((error, i) => {
        console.error(`\nError ${i + 1}:`, error.text);
        if (error.stack) {
          console.error('Stack:', error.stack);
        }
        if (error.location) {
          console.error('Location:', error.location);
        }
      });
    } else {
      console.log('✅ No errors detected during combat!');
    }

    // Get final state
    const finalState = await page.evaluate(() => {
      const world = window.world;
      const player = world.getPlayer?.();
      const entityManager = world.systems?.['rpg-entity-manager'];
      
      const combatMobs = [];
      if (entityManager?.entities) {
        for (const [id, entity] of entityManager.entities) {
          if (entity.config?.type === 'mob' && entity.config.aiState === 'attacking') {
            combatMobs.push({
              id: entity.id,
              type: entity.config.mobType,
              target: entity.config.targetPlayerId,
              health: entity.config.currentHealth
            });
          }
        }
      }

      return {
        playerHealth: player?.health,
        mobsInCombat: combatMobs
      };
    });

    console.log('\n📊 Final combat state:', JSON.stringify(finalState, null, 2));

    // Take screenshot
    await page.screenshot({ path: path.join(__dirname, '../test-output/mob-combat-test.png') });
    console.log('📸 Screenshot saved to test-output/mob-combat-test.png');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testMobCombat().catch(console.error); 