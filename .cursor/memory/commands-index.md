# Cursor Commands Index Memory

Complete index of all custom commands in `.cursor/commands/` with usage and examples.

## Custom Commands

### /elizaos-research
**Purpose**: Research ElizaOS patterns using Deepwiki MCP

**Usage**: `/elizaos-research <topic>`

**Example**:
```
/elizaos-research How do I create a new action?
```

**Behavior**:
1. Uses Deepwiki MCP (`mcp_deepwiki_ask_question`) to query ElizaOS documentation
2. Searches for relevant patterns in `packages/plugin-eliza/src/`
3. Compares with existing code
4. Provides:
   - Current ElizaOS pattern from documentation
   - Documentation references (URLs)
   - Comparison with existing code
   - Recommendations for implementation

**Files**:
- `.cursor/commands/elizaos-research.md` - Documentation
- `.cursor/commands/elizaos-research.sh` - Executable script (backup)

**Integration**:
- Uses Deepwiki MCP server
- References ElizaOS documentation
- Compares with existing plugin code

### /elizaos-validate
**Purpose**: Validate code against ElizaOS patterns

**Usage**: `/elizaos-validate <file or component>`

**Example**:
```
/elizaos-validate packages/plugin-eliza/src/actions/movement.ts
/elizaos-validate HyperscapeService
```

**Behavior**:
1. Reads specified file(s) or searches for component
2. Uses Deepwiki MCP to get current ElizaOS patterns
3. Compares implementation with current patterns
4. Provides validation report:
   - Status: ✅ Compliant | ⚠️ Needs Updates | ❌ Non-Compliant
   - Issues Found: List specific issues
   - Current Pattern: What current ElizaOS pattern is
   - Recommendations: How to fix issues
   - Documentation Reference: Link to relevant docs

**Files**:
- `.cursor/commands/elizaos-validate.md` - Documentation
- `.cursor/commands/elizaos-validate.sh` - Executable script (backup)

**Integration**:
- Uses Deepwiki MCP server
- References ElizaOS documentation
- Validates against current patterns

## Command Recognition

Commands are recognized by the agent through:
- **Rule**: `.cursor/rules/elizaos-commands.mdc` - Enables command recognition
- **Pattern**: Commands start with `/` prefix
- **Handler**: Agent processes commands and uses appropriate tools

## Command Implementation

### Recognition Pattern
```typescript
// Agent recognizes commands like:
/elizaos-research <topic>
/elizaos-validate <file or component>
```

### Execution Flow
1. **User types command** → Agent recognizes pattern
2. **Agent parses command** → Extracts topic/file
3. **Agent uses tools** → Deepwiki MCP, file reading, codebase search
4. **Agent provides results** → Documentation, validation report, recommendations

## Command Examples

### Research Examples
```
/elizaos-research Action interface structure
/elizaos-research Provider patterns
/elizaos-research Service lifecycle
/elizaos-research Event handling
/elizaos-research Messaging Socket.IO
```

### Validation Examples
```
/elizaos-validate packages/plugin-eliza/src/actions/movement.ts
/elizaos-validate packages/plugin-eliza/src/providers/gameState.ts
/elizaos-validate packages/plugin-eliza/src/service.ts
/elizaos-validate HyperscapeService
/elizaos-validate chatMessageAction
```

## Integration with Tools

### Deepwiki MCP
- **Tool**: `mcp_deepwiki_ask_question`
- **Purpose**: Query ElizaOS documentation
- **Usage**: Both commands use this for research

### Codebase Search
- **Tool**: `codebase_search`, `grep`, `read_file`
- **Purpose**: Find existing code patterns
- **Usage**: Compare with existing implementations

## Command Documentation

### Documentation Files
- `.cursor/commands/elizaos-research.md` - Research command docs
- `.cursor/commands/elizaos-validate.md` - Validate command docs
- `.cursor/commands/elizaos-quick-reference.md` - Quick reference
- `.cursor/commands/README.md` - Commands overview

### Rule File
- `.cursor/rules/elizaos-commands.mdc` - Command recognition and handling

## Command Best Practices

1. **Use for Research** - Use `/elizaos-research` before implementing new features
2. **Use for Validation** - Use `/elizaos-validate` after implementing features
3. **Be Specific** - Provide specific topics or file paths
4. **Review Results** - Always review command output
5. **Follow Recommendations** - Implement suggested fixes

## Command Workflow

### Research Workflow
```
User: /elizaos-research How do I create a new action?
  ↓
Agent: Uses Deepwiki MCP to query ElizaOS docs
  ↓
Agent: Searches existing code patterns
  ↓
Agent: Provides:
  - Current ElizaOS Action interface
  - Documentation references
  - Comparison with existing actions
  - Recommendations
```

### Validation Workflow
```
User: /elizaos-validate packages/plugin-eliza/src/actions/movement.ts
  ↓
Agent: Reads file
  ↓
Agent: Queries Deepwiki MCP for current patterns
  ↓
Agent: Compares implementation
  ↓
Agent: Provides:
  - Status (Compliant/Needs Updates/Non-Compliant)
  - Issues Found
  - Current Pattern
  - Recommendations
  - Documentation Reference
```

## Command Integration

### With Hooks
- Commands complement hooks
- Hooks provide automatic reminders
- Commands provide on-demand research/validation

### With Rules
- Commands enforce rules
- Rules guide command usage
- Commands validate against rules

### With Memory
- Commands use memory files for reference
- Memory files provide context
- Commands update memory when needed

## Quick Reference

### Research Command
- **Usage**: `/elizaos-research <topic>`
- **Purpose**: Research ElizaOS patterns
- **Tool**: Deepwiki MCP
- **Output**: Documentation, patterns, recommendations

### Validate Command
- **Usage**: `/elizaos-validate <file or component>`
- **Purpose**: Validate code against patterns
- **Tool**: Deepwiki MCP + codebase search
- **Output**: Validation report, issues, recommendations

## Command Files

**Location**: `/Users/home/hyperscape/.cursor/commands/`

**Files**:
- `elizaos-research.md` - Research command documentation
- `elizaos-research.sh` - Research command script (backup)
- `elizaos-validate.md` - Validate command documentation
- `elizaos-validate.sh` - Validate command script (backup)
- `elizaos-quick-reference.md` - Quick reference guide
- `README.md` - Commands overview

