# World System

[← Back to Index](../README.md)

---

## Overview

The `World` class is the central container for all game systems, entities, and state. It manages the game loop, system lifecycle, and provides a unified API for game features.

**File:** `packages/shared/src/World.ts`

---

## Architecture

```typescript
class World extends EventEmitter {
  // Time management
  time: number;
  frame: number;
  fixedDeltaTime: number = 1 / 30;

  // Core properties
  id: string;
  systems: System[];
  systemsByName: Map<string, System>;

  // Three.js scene
  rig: Object3D;
  camera: PerspectiveCamera;

  // Core systems
  settings: Settings;
  anchors: Anchors;
  events: Events;
  chat: Chat;
  entities: Entities;
  physics: Physics;
  stage: Stage;
  network: NetworkSystem;

  // Client-only systems
  ui?: ClientInterface;
  loader?: ClientLoader;
  graphics?: ClientGraphics;
  controls?: ClientInput;
  audio?: ClientAudio;

  // Server-only systems
  db?: ServerDB;
  server?: ServerRuntime;

  // Event bus
  $eventBus: EventBus;
}
```

---

## Lifecycle

### 1. Constructor

Creates a new World instance and registers core systems.

```typescript
const world = new World();
```

**What happens:**
- Generates unique world ID
- Creates Three.js rig and camera
- Registers core systems (settings, anchors, events, chat, entities, physics, stage)
- Initializes EventBus

**Note:** Network system is registered separately by `createClientWorld()` or `createServerWorld()`

---

### 2. init(options)

Initializes all systems in dependency order.

```typescript
await world.init({
  assetsUrl: '/assets/',
  assetsDir: './assets',
  storage: storageInstance
});
```

**Parameters:**
- `assetsUrl` - CDN URL for loading assets (client)
- `assetsDir` - Local directory for assets (server)
- `storage` - Storage abstraction instance

**What happens:**
1. Sets up storage and asset paths
2. Topologically sorts systems based on dependencies
3. Initializes each system in order
4. Emits progress events for loading screens
5. Starts all systems

**Example with loading screen:**

```typescript
world.on('assetsLoadingProgress', (data) => {
  console.log(`Loading: ${data.stage} (${data.progress}%)`);
  updateLoadingBar(data.progress);
});

await world.init(options);
```

---

### 3. start()

Starts all systems after initialization.

```typescript
world.start();
```

**What happens:**
- Transitions systems from 'initialized' to 'started' state
- Systems can begin active operations (network connections, timers, etc.)

---

### 4. tick(time)

Main game loop - called every frame.

```typescript
function gameLoop(time) {
  world.tick(time);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

**Parameters:**
- `time` - Current time in milliseconds (from requestAnimationFrame)

**Game Loop Phases:**

```typescript
tick(time) {
  // 1. Performance monitoring start
  preTick();

  // 2. Fixed timestep physics loop
  accumulator += delta;
  while (accumulator >= fixedDeltaTime) {
    fixedUpdate(fixedDeltaTime);  // 30 FPS
    accumulator -= fixedDeltaTime;
  }

  // 3. Frame-rate dependent updates
  const alpha = accumulator / fixedDeltaTime;
  update(delta, alpha);  // Variable FPS

  // 4. Late updates (camera, UI)
  lateUpdate(delta, alpha);

  // 5. Render / network send
  commit();

  // 6. Performance monitoring end
  postTick();
}
```

---

### 5. destroy()

Cleanup when world is destroyed.

```typescript
world.destroy();
```

**What happens:**
- Destroys all systems
- Clears event listeners
- Removes scene objects
- Resets state

---

## Fixed Timestep Game Loop

Hyperscape uses a **fixed timestep** for physics simulation to ensure deterministic, stable results.

### How It Works

```typescript
// Physics always runs at exactly 30 FPS
fixedDeltaTime = 1 / 30;  // 33.33ms

accumulator = 0;

tick(time) {
  delta = time - lastTime;
  accumulator += delta;

  // Run physics multiple times if needed
  while (accumulator >= fixedDeltaTime) {
    fixedUpdate(fixedDeltaTime);  // Physics step
    accumulator -= fixedDeltaTime;
  }

  // Interpolate visuals between physics steps
  alpha = accumulator / fixedDeltaTime;
  update(delta, alpha);  // Visual update with interpolation
}
```

### Benefits

1. **Deterministic:** Same inputs always produce same results
2. **Stable:** Physics doesn't explode on slow frames
3. **Smooth:** Interpolation provides smooth rendering at any FPS
4. **Network-Friendly:** Easy to synchronize across clients

### Example: Interpolation

```typescript
// In entity's update() method
update(delta, alpha) {
  // Interpolate position between physics steps
  this.visualPosition.lerpVectors(
    this.previousPosition,
    this.currentPosition,
    alpha
  );

  // Use visualPosition for rendering
  this.mesh.position.copy(this.visualPosition);
}
```

---

## System Registration

### register(key, SystemClass)

Register a system by creating an instance.

```typescript
world.register('mySystem', MyCustomSystem);
```

**Parameters:**
- `key` - System name (string)
- `SystemClass` - System constructor

**Returns:** System instance

**Example:**

```typescript
class MySystem extends System {
  init() {
    console.log('System initialized!');
  }

  update(delta: number) {
    // Run every frame
  }
}

const mySystem = world.register('mySystem', MySystem);
```

---

### addSystem(key, system)

Add an already-instantiated system.

```typescript
const system = new MySystem(world);
world.addSystem('mySystem', system);
```

**Use case:** When you need to pass custom parameters to system constructor

---

### getSystem<T>(systemKey)

Get a system by its registered name with type safety.

```typescript
const physics = world.getSystem<Physics>('physics');
physics.raycast(origin, direction);
```

---

### findSystem<T>(nameOrConstructor)

Find a system by name or constructor name.

```typescript
const physics = world.findSystem<Physics>('Physics');
```

**Note:** `getSystem()` is faster - use it when you know the exact key

---

## System Dependencies

Systems can declare dependencies that determine initialization order.

```typescript
class MySystem extends System {
  getDependencies() {
    return {
      required: ['physics', 'entities'],
      optional: ['audio']
    };
  }
}
```

**World automatically:**
1. Topologically sorts systems
2. Initializes dependencies first
3. Detects circular dependencies
4. Throws error if required dependency missing

---

## World Properties

### Time Management

```typescript
world.time           // Current game time (seconds)
world.frame          // Current frame number
world.fixedDeltaTime // Physics timestep (1/30)
world.maxDeltaTime   // Max delta to prevent spiral of death
world.accumulator    // Accumulated time for physics
```

---

### Scene Graph

```typescript
world.rig    // Root object3D (parent of camera)
world.camera // Perspective camera
```

**Example:**

```typescript
// Position camera
world.camera.position.set(0, 10, 20);
world.camera.lookAt(0, 0, 0);

// Add object to rig (follows camera)
const ui = new THREE.Mesh(geometry, material);
world.rig.add(ui);
```

---

### Core Systems

```typescript
world.settings  // Game configuration
world.anchors   // Spatial anchors (XR)
world.events    // Legacy event system
world.chat      // Chat messages
world.entities  // Entity management (ECS)
world.physics   // PhysX physics
world.stage     // Three.js rendering
world.network   // Client or server network
```

---

### Client-Only Systems

```typescript
world.ui        // UI system
world.loader    // Asset loader (GLTF, VRM, textures)
world.graphics  // WebGL/WebGPU renderer
world.controls  // Input handling (keyboard, mouse, gamepad)
world.audio     // Spatial audio
world.music     // Background music
world.livekit   // Voice chat (WebRTC)
world.monitor   // Performance monitoring
world.stats     // FPS/memory stats display
world.builder   // World editor tools
world.actions   // Player actions
world.xr        // VR/AR support
world.terrain   // Terrain system
```

---

### Server-Only Systems

```typescript
world.db      // Database (SQLite/PostgreSQL)
world.server  // Server runtime
world.storage // File storage abstraction
world.pgPool  // PostgreSQL connection pool
```

---

### RPG Game API

When RPG systems are loaded, additional methods are available:

```typescript
// Player management
world.getRPGPlayer(playerId)
world.savePlayer(playerId, data)
world.healPlayer(playerId, amount)
world.damagePlayer(playerId, amount)
world.teleportPlayer(playerId, position)

// Combat
world.startCombat(attackerId, targetId)
world.stopCombat(attackerId)
world.canAttack(attackerId, targetId)
world.isInCombat(entityId)

// Skills
world.getSkills(playerId)
world.getSkillLevel(playerId, skill)
world.getCombatLevel(playerId)

// Inventory
world.getInventory(playerId)
world.getEquipment(playerId)
world.hasItem(playerId, itemId, quantity)

// Equipment
world.equipItem(playerId, itemId, slot)
world.unequipItem(playerId, slot)
world.getEquipmentStats(playerId)

// Banking
world.depositItem(playerId, bankId, itemId, quantity)
world.withdrawItem(playerId, bankId, itemId, quantity)
world.getBankData(playerId, bankId)

// Mobs
world.spawnMob(type, position)
world.getMob(mobId)
world.getAllMobs()

// Resources
world.spawnResource(type, position)
world.getResource(resourceId)

// Items
world.dropItem(item, position)
world.getItemsInRange(position, range)
```

---

## World Methods

### getPlayer(playerId?)

Get a player entity by ID.

```typescript
const player = world.getPlayer('player1');
console.log(player.position);

// Get local player (client-only)
const localPlayer = world.getPlayer();
```

---

### getPlayers()

Get all player entities.

```typescript
const players = world.getPlayers();
console.log(`${players.length} players online`);

players.forEach(player => {
  console.log(player.name, player.position);
});
```

---

### raycast(origin, direction, maxDistance?, layerMask?)

Perform physics raycast.

```typescript
const hit = world.raycast(
  playerPosition,
  lookDirection,
  100,  // max distance
  world.createLayerMask('environment', 'mob')
);

if (hit) {
  console.log('Hit entity:', hit.entityId);
  console.log('Hit position:', hit.point);
  console.log('Hit distance:', hit.distance);
}
```

**Returns:** `RaycastHit | null`

```typescript
interface RaycastHit {
  entityId: string;
  point: Vector3;
  normal: Vector3;
  distance: number;
}
```

---

### createLayerMask(...layers)

Create bitmask for physics queries.

```typescript
// Include multiple layers
const mask = world.createLayerMask('player', 'mob', 'environment');

// Use in raycast
const hit = world.raycast(origin, direction, 100, mask);
```

---

### resolveURL(url, allowLocal?)

Resolve asset:// URLs to actual URLs.

```typescript
// Client: Uses assetsUrl
const url = world.resolveURL('asset://models/sword.glb');
// → 'https://cdn.example.com/assets/models/sword.glb'

// Server: Uses assetsDir
const path = world.resolveURL('asset://models/sword.glb', true);
// → '/path/to/assets/models/sword.glb'
```

---

### setupMaterial(material)

Setup material for cascaded shadow maps.

```typescript
const material = new THREE.MeshStandardMaterial();
world.setupMaterial(material);  // Configures CSM
```

---

### setHot(item, hot)

Register object for update() calls.

```typescript
// Register for updates
world.setHot(entity, true);

// Unregister
world.setHot(entity, false);
```

**Use case:** Entities that need continuous updates

---

### getTime()

Get current game time in seconds.

```typescript
const time = world.getTime();
console.log('Game time:', time);
```

---

### disconnect()

Disconnect network connection gracefully.

```typescript
await world.disconnect();
```

---

## Event System

World inherits from EventEmitter and provides type-safe events via EventBus.

### on(event, callback)

Subscribe to an event.

```typescript
world.on('playerSpawned', (data) => {
  console.log('Player spawned:', data.playerId);
});

world.on('entityDamaged', (data) => {
  console.log(`${data.entityId} took ${data.damage} damage`);
});
```

---

### off(event, callback?)

Unsubscribe from an event.

```typescript
// Remove specific handler
world.off('playerSpawned', handler);

// Remove all handlers for event
world.off('playerSpawned');
```

---

### emit(event, data)

Emit an event.

```typescript
world.emit('playerSpawned', {
  playerId: 'player1',
  position: { x: 0, y: 1, z: 0 }
});
```

---

### getEventBus()

Get the EventBus for advanced event handling.

```typescript
const eventBus = world.getEventBus();

// Subscribe with EventBus
eventBus.subscribe(EventType.COMBAT_DAMAGE, (event) => {
  console.log('Damage:', event.data.damage);
});

// Request/response pattern
const response = await eventBus.request(
  EventType.GET_PLAYER_DATA,
  { playerId: 'player1' }
);
```

---

## Environment Detection

```typescript
// Check if running on server
if (world.isServer) {
  // Server-only code
  world.db.savePlayer(playerId, data);
}

// Check if running on client
if (world.isClient) {
  // Client-only code
  world.graphics.renderer.render(scene, camera);
}
```

---

## Example: Complete World Setup

```typescript
import { createClientWorld } from '@hyperscape/shared';

// Create world
const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas,
  serverUrl: 'ws://localhost:3000'
});

// Listen for events
world.on('playerSpawned', (data) => {
  console.log('Player joined:', data.playerId);
});

world.on('entityDamaged', (data) => {
  // Show damage numbers
  showDamageNumber(data.entityId, data.damage);
});

// Initialize world
await world.init();

// Configure graphics
world.graphics!.shadows = 'high';
world.graphics!.postprocessing = true;

// Configure audio
world.audio!.setMasterVolume(0.8);

// Game loop
function gameLoop(time: number) {
  world.tick(time);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  world.destroy();
});
```

---

## Performance Considerations

### Hot Objects

Objects in `world.hot` get `update()` called every frame. Only add objects that need continuous updates.

```typescript
// Good: Only update moving entities
if (entity.isMoving) {
  world.setHot(entity, true);
} else {
  world.setHot(entity, false);
}

// Bad: All entities always hot
world.setHot(entity, true);  // Even if static
```

---

### System Count

Keep system count reasonable (< 50). Too many systems slow down initialization and updates.

---

### Memory Management

```typescript
// Cleanup when done
world.destroy();

// This prevents memory leaks by:
// - Destroying all systems
// - Removing event listeners
// - Clearing scene objects
// - Releasing GPU resources
```

---

## Summary

The World class:

- **Central Container:** Holds all systems, entities, and state
- **Game Loop:** Fixed timestep physics with interpolation
- **System Management:** Automatic dependency resolution
- **Event System:** Type-safe inter-system communication
- **Cross-Platform:** Same code on client and server
- **Extensible:** Add custom systems and entities
- **Type-Safe:** Full TypeScript support

The World is the foundation of every Hyperscape game and provides a clean, unified API for game development.

---

[← Back to Index](../README.md) | [← Previous: Core Systems Overview](../05-core-systems/README.md) | [Next: Nodes →](nodes.md)
