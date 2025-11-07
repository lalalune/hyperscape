# API Specifications

This directory contains comprehensive API specifications for the Hyperscape RPG systems.

## Quest & Dialogue System

Complete API specifications for the NPC Dialogue and Quest systems.

### Documentation Files

| Document | Purpose | Audience |
|----------|---------|----------|
| **[npc-dialogue-quest-api.md](./npc-dialogue-quest-api.md)** | Complete API specification | Developers (Implementation) |
| **[quest-dialogue-api-summary.md](./quest-dialogue-api-summary.md)** | Quick reference tables | Developers (Reference) |
| **[quest-dialogue-architecture.md](./quest-dialogue-architecture.md)** | Architecture and data flow | Architects / Developers |
| **[quest-dialogue-examples.md](./quest-dialogue-examples.md)** | Complete code examples | Developers (Tutorial) |

### Quick Links

**Getting Started:**
1. Read the [Architecture Overview](./quest-dialogue-architecture.md#system-overview)
2. Review [Event Types Summary](./quest-dialogue-api-summary.md#event-types-summary)
3. Study [Complete Examples](./quest-dialogue-examples.md)
4. Reference [Full API Specification](./npc-dialogue-quest-api.md)

**Key Resources:**
- **Type Definitions:** `/packages/shared/src/types/quest-dialogue-types.ts`
- **Event Types:** Add to `/packages/shared/src/types/events.ts`
- **Implementation Checklist:** [API Spec - Implementation Checklist](./npc-dialogue-quest-api.md#implementation-checklist)

---

## Overview

### What's Included

#### 1. Dialogue System
- **DialogueStateManager** - Server-side dialogue session management
- **DialogueTree** - Branching conversation structures
- **Conditional Nodes** - Dynamic dialogue based on game state
- **Actions** - Execute game logic from dialogue (start quests, give items, etc.)
- **Session Management** - Timeout handling, validation, distance checks

#### 2. Quest System
- **QuestSystem** - Server-side quest management
- **Quest Definitions** - Complete quest structures with objectives
- **Objective Types** - Kill, collect, interact, location, and more
- **Quest Chains** - Multi-quest storylines with prerequisites
- **Repeatable Quests** - Daily/weekly quests with cooldowns
- **Progress Tracking** - Real-time objective updates

#### 3. Event System
- **25+ Event Types** - Complete client-server communication
- **Type-Safe Payloads** - TypeScript interfaces for all events
- **Bidirectional Flow** - Request/response patterns
- **Error Handling** - Comprehensive error codes and recovery

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         CLIENT                                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Dialogue UI  │  │  Quest UI    │  │  Map System  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                 │
│         └─────────────────┼──────────────────┘                 │
│                           │                                    │
│                    ┌──────▼──────┐                             │
│                    │  Event Bus  │                             │
│                    └──────┬──────┘                             │
└───────────────────────────┼────────────────────────────────────┘
                            │ WebSocket/HTTP
┌───────────────────────────▼────────────────────────────────────┐
│                         SERVER                                  │
│                                                                 │
│                    ┌──────────────┐                             │
│                    │  Event Bus   │                             │
│                    └──────┬───────┘                             │
│                           │                                     │
│        ┌──────────────────┼──────────────────┐                 │
│        │                  │                  │                 │
│  ┌─────▼─────────┐  ┌────▼──────────┐  ┌────▼─────────┐      │
│  │  Dialogue     │  │  Quest        │  │  Other       │      │
│  │  State Mgr    │  │  System       │  │  Systems     │      │
│  └───────────────┘  └───────────────┘  └──────────────┘      │
│                                                                 │
│            ┌────────────────────────────┐                      │
│            │       Database             │                      │
│            │  - Quest Progress          │                      │
│            │  - Objectives              │                      │
│            │  - Cooldowns               │                      │
│            └────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Dialogue System Features

✅ **Branching Conversations**
- Dynamic dialogue trees with multiple paths
- Conditional nodes based on game state
- Variable interpolation in dialogue text

✅ **Quest Integration**
- Start quests from dialogue
- Complete quests through dialogue
- Conditional dialogue based on quest status

✅ **Actions & Conditions**
- Execute actions: start quest, give item, teleport, etc.
- Check conditions: quest status, item owned, skill level, etc.
- Custom actions and conditions

✅ **Session Management**
- Automatic timeout (5 minutes)
- Distance validation (5 units)
- Concurrent session prevention

### Quest System Features

✅ **Multiple Objective Types**
- Kill objectives (defeat X enemies)
- Collection objectives (gather X items)
- Interaction objectives (talk to NPC, use object)
- Location objectives (reach location)
- Custom objectives (extensible)

✅ **Quest Chains**
- Sequential quest progression
- Prerequisite validation
- Auto-accept follow-up quests

✅ **Repeatable Quests**
- Daily/weekly quests
- Cooldown system
- Progress reset on repeat

✅ **Real-Time Progress**
- Objective tracking
- Completion percentage
- Map markers for objectives

✅ **Flexible Rewards**
- XP rewards
- Item rewards
- Coin rewards
- Skill XP rewards
- Custom rewards

---

## Implementation Status

### ✅ Phase 1: Type Definitions (Complete)

- [x] Event type definitions
- [x] Payload interfaces
- [x] Data structure interfaces
- [x] Error codes
- [x] Complete TypeScript types file

### 🚧 Phase 2: Dialogue System (Not Started)

- [ ] DialogueStateManager class
- [ ] Dialogue tree loader
- [ ] Condition checking
- [ ] Action execution
- [ ] Event handlers
- [ ] UI components

### 🚧 Phase 3: Quest System (Not Started)

- [ ] QuestSystem class
- [ ] Quest definition loader
- [ ] Requirement validation
- [ ] Objective tracking
- [ ] Event handlers
- [ ] UI components

### 🚧 Phase 4: Integration (Not Started)

- [ ] Dialogue → Quest connection
- [ ] Database persistence
- [ ] Cooldown system
- [ ] Map markers
- [ ] Notifications

### 🚧 Phase 5: Content (Not Started)

- [ ] Starter dialogues
- [ ] Starter quests
- [ ] Reward definitions
- [ ] Testing

---

## Quick Start Guide

### 1. Review Documentation

Start with the architecture overview:
```bash
# Read architecture first
cat docs/api-specifications/quest-dialogue-architecture.md

# Then review examples
cat docs/api-specifications/quest-dialogue-examples.md
```

### 2. Add Event Types

Add new event types to the EventType enum:
```typescript
// packages/shared/src/types/events.ts
export enum EventType {
  // ... existing events ...

  // Dialogue Events
  DIALOGUE_START_REQUEST = 'dialogue:start_request',
  DIALOGUE_STARTED = 'dialogue:started',
  // ... etc
}
```

### 3. Import Types

Use the provided type definitions:
```typescript
import {
  DialogueTree,
  DialogueNode,
  QuestDefinition,
  QuestObjective,
} from '@/types/quest-dialogue-types';
```

### 4. Create Sample Content

Create a simple dialogue:
```typescript
const simpleDialogue: DialogueTree = {
  id: 'npc_greeting',
  npcId: 'npc_guard',
  name: 'Guard Greeting',
  rootNodeId: 'greeting',
  nodes: new Map([
    ['greeting', {
      id: 'greeting',
      text: 'Hello, traveler!',
      endsDialogue: true,
      options: []
    }]
  ])
};
```

Create a simple quest:
```typescript
const simpleQuest: QuestDefinition = {
  id: 'tutorial_quest',
  name: 'First Steps',
  description: 'Learn the basics',
  category: 'tutorial',
  recommendedLevel: 1,
  difficulty: 'easy',
  repeatable: false,
  repeatCooldown: 0,
  requirements: [],
  objectives: [
    {
      id: 'talk_to_npc',
      type: 'talk_to',
      description: 'Talk to the trainer',
      target: { type: 'npc', ids: ['npc_trainer'] },
      currentProgress: 0,
      requiredProgress: 1,
      optional: false,
      order: 1,
      completed: false
    }
  ],
  rewards: [
    { type: 'xp', params: { amount: 50 }, description: '50 XP' }
  ],
  questGiverId: 'npc_starter',
  relatedNpcs: ['npc_starter'],
  timeLimit: 0,
  isChained: false,
  autoAccept: false,
  autoComplete: false
};
```

### 5. Implement Systems

Follow the implementation checklist in the API specification.

---

## API Summary Tables

### Event Categories

| Category | Event Count | Purpose |
|----------|-------------|---------|
| **Dialogue** | 8 events | Conversation management |
| **Quest Core** | 14 events | Quest lifecycle |
| **Quest Objectives** | 4 events | Objective progress |
| **Total** | 26 events | Complete system |

### Data Structure Count

| System | Interfaces | Enums | Total |
|--------|-----------|-------|-------|
| **Dialogue** | 10 types | 1 enum | 11 |
| **Quest** | 14 types | 1 enum | 15 |
| **Events** | 26 payloads | 0 | 26 |
| **Total** | 50 types | 2 enums | 52 |

---

## Examples Quick Reference

### Example 1: Simple Dialogue
[View Complete Example](./quest-dialogue-examples.md#simple-dialogue-example)

```typescript
// Town guard greeting with multiple response options
townGuardDialogue: DialogueTree
```

### Example 2: Quest-Offering Dialogue
[View Complete Example](./quest-dialogue-examples.md#quest-offering-dialogue)

```typescript
// Dialogue that starts a quest via action
questGiverDialogue: DialogueTree
```

### Example 3: Simple Kill Quest
[View Complete Example](./quest-dialogue-examples.md#simple-kill-quest)

```typescript
// Kill 10 goblins quest with rewards
goblinProblemQuest: QuestDefinition
```

### Example 4: Multi-Objective Quest
[View Complete Example](./quest-dialogue-examples.md#multi-objective-quest)

```typescript
// Quest with gathering and delivery objectives
gatheringSuppliesQuest: QuestDefinition
```

### Example 5: Quest Chain
[View Complete Example](./quest-dialogue-examples.md#quest-chain-example)

```typescript
// Tutorial quest chain with 3 sequential quests
tutorialIntroQuest → tutorialCombatQuest → tutorialGatheringQuest
```

### Example 6: Daily Quest
[View Complete Example](./quest-dialogue-examples.md#daily-quest-example)

```typescript
// Repeatable daily quest with cooldown
dailyGoblinSlayerQuest: QuestDefinition
```

---

## Testing Strategy

### Unit Tests

```typescript
// Dialogue system tests
✅ Start dialogue successfully
✅ Validate distance
✅ Process valid response
✅ Reject invalid response
✅ Execute actions
✅ Check conditions
✅ Session timeout

// Quest system tests
✅ Start quest with requirements met
✅ Reject quest with unmet requirements
✅ Update objectives
✅ Complete quest
✅ Abandon quest
✅ Enforce cooldowns
✅ Chain quests
```

### Integration Tests

```typescript
✅ Accept quest through dialogue
✅ Complete quest through dialogue
✅ Kill objective updates on combat
✅ Collection objective updates on pickup
✅ Quest rewards add to inventory
```

### E2E Tests

```typescript
✅ Complete full quest flow
✅ Complete quest chain
✅ Repeatable quest cooldown
```

---

## Performance Considerations

### Dialogue System

- **Memory:** ~1-2 KB per session
- **Scalability:** 1000 sessions = ~1-2 MB
- **Validation:** O(1) lookups via Map
- **Cleanup:** Background cleanup every 1 min

### Quest System

- **Memory:** ~10-20 KB per quest
- **Scalability:** 10,000 quests = ~10-20 MB
- **Updates:** O(n) where n = active quests (avg 3-5)
- **Database:** Batched writes every 30s

---

## Migration Timeline

### Week 1: Types & Events
- Add event types
- Create payload interfaces
- Update EventMap
- Review & approve

### Week 2-3: Dialogue System
- Implement DialogueStateManager
- Create dialogue loader
- Build UI components
- Test with sample dialogues

### Week 3-4: Quest System
- Implement QuestSystem
- Create quest loader
- Build UI components
- Test with sample quests

### Week 5: Integration
- Connect systems
- Add database persistence
- Implement cooldowns
- Add map markers
- Build notifications

### Week 6: Content & Polish
- Create starter content
- Write documentation
- Performance optimization
- Bug fixes
- Launch

---

## Contributing

### Adding New Dialogue Trees

1. Create file in `/content/dialogues/`
2. Export `DialogueTree` object
3. Register with `DialogueStateManager`
4. Test with in-game NPC

### Adding New Quests

1. Create file in `/content/quests/`
2. Export `QuestDefinition` object
3. Register with `QuestSystem`
4. Test complete quest flow

### Adding New Event Types

1. Add to `EventType` enum
2. Create payload interface
3. Add to `EventMap`
4. Document in API spec
5. Update examples

---

## Support & Resources

### Documentation
- [Complete API Spec](./npc-dialogue-quest-api.md) - Full technical specification
- [Quick Reference](./quest-dialogue-api-summary.md) - Tables and summaries
- [Architecture](./quest-dialogue-architecture.md) - System design
- [Examples](./quest-dialogue-examples.md) - Code examples

### Code
- Type Definitions: `/packages/shared/src/types/quest-dialogue-types.ts`
- Events: `/packages/shared/src/types/events.ts`

### Community
- Discord: #hyperscape-dev
- GitHub: Issues & Discussions

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-05 | Initial API specifications |

---

## License

These specifications are part of the Hyperscape project.

---

**Questions?** Open an issue or ask in #hyperscape-dev on Discord.
