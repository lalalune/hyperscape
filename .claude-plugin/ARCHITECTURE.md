# Hyperscape Development Plugin Architecture

**Version 2.0.0** - Comprehensive architectural overview of the Claude Code plugin for Hyperscape development.

## Table of Contents

- [Overview](#overview)
- [Component Architecture](#component-architecture)
- [MCP Server Design](#mcp-server-design)
- [Agent System](#agent-system)
- [Command System](#command-system)
- [Hook System](#hook-system)
- [Data Flow](#data-flow)
- [Integration Points](#integration-points)
- [Performance Considerations](#performance-considerations)
- [Security Model](#security-model)

## Overview

The Hyperscape Development Plugin is a comprehensive Claude Code extension that provides specialized tools, agents, commands, and hooks for developing AI-powered 3D multiplayer RPG games using Hyperscape and ElizaOS.

### Design Principles

1. **Real-World Testing** - No mocks, no spies, only real Hyperscape instances
2. **Strong Typing** - Zero tolerance for `any`/`unknown` types
3. **Visual Verification** - Multimodal testing with data + screenshots
4. **Modular Design** - Self-contained components with clear interfaces
5. **Performance First** - Caching, optimization, and monitoring built-in

### Technology Stack

```
┌─────────────────────────────────────────────────┐
│           Claude Code (Host)                    │
├─────────────────────────────────────────────────┤
│  Hyperscape Development Plugin v2.0             │
│  ├─ MCP Server (Node.js, TypeScript)           │
│  ├─ Slash Commands (Markdown)                   │
│  ├─ AI Agents (Markdown with frontmatter)       │
│  ├─ Hooks (Bash scripts)                        │
│  └─ Memory Tools (TypeScript + Claude API)      │
├─────────────────────────────────────────────────┤
│  Hyperscape Engine (Three.js, WebSocket)        │
│  ElizaOS (AI Agent Framework)                   │
│  Playwright (Browser Automation)                │
└─────────────────────────────────────────────────┘
```

## Component Architecture

### Directory Structure

```
.claude-plugin/
├── plugin.json                 # Plugin manifest
├── marketplace.json            # Marketplace configuration
├── README.md                   # Main documentation
├── INSTALL.md                  # Installation guide
├── USAGE.md                    # Usage guide
├── ARCHITECTURE.md            # This file
├── CHANGELOG.md                # Version history
│
├── commands/                   # Slash commands
│   ├── test-rpg.md            # Test RPG actions
│   ├── test-visual.md         # Visual tests
│   ├── run-agent.md           # Launch test agent
│   ├── check-types.md         # Type validation
│   ├── build-plugin.md        # Build workflow
│   ├── create-action.md       # Action scaffolding
│   ├── analyze-errors.md      # Error analysis
│   └── extract-memories.md    # Memory extraction
│
├── agents/                     # AI agents
│   ├── rpg-action-developer.md      # RPG action specialist
│   ├── hyperscape-test-engineer.md  # Testing specialist
│   ├── typescript-enforcer.md       # Type validator
│   └── visual-test-analyst.md       # Visual testing expert
│
├── hooks/                      # Event hooks
│   ├── validate-write.sh      # Pre-write validation
│   ├── validate-types.sh      # Pre-commit type check
│   ├── pre-commit.sh          # Pre-commit checks
│   └── post-test.sh           # Post-test collection
│
├── mcp/                        # MCP server
│   ├── package.json
│   ├── tsconfig.json
│   ├── dist/
│   │   └── server.js          # Built server
│   └── src/
│       ├── server.ts          # Main server
│       └── __tests__/         # Server tests
│
├── memory-tools/               # Memory extraction
│   ├── package.json
│   ├── tsconfig.json
│   ├── dist/
│   └── src/
│       ├── extractor.ts       # Memory extractor
│       └── enhanced.ts        # Enhanced extractor
│
└── scripts/                    # Utility scripts
    ├── validate-plugin.sh     # Plugin validation
    └── setup-test-env.sh      # Test environment setup
```

## MCP Server Design

### Architecture

The MCP (Model Context Protocol) server provides 9 specialized tools for Hyperscape development. It's built with:

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.9+
- **Protocol**: MCP SDK 1.0.4
- **Transport**: stdio (standard input/output)

### Tool Categories

```typescript
interface MCPTools {
  // Type validation
  hyperscape_validate_types: TypeValidationTool;

  // Testing
  hyperscape_run_visual_test: VisualTestTool;

  // Code generation
  hyperscape_generate_action: ActionGeneratorTool;

  // Analysis
  hyperscape_analyze_logs: LogAnalysisTool;

  // State queries
  hyperscape_get_world_state: WorldStateTool;
  hyperscape_check_rpg_state: RPGStateTool;

  // Performance
  hyperscape_get_metrics: MetricsTool;
  hyperscape_clear_cache: CacheTool;
  hyperscape_health_check: HealthCheckTool;
}
```

### Caching Strategy

```typescript
interface CacheConfig {
  type_validation: {
    ttl: 60000,      // 1 minute
    key: "path"
  },
  log_analysis: {
    ttl: 30000,      // 30 seconds
    key: "logType"
  },
  world_state: {
    ttl: 5000,       // 5 seconds
    key: "worldId"
  },
  rpg_state: {
    ttl: 10000,      // 10 seconds
    key: "playerId"
  }
}
```

### Error Handling

```typescript
class MCPError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// Error codes
const ErrorCodes = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  TEST_EXECUTION_FAILED: "TEST_EXECUTION_FAILED",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  WORLD_NOT_RUNNING: "WORLD_NOT_RUNNING",
  CACHE_ERROR: "CACHE_ERROR"
};
```

## Agent System

### Agent Architecture

AI agents are specialized Claude instances with domain expertise, defined in markdown files with YAML frontmatter.

```yaml
---
name: agent-name
description: When and how to use this agent
color: blue
model: opus
---

# Agent Definition (Markdown)
```

### Agent Specializations

#### 1. RPG Action Developer
- **Domain**: ElizaOS action implementation
- **Model**: Opus (complex code generation)
- **Triggers**: Action creation, ElizaOS patterns, skill systems

#### 2. Hyperscape Test Engineer
- **Domain**: Real-world testing with Playwright
- **Model**: Opus (complex test design)
- **Triggers**: Test creation, visual verification, mini-worlds

#### 3. TypeScript Enforcer
- **Domain**: Strong typing validation
- **Model**: Sonnet (fast type checking)
- **Triggers**: Type violations, code review, refactoring

#### 4. Visual Test Analyst
- **Domain**: Screenshot analysis, colored cube detection
- **Model**: Opus (visual reasoning)
- **Triggers**: Visual testing, ColorDetector usage, LLM verification

### Agent Invocation Flow

```
User Request
    ↓
Claude Code evaluates context
    ↓
Matches agent description/examples
    ↓
Invokes specialized agent
    ↓
Agent provides domain-specific response
    ↓
Claude Code integrates response
```

## Command System

### Command Structure

Slash commands are markdown files with frontmatter configuration:

```yaml
---
description: Command description
allowed-tools:
  - Tool(pattern)
  - Tool(pattern)
argument-hint: "Usage hint"
model: opus | sonnet
thinking: true | false
---

Command implementation (natural language)
```

### Command Categories

1. **Testing Commands**
   - `/test-rpg` - Run RPG action tests
   - `/test-visual` - Visual verification tests
   - `/run-agent` - Launch test agent

2. **Development Commands**
   - `/create-action` - Scaffold new action
   - `/build-plugin` - Build workflow
   - `/check-types` - Type validation

3. **Analysis Commands**
   - `/analyze-errors` - Error log analysis
   - `/extract-memories` - Memory extraction

### Tool Permissions

Commands specify allowed tools for security:

```yaml
allowed-tools:
  - Read(packages/plugin-hyperscape/src/**/*.ts)
  - Write(packages/plugin-hyperscape/src/actions/*.ts)
  - Bash(cd packages/plugin-hyperscape*)
  - Bash(bun test *)
  - Grep(packages/plugin-hyperscape/src/**)
```

## Hook System

### Hook Types

```typescript
interface Hooks {
  // Before tool execution
  PreToolUse: {
    Write: ValidationHook;
    Edit: ValidationHook;
  };

  // After tool execution
  PostToolUse: {
    Bash: CollectionHook;
  };

  // Session lifecycle
  SessionStart: WelcomeHook;
  SessionEnd: CleanupHook;
}
```

### Hook Configuration

```json
{
  "PreToolUse": {
    "Write": {
      "command": "bash",
      "args": ["hooks/validate-write.sh", "${filePath}"],
      "description": "Validate file writes",
      "timeout": 5000
    }
  }
}
```

### Hook Execution Flow

```
Tool Invocation
    ↓
PreToolUse hook (if configured)
    ↓ (success)
Tool Execution
    ↓
PostToolUse hook (if configured)
    ↓
Return result to user
```

## Data Flow

### Type Validation Flow

```
User: /check-types
    ↓
Command loads with allowed-tools
    ↓
Claude invokes MCP tool: hyperscape_validate_types
    ↓
MCP Server:
  1. Check cache (1min TTL)
  2. If miss: grep for violations
  3. Parse results
  4. Cache results
  5. Return formatted output
    ↓
Claude formats for user
```

### Visual Test Flow

```
User: /test-visual fishing
    ↓
Command invokes Playwright test
    ↓
Test creates mini-world with proxies
    ↓
Hyperscape renders colored cubes
    ↓
Screenshot captured
    ↓
ColorDetector analyzes image
    ↓
Both data + visual verified
    ↓
PostToolUse hook collects logs
    ↓
Results returned to user
```

### Action Creation Flow

```
User: /create-action mineRock
    ↓
Agent: rpg-action-developer
    ↓
Reads existing actions for patterns
    ↓
Generates action file:
  - ElizaOS Action interface
  - TypeScript types (no any/unknown)
  - validate() and handler()
  - examples array
    ↓
Generates test file:
  - Real world tests
  - Visual proxies
  - Data verification
    ↓
Updates index.ts exports
    ↓
Updates package.json
    ↓
PreToolUse hooks validate writes
    ↓
Files created
```

## Integration Points

### Hyperscape Integration

```typescript
interface HyperspaceConnection {
  // WebSocket connection
  ws: WebSocket;
  url: string;

  // World state
  getWorldState(): Promise<WorldState>;
  getEntityState(id: string): Promise<EntityState>;

  // Actions
  executeAction(action: string, params: ActionParams): Promise<boolean>;

  // Events
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}
```

### ElizaOS Integration

```typescript
interface ElizaOSAction {
  name: string;
  similes: string[];
  description: string;

  validate(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<boolean>;

  handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean>;

  examples: ConversationExample[][];
}
```

### Playwright Integration

```typescript
interface PlaywrightTestWorld {
  // Browser automation
  page: Page;
  browser: Browser;

  // World management
  start(): Promise<void>;
  stop(): Promise<void>;

  // Entity creation
  createEntity(config: EntityConfig): Entity;
  removeEntity(id: string): void;

  // Action execution
  executeAction(action: string, params: ActionParams): Promise<void>;

  // State queries
  getState(): Promise<WorldState>;
  entityExists(id: string): Promise<boolean>;
}
```

## Performance Considerations

### Caching Strategy

1. **Type Validation** - 1 minute TTL (code changes infrequently)
2. **Log Analysis** - 30 second TTL (logs accumulate slowly)
3. **World State** - 5 second TTL (game state changes quickly)
4. **RPG State** - 10 second TTL (player state changes moderately)

### Memory Management

```typescript
interface MemoryLimits {
  max_cache_size: 50 * 1024 * 1024,  // 50MB
  max_log_size: 10 * 1024 * 1024,     // 10MB per log
  max_screenshot_size: 5 * 1024 * 1024, // 5MB per screenshot
  cache_cleanup_interval: 60000        // 1 minute
}
```

### Optimization Techniques

1. **Lazy Loading** - Load agents/commands only when needed
2. **Incremental Updates** - Only rebuild changed modules
3. **Parallel Execution** - Run independent tests in parallel
4. **Streaming Results** - Stream large outputs instead of buffering
5. **Resource Pooling** - Reuse browser instances across tests

## Security Model

### Permission System

```typescript
interface Permissions {
  filesystem: {
    read: string[];    // Glob patterns for read access
    write: string[];   // Glob patterns for write access
    deny: string[];    // Explicit denials
  };

  commands: {
    allow: string[];   // Allowed bash commands
    deny: string[];    // Explicit denials
  };
}
```

### Security Rules

1. **No Node Modules** - Cannot write to node_modules/
2. **No Sensitive Files** - Cannot read .env, credentials.json
3. **No Destructive Commands** - No `rm -rf`, `sudo`
4. **No External Network** - No `curl`, `wget` (except in tests)
5. **Timeout Enforcement** - All hooks have 5-10s timeouts

### Validation Pipeline

```
User Request
    ↓
Permission Check (allowed-tools)
    ↓
PreToolUse Hook Validation
    ↓
Tool Execution (sandboxed)
    ↓
PostToolUse Hook Collection
    ↓
Result Return
```

## Future Enhancements

### Roadmap v2.1

- [ ] OAuth authentication for external APIs
- [ ] WebSocket MCP transport for real-time updates
- [ ] Resource @-mention support
- [ ] Tool annotations for better discoverability
- [ ] Advanced telemetry and analytics dashboard

### Roadmap v3.0

- [ ] Multi-player test orchestration
- [ ] Visual regression testing
- [ ] Performance profiling integration
- [ ] CI/CD pipeline integration
- [ ] Plugin marketplace submission

## References

- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Hyperscape Engine](../packages/hyperscape/README.md)
- [ElizaOS Framework](../packages/plugin-hyperscape/README.md)
- [Plugin Usage Guide](USAGE.md)

---

**Last Updated**: 2025-01-15
**Version**: 2.0.0
**Maintainer**: Hyperscape Team
