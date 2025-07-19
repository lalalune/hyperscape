// Generic RPG Item App Template
// This template is used for all integrated 3D assets
// It provides basic interaction and visual representation

const RPGItemApp = {
  // App configuration
  configure: function() {
    app.configure([
      {
        type: 'boolean',
        key: 'testMode',
        label: 'Test Mode',
        initial: false,
        description: 'Enable test mode with cube proxy'
      },
      {
        type: 'string',
        key: 'gameId',
        label: 'Game ID',
        initial: '',
        description: 'Unique identifier for this item'
      },
      {
        type: 'string',
        key: 'itemType',
        label: 'Item Type',
        initial: 'misc',
        description: 'Type of item (weapon, armor, tool, etc.)'
      },
      {
        type: 'string',
        key: 'itemTier',
        label: 'Item Tier',
        initial: 'basic',
        description: 'Tier of item (bronze, steel, mithril, etc.)'
      },
      {
        type: 'boolean',
        key: 'interactable',
        label: 'Interactable',
        initial: true,
        description: 'Can players interact with this item?'
      },
      {
        type: 'number',
        key: 'respawnTime',
        label: 'Respawn Time (seconds)',
        initial: 30,
        min: 1,
        max: 300,
        description: 'Time before item respawns after being taken'
      }
    ])
  },

  // App initialization
  init: function() {
    console.log(`[RPGItem] Initializing ${props.gameId || 'Unknown Item'}`)
    
    // Set up the visual representation
    this.setupVisuals()
    
    // Create interaction if enabled
    if (props.interactable) {
      this.setupInteraction()
    }
    
    // Initialize app state
    app.state = {
      available: true,
      lastTaken: 0,
      takenBy: null,
      respawnTimer: null
    }
    
    // Register with RPG systems if available
    this.registerWithRPGSystems()
  },

  // Set up visual representation
  setupVisuals: function() {
    if (props.testMode) {
      // Create test cube proxy
      this.createTestCube()
    } else {
      // Use the actual 3D model
      this.setupModel()
    }
  },

  // Create test cube proxy for visual testing
  createTestCube: function() {
    const cube = app.create('mesh')
    cube.geometry = { primitive: 'box', width: 1, height: 1, depth: 1 }
    
    // Color coding by item type
    const colors = {
      'weapon': '#FF6B6B',    // Red
      'armor': '#4ECDC4',     // Teal
      'tool': '#45B7D1',      // Blue
      'consumable': '#96CEB4', // Green
      'resource': '#FFEAA7',  // Yellow
      'building': '#DDA0DD',  // Plum
      'misc': '#CCCCCC'       // Gray
    }
    
    cube.material = {
      color: colors[props.itemType] || colors.misc,
      opacity: 0.8,
      transparent: true
    }
    
    // Add floating animation
    cube.position.y = 0.5
    app.on('update', (dt) => {
      cube.position.y = 0.5 + Math.sin(Date.now() * 0.001) * 0.2
      cube.rotation.y += dt * 0.5
    })
    
    // Add label
    this.addLabel(cube, `${props.gameId || 'Test Item'} (CUBE)`)
  },

  // Set up the actual 3D model
  setupModel: function() {
    // The model is automatically loaded from the .hyp file's model property
    const model = app.get('model')
    if (model) {
      // Scale and position the model appropriately
      model.scale.setScalar(1)
      model.position.y = 0
      
      // Add subtle floating animation for items
      app.on('update', (dt) => {
        model.position.y = Math.sin(Date.now() * 0.001) * 0.1
      })
      
      // Add label
      this.addLabel(model, props.gameId || 'RPG Item')
    }
  },

  // Add floating label above the item
  addLabel: function(target, text) {
    const label = app.create('ui')
    label.text = text
    label.color = '#FFFFFF'
    label.fontSize = 14
    label.position.y = 2
    label.billboard = true
    
    target.add(label)
  },

  // Set up interaction system
  setupInteraction: function() {
    const action = app.create('action')
    action.label = `Take ${props.gameId || 'Item'}`
    action.distance = 3
    action.duration = 0.5
    
    action.onTrigger = (player) => {
      if (!app.state.available) {
        this.showMessage(player, 'This item is not available')
        return
      }
      
      // Attempt to take the item
      this.takeItem(player)
    }
    
    // Add action to the main model/cube
    const target = app.get('model') || app.get('cube')
    if (target) {
      target.add(action)
    }
  },

  // Handle item being taken
  takeItem: function(player) {
    console.log(`[RPGItem] ${player.name} took ${props.gameId}`)
    
    // Mark as taken
    app.state.available = false
    app.state.lastTaken = Date.now()
    app.state.takenBy = player.id
    
    // Hide the item
    this.hideItem()
    
    // Send to RPG inventory system
    this.addToPlayerInventory(player)
    
    // Schedule respawn
    this.scheduleRespawn()
    
    // Show feedback
    this.showMessage(player, `You took ${props.gameId}`)
  },

  // Hide the item visually
  hideItem: function() {
    const model = app.get('model')
    if (model) {
      model.visible = false
    }
    
    // Also hide any cube proxy
    app.traverse(child => {
      if (child.geometry && child.geometry.primitive === 'box') {
        child.visible = false
      }
    })
  },

  // Show the item visually
  showItem: function() {
    const model = app.get('model')
    if (model) {
      model.visible = true
    }
    
    // Also show any cube proxy
    app.traverse(child => {
      if (child.geometry && child.geometry.primitive === 'box') {
        child.visible = true
      }
    })
  },

  // Schedule item respawn
  scheduleRespawn: function() {
    if (app.state.respawnTimer) {
      clearTimeout(app.state.respawnTimer)
    }
    
    app.state.respawnTimer = setTimeout(() => {
      this.respawnItem()
    }, props.respawnTime * 1000)
  },

  // Respawn the item
  respawnItem: function() {
    console.log(`[RPGItem] ${props.gameId} respawned`)
    
    app.state.available = true
    app.state.lastTaken = 0
    app.state.takenBy = null
    app.state.respawnTimer = null
    
    // Show the item again
    this.showItem()
  },

  // Add item to player inventory (placeholder)
  addToPlayerInventory: function(player) {
    // This would interface with the actual RPG inventory system
    // For now, just send a message
    app.send('rpg:item_taken', {
      playerId: player.id,
      itemId: props.gameId,
      itemType: props.itemType,
      itemTier: props.itemTier,
      timestamp: Date.now()
    })
  },

  // Show message to player
  showMessage: function(player, message) {
    // This would use the actual messaging system
    console.log(`[RPGItem] Message to ${player.name}: ${message}`)
  },

  // Register with RPG systems
  registerWithRPGSystems: function() {
    // Register this item with the RPG world systems
    app.send('rpg:register_item', {
      id: app.instanceId,
      gameId: props.gameId,
      type: props.itemType,
      tier: props.itemTier,
      position: app.position,
      available: app.state.available
    })
  }
}

// Initialize the app
RPGItemApp.configure()
RPGItemApp.init()

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RPGItemApp
}