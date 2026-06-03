# Combat System Documentation

> **The Complete Technical Reference for Hyperia's OSRS-Accurate Combat System**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Core Combat Components](#3-core-combat-components)
4. [Aggression & AI System](#4-aggression--ai-system)
5. [Range System](#5-range-system)
6. [Death Systems](#6-death-systems)
7. [Loot & Economy Systems](#7-loot--economy-systems)
8. [Animation & Timing](#8-animation--timing)
9. [Client Visual Systems](#9-client-visual-systems)
10. [OSRS Combat Mechanics](#10-osrs-combat-mechanics)
11. [Combat Flow Diagrams](#11-combat-flow-diagrams)
12. [Damage Calculation](#12-damage-calculation)
13. [Security & Anti-Cheat](#13-security--anti-cheat)
14. [Event Systems](#14-event-systems)
15. [Memory Management](#15-memory-management)
16. [Configuration Reference](#16-configuration-reference)
17. [API Reference](#17-api-reference)

---

## 1. Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE COMBAT SYSTEM ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         CombatSystem (Main Orchestrator)                 │    │
│  │                              ~2,600 lines                                │    │
│  └──────────────────────────────────┬──────────────────────────────────────┘    │
│                                     │                                            │
│         ┌───────────────────────────┼───────────────────────────┐               │
│         │                           │                           │               │
│         ▼                           ▼                           ▼               │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐        │
│  │ StateService │           │AnimationMgr  │           │ RotationMgr  │        │
│  │  (345 lines) │           │ (226 lines)  │           │ (164 lines)  │        │
│  └──────────────┘           └──────────────┘           └──────────────┘        │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          AI & Aggression Layer                           │    │
│  ├──────────────┬──────────────┬──────────────┬───────────────────────────┤    │
│  │  AggroSystem │ RangeSystem  │ CombatLevel  │    CombatStateManager     │    │
│  │ (857 lines)  │ (300 lines)  │ Calculator   │       (280 lines)         │    │
│  │              │              │ (156 lines)  │                           │    │
│  └──────────────┴──────────────┴──────────────┴───────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Security Layer                                  │    │
│  ├──────────────┬──────────────┬──────────────┬───────────────────────────┤    │
│  │  AntiCheat   │ RateLimiter  │  IdValidator │   RequestValidator        │    │
│  │ (911 lines)  │ (311 lines)  │ (226 lines)  │     (245 lines)           │    │
│  └──────────────┴──────────────┴──────────────┴───────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Event & Replay Layer                            │    │
│  ├──────────────┬──────────────┬──────────────┬───────────────────────────┤    │
│  │  EventStore  │ EventBus     │  AuditLog    │     ReplayService         │    │
│  │ (393 lines)  │ (492 lines)  │ (395 lines)  │      (567 lines)          │    │
│  └──────────────┴──────────────┴──────────────┴───────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Death & Animation Layer                         │    │
│  ├──────────────┬──────────────┬──────────────┬───────────────────────────┤    │
│  │ PlayerDeath  │  MobDeath    │ AnimSync     │     PidManager            │    │
│  │(1263 lines)  │ (79 lines)   │ (492 lines)  │     (392 lines)           │    │
│  └──────────────┴──────────────┴──────────────┴───────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Support Systems                                 │    │
│  ├──────────────┬──────────────┬──────────────┬───────────────────────────┤    │
│  │ SeededRandom │ TypeGuards   │ DamageHndlrs │     CombatUtils           │    │
│  │ (284 lines)  │ (545 lines)  │ (417 lines)  │     (358 lines)           │    │
│  └──────────────┴──────────────┴──────────────┴───────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                    Total: ~23,100+ lines of combat code
                           57 combat-related files
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **OSRS Accuracy** | Tick-based timing (600ms), authentic formulas, PID shuffle, tolerance timer |
| **Type Safety** | Runtime type guards, branded IDs, zero `any` types |
| **Zero Allocations** | Object pooling, pre-allocated tile buffers |
| **Security First** | OWASP validation, HMAC signing, rate limiting, anti-cheat scoring |
| **Separation of Concerns** | Dedicated systems for aggro, death, animation, replay |
| **Strategy Pattern** | Pluggable damage handlers for player/mob |
| **Event Sourcing** | Full replay capability via EventStore + ReplayService |

---

## 2. File Structure

```
packages/shared/src/
├── systems/shared/combat/
│   ├── CombatSystem.ts              # Main orchestrator (2,600 lines)
│   ├── CombatStateService.ts        # State management (345 lines)
│   ├── CombatAnimationManager.ts    # Animation control (226 lines)
│   ├── CombatRotationManager.ts     # Entity rotation (164 lines)
│   ├── CombatAntiCheat.ts           # Anti-cheat monitoring (911 lines)
│   ├── CombatRateLimiter.ts         # Rate limiting (311 lines)
│   ├── EntityIdValidator.ts         # Input validation (226 lines)
│   ├── CombatEventBus.ts            # Type-safe event emission (492 lines)
│   ├── CombatAuditLog.ts            # Persistent logging (395 lines)
│   ├── CombatRequestValidator.ts    # HMAC signing (245 lines)
│   ├── CombatReplayService.ts       # Replay & debugging (567 lines)
│   ├── CombatAnimationSync.ts       # Animation-damage sync (492 lines)
│   ├── RangeSystem.ts               # OSRS range calculations (300 lines)
│   ├── AggroSystem.ts               # Mob AI & aggression (857 lines)
│   ├── MobDeathSystem.ts            # Mob death handling (79 lines)
│   ├── PlayerDeathSystem.ts         # Player death/respawn (1,263 lines)
│   ├── PidManager.ts                # OSRS PID system (392 lines)
│   └── handlers/
│       ├── index.ts                 # Barrel export
│       ├── DamageHandler.ts         # Strategy interface (120 lines)
│       ├── PlayerDamageHandler.ts   # Player damage (152 lines)
│       └── MobDamageHandler.ts      # Mob damage (145 lines)
├── systems/shared/
│   └── EventStore.ts                # Replay system (393 lines)
├── entities/managers/
│   ├── CombatStateManager.ts        # Per-entity combat state (280 lines)
│   ├── PlayerCombatStateManager.ts  # Player combat/auto-retaliate (406 lines)
│   ├── DeathStateManager.ts         # Mob death animation/respawn (222 lines)
│   ├── AggroManager.ts              # Per-entity aggro targeting (306 lines)
│   ├── AIStateMachine.ts            # Mob AI state machine (568 lines)
│   └── RespawnManager.ts            # Mob respawn locations/timing (251 lines)
├── systems/shared/economy/
│   ├── LootSystem.ts                # Loot drop orchestration (203 lines)
│   ├── LootTableService.ts          # Loot table logic/rolling (204 lines)
│   └── GroundItemSystem.ts          # OSRS-style ground items (633 lines)
├── systems/shared/character/
│   └── HealthRegenSystem.ts         # OSRS passive health regen (230 lines)
├── systems/client/
│   ├── DamageSplatSystem.ts         # Client damage visualization (238 lines)
│   ├── XPDropSystem.ts              # Client XP drop display (226 lines)
│   └── HealthBars.ts                # Health bar rendering (439 lines)
├── utils/rendering/
│   └── HealthBarRenderer.ts         # Health bar drawing (215 lines)
├── systems/shared/death/
│   ├── DeathStateManager.ts         # Player death persistence (368 lines)
│   ├── ZoneDetectionSystem.ts       # Zone type lookup (213 lines)
│   ├── SafeAreaDeathHandler.ts      # Gravestone system (322 lines)
│   └── WildernessDeathHandler.ts    # Immediate ground items (130 lines)
├── constants/
│   └── CombatConstants.ts           # All combat constants (173 lines)
├── entities/
│   ├── CombatantEntity.ts          # Abstract base for combat entities (444 lines)
│   └── npc/
│       └── MobEntity.ts            # Mob AI, combat, loot (2,840 lines)
│   └── player/
│       └── PlayerEntity.ts         # Server-side player (896 lines)
├── components/
│   ├── CombatComponent.ts          # ECS combat data component (51 lines)
│   └── HealthComponent.ts          # ECS health component (233 lines)
├── types/game/
│   └── combat-types.ts             # Combat type definitions (88 lines)
├── types/death/
│   └── death-types.ts              # Death system type definitions (104 lines)
└── utils/
    ├── SeededRandom.ts              # Deterministic RNG (284 lines)
    ├── typeGuards.ts                # Runtime type validation (545 lines)
    └── game/
        ├── CombatLevelCalculator.ts # OSRS combat level formula (156 lines)
        ├── CombatCalculations.ts    # Damage/accuracy formulas (468 lines)
        ├── CombatValidation.ts      # Input validation utilities (223 lines)
        ├── HitDelayCalculator.ts    # OSRS hit delay/projectiles (345 lines)
        └── CombatUtils.ts           # Combat helper functions (358 lines)

packages/server/src/
├── systems/ServerNetwork/handlers/
│   └── combat.ts                   # Server-side combat validation (210 lines)
└── systems/KillTrackerSystem/
    └── index.ts                    # Kill statistics tracking (93 lines)
```

---

## 3. Core Combat Components

### 3.1 CombatSystem (Main Orchestrator)

The central hub that coordinates all combat operations.

```typescript
class CombatSystem extends SystemBase {
  // === Dependencies ===
  private stateService: CombatStateService;
  private animationManager: CombatAnimationManager;
  private rotationManager: CombatRotationManager;
  private antiCheat: CombatAntiCheat;
  private rateLimiter: CombatRateLimiter;
  private eventStore: EventStore;
  private pidManager: PidManager;
  private damageHandlers: Map<string, DamageHandler>;

  // === State ===
  private nextAttackTicks: Map<EntityID, number>;
  private playerEquipmentStats: Map<string, EquipmentStats>;
  private lastInputTick: Map<string, number>;  // AFK tracking

  // === Pooled Objects (Zero GC) ===
  private _attackerTile: PooledTile;
  private _targetTile: PooledTile;
}
```

**Key Responsibilities:**
- Processing combat ticks (600ms intervals)
- Validating attack requests
- Coordinating damage calculation and application
- Managing combat state lifecycle
- Emitting combat events

### 3.2 CombatStateService

Manages all combat state data with proper encapsulation.

```typescript
interface CombatData {
  attackerId: EntityID;
  targetId: EntityID;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  inCombat: boolean;
  lastAttackTick: number;
  nextAttackTick: number;
  combatEndTick: number;           // 8 ticks after last hit
  attackSpeedTicks: number;        // Weapon-dependent
}
```

### 3.3 Damage Handlers (Strategy Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Strategy Pattern: Damage Handlers             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    <<interface>>                                 │
│                   ┌──────────────┐                              │
│                   │DamageHandler │                              │
│                   ├──────────────┤                              │
│                   │ entityType   │                              │
│                   │ applyDamage()│                              │
│                   └──────┬───────┘                              │
│                          │                                       │
│            ┌─────────────┴─────────────┐                        │
│            │                           │                        │
│            ▼                           ▼                        │
│  ┌──────────────────┐       ┌──────────────────┐               │
│  │PlayerDamageHandler│       │ MobDamageHandler │               │
│  ├──────────────────┤       ├──────────────────┤               │
│  │ entityType="player"      │ entityType="mob" │               │
│  │ - Get player     │       │ - Get mob entity │               │
│  │ - Apply via      │       │ - Call takeDamage│               │
│  │   health component       │ - Trigger AI     │               │
│  │ - Sync network   │       │   damage handler │               │
│  └──────────────────┘       └──────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 CombatantEntity (Base Class)

The `CombatantEntity.ts` (444 lines) is the abstract base class for all entities that can engage in combat.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTITY INHERITANCE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        Entity                                    │
│                          │                                       │
│                          ▼                                       │
│                   CombatantEntity                                │
│                    (abstract)                                    │
│              ┌───────────────────────┐                          │
│              │ • Combat statistics   │                          │
│              │ • Damage calculation  │                          │
│              │ • Death handling      │                          │
│              │ • Respawn system      │                          │
│              │ • Target management   │                          │
│              └───────────┬───────────┘                          │
│                          │                                       │
│            ┌─────────────┴─────────────┐                        │
│            │                           │                        │
│            ▼                           ▼                        │
│      PlayerEntity                 MobEntity                     │
│      (players)                    (enemies)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
abstract class CombatantEntity extends Entity {
  // Combat statistics
  protected attackPower: number;
  protected defense: number;
  protected attackSpeed: number;
  protected criticalChance: number;
  protected combatLevel: number;

  // Combat methods
  calculateDamage(target: CombatantEntity): number;
  attackTarget(target: CombatantEntity): boolean;
  takeDamage(damage: number, attackerId?: string): boolean;
  setTarget(targetId: string | null): void;

  // Death/Respawn
  protected die(): void;
  respawn(): void;

  // Getters
  getAttack(): number;
  getDefense(): number;
  getCombatLevel(): number;
  getTargetId(): string | null;
  getSpawnPosition(): Position3D;
}
```

### 3.5 CombatComponent (ECS Data)

The `CombatComponent.ts` (51 lines) provides the ECS data container for combat state on entities.

```typescript
class CombatComponent extends Component {
  isInCombat: boolean = false;    // Currently in combat?
  target: string | null = null;   // Current target ID
  lastAttackTime: number = 0;     // Timestamp of last attack
  attackCooldown: number = 1000;  // Ms between attacks
  damage: number = 10;            // Base damage value
  range: number = 2;              // Attack range

  // Serializable for network sync
  serialize(): Record<string, unknown>;
}
```

**Note:** Combat logic is handled by `CombatSystem`, not the component itself. The component is purely a data container following ECS principles.

### 3.6 PlayerCombatStateManager

The `PlayerCombatStateManager.ts` (406 lines) manages player-specific combat state with OSRS-accurate mechanics.

```typescript
class PlayerCombatStateManager {
  // Core state
  private inCombat: boolean;
  private targetId: string | null;
  private lastAttackerId: string | null;

  // Auto-retaliate (enabled by default in OSRS)
  private autoRetaliateEnabled = true;

  // AFK tracking (20 minutes disables auto-retaliate)
  private lastActionTick: number;

  // Logout prevention (9.6 seconds after damage)
  private lastDamageTakenTick: number;

  // Combat methods
  canAttack(currentTick: number): boolean;
  performAttack(targetId: string, currentTick: number): boolean;
  onReceiveAttack(attackerId: string, currentTick: number): void;

  // OSRS auto-retaliate timing: ceil(attackSpeed / 2) + 1 ticks
  private shouldAutoRetaliate(currentTick: number): boolean;

  // Logout check (16 ticks after damage)
  canLogout(currentTick: number): boolean;

  // AFK check (2000 ticks = 20 minutes)
  isAFK(currentTick: number): boolean;
}
```

**OSRS-Accurate Features:**
- Auto-retaliate delay: `ceil(attackSpeed / 2) + 1` ticks
- AFK timeout: 2000 ticks (20 minutes) disables auto-retaliate
- Logout prevention: 16 ticks (9.6 seconds) after taking damage
- Combat timeout: 8 ticks (4.8 seconds) of inactivity

### 3.7 PidManager (OSRS PID Shuffle)

Ensures fair PvP combat priority using OSRS-accurate PID system.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PID Shuffle System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Time: 0s           60-150s           120-300s                  │
│        │              │                  │                       │
│        ▼              ▼                  ▼                       │
│  ┌──────────┐   ┌──────────┐      ┌──────────┐                 │
│  │ Initial  │   │ Shuffle  │      │ Shuffle  │                 │
│  │ PIDs     │   │ #1       │      │ #2       │   ...           │
│  └──────────┘   └──────────┘      └──────────┘                 │
│                                                                  │
│  Player PIDs Before Shuffle:    After Shuffle:                  │
│  ┌────────────────────┐         ┌────────────────────┐         │
│  │ Alice: PID 0       │         │ Alice: PID 2       │         │
│  │ Bob:   PID 1       │  ───►   │ Bob:   PID 0       │         │
│  │ Carol: PID 2       │         │ Carol: PID 1       │         │
│  └────────────────────┘         └────────────────────┘         │
│                                                                  │
│  Combat Priority: Lower PID attacks FIRST                       │
│  Shuffle Interval: 100-250 ticks (60-150 seconds)               │
│  Algorithm: Fisher-Yates (deterministic via SeededRandom)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.8 MobEntity (Enemy AI & Combat)

The main mob/monster entity class (2,840 lines). Handles AI behavior, combat execution, and loot drops.

```typescript
class MobEntity extends CombatantEntity {
  // === AI State Machine ===
  private aiStateMachine: AIStateMachine;
  private aggroManager: AggroManager;
  private deathStateManager: DeathStateManager;
  private respawnManager: RespawnManager;

  // === Combat Stats ===
  private config: MobConfig;         // Attack, defense, speed
  private combatLevel: number;       // XP calculation
  private attackRange: number;       // Melee or ranged

  // === Key Methods ===
  takeDamage(amount: number, attackerId?: string): boolean;
  die(killerId: string): void;
  respawn(): void;
  setTarget(targetId: string | null): void;
  isAttackable(): boolean;
  getCombatRange(): number;
}
```

**AI States**: Idle → Patrol → Aggro → Combat → Fleeing → Dead → Respawn

### 3.9 PlayerEntity (Server-Side Player)

The authoritative player entity (896 lines). Manages combat stats, equipment, and skills.

```typescript
class PlayerEntity extends CombatantEntity {
  // === Combat State ===
  private combatStateManager: PlayerCombatStateManager;
  private combatStyle: PlayerCombatStyle;     // accurate/aggressive/etc
  private autoRetaliate: boolean;

  // === Stats & Equipment ===
  private stats: StatsComponent;              // Attack, strength, defense levels
  private equipment: EquipmentComponent;      // Weapon, armor bonuses
  private combatLevel: number;                // Calculated from stats

  // === Key Methods ===
  getAttackBonus(): number;
  getDefenseBonus(): number;
  getStrengthBonus(): number;
  getCombatLevel(): number;
  takeDamage(amount: number, attackerId?: string): void;
  die(killerId: string): void;
}
```

### 3.10 HealthComponent (ECS Health)

The ECS component for entity health (233 lines). Used by both players and mobs.

```typescript
class HealthComponent extends Component {
  // === Properties ===
  maxHealth: number;           // Maximum HP
  currentHealth: number;       // Current HP (0 to max)
  regeneration: number;        // HP regen rate
  invulnerable: boolean;       // Immune to damage
  lastDamageTime: number;      // For regen cooldown

  // === Methods ===
  takeDamage(amount: number): number;  // Returns actual damage taken
  heal(amount: number): number;        // Returns actual healing
  isDead: boolean;                     // true if currentHealth <= 0

  // === Events Emitted ===
  // ENTITY_HEALTH_CHANGED - On any health change
  // ENTITY_DIED - When health reaches 0
}
```

### 3.11 Server Combat Handler

Server-side combat message validation (210 lines). Validates client requests before forwarding to CombatSystem.

```typescript
// packages/server/src/systems/ServerNetwork/handlers/combat.ts

// Security measures:
// - Input validation (type, format, length)
// - Rate limiting (3 requests/sec via SlidingWindowRateLimiter)
// - Timestamp validation (prevents replay attacks)
// - Server-side entity existence verification

function handleAttackMob(socket: ServerSocket, data: unknown, world: World): void;
function handleSetAttackStyle(socket: ServerSocket, data: unknown, world: World): void;
function handleDisengage(socket: ServerSocket, data: unknown, world: World): void;

// Valid attack styles whitelist
const VALID_ATTACK_STYLES = new Set(["accurate", "aggressive", "defensive", "controlled"]);
```

---

## 4. Aggression & AI System

### 4.1 AggroSystem Overview

The AggroSystem handles mob AI, aggression detection, and chase mechanics.

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGGRO SYSTEM FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Player Moves]                                                  │
│        │                                                         │
│        ▼                                                         │
│  ┌──────────────────┐                                           │
│  │ Update Tolerance │ ──► Track time in 21×21 region            │
│  │ State            │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Check Detection  │ ──► NO ───► Remove from aggro list        │
│  │ Range            │                                           │
│  └────────┬─────────┘                                           │
│           │ YES                                                  │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Mob Behavior     │ ──► PASSIVE ──► No aggro                  │
│  │ Check            │                                           │
│  └────────┬─────────┘                                           │
│           │ AGGRESSIVE                                           │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Double-Level     │ ──► Player > Mob×2 ──► Ignore player      │
│  │ Rule Check       │                                           │
│  └────────┬─────────┘                                           │
│           │ PASS                                                 │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Tolerance Timer  │ ──► Expired (10min) ──► Ignore player     │
│  │ Check            │                                           │
│  └────────┬─────────┘                                           │
│           │ ACTIVE                                               │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Add to Aggro     │ ──► Start chasing if not in combat        │
│  │ Targets          │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Tolerance Timer System

OSRS-accurate tolerance timer that stops aggression after 10 minutes in a region.

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOLERANCE TIMER SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  World divided into 21×21 tile regions                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Region 0:0  │  Region 1:0  │  Region 2:0  │   ...      │    │
│  │    21×21     │    21×21     │    21×21     │            │    │
│  ├──────────────┼──────────────┼──────────────┼────────────┤    │
│  │  Region 0:1  │  Region 1:1  │  Region 2:1  │            │    │
│  │              │     ★        │              │            │    │
│  └──────────────┴──────────────┴──────────────┴────────────┘    │
│                       ↑                                          │
│                  Player here                                     │
│                                                                  │
│  Timeline:                                                       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  T=0                T=500                T=1000 (10 min)         │
│   │                   │                    │                     │
│   ▼                   ▼                    ▼                     │
│  ┌──────┐         ┌──────┐            ┌──────┐                  │
│  │Enter │─────────│ Mobs │────────────│ Mobs │                  │
│  │Region│ Aggro   │ Still│  Tolerance │ Stop │                  │
│  └──────┘ Active  │Attack│  Expired   │Aggro │                  │
│                   └──────┘            └──────┘                  │
│                                                                  │
│  Moving to new region RESETS the 10-minute timer                │
│  Bosses (toleranceImmune = true) ignore this system             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Combat Level Calculator

OSRS-accurate combat level formula for aggression checks.

```typescript
/**
 * Formula:
 *   Base = 0.25 × (Defence + Hitpoints + floor(Prayer / 2))
 *   Melee = 0.325 × (Attack + Strength)
 *   Ranged = 0.325 × floor(Ranged × 1.5)
 *   Magic = 0.325 × floor(Magic × 1.5)
 *   Combat Level = floor(Base + max(Melee, Ranged, Magic))
 *
 * Range: 3 (minimum) to 126 (maximum with all 99s)
 */
function calculateCombatLevel(skills: CombatSkills): number;

/**
 * Double-Level Aggro Rule:
 * Mobs ignore players whose combat level is MORE THAN DOUBLE the mob's level.
 *
 * Examples:
 * - Level 2 goblin ignores level 5+ players (5 > 2×2 = 4)
 * - Level 10 guard ignores level 21+ players (21 > 10×2 = 20)
 */
function shouldMobIgnorePlayer(
  playerCombatLevel: number,
  mobLevel: number,
  toleranceImmune: boolean
): boolean;
```

### 4.4 AIStateMachine (Mob AI)

The `AIStateMachine.ts` (568 lines) provides a complete state machine for mob AI behavior.

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOB AI STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                       ┌──────────┐                               │
│                       │   IDLE   │◄─────────────────────────┐   │
│                       └────┬─────┘                          │   │
│            Player in range │     │ Idle timeout             │   │
│                            ▼     ▼                          │   │
│                       ┌──────────┐                          │   │
│                       │  WANDER  │                          │   │
│                       └────┬─────┘                          │   │
│            Player in range │                                │   │
│                            ▼                                │   │
│                       ┌──────────┐  Out of leash range      │   │
│           ┌──────────►│  CHASE   │──────────────────────────┤   │
│           │           └────┬─────┘                          │   │
│           │ Out of range   │ In combat range                │   │
│           │                ▼                                │   │
│           │           ┌──────────┐  Target died/left        │   │
│           └───────────│  ATTACK  │──────────────────────────┘   │
│                       └──────────┘                              │
│                                                                  │
│  OSRS-Accurate Features:                                        │
│  • Tile-based distance (not world distance)                     │
│  • Range 1 melee: Cardinal only (no diagonal)                   │
│  • Same-tile handling: Step out to random cardinal direction    │
│  • Leash behavior: Stop in place, don't walk back               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
class AIStateMachine {
  private states: Map<MobAIState, AIState>;
  private currentState: AIState;

  // State implementations
  // IdleState: Wait, then wander (unless stationary)
  // WanderState: Move to random tile within wander radius
  // ChaseState: Path to combat range tile (not player tile)
  // AttackState: Attack from current tile, step-out if same tile
  // ReturnState: Walk back to spawn (for retreat, not leashing)

  update(context: AIStateContext, deltaTime: number): void;
  transitionTo(newState: MobAIState, context: AIStateContext): void;
  getCurrentState(): MobAIState;
}
```

### 4.5 AggroManager (Per-Entity Targeting)

The `AggroManager.ts` (306 lines) handles target acquisition with OSRS-accurate random selection.

```typescript
class AggroManager {
  private currentTarget: string | null;
  private config: AggroConfig;

  // Zero-allocation buffer for valid targets
  private readonly _validTargetsBuffer: PlayerTarget[];

  // OSRS-accurate: Random selection from ALL valid candidates
  // (not first-found, not closest)
  findNearbyPlayer(
    currentPos: Position3D,
    players: Array<{id: string; position: Position3D}>
  ): PlayerTarget | null;

  // Tile-based range checks (Chebyshev distance)
  isInAggroRange(mobPos: Position3D, targetPos: Position3D): boolean;
  isInCombatRange(mobPos: Position3D, targetPos: Position3D): boolean;

  // Target management
  setTarget(playerId: string): void;
  clearTarget(): void;
  setTargetIfNone(playerId: string): void;  // For aggro-on-damage
}
```

---

## 5. Range System

### 5.1 Three OSRS Range Types

```
┌─────────────────────────────────────────────────────────────────┐
│                    OSRS RANGE TYPES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. HUNT RANGE (Aggro Detection)                                 │
│  ───────────────────────────────                                │
│  Origin: SW tile only                                            │
│  Purpose: NPC searches for targets                               │
│                                                                  │
│       ┌───┬───┬───┬───┐                                         │
│       │   │   │   │   │  Hunt range = 5 tiles                   │
│       ├───┼───┼───┼───┤  Measured from SW corner                │
│       │   │ N │ N │   │                                         │
│       ├───┼───┼───┼───┤                                         │
│       │   │ N │ N │   │  N = NPC (2×2)                          │
│       ├───┼───┼───┼───┤  SW tile = origin for hunt range        │
│       │SW─│───│───│───│──► Hunt range measured from here        │
│       └───┴───┴───┴───┘                                         │
│                                                                  │
│  2. ATTACK RANGE (Can Perform Attack)                            │
│  ───────────────────────────────────                            │
│  Origin: ALL occupied tiles                                      │
│  Purpose: Check if NPC can hit target                            │
│                                                                  │
│       ┌───┬───┬───┬───┬───┐                                     │
│       │ ✓ │ ✓ │ ✓ │ ✓ │ ✓ │  Attack range = 1 (melee)          │
│       ├───┼───┼───┼───┼───┤  Player can be attacked if          │
│       │ ✓ │ N │ N │ ✓ │   │  adjacent to ANY occupied tile      │
│       ├───┼───┼───┼───┼───┤                                     │
│       │ ✓ │ N │ N │ ✓ │   │  ✓ = Valid attack position          │
│       ├───┼───┼───┼───┼───┤                                     │
│       │ ✓ │ ✓ │ ✓ │ ✓ │   │                                     │
│       └───┴───┴───┴───┴───┘                                     │
│                                                                  │
│  3. MAX RANGE (Leashing)                                         │
│  ───────────────────────                                        │
│  Origin: Spawn point                                             │
│  Purpose: NPC returns if too far from spawn                      │
│                                                                  │
│       ┌─────────────────────────────────────┐                   │
│       │                                     │                   │
│       │         Max Range Circle            │                   │
│       │              ┌───┐                  │                   │
│       │              │ S │ Spawn point      │                   │
│       │              └───┘                  │                   │
│       │                                     │                   │
│       │    NPC outside circle → Return      │                   │
│       │                                     │                   │
│       └─────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 NPC Size System

```typescript
// NPCs occupy multiple tiles based on size
const NPC_SIZES: Record<string, NPCSize> = {
  // 1×1 (default)
  goblin: { width: 1, depth: 1 },
  skeleton: { width: 1, depth: 1 },

  // 2×2
  general_graardor: { width: 2, depth: 2 },
  giant_mole: { width: 2, depth: 2 },

  // 3×3
  corporeal_beast: { width: 3, depth: 3 },
  king_black_dragon: { width: 3, depth: 3 },

  // 4×4
  vorkath: { width: 4, depth: 4 },

  // 5×5
  olm_head: { width: 5, depth: 5 },
};
```

### 5.3 Melee Range Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                    OSRS MELEE RANGE RULES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Range 1 (Standard Melee) - CARDINAL ONLY:                      │
│                                                                  │
│       ╳   ✓   ╳           ╳ = Cannot attack                    │
│       ✓   A   ✓           ✓ = Can attack                       │
│       ╳   ✓   ╳           A = Attacker position                │
│                                                                  │
│  Range 2 (Halberd/Spear) - INCLUDES DIAGONAL:                   │
│                                                                  │
│   ╳   ✓   ✓   ✓   ╳                                            │
│   ✓   ✓   ✓   ✓   ✓                                            │
│   ✓   ✓   A   ✓   ✓                                            │
│   ✓   ✓   ✓   ✓   ✓                                            │
│   ╳   ✓   ✓   ✓   ╳                                            │
│                                                                  │
│  Implementation:                                                 │
│  ─────────────────                                              │
│  if (range === 1) {                                             │
│    // Cardinal only: one axis must be 0, other ≤ 1              │
│    return (dx === 0 && dz <= 1) || (dz === 0 && dx <= 1);      │
│  }                                                               │
│  // Range 2+: Chebyshev distance                                │
│  return Math.max(dx, dz) <= range;                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Death Systems

### 6.1 Death System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEATH SYSTEM ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ENTITY_DEATH Event                            │
│                          │                                       │
│            ┌─────────────┴─────────────┐                        │
│            │                           │                        │
│            ▼                           ▼                        │
│  ┌──────────────────┐       ┌──────────────────┐               │
│  │ PlayerDeathSystem│       │  MobDeathSystem  │               │
│  │   (1,263 lines)  │       │    (79 lines)    │               │
│  ├──────────────────┤       ├──────────────────┤               │
│  │ • Zone detection │       │ • Despawn mob    │               │
│  │ • Gravestone     │       │ • Trigger loot   │               │
│  │ • Ground items   │       │ • Death animation│               │
│  │ • Respawn        │       │ • Respawn timer  │               │
│  │ • Death lock     │       │                  │               │
│  └──────────────────┘       └──────────────────┘               │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Modular Death Handlers                 │    │
│  ├──────────────────┬──────────────────────────────────────┤    │
│  │SafeAreaHandler   │ WildernessDeathHandler               │    │
│  │• Gravestone 5min │ • Immediate ground items             │    │
│  │• Then ground 2min│ • 2 minute despawn                   │    │
│  │• Items protected │ • Items visible to all               │    │
│  └──────────────────┴──────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Player Death Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYER DEATH FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Player Health = 0]                                             │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────┐                                           │
│  │ Rate Limit Check │ ──► < 10s since last death ──► BLOCKED   │
│  └────────┬─────────┘                                           │
│           │ PASS                                                 │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Death Lock Check │ ──► Already has lock ──► BLOCKED         │
│  └────────┬─────────┘     (prevents duplication)                │
│           │ PASS                                                 │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Database         │ ──► Atomic transaction                    │
│  │ Transaction      │     (rollback on failure)                 │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Detect Zone Type │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│     ┌─────┴─────┐                                               │
│     │           │                                               │
│     ▼           ▼                                               │
│  SAFE AREA   WILDERNESS                                         │
│     │           │                                               │
│     ▼           ▼                                               │
│  Gravestone  Immediate                                          │
│  (5 min)     Ground Items                                       │
│     │        (2 min)                                            │
│     ▼                                                           │
│  Ground Items                                                    │
│  (2 min)                                                         │
│     │                                                            │
│     ▼                                                            │
│  ┌──────────────────┐                                           │
│  │ Play Death Anim  │ ──► 4.5 seconds                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Respawn at       │ ──► Central Haven (0, 0)                  │
│  │ Spawn Point      │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Spawn Gravestone │ ──► AFTER respawn (RuneScape-style)       │
│  │ (Safe Areas)     │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 ZoneDetectionSystem

The `ZoneDetectionSystem.ts` (213 lines) provides zone lookup with caching for performance.

```typescript
class ZoneDetectionSystem extends SystemBase {
  // Cache zone lookups (10×10 grid chunks)
  private zoneCache = new Map<string, ZoneProperties>();

  // Zone type checks
  isWilderness(position: {x: number; z: number}): boolean;
  isSafeZone(position: {x: number; z: number}): boolean;
  isPvPEnabled(position: {x: number; z: number}): boolean;

  // Full zone properties
  getZoneProperties(position: {x: number; z: number}): ZoneProperties;
}

interface ZoneProperties {
  type: ZoneType;
  isSafe: boolean;
  isPvPEnabled: boolean;
  isWilderness: boolean;
  name: string;
  difficultyLevel: number;
}

enum ZoneType {
  SAFE_AREA,    // Gravestone → Ground items
  WILDERNESS,   // Immediate ground items
  PVP_ZONE,     // Special PvP rules
}
```

### 6.4 SafeAreaDeathHandler

The `SafeAreaDeathHandler.ts` (322 lines) handles gravestone-based death in safe zones.

```typescript
class SafeAreaDeathHandler {
  // Tick-based gravestone tracking (no setTimeout)
  private gravestones = new Map<string, GravestoneData>();

  // Handle death: spawn gravestone with items
  async handleDeath(
    playerId: string,
    position: {x: number; y: number; z: number},
    items: InventoryItem[],
    killedBy: string,
    tx?: Transaction,  // Atomic transaction support
  ): Promise<void>;

  // Tick processing: check for expired gravestones
  processTick(currentTick: number): void;

  // Gravestone → Ground items on expiration
  private handleGravestoneExpire(data: GravestoneData, tick: number): void;
}
```

**OSRS-Accurate Timing:**
- Gravestone: 500 ticks (5 minutes)
- Ground items: 200 ticks (2 minutes) after gravestone expires
- Items protected from other players while in gravestone

### 6.5 WildernessDeathHandler

The `WildernessDeathHandler.ts` (130 lines) handles immediate ground item drops in dangerous zones.

```typescript
class WildernessDeathHandler {
  // Handle death: spawn ground items immediately
  async handleDeath(
    playerId: string,
    position: {x: number; y: number; z: number},
    items: InventoryItem[],
    killedBy: string,
    zoneType: ZoneType,
    tx?: Transaction,
  ): Promise<void>;
}
```

**Wilderness Death Rules:**
- Items drop immediately as ground items (no gravestone)
- Ground items despawn after 200 ticks (2 minutes)
- Killer has 100 ticks (1 minute) loot protection
- Items scattered with 3.0 tile radius

### 6.6 DeathStateManager (Player Persistence)

The `systems/shared/death/DeathStateManager.ts` (368 lines) manages player death tracking with database persistence.

```typescript
class DeathStateManager {
  private activeDeaths = new Map<string, DeathLock>();  // In-memory cache
  private databaseSystem: DatabaseSystem | null;        // Server-only

  // Register a player death (persists to DB on server)
  async registerDeath(
    playerId: string,
    position: Position3D,
    zoneType: ZoneType,
    gravestoneId: string | null,
    groundItemIds: string[],
  ): Promise<void>;

  // Check if player has active death lock
  hasActiveDeath(playerId: string): boolean;
  getDeathLock(playerId: string): DeathLock | undefined;

  // Clear death lock (after respawn/item retrieval)
  async clearDeath(playerId: string): Promise<void>;
}
```

**CRITICAL FOR SECURITY:**
- Database persistence prevents item duplication on server crash
- Death locks survive server restarts
- Ensures items can only be claimed once

### 6.7 DeathStateManager (Mob Animation)

The `entities/managers/DeathStateManager.ts` (222 lines) manages per-entity death state and animation.

```typescript
class DeathStateManager {
  private isDead: boolean;
  private deathTime: number | null;
  private deathPosition: THREE.Vector3 | null;

  // Handle death: lock position, start timer
  die(currentPosition: Position3D, currentTime: number): void;

  // Update: handle animation timing
  update(deltaTime: number, currentTime: number): void;

  // Position locking (prevents movement during death)
  shouldLockPosition(): boolean;
  getLockedPosition(): THREE.Vector3 | null;

  // State checks
  isCurrentlyDead(): boolean;
  getDeathTime(): number | null;
}
```

**Death Flow:**
1. `die()` - Lock position where entity died
2. 0-4.5s - Death animation plays at locked position
3. 4.5s - Hide mesh (corpse disappears)
4. 4.5-15s - Invisible, waiting for respawn
5. 15s - `respawn()` via RespawnManager

### 6.8 RespawnManager

The `RespawnManager.ts` (251 lines) manages mob respawn locations with OSRS-accurate tick-based timing.

```typescript
class RespawnManager {
  private config: RespawnConfig;
  private respawnStartTick: number | null;
  private respawnDurationTicks: number;

  // Generate random spawn point within area (prevents spawn camping)
  generateSpawnPoint(): Position3D;

  // Start respawn timer (tick-based)
  startRespawnTimer(currentTick: number, deathPosition?: Position3D): void;

  // Check timer each tick
  update(currentTick: number): void;

  // Ticks until respawn (-1 if not active)
  getTicksUntilRespawn(currentTick: number): number;

  // Register callback for respawn
  onRespawn(callback: (spawnPoint: Position3D) => void): void;
}

interface RespawnConfig {
  spawnAreaCenter: Position3D;
  spawnAreaRadius: number;    // Meters - random spawn within radius
  respawnTimeMin: number;     // Ms (converted to ticks internally)
  respawnTimeMax: number;     // Ms (adds randomness)
}
```

**OSRS-Accurate Features:**
- Mobs spawn in an AREA, not a single point
- Random location within configured radius
- Tick-based timing (600ms per tick)
- Prevents spawn camping

### 6.9 KillTrackerSystem (Server-Only)

The `KillTrackerSystem` (93 lines) persists kill statistics to the database.

```typescript
// packages/server/src/systems/KillTrackerSystem/index.ts

class KillTrackerSystem extends SystemBase {
  private databaseSystem: DatabaseSystem;

  async init(): Promise<void> {
    // Subscribe to NPC_DIED events
    this.subscribe(EventType.NPC_DIED, (data) => this.handleMobDied(data));
  }

  private handleMobDied(data: {
    mobId: string;
    mobType: string;
    killedBy: string;
    level?: number;
  }): void {
    // Increment kill count in database
    this.databaseSystem.incrementKillCount(data.killedBy, data.mobType);
  }
}
```

**Purpose:**
- Tracks player kill statistics for achievements
- Persists to database for quest requirements
- Fire-and-forget persistence (non-blocking)

---

## 7. Loot & Economy Systems

### 7.1 LootSystem

The `LootSystem.ts` (203 lines) orchestrates loot drops when mobs die.

```typescript
class LootSystem extends SystemBase {
  private lootTableService: LootTableService;
  private groundItemSystem: GroundItemSystem;

  // Listen to NPC_DIED events, roll loot, spawn ground items
  private handleMobDeath(data: {
    mobId: string;
    mobType: string;
    level: number;
    killedBy: string;
    position: Position3D;
  }): Promise<void>;
}
```

**OSRS-Style Behavior:**
- Mob dies → Items drop directly to ground at tile center
- Items pile on same tile, stackables merge
- Click item directly to pick up (no loot window)
- 2 minute despawn timer per item

### 7.2 LootTableService

The `LootTableService.ts` (204 lines) handles pure loot table logic with no World dependencies.

```typescript
class LootTableService {
  private lootTables = new Map<string, LootTable>();

  // Roll loot based on mob type
  rollLoot(mobType: string): LootDrop[];

  // Check if mob has a loot table
  hasLootTable(mobType: string): boolean;
}

interface LootDrop {
  itemId: string;
  quantity: number;
}
```

**Drop Tiers:**
- Guaranteed drops (100% chance)
- Common drops (rolled with chance)
- Uncommon drops
- Rare drops
- Coins with ±25% quantity variation

### 7.3 GroundItemSystem

The `GroundItemSystem.ts` (633 lines) manages OSRS-style ground items with tile-based piling.

```typescript
class GroundItemSystem extends SystemBase {
  private groundItems = new Map<string, GroundItemData>();
  private groundItemPiles = new Map<string, GroundItemPileData>();

  // Spawn single item (snapped to tile center)
  async spawnGroundItem(
    itemId: string,
    quantity: number,
    position: Position3D,
    options: GroundItemOptions,
  ): Promise<string>;

  // Spawn multiple items (from death/loot)
  async spawnGroundItems(
    items: InventoryItem[],
    position: Position3D,
    options: GroundItemOptions,
  ): Promise<string[]>;

  // Tick processing: check for expired items
  processTick(currentTick: number): void;

  // O(1) tile lookup
  getItemsAtTile(tile: {x: number; z: number}): GroundItemData[];

  // Loot protection check
  canPickup(itemId: string, playerId: string, currentTick: number): boolean;
}
```

**OSRS-Accurate Features:**
- Items snap to tile centers
- Stackable items merge in same pile
- Only top item visible per pile (click to see pile menu)
- Loot protection: killer has 1 min exclusive pickup
- Max 128 items per tile (oldest removed if exceeded)
- Untradeable items always despawn in 3 min

---

## 8. Animation & Timing

### 8.1 CombatAnimationSync

Coordinates animation, damage, and hitsplat timing for perfect synchronization.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANIMATION-DAMAGE SYNC                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Attack animation keyframes:                                     │
│  ─────────────────────────────                                  │
│  Frame 0.0: Wind-up starts (weapon raises)                      │
│  Frame 0.5: Weapon connects (DAMAGE APPLIES HERE)               │
│  Frame 1.0: Follow-through completes                            │
│                                                                  │
│  Timeline (4-tick attack = 2.4 seconds):                        │
│                                                                  │
│  Tick 0    Tick 1    Tick 2    Tick 3    Tick 4                │
│   │         │         │         │         │                     │
│   ▼         ▼         ▼         ▼         ▼                     │
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐               │
│  │SWING│───│ HIT │───│SPLAT│───│     │───│NEXT │               │
│  │START│   │FRAME│   │SHOW │   │     │   │ATCK │               │
│  └─────┘   └─────┘   └─────┘   └─────┘   └─────┘               │
│    │         │         │                   │                    │
│    │         │         └── Hitsplat visible for 2 ticks        │
│    │         └──────────── Damage applies at hit frame          │
│    └────────────────────── Animation starts immediately         │
│                                                                  │
│  Hit Delay by Attack Type:                                       │
│  ──────────────────────────                                     │
│  MELEE:  0 tick base (immediate)                                │
│  RANGED: 1 tick + floor((3 + distance) / 6)                    │
│  MAGIC:  1 tick + floor((1 + distance) / 3)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 ScheduledAttack Structure

```typescript
interface ScheduledAttack {
  id: string;                    // Unique attack ID
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  attackType: HitDelayAttackType; // "melee" | "ranged" | "magic"
  animationStartTick: number;
  damageApplyTick: number;        // When damage is applied
  hitsplatDisplayTick: number;    // When hitsplat shows
  hitsplatHideTick: number;       // When hitsplat hides
  damage: number;
  distance: number;
  attackSpeedTicks: number;
  damageApplied: boolean;
  hitsplatTriggered: boolean;
}
```

### 8.3 HitDelayCalculator

The `HitDelayCalculator.ts` (345 lines) calculates OSRS-accurate hit delays and manages projectile tracking.

```typescript
// Calculate hit delay for any attack type
function calculateHitDelay(
  attackType: "melee" | "ranged" | "magic",
  distance: number,
  currentTick: number,
): HitDelayResult;

interface HitDelayResult {
  delayTicks: number;      // Delay until damage applies
  applyAtTick: number;     // Tick when damage should apply
  distance: number;        // Distance used for calculation
  attackType: string;
}

// Convenience functions
function calculateMeleeHitDelay(currentTick: number): HitDelayResult;
function calculateRangedHitDelay(distance: number, currentTick: number): HitDelayResult;
function calculateMagicHitDelay(distance: number, currentTick: number): HitDelayResult;

// Projectile tracking for visual sync
interface ProjectileData {
  id: string;
  attackerId: string;
  targetId: string;
  attackType: "melee" | "ranged" | "magic";
  firedAtTick: number;
  hitsAtTick: number;
  delayTicks: number;
  damage: number;
  processed: boolean;
}

function createProjectile(...): ProjectileData;
function shouldProjectileHit(projectile: ProjectileData, currentTick: number): boolean;
function getProjectileProgress(projectile: ProjectileData, currentTick: number): number;
```

**Hit Delay Examples:**
| Attack Type | Distance | Delay (ticks) |
|-------------|----------|---------------|
| Melee | Any | 0 |
| Ranged | 1 | 1 |
| Ranged | 5 | 2 |
| Ranged | 10 | 3 |
| Magic | 1 | 1 |
| Magic | 5 | 3 |
| Magic | 10 | 4 |

### 8.4 CombatStateManager (Per-Entity)

Manages combat state for individual mobs/entities.

```typescript
class CombatStateManager {
  private inCombat = false;
  private lastAttackTick = -Infinity;
  private nextAttackTick = 0;
  private lastAttackerId: string | null = null;

  // First-attack timing (OSRS-accurate)
  // When NPC first enters combat range, attack happens NEXT tick
  private _pendingFirstAttack = false;
  private _firstAttackTick = -1;

  enterCombat(attackerId?: string): void;
  exitCombat(): void;
  onEnterCombatRange(currentTick: number): void;
  canAttack(currentTick: number): boolean;
  performAttack(targetId: string, currentTick: number): boolean;
  onReceiveAttack(currentTick: number): void;  // OSRS retaliation timing
}
```

### 8.5 HealthRegenSystem

The `HealthRegenSystem.ts` (230 lines) handles OSRS-style passive health regeneration.

```typescript
class HealthRegenSystem extends SystemBase {
  private lastRegenTick: number;
  private regenRate: number;  // HP per interval (default: 1)

  // Check regen eligibility and apply
  private processPlayerRegen(): void;

  // Get status for debugging
  private getRegenStatus(player: Player): {
    shouldRegen: boolean;
    alive: boolean;
    healthFull: boolean;
    inCombat: boolean;
    cooldownExpired: boolean;
  };
}
```

**OSRS-Accurate Timing:**
- No regen while in combat
- 17 tick cooldown (10.2s) after taking damage
- 1 HP every 100 ticks (60 seconds) when eligible
- Works for human and AI players

---

## 9. Client Visual Systems

### 9.1 DamageSplatSystem

The `DamageSplatSystem.ts` (238 lines) creates OSRS-style damage splats.

```typescript
class DamageSplatSystem extends System {
  private activeSplats: DamageSplat[];

  // Listen to COMBAT_DAMAGE_DEALT events
  // Create THREE.Sprite for damage number
  private createDamageSplat(damage: number, position: Position3D): void;
}
```

**Features:**
- Red splats for hits (damage > 0)
- Blue splats for misses (damage = 0)
- Floating animation (rises up + fades out)
- 1.5 second duration
- Random offset to prevent overlapping

### 9.2 XPDropSystem

The `XPDropSystem.ts` (226 lines) creates RS3-style XP drops.

```typescript
class XPDropSystem extends System {
  private activeDrops: XPDrop[];

  // Listen to XP_DROP_RECEIVED events
  // Create THREE.Sprite with skill icon + XP amount
  private createXPDrop(skill: string, xpGained: number, position: Position3D): void;
}
```

**Features:**
- Gold/yellow text with skill icon
- Format: "🪓 +35" (icon + amount)
- Cubic ease-out animation
- 2 second duration
- Fades in last 30% of animation

### 9.3 HealthBars System

The `HealthBars.ts` (439 lines) and `HealthBarRenderer.ts` (215 lines) render entity health bars during combat.

```typescript
class HealthBars extends SystemBase {
  // Single instanced mesh for all health bars (performance)
  private instancedMesh: THREE.InstancedMesh;
  private healthBarEntries = new Map<string, HealthBarEntry>();

  // Listen to health change events
  init(): void {
    this.subscribe(EventType.ENTITY_HEALTH_CHANGED, this.onHealthChanged);
  }

  // Update health bar display when entity takes damage
  private onHealthChanged(data: {
    entityId: string;
    health: number;
    maxHealth: number;
  }): void;

  // Show/hide based on combat state
  showHealthBar(entityId: string): void;
  hideHealthBar(entityId: string): void;
}
```

**OSRS-Style Features:**
- Only visible during combat (hides after timeout)
- Red/green bar with black border
- Positioned above entity head
- Max 256 concurrent health bars (instanced mesh)

---

## 10. OSRS Combat Mechanics

### 10.1 Tick-Based Timing

```
┌─────────────────────────────────────────────────────────────────┐
│                    OSRS TICK SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1 Tick = 600ms = 0.6 seconds                                   │
│                                                                  │
│  ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤           │
│  0   0.6  1.2  1.8  2.4  3.0  3.6  4.2  4.8  5.4  6.0 seconds  │
│  │    │    │    │    │    │    │    │    │    │    │           │
│  T0   T1   T2   T3   T4   T5   T6   T7   T8   T9   T10          │
│                                                                  │
│  Attack Speed Examples:                                         │
│  ─────────────────────                                          │
│  FASTEST (3 ticks) = 1.8s  → Darts, Blowpipe                   │
│  FAST    (4 ticks) = 2.4s  → Scimitars, Whip, Unarmed          │
│  MEDIUM  (5 ticks) = 3.0s  → Longswords, Crossbows             │
│  SLOW    (6 ticks) = 3.6s  → Godswords, Battleaxes             │
│  SLOWEST (7 ticks) = 4.2s  → Halberds, 2H Swords               │
│                                                                  │
│  Important Timers:                                               │
│  ─────────────────                                              │
│  Combat Timeout: 8 ticks (4.8s) after last hit                  │
│  Tolerance Timer: 1000 ticks (10 minutes)                       │
│  AFK Threshold: 2000 ticks (20 minutes)                         │
│  Hitsplat Duration: 2 ticks (1.2s)                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Retaliation System

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-RETALIATE FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Player/Mob Gets Hit]                                           │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────┐                                           │
│  │ Auto-retaliate   │───► NO ───► Store pendingAttacker        │
│  │ enabled?         │             for face-target only          │
│  └────────┬─────────┘                                           │
│           │ YES                                                  │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ AFK > 20 min?    │───► YES ──► No retaliation               │
│  │ (2000 ticks)     │             (OSRS-accurate)               │
│  └────────┬─────────┘                                           │
│           │ NO                                                   │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Calculate        │                                           │
│  │ retaliation      │     Formula:                              │
│  │ delay            │     delay = ceil(attackSpeed / 2) + 1     │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Queue attack     │     nextAttackTick = currentTick + delay  │
│  │ for delay ticks  │     Face attacker immediately             │
│  └──────────────────┘                                           │
│                                                                  │
│  Example (4-tick weapon):                                        │
│  delay = ceil(4/2) + 1 = 3 ticks = 1.8 seconds                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Combat Flow Diagrams

### 11.1 Complete Attack Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE ATTACK FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CLIENT                     SERVER                              │
│  ──────                     ──────                              │
│    │                           │                                 │
│    │  combat:attack           │                                 │
│    │  {targetId}              │                                 │
│    │ ─────────────────────►   │                                 │
│    │                           │                                 │
│    │                    ┌──────┴──────┐                         │
│    │                    │ VALIDATION  │                         │
│    │                    ├─────────────┤                         │
│    │                    │ 1. Rate limit                         │
│    │                    │ 2. Entity ID validation               │
│    │                    │ 3. Attacker exists & alive            │
│    │                    │ 4. Target exists & alive              │
│    │                    │ 5. Target attackable                  │
│    │                    │ 6. Not self-attack                    │
│    │                    │ 7. Within melee range                 │
│    │                    │ 8. Not on cooldown                    │
│    │                    └──────┬──────┘                         │
│    │                           │                                 │
│    │                           ▼                                 │
│    │              ┌────────────────────────┐                    │
│    │              │    ATTACK EXECUTION    │                    │
│    │              ├────────────────────────┤                    │
│    │              │ 1. Rotate to face      │                    │
│    │              │ 2. Play attack anim    │                    │
│    │              │ 3. Calculate damage    │                    │
│    │              │ 4. Cap at target HP    │                    │
│    │              │ 5. Apply via handler   │                    │
│    │              │ 6. Schedule hitsplat   │                    │
│    │              │ 7. Handle retaliation  │                    │
│    │              │ 8. Record to EventStore│                    │
│    │              │ 9. Emit events         │                    │
│    │              └────────────┬───────────┘                    │
│    │                           │                                 │
│    │  COMBAT_DAMAGE_DEALT     │                                 │
│    │ ◄─────────────────────── │                                 │
│    │                           │                                 │
│    │  (If target dies)        │                                 │
│    │                           │                                 │
│    │  ENTITY_DIED             │                                 │
│    │ ◄─────────────────────── │                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Tick Processing Order

```
┌─────────────────────────────────────────────────────────────────┐
│              COMBAT TICK PROCESSING ORDER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  processCombatTick(tickNumber) {                                │
│                                                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 1: Update PID Manager                              │  │
│    │ Check if shuffle is due (every 60-150 seconds)          │  │
│    └─────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 2: Get All Combat States                           │  │
│    │ combatStates = stateService.getAllCombatStates()        │  │
│    └─────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 3: Sort by PID                                     │  │
│    │ Lower PID = processed first = attacks first             │  │
│    └─────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 4: Process Each Combat (in PID order)              │  │
│    │ for (const [entityId, combatState] of combatStates) {   │  │
│    │   • Check timeout (8 ticks after last hit)              │  │
│    │   • Check range and follow if needed                    │  │
│    │   • Attack if cooldown ready                            │  │
│    │ }                                                        │  │
│    └─────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 5: Process Animation Sync                          │  │
│    │ animationSync.processTick(tickNumber)                   │  │
│    │ • Apply scheduled damage                                │  │
│    │ • Display hitsplats                                     │  │
│    │ • Cleanup completed attacks                             │  │
│    └─────────────────────────────────────────────────────────┘  │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Damage Calculation

### 12.1 OSRS Accuracy Formula

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCURACY CALCULATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Calculate Effective Attack Level                       │
│  effectiveAttack = attackLevel + 8 + styleBonus                 │
│                                                                  │
│  Where styleBonus:                                               │
│    Accurate = +3, Controlled = +1, Aggressive/Defensive = +0    │
│                                                                  │
│  Step 2: Calculate Attack Roll                                   │
│  attackRoll = effectiveAttack × (equipmentBonus + 64)           │
│                                                                  │
│  Step 3: Calculate Defense Roll                                  │
│  effectiveDefense = defenseLevel + 8 + styleBonus               │
│  defenseRoll = effectiveDefense × (equipmentDefense + 64)       │
│                                                                  │
│  Step 4: Hit Chance                                              │
│  if (attackRoll > defenseRoll):                                 │
│    hitChance = 1 - (defenseRoll + 2) / (2 × (attackRoll + 1))  │
│  else:                                                           │
│    hitChance = attackRoll / (2 × (defenseRoll + 1))             │
│                                                                  │
│  Step 5: Roll for Hit (using SeededRandom)                      │
│  roll1 = rng.nextInt(attackRoll + 1)                            │
│  roll2 = rng.nextInt(defenseRoll + 1)                           │
│  hit = roll1 > roll2                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 OSRS Max Hit Formula

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAX HIT CALCULATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Calculate Effective Strength Level                     │
│  effectiveStrength = strengthLevel + 8 + styleBonus             │
│                                                                  │
│  Where styleBonus:                                               │
│    Aggressive = +3, Controlled = +1, Accurate/Defensive = +0    │
│                                                                  │
│  Step 2: Calculate Max Hit                                       │
│  maxHit = floor(0.5 + effectiveStrength × (strengthBonus + 64)  │
│                       ────────────────────────────────────────  │
│                                      640                         │
│                      )                                           │
│                                                                  │
│  Step 3: Roll Damage (if hit succeeded)                         │
│  damage = rng.nextInt(maxHit + 1)  // 0 to maxHit inclusive     │
│                                                                  │
│  Example:                                                        │
│  ────────                                                       │
│  strengthLevel = 70                                              │
│  strengthBonus = 82 (Abyssal Whip + gear)                       │
│  effectiveStrength = 70 + 8 + 3 = 81                            │
│  maxHit = floor(0.5 + 81 × (82 + 64) / 640)                     │
│         = floor(0.5 + 81 × 146 / 640)                           │
│         = floor(0.5 + 18.48) = 18                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12.3 CombatCalculations Utility

The `CombatCalculations.ts` file (468 lines) provides the core calculation functions used throughout the combat system.

```typescript
// Combat Style Bonuses (OSRS-accurate)
type CombatStyle = "accurate" | "aggressive" | "defensive" | "controlled";

function getStyleBonus(style: CombatStyle): StyleBonus {
  // accurate: +3 attack (better hit chance)
  // aggressive: +3 strength (higher max hit)
  // defensive: +3 defence
  // controlled: +1 to all three
}

// Main damage calculation function
function calculateDamage(
  attacker: { stats?: CombatStats; config?: { attackPower?: number } },
  target: { stats?: CombatStats; config?: { defense?: number } },
  attackType: AttackType,
  equipmentStats?: {...},
  style?: CombatStyle,
  defenderStyle?: CombatStyle,
): DamageResult;

// Tick conversion utilities
function attackSpeedSecondsToTicks(seconds: number): number;
function attackSpeedMsToTicks(ms: number): number;
function msToTicks(ms: number, minTicks?: number): number;
function ticksToMs(ticks: number): number;

// Retaliation delay calculation
function calculateRetaliationDelay(attackSpeedTicks: number): number;
// Formula: ceil(attackSpeed / 2) + 1
```

---

## 13. Security & Anti-Cheat

### 13.1 Multi-Layer Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Network Validation                                     │
│  ════════════════════════════                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │EntityIdValidator│  │CombatRateLimiter│  │RequestValidator│  │
│  ├─────────────────┤  ├─────────────────┤  ├────────────────┤  │
│  │ • String type   │  │ • 3 req/tick max│  │ • HMAC-SHA256  │  │
│  │ • Length 1-64   │  │ • 5 req/sec max │  │ • Request age  │  │
│  │ • No null bytes │  │ • 2 tick cooldown│ │ • Timing-safe  │  │
│  │ • No path chars │  │   on violation  │  │   comparison   │  │
│  │ • UUID support  │  │                 │  │ • Anti-replay  │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                  │
│  Layer 2: Combat System Validation                              │
│  ═══════════════════════════════════                            │
│  • Entity existence check                                        │
│  • Entity alive check                                            │
│  • Self-attack prevention                                        │
│  • Range validation (tile-based)                                 │
│  • Cooldown enforcement (tick-based)                             │
│  • Target attackable check                                       │
│                                                                  │
│  Layer 3: Anti-Cheat Monitoring                                 │
│  ═══════════════════════════════                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  CombatAntiCheat                         │   │
│  ├────────────────────────────┬────────────────────────────┤   │
│  │ Violation Types:           │ Severity Weights:          │   │
│  │ • OUT_OF_RANGE_ATTACK      │ MINOR = 1 point           │   │
│  │ • DEAD_TARGET_ATTACK       │ MODERATE = 5 points       │   │
│  │ • INVALID_TARGET_TYPE      │ MAJOR = 15 points         │   │
│  │ • ATTACK_RATE_EXCEEDED     │ CRITICAL = 50 points      │   │
│  │ • SELF_ATTACK              │                            │   │
│  │ • NONEXISTENT_TARGET       │ Thresholds:                │   │
│  │ • INVALID_ENTITY_ID        │ Warning = 25 points       │   │
│  │ • EXCESSIVE_XP_GAIN        │ Kick = 50 points          │   │
│  │ • IMPOSSIBLE_DAMAGE        │ Alert = 75 points         │   │
│  │                            │ Ban = 150 points          │   │
│  └────────────────────────────┴────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 CombatValidation Utilities

The `CombatValidation.ts` file (223 lines) provides input validation and rate limiting utilities.

```typescript
// Entity ID validation
function validateEntityId(id: unknown): id is string;
function validateUUID(id: unknown): id is string;

// Combat request validation
function validateCombatRequest(data: unknown): CombatRequestValidation;
function validateAttackStyleRequest(data: unknown): AttackStyleValidation;

// XSS prevention
function sanitizeDisplayName(name: unknown, maxLength?: number): string;

// Rate limiting utilities
interface RateLimitState {
  requestCount: number;
  windowStartTick: number;
  throttledUntilTick: number;
}

function createRateLimitState(): RateLimitState;
function isRateLimited(state: RateLimitState, currentTick: number): boolean;
function checkRateLimit(
  state: RateLimitState,
  currentTick: number,
  maxRequestsPerWindow: number,
  windowSizeTicks: number,
  throttleDurationTicks: number,
): boolean;
```

### 13.3 HMAC Request Signing

```typescript
// CombatRequestValidator - Prevents request forgery and replay attacks

interface SignedCombatRequest {
  playerId: string;
  targetId: string;
  action: "attack" | "disengage" | "retaliate";
  tick: number;
  timestamp: number;
  sessionId: string;
  signature: string;  // HMAC-SHA256
}

class CombatRequestValidator {
  // Validate HMAC signature and request freshness
  validateRequest(request: SignedCombatRequest): ValidationResult;

  // Create signature for a request (server-side)
  signRequest(request: UnsignedCombatRequest): string;

  // Uses timing-safe comparison to prevent timing attacks
  private timingSafeEqual(a: string, b: string): boolean;
}
```

### 13.4 XP and Damage Validation

```
┌─────────────────────────────────────────────────────────────────┐
│                    XP & DAMAGE VALIDATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  XP Validation (validateXPGain):                                 │
│  ───────────────────────────────                                │
│  • Max 400 XP per tick (99 max hit × 4 = 396 + buffer)          │
│  • Tracks XP history over 10-tick window                        │
│  • Cleans up stale entries (200 tick threshold)                 │
│                                                                  │
│  Damage Validation (validateDamage):                            │
│  ────────────────────────────────────                           │
│  • Calculates theoretical max hit for attacker stats            │
│  • Uses OSRS formula                                             │
│  • Adds 10% tolerance for special attacks                       │
│  • Flags CRITICAL violation if damage > limit                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Event Systems

### 14.1 CombatEventBus (Type-Safe Events)

```typescript
// Type-safe event bus with tracing support

class CombatEventBus {
  // Emission methods
  emitCombatStarted(data: {...}): void;
  emitAttackStarted(data: {...}): void;
  emitDamageDealt(data: {...}): void;
  emitCombatEnded(data: {...}): void;
  emitEntityDied(data: {...}): void;
  emitRetaliation(data: {...}): void;

  // Subscription methods (return unsubscribe function)
  onCombatStarted(handler: (event) => void): Unsubscribe;
  onDamageDealt(handler: (event) => void): Unsubscribe;
  onEntityDied(handler: (event) => void): Unsubscribe;
  onAny(handler: (event) => void): Unsubscribe;  // All events

  // Tracing (for debugging)
  enableTracing(): void;
  getEventHistory(): readonly CombatEvent[];
  getEventsForEntity(entityId: string): readonly CombatEvent[];
}
```

### 14.2 CombatAuditLog (Persistent Logging)

```typescript
// For post-mortem analysis and exploit investigation

class CombatAuditLog {
  // Logging methods
  logAttack(data: {...}): void;
  logCombatStart(data: {...}): void;
  logCombatEnd(data: {...}): void;
  logDeath(data: {...}): void;
  logViolation(data: {...}): void;

  // Query methods
  getAttacksByPlayer(playerId: string, since?: number): CombatAuditEntry[];
  getAttacksInArea(position: Position3D, radius: number): CombatAuditEntry[];
  getViolationsByPlayer(playerId: string): CombatAuditEntry[];

  // Admin tools
  exportForReview(playerId: string): string;  // JSON export
  getStats(): { totalEntries, trackedPlayers, ... };
}
```

### 14.3 EventStore + ReplayService

```
┌─────────────────────────────────────────────────────────────────┐
│                    REPLAY SYSTEM                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EventStore (Low-Level Storage)                                  │
│  ─────────────────────────────────                              │
│  • Ring buffer (100,000 events max)                             │
│  • Periodic snapshots (every 100 ticks)                         │
│  • FNV-1a checksums for desync detection                        │
│  • RNG state capture for deterministic replay                   │
│                                                                  │
│  CombatReplayService (High-Level API)                           │
│  ────────────────────────────────────                           │
│  • investigateEntity(entityId) → Full combat report             │
│  • getCombatTimeline(entityId, opponentId) → Fight history      │
│  • verifyEventSequence(startTick, endTick) → Consistency check  │
│  • replayFromSnapshot(tick) → Replay with RNG state             │
│                                                                  │
│  Investigation Report:                                           │
│  ─────────────────────                                          │
│  {                                                               │
│    entityId: string,                                             │
│    combatSessions: CombatTimeline[],                            │
│    suspiciousEvents: Array<{event, reason}>,                    │
│    totalDamageDealt: number,                                     │
│    maxDamageDealt: number,                                       │
│    averageDamagePerHit: number,                                  │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Memory Management

### 15.1 Object Pooling

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBJECT POOLING STRATEGY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tile Pool (CombatSystem):                                       │
│  ─────────────────────────                                      │
│  this._attackerTile = tilePool.acquire();  // Pre-allocated     │
│  this._targetTile = tilePool.acquire();    // Pre-allocated     │
│  // Zero allocations during combat!                             │
│                                                                  │
│  Occupied Tiles Buffer (RangeSystem):                           │
│  ────────────────────────────────────                           │
│  // Pre-allocate for largest NPC (5×5 = 25 tiles)               │
│  private _occupiedTiles: TileCoord[] = new Array(25);           │
│  // Reused on every range check                                 │
│                                                                  │
│  PID Shuffle Buffer (PidManager):                               │
│  ────────────────────────────────                               │
│  private shuffleBuffer: PidEntry[] = [];                        │
│  shuffle() {                                                     │
│    this.shuffleBuffer.length = 0;  // Clear, don't reallocate  │
│    // Reuse buffer for Fisher-Yates shuffle                     │
│  }                                                               │
│                                                                  │
│  Hitsplat Indices (CombatAnimationSync):                        │
│  ───────────────────────────────────────                        │
│  private completedHitsplatIndices: number[] = [];               │
│  // Reused every tick to avoid GC                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 15.2 Bounded Collections

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOUNDED COLLECTIONS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EventStore:                                                     │
│  maxEvents: 100,000 (ring buffer)                               │
│  maxSnapshots: 10                                                │
│                                                                  │
│  CombatAuditLog:                                                 │
│  maxEntries: 10,000                                              │
│  maxEntriesPerPlayer: 500                                        │
│  retentionMs: 30 minutes                                         │
│                                                                  │
│  CombatEventBus:                                                 │
│  maxHistorySize: 1,000 (when tracing enabled)                   │
│                                                                  │
│  Anti-Cheat:                                                     │
│  maxViolationsPerPlayer: 100                                     │
│  xpRateWindowTicks: 10                                           │
│  staleXPThreshold: 200 ticks                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. Configuration Reference

### 16.1 Combat Constants

```typescript
const COMBAT_CONSTANTS = {
  // === Timing ===
  TICK_DURATION_MS: 600,
  DEFAULT_ATTACK_SPEED_TICKS: 4,
  COMBAT_TIMEOUT_TICKS: 8,
  LOGOUT_PREVENTION_TICKS: 16,
  HEALTH_REGEN_COOLDOWN_TICKS: 17,
  HEALTH_REGEN_INTERVAL_TICKS: 100,
  AFK_DISABLE_RETALIATE_TICKS: 2000,

  // === Attack Speeds ===
  ATTACK_SPEED_TICKS: {
    FASTEST: 3,  // Darts, blowpipe
    FAST: 4,     // Scimitars, whip
    MEDIUM: 5,   // Longswords
    SLOW: 6,     // Godswords
    SLOWEST: 7,  // Halberds
  },

  // === Range ===
  MELEE_RANGE_STANDARD: 1,
  MELEE_RANGE_HALBERD: 2,

  // === Damage ===
  BASE_CONSTANT: 64,
  EFFECTIVE_LEVEL_CONSTANT: 8,
  DAMAGE_DIVISOR: 640,

  // === Animation ===
  HITSPLAT_DURATION_TICKS: 2,
  HIT_FRAME_RATIO: 0.5,

  // === Hit Delays ===
  HIT_DELAY: {
    MELEE_BASE: 0,
    RANGED_BASE: 1,
    RANGED_DISTANCE_OFFSET: 3,
    RANGED_DISTANCE_DIVISOR: 6,
    MAGIC_BASE: 1,
    MAGIC_DISTANCE_OFFSET: 1,
    MAGIC_DISTANCE_DIVISOR: 3,
    MAX_HIT_DELAY: 5,
  },

  // === Tolerance ===
  TOLERANCE_TICKS: 1000,  // 10 minutes
  TOLERANCE_REGION_SIZE: 21,
};
```

### 16.2 Aggro Constants

```typescript
const AGGRO_CONSTANTS = {
  MOB_BEHAVIORS: {
    goblin: {
      behavior: "aggressive",
      detectionRange: 5,
      leashRange: 15,
      levelIgnoreThreshold: 10,  // Ignores players level 11+
    },
    guard: {
      behavior: "aggressive",
      detectionRange: 8,
      leashRange: 20,
      levelIgnoreThreshold: 40,
    },
    boss: {
      behavior: "aggressive",
      detectionRange: 15,
      leashRange: 50,
      levelIgnoreThreshold: 999,  // Never ignores (toleranceImmune)
    },
    cow: {
      behavior: "passive",
      detectionRange: 0,
      leashRange: 10,
      levelIgnoreThreshold: 0,
    },
    default: {
      behavior: "aggressive",
      detectionRange: 5,
      leashRange: 15,
      levelIgnoreThreshold: 10,
    },
  },
};
```

### 16.3 Death System Constants

```typescript
const DEATH_CONSTANTS = {
  DEATH_ANIMATION_DURATION: 4500,  // 4.5 seconds
  DEATH_COOLDOWN: 10000,           // 10 seconds between deaths
  MAX_DEATH_LOCK_AGE: 3600000,     // 1 hour stale lock cleanup
  GRAVESTONE_DURATION: 300000,     // 5 minutes
  GROUND_ITEM_DURATION: 120000,    // 2 minutes
  RESPAWN_POSITION: { x: 0, y: 0, z: 0 },  // Central Haven
};
```

---

## 17. API Reference

### 17.1 CombatSystem Public Methods

```typescript
class CombatSystem {
  // === Combat Initiation ===
  startCombat(attackerId: string, targetId: string, options?: {
    attackerType?: "player" | "mob";
    targetType?: "player" | "mob";
    weaponType?: AttackType;
  }): boolean;

  // === Combat State ===
  isInCombat(entityId: string): boolean;
  getCombatData(entityId: string): CombatData | null;
  forceEndCombat(entityId: string): void;

  // === Player State ===
  canLogout(playerId: string, currentTick: number): { allowed: boolean; reason?: string };
  updatePlayerInput(playerId: string, currentTick: number): void;
  isAFKTooLong(playerId: string, currentTick: number): boolean;

  // === Tick Processing ===
  processCombatTick(tickNumber: number): void;

  // === Anti-Cheat ===
  getAntiCheatStats(): AntiCheatStats;
  getAntiCheatPlayerReport(playerId: string): PlayerReport;
  getPlayersRequiringReview(): string[];

  // === Event Store ===
  getCombatEventHistory(entityId: string, startTick?, endTick?): GameEvent[];
  getCombatEventsInRange(startTick: number, endTick: number): GameEvent[];
  verifyEventChecksum(tick: number, expectedChecksum: number): boolean;
  getNearestSnapshot(tick: number): GameSnapshot | undefined;
}
```

### 17.2 AggroSystem Public Methods

```typescript
class AggroSystem {
  // === Mob Management ===
  registerMob(mobData: { id, type, level, position }): void;
  unregisterMob(mobId: string): void;

  // === Tolerance ===
  getRemainingToleranceTicks(playerId: string): number;

  // === Combat Level ===
  getPlayerCombatLevel(playerId: string): number;
  getMobCombatLevel(mobId: string): number;
}
```

### 17.3 Type Guards

```typescript
// Entity type guards
function isMobEntity(entity: unknown): entity is MobEntityLike;
function isPlayerDamageHandler(handler: unknown): handler is PlayerDamageHandlerLike;

// Property guards
function getPendingAttacker(entity: unknown): string | null;
function clearPendingAttacker(entity: unknown): void;
function getMobRetaliates(entity: unknown): boolean;
function isEntityDead(entity: unknown): boolean;

// System guards
function isTerrainSystem(system: unknown): system is TerrainSystemLike;
function isMobSystem(system: unknown): system is MobSystemLike;
function isEquipmentSystem(system: unknown): system is EquipmentSystemLike;
```

---

## Summary

This combat system represents a **production-ready, OSRS-accurate** implementation with:

| Metric | Value |
|--------|-------|
| **Total Lines of Code** | ~23,100+ |
| **Number of Files** | 57 |
| **Type Safety** | 100% (no `any`, runtime type guards) |
| **Security Layers** | 3 (Network, Combat, Anti-Cheat) |
| **OSRS Accuracy** | Full (tick system, formulas, tolerance timer, PID shuffle) |
| **Memory Efficiency** | Object pooling, bounded collections |
| **Replay Capability** | Full (EventStore + ReplayService + AuditLog) |
| **Event Systems** | 3 (EventBus, EventStore, AuditLog) |

### Complete Feature List

- ✅ OSRS tick-based timing (600ms)
- ✅ Authentic damage formulas
- ✅ PID shuffle system for fair PvP
- ✅ Tolerance timer (10-minute aggro immunity)
- ✅ Double-level aggro rule
- ✅ Three range types (hunt, attack, max)
- ✅ Large NPC support (up to 5×5)
- ✅ Player death with gravestones/wilderness rules
- ✅ Mob death with loot/respawn
- ✅ Mob respawn with randomized spawn points
- ✅ Loot table system with drop tiers
- ✅ Ground items with OSRS tile piling
- ✅ OSRS health regeneration (17-tick combat cooldown)
- ✅ Animation-damage-hitsplat synchronization
- ✅ Hit delay by attack type (melee/ranged/magic)
- ✅ OSRS-style damage splats (red/blue)
- ✅ XP drop notifications with skill icons
- ✅ Auto-retaliate with OSRS timing
- ✅ AFK detection (20-minute threshold)
- ✅ Entity ID validation (OWASP compliant)
- ✅ Rate limiting (per-tick and per-second)
- ✅ HMAC request signing
- ✅ Anti-cheat scoring with auto-kick/ban
- ✅ XP and damage validation
- ✅ Type-safe event bus
- ✅ Persistent audit logging
- ✅ Full combat replay capability
- ✅ Investigation tools for admin review
- ✅ Zero-allocation hot paths
- ✅ Bounded collections (no memory leaks)
- ✅ Full mob AI state machine (idle, patrol, aggro, combat, dead)
- ✅ Server-side combat request validation
- ✅ Kill statistics persistence to database


---

*Document generated for Hyperia Combat System v2.0*
