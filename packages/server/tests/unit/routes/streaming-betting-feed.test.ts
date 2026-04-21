import { describe, it, expect } from "vitest";
import {
  buildBettingFeedDedupKey,
  buildBettingFeedPayload,
  selectReplayDelivery,
} from "../../../src/routes/streaming-betting-feed.js";
import type { BettingFeedFrame } from "../../../src/routes/streaming-betting-feed.js";
import type { StreamingDuelCycle } from "../../../src/systems/StreamingDuelScheduler/types.js";

function createCycle(
  overrides: Partial<StreamingDuelCycle> = {},
): StreamingDuelCycle {
  return {
    cycleId: "cycle-1",
    phase: "ANNOUNCEMENT",
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

function createFrame(seq: number): BettingFeedFrame {
  const payload = buildBettingFeedPayload({
    sourceEpoch: 9_999,
    seq,
    emittedAt: 10_000 + seq,
    rendererHealth: {
      ready: seq % 2 === 0,
      degradedReason: seq % 2 === 0 ? null : "loading_overlay_active",
      updatedAt: 10_500 + seq,
    },
    cycle: createCycle({
      phaseVersion: seq,
      winnerId: seq % 2 === 0 ? "agent-a" : "agent-b",
      duelEndTime: seq % 2 === 0 ? 20_000 : 21_000,
      winReason: seq % 2 === 0 ? "kill" : "hp_advantage",
    }),
  });
  return {
    seq,
    emittedAt: 10_000 + seq,
    payload,
    payloadJson: JSON.stringify(payload),
    payloadBytes: 0,
  };
}

function createChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "hyperscapes-broadcast-channel",
    mode: "always_on",
    presentationDelayMs: 4_000,
    activeDuelId: "duel-1",
    activeDuelKey: null,
    canonicalDestinationId: "canonical-cloudflare",
    fallbackDestinationId: "fallback-self-hls",
    publicPlaybackUrl: "https://video.example/live.m3u8?protocol=llhls",
    publicReadiness: {
      ready: false,
      reason: "delivery_disconnected",
      updatedAt: 123_501,
    },
    destinations: [
      {
        id: "canonical-cloudflare",
        name: "External Delivery",
        role: "canonical",
        provider: "cloudflare_stream",
        transport: "llhls",
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        ingestUrl: "rtmps://live.cloudflare.example/input",
        connected: false,
        transportHealthy: false,
        playbackReady: false,
        manifestStatus: "missing",
        lastError: "delivery_disconnected",
        updatedAt: 123_501,
      },
      {
        id: "fallback-self-hls",
        name: "Self-HLS",
        role: "fallback",
        provider: "self_hls",
        transport: "hls",
        playbackUrl: "/live/stream.m3u8",
        ingestUrl: null,
        connected: true,
        transportHealthy: true,
        playbackReady: true,
        manifestStatus: "ok",
        lastError: null,
        updatedAt: 123_500,
      },
    ],
    ...overrides,
  };
}

describe("streaming-betting-feed", () => {
  it("builds betting payloads with stable schema and phase version data", () => {
    const payload = buildBettingFeedPayload({
      sourceEpoch: 42,
      seq: 7,
      emittedAt: 123_456,
      rendererHealth: {
        ready: false,
        degradedReason: "loading_overlay_active",
        updatedAt: 123_500,
      },
      deliveryHealth: {
        ready: false,
        degradedReason: "delivery_disconnected",
        updatedAt: 123_501,
      },
      rendererMetrics: {
        captureFps: 29,
        encodeFps: 28,
        droppedFrames: 1,
        renderTick: 77,
        duelStateTick: 66,
        latestFrameAt: 123_450,
        latestRenderTickAt: 123_451,
        latestDuelStateTickAt: 123_452,
        latestVisualChangeAt: 123_453,
        visualChangeAgeMs: 250,
        hlsManifest: {
          updatedAt: 123_454,
          mediaSequence: 812,
        },
      },
      channel: createChannel(),
      sourceRuntime: {
        ready: true,
        statusSource: "external_worker",
        captureMode: "cdp",
        degradedReason: null,
        currentSceneUrl: "https://staging.example/stream",
        activeBundle: "bundle-a",
        lastFrameAt: 123_455,
        lastRenderTickAt: 123_456,
        lastVisualChangeAt: 123_457,
        lastRecoveryAt: 123_400,
        recoveryCount: 1,
        workerHeartbeatAt: 123_502,
      },
      canonicalAuthority: {
        providerLive: false,
        playbackProbeReady: false,
        decision: "blocked",
        reason: "provider_not_live",
        revision: 4,
        updatedAt: 123_503,
        liveInputId: "live-input-123",
        videoUid: "video-456",
        lifecycleStatus: "disconnected",
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        playbackProbeStatusCode: 204,
        playbackManifestStatus: "missing",
      },
      cycle: createCycle({
        phase: "FIGHTING",
        phaseVersion: 9,
        fightStartTime: 3_000,
        winnerId: "agent-b",
        winReason: "damage_advantage",
      }),
    });

    expect(payload).toMatchObject({
      schemaVersion: 3,
      sourceEpoch: 42,
      seq: 7,
      emittedAt: 123_456,
      cycle: {
        phase: "FIGHTING",
        fightStartTime: 3_000,
        winnerId: null,
        winReason: null,
      },
      duelId: "duel-1",
      duelKey: null,
      phase: "FIGHTING",
      phaseVersion: 9,
      broadcastTimeline: {
        phase: "FIGHTING",
        betOpenTime: 5_000,
        betCloseTime: 6_000,
        fightStartTime: 7_000,
        duelEndTime: null,
        presentationDelayMs: 4_000,
        updatedAt: 123_456,
      },
      betOpenTime: 5_000,
      betCloseTime: 6_000,
      fightStartTime: 7_000,
      duelEndTime: null,
      winnerId: null,
      winnerName: null,
      winReason: null,
      arenaPositions: {
        agent1: [10, 11, 12],
        agent2: [20, 21, 22],
      },
      rendererHealth: {
        ready: false,
        degradedReason: "loading_overlay_active",
        updatedAt: 123_500,
      },
      deliveryHealth: {
        ready: false,
        degradedReason: "delivery_disconnected",
        updatedAt: 123_501,
      },
      publicReadiness: {
        ready: false,
        reason: "delivery_disconnected",
        updatedAt: 123_501,
      },
      canonicalDestination: {
        id: "canonical-cloudflare",
        role: "canonical",
        provider: "cloudflare_stream",
        playbackReady: false,
      },
      fallbackDestination: {
        id: "fallback-self-hls",
        role: "fallback",
        provider: "self_hls",
        playbackReady: true,
      },
      sourceRuntime: {
        ready: true,
        statusSource: "external_worker",
        captureMode: "cdp",
        degradedReason: null,
        currentSceneUrl: "https://staging.example/stream",
        activeBundle: "bundle-a",
        lastFrameAt: 123_455,
        lastRenderTickAt: 123_456,
        lastVisualChangeAt: 123_457,
        lastRecoveryAt: 123_400,
        recoveryCount: 1,
        workerHeartbeatAt: 123_502,
      },
      canonicalAuthority: {
        providerLive: false,
        playbackProbeReady: false,
        decision: "blocked",
        reason: "provider_not_live",
        revision: 4,
        updatedAt: 123_503,
        liveInputId: "live-input-123",
        videoUid: "video-456",
        lifecycleStatus: "disconnected",
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        playbackProbeStatusCode: 204,
        playbackManifestStatus: "missing",
      },
      captureFps: 29,
      encodeFps: 28,
      droppedFrames: 1,
      renderTick: 77,
      duelStateTick: 66,
      latestFrameAt: 123_450,
      latestRenderTickAt: 123_451,
      latestDuelStateTickAt: 123_452,
      latestVisualChangeAt: 123_453,
      visualChangeAgeMs: 250,
      hlsManifestUpdatedAt: 123_454,
      hlsMediaSequence: 812,
      deliveryMode: "external_hls",
      deliveryProvider: "cloudflare_stream",
      playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
    });

    expect(payload.agent1?.id).toBe("agent-a");
    expect(payload.agent2?.hp).toBe(20);
    expect(payload.rendererMetrics?.hlsManifest?.mediaSequence).toBe(812);
    expect(payload.channel?.canonicalDestinationId).toBe(
      "canonical-cloudflare",
    );
    expect(payload.delivery?.llhlsUrl).toContain("protocol=llhls");
    expect(payload.deliveryHealth?.degradedReason).toBe(
      "delivery_disconnected",
    );
    expect(payload.canonicalAuthority).toMatchObject({
      decision: "blocked",
      reason: "provider_not_live",
      revision: 4,
      providerLive: false,
      playbackProbeReady: false,
    });
  });

  it("promotes broadcast timeline phase to the top-level payload phase", () => {
    const payload = buildBettingFeedPayload({
      sourceEpoch: 7,
      seq: 3,
      emittedAt: 9_000,
      channel: createChannel(),
      cycle: createCycle({
        phase: "FIGHTING",
        phaseVersion: 5,
        betOpenTime: 1_000,
        betCloseTime: 2_000,
        fightStartTime: 10_000,
      }),
    });

    expect(payload.phase).toBe("COUNTDOWN");
    expect(payload.broadcastTimeline.phase).toBe("COUNTDOWN");
    expect(payload.phaseVersion).toBe(5);
  });

  it("projects a bettor-facing timeline against the active canonical delay", () => {
    const payload = buildBettingFeedPayload({
      sourceEpoch: 7,
      seq: 11,
      emittedAt: 6_500,
      channel: createChannel({
        presentationDelayMs: 4_000,
      }),
      cycle: createCycle({
        phase: "FIGHTING",
        betOpenTime: 1_000,
        betCloseTime: 2_000,
        fightStartTime: 3_000,
        duelEndTime: 9_000,
      }),
    });

    expect(payload.phase).toBe("COUNTDOWN");
    expect(payload.broadcastTimeline).toEqual({
      phase: "COUNTDOWN",
      betOpenTime: 5_000,
      betCloseTime: 6_000,
      fightStartTime: 7_000,
      duelEndTime: 13_000,
      presentationDelayMs: 4_000,
      updatedAt: 6_500,
    });
    expect(payload.betOpenTime).toBe(5_000);
    expect(payload.betCloseTime).toBe(6_000);
    expect(payload.fightStartTime).toBe(7_000);
    expect(payload.duelEndTime).toBe(13_000);
  });

  it("holds the projected phase at idle until the delayed cycle start arrives", () => {
    const payload = buildBettingFeedPayload({
      sourceEpoch: 8,
      seq: 12,
      emittedAt: 4_500,
      channel: createChannel({
        presentationDelayMs: 4_000,
      }),
      cycle: createCycle({
        phase: "ANNOUNCEMENT",
        betOpenTime: 1_000,
        betCloseTime: 2_000,
        fightStartTime: 3_000,
        duelEndTime: 9_000,
      }),
    });

    expect(payload.phase).toBe("IDLE");
    expect(payload.broadcastTimeline).toEqual({
      phase: "IDLE",
      betOpenTime: 5_000,
      betCloseTime: 6_000,
      fightStartTime: 7_000,
      duelEndTime: 13_000,
      presentationDelayMs: 4_000,
      updatedAt: 4_500,
    });
  });

  it("hides winner metadata until the delayed public phase reaches resolution", () => {
    const payload = buildBettingFeedPayload({
      sourceEpoch: 9,
      seq: 13,
      emittedAt: 6_500,
      channel: createChannel({
        presentationDelayMs: 4_000,
      }),
      cycle: createCycle({
        phase: "RESOLUTION",
        fightStartTime: 3_000,
        duelEndTime: 9_000,
        winnerId: "agent-a",
        winReason: "knockout",
      }),
    });

    expect(payload.phase).toBe("COUNTDOWN");
    expect(payload.winnerId).toBeNull();
    expect(payload.winnerName).toBeNull();
    expect(payload.winReason).toBeNull();
    expect(payload.cycle).toMatchObject({
      phase: "RESOLUTION",
      winnerId: null,
      winReason: null,
    });
  });

  it("selects replay, bootstrap, and reset delivery modes deterministically", () => {
    const frames = [createFrame(1), createFrame(2), createFrame(3)];

    expect(selectReplayDelivery(frames, 0)).toMatchObject({
      mode: "bootstrap",
      latestFrame: frames[2],
      oldestSeq: 1,
    });

    expect(selectReplayDelivery(frames, 2)).toMatchObject({
      mode: "replay",
      frames: [frames[2]],
      latestFrame: frames[2],
      oldestSeq: 1,
    });

    expect(selectReplayDelivery(frames, 3)).toMatchObject({
      mode: "live",
      latestFrame: frames[2],
      oldestSeq: 1,
    });

    expect(selectReplayDelivery(frames, 99)).toMatchObject({
      mode: "reset",
      latestFrame: frames[2],
      oldestSeq: 1,
    });
  });

  it("requests a reset when the replay gap is larger than the buffer", () => {
    const frames = [createFrame(10), createFrame(11), createFrame(12)];

    expect(selectReplayDelivery(frames, 2)).toMatchObject({
      mode: "reset",
      latestFrame: frames[2],
      oldestSeq: 10,
    });
  });

  it("deduplicates independently of emittedAt and renderer health timestamps", () => {
    const basePayload = buildBettingFeedPayload({
      sourceEpoch: 42,
      seq: 7,
      emittedAt: 123_456,
      cycle: createCycle(),
      channel: createChannel({
        publicReadiness: {
          ready: true,
          reason: null,
          updatedAt: 123_401,
        },
        destinations: [
          {
            id: "canonical-cloudflare",
            name: "External Delivery",
            role: "canonical",
            provider: "cloudflare_stream",
            transport: "llhls",
            playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
            ingestUrl: "rtmps://live.cloudflare.example/input",
            connected: true,
            transportHealthy: true,
            playbackReady: true,
            manifestStatus: "ok",
            lastError: null,
            updatedAt: 123_401,
          },
        ],
      }),
      rendererHealth: {
        ready: true,
        degradedReason: null,
        updatedAt: 123_400,
      },
      sourceRuntime: {
        ready: true,
        statusSource: "external_worker",
        captureMode: "cdp",
        degradedReason: null,
        currentSceneUrl: "https://staging.example/stream",
        activeBundle: "bundle-a",
        lastFrameAt: 123_390,
        lastRenderTickAt: 123_391,
        lastVisualChangeAt: 123_392,
        lastRecoveryAt: 123_300,
        recoveryCount: 1,
        workerHeartbeatAt: 123_401,
      },
    });
    const laterPayload = {
      ...basePayload,
      emittedAt: 999_999,
      broadcastTimeline: {
        ...basePayload.broadcastTimeline,
        updatedAt: 555_554,
      },
      rendererHealth: basePayload.rendererHealth
        ? {
            ...basePayload.rendererHealth,
            updatedAt: 555_555,
          }
        : null,
      deliveryHealth: basePayload.deliveryHealth
        ? {
            ...basePayload.deliveryHealth,
            updatedAt: 777_777,
          }
        : null,
      channel: basePayload.channel
        ? {
            ...basePayload.channel,
            publicReadiness: {
              ...basePayload.channel.publicReadiness,
              updatedAt: 888_888,
            },
            destinations: basePayload.channel.destinations.map(
              (destination) => ({
                ...destination,
                updatedAt: 999_999,
              }),
            ),
          }
        : null,
      sourceRuntime: basePayload.sourceRuntime
        ? {
            ...basePayload.sourceRuntime,
            lastFrameAt: 888_887,
            lastRenderTickAt: 888_886,
            lastVisualChangeAt: 888_885,
            lastRecoveryAt: 888_884,
            workerHeartbeatAt: 888_883,
          }
        : null,
      canonicalAuthority: basePayload.canonicalAuthority
        ? {
            ...basePayload.canonicalAuthority,
            updatedAt: 666_666,
          }
        : null,
    };

    expect(buildBettingFeedDedupKey(basePayload)).toBe(
      buildBettingFeedDedupKey(laterPayload),
    );
  });

  it("changes the dedup key when canonical authority semantics change", () => {
    const basePayload = buildBettingFeedPayload({
      sourceEpoch: 42,
      seq: 7,
      emittedAt: 123_456,
      cycle: createCycle(),
      channel: createChannel(),
      canonicalAuthority: {
        providerLive: true,
        playbackProbeReady: true,
        decision: "ready",
        reason: null,
        revision: 7,
        updatedAt: 123_500,
        liveInputId: "live-input-123",
        videoUid: "video-456",
        lifecycleStatus: "connected",
        playbackUrl: "https://video.example/live.m3u8?protocol=llhls",
        playbackProbeStatusCode: 200,
        playbackManifestStatus: "ok",
      },
    });
    const changedPayload = {
      ...basePayload,
      canonicalAuthority: basePayload.canonicalAuthority
        ? {
            ...basePayload.canonicalAuthority,
            decision: "blocked" as const,
            reason: "probe_unready",
            revision: 8,
          }
        : null,
    };

    expect(buildBettingFeedDedupKey(basePayload)).not.toBe(
      buildBettingFeedDedupKey(changedPayload),
    );
  });

  it("emits raw sourceTimeline on the betting feed when enabled", () => {
    const previous = process.env.STREAMING_EMIT_RAW_SOURCE_TIME;
    process.env.STREAMING_EMIT_RAW_SOURCE_TIME = "true";

    try {
      const payload = buildBettingFeedPayload({
        sourceEpoch: 42,
        seq: 7,
        emittedAt: 123_456,
        cycle: createCycle({
          phase: "FIGHTING",
          fightStartTime: 3_000,
          duelEndTime: 4_000,
        }),
      });

      expect(payload.sourceTimeline).toEqual({
        phase: "FIGHTING",
        betOpenTime: 1_000,
        betCloseTime: 2_000,
        fightStartTime: 3_000,
        duelEndTime: 4_000,
        updatedAt: 123_456,
      });
      expect(payload.cycle?.sourceTimeline).toEqual(payload.sourceTimeline);
      expect(payload.broadcastTimeline.presentationDelayMs).toBe(0);
    } finally {
      if (previous == null) {
        delete process.env.STREAMING_EMIT_RAW_SOURCE_TIME;
      } else {
        process.env.STREAMING_EMIT_RAW_SOURCE_TIME = previous;
      }
    }
  });

  it("ignores sourceTimeline updatedAt when building dedup keys", () => {
    const previous = process.env.STREAMING_EMIT_RAW_SOURCE_TIME;
    process.env.STREAMING_EMIT_RAW_SOURCE_TIME = "true";

    try {
      const basePayload = buildBettingFeedPayload({
        sourceEpoch: 42,
        seq: 7,
        emittedAt: 123_456,
        cycle: createCycle(),
      });
      const laterPayload = {
        ...basePayload,
        sourceTimeline: basePayload.sourceTimeline
          ? {
              ...basePayload.sourceTimeline,
              updatedAt: 999_999,
            }
          : null,
        cycle: basePayload.cycle
          ? {
              ...basePayload.cycle,
              sourceTimeline: basePayload.cycle.sourceTimeline
                ? {
                    ...basePayload.cycle.sourceTimeline,
                    updatedAt: 999_999,
                  }
                : undefined,
            }
          : null,
      };

      expect(buildBettingFeedDedupKey(basePayload)).toBe(
        buildBettingFeedDedupKey(laterPayload),
      );
    } finally {
      if (previous == null) {
        delete process.env.STREAMING_EMIT_RAW_SOURCE_TIME;
      } else {
        process.env.STREAMING_EMIT_RAW_SOURCE_TIME = previous;
      }
    }
  });

  it("handles empty replay buffers cleanly", () => {
    expect(selectReplayDelivery([], 0)).toMatchObject({
      mode: "bootstrap",
      latestFrame: null,
      oldestSeq: null,
    });
  });

  it("replays all buffered frames when the caller is exactly at the oldest boundary", () => {
    const frames = [createFrame(10), createFrame(11), createFrame(12)];

    expect(selectReplayDelivery(frames, 10)).toMatchObject({
      mode: "replay",
      frames: [frames[1], frames[2]],
      latestFrame: frames[2],
      oldestSeq: 10,
    });
  });
});
