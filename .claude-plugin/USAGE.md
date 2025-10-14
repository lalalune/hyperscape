# Usage Guide - Hyperscape Development Plugin

This guide shows you how to use the Hyperscape Development Plugin effectively in your daily development workflow.

## Quick Start

### Basic Workflow

1. **Start a new feature**
   ```bash
   /create-action myNewAction
   ```

2. **Implement the action**
   - Edit generated `src/actions/myNewAction.ts`
   - Follow strong typing rules (no any/unknown)

3. **Validate types**
   ```bash
   /check-types
   ```

4. **Test the action**
   ```bash
   /test-rpg myNewAction
   ```

5. **Analyze any errors**
   ```bash
   /analyze-errors
   ```

## MCP Server Tools

Use MCP tools directly in Claude Code chat by mentioning them:

### Validate TypeScript Types

```
Use hyperscape_validate_types to check packages/plugin-hyperscape/src
```

**Output:**
- ✅ No violations found, or
- ❌ List of files with any/unknown types

### Run Visual Tests

```
Use hyperscape_run_visual_test with testName "rpg-action-bugs.test.ts"
```

**Output:**
- Test execution results
- Pass/fail status
- Error messages if any

### Generate New Action

```
Use hyperscape_generate_action with:
- actionName: "mineRock"
- description: "Mine rocks to gather ore"
- similes: ["mine", "dig", "excavate"]
```

**Output:**
- Generated action file path
- Generated test file path
- Next steps checklist

### Analyze Error Logs

```
Use hyperscape_analyze_logs with logType "all" and detailed true
```

**Output:**
- Count of type errors, runtime errors, test failures
- Categorized error details
- File references

## Slash Commands

### /test-rpg [action]

Test RPG actions with real Hyperscape worlds.

**Examples:**
```bash
# Test specific action
/test-rpg chopTree

# Test all actions
/test-rpg
```

**What it does:**
1. Builds plugin-hyperscape
2. Starts Hyperscape test server
3. Runs tests with Playwright
4. Shows colored cube proxies:
   - 🟡 Yellow cubes = Trees
   - 🔴 Red cubes = Players
   - 🟣 Purple cubes = Banks
5. Reports pass/fail with screenshots

### /test-visual [feature]

Run visual tests with screenshot analysis.

**Examples:**
```bash
# Test woodcutting visuals
/test-visual woodcutting

# Test banking UI
/test-visual banking
```

**What it does:**
1. Launches Playwright browser
2. Creates mini-world for feature
3. Uses ColorDetector to analyze screenshots
4. Validates entity positions
5. Checks scene hierarchy

### /run-agent [character]

Launch a test agent in Hyperscape world.

**Examples:**
```bash
# Run lumberjack agent
/run-agent lumberjack

# Run custom character
/run-agent myCharacter
```

**What it does:**
1. Loads character from `characters/[name].json`
2. Builds plugin-hyperscape
3. Connects to Hyperscape WebSocket
4. Monitors real-time actions:
   - PERCEIVE - Agent observes surroundings
   - GOTO - Agent navigates
   - CHOP_TREE - Agent chops trees
   - BANK_ITEMS - Agent banks items
5. Saves interaction logs

**Character Config Format:**
```json
{
  "name": "Lumberjack",
  "bio": "A skilled woodcutter",
  "settings": {
    "DEFAULT_HYPERSCAPE_WS_URL": "wss://localhost:3000"
  }
}
```

### /check-types

Validate TypeScript strong typing rules.

**What it checks:**
- ❌ No `any` types
- ❌ No `unknown` types
- ❌ No `as any` casts
- ✅ Proper type annotations

**Output:**
```
✅ No type violations found in 94 files
```

Or:

```
❌ Type violations found:

packages/plugin-hyperscape/src/actions/example.ts:42: : any
packages/plugin-hyperscape/src/utils/helpers.ts:15: as any
```

### /build-plugin [mode]

Build plugin-hyperscape.

**Examples:**
```bash
# Standard build
/build-plugin

# Watch mode for development
/build-plugin dev
```

### /create-action [name]

Generate new ElizaOS action with proper structure.

**Example:**
```bash
/create-action mineRock
```

**Generates:**
1. `src/actions/mineRock.ts`
   - Proper ElizaOS Action interface
   - TypeScript types (no any/unknown)
   - validate() and handler() methods
   - Example usage array

2. `src/__tests__/actions/mineRock.test.ts`
   - Real test structure (no mocks)
   - Placeholders for Hyperscape world tests

**Next steps after generation:**
1. Implement action logic in handler
2. Add real tests with mini-worlds
3. Export in `src/index.ts`
4. Add to `package.json` agentConfig.actions
5. Test with `/test-rpg mineRock`

### /analyze-errors

Analyze error logs and get intelligent suggestions.

**What it does:**
1. Scans `/logs` folder
2. Categorizes errors:
   - TypeScript errors
   - Runtime errors
   - Test failures
3. Identifies patterns
4. Suggests fixes based on Hyperscape patterns
5. Links to relevant documentation

**Output:**
```
📊 Log Analysis (15 files):

🔴 Type Errors: 3 files
⚠️  Runtime Errors: 1 file
❌ Test Failures: 2 files

📄 error-2025-01-15.log:
TypeError: Cannot read property 'position' of undefined
  at src/systems/controls.ts:42

💡 Suggestion: Add null check before accessing entity.position
See: packages/plugin-hyperscape/src/systems/actions.ts:156 for pattern
```

### /extract-memories

Extract memories and rules from chat history.

**Steps:**

1. Export current chat to JSON:
   ```json
   [
     {
       "role": "user",
       "content": "Help me implement fishing",
       "timestamp": "2025-01-15T10:00:00Z"
     },
     {
       "role": "assistant",
       "content": "I'll help create a fishing action...",
       "timestamp": "2025-01-15T10:01:00Z"
     }
   ]
   ```

2. Run extraction:
   ```bash
   /extract-memories
   ```

3. Provide path to chat history JSON when prompted

**What it generates:**

**Memory Bank (`.cursor/memory/`):**
- `activeContext.md` - Current objectives and blockers
- `decisionLog.md` - Technical decisions made
- `progress.md` - Work completed and patterns
- `productContext.md` - Architecture insights

**Rules (`.cursor/rules/`):**
- `coding-standards.mdc` - Extracted coding rules
- `testing.mdc` - Testing patterns found
- `architecture.mdc` - Architecture decisions
- `workflow.mdc` - Workflow automations

**Memory Types Extracted:**
- 🎯 **Decisions** - Technical choices and rationale
- 🔄 **Patterns** - Recurring development patterns
- 📝 **Context** - Important codebase knowledge
- 🚧 **Blockers** - Issues encountered
- 💡 **Learnings** - Insights and discoveries

**Rule Categories:**
- **coding-standards** - TypeScript, naming, structure
- **testing** - Test methodologies
- **architecture** - System design patterns
- **workflow** - Development processes
- **security** - Security practices

## Advanced Workflows

### Full Feature Development

```bash
# 1. Create action
/create-action catchFish

# 2. Implement action in src/actions/catchFish.ts

# 3. Validate types
/check-types

# 4. Create real test with mini-world

# 5. Run tests
/test-rpg catchFish

# 6. Fix any issues
/analyze-errors

# 7. Run visual verification
/test-visual fishing

# 8. Test with agent
/run-agent fisherman
```

### Debugging Workflow

```bash
# 1. Check recent errors
/analyze-errors

# 2. Validate types
/check-types

# 3. Run specific test
/test-rpg [failing-action]

# 4. Examine logs
cat logs/[latest-error].log
```

### Testing Workflow

```bash
# 1. Build plugin
/build-plugin

# 2. Run action tests
/test-rpg chopTree
/test-rpg catchFish
/test-rpg cookFood

# 3. Run visual tests
/test-visual woodcutting
/test-visual fishing
/test-visual cooking

# 4. Multi-agent testing
/run-agent lumberjack
/run-agent fisherman
```

### End-of-Session Workflow

```bash
# 1. Extract memories from chat
/extract-memories

# 2. Review generated memory bank
cat .cursor/memory/activeContext.md

# 3. Review generated rules
cat .cursor/rules/coding-standards.mdc

# 4. Commit updated memory and rules
git add .cursor/
git commit -m "Update memory bank and rules"
```

## Tips and Best Practices

### Type Validation
- Run `/check-types` before committing
- Fix violations immediately
- Use non-null assertions (`value!`) when safe
- Import types with `import type { TypeName }`

### Testing
- Always test with real Hyperscape worlds
- Use colored cube proxies for visual verification
- Verify both data (ECS state) and visuals (screenshots)
- Keep mini-worlds focused on single features

### Action Development
- Use `/create-action` for proper scaffolding
- Follow ElizaOS action patterns
- Add comprehensive examples array
- Test with real agents using `/run-agent`

### Memory Extraction
- Run `/extract-memories` at end of sessions
- Review and refine generated rules
- Update memory bank regularly
- Use for onboarding new developers

### Error Analysis
- Use `/analyze-errors` to understand patterns
- Check logs directory regularly
- Fix root causes, not symptoms
- Document solutions in memory bank

## Colored Cube Proxies Reference

When running visual tests, entities are represented by colored cubes:

| Entity | Color | Emoji |
|--------|-------|-------|
| Player | Red | 🔴 |
| Goblin | Green | 🟢 |
| Item | Blue | 🔵 |
| Tree | Yellow | 🟡 |
| Bank | Purple | 🟣 |
| Store | Yellow-Green | 🟨 |
| Fire | Orange | 🟠 |
| Fish Spot | Cyan | 🩵 |

Use ColorDetector to verify entity presence in screenshots.

## Keyboard Shortcuts

When available in Claude Code:

- `Ctrl+/` - Open command palette
- Type `/` - Show slash commands
- `Ctrl+Shift+P` - Show MCP tools

## Troubleshooting

### Command Not Found
- Check `.claude/commands/` or `~/.claude/commands/`
- Restart Claude Code
- Verify command file is `.md` format

### MCP Tool Not Available
- Check `~/.claude/mcp.json` configuration
- Verify MCP server is built: `cd .claude-plugin/mcp && npm run build`
- Check server logs: `claude mcp logs hyperscape-dev`

### Test Failures
- Run `/analyze-errors` for details
- Check `/logs` directory
- Verify Hyperscape world is running
- Check WebSocket connection

### Type Violations
- Run `/check-types` to identify
- Fix immediately (don't commit violations)
- See CLAUDE.md for strong typing guidelines

## See Also

- [README.md](README.md) - Full feature documentation
- [INSTALL.md](INSTALL.md) - Installation instructions
- [CLAUDE.md](../CLAUDE.md) - Project rules and standards
- [Plugin-hyperscape README](../packages/plugin-hyperscape/README.md)

## Support

For help:
- GitHub Issues: https://github.com/HyperscapeAI/hyperscape/issues
- Check error logs: `/analyze-errors`
- Review documentation: README.md
