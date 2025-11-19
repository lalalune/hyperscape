# Agent Project Context Memory

Complete project context for AI agent working on Hyperscape plugin development.

## Project Overview

**Hyperscape** is an AI-generated RuneScape-style MMORPG built on a 3D multiplayer game engine. The `plugin-eliza` package integrates ElizaOS AI agents into Hyperscape game worlds, enabling autonomous AI agents to play alongside human players.

## Key Project Facts

### Technology Stack
- **Hyperscape Engine**: 3D multiplayer game engine (Three.js, ECS architecture)
- **ElizaOS**: AI agent framework for autonomous agents
- **TypeScript**: Primary language (strict typing, no `any`)
- **Bun**: Package manager and runtime
- **Playwright**: Browser automation for E2E testing
- **Vitest**: Unit testing framework

### Package Structure
```
hyperscape/
├── packages/
│   ├── hyperscape/      # Core 3D game engine
│   ├── plugin-eliza/    # ElizaOS plugin (THIS PACKAGE)
│   ├── client/          # React frontend
│   ├── server/          # Elysia backend
│   └── shared/          # Shared types and utilities
```

### Plugin Location
**Primary Package**: `/Users/home/hyperscape/packages/plugin-eliza/`

## Core Development Principles

### 1. Real Code Only
- ❌ NO examples, TODOs, or shortcuts
- ❌ NO mock data or test abstractions
- ✅ Production-ready code only
- ✅ Real gameplay testing

### 2. TypeScript Strong Typing
- ❌ NO `any` or `unknown` types
- ✅ Use specific types or union types
- ✅ Prefer classes over interfaces
- ✅ Share types from `@hyperscape/shared`

### 3. Code Reuse
- ❌ NO duplicate code
- ✅ Check existing code first
- ✅ Edit existing files instead of creating new ones
- ✅ Reuse existing components

### 4. Testing Requirements
- ❌ NO mocks, spies, or test framework abstractions
- ✅ Real gameplay testing with Playwright
- ✅ Visual testing with colored cube proxies
- ✅ Three.js scene hierarchy checks
- ✅ All features MUST have tests
- ✅ All tests MUST pass

## Key File Locations

### Plugin Entry Point
- `packages/plugin-eliza/src/index.ts` - Main plugin export
- `packages/plugin-eliza/src/service.ts` - HyperscapeService

### Core Directories
- `src/actions/` - Game world actions (GOTO, USE_ITEM, REPLY, etc.)
- `src/providers/` - Context providers (world state, inventory, etc.)
- `src/services/` - Service implementations
- `src/managers/` - Specialized managers (behavior, build, emote, etc.)
- `src/systems/` - Hyperscape world systems
- `src/clients/` - WebSocket client implementations
- `src/config/` - Configuration constants
- `src/templates/` - Prompt templates
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions
- `src/testing/` - Visual testing framework
- `src/__tests__/` - Unit and E2E tests

### Configuration Files
- `.cursor/rules/` - Development rules (39 files)
- `.cursor/hooks/` - Cursor hooks (10 files)
- `.cursor/memory/` - Project memories (17 files)
- `.cursor/commands/` - Custom commands (6 files)
- `.cursor/tools/` - Helper tools (1 file)

## ElizaOS Integration

### Plugin Components
1. **Actions** - What agents can DO (GOTO, USE_ITEM, REPLY, BUILD, etc.)
2. **Providers** - Context suppliers (HYPERSCAPE_WORLD_STATE, etc.)
3. **Services** - Persistent connections (HyperscapeService)
4. **Evaluators** - Decision helpers
5. **Event Handlers** - Event listeners

### Component Registration Order (CRITICAL)
1. Database Adapter (if provided)
2. Actions
3. Evaluators
4. Providers
5. Models
6. Routes
7. Events
8. Services (delayed if runtime not initialized)

### Service Access Pattern
```typescript
const service = runtime.getService<HyperscapeService>('hyperscapeService');
if (!service || !service.isConnected()) {
  return { success: false, error: new Error('Service not available') };
}
```

## Common Patterns

### Action Pattern
```typescript
export const myAction: Action = {
  name: 'MY_ACTION',
  similes: ['ALTERNATIVE_NAME'],
  description: 'What this action does',
  validate: async (runtime, message, state) => {
    const service = runtime.getService<HyperscapeService>('hyperscapeService');
    return service?.isConnected() ?? false;
  },
  handler: async (runtime, message, state, options, callback) => {
    try {
      const service = runtime.getService<HyperscapeService>('hyperscapeService');
      // Action logic
      await callback?.({ text: 'Action result', action: 'MY_ACTION' });
      return { success: true, text: 'Success', values: {}, data: {} };
    } catch (error) {
      await callback?.({ text: `Error: ${error.message}`, error: true });
      return { success: false, error };
    }
  },
  examples: [[...]]
};
```

### Provider Pattern
```typescript
export const myProvider: Provider = {
  name: 'MY_PROVIDER',
  description: 'What context it provides',
  dynamic: true,
  get: async (runtime, message, state) => {
    const service = runtime.getService<HyperscapeService>('hyperscapeService');
    const data = service.getData();
    return {
      text: formatForLLM(data),
      values: { data: data.summary },
      data: { data }
    };
  }
};
```

### Service Pattern
```typescript
export class MyService extends Service {
  static serviceType = 'my-service';
  capabilityDescription = 'Service description';
  
  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new MyService(runtime);
    await service.initialize();
    return service;
  }
  
  async stop() {
    await this.cleanup();
  }
}
```

## Error Handling Standards

### Always Handle Errors
- ✅ Wrap async operations in try-catch
- ✅ Check service availability before use
- ✅ Notify users via callback on errors
- ✅ Log errors with context
- ✅ Return proper error structures
- ❌ NEVER throw unhandled errors

### Error Logging Pattern
```typescript
runtime.logger.error(`[Component] Error:`, {
  error,
  context: { messageId: message.id, entityId: message.entityId }
});
```

## Logging Standards

### Structured Logging
- ✅ Use `logger` from `@elizaos/core` or `runtime.logger`
- ✅ Use structured logging (objects, not strings)
- ✅ Include component name in logs
- ✅ Include relevant context (messageId, entityId, etc.)
- ✅ Use appropriate log levels (error, warn, info, debug)
- ❌ NEVER log sensitive information (API keys, passwords)

## Security Standards

### API Key Management
- ✅ Use `runtime.getSetting()` for API keys
- ✅ Store keys in environment variables
- ✅ Validate key format before use
- ❌ NEVER hardcode API keys
- ❌ NEVER commit keys to version control
- ❌ NEVER log API keys

### Input Validation
- ✅ Validate all inputs with Zod schemas
- ✅ Validate at action/provider boundaries
- ✅ Use type guards for runtime validation
- ❌ NEVER trust user input

## Performance Standards

### State Composition
- ✅ Use cache for performance (default)
- ✅ Include only needed providers
- ✅ Use `skipCache: true` only when fresh data required

### Provider Performance
- ✅ Design providers for parallel execution
- ✅ Implement timeouts for external calls (5 seconds)
- ✅ Use cache when appropriate
- ✅ Return empty result on timeout (don't crash)

## Testing Standards

### Visual Testing Proxies
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks
- 🟨 Stores

### Test Requirements
- ✅ Every feature MUST have tests
- ✅ All tests MUST pass before moving on
- ✅ Use real gameplay testing (no mocks)
- ✅ Use Playwright for E2E tests
- ✅ Use visual testing with colored cubes
- ✅ Check Three.js scene hierarchy
- ✅ Save error logs to `/logs` folder

## Common Workflows

### Creating New Action
1. Check `plugin-eliza-actions.mdc` rule
2. Use `/elizaos-research action interface`
3. Check `elizaos-action-patterns.md` memory
4. Implement following patterns
5. Use `/elizaos-validate` to check
6. Write real gameplay test

### Creating New Provider
1. Check `plugin-eliza-providers.mdc` rule
2. Use `/elizaos-research provider patterns`
3. Check `elizaos-providers.md` memory
4. Implement following patterns
5. Use `/elizaos-validate` to check
6. Write unit test

### Creating New Service
1. Check `plugin-eliza-services-runtime.mdc` rule
2. Use `/elizaos-research service lifecycle`
3. Check `elizaos-services.md` memory
4. Implement following patterns
5. Use `/elizaos-validate` to check
6. Write integration test

## Important Reminders

### Before Implementing
- ✅ Check existing code first
- ✅ Research ElizaOS documentation
- ✅ Check relevant rule files
- ✅ Use `/elizaos-research` for patterns

### During Implementation
- ✅ Follow rule patterns
- ✅ Use hooks for automatic checks
- ✅ Follow error handling patterns
- ✅ Use structured logging

### After Implementation
- ✅ Use `/elizaos-validate` to check code
- ✅ Write real gameplay tests
- ✅ Review hook violations
- ✅ Update memories if needed

## Key Rules to Remember

1. **NO `any` types** - Use specific types
2. **NO mocks** - Real gameplay testing only
3. **NO duplicate code** - Check existing first
4. **NO examples** - Production code only
5. **Always handle errors** - Never throw unhandled
6. **Always check service** - Before using HyperscapeService
7. **Always validate inputs** - Use Zod schemas
8. **Always log with context** - Include messageId, entityId
9. **Always test** - Every feature needs tests
10. **Always follow patterns** - From rules and memories

## Documentation References

### ElizaOS Documentation
- Main: https://docs.elizaos.ai/
- Plugin Architecture: https://docs.elizaos.ai/plugins/architecture
- Create Plugin: https://docs.elizaos.ai/guides/create-a-plugin
- Plugin Components: https://docs.elizaos.ai/plugins/components
- Plugin Patterns: https://docs.elizaos.ai/plugins/patterns

### Project Documentation
- Rules: `.cursor/rules/` (39 files)
- Memories: `.cursor/memory/` (17 files)
- Hooks: `.cursor/hooks/` (10 files)
- Commands: `.cursor/commands/` (6 files)

## Quick Commands

- `/elizaos-research <topic>` - Research ElizaOS patterns
- `/elizaos-validate <file>` - Validate code against patterns

## File Count Summary

- Rules: 39 files
- Hooks: 10 files
- Memory: 17 files
- Commands: 6 files
- Tools: 1 file
- **Total**: 73+ files in `.cursor/` directory

