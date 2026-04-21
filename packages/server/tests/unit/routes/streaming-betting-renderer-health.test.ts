import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deriveBettingRendererHealth,
  loadExternalRtmpStatusSnapshot,
} from "../../../src/routes/streaming-betting-routes.js";
import type { StreamingDuelCycle } from "../../../src/systems/StreamingDuelScheduler/types.js";

function createCycle(
  overrides: Partial<StreamingDuelCycle> = {},
): StreamingDuelCycle {
  return {
    cycleId: "cycle-1",
    phase: "FIGHTING",
    cycleStartTime: 1_000,
    phaseStartTime: 1_000,
    phaseVersion: 2,
    agent1: {
      characterId: "agent-a",
      name: "Agent A",
      provider: "provider-a",
      model: "model-a",
      combatLevel: 10,
      wins: 7,
      losses: 2,
      currentHp: 25,
      maxHp: 30,
      originalPosition: [1, 2, 3],
      damageDealtThisFight: 4,
      equipment: {},
      inventory: [],
      rank: 1,
      headToHeadWins: 3,
      headToHeadLosses: 1,
    },
    agent2: {
      characterId: "agent-b",
      name: "Agent B",
      provider: "provider-b",
      model: "model-b",
      combatLevel: 11,
      wins: 5,
      losses: 4,
      currentHp: 20,
      maxHp: 30,
      originalPosition: [4, 5, 6],
      damageDealtThisFight: 2,
      equipment: {},
      inventory: [],
      rank: 2,
      headToHeadWins: 1,
      headToHeadLosses: 3,
    },
    duelId: "duel-1",
    duelKeyHex: "0xabcdef",
    arenaId: null,
    betOpenTime: 1_000,
    betCloseTime: 2_000,
    countdownValue: null,
    fightStartTime: null,
    duelEndTime: null,
    arenaPositions: {
      agent1: [10, 11, 12],
      agent2: [20, 21, 22],
    },
    winnerId: null,
    loserId: null,
    winReason: null,
    seed: null,
    replayHash: null,
    ...overrides,
  };
}

describe("deriveBettingRendererHealth", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("loads external RTMP snapshots asynchronously for cache refresh", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "betting-renderer-health-"));
    const statusFile = join(tempDir, "status.json");
    writeFileSync(
      statusFile,
      JSON.stringify({
        destinations: [],
        stats: {},
        updatedAt: Date.now() - 1_000,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: Date.now() - 1_000,
        },
      }),
    );

    await expect(
      loadExternalRtmpStatusSnapshot(statusFile, 15_000),
    ).resolves.toMatchObject({
      rendererHealth: {
        ready: true,
      },
    });
  });

  it("returns guardrail failures for invalid live duel agent state", () => {
    const health = deriveBettingRendererHealth(
      createCycle({
        agent1: {
          ...createCycle().agent1,
          currentHp: 35,
          maxHp: 30,
        },
      }),
      {
        captureStats: {
          clientConnected: true,
          ffmpegRunning: true,
        },
      },
    );

    expect(health.ready).toBe(false);
    expect(health.degradedReason).toBe("invalid_agent_hp");
  });

  it("uses a fresh external RTMP renderer snapshot when available", () => {
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: Date.now() - 1_000,
        rendererHealth: {
          ready: false,
          degradedReason: "loading_overlay_active",
          updatedAt: Date.now() - 1_000,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: false,
        ffmpegRunning: false,
      },
    });

    expect(health).toMatchObject({
      ready: false,
      degradedReason: "loading_overlay_active",
    });
  });

  it("trusts fresh render metrics during active phases over stale explicit false negatives", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: false,
          degradedReason: "renderer_health_stale",
          updatedAt: now,
        },
        metrics: {
          captureFps: 30,
          encodeFps: 30,
          latestRenderTickAt: now,
          latestVisualChangeAt: now,
          visualChangeAgeMs: 200,
        },
        hlsManifest: {
          updatedAt: now,
          mediaSequence: 42,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: false,
        ffmpegRunning: false,
      },
    });

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
    });
  });

  it("keeps a short grace window before treating missing visual change as stale", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(
      createCycle({
        phase: "COUNTDOWN",
        phaseStartTime: now - 2_000,
      }),
      {
        externalStatusSnapshot: {
          destinations: [],
          stats: {},
          updatedAt: now,
          rendererHealth: {
            ready: true,
            degradedReason: null,
            updatedAt: now,
          },
          metrics: {
            captureFps: 60,
            encodeFps: 45,
            latestRenderTickAt: now,
            latestVisualChangeAt: now - 10_000,
            visualChangeAgeMs: 10_000,
          },
          hlsManifest: {
            updatedAt: now,
            mediaSequence: 42,
          },
        },
        externalStatusMaxAgeMs: 15_000,
        captureStats: {
          clientConnected: true,
          ffmpegRunning: true,
        },
      },
    );

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
    });
  });

  it("degrades stale external RTMP renderer snapshots", () => {
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: Date.now() - 20_000,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: Date.now() - 20_000,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: false,
      degradedReason: "renderer_health_stale",
    });
  });

  it("uses the outer external snapshot timestamp for freshness", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: now - 60_000,
        },
        metrics: {
          captureFps: 60,
          encodeFps: 45,
          latestRenderTickAt: now,
          latestVisualChangeAt: now - 4_900,
          visualChangeAgeMs: 4_900,
        },
        hlsManifest: {
          updatedAt: now,
          mediaSequence: 42,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
      updatedAt: now,
    });
  });

  it("reports disconnected capture clients during active duel phases", () => {
    const health = deriveBettingRendererHealth(createCycle(), {
      captureStats: {
        clientConnected: false,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: false,
      degradedReason: "capture_client_disconnected",
    });
  });

  it("reports inactive capture pipelines during active duel phases", () => {
    const health = deriveBettingRendererHealth(createCycle(), {
      captureStats: {
        clientConnected: true,
        ffmpegRunning: false,
      },
    });

    expect(health).toMatchObject({
      ready: false,
      degradedReason: "capture_pipeline_inactive",
    });
  });

  it("treats a fresh local HLS manifest as a healthy self-hosted fallback", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      nowMs: now,
      localHlsManifest: {
        updatedAt: now - 500,
        mediaSequence: 512,
      },
      captureStats: {
        clientConnected: false,
        ffmpegRunning: false,
      },
    });

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
    });
  });

  it("reports stale render ticks when live metrics stop advancing", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: now,
        },
        metrics: {
          captureFps: 30,
          encodeFps: 30,
          latestRenderTickAt: now - 12_000,
          latestVisualChangeAt: now,
          visualChangeAgeMs: 200,
        },
        hlsManifest: {
          updatedAt: now,
          mediaSequence: 42,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: false,
      degradedReason: "render_tick_stale",
    });
  });

  it("allows CDP capture tick jitter while encoded HLS output is fresh", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: now,
        },
        metrics: {
          captureFps: 30,
          encodeFps: 30,
          latestRenderTickAt: now - 6_000,
          latestVisualChangeAt: now,
          visualChangeAgeMs: 200,
        },
        hlsManifest: {
          updatedAt: now,
          mediaSequence: 42,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
    });
  });

  it("reports stale visual output during fighting phases", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(
      createCycle({
        phaseStartTime: now - 12_000,
      }),
      {
        externalStatusSnapshot: {
          destinations: [],
          stats: {},
          updatedAt: now,
          rendererHealth: {
            ready: false,
            degradedReason: "renderer_health_stale",
            updatedAt: now,
          },
          metrics: {
            captureFps: 30,
            encodeFps: 30,
            latestRenderTickAt: now,
            latestVisualChangeAt: now - 5_000,
            visualChangeAgeMs: 5_000,
          },
          hlsManifest: {
            updatedAt: now,
            mediaSequence: 42,
          },
        },
        externalStatusMaxAgeMs: 15_000,
        captureStats: {
          clientConnected: true,
          ffmpegRunning: true,
        },
      },
    );

    expect(health).toMatchObject({
      ready: false,
      degradedReason: "visual_change_stale",
    });
  });

  it("keeps renderer health ready when raw capture fps is low but encoded output is fresh", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: now,
        },
        metrics: {
          captureFps: 12,
          encodeFps: 30,
          latestRenderTickAt: now,
          latestVisualChangeAt: now,
          visualChangeAgeMs: 200,
        },
        hlsManifest: {
          updatedAt: now,
          mediaSequence: 42,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
    });
  });

  it("reports low encoder fps during fighting phases", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: now,
        },
        metrics: {
          captureFps: 30,
          encodeFps: 12,
          latestRenderTickAt: now,
          latestVisualChangeAt: now,
          visualChangeAgeMs: 200,
        },
        hlsManifest: {
          updatedAt: now,
          mediaSequence: 42,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: false,
      degradedReason: "encoder_fps_low",
    });
  });

  it("uses the external source target fps for conservative staging profiles", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: now,
        },
        metrics: {
          captureFps: 4,
          encodeFps: 13,
          latestRenderTickAt: now,
          latestVisualChangeAt: now,
          visualChangeAgeMs: 200,
        },
        hlsManifest: {
          updatedAt: now,
          mediaSequence: 42,
        },
        ingest: {
          profile: "cloudflare_live",
          transport: "srt",
          audioSampleRate: 48000,
          gopFrames: 30,
          targetFps: 15,
          probeOnly: false,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
    });
  });

  it("keeps renderer health ready when fresh render metrics are present but the local manifest is stale", () => {
    const now = Date.now();
    const health = deriveBettingRendererHealth(createCycle(), {
      externalStatusSnapshot: {
        destinations: [],
        stats: {},
        updatedAt: now,
        rendererHealth: {
          ready: true,
          degradedReason: null,
          updatedAt: now,
        },
        metrics: {
          captureFps: 56,
          encodeFps: 45,
          latestRenderTickAt: now,
          latestVisualChangeAt: now,
          visualChangeAgeMs: 200,
        },
        hlsManifest: {
          updatedAt: now - 60_000,
          mediaSequence: 0,
        },
      },
      externalStatusMaxAgeMs: 15_000,
      captureStats: {
        clientConnected: true,
        ffmpegRunning: true,
      },
    });

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
      updatedAt: now,
    });
  });

  it("returns healthy for idle phases when no degraded source exists", () => {
    const health = deriveBettingRendererHealth(
      createCycle({
        phase: "IDLE",
        agent1: null,
        agent2: null,
        arenaPositions: null,
      }),
      {
        captureStats: {
          clientConnected: false,
          ffmpegRunning: false,
        },
      },
    );

    expect(health).toMatchObject({
      ready: true,
      degradedReason: null,
    });
  });
});
