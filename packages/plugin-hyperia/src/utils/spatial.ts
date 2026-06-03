import type { Entity } from "../types.js";

type Position = [number, number, number] | null | undefined;

export function getDistance2D(posA: Position, posB: Position): number | null {
  if (!posA || !posB) return null;
  const dx = posA[0] - posB[0];
  const dz = posA[2] - posB[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export function getDistance3D(posA: Position, posB: Position): number | null {
  if (!posA || !posB) return null;
  const dx = posA[0] - posB[0];
  const dy = posA[1] - posB[1];
  const dz = posA[2] - posB[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function findNearestEntity(
  entities: Entity[],
  playerPos: [number, number, number],
  filter: (e: Entity) => boolean,
): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (const entity of entities) {
    if (!filter(entity)) continue;
    const dist = getDistance2D(playerPos, entity.position);
    if (dist !== null && dist < nearestDist) {
      nearest = entity;
      nearestDist = dist;
    }
  }

  return nearest;
}

export function matchesEntityType(entity: Entity, typeName: string): boolean {
  const type = (entity.type || "").toLowerCase();
  const entityType = (entity.entityType || "").toLowerCase();
  const name = (entity.name || "").toLowerCase();
  return (
    type === typeName || entityType === typeName || name.includes(typeName)
  );
}
