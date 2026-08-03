/**
 * Duel Arena Types
 *
 * Type definitions for player-to-player dueling system.
 * Follows classic MMORPG-style duel arena mechanics with stakes.
 *
 * Duel Flow:
 * 1. Player A challenges Player B (duelChallenge)
 * 2. Player B receives challenge modal (duelChallengeReceived)
 * 3. Player B accepts/declines (duelChallengeRespond)
 * 4. If accepted, both enter Rules screen (duelSessionStarted)
 * 5. Players toggle rules & equipment restrictions
 * 6. Both accept rules -> move to Stakes screen
 * 7. Players add/remove stake items
 * 8. Both accept stakes -> move to Confirmation screen
 * 9. Both confirm -> Countdown begins
 * 10. Combat until death or forfeit
 * 11. Winner receives all stakes (duelFinished)
 *
 * @see packages/server/src/systems/DuelSystem for server implementation
 * @see packages/client/src/game/panels/DuelPanel for UI implementation
 */

import type { PlayerID, ItemID, SlotNumber } from "../core/identifiers";

// ============================================================================
// DUEL RULES
// ============================================================================

/**
 * Rules that can be toggled for a duel.
 * Both players must agree on all rules before proceeding.
 */
export interface DuelRules {
  /** Cannot use ranged attacks */
  noRanged: boolean;
  /** Cannot use melee attacks */
  noMelee: boolean;
  /** Cannot use magic attacks */
  noMagic: boolean;
  /** Cannot use special attacks */
  noSpecialAttack: boolean;
  /** Cannot use prayer (prayer points drained) */
  noPrayer: boolean;
  /** Cannot drink potions */
  noPotions: boolean;
  /** Cannot eat food */
  noFood: boolean;
  /** Cannot forfeit via trapdoor (fight to the death) */
  noForfeit: boolean;
  /** Cannot move (frozen in place) */
  noMovement: boolean;
  /** Use fun weapons only (boxing gloves, etc.) */
  funWeapons: boolean;
}

/**
 * Default rules - all restrictions disabled
 */
export const DEFAULT_DUEL_RULES: DuelRules = {
  noRanged: false,
  noMelee: false,
  noMagic: false,
  noSpecialAttack: false,
  noPrayer: false,
  noPotions: false,
  noFood: false,
  noForfeit: false,
  noMovement: false,
  funWeapons: false,
};

/**
 * Rule combinations that are invalid (classic MMORPG restrictions).
 * Format: [rule1, rule2, error message]
 */
export const INVALID_RULE_COMBINATIONS: Array<
  [keyof DuelRules, keyof DuelRules, string]
> = [
  ["noForfeit", "funWeapons", "Cannot combine No Forfeit with Fun Weapons"],
  ["noForfeit", "noMovement", "Cannot combine No Forfeit with No Movement"],
];

/**
 * Validate rule combination - returns error message if invalid, null if valid
 */
export function validateRuleCombination(rules: DuelRules): string | null {
  for (const [rule1, rule2, message] of INVALID_RULE_COMBINATIONS) {
    if (rules[rule1] && rules[rule2]) {
      return message;
    }
  }
  // Cannot disable all attack types simultaneously (unwinnable duel)
  if (rules.noMelee && rules.noRanged && rules.noMagic) {
    return "Cannot disable all attack types simultaneously";
  }
  return null;
}

// ============================================================================
// EQUIPMENT RESTRICTIONS
// ============================================================================

/**
 * Equipment slots that can be restricted for a duel.
 * Single source of truth — DuelEquipmentSlot in duel-manifest.ts is an alias of this type.
 */
export type EquipmentSlotRestriction =
  | "head"
  | "cape"
  | "amulet"
  | "weapon"
  | "body"
  | "shield"
  | "legs"
  | "gloves"
  | "boots"
  | "ring"
  | "ammo";

/**
 * Equipment restrictions for a duel.
 * Boolean map — true means the slot IS restricted (items unequipped before duel).
 */
export type EquipmentRestrictions = Record<EquipmentSlotRestriction, boolean>;

/**
 * Default equipment restrictions - all slots enabled (no restrictions)
 */
export const DEFAULT_EQUIPMENT_RESTRICTIONS: EquipmentRestrictions = {
  head: false,
  cape: false,
  amulet: false,
  weapon: false,
  body: false,
  shield: false,
  legs: false,
  gloves: false,
  boots: false,
  ring: false,
  ammo: false,
};

// ============================================================================
// STAKED ITEMS
// ============================================================================

/**
 * An item staked in a duel
 */
export interface StakedItem {
  /** Original slot in player's inventory */
  inventorySlot: SlotNumber;
  /** Item definition ID */
  itemId: ItemID;
  /** Quantity being staked */
  quantity: number;
  /** Cached value at time of staking (for display) */
  value: number;
}

// ============================================================================
// DUEL PARTICIPANT
// ============================================================================

/**
 * A participant in a duel session
 */
export interface DuelParticipant {
  /** Player's unique ID */
  playerId: PlayerID;
  /** Player's display name */
  playerName: string;
  /** Socket ID for network communication */
  socketId: string;

  // Stakes
  /** Items the player has staked */
  stakedItems: StakedItem[];
  /** Gold amount staked (if gold staking is separate) */
  stakedGold: number;
  /** Total value of all stakes */
  totalStakeValue: number;

  // Acceptance state (per screen)
  /** Whether player has accepted the rules */
  acceptedRules: boolean;
  /** Whether player has accepted the stakes */
  acceptedStakes: boolean;
  /** Whether player has confirmed on final screen */
  acceptedFinal: boolean;

  // Combat state (during duel)
  /** Current health during duel */
  currentHealth?: number;
  /** Maximum health */
  maxHealth?: number;
  /** Whether player has died */
  isDead: boolean;
}

/**
 * Create a new duel participant
 */
export function createDuelParticipant(
  playerId: PlayerID,
  playerName: string,
  socketId: string,
): DuelParticipant {
  return {
    playerId,
    playerName,
    socketId,
    stakedItems: [],
    stakedGold: 0,
    totalStakeValue: 0,
    acceptedRules: false,
    acceptedStakes: false,
    acceptedFinal: false,
    isDead: false,
  };
}

// ============================================================================
// DUEL SESSION
// ============================================================================

/**
 * Duel session state machine states
 */
export type DuelState =
  | "RULES" // Selecting rules
  | "STAKES" // Adding stakes
  | "CONFIRMING" // Final confirmation screen
  | "COUNTDOWN" // 3-2-1-FIGHT countdown
  | "FIGHTING" // Combat in progress
  | "FINISHED"; // Duel complete, resolving

/**
 * A duel session between two players
 */
export interface DuelSession {
  /** Unique duel session ID (UUID) */
  duelId: string;
  /** Arena ID this duel is taking place in */
  arenaId: number;

  /** Player who initiated the challenge */
  challenger: DuelParticipant;
  /** Player who accepted the challenge */
  opponent: DuelParticipant;

  /** Agreed upon duel rules */
  rules: DuelRules;
  /** Equipment restrictions */
  equipmentRestrictions: EquipmentRestrictions;

  /** Current state of the duel */
  state: DuelState;

  // Timestamps
  /** When the duel session was created */
  createdAt: number;
  /** When countdown started */
  countdownStartedAt?: number;
  /** When fighting phase started */
  fightStartedAt?: number;
  /** When duel finished */
  finishedAt?: number;

  // Result
  /** Player ID of the winner */
  winnerId?: PlayerID;
  /** Player ID of the loser */
  loserId?: PlayerID;
  /** Player ID who forfeited (if applicable - not recorded on scoreboard) */
  forfeitedBy?: PlayerID;
}

// ============================================================================
// ARENA
// ============================================================================

/**
 * A spawn point in an arena
 */
export interface ArenaSpawnPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Arena bounds
 */
export interface ArenaBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/**
 * An arena in the duel arena area
 */
export interface Arena {
  /** Unique arena ID (1-6) */
  arenaId: number;
  /** Whether arena is currently in use */
  inUse: boolean;
  /** Duel ID currently using this arena */
  currentDuelId: string | null;
  /** Spawn points for both players */
  spawnPoints: [ArenaSpawnPoint, ArenaSpawnPoint];
  /** Arena bounds for movement clamping */
  bounds: ArenaBounds;
  /** Center position of the arena */
  center: { x: number; z: number };
}

// ============================================================================
// PENDING CHALLENGE
// ============================================================================

/**
 * A pending duel challenge awaiting response
 */
export interface PendingDuelChallenge {
  /** Unique challenge ID (UUID) */
  challengeId: string;
  /** Player who sent the challenge */
  challengerId: PlayerID;
  /** Challenger's display name */
  challengerName: string;
  /** Challenger's socket ID */
  challengerSocketId: string;
  /** Challenger's combat level */
  challengerCombatLevel: number;
  /** Player who received the challenge */
  targetId: PlayerID;
  /** Target's display name */
  targetName: string;
  /** When challenge was created */
  createdAt: number;
  /** When challenge expires (30 seconds from creation) */
  expiresAt: number;
}

// Re-export from duel-manifest (canonical location for runtime constants)
export { DUEL_CHALLENGE_TIMEOUT_MS } from "../../data/duel-manifest";

// ============================================================================
// NETWORK MESSAGES - Client → Server
// ============================================================================

/**
 * Client requests to challenge another player
 */
export interface DuelChallengeMessage {
  targetPlayerId: PlayerID;
}

/**
 * Client responds to a challenge
 */
export interface DuelChallengeResponseMessage {
  challengeId: string;
  accept: boolean;
}

/**
 * Client toggles a duel rule
 */
export interface DuelToggleRuleMessage {
  duelId: string;
  rule: keyof DuelRules;
  enabled: boolean;
}

/**
 * Client toggles an equipment slot restriction
 */
export interface DuelToggleEquipmentSlotMessage {
  duelId: string;
  slot: EquipmentSlotRestriction;
  disabled: boolean;
}

/**
 * Client adds an item to their stake
 */
export interface DuelAddStakeMessage {
  duelId: string;
  inventorySlot: SlotNumber;
  quantity: number;
}

/**
 * Client removes an item from their stake
 */
export interface DuelRemoveStakeMessage {
  duelId: string;
  stakeIndex: number;
}

/**
 * Client accepts current screen (rules/stakes/final)
 */
export interface DuelAcceptScreenMessage {
  duelId: string;
  screen: "rules" | "stakes" | "final";
}

/**
 * Client cancels their acceptance on a screen
 */
export interface DuelCancelAcceptMessage {
  duelId: string;
  screen: "rules" | "stakes" | "final";
}

/**
 * Client forfeits the duel (via trapdoor)
 */
export interface DuelForfeitMessage {
  duelId: string;
}

/**
 * Client cancels the duel (before fighting)
 */
export interface DuelCancelMessage {
  duelId: string;
}

// ============================================================================
// NETWORK MESSAGES - Server → Client
// ============================================================================

/**
 * Server notifies client of incoming challenge
 */
export interface DuelChallengeReceivedMessage {
  challengeId: string;
  challengerId: PlayerID;
  challengerName: string;
  challengerCombatLevel: number;
}

/**
 * Server sends updated duel session state
 */
export interface DuelSessionUpdateMessage {
  duelId: string;
  session: DuelSession;
}

/**
 * Server sends countdown tick
 */
export interface DuelCountdownMessage {
  duelId: string;
  /** Countdown number: 3, 2, 1, 0 (0 = FIGHT!) */
  count: number;
}

/**
 * Server notifies duel has ended
 */
export interface DuelEndMessage {
  duelId: string;
  winnerId: PlayerID;
  winnerName: string;
  loserId: PlayerID;
  loserName: string;
  /** Whether the loser forfeited */
  forfeit: boolean;
  /** Items the winner receives */
  winnerReceives: StakedItem[];
  /** Gold the winner receives */
  winnerReceivesGold: number;
}

/**
 * Server sends error message
 */
export interface DuelErrorMessage {
  error: string;
  errorCode: string;
}

/**
 * Server notifies opponent disconnected during duel
 */
export interface DuelOpponentDisconnectedMessage {
  /** Grace period in milliseconds before auto-forfeit */
  gracePeriodMs: number;
}

/**
 * Server notifies opponent reconnected
 */
export interface DuelOpponentReconnectedMessage {
  /** Empty - just a notification */
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Duel error codes for client handling
 */
export enum DuelErrorCode {
  // Challenge errors
  PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
  PLAYER_BUSY = "PLAYER_BUSY",
  PLAYER_IN_COMBAT = "PLAYER_IN_COMBAT",
  PLAYER_IN_DUEL = "PLAYER_IN_DUEL",
  ALREADY_IN_DUEL = "ALREADY_IN_DUEL",
  TARGET_BUSY = "TARGET_BUSY",
  INVALID_TARGET = "INVALID_TARGET",
  NOT_IN_DUEL_ARENA = "NOT_IN_DUEL_ARENA",
  CHALLENGE_EXPIRED = "CHALLENGE_EXPIRED",
  CHALLENGE_NOT_FOUND = "CHALLENGE_NOT_FOUND",
  CHALLENGE_PENDING = "CHALLENGE_PENDING",

  // Session errors
  DUEL_NOT_FOUND = "DUEL_NOT_FOUND",
  NOT_IN_DUEL = "NOT_IN_DUEL",
  NOT_PARTICIPANT = "NOT_PARTICIPANT",
  INVALID_STATE = "INVALID_STATE",
  NO_ARENA_AVAILABLE = "NO_ARENA_AVAILABLE",

  // Rule errors
  INVALID_RULE_COMBINATION = "INVALID_RULE_COMBINATION",

  // Stake errors
  ITEM_NOT_FOUND = "ITEM_NOT_FOUND",
  INVALID_QUANTITY = "INVALID_QUANTITY",
  ITEM_NOT_TRADEABLE = "ITEM_NOT_TRADEABLE",
  STAKE_NOT_FOUND = "STAKE_NOT_FOUND",
  ALREADY_STAKED = "ALREADY_STAKED",

  // Forfeit errors
  CANNOT_FORFEIT = "CANNOT_FORFEIT",

  // Generic
  SERVER_ERROR = "SERVER_ERROR",
}

// ============================================================================
// SOCKET EVENT NAMES
// ============================================================================

/**
 * Socket event names for duel system
 */
export const DuelEvents = {
  // Client → Server
  CHALLENGE: "duel:challenge",
  CHALLENGE_RESPOND: "duel:challenge:respond",
  TOGGLE_RULE: "duel:rule:toggle",
  TOGGLE_EQUIPMENT: "duel:equipment:toggle",
  ADD_STAKE: "duel:stake:add",
  REMOVE_STAKE: "duel:stake:remove",
  ACCEPT_SCREEN: "duel:accept",
  CANCEL_ACCEPT: "duel:accept:cancel",
  FORFEIT: "duel:forfeit",
  CANCEL: "duel:cancel",

  // Server → Client
  CHALLENGE_RECEIVED: "duel:challenge:received",
  CHALLENGE_EXPIRED: "duel:challenge:expired",
  SESSION_UPDATE: "duel:session:update",
  COUNTDOWN: "duel:countdown",
  FIGHT_START: "duel:fight:start",
  FINISHED: "duel:finished",
  CANCELLED: "duel:cancelled",
  ERROR: "duel:error",
  OPPONENT_DISCONNECTED: "duel:opponent:disconnected",
  OPPONENT_RECONNECTED: "duel:opponent:reconnected",
} as const;

export type DuelEventName = (typeof DuelEvents)[keyof typeof DuelEvents];
