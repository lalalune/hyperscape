## Priority 2: High (Do Second)

### 2.1 Y-Position Interpolation
**Impact**: Medium-High - eliminates height popping
**Effort**: Low
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: Terrain height snaps instantly when server sends update. Character appears to float/sink briefly when moving between elevations.

**Solution**: Lerp Y position toward target Y over 100-200ms instead of instant snap.

**Status**: [ ] Not started

---

### 2.2 Rotation Slerp (Spherical Interpolation)
**Impact**: High - eliminates jarring direction snaps
**Effort**: Low
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: Rotation uses `quaternion.copy()` which instantly snaps to new direction. When player clicks to course-correct (common in OSRS gameplay), character jerks to face new direction.

**Solution**: Use `quaternion.slerp(targetRotation, alpha)` to smoothly interpolate rotation over 100-200ms. Store `targetQuaternion` separately from `currentQuaternion` and blend each frame.

**RS3 Reference**: RS3's smooth movement update uses Bézier curves and smooth rotation transitions.

**Status**: [x] Completed

---

### 2.2.1 Fix Slerp Long Path (180° Flip Bug)
**Impact**: High - eliminates random 180° spins during straight-line movement
**Effort**: Low
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: When spam clicking in a straight line (e.g., running north), character occasionally does a quick 180° spin and back. This is caused by two quaternion-related issues:

1. **Slerp "long way around"**: Quaternions have double cover (`q` and `-q` are the same rotation). When the dot product between current and target quaternion is negative, `slerp()` takes the long path (~360° rotation) instead of the short path (~0°).

2. **First tile behind visual position**: When spam clicking, server sends new path from its known position (which may lag behind client visual position). If first tile in path is behind visual position, rotation briefly faces backward.

**Solution**:
1. Before calling `slerp()`, check `quaternion.dot(targetQuaternion) < 0`. If negative, negate target quaternion (same rotation, but slerps short way):
   ```typescript
   if (state.quaternion.dot(state.targetQuaternion) < 0) {
     state.targetQuaternion.set(
       -state.targetQuaternion.x, -state.targetQuaternion.y,
       -state.targetQuaternion.z, -state.targetQuaternion.w
     );
   }
   state.quaternion.slerp(state.targetQuaternion, rotationAlpha);
   ```

2. In `onMovementStart`, use destination tile (not first path tile) for initial rotation calculation.

**Status**: [x] Completed

---

### 2.3 Rotation Damping Threshold
**Impact**: Medium - prevents micro-jitter during movement
**Effort**: Low
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: Rotation updates on every frame even for tiny direction changes, causing subtle jitter.

**Solution**: Only update target rotation if direction changed by more than ~16 degrees. Uses quaternion dot product: `|dot| < 0.99` means angle > ~16°.

**Status**: [x] Completed

---

### 2.4 Only Rotate on Tile Transitions
**Impact**: Medium - reduces unnecessary rotation calculations
**Effort**: Low
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: Currently recalculates rotation every frame during movement. This causes "wobble" as tiny position changes affect facing direction.

**Solution**: Removed mid-tile rotation update entirely. Rotation only updates when reaching tile boundaries, not every frame. Initial rotation faces destination, tile transitions handle direction changes at turns.

**Status**: [x] Completed

---

### 2.5 Add Tick System Profiling
**Impact**: High for debugging
**Effort**: Low
**File**: `packages/server/src/systems/TickSystem.ts`

**Problem**: No visibility into which systems are slow. Hard to identify performance bottlenecks.

**Solution**: Track execution time per listener. Log warnings if any listener takes >100ms. Expose metrics for monitoring.

**Status**: [ ] Not started

---

### 2.6 Fix Client/Server Path Mismatch
**Impact**: Medium - eliminates route desync
**Effort**: High
**Files**:
- `packages/shared/src/systems/client/TileInterpolator.ts`
- `packages/server/src/systems/ServerNetwork/tile-movement.ts`
- `packages/server/src/systems/ServerNetwork/mob-tile-movement.ts`

**Problem**: Client uses naive diagonal pathing to calculate intermediate tiles. Server uses BFS. Results in client taking slightly different route.

**Solution**: Server sends complete authoritative path with `startTile`. Client follows server path exactly - no client-side path calculation. Deleted `calculateIntermediateTiles()` method.

**Status**: [x] Completed

---

## Priority 3: Medium (Polish)

### 3.1 Deduplicate Rapid Clicks
**Impact**: Low-Medium
**Effort**: Low
**File**: `packages/server/src/systems/ServerNetwork/action-queue.ts`

**Problem**: Spamming clicks to same tile creates redundant movement actions.

**Solution**: If new movement destination is same tile as pending movement, ignore the duplicate.

**Status**: [ ] Not started

---

### 3.2 Path Caching for Common Routes
**Impact**: Medium for performance
**Effort**: Medium
**File**: `packages/server/src/systems/ServerNetwork/tile-movement.ts`

**Problem**: Same paths (e.g., bank to furnace) recalculated repeatedly.

**Solution**: LRU cache for recent paths. Key: `${startTile.x},${startTile.z}->${endTile.x},${endTile.z}`

**Status**: [ ] Not started

---

### 3.3 Periodic Position Reconciliation
**Impact**: Medium - prevents drift
**Effort**: Medium
**Files**:
- `packages/server/src/systems/ServerNetwork/tile-movement.ts`
- `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: No proactive check if client/server positions match. Desync only detected when >8 tiles apart.

**Solution**: Every 10 ticks, send lightweight position verification. Client responds with its position. If mismatch >2 tiles, force sync.

**Status**: [ ] Not started

---

### 3.4 Unbatch Entity Updates
**Impact**: Medium - smoother multi-entity scenes
**Effort**: Medium
**File**: `packages/server/src/systems/ServerNetwork/index.ts`

**Problem**: All entity updates sent in batch at end of tick. All entities appear to move in same frame.

**Solution**: Send updates immediately after each entity processes, not batched at broadcast priority.

**Status**: [ ] Not started

---

## Priority 4: Low (Future)

### 4.1 Async Pathfinding
**Impact**: High for large worlds
**Effort**: High
**File**: `packages/server/src/systems/ServerNetwork/tile-movement.ts`

**Problem**: BFS pathfinding runs synchronously during tick, blocking other processing.

**Solution**: Queue pathfinding in worker thread. Return path next tick. Use estimated path for immediate response.

**Status**: [ ] Not started

---

### 4.2 Network Compression
**Impact**: Low-Medium
**Effort**: Medium
**Files**: Various network handlers

**Problem**: Paths sent as array of objects. Redundant full state in updates.

**Solution**:
- Encode paths as byte arrays (2 bytes per tile)
- Delta encoding for updates (only changed fields)

**Status**: [ ] Not started

---

### 4.3 Predictive Animation Queue
**Impact**: Low
**Effort**: Medium
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: Client doesn't predict next animation based on movement state.

**Solution**: When receiving `tileMovementStart` with `running=true`, immediately set run emote without waiting for server emote update.

**Status**: [ ] Not started

---

### 4.4 moveSeq Wraparound Protection
**Impact**: Low (edge case)
**Effort**: Low
**Files**:
- `packages/server/src/systems/ServerNetwork/tile-movement.ts`
- `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: moveSeq will eventually wrap around 2^31. No validation after wrap.

**Solution**: Use modular comparison or reset sequence on reconnect.

**Status**: [ ] Not started

---

## Implementation Order

1. ~~**1.1** Throttle Mob Repathing~~ ✅ Completed (chaseStep pathfinder)
2. ~~**1.2** Smooth Catch-Up Speed~~ ✅ Completed (exponential smoothing + rate limiting)
3. ~~**1.3** Bundle Emote with Movement~~ ✅ Completed (emote in tileMovementStart packet)
4. ~~**2.6** Fix Path Mismatch~~ ✅ Completed (server authoritative path)
5. ~~**2.2** Rotation Slerp~~ ✅ Completed (smooth direction changes)
6. ~~**2.2.1** Fix Slerp Long Path~~ ✅ Completed (dot product check + destination rotation + skip behind tiles)
7. ~~**2.3** Rotation Damping Threshold~~ ✅ Completed (~16° threshold via quaternion dot)
8. ~~**2.4** Only Rotate on Tile Transitions~~ ✅ Completed (removed mid-tile rotation)
9. **2.1** Y-Position Interpolation (quick win)
10. **2.5** Tick System Profiling (debugging)
11. **3.1-3.4** Medium priority items
12. **4.1-4.4** Future polish

---

## Testing Checklist

After each change, verify:
- [ ] Movement feels smooth at 60fps
- [ ] Movement feels smooth at 30fps
- [ ] No visible jank when changing direction
- [ ] No animation mismatches
- [ ] Multiple mobs chasing doesn't lag
- [ ] Respawn position is correct
- [ ] Path interruption works smoothly
- [ ] Catch-up after lag is smooth

---

## Notes

- All changes should maintain OSRS-style 600ms tick timing
- Client interpolation must hide the discrete tick updates
- Server remains authoritative for positions
- Test with simulated latency (100-200ms) to catch sync issues
