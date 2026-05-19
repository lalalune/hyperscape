/**
 * DuelSystem duck-type interface — relocated from
 * `@hyperforge/shared/types/systems/system-interfaces` 2026-04-27
 * (top-10 #8 cleanup, slice 29). Lives with the implementation
 * (plugin's DuelSystem class) so the duck-type contract is
 * co-located with what satisfies it.
 *
 * The data types this interface references (DuelRules, DuelState,
 * EquipmentRestrictions, EquipmentSlotRestriction, PendingDuelChallenge,
 * StakedItem) stay in `@hyperforge/shared/types/game/duel-types` —
 * they're true bidirectional contracts, used in 24 places across
 * `event-payloads.ts` for the engine event-bus. Migrating those
 * would require duplicating each as a duck-type and yields no net
 * code reduction.
 *
 * Mirrors slice 21 (TradingSystem interface relocation): the
 * concrete plugin class is a plain class (not a `System` subclass),
 * so this interface is a structural duck-type contract — no
 * `extends System`. Shared code that resolves it via
 * `world.duelSystem` only ever calls these methods.
 */

import type {
  DuelRules,
  DuelState,
  EquipmentSlotRestriction,
  PendingDuelChallenge,
  StakedItem,
} from "@hyperforge/shared";

/** Duel system operation result type. */
export interface DuelOperationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Server-side duel session info returned by DuelSystem query methods.
 * Provides the common fields that callers need without exposing
 * internal implementation details.
 */
export interface DuelSessionInfo {
  duelId: string;
  state: DuelState;
  challengerId: string;
  challengerName: string;
  targetId: string;
  targetName: string;
  rules: DuelRules;
  // Equipment restriction toggles per slot (helmet, body, etc.).
  // Plugin's concrete `EquipmentRestrictions` type structurally
  // satisfies this — handlers only read the boolean values.
  equipmentRestrictions: Record<string, boolean>;
  challengerStakes: StakedItem[];
  targetStakes: StakedItem[];
  challengerAccepted: boolean;
  targetAccepted: boolean;
  arenaId: number | null;
  createdAt: number;
  countdownStartedAt?: number;
  fightStartedAt?: number;
  finishedAt?: number;
  winnerId?: string;
}

/**
 * DuelSystem - server-authoritative player-to-player dueling
 * (tile-based-MMORPG-accurate).
 *
 * Manages duel sessions with rules negotiation, stakes, and combat
 * enforcement.
 *
 * Duel Flow:
 *  1. Player A challenges Player B (in Duel Arena zone)
 *  2. Player B accepts/declines challenge
 *  3. Rules screen: Both players toggle rules and accept
 *  4. Stakes screen: Both players stake items/gold and accept
 *  5. Confirmation screen: Read-only review, both accept
 *  6. Teleport to arena with countdown
 *  7. Combat with rule enforcement
 *  8. Winner receives stakes, loser respawns at lobby
 */
export interface DuelSystem {
  // Tick processing (called by GameTickProcessor)
  processTick(): void;

  // Challenge Flow
  createChallenge(
    challengerId: string,
    challengerName: string,
    challengerSocketId: string,
    challengerCombatLevel: number,
    targetId: string,
    targetName: string,
  ): DuelOperationResult & { challengeId?: string };

  // Pending duels manager — handlers walk this to lookup / cancel
  // challenges. Plugin's concrete class exposes a `PendingDuelManager`.
  pendingDuels: {
    getChallenge(challengeId: string): PendingDuelChallenge | undefined;
    cancelChallenge(challengeId: string): PendingDuelChallenge | undefined;
  };

  respondToChallenge(
    challengeId: string,
    responderId: string,
    accept: boolean,
  ): DuelOperationResult & { duelId?: string };

  // Session Management
  getDuelSession(duelId: string): DuelSessionInfo | undefined;
  getPlayerDuel(playerId: string): DuelSessionInfo | undefined;
  getPlayerDuelId(playerId: string): string | undefined;
  isPlayerInDuel(playerId: string): boolean;
  cancelDuel(
    duelId: string,
    reason: string,
    cancelledBy?: string,
  ): DuelOperationResult;

  // Rules
  toggleRule(
    duelId: string,
    playerId: string,
    rule: keyof DuelRules,
  ): DuelOperationResult;
  toggleEquipmentRestriction(
    duelId: string,
    playerId: string,
    slot: EquipmentSlotRestriction,
  ): DuelOperationResult;
  acceptRules(duelId: string, playerId: string): DuelOperationResult;

  // Stakes
  // Value is computed server-side inside the impl via
  // `getItem(itemId).value * quantity` — callers must NOT pass
  // a value (the parameter was removed to prevent client-trusted
  // pricing). Interface previously listed it; was stale.
  addStake(
    duelId: string,
    playerId: string,
    inventorySlot: number,
    itemId: string,
    quantity: number,
  ): DuelOperationResult;
  removeStake(
    duelId: string,
    playerId: string,
    stakeIndex: number,
  ): DuelOperationResult;
  acceptStakes(duelId: string, playerId: string): DuelOperationResult;

  // Confirmation & Combat
  acceptFinal(
    duelId: string,
    playerId: string,
  ): DuelOperationResult & { arenaId?: number };
  forfeitDuel(playerId: string): DuelOperationResult;

  // Rule Queries (for CombatSystem integration)
  isPlayerInActiveDuel(playerId: string): boolean;
  getPlayerDuelRules(playerId: string): DuelRules | null;
  canMove(playerId: string): boolean;
  canForfeit(playerId: string): boolean;
  canUseRanged(playerId: string): boolean;
  canUseMelee(playerId: string): boolean;
  canUseMagic(playerId: string): boolean;
  canUseSpecialAttack(playerId: string): boolean;
  canUsePrayer(playerId: string): boolean;
  canUsePotions(playerId: string): boolean;
  canEatFood(playerId: string): boolean;
  getDuelOpponentId(playerId: string): string | null;

  // Arena Management
  reserveArena(duelId: string): number | null;
  releaseArena(arenaId: number): void;
  getArenaSpawnPoints(
    arenaId: number,
  ):
    | [{ x: number; y: number; z: number }, { x: number; y: number; z: number }]
    | undefined;
  getArenaBounds(arenaId: number):
    | {
        min: { x: number; z: number };
        max: { x: number; z: number };
      }
    | undefined;

  // Disconnect Handling
  onPlayerDisconnect(playerId: string): void;
  onPlayerReconnect(playerId: string): void;
}
