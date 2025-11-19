# Cursor Hooks Index Memory

Complete index of all hooks in `.cursor/hooks/` with descriptions and triggers.

## Hook Configuration

**Location**: `/Users/home/hyperscape/.cursor/hooks.json`

**Hook Types**:
- `beforeSubmitPrompt` - Runs before prompt submission
- `afterFileEdit` - Runs after file edits
- `beforeReadFile` - Runs before reading files
- `beforeMCPExecution` - Runs before MCP execution

## Before Prompt Submission Hooks

### 1. research-reminder.sh
**Purpose**: Reminds to research before implementing complex changes

**Triggers**: Keywords: implement, create, add, build, new, feature, plugin, service, action, provider, system, manager, elizaos, hyperscape, api, integration, architecture, refactor

**Output**: Research reminder with links to:
- ElizaOS documentation
- Plugin architecture
- Existing code patterns
- Context7 MCP or web search

**Rules**:
- ✅ Checks for research keywords
- ✅ Provides research checklist
- ✅ Suggests documentation sources

### 2. kiss-reminder.sh
**Purpose**: Reminds about Keep It Simple Stupid (KISS) principle

**Triggers**: 
- Complexity keywords: complex, sophisticated, advanced, optimize, refactor, architecture, framework, abstraction, pattern, design
- Duplication keywords: new file, create new, enhanced, improved, better

**Output**: KISS reminder with:
- Code reuse suggestions
- Simplicity reminders
- DRY principle enforcement

**Rules**:
- ✅ Checks for complexity indicators
- ✅ Checks for duplication indicators
- ✅ Suggests code reuse
- ✅ Promotes simplicity

### 3. context-gatherer.sh
**Purpose**: Analyzes prompt for keywords and provides context-gathering instructions

**Triggers**: Keywords: action, provider, service, evaluator, manager, system, event, route, database, model

**Output**: Context-gathering instructions requiring:
- Codebase search tools
- Specific file searches
- Pattern reviews

**Rules**:
- ✅ Detects component keywords
- ✅ Requires codebase search
- ✅ Provides specific instructions

### 4. eliza-docs-hook.sh
**Purpose**: Uses Eliza documentation index to suggest relevant docs

**Integration**:
- Uses `.cursor/tools/doc-visitor.sh`
- References `.cursor/memory/elizaos-docs-index.md`
- Works with all `elizaos-*.md` memory files

**Output**: Documentation suggestions with:
- Relevant ElizaOS documentation URLs
- File/task to documentation mapping
- Critical content summaries

**Rules**:
- ✅ Only checks plugin-eliza files
- ✅ Uses doc-visitor tool
- ✅ References documentation index
- ✅ Formats output clearly

### 5. doc-visitor-hook.sh
**Purpose**: Ensures agent visits relevant documentation pages

**Integration**:
- Uses `.cursor/tools/doc-visitor.sh`
- Maps file paths to documentation pages

**Output**: Documentation page suggestions

**Rules**:
- ✅ Maps file paths to docs
- ✅ Maps tasks to docs
- ✅ Enforces documentation visits

## After File Edit Hooks

### 1. enforce-plugin-rules.sh
**Purpose**: Enforces Hyperscape plugin rules after file edits

**Checks**:
- Direct world access (should use service)
- Missing service availability checks
- Using 'any' type
- Missing error handling in async functions
- Missing ActionResult structure
- Missing examples in actions
- Missing dynamic flag in providers

**Output**: Violation warnings with:
- Specific violation type
- File location
- Suggested fixes

**Rules**:
- ✅ Only checks plugin-eliza files
- ✅ Validates against plugin rules
- ✅ Provides specific violations
- ✅ Suggests fixes

### 2. duplicate-checker.sh
**Purpose**: Detects potential code duplication

**Checks**:
- Naming patterns suggesting duplication
- Deep relative imports
- Similar function/class names

**Output**: Duplication warnings with:
- Potential duplicate locations
- Suggestions for code reuse

**Rules**:
- ✅ Detects naming patterns
- ✅ Warns about deep imports
- ✅ Suggests code reuse

### 3. dependency-checker.sh
**Purpose**: Verifies imports and dependencies

**Checks**:
- Direct `three` imports (should use `THREE` from `@hyperscape/shared`)
- ESM import extensions
- Wrong package imports

**Output**: Dependency warnings with:
- Incorrect import patterns
- Suggested fixes

**Rules**:
- ✅ Checks import patterns
- ✅ Validates package imports
- ✅ Suggests correct imports

## Before Read File Hooks

### 1. research-check.sh
**Purpose**: Reminds to research before modifying core plugin files

**Triggers**: Core files: index.ts, service.ts, HyperscapeService.ts

**Output**: Research checklist with:
- Caution warnings
- Research requirements
- Documentation links

**Rules**:
- ✅ Triggers on core files
- ✅ Provides caution checklist
- ✅ Suggests research

### 2. critical-file-protection.sh
**Purpose**: Warns when attempting to edit core plugin files

**Protected Files**:
- `packages/plugin-eliza/src/index.ts`
- `packages/plugin-eliza/src/service.ts`
- `packages/plugin-eliza/src/services/HyperscapeService.ts`

**Output**: Protection warnings with:
- File importance
- Caution checklist
- Research requirements

**Rules**:
- ✅ Protects core files
- ✅ Provides checklist
- ✅ Requires confirmation

### 3. eliza-docs-hook.sh
**Purpose**: Suggests relevant docs when reading files

**Same as beforeSubmitPrompt version** - Provides documentation suggestions based on file path

### 4. doc-visitor-hook.sh
**Purpose**: Ensures documentation visits before reading files

**Same as beforeSubmitPrompt version** - Maps file paths to documentation pages

## Hook Execution Flow

### Before Prompt Submission
```
User submits prompt
  ↓
research-reminder.sh (checks for research keywords)
  ↓
kiss-reminder.sh (checks for complexity/duplication)
  ↓
context-gatherer.sh (analyzes for component keywords)
  ↓
eliza-docs-hook.sh (suggests Eliza documentation)
  ↓
doc-visitor-hook.sh (maps to documentation pages)
  ↓
Prompt processed
```

### After File Edit
```
File edited
  ↓
enforce-plugin-rules.sh (validates against rules)
  ↓
duplicate-checker.sh (checks for duplication)
  ↓
dependency-checker.sh (validates imports)
  ↓
Edit complete
```

### Before Read File
```
File read requested
  ↓
research-check.sh (checks if core file)
  ↓
critical-file-protection.sh (warns if protected)
  ↓
eliza-docs-hook.sh (suggests docs)
  ↓
doc-visitor-hook.sh (maps to docs)
  ↓
File read
```

## Hook Script Format

### Input Format
Hooks receive JSON via stdin:
```json
{
  "file_path": "packages/plugin-eliza/src/actions/movement.ts",
  "prompt": "Add a new movement action",
  "edits": [...]
}
```

### Output Format
Hooks output JSON:
```json
{
  "continue": true,
  "user_message": "Optional message to user",
  "agent_message": "Optional message to agent"
}
```

## Hook Dependencies

### Tools Used
- **doc-visitor.sh** - Used by eliza-docs-hook.sh and doc-visitor-hook.sh
- **jq** - JSON parsing (required for all hooks)
- **grep** - Pattern matching

### Files Referenced
- `.cursor/tools/doc-visitor.sh` - Documentation visitor tool
- `.cursor/memory/elizaos-docs-index.md` - Documentation index
- `.cursor/rules/plugin-eliza-*.mdc` - Plugin rules

## Hook Best Practices

1. **Exit Early** - Exit 0 if hook doesn't apply
2. **JSON Output** - Always output valid JSON
3. **Error Handling** - Handle errors gracefully
4. **Performance** - Keep hooks fast (under 1 second)
5. **Clear Messages** - Provide actionable messages
6. **Context Aware** - Only trigger when relevant

## Troubleshooting

### Hooks Not Running
- Check `.cursor/hooks.json` syntax
- Verify hook paths are correct
- Ensure hooks are executable (`chmod +x`)

### Hook Errors
- Check hook script syntax
- Verify dependencies (jq, grep)
- Check file paths in hooks

### Performance Issues
- Optimize hook scripts
- Add early exits
- Cache results when possible

## Hook Development

### Creating New Hooks
1. Create script in `.cursor/hooks/`
2. Make executable: `chmod +x .cursor/hooks/new-hook.sh`
3. Add to `.cursor/hooks.json`
4. Test with sample input
5. Document in this memory file

### Hook Testing
```bash
# Test hook with sample input
echo '{"prompt": "add new action"}' | .cursor/hooks/research-reminder.sh

# Test hook with file path
echo '{"file_path": "packages/plugin-eliza/src/actions/test.ts"}' | .cursor/hooks/doc-visitor-hook.sh
```

## Integration with Rules

Hooks enforce rules automatically:
- **enforce-plugin-rules.sh** - Enforces plugin-eliza-*.mdc rules
- **research-reminder.sh** - Enforces research requirements
- **kiss-reminder.sh** - Enforces simplicity principles
- **eliza-docs-hook.sh** - Enforces documentation visits

## Hook Summary

**Total Hooks**: 10
- **Before Prompt**: 5 hooks
- **After Edit**: 3 hooks
- **Before Read**: 4 hooks (2 shared with before prompt)

**Key Hooks**:
- **eliza-docs-hook.sh** - NEW! Uses indexed Eliza documentation
- **enforce-plugin-rules.sh** - Rule enforcement
- **research-reminder.sh** - Research enforcement
- **kiss-reminder.sh** - Simplicity enforcement

