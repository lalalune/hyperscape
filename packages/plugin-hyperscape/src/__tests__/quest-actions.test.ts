import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@elizaos/core", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  talkToNpcAction,
  acceptQuestAction,
  completeQuestAction,
  checkQuestAction,
} from "../actions/quests";

function createMockService(overrides: Record<string, unknown> = {}) {
  return {
    isConnected: vi.fn().mockReturnValue(true),
    getPlayerEntity: vi.fn().mockReturnValue({
      position: [100, 10, 100] as [number, number, number],
      inCombat: false,
    }),
    getNearbyEntities: vi.fn().mockReturnValue([
      {
        id: "npc-1",
        name: "Captain Rowan",
        type: "npc",
        entityType: "npc",
        position: [102, 10, 100] as [number, number, number],
      },
    ]),
    getQuestState: vi.fn().mockReturnValue([]),
    executeMove: vi.fn().mockResolvedValue(undefined),
    interactWithEntity: vi.fn(),
    sendQuestAccept: vi.fn(),
    sendQuestComplete: vi.fn(),
    requestQuestList: vi.fn(),
    getGameState: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function createMockRuntime(
  service: ReturnType<typeof createMockService> | null,
) {
  return {
    getService: vi.fn().mockReturnValue(service),
  };
}

describe("quest actions", () => {
  // =========================================================================
  // TALK_TO_NPC
  // =========================================================================
  describe("talkToNpcAction", () => {
    it("validates true when NPCs are nearby", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      expect(await talkToNpcAction.validate(runtime as never)).toBe(true);
    });

    it("validates false when no NPCs nearby", async () => {
      const service = createMockService({
        getNearbyEntities: vi.fn().mockReturnValue([]),
      });
      const runtime = createMockRuntime(service);
      expect(await talkToNpcAction.validate(runtime as never)).toBe(false);
    });

    it("validates false when not connected", async () => {
      const service = createMockService({
        isConnected: vi.fn().mockReturnValue(false),
      });
      const runtime = createMockRuntime(service);
      expect(await talkToNpcAction.validate(runtime as never)).toBe(false);
    });

    it("validates false when service is null", async () => {
      const runtime = createMockRuntime(null);
      expect(await talkToNpcAction.validate(runtime as never)).toBe(false);
    });

    it("validates false when player has no position", async () => {
      const service = createMockService({
        getPlayerEntity: vi.fn().mockReturnValue({ position: null }),
      });
      const runtime = createMockRuntime(service);
      expect(await talkToNpcAction.validate(runtime as never)).toBe(false);
    });

    it("validates false when player is in combat", async () => {
      const service = createMockService({
        getPlayerEntity: vi.fn().mockReturnValue({
          position: [100, 10, 100],
          inCombat: true,
        }),
      });
      const runtime = createMockRuntime(service);
      expect(await talkToNpcAction.validate(runtime as never)).toBe(false);
    });

    it("handler interacts with nearest NPC", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      const result = await talkToNpcAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      expect(service.interactWithEntity).toHaveBeenCalledWith("npc-1", "talk");
      expect((result as { success: boolean }).success).toBe(true);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Talking to Captain Rowan" }),
      );
    });

    it("handler walks to NPC when far away", async () => {
      const service = createMockService({
        getNearbyEntities: vi.fn().mockReturnValue([
          {
            id: "npc-far",
            name: "Distant NPC",
            type: "npc",
            position: [200, 10, 200] as [number, number, number],
          },
        ]),
      });
      const runtime = createMockRuntime(service);

      await talkToNpcAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect(service.executeMove).toHaveBeenCalledWith({
        target: [200, 10, 200],
        runMode: false,
      });
    });

    it("handler does not walk when NPC is close", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);

      await talkToNpcAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect(service.executeMove).not.toHaveBeenCalled();
    });

    it("handler finds NPC by name match", async () => {
      const service = createMockService({
        getNearbyEntities: vi.fn().mockReturnValue([
          {
            id: "npc-a",
            name: "Guard",
            type: "npc",
            position: [101, 10, 100] as [number, number, number],
          },
          {
            id: "npc-b",
            name: "Captain Rowan",
            type: "npc",
            position: [105, 10, 100] as [number, number, number],
          },
        ]),
      });
      const runtime = createMockRuntime(service);

      await talkToNpcAction.handler(
        runtime as never,
        { content: { text: "Captain" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect(service.interactWithEntity).toHaveBeenCalledWith("npc-b", "talk");
    });

    it("handler returns error when service is null", async () => {
      const runtime = createMockRuntime(null);

      const result = await talkToNpcAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect((result as { success: boolean }).success).toBe(false);
    });
  });

  // =========================================================================
  // ACCEPT_QUEST
  // =========================================================================
  describe("acceptQuestAction", () => {
    it("validates true when not_started quests exist in quest state", async () => {
      const service = createMockService({
        getQuestState: vi
          .fn()
          .mockReturnValue([
            {
              questId: "goblin_slayer",
              name: "Goblin Slayer",
              status: "not_started",
            },
          ]),
      });
      const runtime = createMockRuntime(service);
      expect(await acceptQuestAction.validate(runtime as never)).toBe(true);
    });

    it("validates true when NPCs are nearby even without quest state", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      expect(await acceptQuestAction.validate(runtime as never)).toBe(true);
    });

    it("validates false when no NPCs nearby and no available quests", async () => {
      const service = createMockService({
        getNearbyEntities: vi.fn().mockReturnValue([]),
        getQuestState: vi.fn().mockReturnValue([]),
      });
      const runtime = createMockRuntime(service);
      expect(await acceptQuestAction.validate(runtime as never)).toBe(false);
    });

    it("validates false when in combat", async () => {
      const service = createMockService({
        getPlayerEntity: vi.fn().mockReturnValue({
          position: [100, 10, 100],
          inCombat: true,
        }),
      });
      const runtime = createMockRuntime(service);
      expect(await acceptQuestAction.validate(runtime as never)).toBe(false);
    });

    it("handler sends questAccept when not_started quest exists", async () => {
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          {
            questId: "goblin_slayer",
            name: "Goblin Slayer",
            status: "not_started",
            startNpc: "captain_rowan",
          },
        ]),
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      const result = await acceptQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      expect(service.sendQuestAccept).toHaveBeenCalledWith("goblin_slayer");
      expect((result as { success: boolean }).success).toBe(true);
      expect((result as { data: { questId: string } }).data.questId).toBe(
        "goblin_slayer",
      );
    });

    it("handler walks to matching NPC before accepting", async () => {
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          {
            questId: "goblin_slayer",
            name: "Goblin Slayer",
            status: "not_started",
            startNpc: "captain_rowan",
          },
        ]),
        getNearbyEntities: vi.fn().mockReturnValue([
          {
            id: "npc-1",
            name: "Captain Rowan",
            type: "npc",
            position: [200, 10, 200] as [number, number, number],
          },
        ]),
      });
      const runtime = createMockRuntime(service);

      await acceptQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect(service.executeMove).toHaveBeenCalledWith({
        target: [200, 10, 200],
        runMode: false,
      });
      expect(service.sendQuestAccept).toHaveBeenCalledWith("goblin_slayer");
    });

    it("handler falls back to interactWithEntity when no quest state", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);

      await acceptQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect(service.interactWithEntity).toHaveBeenCalledWith("npc-1", "talk");
      expect(service.sendQuestAccept).not.toHaveBeenCalled();
    });

    it("handler returns error when service is null", async () => {
      const runtime = createMockRuntime(null);

      const result = await acceptQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect((result as { success: boolean }).success).toBe(false);
    });

    it("handler refreshes quest list after accepting", async () => {
      vi.useFakeTimers();
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          {
            questId: "goblin_slayer",
            name: "Goblin Slayer",
            status: "not_started",
            startNpc: "captain_rowan",
          },
        ]),
      });
      const runtime = createMockRuntime(service);

      await acceptQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      vi.advanceTimersByTime(1100);
      expect(service.requestQuestList).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // =========================================================================
  // COMPLETE_QUEST
  // =========================================================================
  describe("completeQuestAction", () => {
    it("validates true when quest is ready_to_complete", async () => {
      const service = createMockService({
        getQuestState: vi
          .fn()
          .mockReturnValue([
            { questId: "goblin_slayer", status: "ready_to_complete" },
          ]),
      });
      const runtime = createMockRuntime(service);
      expect(await completeQuestAction.validate(runtime as never)).toBe(true);
    });

    it("validates false when no quests are ready_to_complete", async () => {
      const service = createMockService({
        getQuestState: vi
          .fn()
          .mockReturnValue([
            { questId: "goblin_slayer", status: "in_progress" },
          ]),
      });
      const runtime = createMockRuntime(service);
      expect(await completeQuestAction.validate(runtime as never)).toBe(false);
    });

    it("validates false when quest state is empty", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      expect(await completeQuestAction.validate(runtime as never)).toBe(false);
    });

    it("validates false when in combat", async () => {
      const service = createMockService({
        getPlayerEntity: vi.fn().mockReturnValue({
          position: [100, 10, 100],
          inCombat: true,
        }),
        getQuestState: vi
          .fn()
          .mockReturnValue([
            { questId: "goblin_slayer", status: "ready_to_complete" },
          ]),
      });
      const runtime = createMockRuntime(service);
      expect(await completeQuestAction.validate(runtime as never)).toBe(false);
    });

    it("handler sends questComplete for ready quest", async () => {
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          {
            questId: "goblin_slayer",
            name: "Goblin Slayer",
            status: "ready_to_complete",
            startNpc: "captain_rowan",
          },
        ]),
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      const result = await completeQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      expect(service.sendQuestComplete).toHaveBeenCalledWith("goblin_slayer");
      expect((result as { success: boolean }).success).toBe(true);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("Goblin Slayer"),
        }),
      );
    });

    it("handler returns error when no ready quest exists", async () => {
      const service = createMockService({
        getQuestState: vi
          .fn()
          .mockReturnValue([
            { questId: "goblin_slayer", status: "in_progress" },
          ]),
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      const result = await completeQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      expect(service.sendQuestComplete).not.toHaveBeenCalled();
      expect((result as { success: boolean }).success).toBe(false);
    });

    it("handler refreshes quest list after completing", async () => {
      vi.useFakeTimers();
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          {
            questId: "goblin_slayer",
            name: "Goblin Slayer",
            status: "ready_to_complete",
          },
        ]),
      });
      const runtime = createMockRuntime(service);

      await completeQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      vi.advanceTimersByTime(1100);
      expect(service.requestQuestList).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // =========================================================================
  // CHECK_QUEST
  // =========================================================================
  describe("checkQuestAction", () => {
    it("validates true when connected", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      expect(await checkQuestAction.validate(runtime as never)).toBe(true);
    });

    it("validates false when not connected", async () => {
      const service = createMockService({
        isConnected: vi.fn().mockReturnValue(false),
      });
      const runtime = createMockRuntime(service);
      expect(await checkQuestAction.validate(runtime as never)).toBe(false);
    });

    it("handler reports no active quests when none exist", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      const result = await checkQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      expect((result as { success: boolean }).success).toBe(true);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("No active quests"),
        }),
      );
    });

    it("handler reports active quests with progress", async () => {
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          {
            questId: "goblin_slayer",
            name: "Goblin Slayer",
            status: "in_progress",
            description: "Kill 15 goblins",
            stageProgress: { kills: 7 },
          },
        ]),
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      await checkQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      const callText = callback.mock.calls[0][0].text;
      expect(callText).toContain("Goblin Slayer");
      expect(callText).toContain("in_progress");
      expect(callText).toContain("kills = 7");
    });

    it("handler flags ready_to_complete quests", async () => {
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          {
            questId: "goblin_slayer",
            name: "Goblin Slayer",
            status: "ready_to_complete",
          },
        ]),
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      await checkQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      const callText = callback.mock.calls[0][0].text;
      expect(callText).toContain("READY TO TURN IN");
    });

    it("handler filters out not_started and completed quests", async () => {
      const service = createMockService({
        getQuestState: vi.fn().mockReturnValue([
          { questId: "q1", name: "Done Quest", status: "completed" },
          { questId: "q2", name: "Not Started", status: "not_started" },
          { questId: "q3", name: "Active Quest", status: "in_progress" },
        ]),
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      await checkQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        callback,
      );

      const callText = callback.mock.calls[0][0].text;
      expect(callText).toContain("Active Quest");
      expect(callText).not.toContain("Done Quest");
      expect(callText).not.toContain("Not Started");
    });

    it("handler requests fresh quest list from server", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);

      await checkQuestAction.handler(
        runtime as never,
        { content: { text: "" } } as never,
        undefined,
        undefined,
        vi.fn(),
      );

      expect(service.requestQuestList).toHaveBeenCalled();
    });
  });
});
