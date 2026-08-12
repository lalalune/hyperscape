import {
  DUEL_SCENE_CAPTURE_LIMITS,
  parseDuelSafeCrop,
} from "./duel-capture-scenarios.mjs";

const DUEL_MOTION_COMBAT_ROLES = new Set(["melee", "ranged", "mage"]);

export function parseDuelMotionRoles(value, multiStyle = false) {
  const roles = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const expectedCount = multiStyle ? 3 : 2;
  const invalidMultiStyleSet =
    multiStyle && new Set(roles).size !== expectedCount;
  if (
    roles.length !== expectedCount ||
    invalidMultiStyleSet ||
    roles.some((role) => !DUEL_MOTION_COMBAT_ROLES.has(role))
  ) {
    throw new TypeError(
      multiStyle
        ? "multi-style roles must contain melee,ranged,mage exactly once"
        : "roles must contain exactly two melee/ranged/mage values; same-style pairs are allowed",
    );
  }
  return roles;
}

export function parseDuelMotionSafeCrop(maxNdcXValue, maxNdcYValue) {
  return parseDuelSafeCrop(maxNdcXValue, maxNdcYValue);
}

export const DUEL_MOTION_TELEMETRY_LIMITS = Object.freeze({
  minimumSamples: 32,
  minimumObservationMs: 7_500,
  minimumTravelXZPerAgent: 0.35,
  minimumMovingSegmentsPerAgent: 4,
  minimumDiagonalSegments: 2,
  minimumDirectionCoverage: 3,
  maximumStationaryRatio: 0.85,
  maximumSharpReversalRatio: 0.75,
  maximumFacingP95Degrees: 20,
  maximumFacingDegrees: 75,
  maximumYawDeltaP95Degrees: 45,
  maximumYawDeltaDegrees: 120,
  minimumFightingFrames: 240,
  maximumFrameIntervalP50Ms: 18.5,
  maximumFrameIntervalP95Ms: 25,
  maximumFrameIntervalP99Ms: 33.34,
  maximumFrameWorkP95Ms: 8,
  maximumFrameWorkP99Ms: 16,
  maximumOver33MsFrameRatio: 0.02,
});

const MOVEMENT_EPSILON = 0.015;
const DIAGONAL_EPSILON = 0.01;
const DUEL_MOTION_SAMPLING_RACES = new Set([
  "browser_server_state_disagreement",
  "scene:camera_expected_target_mismatch",
  "scene:camera_target_lost",
  "scene:cycle_mismatch",
  "scene:phase_mismatch",
  "scene:scene_cycle_mismatch",
  "scene:scene_phase_mismatch",
  "post_screenshot_state_invalid",
]);

/**
 * Browser state, server state, and scene telemetry are independent snapshots.
 * A phase/cycle transition can legitimately land between those reads; the
 * capture must retry that poll without treating an unretained sample as a
 * renderer integrity failure.
 */
export function isDuelMotionSamplingRace(reason) {
  return DUEL_MOTION_SAMPLING_RACES.has(reason);
}

function round(value, places = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function percentile(values, quantile) {
  const sorted = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return round(sorted[index]);
}

function distanceXZ(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return null;
  return Math.hypot(left[0] - right[0], left[2] - right[2]);
}

function normalizedYawDegrees(quaternion) {
  if (!Array.isArray(quaternion) || quaternion.length !== 4) return null;
  const length = Math.hypot(...quaternion);
  if (!Number.isFinite(length) || length < 0.001) return null;
  const [rawX, rawY, rawZ, rawW] = quaternion;
  const x = rawX / length;
  const y = rawY / length;
  const z = rawZ / length;
  const w = rawW / length;
  const forwardX = -2 * (x * z + w * y);
  const forwardZ = -1 + 2 * (x * x + y * y);
  return (Math.atan2(forwardX, forwardZ) * 180) / Math.PI;
}

function angularDistanceDegrees(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.abs(((((right - left + 180) % 360) + 360) % 360) - 180);
}

function metricSummary(values) {
  const finite = values.filter(Number.isFinite);
  return {
    samples: finite.length,
    p50: percentile(finite, 0.5),
    p95: percentile(finite, 0.95),
    p99: percentile(finite, 0.99),
    max: finite.length > 0 ? round(Math.max(...finite)) : null,
  };
}

function check(label, pass, actual) {
  return { label, pass: pass === true, actual: String(actual) };
}

function summarizeAgent(agentId, observations) {
  const ordered = [...observations].sort(
    (left, right) => left.observedAt - right.observedAt,
  );
  let travelXZ = 0;
  let movingSegments = 0;
  let stationarySegments = 0;
  let diagonalSegments = 0;
  let sharpReversals = 0;
  let comparableMovementPairs = 0;
  const directionCoverage = new Set();
  const yawDeltas = [];
  const movementVectors = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous.cycleId !== current.cycleId) {
      movementVectors.length = 0;
      continue;
    }
    const dx = current.renderPosition[0] - previous.renderPosition[0];
    const dz = current.renderPosition[2] - previous.renderPosition[2];
    const distance = Math.hypot(dx, dz);
    travelXZ += distance;
    if (distance >= MOVEMENT_EPSILON) {
      movingSegments += 1;
      if (dx >= MOVEMENT_EPSILON) directionCoverage.add("+x");
      if (dx <= -MOVEMENT_EPSILON) directionCoverage.add("-x");
      if (dz >= MOVEMENT_EPSILON) directionCoverage.add("+z");
      if (dz <= -MOVEMENT_EPSILON) directionCoverage.add("-z");
      if (
        Math.abs(dx) >= DIAGONAL_EPSILON &&
        Math.abs(dz) >= DIAGONAL_EPSILON
      ) {
        diagonalSegments += 1;
      }
      const normalized = [dx / distance, dz / distance];
      const previousVector = movementVectors[movementVectors.length - 1];
      if (previousVector) {
        comparableMovementPairs += 1;
        if (
          previousVector[0] * normalized[0] +
            previousVector[1] * normalized[1] <=
          -0.5
        ) {
          sharpReversals += 1;
        }
      }
      movementVectors.push(normalized);
    } else {
      stationarySegments += 1;
    }

    const yawDelta = angularDistanceDegrees(
      normalizedYawDegrees(previous.renderQuaternion),
      normalizedYawDegrees(current.renderQuaternion),
    );
    if (yawDelta != null) yawDeltas.push(yawDelta);
  }

  const totalSegments = movingSegments + stationarySegments;
  return {
    id: agentId,
    role: ordered.find((entry) => entry.role)?.role ?? null,
    samples: ordered.length,
    travelXZ: round(travelXZ),
    movingSegments,
    stationarySegments,
    stationaryRatio:
      totalSegments > 0 ? round(stationarySegments / totalSegments) : null,
    diagonalSegments,
    directionCoverage: [...directionCoverage].sort(),
    sharpReversals,
    sharpReversalRatio:
      comparableMovementPairs > 0
        ? round(sharpReversals / comparableMovementPairs)
        : 0,
    facingErrorDegrees: metricSummary(
      ordered.map((entry) => entry.facingTargetErrorDegrees),
    ),
    yawDeltaDegrees: metricSummary(yawDeltas),
    simulationDriftXZ: metricSummary(
      ordered.map((entry) =>
        distanceXZ(entry.simulationPosition, entry.renderPosition),
      ),
    ),
    avatarDriftXZ: metricSummary(
      ordered.map((entry) =>
        distanceXZ(entry.avatarPosition, entry.renderPosition),
      ),
    ),
    outsideArenaSamples: ordered.filter((entry) => !entry.insideCombatArena)
      .length,
    hiddenSamples: ordered.filter((entry) => !entry.visible).length,
    inactiveSamples: ordered.filter((entry) => !entry.active).length,
    avatarNotReadySamples: ordered.filter((entry) => !entry.avatarReady).length,
  };
}

function summarizePerformance(performance) {
  const fighting = performance?.byPhase?.FIGHTING;
  const frames = fighting?.frames;
  const interval = fighting?.frameIntervalMs;
  const work = fighting?.frameWorkMs;
  const over33 = fighting?.frameBudget?.above33_33Ms;
  const over33Ratio =
    Number.isFinite(frames) && frames > 0 && Number.isFinite(over33)
      ? over33 / frames
      : null;
  return {
    frames: Number.isFinite(frames) ? frames : null,
    frameIntervalMs: interval ?? null,
    frameWorkMs: work ?? null,
    framesAbove33_33Ms: Number.isFinite(over33) ? over33 : null,
    over33_33MsRatio: round(over33Ratio),
    snapshotUpdatedAt: Number.isSafeInteger(performance?.updatedAt)
      ? performance.updatedAt
      : null,
  };
}

export function summarizeDuelStyleSwitchTelemetry(
  samples,
  maximumUiStyleSwitchEvents = 0,
) {
  const byAgent = new Map();
  for (const sample of [...samples].sort(
    (left, right) => left.observedAt - right.observedAt,
  )) {
    for (const agent of sample.agents) {
      const entry = byAgent.get(agent.id) ?? {
        id: agent.id,
        roles: new Set(),
        switches: 0,
        lastCycleId: null,
        lastRole: null,
      };
      entry.roles.add(agent.role);
      if (
        entry.lastCycleId === sample.cycleId &&
        entry.lastRole !== null &&
        entry.lastRole !== agent.role
      ) {
        entry.switches += 1;
      }
      entry.lastCycleId = sample.cycleId;
      entry.lastRole = agent.role;
      byAgent.set(agent.id, entry);
    }
  }
  const agents = [...byAgent.values()]
    .map((entry) => ({
      id: entry.id,
      roles: [...entry.roles].sort(),
      switches: entry.switches,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    agents,
    totalSwitches: agents.reduce((total, agent) => total + agent.switches, 0),
    maximumUiStyleSwitchEvents,
  };
}

export function evaluateDuelStyleSwitchTelemetry(metrics, expectedRoles) {
  const observedRoles = [
    ...new Set(metrics.agents.flatMap((agent) => agent.roles)),
  ].sort();
  const expected = [...new Set(expectedRoles)].sort();
  return [
    check(
      "both contestants execute a frozen mid-fight role switch",
      metrics.agents.length === 2 &&
        metrics.agents.every((agent) => agent.switches >= 1),
      metrics.agents.map((agent) => `${agent.id}:${agent.switches}`).join(","),
    ),
    check(
      "all frozen combat roles are observed live",
      JSON.stringify(observedRoles) === JSON.stringify(expected),
      observedRoles.join(","),
    ),
    check(
      "style-switch event is visible in the fight log",
      metrics.maximumUiStyleSwitchEvents >= 1,
      metrics.maximumUiStyleSwitchEvents,
    ),
  ];
}

export const DUEL_HIT_REACTION_TELEMETRY_LIMITS = Object.freeze({
  requiredBoneCount: 5,
  minimumHealthDropEvents: 4,
  minimumPositiveWeightSamples: 2,
  maximumAlignmentMs: 500,
  resolutionGraceMs: 350,
  minimumCleanResolutionSamples: 2,
});

export function summarizeDuelHitReactionTelemetry(samples) {
  const ordered = [...samples].sort(
    (left, right) => left.observedAt - right.observedAt,
  );
  const firstSampleByCycle = new Map();
  for (const sample of ordered) {
    if (sample?.cycleId && !firstSampleByCycle.has(sample.cycleId)) {
      firstSampleByCycle.set(sample.cycleId, sample);
    }
  }
  const incompleteCycleIds = new Set(
    [...firstSampleByCycle.entries()]
      .filter(([, sample]) =>
        (sample.agents ?? []).some((agent) => {
          const attacksLanded = Number(agent.attacksLanded);
          const hp = Number(agent.hp);
          const maxHp = Number(agent.maxHp);
          return (
            (Number.isFinite(attacksLanded) && attacksLanded > 0) ||
            (Number.isFinite(hp) &&
              Number.isFinite(maxHp) &&
              maxHp > 0 &&
              hp < maxHp)
          );
        }),
      )
      .map(([cycleId]) => cycleId),
  );
  // A capture can finish loading after a fight's first hit. Its first retained
  // trigger count is then only a baseline, while a later state update can expose
  // the corresponding HP loss as if it were new. Keep those partial cycles for
  // motion/performance evidence, but require complete observed cycles for exact
  // damage/reaction sequence accounting.
  const evaluated = ordered.filter(
    (sample) => !incompleteCycleIds.has(sample.cycleId),
  );
  const previousByCycleAgent = new Map();
  const healthDrops = [];
  const triggerIncrements = [];
  const agents = new Map();
  let expectedDiagnostics = 0;
  let retainedDiagnostics = 0;
  let positiveWeightSamples = 0;
  let activeAuthoredMotionSamples = 0;
  let sequenceResets = 0;

  for (const sample of evaluated) {
    for (const agent of sample.agents ?? []) {
      expectedDiagnostics += 1;
      const key = `${sample.cycleId}\0${agent.id}`;
      const previous = previousByCycleAgent.get(key);
      const reaction = agent.hitReaction;
      const metrics = agents.get(agent.id) ?? {
        id: agent.id,
        healthDropEvents: 0,
        triggerIncrements: 0,
        positiveWeightSamples: 0,
        activeSamples: 0,
        availableBoneCounts: new Set(),
      };

      if (reaction) {
        retainedDiagnostics += 1;
        metrics.availableBoneCounts.add(reaction.availableBoneCount);
        if (reaction.active) metrics.activeSamples += 1;
        if (reaction.currentWeight > 0) {
          positiveWeightSamples += 1;
          metrics.positiveWeightSamples += 1;
          if (
            typeof agent.avatarEmote === "string" &&
            !/(?:^|[-_/])(idle|death)(?:[-_.?/]|$)/i.test(agent.avatarEmote)
          ) {
            activeAuthoredMotionSamples += 1;
          }
        }
      }

      if (previous) {
        if (agent.hp < previous.hp) {
          const event = {
            agentId: agent.id,
            cycleId: sample.cycleId,
            observedAt: sample.observedAt,
            damage: previous.hp - agent.hp,
          };
          healthDrops.push(event);
          metrics.healthDropEvents += 1;
        }
        if (reaction && previous.hitReaction) {
          const delta =
            reaction.triggerCount - previous.hitReaction.triggerCount;
          if (delta < 0) {
            sequenceResets += 1;
          } else if (delta > 0) {
            triggerIncrements.push({
              agentId: agent.id,
              cycleId: sample.cycleId,
              observedAt: sample.observedAt,
              count: delta,
            });
            metrics.triggerIncrements += delta;
          }
        }
      }
      previousByCycleAgent.set(key, {
        hp: agent.hp,
        hitReaction: reaction ?? null,
      });
      agents.set(agent.id, metrics);
    }
  }

  const aligned = (left, right) =>
    left.agentId === right.agentId &&
    left.cycleId === right.cycleId &&
    Math.abs(left.observedAt - right.observedAt) <=
      DUEL_HIT_REACTION_TELEMETRY_LIMITS.maximumAlignmentMs;
  const unmatchedHealthDrops = healthDrops.filter(
    (drop) => !triggerIncrements.some((trigger) => aligned(drop, trigger)),
  );
  const unmatchedTriggerIncrements = triggerIncrements.filter(
    (trigger) => !healthDrops.some((drop) => aligned(drop, trigger)),
  );
  const agentMetrics = [...agents.values()]
    .map((entry) => ({
      ...entry,
      availableBoneCounts: [...entry.availableBoneCounts].sort(
        (left, right) => left - right,
      ),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const checks = [
    check(
      "hit-reaction alignment includes a complete observed duel cycle",
      firstSampleByCycle.size > incompleteCycleIds.size,
      `${firstSampleByCycle.size - incompleteCycleIds.size} complete, ${incompleteCycleIds.size} partial`,
    ),
    check(
      "every retained contestant exposes complete hit-reaction diagnostics",
      expectedDiagnostics > 0 &&
        retainedDiagnostics === expectedDiagnostics &&
        agentMetrics.length === 2 &&
        agentMetrics.every(
          (agent) =>
            agent.availableBoneCounts.length === 1 &&
            agent.availableBoneCounts[0] ===
              DUEL_HIT_REACTION_TELEMETRY_LIMITS.requiredBoneCount,
        ),
      `${retainedDiagnostics}/${expectedDiagnostics} samples; ${agentMetrics
        .map((agent) => `${agent.id}:${agent.availableBoneCounts.join("/")}`)
        .join(",")}`,
    ),
    check(
      "both contestants receive repeated authoritative damage reactions",
      healthDrops.length >=
        DUEL_HIT_REACTION_TELEMETRY_LIMITS.minimumHealthDropEvents &&
        agentMetrics.length === 2 &&
        agentMetrics.every(
          (agent) => agent.healthDropEvents > 0 && agent.triggerIncrements > 0,
        ),
      `${healthDrops.length} health drops; ${triggerIncrements.reduce(
        (total, event) => total + event.count,
        0,
      )} triggers`,
    ),
    check(
      "health loss and avatar reaction sequences remain aligned",
      unmatchedHealthDrops.length === 0 &&
        unmatchedTriggerIncrements.length === 0 &&
        sequenceResets === 0,
      `unmatched health=${unmatchedHealthDrops.length}, triggers=${unmatchedTriggerIncrements.length}, resets=${sequenceResets}`,
    ),
    check(
      "non-zero reaction weight is sampled in the real mixer",
      positiveWeightSamples >=
        DUEL_HIT_REACTION_TELEMETRY_LIMITS.minimumPositiveWeightSamples,
      `${positiveWeightSamples} weighted samples`,
    ),
    check(
      "reaction overlays an active authored motion",
      activeAuthoredMotionSamples > 0,
      `${activeAuthoredMotionSamples} weighted non-idle samples`,
    ),
  ];

  return {
    ok: checks.every((entry) => entry.pass),
    metrics: {
      sampleCount: ordered.length,
      evaluatedSampleCount: evaluated.length,
      completeCycleCount: firstSampleByCycle.size - incompleteCycleIds.size,
      incompleteCycleCount: incompleteCycleIds.size,
      retainedDiagnostics,
      expectedDiagnostics,
      healthDropEvents: healthDrops.length,
      triggerIncrements: triggerIncrements.reduce(
        (total, event) => total + event.count,
        0,
      ),
      positiveWeightSamples,
      activeAuthoredMotionSamples,
      unmatchedHealthDrops: unmatchedHealthDrops.length,
      unmatchedTriggerIncrements: unmatchedTriggerIncrements.length,
      sequenceResets,
      agents: agentMetrics,
    },
    checks,
  };
}

/**
 * Prove that a reaction sequence observed during a fight is fully removed from
 * the same avatars after that cycle enters resolution. The grace period allows
 * an in-flight 280 ms recoil to finish, but every later retained resolution
 * sample must be clean and preserve the monotonically increasing trigger
 * sequence.
 */
export function summarizeDuelHitReactionResolutionTelemetry(
  fightingSamples,
  lifecycleSamples,
) {
  const fightingByCycle = new Map();
  for (const sample of fightingSamples ?? []) {
    if (sample?.cycleId && sample?.agents?.length === 2) {
      const retained = fightingByCycle.get(sample.cycleId) ?? [];
      retained.push(sample);
      fightingByCycle.set(sample.cycleId, retained);
    }
  }

  const resolutionByCycle = new Map();
  for (const sample of lifecycleSamples ?? []) {
    if (
      sample?.phase === "RESOLUTION" &&
      sample?.cycleId &&
      sample?.agents?.length === 2
    ) {
      const retained = resolutionByCycle.get(sample.cycleId) ?? [];
      retained.push(sample);
      resolutionByCycle.set(sample.cycleId, retained);
    }
  }

  const cycles = [];
  for (const [cycleId, rawFighting] of fightingByCycle) {
    const rawResolution = resolutionByCycle.get(cycleId);
    if (!rawResolution?.length) continue;
    const fighting = [...rawFighting].sort(
      (left, right) => left.observedAt - right.observedAt,
    );
    const resolution = [...rawResolution].sort(
      (left, right) => left.observedAt - right.observedAt,
    );
    const fightingAgents = new Map();
    for (const sample of fighting) {
      for (const agent of sample.agents) {
        const previous = fightingAgents.get(agent.id) ?? 0;
        fightingAgents.set(
          agent.id,
          Math.max(previous, agent.hitReaction?.triggerCount ?? 0),
        );
      }
    }
    if (
      fightingAgents.size !== 2 ||
      ![...fightingAgents.values()].some((triggerCount) => triggerCount > 0)
    ) {
      continue;
    }

    const graceEndsAt =
      resolution[0].observedAt +
      DUEL_HIT_REACTION_TELEMETRY_LIMITS.resolutionGraceMs;
    const settled = resolution.filter(
      (sample) => sample.observedAt >= graceEndsAt,
    );
    let dirtySamples = 0;
    let sequenceRegressions = 0;
    let completeDiagnostics = 0;
    for (const sample of settled) {
      let sampleClean = true;
      for (const agent of sample.agents) {
        const reaction = agent.hitReaction;
        if (
          reaction &&
          reaction.availableBoneCount ===
            DUEL_HIT_REACTION_TELEMETRY_LIMITS.requiredBoneCount
        ) {
          completeDiagnostics += 1;
        } else {
          sampleClean = false;
        }
        if (
          !reaction ||
          reaction.active ||
          reaction.elapsedSeconds !== null ||
          reaction.currentWeight !== 0 ||
          reaction.lastIntensity !== 0
        ) {
          sampleClean = false;
        }
        if (
          reaction &&
          reaction.triggerCount < (fightingAgents.get(agent.id) ?? 0)
        ) {
          sequenceRegressions += 1;
          sampleClean = false;
        }
      }
      if (!sampleClean) dirtySamples += 1;
    }
    cycles.push({
      cycleId,
      fightingSamples: fighting.length,
      resolutionSamples: resolution.length,
      settledSamples: settled.length,
      completeDiagnostics,
      expectedDiagnostics: settled.length * 2,
      dirtySamples,
      sequenceRegressions,
      clean:
        settled.length >=
          DUEL_HIT_REACTION_TELEMETRY_LIMITS.minimumCleanResolutionSamples &&
        completeDiagnostics === settled.length * 2 &&
        dirtySamples === 0 &&
        sequenceRegressions === 0,
    });
  }

  const cleanCycles = cycles.filter((cycle) => cycle.clean);
  const checks = [
    check(
      "a reacted fighting cycle reaches sampled resolution",
      cycles.length > 0,
      `${cycles.length} paired cycles`,
    ),
    check(
      "post-fight reaction offsets fully clear after the bounded grace period",
      cleanCycles.length > 0,
      cycles.length > 0
        ? cycles
            .map(
              (cycle) =>
                `${cycle.cycleId}:settled=${cycle.settledSamples},dirty=${cycle.dirtySamples}`,
            )
            .join(", ")
        : "no paired cycle",
    ),
    check(
      "reaction trigger sequences remain monotonic through resolution",
      cleanCycles.length > 0 &&
        cycles.every((cycle) => cycle.sequenceRegressions === 0),
      `${cycles.reduce(
        (total, cycle) => total + cycle.sequenceRegressions,
        0,
      )} regressions`,
    ),
  ];

  return {
    ok: checks.every((entry) => entry.pass),
    metrics: {
      fightingCycleCount: fightingByCycle.size,
      resolutionCycleCount: resolutionByCycle.size,
      pairedCycleCount: cycles.length,
      cleanCycleCount: cleanCycles.length,
      cycles,
    },
    checks,
  };
}

export function summarizeDuelMotionTelemetry({
  samples,
  performance,
  expectedRoles,
  safeCrop = null,
}) {
  const orderedSamples = [...samples].sort(
    (left, right) => left.observedAt - right.observedAt,
  );
  const cycles = new Map();
  const agentObservations = new Map();
  const observedRoles = new Set();
  const separations = [];
  const projectedPositions = [];

  for (const sample of orderedSamples) {
    const times = cycles.get(sample.cycleId) ?? [];
    times.push(sample.observedAt);
    cycles.set(sample.cycleId, times);
    if (Number.isFinite(sample.renderedSeparationXZ)) {
      separations.push(sample.renderedSeparationXZ);
    }
    for (const agent of sample.agents) {
      observedRoles.add(agent.role);
      if (
        Array.isArray(agent.ndcPosition) &&
        agent.ndcPosition.length === 3 &&
        agent.ndcPosition.every(Number.isFinite)
      ) {
        projectedPositions.push(agent.ndcPosition);
      }
      const observations = agentObservations.get(agent.id) ?? [];
      observations.push({
        ...agent,
        observedAt: sample.observedAt,
        cycleId: sample.cycleId,
      });
      agentObservations.set(agent.id, observations);
    }
  }

  const observationMs = [...cycles.values()].reduce((total, timestamps) => {
    if (timestamps.length < 2) return total;
    return total + Math.max(...timestamps) - Math.min(...timestamps);
  }, 0);
  const agents = [...agentObservations.entries()]
    .map(([agentId, observations]) => summarizeAgent(agentId, observations))
    .sort((left, right) => left.id.localeCompare(right.id));
  const performanceSummary = summarizePerformance(performance);
  const expectedRoleSet = [...new Set(expectedRoles)].sort();
  const observedRoleSet = [...observedRoles].sort();
  const combinedDiagonalSegments = agents.reduce(
    (total, agent) => total + agent.diagonalSegments,
    0,
  );
  const combinedDirectionCoverage = [
    ...new Set(agents.flatMap((agent) => agent.directionCoverage)),
  ].sort();
  const containmentFailures = agents.reduce(
    (total, agent) =>
      total +
      agent.outsideArenaSamples +
      agent.hiddenSamples +
      agent.inactiveSamples +
      agent.avatarNotReadySamples,
    0,
  );
  const expectedProjectionCount = orderedSamples.length * 2;
  const safeCropViolations = safeCrop
    ? projectedPositions.filter(
        (position) =>
          Math.abs(position[0]) > safeCrop.maxAbsX ||
          Math.abs(position[1]) > safeCrop.maxAbsY,
      ).length
    : 0;
  const safeCropMetrics = safeCrop
    ? {
        ...safeCrop,
        expectedProjectionCount,
        retainedProjectionCount: projectedPositions.length,
        violations: safeCropViolations,
        maximumObservedAbsX:
          projectedPositions.length > 0
            ? round(
                Math.max(
                  ...projectedPositions.map((entry) => Math.abs(entry[0])),
                ),
              )
            : null,
        maximumObservedAbsY:
          projectedPositions.length > 0
            ? round(
                Math.max(
                  ...projectedPositions.map((entry) => Math.abs(entry[1])),
                ),
              )
            : null,
      }
    : null;

  const checks = [
    check(
      "requested combat roles observed",
      JSON.stringify(observedRoleSet) === JSON.stringify(expectedRoleSet),
      observedRoleSet.join(",") || "none",
    ),
    check(
      "bounded fighting time series retained",
      orderedSamples.length >= DUEL_MOTION_TELEMETRY_LIMITS.minimumSamples &&
        observationMs >= DUEL_MOTION_TELEMETRY_LIMITS.minimumObservationMs,
      `${orderedSamples.length} samples over ${observationMs}ms`,
    ),
    check(
      "exactly two contestants retained",
      agents.length === 2,
      `${agents.length} contestants`,
    ),
    check(
      "every contestant demonstrates tactical travel",
      agents.length === 2 &&
        agents.every(
          (agent) =>
            agent.travelXZ >=
              DUEL_MOTION_TELEMETRY_LIMITS.minimumTravelXZPerAgent &&
            agent.movingSegments >=
              DUEL_MOTION_TELEMETRY_LIMITS.minimumMovingSegmentsPerAgent,
        ),
      agents
        .map(
          (agent) =>
            `${agent.role}:${agent.travelXZ}m/${agent.movingSegments} segments`,
        )
        .join(", "),
    ),
    check(
      "diagonal movement observed",
      combinedDiagonalSegments >=
        DUEL_MOTION_TELEMETRY_LIMITS.minimumDiagonalSegments,
      `${combinedDiagonalSegments} diagonal segments`,
    ),
    check(
      "multi-direction movement observed",
      combinedDirectionCoverage.length >=
        DUEL_MOTION_TELEMETRY_LIMITS.minimumDirectionCoverage,
      combinedDirectionCoverage.join(",") || "none",
    ),
    check(
      "contestants do not remain mostly stationary",
      agents.length === 2 &&
        agents.every(
          (agent) =>
            agent.stationaryRatio != null &&
            agent.stationaryRatio <=
              DUEL_MOTION_TELEMETRY_LIMITS.maximumStationaryRatio,
        ),
      agents
        .map((agent) => `${agent.role}:${agent.stationaryRatio}`)
        .join(", "),
    ),
    check(
      "movement avoids pathological reversal oscillation",
      agents.length === 2 &&
        agents.every(
          (agent) =>
            agent.sharpReversalRatio <=
            DUEL_MOTION_TELEMETRY_LIMITS.maximumSharpReversalRatio,
        ),
      agents
        .map((agent) => `${agent.role}:${agent.sharpReversalRatio}`)
        .join(", "),
    ),
    check(
      "opponent-facing rotation remains settled",
      agents.length === 2 &&
        agents.every(
          (agent) =>
            agent.facingErrorDegrees.samples >=
              DUEL_MOTION_TELEMETRY_LIMITS.minimumSamples &&
            agent.facingErrorDegrees.p95 <=
              DUEL_MOTION_TELEMETRY_LIMITS.maximumFacingP95Degrees &&
            agent.facingErrorDegrees.max <=
              DUEL_MOTION_TELEMETRY_LIMITS.maximumFacingDegrees,
        ),
      agents
        .map(
          (agent) =>
            `${agent.role}:p95=${agent.facingErrorDegrees.p95},max=${agent.facingErrorDegrees.max}`,
        )
        .join(", "),
    ),
    check(
      "rotation changes remain smooth",
      agents.length === 2 &&
        agents.every(
          (agent) =>
            agent.yawDeltaDegrees.samples > 0 &&
            agent.yawDeltaDegrees.p95 <=
              DUEL_MOTION_TELEMETRY_LIMITS.maximumYawDeltaP95Degrees &&
            agent.yawDeltaDegrees.max <=
              DUEL_MOTION_TELEMETRY_LIMITS.maximumYawDeltaDegrees,
        ),
      agents
        .map(
          (agent) =>
            `${agent.role}:p95=${agent.yawDeltaDegrees.p95},max=${agent.yawDeltaDegrees.max}`,
        )
        .join(", "),
    ),
    check(
      "avatars stay visible, active, loaded, and inside the arena",
      agents.length === 2 && containmentFailures === 0,
      `${containmentFailures} violations`,
    ),
    ...(safeCropMetrics
      ? [
          check(
            "contestants stay inside the declared stream-safe crop",
            projectedPositions.length === expectedProjectionCount &&
              safeCropViolations === 0,
            [
              projectedPositions.length,
              "/",
              expectedProjectionCount,
              " projections, ",
              safeCropViolations,
              " violations, maxAbsX=",
              safeCropMetrics.maximumObservedAbsX,
              ", maxAbsY=",
              safeCropMetrics.maximumObservedAbsY,
            ].join(""),
          ),
        ]
      : []),
    check(
      "simulation and render transforms agree",
      agents.length === 2 &&
        agents.every(
          (agent) =>
            agent.simulationDriftXZ.max != null &&
            agent.simulationDriftXZ.max <=
              DUEL_SCENE_CAPTURE_LIMITS.maximumSimulationDriftXZ,
        ),
      agents
        .map((agent) => `${agent.role}:${agent.simulationDriftXZ.max}`)
        .join(", "),
    ),
    check(
      "avatar and render transforms agree",
      agents.length === 2 &&
        agents.every(
          (agent) =>
            agent.avatarDriftXZ.max != null &&
            agent.avatarDriftXZ.max <=
              DUEL_SCENE_CAPTURE_LIMITS.maximumAvatarDriftXZ,
        ),
      agents
        .map((agent) => `${agent.role}:${agent.avatarDriftXZ.max}`)
        .join(", "),
    ),
    check(
      "contestants remain visibly separated",
      separations.length >= DUEL_MOTION_TELEMETRY_LIMITS.minimumSamples &&
        Math.min(...separations) >=
          DUEL_SCENE_CAPTURE_LIMITS.minimumRenderedSeparationXZ,
      separations.length > 0
        ? `min=${round(Math.min(...separations))}`
        : "none",
    ),
    check(
      "60 FPS fighting telemetry retained",
      performanceSummary.frames >=
        DUEL_MOTION_TELEMETRY_LIMITS.minimumFightingFrames,
      `${performanceSummary.frames ?? 0} frames`,
    ),
    check(
      "60 FPS cadence meets percentile budget",
      performanceSummary.frameIntervalMs?.p50 <=
        DUEL_MOTION_TELEMETRY_LIMITS.maximumFrameIntervalP50Ms &&
        performanceSummary.frameIntervalMs?.p95 <=
          DUEL_MOTION_TELEMETRY_LIMITS.maximumFrameIntervalP95Ms &&
        performanceSummary.frameIntervalMs?.p99 <=
          DUEL_MOTION_TELEMETRY_LIMITS.maximumFrameIntervalP99Ms,
      `p50=${performanceSummary.frameIntervalMs?.p50 ?? null},p95=${performanceSummary.frameIntervalMs?.p95 ?? null},p99=${performanceSummary.frameIntervalMs?.p99 ?? null}`,
    ),
    check(
      "render work meets frame budget",
      performanceSummary.frameWorkMs?.p95 <=
        DUEL_MOTION_TELEMETRY_LIMITS.maximumFrameWorkP95Ms &&
        performanceSummary.frameWorkMs?.p99 <=
          DUEL_MOTION_TELEMETRY_LIMITS.maximumFrameWorkP99Ms,
      `p95=${performanceSummary.frameWorkMs?.p95 ?? null},p99=${performanceSummary.frameWorkMs?.p99 ?? null}`,
    ),
    check(
      "slow-frame ratio remains bounded",
      performanceSummary.over33_33MsRatio != null &&
        performanceSummary.over33_33MsRatio <=
          DUEL_MOTION_TELEMETRY_LIMITS.maximumOver33MsFrameRatio,
      `${performanceSummary.over33_33MsRatio ?? null}`,
    ),
  ];

  return {
    ok: checks.every((entry) => entry.pass),
    metrics: {
      sampleCount: orderedSamples.length,
      observationMs,
      cycleCount: cycles.size,
      observedRoles: observedRoleSet,
      agents,
      combinedDiagonalSegments,
      combinedDirectionCoverage,
      renderedSeparationXZ: metricSummary(separations),
      safeCropNdc: safeCropMetrics,
      performance: performanceSummary,
    },
    checks,
  };
}
