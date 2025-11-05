# NPC Dialogue & Quest System API Specification

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-05

## Table of Contents

1. [Overview](#overview)
2. [Event Type Definitions](#event-type-definitions)
3. [Dialogue System API](#dialogue-system-api)
4. [Quest System API](#quest-system-api)
5. [Network Protocol](#network-protocol)
6. [Data Structures](#data-structures)
7. [System Methods](#system-methods)
8. [Error Handling](#error-handling)
9. [Validation Rules](#validation-rules)
10. [Usage Examples](#usage-examples)

---

## Overview

This document defines the complete API specification for the NPC Dialogue and Quest systems in Hyperscape. The system uses EventBus for client-server communication with typed events.

### Design Principles

- **Type Safety**: All events use TypeScript interfaces for compile-time validation
- **Backwards Compatibility**: Extends existing event types without breaking changes
- **Bidirectional Communication**: Client ↔ Server event flow
- **State Management**: Server-authoritative with client state sync
- **Validation**: All inputs validated before processing

---

## Event Type Definitions

### New Event Types

Add the following to `EventType` enum in `/packages/shared/src/types/events.ts`:

```typescript
export enum EventType {
  // ... existing events ...

  // ========== DIALOGUE SYSTEM ==========

  /** Client → Server: Request to start dialogue with NPC */
  DIALOGUE_START_REQUEST = 'dialogue:start_request',

  /** Server → Client: Dialogue session started successfully */
  DIALOGUE_STARTED = 'dialogue:started',

  /** Server → Client: Update dialogue state (new node displayed) */
  DIALOGUE_NODE_DISPLAYED = 'dialogue:node_displayed',

  /** Client → Server: Player selects a dialogue response option */
  DIALOGUE_RESPONSE_SELECTED = 'dialogue:response_selected',

  /** Server → Client: Dialogue response processed */
  DIALOGUE_RESPONSE_PROCESSED = 'dialogue:response_processed',

  /** Client → Server: Request to end dialogue session */
  DIALOGUE_END_REQUEST = 'dialogue:end_request',

  /** Server → Client: Dialogue session ended */
  DIALOGUE_ENDED = 'dialogue:ended',

  /** Server → Client: Dialogue error occurred */
  DIALOGUE_ERROR = 'dialogue:error',

  // ========== QUEST SYSTEM ==========

  /** Server → Client: Quest is available for player */
  QUEST_AVAILABLE = 'quest:available',

  /** Client → Server: Request to start a quest */
  QUEST_START_REQUEST = 'quest:start_request',

  /** Server → Client: Quest started successfully */
  // QUEST_STARTED = 'quest:started', // Already exists

  /** Server → Client: Quest objective updated */
  QUEST_OBJECTIVE_UPDATED = 'quest:objective_updated',

  /** Server → Client: Quest progress updated */
  // QUEST_PROGRESSED = 'quest:progressed', // Already exists

  /** Client → Server: Request to abandon quest */
  QUEST_ABANDON_REQUEST = 'quest:abandon_request',

  /** Server → Client: Quest abandoned */
  QUEST_ABANDONED = 'quest:abandoned',

  /** Server → Client: Quest completed */
  // QUEST_COMPLETED = 'quest:completed', // Already exists

  /** Server → Client: Quest failed */
  QUEST_FAILED = 'quest:failed',

  /** Client → Server: Request quest details */
  QUEST_INFO_REQUEST = 'quest:info_request',

  /** Server → Client: Quest information response */
  QUEST_INFO_RESPONSE = 'quest:info_response',

  /** Client → Server: Request active quests list */
  QUEST_LIST_REQUEST = 'quest:list_request',

  /** Server → Client: Active quests list */
  QUEST_LIST_RESPONSE = 'quest:list_response',

  /** Server → Client: Quest error occurred */
  QUEST_ERROR = 'quest:error',

  /** Server → Client: Quest requirements not met */
  QUEST_REQUIREMENTS_NOT_MET = 'quest:requirements_not_met',

  // ========== QUEST OBJECTIVES ==========

  /** Server → Client: Kill objective progress */
  QUEST_OBJECTIVE_KILL_PROGRESS = 'quest:objective:kill_progress',

  /** Server → Client: Collection objective progress */
  QUEST_OBJECTIVE_COLLECT_PROGRESS = 'quest:objective:collect_progress',

  /** Server → Client: Interaction objective progress */
  QUEST_OBJECTIVE_INTERACT_PROGRESS = 'quest:objective:interact_progress',

  /** Server → Client: Location objective progress */
  QUEST_OBJECTIVE_LOCATION_PROGRESS = 'quest:objective:location_progress',
}
```

---

## Dialogue System API

### Event Payload Interfaces

#### Client → Server Events

```typescript
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
```

#### Server → Client Events

```typescript
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
```

---

## Quest System API

### Event Payload Interfaces

#### Client → Server Events

```typescript
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
```

#### Server → Client Events

```typescript
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
```

#### Quest Objective Progress Events

```typescript
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
```

---

## Data Structures

### Dialogue System Types

```typescript
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
```

### Quest System Types

```typescript
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
```

---

## System Methods

### DialogueStateManager API

```typescript
/**
 * DialogueStateManager - Manages dialogue sessions
 * Server-side component
 */
export class DialogueStateManager {
  /**
   * Start a new dialogue session
   * @param playerId - Player starting dialogue
   * @param npcId - NPC to talk with
   * @param context - Optional dialogue context
   * @returns Session ID or error
   */
  startDialogue(
    playerId: string,
    npcId: string,
    context?: DialogueContext
  ): Promise<{ success: boolean; sessionId?: string; error?: string }>;

  /**
   * Process player's dialogue response
   * @param playerId - Player in dialogue
   * @param sessionId - Active session ID
   * @param responseId - Selected response option ID
   * @returns Next node and action result
   */
  processResponse(
    playerId: string,
    sessionId: string,
    responseId: string
  ): Promise<{
    success: boolean;
    nextNodeId?: string | null;
    actionResult?: DialogueActionResult;
    error?: string;
  }>;

  /**
   * End dialogue session
   * @param playerId - Player ending dialogue
   * @param sessionId - Session to end
   * @param reason - Reason for ending
   */
  endDialogue(
    playerId: string,
    sessionId: string,
    reason: string
  ): Promise<void>;

  /**
   * Get current dialogue node for session
   * @param sessionId - Session ID
   * @returns Current dialogue node
   */
  getCurrentNode(sessionId: string): DialogueNode | null;

  /**
   * Get active session for player
   * @param playerId - Player ID
   * @returns Active session or null
   */
  getActiveSession(playerId: string): DialogueSession | null;

  /**
   * Check if player is in dialogue
   * @param playerId - Player ID
   * @returns True if in dialogue
   */
  isInDialogue(playerId: string): boolean;

  /**
   * Validate dialogue condition
   * @param playerId - Player ID
   * @param condition - Condition to check
   * @returns True if condition met
   */
  checkCondition(playerId: string, condition: DialogueCondition): boolean;

  /**
   * Execute dialogue action
   * @param playerId - Player ID
   * @param action - Action to execute
   * @returns Action result
   */
  executeAction(
    playerId: string,
    action: DialogueAction
  ): Promise<DialogueActionResult>;

  /**
   * Get dialogue tree for NPC
   * @param npcId - NPC ID
   * @param context - Optional context filter
   * @returns Dialogue tree or null
   */
  getDialogueTree(
    npcId: string,
    context?: DialogueContext
  ): DialogueTree | null;

  /**
   * Register dialogue tree
   * @param tree - Dialogue tree to register
   */
  registerDialogueTree(tree: DialogueTree): void;

  /**
   * Clean up expired sessions
   * @param timeoutMs - Session timeout in milliseconds
   */
  cleanupExpiredSessions(timeoutMs: number): void;
}
```

### QuestSystem API

```typescript
/**
 * QuestSystem - Manages quests and objectives
 * Server-side component
 */
export class QuestSystem extends System {
  /**
   * Start a quest for player
   * @param playerId - Player starting quest
   * @param questId - Quest to start
   * @returns Success status and progress
   */
  startQuest(
    playerId: string,
    questId: string
  ): Promise<{ success: boolean; progress?: QuestProgress; error?: string }>;

  /**
   * Update quest objective progress
   * @param playerId - Player with quest
   * @param questId - Quest ID
   * @param objectiveId - Objective to update
   * @param progress - New progress value
   * @returns Updated objective
   */
  updateObjective(
    playerId: string,
    questId: string,
    objectiveId: string,
    progress: number
  ): Promise<QuestObjective | null>;

  /**
   * Complete a quest for player
   * @param playerId - Player completing quest
   * @param questId - Quest to complete
   * @returns Rewards granted
   */
  completeQuest(
    playerId: string,
    questId: string
  ): Promise<{ success: boolean; rewards?: QuestReward[]; error?: string }>;

  /**
   * Abandon a quest
   * @param playerId - Player abandoning quest
   * @param questId - Quest to abandon
   * @returns Success status
   */
  abandonQuest(
    playerId: string,
    questId: string
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Get active quests for player
   * @param playerId - Player ID
   * @returns List of active quest progress
   */
  getActiveQuests(playerId: string): QuestProgress[];

  /**
   * Get completed quests for player
   * @param playerId - Player ID
   * @returns List of completed quest summaries
   */
  getCompletedQuests(playerId: string): QuestSummary[];

  /**
   * Get quest progress for player
   * @param playerId - Player ID
   * @param questId - Quest ID
   * @returns Quest progress or null
   */
  getQuestProgress(playerId: string, questId: string): QuestProgress | null;

  /**
   * Check if player can start quest
   * @param playerId - Player ID
   * @param questId - Quest ID
   * @returns Requirement checks
   */
  checkQuestRequirements(
    playerId: string,
    questId: string
  ): QuestRequirementCheck[];

  /**
   * Get available quests for player
   * @param playerId - Player ID
   * @returns List of available quest definitions
   */
  getAvailableQuests(playerId: string): QuestDefinition[];

  /**
   * Get quest definition
   * @param questId - Quest ID
   * @returns Quest definition or null
   */
  getQuestDefinition(questId: string): QuestDefinition | null;

  /**
   * Register quest definition
   * @param quest - Quest to register
   */
  registerQuest(quest: QuestDefinition): void;

  /**
   * Handle kill event for quest objectives
   * @param playerId - Player who killed
   * @param npcId - NPC that was killed
   */
  handleKill(playerId: string, npcId: string): void;

  /**
   * Handle item collection for quest objectives
   * @param playerId - Player who collected
   * @param itemId - Item that was collected
   * @param quantity - Quantity collected
   */
  handleItemCollected(
    playerId: string,
    itemId: string,
    quantity: number
  ): void;

  /**
   * Handle location reach for quest objectives
   * @param playerId - Player who reached location
   * @param locationId - Location ID
   * @param position - Player position
   */
  handleLocationReached(
    playerId: string,
    locationId: string,
    position: Position3D
  ): void;

  /**
   * Handle NPC interaction for quest objectives
   * @param playerId - Player who interacted
   * @param npcId - NPC that was interacted with
   * @param interactionType - Type of interaction
   */
  handleNpcInteraction(
    playerId: string,
    npcId: string,
    interactionType: string
  ): void;

  /**
   * Check if quest objective is complete
   * @param playerId - Player ID
   * @param questId - Quest ID
   * @param objectiveId - Objective ID
   * @returns True if complete
   */
  isObjectiveComplete(
    playerId: string,
    questId: string,
    objectiveId: string
  ): boolean;

  /**
   * Check if all quest objectives are complete
   * @param playerId - Player ID
   * @param questId - Quest ID
   * @returns True if all complete
   */
  areAllObjectivesComplete(playerId: string, questId: string): boolean;

  /**
   * Grant quest rewards to player
   * @param playerId - Player ID
   * @param rewards - Rewards to grant
   * @returns Success status
   */
  grantRewards(
    playerId: string,
    rewards: QuestReward[]
  ): Promise<{ success: boolean; error?: string }>;
}
```

---

## Network Protocol

### Request/Response Patterns

#### Pattern 1: Request-Response with Confirmation

```
Client                                Server
  |                                     |
  |---- DialogueStartRequest ---------->|
  |                                     | Validate request
  |                                     | Create session
  |<--- DialogueStarted ----------------|
  |                                     |
```

#### Pattern 2: Progressive Updates

```
Client                                Server
  |                                     |
  |---- DialogueResponseSelected ------>|
  |                                     | Process response
  |<--- DialogueResponseProcessed ------|
  |                                     | Execute action
  |<--- DialogueNodeDisplayed ----------| Show next node
  |                                     |
```

#### Pattern 3: Error Handling

```
Client                                Server
  |                                     |
  |---- QuestStartRequest ------------->|
  |                                     | Validate requirements
  |                                     | Requirements not met
  |<--- QuestRequirementsNotMet --------|
  |<--- QuestError ---------------------|
  |                                     |
```

### Validation Rules

#### Dialogue System Validation

1. **Distance Check**
   - Player must be within 5 units of NPC
   - Validated on dialogue start
   - Session ends if player moves too far

2. **Session Timeout**
   - Sessions expire after 5 minutes of inactivity
   - Automatic cleanup on server

3. **Response Validation**
   - Response ID must exist in current node
   - Response option must meet conditions
   - Session must be active

4. **Condition Checking**
   - Conditions evaluated server-side only
   - Client displays based on server response

#### Quest System Validation

1. **Requirement Validation**
   - All requirements checked before quest start
   - Level, quest completion, items, etc.
   - Detailed failure reasons returned

2. **Progress Validation**
   - Objective progress validated on update
   - Cannot exceed required progress
   - Duplicate updates handled gracefully

3. **Completion Validation**
   - All non-optional objectives must be complete
   - Quest must be in 'in_progress' state
   - Rewards inventory space checked

4. **Cooldown Validation**
   - Repeatable quest cooldowns enforced
   - Stored in database with completion time

---

## Error Handling

### Error Response Format

All error events follow this structure:

```typescript
interface ErrorEvent {
  playerId: string;
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;
}
```

### Dialogue Error Codes

| Code | Description | Recoverable | Client Action |
|------|-------------|-------------|---------------|
| `NPC_NOT_FOUND` | NPC doesn't exist | No | Show error message |
| `OUT_OF_RANGE` | Player too far | Yes | "Move closer" message |
| `DIALOGUE_NOT_FOUND` | Missing dialogue tree | No | Report bug |
| `INVALID_NODE` | Node doesn't exist | No | End dialogue |
| `INVALID_RESPONSE` | Invalid option selected | Yes | Refresh dialogue |
| `SESSION_NOT_FOUND` | Session missing | No | Restart dialogue |
| `SESSION_EXPIRED` | Session timed out | Yes | Restart dialogue |
| `ALREADY_IN_DIALOGUE` | Player busy | Yes | Wait/retry |
| `REQUIREMENTS_NOT_MET` | Can't access dialogue | Yes | Show requirements |
| `ACTION_FAILED` | Action couldn't execute | Varies | Show failure message |

### Quest Error Codes

| Code | Description | Recoverable | Client Action |
|------|-------------|-------------|---------------|
| `QUEST_NOT_FOUND` | Quest doesn't exist | No | Report bug |
| `ALREADY_ACTIVE` | Quest already started | No | Open quest log |
| `ALREADY_COMPLETED` | Can't repeat quest | No | Show message |
| `REQUIREMENTS_NOT_MET` | Can't start quest | Yes | Show requirements |
| `NOT_ACTIVE` | Quest not in progress | Yes | Check quest log |
| `INVALID_OBJECTIVE` | Objective doesn't exist | No | Report bug |
| `QUEST_FAILED` | Quest failed | Varies | Show failure reason |
| `ON_COOLDOWN` | Quest on cooldown | Yes | Show time remaining |
| `LIMIT_REACHED` | Max active quests | Yes | Complete/abandon quest |
| `INVENTORY_FULL` | Can't receive reward | Yes | Free inventory space |

---

## Usage Examples

### Example 1: Starting Dialogue

```typescript
// CLIENT: Player clicks "Talk" on NPC
eventBus.emit(EventType.DIALOGUE_START_REQUEST, {
  playerId: player.id,
  npcId: 'npc_quest_giver_001',
  playerPosition: player.position,
  context: 'quest'
});

// SERVER: Process request and respond
eventBus.on(EventType.DIALOGUE_START_REQUEST, async (event) => {
  const { playerId, npcId, playerPosition, context } = event.data;

  // Validate distance
  if (!isPlayerNearNpc(playerId, npcId, 5)) {
    eventBus.emit(EventType.DIALOGUE_ERROR, {
      playerId,
      npcId,
      sessionId: null,
      errorCode: DialogueErrorCode.OUT_OF_RANGE,
      message: 'You are too far from the NPC.',
    });
    return;
  }

  // Start dialogue
  const result = await dialogueManager.startDialogue(playerId, npcId, context);

  if (result.success) {
    const tree = dialogueManager.getDialogueTree(npcId, context);
    const initialNode = tree!.nodes.get(tree!.rootNodeId)!;

    eventBus.emit(EventType.DIALOGUE_STARTED, {
      playerId,
      npcId,
      npcName: getNpcName(npcId),
      dialogueTree: tree,
      initialNodeId: tree!.rootNodeId,
      startTime: Date.now(),
      sessionId: result.sessionId!,
    });

    eventBus.emit(EventType.DIALOGUE_NODE_DISPLAYED, {
      playerId,
      npcId,
      sessionId: result.sessionId!,
      node: initialNode,
      options: initialNode.options || [],
    });
  }
});

// CLIENT: Receive and display dialogue
eventBus.on(EventType.DIALOGUE_NODE_DISPLAYED, (event) => {
  const { node, options } = event.data;

  // Update UI with dialogue text and options
  uiManager.showDialogue({
    text: node.text,
    options: options.map(opt => ({
      text: opt.text,
      onClick: () => selectDialogueOption(opt.id)
    }))
  });
});
```

### Example 2: Starting a Quest

```typescript
// CLIENT: Player accepts quest from dialogue
function acceptQuest(questId: string) {
  eventBus.emit(EventType.QUEST_START_REQUEST, {
    playerId: player.id,
    questId: questId,
    npcId: currentNpcId,
    timestamp: Date.now(),
  });
}

// SERVER: Process quest start
eventBus.on(EventType.QUEST_START_REQUEST, async (event) => {
  const { playerId, questId, npcId } = event.data;

  // Check requirements
  const requirementChecks = questSystem.checkQuestRequirements(playerId, questId);
  const allMet = requirementChecks.every(check => check.met);

  if (!allMet) {
    eventBus.emit(EventType.QUEST_REQUIREMENTS_NOT_MET, {
      playerId,
      questId,
      missingRequirements: requirementChecks.filter(c => !c.met),
      message: 'You do not meet the requirements for this quest.',
    });
    return;
  }

  // Start quest
  const result = await questSystem.startQuest(playerId, questId);

  if (result.success) {
    const quest = questSystem.getQuestDefinition(questId)!;

    eventBus.emit(EventType.QUEST_STARTED, {
      playerId,
      questId,
      quest,
      progress: result.progress!,
      startTime: Date.now(),
    });

    // Send toast notification
    eventBus.emit(EventType.UI_TOAST, {
      message: `Quest Started: ${quest.name}`,
      type: 'info',
    });
  } else {
    eventBus.emit(EventType.QUEST_ERROR, {
      playerId,
      questId,
      errorCode: QuestErrorCode.INTERNAL_ERROR,
      message: result.error || 'Failed to start quest',
    });
  }
});

// CLIENT: Handle quest started
eventBus.on(EventType.QUEST_STARTED, (event) => {
  const { quest, progress } = event.data;

  // Update quest log UI
  questLogManager.addActiveQuest(progress);

  // Show quest notification
  notificationManager.showQuestNotification({
    title: 'New Quest',
    questName: quest.name,
    objectives: quest.objectives.map(obj => obj.description),
  });

  // Add quest markers to map
  quest.objectives.forEach(objective => {
    if (objective.mapMarker) {
      mapManager.addQuestMarker(objective.mapMarker, objective.description);
    }
  });
});
```

### Example 3: Updating Quest Progress

```typescript
// SERVER: Player kills an NPC
eventBus.on(EventType.COMBAT_KILL, (event) => {
  const { killerId, targetId } = event.data;

  // Update quest objectives
  questSystem.handleKill(killerId, targetId);
});

// Inside QuestSystem.handleKill()
handleKill(playerId: string, npcId: string): void {
  const activeQuests = this.getActiveQuests(playerId);

  for (const questProgress of activeQuests) {
    for (const objective of questProgress.objectives) {
      // Check if this objective tracks kills of this NPC
      if (
        objective.type === 'kill' &&
        objective.target.ids.includes(npcId) &&
        !objective.completed
      ) {
        // Increment kill count
        objective.currentProgress++;

        // Emit progress update
        this.eventBus.emit(EventType.QUEST_OBJECTIVE_KILL_PROGRESS, {
          playerId,
          questId: questProgress.questId,
          objectiveId: objective.id,
          targetNpcId: npcId,
          currentCount: objective.currentProgress,
          requiredCount: objective.requiredProgress,
          killedNpcId: npcId,
        });

        // Check if objective complete
        if (objective.currentProgress >= objective.requiredProgress) {
          objective.completed = true;

          this.eventBus.emit(EventType.QUEST_OBJECTIVE_UPDATED, {
            playerId,
            questId: questProgress.questId,
            objective,
            currentProgress: objective.currentProgress,
            completed: true,
            timestamp: Date.now(),
          });
        }

        // Check if all objectives complete
        if (this.areAllObjectivesComplete(playerId, questProgress.questId)) {
          if (this.getQuestDefinition(questProgress.questId)!.autoComplete) {
            this.completeQuest(playerId, questProgress.questId);
          } else {
            // Notify player to return to quest giver
            this.eventBus.emit(EventType.QUEST_PROGRESSED, {
              playerId,
              questId: questProgress.questId,
              progress: questProgress,
              completionPercentage: 100,
              timestamp: Date.now(),
            });
          }
        }
      }
    }
  }
}

// CLIENT: Handle objective progress
eventBus.on(EventType.QUEST_OBJECTIVE_KILL_PROGRESS, (event) => {
  const { questId, objectiveId, currentCount, requiredCount } = event.data;

  // Update quest tracker UI
  questTrackerUI.updateObjective(questId, objectiveId, {
    progress: `${currentCount}/${requiredCount}`,
    completed: currentCount >= requiredCount,
  });

  // Show progress notification
  if (currentCount >= requiredCount) {
    notificationManager.showToast({
      message: `Objective Complete!`,
      type: 'success',
    });
  }
});
```

### Example 4: Completing a Quest

```typescript
// CLIENT: Player returns to quest giver with all objectives done
function completeQuest(questId: string) {
  // Auto-complete quests complete when objectives are done
  // Manual-complete quests require talking to NPC again

  // This is typically triggered through dialogue action
  // The dialogue action will call the server method
}

// SERVER: Complete quest (called from dialogue action or auto-complete)
async completeQuest(playerId: string, questId: string): Promise<{
  success: boolean;
  rewards?: QuestReward[];
  error?: string;
}> {
  const progress = this.getQuestProgress(playerId, questId);

  if (!progress || progress.status !== 'in_progress') {
    return { success: false, error: 'Quest not active' };
  }

  if (!this.areAllObjectivesComplete(playerId, questId)) {
    return { success: false, error: 'Objectives not complete' };
  }

  const quest = this.getQuestDefinition(questId)!;

  // Grant rewards
  const rewardResult = await this.grantRewards(playerId, quest.rewards);

  if (!rewardResult.success) {
    return { success: false, error: rewardResult.error };
  }

  // Mark quest complete
  progress.status = 'completed';
  progress.completionTime = Date.now();

  // Save to database
  await this.saveQuestProgress(playerId, progress);

  // Emit completion event
  this.eventBus.emit(EventType.QUEST_COMPLETED, {
    playerId,
    questId,
    quest,
    rewards: quest.rewards,
    completionTime: progress.completionTime!,
    duration: progress.completionTime! - progress.startTime!,
  });

  return { success: true, rewards: quest.rewards };
}

// CLIENT: Handle quest completion
eventBus.on(EventType.QUEST_COMPLETED, (event) => {
  const { quest, rewards, duration } = event.data;

  // Show completion UI
  questCompletionUI.show({
    questName: quest.name,
    rewards: rewards,
    completionTime: formatDuration(duration),
  });

  // Play fanfare
  audioManager.play('quest_complete');

  // Update quest log
  questLogManager.moveToCompleted(quest.id);

  // Remove quest markers
  mapManager.removeQuestMarkers(quest.id);

  // Check for follow-up quest
  if (quest.followupQuestId) {
    setTimeout(() => {
      notificationManager.showToast({
        message: 'New quest available!',
        type: 'info',
      });
    }, 2000);
  }
});
```

---

## Event Map Additions

Add the following to `EventMap` interface in `/packages/shared/src/types/events.ts`:

```typescript
export interface EventMap {
  // ... existing events ...

  // Dialogue Events
  [EventType.DIALOGUE_START_REQUEST]: DialogueStartRequestEvent;
  [EventType.DIALOGUE_STARTED]: DialogueStartedEvent;
  [EventType.DIALOGUE_NODE_DISPLAYED]: DialogueNodeDisplayedEvent;
  [EventType.DIALOGUE_RESPONSE_SELECTED]: DialogueResponseSelectedEvent;
  [EventType.DIALOGUE_RESPONSE_PROCESSED]: DialogueResponseProcessedEvent;
  [EventType.DIALOGUE_END_REQUEST]: DialogueEndRequestEvent;
  [EventType.DIALOGUE_ENDED]: DialogueEndedEvent;
  [EventType.DIALOGUE_ERROR]: DialogueErrorEvent;

  // Quest Events
  [EventType.QUEST_AVAILABLE]: QuestAvailableEvent;
  [EventType.QUEST_START_REQUEST]: QuestStartRequestEvent;
  [EventType.QUEST_STARTED]: QuestStartedEvent;
  [EventType.QUEST_OBJECTIVE_UPDATED]: QuestObjectiveUpdatedEvent;
  [EventType.QUEST_PROGRESSED]: QuestProgressedEvent;
  [EventType.QUEST_ABANDON_REQUEST]: QuestAbandonRequestEvent;
  [EventType.QUEST_ABANDONED]: QuestAbandonedEvent;
  [EventType.QUEST_COMPLETED]: QuestCompletedEvent;
  [EventType.QUEST_FAILED]: QuestFailedEvent;
  [EventType.QUEST_INFO_REQUEST]: QuestInfoRequestEvent;
  [EventType.QUEST_INFO_RESPONSE]: QuestInfoResponseEvent;
  [EventType.QUEST_LIST_REQUEST]: QuestListRequestEvent;
  [EventType.QUEST_LIST_RESPONSE]: QuestListResponseEvent;
  [EventType.QUEST_ERROR]: QuestErrorEvent;
  [EventType.QUEST_REQUIREMENTS_NOT_MET]: QuestRequirementsNotMetEvent;

  // Quest Objective Events
  [EventType.QUEST_OBJECTIVE_KILL_PROGRESS]: QuestObjectiveKillProgressEvent;
  [EventType.QUEST_OBJECTIVE_COLLECT_PROGRESS]: QuestObjectiveCollectProgressEvent;
  [EventType.QUEST_OBJECTIVE_INTERACT_PROGRESS]: QuestObjectiveInteractProgressEvent;
  [EventType.QUEST_OBJECTIVE_LOCATION_PROGRESS]: QuestObjectiveLocationProgressEvent;
}
```

---

## Database Schema Extensions

### Dialogue Tables

```sql
-- Dialogue session state (in-memory on server, optional persistence)
CREATE TABLE IF NOT EXISTS dialogue_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL UNIQUE,
  playerId TEXT NOT NULL,
  npcId TEXT NOT NULL,
  treeId TEXT NOT NULL,
  currentNodeId TEXT NOT NULL,
  startTime INTEGER NOT NULL,
  lastActivity INTEGER NOT NULL,
  variables TEXT, -- JSON
  history TEXT, -- JSON array
  FOREIGN KEY (playerId) REFERENCES players(playerId)
);

-- Dialogue history (optional analytics)
CREATE TABLE IF NOT EXISTS dialogue_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playerId TEXT NOT NULL,
  npcId TEXT NOT NULL,
  treeId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  startTime INTEGER NOT NULL,
  endTime INTEGER NOT NULL,
  nodesVisited TEXT, -- JSON array
  actionsExecuted TEXT, -- JSON array
  FOREIGN KEY (playerId) REFERENCES players(playerId)
);
```

### Quest Tables (Enhancement)

```sql
-- Extend existing quest_progress table
ALTER TABLE quest_progress ADD COLUMN completionPercentage INTEGER DEFAULT 0;
ALTER TABLE quest_progress ADD COLUMN data TEXT; -- JSON for quest-specific data
ALTER TABLE quest_progress ADD COLUMN lastUpdateTime INTEGER;

-- Quest objective progress (new table)
CREATE TABLE IF NOT EXISTS quest_objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playerId TEXT NOT NULL,
  questId TEXT NOT NULL,
  objectiveId TEXT NOT NULL,
  currentProgress INTEGER DEFAULT 0,
  requiredProgress INTEGER NOT NULL,
  completed INTEGER DEFAULT 0, -- SQLite boolean
  lastUpdate INTEGER NOT NULL,
  data TEXT, -- JSON for objective-specific data
  FOREIGN KEY (playerId) REFERENCES players(playerId),
  UNIQUE(playerId, questId, objectiveId)
);

-- Quest cooldowns (for repeatable quests)
CREATE TABLE IF NOT EXISTS quest_cooldowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playerId TEXT NOT NULL,
  questId TEXT NOT NULL,
  completionTime INTEGER NOT NULL,
  availableAgainTime INTEGER NOT NULL,
  FOREIGN KEY (playerId) REFERENCES players(playerId),
  UNIQUE(playerId, questId)
);
```

---

## REST API Endpoints (Optional)

If REST APIs are desired for external integrations:

```typescript
// Quest Endpoints
GET    /api/quests                    - List all quests
GET    /api/quests/:questId           - Get quest details
GET    /api/quests/player/:playerId   - Get player's quests
POST   /api/quests/:questId/start     - Start quest (requires auth)
POST   /api/quests/:questId/abandon   - Abandon quest (requires auth)
GET    /api/quests/:questId/progress  - Get quest progress (requires auth)

// Dialogue Endpoints
GET    /api/dialogue/:npcId           - Get NPC dialogue tree
GET    /api/dialogue/:npcId/context/:context - Get filtered dialogue tree
```

Example REST handler:

```typescript
// Express-style REST endpoint
app.get('/api/quests/:questId', (req, res) => {
  const { questId } = req.params;
  const quest = questSystem.getQuestDefinition(questId);

  if (!quest) {
    res.status(404).json({
      error: 'QUEST_NOT_FOUND',
      message: 'Quest not found',
    });
    return;
  }

  res.json({
    quest: {
      id: quest.id,
      name: quest.name,
      description: quest.description,
      category: quest.category,
      recommendedLevel: quest.recommendedLevel,
      difficulty: quest.difficulty,
      objectives: quest.objectives.map(obj => ({
        id: obj.id,
        type: obj.type,
        description: obj.description,
        optional: obj.optional,
      })),
      rewards: quest.rewards.map(reward => ({
        type: reward.type,
        description: reward.description,
      })),
    },
  });
});
```

---

## Implementation Checklist

### Phase 1: Type Definitions
- [ ] Add new `EventType` enum values
- [ ] Define all event payload interfaces
- [ ] Define data structure interfaces
- [ ] Update `EventMap` with new events
- [ ] Add to `/packages/shared/src/types/events.ts`

### Phase 2: Dialogue System
- [ ] Implement `DialogueStateManager` class
- [ ] Create dialogue tree loader/parser
- [ ] Implement condition checking system
- [ ] Implement action execution system
- [ ] Add dialogue event handlers
- [ ] Create dialogue UI components
- [ ] Write dialogue system tests

### Phase 3: Quest System
- [ ] Implement `QuestSystem` class
- [ ] Create quest definition loader
- [ ] Implement quest requirement validation
- [ ] Implement objective tracking
- [ ] Add quest event handlers
- [ ] Create quest UI components
- [ ] Write quest system tests

### Phase 4: Integration
- [ ] Connect dialogue to quest system
- [ ] Add database persistence
- [ ] Implement cooldown system
- [ ] Add quest markers to map
- [ ] Create notification system
- [ ] Write integration tests

### Phase 5: Content
- [ ] Create starter dialogue trees
- [ ] Create starter quest definitions
- [ ] Define quest rewards
- [ ] Write NPC dialogues
- [ ] Test with real content

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-05 | Initial API specification |

---

**End of Specification**
