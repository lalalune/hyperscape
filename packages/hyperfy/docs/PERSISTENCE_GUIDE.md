# Hyperfy Persistence System Guide

The Hyperfy persistence system provides a generalized approach to storing world and player state data. Instead of having specific tables for each type of data, it uses flexible JSON storage that can accommodate any data structure.

## Schema Overview

### Core Tables

1. **players** - Basic player information
   - `id`: Unique player identifier
   - `username`: Unique username
   - `created_at`: When the player was first seen
   - `last_seen`: Last activity timestamp

2. **player_states** - Per-world player state
   - `player_id`: Reference to the player
   - `world_id`: The world this state belongs to
   - `position`: JSON position data `{x, y, z}`
   - `rotation`: JSON rotation data `{x, y, z, w}`
   - `state`: JSON blob for any custom player data
   - `metadata`: JSON blob for additional metadata

3. **entity_states** - Generic entity storage
   - `entity_id`: Unique entity identifier
   - `world_id`: World the entity belongs to
   - `position`, `rotation`: Transform data
   - `components`: JSON serialized entity components
   - `metadata`: Type, name, and custom data

4. **world_state** - World-level state
   - `world_id`: Unique world identifier
   - `state`: JSON blob for world data
   - `metadata`: Version, settings, etc.

5. **ugc_app_storage** - App-specific storage
   - Allows UGC apps to store their own data
   - Can be player-specific or world-wide

## Usage Examples

### Saving Player State

```typescript
// Save player position and custom RPG data
await persistence.savePlayerState(playerId, {
  position: { x: 100, y: 50, z: 200 },
  rotation: { x: 0, y: 1.5, z: 0, w: 1 },
  // Any custom data can go in the state
  health: 100,
  mana: 50,
  inventory: [
    { itemId: 'sword', quantity: 1 },
    { itemId: 'potion', quantity: 5 }
  ],
  skills: {
    combat: { level: 10, xp: 1500 },
    magic: { level: 5, xp: 250 }
  }
});

// Load player state
const state = await persistence.loadPlayerState(playerId);
if (state) {
  console.log('Position:', state.position);
  console.log('Health:', state.health);
  console.log('Inventory:', state.inventory);
}
```

### Saving Entity State

```typescript
// Entities are automatically serialized with all their components
await persistence.saveEntity(entity);

// Load all entities for a world
const entities = await persistence.loadEntities();
```

### World State Storage

```typescript
// Save world state
await persistence.saveWorldState({
  time: 'day',
  weather: 'sunny',
  npcs: [
    { id: 'merchant', position: {x: 0, y: 0, z: 0} }
  ],
  quests: {
    'main_quest': { stage: 3, completed: false }
  }
});
```

### UGC App Storage

```typescript
// Save app-specific data for a player
await persistence.saveAppData('my-rpg-app', playerId, 'character', {
  class: 'warrior',
  level: 25,
  equipment: { ... }
});

// Save world-wide app data
await persistence.saveAppData('my-rpg-app', null, 'settings', {
  difficulty: 'hard',
  pvpEnabled: true
});
```

## Benefits of Generalized Persistence

1. **Flexibility**: Any data structure can be stored without schema changes
2. **Extensibility**: New features don't require database migrations
3. **Simplicity**: Fewer tables to manage and understand
4. **App Independence**: Each app can store its own data format
5. **Future-proof**: The schema can accommodate any game type or mechanic

## Migration from Specific Tables

If you were using specific RPG tables, migrate your data like this:

```typescript
// Old way (specific tables)
await db.insert(playerInventory).values({
  playerId, slot: 0, itemId: 123, quantity: 1
});

// New way (generalized)
const state = await persistence.loadPlayerState(playerId) || {};
state.inventory = state.inventory || [];
state.inventory[0] = { itemId: 123, quantity: 1 };
await persistence.savePlayerState(playerId, state);
```

## Best Practices

1. **Structure your JSON data consistently** - Use TypeScript interfaces
2. **Version your data formats** - Include version fields in metadata
3. **Validate data on load** - Handle missing or malformed data gracefully
4. **Use compression for large states** - Consider gzipping large JSON blobs
5. **Implement cleanup** - Remove old entities and expired data periodically 