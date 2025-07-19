// Simple RPG World Spawner
// Spawns RPG entities into the world for testing

app.configure([
  {
    key: 'spawnPlayer',
    type: 'toggle',
    label: 'Spawn Player',
    initial: true,
    hint: 'Spawn an RPG player entity'
  },
  {
    key: 'spawnGoblins',
    type: 'number',
    label: 'Number of Goblins',
    initial: 3,
    min: 0,
    max: 10,
    hint: 'Number of goblin entities to spawn'
  },
  {
    key: 'spawnRadius',
    type: 'number',
    label: 'Spawn Radius',
    initial: 20,
    min: 5,
    max: 100,
    hint: 'Radius around origin to spawn entities'
  }
])

let spawnedEntities = []

// Spawn RPG entities when the app starts
app.on('start', async () => {
  console.log('🌍 RPG World Spawner initializing...')
  
  // Wait a moment for other systems to initialize
  setTimeout(() => {
    spawnEntities()
  }, 1000)
})

function spawnEntities() {
  console.log('🎮 Spawning RPG entities...')
  
  // Spawn player if enabled
  if (props.spawnPlayer) {
    spawnRPGPlayer()
  }
  
  // Spawn goblins
  for (let i = 0; i < props.spawnGoblins; i++) {
    spawnRPGGoblin(i)
  }
  
  console.log(`✅ Spawned ${spawnedEntities.length} RPG entities`)
}

function spawnRPGPlayer() {
  try {
    // Spawn an RPG player at the origin
    const playerEntity = world.spawn('default/RPGPlayer.hyp', {
      position: [2, 0, 2],
      quaternion: [0, 0, 0, 1],
      props: {
        playerName: 'Hero',
        startingLevel: 1,
        health: 100,
        visualColor: 'blue'
      }
    })
    
    spawnedEntities.push(playerEntity)
    console.log('🦸 Spawned RPG Player at (2, 0, 2)')
    
  } catch (error) {
    console.error('❌ Failed to spawn RPG Player:', error)
  }
}

function spawnRPGGoblin(index) {
  try {
    // Generate random position within spawn radius
    const angle = (index / props.spawnGoblins) * Math.PI * 2
    const distance = 5 + Math.random() * (props.spawnRadius - 5)
    
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    
    // Spawn a goblin
    const goblinEntity = world.spawn('default/RPGGoblin.hyp', {
      position: [x, 0, z],
      quaternion: [0, 0, 0, 1],
      props: {
        goblinName: `Goblin ${index + 1}`,
        level: 1 + Math.floor(Math.random() * 3), // Level 1-3
        maxHealth: 20 + Math.random() * 20, // 20-40 health
        aggressive: true,
        respawnTime: 30
      }
    })
    
    spawnedEntities.push(goblinEntity)
    console.log(`👹 Spawned ${goblinEntity.props.goblinName} at (${x.toFixed(1)}, 0, ${z.toFixed(1)})`)
    
  } catch (error) {
    console.error(`❌ Failed to spawn Goblin ${index + 1}:`, error)
  }
}

// Create a simple ground plane for reference
const groundPlane = app.create('mesh')
groundPlane.type = 'box'
groundPlane.scale.set(100, 0.1, 100)
groundPlane.position.set(0, -0.5, 0)
groundPlane.color = '#654321' // Brown ground
groundPlane.receiveShadow = true

app.add(groundPlane)

// Create a spawn indicator
const spawnIndicator = app.create('mesh')
spawnIndicator.type = 'cylinder'
spawnIndicator.scale.set(1, 0.1, 1)
spawnIndicator.position.set(0, 0, 0)
spawnIndicator.color = '#FFD700' // Gold
spawnIndicator.transparent = true
spawnIndicator.opacity = 0.5

app.add(spawnIndicator)

// Create spawn zone visualization
const spawnZoneRing = app.create('mesh')
spawnZoneRing.type = 'torus'
spawnZoneRing.scale.set(props.spawnRadius, 0.5, props.spawnRadius)
spawnZoneRing.position.set(0, 0.1, 0)
spawnZoneRing.color = 'rgba(255, 255, 255, 0.2)'
spawnZoneRing.transparent = true
spawnZoneRing.wireframe = true

app.add(spawnZoneRing)

// Expose spawned entities for testing
if (typeof window !== 'undefined') {
  window.rpgSpawner = {
    getSpawnedEntities: () => spawnedEntities,
    getEntityCount: () => spawnedEntities.length,
    respawnAll: () => {
      console.log('🔄 Respawning all entities...')
      spawnedEntities = []
      spawnEntities()
    },
    type: 'RPGSpawner'
  }
  console.log('🌍 RPG Spawner exposed to window.rpgSpawner')
}

console.log('🎯 RPG World Spawner ready!')