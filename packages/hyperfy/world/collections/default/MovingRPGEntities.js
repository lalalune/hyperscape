// Moving RPG Entities - Direct implementation with movement
// This creates visible RPG-style entities that move around

app.configure([
  {
    key: 'playerColor',
    type: 'text',
    label: 'Player Color',
    initial: 'blue',
    hint: 'Color for the player entity'
  },
  {
    key: 'goblinColor',
    type: 'text', 
    label: 'Goblin Color',
    initial: 'green',
    hint: 'Color for the goblin entity'
  }
])

console.log('🎮 Creating moving RPG entities...')

// RPG Player Entity
const playerStats = {
  name: 'Hero',
  level: 1,
  health: 100,
  maxHealth: 100,
  position: { x: -5, y: 0, z: 0 },
  inCombat: false
}

// Create Player Mesh
const playerMesh = app.create('mesh')
playerMesh.type = 'box'
playerMesh.scale.set(0.8, 1.8, 0.8)
playerMesh.position.set(playerStats.position.x, 0.9, playerStats.position.z)
playerMesh.material.color = props.playerColor
playerMesh.castShadow = true
playerMesh.receiveShadow = true

// Player nametag
const playerNameTag = app.create('uitext', {
  value: `${playerStats.name} (Lvl ${playerStats.level})`,
  fontSize: 14,
  color: 'white',
  backgroundColor: 'rgba(0,0,0,0.7)',
  padding: 3,
  borderRadius: 3
})
playerNameTag.position.set(0, 2.5, 0)
playerNameTag.billboard = true
playerMesh.add(playerNameTag)

app.add(playerMesh)

// RPG Goblin Entity
const goblinStats = {
  name: 'Goblin',
  level: 2,
  health: 25,
  maxHealth: 25,
  position: { x: 5, y: 0, z: 0 },
  aggressive: true,
  alive: true
}

// Create Goblin Mesh
const goblinMesh = app.create('mesh')
goblinMesh.type = 'box'
goblinMesh.scale.set(0.8, 1.2, 0.8)
goblinMesh.position.set(goblinStats.position.x, 0.6, goblinStats.position.z)
goblinMesh.material.color = props.goblinColor
goblinMesh.castShadow = true
goblinMesh.receiveShadow = true

// Goblin nametag
const goblinNameTag = app.create('uitext', {
  value: `${goblinStats.name} (Lvl ${goblinStats.level})`,
  fontSize: 12,
  color: 'white',
  backgroundColor: 'rgba(0,0,0,0.7)',
  padding: 3,
  borderRadius: 3
})
goblinNameTag.position.set(0, 1.8, 0)
goblinNameTag.billboard = true
goblinMesh.add(goblinNameTag)

app.add(goblinMesh)

// Player Movement System
let playerTargetPosition = null
let playerMoveSpeed = 3.0

function movePlayerRandomly() {
  const randomX = (Math.random() - 0.5) * 20
  const randomZ = (Math.random() - 0.5) * 20
  playerTargetPosition = { x: randomX, y: 0, z: randomZ }
}

// Start player with random movement
movePlayerRandomly()

// Player movement loop
setInterval(() => {
  if (playerTargetPosition) {
    const currentPos = playerMesh.position
    const dx = playerTargetPosition.x - currentPos.x
    const dz = playerTargetPosition.z - currentPos.z
    const distance = Math.sqrt(dx * dx + dz * dz)
    
    if (distance > 0.5) {
      // Move toward target
      const moveX = (dx / distance) * playerMoveSpeed * 0.1
      const moveZ = (dz / distance) * playerMoveSpeed * 0.1
      
      playerMesh.position.x += moveX
      playerMesh.position.z += moveZ
      
      // Update stored position
      playerStats.position.x = playerMesh.position.x
      playerStats.position.z = playerMesh.position.z
      
      // Rotate to face movement direction
      playerMesh.rotation.y = Math.atan2(dx, dz)
    } else {
      // Reached target, pick new target
      movePlayerRandomly()
    }
  }
}, 100)

// Goblin Movement System
let goblinMoveTarget = null
let goblinOriginalPosition = { x: 5, y: 0.6, z: 0 }
let goblinMoveSpeed = 2.0
let goblinWanderRadius = 8

function moveGoblinRandomly() {
  // Pick a random point within wander radius of original position
  const angle = Math.random() * Math.PI * 2
  const distance = Math.random() * goblinWanderRadius
  
  goblinMoveTarget = {
    x: goblinOriginalPosition.x + Math.cos(angle) * distance,
    z: goblinOriginalPosition.z + Math.sin(angle) * distance
  }
}

// Start goblin with random movement
moveGoblinRandomly()

// Goblin movement loop
setInterval(() => {
  if (goblinStats.alive && goblinMoveTarget) {
    const currentPos = goblinMesh.position
    const dx = goblinMoveTarget.x - currentPos.x
    const dz = goblinMoveTarget.z - currentPos.z
    const distance = Math.sqrt(dx * dx + dz * dz)
    
    if (distance > 0.3) {
      const moveX = (dx / distance) * goblinMoveSpeed * 0.05
      const moveZ = (dz / distance) * goblinMoveSpeed * 0.05
      
      goblinMesh.position.x += moveX
      goblinMesh.position.z += moveZ
      
      // Face movement direction
      goblinMesh.rotation.y = Math.atan2(dx, dz)
    } else {
      // Reached target, pick new target
      moveGoblinRandomly()
    }
  }
}, 120)

// Pick new movement targets periodically
setInterval(() => {
  if (Math.random() < 0.3) movePlayerRandomly()
  if (Math.random() < 0.4) moveGoblinRandomly()
}, 5000)

// Combat interaction
const combatAction = app.create('action')
combatAction.label = 'Attack Goblin'
combatAction.distance = 3
combatAction.onTrigger = (player) => {
  if (goblinStats.alive) {
    const damage = Math.floor(Math.random() * 6) + 1
    goblinStats.health -= damage
    
    world.chat.send(`${player.name} attacks ${goblinStats.name} for ${damage} damage!`)
    
    if (goblinStats.health <= 0) {
      goblinStats.alive = false
      goblinMesh.visible = false
      goblinNameTag.visible = false
      
      world.chat.send(`${goblinStats.name} has been defeated!`)
      
      // Respawn after 10 seconds
      setTimeout(() => {
        goblinStats.health = goblinStats.maxHealth
        goblinStats.alive = true
        goblinMesh.visible = true
        goblinNameTag.visible = true
        world.chat.send(`A new ${goblinStats.name} has appeared!`)
      }, 10000)
    }
  }
}

goblinMesh.add(combatAction)

// Add world marker
const worldMarker = app.create('mesh')
worldMarker.type = 'cylinder'
worldMarker.scale.set(2, 0.1, 2)
worldMarker.position.set(0, 0.05, 0)
worldMarker.material.color = 'yellow'
worldMarker.material.transparent = true
worldMarker.material.opacity = 0.2
app.add(worldMarker)

// Add world info
const worldInfo = app.create('uitext', {
  value: 'Moving RPG Entities\nBlue Player & Green Goblin\nClick goblin to attack',
  fontSize: 16,
  color: 'white',
  backgroundColor: 'rgba(0,0,0,0.8)',
  padding: 8,
  borderRadius: 5
})
worldInfo.position.set(0, 3, 0)
worldInfo.billboard = true
app.add(worldInfo)

console.log('✅ Moving RPG entities created - Player and Goblin should be moving!')

// Store entity data for external access
app.getPlayerStats = () => playerStats
app.getGoblinStats = () => goblinStats