import { describe, expect, it, vi } from "vitest";
import {
  getPersonalityTraits,
  personalityProvider,
} from "../providers/personalityProvider";

function createMockRuntime(settings?: Record<string, string>) {
  return {
    getSetting: vi.fn((key: string) => settings?.[key] ?? undefined),
    character: { name: "TestAgent" },
    agentId: "agent-test-123",
    getService: vi.fn().mockReturnValue(null),
  };
}

describe("personalityProvider", () => {
  describe("getPersonalityTraits", () => {
    it("returns default traits when no settings configured", () => {
      const runtime = createMockRuntime();
      const traits = getPersonalityTraits(runtime as never);

      expect(traits).toHaveProperty("sociability");
      expect(traits).toHaveProperty("adventurousness");
      expect(traits).toHaveProperty("aggression");
      expect(traits).toHaveProperty("patience");
      expect(traits).toHaveProperty("helpfulness");
      expect(traits).toHaveProperty("chattiness");

      expect(typeof traits.sociability).toBe("number");
      expect(traits.sociability).toBeGreaterThanOrEqual(0);
      expect(traits.sociability).toBeLessThanOrEqual(1);
    });

    it("generates deterministic traits from agent ID", () => {
      const runtime = createMockRuntime();
      const traits1 = getPersonalityTraits(runtime as never);
      const traits2 = getPersonalityTraits(runtime as never);

      expect(traits1.sociability).toBe(traits2.sociability);
      expect(traits1.adventurousness).toBe(traits2.adventurousness);
    });
  });

  describe("personalityProvider.get", () => {
    it("returns text with personality description", async () => {
      const runtime = createMockRuntime();
      const result = await personalityProvider.get(
        runtime as never,
        {} as never,
        {} as never,
      );

      expect(result).toHaveProperty("text");
      expect(typeof result.text).toBe("string");
      expect(result.text!.length).toBeGreaterThan(0);
    });
  });
});
