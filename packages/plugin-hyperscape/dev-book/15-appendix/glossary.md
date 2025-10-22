# Glossary

[← Back to Index](../README.md)

---

## Terms and Concepts

### A

**Action**
A discrete operation that an AI agent can perform in the Hyperscape world. Examples: `chopTree`, `goto`, `perception`. Actions include validation logic and execution handlers.

**Agent**
An AI-powered character controlled by ElizaOS that exists in the Hyperscape world. Agents can navigate, interact, chat, and perform tasks autonomously.

**Ambient Action**
Actions that express personality or idle behavior, such as emotes, animations, or gestures (waving, dancing, sitting).

**Autonomous Behavior**
Agent behavior driven by evaluators rather than explicit player commands. The agent decides what to do based on goals, boredom, and learned facts.

---

### B

**Banking System**
RPG feature allowing agents to deposit and withdraw items from a shared storage location (bank). Prevents inventory limitations.

**Boredom Evaluator**
An evaluator that detects when an agent has been idle too long and triggers exploratory or random actions to prevent stagnation.

**Build Manager**
Manager responsible for world building operations: placing, removing, and modifying entities in the 3D world.

---

### C

**Character**
The configuration defining an agent's personality, behaviors, goals, and appearance. Defined in JSON character files.

**ColorDetector**
Visual testing system that detects entities in the 3D world by their color. Used for visual test verification.

**Content Pack**
A reusable bundle of character definitions, behaviors, and configurations that can be shared and imported.

**Context Provider**
See [Provider](#provider).

---

### D

**Dynamic Action Loader**
Manager that loads RPG actions dynamically when the game world supports them, rather than loading all actions upfront.

---

### E

**ECS (Entity-Component-System)**
Hyperscape's architecture pattern where entities are composed of components and modified by systems. Enables flexible, performant game logic.

**ElizaOS**
AI agent framework that powers the agents. Provides LLM integration, memory, action/provider/evaluator systems.

**Emote**
A non-verbal expression or animation performed by an agent (wave, dance, laugh, etc.). Controlled by the `ambient` action.

**Evaluator**
Component that assesses agent state and recommends actions. Types: Goal Evaluator, Boredom Evaluator, Fact Evaluator.

**Event Handler**
Function that listens for world events (chat messages, entity spawns, state changes) and triggers agent responses.

---

### F

**Fact Evaluator**
Evaluator that learns and remembers facts about the world (NPC locations, resource spots, quest info) for future reference.

---

### G

**Goal**
An explicit objective the agent is trying to achieve (e.g., "collect 10 logs", "explore the forest"). Goals have priorities and drive action selection.

**Goal Evaluator**
Evaluator that pursues explicit goals by selecting and executing appropriate actions to achieve goal objectives.

**goto Action**
Core action for navigation. Moves the agent to a specified location or entity in the 3D world using pathfinding.

---

### H

**Handler**
The execution function of an action. Performs the actual operation after validation passes. Example: `chopTreeAction.handler()`.

**Hyperscape**
3D multiplayer game engine built with Three.js. Provides the virtual world where agents exist and interact.

**HyperscapeService**
The main service class that manages the agent's connection to the Hyperscape world, handles state synchronization, and coordinates sub-managers.

---

### I

**Inventory**
Collection of items an agent is carrying. Managed by the RPG system with capacity limits and equipment slots.

---

### L

**LLM (Large Language Model)**
AI model used for agent decision-making and natural language understanding. Examples: GPT-4, Claude 3.

---

### M

**Manager**
Specialized subsystem that handles a specific domain (behavior, building, messages, multi-agent coordination, etc.).

**Memory**
ElizaOS concept for storing and recalling past interactions, learned facts, and conversation context.

---

### P

**Perception Action**
Core action that scans the environment and identifies nearby entities. Provides environmental awareness for decision-making.

**Playwright**
Browser automation tool used for real-world testing. Allows tests to control a real browser and verify visual + behavioral correctness.

**Plugin**
ElizaOS extension that adds new capabilities. Plugin Hyperscape is a plugin that adds 3D world integration.

**Provider**
Component that injects context into agent prompts. Examples: world provider (nearby entities), character provider (health/inventory), skills provider (skill levels).

---

### R

**Real Testing**
Testing philosophy where tests run against real Hyperscape instances with no mocks. Tests verify actual gameplay, state changes, and visual results.

**RPG (Role-Playing Game)**
Game genre with character progression, skills, inventory, quests. Plugin Hyperscape includes full RPG systems.

**RPG State Manager**
Manager that tracks and synchronizes agent's RPG state: skills, inventory, quests, health, etc.

**Runtime**
ElizaOS agent runtime - the execution environment where the agent, plugins, actions, and providers live.

---

### S

**Service**
Long-lived component in ElizaOS plugins. HyperscapeService maintains the WebSocket connection and manages world state.

**Skill**
RPG progression system. Agents have skills like woodcutting, fishing, cooking that level up through use.

**State Check**
Test verification that checks agent state (inventory, skills, position) against expected values.

**State Manager**
See [RPG State Manager](#rpg-state-manager).

---

### T

**Template**
Visual template defining the color signature of an entity type. Used by ColorDetector for visual testing.

**Three.js**
JavaScript 3D graphics library. Hyperscape is built on Three.js for rendering the 3D world.

---

### V

**Validation**
Pre-execution check performed by actions to determine if they can run (has equipment, target in range, sufficient skill level, etc.).

**Visual Check**
Test verification that uses ColorDetector to confirm entities exist (or don't exist) at expected positions with expected colors.

**Visual Testing Framework**
Testing system that verifies agent behavior using visual detection (ColorDetector) and state verification.

---

### W

**WebSocket**
Real-time bidirectional communication protocol. Used for agent ↔ Hyperscape world communication.

**World Provider**
Provider that injects world state context: nearby entities, current location, time of day, weather.

**World State Manager**
Manager that tracks and synchronizes the overall world state: entities, players, environment.

---

## Acronyms

- **AI**: Artificial Intelligence
- **API**: Application Programming Interface
- **ECS**: Entity-Component-System
- **LLM**: Large Language Model
- **NPC**: Non-Player Character
- **RPG**: Role-Playing Game
- **UI**: User Interface
- **WS**: WebSocket
- **XP**: Experience Points

---

## Action Names

- **ambient**: Perform emotes/animations
- **bankItems**: Deposit/withdraw from bank
- **build**: Place/modify entities
- **catchFish**: Catch fish at fishing spots
- **checkInventory**: Inspect inventory
- **chopTree**: Chop trees for logs
- **continue**: Continue previous action
- **cookFood**: Cook raw food
- **goto**: Navigate to location/entity
- **ignore**: Ignore messages/users
- **lightFire**: Start campfires
- **perception**: Scan environment
- **reply**: Respond to chat messages
- **stop**: Stop movement
- **unuse**: Stop using item
- **use**: Use item/interact
- **walk_randomly**: Wander exploration

---

## Provider Names

- **actions**: Available actions context
- **banking**: Bank contents and locations
- **boredom**: Boredom level and triggers
- **character**: Character state (health, inventory, equipment)
- **emote**: Available emotes
- **facts**: Learned facts about the world
- **skills**: Skill levels and XP
- **time**: Time of day and duration context
- **world**: World state (nearby entities, location, weather)

---

## Evaluator Names

- **boredom**: Detect and prevent idle stagnation
- **fact**: Learn and recall world facts
- **goal**: Pursue explicit objectives

---

## Manager Names

- **BehaviorManager**: Coordinate agent behaviors
- **BuildManager**: World building operations
- **ContentPackLoader**: Load content packs
- **DynamicActionLoader**: Dynamically load RPG actions
- **EmoteManager**: Manage emotes and animations
- **MessageManager**: Handle chat messages
- **MultiAgentManager**: Coordinate multiple agents
- **PlaywrightManager**: Browser automation for testing
- **VoiceManager**: Voice chat integration

---

## File Extensions

- **.ts**: TypeScript source file
- **.json**: JSON configuration file
- **.md**: Markdown documentation file
- **.glb**: 3D model file (binary glTF)
- **.env**: Environment variables file

---

## Color Codes (Visual Testing)

Visual templates use hex colors for entity identification:

| Entity | Color Code | Hex |
|--------|-----------|-----|
| Player | 16729411 | #FF4543 |
| Tree | 2263842 | #228822 |
| Fish Spot | 255 | #0000FF |
| Goblin | 2263842 | #228822 |
| Rock | 4210752 | #404040 |
| Gold Rock | 16766720 | #FFD700 |

---

## See Also

- [FAQ](faq.md) - Common questions
- [Resources](resources.md) - External links
- [API Reference](../12-api-reference/action-api.md) - Technical details

---

[← Back to Index](../README.md)
