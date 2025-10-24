# Technology Stack

[← Back to Index](../README.md)

---

## Complete Technology Stack

Plugin Hyperscape is built with modern, type-safe technologies optimized for AI agent development.

---

## Core Technologies

### ElizaOS Framework

**Version**: Latest
**Purpose**: AI agent framework
**Why**: Industry-standard for building LLM-powered agents

```typescript
Features:
  - Multi-model LLM support (OpenAI, Anthropic, etc.)
  - Memory and context management
  - Plugin architecture
  - Action/Provider/Evaluator system
  - Real-time event handling
```

### TypeScript

**Version**: 5.3+
**Purpose**: Strongly-typed language
**Why**: Type safety, better tooling, scalability

**Strict Configuration**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Code Standards**:
- NO `any` types - all types explicitly defined
- Prefer classes over interfaces for extensibility
- Use non-null assertions (`value!`) when guaranteed
- Share types across modules from `types/` directory

### Node.js / Bun

**Node.js**: 18+
**Bun**: Latest (recommended)
**Purpose**: JavaScript runtime
**Why**: Fast, modern, ESM support

**Performance Comparison**:
```
Bun:    3x faster startup, 2x faster execution
Node:   Mature ecosystem, wider compatibility
```

---

## 3D World Integration

### Hyperscape Engine

**Version**: Latest
**Purpose**: 3D multiplayer game engine
**Technologies**: Three.js, WebSocket, ECS architecture

**Features Used**:
```typescript
- 3D rendering (Three.js)
- Real-time synchronization (WebSocket)
- Entity-Component-System (ECS)
- RPG systems (skills, inventory, combat)
- Spatial queries (proximity, line-of-sight)
- Pathfinding (navigation meshes)
```

### Three.js

**Version**: 0.178+
**Purpose**: 3D graphics library
**Why**: Industry standard for WebGL

**Usage in Plugin**:
```typescript
// Visual testing with Three.js scene introspection
const scene = world.getScene();
const entities = scene.children.filter(obj => obj.userData.type === 'tree');
```

### WebSocket Protocol

**Implementation**: Native WebSocket
**Purpose**: Real-time bidirectional communication
**Protocol**: Custom Hyperscape protocol

**Message Types**:
```typescript
// Client → Server
{
  type: 'action',
  action: 'chopTree',
  targetId: 'tree-123'
}

// Server → Client
{
  type: 'stateUpdate',
  playerId: 'agent-456',
  position: { x: 10, y: 0, z: 5 },
  inventory: [...]
}
```

---

## Testing Technologies

### Playwright

**Version**: Latest
**Purpose**: Browser automation
**Why**: Real browser testing, screenshot capture

**Usage**:
```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000');

// Execute gameplay
await page.evaluate(() => {
  window.game.agent.chopTree();
});

// Verify visually
const screenshot = await page.screenshot();
```

### Vitest

**Version**: Latest
**Purpose**: Testing framework
**Why**: Fast, ESM-native, TypeScript support

**Configuration**:
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});
```

### Cypress

**Version**: Latest
**Purpose**: E2E testing
**Why**: Visual testing, time-travel debugging

**Example Test**:
```typescript
describe('Agent Actions', () => {
  it('should chop tree and gain XP', () => {
    cy.visit('http://localhost:3000');
    cy.get('[data-testid="agent"]').should('be.visible');

    // Execute action
    cy.window().then((win) => {
      win.agent.chopTree();
    });

    // Verify result
    cy.get('[data-testid="xp-bar"]').should('contain', '+10 XP');
  });
});
```

---

## Frontend Technologies

### React

**Version**: 19.2+
**Purpose**: UI framework for dashboard
**Why**: Component-based, wide adoption

**Components**:
```typescript
- AgentStatusPanel
- WorldMapView
- ActionHistory
- InventoryPanel
- SkillsPanel
- LogsPanel
```

### Tailwind CSS

**Version**: 3.3+
**Purpose**: Styling
**Why**: Utility-first, rapid development

**Configuration**:
```javascript
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hyperscape: '#3B82F6'
      }
    }
  }
};
```

---

## Build Tools

### Vite

**Version**: 6.0+
**Purpose**: Build tool and dev server
**Why**: Fast HMR, optimized builds

**Configuration**:
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild'
  }
});
```

### ESLint

**Version**: Latest
**Purpose**: Code quality
**Why**: Catch errors, enforce standards

**Rules**:
```javascript
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error'
  }
};
```

---

## Development Tools

### pnpm / npm / bun

**Package Manager**: pnpm (recommended), npm, or bun
**Why**: Workspace support, fast installs

**Workspace Structure**:
```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

### Git

**Version Control**: Git
**Hosting**: GitHub
**Why**: Standard version control

**Branch Strategy**:
```
main        - Production-ready code
develop     - Development branch
feature/*   - Feature branches
fix/*       - Bug fix branches
```

---

## AI/LLM Integration

### OpenAI

**Models**: GPT-4, GPT-4-turbo, GPT-3.5-turbo
**Purpose**: Agent decision-making
**Why**: Best-in-class reasoning

**Usage**:
```typescript
// ElizaOS handles LLM calls
const response = await runtime.generateResponse({
  context: worldContext,
  action: 'decide_next_action'
});
```

### Anthropic Claude

**Models**: Claude 3 Opus, Sonnet, Haiku
**Purpose**: Alternative LLM provider
**Why**: Strong reasoning, longer context

### Local LLMs

**Supported**: Ollama, LM Studio
**Models**: Llama 3, Mistral, etc.
**Why**: Privacy, cost savings, offline operation

---

## Data Persistence

### JSON Files

**Purpose**: Configuration, character definitions
**Why**: Simple, human-readable

**Example**:
```json
{
  "name": "ExplorerAgent",
  "bio": ["I explore worlds"],
  "behaviors": ["explore", "gather"]
}
```

### SQLite (Hyperscape)

**Purpose**: World state persistence (server-side)
**Why**: Lightweight, reliable, SQL queries

### Memory (ElizaOS)

**Purpose**: Agent memory and context
**Storage**: Vector database (Pinecone, Chroma, etc.)

---

## Monitoring & Logging

### Winston Logger

**Purpose**: Structured logging
**Why**: Configurable, multiple transports

**Configuration**:
```typescript
import { logger } from '@elizaos/core';

logger.info('Agent action executed', {
  action: 'chopTree',
  result: 'success',
  xp: 10
});
```

### Log Levels

```typescript
Levels:
  - error:   Critical errors
  - warn:    Warnings
  - info:    General information
  - debug:   Detailed debugging
  - trace:   Ultra-verbose tracing
```

---

## Security

### Environment Variables

**Purpose**: Secure configuration
**Tool**: dotenv

```bash
# .env file
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
HYPERSCAPE_WS_URL=ws://localhost:5555/ws
```

### Input Validation

**Tool**: Zod
**Purpose**: Runtime type checking

```typescript
import { z } from 'zod';

const actionSchema = z.object({
  type: z.enum(['chopTree', 'catchFish', 'lightFire']),
  targetId: z.string().optional()
});

const validated = actionSchema.parse(input);
```

---

## Deployment

### Docker

**Purpose**: Containerization
**Why**: Consistent environments

**Dockerfile**:
```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
CMD ["bun", "start"]
```

### PM2

**Purpose**: Process management
**Why**: Auto-restart, clustering

```bash
pm2 start elizaos --name agent1
pm2 scale agent1 4  # Run 4 instances
```

---

## Version Requirements

### Minimum Versions

| Technology | Minimum Version | Recommended |
|-----------|-----------------|-------------|
| Node.js | 18.0.0 | 20.x LTS |
| Bun | 1.0.0 | Latest |
| TypeScript | 5.0.0 | 5.3+ |
| ElizaOS | 0.1.0 | Latest |
| Playwright | 1.40.0 | Latest |
| React | 18.0.0 | 19.2+ |

### Browser Requirements (for Playwright)

- Chrome/Chromium: 120+
- Firefox: 115+
- WebKit: Latest

---

## Performance Characteristics

### Memory Usage

```
Single Agent:     ~100-200 MB
5 Agents:         ~500-800 MB
10 Agents:        ~1-1.5 GB

Recommended:      4GB RAM minimum
Optimal:          8GB+ RAM
```

### CPU Usage

```
Idle Agent:       ~1-2% CPU
Active Agent:     ~5-10% CPU
LLM Calls:        Spikes to ~30-50%

Recommended:      4+ cores
```

### Network Usage

```
WebSocket:        ~10-50 KB/s per agent
LLM API calls:    ~1-10 KB per request
Screenshots:      ~500 KB - 2 MB each

Bandwidth:        1 Mbps per 10 agents
```

---

## Next Steps

- [Installation Guide](../02-getting-started/installation.md)
- [Quick Start](../02-getting-started/quick-start.md)
- [Development Setup](../11-development/setup-guide.md)

---

[← Back to Index](../README.md) | [← Previous: Architecture](architecture.md) | [Next: Getting Started →](../02-getting-started/installation.md)
