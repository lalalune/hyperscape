import { describe, expect, it, vi } from "vitest";
import { StreamingRuntimeAlertDispatcher } from "../../../src/routes/streaming-runtime-alerts.js";
import type { StreamingRuntimeHealth } from "../../../src/routes/streaming-runtime-health.js";

function health(ready = true): StreamingRuntimeHealth {
  const check = {
    ready,
    reason: ready ? null : "keeper_not_ready",
    observedAt: 9_500,
  };
  return {
    ready,
    emittedAt: 10_000,
    checks: {
      schedulerAuthority: { ...check, ready: true, reason: null },
      bettingFeed: { ...check, ready: true, reason: null },
      renderer: { ...check, ready: true, reason: null },
      captureClient: { ...check, ready: true, reason: null },
      encoder: { ...check, ready: true, reason: null },
      audio: { ...check, ready: true, reason: null },
      rtmpDelivery: { ...check, ready: true, reason: null },
      keeper: check,
    },
  };
}

function observation(runtimeHealth = health()) {
  return {
    health: runtimeHealth,
    keeperReasons: [] as string[],
    droppedFrames: 0,
    stalePhase: null,
  };
}

describe("streaming runtime alerts", () => {
  it("does not send an initial all-healthy notification", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const dispatcher = new StreamingRuntimeAlertDispatcher({
      webhookUrl: "https://alerts.example/streaming",
      reminderMs: 60_000,
      retryMs: 1_000,
      timeoutMs: 1_000,
      fetchImpl,
      now: () => 10_000,
    });
    await expect(dispatcher.observe(observation())).resolves.toMatchObject({
      attempted: false,
      sent: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves keeper recovery/orphan reasons in one firing alert", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const dispatcher = new StreamingRuntimeAlertDispatcher({
      webhookUrl: "https://alerts.example/streaming",
      reminderMs: 60_000,
      retryMs: 1_000,
      timeoutMs: 1_000,
      fetchImpl,
      now: () => 10_000,
    });
    const result = await dispatcher.observe({
      ...observation(health(false)),
      keeperReasons: [
        "market-recovery-active",
        "bot-recovery:orphan-order",
        "market-recovery-active",
      ],
    });
    expect(result).toMatchObject({ attempted: true, sent: true });
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body),
    );
    expect(body.status).toBe("firing");
    expect(body.keeperReasons).toEqual([
      "bot-recovery:orphan-order",
      "market-recovery-active",
    ]);
    expect(body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "keeper:market-recovery-active" }),
        expect.objectContaining({ key: "keeper:bot-recovery:orphan-order" }),
      ]),
    );
  });

  it("suppresses duplicate alerts, reminds after cooldown, and sends recovery", async () => {
    let nowMs = 10_000;
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const dispatcher = new StreamingRuntimeAlertDispatcher({
      webhookUrl: "https://alerts.example/streaming",
      reminderMs: 60_000,
      retryMs: 1_000,
      timeoutMs: 1_000,
      fetchImpl,
      now: () => nowMs,
    });
    const unhealthy = observation(health(false));
    expect((await dispatcher.observe(unhealthy)).sent).toBe(true);
    nowMs += 5_000;
    expect((await dispatcher.observe(unhealthy)).attempted).toBe(false);
    nowMs += 60_000;
    expect((await dispatcher.observe(unhealthy)).sent).toBe(true);
    nowMs += 5_000;
    expect((await dispatcher.observe(observation())).sent).toBe(true);
    const recoveryBody = JSON.parse(
      String((fetchImpl.mock.calls[2]?.[1] as RequestInit).body),
    );
    expect(recoveryBody.status).toBe("recovered");
  });

  it("alerts on stale phases and increasing dropped-frame counters", async () => {
    let nowMs = 10_000;
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const dispatcher = new StreamingRuntimeAlertDispatcher({
      webhookUrl: "https://alerts.example/streaming",
      reminderMs: 60_000,
      retryMs: 1_000,
      timeoutMs: 1_000,
      fetchImpl,
      now: () => nowMs,
    });
    const result = await dispatcher.observe({
      ...observation(),
      droppedFrames: 3,
      stalePhase: { phase: "FIGHTING", phaseStartedAt: 1_000 },
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "encoder:dropped_frames_increased",
        "scheduler:stale_phase:FIGHTING",
      ]),
    );
    nowMs += 2_000;
    const noIncrease = await dispatcher.observe({
      ...observation(),
      droppedFrames: 3,
      stalePhase: null,
    });
    expect(noIncrease.issues).not.toContain("encoder:dropped_frames_increased");
  });

  it("retries a failed delivery without marking it delivered", async () => {
    let nowMs = 10_000;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const dispatcher = new StreamingRuntimeAlertDispatcher({
      webhookUrl: "https://alerts.example/streaming",
      reminderMs: 60_000,
      retryMs: 1_000,
      timeoutMs: 1_000,
      fetchImpl,
      now: () => nowMs,
    });
    expect((await dispatcher.observe(observation(health(false)))).sent).toBe(
      false,
    );
    nowMs += 500;
    expect(
      (await dispatcher.observe(observation(health(false)))).attempted,
    ).toBe(false);
    nowMs += 500;
    expect((await dispatcher.observe(observation(health(false)))).sent).toBe(
      true,
    );
  });
});
