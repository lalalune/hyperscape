import type { StreamingGuardrailPhase } from "@hyperforge/shared";
import {
  deriveStreamingGuardrailReason,
  isActiveStreamingGuardrailPhase,
} from "@hyperforge/shared";
import type { StreamingDuelCycle } from "../systems/StreamingDuelScheduler/types.js";
import { getStreamCapture } from "../streaming/stream-capture.js";
import type { BettingFeedRendererHealth } from "./streaming-betting-feed.js";
import type { ExternalRtmpStatusSnapshot } from "./streaming-external-status.js";

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeRendererHealthSnapshot(
  value: unknown,
): BettingFeedRendererHealth | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  return {
    ready: candidate.ready === true,
    degradedReason: asString(candidate.degradedReason),
    updatedAt: asFiniteNumber(candidate.updatedAt),
  };
}

function deriveCycleGuardrailReason(
  cycle: StreamingDuelCycle | null,
): string | null {
  if (!cycle) {
    return null;
  }
  return deriveStreamingGuardrailReason({
    phase: cycle.phase as StreamingGuardrailPhase | null | undefined,
    agent1: cycle.agent1
      ? {
          id: cycle.agent1.characterId,
          name: cycle.agent1.name,
          hp: cycle.agent1.currentHp,
          maxHp: cycle.agent1.maxHp,
        }
      : null,
    agent2: cycle.agent2
      ? {
          id: cycle.agent2.characterId,
          name: cycle.agent2.name,
          hp: cycle.agent2.currentHp,
          maxHp: cycle.agent2.maxHp,
        }
      : null,
    arenaPositions: cycle.arenaPositions,
  });
}

export function deriveBettingRendererHealth(
  cycle: StreamingDuelCycle | null,
  options?: {
    externalStatusSnapshot?: ExternalRtmpStatusSnapshot | null;
    externalStatusMaxAgeMs?: number;
    nowMs?: number;
    captureStats?: {
      clientConnected: boolean;
      ffmpegRunning: boolean;
    };
  },
): BettingFeedRendererHealth {
  const updatedAt = options?.nowMs ?? Date.now();
  const guardrailReason = deriveCycleGuardrailReason(cycle);
  if (guardrailReason) {
    return {
      ready: false,
      degradedReason: guardrailReason,
      updatedAt,
    };
  }

  const externalSnapshot = options?.externalStatusSnapshot ?? null;
  const externalRendererHealth = normalizeRendererHealthSnapshot(
    externalSnapshot?.rendererHealth,
  );
  if (externalRendererHealth) {
    const ageMs =
      externalRendererHealth.updatedAt != null
        ? Math.max(0, updatedAt - externalRendererHealth.updatedAt)
        : null;
    if (
      externalRendererHealth.updatedAt != null &&
      ageMs != null &&
      ageMs > (options?.externalStatusMaxAgeMs ?? 15_000)
    ) {
      return {
        ready: false,
        degradedReason: "renderer_health_stale",
        updatedAt,
      };
    }
    return externalRendererHealth;
  }

  const captureStats = options?.captureStats ?? getStreamCapture().getStats();
  if (
    isActiveStreamingGuardrailPhase(cycle?.phase as StreamingGuardrailPhase)
  ) {
    if (!captureStats.clientConnected) {
      return {
        ready: false,
        degradedReason: "capture_client_disconnected",
        updatedAt,
      };
    }
    if (!captureStats.ffmpegRunning) {
      return {
        ready: false,
        degradedReason: "capture_pipeline_inactive",
        updatedAt,
      };
    }
  }

  return {
    ready: true,
    degradedReason: null,
    updatedAt,
  };
}
