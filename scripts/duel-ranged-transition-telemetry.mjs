export const DUEL_RANGED_TRANSITION_LIMITS = Object.freeze({
  minimumTransitionsPerRangedAgent: 2,
  maximumReleaseSpawnDeltaMs: 250,
  maximumLastVisibleNockToSpawnMetres: 0.12,
  maximumReleaseHandToSpawnMetres: 0.05,
});

function round(value, places = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function percentile(values, quantile) {
  const finite = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (finite.length === 0) return null;
  return round(
    finite[
      Math.min(finite.length - 1, Math.ceil(finite.length * quantile) - 1)
    ],
  );
}

function distance(left, right) {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length !== 3 ||
    right.length !== 3
  ) {
    return null;
  }
  const delta = left.map(
    (value, index) => Number(value) - Number(right[index]),
  );
  return delta.every(Number.isFinite) ? Math.hypot(...delta) : null;
}

function check(label, pass, actual) {
  return { label, pass: pass === true, actual: String(actual) };
}

function uniqueBySequence(events) {
  const unique = new Map();
  for (const event of events) {
    if (Number.isSafeInteger(event?.sequence) && event.sequence >= 0) {
      unique.set(event.sequence, event);
    }
  }
  return [...unique.values()].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

function findDuplicateSpawnGroups(spawns) {
  const groups = new Map();
  for (const spawn of spawns) {
    const identity =
      typeof spawn.networkEventId === "string" &&
      spawn.networkEventId.length > 0
        ? `event:${spawn.networkEventId}`
        : [
            "legacy",
            spawn.attackerId,
            spawn.targetId,
            spawn.arrowId ?? "",
            spawn.performanceTimeMs,
          ].join("|");
    const group = groups.get(identity) ?? [];
    group.push(spawn.sequence);
    groups.set(identity, group);
  }
  return [...groups.entries()]
    .filter(([, sequences]) => sequences.length > 1)
    .map(([identity, sequences]) => ({ identity, sequences }));
}

function pairTransitions(releases, spawns) {
  const available = new Set(spawns.map((spawn) => spawn.sequence));
  return releases.flatMap((release) => {
    const candidates = spawns
      .filter(
        (spawn) =>
          available.has(spawn.sequence) &&
          spawn.attackerId === release.playerId,
      )
      .map((spawn) => ({
        spawn,
        deltaMs: Math.abs(spawn.performanceTimeMs - release.performanceTimeMs),
      }))
      .sort(
        (left, right) =>
          left.deltaMs - right.deltaMs ||
          left.spawn.sequence - right.spawn.sequence,
      );
    const match = candidates[0];
    if (
      !match ||
      match.deltaMs > DUEL_RANGED_TRANSITION_LIMITS.maximumReleaseSpawnDeltaMs
    ) {
      return [];
    }
    available.delete(match.spawn.sequence);
    return [
      {
        releaseSequence: release.sequence,
        spawnSequence: match.spawn.sequence,
        releaseSpawnDeltaMs: round(match.deltaMs),
        lastVisibleNockToSpawnMetres: round(
          distance(
            release.lastVisibleNockWorldPosition,
            match.spawn.startPosition,
          ),
        ),
        releaseHandToSpawnMetres: round(
          distance(release.drawHandWorldPosition, match.spawn.startPosition),
        ),
      },
    ];
  });
}

export function summarizeDuelRangedTransitionTelemetry(snapshots) {
  const ordered = [...(snapshots ?? [])].sort(
    (left, right) => left.observedAt - right.observedAt,
  );
  const rangedAgentIds = [
    ...new Set(ordered.flatMap((snapshot) => snapshot.rangedPlayerIds ?? [])),
  ].sort();
  const transitions = uniqueBySequence(
    ordered.flatMap((snapshot) => snapshot.transitions ?? []),
  );
  const spawns = uniqueBySequence(
    ordered.flatMap((snapshot) => snapshot.spawnEvents ?? []),
  );
  const duplicateSpawnGroups = findDuplicateSpawnGroups(spawns);
  const duplicateSpawnCount = duplicateSpawnGroups.reduce(
    (total, group) => total + group.sequences.length - 1,
    0,
  );
  const overlapSamples = ordered.filter((snapshot) => {
    const nocked = new Set(
      (snapshot.players ?? [])
        .filter((player) => player.nockedArrowVisible === true)
        .map((player) => player.playerId),
    );
    return (snapshot.activeArrows ?? []).some((arrow) =>
      nocked.has(arrow.attackerId),
    );
  });

  const agents = rangedAgentIds.map((playerId) => {
    const playerSamples = ordered.flatMap((snapshot) =>
      (snapshot.players ?? []).filter((player) => player.playerId === playerId),
    );
    const releases = transitions.filter(
      (transition) =>
        transition.kind === "released" && transition.playerId === playerId,
    );
    const scheduled = transitions.filter(
      (transition) =>
        transition.kind === "scheduled" && transition.playerId === playerId,
    );
    const agentSpawns = spawns.filter((spawn) => spawn.attackerId === playerId);
    const pairs = pairTransitions(releases, agentSpawns);
    const releaseSpawnDeltas = pairs
      .map((pair) => pair.releaseSpawnDeltaMs)
      .filter(Number.isFinite);
    const nockSpawnDistances = pairs
      .map((pair) => pair.lastVisibleNockToSpawnMetres)
      .filter(Number.isFinite);
    const handSpawnDistances = pairs
      .map((pair) => pair.releaseHandToSpawnMetres)
      .filter(Number.isFinite);
    return {
      playerId,
      controllerReadySamples: playerSamples.filter(
        (player) => player.controllerReady === true,
      ).length,
      controllerMissingSamples: playerSamples.filter(
        (player) => player.controllerReady !== true,
      ).length,
      visibleNockSamples: playerSamples.filter(
        (player) => player.nockedArrowVisible === true,
      ).length,
      activeArrowSamples: ordered.filter((snapshot) =>
        (snapshot.activeArrows ?? []).some(
          (arrow) => arrow.attackerId === playerId,
        ),
      ).length,
      scheduledCount: scheduled.length,
      releasedCount: releases.length,
      spawnedCount: agentSpawns.length,
      pairedCount: pairs.length,
      releaseSpawnDeltaMs: {
        p95: percentile(releaseSpawnDeltas, 0.95),
        max: releaseSpawnDeltas.length
          ? round(Math.max(...releaseSpawnDeltas))
          : null,
      },
      lastVisibleNockToSpawnMetres: {
        p95: percentile(nockSpawnDistances, 0.95),
        max:
          nockSpawnDistances.length === pairs.length && pairs.length > 0
            ? round(Math.max(...nockSpawnDistances))
            : null,
      },
      releaseHandToSpawnMetres: {
        p95: percentile(handSpawnDistances, 0.95),
        max:
          handSpawnDistances.length === pairs.length && pairs.length > 0
            ? round(Math.max(...handSpawnDistances))
            : null,
      },
      pairs,
    };
  });

  const latest = ordered.at(-1);
  const cancelledBeforeSpawnDelta = latest
    ? Number.isSafeInteger(latest.arrowCancelledBeforeSpawnDelta) &&
      latest.arrowCancelledBeforeSpawnDelta >= 0
      ? latest.arrowCancelledBeforeSpawnDelta
      : Math.max(
          0,
          Number(latest.arrowCancelledBeforeSpawnCount ?? 0) -
            Number(ordered[0]?.arrowCancelledBeforeSpawnCount ?? 0),
        )
    : 0;
  const checks = [
    check(
      "at least one ranged contestant is observed",
      rangedAgentIds.length > 0,
      rangedAgentIds.join(",") || "none",
    ),
    ...agents.flatMap((agent) => [
      check(
        `${agent.playerId} dynamic bow controller remains ready`,
        agent.controllerReadySamples > 0 &&
          agent.controllerMissingSamples === 0,
        `ready=${agent.controllerReadySamples},missing=${agent.controllerMissingSamples}`,
      ),
      check(
        `${agent.playerId} nocked arrow is observed before release`,
        agent.visibleNockSamples > 0,
        agent.visibleNockSamples,
      ),
      check(
        `${agent.playerId} launched arrow is observed in flight`,
        agent.activeArrowSamples > 0,
        agent.activeArrowSamples,
      ),
      check(
        `${agent.playerId} has repeated scheduled releases`,
        agent.scheduledCount >=
          DUEL_RANGED_TRANSITION_LIMITS.minimumTransitionsPerRangedAgent,
        agent.scheduledCount,
      ),
      check(
        `${agent.playerId} has repeated completed releases`,
        agent.releasedCount >=
          DUEL_RANGED_TRANSITION_LIMITS.minimumTransitionsPerRangedAgent,
        agent.releasedCount,
      ),
      check(
        `${agent.playerId} scheduled releases complete one-to-one`,
        agent.scheduledCount === agent.releasedCount,
        `scheduled=${agent.scheduledCount},released=${agent.releasedCount}`,
      ),
      check(
        `${agent.playerId} has repeated projectile spawns`,
        agent.spawnedCount >=
          DUEL_RANGED_TRANSITION_LIMITS.minimumTransitionsPerRangedAgent,
        agent.spawnedCount,
      ),
      check(
        `${agent.playerId} release and spawn events pair one-to-one`,
        agent.pairedCount === agent.releasedCount &&
          agent.releasedCount === agent.spawnedCount,
        `released=${agent.releasedCount},spawned=${agent.spawnedCount},paired=${agent.pairedCount}`,
      ),
      check(
        `${agent.playerId} release-to-spawn timing is bounded`,
        agent.releaseSpawnDeltaMs.max !== null &&
          agent.releaseSpawnDeltaMs.max <=
            DUEL_RANGED_TRANSITION_LIMITS.maximumReleaseSpawnDeltaMs,
        agent.releaseSpawnDeltaMs.max ?? "missing",
      ),
      check(
        `${agent.playerId} last visible nock and spawn origin remain continuous`,
        agent.lastVisibleNockToSpawnMetres.max !== null &&
          agent.lastVisibleNockToSpawnMetres.max <=
            DUEL_RANGED_TRANSITION_LIMITS.maximumLastVisibleNockToSpawnMetres,
        agent.lastVisibleNockToSpawnMetres.max ?? "missing",
      ),
      check(
        `${agent.playerId} release-hand and spawn origin remain continuous`,
        agent.releaseHandToSpawnMetres.max !== null &&
          agent.releaseHandToSpawnMetres.max <=
            DUEL_RANGED_TRANSITION_LIMITS.maximumReleaseHandToSpawnMetres,
        agent.releaseHandToSpawnMetres.max ?? "missing",
      ),
    ]),
    check(
      "nocked and launched copies never overlap for one attacker",
      overlapSamples.length === 0,
      overlapSamples.length,
    ),
    check(
      "one projectile visual spawns per authoritative launch event",
      duplicateSpawnCount === 0,
      `duplicates=${duplicateSpawnCount},groups=${duplicateSpawnGroups.length}`,
    ),
    check(
      "no delayed arrow is cancelled before visual spawn",
      cancelledBeforeSpawnDelta === 0,
      cancelledBeforeSpawnDelta,
    ),
  ];

  return {
    ok: checks.every((entry) => entry.pass),
    limits: DUEL_RANGED_TRANSITION_LIMITS,
    checks,
    metrics: {
      sampleCount: ordered.length,
      rangedAgentIds,
      transitionCount: transitions.length,
      spawnCount: spawns.length,
      duplicateSpawnCount,
      duplicateSpawnGroupCount: duplicateSpawnGroups.length,
      maximumCopiesPerSpawnEvent: duplicateSpawnGroups.length
        ? Math.max(
            ...duplicateSpawnGroups.map((group) => group.sequences.length),
          )
        : 1,
      duplicateSpawnGroups,
      overlapSampleCount: overlapSamples.length,
      cancelledBeforeSpawnDelta,
      agents,
    },
  };
}
