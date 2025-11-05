# Quest & Dialogue API - Quick Reference

**Version:** 1.0.0
**Last Updated:** 2025-11-05

> Complete API specifications available in: [npc-dialogue-quest-api.md](./npc-dialogue-quest-api.md)

## Overview

This document provides quick reference tables for the NPC Dialogue and Quest System APIs in Hyperscape.

---

## Event Types Summary

### Dialogue Events

| Event Type | Direction | Purpose | Payload Type |
|------------|-----------|---------|--------------|
| `DIALOGUE_START_REQUEST` | Client → Server | Request to start dialogue | `DialogueStartRequestEvent` |
| `DIALOGUE_STARTED` | Server → Client | Dialogue session started | `DialogueStartedEvent` |
| `DIALOGUE_NODE_DISPLAYED` | Server → Client | Show dialogue node | `DialogueNodeDisplayedEvent` |
| `DIALOGUE_RESPONSE_SELECTED` | Client → Server | Player selects response | `DialogueResponseSelectedEvent` |
| `DIALOGUE_RESPONSE_PROCESSED` | Server → Client | Response processed | `DialogueResponseProcessedEvent` |
| `DIALOGUE_END_REQUEST` | Client → Server | Request to end dialogue | `DialogueEndRequestEvent` |
| `DIALOGUE_ENDED` | Server → Client | Dialogue session ended | `DialogueEndedEvent` |
| `DIALOGUE_ERROR` | Server → Client | Dialogue error | `DialogueErrorEvent` |

### Quest Events

| Event Type | Direction | Purpose | Payload Type |
|------------|-----------|---------|--------------|
| `QUEST_AVAILABLE` | Server → Client | Quest is available | `QuestAvailableEvent` |
| `QUEST_START_REQUEST` | Client → Server | Request to start quest | `QuestStartRequestEvent` |
| `QUEST_STARTED` | Server → Client | Quest started | `QuestStartedEvent` |
| `QUEST_OBJECTIVE_UPDATED` | Server → Client | Objective progress | `QuestObjectiveUpdatedEvent` |
| `QUEST_PROGRESSED` | Server → Client | Overall progress | `QuestProgressedEvent` |
| `QUEST_ABANDON_REQUEST` | Client → Server | Request to abandon | `QuestAbandonRequestEvent` |
| `QUEST_ABANDONED` | Server → Client | Quest abandoned | `QuestAbandonedEvent` |
| `QUEST_COMPLETED` | Server → Client | Quest completed | `QuestCompletedEvent` |
| `QUEST_FAILED` | Server → Client | Quest failed | `QuestFailedEvent` |
| `QUEST_INFO_REQUEST` | Client → Server | Request quest details | `QuestInfoRequestEvent` |
| `QUEST_INFO_RESPONSE` | Server → Client | Quest details | `QuestInfoResponseEvent` |
| `QUEST_LIST_REQUEST` | Client → Server | Request quest list | `QuestListRequestEvent` |
| `QUEST_LIST_RESPONSE` | Server → Client | Quest list | `QuestListResponseEvent` |
| `QUEST_ERROR` | Server → Client | Quest error | `QuestErrorEvent` |
| `QUEST_REQUIREMENTS_NOT_MET` | Server → Client | Requirements not met | `QuestRequirementsNotMetEvent` |

### Quest Objective Events

| Event Type | Direction | Purpose | Payload Type |
|------------|-----------|---------|--------------|
| `QUEST_OBJECTIVE_KILL_PROGRESS` | Server → Client | Kill objective update | `QuestObjectiveKillProgressEvent` |
| `QUEST_OBJECTIVE_COLLECT_PROGRESS` | Server → Client | Collection update | `QuestObjectiveCollectProgressEvent` |
| `QUEST_OBJECTIVE_INTERACT_PROGRESS` | Server → Client | Interaction update | `QuestObjectiveInteractProgressEvent` |
| `QUEST_OBJECTIVE_LOCATION_PROGRESS` | Server → Client | Location update | `QuestObjectiveLocationProgressEvent` |

---

## Core Data Structures

### Dialogue System

```typescript
DialogueTree         // Complete dialogue structure for NPC
DialogueNode         // Single dialogue entry with text and options
DialogueOption       // Player response choice
DialogueCondition    // Condition check before showing node/option
DialogueAction       // Action to execute (start quest, give item, etc.)
DialogueSession      // Active dialogue session state (server-side)
```

### Quest System

```typescript
QuestDefinition      // Complete quest structure
QuestObjective       // Single objective within quest
QuestProgress        // Player's progress on a quest
QuestRequirement     // Requirement to start quest
QuestReward          // Reward for completing quest
QuestSummary         // Brief quest information
```

---

## Quest Categories

| Category | Description | Use Case |
|----------|-------------|----------|
| `main_story` | Main storyline quests | Critical narrative progression |
| `side_quest` | Side quests | Optional content, world building |
| `daily` | Daily repeatable quests | Daily activities, engagement |
| `weekly` | Weekly repeatable quests | Weekly challenges |
| `tutorial` | Tutorial/learning quests | New player onboarding |
| `bounty` | Bounty/hunting quests | Kill X enemies for reward |
| `collection` | Collection/gathering quests | Gather X items |
| `exploration` | Exploration/discovery quests | Discover locations |
| `crafting` | Crafting-related quests | Craft specific items |
| `combat` | Combat-focused quests | Combat challenges |
| `social` | Social/interaction quests | Multiplayer interactions |

---

## Quest Objective Types

| Type | Description | Parameters | Example |
|------|-------------|------------|---------|
| `kill` | Kill X enemies | `targetNpcId`, `count` | "Kill 10 Goblins" |
| `collect` | Collect X items | `itemId`, `quantity` | "Collect 5 Bear Pelts" |
| `interact` | Interact with object/NPC | `targetId`, `interactionType` | "Talk to the Blacksmith" |
| `reach_location` | Travel to location | `locationId`, `position` | "Reach the Ancient Ruins" |
| `escort` | Escort NPC safely | `npcId`, `destination` | "Escort merchant to town" |
| `defend` | Defend location/NPC | `targetId`, `duration` | "Defend village for 5 minutes" |
| `craft` | Craft X items | `itemId`, `quantity` | "Craft 3 Iron Swords" |
| `gather` | Gather X resources | `resourceType`, `quantity` | "Gather 10 Oak Logs" |
| `deliver` | Deliver item to NPC | `itemId`, `targetNpcId` | "Deliver letter to Mayor" |
| `explore` | Discover area | `areaId` | "Discover the Lost Cave" |
| `use_item` | Use specific item | `itemId`, `targetId` | "Use torch on altar" |
| `talk_to` | Talk to NPC | `npcId` | "Speak with the Elder" |
| `wait` | Wait for time/event | `duration` or `eventId` | "Wait until nightfall" |
| `custom` | Custom objective logic | Custom params | Any custom logic |

---

## Quest Status Flow

```
not_started → available → in_progress → completed
                              ↓
                          abandoned
                              ↓
                           failed
```

| Status | Description | Can Start? | Can Abandon? |
|--------|-------------|-----------|-------------|
| `not_started` | Player hasn't started | No | No |
| `available` | Requirements met | Yes | No |
| `in_progress` | Quest active | No | Yes |
| `completed` | Quest finished | No | No |
| `failed` | Quest failed | Depends | No |
| `abandoned` | Player abandoned | Depends | No |

---

## Dialogue Action Types

| Action Type | Description | Parameters | Result |
|-------------|-------------|------------|--------|
| `start_quest` | Start a quest | `questId` | Quest started or error |
| `complete_quest` | Complete quest | `questId` | Quest completed, rewards |
| `give_item` | Give item to player | `itemId`, `quantity` | Item added to inventory |
| `take_item` | Take item from player | `itemId`, `quantity` | Item removed |
| `set_flag` | Set persistent flag | `flagName`, `value` | Flag stored |
| `open_shop` | Open shop interface | `shopId` | Shop UI opened |
| `teleport` | Teleport player | `destination` | Player teleported |
| `custom` | Custom action | Custom params | Custom result |

---

## Dialogue Condition Types

| Condition Type | Description | Parameters | Example |
|----------------|-------------|------------|---------|
| `quest_status` | Check quest status | `questId`, `status` | Quest "main_001" is "completed" |
| `item_owned` | Check if player has item | `itemId`, `quantity` | Player has 5 "iron_ore" |
| `skill_level` | Check skill level | `skill`, `level` | Player's Mining ≥ 30 |
| `flag_set` | Check persistent flag | `flagName`, `value` | Flag "talked_to_mayor" = true |
| `custom` | Custom condition | Custom params | Custom logic |

---

## Error Codes

### Dialogue Errors

| Code | Description | Recoverable | Client Action |
|------|-------------|-------------|---------------|
| `NPC_NOT_FOUND` | NPC doesn't exist | ❌ No | Show error |
| `OUT_OF_RANGE` | Player too far | ✅ Yes | "Move closer" |
| `DIALOGUE_NOT_FOUND` | Missing dialogue tree | ❌ No | Report bug |
| `INVALID_NODE` | Node doesn't exist | ❌ No | End dialogue |
| `INVALID_RESPONSE` | Invalid option | ✅ Yes | Refresh |
| `SESSION_NOT_FOUND` | Session missing | ❌ No | Restart |
| `SESSION_EXPIRED` | Session timeout | ✅ Yes | Restart |
| `ALREADY_IN_DIALOGUE` | Player busy | ✅ Yes | Wait |
| `REQUIREMENTS_NOT_MET` | Can't access | ✅ Yes | Show requirements |
| `ACTION_FAILED` | Action failed | Varies | Show message |

### Quest Errors

| Code | Description | Recoverable | Client Action |
|------|-------------|-------------|---------------|
| `QUEST_NOT_FOUND` | Quest doesn't exist | ❌ No | Report bug |
| `ALREADY_ACTIVE` | Already started | ❌ No | Open quest log |
| `ALREADY_COMPLETED` | Can't repeat | ❌ No | Show message |
| `REQUIREMENTS_NOT_MET` | Can't start | ✅ Yes | Show requirements |
| `NOT_ACTIVE` | Not in progress | ✅ Yes | Check quest log |
| `INVALID_OBJECTIVE` | Bad objective | ❌ No | Report bug |
| `QUEST_FAILED` | Quest failed | Varies | Show reason |
| `ON_COOLDOWN` | Quest cooldown | ✅ Yes | Show time |
| `LIMIT_REACHED` | Max quests | ✅ Yes | Complete/abandon |
| `INVENTORY_FULL` | Can't receive | ✅ Yes | Free space |

---

## System Methods Quick Reference

### DialogueStateManager

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `startDialogue()` | `playerId`, `npcId`, `context?` | `Promise<Result>` | Start dialogue session |
| `processResponse()` | `playerId`, `sessionId`, `responseId` | `Promise<Result>` | Process player response |
| `endDialogue()` | `playerId`, `sessionId`, `reason` | `Promise<void>` | End dialogue session |
| `getCurrentNode()` | `sessionId` | `DialogueNode \| null` | Get current node |
| `getActiveSession()` | `playerId` | `DialogueSession \| null` | Get player's session |
| `isInDialogue()` | `playerId` | `boolean` | Check if in dialogue |
| `checkCondition()` | `playerId`, `condition` | `boolean` | Validate condition |
| `executeAction()` | `playerId`, `action` | `Promise<Result>` | Execute action |
| `getDialogueTree()` | `npcId`, `context?` | `DialogueTree \| null` | Get dialogue tree |

### QuestSystem

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `startQuest()` | `playerId`, `questId` | `Promise<Result>` | Start quest |
| `updateObjective()` | `playerId`, `questId`, `objectiveId`, `progress` | `Promise<Objective>` | Update objective |
| `completeQuest()` | `playerId`, `questId` | `Promise<Result>` | Complete quest |
| `abandonQuest()` | `playerId`, `questId` | `Promise<Result>` | Abandon quest |
| `getActiveQuests()` | `playerId` | `QuestProgress[]` | Get active quests |
| `getQuestProgress()` | `playerId`, `questId` | `QuestProgress \| null` | Get progress |
| `checkQuestRequirements()` | `playerId`, `questId` | `RequirementCheck[]` | Check requirements |
| `getAvailableQuests()` | `playerId` | `QuestDefinition[]` | Get available |
| `handleKill()` | `playerId`, `npcId` | `void` | Handle kill event |
| `handleItemCollected()` | `playerId`, `itemId`, `quantity` | `void` | Handle collection |
| `handleLocationReached()` | `playerId`, `locationId`, `position` | `void` | Handle location |
| `handleNpcInteraction()` | `playerId`, `npcId`, `interactionType` | `void` | Handle interaction |

---

## Validation Rules

### Dialogue Validation

| Rule | Value | When Checked |
|------|-------|--------------|
| Max Distance | 5 units | Start dialogue, every tick |
| Session Timeout | 5 minutes | Background cleanup |
| Response Validity | Must exist | Response selection |
| Condition Check | Server-only | Node/option display |

### Quest Validation

| Rule | When Checked | Action on Fail |
|------|--------------|----------------|
| Requirements | Quest start | Return error + details |
| Active Quest Limit | Quest start | Return error |
| Objective Progress | Progress update | Clamp to max |
| Completion Check | Quest complete | Verify all objectives |
| Inventory Space | Reward grant | Return error |
| Cooldown | Quest start (repeatable) | Return time remaining |

---

## Database Tables

### Dialogue Tables

```sql
-- Optional: Persist dialogue sessions
dialogue_sessions (
  id INTEGER PRIMARY KEY,
  sessionId TEXT UNIQUE,
  playerId TEXT,
  npcId TEXT,
  treeId TEXT,
  currentNodeId TEXT,
  startTime INTEGER,
  lastActivity INTEGER,
  variables TEXT, -- JSON
  history TEXT    -- JSON
)

-- Optional: Dialogue history analytics
dialogue_history (
  id INTEGER PRIMARY KEY,
  playerId TEXT,
  npcId TEXT,
  treeId TEXT,
  sessionId TEXT,
  startTime INTEGER,
  endTime INTEGER,
  nodesVisited TEXT,  -- JSON
  actionsExecuted TEXT -- JSON
)
```

### Quest Tables

```sql
-- Quest progress (existing, enhanced)
quest_progress (
  id INTEGER PRIMARY KEY,
  playerId TEXT,
  questId TEXT,
  status TEXT,
  progress TEXT, -- JSON
  startTime INTEGER,
  completionTime INTEGER,
  completionPercentage INTEGER,
  data TEXT, -- JSON
  lastUpdateTime INTEGER
)

-- Quest objectives (new)
quest_objectives (
  id INTEGER PRIMARY KEY,
  playerId TEXT,
  questId TEXT,
  objectiveId TEXT,
  currentProgress INTEGER,
  requiredProgress INTEGER,
  completed INTEGER, -- 0 or 1
  lastUpdate INTEGER,
  data TEXT, -- JSON
  UNIQUE(playerId, questId, objectiveId)
)

-- Quest cooldowns (new)
quest_cooldowns (
  id INTEGER PRIMARY KEY,
  playerId TEXT,
  questId TEXT,
  completionTime INTEGER,
  availableAgainTime INTEGER,
  UNIQUE(playerId, questId)
)
```

---

## Implementation Priority

### Phase 1: Core Types ✅
- [x] Event type definitions
- [x] Payload interfaces
- [x] Data structures
- [x] Error codes

### Phase 2: Dialogue System
- [ ] DialogueStateManager class
- [ ] Dialogue tree loader
- [ ] Condition checking
- [ ] Action execution
- [ ] Event handlers
- [ ] UI components

### Phase 3: Quest System
- [ ] QuestSystem class
- [ ] Quest definition loader
- [ ] Requirement validation
- [ ] Objective tracking
- [ ] Event handlers
- [ ] UI components

### Phase 4: Integration
- [ ] Dialogue → Quest connection
- [ ] Database persistence
- [ ] Cooldown system
- [ ] Map markers
- [ ] Notifications

### Phase 5: Content
- [ ] Starter dialogues
- [ ] Starter quests
- [ ] Reward definitions
- [ ] Testing

---

## Common Patterns

### Pattern 1: Start Quest from Dialogue

```typescript
// In DialogueAction
{
  type: 'start_quest',
  params: { questId: 'tutorial_001' }
}

// Server processes action
DialogueAction → QuestSystem.startQuest() → QUEST_STARTED event
```

### Pattern 2: Kill Quest Objective

```typescript
// Player kills mob
COMBAT_KILL event → QuestSystem.handleKill() →
  Check active quests →
  Update kill objectives →
  QUEST_OBJECTIVE_KILL_PROGRESS event →
  (if complete) QUEST_OBJECTIVE_UPDATED event
```

### Pattern 3: Quest Chain

```typescript
// Quest definition
{
  id: 'quest_002',
  prerequisiteQuestId: 'quest_001',
  followupQuestId: 'quest_003'
}

// On quest_001 completion
QUEST_COMPLETED → Check followup → QUEST_AVAILABLE (quest_002)
```

### Pattern 4: Conditional Dialogue

```typescript
// DialogueNode with condition
{
  id: 'node_reward',
  condition: {
    type: 'quest_status',
    params: { questId: 'main_001', status: 'completed' }
  }
}

// Server checks condition before displaying
if (checkCondition(playerId, node.condition)) {
  emit DIALOGUE_NODE_DISPLAYED
}
```

---

## Testing Checklist

### Dialogue System Tests
- [ ] Start dialogue within range
- [ ] Reject dialogue out of range
- [ ] Process valid response
- [ ] Reject invalid response
- [ ] Session timeout
- [ ] Condition checking
- [ ] Action execution
- [ ] Multiple concurrent sessions

### Quest System Tests
- [ ] Start quest with requirements met
- [ ] Reject quest with unmet requirements
- [ ] Update kill objective
- [ ] Update collection objective
- [ ] Complete all objectives
- [ ] Complete quest
- [ ] Abandon quest
- [ ] Quest cooldown
- [ ] Quest chains
- [ ] Reward granting

---

## Quick Start Guide

### 1. Add Event Types
```typescript
// Add to EventType enum in events.ts
DIALOGUE_START_REQUEST = 'dialogue:start_request',
QUEST_START_REQUEST = 'quest:start_request',
// ... etc
```

### 2. Add to EventMap
```typescript
// Add to EventMap interface
[EventType.DIALOGUE_START_REQUEST]: DialogueStartRequestEvent;
[EventType.QUEST_START_REQUEST]: QuestStartRequestEvent;
// ... etc
```

### 3. Import Types
```typescript
import {
  DialogueTree,
  DialogueNode,
  QuestDefinition,
  QuestObjective,
  // ... etc
} from '@/types/quest-dialogue-types';
```

### 4. Create System Instances
```typescript
const dialogueManager = new DialogueStateManager(eventBus);
const questSystem = new QuestSystem(world, eventBus);
```

### 5. Register Content
```typescript
// Register dialogue trees
dialogueManager.registerDialogueTree(tutorialDialogue);

// Register quests
questSystem.registerQuest(tutorialQuest);
```

### 6. Handle Events
```typescript
// Client
eventBus.on(EventType.DIALOGUE_STARTED, handleDialogueStarted);
eventBus.on(EventType.QUEST_STARTED, handleQuestStarted);

// Server
eventBus.on(EventType.DIALOGUE_START_REQUEST, handleDialogueStartRequest);
eventBus.on(EventType.QUEST_START_REQUEST, handleQuestStartRequest);
```

---

**For complete API documentation, see:** [npc-dialogue-quest-api.md](./npc-dialogue-quest-api.md)

**For type definitions, see:** `/packages/shared/src/types/quest-dialogue-types.ts`
