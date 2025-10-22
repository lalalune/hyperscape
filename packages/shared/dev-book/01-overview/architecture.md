# Architecture Overview

[← Back to Index](../README.md)

---

## System Architecture

Hyperscape Shared follows a layered architecture with clear separation of concerns. This document provides a high-level overview of the system design.

---

## Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           WORLD CONTAINER                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Event Bus (Type-Safe Inter-System Communication)              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌────────────┬────────────┬─────────────┬────────────┬──────────┐  │
│  │  Entities  │  Systems   │   Physics   │   Stage    │ Network  │  │
│  │   (ECS)    │  (Logic)   │   (PhysX)   │ (Three.js) │(Socket.io)│ │
│  └────────────┴────────────┴─────────────┴────────────┴──────────┘  │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Scene Graph (Nodes)                                           │ │
│  │  • Transform hierarchy                                         │ │
│  │  • Dirty tracking                                              │ │
│  │  • Lifecycle management                                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Core Layers

### 1. World Layer

**Responsibility:** Central container and coordinator

**Key Classes:**
- `World` - Main world container
- `EventBus` - Type-safe event system

**Features:**
- System registration and lifecycle
- Game loop orchestration
- Event routing
- Asset URL resolution

**Lifecycle:**
```typescript
// 1. Constructor: Create world, register systems
const world = new World();

// 2. init(): Initialize systems in dependency order
await world.init(options);

// 3. start(): Start all systems
world.start();

// 4. tick(): Game loop (called every frame)
requestAnimationFrame((time) => world.tick(time));

// 5. destroy(): Cleanup
world.destroy();
```

---

### 2. Entity Component System (ECS)

**Responsibility:** Game object architecture

**Components:**
```
Entities (Objects)
    ↓
Components (Data)
    ↓
Systems (Logic)
```

**Entities:**
- `Entity` - Base class
- `PlayerEntity` - Player characters
- `MobEntity` - Enemies
- `NPCEntity` - Non-player characters
- `ItemEntity` - Items
- `ResourceEntity` - Harvestable resources

**Components:**
- `TransformComponent` - Position, rotation, scale
- `HealthComponent` - Health and regeneration
- `CombatComponent` - Combat stats and state
- `StatsComponent` - Skills and levels
- `InteractionComponent` - Player interactions
- `VisualComponent` - 3D mesh and sprites

**Systems:**
- `CombatSystem` - Combat logic
- `MovementSystem` - Character movement
- `InventorySystem` - Item management
- `SkillsSystem` - XP and leveling
- `PathfindingSystem` - AI navigation
- `AggroSystem` - Mob aggression

---

### 3. Node System

**Responsibility:** Scene graph and transforms

**Node Hierarchy:**
```
World.rig (root)
├── Avatar (VRM character)
│   ├── Mesh (head)
│   ├── SkinnedMesh (body)
│   └── Collider (physics shape)
├── Group (container)
│   └── Mesh (prop)
└── RigidBody (physics object)
```

**Features:**
- Transform hierarchy propagation
- Dirty tracking for optimization
- Lifecycle hooks (mount/unmount)
- Position/rotation/scale with proxies

**Node Types:**
- `Node` - Base transform node
- `Group` - Container node
- `Mesh` - 3D mesh
- `SkinnedMesh` - Animated mesh
- `Avatar` - VRM character
- `Collider` - Physics shape
- `RigidBody` - Physics body

---

### 4. Physics Layer

**Responsibility:** PhysX physics simulation

**Architecture:**
```
World.physics
├── PhysX WASM/Native
├── Scene
├── Rigid Bodies
├── Colliders
├── Character Controllers
└── Collision Layers
```

**Features:**
- Fixed timestep simulation (30 FPS)
- Collision detection and response
- Raycasting and sweeps
- Character controllers
- Triggers and sensors

**Integration:**
```typescript
// Entity automatically syncs with physics
entity.position.set(10, 0, 0);
// → Physics body updated automatically

// Physics updates entity position
world.physics.step(deltaTime);
// → Entity position updated from physics
```

---

### 5. Rendering Layer

**Responsibility:** Three.js 3D rendering

**Architecture:**
```
World.stage
├── Scene (Three.js)
├── Camera (PerspectiveCamera)
├── Lights (Directional, Point, Spot)
├── CSM (Cascaded Shadow Maps)
└── Renderer (WebGL/WebGPU)
```

**Features:**
- WebGL 2.0 / WebGPU rendering
- Shadow mapping with CSM
- Post-processing effects
- LOD system
- Frustum culling

**Rendering Pipeline:**
```
1. Update transforms → updateTransform()
2. Update physics → physics.step()
3. Update systems → system.update()
4. Render scene → renderer.render(scene, camera)
```

---

### 6. Network Layer

**Responsibility:** Client-server communication

**Architecture:**
```
┌─────────────────────┐         ┌─────────────────────┐
│  Client (Browser)   │         │  Server (Node.js)   │
│  ┌───────────────┐ │         │  ┌───────────────┐  │
│  │ ClientNetwork │ │ ←─────→ │  │ ServerNetwork │  │
│  └───────────────┘ │         │  └───────────────┘  │
│  Socket.io Client   │         │  Socket.io Server   │
└─────────────────────┘         └─────────────────────┘
```

**Features:**
- WebSocket communication
- Binary packet format
- Delta compression
- Priority-based updates
- Interpolation

**Packet Flow:**
```
Server:
1. Entity changes → markNetworkDirty()
2. Collect dirty entities → getDirtyEntities()
3. Serialize → entity.serialize()
4. Send → broadcast('entityModified', data)

Client:
1. Receive packet
2. Find entity → entities.get(id)
3. Apply changes → entity.applyNetworkData(data)
4. Interpolate → lerp(old, new, alpha)
```

---

## Data Flow

### Game Loop (Fixed Timestep)

```
┌──────────────────────────────────────────────┐
│  requestAnimationFrame(time)                  │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│  world.tick(time)                             │
├───────────────────────────────────────────────│
│  1. preTick()         - Performance start     │
│  2. preFixedUpdate()  - Prepare physics       │
│  3. fixedUpdate()     - Physics (30 FPS)      │
│  4. postFixedUpdate() - Finalize physics      │
│  5. preUpdate()       - Prepare render        │
│  6. update()          - Visual updates        │
│  7. postUpdate()      - Transform cleanup     │
│  8. lateUpdate()      - Camera, UI            │
│  9. postLateUpdate()  - Final cleanup         │
│ 10. commit()          - Render/network        │
│ 11. postTick()        - Performance end       │
└──────────────────────────────────────────────┘
```

### Fixed Timestep Details

```typescript
// Accumulator pattern for consistent physics
accumulator += delta;

while (accumulator >= fixedDeltaTime) {
  // Run physics at exactly 30 FPS
  fixedUpdate(fixedDeltaTime);
  accumulator -= fixedDeltaTime;
}

// Interpolate visuals between physics steps
const alpha = accumulator / fixedDeltaTime;
update(delta, alpha);
```

**Benefits:**
- Deterministic physics (same results every time)
- Stable simulation (no frame rate dependency)
- Smooth rendering (interpolation)

---

## System Dependencies

### Dependency Graph

```
Settings (no deps)
    ↓
Anchors → Events → Chat
    ↓        ↓
Stage → Physics
    ↓        ↓
Entities ← Systems
    ↓        ↓
Network → RPG Systems
```

### Initialization Order

Systems are initialized in topological order based on dependencies:

```typescript
// Example: Physics depends on Stage
class PhysicsSystem extends System {
  getDependencies() {
    return {
      required: ['stage']
    };
  }
}

// World automatically sorts systems
// Initialization order: Settings → Stage → Physics → Entities → ...
```

---

## Client-Server Architecture

### Server (Authoritative)

**Runs:**
- Game logic
- Physics simulation
- AI and pathfinding
- Validation
- Database persistence

**Does NOT Run:**
- Rendering
- Audio
- Input handling
- UI

**Code:**
```typescript
if (world.isServer) {
  // Server validates player actions
  world.on('playerAttack', (data) => {
    if (canAttack(data.attackerId, data.targetId)) {
      const damage = calculateDamage(attacker, target);
      target.damage(damage);
      // Broadcast to clients
      world.network.broadcast('entityDamaged', {
        entityId: data.targetId,
        damage,
        attackerId: data.attackerId
      });
    }
  });
}
```

---

### Client (Presentation)

**Runs:**
- Rendering
- Audio
- Input handling
- UI
- Prediction

**Does NOT Run:**
- Authoritative logic
- Database access
- AI (except local player)

**Code:**
```typescript
if (world.isClient) {
  // Client predicts movement
  player.move(direction);  // Instant visual

  // Send to server for validation
  world.network.send('playerMove', {
    playerId: player.id,
    position: player.position
  });

  // Server may correct position
  world.on('entityMoved', (data) => {
    if (data.entityId === player.id) {
      // Lerp to corrected position
      player.position.lerp(data.position, 0.5);
    }
  });
}
```

---

## Event System

### EventBus Architecture

```typescript
// Type-safe events
enum EventType {
  PLAYER_SPAWNED = 'player:spawned',
  ENTITY_DAMAGED = 'entity:damaged',
  COMBAT_STARTED = 'combat:started'
}

// Subscribe
world.on(EventType.ENTITY_DAMAGED, (data) => {
  console.log('Entity damaged:', data.entityId, data.damage);
});

// Emit
world.emit(EventType.ENTITY_DAMAGED, {
  entityId: 'mob1',
  damage: 10,
  sourceId: 'player1'
});
```

**Benefits:**
- Type safety
- Decoupled systems
- Request/response pattern
- Easy debugging

---

## Memory Management

### Object Pooling

```typescript
// Pool for frequently created/destroyed objects
class ProjectilePool {
  pool: Projectile[] = [];

  acquire(): Projectile {
    return this.pool.pop() || new Projectile();
  }

  release(projectile: Projectile): void {
    projectile.reset();
    this.pool.push(projectile);
  }
}
```

### Garbage Collection

**Strategies:**
- Object pooling for short-lived objects
- Weak references for caches
- Manual cleanup in destroy()
- Avoid creating objects in hot paths

---

## Performance Optimization

### LOD System

```typescript
// Automatic level-of-detail switching
const lod = new LOD();
lod.addLevel(highPolyMesh, 0);    // 0-20m
lod.addLevel(mediumPolyMesh, 20); // 20-50m
lod.addLevel(lowPolyMesh, 50);    // 50m+

// Automatically switches based on camera distance
```

### Frustum Culling

```typescript
// Only render visible objects
object.frustumCulled = true;

// Camera automatically culls objects outside view
```

### Dirty Tracking

```typescript
// Only update changed nodes
node.setTransformed();  // Marks node and children dirty

// Later, only dirty nodes update
if (node.isDirty) {
  node.updateTransform();
}
```

---

## Scalability

### Target Performance

- **Client FPS:** 60 FPS (16.67ms/frame)
- **Server TPS:** 30 TPS (33.33ms/tick)
- **Players:** 50-100 concurrent
- **Entities:** 1000+ total

### Optimization Techniques

1. **Spatial Partitioning:** Octree for fast queries
2. **Entity Culling:** Only update nearby entities
3. **Network Prioritization:** Send important updates first
4. **Delta Compression:** Only send changed data
5. **Fixed Timestep:** Stable, predictable physics

---

## Security Model

### Server Authority

**Server validates:**
- All player actions
- Movement bounds
- Combat damage
- Item transactions
- Skill progression

**Client cannot:**
- Modify server state directly
- Cheat movement or combat
- Duplicate items
- Skip requirements

### Input Validation

```typescript
// Server validates all inputs
function handlePlayerMove(data: MovePacket): void {
  // Validate player exists
  const player = world.getPlayer(data.playerId);
  if (!player) return;

  // Validate position is reasonable
  const distance = player.position.distanceTo(data.position);
  if (distance > MAX_MOVE_DISTANCE) {
    // Reject and resync
    world.network.send(data.playerId, 'resyncPosition', {
      position: player.position
    });
    return;
  }

  // Validate collision
  if (world.physics.overlaps(data.position, player.collider)) {
    // Invalid position
    return;
  }

  // Accept move
  player.setPosition(data.position);
}
```

---

## Extension Points

### Custom Systems

```typescript
class MyCustomSystem extends System {
  getDependencies() {
    return { required: ['entities'] };
  }

  init() {
    // Initialize system
  }

  update(delta: number) {
    // Run every frame
  }

  fixedUpdate(delta: number) {
    // Run at 30 FPS
  }
}

// Register system
world.register('mySystem', MyCustomSystem);
```

### Custom Entities

```typescript
class MyEntity extends Entity {
  async createMesh() {
    // Custom 3D model
  }

  async onInteract(data: InteractionData) {
    // Custom interaction
  }

  update(delta: number) {
    // Custom update logic
  }
}

// Create entity
const entity = new MyEntity(world, config);
await entity.init();
```

### Custom Components

```typescript
class MyComponent extends Component {
  data = {
    customValue: 0
  };

  update(delta: number) {
    // Component logic
  }
}

// Register component
registerComponent('myComponent', MyComponent);

// Use component
entity.addComponent('myComponent', { customValue: 42 });
```

---

## Summary

Hyperscape Shared architecture:

- **Layered Design:** Clear separation of concerns
- **ECS Pattern:** Scalable game object architecture
- **Fixed Timestep:** Deterministic physics
- **Client-Server:** Authoritative server model
- **Event-Driven:** Decoupled system communication
- **Type-Safe:** Full TypeScript support
- **Extensible:** Custom systems, entities, components
- **Optimized:** LOD, culling, pooling, dirty tracking

The architecture is designed for:
- **Performance:** Handle 50-100 concurrent players
- **Maintainability:** Clear structure, easy to extend
- **Reliability:** Battle-tested in production
- **Security:** Server-side validation

---

[← Back to Index](../README.md) | [← Previous: Features](features.md) | [Next: Getting Started →](../02-getting-started/installation.md)
