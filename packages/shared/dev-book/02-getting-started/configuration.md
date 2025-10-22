# Configuration

[← Back to Index](../README.md)

---

## World Configuration

### Client World Options

```typescript
interface ClientWorldOptions {
  assetsUrl?: string;        // CDN URL for assets
  renderer?: HTMLCanvasElement; // Canvas element
  serverUrl?: string;        // WebSocket server URL
  storage?: Storage;         // Storage instance
}
```

**Example:**

```typescript
const world = await createClientWorld({
  assetsUrl: 'https://cdn.example.com/assets/',
  renderer: canvas,
  serverUrl: 'wss://game.example.com'
});
```

---

### Server World Options

```typescript
interface ServerWorldOptions {
  assetsDir?: string;        // Local assets directory
  port?: number;             // Server port
  dbPath?: string;           // Database path
  storage?: Storage;         // Storage instance
}
```

**Example:**

```typescript
const world = await createServerWorld({
  assetsDir: './assets',
  port: 3000,
  dbPath: './game.db'
});
```

---

### Viewer World Options

```typescript
interface ViewerWorldOptions {
  assetsDir?: string;        // Local assets directory
  storage?: Storage;         // Storage instance
}
```

---

## Graphics Configuration

```typescript
// Client-only
world.graphics!.shadows = 'high';        // 'none' | 'low' | 'high'
world.graphics!.postprocessing = true;
world.graphics!.bloom = true;
world.graphics!.dpr = window.devicePixelRatio;
```

---

## Physics Configuration

```typescript
world.physics.gravity = -9.81;  // Gravity force
world.physics.stepSize = 1/30;  // Physics timestep
```

---

[← Back to Index](../README.md) | [← Previous: Installation](installation.md) | [Next: Quick Start →](quick-start.md)
