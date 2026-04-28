import { describe, it, expect, vi } from "vitest";
import { buildCaptureControlStatus } from "../../../src/lib/captureStatus";
import {
  deriveStreamingRendererHealth,
  shouldDismissStreamingLoading,
  shouldReuseStreamingState,
  shouldShowStreamingLoadingOverlay,
  type StreamingState,
} from "../../../src/screens/StreamingMode";

function createTestAgent(id: string, name: string) {
  return {
    id,
    name,
    provider: "provider",
    model: "model",
    hp: 10,
    maxHp: 10,
    combatLevel: 1,
    wins: 0,
    losses: 0,
    damageDealtThisFight: 0,
    highestHit: 0,
    attacksLanded: 0,
    healsUsed: 0,
    equipment: {},
    inventory: [],
    rank: 1,
    headToHeadWins: 0,
    headToHeadLosses: 0,
  };
}

function createStreamingState(
  overrides: Partial<StreamingState> = {},
): StreamingState {
  const base: StreamingState = {
    type: "STREAMING_STATE_UPDATE",
    cycle: {
      cycleId: "cycle-1",
      duelId: "duel-1",
      phase: "FIGHTING",
      cycleStartTime: 1_000,
      phaseStartTime: 1_100,
      phaseEndTime: 30_000,
      timeRemaining: 20_000,
      agent1: createTestAgent("agent-a", "Agent A"),
      agent2: createTestAgent("agent-b", "Agent B"),
      betOpenTime: 1_000,
      betCloseTime: 10_000,
      countdown: null,
      fightStartTime: 10_500,
      arenaPositions: {
        agent1: [1, 0, 1],
        agent2: [4, 0, 4],
      },
      winnerId: null,
      winnerName: null,
      winReason: null,
    },
    leaderboard: [
      {
        rank: 1,
        characterId: "agent-a",
        name: "Agent A",
        provider: "provider",
        model: "model",
        wins: 1,
        losses: 0,
        winRate: 1,
        combatLevel: 1,
        currentStreak: 1,
      },
    ],
    cameraTarget: "agent-a",
  };

  return {
    ...base,
    ...overrides,
    cycle: {
      ...base.cycle,
      ...overrides.cycle,
    },
    leaderboard: overrides.leaderboard ?? base.leaderboard,
  };
}

describe("buildCaptureControlStatus", () => {
  it("emits absolute and relative last-chunk fields while preserving the legacy age field", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);
    try {
      expect(
        buildCaptureControlStatus({
          recorderState: "recording",
          wsReadyState: WebSocket.OPEN,
          chunkCount: 4,
          bytesSent: 2048,
          startedAt: 9_000,
          lastChunkAt: 9_750,
          wsBufferedAmount: 256,
          heapUsedBytes: 1024,
          heapLimitBytes: 8192,
        }),
      ).toEqual({
        recording: true,
        wsConnected: true,
        chunkCount: 4,
        bytesSent: 2048,
        uptime: 1000,
        lastChunkAt: 9750,
        lastChunkAgeMs: 250,
        lastChunkMs: 250,
        wsBufferedAmount: 256,
        heapUsedBytes: 1024,
        heapLimitBytes: 8192,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe("shouldReuseStreamingState", () => {
  it("reuses state when only the subsecond timer remainder changes", () => {
    const prev = createStreamingState();
    const next = createStreamingState({
      cycle: {
        ...prev.cycle,
        timeRemaining: prev.cycle.timeRemaining + 250,
      },
    });

    expect(shouldReuseStreamingState(prev, next)).toBe(true);
  });

  it("does not reuse state when the active duel id changes", () => {
    const prev = createStreamingState();
    const next = createStreamingState({
      cycle: {
        ...prev.cycle,
        duelId: "duel-2",
      },
    });

    expect(shouldReuseStreamingState(prev, next)).toBe(false);
  });

  it("does not reuse state when visible leaderboard rows change", () => {
    const prev = createStreamingState();
    const next = createStreamingState({
      leaderboard: [
        {
          ...prev.leaderboard[0]!,
          wins: 2,
          currentStreak: 2,
        },
      ],
    });

    expect(shouldReuseStreamingState(prev, next)).toBe(false);
  });

  it("does not reuse state when agent identity changes without HP movement", () => {
    const prev = createStreamingState();
    const next = createStreamingState({
      cycle: {
        ...prev.cycle,
        agent1: createTestAgent("agent-c", "Agent C"),
      },
    });

    expect(shouldReuseStreamingState(prev, next)).toBe(false);
  });

  it("does not reuse state when visible equipment changes", () => {
    const prev = createStreamingState();
    const next = createStreamingState({
      cycle: {
        ...prev.cycle,
        agent1: {
          ...prev.cycle.agent1!,
          equipment: {
            weapon: "dragon-scimitar",
          },
        },
      },
    });

    expect(shouldReuseStreamingState(prev, next)).toBe(false);
  });
});

describe("shouldDismissStreamingLoading", () => {
  it("keeps the overlay up until streaming state is present", () => {
    expect(
      shouldDismissStreamingLoading({
        connected: true,
        worldReady: false,
        terrainReady: true,
        hasStreamingState: false,
        initError: null,
        needsCameraLock: false,
        cameraLocked: false,
        phase: "ANNOUNCEMENT",
      }),
    ).toBe(false);
  });

  it("keeps the overlay up until the camera is locked when required", () => {
    expect(
      shouldDismissStreamingLoading({
        connected: true,
        worldReady: true,
        terrainReady: true,
        hasStreamingState: true,
        initError: null,
        needsCameraLock: true,
        cameraLocked: false,
        phase: "FIGHTING",
      }),
    ).toBe(false);
  });

  it("keeps the overlay up while disconnected", () => {
    expect(
      shouldDismissStreamingLoading({
        connected: false,
        worldReady: true,
        terrainReady: true,
        hasStreamingState: true,
        initError: null,
        needsCameraLock: false,
        cameraLocked: false,
        phase: "COUNTDOWN",
      }),
    ).toBe(false);
  });

  it("keeps the overlay up until terrain is ready", () => {
    expect(
      shouldDismissStreamingLoading({
        connected: true,
        worldReady: true,
        terrainReady: false,
        hasStreamingState: true,
        initError: null,
        needsCameraLock: false,
        cameraLocked: false,
        phase: "COUNTDOWN",
      }),
    ).toBe(false);
  });

  it("keeps the overlay up when the client is in an active duel without streaming state", () => {
    expect(
      shouldDismissStreamingLoading({
        connected: true,
        worldReady: false,
        terrainReady: true,
        hasStreamingState: false,
        initError: null,
        needsCameraLock: false,
        cameraLocked: false,
        phase: "FIGHTING",
      }),
    ).toBe(false);
  });

  it("keeps the overlay up until the world is ready", () => {
    expect(
      shouldDismissStreamingLoading({
        connected: true,
        worldReady: false,
        terrainReady: true,
        hasStreamingState: true,
        initError: null,
        needsCameraLock: false,
        cameraLocked: false,
        phase: "COUNTDOWN",
      }),
    ).toBe(false);
  });

  it("never re-shows the loading overlay after the initial dismissal", () => {
    expect(
      shouldShowStreamingLoadingOverlay({
        initError: null,
        loadingDismissed: true,
      }),
    ).toBe(false);
  });

  it("does not show the loading overlay after an init error", () => {
    expect(
      shouldShowStreamingLoadingOverlay({
        initError: "WebGPU Required",
        loadingDismissed: false,
      }),
    ).toBe(false);
  });

  it("marks a live duel as degraded while the loading overlay is still visible", () => {
    expect(
      deriveStreamingRendererHealth({
        connected: true,
        worldReady: true,
        terrainReady: true,
        hasStreamingState: true,
        initError: null,
        needsCameraLock: true,
        cameraLocked: true,
        loadingDismissed: false,
        phase: "FIGHTING",
        agent1: {
          id: "a",
          name: "Agent A",
          provider: "provider",
          model: "model",
          hp: 10,
          maxHp: 10,
          combatLevel: 1,
          wins: 0,
          losses: 0,
          damageDealtThisFight: 0,
          highestHit: 0,
          attacksLanded: 0,
          healsUsed: 0,
          equipment: {},
          inventory: [],
          rank: 1,
          headToHeadWins: 0,
          headToHeadLosses: 0,
        },
        agent2: {
          id: "b",
          name: "Agent B",
          provider: "provider",
          model: "model",
          hp: 10,
          maxHp: 10,
          combatLevel: 1,
          wins: 0,
          losses: 0,
          damageDealtThisFight: 0,
          highestHit: 0,
          attacksLanded: 0,
          healsUsed: 0,
          equipment: {},
          inventory: [],
          rank: 2,
          headToHeadWins: 0,
          headToHeadLosses: 0,
        },
        arenaPositions: {
          agent1: [1, 0, 1],
          agent2: [3, 0, 3],
        },
      }).degradedReason,
    ).toBe("loading_overlay_active");
  });

  it("marks overlapping arena positions as unhealthy", () => {
    expect(
      deriveStreamingRendererHealth({
        connected: true,
        worldReady: true,
        terrainReady: true,
        hasStreamingState: true,
        initError: null,
        needsCameraLock: false,
        cameraLocked: false,
        loadingDismissed: true,
        phase: "COUNTDOWN",
        agent1: {
          id: "a",
          name: "Agent A",
          provider: "provider",
          model: "model",
          hp: 10,
          maxHp: 10,
          combatLevel: 1,
          wins: 0,
          losses: 0,
          damageDealtThisFight: 0,
          highestHit: 0,
          attacksLanded: 0,
          healsUsed: 0,
          equipment: {},
          inventory: [],
          rank: 1,
          headToHeadWins: 0,
          headToHeadLosses: 0,
        },
        agent2: {
          id: "b",
          name: "Agent B",
          provider: "provider",
          model: "model",
          hp: 10,
          maxHp: 10,
          combatLevel: 1,
          wins: 0,
          losses: 0,
          damageDealtThisFight: 0,
          highestHit: 0,
          attacksLanded: 0,
          healsUsed: 0,
          equipment: {},
          inventory: [],
          rank: 2,
          headToHeadWins: 0,
          headToHeadLosses: 0,
        },
        arenaPositions: {
          agent1: [2, 0, 2],
          agent2: [2, 0, 2],
        },
      }).degradedReason,
    ).toBe("arena_positions_invalid");
  });

  it("reports ready only after the live duel surface is sane and the overlay is gone", () => {
    const health = deriveStreamingRendererHealth({
      connected: true,
      worldReady: true,
      terrainReady: true,
      hasStreamingState: true,
      initError: null,
      needsCameraLock: true,
      cameraLocked: true,
      loadingDismissed: true,
      phase: "FIGHTING",
      agent1: {
        id: "a",
        name: "Agent A",
        provider: "provider",
        model: "model",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 1,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      agent2: {
        id: "b",
        name: "Agent B",
        provider: "provider",
        model: "model",
        hp: 8,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 2,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      arenaPositions: {
        agent1: [1, 0, 1],
        agent2: [4, 0, 4],
      },
    });

    expect(health.ready).toBe(true);
    expect(health.degradedReason).toBeNull();
  });

  it("does not report ready during idle when streaming state is still absent", () => {
    const health = deriveStreamingRendererHealth({
      connected: true,
      worldReady: false,
      terrainReady: true,
      hasStreamingState: false,
      initError: null,
      needsCameraLock: false,
      cameraLocked: false,
      loadingDismissed: true,
      phase: "IDLE",
      agent1: null,
      agent2: null,
      arenaPositions: null,
    });

    expect(health.ready).toBe(false);
    expect(health.degradedReason).toBe("waiting_for_duel_data");
  });

  it("marks the stream as unhealthy when the game client reports an init error", () => {
    const health = deriveStreamingRendererHealth({
      connected: true,
      worldReady: true,
      terrainReady: true,
      hasStreamingState: true,
      initError: "HTTP error! status: 404",
      needsCameraLock: true,
      cameraLocked: true,
      loadingDismissed: true,
      phase: "ANNOUNCEMENT",
      agent1: {
        id: "a",
        name: "Agent A",
        provider: "provider",
        model: "model",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 1,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      agent2: {
        id: "b",
        name: "Agent B",
        provider: "provider",
        model: "model",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 2,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      arenaPositions: {
        agent1: [1, 0, 1],
        agent2: [4, 0, 4],
      },
    });

    expect(health.ready).toBe(false);
    expect(health.degradedReason).toBe("initialization_failed");
  });
});
