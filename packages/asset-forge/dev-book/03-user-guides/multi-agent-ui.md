# Multi-Agent AI Systems User Guide

Use AI agent collaborations and playtester swarms to create authentic content and automatically test your game.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [NPC Collaboration](#npc-collaboration)
  - [Creating NPC Personas](#creating-npc-personas)
  - [Running a Collaboration](#running-a-collaboration)
  - [Viewing Results](#viewing-results)
- [Playtester Swarm](#playtester-swarm)
  - [Selecting Content to Test](#selecting-content-to-test)
  - [Choosing Playtesters](#choosing-playtesters)
  - [Running Tests](#running-tests)
  - [Reading Test Reports](#reading-test-reports)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Asset Forge includes two cutting-edge multi-agent AI systems that push the boundaries of game content creation:

### 1. NPC Collaboration System
Multiple AI agents roleplay as different NPCs simultaneously, creating:
- **Authentic dialogue** through natural multi-character conversations
- **Emergent relationships** from repeated NPC interactions
- **Collaborative quests** where NPCs co-create storylines
- **Rich lore** through character perspectives

### 2. Playtester Swarm System
Deploy 5-10 AI agents with different playstyles to:
- **Find bugs** automatically (logic errors, broken triggers, unclear objectives)
- **Assess difficulty** with proven statistical correlation to human players
- **Predict engagement** before human testing
- **Generate reports** with grades (A-F) and actionable recommendations

### Research Foundation
These systems implement 2025 research from:
- OpenAI Swarm Framework (agent handoffs, routines)
- LangGraph (dynamic multi-agent coordination)
- ArXiv papers on LLM-based playtesting and cross-validation

---

## Prerequisites

### 1. API Configuration

Add your AI provider API key to `.env`:

```bash
# For Anthropic (Claude)
ANTHROPIC_API_KEY=your-anthropic-key

# For OpenAI (GPT-4)
OPENAI_API_KEY=your-openai-key

# Or use OpenRouter for multiple models
OPENROUTER_API_KEY=your-openrouter-key
```

### 2. Generated Content

Before using multi-agent systems:

**For NPC Collaboration:**
- Have 2+ generated NPCs OR
- Be ready to create custom NPC personas

**For Playtester Swarm:**
- Generate at least 1 quest
- Navigate to **Content Generation → Quests**
- Create a quest with objectives and rewards

---

## NPC Collaboration

### Accessing the Collaboration Tab

1. Open Asset Forge
2. Navigate to **Content Generation** page
3. Click the **Collaboration** tab

You'll see two panels:
- **Left**: NPC Collaboration Builder (configuration)
- **Right**: Collaboration Result Viewer (appears after running)

---

### Creating NPC Personas

#### Option 1: Create New NPC

1. Click **+ Create New NPC** button
2. Fill out the modal form:
   - **Name**: Character name (e.g., "Wizard Aldric")
   - **Personality**: Traits and demeanor (e.g., "Wise, mysterious, patient")
   - **Archetype** (optional): Role (e.g., "wizard", "merchant", "guard")
3. Click **Add NPC**

**Tips:**
- Be specific with personality traits
- Add unique quirks to make characters memorable
- Consider contrasting personalities for interesting dynamics

#### Option 2: Import from Generated NPCs

1. Click **Import from Generated** dropdown
2. Select an NPC from your generated list
3. The NPC's personality and traits are automatically imported

**Benefits:**
- Uses NPCs you've already created
- Pre-filled personality and background
- Consistent with your existing content

#### Minimum Requirement
You need **at least 2 NPCs** to run a collaboration. Most collaborations work best with 2-4 NPCs.

---

### Running a Collaboration

#### Step 1: Choose Collaboration Type

Select one of 5 collaboration types:

1. **Dialogue**
   - Natural conversation to establish personalities
   - Best for: First-time NPC meetings, character introductions
   - Output: Authentic dialogue exchanges, relationship seeds

2. **Quest Co-Creation**
   - NPCs collaborate to design a quest together
   - Best for: Multi-NPC quest chains, emergent storylines
   - Output: Quest objectives, narrative hooks, structured quest data

3. **Lore Building**
   - NPCs share knowledge and world history
   - Best for: World-building, backstory creation, mysteries
   - Output: Lore fragments, historical events, world context

4. **Relationship Development**
   - NPCs interact to develop their relationship
   - Best for: Friendships, rivalries, mentorships, romances
   - Output: Relationship dynamics, emotional beats, character growth

5. **Freeform**
   - Open-ended interaction without structure
   - Best for: Social simulations, background interactions
   - Output: Emergent content, surprising interactions

#### Step 2: Provide Context (Optional but Recommended)

Add context to guide the collaboration:

- **Location**: Where the NPCs are meeting (e.g., "Town square", "Tavern")
- **Situation**: What's happening (e.g., "First day of training", "Negotiating a trade deal")

**Example Context:**
```
Location: Training grounds
Situation: Veteran guard captain training a new recruit on first day
```

Better context = more focused, authentic interactions.

#### Step 3: Configure Settings

**Conversation Rounds (3-15)**
- Use slider to set how many back-and-forth exchanges
- **3-5 rounds**: Quick interaction, establishing basics
- **6-10 rounds**: Standard collaboration (recommended)
- **11-15 rounds**: Deep exploration, complex relationships

**AI Model (Optional)**
- Leave default or select specific model
- Claude Sonnet 4 recommended for best quality
- GPT-4o also works well

**Cross-Validation**
- ✅ **Enabled** (recommended): Reduces hallucinations by 40%
- Uses 1-3 validator agents to verify content quality
- Adds ~20-30% more cost but significantly improves output
- Provides confidence scores and quality metrics

#### Step 4: Start Collaboration

1. Click **✨ Start Collaboration**
2. Wait while agents communicate (10-60 seconds depending on rounds)
3. Progress indicator shows collaboration status
4. Results appear automatically in right panel

---

### Viewing Results

The Collaboration Result Viewer has 4 tabs:

#### 1. Conversation Tab

Shows the complete conversation history:

```
┌─────────────────────────────────────────────┐
│ Round 1 | Guard Captain Marcus | 10:23 AM   │
│ "Welcome to the guard, recruit..."          │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ Round 2 | Recruit Emma | 10:23 AM           │
│ "Thank you, Captain! I'm honored..."        │
└─────────────────────────────────────────────┘
```

- Each round shows speaker, timestamp, and content
- Dialogue flows naturally between agents
- Look for character consistency and authentic voices

#### 2. Relationships Tab

Shows emergent relationships discovered:

```
┌──────────────────────────────────────────────┐
│ Guard Captain Marcus & Recruit Emma          │
│ Type: mentor-student                          │
│ Interactions: 8                               │
│                                               │
│ Sentiment:                                    │
│ 🟢 Positive: 6  ⚪ Neutral: 2  🔴 Negative: 0 │
└──────────────────────────────────────────────┘
```

**Relationship Types:**
- Mentor-student, allies, rivals, friends, romantic, familial, professional

**Sentiment Breakdown:**
- Positive: Supportive, friendly interactions
- Neutral: Factual, transactional exchanges
- Negative: Conflict, disagreement, tension

#### 3. Structured Output Tab

Raw JSON data extracted from the collaboration:

```json
{
  "relationships": [
    {
      "agents": ["Guard Captain Marcus", "Recruit Emma"],
      "type": "mentor-student",
      "bond_strength": "strong",
      "key_moments": [...]
    }
  ],
  "quest_hooks": [...],
  "lore_fragments": [...]
}
```

- Use this for programmatic integration
- Copy-paste into your game systems
- Contains all extracted structured data

#### 4. Validation Tab

Cross-validation quality metrics (if enabled):

```
Validation Status: ✅ Validated
Confidence: 87%

Scores:
┌──────────────┬──────────────┬──────────────┐
│ Consistency  │ Authenticity │ Quality      │
│    8.7/10    │    9.0/10    │    8.3/10    │
└──────────────┴──────────────┴──────────────┘

Validated by 3 agents
```

**Score Meanings:**
- **Consistency (1-10)**: Logical coherence, no contradictions
- **Authenticity (1-10)**: Character stays true to personality
- **Quality (1-10)**: Overall content quality

**Confidence:**
- 80%+ = High quality, ready to use
- 60-79% = Good quality, minor inconsistencies
- <60% = Review carefully, may need regeneration

#### Export Results

Click **📥 Export** to download:
- Filename: `collaboration-{sessionId}.json`
- Contains full conversation, relationships, validation data
- Import into your game or documentation system

---

## Playtester Swarm

### Accessing the Playtest Tab

1. Navigate to **Content Generation** page
2. Click the **Playtest** tab

You'll see the Playtester Swarm Panel with configuration and results sections.

---

### Selecting Content to Test

#### Step 1: Choose a Quest

The panel shows all your generated quests:

```
┌───────────────────────────────────────────────┐
│ ✓ Dragon's Lair Raid                         │
│ 5 objectives • hard difficulty                │
└───────────────────────────────────────────────┘
┌───────────────────────────────────────────────┐
│   Goblin Camp Rescue                          │
│ 3 objectives • medium difficulty              │
└───────────────────────────────────────────────┘
```

Click on a quest to select it (checkmark appears when selected).

**What gets tested:**
- Quest title and description
- All objectives
- Rewards
- Difficulty balance
- Clarity of instructions

---

### Choosing Playtesters

#### Understanding Tester Personas

The system includes 7 research-based playtester archetypes:

1. **🔵 Completionist** (Intermediate)
   - Thorough, finds everything
   - Tests: Missing content, incomplete features
   - Playstyle: Explores all paths, checks every corner

2. **🔴 Speedrunner** (Expert)
   - Efficient, seeks optimal paths
   - Tests: Sequence breaks, exploits, pacing
   - Playstyle: Skips content, finds shortcuts

3. **🟢 Explorer** (Intermediate)
   - Boundary-testing, experimental
   - Tests: Edge cases, unusual interactions
   - Playstyle: Tries unexpected actions

4. **🟡 Casual** (Beginner)
   - Relaxed, may miss hints
   - Tests: Confusing instructions, difficulty spikes
   - Playstyle: Follows obvious paths only

5. **🟣 Min-Maxer** (Expert)
   - Optimization-focused
   - Tests: Balance issues, exploitable strategies
   - Playstyle: Calculates optimal builds

6. **🩷 Roleplayer** (Intermediate)
   - Story and immersion focused
   - Tests: Narrative inconsistencies, immersion breaks
   - Playstyle: Makes story-driven choices

7. **🟠 Breaker** (Expert)
   - Adversarial, tries to break things
   - Tests: Critical bugs, error states
   - Playstyle: Does the unexpected, stress tests

#### Selecting Personas

**Quick Selection:**
- **Use Default (5)**: Completionist, Casual, Breaker, Speedrunner, Explorer
  - Recommended for most testing
  - Good coverage of playstyles
  - Balances beginner/expert perspectives

- **Select All**: All 7 personas
  - Maximum coverage
  - Longer test time
  - Higher cost

- **Clear**: Remove all selections

**Manual Selection:**
1. Click on persona cards to toggle selection
2. Checkmark (✓) appears when selected
3. Minimum 1 tester, maximum 7 testers

**Tips for Choosing:**
- **Early testing**: Use 3-5 testers (Completionist, Casual, Breaker)
- **Pre-release**: Use all 7 testers for thorough coverage
- **Difficulty testing**: Include Casual + Speedrunner + Min-Maxer
- **Bug hunting**: Always include Breaker + Explorer
- **Narrative testing**: Include Roleplayer

---

### Running Tests

#### Step 1: Configure Test Settings

**Parallel Testing**
- ✅ **Enabled** (default): All testers run simultaneously
  - Faster (30-60 seconds)
  - Higher concurrent API usage
- ❌ **Disabled**: Testers run one at a time
  - Slower but lower resource usage

**AI Model (Optional)**
- Leave default or select specific model
- Claude Sonnet 4 recommended for best testing quality

#### Step 2: Run the Swarm

1. Ensure quest is selected
2. Choose at least 1 playtester
3. Click **▶️ Run Swarm Test (X testers selected)**
4. Wait while the swarm runs (30-90 seconds)
5. Report appears automatically when complete

---

### Reading Test Reports

The test report is divided into several sections:

#### Overall Grade

```
┌──────────────────────────┐
│         B                │
│       82/100             │
└──────────────────────────┘
```

**Grade Scale:**
- **A (90-100)**: Production-ready, excellent
- **B (80-89)**: Production-ready with minor improvements
- **C (70-79)**: Needs improvements
- **D (60-69)**: Major rework needed
- **F (<60)**: Not ready, critical issues

#### Summary Metrics

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Completion   │ Difficulty   │ Engagement   │ Total Bugs   │
│     80%      │    6.4/10    │    7.2/10    │      3       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Metric Meanings:**
- **Completion Rate**: % of testers who completed the quest
  - 80%+ = Well-designed
  - 50-79% = Some confusion
  - <50% = Major issues

- **Difficulty**: Average difficulty rating (0-10)
  - <4 = Too easy
  - 4-7 = Balanced
  - 7+ = Too hard
  - Also broken down by skill level (beginner/intermediate/expert)

- **Engagement**: How engaging the content is (0-10)
  - 7+ = Highly engaging
  - 5-7 = Adequate
  - <5 = Boring or frustrating

- **Total Bugs**: Count of all reported issues

#### Recommendation

```
┌────────────────────────────────────────────────┐
│ ℹ️  PASS WITH CHANGES                          │
│                                                │
│ 5 AI playtesters evaluated this content.      │
│ 4 of 5 completed successfully. Average        │
│ difficulty was 6.4/10. 3 potential issues     │
│ reported. Fix 1 major bug before release.     │
└────────────────────────────────────────────────┘
```

**Recommendation Types:**
- **PASS**: Ready for release
- **PASS WITH CHANGES**: Fix minor issues first
- **FAIL**: Significant problems, not ready

#### Bug Reports

```
┌─────────────────────────────────────────────────┐
│ 🔴 MAJOR | Reported 3x                         │
│ Objective "Find merchant's location" has no    │
│ quest marker, confusing for new players        │
│ Reported by: Jordan, Alex, Casey               │
└─────────────────────────────────────────────────┘
```

**Bug Severity:**
- **🔴 Critical**: Game-breaking, prevents completion
- **🟠 Major**: Significant issue, degrades experience
- **🟡 Minor**: Small issue, doesn't block progress

**Report Count:**
- Multiple reports of same bug = higher priority
- If 3+ testers report it, it's likely a real issue

**Filter Bugs:**
Click severity filters to show only:
- All
- Critical
- Major
- Minor

#### Recommendations

```
┌─────────────────────────────────────────────────┐
│ 🚨 HIGH | BUGS                                  │
│ 1 major bug must be fixed                      │
│ Action: Add quest marker for merchant location │
└─────────────────────────────────────────────────┘
```

**Priority Levels:**
- **🚨 Critical**: Fix immediately
- **⚠️ High**: Fix before release
- **📌 Medium**: Improve when possible
- **💡 Info**: Consider for future updates

**Categories:**
- Bugs, Difficulty, Engagement, Pacing, Clarity

#### Export Report

Click **📥 Export** to download full report JSON:
- All tester feedback
- Detailed metrics by persona
- Raw test data
- Use for documentation or tracking

---

## Best Practices

### NPC Collaboration

1. **Start with 2-3 NPCs**
   - Easier to manage
   - More focused conversations
   - Better for establishing relationships

2. **Use Clear Personas**
   - Well-defined personalities lead to better interactions
   - Include goals and motivations
   - Add unique traits or quirks

3. **Provide Rich Context**
   - Location and situation ground the conversation
   - Specific details generate better content
   - Consider time, mood, previous events

4. **Enable Cross-Validation for Important Content**
   - Worth the extra cost for main story NPCs
   - Catches inconsistencies early
   - Provides confidence metrics

5. **Optimal Round Counts**
   - 3-5 rounds: Quick interactions, introductions
   - 6-8 rounds: Standard collaborations (recommended)
   - 10-15 rounds: Deep character development

6. **Review and Edit**
   - AI-generated dialogue is a starting point
   - Edit for your game's tone and style
   - Remove or modify any off-brand content

### Playtester Swarm

1. **Test Early and Often**
   - Run swarms before human playtesting
   - Catch obvious bugs automatically
   - Iterate quickly on feedback

2. **Use Diverse Persona Combinations**
   - Always include Casual (beginners) + Breaker (bugs)
   - Add Speedrunner to catch sequence issues
   - Include Roleplayer for narrative content

3. **Act on High-Priority Recommendations**
   - Critical and High priority = fix before release
   - Medium = address if time allows
   - Info = future enhancements

4. **Iterate Until Grade ≥ B**
   - B or higher = production-ready
   - C = needs work
   - D/F = major redesign needed

5. **Cross-Reference Reports**
   - Bugs reported by 3+ testers = definitely fix
   - Single reports may be edge cases
   - Look for patterns across personas

6. **Use Difficulty Breakdown**
   - Check beginner/intermediate/expert scores separately
   - Ensure appropriate challenge for target audience
   - Adjust if one skill level is outlier

7. **Monitor Engagement Scores**
   - Low engagement across all personas = redesign
   - Low engagement for specific persona = acceptable
   - High engagement = keep what works

---

## Troubleshooting

### NPC Collaboration Issues

**Problem: Agents repeat similar responses**

**Solution:**
- Add more diverse personalities
- Increase variety in character goals
- Try different collaboration type
- Increase temperature in model settings (if available)

**Problem: Conversation doesn't feel natural**

**Solution:**
- Provide more context (location, situation)
- Reduce number of NPCs (try 2-3 instead of 4+)
- Use more specific personality traits
- Enable cross-validation for quality check

**Problem: Low validation scores (<70)**

**Solution:**
- Refine NPC personas to be more distinct
- Add more background/context information
- Check for conflicting personality traits
- Reduce conversation rounds (try 6-8)
- Review results for logical inconsistencies

**Problem: NPCs aren't staying in character**

**Solution:**
- Make personality descriptions more detailed
- Add specific goals and motivations
- Include background story
- Use archetype field for role clarity

### Playtester Swarm Issues

**Problem: All testers report same bug**

**Solution:**
- This is actually GOOD! High agreement = real issue
- Fix the bug - if everyone sees it, it's critical
- Re-test after fixing

**Problem: Test takes too long**

**Solution:**
- Reduce number of testers (try 3-5 instead of 7)
- Enable parallel testing
- Use faster AI model (if available)

**Problem: Conflicting difficulty ratings**

**Solution:**
- This is NORMAL - different skill levels have different experiences
- Check difficulty breakdown by level (beginner/intermediate/expert)
- Decide which audience you're targeting
- Adjust quest for that target audience

**Problem: Low engagement scores across all testers**

**Solution:**
- Content may genuinely need improvement
- Add more variety to objectives
- Improve narrative hooks
- Add unexpected twists or surprises
- Consider quest redesign

**Problem: "No content selected" error**

**Solution:**
- Generate a quest first (Content Generation → Quests tab)
- Select a quest from the list before running test
- Ensure quest has objectives and rewards

**Problem: API errors during testing**

**Solution:**
- Check `.env` has correct API keys
- Verify API key is properly configured
- Try again in a few moments (may be rate limit)
- Check server logs for detailed error

---

## Next Steps

**Learn More:**
- [Multi-Agent Systems Architecture](../08-features/multi-agent-systems.md) - Technical deep dive
- [Frontend Components](../05-frontend/components-overview.md) - Component documentation
- [State Management](../04-architecture/state-management.md) - useMultiAgentStore details
- [API Reference](../12-api-reference/rest-api.md) - Backend endpoints

**Related Features:**
- [Quest Generation](./asset-generation.md) - Create quests for playtesting
- [NPC Generation](./asset-generation.md) - Generate NPCs for collaborations
- [Voice Generation](./voice-generation.md) - Add voices to collaboration dialogue

---

**Have questions or feedback?** Open an issue on GitHub or check the troubleshooting section above.
