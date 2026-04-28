import React, { useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@hyperscape/shared";
import { StreamingMode } from "../../../src/screens/StreamingMode";

type Listener = (payload?: unknown) => void;

const gameClientState = vi.hoisted(() => ({
  mode: "setup" as "setup" | "init-error",
  wsUrl: null as string | null,
  world: null as ReturnType<typeof createMockWorld> | null,
  emitReadyEvent: true,
}));

function createMockWorld() {
  const listeners = new Map<string, Set<Listener>>();
  const world = {
    entities: {
      get: () => null,
      players: new Map(),
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
  refreshApiConfig: () => ({
    cdnUrl: "https://runtime.example/game-assets",
    elizaOsUrl: "http://localhost:5555",
    gameApiUrl: "https://runtime.example",
    gameWsUrl: "wss://runtime.example/ws",
  }),
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
      const world = createMockWorld();
      gameClientState.world = world;
      onSetup(world);
      if (gameClientState.emitReadyEvent) {
        world.emitLocal(EventType.READY);
      }
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
    state: { cycle?: { phase?: string } } | null;
  }) => (
    <div data-testid="streaming-overlay">{state?.cycle?.phase ?? "NONE"}</div>
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

describe("StreamingMode component", () => {
  beforeEach(() => {
    gameClientState.mode = "setup";
    gameClientState.wsUrl = null;
    gameClientState.world = null;
    gameClientState.emitReadyEvent = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => createStreamingState(),
      })),
    );
    (
      window as Window & {
        __HYPERSCAPE_STREAM_BOOT_READY__?: boolean;
        __HYPERSCAPE_STREAM_READY__?: boolean;
        __HYPERSCAPE_STREAM_RENDERER_HEALTH__?: unknown;
      }
    ).__HYPERSCAPE_STREAM_BOOT_READY__ = false;
    (
      window as Window & {
        __HYPERSCAPE_STREAM_READY__?: boolean;
        __HYPERSCAPE_STREAM_RENDERER_HEALTH__?: unknown;
      }
    ).__HYPERSCAPE_STREAM_READY__ = false;
    (
      window as Window & {
        __HYPERSCAPE_STREAM_RENDERER_HEALTH__?: unknown;
      }
    ).__HYPERSCAPE_STREAM_RENDERER_HEALTH__ = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("passes the cached stream token through to the streaming websocket url", async () => {
    render(<StreamingMode />);

    await waitFor(() => {
      expect(gameClientState.wsUrl).toContain("streamToken=stream-token");
      expect(gameClientState.wsUrl).toContain("wss://runtime.example/ws");
    });
  });

  it("dismisses the loading overlay only after the stream is ready and updates readiness globals", async () => {
    const { queryByTestId, getByTestId } = render(<StreamingMode />);

    expect(getByTestId("loading-screen")).toBeTruthy();

    await waitFor(() => {
      expect(queryByTestId("loading-screen")).toBeNull();
      expect(
        (
          window as Window & {
            __HYPERSCAPE_STREAM_BOOT_READY__?: boolean;
          }
        ).__HYPERSCAPE_STREAM_BOOT_READY__,
      ).toBe(true);
      expect(
        (window as Window & { __HYPERSCAPE_STREAM_READY__?: boolean })
          .__HYPERSCAPE_STREAM_READY__,
      ).toBe(true);
      expect(getByTestId("streaming-overlay").textContent).toBe("FIGHTING");
    });
  });

  it("keeps the loading overlay up without a READY event even when stream data arrives", async () => {
    gameClientState.emitReadyEvent = false;

    const { queryByTestId, getByTestId } = render(<StreamingMode />);

    expect(getByTestId("loading-screen")).toBeTruthy();

    await waitFor(() => {
      expect(queryByTestId("loading-screen")).toBeTruthy();
      expect(
        (
          window as Window & {
            __HYPERSCAPE_STREAM_BOOT_READY__?: boolean;
            __HYPERSCAPE_STREAM_READY__?: boolean;
          }
        ).__HYPERSCAPE_STREAM_BOOT_READY__,
      ).toBe(false);
      expect(
        (window as Window & { __HYPERSCAPE_STREAM_READY__?: boolean })
          .__HYPERSCAPE_STREAM_READY__,
      ).toBe(false);
      expect(getByTestId("streaming-overlay").textContent).toBe("FIGHTING");
    });
  });

  it("keeps the loading overlay up when websocket state arrives before READY", async () => {
    gameClientState.emitReadyEvent = false;

    const { queryByTestId, getByTestId } = render(<StreamingMode />);

    await waitFor(() => {
      expect(gameClientState.world).toBeTruthy();
    });

    act(() => {
      gameClientState.world?.emitLocal(
        "streaming:state:update",
        createStreamingState(),
      );
    });

    await waitFor(() => {
      expect(queryByTestId("loading-screen")).toBeTruthy();
      expect(
        (
          window as Window & {
            __HYPERSCAPE_STREAM_BOOT_READY__?: boolean;
            __HYPERSCAPE_STREAM_READY__?: boolean;
          }
        ).__HYPERSCAPE_STREAM_BOOT_READY__,
      ).toBe(false);
      expect(
        (window as Window & { __HYPERSCAPE_STREAM_READY__?: boolean })
          .__HYPERSCAPE_STREAM_READY__,
      ).toBe(false);
      expect(getByTestId("streaming-overlay").textContent).toBe("FIGHTING");
    });
  });

  it("keeps the renderer degraded when initialization fails", async () => {
    gameClientState.mode = "init-error";

    render(<StreamingMode />);

    await waitFor(() => {
      expect(
        (
          window as Window & {
            __HYPERSCAPE_STREAM_READY__?: boolean;
            __HYPERSCAPE_STREAM_RENDERER_HEALTH__?: {
              degradedReason?: string | null;
            } | null;
          }
        ).__HYPERSCAPE_STREAM_READY__,
      ).toBe(false);
      expect(
        (
          window as Window & {
            __HYPERSCAPE_STREAM_RENDERER_HEALTH__?: {
              degradedReason?: string | null;
            } | null;
          }
        ).__HYPERSCAPE_STREAM_RENDERER_HEALTH__?.degradedReason,
      ).toBe("initialization_failed");
    });
  });
});
