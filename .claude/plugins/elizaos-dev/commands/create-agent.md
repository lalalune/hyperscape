---
description: Create ElizaOS agent character for Hyperscape NPC
---

# Create ElizaOS Agent Character

Creating intelligent NPC using **ElizaOS framework** (ADR-0005).

## Agent Components

1. **Character file** - Personality, bio, lore, message examples
2. **Actions** - Game actions (attack, trade, move) in plugin-hyperscape
3. **Providers** - Game state queries (inventory, health, position)
4. **Evaluators** - Behavior triggers and conditions
5. **Memory** - Conversation history and relationship tracking

## Character Template

I'll create a character with:
- Name and description
- Personality traits and style
- Example messages (adjectives, message examples)
- Topics and knowledge areas
- Available actions from plugin-hyperscape

## LLM Provider Options

Per ADR-0005, we support:
- **OpenAI GPT-4** - Complex quests, nuanced dialogue
- **Anthropic Claude** - Long conversations, world lore
- **GPT-3.5 Turbo** - Simple vendor interactions

What type of NPC would you like to create? I'll use Deepwiki to research ElizaOS character patterns.
