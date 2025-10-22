# Quick Start Guide

[← Back to Index](../README.md)

---

## Create Your First AI Agent in 5 Minutes

This guide will walk you through creating a functional AI agent that can navigate, interact, and chat in a Hyperscape 3D world.

---

## Step 1: Install Prerequisites

```bash
# Install ElizaOS CLI
npm install -g elizaos

# Verify installation
elizaos --version
```

---

## Step 2: Create a New Project

```bash
# Create new ElizaOS project
elizaos create my-hyperscape-agent
cd my-hyperscape-agent

# Install Plugin Hyperscape
npm install @hyperscape/plugin-hyperscape
```

---

## Step 3: Configure Environment

Create `.env` file in project root:

```bash
# API Keys for LLMs
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Hyperscape Server URL
DEFAULT_HYPERSCAPE_WS_URL=ws://localhost:5555/ws

# Optional: Custom settings
LOG_LEVEL=info
```

---

## Step 4: Create Your Agent Character

Create `characters/explorer.json`:

```json
{
  "name": "ExplorerAgent",
  "bio": [
    "I am an adventurous AI agent who loves exploring new worlds.",
    "I enjoy helping players find resources and interesting locations.",
    "I'm always curious about my surroundings and eager to learn."
  ],
  "lore": [
    "Created in the ElizaOS laboratory",
    "First mission: Explore the Hyperscape realm",
    "Equipped with advanced spatial awareness"
  ],
  "messageExamples": [
    [
      {
        "user": "{{user1}}",
        "content": { "text": "Hey, can you help me find some trees?" }
      },
      {
        "user": "ExplorerAgent",
        "content": {
          "text": "Of course! Let me scan the area. I see several trees to the north. Follow me!"
        }
      }
    ],
    [
      {
        "user": "{{user1}}",
        "content": { "text": "What do you see around us?" }
      },
      {
        "user": "ExplorerAgent",
        "content": {
          "text": "I'm scanning now... I detect 3 trees nearby, a fishing spot to the east, and what looks like a merchant NPC in the distance. What interests you?"
        }
      }
    ]
  ],
  "postExamples": [],
  "topics": [
    "exploration",
    "resource gathering",
    "world navigation",
    "helping players"
  ],
  "style": {
    "all": [
      "Be helpful and enthusiastic",
      "Describe surroundings when relevant",
      "Suggest actions based on context",
      "Stay in character as an explorer"
    ],
    "chat": [
      "Respond naturally to questions",
      "Offer assistance proactively",
      "Share interesting discoveries"
    ]
  },
  "adjectives": [
    "curious",
    "helpful",
    "adventurous",
    "observant",
    "friendly"
  ],
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "settings": {
    "DEFAULT_HYPERSCAPE_WS_URL": "ws://localhost:5555/ws"
  },
  "modelProvider": "openai",
  "model": "gpt-4"
}
```

---

## Step 5: Start Hyperscape Server (Local Testing)

In a separate terminal:

```bash
# Navigate to Hyperscape package
cd node_modules/@hyperscape/hyperscape

# Start server
npm start

# Server will run on ws://localhost:5555/ws
```

Or connect to an existing Hyperscape server by updating the WebSocket URL in your `.env`.

---

## Step 6: Run Your Agent

```bash
# Start the agent
elizaos start --character characters/explorer.json

# Or in development mode with hot-reload
elizaos dev --character characters/explorer.json
```

You should see output like:

```
[INFO] Loading character: ExplorerAgent
[INFO] Initializing Hyperscape Integration plugin
[INFO] Connecting to Hyperscape server: ws://localhost:5555/ws
[INFO] ✅ Connected to Hyperscape world
[INFO] Agent spawned at position (0, 0, 0)
[INFO] Available actions: PERCEPTION, GOTO_ENTITY, USE_ITEM, ...
[INFO] Agent is ready!
```

---

## Step 7: Interact with Your Agent

### Chat with the Agent

In the Hyperscape world interface, type a message:

```
Player: Hey there! What do you see around us?
```

The agent will:
1. Process your message with the LLM
2. Use the `perception` action to scan surroundings
3. Generate a contextual response
4. Reply with nearby entities

```
ExplorerAgent: Hi! I'm scanning the area now... I detect:
- 5 trees to the north (~20m away)
- A fishing spot to the east (~35m)
- Another player to the south (~15m)
- A bank building to the west (~50m)

What would you like to explore first?
```

### Test Actions

Try these commands:

```
Player: Can you chop down a tree?
```

The agent will:
1. Validate it has an axe equipped
2. Find the nearest tree using `perception`
3. Execute `goto` to navigate to the tree
4. Execute `chopTree` action
5. Report the results

```
ExplorerAgent: Sure! Let me find a tree... I see one nearby.
[Agent walks to tree]
[Agent starts chopping]
ExplorerAgent: I chopped the tree and got 3 logs! My woodcutting skill is now level 2.
```

---

## Step 8: Test Autonomous Behavior

The agent will also act autonomously based on evaluators:

### Boredom Evaluator

If the agent is idle for 30 seconds:

```
[BOREDOM] Agent has been idle too long
[ACTION] Executing: walk_randomly
ExplorerAgent: I think I'll explore a bit...
[Agent wanders around]
```

### Goal Evaluator

If the agent has a goal:

```
[GOAL] Goal: Collect 10 logs (Priority: 8)
[ACTION] Executing: perception (find trees)
[ACTION] Executing: goto (navigate to tree)
[ACTION] Executing: chopTree
ExplorerAgent: I'm working on collecting wood. I have 5/10 logs so far!
```

---

## What Just Happened?

Let's break down what your agent can now do:

### 1. World Awareness (Providers)

```typescript
// Agent always knows:
- Current position in 3D space
- Nearby entities (players, NPCs, objects)
- Inventory contents
- Skill levels
- World state (time, weather)
```

### 2. Action Execution (Actions)

```typescript
// Agent can:
- perception: Scan environment
- goto: Navigate to locations
- use: Use items/interact
- chopTree: Gather wood
- catchFish: Catch fish
- reply: Chat with players
- walk_randomly: Explore
- And 13+ more actions
```

### 3. Intelligent Decision-Making (Evaluators)

```typescript
// Agent decides based on:
- Current goals (collect resources, explore)
- Boredom level (prevent stagnation)
- Learned facts (remembers locations, NPCs)
- Player requests (chat messages)
```

---

## Next Steps

### Customize Your Agent

#### Add Custom Goals

Edit `characters/explorer.json`:

```json
{
  "goals": [
    {
      "type": "gather",
      "target": "logs",
      "quantity": 100,
      "priority": 10
    },
    {
      "type": "explore",
      "area": "forest",
      "priority": 7
    }
  ]
}
```

#### Change Personality

Update the `bio` and `style` fields to create different personalities:

```json
{
  "bio": [
    "I am a serious warrior focused on combat training.",
    "I protect weak players from danger."
  ],
  "style": {
    "all": [
      "Be direct and focused",
      "Prioritize combat and defense",
      "Speak like a warrior"
    ]
  }
}
```

### Explore More Features

- [Using Actions](../03-user-guides/using-actions.md) - Learn all 20+ actions
- [Goal-Based AI](../03-user-guides/goal-based-ai.md) - Configure autonomous behavior
- [Testing Your Agent](../03-user-guides/testing-agents.md) - Write tests

### Build Advanced Agents

- [Creating Characters](../03-user-guides/creating-characters.md) - Advanced character design
- [Content Packs](../10-content-packs/content-pack-system.md) - Reusable configurations
- [Adding Actions](../11-development/adding-actions.md) - Create custom actions

---

## Troubleshooting

### Agent Won't Connect

```bash
# Check server is running
curl http://localhost:5555/health

# Check WebSocket URL
echo $DEFAULT_HYPERSCAPE_WS_URL

# View agent logs
elizaos start --character characters/explorer.json --log-level debug
```

### Agent Not Responding

```bash
# Check LLM API key
echo $OPENAI_API_KEY

# Try with a different model
# Edit character file: "model": "gpt-3.5-turbo"
```

### Actions Failing

```bash
# Enable debug logs
LOG_LEVEL=debug elizaos start --character characters/explorer.json

# Check action validation:
# - Does agent have required items?
# - Are there nearby entities to interact with?
# - Does agent have permission?
```

---

## Example Output

Here's what a successful agent session looks like:

```
[09:15:23] [INFO] ExplorerAgent connected to world
[09:15:24] [PERCEPTION] Scanning environment...
[09:15:24] [PERCEPTION] Found 5 entities: 3 trees, 1 fishing_spot, 1 player
[09:15:30] [CHAT] Player: "Hey, can you help me get wood?"
[09:15:32] [LLM] Processing message...
[09:15:33] [ACTION] Validating: chopTree
[09:15:33] [ACTION] Validation passed
[09:15:33] [REPLY] "Sure! I see trees nearby. Let me chop one for you."
[09:15:35] [GOTO] Navigating to tree-001
[09:15:38] [ACTION] Executing: chopTree
[09:15:40] [SUCCESS] Chopped tree. Gained 3 logs, +10 XP
[09:15:42] [REPLY] "Done! I got 3 logs. Need more?"
```

---

## Congratulations!

You now have a working AI agent in a 3D world!

Explore the rest of the documentation to unlock more advanced features.

---

[← Back to Index](../README.md) | [← Previous: Installation](installation.md) | [Next: Configuration →](configuration.md)
