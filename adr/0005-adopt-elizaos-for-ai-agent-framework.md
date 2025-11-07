# 0005. Adopt ElizaOS for AI Agent Framework

Date: 2025-11-06

## Status

Accepted

## Context

Hyperscape is an AI-powered virtual world where NPCs, assistants, and autonomous agents interact with players using natural language and intelligent behaviors. The game requires a robust AI agent framework to manage conversations, actions, memory, and integration with the 3D game world.

### Current Situation
- 3D multiplayer game with NPCs requiring intelligent dialogue and behavior
- Players interact with NPCs for quests, trading, combat, and exploration
- Need for AI agents that can:
  - Maintain conversation context and memory
  - Take game actions (movement, combat, trading)
  - Respond to player actions and world events
  - Support multiple LLM providers (OpenAI, Anthropic, local models)
  - Integrate with game systems (inventory, quests, skills)

### Requirements
- **AI agent orchestration** - Manage multiple concurrent NPCs/agents
- **Memory and context** - Agents remember past interactions with players
- **Action execution** - Agents can perform game actions (attack, trade, move)
- **Multi-modal support** - Text conversations, voice, potentially vision
- **LLM provider flexibility** - Support OpenAI, Anthropic, local models
- **Plugin architecture** - Extend agent capabilities for game-specific features
- **TypeScript-first** - Type-safe integration with game server
- **Production-ready** - Reliable, tested framework
- **Active development** - Maintained, growing ecosystem

### Drivers
- **AI-powered gameplay** - Core differentiator for Hyperscape
- **Natural interaction** - Players expect intelligent, contextual NPC responses
- **Autonomous agents** - NPCs that can act independently in the world
- **Developer experience** - Framework that accelerates AI feature development
- **Extensibility** - Game-specific actions and behaviors via plugins

## Decision

We will **adopt ElizaOS as the AI agent framework** for all intelligent NPCs and autonomous agents in Hyperscape, integrated via the `@hyperscape/plugin-hyperscape` package.

### Key Points
- ElizaOS for agent runtime, memory, and LLM orchestration
- Custom plugin (`plugin-hyperscape`) bridges ElizaOS ↔ Hyperscape game engine
- Agents can query game state and execute game actions
- Memory system tracks player-NPC relationship history
- Support for multiple LLM providers via ElizaOS configuration
- TypeScript-native integration with game server
- NPCs backed by ElizaOS agents with custom personalities

### Implementation Details
```
packages/
├── plugin-hyperscape/     # ElizaOS plugin for Hyperscape
│   ├── src/
│   │   ├── actions/       # Game actions (attack, trade, move)
│   │   ├── providers/     # Game state providers
│   │   ├── evaluators/    # Behavior evaluation
│   │   └── index.ts       # Plugin export
```

**Integration pattern:**
1. ElizaOS agent receives player message
2. Agent queries game state via providers
3. Agent decides on action via LLM reasoning
4. Action executes in Hyperscape world
5. Result returned to ElizaOS for response generation
6. Agent memory updated with interaction

## Alternatives Considered

### Alternative 1: Custom AI Agent Framework
**Pros:**
- Complete control over architecture
- No dependencies on external framework
- Game-specific optimizations
- No learning curve for team

**Cons:**
- **Months of development** to build production-ready framework
- Must implement memory, context management, LLM orchestration
- Must maintain and debug complex agent logic
- No community support or ecosystem
- Risk of bugs and edge cases
- Delayed time-to-market for AI features

**Reason for rejection:** Building a custom agent framework is a massive undertaking that distracts from game development. ElizaOS provides production-ready foundation, allowing team to focus on game-specific AI behaviors rather than infrastructure.

### Alternative 2: LangChain
**Pros:**
- Popular AI framework with large ecosystem
- Many integrations and tools
- Good documentation
- Python and JavaScript versions

**Cons:**
- Primarily Python-focused (JavaScript version secondary)
- Not designed specifically for agents (more for chains/pipelines)
- Heavier abstraction layer
- Memory and state management less robust
- Not optimized for real-time, stateful agents
- Weaker TypeScript support

**Reason for rejection:** LangChain excels at building LLM pipelines and RAG systems but isn't optimized for stateful, autonomous agents. ElizaOS designed specifically for agent orchestration with better memory and action patterns.

### Alternative 3: AutoGPT / BabyAGI
**Pros:**
- Autonomous agent capabilities
- Designed for goal-oriented tasks
- Active research community

**Cons:**
- Experimental, not production-ready
- Unstable APIs and frequent breaking changes
- Resource-intensive (many LLM calls)
- Not designed for real-time game interaction
- Poor integration with external systems
- Primarily research projects, not frameworks

**Reason for rejection:** AutoGPT/BabyAGI are research projects demonstrating autonomous agents but lack production stability and game integration capabilities. Too experimental for production game server.

### Alternative 4: OpenAI Assistants API
**Pros:**
- Fully managed by OpenAI
- Built-in memory and tools
- Code interpreter, knowledge retrieval
- Simple API

**Cons:**
- **Vendor lock-in** to OpenAI only
- Cannot use Anthropic, local models, or alternatives
- Limited customization and control
- Potential latency (cloud API calls)
- Cost concerns at scale
- Cannot run agents locally for development

**Reason for rejection:** OpenAI Assistants API locks Hyperscape into single LLM provider. Need flexibility to use best model for each use case (Claude for complex reasoning, GPT for quick responses, local models for privacy/cost).

### Alternative 5: Custom LLM Integration (Direct API Calls)
**Pros:**
- Maximum simplicity
- Direct control over prompts and responses
- Minimal dependencies

**Cons:**
- No memory management (must build custom)
- No context handling beyond prompt engineering
- No action/tool framework
- Must implement retry logic, error handling
- Difficult to maintain conversation state
- No agent orchestration for multiple NPCs

**Reason for rejection:** Direct API calls suitable for simple use cases but insufficient for complex NPCs with memory, personality, and actions. ElizaOS provides battle-tested orchestration.

## Consequences

### Positive
- **Production-ready agents** - ElizaOS handles memory, context, LLM orchestration
- **Multi-LLM support** - Use OpenAI, Anthropic, local models interchangeably
- **Plugin architecture** - Game-specific actions cleanly isolated in plugin-hyperscape
- **TypeScript-native** - Full type safety across agent integration
- **Active development** - ElizaOS maintained and improving
- **Memory system** - Agents remember player interactions naturally
- **Action framework** - Structured pattern for game actions (attack, trade, etc.)
- **Rapid development** - Build intelligent NPCs in hours, not weeks
- **Testable** - ElizaOS provides testing utilities for agent behaviors

### Negative
- **External dependency** - Reliant on ElizaOS framework maintenance
- **Learning curve** - Team must learn ElizaOS concepts and patterns
- **Abstraction overhead** - Additional layer between game and LLM
- **Breaking changes** - ElizaOS updates may require plugin updates
- **Documentation** - Must document ElizaOS integration for team

### Neutral
- Plugin-hyperscape package adds to monorepo
- Agent configuration in separate files
- Environment variables for LLM API keys
- ElizaOS runs in same process as game server

### Risks
- **Risk 1: ElizaOS breaking changes**
  - Mitigation: Pin to stable version, test updates before upgrading
  - Fallback: Can fork ElizaOS if abandoned (open source)
  - Assessment: Low risk - active development, community support

- **Risk 2: Performance impact of agent processing**
  - Mitigation: Profile agent overhead, optimize prompts
  - Tuning: Use faster models for simple interactions
  - Scaling: Can run agents on separate process/server if needed

- **Risk 3: LLM API costs at scale**
  - Mitigation: Use cheaper models for common interactions
  - Caching: Cache common responses, use local models where appropriate
  - Monitoring: Track token usage, optimize prompts

- **Risk 4: Agent hallucinations causing game bugs**
  - Mitigation: Validate agent actions before execution
  - Safety: Whitelist allowed actions, prevent dangerous operations
  - Testing: Comprehensive testing of agent behaviors (ADR-0007)

## Implementation

### Action Items
- [x] Create plugin-hyperscape package
- [x] Integrate ElizaOS as dependency
- [x] Define game actions (attack, move, trade, etc.)
- [x] Create game state providers
- [x] Implement memory integration
- [x] Configure LLM providers (OpenAI, Anthropic)
- [ ] Document agent creation workflow
- [ ] Create example NPC configurations
- [ ] Implement agent testing framework
- [ ] Monitor agent performance in production

### Timeline
- **2025**: ElizaOS adopted for AI agent framework
- **Oct 2025**: Core integration completed
- **Nov 6, 2025**: ADR documented
- **Ongoing**: Expanding agent capabilities and NPC variety

### Success Metrics
- ✅ NPCs respond intelligently to player interactions - **ACHIEVED**
- ✅ Agents maintain conversation context across sessions - **ACHIEVED**
- ✅ Multiple LLM providers supported (OpenAI, Anthropic) - **ACHIEVED**
- [ ] Agent response latency < 2 seconds (p95) - **TO BE MEASURED**
- [ ] Zero game-breaking agent actions - **ONGOING VALIDATION**

## References

- [ElizaOS GitHub Repository](https://github.com/ai16z/eliza)
- [ElizaOS Documentation](https://elizaos.github.io/eliza/)
- packages/plugin-hyperscape/ - Hyperscape integration plugin
- package.json:12 - "elizaos" keyword
- CLAUDE.md - ElizaOS agent requestable rule
- README.md - "ElizaOS - AI agent framework" in tech stack

## Notes

**Plugin architecture advantages:**
The plugin-hyperscape package cleanly separates ElizaOS integration from core game logic:
- Game engine remains independent of AI framework
- Can swap AI frameworks in future if needed
- Clear boundary for testing and debugging
- Reusable pattern for other plugins

**ElizaOS strengths for gaming:**
1. **Memory system**: Tracks relationships, past actions, quest progress
2. **Action execution**: Clean pattern for game actions with validation
3. **Context management**: Maintains conversation flow across interruptions
4. **Provider pattern**: Query game state for informed decisions
5. **Multi-agent**: Orchestrate dozens of NPCs simultaneously

**Example agent workflow:**
```
Player: "I want to buy a sword"
↓
ElizaOS Agent receives message
↓
Provider queries: Player's gold, Store inventory
↓
LLM reasons: Player has enough gold, sword available
↓
Action executes: Transfer gold, add sword to inventory
↓
Agent responds: "Here's your new sword, adventurer!"
↓
Memory updated: Player purchased sword at timestamp
```

**LLM provider strategy:**
- **OpenAI GPT-4**: Complex quests, nuanced dialogue
- **Anthropic Claude**: Long conversations, world lore
- **GPT-3.5 Turbo**: Simple vendor interactions, common responses
- **Local models**: Development, privacy-sensitive interactions

**Message handling decoupling:**
Commit `9e673823` shows "Decouple message handling from ElizaOS bootstrap plugin" indicating thoughtful separation of concerns between ElizaOS and game-specific logic.

**Integration with other systems:**
- **Quests**: Agents track quest state in memory
- **Combat**: Agents can initiate/respond to combat via actions
- **Trading**: Agents execute trades with inventory validation
- **World events**: Agents react to player actions in game world

**Future enhancements:**
- Voice interaction via speech-to-text/text-to-speech
- Vision capabilities for analyzing screenshots
- Multi-agent collaboration (NPC groups coordinating)
- Player-created AI agents (custom NPCs)
- Agent personality presets (merchant, warrior, wizard)

**Testing strategy (related to ADR-0007):**
ElizaOS agents tested via Playwright scenarios:
- Create mini-world with NPC
- Player sends message to NPC
- Verify agent response and action execution
- Check memory persistence
