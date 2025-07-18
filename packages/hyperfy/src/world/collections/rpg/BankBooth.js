/**
 * Bank Booth App Script
 * Creates an interactive banking interface for players
 */

// Configure app properties
app.configure([
  {
    key: 'bankName',
    type: 'text',
    label: 'Bank Name',
    initial: 'Bank of Lumbridge',
  },
  {
    key: 'requirePIN',
    type: 'toggle',
    label: 'Require PIN',
    initial: true,
    hint: 'Players need a PIN to access their bank',
  },
  {
    key: 'interactionRange',
    type: 'number',
    label: 'Interaction Range',
    initial: 3,
    min: 1,
    max: 10,
    step: 0.5,
  },
  {
    key: 'bankSlots',
    type: 'number',
    label: 'Bank Slots',
    initial: 816,
    min: 100,
    max: 2000,
    step: 50,
    hint: 'Number of bank slots per player',
  },
  {
    key: 'showQueue',
    type: 'toggle',
    label: 'Show Queue',
    initial: true,
    hint: 'Display waiting queue when multiple players interact',
  },
])

// Get RPG systems
const bankingSystem = world.getSystem('banking')
const inventorySystem = world.getSystem('inventory')

if (!bankingSystem || !inventorySystem) {
  console.error('[BankBooth] Required RPG systems not available. Enable RPG plugin first.')
  return
}

// Create visual bank booth
const booth = app.create('mesh', {
  geometry: 'box',
  scale: [2, 2.5, 1],
  material: {
    color: '#8B4513',
    roughness: 0.7,
    metalness: 0.1,
  },
})

// Create banker NPC placeholder
const banker = app.create('mesh', {
  geometry: 'box',
  scale: [0.6, 1.8, 0.6],
  position: [0, 0.9, -0.3],
  material: {
    color: 'blue',
    roughness: 0.8,
  },
})

// Create bank sign
const bankSign = app.create('uitext', {
  position: [0, 3, 0],
  text: props.bankName,
  fontSize: 0.4,
  color: 'gold',
  align: 'center',
})

// Create interaction prompt
const interactionPrompt = app.create('uitext', {
  position: [0, 1.5, 1],
  text: 'Click to Bank',
  fontSize: 0.3,
  color: 'white',
  align: 'center',
  visible: false,
})

// Track active users and queue
let activeUsers = new Set()
let userQueue = []
const maxSimultaneousUsers = 1 // Banks typically handle one player at a time

// Register bank booth with banking system
const bankBoothId = bankingSystem.registerBankBooth({
  id: app.id,
  name: props.bankName,
  position: app.position.clone(),
  slots: props.bankSlots,
  requirePIN: props.requirePIN,
  interactionRange: props.interactionRange,
  app: app,
})

console.log(`[BankBooth] Registered bank booth: ${props.bankName}`)

// Handle player interactions
app.on('click', data => {
  const playerId = data.userId
  const playerPosition = data.playerPosition || { x: 0, y: 0, z: 0 }

  // Check distance
  const distance = app.position.distanceTo(playerPosition)
  if (distance > props.interactionRange) {
    console.log(`[BankBooth] Player ${playerId} too far from bank (${distance.toFixed(1)}m)`)
    return
  }

  // Add to queue if not already banking
  if (!activeUsers.has(playerId) && !userQueue.includes(playerId)) {
    addToQueue(playerId)
  } else if (activeUsers.has(playerId)) {
    // Player is already banking, close their bank
    closeBankForPlayer(playerId)
  }
})

// Add player to banking queue
function addToQueue(playerId) {
  userQueue.push(playerId)
  console.log(`[BankBooth] Player ${playerId} added to queue (position: ${userQueue.length})`)

  // Update queue display
  updateQueueDisplay()

  // Process queue
  processQueue()
}

// Process the banking queue
function processQueue() {
  if (activeUsers.size < maxSimultaneousUsers && userQueue.length > 0) {
    const nextPlayerId = userQueue.shift()
    openBankForPlayer(nextPlayerId)
  }
}

// Open bank interface for player
function openBankForPlayer(playerId) {
  activeUsers.add(playerId)

  console.log(`[BankBooth] Opening bank for player ${playerId}`)

  // Notify banking system
  bankingSystem.openBank(playerId, bankBoothId, {
    slots: props.bankSlots,
    requirePIN: props.requirePIN,
    onClose: () => closeBankForPlayer(playerId),
  })

  // Update visual state
  updateBankState()

  // Send UI event to player
  app.sendTo(playerId, 'bankOpened', {
    bankName: props.bankName,
    slots: props.bankSlots,
    requirePIN: props.requirePIN,
  })
}

// Close bank for player
function closeBankForPlayer(playerId) {
  if (!activeUsers.has(playerId)) return

  activeUsers.delete(playerId)
  console.log(`[BankBooth] Closing bank for player ${playerId}`)

  // Notify banking system
  bankingSystem.closeBank(playerId)

  // Send UI event to player
  app.sendTo(playerId, 'bankClosed', {})

  // Update visual state
  updateBankState()
  updateQueueDisplay()

  // Process next player in queue
  setTimeout(() => processQueue(), 500)
}

// Update bank visual state
function updateBankState() {
  const isActive = activeUsers.size > 0

  // Change banker color based on activity
  banker.material.color = isActive ? 'green' : 'blue'

  // Update interaction prompt
  if (isActive) {
    interactionPrompt.text = `In Use (${activeUsers.size}/${maxSimultaneousUsers})`
    interactionPrompt.color = 'red'
  } else {
    interactionPrompt.text = 'Click to Bank'
    interactionPrompt.color = 'white'
  }
}

// Update queue display
function updateQueueDisplay() {
  if (!props.showQueue || userQueue.length === 0) {
    // Hide queue display
    return
  }

  // Show queue status
  const queueText = `Queue: ${userQueue.length} waiting`
  console.log(`[BankBooth] ${queueText}`)

  // Could create visual queue indicators here
}

// Handle player proximity for interaction prompt
app.on('playerNear', data => {
  const { playerId, distance } = data

  if (distance <= props.interactionRange) {
    // Show interaction prompt to nearby player
    app.sendTo(playerId, 'bankPrompt', {
      show: true,
      message: 'Click to Bank',
      distance: distance,
    })
  } else {
    // Hide interaction prompt
    app.sendTo(playerId, 'bankPrompt', {
      show: false,
    })
  }
})

// Handle bank transactions
app.on('bankTransaction', data => {
  const { playerId, action, itemId, quantity } = data

  if (!activeUsers.has(playerId)) {
    console.log(`[BankBooth] Unauthorized bank transaction from ${playerId}`)
    return
  }

  switch (action) {
    case 'deposit':
      bankingSystem.depositItem(playerId, itemId, quantity)
      break
    case 'withdraw':
      bankingSystem.withdrawItem(playerId, itemId, quantity)
      break
    case 'depositAll':
      bankingSystem.depositAllItems(playerId)
      break
  }
})

// Handle disconnections and cleanup
app.on('playerLeft', data => {
  const { playerId } = data

  // Remove from queue
  const queueIndex = userQueue.indexOf(playerId)
  if (queueIndex !== -1) {
    userQueue.splice(queueIndex, 1)
    updateQueueDisplay()
  }

  // Close bank if active
  if (activeUsers.has(playerId)) {
    closeBankForPlayer(playerId)
  }
})

// Cleanup on app destroy
app.on('destroy', () => {
  // Close all active banking sessions
  for (const playerId of activeUsers) {
    bankingSystem.closeBank(playerId)
  }

  // Unregister from banking system
  if (bankingSystem) {
    bankingSystem.unregisterBankBooth(bankBoothId)
  }

  console.log(`[BankBooth] Cleaned up bank booth: ${props.bankName}`)
})

console.log(`[BankBooth] ${props.bankName} initialized successfully`)
