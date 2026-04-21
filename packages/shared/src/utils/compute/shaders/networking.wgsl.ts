/**
 * Networking Compute Shaders
 *
 * WGSL compute shaders for server-side networking operations:
 * - Interest management (which players should receive entity updates)
 * - Spatial range queries (entities within radius)
 * - Batch aggro checks (mob targeting)
 */

// ============================================================================
// INTEREST MANAGEMENT SHADER
// ============================================================================

/**
 * Batch interest filtering - determines which players should receive entity updates.
 *
 * Input:
 * - entities: [x, z, distanceSqThreshold, padding] per entity
 * - players: [x, z, padding, padding] per player
 * - uniforms: entity count, player count
 *
 * Output:
 * - interests: bit mask array (1 bit per player per entity)
 *   Layout: [entity0_players0-31, entity0_players32-63, ..., entity1_players0-31, ...]
 */
export const INTEREST_MANAGEMENT_SHADER = /* wgsl */ `
struct Entity {
  x: f32,
  z: f32,
  distanceSqThreshold: f32,
  padding: f32,
}

struct Player {
  x: f32,
  z: f32,
  padding1: f32,
  padding2: f32,
}

struct Uniforms {
  entityCount: u32,
  playerCount: u32,
  playersPerU32: u32,  // 32 (bits per u32)
  u32PerEntity: u32,   // ceil(playerCount / 32)
}

@group(0) @binding(0) var<storage, read> entities: array<Entity>;
@group(0) @binding(1) var<storage, read> players: array<Player>;
@group(0) @binding(2) var<storage, read_write> interests: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let threadIdx = global_id.x;
  
  // Each thread handles one entity-player pair
  let entityIdx = threadIdx / uniforms.playerCount;
  let playerIdx = threadIdx % uniforms.playerCount;
  
  if (entityIdx >= uniforms.entityCount || playerIdx >= uniforms.playerCount) {
    return;
  }
  
  let entity = entities[entityIdx];
  let player = players[playerIdx];
  
  // Calculate distance squared
  let dx = entity.x - player.x;
  let dz = entity.z - player.z;
  let distSq = dx * dx + dz * dz;
  
  // Check if player is interested
  if (distSq <= entity.distanceSqThreshold) {
    // Set bit in interests array
    let u32Idx = entityIdx * uniforms.u32PerEntity + playerIdx / 32u;
    let bitIdx = playerIdx % 32u;
    atomicOr(&interests[u32Idx], 1u << bitIdx);
  }
}
`;

/**
 * Alternative: Per-entity approach (better for few entities, many players)
 * Each workgroup processes one entity against all players
 */
export const INTEREST_MANAGEMENT_PER_ENTITY_SHADER = /* wgsl */ `
struct Entity {
  x: f32,
  z: f32,
  distanceSqThreshold: f32,
  padding: f32,
}

struct Player {
  x: f32,
  z: f32,
  padding1: f32,
  padding2: f32,
}

struct Uniforms {
  entityCount: u32,
  playerCount: u32,
  u32PerEntity: u32,
  padding: u32,
}

@group(0) @binding(0) var<storage, read> entities: array<Entity>;
@group(0) @binding(1) var<storage, read> players: array<Player>;
@group(0) @binding(2) var<storage, read_write> interests: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

var<workgroup> sharedEntity: Entity;

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let entityIdx = workgroup_id.x;
  let localIdx = local_id.x;
  
  if (entityIdx >= uniforms.entityCount) {
    return;
  }
  
  // First thread loads entity data to shared memory
  if (localIdx == 0u) {
    sharedEntity = entities[entityIdx];
  }
  workgroupBarrier();
  
  // Each thread in workgroup checks multiple players
  let playersPerThread = (uniforms.playerCount + 255u) / 256u;
  let startPlayer = localIdx * playersPerThread;
  let endPlayer = min(startPlayer + playersPerThread, uniforms.playerCount);
  
  for (var pi = startPlayer; pi < endPlayer; pi = pi + 1u) {
    let player = players[pi];
    
    let dx = sharedEntity.x - player.x;
    let dz = sharedEntity.z - player.z;
    let distSq = dx * dx + dz * dz;
    
    if (distSq <= sharedEntity.distanceSqThreshold) {
      let u32Idx = entityIdx * uniforms.u32PerEntity + pi / 32u;
      let bitIdx = pi % 32u;
      atomicOr(&interests[u32Idx], 1u << bitIdx);
    }
  }
}
`;

// ============================================================================
// SPATIAL RANGE QUERY SHADER
// ============================================================================

/**
 * Batch spatial range query - find entities within radius.
 *
 * Input:
 * - queryPoints: [x, z, radiusSq, padding] per query
 * - candidates: [x, z, entityIdx, typeId] per candidate entity
 * - uniforms: query count, candidate count, type filter (-1 = all)
 *
 * Output:
 * - results: [distanceSq, candidateIdx] per query-candidate pair (filtered)
 * - counts: number of results per query
 */
export const SPATIAL_RANGE_QUERY_SHADER = /* wgsl */ `
struct QueryPoint {
  x: f32,
  z: f32,
  radiusSq: f32,
  typeFilter: i32,  // -1 = all types, otherwise specific type
}

struct Candidate {
  x: f32,
  z: f32,
  entityIdx: u32,
  typeId: u32,
}

struct Result {
  distanceSq: f32,
  candidateIdx: u32,
}

struct Uniforms {
  queryCount: u32,
  candidateCount: u32,
  maxResultsPerQuery: u32,
  padding: u32,
}

@group(0) @binding(0) var<storage, read> queries: array<QueryPoint>;
@group(0) @binding(1) var<storage, read> candidates: array<Candidate>;
@group(0) @binding(2) var<storage, read_write> results: array<Result>;
@group(0) @binding(3) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let threadIdx = global_id.x;
  
  // Each thread handles one query-candidate pair
  let queryIdx = threadIdx / uniforms.candidateCount;
  let candIdx = threadIdx % uniforms.candidateCount;
  
  if (queryIdx >= uniforms.queryCount || candIdx >= uniforms.candidateCount) {
    return;
  }
  
  let query = queries[queryIdx];
  let candidate = candidates[candIdx];
  
  // Type filter check
  if (query.typeFilter >= 0 && u32(query.typeFilter) != candidate.typeId) {
    return;
  }
  
  // Distance check
  let dx = candidate.x - query.x;
  let dz = candidate.z - query.z;
  let distSq = dx * dx + dz * dz;
  
  if (distSq <= query.radiusSq) {
    // Atomically get result slot
    let resultIdx = atomicAdd(&counts[queryIdx], 1u);
    
    // Bounds check (don't exceed max results per query)
    if (resultIdx < uniforms.maxResultsPerQuery) {
      let outputIdx = queryIdx * uniforms.maxResultsPerQuery + resultIdx;
      results[outputIdx].distanceSq = distSq;
      results[outputIdx].candidateIdx = candIdx;
    }
  }
}
`;

// ============================================================================
// BATCH AGGRO CHECK SHADER
// ============================================================================

/**
 * Batch aggro range checks - which mobs should aggro on which players.
 *
 * Input:
 * - mobs: [x, z, aggroRangeSq, behavior] per mob (behavior: 0=passive, 1=aggressive)
 * - players: [x, z, tileX, tileZ] per player
 * - uniforms: mob count, player count
 *
 * Output:
 * - aggroTargets: best target player index per mob (-1 if none)
 * - aggroDistances: distance squared to best target per mob
 */
export const BATCH_AGGRO_CHECK_SHADER = /* wgsl */ `
const NO_TARGET: u32 = 0xFFFFFFFFu;
const INF: f32 = 1e30;

struct Mob {
  x: f32,
  z: f32,
  aggroRangeSq: f32,
  behavior: u32,  // 0 = passive, 1 = aggressive, 2 = territorial
}

struct Player {
  x: f32,
  z: f32,
  tileX: f32,
  tileZ: f32,
}

struct Uniforms {
  mobCount: u32,
  playerCount: u32,
  padding1: u32,
  padding2: u32,
}

@group(0) @binding(0) var<storage, read> mobs: array<Mob>;
@group(0) @binding(1) var<storage, read> players: array<Player>;
@group(0) @binding(2) var<storage, read_write> aggroTargets: array<u32>;
@group(0) @binding(3) var<storage, read_write> aggroDistances: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let mobIdx = global_id.x;
  
  if (mobIdx >= uniforms.mobCount) {
    return;
  }
  
  let mob = mobs[mobIdx];
  
  // Skip passive mobs
  if (mob.behavior == 0u) {
    aggroTargets[mobIdx] = NO_TARGET;
    aggroDistances[mobIdx] = INF;
    return;
  }
  
  var bestTarget = NO_TARGET;
  var bestDistSq = INF;
  
  // Check all players
  for (var pi = 0u; pi < uniforms.playerCount; pi = pi + 1u) {
    let player = players[pi];
    
    let dx = player.x - mob.x;
    let dz = player.z - mob.z;
    let distSq = dx * dx + dz * dz;
    
    // In aggro range and closer than current best?
    if (distSq <= mob.aggroRangeSq && distSq < bestDistSq) {
      bestDistSq = distSq;
      bestTarget = pi;
    }
  }
  
  aggroTargets[mobIdx] = bestTarget;
  aggroDistances[mobIdx] = bestDistSq;
}
`;

// ============================================================================
// NEAREST ENTITY SHADER
// ============================================================================

/**
 * Find nearest entity of each type from query points.
 *
 * Input:
 * - queries: [x, z, maxRangeSq, typeFilter] per query
 * - entities: [x, z, entityId, typeId] per entity
 *
 * Output:
 * - nearestIds: entity index per query (-1 if none found)
 * - nearestDistances: distance squared to nearest
 */
export const NEAREST_ENTITY_SHADER = /* wgsl */ `
const NO_ENTITY: u32 = 0xFFFFFFFFu;
const INF: f32 = 1e30;

struct Query {
  x: f32,
  z: f32,
  maxRangeSq: f32,
  typeFilter: i32,
}

struct Entity {
  x: f32,
  z: f32,
  entityIdx: u32,
  typeId: u32,
}

struct Uniforms {
  queryCount: u32,
  entityCount: u32,
  padding1: u32,
  padding2: u32,
}

@group(0) @binding(0) var<storage, read> queries: array<Query>;
@group(0) @binding(1) var<storage, read> entities: array<Entity>;
@group(0) @binding(2) var<storage, read_write> nearestIds: array<u32>;
@group(0) @binding(3) var<storage, read_write> nearestDistances: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let queryIdx = global_id.x;
  
  if (queryIdx >= uniforms.queryCount) {
    return;
  }
  
  let query = queries[queryIdx];
  var bestIdx = NO_ENTITY;
  var bestDistSq = INF;
  
  for (var ei = 0u; ei < uniforms.entityCount; ei = ei + 1u) {
    let entity = entities[ei];
    
    // Type filter
    if (query.typeFilter >= 0 && u32(query.typeFilter) != entity.typeId) {
      continue;
    }
    
    let dx = entity.x - query.x;
    let dz = entity.z - query.z;
    let distSq = dx * dx + dz * dz;
    
    if (distSq <= query.maxRangeSq && distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIdx = ei;
    }
  }
  
  nearestIds[queryIdx] = bestIdx;
  nearestDistances[queryIdx] = bestDistSq;
}
`;

// ============================================================================
// PHYSICS BROADPHASE AABB OVERLAP SHADER
// ============================================================================

/**
 * Batch AABB overlap tests for physics broadphase.
 *
 * Input:
 * - aabbs: [minX, minY, minZ, maxX, maxY, maxZ, entityIdx, layer] per AABB
 * - uniforms: aabb count, layer mask for filtering
 *
 * Output:
 * - overlaps: pairs of overlapping AABB indices
 * - overlapCount: number of overlapping pairs
 */
// Workgroup size used by the broadphase compute shader (1D along X).
// Exported so host-side dispatch math stays in sync with the shader — any
// drift here would silently miscompute thread indices in the 2D dispatch
// path (threadsPerRow = numWorkgroupsX * BROADPHASE_WORKGROUP_SIZE_X).
export const BROADPHASE_WORKGROUP_SIZE_X = 64;

export const PHYSICS_BROADPHASE_SHADER = /* wgsl */ `
// WORKGROUP_SIZE_1D must match BROADPHASE_WORKGROUP_SIZE_X above.
const WORKGROUP_SIZE_1D: u32 = ${BROADPHASE_WORKGROUP_SIZE_X}u;

struct AABB {
  minX: f32,
  minY: f32,
  minZ: f32,
  maxX: f32,
  maxY: f32,
  maxZ: f32,
  entityIdx: u32,
  layer: u32,
}

struct OverlapPair {
  a: u32,
  b: u32,
}

struct Uniforms {
  aabbCount: u32,
  layerMask: u32,  // Bitmask for layer filtering
  maxOverlaps: u32,
  // X-dimension workgroup count passed from the host. Needed because this
  // shader can be dispatched 2D (dispatchWorkgroups(x, y, 1)) whenever
  // ceil(totalPairs/64) exceeds WebGPU's per-dimension ceiling of 65535.
  // In that case the linear thread index must be reconstructed from
  // (global_invocation_id.x, global_invocation_id.y) instead of
  // global_invocation_id.x alone. The 1D dispatch case just passes y=1
  // and this field is still correct (numWorkgroupsX equals the total).
  numWorkgroupsX: u32,
}

@group(0) @binding(0) var<storage, read> aabbs: array<AABB>;
@group(0) @binding(1) var<storage, read_write> overlaps: array<OverlapPair>;
@group(0) @binding(2) var<storage, read_write> overlapCount: atomic<u32>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn aabbOverlap(a: AABB, b: AABB) -> bool {
  return a.minX <= b.maxX && a.maxX >= b.minX &&
         a.minY <= b.maxY && a.maxY >= b.minY &&
         a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

@compute @workgroup_size(${BROADPHASE_WORKGROUP_SIZE_X})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // Reconstruct the linear thread index across 2D dispatch.
  // threadsPerRow = numWorkgroupsX * workgroup_size_x.
  // Under a 1D dispatch dispatchWorkgroups(N, 1, 1), global_id.y is 0 and
  // this reduces to threadIdx = global_id.x. Under a 2D dispatch
  // dispatchWorkgroups(65535, K, 1), global_id.y ranges 0..K-1 and we
  // offset by a full row of threads per y.
  let threadsPerRow = uniforms.numWorkgroupsX * WORKGROUP_SIZE_1D;
  let threadIdx = global_id.y * threadsPerRow + global_id.x;

  // Each thread checks one pair (upper triangle of N×N matrix)
  // Thread i maps to pair (a, b) where a < b
  let n = uniforms.aabbCount;
  let totalPairs = n * (n - 1u) / 2u;

  if (threadIdx >= totalPairs) {
    return;
  }
  
  // Map linear index to (a, b) pair
  // Using quadratic formula: a = floor((2n-1 - sqrt((2n-1)^2 - 8*i)) / 2)
  let k = f32(threadIdx);
  let nf = f32(n);
  let a = u32(floor((2.0 * nf - 1.0 - sqrt((2.0 * nf - 1.0) * (2.0 * nf - 1.0) - 8.0 * k)) / 2.0));
  let b = threadIdx - a * (2u * n - a - 1u) / 2u + a + 1u;
  
  if (a >= n || b >= n || a >= b) {
    return;
  }
  
  let aabbA = aabbs[a];
  let aabbB = aabbs[b];
  
  // Layer filtering
  if ((aabbA.layer & uniforms.layerMask) == 0u || (aabbB.layer & uniforms.layerMask) == 0u) {
    return;
  }
  
  // Check overlap
  if (aabbOverlap(aabbA, aabbB)) {
    let idx = atomicAdd(&overlapCount, 1u);
    if (idx < uniforms.maxOverlaps) {
      overlaps[idx].a = a;
      overlaps[idx].b = b;
    }
  }
}
`;

// ============================================================================
// SOUND OCCLUSION SHADER
// ============================================================================

/**
 * Compute sound relevance for players based on distance and obstacles.
 *
 * Input:
 * - sounds: [x, y, z, volume, falloffStart, falloffEnd] per sound source
 * - listeners: [x, y, z, padding] per listener (player)
 *
 * Output:
 * - volumes: effective volume at each listener for each sound
 */
export const SOUND_OCCLUSION_SHADER = /* wgsl */ `
struct SoundSource {
  x: f32,
  y: f32,
  z: f32,
  volume: f32,
  falloffStart: f32,
  falloffEnd: f32,
  padding1: f32,
  padding2: f32,
}

struct Listener {
  x: f32,
  y: f32,
  z: f32,
  padding: f32,
}

struct Uniforms {
  soundCount: u32,
  listenerCount: u32,
  padding1: u32,
  padding2: u32,
}

@group(0) @binding(0) var<storage, read> sounds: array<SoundSource>;
@group(0) @binding(1) var<storage, read> listeners: array<Listener>;
@group(0) @binding(2) var<storage, read_write> volumes: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let threadIdx = global_id.x;
  
  let soundIdx = threadIdx / uniforms.listenerCount;
  let listenerIdx = threadIdx % uniforms.listenerCount;
  
  if (soundIdx >= uniforms.soundCount || listenerIdx >= uniforms.listenerCount) {
    return;
  }
  
  let sound = sounds[soundIdx];
  let listener = listeners[listenerIdx];
  
  // Calculate 3D distance
  let dx = listener.x - sound.x;
  let dy = listener.y - sound.y;
  let dz = listener.z - sound.z;
  let distance = sqrt(dx * dx + dy * dy + dz * dz);
  
  // Calculate volume based on distance falloff
  var effectiveVolume = 0.0;
  if (distance <= sound.falloffStart) {
    effectiveVolume = sound.volume;
  } else if (distance >= sound.falloffEnd) {
    effectiveVolume = 0.0;
  } else {
    // Linear falloff
    let t = (distance - sound.falloffStart) / (sound.falloffEnd - sound.falloffStart);
    effectiveVolume = sound.volume * (1.0 - t);
  }
  
  volumes[soundIdx * uniforms.listenerCount + listenerIdx] = effectiveVolume;
}
`;

// ============================================================================
// SPAWN PLACEMENT VALIDATION SHADER
// ============================================================================

/**
 * Validate spawn positions by checking against occupied areas.
 *
 * Input:
 * - candidates: [x, z, radius, padding] potential spawn positions
 * - occupied: [x, z, radius, padding] occupied positions (other entities)
 *
 * Output:
 * - valid: 1 if position is valid, 0 if blocked
 * - nearestOccupiedDist: distance to nearest occupied position
 */
export const SPAWN_VALIDATION_SHADER = /* wgsl */ `
const INF: f32 = 1e30;

struct Candidate {
  x: f32,
  z: f32,
  radius: f32,
  minSeparation: f32,  // Minimum distance from other entities
}

struct Occupied {
  x: f32,
  z: f32,
  radius: f32,
  padding: f32,
}

struct Uniforms {
  candidateCount: u32,
  occupiedCount: u32,
  padding1: u32,
  padding2: u32,
}

@group(0) @binding(0) var<storage, read> candidates: array<Candidate>;
@group(0) @binding(1) var<storage, read> occupied: array<Occupied>;
@group(0) @binding(2) var<storage, read_write> valid: array<u32>;
@group(0) @binding(3) var<storage, read_write> nearestDist: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candIdx = global_id.x;
  
  if (candIdx >= uniforms.candidateCount) {
    return;
  }
  
  let candidate = candidates[candIdx];
  var isValid = 1u;
  var minDist = INF;
  
  // Check against all occupied positions
  for (var oi = 0u; oi < uniforms.occupiedCount; oi = oi + 1u) {
    let occ = occupied[oi];
    
    let dx = candidate.x - occ.x;
    let dz = candidate.z - occ.z;
    let dist = sqrt(dx * dx + dz * dz);
    
    // Track nearest
    if (dist < minDist) {
      minDist = dist;
    }
    
    // Check if overlapping (considering both radii and min separation)
    let requiredDist = candidate.radius + occ.radius + candidate.minSeparation;
    if (dist < requiredDist) {
      isValid = 0u;
    }
  }
  
  valid[candIdx] = isValid;
  nearestDist[candIdx] = minDist;
}
`;

// ============================================================================
// LOOT DISTRIBUTION SHADER
// ============================================================================

/**
 * Find nearest eligible player for each loot drop.
 * Used for loot assignment when corpses drop items.
 *
 * Input:
 * - lootDrops: [x, z, dropTime, ownerId] per drop (-1 = no owner)
 * - players: [x, z, playerId, canLoot] per player
 *
 * Output:
 * - nearestPlayer: player index for each drop (-1 if none)
 * - nearestDistance: distance to nearest player
 */
export const LOOT_DISTRIBUTION_SHADER = /* wgsl */ `
const NO_PLAYER: u32 = 0xFFFFFFFFu;
const INF: f32 = 1e30;

struct LootDrop {
  x: f32,
  z: f32,
  dropTime: f32,
  ownerId: i32,  // -1 = public, else player index
}

struct Player {
  x: f32,
  z: f32,
  playerIdx: u32,
  canLoot: u32,  // 1 = can loot, 0 = cannot
}

struct Uniforms {
  dropCount: u32,
  playerCount: u32,
  maxLootDistance: f32,
  ownerExclusiveTime: f32,  // Time before loot becomes public
}

@group(0) @binding(0) var<storage, read> drops: array<LootDrop>;
@group(0) @binding(1) var<storage, read> players: array<Player>;
@group(0) @binding(2) var<storage, read_write> nearestPlayer: array<u32>;
@group(0) @binding(3) var<storage, read_write> nearestDistance: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dropIdx = global_id.x;
  
  if (dropIdx >= uniforms.dropCount) {
    return;
  }
  
  let drop = drops[dropIdx];
  var bestPlayer = NO_PLAYER;
  var bestDist = INF;
  
  // Check all players
  for (var pi = 0u; pi < uniforms.playerCount; pi = pi + 1u) {
    let player = players[pi];
    
    // Skip players who can't loot
    if (player.canLoot == 0u) {
      continue;
    }
    
    // Check owner exclusivity (owner gets first dibs)
    if (drop.ownerId >= 0 && u32(drop.ownerId) != player.playerIdx) {
      // Not the owner - check if exclusive time has passed
      // (This would need current time passed in, simplified here)
      continue;
    }
    
    let dx = player.x - drop.x;
    let dz = player.z - drop.z;
    let dist = sqrt(dx * dx + dz * dz);
    
    if (dist <= uniforms.maxLootDistance && dist < bestDist) {
      bestDist = dist;
      bestPlayer = pi;
    }
  }
  
  nearestPlayer[dropIdx] = bestPlayer;
  nearestDistance[dropIdx] = bestDist;
}
`;

// ============================================================================
// COMBINED EXPORTS
// ============================================================================

/**
 * All networking-related compute shaders.
 */
export const NETWORKING_SHADERS = {
  INTEREST_MANAGEMENT: INTEREST_MANAGEMENT_SHADER,
  INTEREST_MANAGEMENT_PER_ENTITY: INTEREST_MANAGEMENT_PER_ENTITY_SHADER,
  SPATIAL_RANGE_QUERY: SPATIAL_RANGE_QUERY_SHADER,
  BATCH_AGGRO_CHECK: BATCH_AGGRO_CHECK_SHADER,
  NEAREST_ENTITY: NEAREST_ENTITY_SHADER,
  // Additional utility shaders
  PHYSICS_BROADPHASE: PHYSICS_BROADPHASE_SHADER,
  SOUND_OCCLUSION: SOUND_OCCLUSION_SHADER,
  SPAWN_VALIDATION: SPAWN_VALIDATION_SHADER,
  LOOT_DISTRIBUTION: LOOT_DISTRIBUTION_SHADER,
};
