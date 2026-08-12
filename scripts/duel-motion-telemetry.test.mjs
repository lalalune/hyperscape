import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateDuelStyleSwitchTelemetry,
  isDuelMotionSamplingRace,
  parseDuelMotionRoles,
  parseDuelMotionSafeCrop,
  summarizeDuelStyleSwitchTelemetry,
  summarizeDuelHitReactionTelemetry,
  summarizeDuelHitReactionResolutionTelemetry,
  summarizeDuelMotionTelemetry,
} from "./duel-motion-telemetry.mjs";

function quaternionForYaw(yawRadians) {
  return [0, Math.sin(yawRadians / 2), 0, Math.cos(yawRadians / 2)];
}

function createPassingPerformance() {
  return {
    updatedAt: 10_000,
    byPhase: {
      FIGHTING: {
        frames: 720,
        frameIntervalMs: { p50: 16.7, p95: 18, p99: 22 },
        frameWorkMs: { p95: 4, p99: 7 },
        frameBudget: { above33_33Ms: 2 },
      },
    },
  };
}

function createPassingSamples() {
  return Array.from({ length: 36 }, (_, index) => {
    const direction = Math.floor(index / 9) % 4;
    const progress = index % 9;
    const offsets = [
      [progress * 0.04, progress * 0.03],
      [0.32 - progress * 0.04, 0.24 + progress * 0.03],
      [-progress * 0.04, 0.48 - progress * 0.03],
      [-0.32 + progress * 0.04, 0.24 - progress * 0.03],
    ];
    const [dx, dz] = offsets[direction];
    const left = [350 + dx, 0.42, 405 + dz];
    const right = [352 - dx, 0.42, 407 - dz];
    return {
      observedAt: index * 250,
      cycleId: "cycle-a",
      renderedSeparationXZ: Math.hypot(left[0] - right[0], left[2] - right[2]),
      agents: [
        {
          id: "ranged-agent",
          role: "ranged",
          renderPosition: left,
          simulationPosition: [...left],
          avatarPosition: [...left],
          renderQuaternion: quaternionForYaw(index * 0.01),
          ndcPosition: [-0.35 + dx * 0.1, -0.1 + dz * 0.1, 0.5],
          facingTargetErrorDegrees: 2,
          insideCombatArena: true,
          visible: true,
          active: true,
          avatarReady: true,
        },
        {
          id: "mage-agent",
          role: "mage",
          renderPosition: right,
          simulationPosition: [...right],
          avatarPosition: [...right],
          renderQuaternion: quaternionForYaw(Math.PI + index * 0.01),
          ndcPosition: [0.35 - dx * 0.1, -0.1 - dz * 0.1, 0.5],
          facingTargetErrorDegrees: 3,
          insideCombatArena: true,
          visible: true,
          active: true,
          avatarReady: true,
        },
      ],
    };
  });
}

test("accepts a bounded smooth multi-direction ranged/mage time series", () => {
  const result = summarizeDuelMotionTelemetry({
    samples: createPassingSamples(),
    performance: createPassingPerformance(),
    expectedRoles: ["ranged", "mage"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.metrics.sampleCount, 36);
  assert.deepEqual(result.metrics.observedRoles, ["mage", "ranged"]);
  assert.ok(result.metrics.combinedDiagonalSegments >= 2);
  assert.ok(result.metrics.combinedDirectionCoverage.length >= 3);
  assert.equal(result.checks.filter((entry) => !entry.pass).length, 0);
});

test("accepts and verifies an explicit same-style pair", () => {
  assert.deepEqual(parseDuelMotionRoles(" melee,melee "), ["melee", "melee"]);
  assert.throws(
    () => parseDuelMotionRoles("melee,melee", true),
    /exactly once/,
  );

  const samples = createPassingSamples().map((sample) => ({
    ...sample,
    agents: sample.agents.map((agent) => ({ ...agent, role: "melee" })),
  }));
  const result = summarizeDuelMotionTelemetry({
    samples,
    performance: createPassingPerformance(),
    expectedRoles: ["melee", "melee"],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.metrics.observedRoles, ["melee"]);
});

test("requires both declared crop axes and rejects projected fighters outside either bound", () => {
  assert.equal(parseDuelMotionSafeCrop(undefined, undefined), null);
  assert.throws(
    () => parseDuelMotionSafeCrop("0.9", undefined),
    /requires both/,
  );
  assert.throws(() => parseDuelMotionSafeCrop("1.01", "0.9"), /at most 1/);

  const safeCrop = parseDuelMotionSafeCrop("0.9", "0.82");
  const passing = summarizeDuelMotionTelemetry({
    samples: createPassingSamples(),
    performance: createPassingPerformance(),
    expectedRoles: ["ranged", "mage"],
    safeCrop,
  });
  assert.equal(passing.ok, true);
  assert.equal(passing.metrics.safeCropNdc.violations, 0);
  assert.equal(
    passing.checks.find(
      (entry) =>
        entry.label === "contestants stay inside the declared stream-safe crop",
    ).pass,
    true,
  );

  const failingSamples = createPassingSamples();
  failingSamples[12].agents[1].ndcPosition = [0.91, -0.83, 0.5];
  const failing = summarizeDuelMotionTelemetry({
    samples: failingSamples,
    performance: createPassingPerformance(),
    expectedRoles: ["ranged", "mage"],
    safeCrop,
  });
  assert.equal(failing.ok, false);
  assert.equal(failing.metrics.safeCropNdc.violations, 1);
  assert.equal(
    failing.checks.find(
      (entry) =>
        entry.label === "contestants stay inside the declared stream-safe crop",
    ).pass,
    false,
  );
});

test("rejects motionless, out-of-bounds, poorly paced evidence", () => {
  const samples = createPassingSamples().map((sample) => ({
    ...sample,
    renderedSeparationXZ: 0.1,
    agents: sample.agents.map((agent, index) => ({
      ...agent,
      renderPosition: [350 + index * 0.1, 0.42, 405],
      simulationPosition: [350 + index * 0.1, 0.42, 405],
      avatarPosition: [350 + index * 0.1, 0.42, 405],
      insideCombatArena: false,
      facingTargetErrorDegrees: 120,
    })),
  }));
  const performance = createPassingPerformance();
  performance.byPhase.FIGHTING.frameIntervalMs = {
    p50: 33,
    p95: 45,
    p99: 60,
  };

  const result = summarizeDuelMotionTelemetry({
    samples,
    performance,
    expectedRoles: ["ranged", "mage"],
  });

  assert.equal(result.ok, false);
  const failedLabels = result.checks
    .filter((entry) => !entry.pass)
    .map((entry) => entry.label);
  assert.ok(
    failedLabels.includes("every contestant demonstrates tactical travel"),
  );
  assert.ok(
    failedLabels.includes(
      "avatars stay visible, active, loaded, and inside the arena",
    ),
  );
  assert.ok(failedLabels.includes("contestants remain visibly separated"));
  assert.ok(failedLabels.includes("60 FPS cadence meets percentile budget"));
});

test("distinguishes asynchronous sampling races from integrity failures", () => {
  assert.equal(
    isDuelMotionSamplingRace("browser_server_state_disagreement"),
    true,
  );
  assert.equal(isDuelMotionSamplingRace("scene:phase_mismatch"), true);
  assert.equal(isDuelMotionSamplingRace("renderer_or_layout_not_ready"), false);
  assert.equal(isDuelMotionSamplingRace("scene:agent_hidden"), false);
});

test("requires real within-cycle switches from both contestants and visible UI evidence", () => {
  const roles = [
    ["melee", "ranged"],
    ["melee", "ranged"],
    ["ranged", "mage"],
    ["mage", "melee"],
  ];
  const samples = roles.map((pair, index) => ({
    observedAt: index * 250,
    cycleId: "cycle-a",
    agents: [
      { id: "agent-a", role: pair[0] },
      { id: "agent-b", role: pair[1] },
    ],
  }));
  const metrics = summarizeDuelStyleSwitchTelemetry(samples, 2);
  const checks = evaluateDuelStyleSwitchTelemetry(metrics, [
    "melee",
    "ranged",
    "mage",
  ]);

  assert.equal(metrics.totalSwitches, 4);
  assert.deepEqual(
    metrics.agents.map((agent) => agent.switches),
    [2, 2],
  );
  assert.equal(
    checks.every((entry) => entry.pass),
    true,
  );
});

test("does not count a new cycle opening role as a live switch", () => {
  const metrics = summarizeDuelStyleSwitchTelemetry(
    [
      {
        observedAt: 0,
        cycleId: "cycle-a",
        agents: [
          { id: "agent-a", role: "melee" },
          { id: "agent-b", role: "ranged" },
        ],
      },
      {
        observedAt: 250,
        cycleId: "cycle-b",
        agents: [
          { id: "agent-a", role: "ranged" },
          { id: "agent-b", role: "mage" },
        ],
      },
    ],
    0,
  );
  const checks = evaluateDuelStyleSwitchTelemetry(metrics, [
    "melee",
    "ranged",
    "mage",
  ]);

  assert.equal(metrics.totalSwitches, 0);
  assert.equal(checks[0].pass, false);
  assert.equal(checks[2].pass, false);
});

test("aligns repeated health loss with exact avatar reaction sequences", () => {
  const hpBySample = [
    [40, 40],
    [40, 34],
    [35, 34],
    [35, 29],
    [31, 29],
  ];
  const triggerBySample = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 2],
  ];
  const samples = hpBySample.map((health, index) => ({
    observedAt: index * 100,
    cycleId: "cycle-hit",
    agents: ["agent-a", "agent-b"].map((id, agentIndex) => ({
      id,
      hp: health[agentIndex],
      avatarEmote: "asset://emotes/emote_sword_swing.glb",
      hitReaction: {
        availableBoneCount: 5,
        triggerCount: triggerBySample[index][agentIndex],
        active: index > 0,
        elapsedSeconds: index > 0 ? 0.08 : null,
        currentWeight: index > 0 ? 0.7 : 0,
        lastIntensity: index > 0 ? 0.8 : 0,
        lastSide: 1,
      },
    })),
  }));

  const result = summarizeDuelHitReactionTelemetry(samples);
  assert.equal(result.ok, true);
  assert.equal(result.metrics.healthDropEvents, 4);
  assert.equal(result.metrics.triggerIncrements, 4);
  assert.equal(result.metrics.unmatchedHealthDrops, 0);
  assert.equal(result.metrics.unmatchedTriggerIncrements, 0);
});

test("excludes a fight first observed after damage from exact reaction alignment", () => {
  const reaction = (triggerCount, active = false) => ({
    availableBoneCount: 5,
    triggerCount,
    active,
    elapsedSeconds: active ? 0.08 : null,
    currentWeight: active ? 0.7 : 0,
    lastIntensity: active ? 0.8 : 0,
    lastSide: 1,
  });
  const partial = [
    {
      observedAt: 0,
      cycleId: "cycle-partial",
      agents: [
        {
          id: "agent-a",
          hp: 35,
          maxHp: 40,
          attacksLanded: 0,
          hitReaction: reaction(1),
        },
        {
          id: "agent-b",
          hp: 40,
          maxHp: 40,
          attacksLanded: 1,
          hitReaction: reaction(0),
        },
      ],
    },
    {
      observedAt: 100,
      cycleId: "cycle-partial",
      agents: [
        {
          id: "agent-a",
          hp: 34,
          maxHp: 40,
          attacksLanded: 0,
          hitReaction: reaction(1),
        },
        {
          id: "agent-b",
          hp: 40,
          maxHp: 40,
          attacksLanded: 2,
          hitReaction: reaction(0),
        },
      ],
    },
  ];
  const hpBySample = [
    [40, 40],
    [40, 34],
    [35, 34],
    [35, 29],
    [31, 29],
  ];
  const triggerBySample = [
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
    [3, 2],
  ];
  const complete = hpBySample.map((health, index) => ({
    observedAt: 1_000 + index * 100,
    cycleId: "cycle-complete",
    agents: ["agent-a", "agent-b"].map((id, agentIndex) => ({
      id,
      hp: health[agentIndex],
      maxHp: 40,
      attacksLanded: index === 0 ? 0 : index,
      avatarEmote: "asset://emotes/emote_sword_swing.glb",
      hitReaction: reaction(triggerBySample[index][agentIndex], index > 0),
    })),
  }));

  const result = summarizeDuelHitReactionTelemetry([...partial, ...complete]);
  assert.equal(result.ok, true);
  assert.equal(result.metrics.sampleCount, 7);
  assert.equal(result.metrics.evaluatedSampleCount, 5);
  assert.equal(result.metrics.completeCycleCount, 1);
  assert.equal(result.metrics.incompleteCycleCount, 1);
  assert.equal(result.metrics.healthDropEvents, 4);
  assert.equal(result.metrics.triggerIncrements, 4);
  assert.equal(result.metrics.unmatchedHealthDrops, 0);
});

test("rejects missing, reset, or health-desynchronized reaction telemetry", () => {
  const samples = [
    {
      observedAt: 0,
      cycleId: "cycle-hit",
      agents: [
        { id: "agent-a", hp: 40, hitReaction: null },
        { id: "agent-b", hp: 40, hitReaction: null },
      ],
    },
    {
      observedAt: 100,
      cycleId: "cycle-hit",
      agents: [
        {
          id: "agent-a",
          hp: 30,
          avatarEmote: "asset://emotes/emote-idle.glb",
          hitReaction: {
            availableBoneCount: 4,
            triggerCount: 0,
            active: false,
            elapsedSeconds: null,
            currentWeight: 0,
            lastIntensity: 0,
            lastSide: 1,
          },
        },
        { id: "agent-b", hp: 40, hitReaction: null },
      ],
    },
  ];

  const result = summarizeDuelHitReactionTelemetry(samples);
  assert.equal(result.ok, false);
  assert.equal(result.checks[0].pass, true);
  assert.ok(result.checks.slice(1).every((entry) => entry.pass === false));
});

test("requires a reacted cycle to settle cleanly through resolution", () => {
  const reaction = (triggerCount, overrides = {}) => ({
    availableBoneCount: 5,
    triggerCount,
    active: false,
    elapsedSeconds: null,
    currentWeight: 0,
    lastIntensity: 0,
    lastSide: 1,
    ...overrides,
  });
  const fightingSamples = [
    {
      observedAt: 100,
      cycleId: "cycle-terminal",
      agents: [
        { id: "agent-a", hitReaction: reaction(2) },
        { id: "agent-b", hitReaction: reaction(1) },
      ],
    },
  ];
  const lifecycleSamples = [
    {
      observedAt: 200,
      cycleId: "cycle-terminal",
      phase: "RESOLUTION",
      agents: [
        {
          id: "agent-a",
          hitReaction: reaction(2, {
            active: true,
            elapsedSeconds: 0.2,
            currentWeight: 0.1,
            lastIntensity: 0.7,
          }),
        },
        { id: "agent-b", hitReaction: reaction(1) },
      ],
    },
    {
      observedAt: 600,
      cycleId: "cycle-terminal",
      phase: "RESOLUTION",
      agents: [
        { id: "agent-a", hitReaction: reaction(2) },
        { id: "agent-b", hitReaction: reaction(1) },
      ],
    },
    {
      observedAt: 850,
      cycleId: "cycle-terminal",
      phase: "RESOLUTION",
      agents: [
        { id: "agent-a", hitReaction: reaction(2) },
        { id: "agent-b", hitReaction: reaction(1) },
      ],
    },
  ];

  const passing = summarizeDuelHitReactionResolutionTelemetry(
    fightingSamples,
    lifecycleSamples,
  );
  assert.equal(passing.ok, true);
  assert.equal(passing.metrics.cleanCycleCount, 1);

  lifecycleSamples[2].agents[0].hitReaction = reaction(1, {
    active: true,
    elapsedSeconds: 0.1,
    currentWeight: 0.3,
    lastIntensity: 0.6,
  });
  const failing = summarizeDuelHitReactionResolutionTelemetry(
    fightingSamples,
    lifecycleSamples,
  );
  assert.equal(failing.ok, false);
  assert.equal(failing.metrics.cycles[0].dirtySamples, 1);
  assert.equal(failing.metrics.cycles[0].sequenceRegressions, 1);
});
