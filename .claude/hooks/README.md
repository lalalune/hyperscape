# Cursor Hooks for Hyperscape Plugin

This directory contains Cursor hooks that enforce development rules and best practices for the Hyperscape plugin.

## Hooks Overview

### Before Prompt Submission (`beforeSubmitPrompt`)

1. **research-reminder.sh** - Reminds to research before implementing complex changes
   - Triggers on keywords: implement, create, add, build, new, feature, plugin, service, action, provider, system, manager, elizaos, hyperscape, api, integration, architecture, refactor
   - Suggests checking ElizaOS documentation and existing code patterns

2. **kiss-reminder.sh** - Reminds about Keep It Simple Stupid (KISS) principle
   - Triggers on complexity keywords: complex, sophisticated, advanced, optimize, refactor, architecture, framework, abstraction, pattern, design
   - Triggers on duplication keywords: new file, create new, enhanced, improved, better
   - Suggests code reuse and simplicity

3. **context-gatherer.sh** - Analyzes prompt for keywords and provides context-gathering instructions
   - Detects keywords: action, provider, service, evaluator, manager, system, event, route, database, model
   - Requires use of codebase search tools before implementation

4. **eliza-docs-hook.sh** - Uses Eliza documentation index to suggest relevant docs
   - Uses `.cursor/tools/doc-visitor.sh` to analyze file paths or prompts
   - References `.cursor/memory/elizaos-docs-index.md` for documentation mapping
   - Suggests relevant ElizaOS documentation pages based on context

5. **doc-visitor-hook.sh** - Ensures agent visits relevant documentation pages
   - Maps file paths/tasks to required documentation pages
   - Enforces documentation visits before implementation

### After File Edit (`afterFileEdit`)

1. **enforce-plugin-rules.sh** - Enforces Hyperscape plugin rules after file edits
   - Checks for direct world access (should use service)
   - Checks for missing service availability checks
   - Checks for 'any' type usage
   - Checks for missing error handling in async functions
   - Checks for missing ActionResult structure
   - Checks for missing examples in actions
   - Checks for missing dynamic flag in providers

2. **duplicate-checker.sh** - Detects potential code duplication
   - Detects naming patterns that suggest duplication
   - Warns about deep relative imports
   - Suggests code reuse

3. **dependency-checker.sh** - Verifies imports and dependencies
   - Checks for direct `three` imports (should use `THREE` from `@hyperscape/shared`)
   - Checks for ESM import extensions
   - Checks for wrong package imports

### Before Read File (`beforeReadFile`)

1. **research-check.sh** - Reminds to research before modifying core plugin files
   - Triggers on core files: index.ts, service.ts, HyperscapeService.ts
   - Provides checklist for caution

2. **critical-file-protection.sh** - Warns when attempting to edit core plugin files
   - Protects: index.ts, service.ts, HyperscapeService.ts
   - Provides checklist for caution

3. **eliza-docs-hook.sh** - Suggests relevant docs when reading files
   - Uses doc-visitor tool to suggest documentation
   - Maps file paths to required documentation pages

4. **doc-visitor-hook.sh** - Ensures documentation visits before reading files
   - Maps file paths to required documentation pages

## Hook Configuration

Hooks are configured in `.cursor/hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [...],
    "afterFileEdit": [...],
    "beforeReadFile": [...]
  }
}
```

## Eliza Documentation Integration

The `eliza-docs-hook.sh` hook integrates with:

- **Tool**: `.cursor/tools/doc-visitor.sh` - Analyzes file paths/prompts and suggests docs
- **Index**: `.cursor/memory/elizaos-docs-index.md` - Complete index of ElizaOS documentation
- **Memory Files**: `.cursor/memory/elizaos-*.md` - Detailed documentation references

### How It Works

1. Hook receives file path or prompt
2. Calls `doc-visitor.sh` tool with context
3. Tool analyzes context and references `elizaos-docs-index.md`
4. Returns relevant documentation URLs
5. Hook displays suggestions to user

### Example Output

```
📚 ElizaOS Documentation Suggestions:
======================================
Before working on packages/plugin-eliza/src/actions/movement.ts:

1. https://docs.elizaos.ai/guides/create-a-plugin - Action patterns
2. https://docs.elizaos.ai/plugins/architecture - Action interface
3. https://docs.elizaos.ai/plugins/components - Action details

💡 Tip: Visit these pages before implementing to ensure you follow current ElizaOS patterns.
```

## Adding New Hooks

To add a new hook:

1. Create hook script in `.cursor/hooks/`
2. Make it executable: `chmod +x .cursor/hooks/new-hook.sh`
3. Add to `.cursor/hooks.json` in appropriate hook type array
4. Test hook with sample input

## Hook Script Format

Hooks receive JSON input via stdin:

```json
{
  "file_path": "packages/plugin-eliza/src/actions/movement.ts",
  "prompt": "Add a new movement action",
  "edits": [...]
}
```

Hooks should output JSON:

```json
{
  "continue": true,
  "user_message": "Optional message to user",
  "agent_message": "Optional message to agent"
}
```

## Troubleshooting

- **Hooks not running**: Check `.cursor/hooks.json` syntax and hook paths
- **Permission denied**: Run `chmod +x .cursor/hooks/*.sh`
- **Hook errors**: Check hook script syntax and dependencies (jq, grep, etc.)
- **Documentation not found**: Verify `.cursor/tools/doc-visitor.sh` and `.cursor/memory/elizaos-docs-index.md` exist
