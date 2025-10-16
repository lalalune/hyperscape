# Test Characters

## Timber (Woodcutter Test Agent)

**File**: [`woodcutter-test.json`](./woodcutter-test.json)

### Purpose

Timber is a specialized test agent designed to verify RPG skill action mechanics in the Hyperscape plugin. He focuses on woodcutting but understands the entire resource gathering system.

### Plugin Configuration (ElizaOS Methodology)

Following [ElizaOS plugin ordering guidelines](https://github.com/elizaOS/eliza/blob/main/packages/cli/tests/unit/characters/README.md):

1. **`@elizaos/plugin-sql`** - Core database functionality (loaded first)
2. **`@elizaos/plugin-vercel-ai-gateway`** - AI gateway for routing models (loaded second)
3. **`@elizaos/plugin-hyperscape`** - Custom Hyperscape integration (loaded last)

**Note**: Uses vercel-ai-gateway instead of plugin-openai for more flexible model routing.

### Character Design

**System Prompt**: Defines Timber as a methodical woodcutter who tests game mechanics and reports bugs clearly.

**Bio**: Establishes expertise in:
- Resource gathering mechanics
- Skill progression systems
- Timeout handling
- Bug reporting

**Topics**: Focused on woodcutting, forestry, skill systems, and testing methodology.

**Style**:
- Direct, factual communication
- Technical precision (reports exact numbers)
- No emotional embellishment
- Clear error reporting

**Message Examples**: Demonstrates how Timber:
- Explains action prerequisites (tools, skill levels)
- Reports timeout issues accurately
- Describes XP/inventory updates precisely
- Identifies bugs with specifics

### Usage

#### Quick Start (✅ Verified Working - 2025-10-14)

**Run Timber agent now**:

```bash
cd /Users/home/dev/hyperscape/packages/plugin-hyperscape
elizaos dev --character /Users/home/dev/hyperscape/packages/plugin-hyperscape/characters/woodcutter-test.json
```

**Expected Output**:
```
AgentServer is listening on port 3000
Started 1 agents
[Timber] MessageBusService: Agent is subscribed to 1 servers
```

**Access**: http://localhost:3000

#### Run Automated Tests

```bash
cd /Users/home/dev/hyperscape/packages/plugin-hyperscape
bun test src/__tests__/rpg-action-bugs.test.ts
```

This runs the 13 bug-finding tests in [`__tests__/rpg-action-bugs.test.ts`](../src/__tests__/rpg-action-bugs.test.ts).

#### Interactive Testing

Once the agent is running (see Quick Start above), send messages via:
- **Web UI**: http://localhost:3000
- **API**: POST http://localhost:3000/api/messages

Example commands to send to Timber:
- "Chop some trees"
- "What's your woodcutting level?"
- "Test the CHOP_TREE action thoroughly"
- "Report any bugs you found"

#### Validate Configuration

```bash
./scripts/run-test-agent.sh validate
```

Checks:
- Character JSON syntax
- Plugin sequence
- Environment variables
- Database configuration

### Expected Behavior

Timber should:
- ✅ Wait for axe/hatchet before attempting to chop
- ✅ Check skill level requirements
- ✅ Report timeout bugs when actions hang >15s
- ✅ Describe race conditions when events arrive out of order
- ✅ Track XP gains and level-ups accurately
- ✅ Fail fast when data is missing or malformed

### Test Coverage

Timber's tests cover:

1. **Timeout Bugs**: Actions waiting forever vs 15s limit
2. **Race Conditions**: Event order (inventory before completion)
3. **State Composition**: Tool checks, inventory validation
4. **WebSocket Packets**: Correct structure, required fields
5. **Error Propagation**: Crashes vs graceful failures
6. **Level Requirements**: Skill gating, validation

See [`TESTING.md`](../TESTING.md) for complete test documentation.

### Environment Variables

Required in [`.env.test`](../.env.test.example):

```bash
# Required
HYPERSCAPE_TEST_WORLD=https://hyperscape.io/your-world
OPENAI_API_KEY=sk-your-key

# Optional
HYPERSCAPE_AUTH_TOKEN=your-token
DATABASE_ADAPTER=sqlite
SQLITE_FILE=./test-data/timber.db
```

### Plugin Sequence Rationale

Following ElizaOS best practices:

1. **SQL First**: Database must initialize before any plugin accesses storage
2. **Vercel AI Gateway Second**: AI gateway loads after core infrastructure, provides flexible model routing (OpenAI, Anthropic, etc.)
3. **Hyperscape Last**: Custom plugin loads after AI providers, can use LLM for dynamic behaviors

This order ensures:
- ✅ Database connections available when actions need them
- ✅ AI gateway available for character intelligence and embeddings
- ✅ Flexible model selection (gpt-4o-mini, claude-3.5-sonnet, etc.)
- ✅ Hyperscape actions can leverage AI capabilities
- ✅ No circular dependencies
- ✅ Bootstrap not needed - Hyperscape provides all necessary actions

### Adding More Test Characters

To create additional specialized test agents:

1. Copy `woodcutter-test.json` as template
2. Modify `name`, `system`, `bio` for new specialization
3. Add relevant `topics` and `messageExamples`
4. Keep plugin sequence identical (per ElizaOS methodology)
5. Update this README with new character

Example specializations:
- **Fisher Test Agent**: Test `CATCH_FISH` action
- **Cook Test Agent**: Test `COOK_FOOD` with fire/fish dependencies
- **Banker Test Agent**: Test `BANK_ITEMS` inventory operations
- **Combat Test Agent**: Test combat actions and damage calculation
