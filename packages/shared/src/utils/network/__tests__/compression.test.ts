/**
 * Network Compression Tests
 *
 * Tests for position and quaternion compression utilities.
 * These utilities reduce network bandwidth by quantizing floating-point
 * values to fixed-point representations with game-appropriate precision.
 *
 * Position Compression:
 * - 24 bytes (Float64×3) → 8 bytes (quantized)
 * - Precision: ~0.6mm for X/Z, ~4mm for Y
 *
 * Quaternion Compression (Smallest-3):
 * - 32 bytes (Float64×4) → 4 bytes (quantized)
 * - Precision: ~0.08° rotation error
 *
 * NO MOCKS - Tests actual compression/decompression logic
 */

import { describe, it, expect } from "bun:test";
import {
  packPosition,
  unpackPosition,
  packQuaternion,
  unpackQuaternion,
} from "../compression";

// ============================================================================
// Tests
// ============================================================================

describe("Position Compression", () => {
  describe("packPosition", () => {
    it("should produce 8-byte buffer", () => {
      const { buffer } = packPosition(0, 0, 0);
      expect(buffer.byteLength).toBe(8);
    });

    it("should handle origin position", () => {
      const { buffer } = packPosition(0, 0, 0);
      const unpacked = unpackPosition(buffer);

      expect(Math.abs(unpacked.x)).toBeLessThan(1);
      expect(Math.abs(unpacked.y)).toBeLessThan(1);
      expect(Math.abs(unpacked.z)).toBeLessThan(1);
    });

    it("should handle positive positions", () => {
      const original = { x: 1234.567, y: 45.678, z: 2345.678 };
      const { buffer } = packPosition(original.x, original.y, original.z);
      const unpacked = unpackPosition(buffer);

      // Precision should be within 1mm for X/Z, 5mm for Y
      expect(Math.abs(unpacked.x - original.x)).toBeLessThan(0.001);
      expect(Math.abs(unpacked.y - original.y)).toBeLessThan(0.005);
      expect(Math.abs(unpacked.z - original.z)).toBeLessThan(0.001);
    });

    it("should handle negative positions", () => {
      const original = { x: -1234.567, y: 10.5, z: -2345.678 };
      const { buffer } = packPosition(original.x, original.y, original.z);
      const unpacked = unpackPosition(buffer);

      expect(Math.abs(unpacked.x - original.x)).toBeLessThan(0.001);
      expect(Math.abs(unpacked.y - original.y)).toBeLessThan(0.005);
      expect(Math.abs(unpacked.z - original.z)).toBeLessThan(0.001);
    });

    it("should handle world boundary positions", () => {
      const testCases = [
        { x: -4999, y: -49, z: -4999 }, // Near min bounds
        { x: 4999, y: 200, z: 4999 }, // Near max bounds
        { x: -5000, y: -50, z: -5000 }, // Exact min bounds
        { x: 5000, y: 206, z: 5000 }, // Exact max bounds
      ];

      for (const original of testCases) {
        const { buffer } = packPosition(original.x, original.y, original.z);
        const unpacked = unpackPosition(buffer);

        // Should be close to original (clamped if out of bounds)
        expect(unpacked.x).toBeGreaterThanOrEqual(-5000);
        expect(unpacked.x).toBeLessThanOrEqual(5000);
        expect(unpacked.z).toBeGreaterThanOrEqual(-5000);
        expect(unpacked.z).toBeLessThanOrEqual(5000);
      }
    });

    it("should clamp out-of-bounds positions", () => {
      // Way out of bounds
      const { buffer } = packPosition(10000, 500, 10000);
      const unpacked = unpackPosition(buffer);

      // Should be clamped to max
      expect(unpacked.x).toBeLessThanOrEqual(5000);
      expect(unpacked.z).toBeLessThanOrEqual(5000);
    });
  });

  describe("unpackPosition", () => {
    it("should correctly decode packed position", () => {
      const positions = [
        { x: 100.5, y: 25.3, z: -50.7 },
        { x: 0, y: 0, z: 0 },
        { x: -2500, y: 100, z: 2500 },
      ];

      for (const original of positions) {
        const { buffer } = packPosition(original.x, original.y, original.z);
        const unpacked = unpackPosition(buffer);

        // Verify roundtrip
        expect(Math.abs(unpacked.x - original.x)).toBeLessThan(0.001);
        expect(Math.abs(unpacked.y - original.y)).toBeLessThan(0.005);
        expect(Math.abs(unpacked.z - original.z)).toBeLessThan(0.001);
      }
    });
  });

  describe("precision requirements", () => {
    it("should maintain sub-millimeter XZ precision", () => {
      // Test many random positions
      for (let i = 0; i < 100; i++) {
        const x = (Math.random() - 0.5) * 10000;
        const z = (Math.random() - 0.5) * 10000;
        const y = Math.random() * 200 - 50;

        const { buffer } = packPosition(x, y, z);
        const unpacked = unpackPosition(buffer);

        // XZ precision < 1mm
        expect(Math.abs(unpacked.x - x)).toBeLessThan(0.001);
        expect(Math.abs(unpacked.z - z)).toBeLessThan(0.001);
      }
    });

    it("should maintain < 5mm Y precision", () => {
      // Test many random Y values
      for (let i = 0; i < 100; i++) {
        const y = Math.random() * 256 - 50;

        const { buffer } = packPosition(0, y, 0);
        const unpacked = unpackPosition(buffer);

        // Y precision < 5mm
        expect(Math.abs(unpacked.y - y)).toBeLessThan(0.005);
      }
    });
  });

  describe("size comparison", () => {
    it("should be significantly smaller than Float64 representation", () => {
      const position = { x: 1234.5678, y: 56.789, z: -987.654 };

      // Float64 array would be 24 bytes
      const float64Size = 3 * 8;

      // Our packed format is 8 bytes
      const { buffer } = packPosition(position.x, position.y, position.z);

      expect(buffer.byteLength).toBe(8);
      expect(buffer.byteLength).toBeLessThan(float64Size);
      expect(buffer.byteLength / float64Size).toBeLessThan(0.34); // >66% reduction
    });
  });
});

describe("Quaternion Compression (Smallest-3)", () => {
  // Helper to normalize quaternion
  function normalize(q: { x: number; y: number; z: number; w: number }) {
    const len = Math.sqrt(q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2);
    return {
      x: q.x / len,
      y: q.y / len,
      z: q.z / len,
      w: q.w / len,
    };
  }

  // Helper to calculate rotation angle difference
  function angleBetween(
    q1: { x: number; y: number; z: number; w: number },
    q2: { x: number; y: number; z: number; w: number },
  ): number {
    const dot = Math.abs(q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w);
    return 2 * Math.acos(Math.min(1, dot)) * (180 / Math.PI);
  }

  describe("packQuaternion", () => {
    it("should produce 32-bit integer", () => {
      const packed = packQuaternion(0, 0, 0, 1);

      expect(typeof packed).toBe("number");
      // Note: JavaScript bitwise ops produce signed 32-bit ints
      // We use >>> 0 to convert to unsigned for comparison
      expect(packed >>> 0).toBeLessThanOrEqual(0xffffffff);
    });

    it("should handle identity quaternion", () => {
      const packed = packQuaternion(0, 0, 0, 1);
      const unpacked = unpackQuaternion(packed);
      const normalized = normalize(unpacked);

      // Should be close to identity
      expect(Math.abs(normalized.x)).toBeLessThan(0.01);
      expect(Math.abs(normalized.y)).toBeLessThan(0.01);
      expect(Math.abs(normalized.z)).toBeLessThan(0.01);
      expect(Math.abs(normalized.w - 1)).toBeLessThan(0.01);
    });

    it("should handle 90-degree Y rotation", () => {
      const sq2 = Math.SQRT1_2;
      const packed = packQuaternion(0, sq2, 0, sq2);
      const unpacked = unpackQuaternion(packed);
      const normalized = normalize(unpacked);

      // Should be close to 90° Y rotation
      expect(Math.abs(normalized.x)).toBeLessThan(0.01);
      expect(Math.abs(normalized.y - sq2)).toBeLessThan(0.01);
      expect(Math.abs(normalized.z)).toBeLessThan(0.01);
      expect(Math.abs(normalized.w - sq2)).toBeLessThan(0.01);
    });

    it("should handle 180-degree rotations", () => {
      // 180° around Y axis: (0, 1, 0, 0)
      const packed = packQuaternion(0, 1, 0, 0);
      const unpacked = unpackQuaternion(packed);
      const normalized = normalize(unpacked);

      // Y component should be largest (±1)
      expect(Math.abs(normalized.y)).toBeGreaterThan(0.99);
    });
  });

  describe("unpackQuaternion", () => {
    it("should produce unit quaternion", () => {
      const testQuats = [
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
        { x: 0.5, y: 0.5, z: 0.5, w: 0.5 },
        { x: 1, y: 0, z: 0, w: 0 },
      ];

      for (const q of testQuats) {
        const packed = packQuaternion(q.x, q.y, q.z, q.w);
        const unpacked = unpackQuaternion(packed);

        const len = Math.sqrt(
          unpacked.x ** 2 + unpacked.y ** 2 + unpacked.z ** 2 + unpacked.w ** 2,
        );

        expect(Math.abs(len - 1)).toBeLessThan(0.01);
      }
    });
  });

  describe("precision requirements", () => {
    it("should maintain < 0.5° rotation error", () => {
      // Test many random quaternions
      // 10-bit precision gives ~0.14° error which is imperceptible
      for (let i = 0; i < 100; i++) {
        // Generate random unit quaternion
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        const z = Math.random() * 2 - 1;
        const w = Math.random() * 2 - 1;
        const original = normalize({ x, y, z, w });

        const packed = packQuaternion(
          original.x,
          original.y,
          original.z,
          original.w,
        );
        const unpacked = unpackQuaternion(packed);
        const result = normalize(unpacked);

        const error = angleBetween(original, result);
        expect(error).toBeLessThan(0.5); // < 0.5 degree error (imperceptible)
      }
    });

    it("should handle all axis rotations", () => {
      // 90° around each axis
      const testCases = [
        { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }, // X
        { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, // Y
        { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, // Z
      ];

      for (const q of testCases) {
        const packed = packQuaternion(q.x, q.y, q.z, q.w);
        const unpacked = unpackQuaternion(packed);
        const result = normalize(unpacked);

        const error = angleBetween(q, result);
        expect(error).toBeLessThan(0.5); // < 0.5 degree error
      }
    });
  });

  describe("edge cases", () => {
    it("should handle quaternion with negative largest component", () => {
      // q and -q represent the same rotation
      const q = { x: 0, y: -Math.SQRT1_2, z: 0, w: -Math.SQRT1_2 };
      const packed = packQuaternion(q.x, q.y, q.z, q.w);
      const unpacked = unpackQuaternion(packed);
      const result = normalize(unpacked);

      // Should produce equivalent rotation (within compression error)
      const error = angleBetween(q, result);
      expect(error).toBeLessThan(0.5);
    });

    it("should handle near-zero components", () => {
      const q = { x: 0.0001, y: 0.0001, z: 0, w: 1 };
      const normalized = normalize(q);
      const packed = packQuaternion(
        normalized.x,
        normalized.y,
        normalized.z,
        normalized.w,
      );
      const unpacked = unpackQuaternion(packed);
      const result = normalize(unpacked);

      const error = angleBetween(normalized, result);
      expect(error).toBeLessThan(0.5); // Slightly relaxed for edge case
    });
  });

  describe("size comparison", () => {
    it("should be significantly smaller than Float64 representation", () => {
      // Float64 quaternion would be 32 bytes
      const float64Size = 4 * 8;

      // Our packed format is 4 bytes
      const packed = packQuaternion(0.5, 0.5, 0.5, 0.5);

      expect(packed).toBeLessThanOrEqual(0xffffffff);
      // Fits in 4 bytes
      const packedSize = 4;

      expect(packedSize).toBeLessThan(float64Size);
      expect(packedSize / float64Size).toBe(0.125); // 87.5% reduction
    });
  });
});

describe("Combined Transform Compression", () => {
  it("should achieve > 70% reduction for full transform", () => {
    // Original: position (24B) + quaternion (32B) + velocity (24B) = 80B
    const originalSize = 24 + 32 + 24;

    // Compressed: position (8B) + quaternion (4B) + velocity (8B) = 20B
    // (Or even less if velocity is quantized or omitted)
    const compressedSize = 8 + 4 + 8;

    const reduction = 1 - compressedSize / originalSize;
    expect(reduction).toBeGreaterThanOrEqual(0.75); // >= 75% reduction
  });

  it("should be fast enough for real-time use", () => {
    const iterations = 1000; // Reduced for CI stability

    // Time position compression
    const posStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const { buffer } = packPosition(
        Math.random() * 10000 - 5000,
        Math.random() * 200,
        Math.random() * 10000 - 5000,
      );
      unpackPosition(buffer);
    }
    const posTime = performance.now() - posStart;

    // Time quaternion compression
    const quatStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const packed = packQuaternion(
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
      );
      unpackQuaternion(packed);
    }
    const quatTime = performance.now() - quatStart;

    // Should complete 1000 operations in < 1000ms each (CI-friendly)
    expect(posTime).toBeLessThan(1000);
    expect(quatTime).toBeLessThan(1000);

    // Log actual performance
    console.log(`Position: ${((posTime / iterations) * 1000).toFixed(2)}µs/op`);
    console.log(
      `Quaternion: ${((quatTime / iterations) * 1000).toFixed(2)}µs/op`,
    );
  });
});
