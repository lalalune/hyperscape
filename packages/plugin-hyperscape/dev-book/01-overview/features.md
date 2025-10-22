# Features Overview

[← Back to Index](../README.md)

---

## Complete Feature List

Plugin Hyperscape provides a comprehensive feature set for AI agents in 3D worlds.

---

## 🎮 Action System

### Core World Actions

| Action | Description | Use Case |
|--------|-------------|----------|
| **perception** | Scan environment, identify entities | Environmental awareness, decision-making |
| **goto** | Navigate to locations/entities | Movement, exploration, following |
| **use** | Use items, interact with objects | Item usage, combat, interaction |
| **unuse** | Stop using current item | Release tools, end combat |
| **stop** | Stop all movement | Halt navigation, idle state |
| **walk_randomly** | Wander randomly | Exploration, idle behavior |
| **ambient** | Perform emotes/animations | Social interaction, personality |
| **build** | Place/modify entities | World building, construction |
| **reply** | Respond to chat messages | Social interaction, communication |
| **ignore** | Ignore messages/users | Filter spam, focus |

### RPG Actions

| Action | Description | Skill |
|--------|-------------|-------|
| **chopTree** | Chop trees for logs | Woodcutting |
| **catchFish** | Catch fish at fishing spots | Fishing |
| **lightFire** | Start campfires | Firemaking |
| **cookFood** | Cook raw food | Cooking |
| **bankItems** | Deposit/withdraw from bank | Banking |
| **checkInventory** | Inspect inventory contents | Inventory |

### Action Validation

All actions include robust validation:

```typescript
// Example: chopTree validation
validate: async (runtime, message) => {
  // Check if agent has axe equipped
  const hasAxe = await checkEquipment(runtime, 'axe');
  if (!hasAxe) return false;

  // Check if tree is nearby
  const tree = await findNearbyEntity(runtime, 'tree');
  if (!tree) return false;

  // Check if woodcutting level sufficient
  const level = await getSkillLevel(runtime, 'woodcutting');
  if (level < tree.requiredLevel) return false;

  return true;
}
```

---

## 🧠 Goal-Based AI

### Evaluator System

Plugin Hyperscape implements sophisticated AI decision-making:

#### 1. Goal Evaluator

Pursues explicit goals with priority system:

```typescript
interface Goal {
  type: 'explore' | 'gather' | 'combat' | 'social';
  priority: number;
  target?: Entity;
  status: 'active' | 'completed' | 'failed';
}
```

**Example Goals**:
- "Collect 10 logs from the forest"
- "Explore the northern mountain"
- "Defeat 5 goblins for XP"
- "Trade with merchant NPC"

#### 2. Boredom Evaluator

Prevents agents from getting stuck:

```typescript
// After 30 seconds of no action
if (timeSinceLastAction > 30000) {
  // Choose random activity
  const actions = ['walk_randomly', 'ambient', 'perception'];
  executeAction(randomChoice(actions));
}
```

#### 3. Fact Evaluator

Learn and remember world facts:

```typescript
// Agent learns facts
facts.add('location:bank', { x: 100, y: 0, z: 50 });
facts.add('npc:merchant', { sells: ['sword', 'shield'] });

// Later retrieval
const bankLocation = facts.get('location:bank');
goto(bankLocation);
```

---

## 🎯 Context Providers

### World Provider

Provides world state for AI decisions:

```typescript
// World context injection
World State:
  - Current region/area
  - Nearby entities (players, NPCs, items)
  - Weather and time
  - Available interactions
```

### Character Provider

Agent's character state:

```typescript
Character State:
  - Health/stamina
  - Inventory contents
  - Equipment slots
  - Active buffs/debuffs
```

### Skills Provider

RPG skill information:

```typescript
Skills Context:
  - Current skill levels
  - XP progress
  - Available skill actions
  - Required levels for entities
```

### Banking Provider

Banking system state:

```typescript
Banking Context:
  - Bank contents
  - Available space
  - Nearby bank locations
```

---

## 🧪 Real Testing Framework

### Visual Testing

**ColorDetector System**:

```typescript
// Define visual templates
const templates = {
  player: { color: 0xFF4543, hex: '#FF4543' },  // Red
  tree: { color: 0x228822, hex: '#228822' },     // Green
  fish: { color: 0x0000FF, hex: '#0000FF' },     // Blue
  goblin: { color: 0x228822, hex: '#228822' }    // Green
};

// Detect entities visually
const trees = await colorDetector.detectEntities(
  templates.tree.color,
  { tolerance: 10, minClusterSize: 20 }
);
```

### State Verification

```typescript
// Verify inventory changed
await testFramework.verifyState([
  {
    property: 'inventory.items',
    expectedValue: 'logs',
    operator: 'contains'
  },
  {
    property: 'skills.woodcutting.xp',
    expectedValue: 0,
    operator: 'greater'
  }
]);
```

### Playwright Integration

```typescript
// Real browser testing
const manager = new PlaywrightManager();
await manager.initialize();
await manager.navigateToWorld('http://localhost:3000');

// Execute actions
await agent.chopTree();

// Take screenshot for verification
const screenshot = await manager.takeScreenshot();
```

---

## 📦 Content Pack System

### Character Definitions

Reusable character configurations:

```typescript
const explorerPack: ContentPack = {
  name: 'explorer',
  description: 'Curious explorer agent',
  character: {
    bio: ['I love exploring new areas', 'I collect rare items'],
    behaviors: ['explore', 'collect', 'report'],
    goals: [
      { type: 'explore', priority: 10 },
      { type: 'gather', priority: 7 }
    ]
  }
};
```

### Behavior Presets

Pre-configured behavior patterns:

```typescript
behaviors: {
  explorer: {
    idle: ['walk_randomly', 'perception'],
    onBoredom: ['goto:random_landmark'],
    onDiscovery: ['report', 'investigate']
  },
  gatherer: {
    idle: ['perception', 'checkInventory'],
    onResource: ['goto', 'gather', 'bank'],
    onFull: ['bankItems']
  }
}
```

---

## 🔧 Manager System

### Behavior Manager

Coordinates agent behaviors:

```typescript
class BehaviorManager {
  // Execute behavior tree
  async executeBehavior(agent: Agent): Promise<void> {
    const behavior = this.getCurrentBehavior(agent);
    await this.executeNode(behavior.root);
  }

  // Handle state transitions
  onStateChange(agent: Agent, newState: State): void {
    this.updateBehavior(agent, newState);
  }
}
```

### Playwright Manager

Browser automation for testing:

```typescript
class PlaywrightManager {
  async initialize(): Promise<void>;
  async navigateToWorld(url: string): Promise<void>;
  async takeScreenshot(options?: Options): Promise<Buffer>;
  async executeScript(script: string): Promise<unknown>;
  async waitForCondition(condition: () => boolean): Promise<void>;
}
```

### Build Manager

World building capabilities:

```typescript
class BuildManager {
  async placeEntity(type: string, position: Vector3): Promise<Entity>;
  async removeEntity(entityId: string): Promise<void>;
  async modifyEntity(entityId: string, changes: Partial<Entity>): Promise<Entity>;
}
```

### Message Manager

Chat message handling:

```typescript
class MessageManager {
  async processMessage(message: ChatMessage): Promise<Response>;
  filterMessages(filter: MessageFilter): ChatMessage[];
  ignoreUser(userId: string): void;
  unignoreUser(userId: string): void;
}
```

---

## 📊 Dashboard & Monitoring

### React Dashboard

Visual monitoring interface:

```typescript
Components:
  - AgentStatusPanel: Live agent state
  - WorldMapView: 3D visualization
  - ActionHistory: Recent actions
  - InventoryPanel: Agent inventory
  - SkillsPanel: Skill progression
  - LogsPanel: Real-time logs
```

### Metrics & Analytics

Track agent performance:

```typescript
Metrics:
  - Actions per minute
  - Success/failure rate
  - XP gain rate
  - Distance traveled
  - Items collected
  - Social interactions
```

---

## 🌐 Multi-Agent Support

### Multi-Agent Manager

Coordinate multiple agents:

```typescript
class MultiAgentManager {
  agents: Map<string, Agent>;

  // Spawn multiple agents
  async spawnAgents(count: number): Promise<Agent[]>;

  // Coordinate actions
  async coordinateAction(action: string, agents: Agent[]): Promise<void>;

  // Handle conflicts
  resolveConflict(agent1: Agent, agent2: Agent): void;
}
```

### Agent Collaboration

Agents can work together:

```typescript
// Example: Team woodcutting
const team = await multiAgent.createTeam(['agent1', 'agent2', 'agent3']);
await team.executeTask('gather_wood', { target: 100 });

// Agents coordinate:
// - Find different trees
// - Avoid duplicate targets
// - Share inventory space
// - Report progress
```

---

## 🔐 Security Features

### Action Validation

All actions validated before execution:

```typescript
// Permission checks
if (!agent.hasPermission('build')) {
  throw new Error('Agent lacks build permission');
}

// Resource checks
if (agent.inventory.isFull()) {
  throw new Error('Inventory full');
}

// Rate limiting
if (action.cooldown && !action.isReady()) {
  throw new Error('Action on cooldown');
}
```

### Safe Execution

Sandbox execution environment:

```typescript
// Actions run in isolated context
try {
  const result = await executeAction(action, runtime);
  return result;
} catch (error) {
  logger.error('Action failed safely:', error);
  return { success: false, error };
}
```

---

## 🚀 Performance Features

### Optimized State Management

Efficient state updates:

```typescript
// Only sync necessary state
const relevantState = {
  position: agent.position,
  nearbyEntities: filterByDistance(entities, 50),
  inventory: agent.inventory
};

// Debounced updates
updateState(relevantState, { debounce: 100 });
```

### Action Caching

Cache expensive operations:

```typescript
// Cache pathfinding results
const pathCache = new Map<string, Path>();

if (pathCache.has(targetId)) {
  return pathCache.get(targetId);
}

const path = await calculatePath(start, target);
pathCache.set(targetId, path);
return path;
```

---

## 📱 Platform Support

### Supported Environments

- **Node.js**: 18+
- **Bun**: Latest
- **Browsers**: Chrome, Firefox (for Playwright)
- **OS**: Linux, macOS, Windows

### Deployment Options

- **Local Development**: Single agent on local machine
- **Server Deployment**: Multiple agents on dedicated server
- **Cloud**: Scalable cloud deployment (AWS, Azure, GCP)
- **Docker**: Containerized deployment

---

## Next Steps

- [Architecture Deep Dive](architecture.md)
- [Tech Stack Details](tech-stack.md)
- [Installation Guide](../02-getting-started/installation.md)

---

[← Back to Index](../README.md) | [← Previous: Introduction](introduction.md) | [Next: Architecture →](architecture.md)
