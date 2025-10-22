# Architecture Overview Diagram

[← Back to Index](../README.md)

---

## Complete System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ELIZAOS AGENT RUNTIME                                │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Core ElizaOS Components                                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Memory     │  │   Models     │  │  Base        │                 │ │
│  │  │   (RAG)      │  │   (LLMs)     │  │  Services    │                 │ │
│  │  │              │  │              │  │              │                 │ │
│  │  │ - Vector DB  │  │ - GPT-4      │  │ - Runtime    │                 │ │
│  │  │ - History    │  │ - Claude     │  │ - Lifecycle  │                 │ │
│  │  │ - Context    │  │ - Ollama     │  │ - Events     │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│                                    │ Plugin Interface                         │
│                                    ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                  HYPERSCAPE PLUGIN LAYER                                │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Actions (20+)                                                    │   │ │
│  │  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │ │
│  │  │ │ perception │ │    goto    │ │    use     │ │   chopTree   │  │   │ │
│  │  │ └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │   │ │
│  │  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │ │
│  │  │ │ catchFish  │ │ lightFire  │ │ cookFood   │ │  bankItems   │  │   │ │
│  │  │ └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Evaluators (3)                                                   │   │ │
│  │  │ ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────┐  │   │ │
│  │  │ │ Goal Evaluator   │ │Boredom Evaluator │ │ Fact Evaluator  │  │   │ │
│  │  │ │ - Goal pursuit   │ │- Prevent stasis  │ │ - Learn facts   │  │   │ │
│  │  │ │ - Priorities     │ │- Trigger action  │ │ - Recall info   │  │   │ │
│  │  │ └──────────────────┘ └──────────────────┘ └─────────────────┘  │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Providers (10+)                                                  │   │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │   │ │
│  │  │ │  World   │ │Character │ │  Skills  │ │     Banking      │    │   │ │
│  │  │ │ Provider │ │ Provider │ │ Provider │ │     Provider     │    │   │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘    │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ HyperscapeService (Core Service)                                 │   │ │
│  │  │ ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │ │
│  │  │ │ WebSocket Client │  │  State Manager   │  │  RPG Systems   │ │   │ │
│  │  │ │                  │  │                  │  │                │ │   │ │
│  │  │ │ - Connect        │  │ - World state    │  │ - Skills       │ │   │ │
│  │  │ │ - Send actions   │  │ - Player state   │  │ - Inventory    │ │   │ │
│  │  │ │ - Receive events │  │ - Entity cache   │  │ - Banking      │ │   │ │
│  │  │ └──────────────────┘  └──────────────────┘  └────────────────┘ │   │ │
│  │  │                                                                  │   │ │
│  │  │ ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │   │ │
│  │  │ │ Managers (9)     │  │  Content Packs   │  │ Test Framework │ │   │ │
│  │  │ │                  │  │                  │  │                │ │   │ │
│  │  │ │ - Behavior       │  │ - Character defs │  │ - Visual tests │ │   │ │
│  │  │ │ - Playwright     │  │ - Behaviors      │  │ - ColorDetect  │ │   │ │
│  │  │ │ - Build          │  │ - Presets        │  │ - State verify │ │   │ │
│  │  │ │ - Message        │  │                  │  │ - Playwright   │ │   │ │
│  │  │ │ - Multi-agent    │  │                  │  │                │ │   │ │
│  │  │ └──────────────────┘  └──────────────────┘  └────────────────┘ │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ WebSocket Protocol
                                    │ ws://host:5555/ws
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HYPERSCAPE GAME WORLD                                 │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  3D Engine (Three.js)                                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │   Renderer   │  │   Physics    │  │   Spatial    │                │ │
│  │  │   (WebGL)    │  │   Engine     │  │   Queries    │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  ECS (Entity-Component-System)                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │   Entities   │  │  Components  │  │   Systems    │                │ │
│  │  │              │  │              │  │              │                │ │
│  │  │ - Players    │  │ - Position   │  │ - Movement   │                │ │
│  │  │ - NPCs       │  │ - Mesh       │  │ - Combat     │                │ │
│  │  │ - Items      │  │ - Health     │  │ - Inventory  │                │ │
│  │  │ - Resources  │  │ - Inventory  │  │ - Skills     │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  RPG Systems                                                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │   Skills     │  │  Inventory   │  │   Banking    │                │ │
│  │  │              │  │              │  │              │                │ │
│  │  │ - Woodcut    │  │ - Items      │  │ - Deposits   │                │ │
│  │  │ - Fishing    │  │ - Capacity   │  │ - Withdraws  │                │ │
│  │  │ - Cooking    │  │ - Equipment  │  │ - Storage    │                │ │
│  │  │ - Combat     │  │              │  │              │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  World State                                                           │ │
│  │  - Players: Map<string, PlayerState>                                  │ │
│  │  - Entities: Map<string, Entity>                                      │ │
│  │  - Environment: { time, weather, region }                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                    │
└─────────────────────────────────────────────────────────────────────┘

USER INPUT ──────► LLM (ElizaOS) ──────► ACTION SELECTION ──────► VALIDATION
                        │
                        │ Uses Context
                        ▼
                   PROVIDERS
                   - World state
                   - Character state
                   - Skills/inventory

VALIDATION (pass) ──────► ACTION HANDLER ──────► HYPERSCAPE WORLD
                                                         │
                                                         │ WebSocket
                                                         ▼
                                                  STATE UPDATE
                                                         │
                                                         ▼
FEEDBACK ◄────── PROVIDERS UPDATE ◄────── STATE SYNCHRONIZATION
    │
    ▼
AGENT REPLY ──────► USER
```

---

## Testing Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      TESTING ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────┘

TEST RUNTIME
    │
    ├─► REAL HYPERSCAPE INSTANCE
    │       │
    │       ├─► 3D World Running
    │       ├─► Entities Spawned
    │       └─► Agent Connected
    │
    ├─► VISUAL TESTING
    │       │
    │       ├─► ColorDetector
    │       │       └─► Detect entities by color
    │       │
    │       └─► Playwright
    │               └─► Screenshot verification
    │
    ├─► STATE TESTING
    │       │
    │       ├─► Inventory checks
    │       ├─► Skill progression
    │       └─► Position verification
    │
    └─► RESULT VERIFICATION
            │
            ├─► Visual checks passed?
            ├─► State checks passed?
            └─► Generate report
```

---

## Multi-Agent Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT SYSTEM                                │
└─────────────────────────────────────────────────────────────────────┘

MultiAgentManager
    │
    ├─► Agent 1 (Explorer)
    │       └─► Goal: Explore new areas
    │
    ├─► Agent 2 (Gatherer)
    │       └─► Goal: Collect 100 logs
    │
    ├─► Agent 3 (Social)
    │       └─► Goal: Chat with players
    │
    └─► Agent N (Custom)
            └─► Goal: Custom behavior

COORDINATION:
    - Shared knowledge base
    - Avoid duplicate targets
    - Team tasks (gather as group)
    - Conflict resolution
```

---

## Plugin Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      PLUGIN LIFECYCLE                                │
└─────────────────────────────────────────────────────────────────────┘

1. INITIALIZATION
   ├─► Load plugin configuration
   ├─► Validate environment variables
   └─► Register with ElizaOS

2. SERVICE STARTUP
   ├─► HyperscapeService.initialize()
   ├─► Connect to WebSocket
   ├─► Sync initial world state
   └─► Initialize managers

3. RUNTIME OPERATION
   ├─► Process events
   ├─► Execute actions
   ├─► Run evaluators
   └─► Update providers

4. SHUTDOWN
   ├─► Disconnect from world
   ├─► Save state
   └─► Cleanup resources
```

---

[← Back to Index](../README.md) | [See Also: System Architecture](../04-architecture/plugin-overview.md)
