# Combat System

OSRS-style tick-based combat system for Hyperscape.

## Architecture

```
combat/
├── CombatSystem.ts          # Main orchestrator (1500+ lines)
├── CombatStateService.ts    # Combat state management
├── CombatAnimationManager.ts # Emote/animation handling
├── CombatRotationManager.ts # Entity facing/rotation
├── CombatAntiCheat.ts       # Violation monitoring
├── AggroSystem.ts           # Mob AI and aggro
├── PlayerDeathSystem.ts     # Player death handling
├── MobDeathSystem.ts        # Mob death handling
└── __tests__/               # Unit tests
```

## Key Concepts

### Tick-Based Combat

Combat runs on 600ms server ticks (OSRS-style):
- Attack speed measured in ticks (e.g., 4 ticks = 2.4s)
- Auto-attacks processed every tick
- Combat timeout after 8 ticks of inactivity

### Service Extraction Pattern

CombatSystem orchestrates several single-responsibility services:
- **CombatStateService**: Tracks who is fighting whom
- **CombatAnimationManager**: Schedules combat emotes and resets
- **CombatRotationManager**: Makes entities face their targets
- **CombatAntiCheat**: Monitors for suspicious patterns

### Memory Optimization

- **QuaternionPool**: Pooled quaternions for rotation (zero allocation)
- **Reusable buffers**: `getAllCombatStates()` uses pre-allocated array
- **Tick-based timing**: Uses integers instead of Date objects

## Usage

### Basic Combat Initiation

```typescript
// Player attacks mob
combatSystem.initiateAttack(
  playerId,
  mobId,
  "melee",
  { attackerType: "player", targetType: "mob" }
);

// Mob retaliates
combatSystem.initiateAttack(
  mobId,
  playerId,
  "melee",
  { attackerType: "mob", targetType: "player" }
);
```

### Checking Combat State

```typescript
// Check if entity is in combat
const isInCombat = combatSystem.isInCombat(entityId);

// Get combat target
const targetId = combatSystem.getCombatTarget(entityId);

// Get all active combat states
const states = combatSystem.stateService.getAllCombatStates();
```

### Anti-Cheat Monitoring

```typescript
// Get overall stats
const stats = combatSystem.getAntiCheatStats();
console.log(`${stats.playersAboveWarning} players need attention`);

// Get player-specific report
const report = combatSystem.getAntiCheatPlayerReport(playerId);
console.log(`Player score: ${report.score}`);

// Get current configuration
const config = combatSystem.getAntiCheatConfig();

// Decay scores (call every minute)
combatSystem.decayAntiCheatScores();
```

### Pool Monitoring

```typescript
const poolStats = combatSystem.getPoolStats();
console.log(`Quaternions in use: ${poolStats.quaternions.inUse}`);
```

## Adding New Mob Behaviors

### 1. Define behavior in mobs.json manifest

```json
{
  "id": "dragon",
  "name": "Dragon",
  "behavior": "aggressive",
  "combatRange": 3,
  "attackSpeedTicks": 5,
  "stats": {
    "attack": 80,
    "strength": 85,
    "defence": 70,
    "hitpoints": 200
  }
}
```

### 2. Add behavior constants (if new type)

In `CombatConstants.ts`:

```typescript
MOB_BEHAVIORS: {
  dragon: {
    behavior: "aggressive",
    detectionRange: 8,
    leashRange: 15,
    levelIgnoreThreshold: 999  // Always aggressive
  }
}
```

### 3. Handle special cases in AggroSystem

In `AggroSystem.ts` - `shouldMobAggroPlayer()`:

```typescript
// Dragons aggro regardless of player level
if (mobType === "dragon") {
  return true;
}
```

## Anti-Cheat Configuration

Default configuration can be overridden per-instance:

```typescript
// Development (lenient)
const devAntiCheat = new CombatAntiCheat({
  warningThreshold: 50,
  alertThreshold: 150,
});

// Production (strict)
const prodAntiCheat = new CombatAntiCheat({
  warningThreshold: 15,
  alertThreshold: 50,
  maxAttacksPerTick: 2,
});
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `warningThreshold` | 25 | Score to trigger warning log |
| `alertThreshold` | 75 | Score to trigger admin alert |
| `scoreDecayPerMinute` | 10 | Points removed each minute |
| `maxAttacksPerTick` | 3 | Max attacks before rate violation |
| `maxViolationsPerPlayer` | 100 | Max violations in history |
| `warningCooldownMs` | 60000 | Min time between warnings |

### Violation Severities

| Severity | Points | Examples |
|----------|--------|----------|
| MINOR | 1 | Slight timing issues |
| MODERATE | 5 | Range violations, self-attack |
| MAJOR | 15 | Dead target, nonexistent target |
| CRITICAL | 50 | Invalid entity ID (injection) |

## Testing

```bash
# Run combat tests
cd packages/shared
bun test src/systems/shared/combat

# Run specific test file
bun test src/systems/shared/combat/__tests__/CombatAntiCheat.test.ts
```

## Related Files

- `packages/shared/src/constants/CombatConstants.ts` - Combat timing constants
- `packages/shared/src/utils/game/CombatCalculations.ts` - Damage formulas
- `packages/shared/src/utils/game/CombatValidation.ts` - Input validation
- `packages/shared/src/utils/game/EntityPositionUtils.ts` - Position retrieval
- `packages/shared/src/utils/pools/QuaternionPool.ts` - Rotation pooling

## References

- [OSRS Combat Wiki](https://oldschool.runescape.wiki/w/Combat)
- [OSRS Attack Speed](https://oldschool.runescape.wiki/w/Attack_speed)
- [COMBAT_SYSTEM_HARDENING_PLAN.md](../../../../../COMBAT_SYSTEM_HARDENING_PLAN.md)
- [COMBAT_SYSTEM_IMPROVEMENTS.md](../../../../../COMBAT_SYSTEM_IMPROVEMENTS.md)
