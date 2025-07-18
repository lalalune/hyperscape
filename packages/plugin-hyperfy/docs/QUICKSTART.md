# Hyperfy Content Pack System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install @elizaos/core @elizaos/plugin-hyperfy
```

### 2. Create Your Agent with Hyperfy
```typescript
import { createAgentRuntime } from '@elizaos/core';
import { hyperfyPlugin } from '@elizaos/plugin-hyperfy';

const runtime = await createAgentRuntime({
  agentId: 'my-agent',
  plugins: [hyperfyPlugin],
  character: {
    name: 'MyAgent',
    description: 'An agent that can play games in Hyperfy'
  }
});
```

### 3. Load a Content Pack (e.g., RPG)
```typescript
import { RunescapeRPGPack } from '@hyperfy/rpg-runescape';

const service = runtime.getService('HyperfyService');
await service.initialize(runtime);
await service.loadContentPack(RunescapeRPGPack);

// Your agent now has RPG actions!
```

### 4. Test It Works
```typescript
// Check if actions are available
const attackAction = runtime.getAction('ATTACK_TARGET');
console.log('Attack action available:', !!attackAction);

// Execute an action
const result = await attackAction.handler(runtime, 
  { content: { text: 'Attack the goblin' } },
  { target: 'goblin' }
);
console.log(result.response); // "⚔️ You attack the goblin dealing 8 damage!"
```

## 📦 Creating Your Own Content Pack

### Basic Structure
```typescript
import { IContentPack } from '@elizaos/plugin-hyperfy';

export const MyGamePack: IContentPack = {
  id: 'my-game',
  name: 'My Awesome Game',
  version: '1.0.0',
  
  // Define your actions
  actions: [{
    name: 'MY_ACTION',
    description: 'Does something cool',
    handler: async (runtime, message, state) => ({
      success: true,
      response: 'Action executed!'
    })
  }],
  
  // Define visual colors for testing
  visuals: {
    entityColors: {
      'my.entity': { color: 0xFF00FF, hex: '#FF00FF' }
    }
  }
};
```

### With Game Systems
```typescript
export const MyGamePack: IContentPack = {
  // ... basic info ...
  
  systems: [{
    id: 'score-system',
    name: 'Score System',
    type: 'custom',
    
    init: async (world) => {
      console.log('Score system initialized');
    },
    
    update: (deltaTime) => {
      // Update scores
    },
    
    cleanup: () => {
      console.log('Score system cleaned up');
    }
  }]
};
```

## 🧪 Testing Your Content Pack

### 1. Visual Testing
```typescript
import { VisualTestFramework } from '@elizaos/plugin-hyperfy';

const visualTest = new VisualTestFramework(runtime);
await visualTest.initialize();

// Test with visual verification
const result = await visualTest.runTest('my-test', {
  type: 'visual',
  visualChecks: [{
    entityType: 'my.entity',
    expectedColor: 0xFF00FF,
    shouldExist: true
  }]
});
```

### 2. State Testing
```typescript
const result = await visualTest.runTest('state-test', {
  type: 'state',
  stateChecks: [{
    property: 'score',
    expectedValue: 100,
    operator: 'greater'
  }]
});
```

### 3. E2E Testing
```typescript
// Run the test scenario
npm run test:content-pack

// Or with mock runtime (no real connection needed)
npm run test:content-pack:mock
```

## 🎮 Example Content Packs

### RPG Pack
```typescript
const RPGPack = {
  actions: [
    { name: 'ATTACK', ... },
    { name: 'MINE_ORE', ... },
    { name: 'TRADE', ... }
  ],
  systems: [
    CombatSystem,
    InventorySystem,
    SkillSystem
  ]
};
```

### Racing Pack
```typescript
const RacingPack = {
  actions: [
    { name: 'ACCELERATE', ... },
    { name: 'BRAKE', ... },
    { name: 'DRIFT', ... }
  ],
  systems: [
    PhysicsSystem,
    CheckpointSystem,
    LeaderboardSystem
  ]
};
```

### Social Pack
```typescript
const SocialPack = {
  actions: [
    { name: 'WAVE', ... },
    { name: 'DANCE', ... },
    { name: 'GIFT', ... }
  ],
  providers: [
    { name: 'socialContext', ... }
  ]
};
```

## 🔧 Advanced Features

### Dynamic Action Discovery
```typescript
// World can send available actions
world.sendMessage({
  type: 'world-state',
  data: {
    actions: [
      { id: 'WORLD_ACTION', category: 'world' }
    ]
  }
});
```

### State Management
```typescript
const MyPack = {
  stateManager: {
    initPlayerState: (playerId) => ({
      score: 0,
      achievements: []
    }),
    
    updateState: (playerId, updates) => {
      // Update player state
    }
  }
};
```

### Visual Configuration
```typescript
const MyPack = {
  visuals: {
    entityColors: {
      'enemy.boss': { color: 0xFF0000, hex: '#FF0000' },
      'item.powerup': { color: 0x00FF00, hex: '#00FF00' }
    },
    uiTheme: {
      primaryColor: '#FF00FF'
    }
  }
};
```

## 📝 Best Practices

1. **Always Define Visuals**: Include entity colors for visual testing
2. **Handle Errors**: Gracefully handle missing world features
3. **Clean Up**: Implement cleanup in your systems
4. **Document Actions**: Provide clear descriptions and examples
5. **Version Properly**: Use semantic versioning

## 🆘 Troubleshooting

### Actions Not Available
```typescript
// Check if pack loaded
const loader = service.getContentPackLoader();
console.log('Pack loaded:', loader.isPackLoaded('my-pack'));

// Check if action registered
const action = runtime.getAction('MY_ACTION');
console.log('Action found:', !!action);
```

### Visual Tests Failing
```typescript
// Ensure ColorDetector available
const world = service.getWorld();
console.log('ColorDetector:', !!world?.colorDetector);

// Check visual templates
console.log('Visual config:', pack.visuals);
```

## 📚 Resources

- [Full Documentation](./CONTENT_PACK_SYSTEM.md)
- [Testing Guide](./TESTING_IMPROVEMENT_PLAN.md)
- [Example Packs](../packages/)
- [API Reference](./API.md)

## 🎉 You're Ready!

You now know how to:
- ✅ Load content packs into your agent
- ✅ Create custom content packs
- ✅ Test with visual verification
- ✅ Handle different game types

Happy building! 🚀 