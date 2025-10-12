/**
 * Entity Interpolation and Compression System
 * Handles both network compression and smooth movement interpolation for entities
 */

import { System } from './System';
import type { World } from '../World';
import type { Entity } from '../entities/Entity';
import type { NetworkSystem } from '../types/system-interfaces';
import * as THREE from 'three';

// Shared vector and quaternion objects to avoid allocations
const _v3_1 = new THREE.Vector3()
const _v3_2 = new THREE.Vector3()
const _v3_3 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()

// Pre-allocated buffers for compression
const PACKET_BUFFER_SIZE = 64 // Max packet size
const COMPRESSION_BUFFER = new ArrayBuffer(PACKET_BUFFER_SIZE)
const COMPRESSION_VIEW = new DataView(COMPRESSION_BUFFER)

// Field flags for delta compression
enum DeltaFields {
  POSITION_X = 1 << 0,
  POSITION_Y = 1 << 1,
  POSITION_Z = 1 << 2,
  ROTATION_X = 1 << 3,
  ROTATION_Y = 1 << 4,
  ROTATION_Z = 1 << 5,
  ROTATION_W = 1 << 6,
  VELOCITY_X = 1 << 7,
  VELOCITY_Y = 1 << 8,
  VELOCITY_Z = 1 << 9,
  STATE = 1 << 10,
}

interface EntitySnapshot {
  position: Float32Array;  // Pre-allocated [x, y, z]
  rotation: Float32Array;  // Pre-allocated [x, y, z, w]
  velocity: Float32Array;  // Pre-allocated [x, y, z]
  state: number;
  timestamp: number;
  sequence: number;
}

interface CompressedPacket {
  id: string;
  sequence: number;
  baseSequence: number;
  fields: number;
  dataLength: number;  // Actual data length in buffer
  data: Uint8Array;     // View into shared buffer
}

interface InterpolationState {
  entityId: string;
  // Pre-allocated snapshots circular buffer
  snapshots: EntitySnapshot[];
  snapshotIndex: number;
  snapshotCount: number;
  // Current interpolated values
  currentPosition: THREE.Vector3;
  currentRotation: THREE.Quaternion;
  // Temporary work vectors (never allocated in hot path)
  tempPosition: THREE.Vector3;
  tempRotation: THREE.Quaternion;
  lastUpdate: number;
}

// Object pool for snapshots to prevent allocations
class SnapshotPool {
  private pool: EntitySnapshot[] = [];
  private maxPoolSize = 100;
  
  acquire(): EntitySnapshot {
    let snapshot = this.pool.pop();
    if (!snapshot) {
      snapshot = {
        position: new Float32Array(3),
        rotation: new Float32Array(4),
        velocity: new Float32Array(3),
        state: 0,
        timestamp: 0,
        sequence: 0
      };
    }
    return snapshot;
  }
  
  release(snapshot: EntitySnapshot): void {
    if (this.pool.length < this.maxPoolSize) {
      // Clear data
      snapshot.position[0] = snapshot.position[1] = snapshot.position[2] = 0;
      snapshot.rotation[0] = snapshot.rotation[1] = snapshot.rotation[2] = 0;
      snapshot.rotation[3] = 1;
      snapshot.velocity[0] = snapshot.velocity[1] = snapshot.velocity[2] = 0;
      snapshot.state = 0;
      snapshot.timestamp = 0;
      snapshot.sequence = 0;
      this.pool.push(snapshot);
    }
  }
}

const snapshotPool = new SnapshotPool();

/**
 * Unified system for entity network compression and interpolation
 */
export class EntityInterpolationSystem extends System {
  private states: Map<string, InterpolationState> = new Map();
  private interpolationDelay: number = 100; // ms
  private maxSnapshots: number = 20;
  private extrapolationLimit: number = 500; // ms
  
  // Compression settings
  private compressionEnabled: boolean;
  private quantizationScale: number = 1000;
  private rotationScale: number = 32767;
  private currentSequence: number = 0;
  
  // Pre-allocated compression work buffer
  private compressionWorkBuffer = new Uint8Array(PACKET_BUFFER_SIZE);
  
  // Metrics
  private metrics = {
    entitiesTracked: 0,
    packetsCompressed: 0,
    packetsFull: 0,
    bytesCompressed: 0,
    bytesUncompressed: 0
  };
  
  constructor(world: World) {
    super(world);
    // TEMPORARILY DISABLE compression to fix movement
    // TODO: Re-enable after fixing compression packet format
    this.compressionEnabled = false; // was: world.isServer
  }
  
  override start(): void {
    console.log(`[EntityInterpolation] Starting ${this.world.isServer ? 'compression' : 'interpolation'} mode`);
    
    if (this.world.isServer && this.compressionEnabled) {
      this.interceptServerPackets();
    } else {
      // Listen for entity updates on client
      this.handleEntityUpdate = this.handleEntityUpdate.bind(this);
      this.handleEntityRemoved = this.handleEntityRemoved.bind(this);
      this.handleCompressedUpdate = this.handleCompressedUpdate.bind(this);
      this.world.on('entityModified', this.handleEntityUpdate);
      this.world.on('entityRemoved', this.handleEntityRemoved);
      this.world.on('compressedUpdate', this.handleCompressedUpdate);
    }
  }

  override destroy(): void {
    if (!this.world.isServer) {
      try { this.world.off('entityModified', this.handleEntityUpdate as unknown as (...args: unknown[]) => void) } catch {}
      try { this.world.off('entityRemoved', this.handleEntityRemoved as unknown as (...args: unknown[]) => void) } catch {}
      try { this.world.off('compressedUpdate', this.handleCompressedUpdate as unknown as (...args: unknown[]) => void) } catch {}
    }
    this.states.clear();
  }
  
  /**
   * Handle uncompressed entity update (client-side)
   */
  private handleEntityUpdate(data: {
    id: string;
    changes: {
      p?: [number, number, number];
      q?: [number, number, number, number];
      v?: [number, number, number];
      s?: number;
    };
  }): void {
    // SKIP local player entirely - it's handled by ClientNetwork and PlayerLocal
    // This prevents position judder from multiple systems updating the same entity
    if (data.id === this.world.entities.player?.id) {
      return; // ClientNetwork handles local player updates
    }
    
    // For other entities, use interpolation
    let state = this.states.get(data.id);
    if (!state) {
      state = this.createInterpolationState(data.id);
      this.states.set(data.id, state);
    }
    
    // Add snapshot if position provided
    if (data.changes.p) {
      this.addSnapshot(state, data);
    }
  }
  
  /**
   * Handle compressed entity update (client-side)
   */
  private handleCompressedUpdate(packet: CompressedPacket): void {
    const decompressed = this.decompressPacket(packet);
    if (decompressed) {
      // Convert to standard entity update format
      this.handleEntityUpdate({
        id: packet.id,
        changes: {
          p: [decompressed.position[0], decompressed.position[1], decompressed.position[2]],
          q: [decompressed.rotation[0], decompressed.rotation[1], decompressed.rotation[2], decompressed.rotation[3]],
          v: [decompressed.velocity[0], decompressed.velocity[1], decompressed.velocity[2]],
          s: decompressed.state
        }
      });
    }
  }
  
  /**
   * Add snapshot to interpolation state (reuses existing buffers)
   */
  private addSnapshot(state: InterpolationState, data: {
    changes: {
      p?: [number, number, number];
      q?: [number, number, number, number];
      v?: [number, number, number];
      s?: number;
    };
  }): void {
    // Use circular buffer - no allocation
    const snapshot = state.snapshots[state.snapshotIndex];
    
    // Copy data into existing arrays
    if (data.changes.p) {
      snapshot.position[0] = data.changes.p[0];
      snapshot.position[1] = data.changes.p[1];
      snapshot.position[2] = data.changes.p[2];
    }
    
    if (data.changes.q) {
      snapshot.rotation[0] = data.changes.q[0];
      snapshot.rotation[1] = data.changes.q[1];
      snapshot.rotation[2] = data.changes.q[2];
      snapshot.rotation[3] = data.changes.q[3];
    } else {
      // Keep current rotation
      snapshot.rotation[0] = state.currentRotation.x;
      snapshot.rotation[1] = state.currentRotation.y;
      snapshot.rotation[2] = state.currentRotation.z;
      snapshot.rotation[3] = state.currentRotation.w;
    }
    
    if (data.changes.v) {
      snapshot.velocity[0] = data.changes.v[0];
      snapshot.velocity[1] = data.changes.v[1];
      snapshot.velocity[2] = data.changes.v[2];
    } else {
      snapshot.velocity[0] = 0;
      snapshot.velocity[1] = 0;
      snapshot.velocity[2] = 0;
    }
    
    snapshot.state = data.changes.s || 0;
    snapshot.timestamp = performance.now();
    snapshot.sequence = ++this.currentSequence;
    
    // Update circular buffer index
    state.snapshotIndex = (state.snapshotIndex + 1) % this.maxSnapshots;
    state.snapshotCount = Math.min(state.snapshotCount + 1, this.maxSnapshots);
    state.lastUpdate = performance.now();
  }
  
  /**
   * Compress entity state (server-side)
   */
  private compressEntityState(entityId: string, current: {
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    velocity: THREE.Vector3;
    state: number;
  }): CompressedPacket | null {
    // Get or create state
    let state = this.states.get(entityId);
    if (!state) {
      state = this.createInterpolationState(entityId);
      this.states.set(entityId, state);
    }
    
    // Store current as snapshot (reuse buffer)
    const snapshot = state.snapshots[state.snapshotIndex];
    snapshot.position[0] = current.position.x;
    snapshot.position[1] = current.position.y;
    snapshot.position[2] = current.position.z;
    snapshot.rotation[0] = current.rotation.x;
    snapshot.rotation[1] = current.rotation.y;
    snapshot.rotation[2] = current.rotation.z;
    snapshot.rotation[3] = current.rotation.w;
    snapshot.velocity[0] = current.velocity.x;
    snapshot.velocity[1] = current.velocity.y;
    snapshot.velocity[2] = current.velocity.z;
    snapshot.state = current.state;
    snapshot.timestamp = performance.now();
    snapshot.sequence = ++this.currentSequence;
    
    // Find previous snapshot for delta compression
    const prevIndex = (state.snapshotIndex - 1 + this.maxSnapshots) % this.maxSnapshots;
    const hasHistory = state.snapshotCount > 1;
    
    if (hasHistory) {
      const prevSnapshot = state.snapshots[prevIndex];
      const deltaPacket = this.createDeltaPacket(prevSnapshot, snapshot, entityId);
      if (deltaPacket) {
        this.metrics.packetsCompressed++;
        state.snapshotIndex = (state.snapshotIndex + 1) % this.maxSnapshots;
        state.snapshotCount = Math.min(state.snapshotCount + 1, this.maxSnapshots);
        return deltaPacket;
      }
    }
    
    // Create full packet
    this.metrics.packetsFull++;
    const fullPacket = this.createFullPacket(snapshot, entityId);
    
    state.snapshotIndex = (state.snapshotIndex + 1) % this.maxSnapshots;
    state.snapshotCount = Math.min(state.snapshotCount + 1, this.maxSnapshots);
    
    return fullPacket;
  }
  
  /**
   * Create delta packet (reuses compression buffer)
   */
  private createDeltaPacket(prev: EntitySnapshot, current: EntitySnapshot, entityId: string): CompressedPacket | null {
    let offset = 0;
    let fields = 0;
    
    const posThreshold = 0.01;
    const rotThreshold = 0.001;
    const velThreshold = 0.1;
    const maxDelta = 32.767; // Max for 16-bit quantized
    
    // Check position deltas
    for (let i = 0; i < 3; i++) {
      const delta = current.position[i] - prev.position[i];
      if (Math.abs(delta) > maxDelta) return null; // Too large, need full packet
      
      if (Math.abs(delta) > posThreshold) {
        const fieldBit = (DeltaFields.POSITION_X << i);
        fields |= fieldBit;
        const quantized = Math.round(delta * this.quantizationScale);
        COMPRESSION_VIEW.setInt16(offset, quantized, true);
        offset += 2;
      }
    }
    
    // Check rotation deltas
    for (let i = 0; i < 4; i++) {
      const delta = current.rotation[i] - prev.rotation[i];
      if (Math.abs(delta) > rotThreshold) {
        const fieldBit = (DeltaFields.ROTATION_X << i);
        fields |= fieldBit;
        const quantized = Math.round(current.rotation[i] * this.rotationScale);
        COMPRESSION_VIEW.setInt16(offset, quantized, true);
        offset += 2;
      }
    }
    
    // Check velocity changes
    for (let i = 0; i < 3; i++) {
      const delta = current.velocity[i] - prev.velocity[i];
      if (Math.abs(delta) > velThreshold) {
        const fieldBit = (DeltaFields.VELOCITY_X << (i + 7));
        fields |= fieldBit;
        const quantized = Math.round(current.velocity[i] * this.quantizationScale);
        COMPRESSION_VIEW.setInt16(offset, quantized, true);
        offset += 2;
      }
    }
    
    // Check state change
    if (current.state !== prev.state) {
      fields |= DeltaFields.STATE;
      COMPRESSION_VIEW.setUint8(offset, current.state);
      offset += 1;
    }
    
    // If no changes, don't send packet
    if (fields === 0) return null;
    
    return {
      id: entityId,
      sequence: current.sequence,
      baseSequence: prev.sequence,
      fields,
      dataLength: offset,
      data: new Uint8Array(COMPRESSION_BUFFER, 0, offset)
    };
  }
  
  /**
   * Create full packet (reuses compression buffer)
   */
  private createFullPacket(snapshot: EntitySnapshot, entityId: string): CompressedPacket {
    let offset = 0;
    
    // Pack positions (32-bit to avoid overflow)
    for (let i = 0; i < 3; i++) {
      const quantized = Math.round(snapshot.position[i] * this.quantizationScale);
      COMPRESSION_VIEW.setInt32(offset, quantized, true);
      offset += 4;
    }
    
    // Pack rotations (16-bit)
    for (let i = 0; i < 4; i++) {
      const quantized = Math.round(snapshot.rotation[i] * this.rotationScale);
      COMPRESSION_VIEW.setInt16(offset, quantized, true);
      offset += 2;
    }
    
    // Pack velocities (32-bit)
    for (let i = 0; i < 3; i++) {
      const quantized = Math.round(snapshot.velocity[i] * this.quantizationScale);
      COMPRESSION_VIEW.setInt32(offset, quantized, true);
      offset += 4;
    }
    
    // Pack state
    COMPRESSION_VIEW.setUint8(offset, snapshot.state);
    offset += 1;
    
    return {
      id: entityId,
      sequence: snapshot.sequence,
      baseSequence: -1, // Full snapshot
      fields: 0x7FF, // All fields
      dataLength: offset,
      data: new Uint8Array(COMPRESSION_BUFFER, 0, offset)
    };
  }
  
  /**
   * Decompress packet into snapshot (reuses work buffer)
   */
  private decompressPacket(packet: CompressedPacket): EntitySnapshot | null {
    // Get state to find base snapshot for delta
    const state = this.states.get(packet.id);
    
    // Use work buffer
    const result = snapshotPool.acquire();
    
    if (packet.baseSequence === -1) {
      // Full packet
      let offset = 0;
      const view = new DataView(packet.data.buffer, packet.data.byteOffset, packet.dataLength);
      
      // Read positions (32-bit)
      for (let i = 0; i < 3; i++) {
        result.position[i] = view.getInt32(offset, true) / this.quantizationScale;
        offset += 4;
      }
      
      // Read rotations (16-bit)
      for (let i = 0; i < 4; i++) {
        result.rotation[i] = view.getInt16(offset, true) / this.rotationScale;
        offset += 2;
      }
      
      // Read velocities (32-bit)
      for (let i = 0; i < 3; i++) {
        result.velocity[i] = view.getInt32(offset, true) / this.quantizationScale;
        offset += 4;
      }
      
      // Read state
      result.state = view.getUint8(offset);
      result.sequence = packet.sequence;
      result.timestamp = performance.now();
      
      return result;
    }
    
    // Delta packet - find base
    if (!state) {
      snapshotPool.release(result);
      return null;
    }
    
    // Find base snapshot
    let baseSnapshot: EntitySnapshot | null = null;
    for (let i = 0; i < state.snapshotCount; i++) {
      if (state.snapshots[i].sequence === packet.baseSequence) {
        baseSnapshot = state.snapshots[i];
        break;
      }
    }
    
    if (!baseSnapshot) {
      snapshotPool.release(result);
      return null;
    }
    
    // Copy base values
    result.position[0] = baseSnapshot.position[0];
    result.position[1] = baseSnapshot.position[1];
    result.position[2] = baseSnapshot.position[2];
    result.rotation[0] = baseSnapshot.rotation[0];
    result.rotation[1] = baseSnapshot.rotation[1];
    result.rotation[2] = baseSnapshot.rotation[2];
    result.rotation[3] = baseSnapshot.rotation[3];
    result.velocity[0] = baseSnapshot.velocity[0];
    result.velocity[1] = baseSnapshot.velocity[1];
    result.velocity[2] = baseSnapshot.velocity[2];
    result.state = baseSnapshot.state;
    
    // Apply deltas
    let offset = 0;
    const view = new DataView(packet.data.buffer, packet.data.byteOffset, packet.dataLength);
    
    // Position deltas
    for (let i = 0; i < 3; i++) {
      if (packet.fields & (DeltaFields.POSITION_X << i)) {
        result.position[i] += view.getInt16(offset, true) / this.quantizationScale;
        offset += 2;
      }
    }
    
    // Rotation absolutes
    for (let i = 0; i < 4; i++) {
      if (packet.fields & (DeltaFields.ROTATION_X << i)) {
        result.rotation[i] = view.getInt16(offset, true) / this.rotationScale;
        offset += 2;
      }
    }
    
    // Velocity absolutes
    for (let i = 0; i < 3; i++) {
      if (packet.fields & (DeltaFields.VELOCITY_X << (i + 7))) {
        result.velocity[i] = view.getInt16(offset, true) / this.quantizationScale;
        offset += 2;
      }
    }
    
    // State
    if (packet.fields & DeltaFields.STATE) {
      result.state = view.getUint8(offset);
    }
    
    result.sequence = packet.sequence;
    result.timestamp = performance.now();
    
    return result;
  }
  
  /**
   * Handle entity removal
   */
  private handleEntityRemoved(data: { id: string }): void {
    const state = this.states.get(data.id);
    if (state) {
      // No need to release snapshots - they're pre-allocated with the state
      this.states.delete(data.id);
    }
  }
  
  /**
   * Update interpolation for all entities
   */
  override lateUpdate(delta: number): void {
    if (this.world.isServer) return; // No interpolation on server
    
    const now = performance.now();
    const renderTime = now - this.interpolationDelay;
    
    for (const [entityId, state] of this.states) {
      // CRITICAL: Skip local player - handled by server-authoritative movement
      if (entityId === this.world.entities.player?.id) {
        // Remove from states to prevent future interpolation
        this.states.delete(entityId);
        continue;
      }
      
      const entity = this.world.entities.get(entityId);
      if (!entity) continue;
      
      this.updateEntityPosition(entity, state, renderTime, now, delta);
    }
  }
  
  /**
   * Update entity position with interpolation (no allocations)
   */
  private updateEntityPosition(
    entity: Entity,
    state: InterpolationState,
    renderTime: number,
    now: number,
    delta: number
  ): void {
    if (state.snapshotCount < 2) {
      if (state.snapshotCount === 1) {
        const snapshot = state.snapshots[0];
        this.applyPosition(entity, snapshot, state, delta);
      }
      return;
    }
    
    // Find two snapshots to interpolate between
    let older: EntitySnapshot | null = null;
    let newer: EntitySnapshot | null = null;
    
    for (let i = 0; i < state.snapshotCount - 1; i++) {
      const curr = state.snapshots[i];
      const next = state.snapshots[(i + 1) % this.maxSnapshots];
      
      if (curr.timestamp <= renderTime && next.timestamp >= renderTime) {
        older = curr;
        newer = next;
        break;
      }
    }
    
    if (older && newer) {
      // Interpolate between positions (reuse temp vectors)
      const t = (renderTime - older.timestamp) / (newer.timestamp - older.timestamp);
      
      // Use temp vectors to avoid allocation
      state.tempPosition.set(
        older.position[0] + (newer.position[0] - older.position[0]) * t,
        older.position[1] + (newer.position[1] - older.position[1]) * t,
        older.position[2] + (newer.position[2] - older.position[2]) * t
      );
      
      state.tempRotation.set(
        older.rotation[0] + (newer.rotation[0] - older.rotation[0]) * t,
        older.rotation[1] + (newer.rotation[1] - older.rotation[1]) * t,
        older.rotation[2] + (newer.rotation[2] - older.rotation[2]) * t,
        older.rotation[3] + (newer.rotation[3] - older.rotation[3]) * t
      ).normalize();
      
      this.applyInterpolated(entity, state.tempPosition, state.tempRotation, state, delta);
    } else {
      // Extrapolate
      this.extrapolatePosition(entity, state, renderTime, now, delta);
    }
  }
  
  /**
   * Extrapolate position (no allocations)
   */
  private extrapolatePosition(
    entity: Entity,
    state: InterpolationState,
    renderTime: number,
    now: number,
    delta: number
  ): void {
    if (state.snapshotCount === 0) return;
    
    // Get last snapshot
    const lastIndex = (state.snapshotIndex - 1 + this.maxSnapshots) % this.maxSnapshots;
    const last = state.snapshots[lastIndex];
    
    const timeSinceUpdate = now - state.lastUpdate;
    if (timeSinceUpdate > this.extrapolationLimit) {
      this.applyPosition(entity, last, state, delta);
      return;
    }
    
    // Calculate velocity for extrapolation
    if (state.snapshotCount >= 2) {
      const secondLastIndex = (state.snapshotIndex - 2 + this.maxSnapshots) % this.maxSnapshots;
      const secondLast = state.snapshots[secondLastIndex];
      
      const dt = (last.timestamp - secondLast.timestamp) / 1000;
      if (dt > 0) {
        // Calculate velocity (reuse _v3_1)
        _v3_1.set(
          (last.position[0] - secondLast.position[0]) / dt,
          (last.position[1] - secondLast.position[1]) / dt,
          (last.position[2] - secondLast.position[2]) / dt
        );
        
        // Extrapolate position (reuse state.tempPosition)
        const extrapolationTime = (renderTime - last.timestamp) / 1000;
        state.tempPosition.set(
          last.position[0] + _v3_1.x * extrapolationTime,
          last.position[1] + _v3_1.y * extrapolationTime,
          last.position[2] + _v3_1.z * extrapolationTime
        );
        
        // Use last rotation
        state.tempRotation.set(
          last.rotation[0],
          last.rotation[1],
          last.rotation[2],
          last.rotation[3]
        );
        
        // Apply with smoothing
        state.currentPosition.lerp(state.tempPosition, 0.2);
        state.currentRotation.slerp(state.tempRotation, 0.2);
        
        this.applyInterpolated(entity, state.currentPosition, state.currentRotation, state, delta);
      } else {
        this.applyPosition(entity, last, state, delta);
      }
    } else {
      this.applyPosition(entity, last, state, delta);
    }
  }
  
  /**
   * Apply snapshot position to entity
   */
  private applyPosition(
    entity: Entity,
    snapshot: EntitySnapshot,
    state: InterpolationState,
    delta: number
  ): void {
    // Copy to temp vectors
    state.tempPosition.set(snapshot.position[0], snapshot.position[1], snapshot.position[2]);
    state.tempRotation.set(snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2], snapshot.rotation[3]);
    this.applyInterpolated(entity, state.tempPosition, state.tempRotation, state, delta);
  }
  
  /**
   * Apply interpolated position to entity
   */
  private applyInterpolated(
    entity: Entity,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    state: InterpolationState,
    delta: number
  ): void {
    const smoothingRate = 5.0;
    const smoothingFactor = 1.0 - Math.exp(-smoothingRate * delta);
    
    // Update current interpolated values
    state.currentPosition.lerp(position, smoothingFactor);
    state.currentRotation.slerp(rotation, smoothingFactor);
    
    // Apply to entity
    if ('position' in entity) {
      const entityPos = entity.position as THREE.Vector3;
      entityPos.copy(state.currentPosition);
    }
    
    if (entity.node) {
      entity.node.position.copy(state.currentPosition);
      entity.node.quaternion.copy(state.currentRotation);
    }
    
    // Update base for player entities
    const player = entity as Entity & { base?: { position: THREE.Vector3; quaternion: THREE.Quaternion } };
    if (player.base) {
      player.base.position.copy(state.currentPosition);
      player.base.quaternion.copy(state.currentRotation);
    }
  }
  
  /**
   * Create interpolation state with pre-allocated buffers
   */
  private createInterpolationState(entityId: string): InterpolationState {
    const entity = this.world.entities.get(entityId);
    const position = entity && 'position' in entity ?
      (entity.position as THREE.Vector3).clone() :
      new THREE.Vector3();
    
    const rotation = entity?.node?.quaternion ?
      entity.node.quaternion.clone() :
      new THREE.Quaternion();
    
    // Pre-allocate all snapshots
    const snapshots: EntitySnapshot[] = [];
    for (let i = 0; i < this.maxSnapshots; i++) {
      snapshots.push({
        position: new Float32Array(3),
        rotation: new Float32Array(4),
        velocity: new Float32Array(3),
        state: 0,
        timestamp: 0,
        sequence: 0
      });
    }
    
    return {
      entityId,
      snapshots,
      snapshotIndex: 0,
      snapshotCount: 0,
      currentPosition: position,
      currentRotation: rotation,
      tempPosition: new THREE.Vector3(),
      tempRotation: new THREE.Quaternion(),
      lastUpdate: performance.now()
    };
  }
  
  /**
   * Intercept server packets for compression
   */
  private interceptServerPackets(): void {
    const network = this.world.network as NetworkSystem & {
      send: (name: string, data: unknown, ...args: unknown[]) => void
    }
    if (!network?.send) return;
    
    const originalSend = network.send.bind(network);
    
    network.send = (name: string, data: unknown, ...args: unknown[]) => {
      const entityData = data as {
        id?: string;
        changes?: {
          p?: number[];
          q?: number[];
          v?: number[];
          s?: number;
        };
      };
      
      if (name === 'entityModified' && entityData.changes?.p && entityData.id) {
        // Try to compress
        const compressed = this.compressEntityState(
          entityData.id,
          {
            position: _v3_1.set(
              entityData.changes.p[0],
              entityData.changes.p[1],
              entityData.changes.p[2]
            ),
            rotation: entityData.changes.q ?
              _q1.set(
                entityData.changes.q[0],
                entityData.changes.q[1],
                entityData.changes.q[2],
                entityData.changes.q[3]
              ) : _q1.identity(),
            velocity: entityData.changes.v ?
              _v3_2.set(
                entityData.changes.v[0],
                entityData.changes.v[1],
                entityData.changes.v[2]
              ) : _v3_2.set(0, 0, 0),
            state: entityData.changes.s || 0
          }
        );
        
        if (compressed) {
          // Send compressed packet
          originalSend('compressedUpdate', compressed, ...args);
          this.metrics.bytesCompressed += compressed.dataLength;
          this.metrics.bytesUncompressed += 33; // Full packet size
          return;
        }
      }
      
      // Send original
      originalSend(name, data, ...args);
    };
  }
  
  /**
   * Get system statistics
   */
  public getStats() {
    return {
      ...this.metrics,
      entitiesTracked: this.states.size,
      compressionRatio: this.metrics.bytesUncompressed / Math.max(1, this.metrics.bytesCompressed)
    };
  }
  
  /**
   * Clear entity state
   */
  public clearEntity(entityId: string): void {
    this.states.delete(entityId);
  }
  
  /**
   * Clear all states
   */
  public clearAll(): void {
    this.states.clear();
  }
}