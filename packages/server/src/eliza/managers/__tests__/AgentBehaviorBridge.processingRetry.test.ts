import { describe, expect, it, vi } from "vitest";

import type { AgentTickOutput } from "../../worker/workerTypes.js";
import type { AgentInstance } from "../AgentBehaviorTicker.js";
import { AgentBehaviorBridge } from "../AgentBehaviorBridge.js";

type BridgeProcessingInternals = {
  applyTickResult(result: AgentTickOutput): Promise<void>;
};

function makeInstance(
  executeFiremake: ReturnType<typeof vi.fn>,
): AgentInstance {
  return {
    config: {
      characterId: "processing-retry-agent",
      accountId: "processing-retry-account",
      name: "Processing Retry Agent",
    },
    service: {
      executeFiremake,
      getQuestState: vi.fn().mockReturnValue([]),
      getAvailableQuests: vi.fn().mockReturnValue([]),
      getGameState: vi.fn().mockReturnValue(null),
    },
    chatRuntime: null,
    state: "running",
    startedAt: Date.now(),
    lastActivity: 0,
    behaviorEpoch: 7,
    goal: null,
    questsAccepted: new Set(),
    currentTargetId: null,
    lastGatherTargetId: null,
    lastGatherQueuedAt: 0,
    lastCombatChatAt: 0,
    pendingChatReaction: null,
    navigationTarget: null,
    operatorCommandAt: 0,
    ordinaryProcessingRetries: [],
  } as unknown as AgentInstance;
}

function firemakingResult(): AgentTickOutput {
  return {
    characterId: "processing-retry-agent",
    behaviorEpoch: 7,
    action: { type: "firemake", logsItemId: "logs" },
    updatedState: {
      goal: {
        type: "provisioning",
        description: "Process an authored Firemaking recipe",
      },
      questsAccepted: [],
      currentTargetId: null,
      lastGatherTargetId: null,
      lastGatherQueuedAt: 0,
      lastCombatChatAt: 0,
    },
  };
}

describe("AgentBehaviorBridge processing retry authority", () => {
  it("records rejection truth, blocks an immediate stale retry, and clears after a later success", async () => {
    const executeFiremake = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const instance = makeInstance(executeFiremake);
    const bridge = new AgentBehaviorBridge(
      { entities: { get: vi.fn() } } as never,
      (characterId) =>
        characterId === instance.config.characterId ? instance : undefined,
      () => [instance.config.characterId],
    );
    const internals = bridge as unknown as BridgeProcessingInternals;

    await internals.applyTickResult(firemakingResult());
    expect(executeFiremake).toHaveBeenCalledTimes(1);
    expect(instance.ordinaryProcessingRetries).toEqual([
      expect.objectContaining({
        actionType: "firemake",
        intentId: "logs",
        consecutiveFailures: 1,
      }),
    ]);

    await internals.applyTickResult(firemakingResult());
    expect(executeFiremake).toHaveBeenCalledTimes(1);

    instance.ordinaryProcessingRetries[0].retryAfter = Date.now() - 1;
    await internals.applyTickResult(firemakingResult());
    expect(executeFiremake).toHaveBeenCalledTimes(2);
    expect(instance.ordinaryProcessingRetries).toEqual([]);
  });
});
