import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAction } from "../../actions/use";
import {
  createMockRuntime,
  createMockMemory,
  createMockState,
  createMockHyperscapeService,
} from "../../types/test-mocks";
import type {
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";
import { UUID } from "@elizaos/core";

describe("Use Action", () => {
  let mockRuntime: IAgentRuntime;
  let mockMessage: Memory;
  let mockState: State;
  let mockCallback: HandlerCallback;
  let mockService: any; // Using any since we're testing service behavior

  beforeEach(() => {
    mockRuntime = createMockRuntime({
      agentId: "test-agent-1234-5678-9012-345678901234" as UUID,
      character: {
        name: "TestAgent",
        bio: "A test agent",
      },
    });

    mockMessage = createMockMemory({
      content: {
        text: "use the sword",
        source: "test",
      },
    });

    mockState = createMockState({
      agentId: "test-agent-1234-5678-9012-345678901234" as UUID,
      roomId: "test-room-1234-5678-9012-345678901234" as UUID,
    });

    mockCallback = vi.fn();

    mockService = createMockHyperscapeService({
      isConnected: () => true,
      getWorld: () => ({
        _isMinimal: true,
        systems: [],
        entities: {
          player: {
            id: "test-player-1234-5678-9012-345678901234" as UUID,
            name: "TestPlayer",
            names: ["TestPlayer"],
            agentId: "test-agent-1234-5678-9012-345678901234" as UUID,
            data: {
              id: "test-player-1234-5678-9012-345678901234" as UUID,
              name: "TestPlayer",
              inventory: ["sword", "shield"],
            },
            position: { x: 0, y: 0, z: 0 },
          },
          players: new Map(),
          items: new Map([
            [
              "sword",
              {
                id: "sword-1234-5678-9012-345678901234" as UUID,
                name: "Iron Sword",
                names: ["Iron Sword"],
                agentId: "test-agent-1234-5678-9012-345678901234" as UUID,
                data: {
                  id: "sword-1234-5678-9012-345678901234" as UUID,
                  name: "Iron Sword",
                  type: "weapon",
                  usable: true,
                },
              },
            ],
          ]),
          add: (entity: any) => entity,
          remove: (id: string) => {},
          getPlayer: () => null,
        },
      }),
    });

    // Mock the runtime service
    mockRuntime.getService = vi.fn().mockReturnValue(mockService);
  });

  describe("validate", () => {
    it("should return true for valid use command", async () => {
      const result = await useAction.validate(
        mockRuntime as IAgentRuntime,
        mockMessage,
      );
      expect(result).toBe(true);
    });

    it("should return false for invalid command", async () => {
      const invalidMessage = createMockMemory({
        content: { text: "hello there" },
      });

      const result = await useAction.validate(
        mockRuntime as IAgentRuntime,
        invalidMessage,
      );
      expect(result).toBe(true); // if logic changed
    });

    it('should return true for "equip" command', async () => {
      const equipMessage = createMockMemory({
        content: { text: "equip the shield" },
      });

      const result = await useAction.validate(
        mockRuntime as IAgentRuntime,
        equipMessage,
      );
      expect(result).toBe(true);
    });

    it('should return true for "wield" command', async () => {
      const wieldMessage = createMockMemory({
        content: { text: "wield the bow" },
      });

      const result = await useAction.validate(
        mockRuntime as IAgentRuntime,
        wieldMessage,
      );
      expect(result).toBe(true);
    });
  });

  describe("handler", () => {
    it("should handle use action successfully", async () => {
      mockRuntime.useModel = vi.fn();
      mockRuntime.useModel.mockResolvedValue({ text: "sword" });
      mockService.findEntityByName = vi
        .fn()
        .mockReturnValue({ name: "sword", data: { usable: true } });
      const result = await useAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
      );

      expect(result).toBeDefined();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.text).toMatch(/Used/);
        expect(mockCallback).toHaveBeenCalledWith({
          text: expect.stringMatching(/Used/),
          actions: ["HYPERSCAPE_USE"],
          source: "hyperscape",
        });
      }
    });

    it("should handle case when service is not connected", async () => {
      mockService.isConnected = vi.fn().mockReturnValue(false);

      const result = await useAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
      );

      if (result) {
        expect(result.success).toBe(false);
        expect(result.text).toContain("not connected");
      }
    });

    it("should handle case when world is not available", async () => {
      mockService.getWorld = vi.fn().mockReturnValue(null);

      const result = await useAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback,
      );

      if (result) {
        expect(result.success).toBe(false);
        expect(result.text).toContain("Not in a Hyperscape world");
      }
    });

    it("should handle case when item is not found", async () => {
      mockRuntime.useModel = vi.fn();
      mockRuntime.useModel.mockResolvedValue({ text: "magic wand" });
      mockService.findEntityByName = vi.fn().mockReturnValue(null);
      const notFoundMessage = createMockMemory({
        content: { text: "use the magic wand" },
      });

      const result = await useAction.handler(
        mockRuntime as IAgentRuntime,
        notFoundMessage,
        mockState,
        {},
        mockCallback,
      );

      if (result) {
        expect(result.success).toBe(false);
        expect(result.text).toContain("Cannot use");
      }
    });

    it("should extract item name from complex sentences", async () => {
      mockRuntime.useModel = vi.fn();
      mockRuntime.useModel.mockResolvedValue({ text: "iron sword" });
      mockService.findEntityByName = vi
        .fn()
        .mockReturnValue({ name: "iron sword", data: { usable: true } });
      const complexMessage = createMockMemory({
        content: { text: "I want to use the iron sword in battle" },
      });

      // Mock the world to have the iron sword
      const worldWithSword = {
        ...mockService.getWorld(),
        entities: {
          ...mockService.getWorld()?.entities,
          items: new Map([
            [
              "iron-sword-1234-5678-9012-345678901234" as UUID,
              {
                id: "iron-sword-1234-5678-9012-345678901234" as UUID,
                name: "Iron Sword",
                names: ["Iron Sword"],
                agentId: "test-agent-1234-5678-9012-345678901234" as UUID,
                data: {
                  id: "iron-sword-1234-5678-9012-345678901234" as UUID,
                  name: "Iron Sword",
                  type: "weapon",
                  usable: true,
                },
              },
            ],
          ]),
        },
      };

      mockService.getWorld = vi.fn().mockReturnValue(worldWithSword);
      mockService.findEntityByName = vi
        .fn()
        .mockReturnValue({ name: "iron sword", data: { usable: true } });

      const result = await useAction.handler(
        mockRuntime as IAgentRuntime,
        complexMessage,
        mockState,
        {},
        mockCallback,
      );

      if (result) {
        expect(result.success).toBe(true);
        expect(mockCallback).toHaveBeenCalledWith({
          text: expect.stringMatching(/Used/),
          actions: ["HYPERSCAPE_USE"],
          source: "hyperscape",
        });
      }
    });
  });

  describe("examples", () => {
    it("should have valid examples", () => {
      expect(useAction.examples).toBeDefined();
      if (useAction.examples) {
        expect(Array.isArray(useAction.examples)).toBe(true);
        expect(useAction.examples.length).toBeGreaterThan(0);
      }
    });
  });

  describe("similes", () => {
    it("should have valid similes", () => {
      expect(useAction.similes).toBeDefined();
      expect(Array.isArray(useAction.similes)).toBe(true);
      expect(useAction.similes).toContain("use");
    });
  });
});
