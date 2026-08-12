import { describe, expect, test } from "vitest";

import { summarizeDuelRangedTransitionTelemetry } from "./duel-ranged-transition-telemetry.mjs";

function snapshots({ gap = 0, controllerReady = true } = {}) {
  const release = (sequence, playerId, at, x) => ({
    sequence,
    playerId,
    itemId: "shortbow",
    kind: "released",
    performanceTimeMs: at,
    lastVisibleNockWorldPosition: [x, 1.2, 0],
    drawHandWorldPosition: [x, 1.2, 0],
  });
  const scheduled = (sequence, playerId, at) => ({
    sequence,
    playerId,
    itemId: "shortbow",
    kind: "scheduled",
    performanceTimeMs: at,
    releaseAtPerformanceTimeMs: at + 400,
  });
  const spawn = (sequence, attackerId, at, x) => ({
    sequence,
    attackerId,
    targetId: attackerId === "ranger-a" ? "ranger-b" : "ranger-a",
    arrowId: "bronze_arrow",
    performanceTimeMs: at,
    startPosition: [x + gap, 1.2, 0],
    targetPosition: [4, 1, 0],
    travelDurationMs: 600,
  });
  const players = ["ranger-a", "ranger-b"].map((playerId) => ({
    playerId,
    itemId: "shortbow",
    controllerReady,
    nockedArrowVisible: true,
    nockedArrowWorldPosition: [0, 1.2, 0],
  }));
  return [
    {
      observedAt: 1,
      rangedPlayerIds: ["ranger-a", "ranger-b"],
      players,
      transitions: [
        scheduled(1, "ranger-a", 100),
        release(2, "ranger-a", 500, 0),
        scheduled(3, "ranger-b", 110),
        release(4, "ranger-b", 510, 4),
      ],
      spawnEvents: [spawn(1, "ranger-a", 502, 0), spawn(2, "ranger-b", 512, 4)],
      activeArrows: [],
      arrowCancelledBeforeSpawnCount: 0,
    },
    {
      observedAt: 2,
      rangedPlayerIds: ["ranger-a", "ranger-b"],
      players: players.map((player) => ({
        ...player,
        nockedArrowVisible: false,
      })),
      transitions: [
        scheduled(5, "ranger-a", 1_000),
        release(6, "ranger-a", 1_400, 0.05),
        scheduled(7, "ranger-b", 1_010),
        release(8, "ranger-b", 1_410, 3.95),
      ],
      spawnEvents: [
        spawn(3, "ranger-a", 1_403, 0.05),
        spawn(4, "ranger-b", 1_413, 3.95),
      ],
      activeArrows: [
        spawn(3, "ranger-a", 1_403, 0.05),
        spawn(4, "ranger-b", 1_413, 3.95),
      ],
      arrowCancelledBeforeSpawnCount: 0,
    },
  ];
}

describe("duel ranged transition telemetry", () => {
  test("accepts repeated two-contestant visual handoffs", () => {
    const summary = summarizeDuelRangedTransitionTelemetry(snapshots());
    expect(summary.ok).toBe(true);
    expect(summary.metrics.agents).toHaveLength(2);
    expect(
      summary.metrics.agents.every((agent) => agent.pairedCount === 2),
    ).toBe(true);
  });

  test("rejects a visible nock-to-projectile position pop", () => {
    const summary = summarizeDuelRangedTransitionTelemetry(
      snapshots({ gap: 0.2 }),
    );
    expect(summary.ok).toBe(false);
    expect(
      summary.checks.find((entry) => entry.label.includes("last visible nock"))
        ?.pass,
    ).toBe(false);
  });

  test("rejects missing dynamic-bow authority", () => {
    const summary = summarizeDuelRangedTransitionTelemetry(
      snapshots({ controllerReady: false }),
    );
    expect(summary.ok).toBe(false);
    expect(
      summary.checks.find((entry) =>
        entry.label.includes("controller remains ready"),
      )?.pass,
    ).toBe(false);
  });

  test("rejects duplicate nearby-region delivery of one projectile launch", () => {
    const series = snapshots();
    const original = series[1].spawnEvents[0];
    original.networkEventId = "server-a:launch-1";
    series[1].spawnEvents.push({
      ...original,
      sequence: 99,
    });

    const summary = summarizeDuelRangedTransitionTelemetry(series);
    expect(summary.ok).toBe(false);
    expect(summary.metrics.duplicateSpawnCount).toBe(1);
    expect(summary.metrics.maximumCopiesPerSpawnEvent).toBe(2);
    expect(
      summary.checks.find((entry) =>
        entry.label.includes("one projectile visual"),
      )?.pass,
    ).toBe(false);
  });

  test("retains an earlier cancelled-before-spawn failure after samples rotate", () => {
    const series = snapshots();
    series[0].arrowCancelledBeforeSpawnCount = 7;
    series[0].arrowCancelledBeforeSpawnDelta = 1;
    series[1].arrowCancelledBeforeSpawnCount = 7;
    series[1].arrowCancelledBeforeSpawnDelta = 1;

    const summary = summarizeDuelRangedTransitionTelemetry(series.slice(1));
    expect(summary.ok).toBe(false);
    expect(
      summary.checks.find((entry) => entry.label.includes("cancelled before"))
        ?.actual,
    ).toBe("1");
  });
});
