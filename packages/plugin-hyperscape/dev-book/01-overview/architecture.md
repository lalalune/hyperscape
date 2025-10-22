# Plugin Architecture

[← Back to Index](../README.md)

---

## System Architecture

Plugin Hyperscape follows a layered architecture that integrates seamlessly with ElizaOS while managing complex 3D world interactions.

---

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ElizaOS Agent Runtime                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │   Memory     │  │   Models     │  │   Core Services        ││
│  │   (RAG)      │  │   (LLMs)     │  │   (Base Runtime)       ││
│  └──────────────┘  └──────────────┘  └────────────────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │ Plugin Interface
┌──────────────────────────┴──────────────────────────────────────┐
│              Hyperscape Plugin Layer                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Actions (20+)                                               ││
│  │ - perception, goto, use, chopTree, catchFish, etc.         ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Evaluators (3)                                              ││
│  │ - Goal Evaluator, Boredom Evaluator, Fact Evaluator        ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Providers (10+)                                             ││
│  │ - World, Character, Skills, Banking, Actions, Time          ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ HyperscapeService (Core Service)                            ││
│  │ ┌───────────────┐  ┌────────────────┐  ┌─────────────────┐││
│  │ │ WebSocket     │  │ State Manager  │  │ RPG Systems     │││
│  │ │ Client        │  │                │  │                 │││
│  │ └───────────────┘  └────────────────┘  └─────────────────┘││
│  │ ┌───────────────┐  ┌────────────────┐  ┌─────────────────┐││
│  │ │ Managers (9)  │  │ Content Packs  │  │ Testing         │││
│  │ │               │  │                │  │ Framework       │││
│  │ └───────────────┘  └────────────────┘  └─────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket Protocol
┌──────────────────────────┴──────────────────────────────────────┐
│                  Hyperscape Game World                           │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 3D Engine  │  │  ECS        │  │  RPG Systems            │  │
│  │ (Three.js) │  │  Systems    │  │  (Skills/Inventory)     │  │
│  └────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Layers

### 1. ElizaOS Integration Layer

**Purpose**: Integrate with ElizaOS core runtime

**Components**:
```typescript
// Plugin registration
export const hyperscapePlugin: Plugin = {
  name: "hyperscape",
  description: "Integrates ElizaOS agents with Hyperscape worlds",
  services: [HyperscapeService],
  actions: [...actions],
  providers: [...providers],
  evaluators: [...evaluators],
  events: hyperscapeEvents
};
```

**Responsibilities**:
- Register plugin with ElizaOS
- Initialize services
- Expose actions, providers, evaluators
- Handle lifecycle events

### 2. Service Layer

**HyperscapeService** - Core connection and state management

```typescript
class HyperscapeService implements IAgentService {
  static serviceName = "hyperscape";

  // WebSocket connection to Hyperscape world
  private client: HyperscapeClient;

  // State managers
  private worldStateManager: WorldStateManager;
  private rpgStateManager: RPGStateManager;

  // Sub-managers
  private behaviorManager: BehaviorManager;
  private playwrightManager: PlaywrightManager;
  private buildManager: BuildManager;
  private messageManager: MessageManager;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    // Connect to Hyperscape world
    await this.client.connect(worldUrl);

    // Initialize managers
    await this.initializeManagers();

    // Start event listeners
    this.setupEventHandlers();
  }
}
```

**Responsibilities**:
- Maintain WebSocket connection
- Manage world state synchronization
- Coordinate sub-managers
- Handle reconnection logic

### 3. Action Layer

**Actions** - Discrete operations agents can perform

```typescript
interface Action {
  name: string;
  description: string;
  examples: Example[];

  // Determine if action should execute
  validate(runtime: IAgentRuntime, message: Memory): Promise<boolean>;

  // Execute the action
  handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Options,
    callback?: HandlerCallback
  ): Promise<boolean>;
}
```

**Action Flow**:
```text
1. Agent generates action intent (LLM)
   ↓
2. Action.validate() checks preconditions
   ↓
3. Action.handler() executes in world
   ↓
4. World state updates
   ↓
5. Providers update context
   ↓
6. Agent receives feedback
```

**Example Action Implementation**:
```typescript
export const chopTreeAction: Action = {
  name: "CHOP_TREE",
  description: "Chop down a tree to collect logs",

  validate: async (runtime, message) => {
    const service = runtime.getService<HyperscapeService>("hyperscape");

    // Check if agent has axe
    const inventory = service.getPlayerInventory();
    const hasAxe = inventory.some(item => item.type === 'axe');
    if (!hasAxe) return false;

    // Check if tree nearby
    const nearbyEntities = service.getNearbyEntities(10);
    const tree = nearbyEntities.find(e => e.type === 'tree');
    if (!tree) return false;

    return true;
  },

  handler: async (runtime, message) => {
    const service = runtime.getService<HyperscapeService>("hyperscape");

    // Find nearest tree
    const tree = await service.findNearestEntity('tree');

    // Navigate to tree
    await service.navigateToEntity(tree.id);

    // Execute chop action
    const result = await service.executeAction('chopTree', {
      targetId: tree.id
    });

    // Update state
    if (result.success) {
      logger.info(`Successfully chopped tree. Gained ${result.xp} XP`);
      return true;
    }

    return false;
  }
};
```

### 4. Evaluator Layer

**Evaluators** - Decision-making logic for autonomous behavior

```typescript
interface Evaluator {
  name: string;
  description: string;

  // Evaluate current state and return recommendations
  evaluate(
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<EvaluationResult>;
}

interface EvaluationResult {
  shouldAct: boolean;
  action?: string;
  priority: number;
  reasoning: string;
}
```

**Evaluation Flow**:
```text
1. Evaluators run periodically (e.g., every 5 seconds)
   ↓
2. Each evaluator assesses current state
   ↓
3. Evaluators return recommendations with priorities
   ↓
4. Highest priority action is selected
   ↓
5. Action is validated and executed
```

**Example Evaluator**:
```typescript
export const boredomEvaluator: Evaluator = {
  name: "BOREDOM",
  description: "Prevents agent from getting stuck or idle",

  evaluate: async (runtime, message) => {
    const service = runtime.getService<HyperscapeService>("hyperscape");

    // Check time since last action
    const lastAction = service.getLastActionTime();
    const timeSinceAction = Date.now() - lastAction;

    if (timeSinceAction > 30000) { // 30 seconds
      return {
        shouldAct: true,
        action: 'walk_randomly',
        priority: 5,
        reasoning: 'Agent has been idle for too long'
      };
    }

    return { shouldAct: false, priority: 0 };
  }
};
```

### 5. Provider Layer

**Providers** - Context injection for agent decision-making

```typescript
interface Provider {
  name: string;

  // Provide context for agent prompts
  get(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<string>;
}
```

**Provider Flow**:
```text
1. Agent needs to make decision
   ↓
2. Providers inject context into prompt
   ↓
3. LLM generates response with context
   ↓
4. Response is more informed and accurate
```

**Example Provider**:
```typescript
export const worldProvider: Provider = {
  name: "world",

  get: async (runtime, message) => {
    const service = runtime.getService<HyperscapeService>("hyperscape");

    const nearbyEntities = service.getNearbyEntities(20);
    const playerPosition = service.getPlayerPosition();

    return `
**Current World State:**

**Location:** ${playerPosition.region} at (${playerPosition.x}, ${playerPosition.y}, ${playerPosition.z})

**Nearby Entities:**
${nearbyEntities.map(e => `- ${e.type} (${e.name}) at distance ${e.distance}m`).join('\n')}

**Current Weather:** ${service.getWeather()}
**Time of Day:** ${service.getTimeOfDay()}
    `.trim();
  }
};
```

### 6. Manager Layer

**Managers** - Specialized subsystems

#### BehaviorManager
Coordinates agent behavior trees:
```typescript
class BehaviorManager {
  private behaviors: Map<string, BehaviorTree>;

  async executeBehavior(agent: Agent, behaviorName: string): Promise<void> {
    const tree = this.behaviors.get(behaviorName);
    await this.traverseTree(tree.root);
  }
}
```

#### PlaywrightManager
Browser automation for testing:
```typescript
class PlaywrightManager {
  private browser: Browser;
  private page: Page;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async navigateToWorld(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async takeScreenshot(): Promise<Buffer> {
    return await this.page.screenshot();
  }
}
```

#### BuildManager
World building operations:
```typescript
class BuildManager {
  async placeEntity(
    type: string,
    position: Vector3
  ): Promise<Entity> {
    return await this.service.executeAction('build', {
      entityType: type,
      position
    });
  }
}
```

---

## Data Flow

### Action Execution Flow

```text
┌──────────────────────────────────────────────────────────────┐
│                    Action Execution Flow                      │
└──────────────────────────────────────────────────────────────┘

1. TRIGGER
   User message: "Chop some trees"
   ↓
2. LLM PROCESSING (ElizaOS)
   LLM: "I should use the chopTree action"
   ↓
3. ACTION SELECTION
   ActionRegistry.findAction("chopTree")
   ↓
4. VALIDATION
   chopTreeAction.validate(runtime, message)
   ├─ Check equipment (has axe?)
   ├─ Check nearby entities (tree nearby?)
   ├─ Check skill level (woodcutting >= 1?)
   └─ Return: true/false
   ↓
5. EXECUTION
   chopTreeAction.handler(runtime, message)
   ├─ Find nearest tree
   ├─ Navigate to tree (pathfinding)
   ├─ Execute chop animation
   ├─ Roll for success (skill-based)
   └─ Update state (logs, XP)
   ↓
6. STATE UPDATE
   RPGStateManager.updateSkill('woodcutting', +10 XP)
   RPGStateManager.addInventoryItem('logs', +1)
   ↓
7. FEEDBACK
   Agent: "I chopped the tree and got 1 log!"
   ↓
8. PROVIDER UPDATE
   Providers refresh context with new state
```

### State Synchronization Flow

```text
┌──────────────────────────────────────────────────────────────┐
│                  State Synchronization Flow                   │
└──────────────────────────────────────────────────────────────┘

Hyperscape World ─────────► WebSocket ─────────► HyperscapeService
                 (events)              (receive)
                                                  ↓
                                            State Manager
                                                  ↓
                                     ┌────────────┴────────────┐
                                     │                         │
                              World State                 RPG State
                               - Entities                 - Inventory
                               - Players                  - Skills
                               - Environment              - Quests
                                     │                         │
                                     └────────────┬────────────┘
                                                  ↓
                                              Providers
                                       (inject into prompts)
                                                  ↓
                                            ElizaOS Agent
                                           (make decisions)
```

---

## Testing Architecture

### Real Testing Philosophy

No mocks - test with real Hyperscape instances:

```typescript
// Setup real test environment
const testRuntime = new TestRuntime({
  plugins: [hyperscapePlugin],
  worldUrl: 'ws://localhost:5555/ws'
});

// Execute real actions
await testRuntime.executeAction('chopTree');

// Verify with visual + state testing
const result = await testFramework.runTest('chopTree', {
  type: 'both',
  visualChecks: [
    { entityType: 'tree', shouldExist: false } // Tree removed
  ],
  stateChecks: [
    { property: 'inventory.logs', expectedValue: 1, operator: 'greater' }
  ]
});
```

---

## Next Steps

- [Tech Stack Details](tech-stack.md)
- [ElizaOS Integration](../04-architecture/elizaos-integration.md)
- [Action System Deep Dive](../04-architecture/action-system.md)

---

[← Back to Index](../README.md) | [← Previous: Features](features.md) | [Next: Tech Stack →](tech-stack.md)
