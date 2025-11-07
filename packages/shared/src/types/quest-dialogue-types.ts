/**
 * Quest and Dialogue System Type Definitions
 *
 * Complete type definitions for the NPC Dialogue and Quest systems.
 * These types define the structure for:
 * - Dialogue trees and conversation flow
 * - Quest definitions, objectives, and progress
 * - Event payloads for client-server communication
 *
 * @see /docs/api-specifications/npc-dialogue-quest-api.md for full API documentation
 */

import type { Position3D } from './core';

// ============================================================================
// DIALOGUE SYSTEM TYPES
// ============================================================================

/**
 * Dialogue Context - Category/purpose of dialogue
 */
export type DialogueContext =
  | 'greeting'      // Initial NPC greeting
  | 'quest'         // Quest-related dialogue
  | 'shop'          // Shop/trading dialogue
  | 'lore'          // Lore/story dialogue
  | 'help'          // Help/tutorial dialogue
  | 'farewell'      // Goodbye dialogue
  | 'custom';       // Custom context

/**
 * Dialogue Tree - Full dialogue structure for an NPC
 */
export interface DialogueTree {
  /** Unique dialogue tree ID */
  id: string;

  /** NPC this dialogue belongs to */
  npcId: string;

  /** Dialogue tree name/title */
  name: string;

  /** Root node ID (starting point) */
  rootNodeId: string;

  /** All dialogue nodes in this tree */
  nodes: Map<string, DialogueNode>;

  /** Optional: Context/category (e.g., "greeting", "quest", "shop") */
  context?: DialogueContext;

  /** Optional: Requirements to access this dialogue */
  requirements?: DialogueRequirement[];
}

/**
 * Dialogue Node - Single dialogue entry/response
 */
export interface DialogueNode {
  /** Unique node ID within dialogue tree */
  id: string;

  /** Dialogue text (supports {variable} interpolation) */
  text: string;

  /** NPC emotional state/animation hint */
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'confused';

  /** Available response options (if any) */
  options?: DialogueOption[];

  /** Optional: Action to execute when reaching this node */
  action?: DialogueAction;

  /** Optional: Condition to check before displaying */
  condition?: DialogueCondition;

  /** Optional: Next node if no options (auto-continue) */
  nextNodeId?: string | null;

  /** Whether this node ends the dialogue */
  endsDialogue: boolean;
}

/**
 * Dialogue Option - Player response choice
 */
export interface DialogueOption {
  /** Unique option ID */
  id: string;

  /** Display text for this option */
  text: string;

  /** Next node to go to when selected */
  nextNodeId: string | null;

  /** Optional: Condition to show this option */
  condition?: DialogueCondition;

  /** Optional: Action to execute when selected */
  action?: DialogueAction;

  /** Optional: Tooltip/hint text */
  tooltip?: string;

  /** Whether selecting this ends dialogue */
  endsDialogue: boolean;
}

/**
 * Dialogue Condition - Check before showing node/option
 */
export interface DialogueCondition {
  /** Condition type */
  type: 'quest_status' | 'item_owned' | 'skill_level' | 'flag_set' | 'custom';

  /** Parameters for condition check */
  params: Record<string, unknown>;

  /** Optional: Inverted condition (NOT logic) */
  inverted?: boolean;
}

/**
 * Dialogue Action - Execute when node/option is triggered
 */
export interface DialogueAction {
  /** Action type */
  type: 'start_quest' | 'complete_quest' | 'give_item' | 'take_item' |
        'set_flag' | 'open_shop' | 'teleport' | 'custom';

  /** Parameters for action */
  params: Record<string, unknown>;

  /** Optional: Confirmation message */
  confirmationMessage?: string;
}

/**
 * Dialogue Action Result - Result of executing an action
 */
export interface DialogueActionResult {
  /** Whether action succeeded */
  success: boolean;

  /** Action type that was executed */
  actionType: string;

  /** Optional: Result message */
  message?: string;

  /** Optional: Result data */
  data?: Record<string, unknown>;
}

/**
 * Dialogue Requirement - Requirement to access dialogue tree
 */
export interface DialogueRequirement {
  /** Requirement type */
  type: 'quest_completed' | 'level' | 'item' | 'reputation';

  /** Requirement parameters */
  params: Record<string, unknown>;
}

/**
 * Dialogue Session State - Active dialogue session
 * Server-side state tracking
 */
export interface DialogueSession {
  /** Session ID */
  sessionId: string;

  /** Player in dialogue */
  playerId: string;

  /** NPC in conversation */
  npcId: string;

  /** Current dialogue tree */
  treeId: string;

  /** Current node ID */
  currentNodeId: string;

  /** Session start time */
  startTime: number;

  /** Last activity time */
  lastActivity: number;

  /** Session variables (for {variable} interpolation) */
  variables: Map<string, string | number>;

  /** Dialogue history (nodes visited) */
  history: string[];
}

/**
 * Dialogue Error Code - Error types
 */
export enum DialogueErrorCode {
  /** NPC not found */
  NPC_NOT_FOUND = 'NPC_NOT_FOUND',

  /** Player too far from NPC */
  OUT_OF_RANGE = 'OUT_OF_RANGE',

  /** Dialogue tree not found */
  DIALOGUE_NOT_FOUND = 'DIALOGUE_NOT_FOUND',

  /** Invalid node ID */
  INVALID_NODE = 'INVALID_NODE',

  /** Invalid response option */
  INVALID_RESPONSE = 'INVALID_RESPONSE',

  /** Session not found */
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',

  /** Session expired/timed out */
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  /** Player already in dialogue */
  ALREADY_IN_DIALOGUE = 'ALREADY_IN_DIALOGUE',

  /** Requirements not met */
  REQUIREMENTS_NOT_MET = 'REQUIREMENTS_NOT_MET',

  /** Action execution failed */
  ACTION_FAILED = 'ACTION_FAILED',

  /** Generic error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ============================================================================
// QUEST SYSTEM TYPES
// ============================================================================

/**
 * Quest Category - Type of quest
 */
export type QuestCategory =
  | 'main_story'    // Main storyline quests
  | 'side_quest'    // Side quests
  | 'daily'         // Daily repeatable quests
  | 'weekly'        // Weekly repeatable quests
  | 'tutorial'      // Tutorial/learning quests
  | 'bounty'        // Bounty/hunting quests
  | 'collection'    // Collection/gathering quests
  | 'exploration'   // Exploration/discovery quests
  | 'crafting'      // Crafting-related quests
  | 'combat'        // Combat-focused quests
  | 'social';       // Social/interaction quests

/**
 * Quest Status - Current state of quest
 */
export type QuestStatus =
  | 'not_started'   // Player hasn't started quest
  | 'available'     // Quest is available to start
  | 'in_progress'   // Quest is active
  | 'completed'     // Quest completed successfully
  | 'failed'        // Quest failed
  | 'abandoned';    // Player abandoned quest

/**
 * Quest Objective Type
 */
export type QuestObjectiveType =
  | 'kill'          // Kill X enemies
  | 'collect'       // Collect X items
  | 'interact'      // Interact with object/NPC
  | 'reach_location' // Travel to location
  | 'escort'        // Escort NPC
  | 'defend'        // Defend location/NPC
  | 'craft'         // Craft X items
  | 'gather'        // Gather X resources
  | 'deliver'       // Deliver item to NPC
  | 'explore'       // Discover area
  | 'use_item'      // Use specific item
  | 'talk_to'       // Talk to NPC
  | 'wait'          // Wait for time/event
  | 'custom';       // Custom objective logic

/**
 * Quest Definition - Complete quest structure
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

  /** Recommended level */
  recommendedLevel: number;

  /** Quest difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'elite';

  /** Whether quest can be repeated */
  repeatable: boolean;

  /** Cooldown before repeat (milliseconds, 0 = no cooldown) */
  repeatCooldown: number;

  /** Quest requirements */
  requirements: QuestRequirement[];

  /** Quest objectives */
  objectives: QuestObjective[];

  /** Quest rewards */
  rewards: QuestReward[];

  /** NPC who gives quest (if applicable) */
  questGiverId: string | null;

  /** NPCs involved in quest */
  relatedNpcs: string[];

  /** Time limit (milliseconds, 0 = no limit) */
  timeLimit: number;

  /** Quest storyline/lore text */
  storyline?: string;

  /** Whether quest is part of a chain */
  isChained: boolean;

  /** Previous quest in chain (if applicable) */
  prerequisiteQuestId?: string | null;

  /** Next quest in chain (if applicable) */
  followupQuestId?: string | null;

  /** Auto-accept on meeting requirements */
  autoAccept: boolean;

  /** Auto-complete when objectives done */
  autoComplete: boolean;
}

/**
 * Quest Requirement - Requirement to start quest
 */
export interface QuestRequirement {
  /** Requirement type */
  type: 'level' | 'quest_completed' | 'item' | 'skill_level' | 'reputation' | 'custom';

  /** Requirement parameters */
  params: Record<string, unknown>;

  /** Human-readable description */
  description: string;
}

/**
 * Quest Requirement Check - Result of requirement validation
 */
export interface QuestRequirementCheck extends QuestRequirement {
  /** Whether requirement is met */
  met: boolean;

  /** Optional: Current value vs required value */
  currentValue?: number;

  /** Optional: Required value */
  requiredValue?: number;
}

/**
 * Quest Objective - Single objective within quest
 */
export interface QuestObjective {
  /** Unique objective ID within quest */
  id: string;

  /** Objective type */
  type: QuestObjectiveType;

  /** Objective description */
  description: string;

  /** Target parameters */
  target: QuestObjectiveTarget;

  /** Current progress value */
  currentProgress: number;

  /** Required progress value */
  requiredProgress: number;

  /** Whether objective is optional */
  optional: boolean;

  /** Display order */
  order: number;

  /** Whether objective is complete */
  completed: boolean;

  /** Optional: Hint text */
  hint?: string;

  /** Optional: Map marker position */
  mapMarker?: Position3D;
}

/**
 * Quest Objective Target - Target entity for objective
 */
export interface QuestObjectiveTarget {
  /** Target type */
  type: 'npc' | 'item' | 'location' | 'object' | 'skill' | 'custom';

  /** Target ID(s) */
  ids: string[];

  /** Optional: Additional target parameters */
  params?: Record<string, unknown>;
}

/**
 * Quest Progress - Player's progress on a quest
 */
export interface QuestProgress {
  /** Quest ID */
  questId: string;

  /** Player ID */
  playerId: string;

  /** Current quest status */
  status: QuestStatus;

  /** Objective progress */
  objectives: QuestObjective[];

  /** Start timestamp */
  startTime: number | null;

  /** Completion timestamp (if completed) */
  completionTime: number | null;

  /** Last update timestamp */
  lastUpdateTime: number;

  /** Overall completion percentage (0-100) */
  completionPercentage: number;

  /** Optional: Quest-specific data */
  data?: Record<string, unknown>;

  /** Optional: Time remaining (if time-limited) */
  timeRemaining?: number;
}

/**
 * Quest Reward - Reward for completing quest
 */
export interface QuestReward {
  /** Reward type */
  type: 'xp' | 'item' | 'coins' | 'skill_xp' | 'reputation' | 'unlock' | 'custom';

  /** Reward parameters */
  params: Record<string, unknown>;

  /** Display description */
  description: string;

  /** Optional: Reward icon path */
  iconPath?: string;
}

/**
 * Quest Summary - Brief quest information
 */
export interface QuestSummary {
  /** Quest ID */
  questId: string;

  /** Quest name */
  name: string;

  /** Quest category */
  category: QuestCategory;

  /** Quest status */
  status: QuestStatus;

  /** Completion percentage */
  completionPercentage: number;

  /** Recommended level */
  recommendedLevel: number;

  /** Whether quest is repeatable */
  repeatable: boolean;
}

/**
 * Quest Error Code - Error types
 */
export enum QuestErrorCode {
  /** Quest not found */
  QUEST_NOT_FOUND = 'QUEST_NOT_FOUND',

  /** Quest already active */
  ALREADY_ACTIVE = 'ALREADY_ACTIVE',

  /** Quest already completed (non-repeatable) */
  ALREADY_COMPLETED = 'ALREADY_COMPLETED',

  /** Requirements not met */
  REQUIREMENTS_NOT_MET = 'REQUIREMENTS_NOT_MET',

  /** Quest not active */
  NOT_ACTIVE = 'NOT_ACTIVE',

  /** Invalid objective */
  INVALID_OBJECTIVE = 'INVALID_OBJECTIVE',

  /** Quest failed */
  QUEST_FAILED = 'QUEST_FAILED',

  /** Quest on cooldown */
  ON_COOLDOWN = 'ON_COOLDOWN',

  /** Quest limit reached */
  LIMIT_REACHED = 'LIMIT_REACHED',

  /** Inventory full (can't receive reward) */
  INVENTORY_FULL = 'INVENTORY_FULL',

  /** Generic error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ============================================================================
// EVENT PAYLOAD TYPES
// ============================================================================

// Dialogue Event Payloads

/**
 * Request to start dialogue with an NPC
 * Sent when player clicks "Talk" on an NPC
 */
export interface DialogueStartRequestEvent {
  /** Player requesting dialogue */
  playerId: string;

  /** NPC to talk with */
  npcId: string;

  /** Player's current position (for validation) */
  playerPosition: Position3D;

  /** Optional: Context for dialogue (e.g., "quest", "shop") */
  context?: DialogueContext;
}

/**
 * Dialogue session started successfully
 * Server confirms dialogue can begin
 */
export interface DialogueStartedEvent {
  /** Player in dialogue */
  playerId: string;

  /** NPC in conversation */
  npcId: string;

  /** NPC display name */
  npcName: string;

  /** Initial dialogue tree */
  dialogueTree: DialogueTree;

  /** Initial node to display */
  initialNodeId: string;

  /** Session start timestamp */
  startTime: number;

  /** Session ID for tracking */
  sessionId: string;
}

/**
 * New dialogue node displayed to player
 * Server sends updated dialogue content
 */
export interface DialogueNodeDisplayedEvent {
  /** Player in dialogue */
  playerId: string;

  /** NPC in conversation */
  npcId: string;

  /** Session ID */
  sessionId: string;

  /** Current dialogue node */
  node: DialogueNode;

  /** Available response options */
  options: DialogueOption[];

  /** Optional: Variables to display in text (e.g., player name) */
  variables?: Record<string, string | number>;
}

/**
 * Player selects a dialogue response option
 * Sent when player clicks a dialogue choice
 */
export interface DialogueResponseSelectedEvent {
  /** Player making selection */
  playerId: string;

  /** NPC in conversation */
  npcId: string;

  /** Current dialogue node */
  currentNodeId: string;

  /** Selected response option ID */
  responseId: string;

  /** Timestamp of selection */
  timestamp: number;
}

/**
 * Dialogue response processed by server
 * Acknowledges player's choice
 */
export interface DialogueResponseProcessedEvent {
  /** Player in dialogue */
  playerId: string;

  /** NPC in conversation */
  npcId: string;

  /** Session ID */
  sessionId: string;

  /** Response that was selected */
  responseId: string;

  /** Next node to display (if any) */
  nextNodeId: string | null;

  /** Optional: Action result (e.g., quest started) */
  actionResult?: DialogueActionResult;
}

/**
 * Request to end dialogue session
 * Sent when player closes dialogue or walks away
 */
export interface DialogueEndRequestEvent {
  /** Player ending dialogue */
  playerId: string;

  /** NPC in conversation */
  npcId: string;

  /** Reason for ending */
  reason: 'player_closed' | 'player_moved' | 'npc_moved' | 'timeout';
}

/**
 * Dialogue session ended
 * Server confirms dialogue has closed
 */
export interface DialogueEndedEvent {
  /** Player in dialogue */
  playerId: string;

  /** NPC in conversation */
  npcId: string;

  /** Session ID */
  sessionId: string;

  /** Reason for ending */
  reason: 'completed' | 'player_closed' | 'distance' | 'timeout' | 'error';

  /** Session duration in milliseconds */
  duration: number;
}

/**
 * Dialogue error occurred
 * Server reports error during dialogue
 */
export interface DialogueErrorEvent {
  /** Player in dialogue */
  playerId: string;

  /** NPC in conversation (if known) */
  npcId: string | null;

  /** Session ID (if exists) */
  sessionId: string | null;

  /** Error code */
  errorCode: DialogueErrorCode;

  /** Human-readable error message */
  message: string;

  /** Optional: Additional error details */
  details?: Record<string, unknown>;
}

// Quest Event Payloads

/**
 * Quest is available for player
 * Server notifies player of available quest
 */
export interface QuestAvailableEvent {
  /** Player who can accept quest */
  playerId: string;

  /** Available quest */
  quest: QuestDefinition;

  /** NPC offering quest (if applicable) */
  npcId: string | null;

  /** Whether requirements are met */
  requirementsMet: boolean;

  /** Missing requirements (if any) */
  missingRequirements?: QuestRequirementCheck[];
}

/**
 * Request to start a quest
 * Sent when player accepts a quest from NPC
 */
export interface QuestStartRequestEvent {
  /** Player starting quest */
  playerId: string;

  /** Quest to start */
  questId: string;

  /** NPC offering quest (if applicable) */
  npcId: string | null;

  /** Timestamp of request */
  timestamp: number;
}

/**
 * Quest started successfully
 * Server confirms quest has begun
 */
export interface QuestStartedEvent {
  /** Player who started quest */
  playerId: string;

  /** Started quest */
  questId: string;

  /** Quest definition */
  quest: QuestDefinition;

  /** Initial quest progress */
  progress: QuestProgress;

  /** Start timestamp */
  startTime: number;
}

/**
 * Quest objective updated
 * Server notifies of specific objective progress
 */
export interface QuestObjectiveUpdatedEvent {
  /** Player with quest */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Updated objective */
  objective: QuestObjective;

  /** New progress for this objective */
  currentProgress: number;

  /** Whether objective is now complete */
  completed: boolean;

  /** Timestamp of update */
  timestamp: number;
}

/**
 * Quest progress updated
 * Server sends overall quest progress
 */
export interface QuestProgressedEvent {
  /** Player with quest */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Updated quest progress */
  progress: QuestProgress;

  /** Completion percentage (0-100) */
  completionPercentage: number;

  /** Timestamp of update */
  timestamp: number;
}

/**
 * Request to abandon a quest
 * Sent when player chooses to abandon quest
 */
export interface QuestAbandonRequestEvent {
  /** Player abandoning quest */
  playerId: string;

  /** Quest to abandon */
  questId: string;

  /** Confirmation flag (require explicit confirmation) */
  confirmed: boolean;
}

/**
 * Quest abandoned
 * Server confirms quest abandonment
 */
export interface QuestAbandonedEvent {
  /** Player who abandoned quest */
  playerId: string;

  /** Abandoned quest */
  questId: string;

  /** Reason for abandonment */
  reason: 'player_choice' | 'failed_requirement' | 'timeout';

  /** Timestamp */
  timestamp: number;
}

/**
 * Quest completed
 * Server confirms quest completion
 */
export interface QuestCompletedEvent {
  /** Player who completed quest */
  playerId: string;

  /** Completed quest */
  questId: string;

  /** Quest definition */
  quest: QuestDefinition;

  /** Rewards granted */
  rewards: QuestReward[];

  /** Completion timestamp */
  completionTime: number;

  /** Total time taken (milliseconds) */
  duration: number;
}

/**
 * Quest failed
 * Server notifies quest failure
 */
export interface QuestFailedEvent {
  /** Player who failed quest */
  playerId: string;

  /** Failed quest */
  questId: string;

  /** Reason for failure */
  reason: string;

  /** Whether quest can be retried */
  canRetry: boolean;

  /** Timestamp */
  timestamp: number;
}

/**
 * Request quest information
 * Sent when player wants details about a quest
 */
export interface QuestInfoRequestEvent {
  /** Player requesting info */
  playerId: string;

  /** Quest to get info about */
  questId: string;
}

/**
 * Quest information response
 * Server sends detailed quest info
 */
export interface QuestInfoResponseEvent {
  /** Player who requested info */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Quest definition */
  quest: QuestDefinition;

  /** Current progress (if started) */
  progress: QuestProgress | null;

  /** Requirements check */
  requirements: QuestRequirementCheck[];

  /** Whether quest is available */
  available: boolean;
}

/**
 * Request list of active quests
 * Sent when player opens quest log
 */
export interface QuestListRequestEvent {
  /** Player requesting list */
  playerId: string;

  /** Filter options */
  filter?: {
    /** Filter by status */
    status?: QuestStatus[];

    /** Filter by category */
    category?: string[];

    /** Sort order */
    sortBy?: 'name' | 'progress' | 'level';
  };
}

/**
 * Active quests list response
 * Server sends list of player's quests
 */
export interface QuestListResponseEvent {
  /** Player who requested list */
  playerId: string;

  /** Active quests */
  activeQuests: QuestProgress[];

  /** Completed quests */
  completedQuests: QuestSummary[];

  /** Total quest count */
  totalQuests: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Quest error occurred
 * Server reports quest-related error
 */
export interface QuestErrorEvent {
  /** Player experiencing error */
  playerId: string;

  /** Quest ID (if applicable) */
  questId: string | null;

  /** Error code */
  errorCode: QuestErrorCode;

  /** Human-readable error message */
  message: string;

  /** Optional: Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Quest requirements not met
 * Server notifies player cannot start quest
 */
export interface QuestRequirementsNotMetEvent {
  /** Player who tried to start quest */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Missing requirements */
  missingRequirements: QuestRequirementCheck[];

  /** Human-readable message */
  message: string;
}

// Quest Objective Progress Event Payloads

/**
 * Kill objective progress
 * Server updates kill count for quest
 */
export interface QuestObjectiveKillProgressEvent {
  /** Player with quest */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Objective ID */
  objectiveId: string;

  /** Target NPC type */
  targetNpcId: string;

  /** Current kill count */
  currentCount: number;

  /** Required kill count */
  requiredCount: number;

  /** Killed NPC ID (this kill) */
  killedNpcId: string;
}

/**
 * Collection objective progress
 * Server updates item collection count
 */
export interface QuestObjectiveCollectProgressEvent {
  /** Player with quest */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Objective ID */
  objectiveId: string;

  /** Target item ID */
  itemId: string;

  /** Current item count */
  currentCount: number;

  /** Required item count */
  requiredCount: number;

  /** Source of items (e.g., "looted", "crafted") */
  source: string;
}

/**
 * Interaction objective progress
 * Server updates interaction progress
 */
export interface QuestObjectiveInteractProgressEvent {
  /** Player with quest */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Objective ID */
  objectiveId: string;

  /** Target entity ID (NPC, object, etc.) */
  targetId: string;

  /** Type of interaction */
  interactionType: string;

  /** Whether objective is complete */
  completed: boolean;
}

/**
 * Location objective progress
 * Server updates location discovery
 */
export interface QuestObjectiveLocationProgressEvent {
  /** Player with quest */
  playerId: string;

  /** Quest ID */
  questId: string;

  /** Objective ID */
  objectiveId: string;

  /** Target location name */
  locationName: string;

  /** Target position */
  targetPosition: Position3D;

  /** Current player position */
  currentPosition: Position3D;

  /** Distance remaining */
  distance: number;

  /** Whether objective is complete */
  completed: boolean;
}
