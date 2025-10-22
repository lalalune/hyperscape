# Installation Guide

[← Back to Index](../README.md)

---

## Prerequisites

Before installing Plugin Hyperscape, ensure you have the following:

### Required Software

- **Node.js**: Version 18.0.0 or higher
- **npm, pnpm, or bun**: Package manager
- **ElizaOS**: Installed globally or in your project

### Recommended

- **Bun**: For faster performance (recommended over Node.js)
- **Git**: For version control
- **VS Code**: Recommended IDE with TypeScript support

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **CPU**: 4 cores recommended
- **OS**: Linux, macOS, or Windows
- **Network**: Stable internet for LLM API calls

---

## Installation Methods

### Method 1: Install in Existing ElizaOS Project (Recommended)

If you already have an ElizaOS project:

```bash
# Navigate to your ElizaOS project
cd my-elizaos-project

# Install the plugin
npm install @hyperscape/plugin-hyperscape

# Or with pnpm
pnpm add @hyperscape/plugin-hyperscape

# Or with bun (fastest)
bun add @hyperscape/plugin-hyperscape
```

### Method 2: Create New ElizaOS Project with Plugin

Start from scratch:

```bash
# Install ElizaOS CLI globally
npm install -g elizaos

# Create new project
elizaos create my-hyperscape-agent

# Navigate to project
cd my-hyperscape-agent

# Install plugin
npm install @hyperscape/plugin-hyperscape
```

### Method 3: Clone and Build from Source

For development or customization:

```bash
# Clone the Hyperscape monorepo
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Navigate to plugin
cd packages/plugin-hyperscape

# Build plugin
pnpm build
```

---

## Post-Installation Setup

### 1. Verify Installation

Check that the plugin is installed correctly:

```bash
# Check package.json
cat package.json | grep plugin-hyperscape

# Expected output:
# "@hyperscape/plugin-hyperscape": "^1.0.0"
```

### 2. Install Hyperscape Server (Optional)

If you want to run a local Hyperscape server:

```bash
# From the monorepo root
cd packages/hyperscape

# Install dependencies
pnpm install

# Start server
pnpm start

# Server runs on ws://localhost:5555/ws
```

### 3. Configure Environment Variables

Create a `.env` file in your project root:

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_HYPERSCAPE_WS_URL=ws://localhost:5555/ws
```

### 4. Create Character Configuration

Create a character file `characters/agent.json`:

```json
{
  "name": "TestAgent",
  "bio": [
    "I am an AI agent exploring the Hyperscape world.",
    "I love to help players and discover new areas."
  ],
  "lore": [
    "Born in the digital realm",
    "Curious about the physical world"
  ],
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "settings": {
    "DEFAULT_HYPERSCAPE_WS_URL": "ws://localhost:5555/ws"
  },
  "modelProvider": "openai",
  "model": "gpt-4"
}
```

---

## Verification

### Test Basic Functionality

Create a test file `test-agent.ts`:

```typescript
import { hyperscapePlugin } from '@hyperscape/plugin-hyperscape';
import { createRuntime } from '@elizaos/core';

async function test() {
  // Load character
  const character = require('./characters/agent.json');

  // Create runtime
  const runtime = await createRuntime({
    character,
    plugins: [hyperscapePlugin]
  });

  console.log('✅ Plugin loaded successfully!');
  console.log('Available actions:', runtime.actions.map(a => a.name));
}

test();
```

Run the test:

```bash
# With Node.js
npx tsx test-agent.ts

# With Bun
bun test-agent.ts
```

Expected output:
```
✅ Plugin loaded successfully!
Available actions: [
  'PERCEPTION',
  'GOTO_ENTITY',
  'USE_ITEM',
  'UNUSE_ITEM',
  'STOP_MOVING',
  'WALK_RANDOMLY',
  ...
]
```

---

## Troubleshooting Installation

### Issue: Module Not Found

**Error**: `Cannot find module '@hyperscape/plugin-hyperscape'`

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript Errors

**Error**: Type errors with ElizaOS interfaces

**Solution**:
```bash
# Ensure TypeScript is installed
npm install -D typescript@latest

# Regenerate tsconfig.json
npx tsc --init

# Update tsconfig.json to include:
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "types": ["node", "@elizaos/core"]
  }
}
```

### Issue: WebSocket Connection Failed

**Error**: `Failed to connect to Hyperscape server`

**Solution**:
```bash
# 1. Check if Hyperscape server is running
curl http://localhost:5555/health

# 2. Verify WebSocket URL in .env
echo $DEFAULT_HYPERSCAPE_WS_URL

# 3. Start Hyperscape server if needed
cd packages/hyperscape
pnpm start
```

### Issue: Missing Dependencies

**Error**: `Peer dependency not met`

**Solution**:
```bash
# Install peer dependencies
npm install @elizaos/core

# Or with --legacy-peer-deps flag
npm install --legacy-peer-deps
```

---

## Optional Dependencies

### For Testing

```bash
# Install Playwright for real-world testing
npm install -D playwright @playwright/test

# Install Playwright browsers
npx playwright install chromium

# Install Vitest for unit tests
npm install -D vitest
```

### For Development

```bash
# Install dev tools
npm install -D \
  @types/node \
  tsx \
  eslint \
  prettier \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin
```

### For Frontend Dashboard

```bash
# Install React dependencies
npm install \
  react \
  react-dom \
  @tanstack/react-query \
  zustand

# Install UI dependencies
npm install -D \
  tailwindcss \
  postcss \
  autoprefixer \
  vite \
  @vitejs/plugin-react
```

---

## Upgrading

### Upgrade to Latest Version

```bash
# Check current version
npm list @hyperscape/plugin-hyperscape

# Upgrade to latest
npm update @hyperscape/plugin-hyperscape

# Or specify version
npm install @hyperscape/plugin-hyperscape@latest
```

### Breaking Changes

When upgrading major versions, check the [Changelog](../15-appendix/changelog.md) for breaking changes.

---

## Next Steps

Now that you've installed the plugin:

1. [Configuration](configuration.md) - Configure the plugin
2. [Quick Start](quick-start.md) - Create your first agent
3. [ElizaOS Setup](elizaos-setup.md) - Integrate with ElizaOS

---

[← Back to Index](../README.md) | [Next: Configuration →](configuration.md)
