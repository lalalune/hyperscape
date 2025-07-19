import { test, expect } from '@playwright/test';

test.describe('Simple Entity Positioning Test', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(12000); // Wait for full initialization
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('Verify entities are positioned above ground level (Y > 0)', async () => {
    console.log('🎯 CRITICAL TEST: Entities must be above Y=0');
    
    const positionCheck = await page.evaluate(() => {
      const results = {
        worldExists: !!window.world,
        entitiesFound: [],
        positionsAboveZero: 0,
        positionsBelowZero: 0,
        averageHeight: 0,
        detailedPositions: []
      };

      try {
        // Check for RPG entities
        const entities = [
          { name: 'RPGPlayer', obj: window.rpgPlayer },
          { name: 'RPGGoblin', obj: window.rpgGoblin },
          { name: 'TerrainSpawner', obj: window.terrainAwareSpawner }
        ];

        entities.forEach(entity => {
          if (entity.obj) {
            results.entitiesFound.push(entity.name);
            
            let position = null;
            
            // Try different ways to get position
            if (entity.obj.getPosition) {
              position = entity.obj.getPosition();
            } else if (entity.obj.position) {
              position = entity.obj.position;
            }
            
            if (position) {
              console.log(`📍 ${entity.name}: (${position.x?.toFixed(2)}, ${position.y?.toFixed(2)}, ${position.z?.toFixed(2)})`);
              
              const posData = {
                entity: entity.name,
                x: position.x || 0,
                y: position.y || 0,
                z: position.z || 0,
                aboveGround: (position.y || 0) > 0
              };
              
              results.detailedPositions.push(posData);
              
              if (posData.aboveGround) {
                results.positionsAboveZero++;
                console.log(`✅ ${entity.name} is above ground at Y=${posData.y.toFixed(2)}`);
              } else {
                results.positionsBelowZero++;
                console.warn(`❌ ${entity.name} is at/below ground at Y=${posData.y.toFixed(2)}`);
              }
            } else {
              console.warn(`⚠️ Could not get position for ${entity.name}`);
            }
          }
        });

        // Calculate average height
        if (results.detailedPositions.length > 0) {
          const totalHeight = results.detailedPositions.reduce((sum, pos) => sum + pos.y, 0);
          results.averageHeight = totalHeight / results.detailedPositions.length;
        }

        console.log(`📊 Position Summary: ${results.positionsAboveZero} above ground, ${results.positionsBelowZero} at/below ground`);
        console.log(`📊 Average height: ${results.averageHeight.toFixed(2)}`);

        return results;
      } catch (error) {
        console.error('Position check error:', error);
        return { error: error.message, ...results };
      }
    });

    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'rpg-world/test-screenshots/simple-positioning-test.png',
      fullPage: true 
    });

    console.log('🎯 POSITIONING TEST RESULTS:');
    console.log(`  Entities Found: ${positionCheck.entitiesFound.join(', ')}`);
    console.log(`  Above Ground (Y > 0): ${positionCheck.positionsAboveZero}`);
    console.log(`  At/Below Ground (Y ≤ 0): ${positionCheck.positionsBelowZero}`);
    console.log(`  Average Height: ${positionCheck.averageHeight.toFixed(2)}`);

    // Log detailed positions
    positionCheck.detailedPositions.forEach(pos => {
      const status = pos.aboveGround ? '✅' : '❌';
      console.log(`  ${status} ${pos.entity}: Y=${pos.y.toFixed(2)}`);
    });

    // Critical assertions
    expect(positionCheck.worldExists).toBe(true);
    expect(positionCheck.entitiesFound.length).toBeGreaterThan(0);
    
    // The critical test: NO entities should be at or below Y=0
    expect(positionCheck.positionsBelowZero).toBe(0);
    
    // ALL entities should be above Y=0
    expect(positionCheck.positionsAboveZero).toBeGreaterThan(0);
    expect(positionCheck.positionsAboveZero).toBe(positionCheck.detailedPositions.length);

    console.log('✅ POSITIONING TEST PASSED: All entities above ground level');
  });
});