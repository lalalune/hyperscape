/**
 * Streaming spectator readiness helpers.
 *
 * Shared across StreamingMode (the full-screen capture page) and
 * EmbeddedGameClient (the embedded spectator viewport). Extracted to collapse
 * two near-duplicate copies of the same lookup and readiness logic into a
 * single source of truth.
 *
 * These helpers intentionally type the entity shape loosely (`EntityCandidate`)
 * because the readiness-relevant fields (`avatar`, `_avatar`,
 * `_fallbackAvatarRoot`, `mesh`) are not part of the public Entity interface.
 */

import type { Entity, World } from "@hyperscape/shared";

type EntityCandidate = {
  id?: string;
  characterId?: string;
  data?: { id?: string; characterId?: string };
  avatar?: unknown;
  _avatar?: unknown;
  _fallbackAvatarRoot?: unknown;
  mesh?: unknown;
};

function matchesTargetId(
  candidate: EntityCandidate,
  targetEntityId: string,
): boolean {
  return (
    candidate.id === targetEntityId ||
    candidate.characterId === targetEntityId ||
    candidate.data?.id === targetEntityId ||
    candidate.data?.characterId === targetEntityId
  );
}

/**
 * Resolve the entity backing a spectator camera target. Tries the world's
 * direct id index first, then walks both the `items` and `players`
 * collections, matching by direct map key, id, characterId, data.id, or
 * data.characterId — covering every observed entity-id shape.
 *
 * The previous implementations split coverage between the two collections
 * (StreamingMode only direct-keyed items; EmbeddedGameClient walked items
 * fully but duplicated the players logic). This unified lookup is a strict
 * superset: any entity previously findable remains findable, plus namespaced
 * items-side keys and characterId aliases are now resolvable from either
 * collection.
 */
export function findStreamingTargetEntity(
  world: World,
  targetEntityId: string,
): Entity | null {
  const entities = world.entities;
  if (!entities) return null;

  const direct = (entities.get?.(targetEntityId) ?? null) as Entity | null;
  if (direct) return direct;

  if (entities.items) {
    for (const [key, item] of entities.items) {
      if (
        key === targetEntityId ||
        matchesTargetId(item as EntityCandidate, targetEntityId)
      ) {
        return item as Entity;
      }
    }
  }

  if (entities.players) {
    for (const [key, player] of entities.players) {
      if (
        key === targetEntityId ||
        matchesTargetId(player as EntityCandidate, targetEntityId)
      ) {
        return player as Entity;
      }
    }
  }

  return null;
}

/**
 * Returns true when the spectator camera target has any avatar-backing field
 * populated — a loaded VRM avatar, a second-phase avatar handle, a fallback
 * avatar root, or a mesh.
 *
 * Delegates lookup to `findStreamingTargetEntity` so both the `items` and
 * `players` collections are inspected. Previously this check only walked
 * `world.entities.players`, which silently masked player entities that the
 * snapshot pipeline routed exclusively through `items` (for example combat
 * agents arriving via a spectator snapshot whose entity-manager wiring
 * inserts them under a namespaced key on the items map). Commit 33dab353f
 * ("Keep stream readiness source-of-truth strict") removed the grace-expiry
 * escape hatch that had been masking this gap, so the capture page now sits
 * in degraded state indefinitely when the target entity is only in items.
 */
export function isTargetAvatarReady(
  world: World,
  targetEntityId: string,
): boolean {
  const entity = findStreamingTargetEntity(
    world,
    targetEntityId,
  ) as EntityCandidate | null;
  if (!entity) return false;
  return Boolean(
    entity.avatar ||
    entity._avatar ||
    entity._fallbackAvatarRoot ||
    entity.mesh,
  );
}
