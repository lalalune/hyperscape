/**
 * Goblin NPC App Script
 * Creates an interactive RPG NPC with combat and loot mechanics
 */

// Configure app properties
app.configure([
  {
    key: 'npcName',
    type: 'text',
    label: 'NPC Name',
    initial: 'Goblin Warrior',
  },
  {
    key: 'level',
    type: 'number',
    label: 'Level',
    initial: 5,
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'health',
    type: 'number',
    label: 'Max Health',
    initial: 25,
    min: 1,
    max: 1000,
    step: 5,
  },
  {
    key: 'aggressive',
    type: 'toggle',
    label: 'Aggressive',
    initial: true,
    hint: 'Will attack players on sight',
  },
  {
    key: 'lootTable',
    type: 'text',
    label: 'Loot Table',
    initial: 'goblin_drops',
    hint: 'Loot table ID for drops',
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
])

// NPC state
let currentHealth = props.health
let isDead = false
let lastAttackTime = 0
let target = null

// Get RPG systems
const npcSystem = world.getSystem('npc')
const combatSystem = world.getSystem('combat')
const lootSystem = world.getSystem('loot')

if (!npcSystem) {
  console.error('[GoblinNPC] NPC system not available. Enable RPG plugin first.')
  return
}

// Register this app as an NPC
const npcId = npcSystem.registerNPC({
  id: app.id,
  name: props.npcName,
  level: props.level,
  maxHealth: props.health,
  currentHealth: currentHealth,
  npcType: 'monster',
  behavior: props.aggressive ? 'aggressive' : 'passive',
  lootTable: props.lootTable,
  position: app.position.clone(),
  app: app,
})

console.log(`[GoblinNPC] Registered NPC: ${props.npcName} (Level ${props.level})`)

// Create visual representation
const mesh = app.create('mesh', {
  geometry: 'box',
  scale: [0.8, 1.2, 0.5],
  material: {
    color: 'green',
    roughness: 0.8,
  },
})

// Create health bar
const healthBar = app.create('ui', {
  position: [0, 1.5, 0],
  width: 1,
  height: 0.1,
  color: 'red',
  visible: false,
})

// Create name label
const nameLabel = app.create('uitext', {
  position: [0, 1.8, 0],
  text: props.npcName,
  fontSize: 0.3,
  color: props.aggressive ? 'red' : 'yellow',
  align: 'center',
})

// Handle player interactions
app.on('click', data => {
  const playerId = data.userId
  if (isDead) return

  if (combatSystem) {
    // Initiate combat
    console.log(`[GoblinNPC] Player ${playerId} attacking ${props.npcName}`)
    combatSystem.startCombat(playerId, npcId)
  } else {
    console.log('[GoblinNPC] Combat system not available')
  }
})

// Handle damage from combat system
app.on('takeDamage', data => {
  if (isDead) return

  const { damage, attackerId } = data
  currentHealth = Math.max(0, currentHealth - damage)

  // Update health bar
  const healthPercentage = currentHealth / props.health
  healthBar.scale.x = healthPercentage
  healthBar.visible = true

  console.log(`[GoblinNPC] ${props.npcName} took ${damage} damage (${currentHealth}/${props.health} HP)`)

  // Broadcast damage
  app.send('npcDamaged', {
    npcId: npcId,
    damage: damage,
    currentHealth: currentHealth,
    maxHealth: props.health,
  })

  // Check if dead
  if (currentHealth <= 0) {
    handleDeath(attackerId)
  } else {
    // Set target for retaliation
    target = attackerId
  }
})

// Handle death
function handleDeath(killerId) {
  if (isDead) return

  isDead = true
  console.log(`[GoblinNPC] ${props.npcName} has been defeated by player ${killerId}`)

  // Visual death effect
  mesh.material.color = 'gray'
  mesh.rotation.z = Math.PI / 2 // Fall over
  nameLabel.text = `${props.npcName} (Dead)`
  nameLabel.color = 'gray'
  healthBar.visible = false

  // Drop loot
  if (lootSystem) {
    lootSystem.dropLoot({
      lootTable: props.lootTable,
      position: app.position.clone(),
      killerId: killerId,
    })
  }

  // Broadcast death
  app.send('npcDied', {
    npcId: npcId,
    killerId: killerId,
    position: app.position.toArray(),
  })

  // Schedule respawn
  setTimeout(() => {
    respawn()
  }, props.respawnTime * 1000)
}

// Handle respawn
function respawn() {
  isDead = false
  currentHealth = props.health
  target = null

  // Reset visuals
  mesh.material.color = 'green'
  mesh.rotation.z = 0
  nameLabel.text = props.npcName
  nameLabel.color = props.aggressive ? 'red' : 'yellow'
  healthBar.visible = false

  console.log(`[GoblinNPC] ${props.npcName} has respawned`)

  // Broadcast respawn
  app.send('npcRespawned', {
    npcId: npcId,
    position: app.position.toArray(),
  })
}

// AI behavior update
setInterval(() => {
  if (isDead) return

  // Basic AI - attack target if aggressive
  if (props.aggressive && target && combatSystem) {
    const now = Date.now()
    if (now - lastAttackTime >= 3000) {
      // Attack every 3 seconds
      combatSystem.npcAttack(npcId, target)
      lastAttackTime = now
    }
  }
}, 1000)

// Cleanup on app destroy
app.on('destroy', () => {
  if (npcSystem) {
    npcSystem.unregisterNPC(npcId)
  }
  console.log(`[GoblinNPC] Cleaned up NPC: ${props.npcName}`)
})

console.log(`[GoblinNPC] ${props.npcName} initialized successfully`)
