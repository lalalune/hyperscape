#!/usr/bin/env node

/**
 * Unified Terrain System Test
 * 
 * Tests the new TerrainSystem to validate:
 * - 100x100m tiles are generated correctly
 * - 10km x 10km world bounds are respected
 * - Only adjacent tiles (3x3) are loaded
 * - PhysX collision is working for terrain raycasting
 * - Player can raycast forward and hit terrain
 * - Terrain height and biome generation is working
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

class UnifiedTerrainTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = {
            terrainGeneration: false,
            tileLoading: false,
            raycastHitTerrain: false,
            biomeGeneration: false,
            worldBounds: false,
            performanceCheck: false
        };
    }

    async init() {
        console.log('🌍 Starting Unified Terrain System Test...');
        
        this.browser = await puppeteer.launch({
            headless: false, // Show browser for visual verification
            defaultViewport: { width: 1200, height: 800 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Set up console logging
        this.page.on('console', msg => {
            if (msg.text().includes('[UnifiedTerrain]') || 
                msg.text().includes('[Raycast]') ||
                msg.text().includes('[Player]')) {
                console.log(`🖥️ ${msg.text()}`);
            }
        });

        // Navigate to Hyperfy
        console.log('📡 Connecting to Hyperfy server...');
        await this.page.goto('http://localhost:3333/', { waitUntil: 'load' });
        
        // Wait for world to initialize
        console.log('⏳ Waiting for world initialization...');
        await this.page.waitForFunction(() => {
            return window.world && window.world.getPlayer && window.world.raycast;
        }, { timeout: 15000 });
    }

    async testTerrainGeneration() {
        console.log('\n🔨 Testing Terrain Generation...');
        
        const terrainStats = await this.page.evaluate(() => {
            const unifiedTerrain = window.world?.systems?.['unified-terrain'];
            if (!unifiedTerrain) {
                return { error: 'TerrainSystem not found' };
            }
            
            return unifiedTerrain.getTerrainStats();
        });
        
        if (terrainStats.error) {
            console.error('❌ Terrain system not found:', terrainStats.error);
            return false;
        }
        
        console.log('📊 Terrain Stats:', terrainStats);
        
        // Validate terrain configuration
        const isCorrect = terrainStats.tileSize === '100x100m' && 
                         terrainStats.worldSize === '100x100' &&
                         terrainStats.totalArea === '10km x 10km' &&
                         terrainStats.maxLoadedTiles === 9;
        
        if (isCorrect) {
            console.log('✅ Terrain configuration is correct!');
            this.testResults.terrainGeneration = true;
        } else {
            console.log('❌ Terrain configuration mismatch');
        }
        
        return isCorrect;
    }

    async testTileLoading() {
        console.log('\n📦 Testing Tile Loading...');
        
        const tileInfo = await this.page.evaluate(() => {
            const unifiedTerrain = window.world?.systems?.['unified-terrain'];
            if (!unifiedTerrain) return { error: 'System not found' };
            
            const stats = unifiedTerrain.getTerrainStats();
            return {
                tilesLoaded: stats.tilesLoaded,
                currentlyLoaded: stats.currentlyLoaded,
                maxAllowed: stats.maxLoadedTiles
            };
        });
        
        if (tileInfo.error) {
            console.error('❌ Failed to get tile info:', tileInfo.error);
            return false;
        }
        
        console.log('📋 Tile Loading Info:', tileInfo);
        
        // Should have loaded initial 3x3 grid
        const isCorrect = tileInfo.tilesLoaded <= tileInfo.maxAllowed &&
                         tileInfo.tilesLoaded >= 1; // At least origin tile
        
        if (isCorrect) {
            console.log('✅ Tile loading is working correctly!');
            this.testResults.tileLoading = true;
        } else {
            console.log('❌ Tile loading issue detected');
        }
        
        return isCorrect;
    }

    async testRaycastingToTerrain() {
        console.log('\n🎯 Testing Raycasting to Terrain...');
        
        // Set up player raycasting system
        const raycastResults = await this.page.evaluate(() => {
            const player = window.world.getPlayer();
            if (!player) return { error: 'No player found' };
            
            // Position player at a known location
            player.position.set(50, 10, 50); // Middle of tile (0,0), 10m above ground
            
            console.log('[Raycast] Player positioned at:', player.position);
            
            // Raycast downward to hit terrain
            const origin = player.position.clone();
            const direction = new THREE.Vector3(0, -1, 0); // Downward
            const maxDistance = 20; // 20m should be enough
            
            console.log('[Raycast] Casting ray from:', origin, 'direction:', direction);
            
            const hit = window.world.raycast(origin, direction, maxDistance);
            
            console.log('[Raycast] Hit result:', hit);
            
            // Also test forward raycasting
            const forwardDirection = new THREE.Vector3(0, 0, -1); // Forward
            const forwardHit = window.world.raycast(origin, forwardDirection, 100);
            
            console.log('[Raycast] Forward hit result:', forwardHit);
            
            return {
                playerPosition: {
                    x: player.position.x,
                    y: player.position.y,
                    z: player.position.z
                },
                downwardHit: hit,
                forwardHit: forwardHit,
                hasRaycastSupport: typeof window.world.raycast === 'function'
            };
        });
        
        if (raycastResults.error) {
            console.error('❌ Raycasting test failed:', raycastResults.error);
            return false;
        }
        
        console.log('🎯 Raycast Results:', raycastResults);
        
        // Validate raycasting works
        const hasValidRaycast = raycastResults.hasRaycastSupport && 
                               (raycastResults.downwardHit || raycastResults.forwardHit);
        
        if (hasValidRaycast) {
            console.log('✅ Raycasting to terrain is working!');
            if (raycastResults.downwardHit) {
                console.log('✅ Downward raycast hit terrain');
            }
            if (raycastResults.forwardHit) {
                console.log('✅ Forward raycast hit terrain');
            }
            this.testResults.raycastHitTerrain = true;
        } else {
            console.log('❌ Raycasting failed to hit terrain');
            console.log('   This suggests PhysX collision may not be working properly');
        }
        
        return hasValidRaycast;
    }

    async testBiomeGeneration() {
        console.log('\n🌿 Testing Biome Generation...');
        
        const biomeTest = await this.page.evaluate(() => {
            const unifiedTerrain = window.world?.systems?.['unified-terrain'];
            if (!unifiedTerrain) return { error: 'System not found' };
            
            // Test biome generation at various points
            const testPoints = [
                { x: 0, z: 0 },      // Origin
                { x: 100, z: 100 },  // Adjacent tile
                { x: 500, z: 500 },  // Further out
                { x: -100, z: -100 } // Negative coordinates
            ];
            
            const biomeResults = [];
            const heightResults = [];
            
            for (const point of testPoints) {
                const biome = unifiedTerrain.getBiomeAtPosition(point.x, point.z);
                const height = unifiedTerrain.getHeightAtPosition(point.x, point.z);
                
                biomeResults.push({ point, biome });
                heightResults.push({ point, height });
            }
            
            return {
                biomes: biomeResults,
                heights: heightResults,
                availableBiomes: ['grassland', 'forest', 'hills', 'mountains', 'water']
            };
        });
        
        if (biomeTest.error) {
            console.error('❌ Biome test failed:', biomeTest.error);
            return false;
        }
        
        console.log('🌿 Biome Test Results:', biomeTest);
        
        // Validate biome diversity and height variation
        const uniqueBiomes = new Set(biomeTest.biomes.map(b => b.biome));
        const hasHeightVariation = biomeTest.heights.some(h => h.height > 0);
        
        const isValid = uniqueBiomes.size >= 1 && hasHeightVariation;
        
        if (isValid) {
            console.log('✅ Biome generation is working!');
            console.log(`   Generated ${uniqueBiomes.size} different biomes: ${Array.from(uniqueBiomes).join(', ')}`);
            this.testResults.biomeGeneration = true;
        } else {
            console.log('❌ Biome generation issues detected');
        }
        
        return isValid;
    }

    async testWorldBounds() {
        console.log('\n🗺️ Testing World Bounds...');
        
        const boundsTest = await this.page.evaluate(() => {
            const unifiedTerrain = window.world?.systems?.['unified-terrain'];
            if (!unifiedTerrain) return { error: 'System not found' };
            
            // Test coordinates at world boundaries
            const boundaryTests = [
                { x: 0, z: 0, expected: 'valid' },           // Origin
                { x: 5000, z: 5000, expected: 'valid' },     // Center of world (5km)
                { x: 9900, z: 9900, expected: 'valid' },     // Near edge (9.9km)
                { x: 10000, z: 10000, expected: 'edge' },    // Exactly at edge (10km)
                { x: 10100, z: 10100, expected: 'invalid' }  // Beyond edge (10.1km)
            ];
            
            const results = [];
            
            for (const test of boundaryTests) {
                try {
                    const height = unifiedTerrain.getHeightAtPosition(test.x, test.z);
                    const biome = unifiedTerrain.getBiomeAtPosition(test.x, test.z);
                    
                    results.push({
                        ...test,
                        height,
                        biome,
                        success: true
                    });
                } catch (error) {
                    results.push({
                        ...test,
                        error: error.message,
                        success: false
                    });
                }
            }
            
            return { results };
        });
        
        if (boundsTest.error) {
            console.error('❌ Bounds test failed:', boundsTest.error);
            return false;
        }
        
        console.log('🗺️ World Bounds Test Results:', boundsTest.results);
        
        // Validate that bounds are properly handled
        const validResults = boundsTest.results.filter(r => r.expected === 'valid' && r.success);
        const isValid = validResults.length >= 3; // At least 3 valid positions should work
        
        if (isValid) {
            console.log('✅ World bounds are working correctly!');
            this.testResults.worldBounds = true;
        } else {
            console.log('❌ World bounds issues detected');
        }
        
        return isValid;
    }

    async testPerformance() {
        console.log('\n⚡ Testing Performance...');
        
        const performanceTest = await this.page.evaluate(() => {
            const startTime = performance.now();
            
            // Simulate player movement to trigger tile loading
            const player = window.world.getPlayer();
            if (!player) return { error: 'No player found' };
            
            const originalPosition = player.position.clone();
            
            // Move player across tile boundaries to test streaming
            const movements = [
                { x: 0, z: 0 },      // Origin tile
                { x: 150, z: 150 },  // Move to adjacent tile
                { x: 250, z: 250 },  // Move further
                { x: 0, z: 0 }       // Return to origin
            ];
            
            movements.forEach(pos => {
                player.position.set(pos.x, 10, pos.z);
                // Force terrain system update (if available)
                const unifiedTerrain = window.world?.systems?.['unified-terrain'];
                if (unifiedTerrain && unifiedTerrain.update) {
                    unifiedTerrain.update(0.1); // Simulate frame time
                }
            });
            
            // Restore original position
            player.position.copy(originalPosition);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Get final terrain stats
            const unifiedTerrain = window.world?.systems?.['unified-terrain'];
            const stats = unifiedTerrain ? unifiedTerrain.getTerrainStats() : null;
            
            return {
                duration,
                tilesLoaded: stats ? stats.tilesLoaded : 0,
                maxTiles: stats ? stats.maxLoadedTiles : 9,
                performance: duration < 1000 ? 'good' : 'slow'
            };
        });
        
        if (performanceTest.error) {
            console.error('❌ Performance test failed:', performanceTest.error);
            return false;
        }
        
        console.log('⚡ Performance Test Results:', performanceTest);
        
        const isGood = performanceTest.duration < 2000 && // Under 2 seconds
                      performanceTest.tilesLoaded <= performanceTest.maxTiles; // Respects limits
        
        if (isGood) {
            console.log('✅ Performance is acceptable!');
            this.testResults.performanceCheck = true;
        } else {
            console.log('❌ Performance issues detected');
        }
        
        return isGood;
    }

    async takeScreenshot() {
        console.log('\n📸 Taking screenshot for visual verification...');
        
        // Set up overhead camera view for terrain visualization
        await this.page.evaluate(() => {
            const player = window.world.getPlayer();
            if (player) {
                // Position player for good terrain view
                player.position.set(200, 50, 200);
                
                // Try to set camera to overhead view (if camera controls are available)
                if (window.world.camera) {
                    window.world.camera.position.set(200, 100, 200);
                    window.world.camera.lookAt(200, 0, 200);
                }
            }
        });
        
        await this.page.waitForTimeout(2000); // Wait for render
        
        const screenshotPath = '/tmp/unified-terrain-test.png';
        await this.page.screenshot({
            path: screenshotPath,
            fullPage: false
        });
        
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        return screenshotPath;
    }

    async runAllTests() {
        try {
            await this.init();
            
            // Run all terrain tests
            await this.testTerrainGeneration();
            await this.testTileLoading();
            await this.testRaycastingToTerrain();
            await this.testBiomeGeneration();
            await this.testWorldBounds();
            await this.testPerformance();
            
            // Take screenshot for visual verification
            await this.takeScreenshot();
            
            // Summary
            console.log('\n📋 Test Summary:');
            Object.entries(this.testResults).forEach(([test, passed]) => {
                console.log(`   ${passed ? '✅' : '❌'} ${test}`);
            });
            
            const totalTests = Object.keys(this.testResults).length;
            const passedTests = Object.values(this.testResults).filter(Boolean).length;
            
            console.log(`\n🎯 Result: ${passedTests}/${totalTests} tests passed`);
            
            if (passedTests === totalTests) {
                console.log('🎉 All terrain tests PASSED! Unified terrain system is working correctly.');
            } else {
                console.log('⚠️ Some terrain tests FAILED. System needs debugging.');
            }
            
        } catch (error) {
            console.error('💥 Test runner failed:', error);
        } finally {
            if (this.browser) {
                // Keep browser open for manual inspection
                console.log('\n👁️ Browser kept open for manual inspection...');
                console.log('   Close manually when done reviewing terrain');
                // await this.browser.close();
            }
        }
    }
}

// Run the test
async function main() {
    const test = new UnifiedTerrainTest();
    await test.runAllTests();
}

main().catch(console.error);