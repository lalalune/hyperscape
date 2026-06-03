# Gathering System Architecture

OSRS-accurate resource gathering system for woodcutting, mining, and fishing.

## Overview

The gathering system implements authentic Old School RuneScape mechanics including:
- 600ms tick-based timing
- LERP success rate interpolation
- Priority-based fish rolling
- Forestry-style tree depletion timers
- Cardinal face direction (N/S/E/W only)
- Tool tier effects on success rates

## Module Structure

```
gathering/
├── index.ts              # Module exports
├── debug.ts              # Environment-based debug configuration
├── types.ts              # Type definitions (GatheringSession, etc.)
├── DropRoller.ts         # OSRS drop mechanics & fish priority rolling
├── ToolUtils.ts          # Tool validation & category mapping
├── SuccessRateCalculator.ts  # OSRS LERP formula implementation
└── README.md             # This file
```

### Core Files

| File | Purpose |
|------|---------|
| `ResourceSystem.ts` | Main orchestrator - session management, tick processing, event handling |
| `DropRoller.ts` | Roll drops using OSRS chance distribution, priority fish rolling |
| `ToolUtils.ts` | Map item IDs to tool categories, validate tool requirements |
| `SuccessRateCalculator.ts` | Calculate success rates using OSRS LERP formula |
| `types.ts` | TypeScript interfaces for sessions, timers, tuning data |
| `debug.ts` | Environment-based debug flag (`HYPERIA_DEBUG_GATHERING`) |

### Server Files

| File | Purpose |
|------|---------|
| `PendingGatherManager.ts` | Path player to cardinal tile before gathering starts |
| `FaceDirectionManager.ts` | OSRS-accurate deferred face direction at tick end |

## OSRS Mechanics Implemented

### Success Rate (LERP Formula)
```
rate = low + (high - low) * (level - 1) / 98
```
- `low`: Base success rate at level 1
- `high`: Maximum success rate at level 99
- Tool tier affects `low`/`high` values for woodcutting
- Mining uses variable roll frequency instead

### Tick System
- All gathering runs on 600ms ticks (OSRS standard)
- Woodcutting: Fixed 4-tick rolls, tool affects success rate
- Mining: Variable tick rolls based on pickaxe tier
- Fishing: Fixed 5-tick rolls, equipment doesn't affect speed

### Forestry Tree Timers
- Timer starts on FIRST LOG received (not first click)
- Counts down while anyone is gathering
- Regenerates when no one is gathering
- Tree depletes when timer=0 AND player receives a log
- Multiple players share the same timer

### Cardinal Face Direction
- Players only face N/S/E/W (4 directions for gathering)
- Direction set at tick end, only if player didn't move
- Persists across ticks until player stops moving
- Deterministic based on player position relative to resource

### Fish Priority Rolling
```
1. Sort fish by level requirement (highest first)
2. For each fish player can catch:
   a. Roll success based on fish's catch rate
   b. If success, return that fish
3. Fallback to lowest-level fish
```

## Data Flow

```
1. Player clicks resource
       ↓
2. PendingGatherManager queues pathing to cardinal tile
       ↓
3. Player arrives → FaceDirectionManager sets face target
       ↓
4. ResourceSystem.startGathering() validates & creates session
       ↓
5. Every tick: processGatheringTick()
   ├── Check movement (cancel if moved)
   ├── Check inventory space
   ├── Roll success using cached rate
   ├── On success: DropRoller determines item
   ├── Award XP, add to inventory
   └── Check depletion (Forestry timer)
       ↓
6. Session ends: depletion, movement, full inventory, or disconnect
```

## Security Features

- **600ms rate limit**: Silently drops requests faster than 1 tick (matches OSRS)
- **Resource ID validation**: Alphanumeric only, length limits
- **Server-authoritative position**: Client position ignored
- **Disconnect tracking**: Logs suspicious rapid disconnects during gathering

## Debug Configuration

Enable debug logging via environment variable:
```bash
HYPERIA_DEBUG_GATHERING=true bun run dev
```

Debug logs include:
- Session creation/destruction
- Success/failure rolls
- Tool tier calculations
- Forestry timer updates

## Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `ResourceSystem.test.ts` | 30 | Unit tests for pure functions |
| `ResourceSystem.integration.test.ts` | 11 | Full flow validation |
| `PendingGatherManager.test.ts` | 20 | Pathing & arrival detection |
| `FaceDirectionManager.test.ts` | 34 | Cardinal direction & rotation |

**Total: 93+ tests**

## Configuration

Resources defined in `packages/server/world/assets/manifests/resources.json`:
```json
{
  "id": "tree_normal",
  "harvestSkill": "woodcutting",
  "levelRequired": 1,
  "toolRequired": "hatchet",
  "baseCycleTicks": 4,
  "depleteChance": 0.125,
  "respawnTicks": 50,
  "harvestYield": [
    { "itemId": "logs", "chance": 1.0, "xpAmount": 25 }
  ]
}
```

Tools defined in `packages/server/world/assets/manifests/tools.json`:
```json
{
  "id": "bronze_hatchet",
  "skill": "woodcutting",
  "levelRequired": 1,
  "successRateLow": 0.25,
  "successRateHigh": 0.75
}
```
