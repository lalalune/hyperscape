# Combat Issues Fix Plan

Fixes for 5 combat-related issues identified in the issue tracker.

**Created:** December 2024
**Status:** Planning
**Last Verified:** December 2024 (code review completed)

---

## Issues Overview

| Issue | Title | Priority | Complexity |
|-------|-------|----------|------------|
| #322 | Face same direction we end combat in | P2 | Low |
| #244 | Death animation hovers over the ground | P1 | Medium |
| #340 | Goblin punch animation plays too quickly | P2 | Low |
| #342 | Player should follow mob if in combat and mob moves | P1 | Medium |
| #416 | Goblins wander in different positions in multiplayer | P0 | High |

---

## Issue #322: Face Same Direction We End Combat In

### Problem
When combat ends, the entity may snap to a different facing direction instead of maintaining the direction they were facing during combat.

### Root Cause Analysis (Verified)

**Location:** `CombatSystem.ts` lines 888-943

The `endCombat()` method does NOT touch rotation at all:
```typescript
private endCombat(data: { entityId: string; ... }): void {
  // Only does:
  // 1. Reset emotes (lines 904-913)
  // 2. Clear combat state (lines 916-927)
  // 3. Emit COMBAT_ENDED event (lines 930-933)
  // NO ROTATION CODE
}
```

However, rotation IS set during combat via `processAutoAttackOnTick()` (lines 1258-1263):
```typescript
this.rotationManager.rotateTowardsTarget(
  attackerId, targetId, combatState.attackerType, combatState.targetType
);
```

**Actual issue:** The rotation is correctly set during combat but may be overwritten by:
1. Player movement after combat ends
2. Client-side interpolation resetting to default rotation
3. Network sync sending stale rotation data

### Proposed Fix

**Approach:** The issue is likely NOT in CombatSystem but in post-combat movement handling. Need to verify:
1. Is the rotation being reset by movement system after combat?
2. Is there a default rotation being applied on combat end?

**Investigation Steps:**
- [ ] Add logging to track rotation changes during combat end
- [ ] Check if movement system resets rotation on COMBAT_ENDED event
- [ ] Verify rotation is synced to clients correctly

**If rotation IS being reset somewhere:**
- [ ] Find the code that resets rotation and remove/guard it
- [ ] Ensure COMBAT_ENDED event doesn't trigger rotation changes

### Files to Investigate
- `packages/shared/src/systems/shared/combat/CombatSystem.ts` (endCombat - lines 888-943)
- `packages/shared/src/systems/shared/movement/` (check for COMBAT_ENDED handlers)
- `packages/shared/src/entities/player/PlayerEntity.ts` (rotation handling)

### Acceptance Criteria
- [ ] After killing a mob, player faces the mob's last position
- [ ] After combat timeout, player faces the direction of last attack
- [ ] Rotation only changes on new player input or new combat

---

## Issue #244: Death Animation Hovers Over the Ground

### Problem
When a mob dies, the death animation plays with the entity floating above the ground at approximately hip level instead of falling to the ground.

### Root Cause Analysis (Verified)

**Death Position Capture:** `MobEntity.ts` line 1716-1719
```typescript
const deathPosition = this.getPosition();  // Captures current position
this.deathManager.die(deathPosition, currentTime);  // Locks it
```

**DeathStateManager.die():** lines 55-69
```typescript
die(currentPosition: Position3D, currentTime: number): void {
  // Lock position where mob died - NO TERRAIN SNAPPING
  this.deathPosition = new THREE.Vector3(
    currentPosition.x,
    currentPosition.y,  // Uses Y as-is, may not be terrain-snapped
    currentPosition.z,
  );
}
```

**Client Update During Death:** `MobEntity.ts` lines 1514-1534
```typescript
if (deathLockedPos) {
  this.node.position.copy(deathLockedPos);
  this.position.copy(deathLockedPos);
  // DON'T call move() - it causes sliding
  this._avatarInstance.update(deltaTime);  // Only updates animation, not position
}
```

**Key Issues Identified:**
1. **Server has no terrain system** (comment line 1483): Death Y is captured from `this.position.y` which may be stale
2. **Client terrain snapping is SKIPPED during death** (lines 1536-1559 only run when NOT dead)
3. **`update()` vs `move()`**: The code explicitly avoids `move()` during death (comment: "causes sliding")
4. **VRM animation root motion** may push character up/down but isn't compensated

### Proposed Fix

**Two-Part Solution:**

**Part 1: Terrain-snap death position on client when first received**
```typescript
// In MobEntity.modify() when receiving death state:
if (data.deathTime && !this.deathManager.isCurrentlyDead()) {
  // First time receiving death - snap to terrain
  const terrain = this.world.getSystem("terrain");
  if (terrain && data.p) {
    const terrainY = terrain.getHeightAt(data.p[0], data.p[2]);
    this.deathManager.applyDeathPositionFromServer(
      new THREE.Vector3(data.p[0], terrainY, data.p[2])
    );
  }
}
```

**Part 2: Apply terrain Y during death animation (carefully)**
```typescript
// In clientUpdate death handling, AFTER locking position:
if (deathLockedPos) {
  // Snap death position to terrain (once, when terrain loads)
  if (!this._deathTerrainSnapped) {
    const terrain = this.world.getSystem("terrain");
    if (terrain) {
      const terrainY = terrain.getHeightAt(deathLockedPos.x, deathLockedPos.z);
      deathLockedPos.y = terrainY;  // Mutate the locked position
      this._deathTerrainSnapped = true;
    }
  }
  this.node.position.copy(deathLockedPos);
  // ... rest of death handling
}
```

### Files to Modify
- `packages/shared/src/entities/npc/MobEntity.ts` (clientUpdate death handling)
- `packages/shared/src/entities/managers/DeathStateManager.ts` (add terrain snap hook)

### Acceptance Criteria
- [ ] Death animation plays with mob on the ground
- [ ] No visible floating/hovering during death
- [ ] Death position accounts for terrain slope
- [ ] Works for all mob types (goblin, chicken, cow, etc.)
- [ ] No "sliding" during death animation (preserve current fix)

---

## Issue #340: Goblin Punch Animation Plays Too Quickly

### Problem
The goblin's punch animation completes much faster than the actual attack speed, making combat feel rushed and unpolished.

### Root Cause Analysis (Verified)

**Location:** `CombatAnimationManager.ts` lines 63-79

```typescript
setCombatEmote(
  entityId: string,
  entityType: "player" | "mob",
  currentTick: number,
): void {
  if (entityType === "player") {
    this.setPlayerCombatEmote(entityId);
  } else {
    this.setMobCombatEmote(entityId);
  }

  // Schedule emote reset (2 ticks = 1200ms for animation to complete)
  this.emoteResetTicks.set(entityId, {
    tick: currentTick + 2,  // HARDCODED: Always 2 ticks
    entityType,
  });
}
```

**Called from:** `CombatSystem.ts` line 1267-1271
```typescript
this.animationManager.setCombatEmote(
  attackerId,
  combatState.attackerType,
  tickNumber,
  // NO attack speed parameter passed!
);
```

**Timeline Example (Goblin with 5-tick attack speed):**
```
Tick 0: setCombatEmote() called, punch animation starts
Tick 2: Animation reset to idle (1200ms) ← TOO EARLY
Tick 5: Next attack ready (3000ms)
        Gap of 3 ticks (1800ms) where mob stands idle
```

### Proposed Fix

**File:** `CombatAnimationManager.ts`

Add `attackSpeedTicks` parameter:

```typescript
setCombatEmote(
  entityId: string,
  entityType: "player" | "mob",
  currentTick: number,
  attackSpeedTicks: number = 4,  // Default 4 ticks (2.4s)
): void {
  // ... set emote ...

  // Hold combat pose until 1 tick before next attack
  // Minimum 2 ticks to ensure animation plays
  const resetTick = currentTick + Math.max(2, attackSpeedTicks - 1);
  this.emoteResetTicks.set(entityId, {
    tick: resetTick,
    entityType,
  });
}
```

**File:** `CombatSystem.ts`

Update callers to pass attack speed:

```typescript
// In processAutoAttackOnTick() line 1267:
const attackSpeedTicks = this.getEntityAttackSpeedTicks(attacker, combatState.attackerType);
this.animationManager.setCombatEmote(
  attackerId,
  combatState.attackerType,
  tickNumber,
  attackSpeedTicks,
);
```

### Implementation Steps
- [ ] Add `attackSpeedTicks` parameter to `setCombatEmote()` with default value
- [ ] Create `getEntityAttackSpeedTicks()` helper in CombatSystem (may already exist)
- [ ] Update `processAutoAttackOnTick()` to pass attack speed
- [ ] Update `executeMeleeAttack()` to pass attack speed
- [ ] Add unit test for animation timing

### Files to Modify
- `packages/shared/src/systems/shared/combat/CombatAnimationManager.ts` (line 63-79)
- `packages/shared/src/systems/shared/combat/CombatSystem.ts` (lines 1267-1271)

### Acceptance Criteria
- [ ] Goblin holds punch pose for duration matching attack speed
- [ ] Animation timing feels natural and matches combat rhythm
- [ ] Player attack animations also respect weapon attack speed
- [ ] No animation jitter or early resets

---

## Issue #342: Player Should Follow Mob If In Combat And Mob Moves

### Problem
When a mob moves during combat (e.g., chasing or repositioning), the player exits combat state instead of automatically following and continuing the fight.

### Root Cause Analysis (Verified)

**Combat Timeout:** `CombatSystem.ts` lines 1190-1195
```typescript
// Check for combat timeout (8 ticks after last hit)
if (combatState.inCombat && tickNumber >= combatState.combatEndTick) {
  const entityIdStr = String(entityId);
  this.endCombat({ entityId: entityIdStr });
  continue;
}
```

**Range Check (skips attack but doesn't follow):** `CombatSystem.ts` lines 1252-1255
```typescript
if (!tilesWithinRange(attackerTile, targetTile, combatRangeTiles)) {
  // Out of melee range - don't end combat, just skip this attack
  return;  // ← NO FOLLOW BEHAVIOR, just skips
}
```

**Current Behavior:**
1. Player attacks mob, enters combat (8-tick timeout starts)
2. Mob moves out of range (e.g., chasing another player or pathing)
3. `processAutoAttackOnTick()` returns early due to range check (line 1252-1255)
4. No attacks happen, `combatEndTick` not extended
5. After 8 ticks of no attacks, combat times out
6. Player stands still, combat ends

**What SHOULD happen:**
- Player should auto-walk toward mob to stay in combat range
- `combatEndTick` should extend while actively pursuing

### Proposed Fix

**Two-Part Solution:**

**Part 1: Extend timeout when out of range but still pursuing**
```typescript
// In processAutoAttackOnTick(), after range check fails:
if (!tilesWithinRange(attackerTile, targetTile, combatRangeTiles)) {
  // Out of range - extend timeout while pursuing
  combatState.combatEndTick = tickNumber + COMBAT_CONSTANTS.TIMEOUT_TICKS;

  // Emit follow request for player
  if (combatState.attackerType === "player") {
    this.emitTypedEvent(EventType.COMBAT_FOLLOW_TARGET, {
      playerId: attackerId,
      targetId: targetId,
      targetPosition: targetPos,
    });
  }
  return;
}
```

**Part 2: Client-side follow behavior**
- Listen to `COMBAT_FOLLOW_TARGET` event
- Pathfind toward target position
- Cancel on: player input, combat end, target death, max distance

### Implementation Steps
- [ ] Add `EventType.COMBAT_FOLLOW_TARGET` event type
- [ ] Modify `processAutoAttackOnTick()` to extend timeout when out of range
- [ ] Emit follow event when player is out of range of combat target
- [ ] Add client-side handler to initiate pathfinding toward target
- [ ] Add max follow distance (leash) to prevent infinite chasing
- [ ] Cancel follow on player movement input

### Files to Modify
- `packages/shared/src/systems/shared/combat/CombatSystem.ts` (lines 1252-1255)
- `packages/shared/src/types/events/event-types.ts` (add new event)
- `packages/client/src/` or `packages/shared/src/systems/client/` (follow handler)

### Acceptance Criteria
- [ ] Player automatically walks toward mob if mob moves during combat
- [ ] Combat doesn't end while player is following (timeout extended)
- [ ] Player movement input cancels auto-follow
- [ ] Works for both player-initiated and mob-initiated combat
- [ ] Max follow distance prevents infinite chasing (e.g., 15 tiles)

---

## Issue #416: Goblins Wander In Different Positions In Multiplayer

### Problem
When multiple players view the same goblin, it appears at different positions on each player's screen, breaking multiplayer immersion.

### Root Cause Analysis (Verified)

**Primary Cause: Client Overwrites Server Y with Terrain**

**Server sends position:** `MobEntity.ts` lines 2106-2111
```typescript
// Server DOES send Y:
if (!networkData.p || !Array.isArray(networkData.p)) {
  const pos = this.getPosition();
  networkData.p = [pos.x, pos.y, pos.z];  // Y IS INCLUDED
}
```

**Client receives position:** `MobEntity.ts` lines 2302-2306
```typescript
if ("p" in data && Array.isArray(data.p) && data.p.length === 3) {
  const pos = data.p as [number, number, number];
  this.position.set(pos[0], pos[1], pos[2]);  // Applies server Y
  this.node.position.set(pos[0], pos[1], pos[2]);
}
```

**Client OVERWRITES Y:** `MobEntity.ts` lines 1483-1496 (clientUpdate)
```typescript
// CRITICAL: Snap to terrain EVERY frame (server doesn't have terrain system)
const terrain = this.world.getSystem("terrain");
if (terrain && "getHeightAt" in terrain) {
  const terrainHeight = terrain.getHeightAt(this.node.position.x, this.node.position.z);
  if (Number.isFinite(terrainHeight)) {
    this.node.position.y = terrainHeight + 0.1;  // OVERWRITES SERVER Y
    this.position.y = terrainHeight + 0.1;
  }
}
```

**Comment confirms design:** Line 1510
```typescript
// NOTE: ClientNetwork updates XZ from server, we calculate Y from client terrain
```

**Why This Causes Desync:**
1. Server sends position with Y (e.g., `[10, 5.5, 20]`)
2. Client A's terrain loads fast → calculates Y = 5.5 ✓
3. Client B's terrain not loaded → keeps old Y or uses fallback
4. Client B's terrain finally loads → may calculate Y = 5.6 due to floating point
5. Both clients have slightly different Y values

**Secondary Issue: Comment says "server doesn't have terrain system"**
- This is misleading - the server SHOULD have terrain for authoritative Y
- Current design trusts client terrain which varies per client

### Proposed Fix

**Option A: Trust Server Y (Recommended)**
Remove client-side terrain snapping for mobs, trust server Y completely.

```typescript
// In clientUpdate, REMOVE terrain snapping for mobs:
// OLD:
const terrainHeight = terrain.getHeightAt(this.node.position.x, this.node.position.z);
this.node.position.y = terrainHeight + 0.1;

// NEW: Trust server Y, only snap if no server data
if (!this._hasReceivedServerPosition) {
  // Fallback terrain snap for initial spawn before first sync
  const terrainHeight = terrain.getHeightAt(...);
  this.node.position.y = terrainHeight + 0.1;
}
// Once server position received, NEVER overwrite Y
```

**Option B: Server Calculates Terrain (More Work)**
Add terrain system to server, calculate authoritative Y server-side.

### Implementation Steps

**Step 1: Stop overwriting server Y**
- [ ] Add `_hasReceivedServerPosition` flag to MobEntity
- [ ] Set flag when `modify()` receives position from server
- [ ] Skip terrain snapping in `clientUpdate()` if flag is set
- [ ] Only terrain-snap before first server sync (initial placement)

**Step 2: Ensure server sends Y correctly**
- [ ] Verify `getNetworkData()` always includes Y in position
- [ ] Check that server position is terrain-snapped before sending
- [ ] If server lacks terrain, add terrain lookup on server

**Step 3: Handle edge cases**
- [ ] What if server Y is wrong? (server lacks terrain)
- [ ] May need server-side terrain system
- [ ] Or accept small Y differences and only sync XZ

### Files to Modify
- `packages/shared/src/entities/npc/MobEntity.ts` (clientUpdate lines 1483-1507)
- Possibly `packages/server/src/` if server terrain needed

### Acceptance Criteria
- [ ] All players see mobs at identical XZ positions
- [ ] Y position close enough that mobs don't float/sink
- [ ] No visible "teleporting" or position snapping
- [ ] Works with 10+ concurrent players viewing same mob
- [ ] Mobs don't jitter due to terrain sync differences

---

## Implementation Priority

### Phase 1: Critical Sync Issues (P0)
1. **#416** - Multiplayer position desync
   - **Complexity:** Medium (modify terrain snapping logic)
   - **Risk:** Low (isolated to MobEntity clientUpdate)
   - **Blocks:** All multiplayer testing

### Phase 2: Combat Feel (P1)
2. **#244** - Death animation hovering
   - **Complexity:** Low-Medium (add terrain snap at death time)
   - **Risk:** Low (death state is isolated)

3. **#342** - Combat follow behavior
   - **Complexity:** Medium (new event + client handler)
   - **Risk:** Medium (affects player movement during combat)

### Phase 3: Polish (P2)
4. **#340** - Animation timing
   - **Complexity:** Low (add parameter to existing function)
   - **Risk:** Low (backwards compatible with default)

5. **#322** - Combat end rotation
   - **Complexity:** Low (investigation first, may be no code change)
   - **Risk:** Low (rotation is visual only)

---

## Estimated Effort

| Issue | Complexity | Est. Time | Files Changed |
|-------|------------|-----------|---------------|
| #416 | Medium | 2-4 hours | 1-2 files |
| #244 | Low-Medium | 1-2 hours | 2 files |
| #342 | Medium | 3-4 hours | 3+ files |
| #340 | Low | 30 min | 2 files |
| #322 | Low | 1 hour | Investigation + possible fix |

**Total:** ~8-12 hours

---

## Testing Plan

### Unit Tests
- [ ] Animation reset timing matches attack speed parameter
- [ ] Combat timeout extends when out of range
- [ ] Death position terrain-snapped on client

### Integration Tests
- [ ] Full combat cycle maintains facing direction
- [ ] Mob death animation plays at ground level
- [ ] Player auto-follows during combat (when implemented)
- [ ] Multiplayer position sync within tolerance

### Manual Testing Checklist
- [ ] **#416:** Two players view same goblin, verify identical XZ position
- [ ] **#416:** Goblin wanders, both players see same path
- [ ] **#244:** Kill goblin, verify death animation on ground (not floating)
- [ ] **#244:** Kill goblin on slope, verify animation follows terrain
- [ ] **#342:** Combat goblin that moves, verify player follows
- [ ] **#342:** Press movement key during follow, verify follow cancels
- [ ] **#340:** Observe goblin attack animation, verify timing feels natural
- [ ] **#340:** Count ticks between attack start and idle reset
- [ ] **#322:** End combat, verify player faces last attack direction
- [ ] **#322:** Combat timeout, verify no rotation snap

---

## Code Locations Quick Reference

| Issue | Primary File | Key Lines |
|-------|--------------|-----------|
| #322 | CombatSystem.ts | 888-943 (endCombat) |
| #244 | MobEntity.ts | 1514-1534 (death handling), 1716-1719 (die call) |
| #340 | CombatAnimationManager.ts | 63-79 (setCombatEmote) |
| #342 | CombatSystem.ts | 1252-1255 (range check) |
| #416 | MobEntity.ts | 1483-1507 (terrain snap) |

---

## References

- [CombatSystem.ts](packages/shared/src/systems/shared/combat/CombatSystem.ts)
- [CombatAnimationManager.ts](packages/shared/src/systems/shared/combat/CombatAnimationManager.ts)
- [CombatRotationManager.ts](packages/shared/src/systems/shared/combat/CombatRotationManager.ts)
- [MobEntity.ts](packages/shared/src/entities/npc/MobEntity.ts)
- [DeathStateManager.ts](packages/shared/src/entities/managers/DeathStateManager.ts)
- [AIStateMachine.ts](packages/shared/src/entities/managers/AIStateMachine.ts)
