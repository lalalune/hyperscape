# Hyperfy Content Pack System

## Overview

The Hyperfy Content Pack System enables modular game experiences that can be dynamically loaded into Hyperfy worlds. This document covers the complete implementation including the modular architecture, visual testing framework, and end-to-end integration.

## Key Features

### 1. Modular Architecture
- **Content Packs**: Self-contained game modules (RPG, Racing, Social, etc.)
- **Dynamic Loading**: Load/unload content at runtime without recompilation
- **Visual Configuration**: Each pack defines entity colors for testing
- **State Management**: Per-pack state systems

### 2. Visual Testing Framework
- **ColorDetector Integration**: Uses existing visual detection system
- **Concrete State Verification**: Direct inspection of game state
- **Screenshot Capture**: Visual regression testing
- **No LLM Verification**: Real verification, not AI observations

### 3. End-to-End Flow
```
Agent → Connect to World → Receive Bundle → Load Content Pack → Actions Available
```

## Architecture

### Content Pack Structure (`IContentPack`)
```typescript
interface IContentPack {
  id: string;
  name: string;
  version: string;
  actions?: Action[];        // Game-specific actions
  providers?: Provider[];    // Context providers
  systems?: IGameSystem[];   // Game systems (combat, inventory, etc.)
  visuals?: IVisualConfig;   // Visual colors for testing
  stateManager?: IStateManager;
  onLoad?: (runtime, world) => Promise<void>;
  onUnload?: (runtime, world) => Promise<void>;
}
```

### Example: Runescape RPG Pack
```typescript
const RunescapeRPGPack: IContentPack = {
  id: 'runescape-rpg',
  name: 'Runescape RPG Module',
  version: '1.0.0',
  
  actions: [
    attackAction,    // Combat actions
    mineAction,      // Skill actions
    tradeAction,     // Economy actions
  ],
  
  visuals: {
    entityColors: {
      'npcs.goblin': { color: 2263842, hex: '#228822' },
      'effects.damage': { color: 16711680, hex: '#FF0000' }
    }
  }
};
```

## Visual Testing

### Visual Test Framework
Replaces LLM-based verification with concrete visual and state checks:

```typescript
// OLD: LLM-based
verification: {
  type: 'llm',
  successCriteria: 'Agent should see combat'
}

// NEW: Visual + State
verification: {
  type: 'both',
  visualChecks: [
    { entityType: 'npcs.goblin', expectedColor: 2263842, shouldExist: true },
    { entityType: 'effects.damage', expectedColor: 16711680, shouldExist: true }
  ],
  stateChecks: [
    { property: 'health.current', expectedValue: 100, operator: 'less' }
  ]
}
```

### Test Types
1. **Visual Checks**: Verify entities exist with correct colors
2. **State Checks**: Verify game state changes correctly
3. **Position Checks**: Verify entity locations
4. **Screenshot Capture**: For regression testing

## Implementation Details

### 1. Content Pack Loader
```typescript
// Load a content pack
const loader = new ContentPackLoader(runtime);
await loader.loadPack(RunescapeRPGPack);

// Actions are now available
const action = runtime.getAction('ATTACK_TARGET');
```

### 2. Service Integration
```typescript
// In HyperfyService
async loadContentPack(pack: IContentPack) {
  await this.contentPackLoader.loadPack(pack);
  // Actions, providers, visuals all registered
}
```

### 3. Dynamic Action Discovery
```typescript
// World sends available actions
{
  type: 'world-state',
  data: {
    contentPacks: ['runescape-rpg'],
    actions: [
      { id: 'ATTACK_TARGET', category: 'combat', ... }
    ]
  }
}
```

## Testing

### E2E Test Flow
```typescript
// 1. Create agent runtime
const runtime = createAgentRuntime(config);

// 2. Initialize service
await service.initialize(runtime);

// 3. Load content pack
await service.loadContentPack(RunescapeRPGPack);

// 4. Verify actions available
const action = runtime.getAction('ATTACK_TARGET');
expect(action).toBeDefined();

// 5. Execute and verify
const result = await action.handler(runtime, message, state);
expect(result.success).toBe(true);
```

### Visual Test Example
```typescript
// Cypress test with pixel verification
cy.get('#hyperfy-world-canvas').then(($canvas) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  
  // Find goblin by color
  const goblin = findColorInCanvas(imageData, '#228822');
  expect(goblin).to.not.be.null;
  
  // Attack and verify damage indicator
  cy.get('[data-action="attack"]').click();
  const damage = findColorInCanvas(imageData, '#FF0000');
  expect(damage).to.not.be.null;
});
```

## Usage

### Loading Content Packs

```typescript
// In your agent initialization
import RunescapeRPGPack from '@hyperfy/rpg-runescape';

const service = runtime.getService(HyperfyService.serviceName);
await service.loadContentPack(RunescapeRPGPack);

// RPG actions now available to agent
```

### Creating Custom Content Packs

```typescript
const MyGamePack: IContentPack = {
  id: 'my-game',
  name: 'My Custom Game',
  version: '1.0.0',
  
  actions: [{
    name: 'CUSTOM_ACTION',
    handler: async (runtime, message, state) => {
      // Your game logic
    }
  }],
  
  visuals: {
    entityColors: {
      'custom.entity': { color: 0xFF00FF, hex: '#FF00FF' }
    }
  }
};
```

## Testing Commands

```bash
# Test content pack loading
npm run test:content-pack

# Test with mock runtime  
npm run test:content-pack:mock

# Run visual tests
npm run test:visual

# Run Cypress E2E tests
npm run test:cypress
```

## Benefits

1. **Modularity**: Games are separate packages, not hardcoded
2. **Testability**: Visual verification ensures things actually work
3. **Flexibility**: Load different games for different worlds
4. **Extensibility**: Easy to add new game types
5. **Reliability**: No more "agent thinks it sees X"

## Migration from Hardcoded RPG

### Before
- RPG actions hardcoded in plugin
- No visual verification
- LLM-based testing
- Single game type

### After
- RPG is a loadable module
- ColorDetector verification
- Concrete state testing
- Multiple game types supported

## Future Enhancements

1. **Content Pack Registry**: Central repository of packs
2. **Version Management**: Handle pack updates
3. **Pack Dependencies**: Packs that build on others
4. **Visual Editor**: Create packs visually
5. **Hot Reloading**: Update packs without restart

## Conclusion

The Content Pack System transforms Hyperfy from a hardcoded RPG plugin to a flexible platform supporting any type of game or experience. Combined with visual testing, we ensure that what we build actually works as intended. 