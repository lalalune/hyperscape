## Priority 2: High (Do Second)

### 2.1 Y-Position Interpolation
**Impact**: Medium-High - eliminates height popping
**Effort**: Low
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: Terrain height snaps instantly when server sends update. Character appears to float/sink briefly when moving between elevations.

**Solution**: Lerp Y position toward target Y over 100-200ms instead of instant snap.

**Status**: [ ] Not started

---

### 2.2 Rotation Damping Threshold
**Impact**: Medium - smoother direction changes
**Effort**: Low
**File**: `packages/shared/src/systems/client/TileInterpolator.ts`

**Problem**: Rotation updates on every frame even for tiny direction changes, causing subtle jitter.

**Solution**: Only update rotation if direction changed by more than 15 degrees. Add hysteresis to prevent oscillation.

**Status**: [ ] Not started

---

### 2.3 Add Tick System Profiling
**Impact**: High for debugging
**Effort**: Low
**File**: `packages/server/src/systems/TickSystem.ts`

**Problem**: No visibility into which systems are slow. Hard to identify performance bottlenecks.

**Solution**: Track execution time per listener. Log warnings if any listener takes >100ms. Expose metrics for monitoring.

**Status**: [ ] Not started

---

### 2.4 Fix Client/Server Path Mismatch
**Impact**: Medium - eliminates route desync
**Effort**: High
**Files**:
- `packages/shared/src/systems/client/TileInterpolator.ts`
- `packages/shared/src/systems/shared/movement/TileSystem.ts`

**Problem**: Client uses naive diagonal pathing to calculate intermediate tiles. Server uses BFS. Results in client taking slightly different route.

**Solution**: Either:
- (A) Run same BFS on client for validation, OR
- (B) Server sends complete detailed path including all intermediate tiles

**Status**: [ ] Not started

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

1. **1.1** Throttle Mob Repathing (critical perf)
2. **1.2** Smooth Catch-Up Speed (high visibility)
3. **1.3** Bundle Emote with Movement (quick win)
4. **2.1** Y-Position Interpolation (quick win)
5. **2.2** Rotation Damping (quick win)
6. **2.3** Tick System Profiling (debugging)
7. **2.4** Fix Path Mismatch (complex)
8. **3.1-3.4** Medium priority items
9. **4.1-4.4** Future polish

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
