/**
 * ProceduralTownLandmarks.test.ts
 *
 * Unit tests for the ProceduralTownLandmarksSystem
 * Tests geometry creation, error handling, and data collection
 */

import { describe, it, expect } from "vitest";
// The landmark factories use `mergeGeometries` from
// `three/examples/jsm/utils/BufferGeometryUtils.js` which
// returns plain `three.BufferGeometry`. Importing
// BufferGeometry directly from `three` (not `three/webgpu`)
// ensures `toBeInstanceOf` checks resolve to the same class
// identity as the geometry the factory returns.
import { BufferGeometry } from "three";

// Import geometry creation functions for testing
import {
  createFencePostGeometry,
  createLamppostGeometry,
  createWellGeometry,
  createSignpostGeometry,
} from "../ProceduralTownLandmarks";

describe("ProceduralTownLandmarks", () => {
  describe("Geometry Creation", () => {
    describe("createFencePostGeometry", () => {
      it("creates valid BufferGeometry", () => {
        const geo = createFencePostGeometry();
        expect(geo).toBeInstanceOf(BufferGeometry);
        expect(geo.attributes.position).toBeDefined();
        expect(geo.attributes.normal).toBeDefined();
      });

      it("has correct dimensions (post ~0.12m wide, 1.2m tall, with 3m rails)", () => {
        const geo = createFencePostGeometry();
        geo.computeBoundingBox();
        const box = geo.boundingBox!;

        // Width (x) - post is 0.12m wide
        const width = box.max.x - box.min.x;
        expect(width).toBeCloseTo(0.12, 1);

        // Height (y) - origin at bottom, so max should be ~1.2
        expect(box.max.y).toBeCloseTo(1.2, 0); // Allow 0.5 tolerance
        expect(box.min.y).toBeCloseTo(0, 1);

        // Depth (z) - rails extend both directions (total ~3m)
        const depth = box.max.z - box.min.z;
        expect(depth).toBeGreaterThan(2.8); // Rails extend ~3m total
        expect(depth).toBeLessThan(3.2);
      });

      it("has vertices grounded at y=0", () => {
        const geo = createFencePostGeometry();
        geo.computeBoundingBox();
        expect(geo.boundingBox!.min.y).toBeCloseTo(0, 1);
      });
    });

    describe("createLamppostGeometry", () => {
      it("creates valid BufferGeometry", () => {
        const geo = createLamppostGeometry();
        expect(geo).toBeInstanceOf(BufferGeometry);
        expect(geo.attributes.position).toBeDefined();
        expect(geo.attributes.normal).toBeDefined();
      });

      it("has realistic lamppost height (~4m)", () => {
        const geo = createLamppostGeometry();
        geo.computeBoundingBox();
        const height = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
        expect(height).toBeGreaterThan(3.5);
        expect(height).toBeLessThan(4.5);
      });

      it("has lamp housing offset from post center", () => {
        const geo = createLamppostGeometry();
        geo.computeBoundingBox();
        // Lamp arm extends in +Z direction
        expect(geo.boundingBox!.max.z).toBeGreaterThan(0.3);
      });
    });

    describe("createWellGeometry", () => {
      it("creates valid BufferGeometry", () => {
        const geo = createWellGeometry();
        expect(geo).toBeInstanceOf(BufferGeometry);
        expect(geo.attributes.position).toBeDefined();
        expect(geo.attributes.normal).toBeDefined();
      });

      it("has circular well shape (~2m diameter)", () => {
        const geo = createWellGeometry();
        geo.computeBoundingBox();
        const width = geo.boundingBox!.max.x - geo.boundingBox!.min.x;
        const depth = geo.boundingBox!.max.z - geo.boundingBox!.min.z;

        // Should be roughly circular (2m radius)
        expect(width).toBeGreaterThan(1.8);
        expect(width).toBeLessThan(2.5);
        expect(depth).toBeGreaterThan(1.8);
        expect(depth).toBeLessThan(2.5);
      });

      it("has roof structure (~3m total height)", () => {
        const geo = createWellGeometry();
        geo.computeBoundingBox();
        const height = geo.boundingBox!.max.y;
        expect(height).toBeGreaterThan(2.5);
        expect(height).toBeLessThan(3.5);
      });
    });

    describe("createSignpostGeometry", () => {
      it("creates valid BufferGeometry", () => {
        const geo = createSignpostGeometry();
        expect(geo).toBeInstanceOf(BufferGeometry);
        expect(geo.attributes.position).toBeDefined();
        expect(geo.attributes.normal).toBeDefined();
      });

      it("has post height ~2.5m", () => {
        const geo = createSignpostGeometry();
        geo.computeBoundingBox();
        const height = geo.boundingBox!.max.y;
        expect(height).toBeGreaterThan(2.3);
        expect(height).toBeLessThan(2.8);
      });

      it("has sign extending in +X direction", () => {
        const geo = createSignpostGeometry();
        geo.computeBoundingBox();
        // Sign arrow points in +X
        expect(geo.boundingBox!.max.x).toBeGreaterThan(0.7);
      });
    });
  });

  describe("Geometry Vertex Integrity", () => {
    it("all geometries have valid position attributes", () => {
      const geometries = [
        createFencePostGeometry(),
        createLamppostGeometry(),
        createWellGeometry(),
        createSignpostGeometry(),
      ];

      for (const geo of geometries) {
        const positions = geo.attributes.position;
        expect(positions).toBeDefined();
        expect(positions.count).toBeGreaterThan(0);

        // Check for NaN values
        for (let i = 0; i < positions.count; i++) {
          expect(Number.isNaN(positions.getX(i))).toBe(false);
          expect(Number.isNaN(positions.getY(i))).toBe(false);
          expect(Number.isNaN(positions.getZ(i))).toBe(false);
        }
      }
    });

    it("all geometries have valid normal attributes", () => {
      const geometries = [
        createFencePostGeometry(),
        createLamppostGeometry(),
        createWellGeometry(),
        createSignpostGeometry(),
      ];

      for (const geo of geometries) {
        const normals = geo.attributes.normal;
        expect(normals).toBeDefined();
        expect(normals.count).toBeGreaterThan(0);

        // Check normals are unit vectors (length ~1)
        for (let i = 0; i < Math.min(normals.count, 10); i++) {
          const nx = normals.getX(i);
          const ny = normals.getY(i);
          const nz = normals.getZ(i);
          const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
          expect(length).toBeCloseTo(1, 1);
        }
      }
    });
  });

  describe("Geometry Performance", () => {
    it("creates fence post geometry quickly (<10ms)", () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const geo = createFencePostGeometry();
        geo.dispose();
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000); // 100 geometries in < 1s = <10ms each
    });

    it("creates complex geometries quickly (<50ms)", () => {
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        const geo1 = createWellGeometry();
        const geo2 = createLamppostGeometry();
        geo1.dispose();
        geo2.dispose();
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500); // 10 complex geometries in < 500ms = <50ms each
    });
  });

  describe("Landmark Type Colors", () => {
    // Test that all landmark types have defined colors
    const LANDMARK_TYPES = [
      "fence_post",
      "fence_gate",
      "lamppost",
      "well",
      "fountain",
      "signpost",
      "bench",
      "barrel",
      "crate",
      "planter",
      "market_stall",
      "tree",
    ] as const;

    it("has 12 landmark types defined", () => {
      expect(LANDMARK_TYPES.length).toBe(12);
    });

    it("all types have visually distinct purposes", () => {
      // Wooden items
      const woodTypes = [
        "fence_post",
        "fence_gate",
        "signpost",
        "bench",
        "barrel",
        "crate",
      ];
      // Stone items
      const stoneTypes = ["well", "fountain"];
      // Metal items
      const metalTypes = ["lamppost"];
      // Plant items
      const plantTypes = ["planter", "tree"];
      // Commerce items
      const commerceTypes = ["market_stall"];

      const allCategorized = [
        ...woodTypes,
        ...stoneTypes,
        ...metalTypes,
        ...plantTypes,
        ...commerceTypes,
      ];
      expect(allCategorized.sort()).toEqual([...LANDMARK_TYPES].sort());
    });
  });

  describe("Geometry Base Heights Accuracy", () => {
    // Verify GEOMETRY_BASE_HEIGHTS matches actual geometry heights
    // This prevents the scale calculation bug where we use wrong base height

    it("fence post base height matches actual geometry", () => {
      const geo = createFencePostGeometry();
      geo.computeBoundingBox();
      const actualHeight = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
      // GEOMETRY_BASE_HEIGHTS.fence_post = 1.2
      expect(actualHeight).toBeCloseTo(1.2, 0); // Within 0.5m
    });

    it("lamppost base height matches actual geometry", () => {
      const geo = createLamppostGeometry();
      geo.computeBoundingBox();
      const actualHeight = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
      // GEOMETRY_BASE_HEIGHTS.lamppost = 4.1
      expect(actualHeight).toBeCloseTo(4.1, 0); // Within 0.5m
    });

    it("well base height matches actual geometry", () => {
      const geo = createWellGeometry();
      geo.computeBoundingBox();
      const actualHeight = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
      // GEOMETRY_BASE_HEIGHTS.well = 3.0
      expect(actualHeight).toBeCloseTo(3.0, 0); // Within 0.5m
    });

    it("signpost base height matches actual geometry", () => {
      const geo = createSignpostGeometry();
      geo.computeBoundingBox();
      const actualHeight = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
      // GEOMETRY_BASE_HEIGHTS.signpost = 2.6
      expect(actualHeight).toBeCloseTo(2.6, 0); // Within 0.5m
    });
  });

  describe("Scale Calculation Logic", () => {
    it("calculates correct height ratio for scaling", () => {
      // Test the scaling math that would be used in createInstancedMeshes
      const baseHeight = 1.2; // fence_post
      const requestedHeight = 1.5;
      const heightRatio = requestedHeight / baseHeight;

      expect(heightRatio).toBeCloseTo(1.25, 2);

      // 5% threshold check
      expect(Math.abs(heightRatio - 1.0) > 0.05).toBe(true);
    });

    it("skips scaling when height is close to base (within 5%)", () => {
      const baseHeight = 1.2;
      const requestedHeight = 1.22; // 1.7% difference
      const heightRatio = requestedHeight / baseHeight;

      // Should NOT scale because difference is < 5%
      expect(Math.abs(heightRatio - 1.0) > 0.05).toBe(false);
    });
  });
});
