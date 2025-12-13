/**
 * Movement Input Validator Unit Tests
 *
 * Tests the MovementInputValidator for security-critical input validation.
 * Covers OWASP input validation at trust boundary.
 *
 * Test categories:
 * - Valid inputs (happy path)
 * - Invalid type inputs (type coercion attacks)
 * - NaN/Infinity injection (CRITICAL severity)
 * - Bounds validation (MAJOR severity)
 * - Anti-teleport checks (MAJOR severity)
 * - Cancel and runMode toggle handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MovementInputValidator,
  MovementViolationSeverity,
} from "../../../src/systems/ServerNetwork/movement/MovementInputValidator";

describe("MovementInputValidator", () => {
  let validator: MovementInputValidator;
  const currentTile = { x: 100, z: 100 };

  beforeEach(() => {
    validator = new MovementInputValidator();
  });

  describe("Valid Inputs", () => {
    describe("targetTile format", () => {
      it("accepts valid tile coordinate object", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 105, z: 110 } },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: 105, z: 110 });
        expect(result.payload?.cancel).toBe(false);
      });

      it("accepts tile with runMode", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 105, z: 110 }, runMode: true },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.runMode).toBe(true);
      });

      it("defaults runMode to false when not provided", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 105, z: 110 } },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.runMode).toBe(false);
      });

      it("floors floating point tile coordinates", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 105.7, z: 110.3 } },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: 105, z: 110 });
      });
    });

    describe("target array format", () => {
      it("accepts valid world coordinate array [x, y, z]", () => {
        const result = validator.validateMoveRequest(
          { target: [105.5, 0, 110.5] },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: 105, z: 110 });
      });

      it("ignores Y coordinate (only uses X and Z)", () => {
        const result = validator.validateMoveRequest(
          { target: [105, 999, 110] },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: 105, z: 110 });
      });

      it("accepts array with runMode", () => {
        const result = validator.validateMoveRequest(
          { target: [105, 0, 110], runMode: true },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.runMode).toBe(true);
      });
    });

    describe("cancel request", () => {
      it("accepts cancel request", () => {
        const result = validator.validateMoveRequest(
          { cancel: true },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.cancel).toBe(true);
        expect(result.payload?.targetTile).toEqual(currentTile);
      });

      it("cancel request ignores target", () => {
        const result = validator.validateMoveRequest(
          { cancel: true, targetTile: { x: 500, z: 500 } },
          currentTile,
        );

        // Cancel takes precedence, target is ignored
        expect(result.valid).toBe(true);
        expect(result.payload?.cancel).toBe(true);
      });
    });

    describe("runMode toggle only", () => {
      it("accepts runMode toggle without target", () => {
        const result = validator.validateMoveRequest(
          { runMode: true },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.runMode).toBe(true);
        expect(result.payload?.targetTile).toEqual(currentTile);
        expect(result.payload?.cancel).toBe(false);
      });

      it("accepts runMode false toggle", () => {
        const result = validator.validateMoveRequest(
          { runMode: false },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.runMode).toBe(false);
      });
    });

    describe("boundary values", () => {
      it("accepts coordinates at minimum bound (-10000)", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: -10000, z: -10000 } },
          { x: -9900, z: -9900 },
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: -10000, z: -10000 });
      });

      it("accepts coordinates at maximum bound (10000)", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 10000, z: 10000 } },
          { x: 9900, z: 9900 },
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: 10000, z: 10000 });
      });

      it("accepts zero coordinates", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 0, z: 0 } },
          { x: 50, z: 50 },
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: 0, z: 0 });
      });
    });
  });

  describe("Invalid Type Inputs (MINOR/MODERATE severity)", () => {
    describe("payload type", () => {
      it("rejects null payload", () => {
        const result = validator.validateMoveRequest(null, currentTile);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("expected object");
        expect(result.severity).toBe(MovementViolationSeverity.MINOR);
      });

      it("rejects undefined payload", () => {
        const result = validator.validateMoveRequest(undefined, currentTile);

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MINOR);
      });

      it("rejects string payload", () => {
        const result = validator.validateMoveRequest("invalid", currentTile);

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MINOR);
      });

      it("rejects number payload", () => {
        const result = validator.validateMoveRequest(42, currentTile);

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MINOR);
      });

      it("rejects array payload (not object)", () => {
        const result = validator.validateMoveRequest([1, 2, 3], currentTile);

        // Arrays are objects, but without target/targetTile/cancel/runMode
        expect(result.valid).toBe(false);
      });
    });

    describe("targetTile type validation", () => {
      it("rejects targetTile as null", () => {
        const result = validator.validateMoveRequest(
          { targetTile: null },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("expected object");
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });

      it("rejects targetTile as string", () => {
        const result = validator.validateMoveRequest(
          { targetTile: "100,100" },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });

      it("rejects targetTile with string coordinates", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: "100", z: "100" } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("must be numbers");
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });

      it("rejects targetTile missing x", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { z: 100 } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });

      it("rejects targetTile missing z", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 100 } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });
    });

    describe("target array validation", () => {
      it("rejects target as non-array", () => {
        const result = validator.validateMoveRequest(
          { target: "100,0,100" },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("must be an array");
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });

      it("rejects target with less than 3 elements", () => {
        const result = validator.validateMoveRequest(
          { target: [100, 0] },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("at least 3 elements");
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });

      it("rejects target with string elements", () => {
        const result = validator.validateMoveRequest(
          { target: ["100", "0", "100"] },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("must be numbers");
        expect(result.severity).toBe(MovementViolationSeverity.MODERATE);
      });
    });

    describe("empty payload", () => {
      it("rejects empty object without runMode", () => {
        const result = validator.validateMoveRequest({}, currentTile);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("No target specified");
        expect(result.severity).toBe(MovementViolationSeverity.MINOR);
      });
    });
  });

  describe("NaN/Infinity Injection (CRITICAL severity)", () => {
    describe("targetTile NaN injection", () => {
      it("rejects NaN in targetTile.x", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: NaN, z: 100 } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("NaN or Infinity");
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });

      it("rejects NaN in targetTile.z", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 100, z: NaN } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });

      it("rejects both coordinates as NaN", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: NaN, z: NaN } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });
    });

    describe("targetTile Infinity injection", () => {
      it("rejects Infinity in targetTile.x", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: Infinity, z: 100 } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("NaN or Infinity");
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });

      it("rejects -Infinity in targetTile.x", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: -Infinity, z: 100 } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });

      it("rejects Infinity in targetTile.z", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 100, z: Infinity } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });
    });

    describe("target array NaN/Infinity injection", () => {
      it("rejects NaN in target array x", () => {
        const result = validator.validateMoveRequest(
          { target: [NaN, 0, 100] },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });

      it("rejects NaN in target array z", () => {
        const result = validator.validateMoveRequest(
          { target: [100, 0, NaN] },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });

      it("rejects Infinity in target array", () => {
        const result = validator.validateMoveRequest(
          { target: [Infinity, 0, 100] },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.CRITICAL);
      });

      it("ignores NaN in y coordinate (index 1)", () => {
        // Y coordinate is ignored for tile calculation
        const result = validator.validateMoveRequest(
          { target: [105, NaN, 110] },
          currentTile,
        );

        expect(result.valid).toBe(true);
        expect(result.payload?.targetTile).toEqual({ x: 105, z: 110 });
      });
    });
  });

  describe("Bounds Validation (MAJOR severity)", () => {
    describe("targetTile out of bounds", () => {
      it("rejects x below minimum bound", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: -10001, z: 100 } },
          { x: -9900, z: 100 },
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("out of world bounds");
        expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
      });

      it("rejects x above maximum bound", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 10001, z: 100 } },
          { x: 9900, z: 100 },
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
      });

      it("rejects z below minimum bound", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 100, z: -10001 } },
          { x: 100, z: -9900 },
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
      });

      it("rejects z above maximum bound", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 100, z: 10001 } },
          { x: 100, z: 9900 },
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
      });

      it("rejects extremely large coordinates", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: 999999, z: 999999 } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
      });

      it("rejects extremely negative coordinates", () => {
        const result = validator.validateMoveRequest(
          { targetTile: { x: -999999, z: -999999 } },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
      });
    });

    describe("target array out of bounds", () => {
      it("rejects world coordinates out of bounds", () => {
        const result = validator.validateMoveRequest(
          { target: [15000, 0, 100] },
          currentTile,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain("out of world bounds");
        expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
      });
    });
  });

  describe("Anti-Teleport Check (MAJOR severity)", () => {
    // MAX_TILE_DISTANCE_PER_REQUEST = 200

    it("accepts movement within max distance (200 tiles)", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: 250, z: 250 } },
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(true);
    });

    it("accepts movement at exactly max distance", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: 300, z: 100 } }, // 200 tiles in x direction
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(true);
    });

    it("rejects movement exceeding max distance in x", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: 301, z: 100 } }, // 201 tiles - exceeds limit
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Target too far");
      expect(result.error).toContain("201 tiles");
      expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
    });

    it("rejects movement exceeding max distance in z", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: 100, z: 301 } },
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(false);
      expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
    });

    it("rejects teleport attempt (large diagonal)", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: 500, z: 500 } },
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Target too far");
      expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
    });

    it("rejects negative direction teleport", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: -200, z: -200 } },
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(false);
      expect(result.severity).toBe(MovementViolationSeverity.MAJOR);
    });

    it("uses Chebyshev distance (max of dx, dz)", () => {
      // Chebyshev: max(|dx|, |dz|) = max(200, 200) = 200 (exactly at limit)
      const result = validator.validateMoveRequest(
        { targetTile: { x: 300, z: 300 } },
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(true); // 200 tiles in each direction
    });
  });

  describe("Edge Cases", () => {
    it("handles same tile as target (no movement)", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: 100, z: 100 } },
        { x: 100, z: 100 },
      );

      expect(result.valid).toBe(true);
      expect(result.payload?.targetTile).toEqual({ x: 100, z: 100 });
    });

    it("handles negative tile coordinates", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: -50, z: -50 } },
        { x: 0, z: 0 },
      );

      expect(result.valid).toBe(true);
      expect(result.payload?.targetTile).toEqual({ x: -50, z: -50 });
    });

    it("handles very small floating point numbers", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: 0.0001, z: 0.0001 } },
        currentTile,
      );

      expect(result.valid).toBe(true);
      expect(result.payload?.targetTile).toEqual({ x: 0, z: 0 });
    });

    it("handles negative floating point numbers correctly", () => {
      const result = validator.validateMoveRequest(
        { targetTile: { x: -5.9, z: -10.1 } },
        { x: 0, z: 0 },
      );

      expect(result.valid).toBe(true);
      // Math.floor(-5.9) = -6, Math.floor(-10.1) = -11
      expect(result.payload?.targetTile).toEqual({ x: -6, z: -11 });
    });

    it("handles target array with extra elements", () => {
      const result = validator.validateMoveRequest(
        { target: [105, 0, 110, 999, 888, 777] },
        currentTile,
      );

      expect(result.valid).toBe(true);
      expect(result.payload?.targetTile).toEqual({ x: 105, z: 110 });
    });

    it("prioritizes targetTile over target array", () => {
      const result = validator.validateMoveRequest(
        {
          targetTile: { x: 200, z: 200 },
          target: [300, 0, 300],
        },
        currentTile,
      );

      expect(result.valid).toBe(true);
      expect(result.payload?.targetTile).toEqual({ x: 200, z: 200 });
    });

    it("handles cancel with runMode (cancel takes precedence)", () => {
      const result = validator.validateMoveRequest(
        { cancel: true, runMode: true },
        currentTile,
      );

      expect(result.valid).toBe(true);
      expect(result.payload?.cancel).toBe(true);
      expect(result.payload?.runMode).toBe(false); // Cancel sets runMode to false
    });
  });
});
