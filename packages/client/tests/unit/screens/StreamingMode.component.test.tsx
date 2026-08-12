import React, { useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@hyperforge/shared";
import {
  STREAMING_BOOT_TIMEOUT_MS,
  StreamingMode,
} from "../../../src/screens/StreamingMode";

type Listener = (payload?: unknown) => void;

const gameClientState = vi.hoisted(() => ({
  mode: "setup" as "setup" | "init-error" | "stall",
  wsUrl: null as string | null,
  world: null as ReturnType<typeof createMockWorld> | null,
}));

function createMockWorld() {
  const listeners = new Map<string, Set<Listener>>();
  const createReadyAgent = (id: string, z: number) => {
    const position = { x: 350.5, y: 24.2, z };
    return {
      id,
      data: { id, characterId: id },
      active: true,
      position,
      node: { position, visible: true },
      base: { position, visible: true },
      avatar: {
        instance: { raw: { scene: { visible: true } } },
      },
    };
  };
  const players = new Map([
    ["agent-a", createReadyAgent("agent-a", 405.35)],
    ["agent-b", createReadyAgent("agent-b", 406.65)],
  ]);
  const equipmentVisuals = {
    setStreamingDuelEquipmentVisualContract: vi.fn(),
    getStreamingDuelEquipmentVisualReadiness: () => ({
      configured: true,
      ready: true,
      cycleId: "cycle-1",
      requiredCount: 0,
      readyCount: 0,
      unresolved: [],
      attachmentMismatches: [],
    }),
  };
  const world = {
    entities: {
      get: (id: string) => players.get(id) ?? null,
      players,
      items: new Map(),
    },
    getSystem: (name: string) => {
      if (name === "prefs") {
        return {
          setDPR: vi.fn(),
          setShadows: vi.fn(),
          setPostprocessing: vi.fn(),
          setBloom: vi.fn(),
          setColorGrading: vi.fn(),
          setDepthBlur: vi.fn(),
          setWaterReflections: vi.fn(),
          setEntityHighlighting: vi.fn(),
        };
      }
      if (name === "terrain") {
        return {
          isReady: () => true,
        };
      }
      if (name === "duel-arena-visuals") {
        return {
          isReady: () => true,
        };
      }
      if (name === "equipment-visual") return equipmentVisuals;
      if (name === "client-input") {
        return {
          setEnabled: vi.fn(),
        };
      }
      if (name === "music-system") {
        return {
          setCategoryLock: vi.fn(),
        };
      }
      return null;
    },
    on: (event: string, listener: Listener) => {
      const bucket = listeners.get(event) ?? new Set<Listener>();
      bucket.add(listener);
      listeners.set(event, bucket);
    },
    off: (event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    },
    emitLocal: (event: string, payload?: unknown) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
  };
  return world;
}

vi.mock("../../../src/lib/api-config", () => ({
  GAME_API_URL: "http://localhost:5555",
  GAME_WS_URL: "ws://localhost:5555/ws",
}));

vi.mock("../../../src/lib/streamingAccessToken", () => ({
  getStreamingAccessToken: vi.fn(() => "stream-token"),
}));

vi.mock("../../../src/screens/GameClient", () => ({
  GameClient: ({
    wsUrl,
    onSetup,
    onInitError,
  }: {
    wsUrl: string;
    onSetup: (world: ReturnType<typeof createMockWorld>) => void;
    onInitError?: (error: string | null) => void;
  }) => {
    useEffect(() => {
      gameClientState.wsUrl = wsUrl;
      if (gameClientState.mode === "init-error") {
        onInitError?.("boom");
        return;
      }
      if (gameClientState.mode === "stall") return;
      const world = createMockWorld();
      gameClientState.world = world;
      onSetup(world);
      world.emitLocal(EventType.READY);
    }, [onInitError, onSetup, wsUrl]);

    return <div data-testid="game-client" />;
  },
}));

vi.mock("../../../src/screens/LoadingScreen", () => ({
  LoadingScreen: ({
    message,
    completionStage,
  }: {
    message: string;
    completionStage?: string;
  }) => (
    <div data-testid="loading-screen">
      <span>{message}</span>
      <span>{completionStage}</span>
    </div>
  ),
}));

vi.mock("../../../src/components/streaming/StreamingOverlay", () => ({
  StreamingOverlay: ({
    state,
  }: {
    state: {
      cycle?: { phase?: string };
      terminalNotice?: { outcome?: string } | null;
    } | null;
  }) => (
    <div data-testid="streaming-overlay">
      {state?.terminalNotice?.outcome === "cancelled"
        ? "CANCELLED"
        : (state?.cycle?.phase ?? "NONE")}
    </div>
  ),
}));

function createStreamingState(
  phase: "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" = "FIGHTING",
) {
  return {
    type: "STREAMING_STATE_UPDATE" as const,
    cycle: {
      cycleId: "cycle-1",
      phase,
      cycleStartTime: 1_000,
      phaseStartTime: 1_100,
      phaseEndTime: 2_000,
      timeRemaining: 500,
      agent1: {
        id: "agent-a",
        name: "Agent A",
        provider: "provider-a",
        model: "model-a",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        equipment: {},
        inventory: [],
        rank: 1,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      agent2: {
        id: "agent-b",
        name: "Agent B",
        provider: "provider-b",
        model: "model-b",
        hp: 9,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        equipment: {},
        inventory: [],
        rank: 2,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      countdown: null,
      fightStartTime: 1_200,
      arenaPositions: {
        agent1: [1, 0, 1] as [number, number, number],
        agent2: [4, 0, 4] as [number, number, number],
      },
      winnerId: null,
      winnerName: null,
      winReason: null,
    },
    leaderboard: [],
    cameraTarget: null,
  };
}

function publishStreamingPerformanceSnapshot(
  updatedAt: number,
  uptimeMs: number,
): void {
  (
    window as Window & {
      __HYPERIA_STREAM_PERFORMANCE__?: unknown;
    }
  ).__HYPERIA_STREAM_PERFORMANCE__ = {
    schemaVersion: 1,
    updatedAt,
    uptimeMs,
    overall: {
      frames: Math.floor(uptimeMs / 16),
      renderer: {
        textures: { latest: 20 },
        geometries: { latest: 30 },
      },
    },
    resources: null,
    longFrames: [],
  };
}

describe("StreamingMode component", () => {
  beforeEach(() => {
    gameClientState.mode = "setup";
    gameClientState.wsUrl = null;
    gameClientState.world = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => createStreamingState(),
      })),
    );
    (
      window as Window & {
        __HYPERIA_STREAM_READY__?: boolean;
        __HYPERIA_STREAM_RENDERER_HEALTH__?: unknown;
        __HYPERIA_STREAM_STATE__?: unknown;
        __HYPERIA_STREAM_SCENE_DIAGNOSTICS__?: unknown;
      }
    ).__HYPERIA_STREAM_READY__ = false;
    (
      window as Window & {
        __HYPERIA_STREAM_RENDERER_HEALTH__?: unknown;
      }
    ).__HYPERIA_STREAM_RENDERER_HEALTH__ = null;
    (
      window as Window & {
        __HYPERIA_STREAM_STATE__?: unknown;
      }
    ).__HYPERIA_STREAM_STATE__ = null;
    (
      window as Window & {
        __HYPERIA_STREAM_SCENE_DIAGNOSTICS__?: unknown;
      }
    ).__HYPERIA_STREAM_SCENE_DIAGNOSTICS__ = null;
    (
      window as Window & {
        __HYPERIA_STREAM_PERFORMANCE__?: unknown;
      }
    ).__HYPERIA_STREAM_PERFORMANCE__ = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("passes the cached stream token through to the streaming websocket url", async () => {
    render(<StreamingMode />);

    await waitFor(() => {
      expect(gameClientState.wsUrl).toContain("streamToken=stream-token");
    });
  });

  it("dismisses the loading overlay only after the stream is ready and updates readiness globals", async () => {
    publishStreamingPerformanceSnapshot(1_000, 1_000);
    const { queryByTestId, getByTestId, unmount } = render(<StreamingMode />);

    expect(getByTestId("loading-screen")).toBeTruthy();

    await waitFor(() => {
      expect(
        (
          window as Window & {
            __HYPERIA_STREAM_SCENE_READINESS__?: {
              coldRender?: { lastSnapshotUpdatedAt?: number | null };
            } | null;
          }
        ).__HYPERIA_STREAM_SCENE_READINESS__?.coldRender?.lastSnapshotUpdatedAt,
      ).toBe(1_000);
    });
    expect(queryByTestId("loading-screen")).toBeTruthy();

    publishStreamingPerformanceSnapshot(11_000, 11_000);
    await waitFor(() => {
      expect(
        (
          window as Window & {
            __HYPERIA_STREAM_SCENE_READINESS__?: {
              coldRender?: { lastSnapshotUpdatedAt?: number | null };
            } | null;
          }
        ).__HYPERIA_STREAM_SCENE_READINESS__?.coldRender?.lastSnapshotUpdatedAt,
      ).toBe(11_000);
    });
    expect(queryByTestId("loading-screen")).toBeTruthy();

    publishStreamingPerformanceSnapshot(12_000, 12_000);

    await waitFor(
      () => {
        expect(queryByTestId("loading-screen")).toBeNull();
        expect(
          (window as Window & { __HYPERIA_STREAM_READY__?: boolean })
            .__HYPERIA_STREAM_READY__,
        ).toBe(true);
        expect(getByTestId("streaming-overlay").textContent).toBe("FIGHTING");
        expect(
          (
            window as Window & {
              __HYPERIA_STREAM_STATE__?: {
                cycle?: { cycleId?: string; phase?: string };
              } | null;
            }
          ).__HYPERIA_STREAM_STATE__,
        ).toMatchObject({
          cycle: { cycleId: "cycle-1", phase: "FIGHTING" },
        });
        expect(
          (
            window as Window & {
              __HYPERIA_STREAM_SCENE_DIAGNOSTICS__?: {
                cycleId?: string;
                phase?: string;
              } | null;
            }
          ).__HYPERIA_STREAM_SCENE_DIAGNOSTICS__,
        ).toMatchObject({ cycleId: "cycle-1", phase: "FIGHTING" });
        expect(
          (
            window as Window & {
              __HYPERIA_STREAM_SCENE_READINESS__?: { ready?: boolean } | null;
            }
          ).__HYPERIA_STREAM_SCENE_READINESS__,
        ).toMatchObject({ ready: true });
      },
      { timeout: 3_500 },
    );

    unmount();
    expect(
      (window as Window & { __HYPERIA_STREAM_STATE__?: unknown })
        .__HYPERIA_STREAM_STATE__,
    ).toBeNull();
    expect(
      (window as Window & { __HYPERIA_STREAM_SCENE_DIAGNOSTICS__?: unknown })
        .__HYPERIA_STREAM_SCENE_DIAGNOSTICS__,
    ).toBeNull();
  });

  it("renders and clears a terminal notice even when the rest of the visible state is unchanged", async () => {
    const { getByTestId } = render(<StreamingMode />);

    await waitFor(() => {
      expect(getByTestId("streaming-overlay").textContent).toBe("FIGHTING");
    });

    const unchangedFight = createStreamingState();
    const terminalNotice = {
      cycleId: unchangedFight.cycle.cycleId,
      duelId: "duel-1",
      outcome: "cancelled" as const,
      reason: "both_agents_lost_during_prep",
      occurredAt: 2_000,
      expiresAt: 12_000,
      agent1Id: unchangedFight.cycle.agent1.id,
      agent1Name: unchangedFight.cycle.agent1.name,
      agent2Id: unchangedFight.cycle.agent2.id,
      agent2Name: unchangedFight.cycle.agent2.name,
    };

    act(() => {
      gameClientState.world?.emitLocal("streaming:state:update", {
        ...unchangedFight,
        terminalNotice,
      });
    });

    await waitFor(() => {
      expect(getByTestId("streaming-overlay").textContent).toBe("CANCELLED");
    });

    act(() => {
      gameClientState.world?.emitLocal("streaming:state:update", {
        ...unchangedFight,
        terminalNotice: null,
      });
    });

    await waitFor(() => {
      expect(getByTestId("streaming-overlay").textContent).toBe("FIGHTING");
    });
  });

  it("publishes the latest authority and scene identity even when React presentation is throttled", async () => {
    render(<StreamingMode />);

    await waitFor(() => {
      expect(
        (
          window as Window & {
            __HYPERIA_STREAM_STATE__?: {
              cycle?: { cycleId?: string };
            } | null;
          }
        ).__HYPERIA_STREAM_STATE__?.cycle?.cycleId,
      ).toBe("cycle-1");
    });

    const baseline = createStreamingState();
    const nextAuthority = {
      ...baseline,
      cycle: { ...baseline.cycle, cycleId: "cycle-2" },
      cameraTarget: "agent-b",
    };
    act(() => {
      gameClientState.world?.emitLocal("streaming:state:update", nextAuthority);
    });

    await waitFor(() => {
      expect(
        (
          window as Window & {
            __HYPERIA_STREAM_STATE__?: {
              cycle?: { cycleId?: string };
              cameraTarget?: string | null;
            } | null;
            __HYPERIA_STREAM_SCENE_DIAGNOSTICS__?: {
              cycleId?: string;
              camera?: { expectedTargetId?: string | null };
            } | null;
          }
        ).__HYPERIA_STREAM_STATE__,
      ).toMatchObject({
        cycle: { cycleId: "cycle-2" },
        cameraTarget: "agent-b",
      });
      expect(
        (
          window as Window & {
            __HYPERIA_STREAM_SCENE_DIAGNOSTICS__?: {
              cycleId?: string;
              camera?: { expectedTargetId?: string | null };
            } | null;
          }
        ).__HYPERIA_STREAM_SCENE_DIAGNOSTICS__,
      ).toMatchObject({
        cycleId: "cycle-2",
        camera: { expectedTargetId: "agent-b" },
      });
    });
  });

  it("keeps the renderer degraded when initialization fails", async () => {
    gameClientState.mode = "init-error";

    render(<StreamingMode />);

    await waitFor(() => {
      expect(
        (
          window as Window & {
            __HYPERIA_STREAM_READY__?: boolean;
            __HYPERIA_STREAM_RENDERER_HEALTH__?: {
              degradedReason?: string | null;
            } | null;
          }
        ).__HYPERIA_STREAM_READY__,
      ).toBe(false);
      expect(
        (
          window as Window & {
            __HYPERIA_STREAM_RENDERER_HEALTH__?: {
              degradedReason?: string | null;
            } | null;
          }
        ).__HYPERIA_STREAM_RENDERER_HEALTH__?.degradedReason,
      ).toBe("initialization_failed");
      expect(
        document.querySelector("[data-testid='stream-failure']"),
      ).toHaveTextContent("Stream temporarily unavailable");
      expect(document.querySelector("button")).toHaveTextContent(
        "Retry stream",
      );
    });
  });

  it("replaces a stalled boot with a bounded retry state", async () => {
    vi.useFakeTimers();
    gameClientState.mode = "stall";

    const { getByRole } = render(<StreamingMode />);
    await act(async () => {
      vi.advanceTimersByTime(STREAMING_BOOT_TIMEOUT_MS);
      await Promise.resolve();
    });

    expect(getByRole("alert")).toHaveTextContent("Arena took too long to load");
    expect(getByRole("button", { name: "Retry stream" })).toBeEnabled();
    expect(
      (
        window as Window & {
          __HYPERIA_STREAM_BOOT_STATUS__?: string | null;
        }
      ).__HYPERIA_STREAM_BOOT_STATUS__,
    ).toBe("error:boot_timeout");

    vi.useRealTimers();
  });
});
