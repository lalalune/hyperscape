import {
  isPositionInsideCombatArena,
  type StreamingDuelBowPresentationDiagnostics,
  type StreamingDuelEquipmentVisualReadiness,
  type StreamingPerformanceSnapshot,
  type StreamingProjectileVisualDiagnostics,
} from "@hyperforge/shared";

type Vector3Like = {
  x: number;
  y: number;
  z: number;
  clone?: () => Vector3Like & {
    project?: (camera: unknown) => Vector3Like;
  };
};

type QuaternionLike = {
  x: number;
  y: number;
  z: number;
  w: number;
};

type EntityLike = {
  id?: string;
  isAgent?: boolean;
  isEmbeddedAgent?: boolean;
  active?: boolean;
  destroyed?: boolean;
  data?: {
    id?: string;
    characterId?: string;
    isAgent?: boolean;
    isEmbeddedAgent?: boolean;
  };
  position?: Vector3Like;
  node?: {
    position?: Vector3Like;
    quaternion?: QuaternionLike;
    visible?: boolean;
  };
  mesh?: { visible?: boolean } | null;
  base?: {
    position?: Vector3Like;
    quaternion?: QuaternionLike;
    visible?: boolean;
  };
  lerpPosition?: { current?: Vector3Like };
  avatar?: {
    emote?: unknown;
    instance?: {
      raw?: { scene?: { visible?: boolean } };
      getHitReactionDiagnostics?: () => unknown;
    };
  };
  _fallbackAvatarRoot?: { visible?: boolean } | null;
};

export type StreamingDiagnosticsWorld = {
  camera?: {
    position?: Vector3Like;
    fov?: number;
    aspect?: number;
  };
  entities?: {
    get?: (id: string) => unknown;
    players?: Map<unknown, unknown>;
    items?: Map<unknown, unknown>;
  };
  network?: unknown;
  getSystem?: (name: string) => unknown;
  graphics?: { isPrecompileIdle?: () => boolean };
};

type DiagnosticsState = {
  cycle?: {
    cycleId?: string;
    phase?: string;
    agent1?: { id?: string } | null;
    agent2?: { id?: string } | null;
    arenaPositions?: {
      agent1?: [number, number, number];
      agent2?: [number, number, number];
    } | null;
  };
  cameraTarget?: string | null;
};

export type StreamingSceneAgentDiagnostics = {
  id: string;
  arenaSpawnPosition: [number, number, number] | null;
  simulationPosition: [number, number, number] | null;
  renderPosition: [number, number, number] | null;
  avatarPosition: [number, number, number] | null;
  renderQuaternion: [number, number, number, number] | null;
  facingTargetErrorDegrees: number | null;
  avatarReady: boolean;
  ndcPosition: [number, number, number] | null;
  insideCombatArena: boolean;
  visible: boolean;
  active: boolean;
  hitReaction?: StreamingSceneHitReactionDiagnostics;
  avatarEmote?: string;
};

export type StreamingSceneHitReactionDiagnostics = {
  schemaVersion: 1;
  availableBoneCount: number;
  triggerCount: number;
  active: boolean;
  elapsedSeconds: number | null;
  currentWeight: number;
  lastIntensity: number;
  lastSide: -1 | 1;
};

export type StreamingSceneDiagnostics = {
  schemaVersion: 1;
  updatedAt: number;
  cycleId: string;
  phase: string;
  agents: [
    StreamingSceneAgentDiagnostics | null,
    StreamingSceneAgentDiagnostics | null,
  ];
  arenaSpawnSeparationXZ: number | null;
  renderedSeparationXZ: number | null;
  arenaVisualsReady: boolean;
  camera: {
    position: [number, number, number] | null;
    fov: number | null;
    aspect: number | null;
    targetId: string | null;
    expectedTargetId: string | null;
  };
  combatPresentation?: {
    bow: StreamingDuelBowPresentationDiagnostics | null;
    projectiles: StreamingProjectileVisualDiagnostics | null;
  };
};

export type StreamingSceneReadinessEvidence = {
  ready: boolean;
  phase: string | null;
  contestantsMustBeVisible: boolean;
  arenaVisualsReady: boolean;
  terrainVisualsReady: boolean;
  terrain: unknown | null;
  grass: unknown | null;
  precompileIdle: boolean;
  equipmentVisualsReady: boolean;
  equipmentVisuals: StreamingDuelEquipmentVisualReadiness | null;
  expectedAgentCount: number;
  loadedExpectedAgentCount: number;
  visibleExpectedAgentCount: number;
  loadedProductionAgentCount: number;
  visibleProductionAgentCount: number;
  agents: StreamingSceneDiagnostics["agents"];
  coldRenderSettled?: boolean;
  coldRender?: StreamingColdRenderStability;
};

function finiteVector(value: unknown): value is Vector3Like {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const vector = value as Partial<Vector3Like>;
  return (
    typeof vector.x === "number" &&
    Number.isFinite(vector.x) &&
    typeof vector.y === "number" &&
    Number.isFinite(vector.y) &&
    typeof vector.z === "number" &&
    Number.isFinite(vector.z)
  );
}

function finiteTuple(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const tuple = value.slice(0, 3).map(Number);
  return tuple.every(Number.isFinite) ? [tuple[0], tuple[1], tuple[2]] : null;
}

function vectorTuple(value: unknown): [number, number, number] | null {
  return finiteVector(value) ? [value.x, value.y, value.z] : null;
}

function quaternionTuple(
  value: unknown,
): [number, number, number, number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const quaternion = value as Partial<QuaternionLike>;
  const tuple = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
  return tuple.every(
    (component) => typeof component === "number" && Number.isFinite(component),
  )
    ? (tuple as [number, number, number, number])
    : null;
}

function normalizeHitReactionDiagnostics(
  value: unknown,
): StreamingSceneHitReactionDiagnostics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<StreamingSceneHitReactionDiagnostics>;
  const elapsedSeconds = candidate.elapsedSeconds;
  if (
    candidate.schemaVersion !== 1 ||
    !Number.isSafeInteger(candidate.availableBoneCount) ||
    candidate.availableBoneCount! < 0 ||
    candidate.availableBoneCount! > 5 ||
    !Number.isSafeInteger(candidate.triggerCount) ||
    candidate.triggerCount! < 0 ||
    typeof candidate.active !== "boolean" ||
    !(
      elapsedSeconds === null ||
      (typeof elapsedSeconds === "number" &&
        Number.isFinite(elapsedSeconds) &&
        elapsedSeconds >= 0)
    ) ||
    candidate.active !== (elapsedSeconds !== null) ||
    typeof candidate.currentWeight !== "number" ||
    !Number.isFinite(candidate.currentWeight) ||
    candidate.currentWeight < 0 ||
    candidate.currentWeight > 1.25 ||
    typeof candidate.lastIntensity !== "number" ||
    !Number.isFinite(candidate.lastIntensity) ||
    candidate.lastIntensity < 0 ||
    candidate.lastIntensity > 1.25 ||
    (candidate.lastSide !== -1 && candidate.lastSide !== 1)
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    availableBoneCount: candidate.availableBoneCount!,
    triggerCount: candidate.triggerCount!,
    active: candidate.active,
    elapsedSeconds,
    currentWeight: candidate.currentWeight,
    lastIntensity: candidate.lastIntensity,
    lastSide: candidate.lastSide,
  };
}

function entityIdentity(entity: EntityLike): string | null {
  return entity.data?.characterId || entity.data?.id || entity.id || null;
}

function resolveEntity(
  world: StreamingDiagnosticsWorld,
  id: string,
): EntityLike | null {
  const direct = world.entities?.get?.(id);
  if (direct && typeof direct === "object") return direct as EntityLike;

  for (const collection of [world.entities?.players, world.entities?.items]) {
    if (!collection) continue;
    for (const entity of collection.values()) {
      if (
        entity &&
        typeof entity === "object" &&
        entityIdentity(entity as EntityLike) === id
      ) {
        return entity as EntityLike;
      }
    }
  }
  return null;
}

function simulationPosition(
  world: StreamingDiagnosticsWorld,
  entity: EntityLike,
  id: string,
): Vector3Like | null {
  // The client runtime registers ClientNetwork as `network` and also exposes
  // it directly on the world. The old diagnostics-only `client-network` key
  // does not exist in a production client, which made this probe silently fall
  // back to a stale lerpPosition after tile movement took ownership.
  const clientNetwork = (world.network ??
    world.getSystem?.("network") ??
    world.getSystem?.("client-network")) as
    | {
        tileInterpolator?: {
          getVisualPosition?: (entityId: string) => unknown;
        };
      }
    | undefined;
  const tilePosition =
    clientNetwork?.tileInterpolator?.getVisualPosition?.(id) ?? null;
  if (finiteVector(tilePosition)) return tilePosition;
  if (finiteVector(entity.lerpPosition?.current)) {
    return entity.lerpPosition.current;
  }
  return finiteVector(entity.position) ? entity.position : null;
}

function renderedPosition(entity: EntityLike): Vector3Like | null {
  for (const candidate of [
    entity.node?.position,
    entity.position,
    entity.base?.position,
  ]) {
    if (finiteVector(candidate)) return candidate;
  }
  return null;
}

function projectedPosition(
  position: Vector3Like | null,
  camera: unknown,
): [number, number, number] | null {
  if (!position?.clone || !camera) return null;
  try {
    const projected = position.clone();
    if (typeof projected.project !== "function") return null;
    projected.project(camera);
    return vectorTuple(projected);
  } catch {
    return null;
  }
}

function distanceXZ(
  left: [number, number, number] | null,
  right: [number, number, number] | null,
): number | null {
  if (!left || !right) return null;
  return (
    Math.round(Math.hypot(left[0] - right[0], left[2] - right[2]) * 1_000) /
    1_000
  );
}

function facingTargetErrorDegrees(
  position: [number, number, number] | null,
  target: [number, number, number] | null,
  quaternion: [number, number, number, number] | null,
): number | null {
  if (!position || !target || !quaternion) return null;
  const targetX = target[0] - position[0];
  const targetZ = target[2] - position[2];
  const targetLength = Math.hypot(targetX, targetZ);
  const quaternionLength = Math.hypot(...quaternion);
  if (targetLength < 0.001 || quaternionLength < 0.001) return null;

  const [rawX, rawY, rawZ, rawW] = quaternion;
  const x = rawX / quaternionLength;
  const y = rawY / quaternionLength;
  const z = rawZ / quaternionLength;
  const w = rawW / quaternionLength;
  // Registered avatars face local -Z. Rotate that forward vector by the
  // rendered quaternion and compare its XZ projection with the opponent.
  const forwardX = -2 * (x * z + w * y);
  const forwardZ = -1 + 2 * (x * x + y * y);
  const forwardLength = Math.hypot(forwardX, forwardZ);
  if (forwardLength < 0.001) return null;
  const dot = Math.max(
    -1,
    Math.min(
      1,
      (forwardX * targetX + forwardZ * targetZ) /
        (forwardLength * targetLength),
    ),
  );
  return Math.round((Math.acos(dot) * 180 * 1_000) / Math.PI) / 1_000;
}

function cameraTargetId(target: unknown): string | null {
  if (!target || typeof target !== "object") return null;
  return entityIdentity(target as EntityLike);
}

function isAgentEntity(entity: EntityLike): boolean {
  return Boolean(
    entity.isAgent ||
    entity.isEmbeddedAgent ||
    entity.data?.isAgent ||
    entity.data?.isEmbeddedAgent,
  );
}

function hasProductionAvatar(entity: EntityLike): boolean {
  return Boolean(entity.avatar?.instance?.raw?.scene);
}

function isLoadedProductionAgent(entity: EntityLike): boolean {
  return Boolean(
    isAgentEntity(entity) &&
    hasProductionAvatar(entity) &&
    entity.active !== false &&
    !entity.destroyed,
  );
}

function isVisibleProductionAgent(entity: EntityLike): boolean {
  const avatarScene = entity.avatar?.instance?.raw?.scene;
  return Boolean(
    isLoadedProductionAgent(entity) &&
    avatarScene &&
    entity.node?.visible !== false &&
    entity.base?.visible !== false &&
    avatarScene.visible !== false,
  );
}

function countProductionAgents(
  world: StreamingDiagnosticsWorld,
  predicate: (entity: EntityLike) => boolean,
): number {
  const identities = new Set<string>();
  let count = 0;
  for (const collection of [world.entities?.players, world.entities?.items]) {
    if (!collection) continue;
    for (const candidate of collection.values()) {
      if (!candidate || typeof candidate !== "object") continue;
      const entity = candidate as EntityLike;
      const identity = entityIdentity(entity);
      if (!identity || identities.has(identity) || !predicate(entity)) {
        continue;
      }
      identities.add(identity);
      count++;
    }
  }
  return count;
}

export function collectStreamingSceneDiagnostics(
  world: StreamingDiagnosticsWorld,
  state: DiagnosticsState,
  updatedAt: number = Date.now(),
): StreamingSceneDiagnostics | null {
  const cycle = state.cycle;
  if (
    !cycle ||
    typeof cycle.cycleId !== "string" ||
    typeof cycle.phase !== "string"
  ) {
    return null;
  }

  const authoritativePositions = [
    finiteTuple(cycle.arenaPositions?.agent1),
    finiteTuple(cycle.arenaPositions?.agent2),
  ] as const;
  const agentStates = [cycle.agent1, cycle.agent2] as const;
  const agents = agentStates.map((agentState, index) => {
    const id = agentState?.id;
    if (typeof id !== "string" || id.length === 0) return null;
    const entity = resolveEntity(world, id);
    const position = entity ? renderedPosition(entity) : null;
    const renderTuple = vectorTuple(position);
    const avatarScene = entity?.avatar?.instance?.raw?.scene;
    const hitReaction = normalizeHitReactionDiagnostics(
      entity?.avatar?.instance?.getHitReactionDiagnostics?.(),
    );
    const avatarEmote =
      typeof entity?.avatar?.emote === "string"
        ? entity.avatar.emote.split("?", 1)[0].slice(0, 200)
        : null;
    const fallbackAvatar = entity?._fallbackAvatarRoot;
    // A fallback marker keeps the page understandable after an asset failure,
    // but it is not production-quality evidence and must not release capture.
    const avatarReady = Boolean(entity && hasProductionAvatar(entity));
    return {
      id,
      arenaSpawnPosition: authoritativePositions[index],
      simulationPosition: entity
        ? vectorTuple(simulationPosition(world, entity, id))
        : null,
      renderPosition: renderTuple,
      avatarPosition: vectorTuple(entity?.base?.position),
      renderQuaternion:
        quaternionTuple(entity?.base?.quaternion) ??
        quaternionTuple(entity?.node?.quaternion),
      facingTargetErrorDegrees: null,
      avatarReady,
      ndcPosition: projectedPosition(position, world.camera),
      insideCombatArena: Boolean(
        renderTuple &&
        isPositionInsideCombatArena(renderTuple[0], renderTuple[2]),
      ),
      visible: Boolean(
        entity &&
        avatarReady &&
        entity.node?.visible !== false &&
        entity.base?.visible !== false &&
        avatarScene?.visible !== false &&
        fallbackAvatar?.visible !== false,
      ),
      active: Boolean(entity && entity.active !== false && !entity.destroyed),
      ...(hitReaction ? { hitReaction } : {}),
      ...(avatarEmote ? { avatarEmote } : {}),
    };
  }) as StreamingSceneDiagnostics["agents"];

  for (let index = 0; index < agents.length; index += 1) {
    const agent = agents[index];
    const opponent = agents[index === 0 ? 1 : 0];
    if (!agent) continue;
    agent.facingTargetErrorDegrees = facingTargetErrorDegrees(
      agent.renderPosition,
      opponent?.renderPosition ?? null,
      agent.renderQuaternion,
    );
  }

  const cameraSystem = world.getSystem?.("client-camera-system") as
    | { getCameraInfo?: () => { target?: unknown; position?: unknown } }
    | undefined;
  const cameraInfo = cameraSystem?.getCameraInfo?.();
  const arenaVisuals = world.getSystem?.("duel-arena-visuals") as
    { isReady?: () => boolean } | undefined;
  const equipmentVisuals = world.getSystem?.("equipment-visual") as
    | {
        getStreamingDuelBowPresentationDiagnostics?: (
          playerIds: readonly string[],
        ) => StreamingDuelBowPresentationDiagnostics;
      }
    | undefined;
  const projectileRenderer = world.getSystem?.("projectile-renderer") as
    | {
        getStreamingProjectileVisualDiagnostics?: () => StreamingProjectileVisualDiagnostics;
      }
    | undefined;
  const playerIds = agents.flatMap((agent) => (agent ? [agent.id] : []));
  const bowPresentation =
    equipmentVisuals?.getStreamingDuelBowPresentationDiagnostics?.(playerIds) ??
    null;
  const projectilePresentation =
    projectileRenderer?.getStreamingProjectileVisualDiagnostics?.() ?? null;
  const cameraPosition =
    finiteTuple(cameraInfo?.position) ?? vectorTuple(world.camera?.position);
  const fov = world.camera?.fov;
  const aspect = world.camera?.aspect;

  return {
    schemaVersion: 1,
    updatedAt:
      Number.isSafeInteger(updatedAt) && updatedAt >= 0
        ? updatedAt
        : Date.now(),
    cycleId: cycle.cycleId,
    phase: cycle.phase,
    agents,
    arenaSpawnSeparationXZ: distanceXZ(
      authoritativePositions[0],
      authoritativePositions[1],
    ),
    renderedSeparationXZ: distanceXZ(
      agents[0]?.renderPosition ?? null,
      agents[1]?.renderPosition ?? null,
    ),
    arenaVisualsReady: arenaVisuals?.isReady?.() === true,
    camera: {
      position: cameraPosition,
      fov: typeof fov === "number" && Number.isFinite(fov) ? fov : null,
      aspect:
        typeof aspect === "number" && Number.isFinite(aspect) ? aspect : null,
      targetId: cameraTargetId(cameraInfo?.target),
      expectedTargetId:
        typeof state.cameraTarget === "string" ? state.cameraTarget : null,
    },
    ...(bowPresentation || projectilePresentation
      ? {
          combatPresentation: {
            bow: bowPresentation,
            projectiles: projectilePresentation,
          },
        }
      : {}),
  };
}

export function collectStreamingSceneReadinessEvidence(
  world: StreamingDiagnosticsWorld,
  state: DiagnosticsState,
): StreamingSceneReadinessEvidence {
  const diagnostics = collectStreamingSceneDiagnostics(world, state);
  const terrain = world.getSystem?.("terrain") as
    | {
        getStreamingVisualReadiness?: () => {
          ready?: boolean;
          terrain?: unknown;
          grass?: unknown;
        };
      }
    | null
    | undefined;
  const terrainEvidence = terrain?.getStreamingVisualReadiness?.() ?? null;
  const terrainVisualsReady = terrain?.getStreamingVisualReadiness
    ? terrainEvidence?.ready === true
    : true;
  const precompileIdle = world.graphics?.isPrecompileIdle
    ? world.graphics.isPrecompileIdle() === true
    : true;
  const equipmentVisualSystem = world.getSystem?.("equipment-visual") as
    | {
        getStreamingDuelEquipmentVisualReadiness?: () =>
          StreamingDuelEquipmentVisualReadiness | undefined;
      }
    | null
    | undefined;
  const equipmentVisuals =
    equipmentVisualSystem?.getStreamingDuelEquipmentVisualReadiness?.() ?? null;
  const equipmentVisualsReady = equipmentVisuals?.ready === true;

  const expectedAgentCount = [state.cycle?.agent1, state.cycle?.agent2].filter(
    (agent) => typeof agent?.id === "string" && agent.id.length > 0,
  ).length;
  const loadedExpectedAgentCount =
    diagnostics?.agents.filter(
      (agent) => agent?.avatarReady === true && agent.active,
    ).length ?? 0;
  const visibleExpectedAgentCount =
    diagnostics?.agents.filter(
      (agent) => agent?.avatarReady === true && agent.visible && agent.active,
    ).length ?? 0;
  const loadedProductionAgentCount = countProductionAgents(
    world,
    isLoadedProductionAgent,
  );
  const visibleProductionAgentCount = countProductionAgents(
    world,
    isVisibleProductionAgent,
  );
  const phase = state.cycle?.phase ?? null;
  // During maintenance/IDLE, contestants may be deliberately off-camera while
  // they gather, craft, train, or otherwise prepare. Avatar loading itself
  // calls ClientGraphics.precompileObject(), and precompileIdle proves that the
  // hidden production avatars have completed their GPU pipeline compilation.
  // Arena phases remain strict: capture must see every expected contestant.
  const contestantsMustBeVisible = phase !== "IDLE";
  const expectedContestantsReady = contestantsMustBeVisible
    ? visibleExpectedAgentCount === expectedAgentCount
    : loadedExpectedAgentCount === expectedAgentCount;
  const unassignedContestantsReady = contestantsMustBeVisible
    ? visibleProductionAgentCount >= 2
    : loadedProductionAgentCount >= 2;
  const contestantsReady =
    expectedAgentCount === 0
      ? // The launcher seeds contestants while maintenance is active, before a
        // cycle assigns agent1/agent2. Requiring both real avatars here prevents
        // the public HLS encoder from starting just before their large GPU uploads.
        unassignedContestantsReady
      : expectedContestantsReady;

  return {
    ready: Boolean(
      diagnostics?.arenaVisualsReady &&
      terrainVisualsReady &&
      precompileIdle &&
      equipmentVisualsReady &&
      contestantsReady,
    ),
    phase,
    contestantsMustBeVisible,
    arenaVisualsReady: diagnostics?.arenaVisualsReady === true,
    terrainVisualsReady,
    terrain: terrainEvidence?.terrain ?? null,
    grass: terrainEvidence?.grass ?? null,
    precompileIdle,
    equipmentVisualsReady,
    equipmentVisuals,
    expectedAgentCount,
    loadedExpectedAgentCount,
    visibleExpectedAgentCount,
    loadedProductionAgentCount,
    visibleProductionAgentCount,
    agents: diagnostics?.agents ?? [null, null],
  };
}

export function areStreamingSceneAssetsReady(
  world: StreamingDiagnosticsWorld,
  state: DiagnosticsState,
): boolean {
  return collectStreamingSceneReadinessEvidence(world, state).ready;
}

export type StreamingReadinessStability = {
  readySince: number | null;
  consecutiveSamples: number;
  ready: boolean;
};

export type StreamingColdRenderStability = {
  lastSnapshotUpdatedAt: number | null;
  lastFrameSequence: number;
  lastTextureCount: number | null;
  lastGeometryCount: number | null;
  lastAssetResourceEntryCount: number | null;
  lastLongFrameSequence: number;
  lastLongFrameUptimeMs: number | null;
  observationStartedAtUptimeMs: number | null;
  quietSinceUptimeMs: number | null;
  consecutiveSnapshots: number;
  ready: boolean;
};

export type StreamingColdRenderStabilityOptions = {
  sceneAssetsReady?: boolean;
  stableDurationMs?: number;
  minimumSnapshots?: number;
  minimumObservationMs?: number;
};

export function createStreamingColdRenderStability(): StreamingColdRenderStability {
  return {
    lastSnapshotUpdatedAt: null,
    lastFrameSequence: 0,
    lastTextureCount: null,
    lastGeometryCount: null,
    lastAssetResourceEntryCount: null,
    lastLongFrameSequence: 0,
    lastLongFrameUptimeMs: null,
    observationStartedAtUptimeMs: null,
    quietSinceUptimeMs: null,
    consecutiveSnapshots: 0,
    ready: false,
  };
}

/**
 * Keep the initial stream surface behind its branded loading state until the
 * renderer has stopped adding GPU resources and has produced a bounded quiet
 * window after its latest retained long frame. The result latches once ready;
 * ordinary matchup changes continue to use the existing scene/contestant gate.
 */
export function advanceStreamingColdRenderStability(
  previous: StreamingColdRenderStability,
  snapshot: StreamingPerformanceSnapshot | null | undefined,
  options: StreamingColdRenderStabilityOptions = {},
): StreamingColdRenderStability {
  if (previous.ready) return previous;
  const {
    sceneAssetsReady = true,
    stableDurationMs = 2_000,
    minimumSnapshots = 3,
    minimumObservationMs = 10_000,
  } = options;
  // Resource quietness observed while critical scene assets are still loading
  // is not meaningful. Start the window only after the arena, terrain,
  // precompilation, and production contestants are all actually ready.
  if (!sceneAssetsReady) return createStreamingColdRenderStability();
  if (
    !snapshot ||
    snapshot.schemaVersion !== 1 ||
    !Number.isFinite(snapshot.updatedAt) ||
    !Number.isFinite(snapshot.uptimeMs) ||
    snapshot.updatedAt <= (previous.lastSnapshotUpdatedAt ?? -1)
  ) {
    return previous;
  }

  const textureCount = snapshot.overall.renderer.textures.latest;
  const geometryCount = snapshot.overall.renderer.geometries.latest;
  // The betting-readiness endpoint is intentionally polled, so total resource
  // entries never become quiet. Only count media/model assets that can trigger
  // decode, geometry creation, or GPU residency work.
  const assetResourceEntryCount = (
    ["model", "audio", "image", "font", "video"] as const
  ).reduce(
    (total, category) =>
      total + (snapshot.resources?.byCategory?.[category]?.entries ?? 0),
    0,
  );
  const frameSequence = snapshot.overall.frames;
  if (
    !Number.isFinite(textureCount) ||
    !Number.isFinite(geometryCount) ||
    !Number.isFinite(assetResourceEntryCount) ||
    !Number.isFinite(frameSequence)
  ) {
    return previous;
  }

  const lastLongFrame = snapshot.longFrames.at(-1) ?? null;
  const lastLongFrameSequence = lastLongFrame?.frameSequence ?? 0;
  const lastLongFrameUptimeMs = lastLongFrame?.uptimeMs ?? null;
  const firstSnapshot = previous.lastSnapshotUpdatedAt === null;
  const resourcesChanged =
    previous.lastTextureCount !== null &&
    previous.lastGeometryCount !== null &&
    previous.lastAssetResourceEntryCount !== null &&
    (textureCount !== previous.lastTextureCount ||
      geometryCount !== previous.lastGeometryCount ||
      assetResourceEntryCount !== previous.lastAssetResourceEntryCount);
  const observedNewLongFrame =
    lastLongFrameSequence > previous.lastLongFrameSequence;
  const quietWindowReset =
    firstSnapshot || resourcesChanged || observedNewLongFrame;
  const quietSinceUptimeMs = quietWindowReset
    ? Math.max(snapshot.uptimeMs, lastLongFrameUptimeMs ?? 0)
    : (previous.quietSinceUptimeMs ?? snapshot.uptimeMs);
  const consecutiveSnapshots = quietWindowReset
    ? 1
    : previous.consecutiveSnapshots + 1;
  const observationStartedAtUptimeMs =
    previous.observationStartedAtUptimeMs ?? snapshot.uptimeMs;
  const longFrameQuietMs =
    lastLongFrameUptimeMs === null
      ? Number.POSITIVE_INFINITY
      : snapshot.uptimeMs - lastLongFrameUptimeMs;
  const ready =
    consecutiveSnapshots >= minimumSnapshots &&
    snapshot.uptimeMs - observationStartedAtUptimeMs >= minimumObservationMs &&
    snapshot.uptimeMs - quietSinceUptimeMs >= stableDurationMs &&
    longFrameQuietMs >= stableDurationMs;

  return {
    lastSnapshotUpdatedAt: snapshot.updatedAt,
    lastFrameSequence: frameSequence,
    lastTextureCount: textureCount,
    lastGeometryCount: geometryCount,
    lastAssetResourceEntryCount: assetResourceEntryCount,
    lastLongFrameSequence,
    lastLongFrameUptimeMs,
    observationStartedAtUptimeMs,
    quietSinceUptimeMs,
    consecutiveSnapshots,
    ready,
  };
}

export function advanceStreamingReadinessStability(
  previous: StreamingReadinessStability,
  rawReady: boolean,
  nowMs: number,
  stableDurationMs = 1_000,
  minimumSamples = 5,
): StreamingReadinessStability {
  if (!rawReady || !Number.isFinite(nowMs)) {
    return { readySince: null, consecutiveSamples: 0, ready: false };
  }
  const readySince = previous.readySince ?? nowMs;
  const consecutiveSamples = previous.consecutiveSamples + 1;
  return {
    readySince,
    consecutiveSamples,
    ready:
      consecutiveSamples >= minimumSamples &&
      nowMs - readySince >= stableDurationMs,
  };
}
