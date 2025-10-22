# Introduction to Hyperscape Shared

[← Back to Index](../README.md)

---

## What is Hyperscape Shared?

Hyperscape Shared is the **core 3D multiplayer game engine** that powers the Hyperscape RPG project. It provides a complete, production-ready framework for building multiplayer 3D games with advanced physics, networking, and rendering capabilities.

### Purpose

Hyperscape Shared solves the challenge of building multiplayer 3D games by providing:

- **Complete ECS Architecture**: Entity Component System for scalable game objects
- **Authoritative Server**: Server-side physics and game logic with client prediction
- **Unified Codebase**: Same code runs on client, server, and headless environments
- **Production-Ready**: Battle-tested systems for combat, inventory, skills, and more
- **Framework Flexibility**: Build any type of 3D multiplayer game
- **Type Safety**: Full TypeScript support with comprehensive type definitions

### Built for Multiplayer RPGs

Hyperscape Shared was specifically created for the [Hyperscape RPG project](../../../README.md), a multiplayer 3D game. It provides:

- **Players**: Avatar loading (VRM), character controllers, animations
- **Combat**: Melee and ranged combat with stats and equipment
- **Mobs**: AI-driven enemies with pathfinding and aggro systems
- **NPCs**: Dialogue, shops, and quests
- **Items**: Loot, inventory, equipment, and ground items
- **Resources**: Mining, woodcutting, fishing with skill progression
- **Banking**: Multi-bank system with storage management
- **Skills**: Leveling system with XP and unlocks

---

## Core Capabilities

### 1. Entity Component System (ECS)

Modular architecture for game objects:

```typescript
// Create an entity
const entity = new Entity(world, {
  id: 'tree1',
  type: 'resource',
  name: 'Oak Tree',
  position: { x: 10, y: 0, z: 5 }
});

// Add components
entity.addComponent('health', {
  current: 100,
  max: 100
});

entity.addComponent('interaction', {
  type: 'woodcutting',
  requiredLevel: 1,
  xpReward: 25
});

// Systems process entities with components
world.systems.forEach(system => {
  system.update(deltaTime);
});
```

**Key Benefits:**
- Modular: Mix and match components for different entity types
- Performant: Systems process entities in batches
- Maintainable: Changes to one component don't affect others
- Extensible: Add new components and systems without modifying core

### 2. PhysX Physics Integration

Industry-standard physics simulation:

```typescript
// Add physics to an entity
const player = new PlayerEntity(world, config);

// Physics automatically syncs with Three.js
player.position.set(0, 10, 0);  // Three.js position
// PhysX rigid body automatically updated

// Raycasting for line-of-sight
const hit = world.physics.raycast(
  origin,
  direction,
  maxDistance,
  layerMask
);

if (hit) {
  console.log('Hit entity:', hit.entityId);
}
```

**Powered by:** PhysX 5.x (WASM for browser, native for Node.js)

### 3. Client-Server Networking

Authoritative server with client prediction:

```typescript
// Server: Authoritative game state
if (world.isServer) {
  // Server validates all actions
  world.on('playerAttack', (data) => {
    if (canAttack(data.attackerId, data.targetId)) {
      applyDamage(data.targetId, damage);
      // Broadcast to all clients
      world.network.broadcast('entityDamaged', {
        entityId: data.targetId,
        damage,
        attackerId: data.attackerId
      });
    }
  });
}

// Client: Optimistic updates
if (world.isClient) {
  // Client predicts movement
  player.move(direction);
  // Server corrects if needed
}
```

**Features:**
- Authoritative server prevents cheating
- Client prediction for responsive gameplay
- Interpolation for smooth movement
- Bandwidth optimization with delta compression

### 4. Three.js Rendering

Advanced 3D graphics with WebGL/WebGPU:

```typescript
// Node-based scene graph
const avatarNode = new Avatar({
  url: 'asset://avatars/hero.vrm',
  position: [0, 0, 0]
});
world.stage.scene.add(avatarNode);

// Dynamic lighting
world.environment.csm.update();  // Cascaded shadow maps

// Post-processing
world.graphics.postprocessing = true;
world.graphics.bloom = true;
```

**Features:**
- VRM character loading with animations
- Cascaded shadow maps for realistic shadows
- LOD system for distant objects
- Particle effects system
- Post-processing (bloom, SSAO, etc.)

### 5. World Management

Multiple world types for different use cases:

```typescript
// Client world (browser)
const clientWorld = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas,
  serverUrl: 'ws://localhost:3000'
});

// Server world (Node.js)
const serverWorld = await createServerWorld({
  assetsDir: './assets',
  port: 3000,
  dbPath: './world.db'
});

// Viewer world (headless, testing)
const viewerWorld = await createViewerWorld({
  assetsDir: './assets'
});
```

### 6. RPG Systems

Complete RPG game systems:

```typescript
// Combat system
world.startCombat(playerId, mobId);

// Inventory system
world.addItem(playerId, itemId, quantity);
world.equipItem(playerId, itemId, slot);

// Skills system
world.addXP(playerId, 'attack', 100);
const level = world.getSkillLevel(playerId, 'attack');

// Banking system
world.depositItem(playerId, bankId, itemId, quantity);
```

---

## Key Benefits

### For Game Developers

- **Rapid Development**: Complete game systems out of the box
- **Type Safety**: Full TypeScript support with IDE autocomplete
- **Proven Architecture**: Battle-tested in production
- **Flexible Framework**: Build any type of 3D multiplayer game

### For System Developers

- **Clean Architecture**: ECS pattern with clear separation of concerns
- **Extensibility**: Add new systems without modifying core
- **Performance**: Optimized for 50-100 concurrent players
- **Testing**: Playwright integration for visual testing

### For Multiplayer Games

- **Authoritative Server**: Server-side validation prevents cheating
- **Client Prediction**: Responsive gameplay despite network latency
- **State Synchronization**: Automatic entity sync across clients
- **Scalable**: Handles hundreds of entities efficiently

---

## World Types

Hyperscape Shared supports three world types:

### Client World
**Environment:** Browser (WebGL/WebGPU)
**Purpose:** Player-facing game client
**Features:**
- Full 3D rendering
- Player input handling
- Audio and music
- UI and HUD
- Network client

**Use Case:** Main game client that players interact with

### Server World
**Environment:** Node.js
**Purpose:** Authoritative game server
**Features:**
- Physics simulation
- Game logic and AI
- Database persistence
- Network server
- No rendering (headless)

**Use Case:** Multiplayer game server

### Viewer World
**Environment:** Node.js (headless)
**Purpose:** Testing and automation
**Features:**
- Physics simulation
- Entity management
- No networking
- No rendering
- Playwright integration

**Use Case:** Automated testing with visual verification

---

## Architecture Philosophy

Hyperscape Shared follows key design principles:

### 1. Entity Component System (ECS)

**Entities:** Game objects (players, mobs, items)
**Components:** Modular data containers (health, combat, stats)
**Systems:** Logic processors that operate on entities with specific components

**Benefits:**
- Composition over inheritance
- Data-oriented design
- Cache-friendly iteration
- Easy to extend

### 2. Separation of Concerns

**World:** Container and lifecycle management
**Systems:** Game logic and behavior
**Entities:** Game objects and state
**Components:** Pure data
**Nodes:** Scene graph and transforms

### 3. Client-Server Architecture

**Server:**
- Authoritative game state
- Physics simulation
- AI and pathfinding
- Validation and anti-cheat

**Client:**
- Rendering and audio
- Player input
- UI and HUD
- Optimistic prediction

### 4. Event-Driven Communication

**EventBus:** Type-safe event system
**Benefits:**
- Decoupled systems
- Type-safe events
- Request/response pattern
- Easy debugging

---

## Target Audience

### Primary Users

1. **Game Developers**: Building multiplayer 3D games
2. **System Developers**: Creating game systems and features
3. **Technical Artists**: Integrating assets and effects
4. **QA Engineers**: Testing and automation

### Technical Requirements

- **Programming**: TypeScript/JavaScript experience
- **3D Graphics**: Basic Three.js knowledge helpful
- **Multiplayer**: Understanding of client-server architecture
- **Physics**: Basic physics concepts helpful

---

## Integration with Hyperscape Ecosystem

Hyperscape Shared is the foundation of the Hyperscape ecosystem:

### Asset Forge
**Purpose:** AI-powered 3D asset generation
**Integration:** Generates models that Hyperscape loads

```typescript
// Load Asset Forge generated model
const asset = await world.loader.loadModel('asset://steel-sword.glb');
world.spawnItem(asset, position);
```

### Plugin Hyperscape
**Purpose:** ElizaOS AI agent integration
**Integration:** AI agents control NPCs and interact with world

```typescript
// AI agent spawns as NPC
const npc = world.spawnNPC({
  name: 'AI Shopkeeper',
  position: { x: 10, y: 0, z: 5 },
  dialogue: aiAgent.getDialogue()
});
```

### File Structure

```
packages/
├── shared/               # This package (core engine)
│   ├── src/
│   │   ├── World.ts     # Central world container
│   │   ├── nodes/       # Scene graph system
│   │   ├── components/  # ECS components
│   │   ├── entities/    # Entity types
│   │   ├── systems/     # Game systems
│   │   └── ...
│   └── dev-book/        # This documentation
├── asset-forge/         # 3D asset generation
└── plugin-hyperscape/   # AI agent integration
```

---

## Next Steps

Now that you understand what Hyperscape Shared is, explore:

- [Features Overview](features.md) - Detailed feature list
- [Architecture](architecture.md) - System design
- [Tech Stack](tech-stack.md) - Technologies used
- [Installation Guide](../02-getting-started/installation.md) - Get started

---

[← Back to Index](../README.md) | [Next: Features →](features.md)
