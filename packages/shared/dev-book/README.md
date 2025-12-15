# Hyperscape Shared Package Developer Guide

> **Complete documentation for the Hyperscape 3D multiplayer game engine**

Welcome to the comprehensive documentation for Hyperscape Shared! This guide covers everything from getting started to advanced development topics for the core 3D multiplayer game engine.

---

## 📖 Quick Navigation

### 🚀 Getting Started
Perfect for new developers:
- [Installation Guide](02-getting-started/installation.md) - Set up your development environment
- [Configuration](02-getting-started/configuration.md) - Configure worlds and systems
- [Quick Start](02-getting-started/quick-start.md) - Create your first world in minutes
- [Troubleshooting](02-getting-started/troubleshooting.md) - Common issues and solutions

### 👤 User Guides
Learn how to use each feature:
- [Creating Worlds](03-user-guides/creating-worlds.md) - Client, server, and viewer worlds
- [Spawning Entities](03-user-guides/spawning-entities.md) - Players, mobs, NPCs, items
- [Physics Integration](03-user-guides/physics-integration.md) - PhysX colliders and rigid bodies
- [Networking](03-user-guides/networking.md) - Client-server communication
- [Building Systems](03-user-guides/building-systems.md) - Create custom game systems
- [Components Guide](03-user-guides/components-guide.md) - Using the component system

### 🏗️ Architecture
Understand the system design:
- [System Overview](04-architecture/system-overview.md) - High-level architecture
- [ECS Architecture](04-architecture/ecs-architecture.md) - Entity Component System design
- [World System](04-architecture/world-system.md) - World lifecycle and management
- [Data Flow](04-architecture/data-flow.md) - State management patterns
- [Client-Server Model](04-architecture/client-server-model.md) - Network architecture

### ⚙️ Core Systems
Dive into the engine codebase:
- [World](05-core-systems/world.md) - Central world container
- [Nodes](05-core-systems/nodes.md) - Scene graph system
- [Components](05-core-systems/components.md) - Modular entity components
- [Entities](05-core-systems/entities.md) - Game objects
- [Systems](05-core-systems/systems.md) - Game logic processors
- [Stage](05-core-systems/stage.md) - Three.js rendering
- [Physics](05-core-systems/physics.md) - PhysX integration

### 🎮 Physics
PhysX physics engine integration:
- [Physics Overview](06-physics/overview.md) - PhysX architecture
- [Colliders](06-physics/colliders.md) - Collision shapes
- [Rigid Bodies](06-physics/rigid-bodies.md) - Dynamic objects
- [Character Controllers](06-physics/character-controllers.md) - Player movement
- [Raycasting](06-physics/raycasting.md) - Physics queries

### 🌐 Networking
Client-server networking:
- [Network Overview](07-networking/overview.md) - Network architecture
- [Packets](07-networking/packets.md) - Network protocol
- [Client Network](07-networking/client-network.md) - Client-side networking
- [Server Network](07-networking/server-network.md) - Server-side networking
- [State Synchronization](07-networking/state-sync.md) - Entity sync

### 🎯 Features Deep Dive
Advanced feature documentation:
- [Avatar System](08-features/avatar-system.md) - VRM character loading
- [Combat System](08-features/combat-system.md) - Combat mechanics
- [Inventory System](08-features/inventory-system.md) - Item management
- [Skills System](08-features/skills-system.md) - Leveling and XP
- [Banking System](08-features/banking-system.md) - Player banking
- [Interaction System](08-features/interaction-system.md) - Entity interactions
- [Movement System](08-features/movement-system.md) - Character movement

### 📘 Type System
TypeScript types and interfaces:
- [Types Overview](09-type-system/types-overview.md) - All type definitions
- [Entity Types](09-type-system/entity-types.md) - Entity data structures
- [Component Types](09-type-system/component-types.md) - Component interfaces
- [System Types](09-type-system/system-types.md) - System interfaces
- [Network Types](09-type-system/network-types.md) - Networking types

### ⚙️ Configuration
Settings and configuration:
- [Game Constants](10-configuration/game-constants.md) - Core game constants
- [Combat Constants](10-configuration/combat-constants.md) - Combat parameters
- [Banking Constants](10-configuration/banking-constants.md) - Banking configuration
- [Data Files](10-configuration/data-files.md) - World data structure

### 💻 Development
Build new features:
- [Setup Guide](11-development/setup-guide.md) - Dev environment
- [Code Standards](11-development/code-standards.md) - Coding conventions
- [Adding Systems](11-development/adding-systems.md) - Create new systems
- [Adding Entities](11-development/adding-entities.md) - Create new entity types
- [Debugging](11-development/debugging.md) - Debug techniques

### 📚 API Reference
Complete API documentation:
- [World API](12-api-reference/world-api.md) - World class methods
- [Node API](12-api-reference/node-api.md) - Node system methods
- [Component API](12-api-reference/component-api.md) - Component interfaces
- [Entity API](12-api-reference/entity-api.md) - Entity class methods
- [System API](12-api-reference/system-api.md) - System base class
- [Physics API](12-api-reference/physics-api.md) - Physics methods

### 🧪 Testing
Testing strategies:
- [Testing Strategy](13-testing/testing-strategy.md) - Approach
- [Unit Testing](13-testing/unit-testing.md) - Testing components
- [Integration Testing](13-testing/integration-testing.md) - Testing systems
- [Playwright Testing](13-testing/playwright-testing.md) - Visual testing

### 🚀 Deployment
Production deployment:
- [Build Process](14-deployment/build-process.md) - Production builds
- [Server Deployment](14-deployment/server-deployment.md) - Server setup
- [Client Deployment](14-deployment/client-deployment.md) - Client deployment
- [Monitoring](14-deployment/monitoring.md) - Performance tracking

### 📎 Appendix
Additional resources:
- [Glossary](15-appendix/glossary.md) - Terms and concepts
- [FAQ](15-appendix/faq.md) - Common questions
- [Resources](15-appendix/resources.md) - External resources
- [Changelog](15-appendix/changelog.md) - Version history

---

## 📊 Overview

### What is Hyperscape Shared?

Hyperscape Shared is the **core 3D multiplayer game engine** that powers the Hyperscape RPG project. It provides a complete Entity Component System (ECS) architecture with PhysX physics, Three.js rendering, and client-server networking for building multiplayer 3D games.

### Key Features

- **Entity Component System (ECS)**: Modular, scalable game object architecture
- **PhysX Physics**: Industry-standard physics simulation with colliders and rigid bodies
- **Three.js Rendering**: Advanced 3D rendering with WebGL/WebGPU support
- **Client-Server Networking**: Authoritative server with client prediction
- **VRM Avatar Support**: Load and animate VRM character models
- **World Management**: Client, server, and headless viewer world types
- **RPG Systems**: Combat, inventory, skills, banking, and more
- **Node System**: Hierarchical scene graph with transform management

### Technology Stack

- **Core**: TypeScript 5.3, Node.js 18+
- **Graphics**: Three.js 0.178, WebGL/WebGPU
- **Physics**: PhysX 5.x (WASM + Node.js native)
- **Networking**: Socket.io, WebRTC (LiveKit)
- **State**: Event-driven architecture with EventBus
- **Build**: Vite 6.0, ESBuild

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WORLD CONTAINER                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐│
│  │   Systems  │  │  Entities  │  │    Event Bus           ││
│  │  (Logic)   │  │  (Objects) │  │  (Communication)       ││
│  └────────────┘  └────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
         ↓                 ↓                      ↓
┌─────────────────────────────────────────────────────────────┐
│                     CORE SUBSYSTEMS                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐│
│  │  Physics   │  │    Stage   │  │     Network            ││
│  │  (PhysX)   │  │ (Three.js) │  │   (Socket.io)          ││
│  └────────────┘  └────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
         ↓                 ↓                      ↓
┌─────────────────────────────────────────────────────────────┐
│  PhysX WASM/Native │ WebGL/WebGPU │ WebSocket/WebRTC      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Start

### Prerequisites

- Node.js 18+ or Bun runtime
- TypeScript 5.3+
- Modern browser with WebGL 2.0+

### Installation

```bash
# Navigate to project root
cd hyperscape

# Install dependencies
npm install  # or: bun install
```

### Create Your First World

```typescript
import { createClientWorld } from '@hyperscape/shared';

// Create a client world
const world = await createClientWorld({
  assetsUrl: '/assets/',
  renderer: document.querySelector('#canvas'),
});

// Initialize the world
await world.init();

// Start the game loop
function gameLoop(time) {
  world.tick(time);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

### Spawn Your First Entity

```typescript
// Spawn a player entity
const player = world.entities.addPlayer({
  id: 'player1',
  name: 'Hero',
  position: { x: 0, y: 1, z: 0 },
});

// Get the player
const myPlayer = world.getPlayer('player1');
console.log(myPlayer.position);
```

---

## 📈 Documentation Stats

- **Total Pages**: 70+ markdown files
- **Code Examples**: 300+ examples
- **Systems Documented**: 50+
- **Components Documented**: 20+
- **Entities Documented**: 15+
- **API Methods**: 500+
- **Type Definitions**: 100+

---

## 🤝 Contributing

See [Development Guide](11-development/setup-guide.md) for contributing guidelines.

---

## 📝 License

Part of the Hyperscape project.

---

## 🔗 Related Documentation

- [Hyperscape Main README](../../../README.md)
- [Asset Forge Docs](../../asset-forge/dev-book/README.md)
- [Plugin Hyperscape Docs](../../plugin-hyperscape/README.md)

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
