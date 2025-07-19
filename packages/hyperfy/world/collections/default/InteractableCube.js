// InteractableCube.js - A test cube that spawns objects when clicked

// Configure the app properties
app.configure([
  {
    type: 'number',
    key: 'maxSpawns',
    label: 'Max Spawns',
    initial: 5,
    min: 1,
    max: 20
  },
  {
    type: 'string',
    key: 'cubeColor',
    label: 'Cube Color',
    initial: '#ff0000'
  }
]);

// App state
app.state = {
  spawnCount: 0,
  spawned: []
};

// Create the main cube mesh
const cube = app.create('mesh');
cube.type = 'box';
cube.material.color = props.cubeColor || '#ff0000';
cube.material.metalness = 0.1;
cube.material.roughness = 0.7;
cube.position.set(0, 0.5, 0);

// Create an action for interaction
const action = app.create('action');
action.label = 'Spawn Object';
action.distance = 5;
action.duration = 0.5;

// Add the action to the cube
cube.add(action);

// Handle the action trigger
action.onTrigger = (player) => {
  console.log('[InteractableCube] Action triggered by:', player?.id);
  
  // Check if we haven't exceeded max spawns
  if (app.state.spawnCount >= props.maxSpawns) {
    console.log('[InteractableCube] Maximum spawns reached');
    return;
  }
  
  // Spawn a new object
  const spawnedObject = app.create('mesh');
  spawnedObject.type = 'sphere';
  spawnedObject.material.color = getRandomColor();
  spawnedObject.material.metalness = 0.3;
  spawnedObject.material.roughness = 0.5;
  
  // Position it randomly around the cube
  const angle = Math.random() * Math.PI * 2;
  const distance = 2 + Math.random() * 2;
  spawnedObject.position.set(
    Math.cos(angle) * distance,
    0.5 + Math.random() * 1,
    Math.sin(angle) * distance
  );
  
  // Add some scale variety
  const scale = 0.3 + Math.random() * 0.4;
  spawnedObject.scale.set(scale, scale, scale);
  
  // Store reference
  app.state.spawned.push(spawnedObject);
  app.state.spawnCount++;
  
  console.log(`[InteractableCube] Spawned object ${app.state.spawnCount}/${props.maxSpawns}`);
  
  // Update the action label
  action.label = `Spawn Object (${app.state.spawnCount}/${props.maxSpawns})`;
  
  // Disable action if max reached
  if (app.state.spawnCount >= props.maxSpawns) {
    action.label = 'Max Spawns Reached';
  }
  
  // Add physics to the spawned object
  if (spawnedObject.addRigidBody) {
    spawnedObject.addRigidBody({
      type: 'dynamic',
      mass: 1,
      restitution: 0.8
    });
  }
  
  // Animate the cube when spawning
  animateCube();
};

// Function to get random colors
function getRandomColor() {
  const colors = ['#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Function to animate the cube when spawning
function animateCube() {
  const originalScale = cube.scale.x;
  const targetScale = originalScale * 1.2;
  
  // Scale up
  cube.scale.set(targetScale, targetScale, targetScale);
  
  // Scale back down after a short delay
  setTimeout(() => {
    cube.scale.set(originalScale, originalScale, originalScale);
  }, 200);
}

// Update loop for any animations
app.on('update', (dt) => {
  // Rotate the cube slowly
  cube.rotation.y += dt * 0.5;
  
  // Make spawned objects bob up and down
  app.state.spawned.forEach((obj, index) => {
    if (obj && obj.position) {
      const time = Date.now() * 0.001;
      const offset = index * 0.5;
      obj.position.y = 0.5 + Math.sin(time + offset) * 0.1;
    }
  });
});

// Clean up spawned objects on app destruction
app.on('destroy', () => {
  app.state.spawned.forEach((obj) => {
    if (obj && obj.destroy) {
      obj.destroy();
    }
  });
  app.state.spawned = [];
});

console.log('[InteractableCube] App initialized with max spawns:', props.maxSpawns);