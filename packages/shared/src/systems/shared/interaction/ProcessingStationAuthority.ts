import type { World } from "../../../types/index";

export type ProcessingStationType = "anvil" | "furnace";

interface PositionLike {
  x: number;
  y: number;
  z: number;
}

interface PlayerLike {
  position?: unknown;
  node?: { position?: unknown };
  getPosition?: () => unknown;
  data?: { inStreamingDuel?: unknown };
}

interface StationLike {
  entityType?: unknown;
  canInteract?: (playerId: string, position: PositionLike) => boolean;
}

function getFinitePosition(entity: unknown): PositionLike | null {
  if (!entity || typeof entity !== "object") return null;
  const candidate = entity as PlayerLike;
  let raw = candidate.position ?? candidate.node?.position;
  if (!raw && typeof candidate.getPosition === "function") {
    try {
      raw = candidate.getPosition();
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const position = raw as Partial<PositionLike>;
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    return null;
  }
  return {
    x: position.x as number,
    y: position.y as number,
    z: position.z as number,
  };
}

/** Fail-closed preparation-action eligibility shared by processing systems. */
export function canPlayerPerformPreparationAction(
  world: World,
  playerId: string,
): boolean {
  if (typeof playerId !== "string" || !playerId) return false;
  const player = world.getPlayer(playerId) ?? world.entities.get(playerId);
  if (!player || !getFinitePosition(player)) return false;
  if ((player as PlayerLike).data?.inStreamingDuel === true) return false;

  const duel = world.getSystem("duel") as
    { isPlayerInDuel?: (id: string) => boolean } | undefined;
  try {
    return duel?.isPlayerInDuel?.(playerId) !== true;
  } catch {
    return false;
  }
}

/**
 * Resolve one exact, server-owned workstation and apply its own footprint-aware
 * interaction range. Client-supplied positions and display names are ignored.
 */
export function canPlayerUseProcessingStation(
  world: World,
  playerId: string,
  stationId: string,
  expectedType: ProcessingStationType,
): boolean {
  if (
    typeof stationId !== "string" ||
    !stationId ||
    !canPlayerPerformPreparationAction(world, playerId)
  ) {
    return false;
  }

  const player = world.getPlayer(playerId) ?? world.entities.get(playerId);
  const station = world.entities.get(stationId) as unknown as
    StationLike | undefined;
  const position = getFinitePosition(player);
  if (
    !station ||
    station.entityType !== expectedType ||
    typeof station.canInteract !== "function" ||
    !position
  ) {
    return false;
  }

  try {
    return station.canInteract(playerId, position) === true;
  } catch {
    return false;
  }
}
