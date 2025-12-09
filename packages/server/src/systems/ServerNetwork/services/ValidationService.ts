/**
 * Transaction Validation Service
 *
 * SRP: Only validates if transactions are allowed.
 * DIP: Depends on ISessionReader abstraction, not concrete SessionManager.
 * ISP: Only needs ISessionReader, not full ISessionManager.
 *
 * Validates:
 * 1. Session exists for player
 * 2. Session type matches required type (store/bank/dialogue)
 * 3. Player is within Chebyshev distance of target NPC
 */

import {
  SessionType,
  INTERACTION_DISTANCE,
  chebyshevDistance,
  type ISessionReader,
  type ITransactionValidator,
  type ValidationResult,
  type Position2D,
} from "@hyperscape/shared";

/** Entity lookup function type */
type EntityLookup = (entityId: string) => { position?: Position2D } | undefined;
type PlayerLookup = (playerId: string) => { position?: Position2D } | undefined;

export class ValidationService implements ITransactionValidator {
  constructor(
    private readonly sessions: ISessionReader,
    private readonly getEntity: EntityLookup,
    private readonly getPlayer: PlayerLookup,
  ) {}

  validate(playerId: string, requiredType: SessionType): ValidationResult {
    // 1. Check session exists
    const session = this.sessions.getSession(playerId);
    if (!session) {
      return { allowed: false, error: "No active session" };
    }

    // 2. Check session type matches
    if (session.sessionType !== requiredType) {
      return {
        allowed: false,
        error: `Expected ${requiredType} session, got ${session.sessionType}`,
      };
    }

    // 3. Get player position
    const player = this.getPlayer(playerId);
    if (!player?.position) {
      return { allowed: false, error: "Cannot verify player position" };
    }

    // 4. Get target entity position
    const target = this.getEntity(session.targetEntityId);
    if (!target?.position) {
      return { allowed: false, error: "Target no longer exists" };
    }

    // 5. Check distance (Chebyshev/OSRS-style)
    const distance = chebyshevDistance(player.position, target.position);
    const maxDistance = INTERACTION_DISTANCE[requiredType];

    if (distance > maxDistance) {
      return { allowed: false, error: "Too far away" };
    }

    return { allowed: true };
  }
}
