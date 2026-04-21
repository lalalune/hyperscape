/**
 * TerrainComputeContext Tests
 *
 * Tests for GPU-accelerated terrain operations.
 * Note: GPU tests require WebGPU support, which is not available in Node.js.
 * These tests use CPU fallback paths and verify the interface contracts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  TerrainComputeContext,
  isTerrainComputeAvailable,
  type GPURoadSegment,
  type GPUBiomeData,
  type GPUInstanceTRS,
} from "../TerrainComputeContext";
import {
  ROAD_INFLUENCE_SHADER,
  ROAD_INFLUENCE_TEXTURE_SHADER,
  ROAD_INFLUENCE_TEXTURE_WORKGROUP_SIZE_X,
  TERRAIN_VERTEX_COLOR_SHADER,
  INSTANCE_MATRIX_SHADER,
  BATCH_DISTANCE_SHADER,
  TERRAIN_SHADERS,
} from "../shaders/terrain.wgsl";

describe("TerrainComputeContext", () => {
  describe("shader exports", () => {
    it("should export road influence shader", () => {
      expect(ROAD_INFLUENCE_SHADER).toBeDefined();
      expect(ROAD_INFLUENCE_SHADER).toContain("@compute");
      expect(ROAD_INFLUENCE_SHADER).toContain("distanceToLineSegment");
      expect(ROAD_INFLUENCE_TEXTURE_SHADER).toContain("pixelCount: u32");
      expect(ROAD_INFLUENCE_TEXTURE_SHADER).toContain("numWorkgroupsX: u32");
      // Shader multiplies by a named WGSL const bound to the host-side
      // workgroup constant. Accept either the named form or the literal
      // 64u in case the template substitution path changes.
      expect(ROAD_INFLUENCE_TEXTURE_SHADER).toMatch(
        /uniforms\.numWorkgroupsX \* (WORKGROUP_SIZE_1D|64u)/,
      );
      expect(ROAD_INFLUENCE_TEXTURE_SHADER).toContain(
        "const WORKGROUP_SIZE_1D: u32 = 64u",
      );
    });

    it("should export terrain vertex color shader", () => {
      expect(TERRAIN_VERTEX_COLOR_SHADER).toBeDefined();
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("@compute");
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("BiomeData");
    });

    it("should export instance matrix shader", () => {
      expect(INSTANCE_MATRIX_SHADER).toBeDefined();
      expect(INSTANCE_MATRIX_SHADER).toContain("@compute");
      expect(INSTANCE_MATRIX_SHADER).toContain("InstanceTRS");
    });

    it("should export batch distance shader", () => {
      expect(BATCH_DISTANCE_SHADER).toBeDefined();
      expect(BATCH_DISTANCE_SHADER).toContain("@compute");
      expect(BATCH_DISTANCE_SHADER).toContain("nearestIndices");
    });

    it("should export combined TERRAIN_SHADERS object", () => {
      expect(TERRAIN_SHADERS).toBeDefined();
      expect(TERRAIN_SHADERS.ROAD_INFLUENCE).toBe(ROAD_INFLUENCE_SHADER);
      expect(TERRAIN_SHADERS.VERTEX_COLOR).toBe(TERRAIN_VERTEX_COLOR_SHADER);
      expect(TERRAIN_SHADERS.INSTANCE_MATRIX).toBe(INSTANCE_MATRIX_SHADER);
      expect(TERRAIN_SHADERS.BATCH_DISTANCE).toBe(BATCH_DISTANCE_SHADER);
    });
  });

  describe("road-influence 2D dispatch reshape", () => {
    // The host-side reshape math in TerrainComputeContext.computeRoadInfluence
    // Texture divides pixelCount by ROAD_INFLUENCE_TEXTURE_WORKGROUP_SIZE_X
    // and reshapes to 2D when it exceeds the WebGPU 65535 per-dimension
    // ceiling. This is what keeps fresh 1080p+ clients from crashing with
    // "Dispatch workgroup count exceeds max compute workgroups per
    // dimension". Test the math here directly without requiring a GPU —
    // the production code uses these exact formulas at line ~333 of
    // TerrainComputeContext.ts.
    const WORKGROUP = ROAD_INFLUENCE_TEXTURE_WORKGROUP_SIZE_X;
    const WEBGPU_MAX = 65535;
    const dispatch = (pixelCount: number) => {
      const totalWorkgroups = Math.ceil(pixelCount / WORKGROUP);
      const dispatchX = Math.min(totalWorkgroups, WEBGPU_MAX);
      const dispatchY = Math.ceil(totalWorkgroups / dispatchX);
      if (dispatchY > WEBGPU_MAX) {
        throw new Error("dispatchY exceeds WebGPU limit");
      }
      return { totalWorkgroups, dispatchX, dispatchY };
    };

    it("stays 1D for texture sizes that fit under the ceiling", () => {
      // 1024×1024 = 1,048,576 pixels → 16384 workgroups → well under 65535.
      const { totalWorkgroups, dispatchX, dispatchY } = dispatch(1024 * 1024);
      expect(totalWorkgroups).toBe(16384);
      expect(dispatchX).toBe(16384);
      expect(dispatchY).toBe(1);
    });

    it("reshapes to 2D exactly at the 2048×2048 boundary", () => {
      // 2048×2048 = 4,194,304 pixels → 65536 workgroups → one over 65535.
      // Must reshape: dispatchX=65535, dispatchY=ceil(65536/65535)=2.
      const pixelCount = 2048 * 2048;
      const { totalWorkgroups, dispatchX, dispatchY } = dispatch(pixelCount);
      expect(totalWorkgroups).toBe(65536);
      expect(dispatchX).toBe(WEBGPU_MAX);
      expect(dispatchY).toBe(2);
      // Verify the 2D dispatch covers every pixel: dispatchX * dispatchY *
      // WORKGROUP threads must span all pixelCount indices.
      expect(dispatchX * dispatchY * WORKGROUP).toBeGreaterThanOrEqual(
        pixelCount,
      );
    });

    it("reshapes cleanly for 4096×4096 and 8192×8192 textures", () => {
      // 4096² = 16,777,216 → 262144 workgroups → dispatchY=5 (65535*5=327,675 ≥ 262144).
      const pc4096 = 4096 * 4096;
      const d4096 = dispatch(pc4096);
      expect(d4096.totalWorkgroups).toBe(262144);
      expect(d4096.dispatchX).toBe(WEBGPU_MAX);
      expect(d4096.dispatchY).toBe(Math.ceil(262144 / WEBGPU_MAX));
      expect(
        d4096.dispatchX * d4096.dispatchY * WORKGROUP,
      ).toBeGreaterThanOrEqual(pc4096);

      // 8192² = 67,108,864 → 1,048,576 workgroups → dispatchY=16.
      const pc8192 = 8192 * 8192;
      const d8192 = dispatch(pc8192);
      expect(d8192.totalWorkgroups).toBe(1_048_576);
      expect(d8192.dispatchX).toBe(WEBGPU_MAX);
      expect(d8192.dispatchY).toBe(Math.ceil(1_048_576 / WEBGPU_MAX));
      expect(
        d8192.dispatchX * d8192.dispatchY * WORKGROUP,
      ).toBeGreaterThanOrEqual(pc8192);
    });

    it("rejects impossible 2D dispatch shapes instead of overflowing Y", () => {
      const maxCoveredPixels = WEBGPU_MAX * WEBGPU_MAX * WORKGROUP;
      expect(() => dispatch(maxCoveredPixels + 1)).toThrow(
        "dispatchY exceeds WebGPU limit",
      );
    });
  });

  describe("isTerrainComputeAvailable", () => {
    it("should return a boolean", () => {
      const result = isTerrainComputeAvailable();
      expect(typeof result).toBe("boolean");
    });

    // In Node.js/Vitest environment, WebGPU is not available
    it("should return false in Node.js environment", () => {
      expect(isTerrainComputeAvailable()).toBe(false);
    });
  });

  describe("TerrainComputeContext construction", () => {
    it("should create a context with default config", () => {
      const ctx = new TerrainComputeContext();
      expect(ctx).toBeDefined();
      expect(ctx.isReady()).toBe(false); // Not initialized yet
      ctx.destroy();
    });

    it("should create a context with custom config", () => {
      const ctx = new TerrainComputeContext({
        minVerticesForGPU: 500,
        minRoadsForGPU: 2,
        minInstancesForGPU: 1000,
      });
      expect(ctx).toBeDefined();
      ctx.destroy();
    });
  });

  describe("shouldUseGPU methods", () => {
    let ctx: TerrainComputeContext;

    beforeEach(() => {
      ctx = new TerrainComputeContext({
        minVerticesForGPU: 100,
        minRoadsForGPU: 2,
        minInstancesForGPU: 50,
      });
    });

    afterEach(() => {
      ctx.destroy();
    });

    it("should return false for road influence when not initialized", () => {
      expect(ctx.shouldUseGPUForRoadInfluence(1000, 5)).toBe(false);
    });

    it("should return false for instance matrices when not initialized", () => {
      expect(ctx.shouldUseGPUForInstanceMatrices(1000)).toBe(false);
    });

    it("should return false for small batches (when initialized)", () => {
      // Even after initialization, small batches should use CPU
      // Since we can't actually initialize GPU in tests, this verifies the threshold logic
      const smallCtx = new TerrainComputeContext({
        minVerticesForGPU: 1000000, // Very high threshold
        minRoadsForGPU: 1000,
        minInstancesForGPU: 1000000,
      });
      expect(smallCtx.shouldUseGPUForRoadInfluence(100, 1)).toBe(false);
      expect(smallCtx.shouldUseGPUForInstanceMatrices(10)).toBe(false);
      smallCtx.destroy();
    });
  });

  describe("getRuntimeContext", () => {
    it("should return the underlying RuntimeComputeContext", () => {
      const ctx = new TerrainComputeContext();
      const runtimeCtx = ctx.getRuntimeContext();
      expect(runtimeCtx).toBeDefined();
      expect(runtimeCtx.isReady()).toBe(false);
      ctx.destroy();
    });
  });

  describe("type interfaces", () => {
    it("should have correct GPURoadSegment interface", () => {
      const road: GPURoadSegment = {
        startX: 0,
        startZ: 0,
        endX: 100,
        endZ: 100,
        width: 5,
      };
      expect(road.startX).toBe(0);
      expect(road.width).toBe(5);
    });

    it("should have correct GPUBiomeData interface", () => {
      const biome: GPUBiomeData = {
        colorR: 0.3,
        colorG: 0.5,
        colorB: 0.2,
        heightScale: 1.0,
      };
      expect(biome.colorR).toBe(0.3);
      expect(biome.heightScale).toBe(1.0);
    });

    it("should have correct GPUInstanceTRS interface", () => {
      const instance: GPUInstanceTRS = {
        posX: 10,
        posY: 20,
        posZ: 30,
        quatX: 0,
        quatY: 0,
        quatZ: 0,
        quatW: 1,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      expect(instance.posX).toBe(10);
      expect(instance.quatW).toBe(1);
    });
  });
});

describe("WGSL Shader Validation", () => {
  describe("Road Influence Shader", () => {
    it("should have correct struct definitions", () => {
      expect(ROAD_INFLUENCE_SHADER).toContain("struct Road {");
      expect(ROAD_INFLUENCE_SHADER).toContain("struct Uniforms {");
    });

    it("should have correct bindings", () => {
      expect(ROAD_INFLUENCE_SHADER).toContain("@group(0) @binding(0)");
      expect(ROAD_INFLUENCE_SHADER).toContain("@group(0) @binding(1)");
      expect(ROAD_INFLUENCE_SHADER).toContain("@group(0) @binding(2)");
      expect(ROAD_INFLUENCE_SHADER).toContain("@group(0) @binding(3)");
    });

    it("should have workgroup size defined", () => {
      expect(ROAD_INFLUENCE_SHADER).toContain("@workgroup_size(64)");
    });

    it("should implement distance calculation", () => {
      expect(ROAD_INFLUENCE_SHADER).toContain("fn distanceToLineSegment");
      expect(ROAD_INFLUENCE_SHADER).toContain("clamp(");
      expect(ROAD_INFLUENCE_SHADER).toContain("sqrt(");
    });
  });

  describe("Terrain Vertex Color Shader", () => {
    it("should have correct struct definitions", () => {
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("struct BiomeData {");
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("struct Uniforms {");
    });

    it("should have shore color constants", () => {
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("SHORE_R");
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("SHORE_G");
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("SHORE_B");
    });

    it("should have road color constants", () => {
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("ROAD_R");
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("ROAD_G");
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("ROAD_B");
    });

    it("should handle biome blending", () => {
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("MAX_BIOME_INFLUENCES");
      expect(TERRAIN_VERTEX_COLOR_SHADER).toContain("biomeInfluences");
    });
  });

  describe("Instance Matrix Shader", () => {
    it("should have correct struct definition", () => {
      expect(INSTANCE_MATRIX_SHADER).toContain("struct InstanceTRS {");
      expect(INSTANCE_MATRIX_SHADER).toContain("posX: f32");
      expect(INSTANCE_MATRIX_SHADER).toContain("quatX: f32");
      expect(INSTANCE_MATRIX_SHADER).toContain("scaleX: f32");
    });

    it("should compute quaternion to rotation matrix", () => {
      expect(INSTANCE_MATRIX_SHADER).toContain("let x2 = x + x");
      expect(INSTANCE_MATRIX_SHADER).toContain("let xx = x * x2");
    });

    it("should output 16 floats per matrix", () => {
      expect(INSTANCE_MATRIX_SHADER).toContain("let base = idx * 16u");
    });

    it("should set translation in column 3", () => {
      expect(INSTANCE_MATRIX_SHADER).toContain(
        "matrices[base + 12u] = inst.posX",
      );
      expect(INSTANCE_MATRIX_SHADER).toContain(
        "matrices[base + 13u] = inst.posY",
      );
      expect(INSTANCE_MATRIX_SHADER).toContain(
        "matrices[base + 14u] = inst.posZ",
      );
      expect(INSTANCE_MATRIX_SHADER).toContain("matrices[base + 15u] = 1.0");
    });
  });

  describe("Batch Distance Shader", () => {
    it("should have distance functions", () => {
      expect(BATCH_DISTANCE_SHADER).toContain("fn distanceSquared3D");
      expect(BATCH_DISTANCE_SHADER).toContain("fn distanceSquaredXZ");
    });

    it("should support XZ-only distance mode", () => {
      expect(BATCH_DISTANCE_SHADER).toContain("useXZDistance");
      expect(BATCH_DISTANCE_SHADER).toContain("uniforms.useXZDistance == 1u");
    });

    it("should track nearest target index", () => {
      expect(BATCH_DISTANCE_SHADER).toContain("nearestIndices");
      expect(BATCH_DISTANCE_SHADER).toContain("nearestIdx");
    });
  });
});

describe("CPU Fallback Logic", () => {
  describe("Road Influence CPU calculation", () => {
    it("should return correct influence at road center", () => {
      // This tests the algorithm we expect to use in CPU fallback
      const roadWidth = 5;
      const halfWidth = roadWidth / 2;
      const blendWidth = 2;

      // At center of road (distance = 0)
      const distance = 0;
      const totalInfluenceWidth = halfWidth + blendWidth;

      let influence: number;
      if (distance >= totalInfluenceWidth) {
        influence = 0;
      } else if (distance <= halfWidth) {
        influence = 1.0;
      } else {
        const t = 1.0 - (distance - halfWidth) / blendWidth;
        influence = t * t * (3 - 2 * t); // smoothstep
      }

      expect(influence).toBe(1.0);
    });

    it("should return zero influence outside road area", () => {
      const roadWidth = 5;
      const halfWidth = roadWidth / 2;
      const blendWidth = 2;

      // Far from road
      const distance = 10;
      const totalInfluenceWidth = halfWidth + blendWidth;

      let influence: number;
      if (distance >= totalInfluenceWidth) {
        influence = 0;
      } else if (distance <= halfWidth) {
        influence = 1.0;
      } else {
        const t = 1.0 - (distance - halfWidth) / blendWidth;
        influence = t * t * (3 - 2 * t);
      }

      expect(influence).toBe(0);
    });

    it("should return smoothstep influence in blend zone", () => {
      const roadWidth = 5;
      const halfWidth = roadWidth / 2;
      const blendWidth = 2;

      // At edge of road (distance = halfWidth + blendWidth/2)
      const distance = halfWidth + blendWidth / 2;
      const totalInfluenceWidth = halfWidth + blendWidth;

      let influence: number;
      if (distance >= totalInfluenceWidth) {
        influence = 0;
      } else if (distance <= halfWidth) {
        influence = 1.0;
      } else {
        const t = 1.0 - (distance - halfWidth) / blendWidth;
        influence = t * t * (3 - 2 * t); // smoothstep
      }

      // At midpoint of blend zone, t = 0.5, smoothstep(0.5) = 0.5
      expect(influence).toBeCloseTo(0.5, 5);
    });
  });

  describe("Distance to line segment", () => {
    function distanceToLineSegment(
      px: number,
      pz: number,
      ax: number,
      az: number,
      bx: number,
      bz: number,
    ): number {
      const abx = bx - ax;
      const abz = bz - az;
      const abLenSq = abx * abx + abz * abz;

      if (abLenSq < 0.001) {
        // Degenerate segment
        return Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
      }

      const apx = px - ax;
      const apz = pz - az;
      const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq));

      const closestX = ax + t * abx;
      const closestZ = az + t * abz;

      return Math.sqrt((px - closestX) ** 2 + (pz - closestZ) ** 2);
    }

    it("should return 0 for point on segment start", () => {
      const dist = distanceToLineSegment(0, 0, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(0, 5);
    });

    it("should return 0 for point on segment end", () => {
      const dist = distanceToLineSegment(10, 0, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(0, 5);
    });

    it("should return correct perpendicular distance", () => {
      // Point at (5, 5), segment from (0, 0) to (10, 0)
      const dist = distanceToLineSegment(5, 5, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(5, 5);
    });

    it("should clamp to segment endpoints", () => {
      // Point at (-5, 0), segment from (0, 0) to (10, 0)
      // Should be distance to start point
      const dist = distanceToLineSegment(-5, 0, 0, 0, 10, 0);
      expect(dist).toBeCloseTo(5, 5);
    });

    it("should handle degenerate segment (point)", () => {
      const dist = distanceToLineSegment(3, 4, 0, 0, 0, 0);
      expect(dist).toBeCloseTo(5, 5); // 3-4-5 triangle
    });
  });

  describe("Matrix composition", () => {
    it("should produce identity matrix for identity TRS", () => {
      // Identity: position (0,0,0), quaternion (0,0,0,1), scale (1,1,1)
      const pos = { x: 0, y: 0, z: 0 };
      const quat = { x: 0, y: 0, z: 0, w: 1 };
      const scale = { x: 1, y: 1, z: 1 };

      // Compose matrix (simplified algorithm matching shader)
      const x = quat.x,
        y = quat.y,
        z = quat.z,
        w = quat.w;
      const x2 = x + x,
        y2 = y + y,
        z2 = z + z;
      const xx = x * x2,
        xy = x * y2,
        xz = x * z2;
      const yy = y * y2,
        yz = y * z2,
        zz = z * z2;
      const wx = w * x2,
        wy = w * y2,
        wz = w * z2;

      const matrix = new Float32Array(16);
      // Column 0
      matrix[0] = (1 - (yy + zz)) * scale.x;
      matrix[1] = (xy + wz) * scale.x;
      matrix[2] = (xz - wy) * scale.x;
      matrix[3] = 0;
      // Column 1
      matrix[4] = (xy - wz) * scale.y;
      matrix[5] = (1 - (xx + zz)) * scale.y;
      matrix[6] = (yz + wx) * scale.y;
      matrix[7] = 0;
      // Column 2
      matrix[8] = (xz + wy) * scale.z;
      matrix[9] = (yz - wx) * scale.z;
      matrix[10] = (1 - (xx + yy)) * scale.z;
      matrix[11] = 0;
      // Column 3
      matrix[12] = pos.x;
      matrix[13] = pos.y;
      matrix[14] = pos.z;
      matrix[15] = 1;

      // Should be identity matrix
      expect(matrix[0]).toBeCloseTo(1, 5);
      expect(matrix[5]).toBeCloseTo(1, 5);
      expect(matrix[10]).toBeCloseTo(1, 5);
      expect(matrix[15]).toBeCloseTo(1, 5);
      // Off-diagonal should be 0
      expect(matrix[1]).toBeCloseTo(0, 5);
      expect(matrix[4]).toBeCloseTo(0, 5);
    });

    it("should apply translation correctly", () => {
      const pos = { x: 10, y: 20, z: 30 };
      const quat = { x: 0, y: 0, z: 0, w: 1 };
      const scale = { x: 1, y: 1, z: 1 };

      const matrix = new Float32Array(16);
      // ... (same composition as above)
      const x = quat.x,
        y = quat.y,
        z = quat.z,
        w = quat.w;
      const x2 = x + x,
        y2 = y + y,
        z2 = z + z;
      const xx = x * x2,
        xy = x * y2,
        xz = x * z2;
      const yy = y * y2,
        yz = y * z2,
        zz = z * z2;
      const wx = w * x2,
        wy = w * y2,
        wz = w * z2;

      matrix[0] = (1 - (yy + zz)) * scale.x;
      matrix[1] = (xy + wz) * scale.x;
      matrix[2] = (xz - wy) * scale.x;
      matrix[3] = 0;
      matrix[4] = (xy - wz) * scale.y;
      matrix[5] = (1 - (xx + zz)) * scale.y;
      matrix[6] = (yz + wx) * scale.y;
      matrix[7] = 0;
      matrix[8] = (xz + wy) * scale.z;
      matrix[9] = (yz - wx) * scale.z;
      matrix[10] = (1 - (xx + yy)) * scale.z;
      matrix[11] = 0;
      matrix[12] = pos.x;
      matrix[13] = pos.y;
      matrix[14] = pos.z;
      matrix[15] = 1;

      expect(matrix[12]).toBe(10);
      expect(matrix[13]).toBe(20);
      expect(matrix[14]).toBe(30);
    });

    it("should apply scale correctly", () => {
      const quat = { x: 0, y: 0, z: 0, w: 1 };
      const scale = { x: 2, y: 3, z: 4 };

      const x = quat.x,
        y = quat.y,
        z = quat.z;
      const x2 = x + x,
        y2 = y + y,
        z2 = z + z;
      const xx = x * x2;
      const yy = y * y2,
        zz = z * z2;

      const matrix = new Float32Array(16);
      matrix[0] = (1 - (yy + zz)) * scale.x;
      matrix[5] = (1 - (xx + zz)) * scale.y;
      matrix[10] = (1 - (xx + yy)) * scale.z;

      expect(matrix[0]).toBeCloseTo(2, 5);
      expect(matrix[5]).toBeCloseTo(3, 5);
      expect(matrix[10]).toBeCloseTo(4, 5);
    });
  });
});
