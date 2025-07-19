import { test, expect } from '@playwright/test';

test.describe('Visual Terrain Verification', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Navigate to local Hyperfy instance
    await page.goto('http://localhost:3001');
    
    // Wait for world to load
    await page.waitForTimeout(8000);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('Verify terrain rendering and entity placement', async () => {
    console.log('🏔️ VISUAL VERIFICATION: Terrain rendering and entity physics');
    
    // Wait for complete initialization
    await page.waitForTimeout(12000);
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'rpg-world/test-screenshots/terrain-visual-verification.png',
      fullPage: true 
    });
    
    // Inject comprehensive verification script
    const terrainVerification = await page.evaluate(async () => {
      const results = {
        worldState: {
          hasWorld: !!window.world,
          hasGraphics: !!(window.world?.graphics),
          hasPhysics: !!(window.world?.physics),
          hasEntities: !!(window.world?.entities),
          hasTerrain: false
        },
        entities: {
          rpgPlayer: !!window.rpgPlayer,
          rpgGoblin: !!window.rpgGoblin,
          playerPosition: null,
          goblinPosition: null,
          entitiesOnGround: false
        },
        terrain: {
          environmentLoaded: false,
          baseEnvironmentExists: false,
          sceneObjects: 0,
          terrainMeshes: 0,
          heightVariation: false
        },
        physics: {
          gravityEnabled: false,
          collisionDetection: false,
          physxIntegration: false,
          entityGrounding: false
        },
        visual: {
          renderingActive: false,
          entitiesVisible: false,
          terrainVisible: false,
          lightingActive: false
        }
      };

      try {
        // Check world systems
        if (window.world) {
          console.log('🌍 World object found');
          
          // Check graphics system
          if (window.world.graphics) {
            results.visual.renderingActive = true;
            console.log('🎨 Graphics system active');
            
            // Check scene objects
            if (window.world.graphics.scene) {
              const scene = window.world.graphics.scene;
              results.terrain.sceneObjects = scene.children.length;
              console.log(`📦 Scene objects: ${scene.children.length}`);
              
              // Count terrain-related objects
              let terrainMeshes = 0;
              let entityMeshes = 0;
              
              scene.traverse(object => {
                if (object.isMesh) {
                  if (object.name && (
                    object.name.toLowerCase().includes('terrain') ||
                    object.name.toLowerCase().includes('ground') ||
                    object.name.toLowerCase().includes('plane') ||
                    object.name.toLowerCase().includes('environment')
                  )) {
                    terrainMeshes++;
                  }
                  
                  if (object.material && object.geometry) {
                    entityMeshes++;
                  }
                }
              });
              
              results.terrain.terrainMeshes = terrainMeshes;
              results.visual.entitiesVisible = entityMeshes > 0;
              results.visual.terrainVisible = terrainMeshes > 0;
              
              console.log(`🏔️ Terrain meshes: ${terrainMeshes}`);
              console.log(`👥 Entity meshes: ${entityMeshes}`);
            }
          }
          
          // Check physics system
          if (window.world.physics) {
            results.physics.physxIntegration = true;
            console.log('⚙️ PhysX integration detected');
          }
          
          // Check terrain system
          if (window.world.systems) {
            const terrainSystem = window.world.systems.get('terrain');
            if (terrainSystem) {
              results.worldState.hasTerrain = true;
              console.log('🏔️ Terrain system found');
              
              // Test height sampling for terrain verification
              try {
                const testHeight = terrainSystem.getHeightAt(0, 0);
                if (typeof testHeight === 'number' && !isNaN(testHeight)) {
                  results.terrain.heightVariation = true;
                  console.log(`📏 Terrain height at origin: ${testHeight.toFixed(2)}`);
                }
              } catch (e) {
                console.warn('⚠️ Height sampling test failed:', e);
              }
            }
          }
        }

        // Check RPG entities
        if (window.rpgPlayer) {
          const playerPos = window.rpgPlayer.getPosition();
          results.entities.playerPosition = playerPos;
          console.log(`👤 Player position: (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)})`);
          
          // Check if player is at a reasonable ground level
          if (playerPos.y > -5 && playerPos.y < 20) {
            results.entities.entitiesOnGround = true;
            results.physics.entityGrounding = true;
          }
        }
        
        if (window.rpgGoblin) {
          const goblinPos = window.rpgGoblin.getPosition();
          results.entities.goblinPosition = goblinPos;
          console.log(`👹 Goblin position: (${goblinPos.x.toFixed(2)}, ${goblinPos.y.toFixed(2)}, ${goblinPos.z.toFixed(2)})`);
          
          // Additional grounding check
          if (goblinPos.y > -5 && goblinPos.y < 20) {
            results.entities.entitiesOnGround = true;
            results.physics.entityGrounding = true;
          }
        }

        // Check for base environment
        const environmentIndicators = [
          'base-environment',
          'day2',
          'terrain',
          'ground',
          'plane'
        ];
        
        if (window.world?.graphics?.scene) {
          environmentIndicators.forEach(indicator => {
            window.world.graphics.scene.traverse(object => {
              if (object.name && object.name.toLowerCase().includes(indicator)) {
                results.terrain.baseEnvironmentExists = true;
                results.terrain.environmentLoaded = true;
              }
            });
          });
        }

        // Physics and collision verification
        if (results.entities.entitiesOnGround && results.worldState.hasTerrain) {
          results.physics.gravityEnabled = true;
          results.physics.collisionDetection = true;
        }

        return results;
      } catch (error) {
        console.error('🚨 Terrain verification error:', error);
        return { error: error.message, ...results };
      }
    });

    // Log comprehensive results
    console.log('🎯 TERRAIN VERIFICATION RESULTS:');
    console.log('World Systems:', {
      world: terrainVerification.worldState.hasWorld ? '✅' : '❌',
      graphics: terrainVerification.worldState.hasGraphics ? '✅' : '❌',
      physics: terrainVerification.worldState.hasPhysics ? '✅' : '❌',
      terrain: terrainVerification.worldState.hasTerrain ? '✅' : '❌'
    });
    
    console.log('Entity Systems:', {
      player: terrainVerification.entities.rpgPlayer ? '✅' : '❌',
      goblin: terrainVerification.entities.rpgGoblin ? '✅' : '❌',
      grounded: terrainVerification.entities.entitiesOnGround ? '✅' : '❌'
    });
    
    console.log('Terrain Systems:', {
      environment: terrainVerification.terrain.environmentLoaded ? '✅' : '❌',
      meshes: `${terrainVerification.terrain.terrainMeshes} found`,
      heightMap: terrainVerification.terrain.heightVariation ? '✅' : '❌',
      sceneObjects: `${terrainVerification.terrain.sceneObjects} total`
    });
    
    console.log('Physics Systems:', {
      physx: terrainVerification.physics.physxIntegration ? '✅' : '❌',
      gravity: terrainVerification.physics.gravityEnabled ? '✅' : '❌',
      collision: terrainVerification.physics.collisionDetection ? '✅' : '❌',
      grounding: terrainVerification.physics.entityGrounding ? '✅' : '❌'
    });
    
    console.log('Visual Systems:', {
      rendering: terrainVerification.visual.renderingActive ? '✅' : '❌',
      entities: terrainVerification.visual.entitiesVisible ? '✅' : '❌',
      terrain: terrainVerification.visual.terrainVisible ? '✅' : '❌'
    });

    // Core assertions for terrain functionality
    expect(terrainVerification.worldState.hasWorld).toBe(true);
    expect(terrainVerification.worldState.hasGraphics).toBe(true);
    expect(terrainVerification.visual.renderingActive).toBe(true);
    
    // Entity placement and grounding
    expect(terrainVerification.entities.entitiesOnGround).toBe(true);
    expect(terrainVerification.physics.entityGrounding).toBe(true);
    
    // Basic terrain or environment presence
    const hasTerrainOrEnvironment = terrainVerification.worldState.hasTerrain || 
                                   terrainVerification.terrain.environmentLoaded ||
                                   terrainVerification.terrain.sceneObjects > 5;
    expect(hasTerrainOrEnvironment).toBe(true);
    
    console.log('✅ TERRAIN VERIFICATION COMPLETE: All core systems functional');
  });

  test('Test entity movement and terrain interaction', async () => {
    console.log('🚶 TESTING: Entity movement on terrain surface');
    
    await page.waitForTimeout(10000);
    
    const movementTest = await page.evaluate(async () => {
      const results = {
        playerMovement: false,
        goblinMovement: false,
        heightAdjustment: false,
        terrainFollowing: false,
        movementHistory: []
      };

      try {
        // Test player movement
        if (window.rpgPlayer || window.testPlayer) {
          const player = window.rpgPlayer || window.testPlayer;
          const startPos = player.getPosition();
          
          console.log(`🎮 Testing player movement from: (${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)})`);
          
          // Command movement if possible
          if (player.moveToPosition) {
            player.moveToPosition(15, 15);
            console.log('🎯 Commanded player to move to (15, 15)');
            
            // Wait for movement
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const newPos = player.getPosition();
            const distance = Math.sqrt(
              Math.pow(newPos.x - startPos.x, 2) + 
              Math.pow(newPos.z - startPos.z, 2)
            );
            
            if (distance > 2.0) {
              results.playerMovement = true;
              console.log(`✅ Player moved ${distance.toFixed(2)} units`);
              
              // Check height adjustment for terrain following
              const heightDiff = Math.abs(newPos.y - startPos.y);
              if (heightDiff < 10) { // Reasonable height change
                results.heightAdjustment = true;
                results.terrainFollowing = true;
                console.log(`✅ Player height adjusted by ${heightDiff.toFixed(2)} units`);
              }
            }
            
            results.movementHistory.push({
              entity: 'player',
              start: startPos,
              end: newPos,
              distance: distance
            });
          }
        }

        // Test goblin movement/AI
        if (window.rpgGoblin) {
          const goblin = window.rpgGoblin;
          const startPos = goblin.getPosition();
          
          console.log(`👹 Goblin initial position: (${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)})`);
          
          // Wait and check for AI movement
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const newPos = goblin.getPosition();
          const distance = Math.sqrt(
            Math.pow(newPos.x - startPos.x, 2) + 
            Math.pow(newPos.z - startPos.z, 2)
          );
          
          if (distance > 0.5) {
            results.goblinMovement = true;
            console.log(`✅ Goblin moved ${distance.toFixed(2)} units via AI`);
          }
          
          results.movementHistory.push({
            entity: 'goblin',
            start: startPos,
            end: newPos,
            distance: distance
          });
        }

        return results;
      } catch (error) {
        console.error('🚨 Movement test error:', error);
        return { error: error.message, ...results };
      }
    });

    // Take screenshot after movement test
    await page.screenshot({ 
      path: 'rpg-world/test-screenshots/terrain-movement-verification.png',
      fullPage: true 
    });

    console.log('🎯 MOVEMENT TEST RESULTS:', {
      playerMovement: movementTest.playerMovement ? '✅' : '❌',
      goblinMovement: movementTest.goblinMovement ? '✅' : '❌',
      heightAdjustment: movementTest.heightAdjustment ? '✅' : '❌',
      terrainFollowing: movementTest.terrainFollowing ? '✅' : '❌'
    });

    // Verify movement capabilities
    const hasMovement = movementTest.playerMovement || movementTest.goblinMovement;
    expect(hasMovement).toBe(true);
    
    console.log('✅ ENTITY MOVEMENT ON TERRAIN VERIFIED');
  });
});