app.configure([
  {
    key: 'characterHeight',
    type: 'number',
    label: 'Character Height',
    initial: 2,
    min: 0.5,
    max: 5,
    hint: 'Height of the character controller'
  },
  {
    key: 'characterRadius',
    type: 'number',
    label: 'Character Radius',
    initial: 0.5,
    min: 0.1,
    max: 2,
    hint: 'Radius of the character controller'
  },
  {
    key: 'moveSpeed',
    type: 'number',
    label: 'Move Speed',
    initial: 5,
    min: 1,
    max: 20,
    hint: 'Character movement speed'
  },
  {
    key: 'jumpForce',
    type: 'number',
    label: 'Jump Force',
    initial: 8,
    min: 3,
    max: 15,
    hint: 'Character jump force'
  },
  {
    key: 'showDebug',
    type: 'toggle',
    label: 'Show Debug Info',
    initial: true,
    hint: 'Show debug information and terrain data'
  }
])

// Character state
let character = null
let isGrounded = false
let velocity = new THREE.Vector3()
let debugText = null
let currentTerrain = null
let currentBiome = null

// Movement input state
const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  run: false
}

// Initialize character
function createCharacter() {
  // Create visual representation
  const geometry = new THREE.CapsuleGeometry(props.characterRadius, props.characterHeight)
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, props.characterHeight/2 + 1, 0)
  mesh.castShadow = true
  app.add(mesh)
  
  // Create physics controller
  const controller = app.create('controller')
  controller.radius = props.characterRadius
  controller.height = props.characterHeight
  controller.position.copy(mesh.position)
  controller.layer = 'player'
  
  // Create rigid body for physics interactions
  const rigidBody = app.create('rigidbody')
  rigidBody.type = 'dynamic'
  rigidBody.position.copy(mesh.position)
  
  // Create collider for the character
  const collider = app.create('collider')
  collider.type = 'capsule'
  collider.radius = props.characterRadius
  collider.height = props.characterHeight
  
  rigidBody.add(collider)
  world.stage.scene.add(rigidBody)
  
  character = {
    mesh: mesh,
    controller: controller,
    rigidBody: rigidBody,
    collider: collider
  }
  
  return character
}

// Create debug UI
function createDebugUI() {
  if (!props.showDebug) return
  
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas)
  
  // Create debug panel
  const geometry = new THREE.PlaneGeometry(10, 5)
  const material = new THREE.MeshBasicMaterial({ 
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  })
  const plane = new THREE.Mesh(geometry, material)
  plane.position.set(0, 15, 0)
  app.add(plane)
  
  debugText = {
    canvas: canvas,
    context: context,
    texture: texture,
    plane: plane
  }
  
  updateDebugText()
}

// Update debug text
function updateDebugText() {
  if (!debugText || !character) return
  
  const ctx = debugText.context
  const canvas = debugText.canvas
  
  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Set text style
  ctx.fillStyle = 'white'
  ctx.font = '16px monospace'
  
  // Get character position
  const pos = character.mesh.position
  
  // Draw debug information
  let y = 30
  ctx.fillText(`Position: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`, 10, y)
  y += 20
  ctx.fillText(`Velocity: ${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}, ${velocity.z.toFixed(2)}`, 10, y)
  y += 20
  ctx.fillText(`Grounded: ${isGrounded}`, 10, y)
  y += 20
  
  // Get terrain info if available
  if (currentTerrain) {
    ctx.fillText(`Terrain Height: ${currentTerrain.height.toFixed(2)}`, 10, y)
    y += 20
  }
  
  if (currentBiome) {
    ctx.fillText(`Biome: ${currentBiome.name}`, 10, y)
    y += 20
  }
  
  // Controls
  y += 10
  ctx.fillText('Controls:', 10, y)
  y += 20
  ctx.fillText('WASD: Move', 10, y)
  y += 20
  ctx.fillText('Space: Jump', 10, y)
  y += 20
  ctx.fillText('Shift: Run', 10, y)
  
  // Update texture
  debugText.texture.needsUpdate = true
}

// Ground detection using raycast
function checkGrounded() {
  if (!character) return false
  
  const pos = character.mesh.position
  const rayStart = new THREE.Vector3(pos.x, pos.y, pos.z)
  const rayDirection = new THREE.Vector3(0, -1, 0)
  const maxDistance = props.characterHeight/2 + 0.5
  
  // Use world physics for raycast
  const physics = world.getSystem('physics')
  if (physics) {
    const hit = physics.raycast(rayStart, rayDirection, maxDistance)
    if (hit) {
      isGrounded = hit.distance < props.characterHeight/2 + 0.1
      return isGrounded
    }
  }
  
  // Fallback: check terrain height using modern system API
  const appManager = world.rpg?.getSystem('appManager')
  const terrainApps = appManager?.getAppsByType('HeightMapTerrain') || []
  if (terrainApps.length > 0) {
    const terrain = terrainApps[0]
    const terrainHeight = terrain.getHeightAt(pos.x, pos.z)
    isGrounded = pos.y - props.characterHeight/2 <= terrainHeight + 0.1
    
    currentTerrain = {
      height: terrainHeight
    }
    
    currentBiome = terrain.getBiomeAt(pos.x, pos.z)
    
    return isGrounded
  }
  
  return false
}

// Update character movement
function updateMovement(deltaTime) {
  if (!character) return
  
  // Check if grounded
  checkGrounded()
  
  // Calculate movement direction
  const moveDirection = new THREE.Vector3()
  
  if (input.forward) moveDirection.z -= 1
  if (input.backward) moveDirection.z += 1
  if (input.left) moveDirection.x -= 1
  if (input.right) moveDirection.x += 1
  
  // Normalize movement direction
  if (moveDirection.length() > 0) {
    moveDirection.normalize()
  }
  
  // Apply movement speed
  const currentSpeed = input.run ? props.moveSpeed * 1.5 : props.moveSpeed
  moveDirection.multiplyScalar(currentSpeed)
  
  // Apply horizontal movement
  velocity.x = moveDirection.x
  velocity.z = moveDirection.z
  
  // Apply gravity
  if (!isGrounded) {
    velocity.y -= 9.81 * deltaTime
  } else {
    velocity.y = Math.max(0, velocity.y)
  }
  
  // Handle jumping
  if (input.jump && isGrounded) {
    velocity.y = props.jumpForce
    isGrounded = false
  }
  
  // Apply velocity to character
  const movement = velocity.clone().multiplyScalar(deltaTime)
  
  // Move using controller if available
  if (character.controller && character.controller.move) {
    character.controller.move(movement)
    // Update mesh position to match controller
    character.mesh.position.copy(character.controller.position)
  } else {
    // Fallback: direct position update
    character.mesh.position.add(movement)
  }
  
  // Keep character above terrain
  if (currentTerrain) {
    const minY = currentTerrain.height + props.characterHeight/2
    if (character.mesh.position.y < minY) {
      character.mesh.position.y = minY
      velocity.y = 0
      isGrounded = true
    }
  }
  
  // Update debug info
  updateDebugText()
}

// Input handlers
function handleKeyDown(event) {
  switch(event.code) {
    case 'KeyW':
      input.forward = true
      break
    case 'KeyS':
      input.backward = true
      break
    case 'KeyA':
      input.left = true
      break
    case 'KeyD':
      input.right = true
      break
    case 'Space':
      input.jump = true
      event.preventDefault()
      break
    case 'ShiftLeft':
    case 'ShiftRight':
      input.run = true
      break
  }
}

function handleKeyUp(event) {
  switch(event.code) {
    case 'KeyW':
      input.forward = false
      break
    case 'KeyS':
      input.backward = false
      break
    case 'KeyA':
      input.left = false
      break
    case 'KeyD':
      input.right = false
      break
    case 'Space':
      input.jump = false
      break
    case 'ShiftLeft':
    case 'ShiftRight':
      input.run = false
      break
  }
}

// Position character on terrain
function positionOnTerrain() {
  if (!character) return
  
  const appManager = world.rpg?.getSystem('appManager')
  const terrainApps = appManager?.getAppsByType('HeightMapTerrain') || []
  if (terrainApps.length > 0) {
    const terrain = terrainApps[0]
    const terrainHeight = terrain.getHeightAt(0, 0)
    character.mesh.position.y = terrainHeight + props.characterHeight/2 + 1
    
    if (character.controller) {
      character.controller.position.copy(character.mesh.position)
    }
  }
}

// Camera following
function setupCamera() {
  // Set up third-person camera
  const camera = world.getSystem('camera')
  if (camera) {
    camera.position.set(0, 10, 10)
    camera.lookAt(0, 0, 0)
  }
}

// Initialize
app.on('start', () => {
  console.log('Initializing terrain character controller...')
  
  // Create character
  createCharacter()
  
  // Create debug UI
  createDebugUI()
  
  // Position on terrain (wait a bit for terrain to generate)
  setTimeout(() => {
    positionOnTerrain()
  }, 1000)
  
  // Setup camera
  setupCamera()
  
  // Add event listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  }
  
  console.log('Character controller initialized')
})

// Update loop
app.on('update', (deltaTime) => {
  updateMovement(deltaTime)
})

// Cleanup
app.on('destroy', () => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }
})

// Export character data for other systems
app.getCharacterData = function() {
  if (!character) return null
  
  return {
    position: character.mesh.position.clone(),
    velocity: velocity.clone(),
    isGrounded: isGrounded,
    currentTerrain: currentTerrain,
    currentBiome: currentBiome
  }
}