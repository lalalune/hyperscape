// RPG Player App for Hyperfy
// This is a real Hyperfy app that creates an RPG player entity

app.configure([
  {
    key: 'playerName',
    type: 'text',
    label: 'Player Name',
    initial: 'Hero',
    hint: 'The name of the RPG player'
  },
  {
    key: 'startingLevel',
    type: 'number',
    label: 'Starting Level',
    initial: 1,
    min: 1,
    max: 99,
    hint: 'The starting level for all skills'
  },
  {
    key: 'health',
    type: 'number',
    label: 'Health Points',
    initial: 100,
    min: 10,
    max: 999,
    hint: 'Starting health points'
  },
  {
    key: 'visualColor',
    type: 'text',
    label: 'Player Color',
    initial: 'blue',
    hint: 'Color of the player representation'
  }
])

// RPG Data structures
const XP_TABLE = [
  0, 83, 174, 276, 388, 512, 650, 801, 969, 1154,
  1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470,
  5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363,
  14833, 16456, 18247, 20224, 22406, 24815, 27473, 30408, 33648, 37224,
  41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333,
  111945, 123660, 136594, 150872, 166636, 184040, 203254, 224466, 247886, 273742,
  302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032, 668051, 737627,
  814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808, 1986068,
  2192818, 2421087, 2673114, 2951373, 3258594, 3597792, 3972294, 4385776, 4842295, 5346332,
  5902831, 6517253, 7195629, 7944614, 8771558, 9684577, 10692629, 11805606, 13034431
]

const ITEMS = {
  // Currency
  995: { name: 'Coins', stackable: true, type: 'currency' },
  
  // Weapons
  1: { name: 'Bronze sword', type: 'weapon', tier: 'bronze', attackLevel: 1 },
  2: { name: 'Steel sword', type: 'weapon', tier: 'steel', attackLevel: 10 },
  3: { name: 'Mithril sword', type: 'weapon', tier: 'mithril', attackLevel: 20 },
  
  // Tools
  70: { name: 'Hatchet', type: 'tool', skill: 'woodcutting' },
  71: { name: 'Fishing rod', type: 'tool', skill: 'fishing' },
  72: { name: 'Tinderbox', type: 'tool', skill: 'firemaking' },
  
  // Resources
  80: { name: 'Logs', stackable: true, type: 'resource' },
  81: { name: 'Raw fish', stackable: true, type: 'resource' },
  82: { name: 'Cooked fish', stackable: true, type: 'food', heals: 4 },
  
  // Arrows
  20: { name: 'Arrow', stackable: true, type: 'ammunition' }
}

function calculateLevelFromXP(xp) {
  for (let i = XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= XP_TABLE[i]) {
      return i + 1
    }
  }
  return 1
}

function addItemToInventory(inventory, itemId, quantity = 1) {
  const item = ITEMS[itemId]
  if (!item) return false
  
  // Try to stack with existing items
  if (item.stackable) {
    for (let i = 0; i < inventory.length; i++) {
      if (inventory[i] && inventory[i].id === itemId) {
        inventory[i].quantity += quantity
        return true
      }
    }
  }
  
  // Find empty slot
  for (let i = 0; i < inventory.length; i++) {
    if (!inventory[i]) {
      inventory[i] = { id: itemId, quantity }
      return true
    }
  }
  
  return false // Inventory full
}

function grantXP(playerStats, skill, amount) {
  if (playerStats[skill]) {
    playerStats[skill].xp += amount
    const newLevel = calculateLevelFromXP(playerStats[skill].xp)
    if (newLevel > playerStats[skill].level) {
      playerStats[skill].level = newLevel
      return true // Level up
    }
  }
  return false
}

// Initialize RPG player data
let playerStats = {
  name: props.playerName,
  
  // Combat stats
  attack: { level: props.startingLevel, xp: 0 },
  strength: { level: props.startingLevel, xp: 0 },
  defense: { level: props.startingLevel, xp: 0 },
  ranged: { level: props.startingLevel, xp: 0 },
  
  // Gathering stats
  woodcutting: { level: props.startingLevel, xp: 0 },
  fishing: { level: props.startingLevel, xp: 0 },
  
  // Processing stats
  firemaking: { level: props.startingLevel, xp: 0 },
  cooking: { level: props.startingLevel, xp: 0 },
  
  // Constitution
  constitution: { level: 10, xp: 0 },
  
  // Current state
  hitpoints: { current: props.health, max: props.health },
  alive: true,
  
  // Equipment slots
  equipment: {
    weapon: null,
    shield: null,
    helmet: null,
    body: null,
    legs: null,
    arrows: null
  },
  
  // 28-slot inventory
  inventory: new Array(28).fill(null),
  
  // Position and state
  position: { x: 0, y: 0, z: 0 },
  inCombat: false,
  target: null,
  lastAction: null
}

// Give starting equipment
addItemToInventory(playerStats.inventory, 1, 1)    // Bronze sword
addItemToInventory(playerStats.inventory, 995, 100) // 100 coins
addItemToInventory(playerStats.inventory, 70, 1)    // Hatchet

// Equip bronze sword
playerStats.equipment.weapon = { id: 1, quantity: 1 }

// Create visual representation
const playerMesh = app.create('mesh')
playerMesh.type = 'box'
playerMesh.scale.set(0.8, 1.8, 0.8)
playerMesh.position.set(0, 0.9, 0)
playerMesh.color = '#0000FF' // Bright blue for visual testing
playerMesh.castShadow = false
playerMesh.receiveShadow = false

// Create nametag
const nameTag = app.create('uitext', {
  value: playerStats.name,
  fontSize: 14,
  color: 'white',
  backgroundColor: 'rgba(0,0,0,0.5)',
  padding: 5,
  borderRadius: 5
})
nameTag.position.set(0, 2.5, 0)
nameTag.billboard = 'full'

// Create health bar
const healthBarBg = app.create('ui', {
  width: 60,
  height: 8,
  backgroundColor: 'rgba(0,0,0,0.8)',
  borderRadius: 4
})
healthBarBg.position.set(0, 2.2, 0)
healthBarBg.billboard = 'full'

const healthBarFill = app.create('ui', {
  width: 56,
  height: 4,
  backgroundColor: 'red',
  borderRadius: 2
})
healthBarFill.position.set(0, 0, 0)
healthBarBg.add(healthBarFill)

app.add(playerMesh)
app.add(nameTag)
app.add(healthBarBg)

// Create action for interacting with player
const interactAction = app.create('action')
interactAction.label = 'Inspect Player'
interactAction.distance = 3
interactAction.onTrigger = (player) => {
  // Send player stats to chat
  const message = `${playerStats.name} - Level ${playerStats.attack.level} (ATK: ${playerStats.attack.level}, STR: ${playerStats.strength.level}, DEF: ${playerStats.defense.level}, HP: ${playerStats.hitpoints.current}/${playerStats.hitpoints.max})`
  world.chat.send(message)
}

playerMesh.add(interactAction)

// RPG API functions for other apps to use
app.getRPGStats = () => playerStats
app.grantXP = (skill, amount) => grantXP(playerStats, skill, amount)
app.addItem = (itemId, quantity) => addItemToInventory(playerStats.inventory, itemId, quantity)
app.takeDamage = (amount) => {
  playerStats.hitpoints.current = Math.max(0, playerStats.hitpoints.current - amount)
  updateHealthBar()
  if (playerStats.hitpoints.current <= 0) {
    handleDeath()
  }
}
app.heal = (amount) => {
  playerStats.hitpoints.current = Math.min(playerStats.hitpoints.max, playerStats.hitpoints.current + amount)
  updateHealthBar()
}

function updateHealthBar() {
  const healthPercentage = playerStats.hitpoints.current / playerStats.hitpoints.max
  healthBarFill.width = 56 * healthPercentage
  healthBarFill.backgroundColor = healthPercentage > 0.5 ? 'green' : healthPercentage > 0.25 ? 'yellow' : 'red'
}

function handleDeath() {
  playerStats.alive = false
  world.chat.send(`${playerStats.name} has died!`)
  
  // Drop items (simplified - drop some coins)
  const coinSlot = playerStats.inventory.find(item => item && item.id === 995)
  if (coinSlot && coinSlot.quantity > 10) {
    const dropAmount = Math.floor(coinSlot.quantity * 0.3)
    coinSlot.quantity -= dropAmount
    
    // Create a dropped item representation
    const droppedCoins = app.create('mesh')
    droppedCoins.type = 'sphere'
    droppedCoins.scale.set(0.2, 0.2, 0.2)
    droppedCoins.position.set(playerStats.position.x, 0.1, playerStats.position.z)
    droppedCoins.color = 'gold'
    
    const pickupAction = app.create('action')
    pickupAction.label = `Pick up ${dropAmount} coins`
    pickupAction.distance = 2
    pickupAction.onTrigger = (player) => {
      world.chat.send(`You picked up ${dropAmount} coins!`)
      app.remove(droppedCoins)
    }
    
    droppedCoins.add(pickupAction)
    app.add(droppedCoins)
  }
  
  // Respawn after 5 seconds
  setTimeout(() => {
    playerStats.hitpoints.current = Math.floor(playerStats.hitpoints.max * 0.5)
    playerStats.alive = true
    updateHealthBar()
    world.chat.send(`${playerStats.name} has respawned!`)
  }, 5000)
}

// Movement system variables
let targetPosition = null
let moveSpeed = 3.0
let lastMoveUpdate = 0
let lastRandomWalk = 0
let lastHealUpdate = 0

// Create movement action
const moveAction = app.create('action')
moveAction.label = 'Move Here'
moveAction.distance = 50 // Large range for movement
moveAction.onTrigger = (player, position) => {
  if (position) {
    targetPosition = { x: position.x, y: 0, z: position.z }
    world.chat.send(`${playerStats.name} is moving to new location`)
  }
}

// Add click-to-move functionality to the ground
const moveZone = app.create('mesh')
moveZone.type = 'box'
moveZone.scale.set(20, 0.1, 20)
moveZone.position.set(0, -0.5, 0)
moveZone.color = 'rgba(0,0,0,0)' // Invisible
moveZone.transparent = true
moveZone.add(moveAction)
app.add(moveZone)

// Use update loop instead of setInterval
app.on('update', (deltaTime) => {
  // Movement update (replaces movement setInterval)
  lastMoveUpdate += deltaTime
  if (lastMoveUpdate >= 0.1) { // 100ms intervals
    if (targetPosition && playerStats.alive) {
      const currentPos = playerMesh.position
      const dx = targetPosition.x - currentPos.x
      const dz = targetPosition.z - currentPos.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      
      if (distance > 0.3) {
        // Move toward target
        const moveX = (dx / distance) * moveSpeed * 0.1
        const moveZ = (dz / distance) * moveSpeed * 0.1
        
        playerMesh.position.x += moveX
        playerMesh.position.z += moveZ
        
        // Update stored position
        playerStats.position.x = playerMesh.position.x
        playerStats.position.z = playerMesh.position.z
        
        // Rotate to face movement direction
        playerMesh.rotation.y = Math.atan2(dx, dz)
      } else {
        // Reached target
        targetPosition = null
      }
    }
    lastMoveUpdate = 0
  }
  
  // Random walk update (replaces random walk setInterval)
  lastRandomWalk += deltaTime
  if (lastRandomWalk >= 3.0) { // 3 second intervals
    if (!targetPosition && Math.random() < 0.1) { // 10% chance every interval
      const randomX = playerMesh.position.x + (Math.random() - 0.5) * 8
      const randomZ = playerMesh.position.z + (Math.random() - 0.5) * 8
      targetPosition = { x: randomX, y: 0, z: randomZ }
    }
    lastRandomWalk = 0
  }
  
  // Auto-heal update (replaces heal setInterval)
  lastHealUpdate += deltaTime
  if (lastHealUpdate >= 3.0) { // 3 second intervals
    if (playerStats.hitpoints.current < playerStats.hitpoints.max && !playerStats.inCombat && playerStats.alive) {
      playerStats.hitpoints.current = Math.min(playerStats.hitpoints.max, playerStats.hitpoints.current + 1)
      updateHealthBar()
    }
    lastHealUpdate = 0
  }
})

// Store player data for persistence
app.state = playerStats

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.rpgPlayer = {
    getStats: () => playerStats,
    getHealth: () => playerStats.hitpoints.current,
    getMaxHealth: () => playerStats.hitpoints.max,
    getSkills: () => ({
      attack: playerStats.attack.level,
      strength: playerStats.strength.level,
      defense: playerStats.defense.level,
      constitution: playerStats.constitution.level
    }),
    getPosition: () => ({ 
      x: playerMesh.position.x, 
      y: playerMesh.position.y, 
      z: playerMesh.position.z 
    }),
    getInventory: () => playerStats.inventory.filter(item => item !== null),
    isAlive: () => playerStats.alive,
    type: 'RPGPlayer'
  }
  console.log('🌍 RPG Player exposed to window.rpgPlayer')
}

console.log(`🎮 RPG Player ${playerStats.name} initialized with stats:`, playerStats)