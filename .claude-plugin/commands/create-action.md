---
description: Generate new ElizaOS action with tests
allowed-tools:
  - Read(packages/plugin-hyperscape/src/**/*.ts)
  - Write(packages/plugin-hyperscape/src/actions/*.ts)
  - Write(packages/plugin-hyperscape/src/__tests__/actions/*.test.ts)
  - Edit(packages/plugin-hyperscape/src/index.ts)
  - Edit(packages/plugin-hyperscape/package.json)
  - Glob(packages/plugin-hyperscape/src/actions/*)
  - Bash(cd packages/plugin-hyperscape*)
argument-hint: "<action-name> - Name of the action to create (e.g., mineRock)"
model: opus
---

Create new action: $1

This command generates:
1. src/actions/$1.ts (with proper types from core-types.ts)
2. src/__tests__/actions/$1.test.ts (with real testing framework)
3. Exports in src/index.ts
4. Entry in package.json agentConfig.actions

Template includes:
- ElizaOS Action interface
- Proper TypeScript types (no any/unknown)
- validate() and handler() methods
- Example usage array
- Real test structure (no mocks)

After generation:
1. Implement action logic in handler
2. Add real tests with Hyperscape world
3. Test with `/test-rpg $1`
4. Update action examples
