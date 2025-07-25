#!/usr/bin/env node

/**
 * Terrain System Logic Test
 * 
 * Tests the TerrainSystem class directly without requiring a running server.
 * Validates biome generation, height calculation, movement constraints, and 
 * mob spawning logic to ensure GDD compliance.
 */

import { TerrainSystem } from '../src/core/systems/TerrainSystem.js';

class TerrainLogicTest {
    constructor() {
        this.mockWorld = {
            physics: null,
            stage: {
                scene: {
                    add: () => {},
                    remove: () => {}
                }
            },
            emit: () => {},
            systems: new Map()
        };
        this.terrain = new TerrainSystem(this.mockWorld);
        this.testResults = {
            biomeGeneration: false,
            heightGeneration: false,
            movementConstraints: false,
            mobSpawnPositions: false,
            testIntegration: false,
            gddCompliance: false
        };
    }

    async init() {
        console.log('🌍 Starting Terrain System Logic Test...');
        
        // Initialize terrain system without full world context
        this.terrain.WORLD_SIZE = 10000; // 10km
        this.terrain.CHUNK_SIZE = 100;   // 100m tiles
        this.terrain.chunks = new Map();
        this.terrain.terrainTiles = new Map();
        
        console.log('✅ Terrain system initialized for testing');
    }

    testBiomeGeneration() {
        console.log('\n🌿 Testing Biome Generation...');
        
        try {
            // Test all 8 GDD-required biomes exist
            const expectedBiomes = [
                'mistwood_valley', 'goblin_wastes', 'darkwood_forest', 
                'northern_reaches', 'blasted_lands', 'lakes', 'plains', 'starter_towns'
            ];
            
            let foundBiomes = 0;
            const activeBiomes = new Set();
            
            // Test biome generation at various world positions
            for (let x = 0; x < 10000; x += 1000) {
                for (let z = 0; z < 10000; z += 1000) {
                    const tileX = Math.floor(x / 100);
                    const tileZ = Math.floor(z / 100);
                    const biome = this.terrain.getBiomeAt(tileX, tileZ);
                    activeBiomes.add(biome);
                }
            }
            
            console.log(`📊 Found biomes: ${Array.from(activeBiomes).join(', ')}`);
            
            // Check if we have good biome diversity
            foundBiomes = activeBiomes.size;
            const hasRequiredBiomes = expectedBiomes.every(biome => 
                Object.keys(this.terrain.BIOMES).includes(biome)
            );
            
            if (hasRequiredBiomes && foundBiomes >= 4) {
                console.log(`✅ Biome generation working: ${foundBiomes} biomes active, all 8 GDD biomes defined`);
                this.testResults.biomeGeneration = true;
            } else {
                console.log(`❌ Biome generation issues: ${foundBiomes} active, missing required biomes`);
            }
            
            return hasRequiredBiomes && foundBiomes >= 4;
        } catch (error) {
            console.error('❌ Biome generation test failed:', error.message);
            return false;
        }
    }

    testHeightGeneration() {
        console.log('\n🏔️ Testing Height Generation...');
        
        try {
            const heights = [];
            const testPositions = [
                [0, 0], [1000, 1000], [5000, 5000], [9000, 9000],
                [2500, 7500], [7500, 2500]
            ];
            
            for (const [x, z] of testPositions) {
                const height = this.terrain.getHeightAt(x, z);
                heights.push({ x, z, height });
            }
            
            console.log('📊 Height samples:', heights);
            
            // Validate height variation and realistic values
            const minHeight = Math.min(...heights.map(h => h.height));
            const maxHeight = Math.max(...heights.map(h => h.height));
            const heightRange = maxHeight - minHeight;
            
            const hasVariation = heightRange > 5; // At least 5m variation
            const reasonableHeights = heights.every(h => h.height >= -5 && h.height <= 100);
            
            if (hasVariation && reasonableHeights) {
                console.log(`✅ Height generation working: range ${heightRange.toFixed(1)}m (${minHeight.toFixed(1)} to ${maxHeight.toFixed(1)})`);
                this.testResults.heightGeneration = true;
            } else {
                console.log(`❌ Height generation issues: range ${heightRange.toFixed(1)}m, reasonable: ${reasonableHeights}`);
            }
            
            return hasVariation && reasonableHeights;
        } catch (error) {
            console.error('❌ Height generation test failed:', error.message);
            return false;
        }
    }

    testMovementConstraints() {
        console.log('\n🚶 Testing Movement Constraints...');
        
        try {
            let walkableCount = 0;
            let unwalkableCount = 0;
            const walkabilityReasons = new Set();
            
            // Test movement constraints at various positions
            for (let x = 0; x < 10000; x += 1500) {
                for (let z = 0; z < 10000; z += 1500) {
                    const walkability = this.terrain.isPositionWalkable(x, z);
                    
                    if (walkability.walkable) {
                        walkableCount++;
                    } else {
                        unwalkableCount++;
                        if (walkability.reason) {
                            walkabilityReasons.add(walkability.reason);
                        }
                    }
                }
            }
            
            console.log(`📊 Walkability: ${walkableCount} walkable, ${unwalkableCount} unwalkable`);
            console.log(`📋 Unwalkable reasons: ${Array.from(walkabilityReasons).join(', ')}`);
            
            // Should have both walkable and unwalkable areas
            const hasConstraints = unwalkableCount > 0;
            const hasWalkableAreas = walkableCount > 0;
            const hasGoodReasons = walkabilityReasons.has('Water bodies are impassable') || 
                                  walkabilityReasons.has('Steep mountain slopes block movement');
            
            if (hasConstraints && hasWalkableAreas && hasGoodReasons) {
                console.log('✅ Movement constraints working: terrain blocks movement appropriately');
                this.testResults.movementConstraints = true;
            } else {
                console.log(`❌ Movement constraints issues: constraints=${hasConstraints}, walkable=${hasWalkableAreas}, reasons=${hasGoodReasons}`);
            }
            
            return hasConstraints && hasWalkableAreas;
        } catch (error) {
            console.error('❌ Movement constraints test failed:', error.message);
            return false;
        }
    }

    testMobSpawnPositions() {
        console.log('\n👹 Testing Mob Spawn Positions...');
        
        try {
            let totalSpawns = 0;
            const spawnBiomes = new Set();
            const mobTypes = new Set();
            
            // Test mob spawning for several tiles
            for (let tileX = 10; tileX < 90; tileX += 20) {
                for (let tileZ = 10; tileZ < 90; tileZ += 20) {
                    const spawns = this.terrain.getMobSpawnPositionsForTile(tileX, tileZ, 5);
                    
                    totalSpawns += spawns.length;
                    spawns.forEach(spawn => {
                        spawnBiomes.add(spawn.biome);
                        spawn.mobTypes.forEach(mobType => mobTypes.add(mobType));
                    });
                }
            }
            
            console.log(`📊 Generated ${totalSpawns} spawn positions across ${spawnBiomes.size} biomes`);
            console.log(`👹 Mob types: ${Array.from(mobTypes).join(', ')}`);
            console.log(`🌍 Spawn biomes: ${Array.from(spawnBiomes).join(', ')}`);
            
            // Should generate reasonable number of spawns with variety
            const hasSpawns = totalSpawns > 0;
            const hasBiomeDiversity = spawnBiomes.size >= 2;
            const hasMobVariety = mobTypes.size >= 2;
            
            if (hasSpawns && hasBiomeDiversity && hasMobVariety) {
                console.log('✅ Mob spawn positions working: good variety and distribution');
                this.testResults.mobSpawnPositions = true;
            } else {
                console.log(`❌ Mob spawn issues: spawns=${hasSpawns}, biomes=${hasBiomeDiversity}, mobs=${hasMobVariety}`);
            }
            
            return hasSpawns && hasBiomeDiversity;
        } catch (error) {
            console.error('❌ Mob spawn positions test failed:', error.message);
            return false;
        }
    }

    testIntegrationMethods() {
        console.log('\n🔧 Testing Integration Methods...');
        
        try {
            // Test the methods expected by the test suite
            const stats = this.terrain.getTerrainStats();
            const biome1 = this.terrain.getBiomeAtPosition(1000, 1000);
            const height1 = this.terrain.getHeightAtPosition(1000, 1000);
            
            console.log('📊 Terrain stats:', stats);
            console.log(`🌿 Biome at (1000,1000): ${biome1}`);
            console.log(`🏔️ Height at (1000,1000): ${height1.toFixed(2)}m`);
            
            // Validate returned data
            const hasValidStats = stats && stats.tileSize === '100x100m' && stats.worldSize === '100x100';
            const hasValidBiome = typeof biome1 === 'string' && biome1 !== 'unknown';
            const hasValidHeight = typeof height1 === 'number' && !isNaN(height1);
            
            if (hasValidStats && hasValidBiome && hasValidHeight) {
                console.log('✅ Integration methods working: all test-expected methods functional');
                this.testResults.testIntegration = true;
            } else {
                console.log(`❌ Integration method issues: stats=${hasValidStats}, biome=${hasValidBiome}, height=${hasValidHeight}`);
            }
            
            return hasValidStats && hasValidBiome && hasValidHeight;
        } catch (error) {
            console.error('❌ Integration methods test failed:', error.message);
            return false;
        }
    }

    testGDDCompliance() {
        console.log('\n📋 Testing GDD Compliance...');
        
        try {
            // Test key GDD requirements
            const requirements = {
                worldSize: this.terrain.CONFIG?.WORLD_SIZE === 10000, // 10km x 10km
                tileSize: this.terrain.CONFIG?.TILE_SIZE === 100,     // 100m x 100m tiles
                biomeCount: Object.keys(this.terrain.BIOMES).length === 8, // 8 biomes
                movementRules: this.terrain.isPositionWalkable, // Movement constraint method exists
                mobSpawning: this.terrain.getMobSpawnPositionsForTile // Mob spawning method exists
            };
            
            console.log('📊 GDD Compliance Check:', requirements);
            
            const compliantCount = Object.values(requirements).filter(Boolean).length;
            const totalRequirements = Object.keys(requirements).length;
            
            if (compliantCount === totalRequirements) {
                console.log(`✅ GDD Compliance: ${compliantCount}/${totalRequirements} requirements met`);
                this.testResults.gddCompliance = true;
            } else {
                console.log(`❌ GDD Compliance: ${compliantCount}/${totalRequirements} requirements met`);
            }
            
            return compliantCount === totalRequirements;
        } catch (error) {
            console.error('❌ GDD compliance test failed:', error.message);
            return false;
        }
    }

    async runAllTests() {
        try {
            await this.init();
            
            // Run all terrain logic tests
            await this.testBiomeGeneration();
            await this.testHeightGeneration();
            await this.testMovementConstraints();
            await this.testMobSpawnPositions();
            await this.testIntegrationMethods();
            await this.testGDDCompliance();
            
            // Summary
            console.log('\n📋 Test Results Summary:');
            Object.entries(this.testResults).forEach(([test, passed]) => {
                console.log(`   ${passed ? '✅' : '❌'} ${test}`);
            });
            
            const totalTests = Object.keys(this.testResults).length;
            const passedTests = Object.values(this.testResults).filter(Boolean).length;
            
            console.log(`\n🎯 Final Result: ${passedTests}/${totalTests} tests passed`);
            
            if (passedTests === totalTests) {
                console.log('🎉 All terrain logic tests PASSED! Terrain system implementation is working correctly.');
            } else {
                console.log('⚠️ Some terrain logic tests FAILED. Implementation needs review.');
            }
            
            return passedTests === totalTests;
            
        } catch (error) {
            console.error('💥 Test runner failed:', error);
            return false;
        }
    }
}

// Run the test
async function main() {
    const test = new TerrainLogicTest();
    const success = await test.runAllTests();
    process.exit(success ? 0 : 1);
}

main().catch(console.error);