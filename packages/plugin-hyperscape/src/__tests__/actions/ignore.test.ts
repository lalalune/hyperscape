/**
 * IGNORE Action Tests - CLAUDE.md Compliant (No Mocks)
 *
 * Tests the IGNORE action handler's behavior without using mocks.
 * Verifies action metadata, validation, and handler logic.
 */

import { describe, it, expect } from "vitest";
import { ignoreAction } from "../../actions/ignore";
import { createMockRuntime, toUUID } from "../test-utils";
import type { Memory, State, Content } from "@elizaos/core";

describe("IGNORE Action", () => {
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
      const result = await ignoreAction.validate(runtime, message);
      expect(result).toBe(true);
    });
  });

  describe("handler", () => {
    it("should return result with ignored flag and call callback with response content", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Go away bot" },
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
      let callbackContent: Content | undefined;
      const callback = async (content: Content): Promise<Memory[]> => {
        callbackInvoked = true;
        callbackContent = content;
        return [];
      };

      const responses = [
        {
          content: {
            text: "",
            thought: "User is being rude, I should ignore them",
            actions: ["IGNORE"],
          },
        },
      ];

      const result = await ignoreAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        responses,
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("");
      expect(result.values).toEqual({
        ignored: true,
        reason: "conversation_ended_or_inappropriate",
      });
      expect(result.data).toEqual({
        action: "IGNORE",
        hasResponse: true,
      });
      expect(callbackInvoked).toBe(true);
      expect(callbackContent).toBeDefined();
      expect(callbackContent!.text).toBe("");
    });

    it("should return result without calling callback if no responses", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Go away bot" },
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
      const callback = async (): Promise<Memory[]> => {
        callbackInvoked = true;
        return [];
      };

      const result = await ignoreAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        [],
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("");
      expect(result.values).toEqual({
        ignored: true,
        reason: "conversation_ended_or_inappropriate",
      });
      expect(result.data).toEqual({
        action: "IGNORE",
        hasResponse: false,
      });
      expect(callbackInvoked).toBe(false);
    });

    it("should handle null callback gracefully", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Go away bot" },
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
            text: "",
            actions: ["IGNORE"],
          },
        },
      ];

      const result = await ignoreAction.handler(
        runtime,
        message,
        state,
        {},
        undefined,
        responses,
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("");
      expect(result.values).toEqual({
        ignored: true,
        reason: "conversation_ended_or_inappropriate",
      });
      expect(result.data).toEqual({
        action: "IGNORE",
        hasResponse: true,
      });
    });

    it("should handle multiple responses by using the first one", async () => {
      const runtime = createMockRuntime();
      const message: Memory = {
        id: toUUID("msg-123"),
        content: { text: "Go away bot" },
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
      const callback = async (content: Content): Promise<Memory[]> => {
        callbackContent = content;
        return [];
      };

      const responses = [
        {
          content: {
            text: "",
            thought: "First ignore response",
            actions: ["IGNORE"],
          },
        },
        {
          content: {
            text: "",
            thought: "Second ignore response",
            actions: ["IGNORE"],
          },
        },
      ];

      const result = await ignoreAction.handler(
        runtime,
        message,
        state,
        {},
        callback,
        responses,
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("");
      expect(callbackContent).toBeDefined();
      expect(callbackContent!.thought).toBe("First ignore response");
    });
  });

  describe("examples", () => {
    it("should have valid examples array", () => {
      expect(ignoreAction.examples).toBeDefined();
      expect(Array.isArray(ignoreAction.examples)).toBe(true);
      expect(ignoreAction.examples!.length).toBeGreaterThan(0);
    });

    it("should have properly formatted examples", () => {
      ignoreAction.examples!.forEach((example) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThanOrEqual(1);

        example.forEach((message) => {
          expect(message).toHaveProperty("name");
          expect(message).toHaveProperty("content");

          // Check if it's an agent response with IGNORE action
          if (message.content.actions) {
            expect(message.content.actions).toContain("IGNORE");
          }
        });
      });
    });

    it("should include examples of different ignore scenarios", () => {
      const examples = ignoreAction.examples!;

      // Should have examples for aggressive behavior
      const aggressiveExample = examples.find(
        (ex) =>
          ex[0].content.text?.toLowerCase().includes("screw") ||
          ex[0].content.text?.toLowerCase().includes("shut up"),
      );
      expect(aggressiveExample).toBeDefined();

      // Should have examples for end of conversation
      const goodbyeExample = examples.find((ex) =>
        ex.some(
          (msg) =>
            msg.content.text?.toLowerCase().includes("bye") ||
            msg.content.text?.toLowerCase().includes("cya"),
        ),
      );
      expect(goodbyeExample).toBeDefined();

      // Should have examples for inappropriate content
      const inappropriateExample = examples.find((ex) =>
        ex[0].content.text?.toLowerCase().includes("cyber"),
      );
      expect(inappropriateExample).toBeDefined();
    });
  });

  describe("similes", () => {
    it("should have appropriate similes", () => {
      expect(ignoreAction.similes).toBeDefined();
      expect(Array.isArray(ignoreAction.similes)).toBe(true);
      expect(ignoreAction.similes).toContain("STOP_TALKING");
      expect(ignoreAction.similes).toContain("STOP_CHATTING");
      expect(ignoreAction.similes).toContain("STOP_CONVERSATION");
    });
  });

  describe("description", () => {
    it("should have a comprehensive description", () => {
      expect(ignoreAction.description).toBeDefined();
      expect(ignoreAction.description).toContain("ignoring the user");
      expect(ignoreAction.description).toContain("aggressive");
      expect(ignoreAction.description).toContain(
        "conversation has naturally ended",
      );
    });
  });
});
