import {
  DeathState,
  EventType,
  isPositionInsideCombatArena,
  type World,
} from "@hyperforge/shared";
import { getStreamingDuelScheduler } from "../systems/StreamingDuelScheduler/index.js";

type AgentLikeEntity = {
  data: {
    position?:
      | [number, number, number]
      | { x?: number; y?: number; z?: number };
    health?: number;
    maxHealth?: number;
    skills?: { constitution?: { level?: number } };
    inCombat?: boolean;
    combatTarget?: string | null;
    attackTarget?: string | null;
    inStreamingDuel?: boolean;
    preventRespawn?: boolean;
    deathState?: DeathState;
    respawnTick?: number;
    isDead?: boolean;
    e?: string;
    _teleport?: boolean;
    visible?: boolean;
    alive?: boolean;
  };
  emote?: string;
  markNetworkDirty?: () => void;
};

function getGroundedY(
  world: World,
  x: number,
  z: number,
  fallbackY: number,
): number {
  const terrain = world.getSystem("terrain") as {
    getHeightAt?: (x: number, z: number) => number;
  } | null;

  const sampledY = terrain?.getHeightAt?.(x, z);
  return typeof sampledY === "number" && Number.isFinite(sampledY)
    ? sampledY + 0.1
    : fallbackY;
}

// Exported for streamingDuelEligibilityDb's dynamic import — the
// arena-ejection guard reuses the same logic to avoid kicking
// out a currently-dueling agent. Was internal-only before; the
// dynamic-import call site at streamingDuelEligibilityDb:158
// failed to destructure it.
export function isActiveStreamingDuelContestant(playerId: string): boolean {
  const scheduler = getStreamingDuelScheduler();
  const cycle = scheduler?.getCurrentCycle();
  if (!cycle?.agent1 || !cycle.agent2) {
    return false;
  }

  if (
    cycle.phase !== "ANNOUNCEMENT" &&
    cycle.phase !== "COUNTDOWN" &&
    cycle.phase !== "FIGHTING" &&
    cycle.phase !== "RESOLUTION"
  ) {
    return false;
  }

  return (
    cycle.agent1.characterId === playerId ||
    cycle.agent2.characterId === playerId
  );
}

function isEntityDead(entity: AgentLikeEntity): boolean {
  const data = entity.data;
  return (
    (typeof data.health === "number" && data.health <= 0) ||
    data.isDead === true ||
    data.deathState === DeathState.DYING ||
    data.deathState === DeathState.DEAD
  );
}

function normalizePosition(
  position: AgentLikeEntity["data"]["position"],
): [number, number, number] | null {
  if (Array.isArray(position) && position.length >= 3) {
    const [x, y, z] = position;
    if (Number.isFinite(x) && Number.isFinite(z)) {
      return [x, Number(y ?? 0), z];
    }
  }

  if (position && typeof position === "object") {
    const data = position as { x?: number; y?: number; z?: number };
    if (Number.isFinite(data.x) && Number.isFinite(data.z)) {
      return [data.x as number, Number(data.y ?? 0), data.z as number];
    }
  }

  return null;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getSafeArenaEgressPosition(
  world: World,
  playerId: string,
): { x: number; y: number; z: number } {
  // Send ejected agents to the starter area center instead of near the arena
  // lobby, which was causing re-entry loops (agent walks right back in).
  const seed = hashSeed(playerId);
  const angle = ((seed % 360) * Math.PI) / 180;
  const radius = 3 + (seed % 5);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  return {
    x,
    y: getGroundedY(world, x, z, 0.42),
    z,
  };
}

/**
 * Recover an agent that is stuck in dead/dying state outside active streaming duel ownership.
 */
export function recoverAgentFromDeathLoop(
  world: World,
  playerId: string,
  source: string,
): boolean {
  const entity = world.entities.get(playerId) as AgentLikeEntity | undefined;
  if (!entity) {
    return false;
  }

  const inStreamingDuel =
    entity.data.inStreamingDuel === true || entity.data.preventRespawn === true;
  const activeDuelContestant = isActiveStreamingDuelContestant(playerId);

  // Never override duel-owned death handling while an active streaming duel
  // is running. Check contestant status alone (not just inStreamingDuel flag)
  // because during ANNOUNCEMENT phase the flag may not be set yet.
  if (activeDuelContestant) {
    return false;
  }

  // Clear stale duel flags left behind by interrupted duel flows.
  if (inStreamingDuel && !activeDuelContestant) {
    entity.data.inStreamingDuel = false;
    entity.data.preventRespawn = false;
  }

  if (!isEntityDead(entity)) {
    return false;
  }

  // Send recovered agents to the starter area center, NOT the duel arena lobby.
  // The lobby is adjacent to arenas — agents walk right back in and get ejected again.
  const spawnPosition = getSafeArenaEgressPosition(world, playerId);

  const constitutionLevel = entity.data.skills?.constitution?.level;
  const restoredMaxHealth =
    typeof entity.data.maxHealth === "number" && entity.data.maxHealth > 0
      ? entity.data.maxHealth
      : typeof constitutionLevel === "number" && constitutionLevel > 0
        ? constitutionLevel
        : 10;

  entity.data.health = restoredMaxHealth;
  entity.data.maxHealth = restoredMaxHealth;
  entity.data.position = [spawnPosition.x, spawnPosition.y, spawnPosition.z];
  entity.data.inCombat = false;
  entity.data.combatTarget = null;
  entity.data.attackTarget = null;
  entity.data.deathState = DeathState.ALIVE;
  entity.data.respawnTick = undefined;
  entity.data.isDead = false;
  entity.data.e = undefined;
  entity.data._teleport = true;
  entity.data.visible = true;
  entity.data.alive = true;
  if ("emote" in entity) {
    entity.emote = undefined;
  }
  entity.markNetworkDirty?.();

  world.emit("player:teleport", {
    playerId,
    position: spawnPosition,
    rotation: 0,
  });

  world.emit(EventType.ENTITY_MODIFIED, {
    id: playerId,
    changes: {
      position: [spawnPosition.x, spawnPosition.y, spawnPosition.z],
      health: restoredMaxHealth,
      maxHealth: restoredMaxHealth,
      inCombat: false,
      combatTarget: null,
      attackTarget: null,
      deathState: DeathState.ALIVE,
      isDead: false,
      inStreamingDuel: false,
      preventRespawn: false,
      _teleport: true,
      e: undefined,
    },
  });

  world.emit(EventType.PLAYER_SET_DEAD, {
    playerId,
    isDead: false,
  });

  world.emit(EventType.PLAYER_RESPAWNED, {
    playerId,
    spawnPosition,
    townName: "Duel Arena Lobby",
  });

  console.warn(
    `[${source}] Recovered agent ${playerId} from dead-loop state → (${spawnPosition.x.toFixed(1)}, ${spawnPosition.z.toFixed(1)})`,
  );
  return true;
}

/**
 * Teleport a non-dueling agent out of combat arenas.
 */
export function ejectAgentFromCombatArena(
  world: World,
  playerId: string,
  source: string,
): boolean {
  const entity = world.entities.get(playerId) as AgentLikeEntity | undefined;
  if (!entity) {
    return false;
  }

  const activeDuelContestant = isActiveStreamingDuelContestant(playerId);
  if (activeDuelContestant) {
    return false;
  }

  const inStreamingDuel =
    entity.data.inStreamingDuel === true || entity.data.preventRespawn === true;
  if (inStreamingDuel) {
    entity.data.inStreamingDuel = false;
    entity.data.preventRespawn = false;
  }

  const currentPosition = normalizePosition(entity.data.position);
  if (!currentPosition) {
    return false;
  }

  const [x, , z] = currentPosition;
  if (!isPositionInsideCombatArena(x, z)) {
    return false;
  }

  const egress = getSafeArenaEgressPosition(world, playerId);
  const position: [number, number, number] = [egress.x, egress.y, egress.z];
  entity.data.position = position;
  entity.data.inCombat = false;
  entity.data.combatTarget = null;
  entity.data.attackTarget = null;
  entity.data.inStreamingDuel = false;
  entity.data.preventRespawn = false;
  entity.data._teleport = true;
  entity.markNetworkDirty?.();

  world.emit("player:teleport", {
    playerId,
    position: egress,
    rotation: 0,
    suppressEffect: true,
  });

  world.emit(EventType.ENTITY_MODIFIED, {
    id: playerId,
    changes: {
      position,
      inCombat: false,
      combatTarget: null,
      attackTarget: null,
      inStreamingDuel: false,
      preventRespawn: false,
      _teleport: true,
    },
  });

  console.warn(
    `[${source}] Teleported non-dueling agent ${playerId} out of duel arena → (${egress.x.toFixed(1)}, ${egress.z.toFixed(1)})`,
  );
  return true;
}
