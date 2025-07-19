// Auto-spawn RPG entities in the world at startup
// This places the MovingRPGEntities app in the world automatically

console.log('🌍 AutoSpawnRPG: World loading, spawning RPG entities...')

// Create an instance of the MovingRPGEntities directly
const movingRPGEntities = app.create('mesh')
movingRPGEntities.type = 'box'
movingRPGEntities.scale.set(0.1, 0.1, 0.1)
movingRPGEntities.position.set(0, -1, 0) // Underground marker
movingRPGEntities.material.color = 'rgba(0,0,0,0)'
movingRPGEntities.material.transparent = true
movingRPGEntities.visible = false // Invisible marker

// Add the actual RPG entities directly to this app
// This bypasses the need for complex app spawning

// RPG Player Entity
const playerStats = {
  name: 'Hero',
  level: 1,
  health: 100,
  maxHealth: 100,
  position: { x: -5, y: 0, z: 0 },
  inCombat: false
}

console.log('🎮 Creating RPG Player entity...')

// Create Player Mesh
const playerMesh = app.create('mesh')
playerMesh.type = 'box'
playerMesh.scale.set(0.8, 1.8, 0.8)
playerMesh.position.set(playerStats.position.x, 0.9, playerStats.position.z)
playerMesh.material.color = 'blue'
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

console.log('🧌 Creating RPG Goblin entity...')

// Create Goblin Mesh
const goblinMesh = app.create('mesh')
goblinMesh.type = 'box'
goblinMesh.scale.set(0.8, 1.2, 0.8)
goblinMesh.position.set(goblinStats.position.x, 0.6, goblinStats.position.z)
goblinMesh.material.color = 'green'
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

console.log('✅ RPG entities created!')

// Player Movement System
let playerTargetPosition = { x: (Math.random() - 0.5) * 16, y: 0, z: (Math.random() - 0.5) * 16 }
let playerMoveSpeed = 3.0

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
      playerTargetPosition = { 
        x: (Math.random() - 0.5) * 20, 
        y: 0, 
        z: (Math.random() - 0.5) * 20 
      }
    }
  }
}, 100)

// Goblin Movement System
let goblinMoveTarget = { x: 5 + (Math.random() - 0.5) * 8, y: 0, z: (Math.random() - 0.5) * 8 }
let goblinMoveSpeed = 2.0

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
      goblinMoveTarget = { 
        x: 5 + (Math.random() - 0.5) * 16, 
        y: 0, 
        z: (Math.random() - 0.5) * 16 
      }
    }
  }
}, 120)

// Pick new movement targets periodically
setInterval(() => {
  // New player target
  playerTargetPosition = { 
    x: (Math.random() - 0.5) * 20, 
    y: 0, 
    z: (Math.random() - 0.5) * 20 
  }
  
  // New goblin target
  goblinMoveTarget = { 
    x: 5 + (Math.random() - 0.5) * 16, 
    y: 0, 
    z: (Math.random() - 0.5) * 16 
  }
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
      
      world.chat.send(`${goblinStats.name} has been defeated! XP gained!`)
      
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

// Add world info
const worldInfo = app.create('uitext', {
  value: 'RPG World Active\nBlue Player & Green Goblin\nMoving & Interactive!',
  fontSize: 16,
  color: 'white',
  backgroundColor: 'rgba(0,0,0,0.8)',
  padding: 8,
  borderRadius: 5
})
worldInfo.position.set(0, 4, 0)
worldInfo.billboard = true
app.add(worldInfo)

// Store entity data for external access
app.getPlayerStats = () => playerStats
app.getGoblinStats = () => goblinStats

console.log('🎯 AutoSpawnRPG: Complete! RPG entities should be moving in the world!')