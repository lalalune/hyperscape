# Quest & Dialogue System Architecture

**Version:** 1.0.0
**Last Updated:** 2025-11-05

## System Overview

This document describes the architecture and data flow for the NPC Dialogue and Quest systems in Hyperscape.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT SIDE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────┐      ┌──────────────────┐      ┌────────────────┐│
│  │   Dialogue UI    │      │    Quest UI      │      │   Map System   ││
│  │  - Chat Window   │      │  - Quest Log     │      │  - Markers     ││
│  │  - NPC Portrait  │      │  - Quest Tracker │      │  - Objectives  ││
│  │  - Response Btns │      │  - Objectives    │      │                ││
│  └────────┬─────────┘      └────────┬─────────┘      └───────┬────────┘│
│           │                         │                         │         │
│           └─────────────┬───────────┴─────────────────────────┘         │
│                         │                                               │
│                  ┌──────▼──────────┐                                    │
│                  │   Event Bus     │                                    │
│                  │   (Client)      │                                    │
│                  └──────┬──────────┘                                    │
│                         │                                               │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │ Network Events
                          │ (WebSocket/HTTP)
┌─────────────────────────▼───────────────────────────────────────────────┐
│                         SERVER SIDE                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                  ┌──────────────────┐                                    │
│                  │   Event Bus      │                                    │
│                  │   (Server)       │                                    │
│                  └──────┬───────────┘                                    │
│                         │                                               │
│        ┌────────────────┼────────────────┐                              │
│        │                │                │                              │
│  ┌─────▼─────────┐  ┌──▼───────────┐  ┌─▼────────────┐                │
│  │  Dialogue     │  │  Quest       │  │  Other       │                │
│  │  State        │  │  System      │  │  Systems     │                │
│  │  Manager      │  │              │  │  - Combat    │                │
│  └───────┬───────┘  └──────┬───────┘  │  - Inventory │                │
│          │                 │           │  - Player    │                │
│          │                 │           └──────────────┘                │
│          │                 │                                            │
│  ┌───────▼────────┐  ┌─────▼──────────┐                                │
│  │  Dialogue      │  │  Quest         │                                │
│  │  Trees         │  │  Definitions   │                                │
│  │  (JSON/DB)     │  │  (JSON/DB)     │                                │
│  └───────┬────────┘  └─────┬──────────┘                                │
│          │                 │                                            │
│          └─────────┬───────┘                                            │
│                    │                                                    │
│            ┌───────▼──────────┐                                         │
│            │    Database      │                                         │
│            │  - Players       │                                         │
│            │  - Quest Progress│                                         │
│            │  - Objectives    │                                         │
│            │  - Dialogue State│                                         │
│            └──────────────────┘                                         │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Dialogue Flow

```
Player Interaction Flow:

1. PLAYER CLICKS "TALK" ON NPC
   │
   ├─► Client: Emit DIALOGUE_START_REQUEST
   │   {
   │     playerId: "player_123",
   │     npcId: "npc_quest_giver",
   │     playerPosition: { x, y, z }
   │   }
   │
   ▼
2. SERVER RECEIVES REQUEST
   │
   ├─► Validate player distance to NPC (< 5 units)
   ├─► Check if player already in dialogue
   ├─► Get dialogue tree for NPC
   ├─► Create dialogue session
   │
   ▼
3. SERVER SENDS DIALOGUE DATA
   │
   ├─► Emit DIALOGUE_STARTED
   │   {
   │     sessionId: "session_abc",
   │     dialogueTree: { ... },
   │     initialNodeId: "greeting"
   │   }
   │
   ├─► Emit DIALOGUE_NODE_DISPLAYED
   │   {
   │     node: { text: "Hello adventurer!", ... },
   │     options: [
   │       { id: "1", text: "Hello!" },
   │       { id: "2", text: "Goodbye" }
   │     ]
   │   }
   │
   ▼
4. CLIENT DISPLAYS DIALOGUE
   │
   ├─► Show dialogue window
   ├─► Render NPC portrait
   ├─► Display dialogue text
   ├─► Show response buttons
   │
   ▼
5. PLAYER SELECTS RESPONSE
   │
   ├─► Client: Emit DIALOGUE_RESPONSE_SELECTED
   │   {
   │     sessionId: "session_abc",
   │     responseId: "1",
   │     currentNodeId: "greeting"
   │   }
   │
   ▼
6. SERVER PROCESSES RESPONSE
   │
   ├─► Validate session exists
   ├─► Validate response is valid for current node
   ├─► Get next node from selected option
   ├─► Execute any action (if present)
   │   └─► e.g., Start quest, give item, etc.
   │
   ├─► Emit DIALOGUE_RESPONSE_PROCESSED
   │   {
   │     nextNodeId: "quest_offer",
   │     actionResult: { success: true }
   │   }
   │
   ├─► Emit DIALOGUE_NODE_DISPLAYED (next node)
   │
   ▼
7. REPEAT STEPS 4-6 UNTIL DIALOGUE ENDS
   │
   ▼
8. DIALOGUE ENDS
   │
   ├─► Server: Emit DIALOGUE_ENDED
   ├─► Client: Close dialogue window
   ├─► Server: Cleanup session
```

---

### Quest Flow

```
Quest Lifecycle:

1. QUEST BECOMES AVAILABLE
   │
   ├─► Player meets requirements (level, prerequisites, etc.)
   ├─► Server: Emit QUEST_AVAILABLE
   │   {
   │     quest: { id: "quest_001", ... },
   │     requirementsMet: true
   │   }
   ├─► Client: Show quest icon on NPC
   │
   ▼
2. PLAYER ACCEPTS QUEST
   │
   ├─► Through dialogue action OR direct accept
   ├─► Client: Emit QUEST_START_REQUEST
   │   {
   │     playerId: "player_123",
   │     questId: "quest_001"
   │   }
   │
   ▼
3. SERVER STARTS QUEST
   │
   ├─► Validate requirements again
   ├─► Create quest progress entry
   ├─► Initialize all objectives
   ├─► Save to database
   │
   ├─► Emit QUEST_STARTED
   │   {
   │     quest: { ... },
   │     progress: {
   │       objectives: [
   │         { id: "kill_goblins", current: 0, required: 10 }
   │       ]
   │     }
   │   }
   │
   ▼
4. CLIENT DISPLAYS QUEST
   │
   ├─► Add to quest log
   ├─► Show quest tracker
   ├─► Add map markers for objectives
   ├─► Show notification
   │
   ▼
5. PLAYER PROGRESSES QUEST
   │
   ├─► [Example: Kill Objective]
   │   │
   │   ├─► Player kills goblin
   │   ├─► Combat system: Emit COMBAT_KILL
   │   ├─► Quest system: handleKill()
   │   │   └─► Check active quests
   │   │   └─► Find kill objectives matching "goblin"
   │   │   └─► Increment counter
   │   │
   │   ├─► Emit QUEST_OBJECTIVE_KILL_PROGRESS
   │   │   {
   │   │     questId: "quest_001",
   │   │     objectiveId: "kill_goblins",
   │   │     currentCount: 5,
   │   │     requiredCount: 10
   │   │   }
   │   │
   │   ├─► Client: Update quest tracker (5/10)
   │   │
   │   └─► [When 10/10 reached]
   │       │
   │       ├─► Emit QUEST_OBJECTIVE_UPDATED
   │       │   { completed: true }
   │       │
   │       └─► Client: Show "Objective Complete!" notification
   │
   │
   ├─► [Example: Collection Objective]
   │   │
   │   ├─► Player loots item
   │   ├─► Inventory system: Emit INVENTORY_ITEM_ADDED
   │   ├─► Quest system: handleItemCollected()
   │   │
   │   └─► Similar flow to kill objective
   │
   │
   ├─► [Example: Location Objective]
   │   │
   │   ├─► Player moves
   │   ├─► Movement system: Check position
   │   ├─► Quest system: handleLocationReached()
   │   │
   │   └─► Emit when player reaches target area
   │
   ▼
6. ALL OBJECTIVES COMPLETE
   │
   ├─► Quest system checks completion
   │
   ├─► [If auto-complete quest]
   │   └─► Immediately complete quest
   │
   ├─► [If manual-complete quest]
   │   │
   │   ├─► Emit QUEST_PROGRESSED
   │   │   { completionPercentage: 100 }
   │   │
   │   ├─► Client: Show "Return to quest giver"
   │   ├─► Add map marker to quest giver
   │   │
   │   └─► Player talks to NPC
   │       └─► Dialogue action: complete_quest
   │
   ▼
7. QUEST COMPLETION
   │
   ├─► Server: completeQuest()
   │   │
   │   ├─► Validate all objectives complete
   │   ├─► Grant rewards
   │   │   ├─► XP
   │   │   ├─► Items
   │   │   ├─► Coins
   │   │   └─► etc.
   │   │
   │   ├─► Update database
   │   │   ├─► quest_progress status = 'completed'
   │   │   └─► Set completion time
   │   │
   │   └─► Check for follow-up quest
   │
   ├─► Emit QUEST_COMPLETED
   │   {
   │     quest: { ... },
   │     rewards: [ ... ],
   │     duration: 1234567 // milliseconds
   │   }
   │
   ▼
8. CLIENT SHOWS COMPLETION
   │
   ├─► Show completion UI with rewards
   ├─► Play fanfare sound
   ├─► Move quest to "Completed" tab
   ├─► Remove map markers
   ├─► Show XP gain animation
   │
   └─► [If follow-up quest available]
       └─► Show "New quest available!" notification
```

---

## Component Interactions

### DialogueStateManager ↔ QuestSystem

```
Dialogue Action: "Accept Quest"
│
├─► DialogueStateManager.executeAction()
│   {
│     type: 'start_quest',
│     params: { questId: 'tutorial_001' }
│   }
│
├─► QuestSystem.startQuest()
│   │
│   ├─► Check requirements
│   ├─► Create quest progress
│   ├─► Emit QUEST_STARTED
│   │
│   └─► Return { success: true }
│
└─► DialogueStateManager returns action result
    │
    └─► Included in DIALOGUE_RESPONSE_PROCESSED event
```

### QuestSystem ↔ Combat System

```
Combat Kill Event
│
├─► CombatSystem.onEntityDeath()
│   │
│   └─► Emit COMBAT_KILL
│       { killerId: "player_123", targetId: "goblin_456" }
│
├─► QuestSystem.handleKill()
│   │
│   ├─► Get active quests for player
│   ├─► Filter for kill objectives
│   ├─► Check if target matches objective
│   ├─► Increment kill counter
│   │
│   └─► Emit QUEST_OBJECTIVE_KILL_PROGRESS
│
└─► Client updates UI
```

### QuestSystem ↔ Inventory System

```
Item Collection
│
├─► InventorySystem.addItem()
│   │
│   └─► Emit INVENTORY_ITEM_ADDED
│       { playerId: "player_123", itemId: "bear_pelt", quantity: 1 }
│
├─► QuestSystem.handleItemCollected()
│   │
│   ├─► Get active quests
│   ├─► Filter for collection objectives
│   ├─► Check if item matches objective
│   ├─► Increment item counter
│   │
│   └─► Emit QUEST_OBJECTIVE_COLLECT_PROGRESS
│
└─► Client updates quest tracker
```

---

## State Management

### Dialogue Session State

```
Server-Side State:
{
  sessionId: "session_abc123",
  playerId: "player_123",
  npcId: "npc_quest_giver",
  treeId: "quest_giver_dialogue",
  currentNodeId: "quest_offer",
  startTime: 1699123456789,
  lastActivity: 1699123456799,
  variables: {
    playerName: "Hero",
    questName: "The Lost Sword"
  },
  history: ["greeting", "quest_inquiry", "quest_offer"]
}

Lifecycle:
1. Created on DIALOGUE_START_REQUEST
2. Updated on each DIALOGUE_RESPONSE_SELECTED
3. Cleaned up on DIALOGUE_ENDED or timeout (5 min)
```

### Quest Progress State

```
Database Record (quest_progress):
{
  id: 42,
  playerId: "player_123",
  questId: "quest_001",
  status: "in_progress",
  progress: {
    objectives: [
      {
        id: "kill_goblins",
        type: "kill",
        currentProgress: 5,
        requiredProgress: 10,
        completed: false
      }
    ]
  },
  startTime: 1699123456789,
  completionTime: null,
  completionPercentage: 50,
  lastUpdateTime: 1699123499999
}

Database Record (quest_objectives):
{
  id: 101,
  playerId: "player_123",
  questId: "quest_001",
  objectiveId: "kill_goblins",
  currentProgress: 5,
  requiredProgress: 10,
  completed: 0,
  lastUpdate: 1699123499999
}

Lifecycle:
1. Created on quest start
2. Updated on objective progress
3. Finalized on quest completion/abandonment
```

---

## Performance Considerations

### Dialogue System

**Session Management:**
- Sessions stored in-memory (Map)
- Background cleanup every 1 minute
- Expired sessions (>5 min inactive) removed
- Maximum 1 session per player

**Validation:**
- Distance check on start + periodic (every 2 seconds)
- Session lookup: O(1) via Map
- Dialogue tree lookup: O(1) via Map

**Memory:**
- Each session: ~1-2 KB
- 1000 concurrent sessions: ~1-2 MB
- Negligible impact

### Quest System

**Progress Tracking:**
- Active quests cached in memory per player
- Database writes batched (every 30 seconds)
- Immediate writes on completion

**Objective Updates:**
- In-memory counter updates (fast)
- Event emission only on change
- Database write on objective completion

**Scalability:**
- 10,000 active quests: ~10-20 MB memory
- Objective checks: O(n) where n = active quests per player
- Average player has 3-5 active quests: negligible

---

## Error Handling Strategy

### Dialogue Errors

```
Error Priority Levels:

HIGH (Block operation):
- NPC_NOT_FOUND
- INVALID_NODE
- SESSION_EXPIRED

MEDIUM (Retry possible):
- OUT_OF_RANGE
- INVALID_RESPONSE
- ALREADY_IN_DIALOGUE

LOW (Informational):
- REQUIREMENTS_NOT_MET

Error Response Pattern:
1. Server detects error
2. Emit ERROR event with code
3. Client displays appropriate message
4. Client updates UI state
5. Log error for analytics
```

### Quest Errors

```
Error Priority Levels:

HIGH (Block operation):
- QUEST_NOT_FOUND
- ALREADY_COMPLETED (non-repeatable)
- INVALID_OBJECTIVE

MEDIUM (Retry possible):
- REQUIREMENTS_NOT_MET
- ON_COOLDOWN
- INVENTORY_FULL

LOW (Expected cases):
- ALREADY_ACTIVE
- NOT_ACTIVE

Error Response Pattern:
1. Validate operation
2. If error: return detailed error object
3. Emit ERROR event
4. Client shows specific error message
5. Client suggests corrective action
```

---

## Security Considerations

### Validation

**Server-Side Only:**
- All conditions evaluated server-side
- All actions executed server-side
- Progress updates validated server-side
- Requirements checked server-side

**Client Cannot:**
- Force dialogue progression
- Complete quests prematurely
- Skip objectives
- Grant rewards
- Modify progress directly

### Anti-Cheat

**Dialogue:**
- Response must match current node
- Session must exist and be active
- Player must be near NPC

**Quest:**
- Objective progress validated against game events
- Kill counts verified via combat system
- Item collection verified via inventory system
- Time-based objectives use server time

---

## Extension Points

### Custom Dialogue Actions

```typescript
interface DialogueAction {
  type: 'custom';
  params: {
    customActionId: 'my_custom_action';
    customData: { ... };
  };
}

// Register custom handler
dialogueManager.registerCustomAction(
  'my_custom_action',
  async (playerId, params) => {
    // Custom logic here
    return { success: true, message: 'Done!' };
  }
);
```

### Custom Quest Objectives

```typescript
interface QuestObjective {
  type: 'custom';
  target: {
    type: 'custom';
    ids: ['custom_objective_id'];
    params: { customData: { ... } };
  };
}

// Register custom handler
questSystem.registerObjectiveHandler(
  'custom_objective_id',
  (playerId, questId, objectiveId, eventData) => {
    // Custom validation logic
    return { progress: 1, completed: true };
  }
);
```

### Custom Conditions

```typescript
interface DialogueCondition {
  type: 'custom';
  params: {
    customConditionId: 'my_condition';
    customParams: { ... };
  };
}

// Register custom condition
dialogueManager.registerCondition(
  'my_condition',
  (playerId, params) => {
    // Custom check logic
    return true; // or false
  }
);
```

---

## Monitoring & Analytics

### Metrics to Track

**Dialogue Metrics:**
- Average session duration
- Most common dialogue paths
- Abandonment rate (% of incomplete dialogues)
- Actions executed per dialogue type

**Quest Metrics:**
- Quest acceptance rate
- Quest completion rate
- Average completion time per quest
- Most abandoned quests
- Objective completion rates
- Reward distribution

### Logging

```typescript
// Dialogue events
logger.info('dialogue.started', {
  playerId,
  npcId,
  treeId,
  timestamp
});

logger.info('dialogue.action_executed', {
  playerId,
  npcId,
  actionType,
  actionResult,
  timestamp
});

// Quest events
logger.info('quest.started', {
  playerId,
  questId,
  questCategory,
  timestamp
});

logger.info('quest.objective_progress', {
  playerId,
  questId,
  objectiveId,
  progress,
  timestamp
});

logger.info('quest.completed', {
  playerId,
  questId,
  duration,
  rewards,
  timestamp
});
```

---

## Testing Strategy

### Unit Tests

```typescript
// Dialogue tests
describe('DialogueStateManager', () => {
  test('starts dialogue session successfully');
  test('validates player distance');
  test('processes valid response');
  test('rejects invalid response');
  test('executes actions correctly');
  test('checks conditions properly');
  test('cleans up expired sessions');
});

// Quest tests
describe('QuestSystem', () => {
  test('starts quest with met requirements');
  test('rejects quest with unmet requirements');
  test('updates kill objective');
  test('updates collection objective');
  test('completes quest with all objectives done');
  test('handles quest abandonment');
  test('enforces cooldown periods');
  test('chains quests correctly');
});
```

### Integration Tests

```typescript
describe('Dialogue + Quest Integration', () => {
  test('accepts quest through dialogue');
  test('completes quest through dialogue');
  test('dialogue shows quest-conditional nodes');
});

describe('Quest + Combat Integration', () => {
  test('kill objective progresses on mob death');
  test('multiple quests track same kill');
});

describe('Quest + Inventory Integration', () => {
  test('collection objective progresses on item pickup');
  test('quest rewards add to inventory');
});
```

### E2E Tests

```typescript
describe('Full Quest Flow', () => {
  test('player completes full quest chain', async () => {
    // 1. Talk to NPC
    // 2. Accept quest
    // 3. Complete objectives
    // 4. Return to NPC
    // 5. Receive rewards
    // 6. Next quest becomes available
  });
});
```

---

## Migration Path

### Phase 1: Add Types (Week 1)
- Add event types to EventType enum
- Add payload interfaces to events.ts
- Create quest-dialogue-types.ts
- Update EventMap

### Phase 2: Dialogue System (Week 2-3)
- Implement DialogueStateManager
- Create dialogue tree loader
- Add dialogue event handlers
- Build dialogue UI components
- Test with sample dialogues

### Phase 3: Quest System (Week 3-4)
- Implement QuestSystem
- Create quest definition loader
- Add quest event handlers
- Build quest UI components
- Test with sample quests

### Phase 4: Integration (Week 5)
- Connect dialogue to quests
- Add database persistence
- Implement cooldown system
- Add map markers
- Create notification system

### Phase 5: Content & Polish (Week 6)
- Create starter content
- Write documentation
- Performance optimization
- Bug fixes
- Launch

---

**For API reference, see:** [npc-dialogue-quest-api.md](./npc-dialogue-quest-api.md)

**For quick reference, see:** [quest-dialogue-api-summary.md](./quest-dialogue-api-summary.md)
