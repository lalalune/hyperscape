# Actions Overview

[← Back to Index](../README.md)

---

## Complete Action System

Plugin Hyperscape provides 20+ actions that enable AI agents to interact with the 3D world.

---

## Action Categories

### Core World Actions

Basic interactions with the 3D environment:

| Action | Purpose | Example Use Case |
|--------|---------|------------------|
| [perception](perception.md) | Scan environment for entities | "What's around me?" |
| [goto](goto.md) | Navigate to locations/entities | "Go to the tree" |
| [use](use.md) | Use items, interact with objects | "Equip sword", "Open door" |
| [unuse](unuse.md) | Stop using current item | "Put away weapon" |
| [stop](stop.md) | Stop all movement | "Stop walking" |
| [walk_randomly](walk_randomly.md) | Wander exploration | Idle behavior, explore |
| [ambient](ambient.md) | Perform emotes/animations | Wave, dance, sit |
| [build](build.md) | Place/modify entities | Build structures |
| [reply](reply.md) | Respond to chat messages | Social interaction |
| [ignore](ignore.md) | Ignore messages/users | Filter spam |

### RPG Actions

Skill-based interactions:

| Action | Skill | Purpose | Example |
|--------|-------|---------|---------|
| [chopTree](chopTree.md) | Woodcutting | Chop trees for logs | "Get wood" |
| [catchFish](catchFish.md) | Fishing | Catch fish at spots | "Go fishing" |
| [lightFire](lightFire.md) | Firemaking | Start campfires | "Make a fire" |
| [cookFood](cookFood.md) | Cooking | Cook raw food | "Cook this fish" |
| [bankItems](bankItems.md) | Banking | Deposit/withdraw items | "Bank my logs" |
| [checkInventory](checkInventory.md) | Inventory | Inspect inventory | "What do I have?" |
| [continue](continue.md) | General | Continue previous action | Auto-repeat |

---

## Action Lifecycle

Every action follows this lifecycle:

```text
┌─────────────────────────────────────────────────┐
│              Action Lifecycle                    │
└─────────────────────────────────────────────────┘

1. TRIGGER
   ├─ Player message: "Chop some trees"
   └─ LLM decides: chopTree action

2. VALIDATION (action.validate)
   ├─ Check preconditions
   │  ├─ Has required items?
   │  ├─ Target available?
   │  └─ Sufficient skill level?
   ├─ Return: true (proceed) or false (reject)

3. EXECUTION (action.handler)
   ├─ Perform action logic
   │  ├─ Navigate to target
   │  ├─ Execute animation
   │  ├─ Roll for success
   │  └─ Update game state
   └─ Return: success/failure

4. FEEDBACK
   ├─ Update agent memory
   ├─ Update providers (context)
   ├─ Generate response
   └─ Reply to player
```

---

## Action Interface

All actions implement the ElizaOS Action interface:

```typescript
import { Action } from '@elizaos/core';

export const exampleAction: Action = {
  // Unique action identifier
  name: "ACTION_NAME",

  // Human-readable description
  description: "What this action does and when to use it",

  // LLM examples for action selection
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Can you do X?" }
      },
      {
        user: "{{agent}}",
        content: { text: "I'll use ACTION_NAME to do that" }
      }
    ]
  ],

  // Validate if action can execute
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    // Check preconditions
    const service = runtime.getService<HyperscapeService>("hyperscape");

    // Return true if action can proceed
    return checkConditions();
  },

  // Execute the action
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    // Perform action logic
    const service = runtime.getService<HyperscapeService>("hyperscape");

    try {
      // Execute action in world
      const result = await service.executeAction('actionName', params);

      // Success callback
      if (callback) {
        callback({
          text: "Action completed successfully!",
          action: "ACTION_NAME"
        });
      }

      return true;
    } catch (error) {
      logger.error("Action failed:", error);
      return false;
    }
  }
};
```

---

## Action Validation Patterns

### Equipment Check

```typescript
validate: async (runtime, message) => {
  const service = runtime.getService<HyperscapeService>("hyperscape");
  const inventory = service.getPlayerInventory();

  // Check for required item
  const hasAxe = inventory.some(item =>
    item.type === 'axe' && item.equipped === true
  );

  if (!hasAxe) {
    logger.info("Cannot chop tree: No axe equipped");
    return false;
  }

  return true;
}
```

### Proximity Check

```typescript
validate: async (runtime, message) => {
  const service = runtime.getService<HyperscapeService>("hyperscape");

  // Find nearby entity
  const nearby = service.getNearbyEntities(10); // 10m radius
  const tree = nearby.find(e => e.type === 'tree');

  if (!tree) {
    logger.info("Cannot chop tree: No trees nearby");
    return false;
  }

  return true;
}
```

### Skill Level Check

```typescript
validate: async (runtime, message) => {
  const service = runtime.getService<HyperscapeService>("hyperscape");
  const rpgManager = service.getRPGStateManager();

  // Check skill level
  const woodcuttingLevel = rpgManager.getSkillLevel('woodcutting');
  const requiredLevel = tree.requiredLevel || 1;

  if (woodcuttingLevel < requiredLevel) {
    logger.info(`Cannot chop tree: Need level ${requiredLevel}, have ${woodcuttingLevel}`);
    return false;
  }

  return true;
}
```

### State Check

```typescript
validate: async (runtime, message) => {
  const service = runtime.getService<HyperscapeService>("hyperscape");
  const rpgManager = service.getRPGStateManager();

  // Check if inventory is full
  const inventory = rpgManager.getPlayerInventory();
  const maxSlots = rpgManager.getMaxInventorySlots();

  if (inventory.length >= maxSlots) {
    logger.info("Cannot gather: Inventory full");
    return false;
  }

  return true;
}
```

---

## Action Handler Patterns

### Navigate and Execute

```typescript
handler: async (runtime, message, state, options, callback) => {
  const service = runtime.getService<HyperscapeService>("hyperscape");

  // 1. Find target
  const target = await service.findNearestEntity('tree');
  logger.info(`Found tree at distance ${target.distance}m`);

  // 2. Navigate to target
  await service.navigateToEntity(target.id);
  logger.info("Arrived at tree");

  // 3. Execute action
  const result = await service.executeSkillAction('chopTree', {
    targetId: target.id
  });

  // 4. Handle result
  if (result.success) {
    callback({
      text: `Chopped tree! Gained ${result.items.logs} logs and ${result.xp} XP`,
      action: "CHOP_TREE"
    });
    return true;
  }

  return false;
}
```

### State Update

```typescript
handler: async (runtime, message, state, options, callback) => {
  const service = runtime.getService<HyperscapeService>("hyperscape");
  const rpgManager = service.getRPGStateManager();

  // Execute action
  const result = await service.executeAction('bankItems', {
    itemId: 'logs',
    quantity: 10
  });

  // Update local state
  if (result.success) {
    // State is automatically synced by RPGStateManager
    const newInventory = rpgManager.getPlayerInventory();
    const bankContents = rpgManager.getBankContents();

    callback({
      text: `Deposited 10 logs. Bank now has ${bankContents.logs} logs.`,
      action: "BANK_ITEMS"
    });
    return true;
  }

  return false;
}
```

---

## Action Composition

Actions can be composed for complex behaviors:

```typescript
// Macro action: Gather wood and bank it
async function gatherAndBank(runtime: IAgentRuntime) {
  // 1. Chop trees until inventory full
  for (let i = 0; i < 10; i++) {
    const success = await chopTreeAction.handler(runtime, message);
    if (!success) break;
  }

  // 2. Navigate to bank
  await gotoAction.handler(runtime, {
    ...message,
    content: { text: "goto bank" }
  });

  // 3. Deposit items
  await bankItemsAction.handler(runtime, {
    ...message,
    content: { text: "deposit logs" }
  });
}
```

---

## Action Examples by Category

### Movement Actions

```typescript
// Navigate to entity
await gotoAction.handler(runtime, message);

// Random exploration
await walkRandomlyAction.handler(runtime, message);

// Stop movement
await stopAction.handler(runtime, message);
```

### Interaction Actions

```typescript
// Use item
await useAction.handler(runtime, message);

// Stop using item
await unuseAction.handler(runtime, message);

// Scan environment
await perceptionAction.handler(runtime, message);
```

### RPG Actions

```typescript
// Skill actions
await chopTreeAction.handler(runtime, message);
await catchFishAction.handler(runtime, message);
await lightFireAction.handler(runtime, message);
await cookFoodAction.handler(runtime, message);

// Inventory actions
await checkInventoryAction.handler(runtime, message);
await bankItemsAction.handler(runtime, message);
```

### Social Actions

```typescript
// Chat actions
await replyAction.handler(runtime, message);
await ignoreAction.handler(runtime, message);

// Emotes
await ambientAction.handler(runtime, message);
```

---

## Testing Actions

All actions should be tested with real gameplay:

```typescript
import { VisualTestFramework } from '../testing';

describe('chopTree Action', () => {
  it('should chop tree and gain XP', async () => {
    // Setup
    const testFramework = new VisualTestFramework(runtime);
    await testFramework.initialize();

    // Execute action
    const result = await chopTreeAction.handler(runtime, message);

    // Verify with visual + state testing
    const verification = await testFramework.runTest('chopTree', {
      type: 'both',
      visualChecks: [
        { entityType: 'tree', shouldExist: false } // Tree removed
      ],
      stateChecks: [
        {
          property: 'skills.woodcutting.xp',
          expectedValue: 0,
          operator: 'greater'
        },
        {
          property: 'inventory.items',
          expectedValue: 'logs',
          operator: 'contains'
        }
      ],
      screenshot: true
    });

    expect(verification.passed).toBe(true);
  });
});
```

---

## Action Best Practices

### 1. Always Validate

```typescript
// ✅ Good: Validate before executing
validate: async (runtime, message) => {
  return hasRequiredItems() && targetInRange() && hasPermission();
}

// ❌ Bad: No validation
validate: async () => true; // Always returns true
```

### 2. Provide Detailed Feedback

```typescript
// ✅ Good: Detailed callback
callback({
  text: `Chopped oak tree! Gained 3 oak logs and 25 woodcutting XP. Level: 15 → 16`,
  action: "CHOP_TREE",
  details: { logs: 3, xp: 25, levelUp: true }
});

// ❌ Bad: Minimal feedback
callback({ text: "Done" });
```

### 3. Handle Errors Gracefully

```typescript
// ✅ Good: Try-catch with logging
try {
  await service.executeAction('chopTree');
} catch (error) {
  logger.error("chopTree failed:", error);
  callback({ text: "Failed to chop tree. Maybe it's too far?" });
  return false;
}

// ❌ Bad: Let errors crash
await service.executeAction('chopTree'); // May throw
```

### 4. Use Strong Typing

```typescript
// ✅ Good: Strong types, no `any`
const result: ChopTreeResult = await service.executeSkillAction('chopTree', {
  targetId: string,
  toolId: string
});

// ❌ Bad: Using `any`
const result: any = await service.executeSkillAction('chopTree', options);
```

---

## Next Steps

- [Detailed Action Docs](perception.md) - Individual action documentation
- [Adding Custom Actions](../11-development/adding-actions.md) - Create your own
- [Testing Actions](../13-testing-guide/writing-action-tests.md) - Write tests

---

[← Back to Index](../README.md) | [Next: perception Action →](perception.md)
