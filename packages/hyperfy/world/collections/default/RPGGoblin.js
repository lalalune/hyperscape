// RPG Goblin NPC for Hyperfy
// This is a real Hyperfy app that creates an interactive RPG goblin mob

app.configure([
  {
    key: 'goblinName',
    type: 'text',
    label: 'Goblin Name',
    initial: 'Goblin',
    hint: 'The name of this goblin'
  },
  {
    key: 'level',
    type: 'number',
    label: 'Level',
    initial: 2,
    min: 1,
    max: 20,
    hint: 'The combat level of this goblin'
  },
  {
    key: 'maxHealth',
    type: 'number',
    label: 'Max Health',
    initial: 25,
    min: 5,
    max: 100,
    hint: 'Maximum health points'
  },
  {
    key: 'aggressive',
    type: 'toggle',
    label: 'Aggressive',
    initial: true,
    hint: 'Whether this goblin attacks players on sight'
  },
  {
    key: 'respawnTime',
    type: 'number',
    label: 'Respawn Time (seconds)',
    initial: 30,
    min: 10,
    max: 300,
    hint: 'How long before respawning after death'
  }
])

// Goblin stats and data
let goblinStats = {
  name: props.goblinName,
  level: props.level,
  maxHealth: props.maxHealth,
  currentHealth: props.maxHealth,
  alive: true,
  aggressive: props.aggressive,
  aggroRange: 8,
  inCombat: false,
  target: null,
  lastAttack: 0,
  
  // Combat stats based on level
  attack: props.level,
  strength: props.level,
  defense: Math.floor(props.level * 0.8),
  
  // Loot table
  lootTable: [
    { id: 995, quantity: () => Math.floor(Math.random() * 5) + 3, chance: 1.0 }, // 3-7 coins (always)
    { id: 1, quantity: 1, chance: 0.1 }, // Bronze sword (10% chance)
    { id: 70, quantity: 1, chance: 0.05 } // Hatchet (5% chance)
  ]
}

// Create goblin visual representation
const goblinMesh = app.create('mesh')
goblinMesh.type = 'box'
goblinMesh.scale.set(0.8, 1.2, 0.8)
goblinMesh.position.set(0, 0.6, 0)
goblinMesh.material = 'unlit'
goblinMesh.color = '#00FF00' // Bright green for visual testing
goblinMesh.castShadow = false
goblinMesh.receiveShadow = false

// Create goblin nametag
const nameTag = app.create('uitext', {
  value: `${goblinStats.name} (Level ${goblinStats.level})`,
  fontSize: 12,
  color: 'white',
  backgroundColor: 'rgba(0,0,0,0.7)',
  padding: 3,
  borderRadius: 3
})
nameTag.position.set(0, 1.8, 0)
nameTag.billboard = 'full'

// Create health bar
const healthBarBg = app.create('ui', {
  width: 50,
  height: 6,
  backgroundColor: 'rgba(0,0,0,0.8)',
  borderRadius: 3
})
healthBarBg.position.set(0, 1.5, 0)
healthBarBg.billboard = 'full'

const healthBarFill = app.create('ui', {
  width: 46,
  height: 2,
  backgroundColor: 'red',
  borderRadius: 1
})
healthBarFill.position.set(0, 0, 0)
healthBarBg.add(healthBarFill)

app.add(goblinMesh)
app.add(nameTag)
app.add(healthBarBg)

// Create attack action
const attackAction = app.create('action')
attackAction.label = `Attack ${goblinStats.name}`
attackAction.distance = 2
attackAction.onTrigger = (player) => {
  if (!goblinStats.alive) return
  
  // Calculate damage dealt to goblin
  const damage = Math.floor(Math.random() * 6) + 1 // 1-6 damage
  goblinStats.currentHealth -= damage
  
  world.chat.send(`${player.name} attacks ${goblinStats.name} for ${damage} damage!`)
  
  // Update health bar
  updateHealthBar()
  
  // Set goblin as aggressive towards this player
  goblinStats.inCombat = true
  goblinStats.target = player
  
  // Check if goblin dies
  if (goblinStats.currentHealth <= 0) {
    handleGoblinDeath(player)
  } else {
    // Goblin counter-attacks
    setTimeout(() => {
      if (goblinStats.alive && goblinStats.target) {
        counterAttack(player)
      }
    }, 1000)
  }
}

goblinMesh.add(attackAction)

function updateHealthBar() {
  if (!goblinStats.alive) {
    healthBarBg.visible = false
    return
  }
  
  const healthPercentage = goblinStats.currentHealth / goblinStats.maxHealth
  healthBarFill.width = 46 * healthPercentage
  healthBarFill.backgroundColor = healthPercentage > 0.5 ? 'red' : healthPercentage > 0.25 ? 'orange' : 'darkred'
}

function counterAttack(player) {
  if (!goblinStats.alive || !goblinStats.target) return
  
  const damage = Math.floor(Math.random() * 4) + 1 // 1-4 damage
  world.chat.send(`${goblinStats.name} attacks ${player.name} for ${damage} damage!`)
  
  // Try to find an RPG player app to deal damage
  const rpgApps = world.apps.getAll().filter(app => app.getRPGStats)
  const playerApp = rpgApps.find(app => app.getRPGStats().name === player.name)
  
  if (playerApp) {
    playerApp.takeDamage(damage)
  }
  
  // Continue combat
  if (goblinStats.alive && goblinStats.inCombat) {
    setTimeout(() => {
      if (goblinStats.target && goblinStats.alive) {
        counterAttack(player)
      }
    }, 2000)
  }
}

function handleGoblinDeath(killer) {
  goblinStats.alive = false
  goblinStats.inCombat = false
  goblinStats.target = null
  
  world.chat.send(`${goblinStats.name} has been defeated by ${killer.name}!`)
  
  // Hide goblin mesh
  goblinMesh.visible = false
  healthBarBg.visible = false
  nameTag.visible = false
  
  // Drop loot
  dropLoot(killer)
  
  // Grant XP to killer
  grantXPToKiller(killer)
  
  // Respawn after configured time
  setTimeout(() => {
    respawnGoblin()
  }, props.respawnTime * 1000)
}

function dropLoot(killer) {
  goblinStats.lootTable.forEach(loot => {
    if (Math.random() < loot.chance) {
      const quantity = typeof loot.quantity === 'function' ? loot.quantity() : loot.quantity
      
      // Create dropped item
      const droppedItem = app.create('mesh')
      droppedItem.type = 'sphere'
      droppedItem.scale.set(0.15, 0.15, 0.15)
      droppedItem.position.set(
        goblinMesh.position.x + (Math.random() - 0.5) * 2,
        0.1,
        goblinMesh.position.z + (Math.random() - 0.5) * 2
      )
      droppedItem.color = loot.id === 995 ? 'gold' : 'brown'
      
      const pickupAction = app.create('action')
      pickupAction.label = `Pick up ${quantity} ${getItemName(loot.id)}`
      pickupAction.distance = 2
      pickupAction.onTrigger = (player) => {
        // Try to find RPG player app to add item
        const rpgApps = world.apps.getAll().filter(app => app.getRPGStats)
        const playerApp = rpgApps.find(app => app.getRPGStats().name === player.name)
        
        if (playerApp) {
          const success = playerApp.addItem(loot.id, quantity)
          if (success) {
            world.chat.send(`${player.name} picked up ${quantity} ${getItemName(loot.id)}!`)
            app.remove(droppedItem)
          } else {
            world.chat.send(`${player.name}'s inventory is full!`)
          }
        }
      }
      
      droppedItem.add(pickupAction)
      app.add(droppedItem)
      
      // Remove dropped item after 2 minutes
      setTimeout(() => {
        app.remove(droppedItem)
      }, 120000)
    }
  })
}

function grantXPToKiller(killer) {
  const xpAmount = goblinStats.level * 10 // 10 XP per level
  
  // Try to find RPG player app
  const rpgApps = world.apps.getAll().filter(app => app.getRPGStats)
  const playerApp = rpgApps.find(app => app.getRPGStats().name === killer.name)
  
  if (playerApp) {
    const levelledUp = playerApp.grantXP('attack', xpAmount)
    world.chat.send(`${killer.name} gained ${xpAmount} Attack XP!`)
    
    if (levelledUp) {
      world.chat.send(`🎉 ${killer.name} leveled up their Attack skill!`)
    }
  }
}

function getItemName(itemId) {
  const ITEMS = {
    995: 'Coins',
    1: 'Bronze sword',
    70: 'Hatchet'
  }
  return ITEMS[itemId] || 'Unknown item'
}

function respawnGoblin() {
  goblinStats.currentHealth = goblinStats.maxHealth
  goblinStats.alive = true
  goblinStats.inCombat = false
  goblinStats.target = null
  
  goblinMesh.visible = true
  healthBarBg.visible = true
  nameTag.visible = true
  
  updateHealthBar()
  
  world.chat.send(`A new ${goblinStats.name} has appeared!`)
}

// Movement system variables
let moveTarget = null
let originalPosition = { x: 0, y: 0.6, z: 0 }
let moveSpeed = 1.5
let wanderRadius = 8
let lastMoveUpdate = 0
let lastWanderUpdate = 0
let lastAggroCheck = 0
let lastIdleRotation = 0

// Set initial position
goblinMesh.position.copy(originalPosition)

// Use update loop instead of setInterval
app.on('update', (deltaTime) => {
  // Movement update (replaces movement setInterval)
  lastMoveUpdate += deltaTime
  if (lastMoveUpdate >= 0.1) { // 100ms intervals
    if (!goblinStats.alive) return
    
    if (goblinStats.inCombat && goblinStats.target) {
      // Move toward combat target
      const targetPos = goblinStats.target.position
      if (targetPos) {
        const dx = targetPos.x - goblinMesh.position.x
        const dz = targetPos.z - goblinMesh.position.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        
        if (distance > 1.5) { // Stay at melee range
          const moveX = (dx / distance) * moveSpeed * 0.05
          const moveZ = (dz / distance) * moveSpeed * 0.05
          
          goblinMesh.position.x += moveX
          goblinMesh.position.z += moveZ
          
          // Face the target
          goblinMesh.rotation.y = Math.atan2(dx, dz)
        }
      }
    } else if (moveTarget) {
      // Move toward wander target
      const dx = moveTarget.x - goblinMesh.position.x
      const dz = moveTarget.z - goblinMesh.position.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      
      if (distance > 0.3) {
        const moveX = (dx / distance) * moveSpeed * 0.03
        const moveZ = (dz / distance) * moveSpeed * 0.03
        
        goblinMesh.position.x += moveX
        goblinMesh.position.z += moveZ
        
        // Face movement direction
        goblinMesh.rotation.y = Math.atan2(dx, dz)
      } else {
        // Reached target
        moveTarget = null
      }
    }
    lastMoveUpdate = 0
  }
  
  // Wander behavior update (replaces wander setInterval)
  lastWanderUpdate += deltaTime
  if (lastWanderUpdate >= 4.0) { // 4 second intervals
    if (!goblinStats.alive || goblinStats.inCombat || moveTarget) return
    
    // Random chance to start wandering
    if (Math.random() < 0.3) {
      // Pick a random point within wander radius of original position
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * wanderRadius
      
      moveTarget = {
        x: originalPosition.x + Math.cos(angle) * distance,
        z: originalPosition.z + Math.sin(angle) * distance
      }
    }
    lastWanderUpdate = 0
  }
  
  // Aggro check update (replaces aggro setInterval)
  if (goblinStats.aggressive) {
    lastAggroCheck += deltaTime
    if (lastAggroCheck >= 2.0) { // 2 second intervals
      if (!goblinStats.alive || goblinStats.inCombat) return
      
      // Check if world.players exists and has getAll method
      const nearbyPlayers = (world.players && world.players.getAll) ? world.players.getAll().filter(player => {
        const distance = Math.sqrt(
          Math.pow(player.position.x - goblinMesh.position.x, 2) +
          Math.pow(player.position.z - goblinMesh.position.z, 2)
        )
        return distance < goblinStats.aggroRange
      }) : []
      
      if (nearbyPlayers.length > 0) {
        const targetPlayer = nearbyPlayers[0]
        goblinStats.target = targetPlayer
        goblinStats.inCombat = true
        moveTarget = null // Stop wandering
        
        world.chat.send(`${goblinStats.name} notices ${targetPlayer.name} and becomes aggressive!`)
        
        // Start attacking
        setTimeout(() => {
          counterAttack(targetPlayer)
        }, 1000)
      }
      lastAggroCheck = 0
    }
  }
  
  // Idle animation update (replaces idle rotation setInterval)
  lastIdleRotation += deltaTime
  if (lastIdleRotation >= 0.1) { // 100ms intervals
    if (goblinStats.alive && !goblinStats.inCombat) {
      const rotationSpeed = 0.01
      goblinMesh.rotation.y += rotationSpeed
    }
    lastIdleRotation = 0
  }
})

// API for other apps
app.getGoblinStats = () => goblinStats
app.forceRespawn = () => respawnGoblin()

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.rpgGoblin = {
    getStats: () => goblinStats,
    getHealth: () => goblinStats.currentHealth,
    getMaxHealth: () => goblinStats.maxHealth,
    getLevel: () => goblinStats.level,
    getPosition: () => ({ 
      x: goblinMesh.position.x, 
      y: goblinMesh.position.y, 
      z: goblinMesh.position.z 
    }),
    isAlive: () => goblinStats.alive,
    isInCombat: () => goblinStats.inCombat,
    type: 'RPGGoblin'
  }
  console.log('🌍 RPG Goblin exposed to window.rpgGoblin')
}

console.log(`🧌 RPG Goblin ${goblinStats.name} (Level ${goblinStats.level}) spawned!`)