# Multi-Agent AI Systems

[← Back to Features](../README.md)

---

## Overview

Asset Forge implements cutting-edge **multi-agent AI systems** that enable multiple AI agents to collaborate on content generation and quality assurance. These systems are based on 2025 research in multi-agent orchestration, swarm intelligence, and LLM-powered testing.

### Two Core Systems

1. **Multi-Agent NPC Collaboration** - Multiple AI agents roleplay as NPCs to create authentic dialogue, relationships, and emergent storylines
2. **AI Playtester Swarm** - Synthetic players test content and generate automated bug reports and engagement predictions

---

## Multi-Agent NPC Collaboration System

### Purpose

Enable multiple AI agents to roleplay as different NPCs simultaneously, creating:
- **Authentic dialogue** through natural multi-character conversation
- **Emergent relationships** from repeated interactions
- **Collaborative quest generation** where NPCs co-create storylines
- **Social simulations** that run in the background without player involvement

### Research Foundation

This system implements patterns from:
- **OpenAI Swarm Framework** - Agent handoffs and routines
- **LangGraph** - Dynamic graph-based multi-agent coordination
- **Network-style organization** with dynamic agent selection (arxiv.org/html/2505.19591v1)
- **Cross-validation mechanisms** that reduce hallucinations by 40% (Frontiers AI research)

### Architecture

```
┌─────────────────────────────────────────────────────┐
│         Multi-Agent Orchestrator                     │
│  - Registers agents with unique personas            │
│  - Routes messages based on context                 │
│  - Manages shared memory across swarm               │
│  - Performs cross-validation                        │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ↓               ↓               ↓
    ┌────────┐      ┌────────┐      ┌────────┐
    │ NPC 1  │      │ NPC 2  │      │ NPC 3  │
    │ Agent  │←────→│ Agent  │←────→│ Agent  │
    └────────┘      └────────┘      └────────┘
         │               │               │
         └───────────────┴───────────────┘
                         ↓
              ┌──────────────────────┐
              │  Emergent Content    │
              │  - Relationships     │
              │  - Quest ideas       │
              │  - Dialogue trees    │
              │  - Lore fragments    │
              └──────────────────────┘
```

### Key Components

#### 1. MultiAgentOrchestrator Service

**Location**: [packages/asset-forge/server/services/MultiAgentOrchestrator.mjs](../../server/services/MultiAgentOrchestrator.mjs)

**Features**:
- Dynamic agent selection based on context relevance
- Conversation handoffs between agents
- Shared memory for world state and relationships
- Cross-validation with up to 3 validator agents
- Emergent content extraction

**Example Usage**:

```javascript
import { MultiAgentOrchestrator } from './services/MultiAgentOrchestrator.mjs'

// Create orchestrator
const orchestrator = new MultiAgentOrchestrator({
  maxRounds: 10,
  temperature: 0.8,
  enableCrossValidation: true
})

// Register NPC agents
orchestrator.registerAgent({
  id: 'npc_blacksmith',
  name: 'Forge Master Gareth',
  role: 'blacksmith',
  systemPrompt: 'You are a gruff but kind blacksmith...',
  persona: {
    personality: 'Practical, honest, values hard work',
    goals: ['Craft legendary weapons', 'Train apprentices'],
    specialties: ['metalworking', 'weapon lore']
  }
})

orchestrator.registerAgent({
  id: 'npc_merchant',
  name: 'Trader Lyssa',
  role: 'merchant',
  systemPrompt: 'You are a shrewd traveling merchant...',
  persona: {
    personality: 'Charismatic, cunning, profit-driven',
    goals: ['Expand trade routes', 'Acquire rare goods'],
    specialties: ['negotiation', 'market knowledge']
  }
})

// Run collaborative conversation
const result = await orchestrator.runConversationRound(
  'Gareth and Lyssa meet at the town market to discuss a rare metal shipment.',
  'npc_blacksmith' // Starting agent
)

console.log('Conversation rounds:', result.rounds.length)
console.log('Emergent relationships:', result.emergentContent.relationships)
console.log('Validation:', result.validation)
```

#### 2. NPC Collaboration API Route

**Location**: [packages/asset-forge/server/routes/generate-npc-collaboration.mjs](../../server/routes/generate-npc-collaboration.mjs)

**Endpoint**: `POST /api/generate-npc-collaboration`

**Request Format**:

```typescript
{
  npcPersonas: [
    {
      id: "npc_001",
      name: "Guard Captain Marcus",
      personality: "Duty-bound, stern, protective",
      archetype: "guard",
      goals: ["Protect the town", "Train recruits"],
      background: "20-year veteran of the town guard",
      relationships: {
        "npc_002": "mentor"
      }
    },
    {
      id: "npc_002",
      name: "Recruit Emma",
      personality: "Eager, inexperienced, brave",
      archetype: "recruit",
      goals: ["Prove herself", "Learn from Marcus"],
      background: "New guard recruit"
    }
  ],
  collaborationType: "relationship", // dialogue, quest, lore, relationship, freeform
  context: {
    location: "Training grounds",
    situation: "First day of training",
    quests: [],
    relationships: []
  },
  rounds: 8,
  model: "anthropic/claude-sonnet-4", // optional
  enableCrossValidation: true
}
```

**Response**:

```json
{
  "sessionId": "collab_abc123",
  "collaborationType": "relationship",
  "npcCount": 2,
  "rounds": 8,
  "conversation": [
    {
      "round": 0,
      "agentId": "npc_001",
      "agentName": "Guard Captain Marcus",
      "content": "Welcome to the guard, recruit. I'm Captain Marcus...",
      "timestamp": 1738000000000
    },
    {
      "round": 1,
      "agentId": "npc_002",
      "agentName": "Recruit Emma",
      "content": "Thank you, Captain! I'm honored to serve...",
      "timestamp": 1738000001000
    }
  ],
  "emergentContent": {
    "relationships": [
      {
        "agents": ["Guard Captain Marcus", "Recruit Emma"],
        "type": "mentor-student",
        "interactionCount": 8,
        "sentiment": {
          "positive": 6,
          "neutral": 2,
          "negative": 0
        }
      }
    ],
    "dialogueSnippets": [...],
    "structuredOutput": {
      "relationships": [...]
    }
  },
  "validation": {
    "validated": true,
    "confidence": 0.87,
    "scores": {
      "consistency": 8.7,
      "authenticity": 9.0,
      "quality": 8.3
    },
    "validatorCount": 3
  },
  "stats": {
    "agentCount": 2,
    "totalMessages": 8,
    "agentActivity": [...]
  }
}
```

### Collaboration Types

#### 1. Dialogue

Natural conversation between NPCs establishing their personalities and relationships.

**Use Case**: Generate authentic NPC interactions for the first time they meet.

#### 2. Quest

NPCs collaborate to design a quest, discussing objectives, challenges, and rewards.

**Use Case**: Co-create emergent quests that involve multiple NPCs organically.

#### 3. Lore

NPCs share knowledge and stories, contributing world history and mysteries.

**Use Case**: Build world lore through character perspectives.

#### 4. Relationship

NPCs interact to build or develop their relationship dynamics.

**Use Case**: Establish friendships, rivalries, mentorships, or romances.

#### 5. Freeform

Open-ended interaction where NPCs respond naturally to any situation.

**Use Case**: Social simulations, background interactions, emergent storytelling.

### Cross-Validation

The orchestrator can validate generated content with multiple agents, reducing hallucinations by 40% (based on research findings).

**Process**:
1. Up to 3 validator agents review the generated content
2. Each rates consistency (1-10), authenticity (1-10), and quality (1-10)
3. Scores are averaged and confidence is calculated
4. Content is marked as validated if consistency ≥ 7 and authenticity ≥ 7

**Benefits**:
- Catches logical inconsistencies
- Verifies character authenticity
- Improves overall content quality
- Provides confidence metrics

---

## AI Playtester Swarm System

### Purpose

Deploy multiple AI agents as synthetic players to:
- **Test content** through simulated playthroughs
- **Find bugs** automatically (logic errors, broken triggers, unclear instructions)
- **Predict engagement** before human testing
- **Assess difficulty** with statistical correlation to human players

### Research Foundation

This system implements patterns from:
- **LLM Agents for MMORPG Testing** (arxiv.org/html/2509.22170v1)
- **Lap Framework** for preprocessing game states (arxiv.org/html/2507.09490v1)
- **LLMs as Difficulty Testers** (arxiv.org/abs/2410.02829)
- **EA's Adversarial RL** for procedural content generation testing

### Architecture

```
┌─────────────────────────────────────────────────────┐
│      Playtester Swarm Orchestrator                   │
│  - Manages 5-10 tester agents                       │
│  - Coordinates parallel or sequential testing       │
│  - Aggregates results and metrics                   │
│  - Generates comprehensive reports                  │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────┬───────┼───────┬───────┬───────┐
         ↓       ↓       ↓       ↓       ↓       ↓
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ...
    │Complet-││Speed-  ││Explorer││ Casual ││
    │ionist  ││runner  ││        ││        ││
    │ Agent  ││ Agent  ││ Agent  ││ Agent  ││
    └────────┘ └────────┘ └────────┘ └────────┘
         │       │       │       │       │
         └───────┴───────┴───────┴───────┘
                         ↓
              ┌──────────────────────┐
              │  Test Report         │
              │  - Bug reports       │
              │  - Difficulty scores │
              │  - Engagement scores │
              │  - Recommendations   │
              └──────────────────────┘
```

### Key Components

#### 1. PlaytesterSwarmOrchestrator Service

**Location**: [packages/asset-forge/server/services/PlaytesterSwarmOrchestrator.mjs](../../server/services/PlaytesterSwarmOrchestrator.mjs)

**Features**:
- Manages swarm of tester agents with diverse personas
- Runs tests in parallel for speed
- Parses structured feedback from testers
- Deduplicates similar bug reports
- Calculates aggregate metrics
- Generates actionable recommendations

**Example Usage**:

```javascript
import { PlaytesterSwarmOrchestrator } from './services/PlaytesterSwarmOrchestrator.mjs'

// Create orchestrator
const orchestrator = new PlaytesterSwarmOrchestrator({
  parallelTests: true,
  temperature: 0.7
})

// Register testers with different personas
orchestrator.registerTester({
  id: 'tester_001',
  name: 'Alex the Completionist',
  archetype: 'completionist',
  knowledgeLevel: 'intermediate',
  personality: 'Thorough, detail-oriented, patient',
  expectations: [
    'All objectives clearly marked',
    'Optional content is discoverable',
    'Rewards for exploration'
  ]
})

orchestrator.registerTester({
  id: 'tester_002',
  name: 'Jordan the Casual',
  archetype: 'casual',
  knowledgeLevel: 'beginner',
  personality: 'Relaxed, easily distracted',
  expectations: [
    'Clear, simple instructions',
    'Obvious quest markers',
    'Forgiving difficulty'
  ]
})

// Run swarm test
const results = await orchestrator.runSwarmPlaytest({
  id: 'quest_123',
  title: 'Goblin Camp Raid',
  objectives: [
    'Find goblin camp',
    'Defeat 10 goblins',
    'Retrieve stolen supplies'
  ],
  rewards: ['500 gold', '1000 XP']
})

console.log('Bugs found:', results.aggregatedMetrics.uniqueBugs)
console.log('Average difficulty:', results.aggregatedMetrics.averageDifficulty)
console.log('Recommendations:', results.recommendations)
```

#### 2. Playtester Swarm API Route

**Location**: [packages/asset-forge/server/routes/generate-playtester-swarm.mjs](../../server/routes/generate-playtester-swarm.mjs)

**Endpoint**: `POST /api/generate-playtester-swarm`

**Request Format**:

```typescript
{
  contentToTest: {
    id: "quest_123",
    title: "Rescue the Merchant",
    description: "Find and rescue the kidnapped merchant",
    objectives: [
      "Talk to guard captain",
      "Find merchant's last location",
      "Follow tracks to goblin cave",
      "Defeat goblin leader",
      "Escort merchant to safety"
    ],
    rewards: ["1000 gold", "Merchant's Favor token"]
  },
  contentType: "quest", // quest, dialogue, npc, combat, puzzle
  testerProfiles: [
    "completionist",
    "casual",
    "breaker",
    "speedrunner",
    "explorer"
  ], // Or use custom profiles
  testConfig: {
    parallel: true,
    temperature: 0.7
  },
  model: "anthropic/claude-sonnet-4" // optional
}
```

**Response**:

```json
{
  "sessionId": "playtest_xyz789",
  "contentType": "quest",
  "testCount": 5,
  "duration": 45000,
  "consensus": {
    "recommendation": "pass_with_changes",
    "confidence": 0.8,
    "agreement": "strong",
    "summary": "5 AI playtesters evaluated this content. 4 of 5 completed it successfully. Average difficulty was 6.4/10, engagement was 7.2/10. 3 potential issues were reported. Overall recommendation: PASS WITH CHANGES."
  },
  "aggregatedMetrics": {
    "totalTests": 5,
    "completionRate": 80,
    "averageDifficulty": 6.4,
    "difficultyByLevel": {
      "beginner": { "average": 7.5, "count": 1 },
      "intermediate": { "average": 6.2, "count": 3 },
      "expert": { "average": 5.0, "count": 1 }
    },
    "averageEngagement": 7.2,
    "engagementByArchetype": {
      "completionist": { "average": 8.0, "count": 1 },
      "casual": { "average": 6.0, "count": 1 }
    },
    "pacing": {
      "too_fast": 0,
      "just_right": 4,
      "too_slow": 1
    },
    "uniqueBugs": 3,
    "criticalBugs": 0,
    "majorBugs": 1,
    "minorBugs": 2,
    "bugReports": [
      {
        "description": "Objective 'Find merchant's last location' has no quest marker, confusing for new players",
        "severity": "major",
        "reportCount": 3,
        "reporters": ["Jordan the Casual", "Alex the Completionist", "Casey the Bug Hunter"]
      }
    ]
  },
  "recommendations": [
    {
      "priority": "high",
      "category": "bugs",
      "message": "1 major bug must be fixed",
      "action": "Add quest marker for merchant's last location objective"
    }
  ],
  "report": {
    "summary": {
      "grade": "B",
      "gradeScore": 82,
      "recommendation": "pass_with_changes",
      "confidence": 0.8,
      "readyForProduction": false
    },
    "qualityMetrics": { ... },
    "issues": { ... },
    "playerFeedback": { ... }
  },
  "stats": {
    "testerCount": 5,
    "totalTestsRun": 5,
    "totalBugsFound": 3
  }
}
```

### Predefined Tester Personas

The system includes 7 research-based playtester archetypes:

#### 1. Completionist
- **Knowledge**: Intermediate
- **Playstyle**: Thorough, finds everything
- **Finds**: Missing content, incomplete features, hidden bugs

#### 2. Speedrunner
- **Knowledge**: Expert
- **Playstyle**: Efficient, optimal paths
- **Finds**: Sequence breaks, exploits, pacing issues

#### 3. Explorer
- **Knowledge**: Intermediate
- **Playstyle**: Boundary-testing, experimental
- **Finds**: Edge cases, unusual interactions

#### 4. Casual
- **Knowledge**: Beginner
- **Playstyle**: Relaxed, may miss hints
- **Finds**: Confusing instructions, difficulty spikes

#### 5. Min-Maxer
- **Knowledge**: Expert
- **Playstyle**: Optimization-focused
- **Finds**: Balance issues, exploitable strategies

#### 6. Roleplayer
- **Knowledge**: Intermediate
- **Playstyle**: Story and immersion focused
- **Finds**: Narrative inconsistencies, immersion breaks

#### 7. Bug Hunter (Breaker)
- **Knowledge**: Expert
- **Playstyle**: Adversarial, tries to break things
- **Finds**: Critical bugs, error states, edge cases

### Test Report Structure

Each swarm playtest generates a comprehensive report:

```typescript
{
  summary: {
    grade: 'A' | 'B' | 'C' | 'D' | 'F',
    gradeScore: number, // 0-100
    recommendation: 'pass' | 'pass_with_changes' | 'fail',
    confidence: number, // 0-1
    readyForProduction: boolean
  },
  qualityMetrics: {
    completionRate: string, // "80%"
    difficulty: {
      overall: string, // "6.4/10"
      byLevel: { beginner: {...}, intermediate: {...}, expert: {...} }
    },
    engagement: {
      overall: string, // "7.2/10"
      byArchetype: { completionist: {...}, casual: {...}, ... }
    },
    pacing: { too_fast: number, just_right: number, too_slow: number }
  },
  issues: {
    critical: number,
    major: number,
    minor: number,
    total: number,
    topIssues: Array<{
      description: string,
      severity: string,
      reportedBy: string[],
      reportCount: number
    }>
  },
  playerFeedback: {
    commonConfusions: Array<{ confusion: string, reportCount: number }>,
    testerAgreement: 'strong' | 'moderate',
    consensusSummary: string
  },
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'info',
    category: string,
    message: string,
    action: string
  }>
}
```

### Grading System

Content is graded on a scale of A-F based on:
- **Bug severity** (Critical = instant F, Major = -10 per bug)
- **Completion rate** (< 70% = penalty)
- **Engagement** (< 5/10 = penalty)
- **Recommendations** (Pass ≥ 70% testers = likely A/B)

**Grade Meanings**:
- **A (90-100)**: Production-ready, excellent quality
- **B (80-89)**: Production-ready with minor improvements
- **C (70-79)**: Needs improvements before release
- **D (60-69)**: Significant issues, major rework needed
- **F (< 60)**: Not ready for release, critical issues

---

## Frontend UI

Asset Forge provides a complete user interface for multi-agent systems, making it easy to run collaborations and playtester swarms without writing code.

### Accessing Multi-Agent Features

Navigate to the **Content Generation** page and use the tab navigation:

- **Collaboration Tab**: NPC multi-agent collaborations
- **Playtest Tab**: Playtester swarm testing

### NPC Collaboration UI

#### Components

The Collaboration tab uses a two-panel layout:

**Left Panel: NPCCollaborationBuilder**
- NPC persona management
- Collaboration type selection
- Context and settings configuration
- Start collaboration button

**Right Panel: CollaborationResultViewer**
- Conversation history
- Emergent relationships
- Structured output
- Validation metrics
- Export functionality

#### Workflow

**Step 1: Add NPCs**

Two methods to add NPCs:

1. **Create New NPC**:
   ```
   Click [+ Create New NPC]
   Enter:
   - Name: "Guard Captain Marcus"
   - Personality: "Duty-bound, stern, protective"
   - Archetype: "guard" (optional)
   Click [Add NPC]
   ```

2. **Import from Generated NPCs**:
   ```
   Click [Import from Generated] dropdown
   Select an NPC from the list
   NPC is automatically added with full personality
   ```

**Minimum**: 2 NPCs required for collaboration

**Step 2: Select Collaboration Type**

Choose from 5 types:

| Type | Description | Best For |
|------|-------------|----------|
| **Dialogue** | Natural conversation | First meetings, introductions |
| **Quest** | Co-create a quest | Multi-NPC quest chains |
| **Lore** | Share world knowledge | World-building, backstory |
| **Relationship** | Develop dynamics | Friendships, rivalries |
| **Freeform** | Open-ended interaction | Social simulations |

**Step 3: Provide Context** (Optional)

Add grounding information:
- **Location**: Where NPCs are meeting (e.g., "Training grounds")
- **Situation**: What's happening (e.g., "First day of training")

Better context = more focused, authentic interactions.

**Step 4: Configure Settings**

- **Conversation Rounds** (3-15): Use slider to set interaction count
  - 3-5 rounds: Quick interactions
  - 6-10 rounds: Standard (recommended)
  - 11-15 rounds: Deep exploration

- **AI Model** (Optional): Select specific model or leave default

- **Cross-Validation**: Toggle on/off
  - ✅ **Enabled**: Reduces hallucinations by 40%, adds quality scores
  - ❌ **Disabled**: Faster, lower cost

**Step 5: Run Collaboration**

```
Click [✨ Start Collaboration]
Wait 10-60 seconds (shows loading indicator)
Results appear automatically in right panel
```

#### Viewing Results

The CollaborationResultViewer has 4 tabs:

**1. Conversation Tab**
- Shows all conversation rounds
- Each round displays:
  - Round number
  - Agent name
  - Message content
  - Timestamp
- Scrollable conversation history

**2. Relationships Tab**
- Emergent relationships discovered
- Each relationship shows:
  - Agents involved
  - Relationship type (mentor-student, allies, etc.)
  - Interaction count
  - Sentiment breakdown (positive/neutral/negative)

**3. Structured Output Tab**
- Raw JSON extracted from collaboration
- Quest data, lore fragments, relationship details
- Ready to copy/paste into game systems

**4. Validation Tab** (if cross-validation enabled)
- Validation status (Validated/Not Validated)
- Confidence score (0-100%)
- Quality metrics:
  - Consistency (1-10)
  - Authenticity (1-10)
  - Quality (1-10)
- Validator count

**Export**
- Click [📥 Export] to download JSON
- Filename: `collaboration-{sessionId}.json`
- Contains full session data

### Playtester Swarm UI

#### Components

The Playtest tab uses a single-panel layout with two sections:

**Configuration Panel**
- Content selection (quests from generated list)
- Tester persona selection
- Test settings
- Run test button

**Test Report** (appears after test runs)
- Overall grade (A-F)
- Summary metrics
- Bug reports with filtering
- Recommendations
- Export functionality

#### Workflow

**Step 1: Select Content to Test**

```
┌─────────────────────────────────────────┐
│ ✓ Dragon's Lair Raid                   │
│ 5 objectives • hard difficulty          │
└─────────────────────────────────────────┘
```

Click on a quest to select it (checkmark appears).

**Step 2: Choose Playtesters**

Use **TesterPersonaSelector** component:

**7 Available Archetypes**:

| Persona | Level | Finds |
|---------|-------|-------|
| 🔵 Completionist | Intermediate | Missing content, incomplete features |
| 🔴 Speedrunner | Expert | Sequence breaks, exploits, pacing |
| 🟢 Explorer | Intermediate | Edge cases, unusual interactions |
| 🟡 Casual | Beginner | Confusing instructions, difficulty spikes |
| 🟣 Min-Maxer | Expert | Balance issues, exploitable strategies |
| 🩷 Roleplayer | Intermediate | Narrative inconsistencies |
| 🟠 Breaker | Expert | Critical bugs, error states |

**Quick Selection Controls**:
- [Use Default (5)]: Recommended set (Completionist, Casual, Breaker, Speedrunner, Explorer)
- [Select All]: All 7 personas
- [Clear]: Deselect all

**Manual Selection**:
- Click persona cards to toggle
- Checkmark indicates selected
- Min: 1 tester, Max: 7 testers

**Persona Details**:
- Click [Show Details ▼] to expand
- Shows expectations, playstyle, personality

**Step 3: Configure Test Settings**

- **Parallel Testing** (checkbox):
  - ✅ Enabled: Faster (30-60s), all testers simultaneously
  - ❌ Disabled: Slower, sequential testing

- **AI Model** (Optional): Select model or leave default

**Step 4: Run Test**

```
Click [▶️ Run Swarm Test (X testers selected)]
Wait 30-90 seconds (shows progress)
Test report appears automatically
```

#### Reading Test Reports

**Overall Grade Display**

```
┌──────────────────┐
│       B          │
│     82/100       │
└──────────────────┘
```

**Summary Cards** (4 key metrics):

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Completion   │ Difficulty   │ Engagement   │ Total Bugs   │
│     80%      │    6.4/10    │    7.2/10    │      3       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Recommendation Card**

```
┌─────────────────────────────────────────────────┐
│ ℹ️  PASS WITH CHANGES                           │
│                                                 │
│ 5 AI playtesters evaluated this content...     │
│ Fix 1 major bug before release.                │
└─────────────────────────────────────────────────┘
```

**Bug Reports** (filterable by severity):

```
[All] [Critical] [Major] [Minor]  <- Filter buttons

┌─────────────────────────────────────────────────┐
│ 🟠 MAJOR | Reported 3x                         │
│ Objective "Find merchant" has no quest marker  │
│ Reported by: Jordan, Alex, Casey               │
└─────────────────────────────────────────────────┘
```

**Recommendations** (prioritized):

```
┌─────────────────────────────────────────────────┐
│ 🚨 HIGH | BUGS                                  │
│ 1 major bug must be fixed                      │
│ Action: Add quest marker for merchant location │
└─────────────────────────────────────────────────┘
```

**Export Report**
- Click [📥 Export]
- Filename: `playtest-report-{sessionId}.json`
- Contains full test data

### State Management

Multi-agent UI uses the **useMultiAgentStore** Zustand store:

```typescript
import { useMultiAgentStore } from '@/store/useMultiAgentStore'

// In a component
const {
  // NPC Collaboration
  collaborations,
  activeCollaboration,
  isCollaborating,
  collaborationError,
  addCollaboration,
  setActiveCollaboration,

  // Playtester Swarm
  playtestSessions,
  activePlaytest,
  isTesting,
  testError,
  addPlaytestSession,
  setActivePlaytest,

  // Personas
  availablePersonas,
  loadingPersonas
} = useMultiAgentStore()
```

**Key State**:
- `collaborations`: Array of all collaboration sessions
- `activeCollaboration`: Currently displayed collaboration
- `playtestSessions`: Array of all playtest sessions
- `activePlaytest`: Currently displayed test report
- `availablePersonas`: Cached playtester persona definitions

### UI Screenshots (ASCII Mockups)

**NPC Collaboration Builder**
```
┌─────────────────────────────────────────────┐
│ 👥 NPC Collaboration                        │
│                                             │
│ NPCs (2 selected, min: 2)                  │
│ ┌─────────────────────────────────────────┐│
│ │ Guard Captain Marcus [guard]        ❌  ││
│ │ Duty-bound, stern, protective            ││
│ └─────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────┐│
│ │ Recruit Emma [recruit]              ❌  ││
│ │ Eager, inexperienced, brave              ││
│ └─────────────────────────────────────────┘│
│ [+ Create New NPC] [Import from Generated] │
│                                             │
│ Collaboration Type                         │
│ ┌─────────────────────────────────────────┐│
│ │ ● Dialogue                               ││
│ │ Natural conversation to establish...     ││
│ └─────────────────────────────────────────┘│
│ ○ Quest Co-Creation                        │
│ ○ Lore Building                            │
│                                             │
│ Context (Optional)                         │
│ Location: [Training grounds____________]   │
│ Situation: [First day of training_____]    │
│                                             │
│ Settings                                    │
│ Conversation Rounds: 6 [====|----------]   │
│ AI Model: [Claude Sonnet 4 ▼]             │
│ ☑ Enable Cross-Validation                  │
│                                             │
│ [✨ Start Collaboration]                    │
└─────────────────────────────────────────────┘
```

**Playtester Swarm Panel**
```
┌─────────────────────────────────────────────┐
│ 🧪 AI Playtester Swarm                      │
│                                             │
│ Content to Test                            │
│ ┌─────────────────────────────────────────┐│
│ │ ✓ Dragon's Lair Raid                    ││
│ │ 5 objectives • hard difficulty           ││
│ └─────────────────────────────────────────┘│
│                                             │
│ Select Playtesters                         │
│ 5 of 7 selected  [Default] [All] [Clear]  │
│ ┌───────┐ ┌───────┐ ┌───────┐            │
│ │ ✓ 🔵  │ │ ✓ 🟡  │ │ ✓ 🟠  │            │
│ │Complet│ │Casual │ │Breaker│            │
│ │[Inter]│ │[Begin]│ │[Exper]│            │
│ └───────┘ └───────┘ └───────┘            │
│                                             │
│ Test Settings                              │
│ ☑ Run tests in parallel                    │
│ AI Model: [Claude Sonnet 4 ▼]             │
│                                             │
│ [▶️ Run Swarm Test (5 testers)]             │
└─────────────────────────────────────────────┘

Test Report (after running):
┌─────────────────────────────────────────────┐
│ Test Report  5 testers • 45.2s      [📥]   │
│ ┌─────┐                                     │
│ │  B  │ 82/100                              │
│ └─────┘                                     │
│ ┌────┬────┬────┬────┐                      │
│ │80% │6.4 │7.2 │ 3  │                      │
│ │Comp│Diff│Eng │Bugs│                      │
│ └────┴────┴────┴────┘                      │
│                                             │
│ ℹ️  PASS WITH CHANGES                       │
│ Fix 1 major bug before release             │
│                                             │
│ Bug Reports (3)    [All][Crit][Maj][Min]  │
│ ┌─────────────────────────────────────────┐│
│ │🟠 MAJOR | 3x                            ││
│ │No quest marker for objective 2          ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### Component Integration

The multi-agent UI integrates with existing Asset Forge components:

**ContentGenerationPage** (`src/pages/ContentGenerationPage.tsx`):
- Manages tab navigation
- Renders NPCCollaborationBuilder + CollaborationResultViewer
- Renders PlaytesterSwarmPanel
- Coordinates with other content generation features

**Example Integration**:

```tsx
<div className="flex gap-4">
  {/* Builder */}
  <div className="w-96">
    <NPCCollaborationBuilder
      onCollaborationComplete={(session) => {
        addCollaboration(session)
        setActiveCollaboration(session)
      }}
    />
  </div>

  {/* Results */}
  {activeCollaboration && (
    <div className="flex-1">
      <CollaborationResultViewer session={activeCollaboration} />
    </div>
  )}
</div>
```

### User Guide

For step-by-step instructions on using the multi-agent UI, see:
- [Multi-Agent UI User Guide](../03-user-guides/multi-agent-ui.md)

This guide covers:
- Creating NPC personas
- Running collaborations
- Interpreting results
- Selecting playtesters
- Reading test reports
- Best practices
- Troubleshooting

---

## API Integration

### Starting a Multi-Agent NPC Collaboration

```javascript
const response = await fetch('/api/generate-npc-collaboration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    npcPersonas: [
      {
        name: 'Wizard Aldric',
        personality: 'Wise, mysterious, patient',
        archetype: 'wizard',
        goals: ['Preserve ancient knowledge', 'Find worthy apprentice']
      },
      {
        name: 'Thief Raven',
        personality: 'Cunning, charismatic, selfish',
        archetype: 'thief',
        goals: ['Steal valuable artifacts', 'Avoid capture']
      }
    ],
    collaborationType: 'quest',
    context: {
      questSeed: 'A powerful artifact has been stolen from the wizard',
      location: 'Town square'
    },
    rounds: 6
  })
})

const result = await response.json()
console.log('Quest emerged from collaboration:', result.emergentContent.structuredOutput)
```

### Running a Playtester Swarm

```javascript
const response = await fetch('/api/generate-playtester-swarm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentToTest: {
      title: 'Dragon's Lair',
      objectives: ['Find the dragon', 'Defeat the dragon', 'Claim treasure'],
      rewards: ['5000 gold', 'Dragon Scale Armor']
    },
    contentType: 'quest',
    testerProfiles: ['completionist', 'casual', 'breaker', 'speedrunner', 'explorer']
  })
})

const result = await response.json()
console.log('Grade:', result.report.summary.grade)
console.log('Bugs found:', result.aggregatedMetrics.uniqueBugs)
console.log('Recommendations:', result.recommendations)
```

---

## Performance Considerations

### Multi-Agent NPC Collaboration

- **Parallel execution**: Not applicable (conversation is sequential)
- **Cost**: Scales with (agents × rounds × model cost)
- **Time**: ~2-5 seconds per round (depends on model)
- **Recommended**: 2-4 agents, 5-10 rounds

**Example Cost**:
- 3 agents × 8 rounds = 24 LLM calls
- Using GPT-4o-mini ($0.15 per 1M tokens)
- ~$0.01-0.05 per collaboration session

### AI Playtester Swarm

- **Parallel execution**: Default (all testers run simultaneously)
- **Cost**: Scales with (testers × model cost)
- **Time**: ~30-60 seconds for 5 testers (parallel)
- **Recommended**: 5-7 testers for good coverage

**Example Cost**:
- 5 testers × 1 test = 5 LLM calls
- Using Claude Sonnet ($3 per 1M tokens)
- ~$0.10-0.30 per swarm test

---

## Best Practices

### NPC Collaboration

1. **Limit rounds**: 5-10 rounds is optimal for most collaborations
2. **Clear personas**: Well-defined personalities lead to better interactions
3. **Use cross-validation**: Enable for important content
4. **Specific contexts**: Provide rich context for better emergent content
5. **Extract structured data**: Use type-specific processing (quest, lore, etc.)

### Playtester Swarm

1. **Diverse archetypes**: Use 5+ different tester types for good coverage
2. **Test early**: Run swarms before human testing to catch obvious bugs
3. **Act on recommendations**: The system provides actionable feedback
4. **Iterate**: Fix bugs, re-test, improve until grade ≥ B
5. **Track metrics**: Monitor difficulty and engagement trends

---

## Limitations and Future Work

### Current Limitations

1. **Context window**: Large collaborations may exceed model context limits
2. **Cost**: Multiple LLM calls per session can add up at scale
3. **Hallucinations**: Cross-validation helps but doesn't eliminate
4. **Language**: Currently English-only
5. **Testing depth**: Simulated testing can't replace all human testing

### Future Enhancements

1. **Streaming support**: Real-time updates as agents communicate
2. **Visual testing**: Screenshot analysis for UI/layout issues
3. **Memory persistence**: Long-term memory for recurring NPC interactions
4. **Multi-language**: Support for non-English content
5. **Hybrid testing**: Combine AI and human tester feedback

---

## Research References

### Multi-Agent Orchestration

1. **Multi-Agent Collaboration via Evolving Orchestration** (2025)
   - arxiv.org/html/2505.19591v1
   - Network-style organization with dynamic agent selection

2. **Multi-agent systems powered by large language models** (2025)
   - Frontiers in Artificial Intelligence
   - Swarm intelligence integration, cross-validation benefits

3. **OpenAI Swarm Framework**
   - Agent handoffs and routines
   - Coordinator + worker patterns

4. **LangGraph**
   - Dynamic graph-based multi-agent systems
   - Flexible agent coordination

### AI Playtesting

1. **Leveraging LLM Agents for Automated Video Game Testing** (2025)
   - arxiv.org/html/2509.22170v1
   - LLM agents for MMORPG testing, proactive state analysis

2. **Towards LLM-Based Automatic Playtest** (2025)
   - arxiv.org/html/2507.09490v1
   - Lap Framework for game state preprocessing

3. **LLMs May Not Be Human-Level Players, But They Can Be Testers** (2024)
   - arxiv.org/abs/2410.02829
   - Statistical correlation with human difficulty assessments

4. **Automated Video Game Testing Using Synthetic and Human-Like Agents** (2019)
   - IEEE Transactions on Games
   - Reinforcement learning and MCTS for synthetic testers

---

## Troubleshooting

### NPC Collaboration Issues

**Issue**: Agents repeat similar responses
**Solution**: Increase temperature (0.8-0.9), use more diverse personas

**Issue**: Conversation doesn't end naturally
**Solution**: Reduce maxRounds, add clearer end conditions in prompts

**Issue**: Low validation scores
**Solution**: Refine NPC personas, provide more context, check for logical inconsistencies

### Playtester Swarm Issues

**Issue**: All testers report same bugs
**Solution**: Working as intended! High report count = critical bug

**Issue**: Low engagement scores across all testers
**Solution**: Content may genuinely be unengaging, consider redesign

**Issue**: Difficulty scores vary widely
**Solution**: Normal for different skill levels, check difficultyByLevel breakdown

---

## Next Steps

- [Generation Pipeline](07-ai-pipeline/generation-pipeline.md) - Core AI generation system
- [NPC Generation](../06-backend/02-services.md#npc-generation-service) - Single NPC generation
- [Quest Generation](../06-backend/02-services.md#quest-generation-service) - Single quest generation
- [API Reference](../12-api-reference/01-rest-api.md) - Complete API documentation

---

[← Back to Features](../README.md)
