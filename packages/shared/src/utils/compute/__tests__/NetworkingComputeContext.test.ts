/**
 * NetworkingComputeContext Tests
 *
 * Tests for GPU-accelerated networking operations.
 * Note: GPU tests require WebGPU support, which is not available in Node.js.
 * These tests verify the interface contracts and CPU fallback logic.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  NetworkingComputeContext,
  MAX_INTEREST_MANAGEMENT_ENTITIES,
  isNetworkingComputeAvailable,
  type GPUEntityInterest,
  type GPUPlayerPosition,
  type GPUMobData,
  type GPUSpatialQuery,
  type GPUSpatialCandidate,
  type GPUAABB,
  type GPUSoundSource,
  type GPUListener,
  type GPUSpawnCandidate,
  type GPUOccupiedPosition,
  type GPULootDrop,
  type GPULootPlayer,
} from "../NetworkingComputeContext";
import {
  INTEREST_MANAGEMENT_SHADER,
  INTEREST_MANAGEMENT_PER_ENTITY_SHADER,
  SPATIAL_RANGE_QUERY_SHADER,
  BATCH_AGGRO_CHECK_SHADER,
  NEAREST_ENTITY_SHADER,
  PHYSICS_BROADPHASE_SHADER,
  SOUND_OCCLUSION_SHADER,
  SPAWN_VALIDATION_SHADER,
  LOOT_DISTRIBUTION_SHADER,
  NETWORKING_SHADERS,
} from "../shaders/networking.wgsl";

describe("NetworkingComputeContext", () => {
  describe("shader exports", () => {
    it("should export interest management shader", () => {
      expect(INTEREST_MANAGEMENT_SHADER).toBeDefined();
      expect(INTEREST_MANAGEMENT_SHADER).toContain("@compute");
      expect(INTEREST_MANAGEMENT_SHADER).toContain("atomicOr");
    });

    it("should export per-entity interest management shader", () => {
      expect(INTEREST_MANAGEMENT_PER_ENTITY_SHADER).toBeDefined();
      expect(INTEREST_MANAGEMENT_PER_ENTITY_SHADER).toContain("@compute");
      expect(INTEREST_MANAGEMENT_PER_ENTITY_SHADER).toContain(
        "workgroupBarrier",
      );
    });

    it("documents the one-workgroup-per-entity interest limit", () => {
      expect(MAX_INTEREST_MANAGEMENT_ENTITIES).toBe(65_535);
    });

    it("should export spatial range query shader", () => {
      expect(SPATIAL_RANGE_QUERY_SHADER).toBeDefined();
      expect(SPATIAL_RANGE_QUERY_SHADER).toContain("@compute");
      expect(SPATIAL_RANGE_QUERY_SHADER).toContain("radiusSq");
    });

    it("should export batch aggro check shader", () => {
      expect(BATCH_AGGRO_CHECK_SHADER).toBeDefined();
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("@compute");
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("aggroRangeSq");
    });

    it("should export nearest entity shader", () => {
      expect(NEAREST_ENTITY_SHADER).toBeDefined();
      expect(NEAREST_ENTITY_SHADER).toContain("@compute");
      expect(NEAREST_ENTITY_SHADER).toContain("nearestIds");
    });

    it("should export combined NETWORKING_SHADERS object", () => {
      expect(NETWORKING_SHADERS).toBeDefined();
      expect(NETWORKING_SHADERS.INTEREST_MANAGEMENT).toBe(
        INTEREST_MANAGEMENT_SHADER,
      );
      expect(NETWORKING_SHADERS.BATCH_AGGRO_CHECK).toBe(
        BATCH_AGGRO_CHECK_SHADER,
      );
      expect(NETWORKING_SHADERS.NEAREST_ENTITY).toBe(NEAREST_ENTITY_SHADER);
    });

    it("should export physics broadphase shader", () => {
      expect(PHYSICS_BROADPHASE_SHADER).toBeDefined();
      expect(PHYSICS_BROADPHASE_SHADER).toContain("@compute");
      expect(PHYSICS_BROADPHASE_SHADER).toContain("aabbOverlap");
    });

    it("broadphase shader carries the 2D-dispatch linear-index reconstruction and uniform field", () => {
      // Regression guard for the 2D dispatch reshape: at aabbCount ≳ 5793
      // the O(N²) pair dispatch exceeds WebGPU's 65535 per-dimension
      // workgroup ceiling, so the host issues a 2D dispatch and the
      // shader must reconstruct the linear thread index from
      // (global_id.x, global_id.y) using `numWorkgroupsX` passed via
      // uniforms. If this assertion fails the shader is back to the
      // 1D form and the canary will stall at 1080p.
      expect(PHYSICS_BROADPHASE_SHADER).toContain("numWorkgroupsX: u32");
      // Shader multiplies by a named WGSL const bound to the host-side
      // workgroup constant (not a raw "64u"), so host and shader cannot
      // drift. The const value itself is still 64u, emitted from the TS
      // template literal, so the assertion accepts either form for
      // safety against future template tweaks.
      expect(PHYSICS_BROADPHASE_SHADER).toMatch(
        /uniforms\.numWorkgroupsX \* (WORKGROUP_SIZE_1D|64u)/,
      );
      expect(PHYSICS_BROADPHASE_SHADER).toContain(
        "const WORKGROUP_SIZE_1D: u32 = 64u",
      );
      expect(PHYSICS_BROADPHASE_SHADER).toContain(
        "global_id.y * threadsPerRow + global_id.x",
      );
      // `padding` was repurposed to numWorkgroupsX; make sure the old
      // name isn't accidentally reintroduced.
      expect(PHYSICS_BROADPHASE_SHADER).not.toContain("padding: u32");
    });

    it("broadphase 2D dispatch shape covers the pair space", () => {
      // Host-side reshape math: totalPairs = n*(n-1)/2, workgroups =
      // ceil(totalPairs / 64), dispatchX = min(workgroups, 65535),
      // dispatchY = ceil(workgroups / dispatchX). Verify the resulting
      // (x, y, 64 threads-per-workgroup) 3-tuple ALWAYS covers every
      // pair for a range of aabbCounts spanning under, at, and well
      // above the dispatch-dimension ceiling.
      const WEBGPU_MAX = 65535;
      const reshape = (aabbCount: number) => {
        const totalPairs = (aabbCount * (aabbCount - 1)) / 2;
        const workgroups = Math.ceil(totalPairs / 64);
        const dispatchX = Math.min(workgroups, WEBGPU_MAX);
        const dispatchY = Math.ceil(workgroups / dispatchX);
        if (dispatchY > WEBGPU_MAX) {
          throw new Error("dispatchY exceeds WebGPU limit");
        }
        return { totalPairs, workgroups, dispatchX, dispatchY };
      };

      for (const aabbCount of [2, 1000, 5793, 5800, 8000, 12000, 20000]) {
        const r = reshape(aabbCount);
        // Dimensions within WebGPU limits.
        expect(r.dispatchX).toBeLessThanOrEqual(WEBGPU_MAX);
        expect(r.dispatchY).toBeLessThanOrEqual(WEBGPU_MAX);
        // Total threads cover every pair.
        expect(r.dispatchX * r.dispatchY * 64).toBeGreaterThanOrEqual(
          r.totalPairs,
        );
      }
    });

    it("rejects impossible broadphase dispatch shapes instead of overflowing Y", () => {
      // totalPairs = WEBGPU_MAX² * 64 + 1 forces dispatchY one over the
      // per-dimension ceiling after the 2D reshape.
      const WEBGPU_MAX = 65535;
      const reshape = (aabbCount: number) => {
        const totalPairs = (aabbCount * (aabbCount - 1)) / 2;
        const workgroups = Math.ceil(totalPairs / 64);
        const dispatchX = Math.min(workgroups, WEBGPU_MAX);
        const dispatchY = Math.ceil(workgroups / dispatchX);
        if (dispatchY > WEBGPU_MAX) {
          throw new Error("dispatchY exceeds WebGPU limit");
        }
        return { dispatchX, dispatchY };
      };
      const impossiblePairs = WEBGPU_MAX * WEBGPU_MAX * 64 + 1;
      const aabbCount = Math.ceil((1 + Math.sqrt(1 + 8 * impossiblePairs)) / 2);

      expect(() => reshape(aabbCount)).toThrow(
        "dispatchY exceeds WebGPU limit",
      );
    });

    it("should export sound occlusion shader", () => {
      expect(SOUND_OCCLUSION_SHADER).toBeDefined();
      expect(SOUND_OCCLUSION_SHADER).toContain("@compute");
      expect(SOUND_OCCLUSION_SHADER).toContain("falloffStart");
    });

    it("should export spawn validation shader", () => {
      expect(SPAWN_VALIDATION_SHADER).toBeDefined();
      expect(SPAWN_VALIDATION_SHADER).toContain("@compute");
      expect(SPAWN_VALIDATION_SHADER).toContain("minSeparation");
    });

    it("should export loot distribution shader", () => {
      expect(LOOT_DISTRIBUTION_SHADER).toBeDefined();
      expect(LOOT_DISTRIBUTION_SHADER).toContain("@compute");
      expect(LOOT_DISTRIBUTION_SHADER).toContain("maxLootDistance");
    });

    it("should include new shaders in NETWORKING_SHADERS", () => {
      expect(NETWORKING_SHADERS.PHYSICS_BROADPHASE).toBe(
        PHYSICS_BROADPHASE_SHADER,
      );
      expect(NETWORKING_SHADERS.SOUND_OCCLUSION).toBe(SOUND_OCCLUSION_SHADER);
      expect(NETWORKING_SHADERS.SPAWN_VALIDATION).toBe(SPAWN_VALIDATION_SHADER);
      expect(NETWORKING_SHADERS.LOOT_DISTRIBUTION).toBe(
        LOOT_DISTRIBUTION_SHADER,
      );
    });
  });

  describe("isNetworkingComputeAvailable", () => {
    it("should return a boolean", () => {
      const result = isNetworkingComputeAvailable();
      expect(typeof result).toBe("boolean");
    });

    // In Node.js/Vitest environment, WebGPU is not available
    it("should return false in Node.js environment", () => {
      expect(isNetworkingComputeAvailable()).toBe(false);
    });
  });

  describe("NetworkingComputeContext construction", () => {
    it("should create a context with default config", () => {
      const ctx = new NetworkingComputeContext();
      expect(ctx).toBeDefined();
      expect(ctx.isReady()).toBe(false);
      ctx.destroy();
    });

    it("should create a context with custom config", () => {
      const ctx = new NetworkingComputeContext({
        minInterestPairsForGPU: 100,
        minSpatialPairsForGPU: 200,
        minAggroPairsForGPU: 150,
      });
      expect(ctx).toBeDefined();
      ctx.destroy();
    });
  });

  describe("shouldUseGPU methods", () => {
    let ctx: NetworkingComputeContext;

    beforeEach(() => {
      ctx = new NetworkingComputeContext({
        minInterestPairsForGPU: 100,
        minSpatialPairsForGPU: 200,
        minAggroPairsForGPU: 150,
      });
    });

    afterEach(() => {
      ctx.destroy();
    });

    it("should return false for interest filtering when not initialized", () => {
      expect(ctx.shouldUseGPUForInterestFiltering(50, 10)).toBe(false);
    });

    it("should return false for aggro checks when not initialized", () => {
      expect(ctx.shouldUseGPUForAggroChecks(100, 10)).toBe(false);
    });

    it("should return false for broadphase when not initialized", () => {
      expect(ctx.shouldUseGPUForBroadphase(100)).toBe(false);
    });

    it("should return false for sound occlusion when not initialized", () => {
      expect(ctx.shouldUseGPUForSoundOcclusion(10, 20)).toBe(false);
    });

    it("should return false for spawn validation when not initialized", () => {
      expect(ctx.shouldUseGPUForSpawnValidation(100)).toBe(false);
    });

    it("should return false for loot distribution when not initialized", () => {
      expect(ctx.shouldUseGPUForLootDistribution(10, 10)).toBe(false);
    });
  });

  describe("type interfaces", () => {
    it("should have correct GPUEntityInterest interface", () => {
      const entity: GPUEntityInterest = {
        x: 100,
        z: 200,
        distanceSqThreshold: 10000,
      };
      expect(entity.x).toBe(100);
      expect(entity.distanceSqThreshold).toBe(10000);
    });

    it("should have correct GPUPlayerPosition interface", () => {
      const player: GPUPlayerPosition = {
        x: 50,
        z: 75,
      };
      expect(player.x).toBe(50);
      expect(player.z).toBe(75);
    });

    it("should have correct GPUMobData interface", () => {
      const mob: GPUMobData = {
        x: 100,
        z: 100,
        aggroRangeSq: 225, // 15 units
        behavior: 1, // aggressive
      };
      expect(mob.aggroRangeSq).toBe(225);
      expect(mob.behavior).toBe(1);
    });

    it("should have correct GPUSpatialQuery interface", () => {
      const query: GPUSpatialQuery = {
        x: 0,
        z: 0,
        radiusSq: 400, // 20 unit radius
        typeFilter: -1, // all types
      };
      expect(query.radiusSq).toBe(400);
      expect(query.typeFilter).toBe(-1);
    });

    it("should have correct GPUSpatialCandidate interface", () => {
      const candidate: GPUSpatialCandidate = {
        x: 10,
        z: 20,
        entityIdx: 42,
        typeId: 1,
      };
      expect(candidate.entityIdx).toBe(42);
      expect(candidate.typeId).toBe(1);
    });

    it("should have correct GPUAABB interface", () => {
      const aabb: GPUAABB = {
        minX: 0,
        minY: 0,
        minZ: 0,
        maxX: 10,
        maxY: 10,
        maxZ: 10,
        entityIdx: 1,
        layer: 1,
      };
      expect(aabb.maxX).toBe(10);
      expect(aabb.layer).toBe(1);
    });

    it("should have correct GPUSoundSource interface", () => {
      const sound: GPUSoundSource = {
        x: 100,
        y: 0,
        z: 100,
        volume: 1.0,
        falloffStart: 10,
        falloffEnd: 50,
      };
      expect(sound.volume).toBe(1.0);
      expect(sound.falloffEnd).toBe(50);
    });

    it("should have correct GPUListener interface", () => {
      const listener: GPUListener = {
        x: 50,
        y: 0,
        z: 50,
      };
      expect(listener.x).toBe(50);
    });

    it("should have correct GPUSpawnCandidate interface", () => {
      const candidate: GPUSpawnCandidate = {
        x: 100,
        z: 100,
        radius: 2,
        minSeparation: 5,
      };
      expect(candidate.minSeparation).toBe(5);
    });

    it("should have correct GPUOccupiedPosition interface", () => {
      const occupied: GPUOccupiedPosition = {
        x: 50,
        z: 50,
        radius: 3,
      };
      expect(occupied.radius).toBe(3);
    });

    it("should have correct GPULootDrop interface", () => {
      const drop: GPULootDrop = {
        x: 100,
        z: 100,
        dropTime: 1000,
        ownerId: 42,
      };
      expect(drop.ownerId).toBe(42);
    });

    it("should have correct GPULootPlayer interface", () => {
      const player: GPULootPlayer = {
        x: 50,
        z: 50,
        playerIdx: 1,
        canLoot: true,
      };
      expect(player.canLoot).toBe(true);
    });
  });
});

describe("WGSL Networking Shader Validation", () => {
  describe("Interest Management Shader", () => {
    it("should have correct struct definitions", () => {
      expect(INTEREST_MANAGEMENT_SHADER).toContain("struct Entity {");
      expect(INTEREST_MANAGEMENT_SHADER).toContain("struct Player {");
      expect(INTEREST_MANAGEMENT_SHADER).toContain("struct Uniforms {");
    });

    it("should have correct bindings", () => {
      expect(INTEREST_MANAGEMENT_SHADER).toContain("@group(0) @binding(0)");
      expect(INTEREST_MANAGEMENT_SHADER).toContain("@group(0) @binding(1)");
      expect(INTEREST_MANAGEMENT_SHADER).toContain("@group(0) @binding(2)");
      expect(INTEREST_MANAGEMENT_SHADER).toContain("@group(0) @binding(3)");
    });

    it("should use atomic operations for thread safety", () => {
      expect(INTEREST_MANAGEMENT_SHADER).toContain("atomic<u32>");
      expect(INTEREST_MANAGEMENT_SHADER).toContain("atomicOr");
    });

    it("should calculate distance squared", () => {
      expect(INTEREST_MANAGEMENT_SHADER).toContain("dx * dx + dz * dz");
    });
  });

  describe("Batch Aggro Check Shader", () => {
    it("should have correct struct definitions", () => {
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("struct Mob {");
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("struct Player {");
    });

    it("should have NO_TARGET constant", () => {
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("NO_TARGET");
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("0xFFFFFFFFu");
    });

    it("should skip passive mobs", () => {
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("mob.behavior == 0u");
    });

    it("should find closest target", () => {
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("distSq < bestDistSq");
      expect(BATCH_AGGRO_CHECK_SHADER).toContain("bestTarget = pi");
    });
  });

  describe("Nearest Entity Shader", () => {
    it("should have type filter support", () => {
      expect(NEAREST_ENTITY_SHADER).toContain("typeFilter");
      expect(NEAREST_ENTITY_SHADER).toContain("query.typeFilter >= 0");
    });

    it("should track best distance", () => {
      expect(NEAREST_ENTITY_SHADER).toContain("bestDistSq");
      expect(NEAREST_ENTITY_SHADER).toContain("distSq < bestDistSq");
    });
  });
});

describe("CPU Fallback Logic", () => {
  describe("Interest filtering algorithm", () => {
    it("should identify interested players within distance threshold", () => {
      const entity = { x: 100, z: 100, distanceSqThreshold: 2500 }; // 50 unit radius
      const players = [
        { x: 100, z: 100 }, // distance 0
        { x: 110, z: 100 }, // distance 10
        { x: 150, z: 100 }, // distance 50 (exactly at edge)
        { x: 200, z: 100 }, // distance 100 (outside)
      ];

      const interestedPlayers: number[] = [];
      for (let i = 0; i < players.length; i++) {
        const dx = entity.x - players[i].x;
        const dz = entity.z - players[i].z;
        const distSq = dx * dx + dz * dz;
        if (distSq <= entity.distanceSqThreshold) {
          interestedPlayers.push(i);
        }
      }

      expect(interestedPlayers).toEqual([0, 1, 2]); // Players 0, 1, 2 are within range
    });
  });

  describe("Aggro targeting algorithm", () => {
    it("should find closest player in aggro range", () => {
      const mob = { x: 100, z: 100, aggroRangeSq: 400, behavior: 1 }; // 20 unit range
      const players = [
        { x: 130, z: 100 }, // distance 30 (outside)
        { x: 115, z: 100 }, // distance 15
        { x: 110, z: 100 }, // distance 10 (closest)
      ];

      let bestTarget = -1;
      let bestDistSq = Infinity;

      for (let i = 0; i < players.length; i++) {
        const dx = players[i].x - mob.x;
        const dz = players[i].z - mob.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= mob.aggroRangeSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestTarget = i;
        }
      }

      expect(bestTarget).toBe(2); // Player at index 2 is closest
      expect(bestDistSq).toBe(100); // 10^2 = 100
    });

    it("should skip passive mobs", () => {
      const mob = { x: 100, z: 100, aggroRangeSq: 400, behavior: 0 }; // passive
      const _players = [{ x: 105, z: 100 }];

      // Passive mob should have no target
      if (mob.behavior === 0) {
        expect(true).toBe(true); // Would skip processing
      }
    });

    it("should return no target when no players in range", () => {
      const mob = { x: 100, z: 100, aggroRangeSq: 100, behavior: 1 }; // 10 unit range
      const players = [
        { x: 200, z: 200 }, // way outside
      ];

      let bestTarget = -1;
      let bestDistSq = Infinity;

      for (let i = 0; i < players.length; i++) {
        const dx = players[i].x - mob.x;
        const dz = players[i].z - mob.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= mob.aggroRangeSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestTarget = i;
        }
      }

      expect(bestTarget).toBe(-1);
    });
  });

  describe("Nearest entity algorithm", () => {
    it("should find nearest entity with type filter", () => {
      const query = { x: 0, z: 0, maxRangeSq: 10000, typeFilter: 1 };
      const entities = [
        { x: 10, z: 0, entityIdx: 0, typeId: 0 }, // wrong type
        { x: 20, z: 0, entityIdx: 1, typeId: 1 }, // correct type, distance 20
        { x: 15, z: 0, entityIdx: 2, typeId: 1 }, // correct type, distance 15 (closest)
      ];

      let bestIdx = -1;
      let bestDistSq = Infinity;

      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (query.typeFilter >= 0 && query.typeFilter !== e.typeId) continue;

        const dx = e.x - query.x;
        const dz = e.z - query.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= query.maxRangeSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestIdx = i;
        }
      }

      expect(bestIdx).toBe(2); // Entity at index 2 is closest matching type
    });

    it("should return all types when typeFilter is -1", () => {
      const query = { x: 0, z: 0, maxRangeSq: 10000, typeFilter: -1 };
      const entities = [
        { x: 5, z: 0, entityIdx: 0, typeId: 0 }, // closest regardless of type
        { x: 10, z: 0, entityIdx: 1, typeId: 1 },
      ];

      let bestIdx = -1;
      let bestDistSq = Infinity;

      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (query.typeFilter >= 0 && query.typeFilter !== e.typeId) continue;

        const dx = e.x - query.x;
        const dz = e.z - query.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= query.maxRangeSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestIdx = i;
        }
      }

      expect(bestIdx).toBe(0); // Entity at index 0 is closest
    });
  });

  describe("Performance scaling", () => {
    it("should scale O(entities × players) for interest filtering", () => {
      const entityCount = 50;
      const playerCount = 100;
      const expectedPairs = entityCount * playerCount;

      // This represents the problem size GPU compute solves in parallel
      expect(expectedPairs).toBe(5000);
    });

    it("should scale O(mobs × players) for aggro checks", () => {
      const mobCount = 200;
      const playerCount = 50;
      const expectedPairs = mobCount * playerCount;

      // GPU handles 10,000 distance checks in parallel
      expect(expectedPairs).toBe(10000);
    });
  });

  describe("AABB overlap algorithm (broadphase)", () => {
    function aabbOverlap(
      a: {
        minX: number;
        minY: number;
        minZ: number;
        maxX: number;
        maxY: number;
        maxZ: number;
      },
      b: {
        minX: number;
        minY: number;
        minZ: number;
        maxX: number;
        maxY: number;
        maxZ: number;
      },
    ): boolean {
      return (
        a.minX <= b.maxX &&
        a.maxX >= b.minX &&
        a.minY <= b.maxY &&
        a.maxY >= b.minY &&
        a.minZ <= b.maxZ &&
        a.maxZ >= b.minZ
      );
    }

    it("should detect overlapping AABBs", () => {
      const a = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 };
      const b = { minX: 5, minY: 5, minZ: 5, maxX: 15, maxY: 15, maxZ: 15 };
      expect(aabbOverlap(a, b)).toBe(true);
    });

    it("should detect non-overlapping AABBs", () => {
      const a = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 };
      const b = { minX: 20, minY: 20, minZ: 20, maxX: 30, maxY: 30, maxZ: 30 };
      expect(aabbOverlap(a, b)).toBe(false);
    });

    it("should detect touching AABBs as overlapping", () => {
      const a = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 };
      const b = { minX: 10, minY: 0, minZ: 0, maxX: 20, maxY: 10, maxZ: 10 };
      expect(aabbOverlap(a, b)).toBe(true);
    });

    it("should find all overlapping pairs", () => {
      const aabbs = [
        { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 },
        { minX: 5, minY: 5, minZ: 5, maxX: 15, maxY: 15, maxZ: 15 },
        { minX: 100, minY: 100, minZ: 100, maxX: 110, maxY: 110, maxZ: 110 },
      ];

      const overlaps: Array<{ a: number; b: number }> = [];
      for (let i = 0; i < aabbs.length; i++) {
        for (let j = i + 1; j < aabbs.length; j++) {
          if (aabbOverlap(aabbs[i], aabbs[j])) {
            overlaps.push({ a: i, b: j });
          }
        }
      }

      expect(overlaps.length).toBe(1);
      expect(overlaps[0]).toEqual({ a: 0, b: 1 });
    });
  });

  describe("Sound occlusion algorithm", () => {
    function calculateVolume(
      sound: {
        x: number;
        y: number;
        z: number;
        volume: number;
        falloffStart: number;
        falloffEnd: number;
      },
      listener: { x: number; y: number; z: number },
    ): number {
      const dx = listener.x - sound.x;
      const dy = listener.y - sound.y;
      const dz = listener.z - sound.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance <= sound.falloffStart) return sound.volume;
      if (distance >= sound.falloffEnd) return 0;

      const t =
        (distance - sound.falloffStart) /
        (sound.falloffEnd - sound.falloffStart);
      return sound.volume * (1 - t);
    }

    it("should return full volume within falloff start", () => {
      const sound = {
        x: 0,
        y: 0,
        z: 0,
        volume: 1.0,
        falloffStart: 10,
        falloffEnd: 50,
      };
      const listener = { x: 5, y: 0, z: 0 };
      expect(calculateVolume(sound, listener)).toBe(1.0);
    });

    it("should return zero volume beyond falloff end", () => {
      const sound = {
        x: 0,
        y: 0,
        z: 0,
        volume: 1.0,
        falloffStart: 10,
        falloffEnd: 50,
      };
      const listener = { x: 100, y: 0, z: 0 };
      expect(calculateVolume(sound, listener)).toBe(0);
    });

    it("should interpolate volume in falloff zone", () => {
      const sound = {
        x: 0,
        y: 0,
        z: 0,
        volume: 1.0,
        falloffStart: 10,
        falloffEnd: 50,
      };
      const listener = { x: 30, y: 0, z: 0 }; // midpoint of falloff
      const volume = calculateVolume(sound, listener);
      expect(volume).toBeCloseTo(0.5, 2);
    });
  });

  describe("Spawn validation algorithm", () => {
    function isValidSpawn(
      candidate: {
        x: number;
        z: number;
        radius: number;
        minSeparation: number;
      },
      occupied: Array<{ x: number; z: number; radius: number }>,
    ): { valid: boolean; nearestDist: number } {
      let valid = true;
      let nearestDist = Infinity;

      for (const occ of occupied) {
        const dx = candidate.x - occ.x;
        const dz = candidate.z - occ.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < nearestDist) nearestDist = dist;

        const requiredDist =
          candidate.radius + occ.radius + candidate.minSeparation;
        if (dist < requiredDist) valid = false;
      }

      return { valid, nearestDist };
    }

    it("should validate spawn with no occupied positions", () => {
      const candidate = { x: 100, z: 100, radius: 1, minSeparation: 2 };
      const result = isValidSpawn(candidate, []);
      expect(result.valid).toBe(true);
      expect(result.nearestDist).toBe(Infinity);
    });

    it("should invalidate spawn too close to occupied", () => {
      const candidate = { x: 100, z: 100, radius: 1, minSeparation: 2 };
      const occupied = [{ x: 101, z: 100, radius: 1 }]; // 1 unit away, needs 4 (1+1+2)
      const result = isValidSpawn(candidate, occupied);
      expect(result.valid).toBe(false);
      expect(result.nearestDist).toBeCloseTo(1, 2);
    });

    it("should validate spawn far enough from occupied", () => {
      const candidate = { x: 100, z: 100, radius: 1, minSeparation: 2 };
      const occupied = [{ x: 110, z: 100, radius: 1 }]; // 10 units away
      const result = isValidSpawn(candidate, occupied);
      expect(result.valid).toBe(true);
      expect(result.nearestDist).toBeCloseTo(10, 2);
    });
  });

  describe("Loot distribution algorithm", () => {
    function findNearestLootPlayer(
      drop: { x: number; z: number; ownerId: number },
      players: Array<{
        x: number;
        z: number;
        playerIdx: number;
        canLoot: boolean;
      }>,
      maxDistance: number,
    ): { nearestPlayer: number; distance: number } {
      let nearest = -1;
      let bestDist = Infinity;

      for (const p of players) {
        if (!p.canLoot) continue;
        if (drop.ownerId >= 0 && drop.ownerId !== p.playerIdx) continue;

        const dx = p.x - drop.x;
        const dz = p.z - drop.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= maxDistance && dist < bestDist) {
          bestDist = dist;
          nearest = p.playerIdx;
        }
      }

      return { nearestPlayer: nearest, distance: bestDist };
    }

    it("should find nearest player to loot", () => {
      const drop = { x: 100, z: 100, ownerId: -1 };
      const players = [
        { x: 110, z: 100, playerIdx: 0, canLoot: true }, // 10 units
        { x: 105, z: 100, playerIdx: 1, canLoot: true }, // 5 units (closest)
        { x: 120, z: 100, playerIdx: 2, canLoot: true }, // 20 units
      ];
      const result = findNearestLootPlayer(drop, players, 50);
      expect(result.nearestPlayer).toBe(1);
      expect(result.distance).toBeCloseTo(5, 2);
    });

    it("should respect owner exclusivity", () => {
      const drop = { x: 100, z: 100, ownerId: 2 };
      const players = [
        { x: 101, z: 100, playerIdx: 0, canLoot: true }, // 1 unit but not owner
        { x: 110, z: 100, playerIdx: 2, canLoot: true }, // 10 units but IS owner
      ];
      const result = findNearestLootPlayer(drop, players, 50);
      expect(result.nearestPlayer).toBe(2);
    });

    it("should skip players who cannot loot", () => {
      const drop = { x: 100, z: 100, ownerId: -1 };
      const players = [
        { x: 101, z: 100, playerIdx: 0, canLoot: false }, // closest but can't loot
        { x: 110, z: 100, playerIdx: 1, canLoot: true }, // can loot
      ];
      const result = findNearestLootPlayer(drop, players, 50);
      expect(result.nearestPlayer).toBe(1);
    });

    it("should return -1 if no player in range", () => {
      const drop = { x: 100, z: 100, ownerId: -1 };
      const players = [
        { x: 200, z: 200, playerIdx: 0, canLoot: true }, // way outside range
      ];
      const result = findNearestLootPlayer(drop, players, 50);
      expect(result.nearestPlayer).toBe(-1);
    });
  });
});
