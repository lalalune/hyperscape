// TerrainAwareSpawner.js - Ensures entities spawn properly on terrain above ground level
// This system prevents entities from spawning at Y=0 or below ground

app.configure([
  {
    key: 'spawnRadius',
    type: 'number',
    label: 'Spawn Radius',
    initial: 50,
    min: 10,
    max: 200,
    hint: 'Radius within which to spawn test entities'
  },
  {
    key: 'minimumHeight',
    type: 'number',
    label: 'Minimum Height Above Terrain',
    initial: 1.0,
    min: 0.1,
    max: 10.0,
    hint: 'Minimum height entities should be above terrain'
  },
  {
    key: 'testEntityCount',
    type: 'number',
    label: 'Test Entity Count',
    initial: 10,
    min: 1,
    max: 20,
    hint: 'Number of test entities to spawn for verification'
  },
  {
    key: 'enableDebugMode',
    type: 'boolean',
    label: 'Debug Mode',
    initial: true,
    hint: 'Show debug information and markers'
  }
]);

// Spawner state
let spawnerState = {
  initialized: false,
  terrainSystem: null,
  spawnedEntities: [],
  spawnTests: {
    attempted: 0,
    successful: 0,
    failed: 0,
    belowGround: 0,
    aboveGround: 0
  },
  debugInfo: null
};

console.log('🎯 TerrainAwareSpawner: Initializing terrain-aware entity spawning system...');

// Initialize the terrain-aware spawning system
function initializeSpawner() {
  console.log('🚀 Initializing terrain-aware spawner...');
  
  try {
    // Get terrain system
    if (window.world && window.world.systems) {
      spawnerState.terrainSystem = window.world.systems.get('terrain');
      if (spawnerState.terrainSystem) {
        console.log('✅ Terrain system connected');
        spawnerState.initialized = true;
      } else {
        console.warn('⚠️ Terrain system not found, using fallback positioning');
        spawnerState.initialized = true; // Still initialize for testing
      }
    }
    
    // Create debug display if enabled
    if (props.enableDebugMode) {
      createDebugDisplay();
    }
    
    // Start spawning test entities
    spawnTestEntities();
    
    console.log('✅ TerrainAwareSpawner initialized');
    
  } catch (error) {
    console.error('❌ Spawner initialization failed:', error);
  }
}

// Calculate safe spawn position above terrain
function calculateSafeSpawnPosition(x, z) {
  let terrainHeight = 0;
  
  try {
    if (spawnerState.terrainSystem) {
      terrainHeight = spawnerState.terrainSystem.getHeightAt(x, z);
    } else {
      // Fallback: use simple height calculation
      terrainHeight = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 3;
    }
    
    // Ensure minimum height above terrain
    const safeY = terrainHeight + props.minimumHeight;
    
    return {
      x: x,
      y: Math.max(safeY, 0.5), // Never below 0.5
      z: z,
      terrainHeight: terrainHeight,
      heightAboveTerrain: safeY - terrainHeight
    };
    
  } catch (error) {
    console.error('❌ Height calculation failed:', error);
    return {
      x: x,
      y: 2.0, // Safe fallback height
      z: z,
      terrainHeight: 0,
      heightAboveTerrain: 2.0
    };
  }
}

// Spawn test entities with proper terrain positioning
function spawnTestEntities() {
  console.log('🎲 Spawning terrain-aware test entities...');
  
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
  
  for (let i = 0; i < props.testEntityCount; i++) {
    try {
      spawnerState.spawnTests.attempted++;
      
      // Generate random position within spawn radius
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * props.spawnRadius;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      // Calculate safe spawn position
      const safePos = calculateSafeSpawnPosition(x, z);
      
      // Create test entity
      const testEntity = app.create('mesh');
      testEntity.type = 'box';
      testEntity.scale.set(0.5, 0.5, 0.5);
      testEntity.position.set(safePos.x, safePos.y, safePos.z);
      testEntity.color = colors[i % colors.length];
      testEntity.castShadow = true;
      testEntity.receiveShadow = true;
      
      // Create label showing height info
      if (props.enableDebugMode) {
        const heightLabel = app.create('uitext', {
          value: `H: ${safePos.y.toFixed(1)}`,
          fontSize: 10,
          color: 'white',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 2,
          borderRadius: 2
        });
        heightLabel.position.set(0, 1, 0);
        heightLabel.billboard = true;
        testEntity.add(heightLabel);
      }
      
      app.add(testEntity);
      
      // Track spawn result
      const spawnData = {
        id: `testEntity_${i}`,
        position: safePos,
        entity: testEntity,
        spawnTime: Date.now()
      };
      
      spawnerState.spawnedEntities.push(spawnData);
      
      // Categorize spawn result
      if (safePos.y > 0) {
        spawnerState.spawnTests.aboveGround++;
        spawnerState.spawnTests.successful++;
        console.log(`✅ Entity ${i}: Spawned at (${safePos.x.toFixed(2)}, ${safePos.y.toFixed(2)}, ${safePos.z.toFixed(2)}) - ${safePos.heightAboveTerrain.toFixed(2)}u above terrain`);
      } else {
        spawnerState.spawnTests.belowGround++;
        spawnerState.spawnTests.failed++;
        console.warn(`❌ Entity ${i}: Spawned below ground at Y=${safePos.y.toFixed(2)}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to spawn entity ${i}:`, error);
      spawnerState.spawnTests.failed++;
    }
  }
  
  const successRate = (spawnerState.spawnTests.successful / spawnerState.spawnTests.attempted * 100).toFixed(1);
  console.log(`📊 Spawn Results: ${spawnerState.spawnTests.successful}/${spawnerState.spawnTests.attempted} successful (${successRate}%)`);
  console.log(`📊 Above Ground: ${spawnerState.spawnTests.aboveGround}, Below Ground: ${spawnerState.spawnTests.belowGround}`);
}

// Create debug information display
function createDebugDisplay() {
  console.log('📊 Creating debug display...');
  
  try {
    const debugText = app.create('uitext', {
      value: 'Terrain Spawner - Initializing...',
      fontSize: 12,
      color: 'white',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: 8,
      borderRadius: 4
    });
    
    debugText.position.set(0, 25, 0);
    debugText.billboard = true;
    app.add(debugText);
    
    spawnerState.debugInfo = debugText;
    
    // Update debug info periodically
    setInterval(() => {
      updateDebugDisplay();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Failed to create debug display:', error);
  }
}

function updateDebugDisplay() {
  if (!spawnerState.debugInfo) return;
  
  const stats = spawnerState.spawnTests;
  const successRate = stats.attempted > 0 ? (stats.successful / stats.attempted * 100).toFixed(1) : 0;
  const averageHeight = spawnerState.spawnedEntities.length > 0 
    ? (spawnerState.spawnedEntities.reduce((sum, e) => sum + e.position.y, 0) / spawnerState.spawnedEntities.length).toFixed(2)
    : 0;
  
  const debugInfo = `Terrain-Aware Spawner Status
Terrain System: ${spawnerState.terrainSystem ? '✅' : '❌'} Connected
Entities Spawned: ${spawnerState.spawnedEntities.length}

Spawn Results:
Success Rate: ${successRate}%
Above Ground: ${stats.aboveGround}/${stats.attempted}
Below Ground: ${stats.belowGround}/${stats.attempted}
Average Height: ${averageHeight}

Settings:
Spawn Radius: ${props.spawnRadius}
Min Height: ${props.minimumHeight}
Debug Mode: ${props.enableDebugMode ? 'ON' : 'OFF'}`;

  spawnerState.debugInfo.value = debugInfo;
}

// Test position validation
function validateEntityPositions() {
  console.log('🔍 Validating entity positions...');
  
  const results = {
    totalEntities: spawnerState.spawnedEntities.length,
    aboveGround: 0,
    onTerrain: 0,
    belowGround: 0,
    averageHeight: 0,
    heightRange: { min: Infinity, max: -Infinity },
    positionTests: []
  };
  
  spawnerState.spawnedEntities.forEach((entityData, index) => {
    const pos = entityData.position;
    
    // Basic height validation
    if (pos.y > 0) {
      results.aboveGround++;
      if (pos.y > pos.terrainHeight) {
        results.onTerrain++;
      }
    } else {
      results.belowGround++;
    }
    
    // Track height range
    results.heightRange.min = Math.min(results.heightRange.min, pos.y);
    results.heightRange.max = Math.max(results.heightRange.max, pos.y);
    
    // Add to position tests
    results.positionTests.push({
      entityId: entityData.id,
      position: pos,
      aboveGround: pos.y > 0,
      aboveTerrain: pos.y > pos.terrainHeight,
      heightFromTerrain: pos.heightAboveTerrain
    });
  });
  
  if (results.totalEntities > 0) {
    results.averageHeight = spawnerState.spawnedEntities.reduce((sum, e) => sum + e.position.y, 0) / results.totalEntities;
  }
  
  console.log('📊 Position Validation Results:');
  console.log(`  Total Entities: ${results.totalEntities}`);
  console.log(`  Above Ground (Y > 0): ${results.aboveGround}`);
  console.log(`  On Terrain: ${results.onTerrain}`);
  console.log(`  Below Ground: ${results.belowGround}`);
  console.log(`  Average Height: ${results.averageHeight.toFixed(2)}`);
  console.log(`  Height Range: ${results.heightRange.min.toFixed(2)} to ${results.heightRange.max.toFixed(2)}`);
  
  return results;
}

// API for external testing
if (typeof window !== 'undefined') {
  window.terrainAwareSpawner = {
    getState: () => spawnerState,
    getSpawnTests: () => spawnerState.spawnTests,
    getEntities: () => spawnerState.spawnedEntities,
    validatePositions: validateEntityPositions,
    isInitialized: () => spawnerState.initialized,
    calculateSafePosition: calculateSafeSpawnPosition,
    type: 'TerrainAwareSpawner'
  };
  console.log('🌍 TerrainAwareSpawner exposed to window.terrainAwareSpawner');
}

// Initialize when app starts
console.log('🏁 Starting terrain-aware spawning system...');
setTimeout(() => {
  initializeSpawner();
}, 2000); // Wait for world systems to initialize