import { describe, expect, it, vi } from "vitest";
import { questProvider } from "../providers/questProvider";

function createMockRuntime(hasService = true) {
  const service = hasService
    ? {
        isConnected: vi.fn().mockReturnValue(true),
        getQuestState: vi.fn().mockReturnValue([]),
        getPlayerEntity: vi.fn().mockReturnValue({
          position: [100, 10, 100],
          items: [],
          inCombat: false,
        }),
        getNearbyEntities: vi.fn().mockReturnValue([]),
      }
    : null;

  return {
    getService: vi.fn().mockReturnValue(service),
    service,
  };
}

describe("questProvider", () => {
  it("returns empty result when service unavailable", async () => {
    const runtime = createMockRuntime(false);
    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toBe("");
    expect(result.data).toEqual({});
  });

  it("returns empty result when not connected", async () => {
    const runtime = createMockRuntime(true);
    runtime.service!.isConnected.mockReturnValue(false);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toBe("");
  });

  it("shows no-quests message when quest state is empty", async () => {
    const runtime = createMockRuntime(true);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toContain("No Active Quests");
    expect(result.values!.hasActiveQuests).toBe(false);
    expect(result.values!.questCount).toBe(0);
  });

  it("returns quest data when quests exist", async () => {
    const runtime = createMockRuntime(true);
    runtime.service!.getQuestState.mockReturnValue([
      {
        questId: "goblin_slayer",
        name: "Goblin Slayer",
        status: "in_progress",
        description: "Kill goblins",
      },
    ]);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toContain("Active Quests");
    expect(result.text).toContain("Goblin Slayer");
    expect(result.text).toContain("in_progress");
    expect(result.values!.hasActiveQuests).toBe(true);
    expect(result.values!.questCount).toBe(1);
  });

  it("flags ready_to_complete quests", async () => {
    const runtime = createMockRuntime(true);
    runtime.service!.getQuestState.mockReturnValue([
      {
        questId: "goblin_slayer",
        name: "Goblin Slayer",
        status: "ready_to_complete",
      },
    ]);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toContain("READY TO TURN IN");
    expect(result.values!.hasReadyQuests).toBe(true);
  });

  it("shows stage progress when available", async () => {
    const runtime = createMockRuntime(true);
    runtime.service!.getQuestState.mockReturnValue([
      {
        questId: "goblin_slayer",
        name: "Goblin Slayer",
        status: "in_progress",
        stageProgress: { kills: 7 },
      },
    ]);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toContain("kills");
    expect(result.text).toContain("7");
  });

  it("shows nearby NPCs with roles", async () => {
    const runtime = createMockRuntime(true);
    runtime.service!.getNearbyEntities.mockReturnValue([
      {
        id: "npc-1",
        name: "Captain Rowan",
        type: "npc",
        entityType: "quest_giver",
        position: [105, 10, 100],
      },
      {
        id: "npc-2",
        name: "General Store",
        type: "npc",
        entityType: "shopkeeper",
        position: [110, 10, 100],
      },
    ]);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toContain("Captain Rowan");
    expect(result.text).toContain("Quest Giver");
    expect(result.text).toContain("General Store");
    expect(result.text).toContain("Shop");
    expect(result.values!.nearbyNpcCount).toBe(2);
  });

  it("shows no-NPCs message when none nearby", async () => {
    const runtime = createMockRuntime(true);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toContain("No NPCs Nearby");
  });

  it("returns quests data in result.data", async () => {
    const runtime = createMockRuntime(true);
    runtime.service!.getQuestState.mockReturnValue([
      {
        questId: "test_quest",
        name: "Test",
        status: "in_progress",
      },
    ]);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    const data = result.data as { quests: unknown[] };
    expect(data.quests).toHaveLength(1);
  });

  it("handles multiple active quests", async () => {
    const runtime = createMockRuntime(true);
    runtime.service!.getQuestState.mockReturnValue([
      { questId: "q1", name: "Quest 1", status: "in_progress" },
      { questId: "q2", name: "Quest 2", status: "ready_to_complete" },
    ]);

    const result = await questProvider.get(
      runtime as never,
      {} as never,
      {} as never,
    );

    expect(result.text).toContain("Quest 1");
    expect(result.text).toContain("Quest 2");
    expect(result.values!.questCount).toBe(2);
    expect(result.values!.hasReadyQuests).toBe(true);
  });
});
