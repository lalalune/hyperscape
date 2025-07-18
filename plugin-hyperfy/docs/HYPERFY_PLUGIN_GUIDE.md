# ElizaOS Hyperfy Plugin Guide

## Overview

The Hyperfy plugin integrates ElizaOS agents with Hyperfy virtual worlds, enabling agents to have 3D presence, interact with environments, and collaborate with other agents in immersive spaces.

## Features

### Core Capabilities

- **3D World Connection**: Connect agents to Hyperfy virtual worlds via WebSocket
- **Avatar Control**: Move, emote, and interact in 3D space
- **Scene Perception**: Analyze and understand the 3D environment
- **Multi-Agent Support**: Deploy multiple agents in the same world
- **Build Tools**: Create and modify objects in the world
- **Voice Integration**: Text-to-speech capabilities for agent communication
- **Autonomous Behavior**: Agents can explore and interact independently

### Actions

#### HYPERFY_SCENE_PERCEPTION

Analyzes the current 3D environment and provides detailed descriptions.

```typescript
// Example usage
'Look around and tell me what you see';
'What entities are nearby?';
'Describe the environment';
```

#### HYPERFY_GOTO_ENTITY

Navigate to specific entities or locations in the world.

```typescript
// Example usage
'Go to the blue cube';
'Walk to position 10, 0, 10';
'Move to the nearest player';
```

#### HYPERFY_EDIT_ENTITY

Create, modify, or delete objects in the world.

```typescript
// Example usage
'Create a red sphere at my location';
'Delete the cube in front of me';
'Make that object bigger';
'Import https://example.com/model.glb';
```

#### HYPERFY_WALK_RANDOMLY

Enable autonomous exploration behavior.

```typescript
// Example usage
'Start exploring';
'Walk around randomly';
'Stop moving';
```

#### HYPERFY_AMBIENT_SPEECH

Enable autonomous speech generation.

```typescript
// Example usage
'Start talking';
'Say something interesting';
'Stop talking';
```

### Providers

#### HYPERFY_WORLD_STATE

Provides current world state information including:

- Agent position and orientation
- Nearby entities and their properties
- Recent chat messages
- Available actions

#### HYPERFY_EMOTE_LIST

Provides available emotes and animations.

#### HYPERFY_ACTIONS_LIST

Provides available actions in the current context.

## Installation

1. Install the plugin:

```bash
npm install @elizaos/plugin-hyperfy
```

2. Add to your character configuration:

```json
{
  "name": "MyAgent",
  "plugins": ["@elizaos/plugin-hyperfy"],
  "settings": {
    "HYPERFY_WS_URL": "wss://your-world.hyperfy.io/ws",
    "HYPERFY_AUTH_TOKEN": "optional-auth-token"
  }
}
```

## Configuration

### Environment Variables

- `HYPERFY_WS_URL`: WebSocket URL for the Hyperfy world (default: wss://chill.hyperfy.xyz/ws)
- `HYPERFY_AUTH_TOKEN`: Optional authentication token
- `HYPERFY_VOICE_MODEL`: Voice model for TTS (default: en_US-hfc_female-medium)

### Character Settings

```typescript
{
  // Basic settings
  "name": "AgentName",
  "bio": "Agent description",

  // Hyperfy-specific settings
  "settings": {
    "HYPERFY_BEHAVIOR_INTERVAL": 30000,  // Autonomous behavior interval (ms)
    "HYPERFY_ENABLE_AUTONOMY": true,     // Enable autonomous behavior
    "HYPERFY_SPAWN_POSITION": "0,0,0",   // Initial spawn position
  }
}
```

## Usage Examples

### Basic Connection

```typescript
import { hyperfyPlugin } from '@elizaos/plugin-hyperfy';
import { createAgent } from '@elizaos/core';

const agent = await createAgent({
  name: 'HyperfyAgent',
  plugins: [hyperfyPlugin],
  settings: {
    HYPERFY_WS_URL: 'wss://my-world.hyperfy.io/ws',
  },
});

await agent.start();
```

### Multi-Agent Deployment

```typescript
import { MultiAgentManager } from '@elizaos/plugin-hyperfy';

const manager = new MultiAgentManager({
  worldUrl: 'wss://my-world.hyperfy.io/ws',
  maxAgents: 10,
  agentSpacing: 5,
});

// Add agents
for (let i = 0; i < 10; i++) {
  const agent = await createAgent({
    name: `Agent${i}`,
    plugins: [hyperfyPlugin],
  });

  await manager.addAgent(agent.runtime);
}

// Enable inter-agent communication
manager.enableInterAgentCommunication();

// Start the manager
manager.start();
```

### Custom Behaviors

```typescript
// Configure autonomous behavior
const agent = await createAgent({
  name: 'AutonomousAgent',
  plugins: [hyperfyPlugin],
  settings: {
    HYPERFY_BEHAVIOR_INTERVAL: 20000, // Act every 20 seconds
    HYPERFY_ENABLE_AUTONOMY: true,
  },
  bio: [
    'You are a helpful guide in the virtual world',
    'You enjoy exploring and meeting new people',
    'You share interesting facts about things you see',
  ],
});
```

## Frontend Dashboard

The plugin includes a React-based dashboard for monitoring and controlling agents.

### Features

- Real-time agent status
- Position tracking
- Avatar management
- World statistics
- Multi-agent visualization

### Setup

```typescript
import { HyperfyDashboard } from '@elizaos/plugin-hyperfy/frontend';

function App() {
  return <HyperfyDashboard />;
}
```

## Testing

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
elizaos test
```

### Scenario Tests

```bash
elizaos scenario run scenarios/hyperfy-multi-agent.ts
```

## Architecture

### Service Architecture

```
HyperfyService
├── BehaviorManager     # Autonomous behavior
├── BuildManager        # World editing
├── EmoteManager        # Animations
├── MessageManager      # Chat handling
├── VoiceManager        # Text-to-speech
└── PuppeteerManager    # Browser automation
```

### System Components

```
AgentAvatar    # Avatar representation
AgentControls  # Movement and interaction
AgentLoader    # Asset loading
AgentEnvironment # World state
AgentActions   # Action execution
AgentLiveKit   # Voice integration
```

## Best Practices

### Performance

1. **Connection Management**: Reuse connections when possible
2. **Rate Limiting**: Respect world rate limits
3. **Asset Optimization**: Use optimized 3D models
4. **Memory Management**: Clean up unused entities

### Multi-Agent Coordination

1. **Spacing**: Maintain appropriate distance between agents
2. **Communication**: Use inter-agent messaging wisely
3. **Synchronization**: Handle concurrent actions carefully
4. **Load Balancing**: Distribute agents across worlds

### Error Handling

```typescript
try {
  await service.connect({ wsUrl, worldId });
} catch (error) {
  if (error.code === 'CONNECTION_FAILED') {
    // Retry with backoff
  } else if (error.code === 'AUTH_FAILED') {
    // Handle authentication
  }
}
```

## Troubleshooting

### Common Issues

#### Connection Failed

- Check WebSocket URL is correct
- Verify network connectivity
- Check authentication token if required

#### Agent Not Moving

- Ensure world is loaded
- Check agent has spawn position
- Verify controls are enabled

#### Missing Entities

- Wait for world to fully load
- Check entity visibility settings
- Verify entity IDs are correct

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'hyperfy:*';

// Monitor agent state
agent.on('stateChange', (state) => {
  console.log('Agent state:', state);
});
```

## API Reference

### HyperfyService

```typescript
class HyperfyService {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getWorld(): World | null;
  // ... managers getters
}
```

### MultiAgentManager

```typescript
class MultiAgentManager {
  addAgent(runtime: IAgentRuntime): Promise<AgentInstance>;
  removeAgent(agentId: UUID): Promise<void>;
  getAgents(): AgentInstance[];
  start(): void;
  stop(): Promise<void>;
  enableInterAgentCommunication(): void;
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details
