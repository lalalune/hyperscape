# Hyperscape Project Overview Memory

Complete reference for the Hyperscape project structure, architecture, and development context.

## Project Structure

### Monorepo Organization

```
hyperscape/
├── packages/
│   ├── hyperscape/          # Core 3D multiplayer game engine
│   ├── plugin-eliza/        # ElizaOS plugin for Hyperscape integration
│   ├── client/              # React frontend
│   ├── server/              # Elysia backend
│   └── shared/              # Shared types and utilities
├── .cursor/                 # Cursor IDE configuration
│   ├── rules/               # Development rules
│   ├── hooks/               # Cursor hooks
│   ├── memory/              # Project memories
│   ├── tools/               # Helper tools
│   └── commands/            # Custom commands
└── docs/                    # Project documentation
```

## Core Technologies

### Hyperscape Engine
- **Purpose**: 3D multiplayer game engine built on Three.js
- **Location**: `packages/hyperscape/`
- **Features**: ECS architecture, multiplayer networking, physics, rendering
- **Key Systems**: World, System, Entity, Component, Player, Network

### ElizaOS Plugin
- **Purpose**: AI agent integration into Hyperscape worlds
- **Location**: `packages/plugin-eliza/`
- **Features**: Actions, Providers, Services, Event handlers
- **Key Components**: HyperscapeService, Actions, Providers, Managers

### Game Systems
- **Combat**: Real-time auto-combat with RuneScape formulas
- **Skills**: 9 skills (Attack, Strength, Defense, Constitution, Range, Woodcutting, Fishing, Firemaking, Cooking)
- **Items**: 3 tiers (Bronze → Steel → Mithril)
- **World**: Grid-based with height-mapped terrain
- **Multiplayer**: Real-time WebSocket communication

## Development Standards

### TypeScript
- **No `any` types** - Use specific types or union types
- **Prefer classes over interfaces** for type definitions
- **Share types** from `@hyperscape/shared`
- **Strong type assumptions** - Avoid property checks

### Code Quality
- **Real code only** - No examples, TODOs, or shortcuts
- **No new files** unless absolutely necessary
- **Complete functionality** - No placeholders
- **Fix root causes** - Don't work around problems

### Testing
- **NO mocks** - Real gameplay testing only
- **Visual testing** - Colored cube proxies for entities
- **Playwright** - Browser automation for E2E tests
- **All tests must pass** - No exceptions

## Key Rules

### Plugin Development Rules
- **plugin-eliza-core-principles.mdc** - Core architectural principles
- **plugin-eliza-actions.mdc** - Action implementation patterns
- **plugin-eliza-providers.mdc** - Provider implementation patterns
- **plugin-eliza-services-runtime.mdc** - Service lifecycle patterns
- **plugin-eliza-events-runtime.mdc** - Event handling patterns
- **plugin-eliza-messaging-runtime.mdc** - Socket.IO messaging patterns
- **plugin-eliza-error-handling.mdc** - Error handling patterns
- **plugin-eliza-logging.mdc** - Logging patterns
- **plugin-eliza-performance.mdc** - Performance optimization
- **plugin-eliza-security.mdc** - Security patterns

### ElizaOS Rules
- **elizaos-documentation.mdc** - Documentation enforcement
- **elizaos-commands.mdc** - Custom command patterns
- **elizaos-docs-visitor.mdc** - Documentation visitor patterns

### Hyperscape Rules
- **hyperscape-docs.mdc** - Hyperscape engine documentation
- **hyperscape-plugin-eliza.mdc** - Plugin overview
- **gdd.mdc** - Game Design Document
- **lore.mdc** - Game world lore

## Hooks

### Before Prompt Submission
1. **research-reminder.sh** - Research before implementing
2. **kiss-reminder.sh** - Keep It Simple Stupid
3. **context-gatherer.sh** - Context gathering instructions
4. **eliza-docs-hook.sh** - Eliza documentation suggestions
5. **doc-visitor-hook.sh** - Documentation visitor

### After File Edit
1. **enforce-plugin-rules.sh** - Rule enforcement
2. **duplicate-checker.sh** - Code duplication detection
3. **dependency-checker.sh** - Dependency verification

### Before Read File
1. **research-check.sh** - Research before reading
2. **critical-file-protection.sh** - Core file protection
3. **eliza-docs-hook.sh** - Documentation suggestions
4. **doc-visitor-hook.sh** - Documentation visitor

## Commands

### Custom Commands
- **/elizaos-research** - Research ElizaOS patterns using Deepwiki MCP
- **/elizaos-validate** - Validate code against ElizaOS patterns

## Memory Files

### ElizaOS Documentation
- **elizaos-docs-index.md** - Complete documentation index
- **elizaos-action-patterns.md** - Action patterns reference
- **elizaos-architecture-components.md** - Architecture reference
- **elizaos-character-personality.md** - Character configuration
- **elizaos-database-schema.md** - Database patterns
- **elizaos-events.md** - Event system reference
- **elizaos-memory-state.md** - Memory and state management
- **elizaos-messaging.md** - Messaging system reference
- **elizaos-providers.md** - Provider system reference
- **elizaos-reference.md** - Complete API reference
- **elizaos-services.md** - Service system reference

## Tools

### doc-visitor.sh
- **Purpose**: Analyzes file paths/prompts and suggests relevant ElizaOS documentation
- **Input**: JSON with `file_path` or `prompt`
- **Output**: List of relevant documentation URLs
- **Uses**: `elizaos-docs-index.md` for mapping

## Game Design

### World Structure
- **Grid System**: Discrete grid cells
- **Height Map**: Vertex-colored terrain with PhysX collision
- **Biomes**: Mistwood Valley, Goblin Wastes, Darkwood Forest, Northern Reaches, Blasted Lands, Lakes, Plains
- **Difficulty Zones**: Level 0 (starter towns) → Level 3 (high-level mobs)

### Player Systems
- **Starting**: Bronze sword, random starter town, level 1 skills
- **Stats**: ATK, STR, RANGE, DEF, CON
- **Skills**: 9 skills total
- **Death**: Items dropped at death location, respawn at starter town

### Combat System
- **Real-time**: Auto-attack when in range
- **Ranged**: Requires bow and arrows
- **PvE Only**: MVP scope excludes PvP

### Items & Equipment
- **Weapons**: Swords, Bows, Shields (Bronze → Steel → Mithril)
- **Armor**: Leather to Mithril sets
- **Tools**: Hatchet, Fishing rod, Tinderbox
- **Ammunition**: Arrows for ranged combat

## Development Workflow

### Setup
```bash
npm install
npm run build
npm start
```

### Testing
```bash
bun test                    # Run all tests
bun test:watch             # Watch mode
bun test:headed            # Visible browser
```

### Building
```bash
npm run build              # Build all packages
npm run build:shared       # Build shared package
```

## Key Files

### Plugin Entry
- **packages/plugin-eliza/src/index.ts** - Main plugin export
- **packages/plugin-eliza/src/service.ts** - HyperscapeService

### Rules
- **.cursor/rules/plugin-eliza-*.mdc** - Plugin development rules
- **.cursor/rules/elizaos-*.mdc** - ElizaOS rules
- **.cursor/rules/hyperscape-*.mdc** - Hyperscape rules

### Hooks
- **.cursor/hooks.json** - Hook configuration
- **.cursor/hooks/*.sh** - Hook scripts

### Memory
- **.cursor/memory/elizaos-*.md** - ElizaOS documentation memories
- **.cursor/memory/project-overview.md** - This file

## Integration Points

### ElizaOS → Hyperscape
- **HyperscapeService** - Main integration point
- **Actions** - Game world interactions
- **Providers** - World state context
- **Event Handlers** - Game event processing

### Hyperscape → ElizaOS
- **WebSocket** - Real-time communication
- **World State** - Entity positions, chat, actions
- **Player Controls** - Movement, interaction, combat

## Best Practices

1. **Research First** - Check documentation before implementing
2. **Reuse Code** - Check for existing implementations
3. **Keep It Simple** - Start with simplest solution
4. **Test Everything** - Real gameplay tests, no mocks
5. **Follow Patterns** - Use established patterns from rules
6. **Document Decisions** - Update memories with decisions
7. **Error Handling** - Always handle errors gracefully
8. **Performance** - Optimize state composition and providers
9. **Security** - Validate inputs, sanitize outputs
10. **Logging** - Use structured logging with context

