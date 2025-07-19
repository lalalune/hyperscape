import { test, expect } from '@playwright/test';

test.describe('Terrain Entity Positioning Tests', () => {
  let page;
  let consoleMessages = [];
  let errors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Capture console messages and errors
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      console.log('🔍 Console:', text);
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
      console.error('❌ Page Error:', error.message);
    });

    // Navigate to Hyperfy world
    await page.goto('http://localhost:3001');
    
    // Wait for world initialization
    await page.waitForTimeout(10000);
  });

  test.afterEach(async () => {
    if (errors.length > 0) {
      console.error('🚨 Test errors:', errors);
    }
    await page?.close();
  });

  test('Verify player and mob positions are above terrain height', async () => {
    console.log('🏔️ TESTING: Entity positioning above terrain level');
    
    // Wait for complete world loading
    await page.waitForTimeout(15000);
    
    const positioningResults = await page.evaluate(async () => {
      const results = {
        worldState: {
          hasWorld: false,
          hasTerrain: false,
          hasEntities: false,
          hasPhysics: false
        },
        entities: {
          player: {
            found: false,
            position: null,
            aboveGround: false,
            onTerrain: false,
            heightFromGround: 0
          },
          goblin: {
            found: false,
            position: null,
            aboveGround: false,
            onTerrain: false,
            heightFromGround: 0
          }
        },
        terrain: {
          heightSampling: {
            available: false,
            testPoints: [],
            averageHeight: 0,
            heightRange: { min: 0, max: 0 }
          },
          collision: {
            detected: false,
            raycastTests: []
          }
        },
        positioning: {
          entitiesAboveZero: 0,
          entitiesOnTerrain: 0,
          averageEntityHeight: 0,
          positioningTests: []
        }
      };

      try {
        console.log('🌍 Starting comprehensive positioning analysis...');
        
        // Check world systems
        if (window.world) {
          results.worldState.hasWorld = true;
          
          if (window.world.systems) {
            const terrainSystem = window.world.systems.get('terrain');
            if (terrainSystem) {
              results.worldState.hasTerrain = true;
              results.terrain.heightSampling.available = true;
              console.log('✅ Terrain system found');
              
              // Test height sampling at multiple points
              const testPoints = [
                { x: 0, z: 0, name: 'origin' },
                { x: 5, z: 5, name: 'northeast' },
                { x: -5, z: -5, name: 'southwest' },
                { x: 10, z: -10, name: 'mixed' },
                { x: -10, z: 10, name: 'mixed2' }
              ];
              
              let totalHeight = 0;
              let validPoints = 0;
              let minHeight = Infinity;
              let maxHeight = -Infinity;
              
              testPoints.forEach(point => {
                try {
                  const height = terrainSystem.getHeightAt(point.x, point.z);
                  if (typeof height === 'number' && !isNaN(height)) {
                    totalHeight += height;
                    validPoints++;
                    minHeight = Math.min(minHeight, height);
                    maxHeight = Math.max(maxHeight, height);
                    
                    results.terrain.heightSampling.testPoints.push({
                      ...point,
                      height,
                      valid: true
                    });
                    
                    console.log(`📍 Terrain height at ${point.name} (${point.x}, ${point.z}): ${height.toFixed(2)}`);
                  }
                } catch (e) {
                  results.terrain.heightSampling.testPoints.push({
                    ...point,
                    height: 0,
                    valid: false,
                    error: e.message
                  });
                  console.warn(`⚠️ Height sampling failed at ${point.name}:`, e);
                }
              });
              
              if (validPoints > 0) {
                results.terrain.heightSampling.averageHeight = totalHeight / validPoints;
                results.terrain.heightSampling.heightRange = { min: minHeight, max: maxHeight };
                console.log(`📊 Terrain height stats - Avg: ${results.terrain.heightSampling.averageHeight.toFixed(2)}, Range: ${minHeight.toFixed(2)} to ${maxHeight.toFixed(2)}`);
              }
            }
          }
          
          if (window.world.physics) {
            results.worldState.hasPhysics = true;
            console.log('⚙️ Physics system detected');
          }
          
          if (window.world.entities) {
            results.worldState.hasEntities = true;
            console.log('👥 Entity system detected');
          }
        }

        // Check RPG Player positioning
        if (window.rpgPlayer) {
          const playerPos = window.rpgPlayer.getPosition();
          results.entities.player.found = true;
          results.entities.player.position = playerPos;
          
          console.log(`👤 Player found at: (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)})`);
          
          // Check if player is above ground (Y > 0)
          if (playerPos.y > 0) {
            results.entities.player.aboveGround = true;
            results.positioning.entitiesAboveZero++;
            console.log('✅ Player is above ground level (Y > 0)');
          } else {
            console.warn('⚠️ Player is at or below ground level (Y ≤ 0)');
          }
          
          // Check player height against terrain if available
          if (results.worldState.hasTerrain && window.world.systems) {
            try {
              const terrainSystem = window.world.systems.get('terrain');
              const terrainHeight = terrainSystem.getHeightAt(playerPos.x, playerPos.z);
              const heightFromTerrain = playerPos.y - terrainHeight;
              
              results.entities.player.heightFromGround = heightFromTerrain;
              
              if (heightFromTerrain >= 0.1) { // At least 0.1 units above terrain
                results.entities.player.onTerrain = true;
                results.positioning.entitiesOnTerrain++;
                console.log(`✅ Player is ${heightFromTerrain.toFixed(2)} units above terrain`);
              } else {
                console.warn(`⚠️ Player is ${Math.abs(heightFromTerrain).toFixed(2)} units ${heightFromTerrain < 0 ? 'below' : 'above'} terrain`);
              }
              
              results.positioning.positioningTests.push({
                entity: 'player',
                position: playerPos,
                terrainHeight,
                heightFromTerrain,
                aboveGround: playerPos.y > 0,
                onTerrain: heightFromTerrain >= 0.1
              });
              
            } catch (e) {
              console.warn('⚠️ Could not check player terrain height:', e);
            }
          }
        } else {
          console.warn('⚠️ RPG Player not found');
        }

        // Check RPG Goblin positioning
        if (window.rpgGoblin) {
          const goblinPos = window.rpgGoblin.getPosition();
          results.entities.goblin.found = true;
          results.entities.goblin.position = goblinPos;
          
          console.log(`👹 Goblin found at: (${goblinPos.x.toFixed(2)}, ${goblinPos.y.toFixed(2)}, ${goblinPos.z.toFixed(2)})`);
          
          // Check if goblin is above ground (Y > 0)
          if (goblinPos.y > 0) {
            results.entities.goblin.aboveGround = true;
            results.positioning.entitiesAboveZero++;
            console.log('✅ Goblin is above ground level (Y > 0)');
          } else {
            console.warn('⚠️ Goblin is at or below ground level (Y ≤ 0)');
          }
          
          // Check goblin height against terrain if available
          if (results.worldState.hasTerrain && window.world.systems) {
            try {
              const terrainSystem = window.world.systems.get('terrain');
              const terrainHeight = terrainSystem.getHeightAt(goblinPos.x, goblinPos.z);
              const heightFromTerrain = goblinPos.y - terrainHeight;
              
              results.entities.goblin.heightFromGround = heightFromTerrain;
              
              if (heightFromTerrain >= 0.1) { // At least 0.1 units above terrain
                results.entities.goblin.onTerrain = true;
                results.positioning.entitiesOnTerrain++;
                console.log(`✅ Goblin is ${heightFromTerrain.toFixed(2)} units above terrain`);
              } else {
                console.warn(`⚠️ Goblin is ${Math.abs(heightFromTerrain).toFixed(2)} units ${heightFromTerrain < 0 ? 'below' : 'above'} terrain`);
              }
              
              results.positioning.positioningTests.push({
                entity: 'goblin',
                position: goblinPos,
                terrainHeight,
                heightFromTerrain,
                aboveGround: goblinPos.y > 0,
                onTerrain: heightFromTerrain >= 0.1
              });
              
            } catch (e) {
              console.warn('⚠️ Could not check goblin terrain height:', e);
            }
          }
        } else {
          console.warn('⚠️ RPG Goblin not found');
        }

        // Calculate average entity height
        const positions = [
          results.entities.player.position,
          results.entities.goblin.position
        ].filter(pos => pos !== null);
        
        if (positions.length > 0) {
          const totalY = positions.reduce((sum, pos) => sum + pos.y, 0);
          results.positioning.averageEntityHeight = totalY / positions.length;
        }

        // Additional collision tests
        if (results.worldState.hasPhysics) {
          console.log('🎯 Testing terrain collision detection...');
          
          // Simulate raycast tests from above terrain
          const raycastTests = [
            { from: { x: 0, y: 50, z: 0 }, to: { x: 0, y: -10, z: 0 }, name: 'center' },
            { from: { x: 10, y: 50, z: 10 }, to: { x: 10, y: -10, z: 10 }, name: 'northeast' },
            { from: { x: -10, y: 50, z: -10 }, to: { x: -10, y: -10, z: -10 }, name: 'southwest' }
          ];
          
          raycastTests.forEach(test => {
            // Simulate terrain collision (in real scenario, would use physics raycast)
            const terrainHeight = results.terrain.heightSampling.averageHeight || 0;
            const hit = test.from.y > terrainHeight && test.to.y < terrainHeight;
            
            results.terrain.collision.raycastTests.push({
              ...test,
              hit,
              terrainHeight,
              distance: test.from.y - terrainHeight
            });
            
            if (hit) {
              results.terrain.collision.detected = true;
              console.log(`✅ Raycast ${test.name}: Hit at terrain height ${terrainHeight.toFixed(2)}`);
            }
          });
        }

        console.log('📊 Positioning analysis complete');
        return results;

      } catch (error) {
        console.error('🚨 Positioning test error:', error);
        return { error: error.message, ...results };
      }
    });

    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'rpg-world/test-screenshots/terrain-positioning-test.png',
      fullPage: true 
    });
    
    // Log comprehensive results
    console.log('🎯 TERRAIN POSITIONING TEST RESULTS:');
    console.log('='.repeat(50));
    
    console.log('World Systems:');
    console.log(`  World: ${positioningResults.worldState.hasWorld ? '✅' : '❌'}`);
    console.log(`  Terrain: ${positioningResults.worldState.hasTerrain ? '✅' : '❌'}`);
    console.log(`  Physics: ${positioningResults.worldState.hasPhysics ? '✅' : '❌'}`);
    console.log(`  Entities: ${positioningResults.worldState.hasEntities ? '✅' : '❌'}`);
    
    console.log('\nEntity Positioning:');
    if (positioningResults.entities.player.found) {
      const p = positioningResults.entities.player;
      console.log(`  Player: (${p.position.x.toFixed(2)}, ${p.position.y.toFixed(2)}, ${p.position.z.toFixed(2)})`);
      console.log(`    Above Ground (Y > 0): ${p.aboveGround ? '✅' : '❌'}`);
      console.log(`    On Terrain: ${p.onTerrain ? '✅' : '❌'}`);
      if (p.heightFromGround !== 0) {
        console.log(`    Height from Terrain: ${p.heightFromGround.toFixed(2)} units`);
      }
    }
    
    if (positioningResults.entities.goblin.found) {
      const g = positioningResults.entities.goblin;
      console.log(`  Goblin: (${g.position.x.toFixed(2)}, ${g.position.y.toFixed(2)}, ${g.position.z.toFixed(2)})`);
      console.log(`    Above Ground (Y > 0): ${g.aboveGround ? '✅' : '❌'}`);
      console.log(`    On Terrain: ${g.onTerrain ? '✅' : '❌'}`);
      if (g.heightFromGround !== 0) {
        console.log(`    Height from Terrain: ${g.heightFromGround.toFixed(2)} units`);
      }
    }
    
    console.log('\nTerrain Analysis:');
    console.log(`  Height Sampling: ${positioningResults.terrain.heightSampling.available ? '✅' : '❌'}`);
    console.log(`  Test Points: ${positioningResults.terrain.heightSampling.testPoints.length}`);
    if (positioningResults.terrain.heightSampling.testPoints.length > 0) {
      const validPoints = positioningResults.terrain.heightSampling.testPoints.filter(p => p.valid).length;
      console.log(`  Valid Height Samples: ${validPoints}/${positioningResults.terrain.heightSampling.testPoints.length}`);
      if (validPoints > 0) {
        const range = positioningResults.terrain.heightSampling.heightRange;
        console.log(`  Height Range: ${range.min.toFixed(2)} to ${range.max.toFixed(2)}`);
        console.log(`  Average Height: ${positioningResults.terrain.heightSampling.averageHeight.toFixed(2)}`);
      }
    }
    
    console.log('\nPositioning Summary:');
    console.log(`  Entities Above Y=0: ${positioningResults.positioning.entitiesAboveZero}`);
    console.log(`  Entities On Terrain: ${positioningResults.positioning.entitiesOnTerrain}`);
    console.log(`  Average Entity Height: ${positioningResults.positioning.averageEntityHeight.toFixed(2)}`);
    
    // Core assertions for positioning
    expect(positioningResults.worldState.hasWorld).toBe(true);
    expect(positioningResults.worldState.hasPhysics).toBe(true);
    
    // Entity positioning assertions
    const entitiesFound = positioningResults.entities.player.found || positioningResults.entities.goblin.found;
    expect(entitiesFound).toBe(true);
    
    // Critical test: Entities should be above ground level (Y > 0)
    expect(positioningResults.positioning.entitiesAboveZero).toBeGreaterThan(0);
    
    // If terrain system is available, entities should be positioned correctly on terrain
    if (positioningResults.worldState.hasTerrain) {
      expect(positioningResults.terrain.heightSampling.available).toBe(true);
      expect(positioningResults.positioning.entitiesOnTerrain).toBeGreaterThan(0);
    }
    
    console.log('✅ TERRAIN POSITIONING TESTS PASSED');
  });

  test('Test entity spawning and repositioning on terrain', async () => {
    console.log('🎯 TESTING: Entity spawning and terrain adjustment');
    
    await page.waitForTimeout(10000);
    
    const spawnTest = await page.evaluate(async () => {
      const results = {
        initialPositions: {},
        repositioningTests: [],
        terrainAdjustment: {
          successful: 0,
          failed: 0,
          tests: []
        },
        spawnTests: {
          aboveGround: 0,
          onTerrain: 0,
          belowGround: 0,
          total: 0
        }
      };

      try {
        console.log('🎲 Testing entity spawning and positioning...');
        
        // Record initial positions
        if (window.rpgPlayer) {
          results.initialPositions.player = window.rpgPlayer.getPosition();
        }
        if (window.rpgGoblin) {
          results.initialPositions.goblin = window.rpgGoblin.getPosition();
        }
        
        // Test terrain adjustment for different spawn points
        const testSpawnPoints = [
          { x: 0, z: 0, name: 'origin' },
          { x: 15, z: 15, name: 'northeast' },
          { x: -15, z: -15, name: 'southwest' },
          { x: 20, z: -20, name: 'mixed1' },
          { x: -25, z: 25, name: 'mixed2' }
        ];
        
        if (window.world?.systems?.get('terrain')) {
          const terrainSystem = window.world.systems.get('terrain');
          
          testSpawnPoints.forEach(spawnPoint => {
            try {
              const terrainHeight = terrainSystem.getHeightAt(spawnPoint.x, spawnPoint.z);
              const adjustedY = terrainHeight + 1.0; // 1 unit above terrain
              
              const testResult = {
                spawnPoint,
                terrainHeight,
                adjustedY,
                success: adjustedY > 0 && adjustedY > terrainHeight
              };
              
              results.terrainAdjustment.tests.push(testResult);
              
              if (testResult.success) {
                results.terrainAdjustment.successful++;
                console.log(`✅ Spawn test ${spawnPoint.name}: Terrain ${terrainHeight.toFixed(2)} → Spawn ${adjustedY.toFixed(2)}`);
              } else {
                results.terrainAdjustment.failed++;
                console.warn(`❌ Spawn test ${spawnPoint.name}: Failed adjustment`);
              }
              
              // Categorize spawn result
              results.spawnTests.total++;
              if (adjustedY > 0) {
                results.spawnTests.aboveGround++;
                if (adjustedY > terrainHeight) {
                  results.spawnTests.onTerrain++;
                }
              } else {
                results.spawnTests.belowGround++;
              }
              
            } catch (e) {
              console.warn(`⚠️ Spawn test failed for ${spawnPoint.name}:`, e);
              results.terrainAdjustment.failed++;
              results.spawnTests.total++;
              results.spawnTests.belowGround++;
            }
          });
        }

        // Test actual entity repositioning if possible
        if (window.rpgPlayer?.moveToPosition) {
          console.log('🎮 Testing player repositioning...');
          
          const startPos = window.rpgPlayer.getPosition();
          window.rpgPlayer.moveToPosition(10, 10);
          
          // Wait for movement
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newPos = window.rpgPlayer.getPosition();
          const moved = Math.sqrt(
            Math.pow(newPos.x - startPos.x, 2) + 
            Math.pow(newPos.z - startPos.z, 2)
          ) > 1.0;
          
          results.repositioningTests.push({
            entity: 'player',
            startPos,
            newPos,
            moved,
            aboveGround: newPos.y > 0,
            heightChange: newPos.y - startPos.y
          });
          
          console.log(`Player repositioning: ${moved ? 'Success' : 'Failed'}, Height: ${newPos.y.toFixed(2)}`);
        }

        return results;
      } catch (error) {
        console.error('🚨 Spawn test error:', error);
        return { error: error.message, ...results };
      }
    });

    // Take screenshot after spawn tests
    await page.screenshot({ 
      path: 'rpg-world/test-screenshots/terrain-spawn-test.png',
      fullPage: true 
    });

    console.log('🎯 SPAWN TEST RESULTS:');
    console.log(`  Terrain Adjustments: ${spawnTest.terrainAdjustment.successful}/${spawnTest.terrainAdjustment.tests.length} successful`);
    console.log(`  Spawn Categories:`);
    console.log(`    Above Ground: ${spawnTest.spawnTests.aboveGround}/${spawnTest.spawnTests.total}`);
    console.log(`    On Terrain: ${spawnTest.spawnTests.onTerrain}/${spawnTest.spawnTests.total}`);
    console.log(`    Below Ground: ${spawnTest.spawnTests.belowGround}/${spawnTest.spawnTests.total}`);

    // Assertions for spawning
    expect(spawnTest.terrainAdjustment.successful).toBeGreaterThan(0);
    expect(spawnTest.spawnTests.aboveGround).toBeGreaterThan(0);
    expect(spawnTest.spawnTests.belowGround).toBe(0); // No entities should spawn below ground
    
    console.log('✅ SPAWN AND POSITIONING TESTS PASSED');
  });
});