# Introduction to Plugin Hyperscape

[← Back to Index](../README.md)

---

## What is Plugin Hyperscape?

Plugin Hyperscape is an **ElizaOS plugin that brings AI agents to life in 3D multiplayer worlds**. It bridges the gap between LLM-powered AI agents and interactive 3D environments, enabling agents to navigate, interact, chat, and play just like human players.

### Purpose

Plugin Hyperscape solves the challenge of creating embodied AI agents that can:

- **Inhabit 3D worlds** with physical presence and spatial awareness
- **Interact naturally** with environments, objects, and players
- **Make autonomous decisions** based on goals, context, and memory
- **Learn and adapt** through experience in the virtual world
- **Collaborate** with human players and other agents

### Built for ElizaOS

Plugin Hyperscape was specifically created for the [ElizaOS AI agent framework](https://elizaos.ai), extending it with:

- **World Actions**: Navigate, use items, fight, craft, build
- **Context Providers**: World state, inventory, skills, nearby entities
- **Goal Evaluators**: Autonomous behavior driven by boredom, curiosity, goals
- **Real Testing**: Visual verification, Playwright integration, no mocks
- **RPG Integration**: Complete RPG systems (skills, inventory, banking, combat)

---

## Core Capabilities

### 1. Autonomous 3D Agent Control

Transform AI agents into embodied characters:

```
Input: "Explore the forest and collect wood"
Agent Behavior:
  ✓ Scan environment (perception action)
  ✓ Navigate to forest (goto action)
  ✓ Find trees (visual detection)
  ✓ Chop trees (chopTree action)
  ✓ Collect logs (inventory management)
  ✓ Report back (reply action)
```

**Powered by:**
- ElizaOS LLM decision-making
- Hyperscape 3D world simulation
- WebSocket real-time synchronization

### 2. 20+ Action System

Complete action library for agent interaction:

```
Core Actions:
  ├─ perception: Scan and identify entities
  ├─ goto: Navigate to locations/entities
  ├─ use: Use items and interact with objects
  ├─ unuse: Stop using item
  ├─ stop: Stop movement
  ├─ walk_randomly: Wander exploration
  ├─ ambient: Idle behaviors and emotes
  ├─ build: Place/modify world entities
  ├─ reply: Respond to chat messages
  └─ ignore: Ignore messages/users

RPG Actions:
  ├─ chopTree: Woodcutting skill
  ├─ catchFish: Fishing skill
  ├─ lightFire: Firemaking skill
  ├─ cookFood: Cooking skill
  ├─ bankItems: Banking system
  └─ checkInventory: Inventory inspection
```

### 3. Goal-Based AI System

Autonomous agents driven by evaluators:

```
Evaluator System:
├─ Goal Evaluator
│   └─ Agents pursue explicit goals (explore, collect, combat)
├─ Boredom Evaluator
│   └─ Prevents stagnation, encourages exploration
└─ Fact Evaluator
    └─ Learn and remember world facts
```

**Example Flow**:
```typescript
// Agent gets bored standing still
Boredom Evaluator → "I should do something"
  ↓
Goal Evaluator → "I want to explore new areas"
  ↓
Action Selection → walk_randomly or goto
  ↓
Agent starts exploring
```

### 4. Real Testing Framework

No mocks - real gameplay verification:

```
Testing Methods:
├─ Visual Testing
│   ├─ ColorDetector for entity identification
│   ├─ 🔴 Players (red cubes)
│   ├─ 🟢 Trees (green cubes)
│   ├─ 🔵 Fish (blue cubes)
│   └─ Screenshot verification
├─ State Testing
│   ├─ Inventory checks
│   ├─ Skill progression
│   └─ Position verification
└─ Playwright Integration
    ├─ Browser automation
    ├─ Real browser rendering
    └─ Headless or headful testing
```

### 5. RPG System Integration

Complete RPG mechanics:

```
RPG Systems:
├─ Skills
│   ├─ Woodcutting (chop trees)
│   ├─ Fishing (catch fish)
│   ├─ Firemaking (light fires)
│   ├─ Cooking (cook food)
│   └─ Level progression with XP
├─ Inventory
│   ├─ Item management
│   ├─ Equipment slots
│   └─ Weight/capacity limits
├─ Banking
│   ├─ Deposit items
│   ├─ Withdraw items
│   └─ Shared storage
└─ Combat (future)
    ├─ Attack/defend
    ├─ Damage calculation
    └─ Health/death mechanics
```

### 6. Natural Language Chat

Agents respond with personality:

```
Player: "Hey, can you help me find some wood?"
Agent:
  1. Parse message intent
  2. Check world context (providers)
  3. Generate response with LLM
  4. Execute actions if needed
  5. Reply: "Sure! I see some trees nearby. Follow me!"
  6. Execute: goto(tree), chopTree()
```

---

## Key Benefits

### For Game Developers

- **Living Worlds**: Populate worlds with intelligent NPCs
- **Dynamic Content**: Agents create emergent gameplay
- **Testing**: Automated gameplay testing with real agents
- **No Scripting**: AI-driven behaviors instead of complex scripts

### For AI Researchers

- **Embodied AI**: Study AI in physical environments
- **Multi-Agent Systems**: Research agent collaboration
- **Learning**: Train agents through gameplay experience
- **Evaluation**: Benchmark AI in complex scenarios

### For Multiplayer Games

- **NPC Companions**: Intelligent AI companions for players
- **Quest NPCs**: Dynamic quest givers and guides
- **Opponents**: Challenging AI opponents
- **Social NPCs**: Agents that chat and interact naturally

---

## Architecture Overview

### Plugin Pattern

Plugin Hyperscape follows the ElizaOS plugin pattern:

```typescript
export const hyperscapePlugin: Plugin = {
  name: "hyperscape",

  // Long-lived service for world connection
  services: [HyperscapeService],

  // Discrete actions agents can perform
  actions: [
    perception, goto, use, unuse, stop,
    walk_randomly, ambient, build, reply, ignore,
    chopTree, catchFish, lightFire, cookFood, bankItems
  ],

  // Context providers for agent decision-making
  providers: [
    world, emote, actions, character,
    banking, skills
  ],

  // Event handlers for world events
  events: hyperscapeEvents
};
```

### Service Architecture

```text
┌─────────────────────────────────────────────┐
│         HyperscapeService                    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │ WebSocket    │◄────►│ Hyperscape      │ │
│  │ Client       │      │ World Server    │ │
│  └──────────────┘      └─────────────────┘ │
│         ▲                                    │
│         │                                    │
│  ┌──────┴────────┐                          │
│  │ State Manager │                          │
│  │ - Player state│                          │
│  │ - World state │                          │
│  │ - Entities    │                          │
│  └───────────────┘                          │
│         ▲                                    │
│         │                                    │
│  ┌──────┴────────────────────────────────┐ │
│  │ Managers                               │ │
│  │ - BehaviorManager                      │ │
│  │ - PlaywrightManager                    │ │
│  │ - BuildManager                         │ │
│  │ - MessageManager                       │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Use Cases

### 1. Autonomous Game NPCs

Create intelligent NPCs that:
- Wander and explore the world
- Respond to player questions
- Perform tasks (gathering, crafting, building)
- React to world events

### 2. AI Testing Bots

Test your game with AI agents:
- Automated gameplay testing
- Performance testing with multiple agents
- Bug discovery through exploration
- Visual regression testing

### 3. Companion Agents

Build AI companions that:
- Follow and assist players
- Provide guidance and tips
- Execute commands ("get me wood")
- Learn player preferences

### 4. Social Experiments

Research AI behavior:
- Multi-agent collaboration
- Emergent social dynamics
- Learning from experience
- Goal-directed behavior

### 5. Content Creation

Use agents to:
- Generate gameplay footage
- Test new features
- Stress test servers
- Demonstrate mechanics

---

## Target Audience

### Primary Users

1. **Game Developers**: Building multiplayer 3D games with AI NPCs
2. **AI Researchers**: Studying embodied AI in virtual environments
3. **ElizaOS Developers**: Extending ElizaOS with 3D world capabilities
4. **Indie Developers**: Adding AI characters without complex scripting

### Technical Requirements

- **Skill Level**: Intermediate TypeScript/JavaScript
- **Prerequisites**: ElizaOS knowledge, basic game development
- **Hardware**: 4GB+ RAM recommended for local testing
- **Software**: Node.js 18+, Hyperscape server access

---

## Integration with Hyperscape

Plugin Hyperscape is tightly integrated with the Hyperscape game engine:

### World Connection

```typescript
// Agent connects to Hyperscape world
const service = runtime.getService<HyperscapeService>(
  HyperscapeService.serviceName
);

// Service manages WebSocket connection
await service.connect(worldUrl);

// Agent is now in the 3D world
```

### Action Execution

```typescript
// Agent decides to chop tree
const action = chopTreeAction;

// Validation checks if action is possible
const canChop = await action.validate(runtime, message);

// Handler executes in Hyperscape world
const result = await action.handler(runtime, message);

// World state updates, agent gets logs
```

### State Synchronization

```typescript
// Real-time world state updates
service.on('worldState', (state) => {
  // Update agent context
  providers.world.update(state);

  // Agent makes new decisions based on state
  evaluators.evaluate(runtime);
});
```

---

## Next Steps

Now that you understand what Plugin Hyperscape is, explore:

- [Features Overview](features.md) - Detailed feature list
- [Architecture](architecture.md) - System design deep dive
- [Tech Stack](tech-stack.md) - Technologies used
- [Installation Guide](../02-getting-started/installation.md) - Get started

---

[← Back to Index](../README.md) | [Next: Features →](features.md)
