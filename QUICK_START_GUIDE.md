# Quick Start Guide - Hyperscape RPG

## For Game Developers

### Loading the RPG Plugin

```typescript
import { createRPGPlugin } from '@hyperscape/rpg-core'
import { World } from '@hyperscape/hyperfy'

// Create and initialize the plugin
const rpgPlugin = createRPGPlugin({
  debug: true,
  worldGen: { generateDefault: true }
})

// Load into your Hyperfy world
await world.loadPlugin(rpgPlugin)

// Access the public API
const rpg = world.rpg
```

### Using the RPG API

```typescript
// Spawn a player
const playerId = rpg.spawnPlayer({
  id: 'player123',
  position: { x: 0, y: 0, z: 0 },
  stats: {
    hitpoints: { current: 100, max: 100 },
    attack: { level: 10, xp: 0 }
  }
})

// Start combat
rpg.combat.start('player123', 'goblin456')

// Banking operations
rpg.banking.deposit('player123', 500)
const balance = rpg.banking.getBalance('player123')

// Inventory management
rpg.inventory.addItem('player123', {
  id: 'sword001',
  name: 'Iron Sword',
  type: 'weapon'
})
```

### Listening to Game Events

```typescript
world.events.on('player:spawned', (data) => {
  console.log(`Player ${data.playerId} has joined!`)
})

world.events.on('combat:damage', (data) => {
  console.log(`${data.attackerId} dealt ${data.damage} damage!`)
})

world.events.on('banking:deposit', (data) => {
  console.log(`${data.playerId} deposited ${data.amount} gold`)
})
```

## For Test Writers

### Creating a Test Scenario

```typescript
import { TestScenario } from '@hyperscape/test-framework'

export const MyTestScenario: TestScenario = {
  id: 'my-test',
  name: 'My Test Scenario',
  maxDuration: 30000,

  async setup(framework) {
    // Setup your test environment
    const world = framework.getWorld()
    const rpg = world.rpg
    
    // Spawn test entities
    rpg.spawnPlayer({ id: 'testPlayer', ... })
  },

  async condition(framework) {
    // Define success conditions
    // Return true when test passes
    return framework.getState('testPassed') === true
  },

  async cleanup(framework) {
    // Clean up after test
  }
}
```

### Running Tests

```typescript
import { createTestFramework } from '@hyperscape/test-framework'
import { MyTestScenario } from './my-test'

const framework = createTestFramework()
const result = await framework.runScenario(MyTestScenario)

console.log(`Test ${result.passed ? 'PASSED' : 'FAILED'}`)
```

### Using Test Helpers

```typescript
import { RPGTestHelpers } from '@hyperscape/rpg-tests'

// Wait for combat to start
await RPGTestHelpers.waitForCombat(framework, 'player1', 'enemy1')

// Validate player stats
const valid = RPGTestHelpers.validatePlayerStats(player, {
  hp: { min: 50, max: 100 }
})

// Monitor events
RPGTestHelpers.monitorEvent(framework, 'banking:deposit', (data) => {
  // React to banking events
})
```

## Available Events

### Player Events
- `player:spawned` - When a player is created
- `player:damaged` - When a player takes damage
- `player:healed` - When a player is healed
- `player:died` - When a player dies

### Combat Events
- `combat:started` - Combat initiated
- `combat:damage` - Damage dealt
- `combat:miss` - Attack missed
- `combat:death` - Entity killed

### Banking Events
- `banking:deposit` - Gold deposited
- `banking:withdraw` - Gold withdrawn
- `banking:error` - Banking operation failed

### Inventory Events
- `inventory:item_added` - Item added to inventory
- `inventory:item_removed` - Item removed
- `inventory:item_equipped` - Item equipped

## Package Structure

```
@hyperscape/rpg-core      # Core game logic
@hyperscape/test-framework # Testing infrastructure
@hyperscape/rpg-tests     # RPG-specific tests
```

## Next Steps

1. Check out the example scenarios in `packages/rpg-tests/src/scenarios/`
2. Read the API documentation in `packages/rpg-core/src/api/`
3. Explore the test framework docs in `packages/test-framework/README.md` 