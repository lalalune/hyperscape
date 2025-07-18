# @hyperscape/rpg

A comprehensive RPG game system built for Hyperfy virtual worlds, implementing RuneScape-style mechanics including combat, skills, banking, and multiplayer interactions.

## Features

- **Combat System**: Melee and ranged combat with RuneScape-style mechanics
- **Skills System**: 9 skills including Attack, Strength, Defense, Constitution, Range, Woodcutting, Fishing, Firemaking, and Cooking
- **Banking System**: Secure item storage across multiple locations
- **Inventory Management**: 28-slot inventory with equipment system
- **NPC System**: Interactive NPCs with dialogue and shops
- **Loot System**: Dynamic item drops from defeated enemies
- **Multiplayer Support**: Real-time synchronization across players
- **AI Agent Compatible**: Full ElizaOS integration for AI players

## Installation

```bash
npm install @hyperscape/rpg
```

## Quick Start

### As a Hyperfy Plugin

```typescript
import { createRPGPlugin } from '@hyperscape/rpg';

const rpgPlugin = createRPGPlugin({
  debug: true,
  worldGen: {
    generateDefault: true
  }
});

await rpgPlugin.init(world);
```

### As a Hyperfy App

```javascript
// In your Hyperfy world
import { init, update, destroy } from '@hyperscape/rpg/app';

// Initialize the RPG when world loads
await init(world);

// Update each frame
function onUpdate(delta) {
  update(delta);
}

// Cleanup when world unloads
function onDestroy() {
  destroy();
}
```

## Core Systems

### Combat System

The combat system implements RuneScape-style mechanics:

- **Melee Combat**: Swords and shields with attack styles
- **Ranged Combat**: Bows and arrows with ammunition tracking
- **Damage Calculation**: Based on Attack, Strength, and equipment
- **Experience Gain**: Distributed across combat skills

```typescript
// Grant combat XP
rpg.grantXP(playerId, 'attack', 40, 'combat');
rpg.grantXP(playerId, 'strength', 40, 'combat');
rpg.grantXP(playerId, 'constitution', 13, 'combat');
```

### Skills System

Nine skills with RuneScape-style leveling:

- **Combat Skills**: Attack, Strength, Defense, Constitution, Range
- **Gathering Skills**: Woodcutting, Fishing
- **Processing Skills**: Firemaking, Cooking

```typescript
// Check player stats
const stats = rpg.getPlayerStats(playerId);
console.log(`Attack Level: ${stats.attack.level}`);
console.log(`Total Level: ${stats.totalLevel}`);
console.log(`Combat Level: ${stats.combatLevel}`);
```

### Banking System

Secure item storage with multiple bank locations:

```typescript
// Deposit items
const success = rpg.depositItem(playerId, bankId, itemSlot, quantity);

// Withdraw items
const withdrawn = rpg.withdrawItem(playerId, bankId, itemId, quantity);

// Check bank contents
const bankContents = rpg.getBankContents(playerId, bankId);
```

### Inventory System

28-slot inventory with equipment support:

```typescript
// Add items to inventory
rpg.addItem(playerId, itemId, quantity);

// Equip items
rpg.equipItem(playerId, itemId, equipmentSlot);

// Get inventory contents
const inventory = rpg.getInventory(playerId);
```

## Game Design Document Compliance

This package strictly follows the [Game Design Document](./docs/game-design.md) specifications:

- **Exact Skills**: Only the 9 specified skills
- **Equipment Tiers**: Bronze, Steel, Mithril only
- **MVP Scope**: Core mechanics without advanced features
- **Arrow System**: Required ammunition for ranged combat
- **Banking**: Unlimited storage per bank location
- **No Trading**: Player-to-player trading not implemented

## Testing

The package includes comprehensive testing following real-world verification principles:

```bash
# Run all tests
npm test

# Visual tests with Playwright
npm run test:visual

# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration
```

### Testing Philosophy

- **No Mocks**: All tests use real Hyperfy runtime
- **Visual Verification**: Screenshot-based testing with colored entity proxies
- **Error Logging**: Comprehensive error capture and verification
- **Real Worlds**: Mini Hyperfy worlds for each test scenario

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Development mode
npm run dev

# Clean build artifacts
npm run clean

# Build Hyperfy app
npm run build:app
```

## API Reference

### Plugin Configuration

```typescript
interface RPGPluginConfig {
  debug?: boolean;
  worldGen?: {
    generateDefault?: boolean;
    customSpawns?: SpawnArea[];
  };
  systems?: {
    combat?: boolean;
    banking?: boolean;
    skills?: boolean;
  };
  visuals?: {
    enableShadows?: boolean;
    maxViewDistance?: number;
  };
}
```

### Public API Methods

```typescript
// Player Stats
getPlayerStats(playerId: string): StatsComponent
grantXP(playerId: string, skill: string, amount: number, source: string): void

// Inventory
getInventory(playerId: string): InventoryComponent
addItem(playerId: string, itemId: number, quantity: number): boolean
removeItem(playerId: string, itemId: number, quantity: number): boolean

// Banking
getBankContents(playerId: string, bankId: string): BankContents
depositItem(playerId: string, bankId: string, inventorySlot: number, quantity: number): boolean
withdrawItem(playerId: string, bankId: string, itemId: number, quantity: number): boolean

// Equipment
equipItem(playerId: string, itemId: number, slot: EquipmentSlot): boolean
unequipItem(playerId: string, slot: EquipmentSlot): boolean

// World
getWorldTime(): number
isInSafeZone(position: Vector3): boolean

// Events
on(event: string, handler: (data: any) => void): void
off(event: string, handler?: (data: any) => void): void
emit(event: string, data: any): void
```

## Events

The RPG system emits various events for integration:

```typescript
// Listen for events
rpg.on('rpg:level_up', (data) => {
  console.log(`${data.playerId} reached level ${data.newLevel} in ${data.skill}!`);
});

rpg.on('rpg:combat_xp', (data) => {
  console.log(`Combat XP gained: ${data.amount}`);
});

rpg.on('rpg:item_equipped', (data) => {
  console.log(`Item equipped: ${data.itemId} in slot ${data.slot}`);
});
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## Support

For issues and questions:
- GitHub Issues: [hyperscape/rpg/issues](https://github.com/hyperscape/rpg/issues)
- Documentation: [Game Design Document](./docs/game-design.md)
- Testing Guide: [Testing Framework](./tests/README.md)