# Features Overview

[← Back to Index](../README.md)

---

## Complete Feature List

Hyperscape Shared provides a comprehensive set of features for building multiplayer 3D games. This document catalogs all major features with brief descriptions and usage examples.

---

## Core Engine Features

### Entity Component System (ECS)

**Description:** Modular architecture for game objects

**Key Components:**
- **Entities:** Game objects (players, mobs, NPCs, items)
- **Components:** Modular data (health, combat, stats, interaction)
- **Systems:** Logic processors (combat system, movement system)

**Usage:**
```typescript
// Create entity with components
const player = new PlayerEntity(world, {
  id: 'player1',
  name: 'Hero',
  position: { x: 0, y: 1, z: 0 }
});

// Add components
player.addComponent('health', { current: 100, max: 100 });
player.addComponent('combat', { damage: 10, range: 5 });

// Systems process entities
combatSystem.update(deltaTime);  // Processes all combat components
```

---

### World Management

**Description:** Client, server, and viewer world types

**World Types:**
- **Client World:** Browser-based player client
- **Server World:** Authoritative game server
- **Viewer World:** Headless testing environment

**Usage:**
```typescript
// Create client world
const clientWorld = await createClientWorld({
  assetsUrl: '/assets/',
  serverUrl: 'ws://localhost:3000'
});

// Create server world
const serverWorld = await createServerWorld({
  assetsDir: './assets',
  port: 3000,
  dbPath: './world.db'
});

// Create viewer world (testing)
const viewerWorld = await createViewerWorld({
  assetsDir: './assets'
});
```

---

### Node System

**Description:** Hierarchical scene graph with transform management

**Node Types:**
- **Node:** Base transform node
- **Group:** Container node
- **Mesh:** 3D mesh node
- **SkinnedMesh:** Animated mesh node
- **Avatar:** VRM character node
- **Collider:** Physics collision shape
- **RigidBody:** Physics dynamic object

**Usage:**
```typescript
// Create node hierarchy
const parent = new Group({ position: [0, 0, 0] });
const child = new Mesh({
  geometry: boxGeometry,
  material: standardMaterial,
  position: [1, 0, 0]
});
parent.add(child);

// Transforms propagate through hierarchy
parent.position.set(10, 0, 0);
// child world position is now (11, 0, 0)
```

---

## Physics Features

### PhysX Integration

**Description:** Industry-standard physics simulation

**Supported:**
- Rigid body dynamics
- Collision detection
- Character controllers
- Raycasting and sweeps
- Triggers and sensors
- Collision filtering

**Usage:**
```typescript
// Create physics-enabled entity
const box = new Entity(world, config);
box.addComponent('rigidbody', {
  mass: 1.0,
  type: 'dynamic',
  friction: 0.5,
  restitution: 0.3
});

// Raycast for line-of-sight
const hit = world.physics.raycast(
  origin,
  direction,
  maxDistance,
  world.createLayerMask('player', 'mob')
);
```

---

### Collision Shapes

**Supported Shapes:**
- Box
- Sphere
- Capsule
- Cylinder
- Convex mesh
- Triangle mesh (static only)

**Usage:**
```typescript
// Box collider
entity.addComponent('collider', {
  shape: 'box',
  size: { x: 1, y: 2, z: 1 }
});

// Capsule collider (ideal for characters)
entity.addComponent('collider', {
  shape: 'capsule',
  radius: 0.5,
  height: 1.8
});
```

---

### Character Controllers

**Description:** Player movement with collision response

**Features:**
- Walk/run on slopes
- Step climbing
- Push objects
- Gravity and jumping

**Usage:**
```typescript
// Create character controller
const controller = world.physics.createCharacterController({
  radius: 0.5,
  height: 1.8,
  slopeLimit: 45,
  stepOffset: 0.5
});

// Move character
controller.move(velocity, deltaTime);
```

---

## Networking Features

### Client-Server Architecture

**Description:** Authoritative server with client prediction

**Server Authority:**
- Game state validation
- Physics simulation
- AI and pathfinding
- Anti-cheat

**Client Features:**
- Optimistic prediction
- Interpolation
- Lag compensation
- Bandwidth optimization

**Usage:**
```typescript
// Server validates actions
if (world.isServer) {
  world.on('playerMove', (data) => {
    if (isValidMove(data)) {
      player.setPosition(data.position);
      world.network.broadcast('entityMoved', {
        entityId: data.playerId,
        position: data.position
      });
    }
  });
}

// Client predicts movement
if (world.isClient) {
  player.move(direction);  // Instant visual feedback
  world.network.send('playerMove', {
    playerId: player.id,
    position: player.position
  });
}
```

---

### State Synchronization

**Description:** Automatic entity sync across clients

**Features:**
- Delta compression
- Priority-based updates
- Interpolation
- Conflict resolution

**Usage:**
```typescript
// Server marks entity dirty
entity.markNetworkDirty();

// Automatically synced to clients
// Client receives entityModified packet
world.on('entityModified', (data) => {
  const entity = world.entities.get(data.id);
  entity.applyNetworkData(data);
});
```

---

## Rendering Features

### Three.js Integration

**Description:** Advanced 3D rendering

**Features:**
- WebGL 2.0 / WebGPU
- PBR materials
- Shadow mapping
- LOD system
- Post-processing

**Usage:**
```typescript
// Add 3D model to scene
const gltf = await world.loader.loadGLTF('asset://model.glb');
world.stage.scene.add(gltf.scene);

// Configure rendering
world.graphics.shadows = 'high';
world.graphics.postprocessing = true;
world.graphics.bloom = true;
```

---

### VRM Avatar Support

**Description:** Load and animate VRM characters

**Features:**
- Humanoid rig
- Facial expressions
- Spring bones (hair, clothes)
- Blendshapes

**Usage:**
```typescript
const avatar = new Avatar({
  url: 'asset://character.vrm',
  position: [0, 0, 0]
});
await avatar.load();

// Play animation
avatar.playAnimation('walking');
```

---

### Lighting and Shadows

**Description:** Cascaded shadow maps for realistic shadows

**Features:**
- Directional light with CSM
- Point lights
- Spot lights
- Dynamic shadows

**Usage:**
```typescript
// Configure CSM
world.environment.csm = {
  cascades: 3,
  maxDistance: 100,
  shadowMapSize: 2048
};

// Update shadows each frame
world.environment.csm.update();
```

---

## RPG Systems

### Combat System

**Description:** Melee and ranged combat

**Features:**
- Auto-attack
- Combat stats (attack, defense, strength)
- Attack cooldowns
- Damage calculation
- Death handling

**Usage:**
```typescript
// Start combat
world.startCombat(attackerId, targetId);

// Check if can attack
if (world.canAttack(attackerId, targetId)) {
  const damage = calculateDamage(attacker, target);
  world.damagePlayer(targetId, damage);
}
```

---

### Inventory System

**Description:** Item storage and management

**Features:**
- 28-slot inventory
- Item stacking
- Equipment slots
- Ground items
- Item pickup

**Usage:**
```typescript
// Add item to inventory
world.addItem(playerId, itemId, quantity);

// Equip item
world.equipItem(playerId, itemId, 'weapon');

// Drop item
world.dropItem(playerId, itemId, quantity);
```

---

### Equipment System

**Description:** Equippable items and bonuses

**Features:**
- Equipment slots (weapon, armor, accessories)
- Stat bonuses
- Level requirements
- Visual representation

**Usage:**
```typescript
// Equip weapon
world.equipItem(playerId, swordId, 'weapon');

// Get equipment bonuses
const stats = world.getEquipmentStats(playerId);
console.log('Attack bonus:', stats.attack);
```

---

### Skills System

**Description:** Leveling and XP progression

**Features:**
- Multiple skills (combat, gathering, crafting)
- XP and level calculation
- Skill requirements
- Combat level calculation

**Usage:**
```typescript
// Add XP
world.addXP(playerId, 'attack', 100);

// Get skill level
const attackLevel = world.getSkillLevel(playerId, 'attack');

// Get combat level
const combatLevel = world.getCombatLevel(playerId);
```

---

### Banking System

**Description:** Item storage in banks

**Features:**
- Multiple banks
- Separate storage per bank
- Item deposit/withdraw
- Bank locations

**Usage:**
```typescript
// Deposit item
world.depositItem(playerId, bankId, itemId, quantity);

// Withdraw item
world.withdrawItem(playerId, bankId, itemId, quantity);

// Get bank data
const bank = world.getBankData(playerId, bankId);
```

---

### NPC System

**Description:** Non-player characters

**Features:**
- Dialogue system
- Shop interface
- Quest givers
- AI behavior

**Usage:**
```typescript
// Spawn NPC
const npc = world.spawnNPC({
  name: 'Shopkeeper',
  position: { x: 10, y: 0, z: 5 },
  dialogue: ['Welcome!', 'What can I get you?']
});

// Handle interaction
npc.onInteract = (data) => {
  world.openShop(data.playerId, npc.shopId);
};
```

---

### Mob System

**Description:** Enemy creatures

**Features:**
- AI behavior
- Aggro system
- Pathfinding
- Respawning
- Loot tables

**Usage:**
```typescript
// Spawn mob
const goblin = world.spawnMob({
  type: 'goblin',
  level: 5,
  position: { x: 20, y: 0, z: 10 }
});

// Mob automatically attacks nearby players
// Mob drops loot on death
```

---

### Resource System

**Description:** Harvestable resources

**Features:**
- Trees (woodcutting)
- Rocks (mining)
- Fish spots (fishing)
- Skill requirements
- Respawn timers

**Usage:**
```typescript
// Spawn resource
const tree = world.spawnResource({
  type: 'oak_tree',
  position: { x: 15, y: 0, z: 8 },
  requiredLevel: 1,
  xpReward: 25
});

// Player harvests resource
world.harvestResource(playerId, tree.id);
```

---

## Interaction Features

### Interaction System

**Description:** Player-entity interaction

**Features:**
- Range checking
- Interaction types (talk, attack, harvest, pickup)
- Context-sensitive actions
- Multi-target selection

**Usage:**
```typescript
// Define interaction
entity.config.interactable = true;
entity.config.interactionType = 'talk';
entity.config.interactionDistance = 5;

// Handle interaction
entity.onInteract = async (data) => {
  console.log(`Player ${data.playerId} interacted`);
};
```

---

### Action System

**Description:** Context-based player actions

**Features:**
- Available actions based on context
- Action execution
- Client UI integration
- Action validation

**Usage:**
```typescript
// Get available actions
const actions = world.actionRegistry.getAvailable({
  playerId: player.id,
  targetId: npc.id
});

// Execute action
await world.actionRegistry.execute('talk', context, params);
```

---

## Audio Features

### Spatial Audio

**Description:** 3D positional audio

**Features:**
- Positional sounds
- Audio falloff
- Audio filters
- Multiple listeners

**Usage:**
```typescript
// Play positional sound
world.audio.play('sword_hit', {
  position: hitPosition,
  volume: 0.8,
  maxDistance: 20
});
```

---

### Music System

**Description:** Background music playback

**Features:**
- Music tracks
- Volume control
- Fade in/out
- Looping

**Usage:**
```typescript
// Play music
world.music.play('battle_theme', {
  volume: 0.5,
  loop: true,
  fadeIn: 2000
});
```

---

## UI Features

### Client Interface

**Description:** DOM-based UI system

**Features:**
- HUD elements
- Chat interface
- Inventory UI
- Settings menu

**Usage:**
```typescript
// Add UI element
const healthBar = document.createElement('div');
healthBar.className = 'health-bar';
world.ui.appendChild(healthBar);
```

---

### Nametag System

**Description:** Entity name tags

**Features:**
- Canvas-based sprites
- Always face camera
- Distance scaling
- Health bars

**Usage:**
```typescript
// Automatically added to entities
entity.createNameTag();  // Created from entity.name
entity.createHealthBar();  // Shows current/max health
```

---

## Testing Features

### Playwright Integration

**Description:** Visual testing support

**Features:**
- Color detection
- Screenshot comparison
- Entity verification
- Performance testing

**Usage:**
```typescript
test('player spawns correctly', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Detect player color (red cube proxy)
  const hasPlayer = await page.evaluate(() => {
    return world.colorDetector.hasColor('red', {
      tolerance: 50
    });
  });

  expect(hasPlayer).toBe(true);
});
```

---

## Performance Features

### LOD System

**Description:** Level-of-detail optimization

**Features:**
- Distance-based LOD switching
- Automatic mesh simplification
- Configurable thresholds

**Usage:**
```typescript
const lod = new LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(mediumDetailMesh, 20);
lod.addLevel(lowDetailMesh, 50);
```

---

### Object Pooling

**Description:** Reuse objects to reduce GC

**Features:**
- Entity pooling
- Particle pooling
- Automatic cleanup

---

## Data Management

### Persistence System

**Description:** Save/load game state

**Features:**
- Player data persistence
- World state saves
- Auto-save
- Database integration

**Usage:**
```typescript
// Save player
await world.db.savePlayer(playerId, playerData);

// Load player
const data = await world.db.loadPlayer(playerId);
```

---

## Monitoring

### Performance Monitoring

**Description:** Track performance metrics

**Features:**
- FPS counter
- Memory usage
- Network stats
- Entity counts

**Usage:**
```typescript
const stats = await world.monitor.getStats();
console.log('FPS:', stats.fps);
console.log('Entities:', stats.entityCount);
```

---

## Summary

Hyperscape Shared provides:

- **Core Engine:** ECS, World, Nodes, Physics
- **Networking:** Client-Server, State Sync
- **Rendering:** Three.js, VRM, Lighting
- **RPG Systems:** Combat, Inventory, Skills, Banking
- **Interactions:** Action System, Context Menu
- **Audio:** Spatial Audio, Music
- **UI:** HUD, Chat, Menus
- **Testing:** Playwright Integration
- **Performance:** LOD, Pooling, Monitoring
- **Persistence:** Database, Save/Load

All systems are production-ready and battle-tested in multiplayer environments.

---

[← Back to Index](../README.md) | [← Previous: Tech Stack](tech-stack.md) | [Next: Architecture →](architecture.md)
