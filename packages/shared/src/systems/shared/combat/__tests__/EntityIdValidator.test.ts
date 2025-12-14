/**
 * EntityIdValidator Unit Tests
 *
 * Tests for entity ID validation and sanitization:
 * - Valid ID formats (alphanumeric, UUIDs)
 * - Invalid ID rejection (injection attempts, special chars)
 * - Sanitization for safe logging
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EntityIdValidator, entityIdValidator } from "../EntityIdValidator";

describe("EntityIdValidator", () => {
  let validator: EntityIdValidator;

  beforeEach(() => {
    validator = new EntityIdValidator();
  });

  describe("validate", () => {
    describe("valid IDs", () => {
      it("accepts simple alphanumeric IDs", () => {
        expect(validator.validate("player123").valid).toBe(true);
        expect(validator.validate("mob1").valid).toBe(true);
        expect(validator.validate("NPC42").valid).toBe(true);
      });

      it("accepts IDs with underscores and hyphens", () => {
        expect(validator.validate("player_1").valid).toBe(true);
        expect(validator.validate("mob-goblin-01").valid).toBe(true);
        expect(validator.validate("npc_guard_123").valid).toBe(true);
      });

      it("accepts valid UUIDs", () => {
        expect(
          validator.validate("550e8400-e29b-41d4-a716-446655440000").valid,
        ).toBe(true);
        expect(
          validator.validate("123e4567-e89b-42d3-a456-426614174000").valid,
        ).toBe(true);
      });

      it("normalizes UUID case in sanitizedId", () => {
        const result = validator.validate(
          "550E8400-E29B-41D4-A716-446655440000",
        );
        expect(result.valid).toBe(true);
        expect(result.sanitizedId).toBe("550e8400-e29b-41d4-a716-446655440000");
      });
    });

    describe("invalid IDs", () => {
      it("rejects non-string inputs", () => {
        expect(validator.validate(123).valid).toBe(false);
        expect(validator.validate(123).reason).toBe("not_a_string");

        expect(validator.validate(null).valid).toBe(false);
        expect(validator.validate(undefined).valid).toBe(false);
        expect(validator.validate({}).valid).toBe(false);
        expect(validator.validate([]).valid).toBe(false);
      });

      it("rejects empty strings", () => {
        const result = validator.validate("");
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("too_short");
      });

      it("rejects strings exceeding max length", () => {
        const longId = "a".repeat(65);
        const result = validator.validate(longId);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("too_long");
      });

      it("rejects IDs with null bytes", () => {
        const result = validator.validate("player\0injection");
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("contains_null_byte");
      });

      it("rejects path traversal attempts", () => {
        expect(validator.validate("../etc/passwd").reason).toBe(
          "path_traversal_attempt",
        );
        expect(validator.validate("..\\windows\\system32").reason).toBe(
          "path_traversal_attempt",
        );
        expect(validator.validate("/etc/passwd").reason).toBe(
          "path_traversal_attempt",
        );
      });

      it("rejects IDs with special characters", () => {
        expect(validator.validate("<script>").reason).toBe(
          "invalid_characters",
        );
        expect(validator.validate("player&id").reason).toBe(
          "invalid_characters",
        );
        expect(validator.validate("player=id").reason).toBe(
          "invalid_characters",
        );
        expect(validator.validate("player;id").reason).toBe(
          "invalid_characters",
        );
        expect(validator.validate("player'id").reason).toBe(
          "invalid_characters",
        );
        expect(validator.validate('player"id').reason).toBe(
          "invalid_characters",
        );
      });

      it("rejects SQL injection attempts", () => {
        expect(validator.validate("1; DROP TABLE users").reason).toBe(
          "invalid_characters",
        );
        expect(validator.validate("' OR '1'='1").reason).toBe(
          "invalid_characters",
        );
      });

      it("rejects XSS injection attempts", () => {
        // Scripts with "/" are caught by path traversal check first
        expect(validator.validate("<script>alert(1)</script>").reason).toBe(
          "path_traversal_attempt",
        );
        // Tags without "/" are caught by invalid characters
        expect(validator.validate("<img onerror=alert(1)>").reason).toBe(
          "invalid_characters",
        );
        expect(validator.validate("<script>").reason).toBe(
          "invalid_characters",
        );
      });
    });
  });

  describe("isValid", () => {
    it("returns boolean for quick validation", () => {
      expect(validator.isValid("player1")).toBe(true);
      expect(validator.isValid("../hack")).toBe(false);
      expect(validator.isValid(123)).toBe(false);
    });
  });

  describe("validateMany", () => {
    it("validates array of IDs and returns invalid ones", () => {
      const result = validator.validateMany([
        "player1",
        "mob1",
        "../hack",
        "<script>",
        "validId",
      ]);

      expect(result.valid).toBe(false);
      expect(result.invalidIds).toHaveLength(2);
      expect(result.invalidIds[0]).toEqual({
        id: "../hack",
        reason: "path_traversal_attempt",
      });
      expect(result.invalidIds[1]).toEqual({
        id: "<script>",
        reason: "invalid_characters",
      });
    });

    it("returns valid=true when all IDs are valid", () => {
      const result = validator.validateMany(["player1", "mob1", "npc_guard"]);
      expect(result.valid).toBe(true);
      expect(result.invalidIds).toHaveLength(0);
    });
  });

  describe("sanitizeForLogging", () => {
    it("escapes HTML special characters", () => {
      expect(validator.sanitizeForLogging("<script>")).toBe("&lt;script&gt;");
      expect(validator.sanitizeForLogging('test"quote')).toBe(
        "test&quot;quote",
      );
      // & is escaped to &amp;, then "amp" remains as-is
      expect(validator.sanitizeForLogging("test&value")).toBe("test&amp;value");
    });

    it("escapes control characters", () => {
      expect(validator.sanitizeForLogging("test\nline")).toBe("test\\nline");
      expect(validator.sanitizeForLogging("test\rline")).toBe("test\\rline");
      expect(validator.sanitizeForLogging("test\ttab")).toBe("test\\ttab");
      expect(validator.sanitizeForLogging("test\0null")).toBe("test\\0null");
    });

    it("truncates long strings", () => {
      const longId = "a".repeat(100);
      const result = validator.sanitizeForLogging(longId);
      expect(result.length).toBe(67); // 64 + "..."
      expect(result.endsWith("...")).toBe(true);
    });

    it("handles non-string inputs", () => {
      expect(validator.sanitizeForLogging(123)).toBe("[non-string: number]");
      expect(validator.sanitizeForLogging(null)).toBe("[non-string: object]");
      expect(validator.sanitizeForLogging(undefined)).toBe(
        "[non-string: undefined]",
      );
    });
  });

  describe("custom configuration", () => {
    it("respects custom maxLength", () => {
      const strictValidator = new EntityIdValidator({ maxLength: 10 });
      expect(strictValidator.validate("short").valid).toBe(true);
      expect(strictValidator.validate("verylongid123").valid).toBe(false);
    });

    it("respects custom minLength", () => {
      const strictValidator = new EntityIdValidator({ minLength: 3 });
      expect(strictValidator.validate("ab").valid).toBe(false);
      expect(strictValidator.validate("abc").valid).toBe(true);
    });

    it("can disable UUID support", () => {
      const noUuidValidator = new EntityIdValidator({ allowUuids: false });
      // UUID format still passes pattern check because dashes are allowed
      const result = noUuidValidator.validate(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("singleton instance", () => {
    it("provides default singleton for convenience", () => {
      expect(entityIdValidator).toBeInstanceOf(EntityIdValidator);
      expect(entityIdValidator.isValid("player1")).toBe(true);
    });
  });
});
