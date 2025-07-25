// Simple Terrain Generator
// Creates a basic heightmap terrain without complex imports

console.log('[SimpleTerrain] Generating terrain...')

// Simple pseudo-random function (no imports needed)
function simpleRandom(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Simple noise function
function noise(x, y, seed = 1234) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123
  return (n - Math.floor(n)) * 2 - 1 // -1 to 1
}

// Create terrain mesh
const worldSize = props.worldSize
const heightScale = props.heightScale
const resolution = 32

// Generate height map
const heightMap = new Float32Array(resolution * resolution)

for (let y = 0; y < resolution; y++) {
  for (let x = 0; x < resolution; x++) {
    const worldX = (x / resolution) * worldSize - worldSize / 2
    const worldY = (y / resolution) * worldSize - worldSize / 2
    
    // Generate height using simple noise
    let height = 0
    height += noise(worldX * 0.1, worldY * 0.1, 1234) * 0.5
    height += noise(worldX * 0.2, worldY * 0.2, 5678) * 0.3
    height += noise(worldX * 0.4, worldY * 0.4, 9012) * 0.2
    
    // Scale and offset
    height = (height + 1) / 2 // 0 to 1
    height *= heightScale
    
    const index = y * resolution + x
    heightMap[index] = height
  }
}

// Create simple terrain using box geometry (more reliable)
const terrain = app.create('mesh')
terrain.type = 'box' // Use box geometry instead
terrain.width = worldSize
terrain.height = 1 // Thin box for terrain
terrain.depth = worldSize
terrain.material.color = '#4a7c4a' // Forest green
terrain.material.roughness = 0.9
terrain.material.metalness = 0.1
terrain.castShadow = false
terrain.receiveShadow = true

// Position slightly below ground level
terrain.position.y = -0.5

// Add terrain to app
app.add(terrain)

console.log('[SimpleTerrain] Created heightmap terrain mesh')

// Add basic lighting using Hyperfy API
const ambientLight = app.create('ambientLight')
ambientLight.color = '#404040'
ambientLight.intensity = 0.6
app.add(ambientLight)

const directionalLight = app.create('directionalLight')
directionalLight.color = '#ffffff'
directionalLight.intensity = 0.8
directionalLight.position.set(50, 50, 50)
directionalLight.castShadow = true
app.add(directionalLight)

// CRITICAL: Utility function to get height at world position
app.getHeightAt = function(worldX, worldY) {
  const x = Math.floor((worldX + worldSize/2) / worldSize * resolution)
  const y = Math.floor((worldY + worldSize/2) / worldSize * resolution)
  const index = Math.max(0, Math.min(resolution * resolution - 1, y * resolution + x))
  
  return heightMap[index]
}

// Biome function for completeness
app.getBiomeAt = function(worldX, worldY) {
  const height = app.getHeightAt(worldX, worldY)
  if (height < 1) return 'grass'
  if (height < 3) return 'dirt'
  return 'stone'
}

// Store terrain data for other systems
app.getWorldData = function() {
  return {
    worldSize,
    heightScale,
    resolution,
    heightMap,
    getHeightAt: app.getHeightAt,
    getBiomeAt: app.getBiomeAt
  }
}

// Debug information using simple text (safer API)
if (props.showDebug) {
  const debugText = app.create('text')
  debugText.text = `Terrain: ${worldSize}x${worldSize}\\nHeight: 0-${heightScale}\\nRes: ${resolution}x${resolution}`
  debugText.position.set(0, heightScale + 5, 0)
  debugText.fontSize = 0.8
  debugText.color = '#FFFF00'
  app.add(debugText)
}

console.log(`[SimpleTerrain] ✅ Generated ${worldSize}x${worldSize} terrain with ${resolution}x${resolution} resolution`)