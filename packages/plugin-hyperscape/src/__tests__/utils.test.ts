import { describe, it, expect } from "bun:test";
import {
  calculateDistance3D,
  isWithinRange,
  randomPositionInRadius,
  parseHyperscapeWorldUrl,
  formatEntity,
  isInteractableEntity,
  generateAvatarConfig,
  formatPhysicsData,
} from "../utils";

describe("Hyperscape Utility Functions", () => {
  describe("calculateDistance3D", () => {
    it("should calculate distance between two 3D points correctly", () => {
      const pos1 = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 3, y: 4, z: 0 };
      expect(calculateDistance3D(pos1, pos2)).toBe(5);
    });

    it("should handle negative coordinates", () => {
      const pos1 = { x: -1, y: -1, z: -1 };
      const pos2 = { x: 1, y: 1, z: 1 };
      expect(calculateDistance3D(pos1, pos2)).toBeCloseTo(3.464, 3);
    });
  });

  describe("isWithinRange", () => {
    it("should return true when points are within range", () => {
      const pos1 = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 3, y: 4, z: 0 };
      expect(isWithinRange(pos1, pos2, 10)).toBe(true);
    });

    it("should return false when points are outside range", () => {
      const pos1 = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 10, y: 10, z: 10 };
      expect(isWithinRange(pos1, pos2, 5)).toBe(false);
    });
  });

  describe("randomPositionInRadius", () => {
    it("should generate position within specified radius", () => {
      const center = { x: 0, y: 0, z: 0 };
      const radius = 10;
      const position = randomPositionInRadius(center, radius);

      // Only check X and Z distance (not Y, as Y is height)
      const horizontalDistance = Math.sqrt(
        Math.pow(position.x - center.x, 2) + Math.pow(position.z - center.z, 2),
      );
      expect(horizontalDistance).toBeLessThanOrEqual(radius);
    });

    it("should respect height constraints", () => {
      const center = { x: 0, y: 0, z: 0 };
      const position = randomPositionInRadius(center, 10, 5, 15);

      expect(position.y).toBeGreaterThanOrEqual(5);
      expect(position.y).toBeLessThanOrEqual(15);
    });
  });

  describe("parseHyperscapeWorldUrl", () => {
    it("should parse standard Hyperscape.io URLs", () => {
      const url = "https://hyperscape.io/my-world";
      expect(parseHyperscapeWorldUrl(url)).toBe("my-world");
    });

    it("should handle custom domain URLs", () => {
      const url = "https://custom-world.com";
      expect(parseHyperscapeWorldUrl(url)).toBe("custom-world.com");
    });

    it("should return null for invalid URLs", () => {
      expect(parseHyperscapeWorldUrl("not-a-url")).toBe(null);
    });
  });

  describe("formatEntity", () => {
    it("should format entity with all properties", () => {
      const entity = {
        name: "Test Entity",
        position: { x: 1.5, y: 2.5, z: 3.5 },
        type: "object",
        distance: 5.75,
      };

      const formatted = formatEntity(entity);
      expect(formatted).toContain("Entity: Test Entity");
      expect(formatted).toContain("Position: (1.50, 2.50, 3.50)");
      expect(formatted).toContain("Type: object");
      expect(formatted).toContain("Distance: 5.75m");
    });

    it("should handle entities with missing properties", () => {
      const entity = { name: "Simple Entity" };
      const formatted = formatEntity(entity);
      expect(formatted).toBe("Entity: Simple Entity");
    });
  });

  describe("isInteractableEntity", () => {
    it("should identify interactable entities", () => {
      expect(isInteractableEntity({ app: true })).toBe(true);
      expect(isInteractableEntity({ grabbable: true })).toBe(true);
      expect(isInteractableEntity({ clickable: true })).toBe(true);
      expect(isInteractableEntity({ trigger: "onEnter" })).toBe(true);
      expect(isInteractableEntity({ seat: {} })).toBe(true);
      expect(isInteractableEntity({ portal: "world2" })).toBe(true);
    });

    it("should identify non-interactable entities", () => {
      expect(isInteractableEntity({})).toBe(false);
      expect(isInteractableEntity({ name: "Static" })).toBe(false);
    });
  });

  describe("generateAvatarConfig", () => {
    it("should generate default avatar config", () => {
      const config = generateAvatarConfig("avatar.vrm");
      expect(config).toEqual({
        url: "avatar.vrm",
        scale: 1,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        vrm: true,
        animations: true,
      });
    });

    it("should apply customization", () => {
      const config = generateAvatarConfig("avatar.vrm", {
        scale: 1.2,
        position: { x: 5, y: 0, z: 5 },
        rotation: { x: 0, y: 180, z: 0 },
      });

      expect(config.scale).toBe(1.2);
      expect(config.position).toEqual({ x: 5, y: 0, z: 5 });
      expect(config.rotation).toEqual({ x: 0, y: 180, z: 0 });
    });
  });

  describe("formatPhysicsData", () => {
    it("should format complete physics data", () => {
      const physicsData = {
        velocity: { x: 3, y: 0, z: 4 },
        mass: 75,
        grounded: true,
      };

      const formatted = formatPhysicsData(physicsData);
      expect(formatted).toContain("Speed: 5.00 m/s");
      expect(formatted).toContain("Mass: 75 kg");
      expect(formatted).toContain("Grounded: Yes");
    });

    it("should handle partial physics data", () => {
      const physicsData = { grounded: false };
      const formatted = formatPhysicsData(physicsData);
      expect(formatted).toBe("Grounded: No");
    });
  });
});
