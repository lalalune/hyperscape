/**
 * Dashboard `agent_mappings.streaming_duel_eligible` lookup shared by
 * StreamingDuelScheduler and EmbeddedHyperiaService so spawn + matchmaking
 * stay consistent.
 */
import {
  EventType,
  isPositionInsideDuelArenaZone,
  type World,
} from "@hyperforge/shared";
import { errMsg } from "../shared/errMsg.js";

/**
 * Whether this agent may use the **duel lobby ring** as their EmbeddedHyperia
 * spawn / fast DB-skip path.
 *
 * Stricter than matchmaking: without a DB we cannot read the dashboard toggle, so
 * we **do not** default to lobby (that stranded everyone at the arena in local dev).
 * Set `STREAMING_AGENT_FORCE_DUEL_LOBBY_SPAWN=true` to restore old behavior.
 *
 * Requires an `agent_mappings` row with `streaming_duel_eligible = true`.
 */
export async function isAgentDuelLobbySpawnAllowedFromDb(
  world: World,
  characterOrAgentId: string,
): Promise<boolean> {
  if (process.env.STREAMING_AGENT_FORCE_DUEL_LOBBY_SPAWN === "true") {
    return true;
  }

  const databaseSystem = world.getSystem("database") as {
    getDb?: () => import("drizzle-orm/node-postgres").NodePgDatabase | null;
  } | null;

  const db = databaseSystem?.getDb?.() ?? null;
  if (!db) {
    return false;
  }

  try {
    const { agentMappings } = await import("../database/schema.js");
    const { eq, or } = await import("drizzle-orm");
    const rows = await db
      .select({ eligible: agentMappings.streamingDuelEnabled })
      .from(agentMappings)
      .where(
        or(
          eq(agentMappings.characterId, characterOrAgentId),
          eq(agentMappings.agentId, characterOrAgentId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return false;
    }
    return rows[0].eligible === true;
  } catch (err) {
    console.warn(
      `[streamingDuelEligibilityDb] duel lobby spawn lookup failed for ${characterOrAgentId}: ${errMsg(err)}`,
    );
    return false;
  }
}

/**
 * When no mapping row exists or DB is unavailable, agents remain eligible
 * (same default as StreamingDuelScheduler).
 */
export async function isAgentStreamingDuelEligibleFromDb(
  world: World,
  characterOrAgentId: string,
): Promise<boolean> {
  const databaseSystem = world.getSystem("database") as {
    getDb?: () => import("drizzle-orm/node-postgres").NodePgDatabase | null;
  } | null;

  const db = databaseSystem?.getDb?.() ?? null;
  if (!db) {
    return true;
  }

  try {
    const { agentMappings } = await import("../database/schema.js");
    const { eq, or } = await import("drizzle-orm");
    const rows = await db
      .select({ eligible: agentMappings.streamingDuelEnabled })
      .from(agentMappings)
      .where(
        or(
          eq(agentMappings.characterId, characterOrAgentId),
          eq(agentMappings.agentId, characterOrAgentId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return true;
    }
    return rows[0].eligible !== false;
  } catch (err) {
    console.warn(
      `[streamingDuelEligibilityDb] lookup failed for ${characterOrAgentId}, defaulting eligible: ${errMsg(err)}`,
    );
    return true;
  }
}

type EntityLike = {
  data: Record<string, unknown>;
  markNetworkDirty?: () => void;
  position?: { x: number; y: number; z: number };
};

function readEntityXZ(entity: EntityLike): { x: number; z: number } | null {
  const data = entity.data;
  const raw = data.position;
  if (Array.isArray(raw) && raw.length >= 3) {
    const x = raw[0];
    const z = raw[2];
    if (typeof x === "number" && typeof z === "number") {
      return { x, z };
    }
  }
  if (raw && typeof raw === "object") {
    const o = raw as { x?: number; z?: number };
    if (typeof o.x === "number" && typeof o.z === "number") {
      return { x: o.x, z: o.z };
    }
  }
  if (entity.position && typeof entity.position.x === "number") {
    return { x: entity.position.x, z: entity.position.z };
  }
  return null;
}

/**
 * If this streaming agent is opted out of duel-lobby spawn but still inside the
 * duel world zone (lobby/arenas), snap them to the world's default spawn.
 * Returns true when a relocation was applied.
 */
export async function relocateStreamingAgentOutOfDuelHubIfOptedOut(
  world: World,
  playerId: string,
): Promise<boolean> {
  if (!playerId.startsWith("agent-")) {
    return false;
  }
  if (process.env.STREAMING_DUEL_ENABLED === "false") {
    return false;
  }

  const allowLobby = await isAgentDuelLobbySpawnAllowedFromDb(world, playerId);
  if (allowLobby) {
    return false;
  }

  const { isActiveStreamingDuelContestant } =
    await import("../eliza/agentRecovery.js");
  if (isActiveStreamingDuelContestant(playerId)) {
    return false;
  }

  const entity = world.entities.get(playerId) as EntityLike | undefined;
  if (!entity) {
    return false;
  }

  const xz = readEntityXZ(entity);
  if (!xz) {
    return false;
  }

  if (!isPositionInsideDuelArenaZone(xz.x, xz.z)) {
    return false;
  }

  const network = world.getSystem("network") as {
    spawn?: { position: [number, number, number] };
  } | null;
  const sp = network?.spawn?.position;
  if (!sp || sp.length < 3) {
    return false;
  }

  let tx = sp[0];
  let ty = sp[1];
  let tz = sp[2];

  const terrain = world.getSystem("terrain") as {
    getHeightAt?: (x: number, z: number) => number;
  } | null;
  const gy = terrain?.getHeightAt?.(tx, tz);
  if (typeof gy === "number" && Number.isFinite(gy)) {
    ty = gy + 0.1;
  }

  const position: [number, number, number] = [tx, ty, tz];
  entity.data.position = position;
  entity.data._teleport = true;
  entity.markNetworkDirty?.();

  world.emit("player:teleport", {
    playerId,
    position: { x: tx, y: ty, z: tz },
    rotation: 0,
  });

  world.emit(EventType.ENTITY_MODIFIED, {
    id: playerId,
    changes: {
      position,
      _teleport: true,
    },
  });

  console.warn(
    `[streamingDuelEligibilityDb] Relocated opted-out agent ${playerId} from duel hub to world spawn`,
  );
  return true;
}
