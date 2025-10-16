/**
 * USE Action Tests - CLAUDE.md Compliant (No Mocks)
 *
 * Tests the USE action handler's behavior without using vi.fn() or vi.mock().
 * Verifies action metadata, validation, and basic handler logic.
 */

import { describe, it, expect } from "vitest";
import { useAction } from "../../actions/use";
import { createMockRuntime, toUUID } from "../test-utils";
import type { Memory, State, Content } from "@elizaos/core";

describe("USE Action", () => {
  describe("validate", () => {
    it("should always return true", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "use the sword" },
        entityId: toUUID("test-entity"),
        agentId: toUUID("test-agent"),
        roomId: toUUID("test-room"),
        createdAt: Date.now(),
      };
      const result = await useAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it("should return true for equip command", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "equip the shield" },
        entityId: toUUID("test-entity"),
        agentId: toUUID("test-agent"),
        roomId: toUUID("test-room"),
        createdAt: Date.now(),
      };
      const result = await useAction.validate(runtime, message);
      expect(result).toBe(true);
    });

    it("should return true for wield command", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "wield the bow" },
        entityId: toUUID("test-entity"),
        agentId: toUUID("test-agent"),
        roomId: toUUID("test-room"),
        createdAt: Date.now(),
      };
      const result = await useAction.validate(runtime, message);
      expect(result).toBe(true);
    });
  });

  describe("handler", () => {
    it("should handle use action with responses", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "use the potion" },
        entityId: toUUID("test-entity"),
        agentId: toUUID("test-agent"),
        roomId: toUUID("test-room"),
        createdAt: Date.now(),
      };
      const state: State = {
        values: {},
        data: {},
        text: "test state",
      };

      let callbackContent: Content | undefined;
      const callback = (content: Content) => {
        callbackContent = content;
      };

      const responses = [
        {
          content: {
            text: "I used the potion and restored health.",
            actions: ["USE"],
            thought: "Using health potion",
          },
        },
      ];

      const result = await useAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        responses,
      );

      expect(result).toBeDefined();
      // Handler should process the response
      expect(callbackContent || result).toBeDefined();
    });

    it("should handle empty responses array", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "use sword" },
        entityId: toUUID("test-entity"),
        agentId: toUUID("test-agent"),
        roomId: toUUID("test-room"),
        createdAt: Date.now(),
      };
      const state: State = {
        values: {},
        data: {},
        text: "test state",
      };

      let callbackInvoked = false;
      const callback = () => {
        callbackInvoked = true;
      };

      const result = await useAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        [],
      );

      // Should handle gracefully even without responses
      expect(result).toBeDefined();
    });

    it("should handle null callback gracefully", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "use torch" },
        entityId: toUUID("test-entity"),
        agentId: toUUID("test-agent"),
        roomId: toUUID("test-room"),
        createdAt: Date.now(),
      };
      const state: State = {
        values: {},
        data: {},
        text: "test state",
      };

      const responses = [
        {
          content: {
            text: "Torch lit!",
            actions: ["USE"],
          },
        },
      ];

      const result = await useAction.handler(
        runtime,
        message,
        state,
        {},
        null as never,
        responses,
      );

      expect(result).toBeDefined();
    });
  });

  describe("examples", () => {
    it("should have valid examples array", () => {
      expect(useAction.examples).toBeDefined();
      expect(Array.isArray(useAction.examples)).toBe(true);
      expect(useAction.examples!.length).toBeGreaterThan(0);
    });

    it("should have properly formatted examples", () => {
      useAction.examples!.forEach((example) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThanOrEqual(1);

        example.forEach((message) => {
          expect(message).toHaveProperty("name");
          expect(message).toHaveProperty("content");
        });
      });
    });

    it("should include examples with USE action", () => {
      const hasUseAction = useAction.examples!.some((example) =>
        example.some((msg) => msg.content.actions?.includes("USE")),
      );
      expect(hasUseAction).toBe(true);
    });
  });

  describe("similes", () => {
    it("should have appropriate similes", () => {
      expect(useAction.similes).toBeDefined();
      expect(Array.isArray(useAction.similes)).toBe(true);
      expect(useAction.similes!.length).toBeGreaterThan(0);
    });

    it("should include common use-related terms", () => {
      const similes = useAction.similes!;
      const hasRelevantTerms = similes.some((term) =>
        ["EQUIP", "WIELD", "ACTIVATE", "CONSUME", "APPLY"].includes(term),
      );
      expect(hasRelevantTerms).toBe(true);
    });
  });

  describe("description", () => {
    it("should have a comprehensive description", () => {
      expect(useAction.description).toBeDefined();
      expect(typeof useAction.description).toBe("string");
      expect(useAction.description.length).toBeGreaterThan(0);
    });

    it("should mention using items", () => {
      const description = useAction.description.toLowerCase();
      const hasRelevantKeywords =
        description.includes("use") ||
        description.includes("item") ||
        description.includes("equip");
      expect(hasRelevantKeywords).toBe(true);
    });
  });

  describe("metadata", () => {
    it("should have a name property", () => {
      expect(useAction.name).toBeDefined();
      expect(typeof useAction.name).toBe("string");
      expect(useAction.name.length).toBeGreaterThan(0);
    });
  });
});
