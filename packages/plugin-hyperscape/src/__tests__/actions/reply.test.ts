/**
 * REPLY Action Tests - CLAUDE.md Compliant (No Mocks)
 *
 * Tests the REPLY action handler's behavior without using vi.fn() or vi.mock().
 * Verifies action metadata, validation, and handler logic using real implementations.
 */

import { describe, it, expect } from "vitest";
import { replyAction } from "../../actions/reply";
import { createMockRuntime, toUUID } from "../test-utils";
import type { Memory, State, Content } from "@elizaos/core";

describe("REPLY Action", () => {
  describe("validate", () => {
    it("should always return true", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "test" },
        entityId: toUUID("test-entity"),
        agentId: toUUID("test-agent"),
        roomId: toUUID("test-room"),
        createdAt: Date.now(),
      };
      const result = await replyAction.validate(runtime, message);
      expect(result).toBe(true);
    });
  });

  describe("handler", () => {
    it("should use existing reply responses if available", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Hello, how are you?" },
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
            text: "I'm doing well, thank you!",
            actions: ["REPLY"],
            thought: "User asked how I'm doing",
          },
        },
      ];

      const result = await replyAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        responses,
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("I'm doing well, thank you!");
      expect(callbackContent).toBeDefined();
      expect(callbackContent!.text).toBe("I'm doing well, thank you!");
      expect(callbackContent!.actions).toContain("HYPERSCAPE_REPLY");
    });

    it("should handle empty responses array gracefully", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Hello" },
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

      // When no responses provided, handler should generate one
      // This tests the fallback behavior
      const result = await replyAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        [],
      );

      // Result should exist even without pre-made responses
      expect(result).toBeDefined();
    });

    it("should handle multiple responses by using the first one", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "What's the weather?" },
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
            text: "It's sunny today!",
            actions: ["REPLY"],
            thought: "First response",
          },
        },
        {
          content: {
            text: "Actually, it's raining.",
            actions: ["REPLY"],
            thought: "Second response",
          },
        },
      ];

      const result = await replyAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        responses,
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("It's sunny today!");
      expect(callbackContent).toBeDefined();
      expect(callbackContent!.text).toBe("It's sunny today!");
    });

    it("should handle null callback gracefully", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Hello" },
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
            text: "Hi there!",
            actions: ["REPLY"],
          },
        },
      ];

      const result = await replyAction.handler(
        runtime,
        message,
        state,
        {},
        null as never,
        responses,
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("Hi there!");
    });

    it("should set proper action metadata", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Test message" },
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
            text: "Response text",
            actions: ["REPLY"],
          },
        },
      ];

      await replyAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        responses,
      );

      expect(callbackContent).toBeDefined();
      expect(callbackContent!.actions).toContain("HYPERSCAPE_REPLY");
      expect(callbackContent!.source).toBe("hyperscape");
    });
  });

  describe("examples", () => {
    it("should have valid examples array", () => {
      expect(replyAction.examples).toBeDefined();
      expect(Array.isArray(replyAction.examples)).toBe(true);
      expect(replyAction.examples!.length).toBeGreaterThan(0);
    });

    it("should have properly formatted examples", () => {
      replyAction.examples!.forEach((example) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThanOrEqual(1);

        example.forEach((message) => {
          expect(message).toHaveProperty("name");
          expect(message).toHaveProperty("content");
        });
      });
    });
  });

  describe("similes", () => {
    it("should have appropriate similes", () => {
      expect(replyAction.similes).toBeDefined();
      expect(Array.isArray(replyAction.similes)).toBe(true);
      expect(replyAction.similes!.length).toBeGreaterThan(0);
      expect(replyAction.similes).toContain("RESPOND");
      expect(replyAction.similes).toContain("ANSWER");
    });
  });

  describe("description", () => {
    it("should have a comprehensive description", () => {
      expect(replyAction.description).toBeDefined();
      expect(typeof replyAction.description).toBe("string");
      expect(replyAction.description.length).toBeGreaterThan(0);
    });
  });
});
