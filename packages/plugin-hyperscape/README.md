# @hyperscape/plugin-hyperscape

ElizaOS plugin for Hyperscape - Connects AI agents to 3D multiplayer RPG worlds as real players.

## Overview

This plugin enables ElizaOS AI agents to play Hyperscape as real players with full access to game mechanics:

- **Real-time state awareness** via providers (health, inventory, nearby entities, skills, equipment)
- **Full action repertoire**: movement, combat, gathering, inventory management, social interactions
- **Event-driven memory storage** for learning from gameplay experiences
- **Automatic reconnection** and robust error handling
- **A2A Protocol** - Agent-to-Agent communication for external agents
- **MCP Integration** - Model Context Protocol support for Claude and other LLMs

## Protocol Support

### A2A (Agent-to-Agent)
Any AI agent can discover and play Hyperscape via A2A protocol:

```typescript
import { createA2AClient } from "@hyperscape/plugin-hyperscape";

const client = createA2AClient({ 
  serverUrl: "http://localhost:5555",
  agentId: "my-agent"
});

// Discover skills
const agentCard = await client.discover();
console.log(`${agentCard.skills.length} skills available`);

// Play the game
await client.moveTo(10, 0, 20);
await client.attack("goblin-123");
const context = await client.getWorldContext();
```

### MCP (Model Context Protocol)
Use with Claude or any MCP-compatible LLM:

```typescript
import { HyperscapeMCPServer } from "@hyperscape/plugin-hyperscape";

const mcpServer = new HyperscapeMCPServer(hyperscapeService);

// Get available tools
const tools = mcpServer.listTools();  // 20+ game actions

// Execute actions
const result = await mcpServer.callTool("hyperscape_attack", {
  targetName: "goblin"
});

// Read game state as resources
const scene = await mcpServer.readResource("hyperscape://world/scene");
```

## Architecture

### Service
- **HyperscapeService**: Manages WebSocket connection to game server, maintains cached game state, executes commands

### Providers (Supply Context to Agent)
1. **gameStateProvider**: Player health, stamina, position, combat status
2. **inventoryProvider**: Inventory items, coins, free slots
3. **nearbyEntitiesProvider**: Players, NPCs, and resources nearby
4. **skillsProvider**: Skill levels and XP progression
5. **equipmentProvider**: Currently equipped items
6. **availableActionsProvider**: Context-aware available actions

### Actions (Executable Game Commands)
- **Movement**: MOVE_TO, FOLLOW_ENTITY, STOP_MOVEMENT
- **Combat**: ATTACK_ENTITY, CHANGE_COMBAT_STYLE, FLEE
- **Skills**: CHOP_TREE, CATCH_FISH, LIGHT_FIRE, COOK_FOOD
- **Inventory**: EQUIP_ITEM, USE_ITEM, DROP_ITEM, PICKUP_ITEM
- **Social**: CHAT_MESSAGE, EMOTE
- **Banking**: BANK_DEPOSIT, BANK_WITHDRAW
- **Interactions**: INTERACT_NPC, LOOT_CORPSE, RESPAWN
- **Goals**: SET_GOAL, NAVIGATE_TO, EXPLORE, IDLE

### Event Handlers
Automatically store significant game events as memories:
- Combat encounters (victories, defeats, kills)
- Resource gathering and respawns
- Skill level-ups and XP gains
- Player interactions

## Installation

```bash
# In your ElizaOS project
bun install @hyperscape/plugin-hyperscape
```

## Configuration

### Environment Variables

```bash
# Hyperscape server WebSocket URL (default: ws://localhost:5555/ws)
HYPERSCAPE_SERVER_URL=ws://localhost:5555/ws

# Automatically reconnect on disconnect (default: true)
HYPERSCAPE_AUTO_RECONNECT=true
```

### Character File

Add the plugin to your ElizaOS character configuration:

```json
{
  "name": "WoodcutterBot",
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "settings": {
    "HYPERSCAPE_SERVER_URL": "ws://localhost:5555/ws",
    "HYPERSCAPE_AUTO_RECONNECT": "true"
  }
}
```

## Usage Example

Once configured, the agent will:

1. **Connect** to Hyperscape server on startup
2. **Receive context** from providers every decision cycle
3. **Execute actions** based on LLM decisions
4. **Store memories** of important game events
5. **Learn** from past experiences via semantic memory search

### Example Agent Behavior

```typescript
// Agent receives provider context:
// - "You have 75/100 HP and are at position [10, 5, 20]"
// - "Nearby: Oak Tree at [12, 5, 18]"
// - "Inventory: Bronze Axe, 15 free slots"
// - "Available: CHOP_TREE, MOVE_TO, CHAT"

// Agent decides and executes action:
await runtime.processActions({
  action: 'CHOP_TREE',
  target: 'Oak Tree'
});

// Event occurs:
// RESOURCE_GATHERED → Stored as memory:
// "Gathered Oak Logs at [12, 5, 18], gained 25 woodcutting XP"

// Later, agent can search memories:
// "Where did I last chop trees?"
// → Semantic search returns location [12, 5, 18]
```

## Memory System Integration

The plugin stores these event types as memories:

- **Combat Memories**: Opponents, outcomes, damage dealt/taken
- **Resource Memories**: Locations, types, XP gained
- **Skill Memories**: Level-ups, progression milestones
- **Social Memories**: Player interactions, messages

Memories are tagged for semantic search:
- Tags: `['hyperscape', 'combat', 'victory']`
- Tags: `['hyperscape', 'resource', 'woodcutting', 'gathered']`
- Tags: `['hyperscape', 'skill', 'levelup', 'fishing']`

## Development

```bash
# Build the plugin
bun run build

# Watch mode for development
bun run dev

# Run tests
bun run test
```

## Plugin Structure

```
src/
├── index.ts              # Plugin export and configuration
├── types.ts              # TypeScript type definitions
├── services/
│   └── HyperscapeService.ts
├── providers/
│   ├── gameState.ts      # Health, stamina, position
│   ├── inventory.ts      # Items, coins, slots
│   ├── nearbyEntities.ts # Mobs, players, resources
│   ├── worldContext.ts   # Semantic scene description (for A2A/MCP)
│   ├── availableActions.ts
│   ├── skills.ts
│   └── equipment.ts
├── actions/
│   ├── movement.ts       # MOVE_TO, FOLLOW, STOP
│   ├── combat.ts         # ATTACK, COMBAT_STYLE
│   ├── skills.ts         # CHOP, FISH, COOK, LIGHT_FIRE
│   ├── inventory.ts      # EQUIP, USE_ITEM, DROP
│   ├── social.ts         # CHAT
│   ├── banking.ts        # DEPOSIT, WITHDRAW
│   ├── interactions.ts   # NPC, LOOT, RESPAWN, EMOTE
│   ├── autonomous.ts     # EXPLORE, FLEE, IDLE
│   └── goals.ts          # SET_GOAL, NAVIGATE_TO
├── mcp/
│   ├── index.ts          # MCP exports
│   └── server.ts         # MCP server implementation
├── a2a/
│   ├── index.ts          # A2A exports  
│   └── client.ts         # A2A client adapter
├── managers/
│   └── autonomous-behavior-manager.ts  # LLM decision loop
├── evaluators/
│   └── goalEvaluator.ts  # Goal progress assessment
└── events/
    └── handlers.ts       # Event → Memory mappings
```

## Key Design Principles

1. **Event-Driven**: Game events flow into agent context automatically
2. **Stateless Actions**: Actions use Service for state, no internal state
3. **Rich Context**: Providers give agent full game awareness
4. **Memory-Based Learning**: Agents learn from experiences via Memory system
5. **Type-Safe**: Full TypeScript types from both ElizaOS and Hyperscape
6. **Modular**: Clean separation - Service → Providers → Actions

## Differences from Old Plugin

The previous `@elizaos/plugin-hyperscape` was broken. This new implementation:

✅ Follows ElizaOS plugin architecture standards
✅ Properly implements Service, Provider, Action, Event patterns
✅ Uses WebSocket for real-time communication
✅ Stores events as memories for learning
✅ Provides complete game context via providers
✅ Handles reconnection and errors gracefully
✅ Fully typed with TypeScript

---

## A2A and MCP Integration

### Agent-to-Agent (A2A) Protocol

Any AI agent can discover and play Hyperscape via A2A JSON-RPC:

```bash
# Discover available skills
curl http://localhost:3000/agent.json

# Example: Move to position
curl -X POST http://localhost:3000/a2a/execute \
  -H "Content-Type: application/json" \
  -d '{"skill": "move-to", "params": {"x": 100, "z": 200}}'
```

**Available A2A Skills:**
- `move-to` - Navigate to coordinates `{x, z}`
- `attack` - Attack entity `{entityId, style?}`
- `chop-tree` - Harvest nearby tree
- `npc-interact` - Talk to NPC `{entityId}`
- `loot-corpse` - Loot nearby corpse `{entityId}`
- `request-respawn` - Respawn after death
- `perform-emote` - Express emote `{emoteType}`
- `set-goal` - Set autonomous goal `{goal}`
- `get-world-context` - Get semantic world description

### Multi-Agent Communication Protocol (MCP)

The MCP server exposes Hyperscape capabilities to MCP-compatible agents:

```typescript
import { McpServer } from "@hyperscape/plugin-hyperscape/mcp";

const mcp = new McpServer({ service: hyperscapeService });
await mcp.start(3001);
```

**MCP Tools:**
- `hyperscape.move` - Move agent to location
- `hyperscape.attack` - Initiate combat
- `hyperscape.interact` - Interact with world object
- `hyperscape.getContext` - Get world state

### External Agent Integration Example

```typescript
import { A2AClient } from "@hyperscape/plugin-hyperscape/a2a";

const client = new A2AClient("http://localhost:3000");

// Full gameplay loop
const context = await client.getWorldContext();
if (context.threats.length > 0) {
  await client.execute("attack", { entityId: context.threats[0].id });
} else if (context.resources.length > 0) {
  await client.execute("chop-tree");
}
```

## License

MIT - Hyperscape Team
