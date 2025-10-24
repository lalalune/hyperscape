# Technology Stack

[← Back to Index](../README.md)

---

## Overview

Hyperscape Shared leverages modern web technologies to deliver a high-performance 3D multiplayer game engine that runs in browsers and Node.js environments.

---

## Core Technologies

### TypeScript 5.3+

**Purpose:** Primary development language

**Why TypeScript:**
- Type safety prevents runtime errors
- IDE autocomplete and intellisense
- Better refactoring support
- Easier team collaboration
- Compile-time error detection

**Usage:**
```typescript
// Strong typing throughout
interface EntityConfig {
  id: string;
  name: string;
  position: Position3D;
  type: EntityType;
}

// Type-safe API
const entity = new Entity(world, config);
entity.addComponent<CombatComponent>('combat', {
  damage: 10,
  range: 5
});
```

---

### Three.js 0.178

**Purpose:** 3D rendering and scene management

**Why Three.js:**
- Most mature WebGL library
- Extensive ecosystem and community
- WebGPU support (future-proof)
- Great performance
- Rich feature set

**Features Used:**
- Scene graph management
- WebGL/WebGPU rendering
- GLTF/VRM model loading
- Skeletal animations
- Shadow mapping
- Post-processing

**Usage:**
```typescript
// Hyperscape wraps Three.js
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
world.stage.scene.add(mesh);
```

---

### PhysX 5.x

**Purpose:** Physics simulation

**Why PhysX:**
- Industry-standard (used in AAA games)
- Accurate and stable
- Great performance
- WASM support for browsers
- Native Node.js bindings

**Platforms:**
- **Browser:** PhysX WASM (compiled from C++)
- **Node.js:** Native PhysX bindings

**Features Used:**
- Rigid body dynamics
- Collision detection
- Character controllers
- Raycasting and sweeps
- Triggers and sensors
- Collision layers

**Usage:**
```typescript
// Physics-enabled entity
const box = new Entity(world, config);
box.addComponent('rigidbody', {
  mass: 1.0,
  type: 'dynamic'
});
box.addComponent('collider', {
  shape: 'box',
  size: { x: 1, y: 1, z: 1 }
});
```

---

## Networking

### Socket.io

**Purpose:** Real-time client-server communication

**Why Socket.io:**
- WebSocket with fallbacks
- Room-based communication
- Automatic reconnection
- Binary data support
- Reliable delivery

**Usage:**
```typescript
// Server
world.network.on('playerMove', (data) => {
  // Handle movement
});

// Client
world.network.send('playerMove', {
  position: { x, y, z }
});
```

---

### LiveKit (WebRTC)

**Purpose:** Voice chat and screen sharing

**Why LiveKit:**
- Low-latency voice
- Spatial audio support
- Screen sharing
- Easy to integrate
- Scalable infrastructure

**Usage:**
```typescript
// Join voice channel
await world.livekit.connect({
  room: 'game-room',
  token: authToken
});
```

---

## Build Tools

### Vite 6.0

**Purpose:** Development server and build tool

**Why Vite:**
- Extremely fast HMR (Hot Module Replacement)
- Native ESM support
- Optimized production builds
- Great TypeScript support
- Plugin ecosystem

**Configuration:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'esnext',
    lib: {
      entry: './src/index.ts',
      formats: ['es', 'cjs']
    }
  }
});
```

---

### ESBuild

**Purpose:** Fast TypeScript compilation

**Why ESBuild:**
- 10-100x faster than tsc
- Used internally by Vite
- Bundle optimization
- Tree shaking

---

## Runtime Environments

### Browser (Client)

**Requirements:**
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)
- WebGL 2.0 support
- WebAssembly support
- 4GB+ RAM recommended

**APIs Used:**
- WebGL/WebGPU
- WebSocket
- WebRTC
- Web Workers
- IndexedDB (caching)

---

### Node.js (Server)

**Requirements:**
- Node.js 18.0+ or Bun runtime
- 4GB+ RAM recommended
- SQLite or PostgreSQL

**Features:**
- Native PhysX bindings
- File system access
- Database connectivity
- Native modules

---

## Data Storage

### SQLite

**Purpose:** Server-side database

**Why SQLite:**
- Serverless (no setup)
- Fast for read-heavy workloads
- Perfect for game state
- ACID compliant
- Single file database

**Usage:**
```typescript
// Server initializes database
const world = await createServerWorld({
  dbPath: './world.db'
});

// Save player data
await world.db.savePlayer(playerId, playerData);
```

---

### PostgreSQL (Optional)

**Purpose:** Production database (optional)

**Why PostgreSQL:**
- Better for write-heavy workloads
- Advanced querying
- Replication support
- Industry standard

---

## Graphics Stack

### WebGL 2.0

**Purpose:** Primary rendering backend

**Features:**
- Hardware acceleration
- Shader support
- Universal browser support
- Mature and stable

---

### WebGPU (Future)

**Purpose:** Next-gen rendering backend

**Features:**
- Better performance
- Compute shaders
- Modern API design
- Chrome/Edge support (experimental)

**Status:** Experimental support in Three.js

---

## Asset Formats

### GLTF/GLB

**Purpose:** 3D model format

**Why GLTF:**
- Industry standard
- Compact binary format (GLB)
- Animation support
- PBR materials
- Three.js native support

```typescript
const gltf = await world.loader.loadGLTF('asset://model.glb');
world.stage.scene.add(gltf.scene);
```

---

### VRM

**Purpose:** Avatar format

**Why VRM:**
- Standardized avatar format
- Humanoid rig
- Expression support
- Spring bones (hair, clothes)
- Cross-platform

```typescript
const avatar = new Avatar({
  url: 'asset://character.vrm'
});
await avatar.load();
```

---

## Development Tools

### Playwright

**Purpose:** End-to-end testing

**Why Playwright:**
- Visual testing
- WebGL support
- Multi-browser
- Headless mode
- Screenshot comparison

**Usage:**
```typescript
test('player spawns correctly', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForSelector('.player-model');
  await expect(page).toHaveScreenshot();
});
```

---

### ESLint

**Purpose:** Code quality

**Configuration:**
```javascript
// eslint.config.js
export default [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn'
    }
  }
];
```

---

## Version Compatibility

### Browser Support

| Browser | Minimum Version | Recommended |
|---------|----------------|-------------|
| Chrome | 90+ | Latest |
| Firefox | 88+ | Latest |
| Safari | 14+ | 15+ |
| Edge | 90+ | Latest |

### Node.js Support

| Runtime | Minimum Version | Recommended |
|---------|----------------|-------------|
| Node.js | 18.0 | 20+ LTS |
| Bun | 1.0 | Latest |

---

## Technology Choices Rationale

### Why Three.js over Babylon.js?

- Larger community
- More lightweight
- Better VRM support
- Proven in production

### Why PhysX over Cannon.js?

- Industry standard
- Better performance
- More features
- Native Node.js support

### Why Socket.io over raw WebSocket?

- Automatic reconnection
- Room support
- Fallback transports
- Easier to use

### Why TypeScript over JavaScript?

- Type safety
- Better IDE support
- Easier refactoring
- Team collaboration

---

## Performance Considerations

### Target Performance

- **Client FPS:** 60 FPS (16.67ms per frame)
- **Server TPS:** 30 TPS (33.33ms per tick)
- **Network Latency:** <100ms optimal
- **Physics Steps:** 30 FPS fixed timestep

### Optimization Techniques

1. **LOD System:** Reduce polygon count for distant objects
2. **Object Pooling:** Reuse objects to reduce GC
3. **Frustum Culling:** Only render visible objects
4. **Instanced Rendering:** Batch similar objects
5. **Web Workers:** Offload heavy computation
6. **Delta Compression:** Reduce network bandwidth

---

## Future Technologies

### Planned Additions

- **WebGPU:** Better graphics performance
- **WebTransport:** Lower latency networking
- **WASM Threads:** Multi-threaded physics
- **WebXR:** VR/AR support improvements

---

## Dependencies

### Production Dependencies

```json
{
  "three": "^0.178.0",
  "eventemitter3": "^5.0.0",
  "socket.io": "^4.6.0",
  "socket.io-client": "^4.6.0"
}
```

### Development Dependencies

```json
{
  "typescript": "^5.3.0",
  "vite": "^6.0.0",
  "@playwright/test": "^1.40.0",
  "eslint": "^8.56.0"
}
```

---

## Summary

Hyperscape Shared leverages:

1. **Modern Web Stack**: TypeScript, Vite, ESM
2. **Proven 3D Engine**: Three.js for rendering
3. **Industry-Standard Physics**: PhysX for simulation
4. **Real-time Networking**: Socket.io + WebRTC
5. **Cross-Platform**: Browser and Node.js support
6. **Developer-Friendly**: Great tooling and DX

The technology choices prioritize:
- **Performance**: Fast and responsive gameplay
- **Reliability**: Battle-tested libraries
- **Maintainability**: Type safety and clean architecture
- **Scalability**: Handle 50-100 concurrent players
- **Future-Proof**: Modern APIs with upgrade paths

---

[← Back to Index](../README.md) | [← Previous: Introduction](introduction.md) | [Next: Features →](features.md)
