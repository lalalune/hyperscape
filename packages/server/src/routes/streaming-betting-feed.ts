import type {
  StreamingDuelCycle,
  StreamingPhase,
  StreamingSourceTimeline,
} from "../systems/StreamingDuelScheduler/types.js";
import type {
  StreamChannelState,
  StreamDestinationState,
  StreamManifestStatus,
  StreamPublicReadiness,
} from "../streaming/delivery-config.js";
import type { StreamSourceRuntime } from "../streaming/source-runtime.js";

export const BETTING_FEED_SCHEMA_VERSION = 3;
export const BETTING_SOURCE_EPOCH_STORAGE_KEY =
  "streaming:betting-source-epoch";

export type BettingFeedAgent = {
  id: string;
  name: string;
  provider: string;
  model: string;
  hp: number;
  maxHp: number;
  combatLevel: number;
  wins: number;
  losses: number;
  damageDealtThisFight: number;
  rank: number;
  headToHeadWins: number;
  headToHeadLosses: number;
};

export type BettingFeedRendererHealth = {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number | null;
};

export type BettingFeedDeliveryHealth = BettingFeedRendererHealth;

export type BettingFeedHlsManifest = {
  updatedAt: number | null;
  mediaSequence: number | null;
};

export type BettingFeedRendererMetrics = {
  captureFps: number | null;
  encodeFps: number | null;
  droppedFrames: number | null;
  renderTick: number | null;
  duelStateTick: number | null;
  latestFrameAt: number | null;
  latestRenderTickAt: number | null;
  latestDuelStateTickAt: number | null;
  latestVisualChangeAt: number | null;
  visualChangeAgeMs: number | null;
  hlsManifest: BettingFeedHlsManifest | null;
};

export type BettingFeedDelivery = {
  mode: "self_hls" | "external_hls";
  provider: string | null;
  playbackUrl: string | null;
  hlsUrl: string | null;
  llhlsUrl: string | null;
  ingestUrl: string | null;
};

export type BettingFeedDestinationState = StreamDestinationState;
export type BettingFeedPublicReadiness = StreamPublicReadiness;
export type BettingFeedChannel = StreamChannelState;
export type BettingFeedSourceRuntime = StreamSourceRuntime;

export type BettingFeedCanonicalAuthority = {
  providerLive: boolean;
  playbackProbeReady: boolean;
  decision: string | null;
  reason: string | null;
  revision: number | null;
  updatedAt: number | null;
  liveInputId: string | null;
  videoUid: string | null;
  lifecycleStatus: string | null;
  playbackUrl: string | null;
  playbackProbeStatusCode: number | null;
  playbackManifestStatus: StreamManifestStatus | null;
};

export type BettingFeedBroadcastTimeline = {
  phase: StreamingPhase | null;
  betOpenTime: number | null;
  betCloseTime: number | null;
  fightStartTime: number | null;
  duelEndTime: number | null;
  presentationDelayMs: number;
  updatedAt: number;
};

export type BettingFeedSourceTimeline = StreamingSourceTimeline;

export type BettingFeedCycle = StreamingDuelCycle & {
  sourceTimeline?: BettingFeedSourceTimeline;
};

export type BettingFeedPayload = {
  schemaVersion: number;
  sourceEpoch: number;
  seq: number;
  emittedAt: number;
  cycle: BettingFeedCycle | null;
  duelId: string | null;
  duelKey: string | null;
  phase: StreamingPhase | null;
  phaseVersion: number;
  broadcastTimeline: BettingFeedBroadcastTimeline;
  sourceTimeline: BettingFeedSourceTimeline | null;
  betOpenTime: number | null;
  betCloseTime: number | null;
  fightStartTime: number | null;
  duelEndTime: number | null;
  winnerId: string | null;
  winnerName: string | null;
  winReason: StreamingDuelCycle["winReason"];
  agent1: BettingFeedAgent | null;
  agent2: BettingFeedAgent | null;
  arenaPositions: StreamingDuelCycle["arenaPositions"];
  rendererHealth: BettingFeedRendererHealth | null;
  deliveryHealth: BettingFeedDeliveryHealth | null;
  channel: BettingFeedChannel | null;
  publicReadiness: BettingFeedPublicReadiness | null;
  canonicalDestination: BettingFeedDestinationState | null;
  fallbackDestination: BettingFeedDestinationState | null;
  canonicalAuthority: BettingFeedCanonicalAuthority | null;
  sourceRuntime: BettingFeedSourceRuntime | null;
  rendererMetrics: BettingFeedRendererMetrics | null;
  captureFps: number | null;
  encodeFps: number | null;
  droppedFrames: number | null;
  renderTick: number | null;
  duelStateTick: number | null;
  latestFrameAt: number | null;
  latestRenderTickAt: number | null;
  latestDuelStateTickAt: number | null;
  latestVisualChangeAt: number | null;
  visualChangeAgeMs: number | null;
  hlsManifestUpdatedAt: number | null;
  hlsMediaSequence: number | null;
  delivery: BettingFeedDelivery | null;
  deliveryMode: BettingFeedDelivery["mode"] | null;
  deliveryProvider: string | null;
  playbackUrl: string | null;
};

export type BettingFeedFrame = {
  seq: number;
  emittedAt: number;
  payload: BettingFeedPayload;
  payloadJson: string;
  payloadBytes: number;
};

export type ReplayDelivery =
  | {
      mode: "bootstrap";
      frames: [];
      latestFrame: BettingFeedFrame | null;
      oldestSeq: number | null;
    }
  | {
      mode: "replay";
      frames: BettingFeedFrame[];
      latestFrame: BettingFeedFrame | null;
      oldestSeq: number | null;
    }
  | {
      mode: "live";
      frames: [];
      latestFrame: BettingFeedFrame;
      oldestSeq: number;
    }
  | {
      mode: "reset";
      frames: [];
      latestFrame: BettingFeedFrame;
      oldestSeq: number;
    };

function resolveWinnerName(cycle: StreamingDuelCycle): string | null {
  if (!cycle.winnerId) return null;
  if (cycle.agent1?.characterId === cycle.winnerId)
    return cycle.agent1?.name ?? null;
  if (cycle.agent2?.characterId === cycle.winnerId)
    return cycle.agent2?.name ?? null;
  return null;
}

function isRawSourceTimeEmissionEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    (env.STREAMING_EMIT_RAW_SOURCE_TIME ?? "").trim().toLowerCase() === "true"
  );
}

function buildSourceTimeline(
  cycle: StreamingDuelCycle,
  updatedAt: number,
): BettingFeedSourceTimeline {
  return {
    phase: cycle.phase,
    betOpenTime: cycle.betOpenTime ?? null,
    betCloseTime: cycle.betCloseTime ?? null,
    fightStartTime: cycle.fightStartTime ?? null,
    duelEndTime: cycle.duelEndTime ?? null,
    updatedAt,
  };
}

function redactOracleProofFromCycle(
  cycle: StreamingDuelCycle | null,
  exposeResolutionOutcome: boolean,
): BettingFeedCycle | null {
  if (!cycle) {
    return null;
  }

  return {
    ...cycle,
    duelKeyHex: null,
    duelEndTime: null,
    seed: null,
    replayHash: null,
    winnerId: exposeResolutionOutcome ? (cycle.winnerId ?? null) : null,
    winReason: exposeResolutionOutcome ? (cycle.winReason ?? null) : null,
  };
}

function redactIngestUrlFromDestination(
  destination: StreamDestinationState | null,
): StreamDestinationState | null {
  if (!destination) {
    return null;
  }
  return {
    ...destination,
    ingestUrl: null,
  };
}

function redactIngestUrlFromChannel(
  channel: StreamChannelState | null,
): StreamChannelState | null {
  if (!channel) {
    return null;
  }

  return {
    ...channel,
    destinations: channel.destinations.map((destination) => ({
      ...destination,
      ingestUrl: null,
    })),
  };
}

function toAgentSnapshot(
  agent: StreamingDuelCycle["agent1"],
): BettingFeedAgent | null {
  if (!agent) return null;

  return {
    id: agent.characterId,
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    hp: agent.currentHp,
    maxHp: agent.maxHp,
    combatLevel: agent.combatLevel,
    wins: agent.wins,
    losses: agent.losses,
    damageDealtThisFight: agent.damageDealtThisFight,
    rank: agent.rank,
    headToHeadWins: agent.headToHeadWins,
    headToHeadLosses: agent.headToHeadLosses,
  };
}

function projectBroadcastTimestamp(
  timestamp: number | null | undefined,
  presentationDelayMs: number,
): number | null {
  return typeof timestamp === "number" && Number.isFinite(timestamp)
    ? Math.max(0, timestamp + presentationDelayMs)
    : null;
}

function resolveBroadcastTimelinePhase(params: {
  cycle: StreamingDuelCycle | null;
  emittedAt: number;
  betOpenTime: number | null;
  betCloseTime: number | null;
  fightStartTime: number | null;
  duelEndTime: number | null;
}): StreamingPhase | null {
  const {
    cycle,
    emittedAt,
    betOpenTime,
    betCloseTime,
    fightStartTime,
    duelEndTime,
  } = params;
  if (!cycle) {
    return null;
  }

  if (cycle.phase === "IDLE") {
    return "IDLE";
  }
  const projectedCycleStart =
    betOpenTime ?? betCloseTime ?? fightStartTime ?? duelEndTime;
  if (projectedCycleStart != null && emittedAt < projectedCycleStart) {
    return "IDLE";
  }

  if (duelEndTime != null && emittedAt >= duelEndTime) {
    return "RESOLUTION";
  }

  if (fightStartTime != null && emittedAt >= fightStartTime) {
    return "FIGHTING";
  }

  if (betCloseTime != null && emittedAt >= betCloseTime) {
    return "COUNTDOWN";
  }

  if (betOpenTime != null && emittedAt >= betOpenTime) {
    return "ANNOUNCEMENT";
  }

  return cycle.phase;
}

function buildBroadcastTimeline(params: {
  cycle: StreamingDuelCycle | null;
  emittedAt: number;
  presentationDelayMs: number;
}): BettingFeedBroadcastTimeline {
  const betOpenTime = projectBroadcastTimestamp(
    params.cycle?.betOpenTime ?? null,
    params.presentationDelayMs,
  );
  const betCloseTime = projectBroadcastTimestamp(
    params.cycle?.betCloseTime ?? null,
    params.presentationDelayMs,
  );
  const fightStartTime = projectBroadcastTimestamp(
    params.cycle?.fightStartTime ?? null,
    params.presentationDelayMs,
  );
  const duelEndTime = projectBroadcastTimestamp(
    params.cycle?.duelEndTime ?? null,
    params.presentationDelayMs,
  );

  return {
    phase: resolveBroadcastTimelinePhase({
      cycle: params.cycle,
      emittedAt: params.emittedAt,
      betOpenTime,
      betCloseTime,
      fightStartTime,
      duelEndTime,
    }),
    betOpenTime,
    betCloseTime,
    fightStartTime,
    duelEndTime,
    presentationDelayMs: params.presentationDelayMs,
    updatedAt: params.emittedAt,
  };
}

export function buildBettingFeedPayload(params: {
  sourceEpoch: number;
  seq: number;
  emittedAt: number;
  cycle: StreamingDuelCycle | null;
  rendererHealth?: BettingFeedRendererHealth | null;
  deliveryHealth?: BettingFeedDeliveryHealth | null;
  channel?: BettingFeedChannel | null;
  canonicalAuthority?: BettingFeedCanonicalAuthority | null;
  sourceRuntime?: BettingFeedSourceRuntime | null;
  rendererMetrics?: BettingFeedRendererMetrics | null;
  delivery?: BettingFeedDelivery | null;
}): BettingFeedPayload {
  const cycle = params.cycle;
  const rendererMetrics = params.rendererMetrics ?? null;
  const hlsManifest = rendererMetrics?.hlsManifest ?? null;
  const channel = params.channel ?? null;
  const presentationDelayMs = Math.max(0, channel?.presentationDelayMs ?? 0);
  const canonicalDestination =
    channel?.destinations.find(
      (destination) => destination.id === channel.canonicalDestinationId,
    ) ?? null;
  const fallbackDestination =
    channel?.fallbackDestinationId != null
      ? (channel.destinations.find(
          (destination) => destination.id === channel.fallbackDestinationId,
        ) ?? null)
      : null;
  const delivery =
    params.delivery ??
    (canonicalDestination
      ? {
          mode:
            canonicalDestination.provider === "self_hls"
              ? "self_hls"
              : "external_hls",
          provider: canonicalDestination.provider,
          playbackUrl: canonicalDestination.playbackUrl,
          hlsUrl:
            canonicalDestination.transport === "hls" &&
            canonicalDestination.provider !== "self_hls"
              ? canonicalDestination.playbackUrl
              : null,
          llhlsUrl:
            canonicalDestination.transport === "llhls"
              ? canonicalDestination.playbackUrl
              : null,
          ingestUrl: canonicalDestination.ingestUrl,
        }
      : null);
  const deliveryHealth =
    params.deliveryHealth ??
    (channel?.publicReadiness
      ? {
          ready: channel.publicReadiness.ready,
          degradedReason: channel.publicReadiness.reason,
          updatedAt: channel.publicReadiness.updatedAt,
        }
      : null);
  const broadcastTimeline = buildBroadcastTimeline({
    cycle,
    emittedAt: params.emittedAt,
    presentationDelayMs,
  });
  const sourceTimeline =
    isRawSourceTimeEmissionEnabled() && cycle
      ? buildSourceTimeline(cycle, params.emittedAt)
      : null;
  const publicPhase = broadcastTimeline.phase ?? cycle?.phase ?? null;
  // Public RESOLUTION disclosure is bettor display state only. Settlement and
  // oracle proof material stay on the authenticated result/keeper path; this
  // feed never exposes duelKeyHex, seed, replayHash, or ingest credentials.
  const exposeResolutionOutcome = publicPhase === "RESOLUTION";
  const publicCycleBase = redactOracleProofFromCycle(
    cycle,
    exposeResolutionOutcome,
  );
  const publicCycle =
    publicCycleBase && sourceTimeline
      ? {
          ...publicCycleBase,
          sourceTimeline,
        }
      : publicCycleBase;
  const publicChannel = redactIngestUrlFromChannel(channel);
  const publicCanonicalDestination =
    redactIngestUrlFromDestination(canonicalDestination);
  const publicFallbackDestination =
    redactIngestUrlFromDestination(fallbackDestination);
  const publicDelivery = delivery
    ? {
        ...delivery,
        ingestUrl: null,
      }
    : null;
  return {
    schemaVersion: BETTING_FEED_SCHEMA_VERSION,
    sourceEpoch: params.sourceEpoch,
    seq: params.seq,
    emittedAt: params.emittedAt,
    cycle: publicCycle,
    duelId: cycle?.duelId ?? null,
    duelKey: null,
    phase: publicPhase,
    phaseVersion: cycle?.phaseVersion ?? 0,
    broadcastTimeline,
    sourceTimeline,
    betOpenTime: broadcastTimeline.betOpenTime,
    betCloseTime: broadcastTimeline.betCloseTime,
    fightStartTime: broadcastTimeline.fightStartTime,
    duelEndTime: broadcastTimeline.duelEndTime,
    winnerId: exposeResolutionOutcome ? (cycle?.winnerId ?? null) : null,
    winnerName:
      exposeResolutionOutcome && cycle ? resolveWinnerName(cycle) : null,
    winReason: exposeResolutionOutcome ? (cycle?.winReason ?? null) : null,
    agent1: toAgentSnapshot(cycle?.agent1 ?? null),
    agent2: toAgentSnapshot(cycle?.agent2 ?? null),
    arenaPositions: cycle?.arenaPositions ?? null,
    rendererHealth: params.rendererHealth ?? null,
    deliveryHealth,
    channel: publicChannel,
    publicReadiness: publicChannel?.publicReadiness ?? null,
    canonicalDestination: publicCanonicalDestination,
    fallbackDestination: publicFallbackDestination,
    canonicalAuthority: params.canonicalAuthority ?? null,
    sourceRuntime: params.sourceRuntime ?? null,
    rendererMetrics,
    captureFps: rendererMetrics?.captureFps ?? null,
    encodeFps: rendererMetrics?.encodeFps ?? null,
    droppedFrames: rendererMetrics?.droppedFrames ?? null,
    renderTick: rendererMetrics?.renderTick ?? null,
    duelStateTick: rendererMetrics?.duelStateTick ?? null,
    latestFrameAt: rendererMetrics?.latestFrameAt ?? null,
    latestRenderTickAt: rendererMetrics?.latestRenderTickAt ?? null,
    latestDuelStateTickAt: rendererMetrics?.latestDuelStateTickAt ?? null,
    latestVisualChangeAt: rendererMetrics?.latestVisualChangeAt ?? null,
    visualChangeAgeMs: rendererMetrics?.visualChangeAgeMs ?? null,
    hlsManifestUpdatedAt: hlsManifest?.updatedAt ?? null,
    hlsMediaSequence: hlsManifest?.mediaSequence ?? null,
    delivery: publicDelivery,
    deliveryMode: publicDelivery?.mode ?? null,
    deliveryProvider: publicDelivery?.provider ?? null,
    playbackUrl: publicDelivery?.playbackUrl ?? null,
  };
}

export function buildBettingFeedDedupKey(payload: BettingFeedPayload): string {
  return JSON.stringify({
    ...payload,
    emittedAt: 0,
    cycle: payload.cycle
      ? {
          ...payload.cycle,
          sourceTimeline: payload.cycle.sourceTimeline
            ? {
                ...payload.cycle.sourceTimeline,
                updatedAt: 0,
              }
            : undefined,
        }
      : null,
    broadcastTimeline: {
      ...payload.broadcastTimeline,
      updatedAt: 0,
    },
    sourceTimeline: payload.sourceTimeline
      ? {
          ...payload.sourceTimeline,
          updatedAt: 0,
        }
      : null,
    latestFrameAt: 0,
    latestRenderTickAt: 0,
    latestDuelStateTickAt: 0,
    latestVisualChangeAt: 0,
    hlsManifestUpdatedAt: 0,
    rendererHealth: payload.rendererHealth
      ? {
          ...payload.rendererHealth,
          updatedAt: 0,
        }
      : null,
    deliveryHealth: payload.deliveryHealth
      ? {
          ...payload.deliveryHealth,
          updatedAt: 0,
        }
      : null,
    channel: payload.channel
      ? {
          ...payload.channel,
          publicReadiness: {
            ...payload.channel.publicReadiness,
            updatedAt: 0,
          },
          destinations: payload.channel.destinations.map((destination) => ({
            ...destination,
            updatedAt: 0,
          })),
        }
      : null,
    publicReadiness: payload.publicReadiness
      ? {
          ...payload.publicReadiness,
          updatedAt: 0,
        }
      : null,
    canonicalDestination: payload.canonicalDestination
      ? {
          ...payload.canonicalDestination,
          updatedAt: 0,
        }
      : null,
    fallbackDestination: payload.fallbackDestination
      ? {
          ...payload.fallbackDestination,
          updatedAt: 0,
        }
      : null,
    canonicalAuthority: payload.canonicalAuthority
      ? {
          ...payload.canonicalAuthority,
          updatedAt: 0,
        }
      : null,
    sourceRuntime: payload.sourceRuntime
      ? {
          ...payload.sourceRuntime,
          lastFrameAt: 0,
          lastRenderTickAt: 0,
          lastVisualChangeAt: 0,
          lastRecoveryAt: 0,
          workerHeartbeatAt: 0,
        }
      : null,
    rendererMetrics: payload.rendererMetrics
      ? {
          ...payload.rendererMetrics,
          latestFrameAt: 0,
          latestRenderTickAt: 0,
          latestDuelStateTickAt: 0,
          latestVisualChangeAt: 0,
          hlsManifest: payload.rendererMetrics.hlsManifest
            ? {
                ...payload.rendererMetrics.hlsManifest,
                updatedAt: 0,
              }
            : null,
        }
      : null,
  });
}

export function selectReplayDelivery(
  frames: BettingFeedFrame[],
  sinceSeq: number,
): ReplayDelivery {
  if (frames.length === 0) {
    return {
      mode: "bootstrap",
      frames: [],
      latestFrame: null,
      oldestSeq: null,
    };
  }

  const oldestSeq = frames[0]?.seq ?? null;
  const latestFrame = frames[frames.length - 1] ?? null;

  if (sinceSeq <= 0 || latestFrame === null) {
    return {
      mode: "bootstrap",
      frames: [],
      latestFrame,
      oldestSeq,
    };
  }

  if (oldestSeq !== null && sinceSeq < oldestSeq) {
    return {
      mode: "reset",
      frames: [],
      latestFrame,
      oldestSeq,
    };
  }

  if (latestFrame && sinceSeq > latestFrame.seq) {
    return {
      mode: "reset",
      frames: [],
      latestFrame,
      oldestSeq: oldestSeq ?? latestFrame.seq,
    };
  }

  let low = 0;
  let high = frames.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((frames[mid]?.seq ?? 0) <= sinceSeq) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  if (low >= frames.length) {
    return {
      mode: "live",
      frames: [],
      latestFrame,
      oldestSeq: oldestSeq ?? latestFrame.seq,
    };
  }

  return {
    mode: "replay",
    frames: frames.slice(low),
    latestFrame,
    oldestSeq,
  };
}
