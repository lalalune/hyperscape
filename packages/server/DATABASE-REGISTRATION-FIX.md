# DatabaseSystem Registration Fix

## Issue
Server was crashing on startup with error:
```
[PersistenceSystem] DatabaseSystem not found on server!
```

## Root Causes

### 1. **PersistenceSystem.ts Line 61 Incomplete**
The line was just `this.databaseSystem` without actually assigning the value.

**Fixed:** Added the complete assignment:
```typescript
this.databaseSystem = getSystem<DatabaseSystem>(this.world, 'database') || undefined;
```

### 2. **Server DatabaseSystem Never Registered**
The server's real `DatabaseSystem` from `packages/server/src/DatabaseSystem.ts` was never registered with the world. Instead, only the stub from `packages/shared/src/systems/DatabaseSystem.ts` was being registered.

**Fixed:** Registered the server's DatabaseSystem BEFORE world.init():
```typescript
// Register server's DatabaseSystem BEFORE world.init() so it's available to other systems
const { DatabaseSystem: ServerDatabaseSystem } = await import('./DatabaseSystem.js');
world.register('database', ServerDatabaseSystem);
```

### 3. **Shared SystemLoader Conflict**
The shared `SystemLoader.ts` was trying to register its stub DatabaseSystem, which would override the real one.

**Fixed:** Added a check to prevent re-registration:
```typescript
if (world.isServer && !world.getSystem('database')) {
  // Only register stub if server hasn't already registered the real DatabaseSystem
  const { DatabaseSystem } = await import('./DatabaseSystem');
  world.register('database', DatabaseSystem)
}
```

### 4. **ITEMS Import Dependency**
Server's DatabaseSystem was importing `ITEMS` from `@hyperscape/shared`, but it's not exported from the package.

**Fixed:** Removed the seeding logic since items are seeded by `db.ts` migrations:
```typescript
private async seedInitialData(): Promise<void> {
  // Items are seeded by db.ts migrations during database initialization
  console.log('[DatabaseSystem] Skipping item seeding - handled by db.ts migrations')
}
```

## Files Changed

### packages/shared/src/systems/PersistenceSystem.ts
- Fixed line 61 to properly assign `this.databaseSystem`

### packages/server/src/index.ts
- Added DatabaseSystem registration BEFORE world.init()

### packages/shared/src/systems/SystemLoader.ts
- Added check to prevent overriding server's DatabaseSystem

### packages/server/src/DatabaseSystem.ts
- Removed `ITEMS` import
- Simplified `seedInitialData()` to skip item seeding

## Verification

The server now starts successfully with proper initialization:

```
[Server] Initializing local PostgreSQL via Docker...
[Docker] PostgreSQL container 'hyperscape-postgres' is already running
[DB] ✅ PostgreSQL connection established
[DatabaseSystem] Connecting to PostgreSQL...
[DatabaseSystem] ✅ PostgreSQL connection established
[DatabaseSystem] Skipping migrations - handled by db.ts
[DatabaseSystem] Skipping item seeding - handled by db.ts migrations
DatabaseSystem Database initialized successfully
```

## System Registration Order

The correct order is now:

1. **Server creates world** (`createServerWorld()`)
2. **Server registers DatabaseSystem** (before world.init)
3. **Server registers ServerNetwork** (before world.init)
4. **World.init() runs:**
   - Shared systems register (ActionRegistry, EntityManager, etc.)
   - Shared SystemLoader checks if DatabaseSystem exists (it does, so skips stub)
   - PersistenceSystem initializes and finds DatabaseSystem ✅
   - All other systems initialize with database access

## Testing

To verify the fix works:

```bash
cd packages/server
bun run dev
```

Expected output:
- PostgreSQL connects successfully
- DatabaseSystem initializes without errors
- PersistenceSystem finds DatabaseSystem
- All systems register properly
- Server starts and listens on port 5555

## Related Fixes

This fix completes the PostgreSQL migration started in `MIGRATION-FIXES.md`, addressing the final blocker for server startup.

