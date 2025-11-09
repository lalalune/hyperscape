
# Hyperscape Project - Complete Context Reference

This document consolidates all rules, documentation, hooks, and sub-agents needed to work effectively on the Hyperscape project.

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Rules & Standards](#rules--standards)
3. [Documentation](#documentation)
4. [Architecture & Tech Stack](#architecture--tech-stack)
5. [Key Packages](#key-packages)
6. [ElizaOS Integration](#elizaos-integration)
7. [Testing Framework](#testing-framework)
8. [Development Workflow](#development-workflow)
9. [API Specifications](#api-specifications)
10. [Configuration & Environment](#configuration--environment)

---

## Project Overview

**Hyperscape** is an AI-generated RuneScape-style MMORPG built on a 3D multiplayer game engine. It features:
- Real-time multiplayer gameplay
- AI agent integration via ElizaOS
- Complete RPG systems (combat, skills, inventory, banking)
- Visual testing framework with Playwright
- No mocks - all real gameplay testing

### Quick Start
```bash
npm install
npm run build
npm start
# Open http://localhost:5555
```

---

## Rules & Standards

### 1. TypeScript Strong Typing (`no-any-quick-reference.mdc`)
- **NO `any` or `unknown` types** - Use specific types or union types
- **Prefer classes over interfaces** for type definitions
- **Share types** from `types/core.ts` across modules
- **Avoid property checks** on polymorphic objects - make strong type assumptions
- **Use non-null assertions** (`value!`) when values are guaranteed
- **Import types** with `import type { TypeName }`

**Forbidden Patterns:**
- ❌ `as any` - NEVER use this
- ❌ Property existence checks like `'property' in object`
- ❌ Optional chaining for type narrowing

**Required Patterns:**
- ✅ Explicit return types on public methods
- ✅ Discriminated unions for variant types
- ✅ Type guards only for external data

### 2. Development Guidelines (Always Applied)
- **Real code only** - No examples, TODOs, or shortcuts
- **No new files** unless absolutely necessary - revise existing files
- **Complete functionality** - Implement everything, no placeholders
- **Fix root causes** - Don't work around problems
- **Research first** - Use existing Hyperscape systems before creating new ones
- **Self-contained packages** - Modular with workspace imports
- **Environment variables** - Use `.env` with dotenv package

### 3. Testing Standards (Always Applied)
- **NO mocks, spies, or test framework abstractions**
- **Real gameplay testing** - Build mini-worlds for each feature
- **Multimodal verification**:
  - Three.js scene hierarchy checks
  - Visual testing with colored cube proxies
  - System integration (ECS data introspection)
  - LLM verification (GPT-4o for image analysis when needed)
- **Visual Testing Proxies**:
  - 🔴 Players
  - 🟢 Goblins
  - 🔵 Items
  - 🟡 Trees
  - 🟣 Banks
  - 🟨 Stores
- **Requirements**:
  - Every feature MUST have tests
  - All tests MUST pass before moving on
  - Save error logs to `/logs` folder

### 4. kluster Code Verification Rules
- **Automatic Review**: Run `kluster_code_review_auto` after ANY file creation/modification
- **Manual Review**: Run `kluster_code_review_manual` when explicitly requested
- **Dependency Check**: Run `kluster_dependency_check` before package operations
- **Chat ID Management**: Include `chat_id` in all subsequent kluster calls after the first
- **End of Session**: Always provide kluster summary at end of conversation

---

## Documentation

### Core Documentation Files

1. **README.md** - Main project documentation
   - Quick start guide
   - Architecture overview
   - Gameplay features
   - Development commands

2. **LORE.md** - Game world and lore
   - World history (The Calamity, The Great Kingdoms)
   - 9 regions of Hyperia
   - Enemy types and progression
   - Lost treasures and legends

3. **CLAUDE.md** - Cursor rules documentation
   - Complete rule structure
   - Development patterns
   - Testing methodologies

### Rule Files (`.cursor/rules/`)

1. **elizaos.mdc** - ElizaOS AI agent integration
   - Actions, Providers, Services architecture
   - Hyperscape integration flow
   - Best practices for agent development

2. **hyperscape-docs.mdc** - Hyperscape engine docs
   - Scripting API reference
   - Globals (app, world, props)
   - Node types (Group, Mesh, Avatar, etc.)

3. **lore.mdc** - Game world generation
   - World regions and zones
   - Mob generation rules
   - History and world building

4. **models.mdc** - LLM model usage
   - OpenAI: `gpt-4o`, `gpt-4o-mini`, `o1-2024-12-17`
   - Image models: `gpt-image-1`, `dall-e-3`
   - MeshyAI: 3D model generation
   - Anthropic: `claude-opus-4-20250514`, `claude-sonnet-4-20250514`

5. **no-any-quick-reference.mdc** - TypeScript typing quick reference
   - Common scenarios and solutions
   - Forbidden vs required patterns

### API Documentation (`docs/api-specifications/`)

1. **README.md** - API specifications overview
2. **npc-dialogue-quest-api.md** - Complete dialogue/quest API spec
3. **quest-dialogue-api-summary.md** - Quick reference tables
4. **quest-dialogue-architecture.md** - System architecture
5. **quest-dialogue-examples.md** - Code examples

---

## Architecture & Tech Stack

### Core Technologies

- **Hyperscape** (`packages/shared`) - 3D multiplayer game engine
  - Built on Three.js + PhysX
  - Entity Component System (ECS)
  - Real-time networking (WebSocket)
  - Scripting API for `.hyp` apps

- **ElizaOS** - AI agent framework
  - Plugin system (`packages/plugin-hyperscape`)
  - Actions, Providers, Services architecture
  - LLM integration for decision-making

- **Three.js** - 3D graphics library
  - Scene hierarchy
  - Vector3, Quaternion, Euler math
  - Mesh, Group, Avatar nodes

- **Playwright** - Browser automation
  - Visual testing framework
  - Screenshot analysis
  - Real gameplay testing

- **SQLite** - Persistence layer
  - Player data
  - World state
  - Quest progress

### Package Structure

```
hyperscape/
├── packages/shared/          # Hyperscape engine core
├── packages/client/          # React frontend
├── packages/server/          # Game server
├── packages/plugin-hyperscape/  # ElizaOS plugin
└── packages/asset-forge/     # Asset generation tools
```

---

## Key Packages

### 1. `@hyperscape/shared` (Hyperscape Engine)
- **Main Entry**: `build/framework.js`
- **Exports**: Framework, client-side code
- **Key Features**:
  - World management
  - Entity Component System
  - Physics (PhysX)
  - Networking (WebSocket)
  - Scripting API

### 2. `@hyperscape/server` (Game Server)
- **Main Entry**: `dist/index.js`
- **Port**: 5555 (WebSocket: `/ws`)
- **Features**:
  - World hosting
  - Player management
  - Database (SQLite/PostgreSQL)
  - Authentication (Privy)

### 3. `@hyperscape/client` (React Frontend)
- **Port**: 3333 (dev), Cloudflare Pages (prod)
- **Features**:
  - 3D world rendering
  - UI components
  - Player controls
  - Inventory/equipment UI

### 4. `@elizaos/plugin-hyperscape` (AI Agent Plugin)
- **Main Entry**: `dist/index.js`
- **Key Components**:
  - `HyperscapeService` - World connection
  - Actions (20+ actions)
  - Providers (context injection)
  - Managers (behavior, build, emote, etc.)

---

## ElizaOS Integration

### Plugin Structure

**Main Plugin** (`packages/plugin-hyperscape/src/index.ts`):
```typescript
export const hyperscapePlugin: Plugin = {
  name: "hyperscape",
  services: [HyperscapeService],
  actions: [/* 20+ actions */],
  providers: [/* context providers */],
  events: hyperscapeEvents,
}
```

### HyperscapeService Architecture

**Connection Management**:
- WebSocket connection to Hyperscape server
- Authentication and session handling
- Reconnection logic
- Connection state tracking

**Managers**:
- `BehaviorManager` - Agent behaviors and action selection
- `BuildManager` - World editing and entity placement
- `EmoteManager` - Gestures and animations
- `MessageManager` - Chat routing and replies
- `MultiAgentManager` - Multiple agents coordination
- `VoiceManager` - Voice chat (LiveKit)
- `PlaywrightManager` - Headless testing

**World Interaction**:
- Movement: `goto()`, `followEntity()`, `walkRandomly()`
- Interaction: `use()`, `performAction()`
- Communication: `sendMessage()`, `broadcast()`
- Building: `createEntity()`, `editEntity()`, `deleteEntity()`
- Perception: `scanEnvironment()`, `getNearbyEntities()`

### Actions (20+ Available)

**Core Actions**:
- `perception` - Scan environment
- `goto` - Navigate to entity/location
- `use` - Use/activate items
- `unuse` - Stop using item
- `stop` - Stop movement
- `walk_randomly` - Wander around
- `ambient` - Idle behaviors
- `build` - Edit world (if builder)
- `reply` - Respond to chat
- `ignore` - Ignore messages

**RPG Actions** (loaded dynamically):
- `chopTree` - Woodcutting skill
- `catchFish` - Fishing skill
- `lightFire` - Firemaking skill
- `cookFood` - Cooking skill
- `bankItems` - Banking system
- `checkInventory` - Inventory management
- `attack` - Combat system

### Providers (Context Injection)

**Standard Providers** (always loaded):
- `CHARACTER` - Agent personality and bio
- `HYPERSCAPE_EMOTE_LIST` - Available animations
- `SKILLS_OVERVIEW` - Character skill levels
- `ACTIONS` - Available actions list

**Dynamic Providers** (loaded on-demand):
- `HYPERSCAPE_WORLD_STATE` - Entity positions, nearby objects, chat
- `BANKING_INFO` - Nearby banks, inventory status
- `WOODCUTTING_INFO` - Nearby trees, axe availability
- `FISHING_INFO` - Fishing spots, rod availability
- `FIREMAKING_INFO`, `COOKING_INFO` - Skill-specific context

**Private Providers** (loaded via content packs):
- Skill providers loaded when RPG systems detected
- Custom providers from UGC bundles

### Action Handler Pattern

**CRITICAL**: All action handlers MUST return `ActionResult` objects:

```typescript
handler: async (
  runtime: IAgentRuntime,
  message: Memory,
  state: State,
  options: ActionHandlerOptions,
  callback: HandlerCallback,
): Promise<ActionResult> => {
  try {
    // ... action logic ...
    
    await callback({
      text: resultText,
      actions: ['ACTION_NAME'],
      source: 'hyperscape',
    });
    
    return {
      text: resultText,
      success: true,
      values: { /* template vars */ },
      data: { action: 'ACTION_NAME' },
    };
  } catch (error) {
    return {
      text: errorMessage,
      success: false,
      values: { error: true },
      data: { action: 'ACTION_NAME' },
    };
  }
}
```

**Reference Implementations**:
- `packages/plugin-hyperscape/src/actions/reply.ts`
- `packages/plugin-hyperscape/src/actions/lightFire.ts`
- `packages/plugin-hyperscape/src/actions/continue.ts`

---

## Testing Framework

### Testing Philosophy
- **NO mocks** - Real Hyperscape instances
- **Real gameplay** - Actual world, entities, systems
- **Multimodal verification** - Data + visual confirmation

### Testing Methods

1. **Three.js Testing**
   - Check scene hierarchy
   - Verify entity positions
   - Validate object properties

2. **Visual Testing**
   - Screenshot analysis with Playwright
   - Colored cube proxies for entities
   - Pixel detection for positions

3. **System Integration**
   - ECS system introspection
   - Component data verification
   - Event handling validation

4. **LLM Verification** (sparingly)
   - GPT-4o image analysis
   - UI verification
   - Complex scenario validation

### Test Structure

```
packages/plugin-hyperscape/src/
├── __tests__/
│   ├── actions/          # Action unit tests
│   ├── e2e/             # End-to-end tests
│   └── helpers/         # Test utilities
└── testing/
    ├── RealVisualTestFramework.ts
    ├── modular-test-framework.ts
    └── rpg-concrete-tests.ts
```

### Running Tests

```bash
npm test                    # All tests
npm run test:rpg           # RPG-specific tests
npm run test:visual        # Visual/screenshot tests
npm run test:integration   # End-to-end tests
```

---

## Development Workflow

### Essential Commands

```bash
# Installation & Build
npm install                 # Install dependencies
npm run build              # Build all packages
npm run build:shared       # Build shared package only

# Development
npm run dev                # Start dev mode (hot reload)
npm run dev:shared         # Watch shared package
npm run dev:client         # Client with Vite HMR
npm run dev:server         # Server with auto-restart

# Running
npm start                  # Start game server (port 5555)
npm run ios                # iOS app development
npm run android            # Android app development

# Testing
npm test                   # Run all tests
npm run lint               # Code quality checks

# Documentation
npm run docs:generate      # Generate API docs
npm run docs:dev           # Start docs server
```

### File Management Rules

- **NEVER create new files** unless absolutely necessary
- **Revise existing files** instead of creating `_v2.ts`
- **Delete old files** completely when replacing
- **Update all imports** in dependent files
- **Clean up orphaned files** immediately

### Code Quality Standards

- **Production code only** - No examples or shortcuts
- **Complete functionality** - No TODOs
- **Fix root causes** - Don't work around problems
- **Research first** - Use existing systems before creating new ones

---

## API Specifications

### Quest & Dialogue System

**Status**: Type definitions complete, implementation pending

**Key Files**:
- `docs/api-specifications/npc-dialogue-quest-api.md` - Full API spec
- `docs/api-specifications/quest-dialogue-examples.md` - Code examples
- `packages/shared/src/types/quest-dialogue-types.ts` - Type definitions

**Features**:
- Dialogue trees with branching conversations
- Quest system with multiple objective types
- 26 event types for client-server communication
- Session management and cooldowns

**Implementation Checklist**:
1. Add event types to `EventType` enum
2. Implement `DialogueStateManager`
3. Implement `QuestSystem`
4. Build UI components
5. Create starter content

---

## Configuration & Environment

### Environment Variables

**Root `.env`** (required):
```bash
# OpenAI (text/image generation)
OPENAI_API_KEY=sk-...

# MeshyAI (3D model generation)
MESHY_API_KEY=...

# Privy (authentication)
PRIVY_APP_ID=cl...
PRIVY_APP_SECRET=...

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://...

# LiveKit (voice chat)
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=...

# Farcaster (miniapp)
FC_APP_ID=...
FC_APP_SECRET=...
FC_SIGNER_UUID=...
```

**Client Environment** (`packages/client/.env`):
```bash
PUBLIC_WS_URL=ws://localhost:5555/ws
PUBLIC_CDN_URL=http://localhost:8080
PUBLIC_PRIVY_APP_ID=cl...
PUBLIC_ENABLE_FARCASTER=true
PUBLIC_APP_URL=http://localhost:3333
```

**Server Environment** (`packages/server/.env`):
```bash
DATABASE_URL=postgresql://...
PRIVY_APP_ID=cl...
PRIVY_APP_SECRET=...
JWT_SECRET=...
LIVEKIT_API_KEY=...
```

### TypeScript Configuration

**`tsconfig.json`**:
- Target: ES2021
- Module: ESNext
- Strict mode enabled
- JSX: react-jsx
- Paths: Workspace imports

### ESLint Configuration

**`eslint.config.js`**:
- TypeScript ESLint plugin
- No `any` types (warning)
- React hooks rules
- Console allowed (for debugging)

---

## Key Concepts

### Entity Component System (ECS)

Hyperscape uses an ECS architecture:
- **Entities** - Game objects (players, mobs, items)
- **Components** - Data attached to entities
- **Systems** - Logic that processes components

### Hyperscape Apps (`.hyp` files)

Self-contained world applications:
- GLTF model-based
- Scripting API access
- Secure sandbox environment
- Can be shared/traded

### Real-Time Networking

- WebSocket for real-time updates
- MessagePack for efficient serialization
- Client-side prediction
- Server authority for critical actions

### AI Agent Decision Flow

1. **Input Reception** - Player message → HyperscapeService
2. **Context Composition** - `runtime.composeState()` → Providers
3. **Decision Making** - LLM processes state → Selects actions
4. **Action Execution** - `validate()` → `handler()` → World changes
5. **Result Broadcasting** - World state → Network → All clients

---

## Memory & Context

### Important Memories

1. **ActionResult Pattern** - All action handlers MUST return ActionResult objects at every exit point
2. **Provider System** - Three-tiered architecture (standard/dynamic/private)
3. **Runtime Registration** - Providers can be registered at runtime via `runtime.registerProvider()`
4. **RPG Extensions** - Loaded dynamically when systems detected via `loadRPGExtensions()`

### Provider Best Practices

1. Use standard providers for lightweight, always-needed context
2. Use dynamic providers for expensive, context-specific queries
3. Use private providers for game-specific features
4. Keep provider text concise (consumes LLM tokens)
5. Use `position` to control context layering
6. Cache expensive computations in `data` field
7. Format text with markdown headers for LLM clarity
8. Handle service unavailability gracefully
9. Use strong typing - no `any` types

---

## Quick Reference

### Common File Locations

- **Plugin Entry**: `packages/plugin-hyperscape/src/index.ts`
- **Service**: `packages/plugin-hyperscape/src/service.ts`
- **Actions**: `packages/plugin-hyperscape/src/actions/`
- **Providers**: `packages/plugin-hyperscape/src/providers/`
- **Types**: `packages/shared/src/types/`
- **World Config**: `packages/server/world/`

### Common Patterns

**Action Handler**:
```typescript
handler: async (runtime, message, state, options, callback): Promise<ActionResult> => {
  const service = runtime.getService<HyperscapeService>('hyperscape')!;
  const world = service.getWorld()!;
  // ... action logic ...
  return { text, success, values, data };
}
```

**Provider**:
```typescript
export const myProvider: Provider = {
  name: 'MY_PROVIDER',
  description: 'Provides...',
  dynamic: true,
  position: 2,
  get: async (runtime, message, state) => {
    const service = runtime.getService<HyperscapeService>('hyperscape')!;
    const world = service.getWorld()!;
    // ... gather context ...
    return { text, values, data };
  }
}
```

**Service Access**:
```typescript
const service = runtime.getService<HyperscapeService>('hyperscape');
if (!service || !service.isConnected()) {
  return { text: 'Not connected', success: false };
}
const world = service.getWorld()!;
```

---

## Support & Resources

### Documentation Links
- Main README: `README.md`
- Lore: `LORE.md`
- Cursor Rules: `CLAUDE.md`
- **Architecture Decision Records**: `adr/` - [View ADR Index](adr/README.md)
- API Specs: `docs/api-specifications/`
- Plugin Dev Book: `packages/plugin-hyperscape/dev-book/`

### Architecture Decision Records
- [ADR-0001: Use Bun as Primary Package Manager](adr/0001-use-bun-as-primary-package-manager.md)
- [ADR-0002: Adopt Turbo for Monorepo Build Orchestration](adr/0002-adopt-turbo-for-monorepo-build-orchestration.md)
- [ADR-0003: Migrate from Docker to RAILPACK](adr/0003-migrate-from-docker-to-railpack-for-railway-deployment.md)
- [ADR-0004: Use PostgreSQL for Primary Database](adr/0004-use-postgresql-for-primary-database.md)
- [ADR-0005: Adopt ElizaOS for AI Agent Framework](adr/0005-adopt-elizaos-for-ai-agent-framework.md)
- [ADR-0006: Enforce TypeScript Strict Typing Standards](adr/0006-enforce-typescript-strict-typing-standards.md)
- [ADR-0007: Real Gameplay Testing with Playwright](adr/0007-real-gameplay-testing-with-playwright.md)

### Key Commands
- `npm start` - Start game server
- `npm test` - Run tests
- `npm run dev` - Development mode
- `npm run build` - Build all packages

### Getting Help
- Check existing documentation first
- Review rule files in `.cursor/rules/`
- Check test files for examples
- Review action handlers for patterns

---

**Last Updated**: 2025-11-06
**Project Version**: 0.13.0
**Knowledge Sync**: Complete - ADRs synchronized



