/**
 * Full Terrain System - Complete procedural RPG terrain generation
 * Creates multi-biome terrain with height-mapped segments for visual testing
 */

console.log('🌍 FullTerrain - Initializing complete terrain generation system...')

// Terrain configuration
const WORLD_SIZE = 8          // 8x8 grid of terrain segments (64 total)
const SEGMENT_SIZE = 20       // Each segment is 20x20 units
const HEIGHT_VARIATION = 5    // Max height difference for terrain
const BASE_HEIGHT = 0         // Base terrain level

// Biome definitions with distinct colors for testing
const BIOMES = {
  PLAINS: {
    name: 'Plains',
    color: 0x90EE90,      // Light green
    heightMod: 0,          // Flat terrain
    spawnChance: 0.3
  },
  FOREST: {
    name: 'Forest', 
    color: 0x228B22,      // Forest green
    heightMod: 1,          // Slightly elevated
    spawnChance: 0.25
  },
  HILLS: {
    name: 'Hills',
    color: 0x8FBC8F,      // Dark sea green
    heightMod: 2,          // Elevated terrain
    spawnChance: 0.2
  },
  MOUNTAINS: {
    name: 'Mountains',
    color: 0x696969,      // Dim gray
    heightMod: 4,          // High terrain
    spawnChance: 0.1
  },
  WATER: {
    name: 'Water',
    color: 0x4169E1,      // Royal blue
    heightMod: -2,         // Below base level
    spawnChance: 0.15
  }
}

// Procedural terrain generation using simple noise
function getTerrainHeight(x, z) {
  // Simple pseudo-random height based on position
  const hash = Math.sin(x * 0.1) * Math.cos(z * 0.1) + 
               Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5
  return BASE_HEIGHT + (hash * HEIGHT_VARIATION)
}

function getBiomeForPosition(x, z) {
  // Simple biome selection based on position and pseudo-random
  const biomeHash = (Math.sin(x * 0.08) + Math.cos(z * 0.08)) * 0.5 + 0.5
  
  if (biomeHash < 0.15) return BIOMES.WATER
  else if (biomeHash < 0.35) return BIOMES.MOUNTAINS  
  else if (biomeHash < 0.55) return BIOMES.HILLS
  else if (biomeHash < 0.8) return BIOMES.FOREST
  else return BIOMES.PLAINS
}

console.log(`🔧 Generating ${WORLD_SIZE}x${WORLD_SIZE} terrain world (${WORLD_SIZE * WORLD_SIZE} segments)`)
console.log(`📏 World dimensions: ${WORLD_SIZE * SEGMENT_SIZE}x${WORLD_SIZE * SEGMENT_SIZE} units`)

// Generate terrain segments
let segmentCount = 0
const biomeStats = {}

for (let x = 0; x < WORLD_SIZE; x++) {
  for (let z = 0; z < WORLD_SIZE; z++) {
    // Calculate world position for this segment
    const worldX = (x - WORLD_SIZE/2) * SEGMENT_SIZE + SEGMENT_SIZE/2
    const worldZ = (z - WORLD_SIZE/2) * SEGMENT_SIZE + SEGMENT_SIZE/2
    
    // Generate terrain height and biome
    const terrainHeight = getTerrainHeight(worldX, worldZ)
    const biome = getBiomeForPosition(worldX, worldZ)
    const finalHeight = terrainHeight + biome.heightMod
    
    // Track biome statistics
    biomeStats[biome.name] = (biomeStats[biome.name] || 0) + 1
    
    // Create terrain segment as colored cube
    const segment = app.create('mesh')
    segment.type = 'box'
    segment.width = SEGMENT_SIZE
    segment.height = Math.abs(finalHeight) + 1  // Ensure positive height
    segment.depth = SEGMENT_SIZE
    
    // Position segment (adjust Y for height)
    segment.position.x = worldX
    segment.position.y = finalHeight / 2  // Center the cube at the height
    segment.position.z = worldZ
    
    // Set biome color for visual testing
    segment._intendedColor = biome.color
    segment._biome = biome.name
    segment._height = finalHeight
    
    app.add(segment)
    
    segmentCount++
    
    if (segmentCount % 16 === 0) {
      console.log(`🟦 Generated ${segmentCount}/${WORLD_SIZE * WORLD_SIZE} terrain segments...`)
    }
  }
}

console.log('✅ FullTerrain - Terrain generation complete!')
console.log(`📊 Terrain Statistics:`)
for (const [biome, count] of Object.entries(biomeStats)) {
  console.log(`   ${biome}: ${count} segments (${(count/segmentCount*100).toFixed(1)}%)`)
}
console.log(`📏 Total world coverage: ${(WORLD_SIZE * SEGMENT_SIZE)}x${(WORLD_SIZE * SEGMENT_SIZE)} units`)
console.log(`🎨 Biome Colors - Plains: Light Green, Forest: Forest Green, Hills: Dark Green, Mountains: Gray, Water: Blue`)
console.log(`📷 Use overhead camera to verify multi-biome terrain generation!`)