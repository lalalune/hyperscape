# Cursor Tools Index Memory

Complete index of all tools in `.cursor/tools/` with usage and integration.

## Tools Overview

**Location**: `/Users/home/hyperscape/.cursor/tools/`

**Purpose**: Helper tools used by hooks and commands to analyze code, suggest documentation, and enforce patterns.

## doc-visitor.sh

**Purpose**: Analyzes file paths or prompts and suggests relevant ElizaOS documentation pages

**Location**: `/Users/home/hyperscape/.cursor/tools/doc-visitor.sh`

### Usage

```bash
# With file path
echo '{"file_path": "packages/plugin-eliza/src/actions/movement.ts"}' | doc-visitor.sh

# With prompt
echo '{"prompt": "create new action"}' | doc-visitor.sh
```

### Input Format

```json
{
  "file_path": "packages/plugin-eliza/src/actions/movement.ts",
  "task": "Create new action",
  "prompt": "Add movement action"
}
```

### Output Format

```
Before working on packages/plugin-eliza/src/actions/movement.ts:

1. https://docs.elizaos.ai/guides/create-a-plugin - Action patterns
2. https://docs.elizaos.ai/plugins/architecture - Action interface
3. https://docs.elizaos.ai/plugins/components - Action details
```

### Integration

**Used By**:
- `eliza-docs-hook.sh` - Before prompt submission and file reading
- `doc-visitor-hook.sh` - Documentation visitor enforcement

**References**:
- `.cursor/memory/elizaos-docs-index.md` - Complete documentation index
- `.cursor/memory/elizaos-*.md` - Detailed documentation references

### Mapping Logic

**Actions** (`src/actions/**/*.ts`):
- https://docs.elizaos.ai/guides/create-a-plugin
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/plugins/components

**Providers** (`src/providers/**/*.ts`):
- https://docs.elizaos.ai/guides/create-a-plugin
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/runtime/providers

**Services** (`src/service.ts`, `src/services/**/*.ts`):
- https://docs.elizaos.ai/guides/create-a-plugin
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/runtime/services

**Plugin Entry** (`src/index.ts`):
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/guides/create-a-plugin
- https://docs.elizaos.ai/projects/overview

**Configuration** (`src/config/**/*.ts`, `.env`):
- https://docs.elizaos.ai/projects/environment-variables
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/guides/create-a-plugin

**Event Handlers** (`src/events/**/*.ts`):
- https://docs.elizaos.ai/runtime/events
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/guides/create-a-plugin

**Tests** (`src/__tests__/**/*.ts`):
- https://docs.elizaos.ai/guides/test-a-project
- https://docs.elizaos.ai/guides/create-a-plugin
- https://docs.elizaos.ai/plugins/development

**Managers** (`src/managers/**/*.ts`):
- https://docs.elizaos.ai/runtime/services
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/guides/create-a-plugin

**Systems** (`src/systems/**/*.ts`):
- https://docs.elizaos.ai/plugins/architecture
- https://docs.elizaos.ai/runtime/core
- https://docs.elizaos.ai/guides/create-a-plugin

### Implementation Details

**Dependencies**:
- `jq` - JSON parsing
- `grep` - Pattern matching
- `elizaos-docs-index.md` - Documentation index

**Pattern Matching**:
- File path patterns (actions/, providers/, services/, etc.)
- Keyword detection (action, provider, service, etc.)
- Task analysis (create, implement, add, etc.)

**Output Formatting**:
- Numbered list of documentation URLs
- Brief descriptions for each URL
- Context-specific suggestions

## Tool Integration

### With Hooks
- **eliza-docs-hook.sh** - Calls doc-visitor.sh for documentation suggestions
- **doc-visitor-hook.sh** - Uses doc-visitor.sh for enforcement

### With Commands
- Commands can use tools for analysis
- Tools provide structured output for commands

### With Rules
- Rules reference tools for documentation
- Tools enforce rule requirements

## Tool Development

### Creating New Tools
1. Create script in `.cursor/tools/`
2. Make executable: `chmod +x .cursor/tools/new-tool.sh`
3. Document input/output format
4. Integrate with hooks/commands
5. Update this memory file

### Tool Best Practices
1. **JSON Input** - Accept JSON via stdin
2. **Structured Output** - Provide formatted output
3. **Error Handling** - Handle errors gracefully
4. **Performance** - Keep tools fast
5. **Documentation** - Document usage clearly

## Tool Dependencies

### Required Tools
- **jq** - JSON parsing (required for all tools)
- **grep** - Pattern matching
- **bash** - Shell scripting

### Optional Tools
- **curl** - HTTP requests (if needed)
- **git** - Version control (if needed)

## Tool Usage Examples

### doc-visitor.sh Examples

```bash
# Analyze action file
echo '{"file_path": "packages/plugin-eliza/src/actions/movement.ts"}' | .cursor/tools/doc-visitor.sh

# Analyze provider file
echo '{"file_path": "packages/plugin-eliza/src/providers/gameState.ts"}' | .cursor/tools/doc-visitor.sh

# Analyze prompt
echo '{"prompt": "create new service"}' | .cursor/tools/doc-visitor.sh
```

## Tool Output Examples

### Action File Analysis
```
Before working on packages/plugin-eliza/src/actions/movement.ts:

1. https://docs.elizaos.ai/guides/create-a-plugin - Action patterns and implementation
2. https://docs.elizaos.ai/plugins/architecture - Action interface structure
3. https://docs.elizaos.ai/plugins/components - Action component details
```

### Provider File Analysis
```
Before working on packages/plugin-eliza/src/providers/gameState.ts:

1. https://docs.elizaos.ai/guides/create-a-plugin - Provider patterns
2. https://docs.elizaos.ai/plugins/architecture - Provider interface
3. https://docs.elizaos.ai/runtime/providers - Provider system details
```

### Prompt Analysis
```
Before implementing "create new service":

1. https://docs.elizaos.ai/guides/create-a-plugin - Service patterns
2. https://docs.elizaos.ai/plugins/architecture - Service interface
3. https://docs.elizaos.ai/runtime/services - Service lifecycle
```

## Tool Maintenance

### Updating Documentation Index
- Edit `.cursor/memory/elizaos-docs-index.md`
- Add new documentation pages
- Update file/task mappings
- Tool automatically uses updated index

### Adding New Mappings
- Edit `doc-visitor.sh`
- Add new file path patterns
- Add new keyword mappings
- Update output formatting

## Tool Summary

**Total Tools**: 1
- **doc-visitor.sh** - Documentation visitor tool

**Tool Purpose**:
- Analyze file paths and suggest documentation
- Analyze prompts and suggest documentation
- Enforce documentation visits
- Integrate with hooks and commands

**Tool Integration**:
- Used by 2 hooks (eliza-docs-hook.sh, doc-visitor-hook.sh)
- References documentation index
- Provides structured output
- Enforces documentation visits

