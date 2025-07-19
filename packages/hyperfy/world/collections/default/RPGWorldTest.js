// RPG World Test - Spawns RPG entities for testing
// This script creates instances of RPG Player and Goblin apps in the world

app.configure([
  {
    key: 'spawnPlayer',
    type: 'toggle',
    label: 'Spawn RPG Player',
    initial: true,
    hint: 'Whether to spawn an RPG player entity'
  },
  {
    key: 'spawnGoblin',
    type: 'toggle',
    label: 'Spawn RPG Goblin',
    initial: true,
    hint: 'Whether to spawn an RPG goblin entity'
  },
  {
    key: 'playerColor',
    type: 'text',
    label: 'Player Color',
    initial: 'blue',
    hint: 'Color for the RPG player'
  }
])

console.log('🌍 RPG World Test starting - spawning RPG entities...')

// Spawn RPG Player if enabled
if (props.spawnPlayer) {
  try {
    console.log('📍 Spawning RPG Player...')
    
    // Create RPG Player instance
    const rpgPlayer = app.create('default/RPGPlayer.hyp')
    rpgPlayer.position.set(-5, 0, 0) // Position it to the left
    
    // Configure the player
    rpgPlayer.configure({
      playerName: 'TestHero',
      startingLevel: 1,
      health: 100,
      visualColor: props.playerColor
    })
    
    app.add(rpgPlayer)
    console.log('✅ RPG Player spawned successfully')
  } catch (error) {
    console.error('❌ Failed to spawn RPG Player:', error)
  }
}

// Spawn RPG Goblin if enabled
if (props.spawnGoblin) {
  try {
    console.log('📍 Spawning RPG Goblin...')
    
    // Create RPG Goblin instance
    const rpgGoblin = app.create('default/RPGGoblin.hyp')
    rpgGoblin.position.set(5, 0, 0) // Position it to the right
    
    // Configure the goblin
    rpgGoblin.configure({
      goblinName: 'TestGoblin',
      level: 2,
      maxHealth: 25,
      aggressive: true,
      respawnTime: 30
    })
    
    app.add(rpgGoblin)
    console.log('✅ RPG Goblin spawned successfully')
  } catch (error) {
    console.error('❌ Failed to spawn RPG Goblin:', error)
  }
}

// Create visual markers to confirm this app is working
const marker = app.create('mesh')
marker.type = 'cylinder'
marker.scale.set(1, 0.1, 1)
marker.position.set(0, 0.05, 0)
marker.material.color = 'yellow'
marker.material.transparent = true
marker.material.opacity = 0.3
app.add(marker)

// Add information text
const infoText = app.create('uitext', {
  value: 'RPG World Test Active\nPlayer & Goblin should be spawned',
  fontSize: 16,
  color: 'white',
  backgroundColor: 'rgba(0,0,0,0.7)',
  padding: 8,
  borderRadius: 5
})
infoText.position.set(0, 3, 0)
infoText.billboard = true
app.add(infoText)

console.log('🎯 RPG World Test setup complete')