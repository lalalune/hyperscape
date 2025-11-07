# Quest & Dialogue System - Complete Examples

**Version:** 1.0.0
**Last Updated:** 2025-11-05

This document provides complete, production-ready examples for the Quest and Dialogue systems.

---

## Table of Contents

1. [Simple Dialogue Example](#simple-dialogue-example)
2. [Quest-Offering Dialogue](#quest-offering-dialogue)
3. [Simple Kill Quest](#simple-kill-quest)
4. [Multi-Objective Quest](#multi-objective-quest)
5. [Quest Chain Example](#quest-chain-example)
6. [Daily Quest Example](#daily-quest-example)
7. [Complete Implementation](#complete-implementation)

---

## Simple Dialogue Example

### Dialogue Definition

```typescript
// dialogues/town-guard.ts
import type { DialogueTree } from '@/types/quest-dialogue-types';

export const townGuardDialogue: DialogueTree = {
  id: 'town_guard_greeting',
  npcId: 'npc_town_guard',
  name: 'Town Guard Greeting',
  rootNodeId: 'greeting',
  context: 'greeting',
  nodes: new Map([
    [
      'greeting',
      {
        id: 'greeting',
        text: 'Halt! State your business in {townName}.',
        emotion: 'neutral',
        endsDialogue: false,
        options: [
          {
            id: 'option_1',
            text: 'Just passing through.',
            nextNodeId: 'passing_through',
            endsDialogue: false,
          },
          {
            id: 'option_2',
            text: 'I seek adventure!',
            nextNodeId: 'adventure',
            endsDialogue: false,
          },
          {
            id: 'option_3',
            text: 'Goodbye.',
            nextNodeId: null,
            endsDialogue: true,
          },
        ],
      },
    ],
    [
      'passing_through',
      {
        id: 'passing_through',
        text: 'Very well. Stay out of trouble, traveler.',
        emotion: 'neutral',
        endsDialogue: false,
        options: [
          {
            id: 'option_1',
            text: 'I will. Thank you.',
            nextNodeId: null,
            endsDialogue: true,
          },
        ],
      },
    ],
    [
      'adventure',
      {
        id: 'adventure',
        text: 'A brave one, eh? The mayor might have work for you. Find him in the town hall.',
        emotion: 'happy',
        endsDialogue: false,
        options: [
          {
            id: 'option_1',
            text: "I'll go see him. Thanks!",
            nextNodeId: null,
            endsDialogue: true,
          },
        ],
      },
    ],
  ]),
};
```

### Usage

```typescript
// Server-side event handler
import { townGuardDialogue } from '@/dialogues/town-guard';

// Register dialogue tree
dialogueManager.registerDialogueTree(townGuardDialogue);

// Handle dialogue start request
eventBus.on(EventType.DIALOGUE_START_REQUEST, async (event) => {
  const { playerId, npcId, playerPosition } = event.data;

  if (npcId === 'npc_town_guard') {
    const result = await dialogueManager.startDialogue(playerId, npcId, 'greeting');

    if (result.success) {
      const tree = townGuardDialogue;
      const initialNode = tree.nodes.get(tree.rootNodeId)!;

      eventBus.emit(EventType.DIALOGUE_STARTED, {
        playerId,
        npcId,
        npcName: 'Town Guard',
        dialogueTree: tree,
        initialNodeId: tree.rootNodeId,
        startTime: Date.now(),
        sessionId: result.sessionId!,
      });

      eventBus.emit(EventType.DIALOGUE_NODE_DISPLAYED, {
        playerId,
        npcId,
        sessionId: result.sessionId!,
        node: initialNode,
        options: initialNode.options || [],
        variables: {
          townName: 'Valoria',
        },
      });
    }
  }
});
```

---

## Quest-Offering Dialogue

### Dialogue with Quest Action

```typescript
// dialogues/quest-giver.ts
import type { DialogueTree } from '@/types/quest-dialogue-types';

export const questGiverDialogue: DialogueTree = {
  id: 'quest_giver_goblin_problem',
  npcId: 'npc_mayor',
  name: 'Mayor - Goblin Problem',
  rootNodeId: 'greeting',
  context: 'quest',
  nodes: new Map([
    [
      'greeting',
      {
        id: 'greeting',
        text: 'Ah, you must be the adventurer the guard told me about. Welcome!',
        emotion: 'happy',
        endsDialogue: false,
        options: [
          {
            id: 'option_1',
            text: 'Yes, I heard you have work for me?',
            nextNodeId: 'quest_intro',
            endsDialogue: false,
          },
          {
            id: 'option_2',
            text: 'Just looking around.',
            nextNodeId: 'farewell',
            endsDialogue: false,
          },
        ],
      },
    ],
    [
      'quest_intro',
      {
        id: 'quest_intro',
        text: "Indeed I do! Goblins have been raiding our farms. We need someone to deal with them. Are you up for the task?",
        emotion: 'neutral',
        endsDialogue: false,
        options: [
          {
            id: 'option_accept',
            text: "I'll take care of the goblins!",
            nextNodeId: 'quest_accepted',
            endsDialogue: false,
            action: {
              type: 'start_quest',
              params: {
                questId: 'quest_goblin_problem',
              },
            },
          },
          {
            id: 'option_decline',
            text: 'Not right now.',
            nextNodeId: 'quest_declined',
            endsDialogue: false,
          },
        ],
      },
    ],
    [
      'quest_accepted',
      {
        id: 'quest_accepted',
        text: 'Excellent! The goblin camp is east of town. Good hunting!',
        emotion: 'happy',
        endsDialogue: false,
        options: [
          {
            id: 'option_1',
            text: 'I won\'t let you down!',
            nextNodeId: null,
            endsDialogue: true,
          },
        ],
      },
    ],
    [
      'quest_declined',
      {
        id: 'quest_declined',
        text: 'I understand. Come back when you\'re ready.',
        emotion: 'sad',
        endsDialogue: false,
        options: [
          {
            id: 'option_1',
            text: 'I will. Goodbye.',
            nextNodeId: null,
            endsDialogue: true,
          },
        ],
      },
    ],
    [
      'farewell',
      {
        id: 'farewell',
        text: 'Safe travels, friend.',
        emotion: 'neutral',
        endsDialogue: true,
        options: [],
      },
    ],
  ]),
};
```

### Dialogue with Conditional Nodes

```typescript
// dialogues/quest-giver-conditional.ts
export const questGiverConditionalDialogue: DialogueTree = {
  id: 'quest_giver_conditional',
  npcId: 'npc_mayor',
  name: 'Mayor - Conditional Dialogue',
  rootNodeId: 'greeting',
  context: 'quest',
  nodes: new Map([
    [
      'greeting',
      {
        id: 'greeting',
        text: 'Welcome back, adventurer!',
        emotion: 'happy',
        endsDialogue: false,
        options: [
          {
            id: 'option_quest_complete',
            text: 'I dealt with the goblins!',
            nextNodeId: 'quest_turn_in',
            endsDialogue: false,
            // Only show if quest is complete but not turned in
            condition: {
              type: 'quest_status',
              params: {
                questId: 'quest_goblin_problem',
                status: 'in_progress',
                allObjectivesComplete: true,
              },
            },
          },
          {
            id: 'option_quest_progress',
            text: 'Still working on those goblins.',
            nextNodeId: 'quest_in_progress',
            endsDialogue: false,
            condition: {
              type: 'quest_status',
              params: {
                questId: 'quest_goblin_problem',
                status: 'in_progress',
              },
            },
          },
          {
            id: 'option_already_complete',
            text: 'Any other work?',
            nextNodeId: 'quest_completed_before',
            endsDialogue: false,
            condition: {
              type: 'quest_status',
              params: {
                questId: 'quest_goblin_problem',
                status: 'completed',
              },
            },
          },
          {
            id: 'option_default',
            text: 'Just checking in.',
            nextNodeId: 'farewell',
            endsDialogue: false,
          },
        ],
      },
    ],
    [
      'quest_turn_in',
      {
        id: 'quest_turn_in',
        text: 'Wonderful news! Here is your reward as promised.',
        emotion: 'happy',
        endsDialogue: false,
        action: {
          type: 'complete_quest',
          params: {
            questId: 'quest_goblin_problem',
          },
        },
        options: [
          {
            id: 'option_1',
            text: 'Thank you!',
            nextNodeId: null,
            endsDialogue: true,
          },
        ],
      },
    ],
    [
      'quest_in_progress',
      {
        id: 'quest_in_progress',
        text: 'Keep at it! The town is counting on you.',
        emotion: 'neutral',
        endsDialogue: true,
        options: [],
      },
    ],
    [
      'quest_completed_before',
      {
        id: 'quest_completed_before',
        text: 'Not at the moment, but check back later!',
        emotion: 'happy',
        endsDialogue: true,
        options: [],
      },
    ],
    [
      'farewell',
      {
        id: 'farewell',
        text: 'Good day to you!',
        emotion: 'neutral',
        endsDialogue: true,
        options: [],
      },
    ],
  ]),
};
```

---

## Simple Kill Quest

### Quest Definition

```typescript
// quests/goblin-problem.ts
import type { QuestDefinition } from '@/types/quest-dialogue-types';

export const goblinProblemQuest: QuestDefinition = {
  id: 'quest_goblin_problem',
  name: 'The Goblin Problem',
  description: 'Goblins have been raiding the farms near town. Defeat 10 goblins to help protect the farmers.',
  category: 'side_quest',
  recommendedLevel: 5,
  difficulty: 'easy',
  repeatable: false,
  repeatCooldown: 0,

  requirements: [
    {
      type: 'level',
      params: {
        minimumLevel: 3,
      },
      description: 'Requires level 3 or higher',
    },
  ],

  objectives: [
    {
      id: 'kill_goblins',
      type: 'kill',
      description: 'Defeat goblins',
      target: {
        type: 'npc',
        ids: ['npc_goblin'], // Can accept multiple mob types
      },
      currentProgress: 0,
      requiredProgress: 10,
      optional: false,
      order: 1,
      completed: false,
      hint: 'Goblins can be found east of town',
      mapMarker: { x: 150, y: 0, z: 50 }, // Goblin camp location
    },
  ],

  rewards: [
    {
      type: 'xp',
      params: {
        amount: 500,
      },
      description: '500 XP',
    },
    {
      type: 'coins',
      params: {
        amount: 100,
      },
      description: '100 Coins',
    },
    {
      type: 'item',
      params: {
        itemId: 'iron_sword',
        quantity: 1,
      },
      description: 'Iron Sword',
      iconPath: '/assets/items/iron_sword.png',
    },
  ],

  questGiverId: 'npc_mayor',
  relatedNpcs: ['npc_mayor', 'npc_town_guard'],
  timeLimit: 0, // No time limit
  storyline: 'The peaceful town of Valoria has been plagued by goblin raids. The mayor seeks a brave adventurer to deal with the threat.',
  isChained: false,
  autoAccept: false,
  autoComplete: false, // Player must return to mayor
};
```

### Quest System Integration

```typescript
// Server-side quest system
import { goblinProblemQuest } from '@/quests/goblin-problem';

// Register quest
questSystem.registerQuest(goblinProblemQuest);

// Handle quest start from dialogue action
eventBus.on(EventType.DIALOGUE_RESPONSE_PROCESSED, async (event) => {
  const { actionResult } = event.data;

  if (actionResult?.actionType === 'start_quest') {
    const questId = actionResult.data?.questId;
    if (questId === 'quest_goblin_problem') {
      // Quest was started via dialogue action
      // QuestSystem already emitted QUEST_STARTED event
      console.log('Goblin Problem quest started successfully');
    }
  }
});

// Handle kill events
eventBus.on(EventType.COMBAT_KILL, (event) => {
  const { killerId, targetId } = event.data;

  // Let quest system handle it
  questSystem.handleKill(killerId, targetId);
});

// Inside QuestSystem.handleKill()
handleKill(playerId: string, targetNpcId: string): void {
  const npcData = this.getNpcData(targetNpcId);
  const npcType = npcData?.type; // e.g., 'npc_goblin'

  const activeQuests = this.getActiveQuests(playerId);

  for (const questProgress of activeQuests) {
    for (const objective of questProgress.objectives) {
      if (
        objective.type === 'kill' &&
        objective.target.type === 'npc' &&
        objective.target.ids.includes(npcType) &&
        !objective.completed
      ) {
        // Increment kill count
        objective.currentProgress++;

        // Emit progress
        this.eventBus.emit(EventType.QUEST_OBJECTIVE_KILL_PROGRESS, {
          playerId,
          questId: questProgress.questId,
          objectiveId: objective.id,
          targetNpcId: npcType,
          currentCount: objective.currentProgress,
          requiredCount: objective.requiredProgress,
          killedNpcId: targetNpcId,
        });

        // Check completion
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

          // Check if all objectives complete
          if (this.areAllObjectivesComplete(playerId, questProgress.questId)) {
            const quest = this.getQuestDefinition(questProgress.questId)!;

            if (quest.autoComplete) {
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

              this.eventBus.emit(EventType.UI_TOAST, {
                message: 'Quest objectives complete! Return to the Mayor.',
                type: 'success',
              });
            }
          }
        }

        // Save progress to database
        this.saveObjectiveProgress(playerId, questProgress.questId, objective);
      }
    }
  }
}
```

---

## Multi-Objective Quest

### Quest with Multiple Objectives

```typescript
// quests/gathering-supplies.ts
import type { QuestDefinition } from '@/types/quest-dialogue-types';

export const gatheringSuppliesQuest: QuestDefinition = {
  id: 'quest_gathering_supplies',
  name: 'Gathering Supplies',
  description: 'The blacksmith needs materials. Gather wood and ore to help him.',
  category: 'side_quest',
  recommendedLevel: 3,
  difficulty: 'easy',
  repeatable: false,
  repeatCooldown: 0,

  requirements: [],

  objectives: [
    {
      id: 'gather_wood',
      type: 'gather',
      description: 'Gather oak logs',
      target: {
        type: 'item',
        ids: ['oak_logs'],
      },
      currentProgress: 0,
      requiredProgress: 10,
      optional: false,
      order: 1,
      completed: false,
      hint: 'Chop down oak trees',
      mapMarker: { x: 100, y: 0, z: -50 }, // Forest location
    },
    {
      id: 'gather_ore',
      type: 'gather',
      description: 'Mine copper ore',
      target: {
        type: 'item',
        ids: ['copper_ore'],
      },
      currentProgress: 0,
      requiredProgress: 5,
      optional: false,
      order: 2,
      completed: false,
      hint: 'Mine copper rocks',
      mapMarker: { x: -100, y: 0, z: 100 }, // Mine location
    },
    {
      id: 'deliver_supplies',
      type: 'deliver',
      description: 'Deliver supplies to blacksmith',
      target: {
        type: 'npc',
        ids: ['npc_blacksmith'],
      },
      currentProgress: 0,
      requiredProgress: 1,
      optional: false,
      order: 3,
      completed: false,
      hint: 'Return to the blacksmith',
    },
  ],

  rewards: [
    {
      type: 'xp',
      params: {
        amount: 300,
      },
      description: '300 XP',
    },
    {
      type: 'coins',
      params: {
        amount: 75,
      },
      description: '75 Coins',
    },
  ],

  questGiverId: 'npc_blacksmith',
  relatedNpcs: ['npc_blacksmith'],
  timeLimit: 0,
  storyline: 'The village blacksmith is running low on supplies and needs help gathering materials.',
  isChained: false,
  autoAccept: false,
  autoComplete: true, // Auto-complete when all objectives done
};
```

### Handling Gathering Objectives

```typescript
// Handle resource gathering
eventBus.on(EventType.RESOURCE_GATHERED, (event) => {
  const { playerId, resourceId, itemsReceived } = event.data;

  for (const item of itemsReceived) {
    questSystem.handleItemCollected(playerId, item.itemId, item.quantity);
  }
});

// Inside QuestSystem.handleItemCollected()
handleItemCollected(playerId: string, itemId: string, quantity: number): void {
  const activeQuests = this.getActiveQuests(playerId);

  for (const questProgress of activeQuests) {
    for (const objective of questProgress.objectives) {
      if (
        (objective.type === 'collect' || objective.type === 'gather') &&
        objective.target.type === 'item' &&
        objective.target.ids.includes(itemId) &&
        !objective.completed
      ) {
        // Add to progress
        objective.currentProgress += quantity;

        // Cap at required
        if (objective.currentProgress > objective.requiredProgress) {
          objective.currentProgress = objective.requiredProgress;
        }

        // Emit progress
        this.eventBus.emit(EventType.QUEST_OBJECTIVE_COLLECT_PROGRESS, {
          playerId,
          questId: questProgress.questId,
          objectiveId: objective.id,
          itemId,
          currentCount: objective.currentProgress,
          requiredCount: objective.requiredProgress,
          source: 'gathered',
        });

        // Check completion
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

        // Update database
        this.saveObjectiveProgress(playerId, questProgress.questId, objective);
      }
    }

    // Check if all objectives complete
    if (this.areAllObjectivesComplete(playerId, questProgress.questId)) {
      const quest = this.getQuestDefinition(questProgress.questId)!;

      if (quest.autoComplete) {
        this.completeQuest(playerId, questProgress.questId);
      }
    }
  }
}
```

---

## Quest Chain Example

### Quest Chain Definition

```typescript
// quests/tutorial-chain.ts
import type { QuestDefinition } from '@/types/quest-dialogue-types';

// Quest 1: Introduction
export const tutorialIntroQuest: QuestDefinition = {
  id: 'tutorial_001_intro',
  name: 'Welcome to Hyperscape',
  description: 'Learn the basics of Hyperscape. Talk to the trainer to begin.',
  category: 'tutorial',
  recommendedLevel: 1,
  difficulty: 'easy',
  repeatable: false,
  repeatCooldown: 0,

  requirements: [],

  objectives: [
    {
      id: 'talk_to_trainer',
      type: 'talk_to',
      description: 'Speak with the Combat Trainer',
      target: {
        type: 'npc',
        ids: ['npc_combat_trainer'],
      },
      currentProgress: 0,
      requiredProgress: 1,
      optional: false,
      order: 1,
      completed: false,
      mapMarker: { x: 0, y: 0, z: 0 },
    },
  ],

  rewards: [
    {
      type: 'xp',
      params: { amount: 50 },
      description: '50 XP',
    },
  ],

  questGiverId: 'npc_starter_guide',
  relatedNpcs: ['npc_starter_guide', 'npc_combat_trainer'],
  timeLimit: 0,
  isChained: true,
  prerequisiteQuestId: null,
  followupQuestId: 'tutorial_002_combat',
  autoAccept: true, // Auto-accept on login
  autoComplete: false,
};

// Quest 2: Combat Basics
export const tutorialCombatQuest: QuestDefinition = {
  id: 'tutorial_002_combat',
  name: 'Combat Basics',
  description: 'Learn how to fight. Defeat 3 training dummies.',
  category: 'tutorial',
  recommendedLevel: 1,
  difficulty: 'easy',
  repeatable: false,
  repeatCooldown: 0,

  requirements: [
    {
      type: 'quest_completed',
      params: {
        questId: 'tutorial_001_intro',
      },
      description: 'Complete "Welcome to Hyperscape"',
    },
  ],

  objectives: [
    {
      id: 'defeat_dummies',
      type: 'kill',
      description: 'Defeat training dummies',
      target: {
        type: 'npc',
        ids: ['npc_training_dummy'],
      },
      currentProgress: 0,
      requiredProgress: 3,
      optional: false,
      order: 1,
      completed: false,
    },
  ],

  rewards: [
    {
      type: 'xp',
      params: { amount: 100 },
      description: '100 XP',
    },
    {
      type: 'item',
      params: {
        itemId: 'bronze_sword',
        quantity: 1,
      },
      description: 'Bronze Sword',
    },
  ],

  questGiverId: 'npc_combat_trainer',
  relatedNpcs: ['npc_combat_trainer'],
  timeLimit: 0,
  isChained: true,
  prerequisiteQuestId: 'tutorial_001_intro',
  followupQuestId: 'tutorial_003_gathering',
  autoAccept: false,
  autoComplete: true,
};

// Quest 3: Gathering Basics
export const tutorialGatheringQuest: QuestDefinition = {
  id: 'tutorial_003_gathering',
  name: 'Gathering Basics',
  description: 'Learn to gather resources. Chop 5 trees.',
  category: 'tutorial',
  recommendedLevel: 1,
  difficulty: 'easy',
  repeatable: false,
  repeatCooldown: 0,

  requirements: [
    {
      type: 'quest_completed',
      params: {
        questId: 'tutorial_002_combat',
      },
      description: 'Complete "Combat Basics"',
    },
  ],

  objectives: [
    {
      id: 'chop_trees',
      type: 'gather',
      description: 'Gather logs from trees',
      target: {
        type: 'item',
        ids: ['oak_logs'],
      },
      currentProgress: 0,
      requiredProgress: 5,
      optional: false,
      order: 1,
      completed: false,
    },
  ],

  rewards: [
    {
      type: 'xp',
      params: { amount: 150 },
      description: '150 XP',
    },
    {
      type: 'coins',
      params: { amount: 50 },
      description: '50 Coins',
    },
  ],

  questGiverId: 'npc_gathering_trainer',
  relatedNpcs: ['npc_gathering_trainer'],
  timeLimit: 0,
  isChained: true,
  prerequisiteQuestId: 'tutorial_002_combat',
  followupQuestId: null, // End of chain
  autoAccept: false,
  autoComplete: true,
};
```

### Quest Chain Handler

```typescript
// Handle quest completion and chain progression
eventBus.on(EventType.QUEST_COMPLETED, async (event) => {
  const { playerId, questId, quest } = event.data;

  // Check if quest is part of a chain
  if (quest.isChained && quest.followupQuestId) {
    const followupQuest = questSystem.getQuestDefinition(quest.followupQuestId);

    if (followupQuest) {
      // Check if player meets requirements for next quest
      const requirements = questSystem.checkQuestRequirements(
        playerId,
        followupQuest.id
      );

      const allMet = requirements.every(req => req.met);

      if (allMet) {
        // Emit quest available
        eventBus.emit(EventType.QUEST_AVAILABLE, {
          playerId,
          quest: followupQuest,
          npcId: followupQuest.questGiverId,
          requirementsMet: true,
        });

        // If auto-accept, start immediately
        if (followupQuest.autoAccept) {
          setTimeout(() => {
            questSystem.startQuest(playerId, followupQuest.id);
          }, 2000); // 2 second delay
        } else {
          // Show notification
          eventBus.emit(EventType.UI_TOAST, {
            message: `New quest available: ${followupQuest.name}`,
            type: 'info',
          });
        }
      }
    }
  }
});
```

---

## Daily Quest Example

### Daily Quest Definition

```typescript
// quests/daily-goblin-slayer.ts
import type { QuestDefinition } from '@/types/quest-dialogue-types';

export const dailyGoblinSlayerQuest: QuestDefinition = {
  id: 'daily_goblin_slayer',
  name: 'Daily: Goblin Slayer',
  description: 'Defeat 20 goblins. Resets daily at midnight.',
  category: 'daily',
  recommendedLevel: 10,
  difficulty: 'medium',
  repeatable: true,
  repeatCooldown: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

  requirements: [
    {
      type: 'level',
      params: {
        minimumLevel: 10,
      },
      description: 'Requires level 10 or higher',
    },
  ],

  objectives: [
    {
      id: 'kill_goblins_daily',
      type: 'kill',
      description: 'Defeat goblins',
      target: {
        type: 'npc',
        ids: ['npc_goblin', 'npc_goblin_warrior'],
      },
      currentProgress: 0,
      requiredProgress: 20,
      optional: false,
      order: 1,
      completed: false,
    },
  ],

  rewards: [
    {
      type: 'xp',
      params: {
        amount: 1000,
      },
      description: '1,000 XP',
    },
    {
      type: 'coins',
      params: {
        amount: 500,
      },
      description: '500 Coins',
    },
  ],

  questGiverId: 'npc_quest_board',
  relatedNpcs: [],
  timeLimit: 0,
  isChained: false,
  autoAccept: false,
  autoComplete: true,
};
```

### Cooldown Handling

```typescript
// Check cooldown before starting quest
async startQuest(playerId: string, questId: string): Promise<Result> {
  const quest = this.getQuestDefinition(questId);

  if (!quest) {
    return { success: false, error: 'Quest not found' };
  }

  // Check if quest is repeatable and on cooldown
  if (quest.repeatable && quest.repeatCooldown > 0) {
    const cooldown = await this.getQuestCooldown(playerId, questId);

    if (cooldown && cooldown.availableAgainTime > Date.now()) {
      const timeRemaining = cooldown.availableAgainTime - Date.now();
      const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));

      eventBus.emit(EventType.QUEST_ERROR, {
        playerId,
        questId,
        errorCode: QuestErrorCode.ON_COOLDOWN,
        message: `Quest available in ${hoursRemaining} hours`,
        details: {
          availableAt: cooldown.availableAgainTime,
          timeRemaining,
        },
      });

      return { success: false, error: 'Quest on cooldown' };
    }
  }

  // Start quest...
  // (rest of quest start logic)
}

// Set cooldown on quest completion
async completeQuest(playerId: string, questId: string): Promise<Result> {
  const quest = this.getQuestDefinition(questId)!;

  // ... grant rewards, etc.

  // Set cooldown if repeatable
  if (quest.repeatable && quest.repeatCooldown > 0) {
    const completionTime = Date.now();
    const availableAgainTime = completionTime + quest.repeatCooldown;

    await this.database.run(`
      INSERT OR REPLACE INTO quest_cooldowns (playerId, questId, completionTime, availableAgainTime)
      VALUES (?, ?, ?, ?)
    `, [playerId, questId, completionTime, availableAgainTime]);
  }

  // ... rest of completion logic
}
```

---

## Complete Implementation

### Server-Side Setup

```typescript
// server/systems/DialogueStateManager.ts
import { EventBus } from '@/core/EventBus';
import { EventType } from '@/types/events';
import type {
  DialogueTree,
  DialogueNode,
  DialogueSession,
  DialogueCondition,
  DialogueAction,
  DialogueActionResult,
  DialogueContext,
} from '@/types/quest-dialogue-types';

export class DialogueStateManager {
  private eventBus: EventBus;
  private dialogueTrees: Map<string, DialogueTree> = new Map();
  private activeSessions: Map<string, DialogueSession> = new Map();
  private playerSessions: Map<string, string> = new Map(); // playerId -> sessionId

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventHandlers();
    this.startSessionCleanup();
  }

  private setupEventHandlers(): void {
    this.eventBus.on(EventType.DIALOGUE_START_REQUEST, this.handleDialogueStartRequest.bind(this));
    this.eventBus.on(EventType.DIALOGUE_RESPONSE_SELECTED, this.handleResponseSelected.bind(this));
    this.eventBus.on(EventType.DIALOGUE_END_REQUEST, this.handleDialogueEndRequest.bind(this));
  }

  registerDialogueTree(tree: DialogueTree): void {
    this.dialogueTrees.set(tree.id, tree);
  }

  private async handleDialogueStartRequest(event: unknown): Promise<void> {
    const { playerId, npcId, playerPosition, context } = event.data;

    // Validate player not already in dialogue
    if (this.isInDialogue(playerId)) {
      this.eventBus.emit(EventType.DIALOGUE_ERROR, {
        playerId,
        npcId,
        sessionId: null,
        errorCode: DialogueErrorCode.ALREADY_IN_DIALOGUE,
        message: 'You are already in a conversation',
      });
      return;
    }

    // Validate distance
    const npcPosition = this.getNpcPosition(npcId);
    const distance = this.calculateDistance(playerPosition, npcPosition);

    if (distance > 5) {
      this.eventBus.emit(EventType.DIALOGUE_ERROR, {
        playerId,
        npcId,
        sessionId: null,
        errorCode: DialogueErrorCode.OUT_OF_RANGE,
        message: 'You are too far from the NPC',
      });
      return;
    }

    // Get dialogue tree
    const tree = this.getDialogueTree(npcId, context);

    if (!tree) {
      this.eventBus.emit(EventType.DIALOGUE_ERROR, {
        playerId,
        npcId,
        sessionId: null,
        errorCode: DialogueErrorCode.DIALOGUE_NOT_FOUND,
        message: 'No dialogue available',
      });
      return;
    }

    // Create session
    const sessionId = this.generateSessionId();
    const session: DialogueSession = {
      sessionId,
      playerId,
      npcId,
      treeId: tree.id,
      currentNodeId: tree.rootNodeId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      variables: new Map(),
      history: [],
    };

    this.activeSessions.set(sessionId, session);
    this.playerSessions.set(playerId, sessionId);

    // Get initial node
    const initialNode = tree.nodes.get(tree.rootNodeId)!;

    // Emit dialogue started
    this.eventBus.emit(EventType.DIALOGUE_STARTED, {
      playerId,
      npcId,
      npcName: this.getNpcName(npcId),
      dialogueTree: tree,
      initialNodeId: tree.rootNodeId,
      startTime: Date.now(),
      sessionId,
    });

    // Display initial node
    await this.displayNode(session, initialNode);
  }

  private async handleResponseSelected(event: unknown): Promise<void> {
    const { playerId, sessionId, responseId, currentNodeId } = event.data;

    const session = this.activeSessions.get(sessionId);

    if (!session) {
      this.eventBus.emit(EventType.DIALOGUE_ERROR, {
        playerId,
        npcId: null,
        sessionId,
        errorCode: DialogueErrorCode.SESSION_NOT_FOUND,
        message: 'Dialogue session not found',
      });
      return;
    }

    // Update last activity
    session.lastActivity = Date.now();

    // Get current node
    const tree = this.dialogueTrees.get(session.treeId)!;
    const currentNode = tree.nodes.get(currentNodeId)!;

    // Find selected option
    const selectedOption = currentNode.options?.find(opt => opt.id === responseId);

    if (!selectedOption) {
      this.eventBus.emit(EventType.DIALOGUE_ERROR, {
        playerId,
        npcId: session.npcId,
        sessionId,
        errorCode: DialogueErrorCode.INVALID_RESPONSE,
        message: 'Invalid response option',
      });
      return;
    }

    // Execute action if present
    let actionResult: DialogueActionResult | undefined;

    if (selectedOption.action) {
      actionResult = await this.executeAction(playerId, selectedOption.action);
    }

    // Emit response processed
    this.eventBus.emit(EventType.DIALOGUE_RESPONSE_PROCESSED, {
      playerId,
      npcId: session.npcId,
      sessionId,
      responseId,
      nextNodeId: selectedOption.nextNodeId,
      actionResult,
    });

    // Check if dialogue ends
    if (selectedOption.endsDialogue) {
      this.endDialogue(playerId, sessionId, 'completed');
      return;
    }

    // Go to next node
    if (selectedOption.nextNodeId) {
      const nextNode = tree.nodes.get(selectedOption.nextNodeId)!;
      session.currentNodeId = nextNode.id;
      session.history.push(currentNode.id);
      await this.displayNode(session, nextNode);
    }
  }

  private async displayNode(session: DialogueSession, node: DialogueNode): Promise<void> {
    const tree = this.dialogueTrees.get(session.treeId)!;

    // Check node condition
    if (node.condition && !this.checkCondition(session.playerId, node.condition)) {
      // Skip this node, go to next
      if (node.nextNodeId) {
        const nextNode = tree.nodes.get(node.nextNodeId)!;
        await this.displayNode(session, nextNode);
      } else {
        this.endDialogue(session.playerId, session.sessionId, 'completed');
      }
      return;
    }

    // Filter options by conditions
    const availableOptions = (node.options || []).filter(opt => {
      if (!opt.condition) return true;
      return this.checkCondition(session.playerId, opt.condition);
    });

    // Emit node displayed
    this.eventBus.emit(EventType.DIALOGUE_NODE_DISPLAYED, {
      playerId: session.playerId,
      npcId: session.npcId,
      sessionId: session.sessionId,
      node,
      options: availableOptions,
      variables: Object.fromEntries(session.variables),
    });

    // Execute node action if present
    if (node.action) {
      await this.executeAction(session.playerId, node.action);
    }

    // Check if node auto-ends dialogue
    if (node.endsDialogue && availableOptions.length === 0) {
      setTimeout(() => {
        this.endDialogue(session.playerId, session.sessionId, 'completed');
      }, 3000); // 3 second delay
    }
  }

  private checkCondition(playerId: string, condition: DialogueCondition): boolean {
    // Implement condition checking logic
    // This would interface with other systems (QuestSystem, PlayerSystem, etc.)

    switch (condition.type) {
      case 'quest_status':
        return this.checkQuestStatus(playerId, condition.params);
      case 'item_owned':
        return this.checkItemOwned(playerId, condition.params);
      case 'skill_level':
        return this.checkSkillLevel(playerId, condition.params);
      case 'flag_set':
        return this.checkFlag(playerId, condition.params);
      default:
        return true;
    }
  }

  private async executeAction(playerId: string, action: DialogueAction): Promise<DialogueActionResult> {
    // Implement action execution logic

    switch (action.type) {
      case 'start_quest':
        return this.startQuestAction(playerId, action.params);
      case 'complete_quest':
        return this.completeQuestAction(playerId, action.params);
      case 'give_item':
        return this.giveItemAction(playerId, action.params);
      // ... etc
      default:
        return { success: true, actionType: action.type };
    }
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions(5 * 60 * 1000); // 5 minutes
    }, 60 * 1000); // Check every minute
  }

  cleanupExpiredSessions(timeoutMs: number): void {
    const now = Date.now();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > timeoutMs) {
        this.endDialogue(session.playerId, sessionId, 'timeout');
      }
    }
  }

  // ... rest of implementation
}
```

### Client-Side UI

```typescript
// client/ui/DialogueUI.tsx
import React, { useState, useEffect } from 'react';
import { eventBus } from '@/core/EventBus';
import { EventType } from '@/types/events';
import type { DialogueNode, DialogueOption } from '@/types/quest-dialogue-types';

export const DialogueUI: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentNode, setCurrentNode] = useState<DialogueNode | null>(null);
  const [options, setOptions] = useState<DialogueOption[]>([]);

  useEffect(() => {
    const handleDialogueStarted = (event: unknown) => {
      const { npcName, sessionId } = event.data;
      setNpcName(npcName);
      setSessionId(sessionId);
      setIsOpen(true);
    };

    const handleNodeDisplayed = (event: unknown) => {
      const { node, options, variables } = event.data;

      // Interpolate variables in text
      let text = node.text;
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          text = text.replace(`{${key}}`, String(value));
        }
      }

      setCurrentNode({ ...node, text });
      setOptions(options);
    };

    const handleDialogueEnded = () => {
      setIsOpen(false);
      setSessionId(null);
      setCurrentNode(null);
      setOptions([]);
    };

    eventBus.on(EventType.DIALOGUE_STARTED, handleDialogueStarted);
    eventBus.on(EventType.DIALOGUE_NODE_DISPLAYED, handleNodeDisplayed);
    eventBus.on(EventType.DIALOGUE_ENDED, handleDialogueEnded);

    return () => {
      eventBus.off(EventType.DIALOGUE_STARTED, handleDialogueStarted);
      eventBus.off(EventType.DIALOGUE_NODE_DISPLAYED, handleNodeDisplayed);
      eventBus.off(EventType.DIALOGUE_ENDED, handleDialogueEnded);
    };
  }, []);

  const handleOptionClick = (option: DialogueOption) => {
    if (!sessionId || !currentNode) return;

    eventBus.emit(EventType.DIALOGUE_RESPONSE_SELECTED, {
      playerId: 'local_player', // Get from player system
      sessionId,
      responseId: option.id,
      currentNodeId: currentNode.id,
      timestamp: Date.now(),
    });
  };

  const handleClose = () => {
    if (!sessionId) return;

    eventBus.emit(EventType.DIALOGUE_END_REQUEST, {
      playerId: 'local_player',
      npcId: '', // Track this in state
      reason: 'player_closed',
    });
  };

  if (!isOpen || !currentNode) return null;

  return (
    <div className="dialogue-ui">
      <div className="dialogue-header">
        <h3>{npcName}</h3>
        <button onClick={handleClose}>×</button>
      </div>

      <div className="dialogue-body">
        <p className="dialogue-text">{currentNode.text}</p>

        <div className="dialogue-options">
          {options.map(option => (
            <button
              key={option.id}
              className="dialogue-option"
              onClick={() => handleOptionClick(option)}
              title={option.tooltip}
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

**For complete API documentation, see:** [npc-dialogue-quest-api.md](./npc-dialogue-quest-api.md)

**For architecture details, see:** [quest-dialogue-architecture.md](./quest-dialogue-architecture.md)
