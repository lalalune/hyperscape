/**
 * Quest System Type Definitions
 *
 * Type definitions for the Quest Tracking System.
 * Defines quest structures, objective types, and progress tracking.
 */

/**
 * Quest Objective Type
 * Defines what kind of task the player needs to complete
 */
export type QuestObjectiveType =
  | 'kill_mob'          // Kill X mobs of a specific type
  | 'collect_item'      // Collect X items (from any source)
  | 'talk_to_npc'       // Talk to a specific NPC
  | 'reach_location'    // Travel to a specific location
  | 'gather_resource';  // Gather X resources from nodes

/**
 * Quest Category
 * Categorizes quests by their primary focus
 */
export type QuestCategory =
  | 'tutorial'      // Tutorial/learning quests
  | 'combat'        // Combat-focused quests
  | 'gathering'     // Gathering/resource quests
  | 'exploration'   // Exploration quests
  | 'social';       // Social/NPC interaction quests

/**
 * Quest Status
 * Current state of a quest for a player
 */
export type QuestStatus =
  | 'active'        // Quest is currently active
  | 'completed'     // Quest has been completed
  | 'failed';       // Quest has failed (if applicable)

/**
 * Quest Objective
 * A single objective within a quest
 */
export interface QuestObjective {
  /** Unique objective ID within the quest */
  id: string;

  /** Type of objective */
  type: QuestObjectiveType;

  /** Target entity/item/location ID */
  target: string;

  /** Human-readable description */
  description: string;

  /** Number required to complete objective */
  required: number;

  /** Current progress toward objective */
  current: number;

  /** UI alias for current progress */
  currentProgress?: number;

  /** UI alias for required progress */
  requiredProgress?: number;

  /** Whether objective is completed */
  completed?: boolean;
}

/**
 * Faction Type
 * Defines the three factions in the game world
 */
export type FactionType =
  | 'harmonyCouncil'  // Pro-agent faction (Elder Thornwick)
  | 'purists'         // Anti-agent faction (Master Aldric)
  | 'freelancers';    // Neutral faction (Warden Lyssa)

/**
 * Faction Reputation
 * Tracks player reputation with all factions
 */
export interface FactionReputation {
  /** Pro-agent faction reputation */
  harmonyCouncil: number;

  /** Anti-agent faction reputation */
  purists: number;

  /** Neutral faction reputation */
  freelancers: number;
}

/**
 * Quest Rewards
 * Rewards granted upon quest completion
 */
export interface QuestRewards {
  /** XP rewards per skill */
  xp?: Record<string, number>;

  /** Coin reward */
  coins?: number;

  /** Item rewards */
  items?: Array<{
    itemId: string;
    quantity: number;
  }>;

  /** Faction reputation rewards */
  factionReputation?: Partial<FactionReputation>;
}

/**
 * Quest Definition
 * Complete definition of a quest loaded from quest-definitions.json
 */
export interface QuestDefinition {
  /** Unique quest ID */
  id: string;

  /** Quest display name */
  name: string;

  /** Quest description */
  description: string;

  /** Quest category */
  category: QuestCategory;

  /** Difficulty level (1-3) */
  difficulty: number;

  /** Minimum player level required */
  minLevel: number;

  /** NPC who gives this quest */
  questGiver: string;

  /** Faction alignment (optional) */
  faction?: FactionType;

  /** List of objectives */
  objectives: QuestObjective[];

  /** Quest rewards */
  rewards: QuestRewards;

  /** Whether quest can be repeated */
  isRepeatable: boolean;

  /** Whether quest auto-completes when objectives are done */
  autoComplete: boolean;
}

/**
 * Quest Progress
 * Tracks a player's progress on an active quest
 */
export interface QuestProgress {
  /** Quest ID */
  questId: string;

  /** When quest was started (Unix timestamp) */
  startTime: number;

  /** Current objectives with progress */
  objectives: QuestObjective[];

  /** Completion percentage (0-100) */
  completionPercentage?: number;
}

/**
 * Quest Summary
 * Simplified quest information for UI display
 */
export interface QuestSummary {
  /** Quest ID */
  questId: string;

  /** Quest display name */
  name: string;

  /** Quest category */
  category: QuestCategory;

  /** Quest status */
  status: QuestStatus;

  /** Completion percentage (0-100) */
  completionPercentage: number;

  /** Minimum player level */
  minLevel?: number;

  /** Whether quest is repeatable */
  isRepeatable?: boolean;
}

/**
 * Player Quest State
 * Complete quest state for a player (for database storage)
 */
export interface PlayerQuestState {
  /** Player ID */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Quest status */
  status: QuestStatus;

  /** Quest objectives with progress */
  objectives: QuestObjective[];

  /** When quest was started */
  startedAt: number;

  /** When quest was completed (null if not completed) */
  completedAt: number | null;
}
