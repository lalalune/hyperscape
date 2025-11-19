# ElizaOS Architecture and Components Memory

Complete reference for plugin architecture, component lifecycle, and development workflow in ElizaOS.

## Plugin Architecture

### Plugin Interface

**Core Structure:**
```typescript
interface Plugin {
  name: string;                    // REQUIRED - Unique identifier
  description: string;              // REQUIRED - What the plugin does
  init?: (config, runtime) => Promise<void>; // Optional initialization
  actions?: Action[];              // What agent can DO
  providers?: Provider[];           // Context suppliers
  evaluators?: Evaluator[];        // Decision helpers
  services?: Service[];             // Persistent connections
  config?: object;                 // Configuration settings
  databaseAdapter?: DatabaseAdapter; // Optional DB adapter
  modelHandlers?: ModelHandler[];   // Optional model handlers
  routes?: Route[];                 // HTTP endpoints
  eventHandlers?: EventHandler[];   // Event listeners
  dependencies?: string[];          // Required plugins
  priority?: number;                // Loading order
}
```

**Key Points:**
- `name` and `description` are REQUIRED
- All other fields are optional
- Components are arrays (can have multiple)
- `init` runs during plugin registration
- `priority` controls loading order (higher = loads first)

### Plugin Initialization Lifecycle

**CRITICAL ORDER** - Components register in this exact sequence:

1. **Database Adapter** (if provided)
2. **Actions** ← Register here
3. **Evaluators**
4. **Providers** ← Register here
5. **Models**
6. **Routes**
7. **Events**
8. **Services** (delayed if runtime not initialized)

**Why Order Matters:**
- Actions may depend on database adapter
- Providers may use actions for context
- Services initialize before components use them
- Breaking order causes initialization failures

### Plugin Registration Process

1. **Validation**: Plugin must have a name
2. **Duplicate Check**: No duplicate plugins allowed
3. **Add to Active List**: Registered in runtime
4. **Call init()**: If present, initialization logic runs
5. **Handle Errors**: Configuration errors handled gracefully

### Plugin Priority System

**Priority Rules:**
- Higher priority = loads first
- Useful for fundamental services (database, bootstrap)
- Model handlers use priority to determine provider
- Default priority: 0

**Example:**
```typescript
export const myPlugin: Plugin = {
  name: 'high-priority-plugin',
  priority: 100, // Loads before lower priority plugins
};
```

### Plugin Dependencies

**Dependency System:**
```typescript
export const myPlugin: Plugin = {
  name: 'my-plugin',
  dependencies: ['@elizaos/plugin-sql', '@elizaos/plugin-bootstrap'],
  testDependencies: ['@elizaos/plugin-test-utils'],
};
```

**Key Points:**
- Runtime ensures dependencies load first
- Circular dependencies are detected
- Missing dependencies cause errors
- Test dependencies only load in test environment

### Plugin Configuration

**Three Configuration Methods:**

1. **Environment Variables:**
```typescript
init: async (config, runtime) => {
  const apiKey = runtime.getSetting('MY_API_KEY');
  if (!apiKey) {
    throw new Error('MY_API_KEY not configured');
  }
}
```

2. **Config Object:**
```typescript
export const myPlugin: Plugin = {
  name: 'my-plugin',
  config: {
    defaultTimeout: 5000,
    retryAttempts: 3,
  },
};
```

3. **Runtime Settings:**
```typescript
const value = runtime.getSetting('SETTING_NAME');
```

**Best Practices:**
- Use `runtime.getSetting()` for consistent access
- Validate configuration in `init()`
- Handle missing config gracefully
- Document required settings

### Conditional Plugin Loading

**Pattern:** Load plugins based on environment variables

```typescript
const plugins = [
  '@elizaos/plugin-bootstrap', // Always loaded
  ...(process.env.ANTHROPIC_API_KEY ? ['@elizaos/plugin-anthropic'] : []),
  ...(process.env.OPENAI_API_KEY ? ['@elizaos/plugin-openai'] : []),
  ...(process.env.DISCORD_API_TOKEN ? ['@elizaos/plugin-discord'] : []),
];
```

## Component Types

### Component Overview

| Component      | Purpose                            | When Executed                     |
| -------------- | ---------------------------------- | --------------------------------- |
| **Actions**    | Tasks agents can perform           | When agent decides to take action |
| **Providers**  | Supply contextual data             | Before actions/decisions          |
| **Evaluators** | Process and extract from responses | After agent generates response    |
| **Services**   | Manage stateful connections        | Throughout agent lifecycle        |

### Actions

**Purpose:** What agents can DO

**Interface:**
```typescript
interface Action {
  name: string;                    // REQUIRED - Unique identifier
  description: string;             // REQUIRED - What action does
  similes?: string[];              // Alternative names for matching
  examples?: ActionExample[][];    // Training examples
  validate: (runtime, message, state) => Promise<boolean>;
  handler: (runtime, message, state, options, callback) => Promise<ActionResult>;
}
```

**Core Actions (Bootstrap Plugin):**
- Communication: REPLY, SEND_MESSAGE, NONE, IGNORE
- Room Management: FOLLOW_ROOM, UNFOLLOW_ROOM, MUTE_ROOM, UNMUTE_ROOM
- Data & Config: UPDATE_CONTACT, UPDATE_ROLE, UPDATE_SETTINGS
- Media & Utilities: GENERATE_IMAGE, CHOICE

**Key Points:**
- Must return ActionResult with `success` field
- `validate` should be fast and deterministic
- `handler` executes the action logic
- `examples` train LLM when to use action

### Providers

**Purpose:** Supply contextual data to agent

**Interface:**
```typescript
interface Provider {
  name: string;                    // REQUIRED - Unique identifier
  description?: string;            // Optional explanation
  dynamic?: boolean;               // true = re-fetched each time
  position?: number;               // Execution order (-100 to 100)
  private?: boolean;                // Hide from provider list
  get: (runtime, message, state?) => Promise<ProviderResult>;
}

interface ProviderResult {
  text: string;                    // Formatted for LLM
  values?: Record<string, unknown>; // Structured data for templates
  data?: Record<string, unknown>;   // Raw data for processing
}
```

**Core Providers (Bootstrap Plugin):**
- characterProvider - Agent personality
- timeProvider - Current date/time
- knowledgeProvider - Knowledge base
- recentMessagesProvider - Chat history
- actionsProvider - Available actions
- factsProvider - Stored facts
- settingsProvider - Configuration

**Key Points:**
- `dynamic: true` for real-time data (never cached)
- `position` controls execution order (lower = runs first)
- `private: true` hides from default provider list
- Always return ProviderResult with text, values, data

### Evaluators

**Purpose:** Process and extract information from responses

**Interface:**
```typescript
interface Evaluator {
  name: string;                    // REQUIRED - Unique identifier
  description: string;             // What it evaluates/extracts
  similes?: string[];              // Alternative names
  alwaysRun?: boolean;              // Run on every response
  examples?: EvaluatorExample[];   // Training examples
  validate: (runtime, message, state) => Promise<boolean>;
  handler: (runtime, message, state) => Promise<any>;
}
```

**Core Evaluators (Bootstrap Plugin):**
- reflectionEvaluator - Self-awareness
- factEvaluator - Fact extraction
- goalEvaluator - Goal tracking

**Key Points:**
- Run AFTER agent generates response
- Extract information for memory storage
- Use `alwaysRun: true` sparingly
- Store extracted data for future context

**Common Use Cases:**
- Memory building (extract facts, track preferences)
- Content filtering (remove sensitive data, validate)
- Analytics (track sentiment, measure engagement)

### Services

**Purpose:** Manage stateful connections and persistent functionality

**Abstract Class:**
```typescript
abstract class Service {
  static serviceType: string;      // REQUIRED - Service identifier
  capabilityDescription: string;   // What service provides
  protected runtime: IAgentRuntime;
  
  static async start(runtime: IAgentRuntime): Promise<Service>;
  async stop(): Promise<void>;     // Cleanup resources
}
```

**Service Types:**
- TRANSCRIPTION, VIDEO, BROWSER, PDF
- REMOTE_FILES (AWS S3)
- WEB_SEARCH, EMAIL, TEE
- TASK, WALLET, LP_POOL, TOKEN_DATA
- DATABASE_MIGRATION
- PLUGIN_MANAGER, PLUGIN_CONFIGURATION, PLUGIN_USER_INTERACTION

**Key Points:**
- Singleton instances (one per runtime)
- Persist throughout agent lifecycle
- Handle missing API tokens gracefully
- Implement proper cleanup in `stop()`
- Use delayed initialization for non-critical tasks

**Lifecycle:**
1. `start()` - Initialize and connect
2. Runtime operation - Provide functionality
3. `stop()` - Cleanup and disconnect

## Component Interaction

### Execution Flow

1. **Providers** gather context → compose state
2. **Actions** validate against state → execute if valid
3. **Evaluators** process responses → extract information
4. **Services** provide persistent functionality throughout

### State Composition

```typescript
// Providers contribute to state
const state = await runtime.composeState(message, [
  'RECENT_MESSAGES',
  'CHARACTER',
  'KNOWLEDGE'
]);

// Actions receive composed state
const result = await action.handler(runtime, message, state);

// Evaluators process with full context
await evaluator.handler(runtime, message, state);
```

### Service Access

```typescript
// Actions and providers can access services
const service = runtime.getService<MyService>('my-service');
const data = await service.getData();
```

## Development Workflow

### Plugin Scaffolding

**Using CLI:**
```bash
elizaos create my-plugin --type plugin
```

**Two Templates:**
1. **Quick Plugin (Backend Only)** - Simple backend plugin
   - Actions, providers, services
   - No frontend components
   - Perfect for API integrations, blockchain actions

2. **Full Plugin (with Frontend)** - Complete plugin with React
   - Everything from Quick Plugin
   - React frontend, Vite setup
   - API routes, Tailwind CSS
   - Perfect for plugins needing web UI

**After Scaffolding:**
```bash
cd plugin-my-plugin
bun install
elizaos dev        # Development mode with hot reloading
elizaos start      # Production mode
bun run build      # Build for distribution
```

### Manual Plugin Creation

**Steps:**
1. Initialize project: `bun init`
2. Install dependencies: `bun add @elizaos/core`
3. Configure TypeScript: `tsconfig.json`
4. Configure build: `tsup.config.ts`
5. Create plugin structure: `src/index.ts`
6. Update `package.json` with scripts

### Using Plugins in Projects

**Option 1: Plugin Inside Monorepo**
```json
{
  "dependencies": {
    "@yourorg/plugin-myplugin": "workspace:*"
  }
}
```

**Option 2: Plugin Outside Monorepo**
```bash
# In plugin directory
bun link

# In project directory
bun link @yourorg/plugin-myplugin
```

## Testing

### Test Structure

```
src/
  __tests__/
    test-utils.ts         # Shared utilities and mocks
    index.test.ts         # Main plugin tests
    actions.test.ts       # Action tests
    providers.test.ts      # Provider tests
    evaluators.test.ts    # Evaluator tests
    services.test.ts      # Service tests
```

### Test Utilities

**Create Mock Runtime:**
```typescript
export function createMockRuntime(overrides?: Partial<MockRuntime>): MockRuntime {
  return {
    agentId: 'test-agent-123' as UUID,
    character: { name: 'TestAgent', bio: 'A test agent' },
    getSetting: mock((key: string) => settings[key]),
    useModel: mock(async () => ({ content: 'Mock response' })),
    composeState: mock(async () => ({ values: {}, data: {} })),
    createMemory: mock(async () => ({ id: 'memory-123' })),
    getMemories: mock(async () => []),
    getService: mock(() => null),
    ...overrides,
  };
}
```

### Testing Actions

**Key Tests:**
- Validation logic (should validate when requirements met)
- Handler execution (should return ActionResult)
- Error handling (should handle errors gracefully)
- Action chaining (should access previous results)
- Examples structure (should have valid example format)

### Testing Providers

**Key Tests:**
- Return ProviderResult (text, values, data)
- Handle errors gracefully
- Dynamic providers fetch fresh data
- Position ordering works correctly

### Testing Services

**Key Tests:**
- Initialize successfully with valid config
- Throw error without required config
- Clean up resources on stop
- Handle missing API tokens gracefully

### E2E Testing

**Pattern:**
```typescript
export const myPluginE2ETests = {
  name: 'MyPlugin E2E Tests',
  tests: [{
    name: 'should execute full plugin flow',
    fn: async (runtime: IAgentRuntime) => {
      // Create test message
      // Compose state
      // Execute action
      // Verify result
      // Verify side effects
    }
  }]
};
```

## Routes

**Route Interface:**
```typescript
interface Route {
  type: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'STATIC';
  path: string;
  filePath?: string;        // For static files
  public?: boolean;         // Public access
  name?: string;            // Route name
  handler?: (req, res, runtime) => Promise<void>;
  isMultipart?: boolean;    // File uploads
}
```

**Example:**
```typescript
routes: [{
  name: 'hello-world-route',
  path: '/helloworld',
  type: 'GET',
  handler: async (_req, res) => {
    res.json({ message: 'Hello World!' });
  }
}]
```

## Event System

### Event Types

**Standard Events:**
- World: WORLD_JOINED, WORLD_CONNECTED, WORLD_LEFT
- Entity: ENTITY_JOINED, ENTITY_LEFT, ENTITY_UPDATED
- Room: ROOM_JOINED, ROOM_LEFT
- Message: MESSAGE_RECEIVED, MESSAGE_SENT, MESSAGE_DELETED
- Voice: VOICE_MESSAGE_RECEIVED, VOICE_MESSAGE_SENT
- Run: RUN_STARTED, RUN_ENDED, RUN_TIMEOUT
- Action/Evaluator: ACTION_STARTED/COMPLETED, EVALUATOR_STARTED/COMPLETED
- Model: MODEL_USED

### Event Handlers

```typescript
export type PluginEvents = {
  [K in keyof EventPayloadMap]?: EventHandler<K>[];
} & {
  [key: string]: ((params: any) => Promise<any>)[];
};
```

## Database Adapters

**Interface:** IDatabaseAdapter (extensive interface)

**Methods Include:**
- Agents, Entities, Components
- Memories (with embeddings)
- Rooms, Participants
- Relationships
- Tasks
- Caching
- Logs

**Example:**
```typescript
export const plugin: Plugin = {
  name: '@elizaos/plugin-sql',
  priority: 0,
  init: async (_, runtime) => {
    const dbAdapter = createDatabaseAdapter(config, runtime.agentId);
    runtime.registerDatabaseAdapter(dbAdapter);
  }
};
```

## Best Practices

### Plugin Development
1. Use `dependencies` array for required plugins
2. Check environment variables before loading platform plugins
3. Handle missing API tokens gracefully in services
4. Keep event handlers focused
5. Use try-catch blocks and log errors
6. Use TypeScript types from `@elizaos/core`
7. Set appropriate priorities for early-loading plugins
8. Use `runtime.getSetting()` for configuration

### Component Development
1. **Actions**: Always return ActionResult, validate before executing
2. **Providers**: Return consistent structures, handle errors gracefully
3. **Evaluators**: Run async, store extracted data, use `alwaysRun` sparingly
4. **Services**: Handle missing tokens, implement cleanup, make resilient

### Testing
1. Test in isolation with mocks
2. Test happy path and errors
3. Test validation logic
4. Test examples structure
5. Test side effects
6. Use descriptive test names
7. Keep tests fast
8. Test public API

## Documentation References

- **Plugin Architecture**: https://docs.elizaos.ai/plugins/architecture
- **Plugin Components**: https://docs.elizaos.ai/plugins/components
- **Plugin Development**: https://docs.elizaos.ai/plugins/development
- **Plugin Patterns**: https://docs.elizaos.ai/plugins/patterns
- **Plugin Reference**: https://docs.elizaos.ai/plugins/reference

