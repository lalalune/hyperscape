/**
 * Networking Compute Context
 *
 * High-level GPU compute operations for server-side networking.
 * Accelerates interest management, spatial queries, and aggro calculations.
 */

import {
  RuntimeComputeContext,
  isWebGPUAvailable,
} from "./RuntimeComputeContext";
import {
  INTEREST_MANAGEMENT_PER_ENTITY_SHADER,
  SPATIAL_RANGE_QUERY_SHADER,
  BATCH_AGGRO_CHECK_SHADER,
  NEAREST_ENTITY_SHADER,
  PHYSICS_BROADPHASE_SHADER,
  BROADPHASE_WORKGROUP_SIZE_X,
  SOUND_OCCLUSION_SHADER,
  SPAWN_VALIDATION_SHADER,
  LOOT_DISTRIBUTION_SHADER,
} from "./shaders/networking.wgsl";

export const MAX_INTEREST_MANAGEMENT_ENTITIES = 65_535;

// ============================================================================
// TYPES
// ============================================================================

/** Entity position with broadcast threshold for interest management */
export interface GPUEntityInterest {
  x: number;
  z: number;
  distanceSqThreshold: number;
}

/** Player position for interest management */
export interface GPUPlayerPosition {
  x: number;
  z: number;
}

/** Spatial query point */
export interface GPUSpatialQuery {
  x: number;
  z: number;
  radiusSq: number;
  typeFilter: number; // -1 for all types
}

/** Candidate entity for spatial queries */
export interface GPUSpatialCandidate {
  x: number;
  z: number;
  entityIdx: number;
  typeId: number;
}

/** Spatial query result */
export interface GPUSpatialResult {
  distanceSq: number;
  candidateIdx: number;
}

/** Mob data for aggro checks */
export interface GPUMobData {
  x: number;
  z: number;
  aggroRangeSq: number;
  behavior: number; // 0=passive, 1=aggressive
}

/** Aggro check result */
export interface GPUAggroResult {
  targetPlayerIdx: number; // -1 if no target
  distanceSq: number;
}

/** AABB for physics broadphase */
export interface GPUAABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  entityIdx: number;
  layer: number;
}

/** Overlap pair from broadphase */
export interface GPUOverlapPair {
  a: number;
  b: number;
}

/** Sound source for occlusion */
export interface GPUSoundSource {
  x: number;
  y: number;
  z: number;
  volume: number;
  falloffStart: number;
  falloffEnd: number;
}

/** Listener position for sound */
export interface GPUListener {
  x: number;
  y: number;
  z: number;
}

/** Spawn candidate for validation */
export interface GPUSpawnCandidate {
  x: number;
  z: number;
  radius: number;
  minSeparation: number;
}

/** Occupied position for spawn validation */
export interface GPUOccupiedPosition {
  x: number;
  z: number;
  radius: number;
}

/** Spawn validation result */
export interface GPUSpawnResult {
  valid: boolean;
  nearestDist: number;
}

/** Loot drop for distribution */
export interface GPULootDrop {
  x: number;
  z: number;
  dropTime: number;
  ownerId: number; // -1 = public
}

/** Player for loot distribution */
export interface GPULootPlayer {
  x: number;
  z: number;
  playerIdx: number;
  canLoot: boolean;
}

/** Loot distribution result */
export interface GPULootResult {
  nearestPlayer: number; // -1 if none
  distance: number;
}

/** Networking compute configuration */
export interface NetworkingComputeConfig {
  /** Minimum entities × players to use GPU for interest filtering */
  minInterestPairsForGPU?: number;
  /** Minimum query × candidates to use GPU for spatial queries */
  minSpatialPairsForGPU?: number;
  /** Minimum mobs × players to use GPU for aggro checks */
  minAggroPairsForGPU?: number;
  /** Minimum AABB pairs for physics broadphase */
  minBroadphasePairsForGPU?: number;
  /** Minimum sounds × listeners for sound occlusion */
  minSoundPairsForGPU?: number;
  /** Minimum spawn candidates for validation */
  minSpawnCandidatesForGPU?: number;
  /** Minimum loot drops × players for distribution */
  minLootPairsForGPU?: number;
}

const DEFAULT_CONFIG: Required<NetworkingComputeConfig> = {
  minInterestPairsForGPU: 500, // 10 entities × 50 players
  minSpatialPairsForGPU: 1000, // 10 queries × 100 candidates
  minAggroPairsForGPU: 500, // 50 mobs × 10 players
  minBroadphasePairsForGPU: 1000, // 45 AABBs (n*(n-1)/2 pairs)
  minSoundPairsForGPU: 200, // 10 sounds × 20 listeners
  minSpawnCandidatesForGPU: 50, // 50 spawn positions
  minLootPairsForGPU: 100, // 10 drops × 10 players
};

// ============================================================================
// NETWORKING COMPUTE CONTEXT
// ============================================================================

/**
 * GPU compute context specialized for networking operations.
 *
 * Provides high-level methods for:
 * - Interest management (which players should receive entity updates)
 * - Spatial range queries (entities within radius)
 * - Batch aggro checks (mob targeting)
 * - Nearest entity searches
 */
export class NetworkingComputeContext {
  private ctx: RuntimeComputeContext;
  private config: Required<NetworkingComputeConfig>;
  private initialized = false;

  // Pipeline references
  private interestPipeline: GPUComputePipeline | null = null;
  private spatialQueryPipeline: GPUComputePipeline | null = null;
  private aggroCheckPipeline: GPUComputePipeline | null = null;
  private nearestEntityPipeline: GPUComputePipeline | null = null;
  private broadphasePipeline: GPUComputePipeline | null = null;
  private soundOcclusionPipeline: GPUComputePipeline | null = null;
  private spawnValidationPipeline: GPUComputePipeline | null = null;
  private lootDistributionPipeline: GPUComputePipeline | null = null;

  constructor(config: NetworkingComputeConfig = {}) {
    this.ctx = new RuntimeComputeContext();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize with standalone WebGPU device (server-side).
   */
  async initializeStandalone(): Promise<boolean> {
    if (!(await this.ctx.initializeStandalone())) {
      return false;
    }
    return this.createPipelines();
  }

  /**
   * Initialize from Three.js WebGPURenderer (client-side testing).
   */
  initializeFromRenderer(renderer: {
    backend?: { device?: GPUDevice };
  }): boolean {
    if (
      !this.ctx.initializeFromRenderer(
        renderer as Parameters<typeof this.ctx.initializeFromRenderer>[0],
      )
    ) {
      return false;
    }
    return this.createPipelines();
  }

  private createPipelines(): boolean {
    this.interestPipeline = this.ctx.createPipeline({
      label: "InterestManagement",
      code: INTEREST_MANAGEMENT_PER_ENTITY_SHADER,
      entryPoint: "main",
    });

    this.spatialQueryPipeline = this.ctx.createPipeline({
      label: "SpatialRangeQuery",
      code: SPATIAL_RANGE_QUERY_SHADER,
      entryPoint: "main",
    });

    this.aggroCheckPipeline = this.ctx.createPipeline({
      label: "BatchAggroCheck",
      code: BATCH_AGGRO_CHECK_SHADER,
      entryPoint: "main",
    });

    this.nearestEntityPipeline = this.ctx.createPipeline({
      label: "NearestEntity",
      code: NEAREST_ENTITY_SHADER,
      entryPoint: "main",
    });

    this.broadphasePipeline = this.ctx.createPipeline({
      label: "PhysicsBroadphase",
      code: PHYSICS_BROADPHASE_SHADER,
      entryPoint: "main",
    });

    this.soundOcclusionPipeline = this.ctx.createPipeline({
      label: "SoundOcclusion",
      code: SOUND_OCCLUSION_SHADER,
      entryPoint: "main",
    });

    this.spawnValidationPipeline = this.ctx.createPipeline({
      label: "SpawnValidation",
      code: SPAWN_VALIDATION_SHADER,
      entryPoint: "main",
    });

    this.lootDistributionPipeline = this.ctx.createPipeline({
      label: "LootDistribution",
      code: LOOT_DISTRIBUTION_SHADER,
      entryPoint: "main",
    });

    this.initialized =
      this.interestPipeline !== null &&
      this.spatialQueryPipeline !== null &&
      this.aggroCheckPipeline !== null &&
      this.nearestEntityPipeline !== null &&
      this.broadphasePipeline !== null &&
      this.soundOcclusionPipeline !== null &&
      this.spawnValidationPipeline !== null &&
      this.lootDistributionPipeline !== null;

    return this.initialized;
  }

  // ==========================================================================
  // INTEREST MANAGEMENT
  // ==========================================================================

  /**
   * Check if GPU should be used for interest filtering.
   */
  shouldUseGPUForInterestFiltering(
    entityCount: number,
    playerCount: number,
  ): boolean {
    return (
      this.initialized &&
      entityCount * playerCount >= this.config.minInterestPairsForGPU
    );
  }

  /**
   * Compute which players should receive updates for each entity.
   *
   * @param entities - Array of entity positions with broadcast thresholds
   * @param players - Array of player positions
   * @returns Map of entity index -> array of interested player indices
   */
  async computeInterestedPlayers(
    entities: GPUEntityInterest[],
    players: GPUPlayerPosition[],
  ): Promise<Map<number, number[]>> {
    if (!this.initialized || !this.interestPipeline) {
      throw new Error("NetworkingComputeContext not initialized");
    }

    const entityCount = entities.length;
    const playerCount = players.length;
    const u32PerEntity = Math.ceil(playerCount / 32);
    if (entityCount > MAX_INTEREST_MANAGEMENT_ENTITIES) {
      throw new Error(
        `Interest management supports at most ${MAX_INTEREST_MANAGEMENT_ENTITIES} entities per dispatch; received ${entityCount}`,
      );
    }

    // Pack entity data (4 floats per entity)
    const entityData = new Float32Array(entityCount * 4);
    for (let i = 0; i < entityCount; i++) {
      const e = entities[i];
      entityData[i * 4 + 0] = e.x;
      entityData[i * 4 + 1] = e.z;
      entityData[i * 4 + 2] = e.distanceSqThreshold;
      entityData[i * 4 + 3] = 0; // padding
    }

    // Pack player data (4 floats per player)
    const playerData = new Float32Array(playerCount * 4);
    for (let i = 0; i < playerCount; i++) {
      const p = players[i];
      playerData[i * 4 + 0] = p.x;
      playerData[i * 4 + 1] = p.z;
      playerData[i * 4 + 2] = 0; // padding
      playerData[i * 4 + 3] = 0; // padding
    }

    // Create buffers
    const entityBuffer = this.ctx.createStorageBuffer(
      "im_entities",
      entityData,
    );
    const playerBuffer = this.ctx.createStorageBuffer("im_players", playerData);
    const interestBuffer = this.ctx.createEmptyStorageBuffer(
      "im_interests",
      entityCount * u32PerEntity * 4,
    );
    const uniformBuffer = this.ctx.createUniformBuffer(
      "im_uniforms",
      new Uint32Array([entityCount, playerCount, u32PerEntity, 0]),
    );

    if (!entityBuffer || !playerBuffer || !interestBuffer || !uniformBuffer) {
      throw new Error("Failed to create GPU buffers");
    }

    // Create bind group
    const bindGroup = this.ctx.createBindGroup(this.interestPipeline, [
      { binding: 0, resource: { buffer: entityBuffer } },
      { binding: 1, resource: { buffer: playerBuffer } },
      { binding: 2, resource: { buffer: interestBuffer } },
      { binding: 3, resource: { buffer: uniformBuffer } },
    ]);

    if (!bindGroup) {
      throw new Error("Failed to create bind group");
    }

    // Dispatch (one workgroup per entity)
    await this.ctx.dispatchAndWait({
      pipeline: this.interestPipeline,
      bindGroup,
      workgroupCount: entityCount,
    });

    // Read back results
    const interestBits = await this.ctx.readUint32Buffer(
      interestBuffer,
      entityCount * u32PerEntity,
    );

    // Cleanup
    this.ctx.destroyBuffer("im_entities");
    this.ctx.destroyBuffer("im_players");
    this.ctx.destroyBuffer("im_interests");
    this.ctx.destroyBuffer("im_uniforms");

    // Convert bit masks to player indices
    const result = new Map<number, number[]>();
    for (let entityIdx = 0; entityIdx < entityCount; entityIdx++) {
      const interestedPlayers: number[] = [];
      const baseIdx = entityIdx * u32PerEntity;

      for (let u32Idx = 0; u32Idx < u32PerEntity; u32Idx++) {
        const bits = interestBits[baseIdx + u32Idx];
        if (bits === 0) continue;

        for (let bit = 0; bit < 32; bit++) {
          if (bits & (1 << bit)) {
            const playerIdx = u32Idx * 32 + bit;
            if (playerIdx < playerCount) {
              interestedPlayers.push(playerIdx);
            }
          }
        }
      }

      if (interestedPlayers.length > 0) {
        result.set(entityIdx, interestedPlayers);
      }
    }

    return result;
  }

  // ==========================================================================
  // BATCH AGGRO CHECKS
  // ==========================================================================

  /**
   * Check if GPU should be used for aggro checks.
   */
  shouldUseGPUForAggroChecks(mobCount: number, playerCount: number): boolean {
    return (
      this.initialized &&
      mobCount * playerCount >= this.config.minAggroPairsForGPU
    );
  }

  /**
   * Compute best aggro target for each mob.
   *
   * @param mobs - Array of mob positions and aggro ranges
   * @param players - Array of player positions
   * @returns Array of aggro results (target index and distance) per mob
   */
  async computeAggroTargets(
    mobs: GPUMobData[],
    players: GPUPlayerPosition[],
  ): Promise<GPUAggroResult[]> {
    if (!this.initialized || !this.aggroCheckPipeline) {
      throw new Error("NetworkingComputeContext not initialized");
    }

    const mobCount = mobs.length;
    const playerCount = players.length;

    // Pack mob data (4 floats per mob)
    const mobData = new Float32Array(mobCount * 4);
    for (let i = 0; i < mobCount; i++) {
      const m = mobs[i];
      mobData[i * 4 + 0] = m.x;
      mobData[i * 4 + 1] = m.z;
      mobData[i * 4 + 2] = m.aggroRangeSq;
      mobData[i * 4 + 3] = m.behavior;
    }

    // Pack player data (4 floats per player)
    const playerData = new Float32Array(playerCount * 4);
    for (let i = 0; i < playerCount; i++) {
      const p = players[i];
      playerData[i * 4 + 0] = p.x;
      playerData[i * 4 + 1] = p.z;
      playerData[i * 4 + 2] = 0;
      playerData[i * 4 + 3] = 0;
    }

    // Create buffers
    const mobBuffer = this.ctx.createStorageBuffer("ac_mobs", mobData);
    const playerBuffer = this.ctx.createStorageBuffer("ac_players", playerData);
    const targetBuffer = this.ctx.createEmptyStorageBuffer(
      "ac_targets",
      mobCount * 4,
    );
    const distanceBuffer = this.ctx.createEmptyStorageBuffer(
      "ac_distances",
      mobCount * 4,
    );
    const uniformBuffer = this.ctx.createUniformBuffer(
      "ac_uniforms",
      new Uint32Array([mobCount, playerCount, 0, 0]),
    );

    if (
      !mobBuffer ||
      !playerBuffer ||
      !targetBuffer ||
      !distanceBuffer ||
      !uniformBuffer
    ) {
      throw new Error("Failed to create GPU buffers");
    }

    // Create bind group
    const bindGroup = this.ctx.createBindGroup(this.aggroCheckPipeline, [
      { binding: 0, resource: { buffer: mobBuffer } },
      { binding: 1, resource: { buffer: playerBuffer } },
      { binding: 2, resource: { buffer: targetBuffer } },
      { binding: 3, resource: { buffer: distanceBuffer } },
      { binding: 4, resource: { buffer: uniformBuffer } },
    ]);

    if (!bindGroup) {
      throw new Error("Failed to create bind group");
    }

    // Dispatch
    await this.ctx.dispatchAndWait({
      pipeline: this.aggroCheckPipeline,
      bindGroup,
      workgroupCount: this.ctx.calculateWorkgroupCount(mobCount, 64),
    });

    // Read back results
    const targets = await this.ctx.readUint32Buffer(targetBuffer, mobCount);
    const distances = await this.ctx.readFloat32Buffer(
      distanceBuffer,
      mobCount,
    );

    // Cleanup
    this.ctx.destroyBuffer("ac_mobs");
    this.ctx.destroyBuffer("ac_players");
    this.ctx.destroyBuffer("ac_targets");
    this.ctx.destroyBuffer("ac_distances");
    this.ctx.destroyBuffer("ac_uniforms");

    // Convert to results
    const results: GPUAggroResult[] = [];
    for (let i = 0; i < mobCount; i++) {
      results.push({
        targetPlayerIdx: targets[i] === 0xffffffff ? -1 : targets[i],
        distanceSq: distances[i],
      });
    }

    return results;
  }

  // ==========================================================================
  // NEAREST ENTITY SEARCH
  // ==========================================================================

  /**
   * Find nearest entity for each query point.
   *
   * @param queries - Array of query points with max range and type filter
   * @param entities - Array of entity positions with type IDs
   * @returns Array of [entityIdx, distanceSq] per query (-1 if none found)
   */
  async findNearestEntities(
    queries: GPUSpatialQuery[],
    entities: GPUSpatialCandidate[],
  ): Promise<Array<{ entityIdx: number; distanceSq: number }>> {
    if (!this.initialized || !this.nearestEntityPipeline) {
      throw new Error("NetworkingComputeContext not initialized");
    }

    const queryCount = queries.length;
    const entityCount = entities.length;

    // Pack query data
    const queryData = new Float32Array(queryCount * 4);
    for (let i = 0; i < queryCount; i++) {
      const q = queries[i];
      queryData[i * 4 + 0] = q.x;
      queryData[i * 4 + 1] = q.z;
      queryData[i * 4 + 2] = q.radiusSq;
      // Store typeFilter as float (will be cast to int in shader)
      queryData[i * 4 + 3] = q.typeFilter;
    }

    // Pack entity data
    const entityData = new Float32Array(entityCount * 4);
    for (let i = 0; i < entityCount; i++) {
      const e = entities[i];
      entityData[i * 4 + 0] = e.x;
      entityData[i * 4 + 1] = e.z;
      // Pack indices as floats (for simplicity, will be cast in shader)
      const view = new DataView(entityData.buffer);
      view.setUint32((i * 4 + 2) * 4, e.entityIdx, true);
      view.setUint32((i * 4 + 3) * 4, e.typeId, true);
    }

    // Create buffers
    const queryBuffer = this.ctx.createStorageBuffer("ne_queries", queryData);
    const entityBuffer = this.ctx.createStorageBuffer(
      "ne_entities",
      entityData,
    );
    const nearestIdBuffer = this.ctx.createEmptyStorageBuffer(
      "ne_ids",
      queryCount * 4,
    );
    const nearestDistBuffer = this.ctx.createEmptyStorageBuffer(
      "ne_dists",
      queryCount * 4,
    );
    const uniformBuffer = this.ctx.createUniformBuffer(
      "ne_uniforms",
      new Uint32Array([queryCount, entityCount, 0, 0]),
    );

    if (
      !queryBuffer ||
      !entityBuffer ||
      !nearestIdBuffer ||
      !nearestDistBuffer ||
      !uniformBuffer
    ) {
      throw new Error("Failed to create GPU buffers");
    }

    // Create bind group
    const bindGroup = this.ctx.createBindGroup(this.nearestEntityPipeline, [
      { binding: 0, resource: { buffer: queryBuffer } },
      { binding: 1, resource: { buffer: entityBuffer } },
      { binding: 2, resource: { buffer: nearestIdBuffer } },
      { binding: 3, resource: { buffer: nearestDistBuffer } },
      { binding: 4, resource: { buffer: uniformBuffer } },
    ]);

    if (!bindGroup) {
      throw new Error("Failed to create bind group");
    }

    // Dispatch
    await this.ctx.dispatchAndWait({
      pipeline: this.nearestEntityPipeline,
      bindGroup,
      workgroupCount: this.ctx.calculateWorkgroupCount(queryCount, 64),
    });

    // Read back results
    const ids = await this.ctx.readUint32Buffer(nearestIdBuffer, queryCount);
    const dists = await this.ctx.readFloat32Buffer(
      nearestDistBuffer,
      queryCount,
    );

    // Cleanup
    this.ctx.destroyBuffer("ne_queries");
    this.ctx.destroyBuffer("ne_entities");
    this.ctx.destroyBuffer("ne_ids");
    this.ctx.destroyBuffer("ne_dists");
    this.ctx.destroyBuffer("ne_uniforms");

    // Convert to results
    const results: Array<{ entityIdx: number; distanceSq: number }> = [];
    for (let i = 0; i < queryCount; i++) {
      results.push({
        entityIdx: ids[i] === 0xffffffff ? -1 : ids[i],
        distanceSq: dists[i],
      });
    }

    return results;
  }

  // ==========================================================================
  // PHYSICS BROADPHASE
  // ==========================================================================

  /**
   * Check if GPU should be used for physics broadphase.
   */
  shouldUseGPUForBroadphase(aabbCount: number): boolean {
    const pairs = (aabbCount * (aabbCount - 1)) / 2;
    return this.initialized && pairs >= this.config.minBroadphasePairsForGPU;
  }

  /**
   * Compute AABB overlaps for physics broadphase.
   * Returns pairs of overlapping AABB indices.
   */
  async computeBroadphaseOverlaps(
    aabbs: GPUAABB[],
    layerMask: number = 0xffffffff,
    maxOverlaps: number = 10000,
  ): Promise<GPUOverlapPair[]> {
    if (!this.initialized || !this.broadphasePipeline) {
      throw new Error("NetworkingComputeContext not initialized");
    }

    const aabbCount = aabbs.length;
    if (aabbCount < 2) return [];

    // Pack AABB data: 8 floats per AABB
    const aabbData = new Float32Array(aabbCount * 8);
    for (let i = 0; i < aabbCount; i++) {
      const a = aabbs[i];
      const offset = i * 8;
      aabbData[offset] = a.minX;
      aabbData[offset + 1] = a.minY;
      aabbData[offset + 2] = a.minZ;
      aabbData[offset + 3] = a.maxX;
      aabbData[offset + 4] = a.maxY;
      aabbData[offset + 5] = a.maxZ;
      // Pack u32 into f32 view
      const u32View = new Uint32Array(aabbData.buffer, (offset + 6) * 4, 2);
      u32View[0] = a.entityIdx;
      u32View[1] = a.layer;
    }

    // Create buffers
    const aabbBuffer = this.ctx.createStorageBuffer("bp_aabbs", aabbData);
    const overlapBuffer = this.ctx.createEmptyStorageBuffer(
      "bp_overlaps",
      maxOverlaps * 8,
    );
    const countBuffer = this.ctx.createStorageBuffer(
      "bp_count",
      new Uint32Array([0]),
    );
    // Dispatch shape: one GPU thread per pair, workgroup size 64.
    // The pair count is O(N²), so for aabbCount ≳ 5793 the 1D dispatch
    // exceeds WebGPU's per-dimension ceiling of 65535 workgroups. We
    // reshape to a 2D dispatch (x × y × 1) in that case and pass
    // numWorkgroupsX in the uniform buffer so the shader can
    // reconstruct the linear thread index via
    //   threadIdx = global_id.y * (numWorkgroupsX * WORKGROUP_SIZE_1D)
    //             + global_id.x
    // For the 1D case we still pass numWorkgroupsX = totalWorkgroups,
    // y=1, and the shader arithmetic degenerates correctly. Workgroup
    // size is imported from the shader module so the host-side divisor
    // can't drift from @workgroup_size.
    const totalPairs = (aabbCount * (aabbCount - 1)) / 2;
    const totalWorkgroups = Math.ceil(totalPairs / BROADPHASE_WORKGROUP_SIZE_X);
    const WEBGPU_MAX_WORKGROUPS_PER_DIM = 65535;
    const dispatchX = Math.min(totalWorkgroups, WEBGPU_MAX_WORKGROUPS_PER_DIM);
    const dispatchY = Math.ceil(totalWorkgroups / dispatchX);
    if (dispatchY > WEBGPU_MAX_WORKGROUPS_PER_DIM) {
      throw new Error(
        `Broadphase dispatch exceeds WebGPU 2D workgroup limits: totalWorkgroups=${totalWorkgroups}, dispatch=${dispatchX}x${dispatchY}`,
      );
    }

    const uniformBuffer = this.ctx.createUniformBuffer(
      "bp_uniforms",
      new Uint32Array([aabbCount, layerMask, maxOverlaps, dispatchX]),
    );

    if (!aabbBuffer || !overlapBuffer || !countBuffer || !uniformBuffer) {
      throw new Error("Failed to create broadphase buffers");
    }

    // Create bind group
    const bindGroup = this.ctx.createBindGroup(this.broadphasePipeline, [
      { binding: 0, resource: { buffer: aabbBuffer } },
      { binding: 1, resource: { buffer: overlapBuffer } },
      { binding: 2, resource: { buffer: countBuffer } },
      { binding: 3, resource: { buffer: uniformBuffer } },
    ]);

    if (!bindGroup) {
      throw new Error("Failed to create broadphase bind group");
    }

    await this.ctx.dispatchAndWait({
      pipeline: this.broadphasePipeline,
      bindGroup,
      workgroupCount: [dispatchX, dispatchY, 1],
    });

    // Read back results
    const countResult = await this.ctx.readUint32Buffer(countBuffer, 1);
    const overlapCount = Math.min(countResult[0], maxOverlaps);

    const overlaps: GPUOverlapPair[] = [];
    if (overlapCount > 0) {
      const overlapData = await this.ctx.readUint32Buffer(
        overlapBuffer,
        overlapCount * 2,
      );
      for (let i = 0; i < overlapCount; i++) {
        overlaps.push({
          a: overlapData[i * 2],
          b: overlapData[i * 2 + 1],
        });
      }
    }

    // Cleanup
    this.ctx.destroyBuffer("bp_aabbs");
    this.ctx.destroyBuffer("bp_overlaps");
    this.ctx.destroyBuffer("bp_count");
    this.ctx.destroyBuffer("bp_uniforms");

    return overlaps;
  }

  // ==========================================================================
  // SOUND OCCLUSION
  // ==========================================================================

  /**
   * Check if GPU should be used for sound occlusion.
   */
  shouldUseGPUForSoundOcclusion(
    soundCount: number,
    listenerCount: number,
  ): boolean {
    return (
      this.initialized &&
      soundCount * listenerCount >= this.config.minSoundPairsForGPU
    );
  }

  /**
   * Compute effective volumes for all sound-listener pairs.
   * Returns a 2D array [soundIdx][listenerIdx] of volumes.
   */
  async computeSoundVolumes(
    sounds: GPUSoundSource[],
    listeners: GPUListener[],
  ): Promise<number[][]> {
    if (!this.initialized || !this.soundOcclusionPipeline) {
      throw new Error("NetworkingComputeContext not initialized");
    }

    const soundCount = sounds.length;
    const listenerCount = listeners.length;
    if (soundCount === 0 || listenerCount === 0) return [];

    // Pack sound data: 8 floats per sound
    const soundData = new Float32Array(soundCount * 8);
    for (let i = 0; i < soundCount; i++) {
      const s = sounds[i];
      const offset = i * 8;
      soundData[offset] = s.x;
      soundData[offset + 1] = s.y;
      soundData[offset + 2] = s.z;
      soundData[offset + 3] = s.volume;
      soundData[offset + 4] = s.falloffStart;
      soundData[offset + 5] = s.falloffEnd;
      soundData[offset + 6] = 0; // padding
      soundData[offset + 7] = 0; // padding
    }

    // Pack listener data: 4 floats per listener
    const listenerData = new Float32Array(listenerCount * 4);
    for (let i = 0; i < listenerCount; i++) {
      const l = listeners[i];
      const offset = i * 4;
      listenerData[offset] = l.x;
      listenerData[offset + 1] = l.y;
      listenerData[offset + 2] = l.z;
      listenerData[offset + 3] = 0; // padding
    }

    // Create buffers
    const soundBuffer = this.ctx.createStorageBuffer("so_sounds", soundData);
    const listenerBuffer = this.ctx.createStorageBuffer(
      "so_listeners",
      listenerData,
    );
    const volumeBuffer = this.ctx.createEmptyStorageBuffer(
      "so_volumes",
      soundCount * listenerCount * 4,
    );
    const uniformBuffer = this.ctx.createUniformBuffer(
      "so_uniforms",
      new Uint32Array([soundCount, listenerCount, 0, 0]),
    );

    if (!soundBuffer || !listenerBuffer || !volumeBuffer || !uniformBuffer) {
      throw new Error("Failed to create sound occlusion buffers");
    }

    // Create bind group
    const bindGroup = this.ctx.createBindGroup(this.soundOcclusionPipeline, [
      { binding: 0, resource: { buffer: soundBuffer } },
      { binding: 1, resource: { buffer: listenerBuffer } },
      { binding: 2, resource: { buffer: volumeBuffer } },
      { binding: 3, resource: { buffer: uniformBuffer } },
    ]);

    if (!bindGroup) {
      throw new Error("Failed to create sound occlusion bind group");
    }

    // Dispatch
    const totalPairs = soundCount * listenerCount;
    await this.ctx.dispatchAndWait({
      pipeline: this.soundOcclusionPipeline,
      bindGroup,
      workgroupCount: this.ctx.calculateWorkgroupCount(totalPairs, 64),
    });

    // Read back results
    const volumeData = await this.ctx.readFloat32Buffer(
      volumeBuffer,
      soundCount * listenerCount,
    );

    // Convert to 2D array
    const results: number[][] = [];
    for (let si = 0; si < soundCount; si++) {
      const row: number[] = [];
      for (let li = 0; li < listenerCount; li++) {
        row.push(volumeData[si * listenerCount + li]);
      }
      results.push(row);
    }

    // Cleanup
    this.ctx.destroyBuffer("so_sounds");
    this.ctx.destroyBuffer("so_listeners");
    this.ctx.destroyBuffer("so_volumes");
    this.ctx.destroyBuffer("so_uniforms");

    return results;
  }

  // ==========================================================================
  // SPAWN VALIDATION
  // ==========================================================================

  /**
   * Check if GPU should be used for spawn validation.
   */
  shouldUseGPUForSpawnValidation(candidateCount: number): boolean {
    return (
      this.initialized && candidateCount >= this.config.minSpawnCandidatesForGPU
    );
  }

  /**
   * Validate spawn positions against occupied areas.
   */
  async validateSpawnPositions(
    candidates: GPUSpawnCandidate[],
    occupied: GPUOccupiedPosition[],
  ): Promise<GPUSpawnResult[]> {
    if (!this.initialized || !this.spawnValidationPipeline) {
      throw new Error("NetworkingComputeContext not initialized");
    }

    const candidateCount = candidates.length;
    const occupiedCount = occupied.length;
    if (candidateCount === 0) return [];

    // Pack candidate data: 4 floats per candidate
    const candidateData = new Float32Array(candidateCount * 4);
    for (let i = 0; i < candidateCount; i++) {
      const c = candidates[i];
      const offset = i * 4;
      candidateData[offset] = c.x;
      candidateData[offset + 1] = c.z;
      candidateData[offset + 2] = c.radius;
      candidateData[offset + 3] = c.minSeparation;
    }

    // Pack occupied data: 4 floats per position
    const occupiedData = new Float32Array(Math.max(occupiedCount, 1) * 4);
    for (let i = 0; i < occupiedCount; i++) {
      const o = occupied[i];
      const offset = i * 4;
      occupiedData[offset] = o.x;
      occupiedData[offset + 1] = o.z;
      occupiedData[offset + 2] = o.radius;
      occupiedData[offset + 3] = 0; // padding
    }

    // Create buffers
    const candidateBuffer = this.ctx.createStorageBuffer(
      "sv_candidates",
      candidateData,
    );
    const occupiedBuffer = this.ctx.createStorageBuffer(
      "sv_occupied",
      occupiedData,
    );
    const validBuffer = this.ctx.createEmptyStorageBuffer(
      "sv_valid",
      candidateCount * 4,
    );
    const distBuffer = this.ctx.createEmptyStorageBuffer(
      "sv_dist",
      candidateCount * 4,
    );
    const uniformBuffer = this.ctx.createUniformBuffer(
      "sv_uniforms",
      new Uint32Array([candidateCount, occupiedCount, 0, 0]),
    );

    if (
      !candidateBuffer ||
      !occupiedBuffer ||
      !validBuffer ||
      !distBuffer ||
      !uniformBuffer
    ) {
      throw new Error("Failed to create spawn validation buffers");
    }

    // Create bind group
    const bindGroup = this.ctx.createBindGroup(this.spawnValidationPipeline, [
      { binding: 0, resource: { buffer: candidateBuffer } },
      { binding: 1, resource: { buffer: occupiedBuffer } },
      { binding: 2, resource: { buffer: validBuffer } },
      { binding: 3, resource: { buffer: distBuffer } },
      { binding: 4, resource: { buffer: uniformBuffer } },
    ]);

    if (!bindGroup) {
      throw new Error("Failed to create spawn validation bind group");
    }

    // Dispatch
    await this.ctx.dispatchAndWait({
      pipeline: this.spawnValidationPipeline,
      bindGroup,
      workgroupCount: this.ctx.calculateWorkgroupCount(candidateCount, 64),
    });

    // Read back results
    const validData = await this.ctx.readUint32Buffer(
      validBuffer,
      candidateCount,
    );
    const distData = await this.ctx.readFloat32Buffer(
      distBuffer,
      candidateCount,
    );

    const results: GPUSpawnResult[] = [];
    for (let i = 0; i < candidateCount; i++) {
      results.push({
        valid: validData[i] === 1,
        nearestDist: distData[i],
      });
    }

    // Cleanup
    this.ctx.destroyBuffer("sv_candidates");
    this.ctx.destroyBuffer("sv_occupied");
    this.ctx.destroyBuffer("sv_valid");
    this.ctx.destroyBuffer("sv_dist");
    this.ctx.destroyBuffer("sv_uniforms");

    return results;
  }

  // ==========================================================================
  // LOOT DISTRIBUTION
  // ==========================================================================

  /**
   * Check if GPU should be used for loot distribution.
   */
  shouldUseGPUForLootDistribution(
    dropCount: number,
    playerCount: number,
  ): boolean {
    return (
      this.initialized &&
      dropCount * playerCount >= this.config.minLootPairsForGPU
    );
  }

  /**
   * Find nearest eligible player for each loot drop.
   */
  async computeLootDistribution(
    drops: GPULootDrop[],
    players: GPULootPlayer[],
    maxLootDistance: number,
    ownerExclusiveTime: number = 60.0,
  ): Promise<GPULootResult[]> {
    if (!this.initialized || !this.lootDistributionPipeline) {
      throw new Error("NetworkingComputeContext not initialized");
    }

    const dropCount = drops.length;
    const playerCount = players.length;
    if (dropCount === 0) return [];

    // Pack drop data: 4 floats per drop
    const dropData = new Float32Array(dropCount * 4);
    for (let i = 0; i < dropCount; i++) {
      const d = drops[i];
      const offset = i * 4;
      dropData[offset] = d.x;
      dropData[offset + 1] = d.z;
      dropData[offset + 2] = d.dropTime;
      // Pack i32 into f32 view
      const i32View = new Int32Array(dropData.buffer, (offset + 3) * 4, 1);
      i32View[0] = d.ownerId;
    }

    // Pack player data: 4 values per player
    const playerData = new Float32Array(Math.max(playerCount, 1) * 4);
    for (let i = 0; i < playerCount; i++) {
      const p = players[i];
      const offset = i * 4;
      playerData[offset] = p.x;
      playerData[offset + 1] = p.z;
      // Pack u32 into f32 view
      const u32View = new Uint32Array(playerData.buffer, (offset + 2) * 4, 2);
      u32View[0] = p.playerIdx;
      u32View[1] = p.canLoot ? 1 : 0;
    }

    // Create buffers
    const dropBuffer = this.ctx.createStorageBuffer("ld_drops", dropData);
    const playerBuffer = this.ctx.createStorageBuffer("ld_players", playerData);
    const nearestBuffer = this.ctx.createEmptyStorageBuffer(
      "ld_nearest",
      dropCount * 4,
    );
    const distBuffer = this.ctx.createEmptyStorageBuffer(
      "ld_dist",
      dropCount * 4,
    );

    // Pack uniforms: dropCount, playerCount, maxLootDistance, ownerExclusiveTime
    // Create a Float32Array and reinterpret first two as u32
    const uniformArray = new Float32Array(4);
    const uniformU32 = new Uint32Array(uniformArray.buffer);
    uniformU32[0] = dropCount;
    uniformU32[1] = playerCount;
    uniformArray[2] = maxLootDistance;
    uniformArray[3] = ownerExclusiveTime;

    const uniformBuffer = this.ctx.createUniformBuffer(
      "ld_uniforms",
      uniformArray,
    );

    if (
      !dropBuffer ||
      !playerBuffer ||
      !nearestBuffer ||
      !distBuffer ||
      !uniformBuffer
    ) {
      throw new Error("Failed to create loot distribution buffers");
    }

    // Create bind group
    const bindGroup = this.ctx.createBindGroup(this.lootDistributionPipeline, [
      { binding: 0, resource: { buffer: dropBuffer } },
      { binding: 1, resource: { buffer: playerBuffer } },
      { binding: 2, resource: { buffer: nearestBuffer } },
      { binding: 3, resource: { buffer: distBuffer } },
      { binding: 4, resource: { buffer: uniformBuffer } },
    ]);

    if (!bindGroup) {
      throw new Error("Failed to create loot distribution bind group");
    }

    // Dispatch
    await this.ctx.dispatchAndWait({
      pipeline: this.lootDistributionPipeline,
      bindGroup,
      workgroupCount: this.ctx.calculateWorkgroupCount(dropCount, 64),
    });

    // Read back results
    const nearestData = await this.ctx.readUint32Buffer(
      nearestBuffer,
      dropCount,
    );
    const distData = await this.ctx.readFloat32Buffer(distBuffer, dropCount);

    const results: GPULootResult[] = [];
    for (let i = 0; i < dropCount; i++) {
      results.push({
        nearestPlayer: nearestData[i] === 0xffffffff ? -1 : nearestData[i],
        distance: distData[i],
      });
    }

    // Cleanup
    this.ctx.destroyBuffer("ld_drops");
    this.ctx.destroyBuffer("ld_players");
    this.ctx.destroyBuffer("ld_nearest");
    this.ctx.destroyBuffer("ld_dist");
    this.ctx.destroyBuffer("ld_uniforms");

    return results;
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  /**
   * Check if the context is ready for use.
   */
  isReady(): boolean {
    return this.initialized && this.ctx.isReady();
  }

  /**
   * Get the underlying RuntimeComputeContext.
   */
  getRuntimeContext(): RuntimeComputeContext {
    return this.ctx;
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.ctx.destroy();
    this.interestPipeline = null;
    this.spatialQueryPipeline = null;
    this.aggroCheckPipeline = null;
    this.nearestEntityPipeline = null;
    this.broadphasePipeline = null;
    this.soundOcclusionPipeline = null;
    this.spawnValidationPipeline = null;
    this.lootDistributionPipeline = null;
    this.initialized = false;
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let globalNetworkingContext: NetworkingComputeContext | null = null;

/**
 * Get or create the global NetworkingComputeContext.
 */
export function getGlobalNetworkingComputeContext(): NetworkingComputeContext {
  if (!globalNetworkingContext) {
    globalNetworkingContext = new NetworkingComputeContext();
  }
  return globalNetworkingContext;
}

/**
 * Check if GPU networking compute is available.
 */
export function isNetworkingComputeAvailable(): boolean {
  return isWebGPUAvailable();
}
