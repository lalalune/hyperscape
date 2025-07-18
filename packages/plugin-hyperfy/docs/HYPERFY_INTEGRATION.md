# Hyperfy Plugin Integration Guide

## Overview

The ElizaOS Hyperfy plugin provides seamless integration with the [Hyperfy framework](https://github.com/lalalune/hyperfy), enabling AI agents to exist and interact within 3D virtual worlds. This guide explains how the plugin leverages Hyperfy's core features.

## Hyperfy Framework Features

Based on the [Hyperfy repository](https://github.com/lalalune/hyperfy), the framework provides:

### 🧬 Core Features

- **Standalone persistent worlds** - Self-hosted on custom domains
- **Realtime content creation** - Build directly in-world
- **Interactive app system** - JavaScript-based dynamic applications
- **Portable avatars** - Consistent identity across worlds
- **Physics-based interactions** - PhysX engine integration
- **WebXR support** - VR/AR experiences

## Plugin Architecture Mapping

### 1. World Connection

The plugin connects to Hyperfy worlds through WebSocket:

```typescript
// HyperfyService handles world connections
service.connectToWorld(worldUrl)
  → Hyperfy WebSocket Server
  → World Instance
```

### 2. Physics Integration

Leverages Hyperfy's PhysX implementation:

```typescript
// Movement actions use physics
GOTO_ENTITY → PhysX pathfinding
WALK_RANDOMLY → PhysX collision detection
USE_ITEM → PhysX object manipulation
```

### 3. Real-time Building

Integrates with Hyperfy's content creation:

```typescript
// BuildManager interfaces with world editor
EDIT_ENTITY → Hyperfy entity system
  - Duplicate objects
  - Transform positions
  - Import new assets
```

### 4. Avatar System

Uses Hyperfy's VRM avatar support:

```typescript
// AgentLoader manages avatars
Avatar URL → Hyperfy VRM loader
  → Physics body creation
  → Animation system
```

### 5. Interactive Apps

Supports Hyperfy's JavaScript app system:

```typescript
// Entities can have app components
entity.app → JavaScript execution
  → Dynamic behaviors
  → Agent interactions
```

## Asset Management

The plugin supports Hyperfy's asset pipeline:

### Asset URL Resolution

```typescript
// utils.ts handles multiple asset sources
"asset://" → World-hosted assets (Hyperfy CDN)
"http(s)://" → External assets
"file://" → Local development assets
"data:" → Embedded base64 assets
```

### Supported Asset Types

- `.vrm` - Avatar models
- `.glb/.gltf` - 3D models
- `.hdr` - Environment maps
- `.jpg/.png` - Textures
- `.json` - Configuration
- `.hyp` - Hyperfy-specific formats

## Building from Source

The plugin includes scripts to build Hyperfy locally:

```bash
# Build from GitHub repository
npm run build:hyperfy

# Use local Hyperfy build
npm run build:hyperfy:local
```

This clones the [Hyperfy repository](https://github.com/lalalune/hyperfy), builds it, and integrates the output.

## Environment Configuration

### Hyperfy World Server

```env
# Connect to Hyperfy world
HYPERFY_WORLD_URL=wss://world.hyperfy.xyz/ws
HYPERFY_ASSETS_URL=https://assets.hyperfy.xyz
```

### Custom Domains

```env
# Self-hosted world
HYPERFY_WORLD_URL=wss://my-world.com/ws
HYPERFY_ASSETS_URL=https://my-world.com/assets
```

## Key Integration Points

### 1. World Events

The plugin listens to Hyperfy world events:

- Entity spawned/destroyed
- Player joined/left
- World state changes
- Physics updates

### 2. Networking

Uses Hyperfy's real-time synchronization:

- Position updates
- Action broadcasts
- Chat messages
- Voice data

### 3. Persistence

Integrates with Hyperfy's world persistence:

- Entity positions saved
- Build changes persisted
- Avatar customizations stored

### 4. WebXR Compatibility

Agents work alongside VR users:

- Spatial audio positioning
- Hand gesture recognition
- VR controller interactions

## Advanced Features

### Physics Utilities

```typescript
// Calculate 3D distances
calculateDistance3D(pos1, pos2);

// Check interaction range
isWithinRange(pos1, pos2, range);

// Generate random positions
randomPositionInRadius(center, radius);
```

### Entity Helpers

```typescript
// Check interactability
isInteractableEntity(entity)
  → Checks for: app, grabbable, clickable, trigger, seat, portal

// Format entity info
formatEntity(entity)
  → Returns formatted string with position, type, distance
```

### World Parsing

```typescript
// Extract world ID from URL
parseHyperfyWorldUrl("https://hyperfy.io/my-world")
  → Returns: "my-world"
```

## Future Enhancements

Based on Hyperfy's roadmap:

1. **Enhanced App System**

   - Direct JavaScript app creation by agents
   - Complex event-driven behaviors

2. **Advanced Physics**

   - Fluid dynamics
   - Soft body physics
   - Complex constraints

3. **Procedural Generation**

   - AI-driven world building
   - Dynamic content creation

4. **Multi-Agent Coordination**
   - Synchronized performances
   - Collaborative building
   - Shared objectives

## Resources

- [Hyperfy GitHub Repository](https://github.com/lalalune/hyperfy)
- [Hyperfy Documentation](https://docs.hyperfy.xyz)
- [Hyperfy Website](https://hyperfy.xyz)
- [Hyperfy Sandbox](https://sandbox.hyperfy.xyz)

## Contributing

When contributing to the Hyperfy plugin:

1. Follow Hyperfy's component architecture
2. Use PhysX for physics calculations
3. Support both WebSocket and HTTP protocols
4. Ensure VR/WebXR compatibility
5. Test with both hosted and self-hosted worlds

## License

The Hyperfy framework is licensed under GPL-3.0. Ensure compliance when building derivative works.
