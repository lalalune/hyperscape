# Quick Start Guide

[← Back to Index](../README.md)

---

## Create Your First Hyperscape World

This guide will walk you through creating a simple multiplayer 3D world with Hyperscape Shared in under 10 minutes.

---

## Prerequisites

- Node.js 18+ or Bun installed
- Basic TypeScript knowledge
- Text editor or IDE

---

## Step 1: Project Setup

### Create Project Directory

```bash
mkdir my-hyperscape-game
cd my-hyperscape-game
npm init -y
```

### Install Dependencies

```bash
npm install @hyperscape/shared three
npm install -D typescript vite @types/three
```

### Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

### Configure Vite

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000
  },
  optimizeDeps: {
    exclude: ['@hyperscape/shared']
  }
});
```

---

## Step 2: Create HTML Page

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Hyperscape Game</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
      font-family: Arial, sans-serif;
    }
    #canvas {
      display: block;
      width: 100vw;
      height: 100vh;
    }
    #ui {
      position: absolute;
      top: 10px;
      left: 10px;
      color: white;
      background: rgba(0, 0, 0, 0.5);
      padding: 10px;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="ui">
    <div id="fps">FPS: --</div>
    <div id="position">Position: --, --, --</div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

---

## Step 3: Create Client World

Create `src/main.ts`:

```typescript
import { createClientWorld } from '@hyperscape/shared';

// Get canvas element
const canvas = document.querySelector('#canvas') as HTMLCanvasElement;

// Create client world
const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas
});

// Initialize world
await world.init();

console.log('World initialized!');
console.log('Systems:', world.systems.length);

// Game loop
let lastTime = 0;
function gameLoop(time: number) {
  // Update world
  world.tick(time);

  // Update UI
  updateUI();

  // Continue loop
  requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);

// Update UI elements
function updateUI() {
  const fps = Math.round(1000 / (world.time * 1000 - lastTime * 1000));
  lastTime = world.time;

  document.getElementById('fps')!.textContent = `FPS: ${fps}`;

  // Update position if player exists
  const player = world.entities?.getLocalPlayer();
  if (player) {
    const pos = player.position;
    document.getElementById('position')!.textContent =
      `Position: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
  }
}

console.log('Game started!');
```

---

## Step 4: Run the Game

```bash
# Start dev server
npm run dev

# Open browser to http://localhost:3000
```

You should see a blank 3D scene with FPS counter!

---

## Step 5: Add a Ground Plane

Update `src/main.ts`:

```typescript
import { createClientWorld } from '@hyperscape/shared';
import * as THREE from 'three';

const canvas = document.querySelector('#canvas') as HTMLCanvasElement;

const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas
});

await world.init();

// Create ground plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x228B22, // Forest green
  roughness: 0.8
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
ground.receiveShadow = true;
world.stage.scene.add(ground);

// Add lighting
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(50, 50, 50);
sun.castShadow = true;
world.stage.scene.add(sun);

const ambient = new THREE.AmbientLight(0xffffff, 0.5);
world.stage.scene.add(ambient);

// Position camera
world.camera.position.set(0, 10, 20);
world.camera.lookAt(0, 0, 0);

// Game loop (same as before)
function gameLoop(time: number) {
  world.tick(time);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

console.log('Ground added!');
```

Now you should see a green ground plane!

---

## Step 6: Spawn a Player

Add player spawning:

```typescript
import { createClientWorld, PlayerLocal } from '@hyperscape/shared';
import * as THREE from 'three';

const canvas = document.querySelector('#canvas') as HTMLCanvasElement;

const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas
});

await world.init();

// ... (ground and lighting code from previous step) ...

// Spawn local player
const player = new PlayerLocal(world, {
  id: 'player1',
  name: 'Hero',
  position: { x: 0, y: 1, z: 0 },
  type: 'player'
}, true); // true = local player

await player.init();

console.log('Player spawned!', player.position);

// Camera follows player
function updateCamera() {
  // Position camera behind and above player
  const offset = new THREE.Vector3(0, 5, 10);
  const targetPos = player.position.clone().add(offset);
  world.camera.position.lerp(targetPos, 0.1);
  world.camera.lookAt(player.position);
}

// Game loop with camera update
function gameLoop(time: number) {
  world.tick(time);
  updateCamera();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

You should now see a capsule representing the player!

---

## Step 7: Add Player Movement

Add keyboard controls:

```typescript
// ... (previous code) ...

// Player movement state
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

// Keyboard input
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w': keys.forward = true; break;
    case 's': keys.backward = true; break;
    case 'a': keys.left = true; break;
    case 'd': keys.right = true; break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w': keys.forward = false; break;
    case 's': keys.backward = false; break;
    case 'a': keys.left = false; break;
    case 'd': keys.right = false; break;
  }
});

// Update player position based on input
function updatePlayer(delta: number) {
  const speed = 5 * delta; // 5 units per second
  const direction = new THREE.Vector3(0, 0, 0);

  if (keys.forward) direction.z -= 1;
  if (keys.backward) direction.z += 1;
  if (keys.left) direction.x -= 1;
  if (keys.right) direction.x += 1;

  if (direction.length() > 0) {
    direction.normalize();
    direction.multiplyScalar(speed);

    // Apply rotation from camera
    const rotation = new THREE.Euler(0, world.camera.rotation.y, 0);
    direction.applyEuler(rotation);

    // Move player
    player.position.add(direction);
  }
}

// Game loop with movement
let lastTime = performance.now();
function gameLoop(time: number) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;

  updatePlayer(delta);
  world.tick(time);
  updateCamera();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

console.log('Controls: WASD to move');
```

You can now move the player with WASD keys!

---

## Step 8: Add More Entities

Spawn some simple cubes:

```typescript
// ... (previous code) ...

// Spawn some cubes as obstacles
for (let i = 0; i < 5; i++) {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0xff6347 })
  );

  // Random position
  cube.position.set(
    Math.random() * 20 - 10,
    1,
    Math.random() * 20 - 10
  );

  cube.castShadow = true;
  cube.receiveShadow = true;

  world.stage.scene.add(cube);
}

console.log('Obstacles added!');
```

---

## Complete Example

Here's the complete `src/main.ts`:

```typescript
import { createClientWorld, PlayerLocal } from '@hyperscape/shared';
import * as THREE from 'three';

// Initialize
const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas
});
await world.init();

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.stage.scene.add(ground);

// Lighting
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(50, 50, 50);
sun.castShadow = true;
world.stage.scene.add(sun);

const ambient = new THREE.AmbientLight(0xffffff, 0.5);
world.stage.scene.add(ambient);

// Player
const player = new PlayerLocal(world, {
  id: 'player1',
  name: 'Hero',
  position: { x: 0, y: 1, z: 0 },
  type: 'player'
}, true);
await player.init();

// Obstacles
for (let i = 0; i < 5; i++) {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0xff6347 })
  );
  cube.position.set(Math.random() * 20 - 10, 1, Math.random() * 20 - 10);
  cube.castShadow = true;
  cube.receiveShadow = true;
  world.stage.scene.add(cube);
}

// Input
const keys = { forward: false, backward: false, left: false, right: false };

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w') keys.forward = true;
  if (key === 's') keys.backward = true;
  if (key === 'a') keys.left = true;
  if (key === 'd') keys.right = true;
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w') keys.forward = false;
  if (key === 's') keys.backward = false;
  if (key === 'a') keys.left = false;
  if (key === 'd') keys.right = false;
});

// Update functions
function updatePlayer(delta: number) {
  const speed = 5 * delta;
  const direction = new THREE.Vector3(0, 0, 0);

  if (keys.forward) direction.z -= 1;
  if (keys.backward) direction.z += 1;
  if (keys.left) direction.x -= 1;
  if (keys.right) direction.x += 1;

  if (direction.length() > 0) {
    direction.normalize().multiplyScalar(speed);
    const rotation = new THREE.Euler(0, world.camera.rotation.y, 0);
    direction.applyEuler(rotation);
    player.position.add(direction);
  }
}

function updateCamera() {
  const offset = new THREE.Vector3(0, 5, 10);
  const targetPos = player.position.clone().add(offset);
  world.camera.position.lerp(targetPos, 0.1);
  world.camera.lookAt(player.position);
}

// Game loop
let lastTime = performance.now();
function gameLoop(time: number) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;

  updatePlayer(delta);
  world.tick(time);
  updateCamera();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

console.log('Game running! Use WASD to move.');
```

---

## What You've Built

Congratulations! You've created:

- ✅ 3D world with Hyperscape
- ✅ Ground plane and lighting
- ✅ Player character
- ✅ WASD movement
- ✅ Third-person camera
- ✅ Static obstacles

---

## Next Steps

Now that you have a basic world, explore:

### Add Physics

```typescript
// Enable physics on player
player.addComponent('rigidbody', {
  mass: 1.0,
  type: 'dynamic'
});

player.addComponent('collider', {
  shape: 'capsule',
  radius: 0.5,
  height: 1.8
});
```

### Add Multiplayer

```typescript
// Connect to server
const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas,
  serverUrl: 'ws://localhost:3000' // Connect to server
});

// Players automatically sync across clients!
```

### Add Combat

```typescript
// Add combat component
player.addComponent('combat', {
  damage: 10,
  range: 5,
  attackCooldown: 1.0
});

// Start combat with mob
world.startCombat(player.id, mob.id);
```

### Load 3D Models

```typescript
// Load GLTF model
const gltf = await world.loader.loadGLTF('asset://model.glb');
world.stage.scene.add(gltf.scene);

// Load VRM avatar
const avatar = new Avatar({
  url: 'asset://character.vrm'
});
await avatar.load();
```

---

## Troubleshooting

### Black Screen

**Problem:** Nothing renders

**Solution:**
- Check browser console for errors
- Verify WebGL is supported: Visit https://get.webgl.org/
- Check canvas element exists in HTML

### No Player Visible

**Problem:** Player doesn't appear

**Solution:**
- Check camera position: `world.camera.position.set(0, 10, 20)`
- Verify player spawned: `console.log(player.position)`
- Check player is in front of camera

### Movement Not Working

**Problem:** WASD doesn't move player

**Solution:**
- Check keyboard event listeners are attached
- Verify `keys` object is updating
- Check `updatePlayer()` is being called in game loop

---

## Resources

- [Installation Guide](installation.md) - Detailed setup
- [User Guides](../03-user-guides/creating-worlds.md) - Deep dives
- [API Reference](../12-api-reference/world-api.md) - Complete API docs
- [Examples](https://github.com/hyperscape/examples) - More examples

---

[← Back to Index](../README.md) | [← Previous: Configuration](configuration.md) | [Next: User Guides →](../03-user-guides/creating-worlds.md)
