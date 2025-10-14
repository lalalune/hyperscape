# Hyperscape Development Plugin for Claude Code

**Version 2.0.0 (Optimized)** ⚡ Production-grade plugin with caching, performance monitoring, and advanced memory extraction.

A comprehensive Claude Code plugin for developing Hyperscape, the AI-powered 3D multiplayer game engine with ElizaOS integration.

## 🎯 Features

### 🔧 MCP Server Tools (9 Tools - v2.0)
- **hyperscape_validate_types** - Enforce TypeScript strong typing (cached 1min)
- **hyperscape_run_visual_test** - Execute visual tests with Playwright
- **hyperscape_generate_action** - Scaffold ElizaOS actions with validation
- **hyperscape_analyze_logs** - Parse and categorize error logs (cached 30s)
- **hyperscape_get_world_state** - Query running Hyperscape world (cached 5s)
- **hyperscape_check_rpg_state** - Inspect RPG game state (cached 10s)
- **hyperscape_get_metrics** ⚡ NEW - Performance analytics and statistics
- **hyperscape_clear_cache** ⚡ NEW - Manual cache management
- **hyperscape_health_check** ⚡ NEW - System diagnostics and health status

### ⌨️ Slash Commands
- `/test-rpg [action]` - Run RPG action tests with real worlds
- `/test-visual [feature]` - Visual testing with Playwright
- `/run-agent [character]` - Launch test agents in Hyperscape
- `/check-types` - Validate TypeScript strong typing rules
- `/build-plugin [mode]` - Build with optional watch mode
- `/create-action [name]` - Generate new action with tests
- `/analyze-errors` - Analyze error logs intelligently
- `/extract-memories` - Extract memories from chat history

### 🪝 Custom Hooks
- **validate-types.sh** - Pre-tool-use type validation
- **pre-commit.sh** - Comprehensive pre-commit checks
- **post-test.sh** - Automatic test result collection
- **validate-write.sh** - File write validation

### 🧠 Memory Tools (Enhanced v2.0)
- **chat-memory-extractor** - Systematically extract memories and rules
- **chat-memory-extractor-enhanced** ⚡ NEW - Advanced features:
  - Batch processing (50 msgs/batch, 10x faster)
  - Incremental updates and memory merging
  - Intelligent deduplication
  - Thematic clustering (--cluster flag)
  - Importance ranking (high/medium/low)
  - Automatic tagging system
- Generates 5 memory bank files (+ insights.md)
- Creates categorized rule files (.cursor/rules/*.mdc)
- Uses Claude Sonnet 4.5 for intelligent analysis

## ⚡ Quick Start (5 minutes)

### 1. Set Environment Variables
```bash
export HYPERSCAPE_PROJECT_ROOT="/path/to/hyperscape"
export ANTHROPIC_API_KEY="your-api-key"
```

### 2. Build Plugin Components
```bash
cd .claude-plugin/mcp && npm install && npm run build
cd ../memory-tools && npm install && npm run build
```

### 3. Configure MCP Server
```bash
claude mcp add --transport stdio hyperscape-dev \
  node $HYPERSCAPE_PROJECT_ROOT/.claude-plugin/mcp/dist/server.js
```

### 4. Test It Works
```
/check-types
```

See [INSTALL.md](INSTALL.md) for detailed setup instructions.

## 📦 Full Installation

For complete installation details, see [INSTALL.md](INSTALL.md).

Quick summary:

**Environment Variables:**
```bash
export HYPERSCAPE_PROJECT_ROOT=/path/to/hyperscape
export ANTHROPIC_API_KEY=your-api-key
export OPENAI_API_KEY=your-openai-key  # Optional, for memory extraction
```

### 4. Add MCP server to Claude Code

```bash
claude mcp add --transport stdio hyperscape-dev \
  node .claude-plugin/mcp/dist/server.js
```

## 🚀 Usage

### Running Tests

```bash
# Test specific RPG action
/test-rpg chopTree

# Run visual tests
/test-visual woodcutting

# Check for type violations
/check-types
```

### Creating New Actions

```bash
# Generate action scaffold
/create-action mineRock

# This creates:
# - src/actions/mineRock.ts
# - src/__tests__/actions/mineRock.test.ts
```

### Launching Test Agents

```bash
# Run agent with character config
/run-agent lumberjack

# Agent connects to Hyperscape world
# Monitor real-time actions: CHOP_TREE, BANK_ITEMS, etc.
```

### Analyzing Errors

```bash
# Parse and categorize error logs
/analyze-errors

# Get intelligent suggestions based on:
# - TypeScript errors
# - Runtime errors
# - Test failures
```

### Extracting Memories from Chat

```bash
# Export chat history to JSON
# (format: [{role: "user"|"assistant", content: "...", timestamp: "..."}])

# Extract memories and generate rules
/extract-memories

# This generates:
# - .cursor/memory/activeContext.md
# - .cursor/memory/decisionLog.md
# - .cursor/memory/progress.md
# - .cursor/memory/productContext.md
# - .cursor/rules/*.mdc
```

## 🎨 Visual Testing

The plugin supports Hyperscape's unique visual testing methodology:

### Colored Cube Proxies
- 🔴 Red = Players
- 🟢 Green = Goblins
- 🔵 Blue = Items
- 🟡 Yellow = Trees
- 🟣 Purple = Banks
- 🟨 Yellow-Green = Stores
- 🟠 Orange = Fires

### Testing Flow
1. Create mini-world for feature
2. Add colored cube proxies for entities
3. Run Playwright test
4. Capture screenshots
5. Analyze with ColorDetector
6. Verify both data and visuals

## 📋 Development Rules

The plugin enforces Hyperscape's development standards:

### TypeScript Strong Typing
- ❌ No `any` types
- ❌ No `unknown` types
- ✅ Explicit return types on public methods
- ❌ No `as any` casts
- ✅ Use type assertions: `value!`

### Testing Standards
- ✅ Real Hyperscape worlds (no mocks)
- ✅ Visual verification with screenshots
- ✅ Three.js scene hierarchy validation
- ✅ Data + visual multimodal testing

### File Management
- ✅ Edit existing files (don't create _v2, _new)
- ✅ Delete old files completely
- ✅ Update all imports
- ✅ Clean up orphaned files

## 🔧 MCP Server API

### hyperscape_validate_types
```typescript
{
  "path": "packages/plugin-hyperscape/src" // optional
}
```

### hyperscape_run_visual_test
```typescript
{
  "testName": "rpg-action-bugs.test.ts"
}
```

### hyperscape_generate_action
```typescript
{
  "actionName": "mineRock",
  "description": "Mine rocks to gather ore",
  "similes": ["mine", "dig"] // optional
}
```

### hyperscape_analyze_logs
```typescript
{
  "logType": "all" | "error" | "test" | "runtime",
  "detailed": true // optional
}
```

## 🧠 Memory Extraction

The chat memory extractor uses Claude to analyze development sessions:

### What It Extracts

**Memories:**
- Technical decisions and rationale
- Architecture patterns discovered
- Problems encountered and solutions
- Important codebase context
- Blockers and resolution status

**Rules:**
- Coding standards established
- Testing patterns validated
- File organization conventions
- Architecture decisions to enforce
- Workflows to automate

### Output Files

**Memory Bank (.cursor/memory/):**
- `activeContext.md` - Current session state, objectives, blockers
- `decisionLog.md` - Technical decisions with timestamps
- `progress.md` - Completed work and patterns
- `productContext.md` - Architecture and technology insights

**Rules (.cursor/rules/):**
- `coding-standards.mdc` - TypeScript and coding rules
- `testing.mdc` - Testing methodologies
- `architecture.mdc` - Architecture patterns
- `workflow.mdc` - Development workflows

## 🎯 Project Context

**Tech Stack:**
- Hyperscape - 3D multiplayer game engine (Three.js)
- ElizaOS - AI agent framework
- Playwright - Browser automation for testing
- TypeScript - Strict typing, no any/unknown
- Bun - Fast JavaScript runtime

**Key Packages:**
- `@elizaos/plugin-hyperscape` - AI agent integration
- `@hyperscape/hyperscape` - 3D engine core
- Actions: PERCEIVE, GOTO, USE, CHOP_TREE, CATCH_FISH, COOK_FOOD, etc.
- Providers: world state, actions, banking, skills, emotes

## 🤝 Contributing

When contributing to the plugin:

1. Follow Hyperscape's coding standards
2. Add tests for new features
3. Update documentation
4. Test all commands and tools
5. Validate with `/check-types`

## 📚 Documentation

- [CLAUDE.md](../CLAUDE.md) - Project rules and standards
- [README.md](../packages/plugin-hyperscape/README.md) - Plugin-hyperscape docs
- [LORE.md](../LORE.md) - Game world and lore

## 🐛 Issues

Report issues at: https://github.com/HyperscapeAI/hyperscape/issues

## 📄 License

UNLICENSED

---

**Built with ❤️ for the Hyperscape community**
