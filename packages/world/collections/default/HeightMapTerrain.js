app.configure([
  {
    key: 'worldSize',
    type: 'number',
    label: 'World Size',
    initial: 50,
    min: 10,
    max: 200,
    hint: 'Size of the generated world in units'
  },
  {
    key: 'heightScale',
    type: 'number',
    label: 'Height Scale',
    initial: 10,
    min: 1,
    max: 50,
    hint: 'Maximum height of terrain features'
  },
  {
    key: 'seed',
    type: 'number',
    label: 'Random Seed',
    initial: 12345,
    min: 1,
    max: 999999,
    hint: 'Seed for deterministic generation'
  },
  {
    key: 'resolution',
    type: 'number',
    label: 'Resolution',
    initial: 32,
    min: 8,
    max: 64,
    hint: 'Height map resolution (higher = more detail)'
  },
  {
    key: 'biomeCount',
    type: 'number',
    label: 'Biome Count',
    initial: 4,
    min: 2,
    max: 8,
    hint: 'Number of biomes to generate'
  },
  {
    key: 'showDebug',
    type: 'toggle',
    label: 'Show Debug',
    initial: true,
    hint: 'Show biome colors and debug info'
  }
])

// Import PRNG for deterministic generation
import { prng } from '../../../core/extras/prng.js'

// Biome definitions based on GDD
const BIOMES = {
  MISTWOOD_VALLEY: {
    id: 'mistwood_valley',
    name: 'Mistwood Valley',
    color: 0x4a7c59,
    heightRange: [0, 0.3],
    heightAmplitude: 0.5,
    terrainTypes: ['grass', 'dirt'],
    features: ['trees', 'hills']
  },
  GOBLIN_WASTES: {
    id: 'goblin_wastes',
    name: 'Goblin Wastes',
    color: 0x8b4513,
    heightRange: [0.1, 0.4],
    heightAmplitude: 0.3,
    terrainTypes: ['dirt', 'stone'],
    features: ['rocks', 'camps']
  },
  DARKWOOD_FOREST: {
    id: 'darkwood_forest',
    name: 'Darkwood Forest',
    color: 0x2d4a2d,
    heightRange: [0.2, 0.6],
    heightAmplitude: 0.4,
    terrainTypes: ['grass', 'dirt'],
    features: ['dense_trees', 'clearings']
  },
  NORTHERN_REACHES: {
    id: 'northern_reaches',
    name: 'Northern Reaches',
    color: 0xf0f8ff,
    heightRange: [0.6, 1.0],
    heightAmplitude: 0.8,
    terrainTypes: ['snow', 'stone'],
    features: ['mountains', 'ice']
  },
  GREAT_LAKES: {
    id: 'great_lakes',
    name: 'Great Lakes',
    color: 0x4682b4,
    heightRange: [-0.2, 0.2],
    heightAmplitude: 0.2,
    terrainTypes: ['water', 'sand'],
    features: ['lakes', 'shores']
  },
  BLASTED_LANDS: {
    id: 'blasted_lands',
    name: 'Blasted Lands',
    color: 0x8b0000,
    heightRange: [0.1, 0.5],
    heightAmplitude: 0.6,
    terrainTypes: ['lava', 'stone'],
    features: ['volcanic', 'ash']
  },
  WINDSWEPT_PLAINS: {
    id: 'windswept_plains',
    name: 'Windswept Plains',
    color: 0x9acd32,
    heightRange: [0.0, 0.3],
    heightAmplitude: 0.2,
    terrainTypes: ['grass', 'dirt'],
    features: ['plains', 'wind']
  },
  BRAMBLEWOOD_THICKET: {
    id: 'bramblewood_thicket',
    name: 'Bramblewood Thicket',
    color: 0x556b2f,
    heightRange: [0.1, 0.4],
    heightAmplitude: 0.3,
    terrainTypes: ['grass', 'dirt'],
    features: ['thorns', 'dense_vegetation']
  }
}

// Initialize with app properties
const worldSize = props.worldSize
const heightScale = props.heightScale
const seed = props.seed
const resolution = props.resolution
const biomeCount = props.biomeCount
const showDebug = props.showDebug

// Create seeded random number generator
const rng = prng(seed)

// World generation state
let heightMap = null
let biomeMap = null
let terrainMesh = null
let biomePoints = []
let debugSpheresGroup = null

// Simple noise function using PRNG
function noise(x, y, frequency = 0.1) {
  const intX = Math.floor(x * frequency)
  const intY = Math.floor(y * frequency)
  const fracX = (x * frequency) - intX
  const fracY = (y * frequency) - intY
  
  // Hash coordinates to get pseudo-random values
  const hash = (intX * 73856093) ^ (intY * 19349663)
  const rngLocal = prng(seed + Math.abs(hash))
  
  const a = rngLocal(0, 1000) / 1000
  const b = rngLocal(0, 1000) / 1000
  const c = rngLocal(0, 1000) / 1000
  const d = rngLocal(0, 1000) / 1000
  
  // Bilinear interpolation
  const i1 = a * (1 - fracX) + b * fracX
  const i2 = c * (1 - fracX) + d * fracX
  
  return i1 * (1 - fracY) + i2 * fracY
}

// Generate Voronoi diagram for biomes
function generateBiomePoints() {
  biomePoints = []
  const biomeTypes = Object.values(BIOMES).slice(0, biomeCount)
  
  for (let i = 0; i < biomeCount; i++) {
    const x = rng(0, worldSize)
    const y = rng(0, worldSize)
    biomePoints.push({
      x: x,
      y: y,
      biome: biomeTypes[i % biomeTypes.length]
    })
  }
}

// Find closest biome point
function getClosestBiome(x, y) {
  let closestDistance = Infinity
  let closestBiome = biomePoints[0]
  
  for (const point of biomePoints) {
    const dx = x - point.x
    const dy = y - point.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance < closestDistance) {
      closestDistance = distance
      closestBiome = point
    }
  }
  
  return closestBiome
}

// Generate height map with biome influence
function generateHeightMap() {
  heightMap = new Float32Array(resolution * resolution)
  biomeMap = new Array(resolution * resolution)
  
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const worldX = (x / resolution) * worldSize
      const worldY = (y / resolution) * worldSize
      
      // Get biome for this position
      const biome = getClosestBiome(worldX, worldY)
      
      // Generate base height using noise
      let height = 0
      height += noise(worldX, worldY, 0.02) * 0.5  // Base terrain
      height += noise(worldX, worldY, 0.05) * 0.3  // Medium features
      height += noise(worldX, worldY, 0.1) * 0.2   // Fine detail
      
      // Apply biome-specific modifications
      const biomeHeight = biome.biome.heightRange[0] + 
        (biome.biome.heightRange[1] - biome.biome.heightRange[0]) * 
        ((height + 1) / 2)
      
      height = biomeHeight * biome.biome.heightAmplitude
      
      // Scale by height scale
      height *= heightScale
      
      const index = y * resolution + x
      heightMap[index] = height
      biomeMap[index] = biome.biome
    }
  }
}

// Create terrain mesh from height map
function createTerrainMesh() {
  const geometry = new THREE.PlaneGeometry(worldSize, worldSize, resolution - 1, resolution - 1)
  const vertices = geometry.attributes.position.array
  const colors = new Float32Array(vertices.length)
  
  // Apply height map to vertices and set colors
  for (let i = 0; i < vertices.length; i += 3) {
    const x = Math.floor((vertices[i] + worldSize/2) / worldSize * resolution)
    const y = Math.floor((vertices[i + 1] + worldSize/2) / worldSize * resolution)
    const index = Math.max(0, Math.min(resolution * resolution - 1, y * resolution + x))
    
    // Set height
    vertices[i + 2] = heightMap[index]
    
    // Set biome color
    if (showDebug && biomeMap[index]) {
      const color = new THREE.Color(biomeMap[index].color)
      colors[i] = color.r
      colors[i + 1] = color.g
      colors[i + 2] = color.b
    } else {
      // Default terrain color based on height
      const height = heightMap[index]
      if (height < 0) {
        colors[i] = 0.2; colors[i + 1] = 0.4; colors[i + 2] = 0.8  // Water
      } else if (height < 2) {
        colors[i] = 0.3; colors[i + 1] = 0.6; colors[i + 2] = 0.3  // Grass
      } else if (height < 5) {
        colors[i] = 0.5; colors[i + 1] = 0.4; colors[i + 2] = 0.2  // Dirt
      } else {
        colors[i] = 0.6; colors[i + 1] = 0.6; colors[i + 2] = 0.6  // Stone
      }
    }
  }
  
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.rotateX(-Math.PI / 2)  // Rotate to be horizontal
  geometry.computeVertexNormals()
  
  // Create material
  const material = new THREE.MeshStandardMaterial({ 
    vertexColors: true,
    wireframe: false,
    side: THREE.DoubleSide
  })
  
  terrainMesh = new THREE.Mesh(geometry, material)
  terrainMesh.receiveShadow = true
  
  return terrainMesh
}

// Create physics collision for terrain
function createTerrainPhysics() {
  if (!terrainMesh) return
  
  // Create rigid body for terrain
  const rigidBody = app.create('rigidbody')
  rigidBody.type = 'static'
  
  // Create collider from terrain geometry
  const collider = app.create('collider')
  collider.type = 'geometry'
  collider.geometry = terrainMesh.geometry
  
  rigidBody.add(collider)
  world.stage.scene.add(rigidBody)
}

// Create debug visualization
function createDebugVisualization() {
  if (!showDebug) return
  
  debugSpheresGroup = new THREE.Group()
  
  // Create spheres for biome centers
  for (const point of biomePoints) {
    const geometry = new THREE.SphereGeometry(2, 8, 8)
    const material = new THREE.MeshBasicMaterial({ 
      color: point.biome.color,
      transparent: true,
      opacity: 0.7
    })
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.set(point.x - worldSize/2, 10, point.y - worldSize/2)
    debugSpheresGroup.add(sphere)
  }
  
  app.add(debugSpheresGroup)
}

// Create spawn points for towns
function createTownSpawnPoints() {
  const townPoints = []
  
  // Find flat areas suitable for towns
  for (let i = 0; i < 5; i++) {
    let bestX = 0, bestY = 0, bestFlatness = 0
    
    // Sample random positions and find flattest
    for (let j = 0; j < 50; j++) {
      const sampleX = rng(5, worldSize - 5)
      const sampleY = rng(5, worldSize - 5)
      
      // Check flatness in 5x5 area
      let totalHeight = 0
      let minHeight = Infinity
      let maxHeight = -Infinity
      
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = Math.floor((sampleX + dx) / worldSize * resolution)
          const y = Math.floor((sampleY + dy) / worldSize * resolution)
          const index = Math.max(0, Math.min(resolution * resolution - 1, y * resolution + x))
          const height = heightMap[index]
          
          totalHeight += height
          minHeight = Math.min(minHeight, height)
          maxHeight = Math.max(maxHeight, height)
        }
      }
      
      const flatness = 1 / (1 + (maxHeight - minHeight))
      
      if (flatness > bestFlatness) {
        bestFlatness = flatness
        bestX = sampleX
        bestY = sampleY
      }
    }
    
    townPoints.push({ x: bestX, y: bestY, flatness: bestFlatness })
  }
  
  // Visualize town points
  for (const town of townPoints) {
    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.set(town.x - worldSize/2, 10, town.y - worldSize/2)
    app.add(cube)
  }
}

// Initialize world generation
function initializeWorld() {
  console.log('Generating procedural world...')
  console.log(`World Size: ${worldSize}, Height Scale: ${heightScale}, Seed: ${seed}`)
  
  // Generate biome points
  generateBiomePoints()
  console.log(`Generated ${biomePoints.length} biome points`)
  
  // Generate height map
  generateHeightMap()
  console.log(`Generated ${resolution}x${resolution} height map`)
  
  // Create terrain mesh
  const mesh = createTerrainMesh()
  app.add(mesh)
  console.log('Created terrain mesh')
  
  // Create physics
  createTerrainPhysics()
  console.log('Created terrain physics')
  
  // Create debug visualization
  createDebugVisualization()
  
  // Create town spawn points
  createTownSpawnPoints()
  
  console.log('World generation complete!')
}

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
app.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(50, 50, 50)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.width = 2048
directionalLight.shadow.mapSize.height = 2048
app.add(directionalLight)

// Initialize on start
app.on('start', () => {
  initializeWorld()
})

// Utility function to get height at world position
app.getHeightAt = function(worldX, worldY) {
  if (!heightMap) return 0
  
  const x = Math.floor((worldX + worldSize/2) / worldSize * resolution)
  const y = Math.floor((worldY + worldSize/2) / worldSize * resolution)
  const index = Math.max(0, Math.min(resolution * resolution - 1, y * resolution + x))
  
  return heightMap[index]
}

// Utility function to get biome at world position
app.getBiomeAt = function(worldX, worldY) {
  if (!biomeMap) return null
  
  const x = Math.floor((worldX + worldSize/2) / worldSize * resolution)
  const y = Math.floor((worldY + worldSize/2) / worldSize * resolution)
  const index = Math.max(0, Math.min(resolution * resolution - 1, y * resolution + x))
  
  return biomeMap[index]
}

// Export world generation data for other systems
app.getWorldData = function() {
  return {
    worldSize,
    heightScale,
    seed,
    resolution,
    biomeCount,
    heightMap,
    biomeMap,
    biomePoints,
    BIOMES
  }
}