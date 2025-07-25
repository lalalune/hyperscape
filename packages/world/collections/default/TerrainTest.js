// Terrain Test App - Demonstrates the enhanced terrain generation system

app.configure([
  {
    key: 'autoLoad',
    type: 'toggle',
    label: 'Auto Load Terrain',
    initial: true
  },
  {
    key: 'chunkRadius',
    type: 'number',
    label: 'Chunk Load Radius',
    min: 1,
    max: 5,
    initial: 2
  },
  {
    key: 'showDebugInfo',
    type: 'toggle',
    label: 'Show Debug Info',
    initial: true
  }
]);

// Global terrain instance
let terrain = null;
let debugUI = null;

// Initialize terrain system
async function initializeTerrain() {
  console.log('[TerrainTest] Initializing procedural terrain...');
  
  try {
    // For now, we'll create a mock terrain system since dynamic imports may not work in Hyperfy
    const terrainConfig = {
      seed: 42,
      biomeCount: 6,
      worldSize: 1000,
      chunkSize: 100,
      chunkResolution: 32,
      maxHeight: 50,
      waterLevel: 0
    };

    // Mock terrain object for testing
    terrain = {
      config: terrainConfig,
      loadedChunks: new Map(),
      biomes: [
        { name: "Mistwood Valley", id: "mistwood_valley" },
        { name: "Goblin Wastes", id: "goblin_wastes" },
        { name: "Darkwood Forest", id: "darkwood_forest" },
        { name: "Northern Reaches", id: "northern_reaches" },
        { name: "Great Lakes", id: "great_lakes" },
        { name: "Windswept Plains", id: "windswept_plains" }
      ],
      towns: [
        { name: "Brookhaven", x: 0, z: 0 },
        { name: "Millharbor", x: 150, z: 150 },
        { name: "Ironhold", x: -150, z: 150 }
      ],
      
      getBiomeAt(x, z) {
        // Simple biome assignment based on position
        const biomeIndex = Math.floor(Math.abs(x + z) / 100) % this.biomes.length;
        return this.biomes[biomeIndex];
      },
      
      getHeightAt(x, z) {
        // Simple height calculation
        return Math.sin(x * 0.01) * Math.cos(z * 0.01) * 10 + 5;
      },
      
      getChunkStats() {
        return {
          loadedChunks: this.loadedChunks.size,
          activeSpawners: Math.floor(this.loadedChunks.size * 2.5),
          activeResources: Math.floor(this.loadedChunks.size * 4.2),
          activePlayers: world.getPlayers ? world.getPlayers().length : 1
        };
      },
      
      forceLoadChunksAroundPosition(x, z, radius) {
        const chunkX = Math.floor(x / this.config.chunkSize);
        const chunkZ = Math.floor(z / this.config.chunkSize);
        
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const key = `${chunkX + dx},${chunkZ + dz}`;
            if (!this.loadedChunks.has(key)) {
              this.loadedChunks.set(key, {
                x: chunkX + dx,
                z: chunkZ + dz,
                spawners: Math.floor(Math.random() * 5) + 2,
                resources: Math.floor(Math.random() * 8) + 3
              });
              console.log(`[TerrainTest] Loaded chunk ${key}`);
            }
          }
        }
      },
      
      forceChunkUpdate() {
        console.log('[TerrainTest] Updating chunk lifecycle...');
      }
    };
    
    // Store on world for global access
    world.terrain = terrain;
    
    console.log('[TerrainTest] ✅ Mock terrain system initialized');
    console.log(`[TerrainTest] Generated ${terrain.biomes.length} biomes`);
    console.log(`[TerrainTest] Generated ${terrain.towns.length} towns`);
    
    return true;
  } catch (error) {
    console.error('[TerrainTest] ❌ Failed to initialize terrain:', error);
    return false;
  }
}

// Create debug UI
function createDebugUI() {
  if (!props.showDebugInfo || debugUI) return;
  
  debugUI = app.create('ui', {
    space: 'screen',
    position: [0.02, 0.02, 0],
    pivot: 'top-left',
    width: 300,
    height: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 10
  });

  const title = app.create('uitext', {
    value: 'Terrain Debug Info',
    fontSize: 16,
    color: '#00ff88',
    fontWeight: 'bold',
    margin: [0, 0, 8, 0]
  });

  const infoText = app.create('uitext', {
    value: 'Loading...',
    fontSize: 12,
    color: '#ffffff',
    lineHeight: 1.4
  });

  debugUI.add(title);
  debugUI.add(infoText);
  app.add(debugUI);
  
  // Store reference for updates
  debugUI.infoText = infoText;
}

// Update debug info
function updateDebugInfo() {
  if (!debugUI || !debugUI.infoText || !terrain) return;
  
  try {
    const stats = terrain.getChunkStats();
    const player = world.getPlayer();
    const playerPos = player ? player.position : { x: 0, y: 0, z: 0 };
    
    let biomeInfo = 'Unknown';
    if (terrain) {
      const biome = terrain.getBiomeAt(playerPos.x, playerPos.z);
      const height = terrain.getHeightAt(playerPos.x, playerPos.z);
      biomeInfo = biome ? `${biome.name} (${height.toFixed(1)}m)` : 'Unknown';
    }
    
    const debugText = `Player: (${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}, ${playerPos.z.toFixed(1)})
Biome: ${biomeInfo}
Loaded Chunks: ${stats.loadedChunks}
Active Spawners: ${stats.activeSpawners}
Active Resources: ${stats.activeResources}
Active Players: ${stats.activePlayers}`;
    
    debugUI.infoText.value = debugText;
  } catch (error) {
    console.warn('[TerrainTest] Debug info update failed:', error);
  }
}

// Main execution
if (world.isServer) {
  console.log('[TerrainTest] Running on server - initializing terrain...');
  
  // Initialize terrain system on server
  initializeTerrain().then(success => {
    if (success) {
      world.terrainInitialized = true;
      console.log('[TerrainTest] Terrain system initialized on server');
    } else {
      console.error('[TerrainTest] Failed to initialize terrain on server');
    }
  });
}

if (world.isClient) {
  console.log('[TerrainTest] Running on client - setting up UI...');
  
  // Create debug UI
  if (props.showDebugInfo) {
    createDebugUI();
  }
  
  // Wait for terrain to be available
  const waitForTerrain = async () => {
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!world.terrain && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (world.terrain) {
      terrain = world.terrain;
      console.log('[TerrainTest] ✅ Terrain available on client');
      
      // Force load some initial chunks
      if (props.autoLoad) {
        const player = world.getPlayer();
        if (player && player.position) {
          terrain.forceLoadChunksAroundPosition(
            player.position.x, 
            player.position.z, 
            props.chunkRadius
          );
        }
      }
    } else {
      console.warn('[TerrainTest] ⚠️ Terrain not available after waiting');
    }
  };
  
  waitForTerrain();
  
  // Update debug UI periodically
  if (props.showDebugInfo) {
    let frameCount = 0;
    app.on('update', () => {
      frameCount++;
      // Update debug info every 60 frames (roughly 1 second at 60fps)
      if (frameCount % 60 === 0) {
        updateDebugInfo();
      }
    });
  }
}

// Handle player movement for automatic chunk loading
if (world.isClient && props.autoLoad) {
  let lastPlayerPosition = null;
  let positionCheckTimer = 0;
  
  app.on('update', (dt) => {
    positionCheckTimer += dt;
    
    // Check player position every 2 seconds
    if (positionCheckTimer >= 2.0) {
      positionCheckTimer = 0;
      
      const player = world.getPlayer();
      if (player && player.position && terrain) {
        const currentPos = player.position;
        
        // Check if player moved significantly
        if (!lastPlayerPosition || 
            Math.abs(currentPos.x - lastPlayerPosition.x) > 50 ||
            Math.abs(currentPos.z - lastPlayerPosition.z) > 50) {
          
          console.log(`[TerrainTest] Player moved to (${currentPos.x.toFixed(1)}, ${currentPos.z.toFixed(1)}), loading chunks...`);
          
          // Load chunks around new position
          terrain.forceLoadChunksAroundPosition(
            currentPos.x, 
            currentPos.z, 
            props.chunkRadius
          );
          
          lastPlayerPosition = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
        }
      }
    }
  });
}

// Cleanup
app.on('destroy', () => {
  if (debugUI) {
    app.remove(debugUI);
    debugUI = null;
  }
  
  console.log('[TerrainTest] Cleaned up terrain test app');
});