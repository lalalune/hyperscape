# Hyperfy Integration Architecture

This directory contains the core integration with the Hyperfy framework for 3D virtual worlds.

## Overview

The Hyperfy plugin integrates with the [Hyperfy framework](https://github.com/lalalune/hyperfy) to enable ElizaOS agents to exist and interact within 3D virtual worlds.

## Key Hyperfy Features Used

### 1. **Standalone Persistent Worlds**

- Agents can connect to self-hosted Hyperfy worlds
- World state persists across sessions
- Support for multiple concurrent agents

### 2. **Realtime Content Creation**

- Agents can build and modify the world in real-time
- Support for duplicating, translating, and importing entities
- Physics-based object manipulation

### 3. **Interactive App System**

- Agents can interact with JavaScript-based world apps
- Support for dynamic content and behaviors
- Integration with world events and triggers

### 4. **Portable Avatars**

- Agents have consistent VRM avatar representation
- Support for avatar customization and emotes
- Cross-world identity via Hyperfy ecosystem

### 5. **Physics-Based Interactions**

- Built on PhysX for realistic simulation
- Agents can pick up, drop, and manipulate objects
- Collision detection and pathfinding

### 6. **WebXR Support**

- Agents can exist alongside VR users
- Support for spatial audio and voice chat
- Immersive interaction capabilities

## Integration Points

### Core Systems

- **AgentControls**: Movement and navigation
- **AgentEnvironment**: World state and perception
- **AgentLoader**: Asset and avatar loading
- **AgentLiveKit**: Voice chat integration
- **AgentActions**: Action execution system

### Managers

- **BehaviorManager**: Autonomous behavior loop
- **BuildManager**: World building capabilities
- **EmoteManager**: Avatar animations
- **MessageManager**: Chat and communication
- **VoiceManager**: Spatial audio
- **PuppeteerManager**: Browser-based world rendering

## Data Flow

```
ElizaOS Agent
    ↓
HyperfyService
    ↓
World Connection (WebSocket)
    ↓
Hyperfy World Server
    ↓
3D World State
```

## Asset Pipeline

The plugin supports multiple asset sources:

- `asset://` - World-hosted assets
- `http(s)://` - Remote assets
- Local file paths - Development assets
- Data URIs - Embedded assets

## Future Enhancements

1. **Enhanced Physics Integration**

   - More complex object interactions
   - Physics-based puzzles and challenges

2. **Advanced Building Tools**

   - Procedural generation
   - Complex geometry manipulation

3. **World Scripting**

   - Direct JavaScript app creation
   - Event-driven behaviors

4. **Multi-Agent Coordination**

   - Synchronized actions
   - Collaborative building

5. **Extended WebXR Features**
   - Hand tracking support
   - Advanced VR interactions
