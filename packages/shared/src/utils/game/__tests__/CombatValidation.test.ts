/**
 * CombatValidation Unit Tests
 *
 * Tests for all combat input validation functions:
 * - Entity ID validation (format, length, characters)
 * - UUID validation
 * - Attack type validation (melee-only MVP)
 * - Combat request validation
 * - Attack style request validation
 * - Display name sanitization (XSS prevention)
 * - Rate limiting state management
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateEntityId,
  validateUUID,
  validateAttackType,
  validateCombatRequest,
  validateAttackStyleRequest,
  sanitizeDisplayName,
  isRateLimited,
  checkRateLimit,
  createRateLimitState,
  type RateLimitState,
} from "../CombatValidation";

describe("CombatValidation", () => {
  describe("validateEntityId", () => {
    it("accepts valid alphanumeric IDs", () => {
      expect(validateEntityId("player123")).toBe(true);
      expect(validateEntityId("mob_456")).toBe(true);
      expect(validateEntityId("entity-789")).toBe(true);
      expect(validateEntityId("NPC_Goblin_01")).toBe(true);
    });

    it("accepts mixed case and numbers", () => {
      expect(validateEntityId("AbCdEf123")).toBe(true);
      expect(validateEntityId("UPPER_lower_123")).toBe(true);
      expect(validateEntityId("a1b2c3")).toBe(true);
    });

    it("accepts underscores and hyphens", () => {
      expect(validateEntityId("entity_with_underscores")).toBe(true);
      expect(validateEntityId("entity-with-hyphens")).toBe(true);
      expect(validateEntityId("mixed_underscore-hyphen")).toBe(true);
    });

    it("rejects empty strings", () => {
      expect(validateEntityId("")).toBe(false);
    });

    it("rejects strings exceeding max length (128)", () => {
      const longId = "a".repeat(129);
      expect(validateEntityId(longId)).toBe(false);

      const maxLengthId = "a".repeat(128);
      expect(validateEntityId(maxLengthId)).toBe(true);
    });

    it("rejects special characters", () => {
      expect(validateEntityId("entity<script>")).toBe(false);
      expect(validateEntityId("entity'injection")).toBe(false);
      expect(validateEntityId('entity"quote')).toBe(false);
      expect(validateEntityId("entity;drop")).toBe(false);
      expect(validateEntityId("entity/path")).toBe(false);
      expect(validateEntityId("entity\\backslash")).toBe(false);
      expect(validateEntityId("entity@symbol")).toBe(false);
      expect(validateEntityId("entity#hash")).toBe(false);
      expect(validateEntityId("entity$dollar")).toBe(false);
      expect(validateEntityId("entity%percent")).toBe(false);
    });

    it("rejects spaces", () => {
      expect(validateEntityId("entity with spaces")).toBe(false);
      expect(validateEntityId(" leadingspace")).toBe(false);
      expect(validateEntityId("trailingspace ")).toBe(false);
    });

    it("rejects non-string types", () => {
      expect(validateEntityId(null)).toBe(false);
      expect(validateEntityId(undefined)).toBe(false);
      expect(validateEntityId(123)).toBe(false);
      expect(validateEntityId({})).toBe(false);
      expect(validateEntityId([])).toBe(false);
      expect(validateEntityId(true)).toBe(false);
    });
  });

  describe("validateUUID", () => {
    it("accepts valid UUID v4 format", () => {
      expect(validateUUID("123e4567-e89b-4456-a789-426614174000")).toBe(true);
      expect(validateUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(validateUUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
    });

    it("accepts uppercase UUIDs", () => {
      expect(validateUUID("123E4567-E89B-4456-A789-426614174000")).toBe(true);
      expect(validateUUID("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(true);
    });

    it("rejects invalid UUID formats", () => {
      // Wrong version (not 4)
      expect(validateUUID("123e4567-e89b-1456-a789-426614174000")).toBe(false);
      expect(validateUUID("123e4567-e89b-3456-a789-426614174000")).toBe(false);

      // Wrong variant (not 8, 9, a, or b)
      expect(validateUUID("123e4567-e89b-4456-0789-426614174000")).toBe(false);

      // Missing hyphens
      expect(validateUUID("123e4567e89b4456a789426614174000")).toBe(false);

      // Too short
      expect(validateUUID("123e4567-e89b-4456-a789")).toBe(false);

      // Too long
      expect(validateUUID("123e4567-e89b-4456-a789-426614174000-extra")).toBe(
        false,
      );

      // Invalid characters
      expect(validateUUID("123e4567-e89b-4456-a789-42661417400g")).toBe(false);
    });

    it("rejects non-string types", () => {
      expect(validateUUID(null)).toBe(false);
      expect(validateUUID(undefined)).toBe(false);
      expect(validateUUID(123)).toBe(false);
      expect(validateUUID({})).toBe(false);
    });
  });

  describe("validateAttackType", () => {
    it("accepts melee attack type", () => {
      expect(validateAttackType("melee")).toBe(true);
    });

    it("accepts undefined (defaults to melee)", () => {
      expect(validateAttackType(undefined)).toBe(true);
    });

    it("accepts null (defaults to melee)", () => {
      expect(validateAttackType(null)).toBe(true);
    });

    it("rejects ranged (melee-only MVP)", () => {
      expect(validateAttackType("ranged")).toBe(false);
    });

    it("rejects magic (melee-only MVP)", () => {
      expect(validateAttackType("magic")).toBe(false);
    });

    it("rejects invalid attack types", () => {
      expect(validateAttackType("unknown")).toBe(false);
      expect(validateAttackType("MELEE")).toBe(false); // Case sensitive
      expect(validateAttackType("")).toBe(false);
      expect(validateAttackType(123)).toBe(false);
    });
  });

  describe("validateCombatRequest", () => {
    it("validates complete request with mobId", () => {
      const result = validateCombatRequest({
        mobId: "goblin_123",
        attackType: "melee",
      });

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        targetId: "goblin_123",
        attackType: "melee",
      });
    });

    it("validates request with targetId (alternative field)", () => {
      const result = validateCombatRequest({
        targetId: "skeleton_456",
      });

      expect(result.valid).toBe(true);
      expect(result.data?.targetId).toBe("skeleton_456");
    });

    it("prefers mobId over targetId when both present", () => {
      const result = validateCombatRequest({
        mobId: "preferred_mob",
        targetId: "ignored_target",
      });

      expect(result.valid).toBe(true);
      expect(result.data?.targetId).toBe("preferred_mob");
    });

    it("defaults attack type to melee", () => {
      const result = validateCombatRequest({
        mobId: "goblin_123",
      });

      expect(result.valid).toBe(true);
      expect(result.data?.attackType).toBe("melee");
    });

    it("rejects missing target ID", () => {
      const result = validateCombatRequest({
        attackType: "melee",
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid target ID format");
    });

    it("rejects invalid target ID format", () => {
      const result = validateCombatRequest({
        mobId: "invalid<script>",
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid target ID format");
    });

    it("rejects invalid attack type", () => {
      const result = validateCombatRequest({
        mobId: "goblin_123",
        attackType: "ranged",
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid attack type");
    });

    it("rejects non-object data", () => {
      expect(validateCombatRequest(null).valid).toBe(false);
      expect(validateCombatRequest(undefined).valid).toBe(false);
      expect(validateCombatRequest("string").valid).toBe(false);
      expect(validateCombatRequest(123).valid).toBe(false);
      expect(validateCombatRequest([]).valid).toBe(false);
    });

    it("returns appropriate error messages", () => {
      expect(validateCombatRequest(null).error).toBe("Invalid request format");
      expect(validateCombatRequest({}).error).toBe("Invalid target ID format");
    });
  });

  describe("validateAttackStyleRequest", () => {
    it("accepts valid attack styles", () => {
      const styles = ["accurate", "aggressive", "defensive", "controlled"];

      for (const style of styles) {
        const result = validateAttackStyleRequest({ newStyle: style });
        expect(result.valid).toBe(true);
        expect(result.data?.newStyle).toBe(style);
      }
    });

    it("rejects invalid attack styles", () => {
      const invalidStyles = ["unknown", "melee", "ranged", "magic", "ACCURATE"];

      for (const style of invalidStyles) {
        const result = validateAttackStyleRequest({ newStyle: style });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid attack style");
      }
    });

    it("rejects missing newStyle field", () => {
      const result = validateAttackStyleRequest({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing attack style");
    });

    it("rejects non-string newStyle", () => {
      expect(validateAttackStyleRequest({ newStyle: 123 }).valid).toBe(false);
      expect(validateAttackStyleRequest({ newStyle: null }).valid).toBe(false);
      expect(validateAttackStyleRequest({ newStyle: {} }).valid).toBe(false);
    });

    it("rejects non-object data", () => {
      expect(validateAttackStyleRequest(null).valid).toBe(false);
      expect(validateAttackStyleRequest(undefined).valid).toBe(false);
      expect(validateAttackStyleRequest("string").valid).toBe(false);
    });
  });

  describe("sanitizeDisplayName", () => {
    it("preserves normal text", () => {
      expect(sanitizeDisplayName("Player123")).toBe("Player123");
      expect(sanitizeDisplayName("Goblin")).toBe("Goblin");
      expect(sanitizeDisplayName("NPC Guard")).toBe("NPC Guard");
    });

    it("escapes HTML entities", () => {
      expect(sanitizeDisplayName("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;",
      );
      expect(sanitizeDisplayName('Player"test"')).toBe(
        "Player&quot;test&quot;",
      );
      expect(sanitizeDisplayName("A & B")).toBe("A &amp; B");
      expect(sanitizeDisplayName("x < y > z")).toBe("x &lt; y &gt; z");
    });

    it("truncates to max length", () => {
      const longName = "A".repeat(100);
      expect(sanitizeDisplayName(longName).length).toBe(50);
      expect(sanitizeDisplayName(longName, 20).length).toBe(20);
    });

    it("truncates before escaping", () => {
      // A name with special chars at the end - truncation should happen first
      const name = "A".repeat(48) + "<>";
      const result = sanitizeDisplayName(name);
      // Truncated to 50 chars, then escaped
      expect(result.length).toBeGreaterThan(50); // &lt; and &gt; expand
    });

    it("handles custom max length", () => {
      expect(sanitizeDisplayName("LongPlayerName", 5)).toBe("LongP");
      expect(sanitizeDisplayName("Short", 100)).toBe("Short");
    });

    it("returns 'Unknown' for non-strings", () => {
      expect(sanitizeDisplayName(null)).toBe("Unknown");
      expect(sanitizeDisplayName(undefined)).toBe("Unknown");
      expect(sanitizeDisplayName(123)).toBe("Unknown");
      expect(sanitizeDisplayName({})).toBe("Unknown");
      expect(sanitizeDisplayName([])).toBe("Unknown");
    });

    it("escapes all XSS vectors", () => {
      const xssVectors = [
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "onclick='alert(1)'",
        '"><script>alert(1)</script>',
      ];

      for (const vector of xssVectors) {
        const sanitized = sanitizeDisplayName(vector);
        expect(sanitized).not.toContain("<");
        expect(sanitized).not.toContain(">");
        expect(sanitized).not.toContain("'");
        expect(sanitized).not.toContain('"');
      }
    });
  });

  describe("RateLimiting", () => {
    let state: RateLimitState;

    beforeEach(() => {
      state = createRateLimitState();
    });

    describe("createRateLimitState", () => {
      it("creates initial state with zero values", () => {
        expect(state.requestCount).toBe(0);
        expect(state.windowStartTick).toBe(0);
        expect(state.throttledUntilTick).toBe(0);
      });
    });

    describe("isRateLimited", () => {
      it("returns false when not throttled", () => {
        expect(isRateLimited(state, 0)).toBe(false);
        expect(isRateLimited(state, 100)).toBe(false);
      });

      it("returns true when within throttle period", () => {
        state.throttledUntilTick = 10;
        expect(isRateLimited(state, 5)).toBe(true);
        expect(isRateLimited(state, 9)).toBe(true);
      });

      it("returns false when throttle period expired", () => {
        state.throttledUntilTick = 10;
        expect(isRateLimited(state, 10)).toBe(false);
        expect(isRateLimited(state, 11)).toBe(false);
      });
    });

    describe("checkRateLimit", () => {
      const maxRequests = 3;
      const windowSize = 5;
      const throttleDuration = 10;

      it("allows requests within limit", () => {
        expect(
          checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
        expect(state.requestCount).toBe(1);

        expect(
          checkRateLimit(state, 1, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
        expect(state.requestCount).toBe(2);

        expect(
          checkRateLimit(state, 2, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
        expect(state.requestCount).toBe(3);
      });

      it("blocks requests over limit and sets throttle", () => {
        // Use up the limit
        checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration);
        checkRateLimit(state, 1, maxRequests, windowSize, throttleDuration);
        checkRateLimit(state, 2, maxRequests, windowSize, throttleDuration);

        // Fourth request should be blocked
        expect(
          checkRateLimit(state, 3, maxRequests, windowSize, throttleDuration),
        ).toBe(false);
        expect(state.throttledUntilTick).toBe(3 + throttleDuration);
      });

      it("resets window after expiration", () => {
        // Use up limit
        checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration);
        checkRateLimit(state, 1, maxRequests, windowSize, throttleDuration);
        checkRateLimit(state, 2, maxRequests, windowSize, throttleDuration);

        // Window expires after 5 ticks
        expect(
          checkRateLimit(state, 6, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
        expect(state.requestCount).toBe(1);
        expect(state.windowStartTick).toBe(6);
      });

      it("stays blocked during throttle period", () => {
        // Use up limit and get throttled
        checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration);
        checkRateLimit(state, 1, maxRequests, windowSize, throttleDuration);
        checkRateLimit(state, 2, maxRequests, windowSize, throttleDuration);
        checkRateLimit(state, 3, maxRequests, windowSize, throttleDuration);

        // Should stay blocked until tick 13
        expect(
          checkRateLimit(state, 5, maxRequests, windowSize, throttleDuration),
        ).toBe(false);
        expect(
          checkRateLimit(state, 10, maxRequests, windowSize, throttleDuration),
        ).toBe(false);
        expect(
          checkRateLimit(state, 12, maxRequests, windowSize, throttleDuration),
        ).toBe(false);

        // Should be unblocked at tick 13
        expect(
          checkRateLimit(state, 13, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
      });

      it("handles rapid requests in same tick", () => {
        expect(
          checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
        expect(
          checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
        expect(
          checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration),
        ).toBe(true);
        expect(
          checkRateLimit(state, 0, maxRequests, windowSize, throttleDuration),
        ).toBe(false);
      });
    });
  });
});
