# Hyperscape Network Optimization Report

**Date**: December 2024  
**Scope**: End-to-end network infrastructure analysis and optimization roadmap  
**Goal**: Scale to 2000+ concurrent users with sub-100ms latency without major infrastructure changes

---

## Executive Summary

Hyperscape's current networking architecture is well-designed for a server-authoritative game but has several bottlenecks that prevent scaling beyond ~200-500 concurrent users. The primary issue is **O(n²) broadcast scaling** where every entity update is sent to every connected client.

This report details **5 major optimization strategies** that together can:
- Increase concurrent user capacity by **5-10x** (to 2000-5000 users)
- Reduce bandwidth usage by **70-80%**
- Maintain or improve current latency characteristics
- Require zero infrastructure changes (software-only optimizations)

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Identified Bottlenecks](#2-identified-bottlenecks)
3. [Optimization Strategies](#3-optimization-strategies)
   - [3.1 Area of Interest (AOI) System](#31-area-of-interest-aoi-system)
   - [3.2 Transform Data Compression](#32-transform-data-compression)
   - [3.3 Distance-Based Update Throttling](#33-distance-based-update-throttling)
   - [3.4 Tick-Aligned Batch Updates](#34-tick-aligned-batch-updates)
   - [3.5 Delta Compression](#35-delta-compression)
4. [Implementation Roadmap](#4-implementation-roadmap)
5. [Expected Results](#5-expected-results)
6. [Monitoring & Metrics](#6-monitoring--metrics)

---

## 1. Current Architecture Analysis

### 1.1 Protocol Stack

| Layer | Implementation | Status |
|-------|---------------|--------|
| Transport | WebSocket (binary) | ✅ Good |
| Serialization | msgpackr | ✅ Good (2-3x better than JSON) |
| Packet IDs | 1-byte integers | ✅ Good |
| Game Tick | 600ms OSRS-style | ✅ Good |

### 1.2 Update Rates

| Data Type | Current Rate | Notes |
|-----------|-------------|-------|
| Tile movement | 600ms (game tick) | Server-authoritative, efficient |
| Continuous movement | ~33ms (30fps) | Legacy system, higher bandwidth |
| Client input | 30Hz | Good for responsiveness |
| Entity snapshots | 125ms (8Hz) | Client interpolates smoothly |

### 1.3 Data Sizes (Per Entity Update)

| Field | Current Format | Size |
|-------|---------------|------|
| Position (x, y, z) | Float64 array | 24 bytes |
| Quaternion (x, y, z, w) | Float64 array | 32 bytes |
| Velocity (x, y, z) | Float64 array | 24 bytes |
| Entity ID | String (UUID) | ~36 bytes |
| Emote | String | ~4-8 bytes |
| **Total per update** | - | **~120-150 bytes** |

### 1.4 Broadcast Model

```
Current: Server → ALL Clients (O(n²))

┌─────────┐
│ Server  │──────┬──────┬──────┬──────► Client 1
│         │      │      │      │
│ Entity  │──────┼──────┼──────┼──────► Client 2
│ Update  │      │      │      │
│         │──────┼──────┼──────┼──────► Client 3
│         │      │      │      │
└─────────┘      └──────┴──────┴──────► Client N
                 (N packets per entity update)
```

**Problem**: With 100 entities and 100 players, each tick generates 10,000 packets.

---

## 2. Identified Bottlenecks

### 2.1 Critical: O(n²) Broadcast Scaling

**Location**: `packages/server/src/systems/ServerNetwork/broadcast.ts`

```typescript
sendToAll<T = unknown>(name: string, data: T, ignoreSocketId?: string): number {
  const packet = writePacket(name, data);
  this.sockets.forEach((socket) => {
    socket.sendPacket(packet);  // Sends to EVERY client
  });
}
```

**Impact Calculation**:
- 500 players × 200 entities × 1.67 ticks/sec = **166,700 packets/second**
- At 120 bytes/packet = **20 MB/second** outbound bandwidth
- Server CPU bound on packet serialization/send

### 2.2 High: Uncompressed Transform Data

**Location**: All `entityModified`, `entityTileUpdate` packets

Position and rotation use 64-bit floats with full precision:
- Position: 24 bytes (3 × 8 bytes)
- Quaternion: 32 bytes (4 × 8 bytes)
- Velocity: 24 bytes (3 × 8 bytes)

**Reality**: Games need ~1mm precision for position, ~0.01° for rotation. We're sending 1000x more precision than needed.

### 2.3 Medium: No Distance-Based Throttling

All entities update at the same rate regardless of:
- Distance from player (entity 1m away updates as often as entity 100m away)
- Relevance (stationary NPC updates as often as moving mob)
- Visibility (occluded entities update as often as visible ones)

### 2.4 Medium: Per-Entity Packet Overhead

Each entity update is sent as a separate WebSocket message:
- WebSocket frame header: 2-10 bytes
- msgpack overhead: 3-5 bytes per packet
- With 100 entities: 300-500 bytes of pure overhead per tick

### 2.5 Low: No Delta Compression

Full state is sent every update. For a stationary entity:
- Current: Full 120-byte packet every tick
- Optimal: 0 bytes (no change = no packet)

---

## 3. Optimization Strategies

### 3.1 Area of Interest (AOI) System

**Priority**: 🔴 CRITICAL  
**Effort**: Medium (2-3 days)  
**Impact**: 80-95% reduction in broadcast traffic

#### Concept

Instead of sending all entity updates to all clients, maintain a spatial index of which clients can "see" which entities. Only send updates to clients who have the entity in their view.

```
Optimized: Server → Nearby Clients Only (O(n×k))

       ┌─────────────┐
       │   AOI Grid   │
       │  (64m cells) │
       └──────┬──────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│Cell A │ │Cell B │ │Cell C │
│P1, P2 │ │E1, E2 │ │P3, E3 │
└───────┘ └───────┘ └───────┘
    │         │
    ▼         ▼
Entity E1 update → Only P1, P2 receive it (not P3)
```

#### Implementation

```typescript
// packages/server/src/systems/ServerNetwork/AOIManager.ts

const CELL_SIZE = 64; // 64 units per cell (adjustable)
const VIEW_RANGE = 3;  // 3 cells in each direction = 7×7 = 49 cells visible

interface AOICell {
  entities: Set<string>;      // Entity IDs in this cell
  subscribers: Set<string>;   // Socket IDs subscribed to this cell
}

export class AOIManager {
  private cells = new Map<string, AOICell>();
  private entityCells = new Map<string, string>();  // entityId -> cellKey
  private playerCells = new Map<string, Set<string>>(); // playerId -> subscribed cellKeys
  
  /**
   * Get cell key from world position
   */
  getCellKey(x: number, z: number): string {
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);
    return `${cx},${cz}`;
  }
  
  /**
   * Update entity position in AOI grid
   */
  updateEntityPosition(entityId: string, x: number, z: number): void {
    const newKey = this.getCellKey(x, z);
    const oldKey = this.entityCells.get(entityId);
    
    if (oldKey === newKey) return; // Same cell, no change
    
    // Remove from old cell
    if (oldKey) {
      this.cells.get(oldKey)?.entities.delete(entityId);
    }
    
    // Add to new cell
    if (!this.cells.has(newKey)) {
      this.cells.set(newKey, { entities: new Set(), subscribers: new Set() });
    }
    this.cells.get(newKey)!.entities.add(entityId);
    this.entityCells.set(entityId, newKey);
  }
  
  /**
   * Update player's subscribed cells based on position
   * Called when player moves to new cell
   */
  updatePlayerSubscriptions(
    playerId: string, 
    socketId: string, 
    x: number, 
    z: number
  ): { entered: string[], exited: string[] } {
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);
    
    // Calculate new visible cells
    const newCells = new Set<string>();
    for (let dz = -VIEW_RANGE; dz <= VIEW_RANGE; dz++) {
      for (let dx = -VIEW_RANGE; dx <= VIEW_RANGE; dx++) {
        newCells.add(`${cx + dx},${cz + dz}`);
      }
    }
    
    const prevCells = this.playerCells.get(playerId) || new Set();
    const entered: string[] = [];
    const exited: string[] = [];
    
    // Unsubscribe from cells player left
    for (const key of prevCells) {
      if (!newCells.has(key)) {
        this.cells.get(key)?.subscribers.delete(socketId);
        exited.push(key);
      }
    }
    
    // Subscribe to new cells
    for (const key of newCells) {
      if (!prevCells.has(key)) {
        if (!this.cells.has(key)) {
          this.cells.set(key, { entities: new Set(), subscribers: new Set() });
        }
        this.cells.get(key)!.subscribers.add(socketId);
        entered.push(key);
      }
    }
    
    this.playerCells.set(playerId, newCells);
    return { entered, exited };
  }
  
  /**
   * Get all sockets that should receive an entity update
   */
  getSubscribersForEntity(entityId: string): Set<string> {
    const cellKey = this.entityCells.get(entityId);
    if (!cellKey) return new Set();
    
    const cell = this.cells.get(cellKey);
    return cell?.subscribers || new Set();
  }
  
  /**
   * Get all entities in cells visible to a player
   * Used for initial sync when player enters area
   */
  getVisibleEntities(playerId: string): string[] {
    const cells = this.playerCells.get(playerId);
    if (!cells) return [];
    
    const entities: string[] = [];
    for (const cellKey of cells) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        entities.push(...cell.entities);
      }
    }
    return entities;
  }
  
  /**
   * Cleanup when entity is removed
   */
  removeEntity(entityId: string): void {
    const cellKey = this.entityCells.get(entityId);
    if (cellKey) {
      this.cells.get(cellKey)?.entities.delete(entityId);
      this.entityCells.delete(entityId);
    }
  }
  
  /**
   * Cleanup when player disconnects
   */
  removePlayer(playerId: string, socketId: string): void {
    const cells = this.playerCells.get(playerId);
    if (cells) {
      for (const cellKey of cells) {
        this.cells.get(cellKey)?.subscribers.delete(socketId);
      }
      this.playerCells.delete(playerId);
    }
  }
}
```

#### Integration with BroadcastManager

```typescript
// Modified broadcast.ts

export class BroadcastManager {
  private aoiManager: AOIManager;
  
  constructor(sockets: Map<string, ServerSocket>) {
    this.sockets = sockets;
    this.aoiManager = new AOIManager();
  }
  
  /**
   * Broadcast to clients who can see this entity
   */
  sendToNearby<T>(
    name: string, 
    data: T, 
    entityId: string,
    entityX: number,
    entityZ: number
  ): number {
    // Update entity position in AOI
    this.aoiManager.updateEntityPosition(entityId, entityX, entityZ);
    
    // Get subscribers
    const subscribers = this.aoiManager.getSubscribersForEntity(entityId);
    if (subscribers.size === 0) return 0;
    
    // Create packet once, send to all subscribers
    const packet = writePacket(name, data);
    let sentCount = 0;
    
    for (const socketId of subscribers) {
      const socket = this.sockets.get(socketId);
      if (socket) {
        socket.sendPacket(packet);
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  /**
   * Called when player moves - handle AOI subscription changes
   */
  onPlayerMoved(playerId: string, socketId: string, x: number, z: number): void {
    const { entered, exited } = this.aoiManager.updatePlayerSubscriptions(
      playerId, socketId, x, z
    );
    
    // Send entityAdded for newly visible entities
    if (entered.length > 0) {
      const newEntities = this.aoiManager.getVisibleEntities(playerId);
      const socket = this.sockets.get(socketId);
      if (socket) {
        for (const entityId of newEntities) {
          // Get entity and send entityAdded packet
          // (implementation depends on entity manager access)
        }
      }
    }
    
    // Send entityRemoved for entities that left view
    // (optional - client can garbage collect on its own)
  }
}
```

#### Expected Results

| Scenario | Before (packets/sec) | After (packets/sec) | Reduction |
|----------|---------------------|---------------------|-----------|
| 100 players, 100 entities | 16,700 | ~2,000 | 88% |
| 500 players, 200 entities | 166,700 | ~10,000 | 94% |
| 1000 players, 500 entities | 833,500 | ~25,000 | 97% |

---

### 3.2 Transform Data Compression

**Priority**: 🟠 HIGH  
**Effort**: Low (1 day)  
**Impact**: 70-80% reduction in per-packet size

#### 3.2.1 Position Quantization

World coordinates don't need Float64 precision. We can use fixed-point encoding:

```typescript
// packages/shared/src/utils/network/PositionCompression.ts

/**
 * Position Quantization
 * 
 * Assumptions:
 * - World bounds: -5000m to +5000m (10km total)
 * - Required precision: 1mm (0.001m)
 * - Y range: -50m to +206m (256m range for terrain + buildings)
 * 
 * Encoding:
 * - X, Z: 24 bits each = 16.7 million values → 0.6mm precision over 10km ✓
 * - Y: 16 bits = 65,536 values → 3.9mm precision over 256m ✓
 * - Total: 8 bytes (vs 24 bytes for Float64×3) = 67% savings
 */

const WORLD_SIZE = 10000;     // 10km world
const WORLD_HALF = 5000;      // Center at 0
const HEIGHT_MIN = -50;       // Lowest point
const HEIGHT_RANGE = 256;     // Height span

const XZ_SCALE = 0xFFFFFF / WORLD_SIZE;  // 24-bit scale
const Y_SCALE = 0xFFFF / HEIGHT_RANGE;    // 16-bit scale

export function packPosition(x: number, y: number, z: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  
  // Clamp and quantize X (24 bits, little-endian across 3 bytes)
  const qx = Math.round(Math.max(0, Math.min(0xFFFFFF, (x + WORLD_HALF) * XZ_SCALE)));
  view.setUint8(0, qx & 0xFF);
  view.setUint8(1, (qx >> 8) & 0xFF);
  view.setUint8(2, (qx >> 16) & 0xFF);
  
  // Clamp and quantize Z (24 bits)
  const qz = Math.round(Math.max(0, Math.min(0xFFFFFF, (z + WORLD_HALF) * XZ_SCALE)));
  view.setUint8(3, qz & 0xFF);
  view.setUint8(4, (qz >> 8) & 0xFF);
  view.setUint8(5, (qz >> 16) & 0xFF);
  
  // Clamp and quantize Y (16 bits)
  const qy = Math.round(Math.max(0, Math.min(0xFFFF, (y - HEIGHT_MIN) * Y_SCALE)));
  view.setUint16(6, qy, true); // little-endian
  
  return buffer;
}

export function unpackPosition(buffer: ArrayBuffer): { x: number; y: number; z: number } {
  const view = new DataView(buffer);
  
  const qx = view.getUint8(0) | (view.getUint8(1) << 8) | (view.getUint8(2) << 16);
  const qz = view.getUint8(3) | (view.getUint8(4) << 8) | (view.getUint8(5) << 16);
  const qy = view.getUint16(6, true);
  
  return {
    x: qx / XZ_SCALE - WORLD_HALF,
    y: qy / Y_SCALE + HEIGHT_MIN,
    z: qz / XZ_SCALE - WORLD_HALF
  };
}
```

#### 3.2.2 Quaternion Smallest-3 Compression

Quaternions are unit-length, so we can derive the 4th component. We encode only the 3 smallest components:

```typescript
// packages/shared/src/utils/network/QuaternionCompression.ts

/**
 * Smallest-3 Quaternion Compression
 * 
 * Properties of unit quaternions:
 * - x² + y² + z² + w² = 1
 * - Each component ∈ [-1, 1]
 * - The largest component is ≥ 0.5 (since sum of squares = 1)
 * - We can omit the largest and derive it: largest = √(1 - a² - b² - c²)
 * 
 * Encoding:
 * - 2 bits: Index of largest component (0-3)
 * - 3 × 10 bits: Three smallest components, signed, scaled to [-1, 1]
 * - Total: 32 bits = 4 bytes (vs 32 bytes for Float64×4) = 87.5% savings
 * 
 * Precision: 10 bits = 1024 values over range [-0.707, 0.707]
 *          = 0.00138 per step ≈ 0.08° rotation error (imperceptible)
 */

const COMPONENT_BITS = 10;
const COMPONENT_MAX = (1 << COMPONENT_BITS) - 1;  // 1023
const COMPONENT_RANGE = Math.SQRT1_2;  // Max value for non-largest component

export function packQuaternion(
  x: number, 
  y: number, 
  z: number, 
  w: number
): number {  // Returns 32-bit integer
  const components = [x, y, z, w];
  
  // Find index and value of largest component
  let maxIdx = 0;
  let maxVal = Math.abs(components[0]);
  for (let i = 1; i < 4; i++) {
    const absVal = Math.abs(components[i]);
    if (absVal > maxVal) {
      maxVal = absVal;
      maxIdx = i;
    }
  }
  
  // Sign of largest determines overall quaternion sign
  // (q and -q represent same rotation, so we normalize)
  const sign = components[maxIdx] < 0 ? -1 : 1;
  
  // Quantize three smallest components
  const quantized: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (i !== maxIdx) {
      // Normalize to [-1, 1] range within ±√0.5
      const normalized = (components[i] * sign) / COMPONENT_RANGE;
      // Map to [0, 1023]
      const q = Math.round((normalized + 1) * 0.5 * COMPONENT_MAX);
      quantized.push(Math.max(0, Math.min(COMPONENT_MAX, q)));
    }
  }
  
  // Pack: [maxIdx:2][comp0:10][comp1:10][comp2:10] = 32 bits
  return (maxIdx & 0x3) |
         (quantized[0] << 2) |
         (quantized[1] << 12) |
         (quantized[2] << 22);
}

export function unpackQuaternion(packed: number): { x: number; y: number; z: number; w: number } {
  const maxIdx = packed & 0x3;
  const q0 = (packed >> 2) & 0x3FF;
  const q1 = (packed >> 12) & 0x3FF;
  const q2 = (packed >> 22) & 0x3FF;
  
  // Dequantize to [-√0.5, √0.5]
  const components = [
    ((q0 / COMPONENT_MAX) * 2 - 1) * COMPONENT_RANGE,
    ((q1 / COMPONENT_MAX) * 2 - 1) * COMPONENT_RANGE,
    ((q2 / COMPONENT_MAX) * 2 - 1) * COMPONENT_RANGE
  ];
  
  // Reconstruct largest component
  const sumSq = components[0] ** 2 + components[1] ** 2 + components[2] ** 2;
  const largest = Math.sqrt(Math.max(0, 1 - sumSq));
  
  // Insert largest at correct index
  const result = [0, 0, 0, 0];
  let smallIdx = 0;
  for (let i = 0; i < 4; i++) {
    if (i === maxIdx) {
      result[i] = largest;
    } else {
      result[i] = components[smallIdx++];
    }
  }
  
  return { x: result[0], y: result[1], z: result[2], w: result[3] };
}
```

#### 3.2.3 Combined Transform Packet

```typescript
// Optimized entity transform: 14 bytes total
// - Position: 8 bytes (quantized)
// - Quaternion: 4 bytes (smallest-3)
// - Emote: 1 byte (enum index)
// - Flags: 1 byte (running, combat, etc.)

interface CompressedTransform {
  position: ArrayBuffer;  // 8 bytes
  quaternion: number;     // 4 bytes (32-bit packed)
  emote: number;          // 1 byte
  flags: number;          // 1 byte
}

// Before: ~120 bytes per entity update
// After:  ~14 bytes per entity update
// Savings: 88%
```

---

### 3.3 Distance-Based Update Throttling

**Priority**: 🟡 MEDIUM  
**Effort**: Low (0.5 days)  
**Impact**: 50-70% additional reduction when combined with AOI

#### Concept

Even within a player's visible area, entities further away don't need updates as frequently. The human eye can't perceive small movements at distance.

```typescript
// packages/server/src/systems/ServerNetwork/UpdateThrottler.ts

interface EntityUpdateState {
  lastUpdateTime: Map<string, number>;  // socketId -> timestamp
}

const UPDATE_INTERVALS = [
  { maxDistSq: 32 * 32,    intervalMs: 0 },      // <32m: every tick (600ms)
  { maxDistSq: 64 * 64,    intervalMs: 600 },    // 32-64m: every 2 ticks
  { maxDistSq: 128 * 128,  intervalMs: 1800 },   // 64-128m: every 4 ticks
  { maxDistSq: Infinity,   intervalMs: 3000 },   // >128m: every 6 ticks
];

export class UpdateThrottler {
  private entityStates = new Map<string, EntityUpdateState>();
  
  /**
   * Check if entity update should be sent to specific client
   */
  shouldSendUpdate(
    entityId: string,
    socketId: string,
    entityX: number, entityZ: number,
    playerX: number, playerZ: number,
    now: number
  ): boolean {
    // Get or create entity state
    let state = this.entityStates.get(entityId);
    if (!state) {
      state = { lastUpdateTime: new Map() };
      this.entityStates.set(entityId, state);
    }
    
    // Calculate squared distance (avoid sqrt)
    const dx = entityX - playerX;
    const dz = entityZ - playerZ;
    const distSq = dx * dx + dz * dz;
    
    // Find appropriate interval
    let interval = 0;
    for (const tier of UPDATE_INTERVALS) {
      if (distSq < tier.maxDistSq) {
        interval = tier.intervalMs;
        break;
      }
    }
    
    // Check if enough time has passed
    const lastUpdate = state.lastUpdateTime.get(socketId) || 0;
    if (now - lastUpdate < interval) {
      return false;
    }
    
    // Update timestamp and allow send
    state.lastUpdateTime.set(socketId, now);
    return true;
  }
  
  /**
   * Cleanup when entity is removed
   */
  removeEntity(entityId: string): void {
    this.entityStates.delete(entityId);
  }
}
```

#### Integration

```typescript
// In tile movement broadcast
for (const socketId of subscribers) {
  const socket = this.sockets.get(socketId);
  if (!socket?.player) continue;
  
  const playerPos = socket.player.position;
  
  // Check throttle
  if (!this.throttler.shouldSendUpdate(
    entityId, socketId,
    entityX, entityZ,
    playerPos.x, playerPos.z,
    now
  )) {
    continue; // Skip this client for this update
  }
  
  socket.sendPacket(packet);
}
```

---

### 3.4 Tick-Aligned Batch Updates

**Priority**: 🟡 MEDIUM  
**Effort**: Medium (1-2 days)  
**Impact**: 20-30% reduction in WebSocket overhead

#### Concept

Instead of sending individual `entityModified` packets, batch all entity updates for a client into a single packet per tick.

```typescript
// Current approach: N packets per client per tick
// tick → entity1Update, entity2Update, entity3Update, ...

// Optimized: 1 packet per client per tick
// tick → batchedUpdate { entities: [entity1, entity2, entity3, ...] }
```

#### Implementation

```typescript
// packages/shared/src/types/network-types.ts

interface BatchedTickUpdate {
  tick: number;
  updates: Array<{
    id: string;            // Entity ID (could be further optimized to numeric)
    p?: ArrayBuffer;       // Compressed position (8 bytes)
    q?: number;            // Compressed quaternion (4 bytes)
    e?: number;            // Emote index (1 byte)
    h?: number;            // Health (if changed, 2 bytes)
    s?: number;            // State flags (1 byte)
  }>;
}

// packets.ts - add new packet type
const names = [
  // ... existing packets
  'batchedTickUpdate',  // New batched update packet
];
```

```typescript
// Server tick broadcast phase

onTick(tickNumber: number): void {
  // Build per-client update batches
  const clientBatches = new Map<string, BatchedTickUpdate>();
  
  // Collect all dirty entities
  for (const entityId of dirtyEntities) {
    const entity = this.world.entities.get(entityId);
    if (!entity) continue;
    
    const [x, z] = [entity.position.x, entity.position.z];
    const subscribers = this.aoiManager.getSubscribersForEntity(entityId);
    
    for (const socketId of subscribers) {
      // Apply throttling
      const socket = this.sockets.get(socketId);
      if (!socket?.player) continue;
      
      if (!this.throttler.shouldSendUpdate(
        entityId, socketId, x, z,
        socket.player.position.x, socket.player.position.z,
        Date.now()
      )) {
        continue;
      }
      
      // Add to client's batch
      if (!clientBatches.has(socketId)) {
        clientBatches.set(socketId, { tick: tickNumber, updates: [] });
      }
      
      clientBatches.get(socketId)!.updates.push({
        id: entityId,
        p: packPosition(entity.position.x, entity.position.y, entity.position.z),
        q: packQuaternion(
          entity.node.quaternion.x,
          entity.node.quaternion.y,
          entity.node.quaternion.z,
          entity.node.quaternion.w
        ),
        e: EMOTE_TO_INDEX[entity.data.emote] ?? 0,
      });
    }
  }
  
  // Send batched updates
  for (const [socketId, batch] of clientBatches) {
    const socket = this.sockets.get(socketId);
    if (socket && batch.updates.length > 0) {
      socket.send('batchedTickUpdate', batch);
    }
  }
  
  dirtyEntities.clear();
}
```

#### Benefits

1. **Reduced WebSocket frame overhead**: 1 frame header vs N frame headers
2. **Better compression**: msgpackr can compress repeated keys in batch
3. **Atomic updates**: Client applies all changes in one frame (no tearing)

---

### 3.5 Delta Compression

**Priority**: 🟢 LOW (future optimization)  
**Effort**: High (3-5 days)  
**Impact**: 30-50% additional reduction for slowly-moving entities

#### Concept

Only send changes from previous state instead of full state:

```typescript
// Full state (current): 14 bytes every tick
// Delta state: 0 bytes if unchanged, 2-8 bytes if position changed slightly

interface DeltaUpdate {
  id: string;
  deltaP?: [number, number, number];  // Position delta in mm (3 bytes if small)
  deltaQ?: number;                     // Quaternion delta (skip if unchanged)
  changed: number;                     // Bitmask of what changed
}
```

This is more complex because:
- Requires tracking last-sent state per entity per client
- Needs reliable delivery or periodic full-state sync
- Client must maintain synchronized state

**Recommendation**: Implement after other optimizations are proven stable.

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Week 1)

| Task | Days | Dependencies |
|------|------|--------------|
| Implement AOIManager | 1 | None |
| Integrate AOI with BroadcastManager | 0.5 | AOIManager |
| Add player position tracking hooks | 0.5 | AOI Integration |
| Handle entity enter/exit events | 0.5 | Above |
| Testing and debugging | 0.5 | Above |

**Deliverable**: Working AOI system, O(n²) → O(n×k) scaling

### Phase 2: Compression (Week 2)

| Task | Days | Dependencies |
|------|------|--------------|
| Implement position quantization | 0.5 | None |
| Implement quaternion smallest-3 | 0.5 | None |
| Create compressed transform packet | 0.5 | Above |
| Update client-side decompression | 0.5 | Above |
| Update all send callsites | 1 | Above |
| Testing and validation | 0.5 | Above |

**Deliverable**: 70% reduction in per-packet size

### Phase 3: Throttling (Week 2-3)

| Task | Days | Dependencies |
|------|------|--------------|
| Implement UpdateThrottler | 0.5 | None |
| Integrate with broadcast flow | 0.5 | AOI, Throttler |
| Tune distance thresholds | 0.5 | Testing |

**Deliverable**: 50% reduction in distant entity updates

### Phase 4: Batching (Week 3)

| Task | Days | Dependencies |
|------|------|--------------|
| Define BatchedTickUpdate packet | 0.5 | Compression |
| Implement server-side batching | 1 | Above |
| Implement client-side unbatching | 0.5 | Above |
| Testing | 0.5 | Above |

**Deliverable**: 20% reduction in WebSocket overhead

### Phase 5: Monitoring & Tuning (Week 4)

| Task | Days | Dependencies |
|------|------|--------------|
| Add network metrics collection | 1 | All above |
| Create monitoring dashboard | 1 | Above |
| Load testing with 500+ users | 1 | Above |
| Performance tuning | 2 | Above |

---

## 5. Expected Results

### Before vs After Comparison

| Metric | Current | After Optimization | Improvement |
|--------|---------|-------------------|-------------|
| Max concurrent users | ~200-500 | ~2000-5000 | 5-10x |
| Bandwidth per user | ~50 KB/s | ~5 KB/s | 90% reduction |
| Packets per second (500 users) | 166,700 | ~8,000 | 95% reduction |
| Bytes per entity update | ~120 | ~14 | 88% reduction |
| Server CPU (networking) | 70-90% | 15-25% | 70% reduction |

### Latency Impact

| Scenario | Current | After | Notes |
|----------|---------|-------|-------|
| Nearby entities (<32m) | Same tick | Same tick | No change |
| Medium entities (32-64m) | Same tick | +1 tick | +600ms max |
| Distant entities (>64m) | Same tick | +2-4 ticks | Imperceptible at distance |

### Infrastructure Requirements

| Component | Current | After | Change |
|-----------|---------|-------|--------|
| Server instances | 1 | 1 | No change |
| Server memory | 2-4 GB | 2-4 GB | No change |
| Server CPU cores | 4-8 | 4-8 | No change |
| Outbound bandwidth | 200 Mbps | 20 Mbps | 90% reduction |

---

## 6. Monitoring & Metrics

### Key Performance Indicators (KPIs)

Add these metrics to track network health:

```typescript
// packages/server/src/systems/ServerNetwork/NetworkMetrics.ts

interface NetworkMetrics {
  // Volume metrics
  packetsPerSecond: number;
  bytesPerSecond: number;
  activeConnections: number;
  entitiesTracked: number;
  
  // AOI metrics
  aoiCells: number;
  averageSubscribersPerCell: number;
  entityCellChangesPerSecond: number;
  
  // Throttle metrics
  updatesThrottled: number;
  updatesThrottledPercent: number;
  
  // Latency metrics
  averageTickDuration: number;
  maxTickDuration: number;
  tickDriftMs: number;
  
  // Per-client metrics (sampled)
  averageEntitiesPerClient: number;
  averageBytesPerClient: number;
}

export class NetworkMetricsCollector {
  private metrics: NetworkMetrics = { /* defaults */ };
  private sampleWindow = 60; // seconds
  
  recordPacketSent(bytes: number): void {
    // Track packet/byte counts
  }
  
  recordThrottle(entityId: string, socketId: string): void {
    // Track throttle decisions
  }
  
  getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }
  
  // Called every tick to update derived metrics
  tick(): void {
    // Calculate rates, averages
  }
}
```

### Logging Recommendations

```typescript
// Log levels for network events

// INFO: Connection/disconnection, major state changes
console.info(`[Network] Player ${playerId} connected, ${this.sockets.size} total`);

// DEBUG: Per-tick summaries (only when enabled)
console.debug(`[Network] Tick ${tick}: ${packetsOut} packets, ${bytesOut} bytes`);

// WARN: Anomalies
console.warn(`[Network] Tick ${tick} took ${duration}ms (>100ms threshold)`);

// ERROR: Failures
console.error(`[Network] Failed to send to ${socketId}:`, error);
```

### Health Checks

```typescript
// Expose health endpoint for monitoring

interface NetworkHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connections: number;
  packetsPerSecond: number;
  avgTickMs: number;
  issues: string[];
}

function getNetworkHealth(): NetworkHealth {
  const issues: string[] = [];
  
  if (avgTickMs > 100) {
    issues.push(`Tick duration high: ${avgTickMs}ms`);
  }
  if (packetsPerSecond > 100000) {
    issues.push(`Packet rate very high: ${packetsPerSecond}/s`);
  }
  
  return {
    status: issues.length === 0 ? 'healthy' : 
            issues.length < 3 ? 'degraded' : 'unhealthy',
    connections: this.sockets.size,
    packetsPerSecond,
    avgTickMs,
    issues
  };
}
```

---

## Appendix A: Quick Reference

### Optimization Summary

| Optimization | Complexity | Impact | Priority |
|--------------|------------|--------|----------|
| AOI System | Medium | 80-95% broadcast reduction | 🔴 Critical |
| Position Quantization | Low | 67% position size reduction | 🟠 High |
| Quaternion Smallest-3 | Low | 87% rotation size reduction | 🟠 High |
| Distance Throttling | Low | 50% distant update reduction | 🟡 Medium |
| Batch Updates | Medium | 20% WebSocket overhead reduction | 🟡 Medium |
| Delta Compression | High | 30% additional for static entities | 🟢 Low |

### Size Comparison

```
BEFORE (per entity update):
┌──────────────────────────────────────────────────────────────┐
│ ID (36B) │ Position (24B) │ Quaternion (32B) │ Extras (~30B) │
└──────────────────────────────────────────────────────────────┘
Total: ~122 bytes

AFTER (per entity update):
┌─────────────────────────────────────────────────────┐
│ ID (2B) │ Position (8B) │ Quaternion (4B) │ Flags (1B) │
└─────────────────────────────────────────────────────┘
Total: ~15 bytes (88% reduction)
```

### Formula Reference

```
AOI Scaling:
  Before: O(players × entities) = O(n²)
  After:  O(players × avg_nearby_entities) = O(n × k), k << n

Bandwidth Estimate:
  Before: players × entities × update_rate × bytes_per_update
  After:  players × nearby_entities × throttled_rate × compressed_bytes

Example (500 players, 200 entities):
  Before: 500 × 200 × 1.67/s × 122B = 20.3 MB/s
  After:  500 × 20 × 0.8/s × 15B = 120 KB/s (99.4% reduction)
```

---

## Appendix B: Testing Checklist

### Unit Tests

- [ ] AOIManager.getCellKey() returns correct cell for boundary positions
- [ ] AOIManager.updatePlayerSubscriptions() tracks entered/exited cells
- [ ] packPosition/unpackPosition roundtrip maintains <1mm error
- [ ] packQuaternion/unpackQuaternion roundtrip maintains <0.1° error
- [ ] UpdateThrottler respects distance-based intervals

### Integration Tests

- [ ] Entity moving between cells updates subscribers correctly
- [ ] Player sees entityAdded when entity enters view
- [ ] Player sees entityRemoved when entity exits view
- [ ] Compressed transforms apply correctly on client
- [ ] Batched updates apply atomically

### Load Tests

- [ ] 100 players: <10ms tick duration
- [ ] 500 players: <50ms tick duration
- [ ] 1000 players: <100ms tick duration
- [ ] Bandwidth stays under 10 KB/s per player
- [ ] No memory leaks over 24 hour test

---

*Report generated for Hyperscape multiplayer optimization initiative.*



