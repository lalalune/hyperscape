# Creating Worlds

[← Back to Index](../README.md)

---

## World Types

Hyperscape supports three world types for different use cases.

---

## Client World

Browser-based player client with full rendering and input.

```typescript
import { createClientWorld } from '@hyperscape/shared';

const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: canvas,
  serverUrl: 'ws://localhost:3000'
});

await world.init();

// Game loop
function gameLoop(time: number) {
  world.tick(time);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

**Features:**
- Three.js rendering
- Player input
- Audio and music
- UI system
- Network client

---

## Server World

Node.js authoritative game server.

```typescript
import { createServerWorld } from '@hyperscape/shared';

const world = await createServerWorld({
  assetsDir: './assets',
  port: 3000,
  dbPath: './world.db'
});

await world.init();

// Server game loop
setInterval(() => {
  world.tick(performance.now());
}, 1000 / 30); // 30 TPS
```

**Features:**
- Physics simulation
- Game logic
- Database persistence
- Network server
- No rendering (headless)

---

## Viewer World

Headless world for testing.

```typescript
import { createViewerWorld } from '@hyperscape/shared';

const world = await createViewerWorld({
  assetsDir: './assets'
});

await world.init();

// Manual ticks for testing
world.tick(0);
world.tick(33.33);
```

**Features:**
- Physics simulation
- Entity management
- No networking
- No rendering
- Playwright integration

---

[← Back to Index](../README.md) | [Next: Spawning Entities →](spawning-entities.md)
