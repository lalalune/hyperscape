/**
 * Spawn Area App Script
 * Creates an area that automatically spawns and manages NPCs
 */

// Configure app properties
app.configure([
  {
    key: 'areaName',
    type: 'text',
    label: 'Area Name',
    initial: 'Goblin Camp',
  },
  {
    key: 'npcTypes',
    type: 'textarea',
    label: 'NPC Types (comma-separated)',
    initial: 'goblin,rat',
    hint: 'List of NPC types to spawn in this area',
  },
  {
    key: 'maxCount',
    type: 'number',
    label: 'Max NPCs',
    initial: 5,
    min: 1,
    max: 50,
    step: 1,
  },
  {
    key: 'radius',
    type: 'number',
    label: 'Spawn Radius',
    initial: 10,
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'respawnTime',
    type: 'number',
    label: 'Respawn Time (seconds)',
    initial: 30,
    min: 5,
    max: 300,
    step: 5,
  },
  {
    key: 'showBounds',
    type: 'toggle',
    label: 'Show Area Bounds',
    initial: true,
    hint: 'Display visual indicator of spawn area',
  },
])

// Get RPG systems
const spawningSystem = world.getSystem('spawning')
const npcSystem = world.getSystem('npc')

if (!spawningSystem || !npcSystem) {
  console.error('[SpawnArea] Required RPG systems not available. Enable RPG plugin first.')
  return
}

// Parse NPC types
const npcTypes = props.npcTypes
  .split(',')
  .map(type => type.trim())
  .filter(type => type.length > 0)

if (npcTypes.length === 0) {
  console.error('[SpawnArea] No valid NPC types specified')
  return
}

// Create visual boundary (optional)
let boundaryMesh = null
if (props.showBounds) {
  boundaryMesh = app.create('mesh', {
    geometry: 'cylinder',
    scale: [props.radius * 2, 0.1, props.radius * 2],
    position: [0, 0.05, 0],
    material: {
      color: 'yellow',
      transparent: true,
      opacity: 0.3,
      wireframe: true,
    },
  })
}

// Create area label
const areaLabel = app.create('uitext', {
  position: [0, 2, 0],
  text: props.areaName,
  fontSize: 0.5,
  color: 'white',
  align: 'center',
})

// Create spawn area in spawning system
const spawnAreaId = spawningSystem.createSpawnArea({
  id: app.id,
  name: props.areaName,
  center: app.position.clone(),
  radius: props.radius,
  npcTypes: npcTypes,
  maxCount: props.maxCount,
  respawnTime: props.respawnTime * 1000,
  app: app,
})

console.log(`[SpawnArea] Created spawn area: ${props.areaName} for NPCs: ${npcTypes.join(', ')}`)

// Track spawned NPCs
let spawnedNPCs = new Set()

// Handle NPC spawning events
app.on('npcSpawned', data => {
  const { npcId, npcType, position } = data
  spawnedNPCs.add(npcId)
  console.log(`[SpawnArea] Spawned ${npcType} at position [${position.x}, ${position.y}, ${position.z}]`)

  // Update area label
  updateAreaStatus()
})

// Handle NPC death events
app.on('npcDied', data => {
  const { npcId } = data
  spawnedNPCs.delete(npcId)
  console.log(`[SpawnArea] NPC ${npcId} died in area ${props.areaName}`)

  // Update area status
  updateAreaStatus()
})

// Update area status display
function updateAreaStatus() {
  const activeCount = spawnedNPCs.size
  areaLabel.text = `${props.areaName} (${activeCount}/${props.maxCount})`

  // Change color based on spawn status
  if (activeCount === 0) {
    areaLabel.color = 'red'
  } else if (activeCount < props.maxCount) {
    areaLabel.color = 'yellow'
  } else {
    areaLabel.color = 'green'
  }
}

// Debug info on click
app.on('click', data => {
  console.log(`[SpawnArea] Area Info:
    Name: ${props.areaName}
    Active NPCs: ${spawnedNPCs.size}/${props.maxCount}
    NPC Types: ${npcTypes.join(', ')}
    Radius: ${props.radius}
    Center: [${app.position.x}, ${app.position.y}, ${app.position.z}]`)
})

// Manual spawn trigger (for testing)
app.on('manualSpawn', () => {
  if (spawnedNPCs.size < props.maxCount) {
    spawningSystem.forceSpawn(spawnAreaId)
    console.log(`[SpawnArea] Manual spawn triggered in ${props.areaName}`)
  } else {
    console.log(`[SpawnArea] Cannot spawn - area ${props.areaName} is at capacity`)
  }
})

// Cleanup on app destroy
app.on('destroy', () => {
  if (spawningSystem) {
    spawningSystem.removeSpawnArea(spawnAreaId)
  }
  console.log(`[SpawnArea] Cleaned up spawn area: ${props.areaName}`)
})

// Initial status update
updateAreaStatus()

console.log(`[SpawnArea] ${props.areaName} initialized successfully`)
