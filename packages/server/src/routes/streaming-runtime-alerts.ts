import type { StreamingRuntimeHealth } from "./streaming-runtime-health.js";

export type StreamingRuntimeAlertObservation = {
  health: StreamingRuntimeHealth;
  keeperReasons: string[];
  droppedFrames: number;
  stalePhase: {
    phase: string;
    phaseStartedAt: number;
  } | null;
};

export type StreamingRuntimeAlertIssue = {
  key: string;
  component: string;
  reason: string;
  observedAt: number | null;
};

type StreamingRuntimeAlertDispatcherOptions = {
  webhookUrl: string | null;
  reminderMs: number;
  retryMs: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

function normalizeKeeperReasons(reasons: string[]): string[] {
  return [
    ...new Set(
      reasons
        .map((reason) => reason.trim())
        .filter((reason) => reason.length > 0)
        .slice(0, 64),
    ),
  ].sort();
}

export class StreamingRuntimeAlertDispatcher {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private deliveredSignature = "";
  private lastDeliveredAt = 0;
  private lastAttemptAt = 0;
  private lastDroppedFrames = 0;
  private inFlight = false;

  constructor(
    private readonly options: StreamingRuntimeAlertDispatcherOptions,
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  isEnabled(): boolean {
    return Boolean(this.options.webhookUrl);
  }

  async observe(
    observation: StreamingRuntimeAlertObservation,
  ): Promise<{ attempted: boolean; sent: boolean; issues: string[] }> {
    const nowMs = this.now();
    const issues = this.buildIssues(observation);
    const signature = issues
      .map((issue) => issue.key)
      .sort()
      .join("|");
    const isRecovery = signature === "" && this.deliveredSignature !== "";
    const changed = signature !== this.deliveredSignature;
    const reminderDue =
      signature !== "" &&
      nowMs - this.lastDeliveredAt >= this.options.reminderMs;
    const retryReady = nowMs - this.lastAttemptAt >= this.options.retryMs;

    if (
      !this.options.webhookUrl ||
      this.inFlight ||
      (!changed && !reminderDue) ||
      (!retryReady && changed)
    ) {
      return {
        attempted: false,
        sent: false,
        issues: issues.map((issue) => issue.key),
      };
    }
    if (signature === "" && !isRecovery) {
      return { attempted: false, sent: false, issues: [] };
    }

    this.inFlight = true;
    this.lastAttemptAt = nowMs;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );
    try {
      const response = await this.fetchImpl(this.options.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "STREAMING_RUNTIME_ALERT",
          status: isRecovery ? "recovered" : "firing",
          emittedAt: observation.health.emittedAt,
          ready: observation.health.ready,
          issues,
          keeperReasons: normalizeKeeperReasons(observation.keeperReasons),
          droppedFrames: observation.droppedFrames,
        }),
        signal: controller.signal,
      });
      await response.body?.cancel().catch(() => {});
      if (!response.ok) {
        return {
          attempted: true,
          sent: false,
          issues: issues.map((issue) => issue.key),
        };
      }
      this.deliveredSignature = signature;
      this.lastDeliveredAt = nowMs;
      return {
        attempted: true,
        sent: true,
        issues: issues.map((issue) => issue.key),
      };
    } catch {
      return {
        attempted: true,
        sent: false,
        issues: issues.map((issue) => issue.key),
      };
    } finally {
      clearTimeout(timeout);
      this.inFlight = false;
    }
  }

  private buildIssues(
    observation: StreamingRuntimeAlertObservation,
  ): StreamingRuntimeAlertIssue[] {
    const issues: StreamingRuntimeAlertIssue[] = [];
    for (const [component, runtimeCheck] of Object.entries(
      observation.health.checks,
    )) {
      if (!runtimeCheck.ready) {
        issues.push({
          key: `health:${component}:${runtimeCheck.reason ?? "not_ready"}`,
          component,
          reason: runtimeCheck.reason ?? "not_ready",
          observedAt: runtimeCheck.observedAt,
        });
      }
    }
    for (const reason of normalizeKeeperReasons(observation.keeperReasons)) {
      issues.push({
        key: `keeper:${reason}`,
        component: "keeper",
        reason,
        observedAt: observation.health.checks.keeper.observedAt,
      });
    }
    if (observation.stalePhase) {
      issues.push({
        key: `scheduler:stale_phase:${observation.stalePhase.phase}`,
        component: "schedulerPhase",
        reason: `stale_${observation.stalePhase.phase.toLowerCase()}_phase`,
        observedAt: observation.stalePhase.phaseStartedAt,
      });
    }
    if (
      Number.isFinite(observation.droppedFrames) &&
      observation.droppedFrames > this.lastDroppedFrames
    ) {
      issues.push({
        key: "encoder:dropped_frames_increased",
        component: "encoder",
        reason: "dropped_frames_increased",
        observedAt: observation.health.emittedAt,
      });
    }
    this.lastDroppedFrames = Math.max(
      this.lastDroppedFrames,
      Number.isFinite(observation.droppedFrames)
        ? observation.droppedFrames
        : 0,
    );
    return issues;
  }
}
