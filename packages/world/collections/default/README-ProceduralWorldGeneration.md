# Procedural World Generation for Hyperfy

This package provides a complete procedural world generation system for Hyperfy, specifically designed for the RuneScape-inspired RPG MVP. The system generates varied, interesting worlds with multiple biomes, realistic terrain, and physics integration.

## Components

### 1. HeightMapTerrain.hyp

A comprehensive terrain generation app that creates procedural landscapes with:

- **Multi-biome generation** using Voronoi diagrams
- **Deterministic generation** using seeded PRNG
- **Physics integration** with collision mesh generation
- **Biome-specific terrain patterns**
- **Smart town placement** detection
- **Debug visualization** and tools

#### Configuration Properties

- `worldSize` (10-200): Size of the generated world in units
- `heightScale` (1-50): Maximum height of terrain features
- `seed` (1-999999): Random seed for deterministic generation
- `resolution` (8-64): Height map resolution (higher = more detail)
- `biomeCount` (2-8): Number of biomes to generate
- `showDebug` (boolean): Show biome colors and debug information

#### Biome Types

Based on the GDD, the system supports 8 biome types:

1. **Mistwood Valley** - Starter regions with rolling hills
2. **Goblin Wastes** - Barren, rocky terrain
3. **Darkwood Forest** - Dense wooded areas
4. **Northern Reaches** - Snowy mountain regions
5. **Great Lakes** - Water features and shorelines
6. **Blasted Lands** - Volcanic wasteland
7. **Windswept Plains** - Open grasslands
8. **Bramblewood Thicket** - Dense thorny areas

#### API Methods

- `getHeightAt(worldX, worldY)`: Get terrain height at world coordinates
- `getBiomeAt(worldX, worldY)`: Get biome data at world coordinates
- `getWorldData()`: Get complete world generation data

### 2. TerrainCharacterController.hyp

A physics-based character controller that demonstrates proper interaction with generated terrain:

- **Physics integration** with terrain collision
- **Ground detection** using raycast
- **Biome awareness** showing current biome
- **Debug information** display
- **Smooth movement** on terrain surface

#### Configuration Properties

- `characterHeight` (0.5-5): Height of the character controller
- `characterRadius` (0.1-2): Radius of the character controller
- `moveSpeed` (1-20): Character movement speed
- `jumpForce` (3-15): Character jump force
- `showDebug` (boolean): Show debug information panel

#### Controls

- **WASD**: Movement
- **Space**: Jump
- **Shift**: Run
- **Debug Panel**: Shows position, velocity, terrain height, and current biome

## Usage

### Basic Setup

1. Add the HeightMapTerrain app to your world
2. Configure the terrain properties as desired
3. Add the TerrainCharacterController app for testing
4. Run the world and explore the generated terrain

### Integration with RPG Systems

The terrain system is designed to integrate with existing RPG systems:

```javascript
// Get world data for spawning system using modern system API
const appManager = world.rpg?.getSystem('appManager')
const terrainApps = appManager?.getAppsByType('HeightMapTerrain') || []
const terrain = terrainApps[0]
const worldData = terrain?.getWorldData()

// Use biome information for mob spawning
const biome = terrain.getBiomeAt(x, z)
const spawnTable = getSpawnTableForBiome(biome.id)

// Use height data for navigation
const height = terrain.getHeightAt(x, z)
const walkable = height > waterLevel && height < maxSlopeHeight
```

### Test World

A complete test world is provided in `test-worlds/procedural-world-test.json`:

```json
{
  "name": "Procedural World Test",
  "apps": [
    {
      "type": "HeightMapTerrain",
      "props": {
        "worldSize": 100,
        "heightScale": 15,
        "seed": 12345,
        "resolution": 64,
        "biomeCount": 6,
        "showDebug": true
      }
    },
    {
      "type": "TerrainCharacterController",
      "props": {
        "characterHeight": 2,
        "characterRadius": 0.5,
        "moveSpeed": 8,
        "jumpForce": 10,
        "showDebug": true
      }
    }
  ]
}
```

## Technical Details

### Noise Generation

The system uses a custom noise function based on Hyperfy's PRNG:

```javascript
function noise(x, y, frequency = 0.1) {
  // Generate deterministic noise using seeded PRNG
  // Supports bilinear interpolation for smooth terrain
}
```

### Biome Generation

Biomes are placed using Voronoi diagrams:

1. Generate random biome center points
2. For each terrain point, find closest biome center
3. Apply biome-specific height modifications
4. Create smooth transitions between biomes

### Physics Integration

The system generates physics collision meshes:

1. Create terrain mesh from height map
2. Generate collision geometry
3. Create static rigid body
4. Add to physics world

### Performance Optimization

- Efficient height map generation
- Optimized collision mesh creation
- Minimal memory footprint
- Scalable to large world sizes

## Testing

### Automated Tests

Run the test suite:

```bash
node scripts/test-procedural-world.mjs
```

The test runner validates:
- Component configuration
- Deterministic generation
- Biome distribution
- Physics integration

### Manual Testing

1. Load the test world
2. Use WASD to move around
3. Observe terrain generation
4. Check debug information
5. Verify physics collision

### Visual Testing

The debug mode provides:
- Biome color coding
- Debug information panel
- Terrain height visualization
- Character state monitoring

## Integration with Existing Systems

### RPG World Manager

```javascript
// In RPGWorldManager.ts using modern system API
const appManager = world.rpg?.getSystem('appManager')
const terrainApps = appManager?.getAppsByType('HeightMapTerrain') || []
if (terrainApps.length > 0) {
  const terrainApp = terrainApps[0]
  const worldData = terrainApp.getWorldData()
  this.setupBiomeBasedSpawning(worldData)
}
```

### Spawning System

```javascript
// In SpawningSystem.ts
const biome = terrain.getBiomeAt(spawnX, spawnZ)
const spawnTable = this.getBiomeSpawnTable(biome.id)
const entityType = this.selectFromSpawnTable(spawnTable)
```

### Movement System

```javascript
// In MovementSystem.ts
const terrainHeight = terrain.getHeightAt(x, z)
const walkable = this.isTerrainWalkable(terrainHeight, slope)
```

## Performance Considerations

### Optimization Tips

1. **World Size**: Start with smaller worlds (50x50) for testing
2. **Resolution**: Use 32x32 for development, 64x64 for production
3. **Biome Count**: 4-6 biomes provide good variety without complexity
4. **Physics**: Collision meshes are optimized for performance

### Memory Usage

- Height map: ~16KB for 64x64 resolution
- Biome map: ~16KB for 64x64 resolution
- Collision mesh: Depends on terrain complexity

## Future Extensions

The system is designed to be extended with:

- **Resource spawning** based on biome type
- **Weather systems** per biome
- **Seasonal changes** affecting terrain
- **Dynamic terrain** modification
- **Underground caverns** and dungeons
- **Water physics** and rivers

## Troubleshooting

### Common Issues

1. **Character falls through terrain**: Check physics integration
2. **Terrain not generating**: Verify app configuration
3. **Debug info not showing**: Enable showDebug property
4. **Poor performance**: Reduce world size or resolution

### Debug Tools

- Debug panel shows real-time information
- Biome color coding for visual verification
- Console logging for generation steps
- Performance monitoring available

## Contributing

When extending this system:

1. Follow the existing code structure
2. Add appropriate configuration properties
3. Include debug visualization
4. Update documentation
5. Add tests for new features

The procedural world generation system provides a solid foundation for creating varied, interesting worlds that integrate seamlessly with Hyperfy's ECS architecture and physics systems.